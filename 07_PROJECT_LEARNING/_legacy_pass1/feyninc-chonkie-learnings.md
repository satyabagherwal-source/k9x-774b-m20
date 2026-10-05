# Forensic Learning Record (Deep Inspection): feyninc/chonkie

> **Canonical Artifact**: `07_PROJECT_LEARNING/feyninc-chonkie-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/feyninc/chonkie](https://github.com/feyninc/chonkie))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:57:53.413Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `feyninc/chonkie`
- **Description**: 🦛 CHONK docs with Chonkie ✨ — The lightweight ingestion library for fast, efficient and robust RAG pipelines
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4779 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/chonkie/__init__.py`
```
"""Main package for Chonkie."""

from .chef import BaseChef, LiteParse, MarkdownChef, MistralOCR, TableChef, TextChef
from .chunker import (
    BaseChunker,
    CodeChunker,
    FastChunker,
    LateChunker,
    NeuralChunker,
    RecursiveChunker,
    SemanticChunker,
    SentenceChunker,
    SlumberChunker,
    TableChunker,
    TeraflopAIChunker,
    TokenChunker,
)
from .cloud import chunker, refineries
from .embeddings import (
    AutoEmbeddings,
    AzureOpenAIEmbeddings,
    BaseEmbeddings,
    CohereEmbeddings,
    GeminiEmbeddings,
    JinaEmbeddings,
    LiteLLMEmbeddings,
    Model2VecEmbeddings,
    OpenAIEmbeddings,
    SentenceTransformerEmbeddings,
    VoyageAIEmbeddings,
)
from .fetcher import BaseFetcher, FileFetcher
from .genie import AzureOpenAIGenie, BaseGenie, CerebrasGenie, GeminiGenie, GroqGenie, OpenAIGenie
from .handshakes import (
    BaseHandshake,
    ChromaHandshake,
    ElasticHandshake,
    LanceDBHandshake,
    MilvusHandshake,
    MongoDBHandshake,
    PgvectorHandshake,
    PineconeHandshake,
    QdrantHandshake,
    TurbopufferHandshake,
    WeaviateHandshake,
)
from .pipeline import Pipeline
from .porters import BasePorter, DatasetsPorter, JSONPorter
from .refinery import BaseRefinery, EmbeddingsRefinery, OverlapRefinery
from .tokenizer import (
    AutoTokenizer,
    ByteTokenizer,
    CharacterTokenizer,
    RowTokenizer,
    Tokenizer,
    TokenizerProtocol,
    WordTokenizer,
)
from .types import (
    Chunk,
    Document,
    LanguageConfig,
    MarkdownCode,
    MarkdownDocument,
    MarkdownImage,
    MarkdownTable,
    MergeRule,
    RecursiveLevel,
    RecursiveRules,
    Sentence,
    SplitRule,
)
from .utils import Hubbie, Visualizer
from .utils.table_converter import html_table_to_json, markdown_table_to_json

__all__ = (
    # chef
    "BaseChef",
    "LiteParse",
    "MarkdownChef",
    "MistralOCR",
    "TableChef",
    "TextChef",
    # chunker
    "BaseChunker",
    "CodeChunker",
    "FastChunker",
    "LateChunker",
    "NeuralChunker",
    "RecursiveChunker",
    "SemanticChunker",
    "SentenceChunker",
    "SlumberChunker",
    "TableChunker",
    "TeraflopAIChunker",
    "TokenChunker",
    # cloud
    "chunker",
    "refineries",
    # embeddings
    "AutoEmbeddings",
    "AzureOpenAIEmbeddings",
    "BaseEmbeddings",
    "CohereEmbeddings",
    "GeminiEmbeddings",
    "JinaEmbeddings",
    "LiteLLMEmbeddings",
    "Model2VecEmbeddings",
    "OpenAIEmbeddings",
    "SentenceTransformerEmbeddings",
    "VoyageAIEmbeddings",
    # fetcher
    "BaseFetcher",
    "FileFetcher",
    # genie
    "AzureOpenAIGenie",
    "BaseGenie",
    "CerebrasGenie",
    "GeminiGenie",
    "GroqGenie",
    "OpenAIGenie",
    # handshakes
    "BaseHandshake",
    "ChromaHandshake",
    "ElasticHandshake",
    "LanceDBHandshake",
    "MilvusHandshake",
    "MongoDBHandshake",
    "PgvectorHandshake",
    "PineconeHandshake",
    "QdrantHandshake",
    "TurbopufferHandshake",
    "WeaviateHandshake",
    # pipeline
    "Pipeline",
    # porters
    "BasePorter",
    "DatasetsPorter",
    "JSONPorter",
    # refinery
    "BaseRefinery",
    "EmbeddingsRefinery",
    "OverlapRefinery",
    # tokenizer
    "AutoTokenizer",
    "ByteTokenizer",
    "CharacterTokenizer",
    "RowTokenizer",
    "Tokenizer",
    "TokenizerProtocol",
    "WordTokenizer",
    # types
    "Chunk",
    "Document",
    "LanguageConfig",
    "MarkdownCode",
    "MarkdownDocument",
    "MarkdownImage",
    "MarkdownTable",
    "MergeRule",
    "RecursiveLevel",
    "RecursiveRules",
    "Sentence",
    "SplitRule",
    # utils
    "Hubbie",
    "Visualizer",
    "html_table_to_json",
    "markdown_table_to_json",
)

# This hippo grows with every release 🦛✨~
__version__ = "1.7.0"
__name__ = "chonkie"
__author__ = "🦛 Chonkie Inc"

```

### Core Architecture Module: `src/chonkie/api/__init__.py`
```
"""Chonkie OSS API - A lightweight FastAPI server for the Chonkie chunking library."""

```

