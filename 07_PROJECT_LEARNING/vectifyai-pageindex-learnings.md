> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vectifyai-pageindex-learnings.md`  
> **Source**: github ([https://github.com/VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex))  
> **Source Version**: `c11c2342`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T08:08:39.539Z  
> **Learning ID**: `learn-github-vectifyai-pageindex`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): VectifyAI/PageIndex

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Mission & Structural Mechanics
PageIndex replaces traditional dense-vector embeddings and vector databases (ANN vector search over chunked text) with **vectorless, hierarchical tree indexing coupled with agentic reasoning**. In standard vector retrieval-augmented generation (RAG), documents are cut into arbitrary token chunks (e.g., 512 tokens with 50-token overlap), embedded into vector spaces, and queried via cosine similarity. This process introduces severe failure modes:
1. **Semantic Drift & Context Fragmentation**: Splitting text across arbitrary chunk boundaries strips hierarchical structure (headers, sections, nested clauses).
2. **Similarity ≠ Relevance**: Semantic similarity retrieves text that sounds linguistically related to the prompt while missing disparate facts needed for deductive reasoning.
3. **Black-Box Traceability**: Standard vector nearest-neighbor lookups cannot explain why a chunk was selected over another.

```
+----------------------------------------------------------------------------------------------------+
|                                    PAGEINDEX RUNTIME ARCHITECTURE                                  |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
                        +──────────────────────────────────────────────────+
                        |                 PageIndexClient                  |
                        |      (Unified Facade / Dual Backend Router)      |
                        +─────────────────┬────────────────────────────────+
                                          │
                  ┌───────────────────────┴────────────────────────┐
                  ▼                                                ▼
     [CLOUD LANE: CloudAPI]                         [LOCAL LANE: LocalAPI / LocalChat]
     - HTTP/JSON-RPC wire protocol                  - In-process layout engine (PyMuPDF/pdfium)
     - Presigned S3 image URLs                      - PageIndex Flash (Deterministic Layout Stats)
     - Managed OCR & server-side treeing            - LiteLLM Bridge & Claude Agent SDK Router
     - Schema validation on folders                 - Local disk tree store (JSON / YAML)
                  │                                                │
                  └───────────────────────┬────────────────────────┘
                                          ▼
                        +──────────────────────────────────────────────────+
                        |            Context-Engineered RAG Loop           |
                        +─────────────────┬────────────────────────────────+
                                          │
       ┌──────────────────────────────────┼──────────────────────────────────┐
       ▼                                  ▼                                  ▼
