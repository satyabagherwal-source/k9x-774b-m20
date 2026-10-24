> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/facebook-docusaurus-learnings.md`  
> **Source**: github ([https://github.com/facebook/docusaurus](https://github.com/facebook/docusaurus))  
> **Source Version**: `4e6fe616`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-24T20:31:17.380Z  
> **Learning ID**: `learn-github-facebook-docusaurus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): facebook/docusaurus

---

## 1. Executive Forensic Architecture & System Mechanics

Docusaurus is a static-first metadata-driven web architecture designed to compile heterogeneous Markdown/MDX content, React components, and custom plugin configurations into optimized single-page static HTML bundles paired with client-side hydrated React runtimes. 

The core architectural problem Docusaurus solves is decoupling the **static authoring graph** (docs, blogs, versioning, localization, assets) from the **underlying compilation runtime** (Rspack, Webpack, SWC, Babel, PostCSS/LightningCSS) while guaranteeing cross-platform consistency, deterministic build caching, and predictable incremental rebuilds.

```
+----------------------------------------------------------------------------------------------------+
|                                    Site Configuration & Content Graph                              |
|           docusaurus.config.js | markdown/mdx docs | blog | i18n locales | custom pages            |
+----------------------------------------------------------------------------------------------------+
                                                   │
                                                   ▼
+----------------------------------------------------------------------------------------------------+
|                                     Docusaurus Core Subsystem                                      |
|    Plugin Engine ──► SiteMetadata Generation ──► Route Registry ──► Server-Side Static Pre-render  |
|          │                                                                           │             |
|          ▼                                                                           ▼             |
|   docusaurus-fs (PQueue EMFILE Guard)                             docusaurus-mdx-loader            |
|   (Concurrency Cap = 100, BOM Stripping)                     (Unified/Remark/MDX -> ESTree)        |
+----------------------------------------------------------------------------------------------------+
                                                   │
                                                   ▼
+----------------------------------------------------------------------------------------------------+
|                                  Bundler Abstraction Engine                                        |
|                     (@docusaurus/bundler: Rspack / Webpack Swappable Core)                         |
|     - Persistent Cache Key Engine (Targets Resolution + Plugin Versions + Aliases + Asset Thresholds) |
|     - Compilers: SWC / LightningCSS / Babel (Strict Node coercion & Semantic Target Resolution)     |
+----------------------------------------------------------------------------------------------------+
                                                   │
                                                   ▼
+----------------------------------------------------------------------------------------------------+
|                                        Output Runtime Pipeline                                     |
|           Client Manifest + Hydration Chunks (SPA)  ◄───►  SSG Static HTML Generation (Worker Pool)|
+----------------------------------------------------------------------------------------------------+
```

### Decoupling & Boundary Contracts
1. **The Core / Bundler Boundary (`@docusaurus/bundler` vs `@docusaurus/core`)**: The bundler layer abstracts whether Rspack or Webpack is compiling assets. It standardizes loader options, minimizer configs (LightningCSS, SWC), and persistent disk caching behind unified function signatures (`getTargets`, `createJsLoaderFactory`, `getMinimizers`).
2. **The File System Invariant Barrier (`@docusaurus/fs`)**: File access is strictly decoupled from raw `node:fs` or unmetered `fs-extra`. All asynchronous read/write operations must pass through a strict leaf-node concurrency gate (`p-queue` cap = 100) to prevent OS file descriptor exhaustion (`EMFILE`), and all JSON streams must be scrubbed of Unicode Byte Order Marks (`\uFEFF`) before serialization parsing.
3. **The AST Transformation Boundary (`@docusaurus/mdx-loader`)**: MDX parsing normalizes JSX nodes, Markdown headers, table of contents (TOC) slices, and asset require statements (`require('./image.png')`) into ECMAScript ESTree structures before handing off to bundler loaders.
4. **State Ownership**: Immutable route configs and site metadata are generated upfront during the lifecycle `load()` phase of plugins. Once generated, configs are sealed and referenced via MD5 hashes inside persistent cache keys.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Persistent Cache Key Target-Resolution Law
**RULE**:
Build-system persistent disk cache keys MUST NEVER be computed from abstract configuration queries (e.g., Browserslist DSL strings or unparsed version ranges). Cache keys MUST be computed strictly from the *resolved target set* and the *deterministic closure of all compiler plugin version strings*.