### Core Architecture Module: `src/chonkie/api/database.py`
```
"""Database configuration and session management."""

import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/chonkie.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session, for use as a FastAPI dependency."""
    async with async_session_maker() as session:
        yield session


async def init_db() -> None:
    """Create all SQLAlchemy-mapped tables if they do not already exist."""
    # Ensure the directory for the SQLite database file exists.
    db_url = DATABASE_URL
    if db_url.startswith("sqlite"):
        # Extract the file path from the URL (strip the dialect prefix and slashes)
        path = db_url.split("///", 1)[-1]
        if path and path not in (":memory:", ""):
            db_dir = os.path.dirname(path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

```

### Core Architecture Module: `src/chonkie/api/main.py`
```
"""Chonkie OSS API – FastAPI application entry point.

Run locally::

    chonkie serve

Or with uvicorn directly::

    uvicorn chonkie.api.main:app --reload --port 8000

Or via Docker::

    docker compose up
"""

import os
from contextlib import asynccontextmanager
from importlib.metadata import PackageNotFoundError, version
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware

from chonkie.api.database import init_db
from chonkie.api.routes.chunking import router as chunking_router
from chonkie.api.routes.pipelines import router as pipelines_router
from chonkie.api.routes.refineries import router as refineries_router
from chonkie.logger import configure

# Tests set CHONKIE_LOG=unconfigured so logging stays on the root logger (pytest caplog).
# Do not attach a non-propagating chonkie handler in that mode.
# Match chonkie.logger._configure_default() semantics exactly.
if os.getenv("CHONKIE_LOG") != "unconfigured":
    configure(level=os.getenv("LOG_LEVEL", "INFO"))

try:
    _chonkie_version = version("chonkie")
except PackageNotFoundError:
    _chonkie_version = "unknown"

# CORS is permissive by default for local development.
# Override with the CORS_ORIGINS env var (comma-separated list of origins).
_raw_origins = os.getenv("CORS_ORIGINS", "*")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Chonkie OSS API",
    description=(
        "A lightweight, self-hostable REST API that exposes the "
        "[Chonkie](https://github.com/chonkie-inc/chonkie) chunking library "
        "over HTTP.\n\n"
        "No authentication or billing required – just run it and chunk away.\n\n"
        "**Source:** https://github.com/chonkie-inc/chonkie"
    ),
    version=_chonkie_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=_origins,
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    ],
)


app.include_router(chunking_router, prefix="/v1")
app.include_router(refineries_router, prefix="/v1")
app.include_router(pipelines_router, prefix="/v1")


@app.get("/health", tags=["Meta"], summary="Health check")
async def health() -> dict:
    """Return a simple alive signal.

    Useful for container health-checks and load-balancer probes.
    """
    return {"status": "ok"}


@app.get("/", tags=["Meta"], summary="API information")
async def root() -> dict:
    """Return basic information about this API instance."""
    return {
        "name": "Chonkie OSS API",
        "version": _chonkie_version,
        "docs": "/docs",
        "health": "/health",
        "chunkers": [
            "/v1/chunk/token",
            "/v1/chunk/sentence",
            "/v1/chunk/recursive",
            "/v1/chunk/semantic",
            "/v1/chunk/code",
        ],
        "refineries": [
            "/v1/refine/embeddings",
            "/v1/refine/overlap",
        ],
        "pipelines": "/v1/pipelines",
    }

```

### Core Architecture Module: `src/chonkie/api/migrations/__init__.py`
```
"""Alembic database migrations for the Chonkie API."""

```

### Core Architecture Module: `src/chonkie/api/migrations/env.py`
```
"""Alembic environment configuration."""

import asyncio
import os
from logging.config import fileConfig
from typing import Any

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import the Base and all models so Alembic can detect them.
from chonkie.api.database import Base  # noqa: E402
from chonkie.api.models import Pipeline  # noqa: E402, F401

target_metadata = Base.metadata

# Override sqlalchemy.url from environment if DATABASE_URL is set
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/chonkie.db")


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Any) -> None:
    """Run migrations with a live connection."""
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations asynchronously."""
    connectable = create_async_engine(DATABASE_URL)

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

```

### Core Architecture Module: `src/chonkie/api/migrations/versions/001_initial.py`
```
"""Initial migration: create pipelines table.

Revision ID: 001
Revises:
Create Date: 2026-02-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the pipelines table."""
    op.create_table(
        "pipelines",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_pipelines_name"), "pipelines", ["name"], unique=True)


def downgrade() -> None:
    """Drop the pipelines table."""
    op.drop_index(op.f("ix_pipelines_name"), table_name="pipelines")
    op.drop_table("pipelines")

```

