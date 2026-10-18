> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/facebook-docusaurus-learnings.md`  
> **Source**: github ([https://github.com/facebook/docusaurus](https://github.com/facebook/docusaurus))  
> **Source Version**: `7b6826b8`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T21:01:34.603Z  
> **Learning ID**: `learn-github-facebook-docusaurus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): facebook/docusaurus

---

## 1. Executive Forensic Architecture & System Mechanics

```
                             +-----------------------------------------------+
                             |              docusaurus.config.js             |
                             +-----------------------------------------------+
                                                     |
                                                     v
+-------------------------------------------------------------------------------------------------------+
|                                           @docusaurus/core                                            |
|                                                                                                       |
|  +------------------------+      +------------------------+      +---------------------------------+  |
|  |     Plugin Lifecycle   | ---> |     Route Aggregator   | ---> |   Webpack / Rspack Orchestration |  |
|  | (loadContent, routes)  |      |  (client / server SSR) |      |   (Persistent Cache Invariants) |  |
|  +------------------------+      +------------------------+      +---------------------------------+  |
+-------------------------------------------------------------------------------------------------------+
                |                                                                           |
                v                                                                           v
+-------------------------------+                                           +-------------------------------+
|    @docusaurus/mdx-loader     |                                           |   @docusaurus/theme-classic   |
|                               |                                           |                               |
|  +-------------------------+  |                                           |  +-------------------------+  |
|  | SimpleProcessor Pipeline|  |                                           |  | Prism Language Hooks    |  |
|  | (Remark -> Rehype -> JS)|  |                                           |  | (Global Scope Isolated) |  |
|  +-------------------------+  |                                           |  +-------------------------+  |
|  | Cross-Compiler Cache    |  |                                           |  | Swizzle / Shadowing     |  |
|  | (Closure Getter Pattern)|  |                                           |  | Component Overrides     |  |
|  +-------------------------+  |                                           |  +-------------------------+  |
+-------------------------------+                                           +-------------------------------+
                |                                                                           |
                v                                                                           v
+-------------------------------+                                           +-------------------------------+
|      @docusaurus/fs           |                                           |       @docusaurus/glob        |
|  - Concurrency Queue (EMFILE) |                                           |  - POSIX Windows Pathing      |
|  - UTF-8 BOM Stripping        |                                           |  - Regex Compaction           |
|  - JS realpath vs Native      |                                           |  - Boundary Guard Matchers    |
+-------------------------------+                                           +-------------------------------+
```

### Problem Domain & System Scope
Docusaurus solves the problem of high-performance, content-driven, localized static documentation site generation. It unifies arbitrary Markdown/MDX authored content with interactive React client architectures, optimizing for:
1. Zero runtime overhead during static page generation (SSG).
2. Client-side Single Page Application (SPA) rehydration with progressive enhancement.
3. Dual-compilation parity (simultaneous Client bundle and Server SSR bundle generation) sharing parsed AST states without cache poisoning or duplicate work.

### Subsystem Boundaries & Decoupling
* **`@docusaurus/core`**: Orchestrates configuration loading, plugin lifecycle dispatch (`loadContent`, `contentLoaded`, `postBuild`), Webpack/Rspack multi-compiler configurations, and virtual module synthesis (aliased as `@generated/*`).
* **`@docusaurus/mdx-loader`**: Compiles MDX v1/v2/v3 documents into JSX. Solves client-server compilation duplication via a unified, memory-bounded, cross-compiler promise cache. Mutates MDAST/HAST/ESTree hierarchies for Table of Contents (TOC) extraction, asset resolution, and heading anchor generation.
* **`@docusaurus/bundler` & Webpack Base**: Constructs compiler instances. Manages granular persistent cache versions computed via composite hashes of toolchain parameters (browserslist, aliases, asset size boundaries).
* **`@docusaurus/theme-classic`**: Front-end component layer providing responsive layouts, search integration, code-block syntax highlighting via Prism, and component swizzling hooks.
* **`@docusaurus/fs` & `@docusaurus/glob`**: Hardened I/O abstraction layer mitigating OS-level file descriptor exhaustion (`EMFILE`), cross-platform POSIX path separators on Windows, and byte-order-mark (`U+FEFF`) JSON deserialization failures.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Function-Enclosed Cache References Across Clone Boundaries
**RULE**:
When sharing mutable state, singletons, or in-memory caches between compilers or pipeline stages via loader/plugin options objects, you **MUST NOT** pass the raw collection object (such as `Map`, `Set`, or class instance). You **MUST** pass a zero-argument accessor closure (getter function, e.g., `() => cacheInstance`).

