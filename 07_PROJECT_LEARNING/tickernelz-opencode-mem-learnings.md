> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tickernelz-opencode-mem-learnings.md`  
> **Source**: github ([https://github.com/tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem))  
> **Source Version**: `0d964894`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T09:29:59.401Z  
> **Learning ID**: `learn-github-tickernelz-opencode-mem`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): tickernelz/opencode-mem

---

## 1. Executive Forensic Architecture & System Mechanics

`opencode-mem` solves the stateful retention barrier inherent in stateless Large Language Model coding agents operating inside host orchestration systems (such as OpenCode). Without persistent episodic, semantic, and user-behavior memory, agent sessions start tabula rasa on every invocation or context compaction, repeating erroneous architectural patterns, disregarding user-specified stylistic constraints, and lacking cross-session continuity.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 OpenCode Host Process                  │
                  │                                                        │
                  │  Hooks: chat.message │ chat.params │ event             │
                  └───────────┬──────────────────────▲─────────────────────┘
                              │                      │
                   (Injected Context)         (Prompt / Model Interception)
                              │                      │
                              ▼                      │
  ┌────────────────────────────────────────────────────────────────────────┐
  │                 opencode-mem Subsystem Core Engine                     │
  │                                                                        │
  │  ┌────────────────────────┐         ┌───────────────────────────────┐  │
  │  │  Context Injector      │         │   Auto-Capture Watchdog       │  │
  │  │  - Eligibility Filter  │         │   - In-Process Host Model     │  │
  │  │  - Multi-Shard Merge   │         │     Resolution (inherit)      │  │
  │  │  - Token Budget Slices │         │   - Structured Output Guard   │  │
  │  └───────────┬────────────┘         │     (2-Step Runaway Abort)    │  │
  │              │                      └───────────────┬───────────────┘  │
  │              ▼                                      ▼                  │
  │  ┌────────────────────────┐         ┌───────────────────────────────┐  │
  │  │ Local Turso Shard Mgr  │         │  User Profile Evolution Engine│  │
  │  │ - Ref-Counted Leases   │         │  - Anchor/Centroid Drift      │  │
  │  │ - Engine Auto-Migrate  │         │  - Confidence / Frequency     │  │
  │  │ - File Lock Retries    │         │  - Vector Stripping on Export │  │
  │  └───────────┬────────────┘         └───────────────┬───────────────┘  │
  └──────────────┼──────────────────────────────────────┼──────────────────┘
                 │                                      │
                 ▼                                      ▼
  ┌─────────────────────────────────┐   ┌──────────────────────────────────┐
  │   Embedded Storage Layer        │   │    Embedding & Inference Engine  │
  │   - @tursodatabase/database     │   │    - @huggingface/transformers   │
  │     (libSQL / SQLite engine)    │   │      (ONNX runtime local CPU)    │
  │   - F32_BLOB native vectors     │   │    - Multi-provider fallback     │
  │   - vector_distance_cos         │   │      (OpenAI, Anthropic, etc.)   │
  └─────────────────────────────────┘   └──────────────────────────────────┘
```

The system is decoupled across four core technical boundaries:
1. **Plugin Lifecycle & State Synchronization (`src/index.ts`, `src/services/turso/lifecycle.ts`)**: Binds directly into OpenCode plugin hooks (`chat.message`, `chat.params`, `event`). It manages an explicit reference-counted lock on local SQLite handles, preventing file-handle starvation and deadlocks during concurrent session initialization or teardown.
2. **Embedded Vector Database Sharding Engine (`src/services/turso/*`)**: Replaces remote vector databases with local `@tursodatabase/database` SQLite databases storing `F32_BLOB` vectors. Similarity scoring executes via `vector_distance_cos` calculations inside the database engine. Sharding isolates project-level memory from global user profile data.
3. **In-Flight Context & Prompt Optimization (`src/utils/context-limit.ts`, `src/services/client.ts`)**: Enforces strict UTF-8 byte boundary truncation (`sliceUtf8Bytes`), multi-shard result merging ordered by pinning and recency, and down-stream injection markers.
4. **Autonomous Cognitive Drift Engine (`src/services/user-profile/*`, `src/utils/math.ts`, `src/utils/profile.ts`)**: Tracks user preferences, coding patterns, and workflows. Updates centroid vectors in memory, applies L2 normalization, calculates cosine drift, and freezes items when drift breaches threshold invariants (`driftBelowCount >= 2`). Per-item vector payloads are stripped prior to public serialization to prevent payload bloat.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. In-Database Pre-Filtering Before Limit Application In Distributed Sharded Queries
**RULE**:
When querying partitioned, sharded, or multi-collection databases with pagination or cardinality limits (`LIMIT N`), query filters (such as session exclusions, temporal cutoffs, soft-deletions, and tenant barriers) MUST be evaluated at the database query level prior to limit truncation. Application code MUST NOT pull top-N rows from the datastore and then filter out unneeded rows in memory.