### Core Architecture Module: `src/chonkie/api/migrations/versions/__init__.py`
```
"""Alembic migration versions."""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #583** (2026-05-21): **Bug: `CodeChunker` fails with `tree-sitter-language-pack` >= 1.8.0: cannot import `SupportedLanguage`**
  *Symptoms*: **Describe the bug** `CodeChunker` fails to construct when installed alongside `tree-sitter-language-pack >= 1.8.0` because `SupportedLanguage` was removed from the package their v1 rewrite here: https://github.com/kreuzberg-dev/tree-sitter-language-pack/commit/5a822c0.  **To Reproduce**  ``` pip install "chonkie[code]" "tree-sitter-language-pack>=1.8.0" python -c "from chonkie import CodeChunker; CodeChunker(language='python')" ```  Results in: `ImportError: cannot import name 'SupportedLanguage' from 'tree_sitter_language_pack'`  **Root cause**  In `src/chonkie/chunker/code.py`:   - [Line 80](https://github.com/chonkie-inc/chonkie/blob/main/src/chonkie/chunker/code.py#L80): `from tree_sitter_language_pack import SupportedLanguage, get_parser`   - Same import here: https://github.com/chonkie-inc/chonkie/blob/main/src/chonkie/chunker/code.py#L374  **Environment**   - chonkie: v1.6.5 (latest released): `main` has the same import   - tree-sitter-language-pack: 1.8.0   - Python: 3.12
  **Post-Mortem & Fix Analysis**:
  > I am a maintainer from [Agno](https://www.agno.com/). Just flagging the impact on our side because this is breaking our CI on main with the latest versions. Failing run in our sdk: https://github.com/agno-agi/agno/actions/runs/25633948991/job/75242444274.   As a temporary fix I have shipped a PR: https://github.com/agno-agi/agno/pull/7869 with pinned tree-sitter-language-pack dependency to unblock the feature, but would love to drop it once chonkie ships a fix. Thanks!
  > Hi @sannya-singal  Thanks a lot for bringing this to my attention. I have fixed this in #587 and deployed a patch release in [1.6.6](https://github.com/chonkie-inc/chonkie/releases/tag/v1.6.6) .
  > Awesome @chonk-lain 🙌  Thanks for the quick turnaround. Thanks a lot for creating the [PR](https://github.com/agno-agi/agno/pull/7904) to lift the temporary pin in agno 🎉 Will merge the PR today!

- **Issue #529** (2026-03-23): **Bug:gemini embedding-004 not supported**
  *Symptoms*: embedding-004: API error: { "error": { "code": 404, "message": "models/text-embedding-004 is not found for API version v1beta, or is not supported for embedContent. Call ListModels to see the list of available models and their supported methods.", "status": "NOT_FOUND" } }
  **Post-Mortem & Fix Analysis**:
  > Pretty sure that model is deprecated
  > Hey @xiaoslinxl-dev!   That model has been deprecated since Jan, 2026. I'd suggest using the `gemini-embedding-2` model they recently released!  Closing this issue; please re-open if you face further issues!  Thanks 

- **Issue #517** (2026-03-17): **Bug: `chonkie.cloud` is always imported on `import chonkie`, forcing `httpx` as an undeclared dependency**
  *Symptoms*: **Describe the bug**  `chonkie/__init__.py` unconditionally imports the `cloud` subpackage:  ```python from .cloud import chunker, refineries ```  **To Reproduce and Environment**  ```python import chonkie ``` .. when installed into a fresh env with no other deps. yet installed.   Every module under `cloud/` (chunker, refineries, pipeline, file) has a bare `import httpx` at the top level, so `httpx` is required just to `import chonkie` — even for users who only use local chunking and never touch the cloud API.  `httpx` is listed only under the `[all]` extra and is not a declared core dependency, so a clean install (`pip install chonkie`) can fail at import time on environments that don't already have `httpx`.  ## Proposed fix  I expect you wouldn't want to add `httpx` to the core dependencies - as this is unnecessary for users not using the cloud API (but this would fix).   **Would it be helpful if I submitted a PR so that `[cloud]` was an optional extra?**  Add a `[cloud]` extra with `httpx`, and lazy-load the cloud subpackage in `__init__.py` (e.g. via `__getattr__`), raising a helpful `ImportError` if `httpx` is absent:  ```python   def __getattr__(name):       if name in ("chunker", "refineries"):           try:               from . import cloud as _cloud               return getattr(_cloud, name)           except ImportError:               raise ImportError(                   f"chonkie.{name} requires the cloud extra: "                   f"pip install 'chonkie[cloud]'"  

- **Issue #480** (2026-02-04): **Bug: Version 1.5.4 breaks if openai is not installed**
  *Symptoms*: **Describe the bug**  openai is not identified as a dependency when installing chonkie[st], but is required.   **To Reproduce** Please provide a code snippet that reproduces the bug. ``` > uv init > uv add chonkie[st] > uv sync (installs 1.5.4)  ------------- pyproject.toml  [project] name = "chonkie-error" version = "0.1.0" description = "Add your description here" readme = "README.md" requires-python = ">=3.11" dependencies = [     "chonkie[st]>=1.5.4", ] ```  ------------- ``` from chonkie import LateChunker, SentenceTransformerEmbeddings        def main():           chunker = LateChunker(SentenceTransformerEmbeddings(model="sentence-transformers/nli-mpnet-base-v2"))           chunker.chunk("This is a test sentence for chunking.")           for chunk in chunker:               print(chunk)              if __name__ == "__main__":           main() ``` -------------  ```   File "~/chonkie-test/main.py", line 1, in <module>     from chonkie import LateChunker, SentenceTransformerEmbeddings   File "~/chonkie-test/.venv/lib/python3.11/site-packages/chonkie/__init__.py", line 4, in <module>     from .chunker import (   File "~/chonkie-test/.venv/lib/python3.11/site-packages/chonkie/chunker/__init__.py", line 6, in <module>     from .late import LateChunker   File "~/chonkie-test/.venv/lib/python3.11/site-packages/chonkie/chunker/late.py", line 9, in <module>     from chonkie.embeddings.sentence_transformer import SentenceTransformerEmbeddings   File "~/chonkie-test/.venv/lib/pytho
  **Post-Mortem & Fix Analysis**:
  > This commit: https://github.com/chonkie-inc/chonkie/commit/87c78912476cb0e479aafe74d350e83a974d6fa0  Appears to have added:  `from openai import APIError, RateLimitError, Timeout`  so the registry attempts to load the openai library when scanning for embeddings
  > nice catch, thanks for reporting this

- **Issue #460** (2026-02-16): **Pipeline.run() crashes with empty text list**
  *Symptoms*: **Describe the bug** When calling Pipeline.run() with an empty list of texts, it crashes with IndexError instead of gracefully handling the edge case.  **To Reproduce** from chonkie import Pipeline pipe = Pipeline().chunk_with('recursive') result = pipe.run(texts=[])  **Expected behavior** Should return empty Document or raise informative ValueError about empty input.  **Environment** - Python 3.9+ - chonkie v1.5.2

- **Issue #459** (2026-04-21): **SemanticChunker throws exception when embedding_model is None**
  *Symptoms*: **Describe the bug** SemanticChunker initialization fails with TypeError when embedding_model parameter is not provided or is explicitly set to None.  **To Reproduce** from chonkie import SemanticChunker chunker = SemanticChunker() chunks = chunker("Test text")  **Expected behavior** Should use default embedding model or raise a more informative error message.  **Environment** - Python 3.10+ - chonkie v1.5.2
  **Post-Mortem & Fix Analysis**:
  > this worked on my end, could you try running `pip show chonkie` in your terminal and check which version you're using  <img width="748" height="191" alt="Image" src="https://github.com/user-attachments/assets/b335b9af-05cd-45bf-b289-99a6237982ce" />  else if you have some weird security issues related to proxy try running the following snippet, and if it fails then it's def related to security issues ```py from model2vec import StaticModel  model = StaticModel.from_pretrained("minishlab/potion-base-32M") ```
  > Hey @swamy18! 👋  We're unable to reproduce this in recent versions — `SemanticChunker()` with no arguments defaults to `"minishlab/potion-base-32M"` and works fine.  If you're explicitly passing `embedding_model=None`, that's expected behaviour — the `SemanticChunker` requires an embedding model to function, so passing `None` will raise an error.  Could you try upgrading to the latest version and see if the issue persists?  Thanks 😊

- **Issue #458** (2026-02-28): **RecursiveChunker fails with None overlap_mode parameter**
  *Symptoms*: **Describe the bug** When passing overlap_mode=None to RecursiveChunker, it raises an AttributeError instead of using the default mode.  **To Reproduce** from chonkie import RecursiveChunker chunker = RecursiveChunker(overlap_mode=None) chunks = chunker("Sample text for chunking")  **Environment** - Python 3.10 - chonkie v1.5.2
  **Post-Mortem & Fix Analysis**:
  > Hi swamy, l think this issue had fixed in the newest version(1.5.6), you can try the newest in your environment; Also, Happy Lunar New Year!  <img width="1394" height="595" alt="Image" src="https://github.com/user-attachments/assets/36b07ada-1eb7-4300-9a41-49dd7c1be274" />
  > we don't have an attribute `overlap_mode` in `RecursiveChunker`  <img width="853" height="652" alt="Image" src="https://github.com/user-attachments/assets/5dd5f50b-7fb4-45ce-9cb1-5ce714575621" />

- **Issue #438** (2026-01-12): **Bug: Sentence Chunker doesn't work on chonkie 1.5.2**
  *Symptoms*: **Describe the bug** It appears the sentence chunker doesn't properly split into sentences  **To Reproduce**  Colab: https://colab.research.google.com/drive/1mQU4Fx9bH6W1b-CJ8FVYgWa_QM5prMts#scrollTo=lRjJUbAxe06O   **Environment** chonkie version 1.5.2 running in Google Colab
  **Post-Mortem & Fix Analysis**:
  > I'm closing this was a misunderstanding of the chunk size param.

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

### Incident Patch 1: `664454b6` (2026-08-26)
**Commit Message**: Merge pull request #655 from eeshsaxena/fix/token-chunker-float-overlap

Validate the resolved chunk_overlap for float values in TokenChunker

**File**: `src/chonkie/chunker/token.py` (modified, +7/-4)
```diff
@@ -48,14 +48,17 @@ def __init__(
         super().__init__(tokenizer)
         if chunk_size <= 0:
             raise ValueError("chunk_size must be positive")
-        if isinstance(chunk_overlap, int) and chunk_overlap >= chunk_size:
+        if chunk_overlap < 0:
+            raise ValueError("chunk_overlap must be non-negative")
+        chunk_overlap = (
+            chunk_overlap if isinstance(chunk_overlap, int) else int(chunk_overlap * chunk_size)
+        )
+        if chunk_overlap >= chunk_size:
             raise ValueError("chunk_overlap must be less than chunk_size")
 
         # Assign the values if they make sense
         self.chunk_size = chunk_size
-        self.chunk_overlap = (
-            chunk_overlap if isinstance(chunk_overlap, int) else int(chunk_overlap * chunk_size)
-        )
+        self.chunk_overlap = chunk_overlap
 
         self._use_multiprocessing = False
 
```

**File**: `tests/chunkers/test_token_chunker.py` (modified, +33/-0)
```diff
@@ -309,3 +309,36 @@ def test_token_chunker_return_type(tiktokenizer: Encoding, sample_text: str) ->
     chunks = chunker.chunk(sample_text)
     assert all([type(chunk) is Chunk for chunk in chunks])
     assert all([len(tiktokenizer.encode(chunk.text)) <= 512 for chunk in chunks])
+
+
+def test_token_chunker_float_overlap_out_of_range() -> None:
+    """A float chunk_overlap that resolves to >= chunk_size must be rejected.
+
+    A float is treated as a fraction of chunk_size, so chunk_overlap=1.0 with
+    chunk_size=100 resolves to an overlap of 100. That used to construct fine
+    and then either crash chunk() with "range() arg 3 must not be zero" (step
+    of zero) or silently drop the text (negative step). It should raise the
+    same ValueError the int path already raises.
+    """
+    with pytest.raises(ValueError):
+        TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=1.0)
+    with pytest.raises(ValueError):
+        TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=1.5)
+
+
+def test_token_chunker_negative_overlap() -> None:
+    """A negative chunk_overlap must be rejected instead of skipping tokens."""
+    with pytest.raises(ValueError):
+        TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=-0.5)
+    # A small negative fraction resolves to int() == 0, so it must be rejected
+    # on the input sign rather than the resolved token count.
+    with pytest.raises(ValueError):
+        TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=-0.001)
+
+
+def test_token_chunker_float_overlap_valid() -> None:
+    """A valid fractional overlap still resolves to a token count and chunks."""
+    chunker = TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=0.2)
+    assert chunker.chunk_overlap == 20
+    chunks = chunker.chunk("hello world " * 50)
+    assert len(chunks) > 0
```

---

### Incident Patch 2: `0aae0e10` (2026-08-26)
**Commit Message**: Merge branch 'main' into fix/token-chunker-float-overlap

**File**: `.github/workflows/docs.yml` (removed, +0/-59)
```diff
@@ -1,59 +0,0 @@
-name: Deploy Docs
-
-on:
-  push:
-    branches: [main]
-    paths:
-      - 'docs/**'
-      - '.github/workflows/docs.yml'
-  workflow_dispatch:
-
-permissions:
-  contents: read
-  pages: write
-  id-token: write
-
-concurrency:
-  group: pages
-  cancel-in-progress: true
-
-jobs:
-  build:
-    runs-on: ubuntu-latest
-    defaults:
-      run:
-        working-directory: docs
-    steps:
-      - uses: actions/checkout@v4
-
-      - uses: pnpm/action-setup@v4
-        with:
-          version: 10
-
-      - uses: actions/setup-node@v4
-        with:
-          node-version: 22
-          cache: pnpm
-          cache-dependency-path: docs/pnpm-lock.yaml
-
-      - run: pnpm install --frozen-lockfile
-
-      - run: pnpm build
-        env:
-          BASE_PATH: /chonkie
-          NEXT_PUBLIC_DOCS_SITE_URL: https://docs.chonkie.ai
-          NEXT_PUBLIC_CHONKIEJS_DOCS_URL: https://js.docs.chonkie.ai
-
-      - uses: actions/upload-pages-artifact@v3
-        with:
-          path: docs/out
-
-  deploy:
-    needs: build
-    runs-on: ubuntu-latest
-    environment:
-      name: github-pages
-      url: ${{ steps.deployment.outputs.page_url }}
-    steps:
-      - id: deployment
-        uses: actions/deploy-pages@v4
```

**File**: `.github/workflows/freeze-prs.yml` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+name: Freeze PRs
+
+on:
+  pull_request_target:
+    types: [opened]
+
+permissions:
+  pull-requests: write
+
+jobs:
+  close:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Close pull request
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: |
+          gh pr close "${{ github.event.pull_request.number }}" \
+            --repo "${{ github.repository }}" \
+            --comment "$(cat <<'EOF'
+          We're freezing PRs on main while we build Chonkie v2.
+
+          v1.7 is the last 1.x release. Fixes and new work go into 2.0.
+
+          Please hold PRs until v2 is stable, we'll turn this off when we're ready. Thanks for bearing with us.
+          EOF
+          )"
```

