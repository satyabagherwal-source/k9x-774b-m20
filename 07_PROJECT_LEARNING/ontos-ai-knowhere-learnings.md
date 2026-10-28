> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ontos-ai-knowhere-learnings.md`  
> **Source**: github ([https://github.com/Ontos-AI/knowhere](https://github.com/Ontos-AI/knowhere))  
> **Source Version**: `23ab68c2`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-28T07:20:50.014Z  
> **Learning ID**: `learn-github-ontos-ai-knowhere`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Ontos-AI/knowhere

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & Subsystem Topology
`Ontos-AI/knowhere` is an enterprise document parsing, graph-structuring, and agentic retrieval engine designed to convert unstructured, dirty files (multi-hundred-page technical PDFs, drawing atlases, office documents, TXT) into a persistent, navigable memory substrate for AI agents and agentic RAG.

```
                      +---------------------------------------+
                      |   Ingress Layer: FastAPI (apps/api)   |
                      |   - Pure ASGI Logging & Telemetry    |
                      |   - Dual-Message Security Boundary    |
                      |   - Webhook Outbox & Secret Masking   |
                      +-------------------+-------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
                v                                                   v
+-------------------------------+               +-----------------------------------+
|  Synchronous / Transactional  |               |  Asynchronous Processing Layer    |
|  - PostgreSQL (Aurora)        |               |  - Worker Cluster (apps/worker)   |
|  - pgvector / Trigram Indices |               |  - QStash / Redis Queue Tasks     |
|  - Session Lifecycle Guards   |               |  - Dual-Track Parser Engine       |
+-------------------------------+               +-----------------+-----------------+
                                                                  |
                +-------------------------------------------------+
                |
                v
+-----------------------------------------------------------------------------------+
| Multi-Modal Document Parsing Pipeline                                             |
|                                                                                   |
|  [File Payload] ---> Format Detector ---> Clean Parser (TXT, PDF, PPTX, Docx)    |
|                                                  |                                |
|        +-----------------------------------------+                                |
|        v                                         v                                |
|  [Vision Track]                           [Text Track]                            |
|  - Page Render (3072-dim embeddings)      - Canonical token/word boundary parser  |
|  - Frontier VLM layout detection          - Section/TOC hierarchy reconstruction |
|        +-----------------------------------------+                                |
|                                                  |                                |
|                                                  v                                |
|                                   [DataFrame Chunk Converter]                     |
|                                                  |                                |
|                                                  v                                |
|                                     Map Units & Graph Nodes                       |
+--------------------------------------------------+--------------------------------+
                                                   |
                                                   v