**WHY**:
Third-party build instrumentation tools, diagnostic plugins (e.g., Rsdoctor, Webpack Bundle Analyzer), or worker serialization boundaries perform deep structural cloning (`structuredClone`, `lodash.cloneDeep`, or JSON-roundtrips) on configuration and loader option trees. 
1. Deep-cloning a `Map` or `Set` across loader stages disconnects the shared reference, breaking cache coherence and causing client/server dual compilations to execute redundant, heavy work.
2. If the deep-clone implementation only clones enumerable plain properties, a `Map` instance is converted into an empty plain object `{}`. Any subsequent invocation of `crossCompilerCache.get()` or `.has()` immediately crashes with a runtime `TypeError: cache.get is not a function`.
Because functions are non-enumerable primitives that cannot be structurally cloned as data, cloning engines retain function references as-is.

**WHEN TO APPLY**:
Apply in any build plugin, Webpack loader, Vite plugin, or micro-frontend configuration where options are shared across multiple compiler instances (e.g., client bundle + SSR bundle) or passed through intermediate bundler transforms.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/docusaurus-mdx-loader/src/options.ts & loader.ts

export type CrossCompilerCache = Map<string, PromiseWithResolvers<string>>;

export type LoaderOptions = {
  /**
   * Getter returning the shared cache instance.
   * Passing a getter protects the cache reference from being stripped
   * or corrupted into a plain object by deep-cloning tools (e.g., Rsdoctor).
   */
  getCrossCompilerCache?: () => CrossCompilerCache;
};

// Instantiation: Scope the cache instance inside the orchestrator closure
export function createLoaderConfig(): { loader: string; options: LoaderOptions } {
  const sharedCache: CrossCompilerCache = new Map();

  return {
    loader: require.resolve('./loader'),
    options: {
      getCrossCompilerCache: () => sharedCache,
    },
  };
}

// Consumer: Dereference via the getter inside the loader execution context
export async function executeLoader(options: LoaderOptions, cacheKey: string): Promise<string> {
  const cache = options.getCrossCompilerCache?.();
  
  if (!cache) {
    return runDirectCompilation();
  }

  const existingEntry = cache.get(cacheKey);
  if (existingEntry) {
    return existingEntry.promise;
  }

  const resolvers = Promise.withResolvers<string>();
  cache.set(cacheKey, resolvers);

  try {
    const result = await runDirectCompilation();
    resolvers.resolve(result);
    return result;
  } catch (error) {
    resolvers.reject(error);
    cache.delete(cacheKey); // Evict on failure to allow retry
    throw error;
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct object reference passing
export function createBrokenLoaderConfig() {
  const sharedCache = new Map<string, Promise<string>>();
  return {
    loader: 'mdx-loader',
    options: {
      // NEVER DO THIS: Rsdoctor or deep-clone sanitizers will turn this
      // Map into a plain `{}` object or separate disconnected copies.
      crossCompilerCache: sharedCache, 
    },
  };
}

// Loader implementation crashes at runtime:
export function brokenLoader(options: { crossCompilerCache?: Map<string, any> }) {
  // CRASH: options.crossCompilerCache.get is undefined when cloned to {}
  const cached = options.crossCompilerCache?.get('key'); 
}
```

**VERIFICATION METHOD**:
Enforce via an automated unit test simulating deep option cloning:
```typescript
import { describe, it, expect, vi } from 'vitest';

function cloneOptions<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  if (Array.isArray(value)) return value.map(cloneOptions) as T;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, cloneOptions(v)])
  ) as T;
}