**WHY**:
Applying filters in memory *after* pulling a fixed limit (`LIMIT N`) causes severe result starvation and non-deterministic cache degradation. For example, if an agent retrieves `LIMIT 20` memories and the current session generated the 20 most recent records, applying `memories.filter(m => m.sessionId !== currentSessionId)` in memory yields 0 records, starving the LLM prompt of valid historical memories despite thousands of valid older records existing in the database. Furthermore, sorting across shards without matching primary keys and pinned flags leads to inconsistent prompt hydration.

**WHEN TO APPLY**:
Apply in any multi-tenant, sharded, or partitioned retrieval system where query constraints (age boundaries, tenant/session isolation) coexist with fixed top-K or pagination limits.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified pattern from opencode-mem src/services/client.ts & turso/vector-search.ts
export interface MemoryListFilters {
  excludeSessionId?: string;
  createdAfter?: number;
}

export async function listMemories(
  db: TursoDb,
  containerTag: string,
  limit: number,
  filters: MemoryListFilters = {}
): Promise<MemoryRecord[]> {
  const whereClauses: string[] = [];
  const args: Array<string | number> = [];

  if (containerTag) {
    whereClauses.push("container_tag = ?");
    args.push(containerTag);
  }

  // Mandatory: Filter excluded session inside the SQL engine
  if (filters.excludeSessionId) {
    whereClauses.push("(session_id != ? OR session_id IS NULL)");
    args.push(filters.excludeSessionId);
  }

  // Mandatory: Filter age cutoffs inside the SQL engine
  if (filters.createdAfter !== undefined) {
    whereClauses.push("created_at > ?");
    args.push(filters.createdAfter);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // The database filters out disqualified rows BEFORE slicing top N.
  const query = `
    SELECT id, content, created_at, is_pinned, session_id, metadata
    FROM memories
    ${whereSql}
    ORDER BY is_pinned DESC, created_at DESC
    LIMIT ?
  `;
  args.push(limit);

  return await db.all<MemoryRecord>(query, args);
}

// Cross-shard aggregator matching identical selection ordering
export function mergeShardedMemories(
  shardResults: MemoryRecord[][],
  limit: number
): MemoryRecord[] {
  const allMemories = shardResults.flat();

  // Primary rank: is_pinned DESC, Secondary rank: created_at DESC
  allMemories.sort((a, b) => {
    const pinDiff = Number(b.is_pinned ?? 0) - Number(a.is_pinned ?? 0);
    if (pinDiff !== 0) return pinDiff;
    return Number(b.created_at) - Number(a.created_at);
  });

  const selected = allMemories.slice(0, limit);
  // Final presentation order: recency for conversational context injection
  selected.sort((a, b) => Number(b.created_at) - Number(a.created_at));
  return selected;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Pulling limit N and post-filtering in memory
async function buggyListMemories(containerTag: string, limit: number, sessionId: string) {
  // Query executes "SELECT * FROM memories LIMIT 20"
  const rows = await db.all("SELECT * FROM memories WHERE tag = ? LIMIT ?", [containerTag, limit]);
  
  // DEFECT: If all 20 rows are from current session, LLM context is starved with []
  const filtered = rows.filter(r => r.sessionId !== sessionId);
  return filtered;
}
```

**VERIFICATION METHOD**:
Automated integration test asserting zero slot leakage:
```typescript
test("listMemories does not starve eligible rows when latest entries are excluded", async () => {
  const currentSession = "sess_active_123";
  // Seed 25 items for current session
  for (let i = 0; i < 25; i++) {
    await insertMemory({ content: `Current ${i}`, session_id: currentSession, created_at: 2000 + i });
  }
  // Seed 10 older eligible items
  for (let i = 0; i < 10; i++) {
    await insertMemory({ content: `Older ${i}`, session_id: "sess_prior_999", created_at: 1000 + i });
  }

  const results = await client.listMemories("tag", 10, "project", { excludeSessionId: currentSession });
  expect(results.length).toBe(10);
  expect(results.every(m => m.metadata?.sessionID !== currentSession)).toBe(true);
});
```

---

### 2. Multi-Byte UTF-8 Strict Boundary Truncation For Context Injection
**RULE**:
When truncating natural language strings to fit byte-bounded model input contexts, code MUST NOT perform raw byte-level slicing without accounting for UTF-8 multibyte character boundaries. Byte truncations MUST advance the starting pointer past UTF-8 continuation bytes (`(byte & 0xc0) === 0x80`) and decrement the ending pointer prior to decoding.

**WHY**:
Arbitrary byte slicing can bisect 2-byte, 3-byte, or 4-byte UTF-8 sequences (common in non-ASCII text, emojis, and code with non-English comments). Decoding bisected UTF-8 byte sequences emits replacement characters (`\uFFFD`), corrupts semantic tokens for ONNX vector embeddings, or triggers fatal parser errors in strict JSON/tool schema parsers.

**WHEN TO APPLY**:
Any context pruning, prompt injection windowing, or token/byte budgeting logic operating on string buffers in Node.js, Bun, or browser runtimes.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified pattern from opencode-mem src/utils/context-limit.ts
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

export function sliceUtf8Bytes(text: string, start: number, end?: number): string {
  const bytes = encoder.encode(text);
  let from = Math.max(0, Math.min(start, bytes.length));
  let to = Math.min(bytes.length, end ?? bytes.length);

  if (to <= from) return "";

  // UTF-8 continuation byte check: (byte & 0b11000000) === 0b10000000 (0x80)
  // If `from` lands inside a multi-byte sequence, advance to the next leading byte.
  while (from < to && (bytes[from]! & 0xc0) === 0x80) {
    from++;
  }

  // If `to` lands inside a multi-byte sequence, decrement to that character's start byte.
  while (to > from && (bytes[to]! & 0xc0) === 0x80) {
    to--;
  }

  return decoder.decode(bytes.subarray(from, to));
}

export function truncateToMaxBytes(
  text: string,
  maxBytes: number,
  marker = "\n[... truncated ...]\n"
): string {
  if (maxBytes <= 0) return "";
  const initialBytes = encoder.encode(text).byteLength;
  if (initialBytes <= maxBytes) return text;

  const markerBytes = encoder.encode(marker).byteLength;
  if (maxBytes <= markerBytes) {
    return sliceUtf8Bytes(text, 0, maxBytes);
  }

  const available = maxBytes - markerBytes;
  const headBytes = Math.floor(available / 2);
  const tailBytes = available - headBytes;

  return (
    sliceUtf8Bytes(text, 0, headBytes) +
    marker +
    sliceUtf8Bytes(text, initialBytes - tailBytes)
  );
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naive string slicing or raw buffer decoding
function naiveTruncate(text: string, maxBytes: number): string {
  // Bug 1: text.slice slices UTF-16 code units, not UTF-8 bytes
  // Bug 2: Buffer.from(text).subarray(0, maxBytes).toString('utf-8') produces \uFFFD replacement bytes
  const buf = Buffer.from(text, 'utf-8');
  return buf.subarray(0, maxBytes).toString('utf-8'); 
}
```

**VERIFICATION METHOD**:
Fuzz test slicing multi-byte unicode code points (Arabic, Chinese, German umlauts, 4-byte emojis):
```typescript
test("sliceUtf8Bytes never emits unicode replacement characters", () => {
  const complexStr = "مرحبا بالعالم 🚀 Test äöü 𠮷野家";
  const bytesLength = new TextEncoder().encode(complexStr).byteLength;

  for (let i = 0; i <= bytesLength + 2; i++) {
    const sliced = sliceUtf8Bytes(complexStr, 0, i);
    expect(sliced.includes("\uFFFD")).toBe(false);
    expect(new TextEncoder().encode(sliced).byteLength).toBeLessThanOrEqual(i);
  }
});
```

---

### 3. Separation Of In-Flight Embedding Vectors From Serialized Model Context
**RULE**:
Internal multi-dimensional dense embedding vectors (e.g., 768-dim `Float32Array` or `number[]` centroids, anchors, and keys) used for in-process semantic comparison MUST be explicitly stripped from entity graphs before passing those graphs into LLM generation prompts, HTTP payloads, or public UI serializers.

**WHY**:
Serializing dense float vectors into chat prompts or REST responses injects hundreds of kilobytes of unstructured floating-point tokens into the LLM context window. This exhausts token limits, increases inference latency by multiples, inflates compute costs, and degrades agent reasoning capabilities due to token noise.

**WHEN TO APPLY**:
Every agent memory system or vector-augmented pipeline that enriches in-memory profile graphs, episodic nodes, or knowledge graphs with vector embeddings.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified pattern from opencode-mem src/services/user-profile/profile-utils.ts
export const stripProfileEmbeddings = <T>(data: T): T => {
  if (!data || typeof data !== "object") return data;
  const container = data as Record<string, unknown>;

  for (const key of ["preferences", "patterns", "workflows"]) {
    const items = container[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item && typeof item === "object") {
        delete (item as Record<string, unknown>).centroid;
        delete (item as Record<string, unknown>).anchor;
      }
    }
  }
  return data;
};

export const toPublicProfileData = <T>(data: T): T => {
  // Use structuredClone to guarantee no mutation leak to internal mathematical state
  return stripProfileEmbeddings(structuredClone(data));
};
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Leaking internal vector arrays into public or prompt JSON
export function serializeUserProfileForPrompt(userProfile: UserProfile): string {
  // Emits: {"preferences": [{"description": "Tabs", "centroid": [0.0123, -0.942, ... 768 floats]}]}
  // Consumes 3,000+ unnecessary tokens per profile item!
  return JSON.stringify(userProfile);
}
```

**VERIFICATION METHOD**:
Static payload assertion:
```typescript
test("toPublicProfileData strips vector arrays entirely", () => {
  const internalData = {
    preferences: [
      { description: "Use Bun", centroid: [0.1, 0.2, 0.3], anchor: [0.4, 0.5, 0.6] }
    ]
  };
  const sanitized = toPublicProfileData(internalData);
  expect(sanitized.preferences[0].centroid).toBeUndefined();
  expect(sanitized.preferences[0].anchor).toBeUndefined();
  // Ensure original internal data is preserved for drift calculations
  expect(internalData.preferences[0].centroid).toBeDefined();
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Memory Context Starvation via Post-Limit Session Exclusion Filter (BUG-MEM-01)
- **Context**: Memory retrieval and injection orchestrator (`src/index.ts`, `src/services/client.ts`)
- **What Was Expected**: When `loadMemoryContext(sessionID)` retrieves up to `CONFIG.chatMessage.maxMemories`, the system must return up to `maxMemories` eligible records excluding records created in `sessionID` and older than `maxAgeDays`.
- **What Actually Happened**: The client invoked `listMemories(tags.project.tag, maxMemories)`. If the current session or old entries occupied the top slots returned by the database, the subsequent JavaScript array filtering stripped them, returning far fewer than `maxMemories` (or even 0), starving the agent prompt of relevant context.
- **Evidence in Repo**: Commit `c1809c1b` (`fix(memory): apply eligibility filters before injection limits (#451)`).
- **Root Cause**: SQL query pagination `LIMIT` was executed inside SQLite prior to applying application-level business filters (`sessionID` exclusion and `maxAgeDays` cutoff).
- **Remediation Code Diff**:
```diff
--- a/src/index.ts
+++ b/src/index.ts
@@ -705,19 +705,17 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
   const loadMemoryContext = async (sessionID: string): Promise<string> => {
     const listResult = await memoryClient.listMemories(
       tags.project.tag,
-      CONFIG.chatMessage.maxMemories
+      CONFIG.chatMessage.maxMemories,
+      "project",
+      {
+        excludeSessionId: CONFIG.chatMessage.excludeCurrentSession ? sessionID : undefined,
+        createdAfter: CONFIG.chatMessage.maxAgeDays
+          ? Date.now() - CONFIG.chatMessage.maxAgeDays * 86400000
+          : undefined,
+      }
     );
-    let memories = listResult.success ? listResult.memories : [];
-    if (CONFIG.chatMessage.excludeCurrentSession) {
-      memories = memories.filter((m: any) => m.metadata?.sessionID !== sessionID);
-    }
-    if (CONFIG.chatMessage.maxAgeDays) {
-      const cutoffDate = Date.now() - CONFIG.chatMessage.maxAgeDays * 86400000;
-      memories = memories.filter((m: any) => new Date(m.createdAt).getTime() > cutoffDate);
-    }
+    const memories = listResult.success ? listResult.memories : [];
```
- **Lesson**: Filtering MUST be pushed down to the storage layer before computing pagination boundaries.

---

### Incident 2: Sharded Rank Distortion and Unpinned Overwrites (BUG-MEM-02)
- **Context**: Shard result aggregation across SQLite shard databases (`src/services/client.ts`)
- **What Was Expected**: When merging results from multiple shards, pinned memories (`is_pinned = 1`) must take priority over unpinned memories, mirroring per-shard SQL sorting semantics (`ORDER BY is_pinned DESC, created_at DESC`).
- **What Actually Happened**: Cross-shard results were combined and sorted solely by `created_at DESC`. Pinned memories from one shard were dropped if unpinned memories on another shard had newer timestamps, violating the user's explicit memory pinning contract.
- **Evidence in Repo**: Commit `c1809c1b` (`src/services/client.ts`).
- **Root Cause**: Aggregator sorting logic omitted the `is_pinned` descriptor during the merge step, relying exclusively on date sorting before slicing to `limit`.
- **Remediation Code Diff**:
```diff
--- a/src/services/client.ts
+++ b/src/services/client.ts
@@ -341,9 +346,15 @@ export class LocalMemoryClient {
         allMemories.push(...memories);
       }
 
-      allMemories.sort((a, b) => Number(b.created_at) - Number(a.created_at));
+      // Match per-shard SQL (is_pinned DESC, created_at DESC) when selecting the
+      // merged limit, then present the chosen rows by recency for injection order.
+      allMemories.sort((a, b) => {
+        const pinDiff = Number(b.is_pinned ?? 0) - Number(a.is_pinned ?? 0);
+        if (pinDiff !== 0) return pinDiff;
+        return Number(b.created_at) - Number(a.created_at);
+      });
+      const selected = allMemories.slice(0, limit);
+      selected.sort((a, b) => Number(b.created_at) - Number(a.created_at));
-      const memories = allMemories.slice(0, limit).map((r: any) => ({
+      const memories = selected.map((r: any) => ({
```
- **Lesson**: Distributed aggregation sorts must be a mathematical twin of shard-local order clauses before applying limits.

---

### Incident 3: Host Session Model Orphan in OpenCode v2 Environment (BUG-AI-01)
- **Context**: Model inheritance during background tasks (`src/services/ai/opencode-provider.ts`, `src/index.ts`)
- **What Was Expected**: Setting `"opencodeModel": "inherit"` should allow background workers (such as user profile learning or memory deduplication) to inherit the model currently active in the host chat session.
- **What Actually Happened**: Background processes crashed with `ProviderModelNotFoundError: Model not found: <provider>/inherit`.
- **Evidence in Repo**: Commit `094f7899` (`fix(ai): remember host session model for opencodeModel inherit (#454)`).
- **Root Cause**: The plugin previously relied on disk-backed file reads of OpenCode's `model.json`. In OpenCode v2, `model.json` was deprecated and ceased to be written to disk. Background paths not initiated by a direct prompt had no session context, causing the literal string `"inherit"` to be passed downstream to the provider SDK.
- **Remediation Code Diff**:
```diff
--- a/src/index.ts
+++ b/src/index.ts
@@ -832,6 +833,13 @@ export const OpenCodeMemPlugin: Plugin = async (ctx: PluginInput) => {
     "chat.params": async (input, output) => {
       applyStructuredOutputChatParams(input, output);
 
+      const sessionModel = input?.model;
+      if (typeof sessionModel?.providerID === "string" && typeof sessionModel?.id === "string") {
+        // Keep the host-resolved model for inherit on idle paths (profile
+        // learning, dedup, …). OpenCode v2 no longer writes model.json (#453).
+        rememberSessionModel(sessionModel.providerID, sessionModel.id);
+      }
+
       if (!isConfigured() || CONFIG.opencodeModel !== "inherit") return;
--- a/src/services/ai/opencode-provider.ts
+++ b/src/services/ai/opencode-provider.ts
@@ -377,12 +377,32 @@ export interface StructuredOutputOptions<T> {
+let rememberedSessionModel: { providerID: string; modelID: string } | undefined;
+
+export function rememberSessionModel(providerID: string, modelID: string): void {
+  if (!providerID || !modelID || modelID === "inherit") return;
+  rememberedSessionModel = { providerID, modelID };
+}
...
+  if (rememberedSessionModel) {
+    return rememberedSessionModel;
+  }
   const recent = readRecentOpencodeModel(opts.providerID);
```
- **Lesson**: Do not rely on ephemeral host configuration files on disk for inter-subsystem state; intercept live execution parameters during hook lifecycles and cache them in-process.

---

### Incident 4: Provider-Specific Parameter Drop in AI Cleanup Requests (BUG-AI-02)
- **Context**: External LLM structured cleanup requests (`src/services/user-profile/ai-cleanup.ts`)
- **What Was Expected**: Custom engine tuning parameters configured via `memoryExtraParams` (e.g., `enable_thinking: false` for SiliconFlow/Qwen, or `temperature: 0.0`) must be forwarded to all outbound provider requests.
- **What Actually Happened**: The AI cleanup module reconstructed an HTTP POST payload from scratch, omitting `CONFIG.memoryExtraParams`. Reasoning models timed out or failed to return valid JSON because thinking tokens overwhelmed token limits.
- **Evidence in Repo**: Issue #287 (`Forward memoryExtraParams in external AI cleanup requests`).
- **Root Cause**: Architectural fragmentation between standard chat provider adapters and dedicated user-profile background cleanup requests.
- **Remediation Code Diff**:
```typescript
// Fixed pattern in ai-cleanup request builder:
const requestBody = {
  model: resolvedModel,
  messages: promptMessages,
  temperature: CONFIG.memoryTemperature !== false ? CONFIG.memoryTemperature : 0.0,
  // Fix: Explicitly merge configured extra params while guarding reserved keys
  ...(CONFIG.memoryExtraParams ?? {}),
  response_format: { type: "json_object" }
};
```
- **Lesson**: Centralize outbound HTTP payload formatting through unified provider transport adapters instead of bespoke per-feature fetch calls.

---

### Incident 5: Disconnect Between Search Query UI State and Result Totals (BUG-UI-01)
- **Context**: Web UI Memory Explorer (`web/src/lib/*`, Issue #288)
- **What Was Expected**: When a user inputs a search query in the Memory Explorer, the count badge must reflect the count of *matched* records (`filtered.length`). When the input is cleared, it must restore the store-wide total (`totalCount`).
- **What Actually Happened**: The count badge continuously displayed `totalCount` regardless of search query state, causing users to believe the search query was ignored or returned all records.
- **Evidence in Repo**: Closed Issue #288 (`Show matched memory count while Web UI search is active`).
- **Root Cause**: State reactivity failed to derive the count dynamically from the filtered array store, binding directly to the top-level collection metadata.
- **Remediation Code Pattern**:
```svelte
<!-- Fixed reactive pattern in web UI -->
<script>
  let searchQuery = "";
  $: filteredMemories = memories.filter(m => matchesQuery(m, searchQuery));
  $: displayedCount = searchQuery.trim().length > 0 ? filteredMemories.length : totalCount;
</script>

<Badge>{displayedCount} {searchQuery ? 'matched' : 'total'}</Badge>
```
- **Lesson**: State visualization components must explicitly bind to derived filtered sets rather than static parent-level totals.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in Bitwise Masks**: In `sliceUtf8Bytes`, checking for UTF-8 continuation bytes requires strict parentheses:
  ```typescript
  // CORRECT: Bitwise AND (&) has lower precedence than equality (===)
  (bytes[from]! & 0xc0) === 0x80
  // FATAL BUG: Without parentheses, evaluates as bytes[from]! & (0xc0 === 0x80) -> bytes[from]! & 0
  bytes[from]! & 0xc0 === 0x80 // ALWAYS EVALUATES TO 0 (FALSE)
  ```
- **Falsy Zero Guard in Math Vectors**:
  ```typescript
  // CORRECT: In cosine distance calculations, magnitude can be precisely 0
  if (magA === 0 || magB === 0) return 0;
  // Anti-pattern: Assuming truthy values
  if (!magA || !magB) // Works for 0, but prone to NaN propagation if magA is null
  ```
- **Coercion of SQLite Booleans & BigInts**:
  ```typescript
  // When inserting dynamic types from raw database rows into TursoDb:
  else if (typeof raw === "bigint") sqlArgs.push(Number(raw));
  else if (typeof raw === "boolean") sqlArgs.push(raw ? 1 : 0);
  // Using String(raw) on a boolean outputs "true"/"false" instead of SQLite integer 1/0,
  // completely breaking SQLite WHERE is_pinned = 1 index scans!
  ```

### 2. Infinite Loop & Recursion Guards
- **Circular JSON Repair De-nesting**: In `web/src/lib/profile-utils.ts`, recursive unstringing of escaped JSON contains a strict convergence invariant:
  ```typescript
  let result: unknown = field;
  let lastResult: unknown = null;
  // Invariant: Stop if value does not change, or if not a string
  while (typeof result === "string" && result !== lastResult) {
    lastResult = result;
    try {
      result = JSON.parse(jsonrepair(result));
    } catch {
      break; // Immediate escape on unparsable syntax
    }
  }
  ```
- **Sub-Agent Autonomous Loop Watchdog**: When utilizing internal agents for structured memory extraction (`STRUCTURED_OUTPUT_AGENT`), OpenCode sub-agents can enter self-referential calling loops.
  ```typescript
  // Enforced invariant: Hard abort after exactly 2 execution steps
  export const STRUCTURED_OUTPUT_MAX_STEPS = 2;
  export function noteStructuredOutputStep(sessionId: string, currentStep: number): void {
    if (currentStep > STRUCTURED_OUTPUT_MAX_STEPS) {
      throw new Error(`Watchdog aborted runaway internal session ${sessionId} at step ${currentStep}`);
    }
  }
  ```

### 3. UI & UX Micro-Mechanics
- **Immutable Set Mutators**: Avoid direct Set mutation in UI state reactivity:
  ```typescript
  // In web/src/lib/set-utils.ts:
  export function toggleInSet<T>(set: Set<T>, value: T, checked: boolean): Set<T> {
    const next = new Set(set);
    if (checked) next.add(value);
    else next.delete(value);
    return next; // Returns a new reference, guaranteeing triggering Svelte / React dirty check
  }
  ```
- **Vector Banner Canvas Pixel Grid Alignment**: In `web/scripts/render-banner.mjs`, strokes sit exactly on pixel boundaries to prevent anti-aliasing blur:
  ```javascript
  // 1px offset ensures 2px border strokes remain crisp on exact integer pixel grid
  `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" stroke-width="2"/>`
  ```

### 4. Backend Concurrency & Memory Safety
- **Windows SQLite File Handle Lock Failure (EPERM)**: On Windows OS, renaming a SQLite database over an existing open file handle throws `EPERM`. The migrator encapsulates filesystem mutations within an explicit retry-backoff harness:
  ```typescript
  // In src/services/turso/engine-migrator.ts & sqlite-handle-release.ts
  await withSqliteFileLockRetry(() => {
    copySqliteDatabase(dbPath, backupPath);
    remove