# Forensic Learning Record (Deep Inspection): someengineering/fixinventory

> **Canonical Artifact**: `07_PROJECT_LEARNING/someengineering-fixinventory-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/someengineering/fixinventory](https://github.com/someengineering/fixinventory))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:25:01.211Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `someengineering/fixinventory`
- **Description**: Fix Inventory helps you identify and remove the most critical risks in AWS, GCP, Azure and Kubernetes.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2078 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `fixcore/fixcore/__init__.py`
```
__version__ = "4.3.0"


def version() -> str:
    return __version__

```

### Core Architecture Module: `fixcore/fixcore/__main__.py`
```
import asyncio
import logging
import platform
import sys
import traceback
import warnings
from argparse import Namespace
from asyncio import Queue
from contextlib import suppress
from datetime import timedelta
from functools import partial
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import AsyncIterator, List, Union, cast

from aiohttp.web_app import Application
from attrs import evolve
from urllib3.exceptions import HTTPWarning

from fixcore import version
from fixcore.action_handlers.merge_deferred_edge_handler import MergeDeferredEdgesHandler
from fixcore.analytics import CoreEvent, NoEventSender
from fixcore.analytics.posthog import PostHogEventSender
from fixcore.analytics.recurrent_events import emit_recurrent_events
from fixcore.cli.cli import CLIService
from fixcore.cli.command import alias_names, all_commands
from fixcore.config.config_handler_service import ConfigHandlerService
from fixcore.config.config_override_service import ConfigOverrideService, model_from_db, override_config_for_startup
from fixcore.config.core_config_handler import CoreConfigHandler
from fixcore.core_config import (
    config_from_db,
    RunConfig,
    inside_docker,
    inside_kubernetes,
    helm_installation,
    FixCoreConfigId,
    parse_config,
    CoreConfig,
)
from fixcore.db import SystemData, CurrentDatabaseVersion
from fixcore.db.db_access import DbAccess
from fixcore.db.system_data_db import EphemeralJwtSigningKey
from fixcore.dependencies import Dependencies, ServiceNames, TenantDependencies
from fixcore.dependencies import (
    TenantDependencyProvider,
    FromRequestTenantDependencyProvider,
    DirectTenantDependencyProvider,
)
from fixcore.error import RestartService
from fixcore.graph_manager.graph_manager import GraphManager
from fixcore.infra_apps.local_runtime import LocalfixcoreAppRuntime
from fixcore.infra_apps.package_manager import PackageManager
from fixcore.message_bus import MessageBus
from fixcore.model.db_updater import GraphMerger
from fixcore.model.model_handler import ModelHandlerDB, ModelHandlerFromCodeAndDB
from fixcore.model.typed_model import to_json, class_fqn
from fixcore.query.template_expander_service import TemplateExpanderService
from fixcore.report.inspector_service import InspectorService
from fixcore.system_start import db_access, setup_process, parse_args, system_info, reconfigure_logging
from fixcore.task.scheduler import APScheduler, NoScheduler
from fixcore.task.subscribers import SubscriptionHandlerService
from fixcore.task.task_handler import TaskHandlerService
from fixcore.user.user_management import UserManagementService
from fixcore.util import shutdown_process, utc
from fixcore.web.accesslog import FixInventoryAccessLogger
from fixcore.web.api import Api
from fixcore.web.certificate_handler import CertificateHandlerWithCA, CertificateHandlerNoCA
from fixcore.worker_task_queue import WorkerTaskQueue
from fixlib.asynchronous.web import runner
from fixlib.utils import ensure_bw_compat

log = logging.getLogger("fixcore")


def main() -> None:
    """
    Application entrypoint - no arguments are allowed.
    """
    ensure_bw_compat()
    try:
        run(sys.argv[1:])
        log.info("Process finished.")
    except (KeyboardInterrupt, SystemExit):
        log.info("Stopping fix graph core.")
        shutdown_process(0)
    except Exception as ex:
        if "--debug" in sys.argv:
            print(traceback.format_exc())
        print(f"fixcore stopped. Reason {class_fqn(ex)}: {ex}", file=sys.stderr)
        shutdown_process(1)


def run(arguments: List[str]) -> None:
    """
    Run application. When this method returns, the process is done.
    :param arguments: the arguments provided to this process.
                 Note: this method is used in tests to specify arbitrary arguments.
    """
    args = parse_args(arguments)
    setup_process(args)

    # after setup, logging is possible
    info = system_info()
    log.info(
        f"Starting up version={info.version} on system with cpus={info.cpus}, "
        f"available_mem={info.mem_available}, total_mem={info.mem_total}"
    )

    # The loop is here to restart the process in case of RestartService exceptions.
    while True:
        try:
            run_process(args)
            break  # This line should never be reached. In case it does, break the loop.
        except RestartService as ex:
            message = f"Restarting Service. Reason: {ex.reason}"
            line = "-" * len(message)
            print(f"\n{line}\n{message}\n{line}\n")


def run_process(args: Namespace) -> None:
    with TemporaryDirectory() as temp_name:
        temp = Path(temp_name)
        if args.multi_tenant_setup:
            deps = Dependencies(system_info=system_info())
            deps.add(ServiceNames.temp_dir, temp)
            config = deps.add(ServiceNames.config, parse_config(args, {}, lambda: None))
            # jwt_signing_keys are not required for multi-tenant setup.
            deps.add(ServiceNames.jwt_signing_key_holder, EphemeralJwtSigningKey())
            cert_handler_no_ca = deps.add(ServiceNames.cert_handler, CertificateHandlerNoCA.lookup(config, temp))
            verify: Union[bool, str] = False if args.graphdb_no_ssl_verify else str(cert_handler_no_ca.ca_bundle)
            deps.add(ServiceNames.config, evolve(config, run=RunConfig(temp, verify)))
            # surrogate system data for multi-tenant setup: the real one is available per tenant
            deps.add(ServiceNames.system_data, SystemData("multi-tenant", utc(), CurrentDatabaseVersion))
            deps.add(ServiceNames.event_sender, NoEventSender())
            provider: TenantDependencyProvider = deps.add(
                ServiceNames.tenant_dependency_provider, FromRequestTenantDependencyProvider(deps)
            )
            created = False
        else:
            with warnings.catch_warnings():  # ignore ssl errors during setup
                deps = TenantDependencies(system_info=system_info())
                deps.add(ServiceNames.temp_dir, temp)
                warnings.simplefilter("ignore", HTTPWarning)
                # wait here for an initial connection to the database before we continue. blocking!
                created, system_data, sdb = DbAccess.connect(args, timedelta(seconds=120), verify=False)
                deps.add(ServiceNames.system_data, system_data)
                # only to be used for CoreConfig creation
                core_config_override_service = asyncio.run(override_config_for_startup(args.config_override_path))
                config = config_from_db(args, sdb, lambda: core_config_override_service.get_override(FixCoreConfigId))
                cert_handler = deps.add(ServiceNames.cert_handler, CertificateHandlerWithCA.lookup(config, sdb, temp))
                verify = False if args.graphdb_no_ssl_verify else str(cert_handler.ca_bundle)
                deps.add(ServiceNames.config, evolve(config, run=RunConfig(temp, verify)))
                # in case of tls: connect again with the correct certificate settings
                use_tls = args.graphdb_server.startswith("https://")
                sdb = DbAccess.connect(args, timedelta(seconds=30), verify=verify)[2] if use_tls else sdb
                deps.add(ServiceNames.system_database, sdb)
                event_sender = deps.add(
                    ServiceNames.event_sender,
                    PostHogEventSender(deps.system_data) if config.runtime.usage_metrics else NoEventSender(),
                )
                dba = deps.add(ServiceNames.db_access, db_access(config, sdb, event_sender))
                deps.add(ServiceNames.jwt_signing_key_holder, dba.system_data_db)
                provider = deps.add(ServiceNames.tenant_dependency_provider, DirectTenantDependencyProvider(deps))

        with_config(config, deps, provider, created)