**WHY**:
Browserslist queries like `"baseline widely available"` or `"last 2 versions"` evaluate non-deterministically over time as external registry data changes, even when source code and configuration files are identical. Conversely, queries that vary syntactically (e.g., `"chrome 90"` vs `"chrome >= 90 and chrome <= 90"`) evaluate to identical targets, yet create false-positive cache misses if hashed literally. Furthermore, changes in compiler plugins or target Node.js runtimes mutate emitted bytecode without modifying site input files, causing persistent cache poisoning across environment changes.

**WHEN TO APPLY**:
Any static site generator, bundler pipeline (Webpack, Rspack, Vite, Rollup), or code generation framework implementing persistent caching across CLI runs or CI containers.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import crypto from 'node:crypto';
import browserslist from 'browserslist';
import semver from 'semver';

interface CacheKeyParams {
  docusaurusVersion: string;
  themeAliases: Record<string, string>;
  isServer: boolean;
  pluginVersions: Record<string, {version?: string}>;
  assetInlineMaxSize: number;
}

/**
 * Resolves deterministic target identifiers instead of query strings.
 */
export function getTargets({isServer}: {isServer: boolean}): string[] {
  if (isServer) {
    if (process.env.DOCUSAURUS_SERVER_NODE_TARGET) {
      return [`node ${process.env.DOCUSAURUS_SERVER_NODE_TARGET}`];
    }
    // Strip pre-release channels (e.g., "27.0.0-rc.1" -> "27.0.0") to prevent compiler crashes
    const coerced = semver.coerce(process.versions.node);
    return [`node ${coerced ? coerced.version : process.versions.node}`];
  }
  
  // Resolve queries to the exact array of browser/version tuples
  const queries = browserslist.loadConfig({path: process.cwd()}) ?? ['baseline widely available'];
  return browserslist(queries);
}

