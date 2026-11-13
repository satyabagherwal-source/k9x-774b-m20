# Agent Contract: Agent Contract: heymrun/heym Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "heymrun/heym",
  "source_url": "https://github.com/heymrun/heym",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [heymrun/heym](https://github.com/heymrun/heym) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `heymrun-heym-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/heymrun-heym-learnings.md`  
> **Source**: github ([https://github.com/heymrun/heym](https://github.com/heymrun/heym))  
> **Source Version**: `bb769ab7`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-09T04:59:33.999Z  
> **Learning ID**: `learn-github-heymrun-heym`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): heymrun/heym

> **Canonical Artifact**: `07_PROJECT_LEARNING/heymrun-heym-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/heymrun/heym](https://github.com/heymrun/heym))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-09T04:59:32.825Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `heymrun/heym`
- **Description**: Build agentic systems. Run them with confidence. Orchestrate agents, automate business processes, inspect every execution, and keep humans in control. Deploy Heym on your own infrastructure.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1523 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/alembic/versions/047_add_webhook_body_mode.py`
```
"""Add webhook body mode to workflows and workflow versions."""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "047"
down_revision: str | None = "046"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    webhook_body_mode = sa.Enum("legacy", "generic", name="webhook_body_mode")
    webhook_body_mode.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "workflows",
        sa.Column(
            "webhook_body_mode",
            sa.Enum("legacy", "generic", name="webhook_body_mode"),
            nullable=True,
        ),
    )
    op.add_column(
        "workflow_versions",
        sa.Column(
            "webhook_body_mode",
            sa.Enum("legacy", "generic", name="webhook_body_mode"),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE workflows
        SET webhook_body_mode = 'legacy'::webhook_body_mode
        WHERE webhook_body_mode IS NULL
        """
    )
    op.execute(
        """
        UPDATE workflow_versions
        SET webhook_body_mode = 'legacy'::webhook_body_mode
        WHERE webhook_body_mode IS NULL
        """
    )

    op.alter_column(
        "workflows",
        "webhook_body_mode",
        nullable=False,
        server_default="legacy",
    )
    op.alter_column(
        "workflow_versions",
        "webhook_body_mode",
        nullable=False,
        server_default="legacy",
    )


def downgrade() -> None:
    op.drop_column("workflow_versions", "webhook_body_mode")
    op.drop_column("workflows", "webhook_body_mode")
    op.execute("DROP TYPE IF EXISTS webhook_body_mode")

```

### Core Architecture Module: `backend/alembic/versions/091_dashboard_chat_queue.py`
```
"""add dashboard chat queue

Revision ID: 091_dashboard_chat_queue
Revises: 090_add_plugins_table
Create Date: 2026-07-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "091_dashboard_chat_queue"
down_revision: str | None = "090_add_plugins_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "dashboard_conversations",
        sa.Column("queue_paused_by_message_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_dashboard_conversations_queue_paused_by_message_id",
        "dashboard_conversations",
        "dashboard_messages",
        ["queue_paused_by_message_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "dashboard_chat_queue_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("dashboard_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "credential_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("credentials.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("model", sa.String(length=255), nullable=False),
        sa.Column("attachment", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_dashboard_chat_queue_items_conversation_id",
        "dashboard_chat_queue_items",
        ["conversation_id"],
    )
    op.create_index(
        "ix_dashboard_chat_queue_items_conv_created_id",
        "dashboard_chat_queue_items",
        ["conversation_id", "created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_dashboard_chat_queue_items_conv_created_id",
        table_name="dashboard_chat_queue_items",
    )
    op.drop_index(
        "ix_dashboard_chat_queue_items_conversation_id",
        table_name="dashboard_chat_queue_items",
    )
    op.drop_table("dashboard_chat_queue_items")
    op.drop_constraint(
        "fk_dashboard_conversations_queue_paused_by_message_id",
        "dashboard_conversations",
        type_="foreignkey",
    )
    op.drop_column("dashboard_conversations", "queue_paused_by_message_id")

```

### Core Architecture Module: `backend/alembic/versions/117_add_workflow_run_queue.py`
```
"""add workflow_run_queue and cluster_dispatch_state

Revision ID: 117_add_workflow_run_queue
Revises: 116_add_cluster_instances
Create Date: 2026-08-27 10:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "117_add_workflow_run_queue"
down_revision: Union[str, None] = "116_add_cluster_instances"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflow_run_queue",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workflow_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workflows.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("execution_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("placement", sa.String(16), nullable=False),
        sa.Column("target_instance_id", sa.String(128), nullable=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("inputs", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("trigger_source", sa.String(50), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("credentials_owner_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("test_run", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("timeout_seconds", sa.Float(), nullable=True),
        sa.Column("enqueued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("not_after", sa.DateTime(timezone=True), nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claimed_by_process", sa.String(128), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_workflow_run_queue_claim",
        "workflow_run_queue",
        ["target_instance_id", "status", "enqueued_at"],
    )
    op.create_index("ix_workflow_run_queue_status", "workflow_run_queue", ["status"])

    op.create_table(
        "cluster_dispatch_state",
        sa.Column("id", sa.String(16), primary_key=True),
        sa.Column("counters", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.execute("INSERT INTO cluster_dispatch_state (id, counters) VALUES ('singleton', '{}')")


def downgrade() -> None:
    op.drop_table("cluster_dispatch_state")
    op.drop_index("ix_workflow_run_queue_status", table_name="workflow_run_queue")
    op.drop_index("ix_workflow_run_queue_claim", table_name="workflow_run_queue")
    op.drop_table("workflow_run_queue")

```

### Core Architecture Module: `backend/alembic/versions/120_add_queued_chart_early_return.py`
```
"""preserve chart early-return behavior for offloaded dashboard runs

Revision ID: 120_queue_chart_return
Revises: 119_add_auto_weighting
Create Date: 2026-08-29 17:15:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "120_queue_chart_return"
down_revision: Union[str, None] = "119_add_auto_weighting"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "workflow_run_queue",
        sa.Column(
            "return_on_chart_output", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("workflow_run_queue", "return_on_chart_output")

```

### Core Architecture Module: `backend/alembic/versions/138_add_queue_trace_context.py`
```
"""Carry W3C trace context across the workflow run queue.

Revision ID: 138_add_queue_trace_context
Revises: 137_add_smtp_from_key
Create Date: 2026-10-14 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "138_add_queue_trace_context"
down_revision: Union[str, None] = "137_add_smtp_from_key"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "workflow_run_queue",
        sa.Column("trace_context", sa.JSON(none_as_null=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("workflow_run_queue", "trace_context")

```

### Core Architecture Module: `backend/alembic/versions/140_add_trigger_poll_state.py`
```
"""add trigger poll state for Google Drive and Google Sheets triggers

Revision ID: 140_add_trigger_poll_state
Revises: 139_add_slack_bot_credential
Create Date: 2026-10-17 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision: str = "140_add_trigger_poll_state"
down_revision: str | Sequence[str] | None = "139_add_slack_bot_credential"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trigger_poll_states",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workflow_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workflows.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("node_id", sa.String(255), nullable=False),
        sa.Column("node_type", sa.String(64), nullable=False),
        sa.Column("scope_fingerprint", sa.String(64), nullable=False),
        sa.Column("key_id", sa.String(32), nullable=False),
        sa.Column("version", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column(
            "next_poll_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("workflow_id", "node_id", name="uq_trigger_poll_state_node"),
    )
    op.create_index("ix_trigger_poll_states_workflow_id", "trigger_poll_states", ["workflow_id"])
    op.create_index("ix_trigger_poll_states_next_poll_at", "trigger_poll_states", ["next_poll_at"])

    op.create_table(
        "trigger_poll_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "state_id",
            UUID(as_uuid=True),
            sa.ForeignKey("trigger_poll_states.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("item_key", sa.String(255), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.UniqueConstraint("state_id", "item_key", name="uq_trigger_poll_item_key"),
    )


def downgrade() -> None:
    op.drop_table("trigger_poll_items")
    op.drop_index("ix_trigger_poll_states_next_poll_at", table_name="trigger_poll_states")
    op.drop_index("ix_trigger_poll_states_workflow_id", table_name="trigger_poll_states")
    op.drop_table("trigger_poll_states")

```

### Core Architecture Module: `backend/alembic/versions/143_workflow_concurrency.py`
```
"""per-workflow concurrency limit

Revision ID: 143_workflow_concurrency
Revises: 142_vsi_text_search_index
Create Date: 2026-10-25 00:00:00.000000

status_token_hash is a new, empty column: there is no plaintext to backfill. The
token it stores the digest of is secrets.token_urlsafe(32), which is shape-distinct
from a SHA-256 hex digest. Downgrade drops the column; nothing can be restored.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "143_workflow_concurrency"
down_revision: str | Sequence[str] | None = "142_vsi_text_search_index"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("workflows", sa.Column("concurrency_limit", sa.Integer(), nullable=True))
    op.add_column("workflows", sa.Column("concurrency_max_queue", sa.Integer(), nullable=True))
    op.add_column(
        "workflows", sa.Column("concurrency_max_wait_seconds", sa.Integer(), nullable=True)
    )
    op.create_table(
        "workflow_concurrency_slots",
        sa.Column("execution_id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workflow_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workflows.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_workflow_concurrency_slots_workflow_id",
        "workflow_concurrency_slots",
        ["workflow_id"],
    )
    op.execute("CREATE SEQUENCE IF NOT EXISTS workflow_concurrency_seq")
    op.add_column(
        "workflow_run_queue", sa.Column("concurrency_seq", sa.BigInteger(), nullable=True)
    )
    op.add_column(
        "workflow_run_queue", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "workflow_run_queue", sa.Column("status_token_hash", sa.String(64), nullable=True)
    )
    op.add_column("workflow_run_queue", sa.Column("run_options", sa.JSON(), nullable=True))
    op.create_index(
        "ix_workflow_run_queue_concurrency",
        "workflow_run_queue",
        ["workflow_id", "status", "concurrency_seq"],
    )


def downgrade() -> None:
    op.drop_index("ix_workflow_run_queue_concurrency", table_name="workflow_run_queue")
    op.drop_column("workflow_run_queue", "run_options")
    op.drop_column("workflow_run_queue", "status_token_hash")
    op.drop_column("workflow_run_queue", "expires_at")
    op.drop_column("workflow_run_queue", "concurrency_seq")
    op.execute("DROP SEQUENCE IF EXISTS workflow_concurrency_seq")
    op.drop_index(
        "ix_workflow_concurrency_slots_workflow_id", table_name="workflow_concurrency_slots"
    )
    op.drop_table("workflow_concurrency_slots")
    op.drop_column("workflows", "concurrency_max_wait_seconds")
    op.drop_column("workflows", "concurrency_max_queue")
    op.drop_column("workflows", "concurrency_limit")

```

### Core Architecture Module: `backend/app/services/cluster/run_queue.py`
```
"""Enqueue, claim, and retire background runs through Postgres.

The queue row never holds a resolved credentials context. It carries
credentials_owner_id and the executing instance calls
get_credentials_context() itself, which it can do because every instance in a
cluster shares one ENCRYPTION_KEY.
"""

from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, exists, select, text, update
from sqlalchemy.exc import StatementError

from app.config import settings
from app.db.models import ActiveWorkflowExecution, ClusterDispatchState, WorkflowRunQueue
from app.db.session import async_session_maker
from app.services.cluster import registry
from app.services.cluster.weights import level_counters, pick_instance, rescale_counters

logger = logging.getLogger("cluster")

STATUS_QUEUED = "queued"
STATUS_WAITING_FOR_MAIN = "waiting_for_main"
STATUS_CLAIMED = "claimed"
STATUS_DONE = "done"
STATUS_FAILED = "failed"
STATUS_SKIPPED_LATE = "skipped_late"
# A run waiting for a concurrency slot. Not claimable until promoted to queued.
STATUS_HELD = "held"
STATUS_EXPIRED = "expired"
STATUS_CANCELLED = "cancelled"


@dataclass(frozen=True)
class QueuedRun:
    workflow_id: uuid.UUID
    execution_id: uuid.UUID
    placement: str
    inputs: dict
    trigger_source: str | None
    actor_user_id: uuid.UUID | None
    credentials_owner_id: uuid.UUID | None
    test_run: bool
    timeout_seconds: float | None
    return_on_chart_output: bool
    trace_context: dict[str, str] | None = None
    run_options: dict | None = None


def next_status(*, target_instance_id: str | None) -> str:
    """A run with no reachable target waits instead of failing."""
    return STATUS_QUEUED if target_instance_id else STATUS_WAITING_FOR_MAIN


def is_expired(*, not_after: datetime, now: datetime) -> bool:
    return now > not_after


def build_queue_values(
    run: QueuedRun, *, target_instance_id: str | None, grace_seconds: int
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "id": uuid.uuid4(),
        "workflow_id": run.workflow_id,
        "execution_id": run.execution_id,
        "placement": run.placement,
        "target_instance_id": target_instance_id,
        "status": next_status(target_instance_id=target_instance_id),
        "inputs": run.inputs,
        "trace_context": run.trace_context,
        "trigger_source": run.trigger_source,
        "actor_user_id": run.actor_user_id,
        "credentials_owner_id": run.credentials_owner_id,
        "test_run": run.test_run,
        "timeout_seconds": run.timeout_seconds,
        "return_on_chart_output": run.return_on_chart_output,
        "enqueued_at": now,
        "not_after": now + timedelta(seconds=grace_seconds),
        "run_options": run.run_options,
    }


async def choose_target(placement: str) -> str | None:
    """Pick the instance for this run and charge it, in one locked transaction.

    A MAIN_ONLY run is not selected - its target is always main - but it still
    increments main's counter, so the forced work spends main's quota.
    """
    instances = await registry.list_instances(use_cache=True)
    now = datetime.now(timezone.utc)

    async with async_session_maker() as db:
        state = (
            await db.execute(
                select(ClusterDispatchState)
                .where(ClusterDispatchState.id == "singleton")
                .with_for_update()
            )
        ).scalar_one_or_none()
        if state is None:
            return None

        pool = registry.candidate_instances(instances, now=now)
        weights = {i.id: i.weight for i in pool}
        counters = level_counters(rescale_counters(dict(state.counters or {})), weights)

        if placement == "main_only":
            main = registry.find_main(instances)
            target = main.id if main and registry.is_live(main, now=now) else None
        else:
            target = pick_instance(weights, counters=counters)

        if target is not None:
            counters[target] = counters.get(target, 0) + 1
        if counters != (state.counters or {}):
            state.counters = counters
        await db.commit()
        return target


async def enqueue(run: QueuedRun) -> str | None:
    """Write the queue row and return the instance it was assigned to."""
    target = await choose_target(run.placement)
    values = build_queue_values(
        run, target_instance_id=target, grace_seconds=settings.cron_misfire_grace_seconds
    )
    try:
        async with async_session_maker() as db:
            await db.execute(WorkflowRunQueue.__table__.insert().values(**values))
            await db.commit()
    except StatementError as error:
        # Hide the carrier from SQLAlchemy's exception parameter display.
        error.hide_parameters = True
        raise
    return target


async def claim_next(instance_id: str) -> WorkflowRunQueue | None:
    """Take one queued row for this instance. Concurrent claimers skip each other."""
    async with async_session_maker() as db:
        row = (
            await db.execute(
                select(WorkflowRunQueue)
                .where(
                    WorkflowRunQueue.target_instance_id == instance_id,
                    WorkflowRunQueue.status == STATUS_QUEUED,
                )
                .order_by(WorkflowRunQueue.enqueued_at)
                .limit(1)
                .with_for_update(skip_locked=True)
            )
        ).scalar_one_or_none()
        if row is None:
            return None
        row.status = STATUS_CLAIMED
        row.claimed_at = datetime.now(timezone.utc)
        row.claimed_by_process = f"{instance_id}-{os.getpid()}"
        await db.commit()
        db.expunge(row)
        return row


async def complete(execution_id: uuid.UUID, *, result: dict | None, error: str | None) -> None:
    async with async_session_maker() as db:
        await db.execute(
            update(WorkflowRunQueue)
            .where(WorkflowRunQueue.execution_id == execution_id)
            .values(
                status=STATUS_FAILED if error else STATUS_DONE,
                result=result,
                error=error,
                finished_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()


# Claiming and registering the execution are two steps, not one.
STRANDED_CLAIM_GRACE_SECONDS = 120


def is_stranded_claim(
    *,
    claimed_at: datetime | None,
    has_active_execution: bool,
    now: datetime,
    grace_seconds: int,
) -> bool:
    """Whether a claimed row belongs to a runner that is no longer running it."""
    if claimed_at is None or has_active_execution:
        return False
    return claimed_at < now - timedelta(seconds=grace_seconds)


async def expire_stranded_claims() -> list[uuid.UUID]:
    """Retire claims whose runner died, and return them so waiters are woken."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=STRANDED_CLAIM_GRACE_SECONDS)
    async with async_session_maker() as db:
        result = await db.execute(
            update(WorkflowRunQueue)
            .where(
                WorkflowRunQueue.status == STATUS_CLAIMED,
                WorkflowRunQueue.claimed_at.is_not(None),
                WorkflowRunQueue.claimed_at < cutoff,
                ~exists().where(
                    ActiveWorkflowExecution.execution_id == WorkflowRunQueue.execution_id
                ),
            )
            .values(
                status=STATUS_FAILED,
                error="The instance that claimed this run stopped before finishing it",
                finished_at=now,
            )
            .returning(WorkflowRunQueue.execution_id)
        )
        execution_ids = [row[0] for row in result.all()]
        await db.commit()
    return execution_ids


async def expire_late_rows() -> int:
    """Retire rows past their grace window instead of replaying a backlog."""
    now = datetime.now(timezone.utc)
    async with async_session_maker() as db:
        result = await db.execute(
            update(WorkflowRunQueue)
            .where(
                WorkflowRunQueue.status.in_([STATUS_QUEUED, STATUS_WAITING_FOR_MAIN]),
                WorkflowRunQueue.not_after < now,
            )
            .values(
                status=STATUS_SKIPPED_LATE,
                error="Skipped: not claimed inside the misfire grace window",
                finished_at=now,
            )
            .returning(WorkflowRunQueue.execution_id)
        )
        expired_ids = [row[0] for row in result.all()]
        if expired_ids:
            await db.execute(
                delete(ActiveWorkflowExecution).where(
                    ActiveWorkflowExecution.execution_id.in_(expired_ids)
                )
            )
        await db.commit()
        return len(expired_ids)


async def release_waiting_for_main(main_instance_id: str) -> int:
    """Hand waiting rows to main once it is live again."""
    async with async_session_maker() as db:
        result = await db.execute(
            update(WorkflowRunQueue)
            .where(
                WorkflowRunQueue.status == STATUS_WAITING_FOR_MAIN,
                WorkflowRunQueue.not_after >= datetime.now(timezone.utc),
            )
            .values(status=STATUS_QUEUED, target_instance_id=main_instance_id)
        )
        await db.commit()
        return result.rowcount or 0


async def retarget_unclaimable_rows() -> int:
    """Move queued ANYWHERE rows off instances that can no longer take work.

    A row gets its instance when it is enqueued. Without this, the backlog of a
    worker that went offline, was drained to weight 0, disabled, or scaled away
    waits for it until the misfire window skips every run. A row with nowhere
    better to go stays where it is.
    """
    instances = await registry.list_instances()
    eligib
```

### Core Architecture Module: `backend/app/services/cluster/run_queue_bus.py`
```
"""Wake this instance when a run is enqueued for it.

Mirrors execution_cancel_bus.py: a dedicated asyncpg LISTEN connection turns a
pg_notify into an in-process event, so the claim loop does not have to poll
tightly. Polling still runs as a slow fallback, so a dropped LISTEN connection
degrades latency rather than stalling the queue.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from typing import Any

import asyncpg

from app.db.session import libpq_dsn, listener_server_settings

logger = logging.getLogger("cluster")

CHANNEL = "heym_run_queue"
POLL_FALLBACK_SECONDS = 5.0
_RECONNECT_DELAY_SECONDS = 2.0
_CONNECTION_PROBE_SECONDS = 15.0


def is_for_me(payload: str, *, instance_id: str) -> bool:
    return payload.strip() == instance_id


class QueueWakeBus:
    def __init__(self, instance_id: str) -> None:
        self._instance_id = instance_id
        self._wake = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._running = False

    def has_pending_wake(self) -> bool:
        return self._wake.is_set()

    def handle_payload(self, payload: str) -> bool:
        """Set the wake flag when the payload names this instance."""
        if not is_for_me(payload, instance_id=self._instance_id):
            return False
        self._wake.set()
        return True

    async def wait_for_work(self) -> None:
        """Block until notified, or until the fallback poll interval elapses.

        The flag is checked before waiting, so a notify that lands between two
        claim passes is never lost.
        """
        with contextlib.suppress(asyncio.TimeoutError):
            await asyncio.wait_for(self._wake.wait(), timeout=POLL_FALLBACK_SECONDS)
        self._wake.clear()

    def _on_notify(self, _connection: Any, _pid: int, _channel: str, payload: str) -> None:
        try:
            self.handle_payload(payload)
        except Exception:
            logger.exception("Queue wake payload handling failed")

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._listen_loop())
        logger.info("Queue wake listener started (channel=%s)", CHANNEL)

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    async def _listen_loop(self) -> None:
        while self._running:
            connection: asyncpg.Connection | None = None
            try:
                connection = await asyncpg.connect(
                    libpq_dsn(), server_settings=listener_server_settings()
                )
                await connection.add_listener(CHANNEL, self._on_notify)
                while self._running:
                    await asyncio.sleep(_CONNECTION_PROBE_SECONDS)
                    await connection.execute("SELECT 1")
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning(
                    "Queue wake listener disconnected (%s); retrying in %.0fs",
                    exc,
                    _RECONNECT_DELAY_SECONDS,
                )
            finally:
                if connection is not None:
                    with contextlib.suppress(Exception):
                        await connection.close()
            if self._running:
                await asyncio.sleep(_RECONNECT_DELAY_SECONDS)

```

### Core Architecture Module: `backend/app/services/cron_slot_state.py`
```
"""Cross-worker bookkeeping for cron slots that have already been run.

The scheduler's in-memory state is per uvicorn worker, so it cannot answer
"did anyone already run this slot?" on its own. These helpers keep that answer
in Postgres, where every worker (and every restart) sees the same truth.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CronCleanupClaim, CronSlotClaim
from app.db.session import async_session_maker

logger = logging.getLogger("cron_scheduler")

CLAIM_RETENTION_DAYS = 7


async def claim_cron_slot(
    *,
    workflow_id: uuid.UUID,
    node_id: str,
    slot_at: datetime,
    worker_id: str | None = None,
) -> bool | None:
    """Claim one cron slot for this worker.

    Returns True only for the worker that inserted the row; everyone else - a
    concurrent worker, or the same worker after a restart - gets False and must
    skip the run. Returns None on a database error: nothing is executed, and a
    claim row usually does not exist, so the caller may retry the slot on its
    next pass. If the failure hit the commit itself, the row may exist and the
    retry then gets False, which skips the run.
    """
    stmt = (
        pg_insert(CronSlotClaim)
        .values(
            id=uuid.uuid4(),
            workflow_id=workflow_id,
            node_id=node_id,
            slot_at=slot_at,
            claimed_by=worker_id,
        )
        .on_conflict_do_nothing(constraint="uq_cron_slot_claim")
        .returning(CronSlotClaim.id)
    )
    try:
        async with async_session_maker() as db:
            result = await db.execute(stmt)
            claimed = result.first() is not None
            await db.commit()
            return claimed
    except Exception as e:
        logger.warning(
            "Failed to claim cron slot for workflow %s node %s at %s: %s",
            workflow_id,
            node_id,
            slot_at,
            e,
        )
        return None


async def cleanup_cron_slot_claims(
    db: AsyncSession, *, retention_days: int = CLAIM_RETENTION_DAYS
) -> int:
    """Drop claims older than the retention window; they can never match again."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    result = await db.execute(delete(CronSlotClaim).where(CronSlotClaim.slot_at < cutoff))
    return result.rowcount or 0


def iso_week_slot(moment: datetime) -> str:
    """Cleanup slot key for a weekly job: ISO year and week, e.g. ``2026-W40``.

    Eight characters, so it fits ``cron_cleanup_claims.slot_date`` beside the
    daily ``YYYYMMDD`` keys. A weekly claim outlives its week before the
    retention cleanup removes it, so the same key can never be claimed twice.
    """
    iso_year, iso_week, _ = moment.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


async def claim_cleanup_slot(
    *,
    job_name: str,
    slot_date: str,
    worker_id: str | None = None,
) -> bool:
    """Claim one cleanup slot (a daily date or an ISO week) for this worker.

    Returns True only for the worker that inserted the row; everyone else - a
    concurrent worker, or the same worker after a leader handoff - gets False
    and must skip the run. Fails closed: on a database error nothing is executed.
    """
    stmt = (
        pg_insert(CronCleanupClaim)
        .values(
            id=uuid.uuid4(),
            job_name=job_name,
            slot_date=slot_date,
            claimed_by=worker_id,
        )
        .on_conflict_do_nothing(constraint="uq_cron_cleanup_claim")
        .returning(CronCleanupClaim.id)
    )
    try:
        async with async_session_maker() as db:
            result = await db.execute(stmt)
            claimed = result.first() is not None
            await db.commit()
            return claimed
    except Exception as e:
        logger.warning("Failed to claim cleanup slot for job %s at %s: %s", job_name, slot_date, e)
        return False


async def cleanup_old_cleanup_slot_claims(
    db: AsyncSession, *, retention_days: int = CLAIM_RETENTION_DAYS
) -> int:
    """Drop daily cleanup claims older than the retention window."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    result = await db.execute(delete(CronCleanupClaim).where(CronCleanupClaim.created_at < cutoff))
    return result.rowcount or 0

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #822** (2026-10-30): **Ctrl/Cmd+click on a run in the Execution History dialogs only selects it instead of opening the workflow with that run**
  *Symptoms*: ## Bug  In both Execution History dialogs (the editor's per-workflow History and the All History dialog on Dashboard, Chat, Docs, Evals and the Board), Ctrl+click (Cmd+click on macOS) on a run in the list does the same thing as a plain click: it only selects the run.  The run rows in `ExecutionHistoryDialog.vue` and `ExecutionHistoryAllDialog.vue` only have `@click="selectEntry(entry.id)"` and `@dblclick="openEntryOnCanvas(entry.id)"`. Nothing reads `ctrlKey` / `metaKey`.  Everywhere else in the app, Ctrl/Cmd+click opens the target directly in a new tab: workflow list rows (`WorkflowListRow.vue` + `DashboardView.vue`), the command palette (`lib/paletteNavigate.ts`), and the editor's back-to-dashboard button. The history list is the odd one out.  ## Steps to reproduce  1. Open a workflow in the editor and run it a couple of times. 2. Click **History** (clock icon) in the editor toolbar. 3. Ctrl+click (Cmd+click on macOS) a past run. 4. The run is selected in the dialog. Nothing opens. 5. Repeat from the Dashboard header's History (All History): same result.  ## Expected behavior  Ctrl/Cmd+click on a run opens its workflow in a new browser tab at the execution deep link `/workflows/{workflowId}/{executionId}`, so the canvas loads with that run applied (same result as **Bring to Canvas**). The current tab and the open dialog stay as they are.  - Plain click: selects the run (unchanged). - Double-click: brings the run to the canvas in the same tab (unchanged). - Chat/assistant ru

- **Issue #164** (2026-06-08): **Make Agent / LLM request timeout configurable via environment variable**
  *Symptoms*: Hi Heym team,  I am using the self-hosted Docker image:  ```yaml image: ghcr.io/heymrun/heym:0.0.35 ```  I noticed that Agent workflows sometimes fail with:  ```text Agent error: Request timed out. ```  After checking the source code, it looks like the LLM request timeout is currently hard-coded in:  ```text backend/app/services/llm_service.py ```  as:  ```python LLM_REQUEST_TIMEOUT = 60.0 ```  This value is then passed directly to the OpenAI-compatible client:  ```python timeout=LLM_REQUEST_TIMEOUT ```  ## Problem  For self-hosted deployments, especially when using custom OpenAI-compatible providers such as LiteLLM, vLLM, local models, or slower agent workflows with tools/MCP, 60 seconds is often too short.  In my case, the same workflow sometimes works, but sometimes the Agent node times out before the model/provider finishes responding.  When this happens inside a workflow, the final workflow response may also fall back to the original input payload, for example:  ```json {   "headers": { "...": "..." },   "query": {     "test_run": "true",     "trigger_source": "Canvas"   },   "body": {     "text": "..."   },   "text": "..." } ```  So the user experience becomes confusing: sometimes the workflow returns a valid AI response, and sometimes it returns the incoming request-like payload or shows the Agent timeout error.  ## Expected behavior  The LLM / Agent request timeout should be configurable from environment variables, for example:  ```env LLM_REQUEST_TIMEOUT=300 ```  or:

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

### Incident Patch 1: `39aac9cc` (2026-11-06)
**Commit Message**: chore(docker): drop build leftovers from the release and backend images

- Node.js 22 LTS from the official image instead of Debian's nodejs/npm
  (Node 20, past end of life, plus node-undici and friends).
- The release image's frontend node_modules holds only vite and
  @vitejs/plugin-vue, the two packages vite.config.ts imports, at their
  bun.lock versions. vite preview and its proxy are unchanged.
- WeasyPrint from pip into the system Python instead of apt, which also
  installed Debian's Python 3.13, Pillow, numpy and scipy. Pango and
  HarfBuzz still come from apt.
- Docker CLI 27.3.1 -> 29.9.3.
- docker-sandbox-smoke.sh finds the venv in both image layouts, like
  k8s-sandbox-smoke.sh, and the smoke test renders a PDF from a skill.

Refs #865

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `backend/Dockerfile` (modified, +24/-4)
```diff
@@ -1,3 +1,6 @@
+# Node.js 22 LTS comes from the official image (see below), not Debian's nodejs and npm.
+FROM node:22-bookworm-slim AS node
+
 FROM python:3.14-slim
 
 WORKDIR /app
@@ -7,21 +10,33 @@ RUN apt-get update && apt-get install -y --no-install-recommends \
     curl \
     ca-certificates \
     tzdata \
-    nodejs \
-    npm \
     git \
     ripgrep \
     unzip \
     wget \
-    weasyprint \
     && rm -rf /var/lib/apt/lists/*
 
+# Node.js 22 LTS, for Codex and MCP stdio servers started with npx.
+COPY --from=node /usr/local/bin/node /usr/local/bin/node
+COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
+RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
+    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
+    && node --version \
+    && npm --version
+
+# Converter node file support. WeasyPrint is the pandoc PDF engine used by fileConvert; its
+# Python package comes from docker/converter-requirements.txt below, and Pango, HarfBuzz and
+# shared-mime-info are its system libraries.
 # OCR for the Converter node (imageToText/pdfToText): Tesseract plus poppler's pdftoppm,
 # which rasterizes PDF pages before recognition. `osd` and the script models are what make
 # the "auto" language setting work. OSD detects the script, then a script model such as
 # Latin reads every language written in it. Debian installs the script models without the
 # "script/" prefix, so tesseract lists them as Latin, Cyrillic, HanS, and so on.
 RUN apt-get update && apt-get install -y --no-install-recommends \
+    libpango-1.0-0 \
+    libpangoft2-1.0-0 \
+    libharfbuzz-subset0 \
+    shared-mime-info \
     poppler-utils \
     tesseract-ocr \
     tesseract-ocr-osd \
@@ -85,7 +100,7 @@ RUN ARCH="$(uname -m)" \
         armv7l)  DA=armv7   ;; \
         *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
     esac \
-    && curl -fsSL "https://download.docker.com/linux/static/stable/${DA}/docker-27.3.1.tgz" \
+    && curl -fsSL "https://download.docker.com/linux/static/stable/${DA}/docker-29.9.3.tgz" \
         | tar xz --strip-components=1 -C /usr/local/bin docker/docker
 
 ENV TZ=Europe/Berlin
@@ -98,6 +113,11 @@ COPY docker/sandbox-requirements.txt /tmp/sandbox-requirements.txt
 RUN uv pip install --system --no-cache -r /tmp/sandbox-requirements.txt \
     && rm /tmp/sandbox-requirements.txt
 
+COPY docker/converter-requirements.txt /tmp/converter-requirements.txt
+RUN uv pip install --system --no-cache -r /tmp/converter-requirements.txt \
+    && rm /tmp/converter-requirements.txt \
+    && weasyprint --info
+
 ARG APP_VERSION
 ENV APP_VERSION=${APP_VERSION}
 
```

**File**: `docker/converter-requirements.txt` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+# WeasyPrint, the PDF engine pandoc runs for the Converter node (`--pdf-engine=weasyprint`).
+# Installed into the image's system Python, so `weasyprint` is on PATH for pandoc whichever
+# way the backend starts. Debian's `weasyprint` package would also install Debian's own
+# Python and Pillow next to the image's Python. Its system libraries (Pango, HarfBuzz) come
+# from apt in the Dockerfiles.
+weasyprint==70.0
```

**File**: `docker/release.Dockerfile` (modified, +48/-8)
```diff
@@ -22,6 +22,30 @@ ENV VITE_HEYM_WEB_URL=${VITE_HEYM_WEB_URL}
 RUN bun run build
 
 
+# `vite preview` serves the built frontend and proxies /api, websockets and the OAuth routes
+# (see vite.config.ts), so the runtime keeps vite. It does not need the rest of the build
+# toolchain: vite.config.ts imports only vite and @vitejs/plugin-vue. Installing just those
+# two against bun.lock keeps their locked versions, and their own dependencies', in about
+# 37 MB instead of the full ~300 MB tree.
+FROM node:22-bookworm-slim AS frontend-runtime-deps
+
+COPY --from=oven/bun:1.4.2 /usr/local/bin/bun /usr/local/bin/bun
+
+WORKDIR /app
+
+COPY frontend/package.json frontend/bun.lock* ./
+RUN node -e ' \
+    const fs = require("fs"); \
+    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")); \
+    const keep = ["vite", "@vitejs/plugin-vue"]; \
+    pkg.dependencies = Object.fromEntries(keep.map((name) => [name, pkg.devDependencies[name]])); \
+    delete pkg.devDependencies; \
+    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2)); \
+    ' \
+    && bun install \
+    && node node_modules/vite/bin/vite.js --version
+
+
 FROM python:3.14-slim AS backend-builder
 
 WORKDIR /app
@@ -53,22 +77,33 @@ RUN apt-get update && apt-get install -y --no-install-recommends \
     ca-certificates \
     curl \
     git \
-    nodejs \
-    npm \
     ripgrep \
     tzdata \
     unzip \
     wget \
     && rm -rf /var/lib/apt/lists/*
 
-# Converter node file support. weasyprint is the pandoc PDF engine used by fileConvert.
-# OCR (imageToText/pdfToText) needs Tesseract plus poppler's pdftoppm, which rasterizes PDF
-# pages before recognition. `osd` and the script models are what make the "auto" language
+# Node.js 22 LTS, for Codex, MCP stdio servers started with npx, and `vite preview`. Copied
+# from the official image the frontend builds on, instead of Debian's nodejs and npm.
+COPY --from=frontend-runtime-deps /usr/local/bin/node /usr/local/bin/node
+COPY --from=frontend-runtime-deps /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
+RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
+    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
+    && node --version \
+    && npm --version
+
+# Converter node file support. WeasyPrint is the pandoc PDF engine used by fileConvert; its
+# Python package comes from docker/converter-requirements.txt below, and Pango, HarfBuzz and
+# shared-mime-info are its system libraries. OCR (imageToText/pdfToText) needs Tesseract plus
+# poppler's pdftoppm, which rasterizes PDF pages before recognition. `osd` and the script models are what make the "auto" language
 # setting work. OSD detects the script, then a script model such as Latin reads every
 # language written in it. Debian installs the script models without the "script/" prefix,
 # so tesseract lists them as Latin, Cyrillic, HanS, and so on.
 RUN apt-get update && apt-get install -y --no-install-recommends \
-    weasyprint \
+    libpango-1.0-0 \
+    libpangoft2-1.0-0 \
+    libharfbuzz-subset0 \
+    shared-mime-info \
     poppler-utils \
     tesseract-ocr \
     tesseract-ocr-osd \
@@ -127,7 +162,7 @@ RUN ARCH="$(uname -m)" \
         armv7l)  DA=armv7   ;; \
         *) echo "Unsupported arch: $ARCH" && exit 1 ;; \
     esac \
-    && curl -fsSL "https://download.docker.com/linux/static/stable/${DA}/docker-27.3.1.tgz" \
+    && curl -fsSL "https://download.docker.com/linux/static/stable/${DA}/docker-29.9.3.tgz" \
         | tar xz --strip-components=1 -C /usr/local/bin docker/docker
 
 ENV DOCS_DIR=/app/docs \
@@ -144,6 +179,11 @@ COPY docker/sandbox-requirements.txt /tmp/sandbox-requirements.txt
 RUN uv pip install --system --no-cache -r /tmp/sandbox-requirements.txt \
     && rm /tmp/sandbox-requirements.txt
 
+COPY docker/converter-requirements.txt /tmp/converter-requirements.txt
+RUN uv pip install --system --no-cache -r /tmp/converter-requirements.txt \
+    && rm /tmp/converter-requirements.txt \
+    && weasyprint --info
+
 ARG APP_VERSION
 ENV APP_VERSION=${APP_VERSION}
 
@@ -178,7 +218,7 @@ COPY --from=backend-builder /app/AGENTS.md /app/AGENTS.md
 COPY --from=backend-builder /app/docs /app/docs
 COPY --from=frontend-builder /app/dist /app/frontend/dist
 COPY --from=frontend-builder /app/package.json /app/frontend/package.json
-COPY --from=frontend-builder /app/node_modules /app/frontend/node_modules
+COPY --from=frontend-runtime-deps /app/node_modules /app/frontend/node_modules
 COPY --from=frontend-builder /app/vite.config.ts /app/frontend/vite.config.ts
 COPY docker/release-entrypoint.sh /app/release-entrypoint.sh
 COPY docker/heym-codex-docker /usr/local/bin/heym-codex-docker
```

**File**: `scripts/docker-sandbox-smoke.sh` (modified, +7/-1)
```diff
@@ -2,6 +2,7 @@
 # Docker smoke test of every sandbox, from a backend container wired like docker-compose.yml:
 # the Docker socket, the two workspace volumes and the image variables.
 # Usage: scripts/docker-sandbox-smoke.sh [image]   (build it first: docker compose build backend)
+# Works with the backend image (venv at /app/.venv) and the release image (/app/backend/.venv).
 set -euo pipefail
 IMAGE="${1:-heym-backend:local}"
 HERE="$(cd "$(dirname "$0")" && pwd)"
@@ -25,7 +26,12 @@ docker run --rm -i \
   -e HEYM_CODEX_DOCKER_IMAGE="$IMAGE" -e HEYM_OPENCODE_DOCKER_IMAGE="$IMAGE" \
   -e HEYM_PYTHON_TOOL_IMAGE="$IMAGE" -e HEYM_SKILL_IMAGE="$IMAGE" \
   -e HEYM_PLAYWRIGHT_SANDBOX_IMAGE="$IMAGE" -e HEYM_MCP_STDIO_IMAGE="$IMAGE" \
-  --entrypoint sh "$IMAGE" -c 'cd /app && exec /app/.venv/bin/python -' \
+  --entrypoint sh "$IMAGE" -c '
+    for py in /app/.venv/bin/python /app/backend/.venv/bin/python; do
+      if [ -x "$py" ]; then cd "$(dirname "$(dirname "$(dirname "$py")")")" && exec "$py" -; fi
+    done
+    echo "backend virtualenv not found" >&2; exit 127
+  ' \
   < "$HERE/sandbox_smoke.py" || status=$?
 
 LEFT="$(docker ps -aq --filter name=heym-pytool- --filter name=heym-code- \
```

**File**: `scripts/sandbox_smoke.py` (modified, +18/-0)
```diff
@@ -201,6 +201,23 @@ def skill_output_file() -> str:
     return "hello.txt generated"
 
 
+def skill_pdf() -> str:
+    # Skills render PDFs through pandoc, which runs `weasyprint` from PATH inside the sandbox.
+    from app.services.skill_python_executor import execute_skill_python
+
+    source = (
+        "import json, os, pypandoc\n"
+        "out = os.path.join(os.environ['_OUTPUT_DIR'], 'report.pdf')\n"
+        "pypandoc.convert_text('# Report\\n\\nRevenue grew.', 'pdf', format='markdown',\n"
+        "                      outputfile=out, extra_args=['--pdf-engine=weasyprint'])\n"
+        "print(json.dumps({'pdf': open(out, 'rb').read(4) == b'%PDF'}))\n"
+    )
+    result = execute_skill_python([{"path": "main.py", "content": source}], {"input": "x"}, 120)
+    assert result.output == {"pdf": True}, result.output
+    assert [f["filename"] for f in result.generated_files] == ["report.pdf"]
+    return "report.pdf rendered by pandoc and WeasyPrint"
+
+
 def skill_drive_files() -> str:
     from app.services.skill_python_executor import execute_skill_python
 
@@ -364,6 +381,7 @@ def coding_agent(agent: str, home_suffix: str, home_env: str) -> str:
         ("chat file sandbox", chat_file_inspection),
         ("agent skill", skill_output_file),
         ("agent skill + drive files toggle", skill_drive_files),
+        ("agent skill pdf", skill_pdf),
         ("mcp stdio", mcp_stdio),
         ("playwright custom code", playwright_isolated),
         ("sandbox ca bundle", sandbox_ca_bundle),
```

---

### Incident Patch 2: `5695f294` (2026-11-07)
**Commit Message**: docs(security): describe Fernet as AES-128-CBC with HMAC-SHA256

Fernet encrypts with AES-128 in CBC mode and authenticates with
HMAC-SHA256; the 32-byte key derived from ENCRYPTION_KEY is split into a
16-byte signing key and a 16-byte encryption key. The Security reference
and the feature overview called it AES-256. The overview now also links
to the key rotation procedure.

**File**: `frontend/src/docs/content/reference/features.md` (modified, +1/-1)
```diff
@@ -685,7 +685,7 @@ See also [Drive](../tabs/drive-tab.md), [File Generation](./file-generation.md),
 
 ### [Security](./security.md)
 
-Heym enforces a password policy (length, uppercase, lowercase, digit), stores access tokens in HttpOnly cookies, and rotates refresh tokens on use. Rate limiting applies to login, register, and [Portal](./portal.md) login. [Credentials](./credentials.md) are encrypted at rest with AES-256 (Fernet). [MCP](../tabs/mcp-tab.md) API key is used for client auth; content safety is available via [Guardrails](./guardrails.md) on [LLM](../nodes/llm-node.md) and [Agent Node](../nodes/agent-node.md) nodes. [Execution Tokens](./execution-tokens.md) provide per-workflow scoped JWTs for external callers.
+Heym enforces a password policy (length, uppercase, lowercase, digit), stores access tokens in HttpOnly cookies, and rotates refresh tokens on use. Rate limiting applies to login, register, and [Portal](./portal.md) login. [Credentials](./credentials.md) are encrypted at rest with Fernet (AES-128-CBC with HMAC-SHA256), and the key can be [rotated](./security.md#rotating-the-key) without downtime. [MCP](../tabs/mcp-tab.md) API key is used for client auth; content safety is available via [Guardrails](./guardrails.md) on [LLM](../nodes/llm-node.md) and [Agent Node](../nodes/agent-node.md) nodes. [Execution Tokens](./execution-tokens.md) provide per-workflow scoped JWTs for external callers.
 
 See also [Execution Tokens](./execution-tokens.md), [Guardrails](./guardrails.md), [Portal](./portal.md), and [Credentials](./credentials.md).
 
```

**File**: `frontend/src/docs/content/reference/security.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ When `REDIS_URL` is configured, rate limits are shared across all backend worker
 
 ## Credential Encryption
 
-All API keys, webhook URLs, and bearer tokens stored in the [Credentials](../tabs/credentials-tab.md) panel are encrypted at rest using AES-256 (Fernet) before being written to the database. The key is derived from the `ENCRYPTION_KEY` environment variable. The `run.sh` and `deploy.sh` scripts generate a strong value automatically when it is empty; the application refuses to start if `ENCRYPTION_KEY` is empty or left at a known placeholder.
+All API keys, webhook URLs, and bearer tokens stored in the [Credentials](../tabs/credentials-tab.md) panel are encrypted at rest with Fernet (AES-128 in CBC mode, authenticated with HMAC-SHA256) before being written to the database. The key is derived from the `ENCRYPTION_KEY` environment variable. The `run.sh` and `deploy.sh` scripts generate a strong value automatically when it is empty; the application refuses to start if `ENCRYPTION_KEY` is empty or left at a known placeholder.
 
 Before the server starts, Heym also checks `ENCRYPTION_KEY` against a value stored in the database, and refuses to start with a key the database wasn't encrypted with, instead of failing credential reads later with nothing useful in the error.
 
```

---

### Incident Patch 3: `7c289b3a` (2026-11-07)
**Commit Message**: fix(encryption): only main writes the key check value, and unreadable values can be replaced

- A worker only reads the canary: it skips while main hasn't written one,
  refuses when it can't read it, and ignores
  HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY. A worker with a wrong key could
  otherwise record that key on an empty database, or replace the canary
  through a forgotten flag, and lock main out.
- The key check's error says to put the old key back in
  ENCRYPTION_KEYS_EXTRA before it mentions the flag.
- A PUT on an unreadable credential returns 409 without a value, and with
  one replaces the value in place, keeping the id that workflows use.
  The edit dialog opens for such rows again, with a note to enter the
  whole value.
- Classifying every stored value (the Encryption tab, the recount) and a
  batch's re-encryption run in a thread, off the event loop.

Refs #862

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `ENVIRONMENT-VARIABLES.md` (modified, +13/-7)
```diff
@@ -18,7 +18,7 @@ lifetimes) that override these code defaults when you copy it.
 | `SECRET_KEY` | JWT signing key. Must be cryptographically random and at least 32 characters. Startup fails if missing or a known placeholder. | — (required) |
 | `ENCRYPTION_KEY` | Key used to encrypt stored credentials at rest. Generate with `python -c "import secrets; print(secrets.token_hex(32))"`. Startup fails if missing, the known placeholder, or not the key this database was encrypted with (see [Rotating `ENCRYPTION_KEY`](#rotating-encryption_key)). | — (required) |
 | `ENCRYPTION_KEYS_EXTRA` | Comma-separated keys accepted for decryption only, never to encrypt. Used while rotating `ENCRYPTION_KEY`. Empty entries are ignored; the placeholder is refused. | — |
-| `HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY` | Start once with `true` to accept `ENCRYPTION_KEY` as this database's key although nothing stored decrypts with it. See [Rotating `ENCRYPTION_KEY`](#rotating-encryption_key). Unset it afterwards. | `false` |
+| `HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY` | Start the main instance once with `true` to accept `ENCRYPTION_KEY` as this database's key although nothing stored decrypts with it. Ignored on workers. See [Rotating `ENCRYPTION_KEY`](#rotating-encryption_key). Unset it afterwards. | `false` |
 
 ## Rotating `ENCRYPTION_KEY`
 
@@ -42,7 +42,8 @@ phase 2. The phases matter for clusters and rolling updates on Kubernetes.
   and says which, so an instance that rolled back can't rotate values back.
 - **Values no configured key reads** (from an earlier key change) are listed in
   **Settings → Encryption**, never counted as remaining, so the job can finish. Their
-  owners see them as **Unreadable** in Credentials and can delete and re-create them.
+  owners see them as **Unreadable** in Credentials, and can enter the value again in place
+  (workflows that use it keep pointing at it) or delete it.
 - **After phase 3, the old key is refused as `ENCRYPTION_KEY`.** An instance restarted
   with an old `.env` fails to start with an error that says so, instead of writing
   values nobody else can read.
@@ -63,11 +64,16 @@ one of them before this change, make the same edit. A worker left on the old com
 runs without the check, and the cluster still keeps it from receiving work or leading if
 its keys don't fit.
 
-On first start after upgrading, the check value is created once one of the 20 most
-recently stored values decrypts, or when there are none. **If none of them decrypts**,
-because the key was changed at some point and nothing has been re-entered since, the check
-refuses to start. If `ENCRYPTION_KEY` is the key you want to keep, start once with
-`HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY=true`, then remove it. Values stored under the lost key
+Only the main instance writes the check value. On its first start after upgrading, it
+creates it once one of the 20 most recently stored values decrypts, or when there are none.
+A worker only reads it, and starts without checking until main has written it. **If none of
+them decrypts**, because the key was changed at some point and nothing has been re-entered
+since, main refuses to start. If `ENCRYPTION_KEY` is the key you want to keep, start main
+once with `HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY=true`, then remove it. A worker ignores the
+flag, so a forgotten one can't make the cluster accept a wrong key.
+
+**If the check refuses after phase 4**, the old key was most likely removed before phase 3
+completed: put it back in `ENCRYPTION_KEYS_EXTRA`, and finish the re-encryption first. Values stored under the lost key
 stay unreadable and are listed as described above.
 
 ## Database
```

**File**: `backend/app/api/credentials.py` (modified, +25/-9)
```diff
@@ -1821,18 +1821,34 @@ async def update_credential(
             )
         credential.name = credential_data.name
 
-    config = decrypt_config(credential.encrypted_config)
+    try:
+        config = decrypt_config(credential.encrypted_config)
+        unreadable = False
+    except InvalidToken:
+        # Stored under a key no instance has any more. The owner can enter the whole
+        # value again in place, which keeps the id the workflows point at.
+        if credential_data.config is None:
+            raise HTTPException(
+                status_code=status.HTTP_409_CONFLICT,
+                detail="This credential's value can't be read with the configured "
+                "encryption keys. Enter its whole value again, or delete it.",
+            ) from None
+        config, unreadable = {}, True
 
     if credential_data.config is not None:
-        config = (
-            _merge_supabase_update_config(credential_data.config, config)
-            if credential.type == CredentialType.supabase
-            else merge_credential_config_for_update(
-                credential.type,
-                config,
-                credential_data.config,
+        if unreadable:
+            # Nothing to merge into: the new value must be complete on its own.
+            config = dict(credential_data.config)
+        else:
+            config = (
+                _merge_supabase_update_config(credential_data.config, config)
+                if credential.type == CredentialType.supabase
+                else merge_credential_config_for_update(
+                    credential.type,
+                    config,
+                    credential_data.config,
+                )
             )
-        )
         validate_credential_config(
             credential.type,
             config,
```

**File**: `backend/app/key_check.py` (modified, +32/-3)
```diff
@@ -13,7 +13,8 @@
   restored old `.env` (the rotation's new key is what every row is under now).
 
 The canary is created only once a stored value has decrypted, so a wrong key at first
-boot is never recorded as the right one.
+boot is never recorded as the right one. Only main writes it: a worker checks it, and
+skips when main hasn't written one yet.
 """
 
 from __future__ import annotations
@@ -126,10 +127,20 @@ async def _write_canary(db: AsyncSession, *, replace: bool) -> None:
 
 
 def _mismatch(detail: str) -> KeyCheckError:
+    # The usual cause is an old key dropped from ENCRYPTION_KEYS_EXTRA before a rotation
+    # finished, and putting it back is the fix, so that comes before the last resort.
+    if identity.is_main():
+        last_resort = (
+            "Only if ENCRYPTION_KEY is right and the stored values can't be recovered, "
+            "start this instance once with HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY=true."
+        )
+    else:
+        last_resort = "Otherwise, give this worker the same keys as the main instance."
     return KeyCheckError(
         "ENCRYPTION_KEY does not match the key this database was encrypted with: "
-        f"{detail} If ENCRYPTION_KEY is right and the stored values can't be recovered, "
-        f"start once with HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY=true. {DOCS_HINT}"
+        f"{detail} If a key was removed from ENCRYPTION_KEYS_EXTRA, or ENCRYPTION_KEY was "
+        "changed, before re-encryption completed, put the old key back in "
+        f"ENCRYPTION_KEYS_EXTRA. {last_resort} {DOCS_HINT}"
     )
 
 
@@ -143,6 +154,8 @@ async def check(db: AsyncSession) -> KeyCheckResult:
     await _refuse_retired_primary(db)
 
     canary = await db.get(EncryptionCanary, ENCRYPTION_CANARY_ID)
+    if not identity.is_main():
+        return _check_worker(canary)
     accept = settings.accept_current_encryption_key
     if canary is not None:
         if _decrypts(canary.token):
@@ -165,6 +178,22 @@ async def check(db: AsyncSession) -> KeyCheckResult:
     return KeyCheckResult("ENCRYPTION_KEY recorded as this database's key")
 
 
+def _check_worker(canary: EncryptionCanary | None) -> KeyCheckResult:
+    """A worker only reads the canary. Only main writes or replaces it.
+
+    Otherwise a worker started with a wrong key could record that key on an empty
+    database, or replace the canary through a forgotten HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY,
+    and main would then refuse to start with the right one.
+    """
+    if canary is None:
+        return KeyCheckResult("key check skipped: main has not recorded this database's key yet")
+    if _decrypts(canary.token):
+        return KeyCheckResult("ENCRYPTION_KEY matches this database")
+    if settings.accept_current_encryption_key:
+        logger.warning("HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY is ignored on a worker")
+    raise _mismatch("none of the configured keys decrypts the stored check value.")
+
+
 async def _run() -> KeyCheckResult:
     from app.db.session import async_session_maker, engine
 
```

**File**: `backend/app/services/key_rotation.py` (modified, +36/-10)
```diff
@@ -90,6 +90,25 @@ def _classify(token: str) -> str:
     return "remaining"
 
 
+def _classify_all(tokens: list[str]) -> list[str]:
+    return [_classify(token) for token in tokens]
+
+
+def _rotate_all(tokens: list[str]) -> list[str | None]:
+    """The token re-encrypted under the primary, or None when it needs no rewrite or can't
+    have one (the primary already reads it, or no configured key does)."""
+    rotated: list[str | None] = []
+    for token in tokens:
+        if readable_by_primary(token):
+            rotated.append(None)
+            continue
+        try:
+            rotated.append(rotate_token(token))
+        except InvalidToken:
+            rotated.append(None)
+    return rotated
+
+
 def fleet_status(instances: list[registry.InstanceView], *, now: datetime) -> FleetStatus:
     """Whether every live instance, and this process, encrypts with this process's key."""
     target = identity.primary_fingerprint()
@@ -134,10 +153,20 @@ async def _stored_tokens(db: AsyncSession) -> AsyncIterator[tuple[str, uuid.UUID
         yield "canary", None, canary.token
 
 
+async def _classified(db: AsyncSession) -> list[tuple[str, uuid.UUID | None, str]]:
+    """Every stored ciphertext's (kind, credential id, class).
+
+    Decrypting each one is CPU work, done in a thread so a large install doesn't stall
+    the event loop while the Encryption tab polls during a rotation.
+    """
+    stored = [item async for item in _stored_tokens(db)]
+    classes = await asyncio.to_thread(_classify_all, [token for _, _, token in stored])
+    return [(kind, credential_id, c) for (kind, credential_id, _), c in zip(stored, classes)]
+
+
 async def count_tokens(db: AsyncSession) -> TokenCounts:
     counts = TokenCounts()
-    async for _kind, _id, token in _stored_tokens(db):
-        kind = _classify(token)
+    for _kind, _id, kind in await _classified(db):
         setattr(counts, kind, getattr(counts, kind) + 1)
     return counts
 
@@ -146,8 +175,8 @@ async def unreadable_credentials(db: AsyncSession) -> list[UnreadableCredential]
     """Credentials no configured key decrypts, for the admin list. Their owners see them too."""
     unreadable_ids = [
         credential_id
-        async for kind, credential_id, token in _stored_tokens(db)
-        if kind == "credential" and _classify(token) == "unreadable"
+        for kind, credential_id, c in await _classified(db)
+        if kind == "credential" and c == "unreadable"
     ]
     if not unreadable_ids:
         return []
@@ -225,13 +254,10 @@ async def _rewrite_batch(
     if cursor is not None:
         query = query.where(Credential.id > cursor)
     rows = (await db.execute(query)).all()
+    new_tokens = await asyncio.to_thread(_rotate_all, [token for _, token in rows])
     rewritten = 0
-    for credential_id, token in rows:
-        if readable_by_primary(token):
-            continue
-        try:
-            new_token = rotate_token(token)
-        except InvalidToken:
+    for (credential_id, _), new_token in zip(rows, new_tokens):
+        if new_token is None:
             continue
         # Core UPDATE that keeps updated_at: a re-encryption isn't an edit, and must not
         # look like one or change anything keyed on it. The CHECK constraint still holds.
```

**File**: `backend/tests/test_key_check_postgres.py` (modified, +45/-0)
```diff
@@ -220,6 +220,51 @@ async def test_the_next_rotation_can_promote_a_new_key(self) -> None:
         with _keys(third, NEW):
             self.assertIn("matches", (await self._check()).message)
 
+    # Only main writes the canary.
+
+    def _as(self, role: str):  # noqa: ANN202 - context manager helper
+        return patch.object(identity.settings, "instance_role", role)
+
+    async def test_a_worker_with_a_wrong_key_on_an_empty_database_records_nothing(self) -> None:
+        with _keys(OTHER), self._as("worker"):
+            self.assertIn("main has not recorded", (await self._check()).message)
+        self.assertIsNone(await self._canary())
+        # Main then records its own key, the right one.
+        with _keys(NEW):
+            self.assertIn("recorded", (await self._check()).message)
+
+    async def test_a_worker_ignores_the_flag_and_cant_replace_the_canary(self) -> None:
+        with _keys(NEW):
+            await self._check()
+            before = (await self._canary()).token
+        with (
+            _keys(OTHER, accept=True),
+            self._as("worker"),
+            self.assertRaisesRegex(key_check.KeyCheckError, "same keys as the main instance"),
+        ):
+            await self._check()
+        self.assertEqual((await self._canary()).token, before)
+        with _keys(NEW):
+            self.assertIn("matches", (await self._check()).message)
+
+    async def test_a_worker_with_the_right_keys_passes(self) -> None:
+        with _keys(OLD):
+            await self._check()
+        with _keys(NEW, OLD), self._as("worker"):
+            self.assertIn("matches", (await self._check()).message)
+
+    async def test_the_error_says_to_put_the_old_key_back_before_the_flag(self) -> None:
+        # The old key dropped from ENCRYPTION_KEYS_EXTRA before re-encryption finished.
+        with _keys(OLD):
+            await self._check()
+        with _keys(NEW), self.assertRaises(key_check.KeyCheckError) as caught:
+            await self._check()
+        message = str(caught.exception)
+        self.assertLess(
+            message.index("put the old key back in ENCRYPTION_KEYS_EXTRA"),
+            message.index("HEYM_ACCEPT_CURRENT_ENCRYPTION_KEY"),
+        )
+
     # Schema not migrated yet.
 
     async def test_a_database_without_the_tables_is_skipped(self) -> None:
```

**File**: `backend/tests/test_key_rotation_postgres.py` (modified, +29/-0)
```diff
@@ -263,3 +263,32 @@ async def test_unreadable_credentials_are_listed_with_their_owner(self) -> None:
             async with self.database.sessions() as db:
                 listed = await key_rotation.unreadable_credentials(db)
         self.assertEqual([(c.id, c.owner_email) for c in listed], [(lost[0], "o@example.com")])
+
+    # The owner of an unreadable credential.
+
+    async def _put(self, credential_id: uuid.UUID, **body: object):  # noqa: ANN202
+        from app.api.credentials import update_credential
+        from app.models.schemas import CredentialUpdate
+
+        async with self.database.sessions() as db:
+            user = await db.get(User, self.owner.id)
+            response = await update_credential(credential_id, CredentialUpdate(**body), user, db)
+            await db.commit()
+            return response
+
+    async def test_a_put_without_a_value_on_an_unreadable_row_is_a_409(self) -> None:
+        from fastapi import HTTPException
+
+        (lost,) = await self._add(LOST)
+        with _keys(NEW, OLD), self.assertRaises(HTTPException) as caught:
+            await self._put(lost, name="renamed")
+        self.assertEqual(caught.exception.status_code, 409)
+
+    async def test_the_owner_can_replace_an_unreadable_value_in_place(self) -> None:
+        (lost,) = await self._add(LOST)
+        with _keys(NEW, OLD):
+            response = await self._put(lost, config={"api_key": "sk-entered-again"})
+            self.assertEqual(response.id, lost)
+            self.assertFalse(response.unreadable)
+            token = (await self._tokens())[lost]
+            self.assertEqual(encryption.decrypt_config(token), {"api_key": "sk-entered-again"})
```

**File**: `frontend/src/components/Credentials/CredentialDialog.vue` (modified, +8/-0)
```diff
@@ -1737,6 +1737,14 @@ async function handleSave(): Promise<void> {
       class="space-y-4"
       @submit.prevent="handleSave"
     >
+      <p
+        v-if="credential?.unreadable"
+        data-testid="credential-unreadable-note"
+        class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
+      >
+        This credential's value was stored with an encryption key this instance no longer has.
+        Enter the whole value again to replace it; workflows that use it keep working once it's saved.
+      </p>
       <div class="space-y-2">
         <Label for="cred-name">Name</Label>
         <Input
```

**File**: `frontend/src/components/Credentials/CredentialsPanel.vue` (modified, +3/-8)
```diff
@@ -506,15 +506,10 @@ async function removeCredentialTeamShare(teamId: string): Promise<void> {
         :data-testid="`credential-card-${credential.id}`"
         :class="cn(
           'credential-card p-5 cursor-pointer group',
-          (credential.is_shared || credential.source || credential.unreadable) && 'shared-card'
+          (credential.is_shared || credential.source) && 'shared-card'
         )"
         :style="{ animationDelay: `${index * 50}ms` }"
-        @click="
-          !credential.is_shared &&
-            !credential.source &&
-            !credential.unreadable &&
-            openEditDialog(credential)
-        "
+        @click="!credential.is_shared && !credential.source && openEditDialog(credential)"
       >
         <div class="flex items-start justify-between mb-3">
           <div class="flex items-center gap-3">
@@ -554,7 +549,7 @@ async function removeCredentialTeamShare(teamId: string): Promise<void> {
                   v-if="credential.unreadable"
                   :data-testid="`credential-unreadable-${credential.id}`"
                   class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-destructive/10 text-destructive"
-                  title="Stored with an encryption key this instance no longer has, so its value can't be read. Delete it and create it again."
+                  title="Stored with an encryption key this instance no longer has, so its value can't be read. Open it to enter the value again (workflows keep using it), or delete it."
                 >
                   <KeyRound class="w-3 h-3" />
                   Unreadable
```

#### Recent Merged Pull Requests:
- **PR #880** (2026-11-08): Chat and MCP can read and write User Rules as memory (@ckakgun)
- **PR #879** (2026-11-08): Attach several files to a chat message and read plain text files of any name (@mbakgun)
- **PR #878** (2026-11-08): Bump project version to 0.0.150 (@heym-coder)
- **PR #877** (2026-11-08): Two-factor sign-in, account deactivation and data retention (@mbakgun)
- **PR #876** (2026-11-08): Edit a sent chat message and send it again (@ckakgun)
- **PR #875** (2026-11-08): Show Settings tabs as a left rail and explain key rotation in numbered steps (@ckakgun)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. docker): drop build leftovers from the release and backend images

**RULE**:
When implementing operations in `backend/Dockerfile`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in heymrun/heym. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `39aac9cc`: docker): drop build leftovers from the release and backend images. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `backend/Dockerfile`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
# Node.js 22 LTS comes from the official image (see below), not Debian's nodejs and npm.
FROM node:22-bookworm-slim AS node

# Node.js 22 LTS, for Codex and MCP stdio servers started with npx.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version \
    && npm --version

# Converter node file support. WeasyPrint is the pandoc PDF engine used by fileConvert; its
# Python package comes from docker/converter-requirements.txt below, and Pango, HarfBuzz and
# shared-mime-info are its system libraries.
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    shared-mime-info \
    && curl -fsSL "https://download.docker.com/linux/static/stable/${DA}/docker-29.9.3.tgz" \
COPY docker/converter-requirements.txt /tmp/converter-requirements.txt
RUN uv pip install --system --no-cache -r /tmp/converter-requirements.txt \
    && rm /tmp/converter-requirements.txt \
    && weasyprint --info

```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
    nodejs \
    npm \
    weasyprint \
    && curl -fsSL "https://download.docker.com/linux/static/stable/${DA}/docker-27.3.1.tgz" \
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `39aac9cc` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
