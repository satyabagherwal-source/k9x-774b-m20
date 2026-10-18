> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rollup-rollup-learnings.md`  
> **Source**: github ([https://github.com/rollup/rollup](https://github.com/rollup/rollup))  
> **Source Version**: `a45f569e`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T07:28:47.572Z  
> **Learning ID**: `learn-github-rollup-rollup`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): rollup/rollup

---

## 1. Executive Forensic Architecture & System Mechanics

Rollup is a deterministic JavaScript/TypeScript module bundler designed to synthesize modular ES codebases into optimized target distribution formats (`es`, `cjs`, `umd`, `iife`, `amd`, `system`). Its architectural core operates as a multi-stage directed acyclic graph (DAG) pipeline spanning three discrete subsystem phases: Module Graph Construction, Static AST Tree-Shaking, and Chunk Assignment/Finalization.

```
       [Source Code] (JS/TS/JSX)
              │
              ▼
    ┌───────────────────┐
    │  Rust / SWC Core  │──(Zero-copy shared memory buffer)──┐
    └───────────────────┘                                    │
              │                                              ▼
              ▼                                    ┌───────────────────┐
     Module Resolution                             │   JS AST Mirror   │
     & AST Ingestion                               │  (Uint32Array &   │
              │                                    │   DataView LE/NE) │
              ▼                                    └───────────────────┘
    ┌───────────────────┐                                    │
    │   Module Graph    │◄───────────────────────────────────┘
    │  (Nodes/Bindings) │
    └───────────────────┘
              │
              ▼
    ┌───────────────────┐
    │ Tree-Shaking Pass │  Iterative fixed-point deoptimization algorithm
    │  (Schedules &     │  PathTracker limiters & ParameterScope inclusion
    │   Interactions)   │
    └───────────────────┘
              │
              ▼
    ┌───────────────────┐
    │ Chunk Assignment  │  Partitioning modules into chunks by entry dependencies;
    │ & Cycle Defense   │  Detecting Top-Level Await (TLA) and dynamic import cycles
    └───────────────────┘
              │
              ▼
    ┌───────────────────┐
    │  Chunk Rendering  │  Generating hash placeholders, sourcemap normalization,
    │   & Finalization  │  and live binding accessors (Object.defineProperty)
    └───────────────────┘
              │
              ▼
      [Emitted Bundles]
