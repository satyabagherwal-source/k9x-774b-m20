# Forensic Learning Record (Deep Inspection): someengineering/fixinventory

> **Canonical Artifact**: `07_PROJECT_LEARNING/someengineering-fixinventory-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/someengineering/fixinventory](https://github.com/someengineering/fixinventory))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:40:57.364Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `someengineering/fixinventory`
- **Description**: Fix Inventory helps you identify and remove the most critical risks in AWS, GCP, Azure and Kubernetes.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2079 stars

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
 
 - **Deploy anywhere:** Fix Inventory can be deployed on your laptop or in the cloud, and we
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

Signed-off-by: dependabot[bot] <support@github.com>
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
 sqlalc
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
+        "idle_s
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
