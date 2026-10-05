# Project Learning Record — openai-agents-python (Full-Spectrum Harvest)

This document records the empirical project learnings, forensic bug investigations, and pattern extraction evidence derived from the **openai-agents-python** repository (`c:\Users\Admin\open ai SDK\openai-agents-python` — Official OpenAI Agents SDK for Python: Multi-turn Orchestration, Sessions, Compaction, Streaming, Realtime WebSockets, MCP Integration, Sandboxes, Tooling, and Tracing).

---

## 1. Executive Summary & Verification Coverage

* **Project**: `openai-agents-python` (Official OpenAI Agents SDK for Python)
* **Harvest Scope**: Full-Spectrum Multi-Dimensional Harvest across all 8 Dimensions (D1–D8).
* **Total Confirmed REAL INCIDENTS Analyzed**: 10 Production Bug Fixes + Architectural Invariants
* **Promoted Reusable Engineering Patterns**:
  * **Rule 16**: Non-Destructive Mutation Draining Across Cancellation Boundaries
  * **Rule 17**: Boundedness of Recovery & Rollback Operations
  * **Rule 18**: Bounded Backpressure Queuing with Event-Loop Yield Windows
  * **Rule 19**: Decoupled Consumer Termination on Transport Teardown
  * **Rule 20**: Resumed Capability Recipient Binding Across Human-in-the-Loop Boundaries
  * **Rule 21**: Default Generic Error Masking at Model and Telemetry Boundaries
  * **Rule 22**: Host-Path Containment and Trusted Construction in Declarative Manifests
  * **Rule 2 Refinement**: Pre-Allocation Dead-Owner Sweeping for Thread-Affined Handle Registries
* **Domain-Specific Patterns Retained in Learning Record**:
  * Multi-Step Turn Context Compaction Deferral (Agent Tool Loops)
  * Two-Pass Identity & Frequency Partitioning for Filtered Context
  * Pre-Upgrade WebSocket Disconnect Normalization (`InvalidMessage` EOF handling)
* **Excluded / Discarded Candidates**:
  * OpenAI Wire Protocol specifics (`responses.compact`, `previous_response_id`, `rs_...`, `conv_...`)
  * SDK-private internal flags (`_session_compaction_generation`, `_mutation_lock`)
  * Duplicate baseline JSON exception handling (already covered by Rule 5)

---

## 2. Forensic Incident & Learning Records