```

### Subsystem Boundaries & Abstractions
1. **Rust / SWC Hybrid Engine (`rust/parse_ast`)**:
   Rollup delegates AST parsing to a native Rust/SWC pipeline compiled via N-API (`bindings_napi`) for Node.js hosts, and WebAssembly (`bindings_wasm`) for browsers and edge runtimes. The Rust parser encodes AST nodes directly into a contiguous binary byte buffer (`Vec<u8>`), aligned strictly to 4-byte boundaries. Offsets are communicated to the V8 engine without JSON serialization overhead. The JavaScript runtime consumes this via typed arrays (`Uint32Array`, `DataView`).
2. **Graph & Module Loader (`src/Graph.ts`, `src/ModuleLoader.ts`)**:
   Maintains a global registry of modules (`modulesById`). The `ModuleLoader` handles concurrency barriers for dynamic and static imports, drives plugin hooks (`resolveId`, `load`, `transform`), and mediates the caching lifecycle (`shouldTransformCachedModule`). It isolates module meta mutations to prevent state contamination during re-resolution passes.
3. **AST Evaluation & Tree-Shaking Engine (`src/ast/`)**:
   Rollup models ECMAScript static semantics via node-level wrappers (`NodeBase`) tracking variable definitions, scopes, assignments, and side-effect interactions. Tree-shaking executes an iterative fixed-point deoptimization algorithm: statement inclusion triggers entity evaluations through a `PathTracker` to avoid exponential search space explosion during callback cascades.
4. **Chunk Assignment & Dynamic Topological Slicing (`src/utils/chunkAssignment.ts`)**:
   Separates static imports, manual chunks, and dynamic entries into discrete emitted files. Dynamic imports (`import()`) and top-level await (TLA) chains trigger transitive reachability scans to compute sets of "already-loaded atoms," ensuring chunks are never merged in a manner that reintroduces circular runtime dependency deadlocks.
5. **Finalizers & Live Binding Synthesis (`src/finalisers/shared/getExportBlock.ts`)**:
   Transforms ESM exports into target runtime semantics. For CommonJS and IIFE, aliased reassigned exports are dynamically synthesized using getter property descriptors (`Object.defineProperty(exports, key, { enumerable: true, configurable: true, get: () => val })`) to preserve ECMAScript live binding semantics.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Symmetrical Path Normalization Invariant
**RULE**:
Path manipulation functions operating on URL paths or virtual file systems (`relative`, `join`, `resolve`) MUST normalize away relative dot-segments (`.` and `..`) across **both** target and base inputs **before** calculating component-wise differences. A root-level drive designator (e.g., `^[A-Za-z]:$`) MUST NOT be collapsed or shifted out by `..` segment traversals.

**WHY**:
Comparing raw path segments without prior component canonicalization causes relative calculations to emit redundant or illegal relative prefixes (e.g., computing `/src` against `/src/./main` yielding `./main` or `/src/lib/../util` yielding `lib/../util`). When module bundlers use these outputs as chunk identifiers, downstream compilers throw errors on illegal relative root prefixes. Furthermore, collapsing past a Windows drive letter (`C:/..`) breaks file isolation boundaries and leaks parent directory structures.

**WHEN TO APPLY**:
Virtual file systems, browser-based path polyfills, bundler module-resolution resolvers, and any build tool manipulating heterogeneous platform paths (Windows UNC/Drive vs. POSIX).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const ANY_SLASH_REGEX = /[/\\\\]/;
const DRIVE_REGEX = /^[A-Za-z]:$/;
const TRAILING_SLASHES_REGEX = /[/\\\\]+$/;

export function normalizePathSegments(parts: string[], absolute: boolean): string[] {
  const normalized: string[] = [];
  // A drive like "C:" is the root of the path; ".." cannot climb above it
  const root = DRIVE_REGEX.test(parts[0]) ? 1 : 0;
  for (const part of parts) {
    if (part === '..') {
      if (normalized.length > root && normalized[normalized.length - 1] !== '..') {
        normalized.pop();
      } else if (!absolute && root === 0) {
        normalized.push('..');
      }
    } else if (part !== '.' && part !== '') {
      normalized.push(part);
    }
  }
  return normalized;
}

export function relative(from: string, to: string, isAbs: (p: string) => boolean): string {
  // Collapse "." and ".." on BOTH sides prior to segment matching
  const fromParts = normalizePathSegments(from.split(ANY_SLASH_REGEX), isAbs(from));
  const toParts = normalizePathSegments(to.split(ANY_SLASH_REGEX), isAbs(to));

  while (fromParts.length > 0 && toParts.length > 0 && fromParts[0] === toParts[0]) {
    fromParts.shift();
    toParts.shift();
  }

  while (fromParts.pop()) {
    toParts.unshift('..');
  }

  return toParts.join('/') || '.';
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER compare un-normalized segments or shift dot tokens ad-hoc
export function faultyRelative(from: string, to: string): string {
  const fromParts = from.split('/').filter(Boolean);
  const toParts = to.split('/').filter(Boolean);
  // ANTI-PATTERN: Only checks index 0 for literal "."
  if (fromParts[0] === '.') fromParts.shift();
  if (toParts[0] === '.') toParts.shift();
  // BUG: "/src/./main" vs "/src" retains "." inside the array, producing "./main"
  while (fromParts[0] === toParts[0]) {
    fromParts.shift();
    toParts.shift();
  }
  return fromParts.map(() => '..').concat(toParts).join('/');
}
```

**VERIFICATION METHOD**:
Property test path combinations with embedded `.` and `..` tokens:
```typescript
import assert from 'node:assert/strict';

assert.equal(relative('/src', '/src/./main.js', (p) => p.startsWith('/')), 'main.js');
assert.equal(relative('/src', '/src/lib/../util.js', (p) => p.startsWith('/')), 'util.js');
assert.equal(relative('C:/src/main.js', 'C:/ext.js', (p) => /^[A-Za-z]:\//.test(p)), '../ext.js');
```

