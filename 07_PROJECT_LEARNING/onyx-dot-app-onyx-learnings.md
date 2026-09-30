# Forensic Learning Record (Deep Inspection): onyx-dot-app/onyx

> **Canonical Artifact**: `07_PROJECT_LEARNING/onyx-dot-app-onyx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/onyx-dot-app/onyx](https://github.com/onyx-dot-app/onyx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:42:41.449Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `onyx-dot-app/onyx`
- **Description**: Open Source AI Platform - AI Chat with advanced features that works with every LLM
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 32300 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.zed/dotenv_launch.py`
```
"""In-process `envFile` shim for Zed's debugger.

Zed passes debug configurations straight through to debugpy, and debugpy has no
`envFile` field -- that field is a VS Code Python-extension feature, resolved
before debugpy ever sees the request. Without this shim, every launch config
ported from `.vscode/launch.json` starts with an empty environment.

This script loads the env file into the current process, then runs the real
target in that same process. One process means breakpoints, stepping and
`justMyCode` behave exactly as they do under VS Code.

Usage:
    dotenv_launch.py <env-file> --module <name> [args...]
    dotenv_launch.py <env-file> --program <path> [args...]

Values already in the environment win, which matches VS Code, where `env`
overrides `envFile`.
"""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent


def resolve_env_file(raw: str) -> Path | None:
    """Find the env file relative to the CWD, then to the repo root."""
    candidates = (
        [Path(raw)] if Path(raw).is_absolute() else [Path(raw), REPO_ROOT / raw]
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def main() -> None:
    argv = sys.argv[1:]
    if len(argv) < 3:
        raise SystemExit(
            f"usage: {Path(sys.argv[0]).name} <env-file> "
            "(--module <name> | --program <path>) [args...]"
        )

    raw_env_file, kind, target = argv[0], argv[1], argv[2]
    target_args = argv[3:]

    env_file = resolve_env_file(raw_env_file)
    if env_file is None:
        print(
            f"dotenv_launch: env file not found, starting without it: {raw_env_file}",
            file=sys.stderr,
        )
    else:
        load_dotenv(env_file, override=False)

    if kind == "--module":
        # Reproduce `python -m`, which puts the working directory on sys.path.
        sys.path.insert(0, "")
        sys.argv = [target, *target_args]
        runpy.run_module(target, run_name="__main__", alter_sys=True)
    elif kind == "--program":
        script = Path(target).resolve()
        sys.path.insert(0, str(script.parent))
        sys.argv = [str(script), *target_args]
        runpy.run_path(str(script), run_name="__main__")
    else:
        raise SystemExit(
            f"unknown target kind {kind!r}; expected --module or --program"
        )


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `backend/alembic/env.py`
```
from onyx.db.engine.iam_auth import make_provide_iam_token_async
from onyx.db.engine.migration_lock import schema_migration_lock
from onyx.db.engine.pg_ssl import create_pg_ssl_context
from onyx.configs.app_configs import USE_IAM_AUTH
from onyx.configs.app_configs import POSTGRES_HOST
from onyx.configs.app_configs import POSTGRES_PORT
from onyx.configs.app_configs import POSTGRES_USER
from onyx.db.engine.shard_registry import ALEMBIC_TARGET_URL_ATTRIBUTE
from onyx.db.engine.shard_registry import get_shard_spec
from onyx.db.engine.shard_registry import validate_shard_name
from onyx.db.engine.shard_registry import is_sharded
from onyx.db.engine.sql_engine import build_connection_string
from onyx.db.engine.tenant_utils import get_tenant_ids_by_shard
from sqlalchemy import event
from sqlalchemy import pool
from sqlalchemy import text
from sqlalchemy.engine.url import make_url
from sqlalchemy.engine.base import Connection
import os
from itertools import chain
import asyncio
import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy.ext.asyncio import create_async_engine
from onyx.configs.constants import SSL_CERT_FILE
from shared_configs.configs import (
    MULTI_TENANT,
    POSTGRES_DEFAULT_SCHEMA,
    TENANT_ID_PREFIX,
)
from shared_configs.contextvars import CURRENT_TENANT_ID_CONTEXTVAR
from onyx.db.models import Base
from celery.backends.database.session import (
    ResultModelBase,  # ty: ignore[unresolved-import]
)
from onyx.db.engine.sql_engine import SqlEngine
from onyx.utils.variable_functionality import set_is_ee_based_on_env_variable

# Match the app processes' edition so migrations that use versioned
# implementations (e.g. encrypt_string_to_bytes) resolve the EE variants.
set_is_ee_based_on_env_variable()

# Make sure in alembic.ini [logger_root] level=INFO is set or most logging will be
# hidden! (defaults to level=WARN)

# Alembic Config object
config = context.config

if config.config_file_name is not None and config.attributes.get(
    "configure_logger", True
):
    # disable_existing_loggers=False prevents breaking pytest's caplog fixture
    # See: https://pytest-alembic.readthedocs.io/en/latest/setup.html#caplog-issues
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = [Base.metadata, ResultModelBase.metadata]

logger = logging.getLogger(__name__)


def connection_url(shard_name: str | None = None) -> str:
    """Database URL for this migration run.

    In precedence order: a caller that has already decided which database to target
    (per-tenant migrations, via `ALEMBIC_TARGET_URL_ATTRIBUTE`), then an explicit
    shard, then the process-wide POSTGRES_* settings.
    """
    configured = config.attributes.get(ALEMBIC_TARGET_URL_ATTRIBUTE)
    if configured:
        return configured

    if shard_name is None:
        return build_connection_string()

    spec = get_shard_spec(shard_name)
    return build_connection_string(
        user=spec.user,
        password=spec.password,
        host=spec.host,
        port=spec.port,
        db=spec.db,
    )


# Fail at import rather than on the first connection. The context itself is built by
# `create_pg_ssl_context`, which both the engine and the IAM listener use.
if USE_IAM_AUTH and not os.path.exists(SSL_CERT_FILE):
    raise FileNotFoundError(f"Expected {SSL_CERT_FILE} when USE_IAM_AUTH is true.")


def filter_tenants_by_range(
    tenant_ids: list[str], start_range: int | None = None, end_range: int | None = None
) -> list[str]:
    """
    Filter tenant IDs by alphabetical position range.

    Args:
        tenant_ids: List of tenant IDs to filter
        start_range: Starting position in alphabetically sorted list (1-based, inclusive)
        end_range: Ending position in alphabetically sorted list (1-based, inclusive)

    Returns:
        Filtered list of tenant IDs in their original order
    """
    if start_range is None and end_range is None:
        return tenant_ids

    # Separate tenant IDs from non-tenant schemas
    tenant_schemas = [tid for tid in tenant_ids if tid.startswith(TENANT_ID_PREFIX)]
    non_tenant_schemas = [
        tid for tid in tenant_ids if not tid.startswith(TENANT_ID_PREFIX)
    ]

    # Sort tenant schemas alphabetically.
    # NOTE: can cause missed schemas if a schema is created in between workers
    # fetching of all tenant IDs. We accept this risk for now. Just re-running
    # the migration will fix the issue.
    sorted_tenant_schemas = sorted(tenant_schemas)

    # Apply range filtering (0-based indexing)
    start_idx = start_range if start_range is not None else 0
    end_idx = end_range if end_range is not None else len(sorted_tenant_schemas)

    # Ensure indices are within bounds
    start_idx = max(0, start_idx)
    end_idx = min(len(sorted_tenant_schemas), end_idx)

    # Get the filtered tenant schemas
    filtered_tenant_schemas = sorted_tenant_schemas[start_idx:end_idx]

    # Combine with non-tenant schemas and preserve original order
    filtered_tenants = [
        tenant_id
        for tenant_id in tenant_ids
        if tenant_id in filtered_tenant_schemas or tenant_id in non_tenant_schemas
    ]

    return filtered_tenants


def get_schema_options() -> tuple[
    bool, bool, bool, int | None, int | None, list[str] | None, str | None
]:
    x_args_raw = context.get_x_argument()
    x_args = {}
    for arg in x_args_raw:
        if "=" in arg:
            key, value = arg.split("=", 1)
            x_args[key.strip()] = value.strip()
        else:
            raise ValueError(f"Invalid argument: {arg}")

    create_schema = x_args.get("create_schema", "true").lower() == "true"
    upgrade_all_tenants = x_args.get("upgrade_all_tenants", "false").lower() == "true"

    # continue on error with individual tenant
    # only applies to online migrations
    continue_on_error = x_args.get("continue", "false").lower() == "true"

    # Tenant range filtering
    tenant_range_start = None
    tenant_range_end = None

    if "tenant_range_start" in x_args:
        try:
            tenant_range_start = int(x_args["tenant_range_start"])
        except ValueError:
            raise ValueError(
                f"Invalid tenant_range_start value: {x_args['tenant_range_start']}. Must be an integer."
            )

    if "tenant_range_end" in x_args:
        try:
            tenant_range_end = int(x_args["tenant_range_end"])
        except ValueError:
            raise ValueError(
                f"Invalid tenant_range_end value: {x_args['tenant_range_end']}. Must be an integer."
            )

    # Validate range
    if tenant_range_start is not None and tenant_range_end is not None:
        if tenant_range_start > tenant_range_end:
            raise ValueError(
                f"tenant_range_start ({tenant_range_start}) cannot be greater than tenant_range_end ({tenant_range_end})"
            )

    # Specific schema names filtering (replaces both schema_name and the old tenant_ids approach)
    schemas = None
    if "schemas" in x_args:
        schema_names_str = x_args["schemas"].strip()
        if schema_names_str:
            # Split by comma and strip whitespace
            schemas = [
                name.strip() for name in schema_names_str.split(",") if name.strip()
            ]
            if schemas:
                logger.info("Specific schema names specified: %s", schemas)

    # Validate that only one method is used at a time
    range_filtering = tenant_range_start is not None or tenant_range_end is not None
    specific_filtering = schemas is not None and len(schemas) > 0

    if range_filtering and specific_filtering:
        raise ValueError(
            "Cannot use both tenant range filtering (tenant_range_start/tenant_range_end) "
            "and specific schema filtering (schemas) at the same time. "
            "Please use only one filtering method."
        )

    if upgrade_all_tenants a