[Structure Discovery]           [Agentic Tree Traversal]            [Evidence Extraction]
- `get_document_structure`      - `browse_documents`               - `get_page_content`
- Extract outline/sections      - Level-by-level drill down        - `get_block` (bounding boxes)
- Max 100k char guardrails      - Reasoning-based node selection   - Deterministic citations
```

### 1.2 Boundary Subsystems & Component Contracts

1. **Dual Execution Fabric (`CloudAPI` vs. `LocalAPI`)**:
   - `PageIndexClient` acts as a polymorphic dispatch hub. It inspects configuration dictionaries (`index={"mode": "cloud", ...}` vs `index={"storage_path": ...}`) and dynamically routes commands either to the cloud REST service or to an in-process local pipeline without altering user-facing interfaces.
2. **Context-Engineered LLM Bridge (`pageindex/utils.py`)**:
   - Manages process-wide execution state using `contextvars.ContextVar` (`_llm_backend` and `_llm_usage`). This guarantees that concurrent asynchronous tasks inside `asyncio` loops accumulate token expenditures and configuration parameters strictly within their own execution context, preventing cross-tenant or cross-coroutine contamination.
   - Wraps raw LiteLLM and Claude SDK execution, implementing dynamic runtime patching for broken Pydantic serialization models and silencing provider banner noise.
3. **Streaming & Typed Protocol Multiplexing (`pageindex/chat_stream.py`)**:
   - Implements `ChatObject`, a dual-nature data structure acting simultaneously as a standard Python dictionary and a read-only attribute proxy matching upstream official SDK response models (`response.choices[0].message.content`).
   - Implements `ChatStream`, enforcing an exclusive single-consumer rule: consuming text via iteration permanently locks out event streams, preventing corrupt interleaved generator states.
4. **Deterministic MCP Tool Layer (`pageindex/agent_tools.py`)**:
   - Maps Model Context Protocol (MCP) tool contracts directly into Python callable functions.
   - Enforces response budgets (`TOOL_RESPONSE_CHAR_LIMIT = 100_000`, with a 95% threshold safety margin `_CHAR_BUDGET = 95_000`) to prevent LLM context-window blowout.
   - Converts all local exceptions into JSON error envelopes (`{"success": false, "error": ...}`) matching cloud MCP wire protocols, shielding agent prompt chains from unhandled runtime aborts.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Dynamic Introspection for Forward-Compatible Upstream Protocol Adaptation
**RULE**: When an agent orchestration client or middleware wraps a rapidly evolving downstream SDK that introduces ambient state or changes default loop execution strategies (e.g., server-side threads vs. stateless client-side turn loops), the wrapper MUST dynamically inspect the upstream callable's signature before injecting control parameters, and MUST NOT rely on static parameter kwargs or hardcoded package version checks.

**WHY**:
Upstream SDKs (e.g., Anthropic SDK upgrading from 2.1 to 2.2+) frequently switch default behaviors—such as defaulting `tool_runner` to a server-side stateful thread (`thread=True`). When client traffic passes through proxy gateways (e.g., OpenRouter, LiteLLM proxy, custom corporate API gateways), these stateful server threads fail because the proxy rejects requests containing only differential turns instead of the full conversation array. Attempting to unconditionally pass `thread=False` causes `TypeError: unexpected keyword argument` on older library versions. Introspecting `inspect.signature(callable).parameters` guarantees forward/backward compatibility without runtime crash hazards.

**WHEN TO APPLY**:
- In any LLM gateway, tool-calling client, or agent loop that wraps third-party model providers.
- When supporting diverse execution environments where minor library patch versions can differ between deployment nodes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import inspect
from typing import Any, Callable, Dict

def invoke_upstream_tool_runner(
    runner_fn: Callable[..., Any],
    messages: list[dict[str, Any]],
    model: str,
    passthrough_kwargs: dict[str, Any]
) -> Any:
    """Safely invoke an upstream tool runner across breaking signature changes."""
    # Inspect the exact runtime signature of the callable
    sig_params = inspect.signature(runner_fn).parameters
    
    # If the provider added a server-side thread toggle, force client-side full transcripts
    # to protect compatibility with stateless proxy architectures.
    thread_override: Dict[str, Any] = {}
    if "thread" in sig_params:
        thread_override["thread"] = False

    return runner_fn(
        messages=messages,
        model=model,
        **passthrough_kwargs,
        **thread_override
    )
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Hardcoding arguments or relying on package __version__ checks
try:
    # Crashes with TypeError on older SDK versions where 'thread' is not an accepted parameter!
    return runner_fn(messages=messages, model=model, thread=False)
except TypeError:
    return runner_fn(messages=messages, model=model)
```

**VERIFICATION METHOD**:
Verify using a parameterized mock test checking invocation arguments against various callable signatures:
```python
def test_signature_introspection_threadless():
    def old_runner(*, messages, model): return "old"
    def new_runner(*, messages, model, thread=None): return f"new_{thread}"

    assert invoke_upstream_tool_runner(old_runner, [], "m", {}) == "old"
    assert invoke_upstream_tool_runner(new_runner, [], "m", {}) == "new_False"
```

---

