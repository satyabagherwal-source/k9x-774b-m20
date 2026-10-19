> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lingui-js-lingui-learnings.md`  
> **Source**: github ([https://github.com/lingui/js-lingui](https://github.com/lingui/js-lingui))  
> **Source Version**: `60e823f9`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T23:03:34.260Z  
> **Learning ID**: `learn-github-lingui-js-lingui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): lingui/js-lingui

---

## 1. Executive Forensic Architecture & System Mechanics

`lingui/js-lingui` solves compile-time extraction and zero-runtime-parser internationalization (i18n) for modern JavaScript, TypeScript, and reactive UI ecosystems (React, Vue, SolidJS, Next.js, Remix/React Router). 

Unlike legacy runtime translation libraries that ship heavy ICU MessageFormat parsers and lookup dictionaries to client bundles, Lingui compiles messages into compiled JavaScript functions or minimal token arrays at build time. It generates deterministic message keys (SHA-based or raw ICU string anchors), analyzes source ASTs to extract translation catalogs, and replaces source macros (`t`, `plural`, `select`, `<Trans>`) with ultra-compact compiled references.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LINGUI COMPILATION LIFECYCLE                          │
└─────────────────────────────────────────────────────────────────────────────────┘
 [Source Code: React / Vue / TS]
       │
       ▼
 ┌────────────────────────────────────────────────────────┐
 │   Transpiler Plugins (Babel / SWC / Vite / Unplugin)   │
 │   - Evaluates macro syntax: msg`Hello ${name}`, <Trans>│
 │   - Normalizes JSX tags into numbered tokens: <0></0>  │
 │   - Emits ObjectExpression with deterministic ID hash  │
 └──────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
   [lingui extract (CLI)]        [Client Runtime Code]
   - Scans ASTs & Source Maps    - Replaces calls with lightweight
   - Normalizes file origins       Message Descriptors:
   - Outputs PO / JSON catalogs    { id, message, values }
              │                           │
              ▼                           ▼
   [lingui compile (CLI)]        [I18nProvider / @lingui/core]
   - Parses ICU catalogs         - Activates compiled catalog
   - Generates pure JS functions - Evaluates interpolation tokens
     or minimal format tokens    - Renders text or JSX fragments
              │                           │
              └─────────────┬─────────────┘
                            ▼
               Zero-Parser Optimized Output