**File**: `CONTRIBUTING.md` (modified, +3/-1)
```diff
@@ -1,5 +1,7 @@
 # 🦛 Contributing to Chonkie
 
+> **PRs are frozen.** We're building Chonkie v2. v1.7 is the last 1.x release; fixes go into 2.0. New pull requests on `main` will be closed automatically until v2 is stable. Please bear with us.
+
 > "I like them big, I like them CONTRIBUTING" ~ Moto Moto, probably
 
 Welcome fellow CHONKer! We're thrilled you want to contribute to Chonkie. Every contribution—whether fixing bugs, adding features, or improving documentation—makes Chonkie better for everyone.
@@ -9,7 +11,7 @@ Welcome fellow CHONKer! We're thrilled you want to contribute to Chonkie. Every
 ### Before You Dive In
 
 1. **Check existing issues** or open a new one to start a discussion
-2. **Read [Chonkie's documentation](https://docs.chonkie.ai)** and core [concepts](https://docs.chonkie.ai/getting-started/concepts)
+2. **Read [Chonkie's documentation](https://docs.chonkie.ai)** and core [concepts](https://docs.chonkie.ai/common/concepts)
 3. **Set up your development environment** using the guide below
 
 ### Development Setup
```

**File**: `docs/.env.example` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-NEXT_PUBLIC_DOCS_SITE_URL=https://docs.chonkie.ai
-NEXT_PUBLIC_CHONKIEJS_DOCS_URL=https://js.docs.chonkie.ai
-# Set when building for GitHub Pages project sites (e.g. feyninc.github.io/chonkie)
-BASE_PATH=
```

**File**: `docs/.gitignore` (removed, +0/-149)
```diff
@@ -1,149 +0,0 @@
-# Logs
-logs
-*.log
-npm-debug.log*
-yarn-debug.log*
-yarn-error.log*
-lerna-debug.log*
-
-# Diagnostic reports (https://nodejs.org/api/report.html)
-report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json
-
-# Runtime data
-pids
-*.pid
-*.seed
-*.pid.lock
-
-# Directory for instrumented libs generated by jscoverage/JSCover
-lib-cov
-
-# Coverage directory used by tools like istanbul
-coverage
-*.lcov
-
-# nyc test coverage
-.nyc_output
-
-# Grunt intermediate storage (https://gruntjs.com/creating-plugins#storing-task-files)
-.grunt
-
-# Bower dependency directory (https://bower.io/)
-bower_components
-
-# node-waf configuration
-.lock-wscript
-
-# Compiled binary addons (https://nodejs.org/api/addons.html)
-build/Release
-
-# Dependency directories
-node_modules/
-jspm_packages/
-
-# Snowpack dependency directory (https://snowpack.dev/)
-web_modules/
-
-# TypeScript cache
-*.tsbuildinfo
-
-# Optional npm cache directory
-.npm
-
-# Optional eslint cache
-.eslintcache
-
-# Optional stylelint cache
-.stylelintcache
-
-# Optional REPL history
-.node_repl_history
-
-# Output of 'npm pack'
-*.tgz
-
-# Yarn Integrity file
-.yarn-integrity
-
-# dotenv environment variable files
-.env
-.env.*
-!.env.example
-
-# parcel-bundler cache (https://parceljs.org/)
-.cache
-.parcel-cache
-
-# Next.js build output
-.next
-out
-next-env.d.ts
-
-# Nuxt.js build / generate output
-.nuxt
-dist
-.output
-
-# Gatsby files
-.cache/
-# Comment in the public line in if your project uses Gatsby and not Next.js
-# https://nextjs.org/blog/next-9-1#public-directory-support
-# public
-
-# vuepress build output
-.vuepress/dist
-
-# vuepress v2.x temp directory
-.temp
-
-# Sveltekit cache directory
-.svelte-kit/
-
-# vitepress build output
-**/.vitepress/dist
-
-# vitepress cache directory
-**/.vitepress/cache
-
-# Docusaurus cache and generated files
-.docusaurus
-
-# Serverless directories
-.serverless/
-
-# FuseBox cache
-.fusebox/
-
-# DynamoDB Local files
-.dynamodb/
-
-# Firebase cache directory
-.firebase/
-
-# TernJS port file
-.tern-port
-
-# Stores VSCode versions used for testing VSCode extensions
-.vscode-test
-
-# pnpm
-.pnpm-store
-
-# yarn v3
-.pnp.*
-.yarn/*
-!.yarn/patches
-!.yarn/plugins
-!.yarn/releases
-!.yarn/sdks
-!.yarn/versions
-
-# Vite files
-vite.config.js.timestamp-*
-vite.config.ts.timestamp-*
-.vite/
-
-# Fumadocs generated source
-.source
-.playwright-mcp
-.env*
```

---

### Incident Patch 3: `e7a7acf8` (2026-08-13)
**Commit Message**: fix(token): reject negative fractional chunk_overlap before conversion

**File**: `src/chonkie/chunker/token.py` (modified, +10/-7)
```diff
@@ -48,17 +48,20 @@ def __init__(
         super().__init__(tokenizer)
         if chunk_size <= 0:
             raise ValueError("chunk_size must be positive")
+        # Reject a negative overlap up front, before the float-to-token
+        # conversion. A small negative fraction such as -0.001 would otherwise
+        # truncate to 0 via int() and slip past the check below.
+        if chunk_overlap < 0:
+            raise ValueError("chunk_overlap must be non-negative")
         # A float chunk_overlap is treated as a fraction of chunk_size, so
-        # resolve it to a token count before validating. Validating only the
-        # int case let a float such as 1.0 slip through, which makes the
-        # overlap equal to chunk_size and later crashes the chunk() step
-        # calculation with a range() step of zero, or silently drops text when
-        # the step goes negative.
+        # resolve it to a token count before validating the upper bound.
+        # Validating only the int case let a float such as 1.0 slip through,
+        # which makes the overlap equal to chunk_size and later crashes the
+        # chunk() step calculation with a range() step of zero, or silently
+        # drops text when the step goes negative.
         resolved_overlap = (
             chunk_overlap if isinstance(chunk_overlap, int) else int(chunk_overlap * chunk_size)
         )
-        if resolved_overlap < 0:
-            raise ValueError("chunk_overlap must be non-negative")
         if resolved_overlap >= chunk_size:
             raise ValueError("chunk_overlap must be less than chunk_size")
 
```

---

### Incident Patch 4: `586e2b62` (2026-07-01)
**Commit Message**: fix url

**File**: `docs/content/docs/chonkie/utils/visualizer.mdx` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ description: "Visualize your chunks and embeddings"
 
 The `Visualizer` helps you visualize your chunks properly and compare different chunkers and settings with ease, either on the terminal or via HTML.
 
-![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/assets/viz/viz-terminal.png)
+![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/public/assets/viz/viz-terminal.png)
 
 ## Installation
 
@@ -47,4 +47,4 @@ The `save` method will save the chunks to a HTML file. Like `print`, it accepts
 viz.save("chonkie.html", chunks)
 ```
 
-![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/assets/viz/viz-html.png)
+![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/public/assets/viz/viz-html.png)
```

---

### Incident Patch 5: `b8bd4921` (2026-07-01)
**Commit Message**: fix

**File**: `docs/content/docs/chonkie/utils/visualizer.mdx` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ description: "Visualize your chunks and embeddings"
 
 The `Visualizer` helps you visualize your chunks properly and compare different chunkers and settings with ease, either on the terminal or via HTML.
 
-![Visualizer Example](https://raw.githubusercontent.com/chonkie-inc/chonkie/main/docs/assets/viz/viz-terminal.png)
+![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/assets/viz/viz-terminal.png)
 
 ## Installation
 
@@ -47,4 +47,4 @@ The `save` method will save the chunks to a HTML file. Like `print`, it accepts
 viz.save("chonkie.html", chunks)
 ```
 
-![Visualizer Example](https://raw.githubusercontent.com/chonkie-inc/chonkie/main/docs/assets/viz/viz-html.png)
+![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/assets/viz/viz-html.png)
```

---

### Incident Patch 6: `864fe5c8` (2026-07-01)
**Commit Message**: fix

**File**: `docs/app/api/cron/route.ts` (modified, +2/-1)
```diff
@@ -2,7 +2,8 @@ import { NextResponse } from "next/server";
 
 export async function GET(request: Request) {
   const authHeader = request.headers.get("authorization");
-  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
+  const cronSecret = process.env.CRON_SECRET;
+  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
 
```

**File**: `docs/components/github-releases.tsx` (modified, +26/-2)
```diff
@@ -30,7 +30,31 @@ export function GithubReleases({ src = "/data/releases.json" }: { src?: string }
       .catch(() => {
         setLoading(false);
       });
-  }, []);
+  }, [src]);
+
+  useEffect(() => {
+    const container = containerRef.current;
+    if (!container) return;
+
+    const handleCopy = (e: MouseEvent) => {
+      const target = e.target as HTMLElement;
+      if (!target.classList.contains("release-copy-btn")) return;
+
+      const codeEl = target.parentElement?.querySelector("code");
+      if (codeEl && navigator.clipboard) {
+        navigator.clipboard.writeText(codeEl.textContent || "").then(() => {
+          const originalText = target.textContent;
+          target.textContent = "Copied!";
+          setTimeout(() => {
+            target.textContent = originalText;
+          }, 1500);
+        });
+      }
+    };
+
+    container.addEventListener("click", handleCopy);
+    return () => container.removeEventListener("click", handleCopy);
+  }, [releases]);
 
   useEffect(() => {
     if (!containerRef.current || releases.length === 0) return;
@@ -200,7 +224,7 @@ function formatBody(body: string): string {
       const idx = codeBlocks.length;
       const cleaned = code.trim().replace(/\n{3,}/g, "\n\n");
       const escaped = escapeHtml(cleaned);
-      codeBlocks.push(`<div class="release-code-wrapper"><pre class="release-code" data-lang="${lang}"><code>${escaped}</code></pre><button class="release-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500)})">Copy</button></div>`);
+      codeBlocks.push(`<div class="release-code-wrapper"><pre class="release-code" data-lang="${lang}"><code>${escaped}</code></pre><button class="release-copy-btn">Copy</button></div>`);
       return `\n%%CODEBLOCK_${idx}%%\n`;
     }
   );
```

**File**: `docs/components/param-field.tsx` (modified, +21/-3)
```diff
@@ -1,17 +1,35 @@
 import type { ReactNode } from "react";
 
 interface ParamFieldProps {
-  path: string;
+  path?: string;
+  body?: string;
+  query?: string;
   type?: string;
   default?: string;
+  required?: boolean;
   children?: ReactNode;
 }
 
-export function ParamField({ path, type, default: defaultValue, children }: ParamFieldProps) {
+export function ParamField({
+  path,
+  body,
+  query,
+  type,
+  default: defaultValue,
+  required,
+  children,
+}: ParamFieldProps) {
+  const name = path || body || query;
+
   return (
     <div className="my-4 rounded-lg border border-fd-border bg-fd-card p-4">
       <div className="flex flex-wrap items-center gap-2 mb-2">
-        <code className="text-sm font-semibold text-fd-primary">{path}</code>
+        <code className="text-sm font-semibold text-fd-primary">{name}</code>
+        {required && (
+          <span className="text-xs font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
+            Required
+          </span>
+        )}
         {type && (
           <span className="text-xs text-fd-muted-foreground bg-fd-muted px-2 py-0.5 rounded">
             {type}
```

**File**: `docs/scripts/fetch-releases.mjs` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ async function fetchReleases(repo, outFile) {
   const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=50`, {
     headers: {
       'Accept': 'application/vnd.github.v3+json',
+      'User-Agent': 'chonkie-docs',
       ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }),
     },
   });
```

**File**: `docs/scripts/sync-external-docs.mjs` (modified, +19/-3)
```diff
@@ -8,8 +8,21 @@ if (existsSync(envPath)) {
   const envContent = await readFile(envPath, "utf-8");
   for (const line of envContent.split("\n")) {
     const match = line.match(/^([^#=]+)=(.*)$/);
-    if (match && !process.env[match[1].trim()]) {
-      process.env[match[1].trim()] = match[2].trim();
+    if (match) {
+      const key = match[1].trim();
+      let value = match[2].trim();
+      if (value.includes("#")) {
+        value = value.split("#")[0].trim();
+      }
+      if (
+        (value.startsWith('"') && value.endsWith('"')) ||
+        (value.startsWith("'") && value.endsWith("'"))
+      ) {
+        value = value.slice(1, -1).trim();
+      }
+      if (!process.env[key]) {
+        process.env[key] = value;
+      }
     }
   }
 }
@@ -69,4 +82,7 @@ async function syncAll() {
   }
 }
 
-syncAll();
+syncAll().catch((err) => {
+  console.error("[Sync] Error:", err.message);
+  process.exit(1);
+});
```

---

### Incident Patch 7: `33b50841` (2026-06-29)
**Commit Message**: fix: forward kwargs in BasePorter.__call__ and use points attr in qdrant search

- BasePorter.__call__ now forwards **kwargs to self.export() instead of dropping them
- QdrantHandshake.search() accesses results.points directly instead of model_dump()
  for better compatibility across qdrant-client versions

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

**File**: `src/chonkie/handshakes/qdrant.py` (modified, +2/-2)
```diff
@@ -210,8 +210,8 @@ def search(
             with_payload=True,
         )
         matches = [
-            {"id": result["id"], "score": result["score"], **result["payload"]}
-            for result in results.model_dump()["points"]
+            {"id": point.id, "score": point.score, **(point.payload or {})}
+            for point in results.points
         ]
         logger.info(f"Search complete: found {len(matches)} matching chunks")
         return matches
```

**File**: `src/chonkie/porters/base.py` (modified, +1/-1)
```diff
@@ -44,4 +44,4 @@ async def aexport(self, chunks: list[Chunk], **kwargs: Any) -> Any:
 
     def __call__(self, chunks: list[Chunk], **kwargs: Any) -> Any:
         """Export the chunks to the desired format."""
-        return self.export(chunks)
+        return self.export(chunks, **kwargs)
```

---

### Incident Patch 8: `1259a4dd` (2026-06-26)
**Commit Message**: Revert "ty"

This reverts commit f0fd242605b61e8bde1cb13adc53df0cc79785ac.

**File**: `pyproject.toml` (modified, +0/-12)
```diff
@@ -285,18 +285,6 @@ omit = ["*/chonkie/api/migrations/*"]
 [tool.coverage.report]
 omit = ["*/chonkie/api/migrations/*"]
 
-[tool.uv]
-constraint-dependencies = [
-    "onnxruntime<1.24; python_version < '3.11'",
-]
-
-[tool.ty.rules]
-invalid-method-override = "ignore"
-invalid-argument-type = "ignore"
-unresolved-import = "ignore"
-no-matching-overload = "ignore"
-deprecated = "ignore"
-
 [tool.mypy]
 disallow_untyped_defs = true
 ignore_missing_imports = true
```

**File**: `src/chonkie/api/routes/pipelines.py` (modified, +3/-3)
```diff
@@ -211,13 +211,13 @@ async def update_pipeline(
                 status_code=400,
                 detail=f"Pipeline name '{request.name}' already exists",
             )
-        pipeline.name = request.name  # ty: ignore[invalid-assignment]
+        pipeline.name = request.name
 
     if request.description is not None:
-        pipeline.description = request.description  # ty: ignore[invalid-assignment]
+        pipeline.description = request.description
 
     if request.steps is not None:
-        pipeline.config = {"steps": [step.model_dump() for step in request.steps]}  # ty: ignore[invalid-assignment]
+        pipeline.config = {"steps": [step.model_dump() for step in request.steps]}
 
     await db.commit()
     await db.refresh(pipeline)
```

**File**: `src/chonkie/chunker/code.py` (modified, +2/-2)
```diff
@@ -38,7 +38,7 @@ def _detect_language_by_parsing(text: str) -> str | None:
     for lang in languages:
         try:
             config = ProcessConfig(language=lang, structure=True, imports=True)
-            result = process(text, config)
+            result = process(text, config)  # ty: ignore[invalid-argument-type]
             structure_score = len(result.structure) + len(result.imports)
             results.append((
                 lang,
@@ -168,7 +168,7 @@ def _process_code(self, text: str, language: str) -> list["CodeChunk"]:
 
         chunk_max_bytes = self._estimate_chunk_max_bytes(text)
         config = ProcessConfig(language=language, chunk_max_size=chunk_max_bytes)
-        result = process(text, config)
+        result = process(text, config)  # ty: ignore[invalid-argument-type]
         return result.chunks  # ty: ignore[invalid-return-type]
 
     def _create_chunks_from_code_chunks(
```

**File**: `src/chonkie/embeddings/model2vec.py` (modified, +1/-2)
```diff
@@ -60,8 +60,7 @@ def embed(self, text: str) -> np.ndarray:
 
     def embed_batch(self, texts: list[str]) -> list[np.ndarray]:
         """Embed multiple texts using the model2vec model."""
-        embeddings = self.model.encode(texts, convert_to_numpy=True)
-        return list(embeddings)  # type: ignore[return-value]
+        return self.model.encode(texts, convert_to_numpy=True)  # type: ignore[return-value]
 
     def similarity(self, u: np.ndarray, v: np.ndarray) -> np.float32:
         """Compute cosine similarity of two embeddings."""
```

**File**: `src/chonkie/embeddings/registry.py` (modified, +2/-2)
```diff
@@ -157,12 +157,12 @@ def wrap(cls, object: Any, **kwargs: Any) -> BaseEmbeddings:
             embeddings_cls = cls.match(object)
             if embeddings_cls is None:
                 raise ValueError(f"No matching embeddings implementation found for: {object}")
-            return embeddings_cls(object, **kwargs)  # ty: ignore[too-many-positional-arguments]
+            return embeddings_cls(object, **kwargs)  # type: ignore[call-arg]
         else:
             # Loop through all the registered embeddings and check if the object is an instance of any of them
             for type_alias, embeddings_cls in cls.type_registry.items():
                 if type_alias in str(type(object)):
-                    return embeddings_cls(object, **kwargs)  # ty: ignore[too-many-positional-arguments]
+                    return embeddings_cls(object, **kwargs)  # type: ignore[call-arg]
         raise ValueError(f"Unsupported object type for embeddings: {object}")
 
 
```

---

### Incident Patch 9: `cbb65147` (2026-06-08)
**Commit Message**: Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `docs/oss/chefs/liteparse.mdx` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ chef = LiteParse(
   Specific pages to parse (e.g., `"1-5,10"`).
 </ParamField>
 
-<ParamField path="dpi" type="int" default="150">
+<ParamField path="dpi" type="Optional[float]" default="None">
   Rendering resolution for PDF pages.
 </ParamField>
 
```

---

### Incident Patch 10: `ab7e2806` (2026-06-08)
**Commit Message**: Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `docs/oss/chefs/liteparse.mdx` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ chef = LiteParse(
   Optional HTTP OCR server URL (e.g., EasyOCR or PaddleOCR server).
 </ParamField>
 
-<ParamField path="max_pages" type="int" default="10000">
+<ParamField path="max_pages" type="Optional[int]" default="None">
   Maximum number of pages to parse.
 </ParamField>
 
```

#### Recent Merged Pull Requests:
- **PR #664** (closed): chore(deps): bump anyio from 4.14.1 to 4.14.2 (@dependabot[bot])
- **PR #663** (closed): chore(deps): bump soupsieve from 2.8.4 to 2.9 (@dependabot[bot])
- **PR #661** (closed): chore(deps): bump mistune from 3.3.2 to 3.3.3 (@dependabot[bot])
- **PR #660** (closed): chore(deps): bump tornado from 6.5.7 to 6.5.8 (@dependabot[bot])
- **PR #657** (2026-08-26): chore: fix CI (@chonk-lain)
- **PR #655** (2026-08-26): Validate the resolved chunk_overlap for float values in TokenChunker (@eeshsaxena)
- **PR #654** (closed): fix: preserve multibyte token chunk boundaries (@mikemikimike)
- **PR #653** (closed): chore(deps): bump h2 from 4.3.0 to 4.4.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