### 2. Context-Bound Coroutine State Isolation via Asyncio ContextVars
**RULE**: Library subsystems and middleware that track ambient state (such as cumulative token usage, tracing spans, or active backend connection overrides) across multi-turn asynchronous LLM operations MUST store mutable accumulator structures inside `contextvars.ContextVar` instances, and MUST NOT store them on global module variables, thread-locals, or pass them as mutable defaults.

**WHY**:
In asynchronous event loops (`asyncio`), multiple concurrent requests are processed on the *same physical thread*. Thread-local storage (`threading.local`) leaks state across concurrent coroutines executing on that thread. Conversely, passing mutable dictionaries deep into recursive tool-execution graphs pollutes function signatures and breaks downstream interface compatibility. `ContextVar` provides coroutine-level isolation while natively propagating across child async tasks created via `asyncio.create_task`.

**WHEN TO APPLY**:
- Any Python-based agentic framework running concurrent indexing, scraping, or multi-tenant chat completions.
- Collecting cumulative billing, telemetry, or debugging metrics from deeply nested third-party calls.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import contextvars
from typing import Dict, Any, Optional

# Declare context-bound execution vars
_ASYNC_USAGE_COUNTER: contextvars.ContextVar[Optional[Dict[str, int]]] = contextvars.ContextVar(
    "async_usage_counter", default=None
)

def record_token_consumption(tokens: int) -> None:
    """Safely increments usage within the active coroutine context only."""
    usage = _ASYNC_USAGE_COUNTER.get()
    if usage is None:
        return
    usage["tokens"] = usage.get("tokens", 0) + tokens

async def run_scoped_agent_operation() -> dict[str, int]:
    """Isolates counter mutations to this execution subtree."""
    # Create an isolated dictionary for this coroutine branch
    token_usage: Dict[str, int] = {"tokens": 0}
    token = _ASYNC_USAGE_COUNTER.set(token_usage)
    try:
        # Child coroutines and tasks inherit this context copy
        await simulate_llm_call(prompt_tokens=150)
        return dict(token_usage)
    finally:
        # Guarantee restoration of prior context to prevent state retention
        _ASYNC_USAGE_COUNTER.reset(token)

async def simulate_llm_call(prompt_tokens: int) -> None:
    record_token_consumption(prompt_tokens)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Module-level global or threading.local across coroutines
import threading
_LEAKY_USAGE = {"tokens": 0} # Contaminated across all concurrent coroutines!
_THREAD_LOCAL = threading.local() # Fails: coroutines run on the same thread!

def record_leaky_tokens(tokens: int) -> None:
    _LEAKY_USAGE["tokens"] += tokens # Race conditions and cross-tenant leakage!
```

**VERIFICATION METHOD**:
Run concurrent coroutines using `asyncio.gather` and assert that counters do not cross-pollute:
```python
import asyncio
import pytest

@pytest.mark.asyncio
async def test_contextvar_concurrency_isolation():
    async def worker(increment: int):
        token_usage = {"tokens": 0}
        t = _ASYNC_USAGE_COUNTER.set(token_usage)
        try:
            for _ in range(5):
                await asyncio.sleep(0.01)
                record_token_consumption(increment)
            return token_usage["tokens"]
        finally:
            _ASYNC_USAGE_COUNTER.reset(t)

    results = await asyncio.gather(worker(10), worker(100), worker(1))
    assert results == [50, 500, 5]
