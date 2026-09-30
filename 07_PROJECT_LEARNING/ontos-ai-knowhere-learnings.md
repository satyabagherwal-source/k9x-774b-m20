# Forensic Learning Record (Deep Inspection): Ontos-AI/knowhere

> **Canonical Artifact**: `07_PROJECT_LEARNING/ontos-ai-knowhere-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ontos-AI/knowhere](https://github.com/Ontos-AI/knowhere))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:21:44.377Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ontos-AI/knowhere`
- **Description**: Knowhere extracts, parses, and outputs structured chunks ready for AI Agents and RAG.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3578 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/api/alembic/env.py`
```
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection, Engine

from alembic import context

# Import the shared database configuration and metadata.
from shared.core.config import settings
from shared.core.database import Base
from shared.models import database as shared_database_models  # noqa: F401
from shared.services.auth.user_table_bootstrap import ensure_better_auth_user_table

# Build a synchronous database URL by replacing asyncpg with psycopg2.
sync_database_url = settings.DATABASE_URL.replace("asyncpg", "psycopg2")

# Read SSL connect args from shared settings.
ssl_connect_args = settings.get_ssl_connect_args()

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

_EXTERNALLY_MANAGED_TABLES: frozenset[str] = frozenset(
    {
        "user",
        "verification",
        "jwks",
        "account",
        "emailVerificationToken",
        "session",
    }
)


def include_object(
    object_: object,
    name: str | None,
    type_: str,
    reflected: bool,
    compare_to: object | None,
) -> bool:
    """Exclude externally managed auth tables."""
    del object_, compare_to, reflected
    if type_ == "table" and isinstance(name, str) and name in _EXTERNALLY_MANAGED_TABLES:
        return False
    return True


# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    # Use the shared synchronous database configuration.
    url = sync_database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Keep each migration in its own transaction so migrations that
        # require an autocommit block (for example CREATE INDEX
        # CONCURRENTLY) can safely commit only their own predecessor.
        transaction_per_migration=True,
        # Pass through configured SSL connect args.
        connect_args=ssl_connect_args,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    configured_connection = config.attributes.get("connection")

    def run_with_connection(connection: Connection) -> None:
        caller_owned_transaction = connection.in_transaction()
        if settings.API_STANDALONE_MODE_ENABLED:
            ensure_better_auth_user_table(connection)
            # The standalone bootstrap query starts SQLAlchemy's implicit
            # transaction before Alembic begins tracking migration
            # transactions.  End only that transaction; never commit a
            # transaction supplied by the caller.
            if not caller_owned_transaction:
                connection.commit()

        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            # Required for migrations that use autocommit_block().
            transaction_per_migration=True,
            # Concurrent DDL cannot run inside a transaction owned by the
            # caller.  Migrations use regular DDL for that compatibility path.
            knowhere_external_transaction=caller_owned_transaction,
        )

        with context.begin_transaction():
            context.run_migrations()

    if isinstance(configured_connection, Connection):
        run_with_connection(configured_connection)
        return

    if isinstance(configured_connection, Engine):
        with configured_connection.connect() as connection:
            run_with_connection(connection)
        return

    # Use create_engine directly so SSL connect args are applied explicitly.
    from sqlalchemy import create_engine

    connectable = create_engine(
        sync_database_url,
        poolclass=pool.NullPool,
        connect_args=ssl_connect_args,
    )

    with connectable.connect() as connection:
        run_with_connection(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

```

### Core Architecture Module: `apps/api/alembic/versions/0a1b2c3d4e5f_add_content_trigram_index.py`
```
"""Add trigram acceleration for regex searches over published chunk content."""

from __future__ import annotations

from typing import Sequence

from alembic import op


revision: str = "0a1b2c3d4e5f"
down_revision: str | None = "9f0a1b2c3d4e"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_INDEX_NAME = "idx_document_chunks_content_trgm"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    external_transaction = bool(
        op.get_context().opts.get("knowhere_external_transaction", False)
    )
    if external_transaction:
        op.execute(
            f"CREATE INDEX IF NOT EXISTS {_INDEX_NAME} "
            "ON document_chunks USING gin (content gin_trgm_ops) "
            "WHERE content IS NOT NULL"
        )
        return
    with op.get_context().autocommit_block():
        op.execute(
            f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {_INDEX_NAME} "
            "ON document_chunks USING gin (content gin_trgm_ops) "
            "WHERE content IS NOT NULL"
        )


def downgrade() -> None:
    external_transaction = bool(
        op.get_context().opts.get("knowhere_external_transaction", False)
    )
    if external_transaction:
        op.execute(f"DROP INDEX IF EXISTS {_INDEX_NAME}")
        return
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX_NAME}")

```

### Core Architecture Module: `apps/api/alembic/versions/0b1c2d3e4f5a_add_demo_materialization_claim_state.py`
```
"""Add demo materialization claim state."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0b1c2d3e4f5a"
down_revision: str | Sequence[str] | None = "e4f5a6b7c8d9"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "demo_materializations",
        sa.Column("status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "demo_materializations",
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
    )
    op.execute(
        "UPDATE demo_materializations SET status = 'ready' WHERE status IS NULL"
    )
    op.alter_column(
        "demo_materializations",
        "status",
        existing_type=sa.String(length=32),
        nullable=False,
        server_default="ready",
    )
    op.alter_column(
        "demo_materializations",
        "document_id",
        existing_type=sa.String(length=36),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "demo_materializations",
        "document_id",
        existing_type=sa.String(length=36),
        nullable=False,
    )
    op.drop_column("demo_materializations", "claimed_at")
    op.drop_column("demo_materializations", "status")

```

### Core Architecture Module: `apps/api/alembic/versions/0c1d2e3f4a5b_add_chunk_revision_section_order_index.py`
```
"""Add the index used by lazy map-nav section loads."""

from __future__ import annotations

from alembic import op


revision = "0c1d2e3f4a5b"
down_revision = "fbf0c1d2e3f4"
branch_labels = None
depends_on = None

_INDEX_NAME = "idx_document_chunks_revision_section_order"


def upgrade() -> None:
    external_transaction = bool(
        op.get_context().opts.get("knowhere_external_transaction", False)
    )
    if external_transaction:
        op.execute(
            f"CREATE INDEX IF NOT EXISTS {_INDEX_NAME} "
            "ON document_chunks "
            "(document_id, job_result_id, section_id, sort_order, chunk_id, id)"
        )
        return
    with op.get_context().autocommit_block():
        op.execute(
            f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {_INDEX_NAME} "
            "ON document_chunks "
            "(document_id, job_result_id, section_id, sort_order, chunk_id, id)"
        )


def downgrade() -> None:
    external_transaction = bool(
        op.get_context().opts.get("knowhere_external_transaction", False)
    )
    if external_transaction:
        op.execute(f"DROP INDEX IF EXISTS {_INDEX_NAME}")
        return
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX_NAME}")

```

### Core Architecture Module: `apps/api/alembic/versions/1a2b3c4d5e6f_drop_content_trigram_index.py`
```
"""Drop the content trigram index — grep now uses idx_document_chunks_term_trgm."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "1a2b3c4d5e6f"
down_revision: str | Sequence[str] | None = "0b1c2d3e4f5a"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_INDEX_NAME = "idx_document_chunks_content_trgm"


def upgrade() -> None:
    external_transaction = bool(
        op.get_context().opts.get("knowhere_external_transaction", False)
    )
    if external_transaction:
        op.execute(f"DROP INDEX IF EXISTS {_INDEX_NAME}")
        return
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX_NAME}")


def downgrade() -> None:
    external_transaction = bool(
        op.get_context().opts.get("knowhere_external_transaction", False)
    )
    if external_transaction:
        op.execute(
            f"CREATE INDEX IF NOT EXISTS {_INDEX_NAME} "
            "ON document_chunks USING gin (content gin_trgm_ops) "
            "WHERE content IS NOT NULL"
        )
        return
    with op.get_context().autocommit_block():
        op.execute(
            f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {_INDEX_NAME} "
            "ON document_chunks USING gin (content gin_trgm_ops) "
            "WHERE content IS NOT NULL"
        )

```

### Core Architecture Module: `apps/api/alembic/versions/1d2e3f4a5b6c_add_document_map_units.py`
```
"""Add revision-pinned map-nav score units."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1d2e3f4a5b6c"
down_revision = "0c1d2e3f4a5b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("document_map_unit_indexes"):
        op.create_table(
            "document_map_unit_indexes",
            sa.Column("id", sa.String(length=100), nullable=False),
            sa.Column("document_id", sa.String(length=36), nullable=False),
            sa.Column("job_result_id", sa.String(length=36), nullable=False),
            sa.Column("format_version", sa.Integer(), nullable=False),
            sa.Column("unit_count", sa.Integer(), nullable=False),
            sa.Column("token_count", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["document_id"], ["documents.document_id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["job_result_id"], ["job_results.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "document_id",
                "job_result_id",
                name="uq_document_map_unit_indexes_revision",
            ),
        )
    if not inspector.has_table("document_map_units"):
        op.create_table(
            "document_map_units",
            sa.Column("id", sa.String(length=160), nullable=False),
            sa.Column("document_id", sa.String(length=36), nullable=False),
            sa.Column("job_result_id", sa.String(length=36), nullable=False),
            sa.Column("unit_id", sa.String(length=128), nullable=False),
            sa.Column("section_id", sa.String(length=36), nullable=False),
            sa.Column("unit_kind", sa.String(length=32), nullable=False),
            sa.Column("path_token_count", sa.Integer(), nullable=False),
            sa.Column("content_token_count", sa.Integer(), nullable=False),
            sa.Column("term_search_text_lower", sa.Text(), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["document_id"], ["documents.document_id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["job_result_id"], ["job_results.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    if not inspector.has_table("document_map_unit_tokens"):
        op.create_table(
            "document_map_unit_tokens",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("map_unit_id", sa.String(length=160), nullable=False),
            sa.Column("channel", sa.String(length=16), nullable=False),
            sa.Column("token", sa.Text(), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("frequency", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(
                ["map_unit_id"], ["document_map_units.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
        )
    inspector = sa.inspect(bind)
    indexes = {
        item["name"] for item in inspector.get_indexes("document_map_unit_indexes")
    }
    if "idx_document_map_unit_indexes_revision" not in indexes:
        op.create_index(
            "idx_document_map_unit_indexes_revision",
            "document_map_unit_indexes",
            ["document_id", "job_result_id"],
        )
    indexes = {item["name"] for item in inspector.get_indexes("document_map_units")}
    if "idx_document_map_units_revision_order" not in indexes:
        op.create_index(
            "idx_document_map_units_revision_order",
            "document_map_units",
            ["document_id", "job_result_id", "sort_order", "unit_id"],
        )
    if "idx_document_map_units_section" not in indexes:
        op.create_index(
            "idx_document_map_units_section", "document_map_units", ["section_id"]
        )
    indexes = {
        item["name"] for item in inspector.get_indexes("document_map_unit_tokens")
    }
    if "idx_document_map_unit_tokens_lookup" not in indexes:
        op.create_index(
            "idx_document_map_unit_tokens_lookup",
            "document_map_unit_tokens",
            ["channel", "token_hash", "map_unit_id"],
        )
    if "idx_document_map_unit_tokens_unit" not in indexes:
        op.create_index(
            "idx_document_map_unit_tokens_unit",
            "document_map_unit_tokens",
            ["map_unit_id", "channel"],
        )


def downgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())
    for table_name in (
        "document_map_unit_tokens",
        "document_map_units",
        "document_map_unit_indexes",
    ):
        if table_name in existing_tables:
            op.drop_table(table_name)

```

### Core Architecture Module: `apps/api/alembic/versions/2b3c4d5e6f70_compact_token_lookup_index.py`
```
"""Compact token lookup indexes without changing the retrieval query contract."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text


revision: str = "2b3c4d5e6f70"
down_revision: str | None = "1a2b3c4d5e6f"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