it('preserves shared cache identity across deep-cloned loader options', () => {
  const options = createLoaderConfig().options;
  const clonedOptions = cloneOptions(options);

  expect(typeof clonedOptions.getCrossCompilerCache).toBe('function');
  expect(clonedOptions.getCrossCompilerCache?.()).toBe(options.getCrossCompilerCache?.());
  expect(clonedOptions.getCrossCompilerCache?.() instanceof Map).toBe(true);
});
```

---

### 2. Multi-Tier Persistent Cache Invalidation Vectoring
**RULE**:
When configuring persistent compiler or build caches (e.g., Webpack Persistent Cache, Rspack cache, Turbo remote cache), the cache version identifier **MUST** be composed as a composite deterministic hash incorporating the exact values of all **downstream build environment dependencies**, including target environment queries (`Browserslist`), module aliases, and asset parser size limits—not merely compiler version and source hashes.

**WHY**:
Bundler loaders (such as Babel, SWC, or PostCSS) and minimizers (such as Terser, Esbuild, or CSSNano) derive their transpilation targets, syntax downgrades, polyfills, and CSS transformations dynamically from external configuration files (e.g., `.browserslistrc`, `package.json -> browserslist`, or environment flags). 
Webpack and Rspack persistent caches track source file contents and compiler package versions, but do **NOT** track runtime options loaded dynamically inside external loader/minimizer sub-dependencies. Modifying the target browser profile (e.g., from modern browsers to legacy Safari/Chrome) without touching code files will serve stale, un-polyfilled cache hits, causing production whiteouts and unhandled syntax errors.

**WHEN TO APPLY**:
Any static site generator, bundler harness, or CLI build tool employing filesystem/disk persistent caching mechanisms (`cache.type = 'filesystem'`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/docusaurus/src/webpack/base.ts
import crypto from 'node:crypto';
import { getBrowserslistQueries } from '@docusaurus/bundler';

function md5Hash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

export function computeCacheVersion({
  docusaurusVersion,
  themeAliases,
  assetInlineMaxSize,
}: {
  docusaurusVersion: string;
  themeAliases: Record<string, string>;
  assetInlineMaxSize: number;
}): string {
  // 1. Alias change hash: Webpack does not automatically bust cache on alias overrides
  const themeAliasesHash = md5Hash(JSON.stringify(themeAliases));
  
  // 2. Browserslist change hash: Loader/minimizer downleveling changes with target queries
  const browserslistQueries = getBrowserslistQueries();
  const browserslistHash = md5Hash(JSON.stringify(browserslistQueries));

  // 3. Asset configuration changes: Dictates inline base64 vs external file emission
  return `${docusaurusVersion}-${themeAliasesHash}-${browserslistHash}-${assetInlineMaxSize}`;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Cache version derived purely from tool package version
export function computeNaiveCacheVersion(pkgVersion: string): string {
  // FORBIDDEN: Modifying .browserslistrc, changing Babel/SWC presets, 
  // or updating swizzled aliases will result in silent cache poisoning.
  return `build-cache-${pkgVersion}`;
}
```