```

### Critical Subsystem Boundaries and Decoupling Invariants
1. **Catalog & Message Descriptors (`@lingui/core`, `@lingui/message-utils`)**: 
   Represents the runtime boundary. The core runtime is strictly zero-parser (<2.25 kB gzipped limit enforced via `@size-limit`). Catalogs map message IDs to pre-compiled formatters. A message descriptor is an invariant contract: `{ id: string, message?: string, values?: Record<string, unknown>, comment?: string, context?: string }`.
2. **Extraction Engine (`@lingui/cli`, `@lingui/extractor-vue`, `@lingui/babel-plugin-lingui-macro`)**:
   Responsible for extracting messages from codebases across diverse AST representations (Babel AST, SWC, Vue SFC blocks). It decouples file walking and worker-pool dispatching (`resolveWorkersOptions.ts`, `typedPool.ts`) from AST parsing.
3. **Macro AST Transpilation Engine**:
   Interprets JavaScript/TypeScript tagged template literals and JSX at transpilation time. It validates AST nodes, replaces JSX children with numbered placeholder syntax (`<0>Hello</0>` -> `<0>Hello</0>`), trims whitespace conforming to JSX literal specifications (`cleanJSXElementLiteralChild`), and constructs ICU expressions directly in the AST.
4. **Configuration Layer (`@lingui/conf`)**:
   Provides validated resolution of configuration across formats (`lingui.config.ts`, `.linguirc`, `package.json`), resolving `<rootDir>` placeholders across nested arrays, strings, and object keys without mutating the input structures or leaking across execution contexts.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Pure Recursive Deep Cloner Invariant (No In-Place Configuration Mutation)
**RULE**:
When recursively traversing configuration objects, AST transforms, or options bags to substitute placeholder tokens (such as `<rootDir>`, environment variables, or alias prefixes), functions MUST NEVER mutate input objects in place and MUST verify that a target is a plain, non-null, prototype-bounded dictionary (`isPlainObject`) before recursing.

**WHY**:
Mutating configuration objects in-place (`delete value[key]`, `value[newKey] = ...`) causes persistent state leakage between concurrent compilation runs, test suites, and shared in-memory default templates (e.g., `defaultConfig`). If a user passes an imported configuration object or module-level constant into multiple builders, modifying properties in-place pollutes all subsequent invocations. Furthermore, unguarded `typeof value === "object"` checks corrupt specialized objects (such as `Date`, `RegExp`, `Map`, or custom class instances) by destroying their prototype linkages.

**WHEN TO APPLY**:
Every configuration loader, macro transform pass, worker initialization harness, or compiler option processor traversing arbitrary nested configuration structures.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Safely replaces string placeholders throughout deeply nested configuration trees
 * without mutating source inputs or modifying non-plain object prototypes.
 */
export function replacePlaceholderDeep<T>(
  value: T,
  search: string | RegExp,
  replacement: string
): T {
  function isPlainObject(val: unknown): val is Record<string, unknown> {
    if (typeof val !== "object" || val === null) return false
    const proto = Object.getPrototypeOf(val)
    return proto === Object.prototype || proto === null
  }

  function replace(val: string): string {
    return val.replace(search, replacement)
  }

  function walk(current: unknown): unknown {
    if (typeof current === "string") {
      return replace(current)
    }
    if (Array.isArray(current)) {
      return current.map(walk)
    }
    if (isPlainObject(current)) {
      return Object.fromEntries(
        Object.entries(current).map(([k, v]) => [
          replace(k),
          walk(v),
        ])
      )
    }
    return current
  }

  return walk(value) as T
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: In-place mutation of config object and flawed prototype check
function unsafeReplaceRootDir(config: Record<string, any>, rootDir: string) {
  // BUG: Mutates the caller's input object directly!
  // BUG: typeof value === 'object' matches Date, RegExp, Buffers, null
  for (const key of Object.keys(config)) {
    if (typeof config[key] === "object" && config[key] !== null) {
      unsafeReplaceRootDir(config[key], rootDir) // Mutates nested object
    } else if (typeof config[key] === "string") {
      const newKey = config[key].replace("<rootDir>", rootDir)
      config[key] = newKey // Destructive mutation
      delete config["oldKey"] // Modifies structure in-place
    }
  }
  return config
}
```

**VERIFICATION METHOD**:
Enforce object immutability via deep freeze assertion tests in unit testing harnesses:
```typescript
import { test, expect } from "vitest"

test("config processing does not mutate source inputs", () => {
  const source = Object.freeze({
    catalogs: Object.freeze([
      Object.freeze({ path: "<rootDir>/locale", include: Object.freeze(["<rootDir>/src"]) })
    ])
  })
  expect(() => replacePlaceholderDeep(source, "<rootDir>", "/app")).not.toThrow()
  expect(source.catalogs[0].path).toBe("<rootDir>/locale")
})
```

---

### 2. ICU Choice Format Parameter Order Invariant
**RULE**:
When building or transforming ICU plural or choice MessageFormat syntax expressions programmatically from JavaScript objects, parameter modifiers (such as `offset:N`) MUST be extracted and prepended to the beginning of the case token sequence (`offset:N =0 {...} one {...}`), and exact numeric equality branches MUST be normalized with an explicit equality operator prefix (`=\d+`).

**WHY**:
The ICU MessageFormat specification requires `offset:n` to precede choice match clauses. Furthermore, ECMAScript engines (`V8`, `JavaScriptCore`, `SpiderMonkey`) enforce integer key traversal ordering in object property enumeration: all integer-indexed keys are iterated first in numeric ascending order, regardless of declaration order in the code. If an options object `{ offset: 1, 0: "zero", other: "else" }` or `{ other: "else", offset: 1 }` is iterated via `Object.entries()`, the integer key `0` appears before `offset`, and non-integer keys appear after. If `offset` is appended in natural iteration order, the generated ICU expression fails parser validation or alters its deterministic message hash ID.