```

---

### 3. Strictly Exclusive Multi-View Generator Invariant
**RULE**: If a streaming wrapper exposes multiple consumer perspectives over a single underlying generation process (e.g., high-level joined text vs. low-level raw telemetry events), the object MUST enforce mutual exclusion at the first claim attempt. It MUST permanently invalidate competing consumer views with an explicit error, and MUST NOT permit interleaved consumption from the same generator.

**WHY**:
When an iterator/generator executes an LLM turn or agent tool-calling loop, yielding items modifies internal generator state, parses tokens, and consumes network frames. If an external client or an attached debugger attempts to iterate `stream.events` while another loop iterates `stream` (for text), frames are split non-deterministically across consumers. The stream enters an undefined state, causing corrupted text chunks, missing tool invocations, or silent stalls.

**WHEN TO APPLY**:
- Streaming interfaces returning hybrid data (UI text + LLM thought chains + raw JSON-RPC events).
- Client SDKs wrapping chunked SSE/HTTP responses.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Iterator, Optional, Any

class ExclusiveStreamMultiplexer:
    """Enforces exclusive, single-view access over an underlying generator."""
    def __init__(self, raw_generator: Iterator[dict[str, Any]]):
        self._generator = raw_generator
        self._claimed_view: Optional[str] = None
        self._is_closed = False

    def _claim(self, view_name: str) -> None:
        if self._claimed_view is not None and self._claimed_view != view_name:
            raise RuntimeError(
                f"Stream view conflict: Stream already claimed as '{self._claimed_view}'. "
                f"Cannot consume as '{view_name}'."
            )
        self._claimed_view = view_name

    def __iter__(self) -> Iterator[str]:
        self._claim("text")
        for chunk in self._generator:
            if "text" in chunk:
                yield chunk["text"]

    @property
    def events(self) -> Iterator[dict[str, Any]]:
        def consume() -> Iterator[dict[str, Any]]:
            self._claim("events")
            for chunk in self._generator:
                yield chunk
        return consume()
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Permitting multiple methods to advance the same internal generator
class PermissiveStream:
    def __init__(self, gen): self.gen = gen
    def text(self): return (x["text"] for x in self.gen if "text" in x)
    def events(self): return (x for x in self.gen)
    # If caller iterates text() and events() concurrently, items are lost to both!
```

**VERIFICATION METHOD**:
Execute an automated test attempting to alternate consumption between the two properties and assert that `RuntimeError` is raised immediately:
```python
import pytest

def test_stream_view_mutual_exclusion():
    def mock_gen():
        yield {"text": "hello", "type": "token"}
        yield {"text": "world", "type": "token"}

    stream = ExclusiveStreamMultiplexer(mock_gen())
    text_iter = iter(stream)
    assert next(text_iter) == "hello"

    with pytest.raises(RuntimeError, match="Stream already claimed as 'text'"):
        _ = next(stream.events)
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Proxy Incompatibility & Transcript Duplication in Anthropic 2.2 Tool Runner (BUG-ANTHROPIC-2.2-01)
- **Context**: `pageindex/local_chat.py`, `run_messages()` function.
- **What Was Expected**: The agentic chat protocol runner should execute tool-calling turns across diverse backends (direct Anthropic API, OpenRouter proxy, Bedrock, Vertex) and build a clean, deduplicated message transcript containing one record per turn.
- **What Actually Happened**: With the release of `anthropic>=2.2.0`, `tool_runner` shifted to maintaining a server-side stateful thread by default. This triggered two severe production defects:
  1. *Proxy Rejection*: Proxies (e.g., OpenRouter Anthropic endpoints) do not support the stateful thread API; they expect the client to resubmit the full conversation transcript on each turn. When the client sent only the delta message, the proxy rejected the request with HTTP 400.
  2. *Duplicate Final Turns & Phantom Tool Calls*: Anthropic 2.2 automatically appended the final reply into the runner's internal history. `PageIndex`'s loop had already been appending the final message explicitly. This resulted in duplicate final assistant turns in the transcript and retained unexecuted tool calls from turns cut short by `max_tokens`.
- **Evidence in Repo**: Commit `e4669cf8`, PR `#626`, modified `pageindex/local_chat.py` and `tests/test_local_chat.py`.
- **Root Cause**: Breaking architectural change in `anthropic` 2.2.0 tool runner semantics (introducing server-held conversation threading) combined with duplicate append logic in client-side transcript accumulation.
- **Remediation Code Diff**:
```python
// - File: pageindex/local_chat.py
// - Faulty invocation without parameter inspection:
- runner = backend_client.beta.messages.tool_runner(
-     max_tokens=max_tokens,
-     messages=prepared,
-     model=model,
-     tools=tools,
-     max_iterations=max_turns if max_turns is not None else 10,
-     **passthrough,
-     **cached,
- )

// + Patched implementation with dynamic signature inspection and transcript deduplication:
+ tool_runner = backend_client.beta.messages.tool_runner
+ # anthropic 2.2+ threads the loop server-side, which proxies reject
+ threadless = ({"thread": False} if "thread" in
+               inspect.signature(tool_runner).parameters else {})
+ runner = tool_runner(
+     max_tokens=max_tokens,
+     messages=prepared,
+     model=model,
+     tools=tools,
+     max_iterations=max_turns if max_turns is not None else 10,
+     **passthrough,
+     **cached,
+     **threadless,
+ )
...
  new_messages = [_dump_message(message)
                  for message in conversation[len(prepared):]]
  final_blocks = [_dump_block(item) for item in final.content]
+ # anthropic 2.2+ appends final too; it is re-added below
+ if new_messages and new_messages[-1].get("content") == final_blocks:
+     new_messages.pop()
```
- **Lesson**: Never assume third-party SDK tool runners remain client-side and stateless across minor version upgrades. Always inspect parameter signatures dynamically and sanitize transcript buffers against double-append edge cases.