_INDEX_NAME = "idx_document_map_unit_tokens_token_lookup_compact"
_KEY_COLUMNS = "(channel, token_hash)"
_OLD_DEFINITION = "(channel, token_hash, map_unit_id)"
_OLD_INCLUDE = "INCLUDE (token, frequency)"
_COMPACT_DEFINITION = "(channel, token_hash)"
_COMPACT_INCLUDE = "INCLUDE (map_unit_id, token, frequency)"


def _index_definition(index_name: str) -> tuple[bool, bool, str] | None:
    row = op.get_bind().execute(
        text(
            "SELECT indexes.indisvalid, indexes.indisready, "
            "pg_get_indexdef(indexes.indexrelid) "
            "FROM pg_index AS indexes "
            "JOIN pg_class AS classes ON classes.oid = indexes.indexrelid "
            "JOIN pg_namespace AS namespaces ON namespaces.oid = classes.relnamespace "
            "WHERE namespaces.nspname = current_schema() "
            "AND classes.relname = :index_name"
        ),
        {"index_name": index_name},
    ).one_or_none()
    if row is None:
        return None
    return bool(row[0]), bool(row[1]), str(row[2])


def _matches(index_name: str, *, compact: bool) -> bool:
    state = _index_definition(index_name)
    if state is None:
        return False
    is_valid, is_ready, definition = state
    if not is_valid or not is_ready:
        return False
    if compact:
        return _COMPACT_DEFINITION in definition and _COMPACT_INCLUDE in definition
    return _OLD_DEFINITION in definition and _OLD_INCLUDE in definition


def _ensure_index(*, compact: bool, concurrently: bool) -> None:
    concurrent_clause = "CONCURRENTLY " if concurrently else ""
    if _matches(_INDEX_NAME, compact=compact):
        return
    include_columns = (
        " INCLUDE (map_unit_id, token, frequency)"
        if compact
        else " INCLUDE (token, frequency)"
    )
    op.execute(
        f"CREATE INDEX {concurrent_clause}IF NOT EXISTS {_INDEX_NAME} "
        f"ON document_map_unit_tokens {_KEY_COLUMNS if compact else _OLD_DEFINITION}"
        f"{include_columns}"
    )


def _run_replacement(*, compact: bool) -> None:
    external_transaction = bool(
        op.get_context().opts.get("knowhere_external_transaction", False)
    )
    if external_transaction:
        _ensure_index(compact=compact, concurrently=False)
        return
    with op.get_context().autocommit_block():
        _ensure_index(compact=compact, concurrently=True)


def upgrade() -> None:
    """Narrow the lookup key while retaining index-only retrieval columns."""
    _run_replacement(compact=True)


def downgrade() -> None:
    """Remove only the additive compact lookup index."""
    external_transaction = bool(
        op.get_context().opts.get("knowhere_external_transaction", False)
    )
    if external_transaction:
        op.execute(f"DROP INDEX IF EXISTS {_INDEX_NAME}")
        return
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {_INDEX_NAME}")