**WHEN TO APPLY**:
AST transforms, runtime macros, and dynamic ICU generators constructing MessageFormat strings (`plural`, `selectOrdinal`, `select`) from key-value dictionaries.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const ESCAPED_META_OPTION_RE = /^_(id|comment|props)$/

export function buildICUChoiceClause(
  formatType: "plural" | "select" | "selectOrdinal",
  variableName: string,
  options: Record<string, string>
): string {
  let offset: string | undefined
  const optionParts: string[] = []

  for (const [key, rawValue] of Object.entries(options)) {
    // ICU requires offset to appear before cases in plural/selectOrdinal
    if (key === "offset" && formatType !== "select") {
      offset = `offset:${rawValue}`
      continue
    }

    // Exact matches must have '=' prepended; strip meta-option escape prefixes
    const formattedKey = /^\d+$/.test(key)
      ? `=${key}`
      : key.replace(ESCAPED_META_OPTION_RE, "$1")

    optionParts.push(`${formattedKey} {${rawValue}}`)
  }

  // Prepend offset to ensure correct ICU grammar positioning
  if (offset !== undefined) {
    optionParts.unshift(offset)
  }

  return `{${variableName}, ${formatType}, ${optionParts.join(" ")}}`
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blind iteration into output parts produces invalid ICU grammar
function brokenBuildICU(variableName: string, options: Record<string, string>) {
  // If options = { 0: "None", offset: 1, other: "Many" }
  // Object.entries enumerates "0" first, then "offset", then "other"!
  const clauses = Object.entries(options).map(([k, v]) => {
    return k === "offset" ? `offset:${v}` : `${k} {${v}}`
  })
  // Produces: "{count, plural, =0 {None} offset:1 other {Many}}" -> SYNTAX ERROR
  return `{${variableName}, plural, ${clauses.join(" ")}}`
}
```

**VERIFICATION METHOD**:
Validate generated ICU expressions using the official `@formatjs/icu-messageformat-parser`:
```typescript
import { parse } from "@formatjs/icu-messageformat-parser"
import { test, expect } from "vitest"

test("ICU offset is positioned before case blocks", () => {
  const output = buildICUChoiceClause("plural", "count", {
    other: "# items",
    offset: "1",
    0: "no items",
  })
  expect(output).toBe("{count, plural, offset:1 =0 {no items} other {# items}}")
  expect(() => parse(output)).not.toThrow()
})
```

---

### 3. SFC Virtual Script AST Source-Location Relational Offset Invariant
**RULE**:
When parsing or extracting messages from embedded sub-blocks or Single File Components (SFCs, e.g., Vue `<script setup>`, Svelte `<script>`, Astro frontmatter) without intermediate source maps, child AST line and column offsets MUST be adjusted against the container block's starting line and column boundaries: `finalLine = relativeLine + startLine - 1`, and `finalColumn = (relativeLine === 1 && relativeCol != null) ? relativeCol + startCol - 1 : relativeCol`.

**WHY**:
Extracted sub-blocks (such as the content of a `<script setup>` tag) are parsed by underlying TypeScript/Babel extractors as standalone, zero-indexed virtual files (`line: 1, col: 0`). When these virtual files lack source maps, reporting their AST location directly tags messages with virtual line numbers instead of their real location in the physical `.vue` or `.svelte` source file. Furthermore, on line 1 of the virtual script block, the physical column position must be offset by the starting column of the opening tag; on subsequent lines (`relativeLine > 1`), the column starts from 0 and must not add the tag's column offset.

**WHEN TO APPLY**:
All custom extractors, linters, preprocessors, or language plugins parsing multi-language SFCs, embedded templates, or markdown code-blocks.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export interface BlockSourceLocation {
  line: number
  column: number
}

export interface ExtractedMessageOrigin {
  filename: string
  line: number
  column: number | undefined
}

/**
 * Calculates absolute file location from a virtual block offset
 */
export function remapVirtualBlockLocation(
  physicalFilename: string,
  virtualLine: number,
  virtualColumn: number | undefined,
  blockStart: BlockSourceLocation
): ExtractedMessageOrigin {
  const resolvedLine = virtualLine + blockStart.line - 1
  
  // Column offset only applies to the first line of the virtual block
  const resolvedColumn =
    virtualLine === 1 && virtualColumn !== undefined
      ? virtualColumn + blockStart.column - 1
      : virtualColumn

  return {
    filename: physicalFilename,
    line: resolvedLine,
    column: resolvedColumn,
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naive line addition or applying column offset to all lines
function badRemap(filename: string, vLine: number, vCol: number, bStart: { line: number, column: number }) {
  return {
    filename,
    line: vLine + bStart.line, // Off-by-one error (1-based + 1-based = +2!)
    column: vCol + bStart.column // BUG: Shifts column on ALL subsequent lines!
  }
}
```

**VERIFICATION METHOD**:
Implement boundary tests comparing single-line script tags against multi-line script tags:
```typescript
import { test, expect } from "vitest"

test("virtual block offset calculation matches physical file line/column", () => {
  const blockStart = { line: 10, column: 15 } // <script setup> starts at L10:C15
  
  // Line 1 inside script block
  const loc1 = remapVirtualBlockLocation("App.vue", 1, 5, blockStart)
  expect(loc1.line).toBe(10)
  expect(loc1.column).toBe(19) // 5 + 15 - 1

  // Line 3 inside script block
  const loc2 = remapVirtualBlockLocation("App.vue", 3, 4, blockStart)
  expect(loc2.line).toBe(12) // 3 + 10 - 1
  expect(loc2.column).toBe(4) // Preserves raw column on subsequent lines
})
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Cross-Compilation Config Leaks via In-Place `<rootDir>` Mutation (BUG-CONF-01)
- **Context**: `packages/conf/src/utils/replaceRootDir.ts` and `packages/conf/src/index.ts`
- **What Was Expected**: Calling `makeConfig` or `replaceRootDir` multiple times with different `rootDir` paths must yield isolated configuration objects and never mutate passed user configs or shared default configurations.
- **What Actually Happened**: The replacement logic operated by iterating `Object.keys(value)` and directly writing to `value[newKey]` and deleting `value[key]`. When users passed a configuration with shared catalog definitions, the original object in memory was mutated. On subsequent calls with different `rootDir` parameters, paths already had their `<rootDir>` token stripped and replaced, leading to path corruption or leaking paths across projects in monorepo builds.
- **Evidence in Repo**: Commit `60e823f9`, Issue/PR #2730, test file `packages/conf/src/index.test.ts`.
- **Root Cause**: Shallow and in-place property mutation of `config` arguments. Additionally, it used `typeof value === "object"` which also captures arrays, nulls, and non-plain object prototypes.
- **Remediation Code Diff**:
```typescript
@@ -16,14 +16,23 @@ export function replaceRootDir<T extends Partial<LinguiConfig>>(
       return replace(value)
     } else if (Array.isArray(value)) {
       return value.map((item) => replaceDeep(item, rootDir))
-    } else if (typeof value === "object") {
-      Object.keys(value).forEach((key) => {
-        const newKey = replaceDeep(key, rootDir)
-        value[newKey] = replaceDeep(value[key], rootDir)
-        if (key !== newKey) delete value[key]
-      })
+    } else if (isPlainObject(value)) {
+      // Build a new object instead of mutating `value`: it may be the caller's
+      // config or the shared `defaultConfig`, which must stay untouched.
+      return Object.fromEntries(
+        Object.entries(value).map(([key, item]) => [
+          replace(key),
+          replaceDeep(item, rootDir),
+        ]),
+      )
     }
 
     return value
   })(config, rootDir) as T
 }