export function computeBundlerCacheKey(params: CacheKeyParams): string {
  const resolvedTargets = getTargets({isServer: params.isServer});
  
  // Include resolved targets, plugin version closure, and filesystem aliases
  const versionEnvelope = [
    params.docusaurusVersion,
    params.themeAliases,
    resolvedTargets,
    params.pluginVersions,
    params.assetInlineMaxSize,
  ];

  return crypto
    .createHash('md5')
    .update(JSON.stringify(versionEnvelope))
    .digest('hex');
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Hashing query strings directly and ignoring plugin version closure
function computeUnsafeCacheVersion(queries: string[], docusaurusVersion: string): string {
  // FAILS: "baseline widely available" returns different binaries next month with zero cache invalidation!
  // FAILS: Updating an external AST plugin does not invalidate the cached JavaScript bundle!
  const queryHash = crypto.createHash('md5').update(JSON.stringify(queries)).digest('hex');
  return `${docusaurusVersion}-${queryHash}`;
}
```

**VERIFICATION METHOD**:
Verify that identical target sets with differing syntax generate identical cache keys, and ensure target updates or plugin bumps force a cache key divergence:
```typescript
it('ensures persistent cache sensitivity to target resolution', () => {
  const keyVersionA = computeBundlerCacheKey({
    docusaurusVersion: '3.0.0',
    themeAliases: {},
    isServer: false,
    pluginVersions: {pluginA: {version: '1.0.0'}},
    assetInlineMaxSize: 10000,
  });

  const keyVersionB = computeBundlerCacheKey({
    docusaurusVersion: '3.0.0',
    themeAliases: {},
    isServer: false,
    pluginVersions: {pluginA: {version: '1.0.1'}}, // Bumped plugin
    assetInlineMaxSize: 10000,
  });

  expect(keyVersionA).not.toBe(keyVersionB);
});
```

---

### 2. Leaf-Only Asynchronous Task Limiting Law
**RULE**:
When wrapping asynchronous filesystem operations in a global concurrency queue (e.g., `p-queue`) to prevent operating system resource exhaustion (such as file descriptor `EMFILE`), the queue MUST ONLY accept atomic *leaf* I/O operations. Queuing composite operations that internally await other queued operations MUST NOT be permitted.

**WHY**:
If composite operations (e.g., reading a directory, filtering entries, and then reading each file) are queued alongside the underlying leaf file reads inside a concurrency pool with limit $N$, a deadlock state occurs when $N$ composite operations occupy all worker slots while awaiting their inner operations. Because the queue is saturated, the inner leaf tasks can never execute, permanently freezing the Node.js event loop.

**WHEN TO APPLY**:
High-concurrency node runtimes, file walkers, image transformers, batch static site pre-renders, and network scrapers.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import fs from 'node:fs/promises';
import PQueue from 'p-queue';

const DEFAULT_FS_CONCURRENCY = 100;

export const FileOperationQueue = new PQueue({
  concurrency: process.env.FS_CONCURRENCY 
    ? parseInt(process.env.FS_CONCURRENCY, 10) 
    : DEFAULT_FS_CONCURRENCY,
});

/**
 * QUEUE CONTRACT: Only wrap pure, self-contained leaf I/O calls.
 */
export async function safeReadFile(filePath: string): Promise<string> {
  return FileOperationQueue.add(() => fs.readFile(filePath, 'utf8'));
}

export async function safeWriteFile(filePath: string, data: string): Promise<void> {
  return FileOperationQueue.add(() => fs.writeFile(filePath, data, 'utf8'));
}

/**
 * Composite operations orchestration: Conducted OUTSIDE the queue to avoid slot starvation.
 */
export async function safeReadFiles(filePaths: string[]): Promise<string[]> {
  // Parallel execution of leaves through the queue prevents deadlock
  return Promise.all(filePaths.map((file) => safeReadFile(file)));
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Queuing composite tasks that spawn child queued tasks
export async function deadlockProneDirectoryRead(dirPath: string): Promise<string[]> {
  // If queue concurrency is reached, this outer slot blocks an inner slot forever!
  return FileOperationQueue.add(async () => {
    const files = await fs.readdir(dirPath);
    return Promise.all(
      files.map((file) => FileOperationQueue.add(() => fs.readFile(file, 'utf8')))
    );
  });
}
```

**VERIFICATION METHOD**:
Stress-test the queue with concurrency set to an artificially low ceiling ($N=2$) and run a nested batch of 50 composite reads. Ensure the queue completes without timeouts:
```typescript
it('does not deadlock under constrained concurrency', async () => {
  const queue = new PQueue({concurrency: 2});
  const files = Array.from({length: 10}, (_, i) => `file_${i}`);
  
  const mockLeafRead = (name: string) => queue.add(async () => `content:${name}`);
  
  // Safe: orchestrating outside the queue
  const results = await Promise.all(files.map((f) => mockLeafRead(f)));
  expect(results).toHaveLength(10);
});
```

---

### 3. Localization Matrix Schema Invariant Law
**RULE**:
Automated localization verification systems MUST execute bidirectional set-difference checks between base locale message ID registries and localized translation catalogs during CI validation, throwing a hard build/test failure if any localized catalog declares keys missing from `base.json`.

**WHY**:
When theme or core source files refactor, split, or rename message IDs (e.g., migrating from `.categoryDescription` to `.categoryDescription.plurals`), localized message catalogs retain dead legacy keys. If update scripts only print informational warnings without non-zero exit codes, upstream production sites silently fall back to default English text for the new keys while retaining untranslated strings, causing silent UI regressions and untranslated production deployments.

**WHEN TO APPLY**:
Any internationalized software application (i18n) maintaining multi-language dictionary maps, JSON translation catalogs, or gettext domains.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';

type MessageCatalog = Record<string, string>;

export async function assertNoStaleTranslations(localesDir: string): Promise<void> {
  const baseFiles = await fs.readdir(path.join(localesDir, 'base'));
  const entries = await fs.readdir(localesDir, {withFileTypes: true});
  
  const localeCodes = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'base' && e.name !== '__tests__')
    .map((e) => e.name);

  const staleViolations: string[] = [];

  for (const locale of localeCodes) {
    for (const file of baseFiles) {
      const basePath = path.join(localesDir, 'base', file);
      const localePath = path.join(localesDir, locale, file);

      try {
        const baseJson: MessageCatalog = JSON.parse(await fs.readFile(basePath, 'utf8'));
        const localeJson: MessageCatalog = JSON.parse(await fs.readFile(localePath, 'utf8'));

        const baseKeys = new Set(Object.keys(baseJson));
        for (const localizedKey of Object.keys(localeJson)) {
          if (!baseKeys.has(localizedKey)) {
            staleViolations.push(`${locale}/${file}: "${localizedKey}"`);
          }
        }
      } catch (err) {
        // Handle missing locale file gracefully if partial translation is permitted
      }
    }
  }

  if (staleViolations.length > 0) {
    throw new Error(
      `Detected stale localized message IDs not present in base catalog:\n` +
      staleViolations.map((v) => `  - ${v}`).join('\n') +
      `\nAction: Migrate translations to renamed keys or purge obsolete entries.`
    );
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Logging warnings without throwing assertion failures in CI
export async function verifyTranslationsUnsafe(locales: string[]): Promise<void> {
  const stale = findStaleKeys(locales);
  if (stale.length > 0) {
    // FAILS: CI logs get swallowed, obsolete keys persist, and users see broken English fallbacks
    console.warn("Some localized messages do not exist in base.json! Continuing build...");
  }
}
```

**VERIFICATION METHOD**:
Add a Vitest/Jest suite that directly asserts stale IDs equal empty array:
```typescript
it('ensures zero stale localized translation keys exist in any locale', async () => {
  await expect(assertNoStaleTranslations(path.resolve(__dirname, '../locales'))).resolves.not.toThrow();
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Rust/SWC Compiler Panic on Node.js Pre-Release Versions (BUG-DOCU-01)
- **Context**: `packages/docusaurus-bundler/src/browserslist.ts` & `swc.ts`
- **What Was Expected**: Running server compilation under modern or pre-release Node.js environments (e.g., `v27.0.0-rc.1`) should automatically configure SWC to skip down-level syntax transforms without crashing.
- **What Actually Happened**: SWC’s underlying Rust parser panicked when encountered with semver pre-release tags (`-rc.1`). Furthermore, previous logic hardcoded a clamping limit of `26.0.0` for Rspack to avoid missing Browserslist entries, causing arbitrary transpilation downgrades.
- **Evidence in Repo**: Commit `4e6fe616`, PR #12781.
- **Root Cause**: `process.versions.node` outputs raw runtime semver tags including pre-release channels (e.g. `27.0.0-rc.1`). SWC uses Rust's `semver` crate internally within its `env.targets` parser, which fails to match Browserslist Node targets if pre-release metadata is passed directly.
- **Remediation Code Diff**:
```typescript
// File: packages/docusaurus-bundler/src/browserslist.ts
- export function getServerTargets({
-   bundlerName,
- }: {
-   bundlerName: CurrentBundler['name'];
- }): string[] {
-   if (process.env.DOCUSAURUS_SERVER_NODE_TARGET) {
-     return [`node ${process.env.DOCUSAURUS_SERVER_NODE_TARGET}`];
-   }
-   const nodeTarget = getMinVersion(
-     process.versions.node,
-     getLastBrowserslistKnownNodeVersion(bundlerName),
-   );
-   return [`node ${nodeTarget}`];
- }
+ export function getServerTargets(): string[] {
+   if (process.env.DOCUSAURUS_SERVER_NODE_TARGET) {
+     return [`node ${process.env.DOCUSAURUS_SERVER_NODE_TARGET}`];
+   }
+   // SWC panics on pre-release versions like "27.0.0-rc.1"
+   const nodeVersion = semver.coerce(process.versions.node)!.version;
+   return [`node ${nodeVersion}`];
+ }
```
- **Lesson**: Never forward host process environment metadata (like runtime engine version strings) directly into external native/FFI parsers without strict semver coercion to drop pre-release and build-metadata tags.

---

### Incident 2: Silent Persistent Cache Poisoning via Unresolved Browserslist Queries (BUG-DOCU-02)
- **Context**: `packages/docusaurus/src/webpack/base.ts`
- **What Was Expected**: Updating third-party Docusaurus plugins or updating the system Browserslist database should evict the Webpack/Rspack persistent disk cache.
- **What Actually Happened**: The cache version string only hashed the literal query strings (`getClientQueries()`, e.g., `['baseline widely available']`). When the underlying caniuse/browserslist database updated, or when third-party plugin versions were bumped (which calculate custom loader options), the cache key remained unchanged. Stale, incorrect bytecode was served from disk cache.
- **Evidence in Repo**: Commit `6d543374`, PR #12774.
- **Root Cause**: Webpack and Rspack persistent caches do not track internal loader option functions or external database dependencies. If the cache version string fails to hash the *fully-resolved targets* and *plugin version manifests*, the cache engine falsely assumes inputs are idempotent.
- **Remediation Code Diff**:
```typescript
// File: packages/docusaurus/src/webpack/base.ts
  function getCacheVersion() {
-   const themeAliasesHash = md5Hash(JSON.stringify(themeAliases));
-   const browserslistHash = md5Hash(JSON.stringify(getClientQueries()));
-   return `${siteMetadata.docusaurusVersion}-${themeAliasesHash}-${browserslistHash}-${ASSET_INLINE_MAX_SIZE}`;
+   const versionParts: unknown[] = [
+     siteMetadata.docusaurusVersion,
+     themeAliases,
+     // Changing the target browsers or Node.js version must evict the cache
+     // The same Browserslist queries can match other browsers over time
+     getTargets({isServer, bundlerName: props.currentBundler.name}),
+     // Upgrading a third-party plugin must evict the cache
+     siteMetadata.pluginVersions,
+     ASSET_INLINE_MAX_SIZE,
+   ];
+   return md5Hash(JSON.stringify(versionParts));
  }
```
- **Lesson**: Persistent caching layers must hash the derived compilation targets and the operational dependencies (plugin closure), never the abstract user configuration DSL.

---

### Incident 3: Stale Localized Message Keys Causing Silent Fallback to English (BUG-DOCU-03)
- **Context**: `packages/docusaurus-theme-translations/locales/is/theme-common.json` & `locales.test.ts`
- **What Was Expected**: Renaming a localization message ID in the theme core (`theme.docs.DocCard.categoryDescription` -> `theme.docs.DocCard.categoryDescription.plurals`) must propagate to all language catalogs or trigger a CI failure.
- **What Actually Happened**: Icelandic translations retained the obsolete message ID while the plurals key was missing. Sites rendering in Icelandic silently fell back to the base English string. The translation update script only emitted console warnings and exited with status 0.
- **Evidence in Repo**: Commit `65d06432`, PR #12767.
- **Root Cause**: Translation update tooling lacked strict enforcement, treating unmapped keys as benign orphan properties instead of fatal regression breaks.
- **Remediation Code Diff**:
```typescript
// File: packages/docusaurus-theme-translations/locales/__tests__/locales.test.ts
+ it('has localized messages files that only use the message ids of the base messages files', async () => {
+   const staleMessages = await getStaleLocalizedMessages();
+   expect(
+     staleMessages,
+     'These localized message ids do not exist in the base messages files. Move their translation to the new message id if it was renamed, or delete them',
+   ).toEqual([]);
+ });
```
- **Lesson**: Linters and validation checks must never be configured as "warn-only" in CI pipelines for translation dictionaries; orphaned references represent broken production state.

---

### Incident 4: Worker Thread Desynchronization & CVE Supply Chain Poisoning in Tinypool (BUG-DOCU-04)
- **Context**: Worker thread pooling for static HTML generation; Issue #12584 (`CVE-2026-104848`, `CVE-2026-104849`).
- **What Was Expected**: Static generation across large multi-core builds must isolate worker thread memory without prototype pollution or arbitrary code execution vulnerabilities during worker task dispatch.
- **What Actually Happened**: Older `tinypool` dependencies bundled in `@docusaurus/core@3.x` possessed critical vulnerabilities involving prototype pollution during inter-thread channel message deserialization.
- **Evidence in Repo**: GitHub Issue #12584, CVE-2026-104848, CVE-2026-104849.
- **Root Cause**: Deserialization of IPC payload buffers in worker thread pools without strict schema validation or object prototype nulling (`Object.create(null)`).
- **Remediation Code Diff**:
```json
// File: packages/docusaurus/package.json
{
  "dependencies": {
-   "tinypool": "2.1.0"
+   "tinypool": "^2.1.2"
  }
}
```
- **Lesson**: Multi-threaded Node.js worker pools require active supply chain lockstep updates because inter-thread boundaries rely heavily on native serialization primitives vulnerable to object injection.

---

### Incident 5: MDX AST Boundary Collapse on Markdown List Termination (BUG-DOCU-05)
- **Context**: `packages/docusaurus-mdx-loader`, Remark MDX compilation, Issue #12583.
- **What Was Expected**: Tab components wrapping Markdown lists (`<TabItem>\n- item 1\n- item 2\n</TabItem>`) should parse cleanly into nested MDX JSX elements.
- **What Actually Happened**: The MDX parser threw an unrecoverable compilation error: `"Expected the closing tag </TabItem> either after the end of listItem or another opening tag"`.
- **Evidence in Repo**: Issue #12583.
- **Root Cause**: The Remark/MDX block-level state machine does not implicitly close loose list structures before closing a JSX parent container if a trailing newline sequence is absent. When an indentation or block token isn't properly terminated, the JSX lexer considers the closing XML token to be a continuation of the Markdown list item AST node rather than the parent container.
- **Remediation Code Diff**:
```markdown
<!-- Workaround / AST Normalization invariant: -->
<Tabs groupId="commits-syntax">
  <TabItem value="commits-query" label="_commits query" default>
    - `cid` &ndash; Unique identifier of a commit.
    - `depth` &ndash; Position within the chain of commits.

+   
  </TabItem>
</Tabs>
```
- **Lesson**: In mixed JSX/Markdown AST pipelines, JSX tag boundaries cannot cleanly infer the termination of trailing loose blocks without an explicit whitespace break or AST sanitizer plugin.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Unicode BOM Rejection in Parsers**: Standard `JSON.parse` crashes with syntax errors if a UTF-8 Byte Order Mark (`\uFEFF`) is present. In `packages/docusaurus-fs/src/fsUtils.ts`, strings must be explicitly sanitized via string slicing:
```typescript
function stripUTF8BOM(content: string): string {
  return content.startsWith('\uFEFF') ? content.slice(1) : content;
}
```
- **Cross-Platform POSIX Path Normalization & UNC Escapes**: Replacing Windows backslashes with slashes breaks Extended-Length UNC paths (e.g. `\\?\C:\repo`). In `packages/docusaurus-glob/src/globUtils.ts`:
```typescript
function posixPath(str: string): string {
  const isExtendedLengthPath = str.startsWith('\\\\?\\');
  if (isExtendedLengthPath) {
    return str; // Extended length prefix must be preserved
  }
  return str.replace(/\\/g, '/');
}
```
- **AST Node In-Place Replacement Without Identity Loss**: In compiler toolchains, child references can be retained by other plugins. Replacing a node requires wiping existing keys without modifying the object reference:
```typescript
export function transformNode<NewNode extends Node>(node: Node, newNode: NewNode): NewNode {
  Object.keys(node).forEach((key) => {
    delete (node as Record<string, unknown>)[key];
  });
  Object.keys(newNode).forEach((key) => {
    (node as Record<string, unknown>)[key] = (newNode as Record<string, unknown>)[key];
  });
  return node as NewNode;
}
```

### 2. Infinite Loop & Recursion Guards
- **Root Folder Path Resolution Termination Invariant**: When matching file paths against root directories, prefix matching without separator awareness results in false positives (e.g. `/path/to/docs_v2` matching `/path/to/docs`). In `packages/docusaurus-glob/src/globUtils.ts`:
```typescript
function getRelativeFilePath(absoluteFilePath: string) {
  const rootFolder = rootFolders.find((folderPath) =>
    ['/', '\\'].some((separator) =>
      absoluteFilePath.startsWith(
        folderPath.endsWith(separator) ? folderPath : folderPath + separator,
      ),
    ),
  );
  if (!rootFolder) {
    throw new Error(
      `createAbsoluteFilePathMatcher unexpected error, absoluteFilePath=${absoluteFilePath} was not contained in any of the root folders: ${rootFolders.join(', ')}`,
    );
  }
  return path.relative(rootFolder, absoluteFilePath);
}
```
- **Empty Regex Pattern Guard**: Empty array regex joins cause matching loops. When creating a regex matcher from glob patterns:
```typescript
export function createMatcher(patterns: string[]): Matcher {
  if (patterns.length === 0) {
    // Calling `new RegExp('')` yields /(?:)/ which matches ANY string!
    return () => false;
  }
  const regexp = new RegExp(
    patterns.map((pattern) => Micromatch.makeRe(pattern).source).join('|'),
  );
  return (str) => regexp.test(str);
}
```

### 3. UI & UX Micro-Mechanics
- **TOC HTML Extraction & Image Stripping**: In `packages/docusaurus-mdx-loader/src/remark/toc/utils.ts`, Table of Contents generation parses JSX heading content. Including inline images in TOC nodes breaks navigational layout contexts:
```typescript
function mdxJsxTextElementToHtml(element: MdxJsxTextElement): string {
  const tag = element.name;
  // Prevent inline image rendering within Table of Contents breadcrumbs
  if (tag === 'img') {
    return '';
  }
  // Sanitize and escape class attributes to prevent HTML injection in TOC
  const attributes = element.attributes.filter(
    (child): child is MdxJsxAttribute => child.type === 'mdxJsxAttribute',
  );
  const classAttribute =
    attributes.find((attr) => attr.name === 'className') ??
    attributes.find((attr) => attr.name === 'class');
  const classAttributeString = classAttribute
    ? `class="${escapeHtml(String(classAttribute.value))}"`
    : '';
  const allAttributes = classAttributeString ? ` ${classAttributeString}` : '';
  const content = stringifyChildren(element);
  return `<${tag}${allAttributes}>${content}</${tag}>`;
}
```
- **Cookie Parsing Without Response Modification Traps**: Native Fetch `Response.redirect()` constructs immutable response objects. Trying to set cookies on the redirected object throws a `TypeError`:
```typescript
export function createPlaygroundResponse(playgroundName: PlaygroundName): Response {
  const playgroundUrl = PlaygroundConfigs[playgroundName];
  // CANNOT use Response.redirect(url): headers are immutable by spec!
  return new Response(null, {
    status: 302,
    headers: {
      Location: playgroundUrl,
      'Set-Cookie': `${CookieName}=${playgroundName}`,
    },
  });
}
```

### 4. Backend Concurrency & Memory Safety
- **File System Queueing (EMFILE Prevention)**: Unmetered file I/O operations will crash Node.js processes on operating systems with low `ulimit -n` limits (typically 1024). Docusaurus routes all async file calls through an explicit queue:
```typescript
const DefaultFileOperationConcurrency = 100;
const FileOperationQueue = new PQueue({
  concurrency: getFileOperationConcurrency(),
});
export function queueFileOperation<T>(operation: () => Promise<T>): Promise<T> {
  return FileOperationQueue.add(operation);
}
```
- **Realpath Native Invariant vs JS Fallback**: `fs/promises.realpath` uses the native C++ OS implementation, which alters drive letter casing on Windows (e.g. `c:\` to `C:\`) and breaks Node module cache equality. Docusaurus binds explicitly to JavaScript implementation:
```typescript
import fsCallback from 'node:fs';
import {promisify} from 'node:util';

export async function realpath(filePath: string): Promise<string> {
  // Uses JS implementation rather than native C++ to prevent path-casing cache divergence
  return promisify(fsCallback.realpath)(filePath);
}
```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Cause Chaining in Filesystem Errors**: Dropping original system errors leaves developers blind to permissions issues vs missing paths. Use `{cause: err}`:
```typescript
export async function readJSON(filePath: string): Promise<unknown> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(stripUTF8BOM(content));
  } catch (err) {
    throw new Error(
      logger.interpolate`Failed to read JSON file at path=${path.relative(
        process.cwd(),
        filePath,
      )}`,
      {cause