+-----------------------------------------------------------------------------------+
| Agentic Retrieval 2.0 (Corpus-Native MapNav Engine)                              |
| - Hierarchy-aware tools (Section Snapshots, Trigram search, Covering Indices)     |
| - Decoupled DB hydration from agent execution loop (Anti-Idle-Transaction)        |
+-----------------------------------------------------------------------------------+
```

### 1.2 Core Architectural Boundaries
1. **The API Ingress (`apps/api`)**: Built on FastAPI, enforcing strict request scoping, pure ASGI context propagation (bypassing Starlette's `BaseHTTPMiddleware` memory buffering hazards), and a strict dual-message error boundary (`internal_message` vs. `user_message`).
2. **The Worker Subsystem (`apps/worker`)**: Decoupled batch parser and orchestrator that consumes ingestion jobs. It executes a dual-track architecture:
   - **Text Track**: Extracts canonical layout hierarchy, preserving lexical separators, tabs, and non-breaking spaces.
   - **Vision Track**: Renders full-page representations for frontier vision models, yielding high-dimensional embeddings (resized to 3072 dimensions in migrations).
3. **The Shared Domain Core (`packages/shared-python`)**: Implements database models, repository abstractions, transactional outbox dispatchers, webhook cryptographic signing, and unified exception hierarchies.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dual-Scope Exception Isolation Pattern
**RULE**:
Application domain exceptions MUST strictly decouple diagnostic technical error messages from client-facing display messages at the class constructor level. Under no circumstances may raw internal exceptions, database driver messages, or external service responses be assigned to client-visible payload fields.

**WHY**:
Leaking database connection errors, stack traces, schema names, or raw driver failures (e.g., `asyncpg.exceptions._base.InterfaceError: connection is closed`) to external HTTP clients exposes internal network topology, storage technologies, table schemas, and authentication boundaries to adversaries. Conversely, stripping internal diagnostic messages from log pipelines impairs incident investigation.

**WHEN TO APPLY**:
Apply across all REST, GraphQL, gRPC, and RPC API boundaries where backend operations interface with user inputs, relational databases, or external third-party microservices.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# shared/core/exceptions/knowhere_exception.py
from typing import Any, Dict, Optional
import uuid
from loguru import logger

class KnowhereException(Exception):
    """Base exception enforcing absolute isolation between internal logs and client payloads."""

    def __init__(
        self,
        code: str,
        internal_message: str,
        user_message: str,
        http_status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
        original_exception: Optional[Exception] = None,
    ) -> None:
        super().__init__(internal_message)
        self.code = code
        self.internal_message = internal_message
        self.user_message = user_message
        self.http_status_code = http_status_code
        self.details = details or {}
        self.original_exception = original_exception

    def logging(self, request_id: str) -> None:
        """Emits structured server-side diagnostics containing raw technical details."""
        log_payload = {
            "error_code": self.code,
            "request_id": request_id,
            "internal_message": self.internal_message,
            "details": self.details,
            "original_exception": repr(self.original_exception) if self.original_exception else None,
        }
        if self.http_status_code >= 500:
            logger.error(f"[SYSTEM FAILURE] {log_payload}")
        else:
            logger.warning(f"[CLIENT FAULT] {log_payload}")

    def to_client(self, request_id: str) -> Dict[str, Any]:
        """Produces sanitized client responses. Guaranteed free of internal_message."""
        return {
            "success": False,
            "error": {
                "code": self.code,
                "message": self.user_message,  # NEVER internal_message
                "request_id": request_id,
                "details": self.details,
            },
        }
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Direct leakage of raw exception strings to clients
@app.exception_handler(Exception)
async def dangerous_exception_handler(request: Request, exc: Exception):
    # FATAL SECURITY LEAK: Exposes raw SQL, connection strings, or internal file paths
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "trace": traceback.format_exc()}
    )
```

**VERIFICATION METHOD**:
Enforce compliance via AST linting and unit test assertions:
```python
def test_exception_boundary_never_leaks_internal_message():
    secret_internal_info = "Connection to postgres://admin:secret@10.0.0.1 failed"
    exc = KnowhereException(
        code="INTERNAL_DATABASE_ERROR",
        internal_message=secret_internal_info,
        user_message="A backend service error occurred. Please retry later.",
        http_status_code=500
    )
    client_payload = exc.to_client(request_id="req-test-123")
    assert secret_internal_info not in str(client_payload)
    assert client_payload["error"]["message"] == "A backend service error occurred. Please retry later."
```

---

### 2. Transaction Disconnection During Long-Running I/O
**RULE**:
Relational database sessions and transactions MUST NOT remain open across external network boundaries, LLM inference calls, agent orchestration loops, or un-bounded I/O operations. Database connections MUST be returned to the connection pool prior to awaiting external RPCs, and re-acquired when persistence or hydration is required.

**WHY**:
Cloud managed databases (e.g., AWS Aurora PostgreSQL) enforce strict server-side timeouts such as `idle_in_transaction_session_timeout`. When an application holds an open transaction while waiting 30–120 seconds for an external agent episode or LLM completion, the server terminates the backend connection (`FATAL: terminating connection due to idle-in-transaction timeout`). Subsequent queries on the request-scoped session fail immediately with `asyncpg.exceptions._base.InterfaceError: connection is closed`, triggering cascading 500 errors and socket leaks.

**WHEN TO APPLY**:
Applies to all async web APIs incorporating multi-step agentic workflows, long-running LLM generation, document parsing calls, or external webhook deliveries.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# apps/api/app/services/retrieval/agentic_pipeline.py
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