+
+function isPlainObject(value: unknown): value is Record<string, unknown> {
+  if (typeof value !== "object" || value === null) return false
+  const proto = Object.getPrototypeOf(value)
+  return proto === Object.prototype || proto === null
+}
```
- **Lesson**: Never mutate nested dictionary structures during resolution passes. Use `isPlainObject` checks to avoid altering prototypes, and construct fresh instances using `Object.fromEntries()`.

---

### Incident 2: ICU Macro Choice Offset Ordering & Metadata Key Collision (BUG-CORE-02)
- **Context**: `packages/core/src/runtime-macro.ts`
- **What Was Expected**: Compiling a runtime `plural` macro with an `offset` option (e.g. `plural({ count }, { offset: 1, 0: "None", one: "# book", other: "# books" })`) must produce valid ICU MessageFormat strings where `offset:1` appears immediately following the `plural` selector keyword, matching the AST generated by compile-time Babel/SWC macros. Additionally, metadata keys like `_id`, `_comment`, and `_props` used to prevent parameter collisions must have their leading underscore stripped when emitted.
- **What Actually Happened**: JavaScript engines automatically sort non-negative integer string keys (like `"0"`, `"1"`) ahead of string keys (`"offset"`) during object enumeration. When `buildChoiceMarker` pushed tokens into `optionParts` in iteration order, integer cases (`=0`) were placed before `offset:1`. The resulting string `{count, plural, =0 {Nobody} offset:1 ...}` broke ICU grammar parsers and generated a completely different hash ID compared to compile-time macros. Furthermore, escaped metadata options retained their prefix, producing invalid ICU keys like `_id {...}`.
- **Evidence in Repo**: Commit `0255d73b`, Issue/PR #2726, test file `packages/core/src/runtime-macro.test.ts`.
- **Root Cause**: Dependency on JavaScript object property iteration order (`Object.entries()`) for ICU tokens where the ICU grammar requires strict positional ordering (`offset` preceding choices), combined with an omission in runtime macro unescaping for compiler-reserved option prefixes.
- **Remediation Code Diff**:
```typescript
@@ -78,6 +78,10 @@ function isTemplateStringsArray(x: unknown): x is TemplateStringsArray {
   return Array.isArray(x) && "raw" in x && Array.isArray((x as any).raw)
 }
 