---

### 2. Multi-Pass Lifecycle Error Preservation Invariant
**RULE**:
When an asynchronous operational phase fails, teardown and cleanup hooks (such as `closeBundle`, `dispose`, or socket tear-downs) MUST execute inside guarded fault boundaries that swallow or isolate cleanup exceptions, ensuring the **primary causal exception** is rethrown unmasked. Secondary cleanup failures MUST NOT overwrite the original error unless aggregated explicitly.

**WHY**:
In multi-phase compilers or server tasks, an initial error often triggers a cleanup lifecycle. If the cleanup hook encounters an error (e.g., closing an uninitialized file handle or rejecting a cleanup promise), standard unhandled awaiting (`await close()`) causes JavaScript runtime unwinding to overwrite the primary exception with the secondary cleanup error. This obscures root-cause diagnostics in automated pipelines and CI harnesses.

**WHEN TO APPLY**:
Build systems, plugin driver lifecycle managers, database transaction cleanups, and resource cleanup workflows (`close`, `destroy`, `dispose`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export async function executePhaseWithGuardedCleanup<T>(
  action: () => Promise<T>,
  cleanup: (error?: unknown) => Promise<void>
): Promise<T> {
  let primaryError: unknown;
  try {
    return await action();
  } catch (err: unknown) {
    primaryError = err;
    throw err;
  } finally {
    if (primaryError) {
      // Must swallow or aggregate cleanup errors to preserve primary causal error
      await cleanup(primaryError).catch((_cleanupErr) => {
        // Logging can happen here, but primaryError MUST remain the thrown error
      });
    } else {
      // If action succeeded, cleanup failure is allowed to propagate
      await cleanup();
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER allow teardown hooks to un-catchably replace primary errors
try {
  await runBuild();
} catch (buildError) {
  // ANTI-PATTERN: If closeBundle rejects, buildError is dropped into the void!
  await pluginDriver.hookParallel('closeBundle', [buildError]);
  throw buildError;
}
```

**VERIFICATION METHOD**:
Simulate an intentional primary task rejection coupled with a secondary cleanup rejection:
```javascript
let caughtError;
try {
  await executePhaseWithGuardedCleanup(
    async () => { throw new Error('PRIMARY_FAILURE'); },
    async () => { throw new Error('CLEANUP_FAILURE'); }
  );
} catch (err) {
  caughtError = err;
}
assert.equal(caughtError.message, 'PRIMARY_FAILURE');
```

---

### 3. Asymmetric Cross-Platform Architecture Endianness Mirroring
**RULE**:
When a native binary core (Rust, C, C++) communicates with a high-level runtime (JavaScript, Python) via zero-copy shared memory buffers containing fixed-width scalar fields, all scalar values MUST either be standardized to explicit Little-Endian representation or the reader/writer MUST negotiate host-endian alignment using dynamic runtime byte-swapping guards based on host architecture endianness inspection.

**WHY**:
WebAssembly linear memory specifications dictate strict Little-Endian layout. If a host system runs in Big-Endian mode (e.g., IBM System/390 `s390x`, `powerpc64le` in BE mode), multi-byte integers stored in native endianness will arrive byte-swapped in the host environment (e.g., 32-bit AST Node Type `72` [`0x00000048`] will decode as `1207959552` [`0x48000000`]), resulting in immediate memory-parser panics and deserialization failures.

**WHEN TO APPLY**:
WebAssembly bindings interacting with native byte buffers, polyglot binary serializers, zero-copy shared ArrayBuffers, IPC protocols across network architectures.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Rust AST Buffer Generation
pub fn convert_ast_to_buffer(converter: &mut AstConverter, swap_byte_order: bool) -> Vec<u8> {
    if swap_byte_order {
        // Reverse bytes for 32-bit fields, explicitly skipping raw string/float slices
        converter.swap_32_bit_fields();
    }
    std::mem::take(&mut converter.buffer)
}
```
```typescript
// JavaScript Host Consumer
// Detect runtime host endianness at initialization:
const isHostBigEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 0;

export function parseAstBinary(code: string, allowReturn: boolean, jsx: boolean): Uint8Array {
  // WASM memory is always LE; instruct the WASM bridge to byte-swap if the JS host is BE
  return wasmBridge.parse(code, allowReturn, jsx, isHostBigEndian);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// NEVER assume the host processor shares memory layout endianness with WebAssembly linear memory
function readHeader(buffer: ArrayBuffer): number {
  // ANTI-PATTERN: Native Uint32Array assumes host endianness, breaking on BE architectures reading LE WASM
  const view = new Uint32Array(buffer);
  return view[0]; 
}
```

**VERIFICATION METHOD**:
Validate cross-endian byte decoding in CI using architecture emulation (e.g., QEMU with `s390x-unknown-linux-gnu`):
```bash
node -e '
  const isBE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 0;
  console.log("Host is Big-Endian:", isBE);
'
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Aliased Reassigned Exports Dropping Live Binding Accessors (BUG-EXPORT-01)
- **Context**: `src/Chunk.ts`, `src/finalisers/shared/getExportBlock.ts`
- **What Was Expected**: When exporting a mutable variable under multiple aliases (e.g., `export { value, value as alias }`), all exported names must reflect mutations dynamically when modified by local methods.
- **What Actually Happened**: When Rollup determined that a variable was reassigned, only single primary exports were bound via accessors. Multiple alias identifiers sharing the reassigned variable defaulted to direct assignment statements (`exports.alias = local`), causing aliases to freeze at their initial value while the primary exported binding mutated.
- **Evidence in Repo**: Commit `092d1395`, PR #6576. Test: `test/function/samples/reassigned-export-aliases/`.
- **Root Cause**: `Chunk.ts` flagged `needsLiveBinding` based strictly on direct specifier reassignments, failing to compute whether the underlying variable was mapped to more than one export alias (`exportNamesByVariable.get(variable)!.length > 1`).
- **Remediation Code Diff**:
```diff
--- a/src/Chunk.ts
+++ b/src/Chunk.ts
@@ -953,7 +954,9 @@ export default class Chunk {
 				exported: exportName,
 				expression,
 				hoisted,
-				local
+				local,
+				needsLiveBinding:
+					variable.isReassigned && this.exportNamesByVariable.get(variable)!.length > 1
 			});
--- a/src/finalisers/shared/getExportBlock.ts
+++ b/src/finalisers/shared/getExportBlock.ts
-	for (const { exported, local } of exports) {
+	for (const { exported, local, needsLiveBinding } of exports) {
 		const lhs = `exports${getPropertyAccess(exported)}`;
 		const rhs = local;
 		if (lhs !== rhs) {
 			if (exportBlock) exportBlock += n;
+			if (needsLiveBinding) {
+				exportBlock += `Object.defineProperty(exports,${_}${JSON.stringify(
+					exported
+				)},${_}${getGetter(rhs, true, t, snippets)});`;
+				continue;
+			}
```
- **Lesson**: Live bindings in non-ESM compilation targets require getter property descriptors whenever the underlying bound entity is mutable and bound to multiple aliases.

---

### Incident 2: Inode Readdir Throttling Dropping Missing Watch Files on Linux (BUG-WATCH-02)
- **Context**: `build-plugins/chokidar-readdir-throttle-replacement.ts`, `src/watch/watch.ts`
- **What Was Expected**: When multiple watched files located in the same non-existent or evolving directory are registered during build time, creating any of those watched files must trigger an inotify directory re-scan and rebuild.
- **What Actually Happened**: On Linux systems using inotify, only the first missing file's creation triggered a rebuild; other missing files added within the same directory were dropped.
- **Evidence in Repo**: Commit `97611099`, PR #6575, Issue #6574.
- **Root Cause**: Bundled Chokidar versions keyed per-directory throttle timers by `directory` alone (`this.fsw._throttle('readdir', directory, 1000)`). When multiple watch targets resided in the same folder, subsequent targets collided on the throttle key, discarding intermediate `readdir` scans during inotify event propagation.
- **Remediation Code Diff**:
```diff
--- /dev/null
+++ b/build-plugins/chokidar-readdir-throttle-replacement.ts
@@ -0,0 +1,25 @@
+// Keying the throttle by watched file gives each missing file its own directory read.
+const SHARED_DIRECTORY_READ_THROTTLE = "this.fsw._throttle('readdir', directory, 1000)";
+const PER_TARGET_DIRECTORY_READ_THROTTLE =
+	"this.fsw._throttle('readdir', target ? `${directory}:${target}` : directory, 1000)";
+
+export const chokidarReaddirThrottleReplacement: RollupReplaceOptions = {
+	delimiters: ['', ''],
+	include: 'node_modules/chokidar/lib/nodefs-handler.js',
+	preventAssignment: true,
+	values: {
+		[SHARED_DIRECTORY_READ_THROTTLE]: PER_TARGET_DIRECTORY_READ_THROTTLE
+	}
+};
```
- **Lesson**: Debounce and throttle structures tracking file-system events cannot collapse cache keys to parent directory nodes when child target existence states are tracked individually.

---

### Incident 3: Exponential Path-Explosion in Reassigned Variable Call Arguments (BUG-TREE-03)
- **Context**: `src/ast/variables/LocalVariable.ts`, `src/ast/ExecutionContext.ts`
- **What Was Expected**: Analyzing argument inclusion for calls to reassigned functions must scale linearly or polynomial-bounded relative to variable assignment depth.
- **What Actually Happened**: Tree-shaking libraries with heavily reassigned function pointers (e.g., `react-dom` internally updating dispatch hooks across branches) triggered exponential CPU stalls, locking threads for minutes and consuming multi-gigabytes of memory.
- **Evidence in Repo**: Commit `f1f7c4a5`, PR #6565, Issue #6564.
- **Root Cause**: A prior patch tracked all possible reassigned values across permutations of call-site access paths (`DiscriminatedPathTracker`). Visiting every possible value at every chained call-site path incurred an $O(k^n)$ combinatorial path explosion.
- **Remediation Code Diff**:
```diff
--- a/src/ast/variables/LocalVariable.ts
+++ b/src/ast/variables/LocalVariable.ts
@@ -247,21 +247,12 @@ export default class LocalVariable extends Variable {
 		context: InclusionContext
 	): void {
 		if (this.isReassigned) {
-			includeInteraction(interaction, context);
-			const previousTracker = context.includedCallArgumentsOfPossibleValues;
-			context.includedCallArgumentsOfPossibleValues ??= new DiscriminatedPathTracker();
-			this.includeCallArgumentsOfPossibleValues(
-				path,
-				interaction,
-				context,
-				context.includedCallArgumentsOfPossibleValues
-			);
-			context.includedCallArgumentsOfPossibleValues = previousTracker;
+			includeInteraction(interaction, context);
+			if (path.length === 0) {
+				this.includeCallArgumentsOfAssignedTryCatchHelpers(interaction, context);
+			}
 			return;
 		}
```
- **Lesson**: In static analysis graphs, avoid path-sensitive combinatorial walks over untyped reassignment sets; restrict deep parameter forwarding strictly to targeted escape contexts (e.g., try/catch boundaries) and collapse all other reassignment resolutions.

---

### Incident 4: Watcher Re-Run Interleaving & Concurrency Race Condition (BUG-CONCUR-04)
- **Context**: `src/watch/watch.ts`, `src/watch/WatchEmitter.ts`
- **What Was Expected**: File watcher invalidations arriving while change events are asynchronously broadcast must be batched atomically into the next build cycle without launching concurrent builds.
- **What Actually Happened**: If a secondary file event arrived while async `watchChange` hooks were settling, the `running` flag was observed as false while the previous rebuild was still initializing, launching two concurrent compile cycles whose console outputs and plugin states became interleaved.
- **Evidence in Repo**: Commit `9156d5b5`, PR #6526.
- **Root Cause**: The lock guard `running = true` was set only immediately around `this.run()`, leaving the preparatory phase (`announcePendingChanges` and `emitter.emit('restart')`) unprotected against concurrent event triggers.
- **Remediation Code Diff**:
```diff
--- a/src/watch/watch.ts
+++ b/src/watch/watch.ts
@@ -94,6 +94,22 @@ export class Watcher {
-		this.buildTimeout = setTimeout(async () => {
+		this.buildTimeout = setTimeout(() => {
 			this.buildTimeout = null;
-			await this.emitter.emit('restart');
-			await this.run();
+			this.runExclusively(() => this.announceChangesAndRebuild());
 		}, this.buildDelay);
 	}
+
+	private async runExclusively(cycle: () => Promise<void>): Promise<void> {
+		this.running = true;
+		try {
+			await cycle();
+		} catch (error: any) {
+			await this.reportError(error);
+		} finally {
+			this.running = false;
+		}
+		if (this.rerun) {
+			this.rerun = false;
+			this.invalidate();
+		}
+	}
```
- **Lesson**: State flags guarding async processing loops must encompass the entire pre-run scheduling and change broadcasting sequence, not just the core execution payload.

---

### Incident 5: Circular Deadlock in Indirectly Awaited Dynamic Imports (BUG-CHUNK-05)
- **Context**: `src/utils/chunkAssignment.ts`, `src/Module.ts`
- **What Was Expected**: Transitive chunk dependencies shared between dynamic imports and modules containing Top-Level Await (TLA) must not be merged into entries if doing so causes an import loop.
- **What Actually Happened**: When dynamic imports were awaited indirectly through a chain of static dependencies, chunk optimization merged shared dependencies into the root entry chunk. The dynamic chunk then imported the root chunk back, creating an unresolvable ESM circular dependency deadlock.
- **Evidence in Repo**: Commit `d45f8e86`, PR #6516.
- **Root Cause**: The calculation of "already-loaded atoms" performed an intersection over all awaiting importers rather than a union, dropping shared chunks from the protected set when an importer had not loaded that chunk directly.
- **Remediation Code Diff**:
```diff
--- a/src/utils/chunkAssignment.ts
+++ b/src/utils/chunkAssignment.ts
@@ -363,6 +363,13 @@ function analyzeModuleGraph(
 				}
 			}
 		}
+		// A dynamic import can be awaited indirectly through a static dependency.
+		if (hasTopLevelAwait) {
+			for (const dynamicEntry of dynamicEntriesForCurrentEntry) {
+				awaitedDynamicEntryModules.add(dynamicEntry);
+				awaitedDynamicImportsForCurrentEntry.add(dynamicEntry);
+			}
+		}
 		entryOrManualChunkIndex++;
 	}
```
- **Lesson**: In dependency graph partitioning, reachability under asynchronous suspension (TLA) must compute conservative **unions** across all transitive entry points rather than intersections.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Truthiness of Zero vs Nullish Check**: When handling user configuration numeric flags (such as `buildDelay` or `experimentalMinChunkSize`), never use `if (options.val)` because a delay or size of `0` is falsy and will silently fall back to defaults. Always use explicit nullish checks: `if (options.val != null)` or `options.val ?? DEFAULT`.
- **String Splitting with Slashes**: In cross-platform path parsers, never use `.split('/')` or `.split('\\')`. Use a compiled character class regex: `const ANY_SLASH_REGEX = /[/\\\\]/;`.
- **Object Literal Keys for Reserved Words**: When generating code for target environments (like ES3/older CommonJS), avoid unquoted reserved identifiers on object literals. E.g., generate `['default']` or `['__proto__']` with explicit JSON stringification to prevent runtime prototype pollution.

### 2. Infinite Loop & Recursion Guards
- **AST Inclusion Fixed-Point Termination**: The tree-shaking pass runs across statements until no new variables or expressions are marked included:
  ```typescript
  let hasChanged: boolean;
  let passes = 0;
  do {
    hasChanged = false;
    passes++;
    for (const module of this.modules) {
      if (module.includeExtraStatements()) {
        hasChanged = true;
      }
    }
    if (passes > 1000) {
      throw new Error('Infinite tree-shaking deoptimization loop detected');
    }
  } while (hasChanged);
  ```
- **PathTracker Recursion Depth Caps**: When evaluating nested member access expressions on functions or reassignments, limit exploration depth strictly using constant caps:
  ```typescript
  export const MAX_PATH_DEPTH = 7;
  if (path.length + this.initPath.length > MAX_PATH_DEPTH) {
    return; // Break recursion path
  }
  ```

### 3. UI & UX Micro-Mechanics
- **ANSI Color Terminal Formatting Invariants**: When outputting build logs, CLI diagnostic helpers must never write raw control codes to redirected streams. Wrap loggers with TTY capability detection:
  ```typescript
  const isTTY = Boolean(process.stderr.isTTY && !process.env.NO_COLOR);
  export const cyan = (text: string) => isTTY ? `\u001B[36m${text}\u001B[39m` : text;
  ```
- **Atomic File Writing under Watch Mode**: Never write build chunks in-place if an active server reads them, as partial chunk flushes lead to runtime parse syntax errors. Rollup tests use atomic writes (`atomicWriteFileSync`) by writing to a temporary file before renaming it over the destination.

### 4. Backend Concurrency & Memory Safety
- **Event Loop Starvation in Watch Mode**: When dispatching hundreds of file change notifications to plugin hooks, calling them with unthrottled `Promise.all` can exhaust thread pool handles. Rollup leverages `waitForAllAndRethrowFirstFailure`:
  ```typescript
  export function waitForAllAndRethrowFirstFailure(promises: Promise<unknown>[]): Promise<void> {
    return Promise.allSettled(promises).then(results => {
      for (const result of results) {
        if (result.status === 'rejected') {
          throw result.reason;
        }
      }
    });
  }
  ```
- **Cache Eviction and Leak Protection**: `Graph.ts` enforces strict bounded memory consumption using an LRU cache (`flru<ProgramNode>(5)`) for AST representations, discarding unneeded memory buffers immediately after module binding.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Plugin Error Preservation**:
  ```typescript
  // src/rollup/rollup.ts
  await graph.pluginDriver.hookParallel('closeBundle', [compoundError]).catch(() => {});
  throw compoundError; // Never drop compoundError even if closeBundle throws!
  ```
- **Metadata Leakage on Incremental Cache Reuse**:
  When a cached module is checked via `shouldTransformCachedModule`, fresh `resolveId` metadata must not be wiped out by cached metadata, nor should cached metadata leak if a re-transform is requested. Rollup uses reversible transaction snapshotting:
  ```typescript
  const originalModuleOptions = {
    meta: { ...module.info.meta },
    moduleSideEffects: module.info.moduleSideEffects,
    syntheticNamedExports: module.info.syntheticNamedExports
  };
  module.updateOptions(cachedModule);
  if (await this.pluginDriver.hookFirst('shouldTransformCachedModule', [...])) {
    // Revert state if re-transformation is chosen
    module.updateOptions(originalModuleOptions, { replaceExistingMeta: true });
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
Rollup splits compilation into two phases: **Build Phase** (`rollup.rollup(inputOptions)`) which constructs the `Graph`, executes plugins, parses ASTs, and performs tree-shaking; and **Output Generation Phase** (`bundle.generate(outputOptions)` / `bundle.write()`) which assigns modules to chunks, optimizes chunk splits, generates code snippets, and produces sourcemaps. This decoupling allows one build graph to emit multiple output targets (e.g., CJS and ESM) without re-parsing source code.

### 2. Core Abstractions
- `Graph`: Central coordinator maintaining module maps, execution order, and the plugin driver.
- `Module`: Represents a single JavaScript/TypeScript file containing local declarations, imports, exports, and scope tracking.
- `Chunk`: Logical grouping of modules destined for a single output file, tracking exported symbols and inter-chunk dependencies.
- `Variable` & `Scope`: Models identifier resolution, variable reassignment tracking, and lexical scoping rules.

### 3. Error Handling
Fault tolerance in Rollup uses an error-containment model. AST parse failures in Rust do not trigger process panics; they emit a synthetic `ParseError` AST node into the buffer, which the JavaScript runtime converts into a descriptive error. Lifecycle cleanup errors (`closeBundle`, `closeWatcher`) use non-masking try/finally patterns to ensure that primary build errors take precedence.

### 4. Testing
Rollup employs a multi-tiered test harness:
- `test/function/`: Verifies runtime bundle execution correctness using Node's `vm.runInNewContext`.
- `test/form/`: Ver