```

### Core Architecture Module: `apps/api/alembic/versions/2b3c4d5e6f7a_drop_map_unit_term_search_text.py`
```
"""Drop unused map-unit term-search leftovers.

Classic scoring is path + content only. ``term_search_text_lower`` on
``document_map_units`` and its trigram index had no reader. Chunk
``term_search_text`` and ``idx_document_chunks_term_trgm`` stay: grep uses them.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "2b3c4d5e6f7a"
down_revision: str | None = "2f3g4h5i6j7"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

__all__ = [
    "revision",
    "down_revision",
    "branch_labels",
    "depends_on",
    "upgrade",
    "downgrade",
]

_MAP_UNIT_INDEX = "idx_document_map_units_term_trgm"


def upgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {_MAP_UNIT_INDEX}")
    inspector = sa.inspect(op.get_bind())
    columns = {col["name"] for col in inspector.get_columns("document_map_units")}
    if "term_search_text_lower" in columns:
        op.drop_column("document_map_units", "term_search_text_lower")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {col["name"] for col in inspector.get_columns("document_map_units")}
    if "term_search_text_lower" not in columns:
        op.add_column(
            "document_map_units",
            sa.Column("term_search_text_lower", sa.Text(), nullable=False, server_default=""),
        )
        op.alter_column("document_map_units", "term_search_text_lower", server_default=None)
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        f"CREATE INDEX IF NOT EXISTS {_MAP_UNIT_INDEX} "
        "ON document_map_units USING gin "
        "(term_search_text_lower gin_trgm_ops)"
    )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #399** (2026-09-09): **Fix retrieval 500 caused by idle-in-transaction connection termination**
  *Symptoms*: ## Summary  Production retrieval requests can return HTTP 500 when the request-scoped async SQLAlchemy session holds an idle PostgreSQL transaction while the agentic retrieval episode waits on an external LLM/agent call.  ## Production evidence  - Alert window: 2026-09-09 09:49:44–10:24:46 CST - Failing endpoint: `POST /v1/retrieval/query` - Failing API task: `dfeb34741b2748c190c73d0f9d57d1fe` - Task private IP: `10.0.136.212` - Trace: `01a083eb5f607c35931721077dafb81b` - Failure time: 2026-09-09 10:08:27 CST (`02:08:27 UTC`) - HTTP result: `500 Internal Server Error`  Aurora PostgreSQL logged 12 seconds before the API error:  ```text 2026-09-09 02:08:15 UTC:10.0.136.212(...):postgres@knowhere:...:FATAL: terminating connection due to idle-in-transaction timeout ```  The API then attempted the final document hydration query using that closed connection:  ```text asyncpg.exceptions._base.InterfaceError: connection is closed ```  The API invalidated the connection and established a replacement connection about four seconds later. The task remained healthy and was not restarted. No Aurora failover or restart event was found.  ## Root cause  The retrieval route receives a request-scoped `AsyncSession` from `get_db()` and passes it through the retrieval pipeline. In the agentic path:  1. The route performs initial database work. 2. `_run_agent_explore_route()` waits for `harness.run_episode(...)`. 3. The episode took 71.575 seconds in the failing request. 4. The same session/transa

- **Issue #255** (2026-08-20): **Stop scraping email addresses from GitHub**
  *Symptoms*: ### Affected area  Other  ### Summary  <img width="1994" height="1518" alt="Image" src="https://github.com/user-attachments/assets/431da31f-bbf6-4809-91e4-acfaeee8ab20" />  ### Reproduction steps  You email me out of the blue with an email address that's only ever appeared on GitHub. So you've scraped it or bought it from a service that scraped it. I never subscribed to your service and it's super poor form that you've resorted to this.  ### Relevant request or job details  ```text  ```
  **Post-Mortem & Fix Analysis**:
  > We did not scrape or purchase any personal data. We discovered your GitHub profile and open-source projects, found them interesting, and manually looked up a contact email to send a one-time outreach message.  We apologize if this was unwanted or disruptive. Your email has been removed from our outreach list and you will not receive further messages from us.  Thank you for the feedback.

- **Issue #127** (2026-06-04): **Resolve Issue #126**
  *Symptoms*: ## Summary  - Implemented H2-aware shard refinement logic to improve document splitting granularity and adherence to size constraints. This resolves the timeout issue when processing oversized PDF files. - No API contract changes; only worker parser logic is updated. - Closes #126  ## Verification  - Ran `make lint` locally: All checks passed. - Ran `make typecheck` locally: 0 errors, 0 warnings. - CI running full test suite (pytest apps/api/tests apps/worker/tests/contract).  ## Deployment Notes  - No new environment variables. - No database migrations required. - No backwards compatibility concerns.  ## Checklist  - [x] Tests were added or updated when behavior changed - [x] Logs, errors, and validation paths avoid leaking secrets or user data - [x] The pull request description explains any breaking or user-visible change

- **Issue #126** (2026-06-04): **Document processing fails/times out when uploading oversized PDF files**
  *Symptoms*: **Describe the bug** When I upload a very large PDF file (e.g., a 500-page report), the system seems to freeze in the 'Processing' state for a long time, and eventually times out or fails with an error. The document never becomes available for querying.  **To Reproduce** Steps to reproduce the behavior: 1. Go to the document upload page. 2. Select a PDF file that is extremely large (e.g., hundreds of pages). 3. Click on upload. 4. Wait for the processing to finish. 5. See error or timeout.  **Expected behavior** The system should either process the document successfully by breaking it down into smaller parts, or provide a clear progress indicator, rather than just timing out.  **Screenshots/Logs** The UI just shows a timeout error after 5 minutes.  **Additional context** We frequently deal with large corporate reports and need the system to reliably handle these oversized files without crashing. 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #127 (squash merged into staging).

- **Issue #118** (2026-06-01): **Resolve Issue #117: Fix evidence tree orphan nesting, outline leakage, and enforce English agent reasoning**
  *Symptoms*: Closes #117  ## Summary  This PR fixes three bugs in the agentic retrieval evidence pipeline discovered during E2E trace analysis (T2/T4/T6):  ### Fix 1: Evidence Tree Orphan Nesting (Bug 1)  **Root cause**: `_build_outline_subtree` created new parent nodes but failed to migrate pre-existing children under them. Additionally, `_hydrate_collected` passed unfiltered `outline_items` containing ancestor/sibling context from `load_child_sections`, causing echo structures.  **Changes**: - `document.py`: Added reparenting logic in `_build_outline_subtree` (lines 712-726) to recursively move existing children under newly created parent nodes - `document.py`: Added `startswith` filter in `_hydrate_collected` (lines 331-334) to exclude ancestor/sibling items from child node outlines  ### Fix 2: Outline-Only Evidence Leakage (Bug 2)  **Root cause**: `render_evidence()` used `has_content()` which returns True for outline-only trees. When KG Select picks a document but Navigate returns `collect=[], STOP` (no relevant content), the top-level outline skeleton still leaked into evidence_text (950 chars of wasted context budget).  **Change**:  - `builder.py`: Changed guard from `has_leaf_content() or has_content()` to `has_leaf_content()` only. Documents without hydrated chunks are now skipped entirely.  ### Fix 3: English Agent Reasoning (Bug 3)  **Changes**: - `prompts.py`: Added `IMPORTANT` block to `COLLECTOR_PROMPT` requiring `reason` and other free-text fields to be written in English -

- **Issue #117** (2026-06-02): **Agentic retrieval: evidence rendering bugs — orphan nesting, outline leakage, and non-English agent reasoning**
  *Symptoms*: ## Problem Description  When using the agentic retrieval pipeline to query documents, several rendering and behavioral anomalies have been observed in the evidence output:  ### Bug 1: Evidence Tree Orphan Nesting Failure When a document section is collected via COLLECT and its parent is created via `_build_outline_subtree`, pre-existing child nodes are not migrated under the new parent. This causes leaf sections to appear as orphans at the wrong tree depth in the evidence text, producing duplicated and incorrectly nested headings.  **Example**: Querying "深信服安全GPT的技术方案" returns: - `(四) 深信服安全 GPT` floating at L1 as an orphan instead of nesting under `六、 解决方案与案例` - Echo structures where `六、 解决方案与案例` appears redundantly inside child subtrees  ### Bug 2: Outline-Only Evidence Leakage   When the navigation agent determines a document is irrelevant (returns `collect=[], action=STOP`), the evidence rendering still outputs 950+ characters of the document's top-level outline skeleton. This is because `render_evidence()` checks `has_content()` which returns True for outline-only trees (populated during the initial `load_child_sections` call), even though no content was actually selected.  **Expected behavior**: If no chunks are collected and no discovery selections are made, evidence_text for that document should be empty.  ### Bug 3: Non-English Agent Reasoning The `reason` field in navigation responses and `reasoning_summary` in workflow planner responses are written in the source doc

- **Issue #107** (2026-05-25): **[Notebook UI] Layout not responsive — overflows on 13-inch MacBook Air screen**
  *Symptoms*: ### Affected area  Other  ### Summary  **Describe the bug** The Notebook module's frontend layout is not responsive to screen width. On a 13-inch MacBook Air, UI elements overflow horizontally and do not adapt to the viewport, making the interface difficult to use.  **Expected Behavior** All UI panels should adapt to the available screen width, maintaining a usable layout without horizontal overflow or clipped content.  **Actual Behavior** The layout appears designed for larger screens. On 13-inch displays, content is clipped or panels overlap, reducing usability.  **Screenshots**  <img width="1999" height="1080" alt="Image" src="https://github.com/user-attachments/assets/b223e891-9ebe-477b-a3ef-6e827cef1013" />  **Environment** - Device: MacBook Air 13-inch - OS: macOS - Browser: [e.g. Chrome / Safari] - Screen resolution: native display resolution  **Additional Context** The issue is visible in the three-panel layout (Sources / Parsed Chunks / Assistant). Responsive CSS breakpoints or a flexible grid layout would address this.  ### Reproduction steps  1. Open Knowhere Notebook in a browser on a 13-inch MacBook Air 2. Upload documents and navigate to the Parsed Chunks view 3. Observe that the right-side panel (Knowhere Assistant) and the main content area overflow or do not scale properly  ### Relevant request or job details  ```text  ```

- **Issue #92** (2026-05-19): **Agentic retrieval sends table artifact URLs as VLM image inputs**
  *Symptoms*: ## Summary  Agentic retrieval can invoke the multimodal answer path with a table artifact URL as an `image_url`. The VLM provider then rejects the request because the URL points to a table/HTML artifact rather than a decodable image.  

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

### Incident Patch 1: `5c75c9cf` (2026-09-30)
**Commit Message**: fix: await canonical bundle cancellation work

**File**: `apps/api/app/services/demo/canonical_bundle.py` (modified, +2/-2)
```diff
@@ -104,7 +104,7 @@ async def ensure_bundle(
                 uploaded_bundle: CanonicalDemoBundle = await asyncio.shield(upload)
             except asyncio.CancelledError:
                 # A thread cannot be cancelled; retain the lease until it stops.
-                await upload
+                await asyncio.gather(upload)
                 raise
             if renewal.done():
                 renewal.result()
@@ -118,7 +118,7 @@ async def ensure_bundle(
             try:
                 await asyncio.shield(marker_upload)
             except asyncio.CancelledError:
-                await marker_upload
+                await asyncio.gather(marker_upload)
                 raise
             return uploaded_bundle
         finally:
```

**File**: `apps/api/tests/contract/test_canonical_demo_bundle_contract.py` (modified, +90/-0)
```diff
@@ -6,6 +6,8 @@
 from collections.abc import Callable
 from contextlib import AbstractAsyncContextManager
 from pathlib import Path
+from threading import Event
+from typing import Literal
 
 import pytest
 from httpx import AsyncClient
@@ -19,6 +21,94 @@ def _write_source(directory: Path, content: str) -> None:
     (directory / "source.md").write_text(content, encoding="utf-8")
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("stage", ("upload", "marker"))
+async def test_cancellation_retains_lease_until_storage_work_finishes(
+    api_client_factory: Callable[[], AbstractAsyncContextManager[AsyncClient]],
+    tmp_path: Path,
+    monkeypatch: MonkeyPatch,
+    stage: Literal["upload", "marker"],
+) -> None:
+    async with api_client_factory():
+        from app.services.demo.canonical_bundle import (
+            CanonicalDemoBundleStore,
+            _calculate_content_version,
+            _read_source_signature,
+        )
+        from app.services.demo.canonical_bundle_result import CanonicalDemoBundle
+        from shared.services.redis import RedisServiceFactory
+
+        directory: Path = tmp_path / stage
+        _write_source(directory, "Cancellation must retain the upload lease")
+        source_id: str = f"contract-cancel-{stage}"
+        version: str = _calculate_content_version(
+            directory, _read_source_signature(directory)
+        )
+        lock_key: str = f"lock:demo_bundle:{source_id}:{version}"
+        redis_service = RedisServiceFactory.get_service()
+        store = CanonicalDemoBundleStore(redis_service=redis_service)
+        loop: asyncio.AbstractEventLoop = asyncio.get_running_loop()
+        started: asyncio.Event = asyncio.Event()
+        released: Event = Event()
+        finished: Event = Event()
+        original_upload = store._upload_bundle
+        original_marker = store._write_ready_marker
+
+        def pause_storage() -> None:
+            loop.call_soon_threadsafe(started.set)
+            if not released.wait(timeout=10):
+                raise TimeoutError("Contract did not release paused storage work")
+
+        def upload_bundle(
+            storage_id: str,
+            content_version: str,
+            source_directory: Path,
+            signature: tuple[tuple[str, int, int, int], ...],
+        ) -> CanonicalDemoBundle:
+            pause_storage()
+            try:
+                return original_upload(
+                    storage_id, content_version, source_directory, signature
+                )
+            finally:
+                finished.set()
+
+        def write_marker(bundle: CanonicalDemoBundle) -> None:
+            pause_storage()
+            try:
+                original_marker(bundle)
+            finally:
+                finished.set()
+
+        if stage == "upload":
+            monkeypatch.setattr(store, "_upload_bundle", upload_bundle)
+        else:
+            monkeypatch.setattr(store, "_write_ready_marker", write_marker)
+        request: asyncio.Task[CanonicalDemoBundle] = asyncio.create_task(
+            store.ensure_bundle(source_id=source_id, source_directory=directory)
+        )
+        try:
+            await asyncio.wait_for(started.wait(), timeout=10)
+            owner: object = await redis_service.get(lock_key)
+            assert owner is not None
+            request.cancel()
+            await asyncio.sleep(0)
+            assert not request.done()
+            assert not finished.is_set()
+            assert await redis_service.get(lock_key) == owner
+        finally:
+            released.set()
+            with pytest.raises(asyncio.CancelledError):
+                await asyncio.wait_for(request, timeout=10)
+
+        assert finished.is_set()
+        assert not await redis_service.exists(lock_key)
+        recovered = await CanonicalDemoBundleStore(
+            redis_service=redis_service
+        ).ensure_bundle(source_id=source_id, source_directory=directory)
+        assert recovered.reused is (st
```

---

### Incident Patch 2: `76c961d2` (2026-09-30)
**Commit Message**: Merge pull request #448 from Ontos-AI/fix/wangbinqi/publication-runtime-compatibility

fix: handle gevent publication writes and bound COPY batches

**File**: `apps/api/tests/contract/test_publication_chunk_copy_contract.py` (modified, +12/-0)
```diff
@@ -6,6 +6,8 @@
 from collections.abc import Iterator
 
 import pytest
+from psycogreen.gevent import patch_psycopg
+from psycopg2.extensions import get_wait_callback, set_wait_callback
 from sqlalchemy import create_engine, text
 from sqlalchemy.engine import make_url
 from sqlalchemy.ext.asyncio import create_async_engine
@@ -111,9 +113,17 @@ def _read_rows(connection) -> list[tuple[object, ...]]:
     )
 
 
+@pytest.mark.parametrize("has_cooperative_callback", [False, True])
 def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
     contract_database_url: str,
+    has_cooperative_callback: bool,
 ) -> None:
+    original_callback = get_wait_callback()
+    if has_cooperative_callback:
+        patch_psycopg()
+    else:
+        set_wait_callback(None)
+    expected_callback = get_wait_callback()
     url = make_url(contract_database_url).set(drivername="postgresql+psycopg2")
     engine = create_engine(url)
     try:
@@ -122,6 +132,7 @@ def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
             connection.commit()
             with Session(bind=connection) as session:
                 insert_chunks_with_copy(session, _build_chunks())
+                assert get_wait_callback() is expected_callback
                 rows = _read_rows(connection)
                 assert rows[0][1:5] == (
                     "",
@@ -135,6 +146,7 @@ def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
             assert connection.scalar(text("SELECT count(*) FROM document_chunks")) == 0
     finally:
         engine.dispose()
+        set_wait_callback(original_callback)
 
 
 async def test_candidate_chunk_copy_supports_asyncpg_owner_and_rollback(
```

**File**: `apps/api/tests/contract/test_publication_token_copy_contract.py` (modified, +67/-1)
```diff
@@ -6,8 +6,10 @@
 from collections.abc import Iterator
 
 import pytest
+from psycogreen.gevent import patch_psycopg
+from psycopg2.extensions import get_wait_callback, set_wait_callback
 from sqlalchemy import create_engine, text
-from sqlalchemy.engine import make_url
+from sqlalchemy.engine import Connection, make_url
 from sqlalchemy.ext.asyncio import create_async_engine
 from sqlalchemy.orm import Session
 
@@ -59,9 +61,17 @@ def contract_database_url(
     yield get_contract_database_url()
 
 
+@pytest.mark.parametrize("has_cooperative_callback", [False, True])
 def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
     contract_database_url: str,
+    has_cooperative_callback: bool,
 ) -> None:
+    original_callback = get_wait_callback()
+    if has_cooperative_callback:
+        patch_psycopg()
+    else:
+        set_wait_callback(None)
+    expected_callback = get_wait_callback()
     url = make_url(contract_database_url).set(drivername="postgresql+psycopg2")
     engine = create_engine(url)
     try:
@@ -70,6 +80,7 @@ def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
             connection.commit()
             with Session(bind=connection) as session:
                 insert_token_rows_with_copy(session, _TOKEN_ROWS)
+                assert get_wait_callback() is expected_callback
                 values = connection.execute(
                     text("SELECT token, frequency FROM document_map_unit_tokens ORDER BY id")
                 ).all()
@@ -80,6 +91,7 @@ def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
             ) == 0
     finally:
         engine.dispose()
+        set_wait_callback(original_callback)
 
 
 async def test_candidate_copy_preserves_rows_and_rollback_with_asyncpg(
@@ -114,3 +126,57 @@ def copy_and_read(sync_connection) -> list[tuple[str, int]]:
             ) == 0
     finally:
         await engine.dispose()
+
+
+async def test_candidate_token_writes_complete_under_per_command_budget(
+    contract_database_url: str,
+) -> None:
+    """Slow token writes must stay atomic without requiring one long command."""
+    url = make_url(contract_database_url).set(drivername="postgresql+asyncpg")
+    engine = create_async_engine(
+        url,
+        connect_args={
+            "command_timeout": 3,
+            "server_settings": {"statement_timeout": "3000"},
+        },
+    )
+    rows: list[dict[str, object]] = [
+        {**_TOKEN_ROWS[0], "id": f"dmut_slow_{index}"}
+        for index in range(2_501)
+    ]
+    try:
+        async with engine.connect() as connection:
+            await connection.execute(text(_CREATE_TOKEN_TABLE))
+            await connection.execute(text("""
+                CREATE FUNCTION pg_temp.delay_token_write() RETURNS trigger
+                LANGUAGE plpgsql AS $$
+                BEGIN
+                    PERFORM pg_sleep((SELECT count(*) FROM inserted_tokens) * 0.002);
+                    RETURN NULL;
+                END $$
+            """))
+            await connection.execute(text("""
+                CREATE TRIGGER delay_token_write AFTER INSERT
+                ON document_map_unit_tokens
+                REFERENCING NEW TABLE AS inserted_tokens
+                FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.delay_token_write()
+            """))
+            await connection.commit()
+            transaction = await connection.begin()
+            # Publication has already written its document before token persistence.
+            await connection.execute(text("SELECT 1"))
+
+            def write_tokens(sync_connection: Connection) -> None:
+                with Session(bind=sync_connection) as session:
+                    insert_token_rows_with_copy(session, rows)
+
+            await connection.run_sync(write_tokens)
+            assert await connection.scalar(
+                text("SELECT count(*) FROM document_map_unit_tokens")
+            ) == len(rows)
+            await transaction.rollbac
```

**File**: `docs/design/publication-runtime-failure-diagnosis.md` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+# Publication runtime failure diagnosis
+
+Evidence collected on 2026-09-30. Production inspection was read-only. Local
+publication used a disposable PostgreSQL 15.17 database, Redis, LocalStack, and
+the real API and Worker entry points.
+
+## Production materialization timeout: confirmed cause
+
+The failed SpaceX demo request started at `2026-09-30T03:07:58.245481Z` and
+raised `TimeoutError` at `03:09:16.328Z`. The production API log stream was
+`api/api/88eebaaa69a4479e811bbd3fd0a62d95` in `/ecs/knowhere-api-prod`.
+
+Performance Insights for Aurora instance `knowhere-database-prod-instance-1`
+provides direct attribution:
+
+- The statement was `COPY document_map_unit_tokens (...) FROM STDIN (FORMAT binary)`.
+- It appeared in 30 consecutive one-second samples, from `03:08:47Z` through
+  `03:09:16Z`.
+- Filtering by that SQL identifier, all 30 samples were `IO:DataFileRead`.
+- No lock wait or CPU sample was attributed to this statement. Total sampled
+  database load in the surrounding interval never exceeded one active session.
+
+The immediate cause was waiting for database pages to be read from storage until
+COPY exhausted the API's 30-second command budget. This establishes storage read
+pressure, rather than an application deadlock or slow Python serialization, as
+the dominant observed wait. Sampling does not identify the exact relation or
+index supplying each read, and it does not prove that no shorter other waits
+occurred between samples.
+
+CloudWatch provides supporting context at one-minute resolution:
+
+| Metric | 03:07 UTC | 03:08 UTC | 03:09 UTC |
+| --- | ---: | ---: | ---: |
+| Serverless capacity, ACU | 0.5 | 0.742 | 2.0 |
+| Buffer cache hit ratio | 100% | 99.88% | 88.93% |
+| Read IOPS | 0 | 39.2 | 413.7 |
+| Read latency | 0 | 0.885 ms | 0.817 ms |
+| CPU utilization | 23.9% | 39.9% | 40.0% |
+
+These observations support a cold working set and storage reads during scale-up.
+They do not isolate scale-up as the sole cause. Current configuration reports
+0–4 ACU and a 300-second auto-pause interval; it must not be substituted for
+historical configuration. Historical ACU utilization reached 100% at 2 ACU.
+
+## Current production token storage
+
+A subsequent read-only catalog query estimated 13,276,691 token rows. The heap
+occupied 3,394,764,800 bytes and total relation storage was 15,540,740,096 bytes.
+All five indexes were valid and ready:
+
+| Index | Leading keys | Bytes |
+| --- | --- | ---: |
+| `document_map_unit_tokens_pkey` | `id` | 1,468,669,952 |
+| `idx_document_map_unit_tokens_lookup` | `channel, token_hash, map_unit_id` | 4,612,505,600 |
+| `idx_document_map_unit_tokens_token_lookup_binary` | `channel, decode(token_hash)` | 1,591,910,400 |
+| `idx_document_map_unit_tokens_unit` | `map_unit_id, channel` | 285,138,944 |
+| `idx_document_map_unit_tokens_unit_lookup` | `map_unit_id, channel, token_hash` | 4,184,621,056 |
+
+The binary and unit-lookup indexes include token/frequency payload. The total
+index footprint is approximately 12.14 decimal GB. Index maintenance is a
+plausible source of the observed reads; Performance Insights alone does not
+identify which index dominated. These sizes are not a measured bloat estimate.
+This catalog snapshot was taken after production recovery; it does not establish the index inventory or sizes
+at the time of the failed candidate request.
+
+## Real local API result
+
+An HTTP request to the actual `main.py` API materialized `demo-spacex-s1` with
+`candidate` enabled and the unchanged 30-second database timeouts. It completed
+with HTTP 200 in 46.289 seconds. The document was then archived and checked.
+
+The resulting input and index contained 227 chunks, 227 map units, and 10,778
+token rows. The demo input consists of one 1,467,990-character page chunk, 94 image
+chunks, and 132 table chunks. It differs from the older 922-chunk benchmark input.
+
+A separate read-only observer sampled the database every 250 ms:
+
+- T
```

**File**: `packages/shared-python/shared/services/retrieval/publication_chunk_copy.py` (modified, +25/-6)
```diff
@@ -8,11 +8,15 @@
 from datetime import datetime, timezone
 from typing import Any, Protocol, cast
 
+from psycopg2.extensions import cursor as PsycopgCursor
+from psycopg2.extensions import get_wait_callback
+from psycopg2.extras import execute_values
 from sqlalchemy.orm import Session
 
 from shared.models.database.document import DocumentChunk
 from shared.services.jobs.lifecycle.publication_trace_sql import record_publication_sql
 
+_COPY_BATCH_SIZE: int = 1_000
 _COLUMNS: tuple[str, ...] = (
     "id", "chunk_id", "user_id", "namespace", "document_id", "job_result_id",
     "section_id", "chunk_type", "content", "content_lexical_text", "path_lexical_text",
@@ -100,18 +104,27 @@ def _copy_psycopg(
     connection: _PsycopgConnection,
     records: list[tuple[_CopyValue, ...]],
 ) -> None:
-    buffer = _encode_csv_rows(records)
     cursor = connection.cursor()
     try:
-        cursor.copy_expert(_COPY_SQL, buffer)
+        if get_wait_callback() is not None:
+            # psycogreen uses a process-wide callback that COPY cannot support.
+            # Keep cooperative I/O and the caller's transaction intact.
+            execute_values(
+                cast(PsycopgCursor, cursor),
+                "INSERT INTO document_chunks (" + ", ".join(_COLUMNS) + ") VALUES %s",
+                records,
+                page_size=_COPY_BATCH_SIZE,
+            )
+        else:
+            buffer = _encode_csv_rows(records)
+            buffer.seek(0)
+            cursor.copy_expert(_COPY_SQL, buffer)
     finally:
         cursor.close()
 
 
-def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
-    """COPY prepared chunk objects inside the caller's transaction."""
-    if not chunks:
-        return
+def _insert_chunk_batch(db: Session, chunks: list[DocumentChunk]) -> None:
+    """Persist one bounded statement and record its actual SQL duration."""
     connection = db.connection()
     raw_connection = connection.connection
     driver = connection.dialect.driver
