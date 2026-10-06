# Forensic Learning Record (Deep Inspection): Zipstack/unstract

> **Canonical Artifact**: `07_PROJECT_LEARNING/zipstack-unstract-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Zipstack/unstract](https://github.com/Zipstack/unstract))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:24:26.824Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Zipstack/unstract`
- **Description**: LLM-Driven Extraction of Unstructured Data — Built for API Deployments & ETL Pipeline Workflows
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 7270 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/api_v2/utils.py`
```
import logging

from django.core.exceptions import ValidationError
from workflow_manager.workflow_v2.models.execution import WorkflowExecution

from api_v2.models import APIDeployment
from api_v2.notification import APINotification

logger = logging.getLogger(__name__)


class APIDeploymentUtils:
    @staticmethod
    def get_api_by_id(api_id: str) -> APIDeployment | None:
        """Retrieves an APIDeployment instance by its unique ID.

        Args:
            api_id (str): The unique identifier of the APIDeployment to retrieve.

        Returns:
            Optional[APIDeployment]: The APIDeployment instance if found,
                otherwise None.

        A malformed identifier is "not found", not a fault: ``pk`` is a UUID
        column, so a non-UUID string raises ``ValidationError`` out of
        ``to_python`` rather than ``DoesNotExist``. Callers reach this with
        unvalidated caller input (path segments are ``<str:>``, and request
        bodies are read before the serializer runs), so letting that escape
        turns ordinary client garbage into a 500.
        """
        try:
            api_deployment: APIDeployment = APIDeployment.objects.get(pk=api_id)
            return api_deployment
        except APIDeployment.DoesNotExist:
            return None
        except ValidationError:
            # Logged so a malformed identifier stays distinguishable from an
            # absent row: both answer 404, and without this the difference is
            # invisible when triaging.
            logger.debug("Malformed API deployment identifier: %s", api_id)
            return None

    @staticmethod
    def send_notification(
        api: APIDeployment, workflow_execution: WorkflowExecution
    ) -> None:
        """Sends a notification for the specified API deployment and workflow
        execution.

        Args:
            api (APIDeployment): The APIDeployment instance for which the
                notification is being sent.
            workflow_execution (WorkflowExecution): The WorkflowExecution instance
                related to the notification.

        Returns:
            None
        """
        api_notification = APINotification(api=api, workflow_execution=workflow_execution)
        api_notification.send()

```

### Core Architecture Module: `backend/notification_v2/clubbed_renderer.py`
```
"""Backend dispatch entry for clubbed-notification rendering.

Delegates the canonical envelope + Slack body to
``unstract.core.notification_clubbed_renderer`` so backend and worker
callbacks emit byte-identical receiver-visible payloads. This thin shim
keeps the ``render_clubbed_message`` platform dispatcher (uses
``PlatformType`` enum) backend-side; everything else lives in the shared
module.
"""

from __future__ import annotations

import logging
from typing import Any

from notification_v2.enums import PlatformType
from unstract.core.notification_clubbed_renderer import (
    MAX_BATCH_SIZE,
    build_envelope,
    render_slack_text,
)

logger = logging.getLogger(__name__)

# build_envelope is imported for internal use below; it is intentionally not
# re-exported — callers import it straight from unstract.core.
__all__ = ["MAX_BATCH_SIZE", "render_clubbed_message"]


def _render_for_slack(envelope: dict[str, Any]) -> dict[str, Any]:
    """Wrap the rendered Slack mrkdwn body in the dict shape Slack expects."""
    return {"text": render_slack_text(envelope)}


def render_clubbed_message(
    payloads: list[dict[str, Any]],
    platform: str,
) -> dict[str, Any]:
    """Top-level entry — returns the dispatch body for ``platform``.

    Used by every dispatch site so the receiver-visible payload is
    identical regardless of caller.
    """
    envelope = build_envelope(payloads)
    if platform == PlatformType.SLACK.value:
        return _render_for_slack(envelope)
    if platform == PlatformType.API.value:
        return envelope
    # Unknown platform — fall back to the raw envelope and warn so misrouted
    # rows don't drop silently.
    logger.warning(
        "Unknown platform %s for clubbed dispatch; returning raw envelope",
        platform,
    )
    return envelope

```

### Core Architecture Module: `backend/pg_queue/apps.py`
```
from django.apps import AppConfig


class PgQueueConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "pg_queue"
    verbose_name = "PG Queue"

```

### Core Architecture Module: `backend/pg_queue/executor_rpc.py`
```
"""Executor-RPC for the PG path — backend (Django) transport adapter.

The reply_key/timeout orchestration lives ONCE in
``unstract.workflow_execution.executor_rpc`` (shared with the workers). This module
is the thin Django half: a :class:`DjangoQueueTransport` that enqueues via the ORM
(``enqueue_task``) and polls ``PgTaskResult``, plus the :func:`get_executor_dispatcher`
factory that wires them together.

Since UN-4046 the factory returns the PG dispatcher unconditionally: there is no
gate, no routing dispatcher and no Celery fall-through, so a ``pg_task_result``
row is written on every request-reply dispatch.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from django.db import close_old_connections

from pg_queue.models import PgTaskResult
from pg_queue.producer import enqueue_task
from unstract.core.polling import poll_for_row
from unstract.workflow_execution.executor_rpc import (
    EXECUTE_TASK,
    ExecResultRow,
    PgExecutionDispatcher,
    QueueTransport,
)

if TYPE_CHECKING:
    from unstract.core.data_models import ContinuationSpec
    from unstract.sdk1.execution.context import ExecutionContext

logger = logging.getLogger(__name__)

# Re-exported so existing ``from pg_queue.executor_rpc import …`` imports keep working.
__all__ = [
    "DjangoQueueTransport",
    "PgExecutionDispatcher",
    "get_executor_dispatcher",
]


class DjangoQueueTransport(QueueTransport):
    """:class:`QueueTransport` over the Django ORM (the backend half).

    Inherits the Protocol so a type-checker verifies this implementation against the
    seam independently of the ``PgExecutionDispatcher(...)`` construction site.
    """

    def enqueue(
        self,
        *,
        queue: str,
        context: ExecutionContext,
        org_id: str,
        reply_key: str | None = None,
        on_success: ContinuationSpec | None = None,
        on_error: ContinuationSpec | None = None,
        task_id: str | None = None,
    ) -> None:
        enqueue_task(
            task_name=EXECUTE_TASK,
            queue=queue,
            args=[context.to_dict()],
            org_id=org_id,
            reply_key=reply_key,
            on_success=on_success,
            on_error=on_error,
            task_id=task_id,
        )

    def wait_for_result(self, reply_key: str, timeout: float) -> ExecResultRow | None:
        """Poll ``pg_task_result`` until the row appears or *timeout* elapses.

        Uses the shared :func:`poll_for_row` backoff skeleton, releasing the DB
        connection between polls (``close_old_connections``) so a long-running RPC
        does not pin a backend connection and exhaust the pool. Each poll is its own
        autocommit query, so a row committed by the executor consumer becomes visible
        — **dispatch must NOT be called inside an open transaction**
        (``transaction.atomic`` / ``ATOMIC_REQUESTS`` would pin one snapshot and never
        see the new row).
        """

        def _fetch() -> ExecResultRow | None:
            row = PgTaskResult.objects.filter(pk=reply_key).first()
            if row is None:
                return None
            return ExecResultRow(status=row.status, result=row.result, error=row.error)

        row = poll_for_row(_fetch, timeout, between_polls=close_old_connections)
        if row is not None:
            # Reply consumed: clear the payload (result + error) so PII doesn't sit
            # in pg_task_result for the full retention TTL — mirrors the workers
            # transport's PgResultBackend.forget so both dispatch paths behave alike.
            # Best-effort: runs after the caller holds the result, inside
            # PgExecutionDispatcher.dispatch's never-raises guard, so a cleanup miss
            # must not fail a good RPC; the reaper's retention sweep is the backstop.
            try:
                PgTaskResult.objects.filter(pk=reply_key).update(result=None, error="")
            except Exception:
                logger.warning(
                    "DjangoQueueTransport: could not clear pg_task_result for "
                    "reply_key=%s after consume; the retention sweep will flush it",
                    reply_key,
                    exc_info=True,
                )
        return row


def get_executor_dispatcher() -> PgExecutionDispatcher:
    """Factory: the executor dispatcher.

    Takes no arguments. It used to accept a ``celery_app`` that fed the Celery
    branch of the routing dispatcher; that branch went with the ``pg_queue_enabled``
    flag (UN-4046), and the parameter was kept for a while so the call sites did not
    all need editing at once. Keeping an ignored parameter made the signature
    decoration rather than a contract — and it read as "this dispatcher may use
    Celery", which is exactly the belief that left a ``headers=`` argument at three
    call sites and broke every extraction. Removed.
    """
    return PgExecutionDispatcher(DjangoQueueTransport())

```

### Core Architecture Module: `backend/pg_queue/management/commands/converge_pg_scheduler.py`
```
"""Converge schedule ownership to the state ``PG_SCHEDULER_ENABLED`` declares.

One idempotent entry point, **both directions**:

    PG_SCHEDULER_ENABLED=true   → adopt   (PG fires; Beat rows disabled)
    PG_SCHEDULER_ENABLED=false  → release (Beat fires; pg_owned cleared)

Why one converging command rather than an adopt command and a release command: the
reverse direction is the one that matters under pressure, and a rollback nobody can
run is not a rollback. Splitting it left the reverse as a *procedure* — remember the
command, remember the flags, remember to run it in every environment. Here the env
var declares intent and the deploy makes the database match, so reverting is a values
change like any other, and re-running changes nothing once converged.

**Safe to run unattended**, which is what lets ``entrypoint.sh`` call it on every
start:

* Both directions are idempotent in OUTCOME — ``_set_ownership`` skips periodic rows
  already in the target state. The pipeline path is idempotent but **not** free: it
  rewrites ``pg_periodic_schedule`` and the Beat ``PeriodicTask`` row and bumps
  ``PeriodicTasks.update_changed()`` for every schedule on every call, whether or not
  ownership changed — so a backend start costs 2N row writes and N Beat reloads. Safe
  to repeat, not a no-op; an earlier version of this line claimed the latter.
