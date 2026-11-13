# Verification Protocol: Verification Protocol: Empirical Defect Shield for zilliztech/claude/context

<!-- PROVENANCE_START
{
  "source_repository": "zilliztech/claude/context",
  "source_url": "https://github.com/zilliztech/claude/context",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zilliztech/claude/context](https://github.com/zilliztech/claude/context) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `zilliztech/claude/context` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zilliztech-claude-context-learnings.md`  
> **Source**: github ([https://github.com/zilliztech/claude-context](https://github.com/zilliztech/claude-context))  
> **Source Version**: `f49b7812`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-11T09:28:55.214Z  
> **Learning ID**: `learn-github-zilliztech-claude-context`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): zilliztech/claude-context

---

## 1. Executive Forensic Architecture & System Mechanics

`zilliztech/claude-context` is a high-density, multi-platform Model Context Protocol (MCP) server and developer-tooling pipeline designed to index, synchronize, and perform hybrid semantic code search across large repositories without blowing AI context window token budgets or incurring runaway LLM inference costs.

```
                           ┌──────────────────────────────────────────────┐
                           │   AI Coding Agent / Client (Claude Code)    │
                           └──────────────────────┬───────────────────────┘
                                                  │ MCP Stdio Transport
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ @zilliz/claude-context-mcp Subsystem                                                            │
│                                                                                                 │
│  ┌───────────────────────┐         ┌────────────────────────┐         ┌──────────────────────┐  │
│  │   ToolHandlers        ├────────►│    SnapshotManager     │◄───────►│ mcp-codebase-        │  │
│  │  (MCP RPC Dispatcher) │         │ (State Store: Indexes) │         │ snapshot.json        │  │
│  └──────────┬────────────┘         └───────────┬────────────┘         └──────────────────────┘  │
│             │                                  │                                                │
│             │ Active Task Locks                │ Reconcile Vector Metadata                      │
│             ▼                                  ▼                                                │
│  ┌──────────────────────────────────────────────────────────┐                                   │
│  │  Active Task Registry: Map<string, IndexingTask>         │                                   │
│  └──────────────────────────┬───────────────────────────────┘                                   │
└─────────────────────────────┼───────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ @zilliz/claude-context-core Subsystem                                                           │
│                                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Context Orchestrator (packages/core/src/context.ts)                                        │  │
│  │  - IgnoreMatcher (.gitignore / custom / defaults)                                         │  │
│  │  - Deterministic Collection Naming: [prefix]_[md5(abs_path)[0..8]]                        │  │
│  │  - Fail-Stop Abortion: IndexAbortError vs EmbeddingError                                 │  │
│  └──────────────────┬──────────────────────────────────────────┬─────────────────────────────┘  │
│                     │                                          │                                │
│                     ▼                                          ▼                                │
│  ┌─────────────────────────────────────┐    ┌────────────────────────────────────────────────┐  │
│  │ Code Splitters (packages/core/src/) │    │ Vector Database & Embedding Provider Adapters   │  │
│  │  - AstCodeSplitter (tree-sitter)    │    │  - Milvus / Zilliz Cloud VectorDB Driver       │  │
│  │  - Fallback: LangChain Char Splitter│    │  - OpenAI / Gemini / Ollama / VoyageAI         │  │
│  │  - Lazy Native Parser Loader Guard  │    │  - Dynamic Dimension Detector & Auto Truncator │  │
│  └─────────────────────────────────────┘    └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Boundaries & State Ownership
1. **The MCP Process Barrier (`packages/mcp`)**: Exposes tool-call primitives (`index_codebase`, `get_indexing_status`, `clear_index`, `search_code`) to the host agent over JSON-RPC. It owns the local filesystem cache (`~/.context/mcp-codebase-snapshot.json`) and must reconcile remote database state against transient in-flight indexing promises without race conditions.
2. **The Core Engine Subsystem (`packages/core`)**: Implements the chunking, parsing, embedding, and vector-database communication logic. It maintains deterministic naming contracts (`hybrid_code_chunks_<hash>` or `code_chunks_<hash>`) derived from normalized codebase root paths, guaranteeing that multi-codebase setups under a single server instance never experience collection collision.
3. **The Grammar Loading Boundary (`packages/core/src/splitter`)**: Isolates dynamic C-bindings (`dlopen` via native Node modules) behind defensive lazy loaders. It decouples the core runtime from platform-specific ABI/signing failures (e.g., unsigned binaries on macOS ARM64).
4. **Evaluation & Verification Harness (`evaluation/`)**: Implements dual-agent benchmarks against standard datasets (e.g., SWE-bench, Git repo instances) using file-locking semantics (`FileLock`) and sub-process execution barriers to measure context retrieval efficiency, grep-vs-vector accuracy, and diff generation.

---

## 2. Net-New Universal Engineering Rules

### 1. Two-Phase Asynchronous Snapshot Reconciliation Under In-Flight Task Mutation
**RULE**:
When an application synchronizes persisted local metadata against an external database while background jobs are running, the background job registry MUST be checked both **before** the network query begins AND **immediately before** applying the fetched state to the local snapshot. If the background job exists, was created, completed, or failed while the I/O awaited resolution, the external database state MUST be discarded for that entity.

**WHY**:
Network I/O is asynchronous and non-atomic. A long-running indexing job writes vector rows progressively. If an external query (`listCollections`, `getCollectionRowCount`) completes while a task is mid-run, it will inspect a half-populated collection. Without this dual-phase check, the reconciliation routine commits incomplete statistics (e.g., 4 rows out of 24) to the local cache, marking an incomplete job as permanently "completed".

**WHEN TO APPLY**:
Apply in any distributed or asynchronous task coordination system where a local cache acts as a fast-read projection of remote cloud/database entities while local background workers asynchronously stream mutations to those same entities.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Production-grade reconciliation guard with pre/post-await invariant checking
export class StateReconciler<TStats, TInfo> {
    private inFlightTasks = new Map<string, Promise<void>>();

    constructor(
        private readonly stateStore: {
            getInfo(id: string): TInfo | undefined;
            setCompleted(id: string, stats: TStats): void;
        },
        private readonly remoteClient: {
            fetchRemoteStats(id: string): Promise<TStats | null>;
        }
    ) {}

    public async reconcileEntity(entityId: string): Promise<void> {
        // Pre-check: Active local work invalidates external stale snapshots
        if (this.inFlightTasks.has(entityId)) {
            return;
        }

        // Capture snapshot state pointer BEFORE triggering async I/O
        const infoBeforeQuery = this.stateStore.getInfo(entityId);

        // Await remote network I/O
        const remoteStats = await this.remoteClient.fetchRemoteStats(entityId);

        // Post-check: Re-verify invariants after resuming execution on the microtask queue.
        // If a task began while awaiting, or local state transitioned, discard remoteStats.
        const infoAfterQuery = this.stateStore.getInfo(entityId);
        if (this.inFlightTasks.has(entityId) || infoAfterQuery !== infoBeforeQuery) {
            return;
        }

        if (remoteStats !== null) {
            this.stateStore.setCompleted(entityId, remoteStats);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blind write-back post network call. Corrupts local state with partial rows.
async function badReconcile(entityId: string) {
    if (!this.inFlightTasks.has(entityId)) {
        const stats = await this.remoteClient.fetchRemoteStats(entityId);
        // BUG: While waiting for fetchRemoteStats, a new indexing task started
        // or an existing task completed! This blind write overwrites current progress.
        this.stateStore.setCompleted(entityId, stats);
    }
}
```

**VERIFICATION METHOD**:
Implement a concurrent deferred-promise test harness:
1. Start an asynchronous task that pauses at a synchronization barrier after writing partial data.
2. Trigger the reconciliation routine.
3. Assert that the task registry prevents the partial count from being committed.
4. Advance the task to completion and verify the final state reflects the finished job, never the interim fetch.

---

### 2. Guarded Lazy Native-Module Loading with Graceful Degradation Fallbacks
**RULE**:
Dynamic bindings to native C/C++ libraries, foreign function interfaces (FFI), or platform-dependent shared libraries (e.g., Tree-sitter parsers, binary DLLs, `.so`, `.dylib`) MUST NOT be evaluated eagerly at file-level import or module initialization. They MUST be loaded lazily on demand within an explicit runtime exception boundary (`try/catch`). On `ERR_DLOPEN_FAILED` or ABI mismatch, the subsystem MUST quarantine the failing sub-component and downgrade to a zero-native pure fallback parser.

**WHY**:
Unsigned dynamic libraries, missing host runtime symbols, or architecture mismatches (such as macOS `arm64` vs `x86_64` prebuilds) trigger fatal uncatchable process terminates if required globally. Eager imports cause an entire server to crash on boot for all users, including those who never invoke the offending native component.

**WHEN TO APPLY**:
All Node.js / Deno / Bun plugins and CLI tools loading native C-addons, WebAssembly with native polyfills, or multi-language grammar splitters.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/core/src/splitter/parser-loader.ts
export type ASTLanguage = 'typescript' | 'python' | 'cpp' | 'scala';

type ParserModule = { default: unknown };
type LoaderFn = () => ParserModule;

export class SafeParserRegistry {
    private static readonly LOADERS: Record<ASTLanguage, LoaderFn> = {
        typescript: () => require('tree-sitter-typescript').typescript,
        python: () => require('tree-sitter-python'),
        cpp: () => require('tree-sitter-cpp'),
        scala: () => require('tree-sitter-scala'),
    };

    private static readonly failedLanguages = new Set<ASTLanguage>();
    private static readonly initializedParsers = new Map<ASTLanguage, unknown>();

    public static getParser(lang: ASTLanguage): unknown | null {
        if (this.failedLanguages.has(lang)) {
            return null; // Quarantined: Route immediately to text fallback
        }

        if (this.initializedParsers.has(lang)) {
            return this.initializedParsers.get(lang);
        }

        try {
            const loader = this.LOADERS[lang];
            if (!loader) {
                this.failedLanguages.add(lang);
                return null;
            }
            const parserInstance = loader();
            this.initializedParsers.set(lang, parserInstance);
            return parserInstance;
        } catch (error: unknown) {
            // Intercept dlopen failures, missing .node binaries, or signature faults
            this.failedLanguages.add(lang);
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[SafeParserRegistry] ⚠️ Native loader failed for "${lang}". Falling back. Detail: ${message}`);
            return null; // Return null so callers downgrade to character/regex splitting
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Eager root-level import of native binaries.
// If tree-sitter-cpp has an unsigned binary on macOS arm64, 
// the whole process dies before main() can execute!
import Parser from 'tree-sitter';
import Cpp from 'tree-sitter-cpp'; // FAILS HERE: Error: dlopen(...) ERR_DLOPEN_FAILED
import TypeScript from 'tree-sitter-typescript';

export class AstSplitter {
    // Whole module fails to load even if the user only has .ts files!
}
```

**VERIFICATION METHOD**:
Run unit tests in a clean container or mock environment where dynamic native imports deliberately throw `ERR_DLOPEN_FAILED`. Assert that:
1. Module initialization does not throw.
2. Calls requesting the broken parser return `null` and log a warning.
3. The file is successfully processed by the fallback character-based chunking strategy.

---

### 3. Fail-Stop Propagation Hierarchy for Network-Dependent Batch Pipelines
**RULE**:
In a batch-processing extraction/indexing pipeline, errors MUST be split into **Recoverable Entity Skips** (e.g., malformed single files, unsupported character encodings, AST parsing warnings) and **Systemic Pipeline Halts** (e.g., API authentication errors, embedding provider quota depletion, storage connection timeouts). Systemic pipeline halts MUST immediately abort the entire operation and MUST NOT permit the process to update metadata stores or commit partial completion milestones.

**WHY**:
Allowing systemic API failures (such as `EmbeddingError`) to be caught inside the per-file iteration loop treats total API outages as individual file skips. The pipeline iterates through thousands of files, generating zero embeddings, and reports success. The persistent snapshot then marks the repository as fully indexed, poisoning the retrieval layer with an empty vector database.

**WHEN TO APPLY**:
Batch extractors, ETL pipelines, vector embedding workers, and LLM indexing engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Explicit error stratification
export class RecoverableEntityError extends Error {}
export class SystemicPipelineError extends Error {}

export interface BatchProcessingOptions {
    onProgress: (processed: number, total: number) => void;
    signal?: AbortSignal;
}

export async function processFileBatch(
    filePaths: string[],
    embedder: (text: string) => Promise<number[]>,
    writer: (file: string, vec: number[]) => Promise<void>,
    options: BatchProcessingOptions
): Promise<void> {
    for (let i = 0; i < filePaths.length; i++) {
        if (options.signal?.aborted) {
            throw new Error('Batch operation aborted by caller.');
        }

        const file = filePaths[i];
        let content: string;

        try {
            content = await readFileWithSafeDecoding(file);
        } catch (err) {
            // RECOVERABLE: Log and skip single corrupted file
            console.warn(`[Skip] Unreadable file ${file}:`, err);
            continue;
        }

        let vector: number[];
        try {
            vector = await embedder(content);
        } catch (err: unknown) {
            // SYSTEMIC: API quota, auth, or network drops MUST NOT be swallowed!
            throw new SystemicPipelineError(
                `Critical embedding outage at file "${file}": ${err instanceof Error ? err.message : String(err)}`
            );
        }

        await writer(file, vector);
        options.onProgress(i + 1, filePaths.length);
    }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Swallowing critical system errors inside the loop
for (const file of files) {
    try {
        const text = readFile(file);
        const vector = await api.embed(text); // Fails with 401 Unauthorized or 429 Quota
        await db.insert(file, vector);
    } catch (e) {
        // CATASTROPHIC BUG: Treating 401/429 the same as a malformed text file!
        // Loop runs to completion, snapshot marks repo as "100% indexed", DB has 0 rows.
        console.warn(`Skipped ${file}`);
    }
}
```

**VERIFICATION METHOD**:
Mock the embedding API to reject on the $N$-th call with an HTTP 429 error. Execute the indexing suite against a fixture containing $N+5$ files. Verify that:
1. An `EmbeddingError` is thrown up to the MCP host.
2. The snapshot state remains uncommitted or marked `failed`.
3. The collection is not tagged as `indexed`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Active Indexing Task Overwritten by Stale Snapshot Recovery (BUG-MCP-RECONCILE-01)
- **Context**: MCP handler state management in `packages/mcp/src/handlers.ts` and `handlers.reconcile-snapshot.test.ts`.
- **What Was Expected**: Calling `handleGetIndexingStatus` or `handleSemanticSearch` during an active indexing job should report `"indexing"` progress and maintain the in-memory task reference without altering the snapshot state until the task finishes.
- **What Actually Happened**: When an agent triggered a status inquiry while indexing was in progress, `syncIndexedCodebasesFromCloud` (later renamed `reconcileSnapshotWithVectorDatabase`) executed. It queried Milvus/Zilliz Cloud, discovered a non-zero row count (partial rows inserted by the ongoing job), and immediately declared the codebase `"completed"` in `mcp-codebase-snapshot.json`. If indexing was interrupted or still running, subsequent searches operated against half-indexed databases.
- **Evidence in Repo**: PR #442, Commit `98133626` / `f49b7812`.
- **Root Cause**: The reconciliation algorithm did not inspect the server's local `this.indexingTasks` map before making cloud row-count calls. It assumed any collection detected with rows in the cloud was a completed collection from an earlier session needing recovery. Furthermore, it didn't check whether the snapshot object reference changed during the asynchronous `await this.queryCollectionStats(...)` window.
- **Remediation Code Diff**:
```typescript
// packages/mcp/src/handlers.ts
@@ -287,8 +287,23 @@ export class ToolHandlers {
              for (const databaseCodebase of databaseCodebases) {
+                // Partial rows from our active task do not establish completion.
+                // Persisted 'indexing' entries alone may be stale and still need recovery.
+                if (this.indexingTasks.has(databaseCodebase)) {
+                    continue;
+                }
+
                 if (!localCodebases.has(databaseCodebase)) {
+                    const infoBeforeQuery = this.snapshotManager.getCodebaseInfo(databaseCodebase);
                     const stats = await this.queryCollectionStats(databaseCodebase);
+
+                    // A task can start, finish, or fail while the database query awaits I/O.
+                    // State transitions replace the info object; preserve the newer state.
+                    if (this.indexingTasks.has(databaseCodebase)
+                        || this.snapshotManager.getCodebaseInfo(databaseCodebase) !== infoBeforeQuery) {
+                        continue;
+                    }
+
                     if (stats) {
                         this.snapshotManager.setCodebaseIndexed(databaseCodebase, {
                             ...stats,
```
- **Lesson**: Async queries must employ state-pointer comparison before applying remote state mutations to in-memory snapshots.

---

### Incident 2: Total MCP Server Crash on Boot via Unsigned Native Tree-Sitter Binaries (BUG-AST-DLOPEN-02)
- **Context**: Language parser initialization in `packages/core/src/splitter/ast-splitter.ts`.
- **What Was Expected**: Users configuring the Claude Context MCP plugin on macOS ARM64 running pure JavaScript/TypeScript codebases should start the server and run searches normally.
- **What Actually Happened**: The MCP server crashed immediately on startup during stdio initialization with `ERR_DLOPEN_FAILED`. Neither Claude Code nor Cursor could connect to the server.
- **Evidence in Repo**: Issue #421, PR #423.
- **Root Cause**: The module loaded all tree-sitter language grammars eagerly via static `require()` statements at the top of `ast-splitter.ts`. `tree-sitter-cpp` and `tree-sitter-scala` contained prebuilt binary `.node` files with missing or invalid code signatures for Apple Silicon Darwin kernels. Because the imports were top-level, the `ERR_DLOPEN_FAILED` error terminated the Node process during module evaluation before any user configuration or file-type detection took place.
- **Remediation Code Diff**:
```typescript
// packages/core/src/splitter/ast-splitter.ts
// - const CppGrammar = require('tree-sitter-cpp');
// - const ScalaGrammar = require('tree-sitter-scala');
// + Replaced with lazy loader map:

const LANGUAGE_PARSER_LOADERS: Record<string, () => any> = {
    'cpp': () => require('tree-sitter-cpp'),
    'scala': () => require('tree-sitter-scala'),
    'typescript': () => require('tree-sitter-typescript').typescript,
    'python': () => require('tree-sitter-python'),
};

function loadLanguageParser(lang: string) {
    try {
        const loader = LANGUAGE_PARSER_LOADERS[lang];
        return loader ? loader() : null;
    } catch (err) {
        console.warn(`[ASTSplitter] ⚠️ Failed to load grammar for ${lang}. Falling back to text splitter.`);
        return null;
    }
}
```
- **Lesson**: Never allow optional or platform-specific native addons to sit in the critical import path of an application's startup lifecycle.

---

### Incident 3: Transient Cloud Empty-Response Poisoning Local Snapshot (BUG-RECONCILE-EMPTY-03)
- **Context**: Snapshot synchronization logic in `packages/mcp/src/handlers.ts`.
- **What Was Expected**: If the remote Milvus database experiences a momentary connection glitch, cold-start timeout, or transient DNS failure when listing collections, the local cache must remain untouched.
- **What Actually Happened**: `listCollections()` failed open by returning an empty array `[]`. The reconcile routine compared the local snapshot against this empty set, assumed all collections had been deleted from the cloud, and purged every registered codebase from `mcp-codebase-snapshot.json`. Users lost their local indexing state and were forced to re-index gigabytes of code.
- **Evidence in Repo**: PR #442 commit diff in `packages/mcp/src/handlers.ts`.
- **Root Cause**: Lack of an empty-set defensive guard on remote collection listings. An empty array was treated as authoritative data rather than a potentially transient network partition.
- **Remediation Code Diff**:
```typescript
// packages/mcp/src/handlers.ts
             const collections = await vectorDb.listCollections();
 
             if (collections.length === 0) {
+                console.log(`[SNAPSHOT-RECONCILE] ✅ No collections found in the vector database. Skipping deletion of local codebases to avoid data loss from transient errors.`);
+                return;
             }
```
- **Lesson**: Destructive synchronization operations against remote sources must verify that the remote source returned a verified, non-empty response before pruning local state.

---

### Incident 4: Silent Partial Indexing Caused by Caught Embedding Exceptions (BUG-CORE-EMBED-04)
- **Context**: File-list iteration in `packages/core/src/context.ts`.
- **What Was Expected**: If OpenAI or VoyageAI credentials expire or rate limits are hit mid-index, the indexing operation must stop and register as failed.
- **What Actually Happened**: The file processing loop wrapped chunk processing in a generic `catch (err)` block that logged a warning and continued to the next file. When API keys were invalid or credits were exhausted, every file logged an error, zero chunks were upserted to Milvus, but `indexCodebase` returned `{ status: 'completed' }`.
- **Evidence in Repo**: Commit logs in `packages/core/src/context.ts` defining `EmbeddingError` and `IndexAbortError`.
- **Root Cause**: Error boundary misclassification. Third-party API failures were grouped into the same catch-block that handled single-file syntax parsing errors.
- **Remediation Code Diff**:
```typescript
// packages/core/src/context.ts
export class EmbeddingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EmbeddingError';
    }
}

// Inside file processing pipeline:
try {
    await this.processFile(file);
} catch (error) {
    if (error instanceof EmbeddingError || error instanceof IndexAbortError) {
        // Critical: Do NOT swallow! Must crash indexing loop so status does not commit.
        throw error;
    }
    console.warn(`[Context] Skipping problematic file ${file}:`, error);
}
```
- **Lesson**: Differentiate domain exceptions into recoverable local faults and fatal systemic faults; re-throw systemic faults across processing boundaries.

---

### Incident 5: Cross-Codebase Collection Name Collision Under Overrides (BUG-COLLISION-OVERRIDE-05)
- **Context**: Collection naming engine in `packages/core/src/context.ts` (`getCollectionName`).
- **What Was Expected**: When a user specifies an optional collection name override (via configuration or environment variable), indexing two distinct repositories on the same machine must not collide into a single database table.
- **What Actually Happened**: The override logic applied the raw user-supplied suffix globally. When an agent switched working directories from Repo A to Repo B, both repositories mapped to `hybrid_code_chunks_<override>`, causing vector insertions from Repo B to interleave with Repo A.
- **Evidence in Repo**: Code comments and hash logic in `packages/core/src/context.ts`:
  `// Overrides always keep the per-codebase _<pathHash> suffix so that multiple codebases indexed by the same MCP server can't collapse into one collection.`
- **Root Cause**: Custom name overrides bypassed the MD5 hash normalization of the absolute filesystem path.
- **Remediation Code Diff**:
```typescript
// packages/core/src/context.ts
         const normalizedPath = path.resolve(codebasePath);
         const pathHash = crypto.createHash('md5').update(normalizedPath).digest('hex').substring(0, 8);
 
         const configOverride = this.getValidOverrideValue(this.collectionNameOverride);
         if (configOverride) {
-            return `${prefix}_${configOverride}`;
+            const suffix = this.sanitizeCollectionNameSuffix(configOverride, prefix, pathHash, 'Context config');
+            return `${prefix}_${suffix}_${pathHash}`;
         }
```
- **Lesson**: Multi-tenant or multi-workspace database identifiers must strictly bind an invariant hash of the workspace identity into the collection key, regardless of user-provided naming overrides.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Falsy 0 vs Null in Vector Row Counts**: In vector database APIs, a row count of `0` is valid (an empty initialized collection), whereas `undefined` or `null` denotes an unindexed or non-existent collection. Using `if (!rowCount)` treats zero rows identically to query failure.
  ```typescript
  // INVARIANT: Explicit null/undefined checks for numeric counters
  const rowCount = await database.getCollectionRowCount(name);
  // DEFECT: if (!rowCount) -> Fails when rowCount is 0!
  // CORRECT:
  if (rowCount === null || rowCount === undefined) {
      throw new Error(`Failed to read row count for ${name}`);
  }
  ```
- **Path Separation Normalization Before Hashing**: Windows vs POSIX path strings (`C:\repo` vs `C:/repo`) produce completely different MD5 digests if hashed directly. Paths must be resolved and normalized:
  ```typescript
  const normalizedPath = path.resolve(codebasePath); // Normalizes slashes and resolves symlinks
  const pathHash = crypto.createHash('md5').update(normalizedPath).digest('hex').substring(0, 8);
  ```
- **Object Identity Invariant for Asynchronous State Projections**:
  ```typescript
  // Capturing object references across async boundaries
  const infoBeforeQuery = this.snapshotManager.getCodebaseInfo(databaseCodebase);
  await someAsyncWork();
  // INVARIANT: In JavaScript, if a concurrent mutation replaced the object in the map,
  // reference equality (===) fails, signaling the caller to discard stale data.
  if (this.snapshotManager.getCodebaseInfo(databaseCodebase) !== infoBeforeQuery) {
      return; // Interleaved state update detected
  }
  ```

### 2. Infinite Loop & Recursion Guards
- **AST Child Node Traversal Depth Cap**: When walking recursive syntax trees (e.g., nested classes, inner functions, chained lambdas), cyclic grammar graphs or massive auto-generated files (e.g., protobuf outputs) cause call-stack exhaustion.
  ```typescript
  export function traverseAst(node: SyntaxNode, depth: number = 0, maxDepth: number = 256): void {
      if (depth > maxDepth) {
          throw new Error(`AST recursion limit exceeded at depth ${depth}`);
      }
      for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
              traverseAst(child, depth + 1, maxDepth);
          }
      }
  }
  ```
- **Event Loop Yielding During Batch Ingestion**: Synchronously processing tens of thousands of files locks the single-threaded Node.js event loop, preventing MCP ping health checks from responding.
  ```typescript
  // Yield execution to allow I/O ticks and keep-alive responses
  if (fileIndex % 50 === 0) {
      await new Promise(resolve => setImmediate(resolve));
  }
  ```

### 3. UI & UX Micro-Mechanics (MCP Client Output Formatting)
- **JSON Formatting Invariant for Agent Tool Responses**: LLMs consume structured responses. Emitting raw ANSI color codes, bare exceptions, or unstructured text breaks parsing logic in Claude Code and Cursor.
  ```typescript
  // INVARIANT: All tool handler results MUST wrap responses in structured Content envelopes
  return {
      content: [
          {
              type: "text",
              text: `Successfully indexed ${result.indexedFiles} files, ${result.totalChunks} chunks.`
          }
      ],
      isError: false
  };
  ```
- **Deterministic Search Result Ordering**: When returning chunks to an agent, similarity scores must resolve ties using stable sorting criteria (e.g., `file path` ascending, then `startLine` ascending) to prevent flaky agent reasoning across identical query executions.

### 4. Backend Concurrency & Memory Safety
- **Single-Flight Indexing Mutex**: Prevent concurrent indexing runs on the exact same directory by latching promises in an active task map.
  ```typescript
  private indexingTasks = new Map<string, { promise: Promise<void>; abortController: AbortController }>();

  public async handleIndexCodebase(args: { path: string }) {
      const existing = this.indexingTasks.get(args.path);
      if (existing) {
          return { content: [{ type: "text", text: "Index already in progress for this path." }] };
      }
      const abortController = new AbortController();
      const promise = this.runIndex(args.path, abortController.signal)
          .finally(() => this.indexingTasks.delete(args.path));
      
      this.indexingTasks.set(args.path, { promise, abortController });
      return { content: [{ type: "text", text: "Indexing started." }] };
  }
  ```
- **Process-Level Cleanup Invariants**: MCP servers can receive `SIGINT` or `SIGTERM` when Claude terminates. Synchronizers and active index locks must register cleanup handlers to flush pending disk writes and abort ongoing database streams.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Safe Dynamic Dimension Auto-Detection**:
  ```typescript
  // packages/core/src/embedding/ollama-embedding.ts
  if (!this.dimensionDetected && !this.config.dimension) {
      this.dimension = await this.detectDimension();
      this.dimensionDetected = true;
  }
  // INVARIANT: embedBatch must verify array return size matches input size exactly
  if (response.embeddings.length !== processedTexts.length) {
      throw new Error(`Embedding batch mismatch: got ${response.embeddings.length}, expected ${processedTexts.length}`);
  }
  ```
- **Text Truncation Guard for Tokenizer Limits**:
  ```typescript
  protected preprocessText(text: string): string {
      if (text === '') return ' ';
      // Character boundary approximation to prevent HTTP 400 Bad Request
      const maxChars = this.maxTokens * 4;
      return text.length > maxChars ? text.substring(0, maxChars) : text;
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary**: Strict segregation between MCP transport (`@zilliz/claude-context-mcp`), core orchestration (`@zilliz/claude-context-core`), and evaluation suites (`evaluation/`).
- **Decoupling**: The core engine knows nothing about the Model Context Protocol; it simply accepts file paths, emits progress callbacks, and connects to an abstract `VectorDatabase` interface.
- **State Ownership**: Disk persistence is confined to `SnapshotManager` (`~/.context/mcp-codebase-snapshot.json`), keeping the core vector operations stateless.

### 2. Core Abstractions
- `Embedding` (`packages/core/src/embedding/base-embedding.ts`): Base class enforcing `embed()`, `embedBatch()`, `detectDimension()`, and text preprocessing contracts.
- `Splitter` (`packages/core/src/splitter/base.ts`): Uniform contract converting raw source files into arrays of `CodeChunk` structures containing line ranges, file metadata, and chunk content.
- `VectorDatabase` (`packages/core/src/vectordb/base.ts`): Encapsulates collection lifecycle, schema declaration, scalar filtering, and hybrid vector searches.

### 3. Error Handling
- Stratified exceptions: `IndexAbortError` (client-initiated cooperative cancellations), `EmbeddingError` (fatal upstream provider rejections), and recoverable file parsing skips.
- Resilient recovery: Dynamic fallback from AST chunking to regular expression/character chunking upon grammar load failures.

### 4. Testing
- Mocking native runtime APIs using Node.js native test runner (`node:test`) with `t.mock.method(os, 'homedir', ...)` and `syncBuiltinESMExports()`.
- Deterministic concurrency harnesses: Using manual deferred promises (`deferred<T>()`) to interleave and coordinate background task completion with client RPC invocations.

### 5. Security
- Sanitization of collection names via regex filtering to prevent command/vector injection:
  ```typescript
  name.replace(/[^a-zA-Z0-9_]/g, '_')
  ```
- Strict validation that custom extensions and ignore patterns adhere to valid filesystem glob contracts.

### 6. Performance
- **Batch Processing**: Texts are batched during vector generation (`embedBatch`) to minimize HTTP connection overhead.
- **Lazy AST Compilation**: Avoids loading heavy grammar libraries into V8 memory until a file of that specific extension is encountered.
- **Zero-Copy Hash Extraction**: Slicing MD5 hexadecimal outputs directly without intermediate array buffers.

### 7. Deployment
- **Monorepo Engine**: Controlled via `pnpm` workspaces with strict filter constraints (`pnpm --filter @zilliz/claude-context-core...`).
- **Environment Parity**: Explicit dependency on `engines: { node: ">=20.0.0", pnpm: ">=10.0.0" }` ensuring native `fetch` and modern crypto APIs are available without polyfills.

### 8. Agent Patterns
- **Context Preservation**: Replaces costly multi-round agent file discovery ("grep -> read -> fail -> grep again") with

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