### Incident 1: Stale Compaction Response Chain on Session Clear (`BUG-SESS-01`)
* **Context**: `OpenAIResponsesCompactionSession` wrapping an underlying session store.
* **What Was Expected**: Calling `await session.clear_session()` clears all historical messages and resets conversation state so future turns start fresh.
* **What Actually Happened**: The underlying database was cleared, but the compaction decorator retained internal cached response identifiers (`_response_id`, `_deferred_response_id`, `_last_unstored_response_id`). On the subsequent turn, auto-compaction sent `previous_response_id="resp-old"` to the OpenAI Responses API, referencing a remote conversation chain that belonged to the cleared conversation, triggering 404s or resurrecting deleted context.
* **Evidence in Repo**:
  * Commit: `525cd20f` (PR [#5000](https://github.com/openai/openai-agents-python/pull/5000)) — `fix(sessions): reset compaction response chain on clear_session`
  * Source: `src/agents/memory/openai_responses_compaction_session.py#L748-L753`
  * Tests: `tests/memory/test_openai_responses_compaction_session.py#L459-L600` (`test_clear_session_invalidates_response_chain`, `test_run_compaction_auto_uses_input_after_clear`)
* **Root Cause**: Decorator state desynchronization. Clearing storage without resetting wrapper pointers leaves dangling references to external server-managed state.
* **Remediation**: Explicitly reset all response ID caches in `clear_session()` and `pop_item()`, and force `auto` compaction mode to fall back to clean `input` mode when the response chain is gone.
* **Lesson**: *State Invalidation Parity Across Wrapper Boundaries*. When clearing underlying storage, synchronously reset all wrapper-level remote continuation tokens and cached IDs.
* **Promotion Status**: Recorded as Core Pattern Refinement.

---

### Incident 2: File Descriptor Leak in Multi-Threaded SQLite Connection Tracking (`BUG-SESS-02`)
* **Context**: File-backed `SQLiteSession` accessed across worker threads or per-request event loops.
* **What Was Expected**: `SQLiteSession.close()` should cleanly release all SQLite connections opened across threads without leaking OS file descriptors.
* **What Actually Happened**: Connections were stored in `threading.local` and also registered in a process-level `_connections` set. In applications where worker threads were short-lived (e.g., worker pool, per-turn threads), when a worker thread exited, its thread-local slot died, but the global `_connections` set retained the open connection. Because the owning thread was dead, nothing could ever reuse or close that connection. Over time, open file handles accumulated until OS file descriptors were exhausted.
* **Evidence in Repo**:
  * Commit: `0b6fcd8e` (PR [#5090](https://github.com/openai/openai-agents-python/pull/5090)) — `fix(sessions): close SQLiteSession connections owned by exited worker threads`
  * Source: `src/agents/memory/sqlite_session.py#L178-L208`
  * Test: `tests/memory/test_session.py` (Concurrent thread barrier burst test)
* **Root Cause**: Strong references to thread-affine handles in a global collection outlive the owning OS thread.
* **Remediation**: Track the owning `threading.Thread` for every connection (`_connection_owners[conn]`). Before allocating a new connection, sweep and close all connections whose owners are no longer alive (`if not owner.is_alive(): conn.close()`).
* **Lesson**: *Pre-Allocation Dead-Owner Sweeping*. When tracking thread-affined resource handles globally, sweep and reap dead owners' handles before allocating new ones.
* **Promotion Decision**: Promoted as a refinement to **Rule 2** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 3: Unbounded Safety Snapshots Trigger Memory Exhaustion (`BUG-SESS-03`)
* **Context**: Rollback safety snapshots in `OpenAIResponsesCompactionSession` and TTL scans in `EncryptedSession`.
* **What Was Expected**: If history replacement or remote compaction fails, the session should restore previous history from an in-memory rollback snapshot.
* **What Actually Happened**: In large production sessions with tens of thousands of messages, fetching all history items into memory for the safety snapshot consumed massive memory and CPU, triggering out-of-memory (OOM) crashes and high latency during normal turns.
* **Evidence in Repo**:
  * Commit: `a2647577` (PR [#5137](https://github.com/openai/openai-agents-python/pull/5137)) — `fix(sessions): add an optional compaction rollback item budget`
  * Commit: `a2fdb946` (PR [#5118](https://github.com/openai/openai-agents-python/pull/5118)) — `feat(sessions): add an opt-in encrypted history scan budget`
  * Source: `src/agents/memory/openai_responses_compaction_session.py#L137-L146, L513-L523`
  * Tests: `tests/memory/test_session_limit.py`, `tests/extensions/memory/test_encrypt_session.py`
* **Root Cause**: The safety rollback mechanism itself was unconstrained and assumed history fits comfortably in RAM.
* **Remediation**: Added an explicit `max_rollback_items` / `max_scan_items` budget. If history exceeds this threshold, fail-fast with a deterministic `ValueError` before calling remote APIs or touching storage.
* **Lesson**: *Boundedness of Recovery Operations*. Safety rollback snapshots and recovery operations must have strict bounds; an unbounded recovery path will turn a transient failure into an availability crash.
* **Promotion Decision**: Promoted as **Rule 17** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 4: Double-Cancellation Task Shielding Breakdown (`BUG-SESS-04`)
* **Context**: Asynchronous database and storage mutations (`add_items`, `pop_item`, `clear_session`) under external task cancellation.
* **What Was Expected**: An external timeout or task cancellation (`task.cancel()`) must not leave a database commit or rollback half-executed.
* **What Actually Happened**: Standard `asyncio.shield(mutation)` is vulnerable to double-cancellation: if a second cancellation arrives while waiting on a shielded task, Python's event loop immediately aborts the awaiter while the inner task is still running in the background. The caller believes the operation aborted, but the thread later commits or leaves transactions hanging.
* **Evidence in Repo**:
  * Source: `src/agents/memory/session.py#L21-L40` (`_await_mutation`)
  * Tests: `tests/memory/test_session.py#L18-L49` (`test_await_mutation_cancellation_hides_later_failure_without_loop_error`)
* **Root Cause**: Cancellation propagation semantics in Python `asyncio` prioritize immediate task unwinding over worker thread settlement.
* **Remediation**: Built `_await_mutation`, a specialized draining loop that shields and repeatedly awaits the background worker task until `task.done()` is True, catching and suppressing premature cancellations until the transaction is settled, and re-raising cancellation only after the database state is clean.
* **Lesson**: *Non-Destructive Mutation Draining Across Cancellation Boundaries*. Critical storage mutations must drain to settlement regardless of caller cancellations.
* **Promotion Decision**: Promoted as **Rule 16** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 5: SQL Wildcard Collisions on Serialized JSON Data (`BUG-SESS-05`)
* **Context**: `AdvancedSQLiteSession.find_turns_by_content` searching conversation history.
* **What Was Expected**: Searching for literal user strings (e.g. `"50%"`, `"café"`, `"C:\notes"`) accurately identifies the correct turn and branch point.
* **What Actually Happened**: Executing SQL `LIKE ?` directly on the `message_data` JSON column caused SQL wildcards (`%`, `_`) to match arbitrary substrings (e.g. `"50%"` matched anything starting with `"50"`), and JSON-escaped unicode (e.g. `\u00e9` for `é`) failed to match or matched literal escape characters in unrelated messages, causing conversation branching from the wrong turn.
* **Evidence in Repo**:
  * Commit: `581863ae` (PR [#5143](https://github.com/openai/openai-agents-python/pull/5143)) — `fix(sessions): match literal Unicode content in AdvancedSQLiteSession`
  * Source: `src/agents/extensions/memory/advanced_sqlite_session.py#L1589-L1629`
  * Tests: `tests/extensions/memory/test_advanced_sqlite_session.py#L1912-L2020`
* **Root Cause**: Conflating SQL text search wildcards with serialized JSON string representations.
* **Remediation**: Two-stage search: escape SQL LIKE wildcards (`ESCAPE '\\'`) for coarse filtering, followed by strict Python regex verification on the *decoded* JSON data (including multimodal structured text parts).
* **Lesson**: *Two-Stage Literal Search on Serialized Columns*. Use SQL LIKE only as a coarse index filter; perform semantic matching on decoded objects.
* **Promotion Status**: Retained as specialized RDBMS/JSON guidance.

---

### Incident 6: Unbounded Backpressure & Deadlocks in Event-Loop Streaming Queues (`BUG-STREAM-01`)
* **Context**: `Agent.as_tool()` streaming callback handler (`on_stream`).
* **What Was Expected**: Streaming nested sub-agent events to an external consumer without blocking the parent execution or causing memory exhaustion.
* **What Actually Happened**: An unbounded `asyncio.Queue` consumed events faster than the user callback could process them, leading to runaway RAM bloat during large streaming generations. However, applying a naive synchronous queue cap (`maxsize`) caused false overflows or deadlocks because the producer and consumer shared the event loop, starving the callback of turns.
* **Evidence in Repo**:
  * Commit: `f23da767` (PR [#5106](https://github.com/openai/openai-agents-python/pull/5106)) — `fix(core): bound agent tool streaming callback backlogs`
  * Source: `src/agents/agent.py#L607-L646, L918-L1010`
  * Tests: `tests/test_agent_as_tool.py#L472-L578`, `tests/test_asyncio_tasks.py`
* **Root Cause**: Decoupled producer-consumer pipelines on cooperative single-threaded event loops require cooperative yield windows to prevent spurious capacity exhaustion.
* **Remediation**: Bounded queue with backlog check and explicit event-loop turn yield (`await asyncio.sleep(0)`). If backlog remains exceeded after yield, fail-fast with `_AgentToolStreamOverflow`. When aborted, immediately cancel upstream task and close async generator (`await stream_events.aclose()`), ensuring generator disposal exceptions do not mask the primary overflow error.
* **Lesson**: *Bounded Backpressure Queuing with Event-Loop Yield Windows*.
* **Promotion Decision**: Promoted as **Rule 18** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 7: Capability Binding Confusion & Hijacking Across Resumed Turn Approvals (`BUG-MCP-01`)
* **Context**: Human-in-the-Loop (HITL) approval workflows for MCP (Model Context Protocol) tool execution.
* **What Was Expected**: Pausing a turn for human approval of a tool call and resuming it later executes the exact action approved on the designated MCP server.
* **What Actually Happened**: Approvals were serialized with only generic call and function names. Upon resumption, if the active agent's tool set was reordered or reconfigured, the approved tool call could be bound to a completely different MCP server, a local function tool, or even a handoff, authorizing unvetted external actions.
* **Evidence in Repo**:
  * Commit: `bd91ae65` (PR [#5119](https://github.com/openai/openai-agents-python/pull/5119)) — `fix(mcp): bind resumed MCP calls to their original recipients`
  * Source: `src/agents/run_internal/turn_resolution.py#L1225-L1260, L2161-L2210`
  * Tests: `tests/mcp/test_mcp_resume_binding.py#L1-L676`
* **Root Cause**: Deserialization did not enforce structural binding between human approval records and the target execution recipient.
* **Remediation**: Explicitly record `mcp_tool_bindings` and `tool_origin` during interruption. On resume, verify recipient identity parity before executing; raise `UserError` immediately if the recipient differs.
* **Lesson**: *Resumed Capability Recipient Binding Across Human-in-the-Loop Boundaries*.
* **Promotion Decision**: Promoted as **Rule 20** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 8: Stranded Consumer Iterators During Stalled Transport Teardown (`BUG-REALTIME-01`)
* **Context**: `RealtimeSession` duplex streaming events over WebSockets.
* **What Was Expected**: Calling `await session.close()` shuts down the session and terminates consumer iterators cleanly.
* **What Actually Happened**: Event iterator loops waited for `self._closed`, which only became True after transport cleanup completed. If the network socket hung, encountered a slow TCP handshake, or errored during transport teardown, consumer iteration was stranded indefinitely. Additionally, single-item sentinels left other concurrent readers waiting.
* **Evidence in Repo**:
  * Commit: `f9108bd9` (PR [#5172](https://github.com/openai/openai-agents-python/pull/5172)) — `fix(realtime): end event iteration when session close starts`
  * Commit: `a34b3964` (PR [#5069](https://github.com/openai/openai-agents-python/pull/5069)) — `fix(realtime): reset per-connection state on close`
  * Source: `src/agents/realtime/session.py#L315-L370`, `src/agents/realtime/openai_realtime.py#L1257-L1315`
  * Tests: `tests/realtime/test_session_close_iteration.py#L1-L140`
* **Root Cause**: Coupling consumer iterator exit conditions directly to physical network transport teardown.
* **Remediation**: Mark `self._closing = True` immediately upon close initiation, wake all iterator consumers, and republish the exit sentinel (`_REALTIME_SESSION_CLOSED_SENTINEL`) across all waiting readers. Teardown transport asynchronously without blocking consumers.
* **Lesson**: *Decoupled Consumer Termination on Transport Teardown*.
* **Promotion Decision**: Promoted as **Rule 19** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 9: Secret & Credential Exfiltration via Unredacted Tool Failure Messages (`BUG-SEC-01`)
* **Context**: Tool exception handling in `AgentRunner` and default tool failure responses.
* **What Was Expected**: If an internal database tool or API integration failed, the model was informed that an error occurred.
* **What Actually Happened**: The default error function returned `f"An error occurred while running the tool. Please try again. Error: {str(error)}"`. When database queries or network requests failed, `str(error)` routinely contained database connection strings with plaintext passwords, internal API authorization headers, server IP addresses, or database table schema dumps, which were fed directly into the model context and exported in public telemetry traces.
* **Evidence in Repo**:
  * Commit: `40956e04` (PR [#5112](https://github.com/openai/openai-agents-python/pull/5112)) — `fix(core): redact default tool failure details`
  * Commit: `c329e92f` (PR [#5121](https://github.com/openai/openai-agents-python/pull/5121)) — `fix(core): redact streaming task exception tracebacks`
  * Commit: `a58d03cb` (PR [#5132](https://github.com/openai/openai-agents-python/pull/5132)) — `fix(realtime): redact exception details from Realtime tool error events`
  * Source: `src/agents/tool.py#L1890-L1975`, `src/agents/run.py`
  * Tests: `tests/test_default_tool_error_redaction.py`, `tests/test_error_logging_redaction.py`
* **Root Cause**: Unvetted stringification of internal exception objects across untrusted model and telemetry trust boundaries.
* **Remediation**: Replace default tool error output with a static generic string: `"An error occurred while running the tool. Please try again."`. Exception details are strictly redacted unless `trace_include_sensitive_data` is affirmatively configured.
* **Lesson**: *Default Generic Error Masking at Model and Telemetry Boundaries*.
* **Promotion Decision**: Promoted as **Rule 21** in `05_KNOWLEDGE/engineering-patterns.md`.

---

### Incident 10: Host Filesystem Traversal via Untrusted Manifest Deserialization (`BUG-SEC-02`)
* **Context**: Sandbox environment manifests (`Manifest`, Docker sandboxes).
* **What Was Expected**: Manifests describe files, directories, and container configurations for code execution.
* **What Actually Happened**: Sandbox manifests coerced from plain dictionary payloads (e.g. from tool arguments or external APIs) could specify `LocalDir(src="/...")` or `LocalFile(src="/etc/passwd")`, permitting rogue models or external payloads to mount host directories and exfiltrate secrets.
* **Evidence in Repo**:
  * Commit: `a4fe85c4` (PR [#5100](https://github.com/openai/openai-agents-python/pull/5100)) — `fix(sandbox): reject host sources in dictionary sandbox manifests`
  * Commit: `91f5cfd1` (PR [#5099](https://github.com/openai/openai-agents-python/pull/5099)) — `fix(sandbox): validate host grants against normalized workspace roots`
  * Source: `src/agents/sandbox/manifest.py#L604-L616`, `src/agents/sandbox/sandboxes/docker.py`
  * Tests: `tests/sandbox/test_manifest_config.py`, `tests/sandbox/test_docker.py`
* **Root Cause**: Treating untrusted serialized data as authority to configure host filesystem mounts.
* **Remediation**: Explicitly reject local host sources (`LocalDir(src=...)`, `LocalFile`) when deserializing dictionary manifests. Require host bindings to be constructed programmatically via trusted code, and validate workspace paths against normalized canonical root paths.
* **Lesson**: *Host-Path Containment and Trusted Construction in Declarative Manifests*.
* **Promotion Decision**: Promoted as **Rule 22** in `05_KNOWLEDGE/engineering-patterns.md`.

---

## 3. Promoted Engineering Patterns Mapping

| Pattern Number | Engineering Pattern Name | Primary Destination |
|---|---|---|
| **Rule 16** | **Non-Destructive Mutation Draining Across Cancellation Boundaries** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 17** | **Boundedness of Recovery & Rollback Operations** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 18** | **Bounded Backpressure Queuing with Event-Loop Yield Windows** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 19** | **Decoupled Consumer Termination on Transport Teardown** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 20** | **Resumed Capability Recipient Binding Across Human-in-the-Loop Boundaries** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 21** | **Default Generic Error Masking at Model and Telemetry Boundaries** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 22** | **Host-Path Containment and Trusted Construction in Declarative Manifests** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Refinement to Rule 2** | **Pre-Allocation Dead-Owner Sweeping for Thread-Affined Handle Registries** | `05_KNOWLEDGE/engineering-patterns.md` |

---

## 4. Multi-Dimensional Investigation Summary (D1–D8)

* **D1 (Architecture & Boundaries)**: Sub-agent execution isolation (`ad93f542`, `46cc8d8d`) verified that hierarchical agents require distinct runtime state scopes and local root anchoring to prevent state cross-contamination.
* **D2 (Asynchronous State & Concurrency)**: Bounded queuing (`f23da767`) proved that single-threaded cooperative event loops require non-zero yield windows to prevent spurious backpressure rejections.
* **D3 (Error Boundaries & Recovery)**: Shared transport taskgroups (`29aa40bf`) must isolate request-level transient HTTP 5xx errors from connection-level teardowns.
* **D4 (Resource Lifecycle & Cleanup)**: Decoupled closure (`f9108bd9`) proved that logical consumer termination must not depend on physical transport teardown completion.
* **D5 (Deserialization & Encoding Boundaries)**: HITL approvals (`bd91ae65`) require strict recipient binding to prevent capability substitution on resume.
* **D6 (Cross-Platform & Runtime Gotchas)**: WebSocket handshake disconnects (`265f16fa`) wrap `EOFError` inside `InvalidMessage` before HTTP 101, requiring special classification for automatic retry.
* **D7 (Build, CI/CD, Deployment & Tooling)**: API backwards-compatibility rules enforce append-only positional dataclass arguments.
* **D8 (Forensic Bug Fixes & Security Boundaries)**: Error masking (`40956e04`) and sandbox manifest containment (`a4fe85c4`) established that model responses and deserialized manifests are untrusted data boundaries.