---

### Incident 2: Python 3.10 Forward Reference Crash in LiteLLM Response Parsing (BUG-LITELLM-310-02)
- **Context**: `pageindex/utils.py`, `_repair_litellm_types()` function.
- **What Was Expected**: Running completions via LiteLLM on Python 3.10 environments must parse Pydantic models cleanly without runtime errors.
- **What Actually Happened**: In `litellm==1.97.0`, the Pydantic classes `Message` and `Delta` introduced nested type annotations referencing types in other submodules as string forward references. Python 3.10's type evaluation engine failed to resolve these string annotations at model construction time, causing every completion to crash with `PydanticUndefinedAnnotation` or `NameError`.
- **Evidence in Repo**: `pageindex/utils.py` lines 61–76 citing BerriAI/litellm#36384.
- **Root Cause**: Python 3.10 lack of PEP 563/649 evaluation resilience for cross-module forward references within nested Pydantic v2 data models.
- **Remediation Code Diff**:
```python
// + Runtime repair function invoked before invoking completion:
+ def _repair_litellm_types() -> None:
+     """litellm 1.97.0's Message/Delta annotations carry nested forward refs
+     Python 3.10 cannot resolve (BerriAI/litellm#36384), so every completion
+     dies constructing its response. Rebuild them once with the defining
+     modules' names; no-op on 3.11+ and on fixed litellm releases."""
+     if sys.version_info >= (3, 11):
+         return
+     try:
+         import litellm.types.llms.openai as openai_types
+         import litellm.types.utils as litellm_types
+         namespace = {**vars(openai_types), **vars(litellm_types)}
+         litellm_types.Message.model_rebuild(_types_namespace=namespace)
+         litellm_types.Delta.model_rebuild(_types_namespace=namespace)
+     except Exception:
+         pass  # best-effort: a failed repair leaves litellm's own error
```
- **Lesson**: Upstream Pydantic models using forward references can fail on older Python minor versions. Middleware frameworks must conditionally invoke `.model_rebuild(_types_namespace=...)` when running on targeted runtime environments (< Python 3.11).

---

