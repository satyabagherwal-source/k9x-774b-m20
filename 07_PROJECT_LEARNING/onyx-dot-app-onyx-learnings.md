# Forensic Learning Record (Deep Inspection): onyx-dot-app/onyx

> **Canonical Artifact**: `07_PROJECT_LEARNING/onyx-dot-app-onyx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/onyx-dot-app/onyx](https://github.com/onyx-dot-app/onyx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:27:17.593Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `onyx-dot-app/onyx`
- **Description**: Open Source AI Platform - AI Chat with advanced features that works with every LLM
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 32330 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/hooks/pre_commit_on_stop.py`
```
#!/usr/bin/env python3
"""Turn hooks for coding agents (Claude Code and Codex).

On `UserPromptSubmit` the hook records HEAD and the contents of every dirty file.
On `Stop` it compares against that record, so it only looks at the files this turn
changed (edited, created or committed), never scratch files or older edits. For
those files it:

- runs pre-commit;
- when the feature map has `stale_docs.py`, names the feature-map components whose
  code the turn changed but whose documents the branch did not.

When either has something to say, the hook exits with code 2 and prints it to
stderr. Both agents treat that as "keep going". A second stop in the same turn
(`stop_hook_active`) is let through, so a check the agent cannot fix never loops.
Without a record for the session, the stop does nothing.
"""

import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
from pathlib import Path
from typing import Any

_BLOCK = 2
_TIMEOUT_SECONDS = 540
_MAX_OUTPUT_LINES = 80
_REMINDER_TIMEOUT_SECONDS = 60
_STALE_DOCS = Path(".agents/feature-map/stale_docs.py")
_FEATURE_MAP_DIR = ".agents/feature-map/"


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=repo, capture_output=True, text=True, check=True
    ).stdout


def _git_paths(repo: Path, *args: str) -> set[str]:
    # -z keeps paths with non-ASCII characters unquoted.
    return {path for path in _git(repo, *args, "-z").split("\0") if path}


def _dirty_files(repo: Path) -> set[str]:
    """Uncommitted changes, including deletions and untracked files."""
    return _git_paths(repo, "diff", "--name-only", "HEAD") | _git_paths(
        repo, "ls-files", "--others", "--exclude-standard"
    )


def _digests(repo: Path, files: list[str]) -> dict[str, str]:
    """Content hash per file; an empty string for a file that does not exist."""
    return {
        path: (
            hashlib.sha256((repo / path).read_bytes()).hexdigest()
            if (repo / path).is_file()
            else ""
        )
        for path in files
    }


def _snapshot_path(repo: Path, session: str) -> Path:
    git_dir = Path(_git(repo, "rev-parse", "--absolute-git-dir").strip())
    return git_dir / "agent-turns" / f"{re.sub(r'[^A-Za-z0-9_-]', '_', session)}.json"


def _record_turn_start(repo: Path, session: str) -> None:
    snapshot = _snapshot_path(repo, session)
    snapshot.parent.mkdir(exist_ok=True)
    snapshot.write_text(
        json.dumps(
            {
                "head": _git(repo, "rev-parse", "HEAD").strip(),
                "files": _digests(repo, sorted(_dirty_files(repo))),
            }
        )
    )


def _turn_changes(repo: Path, session: str) -> set[str] | None:
    """Files the turn edited, created, deleted or committed; None without a record."""
    try:
        start: dict[str, Any] = json.loads(_snapshot_path(repo, session).read_text())
    except (OSError, json.JSONDecodeError):
        return None
    start_files: dict[str, str] = start.get("files", {})
    changed = {
        path
        for path, digest in _digests(repo, sorted(_dirty_files(repo))).items()
        if start_files.get(path) != digest
    }
    try:
        changed |= _git_paths(repo, "diff", "--name-only", start["head"], "HEAD")
    except (subprocess.CalledProcessError, KeyError):
        pass
    return changed


def _pre_commit(repo: Path) -> str | None:
    on_path = shutil.which("pre-commit")
    if on_path:
        return on_path
    in_venv = repo / ".venv" / "bin" / "pre-commit"
    return str(in_venv) if in_venv.exists() else None


def _pre_commit_failures(repo: Path, files: list[str]) -> str | None:
    pre_commit = _pre_commit(repo)
    if not files or pre_commit is None:
        return None

    # pre-commit spots formatter rewrites through `git diff`, which cannot see
    # untracked files, so compare contents to catch rewrites of new files too.
    before = _digests(repo, files)
    # A new session lets a timeout stop the hooks pre-commit started, not only
    # pre-commit itself.
    try:
        proc = subprocess.Popen(
            [pre_commit, "run", "--files", *files],
            cwd=repo,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
    except OSError as e:
        return f"Could not run pre-commit ({e}); run it yourself before finishing."
    try:
        stdout, stderr = proc.communicate(timeout=_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        proc.communicate()
        return "pre-commit timed out; run it yourself before finishing."
    rewritten = sorted(
        path
        for path, digest in _digests(repo, files).items()
        if before.get(path) != digest
    )
    if proc.returncode == 0 and not rewritten:
        return None

    lines = [
        line
        for line in (stdout + stderr).splitlines()
        if not line.rstrip().endswith(("Passed", "Skipped"))
    ]
    return (
        "pre-commit failed on the files you changed this turn. Fix these before you "
        "finish. "
        "Formatters may already have rewritten some files.\n"
        + "\n".join(lines[-_MAX_OUTPUT_LINES:])
        + ("\nRewritten by hooks: " + ", ".join(rewritten) if rewritten else "")
    )


def _branch_doc_changes(repo: Path) -> set[str]:
    """Feature-map files the branch changed, committed or not."""
    base = "HEAD"
    for upstream in ("origin/main", "main"):
        try:
            base = _git(repo, "merge-base", "HEAD", upstream).strip()
            break
        except subprocess.CalledProcessError:
            continue
    changed = _git_paths(repo, "diff", "--name-only", base) | _git_paths(
        repo, "ls-files", "--others", "--exclude-standard"
    )
    return {path for path in changed if path.startswith(_FEATURE_MAP_DIR)}


def _stale_doc_reminder(repo: Path, session: str, turn: set[str]) -> str | None:
    """Components the turn's code touched whose documents the branch never updated."""
    script = repo / _STALE_DOCS
    if not script.is_file() or not turn:
        return None
    files = turn | _branch_doc_changes(repo)
    try:
        result = subprocess.run(
            [sys.executable, str(script), "--session", session, *sorted(files)],
            cwd=repo,
            capture_output=True,
            text=True,
            timeout=_REMINDER_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        return None
    return result.stdout.strip() or None


def main() -> int:
    payload: dict[str, Any]
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        payload = {}
    session: str | None = payload.get("session_id")
    if not session or payload.get("stop_hook_active"):
        return 0

    try:
        repo = Path(
            _git(
                Path(payload.get("cwd") or os.getcwd()), "rev-parse", "--show-toplevel"
            ).strip()
        )
        if payload.get("hook_event_name") == "UserPromptSubmit":
            _record_turn_start(repo, session)
            return 0
        turn = _turn_changes(repo, session)
    except (subprocess.CalledProcessError, OSError):
        return 0
    if not turn:
        return 0
    try:
        reminder = _stale_doc_reminder(repo, session, turn)
    except (subprocess.CalledProcessError, OSError):
        reminder = None
    files = sorted(path for path in turn if (repo / path).is_file())
    messages = [
        message for message in (_pre_commit_failures(repo, files), reminder) if message
    ]
    if not messages:
        return 0
    print("\n\n".join(messages), file=sys.stderr)
    return _BLOCK


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `backend/alembic/versions/3debc2b55899_durable_craft_provisioning_lifecycle.py`
```
"""durable craft provisioning lifecycle

Revision ID: 3debc2b55899
Revises: 4662f8c3e038
Create Date: 2026-07-29 16:05:31.324630

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "3debc2b55899"
down_revision = "4662f8c3e038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The non-native status enum was sized to its longest member at creation
    # ("active" → VARCHAR(6)); widen for the new INITIALIZING value.
    op.alter_column(
        "build_session",
        "status",
        type_=sa.String(length=12),
        existing_type=sa.String(length=6),
        existing_nullable=False,
    )
    op.add_column(
        "sandbox",
        sa.Column(
            "provisioning_attempt_number",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "sandbox",
        sa.Column("provisioning_started_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Port allocation previously had no uniqueness guarantee, so concurrent
    # creates could have reserved the same port. Ports only need to be unique
    # within one user's sandbox (each user has their own pod/container), so
    # scope the constraint per user. Keep the oldest reservation per
    # (user, port) — within a shared pod its dev server won the bind; later
    # duplicates never served. A cleared session gets a fresh port on its
    # next sleep/restore cycle.
    op.execute(
        """
        UPDATE build_session SET nextjs_port = NULL
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY user_id, nextjs_port ORDER BY created_at ASC
                ) AS rn
                FROM build_session
                WHERE nextjs_port IS NOT NULL
            ) ranked
            WHERE ranked.rn > 1
        )
        """
    )
    op.create_index(
        "uq_build_session_nextjs_port",
        "build_session",
        ["user_id", "nextjs_port"],
        unique=True,
        postgresql_where=sa.text("nextjs_port IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_build_session_nextjs_port", table_name="build_session")
    op.drop_column("sandbox", "provisioning_started_at")
    op.drop_column("sandbox", "provisioning_attempt_number")
    # Fold the statuses this revision introduced back into the old set before
    # shrinking the column (non-native enums persist member NAMES).
    op.execute(
        "UPDATE build_session SET status = 'IDLE' "
        "WHERE status IN ('INITIALIZING', 'FAILED')"
    )
    op.alter_column(
        "build_session",
        "status",
        type_=sa.String(length=6),
        existing_type=sa.String(length=12),
        existing_nullable=False,
    )

```

### Core Architecture Module: `backend/alembic/versions/47a07e1a38f1_fix_invalid_model_configurations_state.py`
```
"""Fix invalid model-configurations state

Revision ID: 47a07e1a38f1
Revises: 7a70b7664e37
Create Date: 2025-04-23 15:39:43.159504

"""

from alembic import op
from pydantic import BaseModel, ConfigDict
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from onyx.llm.well_known_providers.llm_provider_options import (
    fetch_model_names_for_provider_as_set,
    fetch_visible_model_names_for_provider_as_set,
)

# revision identifiers, used by Alembic.
revision = "47a07e1a38f1"
down_revision = "7a70b7664e37"
branch_labels = None
depends_on = None


class _SimpleModelConfiguration(BaseModel):
    # Configure model to read from attributes
    model_config = ConfigDict(from_attributes=True)

    id: int
    llm_provider_id: int
    name: str
    is_visible: bool
    max_input_tokens: int | None


def upgrade() -> None:
    llm_provider_table = sa.sql.table(
        "llm_provider",
        sa.column("id", sa.Integer),
        sa.column("provider", sa.String),
        sa.column("model_names", postgresql.ARRAY(sa.String)),
        sa.column("display_model_names", postgresql.ARRAY(sa.String)),
        sa.column("default_model_name", sa.String),
        sa.column("fast_default_model_name", sa.String),
    )
    model_configuration_table = sa.sql.table(
        "model_configuration",
        sa.column("id", sa.Integer),
        sa.column("llm_provider_id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("is_visible", sa.Boolean),
        sa.column("max_input_tokens", sa.Integer),
    )

    connection = op.get_bind()

    llm_providers = connection.execute(
        sa.select(
            llm_provider_table.c.id,
            llm_provider_table.c.provider,
        )
    ).fetchall()

    for llm_provider in llm_providers:
        llm_provider_id, provider_name = llm_provider

        default_models = fetch_model_names_for_provider_as_set(provider_name)
        display_models = fetch_visible_model_names_for_provider_as_set(
            provider_name=provider_name
        )

        # if `fetch_model_names_for_provider_as_set` returns `None`, then
        # that means that `provider_name` is not a well-known llm provider.
        if not default_models:
            continue

        if not display_models:
            raise RuntimeError(
                "If `default_models` is non-None, `display_models` must be non-None too."
            )

        model_configurations = [
            _SimpleModelConfiguration.model_validate(model_configuration)
            for model_configuration in connection.execute(
                sa.select(
                    model_configuration_table.c.id,
                    model_configuration_table.c.llm_provider_id,
                    model_configuration_table.c.name,
                    model_configuration_table.c.is_visible,
                    model_configuration_table.c.max_input_tokens,
                ).where(model_configuration_table.c.llm_provider_id == llm_provider_id)
            ).fetchall()
        ]

        if model_configurations:
            at_least_one_is_visible = any(
                model_configuration.is_visible
                for model_configuration in model_configurations
            )

            # If there is at least one model which is public, this is a valid state.
            # Therefore, don't touch it and move on to the next one.
            if at_least_one_is_visible:
                continue

            existing_visible_model_names: set[str] = {
                model_configuration.name
                for model_configuration in model_configurations
                if model_configuration.is_visible
            }

            difference = display_models.difference(existing_visible_model_names)

            for model_name in difference:
                if not model_name:
                    continue

                insert_statement = postgresql.insert(model_configuration_table).values(
                    llm_provider_id=llm_provider_id,
                    name=model_name,
                    is_visible=True,
                    max_input_tokens=None,
                )

                connection.execute(
                    insert_statement.on_conflict_do_update(
                        index_elements=["llm_provider_id", "name"],
                        set_={"is_visible": insert_statement.excluded.is_visible},
                    )
                )
        else:
            for model_name in default_models:
                connection.execute(
                    model_configuration_table.insert().values(
                        llm_provider_id=llm_provider_id,
                        name=model_name,
                        is_visible=model_name in display_models,
                        max_input_tokens=None,
                    )
                )


def downgrade() -> None:
    pass

```

### Core Architecture Module: `backend/alembic/versions/689433b0d8de_add_hook_and_hook_execution_log_tables.py`
```
"""add_hook_and_hook_execution_log_tables

Revision ID: 689433b0d8de
Revises: 93a2e195e25c
Create Date: 2026-03-13 11:25:06.547474

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID

# revision identifiers, used by Alembic.
revision = "689433b0d8de"
down_revision = "93a2e195e25c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hook",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "hook_point",
            sa.Enum("document_ingestion", "query_processing", native_enum=False),
            nullable=False,
        ),
        sa.Column("endpoint_url", sa.Text(), nullable=True),
        sa.Column("api_key", sa.LargeBinary(), nullable=True),
        sa.Column("is_reachable", sa.Boolean(), nullable=True),
        sa.Column(
            "fail_strategy",
            sa.Enum("hard", "soft", native_enum=False),
            nullable=False,
        ),
        sa.Column("timeout_seconds", sa.Float(), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column("creator_id", PGUUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["creator_id"], ["user.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_hook_one_non_deleted_per_point",
        "hook",
        ["hook_point"],
        unique=True,
        postgresql_where=sa.text("deleted = false"),
    )

    op.create_table(
        "hook_execution_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hook_id", sa.Integer(), nullable=False),
        sa.Column(
            "is_success",
            sa.Boolean(),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["hook_id"], ["hook.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_hook_execution_log_hook_id", "hook_execution_log", ["hook_id"])
    op.create_index(
        "ix_hook_execution_log_created_at", "hook_execution_log", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_hook_execution_log_created_at", table_name="hook_execution_log")
    op.drop_index("ix_hook_execution_log_hook_id", table_name="hook_execution_log")
    op.drop_table("hook_execution_log")

    op.drop_index("ix_hook_one_non_deleted_per_point", table_name="hook")
    op.drop_table("hook")

```

### Core Architecture Module: `backend/ee/onyx/background/celery/tasks/external_group_syncing/group_sync_utils.py`
```
from sqlalchemy.orm import Session

from ee.onyx.external_permissions.sync_params import (
    source_group_sync_is_cc_pair_agnostic,
)
from onyx.db.connector import mark_cc_pair_as_external_group_synced
from onyx.db.connector_credential_pair import get_connector_credential_pairs_for_source
from onyx.db.models import ConnectorCredentialPair


def _get_all_cc_pair_ids_to_mark_as_group_synced(
    db_session: Session, cc_pair: ConnectorCredentialPair
) -> list[int]:
    if not source_group_sync_is_cc_pair_agnostic(cc_pair.connector.source):
        return [cc_pair.id]

    cc_pairs = get_connector_credential_pairs_for_source(
        db_session, cc_pair.connector.source
    )
    return [cc_pair.id for cc_pair in cc_pairs]


def mark_all_relevant_cc_pairs_as_external_group_synced(
    db_session: Session, cc_pair: ConnectorCredentialPair
) -> None:
    """For some source types, one successful group sync run should count for all
    cc pairs of that type. This function handles that case."""
    cc_pair_ids = _get_all_cc_pair_ids_to_mark_as_group_synced(db_session, cc_pair)
    for cc_pair_id in cc_pair_ids:
        mark_cc_pair_as_external_group_synced(db_session, cc_pair_id)

```

### Core Architecture Module: `backend/ee/onyx/background/celery/tasks/hooks/tasks.py`
```
from celery import shared_task

from onyx.configs.app_configs import JOB_TIMEOUT
from onyx.configs.constants import OnyxCeleryTask
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.db.hook import cleanup_old_execution_logs__no_commit
from onyx.utils.logger import setup_logger

logger = setup_logger()

_HOOK_EXECUTION_LOG_RETENTION_DAYS: int = 30


@shared_task(
    name=OnyxCeleryTask.HOOK_EXECUTION_LOG_CLEANUP_TASK,
    ignore_result=True,
    soft_time_limit=JOB_TIMEOUT,
    trail=False,
)
def hook_execution_log_cleanup_task(*, tenant_id: str) -> None:  # noqa: ARG001
    try:
        with get_session_with_current_tenant() as db_session:
            deleted: int = cleanup_old_execution_logs__no_commit(
                db_session=db_session,
                max_age_days=_HOOK_EXECUTION_LOG_RETENTION_DAYS,
            )
            db_session.commit()
            if deleted:
                logger.info(
                    "Deleted %s hook execution log(s) older than %s days.",
                    deleted,
                    _HOOK_EXECUTION_LOG_RETENTION_DAYS,
                )
    except Exception:
        logger.exception("Failed to clean up hook execution logs")
        raise

```

### Core Architecture Module: `backend/ee/onyx/background/celery_utils.py`
```
from sqlalchemy.orm import Session

from ee.onyx.background.task_name_builders import name_chat_ttl_task
from onyx.db.tasks import check_task_is_live_and_not_timed_out, get_latest_task
from onyx.utils.logger import setup_logger

logger = setup_logger()


def should_perform_chat_ttl_check(
    retention_limit_days: float | None, db_session: Session
) -> bool:
    # TODO: make this a check for None and add behavior for 0 day TTL
    if not retention_limit_days:
        return False

    task_name = name_chat_ttl_task(retention_limit_days)
    latest_task = get_latest_task(task_name, db_session)
    if not latest_task:
        return True

    if check_task_is_live_and_not_timed_out(latest_task, db_session):
        logger.debug("%s is already being performed. Skipping.", task_name)
        return False
    return True

```

### Core Architecture Module: `backend/ee/onyx/external_permissions/github/utils.py`
```
from collections.abc import Callable
from enum import Enum
from typing import TypeVar

from github import Github, RateLimitExceededException
from github.GithubException import GithubException
from github.NamedUser import NamedUser
from github.PaginatedList import PaginatedList
from github.Repository import Repository
from pydantic import BaseModel, Field

from ee.onyx.db.external_perm import ExternalUserGroup
from onyx.access.models import ExternalAccess
from onyx.access.utils import build_ext_group_name_for_onyx
from onyx.configs.constants import DocumentSource
from onyx.connectors.github.rate_limit_utils import sleep_after_rate_limit_exception
from onyx.utils.logger import setup_logger

logger = setup_logger()


class GitHubVisibility(Enum):
    """GitHub repository visibility options."""

    PUBLIC = "public"
    PRIVATE = "private"
    INTERNAL = "internal"


MAX_RETRY_COUNT = 3

T = TypeVar("T")

# Higher-order function to wrap GitHub operations with retry and exception handling


def _run_with_retry(
    operation: Callable[[], T],
    description: str,
    github_client: Github,
    retry_count: int = 0,
) -> T:
    """Execute a GitHub operation with retry on rate limit and exception handling."""
    logger.debug("Starting operation '%s', attempt %s", description, retry_count + 1)
    try:
        result = operation()
        logger.debug("Operation '%s' completed successfully", description)
        return result
    except RateLimitExceededException as error:
        if retry_count >= MAX_RETRY_COUNT:
            raise RuntimeError(f"Max retries exceeded for {description}") from error
        sleep_after_rate_limit_exception(github_client)
        logger.warning(
            "Rate limit exceeded while %s. Retrying... (attempt %s/%s)",
            description,
            retry_count + 1,
            MAX_RETRY_COUNT,
        )
        return _run_with_retry(operation, description, github_client, retry_count + 1)
    except GithubException as e:
        logger.warning("GitHub API error during %s: %s", description, e)
        raise
    except Exception as e:
        logger.exception("Unexpected error during %s: %s", description, e)
        raise


class UserInfo(BaseModel):
    login: str
    email: str | None = None


class GitHubGroupSyncCache(BaseModel):
    users_by_login: dict[str, UserInfo] = Field(default_factory=dict)
    organization_groups_by_id: dict[int, ExternalUserGroup] = Field(
        default_factory=dict
    )


def _get_user_info(user: NamedUser, cache: GitHubGroupSyncCache) -> UserInfo:
    login = user.login
    cached_user = cache.users_by_login.get(login)
    if cached_user is not None:
        return cached_user

    user_info = UserInfo(login=login, email=user.email)
    if user_info.email is None:
        logger.warning("GitHub user %s has no email", login)
    cache.users_by_login[login] = user_info
    return user_info


def _fetch_organization_group(
    github_client: Github, repo: Repository, cache: GitHubGroupSyncCache
) -> ExternalUserGroup:
    organization = repo.organization
    if organization is None:
        raise ValueError(f"Repository {repo.full_name} has no organization")

    cached_group = cache.organization_groups_by_id.get(organization.id)
    if cached_group is not None:
        return cached_group

    org_name = organization.login
    logger.info("Fetching organization members for %s", org_name)

    org = _run_with_retry(
        lambda: github_client.get_organization(org_name),
        f"get organization {org_name}",
        github_client,
    )
    if not org:
        logger.error("Failed to fetch organization %s", org_name)
        raise RuntimeError(f"Failed to fetch organization {org_name}")

    members: PaginatedList[NamedUser] | list[NamedUser] = _run_with_retry(
        lambda: org.get_members(filter_="all"),
        f"get members for organization {org_name}",
        github_client,
    )

    user_emails = {
        user_info.email
        for member in members
        if (user_info := _get_user_info(member, cache)).email
    }
    organization_group = ExternalUserGroup(
        id=form_organization_group_id(organization.id),
        user_emails=list(user_emails),
    )
    cache.organization_groups_by_id[organization.id] = organization_group

    logger.info("Fetched %s members for organization %s", len(user_emails), org_name)
    return organization_group


def _fetch_repository_collaborator_emails(
    repo: Repository, github_client: Github, cache: GitHubGroupSyncCache
) -> set[str]:
    """Fetch every user with repository access, regardless of the grant source."""
    collaborators: PaginatedList[NamedUser] | list[NamedUser] = _run_with_retry(
        repo.get_collaborators,
        f"get collaborators for repository {repo.full_name}",
        github_client,
    )
    user_emails = {
        user_info.email
        for collaborator in collaborators
        if (user_info := _get_user_info(collaborator, cache)).email
    }
    logger.info(
        "Fetched %s collaborators with emails for repository %s",
        len(user_emails),
        repo.full_name,
    )
    return user_emails


def form_collaborators_group_id(repository_id: int) -> str:
    """Generate group ID for repository collaborators."""
    if not repository_id:
        logger.error("Repository ID is required to generate collaborators group ID")
        raise ValueError("Repository ID must be set to generate group ID.")
    group_id = f"{repository_id}_collaborators"
    return group_id


def form_organization_group_id(organization_id: int) -> str:
    """Generate group ID for organization using organization ID."""
    if not organization_id:
        logger.error("Organization ID is required to generate organization group ID")
        raise ValueError("Organization ID must be set to generate group ID.")
    group_id = f"{organization_id}_organization"
    return group_id


def get_repository_visibility(repo: Repository) -> GitHubVisibility:
    """
    Get the visibility of a repository.
    Returns GitHubVisibility enum member.
    """
    if hasattr(repo, "visibility"):
        visibility = repo.visibility
        logger.info(
            "Repository %s visibility from attribute: %s", repo.full_name, visibility
        )
        try:
            return GitHubVisibility(visibility)
        except ValueError:
            logger.warning(
                "Unknown visibility '%s' for repo %s, defaulting to private",
                visibility,
                repo.full_name,
            )
            return GitHubVisibility.PRIVATE

    logger.info("Repository %s is private", repo.full_name)
    return GitHubVisibility.PRIVATE


def get_external_access_permission(
    repo: Repository,
    github_client: Github,  # noqa: ARG001
    add_prefix: bool = False,
) -> ExternalAccess:
    """
    Get the external access permission for a repository.
    Uses group-based permissions for efficiency and scalability.

    add_prefix: When this method is called during the initial permission sync via the connector,
                the group ID isn't prefixed with the source while inserting the document record.
                So in that case, set add_prefix to True, allowing the method itself to handle
                prefixing. However, when the same method is invoked from doc_sync, our system
                already adds the prefix to the group ID while processing the ExternalAccess object.
    """
    repo_visibility = get_repository_visibility(repo)
    logger.info(
        "Generating ExternalAccess for %s: visibility=%s",
        repo.full_name,
        repo_visibility.value,
    )

    if repo_visibility == GitHubVisibility.PUBLIC:
        logger.info(
            "Repository %s is public - allowing access to all users", repo.full_name
        )
        return ExternalAccess(
            external_user_emails=set(),
            external_user_group_ids=set(),
            is_public=True,
        )
    elif repo_visibility == GitHubVisibility.PRIVATE:
        logger.info(
            "Repository %s is private - setting up restricted access", repo.full_name
        )

        collaborators_group_id = form_collaborators_group_id(repo.id)
        if add_prefix:
            collaborators_group_id = build_ext_group_name_for_onyx(
                source=DocumentSource.GITHUB,
                ext_group_name=collaborators_group_id,
            )
        group_ids = {collaborators_group_id}

        logger.info("ExternalAccess groups for %s: %s", repo.full_name, group_ids)
        return ExternalAccess(
            external_user_emails=set(),
            external_user_group_ids=group_ids,
            is_public=False,
        )
    else:
        logger.info(
            "Repository %s is internal - using its organization group", repo.full_name
        )
        organization = repo.organization
        if organization is None:
            raise ValueError(f"Repository {repo.full_name} has no organization")
        org_group_id = form_organization_group_id(organization.id)
        if add_prefix:
            org_group_id = build_ext_group_name_for_onyx(
                source=DocumentSource.GITHUB,
                ext_group_name=org_group_id,
            )
        group_ids = {org_group_id}
        logger.info("ExternalAccess groups for %s: %s", repo.full_name, group_ids)
        return ExternalAccess(
            external_user_emails=set(),
            external_user_group_ids=group_ids,
            is_public=False,
        )


def get_external_user_group(
    repo: Repository,
    github_client: Github,
    cache: GitHubGroupSyncCache,
) -> list[ExternalUserGroup]:
    """Build the repository group while sharing users and organizations across repos."""
    repo_visibility = get_repository_visibility(repo)
    logger.info(
        "Generating ExternalUserGroups for %s: visibility=%s",
        repo.full_name,
        repo_visibility.value,
    )

    if repo_visibility == GitHubVisibility.PRIVATE:
       
```

### Core Architecture Module: `backend/ee/onyx/external_permissions/microsoft_utils/entra_groups.py`
```
"""Entra ID group expansion for the Microsoft permission-sync paths.

Lives outside the SharePoint module because any Microsoft source that mirrors
permissions names Entra groups and needs the same two things from Graph:
expand one group into its members and nested groups, and enumerate a tenant's
groups outright. SharePoint is the caller today.

The external group name is ``{displayName}_{groupId}``, built only through
:func:`entra_group_name`. Onyx prefixes it with the source when it stores the
group, so the shape here only has to be stable within a source.

This module knows nothing about SharePoint principal types or any other
source-specific shape. Callers adapt :class:`ResolvedEntraGroup` into their own
models where they need extra fields.

It sits on the MIT Graph package, ``onyx.connectors.microsoft_utils``, which is
shared transport rather than a connector. Like that package it imports no
individual connector.
"""

import re
from collections.abc import Generator
from urllib.parse import quote

from office365.directory.object_collection import DirectoryObjectCollection
from office365.graph_client import GraphClient
from pydantic import BaseModel

from ee.onyx.db.external_perm import ExternalUserGroup
from onyx.connectors.microsoft_utils.entra import (
    ENTRA_GROUP_MEMBER_SELECT,
    ENTRA_NAMED_GROUP_SELECT,
    EntraDirectoryObject,
    EntraGroup,
    fetch_entra_page,
    iter_entra_items,
)
from onyx.connectors.microsoft_utils.graph_client import (
    GraphApiClient,
    sleep_and_retry,
)
from onyx.utils.logger import setup_logger

logger = setup_logger()

MICROSOFT_DOMAIN = ".onmicrosoft"

# Tenant-wide enumeration walks every group and every member. Past this many
# groups the run is not worth the memory or the Graph budget, so it stops and
# leaves the rest to be resolved from the source's own references.
ENTRA_GROUP_ENUMERATION_THRESHOLD = 100_000
ENTRA_GROUP_MEMBER_THRESHOLD = 1_000_000

_GUID_RE = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


class ResolvedEntraGroup(BaseModel):
    """An Entra group as a caller needs it: the id and its external group name."""

    model_config = {"frozen": True}

    id: str
    name: str


def normalize_email(email: str) -> str:
    return email.replace(MICROSOFT_DOMAIN, "")


def entra_group_name(display_name: str, group_id: str | None) -> str:
    """The external group name for an Entra group.

    Display names are not unique in Entra, so the id is part of the name. A
    failed id lookup yields the literal ``None`` suffix. Persisted ACLs already
    carry that name, so it must keep matching.
    """
    return f"{display_name}_{group_id}"


def extract_guid(text: str) -> str | None:
    """Pull the first GUID out of a string such as a SharePoint claims token."""
    try:
        match = re.search(f"({_GUID_RE})", text, re.IGNORECASE)
        if match:
            return match.group(1)

        return None

    except Exception as e:
        logger.error("Failed to extract GUID from %s: %s", text, e)
        return None


def find_group_id_by_name(graph_client: GraphClient, display_name: str) -> str | None:
    try:
        groups = sleep_and_retry(
            graph_client.groups.filter(f"displayName eq '{display_name}'").get(),
            "find_group_id_by_name",
        )

        if groups and len(groups) > 0:
            return groups[0].id

        return None

    except Exception as e:
        logger.error("Failed to get Entra group id for name %s: %s", display_name, e)
        return None


def resolve_group_id(graph_client: GraphClient, identifier: str) -> str | None:
    """Resolve a GUID, a SharePoint claims token, or a display name to a group id."""
    try:
        if re.match(f"^{_GUID_RE}$", identifier, re.IGNORECASE):
            return identifier

        if identifier.startswith("c:0") and "|" in identifier:
            guid = extract_guid(identifier)
            if guid:
                logger.info("Extracted GUID %s from claims token %s", guid, identifier)
                return guid

        return find_group_id_by_name(graph_client, identifier)

    except Exception as e:
        logger.error("Failed to resolve group id from %s: %s", identifier, e)
        return None


def resolve_entra_group_name(
    graph_client: GraphClient, identifier: str, display_name: str
) -> str:
    """The external group name for a group known only by an identifier."""
    return entra_group_name(display_name, resolve_group_id(graph_client, identifier))


def expand_entra_group(
    graph_client: GraphClient, identifier: str
) -> tuple[set[ResolvedEntraGroup], set[str]]:
    """Return one group's nested groups and its direct member emails."""
    group_id = resolve_group_id(graph_client, identifier)
    if not group_id:
        logger.error("Failed to get Entra group id for %s", identifier)
        return set(), set()
    group = graph_client.groups[group_id]
    groups: set[ResolvedEntraGroup] = set()
    user_emails: set[str] = set()

    def process_members(members: DirectoryObjectCollection) -> None:
        nonlocal groups, user_emails

        # Iterate current_page, not the collection. Iterating the collection walks
        # pages via _get_next().execute_query(), which re-fires this page_loaded
        # callback and recurses until Python hits its max recursion depth.
        for member in members.current_page:
            member_data = member.to_json()
            logger.debug("Member: %s", member_data)
            user_principal_name = member_data.get("userPrincipalName")
            mail = member_data.get("mail")
            display_name = member_data.get("displayName") or member_data.get(
                "display_name"
            )

            is_user = False
            is_group = False

            # Users typically have userPrincipalName or mail
            if user_principal_name or (mail and "@" in str(mail)):
                is_user = True
            # Groups typically have displayName but no userPrincipalName
            elif display_name and not user_principal_name:
                if (
                    hasattr(member, "groupTypes")
                    or member_data.get("groupTypes") is not None
                ):
                    is_group = True
                elif member_data.get("id") and not user_principal_name:
                    is_group = True

            # Check the object type name (fallback)
            if not is_user and not is_group:
                obj_type = type(member).__name__.lower()
                if "user" in obj_type:
                    is_user = True
                elif "group" in obj_type:
                    is_group = True

            if is_user:
                if user_principal_name:
                    user_emails.add(normalize_email(user_principal_name))
                elif mail:
                    user_emails.add(normalize_email(mail))
                logger.info("Added user: %s", user_principal_name or mail)
            elif is_group:
                if not display_name:
                    logger.error("No display name for group: %s", member_data.get("id"))
                    continue
                member_id = member_data.get("id", "")
                name = resolve_entra_group_name(graph_client, member_id, display_name)
                groups.add(ResolvedEntraGroup(id=member_id, name=name))
                logger.info("Added group: %s", name)
            else:
                logger.warning("Could not identify member type for: %s", member_data)

    sleep_and_retry(
        group.members.get_all(page_loaded=process_members), "expand_entra_group"
    )

    return groups, user_emails


def enumerate_entra_groups(
    client: GraphApiClient,
    already_resolved: set[str],
    threshold: int = ENTRA_GROUP_ENUMERATION_THRESHOLD,
) -> Generator[ExternalUserGroup, None, None]:
    """Yield every Entra group in the tenant as an ExternalUserGroup.

    Skips groups whose name is already in ``already_resolved``. Stops once
    ``threshold`` groups have been seen.
    """
    total_groups = 0

    groups = iter_entra_items(
        lambda next_link: fetch_entra_page(
            client.get_json,
            url=f"{client.graph_api_base}/groups",
            item_model=EntraGroup,
            select_fields=ENTRA_NAMED_GROUP_SELECT,
            next_link=next_link,
        ),
        "Entra group listing",
    )
    for group in groups:
        group_id = group.id
        display_name = group.display_name
        if not group_id or not display_name:
            continue

        total_groups += 1
        if total_groups > threshold:
            logger.warning(
                "Entra group enumeration exceeded %s groups, stopping to avoid excessive memory and API usage. Remaining groups will be resolved from source references only.",
                threshold,
            )
            return

        name = entra_group_name(display_name, group_id)
        if name in already_resolved:
            continue

        member_emails: list[str] = []
        members = iter_entra_items(
            lambda next_link, group_id=group_id: fetch_entra_page(
                client.get_json,
                url=f"{client.graph_api_base}/groups/{quote(group_id)}/members",
                item_model=EntraDirectoryObject,
                select_fields=ENTRA_GROUP_MEMBER_SELECT,
                next_link=next_link,
            ),
            f"Entra group `{group_id}` members",
        )
        for member in members:
            email = member.user_principal_name or member.mail
            if email:
                member_emails.append(normalize_email(email))
            if len(member_emails) > ENTRA_GROUP_MEMBER_THRESHOLD:
                raise RuntimeError(
                    f"Entra group `{group_id}` exceeds the member count limit."
                )

        yield ExternalUserGroup(id=name, user_emails=member_emails)

    logger.info("Enumerated %s Entra groups via paginated Gr
```

### Core Architecture Module: `backend/ee/onyx/external_permissions/salesforce/utils.py`
```
from datetime import datetime
from threading import RLock
from weakref import ReferenceType, ref

from cachetools import TTLCache
from simple_salesforce.format import format_soql
from sqlalchemy.orm import Session

from onyx.configs.constants import DocumentSource
from onyx.connectors.credentials_provider import build_db_credentials_provider
from onyx.connectors.exceptions import ConnectorValidationError
from onyx.connectors.salesforce.auth import build_salesforce_client
from onyx.connectors.salesforce.onyx_salesforce import OnyxSalesforce
from onyx.db.document import get_cc_pairs_for_document
from onyx.utils.logger import setup_logger
from shared_configs.contextvars import get_current_tenant_id

logger = setup_logger()

_CACHE_TTL_SECONDS = 3600
_SALESFORCE_CLIENT_CACHE_MAX_SIZE = 256
_SALESFORCE_USER_ID_CACHE_MAX_SIZE = 10_000
_SALESFORCE_CACHE_LOCK = RLock()
_SALESFORCE_CLIENT_CACHE: TTLCache[tuple[str, int], tuple[datetime, OnyxSalesforce]] = (
    TTLCache(maxsize=_SALESFORCE_CLIENT_CACHE_MAX_SIZE, ttl=_CACHE_TTL_SECONDS)
)
_CACHED_SF_EMAIL_TO_ID_MAP: TTLCache[
    tuple[str, ReferenceType[OnyxSalesforce], str], str
] = TTLCache(maxsize=_SALESFORCE_USER_ID_CACHE_MAX_SIZE, ttl=_CACHE_TTL_SECONDS)


def _clear_cached_user_ids_for_client(
    tenant_id: str, sf_client: OnyxSalesforce
) -> None:
    with _SALESFORCE_CACHE_LOCK:
        stale_keys = [
            key
            for key in _CACHED_SF_EMAIL_TO_ID_MAP
            if key[0] == tenant_id and key[1]() is sf_client
        ]
        for key in stale_keys:
            _CACHED_SF_EMAIL_TO_ID_MAP.pop(key, None)


def _get_cached_salesforce_client(
    cache_key: tuple[str, int], credential_updated_at: datetime
) -> OnyxSalesforce | None:
    with _SALESFORCE_CACHE_LOCK:
        cached = _SALESFORCE_CLIENT_CACHE.get(cache_key)
    if cached is None or cached[0] != credential_updated_at:
        return None
    return cached[1]


def _cache_salesforce_client(
    cache_key: tuple[str, int],
    credential_updated_at: datetime,
    client: OnyxSalesforce,
) -> OnyxSalesforce:
    with _SALESFORCE_CACHE_LOCK:
        cached = _SALESFORCE_CLIENT_CACHE.get(cache_key)
        if cached is not None and cached[0] >= credential_updated_at:
            selected_client = cached[1]
        else:
            if cached is not None:
                _clear_cached_user_ids_for_client(cache_key[0], cached[1])
            _SALESFORCE_CLIENT_CACHE[cache_key] = (credential_updated_at, client)
            selected_client = client

    if selected_client is not client:
        client.session.close()
    return selected_client


def get_any_salesforce_client_for_doc_id(
    db_session: Session, doc_id: str
) -> OnyxSalesforce:
    """Return the client for the document's first connector credential pair."""
    cc_pairs = get_cc_pairs_for_document(db_session, doc_id)
    if not cc_pairs:
        raise ConnectorValidationError(
            f"No connector credential pair found for Salesforce document: {doc_id}"
        )

    credential = cc_pairs[0].credential
    tenant_id = get_current_tenant_id()
    cache_key = (tenant_id, credential.id)
    cached_client = _get_cached_salesforce_client(cache_key, credential.time_updated)
    if cached_client is not None:
        return cached_client

    provider = build_db_credentials_provider(DocumentSource.SALESFORCE, credential.id)
    client = build_salesforce_client(provider)
    return _cache_salesforce_client(cache_key, credential.time_updated, client)


def _query_salesforce_user_id(sf_client: OnyxSalesforce, user_email: str) -> str | None:
    query = format_soql(
        "SELECT Id FROM User WHERE Username = {email} AND IsActive = true",
        email=user_email,
    )
    result = sf_client.query(query)
    if len(result["records"]) > 0:
        return result["records"][0]["Id"]

    # Salesforce usernames and emails can differ.
    query = format_soql(
        "SELECT Id FROM User WHERE Email = {email} AND IsActive = true",
        email=user_email,
    )
    result = sf_client.query(query)
    if len(result["records"]) > 0:
        return result["records"][0]["Id"]

    return None


def get_salesforce_user_id_from_email(
    sf_client: OnyxSalesforce,
    user_email: str,
) -> str | None:
    """Resolve a Salesforce user ID, cached by tenant and client identity."""
    cache_key = (get_current_tenant_id(), ref(sf_client), user_email)
    with _SALESFORCE_CACHE_LOCK:
        cached_user_id = _CACHED_SF_EMAIL_TO_ID_MAP.get(cache_key)
    if cached_user_id is not None:
        return cached_user_id

    user_id = _query_salesforce_user_id(sf_client, user_email)
    if user_id is None:
        return None

    with _SALESFORCE_CACHE_LOCK:
        _CACHED_SF_EMAIL_TO_ID_MAP[cache_key] = user_id
    return user_id


_MAX_RECORD_IDS_PER_QUERY = 200


def get_objects_access_for_user_id(
    salesforce_client: OnyxSalesforce,
    user_id: str,
    record_ids: list[str],
) -> dict[str, bool]:
    """Return access for up to Salesforce's 200 record ID query limit."""
    truncated_record_ids = record_ids[:_MAX_RECORD_IDS_PER_QUERY]
    # SOQL `IN ()` with an empty list is a malformed query, so short-circuit.
    if not truncated_record_ids:
        return {}
    access_query = format_soql(
        """
    SELECT RecordId, HasReadAccess
    FROM UserRecordAccess
    WHERE RecordId IN {record_ids}
    AND UserId = {user_id}
    """,
        record_ids=truncated_record_ids,
        user_id=user_id,
    )
    result = salesforce_client.query_all(access_query)
    return {record["RecordId"]: record["HasReadAccess"] for record in result["records"]}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5745** (2026-04-26): **Fix clicking of citations during answer stream**
  *Symptoms*: Citations are not clickable some of the time while the answer is streaming.  To recreate:  1. Index our docs (https://docs.onyx.app/) using the `Web` connector. 2. Ask "What is Onyx. Run an internal search". 3. Try clicking on any citations as the final answer streams out.  In my experience, ~50% of the clicks won't do anything. Some of the time, a new tab will open (this is the expected behavior).
  **Post-Mortem & Fix Analysis**:
  > @Weves would like to work on this thanks 
  > @Weves hii, I've worked on this and created a PR below can you review it ?
  > This issue is stale because it has been open 75 days with no activity. Remove stale label or comment or this will be closed in 15 days.

- **Issue #701** (2024-01-11): **Web Connector Miscount on GitHub Repository Documents**
  *Symptoms*: I've encountered an issue with the Web connector when adding the following GitHub repository URL: https://github.com/fufesou/RustDeskIddDriver. Post addition, Danswer seems to be detecting over 3000 documents, a process that doesn't complete as I halted it midway, suspecting an anomaly since the repository does not contain that many files:  <details><summary>Screenshot</summary>  ![2023-11-07_1-27-59](https://github.com/danswer-ai/danswer/assets/71711753/9c51d458-4747-4f23-b6a3-ece6ab62fdc7)  </details>   Conversely, another Web connector set up with https://github.com/Microsoft/DMF identified only 132 documents, which appears to be accurate:  <details><summary>Screenshot</summary>  ![2023-11-07_1-27-33](https://github.com/danswer-ai/danswer/assets/71711753/f0f56f6e-6573-4aa0-9685-6d799f880c89)  </details>   Could there be a bug causing the Web connector to incorrectly parse and count documents from certain GitHub repositories? I believe this warrants investigation to ensure accuracy in document retrieval.
  **Post-Mortem & Fix Analysis**:
  > Will investigate and get back to you shortly
  > So trying to pull in a repo like this will also pull in a lot of garbage, there are a HUGE number of URLs like: https://github.com/fufesou/RustDeskIddDriver/forks?include=active%2Carchived%2Cnetwork%2Cstarred&page=1&period=1y&sort_by=stargazer_counts  You could try using https://github.com/fufesou/RustDeskIddDriver/blob/main as the base, this would prevent that.  But even then, I'm not too sure if the code search quality will be that high. We're planning to build code search as its own feature in the future and it will be much better than indexing pages on github like this. 
  > Thank you for the prompt response and the suggestion to use a more specific base URL to avoid pulling in extraneous data. I've noticed that the issue of pulling in unwanted URLs like fork pages does not occur with the Microsoft/DMF repository, which similarly has accessible URLs such as https://github.com/Microsoft/DMF/forks.  Regardless, I appreciate your team looking into this matter, and I am excited about the prospect of a dedicated code search feature. The ability to search through code within repositories will be a substantial enhancement to your service.

- **Issue #242** (2025-06-10): **Problem with nginx container. https://localhost:3000 is not working.**
  *Symptoms*: I have installed all the containers and started them. Everything is Working great! But the Nginx container is not working correctly. But the container shows nginx server is running in port 3000:80.  This is the log.  2023-07-27 22:32:43 2023/07/27 17:02:43 [notice] 1#1: signal 29 (SIGIO) received 2023-07-27 22:32:43 2023/07/27 17:02:43 [notice] 1#1: signal 17 (SIGCHLD) received from 16 2023-07-27 22:32:43 2023/07/27 17:02:43 [notice] 1#1: worker process 16 exited with code 0 2023-07-27 22:32:43 2023/07/27 17:02:43 [notice] 1#1: exit 2023-07-27 22:32:44 /bin/sh: can't open /etc/nginx/conf.d/app.conf.template.dev: no such file 2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: using the "epoll" event method 2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: nginx/1.23.4 2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: built by gcc 12.2.1 20220924 (Alpine 12.2.1_git20220924-r4)  2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: OS: Linux 5.15.90.1-microsoft-standard-WSL2 2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: getrlimit(RLIMIT_NOFILE): 1048576:1048576 2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: start worker processes 2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: start worker process 8 2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: start worker process 9 2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: start worker process 10 2023-07-27 22:32:44 2023/07/27 17:02:44 [notice] 1#1: start worker process 11 
  **Post-Mortem & Fix Analysis**:
  > I'm having the exact same issue.
  > I left it alone and come to find out after 20-30min, it started working. Is there a reason it takes this long?
  > This line from your log:  > 2023-07-27 22:32:44 /bin/sh: can't open /etc/nginx/conf.d/app.conf.template.dev: no such file  indicates that the host folder `deployment/data/nginx` mounted at `/etc/nginx/conf.d` was somehow missing the app.conf.template.dev file. The command in docker-compose.dev.yaml for nginx uses that file to initialize the Nginx app config, which configures the reverse proxy for the web app and API server.  I've run into this occasionally as well, and I'm surprised more people haven't. In my case, I think what is happening is that there's some latency when mounting folders inside the container, and the volume mount is still syncing files from the host machine to the container when the run command gets executed, so the files appear missing when nginx launches. The solution I was using was to just restart the container a whole bunch of times until it finally launched with the app.conf file correctly created and mounted in the folder when Nginx started running. I'v

- **Issue #180** (2023-10-20): **Google Drive PDF Parsing Issue**
  *Symptoms*: I started to watch the `/var/log/update.log` on `danswer/danswer-background` and noticed the following exceptions raised:  ``` 07/15/2023 04:23:59 PM            update.py  95 : Starting new indexing attempt for connector: 'GoogleDriveConnector', with config: '{}', and with credentials: '[6]' 07/15/2023 04:24:00 PM    connector_auth.py  49 : Refreshed Google Drive tokens. 07/15/2023 04:24:01 PM         connector.py  75 : Parseable Documents in batch: ['2023 Consolidated SS + Flick - Financial Model', 'XX Cash Flow 2023', '351618_UASD3PGZ (3).pdf', '351618_UASD3PGZ (2).pdf', '351618_UASD3PGZ (1).pdf', '351618_UASD3PGZ.pdf', 'XX_SPL001_waybill_UASD3PGZ_A5 (7).pdf', 'XX_SPL001_waybill_UASD3PGZ_A5 (6).pdf', 'XX_SPL001_waybill_UASD3PGZ_A5 (5).pdf', 'XX_SPL001_waybill_UASD3PGZ_A5 (4).pdf', 'XX_SPL001_waybill_UASD3PGZ_A5 (3).pdf'] 07/15/2023 04:24:17 PM             store.py 159 : Indexed 13 chunks into Typesense collection 'danswer_index', number failed: 0 07/15/2023 04:24:22 PM            timing.py  29 : encode_chunks took 5.2996666431427 seconds 07/15/2023 04:24:22 PM          indexing.py 167 : Indexed 13 chunks into Qdrant collection 'danswer_index', status: UpdateStatus.COMPLETED 07/15/2023 04:24:22 PM indexing_pipeline.py  44 : Indexed 0 new documents 07/15/2023 04:24:23 PM         connector.py  75 : Parseable Documents in batch: ['XX_SPL001_waybill_UASD3PGZ_A5 (2).pdf', 'XX_SPL001_waybill_UASD3PGZ_A5 (1).pdf', 'XX_SPL001_waybill_UASD3PGZ_A5.pdf', 'Order_351619_waybill
  **Post-Mortem & Fix Analysis**:
  > Seems I found the issue that causes the exceptions in the original issue post.  ``` 07/15/2023 04:24:28 PM            update.py 176 : Indexing job with id 96 failed due to EOF marker not found Traceback (most recent call last):   File "/app/danswer/background/update.py", line 155, in run_indexing_jobs     for doc_batch in doc_batch_generator:   File "/app/danswer/connectors/google_drive/connector.py", line 165, in poll_source     yield from self._fetch_docs_from_drive(start, end)   File "/app/danswer/connectors/google_drive/connector.py", line 144, in _fetch_docs_from_drive     text_contents = extract_text(file, service)                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/app/danswer/connectors/google_drive/connector.py", line 101, in extract_text     pdf_reader = PdfReader(pdf_stream)                  ^^^^^^^^^^^^^^^^^^^^^   File "/usr/local/lib/python3.11/site-packages/PyPDF2/_reader.py", line 319, in __init__     self.read(stream)   File "/usr/local/lib/python3
  > Will fix this but probably not in that way, any chance you can attach/link a PDF for easy repro?
  > @yuhongsun96 sure, will see if I can narrow down which one it is

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

### Incident Patch 1: `897500eb` (2026-10-06)
**Commit Message**: fix(opal): stop dropdowns from scrolling the page when they open (#15597)

**File**: `web/lib/opal/src/components/buttons/link-button/styles.css` (modified, +3/-1)
```diff
@@ -9,8 +9,10 @@
    `currentColor` so `text-text-03` on the root cascades through.
 ============================================================================ */
 
+/* `relative` contains the absolute `sr-only` "(opens in new tab)" span.
+   Without it the span escapes any scroll container and grows `<body>`. */
 .opal-link-button {
-  @apply inline-flex flex-row items-center gap-0.5 text-text-03;
+  @apply relative inline-flex flex-row items-center gap-0.5 text-text-03;
   background: transparent;
   border: 0;
   padding: 0;
```

**File**: `web/lib/opal/src/components/dropdown/Dropdown.test.tsx` (modified, +82/-0)
```diff
@@ -3,6 +3,7 @@ import { render, screen } from "@tests/setup/test-utils";
 import "@testing-library/jest-dom";
 import userEvent from "@testing-library/user-event";
 import { Dropdown, InputTypeIn } from "@opal/components";
+import { scrollWithinList } from "@opal/components/dropdown/list";
 import type {
   DropdownItem,
   DropdownMenuItem,
@@ -845,3 +846,84 @@ describe("Dropdown view registry", () => {
     ).toHaveAttribute("aria-checked", "true");
   });
 });
+
+interface ListGeometry {
+  /** The row's viewport top; the scroller's view spans 100–300. */
+  rowTop: number;
+  margin?: number;
+}
+
+/**
+ * A scroller and one row with stubbed geometry: jsdom has no layout. The
+ * scroller's view is 100–300 in the viewport, scrolled 50px; rows are 40px.
+ */
+function listGeometry({ rowTop, margin = 0 }: ListGeometry) {
+  const scroller = document.createElement("div");
+  scroller.className = "opal-dropdown-scroll";
+  const row = document.createElement("div");
+  scroller.appendChild(row);
+  document.body.appendChild(scroller);
+  Object.defineProperty(scroller, "clientHeight", { value: 200 });
+  Object.defineProperty(scroller, "scrollTop", { value: 50, writable: true });
+  scroller.getBoundingClientRect = () => new DOMRect(0, 100, 200, 200);
+  row.getBoundingClientRect = () => new DOMRect(0, rowTop, 200, 40);
+  const computed = window.getComputedStyle;
+  jest.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) =>
+    el === row
+      ? Object.assign(computed(el, pseudo), {
+          scrollMarginBlockStart: `${margin}px`,
+          scrollMarginBlockEnd: `${margin}px`,
+        })
+      : computed(el, pseudo)
+  );
+  return { scroller, row };
+}
+
+describe("scrollWithinList", () => {
+  afterEach(() => {
+    jest.restoreAllMocks();
+    document.body.innerHTML = "";
+  });
+
+  test("center puts the row in the middle of the view", () => {
+    const { scroller, row } = listGeometry({ rowTop: 260 });
+    scrollWithinList(row, "center");
+    // Content top 210, centred in 200px: 210 - (200 - 40) / 2.
+    expect(scroller.scrollTop).toBe(130);
+  });
+
+  test("nearest leaves a row clear of the edges where it is", () => {
+    const { scroller, row } = listGeometry({ rowTop: 150, margin: 12 });
+    scrollWithinList(row, "nearest");
+    expect(scroller.scrollTop).toBe(50);
+  });
+
+  test("nearest keeps a row's scroll margin clear of the bottom edge", () => {
+    // Fully in view, but its margin reaches under the bottom fade.
+    const { scroller, row } = listGeometry({ rowTop: 250, margin: 12 });
+    scrollWithinList(row, "nearest");
+    // Content top 200: 200 + 40 + 12 - 200.
+    expect(scroller.scrollTop).toBe(52);
+  });
+
+  test("nearest keeps a row's scroll margin clear of the top edge", () => {
+    const { scroller, row } = listGeometry({ rowTop: 90, margin: 12 });
+    scrollWithinList(row, "nearest");
+    // Content top 40: 40 - 12.
+    expect(scroller.scrollTop).toBe(28);
+  });
+});
+
+describe("Dropdown scrolling", () => {
+  // Opening around the selection waits for floating-ui to place the list,
+  // which never happens in jsdom; `scrollWithinList`'s own tests cover it.
+  test("walking the rows never scrolls outside the list", async () => {
+    jest.mocked(Element.prototype.scrollIntoView).mockClear();
+    const user = setupUser();
+    render(<ButtonPickerHarness />);
+    await user.click(screen.getByRole("button", { name: "Fruit" }));
+    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}");
+    // scrollIntoView scrolls every ancestor of the portal, the page too.
+    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
+  });
+});
```

**File**: `web/lib/opal/src/components/dropdown/list.tsx` (modified, +48/-5)
```diff
@@ -138,7 +138,10 @@ export const DropdownList = forwardRef<HTMLDivElement, DropdownListProps>(
     const searchRef = useRef<HTMLInputElement>(null);
     const hasSearch = searchField !== undefined;
     useEffect(() => {
-      if (isOpen && hasSearch) searchRef.current?.focus();
+      // preventScroll: the field can be anywhere before floating-ui places
+      // the list, and a focus scroll would move the page behind the portal.
+      if (isOpen && hasSearch)
+        searchRef.current?.focus({ preventScroll: true });
     }, [isOpen, hasSearch, viewKey]);
 
     const listRef = useRef<HTMLDivElement | null>(null);
@@ -202,9 +205,12 @@ export const DropdownList = forwardRef<HTMLDivElement, DropdownListProps>(
     // highlights never scroll: the list must not move under the mouse.
     useEffect(() => {
       if (!isOpen || !keyboardNav || highlightedIndex < 0) return;
-      liveCard(listRef.current)
-        ?.querySelector(`[data-index="${highlightedIndex}"]`)
-        ?.scrollIntoView({ block: "nearest", behavior: "instant" });
+      scrollWithinList(
+        liveCard(listRef.current)?.querySelector(
+          `[data-index="${highlightedIndex}"]`
+        ),
+        "nearest"
+      );
     }, [highlightedIndex, isOpen, keyboardNav]);
 
     // Opening shows the selection: the (first) selected row is centred in
@@ -217,7 +223,7 @@ export const DropdownList = forwardRef<HTMLDivElement, DropdownListProps>(
       const selected = liveCard(listRef.current)?.querySelector(
         '[role="option"][aria-selected="true"]'
       );
-      selected?.scrollIntoView({ block: "center", behavior: "instant" });
+      scrollWithinList(selected, "center");
     }, [isOpen, isPositioned]);
 
     const cardProps: CardProps = {
@@ -343,6 +349,43 @@ function liveCard(root: HTMLElement | null): HTMLElement | null {
   return root?.querySelector<HTMLElement>(".opal-dropdown-card") ?? null;
 }
 
+/**
+ * Scrolls a row into view inside the list's own scroller only.
+ * `scrollIntoView` also scrolls every ancestor of the portal, `<body>`
+ * included even under `overflow: hidden`, which moves the whole page.
+ * Like `scrollIntoView`, "nearest" keeps the row's `scroll-margin-block`
+ * clear of the edge, so a stop never parks under the mask fade.
+ */
+export function scrollWithinList(
+  row: Element | null | undefined,
+  block: "nearest" | "center"
+): void {
+  const scroller: HTMLElement | null | undefined = row?.closest<HTMLElement>(
+    ".opal-dropdown-scroll"
+  );
+  if (!row || !scroller) return;
+  const rowRect: DOMRect = row.getBoundingClientRect();
+  const viewTop: number =
+    scroller.getBoundingClientRect().top + scroller.clientTop;
+  const viewBottom: number = viewTop + scroller.clientHeight;
+  // The row's top in the scroller's content coordinates.
+  const rowTop: number = rowRect.top - viewTop + scroller.scrollTop;
+  if (block === "center") {
+    scroller.scrollTop = rowTop - (scroller.clientHeight - rowRect.height) / 2;
+    return;
+  }
+  const style: CSSStyleDeclaration = window.getComputedStyle(row);
+  const marginStart: number =
+    Number.parseFloat(style.scrollMarginBlockStart) || 0;
+  const marginEnd: number = Number.parseFloat(style.scrollMarginBlockEnd) || 0;
+  if (rowRect.top - marginStart < viewTop) {
+    scroller.scrollTop = rowTop - marginStart;
+  } else if (rowRect.bottom + marginEnd > viewBottom) {
+    scroller.scrollTop =
+      rowTop + rowRect.height + marginEnd - scroller.clientHeight;
+  }
+}
+
 /** What a card renders: the search field and the rows of one view. */
 interface CardProps {
   listId: string;
```

---

### Incident Patch 2: `7baa8dbd` (2026-10-06)
**Commit Message**: fix(deps): pin tinypool to 2.1.2 (#15578)

Co-authored-by: onyx-cherry-pick[bot] <285052878+onyx-cherry-pick[bot]@users.noreply.github.com>



---

### Incident Patch 3: `ec644d30` (2026-10-06)
**Commit Message**: fix(deps): override tinypool to 2.1.2 to unblock audit (#15573)

**File**: `web/bun.lock` (modified, +2/-1)
```diff
@@ -161,6 +161,7 @@
   },
   "overrides": {
     "react-is": "^19.0.0-rc-69d4b800-20241021",
+    "tinypool": "2.1.2",
   },
   "packages": {
     "@adobe/css-tools": ["@adobe/css-tools@4.5.0", "", {}, "sha512-6OzddxPio9UiWTCemp4N8cYLV2ZN1ncRnV1cVGtve7dhPOtRkleRyx32GQCYSwDYgaHU3USMm84tNsvKzRCa1Q=="],
@@ -2477,7 +2478,7 @@
 
     "tinyglobby": ["tinyglobby@0.2.17", "", { "dependencies": { "fdir": "^6.5.0", "picomatch": "^4.0.4" } }, "sha512-wXR/dYpcqKmfWpEdZjiKJOwCNFndD0DMnrW/cYjVGttEkBfVgcLFHoNrlj47mjOVic9yyNu65alsgF4NQyTa2g=="],
 
-    "tinypool": ["tinypool@2.1.0", "", {}, "sha512-Pugqs6M0m7Lv1I7FtxN4aoyToKg1C4tu+/381vH35y8oENM/Ai7f7C4StcoK4/+BSw9ebcS8jRiVrORFKCALLw=="],
+    "tinypool": ["tinypool@2.1.2", "", {}, "sha512-9YodfrxS9g9IbFr/KOjE5bAeJ0p61n3bW6mqvy0jtoeKd1kTW1Cxm0oulm6KX2lyM9Gl6WIe8nEbY7LWv5ZJww=="],
 
     "tinyrainbow": ["tinyrainbow@2.0.0", "", {}, "sha512-op4nsTR47R6p0vMUUoYl/a+ljLFVtlfaXkLQmqfLR1qHma1h/ysYk4hEXZ880bf2CYgTskvTa/e196Vd5dDQXw=="],
 
```

**File**: `web/package.json` (modified, +2/-1)
```diff
@@ -139,6 +139,7 @@
     "whatwg-fetch": "^3.6.20"
   },
   "overrides": {
-    "react-is": "^19.0.0-rc-69d4b800-20241021"
+    "react-is": "^19.0.0-rc-69d4b800-20241021",
+    "tinypool": "2.1.2"
   }
 }
```

---

### Incident Patch 4: `79fb221d` (2026-10-05)
**Commit Message**: fix(terraform): tune the GCP Cloud Armor rule sets with field exclusions (#15553)

**File**: `deployment/terraform/modules/gcp/README.md` (modified, +27/-3)
```diff
@@ -285,9 +285,33 @@ object access and the narrow read that Onyx needs at startup.
 
 A backend security policy with the OWASP Core Rule Set at sensitivity 1, an API
 rate limit, a global rate limit and Adaptive Protection. It takes effect only on
-an L7 load balancer; see below. The WAF rules skip `/api/license/upload`,
-because its multipart body trips the protocol attack signatures. The rate
-limits still apply to it.
+an L7 load balancer; see below.
+
+The rule sets are tuned the standard way, with request field exclusions, so
+they deny without breaking Onyx. Without the tuning, sensitivity 1 denies chat
+messages that hold code, shell commands or file paths, every upload, and the
+Google sign-in callback.
+
+- No rule set except `methodenforcement`, `scannerdetection` and
+  `sessionfixation` reads the values of the Onyx fields that carry chat text,
+  prompts, code, URLs and secrets, such as `message`, `system_prompt`,
+  `api_base` and `password`. A name covers the query string, a form body and
+  the top-level keys of a JSON body, on every path. A nested key is reached
+  only through its parent, so free-form objects such as a connector's
+  configuration are covered by prefix. Everything else in the request is still
+  checked: the path, the headers, the cookies, the other parameters, and the
+  parameter names.
+- The same rule sets skip an upload, a `POST`, `PUT` or `PATCH` with a
+  `multipart/form-data` body. Cloud Armor does not parse a multipart body and
+  reads the file content as parameter names, which no exclusion covers. The
+  header alone exempts nothing: a `GET` is checked in full whatever it sends.
+- `scannerdetection` and `sessionfixation` check every request in full.
+
+When a legitimate request gets a 403, the load balancer log names the
+signature and the request. Add the field to
+`cloud_armor_extra_uninspected_fields`, or its parent object to
+`cloud_armor_extra_uninspected_field_prefixes`. Both add to the module
+defaults. The rate limits apply to every request.
 
 ### `l7-ingress`
 
```

**File**: `deployment/terraform/modules/gcp/cloud-armor/main.tf` (modified, +81/-6)
```diff
@@ -12,7 +12,7 @@
 #   1000+  blocked ranges               deny(403)
 #   2000   outside the allowlist        deny(403)
 #   2100+  blocked countries            deny(403)
-#   3000+  preconfigured WAF rules      deny(403), except the license upload
+#   3000+  preconfigured WAF rules      deny(403), tuned for Onyx traffic
 #   4000+  rate limit exempt ranges     allow, so they skip both limits
 #   5000   API path rate limit          throttle, deny(429)
 #   5100   global rate limit            throttle, deny(429)
@@ -29,10 +29,57 @@ locals {
 
   waf_rule_keys = sort(keys(var.preconfigured_rules))
 
-  # The WAF rules skip this path and the rate limits still count it. The body
-  # is a signed license in a multipart form, which the protocol attack
-  # signatures deny, and Onyx accepts it from an admin only.
-  license_upload_path = "/api/license/upload"
+  # Rule sets left untuned, because nothing Onyx sends trips them. The rest
+  # read field values, and an Onyx field value is often code, a URL or a secret.
+  untuned_rule_sets = ["methodenforcement", "scannerdetection", "sessionfixation"]
+
+  # The standard WAF tuning: a signature keeps running but does not read the
+  # value of a named field. These are the Onyx fields that hold chat text,
+  # prompts, code, URLs and secrets, which the signatures match at any
+  # sensitivity. A field missing here shows up as a 403 and a load balancer
+  # log line naming the signature.
+  default_uninspected_fields = [
+    # chat and prompts
+    "message", "query", "user_query", "prompt", "system_prompt", "task_prompt",
+    "instructions", "instructions_markdown", "description", "content", "text",
+    "answer", "feedback_text", "reason", "summary", "title", "name", "match_pattern",
+    # code and errors
+    "code", "reasoning_content", "error_message",
+    # URLs, which the remote file inclusion signatures match on an address
+    "api_base", "base_url", "server_url", "url", "api_url",
+    # secrets, whose random symbols the injection signatures match
+    "password", "api_key", "client_secret", "access_token", "bot_token",
+    "app_token", "user_token", "token", "api_secret",
+    # the Google sign-in callback carries userinfo.profile here
+    "scope",
+  ]
+
+  # A nested JSON key is reached only through the key it sits under, so whole
+  # free-form objects are named by prefix.
+  default_uninspected_field_prefixes = [
+    "connector_specific_config", "credential_json", "definition", "custom_config",
+    "new_custom_config", "existing_custom_config", "connection_headers", "config", "environment",
+  ]
+
+  # The names cover query string and body parameters, and the top-level keys
+  # of a JSON body.
+  uninspected_params = concat(
+    [for f in concat(local.default_uninspected_fields, var.extra_uninspected_fields) : { operator = "EQUALS", value = f }],
+    [for f in concat(local.default_uninspected_field_prefixes, var.extra_uninspected_field_prefixes) : { operator = "STARTS_WITH", value = f }],
+  )
+
+  # Cloud Armor does not parse a multipart body. It reads the file content as
+  # parameter names, which no exclusion covers, so the content rule sets skip
+  # an upload. The method check keeps the header from exempting a GET.
+  multipart_guard = "!(request.method.matches('POST|PUT|PATCH') && request.headers['content-type'].lower().startsWith('multipart/form-data')) && "
+
+  # One exclusion per content rule set, for every signature in it.
+  waf_exclusions = {
+    for k in local.waf_rule_keys : k => contains(local.untuned_rule_sets, k) ? [] : [{
+      rule_set     = "${k}-${var.crs_version}-stable"
+      query_params = local.uninspected_params
+    }]
+  }
 
   waf_expressions = {
     for k, r in var.preconfigured_rules : k => format(
@@ -54,6 +101,7 @@ locals {
       src_ip_ranges = chunk
       expression    = null
       rate_limit    = null
+      exclusions    = []
     }],
     length(var.allowed_ip_cidrs) > 0 ? [{
       priority      = 2000
@@ -63,6 +111,7 @@ locals {
       src_ip_ranges = null
       expression    = "!(${join(" || ", [for c in var.allowed_ip_cidrs : "inIpRange(origin.ip, '${c}')"])})"
       rate_limit    = null
+      exclusions    = []
     }] : [],
     [for i, chunk in local.country_chunks : {
       priority      = 2100 + i
@@ -72,15 +121,17 @@ locals {
       src_ip_ranges = null
       expression    = join(" || ", [for c in chunk : "origin.region_code == '${c}'"])
       rate_limit    = null
+      exclusions    = []
     }],
     [for i, k in local.waf_rule_keys : {
       priority      = 3000 + i
       action        = "deny(403)"
       description   = "OWASP CRS ${k}"
       preview       = coalesce(var.preconfigured_rules[k].preview, var.preview)
       src_ip_ranges = null
-      expression    = "request.path != '${local.license_upload_path}' && ${local.waf_expressions[k]}"
+      expression    = "${contains(local.untuned_rule_sets, k) ? "" : local.multipart_guard}${local.waf_expressions[k]}"
       ra
```

**File**: `deployment/terraform/modules/gcp/cloud-armor/tests/cloud-armor.tftest.hcl` (modified, +108/-9)
```diff
@@ -76,32 +76,131 @@ run "defaults_enforce_the_owasp_rule_sets_at_sensitivity_one" {
     condition = one([
       for r in google_compute_security_policy.this.rule :
       one(r.match).expr[0].expression if r.description == "OWASP CRS sqli"
-    ]) == "request.path != '/api/license/upload' && evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})"
+    ]) == "!(request.method.matches('POST|PUT|PATCH') && request.headers['content-type'].lower().startsWith('multipart/form-data')) && evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})"
     error_message = "The SQLi rule should evaluate sqli-v33-stable at sensitivity 1."
   }
 }
 
-run "the_license_upload_skips_the_waf_rules_but_not_the_rate_limits" {
+run "content_rule_sets_skip_multipart_uploads_only" {
   command = plan
 
   assert {
     condition = alltrue([
       for r in google_compute_security_policy.this.rule :
-      startswith(one(r.match).expr[0].expression, "request.path != '/api/license/upload' && evaluatePreconfiguredWaf(")
-      if r.priority >= 3000 && r.priority < 4000
+      startswith(one(r.match).expr[0].expression, "!(request.method.matches('POST|PUT|PATCH') && request.headers['content-type'].lower().startsWith('multipart/form-data')) && evaluatePreconfiguredWaf(")
+      if startswith(r.description, "OWASP CRS ") && !contains(["methodenforcement", "scannerdetection", "sessionfixation"], trimprefix(r.description, "OWASP CRS "))
     ])
-    error_message = "Every WAF rule should leave the license upload alone, because its multipart body trips the protocol attack signatures."
+    error_message = "Rule sets that read field values should skip multipart uploads, whose file content Cloud Armor reads as parameter names."
+  }
+
+  assert {
+    condition = alltrue([
+      for r in google_compute_security_policy.this.rule :
+      startswith(one(r.match).expr[0].expression, "evaluatePreconfiguredWaf(")
+      if contains(["methodenforcement", "scannerdetection", "sessionfixation"], trimprefix(r.description, "OWASP CRS "))
+    ])
+    error_message = "The untuned rule sets should check every request."
+  }
+}
+
+run "content_rule_sets_do_not_read_the_free_text_fields" {
+  command = plan
+
+  assert {
+    condition = alltrue([
+      for r in google_compute_security_policy.this.rule :
+      length(one(r.preconfigured_waf_config).exclusion) == 1
+      && one(one(r.preconfigured_waf_config).exclusion).target_rule_set == "${trimprefix(r.description, "OWASP CRS ")}-v33-stable"
+      && one(one(r.preconfigured_waf_config).exclusion).target_rule_ids == null
+      && alltrue([for p in one(one(r.preconfigured_waf_config).exclusion).request_query_param : contains(["EQUALS", "STARTS_WITH"], p.operator)])
+      && length(one(one(r.preconfigured_waf_config).exclusion).request_query_param) > 30
+      if startswith(r.description, "OWASP CRS ") && !contains(["methodenforcement", "scannerdetection", "sessionfixation"], trimprefix(r.description, "OWASP CRS "))
+    ])
+    error_message = "Every content rule set should carry one exclusion for every signature, naming each uninspected field and prefix."
+  }
+
+  assert {
+    condition = alltrue([
+      for r in google_compute_security_policy.this.rule : length(r.preconfigured_waf_config) == 0
+      if !startswith(r.description, "OWASP CRS ") || contains(["methodenforcement", "scannerdetection", "sessionfixation"], trimprefix(r.description, "OWASP CRS "))
+    ])
+    error_message = "Only the content rule sets should carry exclusions."
+  }
+
+  assert {
+    condition = alltrue([
+      for f in [
+        { operator = "EQUALS", value = "message" },
+        { operator = "EQUALS", value = "password" },
+        { operator = "EQUALS", value = "api_base" },
+        { operator = "EQUALS", value = "scope" },
+        { operator = "EQUALS", value = "query" },
+        { operator = "STARTS_WITH", value = "connector_specific_config" },
+      ] :
+      contains(one([
+        for r in google_compute_security_policy.this.rule :
+        one(one(r.preconfigured_waf_config).exclusion).request_query_param if r.description == "OWASP CRS sqli"
+      ]), f)
+    ])
+    error_message = "The defaults should hold the fields measured to trip the signatures: chat text, passwords, URLs, the sign-in scope, search text, and the nested connector configuration."
+  }
+}
+
+run "extra_fields_join_the_defaults" {
+  command = plan
+
+  variables {
+    extra_uninspected_fields         = ["comment"]
+    extra_uninspected_field_prefixes = ["custom_config"]
+  }
+
+  assert {
+    condition = alltrue([
+      for r in google_compute_security_policy.this.rule :
+      contains(one(one(r.preconfigured_waf_config).exclusion).request_query_param, { operator = "EQUALS", value = "comment" })
+      && contains(one(one(r.preconfigured_waf_config).exclusion).request_query_param, { operator = "STARTS_WITH", value = "custom_config" })
+      && contains(one(one(r.preconfigured_waf_config).exclusion).request_q
```

**File**: `deployment/terraform/modules/gcp/cloud-armor/variables.tf` (modified, +22/-0)
```diff
@@ -121,6 +121,28 @@ variable "sensitivity" {
   }
 }
 
+variable "extra_uninspected_fields" {
+  type        = list(string)
+  description = "Request parameter and JSON body field names whose values the content WAF rule sets do not read, on top of the module default list of Onyx fields that carry free text, URLs and secrets. Add a field when the load balancer log shows a signature denying it."
+  default     = []
+
+  validation {
+    condition     = alltrue([for f in var.extra_uninspected_fields : can(regex("^[A-Za-z0-9_.-]+$", f))])
+    error_message = "Each uninspected field is a parameter name: letters, digits, _ . and - only."
+  }
+}
+
+variable "extra_uninspected_field_prefixes" {
+  type        = list(string)
+  description = "Prefixes of field names whose values the content WAF rule sets do not read, for whole free-form objects, on top of the module default list."
+  default     = []
+
+  validation {
+    condition     = alltrue([for f in var.extra_uninspected_field_prefixes : can(regex("^[A-Za-z0-9_.-]+$", f))])
+    error_message = "Each uninspected field prefix is the start of a parameter name: letters, digits, _ . and - only."
+  }
+}
+
 # The whole-policy equivalent of Azure Detection mode. IP and country rules
 # still enforce, because the caller listed those addresses on purpose.
 variable "preview" {
```

**File**: `deployment/terraform/modules/gcp/onyx/main.tf` (modified, +11/-9)
```diff
@@ -269,15 +269,17 @@ module "cloud_armor" {
   deletion_protection = local.deletion_protection.cloud_armor
   labels              = local.merged_labels
 
-  preview                     = var.cloud_armor_preview
-  sensitivity                 = var.cloud_armor_sensitivity
-  allowed_ip_cidrs            = var.cloud_armor_allowed_ip_cidrs
-  blocked_ip_cidrs            = var.cloud_armor_blocked_ip_cidrs
-  rate_limit_exempt_ip_cidrs  = var.cloud_armor_rate_limit_exempt_ip_cidrs
-  geo_restriction_countries   = var.cloud_armor_geo_restriction_countries
-  rate_limit_threshold        = var.cloud_armor_rate_limit_threshold
-  api_rate_limit_threshold    = var.cloud_armor_api_rate_limit_threshold
-  adaptive_protection_enabled = var.cloud_armor_adaptive_protection_enabled
+  preview                          = var.cloud_armor_preview
+  extra_uninspected_fields         = var.cloud_armor_extra_uninspected_fields
+  extra_uninspected_field_prefixes = var.cloud_armor_extra_uninspected_field_prefixes
+  sensitivity                      = var.cloud_armor_sensitivity
+  allowed_ip_cidrs                 = var.cloud_armor_allowed_ip_cidrs
+  blocked_ip_cidrs                 = var.cloud_armor_blocked_ip_cidrs
+  rate_limit_exempt_ip_cidrs       = var.cloud_armor_rate_limit_exempt_ip_cidrs
+  geo_restriction_countries        = var.cloud_armor_geo_restriction_countries
+  rate_limit_threshold             = var.cloud_armor_rate_limit_threshold
+  api_rate_limit_threshold         = var.cloud_armor_api_rate_limit_threshold
+  adaptive_protection_enabled      = var.cloud_armor_adaptive_protection_enabled
 }
 
 module "l7_ingress" {
```

**File**: `deployment/terraform/modules/gcp/onyx/variables.tf` (modified, +12/-0)
```diff
@@ -380,6 +380,18 @@ variable "enable_cloud_armor" {
   default     = true
 }
 
+variable "cloud_armor_extra_uninspected_fields" {
+  type        = list(string)
+  description = "Field names whose values the WAF content rule sets do not read, on top of the cloud-armor module default list of Onyx fields that carry free text, URLs and secrets. Add a field when the load balancer log shows a signature denying it."
+  default     = []
+}
+
+variable "cloud_armor_extra_uninspected_field_prefixes" {
+  type        = list(string)
+  description = "Prefixes of field names whose values the WAF content rule sets do not read, for whole free-form objects, on top of the cloud-armor module default list."
+  default     = []
+}
+
 variable "cloud_armor_preview" {
   type        = bool
   description = "Log what the WAF and rate limit rules match instead of acting on it"
```

---

### Incident Patch 5: `d91f1d45` (2026-10-05)
**Commit Message**: fix(llm): prompt caching behind gateways + head cache breakpoint (#15552)

**File**: `backend/onyx/llm/prompt_cache/providers/anthropic.py` (modified, +13/-5)
```diff
@@ -11,18 +11,26 @@
 def _add_anthropic_cache_control(
     messages: Sequence[ChatCompletionMessage],
 ) -> Sequence[ChatCompletionMessage]:
-    """Add cache_control parameter to messages for Anthropic caching.
+    """Add cache_control parameters to messages for Anthropic caching.
+
+    Anthropic allows up to 4 cache breakpoints. We mark the last cacheable
+    message (tail of the prefix) and, when there is more than one, the first
+    (usually the system prompt): the head breakpoint keeps the stable prefix
+    readable when history truncation moves the tail breakpoint.
 
     Args:
         messages: Messages to transform
 
     Returns:
         Messages with cache_control added
     """
-    last_message = messages[-1].model_copy(
-        update={"cache_control": {"type": "ephemeral"}}
-    )
-    return list(messages[:-1]) + [last_message]
+    result: list[ChatCompletionMessage] = list(messages)
+    result[-1] = result[-1].model_copy(update={"cache_control": {"type": "ephemeral"}})
+    if len(result) > 1:
+        result[0] = result[0].model_copy(
+            update={"cache_control": {"type": "ephemeral"}}
+        )
+    return result
 
 
 class AnthropicPromptCacheProvider(PromptCacheProvider):
```

**File**: `backend/onyx/llm/prompt_cache/providers/factory.py` (modified, +42/-1)
```diff
@@ -1,8 +1,10 @@
 """Factory for creating provider-specific prompt cache adapters."""
 
 import logging
+import re
 
-from onyx.llm.constants import LlmProviderNames
+from onyx.llm.api_surfaces import LlmApiSurface, resolve_api_surface
+from onyx.llm.constants import AGGREGATOR_PROVIDERS, LlmProviderNames
 from onyx.llm.interfaces import LLMConfig
 from onyx.llm.prompt_cache.providers.anthropic import AnthropicPromptCacheProvider
 from onyx.llm.prompt_cache.providers.base import PromptCacheProvider
@@ -21,6 +23,39 @@
 OPENROUTER_OPENAI_PREFIX = "openai/"
 
 
+def _adapter_for_aggregator(llm_config: LLMConfig) -> PromptCacheProvider:
+    """Pick a cache adapter for an aggregator/gateway by surface + model name.
+
+    Gateways forward message-level ``cache_control`` to Anthropic upstreams
+    (LiteLLM, Bifrost, and Portkey all translate it on their chat-completions
+    surface). Non-Anthropic upstreams rely on implicit caching, which needs no
+    message mutation, so they fall through to no-op.
+    """
+    if (
+        resolve_api_surface(llm_config.model_provider, llm_config.custom_config)
+        == LlmApiSurface.ANTHROPIC_MESSAGES
+    ):
+        return AnthropicPromptCacheProvider()
+    # Match on name segments only ("anthropic/claude-sonnet", "claude-sonnet-4-5"),
+    # so an unrelated deployment that merely contains the substring
+    # ("claudio-fast", "myanthropic-proxy") is not misclassified.
+    model_name: str = (llm_config.model_name or "").lower()
+    segments: frozenset[str] = frozenset(re.split(r"[/._\-\s]+", model_name))
+    if "anthropic" in segments or "claude" in segments:
+        logger.debug(
+            "Prompt caching enabled for gateway Anthropic model: %s (provider=%s)",
+            llm_config.model_name,
+            llm_config.model_provider,
+        )
+        return AnthropicPromptCacheProvider()
+    logger.debug(
+        "Prompt caching not supported for gateway model: %s (provider=%s)",
+        llm_config.model_name,
+        llm_config.model_provider,
+    )
+    return NoOpPromptCacheProvider()
+
+
 def get_provider_adapter(llm_config: LLMConfig) -> PromptCacheProvider:
     """Get the appropriate prompt cache provider adapter for a given provider.
 
@@ -68,6 +103,12 @@ def get_provider_adapter(llm_config: LLMConfig) -> PromptCacheProvider:
                 "Prompt caching not supported for OpenRouter model: %s", model_name
             )
             return NoOpPromptCacheProvider()
+    elif llm_config.model_provider in AGGREGATOR_PROVIDERS:
+        # Aggregators/gateways can serve any upstream model, so the adapter is
+        # picked from the API surface and the model name. Providers with their
+        # own handling (openrouter, bedrock+anthropic, vertex) are matched
+        # above and never reach this branch.
+        return _adapter_for_aggregator(llm_config)
     else:
         # Default to no-op for providers without caching support
         return NoOpPromptCacheProvider()
```

**File**: `backend/tests/unit/onyx/llm/prompt_cache/test_cache_provider_factory.py` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+from __future__ import annotations
+
+from unittest.mock import patch
+
+from onyx.llm.interfaces import LLMConfig
+from onyx.llm.model_request import ChatCompletionMessage, SystemMessage, UserMessage
+from onyx.llm.prompt_cache import processor as processor_module
+from onyx.llm.prompt_cache.processor import process_with_prompt_cache
+from onyx.llm.prompt_cache.providers.anthropic import AnthropicPromptCacheProvider
+from onyx.llm.prompt_cache.providers.base import PromptCacheProvider
+from onyx.llm.prompt_cache.providers.factory import get_provider_adapter
+from onyx.llm.prompt_cache.providers.noop import NoOpPromptCacheProvider
+from onyx.llm.prompt_cache.providers.openai import OpenAIPromptCacheProvider
+
+
+def _config(
+    provider: str,
+    model_name: str,
+    custom_config: dict[str, str] | None = None,
+) -> LLMConfig:
+    return LLMConfig(
+        model_provider=provider,
+        model_name=model_name,
+        temperature=0,
+        max_input_tokens=200_000,
+        custom_config=custom_config,
+    )
+
+
+def test_gateway_anthropic_model_gets_anthropic_adapter() -> None:
+    for provider in ("litellm_proxy", "bifrost", "openai_compatible", "portkey"):
+        adapter: PromptCacheProvider = get_provider_adapter(
+            _config(provider, "claude-sonnet-5")
+        )
+        assert isinstance(adapter, AnthropicPromptCacheProvider), provider
+
+
+def test_gateway_prefixed_anthropic_model_gets_anthropic_adapter() -> None:
+    adapter: PromptCacheProvider = get_provider_adapter(
+        _config("bifrost", "anthropic/claude-sonnet-4-5")
+    )
+    assert isinstance(adapter, AnthropicPromptCacheProvider)
+
+
+def test_portkey_messages_surface_gets_anthropic_adapter() -> None:
+    adapter: PromptCacheProvider = get_provider_adapter(
+        _config("portkey", "any-model", custom_config={"portkey_api_mode": "messages"})
+    )
+    assert isinstance(adapter, AnthropicPromptCacheProvider)
+
+
+def test_gateway_non_anthropic_model_stays_noop() -> None:
+    for provider in ("litellm_proxy", "bifrost", "openai_compatible", "portkey"):
+        adapter: PromptCacheProvider = get_provider_adapter(
+            _config(provider, "gpt-5-mini")
+        )
+        assert isinstance(adapter, NoOpPromptCacheProvider), provider
+
+
+def test_gateway_unknown_model_stays_noop() -> None:
+    adapter: PromptCacheProvider = get_provider_adapter(
+        _config("litellm_proxy", "my-deployment")
+    )
+    assert isinstance(adapter, NoOpPromptCacheProvider)
+
+
+def test_gateway_substring_lookalikes_stay_noop() -> None:
+    for name in ("claudio-fast", "myanthropic-proxy", "declauded-v1"):
+        adapter: PromptCacheProvider = get_provider_adapter(
+            _config("litellm_proxy", name)
+        )
+        assert isinstance(adapter, NoOpPromptCacheProvider), name
+
+
+def test_direct_providers_unchanged() -> None:
+    assert isinstance(
+        get_provider_adapter(_config("openai", "gpt-5-mini")),
+        OpenAIPromptCacheProvider,
+    )
+    assert isinstance(
+        get_provider_adapter(_config("anthropic", "claude-sonnet-5")),
+        AnthropicPromptCacheProvider,
+    )
+    assert isinstance(
+        get_provider_adapter(_config("openrouter", "anthropic/claude-sonnet-5")),
+        AnthropicPromptCacheProvider,
+    )
+    assert isinstance(
+        get_provider_adapter(_config("openrouter", "openai/gpt-5-mini")),
+        OpenAIPromptCacheProvider,
+    )
+    assert isinstance(
+        get_provider_adapter(_config("ollama", "llama3")),
+        NoOpPromptCacheProvider,
+    )
+
+
+def test_anthropic_marks_head_and_tail_breakpoints() -> None:
+    prefix: list[ChatCompletionMessage] = [
+        SystemMessage(content="system prompt"),
+        UserMessage(content="earlier turn"),
+        UserMessage(content="latest cached turn"),
+    ]
+    suffix: list[ChatCompletionMessage] = [UserMessage(content="new request")]
+
+    with patch.object(processor_module, "ENABLE_PROMPT_CACHING", True):
+        processed, _ = process_with_prompt_cache(
+            llm_config=_config("anthropic", "claude-sonnet-5"),
+            cacheable_prefix=prefix,
+            suffix=suffix,
+            continuation=False,
+            with_metadata=False,
+        )
+
+    assert processed[0].cache_control == {"type": "ephemeral"}
+    assert processed[1].cache_control is None
+    assert processed[2].cache_control == {"type": "ephemeral"}
+    assert processed[3].cache_control is None
+
+
+def test_anthropic_single_message_prefix_marks_one_breakpoint() -> None:
+    prefix: list[ChatCompletionMessage] = [SystemMessage(content="system prompt")]
+    suffix: list[ChatCompletionMessage] = [UserMessage(content="new request")]
+
+    with patch.object(processor_module, "ENABLE_PROMPT_CACHING", True):
+        processed, _ = process_with_prompt_cache(
+            llm_config=_config("anthropic", "claude-sonnet-5"),
+            cacheable_prefix=prefix,
+            suffix=suffix
```

---

### Incident Patch 6: `268e4d5a` (2026-10-05)
**Commit Message**: fix(tools): keep custom-tool file results and empty search selections intact (#15495)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/onyx/chat/llm_loop.py` (modified, +3/-1)
```diff
@@ -1368,7 +1368,9 @@ def run_llm_loop(
                     reasoning_tokens=llm_step_result.reasoning,  # All tool calls from this loop share the same reasoning
                     tool_call_arguments=tool_call.tool_args,
                     tool_call_response=saved_response,
-                    search_docs=displayed_docs or search_docs,
+                    search_docs=(
+                        displayed_docs if displayed_docs is not None else search_docs
+                    ),
                     generated_images=generated_images,
                     generated_files=generated_files,
                     generated_file_ids=generated_file_ids,
```

**File**: `backend/onyx/context/search/models.py` (modified, +1/-10)
```diff
@@ -446,18 +446,9 @@ class SearchDocsResponse(BaseModel):
     # document id is  the most staightforward way.
     citation_mapping: dict[int, str]
 
-    # For cases where the frontend only needs to display a subset of the search docs
-    # The whole list is typically still needed for later steps but this set should be saved separately
+    # None uses all retrieved documents; an empty list selects no documents.
     displayed_docs: list[SearchDoc] | None = None
 
-    @field_validator("displayed_docs", mode="before")
-    @classmethod
-    def normalize_empty_displayed_docs(
-        cls,
-        value: list[SearchDoc] | None,
-    ) -> list[SearchDoc] | None:
-        return value or None
-
 
 class SavedSearchDoc(SearchDoc):
     db_doc_id: int
```

**File**: `backend/onyx/tools/fake_tools/research_agent.py` (modified, +5/-1)
```diff
@@ -602,7 +602,11 @@ def run_research_agent_call(
                             or most_recent_reasoning,
                             tool_call_arguments=tc.tool_args,
                             tool_call_response=tool_response.llm_facing_response,
-                            search_docs=displayed_docs or search_docs,
+                            search_docs=(
+                                displayed_docs
+                                if displayed_docs is not None
+                                else search_docs
+                            ),
                             generated_images=None,
                         )
                         state_container.add_tool_call(tool_call_info)
```

**File**: `backend/onyx/tools/models.py` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@
 from typing import Any, Callable, Literal
 from uuid import UUID
 
-from pydantic import BaseModel, ConfigDict, model_validator
+from pydantic import BaseModel, ConfigDict, JsonValue, model_validator
 
 from onyx.chat.emitter import Emitter
 from onyx.configs.chat_configs import MAX_CHUNKS_FED_TO_CHAT, NUM_RETURNED_HITS
@@ -61,7 +61,7 @@ class CustomToolUserFileSnapshot(BaseModel):
 class CustomToolCallSummary(BaseModel):
     tool_name: str
     response_type: str  # e.g., 'json', 'image', 'csv', 'graph'
-    tool_result: Any  # The response data
+    tool_result: CustomToolUserFileSnapshot | JsonValue
     error: CustomToolErrorInfo | None = None
 
 
```

**File**: `backend/onyx/tools/tool_implementations/custom/custom_tool.py` (modified, +8/-3)
```diff
@@ -6,6 +6,7 @@
 from typing import Any, Dict, List
 
 import requests
+from pydantic import JsonValue, TypeAdapter
 from requests import JSONDecodeError
 
 from onyx.chat.emitter import Emitter
@@ -210,7 +211,7 @@ def run(
                 response.status_code,
             )
 
-        tool_result: Any
+        tool_result: CustomToolUserFileSnapshot | JsonValue
         response_type: str
         file_ids: List[str] | None = None
         data: dict | list | str | int | float | bool | None = None
@@ -231,7 +232,7 @@ def run(
 
         else:
             try:
-                tool_result = response.json()
+                tool_result = TypeAdapter(JsonValue).validate_python(response.json())
                 response_type = "json"
                 data = tool_result
             except JSONDecodeError:
@@ -261,7 +262,11 @@ def run(
             )
         )
 
-        llm_facing_response = json.dumps(tool_result)
+        llm_facing_response = (
+            TypeAdapter(CustomToolUserFileSnapshot | JsonValue)
+            .dump_json(tool_result)
+            .decode()
+        )
 
         return ToolResponse(
             rich_response=CustomToolCallSummary(
```

**File**: `backend/tests/external_dependency_unit/tools/test_mcp_passthrough_oauth.py` (modified, +3/-1)
```diff
@@ -388,7 +388,9 @@ def mock_call_mcp_tool(
             print(response.rich_response)
             assert isinstance(response.rich_response, CustomToolCallSummary)
             print(response.rich_response.tool_result)
-            assert response.rich_response.tool_result["tool_result"] == mocked_response
+            assert response.rich_response.tool_result == {
+                "tool_result": mocked_response
+            }
 
         # Verify Authorization header was set with the user's OAuth token
         assert "Authorization" in captured_headers
```

**File**: `backend/tests/unit/onyx/chat/test_llm_loop.py` (modified, +97/-2)
```diff
@@ -25,14 +25,15 @@
     LlmStepResult,
     ToolCallSimple,
 )
-from onyx.configs.constants import MessageType
+from onyx.configs.constants import DocumentSource, MessageType
+from onyx.context.search.models import SearchDoc, SearchDocsResponse
 from onyx.file_store.models import ChatFileType
 from onyx.llm.interfaces import LLMConfig
 from onyx.llm.models import ToolChoiceOptions
 from onyx.prompts.chat_prompts import IMAGE_GEN_REMINDER, OPEN_URL_REMINDER
 from onyx.server.query_and_chat.placement import Placement
 from onyx.tools.constants import FILE_READER_TOOL_NAME
-from onyx.tools.models import ToolCallKickoff
+from onyx.tools.models import ParallelToolCallResponse, ToolCallKickoff, ToolResponse
 from onyx.tools.tool_implementations.search.search_tool import SearchTool
 
 
@@ -1724,3 +1725,97 @@ def test_image_gen_reminder_takes_precedence(self) -> None:
             ran_image_gen=True, just_ran_web_search=True, has_open_url_tool=True
         )
         assert result == IMAGE_GEN_REMINDER
+
+
+@pytest.mark.parametrize("select_none", [False, True])
+def test_saved_search_docs_follow_the_search_selection(select_none: bool) -> None:
+    doc = SearchDoc(
+        document_id="retrieved",
+        chunk_ind=0,
+        semantic_identifier="Retrieved document",
+        blurb="content",
+        source_type=DocumentSource.FILE,
+        boost=1,
+        hidden=False,
+        metadata={},
+        match_highlights=[],
+    )
+    tool_call = ToolCallKickoff(
+        tool_call_id="search-1",
+        tool_name=SearchTool.NAME,
+        tool_args={"queries": ["ticket"]},
+        placement=Placement(turn_index=0),
+    )
+    search_tool = Mock()
+    search_tool.name = SearchTool.NAME
+    search_tool.id = 1
+    llm = Mock()
+    llm.config = LLMConfig(
+        model_provider="openai",
+        model_name="gpt-5.2",
+        temperature=0,
+        max_input_tokens=100000,
+    )
+    state_container = Mock()
+    with (
+        patch("onyx.chat.llm_loop.trace", return_value=nullcontext()),
+        patch("onyx.llm.litellm_singleton.config.initialize_litellm"),
+        patch(
+            "onyx.chat.llm_loop.get_session_with_current_tenant",
+            return_value=nullcontext(),
+        ),
+        patch("onyx.chat.llm_loop.get_default_base_system_prompt", return_value=""),
+        patch("onyx.chat.llm_loop.select_reminder_text", return_value=""),
+        patch("onyx.chat.llm_loop.compute_all_tool_tokens", return_value=0),
+        patch(
+            "onyx.chat.llm_loop.run_llm_step",
+            side_effect=[
+                (
+                    LlmStepResult(answer=None, tool_calls=[tool_call], reasoning=None),
+                    False,
+                ),
+                (
+                    LlmStepResult(answer="Done", tool_calls=None, reasoning=None),
+                    False,
+                ),
+            ],
+        ),
+        patch(
+            "onyx.chat.llm_loop.run_tool_calls",
+            side_effect=[
+                ParallelToolCallResponse(
+                    tool_responses=[
+                        ToolResponse(
+                            rich_response=SearchDocsResponse(
+                                search_docs=[doc],
+                                citation_mapping={},
+                                displayed_docs=[] if select_none else None,
+                            ),
+                            llm_facing_response="",
+                            tool_call=tool_call,
+                        )
+                    ],
+                    updated_citation_mapping={},
+                ),
+                ParallelToolCallResponse(
+                    tool_responses=[], updated_citation_mapping={}
+                ),
+            ],
+        ),
+    ):
+        run_llm_loop(
+            emitter=Mock(),
+            state_container=state_container,
+            simple_chat_history=[create_message("Find it", MessageType.USER, 5)],
+            tools=[search_tool],
+            custom_agent_prompt=None,
+            context_files=create_context_files(),
+            persona=None,
+            user_memory_context=None,
+            llm=llm,
+            token_counter=lambda _: 10,
+        )
+
+    state_container.add_tool_call.assert_called_once()
+    saved_call = state_container.add_tool_call.call_args.args[0]
+    assert saved_call.search_docs == ([] if select_none else [doc])
```

**File**: `backend/tests/unit/onyx/tools/custom/test_custom_tools.py` (modified, +46/-0)
```diff
@@ -488,5 +488,51 @@ def test_duplicate_operation_id_raises(self) -> None:
             openapi_to_method_specs(schema)
 
 
+@pytest.mark.parametrize(
+    ("content_type", "response_type"),
+    [("text/csv", "csv"), ("image/png", "image")],
+)
+def test_custom_tool_file_response_is_serialized_for_llm(
+    content_type: str, response_type: str
+) -> None:
+    tools = build_custom_tools_from_openapi_schema_and_headers(
+        tool_id=1,
+        openapi_schema={
+            "openapi": "3.0.0",
+            "info": {"title": "Files", "version": "1.0.0"},
+            "servers": [{"url": "https://example.com"}],
+            "paths": {
+                "/file": {
+                    "get": {
+                        "operationId": "getFile",
+                        "summary": "Get a file",
+                        "responses": {},
+                    }
+                }
+            },
+        },
+    )
+    mock_response = unittest.mock.MagicMock()
+    mock_response.status_code = 200
+    mock_response.headers = {"Content-Type": content_type}
+    mock_response.content = b"file-bytes"
+    with (
+        patch(
+            "onyx.tools.tool_implementations.custom.custom_tool.requests.request",
+            return_value=mock_response,
+        ),
+        patch.object(
+            type(tools[0]),
+            "_save_and_get_file_references",
+            return_value=["file-1"],
+        ),
+    ):
+        result = tools[0].run(placement=Placement(turn_index=0, tab_index=0))
+
+    assert isinstance(result.rich_response, CustomToolCallSummary)
+    assert result.rich_response.response_type == response_type
+    assert result.llm_facing_response == '{"file_ids":["file-1"]}'
+
+
 if __name__ == "__main__":
     pytest.main([__file__])
```

---

### Incident Patch 7: `a8b2fd4f` (2026-10-05)
**Commit Message**: fix(terraform): let the license upload through the GCP Cloud Armor policy (#15540)

**File**: `deployment/terraform/modules/gcp/README.md` (modified, +3/-1)
```diff
@@ -285,7 +285,9 @@ object access and the narrow read that Onyx needs at startup.
 
 A backend security policy with the OWASP Core Rule Set at sensitivity 1, an API
 rate limit, a global rate limit and Adaptive Protection. It takes effect only on
-an L7 load balancer; see below.
+an L7 load balancer; see below. The WAF rules skip `/api/license/upload`,
+because its multipart body trips the protocol attack signatures. The rate
+limits still apply to it.
 
 ### `l7-ingress`
 
```

**File**: `deployment/terraform/modules/gcp/cloud-armor/main.tf` (modified, +7/-2)
```diff
@@ -12,7 +12,7 @@
 #   1000+  blocked ranges               deny(403)
 #   2000   outside the allowlist        deny(403)
 #   2100+  blocked countries            deny(403)
-#   3000+  preconfigured WAF rules      deny(403)
+#   3000+  preconfigured WAF rules      deny(403), except the license upload
 #   4000+  rate limit exempt ranges     allow, so they skip both limits
 #   5000   API path rate limit          throttle, deny(429)
 #   5100   global rate limit            throttle, deny(429)
@@ -29,6 +29,11 @@ locals {
 
   waf_rule_keys = sort(keys(var.preconfigured_rules))
 
+  # The WAF rules skip this path and the rate limits still count it. The body
+  # is a signed license in a multipart form, which the protocol attack
+  # signatures deny, and Onyx accepts it from an admin only.
+  license_upload_path = "/api/license/upload"
+
   waf_expressions = {
     for k, r in var.preconfigured_rules : k => format(
       "evaluatePreconfiguredWaf('%s-%s-stable', {'sensitivity': %d%s})",
@@ -74,7 +79,7 @@ locals {
       description   = "OWASP CRS ${k}"
       preview       = coalesce(var.preconfigured_rules[k].preview, var.preview)
       src_ip_ranges = null
-      expression    = local.waf_expressions[k]
+      expression    = "request.path != '${local.license_upload_path}' && ${local.waf_expressions[k]}"
       rate_limit    = null
     }],
     [for i, chunk in local.exempt_chunks : {
```

**File**: `deployment/terraform/modules/gcp/cloud-armor/tests/cloud-armor.tftest.hcl` (modified, +23/-2)
```diff
@@ -76,11 +76,32 @@ run "defaults_enforce_the_owasp_rule_sets_at_sensitivity_one" {
     condition = one([
       for r in google_compute_security_policy.this.rule :
       one(r.match).expr[0].expression if r.description == "OWASP CRS sqli"
-    ]) == "evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})"
+    ]) == "request.path != '/api/license/upload' && evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})"
     error_message = "The SQLi rule should evaluate sqli-v33-stable at sensitivity 1."
   }
 }
 
+run "the_license_upload_skips_the_waf_rules_but_not_the_rate_limits" {
+  command = plan
+
+  assert {
+    condition = alltrue([
+      for r in google_compute_security_policy.this.rule :
+      startswith(one(r.match).expr[0].expression, "request.path != '/api/license/upload' && evaluatePreconfiguredWaf(")
+      if r.priority >= 3000 && r.priority < 4000
+    ])
+    error_message = "Every WAF rule should leave the license upload alone, because its multipart body trips the protocol attack signatures."
+  }
+
+  assert {
+    condition = one([
+      for r in google_compute_security_policy.this.rule :
+      one(r.match).expr[0].expression if r.priority == 5000
+    ]) == "request.path.startsWith('/api')"
+    error_message = "The API rate limit should still count the license upload."
+  }
+}
+
 run "rate_limits_mirror_the_aws_defaults" {
   command = plan
 
@@ -239,7 +260,7 @@ run "per_rule_settings_override_the_module_wide_ones" {
   assert {
     condition = one([
       for r in google_compute_security_policy.this.rule : one(r.match).expr[0].expression if r.description == "OWASP CRS sqli"
-    ]) == "evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 2, 'opt_out_rule_ids': ['owasp-crs-v030301-id942421-sqli', 'owasp-crs-v030301-id942432-sqli']})"
+    ]) == "request.path != '/api/license/upload' && evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 2, 'opt_out_rule_ids': ['owasp-crs-v030301-id942421-sqli', 'owasp-crs-v030301-id942432-sqli']})"
     error_message = "The SQLi rule should carry its own sensitivity and opt-outs."
   }
 
```

---

### Incident Patch 8: `23faf7cc` (2026-10-05)
**Commit Message**: fix(auth): preserve login session identity across JWT refresh (#15536)

**File**: `backend/onyx/auth/users.py` (modified, +32/-7)
```diff
@@ -1858,11 +1858,30 @@ def __init__(
             public_key=public_key,
         )
 
-    async def write_token(self, user: User) -> str:
-        data = {
+    def get_session_id(self, token: str, user: User) -> str | None:
+        try:
+            data = decode_jwt(
+                token,
+                self.decode_key,
+                self.token_audience,
+                algorithms=[self.algorithm],
+            )
+        except jwt.PyJWTError:
+            return None
+        if data.get("sub") != str(user.id):
+            return None
+
+        sid = data.get("sid")
+        if isinstance(sid, str) and sid:
+            return sid
+        return hashlib.sha256(token.encode("utf-8")).hexdigest()
+
+    async def write_token(self, user: User, session_id: str | None = None) -> str:
+        data: dict[str, Any] = {
             "sub": str(user.id),
             "aud": self.token_audience,
             "iat": int(datetime.now(timezone.utc).timestamp()),
+            "sid": session_id or secrets.token_urlsafe(32),
         }
         return generate_jwt(
             data, self.encode_key, self.lifetime_seconds, algorithm=self.algorithm
@@ -1879,11 +1898,12 @@ async def destroy_token(self, token: str, user: User) -> None:  # noqa: ARG002
 
     async def refresh_token(
         self,
-        token: Optional[str],  # noqa: ARG002
-        user: User,  # noqa: ARG002
+        token: Optional[str],
+        user: User,
     ) -> str:
         """Issue a fresh JWT with a new expiry."""
-        return await self.write_token(user)
+        session_id = self.get_session_id(token, user) if token else None
+        return await self.write_token(user, session_id)
 
 
 def get_redis_strategy() -> TenantAwareRedisStrategy:
@@ -2032,7 +2052,9 @@ async def refresh(
 # take care of that in `double_check_user` ourself. This is needed, since
 # we want the /me endpoint to still return a user even if they are not
 # yet verified, so that the frontend knows they exist
-optional_fastapi_current_user = fastapi_users.current_user(active=True, optional=True)
+optional_fastapi_current_user = fastapi_users.authenticator.current_user_token(
+    active=True, optional=True
+)
 
 
 _JWT_EMAIL_CLAIM_KEYS = ("email", "preferred_username", "upn")
@@ -2291,9 +2313,12 @@ async def _resolve_optional_user(
 async def optional_user(
     request: Request,
     async_db_session: AsyncSession = Depends(get_async_session),
-    user: User | None = Depends(optional_fastapi_current_user),
+    user_token: tuple[User | None, str | None] = Depends(optional_fastapi_current_user),
     user_manager: BaseUserManager[User, uuid.UUID] = Depends(get_user_manager),
 ) -> AsyncGenerator[User | None, None]:
+    user, token = user_token
+    if user is not None and token is not None:
+        request.state.authenticated_session_token = token
     user = await _resolve_optional_user(
         request,
         async_db_session,
```

**File**: `backend/tests/external_dependency_unit/auth/test_streaming_releases_auth_connection.py` (modified, +2/-2)
```diff
@@ -64,9 +64,9 @@ class _FakeUser:
     # session so the auth read transaction opens exactly as in production.
     async def fake_auth(
         session: AsyncSession = Depends(get_async_session),
-    ) -> _FakeUser:
+    ) -> tuple[_FakeUser, str]:
         await session.execute(text("SELECT 1"))
-        return _FakeUser()
+        return (_FakeUser(), "session-token")
 
     app = FastAPI(lifespan=dispose_async_clients_lifespan)
     app.dependency_overrides[optional_fastapi_current_user] = fake_auth
```

**File**: `backend/tests/unit/onyx/auth/test_jwt_session_identity.py` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+import hashlib
+import uuid
+from datetime import datetime, timedelta, timezone, tzinfo
+from unittest.mock import AsyncMock, MagicMock
+
+import jwt
+import pytest
+from fastapi_users.jwt import generate_jwt
+
+from onyx.auth import users as users_module
+from onyx.auth.users import SingleTenantJWTStrategy
+
+_SECRET = "jwt-session-identity-test-secret-32-bytes"
+_OTHER_SECRET = "jwt-session-identity-other-secret-32-bytes"
+_AUDIENCE = ["fastapi-users:auth"]
+
+
+def _strategy(
+    *,
+    secret: str = _SECRET,
+    audience: list[str] | None = None,
+    lifetime_seconds: int | None = 3600,
+) -> SingleTenantJWTStrategy:
+    return SingleTenantJWTStrategy(
+        secret=secret,
+        lifetime_seconds=lifetime_seconds,
+        token_audience=audience or _AUDIENCE,
+    )
+
+
+def _user(user_id: uuid.UUID | None = None) -> MagicMock:
+    user = MagicMock()
+    user.id = user_id or uuid.uuid4()
+    user.email = "jwt-session@example.com"
+    return user
+
+
+def _manager(user: MagicMock) -> MagicMock:
+    manager = MagicMock()
+    manager.parse_id = MagicMock(return_value=user.id)
+    manager.get = AsyncMock(return_value=user)
+    return manager
+
+
+def _decode(token: str, *, audience: list[str] | None = None) -> dict[str, object]:
+    return jwt.decode(
+        token,
+        _SECRET,
+        algorithms=["HS256"],
+        audience=audience or _AUDIENCE,
+    )
+
+
+def _token_with_claims(
+    *,
+    user_id: uuid.UUID,
+    secret: str = _SECRET,
+    audience: list[str] | None = None,
+    lifetime_seconds: int | None = 3600,
+    sid: str | None = "attacker-controlled-session",
+) -> str:
+    data: dict[str, object] = {
+        "sub": str(user_id),
+        "aud": audience or _AUDIENCE,
+        "iat": int(datetime.now(timezone.utc).timestamp()),
+    }
+    if sid is not None:
+        data["sid"] = sid
+    return generate_jwt(data, secret, lifetime_seconds, algorithm="HS256")
+
+
+@pytest.mark.asyncio
+async def test_write_token_adds_unique_session_id_even_in_same_second(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    frozen = datetime.now(timezone.utc)
+
+    class _FrozenDatetime(datetime):
+        @classmethod
+        def now(cls, tz: tzinfo | None = None) -> "_FrozenDatetime":  # noqa: ARG003
+            return cls.fromtimestamp(frozen.timestamp(), tz=timezone.utc)
+
+    monkeypatch.setattr(users_module, "datetime", _FrozenDatetime)
+    strategy = _strategy()
+    user = _user()
+
+    first = await strategy.write_token(user)
+    second = await strategy.write_token(user)
+
+    first_payload = _decode(first)
+    second_payload = _decode(second)
+    assert first_payload["iat"] == second_payload["iat"]
+    assert first_payload["sub"] == str(user.id)
+    assert second_payload["sub"] == str(user.id)
+    assert isinstance(first_payload["sid"], str)
+    assert isinstance(second_payload["sid"], str)
+    assert first_payload["sid"] != second_payload["sid"]
+    assert strategy.get_session_id(first, user) != strategy.get_session_id(second, user)
+
+
+@pytest.mark.asyncio
+async def test_refresh_preserves_current_session_id() -> None:
+    strategy = _strategy()
+    user = _user()
+    token = await strategy.write_token(user)
+
+    refreshed = await strategy.refresh_token(token, user)
+
+    assert strategy.get_session_id(refreshed, user) == strategy.get_session_id(
+        token, user
+    )
+
+
+@pytest.mark.asyncio
+async def test_refresh_preserves_legacy_hash_session_id() -> None:
+    strategy = _strategy()
+    user = _user()
+    legacy = _token_with_claims(user_id=user.id, sid=None)
+
+    refreshed = await strategy.refresh_token(legacy, user)
+
+    expected = hashlib.sha256(legacy.encode("utf-8")).hexdigest()
+    assert strategy.get_session_id(legacy, user) == expected
+    assert strategy.get_session_id(refreshed, user) == expected
+
+
+@pytest.mark.asyncio
+async def test_invalid_refresh_token_mints_fresh_session_id() -> None:
+    strategy = _strategy()
+    user = _user()
+    attacker_token = _token_with_claims(user_id=user.id, secret=_OTHER_SECRET)
+
+    refreshed = await strategy.refresh_token(attacker_token, user)
+
+    assert strategy.get_session_id(refreshed, user) != "attacker-controlled-session"
+
+
+@pytest.mark.parametrize(
+    "token_kind",
+    ["wrong_signature", "wrong_audience", "wrong_subject", "expired"],
+)
+def test_invalid_token_cannot_supply_session_id(token_kind: str) -> None:
+    strategy = _strategy()
+    user = _user()
+    token_user_id = user.id
+    secret = _SECRET
+    audience = _AUDIENCE
+    lifetime_seconds: int | None = 3600
+
+    if token_kind == "wrong_signature":
+        secret = _OTHER_SECRET
+    elif token_kind == "wrong_audience":
+        audience = ["other-audience"]
+    elif token_kind == "wrong_subject":
+        token_user_id = uuid.uuid4()
+    elif token_kind == "expired":
+        lifetime_seconds = None
+
+    token = _token_with_claims(
+        user_id=token_user_id
```

**File**: `backend/tests/unit/onyx/auth/test_optional_user_releases_connection.py` (modified, +55/-5)
```diff
@@ -37,6 +37,56 @@ def _make_session(
     return session
 
 
+@pytest.mark.asyncio
+async def test_winning_session_token_is_stashed(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    resolved_user = MagicMock()
+    resolved_user.id = uuid.uuid4()
+    monkeypatch.setattr(
+        users_module,
+        "_resolve_optional_user",
+        AsyncMock(return_value=resolved_user),
+    )
+    request = _make_request()
+    session = _make_session()
+
+    gen = users_module.optional_user(
+        request,
+        async_db_session=session,
+        user_token=(resolved_user, "accepted-token"),
+        user_manager=MagicMock(),
+    )
+    try:
+        assert await anext(gen) is resolved_user
+        assert request.state.authenticated_session_token == "accepted-token"
+    finally:
+        await gen.aclose()
+
+
+@pytest.mark.asyncio
+async def test_rejected_candidate_token_is_not_stashed(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    monkeypatch.setattr(
+        users_module, "_resolve_optional_user", AsyncMock(return_value=None)
+    )
+    request = _make_request()
+    session = _make_session()
+
+    gen = users_module.optional_user(
+        request,
+        async_db_session=session,
+        user_token=(None, "rejected-token"),
+        user_manager=MagicMock(),
+    )
+    try:
+        assert await anext(gen) is None
+        assert not hasattr(request.state, "authenticated_session_token")
+    finally:
+        await gen.aclose()
+
+
 @pytest.mark.asyncio
 async def test_ends_clean_read_transaction_before_yield(
     monkeypatch: pytest.MonkeyPatch,
@@ -53,7 +103,7 @@ async def test_ends_clean_read_transaction_before_yield(
     gen = users_module.optional_user(
         _make_request(),
         async_db_session=session,
-        user=None,
+        user_token=(None, None),
         user_manager=MagicMock(),
     )
     try:
@@ -75,7 +125,7 @@ async def test_pending_writes_are_not_committed(
     gen = users_module.optional_user(
         _make_request(),
         async_db_session=session,
-        user=None,
+        user_token=(None, None),
         user_manager=MagicMock(),
     )
     try:
@@ -99,7 +149,7 @@ async def test_failed_transaction_is_not_committed(
     gen = users_module.optional_user(
         _make_request(),
         async_db_session=session,
-        user=None,
+        user_token=(None, None),
         user_manager=MagicMock(),
     )
     try:
@@ -126,7 +176,7 @@ async def test_commit_failure_does_not_break_auth(
     gen = users_module.optional_user(
         _make_request(),
         async_db_session=session,
-        user=None,
+        user_token=(None, None),
         user_manager=MagicMock(),
     )
     try:
@@ -148,7 +198,7 @@ async def test_no_transaction_means_no_commit(
     gen = users_module.optional_user(
         _make_request(),
         async_db_session=session,
-        user=None,
+        user_token=(None, None),
         user_manager=MagicMock(),
     )
     try:
```

**File**: `backend/tests/unit/onyx/auth/test_single_tenant_jwt_strategy.py` (modified, +4/-1)
```diff
@@ -98,7 +98,10 @@ async def test_read_token_returns_none_for_bad_signature() -> None:
     user = _make_user()
     manager = _make_user_manager(user)
 
-    bad_strategy = SingleTenantJWTStrategy(secret="wrong-secret", lifetime_seconds=3600)
+    bad_strategy = SingleTenantJWTStrategy(
+        secret="wrong-secret-for-jwt-unit-tests-32-bytes",
+        lifetime_seconds=3600,
+    )
     bad_token = await bad_strategy.write_token(user)
 
     result = await strategy.read_token(bad_token, manager)
```

**File**: `backend/tests/unit/shared_configs/test_user_id_contextvar.py` (modified, +4/-2)
```diff
@@ -48,8 +48,10 @@ def _authenticated_app(user_id: Any | None) -> FastAPI:
     class _FakeUser:
         id = user_id
 
-    async def fake_auth() -> _FakeUser | None:
-        return _FakeUser() if user_id is not None else None
+    async def fake_auth() -> tuple[_FakeUser | None, str | None]:
+        if user_id is None:
+            return (None, None)
+        return (_FakeUser(), "session-token")
 
     async def skip_oauth_refresh(*_: Any) -> None:
         return None
```

---

### Incident Patch 9: `26185be8` (2026-10-05)
**Commit Message**: fix(chat): scope stop requests to one stream (#15497)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `backend/onyx/chat/README.md` (modified, +2/-1)
```diff
@@ -214,7 +214,8 @@ the database. The state container can be added to by any of the underlying layer
 ### Stopping Generation
 
 The drain loop in `_run_models` checks `check_is_connected()` every 50 ms (on queue timeout). The signal itself
-is stored in Redis and is set by the user calling the stop endpoint. On disconnect, the drain loop saves
+is stored in the shared cache, keyed by session and stream ID, and is set by the user calling the stop endpoint.
+A late Stop request for an earlier stream cannot stop a later stream in the same session. On disconnect, the drain loop saves
 partial state for every model, yields an `OverallStop(stop_reason="user_cancelled")` packet, and returns.
 A `drain_done` event signals emitters to stop blocking so worker threads can exit quickly. Workers that
 already completed successfully will self-complete (persist their response) if the drain loop exited before
```

**File**: `backend/onyx/chat/chat_processing_checker.py` (modified, +11/-11)
```diff
@@ -27,43 +27,43 @@ def set_processing_status(
     chat_session_id: UUID,
     cache: CacheBackend,
     value: bool,
-    run_id: int | None = None,
+    stream_id: int | None = None,
 ) -> None:
     """Set or clear the fence for a chat session processing a message.
 
     If the key exists, a message is being processed. The fence value carries the
-    run id of the active stream buffer when known; 0 means unknown (legacy pods
-    or pre-reservation failures) and reads as "in flight, not resumable".
+    stream ID of the active stream buffer when known; 0 means unknown
+    (pre-reservation failures) and reads as "in flight, not resumable".
 
     Args:
         chat_session_id: The UUID of the chat session
         cache: Tenant-aware cache backend
         value: True to set the fence, False to clear it
-        run_id: Stream-buffer run id to expose to resume readers
+        stream_id: Stream-buffer stream ID to expose to resume readers
     """
     fence_key = _get_fence_key(chat_session_id)
     if value:
-        cache.set(fence_key, run_id if run_id is not None else 0, ex=FENCE_TTL)
+        cache.set(fence_key, stream_id if stream_id is not None else 0, ex=FENCE_TTL)
     else:
         cache.delete(fence_key)
 
 
-def get_processing_run_id(chat_session_id: UUID, cache: CacheBackend) -> int | None:
-    """Run id of the session's in-flight stream buffer, or None when idle or the
-    fence carries no run id."""
+def get_processing_stream_id(chat_session_id: UUID, cache: CacheBackend) -> int | None:
+    """Stream ID of the session's in-flight stream buffer, or None when idle or the
+    fence carries no stream ID."""
     raw = cache.get(_get_fence_key(chat_session_id))
     if raw is None:
         return None
     try:
-        run_id = int(raw.decode("utf-8") if isinstance(raw, bytes) else str(raw))
+        stream_id = int(raw.decode("utf-8") if isinstance(raw, bytes) else str(raw))
     except (TypeError, ValueError, UnicodeDecodeError):
         logger.warning(
-            "invalid processing run id for session %s: %r",
+            "invalid processing stream ID for session %s: %r",
             chat_session_id,
             raw,
         )
         return None
-    return run_id if run_id > 0 else None
+    return stream_id if stream_id > 0 else None
 
 
 def is_chat_session_processing(chat_session_id: UUID, cache: CacheBackend) -> bool:
```

**File**: `backend/onyx/chat/chat_state.py` (modified, +2/-2)
```diff
@@ -221,8 +221,8 @@ class ChatTurnSetup:
     simple_chat_history: list[ChatMessageSimple]
     extracted_context_files: ExtractedContextFiles
     reserved_messages: list[ChatMessage]  # length 1 for single, N for multi
-    # Processing-fence value and stream-buffer key — single source for the run id
-    processing_run_id: int
+    # Processing-fence value, stream-buffer key, and Stop-request key
+    processing_stream_id: int
     reserved_token_count: int
     reasoning_effort: ReasoningEffort
     search_params: SearchParams
```

**File**: `backend/onyx/chat/process_message.py` (modified, +10/-9)
```diff
@@ -66,8 +66,7 @@
 )
 from onyx.chat.prompt_utils import calculate_reserved_tokens
 from onyx.chat.save_chat import save_chat_turn
-from onyx.chat.stop_signal_checker import is_connected as check_stop_signal
-from onyx.chat.stop_signal_checker import reset_cancel_status
+from onyx.chat.stop_signal_checker import clear_stop, is_stop_requested
 from onyx.chat.stream_buffer import StreamBufferWriter
 from onyx.configs.app_configs import DEV_MODE, DISABLE_VECTOR_DB
 from onyx.configs.chat_configs import CHAT_HEARTBEAT_INTERVAL_S
@@ -982,7 +981,7 @@ def build_chat_turn(
             user_message_id=user_message.id,
             reserved_assistant_message_id=assistant_response.id,
         )
-    processing_run_id = user_message.id if is_multi else reserved_messages[0].id
+    processing_stream_id = user_message.id if is_multi else reserved_messages[0].id
 
     # Convert the chat history into a simple format that is free of any DB objects
     # and is easy to parse for the agent loop.
@@ -1052,20 +1051,22 @@ def build_chat_turn(
 
     # ── Stop signal and processing status ────────────────────────────────────
     cache = get_cache_backend()
-    reset_cancel_status(chat_session.id, cache)
+    clear_stop(chat_session.id, cache, stream_id=processing_stream_id)
 
     # Bind the id, not the row: this closure is stored on ChatTurnSetup and
     # would otherwise keep a detached ChatSession reachable for the whole turn.
     chat_session_id = chat_session.id
 
     def check_is_connected() -> bool:
-        return check_stop_signal(chat_session_id, cache)
+        return not is_stop_requested(
+            chat_session_id, cache, stream_id=processing_stream_id
+        )
 
     set_processing_status(
         chat_session_id=chat_session.id,
         cache=cache,
         value=True,
-        run_id=processing_run_id,
+        stream_id=processing_stream_id,
     )
 
     # Release any read transaction before the long-running LLM stream.
@@ -1090,7 +1091,7 @@ def check_is_connected() -> bool:
         simple_chat_history=simple_chat_history,
         extracted_context_files=extracted_context_files,
         reserved_messages=reserved_messages,
-        processing_run_id=processing_run_id,
+        processing_stream_id=processing_stream_id,
         reserved_token_count=reserved_token_count,
         reasoning_effort=chat_session.reasoning_effort_override or ReasoningEffort.AUTO,
         search_params=search_params,
@@ -1502,7 +1503,7 @@ def _drain_to_completion() -> None:
                             chat_session_id=setup.chat_session_id,
                             cache=setup.cache,
                             value=True,
-                            run_id=setup.processing_run_id,
+                            stream_id=setup.processing_stream_id,
                         )
                     except Exception:
                         # Worst case the fence lapses early; never kill the
@@ -1761,7 +1762,7 @@ def _stream_chat_turn(
         stream_buffer = StreamBufferWriter(
             cache=setup.cache,
             chat_session_id=setup.chat_session_id,
-            run_id=setup.processing_run_id,
+            stream_id=setup.processing_stream_id,
             delete_on_done=content_free,
             session_ended=(
                 (lambda: incognito_session_ended(setup.chat_session_id))
```

**File**: `backend/onyx/chat/stop_signal_checker.py` (modified, +13/-46)
```diff
@@ -1,58 +1,25 @@
+"""Store Stop requests for an identified execution in the tenant-aware cache."""
+
 from uuid import UUID
 
 from onyx.cache.interface import CacheBackend
 
-PREFIX = "chatsessionstop"
-FENCE_PREFIX = f"{PREFIX}_fence"
-FENCE_TTL = 10 * 60  # 10 minutes
-
-
-def _get_fence_key(chat_session_id: UUID) -> str:
-    """Generate the cache key for a chat session stop signal fence.
-
-    Args:
-        chat_session_id: The UUID of the chat session
-
-    Returns:
-        The fence key string. Tenant isolation is handled automatically
-        by the cache backend (Redis key-prefixing or Postgres schema routing).
-    """
-    return f"{FENCE_PREFIX}_{chat_session_id}"
-
-
-def set_fence(chat_session_id: UUID, cache: CacheBackend, value: bool) -> None:
-    """Set or clear the stop signal fence for a chat session.
+STOP_TTL = 10 * 60
 
-    Args:
-        chat_session_id: The UUID of the chat session
-        cache: Tenant-aware cache backend
-        value: True to set the fence (stop signal), False to clear it
-    """
-    fence_key = _get_fence_key(chat_session_id)
-    if not value:
-        cache.delete(fence_key)
-        return
-    cache.set(fence_key, 0, ex=FENCE_TTL)
 
+def _stop_key(chat_session_id: UUID, stream_id: int) -> str:
+    return f"chatsessionstop_fence_{chat_session_id}_{stream_id}"
 
-def is_connected(chat_session_id: UUID, cache: CacheBackend) -> bool:
-    """Check if the chat session should continue (not stopped).
 
-    Args:
-        chat_session_id: The UUID of the chat session to check
-        cache: Tenant-aware cache backend
+def request_stop(chat_session_id: UUID, cache: CacheBackend, *, stream_id: int) -> None:
+    cache.set(_stop_key(chat_session_id, stream_id), 1, ex=STOP_TTL)
 
-    Returns:
-        True if the session should continue, False if it should stop
-    """
-    return not cache.exists(_get_fence_key(chat_session_id))
 
+def clear_stop(chat_session_id: UUID, cache: CacheBackend, *, stream_id: int) -> None:
+    cache.delete(_stop_key(chat_session_id, stream_id))
 
-def reset_cancel_status(chat_session_id: UUID, cache: CacheBackend) -> None:
-    """Clear the stop signal for a chat session.
 
-    Args:
-        chat_session_id: The UUID of the chat session
-        cache: Tenant-aware cache backend
-    """
-    cache.delete(_get_fence_key(chat_session_id))
+def is_stop_requested(
+    chat_session_id: UUID, cache: CacheBackend, *, stream_id: int
+) -> bool:
+    return cache.exists(_stop_key(chat_session_id, stream_id))
```

**File**: `backend/onyx/chat/stream_buffer.py` (modified, +39/-35)
```diff
@@ -48,34 +48,34 @@ class StreamChunkRead(BaseModel):
     gap: bool
 
 
-def _chunk_key(chat_session_id: UUID, run_id: int, chunk_n: int) -> str:
-    return f"{_PREFIX}_{chat_session_id}_{run_id}:{chunk_n}"
+def _chunk_key(chat_session_id: UUID, stream_id: int, chunk_n: int) -> str:
+    return f"{_PREFIX}_{chat_session_id}_{stream_id}:{chunk_n}"
 
 
-def _meta_key(chat_session_id: UUID, run_id: int) -> str:
-    return f"{_PREFIX}_{chat_session_id}_{run_id}:meta"
+def _meta_key(chat_session_id: UUID, stream_id: int) -> str:
+    return f"{_PREFIX}_{chat_session_id}_{stream_id}:meta"
 
 
 def stream_buffer_key_pattern(chat_session_id: UUID) -> str:
-    """Glob matching every buffered chunk and meta key of the session's runs."""
+    """Glob matching every buffered chunk and meta key of the session's streams."""
     return f"{_PREFIX}_{chat_session_id}_*"
 
 
 class StreamBufferWriter:
-    """Append-only writer for one run. Errors never propagate into the stream
+    """Append-only writer for one chat turn. Errors never propagate into the stream
     path — a broken cache downgrades the run to non-resumable (truncated)."""
 
     def __init__(
         self,
         cache: CacheBackend,
         chat_session_id: UUID,
-        run_id: int,
+        stream_id: int,
         delete_on_done: bool = False,
         session_ended: Callable[[], bool] | None = None,
     ) -> None:
         self._cache = cache
         self._chat_session_id = chat_session_id
-        self._run_id = run_id
+        self._stream_id = stream_id
         # Content-free incognito runs: completion deletes the run's keys, so a
         # flush racing the session teardown still cleans itself up. Costs
         # post-completion resume.
@@ -90,8 +90,8 @@ def __init__(
         self._compressed_total = 0
 
     @property
-    def run_id(self) -> int:
-        return self._run_id
+    def stream_id(self) -> int:
+        return self._stream_id
 
     def append_line(self, line: str) -> None:
         if self._meta.truncated or self._meta.done:
@@ -117,15 +117,17 @@ def flush(self) -> None:
                 self._meta.truncated = True
                 self._write_meta(CHAT_STREAM_BUFFER_TTL_S)
                 logger.warning(
-                    "stream buffer for session %s run %d exceeded %d bytes; "
+                    "stream buffer for session %s stream %d exceeded %d bytes; "
                     "marking truncated",
                     self._chat_session_id,
-                    self._run_id,
+                    self._stream_id,
                     CHAT_STREAM_BUFFER_MAX_BYTES,
                 )
                 return
             self._cache.set(
-                _chunk_key(self._chat_session_id, self._run_id, self._meta.chunk_count),
+                _chunk_key(
+                    self._chat_session_id, self._stream_id, self._meta.chunk_count
+                ),
                 payload,
                 ex=CHAT_STREAM_BUFFER_TTL_S,
             )
@@ -134,19 +136,19 @@ def flush(self) -> None:
             self._write_meta(CHAT_STREAM_BUFFER_TTL_S)
         except Exception:
             logger.exception(
-                "stream buffer flush failed for session %s run %d; "
+                "stream buffer flush failed for session %s stream %d; "
                 "run continues non-resumable",
                 self._chat_session_id,
-                self._run_id,
+                self._stream_id,
             )
             self._meta.truncated = True
             try:
                 self._write_meta(CHAT_STREAM_BUFFER_TTL_S)
             except Exception:
                 logger.exception(
-                    "stream buffer meta update failed after flush error for session %s run %d",
+                    "stream buffer meta update failed after flush error for session %s stream %d",
                     self._chat_session_id,
-                    self._run_id,
+                    self._stream_id,
                 )
 
     def mark_done(self) -> None:
@@ -155,16 +157,16 @@ def mark_done(self) -> None:
                 return
             self._meta.done = True
             try:
-                self._cache.delete(_meta_key(self._chat_session_id, self._run_id))
+                self._cache.delete(_meta_key(self._chat_session_id, self._stream_id))
                 for chunk_n in range(self._meta.chunk_count):
                     self._cache.delete(
-                        _chunk_key(self._chat_session_id, self._run_id, chunk_n)
+                        _chunk_key(self._chat_session_id, self._stream_id, chunk_n)
                     )
             except Exception:
                 logger.exception(
-                    "stream buffer deletion failed for session %s run %d",
+                    "stream buffer deletion failed for session %s stream %d",
                     self._chat_session_id,
-                    self._run_id,
+                    self._stream_id,
                 )
             return
         self.
```

**File**: `backend/onyx/server/query_and_chat/chat_backend.py` (modified, +26/-22)
```diff
@@ -26,7 +26,7 @@
 from onyx.background.task_utils import enqueue_user_file_deletes
 from onyx.cache.factory import get_cache_backend
 from onyx.chat.chat_processing_checker import (
-    get_processing_run_id,
+    get_processing_stream_id,
     is_chat_session_processing,
 )
 from onyx.chat.chat_state import ChatStateContainer
@@ -48,7 +48,7 @@
     handle_stream_message_objects,
 )
 from onyx.chat.prompt_utils import get_default_base_system_prompt
-from onyx.chat.stop_signal_checker import set_fence
+from onyx.chat.stop_signal_checker import request_stop
 from onyx.chat.stream_buffer import has_stream_buffer, read_stream_chunks
 from onyx.configs.app_configs import WEB_DOMAIN
 from onyx.configs.chat_configs import (
@@ -130,11 +130,12 @@
     ChatSessionsResponse,
     ChatSessionSummary,
     ChatSessionUpdateRequest,
-    CurrentRunInfo,
+    CurrentStreamInfo,
     MessageOrigin,
     RenameChatSessionResponse,
     SendMessageRequest,
     SetPreferredResponseRequest,
+    StopChatResponse,
     UpdateChatSessionReasoningRequest,
     UpdateChatSessionTemperatureRequest,
     UpdateChatSessionThreadRequest,
@@ -426,11 +427,11 @@ def get_chat_session(
         translate_db_message_to_chat_message_detail(msg) for msg in session_messages
     ]
 
-    current_run: CurrentRunInfo | None = None
+    current_stream: CurrentStreamInfo | None = None
     try:
-        run_id = get_processing_run_id(session_id, get_cache_backend())
-        if run_id is not None:
-            current_run = CurrentRunInfo(run_id=run_id)
+        stream_id = get_processing_stream_id(session_id, get_cache_backend())
+        if stream_id is not None:
+            current_stream = CurrentStreamInfo(stream_id=stream_id)
     except Exception:
         logger.exception(
             "An error occurred while checking if the chat session is processing"
@@ -460,7 +461,7 @@ def get_chat_session(
         owner_name=chat_session.user.personal_name if chat_session.user else None,
         # Packets are now directly serialized as Packet Pydantic models
         packets=replay_packet_lists,
-        current_run=current_run,
+        current_stream=current_stream,
         incognito=chat_session.incognito_record_mode is not None,
     )
 
@@ -1319,10 +1320,10 @@ def resume_chat_stream(
             raise OnyxError(OnyxErrorCode.SESSION_NOT_FOUND)
 
     cache = get_cache_backend()
-    run_id = get_processing_run_id(session_id, cache)
-    if run_id is None or not has_stream_buffer(cache, session_id, run_id):
+    stream_id = get_processing_stream_id(session_id, cache)
+    if stream_id is None or not has_stream_buffer(cache, session_id, stream_id):
         raise OnyxError(
-            OnyxErrorCode.NOT_FOUND, "No resumable run for this chat session"
+            OnyxErrorCode.NOT_FOUND, "No resumable stream for this chat session"
         )
 
     def stream_buffered_run() -> Generator[str, None, None]:
@@ -1332,7 +1333,7 @@ def stream_buffered_run() -> Generator[str, None, None]:
             read = read_stream_chunks(
                 cache,
                 session_id,
-                run_id,
+                stream_id,
                 chunk_cursor,
                 max_chunks=_RESUME_MAX_CHUNKS_PER_READ,
             )
@@ -1357,7 +1358,7 @@ def stream_buffered_run() -> Generator[str, None, None]:
                     read = read_stream_chunks(
                         cache,
                         session_id,
-                        run_id,
+                        stream_id,
                         chunk_cursor,
                         max_chunks=_RESUME_MAX_CHUNKS_PER_READ,
                     )
@@ -1377,21 +1378,24 @@ def stream_buffered_run() -> Generator[str, None, None]:
 @router.post("/stop-chat-session/{chat_session_id}", tags=PUBLIC_API_TAGS)
 def stop_chat_session(
     chat_session_id: UUID,
+    stream_id: int | None = Query(default=None, gt=0),
     user: User = Depends(require_permission(Permission.WRITE_CHAT)),
     db_session: Session = Depends(get_session),
-) -> dict[str, str]:
-    """
-    Stop a chat session by setting a stop signal.
-    This endpoint is called by the frontend when the user clicks the stop button.
-    """
+) -> StopChatResponse:
+    """Stop the requested execution without affecting a later request."""
     try:
         get_chat_session_by_id(
             chat_session_id=chat_session_id,
             user_id=user.id,
             db_session=db_session,
         )
-    except ValueError:
-        raise OnyxError(OnyxErrorCode.SESSION_NOT_FOUND, "Chat session not found")
+    except ValueError as error:
+        raise OnyxError(
+            OnyxErrorCode.SESSION_NOT_FOUND, "Chat session not found"
+        ) from error
 
-    set_fence(chat_session_id, get_cache_backend(), True)
-    return {"message": "Chat session stopped"}
+    cache = get_cache_backend()
+    target_stream_id = stream_id or get_processing_stream_id(chat_session_id, cache)
+    if target_stream_id is not None:
+    
```

**File**: `backend/onyx/server/query_and_chat/models.py` (modified, +9/-5)
```diff
@@ -187,6 +187,10 @@ class RenameChatSessionResponse(BaseModel):
     new_name: str  # This is only really useful if the name is generated
 
 
+class StopChatResponse(BaseModel):
+    message: str
+
+
 class ChatSessionDetails(BaseModel):
     id: UUID
     name: str | None
@@ -256,10 +260,10 @@ class SetPreferredResponseRequest(BaseModel):
     preferred_response_id: int
 
 
-class CurrentRunInfo(BaseModel):
-    """In-flight run whose stream buffer can be replayed/tailed."""
+class CurrentStreamInfo(BaseModel):
+    """Unfinished response available for stream reconnection."""
 
-    run_id: int
+    stream_id: int
 
 
 class ChatSessionDetailResponse(BaseModel):
@@ -277,9 +281,9 @@ class ChatSessionDetailResponse(BaseModel):
     deleted: bool = False
     owner_name: str | None = None
     packets: list[list[Packet]]
-    # Set while a run is in flight and resumable: cursor-0 replay+tail is
+    # Set while a stream is in flight and resumable: cursor-0 replay+tail is
     # available at /chat-session/{id}/resume-stream.
-    current_run: CurrentRunInfo | None = None
+    current_stream: CurrentStreamInfo | None = None
     # True for sessions pinned to an incognito record mode, so a reload can
     # restore the incognito UI state.
     incognito: bool = False
```

---

### Incident Patch 10: `f5c518f6` (2026-10-04)
**Commit Message**: fix(ci): upload the backend image audit under its Dockerfile path (#15520)

**File**: `.github/workflows/deployment.yml` (modified, +34/-0)
```diff
@@ -147,13 +147,27 @@ jobs:
               # shellcheck disable=SC2016
               echo '{"$schema":"https://json.schemastore.org/sarif-2.1.0.json","version":"2.1.0","runs":[]}' > "image-audit-${component}.sarif"
             fi
+            # A stage built here is named "name:tag" with no registry path, which
+            # the Security tab reads as a URI scheme and rejects; point its
+            # findings at the Dockerfile the stage comes from.
+            case "${component}" in
+              backend) dockerfile=backend/Dockerfile ;;
+              *) dockerfile="" ;;
+            esac
+            if [ -n "${dockerfile}" ]; then
+              jq --arg uri "${dockerfile}" '(.runs[]?.results[]?.locations[]?.physicalLocation.artifactLocation.uri) |= $uri' \
+                "image-audit-${component}.sarif" > "image-audit-${component}.sarif.tmp"
+              mv "image-audit-${component}.sarif.tmp" "image-audit-${component}.sarif"
+            fi
           done
           exit "${status}"
 
       # Rolling main-HEAD builds map to refs/heads/main so the Security tab stays
       # authoritative for main; test runs upload against their own ref. Release
       # tags sit on older commits, so they gate without uploading.
       - name: Upload the web image audit to the GitHub Security tab
+        id: upload-web
+        continue-on-error: true # reporting never blocks a release; the gate's verdict is the step above
         if: >-
           always() &&
           ((env.EDGE_TAG == 'true' && needs.determine-builds.outputs.is-test-run != 'true') ||
@@ -166,6 +180,8 @@ jobs:
           sha: ${{ github.sha }}
 
       - name: Upload the model-server image audit to the GitHub Security tab
+        id: upload-model-server
+        continue-on-error: true # reporting never blocks a release; the gate's verdict is the step above
         if: >-
           always() &&
           ((env.EDGE_TAG == 'true' && needs.determine-builds.outputs.is-test-run != 'true') ||
@@ -178,6 +194,8 @@ jobs:
           sha: ${{ github.sha }}
 
       - name: Upload the backend image audit to the GitHub Security tab
+        id: upload-backend
+        continue-on-error: true # reporting never blocks a release; the gate's verdict is the step above
         if: >-
           always() &&
           ((env.EDGE_TAG == 'true' && needs.determine-builds.outputs.is-test-run != 'true') ||
@@ -189,6 +207,22 @@ jobs:
           ref: ${{ needs.determine-builds.outputs.is-test-run == 'true' && github.ref || 'refs/heads/main' }}
           sha: ${{ github.sha }}
 
+      # A rejected upload leaves the Security tab stale without failing the
+      # job, so it is called out where the run is read.
+      - name: Report failed uploads
+        if: always() && (steps.upload-web.outcome == 'failure' || steps.upload-model-server.outcome == 'failure' || steps.upload-backend.outcome == 'failure')
+        env:
+          WEB: ${{ steps.upload-web.outcome }}
+          MODEL_SERVER: ${{ steps.upload-model-server.outcome }}
+          BACKEND: ${{ steps.upload-backend.outcome }}
+        run: |
+          failed=""
+          [ "${WEB}" = failure ] && failed="${failed} web"
+          [ "${MODEL_SERVER}" = failure ] && failed="${failed} model-server"
+          [ "${BACKEND}" = failure ] && failed="${failed} backend"
+          echo "::warning::The Security tab upload failed for:${failed}. The tab is stale until the next nightly upload succeeds."
+          echo "Security tab upload failed for:${failed}" >> "${GITHUB_STEP_SUMMARY}"
+
   # Validate that a pushed release tag is versioned correctly, via
   # `ods release --check`. A cloud tag must be the tag `ods release cloud`
   # would have cut: its commit on origin/main, its base matching the release
```

---

### Incident Patch 11: `663dd2fe` (2026-10-04)
**Commit Message**: feat(opal): add Dropdown and rebuild the input dropdowns on it (#15523)

**File**: `web/lib/opal/src/components/divider/README.md` (modified, +3/-2)
```diff
@@ -15,8 +15,8 @@ A plain line with no title or description.
 | Prop                   | Type                           | Default        | Description                                                      |
 | ---------------------- | ------------------------------ | -------------- | ---------------------------------------------------------------- |
 | `orientation`          | `"horizontal" \| "vertical"`   | `"horizontal"` | Direction of the line                                            |
-| `paddingParallel`      | `0 \| 0.5 \| 1 \| 2 \| 3 \| 4 \| 6` | `2`            | Inset along the line direction, as a spacing step (`N / 4` rem)  |
-| `paddingPerpendicular` | `0 \| 0.5 \| 1 \| 2 \| 3 \| 4 \| 6` | `1`            | Inset perpendicular to the line, as a spacing step (`N / 4` rem) |
+| `paddingParallel`      | `0 \| 0.5 \| 1 \| 2 \| 3 \| 4 \| 6` | `0.375rem`     | Inset along the line direction, as a spacing step (`N / 4` rem)  |
+| `paddingPerpendicular` | `0 \| 0.5 \| 1 \| 2 \| 3 \| 4 \| 6` | `0.25rem`      | Inset perpendicular to the line, as a spacing step (`N / 4` rem) |
 
 ### Titled divider
 
@@ -41,6 +41,7 @@ A plain line with no title or description.
 | `defaultOpen`  | `boolean`                 | `false`        | Uncontrolled initial open state |
 | `onOpenChange` | `(open: boolean) => void` | —              | Callback when toggled           |
 | `children`     | `ReactNode`               | —              | Content revealed when open; stays mounted while closed, inert and hidden from assistive tech, so the fold animates both ways |
+| `headerProps`  | ``Omit<HTMLAttributes<HTMLDivElement>, "onClick"> & Record<`data-${string}`, string \| number \| undefined>`` | — | Attributes for the header element, for an owner that addresses it: an id, a role, `aria-expanded`, `data-*` |
 
 ## Usage Examples
 
```

**File**: `web/lib/opal/src/components/divider/components.tsx` (modified, +35/-9)
```diff
@@ -26,6 +26,7 @@ interface DividerSharedProps {
   onOpenChange?: never;
   children?: never;
   interaction?: never;
+  headerProps?: never;
 }
 
 /**
@@ -44,9 +45,9 @@ type DividerBareProps = Omit<
 > & {
   /** Orientation of the line. Default: `"horizontal"`. */
   orientation?: OrientationVariants;
-  /** Padding along the line direction, as a spacing step. Default: `2` (0.5rem). */
+  /** Padding along the line direction, as a spacing step. Default: 0.375rem. */
   paddingParallel?: DividerSpacing;
-  /** Padding perpendicular to the line, as a spacing step. Default: `1` (0.25rem). */
+  /** Padding perpendicular to the line, as a spacing step. Default: 0.25rem. */
   paddingPerpendicular?: DividerSpacing;
 };
 
@@ -71,6 +72,7 @@ type DividerFoldableProps = Omit<
   | "onOpenChange"
   | "children"
   | "interaction"
+  | "headerProps"
 > & {
   /** Title is required when foldable. */
   title: string | RichStr;
@@ -91,6 +93,13 @@ type DividerFoldableProps = Omit<
    * title the keyboard stopped on). Unset, an open header reads as hover.
    */
   interaction?: InteractiveStatelessInteraction;
+  /**
+   * Attributes for the header element, for an owner that addresses it
+   * (a dropdown gives it an id, a role and `aria-expanded`, so the
+   * keyboard stop on the title reads as a control).
+   */
+  headerProps?: Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> &
+    Record<`data-${string}`, string | number | undefined>;
 };
 
 type DividerProps =
@@ -113,18 +122,29 @@ function Divider(props: DividerProps) {
     title,
     description,
     orientation = "horizontal",
-    paddingParallel = 2,
-    paddingPerpendicular = 1,
+    paddingParallel,
+    paddingPerpendicular,
   } = props;
 
+  // The stylesheet carries the default inset (0.375rem along the line, 0.25rem
+  // across, the same for every variant); a bare line's steps override it.
+  const inset = {
+    ...(paddingParallel !== undefined && {
+      parallel: spacingToRem(paddingParallel),
+    }),
+    ...(paddingPerpendicular !== undefined && {
+      perpendicular: spacingToRem(paddingPerpendicular),
+    }),
+  };
+
   if (orientation === "vertical") {
     return (
       <div
         ref={ref}
         className="opal-divider-vertical"
         style={{
-          paddingInline: spacingToRem(paddingPerpendicular),
-          paddingBlock: spacingToRem(paddingParallel),
+          paddingInline: inset.perpendicular,
+          paddingBlock: inset.parallel,
         }}
       >
         <div className="opal-divider-line-vertical" />
@@ -137,8 +157,8 @@ function Divider(props: DividerProps) {
       ref={ref}
       className="opal-divider"
       style={{
-        paddingInline: spacingToRem(paddingParallel),
-        paddingBlock: spacingToRem(paddingPerpendicular),
+        paddingInline: inset.parallel,
+        paddingBlock: inset.perpendicular,
       }}
     >
       <div className="opal-divider-row">
@@ -177,6 +197,7 @@ function FoldableDivider({
   onOpenChange,
   children,
   interaction,
+  headerProps,
 }: DividerFoldableProps) {
   const [internalOpen, setInternalOpen] = useState(defaultOpen);
   const isControlled = controlledOpen !== undefined;
@@ -196,7 +217,12 @@ function FoldableDivider({
         interaction={interaction ?? (isOpen ? "hover" : "rest")}
         onClick={toggle}
       >
-        <Interactive.Container rounding={2} size="fit" width="full">
+        <Interactive.Container
+          rounding={2}
+          size="fit"
+          width="full"
+          {...headerProps}
+        >
           <div className="opal-divider">
             <div className="opal-divider-row">
               <div className="opal-divider-title">
```

**File**: `web/lib/opal/src/components/divider/styles.css` (modified, +3/-0)
```diff
@@ -12,6 +12,8 @@
 .opal-divider {
   @apply flex flex-col w-full;
   gap: 0.75rem;
+  /* The default inset for every variant: 0.375rem along the line, 0.25rem across. */
+  padding: 0.25rem 0.375rem;
 }
 
 .opal-divider-row {
@@ -39,6 +41,7 @@
   /* self-stretch overrides items-center on the parent so the divider spans
      the full cross-axis height of the flex container. */
   @apply flex flex-row self-stretch;
+  padding: 0.375rem 0.25rem;
 }
 
 .opal-divider-line-vertical {
```

**File**: `web/lib/opal/src/components/dropdown/Dropdown.stories.tsx` (added, +207/-0)
```diff
@@ -0,0 +1,207 @@
+import { useRef, useState } from "react";
+import type { Meta, StoryObj } from "@storybook/react-vite";
+import {
+  Button,
+  Dropdown,
+  InputTypeIn,
+  LineItemButton,
+  type DropdownItem,
+  type DropdownMenuItem,
+  type DropdownOption,
+} from "@opal/components";
+import {
+  SvgChevronDown,
+  SvgEdit,
+  SvgMoreHorizontal,
+  SvgSettings,
+  SvgStar,
+  SvgTrash,
+} from "@opal/icons";
+
+const meta: Meta<typeof Dropdown> = {
+  title: "Components/Dropdown",
+  component: Dropdown,
+};
+export default meta;
+
+type Story = StoryObj<typeof Dropdown>;
+
+const FRUIT: DropdownItem[] = [
+  { kind: "option", value: "apple", title: "Apple" },
+  { kind: "option", value: "banana", title: "Banana" },
+  {
+    kind: "group",
+    title: "Citrus",
+    foldable: true,
+    items: [
+      { kind: "option", value: "lemon", title: "Lemon" },
+      { kind: "option", value: "lime", title: "Lime" },
+      { kind: "option", value: "orange", title: "Orange", disabled: true },
+    ],
+  },
+  {
+    kind: "group",
+    title: "Berries",
+    items: [
+      { kind: "option", value: "strawberry", title: "Strawberry" },
+      { kind: "option", value: "blueberry", title: "Blueberry" },
+    ],
+  },
+];
+
+function TypeInDemo() {
+  const [open, setOpen] = useState(false);
+  const [query, setQuery] = useState("");
+  const [picked, setPicked] = useState("");
+  return (
+    <div style={{ width: 280 }}>
+      <Dropdown open={open} onOpenChange={setOpen}>
+        <Dropdown.Trigger asChild typeIn>
+          <InputTypeIn
+            placeholder="Fruit"
+            aria-label="Fruit"
+            value={query}
+            onChange={(e) => {
+              setQuery(e.target.value);
+              setOpen(true);
+            }}
+          />
+        </Dropdown.Trigger>
+        <Dropdown.Data
+          items={FRUIT}
+          label="Fruit"
+          query={query}
+          highlightExactQuery
+          value={picked}
+          onSelect={(option) => {
+            setPicked(option.value);
+            setQuery(option.title);
+          }}
+        />
+      </Dropdown>
+    </div>
+  );
+}
+
+/** A text input whose text filters the rows: a picker. */
+export const TypeInPicker: Story = { render: () => <TypeInDemo /> };
+
+function ButtonPickerDemo() {
+  const [picked, setPicked] = useState("");
+  const title = FRUIT.flatMap((item) =>
+    item.kind === "group" ? item.items : [item]
+  )
+    .filter((row): row is DropdownOption => row.kind === "option")
+    .find((option) => option.value === picked)?.title;
+  return (
+    <Dropdown>
+      <Dropdown.Trigger asChild>
+        <Button prominence="secondary" rightIcon={SvgChevronDown}>
+          {title ?? "Pick a fruit"}
+        </Button>
+      </Dropdown.Trigger>
+      <Dropdown.Data
+        items={FRUIT}
+        label="Fruit"
+        search={{ placeholder: "Search" }}
+        value={picked}
+        onSelect={(option) => setPicked(option.value)}
+      />
+    </Dropdown>
+  );
+}
+
+/** A button trigger with the dropdown's own search field: a picker. */
+export const ButtonPicker: Story = { render: () => <ButtonPickerDemo /> };
+
+function MenuDemo() {
+  const settingsRef = useRef<HTMLButtonElement>(null);
+  const [pinned, setPinned] = useState(false);
+  const [log, setLog] = useState<string[]>([]);
+  const note = (text: string) => setLog((prev) => [...prev, text]);
+  const items: DropdownMenuItem[] = [
+    {
+      kind: "action",
+      id: "rename",
+      title: "Rename",
+      icon: SvgEdit,
+      onSelect: () => note("rename"),
+    },
+    {
+      kind: "toggle",
+      id: "pin",
+      title: "Pinned",
+      description: "Keep at the top of the list",
+      icon: SvgStar,
+      checked: pinned,
+      onCheckedChange: setPinned,
+    },
+    {
+      kind: "custom",
+      id: "settings",
+      keywords: ["settings", "configure"],
+      keepOpen: true,
+      onActivate: () => note("settings: activate"),
+      // ArrowRight hands the keyboard to the row's own control.
+      onSecondary: () => settingsRef.current?.focus(),
+      render: ({ highlighted, props }) => (
+        <LineItemButton
+          presentational
+          selectVariant="select-heavy"
+          interaction={highlighted ? "hover" : "rest"}
+          rounding={2}
+          icon={SvgSettings}
+          title="Settings"
+          description="A custom row with its own control"
+          sizePreset="main-ui"
+          variant="heading"
+          rightChildren={
+            <Button
+              ref={settingsRef}
+              icon={SvgSettings}
+              size="sm"
+              prominence="internal"
+              onClick={(e) => {
+                e.stopPropagation();
+                note("settings: button");
+              }}
+            />
+          }
+          {...props}
+        />
+      ),
+    },
+    {
+      kind: "group",
+      title: "Danger zone",
+      items: [
+        {
+          kind: "action
```

**File**: `web/lib/opal/src/components/dropdown/Dropdown.test.tsx` (added, +486/-0)
```diff
@@ -0,0 +1,486 @@
+import React, { useState } from "react";
+import { render, screen } from "@tests/setup/test-utils";
+import "@testing-library/jest-dom";
+import userEvent from "@testing-library/user-event";
+import { Dropdown, InputTypeIn } from "@opal/components";
+import type {
+  DropdownItem,
+  DropdownMenuItem,
+  DropdownOption,
+} from "@opal/components";
+
+// Mock createPortal for dropdown rendering
+jest.mock("react-dom", () => ({
+  ...jest.requireActual("react-dom"),
+  createPortal: (node: React.ReactNode) => node,
+}));
+
+// Mock scrollIntoView which is not available in jsdom
+Element.prototype.scrollIntoView = jest.fn();
+
+const ITEMS: DropdownItem[] = [
+  { kind: "option", value: "apple", title: "Apple" },
+  { kind: "option", value: "banana", title: "Banana", disabled: true },
+  {
+    kind: "group",
+    title: "Citrus",
+    foldable: true,
+    items: [
+      { kind: "option", value: "lemon", title: "Lemon" },
+      { kind: "option", value: "lime", title: "Lime" },
+    ],
+  },
+  {
+    kind: "group",
+    title: "Berries",
+    items: [{ kind: "option", value: "strawberry", title: "Strawberry" }],
+  },
+];
+
+interface HarnessProps {
+  items?: DropdownItem[];
+  onSelect?: (option: DropdownOption) => void;
+  onCreate?: (text: string) => void;
+}
+
+/** A type-in trigger over the items; what a pick means is the test's. */
+function Harness({ items = ITEMS, onSelect, onCreate }: HarnessProps) {
+  const [open, setOpen] = useState(false);
+  const [query, setQuery] = useState("");
+  const [picked, setPicked] = useState("");
+  return (
+    <Dropdown open={open} onOpenChange={setOpen}>
+      <Dropdown.Trigger asChild typeIn>
+        <InputTypeIn
+          placeholder="Fruit"
+          aria-label="Fruit"
+          value={query}
+          onChange={(e) => {
+            setQuery(e.target.value);
+            setOpen(true);
+          }}
+        />
+      </Dropdown.Trigger>
+      <Dropdown.Data
+        items={items}
+        label="Fruit"
+        query={query}
+        value={picked}
+        onSelect={(option) => {
+          setPicked(option.value);
+          onSelect?.(option);
+        }}
+        create={
+          onCreate && query.trim() !== ""
+            ? { text: query.trim(), onCreate }
+            : undefined
+        }
+      />
+    </Dropdown>
+  );
+}
+
+interface MenuHarnessProps {
+  onAction: jest.Mock;
+  onToggle: jest.Mock;
+  onSecondary?: jest.Mock;
+}
+
+/** A button trigger over a menu: an action, a toggle and a custom row. */
+function MenuHarness({ onAction, onToggle, onSecondary }: MenuHarnessProps) {
+  const [checked, setChecked] = useState(false);
+  const items: DropdownMenuItem[] = [
+    { kind: "action", id: "rename", title: "Rename", onSelect: onAction },
+    {
+      kind: "toggle",
+      id: "pin",
+      title: "Pinned",
+      checked,
+      onCheckedChange: (next) => {
+        setChecked(next);
+        onToggle(next);
+      },
+    },
+    {
+      kind: "custom",
+      id: "custom",
+      keywords: ["settings"],
+      onSecondary,
+      render: ({ highlighted, props }) => (
+        <div data-highlighted={highlighted || undefined} {...props}>
+          Settings
+        </div>
+      ),
+    },
+  ];
+  return (
+    <Dropdown>
+      <Dropdown.Trigger asChild>
+        <button type="button">Actions</button>
+      </Dropdown.Trigger>
+      <Dropdown.Data label="Actions" items={items} />
+    </Dropdown>
+  );
+}
+
+function setupUser() {
+  return userEvent.setup({ delay: null });
+}
+
+function highlighted() {
+  return screen
+    .queryAllByRole("option")
+    .filter((o) => o.getAttribute("data-interaction") === "hover")
+    .map((o) => o.textContent);
+}
+
+describe("Dropdown picker", () => {
+  test("the trigger carries the combobox wiring and ArrowDown opens the list", async () => {
+    const user = setupUser();
+    render(<Harness />);
+    const trigger = screen.getByRole("combobox", { name: "Fruit" });
+    expect(trigger).toHaveAttribute("aria-expanded", "false");
+    expect(trigger).toHaveAttribute("aria-haspopup", "listbox");
+    expect(trigger).toHaveAttribute("aria-autocomplete", "list");
+    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
+
+    // Focus without a click: a click on a type-in opens it by itself.
+    trigger.focus();
+    await user.keyboard("{ArrowDown}");
+    expect(trigger).toHaveAttribute("aria-expanded", "true");
+    expect(screen.getByRole("listbox", { name: "Fruit" })).toBeInTheDocument();
+    expect(highlighted()).toEqual(["Apple"]);
+    expect(trigger).toHaveAttribute(
+      "aria-activedescendant",
+      screen.getByRole("option", { name: "Apple" }).id
+    );
+  });
+
+  test("the walk skips a disabled row, stops on a folded title, and wraps", async () => {
+    const user = setupUser();
+    render(<Harness />);
+    await user.click(screen.getByRole("combobox", { name: "Fruit" }));
+    await user.keyboard("{ArrowDown}");
+    expect(hi
```

**File**: `web/lib/opal/src/components/dropdown/README.md` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+# Dropdown
+
+**Import:** `import { Dropdown } from "@opal/components";`
+
+A floating list under a trigger. The dropdown handles positioning, the keyboard, search, groups and folding once, for every trigger. It is a compound: `Dropdown`, `Dropdown.Trigger`, `Dropdown.Anchor` and `Dropdown.Data`. The rows are data, never JSX; a row that needs its own rendering is a `custom` item.
+
+With a `value` or `values`, `Dropdown.Data` is a **picker**: a `listbox` where something is selected. Without, it is a **menu**: commands, toggles and custom rows, and no `option` rows (a type error). No Radix: positioning is `@floating-ui/react-dom`.
+
+The four input dropdowns are pickers built on it: the ComboBoxes (`InputSingleComboBox`, `InputMultiComboBox`) with a type-in trigger whose text filters the rows, the Selects (`InputSingleSelect`, `InputMultiSelect`) with an input-shaped button trigger and an optional search field in the list.
+
+## Usage
+
+A menu on a button:
+
+```tsx
+import { Dropdown, Button } from "@opal/components";
+
+<Dropdown>
+  <Dropdown.Trigger asChild>
+    <Button icon={SvgMoreHorizontal} prominence="tertiary" />
+  </Dropdown.Trigger>
+  <Dropdown.Data
+    label="Actions"
+    search={{ placeholder: "Search" }}
+    items={[
+      { kind: "action", id: "rename", title: "Rename", icon: SvgEdit, onSelect: rename },
+      { kind: "toggle", id: "pin", title: "Pinned", checked: pinned, onCheckedChange: setPinned },
+      {
+        kind: "group",
+        title: "Danger zone",
+        items: [{ kind: "action", id: "delete", title: "Delete", danger: true, onSelect: remove }],
+      },
+    ]}
+  />
+</Dropdown>
+```
+
+A picker on a type-in:
+
+```tsx
+<Dropdown open={open} onOpenChange={setOpen}>
+  <Dropdown.Trigger asChild typeIn>
+    <InputTypeIn
+      aria-label="Fruit"
+      value={query}
+      onChange={(e) => setQuery(e.target.value)}
+    />
+  </Dropdown.Trigger>
+  <Dropdown.Data
+    label="Fruit"
+    items={[
+      { kind: "option", value: "apple", title: "Apple" },
+      { kind: "group", title: "Citrus", foldable: true, items: [...] },
+    ]}
+    query={query}
+    value={picked}
+    onSelect={(option) => setPicked(option.value)}
+  />
+</Dropdown>
+```
+
+## Parts
+
+### `Dropdown`
+
+The list is always its anchor's width, 6px wider on each side so the rows line up under the anchor's content, and never narrower than `--block-width-dropdown-min` (17.5rem), so a narrow button trigger still gets a usable list.
+
+| Prop            | Type                                       | Default    | Description                                                                 |
+| --------------- | ------------------------------------------ | ---------- | --------------------------------------------------------------------------- |
+| `open`          | `boolean`                                  | —          | Controlled open state. Uncontrolled when left out.                          |
+| `onOpenChange`  | `(open: boolean) => void`                  | —          | Called with the next state                                                  |
+| `disabled`      | `boolean`                                  | `false`    | Never opens and renders no list                                             |
+| `id`            | `string`                                   | auto       | Prefix for the list's and the rows' element ids, so a field can tie into it |
+| `virtualAnchor` | `{ getBoundingClientRect, contextElement? }` | —        | A rectangle to position against instead of an element, like a text caret   |
+| `container`     | `HTMLElement \| null`                      | body       | Where the list portals to, for a dropdown inside a modal                    |
+| `tabKey`        | `"walk" \| "leave"`                        | by trigger | What Tab does while open: walk the rows, or close and move on. Default: walk for a type-in, leave otherwise |
+
+### `Dropdown.Trigger`
+
+The element that holds focus and takes the keyboard. It carries `aria-expanded`, `aria-controls` and `aria-activedescendant`, `aria-haspopup` for the mode, and for a picker `role="combobox"`. A dropdown may have several triggers; the one that opened the list anchors it and takes focus back. A trigger that is the control inside an Opal field (an `InputTypeIn`'s `<input>`) anchors the list to the field's chrome.
+
+| Prop       | Type                              | Default                   | Description                                                                   |
+| ---------- | --------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
+| `asChild`  | `boolean`                         | `false`                   | Merge onto the child element. Without it, a `<button>` wraps the children     |
+| `typeIn`   | `boolean`                         | `false`                   | A text input whose text filters the list (
```

**File**: `web/lib/opal/src/components/dropdown/components.tsx` (added, +733/-0)
```diff
@@ -0,0 +1,733 @@
+"use client";
+
+import "@opal/components/dropdown/styles.css";
+import React, {
+  useCallback,
+  useEffect,
+  useId,
+  useLayoutEffect,
+  useMemo,
+  useRef,
+  useState,
+} from "react";
+import { Slot } from "@radix-ui/react-slot";
+import { useOpalStrings } from "@opal/strings";
+import {
+  DropdownContext,
+  useDropdownContext,
+  type DropdownContextValue,
+  type DropdownTriggerProps,
+} from "@opal/components/dropdown/context";
+import {
+  useDropdownKeyboard,
+  useDropdownOverlay,
+  useFoldedGroups,
+  type DropdownTabKey,
+  type DropdownVirtualAnchor,
+  type ListModel,
+} from "@opal/components/dropdown/hooks";
+import {
+  buildNavItems,
+  filterGroups,
+  flattenGroups,
+  isOption,
+  navItemElementId,
+  normalizeItems,
+  optionMatchesExactly,
+  rowElementId,
+  rowKey,
+} from "@opal/components/dropdown/model";
+import { DropdownList } from "@opal/components/dropdown/list";
+import type {
+  DropdownItem,
+  DropdownMenuItem,
+  DropdownMode,
+  DropdownOption,
+  DropdownRow,
+  NavItem,
+  RowGroup,
+} from "@opal/components/dropdown/types";
+
+// ---------------------------------------------------------------------------
+// Dropdown
+// ---------------------------------------------------------------------------
+
+interface DropdownProps {
+  /** Controlled open state. */
+  open?: boolean;
+  onOpenChange?: (open: boolean) => void;
+  /** A disabled dropdown never opens and renders no list. */
+  disabled?: boolean;
+  /**
+   * Prefix for the list's and the rows' element ids, so a form field can
+   * tie its label and messages to them. Generated when left out.
+   */
+  id?: string;
+  /**
+   * A rectangle to position against instead of an element, like a text
+   * caret. Takes precedence over `Dropdown.Anchor` and the trigger.
+   */
+  virtualAnchor?: DropdownVirtualAnchor;
+  /** Where the list portals to, for a dropdown inside a modal. */
+  container?: HTMLElement | null;
+  /**
+   * What Tab does while the list is open. By default a type-in trigger
+   * walks the rows and any other trigger closes the list and lets focus
+   * move on; set it to make every trigger behave one way.
+   */
+  tabKey?: DropdownTabKey;
+  children: React.ReactNode;
+}
+
+const EMPTY_LIST: ListModel = {
+  items: [],
+  activate: () => {},
+  secondary: () => false,
+};
+
+/**
+ * A floating list under a trigger, with the keyboard, search, groups and
+ * folding handled once for every trigger. Compose it from `Dropdown.Trigger`
+ * (what opens it and takes the keyboard), an optional `Dropdown.Anchor`
+ * (what it positions against, when that is not the trigger) and
+ * `Dropdown.Data` (the rows, as data).
+ */
+function Dropdown({
+  open,
+  onOpenChange,
+  disabled = false,
+  id: idProp,
+  virtualAnchor,
+  container,
+  tabKey,
+  children,
+}: DropdownProps) {
+  const autoId = useId();
+  const id = idProp ?? `dropdown-${autoId}`;
+  const overlay = useDropdownOverlay({
+    open,
+    onOpenChange,
+    disabled,
+    virtualAnchor,
+  });
+  const {
+    isOpen,
+    setIsOpen,
+    highlightedIndex,
+    setHighlightedIndex,
+    setIsKeyboardNav,
+  } = overlay;
+
+  const listRef = useRef<ListModel>(EMPTY_LIST);
+  const [mode, setMode] = useState<DropdownMode>("picker");
+  const [activeId, setActiveId] = useState<string | undefined>(undefined);
+
+  const { handleKeyDown } = useDropdownKeyboard({
+    isOpen,
+    setIsOpen,
+    highlightedIndex,
+    setHighlightedIndex,
+    setIsKeyboardNav,
+    listRef,
+    tabKey,
+  });
+
+  const getTriggerProps = useCallback(
+    ({ typeIn }: { typeIn: boolean }): DropdownTriggerProps => ({
+      role: mode === "picker" ? "combobox" : undefined,
+      "aria-expanded": isOpen,
+      "aria-haspopup": mode === "picker" ? "listbox" : "menu",
+      "aria-controls": `${id}-listbox`,
+      "aria-activedescendant": isOpen ? activeId : undefined,
+      "aria-autocomplete": typeIn ? "list" : undefined,
+      // A type-in's letters are its filter; any other trigger types ahead.
+      onKeyDown: (event) =>
+        handleKeyDown(event, { typeIn, typeAhead: !typeIn, textField: typeIn }),
+    }),
+    [mode, isOpen, activeId, id, handleKeyDown]
+  );
+
+  const value = useMemo<DropdownContextValue>(
+    () => ({
+      id,
+      disabled,
+      container,
+      isOpen,
+      setIsOpen,
+      highlightedIndex,
+      setHighlightedIndex,
+      isKeyboardNav: overlay.isKeyboardNav,
+      setIsKeyboardNav,
+      setAnchorRef: overlay.setAnchorRef,
+      setTriggerRef: overlay.setTriggerRef,
+      releaseTriggerRef: overlay.releaseTriggerRef,
+      registerTrigger: overlay.registerTrigger,
+      unregisterTrigger: overlay.unregisterTrigger,
+      focusTrigger: overlay.focusTrigger,
+      floatingRef: overlay.floatingRef,
+      setFloatingRef: overlay.setFloatingRef,
+      floatingStyles: overlay.floatingStyles,
+      isPositioned: overlay.isPositioned,
+      listRef,
+      mode,
+      setMode,

```

**File**: `web/lib/opal/src/components/dropdown/context.tsx` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+"use client";
+
+import { createContext, useContext } from "react";
+import type {
+  DropdownKeyOptions,
+  ListModel,
+} from "@opal/components/dropdown/hooks";
+import type { DropdownMode } from "@opal/components/dropdown/types";
+
+/**
+ * What `Dropdown` shares with its parts. Opal-internal: the input family's
+ * engines read it to wire a field they render themselves (a `TagField`),
+ * where `Dropdown.Trigger` cannot reach the input. App code uses the
+ * composer.
+ */
+export interface DropdownContextValue {
+  /** Prefix for the list's and the rows' element ids. */
+  id: string;
+  disabled: boolean;
+  /** Where the list portals to; `document.body` when left out. */
+  container: HTMLElement | null | undefined;
+  isOpen: boolean;
+  setIsOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
+  highlightedIndex: number;
+  setHighlightedIndex: (index: number | ((prev: number) => number)) => void;
+  isKeyboardNav: boolean;
+  setIsKeyboardNav: (isKeyboard: boolean) => void;
+  /** The element the list positions against, when it is not the trigger. */
+  setAnchorRef: (node: HTMLElement | null) => void;
+  /** The element that holds focus and takes the keyboard. */
+  setTriggerRef: (node: HTMLElement | null) => void;
+  /** Forget a trigger on unmount, if it is the current one. */
+  releaseTriggerRef: (node: HTMLElement | null) => void;
+  /** Every mounted trigger counts as inside for outside-click dismissal. */
+  registerTrigger: (node: HTMLElement) => void;
+  unregisterTrigger: (node: HTMLElement) => void;
+  focusTrigger: () => void;
+  floatingRef: React.RefObject<HTMLDivElement | null>;
+  setFloatingRef: (node: HTMLDivElement | null) => void;
+  floatingStyles: React.CSSProperties;
+  isPositioned: boolean;
+  /** Filled by `Dropdown.Data`; read by the keyboard handler at event time. */
+  listRef: React.RefObject<ListModel>;
+  /** Picker or menu, as `Dropdown.Data` declared it. */
+  mode: DropdownMode;
+  setMode: (mode: DropdownMode) => void;
+  /** The highlighted stop's element id, for `aria-activedescendant`. */
+  activeId: string | undefined;
+  setActiveId: (id: string | undefined) => void;
+  handleKeyDown: (
+    event: React.KeyboardEvent<HTMLElement>,
+    options: DropdownKeyOptions
+  ) => void;
+  /**
+   * The attributes a trigger carries: the list it controls, whether it is
+   * open, and the highlighted stop, plus the keyboard handler. A picker's
+   * trigger is a combobox; a menu's keeps its own role. A type-in trigger
+   * also announces list autocomplete.
+   */
+  getTriggerProps: (options: { typeIn: boolean }) => DropdownTriggerProps;
+}
+
+export interface DropdownTriggerProps {
+  role: "combobox" | undefined;
+  "aria-expanded": boolean;
+  "aria-haspopup": "listbox" | "menu";
+  "aria-controls": string;
+  "aria-activedescendant": string | undefined;
+  "aria-autocomplete": "list" | undefined;
+  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
+}
+
+export const DropdownContext = createContext<DropdownContextValue | null>(null);
+
+export function useDropdownContext(): DropdownContextValue {
+  const context = useContext(DropdownContext);
+  if (!context) {
+    throw new Error("Dropdown parts must be rendered inside <Dropdown>.");
+  }
+  return context;
+}
```

---

### Incident Patch 12: `b7dca106` (2026-10-03)
**Commit Message**: feat(connectors): the first index attempt waits for required capability checks (#15452)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `backend/onyx/background/celery/tasks/docfetching/task_creation_utils.py` (modified, +156/-42)
```diff
@@ -11,12 +11,81 @@
     OnyxCeleryQueues,
     OnyxCeleryTask,
 )
-from onyx.db.enums import ConnectorCredentialPairStatus
-from onyx.db.index_attempt import mark_attempt_failed
+from onyx.connectors.capability_checks.indexing_hold import get_first_indexing_hold
+from onyx.db.enums import ConnectorCredentialPairStatus, IndexModelStatus
+from onyx.db.index_attempt import claim_waiting_index_attempt, mark_attempt_failed
 from onyx.db.indexing_coordination import IndexingCoordination
 from onyx.db.models import ConnectorCredentialPair, SearchSettings
 from onyx.redis.tenant_redis_client import TenantRedisClient
 
+_LOCK_TIMEOUT = 30
+# Serializes attempt creation (beat or API) and the dispatch of waiting attempts.
+_CREATION_LOCK_NAME = DANSWER_REDIS_FUNCTION_LOCK_PREFIX + "try_creating_indexing_task"
+
+
+def _new_docfetching_task_id(
+    cc_pair: ConnectorCredentialPair, search_settings: SearchSettings
+) -> str:
+    return f"docfetching_{cc_pair.id}_{search_settings.id}_{uuid4()}"
+
+
+def _skips_indexing(
+    cc_pair: ConnectorCredentialPair, search_settings: SearchSettings
+) -> bool:
+    if cc_pair.status == ConnectorCredentialPairStatus.DELETING:
+        return True
+    # Mirrors should_index: a legacy FUTURE reindex still indexes a paused pair,
+    # or the model swap never completes.
+    if cc_pair.status == ConnectorCredentialPairStatus.PAUSED:
+        return (
+            search_settings.status != IndexModelStatus.FUTURE
+            or search_settings.use_port_flow
+        )
+    return False
+
+
+def _send_docfetching_task(
+    celery_app: Celery,
+    *,
+    cc_pair: ConnectorCredentialPair,
+    search_settings: SearchSettings,
+    index_attempt_id: int,
+    custom_task_id: str,
+    tenant_id: str,
+) -> None:
+    # Use higher priority for first-time indexing to ensure new connectors
+    # get processed before re-indexing of existing connectors
+    has_successful_attempt = cc_pair.last_successful_index_time is not None
+    priority = (
+        OnyxCeleryPriority.MEDIUM if has_successful_attempt else OnyxCeleryPriority.HIGH
+    )
+
+    # No expires=: a docfetching task can wait in the queue for hours under
+    # load, and the NOT_STARTED scan in the indexing watchdog fails an attempt
+    # whose task is lost.
+    result = celery_app.send_task(
+        OnyxCeleryTask.CONNECTOR_DOC_FETCHING_TASK,
+        kwargs={
+            "index_attempt_id": index_attempt_id,
+            "cc_pair_id": cc_pair.id,
+            "search_settings_id": search_settings.id,
+            "tenant_id": tenant_id,
+        },
+        queue=OnyxCeleryQueues.CONNECTOR_DOC_FETCHING,
+        task_id=custom_task_id,
+        priority=priority,
+    )
+    if not result:
+        raise RuntimeError("send_task for connector_doc_fetching_task failed.")
+
+    task_logger.info(
+        f"Created docfetching task: "
+        f"cc_pair={cc_pair.id} "
+        f"search_settings={search_settings.id} "
+        f"attempt_id={index_attempt_id} "
+        f"celery_task_id={custom_task_id}"
+    )
+
 
 def try_creating_docfetching_task(
     celery_app: Celery,
@@ -36,28 +105,31 @@ def try_creating_docfetching_task(
     Now uses database-based coordination instead of Redis fencing.
     """
 
-    LOCK_TIMEOUT = 30
-
     # we need to serialize any attempt to trigger indexing since it can be triggered
     # either via celery beat or manually (API call)
     lock: RedisLock = r.lock(
-        DANSWER_REDIS_FUNCTION_LOCK_PREFIX + "try_creating_indexing_task",
-        timeout=LOCK_TIMEOUT,
+        _CREATION_LOCK_NAME,
+        timeout=_LOCK_TIMEOUT,
     )
 
-    acquired = lock.acquire(blocking_timeout=LOCK_TIMEOUT / 2)
+    acquired = lock.acquire(blocking_timeout=_LOCK_TIMEOUT / 2)
     if not acquired:
         return None
 
     index_attempt_id = None
     try:
         # Basic status checks
         db_session.refresh(cc_pair)
-        if cc_pair.status == ConnectorCredentialPairStatus.DELETING:
+        # A pause that commits after the beat read the pair ends here.
+        if _skips_indexing(cc_pair, search_settings):
             return None
 
-        # Generate custom task ID for tracking
-        custom_task_id = f"docfetching_{cc_pair.id}_{search_settings.id}_{uuid4()}"
+        # A first attempt that waits for the capability checks is created
+        # without its task; the beat sends it once the checks pass.
+        held = get_first_indexing_hold(db_session, cc_pair) is not None
+        custom_task_id = (
+            None if held else _new_docfetching_task_id(cc_pair, search_settings)
+        )
 
         # Try to create a new index attempt using database coordination
         # This replaces the Redis fencing mechanism
@@ -73,39 +145,23 @@ def try_creating_docfetching_task(
             # Another indexing attempt is already running
             return None
 
-        # Use higher priority for first-time indexing to ensure new connectors
-        # get processed before re-indexing of 
```

**File**: `backend/onyx/background/celery/tasks/docprocessing/tasks.py` (modified, +95/-37)
```diff
@@ -24,6 +24,7 @@
 from onyx.background.celery.tasks.beat_schedule import CLOUD_BEAT_MULTIPLIER_DEFAULT
 from onyx.background.celery.tasks.docfetching.task_creation_utils import (
     try_creating_docfetching_task,
+    try_dispatching_waiting_attempt,
 )
 from onyx.background.celery.tasks.docprocessing.heartbeat import (
     start_heartbeat,
@@ -60,6 +61,7 @@
     OnyxRedisLocks,
     OnyxRedisSignals,
 )
+from onyx.connectors.capability_checks.indexing_hold import get_first_indexing_hold
 from onyx.connectors.models import ConnectorFailure, Document, IndexAttemptMetadata
 from onyx.db.connector import mark_ccpair_with_indexing_trigger
 from onyx.db.connector_alerts import (
@@ -82,10 +84,13 @@
 )
 from onyx.db.index_attempt import (
     IndexAttemptError,
+    cc_pair_has_dispatched_index_attempts,
     create_index_attempt_error,
+    get_active_index_attempts_without_task,
     get_index_attempt,
     get_index_attempt_errors_for_cc_pair,
     get_stale_not_started_index_attempts,
+    get_waiting_index_attempt,
     mark_attempt_canceled,
     mark_attempt_failed,
     mark_attempt_partially_succeeded,
@@ -737,6 +742,50 @@ def evaluated(self) -> int:
         )
 
 
+def _dispatch_pair_waiting_attempt(
+    celery_app: Celery,
+    db_session: Session,
+    *,
+    cc_pair_id: int,
+    search_settings: SearchSettings,
+    redis_client: TenantRedisClient,
+    tenant_id: str,
+) -> bool:
+    """Sends the task of the pair's attempt that waits for the capability
+    checks, when they pass. False when no attempt waits or it still waits."""
+    waiting = get_waiting_index_attempt(db_session, cc_pair_id, search_settings.id)
+    if waiting is None:
+        return False
+    cc_pair = get_connector_credential_pair_from_id(
+        db_session=db_session, cc_pair_id=cc_pair_id
+    )
+    if cc_pair is None:
+        task_logger.debug(
+            f"Waiting index attempt has no cc_pair: index_attempt={waiting.id} "
+            f"cc_pair={cc_pair_id}"
+        )
+        return False
+    # Most beats find the hold still in place; check it before taking the
+    # creation lock. The dispatch checks it again under the lock.
+    if get_first_indexing_hold(db_session, cc_pair) is not None:
+        return False
+    dispatched = try_dispatching_waiting_attempt(
+        celery_app,
+        cc_pair,
+        search_settings,
+        waiting.id,
+        db_session,
+        redis_client,
+        tenant_id,
+    )
+    if dispatched:
+        task_logger.info(
+            f"Waiting index attempt dispatched: index_attempt={waiting.id} "
+            f"cc_pair={cc_pair_id} search_settings={search_settings.id}"
+        )
+    return dispatched
+
+
 def _kickoff_indexing_tasks(
     celery_app: Celery,
     db_session: Session,
@@ -762,7 +811,19 @@ def _kickoff_indexing_tasks(
             search_settings_id=search_settings.id,
             db_session=db_session,
         ):
-            result.skipped_active += 1
+            # A first attempt that waits for the capability checks starts here
+            # once they pass.
+            if _dispatch_pair_waiting_attempt(
+                celery_app,
+                db_session,
+                cc_pair_id=cc_pair_id,
+                search_settings=search_settings,
+                redis_client=redis_client,
+                tenant_id=tenant_id,
+            ):
+                result.created += 1
+            else:
+                result.skipped_active += 1
             continue
 
         cc_pair = get_connector_credential_pair_from_id(
@@ -838,6 +899,38 @@ def _kickoff_indexing_tasks(
     return result
 
 
+def fail_inconsistent_index_attempts(db_session: Session, lock_beat: RedisLock) -> None:
+    """Fails active attempts without a Celery task. A first attempt that waits
+    for the capability checks has no task by design, so it is left alone."""
+    for attempt in get_active_index_attempts_without_task(db_session):
+        lock_beat.reacquire()
+
+        # Double-check the attempt still has the inconsistent state
+        fresh_attempt = get_index_attempt(db_session, attempt.id)
+        if (
+            not fresh_attempt
+            or fresh_attempt.celery_task_id
+            or fresh_attempt.status.is_terminal()
+        ):
+            continue
+        if (
+            fresh_attempt.status == IndexingStatus.NOT_STARTED
+            and not cc_pair_has_dispatched_index_attempts(
+                db_session, fresh_attempt.connector_credential_pair_id
+            )
+        ):
+            continue
+
+        failure_reason = (
+            f"Inconsistent index attempt found - active status without Celery task: "
+            f"index_attempt={attempt.id} "
+            f"cc_pair={attempt.connector_credential_pair_id} "
+            f"search_settings={attempt.search_settings_id}"
+        )
+        task_logger.error(failure_reason)
+        mark_attempt_failed(attempt.id, db_session, failure_reason=failure_reason)
+
+
 @shared_task(  # 
```

**File**: `backend/onyx/configs/app_configs.py` (modified, +7/-0)
```diff
@@ -1985,6 +1985,13 @@ def get_current_tz_offset() -> int:
     os.environ.get("ENABLE_CC_PAIR_ACCESS_FILTER", "").lower() == "true"
 )
 
+# Turns on behavior that needs the connector checks UI (today: the first index
+# attempt waits for required capability checks). Enable together with
+# NEXT_PUBLIC_CONNECTOR_CHECKS_CARD_ENABLED.
+CONNECTOR_CHECKS_ENABLED = (
+    os.environ.get("CONNECTOR_CHECKS_ENABLED", "").lower() == "true"
+)
+
 # Membership TTL for the `active_tenants` sorted set. Members older than this
 # are treated as inactive by the gate read path. Must be > the full-fanout
 # interval so self-healing re-adds a genuinely-working tenant before their
```

**File**: `backend/onyx/connectors/capability_checks/indexing_hold.py` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+"""Holds a pair's first index attempt until its required capability checks
+pass.
+
+The attempt is created as usual, but its docfetching task is sent only when
+no hold applies. The hold reads the pair's connector-scoped report (credential
++ connector):
+
+- A run in flight holds.
+- A dead run holds: FAILED_TO_RUN, or a RUNNING mark past the stale cutoff
+  (the sweep retires it to FAILED_TO_RUN). The admin re-runs the checks. A
+  stored report that cannot be read holds the same way.
+- A required, applicable check that FAILED holds. INDETERMINATE and SKIPPED
+  do not.
+
+A pair with a dispatched index attempt, a pair without a report, and a source
+without named checks are never held. Nothing is held while
+CONNECTOR_CHECKS_ENABLED is off.
+"""
+
+from datetime import datetime, timedelta
+
+from pydantic import ValidationError
+from sqlalchemy.orm import Session
+
+from onyx.configs.app_configs import CONNECTOR_CHECKS_ENABLED
+from onyx.connectors.capability_checks.indexing_hold_models import (
+    HeldCheck,
+    IndexingHold,
+    IndexingHoldReason,
+)
+from onyx.connectors.capability_checks.models import (
+    CapabilityCheckStatus,
+    CredentialCapabilityReport,
+)
+from onyx.connectors.capability_checks.registry import has_named_capability_checks
+from onyx.connectors.capability_checks.runner import capability_check_run_stale_after
+from onyx.db.credential_capability import get_capability_report_row
+from onyx.db.engine.time_utils import get_db_current_time
+from onyx.db.enums import CapabilityReportRunStatus
+from onyx.db.index_attempt import cc_pair_has_dispatched_index_attempts
+from onyx.db.models import ConnectorCredentialPair, CredentialCapabilityReportRow
+from onyx.utils.logger import setup_logger
+
+logger = setup_logger()
+
+
+def decide_indexing_hold(
+    row: CredentialCapabilityReportRow, *, now: datetime, stale_after: timedelta
+) -> IndexingHold | None:
+    """The hold that the report row puts on a pair's first index attempt."""
+    if row.run_status == CapabilityReportRunStatus.RUNNING:
+        if row.run_started_at is not None and row.run_started_at >= now - stale_after:
+            return IndexingHold(reason=IndexingHoldReason.CHECKS_RUNNING)
+        return IndexingHold(reason=IndexingHoldReason.CHECKS_FAILED_TO_RUN)
+    if row.run_status == CapabilityReportRunStatus.FAILED_TO_RUN:
+        return IndexingHold(reason=IndexingHoldReason.CHECKS_FAILED_TO_RUN)
+    if row.report is None:
+        return None
+    try:
+        report = CredentialCapabilityReport.model_validate(row.report)
+    except ValidationError:
+        # Fail closed: a report that cannot be read is treated as a dead run.
+        logger.exception(
+            "Unreadable capability report %s; it holds indexing as failed to run.",
+            row.id,
+        )
+        return IndexingHold(reason=IndexingHoldReason.CHECKS_FAILED_TO_RUN)
+    failed = [
+        HeldCheck(
+            check_id=result.check_id,
+            capability=result.capability,
+            display_name=result.display_name,
+            message=result.message,
+            remediation=result.remediation,
+            docs_link=result.docs_link,
+        )
+        for result in report.check_results
+        if result.required
+        and result.applicable
+        and result.status == CapabilityCheckStatus.FAILED
+    ]
+    if not failed:
+        return None
+    return IndexingHold(
+        reason=IndexingHoldReason.REQUIRED_CHECKS_FAILED, failed_checks=failed
+    )
+
+
+def get_first_indexing_hold(
+    db_session: Session, cc_pair: ConnectorCredentialPair
+) -> IndexingHold | None:
+    """The hold on the pair's first index attempt, or None when its docfetching
+    task can be sent. With CONNECTOR_CHECKS_ENABLED off, nothing is held."""
+    if not CONNECTOR_CHECKS_ENABLED:
+        return None
+    source = cc_pair.connector.source
+    if not has_named_capability_checks(source):
+        return None
+    if cc_pair_has_dispatched_index_attempts(db_session, cc_pair.id):
+        return None
+    row = get_capability_report_row(
+        db_session, cc_pair.credential_id, cc_pair.connector_id
+    )
+    if row is None:
+        return None
+    return decide_indexing_hold(
+        row,
+        now=get_db_current_time(db_session),
+        stale_after=capability_check_run_stale_after(source),
+    )
```

**File**: `backend/onyx/connectors/capability_checks/indexing_hold_models.py` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+"""API shape of the hold on a pair's first index attempt. Import-light, so the
+server models can carry it."""
+
+from enum import Enum
+
+from pydantic import BaseModel
+
+from onyx.connectors.capabilities import CredentialCapability
+
+
+class IndexingHoldReason(str, Enum):
+    # A capability run for the pair is in flight.
+    CHECKS_RUNNING = "checks_running"
+    # The last run died before it stored a report, or the stored report cannot
+    # be read; re-run the checks.
+    CHECKS_FAILED_TO_RUN = "checks_failed_to_run"
+    # A required check failed in the last completed run.
+    REQUIRED_CHECKS_FAILED = "required_checks_failed"
+
+
+class HeldCheck(BaseModel):
+    """A required check that failed, as the connector page shows it."""
+
+    check_id: str
+    capability: CredentialCapability
+    display_name: str
+    message: str
+    remediation: str | None = None
+    docs_link: str | None = None
+
+
+class IndexingHold(BaseModel):
+    """Why the pair's first index attempt does not start yet."""
+
+    reason: IndexingHoldReason
+    # Set for REQUIRED_CHECKS_FAILED.
+    failed_checks: list[HeldCheck] = []
+    # The scheduled attempt that waits, when it is created.
+    index_attempt_id: int | None = None
```

**File**: `backend/onyx/db/index_attempt.py` (modified, +113/-1)
```diff
@@ -2,7 +2,18 @@
 from datetime import datetime, timedelta, timezone
 from typing import TypeVarTuple
 
-from sqlalchemy import Select, and_, delete, desc, exists, func, select, update
+from sqlalchemy import (
+    ColumnElement,
+    Select,
+    and_,
+    delete,
+    desc,
+    exists,
+    func,
+    or_,
+    select,
+    update,
+)
 from sqlalchemy.orm import Session, joinedload
 
 from onyx.connectors.models import ConnectorFailure
@@ -1236,3 +1247,104 @@ def get_index_attempt_errors_across_connectors(
     total = db_session.scalar(count_stmt) or 0
     errors = list(db_session.scalars(stmt).all())
     return errors, total
+
+
+def _is_waiting_attempt() -> ColumnElement[bool]:
+    """An attempt that is created but whose docfetching task is not sent: a
+    first attempt that waits for the pair's capability checks."""
+    return and_(
+        IndexAttempt.status == IndexingStatus.NOT_STARTED,
+        IndexAttempt.celery_task_id.is_(None),
+        IndexAttempt.targeted_reindex_job_id.is_(None),
+    )
+
+
+def _is_never_dispatched_attempt() -> ColumnElement[bool]:
+    """A waiting attempt, or one that a bulk cancel (e.g. an index swap) ended
+    while it waited. ``mark_attempt_failed`` and ``mark_attempt_canceled`` set
+    ``time_started``, so an attempt they end counts as dispatched."""
+    return or_(
+        _is_waiting_attempt(),
+        and_(
+            IndexAttempt.status.in_([IndexingStatus.FAILED, IndexingStatus.CANCELED]),
+            IndexAttempt.celery_task_id.is_(None),
+            IndexAttempt.time_started.is_(None),
+            IndexAttempt.targeted_reindex_job_id.is_(None),
+        ),
+    )
+
+
+def cc_pair_has_dispatched_index_attempts(db_session: Session, cc_pair_id: int) -> bool:
+    """True when the pair has an index attempt, for any search settings, whose
+    docfetching task was sent."""
+    return bool(
+        db_session.scalar(
+            select(
+                exists().where(
+                    IndexAttempt.connector_credential_pair_id == cc_pair_id,
+                    ~_is_never_dispatched_attempt(),
+                )
+            )
+        )
+    )
+
+
+def get_waiting_index_attempt(
+    db_session: Session, cc_pair_id: int, search_settings_id: int
+) -> IndexAttempt | None:
+    """The pair's attempt for these search settings whose docfetching task is
+    not sent yet."""
+    return db_session.scalars(
+        select(IndexAttempt).where(
+            IndexAttempt.connector_credential_pair_id == cc_pair_id,
+            IndexAttempt.search_settings_id == search_settings_id,
+            _is_waiting_attempt(),
+        )
+    ).first()
+
+
+def claim_waiting_index_attempt(
+    db_session: Session, index_attempt_id: int, celery_task_id: str
+) -> bool:
+    """Stamps the docfetching task id on a waiting attempt and commits. False
+    when the attempt is no longer waiting, so only one caller sends its task."""
+    result = db_session.execute(
+        update(IndexAttempt)
+        .where(
+            IndexAttempt.id == index_attempt_id,
+            _is_waiting_attempt(),
+        )
+        .values(celery_task_id=celery_task_id)
+    )
+    db_session.commit()
+    return int(result.rowcount) == 1  # ty: ignore[unresolved-attribute]
+
+
+def cancel_waiting_index_attempt__no_commit(
+    db_session: Session, index_attempt_id: int, reason: str
+) -> bool:
+    """Ends a waiting attempt as CANCELED. Leaves ``time_started`` unset
+    (unlike ``mark_attempt_canceled``), so the attempt still counts as never
+    dispatched and the pair's next attempt still waits for the checks. False
+    when the attempt is no longer waiting. The caller commits."""
+    result = db_session.execute(
+        update(IndexAttempt)
+        .where(IndexAttempt.id == index_attempt_id, _is_waiting_attempt())
+        .values(status=IndexingStatus.CANCELED, error_msg=reason)
+    )
+    return int(result.rowcount) == 1  # ty: ignore[unresolved-attribute]
+
+
+def get_active_index_attempts_without_task(db_session: Session) -> list[IndexAttempt]:
+    """Active full-run attempts with no Celery task id."""
+    return list(
+        db_session.scalars(
+            select(IndexAttempt).where(
+                IndexAttempt.status.in_(
+                    [IndexingStatus.NOT_STARTED, IndexingStatus.IN_PROGRESS]
+                ),
+                IndexAttempt.celery_task_id.is_(None),
+                IndexAttempt.targeted_reindex_job_id.is_(None),
+            )
+        ).all()
+    )
```

**File**: `backend/onyx/db/indexing_coordination.py` (modified, +2/-1)
```diff
@@ -38,7 +38,8 @@ def try_create_index_attempt(
         db_session: Session,
         cc_pair_id: int,
         search_settings_id: int,
-        celery_task_id: str,
+        # None creates the attempt without its docfetching task, to send later.
+        celery_task_id: str | None,
         from_beginning: bool = False,
     ) -> int | None:
         """
```

**File**: `backend/onyx/server/documents/cc_pair.py` (modified, +37/-0)
```diff
@@ -21,6 +21,8 @@
     OnyxCeleryPriority,
     OnyxCeleryTask,
 )
+from onyx.connectors.capability_checks.indexing_hold import get_first_indexing_hold
+from onyx.connectors.capability_checks.indexing_hold_models import IndexingHold
 from onyx.connectors.exceptions import ValidationError
 from onyx.connectors.factory import identify_connector_class, validate_ccpair_for_user
 from onyx.connectors.interfaces import Resolver
@@ -49,6 +51,7 @@
     PermissionSyncStatus,
 )
 from onyx.db.index_attempt import (
+    cancel_waiting_index_attempt__no_commit,
     count_index_attempt_errors_for_cc_pair,
     count_index_attempts_for_cc_pair,
     get_error_counts_for_index_attempts,
@@ -57,6 +60,7 @@
     get_latest_index_attempt_for_cc_pair_id,
     get_latest_successful_index_attempt_for_cc_pair_id,
     get_paginated_index_attempts_for_cc_pair_id,
+    get_waiting_index_attempt,
 )
 from onyx.db.index_attempt_metrics import get_stage_metrics_for_attempt
 from onyx.db.indexing_coordination import IndexingCoordination
@@ -66,6 +70,7 @@
     get_recent_doc_permission_sync_attempts_for_cc_pair,
     get_relevant_external_group_sync_attempts_for_cc_pair,
 )
+from onyx.db.search_settings import get_current_search_settings
 from onyx.error_handling.error_codes import OnyxErrorCode
 from onyx.error_handling.exceptions import OnyxError
 from onyx.redis.redis_connector import RedisConnector
@@ -350,6 +355,26 @@ def get_cc_pair_external_group_sync_attempts(
     )
 
 
+def _get_indexing_hold(
+    db_session: Session, cc_pair: ConnectorCredentialPair, *, can_operate: bool
+) -> IndexingHold | None:
+    """The hold on the pair's first index attempt, with the attempt that waits
+    when it is created. The failed checks are report internals, which are
+    management data, so a viewer who cannot operate the pair gets only the
+    reason."""
+    hold = get_first_indexing_hold(db_session, cc_pair)
+    if hold is None:
+        return None
+    waiting = get_waiting_index_attempt(
+        db_session, cc_pair.id, get_current_search_settings(db_session).id
+    )
+    return IndexingHold(
+        reason=hold.reason,
+        failed_checks=hold.failed_checks if can_operate else [],
+        index_attempt_id=waiting.id if waiting is not None else None,
+    )
+
+
 @router.get("/admin/cc-pair/{cc_pair_id}", tags=PUBLIC_API_TAGS)
 def get_cc_pair_full_info(
     cc_pair_id: int,
@@ -447,6 +472,7 @@ def get_cc_pair_full_info(
         ),
         num_docs_indexed=documents_indexed,
         is_editable_for_current_user=can_operate,
+        indexing_hold=_get_indexing_hold(db_session, cc_pair, can_operate=can_operate),
         indexing=bool(
             latest_attempt and latest_attempt.status == IndexingStatus.IN_PROGRESS
         ),
@@ -546,6 +572,17 @@ def update_cc_pair_status(
 
         for attempt in active_attempts:
             try:
+                # A first attempt that waits for the capability checks has no
+                # task to see a cancel request, so end it now. It stays
+                # undispatched, so the next attempt still waits for the checks.
+                # The status commit below also commits this cancel.
+                if (
+                    attempt.celery_task_id is None
+                    and cancel_waiting_index_attempt__no_commit(
+                        db_session, attempt.id, reason="Connector paused."
+                    )
+                ):
+                    continue
                 IndexingCoordination.request_cancellation(db_session, attempt.id)
                 # Revoke the task to prevent it from running
                 if attempt.celery_task_id:
```

---

### Incident Patch 13: `1a2699a7` (2026-10-02)
**Commit Message**: fix(ci): backport every affected image family and keep distro releases apart (#15504)

**File**: `.github/workflows/cve-alerts.yml` (modified, +69/-37)
```diff
@@ -330,42 +330,52 @@ jobs:
               echo '{"ref": "main", "pr": null}' > "${RUNNER_TEMP}/triage/base.json"
             fi
           elif [[ "${ECOSYSTEM}" == *:* ]]; then
-            # An OS package ships in a base image, so main's fix is the family's
-            # last merged digest refresh, as long as this branch still pins
-            # older digests than main.
-            family=python
-            if jq -e '[.manifests[]? | contains("node")] | any' <<< "${ALERT}" > /dev/null; then
-              family=node
-            fi
-            main_fix="$(gh pr list --state merged --base main --head "auto/base-image-digests/${family}" \
-              --json number,title,mergeCommit,mergedAt --limit 10 | jq -c 'sort_by(.mergedAt) | last // empty')"
-            files=".github/actions/dhi-base-images/action.yml web/Dockerfile"
-            if [ "${family}" = python ]; then
-              files=".github/actions/dhi-base-images/action.yml backend/Dockerfile backend/Dockerfile.model_server"
-            fi
+            # An OS package ships in a base image, so main's fix is each
+            # affected family's last merged digest refresh, as long as this
+            # branch still pins older digests than main. A package in both the
+            # node and python images needs both refreshes.
+            families="$(jq -r '[.manifests[]? | if contains("node") then "node" else "python" end] | unique | join(" ")' <<< "${ALERT}")"
             digests() {
               for f in ${files}; do
                 # errexit does not reach a command substitution, so fail by hand.
                 content="$(gh api "repos/${GH_REPO}/contents/${f}?ref=$1" --jq .content | base64 -d)" || exit 1
                 grep -oE "${family}:[^@ ]*@sha256:[0-9a-f]+" <<< "${content}" || true
               done | sort -u
             }
-            if [ -n "${main_fix}" ]; then
+            main_fixes='[]'
+            missing=""
+            for family in ${families:-python}; do
+              main_fix="$(gh pr list --state merged --base main --head "auto/base-image-digests/${family}" \
+                --json number,title,mergeCommit,mergedAt --limit 10 | jq -c 'sort_by(.mergedAt) | last // empty')"
+              if [ -z "${main_fix}" ]; then
+                missing="${missing} ${family}"
+                continue
+              fi
+              files=".github/actions/dhi-base-images/action.yml web/Dockerfile"
+              if [ "${family}" = python ]; then
+                files=".github/actions/dhi-base-images/action.yml backend/Dockerfile backend/Dockerfile.model_server"
+              fi
               # Separate assignments, so a failed read fails the step instead of
               # reading as "no digests" on both sides.
               branch_digests="$(digests "${GITHUB_REF_NAME}")"
               main_digests="$(digests main)"
               if [ "${branch_digests}" = "${main_digests}" ]; then
                 echo "::warning::This branch already pins main's ${family} digests, nothing to cherry-pick"
-                main_fix=""
+                continue
               fi
+              main_fixes="$(jq -c --argjson fix "${main_fix}" '. + [{pr: $fix.number, sha: $fix.mergeCommit.oid, title: $fix.title}]' <<< "${main_fixes}")"
+            done
+            # A family main has not refreshed leaves the alert unfixed, so no
+            # partial pick gets presented as the fix; the next run tries again.
+            if [ -n "${missing}" ]; then
+              echo "::warning::Main has no merged digest refresh for${missing}, nothing to cherry-pick yet"
+              main_fixes='[]'
             fi
             ref=main
-            if [ -n "${main_fix}" ]; then
+            if [ "${main_fixes}" != "[]" ]; then
               ref="${GITHUB_REF_NAME}"
             fi
-            jq -n --arg ref "${ref}" --argjson fix "${main_fix:-null}" \
-              '{ref: $ref, pr: null, main_fix: ($fix | if . == null then null else {pr: .number, sha: .mergeCommit.oid, title: .title} end)}' \
+            jq -n --arg ref "${ref}" --argjson fixes "${main_fixes}" '{ref: $ref, pr: null, main_fix: $fixes}' \
               > "${RUNNER_TEMP}/triage/base.json"
           else
             main_fix="$(gh pr list --state merged --base main \
@@ -399,7 +409,7 @@ jobs:
               ref="${GITHUB_REF_NAME}"
             fi
             jq -n --arg ref "${ref}" --argjson fix "${main_fix:-null}" \
-              '{ref: $ref, pr: null, main_fix: ($fix | if . == null then null else {pr: .number, sha: .mergeCommit.oid, title: .title} end)}' \
+              '{ref: $ref, pr: null, main_fix: ($fix | if . == null then [] else [{pr: .number, sha: .mergeCommit.oid, title: .title}] end)}' \
               > "${RUNNER_TEMP}/triage/base.json"
           fi
           echo "ref=$(jq -r .ref "${RUNNER_TEMP}/triage/base.json")" >> "$GITHUB_OUTPUT"
@@ -467,7 +477,7 @@ jobs:
           # A fix already merged on main is cherry-picked by the workflow, so
  
```

**File**: `tools/ods/internal/audit/osv.go` (modified, +7/-4)
```diff
@@ -208,11 +208,14 @@ func beforeLimits(r *osvschema.Range, v semantic.Version) bool {
 	return !limited
 }
 
-// sameEcosystem compares OSV ecosystem names without their release suffix,
-// so "Debian:13" and "Debian" match.
+// sameEcosystem compares OSV ecosystem names: equal release suffixes match,
+// and a name without one ("Debian") matches any release of it, while
+// "Debian:12" and "Debian:13" stay apart so one release's ranges never
+// decide another's fix.
 func sameEcosystem(a, b string) bool {
-	base := func(s string) string { return strings.ToLower(strings.SplitN(s, ":", 2)[0]) }
-	return base(a) == base(b)
+	an, ar, _ := strings.Cut(strings.ToLower(a), ":")
+	bn, br, _ := strings.Cut(strings.ToLower(b), ":")
+	return an == bn && (ar == "" || br == "" || ar == br)
 }
 
 // vulnTitle returns a one-line title for an advisory, preferring the summary
```

**File**: `tools/ods/internal/audit/osv_test.go` (modified, +29/-0)
```diff
@@ -218,6 +218,35 @@ func TestFixedFor_skipsVersionsAnotherRecordStillLists(t *testing.T) {
 	}
 }
 
+func TestFixedFor_keepsDistributionReleasesApart(t *testing.T) {
+	// Debian:12 fixed the package in 1.5; Debian:13 has only an open range,
+	// so the Debian:13 install has no fix, and a bare "Debian" entry counts
+	// for either release.
+	vulns := []*osvschema.Vulnerability{{Id: "DEBIAN-CVE-1", Affected: []*osvschema.Affected{
+		{
+			Package: &osvschema.Package{Name: "pkg", Ecosystem: "Debian:12"},
+			Ranges:  []*osvschema.Range{{Type: osvschema.Range_ECOSYSTEM, Events: []*osvschema.Event{{Introduced: "0"}, {Fixed: "1.5"}}}},
+		},
+		{
+			Package: &osvschema.Package{Name: "pkg", Ecosystem: "Debian:13"},
+			Ranges:  []*osvschema.Range{{Type: osvschema.Range_ECOSYSTEM, Events: []*osvschema.Event{{Introduced: "0"}}}},
+		},
+	}}}
+	if got := fixedFor(vulns, []string{"DEBIAN-CVE-1"}, models.PackageInfo{Name: "pkg", Version: "1.0", Ecosystem: "Debian:13"}); got != "" {
+		t.Fatalf("fixedFor = %q, want none for Debian:13 from a Debian:12 fix", got)
+	}
+	if got := fixedFor(vulns, []string{"DEBIAN-CVE-1"}, models.PackageInfo{Name: "pkg", Version: "1.0", Ecosystem: "Debian:12"}); got != "1.5" {
+		t.Fatalf("fixedFor = %q, want 1.5 for Debian:12", got)
+	}
+	bare := []*osvschema.Vulnerability{{Id: "DEBIAN-CVE-2", Affected: []*osvschema.Affected{{
+		Package: &osvschema.Package{Name: "pkg", Ecosystem: "Debian"},
+		Ranges:  []*osvschema.Range{{Type: osvschema.Range_ECOSYSTEM, Events: []*osvschema.Event{{Introduced: "0"}, {Fixed: "2.0"}}}},
+	}}}}
+	if got := fixedFor(bare, []string{"DEBIAN-CVE-2"}, models.PackageInfo{Name: "pkg", Version: "1.0", Ecosystem: "Debian:13"}); got != "2.0" {
+		t.Fatalf("fixedFor = %q, want 2.0 from a release-less entry", got)
+	}
+}
+
 func TestSeverityForGroupPrefersCVSS(t *testing.T) {
 	// CVSS present -> used even when database_specific differs.
 	pkg := models.PackageVulns{
```

---

### Incident Patch 14: `5d474d69` (2026-10-02)
**Commit Message**: fix(tenants): compare snapshot structure from pg_catalog, not pg_dump (#15511)

**File**: `backend/ee/onyx/db/tenant_snapshot.py` (modified, +342/-16)
```diff
@@ -25,6 +25,8 @@
     LargeBinary,
     Text,
     Uuid,
+    and_,
+    bindparam,
     case,
     cast,
     column,
@@ -109,6 +111,322 @@ def _schema_name_pattern(schema: str) -> re.Pattern[str]:
 # Where alembic.ini lives: the alembic subprocess and the head lookup run from here.
 _BACKEND_DIR = Path(__file__).resolve().parents[3]
 
+# The catalog tables the structure comparison reads.
+_PG_CATALOG = "pg_catalog"
+_pg_namespace = table(
+    "pg_namespace", column("oid"), column("nspname"), schema=_PG_CATALOG
+)
+_pg_class = table(
+    "pg_class",
+    column("oid"),
+    column("relname"),
+    column("relnamespace"),
+    column("relkind"),
+    column("relpersistence"),
+    column("relreplident"),
+    column("relrowsecurity"),
+    column("relforcerowsecurity"),
+    column("reloptions"),
+    column("relpartbound"),
+    schema=_PG_CATALOG,
+)
+_pg_policies = table(
+    "pg_policies",
+    column("schemaname"),
+    column("tablename"),
+    column("policyname"),
+    column("permissive"),
+    column("roles"),
+    column("cmd"),
+    column("qual"),
+    column("with_check"),
+    schema=_PG_CATALOG,
+)
+_pg_attribute = table(
+    "pg_attribute",
+    column("attrelid"),
+    column("attnum"),
+    column("attname"),
+    column("atttypid"),
+    column("atttypmod"),
+    column("attnotnull"),
+    column("attidentity"),
+    column("attgenerated"),
+    column("attisdropped"),
+    schema=_PG_CATALOG,
+)
+_pg_attrdef = table(
+    "pg_attrdef",
+    column("adrelid"),
+    column("adnum"),
+    column("adbin"),
+    schema=_PG_CATALOG,
+)
+_pg_constraint = table(
+    "pg_constraint",
+    column("oid"),
+    column("conname"),
+    column("connamespace"),
+    column("conrelid"),
+    schema=_PG_CATALOG,
+)
+_pg_index = table(
+    "pg_index",
+    column("indexrelid"),
+    column("indrelid"),
+    column("indisvalid"),
+    schema=_PG_CATALOG,
+)
+_pg_proc = table(
+    "pg_proc",
+    column("oid"),
+    column("proname"),
+    column("pronamespace"),
+    column("prokind"),
+    schema=_PG_CATALOG,
+)
+_pg_trigger = table(
+    "pg_trigger",
+    column("oid"),
+    column("tgname"),
+    column("tgrelid"),
+    column("tgisinternal"),
+    column("tgenabled"),
+    schema=_PG_CATALOG,
+)
+_pg_type = table(
+    "pg_type",
+    column("oid"),
+    column("typname"),
+    column("typnamespace"),
+    column("typtype"),
+    column("typbasetype"),
+    column("typtypmod"),
+    column("typnotnull"),
+    column("typdefault"),
+    schema=_PG_CATALOG,
+)
+_pg_range = table(
+    "pg_range", column("rngtypid"), column("rngsubtype"), schema=_PG_CATALOG
+)
+_pg_enum = table(
+    "pg_enum",
+    column("enumtypid"),
+    column("enumlabel"),
+    column("enumsortorder"),
+    schema=_PG_CATALOG,
+)
+_pg_sequences = table(
+    "pg_sequences",
+    column("schemaname"),
+    column("sequencename"),
+    column("data_type"),
+    column("start_value"),
+    column("min_value"),
+    column("max_value"),
+    column("increment_by"),
+    column("cycle"),
+    column("cache_size"),
+    schema=_PG_CATALOG,
+)
+_pg_depend = table(
+    "pg_depend",
+    column("objid"),
+    column("refobjid"),
+    column("refobjsubid"),
+    column("deptype"),
+    schema=_PG_CATALOG,
+)
+_schema_oid = (
+    select(_pg_namespace.c.oid)
+    .where(_pg_namespace.c.nspname == bindparam("schema"))
+    .scalar_subquery()
+)
+_in_schema = _pg_class.c.relnamespace == _schema_oid
+# relkind is a "char". The text form compares and sorts like any string.
+_relkind = cast(_pg_class.c.relkind, Text)
+_sequence_owner = _pg_class.alias("sequence_owner")
+_owned_sequence = _pg_class.alias("owned_sequence")
+# What Onyx schemas hold, each as one line of text. Any relation the other
+# queries do not break down still shows up here by kind and name.
+# Rows are ordered by name within each kind. Columns keep their table order.
+_STRUCTURE_QUERIES = (
+    select(
+        literal("relation"),
+        _relkind,
+        _pg_class.c.relname,
+        cast(_pg_class.c.relpersistence, Text),
+        cast(_pg_class.c.relreplident, Text),
+        _pg_class.c.relrowsecurity,
+        _pg_class.c.relforcerowsecurity,
+        # Storage options, and a view's security_invoker and barrier settings.
+        _pg_class.c.reloptions,
+        func.pg_get_partkeydef(_pg_class.c.oid),
+        func.pg_get_expr(_pg_class.c.relpartbound, _pg_class.c.oid),
+        case(
+            (_relkind.in_(["v", "m"]), func.pg_get_viewdef(_pg_class.c.oid)),
+            else_=literal(""),
+        ),
+    )
+    .where(_in_schema, _relkind != "i")
+    .order_by(_relkind, _pg_class.c.relname),
+    select(
+        literal("policy"),
+        _pg_policies.c.tablename,
+        _pg_policies.c.policyname,
+        _pg_policies.c.permissive,
+        _pg_policies.c.roles,
+        _pg_policies.c.cmd,
+        _pg_policies.c.qual,
+        _pg_policies.c.with_check,
+    )
+    .where(_pg_policies.c.schemaname == bindparam("schema"))
+    .order_by(_pg_po
```

**File**: `backend/tests/external_dependency_unit/db/test_tenant_snapshot_clone.py` (modified, +68/-0)
```diff
@@ -87,6 +87,74 @@ def test_parity_catches_a_missing_column(shard: str, clone: str) -> None:
     assert differences and differences[0] == "structure differs:"
 
 
+def test_parity_catches_an_extra_index(shard: str, clone: str) -> None:
+    with get_engine_for_shard(shard).begin() as connection:
+        connection.execute(
+            text(f'CREATE INDEX parity_extra ON "{clone}".persona (name)')
+        )
+
+    differences = tenant_snapshot.compare_schemas(shard, clone, TENANT_TEMPLATE_SCHEMA)
+    assert differences and differences[0] == "structure differs:"
+    assert any("parity_extra" in difference for difference in differences)
+
+
+def test_parity_catches_a_dropped_constraint(shard: str, clone: str) -> None:
+    with get_engine_for_shard(shard).begin() as connection:
+        constraint = connection.execute(
+            text(
+                "SELECT con.conname, c.relname FROM pg_constraint con "
+                "JOIN pg_class c ON c.oid = con.conrelid "
+                "WHERE con.connamespace = CAST(:schema AS regnamespace) "
+                "AND con.contype = 'f' "
+                "ORDER BY con.conname LIMIT 1"
+            ),
+            {"schema": f'"{clone}"'},
+        ).one()
+        connection.execute(
+            text(
+                f'ALTER TABLE "{clone}"."{constraint.relname}" '
+                f'DROP CONSTRAINT "{constraint.conname}"'
+            )
+        )
+
+    differences = tenant_snapshot.compare_schemas(shard, clone, TENANT_TEMPLATE_SCHEMA)
+    assert differences and differences[0] == "structure differs:"
+    assert any(constraint.conname in difference for difference in differences)
+
+
+def test_parity_catches_a_dropped_trigger(shard: str, clone: str) -> None:
+    with get_engine_for_shard(shard).begin() as connection:
+        trigger = connection.execute(
+            text(
+                "SELECT t.tgname, c.relname FROM pg_trigger t "
+                "JOIN pg_class c ON c.oid = t.tgrelid "
+                "WHERE c.relnamespace = CAST(:schema AS regnamespace) "
+                "AND NOT t.tgisinternal "
+                "ORDER BY t.tgname LIMIT 1"
+            ),
+            {"schema": f'"{clone}"'},
+        ).one()
+        connection.execute(
+            text(
+                f'ALTER TABLE "{clone}"."{trigger.relname}" '
+                f'DISABLE TRIGGER "{trigger.tgname}"'
+            )
+        )
+
+    differences = tenant_snapshot.compare_schemas(shard, clone, TENANT_TEMPLATE_SCHEMA)
+    assert differences and differences[0] == "structure differs:"
+    assert any(trigger.tgname in difference for difference in differences)
+
+    with get_engine_for_shard(shard).begin() as connection:
+        connection.execute(
+            text(f'DROP TRIGGER "{trigger.tgname}" ON "{clone}"."{trigger.relname}"')
+        )
+
+    differences = tenant_snapshot.compare_schemas(shard, clone, TENANT_TEMPLATE_SCHEMA)
+    assert differences and differences[0] == "structure differs:"
+    assert any(trigger.tgname in difference for difference in differences)
+
+
 def test_parity_ignores_the_migration_date_seed(shard: str, clone: str) -> None:
     # The knowledge graph config is seeded with the migration's run date.
     with get_engine_for_shard(shard).begin() as connection:
```

---

### Incident Patch 15: `8df0ca43` (2026-10-02)
**Commit Message**: chore(migrations): require deterministic rows in new revisions (#15405)

**File**: `.greptile/rules.md` (modified, +4/-0)
```diff
@@ -24,6 +24,10 @@ When hardcoding a boolean variable to a constant value, remove the variable enti
 
 Code changes must consider both multi-tenant and single-tenant deployments. In multi-tenant mode, preserve tenant isolation, ensure tenant context is propagated correctly, and avoid assumptions that only hold for a single shared schema or globally shared state. In single-tenant mode, avoid introducing unnecessary tenant-specific requirements or cloud-only control-plane dependencies.
 
+## Migration Rows Are Deterministic
+
+A new revision under `backend/alembic/versions` may insert rows, and those rows must be identical on every schema: fixed ids and literal values, no `uuid4()`, `now()`, `gen_random_uuid()`, randomness or env reads, in Python or in the SQL text, anywhere but `downgrade`. The template schema is migrated once, snapshotted and cloned into every new tenant, and the deploy gate compares it with a fresh build of the chain, so a run-dependent value makes template and tenants diverge. Schema defaults such as `server_default=now()` and updates to existing rows are fine. A deliberate exception carries `# migration-determinism: allow` on its statement. Flag any run-dependent value in an insert and ask for a fixed one.
+
 ## Routing for New Non-/api Backend Routes
 
 Whenever a new backend route is added that does NOT start with `/api`, it must be explicitly routed in ALL nginx configs:
```

**File**: `.pre-commit-config.yaml` (modified, +8/-0)
```diff
@@ -288,6 +288,14 @@ repos:
             (cli|tools/ods|tools/ods-audit)/pyproject\.toml
             |tools/requirements/build-constraints\.in
           )$
+      - id: migration-determinism
+        name: migration rows are deterministic
+        description: "Fail a new tenant-chain revision that seeds rows with run-dependent values"
+        language: system
+        entry: python3 backend/scripts/check_migration_determinism.py
+        pass_filenames: true
+        stages: [pre-commit]
+        files: ^backend/alembic/versions/.*\.py$
       # Regenerate the baseline with `env_inventory.py --write-baseline`.
       - id: env-drift-baseline
         name: env drift baseline
```

**File**: `backend/AGENTS.md` (modified, +7/-0)
```diff
@@ -95,6 +95,13 @@ uv run alembic -n schema_private revision -m "description"
 
 Write the migration manually and place it in the file that alembic creates when running the above command.
 
+Rows a revision in `alembic/versions` inserts must be identical on every schema: fixed ids and
+literal values, no `uuid4()`, `now()`, randomness or env reads. The template snapshot is cloned
+into new tenants and compared with a fresh build on deploy, so a run-dependent value breaks the
+comparison. Schema defaults and updates to existing rows are fine.
+`scripts/check_migration_determinism.py` enforces this on commit for revisions newer than the
+rule, and `# migration-determinism: allow` marks a deliberate exception.
+
 ## Testing Strategy
 
 Run pytest through `uv run` from the repo root — no venv activation needed (`uv run` uses the
```

**File**: `backend/scripts/check_migration_determinism.py` (added, +213/-0)
```diff
@@ -0,0 +1,213 @@
+#!/usr/bin/env python3
+"""Fail when a tenant-chain migration seeds rows with run-dependent values.
+
+The template schema is migrated once, snapshotted and cloned into every new
+tenant, and the deploy gate compares it with a fresh build of the chain. A
+row a revision inserts must therefore be the same on every schema: fixed ids
+and literal values, no generated uuids, clock reads, randomness or env reads.
+Schema defaults such as server_default now() are not rows and are fine.
+Revisions at or before the marker are history and are left alone by walking
+the chain from it.
+
+Usage, from the repo root:
+    python3 backend/scripts/check_migration_determinism.py backend/alembic/versions/<rev>_*.py ...
+"""
+
+import ast
+import re
+import sys
+from pathlib import Path
+
+# Head of the chain when the rule landed. Everything at or before it is history.
+_RULE_LANDED_AT = "25053020dd5a"
+# A deliberate exception, such as a value the gate is known to ignore, opts out per statement.
+ALLOW_MARKER = "migration-determinism: allow"
+_BACKEND_DIR = Path(__file__).resolve().parents[1]
+_VERSIONS_DIR = _BACKEND_DIR / "alembic" / "versions"
+_REVISION_LINE = re.compile(r'^revision(?:\s*:[^=]+)?\s*=\s*"(\w+)"', re.MULTILINE)
+_DOWN_REVISION_LINE = re.compile(r"^down_revision(?:\s*:[^=]+)?\s*=(.*)$", re.MULTILINE)
+_REVISION_ID = re.compile(r'"(\w+)"')
+_INSERT_SQL = re.compile(r"\bINSERT\s+INTO\b", re.IGNORECASE)
+# Only inside an INSERT statement: a schema default or an UPDATE may use these.
+_RUN_DEPENDENT_SQL = re.compile(
+    r"\b(?:now|clock_timestamp|gen_random_uuid|uuid_generate_v\d|random)\s*\(|\bcurrent_timestamp\b",
+    re.IGNORECASE,
+)
+# Run-dependent anywhere in a migration, since the value only exists to be written.
+_RUN_DEPENDENT_CALLS = {
+    "uuid1",
+    "uuid4",
+    "utcnow",
+    "time",
+    "getenv",
+    "random",
+    "randint",
+    "choice",
+    "token_hex",
+    "token_urlsafe",
+}
+_CLOCKS = {"datetime", "date"}
+# Run-dependent unless it defines a column default or updates rows that exist.
+_DEFAULT_CALLS = {"now", "gen_random_uuid"}
+_NOT_ROW_CALLS = {"Column", "create_table", "add_column", "alter_column"}
+_SQLALCHEMY_MODULES = {"sa", "sqlalchemy"}
+
+
+class _RunDependentFinder(ast.NodeVisitor):
+    """Collects values that differ between runs, erring toward flagging. The
+    allow marker clears the rare deliberate exception."""
+
+    def __init__(self, lines: list[str]) -> None:
+        self._lines = lines
+        self._statement: ast.stmt | None = None
+        self._not_row_depth = 0
+        self.found: set[int] = set()
+
+    def visit(self, node: ast.AST) -> None:
+        if isinstance(node, ast.stmt):
+            self._statement = node
+        super().visit(node)
+
+    def _flag(self, node: ast.expr) -> None:
+        """The marker exempts one node: on its own lines or its statement's first."""
+        if self._statement is None:
+            return
+        end = node.end_lineno or node.lineno
+        marked = [
+            self._lines[self._statement.lineno - 1],
+            *self._lines[node.lineno - 1 : end],
+        ]
+        if not any(ALLOW_MARKER in line for line in marked):
+            self.found.add(node.lineno)
+
+    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
+        # downgrade may restore what it removed, with whatever values it had.
+        if node.name != "downgrade":
+            self.generic_visit(node)
+
+    def visit_Expr(self, node: ast.Expr) -> None:
+        # A docstring may describe values without producing one.
+        if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
+            return
+        self.generic_visit(node)
+
+    def visit_Subscript(self, node: ast.Subscript) -> None:
+        if _terminal_name(node.value) == "environ":
+            self._flag(node)
+        self.generic_visit(node)
+
+    def visit_Call(self, node: ast.Call) -> None:
+        name = _terminal_name(node.func)
+        receiver = node.func.value if isinstance(node.func, ast.Attribute) else None
+        if name in _RUN_DEPENDENT_CALLS or (
+            name == "now" and _terminal_name(receiver) in _CLOCKS
+        ):
+            self._flag(node)
+        elif name in _DEFAULT_CALLS and not self._not_row_depth:
+            self._flag(node)
+        elif name == "get" and _terminal_name(receiver) == "environ":
+            self._flag(node)
+        not_row = any(
+            _terminal_name(call.func) in _NOT_ROW_CALLS or _is_sqlalchemy_update(call)
+            for call in _chain_calls(node)
+        )
+        self._not_row_depth += not_row
+        self.generic_visit(node)
+        self._not_row_depth -= not_row
+
+    def visit_Constant(self, node: ast.Constant) -> None:
+        if not isinstance(node.value, str) or not _INSERT_SQL.search(node.value):
+            return
+        if _RUN_DEPENDENT_SQL.search(node.value):
+            self._flag(node)
+
+
+def _chain_calls(node: as
```

**File**: `backend/tests/unit/scripts/test_check_migration_determinism.py` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
+"""The migration determinism check flags run-dependent values anywhere in a
+new revision but its downgrade, leaves schema defaults, updates, history and
+allow-marked statements alone, and walks the chain to find history."""
+
+from pathlib import Path
+
+import pytest
+from scripts import check_migration_determinism
+
+_MARKER = "mmm"
+
+
+def _in_upgrade(line: str) -> str:
+    return f"def upgrade() -> None:\n    {line}\n"
+
+
+@pytest.mark.parametrize(
+    "line",
+    [
+        'op.execute("INSERT INTO tool (id, created_at) VALUES (1, now())")',
+        'op.execute("INSERT INTO tool (id) VALUES (gen_random_uuid())")',
+        'op.execute("INSERT INTO tool (id, at) VALUES (1, current_timestamp)")',
+        "op.execute(insert(tool_table).values(id=uuid4(), name='x'))",
+        "op.execute(insert(tool_table).values(id=1, created_at=func.now()))",
+        "op.execute(tool_table.insert().values(id=1, created_at=sa.func.now()))",
+        "op.bulk_insert(tool_table, [{'id': str(uuid.uuid4())}])",
+        "new_id = uuid4()",
+        "stamp = func.now()",
+        "row.update({'created_at': sa.func.now()})",
+        "op.bulk_insert(tool_table, [{'id': 1, 'created_at': sa.func.now()}])",
+        "stamp = datetime.now()",
+        "stamp = datetime.datetime.utcnow()",
+        "seed = random.randint(1, 10)",
+        'api_key = os.environ["EXA_API_KEY"]',
+        'api_key = os.getenv("EXA_API_KEY")',
+        'api_key = os.environ.get("EXA_API_KEY")',
+    ],
+)
+def test_run_dependent_values_are_flagged(line: str) -> None:
+    assert check_migration_determinism.find_run_dependent_values(_in_upgrade(line)) == [
+        2
+    ]
+
+
+@pytest.mark.parametrize(
+    "line",
+    [
+        'op.add_column("tool", sa.Column("c", sa.DateTime(), server_default=sa.text("now()")))',
+        'op.add_column("tool", sa.Column("c", sa.DateTime(), server_default=func.now()))',
+        'op.create_table("t", sa.Column("c", sa.DateTime(), server_default=sa.func.now()))',
+        'op.alter_column("tool", "c", server_default=func.now())',
+        "op.execute(sa.update(tool).values(updated_at=sa.func.now()))",
+        "op.execute(tool_table.update().values(updated_at=sa.func.now()))",
+        "op.execute(update(tool).where(tool.c.id == 1).values(updated_at=func.now()))",
+        "op.execute(\"UPDATE tool SET updated_at = now() WHERE name = 'x'\")",
+        "op.execute(\"INSERT INTO tool (id, name) VALUES (1, 'x')\")",
+        "op.execute(insert(tool_table).values(id=1, name='x'))",
+        "op.bulk_insert(tool_table, [{'id': 1, 'name': 'x'}])",
+        '"""ids were generated with uuid4() at the time"""',
+        "op.execute(insert(t).values(id=uuid4()))  # migration-determinism: allow",
+    ],
+)
+def test_fixed_values_and_schema_defaults_pass(line: str) -> None:
+    assert (
+        check_migration_determinism.find_run_dependent_values(_in_upgrade(line)) == []
+    )
+
+
+def test_marker_exempts_only_its_own_value() -> None:
+    source = (
+        "def upgrade() -> None:\n    op.execute(\n"
+        '        "INSERT INTO a VALUES (now())",  # migration-determinism: allow\n'
+        '        "INSERT INTO b VALUES (now())",\n    )\n'
+    )
+    assert check_migration_determinism.find_run_dependent_values(source) == [4]
+
+
+def test_only_the_downgrade_body_is_skipped() -> None:
+    source = (
+        'def upgrade() -> None:\n    op.execute("DELETE FROM tool")\n\n\n'
+        "def downgrade() -> None:\n    op.bulk_insert(t, [{'id': uuid4()}])\n"
+        "SEED_ID = uuid4()\n"
+    )
+    assert check_migration_determinism.find_run_dependent_values(source) == [7]
+
+
+def test_module_level_helper_is_flagged() -> None:
+    source = (
+        "def _seed() -> None:\n    op.bulk_insert(t, [{'id': uuid4()}])\n\n\n"
+        "def upgrade() -> None:\n    _seed()\n"
+    )
+    assert check_migration_determinism.find_run_dependent_values(source) == [2]
+
+
+def _write_revision(
+    versions: Path, revision: str, down_revision: str, body: str = "pass"
+) -> Path:
+    path = versions / f"{revision}_x.py"
+    path.write_text(
+        f'revision = "{revision}"\ndown_revision = {down_revision}\n\n\n'
+        f"def upgrade() -> None:\n    {body}\n"
+    )
+    return path
+
+
+@pytest.fixture
+def versions(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
+    """base -> aaa -> bbb and base -> ccc merge into the marker mmm."""
+    directory = tmp_path.resolve() / "versions"
+    directory.mkdir()
+    monkeypatch.setattr(check_migration_determinism, "_VERSIONS_DIR", directory)
+    monkeypatch.setattr(check_migration_determinism, "_RULE_LANDED_AT", _MARKER)
+    (directory / "base_x.py").write_text(
+        'revision = "base"\ndown_revision: None = None\n'
+    )
+    _write_revision(directory, "aaa", '"base"')
+    _write_revision(directory, "bbb", '"aaa"')
+    _write_revision(directory, "ccc", '"base"')
+    _write_revision(directory, _MARKER, '("bbb", "ccc")')
+    return d
```

#### Recent Merged Pull Requests:
- **PR #15597** (2026-10-06): fix(opal): stop dropdowns from scrolling the page when they open (@raunakab)
- **PR #15590** (2026-10-06): fix(deps): override tinypool to 2.1.2 to unblock audit (#15573) to release v4.6 (@nmgarza5)
- **PR #15589** (2026-10-06): fix(deps): override tinypool to 2.1.2 to unblock audit (#15573) to release v4.7 (@nmgarza5)
- **PR #15588** (2026-10-06): fix(deps): override tinypool to 2.1.2 to unblock audit (#15573) to release v4.8 (@nmgarza5)
- **PR #15587** (2026-10-06): fix(deps): override tinypool to 2.1.2 to unblock audit (#15573) to release v4.9 (@nmgarza5)
- **PR #15578** (2026-10-06): fix(deps): pin tinypool to 2.1.2 (@onyx-cherry-pick[bot])
- **PR #15576** (2026-10-06): feat(ci): a failed pull-request audit dispatches the CVE alerts on main (@nmgarza5)
- **PR #15573** (2026-10-06): fix(deps): override tinypool to 2.1.2 to unblock audit (@rohoswagger)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