+// Option keys the compile-time macro reads as `_id`, `_comment` and `_props`
+// because the unprefixed names have a meaning of their own there
+const ESCAPED_META_OPTION_RE = /^_(id|comment|props)$/
+
 function buildICUFragment(marker: MacroMarker, name: string): string {
   return `{${name}, ${marker.format}, ${marker.formattedOptions}}`
 }
@@ -131,14 +135,19 @@ function buildChoiceMarker(
   const nestedValues: Record<string, unknown> = {}
   let optCounter = 0
   const optionParts: string[] = []
+  let offset: string | undefined
 
   for (const [key, optValue] of Object.entries(options)) {
     if (key === "offset" && format !== "select") {
-      optionParts.push(`offset:${optValue}`)
+      // ICU needs the offset before the cases. It can't keep its position in
+      // `options` either: integer keys like `0` always come first in an object.
+      offset = `offset:${optValue}`
       continue
     }
 
-    const formatKey = /^\\d+$/.test(key) ? `=${key}` : key
+    const formatKey = /^\\d+$/.test(key)
+      ? `=${key}`
+      : key.replace(ESCAPED_META_OPTION_RE, "$1")
 
     if (isMacroMarker(optValue)) {
       const nestedName = optValue.labeledName
@@ -161,6 +170,9 @@ function buildChoiceMarker(
     }
   }
 
+  if (offset !== undefined) {
+    optionParts.unshift(offset)
+  }
   const formattedOptions = optionParts.join(" ")
```
- **Lesson**: Do not rely on JavaScript object dictionary key iteration when generating grammar-sensitive strings. Extract prefix/modifier keys explicitly, buffer them into typed variables, and assemble using grammatical position invariants.

---

### Incident 3: Vue SFC `<script setup>` Line/Column Offset Drift during Extraction (BUG-EXTR-03)
- **Context**: `packages/extractor-vue/src/vue-extractor.ts` & `compile-script-setup.ts`
- **What Was Expected**: When `lingui extract` analyzes a `.vue` Single File Component, messages inside `<script setup>` must report the exact file name (`test.vue`) and the correct line/column number of the call site within the `.vue` file.
- **What Actually Happened**: Vue's `@vue/compiler-sfc` does not generate source maps for `<script setup>` blocks during script compilation. As a result, Lingui treated the script content as an independent virtual file (`test.vue.ts`) with 1-based indexing starting from the first line of the script tag. Messages extracted in PO catalogs displayed `test.vue.ts:4:0` instead of `test.vue:8:24`, preventing developers from navigating to message origins in IDEs and breaking catalog comment annotations.
- **Evidence in Repo**: Commit `aed4f98e`, Issue/PR #2728, test file `packages/extractor-vue/src/extractor.test.ts`.
- **Root Cause**: Virtual script extraction decoupled from physical parent SFC coordinate offsets when source maps are omitted.
- **Remediation Code Diff**:
```typescript
@@ -63,11 +63,31 @@ export const createVueExtractor = (
           (target): target is ScriptTarget =>
             target != null && target.source !== "",
         )
-        .map(({ source, map, isTs }) =>
+        .map(({ source, map, start, isTs }) =>
           extractor.extract(
             filename + (isTs ? ".ts" : ""),
             source,
-            onMessageExtracted,
+            map || !start
+              ? onMessageExtracted
+              : (msg) => {
+                  if (!msg.origin) {
+                    return onMessageExtracted(msg)
+                  }
+
+                  // without a source map the position is relative to the block
+                  const [, line, column] = msg.origin
+
+                  onMessageExtracted({
+                    ...msg,
+                    origin: [
+                      filename,
+                      line + start.line - 1,
+                      line === 1 && column != null
+                        ? column + start.column - 1
+                        : column,
+                    ],
+                  })
+                },
             {
               sourceMaps: map,
               ...ctx,
```
- **Lesson**: When bridging between heterogeneous multi-language compilers (e.g., Vue SFC compiler to TypeScript AST parser), always capture the root coordinate boundaries (`loc.start`) of embedded blocks to calculate origin coordinates when source maps are absent.

---

### Incident 4: Vite Plugin Query String Stripping Failure in Native AST Transform (BUG-VITE-04)
- **Context**: `packages/vite-plugin/src/index.ts`
- **What Was Expected**: In Vite / Rollup pipelines, files loaded with query strings (e.g., `home.route.tsx?__react-router-build-client-route` from React Router / Remix framework mode, or `?vue&type=script`) must have their underlying language syntax (TSX/JSX) correctly recognized by the AST parser.
- **What Actually Happened**: The plugin forwarded the raw module ID containing the query suffix to native AST transform tools via `path.basename(id)`. Because the file name ended in `?__react-router-build-client-route` rather than `.tsx`, the native parser failed to recognize TSX grammar and crashed with parse errors upon encountering TypeScript syntax: `Parse error: Expected ',', got '{'`.
- **Evidence in Repo**: Issue #2702.
- **Root Cause**: Failure to sanitize and strip module URL query parameters (`id.split('?')[0]`) prior to extracting the file extension for AST parser target detection.
- **Remediation Pattern**:
```typescript
// Sanitizing module ID before filename resolution in Vite plugin
function cleanModuleId(id: string): string {
  const [cleanPath] = id.split("?", 2)
  return cleanPath
}

// In plugin transform hook:
const cleanPath = cleanModuleId(id)
const result = await transform(code, path.basename(cleanPath), {
  // Parser now reliably detects .tsx extension
})
```
- **Lesson**: Never pass raw build tool module IDs directly into language parsers or file extension inspection helpers. Always isolate the path from the query string and hash fragments.

---

### Incident 5: Multiprocess CLI Worker Dispatch Crash under `NODE_ENV=test` (BUG-CLI-05)
- **Context**: `packages/cli/src/api/typedPool.ts` & `resolveWorkersOptions.ts`
- **What Was Expected**: Running CLI commands (`lingui compile`, `lingui extract`) within test suites where `NODE_ENV=test` is set (e.g. `NODE_ENV=test lingui compile && jest`) must execute successfully.
- **What Actually Happened**: The CLI resolved the worker thread entrypoint using `process.env.NODE_ENV === "test" ? "${basePath}.jiti.js" : "${basePath}.prod.js"`. The published distribution artifacts (`dist/`) only bundled `.prod.js` and `.js` files; `.jiti.js` development wrappers were intentionally excluded from npm releases. As a result, the worker thread initialization crashed with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../compileWorkerWrapper.jiti.js'`.
- **Evidence in Repo**: Issue #2681.
- **Root Cause**: Tying published production package runtime resolution logic to the ambient `NODE_ENV` environment variable, assuming `NODE_ENV=test` would only occur inside the internal monorepo source tree.
- **Remediation Pattern**:
```typescript
// In CLI worker resolution: Check artifact existence or distribute unified bundles
function resolveWorkerFile(basePath: string): string {
  const prodWorker = `${basePath}.prod.js`
  const defaultWorker = `${basePath}.js`
  
  if (fs.existsSync(prodWorker)) {
    return prodWorker
  }
  return defaultWorker
}
```
- **Lesson**: Published library runtime paths must NEVER branch on `process.env.NODE_ENV === "test"`. Consumer build pipelines frequently invoke tools under `NODE_ENV=test`. Always use deterministic relative file existence checks or ship identical runtime entrypoints.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
- **Babel Identifier vs Numeric Literal Hazard**:
  In Babel AST construction (`@babel/types`), passing a numeric string (such as `"0"` from a plural choice key) to `types.identifier("0")` throws an unhandled exception in Babel 8 (`"0" is not a valid identifier name`).
  *Invariant Pattern from `messageDescriptorUtils.ts`*:
  ```typescript
  types.objectProperty(
    types.isValidIdentifier(key)
      ? types.identifier(key)
      : /^\d+$/.test(key)
        ? types.numericLiteral(Number(key))
        : types.stringLiteral(key),
    values[key]
  )
  ```
- **Template Literal Quasi Extraction Precision**:
  When extracting literal strings from template literal AST expressions, extracting `raw` vs `cooked` determines whether escaped Unicode sequences are decoded prematurely.
  *Invariant Pattern*:
  ```typescript
  function getTextFromExpression(types: BabelTypes, exp: Expression): string | undefined {
    if (types.isStringLiteral(exp)) {
      return exp.value
    }
    if (types.isTemplateLiteral(exp) && exp.quasis.length === 1) {
      return exp.quasis[0]?.value?.cooked ?? exp.quasis[0]?.value?.raw
    }
    return undefined
  }
  ```
- **Regex Boundary Escaping for Routing Systems**:
  File-based routing (Next.js, TanStack Router) uses parentheses and brackets (e.g., `(auth)`, `[id]`, `[[...slug]]`). Passing unescaped file paths into regexes causes catastrophic pattern failures.
  *Invariant Pattern from `packages/cli/src/api/utils.ts`*:
  ```typescript
  export function makePathRegexSafe(path: string): string {
    return path.replace(/[(){}[\]^$+]/g, "\\$&")
  }
  ```

---

### 2. Infinite Loop & Recursion Guards
- **AST Child Traversal Cycle Breaking**:
  When macros expand JSX tags into nested `<Trans>` trees, cyclic node references or unmanaged re-visitation cause compiler infinite loops. Lingui applies AST markers (comments) to signal that a node has already been transformed:
  ```typescript
  // packages/babel-plugin-lingui-macro/src/constants.ts
  export const EXTRACT_MARK = "lingui-extract-mark"
  
  // Guard condition during Babel traversal:
  if (node.leadingComments?.some(c => c.value.includes(EXTRACT_MARK))) {
    return path.skip() // Break infinite traversal loop
  }
  ```
- **Config Traversal Depth Protection**:
  Recursive deep replacements must avoid cyclic dependencies if user configs contain self-referencing pointers:
  ```typescript
  export function safeReplaceDeep(val: unknown, rootDir: string, seen = new WeakSet()): unknown {
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) {
        throw new Error("Cyclic reference detected in Lingui configuration.")
      }
      seen.add(val)
    }
    // ... proceed with traversal
  }
  ```

---

### 3. UI & UX Micro-Mechanics
- **JSX Whitespace Collapse Invariant (`cleanJSXElementLiteralChild.ts`)**:
  React collapses whitespace between elements according to strict JSX specification rules. Naive string extraction creates extra spaces or drops trailing whitespace needed between text and inline tags (`Click <a>here</a>`).
  *Invariant Pattern*:
  ```typescript
  export default function cleanJSXElementLiteralChild(value: string): string {
    const lines = value.split(/\r\n|\n|\r/)
    let lastNonEmptyLine = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/[^ \t]/)) lastNonEmptyLine = i
    }
    let str = ""
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const isFirstLine = i === 0
      