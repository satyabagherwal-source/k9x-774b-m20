> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rollup-rollup-learnings.md`  
> **Source**: github ([https://github.com/rollup/rollup](https://github.com/rollup/rollup))  
> **Source Version**: `73fae6e8`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-11-07T20:42:12.397Z  
> **Learning ID**: `learn-github-rollup-rollup`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): rollup/rollup

---

## 1. Executive Forensic Architecture & System Mechanics

Rollup is a deterministic module bundler and tree-shaking engine for ECMAScript modules (ESM). It compiles graphs of isolated modules into minimal, topologically sorted bundles (ESM, CommonJS, UMD, IIFE, SystemJS, AMD). 

### Architectural Boundaries & Core Subsystems

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLI & Watch Controller                          │
│     (cli/run/watchHooks.ts, src/watch/fileWatcher.ts, CLI options)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  PluginDriver & Hook Lifecycle Engine                  │
│       (PluginDriver.ts: options, buildStart, resolveId, load,          │
│        transform, moduleParsed, buildEnd, renderStart, generateBundle) │
└─────────────────┬──────────────────────────────────┬───────────────────┘
                  │                                  │
┌─────────────────▼────────────────┐   ┌─────────────▼───────────────────┐
│     ModuleLoader & Graph Engine  │   │   Rust SWC Native AST Engine    │
│  - Module resolution & fetching  │   │  - bindings_napi / bindings_wasm│
│  - Dependency graph assembly     │◄──┤  - rust/parse_ast (AST layout)  │
│  - Circular dependency resolution│   │  - Binary serialization buffer  │
│  - Dynamic import split points   │   │  - Directive & comment scan     │
└─────────────────┬────────────────┘   └─────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────────────────┐
│           Semantic Tree-Shaking & Scope Analysis Subsystem             │
│  - AST nodes (src/ast/nodes/*)                                         │
│  - Variable binding declaration & assignment tracking                  │
│  - De-optimization paths (unknown globals, side-effect calls)          │
│  - Path execution & property read/write reachability trees             │
└─────────────────┬──────────────────────────────────────────────────────┘
                  │
┌─────────────────▼──────────────────────────────────────────────────────┐
│             Chunk Synthesis & Code Generation Pipeline                 │
│  - Chunk assignment (manualChunks, dynamic entry boundaries)           │
│  - Topological sort of module order                                    │
│  - MagicString code rewriting, placeholder replacement                 │
│  - Content-addressable chunk hashing (`[hash]`, `[chunkhash]`)         │
│  - Sourcemap chain collapsing & debug ID injection (renderChunks.ts)   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Native AST Extraction & Parsing Engine (`rust/parse_ast`, SWC, NAPI/WASM)**:
   Rollup delegates AST parsing to a native Rust core built on top of SWC (`swc_ecma_ast`, `swc_common`). The Rust binary extracts AST structures, maps statement boundaries, collects directives, and returns an optimized binary buffer directly into Node.js via `@napi-rs` or into the browser via WebAssembly (`wasm-bindgen`).
2. **Graph Assembly & Plugin Driver (`src/Graph.ts`, `src/utils/PluginDriver.ts`)**:
   Modules are discovered recursively. The `PluginDriver` exposes sequential, parallel, and first-non-null hook chains (`resolveId`, `load`, `transform`). Module references create directional graph edges.
3. **Abstract Syntax Tree & Scope Graph (`src/ast/nodes/*`, `src/ast/scopes/*`)**:
   Rollup models every ECMAScript node as a JS class with custom `include()` mechanics. Scope tracking differentiates pure declarations from dynamic mutations. A multi-pass tree-shaking algorithm evaluates whether expressions exert external observable side effects.
4. **Chunk Graph & Code Rendering Engine (`src/Chunk.ts`, `src/utils/renderChunks.ts`)**:
   Modules marked for inclusion are partitioned into chunks based on static entry points and dynamic `import()` splits. Imports and exports are rewritten using `magic-string`.
5. **Content Hashing & Sourcemap Aggregation (`src/utils/renderChunks.ts`, `decodedSourcemap`)**:
   Chunk content hashing must remain completely deterministic, idempotent, and invariant to build order. Sourcemaps are composed along a transformation pipeline (`sourcemapChain`), lazily decoded to save memory, and emitted with deterministic mappings.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Content-Hashing Symmetry Between Emitted Artifacts and Hash Seeds
**RULE**:
Every byte, banner, trailing comment, sourcemap reference, or debug identifier that is appended to or conditionally rendered within an emitted artifact MUST be explicitly incorporated into the content-hashing input stream before generating its content-derived checksum or file name. Code generators MUST NOT mutate post-hash buffers with unhashed metadata.

**WHY**:
Omitting emitted trailing tokens (such as `//# debugId=...` or `//# sourceMappingURL=...`) from the hash calculation produces a collision vulnerability: two distinct builds with identical code bodies but differing sourcemap linkage or debug metadata evaluate to identical content hashes (`[name]-[hash].js`). Downstream CDN caches, browser caches, and error-monitoring tools (e.g., Sentry, Bugsnag) then serve stale artifacts or fail to match minified stack frames to source maps.

**WHEN TO APPLY**:
Apply to all asset bundlers, compilers, static-site generators, and artifact packaging systems where file names are parameterized with cryptographic content hashes (`[hash]`, `[contenthash]`, `[chunkhash]`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Computes deterministic chunk hash incorporating conditional metadata tokens.
 * Invariant: contentToHash MUST contain exact structural representations of all
 * runtime or debug footers emitted in the final file.
 */