### Incident 3: Destructive Metadata Pruning Across Cloud Compute Upgrades (BUG-METADATA-SCHEMA-03)
- **Context**: Cloud API documentation and schema synchronization (`compute v0.20.0`).
- **What Was Expected**: Uploading documents with custom metadata tags should persist those tags deterministically without data loss, regardless of whether a schema was predefined for the containing folder.
- **What Actually Happened**: In `compute v0.20.0`, the cloud backend altered schema invariants: submitting a document with metadata to a folder without a declared schema raised an immediate `PageIndexAPIError` (HTTP 400). Furthermore, calling `create_metadata_schema()` on an existing folder retroactively purged any pre-existing document metadata keys that were not explicitly declared in the new schema or that possessed mismatched types.
- **Evidence in Repo**: GitHub Issue `#629`, `pageindex/cloud_api.py`, `pageindex/agent_tools.py`.
- **Root Cause**: Upstream backend transition from a schema-free JSON payload store to a strictly validated, typed document catalog, altering storage semantics from additive to destructive sync.
- **Remediation Strategy**: Client code had to enforce schema presence before dispatching document payloads and warn consumers that updating metadata schemas is a destructive operation that drops undeclared document fields.
- **Lesson**: When backend schemas transition to strict typing, metadata creation APIs must explicitly validate types locally before payload dispatch to prevent unexpected backend data pruning.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in Route De-prefixing**:
  In `pageindex/client.py`, route strings are stripped sequentially using `removeprefix` and custom iteration:
  ```python
  # CORRECT:
  for route in _CLAUDE_ROUTES:
      if wire.startswith(route + "/"):
          wire = wire[len(route) + 1:]
          break
  else:
      wire, route = wire.removeprefix("anthropic/"), "anthropic"
  ```
  *Hazard Avoided*: Do not use `.lstrip(route + "/")`, because `.lstrip()` treats the argument as a character set, stripping matching characters from the beginning of the model name itself (e.g., `"bedrock/claude" -> "laude"`).
- **Falsy Check Hazards on Zero Values**:
  In `pageindex/utils.py`, `_add_usage()` handles token tallies. Token counts can legitimately be `0`:
  ```python
  # CORRECT:
  prompt = getattr(counted, "prompt_tokens", 0) or 0
  # Explicit None-check vs boolean truth:
  cached = getattr(details, "cached_tokens", 0)
  usage["prompt_tokens_details"]["cached_tokens"] += cached or 0
  ```
  If `cached` is `None`, `cached or 0` evaluates safely to `0`. However, when inspecting pagination offsets in `pageindex/agent_tools.py`:
  ```python
  # INCORRECT:
  if not offset:  # BUG: offset=0 is valid, evaluates to False!
      offset = default_offset
  # CORRECT:
  if offset is None:
      offset = default_offset
  ```
- **Deep Dictionary Immutability in YAML Representation**:
  `ChatObject` inherits from `dict[str, Any]` to provide attribute access over dict responses. When YAML dumps a dictionary subclass, PyYAML defaults to writing Python object tags (`!!python/object/new:pageindex.chat_stream.ChatObject`). PageIndex fixes this via runtime representer patching in `pageindex/chat_stream.py`:
  ```python
  def _as_plain_dict(dumper: Any, data: ChatObject) -> Any:
      rule = dumper.yaml_representers.get(dict)
      return rule(dumper, data) if rule else dumper.represent_data(dict(data))
  ```

### 2. Infinite Loop & Recursion Guards
- **Character Budget Caps in Tool Output**:
  In `pageindex/agent_tools.py`, recursive document traversal risks inflating LLM context buffers to provider limits. The tool runner enforces hard boundary thresholds:
  ```python
  TOOL_RESPONSE_CHAR_LIMIT = 100_000
  _CHAR_BUDGET = int(TOOL_RESPONSE_CHAR_LIMIT * 0.95) # 95,000 chars

  # Invariant check before returning tool result:
  if len(rendered_result) > _CHAR_BUDGET:
      rendered_result = rendered_result[:_CHAR_BUDGET] + "\n...[TRUNCATED DUE TO BUFFER BUDGET]"
  ```
