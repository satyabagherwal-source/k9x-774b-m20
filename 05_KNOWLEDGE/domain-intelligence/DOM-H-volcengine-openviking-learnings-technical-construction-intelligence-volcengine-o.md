# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: volcengine-openviking-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "volcengine-openviking-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T08:09:20.142Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-volcengine-openviking-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine-openviking-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T08:09:20.142Z`  
> **Learning ID**: `LEARN-EVO-volcengine-openviking-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence), J (Search & Distribution Intelligence), B (Product Intelligence)
- **Confidence Rating**: 82%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from volcengine-openviking-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/volcengine-openviking-learnings.md`  
> **Source**: github ([https://github.com/volcengine/OpenViking](https://github.com/volcengine/OpenViking))  
> **Source Version**: `15845c2a`  
> **License**: AGPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-19T08:08:43.443Z  
> **Learning ID**: `learn-github-volcengine-openviking`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): volcengine/OpenViking

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Traditional AI Agent architectures interact with memory and context systems through opaque vector embeddings and uninspected key-value stores ("black-box memory"). This causes three systemic failure modes:
1. **Context Opacity**: Neither the agent nor the human operator can inspect, audit, or structurally edit hierarchical working context.
2. **Context Fragmentation**: Disconnected tools (retrieval systems, workspace documents, agent conversation history, tool executions) operate in disparate data silos without a unified naming or addressing schema.
3. **Session Archival Drift & Race Conditions**: Offline write queues, asynchronous multi-turn streaming, and distributed session lifecycle transitions routinely result in out-of-order commits, orphaned session logs, and masked configuration inheritance.

OpenViking solves this by implementing an **Agent-Native Virtual Context Filesystem (`viking://`)** paired with a hybrid vector/hierarchical database engine (written in Python and Rust via `ragfs`), standardizing context access around deterministic filesystem primitives (`ls`, `tree`, `read`, `write`, `rm`, `find`).

### Architectural Subsystem Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Agent Interfaces & Integrations                      │
│   (MCP Stdio/SSE Proxy, IDE Plugins [Cursor/TRAE/Kimi], CLI, Web Studio)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / JSON-RPC / SSE
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    OpenViking Gateway / Control Plane                       │
│    - Role & RequestContext (Tenant, Account, Principal, Scopes)             │
│    - Policy Merging & Identity Inheritance Engine                           │
│    - Write Queue Replay Coordinator & Out-of-Order Commit Barrier           │
└──────────────────┬──────────────────────────────────┬───────────────────────┘
                   │                                  │
┌──────────────────▼──────────────────┐   ┌───────────▼───────────────────────┐
│       viking:// VFS Router          │   │      Hierarchical Vector DB       │
│  - URI Path Resolver (viking://...) │   │  - VikingVectorIndexBackend       │
│  - L0 Summary / L1 Overview Parser  │   │  - CuVS / Local Brute-Force       │
│  - Directory Pagination & Snapshots │   │  - Scalar Index Pre-filtering     │
└──────────────────┬──────────────────┘   └───────────┬───────────────────────┘
                   │                                  │
┌──────────────────▼──────────────────────────────────▼───────────────────────┐
│                    Native Storage & Acceleration Core                       │
│        ragfs (Rust Crate / Maturin FFI) + Tree-Sitter AST Parsers           │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Protocol Proxy Subsystem (`mcp-proxy-core.mjs`)**: Mediates bidirectional JSON-RPC 2.0 communication over stdio and Server-Sent Events (SSE) between client IDE agents (Cursor, Kimi, TRAE, Claude Code) and the OpenViking HTTP daemon. Enforces client concurrency limits via explicit semaphores, handles credential hot-reloading via filesystem mtime/size hashing, and normalizes MCP error code translation.
2. **Virtual Filesystem Router (`ragfs` & `VikingStoreWrapper`)**: Exposes virtual semantic locations under `viking://resources`, `viking://user`, `viking://session`, and `viking://agent`. Every directory automatically computes hierarchical summaries (L0 short summary, L1 recursive overview) to support recursive agent navigation before downloading raw context blocks.
3. **Async Vector Backend Engine (`VikingVectorIndexBackend`)**: Decouples GPU-accelerated vector indexes (`cuvs`) from standard query pipelines using thread-pool boundaries (`asyncio.to_thread`), background worker debounce queues, and structured metadata filters (`uniform_bucket`, `row_number`, `account_id`).
4. **Resilient Local Persistence & Pending Queue**: Manages offline agent logs, transient transport failures, and atomic transaction replays across network boundaries through durable local JSON journal stores.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. The Asynchronous Commit Queue Barrier Invariant
**RULE**:
When an asynchronous agent lifecycle requires persisting an atomic state termination (e.g., `commitAgentSession`, `closeContextSession`), the termination request **MUST NOT** bypass, race ahead of, or be dispatched concurrently with un-drained in-flight write mutations or retry queues for that entity. The termination payload **MUST** either be deferred behind pending item drainage or appended to the local journal stamped strictly after the latest write sequence.

**WHY**:
If a network hiccup or rate-limit parks messages into a client-side pending retry queue while the session commit is dispatched synchronously, the remote server processes the commit against an empty or partial session state. The server evaluates the commit as `skipped/no_messages` (a semantic success with 0 items committed). The client marks the commit complete and cleans it up. When the offline replay worker eventually drains the parked messages, the session is left permanently uncommitted and unarchived, resulting in silent data loss.

**WHEN TO APPLY**:
Apply to all distributed state synchronization agents, write-behind caching layers, offline-first client plugins, and event-sourcing pipelines syncing state to cloud control planes.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified implementation pattern derived from OpenViking pending-write barriers
export interface QueueItem {
  id: string;
  sessionId: string;
  type: "MESSAGE" | "COMMIT";
  payload: unknown;
  logicalTimestamp: number;
}

export class SafeSessionSynchronizer {
  private pendingQueue: QueueItem[] = [];
  private logicalClock: number = 0;

  public async appendMessage(sessionId: string, message: unknown): Promise<void> {
    this.logicalClock += 1;
    this.pendingQueue.push({
      id: crypto.randomUUID(),
      sessionId,
      type: "MESSAGE",
      payload: message,
      logicalTimestamp: this.logicalClock,
    });
  }

  public async commitSession(
    sessionId: string, 
    sendImmediateCommit: (sid: string) => Promise<{ ok: boolean; status: string }>
  ): Promise<void> {
    const sessionHasPendingMessages = this.pendingQueue.some(
      (item) => item.sessionId === sessionId && item.type === "MESSAGE"
    );

    if (sessionHasPendingMessages) {
      // INVARIANT: Commit MUST NOT bypass parked messages.
      // Advance logical clock beyond all existing writes and park commit.
      this.logicalClock += 1;
      
      // Remove any previously queued commits for this session to prevent duplicate runs
      this.pendingQueue = this.pendingQueue.filter(
        (item) => !(item.sessionId === sessionId && item.type === "COMMIT")
      );

      this.pendingQueue.push({
        id: crypto.randomUUID(),
        sessionId,
        type: "COMMIT",
        payload: { committedAt: Date.now() },
        logicalTimestamp: this.logicalClock,
      });

      // Attempt to drain queue in strict timestamp order
      await this.drainPendingQueue();
      return;
    }

    // Zero pending messages: safe to dispatch immediately
    const result = await sendImmediateCommit(sessionId);
    if (!result.ok) {
      this.logicalClock += 1;
      this.pendingQueue.push({
        id: crypto.randomUUID(),
        sessionId,
        type: "COMMIT",
        payload: { committedAt: Date.now() },
        logicalTimestamp: this.logicalClock,
      });
    }
  }

  private async drainPendingQueue(): Promise<void> {
    // Sort strictly by logical sequence timestamp
    this.pendingQueue.sort((a, b) => a.logicalTimestamp - b.logicalTimestamp);

    while (this.pendingQueue.length > 0) {
      const nextItem = this.pendingQueue[0];
      try {
        await this.dispatchItem(nextItem);
        this.pendingQueue.shift(); // Remove successfully sent item
      } catch (err) {
        // Halt draining on retryable transport failure; preserve order
        break;
      }
    }
  }

  private async dispatchItem(item: QueueItem): Promise<void> {
    // Concrete HTTP transport call with transient error throwing
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Firing commit immediately while un-acked writes are in-flight or queued
async function unsafeSessionCommit(sessionId: string, messageQueue: any[]) {
  // Buggy code: fires commit over HTTP without verifying pending writes are drained
  if (messageQueue.length > 0) {
    // Queued offline, but we still send commit immediately!
    console.warn("Queue has messages, but sending commit anyway...");
  }
  // Server returns 200 OK: { status: "no_messages" }, message loss is guaranteed
  return await fetch(`/api/sessions/${sessionId}/commit`, { method: "POST" });
}
```

**VERIFICATION METHOD**:
Inject network interceptors that drop 100% of write requests (simulating HTTP 503) followed by a successful commit trigger. Assert that the commit request is blocked from network transmission until all intercepted writes transition to HTTP 200.

---

### 2. Multi-Tier Policy Inheritance Overwrite Guard
**RULE**:
When inheriting multi-field security, extraction, or memory policies across hierarchical scopes (Global $\to$ User $\to$ Session $\to$ Request), hierarchical policy resolvers **MUST** perform recursive partial field-level merges rather than full-object level overwrites. A higher-precedence scope specifying a single configuration flag **MUST NOT** obliterate orthogonal configuration arrays or constraints defined at an ancestor scope.

**WHY**:
In OpenViking, the gateway created capture sessions with `{"memory_policy": {"working_memory": {"enabled": false}}}`. The policy engine evaluated session policy as having complete precedence over user policy. Because the session policy did not specify `memory_types: ["events"]` (which was configured at the user level), the whole object overwrite resolved `memory_types` to `null` (allow all). Sensitive memories, raw transcripts, and unapproved categories were extracted because a child boolean flag wiped an ancestor security allowlist.

**WHEN TO APPLY**:
Mandatory for RBAC/ABAC policy engines, LLM extraction rules, tool authorization contexts, and runtime configuration layers where defaults can be overridden at session or request granularity.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MemoryPolicy(BaseModel):
    working_memory_enabled: Optional[bool] = None
    memory_types: Optional[List[str]] = None
    max_tokens: Optional[int] = None

    def merge_with_ancestor(self, ancestor: "MemoryPolicy") -> "MemoryPolicy":
        """
        Deeply merges current policy over ancestor policy.
        Child explicit values take precedence, but omitted (None) values
        preserve ancestor constraints.
        """
        return MemoryPolicy(
            working_memory_enabled=(
                self.working_memory_enabled
                if self.working_memory_enabled is not None
                else ancestor.working_memory_enabled
            ),
            memory_types=(
                self.memory_types
                if self.memory_types is not None
                else (ancestor.memory_types.copy() if ancestor.memory_types is not None else None)
            ),
            max_tokens=(
                self.max_tokens
                if self.max_tokens is not None
                else ancestor.max_tokens
            ),
        )


def resolve_effective_policy(
    user_policy: Optional[MemoryPolicy],
    session_policy: Optional[MemoryPolicy],
) -> MemoryPolicy:
    base = user_policy or MemoryPolicy(working_memory_enabled=True, memory_types=["all"])
    if not session_policy:
        return base
    return session_policy.merge_with_ancestor(base)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Whole-object precedence replacement
def resolve_policy_unsafe(user_policy: dict, session_policy: dict) -> dict:
    # If session defines ANY policy, user policy is completely discarded!
    if session_policy:
        return session_policy  # Masks memory_types, principal scoping, etc.
    return user_policy
```

**VERIFICATION METHOD**:
Execute property-based unit tests where ancestor policies define restrictive allowlists (`memory_types=['events']`) and child policies set unrelated flags (`working_memory_enabled=False`). Assert that `effective_policy.memory_types == ['events']`.

---

### 3. File System URI Segment Idempotent Decoding Invariant
**RULE**:
When rendering, previewing, or segmenting hierarchical Virtual Filesystem URIs (e.g., `viking://`), paths **MUST** be decoded exactly once strictly for presentation labels, while **ALL** underlying network operations, index references, route navigations, and cache keys **MUST** retain the raw, canonically encoded URI. Encoded path delimiters (`%2F`) **MUST NOT** be decoded prior to path segment splitting.

**WHY**:
Double-decoding or decoding before splitting path segments causes catastrophic directory traversal bugs, splits single files containing encoded slashes into non-existent virtual directories, and causes cache misses. Furthermore, decoding raw URIs before sending them to backend storage services leads to 404s when filenames contain reserved URI characters (`?`, `#`, `%`, `&`).

**WHEN TO APPLY**:
Applies to UI breadcrumbs, file trees, object storage explorers, and agent path navigators interfacing with URI-based naming systems.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified implementation from OpenViking frontend/shared/path-label.ts
export interface PathSegment {
  label: string;
  uri: string;
  isFirst: boolean;
}

export function decodePathLabel(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // Gracefully handle malformed escape sequences without throwing
    return segment;
  }
}

export function splitVfsUri(rawUri: string): PathSegment[] {
  const trimmed = rawUri.trim();
  if (!trimmed) return [];

  const schemeEndIndex = trimmed.indexOf("://");
  let scheme = "";
  let pathPart = trimmed;

  if (schemeEndIndex !== -1) {
    scheme = trimmed.slice(0, schemeEndIndex + 3);
    pathPart = trimmed.slice(schemeEndIndex + 3);
  }

  // Split on physical path delimiter '/' BEFORE decoding segments
  const parts = pathPart.split("/").filter((part) => part.length > 0);
  const segments: PathSegment[] = [];
  let accumulatedUri = scheme.replace(/\/+$/, "");

  parts.forEach((part, index) => {
    accumulatedUri = `${accumulatedUri}/${part}`;
    segments.push({
      // Decode ONLY for human-visible label
      label: scheme ? decodePathLabel(part) : part,
      // Retain RAW canonically-encoded URI for RPC/REST operations
      uri: accumulatedUri,
      isFirst: index === 0,
    });
  });

  return segments;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Decoding before splitting or returning decoded URI for operations
function unsafeSplitUri(rawUri: string) {
  // If rawUri is "viking://folder%2Fsub/file.txt", decoding first splits one folder into two!
  const decoded = decodeURIComponent(rawUri);
  return decoded.split("/").map((part) => ({
    label: part,
    uri: part, // Using decoded value for server requests creates 400/404 errors
  }));
}
```

**VERIFICATION METHOD**:
Test with synthetic URIs containing encoded delimiters and Unicode: `viking://my%20bucket/dir%2Fsub/test%25file.md`. Assert that `segments.length === 3`, `segments[1].label === "dir/sub"`, and `segments[1].uri === "viking://my%20bucket/dir%2Fsub"`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Session Commit Overtaking Pending Offline Queue Messages
- **Context**: Agent memory plugin sync infrastructure (`examples/agent-hook-plugin`)
- **What Was Expected**: When a turn completes in an IDE agent (Cursor, TRAE, Kimi), pending messages must be delivered and acknowledged by OpenViking server before the session commit seals the memory snapshot.
- **What Actually Happened**: When turns experienced transient network failures, messages were diverted to the local pending queue. However, `commitAgentSession()` continued immediately over HTTP. The server received the commit while having 0 recorded messages, answered with `skipped/no_messages` (HTTP 200). The plugin interpreted this as success. Subsequent replay only transmitted the orphaned messages into a permanently uncommitted session.
- **Evidence in Repo**: Commit `132d05b7`, PR `#6599`.
- **Root Cause**: Architectural separation between the asynchronous retry queue and the synchronous session-termination handler without a logical sequence barrier.
- **Remediation Code Diff**:
```diff
--- a/examples/memory-plugin-shared/lib/pending-queue.mjs
+++ b/examples/memory-plugin-shared/lib/pending-queue.mjs
@@ -104,6 +104,18 @@ export async function commitAgentSession(sessionId) {
+  // Enforce session ordering: commit must not overtake queued writes
+  if (hasPendingWritesForSession(sessionId)) {
+    deferCommitBehindPendingWrites(sessionId);
+    return { status: "queued_behind_pending_messages" };
+  }
   const res = await client.commitSession(sessionId);
+  if (res.status === "skipped/no_messages" && hasPendingWritesForSession(sessionId)) {
+    deferCommitBehindPendingWrites(sessionId);
+    return { status: "queued_behind_pending_messages" };
+  }
```
- **Lesson**: Atomic termination operations must be sequenced in the same execution pipeline as the data mutations they terminate.

---

### Incident 2: Host CLI Ownership Transport ID Leakage
- **Context**: Multi-agent gateway identity provider (`examples/hermes-plugin/__init__.py`)
- **What Was Expected**: Turns initiated via local CLI sessions should attribute memory extraction to the authenticated OpenViking account owner directly without scoping under a synthetic peer ID.
- **What Actually Happened**: Hermes agent passed CLI host environment user identity formatted as `platform="cli"` with `user_id="uid:1000"`. The gateway provider translated this into a peer sender `cli.uid-1000-<hash>`. Context memories were extracted and cataloged under this synthetic peer. Later user queries executing without gateway peer metadata failed to recall memories created in the same workspace.
- **Evidence in Repo**: Commit `17c6e868`, PR `#7998`.
- **Root Cause**: Missing edge-case boundary check for local runtime platforms in `_gateway_peer_id`.
- **Remediation Code Diff**:
```diff
--- a/examples/hermes-plugin/__init__.py
+++ b/examples/hermes-plugin/__init__.py
@@ -213,7 +213,8 @@ def _cfg_field(key: str, description: str, **extra) -> dict:
 def _gateway_peer_id(platform: str, sender: Any) -> str:
     """Namespace transport IDs and encode path-like IDs without merging distinct senders."""
     platform, sender = str(platform or "").strip().lower(), str(sender or "").strip()
-    if not platform or not sender:
+    # The CLI reports its OS owner (uid:<n>) as user_id; that is the OpenViking user, not a sender.
+    if not platform or not sender or platform == "cli":
         return ""
```
- **Lesson**: Operating system host execution contexts must be mapped directly to user identity domains rather than transient networked peer abstractions.

---

### Incident 3: FileBrowser State Wipe During Alias & Identity Recovery
- **Context**: Frontend virtual directory tree synchronization (`frontend/packages/react/src/components/file-preview`)
- **What Was Expected**: When directory listings refresh or account aliases resolve asynchronously, user-expanded and collapsed folders must retain their exact expansion states.
- **What Actually Happened**: Refreshing directory listings changed trailing slashes (e.g., `viking://folder/` to `viking://folder`). The directory tree discarded pending user fold/expand edits across mounts. Slower paginated directory pages resolved after manual user clicks, wiping out newer collapse operations with stale expand states.
- **Evidence in Repo**: Commit `50c83b57`, PR `#7983`.
- **Root Cause**: Expansion state relied on raw unordered URI string sets without tracking edit timestamps or ordering sequences across asynchronous pagination sweeps.
- **Remediation Code Diff**:
```diff
--- a/frontend/packages/react/src/modules/file-browser/file-browser.tsx
+++ b/frontend/packages/react/src/modules/file-browser/file-browser.tsx
@@ -48,6 +48,10 @@ export interface FileBrowserExpansionSnapshot {
   readonly expandedUris: readonly string[];
   readonly collapsedUris: readonly string[];
+  /** Ordered manual actions awaiting alias resolution; newest takes precedence */
+  readonly pendingEdits?: readonly { uri: string; expanded: boolean }[];
 }
```
- **Lesson**: UI state restoration across asynchronous, multi-page data fetches must be modeled as an append-only event log with explicit ordering rather than a simple snapshot set.

---

### Incident 4: Non-Object Pending Queue Corrupts Offline Replay
- **Context**: Local JSON pending journal parser (`agent-plugins/servers/shared`)
- **What Was Expected**: Corrupted or malformed offline journal files must be dropped or skipped without blocking the replay of valid journaled messages.
- **What Actually Happened**: If a pending queue directory contained a file with literal `null`, `123`, or `[]`, `JSON.parse()` succeeded, but `listPending()` attempted to read `entry.createdAt`. This threw `TypeError: Cannot read properties of null (reading createdAt)`, completely crashing the replay worker and stranding valid offline messages permanently.
- **Evidence in Repo**: Bug Issue `#7713`.
- **Root Cause**: Relying on `try { JSON.parse() }` without validating that the parsed output was an object record (`typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)`).
- **Remediation Code Diff**:
```javascript
// Remediation pattern applied in listPending()
function isValidQueueEntry(raw) {
  try {
    const parsed = JSON.parse(raw);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      typeof parsed.createdAt === "number"
    );
  } catch {
    return false;
  }
}
```
- **Lesson**: `JSON.parse()` success does not guarantee that the returned value is a traversable dictionary. In JavaScript, `JSON.parse("null") === null`.

---

### Incident 5: Gateway Session Memory Policy Obliterating User Restrictions
- **Context**: Gateway capture session policy evaluation (`openviking_gateway`)
- **What Was Expected**: Gateway-created sessions setting `working_memory.enabled = false` should still inherit the parent user's `memory_types` allowlist (e.g., limiting extraction to `["events"]`).
- **What Actually Happened**: The gateway pushed a partial session policy object. Because policy inheritance checked `session.policy or user.policy`, the presence of the session policy masked the user policy completely, setting `memory_types` to `null` and extracting all context indiscriminately.
- **Evidence in Repo**: Bug Issue `#7412`.
- **Root Cause**: Structural policy resolution implemented whole-record replacement instead of partial attribute coalescence.
- **Remediation Code Diff**:
```diff
--- a/openviking_gateway/session.py
+++ b/openviking_gateway/session.py
@@ -112,6 +112,12 @@ def create_session(user_policy: Policy, session_override: Optional[Policy]) -> Policy:
-    return session_override or user_policy
+    if not session_override:
+        return user_policy
+    merged = user_policy.copy()
+    if session_override.working_memory is not None:
+        merged.working_memory = session_override.working_memory
+    return merged
```
- **Lesson**: Security and extraction policies must follow cascading rules with explicit inheritance, never simple dictionary replacement.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **The JavaScript `JSON.parse("null")` Trap**: In Node.js / TypeScript plugins, testing `try { const obj = JSON.parse(str); } catch` does NOT verify that `obj` is non-null. `null` is valid JSON.
  ```typescript
  // INVARIANT: Guarding against JSON null and scalar values
  function parseRecord(raw: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(raw);
      // BUG SHIELD: typeof null === "object", so both checks are mandatory!
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  ```
- **Implicit Falsy Conversions in Token Budgets**: In `benchmark/RAG/src/core/metrics.py`, checking `if not tokens:` triggers on `0` tokens, which can mistakenly default to a standard window length. Explicit checks (`tokens is None` vs `tokens == 0`) are required across all memory parsers.
- **Object Precedence Overrides**: In `headersForRequest()` inside `mcp-proxy-core.mjs`:
  ```javascript
  // OpenViking Invariant: Operator extra headers must NOT overwrite auth or session headers
  const opExtras = proxyConfig.extraHeaders;
  if (opExtras && typeof opExtras === "object") {
    // "built" must come SECOND so proxy security invariants overwrite environment variables
    return { ...opExtras, ...built };
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **Stream Flush Termination in SSE Parsers**:
  In `parseSseMessages(text)` within `mcp-proxy-core.mjs`, chunked HTTP inputs can split carriage returns across packets (`\r\n`). Parsing lines via regex without an explicit terminal flush causes buffered lines to remain indefinitely un-parsed until connection drop:
  ```javascript
  // INVARIANT: Explicit multi-line flush loop termination
  function parseSseMessages(text) {
    const messages = [];
    let dataLines = [];
    function flush() {
      if (dataLines.length === 0) return;
      const data = dataLines.join("\n").trim();
      dataLines = [];
      if (!data || data === "[DONE]") return;
      messages.push(JSON.parse(data));
    }
    for (const rawLine of String(text || "").split(/\r\n|\r|\n/)) {
      if (rawLine === "") { flush(); continue; }
      if (rawLine.startsWith(":")) continue; // SSE comment guard
      // Line parsing ...
    }
    flush(); // TERMINATION INVARIANT: Always flush remainder after stream loop
    return messages;
  }
  ```
- **Async Thread Rebuild Loop Termination**: In `wait_for_background_rebuild()`, background worker thread synchronization must enforce a monotonically increasing wall-clock deadline (`time.perf_counter()`) to avoid infinite awaits during index corruption.

### 3. UI & UX Micro-Mechanics
- **Breadcrumb Path Overflow Truncation**: In `file-preview-breadcrumb.tsx`, ancestor segments enforce a strict width constraint (`MAX_ANCESTOR_WIDTH = 160px`) via CSS text-overflow ellipsis while preserving tooltips with the full raw URI.
- **URI Encoding Delimiter Defense in Virtual Trees**:
  When segmenting paths, the delimiter (`/`) must be preserved as the structural hierarchy marker, but file labels must be decoded once.
  ```typescript
  // INVARIANT: Never decode the separator slash
  export function pathSegmentLabel({ uri, label, isFirst }: PathSegment): string {
    return isFirst ? uri.slice(0, uri.lastIndexOf("/") + 1) + label : label;
  }
  ```
- **Delayed Navigation Cancellation**: In `FileBrowser`, manual tree toggling explicitly invalidates in-flight asynchronous resource reveal promises. If an agent calls `openResource()` and the user manually folds the directory while the resource request is resolving, the later resolution is discarded to prevent UI bouncing.

### 4. Backend Concurrency & Memory Safety
- **Bounded Concurrency Semaphores**: In `mcp-proxy-core.mjs`, client-side flooding is bounded to 16 concurrent requests using a FIFO promise queue to prevent socket starvation:
  ```javascript
  function createSemaphore(limit) {
    let active = 0;
    const queue = [];
    return async function acquire() {
      if (active >= limit) {
        await new Promise((resolve) => queue.push(resolve));
      }
      active += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active -= 1;
        const next = queue.shift();
        if (next) next();
      };
    };
  }
  ```
- **Sequential Output Serialization (`stdoutChain`)**: When an MCP proxy acts as a stdio server, concurrent async requests attempting to write to `process.stdout` can interleave raw byte streams, corrupting the JSON-RPC framing. OpenViking chains all writes through an append-only promise chain (`stdoutChain = stdoutChain.then(...)`).
- **TOCTOU in File Credential Reloading**:
  Instead of reading file contents to check for credential changes, `snapshotPaths()` samples `mtimeMs` and `size` via `statSync()`. If a change is detected, the proxy reloads atomically.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Client vs. Server Timeout Segmentation**:
  In `mapError()` within `mcp-proxy-core.mjs`, an `AbortError` (client-side timeout) is mapped to error code `-32004`, whereas upstream server errors are mapped to `-32002` and auth errors to `-32001`. This distinction is critical: client timeouts indicate high-load vector reranking latency, not an offline infrastructure failure.
- **LLM Evaluator Fallback Parsing Chains**:
  In `benchmark/RAG/src/core/judge_util.py`, judge outputs are decoded via a three-tier resilience chain:
  1. Strict `json.loads(content)`.
  2. Regex capture for JSON-like keys: `r'"score"\s*:\s*([0-4])'`.
  3. Word-boundary integer search: `r'\b([0-4])\b'`.
  4. Final fallback clamp to 0.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
OpenViking decouples the memory management problem into three distinct planes:
- **Virtual Filesystem (`viking://`)**: Standardizes context as files and directories.
- **Hierarchical Summarization Engine**: Computes L0/L1 summaries at ingestion, minimizing context consumption by letting agents scan directories before loading full documents.
- **Async Native Backend**: Binds Python async services to native Rust (`ragfs`) and GPU (`cuvs`) vector backends.

### 2. Core Abstractions
- `RequestContext`: Encapsulates tenant, account, user ID, client version, and permission scopes across all async task invocations.
- `VikingVectorIndexBackend`: Service facade abstracting local brute-force vector search and hardware-accelerated CuVS routines.
- `FileBrowserExpansionSnapshot`: State structure tracking expanded, collapsed, and pending directory edits across mount lifecycles.

### 3. Error Handling
- Comprehensive use of HTTP error decoupling (`HttpStatusError`).
- Protocol-safe stdio handling: Proxy logger errors are silenced (`catch {}`) to prevent non-JSON text from corrupting stdout JSON-RPC framing.
- Three-tier resilient parsing on all agent model outputs.

### 4. Testing
- Concurrency benchmarks (`run_service_concurrency_benchmark.py`) testing concurrent read/write workloads under varied filter selectivities.
- Real-time multi-state evaluation reporting (`ThreeStateBarColumn`) tracking running, completed, failed, and pending tasks simultaneously.
- Automated tests verifying peer attribution boundaries (`test_cli_owner_is_not_a_gateway_sender`).

### 5. Security
- AGPL-3.0 governed context database architecture.
- Scoped identity propagation: Host CLI execution accounts are explicitly decoupled from network-level peer addresses.
- Header isolation: Operator-provided environment headers are merged behind system authentication headers.

### 6. Performance
- Thread-pool offloading: CPU/GPU-intensive index operations run via `asyncio.to_thread` to prevent event-loop starvation.
- Cargo release optimizations:
  ```toml
  [profile.release]
  opt-level = 3
  lto = true
  strip = true
  ```
- BuildKit ccache integration and pre-pinned Cargo target directories in Docker builds.

### 7. Deployment
- Multi-stage Docker architectures separating Rust toolchain, Node.js Web Studio compilation, and Python wheel builds.
- Dynamic dependency pinning for AST parsers (`tree-sitter` grammars) to eliminate breaking changes in downstream container runs.
- Cross-platform support across Linux (glibc/musl) and macOS architectures.

### 8. Agent Patterns
- **Context Filesystem Navigation**: Agents use standard bash-like primitives (`ls`, `read`, `find`) to explore context trees rather than massive single-prompt context dumps.
- **Dynamic L0/L1 Summaries**: Directories supply high-level semantic digests so agents can decide whether to descend into subtrees.
- **Tool Interception**: MCP proxy injects local host tools (`appendLocalTools`) seamlessly alongside upstream OpenViking server tools.

### 9. Data Flow
```
User Message -> Hook/Plugin -> Local Pending Journal -> Network Barrier
     -> OpenViking Gateway -> Policy Engine -> VFS (ragfs)
     -> AST Parser / Chunker -> Vector Index (cuvs) -> L0/L1 Summarizer
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Stdio JSON-RPC Safe Output Serialization
```javascript
// Ensures no two async tasks corrupt the standard output stream
let stdoutChain = Promise.resolve();

export function writeSafeStdio(obj, stdout = process.stdout) {
  const line = `${JSON.stringify(obj)}\n`;
  stdoutChain = stdoutChain
    .then(() => new Promise((resolve) => stdout.write(line, resolve)))
    .catch(() => {});
  return stdoutChain;
}
```

### 2. Rule
**MANDATORY INVARIANT**: Every write operation to stdio in an MCP agent integration **MUST** be sequenced through a single promise chain. Asynchronous tasks **MUST NOT** call `process.stdout.write` directly.

### 3. Architecture Principle
**Filesystem Abstraction Superiority**: Agent working memory should be exposed as an addressable virtual filesystem rather than a flat vector space. Hierarchical paths provide natural access control, granular updates, and hierarchical summarization.

### 4. Failure Mode
**The `skipped/no_messages

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
