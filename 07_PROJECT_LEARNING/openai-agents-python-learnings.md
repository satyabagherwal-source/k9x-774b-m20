# Project Learning Record — openai-agents-python (Sessions & Memory)

This document records the empirical project learnings, forensic bug investigations, and pattern extraction evidence derived from the **openai-agents-python** repository (`c:\Users\Admin\open ai SDK\openai-agents-python` — Python Agents SDK, Sessions, Compaction, Memory, Multi-turn Concurrency).

---

## 1. Executive Summary & Verification Coverage

* **Project**: `openai-agents-python` (Official OpenAI Agents SDK for Python)
* **Domain / Subsystem**: Sessions & Memory (`src/agents/memory/`, `src/agents/extensions/memory/`, `src/agents/run_internal/session_persistence.py`)
* **Total Confirmed REAL INCIDENTS Analyzed**: 5 Production Bug Fixes + 3 Architectural Invariants
* **Promoted Reusable Engineering Patterns**:
  * **Rule 16**: Non-Destructive Mutation Draining Across Cancellation Boundaries
  * **Rule 17**: Boundedness of Recovery & Rollback Operations
  * **Rule 2 Refinement**: Pre-Allocation Dead-Owner Sweeping for Thread-Affined Handle Registries
* **Domain-Specific Patterns Retained in Learning Record**:
  * Multi-Step Turn Context Compaction Deferral (Agent Tool Loops)
  * Two-Pass Identity & Frequency Partitioning for Filtered Context
* **Excluded / Discarded Candidates**:
  * OpenAI Wire Protocol specifics (`responses.compact`, `previous_response_id`, `rs_...`, `conv_...`)
  * SDK-private flags (`_session_compaction_generation`, `_mutation_lock`)
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

## 3. Promoted Engineering Patterns Mapping

| Pattern Number | Engineering Pattern Name | Primary Destination |
|---|---|---|
| **Rule 16** | **Non-Destructive Mutation Draining Across Cancellation Boundaries** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Rule 17** | **Boundedness of Recovery & Rollback Operations** | `05_KNOWLEDGE/engineering-patterns.md` |
| **Refinement to Rule 2** | **Pre-Allocation Dead-Owner Sweeping for Thread-Affined Handle Registries** | `05_KNOWLEDGE/engineering-patterns.md` |