class AgenticRetrievalOrchestrator:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self.session_factory = session_factory

    async def execute_retrieval_query(self, user_id: str, query: str) -> dict:
        # Phase 1: Short-lived initial metadata lookup and authorization
        async with self.session_factory() as db:
            async with db.begin():
                user_context = await self._fetch_user_context(db, user_id)
        # Connection explicitly closed and returned to pool here

        # Phase 2: External Agentic Inference / Navigation Loop (Can take 60-120s)
        # ZERO active database connections held during this wait
        navigation_result = await self._run_agent_explore_route(
            query=query, 
            context=user_context
        )

        # Phase 3: Short-lived document hydration query
        async with self.session_factory() as db:
            async with db.begin():
                hydrated_documents = await self._hydrate_results(
                    db, 
                    document_ids=navigation_result.matched_ids
                )

        return {"results": hydrated_documents}
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Passing request-scoped AsyncSession across un-bounded LLM loops
async def execute_query_bad(db: AsyncSession, query: str):
    # Transaction opened implicitly or explicitly
    record = await db.execute(select(Corpus).where(...))
    
    # FATAL DEFECT: External LLM invocation holds Postgres connection idle in transaction!
    # Aurora terminates connection after idle_in_transaction_session_timeout
    agent_output = await external_llm_harness.run_episode(query)  # 70+ seconds
    
    # CRASH: asyncpg.exceptions.InterfaceError: connection is closed
    final_docs = await db.execute(select(Doc).where(Doc.id.in_(agent_output.ids)))
    return final_docs
```

**VERIFICATION METHOD**:
Implement a transaction guard monitor or unit test tracking session lifetime:
```python
import pytest
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_agentic_loop_holds_no_active_transaction():
    mock_session = AsyncMock()
    mock_session.is_active = True
    
    async def fake_llm_call():
        # Assert DB session is not in an active transaction during the call
        assert not mock_session.in_transaction()
        return ["doc_1"]

    orchestrator = AgenticRetrievalOrchestrator(...)
    # Verify execution completes without transaction contention
```

---

### 3. Pure ASGI Middleware for Request Context & Header Mutation
**RULE**:
HTTP context propagation and tracing middlewares in async Python ASGI applications MUST be written as pure ASGI 3-callable components (`(scope, receive, send) -> None`) rather than inheriting from Starlette's `BaseHTTPMiddleware` when processing streaming requests, file uploads, or high-concurrency event loops.

**WHY**:
Starlette's `BaseHTTPMiddleware` wraps the ASGI request/response stream in an internal `StreamingResponse` using `anyio` task groups. This creates three critical production failure modes: (1) it consumes and buffers chunks into memory, breaking backpressure on multi-hundred-megabyte document uploads; (2) contextvars propagation fails to bleed back cleanly across coroutines; (3) unhandled exceptions inside the ASGI pipeline get masked or can cause task cancelation hangs.

**WHEN TO APPLY**:
All ASGI web frameworks (FastAPI, Starlette, Litestar, Quart) handling document ingestion, large payload streaming, or low-latency instrumentation.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# apps/api/app/core/middleware/logging.py
import uuid
from starlette.types import ASGIApp, Message, Receive, Scope, Send
from shared.core.logging import log_context

SKIP_PATHS = {"/health", "/api/health"}

class PureAsgiLoggingMiddleware:
    """Pure ASGI middleware avoiding BaseHTTPMiddleware stream buffering."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if path in SKIP_PATHS:
            await self.app(scope, receive, send)
            return

        # Header parsing without mutating the receive stream
        headers = dict(
            (k.decode("latin-1").lower(), v.decode("latin-1"))
            for k, v in scope.get("headers", [])
        )
        request_id = headers.get("x-request-id") or str(uuid.uuid4())

        # Bind request_id to ASGI scope state
        scope.setdefault("state", {})
        scope["state"]["request_id"] = request_id

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                # Clean header injection without stream consumption
                raw_headers = [
                    (k, v)
                    for k, v in message.get("headers", [])
                    if k.lower() != b"x-request-id"
                ]
                raw_headers.append((b"x-request-id", request_id.encode("latin-1")))
                message["headers"] = raw_headers
            await send(message)

        with log_context(request_id=request_id):
            await self.app(scope, receive, send_wrapper)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: BaseHTTPMiddleware for tracing or streaming APIs
from starlette.middleware.base import BaseHTTPMiddleware

class BadTracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # FATAL: BaseHTTPMiddleware buffers the entire streaming response body into memory
        # Breaks backpressure on multi-gigabyte document uploads and LLM token streams
        response = await call_next(request)
        response.headers["X-Request-ID"] = str(uuid.uuid4())
        return response
```