- **Asyncio Event Loop Re-entrancy Guards**:
  In `pageindex/utils.py`, `run_off_loop` ensures that synchronous wrapper methods can invoke asynchronous routines without causing `RuntimeError: This event loop is already running`:
  ```python
  def run_off_loop(func, *args):
      try:
          asyncio.get_running_loop()
      except RuntimeError:
          # No loop running on current thread: safe to run directly
          return func(*args)
      else:
          # Loop is active: spawn single-worker thread pool to avoid deadlocking the event loop
          from concurrent.futures import ThreadPoolExecutor
          with ThreadPoolExecutor(max_workers=1) as pool:
              return pool.submit(func, *args).result()
  ```
- **Deterministic Loop Termination in HTTP Retries**:
  Retry logic in `pageindex/utils.py` defines explicit terminal error statuses that cannot be fixed by retrying, preventing infinite retry loops on non-transient failures:
  ```python
  _UNRECOVERABLE_STATUS = frozenset({401, 403, 404})
  _NO_RETRY_STATUS = _UNRECOVERABLE_STATUS | frozenset({400}) # 400 is prompt/context failure
  ```

### 3. UI & UX Micro-Mechanics
- **Citation Regular Expression Robustness**:
  `pageindex/client.py` accommodates both legacy bracketed citations and modern XML tag formats without causing catastrophic regex backtracking:
  ```python
  _OLD_CITATION_RE = re.compile(r"<doc=([^;<>]+);page=(\d+)(?:;block(?:_id)?=([^;<>]+))?>")
  _CITE_TAG_RE = re.compile(r"<cite\s([^<>]*)>(?:(?P<inner>[^<>]*)</cite>)?")
  _CITE_ATTR_RE = re.compile(r"""\b(\w+)=(['"])(.*?)\2""", re.S)
  ```
  By excluding delimiter characters (`[^;<>]`) within captured groups, the regex engine is immune to exponential ReDoS backtracking when scanning malformed output.

### 4. Backend Concurrency & Memory Safety
- **Background Preload Thread De-duplication**:
  `litellm` requires multiple seconds to import due to extensive module loading. `pageindex/client.py` executes this once in a background daemon thread:
  ```python
  _litellm_preload_started = False
  def _preload_litellm() -> None:
      global _litellm_preload_started
      if _litellm_preload_started:
          return
      _litellm_preload_started = True
      threading.Thread(target=_import, daemon=True).start()
  ```
  *Hazard Avoided*: Spawning background imports per client instance would trigger GIL contention, thread exhaustion, and race conditions during simultaneous request processing.
- **File Path Injection & Segment Escaping**:
  In `pageindex/cloud_api.py`, every document ID and block ID is sanitized before insertion into request paths:
  ```python
  def _enc(value: str) -> str:
      return urllib.parse.quote(str(value), safe="")
  ```
  *Hazard Avoided*: Disallowing `/`, `?`, `#`, and spaces prevents Path Traversal and SSRF attacks against internal REST routing layers.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Cause Chain Unwrapping**:
  In `pageindex/errors.py`, `_pageindex_cause` recursively traverses `__cause__` attributes to extract root `PageIndexAPIError` instances wrapped by intermediate frameworks:
  ```python
  def _pageindex_cause(exc: BaseException | None) -> PageIndexAPIError | None:
      while exc is not None:
          if isinstance(exc, PageIndexAPIError):
              return exc
          exc = exc.__cause__
      return None
  ```
- **Safe Stream Termination on Partial Messages**:
  In `pageindex/chat_stream.py`, `MessagesStream.get_final_text()` raises an error with partial text attached if generation terminates unexpectedly:
  ```python
  if stop not in ("end_turn", "stop_sequence"):
      error = PageIndexAPIError(
          f"The final message is unfinished (stop_reason {stop!r}); "
          "get_final_message() returns it as it is.")
      error.partial_answer = "".join(texts)
      error.usage = message.get("usage")
      raise error
  ```

---