**VERIFICATION METHOD**:
Implement environment-stubbed regression tests ensuring cache-busting occurs upon query mutation:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('persistent cache versioning', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('generates distinct cache keys when target browser matrix diverges', () => {
    vi.stubEnv('BROWSERSLIST', 'chrome 90');
    const versionModern = computeCacheVersion({
      docusaurusVersion: '3.0.0',
      themeAliases: {},
      assetInlineMaxSize: 10000,
    });

    vi.stubEnv('BROWSERSLIST', 'ie 11');
    const versionLegacy = computeCacheVersion({
      docusaurusVersion: '3.0.0',
      themeAliases: {},
      assetInlineMaxSize: 10000,
    });

    expect(versionModern).not.toEqual(versionLegacy);
  });
});
```

---

### 3. Non-Destructive Preservation of Global Singletons During Plugin Dynamic Augmentation
**RULE**:
When an application uses an isolated internal instance of a library that relies on global runtime bindings (e.g., `Prism`, `window.Prism`, or custom polyfills), dynamic extensions or language definitions **MUST NOT** unconditionally delete the global reference upon registration completion if downstream hooks or evaluation routines depend on accessing the global instance during rendering. If a prior foreign instance existed before registration, it **MUST** be restored; otherwise, the isolated instance **MUST** remain anchored.

**WHY**:
Legacy libraries and syntax highlighters (e.g., Prism component plugins such as `twig`, `liquid`, `markup-templating`) register language hooks that execute lazily on every highlight invocation. These hooks reference `globalThis.Prism` directly at execution time rather than referencing the local closure instance passed to the loader. 
Executing `delete globalThis.Prism` immediately after module loading prevents initialization crashes, but detonates every subsequent code-block render with `ReferenceError: Prism is not defined`. Furthermore, naively restoring previous instances without checking if a preexisting global was present can clobber foreign third-party highlighters (such as embedded Swagger/Redoc instances).

**WHEN TO APPLY**:
When wrapping non-ESM legacy libraries, syntax highlighters, markdown parsers, or global runtime polyfills inside modern modular frameworks (React/Vite/Webpack).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// packages/docusaurus-theme-classic/src/theme/prism-include-languages.ts
import type * as PrismNamespace from 'prismjs';

const MarkupTemplatingLanguages = [
  'django', 'ejs', 'erb', 'etlua', 'ftl', 'handlebars',
  'latte', 'liquid', 'php', 'smarty', 'soy', 'tt2', 'twig'
] as const;

export default function prismIncludeLanguages(
  PrismObject: typeof PrismNamespace,
  additionalLanguages: string[]
): void {
  // Capture prior global state (e.g., Redoc, Swagger, or legacy script tags)
  const PrismBefore = (globalThis as { Prism?: typeof PrismNamespace }).Prism;

  // Mount internal instance onto global scope for language registrations
  (globalThis as { Prism?: typeof PrismNamespace }).Prism = PrismObject;

  try {
    for (const lang of additionalLanguages) {
      if (MarkupTemplatingLanguages.includes(lang as any)) {
        // Enforce prerequisite registration before dependent grammars load
        require('prismjs/components/prism-markup-templating.js');
      }
      require(`prismjs/components/prism-${lang}`);
    }
  } finally {
    // If a foreign instance pre-existed, restore it to avoid clobbering host.
    // If NO instance existed prior, LEAVE OUR INSTANCE MOUNTED because
    // grammars like 'twig' and 'liquid' execute hooks reading `globalThis.Prism`
    // at highlight time!
    if (typeof PrismBefore !== 'undefined') {
      (globalThis as { Prism?: typeof PrismNamespace }).Prism = PrismBefore;
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Aggressive global deletion & inverted reassignment
export default function brokenPrismIncludeLanguages(PrismObject: any, languages: string[]) {
  const PrismBefore = globalThis.Prism;
  globalThis.Prism = PrismObject;

  languages.forEach((lang) => require(`prismjs/components/prism-${lang}`));

  // FATAL BUG 1: Unconditional delete breaks twig/liquid hooks at runtime:
  // "ReferenceError: Prism is not defined"
  delete (globalThis as any).Prism;

  // FATAL BUG 2: Re-assigning our instance instead of restoring PrismBefore!
  if (typeof PrismBefore !== 'undefined') {
    globalThis.Prism = PrismObject; // Corrupts foreign instance!
  }
}
```

**VERIFICATION METHOD**:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Prism } from 'prism-react-renderer';
import prismIncludeLanguages from './prism-include-languages';