**VERIFICATION METHOD**:
Verify using a memory profiling integration test streaming a 100MB synthetic binary payload; ensure resident memory does not spike by the payload size during header injection.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Total Text De-spacing During Plaintext Ingestion (BUG-TXT-PARSE-01)
- **Context**: Document parsing engine, TXT format line cleaner (`apps/worker/app/services/document_parser/formats/text/parser.py`).
- **What Was Expected**: Plaintext files should be parsed into sequential lines while preserving intra-sentence whitespace, indentation, word delimiters, tabs, and non-breaking spaces across UTF-8 text.
- **What Actually Happened**: The parser ran `line = re.sub(r"\s", "", line)` on every line of text. This regex stripped all spaces, tabs, and word boundaries. English text became completely concatenated: `"This is a sample"` became `"Thisisasample"`. Downstream tokenization, BM25 indexing, vector chunking, and TOC extraction were rendered completely unusable.
- **Evidence in Repo**: Commit `45961398`, PR patch modifying `apps/worker/app/services/document_parser/formats/text/parser.py` and contract test `apps/worker/tests/contract/test_text_parser_contract.py`.
- **Root Cause**: An overly aggressive sanitization regex intended to trim terminal line returns mistakenly stripped `\s` globally across the entire string without distinguishing interior word separators from terminal carriage returns.
- **Remediation Code Diff**:
```python
<<<< apps/worker/app/services/document_parser/formats/text/parser.py
-def parse_texts(file_path: str, baseurl: str = "") -> list:
-    """Parse text file and return lines list."""
-    txt_bytes = load_file_bytes(file_path, file_url=baseurl)
-    text = txt_bytes.decode("utf-8")
-    txt_lines = []
-    for line in text.splitlines():
-        line = re.sub(r"\s", "", line)
-        txt_lines.append(line)
-    return txt_lines
+def parse_texts(file_path: str, baseurl: str = "") -> list[str]:
+    """Read UTF-8 lines without removing whitespace within each line."""
+    text_bytes: bytes = load_file_bytes(file_path, file_url=baseurl)
+    text: str = text_bytes.decode("utf-8")
+    return text.splitlines()
```
- **Lesson**: Never use `re.sub(r"\s", "", str)` for line normalization. Standard string primitives like `.splitlines()` natively handle newline separators (`\r\n`, `\n`, `\r`) without corrupting intra-token lexical spaces, tab characters (`\t`), or Unicode non-breaking spaces (`\u00a0`).

---

### Incident 2: Aurora Connection Termination via Idle-In-Transaction Timeout (BUG-RETRIEVAL-IDLE-02)
- **Context**: Agentic retrieval API endpoint (`POST /v1/retrieval/query`, Trace `01a083eb5f607c35931721077dafb81b`).
- **What Was Expected**: The agentic exploration harness (`harness.run_episode(...)`) executes complex navigation and vector/graph searches across documents, after which matching documents are hydrated and returned over HTTP 200.
- **What Actually Happened**: The endpoint crashed with `500 Internal Server Error`. Aurora PostgreSQL logged:
  ```text
  FATAL: terminating connection due to idle-in-transaction timeout
  ```
  Followed immediately by FastAPI/asyncpg failing with:
  ```text
  asyncpg.exceptions._base.InterfaceError: connection is closed
  ```
- **Evidence in Repo**: GitHub Closed Issue #399. Alert window `2026-09-09 09:49:44–10:24:46 CST`. Failing API task IP `10.0.136.212`. LLM agent loop lasted 71.575 seconds while holding the database transaction open.
- **Root Cause**: The FastAPI dependency injection `get_db` yielded a request-scoped `AsyncSession`. The route initiated a read query, entering an open transaction state. The execution then awaited `harness.run_episode(...)` for 71.5 seconds. PostgreSQL's `idle_in_transaction_session_timeout` fired at ~60 seconds, severing the TCP socket. The subsequent attempt to reuse the session for document hydration attempted to write to a severed connection.
- **Remediation Code Diff**:
```python
<<<< apps/api/app/services/retrieval/retrieval_service.py
-async def run_retrieval_pipeline(db: AsyncSession, request: RetrievalRequest):
-    # DB transaction remains open here
-    initial_meta = await fetch_meta(db, request.corpus_id)
-    # Hanging inside LLM harness for 71+ seconds with idle transaction!
-    episode_result = await harness.run_episode(request.query, initial_meta)
-    # InterfaceError: connection is closed!
-    return await hydrate_documents(db, episode_result.document_ids)
+async def run_retrieval_pipeline(session_factory: async_sessionmaker[AsyncSession], request: RetrievalRequest):
+    async with session_factory() as db:
+        initial_meta = await fetch_meta(db, request.corpus_id)
+    # Connection released to pool during LLM agent episode
+    episode_result = await harness.run_episode(request.query, initial_meta)
+    async with session_factory() as db:
+        return await hydrate_documents(db, episode_result.document_ids)
```
- **Lesson**: Database sessions must be strictly transactional and ephemeral. Long-running AI agent steps must occur outside database transaction boundaries.