async def direct_tenant(deps: TenantDependencies) -> None:
    config = deps.config
    event_sender = deps.event_sender
    db = deps.service(ServiceNames.db_access, DbAccess)
    # migrate the database to latest schema
    db_change = await db.migrate()
    deps.add(ServiceNames.system_data, db_change.current)
    message_bus = deps.add(ServiceNames.message_bus, MessageBus())
    scheduler = deps.add(ServiceNames.scheduler, APScheduler() if not config.args.no_scheduling else NoScheduler())
    model_handler_class = ModelHandlerFromCodeAndDB if config.args.model_from_plugins else ModelHandlerDB
    model = deps.add(ServiceNames.model_handler, model_handler_class(db, config.runtime.plantuml_server))
    worker_task_queue = deps.add(ServiceNames.worker_task_queue, WorkerTaskQueue())
    # a "real" config override deps.add, unlike the one used for core config
    config_override_service = deps.add(
        ServiceNames.config_override,
        ConfigOverrideService(config.args.config_override_path, partial(model_from_db, db.configs_model_db)),
    )
    config_handler = deps.add(
        ServiceNames.config_handler,
        ConfigHandlerService(
            db.config_entity_db,
            db.config_validation_entity_db,
            db.configs_model_db,
            worker_task_queue,
            message_bus,
            event_sender,
            config,
            config_override_service,
        ),
    )
    deps.add(ServiceNames.user_management, UserManagementService(db, config_handler, event_sender))
    default_env = {"graph": config.cli.default_graph, "section": config.cli.default_section}
    cli = deps.add(ServiceNames.cli, CLIService(deps, all_commands(deps), default_env, alias_names()))
    deps.add(ServiceNames.template_expander, TemplateExpanderService(db.template_entity_db, cli))
    inspector = deps.add(ServiceNames.inspector, InspectorService(cli))
    subscriptions = deps.add(ServiceNames.subscription_handler, SubscriptionHandlerService(message_bus))
    core_config_handler = deps.add(
        ServiceNames.core_config_handler,
        CoreConfigHandler(
            config, m
```

### Core Architecture Module: `fixcore/fixcore/action_handlers/merge_deferred_edge_handler.py`
```
import asyncio
import logging
from asyncio import Task, Future
from collections import defaultdict
from contextlib import suppress
from datetime import timedelta
from typing import Optional, Tuple, List, Dict

from attr import frozen

from fixcore.db.db_access import DbAccess
from fixcore.db.model import QueryModel
from fixcore.ids import NodeId, SubscriberId
from fixcore.ids import TaskId
from fixcore.message_bus import MessageBus, Action
from fixcore.model.graph_access import ByNodeId, NodeSelector, DeferredEdge
from fixcore.model.model_handler import ModelHandler
from fixcore.query.query_parser import parse_query
from fixcore.service import Service
from fixcore.task.model import Subscriber
from fixcore.task.subscribers import SubscriptionHandler
from fixcore.task.task_handler import TaskHandlerService
from fixcore.types import EdgeType

log = logging.getLogger(__name__)

subscriber_id = SubscriberId("fixcore")
merge_deferred_edges = "merge_deferred_edges"


@frozen
class DeferredMergeResult:
    processed: int
    updated: int
    deleted: int


class MergeDeferredEdgesHandler(Service):
    def __init__(
        self,
        message_bus: MessageBus,
        subscription_handler: SubscriptionHandler,
        task_handler_service: TaskHandlerService,
        db_access: DbAccess,
        model_handler: ModelHandler,
    ):
        super().__init__()
        self.message_bus = message_bus
        self.merge_deferred_edges_listener: Optional[Task[None]] = None
        self.subscription_handler = subscription_handler
        self.subscriber: Optional[Subscriber] = None
        self.task_handler_service = task_handler_service
        self.db_access = db_access
        self.model_handler = model_handler

    async def merge_deferred_edges(self, task_ids: List[TaskId]) -> DeferredMergeResult:
        deferred_outer_edge_db = self.db_access.deferred_outer_edge_db
        pending_edges = []
        for task_id in task_ids:
            pending_edges.extend(await deferred_outer_edge_db.all_for_task(task_id))
        if pending_edges:
            processed = 0
            first = min(pending_edges, key=lambda x: x.created_at)
            graph_db = self.db_access.get_graph_db(first.graph)
            model = await self.model_handler.load_model(first.graph)

            async def find_node_id(selector: NodeSelector) -> Optional[NodeId]:
                try:
                    if isinstance(selector, ByNodeId):
                        node = await graph_db.get_node(model, selector.value)
                        return node.get("id") if node else None
                    else:
                        query = parse_query(selector.query).with_limit(2)
                        async with await graph_db.search_list(QueryModel(query, model), consistent=True) as cursor:
                            results = [node async for node in cursor]
                            if len(results) > 1:
                                log.warning(
                                    f"task_id: {task_id}: node selector {selector.query} returned more than one node."
                                    "The edge was not created."
                                )
                                return None

                        return next(iter(results), {}).get("id", None)  # type: ignore
                except Exception as e:
                    log.warning(f"task_id: {task_id}: Error {e} when finding node {selector}")
                    return None

            edges: Dict[EdgeType, List[Tuple[NodeId, NodeId, DeferredEdge]]] = defaultdict(list)
            for pending_edge in pending_edges:
                for edge in pending_edge.edges:
                    from_id = await find_node_id(edge.from_node)
                    to_id = await find_node_id(edge.to_node)
                    processed += 1
                    if from_id and to_id:
                        edges[edge.edge_type].append((from_id, to_id, edge))

            # apply edges in graph
            updated, deleted = await graph_db.update_deferred_edges(edges, first.created_at)
            # delete processed edge definitions
            for task_id in task_ids:
                await deferred_outer_edge_db.delete_for_task(task_id)
            log.info(f"DeferredEdges: {processed} edges: {updated} updated, {deleted} deleted. ({task_ids})")
            return DeferredMergeResult(processed, updated, deleted)
        else:
            log.info(f"MergeOuterEdgesHandler: no pending edges found. ({task_ids})")
            return DeferredMergeResult(0, 0, 0)

    async def __handle_events(self, subscription_done: Future[None]) -> None:
        async with self.message_bus.subscribe(subscriber_id, [merge_deferred_edges]) as events:
            subscription_done.set_result(None)
            while True:
                event = await events.get()
                if isinstance(event, Action) and event.message_type == merge_deferred_edges:
                    await self.merge_deferred_edges([event.task_id])
                    await self.task_handler_service.handle_action_done(event.done(subscriber_id))

    async def start(self) -> None:
        subscription_done = asyncio.get_event_loop().create_future()
        self.subscriber = await self.subscription_handler.add_subscription(
            subscriber_id, merge_deferred_edges, True, timedelta(seconds=30)
        )
        self.merge_deferred_edges_listener = asyncio.create_task(
            self.__handle_events(subscription_done), name=subscriber_id
        )
        await subscription_done

    async def stop(self) -> None:
        if self.merge_deferred_edges_listener:
            with suppress(Exception):
                self.merge_deferred_edges_listener.cancel()
        if self.subscriber:
            await self.subscription_handler.remove_subscription(subscriber_id, merge_deferred_edges)

```

### Core Architecture Module: `fixcore/fixcore/analytics/__init__.py`
```
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from attrs import define
from datetime import datetime
from typing import Optional, Mapping, List, Union

from fixcore.service import Service
from fixcore.types import JsonElement
from fixcore.util import utc

log = logging.getLogger(__name__)


class CoreEvent:
    SystemInstalled = "system.installed"
    SystemConfigurationChanged = "system.configuration-changed"
    SystemConfigurationDeleted = "system.configuration-deleted"
    SystemStarted = "system.started"
    SystemStopped = "system.stopped"
    NodeCreated = "graphdb.node-created"
    NodeUpdated = "graphdb.node-updated"
    NodesDesiredUpdated = "graphdb.nodes-desired-updated"
    NodesMetadataUpdated = "graphdb.nodes-metadata-updated"
    NodeDeleted = "graphdb.node-deleted"
    DeferredEdgesUpdated = "graphdb.deferred-edges-updated"
    GraphMerged = "graphdb.graph-merged"
    GraphCopied = "graphdb.graph-copied"
    BatchUpdateGraphMerged = "graphdb.batch-update-graph-merged"
    BatchUpdateCommitted = "graphdb.batch-update-committed"
    BatchUpdateAborted = "graphdb.batch-update-aborted"
    GraphDBWiped = "graphdb.wiped"
    CLICommand = "cli.command"
    HistoryQuery = "graphdb.query.history"
    ModelInfo = "model.info"
    SubscriberInfo = "subscriber.info"
    WorkerQueueInfo = "worker-queue.info"
    TaskStarted = "task-handler.task-started"
    TaskCompleted = "task-handler.task-completed"
    ClientError = "error.client"
    ServerError = "error.server"
    ActionError = "error.action"
    UsageMetricsTurnedOff = "usage-metrics.turned-off"
    BenchmarkPerformed = "report.benchmark"
    FirstUserCreated = "user.created.first"
    UserCreated = "user.created"


@define(frozen=True)
class AnalyticsEvent:
    system: str  # e.g. creator of the event: fixcore, fixui, fixsh, etc.
    kind: str  # kind of the event. Every kind has a specific set of data and context vars
    context: Mapping[str, JsonElement]  # context properties
    counters: Mapping[str, Union[int, float]]  # all counters of this event
    at: datetime  # time, when this event has been created


class AnalyticsEventSender(Service, ABC):
    async def core_event(
        self, kind: str, context: Optional[Mapping[str, JsonElement]] = None, **counters: Union[int, float]
    ) -> AnalyticsEvent:
        event = AnalyticsEvent("fixcore", kind, context if context else {}, counters, utc())
        await self.capture([event])
        return event

    @abstractmethod
    async def capture(self, event: List[AnalyticsEvent]) -> None:
        pass

    async def start(self) -> AnalyticsEventSender:
        return self

    async def stop(self) -> None:
        return None


class NoEventSender(AnalyticsEventSender):
    """
    Use this sender to not emit any events other than writing it to the log file.
    """

    async def capture(self, event: Union[AnalyticsEvent, List[AnalyticsEvent]]) -> None:
        log.debug(event)

    async def start(self) -> AnalyticsEventSender:
        log.info("Analytics has been turned off. No insights can be created.")
        return self


class InMemoryEventSender(AnalyticsEventSender):
    """
    This sender is used to collect events happening in other processes as well as for testing purposes.
    """

    def __init__(self) -> None:
        super().__init__()
        self.events: List[AnalyticsEvent] = []

    async def capture(self, event: List[AnalyticsEvent]) -> None:
        self.events.extend(event)

```

### Core Architecture Module: `fixcore/fixcore/analytics/posthog.py`
```
from __future__ import annotations

import asyncio
import json
import logging
from collections import deque
from datetime import timedelta, datetime
from typing import MutableSequence, Optional, List, Set

from aiohttp import ClientSession
from posthog.client import Client

from fixcore.analytics import AnalyticsEventSender, AnalyticsEvent
from fixcore.db import SystemData
from fixcore.util import uuid_str, Periodic, utc

log = logging.getLogger(__name__)


class PostHogEventSender(AnalyticsEventSender):
    """
    This analytics event sender uses PostHog (https://posthog.com) to capture all analytics events.
    """

    def __init__(
        self,
        system_data: SystemData,
        flush_at: int = 10000,
        interval: timedelta = timedelta(minutes=1),
        host: Optional[str] = None,  # was: "https://analytics.some.engineering",
        client_flush_interval: float = 0.5,
        client_retries: int = 3,
    ):
        """
        Create a new PostHog sender.
        :param system_data: information about the current executing system.
        :param flush_at: number of events that can queue up, before the queue is flushed directly.
        :param interval: the frequency when the queue should be flushed.
        :param host: Only here for testing purposes.
        :param client_flush_interval: only here for testing purposes.
        :param client_retries: only here for testing purposes.
        """
        super().__init__()
        # Note: the client also has the ability to queue events with a flush interval.
        # Sadly: in order to shutdown one has to wait the full interval in worst case!
        # In order to circumvent this behaviour, the queue is maintained here with a configurable interval.
        # In case of shutdown all events are flushed directly and the system is stopped.
        # Note 2: the public api-key is fetched on demand
        self.client = Client(  # type: ignore
            api_key="n/a", host=host, flush_interval=client_flush_interval, max_retries=client_retries, gzip=True
        )
        self.run_id = uuid_str()  # create a unique id for this instance run
        self.system_data = system_data
        self.queue: MutableSequence[AnalyticsEvent] = deque()
        self.flush_at = flush_at
        self.flusher = Periodic("flush_analytics", self.flush, interval)
        self.lock = asyncio.Lock()
        self.last_fetched: Optional[datetime] = None
        self.session: Optional[ClientSession] = None
        self.white_listed_events: Set[str] = set()

    async def capture(self, event: List[AnalyticsEvent]) -> None:
        """
        Capture a single event by adding it to an internal queue.
        The queue is flushed by a scheduled function.
        Only in the rare case when the queue size reached its maximum the queue will be flushed directly.
        """
        async with self.lock:
            for e in event:
                if e.kind not in self.white_listed_events:
                    log.debug(f"Event {e.kind} is not whitelisted and will be ignored.")
                    continue
                self.queue.append(e)

        if len(self.queue) >= self.flush_at:
            await self.flush()

    async def refresh_from_cdn(self) -> None:
        """
        The API key is public but not static, so we need to refresh it periodically.
        """
        try:
            if not self.session:
                self.session = ClientSession()
            async with self.session.get("https://cdn.some.engineering/posthog/posthog.json") as resp:
                ph = json.loads(await resp.text())
                # update the api key
                api_key = ph["api_key"]
                self.client.api_key = api_key
                for consumer in self.client.consumers:
                    consumer.api_key = api_key
                # update the events to report
                self.white_listed_events = set(ph["events"])
                # update the last fetched time
                self.last_fetched = utc()
                log.debug("Fetched latest posthog data from CDN.")
        except Exception as ex:
            log.debug(f"Could not fetch latest api key. Will use the current one. {ex}")

    async def flush(self) -> None:
        """
        Flush all events to the posthog server.
        """
        # check, if we need to fetch or refresh the public api key
        if not self.last_fetched:
            await self.refresh_from_cdn()
            sd = self.system_data
            self.client.identify(sd.system_id, {"run_id": self.run_id, "created_at": sd.created_at})  # type: ignore
        elif (utc() - self.last_fetched) > timedelta(hours=1):
            await self.refresh_from_cdn()

        # acquire the lock, send all events to the client and clear the queue
        async with self.lock:
            for event in self.queue:
                self.client.capture(  # type: ignore
                    distinct_id=self.system_data.system_id,
                    event=event.kind,
                    properties={
                        **event.context,
                        **event.counters,
                        "source": event.system,
                        "run_id": self.run_id,
                    },
                    timestamp=event.at,
                )
            self.queue.clear()

    async def start(self) -> PostHogEventSender:
        await self.flush()  # flush will make sure to load initial data from CDN
        await self.flusher.start()
        return self

    async def stop(self) -> None:
        await self.flusher.stop()
        await self.flush()
        if self.session:
            await self.session.close()
        self.client.shutdown()  # type: ignore
        logging.info("AnalyticsEventSender closed.")

```

### Core Architecture Module: `fixcore/fixcore/analytics/recurrent_events.py`
```
from datetime import timedelta

from fixcore import version
from fixcore.analytics import AnalyticsEventSender, CoreEvent
from fixcore.message_bus import MessageBus
from fixcore.model.model_handler import ModelHandler
from fixcore.task.subscribers import SubscriptionHandler
from fixcore.util import Periodic
from fixcore.worker_task_queue import WorkerTaskQueue
from fixcore.ids import GraphName


def emit_recurrent_events(
    event_sender: AnalyticsEventSender,
    model_handler: ModelHandler,
    subscription_handler: SubscriptionHandler,
    worker_task_queue: WorkerTaskQueue,
    message_bus: MessageBus,
    frequency: timedelta,
    first_run: timedelta,
) -> Periodic:
    async def emit_events() -> None:
        # information about the model
        default_graph = GraphName("fix")
        model = await model_handler.load_model(default_graph)
        await event_sender.core_event(
            CoreEvent.ModelInfo,
            dict(version=version()),
            model_count=len(model.kinds),
        )
        # information about all subscribers/actors
        subscribers = await subscription_handler.all_subscribers()
        await event_sender.core_event(
            CoreEvent.SubscriberInfo,
            subscriber_count=sum(1 for _ in subscribers),
            # do not count wildcard listeners
            active=sum(1 for channels in message_bus.active_listener.values() if channels != ["*"]),
        )
        # information about all workers
        await event_sender.core_event(
            CoreEvent.WorkerQueueInfo,
            worker_count=len(worker_task_queue.work_count),
            worker_tasks_count=len(worker_task_queue.worker_by_task_name),
            outstanding_tasks=len(worker_task_queue.outstanding_tasks),
            unassigned_tasks=len(worker_task_queue.unassigned_tasks),
        )

    return Periodic("emit_recurrent_events", emit_events, frequency, first_run)

```

### Core Architecture Module: `fixcore/fixcore/async_extensions.py`
```
import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Any, Callable, Optional, cast, TypeVar

# Global bounded thread pool to bridge sync io with asyncio.
GlobalAsyncPool: Optional[ThreadPoolExecutor] = None

T = TypeVar("T")


async def run_async(sync_func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    global GlobalAsyncPool  # pylint: disable=global-statement
    if GlobalAsyncPool is None:
        # The maximum number of threads is defined explicitly here, since the default is very limited.
        GlobalAsyncPool = ThreadPoolExecutor(1024, "async")  # pylint: disable=consider-using-with
    # run in executor does not allow passing kwargs. apply them partially here if defined
    fn_with_args = cast(Callable[..., Any], sync_func if not kwargs else partial(sync_func, **kwargs))
    return await asyncio.get_event_loop().run_in_executor(GlobalAsyncPool, fn_with_args, *args)

```

### Core Architecture Module: `fixcore/fixcore/cli/__init__.py`
```
import re
from argparse import ArgumentParser
from datetime import datetime
from functools import lru_cache
from typing import (
    TypeVar,
    Union,
    Any,
    Callable,
    NoReturn,
    Optional,
    Awaitable,
    Tuple,
    List,
    AsyncIterable,
)

from parsy import Parser, regex, string

from fixcore.model.graph_access import Section
from fixcore.types import JsonElement, Json
from fixcore.util import utc, parse_utc, AnyT
from fixlib.asynchronous.stream import Stream
from fixlib.durations import parse_duration, DurationRe
from fixlib.parse_util import (
    make_parser,
    literal_dp,
    equals_dp,
    json_value_dp,
    space_dp,
    double_quote_dp,
    single_quote_dp,
    any_non_whitespace_string,
    comma_p,
    double_quoted_string_part_dp,
    backslash_dp,
    single_quoted_string_part_dp,
    dash_dp,
    equals_p,
    whitespace,
)

T = TypeVar("T")
JsStream = Stream[JsonElement]
JsGen = AsyncIterable[JsonElement]
# A sink function takes a stream and creates a result
Sink = Callable[[JsStream], Awaitable[T]]

list_sink: Callable[[JsGen], Awaitable[List[Any]]] = Stream.as_list


@make_parser
def key_value_parser() -> Parser:
    key = yield literal_dp
    yield equals_dp
    value = yield json_value_dp
    return key, value


@make_parser
def arg_with_value_parser() -> Parser:
    # parses --foo bla as (foo, bla) and --foo=bla as (foo, bla)
    # translates - to _ in the key --foo-test bla -> (foo_test, bla)
    yield dash_dp
    yield dash_dp
    key = yield literal_dp
    yield equals_p | space_dp.at_least(1)
    value = yield json_value_dp
    return key.replace("-", "_"), value


# for the cli part: unicode and special characters are translated. escaped \\ \' \" are preserved
string_esc_dp = backslash_dp >> (
    backslash_dp.result(r"\\")
    | string("'").result(r"\'")
    | string('"').result(r"\"")
    | string("b").result("\b")
    | string("f").result("\f")
    | string("n").result("\n")
    | string("r").result("\r")
    | string("t").result("\t")
    | regex(r"u[0-9a-fA-F]{4}").map(lambda s: chr(int(s[1:], 16)))
)


double_quoted_string_part_or_esc_dp = (double_quoted_string_part_dp | string_esc_dp | backslash_dp).many().concat()
single_quoted_string_part_or_esc_dp = (single_quoted_string_part_dp | string_esc_dp | backslash_dp).many().concat()


# name=value test=true -> {name: value, test: true}
key_values_parser: Parser = key_value_parser.sep_by(comma_p | space_dp).map(dict)
args_values_parser: Parser = arg_with_value_parser.sep_by(space_dp).map(dict)
# anything that is not: | " ' ; \
cmd_token = regex("[^|\"';\\\\]+")
# single and double-quoted string are maintained with quotes: "foo"->"foo", 'foo'->'foo'
# all characters inside the quoted string are not parsed
double_quoted_string = double_quote_dp + double_quoted_string_part_or_esc_dp + double_quote_dp
single_quoted_string = single_quote_dp + single_quoted_string_part_or_esc_dp + single_quote_dp
# same as above, but the surrounding quotes are not preserved: "foo"->foo, 'foo'->foo
double_quoted_raw_string = double_quote_dp >> double_quoted_string_part_or_esc_dp << double_quote_dp
single_quoted_raw_string = single_quote_dp >> single_quoted_string_part_or_esc_dp << single_quote_dp
# parse \| \" \' \; and unescape it \| -> |
escaped_token = regex("\\\\[|\"';]").map(lambda x: x[1])
# a command are tokens until EOF or pipe (all characters will be preserved)
cmd_with_args_parser = (escaped_token | double_quoted_string | single_quoted_string | cmd_token).at_least(1).concat()

# argument parser which will read the argument list while removing single and double quotes
# command line arguments: foo "bla: 'foo = bla' -> [foo, bla, foo = bla]
args_parts_unquoted_parser = (
    escaped_token | double_quoted_raw_string | single_quoted_raw_string | any_non_whitespace_string
).sep_by(whitespace, min=1)

# argument parser which will read the argument list while removing single quotes
# Example: "--a \"a or b\" --b 'b or c' --c c d" -> ["--a", "\"a or b\"", "--b", "b or c", "--c", "c", "d"]
args_parts_parser = (
    escaped_token | double_quoted_string | single_quoted_raw_string | any_non_whitespace_string
).sep_by(whitespace, min=1)


def strip_quotes(maybe_quoted: str) -> str:
    res = maybe_quoted.strip()
    if res:
        first = res[0]
        if first in "'\"":
            res = res[1 : len(res) - 1] if res.startswith(first) and res.endswith(first) else res  # noqa: E203
    return res


# check if a is a json node element
def get_node(a: Any) -> Optional[Json]:
    return a if isinstance(a, dict) and "id" in a and Section.reported in a else None


def is_node(a: Any) -> bool:
    return "id" in a and Section.reported in a if isinstance(a, dict) else False


# check if given object is a json edge element
def is_edge(a: Any) -> bool:
    return "from" in a and "to" in a if isinstance(a, dict) else False


class NoExitArgumentParser(ArgumentParser):
    def error(self, message: str) -> NoReturn:
        raise AttributeError(f"Could not parse arguments: {message}")

    def exit(self, status: int = 0, message: Optional[str] = None) -> NoReturn:
        msg = message if message else "unknown"
        raise AttributeError(f"Could not parse arguments: {msg}")


path_array_index_parser = re.compile(r"([^[]+)\[([^]]*)]")


@lru_cache(maxsize=8192)
def parse_path_index(path: str) -> Tuple[str, Union[bool, int, None]]:
    mm = path_array_index_parser.match(path)
    if mm:
        if mm.group(2) in ("*", ""):
            return mm.group(1), True
        elif mm.group(2).isdigit():
            return mm.group(1), int(mm.group(2))
        else:
            raise ValueError(f"Invalid path index: {path}")
    else:
        return path, None


# Is able to read iso timestamps: 2020-01-01T00:00:00.000Z, as well as durations like 1d, 3h, 5m, 10s
def parse_time_or_delta(time_or_delta: str) -> datetime:
    return utc() - parse_duration(time_or_delta) if DurationRe.fullmatch(time_or_delta) else parse_utc(time_or_delta)


def js_value_get(element: JsonElement, path_or_name: Union[List[str], str], if_none: AnyT) -> AnyT:
    result = js_value_at(element, path_or_name)
    return result if result and isinstance(result, type(if_none)) else if_none


def js_value_at(element: JsonElement, path_or_name: Union[List[str], str]) -> Optional[Any]:
    path = path_or_name if isinstance(path_or_name, list) else path_or_name.split(".")
    at = len(path)

    def at_idx(current: JsonElement, idx: int) -> Optional[Any]:
        if at == idx:
            return current
        prop, index = parse_path_index(path[idx])
        if current is None or not isinstance(current, dict) or prop not in current:
            return None
        else:
            child = current[prop]
            if isinstance(child, list):
                if index is None or index is True:
                    return [at_idx(e, idx + 1) for e in child]
                elif index < len(child):
                    return at_idx(child[index], idx + 1)
                else:
                    return None
            else:
                return at_idx(child, idx + 1)

    return at_idx(element, 0)

```

### Core Architecture Module: `fixcore/fixcore/cli/cli.py`
```
from __future__ import annotations

import asyncio
import logging
from asyncio import Task
from contextlib import suppress
from itertools import takewhile
from operator import attrgetter
from textwrap import dedent
from typing import Dict, List, Tuple, Union, Sequence
from typing import Optional, Any, TYPE_CHECKING

from attrs import evolve
from parsy import Parser
from rich.padding import Padding

from fixcore import version
from fixcore.analytics import CoreEvent
from fixcore.cli import cmd_with_args_parser, key_values_parser, T, Sink, args_values_parser, JsStream
from fixcore.cli.command import (
    SearchPart,
    PredecessorsPart,
    SuccessorsPart,
    AncestorsPart,
    DescendantsPart,
    AggregateCommand,
    CountCommand,
    HeadCommand,
    TailCommand,
    SearchCLIPart,
    ExecuteSearchCommand,
    JobsCommand,
    WelcomeCommand,
    SortPart,
    LimitPart,
    HistoryPart,
    ReportCommand,
    WriteCommand,
)
from fixcore.cli.model import (
    ParsedCommand,
    ParsedCommands,
    ExecutableCommand,
    ParsedCommandLine,
    CLICommand,
    InternalPart,
    CLIContext,
    CLI,
    EmptyContext,
    CLISource,
    NoTerminalOutput,
    OutputTransformer,
    PreserveOutputFormat,
    AliasTemplate,
    InfraAppAlias,
    ArgsInfo,
    ArgInfo,
    AliasTemplateParameter,
)
from fixcore.console_renderer import ConsoleRenderer
from fixcore.error import CLIParseError
from fixcore.model.typed_model import class_fqn
from fixcore.query.model import (
    Query,
    Navigation,
    AllTerm,
    Aggregate,
    AggregateVariable,
    AggregateVariableName,
    AggregateFunction,
    PathRoot,
    Limit,
    Sort,
)
from fixcore.query.query_parser import aggregate_parameter_parser, sort_args_p, limit_parser_direct
from fixcore.service import Service
from fixcore.types import JsonElement
from fixcore.user.model import Permission
from fixcore.util import group_by
from fixlib.asynchronous.stream import Stream
from fixlib.parse_util import make_parser, pipe_p, semicolon_p

if TYPE_CHECKING:
    from fixcore.dependencies import TenantDependencies

log = logging.getLogger(__name__)


@make_parser
def single_command_parser() -> Parser:
    parsed = yield cmd_with_args_parser
    cmd_args = [a.strip() for a in parsed.strip().split(" ", 1)]
    cmd, args = cmd_args if len(cmd_args) == 2 else (cmd_args[0], None)
    return ParsedCommand(cmd, args)


single_commands = single_command_parser.sep_by(pipe_p, min=1)


@make_parser
def command_line_parser() -> Parser:
    maybe_env = yield key_values_parser.optional()
    commands = yield single_commands
    return ParsedCommands(commands, maybe_env if maybe_env else {})


# semicolon separates multiple piped commands
multi_command_parser = command_line_parser.sep_by(semicolon_p)


class HelpCommand(CLICommand):
    """
    Usage: help [command]

    Parameter:
        command [optional]: if given shows the help for a specific command

    Show help text for a command or general help information.
    """

    def __init__(
        self,
        dependencies: TenantDependencies,
        parts: List[CLICommand],
        alias_names: Dict[str, str],
        alias_templates: Dict[str, AliasTemplate],
        infra_app_aliases: Dict[str, InfraAppAlias],
    ):
        super().__init__(dependencies, "misc", True)
        self.all_parts = {p.name: p for p in parts + [self]}
        self.parts = {p.name: p for p in parts + [self] if not isinstance(p, InternalPart)}
        self.alias_names = {a: n for a, n in alias_names.items() if n in self.parts and a not in self.parts}
        self.reverse_alias_names: Dict[str, List[str]] = {
            k: [e[0] for e in v] for k, v in group_by(lambda a: a[1], self.alias_names.items()).items()
        }
        self.alias_templates = alias_templates
        self.infra_app_aliases = infra_app_aliases

    @property
    def name(self) -> str:
        return "help"

    def info(self) -> str:
        return "Shows available commands, as well as help for any specific command."

    def args_info(self) -> ArgsInfo:
        return [ArgInfo(None, expects_value=True, value_hint="command")]

    def parse(self, arg: Optional[str] = None, ctx: CLIContext = EmptyContext, **kwargs: Any) -> CLISource:
        def placeholders() -> str:
            replacements = "\n".join(f"- `@{key}@` -> {value}" for key, value in CLI.replacements(**ctx.env).items())
            return ctx.render_console(f"## Valid placeholder string: \n\n{replacements}")

        def overview() -> str:
            all_parts = sorted(self.parts.values(), key=lambda p: p.name)
            parts = [p for p in all_parts if isinstance(p, CLICommand)]
            templates = list(sorted(self.alias_templates.values(), key=attrgetter("name")))
            alias_templates = "\n".join(f"- `{a.name}` - {a.info}" for a in templates)

            sorted_infra_app_aliases = list(sorted(self.infra_app_aliases.values(), key=attrgetter("name")))
            infra_app_aliases = "\n".join(f"- `{a.name}` - {a.description}" for a in sorted_infra_app_aliases)

            result = f"## Custom Commands \n{alias_templates}\n ## Infrastructure Apps \n{infra_app_aliases}\n"
            for category in ["search", "format", "action", "setup", "misc"]:
                result += f"\n\n## {category.capitalize()} Commands\n"
                for part in parts:
                    if part.category == category:
                        result += f"- `{part.name}` - {part.info()}\n"

            result += dedent(
                """

                 *Note* that you can pipe commands using the pipe character (|)
                 and chain multiple commands using the semicolon (;).

                 Use `help <command>` to show help for a specific command. \\
                 Use `help placeholders` to see the list of available placeholders.
                 """
            )
            headline = ctx.render_console(f"# fixcore CLI ({version()})")
            # ck mascot is centered (rendered if color is enabled)
            middle = (
                int((ctx.console_renderer.width - 22) / 2)
                if ctx.console_renderer is not None and ctx.console_renderer.width is not None
                else 0
            )
            logo = ctx.render_console(Padding(WelcomeCommand.ck, pad=(0, 0, 0, middle))) if ctx.supports_color() else ""
            return headline + logo + ctx.render_console(result)

        def help_command() -> JsStream:
            if not arg:
                result = overview()
            elif arg == "placeholders":
                result = placeholders()
            elif arg in self.all_parts:
                maybe_aliases = self.reverse_alias_names.get(arg)
                result = ""
                if maybe_aliases:
                    result += f'{arg} can also invoked via: {", ".join(maybe_aliases)}\n\n'
                result += self.all_parts[arg].rendered_help(ctx)
            elif arg in self.alias_names:
                alias = self.alias_names[arg]
                explain = f"{arg} is an alias for {alias}\n\n"
                result = explain + self.all_parts[alias].rendered_help(ctx)
            elif arg in self.alias_templates:
                result = self.alias_templates[arg].rendered_help(ctx)
            elif arg in self.infra_app_aliases:
                result = self.infra_app_aliases[arg].rendered_help(ctx)
            else:
                result = f"No command found with this name: {arg}"

            return Stream.just(result)

        return CLISource.single(help_command, required_permissions={Permission.read})


CLIArg = Tuple[CLICommand, Optional[str]]
# If no sort is defined in the part, we use this default sort order
# Note: changing the default sort order should be reflected in the graphdb search view (fix_view)
DefaultSort = [Sort("/reported.kind"), Sort("/reported.name"), Sort("/reported.id")]
# Default sort order for history searches
HistorySort = [Sort("/changed_at"), Sort("/reported.kind"), Sort("/reported.name"), Sort("/reported.id")]


class CLIService(CLI, Service):
    """
    The CLI has a defined set of dependencies and knows a list if commands.
    A string can be parsed into a command line that can be executed based on the list of available commands.
    """

    def __init__(
        self,
        dependencies: TenantDependencies,
        parts: List[CLICommand],
        env: Dict[str, Any],
        alias_names: Dict[str, str],
    ):
        super().__init__()
        dependencies.extend(cli=self)
        alias_templates_list = [AliasTemplate.from_config(cmd) for cmd in dependencies.config.custom_commands.commands]
        alias_templates = {a.name: a for a in alias_templates_list}
        infra_app_aliases: Dict[str, InfraAppAlias] = {}
        help_cmd = HelpCommand(
            dependencies,
            parts,
            alias_names,
            alias_templates,
            infra_app_aliases,
        )
        cmds = {p.name: p for p in parts + [help_cmd]}
        alias_cmds = {alias: cmds[name] for alias, name in alias_names.items() if name in cmds and alias not in cmds}
        self.cli_env = env
        self.alias_names = alias_names
        self.__direct_commands = cmds
        self.__alias_commands = alias_cmds
        self.__commands: Dict[str, CLICommand] = {**cmds, **alias_cmds}
        self.__dependencies = dependencies
        self.__alias_templates = alias_templates
        self.__infra_app_aliases = infra_app_aliases
        self.reaper: Optional[Task[None]] = None

    @property
    def direct_commands(self) -> Dict[str, CLICommand]:
        return self.__direct_commands

    @property
    def alias_commands(self) -> Dict[str, CLICommand]:
        return self.__alias_commands

    @property
    def commands(self) -> Dict[str, CLICommand]:
        return self.__commands

    @property
    def env(self) -> Dict[str, Any]:
        return self.cli_env

    @property
    def dependencies(self) -> TenantDependencies:
        re
```

### Core Architecture Module: `fixcore/fixcore/cli/command.py`
```
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os.path
import re
import shutil
import tarfile
from abc import abstractmethod, ABC
from argparse import Namespace
from asyncio import Future, Task

# noinspection PyProtectedMember
from asyncio.subprocess import Process
from collections import defaultdict
from collections.abc import Hashable
from contextlib import suppress
from datetime import timedelta, datetime
from functools import partial, lru_cache, cached_property
from itertools import dropwhile, chain
from pathlib import Path
from typing import (
    Dict,
    List,
    Tuple,
    Optional,
    Any,
    AsyncIterator,
    Callable,
    Awaitable,
    cast,
    Set,
    FrozenSet,
    Union,
    TYPE_CHECKING,
    Iterator,
)
from urllib.parse import urlparse, urlunparse

import aiofiles
import jq
import yaml
from aiofiles.tempfile import TemporaryDirectory
from aiohttp import ClientTimeout, JsonPayload, BasicAuth
from attr import evolve, frozen
from attrs import define, field
from dateutil import parser as date_parser
from detect_secrets.core import scan, plugins
from detect_secrets.core.potential_secret import PotentialSecret
from detect_secrets.settings import configure_settings_from_baseline, default_settings
from fixclient.models import Model as RCModel, Kind as RCKind
from fixdatalink import EngineConfig
from fixdatalink.batch_stream import BatchStream
from fixdatalink.collect_plugins import update_sql
from parsy import Parser, string, ParseError
from rich.padding import Padding
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from fixcore import version
from fixcore.async_extensions import run_async
from fixcore.cli import (
    JsGen,
    NoExitArgumentParser,
    args_parts_parser,
    args_parts_unquoted_parser,
    is_edge,
    is_node,
    get_node,
    js_value_at,
    key_values_parser,
    parse_time_or_delta,
    strip_quotes,
    key_value_parser,
    JsStream,
    js_value_get,
)
from fixcore.cli.model import (
    CLICommand,
    CLIContext,
    EmptyContext,
    CLIAction,
    CLISource,
    CLIFlow,
    InternalPart,
    OutputTransformer,
    PreserveOutputFormat,
    MediaType,
    CLIFileRequirement,
    ParsedCommand,
    NoTerminalOutput,
    ArgsInfo,
    ArgInfo,
    EntityProvider,
    FilePath,
    CLISourceContext,
)
from fixcore.cli.tip_of_the_day import SuggestionPolicy, SuggestionStrategy, get_suggestion_strategy
from fixcore.config import ConfigEntity
from fixcore.db.async_arangodb import AsyncCursor
from fixcore.db.graphdb import HistoryChange, GraphDB
from fixcore.db.model import QueryModel
from fixcore.db.runningtaskdb import RunningTaskData
from fixcore.error import CLIParseError, ClientError, CLIExecutionError, NotEnoughPermissions
from fixcore.ids import ConfigId, TaskId, InfraAppName, TaskDescriptorId, GraphName, Email, Password, NodeId
from fixcore.infra_apps.manifest import AppManifest
from fixcore.infra_apps.package_manager import Failure
from fixcore.model.graph_access import Section, EdgeTypes
from fixcore.model.model import (
    Model,
    Kind,
    ComplexKind,
    DictionaryKind,
    SimpleKind,
    Property,
    ArrayKind,
    PropertyPath,
    TransformKind,
    EmptyPath,
    any_kind,
    string_kind,
    double_kind,
)
from fixcore.model.resolve_in_graph import NodePath
from fixcore.model.typed_model import to_json, to_js, from_js
from fixcore.query.model import (
    Query,
    P,
    Template,
    NavigateUntilRoot,
    Term,
    AggregateFunction,
    AggregateVariableName,
    AggregateVariableCombined,
    Aggregate,
    AggregateVariable,
    Part,
    NavigateUntilLeaf,
    IsTerm,
)
from fixcore.query.query_parser import parse_query, aggregate_parameter_parser, predicate_term
from fixcore.query.template_expander import tpl_props_p
from fixcore.report import ReportSeverity
from fixcore.report.benchmark_renderer import respond_benchmark_result
from fixcore.report.report_config import BenchmarkConfig
from fixcore.system_start import system_info
from fixcore.task.task_description import Job, TimeTrigger, EventTrigger, ExecuteCommand, Workflow, RunningTask
from fixcore.types import Json, JsonElement, EdgeType
from fixcore.user import FixInventoryUser
from fixcore.user.model import Permission, AllowedRoleNames
from fixcore.util import (
    uuid_str,
    utc,
    if_set,
    duration,
    identity,
    rnd_str,
    set_value_in_path,
    restart_service,
    combine_optional,
    value_in_path,
)
from fixcore.web.content_renderer import (
    respond_ndjson,
    respond_json,
    respond_text,
    respond_graphml,
    respond_dot,
    respond_yaml,
    respond_cytoscape,
)
from fixcore.worker_task_queue import WorkerTask, WorkerTaskName
from fixlib.asynchronous.stream import Stream
from fixlib.core import CLIEnvelope
from fixlib.durations import parse_duration
from fixlib.parse_util import (
    double_quoted_or_simple_string_dp,
    space_dp,
    make_parser,
    variable_dp,
    literal_dp,
    comma_p,
    variable_p,
    equals_p,
    json_value_p,
)
from fixlib.utils import safe_members_in_tarfile, get_local_tzinfo
from fixlib.x509 import write_cert_to_file, write_key_to_file

if TYPE_CHECKING:
    from fixcore.dependencies import TenantDependencies

log = logging.getLogger(__name__)


# A SearchCLIPart is a command that can be used on the command line.
# Such a part is not executed, but builds a search, which is executed.
# Therefore, the parse method is implemented in a dummy fashion here.
# The real interpretation happens in CLI.create_query.
class SearchCLIPart(CLICommand, EntityProvider, ABC):
    def parse(self, arg: Optional[str] = None, ctx: CLIContext = EmptyContext, **kwargs: Any) -> CLIAction:
        return CLISource.empty()


class SearchPart(SearchCLIPart):
    """

    ```shell
    search [--with-edges] [--explain] <search-statement>
    ```

    This command allows to search the graph using filters, traversals, functions and aggregates.

    ## Options

    - `--with-edges`: Return edges in addition to nodes.
    - `--explain`: Instead of executing the search, analyze its cost.
    - `--at <time|delta>`: Perform search on the snapshot of a graph just before the given time.

    ## Parameters

    - `search-statement` [mandatory]: The search to execute.


    ### Filters

    Filters have the form `path op value`.
    - `path` is the complete path of names in the json structure combined with a dot (e.g. reported.cpu_count).

      In case the path contains elements, that are not json conform,
      they can be put into backticks (e.g. foo.bla.\\`:-)\\`.baz).
    - `operator` is one of: `<=`, `>=`, `>`, `<`, `==`, `!=`, `=~`, `!~`, `in`, `not in`.

      Note:  `=` is the same as `==` and `~` is the same as `=~`.
    - value is a json literal (e.g. `"test"`, `23`, `[1, 2, 3]`, `true`, `{"a": 12}`).

      Note: the search statement allows to omit the parentheses for strings most of the time.
      In case it contains whitespace or a special characters, you should put the string into parentheses.

    Example:
    ```shell
    > search reported.cpu_count >= 4
    > search name!="test"
    > search title in ["first", "second"]
    > search some_array[3].test.number > 6
    > search some_array[*].test.number < 4
    ```

    Filters can be combined with `and` and `or` and use parentheses.
    Example:
    ```shell
    > search (cpu_count>=4 and name!="test") or (title in ["first", "second"] and name=="test")
    ```

    ### Traversals

    Outbound traversals are traversals from a node in direction of the edge to another node, while
    inbound traversals walk the graph in opposite direction.
    Assuming 2 nodes with one connecting directed edge: `NodeA ---> NodeB`,
    traversing outbound from `NodeA` will yield `NodeB`, while traversing inbound from `NodeB` will yield `NodeA`.

    The syntax for outbound traversals is `-->` and for inbound traversals is `<--`.
    A traversal can be refined and allows to define the number of levels to walk in the graph:

    - `-[1:1]->` (shorthand for `-->`) starts from the current node and selects all nodes that can be reached by walking
      exactly one step outbound.
    - `-[0:1]->` starts (and includes) the current node and selects all nodes that can be reached by walking exactly
      one step outbound.
    - `-[<x>:<y>]->` walks from the current node to all nodes that can be reached with x steps outbound.
      From here all nodes are selected including all nodes that can be reached in y steps outbound
      relative to the starting node.
    - `-[<x>]->` shorthand `-[<x>:<x>]->`
    - `-[<x>:]->`  walks from the current node to all nodes that can be reached with x steps outbound.
      From here all nodes to the graph leafs are selected.


    The same logic is used for inbound traversals (`<--`, `<-[0:1]-`, `<-[2]-`, `<-[2:]-`).

    ### Functions

    There are predefined functions that can be used in combination with any filter.
    - is(<kind>): selects all nodes that are of type <kind> or any subtype of <kind>.
      Example: is(volume) will select all GCP disks and all AWS EC2 volumes, since both types inherit from
      base type volume.
    - id(<identifier>): selects the node with the given node identifier <identifier>.
      Example: id(foo) will select the node with id foo. The id is a synthetic id created by the collector
      and usually does not have a meaning, other than identifying a node uniquely.
    - has_key(<path>): tests if the specified name is defined in the json object.
      Example: is(volume) and has_key(tags, owner)

    ### Aggregations

    Aggregate data by using on of the following functions: `sum`, `avg`, `min`, `max` and `count`.
    Multiple aggregation functions can be applied to the result set by separating them by comma.
    Each aggregation function can be named via an optional `as <name>` clause.

    Aggregation functions can be grouped using aggrega
```

### Core Architecture Module: `fixcore/fixcore/cli/model.py`
```
from __future__ import annotations

import calendar
import inspect
import json
from abc import ABC, abstractmethod
from asyncio import iscoroutine
from datetime import timedelta
from enum import Enum
from functools import reduce
from pathlib import Path
from textwrap import dedent
from typing import (
    Optional,
    List,
    Any,
    Dict,
    Tuple,
    Callable,
    Union,
    Awaitable,
    Type,
    cast,
    Set,
    AsyncIterator,
    TYPE_CHECKING,
)

from attrs import define, field
from parsy import test_char, string
from rich.jupyter import JupyterMixin

from fixcore.cli import JsGen, T, Sink, JsStream
from fixcore.console_renderer import ConsoleRenderer, ConsoleColorSystem
from fixcore.core_config import AliasTemplateConfig, AliasTemplateParameterConfig
from fixcore.error import CLIParseError
from fixcore.ids import GraphName
from fixcore.user.model import Permission, AuthorizedUser
from fixcore.query.model import Query, variable_to_absolute, PathRoot
from fixcore.query.template_expander import render_template
from fixcore.types import Json, JsonElement
from fixcore.util import AccessJson, uuid_str, from_utc, utc, utc_str
from fixlib.asynchronous.stream import Stream
from fixlib.parse_util import l_curly_dp, r_curly_dp
from fixlib.utils import get_local_tzinfo

if TYPE_CHECKING:
    from fixcore.dependencies import TenantDependencies


class MediaType(Enum):
    Json = 1
    FilePath = 2
    Markdown = 3
    String = 4

    @property
    def text(self) -> bool:
        return self in (MediaType.Json, MediaType.String, MediaType.Markdown)

    @property
    def file_path(self) -> bool:
        return self == MediaType.FilePath

    def __repr__(self) -> str:
        return "application/json" if self == MediaType.Json else "application/octet-stream"


no_closing_p = test_char(lambda x: x != "}", "No closing bracket").at_least(1).concat()
no_bracket_p = test_char(lambda x: x not in ("{", "}"), "No opening bracket").at_least(1).concat()
double_curly_open_dp = string("{{")
double_curly_close_dp = string("}}")
l_or_r_curly_dp = string("{") | string("}")

# use this property name as reference to self when defined via .
self_name = "self_" + uuid_str()


@define(frozen=True)
class FilePath:
    user: Path
    local: Path

    def json(self) -> Json:
        return {"user_path": str(self.user), "local_path": str(self.local)}

    @staticmethod
    def from_path(in_path: JsonElement) -> FilePath:
        if isinstance(in_path, str):
            p = Path(in_path)
            return FilePath(Path(p.name), p.expanduser().absolute())
        elif isinstance(in_path, dict) and "user_path" in in_path and "local_path" in in_path:
            return FilePath(Path(in_path["user_path"]), Path(in_path["local_path"]).expanduser().absolute())
        else:
            raise ValueError(f"Invalid file path: {in_path}")

    @staticmethod
    def user_local(user: Union[str, Path], local: Union[str, Path]) -> FilePath:
        return FilePath(Path(user), Path(local).expanduser().absolute())


@define(frozen=True)
class CLIContext:
    env: Dict[str, str] = field(factory=dict)
    uploaded_files: Dict[str, str] = field(factory=dict)  # id -> path
    query: Optional[Query] = None
    query_options: Dict[str, Any] = field(factory=dict)
    commands: List[ExecutableCommand] = field(factory=list)
    console_renderer: Optional[ConsoleRenderer] = None
    source: Optional[str] = None  # who is calling
    user: Optional[AuthorizedUser] = None

    @property
    def graph_name(self) -> GraphName:
        return GraphName(self.env["graph"])

    @property
    def section(self) -> str:
        return self.env.get("section", PathRoot)

    @property
    def intern(self) -> bool:
        # currently only 2 sources: api and task_handler
        return self.source == "task_handler"

    @property
    def user_permissions(self) -> Set[Permission]:
        return self.user.permissions if self.user else set()

    def variable_in_section(self, variable: str) -> str:
        # if there is no entity provider, always assume the root section
        section = (
            self.env.get("section")
            if self.query or self.commands and isinstance(self.commands[0].command, EntityProvider)
            else PathRoot
        )
        return variable_to_absolute(section, variable)

    def render_console(self, element: Union[str, JupyterMixin]) -> str:
        if self.console_renderer:
            return self.console_renderer.render(element)
        elif isinstance(element, JupyterMixin):
            return str(element)
        else:
            return element

    def text_generator(
        self, line: ParsedCommandLine, in_stream: AsyncIterator[JsonElement]
    ) -> AsyncIterator[JsonElement]:
        async def render_markdown() -> AsyncIterator[str]:
            async for e in in_stream:
                yield self.render_console(e)  # type: ignore

        if line.produces == MediaType.Markdown:
            return render_markdown()
        else:
            return in_stream

    def supports_color(self) -> bool:
        return (
            self.console_renderer is not None
            and self.console_renderer.color_system is not None
            and self.console_renderer.color_system != ConsoleColorSystem.monochrome
        )

    def formatter(self, format_string: str) -> Callable[[Json], str]:
        return self.formatter_with_variables(format_string, False)[0]

    def formatter_with_variables(
        self, format_string: str, collect_variables: bool = True
    ) -> Tuple[Callable[[Json], str], Optional[Set[str]]]:
        """
        A renderer can be used to string format objects based on a provided format string.
        """

        variables: Optional[Set[str]] = set() if collect_variables else None

        def format_variable(name: str) -> str:
            assert "__" not in name, "No dunder attributes allowed"
            if name in (".", "/"):
                in_section = self_name
            else:
                in_section = self.variable_in_section(name)
                if collect_variables:
                    variables.add(in_section)  # type: ignore
            return "{" + in_section + "}"

        def render_simple_property(prop: Any) -> str:
            return json.dumps(prop) if prop is None or isinstance(prop, bool) else str(prop)

        variable = (l_curly_dp >> no_closing_p << r_curly_dp).map(format_variable)
        token = double_curly_open_dp | double_curly_close_dp | no_bracket_p | variable | l_or_r_curly_dp
        format_string_parser = token.many().concat()
        formatter: str = format_string_parser.parse(format_string)

        def format_object(obj: Any) -> str:
            return formatter.format_map(AccessJson.wrap(obj, "null", render_simple_property, self_name))

        return format_object, variables


EmptyContext = CLIContext()


class CLIEngine(ABC):
    @abstractmethod
    async def evaluate_cli_command(
        self, cli_input: str, context: CLIContext = EmptyContext, replace_place_holder: bool = True
    ) -> List[ParsedCommandLine]:
        pass


@define
class CLICommandRequirement:
    name: str


@define
class CLIFileRequirement(CLICommandRequirement):
    path: str  # local client path


class CLIAction(ABC):
    def __init__(
        self,
        produces: MediaType,
        requires: Optional[List[CLICommandRequirement]],
        envelope: Optional[Dict[str, str]],
        required_permissions: Optional[Set[Permission]] = None,
    ) -> None:
        self.produces = produces
        self.required = requires or []
        self.envelope: Dict[str, str] = envelope or {}
        self.required_permissions = required_permissions or set()

    @staticmethod
    def make_stream(in_stream: JsGen) -> JsStream:
        return in_stream if isinstance(in_stream, Stream) else Stream.iterate(in_stream)


@define
class CLISourceContext:
    count: Optional[int] = None
    total_count: Optional[int] = None
    stats: Optional[Json] = None


class CLISource(CLIAction):
    def __init__(
        self,
        fn: Callable[[], Union[Tuple[CLISourceContext, JsGen], Awaitable[Tuple[CLISourceContext, JsGen]]]],
        produces: MediaType = MediaType.Json,
        requires: Optional[List[CLICommandRequirement]] = None,
        envelope: Optional[Dict[str, str]] = None,
        required_permissions: Optional[Set[Permission]] = None,
    ) -> None:
        super().__init__(produces, requires, envelope, required_permissions)
        self._fn = fn

    async def source(self) -> Tuple[CLISourceContext, JsStream]:
        res = self._fn()
        context, gen = await res if iscoroutine(res) else res  # type: ignore
        return context, self.make_stream(await gen if iscoroutine(gen) else gen)

    @staticmethod
    def only_count(
        fn: Callable[[], Union[Tuple[int, JsGen], Awaitable[Tuple[int, JsGen]]]],
        produces: MediaType = MediaType.Json,
        requires: Optional[List[CLICommandRequirement]] = None,
        envelope: Optional[Dict[str, str]] = None,
        required_permissions: Optional[Set[Permission]] = None,
    ) -> CLISource:
        async def combine() -> Tuple[CLISourceContext, JsGen]:
            res = fn()
            count, gen = await res if iscoroutine(res) else res  # type: ignore
            return CLISourceContext(count=count, total_count=count), gen

        return CLISource(combine, produces, requires, envelope, required_permissions)

    @staticmethod
    def no_count(
        fn: Callable[[], Union[JsGen, Awaitable[JsGen]]],
        produces: MediaType = MediaType.Json,
        requires: Optional[List[CLICommandRequirement]] = None,
        envelope: Optional[Dict[str, str]] = None,
        required_permissions: Optional[Set[Permission]] = None,
    ) -> CLISource:
        return CLISource.with_count(fn, None, produces, requires, envelope, required_permissions)

    @staticmethod
    def with_count(
        fn: Callable[[], Union[JsGen, Awaitable[JsGen]]],
  
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2318** (2025-03-10): **Link to Discord is broken**
  *Symptoms*: ### Description  In Github, and on the website, the invite link to Discord is broken  ### Version  all  ### Environment  all  ### Steps to Reproduce  Follow the link to Discord under community  ### Logs  ```shell  ```  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for letting us know. Links are fixed now.

- **Issue #2285** (2024-12-03): **Quick Start from repo doesn't work**
  *Symptoms*: ### Description  [Quick Start](Quick Start from repo doesn't work) from repo doesn't work  ### Version  current  ### Environment  _No response_  ### Steps to Reproduce  Go to github repo and tyhe "Check out our [Quick Start Guide](https://inventory.fix.security/docs/getting-started/) for step-by-step instructions on getting started."  ### Logs  _No response_  ### Additional Context  _No response_

- **Issue #2274** (2025-02-15): **Could not perform action collect in AWS due to SCP restrictions over region use.**
  *Symptoms*: ### Description  When performing the account onboarding through the site "app.fix.security", the following error occurs:  "Error: could not perform action collect. Reason: Unhandled exception in AWS Plugin: An error occurred (UnauthorizedOperation) when calling the DescribeRegions operation: You are not authorized to perform this operation. User: arn:aws:iam::639605712835:user/fixbackend is not authorized to perform: ec2:DescribeRegions because no identity-based policy allows the ec2:DescribeRegions action".  In this case, this is an individual account that is part of an organization which has multiple region usage blocked via SCP.  ![image](https://github.com/user-attachments/assets/8c3dbd17-b398-484d-94eb-d03b60bf4686)   ### Version  SaaS  ### Environment  _No response_  ### Steps to Reproduce  _No response_  ### Logs  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > The collector currently relies on listing the available regions. If this call is not allowed, the account cannot be collected. Maybe we could allow defining the regions to collect manually. What is the reason to block this call?
  > Closing for inactivity.

- **Issue #1922** (2024-02-16): **S3 check for secure transport does not work**
  *Symptoms*: ### Description  Check `bucket_secure_transport_policy`   ``` is(aws_s3_bucket) and not bucket_policy.Statement[*].{Effect=Deny and (Action=s3:PutObject or Action=\"s3:*\" or Action=\"*\") and Condition.Bool.`aws:SecureTransport`== \"false\" } ``` finds all buckets, regardless of the policy contents. As we discussed in Discord this happens because `not` inverts the condition, and as long as there are any other statements in the policy it will include them.    ### Version  fix.security cloud offering  ### Environment  _No response_  ### Steps to Reproduce  _No response_  ### Logs  _No response_  ### Additional Context  _No response_

- **Issue #1590** (2023-05-24): **[digitalocean] Scheme and Hostname missing in volume collect**
  *Symptoms*: ### Description   ``` Traceback (most recent call last):   File "/usr/local/resoto-venv-python3/lib/python3.11/site-packages/resoto_plugin_digitalocean/__init__.py", line 75, in collect_team     dopc.collect()   File "/usr/local/resoto-venv-python3/lib/python3.11/site-packages/resoto_plugin_digitalocean/collector.py", line 244, in collect     collector()   File "<decorator-gen-12>", line 2, in collect_volumes   File "/usr/local/resoto-venv-python3/lib/python3.11/site-packages/prometheus_client/context_managers.py", line 83, in wrapped     return func(*args, **kwargs)            ^^^^^^^^^^^^^^^^^^^^^   File "/usr/local/resoto-venv-python3/lib/python3.11/site-packages/resoto_plugin_digitalocean/collector.py", line 558, in collect_volumes     volumes = self.client.list_volumes()               ^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/usr/local/resoto-venv-python3/lib/python3.11/site-packages/resoto_plugin_digitalocean/client.py", line 160, in list_volumes     return self._fetch("/volumes", "volumes")            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/usr/local/resoto-venv-python3/lib/python3.11/site-packages/retrying.py", line 56, in wrapped_f     return Retrying(*dargs, **dkw).call(f, *args, **kw)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/usr/local/resoto-venv-python3/lib/python3.11/site-packages/retrying.py", line 257, in call     return attempt.get(self._wrap_exception)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/usr/local
  **Post-Mortem & Fix Analysis**:
  > fixed by https://github.com/someengineering/resoto/pull/1592 

- **Issue #1379** (2023-02-14): **Setup wizard confusing question**
  *Symptoms*: ### Description  ![image](https://user-images.githubusercontent.com/43033315/214569134-3f9ff6e9-0fd9-445f-9053-62905038f210.png) This is not a YES | NO question so the correct option to select is down to guesswork  ### Version  latest  ### Environment  _No response_  ### Steps to Reproduce  Follow initial steps in this quick start documentation https://resoto.com/docs/getting-started/install-resoto/docker   ### Logs  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report, this was fixed with the following PR: https://github.com/someengineering/resoto/issues/1379

- **Issue #1378** (2023-03-06): **resotocore stuck restarting due to python exception**
  *Symptoms*: ### Description  Attempting to follow https://resoto.com/docs/getting-started/install-resoto/docker. When running, the resotocore is stuck restarting due to a FileNotFoundError.  ``` unhandled exception during asyncio.run() shutdown task: <Task finished name='Task-1' coro=<_run_app() done, defined at /usr/local/resoto-venv-python3/lib/python3.11/site-packages/aiohttp/web.py:289> exception=FileNotFoundError(2, 'No such file or directory')>", "pid": 30, "thread": "MainThread", "process": "resotocore", "exception": "Traceback (most recent call last):   File \"/usr/local/resoto-venv-python3/lib/python3.11/site-packages/resotolib/asynchronous/web/runner.py\", line 78, in run_app     loop.run_until_complete(main_task)   File \"/usr/local/python/lib/python3.11/asyncio/base_events.py\", line 650, in run_until_complete     return future.result()            ^^^^^^^^^^^^^^^   File \"/usr/local/resoto-venv-python3/lib/python3.11/site-packages/aiohttp/web.py\", line 323, in _run_app     await runner.setup()   File \"/usr/local/resoto-venv-python3/lib/python3.11/site-packages/aiohttp/web_runner.py\", line 279, in setup     self._server = await self._make_server()                    ^^^^^^^^^^^^^^^^^^^^^^^^^   File \"/usr/local/resoto-venv-python3/lib/python3.11/site-packages/aiohttp/web_runner.py\", line 375, in _make_server     await self._app.startup()   File \"/usr/local/resoto-venv-python3/lib/python3.11/site-packages/aiohttp/web_app.py\", line 417, in startup     awa
  **Post-Mortem & Fix Analysis**:
  > Fixed via #1380

- **Issue #1336** (2022-12-06): **StackSets missing edge to Stacks**
  *Symptoms*: ### Description  ``` > search is(aws_cloudformation_stack_set) kind=aws_cloudformation_stack_set, id=ResotoAccess:f8ff22d0-9d42-43fb-9f01-6ace436318bb, name=ResotoAccess, age=10min23s, cloud=aws, account=someengineering, region=us-east-1 > search is(aws_cloudformation_stack_set) | predecessors kind=aws_region, id=us-east-1, name=us-east-1, age=16yr8mo, cloud=aws, account=someengineering > search is(aws_cloudformation_stack_set) | successors ```  This stackset is deployed to three accounts. I see the stacks but there are no edges.  ### Version  3.0.0  ### Environment  _No response_  ### Steps to Reproduce  _No response_  ### Logs  _No response_  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > The issue seems to be that we are missing stack instances as a resource type. ListStackInstances for a StackSet returns each stack instance. Which in turn can be used to create deferred edges to the other accounts where those stacks have been deployed, based on the returned `StackId` which is the ARN of the cloudformation stack.

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `21183338` (2025-03-28)
**Commit Message**: [fix][fix] Update license to match Trove classifier (#2322)

**File**: `fixcore/pyproject.toml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
+    "License :: OSI Approved :: Apache Software License",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `fixlib/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
+    "License :: OSI Approved :: Apache Software License",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `fixmetrics/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
+    "License :: OSI Approved :: Apache Software License",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `fixshell/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
+    "License :: OSI Approved :: Apache Software License",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `plugins/aws/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
+    "License :: OSI Approved :: Apache Software License",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `plugins/aws/tools/awspolicygen/setup.py` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@
         "Intended Audience :: System Administrators",
         "Intended Audience :: Information Technology",
         # License information
-        "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
+        "License :: OSI Approved :: Apache Software License",
         # Supported python versions
         "Programming Language :: Python :: 3.12",
         # Supported OS's
```

**File**: `plugins/azure/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
+    "License :: OSI Approved :: Apache Software License",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `plugins/digitalocean/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
+    "License :: OSI Approved :: Apache Software License",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

---

### Incident Patch 2: `bf8fa38b` (2025-03-28)
**Commit Message**: Fix some AGPL references that were left after returning to Apache2  (#2321)

**File**: `fixcore/pyproject.toml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: GNU Affero General Public License v3 or later (Apache-2.0+)",
+    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `fixlib/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: GNU Affero General Public License v3 or later (Apache-2.0+)",
+    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `fixmetrics/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: GNU Affero General Public License v3 or later (Apache-2.0+)",
+    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `fixshell/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: GNU Affero General Public License v3 or later (Apache-2.0+)",
+    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `plugins/aws/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: GNU Affero General Public License v3 or later (Apache-2.0+)",
+    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `plugins/aws/tools/awspolicygen/setup.py` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@
         "Intended Audience :: System Administrators",
         "Intended Audience :: Information Technology",
         # License information
-        "License :: OSI Approved :: GNU Affero General Public License v3 or later (AGPLv3+)",
+        "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
         # Supported python versions
         "Programming Language :: Python :: 3.12",
         # Supported OS's
```

**File**: `plugins/azure/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: GNU Affero General Public License v3 or later (Apache-2.0+)",
+    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

**File**: `plugins/digitalocean/pyproject.toml` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ classifiers = [
     "Intended Audience :: System Administrators",
     "Intended Audience :: Information Technology",
     # License information
-    "License :: OSI Approved :: GNU Affero General Public License v3 or later (Apache-2.0+)",
+    "License :: OSI Approved :: Apache License 2.0 (Apache-2.0+)",
     # Supported python versions
     "Programming Language :: Python :: 3.12",
     # Supported OS's
```

---

### Incident Patch 3: `b3f05115` (2025-03-10)
**Commit Message**: [fix][fix] Update CDN links

**File**: `README.md` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-![Fix Shell](https://cdn.fix.security/assets/fixinventory/fixinventory-search-multiple.gif)
+![Fix Shell](https://cdn.some.engineering/assets/fixinventory/fixinventory-search-multiple.gif)
 
 [![Version](https://img.shields.io/github/v/tag/someengineering/fixinventory?label=latest)](https://github.com/someengineering/fixinventory/tags/)
 [![Build](https://img.shields.io/github/actions/workflow/status/someengineering/fixinventory/docker-build.yml)](https://github.com/someengineering/fixinventory/commits/main)
@@ -144,7 +144,7 @@ For example, suppose I want to understand which S3 buckets in my infrastructure
  > search --with-edges is(aws_iam_user) and name=matthias -iam[0:]{permissions[*].level==write}-> is(aws_iam_user, aws_s3_bucket) | format --dot
 ```
 
-![Fix Graph](https://cdn.fix.security/assets/fixinventory/fixinventory-security-graph.png)
+![Fix Graph](https://cdn.some.engineering/assets/fixinventory/fixinventory-security-graph.png)
 
 Read more about [traversing the graph](https://inventory.fix.security/concepts/asset-inventory-graph#traversal) in our docs. Fix Security, our hosted SaaS product, offers these visualizations out of the box.
 
```

---

### Incident Patch 4: `61701953` (2025-03-10)
**Commit Message**: [fix][fix] Update Discord server invitation links (#2319)

**File**: `.github/ISSUE_TEMPLATE/config.yml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 blank_issues_enabled: false
 contact_links:
   - name: 💬 Discord
-    url: https://discord.gg/fixsecurity
+    url: https://discord.gg/XvpyRQ4yj2
     about: Chat with other users and the development team
   - name: 📄 Documentation
     url: https://inventory.fix.security/docs
```

**File**: `README.md` (modified, +28/-28)
```diff
@@ -3,15 +3,15 @@
 [![Version](https://img.shields.io/github/v/tag/someengineering/fixinventory?label=latest)](https://github.com/someengineering/fixinventory/tags/)
 [![Build](https://img.shields.io/github/actions/workflow/status/someengineering/fixinventory/docker-build.yml)](https://github.com/someengineering/fixinventory/commits/main)
 [![Docs](https://img.shields.io/badge/docs-latest-<COLOR>.svg)](https://inventory.fix.security/docs)
-[![Discord](https://img.shields.io/discord/778029408132923432?label=discord)](https://discord.gg/fixsecurity)
+[![Discord](https://img.shields.io/discord/778029408132923432?label=discord)](https://discord.gg/XvpyRQ4yj2)
 [![Known Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/github/someengineering/fixinventory/requirements.txt)](https://app.snyk.io/org/some-engineering-inc./projects)
 [![CodeCoverage](https://codecov.io/gh/someengineering/fixinventory/graph/badge.svg?token=ZEZW5JAR5J)](https://codecov.io/gh/someengineering/fixinventory)
 
-Fix Inventory detects compliance and security risks in cloud infrastructure accounts. 
+Fix Inventory detects compliance and security risks in cloud infrastructure accounts.
 
 We built Fix Inventory for cloud and security engineers as an open source alternative to proprietary cloud security tools like Orca Security, Prisma Cloud or Wiz.
 
-Check out our [Quick Start Guide](https://fixinventory.org/getting-started) for step-by-step instructions on getting started. 
+Check out our [Quick Start Guide](https://fixinventory.org/getting-started) for step-by-step instructions on getting started.
 
 ## 💡Why Fix Inventory?
 
@@ -27,12 +27,12 @@ Fix Inventory was built from the ground up for cloud-native infrastructure. Fix
 
 If you want to collect data for resources that are not supported yet,  you can use our [example collector](https://github.com/someengineering/fixinventory/tree/main/plugins/example_collector) to write your own collectors.
 
-The tool works in three phases: 
+The tool works in three phases:
 
 1. **Collect inventory data**: Fix Inventory queries cloud infrastructure APIs (aka “agentless”) for metadata about the resources in your cloud accounts.
-   
+
 2. **Normalize cloud data**: Fix Inventory creates a graph schema to normalize the universe of detected cloud resources, their configurations, and relationships.
-    
+
 3. **Triage security risks**: Fix Inventory scans the collected data with custom and pre-configured compliance frameworks to search for misconfigurations, risks, and other security issues.
 
 Fix Inventory also provides ways to export and integrate the data it collects to build alerting and remediation workflows.
@@ -41,9 +41,9 @@ Fix Inventory also provides ways to export and integrate the data it collects to
 
 In cloud-native infrastructure, misconfigurations from developer activity and frequent updates through automation are a fact of life. It's impossible to catch all misconfigurations before they reach production, so the key question becomes: how quickly can you identify and fix (hence the name…) the most critical risks?
 
-Traditional cloud security tools struggle to answer basic questions such as “what’s the blast radius of this public resource?” or “is there a path to get from this resource to a privileged role?”, because they lack the context from the hidden dependencies between cloud resources. 
+Traditional cloud security tools struggle to answer basic questions such as “what’s the blast radius of this public resource?” or “is there a path to get from this resource to a privileged role?”, because they lack the context from the hidden dependencies between cloud resources.
 
-We believe that the only effective approach is to use a graph-based data model that works across all cloud platforms. 
+We believe that the only effective approach is to use a graph-based data model that works across all cloud platforms.
 
 - **Deploy anywhere:** Fix Inventory can be deployed on your laptop or in the cloud, and we also offer a SaaS version.
 
@@ -60,19 +60,19 @@ We believe that the only effective approach is to use a graph-based data model t
 Fix Inventory supports common cloud security use cases.
 
 - **Cloud Security Posture Management (CSPM)**: Monitor and enforce security policies across your cloud infrastructure, Identify and remediate misconfigurations.
-  
+
 - **AI Security Posture Management (AI-SPM)**: Automatic discovery of AI services in use, and the data sources they connect to.
-  
+
 - **Cloud Compliance**: Run automated compliance assessments across your cloud accounts with standard compliance frameworks.
-  
+
 - **Cloud Infrastructure Entitlement Management (CIEM)**: Discover human and non-human identities (NHI), detect risky service accounts with access to sensitive data.
 
 - **Cloud Asset Inventory:** Gain visibility into your multi-cloud environments by collecting, normalizing, unifying resource configuration data and prevent shadow IT
-  
+
 - **Container & Kubernetes Sec
```

**File**: `fixcore/README.md` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ More information can be found in [the docs](https://inventory.fix.security/docs/
 
 
 ## Contact
-If you have any questions feel free to [join our Discord](https://discord.gg/fixsecurity) or [open a GitHub issue](https://github.com/someengineering/fix/issues/new).
+If you have any questions feel free to [join our Discord](https://discord.gg/XvpyRQ4yj2) or [open a GitHub issue](https://github.com/someengineering/fix/issues/new).
 
 
 ## License
```

**File**: `fixlib/README.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ Fix Inventory common library
 This is the Fix Inventory common library. Any functionality that is required by more than one of [our components](https://github.com/someengineering/fixinventory#component-list) will be put in here.
 
 ## Contact
-If you have any questions feel free to [join our Discord](https://discord.gg/fixsecurity) or [open a GitHub issue](https://github.com/someengineering/fixinventory/issues/new).
+If you have any questions feel free to [join our Discord](https://discord.gg/XvpyRQ4yj2) or [open a GitHub issue](https://github.com/someengineering/fixinventory/issues/new).
 
 
 ## License
```

**File**: `fixmetrics/README.md` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@ This is the core functionality `fixmetrics` provides.
 
 
 ## Contact
-If you have any questions feel free to [join our Discord](https://discord.gg/fixsecurity) or [open a GitHub issue](https://github.com/someengineering/fix/issues/new).
+If you have any questions feel free to [join our Discord](https://discord.gg/XvpyRQ4yj2) or [open a GitHub issue](https://github.com/someengineering/fix/issues/new).
 
 
 ## License
```

**File**: `fixshell/README.md` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ search is(aws_ec2_volume) and volume_status = available and ctime < -30d and ati
 
 
 ## Contact
-If you have any questions feel free to [join our Discord](https://discord.gg/fixsecurity) or [open a GitHub issue](https://github.com/someengineering/fix/issues/new).
+If you have any questions feel free to [join our Discord](https://discord.gg/XvpyRQ4yj2) or [open a GitHub issue](https://github.com/someengineering/fix/issues/new).
 
 
 ## License
```

**File**: `fixworker/README.md` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ search id = i-039e06bb2539e5484 | tag update owner lukas
 
 
 ## Contact
-If you have any questions feel free to [join our Discord](https://discord.gg/fixsecurity) or [open a GitHub issue](https://github.com/someengineering/fix/issues/new).
+If you have any questions feel free to [join our Discord](https://discord.gg/XvpyRQ4yj2) or [open a GitHub issue](https://github.com/someengineering/fix/issues/new).
 
 
 ## License
```

---

### Incident Patch 5: `f1534658` (2025-01-27)
**Commit Message**: [fix][chore] Use latest arangodb 3.11 (#2313)

**File**: `docker-compose.yaml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 services:
   graphdb-upgrade:
-    image: arangodb:3.10.1
+    image: arangodb:3.11.12
     container_name: graphdb-upgrade
     environment:
       - ARANGO_ROOT_PASSWORD=
@@ -11,7 +11,7 @@ services:
     command:
       - --database.auto-upgrade
   graphdb:
-    image: arangodb:3.10.1
+    image: arangodb:3.11.12
     depends_on:
       graphdb-upgrade:
         condition: service_completed_successfully
```

---

### Incident Patch 6: `42ad04bf` (2025-01-27)
**Commit Message**: Bump jupyterlab from 4.0.11 to 4.2.5 in /fixcore in the pip group across 1 directory (#2310)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `fixcore/requirements-jupyterlite.txt` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-jupyterlab==4.0.11
+jupyterlab==4.2.5
 jupyterlite==0.2.2
 plotly==5.18.0
 
```

---

### Incident Patch 7: `6ee05175` (2025-01-27)
**Commit Message**: [fix][chore] Bump Libs (#2309)

**File**: `fixcore/fixcore/report/__init__.py` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@
 
 @total_ordering
 class ReportSeverity(Enum):
-    kind: ClassVar[str] = "fix_core_report_check_severity"
+    kind: ClassVar[str] = "fix_core_report_check_severity"  # type: ignore
     info = "info"
     low = "low"
     medium = "medium"
```

**File**: `fixlib/fixlib/baseresources.py` (modified, +1/-1)
```diff
@@ -1098,7 +1098,7 @@ class BaseBucket(BaseResource):
 
 @unique
 class QueueType(Enum):
-    kind: ClassVar[str] = "queue_type"
+    kind: ClassVar[str] = "queue_type"  # type: ignore
     STANDARD = "standard"
     FIFO = "fifo"
 
```

**File**: `fixworker/test/test_collect.py` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ class ExampleAccount(BaseAccount):
     kind: ClassVar[str] = "example_account"
 
     def delete(self, graph: Graph) -> bool:
-        return NotImplemented
+        return False
 
 
 class ExampleCollectorPlugin(BaseCollectorPlugin):
```

**File**: `fixworker/test/test_fixcore.py` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ class ExampleAccount(BaseAccount):
     kind: ClassVar[str] = "example_account"
 
     def delete(self, graph: Graph) -> bool:
-        return NotImplemented
+        return False
 
 
 class ExampleCollectorPlugin(BaseCollectorPlugin):
```

**File**: `requirements-all.txt` (modified, +52/-52)
```diff
@@ -4,11 +4,11 @@ aiohappyeyeballs==2.4.4
 aiohttp[speedups]==3.10.11
 aiohttp-jinja2==1.6
 aiohttp-swagger3==0.9.0
-aiosignal==1.3.1
+aiosignal==1.3.2
 apscheduler==3.11.0
 asn1crypto==1.5.1
-astroid==3.3.5
-attrs==24.2.0
+astroid==3.3.8
+attrs==25.1.0
 autocommand==2.2.2
 azure-common==1.1.28
 azure-core==1.32.0
@@ -18,35 +18,35 @@ azure-mgmt-resource==23.2.0
 backoff==2.2.1
 beautifulsoup4==4.12.3
 black==24.10.0
-boto3==1.35.76
-botocore==1.35.76
+boto3==1.36.6
+botocore==1.36.6
 brotli==1.1.0
 build==1.2.2.post1
 cached-property==2.0.1
-cachetools==5.5.0
+cachetools==5.5.1
 cattrs==24.1.2
-cerberus==1.3.5
-certifi==2024.8.30
+cerberus==1.3.7
+certifi==2024.12.14
 cffi==1.17.1
 chardet==5.2.0
-charset-normalizer==3.4.0
+charset-normalizer==3.4.1
 cheroot==10.0.1
 cherrypy==18.10.0
-click==8.1.7
+click==8.1.8
 click-option-group==0.5.6
-cloudsplaining==0.7.0
+cloudsplaining==0.8.0
 colorama==0.4.6
-coverage[toml]==7.6.8
+coverage[toml]==7.6.10
 cryptography==44.0.0
 deepdiff==8.0.1
 defusedxml==0.7.1
-deprecated==1.2.15
+deprecated==1.2.18
 detect-secrets==1.5.0
 dill==0.3.9
 distlib==0.3.9
 durationpy==0.9
 fastjsonschema==2.19.1
-filelock==3.16.1
+filelock==3.17.0
 fixcompliance==0.4.36
 fixdatalink[extra]==2.0.2
 fixinventoryclient==2.0.1
@@ -56,9 +56,9 @@ flexcache==0.3
 flexparser==0.4
 frozendict==2.4.6
 frozenlist==1.5.0
-google-api-core==2.23.0
-google-api-python-client==2.154.0
-google-auth==2.36.0
+google-api-core==2.24.0
+google-api-python-client==2.159.0
+google-auth==2.38.0
 google-auth-httplib2==0.2.0
 google-cloud-core==2.4.1
 google-cloud-storage==2.19.0
@@ -67,83 +67,83 @@ google-resumable-media==2.7.2
 googleapis-common-protos==1.66.0
 hcloud==2.2.0
 httplib2==0.22.0
-hypothesis==6.122.1
+hypothesis==6.124.7
 idna==3.10
-importlib-metadata==8.5.0
+importlib-metadata==8.6.1
 iniconfig==2.0.0
 isodate==0.7.2
 isort==5.13.2
 jaraco-collections==5.1.0
 jaraco-context==6.0.1
 jaraco-functools==4.1.0
 jaraco-text==4.0.0
-jinja2==3.1.4
+jinja2==3.1.5
 jmespath==1.0.1
 jq==1.8.0
 jsons==1.6.3
-kubernetes==31.0.0
+kubernetes==32.0.0
 markdown==3.7
 markdown-it-py==3.0.0
 markupsafe==3.0.2
 mccabe==0.7.0
 mdurl==0.1.2
 monotonic==1.6
-more-itertools==10.5.0
+more-itertools==10.6.0
 msal==1.31.1
 msal-extensions==1.2.0
 mstache==0.2.0
 multidict==6.1.0
-mypy==1.13.0
+mypy==1.14.1
 mypy-extensions==1.0.0
 networkx==3.4.2
 oauth2client==4.1.3
 oauthlib==3.2.2
 onelogin==2.0.4
 orderly-set==5.2.2
-orjson==3.10.12
+orjson==3.10.15
 packaging==24.2
 parsy==2.1
 pathspec==0.12.1
 pep8-naming==0.14.1
 pint==0.24.4
-pip==24.3.1
+pip==25.0
 pip-tools==7.4.1
 plantuml==0.3.0
 platformdirs==4.3.6
 pluggy==1.5.0
-policy-sentry==0.13.2
+policy-sentry==0.14.0
 portalocker==2.10.1
 portend==3.2.0
-posthog==3.7.4
+posthog==3.10.0
 prometheus-client==0.21.1
-prompt-toolkit==3.0.48
+prompt-toolkit==3.0.50
 propcache==0.2.1
 proto-plus==1.25.0
-protobuf==5.29.1
-psutil==6.1.0
+protobuf==5.29.3
+psutil==6.1.1
 psycopg2-binary==2.9.10
-pyarrow==18.1.0
+pyarrow==19.0.0
 pyasn1==0.6.1
 pyasn1-modules==0.4.1
 pycares==4.5.0
 pycodestyle==2.12.1
 pycparser==2.22
 pyflakes==3.2.0
 pygithub==2.5.0
-pygments==2.18.0
+pygments==2.19.1
 pyjwt[crypto]==2.10.1
-pylint==3.3.2
+pylint==3.3.3
 pymysql==1.1.1
 pynacl==1.5.0
 pyopenssl==24.3.0
-pyparsing==3.2.0
-pyproject-api==1.8.0
+pyparsing==3.2.1
+pyproject-api==1.9.0
 pyproject-hooks==1.2.0
 pytest==8.3.4
-pytest-asyncio==0.24.0
+pytest-asyncio==0.25.2
 pytest-cov==6.0.0
 pytest-runner==6.0.1
-python-arango==8.1.3
+python-arango==8.1.4
 python-dateutil==2.9.0.post0
 pytz==2024.1
 pyyaml==6.0.2
@@ -154,45 +154,45 @@ retrying==1.3.4
 rfc3339-validator==0.1.4
 rich==13.9.4
 rsa==4.9
-s3transfer==0.10.4
+s3transfer==0.11.2
 schema==0.7.7
-setuptools==75.6.0
+setuptools==75.8.0
 six==1.17.0
-slack-sdk==3.33.5
-snowflake-connector-python==3.12.4
-snowflake-sqlalchemy==1.7.1
+slack-sdk==3.34.0
+snowflake-connector-python==3.13.0
+snowflake-sqlalchemy==1.7.3
 sortedcontainers==2.4.0
 soupsieve==2.6
 sqlalchemy==1.4.54
-tempora==5.7.0
+tempora==5.8.0
 tenacity==9.0.0
 toml==0.10.2
 tomlkit==0.13.2
 toolz==1.0.0
-tox==4.23.2
+tox==4.24.1
 transitions==0.9.2
 typeguard==4.4.1
-types-aiofiles==24.1.0.20240626
-types-python-dateutil==2.9.0.20241003
-types-pytz==2024.2.0.20241003
-types-pyyaml==6.0.12.20240917
+types-aiofiles==24.1.0.20241221
+types-python-dateutil==2.9.0.20241206
+types-pytz==2024.2.0.20241221
+types-pyyaml==6.0.12.20241230
 types-requests==2.31.0.6
-types-setuptools==75.6.0.20241126
+types-setuptools==75.8.0.20250110
 types-six==1.17.0.20241205
 types-tzlocal==5.1.0.1
 types-urllib3==1.26.25.14
 typing-extensions==4.12.2
 typish==1.9.3
-tzdata==2024.2
+tzdata==2025.1
 tzlocal==5.2
 uritemplate==4.1.1
 urllib3==1.26.20
 ustache==0.1.6
-virtualenv==20.28.0
+virtualenv==20.29.1
 wcwidth==0.2.13
 websocket-client==1.8.0
 wheel==0.45.1
-wrapt==1.17.0
+wrapt==1.17.2
 yarl==1.18.3
 zc-lockfile==3.0.post1
 zipp==3.21.0
```

**File**: `requirements-extra.txt` (modified, +37/-37)
```diff
@@ -4,10 +4,10 @@ aiohappyeyeballs==2.4.4
 aiohttp[speedups]==3.10.11
 aiohttp-jinja2==1.6
 aiohttp-swagger3==0.9.0
-aiosignal==1.3.1
+aiosignal==1.3.2
 apscheduler==3.11.0
 asn1crypto==1.5.1
-attrs==24.2.0
+attrs==25.1.0
 autocommand==2.2.2
 azure-common==1.1.28
 azure-core==1.32.0
@@ -16,29 +16,29 @@ azure-mgmt-core==1.5.0
 azure-mgmt-resource==23.2.0
 backoff==2.2.1
 beautifulsoup4==4.12.3
-boto3==1.35.76
-botocore==1.35.76
+boto3==1.36.6
+botocore==1.36.6
 brotli==1.1.0
 cached-property==2.0.1
-cachetools==5.5.0
+cachetools==5.5.1
 cattrs==24.1.2
-cerberus==1.3.5
-certifi==2024.8.30
+cerberus==1.3.7
+certifi==2024.12.14
 cffi==1.17.1
-charset-normalizer==3.4.0
+charset-normalizer==3.4.1
 cheroot==10.0.1
 cherrypy==18.10.0
-click==8.1.7
+click==8.1.8
 click-option-group==0.5.6
-cloudsplaining==0.7.0
+cloudsplaining==0.8.0
 cryptography==44.0.0
 deepdiff==8.0.1
 defusedxml==0.7.1
-deprecated==1.2.15
+deprecated==1.2.18
 detect-secrets==1.5.0
 durationpy==0.9
 fastjsonschema==2.19.1
-filelock==3.16.1
+filelock==3.17.0
 fixcompliance==0.4.36
 fixdatalink[extra]==2.0.2
 fixinventoryclient==2.0.1
@@ -47,9 +47,9 @@ flexcache==0.3
 flexparser==0.4
 frozendict==2.4.6
 frozenlist==1.5.0
-google-api-core==2.23.0
-google-api-python-client==2.154.0
-google-auth==2.36.0
+google-api-core==2.24.0
+google-api-python-client==2.159.0
+google-auth==2.38.0
 google-auth-httplib2==0.2.0
 google-cloud-core==2.4.1
 google-cloud-storage==2.19.0
@@ -59,23 +59,23 @@ googleapis-common-protos==1.66.0
 hcloud==2.2.0
 httplib2==0.22.0
 idna==3.10
-importlib-metadata==8.5.0
+importlib-metadata==8.6.1
 isodate==0.7.2
 jaraco-collections==5.1.0
 jaraco-context==6.0.1
 jaraco-functools==4.1.0
 jaraco-text==4.0.0
-jinja2==3.1.4
+jinja2==3.1.5
 jmespath==1.0.1
 jq==1.8.0
 jsons==1.6.3
-kubernetes==31.0.0
+kubernetes==32.0.0
 markdown==3.7
 markdown-it-py==3.0.0
 markupsafe==3.0.2
 mdurl==0.1.2
 monotonic==1.6
-more-itertools==10.5.0
+more-itertools==10.6.0
 msal==1.31.1
 msal-extensions==1.2.0
 mstache==0.2.0
@@ -85,36 +85,36 @@ oauth2client==4.1.3
 oauthlib==3.2.2
 onelogin==2.0.4
 orderly-set==5.2.2
-orjson==3.10.12
+orjson==3.10.15
 packaging==24.2
 parsy==2.1
 pint==0.24.4
 plantuml==0.3.0
 platformdirs==4.3.6
-policy-sentry==0.13.2
+policy-sentry==0.14.0
 portalocker==2.10.1
 portend==3.2.0
-posthog==3.7.4
+posthog==3.10.0
 prometheus-client==0.21.1
-prompt-toolkit==3.0.48
+prompt-toolkit==3.0.50
 propcache==0.2.1
 proto-plus==1.25.0
-protobuf==5.29.1
-psutil==6.1.0
+protobuf==5.29.3
+psutil==6.1.1
 psycopg2-binary==2.9.10
-pyarrow==18.1.0
+pyarrow==19.0.0
 pyasn1==0.6.1
 pyasn1-modules==0.4.1
 pycares==4.5.0
 pycparser==2.22
 pygithub==2.5.0
-pygments==2.18.0
+pygments==2.19.1
 pyjwt[crypto]==2.10.1
 pymysql==1.1.1
 pynacl==1.5.0
 pyopenssl==24.3.0
-pyparsing==3.2.0
-python-arango==8.1.3
+pyparsing==3.2.1
+python-arango==8.1.4
 python-dateutil==2.9.0.post0
 pytz==2024.1
 pyyaml==6.0.2
@@ -125,32 +125,32 @@ retrying==1.3.4
 rfc3339-validator==0.1.4
 rich==13.9.4
 rsa==4.9
-s3transfer==0.10.4
+s3transfer==0.11.2
 schema==0.7.7
-setuptools==75.6.0
+setuptools==75.8.0
 six==1.17.0
-slack-sdk==3.33.5
-snowflake-connector-python==3.12.4
-snowflake-sqlalchemy==1.7.1
+slack-sdk==3.34.0
+snowflake-connector-python==3.13.0
+snowflake-sqlalchemy==1.7.3
 sortedcontainers==2.4.0
 soupsieve==2.6
 sqlalchemy==1.4.54
-tempora==5.7.0
+tempora==5.8.0
 tenacity==9.0.0
 tomlkit==0.13.2
 toolz==1.0.0
 transitions==0.9.2
 typeguard==4.4.1
 typing-extensions==4.12.2
 typish==1.9.3
-tzdata==2024.2
+tzdata==2025.1
 tzlocal==5.2
 uritemplate==4.1.1
 urllib3==1.26.20
 ustache==0.1.6
 wcwidth==0.2.13
 websocket-client==1.8.0
-wrapt==1.17.0
+wrapt==1.17.2
 yarl==1.18.3
 zc-lockfile==3.0.post1
 zipp==3.21.0
```

**File**: `requirements.txt` (modified, +33/-33)
```diff
@@ -4,9 +4,9 @@ aiohappyeyeballs==2.4.4
 aiohttp[speedups]==3.10.11
 aiohttp-jinja2==1.6
 aiohttp-swagger3==0.9.0
-aiosignal==1.3.1
+aiosignal==1.3.2
 apscheduler==3.11.0
-attrs==24.2.0
+attrs==25.1.0
 autocommand==2.2.2
 azure-common==1.1.28
 azure-core==1.32.0
@@ -15,25 +15,25 @@ azure-mgmt-core==1.5.0
 azure-mgmt-resource==23.2.0
 backoff==2.2.1
 beautifulsoup4==4.12.3
-boto3==1.35.76
-botocore==1.35.76
+boto3==1.36.6
+botocore==1.36.6
 brotli==1.1.0
 cached-property==2.0.1
-cachetools==5.5.0
+cachetools==5.5.1
 cattrs==24.1.2
-cerberus==1.3.5
-certifi==2024.8.30
+cerberus==1.3.7
+certifi==2024.12.14
 cffi==1.17.1
-charset-normalizer==3.4.0
+charset-normalizer==3.4.1
 cheroot==10.0.1
 cherrypy==18.10.0
-click==8.1.7
+click==8.1.8
 click-option-group==0.5.6
-cloudsplaining==0.7.0
+cloudsplaining==0.8.0
 cryptography==44.0.0
 deepdiff==8.0.1
 defusedxml==0.7.1
-deprecated==1.2.15
+deprecated==1.2.18
 detect-secrets==1.5.0
 durationpy==0.9
 fastjsonschema==2.19.1
@@ -45,31 +45,31 @@ flexcache==0.3
 flexparser==0.4
 frozendict==2.4.6
 frozenlist==1.5.0
-google-api-core==2.23.0
-google-api-python-client==2.154.0
-google-auth==2.36.0
+google-api-core==2.24.0
+google-api-python-client==2.159.0
+google-auth==2.38.0
 google-auth-httplib2==0.2.0
 googleapis-common-protos==1.66.0
 hcloud==2.2.0
 httplib2==0.22.0
 idna==3.10
-importlib-metadata==8.5.0
+importlib-metadata==8.6.1
 isodate==0.7.2
 jaraco-collections==5.1.0
 jaraco-context==6.0.1
 jaraco-functools==4.1.0
 jaraco-text==4.0.0
-jinja2==3.1.4
+jinja2==3.1.5
 jmespath==1.0.1
 jq==1.8.0
 jsons==1.6.3
-kubernetes==31.0.0
+kubernetes==32.0.0
 markdown==3.7
 markdown-it-py==3.0.0
 markupsafe==3.0.2
 mdurl==0.1.2
 monotonic==1.6
-more-itertools==10.5.0
+more-itertools==10.6.0
 msal==1.31.1
 msal-extensions==1.2.0
 mstache==0.2.0
@@ -79,32 +79,32 @@ oauth2client==4.1.3
 oauthlib==3.2.2
 onelogin==2.0.4
 orderly-set==5.2.2
-orjson==3.10.12
+orjson==3.10.15
 packaging==24.2
 parsy==2.1
 pint==0.24.4
 plantuml==0.3.0
 platformdirs==4.3.6
-policy-sentry==0.13.2
+policy-sentry==0.14.0
 portalocker==2.10.1
 portend==3.2.0
-posthog==3.7.4
+posthog==3.10.0
 prometheus-client==0.21.1
-prompt-toolkit==3.0.48
+prompt-toolkit==3.0.50
 propcache==0.2.1
 proto-plus==1.25.0
-protobuf==5.29.1
-psutil==6.1.0
+protobuf==5.29.3
+psutil==6.1.1
 pyasn1==0.6.1
 pyasn1-modules==0.4.1
 pycares==4.5.0
 pycparser==2.22
 pygithub==2.5.0
-pygments==2.18.0
+pygments==2.19.1
 pyjwt[crypto]==2.10.1
 pynacl==1.5.0
-pyparsing==3.2.0
-python-arango==8.1.3
+pyparsing==3.2.1
+python-arango==8.1.4
 python-dateutil==2.9.0.post0
 pytz==2024.1
 pyyaml==6.0.2
@@ -115,28 +115,28 @@ retrying==1.3.4
 rfc3339-validator==0.1.4
 rich==13.9.4
 rsa==4.9
-s3transfer==0.10.4
+s3transfer==0.11.2
 schema==0.7.7
-setuptools==75.6.0
+setuptools==75.8.0
 six==1.17.0
-slack-sdk==3.33.5
+slack-sdk==3.34.0
 soupsieve==2.6
 sqlalchemy==1.4.54
-tempora==5.7.0
+tempora==5.8.0
 tenacity==9.0.0
 toolz==1.0.0
 transitions==0.9.2
 typeguard==4.4.1
 typing-extensions==4.12.2
 typish==1.9.3
-tzdata==2024.2
+tzdata==2025.1
 tzlocal==5.2
 uritemplate==4.1.1
 urllib3==1.26.20
 ustache==0.1.6
 wcwidth==0.2.13
 websocket-client==1.8.0
-wrapt==1.17.0
+wrapt==1.17.2
 yarl==1.18.3
 zc-lockfile==3.0.post1
 zipp==3.21.0
```

---

### Incident Patch 8: `ec713ad4` (2025-01-24)
**Commit Message**: [docs][fixlib] Fix some typos in doc-strings (#2304)

**File**: `fixlib/fixlib/config.py` (modified, +1/-1)
```diff
@@ -157,7 +157,7 @@ def load_config(self, reload: bool = False) -> None:
                 if reload and self.restart_required(new_config):
                     restart()
 
-            # update the global config object with the confif from the core
+            # update the global config object with the config from the core
             Config.running_config.data = self.with_default_config(raw_config_json)
             # if the raw_config was not empty, we need to set the revision too
             if new_config_revision:
```

**File**: `fixlib/fixlib/tree.py` (modified, +1/-1)
```diff
@@ -878,7 +878,7 @@ def update_node(self, nid, **attrs):
         cn = self[nid]
         for attr, val in attrs.items():
             if attr == "identifier":
-                # Updating node id meets following contraints:
+                # Updating node id meets following constraints:
                 # * Update node identifier property
                 # * Update parent's followers
                 # * Update children's parents
```

**File**: `fixlib/fixlib/utils.py` (modified, +1/-1)
```diff
@@ -491,7 +491,7 @@ def merge_json_elements(
     merge_strategy: Callable[[JsonElement, JsonElement], JsonElement] = lambda existing_val, update_val: update_val,
 ) -> JsonElement:
     """
-    Merges two JsonElements accorting to merge strategy.
+    Merges two JsonElements according to merge strategy.
     By default recursively traverses Dicts and prefers the new value
     """
     if isinstance(existing, dict) and isinstance(update, dict):
```

**File**: `fixlib/test/test_utils.py` (modified, +1/-1)
```diff
@@ -479,7 +479,7 @@ def test_freeze():
     # nested too
     nested_dict = {"foo": flat_dict}
     assert freeze(nested_dict) == frozendict({"foo": frozendict(flat_dict)})
-    # and a list to tupple
+    # and a list to tuple
     assert freeze([1, 2]) == (1, 2)
 
 
```

---

### Incident Patch 9: `3457321c` (2025-01-23)
**Commit Message**: [fix][core] Fix some typos (#2303)

**File**: `fixcore/fixcore/cli/command.py` (modified, +6/-6)
```diff
@@ -2245,7 +2245,7 @@ class FormatCommand(CLICommand, OutputTransformer):
     - `--text` [Optional] - will create a text representation of every element.
     - `--cytoscape` [Optional] - will create a string representation in the well known Cytoscape .cyjs format.
       See: [https://js.cytoscape.org/#notation/elements-json](https://js.cytoscape.org/#notation/elements-json)
-    - `--graphml` [Optional] - will create string representaion of the result in graphml format.
+    - `--graphml` [Optional] - will create string representation of the result in graphml format.
       See: [http://graphml.graphdrawing.org](http://graphml.graphdrawing.org)
     - `--dot` [Optional] - will create a string representation in graphviz dot format.
       See: [https://graphviz.org/doc/info/lang.html](https://graphviz.org/doc/info/lang.html)
@@ -4613,7 +4613,7 @@ class ConfigsCommand(CLICommand):
     - cfg_id [mandatory]: The identifier of the configuration.
     - prop: the path of the property to set. Nested properties can be accessed via `.`.
     - value: the value of the property path to set. It can be any json conform element.
-    - path: the path of the file that holds the configuration to upate.
+    - path: the path of the file that holds the configuration to update.
 
     ## Examples
 
@@ -5043,7 +5043,7 @@ class ReportCommand(CLICommand, EntityProvider):
     ## Examples
 
     ```shell
-    # List all available chekcs
+    # List all available checks
     > report checks list
     aws_apigateway_authorizers_enabled
     aws_s3_account_level_public_access_blocks
@@ -5388,14 +5388,14 @@ async def app_uninstall(app_name: InfraAppName) -> AsyncIterator[JsonElement]:
 
         async def app_update(app_name: InfraAppName) -> AsyncIterator[JsonElement]:
             updated_manifest = await self.dependencies.infra_apps_package_manager.update(app_name)
-            yield f"App {app_name} updated sucessfully to the latest version ({updated_manifest.version})"
+            yield f"App {app_name} updated successfully to the latest version ({updated_manifest.version})"
 
         async def app_update_all() -> AsyncIterator[JsonElement]:
             async for name, result in self.dependencies.infra_apps_package_manager.update_all():
                 if isinstance(result, Failure):
                     yield f"App {name} failed to update: {result}"
                 else:
-                    yield f"App {name} updated sucessfully to the latest version ({result.version})"
+                    yield f"App {name} updated successfully to the latest version ({result.version})"
 
         async def apps_list() -> AsyncIterator[JsonElement]:
             async for app in self.dependencies.infra_apps_package_manager.list():
@@ -5828,7 +5828,7 @@ async def graph_snapshot(source: Optional[GraphName], label: str) -> AsyncIterat
             if not source:
                 source = ctx.graph_name
             snapshot_name = await self.dependencies.graph_manager.snapshot(source, label)
-            yield f"Graph {source} snapshoted to {snapshot_name}."
+            yield f"Graph {source} snapshotted to {snapshot_name}."
 
         async def graph_delete(graph_name: GraphName) -> AsyncIterator[JsonElement]:
             await self.dependencies.graph_manager.delete(graph_name)
```

**File**: `fixcore/tests/fixcore/cli/command_test.py` (modified, +2/-2)
```diff
@@ -1188,13 +1188,13 @@ async def check_file_is_yaml(res: JsStream) -> None:
 
     # update the app
     assert (
-        "App cleanup-untagged updated sucessfully to the latest version"
+        "App cleanup-untagged updated successfully to the latest version"
         in (await execute("apps update cleanup-untagged", str))[0]
     )
 
     # update all apps
     assert (
-        "App cleanup-untagged updated sucessfully to the latest version"
+        "App cleanup-untagged updated successfully to the latest version"
         in (await execute("apps update cleanup-untagged", str))[0]
     )
 
```

---

### Incident Patch 10: `eedfaa54` (2024-12-13)
**Commit Message**: [aws][fix] Fix errors associated with AwsBedrock and AwsEcr resources (#2302)

**File**: `plugins/aws/fix_plugin_aws/resource/bedrock.py` (modified, +50/-51)
```diff
@@ -225,7 +225,7 @@ def add_tags(job: AwsResource) -> None:
                     job.tags.update({tag.get("key"): tag.get("value")})
 
         for js in json:
-            for result in builder.client.list(
+            if result := builder.client.get(
                 service_name,
                 "get-custom-model",
                 modelIdentifier=js["modelArn"],
@@ -508,7 +508,7 @@ def add_tags(job: AwsResource) -> None:
                     job.tags.update({tag.get("key"): tag.get("value")})
 
         for js in json:
-            for result in builder.client.list(
+            if result := builder.client.get(
                 service_name,
                 "get-guardrail",
                 guardrailIdentifier=js["id"],
@@ -640,7 +640,7 @@ def add_tags(job: AwsResource) -> None:
                     job.tags.update({tag.get("key"): tag.get("value")})
 
         for js in json:
-            for result in builder.client.list(
+            if result := builder.client.get(
                 service_name,
                 "get-model-customization-job",
                 jobIdentifier=js["jobArn"],
@@ -840,7 +840,7 @@ def add_tags(job: AwsResource) -> None:
                     job.tags.update({tag.get("key"): tag.get("value")})
 
         for js in json:
-            for result in builder.client.list(
+            if result := builder.client.get(
                 service_name,
                 "get-evaluation-job",
                 jobIdentifier=js["jobArn"],
@@ -944,33 +944,32 @@ class AwsBedrockAgent(BedrockTaggable, AwsResource):
     }
     api_spec: ClassVar[AwsApiSpec] = AwsApiSpec("bedrock-agent", "list-agents", "agentSummaries")
     mapping: ClassVar[Dict[str, Bender]] = {
-        "id": S("agent", "agentId"),
-        "name": S("agent", "agentName"),
-        "ctime": S("agent", "createdAt"),
-        "mtime": S("agent", "updatedAt"),
-        "arn": S("agent", "agentArn"),
-        "agent_arn": S("agent", "agentArn"),
-        "agent_id": S("agent", "agentId"),
-        "agent_name": S("agent", "agentName"),
-        "agent_resource_role_arn": S("agent", "agentResourceRoleArn"),
-        "agent_status": S("agent", "agentStatus"),
-        "agent_version": S("agent", "agentVersion").or_else(S("latestAgentVersion")),
-        "client_token": S("agent", "clientToken"),
-        "created_at": S("agent", "createdAt"),
-        "customer_encryption_key_arn": S("agent", "customerEncryptionKeyArn"),
-        "description": S("agent", "description"),
-        "failure_reasons": S("agent", "failureReasons", default=[]),
-        "foundation_model": S("agent", "foundationModel"),
-        "guardrail_configuration": S("agent", "guardrailConfiguration")
-        >> Bend(AwsBedrockGuardrailConfiguration.mapping),
-        "idle_session_ttl_in_seconds": S("agent", "idleSessionTTLInSeconds"),
-        "instruction": S("agent", "instruction"),
-        "memory_configuration": S("agent", "memoryConfiguration") >> Bend(AwsBedrockMemoryConfiguration.mapping),
-        "prepared_at": S("agent", "preparedAt"),
-        "prompt_override_configuration": S("agent", "promptOverrideConfiguration")
+        "id": S("agentId"),
+        "name": S("agentName"),
+        "ctime": S("createdAt"),
+        "mtime": S("updatedAt"),
+        "arn": S("agentArn"),
+        "agent_arn": S("agentArn"),
+        "agent_id": S("agentId"),
+        "agent_name": S("agentName"),
+        "agent_resource_role_arn": S("agentResourceRoleArn"),
+        "agent_status": S("agentStatus"),
+        "agent_version": S("agentVersion"),
+        "client_token": S("clientToken"),
+        "created_at": S("createdAt"),
+        "customer_encryption_key_arn": S("customerEncryptionKeyArn"),
+        "description": S("description"),
+        "failure_reasons": S("failureReasons", default=[]),
+        "foundation_model": S("foundationModel"),
+        "guardrail_configuration": S("guardrailConfiguration") >> Bend(AwsBedrockGuardrailConfiguration.mapping),
+        "idle_session_ttl_in_seconds": S("idleSessionTTLInSeconds"),
+        "instruction": S("instruction"),
+        "memory_configuration": S("memoryConfiguration") >> Bend(AwsBedrockMemoryConfiguration.mapping),
+        "prepared_at": S("preparedAt"),
+        "prompt_override_configuration": S("promptOverrideConfiguration")
         >> Bend(AwsBedrockPromptOverrideConfiguration.mapping),
-        "agent_recommended_actions": S("agent", "recommendedActions", default=[]),
-        "updated_at": S("agent", "updatedAt"),
+        "agent_recommended_actions": S("recommendedActions", default=[]),
+        "updated_at": S("updatedAt"),
     }
     agent_arn: Optional[str] = field(default=None, metadata={"description": "The Amazon Resource Name (ARN) of the agent."})  # fmt: skip
     agent_id: Optional[str] = field(default=None, metadata={"description": "The unique identifier of the agent."})  # fmt: skip
@@ -1038,13 +1037,13 @@ def add_tags(agent: AwsResource) -> None:
                 agent.tags.up
```

**File**: `plugins/aws/fix_plugin_aws/resource/ecr.py` (modified, +2/-2)
```diff
@@ -71,8 +71,8 @@ def add_repository_policy(repository: AwsEcrRepository) -> None:
                     service_name,
                     "get-repository-policy",
                     "policyText",
-                    repositoryName=repository.name,
                     expected_errors=["RepositoryPolicyNotFoundException", "RepositoryNotFoundException"],
+                    repositoryName=repository.name,
                 ):
                     repository.repository_policy = sort_json(json_loads(raw_policy), sort_list=True)  # type: ignore
 
@@ -83,7 +83,7 @@ def fetch_lifecycle_policy(repository: AwsEcrRepository) -> None:
                     "get-lifecycle-policy",
                     "lifecyclePolicyText",
                     repositoryName=repository.name,
-                    expected_errors=["LifecyclePolicyNotFoundException"],
+                    expected_errors=["LifecyclePolicyNotFoundException", "RepositoryNotFoundException"],
                 ):
                     repository.lifecycle_policy = sort_json(json.loads(policy), sort_list=True)  # type: ignore
 
```

**File**: `plugins/aws/test/resources/files/bedrock_agent/get-knowledge-base__foo.json` (modified, +7/-5)
```diff
@@ -1,7 +1,9 @@
 {
-    "description": "foo",
-    "knowledgeBaseId": "foo",
-    "name": "foo",
-    "status": "ACTIVE",
-    "updatedAt": "2024-09-17T12:11:47Z"
+    "knowledgeBase": {
+        "description": "foo",
+        "knowledgeBaseId": "foo",
+        "name": "foo",
+        "status": "ACTIVE",
+        "updatedAt": "2024-09-17T12:11:47Z"
+    }
 }
\ No newline at end of file
```

---

### Incident Patch 11: `8fe33714` (2024-12-11)
**Commit Message**: [fix][chore] Do not use S3/CDN in GitHub actions (#2289)

**File**: `.github/workflows/check_pr_plugin_aws.yml` (modified, +0/-16)
```diff
@@ -73,19 +73,3 @@ jobs:
           user: __token__
           password: ${{ secrets.PYPI_FIXINVENTORY_PLUGIN_AWS }}
           packages_dir: ./plugins/aws/dist/
-
-      - name: Upload AWS policies
-        if: github.event_name != 'pull_request'
-        working-directory: ./plugins/aws
-        run: |
-          pip install --upgrade --editable .
-          pip install --upgrade --editable ./tools/awspolicygen
-          export GITHUB_REF="${{ github.ref }}"
-          export GITHUB_REF_TYPE="${{ github.ref_type }}"
-          export GITHUB_EVENT_NAME="${{ github.event_name }}"
-          export API_TOKEN="${{ secrets.API_TOKEN }}"
-          export SPACES_KEY="${{ secrets.SPACES_KEY }}"
-          export SPACES_SECRET="${{ secrets.SPACES_SECRET }}"
-          export AWS_ACCESS_KEY_ID="${{ secrets.S3_FIXINVENTORYPUBLIC_AWS_ACCESS_KEY_ID }}"
-          export AWS_SECRET_ACCESS_KEY="${{ secrets.S3_FIXINVENTORYPUBLIC_AWS_SECRET_ACCESS_KEY }}"
-          awspolicygen --verbose --spaces-name somecdn --spaces-region ams3 --spaces-path fix/aws/ --aws-s3-bucket fixinventorypublic --aws-s3-bucket-path cf/
```

**File**: `.github/workflows/check_pr_plugin_gcp.yml` (modified, +0/-14)
```diff
@@ -73,17 +73,3 @@ jobs:
           user: __token__
           password: ${{ secrets.PYPI_FIXINVENTORY_PLUGIN_GCP }}
           packages_dir: ./plugins/gcp/dist/
-
-      - name: Upload GCP policies
-        if: github.event_name != 'pull_request'
-        working-directory: ./plugins/gcp
-        run: |
-          pip install --upgrade --editable .
-          pip install --upgrade --editable ./tools/gcppolicygen
-          export GITHUB_REF="${{ github.ref }}"
-          export GITHUB_REF_TYPE="${{ github.ref_type }}"
-          export GITHUB_EVENT_NAME="${{ github.event_name }}"
-          export API_TOKEN="${{ secrets.API_TOKEN }}"
-          export SPACES_KEY="${{ secrets.SPACES_KEY }}"
-          export SPACES_SECRET="${{ secrets.SPACES_SECRET }}"
-          gcppolicygen --verbose --spaces-name somecdn --spaces-region ams3 --spaces-path fix/gcp/
```

**File**: `.github/workflows/create_plugin_workflows.py` (modified, +5/-4)
```diff
@@ -138,7 +138,8 @@
                 .replace("@name@", plugin)
                 .replace("@PKGNAME@", f"fixinventory_plugin_{plugin}".upper())
             )
-            if plugin == "aws":
-                yml.write(aws_policygen)
-            elif plugin == "gcp":
-                yml.write(gcp_policygen)
+            # PolicyGen Upload disabled for now. Uncomment when required.
+            # if plugin == "aws":
+            #     yml.write(aws_policygen)
+            # elif plugin == "gcp":
+            #     yml.write(gcp_policygen)
```

**File**: `.github/workflows/publish.yml` (modified, +82/-82)
```diff
@@ -34,34 +34,34 @@ jobs:
         run: |
           yarn install --frozen-lockfile
 
-      - name: Wait for AWS policies to be uploaded
-        if: github.event_name != 'workflow_dispatch'
-        uses: lewagon/wait-on-check-action@v1.3.1
-        with:
-          ref: ${{ github.ref }}
-          check-name: aws
-          repo-token: ${{ secrets.GITHUB_TOKEN }}
-
-      - name: Update AWS policy JSON
-        shell: bash
-        working-directory: ./docs.fix.security/iam/aws
-        run: |
-          wget -qO FixOrgList.json https://cdn.some.engineering/fix/aws/edge/FixOrgList.json
-          wget -qO FixCollect.json https://cdn.some.engineering/fix/aws/edge/FixCollect.json
-
-      - name: Wait for GCP policies to be uploaded
-        if: github.event_name != 'workflow_dispatch'
-        uses: lewagon/wait-on-check-action@v1.3.1
-        with:
-          ref: ${{ github.ref }}
-          check-name: gcp
-          repo-token: ${{ secrets.GITHUB_TOKEN }}
-
-      - name: Update GCP policy JSON
-        shell: bash
-        working-directory: ./docs.fix.security/iam/gcp
-        run: |
-          wget -qO fix_access.json https://cdn.some.engineering/fix/gcp/edge/fix_access.json
+#      - name: Wait for AWS policies to be uploaded
+#        if: github.event_name != 'workflow_dispatch'
+#        uses: lewagon/wait-on-check-action@v1.3.1
+#        with:
+#          ref: ${{ github.ref }}
+#          check-name: aws
+#          repo-token: ${{ secrets.GITHUB_TOKEN }}
+#
+#      - name: Update AWS policy JSON
+#        shell: bash
+#        working-directory: ./docs.fix.security/iam/aws
+#        run: |
+#          wget -qO FixOrgList.json https://cdn.some.engineering/fix/aws/edge/FixOrgList.json
+#          wget -qO FixCollect.json https://cdn.some.engineering/fix/aws/edge/FixCollect.json
+#
+#      - name: Wait for GCP policies to be uploaded
+#        if: github.event_name != 'workflow_dispatch'
+#        uses: lewagon/wait-on-check-action@v1.3.1
+#        with:
+#          ref: ${{ github.ref }}
+#          check-name: gcp
+#          repo-token: ${{ secrets.GITHUB_TOKEN }}
+#
+#      - name: Update GCP policy JSON
+#        shell: bash
+#        working-directory: ./docs.fix.security/iam/gcp
+#        run: |
+#          wget -qO fix_access.json https://cdn.some.engineering/fix/gcp/edge/fix_access.json
 
       - name: Clean existing Kroki images
         shell: bash
@@ -138,28 +138,28 @@ jobs:
         run: |
           yarn gen-api-docs
 
-      - name: Update AWS policy JSON
-        shell: bash
-        working-directory: ./inventory.fix.security/iam/aws/edge
-        run: |
-          wget -qO FixOrgList.json https://cdn.some.engineering/fix/aws/edge/FixOrgList.json
-          wget -qO FixCollect.json https://cdn.some.engineering/fix/aws/edge/FixCollect.json
-          wget -qO FixMutate.json https://cdn.some.engineering/fix/aws/edge/FixMutate.json
-
-      - name: Wait for GCP policies to be uploaded
-        if: github.event_name != 'workflow_dispatch'
-        uses: lewagon/wait-on-check-action@v1.3.1
-        with:
-          ref: ${{ github.ref }}
-          check-name: gcp
-          repo-token: ${{ secrets.GITHUB_TOKEN }}
-
-      - name: Update GCP policy JSON
-        shell: bash
-        working-directory: ./inventory.fix.security/iam/gcp/edge
-        run: |
-          wget -qO fix_access.json https://cdn.some.engineering/fix/gcp/edge/fix_access.json
-          wget -qO fix_mutate.json https://cdn.some.engineering/fix/gcp/edge/fix_mutate.json
+#      - name: Update AWS policy JSON
+#        shell: bash
+#        working-directory: ./inventory.fix.security/iam/aws/edge
+#        run: |
+#          wget -qO FixOrgList.json https://cdn.some.engineering/fix/aws/edge/FixOrgList.json
+#          wget -qO FixCollect.json https://cdn.some.engineering/fix/aws/edge/FixCollect.json
+#          wget -qO FixMutate.json https://cdn.some.engineering/fix/aws/edge/FixMutate.json
+#
+#      - name: Wait for GCP policies to be uploaded
+#        if: github.event_name != 'workflow_dispatch'
+#        uses: lewagon/wait-on-check-action@v1.3.1
+#        with:
+#          ref: ${{ github.ref }}
+#          check-name: gcp
+#          repo-token: ${{ secrets.GITHUB_TOKEN }}
+#
+#      - name: Update GCP policy JSON
+#        shell: bash
+#        working-directory: ./inventory.fix.security/iam/gcp/edge
+#        run: |
+#          wget -qO fix_access.json https://cdn.some.engineering/fix/gcp/edge/fix_access.json
+#          wget -qO fix_mutate.json https://cdn.some.engineering/fix/gcp/edge/fix_mutate.json
 
       - name: Clean existing Kroki images
         if: github.event_name == 'workflow_dispatch' # only when triggered manually
@@ -286,38 +286,38 @@ jobs:
         run: |
           yarn gen-api-docs
 
-      - name: Wait for AWS policies to be uploaded
-        if: steps.release.outputs.prerelease == 'false' && github.event_name != 'workflow_dispatch'
-        uses: lewagon/wait-on-check-action@v1.3.1
- 
```

---

### Incident Patch 12: `ec8dac22` (2024-12-09)
**Commit Message**: [fixinventory][chore] Bump fixcompliance to latest

**File**: `requirements-all.txt` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ distlib==0.3.9
 durationpy==0.9
 fastjsonschema==2.19.1
 filelock==3.16.1
-fixcompliance==0.4.35
+fixcompliance==0.4.36
 fixdatalink[extra]==2.0.2
 fixinventoryclient==2.0.1
 fixinventorydata==0.2.6
```

**File**: `requirements-extra.txt` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ detect-secrets==1.5.0
 durationpy==0.9
 fastjsonschema==2.19.1
 filelock==3.16.1
-fixcompliance==0.4.35
+fixcompliance==0.4.36
 fixdatalink[extra]==2.0.2
 fixinventoryclient==2.0.1
 fixinventorydata==0.2.6
```

**File**: `requirements.txt` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ deprecated==1.2.15
 detect-secrets==1.5.0
 durationpy==0.9
 fastjsonschema==2.19.1
-fixcompliance==0.4.35
+fixcompliance==0.4.36
 fixdatalink==2.0.2
 fixinventoryclient==2.0.1
 fixinventorydata==0.2.6
```

---

### Incident Patch 13: `d61bb368` (2024-12-05)
**Commit Message**: [inventory][fix] docker-compose no pull info (#2297)

**File**: `.github/workflows/publish.yml` (modified, +2/-2)
```diff
@@ -82,7 +82,7 @@ jobs:
         shell: bash
         run: |
           yq '.services.fixcore.environment += "FIXCORE_MODEL_FROM_PLUGINS=true"' docker-compose.yaml > docker-compose-model-gen.yaml
-          PSK= FIXCORE_ANALYTICS_OPT_OUT=true docker compose -f docker-compose-model-gen.yaml up -d
+          PSK= FIXCORE_ANALYTICS_OPT_OUT=true docker compose -f docker-compose-model-gen.yaml up -d --quiet-pull
           cd ${{ github.workspace }}/docs.fix.security/docs/resources
           python3 ${{ github.workspace }}/docs.fix.security/tools/export_models.py
 
@@ -346,7 +346,7 @@ jobs:
         shell: bash
         run: |
           yq '.services.fixcore.environment += "FIXCORE_MODEL_FROM_PLUGINS=true"' docker-compose.yaml > docker-compose-model-gen.yaml
-          PSK= FIXCORE_ANALYTICS_OPT_OUT=true docker compose -f docker-compose-model-gen.yaml up -d
+          PSK= FIXCORE_ANALYTICS_OPT_OUT=true docker compose -f docker-compose-model-gen.yaml up -d --quiet-pull
           cd ${{ github.workspace }}/inventory.fix.security/versioned_docs/version-${{ steps.release.outputs.docsVersion }}/reference/unified-data-model
           python3 ${{ github.workspace }}/inventory.fix.security/tools/export_models.py
 
```

---

### Incident Patch 14: `0d969e4f` (2024-12-05)
**Commit Message**: [inventory][fix] docker-compose -> docker compose (#2295)

**File**: `.github/workflows/publish.yml` (modified, +2/-2)
```diff
@@ -82,7 +82,7 @@ jobs:
         shell: bash
         run: |
           yq '.services.fixcore.environment += "FIXCORE_MODEL_FROM_PLUGINS=true"' docker-compose.yaml > docker-compose-model-gen.yaml
-          PSK= FIXCORE_ANALYTICS_OPT_OUT=true docker-compose -f docker-compose-model-gen.yaml up -d
+          PSK= FIXCORE_ANALYTICS_OPT_OUT=true docker compose -f docker-compose-model-gen.yaml up -d
           cd ${{ github.workspace }}/docs.fix.security/docs/resources
           python3 ${{ github.workspace }}/docs.fix.security/tools/export_models.py
 
@@ -346,7 +346,7 @@ jobs:
         shell: bash
         run: |
           yq '.services.fixcore.environment += "FIXCORE_MODEL_FROM_PLUGINS=true"' docker-compose.yaml > docker-compose-model-gen.yaml
-          PSK= FIXCORE_ANALYTICS_OPT_OUT=true docker-compose -f docker-compose-model-gen.yaml up -d
+          PSK= FIXCORE_ANALYTICS_OPT_OUT=true docker compose -f docker-compose-model-gen.yaml up -d
           cd ${{ github.workspace }}/inventory.fix.security/versioned_docs/version-${{ steps.release.outputs.docsVersion }}/reference/unified-data-model
           python3 ${{ github.workspace }}/inventory.fix.security/tools/export_models.py
 
```

---

### Incident Patch 15: `07e0ded1` (2024-12-05)
**Commit Message**: [fix][chore] Bump libs (#2293)

**File**: `fixcore/pyproject.toml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ dependencies = [
     "aiofiles",
     "aiohttp-jinja2",
     "aiohttp-swagger3",
-    "aiohttp[speedups]",
+    "aiohttp[speedups] < 3.11",
     "cryptography",
     "deepdiff",
     "detect_secrets",
```

**File**: `requirements-all.txt` (modified, +34/-34)
```diff
@@ -1,11 +1,11 @@
 aiodns==3.2.0
 aiofiles==24.1.0
-aiohappyeyeballs==2.4.3
+aiohappyeyeballs==2.4.4
 aiohttp[speedups]==3.10.11
 aiohttp-jinja2==1.6
 aiohttp-swagger3==0.9.0
 aiosignal==1.3.1
-apscheduler==3.10.4
+apscheduler==3.11.0
 asn1crypto==1.5.1
 astroid==3.3.5
 attrs==24.2.0
@@ -18,8 +18,8 @@ azure-mgmt-resource==23.2.0
 backoff==2.2.1
 beautifulsoup4==4.12.3
 black==24.10.0
-boto3==1.35.65
-botocore==1.35.65
+boto3==1.35.76
+botocore==1.35.76
 brotli==1.1.0
 build==1.2.2.post1
 cached-property==2.0.1
@@ -36,8 +36,8 @@ click==8.1.7
 click-option-group==0.5.6
 cloudsplaining==0.7.0
 colorama==0.4.6
-coverage[toml]==7.6.7
-cryptography==43.0.3
+coverage[toml]==7.6.8
+cryptography==44.0.0
 deepdiff==8.0.1
 defusedxml==0.7.1
 deprecated==1.2.15
@@ -57,17 +57,17 @@ flexparser==0.4
 frozendict==2.4.6
 frozenlist==1.5.0
 google-api-core==2.23.0
-google-api-python-client==2.153.0
+google-api-python-client==2.154.0
 google-auth==2.36.0
 google-auth-httplib2==0.2.0
 google-cloud-core==2.4.1
-google-cloud-storage==2.18.2
+google-cloud-storage==2.19.0
 google-crc32c==1.6.0
 google-resumable-media==2.7.2
 googleapis-common-protos==1.66.0
 hcloud==2.2.0
 httplib2==0.22.0
-hypothesis==6.119.3
+hypothesis==6.122.1
 idna==3.10
 importlib-metadata==8.5.0
 iniconfig==2.0.0
@@ -100,7 +100,7 @@ oauth2client==4.1.3
 oauthlib==3.2.2
 onelogin==2.0.4
 orderly-set==5.2.2
-orjson==3.10.11
+orjson==3.10.12
 packaging==24.2
 parsy==2.1
 pathspec==0.12.1
@@ -111,39 +111,39 @@ pip-tools==7.4.1
 plantuml==0.3.0
 platformdirs==4.3.6
 pluggy==1.5.0
-policy-sentry==0.13.1
+policy-sentry==0.13.2
 portalocker==2.10.1
 portend==3.2.0
-posthog==3.7.2
-prometheus-client==0.21.0
+posthog==3.7.4
+prometheus-client==0.21.1
 prompt-toolkit==3.0.48
-propcache==0.2.0
+propcache==0.2.1
 proto-plus==1.25.0
-protobuf==5.28.3
+protobuf==5.29.1
 psutil==6.1.0
 psycopg2-binary==2.9.10
-pyarrow==18.0.0
+pyarrow==18.1.0
 pyasn1==0.6.1
 pyasn1-modules==0.4.1
-pycares==4.4.0
+pycares==4.5.0
 pycodestyle==2.12.1
 pycparser==2.22
 pyflakes==3.2.0
 pygithub==2.5.0
 pygments==2.18.0
-pyjwt[crypto]==2.10.0
-pylint==3.3.1
+pyjwt[crypto]==2.10.1
+pylint==3.3.2
 pymysql==1.1.1
 pynacl==1.5.0
-pyopenssl==24.2.1
+pyopenssl==24.3.0
 pyparsing==3.2.0
 pyproject-api==1.8.0
 pyproject-hooks==1.2.0
-pytest==8.3.3
+pytest==8.3.4
 pytest-asyncio==0.24.0
 pytest-cov==6.0.0
 pytest-runner==6.0.1
-python-arango==8.1.2
+python-arango==8.1.3
 python-dateutil==2.9.0.post0
 pytz==2024.1
 pyyaml==6.0.2
@@ -154,13 +154,13 @@ retrying==1.3.4
 rfc3339-validator==0.1.4
 rich==13.9.4
 rsa==4.9
-s3transfer==0.10.3
+s3transfer==0.10.4
 schema==0.7.7
-setuptools==75.5.0
-six==1.16.0
-slack-sdk==3.33.4
-snowflake-connector-python==3.12.3
-snowflake-sqlalchemy==1.6.1
+setuptools==75.6.0
+six==1.17.0
+slack-sdk==3.33.5
+snowflake-connector-python==3.12.4
+snowflake-sqlalchemy==1.7.1
 sortedcontainers==2.4.0
 soupsieve==2.6
 sqlalchemy==1.4.54
@@ -177,8 +177,8 @@ types-python-dateutil==2.9.0.20241003
 types-pytz==2024.2.0.20241003
 types-pyyaml==6.0.12.20240917
 types-requests==2.31.0.6
-types-setuptools==75.5.0.20241122
-types-six==1.16.21.20241105
+types-setuptools==75.6.0.20241126
+types-six==1.17.0.20241205
 types-tzlocal==5.1.0.1
 types-urllib3==1.26.25.14
 typing-extensions==4.12.2
@@ -188,11 +188,11 @@ tzlocal==5.2
 uritemplate==4.1.1
 urllib3==1.26.20
 ustache==0.1.6
-virtualenv==20.27.1
+virtualenv==20.28.0
 wcwidth==0.2.13
 websocket-client==1.8.0
-wheel==0.45.0
-wrapt==1.16.0
-yarl==1.17.2
+wheel==0.45.1
+wrapt==1.17.0
+yarl==1.18.3
 zc-lockfile==3.0.post1
 zipp==3.21.0
```

**File**: `requirements-extra.txt` (modified, +26/-26)
```diff
@@ -1,11 +1,11 @@
 aiodns==3.2.0
 aiofiles==24.1.0
-aiohappyeyeballs==2.4.3
+aiohappyeyeballs==2.4.4
 aiohttp[speedups]==3.10.11
 aiohttp-jinja2==1.6
 aiohttp-swagger3==0.9.0
 aiosignal==1.3.1
-apscheduler==3.10.4
+apscheduler==3.11.0
 asn1crypto==1.5.1
 attrs==24.2.0
 autocommand==2.2.2
@@ -16,8 +16,8 @@ azure-mgmt-core==1.5.0
 azure-mgmt-resource==23.2.0
 backoff==2.2.1
 beautifulsoup4==4.12.3
-boto3==1.35.65
-botocore==1.35.65
+boto3==1.35.76
+botocore==1.35.76
 brotli==1.1.0
 cached-property==2.0.1
 cachetools==5.5.0
@@ -31,7 +31,7 @@ cherrypy==18.10.0
 click==8.1.7
 click-option-group==0.5.6
 cloudsplaining==0.7.0
-cryptography==43.0.3
+cryptography==44.0.0
 deepdiff==8.0.1
 defusedxml==0.7.1
 deprecated==1.2.15
@@ -48,11 +48,11 @@ flexparser==0.4
 frozendict==2.4.6
 frozenlist==1.5.0
 google-api-core==2.23.0
-google-api-python-client==2.153.0
+google-api-python-client==2.154.0
 google-auth==2.36.0
 google-auth-httplib2==0.2.0
 google-cloud-core==2.4.1
-google-cloud-storage==2.18.2
+google-cloud-storage==2.19.0
 google-crc32c==1.6.0
 google-resumable-media==2.7.2
 googleapis-common-protos==1.66.0
@@ -85,36 +85,36 @@ oauth2client==4.1.3
 oauthlib==3.2.2
 onelogin==2.0.4
 orderly-set==5.2.2
-orjson==3.10.11
+orjson==3.10.12
 packaging==24.2
 parsy==2.1
 pint==0.24.4
 plantuml==0.3.0
 platformdirs==4.3.6
-policy-sentry==0.13.1
+policy-sentry==0.13.2
 portalocker==2.10.1
 portend==3.2.0
-posthog==3.7.2
-prometheus-client==0.21.0
+posthog==3.7.4
+prometheus-client==0.21.1
 prompt-toolkit==3.0.48
-propcache==0.2.0
+propcache==0.2.1
 proto-plus==1.25.0
-protobuf==5.28.3
+protobuf==5.29.1
 psutil==6.1.0
 psycopg2-binary==2.9.10
-pyarrow==18.0.0
+pyarrow==18.1.0
 pyasn1==0.6.1
 pyasn1-modules==0.4.1
-pycares==4.4.0
+pycares==4.5.0
 pycparser==2.22
 pygithub==2.5.0
 pygments==2.18.0
-pyjwt[crypto]==2.10.0
+pyjwt[crypto]==2.10.1
 pymysql==1.1.1
 pynacl==1.5.0
-pyopenssl==24.2.1
+pyopenssl==24.3.0
 pyparsing==3.2.0
-python-arango==8.1.2
+python-arango==8.1.3
 python-dateutil==2.9.0.post0
 pytz==2024.1
 pyyaml==6.0.2
@@ -125,13 +125,13 @@ retrying==1.3.4
 rfc3339-validator==0.1.4
 rich==13.9.4
 rsa==4.9
-s3transfer==0.10.3
+s3transfer==0.10.4
 schema==0.7.7
-setuptools==75.5.0
-six==1.16.0
-slack-sdk==3.33.4
-snowflake-connector-python==3.12.3
-snowflake-sqlalchemy==1.6.1
+setuptools==75.6.0
+six==1.17.0
+slack-sdk==3.33.5
+snowflake-connector-python==3.12.4
+snowflake-sqlalchemy==1.7.1
 sortedcontainers==2.4.0
 soupsieve==2.6
 sqlalchemy==1.4.54
@@ -150,7 +150,7 @@ urllib3==1.26.20
 ustache==0.1.6
 wcwidth==0.2.13
 websocket-client==1.8.0
-wrapt==1.16.0
-yarl==1.17.2
+wrapt==1.17.0
+yarl==1.18.3
 zc-lockfile==3.0.post1
 zipp==3.21.0
```

**File**: `requirements.txt` (modified, +21/-21)
```diff
@@ -1,11 +1,11 @@
 aiodns==3.2.0
 aiofiles==24.1.0
-aiohappyeyeballs==2.4.3
+aiohappyeyeballs==2.4.4
 aiohttp[speedups]==3.10.11
 aiohttp-jinja2==1.6
 aiohttp-swagger3==0.9.0
 aiosignal==1.3.1
-apscheduler==3.10.4
+apscheduler==3.11.0
 attrs==24.2.0
 autocommand==2.2.2
 azure-common==1.1.28
@@ -15,8 +15,8 @@ azure-mgmt-core==1.5.0
 azure-mgmt-resource==23.2.0
 backoff==2.2.1
 beautifulsoup4==4.12.3
-boto3==1.35.65
-botocore==1.35.65
+boto3==1.35.76
+botocore==1.35.76
 brotli==1.1.0
 cached-property==2.0.1
 cachetools==5.5.0
@@ -30,7 +30,7 @@ cherrypy==18.10.0
 click==8.1.7
 click-option-group==0.5.6
 cloudsplaining==0.7.0
-cryptography==43.0.3
+cryptography==44.0.0
 deepdiff==8.0.1
 defusedxml==0.7.1
 deprecated==1.2.15
@@ -46,7 +46,7 @@ flexparser==0.4
 frozendict==2.4.6
 frozenlist==1.5.0
 google-api-core==2.23.0
-google-api-python-client==2.153.0
+google-api-python-client==2.154.0
 google-auth==2.36.0
 google-auth-httplib2==0.2.0
 googleapis-common-protos==1.66.0
@@ -79,32 +79,32 @@ oauth2client==4.1.3
 oauthlib==3.2.2
 onelogin==2.0.4
 orderly-set==5.2.2
-orjson==3.10.11
+orjson==3.10.12
 packaging==24.2
 parsy==2.1
 pint==0.24.4
 plantuml==0.3.0
 platformdirs==4.3.6
-policy-sentry==0.13.1
+policy-sentry==0.13.2
 portalocker==2.10.1
 portend==3.2.0
-posthog==3.7.2
-prometheus-client==0.21.0
+posthog==3.7.4
+prometheus-client==0.21.1
 prompt-toolkit==3.0.48
-propcache==0.2.0
+propcache==0.2.1
 proto-plus==1.25.0
-protobuf==5.28.3
+protobuf==5.29.1
 psutil==6.1.0
 pyasn1==0.6.1
 pyasn1-modules==0.4.1
-pycares==4.4.0
+pycares==4.5.0
 pycparser==2.22
 pygithub==2.5.0
 pygments==2.18.0
-pyjwt[crypto]==2.10.0
+pyjwt[crypto]==2.10.1
 pynacl==1.5.0
 pyparsing==3.2.0
-python-arango==8.1.2
+python-arango==8.1.3
 python-dateutil==2.9.0.post0
 pytz==2024.1
 pyyaml==6.0.2
@@ -115,11 +115,11 @@ retrying==1.3.4
 rfc3339-validator==0.1.4
 rich==13.9.4
 rsa==4.9
-s3transfer==0.10.3
+s3transfer==0.10.4
 schema==0.7.7
-setuptools==75.5.0
-six==1.16.0
-slack-sdk==3.33.4
+setuptools==75.6.0
+six==1.17.0
+slack-sdk==3.33.5
 soupsieve==2.6
 sqlalchemy==1.4.54
 tempora==5.7.0
@@ -136,7 +136,7 @@ urllib3==1.26.20
 ustache==0.1.6
 wcwidth==0.2.13
 websocket-client==1.8.0
-wrapt==1.16.0
-yarl==1.17.2
+wrapt==1.17.0
+yarl==1.18.3
 zc-lockfile==3.0.post1
 zipp==3.21.0
```

#### Recent Merged Pull Requests:
- **PR #2326** (closed): Bump setuptools from 75.8.0 to 78.1.1 in the pip group across 1 directory (@dependabot[bot])
- **PR #2322** (2025-03-28): [fix][fix] Update license to match Trove classifier (@lloesche)
- **PR #2321** (2025-03-28): Fix some AGPL references that were left after returning to Apache2  (@monoman)
- **PR #2319** (2025-03-10): [fix][fix] Update Discord server invitation links (@aquamatthias)
- **PR #2317** (2025-02-20): [style] Use `is` to compare types (@vil02)
- **PR #2316** (2025-02-14): Update License to Apache 2.0 and bump 4.3 (@lloesche)
- **PR #2315** (2025-02-15): Bump the pip group across 1 directory with 2 updates (@dependabot[bot])
- **PR #2314** (2025-02-06): [style] Do not use `is` to compare literals (@vil02)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