describe('prismIncludeLanguages invariant test', () => {
  afterEach(() => {
    delete (globalThis as { Prism?: unknown }).Prism;
  });

  it('keeps Prism instance intact when hooks query globalThis during highlight', () => {
    prismIncludeLanguages(Prism, ['twig', 'liquid']);

    expect(globalThis.Prism).toBe(Prism);
    // Highlight triggers twig/liquid globalThis hooks
    expect(() => {
      Prism.highlight('{{ title }}', Prism.languages.twig!, 'twig');
    }).not.toThrow();
  });

  it('restores preexisting external Prism instance cleanly', () => {
    const ForeignPrism = { __foreign: true } as unknown as typeof Prism;
    globalThis.Prism = ForeignPrism;

    prismIncludeLanguages(Prism, ['java']);

    expect(globalThis.Prism).toBe(ForeignPrism);
    expect(Prism.languages.java).toBeDefined();
  });
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Prism Global Eviction Render Crash (BUG-DOCU-01)
- **Context**: Syntax highlighting component pipeline (`packages/docusaurus-theme-classic/src/theme/prism-include-languages.ts`).
- **What Was Expected**: Custom language grammars (such as `twig` and `liquid`) declared in `themeConfig.prism.additionalLanguages` should be loaded onto the local `prism-react-renderer` Prism instance without polluting or leaving invalid global memory references.
- **What Actually Happened**: Static site builds and runtime page visits crashed catastrophically with `ReferenceError: Prism is not defined` whenever code blocks containing Twig or Liquid were rendered.
- **Evidence in Repo**: Commit `3ef9589b`, Issue #8065, PR #12728. Added unit test file `prism-include-languages.test.ts`.
- **Root Cause**: The loader mounted `PrismObject` onto `globalThis.Prism`, required the grammar files, and then executed `delete (globalThis as Optional<typeof globalThis, 'Prism'>).Prism;`. The authors assumed Prism only uses the global reference at definition/import time. However, grammars like Twig and Liquid attach runtime hooks (`Prism.hooks.add('before-highlight', ...)`) that dereference `globalThis.Prism` during execution. Deleting `globalThis.Prism` resulted in uncaught ReferenceErrors during page render. Additionally, the cleanup logic had an inverted assignment bug: `if (typeof PrismBefore !== 'undefined') { globalThis.Prism = PrismObject; }` which clobbered existing third-party instances.
- **Remediation Code Diff**:
```diff
--- a/packages/docusaurus-theme-classic/src/theme/prism-include-languages.ts
+++ b/packages/docusaurus-theme-classic/src/theme/prism-include-languages.ts
@@ -7,7 +7,23 @@
 
 import siteConfig from '@generated/docusaurus.config';
 import type * as PrismNamespace from 'prismjs';
-import type {Optional} from 'utility-types';
+
+// Prism components requiring markup-templating, see prismjs/components.json
+const MarkupTemplatingLanguages = [
+  'django',
+  'ejs',
+  'erb',
+  'etlua',
+  'ftl',
+  'handlebars',
+  'latte',
+  'liquid',
+  'php',
+  'smarty',
+  'soy',
+  'tt2',
+  'twig',
+];
 
 export default function prismIncludeLanguages(
   PrismObject: typeof PrismNamespace,
@@ -28,17 +44,18 @@ export default function prismIncludeLanguages(
   const PrismBefore = globalThis.Prism;
   globalThis.Prism = PrismObject;
 
   additionalLanguages.forEach((lang) => {
-    if (lang === 'php') {
+    if (MarkupTemplatingLanguages.includes(lang)) {
       // eslint-disable-next-line @typescript-eslint/no-require-imports
       require('prismjs/components/prism-markup-templating.js');
     }
     // eslint-disable-next-line @typescript-eslint/no-require-imports
     require(`prismjs/components/prism-${lang}`);
   });
 
-  // Clean up and eventually restore former globalThis.Prism object (if any)
-  delete (globalThis as Optional<typeof globalThis, 'Prism'>).Prism;
   if (typeof PrismBefore !== 'undefined') {
-    globalThis.Prism = PrismObject;
+    globalThis.Prism = PrismBefore;
   }
 }
```
- **Lesson**: Do not assume third-party plugin systems only use global references at load time. If hooks execute lazily against global namespaces, the instance must persist. Always verify assignment directions (`globalThis.X = XBefore`, not `globalThis.X = XNew`) when writing save-and-restore patterns.

---

### Incident 2: Cross-Compiler Cache Destruction via Deep Cloning in Rsdoctor (BUG-DOCU-02)
- **Context**: Multi-compiler coordination in `@docusaurus/mdx-loader` (`packages/docusaurus-mdx-loader/src/loader.ts`, `createMDXLoader.ts`, `options.ts`).
- **What Was Expected**: When running production builds, client and server compilation passes share a single `crossCompilerCache: Map<string, PromiseWithResolvers<string>>` via Webpack loader options to eliminate duplicate compilation of identical MDX files.
- **What Actually Happened**: When Rsdoctor v1 was introduced into the build pipeline, the build crashed immediately with: `TypeError: crossCompilerCache?.get is not a function`.
- **Evidence in Repo**: Commit `f54813ea`, PR #12733. Added unit test `packages/docusaurus-mdx-loader/src/__tests__/loader.test.ts`.
- **Root Cause**: Rsdoctor intercepts Webpack compiler configurations and applies deep cloning to the loader options of every module. Deep cloning transforms a `Map` instance into a plain JavaScript Object (`{}`). Plain objects do not possess `.get()`, `.set()`, or `.delete()` methods on their prototype chain.
- **Remediation Code Diff**:
```diff
--- a/packages/docusaurus-mdx-loader/src/createMDXLoader.ts
+++ b/packages/docusaurus-mdx-loader/src/createMDXLoader.ts
@@ -33,9 +33,10 @@ function normalizeOptions(optionsInput: Options): Options {
   // We only have multiple compilers in production mode (docusaurus build)
   if (!DisableCrossCompilerCache && process.env.NODE_ENV === 'production') {
+    const crossCompilerCache: CrossCompilerCache = new Map();
     options = {
       ...options,
-      crossCompilerCache: new Map(),
+      getCrossCompilerCache: () => crossCompilerCache,
     };
   }

--- a/packages/docusaurus-mdx-loader/src/loader.ts
+++ b/packages/docusaurus-mdx-loader/src/loader.ts
@@ -121,7 +121,7 @@ async function loadMDXWithCaching({
   options: Options;
   compilerName: WebpackCompilerName;
 }): Promise<string> {
-  const {crossCompilerCache} = options;
+  const crossCompilerCache = options.getCrossCompilerCache?.();
   if (!crossCompilerCache) {
     return loadMDX({
       fileContent,
@@ -144,7 +144,7 @@ async function loadMDXWithCaching({
-  const cacheEntry = crossCompilerCache?.get(cacheKey);
+  const cacheEntry = crossCompilerCache.get(cacheKey);

--- a/packages/docusaurus-mdx-loader/src/options.ts
+++ b/packages/docusaurus-mdx-loader/src/options.ts
@@ -31,7 +31,14 @@ export type Options = Partial<MDXOptions> & {
   processors?: SimpleProcessors;
-  crossCompilerCache?: Map<string, CrossCompilerCacheEntry>;
+  getCrossCompilerCache?: () => CrossCompilerCache;
 };
+
+export type CrossCompilerCache = Map<string, CrossCompilerCacheEntry>;
```
- **Lesson**: Do not place mutable object state directly on configuration trees that external profilers or diagnostic loaders may clone. Enclose mutable singletons in accessor functions (`() => state`).

---

### Incident 3: Stale Persistent Cache on Target Browserslist Alterations (BUG-DOCU-03)
- **Context**: Persistent filesystem build caching in Webpack configuration (`packages/docusaurus/src/webpack/base.ts`).
- **What Was Expected**: Modifying the browser target configuration (e.g. updating `.browserslistrc` or changing `BROWSERSLIST` environment variable) should cause Webpack's filesystem cache to invalidate and emit code downleveled to the new target specifications.
- **What Actually Happened**: Build artifacts continuously served stale CSS and JavaScript from cache until developers manually executed `docusaurus clear`, producing syntax errors in older target browsers.
- **Evidence in Repo**: Commit `2d46a972`, PR #12727. Added tests in `packages/docusaurus/src/webpack/__tests__/base.test.ts`.
- **Root Cause**: Webpack filesystem cache tracks file modification times and direct loader config files, but does not monitor environment variables or implicit external target definitions consumed by Babel presets and CSS minimizers. The cache version string only tracked Docusaurus core version, theme alias hash, and inline asset max size.
- **Remediation Code Diff**:
```diff
--- a/packages/docusaurus/src/webpack/base.ts
+++ b/packages/docusaurus/src/webpack/base.ts
@@ -8,6 +8,7 @@
 import path from 'node:path';
 import {
   createJsLoaderFactory,
+  getBrowserslistQueries,
   getCSSExtractPlugin,
   getMinimizers,
 } from '@docusaurus/bundler';
@@ -111,9 +112,12 @@ export async function createBaseConfig({
     const themeAliasesHash = md5Hash(JSON.stringify(themeAliases));
+    // Loader and minimizer options are not part of the cache key
+    // Changing the Browserslist config must evict the cache
+    const browserslistHash = md5Hash(JSON.stringify(getBrowserslistQueries()));
     // Asset module parser options are not part of the cache key
     // Changing the asset inline max size must evict the cache
-    return `${siteMetadata.docusaurusVersion}-${themeAliasesHash}-${ASSET_INLINE_MAX_SIZE}`;\n+    return `${siteMetadata.docusaurusVersion}-${themeAliasesHash}-${browserslistHash}-${ASSET_INLINE_MAX_SIZE}`;
   }
```
- **Lesson**: Persistent build caches must incorporate every dimension of the compilation environment that influences AST transforms, polyfill injections, or CSS minification.

---

### Incident 4: MDX TabItem Parsing Failure on Trailing Markdown Lists (BUG-DOCU-04)
- **Context**: MDX AST Parsing and JSX Indentation (`packages/docusaurus-mdx-loader`, Issue #12583).
- **What Was Expected**: Authors should be able to write Markdown lists directly ending before a JSX closing tag, such as:
  ```mdx
  <TabItem value="query" label="Query">
    - `cid` – Unique identifier.
    - `depth` – Chain position.
  </TabItem>
  ```
- **What Actually Happened**: The MDX parser failed with a compilation error:
  `Expected the closing tag </TabItem> either after the end of listItem or another opening tag after the start of listItem`.
- **Evidence in Repo**: Issue #12