@@ -161,3 +174,9 @@ def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
             is_manual_write=True,
             write_row_count=len(chunks) if did_succeed else None,
         )
+
+
+def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
+    """Persist prepared chunks in bounded batches inside the caller's transaction."""
+    for start in range(0, len(chunks), _COPY_BATCH_SIZE):
+        _insert_chunk_batch(db, chunks[start : start + _COPY_BATCH_SIZE])
```

**File**: `packages/shared-python/shared/services/retrieval/publication_token_copy.py` (modified, +19/-6)
```diff
@@ -8,13 +8,16 @@
 from collections.abc import Iterator, Sequence
 from typing import Protocol, cast
 
+from psycopg2.extensions import cursor as PsycopgCursor
+from psycopg2.extensions import get_wait_callback
+from psycopg2.extras import execute_values
 from sqlalchemy.orm import Session
 
 from shared.services.jobs.lifecycle.publication_trace_sql import record_publication_sql
 
-# Keep the production-shaped publication in one COPY while retaining a bound
-# for larger documents so token persistence does not add avoidable round trips.
-_COPY_BATCH_SIZE = 100_000
+# Each COPY has the API's per-command timeout. Bound the work even for a
+# single token-heavy map unit; all batches remain in the caller's transaction.
+_COPY_BATCH_SIZE: int = 1_000
 _TOKEN_COLUMNS = (
     "id", "map_unit_id", "channel", "token", "token_hash", "frequency",
 )
@@ -64,11 +67,21 @@ def _copy_psycopg(
     connection: _PsycopgConnection,
     records: list[tuple[str | int, ...]],
 ) -> None:
-    buffer = _encode_binary_rows(records)
-    buffer.seek(0)
     cursor = connection.cursor()
     try:
-        cursor.copy_expert(_COPY_SQL, buffer)
+        if get_wait_callback() is not None:
+            # psycogreen uses a process-wide callback that COPY cannot support.
+            # Keep cooperative I/O and the caller's transaction intact.
+            execute_values(
+                cast(PsycopgCursor, cursor),
+                "INSERT INTO document_map_unit_tokens (" + ", ".join(_TOKEN_COLUMNS) + ") VALUES %s",
+                records,
+                page_size=_COPY_BATCH_SIZE,
+            )
+        else:
+            buffer = _encode_binary_rows(records)
+            buffer.seek(0)
+            cursor.copy_expert(_COPY_SQL, buffer)
     finally:
         cursor.close()
 
```

---

### Incident Patch 3: `e3c36c85` (2026-09-30)
**Commit Message**: fix: preserve publication compatibility with gevent and command timeouts

**File**: `apps/api/tests/contract/test_publication_chunk_copy_contract.py` (modified, +12/-0)
```diff
@@ -6,6 +6,8 @@
 from collections.abc import Iterator
 
 import pytest
+from psycogreen.gevent import patch_psycopg
+from psycopg2.extensions import get_wait_callback, set_wait_callback
 from sqlalchemy import create_engine, text
 from sqlalchemy.engine import make_url
 from sqlalchemy.ext.asyncio import create_async_engine
@@ -111,9 +113,17 @@ def _read_rows(connection) -> list[tuple[object, ...]]:
     )
 
 
+@pytest.mark.parametrize("has_cooperative_callback", [False, True])
 def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
     contract_database_url: str,
+    has_cooperative_callback: bool,
 ) -> None:
+    original_callback = get_wait_callback()
+    if has_cooperative_callback:
+        patch_psycopg()
+    else:
+        set_wait_callback(None)
+    expected_callback = get_wait_callback()
     url = make_url(contract_database_url).set(drivername="postgresql+psycopg2")
     engine = create_engine(url)
     try:
@@ -122,6 +132,7 @@ def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
             connection.commit()
             with Session(bind=connection) as session:
                 insert_chunks_with_copy(session, _build_chunks())