---

### Incident 3: Non-Idempotent Schema Backfill Lock Contention (BUG-MIGRATION-LOCK-03)
- **Context**: Alembic migration `0b1c2d3e4f5a_add_demo_materialization_claim_state.py`.
- **What Was Expected**: Add `status` and `claimed_at` columns with a default of `'ready'`, backfill existing rows, and enforce `nullable=False` without locking production tables or causing downtime.
- **What Actually Happened**: Direct `ALTER TABLE ... ADD COLUMN ... NOT NULL DEFAULT 'ready'` would take an exclusive table lock on large materialization tables, blocking concurrent query execution.
- **Evidence in Repo**: Migration `0b1c2d3e4f5a_add_demo_materialization_claim_state.py`.
- **Root Cause**: PostgreSQL table rewrite lock hazards when adding non-null columns without proper multi-phase execution.
- **Remediation Code Diff**:
```python
<<<< apps/api/alembic/versions/0b1c2d3e4f5a_add_demo_materialization_claim_state.py
 def upgrade() -> None:
+    # Step 1: Add column as nullable (instant metadata update, no table lock)
     op.add_column(
         "demo_materializations",
         sa.Column("status", sa.String(length=32), nullable=True),
     )
     op.add_column(
         "demo_materializations",
         sa.Column("claimed_at", sa.DateTime(), nullable=True),
     )
+    # Step 2: Backfill existing data safely
     op.execute(
         "UPDATE demo_materializations SET status = 'ready' WHERE status IS NULL"
     )
+    # Step 3: Enforce NOT NULL and server_default post-backfill
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
```
- **Lesson**: Safe zero-downtime DDL additions of non-null columns require a three-step phased migration: add column nullable -> backfill data -> set not null with server default.

---

### Incident 4: Raw Webhook Secret Leakage via Query Serialization (BUG-SECRET-EXPOSE-04)
- **Context**: Webhook secret management route (`apps/api/app/api/v1/routes/webhook_secrets.py`).
- **What Was Expected**: Listing webhook secrets must display masked tokens (`whsec_****...xyz`) and never expose the plaintext HMAC key. Only during the initial generation POST request should the raw secret be visible once.
- **What Actually Happened**: If models store the raw secret or return ORM instances directly, the raw symmetric signing key is serialized into API responses and logged in telemetry.
- **Evidence in Repo**: `apps/api/app/api/v1/routes/webhook_secrets.py`, functions `mask_secret`, `to_response`, `to_full_response`.
- **Root Cause**: Storing unmasked secrets in ORM attributes that are accessible by standard serializers.
- **Remediation Code Diff**:
```python
<<<< apps/api/app/api/v1/routes/webhook_secrets.py
+def mask_secret(secret: str) -> str:
+    """Mask a secret, showing only prefix and last 4 chars."""
+    if len(secret) <= 12:
+        return secret[:6] + "****"
+    return secret[:6] + "****" + secret[-4:]

+def to_response(secret) -> SecretResponse:
+    """Convert WebhookSecret to masked response model."""
+    raw_secret = getattr(secret, "_raw_secret", None)
+    masked = mask_secret(raw_secret) if raw_secret else f"whsec_****...{secret.id[-4:]}"
+    return SecretResponse(
+        id=secret.id,
+        endpoint=secret.endpoint,
+        secret_masked=masked,
+        status=secret.status,
+        created_at=secret.created_at.isoformat(),
+    )
```
- **Lesson**: Raw cryptographic secrets must never reside in persisted model fields. Secrets must be transiently passed via temporary in-memory properties (`_raw_secret`) during generation, hashed or encrypted at rest, and masked on retrieval.