```

### Core Architecture Module: `backend/alembic/run_multitenant_migrations.py`
```
#!/usr/bin/env python3
"""Parallel Alembic Migration Runner

Upgrades tenant schemas to head in batched, parallel alembic subprocesses.
Each subprocess handles a batch of schemas (via ``-x schemas=a,b,c``),
reducing per-process overhead compared to one-schema-per-process.

Usage examples::

    # defaults: 6 workers, 50 schemas/batch
    python alembic/run_multitenant_migrations.py

    # custom settings
    python alembic/run_multitenant_migrations.py -j 8 -b 100
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import NamedTuple

from alembic.config import Config
from alembic.script import ScriptDirectory

from onyx.db.engine.sql_engine import SqlEngine
from onyx.db.engine.tenant_utils import get_schemas_needing_migration
from onyx.db.engine.tenant_utils import get_tenant_ids_by_shard
from shared_configs.configs import TENANT_ID_PREFIX

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


class Args(NamedTuple):
    jobs: int
    batch_size: int


class Batch(NamedTuple):
    shard_name: str
    schemas: list[str]


class BatchResult(NamedTuple):
    schemas: list[str]
    success: bool
    output: str
    elapsed_sec: float


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------


def run_alembic_for_batch(batch: Batch) -> BatchResult:
    """Run ``alembic upgrade head`` for a batch of schemas in one subprocess.

    If the batch fails, it is automatically retried with ``-x continue=true``
    so that the remaining schemas in the batch still get migrated.  The retry
    output (which contains alembic's per-schema error messages) is returned
    for diagnosis.
    """
    schemas = batch.schemas
    csv = ",".join(schemas)
    # `shard` pins the subprocess to the database holding these schemas.
    base_cmd = ["alembic", "-x", f"schemas={csv}", "-x", f"shard={batch.shard_name}"]

    start = time.monotonic()
    result = subprocess.run(
        [*base_cmd, "upgrade", "head"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    if result.returncode == 0:
        elapsed = time.monotonic() - start
        return BatchResult(schemas, True, result.stdout or "", elapsed)

    # At least one schema failed.  Print the initial error output, then
    # re-run with continue=true so the remaining schemas still get migrated.
    if result.stdout:
        print(f"Initial error output:\n{result.stdout}", file=sys.stderr, flush=True)
    print(
        f"Batch failed (exit {result.returncode}), retrying with 'continue=true'...",
        file=sys.stderr,
        flush=True,
    )

    retry = subprocess.run(
        [*base_cmd, "-x", "continue=true", "upgrade", "head"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    elapsed = time.monotonic() - start
    return BatchResult(schemas, False, retry.stdout or "", elapsed)


def get_head_revision() -> str | None:
    """Get the head revision from the alembic script directory."""
    alembic_cfg = Config("alembic.ini")
    script = ScriptDirectory.from_config(alembic_cfg)
    return script.get_current_head()


def run_migrations_parallel(
    schemas_by_shard: dict[str, list[str]],
    max_workers: int,
    batch_size: int,
) -> bool:
    """Chunk each shard's schemas into batches and run them in parallel.

    Batches never span shards, so one subprocess talks to exactly one database.

    A background monitor thread prints a status line every 60 s listing
    which batches are still in-flight, making it easy to spot hung tenants.
    """
    batches = [
        Batch(shard_name, shard_schemas[i : i + batch_size])
        for shard_name, shard_schemas in sorted(schemas_by_shard.items())
        for i in range(0, len(shard_schemas), batch_size)
    ]
    total_batches = len(batches)
    total_schemas = sum(len(s) for s in schemas_by_shard.values())
    print(
        f"{total_schemas} schemas across {len(schemas_by_shard)} shard(s) in "
        f"{total_batches} batch(es) with {max_workers} workers (batch size: {batch_size})...",
        flush=True,
    )
    all_success = True

    # Thread-safe tracking of in-flight batches for the monitor thread.
    in_flight: dict[int, list[str]] = {}
    prev_in_flight: set[int] = set()
    lock = threading.Lock()
    stop_event = threading.Event()

    def _monitor() -> None:
        """Print a status line every 60 s listing batches still in-flight.

        Only prints batches that were also present in the previous tick,
        making it easy to spot batches that are stuck.
        """
        nonlocal prev_in_flight
        while not stop_event.wait(60):
            with lock:
                if not in_flight:
                    prev_in_flight = set()
                    continue
                current = set(in_flight)
                stuck = current & prev_in_flight
                prev_in_flight = current

                if not stuck:
                    continue

                schemas = [s for idx in sorted(stuck) for s in in_flight[idx]]
                print(
                    f"⏳ batch(es) still running since last check "
                    f"({', '.join(str(i + 1) for i in sorted(stuck))}): "
                    + ", ".join(schemas),
                    flush=True,
                )

    monitor_thread = threading.Thread(target=_monitor, daemon=True)
    monitor_thread.start()

    try:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:

            def _run(batch_idx: int, batch: Batch) -> BatchResult:
                with lock:
                    in_flight[batch_idx] = batch.schemas
                print(
                    f"Batch {batch_idx + 1}/{total_batches} started on shard "
                    f"{batch.shard_name} ({len(batch.schemas)} schemas): "
                    f"{', '.join(batch.schemas)}",
                    flush=True,
                )
                result = run_alembic_for_batch(batch)
                with lock:
                    in_flight.pop(batch_idx, None)
                return result

            future_to_idx = {
                executor.submit(_run, i, b): i for i, b in enumerate(batches)
            }

            for future in as_completed(future_to_idx):
                batch_idx = future_to_idx[future]
                try:
                    result = future.result()
                    status = "✓" if result.success else "✗"

                    print(
                        f"Batch {batch_idx + 1}/{total_batches} "
                        f"{status} {len(result.schemas)} schemas "
                        f"in {result.elapsed_sec:.1f}s",
                        flush=True,
                    )

                    if not result.success:
                        # Print last 20 lines of retry output for diagnosis
                        tail = result.output.strip().splitlines()[-20:]
                        for line in tail:
                            print(f"    {line}", flush=True)
                        all_success = False

                except Exception as e:
                    print(
                        f"Batch {batch_idx + 1}/{total_batches} ✗ exception: {e}",
                        flush=True,
                    )
                    all_success = False
    finally:
        stop_event.set()
        monitor_thread.join(timeout=2)

    return all_success


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args() -> Args:
    parser = argparse.ArgumentParser(
        description="Run alembic migrations fo
```

### Core Architecture Module: `backend/alembic/versions/01c63968ff8f_add_ssrf_protection_level_to_security_.py`
```
"""add ssrf_protection_level to security_settings

Revision ID: 01c63968ff8f
Revises: 1cb59a95b250
Create Date: 2026-06-09 17:11:49.835715

"""

from alembic import op
import sqlalchemy as sa

from onyx.server.security.models import SSRFProtectionLevel


# revision identifiers, used by Alembic.
revision = "01c63968ff8f"
down_revision = "1cb59a95b250"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "security_settings",
        sa.Column(
            "ssrf_protection_level",
            sa.Enum(
                SSRFProtectionLevel,
                native_enum=False,
                values_callable=lambda x: [e.value for e in x],
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("security_settings", "ssrf_protection_level")

```

### Core Architecture Module: `backend/alembic/versions/01f8e6d95a33_populate_flow_mapping_data.py`
```
"""Populate flow mapping data

Revision ID: 01f8e6d95a33
Revises: d5c86e2c6dc6
Create Date: 2026-01-31 17:37:10.485558

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "01f8e6d95a33"
down_revision = "d5c86e2c6dc6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add each model config to the conversation flow, setting the global default if it exists
    # Exclude models that are part of ImageGenerationConfig
    op.execute("""
        INSERT INTO llm_model_flow (llm_model_flow_type, is_default, model_configuration_id)
        SELECT
            'CHAT' AS llm_model_flow_type,
            COALESCE(
                (lp.is_default_provider IS TRUE AND lp.default_model_name = mc.name),
                FALSE
            ) AS is_default,
            mc.id AS model_configuration_id
        FROM model_configuration mc
        LEFT JOIN llm_provider lp
            ON lp.id = mc.llm_provider_id
        WHERE NOT EXISTS (
            SELECT 1 FROM image_generation_config igc
            WHERE igc.model_configuration_id = mc.id
        );
        """)

    # Add models with supports_image_input to the vision flow
    op.execute("""
        INSERT INTO llm_model_flow (llm_model_flow_type, is_default, model_configuration_id)
        SELECT
            'VISION' AS llm_model_flow_type,
            COALESCE(
                (lp.is_default_vision_provider IS TRUE AND lp.default_vision_model = mc.name),
                FALSE
            ) AS is_default,
            mc.id AS model_configuration_id
        FROM model_configuration mc
        LEFT JOIN llm_provider lp
            ON lp.id = mc.llm_provider_id
        WHERE mc.supports_image_input IS TRUE;
        """)


def downgrade() -> None:
    # Populate vision defaults from model_flow
    op.execute("""
        UPDATE llm_provider AS lp
        SET
            is_default_vision_provider = TRUE,
            default_vision_model = mc.name
        FROM llm_model_flow mf
        JOIN model_configuration mc ON mc.id = mf.model_configuration_id
        WHERE mf.llm_model_flow_type = 'VISION'
          AND mf.is_default = TRUE
          AND mc.llm_provider_id = lp.id;
        """)

    # Populate conversation defaults from model_flow
    op.execute("""
        UPDATE llm_provider AS lp
        SET
            is_default_provider = TRUE,
            default_model_name = mc.name
        FROM llm_model_flow mf
        JOIN model_configuration mc ON mc.id = mf.model_configuration_id
        WHERE mf.llm_model_flow_type = 'CHAT'
          AND mf.is_default = TRUE
          AND mc.llm_provider_id = lp.id;
        """)

    # For providers that have conversation flow mappings but aren't the default,
    # we still need a default_model_name (it was NOT NULL originally)
    # Pick the first visible model or any model for that provider
    op.execute("""
        UPDATE llm_provider AS lp
        SET default_model_name = (
            SELECT mc.name
            FROM model_configuration mc
            JOIN llm_model_flow mf ON mf.model_configuration_id = mc.id
            WHERE mc.llm_provider_id = lp.id
              AND mf.llm_model_flow_type = 'CHAT'
            ORDER BY mc.is_visible DESC, mc.id ASC
            LIMIT 1
        )
        WHERE lp.default_model_name IS NULL;
        """)

    # Delete all model_flow entries (reverse the inserts from upgrade)
    op.execute("DELETE FROM llm_model_flow;")

```

### Core Architecture Module: `backend/alembic/versions/027381bce97c_add_shortcut_option_for_users.py`
```
"""add shortcut option for users

Revision ID: 027381bce97c
Revises: 6fc7886d665d
Create Date: 2025-01-14 12:14:00.814390

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "027381bce97c"
down_revision = "6fc7886d665d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column(
            "shortcut_enabled", sa.Boolean(), nullable=False, server_default="false"
        ),
    )


def downgrade() -> None:
    op.drop_column("user", "shortcut_enabled")

```

### Core Architecture Module: `backend/alembic/versions/03bf8be6b53a_rework_kg_config.py`
```
"""rework-kg-config

Revision ID: 03bf8be6b53a
Revises: 65bc6e0f8500
Create Date: 2025-06-16 10:52:34.815335

"""

import json


from datetime import datetime
from datetime import timedelta
from sqlalchemy.dialects import postgresql
from sqlalchemy import text
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "03bf8be6b53a"
down_revision = "65bc6e0f8500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # get current config
    current_configs = (
        op.get_bind()
        .execute(text("SELECT kg_variable_name, kg_variable_values FROM kg_config"))
        .all()
    )
    current_config_dict = {
        config.kg_variable_name: (
            config.kg_variable_values[0]
            if config.kg_variable_name
            not in ("KG_VENDOR_DOMAINS", "KG_IGNORE_EMAIL_DOMAINS")
            else config.kg_variable_values
        )
        for config in current_configs
        if config.kg_variable_values
    }

    # not using the KGConfigSettings model here in case it changes in the future
    kg_config_settings = json.dumps(
        {
            "KG_EXPOSED": current_config_dict.get("KG_EXPOSED", False),
            "KG_ENABLED": current_config_dict.get("KG_ENABLED", False),
            "KG_VENDOR": current_config_dict.get("KG_VENDOR", None),
            "KG_VENDOR_DOMAINS": current_config_dict.get("KG_VENDOR_DOMAINS", []),
            "KG_IGNORE_EMAIL_DOMAINS": current_config_dict.get(
                "KG_IGNORE_EMAIL_DOMAINS", []
            ),
            "KG_COVERAGE_START": current_config_dict.get(
                "KG_COVERAGE_START",
                (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d"),
            ),
            "KG_MAX_COVERAGE_DAYS": current_config_dict.get("KG_MAX_COVERAGE_DAYS", 90),
            "KG_MAX_PARENT_RECURSION_DEPTH": current_config_dict.get(
                "KG_MAX_PARENT_RECURSION_DEPTH", 2
            ),
            "KG_BETA_PERSONA_ID": current_config_dict.get("KG_BETA_PERSONA_ID", None),
        }
    )
    op.execute(
        f"INSERT INTO key_value_store (key, value) VALUES ('kg_config', '{kg_config_settings}')"
    )

    # drop kg config table
    op.drop_table("kg_config")


def downgrade() -> None:
    # get current config
    current_config_dict = {
        "KG_EXPOSED": False,
        "KG_ENABLED": False,
        "KG_VENDOR": [],
        "KG_VENDOR_DOMAINS": [],
        "KG_IGNORE_EMAIL_DOMAINS": [],
        "KG_COVERAGE_START": (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d"),
        "KG_MAX_COVERAGE_DAYS": 90,
        "KG_MAX_PARENT_RECURSION_DEPTH": 2,
    }
    current_configs = (
        op.get_bind()
        .execute(text("SELECT value FROM key_value_store WHERE key = 'kg_config'"))
        .one_or_none()
    )
    if current_configs is not None:
        current_config_dict.update(current_configs[0])
    insert_values = [
        {
            "kg_variable_name": name,
            "kg_variable_values": (
                [str(val).lower() if isinstance(val, bool) else str(val)]
                if not isinstance(val, list)
                else val
            ),
        }
        for name, val in current_config_dict.items()
    ]

    op.create_table(
        "kg_config",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False, index=True),
        sa.Column("kg_variable_name", sa.String(), nullable=False, index=True),
        sa.Column("kg_variable_values", postgresql.ARRAY(sa.String()), nullable=False),
        sa.UniqueConstraint("kg_variable_name", name="uq_kg_config_variable_name"),
    )
    op.bulk_insert(
        sa.table(
            "kg_config",
            sa.column("kg_variable_name", sa.String),
            sa.column("kg_variable_values", postgresql.ARRAY(sa.String)),
        ),
        insert_values,
    )

    op.execute("DELETE FROM key_value_store WHERE key = 'kg_config'")

```

### Core Architecture Module: `backend/alembic/versions/03d085c5c38d_backfill_account_type.py`
```
"""backfill_account_type

Revision ID: 03d085c5c38d
Revises: 977e834c1427
Create Date: 2026-03-25 16:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "03d085c5c38d"
down_revision = "977e834c1427"
branch_labels = None
depends_on = None

_STANDARD = "STANDARD"
_BOT = "BOT"
_EXT_PERM_USER = "EXT_PERM_USER"
_SERVICE_ACCOUNT = "SERVICE_ACCOUNT"
_ANONYMOUS = "ANONYMOUS"

# Well-known anonymous user UUID
ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000002"

# Email pattern for API key virtual users
API_KEY_EMAIL_PATTERN = r"API\_KEY\_\_%"

# Reflect the table structure for use in DML
user_table = sa.table(
    "user",
    sa.column("id", sa.Uuid),
    sa.column("email", sa.String),
    sa.column("role", sa.String),
    sa.column("account_type", sa.String),
)


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Step 1: Backfill account_type from role.
    # Order matters — most-specific matches first so the final catch-all
    # only touches rows that haven't been classified yet.
    # ------------------------------------------------------------------

    # 1a. API key virtual users → SERVICE_ACCOUNT
    op.execute(
        sa.update(user_table)
        .where(
            user_table.c.email.ilike(API_KEY_EMAIL_PATTERN),
            user_table.c.account_type.is_(None),
        )
        .values(account_type=_SERVICE_ACCOUNT)
    )

    # 1b. Anonymous user → ANONYMOUS
    op.execute(
        sa.update(user_table)
        .where(
            user_table.c.id == ANONYMOUS_USER_ID,
            user_table.c.account_type.is_(None),
        )
        .values(account_type=_ANONYMOUS)
    )

    # 1c. SLACK_USER role → BOT
    op.execute(
        sa.update(user_table)
        .where(
            user_table.c.role == "SLACK_USER",
            user_table.c.account_type.is_(None),
        )
        .values(account_type=_BOT)
    )

    # 1d. EXT_PERM_USER role → EXT_PERM_USER
    op.execute(
        sa.update(user_table)
        .where(
            user_table.c.role == "EXT_PERM_USER",
            user_table.c.account_type.is_(None),
        )
        .values(account_type=_EXT_PERM_USER)
    )

    # 1e. Everything else → STANDARD
    op.execute(
        sa.update(user_table)
        .where(user_table.c.account_type.is_(None))
        .values(account_type=_STANDARD)
    )

    # ------------------------------------------------------------------
    # Step 2: Set account_type to NOT NULL now that every row is filled.
    # ------------------------------------------------------------------
    op.alter_column(
        "user",
        "account_type",
        nullable=False,
        server_default="STANDARD",
    )


def downgrade() -> None:
    op.alter_column("user", "account_type", nullable=True, server_default=None)
    op.execute(sa.update(user_table).values(account_type=None))

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

### Incident Patch 1: `3b17aa6f` (2026-09-29)
**Commit Message**: fix(salesforce): order child windows by sortable fields only (#15273)

**File**: `backend/onyx/connectors/salesforce/connector.py` (modified, +21/-31)
```diff
@@ -53,7 +53,10 @@
     convert_sf_object_to_doc,
     convert_sf_query_result_to_doc,
 )
-from onyx.connectors.salesforce.models import SalesforceMyDomainUrl
+from onyx.connectors.salesforce.models import (
+    SalesforceChildFields,
+    SalesforceMyDomainUrl,
+)
 from onyx.connectors.salesforce.onyx_salesforce import OnyxSalesforce
 from onyx.connectors.salesforce.salesforce_calls import fetch_all_csvs_in_parallel
 from onyx.connectors.salesforce.sqlite_functions import OnyxSalesforceSQLite
@@ -130,9 +133,9 @@ class SalesforceConnectorContext:
     parent_to_child_relationships: dict[
         str, set[str]
     ] = {}  # map from parent to child relationships
-    parent_to_relationship_queryable_fields: dict[
-        str, dict[str, set[str]]
-    ] = {}  # map from relationship to queryable fields
+    parent_to_relationship_fields: dict[
+        str, dict[str, SalesforceChildFields]
+    ] = {}  # parent -> relationship -> child fields
 
     parent_child_names_to_relationships: dict[str, str] = {}
 
@@ -896,14 +899,11 @@ def _delta_sync(
                 child_relationships = ctx.parent_to_child_relationships[
                     actual_parent_type
                 ]
-                relationship_to_queryable_fields = (
-                    ctx.parent_to_relationship_queryable_fields[actual_parent_type]
-                )
                 child_records = self.sf_client.get_child_objects_by_id(
                     parent_id,
                     actual_parent_type,
                     list(child_relationships),
-                    relationship_to_queryable_fields,
+                    ctx.parent_to_relationship_fields[actual_parent_type],
                 )
 
                 # NOTE(rkuo): does using the parent last modified make sense if the update
@@ -1040,10 +1040,8 @@ def _make_context(
             str, set[str]
         ] = {}  # map from parent to child relationships
 
-        # relationship keys are formatted as "parent__relationship"
-        # we have to do this because relationship names are not unique!
-        # values are a dict of relationship names to a list of queryable fields
-        parent_to_relationship_queryable_fields: dict[str, dict[str, set[str]]] = {}
+        # keyed by parent then relationship: relationship names repeat across parents
+        parent_to_relationship_fields: dict[str, dict[str, SalesforceChildFields]] = {}
 
         parent_child_names_to_relationships: dict[str, str] = {}
 
@@ -1123,19 +1121,14 @@ def _make_context(
                         any_not_found = True
                         logger.warning("Association %s not found in %s", k, parent_type)
                 if any_not_found:
-                    queryable_fields = sf_client.get_queryable_fields_by_type(
-                        parent_type
-                    )
                     raise RuntimeError(
                         f"Associations {associations_config} not found in {parent_type} "
                         "make sure your parent-child associations are in the right order"
-                        # f"with child objects {child_types_all}"
-                        # f" and fields {queryable_fields}"
                     )
 
             parent_to_child_relationships[parent_type] = set()
             parent_to_child_types[parent_type] = set()
-            parent_to_relationship_queryable_fields[parent_type] = {}
+            parent_to_relationship_fields[parent_type] = {}
 
             for child_type, child_relationship in child_types_working.items():
                 # onyx_sf_type = OnyxSalesforceType(child_type, sf_client)
@@ -1151,7 +1144,8 @@ def _make_context(
                 # map parent name to child relationship
                 parent_to_child_relationships[parent_type].add(child_relationship)
 
-                # map relationship to queryable fields of the target table
+                # map relationship to the child's queryable and sortable fields
+                child_fields = sf_client.
```

**File**: `backend/onyx/connectors/salesforce/models.py` (modified, +8/-0)
```diff
@@ -137,6 +137,14 @@ class SalesforceSessionCredentials(BaseModel):
     sf_instance_host: str = Field(min_length=1)
 
 
+class SalesforceChildFields(BaseModel):
+    """Fields of one child relationship. Salesforce marks sortable separately
+    from queryable, so only sortable fields may appear in ORDER BY."""
+
+    queryable: set[str]
+    sortable: set[str]
+
+
 class SalesforceChildQueryPlan(BaseModel):
     """Window queries pick each child relationship's newest rows with the first
     field chunk. Wide relationships keep their remaining chunks here, to be
```

**File**: `backend/onyx/connectors/salesforce/onyx_salesforce.py` (modified, +38/-22)
```diff
@@ -17,7 +17,10 @@
     SALESFORCE_BLACKLISTED_PREFIXES,
     SALESFORCE_BLACKLISTED_SUFFIXES,
 )
-from onyx.connectors.salesforce.models import SalesforceSessionCredentials
+from onyx.connectors.salesforce.models import (
+    SalesforceChildFields,
+    SalesforceSessionCredentials,
+)
 from onyx.connectors.salesforce.salesforce_calls import (
     get_object_by_id_queries,
     pinned_child_queries,
@@ -61,6 +64,26 @@ def is_salesforce_rate_limit_error(exception: Exception) -> bool:
     ) and "REQUEST_LIMIT_EXCEEDED" in str(exception)
 
 
+def _queryable_fields(fields: list[dict[str, Any]]) -> set[str]:
+    valid_fields: set[str] = set()
+    field_names_to_remove: set[str] = set()
+    for field in fields:
+        if compound_field_name := field.get("compoundFieldName"):
+            # We do want to get name fields even if they are compound
+            if not field.get("nameField"):
+                field_names_to_remove.add(compound_field_name)
+
+        field_name = field.get("name")
+        field_type = field.get("type")
+        if field_type in ["base64", "blob", "encryptedstring"]:
+            continue
+
+        if field_name:
+            valid_fields.add(field_name)
+
+    return valid_fields - field_names_to_remove
+
+
 class OnyxSalesforce(Salesforce):
     def __init__(
         self,
@@ -264,7 +287,7 @@ def get_child_objects_by_id(
         object_id: str,
         sf_type: str,
         child_relationships: list[str],
-        relationships_to_fields: dict[str, set[str]],
+        relationships_to_fields: dict[str, SalesforceChildFields],
     ) -> dict[str, dict[str, Any]]:
         child_records: dict[str, dict[str, Any]] = {}
         chunks_seen: dict[str, int] = {}
@@ -348,29 +371,22 @@ def describe_type(self, name: str) -> Any:
                 time.sleep(3)
             raise
 
-    def get_queryable_fields_by_type(self, name: str) -> set[str]:
+    def _describe_fields(self, name: str) -> list[dict[str, Any]]:
         object_description = self.describe_type(name)
         if object_description is None:
-            return set()
-
-        fields: list[dict[str, Any]] = object_description["fields"]
-        valid_fields: set[str] = set()
-        field_names_to_remove: set[str] = set()
-        for field in fields:
-            if compound_field_name := field.get("compoundFieldName"):
-                # We do want to get name fields even if they are compound
-                if not field.get("nameField"):
-                    field_names_to_remove.add(compound_field_name)
-
-            field_name = field.get("name")
-            field_type = field.get("type")
-            if field_type in ["base64", "blob", "encryptedstring"]:
-                continue
-
-            if field_name:
-                valid_fields.add(field_name)
+            return []
+        return object_description["fields"]
 
-        return valid_fields - field_names_to_remove
+    def get_queryable_fields_by_type(self, name: str) -> set[str]:
+        return _queryable_fields(self._describe_fields(name))
+
+    def get_child_fields_by_type(self, name: str) -> SalesforceChildFields:
+        """Both field sets from one describe call."""
+        fields = self._describe_fields(name)
+        return SalesforceChildFields(
+            queryable=_queryable_fields(fields),
+            sortable={field["name"] for field in fields if field.get("sortable")},
+        )
 
     def get_children_of_sf_type(self, sf_type: str) -> dict[str, str]:
         """Returns a dict of child object names to relationship names.
```

**File**: `backend/onyx/connectors/salesforce/salesforce_calls.py` (modified, +21/-20)
```diff
@@ -21,7 +21,10 @@
 
 from onyx.connectors.cross_connector_utils.rate_limit_wrapper import rate_limit_builder
 from onyx.connectors.interfaces import SecondsSinceUnixEpoch
-from onyx.connectors.salesforce.models import SalesforceChildQueryPlan
+from onyx.connectors.salesforce.models import (
+    SalesforceChildFields,
+    SalesforceChildQueryPlan,
+)
 from onyx.connectors.salesforce.utils import (
     CREATED_FIELD,
     ID_FIELD,
@@ -171,13 +174,17 @@ def get_object_by_id_queries(
     ]
 
 
-def _child_window_selection(queryable_fields: set[str]) -> str:
+def _child_window_selection(sortable_fields: set[str]) -> str:
     # newest children first so a recently changed child makes the window, with
-    # Id as tiebreaker so the order is total
+    # Id as tiebreaker so the order is total. SOQL sorts nulls first by default
+    # and some entities reject DESC NULLS FIRST (UNSUPPORTED_QUERY).
+    order_fields = [ID_FIELD]
     for field in (MODIFIED_FIELD, CREATED_FIELD):
-        if field in queryable_fields:
-            return f"ORDER BY {field} DESC, {ID_FIELD} DESC LIMIT {SOQL_SUBQUERY_ROW_LIMIT}"
-    return f"ORDER BY {ID_FIELD} DESC LIMIT {SOQL_SUBQUERY_ROW_LIMIT}"
+        if field in sortable_fields:
+            order_fields.insert(0, field)
+            break
+    order_by = SOQL_FIELD_SEPARATOR.join(f"{f} DESC NULLS LAST" for f in order_fields)
+    return f"ORDER BY {order_by} LIMIT {SOQL_SUBQUERY_ROW_LIMIT}"
 
 
 def _child_ids_selection(ids: list[str]) -> str:
@@ -199,20 +206,15 @@ def _make_child_subquery(
     return f"(SELECT {fields_fragment} FROM {child_relationship} {selection})"  # noqa: S608
 
 
-def _child_subquery_overhead(
-    child_relationship: str, queryable_fields: set[str]
-) -> int:
+def _child_subquery_overhead(child_relationship: str, window_selection: str) -> int:
     """Encoded bytes a subquery needs beyond its field chunk, for the longer selection."""
     placeholder_ids = ["0" * _SF_ID_LENGTH] * SOQL_SUBQUERY_ROW_LIMIT
     return max(
         _url_encoded_length(
             _make_child_subquery(child_relationship, [ID_FIELD], selection)
             + SOQL_FIELD_SEPARATOR
         )
-        for selection in (
-            _child_window_selection(queryable_fields),
-            _child_ids_selection(placeholder_ids),
-        )
+        for selection in (window_selection, _child_ids_selection(placeholder_ids))
     )
 
 
@@ -229,7 +231,7 @@ def plan_child_queries(
     object_id: str,
     sf_type: str,
     child_relationships: list[str],
-    relationships_to_fields: dict[str, set[str]],
+    relationships_to_fields: dict[str, SalesforceChildFields],
 ) -> SalesforceChildQueryPlan:
     """Window queries select each relationship's newest rows with its first field
     chunk. Every query fits the URL budget and the subquery cap."""
@@ -239,17 +241,16 @@ def plan_child_queries(
     window_subqueries: list[str] = []
     remaining_chunks: dict[str, list[list[str]]] = {}
     for child_relationship in child_relationships:
-        queryable_fields = relationships_to_fields[child_relationship]
-        fields = sorted(f for f in queryable_fields if f != ID_FIELD)
-        overhead = _child_subquery_overhead(child_relationship, queryable_fields)
+        child_fields = relationships_to_fields[child_relationship]
+        fields = sorted(f for f in child_fields.queryable if f != ID_FIELD)
+        window_selection = _child_window_selection(child_fields.sortable)
+        overhead = _child_subquery_overhead(child_relationship, window_selection)
         first_chunk, *rest = _pack_for_url(
             fields, SOQL_FIELD_SEPARATOR, budget - overhead
         ) or [[]]
         window_subqueries.append(
             _make_child_subquery(
-                child_relationship,
-                [ID_FIELD, *first_chunk],
-                _child_window_selection(queryable_fields),
+                child_relationship, [ID_FIELD, *first_chunk], window_selection
             )
         )
        
```

**File**: `backend/tests/unit/onyx/connectors/salesforce/test_salesforce_soql_url_budget.py` (modified, +52/-18)
```diff
@@ -4,6 +4,7 @@
 
 import pytest
 
+from onyx.connectors.salesforce.models import SalesforceChildFields
 from onyx.connectors.salesforce.onyx_salesforce import OnyxSalesforce
 from onyx.connectors.salesforce.salesforce_calls import (
     SOQL_FIELD_SEPARATOR,
@@ -36,6 +37,14 @@ def _wide_fields(count: int, prefix: str = "Field") -> set[str]:
     return {f"{prefix}_{i:04d}_Long_Custom_Name__c" for i in range(count)}
 
 
+def _child(
+    queryable: set[str], sortable: set[str] | None = None
+) -> SalesforceChildFields:
+    return SalesforceChildFields(
+        queryable=queryable, sortable=queryable if sortable is None else sortable
+    )
+
+
 def _client() -> OnyxSalesforce:
     # __init__ logs in, and the methods under test only need safe_query
     return OnyxSalesforce.__new__(OnyxSalesforce)
@@ -122,9 +131,9 @@ def test_wide_object_splits_under_budget(self) -> None:
 class TestChildQueryPlanning:
     # 1000 fields need three chunks, 400 need two, so both have pinned rounds
     _RELATIONSHIPS = {
-        "Opportunities": _wide_fields(1000, "Opp") | {ID_FIELD},
-        "Contacts": {ID_FIELD, "Email"},
-        "Cases": _wide_fields(400, "Case"),
+        "Opportunities": _child(_wide_fields(1000, "Opp") | {ID_FIELD}),
+        "Contacts": _child({ID_FIELD, "Email"}),
+        "Cases": _child(_wide_fields(400, "Case")),
     }
 
     def test_window_queries_cover_each_relationship_once(self) -> None:
@@ -140,13 +149,13 @@ def test_window_queries_cover_each_relationship_once(self) -> None:
                 )
         assert set(windowed) == set(self._RELATIONSHIPS)
         assert set(plan.remaining_chunks) == {"Opportunities", "Cases"}
-        for relationship, fields in self._RELATIONSHIPS.items():
+        for relationship, child in self._RELATIONSHIPS.items():
             remaining = {
                 f
                 for chunk in plan.remaining_chunks.get(relationship, [])
                 for f in chunk
             }
-            assert windowed[relationship] | remaining == fields | {ID_FIELD}
+            assert windowed[relationship] | remaining == child.queryable | {ID_FIELD}
 
     def test_pinned_queries_pin_the_window_ids(self) -> None:
         plan = plan_child_queries(
@@ -171,33 +180,41 @@ def test_pinned_queries_pin_the_window_ids(self) -> None:
 
     def test_id_only_relationship(self) -> None:
         plan = plan_child_queries(
-            _ACCOUNT_ID, "Account", ["Notes"], {"Notes": {ID_FIELD}}
+            _ACCOUNT_ID, "Account", ["Notes"], {"Notes": _child({ID_FIELD})}
         )
         assert plan.window_queries == [
-            "SELECT (SELECT Id FROM Notes ORDER BY Id DESC LIMIT 10) "
+            "SELECT (SELECT Id FROM Notes ORDER BY Id DESC NULLS LAST LIMIT 10) "
             f"FROM Account WHERE Id = '{_ACCOUNT_ID}'"
         ]
         assert plan.remaining_chunks == {}
 
+    _DATED = {ID_FIELD, "Name", CREATED_FIELD, MODIFIED_FIELD}
+
     @pytest.mark.parametrize(
-        ("fields", "selection"),
+        ("sortable", "selection"),
         [
             (
-                {ID_FIELD, "Name", CREATED_FIELD, MODIFIED_FIELD},
-                f"ORDER BY {MODIFIED_FIELD} DESC, {ID_FIELD} DESC LIMIT 10",
+                _DATED,
+                f"ORDER BY {MODIFIED_FIELD} DESC NULLS LAST, "
+                f"{ID_FIELD} DESC NULLS LAST LIMIT 10",
             ),
             (
                 {ID_FIELD, CREATED_FIELD},
-                f"ORDER BY {CREATED_FIELD} DESC, {ID_FIELD} DESC LIMIT 10",
+                f"ORDER BY {CREATED_FIELD} DESC NULLS LAST, "
+                f"{ID_FIELD} DESC NULLS LAST LIMIT 10",
             ),
-            ({ID_FIELD, "Name"}, f"ORDER BY {ID_FIELD} DESC LIMIT 10"),
+            # queryable but unsortable date fields never reach ORDER BY
+            ({ID_FIELD, "Name"}, f"ORDER BY {ID_FIELD} DESC NULLS LAST LIMIT 10"),
         ],
     )
-    def test_window_orders_by_recency_with_id_tiebreaker(
-        self, fields: set[str], selection: 
```

---

### Incident Patch 2: `e7240a64` (2026-09-29)
**Commit Message**: chore(deps): refresh transitive brace-expansion in /web (#15232)

**File**: `web/bun.lock` (modified, +5/-5)
```diff
@@ -1413,7 +1413,7 @@
 
     "baseline-browser-mapping": ["baseline-browser-mapping@2.10.40", "", { "bin": { "baseline-browser-mapping": "dist/cli.cjs" } }, "sha512-BSSLZ9/Cjjv7Gtj5B68ZzXcXUg8iOf3fme+FCuh8rC/Go+Kmh8cox7M3A8dolou16s64QjLPOSdngh7GxXvkSw=="],
 
-    "brace-expansion": ["brace-expansion@5.0.8", "", { "dependencies": { "balanced-match": "^4.0.2" } }, "sha512-JZyDyq3D4AUifKTPOB7DELf6XsB3WdPuNxCtob1vFXPsSXhdAiHBWJ/tJ8HAc9aH84BK+5JFZLNkJKx3G9kzQg=="],
+    "brace-expansion": ["brace-expansion@5.0.12", "", { "dependencies": { "balanced-match": "^4.0.2" } }, "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ=="],
 
     "browserslist": ["browserslist@4.28.4", "", { "dependencies": { "baseline-browser-mapping": "^2.10.38", "caniuse-lite": "^1.0.30001799", "electron-to-chromium": "^1.5.376", "node-releases": "^2.0.48", "update-browserslist-db": "^1.2.3" }, "bin": { "browserslist": "cli.js" } }, "sha512-MTc8i/x9jBQd1iMw2CFGS+rwMa07eYjLR0CCTLDACl9xhxy+nIs3KeML/biicXtk9JrZ6dnnTatmc7ErPXIxqw=="],
 
@@ -3089,7 +3089,7 @@
 
     "storybook/oxc-parser/@oxc-project/types": ["@oxc-project/types@0.127.0", "", {}, "sha512-aIYXQBo4lCbO4z0R3FHeucQHpF46l2LbMdxRvqvuRuW2OxdnSkcng5B8+K12spgLDj93rtN3+J2Vac/TIO+ciQ=="],
 
-    "test-exclude/minimatch/brace-expansion": ["brace-expansion@1.1.16", "", { "dependencies": { "balanced-match": "^1.0.0", "concat-map": "0.0.1" } }, "sha512-IDw48K2/2kRkg9LdJxurvq3lV3aBgq0REY89duEqFRthjlPdXHKMj7EnQOXVckxzgisinf3nHfrcE2FufFLXMw=="],
+    "test-exclude/minimatch/brace-expansion": ["brace-expansion@1.1.21", "", { "dependencies": { "balanced-match": "^1.0.0", "concat-map": "0.0.1" } }, "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw=="],
 
     "vite/esbuild/@esbuild/aix-ppc64": ["@esbuild/aix-ppc64@0.25.12", "", { "os": "aix", "cpu": "ppc64" }, "sha512-Hhmwd6CInZ3dwpuGTF8fJG6yoWmsToE+vYgD4nytZVxcu1ulHpUQRAB1UJ8+N1Am3Mz4+xOByoQoSZf4D+CpkA=="],
 
@@ -3147,17 +3147,17 @@
 
     "@istanbuljs/load-nyc-config/find-up/locate-path/p-locate": ["p-locate@4.1.0", "", { "dependencies": { "p-limit": "^2.2.0" } }, "sha512-R79ZZ/0wAxKGu3oYMlz8jy/kbhsNrS7SKZ7PxEHBgJ5+F2mtFW2fK2cOtBh1cHYkQsbzFV7I+EoRKe6Yt0oK7A=="],
 
-    "@jest/reporters/glob/minimatch/brace-expansion": ["brace-expansion@2.1.3", "", { "dependencies": { "balanced-match": "^1.0.0" } }, "sha512-DRdx5neNsG/QXbniLFWi2YmC/68oeOOmKz6zOjVk6ZS1ZLXgLIKqVEc6hWsmkjBbgii0SwaBTcJ5XKj5gzY/4A=="],
+    "@jest/reporters/glob/minimatch/brace-expansion": ["brace-expansion@2.1.7", "", { "dependencies": { "balanced-match": "^1.0.0" } }, "sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g=="],
 
     "@jest/reporters/glob/path-scurry/lru-cache": ["lru-cache@10.4.3", "", {}, "sha512-JNAzZcXrCt42VGLuYz0zfAzDfAvJWW6AfYlDBQyDV5DClI2m5sAmK+OIO7s59XfsRsWHp02jAJrRadPRGTt6SQ=="],
 
     "@radix-ui/react-visually-hidden/@radix-ui/react-primitive/@radix-ui/react-slot/@radix-ui/react-compose-refs": ["@radix-ui/react-compose-refs@1.1.5", "", { "peerDependencies": { "@types/react": "*", "react": "^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc" }, "optionalPeers": ["@types/react"] }, "sha512-+48PbAAbq3didjJxa+OaWY2ZwgAKsNiRGyeHKszblZMQ+kcpd9pAaT11cMkGEie0vsOi3QdeTE6d5Fe3Gn61kA=="],
 
-    "jest-config/glob/minimatch/brace-expansion": ["brace-expansion@2.1.3", "", { "dependencies": { "balanced-match": "^1.0.0" } }, "sha512-DRdx5neNsG/QXbniLFWi2YmC/68oeOOmKz6zOjVk6ZS1ZLXgLIKqVEc6hWsmkjBbgii0SwaBTcJ5XKj5gzY/4A=="],
+    "jest-config/glob/minimatch/brace-expansion": ["brace-expansion@2.1.7", "", { "dependencies": { "balanced-match": "^1.0.0" } }, "sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g=="],
 
     "jest-config/glob/path-scurry/lru-cache": ["lru-cache@10.4.3", "", {}, "sha512-JNAzZcXrCt42VGLuYz0zfAzDfAvJWW6AfYlDBQyDV5DClI2m5sAmK+OIO7s59XfsRsWHp02jAJrRadPRGTt6SQ=="],
 
-    "jest-runtime/glob/minimatch/brace-e
```

---

### Incident Patch 3: `b204777d` (2026-09-29)
**Commit Message**: fix(opensearch): write public field on metadata updates (#15236)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `backend/onyx/document_index/opensearch/opensearch_document_index.py` (modified, +4/-0)
```diff
@@ -53,6 +53,7 @@
     GLOBAL_BOOST_FIELD_NAME,
     HIDDEN_FIELD_NAME,
     PERSONAS_FIELD_NAME,
+    PUBLIC_FIELD_NAME,
     SOURCE_TYPE_FIELD_NAME,
     USER_PROJECTS_FIELD_NAME,
     DocumentChunk,
@@ -679,6 +680,9 @@ def update(
             # we don't have to think about passing in the appropriate types into
             # this dict.
             if update_request.access is not None:
+                properties_to_update[PUBLIC_FIELD_NAME] = (
+                    update_request.access.is_public
+                )
                 properties_to_update[ACCESS_CONTROL_LIST_FIELD_NAME] = (
                     generate_opensearch_filtered_access_control_list(
                         update_request.access
```

**File**: `backend/tests/external_dependency_unit/document_index/test_document_index.py` (modified, +72/-0)
```diff
@@ -10,6 +10,8 @@
 
 import pytest
 
+from onyx.access.models import DocumentAccess
+from onyx.access.utils import prefix_user_email
 from onyx.configs.constants import PUBLIC_DOC_PAT
 from onyx.context.search.models import IndexFilters, InferenceChunk
 from onyx.db.enums import EmbeddingPrecision
@@ -452,6 +454,76 @@ def test_update_applies_each_request_independently(
                 assert chunk.boost == 3
             assert retrieved_doc2[0].boost == 9
 
+    def test_update_access_revokes_public(
+        self,
+        document_indices: list[DocumentIndexNew],
+        tenant_context: None,  # noqa: ARG002
+    ) -> None:
+        """
+        Tests that an access update which makes a public document private
+        removes it from public results. The document stays visible to the
+        users in its new ACL.
+        """
+        # Precondition.
+        for document_index in document_indices:
+            doc_id = f"test_update_revoke_public_{uuid.uuid4().hex[:8]}"
+            user_email = "revoke_public_user@example.com"
+            chunks = [make_chunk(doc_id, chunk_id=0), make_chunk(doc_id, chunk_id=1)]
+            metadata = make_indexing_metadata([doc_id], old_counts=[0], new_counts=[2])
+            document_index.index(chunks=chunks, indexing_metadata=metadata)
+
+            public_filters = IndexFilters(
+                access_control_list=[PUBLIC_DOC_PAT],
+                tenant_id=POSTGRES_DEFAULT_SCHEMA_STANDARD_VALUE,
+            )
+            _retrieve_chunks_with_expected_boost(
+                document_index=document_index,
+                document_id=doc_id,
+                expected_chunk_count=2,
+                expected_boost=0,
+                filters=public_filters,
+            )
+
+            # Under test.
+            private_access = DocumentAccess.build(
+                user_emails=[user_email],
+                user_groups=[],
+                external_user_emails=[],
+                external_user_group_ids=[],
+                is_public=False,
+            )
+            document_index.update(
+                [
+                    MetadataUpdateRequest(
+                        document_ids=[doc_id],
+                        doc_id_to_chunk_cnt={doc_id: 2},
+                        access=private_access,
+                    )
+                ]
+            )
+
+            # Postcondition.
+            deadline = time.time() + 10.0
+            public_retrieved: list[InferenceChunk] = []
+            while time.time() < deadline:
+                public_retrieved = document_index.id_based_retrieval(
+                    chunk_requests=[DocumentSectionRequest(document_id=doc_id)],
+                    filters=public_filters,
+                )
+                if not public_retrieved:
+                    break
+                time.sleep(0.25)
+            assert public_retrieved == []
+
+            user_retrieved = document_index.id_based_retrieval(
+                chunk_requests=[DocumentSectionRequest(document_id=doc_id)],
+                filters=IndexFilters(
+                    access_control_list=[PUBLIC_DOC_PAT, prefix_user_email(user_email)],
+                    tenant_id=POSTGRES_DEFAULT_SCHEMA_STANDARD_VALUE,
+                ),
+            )
+            assert len(user_retrieved) == 2
+
     def test_update_with_no_fields_does_not_modify_chunks(
         self,
         document_indices: list[DocumentIndexNew],
```

---

### Incident Patch 4: `8bbcf772` (2026-09-29)
**Commit Message**: fix(db): verify async Postgres TLS like libpq (#15237)

**File**: `backend/onyx/db/engine/pg_ssl.py` (modified, +7/-1)
```diff
@@ -94,11 +94,17 @@ def create_pg_ssl_context() -> ssl.SSLContext | str | None:
         check_hostname = POSTGRES_SSLMODE == "verify-full"
         ca_certs = POSTGRES_SSLROOTCERT
 
-    return build_ssl_context(
+    context = build_ssl_context(
         verify_mode=verify_mode,
         check_hostname=check_hostname,
         ca_certs=ca_certs,
         certfile=POSTGRES_SSLCERT,
         keyfile=POSTGRES_SSLKEY,
         key_password=POSTGRES_SSLKEY_PASSWORD,
     )
+    # Verify like libpq (the sync engine) does. Python 3.13 turns on
+    # VERIFY_X509_STRICT, which rejects server certificates that libpq accepts,
+    # e.g. Cloud SQL GOOGLE_MANAGED_INTERNAL_CA certs without an Authority Key
+    # Identifier. The chain and CA checks are unchanged.
+    context.verify_flags &= ~ssl.VERIFY_X509_STRICT
+    return context
```

**File**: `backend/tests/unit/onyx/db/engine/test_postgres_ssl.py` (modified, +102/-0)
```diff
@@ -2,6 +2,7 @@
 import importlib
 import os
 import ssl
+from pathlib import Path
 from types import ModuleType
 from unittest.mock import patch
 
@@ -195,6 +196,107 @@ def test_asyncpg_not_none_with_explicit_ssl_regression_guard() -> None:
         assert module.create_pg_ssl_context() is not None
 
 
+# --- server certificates without an Authority Key Identifier ---------------
+
+
+def _write_pem(path: str, cert: x509.Certificate) -> None:
+    with open(path, "wb") as f:
+        f.write(cert.public_bytes(serialization.Encoding.PEM))
+
+
+def _issue_legacy_chain(out: str, prefix: str) -> tuple[str, str, str]:
+    """A CA and server cert shaped like Cloud SQL GOOGLE_MANAGED_INTERNAL_CA:
+    critical basicConstraints only, no keyUsage / SKI / AKI."""
+    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
+    ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, f"{prefix} CA")])
+    ca = (
+        x509.CertificateBuilder()
+        .subject_name(ca_name)
+        .issuer_name(ca_name)
+        .public_key(ca_key.public_key())
+        .serial_number(x509.random_serial_number())
+        .not_valid_before(dt.datetime(2020, 1, 1, tzinfo=dt.timezone.utc))
+        .not_valid_after(dt.datetime(2040, 1, 1, tzinfo=dt.timezone.utc))
+        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
+        .sign(ca_key, hashes.SHA256())
+    )
+    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
+    server = (
+        x509.CertificateBuilder()
+        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "db")]))
+        .issuer_name(ca_name)
+        .public_key(key.public_key())
+        .serial_number(x509.random_serial_number())
+        .not_valid_before(dt.datetime(2020, 1, 1, tzinfo=dt.timezone.utc))
+        .not_valid_after(dt.datetime(2040, 1, 1, tzinfo=dt.timezone.utc))
+        .sign(ca_key, hashes.SHA256())
+    )
+    ca_path, cert_path, key_path = (
+        os.path.join(out, f"{prefix}-{n}") for n in ("ca.crt", "server.crt", "key")
+    )
+    _write_pem(ca_path, ca)
+    _write_pem(cert_path, server)
+    with open(key_path, "wb") as f:
+        f.write(
+            key.private_bytes(
+                serialization.Encoding.PEM,
+                serialization.PrivateFormat.TraditionalOpenSSL,
+                serialization.NoEncryption(),
+            )
+        )
+    return ca_path, cert_path, key_path
+
+
+def _handshake(client_ctx: ssl.SSLContext, cert_path: str, key_path: str) -> None:
+    """Run a TLS handshake in memory; raises ssl.SSLError on failure."""
+    server_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
+    server_ctx.load_cert_chain(cert_path, key_path)
+    c_in, c_out, s_in, s_out = (ssl.MemoryBIO() for _ in range(4))
+    client = client_ctx.wrap_bio(c_in, c_out, server_hostname="db")
+    server = server_ctx.wrap_bio(s_in, s_out, server_side=True)
+    done = {"client": False, "server": False}
+    for _ in range(10):
+        for name, sock in (("client", client), ("server", server)):
+            if done[name]:
+                continue
+            try:
+                sock.do_handshake()
+                done[name] = True
+            except ssl.SSLWantReadError:
+                pass
+        s_in.write(c_out.read())
+        c_in.write(s_out.read())
+        if all(done.values()):
+            return
+    raise AssertionError("handshake did not finish")
+
+
+def test_asyncpg_verify_ca_accepts_server_cert_without_aki(
+    tmp_path: Path,
+) -> None:
+    """libpq accepts these certs; the asyncpg context must too, and must still
+    reject a cert from a different CA."""
+    ca, cert, key = _issue_legacy_chain(str(tmp_path), "trusted")
+    _, other_cert, other_key = _issue_legacy_chain(str(tmp_path), "other")
+
+    strict = ssl.create_default_context(cafile=ca)
+    strict.check_hostname = False
+    if strict.verify_flags & ssl.VERIFY_X509_STRICT:
+        with pytest.raises(ssl.SSLCertVerifi
```

---

### Incident Patch 5: `a7a17725` (2026-09-29)
**Commit Message**: fix: renaming a user group no longer drops its connectors (#15214)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `backend/ee/onyx/db/user_group.py` (modified, +3/-5)
```diff
@@ -988,11 +988,9 @@ def rename_user_group(
     db_user_group.name = new_name
     db_user_group.time_last_modified_by_user = func.now()
 
-    # CC pair documents in Vespa contain the group name, so we need to
-    # trigger a sync to update them with the new name.
-    _mark_user_group__cc_pair_relationships_outdated__no_commit(
-        db_session=db_session, user_group_id=user_group_id
-    )
+    # Documents in the index carry the group name, so re-sync them. The group's
+    # cc_pair rows stay current: the sync reaches every document of the group's
+    # cc_pairs, and marking the rows outdated would make the sync delete them.
     if not DISABLE_VECTOR_DB:
         db_user_group.is_up_to_date = False
 
```

**File**: `backend/tests/external_dependency_unit/ee/onyx/db/test_user_group_rename_keeps_cc_pairs.py` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+"""Renaming a user group keeps its connectors once the group has re-synced."""
+
+from collections.abc import Generator
+from uuid import uuid4
+
+import pytest
+from sqlalchemy import delete, select
+from sqlalchemy.orm import Session
+
+from ee.onyx.db.user_group import mark_user_group_as_synced, rename_user_group
+from onyx.db.models import (
+    ConnectorCredentialPair,
+    UserGroup,
+    UserGroup__ConnectorCredentialPair,
+)
+from tests.external_dependency_unit.indexing_helpers import (
+    cleanup_cc_pair,
+    make_cc_pair,
+)
+
+
+@pytest.fixture
+def group_with_cc_pair(
+    db_session: Session,
+) -> Generator[tuple[UserGroup, ConnectorCredentialPair], None, None]:
+    cc_pair = make_cc_pair(db_session)
+    group = UserGroup(name=f"rename-test-{uuid4().hex[:12]}", is_up_to_date=True)
+    db_session.add(group)
+    db_session.flush()
+    db_session.add(
+        UserGroup__ConnectorCredentialPair(
+            user_group_id=group.id, cc_pair_id=cc_pair.id, is_current=True
+        )
+    )
+    db_session.commit()
+    yield group, cc_pair
+
+    db_session.execute(
+        delete(UserGroup__ConnectorCredentialPair).where(
+            UserGroup__ConnectorCredentialPair.user_group_id == group.id
+        )
+    )
+    db_session.execute(delete(UserGroup).where(UserGroup.id == group.id))
+    db_session.commit()
+    cleanup_cc_pair(db_session, cc_pair)
+
+
+@pytest.mark.usefixtures("tenant_context")
+def test_rename_keeps_cc_pairs_after_sync(
+    db_session: Session,
+    group_with_cc_pair: tuple[UserGroup, ConnectorCredentialPair],
+) -> None:
+    # Precondition.
+    group, cc_pair = group_with_cc_pair
+
+    # Under test: rename, then the sync's completion step.
+    renamed = rename_user_group(
+        db_session, user_group_id=group.id, new_name=f"{group.name}-renamed"
+    )
+    mark_user_group_as_synced(db_session, renamed)
+
+    # Postcondition.
+    rows = db_session.scalars(
+        select(UserGroup__ConnectorCredentialPair).where(
+            UserGroup__ConnectorCredentialPair.user_group_id == group.id
+        )
+    ).all()
+    assert [(row.cc_pair_id, row.is_current) for row in rows] == [(cc_pair.id, True)]
```

**File**: `backend/tests/unit/ee/onyx/db/test_user_group_rename.py` (modified, +4/-2)
```diff
@@ -16,7 +16,7 @@ class TestRenameUserGroup:
     @patch(
         "ee.onyx.db.user_group._mark_user_group__cc_pair_relationships_outdated__no_commit"
     )
-    def test_rename_succeeds_and_triggers_sync(
+    def test_rename_succeeds_and_triggers_sync_without_dropping_cc_pairs(
         self, mock_mark_outdated: MagicMock
     ) -> None:
         mock_session = MagicMock()
@@ -29,7 +29,9 @@ def test_rename_succeeds_and_triggers_sync(
 
         assert result.name == "New Name"
         assert result.is_up_to_date is False
-        mock_mark_outdated.assert_called_once()
+        # Outdated rows are deleted by the sync, which would drop the group's
+        # cc_pairs.
+        mock_mark_outdated.assert_not_called()
         mock_session.commit.assert_called_once()
 
     def test_rename_group_not_found(self) -> None:
```

---

### Incident Patch 6: `a18fc1a6` (2026-09-29)
**Commit Message**: fix(widget): fill the inline container and keep typing keys in the widget (#15211)

**File**: `widget/README.md` (modified, +16/-1)
```diff
@@ -123,6 +123,7 @@ That's it! The widget will appear as a floating button in the bottom-right corne
 | `text-color`       | string  | `#000000bf`   | Text color (75% opacity black)           |
 | `mode`             | string  | `"launcher"`  | Display mode: `"launcher"` or `"inline"` |
 | `include-citations`| boolean | `false`       | Include citation markers in responses    |
+| `start-expanded`   | boolean | `false`       | Inline mode: show the full chat panel before the first message, instead of the compact input bar |
 
 **Note**: These attributes must be provided as HTML attributes. Only `backend-url` and `api-key` can optionally be set via environment variables for self-hosted builds.
 
@@ -232,7 +233,21 @@ The widget is embedded directly in your page layout. Perfect for dedicated suppo
 </div>
 ```
 
-**CSS Tip**: The widget will fill its container's dimensions in inline mode.
+**CSS Tip**: The widget will fill its container's dimensions in inline mode. Give the container an explicit height; otherwise the panel grows with the conversation.
+
+Before the first message, inline mode shows a compact input bar. Add `start-expanded` to show the full chat panel at the container's size from the start:
+
+```html
+<div style="height: 600px;">
+  <onyx-chat-widget mode="inline" start-expanded></onyx-chat-widget>
+</div>
+```
+
+## Keyboard Events
+
+Key presses typed into the widget do not propagate to the host page (except Escape). The widget uses Shadow DOM, so a page-level handler sees `event.target` as `<onyx-chat-widget>`, not the text field. Without this, handlers that block Backspace outside text fields would also block it in the widget.
+
+Handlers registered in the capture phase still run first. If such a handler blocks keys outside text fields, check `event.composedPath()[0]` instead of `event.target`.
 
 ## Development
 
```

**File**: `widget/src/config/config.ts` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ export function resolveConfig(attributes: Partial<WidgetConfig>): WidgetConfig {
     logo: attributes.logo,
     mode: attributes.mode || "launcher",
     includeCitations: attributes.includeCitations ?? false,
+    startExpanded: attributes.startExpanded ?? false,
   };
 
   if (!config.backendUrl) {
```

**File**: `widget/src/styles/widget-styles.ts` (modified, +6/-0)
```diff
@@ -10,6 +10,12 @@ export const widgetStyles = css`
     font-family: var(--onyx-font-family);
   }
 
+  /* Without a host height, the inline container's height: 100% resolves to
+     auto and the panel grows with its content instead of filling the parent. */
+  :host([mode="inline"]) {
+    height: 100%;
+  }
+
   .launcher {
     position: fixed;
     background: var(--background-neutral-00);
```

**File**: `widget/src/types/widget-types.ts` (modified, +2/-0)
```diff
@@ -29,6 +29,8 @@ export interface WidgetConfig {
 
   // Optional - Display
   mode?: "launcher" | "inline";
+  // Inline mode: show the full chat panel before the first message.
+  startExpanded?: boolean;
 
   // Optional - Citations
   includeCitations?: boolean;
```

**File**: `widget/src/widget.ts` (modified, +16/-2)
```diff
@@ -35,9 +35,12 @@ export class OnyxChatWidget extends LitElement {
   @property({ attribute: "text-color" }) textColor?: string;
   @property({ attribute: "agent-name" }) agentName?: string;
   @property({ attribute: "logo" }) logo?: string;
-  @property() mode?: "launcher" | "inline";
+  // Reflected so `:host([mode="inline"])` also matches when set as a property.
+  @property({ reflect: true }) mode?: "launcher" | "inline";
   @property({ attribute: "include-citations", type: Boolean })
   includeCitations?: boolean;
+  @property({ attribute: "start-expanded", type: Boolean })
+  startExpanded?: boolean;
 
   // Assigned as a JS property, since a function cannot ride an HTML attribute.
   // Takes precedence over `api-key` and keeps the credential out of the markup.
@@ -113,6 +116,7 @@ export class OnyxChatWidget extends LitElement {
       logo: this.logo,
       mode: this.mode,
       includeCitations: this.includeCitations,
+      startExpanded: this.startExpanded,
     });
 
     // Apply custom colors
@@ -358,6 +362,13 @@ export class OnyxChatWidget extends LitElement {
   }
 
   private handleKeyDown(e: KeyboardEvent) {
+    // Shadow DOM retargets `e.target` to the host element, so page-level
+    // handlers that let keys through only for text fields (e.g. ones that
+    // block Backspace navigation) would cancel typing here. Escape still
+    // propagates so the host page can close its overlays.
+    if (e.key !== "Escape") {
+      e.stopPropagation();
+    }
     if (e.key === "Enter" && !e.shiftKey) {
       e.preventDefault();
       this.sendMessage();
@@ -538,7 +549,10 @@ export class OnyxChatWidget extends LitElement {
   render() {
     const showContainer = this.config.mode === "inline" || this.isOpen;
     const hasMessages = this.messages.length > 0 || this.isStreaming;
-    const isCompactInline = this.config.mode === "inline" && !hasMessages;
+    const isCompactInline =
+      this.config.mode === "inline" &&
+      !this.config.startExpanded &&
+      !hasMessages;
 
     return html`
       ${this.config.mode === "launcher"
```

---

### Incident Patch 7: `43f74dd6` (2026-09-28)
**Commit Message**: fix(helm): harden default pod security and warn on default credentials (#15046)

**File**: `deployment/helm/charts/onyx/Chart.yaml` (modified, +7/-5)
```diff
@@ -5,7 +5,7 @@ home: https://www.onyx.app/
 sources:
   - "https://github.com/onyx-dot-app/onyx"
 type: application
-version: 0.8.39
+version: 0.8.40
 appVersion: latest
 annotations:
   category: Productivity
@@ -20,10 +20,12 @@ annotations:
     - name: background
       image: docker.io/onyxdotapp/onyx-backend:latest
   artifacthub.io/changes: |
-    - kind: fixed
-      description: Scope the pre-delete cleanup hook to this release's Postgres and
-        Redis resources, pin and harden its kubectl image, and add
-        postgresql.cluster.retainOnUninstall to keep the database on uninstall.
+    - kind: security
+      description: Default Onyx workloads to the RuntimeDefault seccomp profile and
+        allowPrivilegeEscalation false.
+    - kind: security
+      description: Warn after install when the default PostgreSQL or Redis passwords
+        are in use.
 dependencies:
   # Helm uses the first condition path that exists: `postgresqlOperator.enabled`
   # is unset by default, so this falls through to `postgresql.enabled`. Set it
```

**File**: `deployment/helm/charts/onyx/templates/NOTES.txt` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+Onyx {{ .Values.global.version | default .Chart.AppVersion }} is deployed as release "{{ .Release.Name }}" in namespace "{{ .Release.Namespace }}".
+{{- $pg := .Values.auth.postgresql }}
+{{- $redis := .Values.auth.redis }}
+{{- $pgDefault := and (ne (toString $pg.enabled) "false") (empty $pg.existingSecret) (eq (toString $pg.values.password) "postgres") }}
+{{- $redisDefault := and .Values.redis.enabled (ne (toString $redis.enabled) "false") (empty $redis.existingSecret) (eq (toString $redis.values.redis_password) "password") }}
+{{- if or $pgDefault $redisDefault }}
+
+WARNING: this release uses the chart's default credentials:
+{{- if $pgDefault }}
+  - PostgreSQL: auth.postgresql.values.password is "postgres"
+{{- end }}
+{{- if $redisDefault }}
+  - Redis: auth.redis.values.redis_password is "password"
+{{- end }}
+Anyone who can reach these services in the cluster can use these passwords.
+Set strong values, or point auth.<name>.existingSecret at a Secret you manage
+(for example the one that externalSecret creates).
+{{- end }}
```

**File**: `deployment/helm/charts/onyx/templates/_helpers.tpl` (modified, +14/-0)
```diff
@@ -84,6 +84,20 @@ Create the name of the service account to use
 {{- end }}
 {{- end }}
 
+{{/*
+Render a container securityContext. Kubernetes rejects
+allowPrivilegeEscalation=false alongside privileged or CAP_SYS_ADMIN, so the
+default is dropped when an override asks for either.
+*/}}
+{{- define "onyx.containerSecurityContext" -}}
+{{- $sc := deepCopy (. | default dict) -}}
+{{- $added := (get ($sc.capabilities | default dict) "add") | default list -}}
+{{- if or $sc.privileged (has "SYS_ADMIN" $added) (has "CAP_SYS_ADMIN" $added) -}}
+{{- $_ := unset $sc "allowPrivilegeEscalation" -}}
+{{- end -}}
+{{- toYaml $sc -}}
+{{- end }}
+
 {{/*
 Set secret name
 */}}
```

**File**: `deployment/helm/charts/onyx/templates/api-deployment.yaml` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ spec:
       containers:
         - name: api-server
           securityContext:
-            {{- toYaml .Values.api.securityContext | nindent 12 }}
+            {{- include "onyx.containerSecurityContext" .Values.api.securityContext | nindent 12 }}
           image: "{{ .Values.api.image.repository }}:{{ .Values.api.image.tag | default .Values.global.version }}"
           imagePullPolicy: {{ .Values.global.pullPolicy }}
           command:
```

**File**: `deployment/helm/charts/onyx/templates/celery-beat.yaml` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ spec:
       containers:
         - name: celery-beat
           securityContext:
-            {{- toYaml .Values.celery_shared.securityContext | nindent 12 }}
+            {{- include "onyx.containerSecurityContext" .Values.celery_shared.securityContext | nindent 12 }}
           image: "{{ .Values.celery_shared.image.repository }}:{{ .Values.celery_shared.image.tag | default .Values.global.version }}"
           imagePullPolicy: {{ .Values.global.pullPolicy }}
           command:
```

---

### Incident Patch 8: `5c2e2018` (2026-09-28)
**Commit Message**: fix(helm): scope pre-delete cleanup to this release and serialize startup migrations (#15045)

**File**: `backend/alembic/env.py` (modified, +9/-7)
```diff
@@ -1,4 +1,5 @@
 from onyx.db.engine.iam_auth import make_provide_iam_token_async
+from onyx.db.engine.migration_lock import schema_migration_lock
 from onyx.db.engine.pg_ssl import create_pg_ssl_context
 from onyx.configs.app_configs import USE_IAM_AUTH
 from onyx.configs.app_configs import POSTGRES_HOST
@@ -317,13 +318,14 @@ async def _migrate_schemas(
             schema,
         )
         try:
-            async with engine.connect() as connection:
-                await connection.run_sync(
-                    do_run_migrations,
-                    schema_name=schema,
-                    create_schema=create_schema,
-                )
-                await connection.commit()
+            async with schema_migration_lock(engine, schema):
+                async with engine.connect() as connection:
+                    await connection.run_sync(
+                        do_run_migrations,
+                        schema_name=schema,
+                        create_schema=create_schema,
+                    )
+                    await connection.commit()
         except Exception as e:
             logger.error("Error migrating schema %s: %s", schema, e)
             if not continue_on_error:
```

**File**: `backend/onyx/db/engine/migration_lock.py` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+"""Advisory lock that makes concurrent `alembic upgrade` runs on one schema take turns.
+
+Keyed per schema so parallel runs over different tenant ranges do not block each other.
+"""
+
+import asyncio
+import zlib
+from collections.abc import AsyncIterator
+from contextlib import asynccontextmanager, suppress
+
+from sqlalchemy import text
+from sqlalchemy.exc import DBAPIError
+from sqlalchemy.ext.asyncio import AsyncEngine
+
+from onyx.utils.logger import setup_logger
+
+logger = setup_logger()
+
+# Two-int advisory keys do not collide with the single-bigint keys used elsewhere.
+MIGRATION_LOCK_NAMESPACE = 0x4F4E5958
+MIGRATION_LOCK_POLL_INTERVAL_SECONDS = 2.0
+
+
+def migration_lock_key(schema_name: str) -> int:
+    """Stable signed int4 key for a schema name."""
+    unsigned_key = zlib.crc32(schema_name.encode("utf-8"))
+    return unsigned_key - (1 << 32) if unsigned_key >= (1 << 31) else unsigned_key
+
+
+@asynccontextmanager
+async def schema_migration_lock(
+    engine: AsyncEngine,
+    schema_name: str,
+    poll_interval_seconds: float = MIGRATION_LOCK_POLL_INTERVAL_SECONDS,
+) -> AsyncIterator[None]:
+    # Transaction-scoped so PgBouncer transaction pooling pins the lock to its holder.
+    # Waiters poll: a blocked lock call holds a snapshot that CREATE INDEX
+    # CONCURRENTLY in the holder's migration would wait on forever.
+    params = {
+        "namespace": MIGRATION_LOCK_NAMESPACE,
+        "key": migration_lock_key(schema_name),
+    }
+    async with engine.connect() as connection:
+        logged_wait = False
+        while True:
+            transaction = await connection.begin()
+            acquired = (
+                await connection.execute(
+                    text("SELECT pg_try_advisory_xact_lock(:namespace, :key)"),
+                    params,
+                )
+            ).scalar_one()
+            if acquired:
+                # Stops a timeout kill from silently dropping the lock. As a
+                # snapshot-free statement, it also replaces the SELECT's open
+                # portal, which would otherwise pin a snapshot for the whole hold.
+                await connection.execute(
+                    text("SET LOCAL idle_in_transaction_session_timeout = 0")
+                )
+                break
+            await transaction.rollback()
+            if not logged_wait:
+                logger.info(
+                    "Waiting for another migration run on schema %s to finish",
+                    schema_name,
+                )
+                logged_wait = True
+            await asyncio.sleep(poll_interval_seconds)
+
+        try:
+            yield
+        except BaseException:
+            with suppress(Exception):
+                await transaction.rollback()
+            raise
+
+        try:
+            await transaction.commit()
+        except DBAPIError as e:
+            raise RuntimeError(
+                f"Lost the migration lock connection for schema {schema_name}; "
+                "another run may have migrated it concurrently"
+            ) from e
```

**File**: `backend/tests/external_dependency_unit/db/test_migration_lock.py` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+"""schema_migration_lock against a real Postgres, as used by alembic/env.py."""
+
+import asyncio
+from collections.abc import AsyncGenerator
+from uuid import uuid4
+
+import pytest
+import pytest_asyncio
+from sqlalchemy import pool, text
+from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine
+
+from onyx.db.engine.migration_lock import (
+    MIGRATION_LOCK_NAMESPACE,
+    migration_lock_key,
+    schema_migration_lock,
+)
+from onyx.db.engine.sql_engine import build_connection_string
+
+
+@pytest_asyncio.fixture
+async def engine() -> AsyncGenerator[AsyncEngine, None]:
+    engine = create_async_engine(build_connection_string(), poolclass=pool.NullPool)
+    yield engine
+    await engine.dispose()
+
+
+@pytest_asyncio.fixture
+async def version_table(engine: AsyncEngine) -> AsyncGenerator[str, None]:
+    """Stand-in for alembic_version: one row holding the current revision."""
+    table_name = f"migration_lock_probe_{uuid4().hex[:12]}"
+    async with engine.begin() as connection:
+        await connection.execute(text(f"CREATE TABLE {table_name} (revision TEXT)"))
+        await connection.execute(text(f"INSERT INTO {table_name} VALUES ('base')"))
+    yield table_name
+    async with engine.begin() as connection:
+        await connection.execute(text(f"DROP TABLE {table_name}"))
+
+
+async def _upgrade_to_head(engine: AsyncEngine, schema_name: str, table: str) -> bool:
+    """Mimics `alembic upgrade head`: read the revision, migrate, commit.
+
+    Returns True if this run applied the migration, False if it was a no-op.
+    """
+    async with schema_migration_lock(engine, schema_name, poll_interval_seconds=0.05):
+        async with engine.connect() as connection:
+            revision = (
+                await connection.execute(text(f"SELECT revision FROM {table}"))
+            ).scalar_one()
+            if revision == "head":
+                return False
+            # Widens the race window so an unserialized second run would read 'base'.
+            await asyncio.sleep(0.5)
+            await connection.execute(text(f"UPDATE {table} SET revision = 'head'"))
+            await connection.commit()
+            return True
+
+
+async def _lock_is_free(engine: AsyncEngine, schema_name: str) -> bool:
+    params = {
+        "namespace": MIGRATION_LOCK_NAMESPACE,
+        "key": migration_lock_key(schema_name),
+    }
+    async with engine.connect() as connection:
+        acquired = (
+            await connection.execute(
+                text("SELECT pg_try_advisory_lock(:namespace, :key)"), params
+            )
+        ).scalar_one()
+        if acquired:
+            await connection.execute(
+                text("SELECT pg_advisory_unlock(:namespace, :key)"), params
+            )
+        return bool(acquired)
+
+
+@pytest.mark.asyncio
+async def test_concurrent_upgrades_serialize_and_later_runs_are_noops(
+    engine: AsyncEngine, version_table: str
+) -> None:
+    schema_name = f"lock_test_{uuid4().hex}"
+
+    results = await asyncio.gather(
+        *(_upgrade_to_head(engine, schema_name, version_table) for _ in range(3))
+    )
+
+    assert sorted(results) == [False, False, True]
+    assert await _lock_is_free(engine, schema_name)
+
+
+@pytest.mark.asyncio
+async def test_lock_is_released_when_the_migration_fails(engine: AsyncEngine) -> None:
+    schema_name = f"lock_test_{uuid4().hex}"
+
+    with pytest.raises(RuntimeError):
+        async with schema_migration_lock(engine, schema_name):
+            assert not await _lock_is_free(engine, schema_name)
+            raise RuntimeError("migration failed")
+
+    assert await _lock_is_free(engine, schema_name)
+
+
+@pytest.mark.asyncio
+async def test_different_schemas_do_not_block_each_other(engine: AsyncEngine) -> None:
+    async with schema_migration_lock(engine, f"lock_test_{uuid4().hex}"):
+        async with asyncio.timeout(5):
+            async with schema_migration_lock(engine, f"lo
```

**File**: `deployment/helm/README.md` (modified, +7/-3)
```diff
@@ -64,9 +64,13 @@ Other 0.5.0 changes:
   (`postgresql.crds.create: false`). Run `scripts/check-cnpg-crds.sh` after
   bumping the CNPG subchart version to verify the copy is in sync.
 * **Pre-delete hook** — a cleanup Job (`templates/pre-delete-cleanup.yaml`)
-  deletes operator-managed CRs before `helm uninstall` tears down the
-  operators, ensuring finalizers are processed and namespace cleanup
-  completes promptly.
+  deletes this release's CNPG Cluster and Redis CRs, by name, before
+  `helm uninstall` tears down the operators. This makes sure finalizers are
+  processed and namespace cleanup completes promptly. Set
+  `postgresql.cluster.retainOnUninstall: true` to keep the CNPG Cluster and
+  its PVCs instead. The operator is still removed, so the kept Cluster has no
+  controller: reinstall with the same release name to adopt it, or delete it
+  and clear its finalizers (see the comment in `values.yaml`).
 
 # Dependency updates (when subchart versions are bumped)
 * If updating subcharts, you need to run this before committing!
```

**File**: `deployment/helm/charts/onyx/Chart.yaml` (modified, +5/-4)
```diff
@@ -5,7 +5,7 @@ home: https://www.onyx.app/
 sources:
   - "https://github.com/onyx-dot-app/onyx"
 type: application
-version: 0.8.38
+version: 0.8.39
 appVersion: latest
 annotations:
   category: Productivity
@@ -20,9 +20,10 @@ annotations:
     - name: background
       image: docker.io/onyxdotapp/onyx-backend:latest
   artifacthub.io/changes: |
-    - kind: added
-      description: SHAREPOINT_CONNECTOR_SIZE_THRESHOLD in the config map values,
-        the SharePoint file size cap that Teams and Outlook already exposed.
+    - kind: fixed
+      description: Scope the pre-delete cleanup hook to this release's Postgres and
+        Redis resources, pin and harden its kubectl image, and add
+        postgresql.cluster.retainOnUninstall to keep the database on uninstall.
 dependencies:
   # Helm uses the first condition path that exists: `postgresqlOperator.enabled`
   # is unset by default, so this falls through to `postgresql.enabled`. Set it
```

---

### Incident Patch 9: `6a7bd044` (2026-09-28)
**Commit Message**: fix(opal): fixes for the `inputs/dropdowns` family of components (#15203)

**File**: `web/lib/opal/src/components/divider/README.md` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ A plain line with no title or description.
 | `open`         | `boolean`                 | —              | Controlled open state           |
 | `defaultOpen`  | `boolean`                 | `false`        | Uncontrolled initial open state |
 | `onOpenChange` | `(open: boolean) => void` | —              | Callback when toggled           |
-| `children`     | `ReactNode`               | —              | Content revealed when open      |
+| `children`     | `ReactNode`               | —              | Content revealed when open; stays mounted while closed, inert and hidden from assistive tech, so the fold animates both ways |
 
 ## Usage Examples
 
```

**File**: `web/lib/opal/src/components/divider/components.tsx` (modified, +14/-2)
```diff
@@ -81,7 +81,10 @@ type DividerFoldableProps = Omit<
   defaultOpen?: boolean;
   /** Callback when open state changes. */
   onOpenChange?: (open: boolean) => void;
-  /** Content revealed when open. */
+  /**
+   * Content revealed when open. Stays mounted while closed, inert and
+   * hidden from assistive tech, so the fold animates both ways.
+   */
   children?: React.ReactNode;
   /**
    * Overrides the header's interaction state (a listbox highlights the
@@ -217,7 +220,16 @@ function FoldableDivider({
           </div>
         </Interactive.Container>
       </Interactive.Stateless>
-      {isOpen && children}
+      {/* The content stays mounted so the fold can close as smoothly as it
+          opens; closed, it is inert and hidden from assistive tech. */}
+      <div
+        className="opal-divider-fold"
+        data-open={isOpen}
+        aria-hidden={!isOpen || undefined}
+        inert={!isOpen || undefined}
+      >
+        <div className="opal-divider-fold-inner">{children}</div>
+      </div>
     </>
   );
 }
```

**File**: `web/lib/opal/src/components/divider/styles.css` (modified, +27/-0)
```diff
@@ -56,3 +56,30 @@
 .opal-divider-chevron[data-open="true"] {
   transform: rotate(90deg);
 }
+
+/* ── Fold ───────────────────────────────────────────────────────────────────── */
+
+/* Grid rows animate between 0fr and 1fr without a measured height, so the
+   fold closes as smoothly as it opens and never needs a mount or unmount.
+   The chevron above turns on the same clock. */
+.opal-divider-fold {
+  display: grid;
+  grid-template-rows: 0fr;
+  opacity: 0;
+  transition:
+    grid-template-rows 200ms ease-in-out,
+    opacity 200ms ease-in-out;
+}
+.opal-divider-fold[data-open="true"] {
+  grid-template-rows: 1fr;
+  opacity: 1;
+}
+.opal-divider-fold-inner {
+  min-height: 0;
+  overflow: hidden;
+}
+@media (prefers-reduced-motion: reduce) {
+  .opal-divider-fold {
+    transition: none;
+  }
+}
```

**File**: `web/lib/opal/src/components/inputs/dropdowns/dropdown/OptionsList.tsx` (modified, +9/-8)
```diff
@@ -64,11 +64,8 @@ export const OptionsList: React.FC<OptionsListProps> = ({
     (count, section) => count + section.options.length,
     0
   );
-  // A folded group withholds its rows but still shows its title, so a
-  // list of folded groups is not empty.
-  const hasFoldedGroups = sections.some((section) => section.folded);
 
-  if (totalOptions === 0 && !showCreateOption && !hasFoldedGroups) {
+  if (totalOptions === 0 && !showCreateOption) {
     // An empty SET gets the icon'd empty state; a filter that matched
     // nothing keeps the lightweight text row.
     if (emptySet) {
@@ -130,18 +127,22 @@ export const OptionsList: React.FC<OptionsListProps> = ({
           const isFoldable = group.foldable && group.title !== undefined;
           // The title claims its stop before the rows claim theirs.
           const headerIndex = isFoldable ? globalIndex++ : -1;
+          // A folded group's rows stay mounted for the fold animation but
+          // hold no keyboard stop: no index, no highlight, no exact match.
           const rows = group.options.map((option) => {
-            const index = globalIndex++;
+            const index = group.folded ? -1 : globalIndex++;
             const isExact =
-              (markAllMatches || !exactSeen) && isExactMatch(option);
+              !group.folded &&
+              (markAllMatches || !exactSeen) &&
+              isExactMatch(option);
             if (isExact) exactSeen = true;
             return (
               <OptionItem
                 key={option.value}
                 option={option}
                 index={index}
                 fieldId={fieldId}
-                isHighlighted={index === highlightedIndex}
+                isHighlighted={index >= 0 && index === highlightedIndex}
                 isSelected={
                   selectedValues
                     ? selectedValues.has(option.value)
@@ -176,7 +177,7 @@ export const OptionsList: React.FC<OptionsListProps> = ({
                   // stays at rest, unlike a standalone foldable Divider.
                   interaction={index === highlightedIndex ? "hover" : "rest"}
                 >
-                  {rows}
+                  <div className="opal-select-group-rows">{rows}</div>
                 </Divider>
               </div>
             );
```

**File**: `web/lib/opal/src/components/inputs/dropdowns/dropdown/SelectDropdown.tsx` (modified, +18/-3)
```diff
@@ -13,6 +13,11 @@ interface SelectDropdownProps {
   isOpen: boolean;
   disabled: boolean;
   floatingStyles: React.CSSProperties;
+  /**
+   * floating-ui has placed and sized the box. Until then the rows lay out
+   * at the wrong width, so anything measured against them is off.
+   */
+  isPositioned: boolean;
   setFloatingRef: (node: HTMLDivElement | null) => void;
   fieldId: string;
   placeholder: string;
@@ -66,6 +71,7 @@ export const SelectDropdown = forwardRef<HTMLDivElement, SelectDropdownProps>(
       isOpen,
       disabled,
       floatingStyles,
+      isPositioned,
       setFloatingRef,
       fieldId,
       placeholder,
@@ -131,9 +137,18 @@ export const SelectDropdown = forwardRef<HTMLDivElement, SelectDropdownProps>(
     }, [highlightedIndex, isOpen, keyboardNav, ref]);
 
     // Opening shows the selection: the (first) selected row is centred in
-    // view, so a long list opens around the current value.
+    // view, so a long list opens around the current value. Waits for
+    // floating-ui to size the box: before that the rows lay out single-line
+    // at the wrong width, the centre is computed on those heights, and the
+    // selection lands below the fold once the descriptions wrap.
     useEffect(() => {
-      if (!isOpen || !ref || typeof ref === "function" || !ref.current) {
+      if (
+        !isOpen ||
+        !isPositioned ||
+        !ref ||
+        typeof ref === "function" ||
+        !ref.current
+      ) {
         return;
       }
       const selectedElement = ref.current.querySelector(
@@ -143,7 +158,7 @@ export const SelectDropdown = forwardRef<HTMLDivElement, SelectDropdownProps>(
         block: "center",
         behavior: "instant",
       });
-    }, [isOpen, ref]);
+    }, [isOpen, isPositioned, ref]);
 
     if (!presence.mounted || disabled || typeof document === "undefined") {
       return null;
```

---

### Incident Patch 10: `12037386` (2026-09-28)
**Commit Message**: fix(coding-agent): advance sub-turn only for rendered think-step output (#15097)

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `backend/onyx/tools/fake_tools/coding_agent.py` (modified, +7/-5)
```diff
@@ -302,7 +302,6 @@ def run_coding_agent_call(
                 cycle_count = 0
                 llm_cycle_count = 0
                 reasoning_cycles = 0
-                most_recent_reasoning: str | None = None
 
                 while cycle_count < MAX_CODING_AGENT_CYCLES:
                     elapsed = time.monotonic() - start_time
@@ -369,6 +368,7 @@ def run_coding_agent_call(
                         max_tokens=2048,
                     )
 
+                    rendered_text: bool = False
                     while True:
                         try:
                             packet = next(step_generator)
@@ -377,9 +377,10 @@ def run_coding_agent_call(
                                 (AgentResponseStart, AgentResponseDelta),
                             ):
                                 if isinstance(packet.obj, AgentResponseDelta):
+                                    rendered_text = True
                                     emitter.emit(
                                         Packet(
-                                            placement=step_placement,
+                                            placement=packet.placement,
                                             obj=CodingAgentThinkingDelta(
                                                 content=packet.obj.content
                                             ),
@@ -435,8 +436,11 @@ def run_coding_agent_call(
                                 image_files=None,
                             )
                         )
-                        most_recent_reasoning = llm_step_result.reasoning
                         cycle_count += 1
+                        # Think arguments render only as reasoning, which is
+                        # counted above; narration needs its own sub-turn.
+                        if rendered_text:
+                            llm_cycle_count += 1
                         continue
 
                     # Otherwise: dispatch all bash tool calls sequentially.
@@ -485,7 +489,6 @@ def run_coding_agent_call(
                             )
                         )
 
-                    most_recent_reasoning = None
                     cycle_count += 1
                     llm_cycle_count += 1
 
@@ -500,7 +503,6 @@ def run_coding_agent_call(
                     emitter=emitter,
                     placement=Placement(turn_index=turn_index, tab_index=tab_index),
                 )
-                _ = most_recent_reasoning  # currently unused; kept for parity
                 span.span_data.output = final_answer
                 emitter.emit(
                     Packet(
```

**File**: `backend/tests/unit/onyx/tools/test_coding_agent_loop.py` (added, +305/-0)
```diff
@@ -0,0 +1,305 @@
+"""Sub-turn placement in the coding agent loop (``run_coding_agent_call``)."""
+
+import json
+import queue
+from collections.abc import Iterator
+from contextlib import contextmanager
+from typing import Any
+from unittest.mock import patch
+
+from onyx.chat.emitter import Emitter
+from onyx.coding_agent.mock_tools import (
+    BASH_TOOL_NAME,
+    CODING_AGENT_QUERY_KEY,
+    CODING_AGENT_REPO_KEY,
+    GENERATE_ANSWER_TOOL_NAME,
+)
+from onyx.coding_agent.models import CodingAgentCallResult
+from onyx.configs.chat_configs import LLM_SOCKET_READ_TIMEOUT
+from onyx.deep_research.dr_mock_tools import (
+    THINK_TOOL_NAME,
+    THINK_TOOL_RESPONSE_MESSAGE,
+)
+from onyx.llm.interfaces import LLMConfig, LLMUserIdentity
+from onyx.llm.model_request import ChatCompletionMessage, SystemMessage, ToolMessage
+from onyx.llm.model_response import (
+    ChatCompletionDeltaToolCall,
+    Delta,
+    ModelResponseStream,
+    ResponseFunctionCall,
+    StreamingChoice,
+)
+from onyx.llm.models import ReasoningEffort, ToolChoice
+from onyx.llm.multi_llm import LitellmLLM, ProviderOperation
+from onyx.server.query_and_chat.placement import Placement
+from onyx.server.query_and_chat.streaming_models import (
+    CodingAgentThinkingDelta,
+    Packet,
+    ReasoningDelta,
+    ReasoningStart,
+)
+from onyx.tools.fake_tools import coding_agent
+from onyx.tools.models import ToolCallKickoff, ToolResponse
+
+MODULE = "onyx.tools.fake_tools.coding_agent"
+TURN_INDEX = 3
+TAB_INDEX = 1
+
+
+def _chunk(delta: Delta) -> ModelResponseStream:
+    return ModelResponseStream(id="c", created="0", choice=StreamingChoice(delta=delta))
+
+
+def text(content: str) -> list[ModelResponseStream]:
+    return [_chunk(Delta(content=content))]
+
+
+def reasoning(content: str) -> list[ModelResponseStream]:
+    return [_chunk(Delta(reasoning_content=content))]
+
+
+def tool_call(
+    index: int, call_id: str, name: str, args: dict[str, Any]
+) -> list[ModelResponseStream]:
+    return [
+        _chunk(
+            Delta(
+                tool_calls=[
+                    ChatCompletionDeltaToolCall(
+                        id=call_id,
+                        index=index,
+                        function=ResponseFunctionCall(name=name, arguments=""),
+                    )
+                ]
+            )
+        ),
+        _chunk(
+            Delta(
+                tool_calls=[
+                    ChatCompletionDeltaToolCall(
+                        index=index,
+                        function=ResponseFunctionCall(arguments=json.dumps(args)),
+                    )
+                ]
+            )
+        ),
+    ]
+
+
+def bash(call_id: str, cmd: str) -> list[ModelResponseStream]:
+    return tool_call(0, call_id, BASH_TOOL_NAME, {"cmd": cmd})
+
+
+def think(call_id: str, thought: str) -> list[ModelResponseStream]:
+    return tool_call(0, call_id, THINK_TOOL_NAME, {"reasoning": thought})
+
+
+def generate_answer() -> list[ModelResponseStream]:
+    return tool_call(0, "answer", GENERATE_ANSWER_TOOL_NAME, {})
+
+
+FINAL_ANSWER = text("The final answer.")
+
+
+class ScriptedLLM(LitellmLLM):
+    def __init__(self, steps: list[list[ModelResponseStream]]) -> None:
+        super().__init__(
+            model_provider="openai",
+            api_key=None,
+            model_name="mock-model",
+            max_input_tokens=100_000,
+        )
+        self._steps = list(steps)
+        self.prompts: list[list[ChatCompletionMessage]] = []
+
+    @property
+    def config(self) -> LLMConfig:
+        return LLMConfig(
+            model_provider="mock",
+            model_name="mock-model",
+            temperature=0.0,
+            max_input_tokens=100_000,
+        )
+
+    def stream_raw(
+        self,
+        prompt: list[ChatCompletionMessage],
+        tools: list[dict] | None = None,  # noqa: ARG002
+        tool_choice: ToolChoice | None = None,  # noqa: ARG002
+        structured_response_format: dict | None = None,  #
```

#### Recent Merged Pull Requests:
- **PR #15297** (2026-09-30): chore(hotfix): cherry-pick 2 commits to release v4.9 (@nmgarza5)
- **PR #15287** (2026-09-30): chore(hotfix): cherry-pick 2 commits to release v4.9 (@nmgarza5)
- **PR #15286** (2026-09-30): chore(hotfix): cherry-pick 2 commits to release v4.8 (@nmgarza5)
- **PR #15284** (closed): chore(deps): bump pyjwt from 2.13.0 to 2.14.0 (@justin-tahara)
- **PR #15283** (closed): chore(deps): update node base image digests (#14696) to release v4.8 (@onyx-cherry-pick[bot])
- **PR #15282** (closed): chore(deps): update python base image digests (#14697) to release v4.8 (@onyx-cherry-pick[bot])
- **PR #15281** (2026-09-29): chore(hotfix): cherry-pick 2 commits to release v4.8 (@nmgarza5)
- **PR #15277** (2026-09-29): chore(deps): update node base image digests (#14696) to release v4.9 (@onyx-cherry-pick[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