+                assert get_wait_callback() is expected_callback
                 rows = _read_rows(connection)
                 assert rows[0][1:5] == (
                     "",
@@ -135,6 +146,7 @@ def test_candidate_chunk_copy_preserves_null_empty_json_and_rollback(
             assert connection.scalar(text("SELECT count(*) FROM document_chunks")) == 0
     finally:
         engine.dispose()
+        set_wait_callback(original_callback)
 
 
 async def test_candidate_chunk_copy_supports_asyncpg_owner_and_rollback(
```

**File**: `apps/api/tests/contract/test_publication_token_copy_contract.py` (modified, +67/-1)
```diff
@@ -6,8 +6,10 @@
 from collections.abc import Iterator
 
 import pytest
+from psycogreen.gevent import patch_psycopg
+from psycopg2.extensions import get_wait_callback, set_wait_callback
 from sqlalchemy import create_engine, text
-from sqlalchemy.engine import make_url
+from sqlalchemy.engine import Connection, make_url
 from sqlalchemy.ext.asyncio import create_async_engine
 from sqlalchemy.orm import Session
 
@@ -59,9 +61,17 @@ def contract_database_url(
     yield get_contract_database_url()
 
 
+@pytest.mark.parametrize("has_cooperative_callback", [False, True])
 def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
     contract_database_url: str,
+    has_cooperative_callback: bool,
 ) -> None:
+    original_callback = get_wait_callback()
+    if has_cooperative_callback:
+        patch_psycopg()
+    else:
+        set_wait_callback(None)
+    expected_callback = get_wait_callback()
     url = make_url(contract_database_url).set(drivername="postgresql+psycopg2")
     engine = create_engine(url)
     try:
@@ -70,6 +80,7 @@ def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
             connection.commit()
             with Session(bind=connection) as session:
                 insert_token_rows_with_copy(session, _TOKEN_ROWS)
+                assert get_wait_callback() is expected_callback
                 values = connection.execute(
                     text("SELECT token, frequency FROM document_map_unit_tokens ORDER BY id")
                 ).all()
@@ -80,6 +91,7 @@ def test_candidate_copy_preserves_rows_and_rollback_with_psycopg2(
             ) == 0
     finally:
         engine.dispose()
+        set_wait_callback(original_callback)
 
 
 async def test_candidate_copy_preserves_rows_and_rollback_with_asyncpg(
@@ -114,3 +126,57 @@ def copy_and_read(sync_connection) -> list[tuple[str, int]]:
             ) == 0
     finally:
         await engine.dispose()
+
+
+async def test_candidate_token_writes_complete_under_per_command_budget(
+    contract_database_url: str,
+) -> None:
+    """Slow token writes must stay atomic without requiring one long command."""
+    url = make_url(contract_database_url).set(drivername="postgresql+asyncpg")
+    engine = create_async_engine(
+        url,
+        connect_args={
+            "command_timeout": 3,
+            "server_settings": {"statement_timeout": "3000"},
+        },
+    )
+    rows: list[dict[str, object]] = [
+        {**_TOKEN_ROWS[0], "id": f"dmut_slow_{index}"}
+        for index in range(2_501)
+    ]
+    try:
+        async with engine.connect() as connection:
+            await connection.execute(text(_CREATE_TOKEN_TABLE))
+            await connection.execute(text("""
+                CREATE FUNCTION pg_temp.delay_token_write() RETURNS trigger
+                LANGUAGE plpgsql AS $$
+                BEGIN
+                    PERFORM pg_sleep((SELECT count(*) FROM inserted_tokens) * 0.002);
+                    RETURN NULL;
+                END $$
+            """))
+            await connection.execute(text("""
+                CREATE TRIGGER delay_token_write AFTER INSERT
+                ON document_map_unit_tokens
+                REFERENCING NEW TABLE AS inserted_tokens
+                FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.delay_token_write()
+            """))
+            await connection.commit()
+            transaction = await connection.begin()
+            # Publication has already written its document before token persistence.
+            await connection.execute(text("SELECT 1"))
+
+            def write_tokens(sync_connection: Connection) -> None:
+                with Session(bind=sync_connection) as session:
+                    insert_token_rows_with_copy(session, rows)
+
+            await connection.run_sync(write_tokens)
+            assert await connection.scalar(
+                text("SELECT count(*) FROM document_map_unit_tokens")
+            ) == len(rows)
+            await transaction.rollbac
```

**File**: `docs/design/publication-runtime-failure-diagnosis.md` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+# Publication runtime failure diagnosis
+
+Evidence collected on 2026-09-30. Production inspection was read-only. Local
+publication used a disposable PostgreSQL 15.17 database, Redis, LocalStack, and
+the real API and Worker entry points.
+
+## Production materialization timeout: confirmed cause
+
+The failed SpaceX demo request started at `2026-09-30T03:07:58.245481Z` and
+raised `TimeoutError` at `03:09:16.328Z`. The production API log stream was
+`api/api/88eebaaa69a4479e811bbd3fd0a62d95` in `/ecs/knowhere-api-prod`.
+
+Performance Insights for Aurora instance `knowhere-database-prod-instance-1`
+provides direct attribution:
+
+- The statement was `COPY document_map_unit_tokens (...) FROM STDIN (FORMAT binary)`.
+- It appeared in 30 consecutive one-second samples, from `03:08:47Z` through
+  `03:09:16Z`.
+- Filtering by that SQL identifier, all 30 samples were `IO:DataFileRead`.
+- No lock wait or CPU sample was attributed to this statement. Total sampled
+  database load in the surrounding interval never exceeded one active session.
+
+The immediate cause was waiting for database pages to be read from storage until
+COPY exhausted the API's 30-second command budget. This establishes storage read
+pressure, rather than an application deadlock or slow Python serialization, as
+the dominant observed wait. Sampling does not identify the exact relation or
+index supplying each read, and it does not prove that no shorter other waits
+occurred between samples.
+
+CloudWatch provides supporting context at one-minute resolution:
+
+| Metric | 03:07 UTC | 03:08 UTC | 03:09 UTC |
+| --- | ---: | ---: | ---: |
+| Serverless capacity, ACU | 0.5 | 0.742 | 2.0 |
+| Buffer cache hit ratio | 100% | 99.88% | 88.93% |
+| Read IOPS | 0 | 39.2 | 413.7 |
+| Read latency | 0 | 0.885 ms | 0.817 ms |
+| CPU utilization | 23.9% | 39.9% | 40.0% |
+
+These observations support a cold working set and storage reads during scale-up.
+They do not isolate scale-up as the sole cause. Current configuration reports
+0–4 ACU and a 300-second auto-pause interval; it must not be substituted for
+historical configuration. Historical ACU utilization reached 100% at 2 ACU.
+
+## Current production token storage
+
+A subsequent read-only catalog query estimated 13,276,691 token rows. The heap
+occupied 3,394,764,800 bytes and total relation storage was 15,540,740,096 bytes.
+All five indexes were valid and ready:
+
+| Index | Leading keys | Bytes |
+| --- | --- | ---: |
+| `document_map_unit_tokens_pkey` | `id` | 1,468,669,952 |
+| `idx_document_map_unit_tokens_lookup` | `channel, token_hash, map_unit_id` | 4,612,505,600 |
+| `idx_document_map_unit_tokens_token_lookup_binary` | `channel, decode(token_hash)` | 1,591,910,400 |
+| `idx_document_map_unit_tokens_unit` | `map_unit_id, channel` | 285,138,944 |
+| `idx_document_map_unit_tokens_unit_lookup` | `map_unit_id, channel, token_hash` | 4,184,621,056 |
+
+The binary and unit-lookup indexes include token/frequency payload. The total
+index footprint is approximately 12.14 decimal GB. Index maintenance is a
+plausible source of the observed reads; Performance Insights alone does not
+identify which index dominated. These sizes are not a measured bloat estimate.
+This catalog snapshot was taken after production recovery; it does not establish the index inventory or sizes
+at the time of the failed candidate request.
+
+## Real local API result
+
+An HTTP request to the actual `main.py` API materialized `demo-spacex-s1` with
+`candidate` enabled and the unchanged 30-second database timeouts. It completed
+with HTTP 200 in 46.289 seconds. The document was then archived and checked.
+
+The resulting input and index contained 227 chunks, 227 map units, and 10,778
+token rows. The demo input consists of one 1,467,990-character page chunk, 94 image
+chunks, and 132 table chunks. It differs from the older 922-chunk benchmark input.
+
+A separate read-only observer sampled the database every 250 ms:
+
+- T
```

**File**: `packages/shared-python/shared/services/retrieval/publication_chunk_copy.py` (modified, +25/-6)
```diff
@@ -8,11 +8,15 @@
 from datetime import datetime, timezone
 from typing import Any, Protocol, cast
 
+from psycopg2.extensions import cursor as PsycopgCursor
+from psycopg2.extensions import get_wait_callback
+from psycopg2.extras import execute_values
 from sqlalchemy.orm import Session
 
 from shared.models.database.document import DocumentChunk
 from shared.services.jobs.lifecycle.publication_trace_sql import record_publication_sql
 
+_COPY_BATCH_SIZE: int = 1_000
 _COLUMNS: tuple[str, ...] = (
     "id", "chunk_id", "user_id", "namespace", "document_id", "job_result_id",
     "section_id", "chunk_type", "content", "content_lexical_text", "path_lexical_text",
@@ -100,18 +104,27 @@ def _copy_psycopg(
     connection: _PsycopgConnection,
     records: list[tuple[_CopyValue, ...]],
 ) -> None:
-    buffer = _encode_csv_rows(records)
     cursor = connection.cursor()
     try:
-        cursor.copy_expert(_COPY_SQL, buffer)
+        if get_wait_callback() is not None:
+            # psycogreen uses a process-wide callback that COPY cannot support.
+            # Keep cooperative I/O and the caller's transaction intact.
+            execute_values(
+                cast(PsycopgCursor, cursor),
+                "INSERT INTO document_chunks (" + ", ".join(_COLUMNS) + ") VALUES %s",
+                records,
+                page_size=_COPY_BATCH_SIZE,
+            )
+        else:
+            buffer = _encode_csv_rows(records)
+            buffer.seek(0)
+            cursor.copy_expert(_COPY_SQL, buffer)
     finally:
         cursor.close()
 
 
-def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
-    """COPY prepared chunk objects inside the caller's transaction."""
-    if not chunks:
-        return
+def _insert_chunk_batch(db: Session, chunks: list[DocumentChunk]) -> None:
+    """Persist one bounded statement and record its actual SQL duration."""
     connection = db.connection()
     raw_connection = connection.connection
     driver = connection.dialect.driver
@@ -161,3 +174,9 @@ def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
             is_manual_write=True,
             write_row_count=len(chunks) if did_succeed else None,
         )
+
+
+def insert_chunks_with_copy(db: Session, chunks: list[DocumentChunk]) -> None:
+    """Persist prepared chunks in bounded batches inside the caller's transaction."""
+    for start in range(0, len(chunks), _COPY_BATCH_SIZE):
+        _insert_chunk_batch(db, chunks[start : start + _COPY_BATCH_SIZE])
```

**File**: `packages/shared-python/shared/services/retrieval/publication_token_copy.py` (modified, +19/-6)
```diff
@@ -8,13 +8,16 @@
 from collections.abc import Iterator, Sequence
 from typing import Protocol, cast
 
+from psycopg2.extensions import cursor as PsycopgCursor
+from psycopg2.extensions import get_wait_callback
+from psycopg2.extras import execute_values
 from sqlalchemy.orm import Session
 
 from shared.services.jobs.lifecycle.publication_trace_sql import record_publication_sql
 
-# Keep the production-shaped publication in one COPY while retaining a bound
-# for larger documents so token persistence does not add avoidable round trips.
-_COPY_BATCH_SIZE = 100_000
+# Each COPY has the API's per-command timeout. Bound the work even for a
+# single token-heavy map unit; all batches remain in the caller's transaction.
+_COPY_BATCH_SIZE: int = 1_000
 _TOKEN_COLUMNS = (
     "id", "map_unit_id", "channel", "token", "token_hash", "frequency",
 )
@@ -64,11 +67,21 @@ def _copy_psycopg(
     connection: _PsycopgConnection,
     records: list[tuple[str | int, ...]],
 ) -> None:
-    buffer = _encode_binary_rows(records)
-    buffer.seek(0)
     cursor = connection.cursor()
     try:
-        cursor.copy_expert(_COPY_SQL, buffer)
+        if get_wait_callback() is not None:
+            # psycogreen uses a process-wide callback that COPY cannot support.
+            # Keep cooperative I/O and the caller's transaction intact.
+            execute_values(
+                cast(PsycopgCursor, cursor),
+                "INSERT INTO document_map_unit_tokens (" + ", ".join(_TOKEN_COLUMNS) + ") VALUES %s",
+                records,
+                page_size=_COPY_BATCH_SIZE,
+            )
+        else:
+            buffer = _encode_binary_rows(records)
+            buffer.seek(0)
+            cursor.copy_expert(_COPY_SQL, buffer)
     finally:
         cursor.close()
 
```

---

### Incident Patch 4: `f20709d4` (2026-09-29)
**Commit Message**: fix: expect MCP query projection to include empty-query fields

to_mcp_query_response now forwards router_used and failure_reason; the contract test must match that shape.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `apps/api/tests/contract/test_evidence_renderer_contract.py` (modified, +2/-0)
```diff
@@ -51,6 +51,8 @@ def test_mcp_query_response_keeps_evidence_and_debug_results() -> None:
 
     assert response == {
         "query": "q",
+        "router_used": None,
+        "failure_reason": None,
         "evidence": [{"type": "text", "text": "t"}],
         "evidence_text": "t",
         "results": [
```

---

### Incident Patch 5: `e13251a7` (2026-09-29)
**Commit Message**: fix: stop snapshotting dropped map-unit term-search text

Publication benchmark fingerprints still selected term_search_text_lower after the column was removed.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `scripts/publication_benchmark/state_snapshot.py` (modified, +1/-2)
```diff
@@ -386,7 +386,7 @@ def capture_semantic_fingerprints(
         db,
         "SELECT u.id, u.document_id, u.job_result_id, u.unit_id, u.section_id, "
         "u.unit_kind, u.path_token_count, u.content_token_count, "
-        "u.term_search_text_lower, u.has_image, u.has_table, u.sort_order "
+        "u.has_image, u.has_table, u.sort_order "
         "FROM document_map_units u JOIN documents d ON d.document_id = u.document_id "
         "WHERE d.user_id = :user_id AND d.namespace = :namespace",
         parameters,
@@ -411,7 +411,6 @@ def capture_semantic_fingerprints(
             "unit_id": _unit_id(row["unit_id"], section_paths),
             "path_token_count": row["path_token_count"],
             "content_token_count": row["content_token_count"],
-            "term_search_text_lower": row["term_search_text_lower"],
             "has_image": row["has_image"],
             "has_table": row["has_table"],
         }
```

---

### Incident Patch 6: `178ae9a3` (2026-09-29)
**Commit Message**: fix: attach term-search drop migration to current alembic head

The branch still parented 1a2b3c4d5e6f after main added later token-index revisions, which split heads.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `apps/api/alembic/versions/2b3c4d5e6f7a_drop_map_unit_term_search_text.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 
 
 revision: str = "2b3c4d5e6f7a"
-down_revision: str | None = "1a2b3c4d5e6f"
+down_revision: str | None = "2f3g4h5i6j7"
 branch_labels: Sequence[str] | None = None
 depends_on: Sequence[str] | None = None
 
```

---

### Incident Patch 7: `3428bbc9` (2026-09-29)
**Commit Message**: fix: keep grep SQL rows distinct from payload rows

Pyright treated the later payload `rows` annotation as the type of the SQL result, which blocked local CI.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/tools/grep.py` (modified, +3/-3)
```diff
@@ -239,8 +239,8 @@ async def grep(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
         .order_by(matched.c.document_id, matched.c.sort_order)
         .limit(limit)
     )
-    rows = (await ctx.db.execute(rows_stmt)).all()
-    total_matches = int(rows[0][-1]) if rows else 0
+    matched_rows = (await ctx.db.execute(rows_stmt)).all()
+    total_matches = int(matched_rows[0][-1]) if matched_rows else 0
 
     results: list[dict[str, Any]] = []
     for (
@@ -256,7 +256,7 @@ async def grep(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
         section_path,
         source_file_name,
         _total_matches,
-    ) in rows:
+    ) in matched_rows:
         text = str(term_search_text or "")
         match = compiled.search(text)
         snippet = build_snippet(
```

---

### Incident Patch 8: `d703c990` (2026-09-29)
**Commit Message**: fix: enhance argument handling and response structure in grep and recall tools

- Updated argument parsing in `grep` and `recall` functions to use default values more effectively, improving robustness against missing parameters.
- Modified test cases to ensure consistent handling of tool names in `tool_message_content`, enhancing clarity in error reporting and output formatting.
- Refactored response payloads to align with new structure, ensuring that details such as `total_matches` are correctly reported in the response.
- Added new tests to validate behavior for empty results and invalid parameters, improving overall test coverage and reliability.

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/tools/grep.py` (modified, +2/-2)
```diff
@@ -150,8 +150,8 @@ async def grep(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
     terms = _terms_from_args(args)
     if not terms:
         return ToolResult(text="", error="grep requires pattern or patterns")
-    context_chars = int(args.get("context_chars") or _DEFAULT_CONTEXT_CHARS)
-    requested_limit = int(args.get("limit") or _DEFAULT_LIMIT)
+    context_chars = int(args.get("context_chars", _DEFAULT_CONTEXT_CHARS))
+    requested_limit = int(args.get("limit", _DEFAULT_LIMIT))
     limit = capped_limit(requested_limit, ctx.budget)
     chunk_types = {
         str(t).strip().lower() for t in (args.get("chunk_types") or []) if str(t).strip()
```

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/tools/recall.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ async def recall(ctx: ToolContext, args: dict[str, Any]) -> ToolResult:
     query = str(args.get("query") or "").strip()
     if not query:
         return ToolResult(text="", error="recall requires query")
-    requested_limit = int(args.get("limit") or _DEFAULT_LIMIT)
+    requested_limit = int(args.get("limit", _DEFAULT_LIMIT))
     limit = capped_limit(requested_limit, ctx.budget)
     chunk_types = {
         str(t).strip().lower() for t in (args.get("chunk_types") or []) if str(t).strip()
```

**File**: `packages/shared-python/shared/tests/test_agent_explore_harness.py` (modified, +15/-5)
```diff
@@ -72,25 +72,34 @@ def test_build_wire_tool_name_map_round_trips_to_canonical() -> None:
 
 def test_tool_message_content_passes_through_short_text() -> None:
     result = ToolResult(text="short body")
-    assert tool_message_content(result, max_chars=100) == "short body"
+    assert (
+        tool_message_content(result, tool_name="corpus.grep", max_chars=100)
+        == "short body"
+    )
 
 
 def test_tool_message_content_caps_long_text_with_note() -> None:
     result = ToolResult(text="x" * 200)
-    content = tool_message_content(result, max_chars=100)
+    content = tool_message_content(result, tool_name="corpus.grep", max_chars=100)
     assert content.startswith("x" * 100)
     assert "truncated, 100 more chars" in content
     assert len(content) > 100  # capped body + truncation note, not silently dropped
 
 
 def test_tool_message_content_surfaces_error_instead_of_text() -> None:
     result = ToolResult(text="ignored", error="bad args: missing document_id")
-    assert tool_message_content(result, max_chars=100) == "error: bad args: missing document_id"
+    assert (
+        tool_message_content(result, tool_name="corpus.grep", max_chars=100)
+        == "error: bad args: missing document_id"
+    )
 
 
 def test_tool_message_content_empty_text_placeholder() -> None:
     result = ToolResult(text="")
-    assert tool_message_content(result, max_chars=100) == "(empty result)"
+    assert (
+        tool_message_content(result, tool_name="corpus.grep", max_chars=100)
+        == "(empty result)"
+    )
 
 
 def test_model_accepts_images_only_when_name_contains_vision() -> None:
@@ -329,7 +338,8 @@ def test_agent_explore_keeps_inventory_tool_for_explicit_inventory_requests() ->
     wire_names = {tool["function"]["name"] for tool in tools}
     assert "corpus_list_documents" in wire_names
     assert name_map["corpus_list_documents"] == "corpus.list_documents"
-    assert "only if the user explicitly asks to list or inventory" in LOOP_CONTRACT_SUFFIX
+    assert "only if the user explicitly" in LOOP_CONTRACT_SUFFIX
+    assert "asks to list or inventory the corpus's documents" in LOOP_CONTRACT_SUFFIX
 
 
 # --------------------------------------------------------------------------
```

**File**: `packages/shared-python/shared/tests/test_agent_tools_contract.py` (modified, +89/-2)
```diff
@@ -16,7 +16,7 @@
 
 from shared.services.retrieval.agent_explore.config import FINISH_TOOL_SCHEMA
 from shared.services.retrieval.agent_tools import REGISTRY, ToolContext, load_corpus_schema_text
-from shared.services.retrieval.agent_tools.snippet import format_row
+from shared.services.retrieval.agent_tools.snippet import build_row, format_row
 
 
 @asynccontextmanager
@@ -159,13 +159,100 @@ def test_old_parameter_names_are_absent_from_docs_and_descriptions() -> None:
             assert stale not in spec.json_schema.get("properties", {})
 
 
+_ROW_KEYS = {
+    "kind",
+    "title",
+    "document_id",
+    "section_path",
+    "chunk_id",
+    "summary",
+    "snippet",
+    "score",
+    "is_hit",
+    "depth",
+    "hosted",
+}
+
+
 def test_format_row_is_the_shared_search_line() -> None:
-    line = format_row(
+    row = build_row(
         kind="text",
         document_id="doc_a",
         section_path="guide.pdf / Intro",
         title="guide.pdf",
         snippet="hello",
     )
+    assert set(row) == _ROW_KEYS
+    line = format_row(row)
     assert line.startswith("- [text] guide.pdf | document_id=doc_a section_path=")
     assert "snippet:" in line
+
+
+@pytest.mark.asyncio
+async def test_chunk_types_enum_rejects_old_names() -> None:
+    result = await REGISTRY.dispatch(
+        "corpus.grep",
+        _ctx(),
+        {"pattern": "x", "chunk_types": ["body"]},
+    )
+    assert result.error is not None
+    assert "chunk_types" in result.error
+    assert "unknown argument" not in result.error
+
+
+@pytest.mark.asyncio
+async def test_limit_below_minimum_is_rejected() -> None:
+    result = await REGISTRY.dispatch(
+        "corpus.grep",
+        _ctx(),
+        {"pattern": "x", "limit": 0},
+    )
+    assert result.error is not None
+    assert "limit" in result.error
+
+
+@pytest.mark.asyncio
+async def test_recall_blank_query_is_rejected() -> None:
+    result = await REGISTRY.dispatch("corpus.recall", _ctx(), {"query": "   "})
+    assert result.error == "recall requires query"
+
+
+@pytest.mark.asyncio
+async def test_read_ref_requires_exactly_one_address() -> None:
+    both = await REGISTRY.dispatch(
+        "corpus.read",
+        _ctx(),
+        {
+            "refs": [
+                {
+                    "document_id": "doc_a",
+                    "section_path": "guide.pdf / Intro",
+                    "chunk_id": "chunk_a",
+                }
+            ]
+        },
+    )
+    assert both.error is not None
+    assert "section_path" in both.error
+    assert "chunk_id" in both.error
+
+    neither = await REGISTRY.dispatch(
+        "corpus.read",
+        _ctx(),
+        {"refs": [{"document_id": "doc_a"}]},
+    )
+    assert neither.error is not None
+    assert "section_path" in neither.error or "chunk_id" in neither.error
+
+
+def test_chunk_types_and_bounds_are_in_schema() -> None:
+    grep = REGISTRY.get("corpus.grep")
+    recall = REGISTRY.get("corpus.recall")
+    outline = REGISTRY.get("corpus.outline")
+    assert grep is not None and recall is not None and outline is not None
+    for spec in (grep, recall):
+        items = spec.json_schema["properties"]["chunk_types"]["items"]
+        assert items["enum"] == ["text", "page", "image", "table"]
+        assert spec.json_schema["properties"]["limit"]["minimum"] == 1
+    assert grep.json_schema["properties"]["context_chars"]["minimum"] == 1
+    assert outline.json_schema["properties"]["depth"]["minimum"] == 0
```

**File**: `packages/shared-python/shared/tests/test_agent_tools_discovery_read_contract.py` (modified, +15/-10)
```diff
@@ -72,12 +72,20 @@ def all(self) -> list[tuple[object, ...]]:
         ]
 
 
+class _EmptyHostRows:
+    def all(self) -> list[tuple[object, ...]]:
+        return []
+
+
 class _RecordingDb:
-    def __init__(self, result: object) -> None:
-        self.result = result
+    def __init__(self, results: object) -> None:
+        self.results = list(results) if isinstance(results, list) else [results]
+        self._index = 0
 
     async def execute(self, statement):  # noqa: ANN001
-        return self.result
+        result = self.results[min(self._index, len(self.results) - 1)]
+        self._index += 1
+        return result
 
 
 @asynccontextmanager
@@ -199,7 +207,7 @@ def _read_kwargs(refs: list[dict[str, str]]) -> dict:
 
 
 def _section_paths_from_outline_text(text: str) -> list[str]:
-    return re.findall(r"section_path=(.+?)(?: \[Hit\])?$", text, re.MULTILINE)
+    return re.findall(r"section_path=(.+)$", text, re.MULTILINE)
 
 
 def _asset_refs_from_text(text: str) -> list[dict[str, str]]:
@@ -232,11 +240,8 @@ async def test_assets_visible_chunk_id_reads(discovery_ctx: ToolContext) -> None
         discovery_ctx, {"scope": [{"document_id": DOC_ID}], "type": "table"}
     )
     assert listed.error is None
-    # file_path is not part of the shared row shape (format_row) any of the
-    # five search/map tools render — only chunk_id is a valid read()
-    # identifier (see test_file_path_is_not_a_readable_chunk_id below), so
-    # the payload (not the text) is where file_path still lives.
-    assert listed.payload["assets"][0]["file_path"] == TABLE_FILE
+    assert listed.payload["rows"][0]["chunk_id"] == CHUNK_TABLE
+    assert listed.payload["rows"][0]["kind"] == "table"
     refs = _asset_refs_from_text(listed.text)
     assert refs == [{"document_id": DOC_ID, "chunk_id": CHUNK_TABLE}]
     result = await read(discovery_ctx, _read_kwargs(refs))
@@ -248,7 +253,7 @@ async def test_assets_visible_chunk_id_reads(discovery_ctx: ToolContext) -> None
 @pytest.mark.asyncio
 async def test_grep_table_visible_chunk_id_reads(discovery_ctx: ToolContext) -> None:
     grep_ctx = ToolContext(
-        db=_RecordingDb(_GrepRows()),  # type: ignore[arg-type]
+        db=_RecordingDb([_GrepRows(), _EmptyHostRows()]),  # type: ignore[arg-type]
         user_id=USER_ID,
         namespace=NAMESPACE,
         db_factory=_unused_db_factory,
```

---

### Incident Patch 9: `855e53a3` (2026-09-29)
**Commit Message**: fix: improve query handling and response structure in retrieval tools

- Added validation for empty queries in `execute_retrieval_query` and `create_retrieval_mcp_server`, returning structured responses with appropriate failure reasons.
- Enhanced the response format to include `router_used` and `failure_reason` for better error tracking.
- Updated the `render_map` function to handle oversized maps more gracefully, ensuring summaries are omitted first and providing clearer error messages when the map exceeds character limits.
- Refactored various tools to ensure consistent handling of asset paths and chunk types, improving overall retrieval accuracy and response consistency.

**File**: `apps/api/app/api/v1/routes/retrieval.py` (modified, +15/-1)
```diff
@@ -209,11 +209,25 @@ async def execute_retrieval_query(
     else:
         resolved_chunk_types = None
 
+    query = str(payload.query or "").strip()
+    if not query:
+        return {
+            "namespace": normalize_retrieval_namespace(payload.namespace),
+            "query": query,
+            "router_used": "empty_query_filtered",
+            "failure_reason": "empty query — retrieval was not run",
+            "evidence": [],
+            "evidence_text": "",
+            "answer_text": "",
+            "referenced_chunks": [],
+            "results": [],
+        }
+
     return await run_retrieval_query(
         db=db,
         user_id=current_user.user_id,
         namespace=normalize_retrieval_namespace(payload.namespace),
-        query=payload.query,
+        query=query,
         top_k=payload.top_k,
         include_document_ids=payload.include_document_ids,
         exclude_document_ids=payload.exclude_document_ids,
```

**File**: `apps/api/app/mcp/retrieval_server.py` (modified, +11/-0)
```diff
@@ -65,6 +65,8 @@ def to_mcp_query_response(response: dict[str, Any]) -> dict[str, Any]:
     """
     return {
         "query": response.get("query"),
+        "router_used": response.get("router_used"),
+        "failure_reason": response.get("failure_reason"),
         "evidence": response.get("evidence") or [],
         "evidence_text": response.get("evidence_text") or "",
         "results": response.get("results") or [],
@@ -155,8 +157,17 @@ async def query_documents(
         # automatically before calling run_retrieval_query.
         # See: shared/services/retrieval/intent/ (to be created)
         namespace = resolve_mcp_namespace(ctx=ctx)
+        query = str(query or "").strip()
         async with db_factory() as db:
             user_id = await resolve_mcp_user_id(ctx=ctx, db=db)
+            if not query:
+                return to_mcp_query_response(
+                    {
+                        "query": query,
+                        "router_used": "empty_query_filtered",
+                        "failure_reason": "empty query — retrieval was not run",
+                    }
+                )
             response = await run_retrieval_query(
                 db=db,
                 user_id=user_id,
```

**File**: `packages/shared-python/shared/services/retrieval/agent_explore/config.py` (modified, +18/-12)
```diff
@@ -97,18 +97,24 @@
 
 ## Exploration loop contract
 
-You are exploring this corpus autonomously to answer one query. Use the
-tools above to navigate; you may call several tools in one turn when they
-are independent. If a call's arguments depend on another call's result, do
-not issue them in the same turn. In particular: do not call `corpus.grep`
-in the same turn as `corpus.recall`, `corpus.read`,
-`corpus.list_documents`, `corpus.outline`, `corpus.node_filter`, or
-`corpus.assets` unless `pattern` / `patterns` is already known — those
-calls produce the term; a grep with no term is an empty call. Wait for
-the result, then grep. `corpus.list_documents` enumerates the entire
-namespace: use it only if the user explicitly asks to list or inventory
-the corpus's documents, never as the starting step for a content question.
-When you have enough evidence, call `{FINISH_TOOL_NAME}`
+You are exploring this corpus autonomously to answer one query. Tool
+names in this prompt are the registered names (`corpus.read`). This
+function-calling loop exposes the same tools with `.` replaced by `_`
+(`corpus_read`); use that underscore form when calling. Logs keep the
+dotted name.
+
+Use the tools above to navigate; you may call several tools in one turn
+when they are independent. If a call's arguments depend on another
+call's result, do not issue them in the same turn. In particular: do
+not call `corpus.grep` in the same turn as `corpus.recall`,
+`corpus.read`, `corpus.list_documents`, `corpus.outline`,
+`corpus.node_filter`, or `corpus.assets` unless `pattern` / `patterns`
+is already known — those calls produce the term; a grep with no term is
+an empty call. Wait for the result, then grep. `corpus.list_documents`
+enumerates the entire namespace: use it only if the user explicitly
+asks to list or inventory the corpus's documents, never as the starting
+step for a content question. When you have enough evidence, call
+`{FINISH_TOOL_NAME}`
 with the `refs` you want cited as the answer — do not write the final answer
 as plain text yourself, it is synthesized downstream from your cited refs.
 If you exhaust your tool budget without a confident answer, call
```

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/CORPUS_SCHEMA.md` (modified, +78/-69)
```diff
@@ -85,12 +85,13 @@ text, a literal marker:
   **Format trap**: `<owner_section_path>` inside the marker is written
   verbatim by the parser and stored as-is — it is the on-disk path
   (`"<source_file_name>/<Heading>/<Heading>/..."`, plain `/`, filename
-  included), **not** the DB `section_path` you get back from `outline` /
-  `node_filter` / `recall` (which is `" / "`-joined and excludes the
-  filename). Do not string-match the marker directly against a DB
-  `section_path`. Convert it first — `section_path_from_chunk_path()` in
-  `search/lexical_text.py` already does this conversion and is the function
-  to reuse when implementing marker resolution, not a new one.
+  included), **not** the DB `section_path` you get back from
+  `corpus.outline` / `corpus.node_filter` / `corpus.recall` (which is
+  `" / "`-joined and excludes the filename). Do not string-match the
+  marker directly against a DB `section_path`. Convert it first —
+  `section_path_from_chunk_path()` in `search/lexical_text.py` already
+  does this conversion and is the function to reuse when implementing
+  marker resolution, not a new one.
 
 ## 3. Asset chunks: `image` / `table`, and `connect_to`
 
@@ -105,9 +106,12 @@ list on the **body chunk**, not a location on the asset:
   the owning section).
 
 This link is **one-directional** (body → asset). There is no stored
-asset → body back-link; to find which section(s) an asset belongs to, use
-the reverse lookup on the `assets` tool rather than assuming the asset chunk
-itself names its host.
+asset → body back-link. `corpus.grep`, `corpus.recall`, and `corpus.assets`
+resolve the host through that body link and print the hosting
+`section_path` on the asset row. If no host is found, the row keeps
+`Root` and is marked as having no host section. Use `corpus.assets`
+`host_of` to list every host, rather than reading the asset's stored
+path.
 
 ## 4. Document graph
 
@@ -131,77 +135,82 @@ for anything finer-grained than a document pair.
 ## 6. Tools and how they work together
 
 Every tool exists to find the `section_path`s (or asset `chunk_id`s) that
-answer the query, then hand them to `read`. Exact call parameters live only
-in each tool's own schema/description (ask for that, do not memorize names
-here) — this section is the collaboration map: which tools narrow a search
-space, which produce hits, and what to do with either kind of result.
+answer the query, then hand them to `corpus.read`. Names below are the
+registered names (`corpus.outline`). MCP clients call those names as-is.
+Exact call parameters live only in each tool's own schema/description
+(ask for that, do not memorize names here) — this section is the
+collaboration map: which tools narrow a search space, which produce hits,
+and what to do with either kind of result.
 
 ```mermaid
 flowchart LR
     subgraph MapNarrowing["Narrow a map (overview / structural predicate)"]
-        outline
-        node_filter
+        outline["corpus.outline"]
+        node_filter["corpus.node_filter"]
     end
     subgraph LeafHits["Find hits (exact string / fuzzy / asset listing)"]
-        grep
-        recall
-        assets
+        grep["corpus.grep"]
+        recall["corpus.recall"]
+        assets["corpus.assets"]
     end
     outline -->|narrows scope for| LeafHits
     node_filter -->|narrows scope for| LeafHits
-    MapNarrowing -->|section_path| finish
-    MapNarrowing -->|section_path| read
+    MapNarrowing -->|section_path| read["corpus.read"]
     LeafHits -->|section_path or chunk_id| read
-    read -->|table too large| query_table
+    read -->|table too large| query_table["corpus.query_table"]
     read --> finish
     query_table --> finish
-    list_documents["list_documents (namespace inventory, standalone)"]
-    neighbors["neighbors (related documents, standalone)"]
+    list_documents["corpus.list_documents (namespace inventory, standalone)"]
+    neighbors["corpus.neighbors (related documents, standalone)"]
 ```
 
-**`ou
```

**File**: `packages/shared-python/shared/services/retrieval/agent_tools/asset_hosts.py` (modified, +28/-0)
```diff
@@ -21,6 +21,7 @@
 from shared.services.retrieval.agent_tools.registry import ToolContext
 from shared.services.retrieval.agent_tools.scope import ScopeTarget
 from shared.services.retrieval.hydration.row_utils import iter_connected_target_ids
+from shared.services.retrieval.settings import ASSET_CHUNK_TYPES
 
 _BODY_CHUNK_TYPES = ("text", "page")
 
@@ -133,3 +134,30 @@ def hosted_section_path(
     if candidates:
         return candidates[0].section_path, True
     return str(stored_path or "Root"), False
+
+
+async def host_paths_for_hits(
+    ctx: ToolContext,
+    hits: list[dict[str, Any]],
+    scope: list[ScopeTarget],
+) -> dict[AssetKey, tuple[str, bool]]:
+    """``(section_path, hosted)`` for every image/table hit, same rule as assets."""
+    asset_hits = [
+        hit
+        for hit in hits
+        if str(hit.get("chunk_type") or "").strip() in ASSET_CHUNK_TYPES
+    ]
+    if not asset_hits:
+        return {}
+    hosts = await load_asset_hosts(
+        ctx,
+        document_ids={str(hit.get("document_id") or "") for hit in asset_hits},
+        asset_ids={str(hit.get("chunk_id") or "") for hit in asset_hits},
+    )
+    resolved: dict[AssetKey, tuple[str, bool]] = {}
+    for hit in asset_hits:
+        key = (str(hit.get("document_id") or ""), str(hit.get("chunk_id") or ""))
+        resolved[key] = hosted_section_path(
+            hosts, key, scope, stored_path=hit.get("section_path")
+        )
+    return resolved
```

---

### Incident Patch 10: `9815bcd8` (2026-09-29)
**Commit Message**: fix: enhance argument handling and validation in agent tools

- Updated `_AllowExtraArgModel` to ensure only supplied keys and unrecognized ones are forwarded, preventing contract breaks in MCP calls.
- Refactored `tool_message_content` to accept tool names and handle character limits more effectively, ensuring consistent rendering across tools.
- Improved error messaging in `validate_finish_args` to provide clearer feedback on invalid arguments.
- Added `ref_status` to `AgentStep` for tracking the status of references in `corpus.read` calls.
- Enhanced various tools to utilize the new validation and error handling mechanisms, ensuring robust argument processing.

**File**: `apps/api/app/mcp/dynamic_tools.py` (modified, +28/-13)
```diff
@@ -29,26 +29,41 @@
 
 
 class _AllowExtraArgModel(ArgModelBase):
-    """``ArgModelBase`` that also forwards unrecognized keys.
+    """``ArgModelBase`` that forwards only actually-supplied keys, plus any
+    unrecognized ones.
 
     ``FuncMetadata.call_fn_with_arg_validation`` builds ``_dispatch_tool``'s
-    kwargs by calling ``model_dump_one_level()``, which only iterates this
-    class's *declared* ``model_fields`` — verified by reading
-    ``mcp.server.fastmcp.utilities.func_metadata`` directly. Declaring
-    ``extra="allow"`` alone is not enough: pydantic stores unrecognized keys
-    on the instance (``model_extra``) but the base implementation never
-    reads them. Overriding ``model_dump_one_level`` to merge them in is what
-    actually gets an unknown key from an MCP client into ``_dispatch_tool``'s
-    ``kwargs`` -> ``REGISTRY.dispatch`` -> ``validate_tool_args``'s unified
-    unknown-argument error, instead of the previous fully-permissive model
-    (every field ``(Any, None)``, no ``extra`` declared) silently dropping
-    it before dispatch ever saw it.
+    kwargs by calling ``model_dump_one_level()``. The base implementation
+    (verified by reading ``mcp.server.fastmcp.utilities.func_metadata``
+    directly) iterates every *declared* ``model_fields`` name unconditionally
+    — since every property is declared here as ``(Any, None)`` (see
+    ``_lenient_arg_model`` below), an MCP client that simply omits an
+    optional argument still gets that argument dumped as an explicit
+    ``None`` into ``REGISTRY.dispatch``'s args dict. ``validate_tool_args``
+    then fails a perfectly legal call, e.g. ``corpus.grep(pattern="x")``
+    reaching dispatch as ``{"pattern": "x", "chunk_types": None, ...}``,
+    which trips ``chunk_types``'s ``"type": "array"`` schema check. This was
+    a real, reproduced MCP-entry contract break, not a hypothetical one.
+
+    Fix: dump only ``self.model_fields_set`` (pydantic's own record of which
+    declared fields were actually present in the validated input — verified
+    live that omitted fields are absent from this set even when every field
+    has a ``None`` default) plus ``model_extra`` for genuinely unknown keys.
+    Declaring ``extra="allow"`` alone is not enough for the *unknown-key*
+    half: pydantic stores those on the instance (``model_extra``) but the
+    base implementation never reads them; merging them in here is what gets
+    an unknown key from an MCP client into ``dispatch`` -> ``validate_tool_args``'s
+    unified unknown-argument error, instead of the previous fully-permissive
+    model silently dropping it before dispatch ever saw it. Together this
+    makes an MCP call's dumped kwargs exactly the set of keys the client
+    actually sent — omitted optional keys absent, unknown keys present (and
+    then rejected by schema validation), never a fabricated ``None``.
     """
 
     model_config = ConfigDict(arbitrary_types_allowed=True, extra="allow")
 
     def model_dump_one_level(self) -> dict[str, Any]:
-        dumped = super().model_dump_one_level()
+        dumped = {name: getattr(self, name) for name in self.model_fields_set}
         dumped.update(self.model_extra or {})
         return dumped
 
```

**File**: `packages/shared-python/shared/services/retrieval/agent_explore/bridge.py` (modified, +4/-1)
```diff
@@ -25,12 +25,15 @@ def build_decision_trace(steps: list[AgentStep]) -> list[DecisionTraceStep]:
         phase = "finish" if step.tool_name == "finish" else (
             "stop" if not step.tool_name else "tool_call"
         )
+        observation: dict[str, object] = {"observation_text": observation_text}
+        if step.ref_status is not None:
+            observation["ref_status"] = step.ref_status
         trace_steps.append(
             DecisionTraceStep(
                 step_index=step.step_index,
                 agent="agent_explore",
                 phase=phase,
-                observation={"observation_text": observation_text},
+                observation=observation,
                 decision={
                     "action": step.tool_name or "no_tool_call",
                     "args": step.tool_args,
```

**File**: `packages/shared-python/shared/services/retrieval/agent_explore/config.py` (modified, +16/-3)
```diff
@@ -8,6 +8,8 @@
 
 from __future__ import annotations
 
+from shared.services.retrieval.agent_tools.registry import REF_ADDRESS_ONE_OF, REF_ADDRESS_RULE
+
 AGENT_EXPLORE_MODEL = "deepseek-v4-flash"
 
 # Model for AGENT_EXPLORE_HARNESS=cursor_sdk (harness/cursor_harness.py) —
@@ -46,12 +48,23 @@
             "items": {
                 "type": "object",
                 "properties": {
-                    "document_id": {"type": "string"},
-                    "section_path": {"type": "string"},
-                    "chunk_id": {"type": "string"},
+                    "document_id": {
+                        "type": "string",
+                        "description": "Document that owns the cited section or chunk.",
+                    },
+                    "section_path": {
+                        "type": "string",
+                        "description": "Cited section. Omit when chunk_id is set.",
+                    },
+                    "chunk_id": {
+                        "type": "string",
+                        "description": "Cited chunk. Omit when section_path is set.",
+                    },
                 },
                 "required": ["document_id"],
+                "oneOf": REF_ADDRESS_ONE_OF,
                 "additionalProperties": False,
+                "description": REF_ADDRESS_RULE,
             },
         },
         "notes": {
```

**File**: `packages/shared-python/shared/services/retrieval/agent_explore/harness/cursor_harness.py` (modified, +8/-3)
```diff
@@ -84,9 +84,10 @@
 from shared.services.retrieval.agent_explore.shared import (
     EVIDENCE_TOOL_NAMES,
     budget_status_line,
-    char_budget_for_tool,
     cursor_execute_content,
     finish_refs_from_args,
+    invalid_finish_message,
+    read_ref_status,
     select_episode_refs,
     tool_message_content,
     validate_finish_args,
@@ -212,7 +213,8 @@ def _dispatch_sync(
             elapsed_ms = int((time.perf_counter() - tool_started) * 1000)
             content = tool_message_content(
                 tool_result,
-                max_chars=char_budget_for_tool(tool_name, tool_budget.max_chars),
+                tool_name=tool_name,
+                max_chars=tool_budget.max_chars,
             )
             # Appended per call, unlike openai_harness.py's once-per-turn
             # placement — this harness has no batched-turn concept exposed to
@@ -232,6 +234,7 @@ def _dispatch_sync(
                     elapsed_ms=elapsed_ms,
                     tokens_used_delta=0,
                     tokens_used_total=budget.tokens_used,
+                    ref_status=read_ref_status(tool_name, tool_result),
                 )
             )
             if tool_name in EVIDENCE_TOOL_NAMES and not tool_result.error:
@@ -273,7 +276,9 @@ def finish_execute(args: dict[str, Any], _ctx: Any) -> str:
                             tokens_used_total=budget.tokens_used,
                         )
                     )
-                return json.dumps({"status": "error", "error": validation_error})
+                return json.dumps(
+                    {"status": "error", "error": invalid_finish_message(validation_error)}
+                )
             selected = finish_refs_from_args(args)
             cited = selected if selected is not None else []
             notes = str(args.get("notes") or "")
```

**File**: `packages/shared-python/shared/services/retrieval/agent_explore/harness/openai_harness.py` (modified, +19/-10)
```diff
@@ -67,10 +67,11 @@
     EVIDENCE_TOOL_NAMES,
     budget_status_line,
     build_wire_tool_name_map,
-    char_budget_for_tool,
     finish_refs_from_args,
     https_image_parts,
+    invalid_finish_message,
     model_accepts_images,
+    read_ref_status,
     select_episode_refs,
     tool_message_content,
     validate_finish_args,
@@ -139,14 +140,12 @@ def _build_openai_tools() -> tuple[list[dict[str, Any]], dict[str, str]]:
 def _parse_tool_arguments(raw: str | None) -> tuple[dict[str, Any], str | None]:
     """Parse one tool call's JSON arguments, or return the parse error.
 
-    Malformed JSON used to become ``{}`` silently — every caller below now
-    surfaces the parse failure instead: a corpus.* tool call fails that one
-    call via the existing per-call ``ToolResult.error`` path (unchanged
-    otherwise — the episode is not aborted), and a malformed ``finish`` call
-    ends the episode with the parse error recorded instead of silently
-    finishing with no refs.
+    Only a missing argument string or an explicit ``{}`` is an empty object;
+    an empty string or malformed JSON is an error. Either way the error
+    fails just that one call (a corpus.* tool or ``finish``) and is sent
+    back to the model — the episode continues.
     """
-    if not raw:
+    if raw is None:
         return {}, None
     try:
         parsed = json.loads(raw)
@@ -270,10 +269,14 @@ async def run_episode(
             finish_call = next(
                 (tc for tc in tool_calls if tc.function.name == FINISH_TOOL_NAME), None
             )
+            finish_error: str | None = None
             if finish_call is not None:
                 args, parse_error = _parse_tool_arguments(finish_call.function.arguments)
                 if parse_error is None:
                     parse_error = validate_finish_args(args)
+                if parse_error is not None and forced_reason is None:
+                    finish_error = parse_error
+            if finish_call is not None and finish_error is None:
                 finish_refs = finish_refs_from_args(args) if parse_error is None else None
                 cited = finish_refs if finish_refs is not None else []
                 result_notes = (
@@ -339,7 +342,11 @@ async def run_episode(
                 args, parse_error = _parse_tool_arguments(tc.function.arguments)
                 requested_name = str(tc.function.name or "")
                 canonical_name = tool_name_map.get(requested_name, requested_name)
-                if parse_error is not None:
+                if tc is finish_call:
+                    tool_result = ToolResult(
+                        text="", error=invalid_finish_message(str(finish_error))
+                    )
+                elif parse_error is not None:
                     tool_result = ToolResult(text="", error=parse_error)
                 else:
                     tool_result = await dispatch_tool_call(
@@ -355,7 +362,8 @@ async def run_episode(
                 tool_elapsed_ms = int((time.perf_counter() - tool_started) * 1000)
                 content = tool_message_content(
                     tool_result,
-                    max_chars=char_budget_for_tool(canonical_name, tool_budget.max_chars),
+                    tool_name=canonical_name,
+                    max_chars=tool_budget.max_chars,
                 )
                 messages.append(
                     {"role": "tool", "tool_call_id": tc.id, "content": content}
@@ -395,6 +403,7 @@ async def run_episode(
                         ),
                         tokens_used_delta=0 if first_tool_tokens_recorded else turn_tokens,
                         tokens_used_total=budget.tokens_used,
+                        ref_status=read_ref_status(canonical_name, tool_result),
                     )
                 )
                 first_tool_tokens_recorded = True
```

#### Recent Merged Pull Requests:
- **PR #450** (2026-09-30): Staging (@suguanYang)
- **PR #449** (2026-09-30): perf: reuse demo publication artifacts (@suguanYang)
- **PR #448** (2026-09-30): fix: handle gevent publication writes and bound COPY batches (@suguanYang)
- **PR #447** (2026-09-29): feat(retrieval): align agent tool contract and feedback (@EricNGOntos)
- **PR #446** (2026-09-29): chore(deploy): configure baseline publication strategy (@suguanYang)
- **PR #445** (2026-09-28): Staging (@suguanYang)
- **PR #443** (2026-09-28): perf(publication): reduce materialization persistence latency (@suguanYang)
- **PR #442** (2026-09-28): refactor: unify VLM on deepseek-flash and tighten page-text handling (@EricNGOntos)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