* Neither direction invents state. Beat's ``PeriodicTask`` rows are only ever
  *disabled* and *re-enabled*, never created or deleted, and the value written on
  release is the one recorded before adoption (``pg_periodic_task.enabled``, and the
  pipeline's own ``active``) — so a schedule an operator had switched off stays off
  through a full adopt→release cycle.
* Adoption is not unilateral: it happens only because someone set the env var.

**What it cannot do, and you must:** converging to Beat restores *ownership*, not
*capacity*. Beat publishes to RabbitMQ, so a released schedule only fires again if
``workerSchedulerV2`` (and ``workerMetrics`` for the periodics) are running. Flip
those back in the SAME change that sets ``PG_SCHEDULER_ENABLED=false`` — otherwise
you have simply moved the outage. The release path logs a warning saying so.

Periodics (``dashboard_metrics.*``) are opt-in via ``--periodics``: pipelines and
metrics are separate rollout decisions, and metrics have their own consumer
(``workerPgMetrics``) that has to be deployed before they can be adopted.
"""

from typing import Any

from django.core.management import call_command
from django.core.management.base import BaseCommand
from scheduler.ownership import pg_scheduler_enabled


class Command(BaseCommand):
    help = (
        "Converge schedule ownership to what PG_SCHEDULER_ENABLED declares: adopt to "
        "the PG scheduler when on, release back to Celery Beat when off. Idempotent "
        "in both directions and safe to run on every deploy."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing.",
        )
        parser.add_argument(
            "--periodics",
            action="store_true",
            help=(
                "Also converge the non-pipeline periodics (dashboard_metrics.*). "
                "Off by default: adopting them requires workerPgMetrics to be "
                "deployed, so it is a separate rollout decision from pipelines."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        dry_run = options["dry_run"]
        periodics = options["periodics"]
        target_pg = pg_scheduler_enabled()

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"Converging schedule ownership → "
                f"{'PG scheduler' if target_pg else 'Celery Beat'} "
                f"(PG_SCHEDULER_ENABLED={'true' if target_pg else 'false'})"
            )
        )

        if target_pg:
            # Mirrors are backfilled first: a pipeline with no mirror row cannot be
            # owned, and reconcile reports it as still-on-Beat rather than adopting it.
            call_command("reconcile_pg_schedules", dry_run=dry_run)
            if periodics:
                # An empty name list means "every mirrored row" (the flag is
                # `nargs="*"`, and the command distinguishes absent from empty).
                # mirror_pg_periodic_tasks always backfills before flipping
                # ownership, so this one call covers both halves.
                call_command("mirror_pg_periodic_tasks", adopt=[], dry_run=dry_run)
        else:
            # --mirror-only keeps the backfill (inert at any flag state) while
            # --release-stale hands back anything still marked pg_owned. Together
            # they are the pipeline rollback.
            call_command(
                "reconcile_pg_schedules",
                mirror_only=True,
                release_stale=True,
                dry_run=dry_run,
            )
            if periodics:
                call_command("mirror_pg_periodic_tasks", release=[], dry_run=dry_run)
            self.stdout.write(
                self.style.WARNING(
                    "Released to Beat. Beat publishes over RabbitMQ — these schedules "
                    "fire again ONLY if workerSchedulerV2 (and workerMetrics, with "
                    "--periodics) are running. Check that before relying on this."
                )
            )

        self.stdout.write(self.style.SUCCESS("Convergence complete."))

```

### Core Architecture Module: `backend/pg_queue/management/commands/mirror_pg_periodic_tasks.py`
```
"""Mirror non-pipeline Beat periodics into ``pg_periodic_task``, and hand them over.

The Beat-replacement half for everything that is not a scheduled pipeline
(UN-3796): ``dashboard_metrics.*``, log-history, audit, and anything an operator
has added. Pipeline schedules keep their own mirror and their own percentage ramp
(``reconcile_pg_schedules``); this command deliberately skips them.

Two steps, deliberately separate:

* **mirror** (default) — upsert a ``PgPeriodicTask`` row for every non-pipeline
  ``PeriodicTask``. Purely additive and inert: rows land ``pg_owned=False``, so the
  PG scheduler still fires nothing and Beat keeps firing everything.
* **adopt / release** (explicit flags) — the actual hand-over. ``--adopt`` flips
  ``pg_owned=True`` **and** disables the matching Beat ``PeriodicTask``, in one
  transaction. ``--release`` reverses it. Doing both halves atomically is the whole
  point: a row that is ``pg_owned`` while Beat still has it enabled fires **twice**,
  which for ``cleanup_*`` means two concurrent deletes and for ``aggregate_*`` means
  double-counted metrics.

Idempotent and safe to re-run. Mirroring changes no behaviour on its own; only
``--adopt`` does, and only for the rows it names.

Unlike the pipeline ramp there is no percentage: these are a handful of global
singletons, and the acceptance gate (Celery scaled to zero) needs all of them on PG,
so the meaningful states are "all Beat" and "all PG" with a per-name escape hatch.
"""

import json
import logging
from typing import Any, NamedTuple

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django_celery_beat.models import IntervalSchedule, PeriodicTask, PeriodicTasks

from pg_queue.models import PgPeriodicTask

logger = logging.getLogger(__name__)

# Rows per DB round trip. Matches the batch size the repo's other bounded loops use
# (e.g. workflow_v2 migration 0012's "delete in batches to avoid long-running
# transactions"). Overridable with --batch-size.
DEFAULT_BATCH_SIZE = 1000

# Task paths this command must NOT mirror.
#
# Pipeline triggers own a separate mirror (pg_periodic_schedule) and a separate
# percentage ramp; mirroring one here too would give it two owners. BOTH known task
# paths are listed even though ``SchedulerHelper._schedule_task_job`` only writes the
# first today: a real Beat table was found carrying a legacy ``execute_pipeline_task_v2``
# row, and it is only excluded here by luck of being disabled. Matching on the task
# path rather than a name convention keeps that from depending on luck.
#
# ``celery.backend_cleanup`` is Celery's own built-in: it prunes the Celery RESULT
# BACKEND. It is meaningless on PG (nothing there registers it, and the backend it
# cleans stops existing once Celery is off), so it stays with Beat and simply retires
# alongside it.
_EXCLUDED_TASK_PATHS = frozenset(
    {
        "scheduler.tasks.execute_pipeline_task",
        "execute_pipeline_task_v2",
        "celery.backend_cleanup",
    }
)


def cron_from_periodic_task(task: PeriodicTask) -> str:
    """Best-effort 5-field cron for a Beat periodic, or "" if not expressible.

    Beat schedules a task by ``crontab``, ``interval``, ``solar`` or ``clocked``.
    Only the first two are in use here, and only they map onto cron:

    * ``crontab`` — a direct field-for-field reconstruction.
    * ``interval`` — expressed as a step cron ONLY where one exists exactly.

    Returns ``""`` for anything else — notably **second**-resolution intervals,
    which have no cron expression at all. Coarsening one to a minute would silently
    change how often it runs, so the caller skips those and says so rather than
    guessing.

    **``*/N`` is not "every N".** A step cron restarts at each field boundary, so it
    is faithful only when N divides the field's range exactly. Otherwise the last
    step of one period runs into the first of the next and the task fires early —
    silently, and only at the boundary, which is the hardest kind of drift to spot:

    * ``*/7`` minutes → :00 :07 … :56, then **:00** — a 4-minute gap, not 7.
    * ``*/45`` minutes → :00 :45, then **:00** — fires roughly twice as often.
    * ``0 */5`` hours → 0 5 10 15 20, then **0** — a 4-hour gap, not 5.

    So minutes need ``60 % every == 0`` and hours ``24 % every == 0``, not merely a
    range check.

    **Days are worse and are refused beyond 1.** ``*/N`` on day-of-month restarts
    every month, and months are 28-31 days, so the gap at the boundary varies by
    month and even by year: ``0 0 */7 * *`` fires on the 1st, 8th, 15th, 22nd, 29th
    and then the 1st again — 2 to 4 days later depending on the month. There is no
    correct cron for "every N days" at N > 1, so only ``every == 1`` maps (to a
    plain daily), and the rest fall through to the caller's skip-and-explain path.

    An earlier version range-checked (``every < 60`` / ``< 24`` / ``< 32``) while
    the docstring claimed exactness, so an "every 45 minutes" periodic mirrored to
    something that fires twice as often. Nothing in integration hit it (15 divides
    60), but Beat schedules are per-environment DB rows that exist in no source
    file, so staging or production can carry one.
    """
    if task.crontab is not None:
        c = task.crontab
        return f"{c.minute} {c.hour} {c.day_of_month} {c.month_of_year} {c.day_of_week}"
    interval = task.interval
    if interval is None:
        return ""
    every = interval.every
    if every < 1:
        return ""
    if interval.period == IntervalSchedule.MINUTES and every < 60 and 60 % every == 0:
        return f"*/{every} * * * *"
    if interval.period == IntervalSchedule.HOURS and every < 24 and 24 % every == 0:
        return f"0 */{every} * * *"
    if interval.period == IntervalSchedule.DAYS and every == 1:
        return "0 0 * * *"
    # SECONDS, a step that does not divide its field, or anything else.
    return ""


def _decode(raw: str | None, fallback: Any) -> Any:
    """Beat stores args/kwargs as JSON text; decode once here so a malformed value
    fails at mirror time (visible, fixable) instead of at fire time (a periodic
    that silently stops running).
    """
    if not raw:
        return fallback
    return json.loads(raw)


class MirrorPlan(NamedTuple):
    """What to do with one Beat periodic: mirror it, or skip it and say why.

    Every decision this command makes lives here rather than inside the loop that
    talks to the database, so the rules can be tested against plain stand-ins
    instead of a live multi-tenant schema. The command becomes glue: plan, then
    apply.
    """

    name: str
    fields: dict[str, Any] | None  # None => skip
    skip_reason: str | None = None

    @property
    def should_mirror(self) -> bool:
        return self.fields is not None


def plan_mirror(task: Any) -> MirrorPlan:
    """Decide whether one Beat periodic can be mirrored, and with what fields.

    Accepts anything exposing the ``PeriodicTask`` attributes used here, so the
    rules are testable without the ORM.
    """
    if task.task in _EXCLUDED_TASK_PATHS:
        return MirrorPlan(
            task.name,
            None,
            f"{task.task} is owned elsewhere (pipeline mirror or Celery-internal)",
        )
    cron = cron_from_periodic_task(task)
    if not cron:
        return MirrorPlan(
            task.name,
            None,
            "schedule has no cron equivalent (second-resolution interval, solar "
            "or clocked) — it must stay on Beat or move to a different mechanism",
        )
    try:
        task_args = _decode(task.args, [])
        task_kwargs = _decode(task.kwargs, {})
    except ValueError as exc:
        return MirrorPlan(task.name, None, f"malformed args/kwargs JSON ({exc})")
    return MirrorPlan(
        task.name,
        {
            "task_name": task.task,
            # Beat falls back to the default queue when unset; mirror the same
            # fallback so the row targets where Beat would have.
            "queue": task.queue or "celery",
            "task_args": task_args,
            "task_kwargs": task_kwargs,
            "cron_string": cron,
            "enabled": task.enabled,
        },
    )


class Command(BaseCommand):
    help = (
        "Mirror non-pipeline Beat periodics into pg_periodic_task. Additive and "
        "inert by default; --adopt hands rows over to PG (and disables them in "
        "Beat) atomically, --release reverses it."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing.",
        )
        parser.add_argument(
            "--adopt",
            nargs="*",
            metavar="NAME",
            help=(
                "Hand rows over to PG: set pg_owned=True and DISABLE the matching "
                "Beat PeriodicTask, atomically. Pass names to adopt those only, or "
                "no names to adopt every mirrored row."
            ),
        )
        parser.add_argument(
            "--release",
            nargs="*",
            metavar="NAME",
            help="Reverse of --adopt: pg_owned=False and re-enable the Beat task.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=DEFAULT_BATCH_SIZE,
            metavar="N",
            help=(
                f"Rows fetched per DB round trip (default {DEFAULT_BATCH_SIZE}). "
                "Bounds memory on a large Beat table."
            ),
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            metavar="N",
            help=(
                "Stop after mirroring N rows (0 = no limit). A safety valve for a "
                "first cautious run, NOT a resume cursor: the scan always starts "
                "from the be
```

### Core Architecture Module: `backend/pg_queue/management/commands/reconcile_pg_schedules.py`
```
"""Backfill the pg_periodic_schedule mirror + reconcile Beat/PG schedule
ownership.

Run this:
- **once** after deploying the mirror, to backfill rows for schedules created
  before the mirror existed (the dual-write only covers schedules touched since);
- **after each Flipt ramp change** to ``pg_scheduler_enabled``, to apply the new
  percentage — flipping ``pg_owned`` and the matching Beat ``PeriodicTask`` for
  every schedule (the create/update path only reconciles the schedule it edits).

It is idempotent and safe to run anytime: with the rollout off it leaves every
schedule on Beat. Could later be driven periodically (e.g. by the orchestrator);
kept a command here so the ramp stays an explicit, auditable ops action.
"""

import json
from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django_celery_beat.models import CrontabSchedule, PeriodicTask
from scheduler.ownership import (
    pg_scheduler_enabled,
    reconcile_ownership_for,
    resolve_schedule_owner,
)
from scheduler.tasks import mirror_periodic_schedule_upsert

from pg_queue.models import PgPeriodicSchedule

# Rows per DB round trip; mirrors mirror_pg_periodic_tasks.DEFAULT_BATCH_SIZE and the
# batch size used by the repo's other bounded loops (workflow_v2 migration 0012).
DEFAULT_BATCH_SIZE = 1000

# Only the pipeline-trigger PeriodicTasks are scheduled pipelines (other periodic
# tasks — metrics, audit — are not mirrored).
_PIPELINE_TASK_PATH = "scheduler.tasks.execute_pipeline_task"


def _cron_from_crontab(crontab: CrontabSchedule | None) -> str:
    """Reconstruct the 5-field cron string from a CrontabSchedule row."""
    if crontab is None:
        return ""
    return (
        f"{crontab.minute} {crontab.hour} {crontab.day_of_month} "
        f"{crontab.month_of_year} {crontab.day_of_week}"
    )


class Command(BaseCommand):
    help = (
        "Backfill pg_periodic_schedule mirrors for pre-existing schedules and "
        "reconcile Beat/PG ownership against the current pg_scheduler_enabled "
        "rollout. Idempotent; with the rollout off, leaves everything on Beat."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=DEFAULT_BATCH_SIZE,
            metavar="N",
            help=(
                f"Rows fetched per DB round trip (default {DEFAULT_BATCH_SIZE}). "
                "There is one row per scheduled pipeline, so this bounds memory on "
                "a large installation."
            ),
        )
        parser.add_argument(
            "--mirror-only",
            action="store_true",
            help=(
                "Backfill missing mirror rows and skip the ownership reconcile. "
                "Purely additive: touches only pg_periodic_schedule, never a Beat "
                "PeriodicTask. This is the mode automation runs ONLY on the release path (converge_pg_scheduler with PG_SCHEDULER_ENABLED=false); the adopt path runs the full reconcile — see handle()."
            ),
        )
        parser.add_argument(
            "--release-stale",
            action="store_true",
            help=(
                "Release schedules marked pg_owned while PG_SCHEDULER_ENABLED is "
                "off, handing them back to Beat. Safe for unattended automation at "
                "any flag state: with the gate ON it is a no-op, and with it off it "
                "only ever moves a schedule TO Beat — the fail-safe direction. "
                "Composes with --mirror-only."
            ),
        )

    def handle(self, *args: Any, **options: Any) -> None:
        dry_run = options["dry_run"]
        batch_size = options["batch_size"]
        mirror_only = options["mirror_only"]
        if batch_size < 1:
            raise CommandError("--batch-size must be >= 1")
        backfilled = self._backfill_mirrors(dry_run, batch_size)

        # --mirror-only exists because it is safe to run at ANY flag state: backfilling
        # is inert, while the reconcile below — fail-closed when the rollout is off —
        # flips ownership *and disables the matching Beat PeriodicTask* when it is on.
        #
        # It is NO LONGER what the deploy-time automation runs. entrypoint.sh invokes
        # converge_pg_scheduler on every backend start, without --mirror-only, so
        # ownership hand-over IS an unattended action now; the env var is the operator's
        # consent, given once, rather than a command typed per environment. That is
        # deliberate — it is what makes rollback a values change — but it means this
        # path's caller is no longer the only way ownership moves. A previous version of
        # this comment ended "ownership stays an operator action", which stopped being
        # true when the entrypoint switched commands.
        if mirror_only:
            reconciled, pg_owned, failed = 0, 0, 0
        else:
            reconciled, pg_owned, failed = self._reconcile_all(dry_run, batch_size)

        released = 0
        if options["release_stale"]:
            released, release_failed = self._release_stale(dry_run, batch_size)
            failed += release_failed

        prefix = "[dry-run] " if dry_run else ""
        summary = (
            f"{prefix}backfilled={backfilled} reconciled={reconciled} "
            f"pg_owned={pg_owned} released={released} failed={failed}"
        )
        if mirror_only:
            summary = f"{summary} (mirror-only: ownership reconcile skipped)"
        if failed:
            # Surface failures where the operator looks (and to automation).
            self.stderr.write(self.style.ERROR(summary))
            raise CommandError(f"{failed} schedule(s) failed to reconcile")
        self.stdout.write(self.style.SUCCESS(summary))

    def _mirror_fields_from_args(self, pt: Any, pipeline_id: str) -> dict | None:
        """Extract the mirror fields from PeriodicTask.args, or None (logged) for a
        malformed/non-array row — a bad row must not abort the whole command.
        """
        try:
            # json.JSONDecodeError is a ValueError subclass, so one except covers
            # both the parse error and the non-array guard below.
            task_args = json.loads(pt.args or "[]")
            if not isinstance(task_args, list):
                raise ValueError(f"expected JSON array, got {type(task_args).__name__}")
        except ValueError as exc:
            self.stderr.write(
                self.style.ERROR(
                    f"skipping pipeline {pipeline_id}: bad PeriodicTask.args ({exc})"
                )
            )
            return None
        return {
            "workflow_id": task_args[0] if len(task_args) > 0 else None,
            "organization_id": (task_args[1] if len(task_args) > 1 else "") or "",
            # args[6] is the synthetic "Pipeline job-<id>" label; the real name
            # self-heals via the dual-write on the next schedule edit.
            "pipeline_name": task_args[6] if len(task_args) > 6 else "",
        }

    def _backfill_mirrors(self, dry_run: bool, batch_size: int) -> int:
        """Create a mirror row for every pipeline-trigger PeriodicTask lacking one.

        Both reads are bounded: the already-mirrored ids stream in via ``iterator``
        rather than materialising the whole table as a Python set, and the
        PeriodicTask scan is chunked. There is one row per scheduled pipeline, so on
        a large installation the unbounded version held the entire pipeline
        population in memory twice.
        """
        # Still one query, still an id set (the membership test below needs it), but
        # streamed and values-only — flat ids, never model instances.
        mirrored = {
            str(pk)
            for pk in PgPeriodicSchedule.objects.values_list(
                "pipeline_id", flat=True
            ).iterator(chunk_size=batch_size)
        }
        backfilled = 0
        periodic_tasks = (
            PeriodicTask.objects.filter(task=_PIPELINE_TASK_PATH)
            .select_related("crontab")
            .order_by("pk")
        )
        for pt in periodic_tasks.iterator(chunk_size=batch_size):
            pipeline_id = pt.name  # = str(pipeline.pk)
            if pipeline_id in mirrored:
                continue
            fields = self._mirror_fields_from_args(pt, pipeline_id)
            if fields is None:
                continue
            self.stdout.write(
                f"backfill mirror for pipeline {pipeline_id} (enabled={pt.enabled})"
            )
            if not dry_run:
                mirror_periodic_schedule_upsert(
                    pipeline_id=pipeline_id,
                    cron_string=_cron_from_crontab(pt.crontab),
                    enabled=pt.enabled,
                    **fields,
                )
            backfilled += 1
        return backfilled

    def _release_stale(self, dry_run: bool, batch_size: int) -> tuple[int, int]:
        """Hand every stale pg_owned row back to Beat. Returns (released, failed).

        Scoped to ``pg_owned=True`` rows so a clean installation does no work at all,
        and gated on the env switch being OFF: with the ramp ON, a pg_owned row is
        legitimate and releasing it would silently undo the rollout.

        Unlike :meth:`_reconcile_all` this IS safe to run unattended, because its only
        possible effect is moving a schedule to Beat — the same direction the system
        already fails to. That is what lets the deploy run it; see entrypoint.sh.
        """
        if pg_scheduler_enabled():
            self.stdout.write(
                "--release-stale: PG_SCHEDULER_ENABLED is on; pg_owned rows are "
                "legitimate here, nothing released."
            )
            return 0, 0

        
```

### Core Architecture Module: `backend/pg_queue/migrations/0001_initial_squashed.py`
```
# Generated by Django 4.2.30 on 2026-07-15 12:31

import django.utils.timezone
from django.db import migrations, models


# Seed function ported from the squashed 0005_pgorchestratorlock: leader-election
# is a plain `UPDATE` keyed on `id = 1` (with a lease predicate) and has NO
# upsert/INSERT fallback, so the single lock row must pre-exist or every
# try_acquire returns False forever. get_or_create keeps it idempotent.
def seed_single_row(apps, schema_editor):
    lock_model = apps.get_model("pg_queue", "PgOrchestratorLock")
    lock_model.objects.get_or_create(id=1, defaults={"leader": ""})


def unseed_single_row(apps, schema_editor):
    lock_model = apps.get_model("pg_queue", "PgOrchestratorLock")
    lock_model.objects.filter(id=1).delete()


class Migration(migrations.Migration):
    replaces = [
        ("pg_queue", "0001_initial"),
        ("pg_queue", "0002_remove_pgqueuemessage_pg_queue_message_dequeue_idx_and_more"),
        ("pg_queue", "0003_pgqueuemessage_pg_queue_message_priority_range"),
        ("pg_queue", "0004_pgbarrierstate_and_more"),
        ("pg_queue", "0005_pgorchestratorlock"),
        ("pg_queue", "0006_pgbatchdedup_and_more"),
        ("pg_queue", "0007_pgbarrierstate_organization_id"),
        ("pg_queue", "0008_pgperiodicschedule"),
        (
            "pg_queue",
            "0009_remove_pgperiodicschedule_pg_periodic_schedule_due_idx_and_more",
        ),
        ("pg_queue", "0010_pgtaskresult"),
        ("pg_queue", "0011_pgbarrierstate_last_progress_at"),
        ("pg_queue", "0012_pgorchestrationclaim"),
        ("pg_queue", "0013_pgorchestrationclaim_organization_id"),
        ("pg_queue", "0014_remove_pgqueuemessage_pg_queue_message_dequeue_idx_and_more"),
    ]

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="PgQueueMessage",
            fields=[
                ("msg_id", models.BigAutoField(primary_key=True, serialize=False)),
                ("queue_name", models.TextField()),
                ("message", models.JSONField()),
                ("org_id", models.TextField(blank=True, default="")),
                ("enqueued_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("vt", models.DateTimeField(default=django.utils.timezone.now)),
                ("read_ct", models.IntegerField(default=0)),
                ("priority", models.SmallIntegerField(default=5)),
            ],
            options={
                "db_table": "pg_queue_message",
            },
        ),
        migrations.AddConstraint(
            model_name="pgqueuemessage",
            constraint=models.CheckConstraint(
                check=models.Q(("priority__gte", 1), ("priority__lte", 10)),
                name="pg_queue_message_priority_range",
            ),
        ),
        migrations.CreateModel(
            name="PgBarrierState",
            fields=[
                ("execution_id", models.TextField(primary_key=True, serialize=False)),
                ("remaining", models.IntegerField()),
                ("results", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("expires_at", models.DateTimeField()),
            ],
            options={
                "db_table": "pg_barrier_state",
                "indexes": [
                    models.Index(fields=["expires_at"], name="pg_barrier_expires_idx")
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="pgbarrierstate",
            constraint=models.CheckConstraint(
                check=models.Q(("expires_at__gt", models.F("created_at"))),
                name="pg_barrier_expires_after_created",
            ),
        ),
        migrations.CreateModel(
            name="PgOrchestratorLock",
            fields=[
                ("id", models.IntegerField(default=1, primary_key=True, serialize=False)),
                ("leader", models.TextField(blank=True, default="")),
                ("acquired_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "pg_orchestrator_lock",
            },
        ),
        migrations.AddConstraint(
            model_name="pgorchestratorlock",
            constraint=models.CheckConstraint(
                check=models.Q(("id", 1)), name="pg_orchestrator_lock_single_row"
            ),
        ),
        migrations.RunPython(
            code=seed_single_row,
            reverse_code=unseed_single_row,
        ),
        migrations.CreateModel(
            name="PgBatchDedup",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("execution_id", models.TextField()),
                ("batch_index", models.IntegerField()),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "pg_batch_dedup",
            },
        ),
        migrations.AddConstraint(
            model_name="pgbatchdedup",
            constraint=models.UniqueConstraint(
                fields=("execution_id", "batch_index"),
                name="pg_batch_dedup_exec_batch_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="pgbatchdedup",
            constraint=models.CheckConstraint(
                check=models.Q(("batch_index__gte", 0)),
                name="pg_batch_dedup_batch_index_non_negative",
            ),
        ),
        migrations.AddField(
            model_name="pgbarrierstate",
            name="organization_id",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.CreateModel(
            name="PgPeriodicSchedule",
            fields=[
                ("pipeline_id", models.UUIDField(primary_key=True, serialize=False)),
                ("organization_id", models.TextField(blank=True, default="")),
                ("workflow_id", models.UUIDField(blank=True, null=True)),
                ("pipeline_name", models.TextField(blank=True, default="")),
                ("cron_string", models.TextField()),
                ("enabled", models.BooleanField(default=True)),
                ("last_run_at", models.DateTimeField(blank=True, null=True)),
                ("next_run_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("pg_owned", models.BooleanField(default=False)),
            ],
            options={
                "db_table": "pg_periodic_schedule",
                "indexes": [
                    models.Index(
                        fields=["pg_owned", "enabled", "next_run_at"],
                        name="pg_periodic_schedule_due_idx",
                    )
                ],
            },
        ),
        migrations.CreateModel(
            name="PgTaskResult",
            fields=[
                ("task_id", models.TextField(primary_key=True, serialize=False)),
                ("status", models.TextField()),
                ("result", models.JSONField(blank=True, null=True)),
                ("error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("expires_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "db_table": "pg_task_result",
                "indexes": [
                    models.Index(fields=["expires_at"], name="pg_task_result_expires_idx")
                ],
            },
        ),
        migrations.AddField(
            model_name="pgbarrierstate",
            name="last_progress_at",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.CreateModel(
            name="PgOrchestrationClaim",
            fields=[
                ("execution_id", models.TextField(primary_key=True, serialize=False)),
                ("claimed_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("organization_id", models.TextField(blank=True, default="")),
            ],
            options={
                "db_table": "pg_orchestration_claim",
            },
        ),
        migrations.AddField(
            model_name="pgqueuemessage",
            name="state",
            field=models.TextField(default="ready"),
        ),
        # Django's AddField backfills every existing row to 'ready' then DROPs the
        # DB default (it manages defaults at the ORM layer). Re-add a DB-level
        # default so the schema is self-protecting: a raw INSERT that omits `state`
        # still lands a valid 'ready' row rather than a NOT-NULL violation.
        # (The ORM always sends state='ready' via the field default, so this guards
        # only raw SQL; insert_message_sql() also sets it explicitly — belt +
        # suspenders.) Metadata-only; touches no row data.
        migrations.RunSQL(
            sql="ALTER TABLE pg_queue_message ALTER COLUMN state SET DEFAULT 'ready'",
            reverse_sql="ALTER TABLE pg_queue_message ALTER COLUMN state DROP DEFAULT",
        ),
        # Deploy-safety backfill: the new claim keys off `state` and ignores `vt`,
        # but AddField set EVERY pre-existing row (including claimed-but-unacked
        # in-flight rows, which carry a future `vt`) to 'ready'. Without this, a
        # rolling deploy over a non-empty queue would make a still-processing
        # message instantly re-claimable → one-time double processing (absorbed by
```

### Core Architecture Module: `backend/pg_queue/migrations/0002_pgqueuemessage_available_at.py`
```
"""Delayed visibility for pg_queue_message (UN-3843).

Adds ``available_at`` + the ``scheduled`` state so a dispatch can defer delivery
(Celery ``countdown``/``eta`` parity). Additive and inert: existing rows and every
existing enqueue resolve to ``available_at = now()`` / ``state = 'ready'``, which is
exactly today's behaviour.

**Why the hand-written ``SET DEFAULT now()`` step.** Django's ``AddField`` adds the
column with a one-off literal default and then DROPS that default, leaving the column
``NOT NULL`` with no DB default. The workers' enqueue is raw SQL with an explicit
column list that does not mention ``available_at``
(``queue_backend/pg_queue/client.py``) — so without a persistent DB default, every
worker enqueue would fail with a not-null violation the moment this migration landed,
and would keep failing regardless of deploy order. The DB default also encodes the
right semantic on its own: a row that does not ask to be deferred is available now.

Ordering is therefore safe in both directions (migrate-before-workers or
workers-before-migrate), which is the posture the rest of the PG rollout assumes.
"""

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("pg_queue", "0001_initial_squashed"),
    ]

    operations = [
        # Widen the closed state enum BEFORE anything can write 'scheduled'.
        migrations.RemoveConstraint(
            model_name="pgqueuemessage",
            name="pg_queue_message_state_valid",
        ),
        migrations.AddField(
            model_name="pgqueuemessage",
            name="available_at",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        # Restore a PERSISTENT default so the workers' raw INSERT (which omits this
        # column) keeps working. Django dropped the AddField default above; state_
        # operations is empty because this changes only the DB, not the model Django
        # tracks — the model keeps its Python-level default and stays in sync.
        migrations.RunSQL(
            sql="ALTER TABLE pg_queue_message ALTER COLUMN available_at SET DEFAULT now()",
            reverse_sql=(
                "ALTER TABLE pg_queue_message ALTER COLUMN available_at DROP DEFAULT"
            ),
            state_operations=[],
        ),
        migrations.AddIndex(
            model_name="pgqueuemessage",
            index=models.Index(
                models.F("available_at"),
                condition=models.Q(("state", "scheduled")),
                name="pg_queue_message_scheduled_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="pgqueuemessage",
            constraint=models.CheckConstraint(
                check=models.Q(("state__in", ["ready", "claimed", "scheduled"])),
                name="pg_queue_message_state_valid",
            ),
        ),
    ]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2014** (2026-07-14): **fix: [ISSUE] Bundled qdrant server (v1.8.3) incompatible with qdrant-client 1.16, vector db test connection fails with 404 error**
  *Symptoms*: ## Describe the bug On a fresh setup (`./run-platform.sh`), adding the bundled Qdrant as a vector database during onboarding fails. "Test Connection" returns: "Error testing '<vector-db-name>'. Unexpected Response: 404 (Not Found)..."  ## To reproduce 1. Run `./run-platform.sh` and log in. 2. Onboarding >> Connect a Vector Database >> Qdrant. 3. Add Name of vector DB, URL: `http://unstract-vector-db:6333`, no API key. 4. Click Test Connection.  ## Expected behavior It should connect without any problem.  ## Environment details - Version v0.173.0 of unstarct - OS: Ubuntu  ## Screenshots  <img width="1077" height="458" alt="Image" src="https://github.com/user-attachments/assets/4dfe81b0-94f0-4074-b0bb-883b91c855dd" /> 
  **Post-Mortem & Fix Analysis**:
  > Root Cause:  The Python client and the bundled server are far apart in version. Backend logs: qdrant.py:67: UserWarning: Qdrant client version 1.16.2 is incompatible with server version 1.8.3. Major versions should match and minor version difference must not exceed 1. ... Error occured while testing adapter Unexpected Response: 404 (Not Found)   Network connectivity is fine (curl to the container returns the version JSON). The 1.16 client calls an API path the 1.8.3 server does not have, so it gets a 404   The two pins have drifted:   - `docker/docker-compose-dev-essentials.yaml` pins `qdrant/qdrant:v1.8.3`, last touched in #185 (Mar 2024)   - `unstract/sdk1/pyproject.toml` pins `qdrant-client>=1.16.0,<1.17.0`, bumped in #1845 (Mar 2026)  
  > Suggested fix: Bump the Qdrant server image to a 1.16.x tag to match the client. `v1.16.1` lines up with the installed client version. 
  > @amanattrish apologies for getting to this late and thanks for taking the time to raise this issue and a PR for it.  This was fixed in `v0.174.0` by #2046   <img width="2252" height="714" alt="Image" src="https://github.com/user-attachments/assets/a72c47bf-398c-47ee-8bdd-94d6a4d0c5ed" />

- **Issue #1972** (2026-06-09): **LlamaParse adapter: `url` field in json_schema.json doesn't match `base_url` config key, breaking EU region support**
  *Symptoms*: ## Bug Description The LlamaParse x2text adapter has a mismatch between the UI schema field name  and the config key used in the adapter code, causing the base URL to always  fall back to the hardcoded US endpoint regardless of what the user enters.  ## Files affected - `unstract/sdk1/src/unstract/sdk1/adapters/x2text/llama_parse/src/static/json_schema.json`   — defines the UI field as `"url"` - `unstract/sdk1/src/unstract/sdk1/adapters/x2text/llama_parse/src/constants.py`   — defines `BASE_URL = "base_url"` - `unstract/sdk1/src/unstract/sdk1/adapters/x2text/llama_parse/src/llama_parse.py`   — reads `self.config.get(LlamaParseConfig.BASE_URL)` which maps to `"base_url"`  ## Impact Users with EU region LlamaCloud accounts cannot use LlamaParse — their API key  is sent to `https://api.cloud.llamaindex.ai` (US) instead of  `https://api.cloud.eu.llamaindex.ai` (EU), resulting in a 401 Unauthorized error.  ## Fix In `json_schema.json`, rename the field from `"url"` to `"url"` → `"base_url"`:  ## Version latest

- **Issue #1775** (2026-02-26): **UN-3136 [FIX] Skip thinking config for Vertex AI pro models when disabled**
  *Symptoms*: ## What  - Skip thinking config for Vertex AI pro models when disabled  ## Why  - This was causing an issue with exiting vertexai adapters with any `pro` models because the thinking feature cannot be turned off for `pro` models  ## How  - The parameter `thinking_budget` was sent to the `litellm.completion()` by default when thinking config was not present. - - enable_thinking is missing → defaults to False   - Model has "pro" → is_pro_model = True   - No thinking config sent → avoids the error    ## Can this PR break any existing features. If yes, please list possible items. If no, please explain why. (PS: Admins do not merge the PR without this section filled)  - No, this cannot break any exisiting features because this is just a sinple change with how the adapters are created.  ## Database Migrations  - N/A  ## Env Config  - N/A  ## Relevant Docs  - N/A  ## Related Issues or PRs  -   ## Dependencies Versions  - Updated tool versions  ## Notes on Testing  - Tested with existing pro model adapters once the fix was implemented.  ## Screenshots  ## Checklist  I have read and understood the [Contribution Guidelines](https://docs.unstract.com/unstract/contributing/unstract/). 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Pro  **Cache: Disabled due to Reviews > Disable Cache setting**  **Knowledge base: Disabled due to `Reviews -> Disable Knowledge Base` setting**  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 59a76adcc1086d1bbe1fe048b0e2c41526d826e6 and 7c8b8a4e413a48004a0d13e956e41caa27e26e31.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `backend/sample.env`  </details>  <details> <summary>🚧 Files skipped from review as they are similar to previous changes (1)</summary>  * backend/sample.env  </details>  </details>  ---   <!-- walkthrough_start -->  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRab
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=Zipstack_unstract&pullRequest=1775) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=Zipstack_unstract&pullRequest=1775&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=Zipstack_unstract&pullRequest=1775&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=Zipstack_unstract&pullRequest=1775&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true) 
  > # Test Results  <details open> <summary><b>Summary</b></summary>  - ✅ **Runner Tests**: 11 passed, 0 failed (11 total) - ✅ **SDK1 Tests**: 63 passed, 0 failed (63 total)  </details>  ---  <details> <summary><b>Runner Tests - Full Report</b></summary>  |                     filepath                      |                  function                   | $$\textcolor{#23d18b}{\tt{passed}}$$ | SUBTOTAL | | ------------------------------------------------- | ------------------------------------------- | --------------------------------: | -------: | | $$\textcolor{#23d18b}{\tt{runner/src/unstract/runner/clients/test\\_docker.py}}$$ | $$\textcolor{#23d18b}{\tt{test\\_logs}}$$   |   $$\textcolor{#23d18b}{\tt{1}}$$ | $$\textcolor{#23d18b}{\tt{1}}$$ | | $$\textcolor{#23d18b}{\tt{runner/src/unstract/runner/clients/test\\_docker.py}}$$ | $$\textcolor{#23d18b}{\tt{test\\_cleanup}}$$ |   $$\textcolor{#23d18b}{\tt{1}}$$ | $$\textcolor{#23d18b}{\tt{1}}$$ | | $$\textcolor{#23d18b}{\tt{runner/src/unstrac

- **Issue #1654** (2025-11-12): **fix: [ISSUE]**
  *Symptoms*: ## Describe the bug Unable to access http://frontend.unstract.localhost/ after executing `./run-platform.sh`  ## To reproduce Installed Ubuntu 24.04 in a virtual machine and instaled Docker:  ``` Client: Docker Engine - Community  Version:           29.0.0  API version:       1.52  Go version:        go1.25.4  Git commit:        3d4129b  Built:             Mon Nov 10 21:46:31 2025  OS/Arch:           linux/amd64  Context:           default ```  Cloned the repository:  ``` cd ~ git clone https://github.com/Zipstack/unstract.git cd unstract ```  And executed the ./run-platform.sh script.  when I execute `docker logs unstract-proxy --tail 20` these errors appears:  ``` time="2025-11-11T20:23:12Z" level=error msg="Provider connection error Error response from daemon: client version 1.24 is too old. Minimum supported API version is 1.44, please upgrade your client to a newer version, retrying in 12.375369171s" providerName=docker time="2025-11-11T20:23:24Z" level=error msg="Failed to retrieve information of the docker client and server host: Error response from daemon: client version 1.24 is too old. Minimum supported API version is 1.44, please upgrade your client to a newer version" providerName=docker time="2025-11-11T20:23:24Z" level=error msg="Provider connection error Error response from daemon: client version 1.24 is too old. Minimum supported API version is 1.44, please upgrade your client to a newer version, retrying in 14.497073425s" providerName=docker ```  ## Expected 
  **Post-Mortem & Fix Analysis**:
  > It seems a proble with Traefik and Docker v29. With Docker v28.5.2 works fine.

- **Issue #1611** (2025-10-31): **fix: docker compose should specify project name**
  *Symptoms*: ## Describe the bug Without a specified compose project name docker compose uses the folder name which in this case is 'docker' and that can lead to compose collision.  ## To reproduce Run the compose file.
  **Post-Mortem & Fix Analysis**:
  > Hey @michaelcizmar  Thanks for pointing this out and raising a PR to fix it. Will close this issue once the PR is merged and released
  > Thanks for the fix @michaelcizmar, it has been released as part of [v0.139.1](https://github.com/Zipstack/unstract/releases/tag/v0.139.1)

- **Issue #1385** (2025-07-04): **fix: [ISSUE] Database migration fails**
  *Symptoms*: Describe the bug When performing a fresh installation of the unstract/backend:latest image with a postgres:15 backend, the initial database migration fails. The manage.py migrate command is unable to target the correct database schema, resulting in a ProgrammingError: no schema has been selected to create in. This critical bug prevents the application's 112 required database tables from being created, leaving the database uninitialized and rendering the entire backend non-functional.  To reproduce Steps to reproduce the behavior:  Set up a standard docker-compose.yml file to run unstract/backend:latest and postgres:15 services on a shared Docker network.  Start the services using docker-compose up -d. The containers start successfully.  Execute the database migration command:  docker exec unstract-backend /app/.venv/bin/python manage.py migrate  The command immediately fails with the psycopg2.errors.InvalidSchemaName: no schema has been selected to create in error.  Expected behavior The command docker exec unstract-backend /app/.venv/bin/python manage.py migrate should successfully run all 112 database migrations, creating the necessary tables for the application to function.  Environment details Host OS: Windows 11  Virtualization: Docker Desktop using WSL2 backend  Unstract Version: latest (Pulled on June 26, 2025)  Database Version: postgres:15  Additional context We have undertaken extensive troubleshooting to isolate this issue and can confirm it is not a standard confi
  **Post-Mortem & Fix Analysis**:
  > Additional Comment for Bug Report  Further investigation of the source code in the unstract/backend repository has revealed the definitive root cause of this bug.  In the file backend/backend/settings/base.py, the database engine is hardcoded to a custom wrapper:  Python  # DB Configuration DB_ENGINE = "backend.custom_db"  ...  DATABASES = {     "default": {         "ENGINE": DB_ENGINE,         # ...     } } This custom database engine at backend.custom_db appears to have a bug where it does not correctly handle or pass the search_path option for PostgreSQL connections. This is why all attempts to run manage.py migrate fail with the ProgrammingError: no schema has been selected to create in, regardless of environment variable settings or direct database alterations.  The use of this hardcoded custom engine prevents the application from being installed correctly. 

- **Issue #1365** (2025-06-20): **Celery workers file-processing and callback are in a restart loop on a clean install**
  *Symptoms*: Summary When following the standard installation instructions, the setup fails because two key containers, unstract-worker-file-processing and unstract-worker-file-processing-callback, are stuck in a restart loop. The logs for these containers consistently show a ModuleNotFoundError: No module named 'backend.workers', indicating a python path issue within the unstract/backend docker image. This issue was reproduced on two completely different environments, proving it is not a user environment configuration problem. Environments Where the Issue Was Reproduced Native Linux VM: OS: Ubuntu 24.04 LTS (Clean install) Virtualization: Hyper-V on Windows 11 Docker: Docker Engine v27.0.3 (installed via get.docker.com script) Windows + WSL 2: OS: Windows 11 Pro WSL: Ubuntu 24.04 LTS Docker: Docker Desktop v4.31.1 Steps to Reproduce The steps are the same as the official installation guide and were performed on a completely clean Ubuntu 24.04 VM. Install prerequisites: sudo apt update && sudo apt install git curl -y Install Docker Engine: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh Add user to docker group and reboot: sudo usermod -aG docker $USER && sudo reboot Clone the repository: git clone https://github.com/Zipstack/unstract.git Navigate into the directory: cd unstract Run the installation script: ./run-platform.sh Expected Behavior All 26 containers should start and remain in an Up state. Actual Behavior The script finishes, but two containers immedi
  **Post-Mortem & Fix Analysis**:
  > Hello, thanks for trying the platform and reaching out. I was able to reproduce this issue in the latest `main` and after taking a look [at Dockerhub](https://hub.docker.com/r/unstract/backend/tags) I see that an image was wrongly tagged as `latest` which could be the cause of this. For the time being, please explicitly specify the version `v0.122.2` and run the platform  ``` ./run-platform.sh -v v0.122.2 ``` 
  > Made the release now. `v0.122.2` should be the latest now. 
  > With recent releases, this issue should not be noticed anymore. Please reopen if you notice it again

- **Issue #1281** (2025-05-02): **fix: [ISSUE] No authentication modules found.Application will start without authentication module**
  *Symptoms*: Hi everyone, this is my first ever "contribution" so please don't hate me if I do it wrong ## Describe the bug Im trying to run on my server unstract, but I cannot reach the frontend nor backend. I've followed the README steps, and I'm used to handle docker.  In the backend log I'm getting this:  WARNING : [2025-05-01 04:35:42,831]{module:authentication_plugin_registry process:20 thread:139983920900992 request_id:N/A} :- Metadata is not active for auth_sample authentication module.  WARNING : [2025-05-01 04:35:42,832]{module:authentication_plugin_registry process:20 thread:139983920900992 request_id:N/A} :- No authentication modules found.Application will start without authentication module  If you need further, please let me know  Thanks in advance!    ## To reproduce Steps to reproduce the behavior.  ## Expected behavior A clear and concise description of what you expected to happen.  ## Environment details  - Version: v0.117.0  ## Additional context Add any other context about the problem here.  ## Screenshots If applicable, add screenshots to help explain your problem. 
  **Post-Mortem & Fix Analysis**:
  > Nevermind, I think I made it work

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

### Incident Patch 1: `5261be27` (2026-10-05)
**Commit Message**: UN-4123 [FIX] The default Redis user without a password is not an error (#2315)

* UN-4123 [FIX] The default Redis user without a password is not an error

6c0a69dec added an ERROR when a username is set without a password, to replace
redis-py's opaque "DataError: Invalid input of type: 'NoneType'" on the first
command with something that names the values file. The diagnostic is right for a
named ACL user. It is wrong for "default".

"default" is Redis's own built-in user and `AUTH default <pw>` is equivalent to
`AUTH <pw>`, so "default with no password" is not a misconfiguration -- it is the
absence of ACL usage, which is the normal state for the in-cluster Redis that has
no password at all. values.yaml and sample.on-prem.values.yaml both ship
REDIS_USER: default, so the error fired on every default on-prem install.

Measured on two staging namespaces before this fix: ~274 lines in 20 minutes in
one and 400+ in the other, across eight pod types -- roughly 20k ERROR lines a
day per namespace. Nothing was broken; the username SHOULD be ignored and was.
The cost is log volume and real errors buried under it, which is what the
diagnostic was meant to prevent.

The username is still dr

**File**: `unstract/core/src/unstract/core/cache/redis_client.py` (modified, +26/-8)
```diff
@@ -637,15 +637,33 @@ def _resolve_redis_env(
     # Django cache already makes for this input (apply_url_credentials returns
     # the URL untouched when there is no password), rather than the two
     # disagreeing about a config neither can honour.
+    #
+    # "default" is EXEMPT from the diagnostic, though still dropped. It is Redis's
+    # own built-in user, `AUTH default <pw>` is equivalent to `AUTH <pw>`, and the
+    # chart ships REDIS_USER: default -- so "default with no password" is not a
+    # misconfiguration, it is the absence of ACL usage, which is the normal state
+    # for the in-cluster Redis that has no password at all. Logging it as an error
+    # fired on every default on-prem install: ~20k ERROR lines a day per
+    # namespace, across eight pod types, measured on two staging namespaces. A
+    # NON-default username without a password is still a real mistake and still
+    # reported, because that is the one redis-py turns into an opaque DataError.
+    #
+    # CASE-SENSITIVE, deliberately: Redis ACL usernames are, so `DEFAULT` is a
+    # named user distinct from the built-in `default` and a missing password for
+    # it is a real mistake worth reporting. Whitespace is stripped because
+    # env_chain returns the RAW value on purpose (stripping it there truncated a
+    # password once), so a hand-edited values file can carry padding around a
+    # username that was meant to be the built-in one.
     if username and not password:
-        logger.error(
-            "%sUSER=%r is set but no password is; Redis has no one-argument ACL "
-            "AUTH, so the username is being ignored. Set %sPASSWORD, or clear "
-            "the username.",
-            env_prefix,
-            username,
-            env_prefix,
-        )
+        if username.strip() != "default":
+            logger.error(
+                "%sUSER=%r is set but no password is; Redis has no one-argument "
+                "ACL AUTH, so the username is being ignored. Set %sPASSWORD, or "
+                "clear the username.",
+                env_prefix,
+                username,
+                env_prefix,
+            )
         username = None
     prefixed_db = os.getenv(f"{env_prefix}DB", "").strip()
     generic_db = os.getenv("REDIS_DB", "").strip()
```

**File**: `unstract/core/tests/test_redis_client_config.py` (modified, +54/-0)
```diff
@@ -1214,6 +1214,60 @@ def test_a_blank_user_falls_through_to_the_other_spelling(self, monkeypatch):
         assert urlsplit(build_socketio_redis_url()).username == "alice"
 
 
+class TestTheDefaultUserWithoutAPasswordIsNotAnError:
+    """A username without a password is dropped either way; only the DIAGNOSTIC
+    is conditional.
+
+    `default` is Redis's own built-in user and `AUTH default <pw>` is equivalent
+    to `AUTH <pw>`, so `default` with no password is not a misconfiguration -- it
+    is the absence of ACL usage, which is the normal state for the in-cluster
+    Redis, and values.yaml ships REDIS_USER: default. Logging it at ERROR fired
+    on every default on-prem install: ~20k lines a day per namespace across
+    eight pod types, measured on two staging namespaces before this was fixed.
+    """
+
+    @pytest.mark.parametrize("raw", ["default", "  default  "])
+    def test_the_default_user_without_a_password_is_silent(
+        self, monkeypatch, raw, caplog
+    ):
+        monkeypatch.setenv("REDIS_USER", raw)
+        monkeypatch.delenv("REDIS_PASSWORD", raising=False)
+        # Dropped, exactly as a named user would be -- the behaviour is unchanged.
+        assert _resolve_redis_env("REDIS_")["username"] is None
+        # Padding is stripped before the comparison because env_chain returns the
+        # RAW value on purpose, so a hand-edited values file can carry it.
+        assert "ACL AUTH" not in caplog.text
+
+    def test_a_case_distinct_default_still_errors(self, monkeypatch, caplog):
+        """Redis ACL usernames are CASE-SENSITIVE, so `DEFAULT` is a named user
+        distinct from the built-in `default` -- not the exemption, and a missing
+        password for it is a real mistake. Lowercasing the comparison hid this.
+        """
+        monkeypatch.setenv("REDIS_USER", "DEFAULT")
+        monkeypatch.delenv("REDIS_PASSWORD", raising=False)
+        assert _resolve_redis_env("REDIS_")["username"] is None
+        assert "ACL AUTH" in caplog.text
+        assert "DEFAULT" in caplog.text
+
+    def test_a_named_user_without_a_password_still_errors(self, monkeypatch, caplog):
+        """The case the diagnostic exists for, and the one redis-py turns into an
+        opaque `DataError: Invalid input of type: 'NoneType'` on the first command.
+        """
+        monkeypatch.setenv("REDIS_USER", "alice")
+        monkeypatch.delenv("REDIS_PASSWORD", raising=False)
+        assert _resolve_redis_env("REDIS_")["username"] is None
+        assert "ACL AUTH" in caplog.text
+        assert "alice" in caplog.text
+
+    def test_the_default_user_WITH_a_password_is_kept(self, monkeypatch):
+        """The exemption must not reach the supported configuration: `default`
+        plus a password is a real two-argument AUTH and has to survive.
+        """
+        monkeypatch.setenv("REDIS_USER", "default")
+        monkeypatch.setenv("REDIS_PASSWORD", "pw")
+        assert _resolve_redis_env("REDIS_")["username"] == "default"
+
+
 class TestBlankMeansUnsetForTlsToo:
     """The convention has to cover TLS, not just credentials.
 
```

---

### Incident Patch 2: `6c0a69de` (2026-09-30)
**Commit Message**: UN-4123 [FIX] A credential-free REDIS_URL no longer connects anonymously (#2299)

* UN-4123 [FIX] A credential-free REDIS_URL no longer connects anonymously

In URL mode the resolved password was never passed to the client: credentials
had to be embedded in the URL, and a {prefix}PASSWORD set beside a
credential-free URL was silently ignored. The client connected ANONYMOUSLY and
the endpoint answered NOAUTH on the first command, which reads as a broken
server rather than a dropped password.

This was not exercised by the live managed-Redis testing on UN-4123, because
both configurations tried there avoided it: the URL-mode run embedded the
password in the URL, and the discrete run had no URL at all. The gap sits in the
third combination, which is the one worth recommending.

WHY IT IS WORTH RECOMMENDING. A URL ends up in places a password should not:
the endpoint helper's error messages, ArgoCD's ComparisonError condition, and —
under ESO — the ExternalSecret's spec.target.template.data, which is not a
Secret and is not redacted. All three were raised in review of the chart-side
PR, and all three exist because the password is in a URL. Keeping it in its own
key closes the class rat

**File**: `backend/backend/settings/base.py` (modified, +145/-25)
```diff
@@ -22,13 +22,18 @@
 from utils.cors_origin import normalize_web_app_origin
 
 from unstract.core.cache.redis_client import (
+    apply_url_credentials,
     build_socketio_redis_url,
     ensure_tls_query_params,
     parse_db,
+    parse_port,
+    resolve_sentinel_master_check_hostname,
     resolve_ssl_cert_reqs,
     resolve_ssl_check_hostname,
+    resolve_ssl_enabled,
     set_url_db_path,
     url_db_path,
+    url_username_from_env,
 )
 
 # Django 5.0+ caps URLValidator at 2048 chars. S3 pre-signed URLs signed with
@@ -112,12 +117,20 @@ def get_required_setting(setting_key: str, default: str | None = None) -> str |
 REDIS_USER = os.environ.get("REDIS_USER", "default")
 REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
 REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
-REDIS_PORT = os.environ.get("REDIS_PORT", "6379")
+# Through the shared parser, not a bare int() at the Sentinel call site below:
+# a blank REDIS_PORT= — this repo's "leave the default" spelling — raised
+# ValueError while Django settings were being imported, so the backend alone
+# failed to start while every worker came up healthy on 6379.
+REDIS_PORT = parse_port(os.environ.get("REDIS_PORT"), "REDIS_PORT", 6379)
 REDIS_DB = os.environ.get("REDIS_DB", "")
 # TLS to Redis (UN-4123). Off by default, so the in-cluster/local server is
 # untouched. `rediss://` is what actually selects TLS for both django-redis and
 # kombu; this flag only decides which scheme gets built.
-REDIS_SSL = os.environ.get("REDIS_SSL", "false").strip().lower() == "true"
+# Through the shared resolver, not a local `== "true"`: _TRUE_LITERALS accepts
+# 1, yes and on, so the bare comparison read REDIS_SSL=1 as FALSE — the workers
+# connected rediss:// while this cache built a redis:// LOCATION and skipped its
+# CONNECTION_POOL_KWARGS, i.e. one endpoint with two TLS policies in one process.
+REDIS_SSL = resolve_ssl_enabled()
 # Resolved by unstract.core, not re-read here: the raw value needs trimming,
 # lower-casing and validating, and a second copy of that logic is how this file
 # and create_redis_client came to hold two verification policies for one endpoint.
@@ -552,18 +565,67 @@ def filter(self, record):
 REDIS_SENTINEL_MASTER_NAME = os.environ.get("REDIS_SENTINEL_MASTER_NAME", "mymaster")
 
 if REDIS_SENTINEL_MODE:
+    # This branch used to hold four divergences from create_redis_client, all
+    # pre-existing. They are closed here because "the cache and the client reach
+    # the same place" is not a property that can stop at a mode boundary — an
+    # operator on Sentinel gets the same guarantee or the guarantee is a
+    # half-truth. TestSentinelModeAgreesWithCore covers each one.
+    #
+    # The username comes from the shared resolver, not the module-level
+    # REDIS_USER: that one defaults to "default", so this cache sent a
+    # two-argument ACL AUTH where core sends the one-argument form, and it read
+    # only REDIS_USER so the REDIS_USERNAME spelling platform-service ships was
+    # ignored entirely.
+    _sentinel_username = url_username_from_env()
+
+    # 26379 — the Sentinel port — matching core's
+    # _resolve_redis_env(default_port="26379"). The module-level REDIS_PORT
+    # defaults to 6379, which is the standalone port, so an unset REDIS_PORT
+    # pointed this cache at the wrong port while every other client found the
+    # sentinels. The chart always sets it, which is why this stayed hidden.
+    REDIS_PORT = parse_port(os.environ.get("REDIS_PORT"), "REDIS_PORT", 26379)
+
     _sentinel_kwargs = {}
     if REDIS_PASSWORD:
         _sentinel_kwargs["password"] = REDIS_PASSWORD
-    if REDIS_USER:
-        _sentinel_kwargs["username"] = REDIS_USER
+    if _sentinel_username:
+        _sentinel_kwargs["username"] = _sentinel_username
+
+    # TLS reached neither the discovery connections nor the master one, so a
+    # TLS-only Sentinel deployment got a plaintext cache while core encrypted
+    # both. Core builds them from one env dict for exactly this reason; the
+    # same settings go to both here.
+    _sentinel_pool_kwargs = {}
+    if REDIS_SSL:
+        _sentinel_tls = {"ssl": True, "ssl_cert_reqs": REDIS_SSL_CERT_REQS}
+        if REDIS_SSL_CA_CERTS:
+            _sentinel_tls["ssl_ca_certs"] = REDIS_SSL_CA_CERTS
+
+        # The two planes answer by DIFFERENT rules, and copying one dict into
+        # both got that wrong. Discovery connects to REDIS_HOST, a name whose
+        # certificate can match, so it verifies like any other client. The
+        # MASTER connects to whatever SENTINEL get-master-addr-by-name returns —
+        # an IP that SentinelManagedConnection hands to SSLConnection as
+        # server_hostname, which no DNS SAN covers and which changes on
+        # failover. core turns checking off there unless the operator asked
+        # explicitly; this cache has to agree, or it fails verification against
+        # the same master that create_redis_client reaches.
+        _sentine
```

**File**: `backend/backend/tests/test_redis_settings_derivation.py` (modified, +545/-17)
```diff
@@ -19,12 +19,81 @@
 
 import logging
 import pathlib
+import re
+from urllib.parse import urlsplit
 
 import pytest
 
 _SETTINGS = pathlib.Path(__file__).resolve().parents[1] / "settings" / "base.py"
 
 
+def _slice_bounds(source: str) -> dict[str, tuple[int, int]]:
+    """Character ranges of base.py that _derive executes.
+
+    Factored out so the coverage guard below can assert on the SAME ranges the
+    harness runs, rather than a second description of them that could drift.
+    """
+    defs_start = source.index('REDIS_USER = os.environ.get("REDIS_USER"')
+    defs_end = (
+        source.index("\n", source.index('REDIS_URL = os.environ.get("REDIS_URL"')) + 1
+    )
+    imports_start = source.index("from unstract.core.cache.redis_client import (")
+    imports_end = source.index(")\n", imports_start) + 2
+    urllib_start = source.index("from urllib.parse import ")
+    urllib_end = source.index("\n", urllib_start) + 1
+    return {
+        "urllib": (urllib_start, urllib_end),
+        "imports": (imports_start, imports_end),
+        "defs": (defs_start, defs_end),
+        "block": (
+            source.index("REDIS_SENTINEL_MODE = ("),
+            source.index("SESSION_ENGINE ="),
+        ),
+    }
+
+
+def test_the_harness_covers_every_redis_line_in_the_settings_file():
+    """The splice must not silently stop covering the code it claims to test.
+
+    _derive executes two ranges out of base.py with a ~415-line gap between
+    them, and anything in that gap is invisible to every assertion in this
+    file. That is not theoretical: adding `REDIS_PASSWORD = ""` at base.py:251,
+    or appending a CACHES["default"]["LOCATION"] override after SESSION_ENGINE,
+    leaves all of these tests green while shipping a broken cache.
+
+    The file already concedes the gap once — test_no_database_var_is_parsed_with
+    _a_bare_int greps the source text because FILE_ACTIVE_CACHE_REDIS_DB sits
+    outside both slices. A grep only covers the one pattern someone thought of;
+    this covers the boundary itself, and fails naming the line that escaped.
+    """
+    source = _SETTINGS.read_text()
+    bounds = _slice_bounds(source)
+    covered = []
+    for start, end in bounds.values():
+        covered.append(range(start, end))
+
+    offenders = []
+    offset = 0
+    for line in source.splitlines(keepends=True):
+        if re.match(r"\s*(REDIS_|_redis|_cache|CACHES|SOCKET_IO)", line) and not any(
+            offset in span for span in covered
+        ):
+            offenders.append((source[:offset].count("\n") + 1, line.strip()[:70]))
+        offset += len(line)
+
+    # Known and deliberate: these are asserted by source-text inspection
+    # instead, because they are consumed far from the derivation block.
+    allowed = {"FILE_ACTIVE_CACHE_REDIS_DB", "REDIS_DB_PORTAL"}
+    offenders = [o for o in offenders if not any(a in o[1] for a in allowed)]
+
+    assert not offenders, (
+        "these Redis lines in base.py are OUTSIDE the ranges _derive executes, "
+        "so no test in this file can observe them:\n"
+        + "\n".join(f"  base.py:{n}: {text}" for n, text in offenders)
+        + "\nWiden the slice, or add the name to `allowed` with a reason."
+    )
+
+
 def _derive(**env: str) -> dict:
     """Execute the standalone Redis block with the given env."""
     source = _SETTINGS.read_text()
@@ -55,10 +124,17 @@ def _derive(**env: str) -> dict:
     # without it that branch raises NameError instead of logging, which is part of
     # why it went untested.
     ns: dict = {"__name__": "backend.settings.base"}
+    # The urllib import is spliced from source for the same reason as the
+    # unstract.core one: a hand-written copy must be remembered every time the
+    # settings module starts using another name from it, and the symptom is a
+    # NameError in every case rather than one clear failure.
+    urllib_start = source.index("from urllib.parse import ")
+    urllib_end = source.index("\n", urllib_start) + 1
+
     prelude = (
-        "import logging\n"
-        "import os\n"
-        "from urllib.parse import quote\n" + source[imports_start:imports_end]
+        "import logging\nimport os\n"
+        + source[urllib_start:urllib_end]
+        + source[imports_start:imports_end]
     ) + source[defs_start:defs_end]
     import os as _os
 
@@ -98,20 +174,35 @@ def test_the_password_reaches_the_cache(self):
         derived = _derive(REDIS_HOST="h", REDIS_PASSWORD="s3cret")
         assert derived["CACHES"]["default"]["OPTIONS"]["PASSWORD"] == "s3cret"
 
-    def test_db_and_username_are_passed_through_options(self):
-        """Pins the stated invariant so a django-redis bump is visible.
-
-        The comment beside this code says USERNAME is deliberately not honoured —
-        django-redis 5.4.0 discards it, so auth stays password-only as the
-        built-in `default` user. That holds by accident of the pinned version:
-        these assertions pin what the settings SE
```

**File**: `backend/sample.env` (modified, +7/-1)
```diff
@@ -60,7 +60,13 @@ REDIS_SENTINEL_MASTER_NAME=mymaster
 #   1. Discrete vars (what the Helm chart and these samples use). Set REDIS_SSL=true
 #      alongside REDIS_HOST/REDIS_PORT. No URL-encoding to get wrong.
 #   2. REDIS_URL, where the SCHEME carries TLS and nothing else is needed:
-#        REDIS_URL=rediss://:<password>@<host>:6380/0?ssl_cert_reqs=required
+#        REDIS_URL=rediss://<host>:6380/0?ssl_cert_reqs=required
+#        REDIS_PASSWORD=<password>
+#        REDIS_USER=                        # blank — see below
+#        (The password is better kept OUT of the URL. A URL is printed into log
+#         lines, error messages and deployment tooling; a password in one travels
+#         with it. Credentials in the URL still work and still win, so an existing
+#         rediss://:<password>@host URL keeps behaving exactly as before.)
 #        (6380 is an EXAMPLE, not a default — the TLS port is provider-specific:
 #         Memorystore 6378, ElastiCache 6379, Azure Cache 6380. A wrong port
 #         hangs the connection rather than erroring, so read it off the instance.)
```

**File**: `runner/sample.env` (modified, +7/-1)
```diff
@@ -55,7 +55,13 @@ REDIS_SENTINEL_MASTER_NAME=mymaster
 #   1. Discrete vars (what the Helm chart and these samples use). Set REDIS_SSL=true
 #      alongside REDIS_HOST/REDIS_PORT. No URL-encoding to get wrong.
 #   2. REDIS_URL, where the SCHEME carries TLS and nothing else is needed:
-#        REDIS_URL=rediss://:<password>@<host>:6380/0?ssl_cert_reqs=required
+#        REDIS_URL=rediss://<host>:6380/0?ssl_cert_reqs=required
+#        REDIS_PASSWORD=<password>
+#        REDIS_USER=                        # blank — see below
+#        (The password is better kept OUT of the URL. A URL is printed into log
+#         lines, error messages and deployment tooling; a password in one travels
+#         with it. Credentials in the URL still work and still win, so an existing
+#         rediss://:<password>@host URL keeps behaving exactly as before.)
 #        (6380 is an EXAMPLE, not a default — the TLS port is provider-specific:
 #         Memorystore 6378, ElastiCache 6379, Azure Cache 6380. A wrong port
 #         hangs the connection rather than erroring, so read it off the instance.)
```

**File**: `unstract/core/src/unstract/core/cache/redis_client.py` (modified, +290/-28)
```diff
@@ -136,15 +136,17 @@ def url_db_path(url: str) -> int | None:
         return None
 
 
-def _parse_bool(raw: str, default: bool, name: str) -> bool:
+def _parse_bool(raw: str | None, default: bool, name: str) -> bool:
     """Parse a boolean env var; blank means UNSET, unknown warns and defaults.
 
     Blank-means-unset is this repo's own convention — `FOO=` in a sample.env
     means "leave the default", and every other variable in UN-4123 treats it that
     way. `os.getenv` does not: it reports an empty string as SET, so a bare
     `os.getenv(...) == "true"` turns `FOO=` into False.
+
+    Accepts None so callers can hand it env_chain's "nothing was set" directly.
     """
-    value = raw.strip().lower()
+    value = (raw or "").strip().lower()
     if not value:
         return default
     if value in _TRUE_LITERALS:
@@ -190,9 +192,7 @@ def resolve_ssl_cert_reqs(env_prefix: str = "REDIS_") -> str:
     endpoint, three verification policies. Case and stray whitespace had the same
     effect, since the "is verification off?" test is an equality check.
     """
-    raw = os.getenv(
-        f"{env_prefix}SSL_CERT_REQS", os.getenv("REDIS_SSL_CERT_REQS", "")
-    ).strip()
+    raw = (env_chain(f"{env_prefix}SSL_CERT_REQS", "REDIS_SSL_CERT_REQS") or "").strip()
     value = raw.lower()
     if not value:
         return _DEFAULT_CERT_REQS
@@ -208,6 +208,32 @@ def resolve_ssl_cert_reqs(env_prefix: str = "REDIS_") -> str:
     return value
 
 
+def resolve_sentinel_master_check_hostname(env_prefix: str = "REDIS_") -> bool:
+    """ssl_check_hostname for a Sentinel-managed MASTER connection.
+
+    The master plane answers by a DIFFERENT rule than the discovery plane, and
+    exporting it is what stops a consumer re-deriving it: a master connects to
+    whatever `SENTINEL get-master-addr-by-name` returns, and
+    SentinelManagedConnection assigns that address straight to ``self.host``,
+    which SSLConnection passes as ``server_hostname``. It is an IP, so
+    verification is checked against an address no DNS SAN covers — and pinning
+    an IP SAN is not a workable answer, because the address changes on failover.
+
+    So it is OFF unless the operator asked for it explicitly, matching
+    _tls_kwargs(sentinel_master=True). Off as well when verification itself is
+    off: the pinned redis-py (5.2.1) does NOT coerce that pair — it assigns
+    check_hostname verbatim — so CERT_NONE with checking on reaches Python's ssl
+    module, which rejects it.
+    """
+    raw, _ = env_chain_named(
+        f"{env_prefix}SSL_CHECK_HOSTNAME", "REDIS_SSL_CHECK_HOSTNAME"
+    )
+    explicit = (raw or "").strip().lower() in _TRUE_LITERALS | _FALSE_LITERALS
+    if not explicit or resolve_ssl_cert_reqs(env_prefix) == "none":
+        return False
+    return resolve_ssl_check_hostname(env_prefix)
+
+
 def resolve_ssl_check_hostname(env_prefix: str = "REDIS_", default: bool = True) -> bool:
     """{prefix}SSL_CHECK_HOSTNAME, falling back to REDIS_SSL_CHECK_HOSTNAME, then on.
 
@@ -216,13 +242,10 @@ def resolve_ssl_check_hostname(env_prefix: str = "REDIS_", default: bool = True)
     FALSE, silently downgrading the Django cache to an encrypted but
     unauthenticated connection.
     """
-    return _parse_bool(
-        os.getenv(
-            f"{env_prefix}SSL_CHECK_HOSTNAME", os.getenv("REDIS_SSL_CHECK_HOSTNAME", "")
-        ),
-        default,
-        f"{env_prefix}SSL_CHECK_HOSTNAME",
+    raw, name = env_chain_named(
+        f"{env_prefix}SSL_CHECK_HOSTNAME", "REDIS_SSL_CHECK_HOSTNAME"
     )
+    return _parse_bool(raw, default, name)
 
 
 def url_cert_reqs(url: str) -> str | None:
@@ -322,7 +345,8 @@ def ensure_tls_query_params(
     """Add the TLS settings a `rediss://` URL is missing, leaving present ones alone.
 
     Anything that hands a URL to a library that reads TLS out of the query string
-    needs this: kombu's KombuManager takes a URL and NOTHING else, and
+    needs this: kombu's KombuManager reads TLS from the URL alone — its
+    connection_options reach kombu.Connection, but the TLS settings do not — and
     django-redis's LOCATION is a string too (it also reads
     OPTIONS["CONNECTION_POOL_KWARGS"], but the query string wins on conflict).
 
@@ -380,6 +404,156 @@ def _compose_redis_url(env: dict[str, Any]) -> str:
     return f"{scheme}://{credentials}{env['host']}:{env['port']}"
 
 
+def env_chain(*names: str) -> str | None:
+    """First NON-BLANK value among these env vars, else None.
+
+    Blank means unset throughout this module — it is the "leave the default"
+    spelling the sample recipes and values files use, and it is why a nested
+    `os.getenv(prefixed, os.getenv(generic))` is wrong here: `os.getenv` reports
+    a set-but-empty variable as set, so the blank shadows the level below it.
+    """
+    for name in names:
+        value = os.getenv(name, "")
+        # Emptiness is tested on the STRIPPED value; the RAW one is returned.
+        # Stripping the return valu
```

**File**: `unstract/core/tests/test_redis_client_config.py` (modified, +402/-13)
```diff
@@ -11,12 +11,18 @@
 None of those raise at import, so they are asserted here instead.
 """
 
+import logging
 import pathlib
 import re
+from urllib.parse import unquote, urlsplit
 
 import pytest
 import redis
 from unstract.core.cache.redis_client import (
+    url_username_from_env,
+    parse_port,
+    env_chain_named,
+    env_chain,
     _build_connection_kwargs,
     _resolve_redis_env,
     build_socketio_redis_url,
@@ -263,19 +269,39 @@ def test_prefixed_client_inherits_the_global_password(self, monkeypatch):
             "s3cr3t"
         )
 
-    def test_empty_prefixed_password_shadows_the_fallback(self, monkeypatch):
-        """Documents a trap rather than endorsing it.
+    def test_empty_prefixed_password_falls_through_to_the_fallback(self, monkeypatch):
+        """This is the revisit the previous version of this test asked for.
 
-        ``os.getenv(key, fallback)`` returns "" when the key exists but is empty,
-        so an empty CACHE_REDIS_PASSWORD suppresses REDIS_PASSWORD and the client
-        connects UNAUTHENTICATED. The Helm chart must therefore never render an
-        empty credential; this test fails if that behaviour ever changes, so the
-        chart-side guarantee can be revisited.
+        It used to assert the opposite and said so: an empty
+        CACHE_REDIS_PASSWORD suppressed REDIS_PASSWORD and the client connected
+        UNAUTHENTICATED, which was tolerated because "the Helm chart must
+        therefore never render an empty credential".
+
+        That guarantee does not hold. workers/sample.env ships
+        `CACHE_REDIS_PASSWORD=` uncommented, so an operator following this
+        module's own managed-Redis recipe — REDIS_URL without credentials plus
+        REDIS_PASSWORD — got no password on any prefixed client and a NOAUTH on
+        first command. Blank now means unset here, the same rule parse_db and
+        _parse_bool already document two functions away.
         """
         monkeypatch.setenv("REDIS_PASSWORD", "s3cr3t")
         monkeypatch.setenv("CACHE_REDIS_PASSWORD", "")
         kwargs = _kwargs(create_redis_client(env_prefix="CACHE_REDIS_"))
-        assert kwargs.get("password") is None
+        assert kwargs["password"] == "s3cr3t"
+
+    def test_a_prefixed_password_still_overrides(self, monkeypatch):
+        """Blank falling through must not turn into the prefix being ignored."""
+        monkeypatch.setenv("REDIS_PASSWORD", "s3cr3t")
+        monkeypatch.setenv("CACHE_REDIS_PASSWORD", "other")
+        kwargs = _kwargs(create_redis_client(env_prefix="CACHE_REDIS_"))
+        assert kwargs["password"] == "other"
+
+    def test_a_blank_password_on_a_prefixed_url_reaches_the_url(self, monkeypatch):
+        """The recipe this PR documents, with the sample.env blank in place."""
+        monkeypatch.setenv("REDIS_URL", "rediss://managed:6380/0")
+        monkeypatch.setenv("REDIS_PASSWORD", "pw")
+        monkeypatch.setenv("CACHE_REDIS_PASSWORD", "")
+        assert urlsplit(build_socketio_redis_url("CACHE_REDIS_")).password == "pw"
 
 
 class TestSocketIoUrl:
@@ -552,11 +578,25 @@ class TestContainerAllowlists:
     def _shared(cls) -> set[str]:
         """Every REDIS_* env var redis_client.py reads, minus the excused ones."""
         source = cls._CLIENT.read_text()
-        names = set(re.findall(r'os\.getenv\(\s*"(REDIS_[A-Z_]+)"', source))
-        names |= {
-            f"REDIS_{suffix}"
-            for suffix in re.findall(r'os\.getenv\(\s*f"\{env_prefix\}([A-Z_]+)"', source)
-        }
+        # Scans the ARGUMENTS of every env-reading call, not just os.getenv.
+        # Keying on os.getenv alone meant that rewriting a read to go through
+        # env_chain made the variable invisible here — the TLS set dropped out
+        # of this guard silently, which is the same drift this class exists to
+        # catch. Scoped to these call names rather than the whole file so a
+        # variable merely NAMED in a docstring is not demanded of every
+        # container.
+        calls = re.findall(
+            r"(?:os\.getenv|env_chain|env_chain_named)\("
+            r"([^()]*(?:\([^()]*\)[^()]*)*)\)",
+            source,
+        )
+        names: set[str] = set()
+        for args in calls:
+            names |= set(re.findall(r'"(REDIS_[A-Z_]+)"', args))
+            names |= {
+                f"REDIS_{suffix}"
+                for suffix in re.findall(r'f"\{env_prefix\}([A-Z_]+)"', args)
+            }
         return names - cls._NOT_FORWARDED
 
     def test_the_derived_set_is_not_empty(self):
@@ -909,3 +949,352 @@ def test_the_prefixs_own_db_still_wins(self, monkeypatch):
         monkeypatch.setenv("REDIS_DB", "3")
         monkeypatch.setenv("CACHE_REDIS_DB", "1")
         assert _kwargs(create_redis_client("CACHE_REDIS_"))["db"] == 1
+
+
+class TestUrlModeCredentials:
+    """A URL written without credentials must not connect anonymously.
+
+    Keeping the password OUT of the URL is the safer configuration — a 
```

**File**: `workers/sample.env` (modified, +7/-1)
```diff
@@ -81,7 +81,13 @@ REDIS_SENTINEL_MASTER_NAME=mymaster
 # Managed / external Redis with TLS (UN-4123). Optional — unset keeps the plaintext
 # connection above. Either set REDIS_SSL=true beside REDIS_HOST/REDIS_PORT, or give a
 # full URL whose scheme carries TLS:
-#   REDIS_URL=rediss://:<password>@<host>:6380/0?ssl_cert_reqs=required
+#   REDIS_URL=rediss://<host>:6380/0?ssl_cert_reqs=required
+#   REDIS_PASSWORD=<password>
+#   REDIS_USER=                        # blank — see below
+#   (The password is better kept OUT of the URL. A URL is printed into log
+#    lines, error messages and deployment tooling; a password in one travels
+#    with it. Credentials in the URL still work and still win, so an existing
+#    rediss://:<password>@host URL keeps behaving exactly as before.)
 # A URL wins over the discrete vars. Auth is password-only as the built-in `default`
 # user (what a managed AUTH string is), so leave the username empty for a managed
 # endpoint. REDIS_SSL_CA_CERTS is only needed when the server's CA is not publicly
```

---

### Incident Patch 3: `9b76d929` (2026-09-30)
**Commit Message**: [MISC] Fix flaky integration CI: rig Postgres lock limit and unmocked pg_barrier dispatch (#2308)

[MISC] Raise the rig Postgres lock limit and mock dispatch in pg_barrier enqueue tests

The integration tier fails intermittently for two unrelated reasons.

Backend: every xdist worker migrates its own test database in one
transaction, holding a lock per table and constraint. The rig's Postgres
runs with the default max_locks_per_transaction=64, so the shared lock
table overflows at random ("out of shared memory") and errors hundreds of
backend tests at setup. Start the container with 256.

Workers: five TestPgBarrierEnqueue tests never mocked
queue_backend.dispatch.dispatch. Since UN-4078 made the PG queue the only
transport, enqueue really dispatches the headers, opening a connection
from DB_* env (default host unstract-db) instead of the TEST_DB_* test
database. Wrap them in the same patch their neighbours use. Also drop a
duplicated _barrier_pg_decrement import.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `tests/rig/runtime.py` (modified, +7/-1)
```diff
@@ -333,7 +333,13 @@ def up(self) -> PlatformEndpoints:
         # __post_init__ invariant (host without port) is self-cleaning;
         # otherwise a partial spec leaks the four containers we just started.
         try:
-            pg = PostgresContainer("pgvector/pgvector:pg15")
+            # Every xdist worker migrates its own test database in one
+            # transaction, each holding a lock per table and constraint. The
+            # default of 64 overflows the shared lock table intermittently
+            # ("out of shared memory") and errors the whole backend group.
+            pg = PostgresContainer("pgvector/pgvector:pg15").with_command(
+                "postgres -c max_locks_per_transaction=256"
+            )
             pg.start()
             self._stack.append(pg)
             redis = RedisContainer("redis:7.2.3").start()
```

**File**: `workers/tests/test_pg_barrier.py` (modified, +40/-36)
```diff
@@ -27,7 +27,6 @@
     _barrier_pg_decrement,
     _fire_barrier_callback,
     barrier_pg_abort,
-    _barrier_pg_decrement,
     claim_batch,
     run_batch_with_barrier,
     try_claim_orchestration,
@@ -850,13 +849,14 @@ def test_enqueue_sets_expires_cap_and_fresh_progress(self, barrier_db, monkeypat
         # expired nor stale. (UN-3661)
         monkeypatch.setenv("WORKER_BARRIER_KEY_TTL_SECONDS", "600")
         task, _ = _mock_header_task()
-        PgBarrier().enqueue(
-            [task],
-            callback_task_name="cb",
-            callback_kwargs={"execution_id": "exec-SD"},
-            callback_queue="general",
-            app_instance=None,
-        )
+        with patch("queue_backend.dispatch.dispatch"):
+            PgBarrier().enqueue(
+                [task],
+                callback_task_name="cb",
+                callback_kwargs={"execution_id": "exec-SD"},
+                callback_queue="general",
+                app_instance=None,
+            )
         assert 590 <= _expires_in_seconds(barrier_db, "exec-SD") <= 600  # ~ttl cap
         assert _last_progress_age_seconds(barrier_db, "exec-SD") < 5  # fresh
 
@@ -920,34 +920,37 @@ def test_upsert_overwrites_stale_state(self, barrier_db):
                 "        now() + interval '1h', now())"
             )
         task, _ = _mock_header_task()
-        PgBarrier().enqueue(
-            [task, _mock_header_task()[0]],
-            callback_task_name="cb",
-            callback_kwargs={"execution_id": "exec-R"},
-            callback_queue="general",
-            app_instance=None,
-        )
+        with patch("queue_backend.dispatch.dispatch"):
+            PgBarrier().enqueue(
+                [task, _mock_header_task()[0]],
+                callback_task_name="cb",
+                callback_kwargs={"execution_id": "exec-R"},
+                callback_queue="general",
+                app_instance=None,
+            )
         assert _row(barrier_db, "exec-R") == (2, [])
 
     def test_enqueue_stamps_organization_id(self, barrier_db):
         # The whole reason the org column + migration exist (reaper recovery).
-        PgBarrier().enqueue(
-            [_mock_header_task()[0]],
-            callback_task_name="cb",
-            callback_kwargs={"execution_id": "exec-ORG", "organization_id": "org-42"},
-            callback_queue="general",
-            app_instance=None,
-        )
+        with patch("queue_backend.dispatch.dispatch"):
+            PgBarrier().enqueue(
+                [_mock_header_task()[0]],
+                callback_task_name="cb",
+                callback_kwargs={"execution_id": "exec-ORG", "organization_id": "org-42"},
+                callback_queue="general",
+                app_instance=None,
+            )
         assert _org(barrier_db, "exec-ORG") == "org-42"
 
     def test_enqueue_defaults_org_to_empty_when_absent(self, barrier_db):
-        PgBarrier().enqueue(
-            [_mock_header_task()[0]],
-            callback_task_name="cb",
-            callback_kwargs={"execution_id": "exec-NOORG"},  # no organization_id
-            callback_queue="general",
-            app_instance=None,
-        )
+        with patch("queue_backend.dispatch.dispatch"):
+            PgBarrier().enqueue(
+                [_mock_header_task()[0]],
+                callback_task_name="cb",
+                callback_kwargs={"execution_id": "exec-NOORG"},  # no organization_id
+                callback_queue="general",
+                app_instance=None,
+            )
         assert _org(barrier_db, "exec-NOORG") == ""
 
     def test_upsert_refreshes_org_on_reenqueue(self, barrier_db):
@@ -960,13 +963,14 @@ def test_upsert_refreshes_org_on_reenqueue(self, barrier_db):
                 "VALUES ('exec-REORG', 'old-org', 1, '[]'::jsonb, now(), "
                 "        now() + interval '1h', now())"
             )
-        PgBarrier().enqueue(
-            [_mock_header_task()[0]],
-            callback_task_name="cb",
-            callback_kwargs={"execution_id": "exec-REORG", "organization_id": "new-org"},
-            callback_queue="general",
-            app_instance=None,
-        )
+        with patch("queue_backend.dispatch.dispatch"):
+            PgBarrier().enqueue(
+                [_mock_header_task()[0]],
+                callback_task_name="cb",
+                callback_kwargs={"execution_id": "exec-REORG", "organization_id": "new-org"},
+                callback_queue="general",
+                app_instance=None,
+            )
         assert _org(barrier_db, "exec-REORG") == "new-org"
 
     def test_mid_loop_dispatch_failure_deletes_row(self, barrier_db):
```

---

### Incident Patch 4: `d12e452d` (2026-09-29)
**Commit Message**: UN-2238 [FIX] Enforce the frontend CSP (out of report-only mode) (#2245)

* UN-2238 [FIX] CSP: allow third-party origins found in report-only sweep

Sweep of the report-only policy on a live deployment (browsing + per-directive
probes) turned up hosts the shipped bundle loads but no directive allows:

- style-src/font-src: cdn.jsdelivr.net (Monaco CSS + codicon)
- img-src: cdn.jsdelivr.net (emoji-datasource), ProductFruits, GTM, GA,
  reCAPTCHA assets, q.stripe.com
- media-src: cdn.productfruits.com (new directive; default-src had no blob:)
- connect-src: unpkg.com, api.productfruits.com, GA4 regional endpoints,
  reCAPTCHA api2, m.stripe.network
- frame-src: googletagmanager ns.html, m.stripe.network

ProductFruits' animations.css was the one violation observed in normal use; the
rest belong to code paths and flows that were not exercised.

Drops the bare `wss:` wildcard: socket.io connects to window.location.origin
(GetStaticData getBaseUrl) and 'self' covers same-origin ws/wss per CSP3,
verified with a ws:// probe against nginx serving this policy.

Adds .claude/skills/csp-check so the policy can be re-checked against a build or
a deployment when a frontend dependency changes.



**File**: `.claude/skills/csp-check/SKILL.md` (added, +182/-0)
```diff
@@ -0,0 +1,182 @@
+---
+name: csp-check
+description: >
+  Check the frontend Content-Security-Policy in frontend/nginx.conf against what the app
+  actually loads. The policy is enforced, so a host it does not list is blocked. Use when
+  adding or upgrading a third-party frontend dependency (CDN, analytics, payments,
+  widgets), when a feature loads assets from a new external host, when a CSP violation
+  shows up in the browser console, or when something works in `bun run dev` but breaks
+  behind nginx.
+---
+
+# CSP Check
+
+The frontend ships an enforcing `Content-Security-Policy` header from
+`frontend/nginx.conf`. A resource from an origin no directive lists is **blocked** — whatever needed it breaks, and the only trace is a
+console violation. So the policy has to be widened in the same change that adds the
+dependency, not after someone reports a broken page.
+
+There is no report collector: violations reach each user's browser console and nowhere
+else. These checks are the only way to see a gap before a user does. Note the header is
+only served by the production nginx image — `bun run dev` has no CSP at all, so "it worked
+locally" says nothing.
+
+Three checks, cheapest first. Run 1 on every change that touches a frontend dependency;
+run 2 and 3 before widening the policy or shipping a new third-party integration.
+
+## 1. Static: does the bundle reference a host the policy never allows?
+
+```bash
+cd .claude/skills/csp-check/scripts
+python3 extract_policy.py                                  # what the policy says today
+python3 scan_origins.py --url https://us-central.unstract.com
+python3 scan_origins.py --dist                             # after `bun run build`
+```
+
+Bare `--dist` resolves the repo's own `frontend/build`, from any directory. Give it a path
+only for a build somewhere else — and note the path is relative to your shell, not to the
+script. The script exits non-zero when `--dist` is missing or holds no `.js`, when a
+`--url` index names no bundle, and when a chunk `index.html` links fails to fetch; a 404
+on a path found only inside a bundle string is tolerated, since that is usually a worker
+path a chunk names but never loads. Check the file count on the first output line against
+what the build produced.
+
+`scan_origins.py` pulls every `/assets/*.js|css` chunk (following relative imports), plus
+`index.html` and the entrypoint-generated `/config/runtime-config.js`, extracts external
+`https://` URLs, and exits non-zero on any the policy would block. Hosts that only appear
+in doc links, XML namespaces and library error strings are listed in its `IGNORED` set —
+extend it rather than widening the policy for a host nothing fetches.
+
+Verdicts: `MISSING` (no fetch directive names the host — `form-action`, `base-uri` and
+`frame-ancestors` do not count, since nothing can be loaded on their strength), `PATH`
+(listed path-scoped and this URL falls outside it — `https://www.google.com/recaptcha/`
+grants that path only, so `https://www.google.com/g/collect` is still blocked) and `PORT`
+(a source with no port grants 443 only). `*.` sources match subdomains only, the way the
+browser reads them: `https://*.google-analytics.com` covers `region1.google-analytics.com`
+but not a bare `google-analytics.com`.
+
+This catches "a new dependency pulls from a new CDN". It cannot tell you *which*
+directive loads a host — a font from a script-src-only host still violates. That is check 2.
+
+What it still cannot see: a URL assembled at runtime, and a URL supplied by deployment
+config. `VITE_CUSTOM_LOGO_URL` / `VITE_FAVICON_PATH` are the live example — see
+"Operator-supplied URLs" below.
+
+## 2. Live: probe the deployed policy, directive by directive
+
+With the chrome-devtools MCP on a page of the target deployment:
+
+1. `python3 extract_policy.py --json` and paste `directives` into `DIRECTIVES` in
+   `scripts/probe.js`.
+2. Run the whole file as the `function` argument of `evaluate_script`.
+
+It loads one throwaway resource per (directive, host) pair and returns:
+
+- `unexpected` — hosts the policy is meant to allow but the deployment still reports.
+  Non-empty means the running deployment does not serve the policy in this repo, or the
+  host is allowed on the wrong directive.
+- `controlsNotReported` — must be empty. Non-empty means CSP is not being applied at all.
+
+A wildcard source is probed as `csp-probe.<suffix>`, because `https://*.example.com/…` is
+not a hostname and the request would die before CSP saw it. CSP is evaluated before DNS —
+which is why the `csp-control.invalid` controls get reported without resolving — so a
+`csp-probe.*` entry in `unexpected` means the deployment is not serving that wildcard.
+
+CSP evaluates **redirect targets**: a probe path that 404-redirects to another host
+(`https://hooks.stripe.com/` → `https://stripe.com`) reports the target, not a real gap.
+
+## 3. Real usage: collect violations while driving the app
+
+Probes only test 
```

**File**: `.claude/skills/csp-check/scripts/extract_policy.py` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+#!/usr/bin/env python3
+"""Parse the Content-Security-Policy out of frontend/nginx.conf.
+
+Usage:
+    python3 extract_policy.py [path/to/nginx.conf]        # pretty-print per directive
+    python3 extract_policy.py --json [path/to/nginx.conf] # machine-readable
+"""
+
+import json
+import re
+import sys
+from pathlib import Path
+
+HEADER_RE = re.compile(
+    r'add_header\s+(Content-Security-Policy(?:-Report-Only)?)\s+"(?P<policy>[^"]*)"',
+    re.IGNORECASE,
+)
+DEFAULT_CONF = Path(__file__).resolve().parents[4] / "frontend" / "nginx.conf"
+
+
+def parse(conf_path: Path) -> tuple[str, dict[str, list[str]]]:
+    """Return (header_name, {directive: [sources]}) for the conf's enforcing CSP header.
+
+    Everything downstream trusts this as "what the browser sees", so it has to pick the
+    same header the browser would: not a commented-out one, and not a -Report-Only
+    header that happens to sit above the enforcing one (the usual shape while the next
+    policy change is being trialled).
+    """
+    live = "\n".join(
+        line
+        for line in conf_path.read_text().splitlines()
+        if not line.lstrip().startswith("#")
+    )
+    matches = HEADER_RE.findall(live)
+    if not matches:
+        raise SystemExit(f"No Content-Security-Policy add_header found in {conf_path}")
+    enforcing = [m for m in matches if m[0].lower() == "content-security-policy"]
+    chosen = enforcing or matches
+    if len(chosen) > 1:
+        names = ", ".join(name for name, _ in chosen)
+        raise SystemExit(
+            f"{conf_path} has {len(chosen)} CSP headers ({names}) -- ambiguous"
+        )
+    header, policy = chosen[0]
+    directives: dict[str, list[str]] = {}
+    for chunk in policy.split(";"):
+        parts = chunk.split()
+        if not parts:
+            continue
+        if parts[0] in directives:
+            # The browser honours the first occurrence and ignores the rest, so keeping
+            # the last would let the gate clear sources the browser never applies.
+            print(
+                f"warning: duplicate directive {parts[0]!r} in {conf_path}; "
+                "the browser uses the first and ignores this one",
+                file=sys.stderr,
+            )
+            continue
+        directives[parts[0]] = parts[1:]
+    return header, directives
+
+
+def main() -> None:
+    args = [a for a in sys.argv[1:] if a != "--json"]
+    as_json = "--json" in sys.argv[1:]
+    conf = Path(args[0]) if args else DEFAULT_CONF
+    header, directives = parse(conf)
+    if as_json:
+        print(json.dumps({"header": header, "directives": directives}, indent=2))
+        return
+    print(f"{header}  ({conf})")
+    for directive, sources in directives.items():
+        print(f"\n  {directive}")
+        for source in sources:
+            print(f"      {source}")
+
+
+if __name__ == "__main__":
+    main()
```

**File**: `.claude/skills/csp-check/scripts/probe.js` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+/**
+ * Browser-side CSP probe.
+ *
+ * Paste the whole file as the `function` argument of the chrome-devtools MCP
+ * `evaluate_script` tool while a page from the target deployment is selected, with the
+ * output of `extract_policy.py --json` inlined as DIRECTIVES below.
+ *
+ * It loads one throwaway resource per (directive, host) pair and records what the live
+ * policy reports, so it answers two questions the config file alone cannot:
+ *   1. does the deployment actually serve the policy we think it does?
+ *   2. is each host allowed on the directive that will really load it?
+ * Four control probes must always be reported -- if they are not, CSP is not applied.
+ *
+ * Note: CSP evaluates redirect targets. A probe path that 404-redirects to another host
+ * (https://hooks.stripe.com/ -> https://stripe.com) reports that target, not a real gap.
+ */
+async () => {
+  const DIRECTIVES = {
+    /* paste extract_policy.py --json "directives" here */
+  };
+
+  const KIND_BY_DIRECTIVE = {
+    "script-src": "script",
+    "style-src": "style",
+    "img-src": "img",
+    "font-src": "font",
+    "connect-src": "connect",
+    "frame-src": "frame",
+    "media-src": "media",
+    "worker-src": "worker",
+  };
+
+  const probes = [];
+  for (const [directive, sources] of Object.entries(DIRECTIVES)) {
+    const kind = KIND_BY_DIRECTIVE[directive];
+    if (!kind) continue;
+    for (const source of sources) {
+      if (!source.startsWith("https://")) continue;
+      // A wildcard source is not a hostname: https://*.example.com/__csp_probe never
+      // parses, so the request dies before CSP sees it and the probe looks clean whether
+      // or not the deployment serves the wildcard. Substituting a concrete label does
+      // test it -- CSP is evaluated before DNS, which is why the csp-control.invalid
+      // controls below get reported despite not resolving.
+      const url = source.replace("://*.", "://csp-probe.").replace(/\/$/, "");
+      probes.push([kind, url + "/__csp_probe", false]);
+    }
+  }
+  for (const kind of ["img", "connect", "script"]) {
+    probes.push([kind, "https://csp-control.invalid/__csp_probe", true]);
+  }
+  probes.push(["connect", "wss://csp-control.invalid/__csp_probe", true]);
+
+  const hits = [];
+  const onViolation = (e) =>
+    hits.push({
+      directive: e.effectiveDirective || e.violatedDirective,
+      blocked: e.blockedURI,
+    });
+  document.addEventListener("securitypolicyviolation", onViolation);
+  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
+
+  const load = (kind, url) => {
+    if (kind === "script") {
+      const el = document.createElement("script");
+      el.src = url;
+      document.head.appendChild(el);
+    } else if (kind === "style") {
+      const el = document.createElement("link");
+      el.rel = "stylesheet";
+      el.href = url;
+      document.head.appendChild(el);
+    } else if (kind === "img") {
+      new Image().src = url;
+    } else if (kind === "font") {
+      new FontFace("cspProbe", `url(${url})`).load().catch(() => {});
+    } else if (kind === "connect") {
+      if (url.startsWith("wss:")) new WebSocket(url);
+      else fetch(url, { mode: "no-cors" }).catch(() => {});
+    } else if (kind === "frame") {
+      const el = document.createElement("iframe");
+      el.src = url;
+      el.style.display = "none";
+      document.body.appendChild(el);
+    } else if (kind === "media") {
+      const el = document.createElement("video");
+      el.src = url;
+      document.body.appendChild(el);
+      el.load();
+    } else if (kind === "worker") {
+      new Worker(url);
+    }
+  };
+
+  const expected = [];
+  for (const [kind, url, isControl] of probes) {
+    try {
+      load(kind, url);
+    } catch (e) {
+      /* cross-origin Worker/WebSocket constructors can throw; CSP still reports first */
+    }
+    if (isControl) expected.push(url);
+    await wait(250);
+  }
+  await wait(3000);
+  document.removeEventListener("securitypolicyviolation", onViolation);
+
+  const reported = new Set(hits.map((h) => h.blocked));
+  return {
+    // Hosts the policy is supposed to allow but the deployment still blocks. A
+    // csp-probe.* entry here means the deployment is not serving that wildcard source.
+    unexpected: hits.filter((h) => !h.blocked.includes("csp-control.invalid")),
+    // Empty means CSP is live and restrictive. Non-empty means it is not applied at all.
+    controlsNotReported: expected.filter(
+      (url) => !reported.has(url) && !reported.has(new URL(url).origin)
+    ),
+    probeCount: probes.length,
+  };
+};
```

**File**: `.claude/skills/csp-check/scripts/scan_origins.py` (added, +291/-0)
```diff
@@ -0,0 +1,291 @@
+#!/usr/bin/env python3
+"""List external origins referenced by the frontend and flag ones the CSP never allows.
+
+Sources of truth:
+  * the policy in frontend/nginx.conf (see extract_policy.py)
+  * every external https:// host that appears in the built JS/CSS
+
+A host that no directive allows is a CSP violation waiting to happen the moment the
+code path that fetches it runs. A host that IS allowed somewhere may still violate on
+the specific directive that loads it (a style pulled from a script-src-only host, say)
+-- run the browser probe from SKILL.md to settle that.
+
+Bare --dist resolves this repo's frontend/build from any directory; pass a path only for
+a build elsewhere, and note it is relative to your shell, not to this script:
+
+    python3 scan_origins.py --dist                                 # after `bun run build`
+    python3 scan_origins.py --url https://us-central.unstract.com
+    python3 scan_origins.py --dist /tmp/other-build --conf /tmp/other-nginx.conf
+
+Exit non-zero on anything that means "this scan did not actually check the policy": a
+host in no fetch directive, a path or port outside what its sources allow, a --dist that
+is missing or holds no .js, a URL whose index names no bundle, or a failure fetching a
+chunk index.html links. A 404 on a path found only inside a bundle string is tolerated --
+that is usually a worker path a chunk names but never loads. A scan that inspected
+nothing must never look like a pass.
+"""
+
+import argparse
+import re
+import sys
+import time
+import urllib.error
+import urllib.request
+from pathlib import Path
+
+from extract_policy import DEFAULT_CONF, parse
+
+URL_RE = re.compile(
+    r"https://([a-zA-Z0-9][a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})(:\d+)?(/[^\s\"'`)\\<>]*)?"
+)
+
+# Directives that govern navigation or reporting rather than loading a subresource. A
+# host listed in one of them cannot be fetched on its strength, so letting it into the
+# allowed map would clear references the browser blocks.
+NON_FETCH_DIRECTIVES = {
+    "form-action",
+    "base-uri",
+    "frame-ancestors",
+    "report-uri",
+    "report-to",
+    "sandbox",
+}
+ASSET_RE = re.compile(r"/assets/[A-Za-z0-9_%.\-]+\.(?:js|css)")
+RELATIVE_ASSET_RE = re.compile(r"[\"'(](\./[A-Za-z0-9_%.\-]+\.(?:js|css))")
+
+# Hosts that only ever appear as documentation links, XML namespaces or library
+# error strings -- they are never fetched, so they need no CSP entry.
+IGNORED = {
+    "www.w3.org",
+    "json-schema.org",
+    "momentjs.com",
+    "github.com",
+    "raw.githubusercontent.com",
+    "reactjs.org",
+    "react.dev",
+    "redux.js.org",
+    "redux-toolkit.js.org",
+    "react-dnd.github.io",
+    "handlebarsjs.com",
+    "socket.io",
+    "npms.io",
+    "example.com",
+    "bit.ly",
+    "fb.me",
+    "yandex.com",
+    "sentry.io",
+    # posthog-js's built-in US defaults. Inert only because api_host is pinned to
+    # https://eu.i.posthog.com/ at frontend/src/index.jsx -- move that pin and these
+    # become live hosts the policy blocks, with this list keeping the gate quiet about it.
+    "posthog.com",
+    "app.posthog.com",
+    "us.posthog.com",
+    "us.i.posthog.com",
+    "us-assets.i.posthog.com",
+    "docs.unstract.com",
+    "join-slack.unstract.com",
+    "billing.stripe.com",
+    "checkout.stripe.com",
+    "fonts.google.com",
+}
+
+
+def read_dist(dist: Path) -> dict[str, str]:
+    # rglob on a missing directory yields nothing instead of raising, which would turn a
+    # mistyped --dist into a clean pass over zero files.
+    if not dist.is_dir():
+        raise SystemExit(f"--dist {dist} is not a directory (cwd: {Path.cwd()})")
+    files = {}
+    for pattern in ("*.js", "*.css", "*.html"):
+        for path in dist.rglob(pattern):
+            files[str(path.relative_to(dist))] = path.read_text(
+                encoding="utf-8", errors="ignore"
+            )
+    # index.html alone is not a build. Without this, an interrupted or wrong-directory
+    # build scans one file, finds no external host in it, and reads as a pass.
+    if not any(name.endswith(".js") for name in files):
+        raise SystemExit(f"--dist {dist} holds no .js bundle -- nothing to check")
+    return files
+
+
+def fetch(url: str, attempts: int = 3) -> str:
+    """One transient TLS or connection error should not redden the whole gate."""
+    for attempt in range(1, attempts + 1):
+        try:
+            return (
+                urllib.request.urlopen(url, timeout=20).read().decode("utf-8", "ignore")
+            )
+        except urllib.error.HTTPError:
+            raise  # a status code is an answer, not a blip
+        except Exception:  # noqa: BLE001 - retry, then let the caller record it
+            if attempt == attempts:
+                raise
+            time.sleep(attempt)
+    raise AssertionError("unreachable")
+
+
+def read_deployment(base_url: str) -> tuple[dict[str, str], list[str]]:
+    """Return ({name: body}, [fail
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -701,6 +701,7 @@ CLAUDE.md
 !.claude/skills/
 .claude/skills/*
 !.claude/skills/worktree/
+!.claude/skills/csp-check/
 CONTRIBUTION_GUIDE.md
 .mcp.json
 
```

**File**: `frontend/nginx.conf` (modified, +13/-2)
```diff
@@ -64,8 +64,19 @@ http {
         add_header X-Frame-Options "SAMEORIGIN" always;
         add_header Referrer-Policy "strict-origin-when-cross-origin" always;
 
-        # CSP in report-only mode: logs violations to browser console without blocking requests.
-        add_header Content-Security-Policy-Report-Only "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://js.stripe.com https://app.productfruits.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://eu.i.posthog.com https://eu-assets.i.posthog.com; font-src 'self' data:; connect-src 'self' blob: wss: https://cdn.jsdelivr.net https://eu.i.posthog.com https://eu-assets.i.posthog.com https://www.google-analytics.com https://api.stripe.com https://app.productfruits.com; frame-src 'self' https://www.google.com/recaptcha/ https://recaptcha.google.com https://js.stripe.com https://hooks.stripe.com; worker-src 'self' blob: https://unpkg.com https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'self'" always;
+        # CSP, enforcing: a resource from an origin no directive lists is blocked, not
+        # reported. Re-check with .claude/skills/csp-check before a frontend dependency
+        # starts loading from a new external host.
+        # connect-src carries no `wss:` wildcard: socket.io connects to window.location.origin
+        # (frontend/src/helpers/GetStaticData.js getBaseUrl), and 'self' covers same-origin
+        # ws/wss per CSP3.
+        # The Google analytics hosts are wildcarded because GA4 picks a regional collection
+        # host at runtime, so the set is not enumerable. Signals/Ads endpoints
+        # (*.g.doubleclick.net, www.google.com/g/collect) are deliberately not granted --
+        # enabling either in the GTM UI needs a policy change here.
+        # VITE_CUSTOM_LOGO_URL / VITE_FAVICON_PATH are governed by img-src: an absolute URL
+        # to an unlisted host is blocked, and both fall back silently.
+        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://js.stripe.com https://app.productfruits.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://app.productfruits.com; img-src 'self' data: blob: https://eu.i.posthog.com https://eu-assets.i.posthog.com https://cdn.jsdelivr.net https://app.productfruits.com https://cdn.productfruits.com https://*.googletagmanager.com https://*.google-analytics.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://q.stripe.com; font-src 'self' data: https://cdn.jsdelivr.net https://app.productfruits.com https://cdn.productfruits.com; connect-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.googletagmanager.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.google.com/recaptcha/ https://api.stripe.com https://m.stripe.network https://app.productfruits.com https://api.productfruits.com; frame-src 'self' https://www.google.com/recaptcha/ https://recaptcha.google.com https://*.googletagmanager.com https://js.stripe.com https://hooks.stripe.com https://m.stripe.network; media-src 'self' blob: https://cdn.productfruits.com; worker-src 'self' blob: https://unpkg.com https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'self'" always;
 
         # Cache-Control from the $cache_control map (immutable for /assets/*,
         # no-cache otherwise). Declared at server scope alongside the security
```

---

### Incident Patch 5: `ff9eaddf` (2026-09-29)
**Commit Message**: UN-2646 [FIX] Skip the OSS-only vlm_utils contract in a merged cloud tree (#2304)

Cloud CI runs this suite against the OSS tree with the cloud plugins copied
in, so plugins/vlm_image_answer is importable and
test_cloud_package_absent_in_oss fails on every cloud run now that #2210 has
merged and unstract-cloud#1690 supplies the plugin.

Skip the class wholesale rather than that one test: once the hooks are real,
the remaining "returns None" / "does not raise" assertions stop describing
no-ops and pass for reasons they never meant to check. Delegation in that
tree is already covered by the cloud_hooks tests.

Verified both ways: OSS-only tree 10 passed; with plugins/vlm_image_answer
copied in, 5 passed and 5 skipped.

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/prompt_studio/tests/test_vlm_utils.py` (modified, +17/-0)
```diff
@@ -15,7 +15,24 @@
 from prompt_studio import vlm_utils
 
 
+@pytest.mark.skipif(
+    vlm_utils.VLM_IMAGE_ANSWER_AVAILABLE,
+    reason=(
+        "cloud plugin merged into the tree (cloud CI runs this suite against "
+        "the OSS tree with plugins/vlm_image_answer copied in) — the "
+        "package-absent contract below only holds in an OSS-only tree"
+    ),
+)
 class TestOssNoOps:
+    """The OSS-only state: no cloud package, so every helper is a no-op.
+
+    Skipped wholesale rather than per-test in a merged cloud tree: once the
+    hooks are real, "returns None" and "does not raise" stop being no-op
+    assertions and start depending on what the cloud hook does with the
+    dummy arguments below — passing for reasons these tests never meant to
+    check. Delegation in that tree is covered by the cloud_hooks tests.
+    """
+
     def test_cloud_package_absent_in_oss(self) -> None:
         assert vlm_utils.VLM_IMAGE_ANSWER_AVAILABLE is False
 
```

---

### Incident Patch 6: `f9dc6656` (2026-09-29)
**Commit Message**: UN-4136 [FIX] Report PG worker pods ready only after every consumer child has loaded (#2301)

UN-4136 Serve /ready from the PG consumer so a startupProbe can wait for every child to load

A prefork PG consumer pod went Ready ~20s after start while its N children
were still running their own `import worker` bootstrap in parallel (3-8
cores for 1-2 minutes). Kubernetes' HPA only discards CPU sampled before a
pod turns Ready, so it read that burst as load: on integration it drove
api-file-processing 2 -> 30 pods in ~75s, and CAST AI's HPA calibration
raised the CPU request to 1.1-1.4 cores from it.

/health cannot express "still loading": the heartbeats are seeded fresh so
liveness does not trip during a slow import. Add a separate /ready:

- LivenessServer takes an optional ready_fn and serves /ready (/readyz):
  200 when it returns True, 503 "starting" otherwise or if it raises. With
  no ready_fn the path stays a 404, so a probe aimed at the reaper fails.
- The supervisor keeps a shared per-child "loaded" flag. A child sets its
  slot after `import worker` and building its consumer; reap() clears it.
  /ready is 200 only when every slot is set, and the JSON reports
  loaded_childre

**File**: `workers/pg_queue_consumer/supervisor.py` (modified, +54/-8)
```diff
@@ -23,6 +23,14 @@
 a row, never reaching a real poll) forces the probe to 503 so k8s restarts the
 pod rather than the supervisor masking a wedged fleet with fresh-looking re-forks.
 
+**Readiness** (UN-4136): the same port serves ``/ready``, which answers 200 only
+once EVERY child has finished its ``import worker`` bootstrap and built its
+consumer. ``/health`` cannot say this — the heartbeats are seeded fresh at
+construction so liveness does not trip during a slow import — which is why a pod
+used to go Ready ~20s after start while its N children were still importing, and
+the HPA counted that multi-core start-up burst as load. A k8s ``startupProbe`` on
+``/ready`` keeps the pod NotReady until the burst is over.
+
 **Fork safety**: the initial fleet is forked while the parent is single-threaded.
 Re-forks happen after the liveness daemon thread exists; the only other thread is
 that probe (idle in ``select`` between requests, and CPython 3.12 re-inits the
@@ -152,6 +160,11 @@ def __init__(self, concurrency: int) -> None:
         now = time.time()
         for i in range(concurrency):
             self._heartbeats[i] = now
+        # Shared, fork-inherited "finished loading" flags (one per child), read by
+        # /ready. Same write discipline as the heartbeats: the owning child sets
+        # its slot once bootstrapped; the parent clears it in reap(), when no child
+        # owns the slot. Zero-initialised, so a fresh fleet starts not-ready.
+        self._loaded = multiprocessing.Array("b", concurrency, lock=False)
         self._pids: dict[int, int] = {}
         self._last_fork: dict[int, float] = {}
         self._consecutive_crashes: dict[int, int] = {}
@@ -168,6 +181,13 @@ def heartbeats(self):  # noqa: ANN201
         """
         return self._heartbeats
 
+    @property
+    def loaded(self):  # noqa: ANN201
+        """The shared loaded-flag array (a ctypes array, passed to forked children,
+        which set their own slot once bootstrapped).
+        """
+        return self._loaded
+
     def _validate(self, slot: int) -> None:
         if not 0 <= slot < self._n:
             raise IndexError(f"slot {slot} out of range [0, {self._n})")
@@ -184,9 +204,14 @@ def record_fork(self, slot: int, pid: int) -> None:
         self._restart_due.pop(slot, None)
 
     def reap(self, slot: int) -> float:
-        """Drop the slot's pid + last-fork together; return the child's uptime (s)."""
+        """Drop the slot's pid + last-fork together; return the child's uptime (s).
+
+        Also clears the slot's loaded flag: its replacement must finish its own
+        bootstrap before the fleet counts as loaded again.
+        """
         forked_at = self._last_fork.pop(slot, time.monotonic())
         self._pids.pop(slot, None)
+        self._loaded[slot] = 0
         return time.monotonic() - forked_at
 
     def schedule_restart(self, slot: int, uptime: float) -> int:
@@ -231,6 +256,14 @@ def is_crash_looping(self) -> bool:
             n >= _CRASH_LOOP_THRESHOLD for n in tuple(self._consecutive_crashes.values())
         )
 
+    def loaded_count(self) -> int:
+        """Children that have finished their bootstrap (``import worker`` + build)."""
+        return sum(self._loaded)
+
+    def all_loaded(self) -> bool:
+        """Readiness verdict source: True once every slot's child has loaded."""
+        return self.loaded_count() == self._n
+
     def oldest_age(self) -> float:
         now = time.time()
         return max((now - hb for hb in self._heartbeats), default=0.0)
@@ -244,14 +277,16 @@ def freshness(self) -> float:
         return float("inf") if self.is_crash_looping() else self.oldest_age()
 
 
-def _run_child(slot: int, heartbeats) -> None:  # noqa: ANN001 (ctypes array)
+def _run_child(slot: int, heartbeats, loaded) -> None:  # noqa: ANN001 (ctypes arrays)
     """Build one consumer and run it forever, publishing its heartbeat.
 
     The worker import (and any connections it opens) happens HERE, in the child —
     never inherited across the fork — so each process owns its own connections.
     A *guarded* daemon thread publishes the consumer's last-poll wall-time into
-    ``heartbeats[slot]`` for the supervisor's fleet liveness.
+    ``heartbeats[slot]`` for the supervisor's fleet liveness, and ``loaded[slot]``
+    is set once the bootstrap is done, for the supervisor's ``/ready``.
     """
+    started = time.monotonic()
     from pg_queue_consumer._bootstrap import select_source_worker_type
 
     select_source_worker_type()  # set WORKER_TYPE before importing worker
@@ -277,11 +312,17 @@ def _publish_heartbeat() -> None:
             time.sleep(_REPORT_INTERVAL_SECONDS)
 
     threading.Thread(target=_publish_heartbeat, daemon=True, name=f"pg-hb-{slot}").start()
+    loaded[slot] = 1
+    logger.info(
+        "PG-queue consumer: child slot=%s loaded in %.1fs",
+        slot,
+        time.monotonic() - started,
+    )
     # consumer.run() installs its own SIGTERM/SIGINT 
```

**File**: `workers/queue_backend/pg_queue/README.md` (modified, +8/-0)
```diff
@@ -113,6 +113,14 @@ deadline**, then SIGKILLs stragglers. Must be ≤ the pod's
 the supervisor reports the *oldest* child's staleness on `/health`. Frozen during a
 long task, so a wedged child goes stale and trips the probe.
 
+**Readiness** — `/ready` on the same port answers 200 only once **every** child has
+finished its `import worker` bootstrap and built its consumer (503 `starting` until
+then; the JSON carries `loaded_children`). It is for a k8s `startupProbe`: the N
+children import in parallel for a minute or two at multiple cores, and a pod that is
+not yet Ready has that CPU ignored by the HPA instead of read as load. Single-process
+consumers (`CONCURRENCY = 1`) answer 200 as soon as the port is up, since they bind it
+only after loading. The reaper serves no `/ready` (404).
+
 **Reaper** — a singleton (leader-elected) sweeper that recovers **stranded** work:
 fast-fails a barrier whose `last_progress_at` stalled, cascades a terminal
 execution to its files, and sweeps expired retention rows.
```

**File**: `workers/queue_backend/pg_queue/consumer.py` (modified, +6/-0)
```diff
@@ -1212,6 +1212,11 @@ class LivenessServer(_BaseLivenessServer):
     consumer's heartbeat (``seconds_since_last_poll``). Same wire shape as before
     (``/health`` → 200 fresh / 503 stale, ``check="pg_queue_poll"``), plus
     ``/metrics`` exporting that heartbeat as a scrapeable gauge.
+
+    ``/ready`` is always 200 here: it takes an already-built consumer, and
+    ``main()`` only starts it after ``import worker`` and the build, so a probe
+    that can reach it is talking to a loaded process. The same ``startupProbe``
+    therefore works for single-process and prefork pools alike.
     """
 
     def __init__(
@@ -1227,6 +1232,7 @@ def __init__(
             check_name="pg_queue_poll",
             age_key="seconds_since_last_poll",
             metrics_fn=metrics.render,
+            ready_fn=lambda: True,
             thread_name="pg-consumer-liveness",
             log_label="pg-queue consumer",
         )
```

**File**: `workers/queue_backend/pg_queue/liveness.py` (modified, +47/-10)
```diff
@@ -17,6 +17,12 @@
 container/k8s probe reaches it from outside the process) in a daemon thread.
 Bind ``port=0`` to let the OS pick a free port (read back via :attr:`bound_port`)
 — used in tests. Start once; :meth:`stop` returns it to the inert state.
+
+Optionally also serves ``/ready`` (also ``/readyz``): "has this process finished
+loading?", answered by a ``ready_fn`` callable. It is a separate question from
+liveness — a process can be alive while it is still importing — and exists for a
+k8s ``startupProbe`` (UN-4136): a pod that is not yet Ready has its start-up CPU
+ignored by the HPA, so the import burst cannot trigger a scale-out.
 """
 
 from __future__ import annotations
@@ -46,9 +52,15 @@ class LivenessServer:
     module stays free of the prometheus dependency; the metric definitions live
     in :mod:`queue_backend.pg_queue.metrics`. A ``metrics_fn`` failure returns
     500 on ``/metrics`` only — it can never affect the ``/health`` verdict.
+
+    ``ready_fn`` (optional) additionally serves ``/ready``: 200 once it returns
+    True, else 503. Without it ``/ready`` is a 404, so a probe pointed at a
+    process that has no readiness notion fails loudly instead of passing. A
+    ``ready_fn`` that raises answers 503 — never a false "ready".
     """
 
     _PATHS = frozenset({"/health", "/healthz", "/livez"})
+    _READY_PATHS = frozenset({"/ready", "/readyz"})
     _METRICS_PATH = "/metrics"
     # Prometheus text exposition format (metrics.METRICS_CONTENT_TYPE — inlined
     # so this module keeps zero imports from the metrics side).
@@ -64,6 +76,7 @@ def __init__(
         age_key: str,
         extra_status_fn: Callable[[], dict[str, Any]] | None = None,
         metrics_fn: Callable[[], bytes] | None = None,
+        ready_fn: Callable[[], bool] | None = None,
         thread_name: str = "pg-queue-liveness",
         log_label: str = "pg-queue",
     ) -> None:
@@ -79,6 +92,7 @@ def __init__(
         self._age_key = age_key
         self._extra_status_fn = extra_status_fn
         self._metrics_fn = metrics_fn
+        self._ready_fn = ready_fn
         self._thread_name = thread_name
         # Prefixes the (now-shared) log messages so they stay attributable to the
         # source process after the consumer/reaper extraction (e.g. "pg-queue
@@ -99,9 +113,11 @@ def start(self) -> None:
         freshness_fn = self._freshness_fn
         stale_after = self._stale_after
         paths = self._PATHS
+        ready_paths = self._READY_PATHS
         metrics_path = self._METRICS_PATH
         metrics_content_type = self._METRICS_CONTENT_TYPE
         metrics_fn = self._metrics_fn
+        ready_fn = self._ready_fn
         check_name = self._check_name
         age_key = self._age_key
         extra_status_fn = self._extra_status_fn
@@ -114,6 +130,9 @@ def do_GET(self) -> None:
                 if metrics_fn is not None and path == metrics_path:
                     self._serve_metrics()
                     return
+                if ready_fn is not None and path in ready_paths:
+                    self._serve_ready()
+                    return
                 if path not in paths:
                     self.send_response(404)
                     self.end_headers()
@@ -123,26 +142,44 @@ def do_GET(self) -> None:
                 # fields are informational and never flip it.
                 age = freshness_fn()
                 stale = age > stale_after
-                # Extra fields first, then overlay the core fields — so a caller's
-                # extra_status_fn can NEVER clobber status/check/age_key/
-                # stale_after_seconds (which a monitor reads): core always wins.
-                payload: dict[str, Any] = {}
-                if extra_status_fn is not None:
-                    payload.update(extra_status_fn())
-                payload.update(
+                self._send_json(
+                    503 if stale else 200,
                     {
                         "status": "unhealthy" if stale else "healthy",
                         "check": check_name,
                         age_key: round(age, 3),
                         "stale_after_seconds": stale_after,
-                    }
+                    },
+                )
+
+            def _serve_ready(self) -> None:
+                # A readiness check that raises must read as NOT ready: answering
+                # 200 would let the pod go Ready (and its start-up CPU count toward
+                # the HPA) on the strength of a bug.
+                try:
+                    ready = bool(ready_fn())  # type: ignore[misc]  # guarded by caller
+                except Exception:
+                    logger.exception("%s: readiness check failed", log_label)
+                    ready = False
+                self._send_json(
+                    200 if ready else 503,
+                    {"status": "ready" if ready else "starting", "check": check_name},
                 )
+
+            def _send_jso
```

**File**: `workers/tests/test_pg_consumer_supervisor.py` (modified, +126/-5)
```diff
@@ -24,6 +24,7 @@
     _join_children,
     _reap_dead,
     _restart_due_children,
+    _run_child,
     _try_fork_child,
     _wait_for_exit,
     concurrency_from_env,
@@ -184,6 +185,34 @@ def test_due_restarts_respects_backoff(self, monkeypatch):
         clock[0] += 100.0  # well past any backoff
         assert f.due_restarts() == [0]
 
+    # --- readiness (UN-4136) ---------------------------------------------------
+
+    def test_fresh_fleet_is_not_loaded(self):
+        # Unlike the heartbeats (seeded fresh), nothing is loaded at construction:
+        # a pod must not go Ready before its children have imported.
+        f = _Fleet(3)
+        assert f.loaded_count() == 0
+        assert f.all_loaded() is False
+
+    def test_all_loaded_only_when_every_slot_has_loaded(self):
+        f = _Fleet(3)
+        f.loaded[0] = 1
+        f.loaded[2] = 1
+        assert f.loaded_count() == 2
+        assert f.all_loaded() is False  # slot 1 still importing
+        f.loaded[1] = 1
+        assert f.all_loaded() is True
+
+    def test_reap_clears_the_slot_loaded_flag(self):
+        # A dead child's replacement must bootstrap again before the fleet counts
+        # as loaded; the stale flag must not carry over.
+        f = _Fleet(2)
+        f.loaded[0] = f.loaded[1] = 1
+        f.record_fork(1, 111)
+        f.reap(1)
+        assert list(f.loaded) == [1, 0]
+        assert f.all_loaded() is False
+
 
 class TestReapDead:
     def test_dead_child_reaped_and_rescheduled(self):
@@ -258,19 +287,32 @@ def test_parent_records_child(self):
             assert _try_fork_child(f, 0) is True
         assert f.alive_items() == [(0, 222)]
 
+    def test_child_is_handed_the_shared_heartbeat_and_loaded_arrays(self):
+        # The child writes its own slot in BOTH arrays; handing it a copy (or not
+        # handing over `loaded` at all) would leave /ready stuck at 503.
+        f = _Fleet(1)
+        with (
+            patch(f"{_MOD}.os.fork", return_value=0),  # we are the child
+            patch(f"{_MOD}._child_after_fork", side_effect=SystemExit) as child,
+        ):
+            with pytest.raises(SystemExit):
+                _try_fork_child(f, 0)
+        child.assert_called_once_with(0, f.heartbeats, f.loaded)
+
 
 class TestChildAfterFork:
     def test_resets_signals_and_exits_zero_on_clean_run(self):
         with (
             patch(f"{_MOD}.signal.signal") as sig,
-            patch(f"{_MOD}._run_child"),
+            patch(f"{_MOD}._run_child") as run,
             patch(f"{_MOD}.os._exit", side_effect=SystemExit) as exit_,
         ):
-            queue = MagicMock()
+            heartbeats, loaded = MagicMock(), MagicMock()
             with pytest.raises(SystemExit):
-                _child_after_fork(0, queue)
+                _child_after_fork(0, heartbeats, loaded)
         # SIGTERM + SIGINT reset to default before running.
         assert sig.call_count == 2
+        run.assert_called_once_with(0, heartbeats, loaded)
         exit_.assert_called_once_with(0)
 
     def test_hard_exits_one_when_run_raises(self):
@@ -279,12 +321,51 @@ def test_hard_exits_one_when_run_raises(self):
             patch(f"{_MOD}._run_child", side_effect=RuntimeError("boom")),
             patch(f"{_MOD}.os._exit", side_effect=SystemExit) as exit_,
         ):
-            queue = MagicMock()
             with pytest.raises(SystemExit):
-                _child_after_fork(0, queue)
+                _child_after_fork(0, MagicMock(), MagicMock())
         exit_.assert_called_once_with(1)
 
 
+class TestRunChildLoaded:
+    """The child marks itself loaded only after the bootstrap, and before it
+    starts polling (UN-4136).
+    """
+
+    @staticmethod
+    def _run_slot_1(fleet: _Fleet, build) -> None:  # noqa: ANN001
+        # No real `import worker` bootstrap and no real heartbeat thread.
+        with (
+            patch.dict("sys.modules", {"worker": MagicMock()}),
+            patch("pg_queue_consumer._bootstrap.select_source_worker_type"),
+            patch(
+                "queue_backend.pg_queue.consumer.build_consumer_from_env",
+                side_effect=build,
+            ),
+            patch(f"{_MOD}.threading.Thread"),
+        ):
+            _run_child(1, fleet.heartbeats, fleet.loaded)
+
+    def test_marks_its_slot_loaded_before_polling(self):
+        f = _Fleet(2)
+        seen: list[list[int]] = []
+        consumer = MagicMock()
+        # Snapshot the flags at the moment polling would begin.
+        consumer.run.side_effect = lambda: seen.append(list(f.loaded))
+        self._run_slot_1(f, lambda: consumer)
+        assert seen == [[0, 1]]  # own slot only, and set before run()
+
+    def test_not_marked_loaded_when_the_build_fails(self):
+        # A child that cannot finish its bootstrap must never count as loaded.
+        f = _Fleet(2)
+
+        def _boom():  # noqa: ANN202
+            raise RuntimeError("cannot build")
+
+        with pytest.raises(RuntimeError, match="ca
```

**File**: `workers/tests/test_pg_queue_consumer.py` (modified, +76/-0)
```diff
@@ -738,6 +738,82 @@ def test_liveness_aliases_and_unknown_path(self):
         finally:
             server.stop()
 
+    def test_single_process_ready_is_200_once_serving(self):
+        # UN-4136: the single-process server only starts after `import worker` and
+        # the consumer build, so reaching /ready means loaded. The chart's
+        # startupProbe hits /ready on every PG consumer, CONCURRENCY=1 included.
+        import json
+        import urllib.request
+
+        from queue_backend.pg_queue.consumer import LivenessServer
+
+        consumer = PgQueueConsumer(["q"], client=MagicMock())
+        server = LivenessServer(consumer, port=0, stale_after=60)
+        server.start()
+        try:
+            base = f"http://127.0.0.1:{server.bound_port}"
+            for path in ("/ready", "/readyz", "/ready?probe=startup"):
+                with urllib.request.urlopen(f"{base}{path}", timeout=5) as resp:
+                    assert resp.status == 200, path
+                    assert json.loads(resp.read())["status"] == "ready", path
+        finally:
+            server.stop()
+
+    def test_ready_is_404_without_a_ready_fn(self):
+        # A process with no readiness notion (e.g. the reaper) must NOT answer
+        # /ready with a pass — a startupProbe mistakenly pointed at it has to fail.
+        import urllib.error
+        import urllib.request
+
+        from queue_backend.pg_queue.liveness import LivenessServer as Base
+
+        server = Base(
+            freshness_fn=lambda: 0.0,
+            stale_after=60,
+            port=0,
+            check_name="t",
+            age_key="age",
+        )
+        server.start()
+        try:
+            with pytest.raises(urllib.error.HTTPError) as ei:
+                urllib.request.urlopen(
+                    f"http://127.0.0.1:{server.bound_port}/ready", timeout=5
+                )
+            assert ei.value.code == 404
+        finally:
+            server.stop()
+
+    def test_ready_fn_that_raises_answers_503_and_leaves_health_alone(self):
+        import json
+        import urllib.error
+        import urllib.request
+
+        from queue_backend.pg_queue.liveness import LivenessServer as Base
+
+        def _broken() -> bool:
+            raise RuntimeError("boom")
+
+        server = Base(
+            freshness_fn=lambda: 0.0,
+            stale_after=60,
+            port=0,
+            check_name="t",
+            age_key="age",
+            ready_fn=_broken,
+        )
+        server.start()
+        try:
+            base = f"http://127.0.0.1:{server.bound_port}"
+            with pytest.raises(urllib.error.HTTPError) as ei:
+                urllib.request.urlopen(f"{base}/ready", timeout=5)
+            assert ei.value.code == 503
+            assert json.loads(ei.value.read())["status"] == "starting"
+            with urllib.request.urlopen(f"{base}/health", timeout=5) as resp:
+                assert resp.status == 200  # readiness never flips liveness
+        finally:
+            server.stop()
+
     def test_double_start_is_rejected(self):
         from queue_backend.pg_queue.consumer import LivenessServer
 
```

---

### Incident Patch 7: `c7277eeb` (2026-09-29)
**Commit Message**: UN-4183 [MISC] Run frontend typecheck and tests in CI and make the frontend test group required (#2302)

* UN-4183 Run frontend typecheck and vitest in CI; make the frontend test group required

- bun.lock: record TypeScript 7's native compiler packages, without which
  tsc cannot start on any platform, so typecheck never actually ran
- Fix the one type error that surfaced in antd-inputs.tsx
- ci-frontend-lint.yaml: add typecheck and vitest jobs (gate frontend-only PRs)
- ci-test.yaml: install frontend deps on the unit leg
- groups.yaml: drop optional from the frontend vitest group

* UN-4183 Address review: job-level path filter, --ignore-scripts, bun run test

- Filter frontend/** in a changes job instead of the pull_request trigger, so
  typecheck/vitest report skipped (not missing) on other PRs and can be made
  required checks
- bun install --ignore-scripts (Sonar S6505)
- bun run test --run instead of bunx vitest (Sonar S8543)

* UN-4183 Fail open when the frontend path filter job fails

A skipped job satisfies a required check, so a failed changes job must make
the frontend checks run, not skip.

**File**: `.github/workflows/ci-frontend-lint.yaml` (modified, +81/-4)
```diff
@@ -1,21 +1,49 @@
-name: Frontend Lint (Biome)
+name: Frontend CI (Biome, typecheck, tests)
 
 on:
   push:
     branches:
       - main
     paths:
       - "frontend/**"
+  # No `paths` on pull_request: an untriggered workflow reports no check run,
+  # so a required check would wait forever on non-frontend PRs. Filtering is
+  # done by the `changes` job instead — a job skipped via `if:` reports
+  # `skipped`, which satisfies a required check. Same pattern as ci-test.yaml.
   pull_request:
     types: [opened, synchronize, reopened, ready_for_review]
     branches: [main]
-    paths:
-      - "frontend/**"
 
 jobs:
-  biome-ci:
+  # Gating jobs below run when `changes` finds frontend files, AND whenever
+  # `changes` itself did not succeed: a skipped job satisfies a required
+  # check, so a broken filter must fail open (run the checks), never skip them.
+  # `!cancelled()` is what lets them run past a failed dependency.
+  changes:
     if: github.event.pull_request.draft == false
     runs-on: ubuntu-latest
+    outputs:
+      # Push is already path-filtered by its trigger, so force true off-PR.
+      frontend: ${{ github.event_name != 'pull_request' || steps.filter.outputs.frontend == 'true' }}
+    steps:
+      - name: Checkout repository
+        uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6.0.3
+        with:
+          persist-credentials: false
+
+      - name: Check for frontend changes
+        if: github.event_name == 'pull_request'
+        uses: dorny/paths-filter@7b450fff21473bca461d4b92ce414b9d0420d706 # v4.0.2
+        id: filter
+        with:
+          filters: |
+            frontend:
+              - "frontend/**"
+
+  biome-ci:
+    needs: changes
+    if: ${{ !cancelled() && github.event.pull_request.draft != true && (needs.changes.result != 'success' || needs.changes.outputs.frontend == 'true') }}
+    runs-on: ubuntu-latest
 
     steps:
       - name: Checkout repository
@@ -68,3 +96,52 @@ jobs:
       - name: Fail if Biome found issues
         if: steps.biome.outputs.exit_code != '0'
         run: exit 1
+
+  # Vite/esbuild strip types without checking them, so a green build says
+  # nothing about the .tsx files — tsc is the only thing that does.
+  typecheck:
+    needs: changes
+    if: ${{ !cancelled() && github.event.pull_request.draft != true && (needs.changes.result != 'success' || needs.changes.outputs.frontend == 'true') }}
+    runs-on: ubuntu-latest
+
+    steps:
+      - name: Checkout repository
+        uses: actions/checkout@v6
+
+      - name: Setup Bun
+        uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
+
+      - name: Install dependencies
+        working-directory: frontend
+        # No dependency lifecycle scripts: nothing here needs them (tsc and
+        # esbuild ship per-platform binaries as optionalDependencies).
+        run: bun install --frozen-lockfile --ignore-scripts
+
+      - name: Run TypeScript typecheck
+        working-directory: frontend
+        run: bun run typecheck
+
+  # ci-test.yaml runs the same suite as the rig's `frontend` group, but its
+  # tiers skip frontend-only PRs; this job is what gates those.
+  vitest:
+    needs: changes
+    if: ${{ !cancelled() && github.event.pull_request.draft != true && (needs.changes.result != 'success' || needs.changes.outputs.frontend == 'true') }}
+    runs-on: ubuntu-latest
+
+    steps:
+      - name: Checkout repository
+        uses: actions/checkout@v6
+
+      - name: Setup Bun
+        uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
+
+      - name: Install dependencies
+        working-directory: frontend
+        # No dependency lifecycle scripts: nothing here needs them (tsc and
+        # esbuild ship per-platform binaries as optionalDependencies).
+        run: bun install --frozen-lockfile --ignore-scripts
+
+      - name: Run Vitest
+        working-directory: frontend
+        # The package script, so the lockfile's vitest runs, never a fetched one.
+        run: bun run test --run
```

**File**: `.github/workflows/ci-test.yaml` (modified, +12/-0)
```diff
@@ -102,6 +102,18 @@ jobs:
         # so this constrains nothing and resolves identically.
         run: uv tool install tox==4.64.1 --with tox-uv==1.36.0 --no-build
 
+      - name: Setup Bun
+        # The unit tier's `frontend` vitest group is required, and the rig runs
+        # it with `npx --no-install`, so node_modules must already be there.
+        if: matrix.tier == 'unit'
+        uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
+
+      - name: Install frontend dependencies
+        if: matrix.tier == 'unit'
+        working-directory: frontend
+        # No dependency lifecycle scripts: vitest needs none of them.
+        run: bun install --frozen-lockfile --ignore-scripts
+
       - name: Validate test manifests
         # Cheap pre-flight: catches manifest schema errors before tier runs.
         run: tox -e rig -- validate
```

**File**: `frontend/bun.lock` (modified, +41/-1)
```diff
@@ -720,6 +720,46 @@
 
     "@types/ws": ["@types/ws@8.18.1", "", { "dependencies": { "@types/node": "*" } }, "sha512-ThVF6DCVhA8kUGy+aazFQ4kXQ7E1Ty7A3ypFOe0IcJV8O/M511G99AW24irKrW56Wt44yG9+ij8FaqoBGkuBXg=="],
 
+    "@typescript/typescript-aix-ppc64": ["@typescript/typescript-aix-ppc64@7.0.2", "", { "os": "aix", "cpu": "ppc64" }, "sha512-MTKKkWB7p/0E9xi1d1tHtZ5PiLkGEMIq88pK2CubZjOsLtYTLqhgIgi6zepFa+9GHZ6h05NMCkQxGKiPXMxXtQ=="],
+
+    "@typescript/typescript-darwin-arm64": ["@typescript/typescript-darwin-arm64@7.0.2", "", { "os": "darwin", "cpu": "arm64" }, "sha512-gowzar9MwS/aRWp6f3a4KUqzRjAZjOsmGNCM6LcTgXum+dBfgsBVMN+AgvOCCbguXyick6LJhpBszxMebJ8syA=="],
+
+    "@typescript/typescript-darwin-x64": ["@typescript/typescript-darwin-x64@7.0.2", "", { "os": "darwin", "cpu": "x64" }, "sha512-SZ9xZInqApNlNGc9s0W1VSsktYSOe9cFqNOIqmN1Gs8SmkjKZYFt017G4VwPxASInODuAdbTW7sXiFUf893RgA=="],
+
+    "@typescript/typescript-freebsd-arm64": ["@typescript/typescript-freebsd-arm64@7.0.2", "", { "os": "freebsd", "cpu": "arm64" }, "sha512-W5NH4y/J0plIIS5b2xvTEkU7JFxyqdMAOgf+Ilhl0vHQXKO5dZoxd+C/jEtq56c4F3wk71RB4BMRQ2XdI+bwYQ=="],
+
+    "@typescript/typescript-freebsd-x64": ["@typescript/typescript-freebsd-x64@7.0.2", "", { "os": "freebsd", "cpu": "x64" }, "sha512-UMGDx5sTpzNw3WiPebH7l90IWfJggEd+egHt/q6p7/Cm3zqoV7VxkGXt+3DxPIw8CcmvAB0j3sVVfbhX+M4Tpw=="],
+
+    "@typescript/typescript-linux-arm": ["@typescript/typescript-linux-arm@7.0.2", "", { "os": "linux", "cpu": "arm" }, "sha512-gffT3xPz9sR7j/YJExkyPntrI0P2EP9XbOyWzth2/Gs0RstK+90RBcO0ncXoXy/beYll1SXw846Nf2zdnEz0QQ=="],
+
+    "@typescript/typescript-linux-arm64": ["@typescript/typescript-linux-arm64@7.0.2", "", { "os": "linux", "cpu": "arm64" }, "sha512-Qh4eU4/y3yDjnfjjyPYihMj5/ODIlmt+Bzu17OI+fiSRDW57QmU5SiN63exPRNJPKUzcc1INa1NXdrJ+MqHjUQ=="],
+
+    "@typescript/typescript-linux-loong64": ["@typescript/typescript-linux-loong64@7.0.2", "", { "os": "linux", "cpu": "none" }, "sha512-uEHck9i8hoAzXPiYRib1O7miOnz23SxIeVl6F4LXox+qov1K35jHcEW6VHKvZI+pyvl7fZEP4MCU5LYvIq1GuQ=="],
+
+    "@typescript/typescript-linux-mips64el": ["@typescript/typescript-linux-mips64el@7.0.2", "", { "os": "linux", "cpu": "none" }, "sha512-R4KvAMnE43W5Qeqb0Ly56O3mWMWIAgsMyz36DCaycd5nbg/9kzm0liw3JocfRqyJY0KPmzFjbswozXyW0DnIYA=="],
+
+    "@typescript/typescript-linux-ppc64": ["@typescript/typescript-linux-ppc64@7.0.2", "", { "os": "linux", "cpu": "ppc64" }, "sha512-DORx5b3sd/4S7eayxm4FQv+A7CrkUIGRaHiwI8oiHTAI1fAPWhF4J0vAlkC8biAlHSVVwxMQ3tjZ2/DVbnQiiA=="],
+
+    "@typescript/typescript-linux-riscv64": ["@typescript/typescript-linux-riscv64@7.0.2", "", { "os": "linux", "cpu": "none" }, "sha512-wf0jqEDOjrPRnKwYRyyJDRo11KMbvMFrU+q4zqKyChODBzvlkbhNQfKvLxQCcwTpdDaXSHZTVuh0JoCrKCUMHQ=="],
+
+    "@typescript/typescript-linux-s390x": ["@typescript/typescript-linux-s390x@7.0.2", "", { "os": "linux", "cpu": "s390x" }, "sha512-IkwJc3L7yhytWd/ewjyxNDfOmswCm9GWMJT/ue/dU4aZNbwZeYAetq42VyLmsmSjvoX7z74X6ZaYCtzAr0EuGw=="],
+
+    "@typescript/typescript-linux-x64": ["@typescript/typescript-linux-x64@7.0.2", "", { "os": "linux", "cpu": "x64" }, "sha512-EYdf2cNg7rgCWJnxCdJ+F3V39O8ihb37eHAu1LK8oAFizgTQbPOK7zHHXbPt8rX24COqODXeI3sIf0fCXG7H/A=="],
+
+    "@typescript/typescript-netbsd-arm64": ["@typescript/typescript-netbsd-arm64@7.0.2", "", { "os": "none", "cpu": "arm64" }, "sha512-+polYF4MF04aPpO5FTkHran9yUQDSXqy5GiSDKpsll5jy3l3+g9QLhpf39T+ePtefhXLOGrLl0QIjkQP6VnelA=="],
+
+    "@typescript/typescript-netbsd-x64": ["@typescript/typescript-netbsd-x64@7.0.2", "", { "os": "none", "cpu": "x64" }, "sha512-8YIT0EHM/3dq10ZOVF/A7pc/YSMtbcecct4rWtexrnSCHOPcpC2KTLXfTCR6vDpnSiY12heNb1GiN/wu+T/FyA=="],
+
+    "@typescript/typescript-openbsd-arm64": ["@typescript/typescript-openbsd-arm64@7.0.2", "", { "os": "openbsd", "cpu": "arm64" }, "sha512-APT8+ClYnuYm1u9+kgGXoMj2VzWzcymwh2gNSQVySHfkRDGOTVkoWLjCmOQSaO+PoqQ57B0flRp9SA+7GnnkzQ=="],
+
+    "@typescript/typescript-openbsd-x64": ["@typescript/typescript-openbsd-x64@7.0.2", "", { "os": "openbsd", "cpu": "x64" }, "sha512-yX7s+Q0Dln0Dt9tEzZsAjXXR/+ytBM7AlglaqyeMPxQszJ1JhlJdZ6jLA+IzldHtflX81em7lDao1xXu+aRRkg=="],
+
+    "@typescript/typescript-sunos-x64": ["@typescript/typescript-sunos-x64@7.0.2", "", { "os": "sunos", "cpu": "x64" }, "sha512-dLJDGaLZ1D4HPQn62u1n8mBDkJREwMsAkCdkwd4Ieqw+x3TUyTsqY0YiBCtE6H6OzzgGk3iuZ3vFWRS+E8/d1g=="],
+
+    "@typescript/typescript-win32-arm64": ["@typescript/typescript-win32-arm64@7.0.2", "", { "os": "win32", "cpu": "arm64" }, "sha512-Gyl1Vy6OsWesLzmq+EP0Fb7b4Nid5232AvcA2SFcdYreldpNtYFFofPjnt62y9hQy7VTaZp65ICJjuAQRaVcIQ=="],
+
+    "@typescript/typescript-win32-x64": ["@typescript/typescript-win32-x64@7.0.2", "", { "os": "win32", "cpu": "x64" }, "sha512-0BQ3HkAHHlKLSp1qRvf3SUhGpGsDuhB/jgFw75guyqbxJqEaS0Cw/VFO8i2nHglJUzQCRtMMR/IBAKE3ETMC4g=="],
+
     "@vitejs/plugin-react": ["@vitejs/plugin-react@4.7.0", "", { "dependencies": { "@babel/core": "^7.28.0", "@babel/plugin-transform-react-jsx-self": "^7.27.1", "@babel/plugin-transform-react-jsx-source": "^7.27.1", "
```

**File**: `frontend/src/components/ui/shims/antd-inputs.tsx` (modified, +1/-1)
```diff
@@ -1066,7 +1066,7 @@ function matchesQuery(
     return filterOption(query, item.data);
   }
   const field = optionFilterProp
-    ? (item.data as Record<string, unknown>)[optionFilterProp]
+    ? (item.data as unknown as Record<string, unknown>)[optionFilterProp]
     : undefined;
   const haystack = optionFilterProp
     ? optionText(field as React.ReactNode)
```

**File**: `tests/groups.yaml` (modified, +5/-4)
```diff
@@ -52,15 +52,16 @@ groups:
     # runner points vitest's own JUnit reporter at the group's junit.xml, so
     # results come through per-test rather than as one synthetic row.
     #
-    # `optional` because CI images without `node_modules` should skip this
-    # rather than fail: the runner exits 5 ("nothing collected") when npx is
-    # absent, and optional keeps that from gating the overall result.
+    # Required: a red test gates the unit tier. It needs `node_modules`, so
+    # ci-test.yaml installs frontend deps on the unit leg; with them missing,
+    # `npx --no-install vitest` fails and turns the group red. A host with no
+    # npx at all (cloud's self-hosted runner) still skips via the runner's
+    # exit 5, which folds green for non-pytest groups.
     tier: unit
     runner: vitest
     workdir: frontend
     paths: [src]
     timeout_seconds: 900
-    optional: true
 
   unit-rig:
     # Rig self-tests. Run from repo root so the `tests.rig` import resolves.
```

---

### Incident Patch 8: `c19081c6` (2026-09-25)
**Commit Message**: [FIX] Pull MinIO from unstract/* Chainguard mirrors now that quay.io requires auth (#2300)

quay.io/minio/minio and quay.io/minio/mc started returning 'unauthorized',
breaking the integration (testcontainers) and e2e (compose) CI tiers.
Mirror cgr.dev/chainguard/minio and minio-client:latest-dev to Docker Hub
under unstract/* and pin by digest. Run minio as root so existing
root-owned minio_data volumes stay writable under Chainguard's uid 65532.

**File**: `docker/docker-compose-dev-essentials.yaml` (modified, +7/-4)
```diff
@@ -29,9 +29,11 @@ services:
       - traefik.enable=false
 
   minio:
-    # Docker Hub minio/* images were removed upstream; quay.io is MinIO's own registry
-    # but frozen (RELEASE.2025-09-07) - pinned by digest so a tag deletion can't break us
-    image: "quay.io/minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e"
+    # Mirror of cgr.dev/chainguard/minio (upstream minio/* images are gone from Docker Hub
+    # and quay.io now requires auth) - pinned by digest so a tag change can't break us
+    image: "unstract/minio:RELEASE.2026-09-22T19-25-18Z@sha256:bd014394a80898e68c149f2311fdf8d5a2c2f3bb2c33b9327ae6d02b4b065ae1"
+    # Chainguard runs as uid 65532; keep root so existing root-owned minio_data volumes stay writable
+    user: root
     container_name: unstract-minio
     hostname: minio
     restart: unless-stopped
@@ -49,7 +51,8 @@ services:
       - traefik.http.services.minio.loadbalancer.server.port=9001
 
   minio-bootstrap:
-    image: "quay.io/minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727"
+    # Mirror of cgr.dev/chainguard/minio-client:latest-dev (-dev variant ships /bin/sh for the entrypoint)
+    image: "unstract/minio-client:2026-09-24-dev@sha256:f0dd93b48af1f8a641edcd3c64661c8dbe05189bd2ef2f8cea216eb18af10bf8"
     depends_on:
       - minio
     entrypoint: >
```

**File**: `tests/rig/runtime.py` (modified, +1/-1)
```diff
@@ -341,7 +341,7 @@ def up(self) -> PlatformEndpoints:
             rabbit = RabbitMqContainer("rabbitmq:3.13-management").start()
             self._stack.append(rabbit)
             minio = MinioContainer(
-                "quay.io/minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e"
+                "unstract/minio:RELEASE.2026-09-22T19-25-18Z@sha256:bd014394a80898e68c149f2311fdf8d5a2c2f3bb2c33b9327ae6d02b4b065ae1"
             ).start()
             self._stack.append(minio)
 
```

---

### Incident Patch 9: `79a96b9c` (2026-09-24)
**Commit Message**: UN-4136 [FIX] Stop the file_processing worker booting the executor stack on each child's first task (#2293)

* fix: stop the file_processing worker booting the executor stack

Each pg_queue_consumer child paid ~9s of lazy initialisation on its first
task. The supervisor preforks 20 children per pod, so that is ~170
CPU-seconds per pod spent during serving rather than at startup, which
spikes fleet CPU at load onset and inflates CAST AI's WOOP p99 to 792m
against a 200m request -- putting the HPA signal's ceiling below its own
target so the fleet collapses to minReplicas under backlog.

structure_tool_task.py imports two string constants and a StreamMixin shim
from the executor package. None needs the executor registry, but every
import under `executor` booted the whole thing: executor/__init__.py
imported .worker, which imported executor.executors, which imported
LegacyExecutor and ran entry-point discovery. Measured at 9.98s cold.

Resolve celery_app lazily (PEP 562) and replace the executors package's
import-side-effect registration with an explicit, idempotent register_all().
The two entrypoints that need a populated registry -- executor/worker.py and
executor/tasks.py -- call i

**File**: `workers/executor/__init__.py` (modified, +24/-1)
```diff
@@ -3,10 +3,33 @@
 Celery worker for running extraction executors.
 Dispatches ExecutionContext to registered executors and returns
 ExecutionResult via the Celery result backend.
+
+``celery_app`` resolves lazily (PEP 562). Importing it eagerly made *every*
+consumer of this package pay the executor worker's full bootstrap: ``.worker``
+built the Celery app, and registration then imported ``LegacyExecutor`` and the
+adapter stack behind it. That was ~9s of work the file_processing worker never
+needed — it imports ``ExecutorToolShim`` and some string constants from this
+package and dispatches everything else over the PG queue (UN-4136). Attribute
+access is unchanged, so ``from executor import celery_app`` still works for
+callers that genuinely want the app.
 """
 
-from .worker import app as celery_app
+from typing import TYPE_CHECKING
+
+if TYPE_CHECKING:
+    from celery import Celery
+
+    celery_app: Celery
 
 __all__ = [
     "celery_app",
 ]
+
+
+def __getattr__(name: str) -> object:
+    """Resolve ``celery_app`` on first access instead of at import time."""
+    if name == "celery_app":
+        from .worker import app
+
+        return app
+    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
```

**File**: `workers/executor/executors/__init__.py` (modified, +127/-10)
```diff
@@ -1,16 +1,133 @@
 """Executor implementations package.
 
-Importing this module triggers ``@ExecutorRegistry.register`` for all
-bundled executors and discovers cloud executors via entry points.
+Registration is **explicit**: call :func:`register_all`. It used to run as a
+side effect of importing this package, which meant that importing *any*
+submodule — including ``executor.executors.constants``, which itself imports
+nothing but ``enum`` — dragged in ``LegacyExecutor`` and the entire adapter
+stack behind it. That cost ~9s, and the file_processing worker paid it once per
+forked child just to read a few string constants (UN-4136).
+
+``executor/tasks.py`` is the only *production* caller: ``workers/worker.py``
+exec-loads that file by path for both the Celery and PG executor roles.
+``executor/worker.py`` reaches it transitively, by importing ``executor.tasks``
+— that import binds the task definitions to its app and populates the registry,
+so it is load-bearing despite its ``noqa: F401``. The app it builds is not on
+any deployed path; today only the tests use it. The test suite calls
+:func:`register_all` directly.
 """
 
-from executor.executors.legacy_executor import LegacyExecutor
-from executor.executors.plugins.loader import ExecutorPluginLoader
+from typing import TYPE_CHECKING
+
+if TYPE_CHECKING:
+    from executor.executors.legacy_executor import LegacyExecutor  # noqa: TCH004
+
+#: Cloud entry point names; None when discovery has not run, or ran and
+#: raised. Doubles as the re-entrancy latch — see :func:`register_all`.
+_cloud_executors: list[str] | None = None
+
+
+def register_all() -> list[str]:
+    """Import the executor modules once per process, registering each of them.
+
+    ``LegacyExecutor`` and every cloud executor carry
+    ``@ExecutorRegistry.register``, which fires when their module is first
+    imported. That is the whole mechanism, and it bounds the guarantee: this
+    populates ``ExecutorRegistry`` **in a fresh process**, and cannot repopulate
+    it if something empties it afterwards, because the second import is a
+    ``sys.modules`` hit and the decorator does not run again. Production never
+    clears the registry. Several test modules do, and most of them do not put it
+    back; ``tests/test_legacy_executor_scaffold.py`` restores what it cleared.
+    A module that re-registers must not call ``ExecutorRegistry.register`` while
+    the name is already present — either clear immediately before, or guard on
+    ``"legacy" not in ExecutorRegistry.list_executors()``. That rule is hand-copied
+    across the test modules in several spellings; folding it into a shared test
+    helper is deliberately left out of this change.
+
+    Idempotent, and safe to re-enter: a cloud plugin whose own import graph
+    reaches this function during ``ep.load()`` will not restart discovery.
+
+    Returns:
+        The cloud executor entry point names, as a fresh copy each time so a
+        caller cannot mutate the latched state.
+
+        The list can under-report the registry at any length, including zero.
+        An empty one does not distinguish its causes: no cloud plugins are
+        installed (the OSS case); every one of them failed to import, because
+        ``ExecutorPluginLoader.discover_executors`` catches per-entry-point
+        failures and only logs a warning, so a broken plugin wheel boots clean
+        (a follow-up to make that aggregate loud is recorded on UN-4136); the
+        caller is *inside* discovery, having re-entered while the latch is still
+        the empty placeholder; or a failed discovery was re-run and the plugin
+        that raised is live in ``ExecutorRegistry`` but absent here — see the
+        handler below.
+    """
+    global _cloud_executors
+
+    from executor.executors.legacy_executor import LegacyExecutor  # noqa: F401
+
+    if _cloud_executors is None:
+        from executor.executors.plugins.loader import ExecutorPluginLoader
+
+        # Latch BEFORE discovering. ``ep.load()`` executes third-party code, and
+        # a plugin that reaches back into this function would otherwise find the
+        # latch still unset and restart the entry point loop, nesting once per
+        # level. The import-side-effect version this replaced got that safety
+        # free from ``sys.modules``.
+        #
+        try:
+            _cloud_executors = []
+            _cloud_executors = ExecutorPluginLoader.discover_executors()
+        except BaseException:
+            # Re-raise unchanged, and put the latch back to its un-armed value,
+            # so a later call re-runs discovery instead of reporting "no cloud
+            # executors" as though this one had succeeded. That does re-arm a
+            # retry for a later caller — no production caller survives the
+            # re-raise to make one (see the module docstring), so today only
+            # tests reach it.
+            #
+            # ``BaseException`` rather than ``
```

**File**: `workers/executor/executors/plugins/loader.py` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 - ``unstract.executor.executors``
     Executor classes that self-register via ``@ExecutorRegistry.register``.
-    Loaded eagerly at worker startup from ``executors/__init__.py``.
+    Loaded when ``executor.executors.register_all()`` runs at worker startup.
 """
 
 import logging
```

**File**: `workers/executor/tasks.py` (modified, +25/-10)
```diff
@@ -5,16 +5,9 @@
 ExecutionOrchestrator, and returns an ExecutionResult dict.
 """
 
-# Import the executor implementations so their ``@ExecutorRegistry.register``
-# decorators run before ``execute_extraction`` can be invoked. Coupling this to
-# the task module (not only the Celery ``executor/worker.py`` entrypoint) ensures
-# the registry is populated wherever the task is registered — in particular the PG
-# executor consumer, which bootstraps via the root-worker import that loads
-# ``executor/tasks.py`` (this module) but NOT ``executor/worker.py`` where this
-# import historically lived; without it the consumer hits "No executor
-# registered". Import is idempotent (module cached), so the Celery entrypoint
-# importing it again is harmless.
-import executor.executors  # noqa: E402, F401
+import logging
+
+from executor.executors import register_all
 from queue_backend import worker_task
 from shared.clients import UsageAPIClient
 from shared.enums.task_enums import TaskName
@@ -25,8 +18,30 @@
 from unstract.sdk1.execution.orchestrator import ExecutionOrchestrator
 from unstract.sdk1.execution.result import ExecutionResult
 
+# Suppress Celery trace logging of task return values.
+# The trace logger prints the full result dict on task success, which can
+# contain sensitive customer data (extracted text, summaries, etc.).
+#
+# This lives here, not in ``executor/worker.py``, because that module is not on
+# any deployed path: ``workers/worker.py`` exec-loads THIS file by path for both
+# the Celery and PG executor roles, and no launcher runs ``celery -A executor``.
+# It used to be reached only because ``executor/__init__.py`` eagerly imported
+# ``.worker``; making that lazy (UN-4136) would otherwise have silently
+# re-enabled result logging on every extraction.
+logging.getLogger("celery.app.trace").setLevel(logging.WARNING)
+
 logger = WorkerLogger.get_logger(__name__)
 
+# Populate ``ExecutorRegistry`` so the executor implementations are registered
+# before ``execute_extraction`` can be invoked. Coupling this to the task module
+# (not only the Celery ``executor/worker.py`` entrypoint) ensures the registry is
+# populated wherever the task is registered — in particular the PG executor
+# consumer, which bootstraps via the root-worker import that loads
+# ``executor/tasks.py`` (this module) but NOT ``executor/worker.py``; without it
+# the consumer hits "No executor registered". This is the only call site;
+# ``executor/worker.py`` reaches it by importing this module.
+register_all()
+
 _LLM_BEARING_OPS = frozenset(
     {
         "answer_prompt",
```

**File**: `workers/executor/worker.py` (modified, +4/-9)
```diff
@@ -4,7 +4,6 @@
 Routes execute_extraction tasks to registered executors.
 """
 
-import logging
 import os
 
 from queue_backend import worker_task
@@ -17,11 +16,6 @@
 logger = WorkerLogger.setup(WorkerType.EXECUTOR)
 app, config = WorkerBuilder.build_celery_app(WorkerType.EXECUTOR)
 
-# Suppress Celery trace logging of task return values.
-# The trace logger prints the full result dict on task success, which
-# can contain sensitive customer data (extracted text, summaries, etc.).
-logging.getLogger("celery.app.trace").setLevel(logging.WARNING)
-
 
 def check_executor_health():
     """Custom health check for executor worker."""
@@ -79,7 +73,8 @@ def healthcheck(self):
     }
 
 
-# Import tasks so shared_task definitions bind to this app.
-# Import executors to trigger @ExecutorRegistry.register at import time.
-import executor.executors  # noqa: E402, F401
+# Import tasks so shared_task definitions bind to this app. This also populates
+# ExecutorRegistry: executor/tasks.py calls register_all() at module scope, and
+# it is the site that does the work on every deployed path — workers/worker.py
+# exec-loads that file by path, and nothing launches `celery -A executor`.
 import executor.tasks  # noqa: E402, F401
```

**File**: `workers/tests/test_executor_import_isolation.py` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+"""Regression: the file_processing worker must not boot the executor stack.
+
+``structure_tool_task`` dispatches all real extraction work to the executor
+worker over the PG queue. From the ``executor`` package it needs only two cheap
+things: ``ExecutorToolShim`` (a StreamMixin wrapper) and some string constants.
+
+Both used to drag in ``LegacyExecutor`` and every adapter behind it, because
+``executor/__init__.py`` eagerly imported ``.worker``, which imported
+``executor.executors``, which imported ``LegacyExecutor`` and ran entry-point
+discovery. ``structure_tool_task`` makes those imports inside the task function,
+so the cost landed on each forked child's FIRST task rather than at startup —
+~9s per child, measured on staging (UN-4136).
+
+These pin the import graph, not a duration: a timing assertion would be flaky on
+CI, while the thing that actually regresses is an eager import creeping back
+into either ``__init__``. Each runs in a fresh interpreter so the rest of the
+suite cannot pre-import the stack and mask the regression.
+"""
+
+import os
+import subprocess
+import sys
+
+# Importing these must not pull the executor stack in behind them.
+_FILE_PROCESSING_IMPORTS = (
+    "from executor.executor_tool_shim import ExecutorToolShim",
+    "from executor.executors.constants import PromptServiceConstants",
+)
+
+# The expensive modules: ``legacy_executor`` pulls the x2text adapter stack at
+# module scope, and ``executor.worker`` builds the Celery app.
+_MUST_NOT_LOAD = (
+    "executor.worker",
+    "executor.executors.legacy_executor",
+)
+
+_WORKERS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
+
+
+# Child snippets use ``raise SystemExit``, never a bare ``assert``: the child
+# inherits the parent's environment, and under ``PYTHONOPTIMIZE``/``-O`` every
+# assert is stripped — the snippet would print OK, exit 0, and the guard would
+# pass having checked nothing.
+def _run(snippet: str) -> subprocess.CompletedProcess:
+    return subprocess.run(
+        [sys.executable, "-c", snippet],
+        capture_output=True,
+        text=True,
+        env={**os.environ, "WORKER_TYPE": "file_processing"},
+        cwd=_WORKERS_DIR,
+    )
+
+
+def test_file_processing_imports_do_not_load_the_executor_stack():
+    """Neither import may leave the executor worker or LegacyExecutor loaded."""
+    code = "\n".join(
+        [
+            "import sys",
+            *_FILE_PROCESSING_IMPORTS,
+            f"loaded = [m for m in {_MUST_NOT_LOAD!r} if m in sys.modules]",
+            "if loaded: raise SystemExit(f'eagerly imported: {loaded}')",
+            "print('OK')",
+        ]
+    )
+    result = _run(code)
+    assert result.returncode == 0, (
+        "importing ExecutorToolShim / PromptServiceConstants pulled in the "
+        f"executor stack.\nstdout: {result.stdout}\nstderr: {result.stderr}"
+    )
+    assert "OK" in result.stdout
+
+
+def test_loading_executor_tasks_suppresses_celery_result_logging():
+    """The trace logger must be muted by the module the executor actually loads.
+
+    ``celery.app.trace`` logs the full result dict on task success, which for
+    ``execute_extraction`` is extracted customer document text. The
+    ``setLevel(WARNING)`` that mutes it used to live in ``executor/worker.py``
+    and was reached only because ``executor/__init__.py`` eagerly imported
+    ``.worker`` — so making that import lazy silently un-suppressed it, and
+    every extraction would have logged ~1KB of the payload at INFO.
+
+    Nothing else in the repo sets this level, and no launcher runs
+    ``celery -A executor``, so ``executor/tasks.py`` — which ``workers/worker.py``
+    exec-loads by path for both executor roles — is the only module that can
+    carry it. A fresh interpreter is required: another test importing
+    ``executor.worker`` first would mask the regression.
+    """
+    code = "\n".join(
+        [
+            "import logging, sys",
+            "import executor.tasks",  # exactly what the deployed executor loads
+            "lvl = logging.getLogger('celery.app.trace').level",
+            "if lvl != logging.WARNING:",
+            "    raise SystemExit(f'trace logger not suppressed: {lvl}')",
+            # The suppression must not come back via the expensive import.
+            "if 'executor.worker' in sys.modules:",
+            "    raise SystemExit('pulled in executor.worker')",
+            "print('OK')",
+        ]
+    )
+    result = subprocess.run(
+        [sys.executable, "-c", code],
+        capture_output=True,
+        text=True,
+        env={**os.environ, "WORKER_TYPE": "executor"},
+        cwd=_WORKERS_DIR,
+    )
+    assert result.returncode == 0, (
+        "executor.tasks did not suppress celery.app.trace result logging.\n"
+        f"stdout: {result.stdout}\nstderr: {result.stderr}"
+    )
+    assert "OK" in result.stdout
+
+
+def test_importing_the_executor_package_does_not_build_the_celery_app():

```

**File**: `workers/tests/test_legacy_executor_extract.py` (modified, +6/-2)
```diff
@@ -44,9 +44,13 @@ def _clean_registry():
 
 
 def _register_legacy():
-    from executor.executors.legacy_executor import LegacyExecutor  # noqa: F401
+    # Guarded because the import below may be the FIRST in the process, in which
+    # case ``@ExecutorRegistry.register`` fires on it and registering again
+    # raises a duplicate-name ValueError.
+    from executor.executors.legacy_executor import LegacyExecutor
 
-    ExecutorRegistry.register(LegacyExecutor)
+    if "legacy" not in ExecutorRegistry.list_executors():
+        ExecutorRegistry.register(LegacyExecutor)
 
 
 def _make_context(**overrides):
```

**File**: `workers/tests/test_legacy_executor_index.py` (modified, +6/-2)
```diff
@@ -36,9 +36,13 @@ def _clean_registry():
 
 
 def _register_legacy():
-    from executor.executors.legacy_executor import LegacyExecutor  # noqa: F401
+    # Guarded because the import below may be the FIRST in the process, in which
+    # case ``@ExecutorRegistry.register`` fires on it and registering again
+    # raises a duplicate-name ValueError.
+    from executor.executors.legacy_executor import LegacyExecutor
 
-    ExecutorRegistry.register(LegacyExecutor)
+    if "legacy" not in ExecutorRegistry.list_executors():
+        ExecutorRegistry.register(LegacyExecutor)
 
 
 def _make_index_context(**overrides):
```

---

### Incident Patch 10: `89a44344` (2026-09-24)
**Commit Message**: UN-3487 [FIX] Restrict the S3/MinIO connector to one bucket (#2295)

* UN-3487 [FIX] Require and enforce a bucket on the S3/MinIO connector

The S3/MinIO connector had no bucket field, so its reach was bounded only
by whatever the underlying credential (often a shared IAM role) could see
account-wide. Any connector could browse into any bucket that role had
access to, including other teams' data.

- `bucket` is now a required field on the connector schema, matching
  Azure's existing (but unenforced) precedent — this one is actually
  enforced.
- `MinioFS.get_fsspec_fs()` wraps the filesystem in fsspec's own
  `DirFileSystem` when a bucket is set, confining every list/read/write
  (and `test_credentials`) to that one bucket regardless of what the
  credential could otherwise reach. UCS opts out via `_REQUIRES_BUCKET`,
  since it restricts access through its own `path` setting instead.
- Fixed a related IDOR in `file_management`: `list`/`download`/`upload`
  resolved a connector by a bare `ConnectorInstance.objects.get(pk=id)`
  with no ownership/group check, org-scoped only. Any org member holding
  a connector's id could browse/read/write through it regardless of
  sharing. Now sc

**File**: `backend/connector_v2/tests/test_connector_register.py` (modified, +17/-0)
```diff
@@ -24,6 +24,7 @@
 from connector_v2.models import ConnectorInstance
 
 MINIO_CONNECTOR_ID = "minio|c799f6e3-2b57-434e-aaac-b5daa415da19"
+_BUCKET = "connector-register-test"
 
 pytestmark = pytest.mark.skipif(
     not all(
@@ -45,12 +46,28 @@ def _credentials(secret: str | None = None) -> dict:
         "secret": secret or os.environ["MINIO_SECRET_ACCESS_KEY"],
         "endpoint_url": os.environ["MINIO_ENDPOINT_URL"],
         "region_name": "",
+        "bucket": _BUCKET,
         "path": "/",
     }
 
 
+def _ensure_bucket_exists() -> None:
+    # UN-3487: MinioFS now requires a bucket, and `test_credentials` probes
+    # it directly — it must actually exist in the rig's MinIO.
+    from s3fs.core import S3FileSystem
+
+    fs = S3FileSystem(
+        key=os.environ["MINIO_ACCESS_KEY_ID"],
+        secret=os.environ["MINIO_SECRET_ACCESS_KEY"],
+        client_kwargs={"endpoint_url": os.environ["MINIO_ENDPOINT_URL"]},
+    )
+    if not fs.exists(_BUCKET):
+        fs.mkdir(_BUCKET)
+
+
 class ConnectorRegisterTest(TestCase):
     def setUp(self) -> None:
+        _ensure_bucket_exists()
         self.org = Organization.objects.create(
             name="org-conn", display_name="Org Conn", organization_id="org-conn"
         )
```

**File**: `backend/file_management/file_management_helper.py` (modified, +25/-14)
```diff
@@ -11,6 +11,7 @@
 from django.conf import settings
 from django.http import StreamingHttpResponse
 from fsspec import AbstractFileSystem
+from fsspec.implementations.dirfs import DirFileSystem
 from pydrive2.files import ApiRequestError
 
 from file_management.exceptions import (
@@ -31,6 +32,27 @@
 logger = logging.getLogger(__name__)
 
 
+def _default_root_path(
+    file_system: UnstractFileSystem, fs: AbstractFileSystem, path: str
+) -> str | None:
+    """Some connectors restrict browsing to their own default root (e.g. a
+    configured `path`) when the caller didn't ask for a specific one.
+
+    `DirFileSystem.path` (used by a bucket-scoped MinioFS) is excluded: it's
+    the wrapped bucket prefix, not a default root, and every operation
+    already resolves relative to it — applying it again here would
+    double-prefix the path (UN-3487).
+    """
+    if not path or path == "/":
+        try:
+            if file_system.path:
+                return file_system.path
+        except AttributeError:
+            if hasattr(fs, "path") and fs.path and not isinstance(fs, DirFileSystem):
+                return fs.path
+    return None
+
+
 class FileManagerHelper:
     @staticmethod
     def get_file_system(connector: ConnectorInstance) -> UnstractFileSystem:
@@ -47,14 +69,8 @@ def get_file_system(connector: ConnectorInstance) -> UnstractFileSystem:
     @staticmethod
     def list_files(file_system: UnstractFileSystem, path: str) -> list[FileInformation]:
         fs = file_system.get_fsspec_fs()
-        file_path = f"{path}"
-        # TODO: Add below logic by checking each connector?
         try:
-            if file_system.path and (not path or path == "/"):
-                file_path = file_system.path
-        except AttributeError:
-            if hasattr(fs, "path") and fs.path and (not path or path == "/"):
-                file_path = fs.path
+            file_path = _default_root_path(file_system, fs, path) or path
         except Exception:
             logger.error(f"Missing path Atribute in {fs}")
             raise MissingConnectorParams()
@@ -135,13 +151,8 @@ def upload_file(
     ) -> None:
         fs = file_system.get_fsspec_fs()
 
-        file_path = f"{path}"
-        try:
-            if file_system.path and (not path or path == "/"):
-                file_path = f"{file_system.path}/"
-        except AttributeError:
-            if fs.path and (not path or path == "/"):
-                file_path = f"{fs.path}/"
+        root = _default_root_path(file_system, fs, path)
+        file_path = f"{root}/" if root else path
 
         file_path = file_path + "/" if not file_path.endswith("/") else file_path
 
```

**File**: `backend/file_management/tests.py` (modified, +101/-1)
```diff
@@ -1 +1,101 @@
-# Create your tests here.
+"""UN-3487: `file/`, `file/download` and `file/upload` are scoped to the
+caller, not just the org.
+
+Before this fix, `FileManagementViewSet` resolved a connector by a raw
+`ConnectorInstance.objects.get(pk=id)` — any authenticated org member who
+knew (or guessed) another user's connector id could browse, download from,
+or upload to it, sharing settings aside. These drive the real views through
+DRF's request factory, so a gate that exists only in the queryset — and
+never reaches the route — is still caught.
+"""
+
+import unittest
+from unittest.mock import mock_open, patch
+
+from connector_v2.models import ConnectorInstance
+from django.test import TestCase
+from permissions.roles import ResourceRole
+from permissions.tests.base import CoOwnerOrgTestMixin
+from rest_framework import status
+from rest_framework.response import Response
+from rest_framework.test import APIRequestFactory, force_authenticate
+
+from file_management.file_management_helper import FileManagerHelper
+from file_management.views import FileManagementViewSet
+from unstract.connectors.filesystems.minio.minio import MinioFS
+
+
+class FileManagementAccessScopeTest(CoOwnerOrgTestMixin, TestCase):
+    def setUp(self) -> None:
+        self._seed_org()
+        self.connector = ConnectorInstance.objects.create(
+            connector_name="team-a-s3",
+            connector_id="minio|c799f6e3-2b57-434e-aaac-b5daa415da19",
+            connector_metadata={"bucket": "team-a-data"},
+            organization=self.org,
+            created_by=self.owner,
+        )
+        # `created_by` is audit-only — access runs through the membership
+        # table, same as every other shareable resource in this codebase.
+        self.connector.memberships.create(user=self.owner, role=ResourceRole.OWNER)
+        self.connector.memberships.create(user=self.viewer, role=ResourceRole.VIEWER)
+        self.factory = APIRequestFactory()
+
+    def _list(self, actor) -> Response:
+        view = FileManagementViewSet.as_view({"get": "list"})
+        request = self.factory.get(
+            "/file", {"connector_id": str(self.connector.pk), "path": "/"}
+        )
+        force_authenticate(request, user=actor)
+        with (
+            patch(
+                "file_management.views.FileManagerHelper.get_file_system",
+                return_value=None,
+            ),
+            patch("file_management.views.FileManagerHelper.list_files", return_value=[]),
+        ):
+            return view(request)
+
+    def test_owner_can_list_their_own_connector(self) -> None:
+        self.assertEqual(self._list(self.owner).status_code, status.HTTP_200_OK)
+
+    def test_org_admin_can_list_any_connector(self) -> None:
+        self.assertEqual(self._list(self.admin).status_code, status.HTTP_200_OK)
+
+    def test_shared_viewer_can_list_the_connector(self) -> None:
+        self.assertEqual(self._list(self.viewer).status_code, status.HTTP_200_OK)
+
+    def test_outsider_org_member_cannot_list_an_unshared_connector(self) -> None:
+        # In scope (org member), but the connector was never shared with them.
+        self.assertEqual(self._list(self.outsider).status_code, status.HTTP_404_NOT_FOUND)
+
+    def test_non_org_member_cannot_list_the_connector(self) -> None:
+        self.assertEqual(self._list(self.stranger).status_code, status.HTTP_404_NOT_FOUND)
+
+
+class BucketScopedRootPathTest(unittest.TestCase):
+    """Regression for a Greptile finding on this PR: a bucket-scoped
+    connector's own `DirFileSystem.path` is its wrapped bucket prefix, not a
+    connector-level default root. Treating it as one double-prefixes every
+    root-level operation (`<bucket>/<bucket>/...`) instead of resolving
+    within the bucket.
+    """
+
+    def _minio_fs(self) -> MinioFS:
+        return MinioFS({"bucket": "team-a-data", "key": "k", "secret": "s"})
+
+    def test_list_files_at_root_is_not_double_prefixed(self) -> None:
+        minio_fs = self._minio_fs()
+        with patch.object(minio_fs.s3, "ls", return_value=[]) as mock_ls:
+            FileManagerHelper.list_files(minio_fs, "/")
+        mock_ls.assert_called_once_with("team-a-data/", detail=True)
+
+    def test_upload_file_at_root_is_not_double_prefixed(self) -> None:
+        minio_fs = self._minio_fs()
+        with patch.object(minio_fs.s3, "open", mock_open()) as mock_open_call:
+            FileManagerHelper.upload_file(minio_fs, "/", b"data", "report.pdf")
+        (called_path,), kwargs = mock_open_call.call_args
+        self.assertEqual(kwargs, {"mode": "wb"})
+        self.assertNotIn("team-a-data/team-a-data", called_path)
+        self.assertTrue(called_path.startswith("team-a-data/"))
+        self.assertTrue(called_path.endswith("report.pdf"))
```

**File**: `backend/file_management/views.py` (modified, +20/-7)
```diff
@@ -2,6 +2,7 @@
 from typing import Any
 
 from connector_v2.models import ConnectorInstance
+from django.db.models import QuerySet
 from django.http import HttpRequest
 from oauth2client.client import HttpAccessTokenRefreshError
 from rest_framework import serializers, viewsets
@@ -30,8 +31,22 @@ class FileManagementViewSet(viewsets.ModelViewSet):
 
     versioning_class = URLPathVersioning
 
-    def get_queryset(self):
-        return ConnectorInstance.objects.all()
+    def get_queryset(self) -> QuerySet[ConnectorInstance]:
+        # Org-scoped alone isn't enough: this must also respect ownership /
+        # sharing, or any org member could browse another user's connector
+        # by guessing its id.
+        return ConnectorInstance.objects.for_user(self.request.user)
+
+    def _get_connector_or_404(self, id: str) -> ConnectorInstance:
+        """Resolve a connector within the caller's own access scope.
+
+        Raises the same not-found error whether the id is unknown or simply
+        outside `get_queryset()` — the caller can't tell those apart.
+        """
+        try:
+            return self.get_queryset().get(pk=id)
+        except ConnectorInstance.DoesNotExist:
+            raise ConnectorInstanceNotFound()
 
     def get_serializer_class(self) -> serializers.Serializer:
         if self.action == "upload":
@@ -50,13 +65,11 @@ def list(self, request: HttpRequest) -> Response:
         id: str = serializer.validated_data.get("connector_id")
         path: str = serializer.validated_data.get("path")
         try:
-            connector_instance: ConnectorInstance = ConnectorInstance.objects.get(pk=id)
+            connector_instance = self._get_connector_or_404(id)
             file_system = FileManagerHelper.get_file_system(connector_instance)
             files = FileManagerHelper.list_files(file_system, path)
             serializer = FileInfoSerializer(files, many=True)
             return Response(serializer.data)
-        except ConnectorInstance.DoesNotExist:
-            raise ConnectorInstanceNotFound()
         except HttpAccessTokenRefreshError as error:
             logger.error(
                 f"HttpAccessTokenRefreshError thrown from file list, error {error}"
@@ -72,7 +85,7 @@ def download(self, request: HttpRequest) -> Response:
         serializer.is_valid(raise_exception=True)
         id: str = serializer.validated_data.get("connector_id")
         path: str = serializer.validated_data.get("path")
-        connector_instance: ConnectorInstance = ConnectorInstance.objects.get(pk=id)
+        connector_instance = self._get_connector_or_404(id)
         file_system = FileManagerHelper.get_file_system(connector_instance)
         return FileManagerHelper.download_file(file_system, path)
 
@@ -84,7 +97,7 @@ def upload(self, request: HttpRequest) -> Response:
 
         path: str = serializer.validated_data.get("path")
         uploaded_files: Any = serializer.validated_data.get("file")
-        connector_instance: ConnectorInstance = ConnectorInstance.objects.get(pk=id)
+        connector_instance = self._get_connector_or_404(id)
         file_system = FileManagerHelper.get_file_system(connector_instance)
 
         for uploaded_file in uploaded_files:
```

**File**: `frontend/src/components/helpers/custom-markdown/CustomMarkdown.jsx` (modified, +9/-1)
```diff
@@ -37,7 +37,15 @@ const CustomMarkdown = ({
       case "tripleCode":
         return (
           <Paragraph style={{ margin: 0 }}>
-            <pre style={{ margin: 0 }}>{content}</pre>
+            <pre
+              style={{
+                margin: 0,
+                whiteSpace: "pre-wrap",
+                overflowWrap: "anywhere",
+              }}
+            >
+              {content}
+            </pre>
           </Paragraph>
         );
       case "inlineCode":
```

**File**: `tests/e2e/etl/conftest.py` (modified, +6/-2)
```diff
@@ -133,6 +133,7 @@ def create_connector(connector_type: str) -> str:
                     "secret": minio_store.secret_key,
                     "endpoint_url": minio_store.internal_url,
                     "region_name": "us-east-1",
+                    "bucket": minio_store.bucket,
                 },
             },
         )
@@ -164,7 +165,9 @@ def create_connector(connector_type: str) -> str:
             "connection_type": "FILESYSTEM",
             "connector_instance_id": source_id,
             "configuration": {
-                "folders": [f"/{minio_store.bucket}/{input_prefix}"],
+                # UN-3487: the connector is now scoped to its own bucket, so
+                # paths resolve relative to it — no bucket prefix here.
+                "folders": [f"/{input_prefix}"],
                 "processSubDirectories": False,
                 "maxFiles": 1,
                 "fileProcessingOrder": "unordered",
@@ -179,7 +182,8 @@ def create_connector(connector_type: str) -> str:
         json={
             "connection_type": "FILESYSTEM",
             "connector_instance_id": destination_id,
-            "configuration": {"outputFolder": f"{minio_store.bucket}/{output_prefix}"},
+            # UN-3487: same as the source — no bucket prefix, it's implicit.
+            "configuration": {"outputFolder": output_prefix},
         },
     )
     assert resp.status_code == 200, f"destination endpoint: {resp.text}"
```

**File**: `unstract/connectors/src/unstract/connectors/filesystems/minio/minio.py` (modified, +53/-1)
```diff
@@ -7,8 +7,11 @@
 from typing import Any
 
 from botocore.exceptions import ClientError
+from fsspec import AbstractFileSystem
+from fsspec.implementations.dirfs import DirFileSystem
 from s3fs.core import S3FileSystem
 
+from unstract.connectors.exceptions import ConnectorError
 from unstract.connectors.filesystems.unstract_file_system import UnstractFileSystem
 
 from .exceptions import (
@@ -20,6 +23,37 @@
 
 logger = logging.getLogger(__name__)
 
+
+class _BucketScopedFileSystem(DirFileSystem):
+    """`DirFileSystem.walk()` relpaths the directory string it yields, but
+    not the `name` field inside each file/dir entry's own metadata dict —
+    those still carry the wrapped fs's raw, bucket-prefixed key. `ls()`
+    already fixes every entry; `walk()` doesn't. Fix it here so discovery
+    (which walks) and browsing (which lists) agree (UN-3487).
+    """
+
+    def _relpath_entries(
+        self, entries: dict[str, Any] | list[str]
+    ) -> dict[str, Any] | list[str]:
+        # detail=False (fsspec's own default) yields bare basenames with
+        # nothing to fix. detail=True yields a dict already keyed by bare
+        # basename — only each entry's own `name` field is bucket-qualified.
+        if not isinstance(entries, dict):
+            return entries
+        return {
+            name: {**info, "name": self._relpath(info["name"])}
+            for name, info in entries.items()
+        }
+
+    def walk(self, path: str, *args: Any, **kwargs: Any) -> Any:
+        for root, dirs, files in super().walk(path, *args, **kwargs):
+            yield root, self._relpath_entries(dirs), self._relpath_entries(files)
+
+    async def _walk(self, path: str, *args: Any, **kwargs: Any) -> Any:
+        async for root, dirs, files in super()._walk(path, *args, **kwargs):
+            yield root, self._relpath_entries(dirs), self._relpath_entries(files)
+
+
 # Cap concurrent per-bucket probes to avoid S3 503 SlowDown on large accounts.
 _MAX_CONCURRENT_BUCKET_PROBES = 16
 _BUCKET_PROBE_RETRY_DELAY_SECONDS = 0.5
@@ -138,12 +172,21 @@ class MinioFS(UnstractFileSystem):
     # known to have full access to every bucket they list, so the per-bucket
     # access probe in _AccessFilteredS3FileSystem can be skipped.
     _FS_CLASS: type[S3FileSystem] = _AccessFilteredS3FileSystem
+    # Override to False in a subclass whose settings restrict access some
+    # other way (e.g. UCS, which uses its own `path` setting instead).
+    _REQUIRES_BUCKET: bool = True
 
     def __init__(self, settings: dict[str, Any]):
         super().__init__("MinioFS/S3")
         key = (settings.get("key") or "").strip()
         secret = (settings.get("secret") or "").strip()
         endpoint_url = (settings.get("endpoint_url") or "").strip()
+        self.bucket = (settings.get("bucket") or "").strip()
+        if self._REQUIRES_BUCKET and not self.bucket:
+            raise ConnectorError(
+                "A bucket must be configured for this connector.",
+                treat_as_user_message=True,
+            )
         client_kwargs = {}
         if "region_name" in settings and settings["region_name"] != "":
             client_kwargs = {"region_name": settings["region_name"]}
@@ -324,7 +367,16 @@ def extract_modified_date(self, metadata: dict[str, Any]) -> datetime | None:
         )
         return None
 
-    def get_fsspec_fs(self) -> S3FileSystem:
+    def get_fsspec_fs(self) -> AbstractFileSystem:
+        """Return the filesystem scoped to this connector's bucket.
+
+        When a bucket is configured, every operation (list, read, write,
+        `test_credentials`) is confined to it via `_BucketScopedFileSystem` —
+        the underlying credentials may see more, but this connector never
+        will.
+        """
+        if self.bucket:
+            return _BucketScopedFileSystem(path=self.bucket, fs=self.s3)
         return self.s3
 
     def test_credentials(self) -> bool:
```

**File**: `unstract/connectors/src/unstract/connectors/filesystems/minio/static/json_schema.json` (modified, +7/-1)
```diff
@@ -5,7 +5,8 @@
   "required": [
     "connectorName",
     "endpoint_url",
-    "region_name"
+    "region_name",
+    "bucket"
   ],
   "properties": {
     "connectorName": {
@@ -36,6 +37,11 @@
       "title": "Region Name",
       "default": "ap-south",
       "description": "Region of the AWS S3 account (leave blank for Minio)"
+    },
+    "bucket": {
+      "type": "string",
+      "title": "Bucket Name",
+      "description": "Name of the bucket to be restricted to."
     }
   }
 }
```

---

### Incident Patch 11: `05e00a5c` (2026-09-24)
**Commit Message**: [FIX] Stop tox 4.64's .venv redirect from breaking every CI run (#2297)

* [FIX] Stop tox 4.64's .venv redirect from breaking every CI run

CI went red on every branch at once on 2026-09-24, with no commit to blame:
a branch that passed on 09-23 failed on 09-24 with byte-identical errors.

`uv tool install tox --with tox-uv` is unpinned and resolves at job time, so
tox 4.63.0 -> 4.64.1 landed in CI on its release day. tox 4.64.0 ships a PEP
832 `.venv` redirect: after each run it writes a *file* named `.venv` at the
project root, holding the path of a tox env, so editors can find an
interpreter. It skips this when a real `.venv` directory already exists, which
is why no local checkout noticed and only CI, which starts clean, broke.

The repo root is also a uv workspace. uv reads `.venv` as the project
environment and refuses a file:

  error: Project virtual environment directory `.../.venv` cannot be used
  because expected directory but found a file

That is exactly the three root-workdir invocations: the unit-rig group, the
e2e-smoke group (whose failure then SKIPs the other seven e2e groups), and the
final `uv run --with coverage[toml] coverage combine`. Both tiers exit 2 and
r

**File**: `.github/workflows/ci-test.yaml` (modified, +21/-3)
```diff
@@ -94,7 +94,13 @@ jobs:
             ${{ runner.os }}-tox-uv-
 
       - name: Install tox with UV
-        run: uv tool install tox --with tox-uv
+        # Pinned: this resolves at job time, so a tox release lands in CI with no
+        # commit of ours. tox 4.64.0 shipped the PEP 832 `.venv` redirect and
+        # broke every branch at once; bump deliberately, not by drift.
+        # --no-build: wheels only, so no sdist setup script runs at install
+        # time. The whole tree (tox, tox-uv, uv, virtualenv, ...) ships wheels,
+        # so this constrains nothing and resolves identically.
+        run: uv tool install tox==4.64.1 --with tox-uv==1.36.0 --no-build
 
       - name: Validate test manifests
         # Cheap pre-flight: catches manifest schema errors before tier runs.
@@ -172,7 +178,13 @@ jobs:
             ${{ runner.os }}-tox-uv-
 
       - name: Install tox with UV
-        run: uv tool install tox --with tox-uv
+        # Pinned: this resolves at job time, so a tox release lands in CI with no
+        # commit of ours. tox 4.64.0 shipped the PEP 832 `.venv` redirect and
+        # broke every branch at once; bump deliberately, not by drift.
+        # --no-build: wheels only, so no sdist setup script runs at install
+        # time. The whole tree (tox, tox-uv, uv, virtualenv, ...) ships wheels,
+        # so this constrains nothing and resolves identically.
+        run: uv tool install tox==4.64.1 --with tox-uv==1.36.0 --no-build
 
       - name: Validate test manifests
         # Cheap pre-flight before the multi-minute image build.
@@ -267,7 +279,13 @@ jobs:
             ${{ runner.os }}-tox-uv-
 
       - name: Install tox with UV
-        run: uv tool install tox --with tox-uv
+        # Pinned: this resolves at job time, so a tox release lands in CI with no
+        # commit of ours. tox 4.64.0 shipped the PEP 832 `.venv` redirect and
+        # broke every branch at once; bump deliberately, not by drift.
+        # --no-build: wheels only, so no sdist setup script runs at install
+        # time. The whole tree (tox, tox-uv, uv, virtualenv, ...) ships wheels,
+        # so this constrains nothing and resolves identically.
+        run: uv tool install tox==4.64.1 --with tox-uv==1.36.0 --no-build
 
       - name: Restore main-branch test baseline (for regression detection)
         # One unified baseline across all tiers; this job is its sole
```

**File**: `tox.ini` (modified, +10/-0)
```diff
@@ -14,6 +14,16 @@
 env_list = unit, integration, e2e
 requires = tox-uv>=0.2.0
 isolated_build = True
+# tox >=4.64 writes a PEP 832 `.venv` redirect file at the repo root pointing at
+# a tox env, so editors can find an interpreter. That root is also a uv
+# workspace, and the rig runs `uv run` there (unit-rig, e2e-smoke, and the
+# coverage combine). uv reads `.venv` as the project environment and rejects a
+# file, so every root-workdir invocation dies with "expected directory but found
+# a file". Following the redirect would be worse than rejecting it: it aims at
+# .tox/<env> (~97 packages: pytest, testcontainers, coverage), not the ~269
+# package workspace env those groups need. Nothing here wants the redirect --
+# a local checkout already has a real .venv directory, which tox leaves alone.
+venv_redirect = false
 
 [testenv]
 # Shared base: install the rig itself + its python deps. Each tier env reuses
```

---

### Incident Patch 12: `0a2c3e31` (2026-09-21)
**Commit Message**: UN-4137 [FIX] Stream LLM completions under the hood so long generations complete instead of timing out (#2294)

* UN-4137 [FIX] Stream LLM completions under the hood so long generations complete instead of timing out and being replayed

A non-streaming completion keeps the socket silent until the last token.
On Anthropic, generations the console finishes in ~16 minutes never
arrived: litellm.Timeout after 900 s (staging) and after 1800 s
(production), then replayed up to 4x by the retry helper because Timeout
is retryable, until the Celery time limit killed the task.

- LLM.complete() streams (stream=True), collects the chunks and rebuilds
  the full response with litellm.stream_chunk_builder; callers unchanged.
- collect_with_retry: retry only before the first content chunk; a drop
  after content started is raised immediately so a long generation is
  never replayed, and chunks from a failed attempt are discarded.
- "Enable Streaming" checkbox on all LLM adapter forms, default on;
  adapters without a stored value stream too. Opt-out for endpoints that
  cannot stream. Read from raw adapter metadata, never sent to litellm.
- Anthropic Timeout description now reflects per-chunk se

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/anthropic.json` (modified, +7/-1)
```diff
@@ -45,7 +45,13 @@
       "multipleOf": 1,
       "title": "Timeout",
       "default": 900,
-      "description": "Timeout in seconds"
+      "description": "Timeout in seconds. Replies are streamed, so this bounds the wait for the first token and any silence between chunks, not the length of the whole reply."
+    },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
     },
     "enable_thinking": {
       "type": "boolean",
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/anyscale.json` (modified, +6/-0)
```diff
@@ -49,6 +49,12 @@
       "title": "Max Retries",
       "default": 5,
       "description": "Maximum number of retries to attempt when a request fails."
+    },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
     }
   }
 }
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/azure.json` (modified, +6/-0)
```diff
@@ -69,6 +69,12 @@
       "default": 900,
       "description": "Timeout in seconds"
     },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
+    },
     "enable_reasoning": {
       "type": "boolean",
       "title": "Enable Reasoning",
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/azure_ai.json` (modified, +6/-0)
```diff
@@ -54,6 +54,12 @@
       "title": "Timeout",
       "default": 900,
       "description": "Request timeout in seconds."
+    },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
     }
   }
 }
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/bedrock.json` (modified, +6/-0)
```diff
@@ -111,6 +111,12 @@
       "title": "Timeout",
       "default": 900,
       "description": "Timeout in seconds"
+    },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
     }
   },
   "dependencies": {
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/custom_openai.json` (modified, +6/-0)
```diff
@@ -56,6 +56,12 @@
       "default": 900,
       "description": "Timeout in seconds."
     },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
+    },
     "enable_reasoning": {
       "type": "boolean",
       "title": "Enable Reasoning",
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/gemini.json` (modified, +6/-0)
```diff
@@ -46,6 +46,12 @@
       "default": 600,
       "description": "Timeout in seconds"
     },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
+    },
     "max_retries": {
       "type": "number",
       "minimum": 0,
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/minimax.json` (modified, +6/-0)
```diff
@@ -70,6 +70,12 @@
       "default": 900,
       "description": "Timeout in seconds."
     },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
+    },
     "enable_thinking": {
       "type": "boolean",
       "title": "Enable Thinking",
```

---

### Incident Patch 13: `53269a1f` (2026-09-18)
**Commit Message**: UN-4126 [FIX] Stop a NUL in an extracted value from stranding the executor RPC caller for an hour (#2289)

* UN-4126 [FIX] Stop a NUL in an extracted value from stranding the executor RPC caller for an hour

A finished executor task could fail to hand its result back, leaving the
blocking caller to wait out the full EXECUTOR_RESULT_TIMEOUT (3600s) on work
that had already succeeded, then error. Seen in prod us-central and reproduced
in a dev namespace.

`store_result` encodes the reply with `json.dumps` and inserts it as
`%s::jsonb`. That cast makes Postgres *parse* the JSON, and `jsonb` stores
strings as `text`, which cannot hold a NUL:

    psycopg2.errors.UntranslatableCharacter: unsupported Unicode escape sequence
    DETAIL:  \u0000 cannot be converted to text.
    CONTEXT: JSON data, line 1: ..."output": {"invoice_number": "POZFBBOK\u0000...

LLMWhisperer's `native_text` mode returns a PDF's embedded text layer verbatim,
NUL bytes included; the byte travels through the prompt into the extracted
output. The consumer then logs-and-acks (deliberately, to avoid an expensive
re-run), so a write that never lands is a reply that never comes.

This is PG-only and did not exist before

**File**: `backend/pg_queue/models.py` (modified, +7/-1)
```diff
@@ -483,7 +483,13 @@ class PgTaskResult(models.Model):
     # caller waits on it, the consumer stores the result under it.
     task_id = models.TextField(primary_key=True)
     # "completed" = task returned (``result`` holds ExecutionResult.to_dict());
-    # "failed" = task raised (``error`` holds the message).
+    # "failed" = task raised (``error`` holds the message), OR a payload could not
+    # be stored (``error`` holds one of the writer's two "unstorable" texts).
+    # Recovery logic must match the text before retrying a reply key, because the
+    # two unstorable cases point opposite ways: PAYLOAD_UNSTORABLE_ERROR means the
+    # task already ran to completion (a retry is a second full LLM spend — don't),
+    # ERROR_TEXT_UNSTORABLE means it raised (retrying is correct). See
+    # PgResultBackend's module docstring.
     status = models.TextField()
     result = models.JSONField(null=True, blank=True)
     # No-NULL text convention: "" on a completed row (no error), the message on a
```

**File**: `backend/pg_queue/producer.py` (modified, +12/-7)
```diff
@@ -33,6 +33,7 @@
     QueueMessageState,
     TaskPayload,
 )
+from unstract.core.jsonb import dumps_for_jsonb
 
 _READY = QueueMessageState.READY.value
 _SCHEDULED = QueueMessageState.SCHEDULED.value
@@ -58,14 +59,18 @@ def _json_safe(value: Any) -> Any:
     the worker consumer already receives string ids on the existing PG dispatch
     path, so coercing here keeps both transports consistent.
 
-    ``allow_nan=False`` rejects ``NaN``/``Infinity`` here with a ``ValueError``
-    rather than letting Python's default lenient encoder emit the non-standard
-    ``NaN``/``Infinity`` tokens: Postgres ``jsonb`` rejects those at insert with a
-    ``django.db.DataError`` (a permanent failure the notification dispatcher's
-    ``(ValueError, TypeError)`` seam would otherwise miss, looping the row). Fail
-    at the intended seam instead.
+    :func:`~unstract.core.jsonb.dumps_for_jsonb` enforces ``allow_nan=False``, so
+    ``NaN``/``Infinity`` raise a ``ValueError`` here rather than reaching Python's
+    lenient encoder and emitting the non-standard ``NaN``/``Infinity`` tokens:
+    Postgres ``jsonb`` rejects those at insert with a ``django.db.DataError`` (a
+    permanent failure the notification dispatcher's ``(ValueError, TypeError)``
+    seam would otherwise miss, looping the row). Fail at the intended seam instead.
+
+    It also strips the strings ``jsonb`` refuses (NUL, lone surrogate), which this
+    site previously did not handle — the same rule now applies to every PG-queue
+    ``jsonb`` writer instead of each carrying a partial defence (UN-4126).
     """
-    return json.loads(json.dumps(value, default=str, allow_nan=False))
+    return json.loads(dumps_for_jsonb(value, default=str))
 
 
 def _resolve_visibility(
```

**File**: `backend/pg_queue/tests/test_producer.py` (modified, +13/-0)
```diff
@@ -143,6 +143,19 @@ def test_json_safe_rejects_non_finite_floats(self, bad, slot, caplog):
         assert "notifications" in caplog.text
         assert "org-1" in caplog.text
 
+    def test_json_safe_strips_nul_instead_of_failing_the_enqueue(self):
+        # UN-4126: a NUL survives json.dumps but jsonb refuses it at insert, so
+        # this site used to enqueue a message the DB would reject. Unlike a
+        # non-finite float it IS repairable, so the task must still be enqueued
+        # — with the NUL gone — rather than raising at the seam.
+        with patch(_MODEL) as model:
+            model.objects.create.return_value = MagicMock(msg_id=1)
+            producer.enqueue_task(
+                task_name="t", queue="celery", kwargs={"text": "POZF\x00BBOK"}
+            )
+        message = model.objects.create.call_args.kwargs["message"]
+        assert message["kwargs"]["text"] == "POZFBBOK"
+
     def test_enqueue_failure_logs_and_propagates(self):
         with patch(_MODEL) as model:
             model.objects.create.side_effect = RuntimeError("db down")
```

**File**: `unstract/core/src/unstract/core/data_models.py` (modified, +12/-1)
```diff
@@ -371,7 +371,18 @@ class PgTaskStatus(str, Enum):
     """
 
     COMPLETED = "completed"  # task returned; ``result`` holds ExecutionResult dict
-    FAILED = "failed"  # task raised; ``error`` holds the message
+    # ``failed`` carries TWO distinct outcomes, and recovery logic must tell them
+    # apart before retrying anything:
+    #   1. the task raised — ``error`` holds the task's own message;
+    #   2. the task COMPLETED but its result could not be stored — ``error`` holds
+    #      ``queue_backend.pg_queue.result_backend.PAYLOAD_UNSTORABLE_ERROR``
+    #      (a module-level constant, UN-4126).
+    # Case 2 already ran to completion, so retrying its reply key re-executes a
+    # finished task: a second full LLM spend, the exact waste the consumer's ack
+    # discipline exists to avoid. There is deliberately no third status value —
+    # adding one would break every reader matching on these two — so the
+    # discriminator is the error text, and writers must use that shared constant.
+    FAILED = "failed"
 
 
 class FileListingResult:
```

**File**: `unstract/core/src/unstract/core/jsonb.py` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+r"""Shared JSON encoding for Postgres ``jsonb`` columns.
+
+``json.dumps`` accepts several values that Postgres ``jsonb`` then rejects at
+insert time, because ``jsonb`` *parses* what it is given and stores strings as
+``text``:
+
+- a **NUL** (``U+0000``) in a string — encoded as ``\u0000``, which ``jsonb``
+  refuses with ``unsupported Unicode escape sequence`` (``text`` cannot hold a
+  NUL). Real documents carry these: LLMWhisperer's ``native_text`` mode returns
+  a PDF's embedded text layer verbatim, NUL bytes included, and the value then
+  travels through the prompt into the extracted output.
+- an **unpaired surrogate** (``U+D800``-``U+DFFF`` with no partner) — encoded as
+  ``\udXXX``, refused the same way. A *well-formed* high+low pair is fine and is
+  preserved: Postgres combines it into the astral character it encodes.
+- **NaN / Infinity / -Infinity** — Python's lenient default emits these as bare
+  tokens, which are not JSON at all and which ``jsonb`` refuses.
+
+Every one of those is a *permanent* failure: the insert can never succeed, so a
+writer that lets it escape loses the payload. This module is the single place
+that knows the rule, so each ``jsonb`` writer does not re-derive it — the PG
+queue has three (the backend producer, the workers' barrier and the workers'
+result backend) and they previously carried three different, partial defences.
+
+It has no Django / psycopg / SDK dependency, so it lives in ``unstract.core``
+where both trees import it — the same arrangement as :mod:`unstract.core.polling`.
+
+Strings are *repaired* (the offending code points are dropped): a NUL or an
+unpaired surrogate carries no meaning a caller wants, and discarding a whole
+extracted result over one stray control byte is the worse outcome. Numbers are *not*
+repaired — ``NaN`` has no correct ``jsonb`` spelling, and silently turning it
+into ``null`` or ``0`` would corrupt a value rather than clean it, so
+``allow_nan=False`` is enforced and the caller decides what a broken number means.
+
+Cost, measured rather than assumed: the walk rebuilds every container and string,
+so encoding is ~11x a plain ``json.dumps`` on a 165 KiB result (0.38 ms -> 4.2 ms)
+and ~16x on 2 MB (3.1 ms -> 49 ms). Accepted, not optimised. An encode happens once
+per stored result against a task that took seconds, and the platform's measured
+ceiling is ~4-6 executions/s spread across the executor fleet, so the absolute
+figure never approaches a bottleneck. A fast path that encodes first and walks only
+when the *output* shows an offending escape was built and rejected: it makes a
+deeply nested payload succeed or fail depending on whether it also contains a NUL
+(the walk is recursive, the C encoder is not), and trading a consistent contract
+for milliseconds nobody is waiting on is the wrong way round.
+"""
+
+from __future__ import annotations
+
+import json
+import re
+from typing import Any
+
+__all__ = ["JSONB_UNSAFE_RE", "dumps_for_jsonb", "sanitize_for_jsonb"]
+
+# Exactly what `jsonb` will not store in a text value: a NUL, and any UNPAIRED
+# surrogate.
+#
+# A *well-formed* high+low pair must be preserved — Postgres accepts it and
+# combines it into the astral character it encodes (verified against a live
+# server: '{"a": "😀"}'::jsonb -> {"a": "😀"}). A plain
+# [\ud800-\udfff] class would match both halves of that pair and delete an emoji
+# from an extracted result, which is the silent corruption this module exists to
+# avoid. Only the halves that cannot pair are unsafe.
+#
+# Other C0 controls (\x01-\x1f) are legal in jsonb and are deliberately left
+# alone — they are escaped on the way in and round-trip fine.
+JSONB_UNSAFE_RE = re.compile(
+    "\x00"
+    "|[\ud800-\udbff](?![\udc00-\udfff])"  # high surrogate, no low following it
+    "|(?<![\ud800-\udbff])[\udc00-\udfff]"  # low surrogate, no high preceding it
+)
+
+
+def sanitize_for_jsonb(value: Any) -> Any:
+    """Return *value* with every string made storable in a ``jsonb`` column.
+
+    Walks dicts, lists and tuples and strips the code points ``jsonb`` rejects
+    (see :data:`JSONB_UNSAFE_RE`) from every string, keys included — a NUL is as
+    fatal in a key as in a value. Anything else (numbers, ``None``, booleans, and
+    objects a caller's ``default=`` hook will later coerce, such as ``UUID``) is
+    returned untouched.
+
+    Containers are rebuilt only as far as needed; the input is never mutated.
+    Tuples come back as lists, which is what ``json.dumps`` would have produced
+    anyway.
+    """
+    if isinstance(value, str):
+        return JSONB_UNSAFE_RE.sub("", value)
+    if isinstance(value, dict):
+        return {sanitize_for_jsonb(k): sanitize_for_jsonb(v) for k, v in value.items()}
+    if isinstance(value, (list, tuple)):
+        return [sanitize_for_jsonb(item) for item in value]
+    return value
+
+
+def dumps_for_jsonb(value: Any, *, default: Any = None) -> str:
+    """Encode *value* as JSON text
```

**File**: `unstract/core/tests/test_jsonb.py` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+"""Tests for the shared ``jsonb`` encoder.
+
+The property under test is the one that cost UN-4126 an hour-long hang per
+affected execution: whatever :func:`dumps_for_jsonb` returns must survive a
+``%s::jsonb`` cast. These assert the encoder's half of that (the escapes are
+gone from the emitted text); the DB half is asserted against a real Postgres in
+``workers/tests/test_pg_result_backend.py``.
+"""
+
+import json
+import math
+
+import pytest
+
+from unstract.core.jsonb import dumps_for_jsonb, sanitize_for_jsonb
+
+# The two escapes Postgres refuses to convert to text.
+NUL = "\x00"
+LONE_SURROGATE = "\ud800"
+
+
+class TestSanitizeForJsonb:
+    def test_strips_nul_from_string(self):
+        assert sanitize_for_jsonb(f"POZFBBOK{NUL}") == "POZFBBOK"
+
+    def test_strips_lone_surrogate(self):
+        assert sanitize_for_jsonb(f"a{LONE_SURROGATE}b") == "ab"
+
+    def test_strips_lone_low_surrogate(self):
+        assert sanitize_for_jsonb("a" + chr(0xDC00) + "b") == "ab"
+
+    def test_preserves_a_valid_surrogate_pair(self):
+        # A well-formed high+low pair IS storable: Postgres combines it into the
+        # astral character it encodes (verified against a live server). A plain
+        # [high-low] character class matches BOTH halves and would silently drop
+        # an emoji from an extracted result.
+        pair = chr(0xD83D) + chr(0xDE00)  # U+1F600 GRINNING FACE
+        assert sanitize_for_jsonb(f"a{pair}b") == f"a{pair}b"
+
+    def test_strips_only_the_unpaired_half(self):
+        # Lone high followed by a valid pair: the loner goes, the pair stays.
+        pair = chr(0xD83D) + chr(0xDE00)
+        assert sanitize_for_jsonb(chr(0xD800) + pair) == pair
+
+    def test_keeps_other_control_characters(self):
+        # Only NUL and unpaired surrogates are rejected by jsonb; \x01 round-trips
+        # fine and stripping it would silently alter data for no reason.
+        assert sanitize_for_jsonb("a\x01b") == "a\x01b"
+
+    def test_cleans_nested_values_and_keys(self):
+        dirty = {f"k{NUL}": [{"inner": f"v{NUL}"}, (f"t{NUL}",)]}
+        assert sanitize_for_jsonb(dirty) == {"k": [{"inner": "v"}, ["t"]]}
+
+    def test_leaves_non_strings_untouched(self):
+        value = {"n": 1, "f": 1.5, "b": True, "none": None}
+        assert sanitize_for_jsonb(value) == value
+
+    def test_does_not_mutate_input(self):
+        original = {"a": [f"x{NUL}"]}
+        sanitize_for_jsonb(original)
+        assert original == {"a": [f"x{NUL}"]}
+
+    def test_clean_payload_is_unchanged(self):
+        value = {"output": {"invoice_number": "POZFBBOK", "amount": 42}}
+        assert sanitize_for_jsonb(value) == value
+
+
+class TestDumpsForJsonb:
+    def test_emits_no_nul_escape(self):
+        # The exact production payload shape from UN-4126.
+        out = dumps_for_jsonb({"output": {"invoice_number": f"POZFBBOK{NUL}"}})
+        assert "\\u0000" not in out
+        assert json.loads(out) == {"output": {"invoice_number": "POZFBBOK"}}
+
+    def test_emits_no_surrogate_escape(self):
+        out = dumps_for_jsonb({"a": LONE_SURROGATE})
+        assert "\\ud800" not in out.lower()
+
+    def test_keeps_a_valid_pair_in_the_encoded_output(self):
+        pair = chr(0xD83D) + chr(0xDE00)
+        out = dumps_for_jsonb({"a": pair})
+        # json.dumps emits the pair as two escapes; Postgres accepts and combines
+        # them, so they must still be there.
+        assert out.lower() == '{"a": "\\ud83d\\ude00"}'
+
+    @pytest.mark.parametrize(
+        "bad", [math.nan, math.inf, -math.inf], ids=["nan", "inf", "-inf"]
+    )
+    def test_rejects_non_finite_numbers(self, bad):
+        # Not repairable: null/0 would corrupt a value rather than clean it, so
+        # the writer is told instead of the database finding out.
+        with pytest.raises(ValueError):
+            dumps_for_jsonb({"confidence": bad})
+
+    def test_default_hook_output_is_sanitised_too(self):
+        # The pre-walk runs before json.dumps, so a string the hook manufactures
+        # at encode time would otherwise never be inspected — and `str` on an
+        # exception carrying document text is exactly how a NUL gets there.
+        class Carrier:
+            def __str__(self):
+                return "extracted" + NUL + "text"
+
+        out = dumps_for_jsonb({"e": Carrier()}, default=str)
+        assert "\\u0000" not in out
+        assert json.loads(out) == {"e": "extractedtext"}
+
+    def test_circular_reference_raises_valueerror_not_recursionerror(self):
+        # RecursionError subclasses RuntimeError, which every downstream
+        # `except (TypeError, ValueError)` degradation seam would miss — turning
+        # a bad payload back into the caller strand this module prevents.
+        cycle: dict = {}
+        cycle["self"] = cycle
+        with pytest.raises(ValueError):
+            dumps_for_jsonb(cycle)
+
+    def test_excessive_nesting_raises_valueerror(self):
+        deep
```

**File**: `workers/queue_backend/pg_barrier.py` (modified, +48/-16)
```diff
@@ -62,7 +62,6 @@
 from __future__ import annotations
 
 import contextlib
-import json
 import logging
 import threading
 import time
@@ -75,6 +74,7 @@
 import psycopg2.extensions
 
 from unstract.core.data_models import LEGACY_TRANSPORT_KEY, LEGACY_TRANSPORT_VALUE
+from unstract.core.jsonb import dumps_for_jsonb
 
 from .barrier import (
     BarrierContext,
@@ -91,7 +91,8 @@
 )
 from .handle import BarrierHandle
 from .pg_queue.connection import CONN_DEAD_ERRORS as _CONN_DEAD_ERRORS
-from .pg_queue.connection import create_pg_connection
+from .pg_queue.connection import PAYLOAD_REJECTED_ERRORS as _PAYLOAD_REJECTED_ERRORS
+from .pg_queue.connection import create_pg_connection, is_connection_dead
 from .pg_queue.schema import qualified
 
 if TYPE_CHECKING:
@@ -132,7 +133,7 @@ def _recover_after_error(conn: PgConnection, exc: BaseException) -> bool:
     ``_cursor`` because it must distinguish execute-phase from commit-phase
     failures) share one definition of "recover a connection after an error".
     """
-    conn_dead = isinstance(exc, _CONN_DEAD_ERRORS)
+    conn_dead = is_connection_dead(exc)
     try:
         conn.rollback()
     except Exception:
@@ -232,6 +233,11 @@ def _run_idempotent_pre_dispatch_write(
                 operation(cur)
             return
         except _CONN_DEAD_ERRORS as exc:
+            # A payload rejection also reaches this clause (ProgramLimitExceeded
+            # subclasses OperationalError). It is permanent, so let it through to
+            # _barrier_pg_decrement's handler instead of re-sending it.
+            if not is_connection_dead(exc):
+                raise
             # _cursor already dropped the dead thread-local conn → the next
             # _get_conn() reconnects. Retry once; re-raise if it still fails
             # (a genuinely-down DB surfaces as ERROR, as before). Name the real
@@ -1028,30 +1034,56 @@ def _barrier_pg_decrement(
     try:
         # No default=str — a non-JSON-safe leaf must fail loudly here (it would
         # signal a BatchExecutionResult.to_dict() typed-boundary regression).
-        result_json = json.dumps(result)
+        # dumps_for_jsonb additionally repairs the strings a jsonb cast refuses
+        # (NUL, lone surrogate) so a stray control byte in a header result no
+        # longer costs the whole barrier. What it cannot repair (NaN, or a
+        # rejection it does not model) propagates to the caller, which owns
+        # teardown — see the note on the raise below.
+        result_json = dumps_for_jsonb(result)
     except (TypeError, ValueError):
+        # Log and re-raise; do NOT tear the barrier down here. ``allow_nan=False``
+        # moves NaN/Infinity onto this branch, so this is the encode-side twin of
+        # the rejection branch below and must follow the same rule.
         logger.exception(
-            f"[exec:{execution_id}] Header task result is not JSON-serialisable "
-            f"— barrier aggregation cannot proceed (typed-boundary regression)."
+            f"[exec:{execution_id}] Header task result cannot be encoded for "
+            f"jsonb (not JSON-serialisable, or a non-finite number) — "
+            f"propagating so the caller can mark the execution terminal before "
+            f"the barrier row is released."
         )
         raise
 
     # jsonb_build_array(...) appends exactly one element regardless of the
     # result's shape (``||`` would concatenate if the result were itself a list).
     try:
         row = _apply_decrement(execution_id, result_json, reused=conn_was_cached)
-    except psycopg2.DataError:
-        # json.dumps accepts a few bytes jsonb rejects — notably a NUL (0x00)
-        # in a string. The cast above then raises, the decrement never lands, and
-        # the barrier would hang to expires_at (~6h). Tear it down so the
-        # execution fails fast and visibly instead.
+    except _PAYLOAD_REJECTED_ERRORS:
+        # Reached for a rejection dumps_for_jsonb does not model. The decrement
+        # never lands, so this batch can never complete the barrier.
+        #
+        # Catch the closed family the result backend uses, not ``DataError``
+        # alone: ``ProgramLimitExceeded`` ("string too long", SQLSTATE 54)
+        # subclasses ``OperationalError``, so a DataError-only net lets an
+        # oversized header result through without this specific, actionable log.
+        #
+        # Deliberately does NOT call ``_delete_barrier``. Teardown belongs to
+        # ``run_batch_with_barrier``, which marks the execution ERROR *first* and
+        # releases the row only once that mark is confirmed — because the row is
+        # the reaper's only recovery handle. Deleting it here pre-empts that
+        # ordering: when the mark cannot be confirmed (backend unreachable, or no
+        # organization_id on the descriptor) the caller's ``else`` branch
+        # deliberately preserves the row, logs "leaving the barrier row intact
+        # for the
```

**File**: `workers/queue_backend/pg_queue/client.py` (modified, +18/-7)
```diff
@@ -31,18 +31,18 @@
 from __future__ import annotations
 
 import contextlib
-import json
 import logging
 import time
 from collections.abc import Iterator
 from dataclasses import dataclass
 from typing import TYPE_CHECKING, Any, Final, Self
 
 from unstract.core.data_models import QueueMessageState
+from unstract.core.jsonb import dumps_for_jsonb
 
 from ..fairness import DEFAULT_PRIORITY, MAX_PRIORITY, MIN_PRIORITY
 from .connection import CONN_DEAD_ERRORS as _CONN_DEAD_ERRORS
-from .connection import create_pg_connection
+from .connection import create_pg_connection, is_connection_dead
 from .schema import qualified
 
 if TYPE_CHECKING:
@@ -227,7 +227,7 @@ def _cursor(self) -> Iterator[Any]:
             # failed-rollback branch below, which drops the handle) but is
             # intentionally NOT retried by ``send()`` — it's left to the next
             # call's reconnect.
-            conn_dead = isinstance(exc, _CONN_DEAD_ERRORS)
+            conn_dead = is_connection_dead(exc)
             try:
                 conn.rollback()
             except Exception:
@@ -301,7 +301,10 @@ def send(
                 queue_name, message, org_id=org_id, priority=priority
             )
         except _CONN_DEAD_ERRORS as exc:
-            if not reused:
+            # A payload the server refused is not a stale connection — see
+            # is_connection_dead. Re-sending it would repeat a large write that
+            # can never land.
+            if not reused or not is_connection_dead(exc):
                 raise
             # Describe what we observed, not a verdict: a connection-level error
             # on a reused conn is usually a stale idle reap, but a real DB
@@ -338,15 +341,23 @@ def _insert_message(
         org_id: str | None,
         priority: int,
     ) -> int:
-        """One INSERT of a queue row, returning its ``msg_id`` (see :meth:`send`)."""
+        """One INSERT of a queue row, returning its ``msg_id`` (see :meth:`send`).
+
+        Encoded with ``dumps_for_jsonb`` (no ``default=``, preserving the
+        TypeError-on-UUID contract the consumer's ``_json_safe`` compensates for)
+        so a string the ``::jsonb`` cast would refuse cannot reach the INSERT.
+        A self-chained continuation prepends the *executor result* — the same
+        payload that carried a NUL in UN-4126 — and ``_chain_continuation`` never
+        raises, so an unencodable message here is a silently lost callback.
+        """
         with self._cursor() as cur:
             cur.execute(
                 insert_message_sql() + " RETURNING msg_id",
                 # "" rather than NULL for "no org" — the column is non-null
                 # (string fields shouldn't have two empty values; Django S6553).
                 (
                     queue_name,
-                    json.dumps(message),
+                    dumps_for_jsonb(message),
                     org_id if org_id is not None else "",
                     priority,
                 ),
@@ -430,7 +441,7 @@ def delete(self, msg_id: int) -> bool:
         try:
             return self._delete_row(msg_id)
         except _CONN_DEAD_ERRORS as exc:
-            if not reused:
+            if not reused or not is_connection_dead(exc):
                 raise
             logger.warning(
                 "PG-queue: delete(msg_id=%s) failed with a connection-level error "
```

---

### Incident Patch 14: `58d695d4` (2026-09-18)
**Commit Message**: UN-4128 [FIX] Stop the pipeline/ETL list page from 500ing (#2291)

* UN-4128 [FIX] Stop the Pipeline list page 500ing on the workflow-scoping guard

PipelineSerializer.get_fields() (UN-2868, #2273) scopes the workflow field
to the requester's own workflows, guarding the single-instance case with
`self.instance is not None`. On a list request DRF hands the child
serializer of a many=True ListSerializer the whole queryset as
self.instance, not one row -- `is not None` let that through and
`.workflow_id` crashed on a list.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_018KZLGSa3oWxgVJdFqvRUQX

* UN-4128 Add regression test for pipeline list serializer crash

Covers the AttributeError DRF's paginated list GET triggers when
self.instance is a list instead of a Pipeline or None.

Co-Authored-By: Claude Sonnet 5 <[REDACTED_EMAIL]>

* UN-4128 Cover the public many=True constructor in the list-scoping test

Greptile asked for a test that exercises PipelineSerializer(queryset,
many=True) directly instead of hand-setting self.instance. DRF's
many_init passes the same instance to the child, so both paths already
caught the regression, but th

**File**: `backend/pipeline_v2/serializers/crud.py` (modified, +2/-1)
```diff
@@ -63,7 +63,8 @@ def get_fields(self) -> dict[str, Any]:
         # An update resends the bound workflow unchanged, so keep it
         # selectable: a co-owner of this resource need not own the workflow.
         # ``validate_workflow`` still refuses an actual change.
-        if self.instance is not None:
+        if isinstance(self.instance, Pipeline):
+            # On a list request, ``self.instance`` is the whole queryset, not one row.
             queryset = queryset | Workflow.objects.filter(pk=self.instance.workflow_id)
         fields["workflow"].queryset = queryset
         # Same code, readable text: the default names a pk the user never
```

**File**: `backend/pipeline_v2/tests/test_pipeline_serializer_list_scoping.py` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+"""``PipelineSerializer.get_fields`` must survive a list request.
+
+DRF's ``many_init`` builds the child serializer with the same ``instance``
+argument handed to the list serializer, so a paginated GET binds the page (a
+``list``) to the child's ``self.instance`` -- never a single ``Pipeline``.
+``get_fields`` used to guard its workflow-scoping merge with
+``self.instance is not None``, which is true for that list too, so it called
+``.workflow_id`` on a ``list`` and crashed every pipeline/ETL list request
+with an ``AttributeError``. The guard now checks ``isinstance(self.instance,
+Pipeline)`` instead.
+
+The real module is imported and its collaborator patched (Django is loaded by
+the rig's test env), so no database is touched and this stays in the unit
+tier.
+"""
+
+from __future__ import annotations
+
+import uuid
+from unittest.mock import MagicMock, patch
+
+from pipeline_v2.models import Pipeline
+from pipeline_v2.serializers.crud import PipelineSerializer
+from workflow_manager.workflow_v2.models.workflow import Workflow
+
+MUTABLE_WORKFLOWS_PATH = "pipeline_v2.serializers.crud.mutable_workflows_for"
+
+
+class TestWorkflowFieldScopingSurvivesAList:
+    """The instance-type guard in ``get_fields`` must not crash on a list."""
+
+    def test_list_instance_does_not_crash(self) -> None:
+        """A paginated list's ``self.instance`` is a ``list``, not a ``Pipeline``."""
+        serializer = PipelineSerializer()
+        serializer.instance = [MagicMock(spec=Pipeline)]
+
+        with patch(MUTABLE_WORKFLOWS_PATH, return_value=Workflow.objects.none()):
+            fields = serializer.get_fields()  # must not raise AttributeError
+
+        assert "workflow" in fields
+
+    def test_many_true_construction_does_not_crash(self) -> None:
+        """The public ``PipelineSerializer(queryset, many=True)`` entry point."""
+        with patch(MUTABLE_WORKFLOWS_PATH, return_value=Workflow.objects.none()):
+            serializer = PipelineSerializer([MagicMock(spec=Pipeline)], many=True)
+            fields = serializer.child.fields  # must not raise AttributeError
+
+        assert "workflow" in fields
+
+    def test_single_instance_still_scopes_to_its_own_workflow(self) -> None:
+        """A detail/update request keeps the co-owner carve-out for its own workflow."""
+        pipeline = MagicMock(spec=Pipeline, workflow_id=uuid.uuid4())
+        serializer = PipelineSerializer()
+        serializer.instance = pipeline
+
+        with patch(MUTABLE_WORKFLOWS_PATH, return_value=Workflow.objects.none()):
+            with patch.object(
+                Workflow.objects, "filter", wraps=Workflow.objects.filter
+            ) as mocked_filter:
+                serializer.get_fields()
+
+        mocked_filter.assert_called_once_with(pk=pipeline.workflow_id)
```

---

### Incident Patch 15: `6fe7d8df` (2026-09-18)
**Commit Message**: UN-4124 [FIX] Implement antd's expandable API on the shared DataTable so nested cell values expand again (#2288)

* UN-4124 [FIX] Implement antd's expandable on the shared DataTable

The Ant Design removal (#1683 / #2212) replaced `<Table>` with the shared
DataTable, which never implemented antd's `expandable` API. Undeclared, the
whole object fell into `...props` and was spread onto the wrapper <div>, where
React ignores it — so `expandedRowRender` was never called and the table
rendered as if the prop had not been passed, with no console error.

HITL's review editor is the visible casualty: an array or object inside a table
cell shows a truncated JSON blob with an expand button beside it, and clicking
that button did nothing at all, leaving nested values unreadable in Table view.

Support `expandedRowRender`, controlled `expandedRowKeys` and uncontrolled
`defaultExpandedRowKeys`, `rowExpandable`, `showExpandColumn`, `expandIcon`,
`expandedRowClassName`, `onExpand` and `onExpandedRowsChange`. The panel is a
sibling <tr> spanning every column, since a row may only contain cells.

Keys are compared as strings because that is what TanStack's `getRowId` (and so
`row.id`) produces: a c

**File**: `frontend/src/components/data-table/DataTable.jsx` (modified, +211/-31)
```diff
@@ -413,17 +413,167 @@ function DataTable({
    * order-less state.
    */
   sortDirections,
+  /**
+   * antd's `expandable={{ expandedRowRender, expandedRowKeys, rowExpandable,
+   * showExpandColumn, onExpand, … }}` — a full-width extra row rendered under
+   * the record it belongs to.
+   *
+   * Declared for the same reason as `onRow`, `showHeader`, `scroll`,
+   * `bordered`, `locale` and `sortDirections` above, and it is the widest
+   * silent drop of the set: undeclared, the whole object fell into `...props`
+   * and onto the wrapper <div>, so `expandedRowRender` was never called and
+   * the table rendered as if the prop had not been passed. HITL's review
+   * editor is the visible casualty — an array or object inside a table cell
+   * shows a truncated JSON blob with an expand button beside it, and clicking
+   * that button did nothing at all, leaving nested values unreadable in Table
+   * view (UN-4124).
+   */
+  expandable,
   ...props
 }) {
   const empty = locale?.emptyText ?? emptyText;
   const [sorting, setSorting] = React.useState([]);
   const [selection, setSelection] = React.useState({});
 
   const rows = React.useMemo(() => dataSource ?? [], [dataSource]);
-  const cols = React.useMemo(
-    () => toColumns(columns, rowSelection),
-    [columns, rowSelection],
+
+  /*
+   * Expansion, in antd's shape. Keys are compared as strings because that is
+   * what TanStack's `getRowId` (and so `row.id`) produces from whatever
+   * `rowKey` resolves to — a call-site numbering its rows `key: index` passes
+   * numbers, and `[0].includes("0")` is false.
+   */
+  const expandedRowRender = expandable?.expandedRowRender;
+  const canExpand = typeof expandedRowRender === "function";
+  const controlledExpandedKeys = expandable?.expandedRowKeys;
+  const [ownExpandedKeys, setOwnExpandedKeys] = React.useState(
+    () => expandable?.defaultExpandedRowKeys ?? [],
+  );
+  const expandedKeys = React.useMemo(
+    () => new Set((controlledExpandedKeys ?? ownExpandedKeys).map(String)),
+    [controlledExpandedKeys, ownExpandedKeys],
+  );
+
+  const isRowExpandable = React.useCallback(
+    (record) =>
+      canExpand &&
+      (typeof expandable?.rowExpandable === "function"
+        ? Boolean(expandable.rowExpandable(record))
+        : true),
+    [canExpand, expandable?.rowExpandable],
+  );
+
+  const onExpandCb = expandable?.onExpand;
+  const onExpandedRowsChange = expandable?.onExpandedRowsChange;
+  const toggleExpanded = React.useCallback(
+    (key, record, originalKey) => {
+      const willExpand = !expandedKeys.has(key);
+      /*
+       * Report the caller's own key values, never the normalized strings:
+       * normalization exists to match TanStack's `row.id` and must not leak
+       * out. A controlled caller that passed `[1]` and then tests
+       * `next.includes(1)` would never match `["1"]`.
+       */
+      const source = controlledExpandedKeys ?? ownExpandedKeys;
+      const next = willExpand
+        ? [...source, originalKey]
+        : source.filter((k) => String(k) !== key);
+      // A controlled `expandedRowKeys` belongs to the parent: report, never set.
+      if (controlledExpandedKeys === undefined) {
+        setOwnExpandedKeys(next);
+      }
+      onExpandCb?.(willExpand, record);
+      onExpandedRowsChange?.(next);
+    },
+    [
+      expandedKeys,
+      controlledExpandedKeys,
+      ownExpandedKeys,
+      onExpandCb,
+      onExpandedRowsChange,
+    ],
+  );
+
+  /*
+   * The untouched key behind `row.id`. `getRowId` stringifies whatever `rowKey`
+   * resolves to, so this is the only way back to the value the call-site
+   * actually holds — falling back to the row index, which is what `getRowId`
+   * itself uses when the record carries no key.
+   */
+  const originalRowKey = React.useCallback(
+    (record, index) => {
+      const raw =
+        typeof rowKey === "function" ? rowKey(record) : record?.[rowKey];
+      return raw === undefined || raw === null ? index : raw;
+    },
+    [rowKey],
   );
+
+  /*
+   * antd hides the toggle column for `showExpandColumn: false` — the idiom for
+   * a table driven entirely by its own controls, which is how HITL opens a
+   * cell's nested table from a button inside the cell.
+   */
+  const showExpandColumn = canExpand && expandable?.showExpandColumn !== false;
+  const expandIcon = expandable?.expandIcon;
+  const cols = React.useMemo(() => {
+    const base = toColumns(columns, rowSelection);
+    if (!showExpandColumn) {
+      return base;
+    }
+    return [
+      {
+        id: "__expand",
+        header: () => null,
+        enableSorting: false,
+        size: 48,
+        cell: ({ row }) => {
+          const record = row.original;
+          if (!isRowExpandable(record)) {
+            return null;
+          }
+          const expanded = expandedKeys.has(row.id);
+          const onExpand = (event) => {
+            // The row itself may carry an onRow click handler.
+         
```

**File**: `frontend/src/components/data-table/DataTable.test.jsx` (modified, +178/-0)
```diff
@@ -1646,3 +1646,181 @@ describe("DataTable nested dataIndex", () => {
     expect(screen.getByText("plan: LLM Whisperer Free")).toBeInTheDocument();
   });
 });
+
+/*
+ * `expandable` was the widest of the silently dropped antd props: the whole
+ * object fell into `...props` and onto the wrapper <div>, so `expandedRowRender`
+ * was never called. HITL's review editor shows a truncated JSON blob plus an
+ * expand button for an array or object inside a table cell, and clicking that
+ * button did nothing whatsoever — nested values were unreadable in Table view
+ * (UN-4124).
+ */
+describe("DataTable expandable", () => {
+  const detail = (record) => <div>detail for {record.name}</div>;
+
+  it("renders the expanded row for a controlled expandedRowKeys", () => {
+    render(
+      <DataTable
+        columns={columns}
+        dataSource={rowsFor(2)}
+        rowKey="id"
+        expandable={{ expandedRowRender: detail, expandedRowKeys: [2] }}
+      />,
+    );
+    expect(screen.getByText("detail for Row 2")).toBeInTheDocument();
+    expect(screen.queryByText("detail for Row 1")).not.toBeInTheDocument();
+  });
+
+  it("matches numeric keys against the string row ids TanStack produces", () => {
+    // A call-site numbering its rows `key: index` passes numbers, and
+    // `[0].includes("0")` is false — the mismatch that hid every expansion.
+    render(
+      <DataTable
+        columns={columns}
+        dataSource={[{ key: 0, name: "Row 1" }]}
+        rowKey="key"
+        expandable={{ expandedRowRender: detail, expandedRowKeys: [0] }}
+      />,
+    );
+    expect(screen.getByText("detail for Row 1")).toBeInTheDocument();
+  });
+
+  it("spans every column so the panel is full width", () => {
+    render(
+      <DataTable
+        columns={[
+          { key: "name", dataIndex: "name", title: "Name" },
+          { key: "id", dataIndex: "id", title: "Id" },
+        ]}
+        dataSource={rowsFor(1)}
+        rowKey="id"
+        expandable={{ expandedRowRender: detail, expandedRowKeys: [1] }}
+      />,
+    );
+    const panel = screen.getByText("detail for Row 1").closest("td");
+    // Two data columns plus the toggle column the shim adds.
+    expect(panel).toHaveAttribute("colspan", "3");
+  });
+
+  it("honours rowExpandable", () => {
+    render(
+      <DataTable
+        columns={columns}
+        dataSource={rowsFor(2)}
+        rowKey="id"
+        expandable={{
+          expandedRowRender: detail,
+          expandedRowKeys: [1, 2],
+          rowExpandable: (record) => record.id === 1,
+        }}
+      />,
+    );
+    expect(screen.getByText("detail for Row 1")).toBeInTheDocument();
+    expect(screen.queryByText("detail for Row 2")).not.toBeInTheDocument();
+  });
+
+  it("toggles from its own column when the keys are uncontrolled", async () => {
+    const user = userEvent.setup();
+    const onExpand = vi.fn();
+    render(
+      <DataTable
+        columns={columns}
+        dataSource={rowsFor(1)}
+        rowKey="id"
+        expandable={{ expandedRowRender: detail, onExpand }}
+      />,
+    );
+    expect(screen.queryByText("detail for Row 1")).not.toBeInTheDocument();
+
+    await user.click(screen.getByRole("button", { name: "Expand row" }));
+    expect(screen.getByText("detail for Row 1")).toBeInTheDocument();
+    expect(onExpand).toHaveBeenCalledWith(
+      true,
+      expect.objectContaining({ id: 1 }),
+    );
+
+    await user.click(screen.getByRole("button", { name: "Collapse row" }));
+    await waitFor(() =>
+      expect(screen.queryByText("detail for Row 1")).not.toBeInTheDocument(),
+    );
+  });
+
+  it("leaves the toggle column out for showExpandColumn: false", () => {
+    render(
+      <DataTable
+        columns={columns}
+        dataSource={rowsFor(1)}
+        rowKey="id"
+        expandable={{
+          expandedRowRender: detail,
+          expandedRowKeys: [1],
+          showExpandColumn: false,
+        }}
+      />,
+    );
+    expect(screen.getByText("detail for Row 1")).toBeInTheDocument();
+    expect(
+      screen.queryByRole("button", { name: /row$/ }),
+    ).not.toBeInTheDocument();
+  });
+
+  it("reports a controlled toggle without moving on its own", async () => {
+    const user = userEvent.setup();
+    const onExpandedRowsChange = vi.fn();
+    render(
+      <DataTable
+        columns={columns}
+        dataSource={rowsFor(1)}
+        rowKey="id"
+        expandable={{
+          expandedRowRender: detail,
+          expandedRowKeys: [],
+          onExpandedRowsChange,
+        }}
+      />,
+    );
+    await user.click(screen.getByRole("button", { name: "Expand row" }));
+    /*
+     * The caller's own key type, not the string TanStack normalizes it to:
+     * these rows key on a numeric `id`, and a parent testing `includes(1)`
+     * against a reported `["1"]` would never match.
+     */
+    expect(onExpandedRowsChange).toHaveBeenCalledWith([1]);
+    // The parent did not move its keys, so neither did the 
```

**File**: `frontend/src/components/ui/shims/antd-structure.test.jsx` (modified, +66/-1)
```diff
@@ -6,7 +6,13 @@ import {
   within,
 } from "@testing-library/react";
 import userEvent from "@testing-library/user-event";
-import { createRef, forwardRef, useEffect, useImperativeHandle } from "react";
+import {
+  createRef,
+  forwardRef,
+  useEffect,
+  useImperativeHandle,
+  useState,
+} from "react";
 import { afterEach, describe, expect, it, vi } from "vitest";
 
 import {
@@ -1736,3 +1742,62 @@ describe("antd-compatible structural shims (P4)", () => {
     });
   });
 });
+
+/*
+ * HITL's review editor drives expansion from a button inside the cell, not
+ * from antd's toggle column, so it passes `showExpandColumn: false` and a
+ * controlled `expandedRowKeys` of row indices. The shim dropped `expandable`
+ * entirely, so the panel never rendered: a customer reviewing a MARS
+ * certificate saw `{"vendor":"Frut…` with an expand button that did nothing,
+ * and no way to read the nested values in Table view (UN-4124).
+ */
+describe("Table expandable (UN-4124)", () => {
+  const row = {
+    key: 0,
+    headerInfo: { vendor: "Fruta" },
+    sap_mapping: [{ hitl_flag: false }],
+    testResults: [{ result: "230" }],
+  };
+  const columns = ["headerInfo", "sap_mapping", "testResults"].map((c) => ({
+    title: c,
+    dataIndex: c,
+    key: c,
+    render: (v) => JSON.stringify(v).slice(0, 12),
+  }));
+
+  function Harness() {
+    const [expanded, setExpanded] = useState({});
+    return (
+      <Table
+        dataSource={[row]}
+        columns={columns}
+        rowKey="key"
+        pagination={false}
+        expandable={{
+          showExpandColumn: false,
+          expandedRowKeys: Object.keys(expanded)
+            .filter((k) => expanded[k])
+            .map(Number),
+          rowExpandable: (record) => Boolean(expanded[record.key]),
+          expandedRowRender: (record) => (
+            <div>expanded {JSON.stringify(record.sap_mapping)}</div>
+          ),
+        }}
+        onRow={(record) => ({
+          onClick: () => setExpanded({ [record.key]: true }),
+        })}
+      />
+    );
+  }
+
+  it("opens the nested panel when the call-site sets its own expanded keys", async () => {
+    const user = userEvent.setup();
+    render(<Harness />);
+    expect(screen.queryByText(/^expanded /)).not.toBeInTheDocument();
+
+    await user.click(screen.getByText('{"vendor":"F'));
+    expect(
+      await screen.findByText('expanded [{"hitl_flag":false}]'),
+    ).toBeInTheDocument();
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #2315** (2026-10-05): UN-4123 [FIX] The default Redis user without a password is not an error (@muhammad-ali-e)
- **PR #2312** (closed): UN-4223 [FIX] Kill a stuck PG consumer child instead of restarting the whole pod (@johnyrahul)
- **PR #2308** (2026-09-30): [MISC] Fix flaky integration CI: rig Postgres lock limit and unmocked pg_barrier dispatch (@johnyrahul)
- **PR #2305** (2026-09-29): UN-4185 [DEPS] Declare implicit frontend dependencies and remove unused ones (@jaseemjaskp)
- **PR #2304** (2026-09-29): UN-2646 [FIX] Skip the OSS-only vlm_utils contract in a merged cloud tree (@praveen-formido)
- **PR #2303** (2026-09-29): UN-4184 [MISC] Enable Biome recommended, a11y and hooks lint rules and remove dead eslint-disable comments (@jaseemjaskp)
- **PR #2302** (2026-09-29): UN-4183 [MISC] Run frontend typecheck and tests in CI and make the frontend test group required (@jaseemjaskp)
- **PR #2301** (2026-09-29): UN-4136 [FIX] Report PG worker pods ready only after every consumer child has loaded (@johnyrahul)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