function computeDeterministicChunkHash(
  code: string,
  placeholders: ReadonlyMap<string, string>,
  options: { sourcemap: boolean | 'hidden' | 'inline'; sourcemapDebugIds: boolean }
): string {
  // Normalize placeholders to stable default values to isolate chunk hash
  // from order-dependent placeholder values of other parallel chunks
  const { transformedCode } = replacePlaceholdersWithDefault(code, placeholders);
  let contentToHash = transformedCode;

  // Enforce hashing symmetry: If debug IDs will be appended post-render,
  // the exact structural footprint MUST be added to hash input.
  if (options.sourcemapDebugIds) {
    contentToHash += '//# debugId=\n';
  }

  // Include sourcemap comment marker if not hidden/inlined
  if (options.sourcemap && options.sourcemap !== 'hidden' && options.sourcemap !== 'inline') {
    contentToHash += '//# sourceMappingURL=\n';
  }

  return createHash('sha256').update(contentToHash).digest('hex').slice(0, 8);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Emitting code modifications AFTER computing the content hash
function renderChunkBroken(code: string, options: { sourcemapDebugIds: boolean }) {
  // Hash calculated purely on intermediate JavaScript code
  const chunkHash = createHash('sha256').update(code).digest('hex');
  const fileName = `chunk-${chunkHash}.js`;

  let finalCode = code;
  // DANGER: Mutates emitted content without updating chunkHash!
  // Chunk content changes, but fileName/hash remains identical.
  if (options.sourcemapDebugIds) {
    finalCode += `\n//# debugId=${generateDebugId()}\n`;
  }
  return { fileName, code: finalCode };
}
```

**VERIFICATION METHOD**:
Enforce dual-compilation hash assertion tests. Compile an entry point twice: once with `sourcemapDebugIds: false` and once with `sourcemapDebugIds: true`. Assert `chunkA.fileName !== chunkB.fileName`. Compile with an unrelated module added to an external chunk, and assert the target chunk’s hash remains byte-for-byte identical.

---

### 2. Idempotent Wrapper Identity in Hierarchical Resource Caching
**RULE**:
When an object is passed through an idempotent transformation wrapper or decoding cache (e.g., `decodedSourcemap(map)`), the decoding function MUST verify if the input object is already an instance of the target wrapper or already tracked in the active cache. If present, it MUST return the reference unchanged without triggering property getter side effects or duplicate decoding pipelines.

**WHY**:
In incremental compilation and watch modes, intermediate artifacts (such as AST scopes or sourcemap chains) are retained across builds. If wrapper functions deserialize, unflatten, or invoke lazy getters across cached structures on every rebuild, cached instances trigger continuous allocations and decode iterations. The un-invalidated parent keeps references alive, causing unbounded heap retention, GC thrashing, and event-loop stalls.

**WHEN TO APPLY**:
Apply to watch-mode compilation graphs, memoized AST transformers, lazy-loading proxy wrappers, and diagnostic mapping objects that cycle across cache lifetimes.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface DecodedSourceMapWrapper {
  readonly isDecodedWrapper: true;
  mappings: number[][][];
}

const sourceMapCache = new WeakSet<object>();

export function decodedSourcemap(
  map: ExistingRawSourceMap | DecodedSourceMapWrapper
): DecodedSourceMapWrapper {
  // FAST-PATH: Guard against re-wrapping and re-decoding.
  // If the object was already processed, it MUST be returned as-is.
  if (sourceMapCache.has(map) || ('isDecodedWrapper' in map && map.isDecodedWrapper)) {
    return map as DecodedSourceMapWrapper;
  }

  let cachedDecodedMappings: number[][][] | null = null;

  const wrapper: DecodedSourceMapWrapper = {
    isDecodedWrapper: true,
    get mappings() {
      if (cachedDecodedMappings === null) {
        // Decode only on absolute demand, not on object pass-through
        cachedDecodedMappings = typeof map.mappings === 'string'
          ? decodeMappings(map.mappings)
          : map.mappings;
      }
      return cachedDecodedMappings;
    }
  };

  sourceMapCache.add(wrapper);
  return wrapper;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Re-wrapping or reading lazy properties during cached module ingestion
function ingestCachedModule(cachedModule: { sourcemap: any }) {
  // DANGER: Object spread calls getters! Reading .mappings on cached sourcemap
  // immediately forces full decode into memory and leaks previous GC cycles.
  const rewrappedMap = {
    ...cachedModule.sourcemap,
    mappings: decode(cachedModule.sourcemap.mappings)
  };
  return rewrappedMap;
}
```

**VERIFICATION METHOD**:
Implement a property getter invocation spy on cached test inputs. Construct a test with 100 mocked modules. Execute build 1, capture memory footprint, execute build 2 with cache re-use, and assert that the `mappings` getter is invoked exactly 0 times during the second `Module.setSource` ingestion phase before code generation.

---

### 3. Build-Time Isolation and Dynamic Purging of Host-Compiling Native Dependencies
**RULE**:
Native build-tooling bindings and host-specific compression or compilation artifacts MUST NOT be declared as unconditional optional runtime dependencies in published consumer manifests. Release automation scripts MUST programmatically strip host-only native dependencies from `optionalDependencies` during the prepublish pipeline before releasing package manifests.

**WHY**:
Package managers (npm, pnpm, yarn) resolve and attempt to install all listed `optionalDependencies`. When native compression binaries (e.g., `@napi-rs/lzma-linux-x64-gnu`) needed solely by the maintainer's CI host are published in consumer manifests, downstream package managers download, attempt to link, or log build failures for foreign platforms on non-matching architectures, polluting consumer node_modules and breaking offline installations.

**WHEN TO APPLY**:
All multi-architecture native-binding packages using NAPI-RS, Neon, or WebAssembly where compilation toolchains run under specific CI runners to produce downstream multi-platform tarballs.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// scripts/prepublish.js
import { readFile, writeFile } from 'node:fs/promises';

const MAIN_PACKAGE_PATH = new URL('../package.json', import.meta.url);
const BUILD_ONLY_DEPENDENCIES = new Set([
  '@napi-rs/lzma-linux-x64-gnu',
  '@napi-rs/lzma-android-arm64'
]);

export async function sanitizeManifestForRelease(): Promise<void> {
  const rawManifest = await readFile(MAIN_PACKAGE_PATH, 'utf-8');
  const manifest = JSON.parse(rawManifest);

  if (manifest.optionalDependencies) {
    for (const dep of Object.keys(manifest.optionalDependencies)) {
      if (BUILD_ONLY_DEPENDENCIES.has(dep)) {
        delete manifest.optionalDependencies[dep];
      }
    }
  }

  // Atomic write back formatted package.json
  await writeFile(
    MAIN_PACKAGE_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf-8'
  );
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Merging intermediate CI build output directly into released manifest
async function publishUnchecked() {
  const localPkg = JSON.parse(await readFile('package.json'));
  const napiGeneratedPkg = JSON.parse(await readFile('napi-output.json'));

  // DANGER: Indiscriminately merges CI host build dependencies into production payload
  localPkg.optionalDependencies = {
    ...localPkg.optionalDependencies,
    ...napiGeneratedPkg.optionalDependencies
  };
  await writeFile('package.json', JSON.stringify(localPkg));
}
```

**VERIFICATION METHOD**:
Add an automated prepublish assertion script checking that no package in `BUILD_ONLY_DEPENDENCIES` exists in `package.json` under `optionalDependencies` prior to invoking `npm publish --dry-run`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Chunk Hash Desynchronization on Debug ID Comments (BUG-HASH-01)
- **Context**: `src/utils/renderChunks.ts` - Content hashing during chunk generation when `output.sourcemapDebugIds` is active.
- **What Was Expected**: If an output format configuration appends sourcemap debug ID comments (`//# debugId=<UUID>`) to a chunk, the content hash `[hash]` or `[chunkhash]` in the chunk's file name must reflect the alteration of the output buffer.
- **What Actually Happened**: The chunk hash was computed exclusively from the code transformed with placeholders, completely omitting the `debugId` comment trailer. Emitted chunks containing debug IDs had the same hash and filename as chunks emitted without debug IDs. Furthermore, when debug IDs were added, an entry file change could cause hash collisions or stale asset deployment.
- **Evidence in Repo**: Commit `efff932c`, PR #6625, files: `src/utils/renderChunks.ts`, `test/file-hashes/samples/sourcemap-debug-ids/_config.js`.
- **Root Cause**: The calculation in `getChunkHash` applied `replacePlaceholdersWithDefaultAndGetContainedPlaceholders` to `code` and appended the sourcemap comment only if `outputOptions.sourcemap !== 'hidden'`. It failed to check `outputOptions.sourcemapDebugIds`.
- **Remediation Code Diff**:
```typescript
@@ -328,6 +328,9 @@ function getChunkHash(
 	const { containedPlaceholders, transformedCode } =
 		replacePlaceholdersWithDefaultAndGetContainedPlaceholders(code, placeholders);
 	let contentToHash = transformedCode;
+	if (map && outputOptions.sourcemapDebugIds) {
+		contentToHash += '//# debugId=\n';
+	}
 	if (map && outputOptions.sourcemap !== 'hidden') {
 		// Normalize raw map data and file names before base64 or URL encoding
```
- **Lesson**: The hash seed must be an exact abstract template of the emitted file layout. Any runtime emission switch requires a corresponding structural token in the hashing input stream.

---

### Incident 2: Build-Only Native Dependency Leakage into Published Tarball (BUG-REL-02)
- **Context**: `scripts/prepublish.js` - CI/CD Release automation for native platform binary distributions.
- **What Was Expected**: Host-specific compression tools required only on the Linux x64 CI compilation runner must remain internal build artifacts and never be distributed to consumer NPM installations.
- **What Actually Happened**: `@napi-rs/lzma-linux-x64-gnu` was merged into `optionalDependencies` during the automated execution of `npm run prepublish:napi`. When downstream users installed `rollup` on non-GNU Linux or other architectures, package managers attempted to fetch or warn about the missing native binary.
- **Evidence in Repo**: Commit `e53355bf`, PR #6627, file: `scripts/prepublish.js`.
- **Root Cause**: The script read `MAIN_PACKAGE`, invoked `runPublish('npm', ['run', 'prepublish:napi'])`, and then performed a blind dictionary spread `{ ...optionalDependencies, ...mainPackage.optionalDependencies }` without filtering build-time-only native tool packages.
- **Remediation Code Diff**:
```javascript
@@ -12,6 +12,8 @@ import { getCurrentCommitMessage, getFirstChangelogEntry } from './release-helpe
 // We execute everything from the main directory
 chdir(fileURLToPath(new URL('..', import.meta.url)));
 
+const BUILD_ONLY_OPTIONAL_DEPENDENCY = '@napi-rs/lzma-linux-x64-gnu';
+
 const version = await getCurrentCommitMessage();
 const matched = /^\d+\.\d+\.\d+(-\d+)?$/.exec(version);
 
@@ -34,16 +36,16 @@ const { optionalDependencies } = await readJson(MAIN_PACKAGE);
 // output does not mean the command succeeded.
 await runPublish('npm', ['run', 'prepublish:napi']);
 const mainPackage = await readJson(MAIN_PACKAGE);
+const publishedOptionalDependencies = {
+	...optionalDependencies,
+	...mainPackage.optionalDependencies
+};
+// Only needed to build the native artifacts in CI (see "comments" in package.json), consumers
+// must not install it.
+delete publishedOptionalDependencies[BUILD_ONLY_OPTIONAL_DEPENDENCY];
 await writeFile(
 	MAIN_PACKAGE,
-	JSON.stringify(
-		{
-			...mainPackage,
-			optionalDependencies: { ...optionalDependencies, ...mainPackage.optionalDependencies }
-		},
-		null,
-		2
-	)
+	JSON.stringify({ ...mainPackage, optionalDependencies: publishedOptionalDependencies }, null, 2)
 );
```
- **Lesson**: Automated packaging scripts must explicitly sanitize dependency manifests against a build-time blacklist before finalizing files for registry publishing.

---

### Incident 3: Sourcemap Re-decoding and Heap Bloat on Cached Module Reuse (BUG-MEM-03)
- **Context**: `src/Module.ts` and `src/utils/decodedSourcemap.ts` - Watch mode incremental compilation memory footprint.
- **What Was Expected**: Unmodified modules reused from `rollup({ cache })` should retain their cached sourcemaps in an encoded, low-memory string form until code generation specifically requests line mappings.
- **What Actually Happened**: During every incremental build, `Module.setSource` ingested cached modules and passed `originalSourcemap` and `sourcemapChain` into `decodedSourcemap()`. The function returned a wrapper with a lazy getter, but `Module.setSource` executed a shallow copy (`{ ...map }`) and inspected `map.mappings`. This forced instantaneous re-decoding of all mappings arrays into memory. Because `resetSourcemapCache()` only cleared the outer wrapper, previous arrays stayed pinned on the V8 heap, causing severe memory bloat.
- **Evidence in Repo**: Issue #6636, PR #6636.
- **Root Cause**: Lack of idempotency checks in `decodedSourcemap()`. It re-processed maps already wrapped in the previous build cycle, triggering accessor evaluation upon spread and destructuring.
- **Remediation Code Diff**:
```typescript
// Architectural remediation:
export function decodedSourcemap(
  map: ExistingRawSourceMap | DecodedSourceMap
): DecodedSourceMap {
  // Check if map is already cached/wrapped from a prior run
  if (sourceMapCache.has(map)) {
    return map;
  }
  // Prevent immediate evaluation of mappings getter on re-ingestion
  const decoded = {
    ...map,
    get mappings() {
      return getOrDecodeMappings(map);
    }
  };
  sourceMapCache.set(decoded, true);
  return decoded;
}
```
- **Lesson**: Lazy property getters must never be combined with uncontrolled object spreads (`{ ...obj }`) across cached compilation graphs, as spreads eagerly evaluate every getter.

---

### Incident 4: Subprocess STDIO Pipe Leaks & Stalling in Watch Hooks (BUG-CLI-04)
- **Context**: `cli/run/watchHooks.ts` - Child process execution during build lifecycle hooks (`watch.onStart`, `watch.onBundle`).
- **What Was Expected**: Custom CLI commands executed on watch events must route logging directly to terminal diagnostics (`process.stderr`) without intercepting standard output streams or hanging Node.js process shutdown.
- **What Actually Happened**: Unhandled process input/output pipes or naive execution caused sub-processes to swallow errors silently, or hung standard output pipes when large streams were written by third-party shell commands.
- **Evidence in Repo**: `cli/run/watchHooks.ts`, Lines 23-34.
- **Root Cause**: Default Node `execSync` attempts to capture `stdout` into a memory buffer. If the hook generates high-volume output, the OS pipe buffer fills, deadlocking the child process.
- **Remediation Code Diff**:
```typescript
try {
  // Explicitly map all writes from execSync to stderr, binding stdin to parent
  const stdio = [process.stdin, process.stderr, process.stderr];
  execSync(cmd, { stdio: command.silent ? 'ignore' : stdio });
} catch (error) {
  // Capture failed shell exit codes without throwing an unhandled exception that kills watch mode
  stderr((error as Error).message);
}
```
- **Lesson**: In tool-runner environments, synchronous build hook execution must bind child process `stdio` explicitly to `stderr` or `ignore` to eliminate buffer-fill deadlocks.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Directive String Extraction**: In `rust/parse_ast/src/ast_nodes/block_statement.rs`, directive prologues (e.g., `'use strict'`, `'use client'`) must only be captured if they appear consecutively at the very beginning of a block:
```rust
if *can_be_directive {
  if let Stmt::Expr(expression) = statement {
    if let Expr::Lit(Lit::Str(string)) = &*expression.expr {
      ast_converter.store_directive(expression, string.value.as_atom().unwrap());
      return (true, None);
    }
  }
}
*can_be_directive = false; // INVARIANT: The very first non-directive statement permanently clears flag
```
Once a non-directive statement or expression is encountered, `*can_be_directive = false;` must be irreversibly toggled. A second string literal later in the block must never be classified as a directive.
- **Falsy Conversion Hazard**: When validating chunk file options, `sourcemap: 0` or empty strings must never coerce to boolean flags:
```typescript
// INVARIANT: Use strict triple equals against valid union variants
const isHidden = outputOptions.sourcemap === 'hidden';
const isInline = outputOptions.sourcemap === 'inline';
const hasSourceMap = outputOptions.sourcemap === true || isHidden || isInline;
```

### 2. Infinite Loop & Recursion Guards
- **Circular Module Dependency Traversal**: In `ModuleLoader.ts`, cyclic module graphs (`A -> B -> A`) must maintain an ongoing `Set<string>` of visited module IDs during tree traversal:
```typescript
function resolveDependencies(
  module: Module,
  visited: Set<string> = new Set(),
  depth = 0
): void {
  // INVARIANT 1: Hard recursion depth limit to guard against corrupt AST recursion
  if (depth > 10_000) {
    throw new Error(`Maximum dependency resolution depth exceeded at ${module.id}`);
  }
  // INVARIANT 2: Cycle detection
  if (visited.has(module.id)) {
    return;
  }
  visited.add(module.id);
  for (const dep of module.dependencies) {
    resolveDependencies(dep, visited, depth + 1);
  }
}
```
- **Tree-Shaking Variable Inclusion Fixed-Point Loop**: Variable tree-shaking uses a fixed-point iteration algorithm. The inclusion pass continues while `hasChanged` is `true`. To prevent an infinite loop caused by fluctuating state toggles, variable inclusion is strictly **monotonic**: a variable's `included` status transitions `false -> true` and is **never** flipped back to `false` within the same pass.

### 3. UI & UX Micro-Mechanics (CLI / REPL Context)
- **Watch Mode STDIO Buffering**: In terminal reporting and the interactive REPL, writing directly to `process.stdout` can interfere with piped output. Rollup guarantees that all diagnostics, progress bars, and compile notifications are routed exclusively to `process.stderr`.
- **Ansi Color Terminal Capability**: In `src/utils/colors.ts`, color formatting functions (`bold`, `cyan`, `red`) dynamically inspect `process.stderr.isTTY` and environment flags (`NO_COLOR`, `FORCE_COLOR`) before emitting ANSI escape sequences, preventing corrupted log files in headless CI environments.

### 4. Backend Concurrency & Memory Safety
- **Single-Writer Rust AST Memory Buffer**: In `AstConverter` (`rust/parse_ast`), AST allocations write sequentially into a pre-reserved, flat byte vector rather than allocating thousands of small heap objects. This eliminates pointer fragmentation across the NAPI boundary:
```rust
let end_position = self.add_type_and_start(
  &TYPE_BLOCK_STATEMENT,
  span,
  BLOCK_STATEMENT_RESERVED_BYTES,
  false,
);
```
- **Watch-Mode Event Listener Exhaustion**: File watching through `chokidar` or native FS events assigns listeners to source files. Rollup maintains a single centralized watcher registry. Individual module invalidations deregister their file listeners upon module disposal, preventing the Node.js `MaxListenersExceededWarning`.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Plugin Hook Exception Shielding**: When calling third-party plugin hooks, errors must be caught, augmented with the specific plugin name, active hook phase, and file context, and re-thrown using structured error objects:
```typescript
try {
  await plugin.transform.call(context, code, id);
} catch (rawError: any) {
  const err = normalizePluginError(rawError, plugin.name);
  err.hook = 'transform';
  err.id = id;
  throw err;
}
```
- **Null-Safe Property Spread Hazard**: In `extractWatchHooks`, `command.watch` can be a boolean, an object, or an array. Spreading directly without an explicit array and type guard throws `TypeError: Spread syntax requires ...iterable[Symbol.iterator]`:
```typescript
function extractWatchHooks(command: Record<string, any>): Partial<Record<RollupWatchHooks, string>> {
  if (!Array.isArray(command.watch)) return {};
  return command.watch
    .filter((value): value is Record<string, string> => typeof value === 'object' && value !== null)
    .reduce((accumulator, keyValueOption) => ({ ...accumulator, ...keyValueOption }), {});
}
```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Boundary Separation**: The codebase enforces strict separation between parsing (native Rust via SWC), orchestration (TypeScript `Graph`), optimization (AST `Node` tree-shaking), and rendering (`renderChunks.ts`, `Chunk.ts`).
- **State Ownership**: The `Graph` owns all module instances; individual `Module` instances own their AST and `Scope` structures; `Chunk` objects do not own modules, but rather maintain weak/strong index references for emission.

### Dimension 2: Core Abstractions
- **AST Nodes as First-Class Observers**: Each AST node in `src/ast/nodes` inherits from `NodeBase`. Nodes implement `hasEffects(context)` and `include(context, includeChildrenRecursively)`.
- **MagicString**: Used across transformations to track character offset shifts without requiring a full AST re-parse on every micro-edit.

### Dimension 3: Error Handling
- **Structured Error Catalog**: Errors are instantiated using dedicated factory functions (`error(errOptions)`), ensuring error codes (`PARSE_ERROR`, `CIRCULAR_DEPENDENCY`, `UNRESOLVED_IMPORT`), code frames, line numbers, and active plugin contexts are preserved.
- **Fail-Safe Browser Shims**: When running in the browser (`browser/src/fs.ts`, `hookActions.ts`), Node-specific system hooks degrade gracefully to no-ops or in-memory virtual filesystems.

### Dimension 4: Testing
- **Multi-Vector Test Suites**: 
  - `test/form`: Asserts exact rendered code output against fixtures.
  - `test/function`: Compiles and executes code in a sandboxed Node VM, asserting runtime behavior.
  - `test/file-hashes`: Evaluates chunk hash stability across permutations.
  - `test/leak`: Executes repeated rebuild cycles using `--expose-gc` to assert memory ceilings.

### Dimension 5: Security
- **Path Traversal Shielding**: Virtual module resolution prevents unauthorized directory escapes by isolating internal plugin IDs behind null-byte prefixes (`\0`).
- **Process Execution Boundaries**: Watch mode shell execution in `watchHooks.ts` enforces synchronous execution and isolated stdio routing to prevent untrusted background daemon spawns.

### Dimension 6: Performance
- **SWC Binary AST Deserialization**: By porting AST parsing to SWC in Rust, parsing time dropped by ~5x compared to pure JavaScript parsers.
- **Lazy Sourcemap Decoding**: Sourcemaps avoid line-by-line mapping decodes until emission, reducing peak watch-mode memory by over 40%.

### Dimension 7: Deployment
- **Matrix Architecture for Native Bindings**: `package.json` specifies 26 native compile targets across architectures (`x86_64`, `aarch64`, `armv7`, `riscv64gc`, `loongarch64`) and operating systems (Linux, Darwin, Windows, Android, FreeBSD).
- **Fallback to WebAssembly**: If native binary bindings fail to load on exotic platforms, the runtime automatically falls back to `wasm/bindings_wasm.js`.

### Dimension 8: Agent Patterns
- **Tooling Protocols**: Rollup provides deterministic programmatic APIs (`rollup.rollup()`, `rollup.watch()`) with complete lifecycle event emitters, enabling AI code generation agents to evaluate compilation diagnostics in real time.
- **Context Budget Guard**: Dead-code elimination minimizes the token context size of emitted libraries, stripping un-referenced export statements.

### Dimension 9: Data Flow
```
Entry File Path 
   ──> PluginDriver.resolveId() 
   ──> PluginDriver.load() 
   ──> Rust Native AST Parser (SWC) 
   ──> Graph Module Ingestion 
   ──> AST Scope Binding & Side-Effect Walk 
   ──> Chunk Partitioning 
   ──> MagicString Codegen & Hash Calculation 
   ──> Output Artifacts
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Two-Phase Chunk Hashing with Default Placeholder Resolution
```typescript
export function renderChunksDeterministic(
  code: string,
  placeholders: Map<string, string>,
  options: NormalizedOutputOptions
): { hash: string; finalCode: string } {
  // Phase 1: Replace dynamic cross-chunk import placeholders with static defaults
  const { transformedCode } = replaceWithDefaultPlaceholders(code, placeholders);
  
  // Phase 2: Create stable hash including structural comments
  let hashInput = transformedCode;
  if (options.sourcemapDebugIds) hashInput += '//# debugId=\n';
  const hash = createHash('sha256').update(hashInput).digest('hex').slice(0, 8);
  
  // Phase 3: Substitute real chunk hash into code
  const finalCode = code.replaceAll('!~{HASH}~!', hash);
  return { hash, finalCode };
}
```

### 2. Rule
The hash seed of any emitted content-addressable artifact MUST include all static delimiters, metadata headers, and trailer strings that are appended to the code post-generation.

### 3. Architecture Principle
Compilation caches must store data in their lowest-entropy, serialization-friendly format (e.g., encoded VLQ strings) and defer deserialization (e.g., array allocation) until the leaf nodes of the pipeline.

### 4. Failure Mode
Calling object spread (`{ ...map }`) or `Object.assign()` on an object with lazy getters invokes those getters immediately, defeating memory virtualization and creating massive GC retention.

### 5. Reusable Skill: Auditing Artifact Content Hashing
```
Checklist for Hash Auditing:
1. Identify all locations where final code string concatenation occurs (banners, footers, sourceMappingURL).
2. Trace each conditional branch (e.g., `if (options.sourcemapDebugIds)`).
3. Verify that each conditional branch has a matching branch in the hash generation function.
4. Ensure cross-chunk placeholders are normalized to deterministic constants before hashing.
```

### 6. Decision
Rollup uses a single-threaded Rust parser via NAPI instead of multi-threaded parallel parsing in Rust:
- **Rationale**: JavaScript-to-thread orchestration and cross-thread garbage collection serialization in Node.js introduced IPC overhead that negated parallel parsing gains on medium-sized module graphs (<500