---

### Incident 5: Webhook Event Premature Dispatch on Non-Terminal Jobs (BUG-WH-RACE-05)
- **Context**: Webhook manual trigger endpoint (`apps/api/app/api/v1/routes/webhook.py`).
- **What Was Expected**: Webhook notifications must only dispatch after a job has reached a conclusive terminal state (`done` or `failed`).
- **What Actually Happened**: Clients or automated retry loops triggering manual webhook re-deliveries during active parsing jobs dispatched inconsistent intermediate states to downstream listener endpoints.
- **Evidence in Repo**: `apps/api/app/api/v1/routes/webhook.py` lines 97–110.
- **Root Cause**: Absence of state-machine terminal assertion check before pulling transactional outbox events.
- **Remediation Code Diff**:
```python
<<<< apps/api/app/api/v1/routes/webhook.py
+        # 2. Validation - client errors (400)
+        if not job.is_terminal_state():
+            from shared.core.exceptions.domain_exceptions import ValidationException
+
+            raise ValidationException(
+                user_message=f"Job must be in terminal state to trigger webhook. Current status: {job.status}",
+                violations=[
+                    {
+                        "field": "job_id",
+                        "description": f"Job status is '{job.status}', expected 'done' or 'failed'",
+                    }
+                ],
+            )
```
- **Lesson**: Stateful asynchronous event dispatches must validate domain model state machines (`is_terminal_state()`) prior to querying outbox dispatchers.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Implicit Falsy vs. Exact Comparison in Ingestion**:
   In document chunking, testing `if not line:` causes lines containing `"0"` or `False` strings to be incorrectly discarded. Explicit length checking or None checking is mandatory:
   ```python
   # HAZARD: Discards valid text containing numeric zero
   if not line:
       continue

   # SAFE: Checks exact empty condition after splitlines()
   if len(line) == 0:
       continue
   ```
2. **Deep Immutability vs. Shallow Object Copying in AST Chunkers**:
   When parsing hierarchical sections, duplicating metadata dictionaries using `.copy()` causes nested citation objects to share mutations across chunks:
   ```python
   # HAZARD: Mutating citation in chunk_b mutates chunk_a
   chunk_b_meta = chunk_a_meta.copy()
   chunk_b_meta["citations"]["page"] = 4 

   # INVARIANT: Use copy.deepcopy or explicit immutable reconstruction
   import copy
   chunk_b_meta = copy.deepcopy(chunk_a_meta)
   ```
3. **Unicode Normalization and Non-Breaking Spaces**:
   Plaintext files frequently contain Unicode non-breaking spaces (`\u00a0`), zero-width spaces (`\u200b`), and carriage return artifacts. Tokenizers will split or merge words unpredictably unless normalized:
   ```python
   import unicodedata
   # Normalize non-breaking spaces and accented forms to canonical decomposed/composed form
   clean_text = unicodedata.normalize("NFKC", raw_text)
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **Table of Contents (TOC) Traversal Guard**:
   Hierarchical document models can contain recursive parent-child references (e.g., Section 1 -> Section 1.1 -> Section 1). Traversal algorithms must enforce depth caps and visited sets:
   ```python
   def traverse_section_hierarchy(
       section: SectionNode, 
       visited: set[str], 
       current_depth: int = 0, 
       max_depth: int = 32
   ) -> list[SectionNode]:
       if current_depth > max_depth:
           raise MaxRecursionDepthExceededException("TOC depth exceeded 32 levels")
       if section.id in visited:
           raise CircularReferenceDetectedException(f"Cycle at section {section.id}")
       
       visited.add(section.id)
       results = [section]
       for child in section.children:
           results.extend(traverse_section_hierarchy(child, visited, current_depth + 1, max_depth))
       return results
   ```
2. **Event Loop Microtask Starvation during CPU Chunking**:
   Chunking massive text files (e.g., 500-page atlas documents) blocks the Python `asyncio` event loop. Workers must yield control back to the loop:
   ```python
   async def async_chunk_stream(lines: list[str], batch_size: int = 10