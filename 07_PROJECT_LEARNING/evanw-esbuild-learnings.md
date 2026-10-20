> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/evanw-esbuild-learnings.md`  
> **Source**: github ([https://github.com/evanw/esbuild](https://github.com/evanw/esbuild))  
> **Source Version**: `f6058f83`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T02:27:58.270Z  
> **Learning ID**: `learn-github-evanw-esbuild`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): evanw/esbuild

> **Canonical Artifact**: `07_PROJECT_LEARNING/evanw-esbuild-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/evanw/esbuild](https://github.com/evanw/esbuild))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T02:27:57.326Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `evanw/esbuild`
- **Description**: An extremely fast bundler for the web
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 40100 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/shared/worker.ts`
```
// This file is part of the web worker source code

interface Go {
  argv: string[]
  importObject: WebAssembly.Imports
  run(instance: WebAssembly.Instance): void
}

declare const ESBUILD_VERSION: string
declare function postMessage(message: any): void

onmessage = ({ data: wasm }: { data: WebAssembly.Module | string }) => {
  let decoder = new TextDecoder()
  let fs = (globalThis as any).fs

  let stderr = ''
  fs.writeSync = (fd: number, buffer: Uint8Array) => {
    if (fd === 1) {
      postMessage(buffer)
    } else if (fd === 2) {
      stderr += decoder.decode(buffer)
      let parts = stderr.split('\n')
      if (parts.length > 1) console.log(parts.slice(0, -1).join('\n'))
      stderr = parts[parts.length - 1]
    } else {
      throw new Error('Bad write')
    }
    return buffer.length
  }

  let stdin: Uint8Array[] = []
  let resumeStdin: () => void
  let stdinPos = 0

  onmessage = ({ data }) => {
    if (data.length > 0) {
      stdin.push(data)
      if (resumeStdin) resumeStdin()
    }
    return go
  }

  fs.read = (
    fd: number, buffer: Uint8Array, offset: number, length: number,
    position: null, callback: (err: Error | null, count?: number) => void,
  ) => {
    if (fd !== 0 || offset !== 0 || length !== buffer.length || position !== null) {
      throw new Error('Bad read')
    }

    if (stdin.length === 0) {
      resumeStdin = () => fs.read(fd, buffer, offset, length, position, callback)
      return
    }

    let first = stdin[0]
    let count = Math.max(0, Math.min(length, first.length - stdinPos))
    buffer.set(first.subarray(stdinPos, stdinPos + count), offset)
    stdinPos += count
    if (stdinPos === first.length) {
      stdin.shift()
      stdinPos = 0
    }
    callback(null, count)
  }

  let go: Go = new (globalThis as any).Go()
  go.argv = ['', `--service=${ESBUILD_VERSION}`]

  // Try to instantiate the module in the worker, then report back to the main thread
  tryToInstantiateModule(wasm, go).then(
    instance => {
      postMessage(null)
      go.run(instance)
    },
    error => {
      postMessage(error)
    },
  )

  return go
}

async function tryToInstantiateModule(wasm: WebAssembly.Module | string, go: Go): Promise<WebAssembly.Instance> {
  if (wasm instanceof WebAssembly.Module) {
    return WebAssembly.instantiate(wasm, go.importObject)
  }

  const res = await fetch(wasm)
  if (!res.ok) throw new Error(`Failed to download ${JSON.stringify(wasm)}`)

  // Attempt to use the superior "instantiateStreaming" API first
  if ('instantiateStreaming' in WebAssembly && /^application\/wasm($|;)/i.test(res.headers.get('Content-Type') || '')) {
    const result = await WebAssembly.instantiateStreaming(res, go.importObject)
    return result.instance
  }

  // Otherwise, fall back to the inferior "instantiate" API
  const bytes = await res.arrayBuffer()
  const result = await WebAssembly.instantiate(bytes, go.importObject)
  return result.instance
}

```

### Core Architecture Module: `compat-table/src/caniuse.ts`
```
// This file processes data from https://caniuse.com

import lite = require('caniuse-lite')
import { CSSFeature, CSSPrefixMap, CSSProperty, Engine, JSFeature, PrefixData, Support, SupportMap } from './index'

const enum StatusCode {
  Almost = 'a',
  Disabled = 'd',
  No = 'n',
  Polyfill = 'p',
  Prefix = 'x',
  Unknown = 'u',
  Yes = 'y',
}

const supportedAgents: Record<string, Engine> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  ie: 'IE',
  ios_saf: 'IOS',
  opera: 'Opera',
  safari: 'Safari',
}

const jsFeatures: Record<string, JSFeature> = {
  'es6-module-dynamic-import': 'DynamicImport',
}

const cssFeatures: Record<string, CSSFeature> = {
  'css-matches-pseudo': 'IsPseudoClass',
  'css-media-range-syntax': 'MediaRange',
}

const cssPrefixFeatures: Record<string, CSSProperty> = {
  'css-appearance': 'DAppearance',
  'css-backdrop-filter': 'DBackdropFilter',
  'background-clip-text': 'DBackgroundClip',
  'css-boxdecorationbreak': 'DBoxDecorationBreak',
  'css-clip-path': 'DClipPath',
  'font-kerning': 'DFontKerning',
  'css-hyphens': 'DHyphens',
  'css-initial-letter': 'DInitialLetter',
  'css-sticky': 'DPosition',
  'css-color-adjust': 'DPrintColorAdjust',
  'css3-tabsize': 'DTabSize',
  'css-text-orientation': 'DTextOrientation',
  'text-size-adjust': 'DTextSizeAdjust',
}

export const js: SupportMap<JSFeature> = {} as SupportMap<JSFeature>
export const css: SupportMap<CSSFeature> = {} as SupportMap<CSSFeature>
export const cssPrefix: CSSPrefixMap = {}

const compareVersions = (aStr: string, bStr: string): number => {
  const a = aStr.split('.')
  const b = bStr.split('.')
  let diff = +a[0] - +b[0]
  if (diff === 0) {
    diff = +(a[1] || '0') - +(b[1] || '0')
    if (diff === 0) {
      diff = +(a[2] || '0') - +(b[2] || '0')
    }
  }
  return diff
}

const addFeatures = <F extends string>(map: SupportMap<F>, features: Record<string, F>): void => {
  for (const feature in features) {
    const engines: Partial<Record<Engine, Record<string, Support>>> = {}
    const entry = lite.feature(lite.features[feature])

    for (const agent in entry.stats) {
      const engine = supportedAgents[agent]
      if (!engine) continue

      const versionRanges = entry.stats[agent]
      const versions: Record<string, Support> = {}

      for (const versionRange in versionRanges) {
        const statusCodes = versionRanges[versionRange].split(' ')
        const isSupported = statusCodes.includes(StatusCode.Yes)

        for (const version of versionRange.split('-')) {
          if (/^\d+(?:\.\d+(?:\.\d+)?)?$/.test(version)) {
            versions[version] = { force: isSupported }
          }
        }
      }

      engines[engine] = versions
    }

    map[features[feature]] = engines
  }
}

addFeatures(js, jsFeatures)
addFeatures(css, cssFeatures)

for (const feature in cssPrefixFeatures) {
  const prefixData: PrefixData[] = []
  const entry = lite.feature(lite.features[feature])

  for (const agent in entry.stats) {
    const engine = supportedAgents[agent]
    if (!engine) continue

    const model = lite.agents[agent]!
    const versionRanges = entry.stats[agent]
    const sortedVersions: { version: string, prefix: string | null }[] = []
    const prefixes = new Set<string>()

    for (const versionRange in versionRanges) {
      const statusCodes = versionRanges[versionRange].split(' ')
      const prefix = statusCodes.includes(StatusCode.Prefix)
        ? (model.prefix_exceptions && model.prefix_exceptions[versionRange]) || model.prefix
        : null
      for (const version of versionRange.split('-')) {
        // Filter out bogus versions such as "TP" for Safari
        if (/^\d+(\.\d+)*$/.test(version)) {
          sortedVersions.push({ version, prefix })
        }
      }
      if (prefix !== null) {
        prefixes.add(prefix)
      }
    }

    sortedVersions.sort((a, b) => compareVersions(a.version, b.version))

    for (const prefix of prefixes) {
      // Find the version after the latest version that requires the prefix (if there even is one)
      let i = sortedVersions.length
      while (i > 0 && sortedVersions[i - 1].prefix !== prefix) {
        i--
      }

      // Add an entry for this prefix combination
      const result: PrefixData = { engine, prefix }
      if (i < sortedVersions.length) {
        result.withoutPrefix = sortedVersions[i].version.split('.').map(x => +x)
      }
      prefixData.push(result)
    }
  }

  cssPrefix[cssPrefixFeatures[feature]] = prefixData
}

```

### Core Architecture Module: `compat-table/src/compat-table.ts`
```
// This file processes the data contained in https://github.com/kangax/compat-table

import fs = require('fs')
import path = require('path')

import es5 = require('../repos/compat-table/compat-table/data-es5.js')
import es6 = require('../repos/compat-table/compat-table/data-es6.js')
import stage1to3 = require('../repos/compat-table/compat-table/data-esnext.js')
import stage4 = require('../repos/compat-table/compat-table/data-es2016plus.js')
import environments = require('../repos/compat-table/compat-table/environments.json')
import parseEnvsVersions = require('../repos/compat-table/compat-table/build-utils/parse-envs-versions.js')
import interpolateAllResults = require('../repos/compat-table/compat-table/build-utils/interpolate-all-results.js')
import { Engine, JSFeature, SupportMap } from './index'

interpolateAllResults(es5.tests, environments)
interpolateAllResults(es6.tests, environments)
interpolateAllResults(stage1to3.tests, environments)
interpolateAllResults(stage4.tests, environments)

const features: Record<string, JSFeature> = {
  // ES5 features
  'Object/array literal extensions: Getter accessors': 'ObjectAccessors',
  'Object/array literal extensions: Setter accessors': 'ObjectAccessors',

  // ES6 features
  'arrow functions': 'Arrow',
  'class': 'Class',
  'const': 'ConstAndLet',
  'default function parameters': 'DefaultArgument',
  'destructuring, assignment': 'Destructuring',
  'destructuring, declarations': 'Destructuring',
  'destructuring, parameters': 'Destructuring',
  'for..of loops': 'ForOf',
  'function "name" property: isn\'t writable, is configurable': 'FunctionNameConfigurable',
  'generators': 'Generator',
  'let': 'ConstAndLet',
  'new.target': 'NewTarget',
  'object literal extensions': 'ObjectExtensions',
  'RegExp "y" and "u" flags': 'RegexpStickyAndUnicodeFlags',
  'rest parameters': 'RestArgument',
  'spread syntax for iterable objects': 'ArraySpread',
  'template literals': 'TemplateLiteral',
  'Unicode code point escapes': 'UnicodeEscapes',

  // >ES6 features
  'async functions': 'AsyncAwait',
  'Asynchronous Iterators: async generators': 'AsyncGenerator',
  'Asynchronous Iterators: for-await-of loops': 'ForAwait',
  'BigInt: basic functionality': 'Bigint',
  'exponentiation (**) operator': 'ExponentOperator',
  'Hashbang Grammar': 'Hashbang',
  'Logical Assignment': 'LogicalAssignment',
  'nested rest destructuring, declarations': 'NestedRestBinding',
  'nested rest destructuring, parameters': 'NestedRestBinding',
  'nullish coalescing operator (??)': 'NullishCoalescing',
  'object rest/spread properties': 'ObjectRestSpread',
  'optional catch binding': 'OptionalCatchBinding',
  'optional chaining operator (?.)': 'OptionalChain',
  'RegExp Lookbehind Assertions': 'RegexpLookbehindAssertions',
  'RegExp named capture groups': 'RegexpNamedCaptureGroups',
  'RegExp Unicode Property Escapes': 'RegexpUnicodePropertyEscapes',
  's (dotAll) flag for regular expressions': 'RegexpDotAllFlag',
  'Explicit Resource Management': 'Using',

  // Public fields
  'instance class fields: computed instance class fields': 'ClassField',
  'instance class fields: public instance class fields': 'ClassField',
  'static class fields: computed static class fields': 'ClassStaticField',
  'static class fields: public static class fields': 'ClassStaticField',

  // Private fields
  'instance class fields: optional deep private instance class fields access': 'ClassPrivateField',
  'instance class fields: optional private instance class fields access': 'ClassPrivateField',
  'instance class fields: private instance class fields basic support': 'ClassPrivateField',
  'instance class fields: private instance class fields initializers': 'ClassPrivateField',
  'static class fields: private static class fields': 'ClassPrivateStaticField',

  // Private methods
  'private class methods: private accessor properties': 'ClassPrivateAccessor',
  'private class methods: private instance methods': 'ClassPrivateMethod',
  'private class methods: private static accessor properties': 'ClassPrivateStaticAccessor',
  'private class methods: private static methods': 'ClassPrivateStaticMethod',

  // Private "in"
  'Ergonomic brand checks for private fields': 'ClassPrivateBrandCheck',
}

const environmentToEngine: Record<string, Engine> = {
  // The JavaScript standard
  'es': 'ES',

  // Common JavaScript runtimes
  'chrome': 'Chrome',
  'edge': 'Edge',
  'firefox': 'Firefox',
  'ie': 'IE',
  'ios': 'IOS',
  'node': 'Node',
  'opera': 'Opera',
  'safari': 'Safari',

  // Uncommon JavaScript runtimes
  'deno': 'Deno',
  'hermes': 'Hermes',
  'rhino': 'Rhino',
}

const subtestsToSkip: Record<string, boolean> = {
  // Safari supposedly doesn't throw an error for duplicate identifiers in
  // a function parameter list. The failing test case looks like this:
  //
  //   var f = function f([id, id]) { return id }
  //
  // However, this code will cause a compile error with esbuild so it's not
  // possible to encounter this issue when running esbuild-generated code in
  // Safari. I'm ignoring this test since Safari's destructuring otherwise
  // works fine so destructuring shouldn't be forbidden when building for
  // Safari.
  'destructuring, parameters: duplicate identifier': true,
}

const getValueOfTest = (value: boolean | { val: boolean }): boolean => {
  // Handle values like this:
  //
  //   {
  //     val: true,
  //     note_id: "ff-shorthand-methods",
  //     ...
  //   }
  //
  if (typeof value === 'object' && value !== null) {
    return value.val === true
  }

  // String values such as "flagged" are considered to be false
  return value === true
}

interface Test {
  name: string
  res: Record<string, boolean | { val: boolean }>
  subtests?: { name: string, res: Record<string, boolean | { val: boolean }> }[]
}

const updateMap = (map: SupportMap<JSFeature>, feature: JSFeature, engine: Engine, version: string, testName: string, passed: boolean): void => {
  const engines = map[feature] || (map[feature] = {})
  const versions = engines[engine] || (engines[engine] = {})
  const support = versions[version] || (versions[version] = {})
  if (passed) {
    support.passed = (support.passed || 0) + 1
  } else {
    support.failed ||= new Set
    support.failed.add(testName)
  }
}

const mergeIndividualTestResults = (map: SupportMap<JSFeature>, feature: JSFeature, testName: string, res: Record<string, boolean | { val: boolean }>): void => {
  const environments = parseEnvsVersions(res)
  for (const environment in environments) {
    const engine = environmentToEngine[environment]
    if (engine) {
      for (const parsed of environments[environment]) {
        const version = parsed.version.join('.')
        if (/^\d+(?:\.\d+(?:\.\d+)?)?$/.test(version)) {
          updateMap(map, feature, engine, version, testName, getValueOfTest(res[parsed.id]))
        }
      }
    }
  }
}

const mergeAllTestResults = (map: SupportMap<JSFeature>, tests: Test[]): void => {
  for (const test of tests) {
    const feature = features[test.name]
    if (feature) {
      if (test.subtests) {
        for (const subtest of test.subtests) {
          const fullName = `${test.name}: ${subtest.name}`
          if (subtestsToSkip[fullName]) continue
          mergeIndividualTestResults(map, feature, fullName, subtest.res)
        }
      } else {
        mergeIndividualTestResults(map, feature, test.name, test.res)
      }
    } else if (test.subtests) {
      for (const subtest of test.subtests) {
        const fullName = `${test.name}: ${subtest.name}`
        if (subtestsToSkip[fullName]) continue
        const feature = features[fullName]
        if (feature) mergeIndividualTestResults(map, feature, fullName, subtest.res)
      }
    }
  }
}

export const js: SupportMap<JSFeature> = {} as SupportMap<JSFeature>
mergeAllTestResults(js, [...es5.tests, ...es6.tests, ...stage4.tests, ...stage1to3.tests])

```

### Core Architecture Module: `compat-table/src/css_table.ts`
```
// This file generates "internal/compat/css_table.go"

import fs = require('fs')
import { Engine, CSSFeature, VersionRange, VersionRangeMap, CSSPrefixMap, PrefixData, CSSProperty } from './index'

const cssFeatureString = (feature: string): string => {
  return feature.replace(/([A-Z]+)/g, '-$1').slice(1).toLowerCase().replace(/[-_]+/g, '-')
}

const simpleMap = (entries: [string, string][]) => {
  let maxLength = 0
  for (const [key] of entries) {
    maxLength = Math.max(maxLength, key.length + 1)
  }
  return entries.map(([key, value]) => `\t${(key + ':').padEnd(maxLength)} ${value},`).join('\n')
}

const compareEngines = (a: Engine, b: Engine): number => {
  const lowerA = a.toLowerCase()
  const lowerB = b.toLowerCase()
  return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : 0
}

const cssTableMap = (map: Partial<Record<Engine, VersionRange[]>>) => {
  const engineKeys = (Object.keys(map) as Engine[]).sort(compareEngines)
  const maxLength = engineKeys.reduce((a, b) => Math.max(a, b.length + 1), 0)
  if (engineKeys.length === 0) return '{}'
  return `{\n${engineKeys.map(engine => {
    const items = map[engine]!.map(range => {
      return `{start: v{${range.start.concat(0, 0).slice(0, 3).join(', ')
        }}${range.end ? `, end: v{${range.end.concat(0, 0).slice(0, 3).join(', ')}}` : ''}}`
    })
    return `\t\t${(engine + ':').padEnd(maxLength)} {${items.join(', ')}},`
  }).join('\n')}\n\t}`
}

const cssPrefixName = (prefix: string): string => {
  return prefix[0].toUpperCase() + prefix.slice(1) + 'Prefix'
}

const cssPrefixMap = (entries: PrefixData[]) => {
  if (entries.length === 0) return '{}'
  entries.sort((a, b) => compareEngines(a.engine, b.engine))
  return `{\n${entries.map(({ engine, prefix, withoutPrefix }) => {
    const version = withoutPrefix && withoutPrefix.concat(0, 0).slice(0, 3).join(', ')
    return `\t\t{engine: ${engine}, prefix: ${cssPrefixName(prefix)}${version ? `, withoutPrefix: v{${version}}` : ''}},`
  }).join('\n')}\n\t}`
}

const generatedByComment = `// This file was automatically generated by "css_table.ts"`

export const generateTableForCSS = (map: VersionRangeMap<CSSFeature>, prefixes: CSSPrefixMap): void => {
  const prefixNames = new Set<string>()
  for (const property in prefixes) {
    for (const { prefix } of prefixes[property as CSSProperty]!) {
      prefixNames.add(cssPrefixName(prefix))
    }
  }

  fs.writeFileSync(__dirname + '/../internal/compat/css_table.go',
    `${generatedByComment}

package compat

import (
\t"github.com/evanw/esbuild/internal/css_ast"
)

type CSSFeature uint16

const (
${Object.keys(map).sort().map((feature, i) => `\t${feature}${i ? '' : ' CSSFeature = 1 << iota'}`).join('\n')}
)

var StringToCSSFeature = map[string]CSSFeature{
${simpleMap(Object.keys(map).sort().map(feature => [`"${cssFeatureString(feature)}"`, feature]))}
}

func (features CSSFeature) Has(feature CSSFeature) bool {
\treturn (features & feature) != 0
}

func (features CSSFeature) ApplyOverrides(overrides CSSFeature, mask CSSFeature) CSSFeature {
\treturn (features & ^mask) | (overrides & mask)
}

var cssTable = map[CSSFeature]map[Engine][]versionRange{
${Object.keys(map).sort().map(feature => `\t${feature}: ${cssTableMap(map[feature as CSSFeature]!)},`).join('\n')}
}

// Return all features that are not available in at least one environment
func UnsupportedCSSFeatures(constraints map[Engine]Semver) (unsupported CSSFeature) {
\tfor feature, engines := range cssTable {
\t\tif feature == InlineStyle {
\t\t\tcontinue // This is purely user-specified
\t\t}
\t\tfor engine, version := range constraints {
\t\t\tif !engine.IsBrowser() {
\t\t\t\t// Specifying "--target=es2020" shouldn't affect CSS
\t\t\t\tcontinue
\t\t\t}
\t\t\tif versionRanges, ok := engines[engine]; !ok || !isVersionSupported(versionRanges, version) {
\t\t\t\tunsupported |= feature
\t\t\t}
\t\t}
\t}
\treturn
}

type CSSPrefix uint8

const (
${[...prefixNames].sort().map((name, i) => `\t${name}${i ? '' : ' CSSPrefix = 1 << iota'}`).join('\n')}

\tNoPrefix CSSPrefix = 0
)

type prefixData struct {
\t// Note: In some cases, earlier versions did not require a prefix but later
\t// ones do. This is the case for Microsoft Edge for example, which switched
\t// the underlying browser engine from a custom one to the one from Chrome.
\t// However, we assume that users specifying a browser version for CSS mean
\t// "works in this version or newer", so we still add a prefix when a target
\t// is an old Edge version.
\tengine        Engine
\twithoutPrefix v
\tprefix        CSSPrefix
}

var cssPrefixTable = map[css_ast.D][]prefixData{
${Object.keys(prefixes).sort().map(property => `\tcss_ast.${property}: ${cssPrefixMap(prefixes[property as CSSProperty]!)},`).join('\n')}
}

func CSSPrefixData(constraints map[Engine]Semver) (entries map[css_ast.D]CSSPrefix) {
\tfor property, items := range cssPrefixTable {
\t\tprefixes := NoPrefix
\t\tfor engine, version := range constraints {
\t\t\tif !engine.IsBrowser() {
\t\t\t\t// Specifying "--target=es2020" shouldn't affect CSS
\t\t\t\tcontinue
\t\t\t}
\t\t\tfor _, item := range items {
\t\t\t\tif item.engine == engine && (item.withoutPrefix == v{} || compareVersions(item.withoutPrefix, version) > 0) {
\t\t\t\t\tprefixes |= item.prefix
\t\t\t\t}
\t\t\t}
\t\t}
\t\tif prefixes != NoPrefix {
\t\t\tif entries == nil {
\t\t\t\tentries = make(map[css_ast.D]CSSPrefix)
\t\t\t}
\t\t\tentries[property] = prefixes
\t\t}
\t}
\treturn
}
`)
}

```

### Core Architecture Module: `compat-table/src/index.ts`
```
// Run "make compat-table" to run this code
// Run "make update-compat-table" to update the data sources

import child_process = require('child_process')
import fs = require('fs')
import path = require('path')
import { generateTableForJS } from './js_table'
import { generateTableForCSS } from './css_table'
import * as caniuse from './caniuse'
import * as mdn from './mdn'

export type Engine = keyof typeof engines
export const engines = {
  Chrome: true,
  Deno: true,
  Edge: true,
  ES: true,
  Firefox: true,
  Hermes: true,
  IE: true,
  IOS: true,
  Node: true,
  Opera: true,
  Rhino: true,
  Safari: true,
}

export type JSFeature = keyof typeof jsFeatures
export const jsFeatures = {
  ArbitraryModuleNamespaceNames: true,
  ArraySpread: true,
  Arrow: true,
  AsyncAwait: true,
  AsyncGenerator: true,
  Bigint: true,
  Class: true,
  ClassField: true,
  ClassPrivateAccessor: true,
  ClassPrivateBrandCheck: true,
  ClassPrivateField: true,
  ClassPrivateMethod: true,
  ClassPrivateStaticAccessor: true,
  ClassPrivateStaticField: true,
  ClassPrivateStaticMethod: true,
  ClassStaticBlocks: true,
  ClassStaticField: true,
  ConstAndLet: true,
  Decorators: true,
  DefaultArgument: true,
  Destructuring: true,
  DynamicImport: true,
  ExponentOperator: true,
  ExportStarAs: true,
  ForAwait: true,
  ForOf: true,
  FromBase64: true,
  FunctionNameConfigurable: true,
  FunctionOrClassPropertyAccess: true,
  Generator: true,
  Hashbang: true,
  ImportAssertions: true,
  ImportAttributes: true,
  ImportDefer: true,
  ImportMeta: true,
  ImportSource: true,
  InlineScript: true,
  LogicalAssignment: true,
  NestedRestBinding: true,
  NewTarget: true,
  NodeColonPrefixImport: true,
  NodeColonPrefixRequire: true,
  NullishCoalescing: true,
  ObjectAccessors: true,
  ObjectExtensions: true,
  ObjectRestSpread: true,
  OptionalCatchBinding: true,
  OptionalChain: true,
  RegexpDotAllFlag: true,
  RegexpLookbehindAssertions: true,
  RegexpMatchIndices: true,
  RegexpNamedCaptureGroups: true,
  RegexpSetNotation: true,
  RegexpStickyAndUnicodeFlags: true,
  RegexpUnicodePropertyEscapes: true,
  RestArgument: true,
  TemplateLiteral: true,
  TopLevelAwait: true,
  TypeofExoticObjectIsObject: true,
  UnicodeEscapes: true,
  Using: true,
}

export type CSSFeature = keyof typeof cssFeatures
export const cssFeatures = {
  ColorFunctions: true,
  GradientDoublePosition: true,
  GradientInterpolation: true,
  GradientMidpoints: true,
  HexRGBA: true,
  HWB: true,
  InlineStyle: true,
  InsetProperty: true,
  IsPseudoClass: true,
  MediaRange: true,
  Modern_RGB_HSL: true,
  Nesting: true,
  RebeccaPurple: true,
}

export type CSSProperty = keyof typeof cssProperties
export const cssProperties = {
  DAppearance: true,
  DBackdropFilter: true,
  DBackgroundClip: true,
  DBoxDecorationBreak: true,
  DClipPath: true,
  DFontKerning: true,
  DHeight: true,
  DHyphens: true,
  DInitialLetter: true,
  DMask: true,
  DMaskComposite: true,
  DMaskImage: true,
  DMaskOrigin: true,
  DMaskPosition: true,
  DMaskRepeat: true,
  DMaskSize: true,
  DMaxHeight: true,
  DMaxWidth: true,
  DMinHeight: true,
  DMinWidth: true,
  DPosition: true,
  DPrintColorAdjust: true,
  DTabSize: true,
  DTextDecorationColor: true,
  DTextDecorationLine: true,
  DTextDecorationSkip: true,
  DTextEmphasisColor: true,
  DTextEmphasisPosition: true,
  DTextEmphasisStyle: true,
  DTextOrientation: true,
  DTextSizeAdjust: true,
  DUserSelect: true,
  DWidth: true,
}

export interface Support {
  force?: boolean
  passed?: number
  failed?: Set<string>
}

export interface VersionRange {
  start: number[]
  end?: number[]
}

export interface PrefixData {
  engine: Engine
  prefix: string
  withoutPrefix?: number[]
}

export type SupportMap<F extends string> = Record<F, Partial<Record<Engine, Record<string, Support>>>>
export type VersionRangeMap<F extends string> = Partial<Record<F, Partial<Record<Engine, VersionRange[]>>>>
export type WhyNotMap<F extends string> = Partial<Record<F, Partial<Record<Engine, string[]>>>>
export type CSSPrefixMap = Partial<Record<CSSProperty, PrefixData[]>>

const compareVersions = (a: number[], b: number[]): number => {
  let diff = a[0] - b[0]
  if (!diff) {
    diff = (a[1] || 0) - (b[1] || 0)
    if (!diff) {
      diff = (a[2] || 0) - (b[2] || 0)
    }
  }
  return diff
}

const mergeSupportMaps = <F extends string>(to: SupportMap<F>, from: SupportMap<F>): void => {
  for (const feature in from) {
    const fromEngines = from[feature as F]
    const toEngines = to[feature as F] || (to[feature as F] = {})

    for (const engine in fromEngines) {
      const fromVersions = fromEngines[engine as Engine]
      const toVersions = toEngines[engine as Engine] || (toEngines[engine as Engine] = {})

      for (const version in fromVersions) {
        if (version in toVersions) {
          throw new Error(`Merge conflict with feature=${feature} engine=${engine} version=${version}`)
        }

        toVersions[version] = fromVersions[version]
      }
    }
  }
}

const mergePrefixMaps = (to: CSSPrefixMap, from: CSSPrefixMap): void => {
  for (const property in from) {
    if (property in to) {
      throw new Error(`Merge conflict with property=${property}`)
    }
    to[property as CSSProperty] = from[property as CSSProperty]
  }
}

const supportMapToVersionRanges = <F extends string>(supportMap: SupportMap<F>): [VersionRangeMap<F>, WhyNotMap<F>] => {
  const versionRangeMap: VersionRangeMap<F> = {}
  const whyNotMap: WhyNotMap<F> = {}

  for (const feature in supportMap) {
    const engines = supportMap[feature as F]
    const featureMap: Partial<Record<Engine, VersionRange[]>> = {}
    const whyNotByEngine: Partial<Record<Engine, string[]>> = {}

    // Compute the maximum number of tests that any one engine has passed
    let maxPassed = 0
    for (const engine in engines) {
      const versions = engines[engine as Engine]
      for (const version in versions) {
        const { passed } = versions[version]
        if (passed && passed > maxPassed) maxPassed = passed
      }
    }

    for (const engine in engines) {
      const versions = engines[engine as Engine]
      const sortedVersions: { version: number[], supported: boolean, failed?: Set<string> }[] = []

      for (const version in versions) {
        const { force, passed, failed } = versions[version]
        const parsed = version.split('.').map(x => +x)
        sortedVersions.push({
          version: parsed,
          supported: force !== void 0 ? force :
            // If no test failed but less than the maximum number of tests passed,
            // that means we have partial data (some tests have never been run for
            // those versions). This happens for really old browser versions that
            // people can't even run anymore. We conservatively consider this
            // feature to be unsupported if not all tests were run, since it could
            // be dangerous to assume otherwise.
            !failed && passed === maxPassed,
          failed,
        })
      }

      sortedVersions.sort((a, b) => compareVersions(a.version, b.version))

      if (sortedVersions.length) {
        const last = sortedVersions[sortedVersions.length - 1]
        if (last.failed) whyNotByEngine[engine as Engine] = [...last.failed].sort()
      }

      const versionRanges: VersionRange[] = []
      let i = 0

      while (i < sortedVersions.length) {
        const { version, supported } = sortedVersions[i++]
        if (supported) {
          while (i < sortedVersions.length && sortedVersions[i].supported) {
            i++
          }
          const range: VersionRange = { start: version }
          if (i < sortedVersions.length) range.end = sortedVersions[i].version
          versionRanges.push(range)
        }
      }

      // The target is typically used to mean "make sure it works in this
      // version and later". So we just take the last version range here.
      //
      // However, we make an exception for node since people sometimes use
      // the target to build for the version of node that they currently
      // have. Node has a discontiguous version range for the support of
      // several features that people want to use.
      if (versionRanges.length && engine as Engine !== 'Node') {
        if (versionRanges[versionRanges.length - 1].end) {
          // We say this engine doesn't support this feature at all if
          // the feature is broken in the latest version of this engine.
          // This sometimes happens when engines deliberately decide to
          // not implement a feature of the language (e.g. Hermes).
          continue
        }

        // Otherwise, only consider this feature to be supported for the
        // last version range (i.e. the earliest version for which all
        // later versions support this feature). Delete all version ranges
        // before the last version range.
        versionRanges.splice(0, versionRanges.length - 1)
      }

      if (versionRanges.length) {
        featureMap[engine as Engine] = versionRanges
      }
    }

    versionRangeMap[feature as F] = featureMap
    whyNotMap[feature as F] = whyNotByEngine
  }

  return [versionRangeMap, whyNotMap]
}

const installGitHubDependencies = (): void => {
  const updateCommits = process.argv.includes('--update')
  const jsonPath = path.join(__dirname, 'package.json')
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  Object.keys(jsonData.githubDependencies).forEach(repo => {
    const fullPath = path.join(__dirname, 'repos', repo)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
      child_process.execFileSync('git', ['clone', '-b', 'gh-pages', `https://github.com/${repo}.git`, fullPath], { cwd: fullPath, stdio: 'inherit' })
    }

    child_process.execFileSync('git', ['fetch'], { cwd: fullPath, stdio: 'inherit' })

    if (updateCommits) {
      child_process.execFileSync('git', ['reset', '--har
```

### Core Architecture Module: `compat-table/src/js_table.ts`
```
// This file generates "internal/compat/js_table.go"

import fs = require('fs')
import { Engine, JSFeature, VersionRange, VersionRangeMap, WhyNotMap, engines } from './index'

const jsFeatureString = (feature: string): string => {
  return feature.replace(/([A-Z])/g, '-$1').slice(1).toLowerCase()
}

const simpleMap = (entries: [string, string][]) => {
  let maxLength = 0
  for (const [key] of entries) {
    maxLength = Math.max(maxLength, key.length + 1)
  }
  return entries.map(([key, value]) => `\t${(key + ':').padEnd(maxLength)} ${value},`).join('\n')
}

const compareEngines = (a: Engine, b: Engine): number => {
  const lowerA = a.toLowerCase()
  const lowerB = b.toLowerCase()
  return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : 0
}

const jsTableMap = (map: Partial<Record<Engine, VersionRange[]>>, whyNot: Partial<Record<Engine, string[]>>) => {
  const lines: string[] = []
  const whyNotKeys = (Object.keys(whyNot) as Engine[]).sort(compareEngines)
  for (const engine of whyNotKeys) {
    const failedTests = whyNot[engine]!
    lines.push(`\t\t// Note: The latest version of ${JSON.stringify(engine)} failed ` + (failedTests.length === 1
      ? `this test: ${failedTests[0]}` : `${failedTests.length} tests including: ${failedTests[0]}`))
  }

  const engineKeys = (Object.keys(map) as Engine[]).sort(compareEngines)
  const maxLength = engineKeys.reduce((a, b) => Math.max(a, b.length + 1), 0)
  for (const engine of engineKeys) {
    const items = map[engine]!.map(range => {
      return `{start: v{${range.start.concat(0, 0).slice(0, 3).join(', ')
        }}${range.end ? `, end: v{${range.end.concat(0, 0).slice(0, 3).join(', ')}}` : ''}}`
    })
    lines.push(`\t\t${(engine + ':').padEnd(maxLength)} {${items.join(', ')}},`)
  }

  if (lines.length === 0) return '{}'
  return `{\n${lines.join('\n')}\n\t}`
}

const jsTableValidEnginesMap = (engines: Engine[]) => {
  const maxLength = engines.reduce((a, b) => Math.max(a, b.length + 4), 0)
  if (engines.length === 0) return '{}'
  return engines.map(engine => {
    return `\t${`"${engine.toLowerCase()}": `.padEnd(maxLength)}api.Engine${engine},`
  }).join('\n')
}

const generatedByComment = `// This file was automatically generated by "js_table.ts"`

export const generateTableForJS = (map: VersionRangeMap<JSFeature>, whyNot: WhyNotMap<JSFeature>): void => {
  const enginesKeys = (Object.keys(engines) as Engine[]).sort(compareEngines)

  fs.writeFileSync(__dirname + '/../internal/compat/js_table.go',
    `${generatedByComment}

package compat

type Engine uint8

const (
${enginesKeys.map((engine, i) => `\t${engine}${i ? '' : ' Engine = iota'}`).join('\n')}
)

func (e Engine) String() string {
\tswitch e {
${enginesKeys.map(engine => `\tcase ${engine}:\n\t\treturn "${engine.toLowerCase()}"`).join('\n')}
\t}
\treturn ""
}

func (e Engine) IsBrowser() bool {
\tswitch e {
\tcase Chrome, Edge, Firefox, IE, IOS, Opera, Safari:
\t\treturn true
\t}
\treturn false
}

type JSFeature uint64

const (
${Object.keys(map).sort().map((feature, i) => `\t${feature}${i ? '' : ' JSFeature = 1 << iota'}`).join('\n')}
)

var StringToJSFeature = map[string]JSFeature{
${simpleMap(Object.keys(map).sort().map(feature => [`"${jsFeatureString(feature)}"`, feature]))}
}

func (features JSFeature) Has(feature JSFeature) bool {
\treturn (features & feature) != 0
}

func (features JSFeature) ApplyOverrides(overrides JSFeature, mask JSFeature) JSFeature {
\treturn (features & ^mask) | (overrides & mask)
}

var jsTable = map[JSFeature]map[Engine][]versionRange{
${Object.keys(map).sort().map(feature => `\t${feature}: ${jsTableMap(map[feature as JSFeature]!, whyNot[feature as JSFeature]!)},`).join('\n')}
}

// Return all features that are not available in at least one environment
func UnsupportedJSFeatures(constraints map[Engine]Semver) (unsupported JSFeature) {
\tfor feature, engines := range jsTable {
\t\tif feature == InlineScript {
\t\t\tcontinue // This is purely user-specified
\t\t}
\t\tfor engine, version := range constraints {
\t\t\tif versionRanges, ok := engines[engine]; !ok || !isVersionSupported(versionRanges, version) {
\t\t\t\tunsupported |= feature
\t\t\t}
\t\t}
\t}
\treturn
}
`)

  fs.writeFileSync(__dirname + '/../pkg/api/api_js_table.go',
    `${generatedByComment}

package api

import "github.com/evanw/esbuild/internal/compat"

type EngineName uint8

const (
${enginesKeys.filter(engine => engine !== 'ES').map((engine, i) => `\tEngine${engine}${i ? '' : ' EngineName = iota'}`).join('\n')}
)

func convertEngineName(engine EngineName) compat.Engine {
\tswitch engine {
${enginesKeys.filter(engine => engine !== 'ES').map(engine => `\tcase Engine${engine}:\n\t\treturn compat.${engine}`).join('\n')}
\tdefault:
\t\tpanic("Invalid engine name")
\t}
}
`)

  fs.writeFileSync(__dirname + '/../pkg/cli/cli_js_table.go',
    `${generatedByComment}

package cli

import "github.com/evanw/esbuild/pkg/api"

var validEngines = map[string]api.EngineName{
${jsTableValidEnginesMap(enginesKeys.filter(engine => engine !== 'ES'))}
}
`)
}

```

### Core Architecture Module: `compat-table/src/mdn.ts`
```
// This file processes data from https://developer.mozilla.org/en-US/docs/Web

import bcd, { BrowserName, SimpleSupportStatement, SupportBlock } from '@mdn/browser-compat-data'
import { CSSFeature, CSSPrefixMap, CSSProperty, Engine, JSFeature, PrefixData, Support, SupportMap } from './index'

const supportedEnvironments: Record<string, Engine> = {
  chrome: 'Chrome',
  deno: 'Deno',
  edge: 'Edge',
  firefox: 'Firefox',
  ie: 'IE',
  nodejs: 'Node',
  opera: 'Opera',
  safari: 'Safari',
  safari_ios: 'IOS',
}

const jsFeatures: Partial<Record<JSFeature, string>> = {
  ClassStaticBlocks: 'javascript.classes.static.initialization_blocks',
  ExportStarAs: 'javascript.statements.export.namespace',
  FromBase64: 'javascript.builtins.Uint8Array.fromBase64',
  ImportAssertions: 'javascript.statements.import.import_assertions',
  ImportAttributes: 'javascript.statements.import.import_attributes',
  ImportMeta: 'javascript.operators.import_meta',
  RegexpMatchIndices: 'javascript.builtins.RegExp.hasIndices',
  TopLevelAwait: 'javascript.operators.await.top_level',
}

const cssFeatures: Partial<Record<CSSFeature, string | string[]>> = {
  ColorFunctions: [
    'css.types.color.color',
    'css.types.color.lab',
    'css.types.color.lch',
    'css.types.color.oklab',
    'css.types.color.oklch',
  ],
  GradientDoublePosition: [
    'css.types.gradient.conic-gradient.doubleposition',
    'css.types.gradient.linear-gradient.doubleposition',
    'css.types.gradient.radial-gradient.doubleposition',
    'css.types.gradient.repeating-linear-gradient.doubleposition',
    'css.types.gradient.repeating-radial-gradient.doubleposition',
  ],
  GradientInterpolation: [
    'css.types.gradient.conic-gradient.hue_interpolation_method',
    'css.types.gradient.conic-gradient.interpolation_color_space',
    'css.types.gradient.linear-gradient.hue_interpolation_method',
    'css.types.gradient.linear-gradient.interpolation_color_space',
    'css.types.gradient.radial-gradient.hue_interpolation_method',
    'css.types.gradient.radial-gradient.interpolation_color_space',
    'css.types.gradient.repeating-conic-gradient.hue_interpolation_method',
    'css.types.gradient.repeating-conic-gradient.interpolation_color_space',
    'css.types.gradient.repeating-linear-gradient.hue_interpolation_method',
    'css.types.gradient.repeating-linear-gradient.interpolation_color_space',
    'css.types.gradient.repeating-radial-gradient.hue_interpolation_method',
    'css.types.gradient.repeating-radial-gradient.interpolation_color_space',
  ],
  GradientMidpoints: [
    'css.types.gradient.linear-gradient.interpolation_hints',
    'css.types.gradient.radial-gradient.interpolation_hints',
    'css.types.gradient.repeating-linear-gradient.interpolation_hints',
    'css.types.gradient.repeating-radial-gradient.interpolation_hints',
  ],
  HexRGBA: 'css.types.color.rgb_hexadecimal_notation.alpha_hexadecimal_notation',
  HWB: 'css.types.color.hwb',
  InsetProperty: 'css.properties.inset',
  Modern_RGB_HSL: [
    'css.types.color.hsl.alpha_parameter',
    'css.types.color.hsl.space_separated_parameters',
    'css.types.color.rgb.alpha_parameter',
    'css.types.color.rgb.float_values',
    'css.types.color.rgb.space_separated_parameters',
  ],
  Nesting: 'css.selectors.nesting',
  RebeccaPurple: 'css.types.color.named-color.rebeccapurple',
}

const similarPrefixedProperty: Record<string, { prefix: string, property: string }> = {
  'css.properties.mask-composite': {
    prefix: '-webkit-',
    property: 'css.properties.-webkit-mask-composite',
  },
}

const cssPrefixFeatures: Record<string, CSSProperty> = {
  'css.properties.height.stretch': 'DHeight',
  'css.properties.mask': 'DMask',
  'css.properties.mask-composite': 'DMaskComposite',
  'css.properties.mask-image': 'DMaskImage',
  'css.properties.mask-origin': 'DMaskOrigin',
  'css.properties.mask-position': 'DMaskPosition',
  'css.properties.mask-repeat': 'DMaskRepeat',
  'css.properties.mask-size': 'DMaskSize',
  'css.properties.max-height.stretch': 'DMaxHeight',
  'css.properties.max-width.stretch': 'DMaxWidth',
  'css.properties.min-height.stretch': 'DMinHeight',
  'css.properties.min-width.stretch': 'DMinWidth',
  'css.properties.text-decoration-color': 'DTextDecorationColor',
  'css.properties.text-decoration-line': 'DTextDecorationLine',
  'css.properties.text-decoration-skip': 'DTextDecorationSkip',
  'css.properties.text-emphasis-color': 'DTextEmphasisColor',
  'css.properties.text-emphasis-position': 'DTextEmphasisPosition',
  'css.properties.text-emphasis-style': 'DTextEmphasisStyle',
  'css.properties.user-select': 'DUserSelect',
  'css.properties.width.stretch': 'DWidth',
}

const alternativeNameToPrefix: Record<string, string> = {
  '-webkit-fill-available': '-webkit-',
  '-moz-available': '-moz-',
}

export const js: SupportMap<JSFeature> = {} as SupportMap<JSFeature>
export const css: SupportMap<CSSFeature> = {} as SupportMap<CSSFeature>
export const cssPrefix: CSSPrefixMap = {}

const isSemver = /^\d+(?:\.\d+(?:\.\d+)?)?$/

const compareVersions = (aStr: string, bStr: string): number => {
  const a = aStr.split('.')
  const b = bStr.split('.')
  let diff = +a[0] - +b[0]
  if (diff === 0) {
    diff = +(a[1] || '0') - +(b[1] || '0')
    if (diff === 0) {
      diff = +(a[2] || '0') - +(b[2] || '0')
    }
  }
  return diff
}

const extractProperty = (object: any, fullKey: string): any => {
  for (const key of fullKey.split('.')) {
    object = object[key]
  }
  if (!object) throw new Error(`Failed to find "${fullKey}"`)
  return object
}

const addFeatures = <F extends string>(map: SupportMap<F>, features: Partial<Record<F, string | string[]>>): void => {
  for (const feature in features) {
    const keys = features[feature]
    const maxVersions: Partial<Record<Engine, { version: string, isSupported: boolean }>> = {}

    for (const fullKey of Array.isArray(keys) ? keys : [keys]) {
      const support: SupportBlock = extractProperty(bcd, fullKey).__compat.support

      for (const env in support) {
        const engine = supportedEnvironments[env]

        if (engine) {
          const entries = support[env as BrowserName]!

          for (const { flags, version_added, version_removed, partial_implementation } of Array.isArray(entries) ? entries : [entries]) {
            if (typeof version_added === 'string' && isSemver.test(version_added)) {
              // The feature isn't considered to be supported if it was removed,
              // if it requires a flag, or if it's only partially-implemented
              const isSupported = (!version_removed || !flags) && !partial_implementation
              const maxVersion = maxVersions[engine]
              if (
                !maxVersion ||
                compareVersions(version_added, maxVersion.version) > 0 ||
                (compareVersions(version_added, maxVersion.version) === 0 && !isSupported)
              ) {
                maxVersions[engine] = { version: version_added, isSupported }
              }
            }
          }
        }
      }
    }

    const engines: Partial<Record<Engine, Record<string, Support>>> = {}
    for (const engine in maxVersions) {
      const { version, isSupported } = maxVersions[engine as Engine]!
      engines[engine as Engine] = { [version]: { force: isSupported } }
    }
    map[feature] = engines
  }
}

addFeatures(js, jsFeatures)
addFeatures(css, cssFeatures)

for (const fullKey in cssPrefixFeatures) {
  const prefixData: PrefixData[] = []
  const support: SupportBlock = extractProperty(bcd, fullKey).__compat.support

  for (const env in support) {
    const engine = supportedEnvironments[env]

    if (engine) {
      const initialEntries = support[env as BrowserName]!
      let entries: SimpleSupportStatement[] = Array.isArray(initialEntries) ? initialEntries : [initialEntries]

      // Figure out which version this property can be used unprefixed, if any.
      // This assumes that support for these CSS properties is never removed.
      // This assumption is wrong (Edge removed many features when it changed
      // its engine from EdgeHTML to Blink, basically becoming another browser)
      // but we ignore those cases for now.
      let version_unprefixed: string | undefined
      for (const { prefix, flags, version_added, version_removed, alternative_name } of entries) {
        if (!prefix && !alternative_name && !flags && typeof version_added === 'string' && !version_removed && isSemver.test(version_added)) {
          version_unprefixed = version_added
        }
      }

      type PrefixRange = { prefix: string, start: string, end?: string }
      const ranges: PrefixRange[] = []

      // The MDN dataset sometimes doesn't list prefixes if the values for the
      // prefixed property are sufficiently different. In that case, we may need
      // to search for the prefix information within another property instead.
      const similar = similarPrefixedProperty[fullKey]
      if (similar) {
        const similarSupport: SupportBlock = extractProperty(bcd, similar.property).__compat.support
        const similarEntries = similarSupport[env as BrowserName]
        if (!similarEntries) continue
        entries = Array.isArray(similarEntries) ? similarEntries : [similarEntries]
      }

      // Find all version ranges where a given prefix is supported
      for (let i = 0; i < entries.length; i++) {
        let { prefix, flags, version_added, version_removed, alternative_name } = entries[i]

        if (similar) {
          if (prefix) throw new Error(`Unexpected prefix "${prefix}" for similar property "${similar.property}"`)
          prefix = similar.prefix
        }

        if ((prefix || alternative_name) && !flags && typeof version_added === 'string' && isSemver.test(version_added)) {
          const range: PrefixRange = { prefix: prefix || alternativeNameToPrefix[alternative_name!], start: version_added }
          let withoutPrefix: string | undefined

          // The prefix is
```

### Core Architecture Module: `compat-table/src/types.d.ts`
```
// Allow TypeScript to import untyped ".js" files
declare module '*.js' {
  let any: any
  export = any
}

```

### Core Architecture Module: `internal/api_helpers/use_timer.go`
```
package api_helpers

// This flag is set by the CLI to activate the timer. It's put here instead of
// by the timer to discourage code from checking this flag. Only the code that
// creates the root timer should check this flag. Other code should check that
// the timer is not null to detect if the timer is being used or not.
var UseTimer bool

```

### Core Architecture Module: `internal/ast/ast.go`
```
package ast

// This file contains data structures that are used with the AST packages for
// both JavaScript and CSS. This helps the bundler treat both AST formats in
// a somewhat format-agnostic manner.

import (
	"sort"
	"strings"

	"github.com/evanw/esbuild/internal/helpers"
	"github.com/evanw/esbuild/internal/logger"
)

type ImportKind uint8

const (
	// An entry point provided by the user
	ImportEntryPoint ImportKind = iota

	// An ES6 import or re-export statement
	ImportStmt

	// A call to "require()"
	ImportRequire

	// An "import()" expression with a string argument
	ImportDynamic

	// A call to "require.resolve()"
	ImportRequireResolve

	// A CSS "@import" rule
	ImportAt

	// A CSS "composes" declaration
	ImportComposesFrom

	// A CSS "url(...)" token
	ImportURL
)

func (kind ImportKind) StringForMetafile() string {
	switch kind {
	case ImportStmt:
		return "import-statement"
	case ImportRequire:
		return "require-call"
	case ImportDynamic:
		return "dynamic-import"
	case ImportRequireResolve:
		return "require-resolve"
	case ImportAt:
		return "import-rule"
	case ImportComposesFrom:
		return "composes-from"
	case ImportURL:
		return "url-token"
	case ImportEntryPoint:
		return "entry-point"
	default:
		panic("Internal error")
	}
}

func (kind ImportKind) IsFromCSS() bool {
	switch kind {
	case ImportAt, ImportComposesFrom, ImportURL:
		return true
	}
	return false
}

func (kind ImportKind) MustResolveToCSS() bool {
	switch kind {
	case ImportAt, ImportComposesFrom:
		return true
	}
	return false
}

type ImportPhase uint8

const (
	EvaluationPhase ImportPhase = iota

	// See: https://github.com/tc39/proposal-defer-import-eval
	DeferPhase

	// See: https://github.com/tc39/proposal-source-phase-imports
	SourcePhase
)

type ImportRecordFlags uint16

const (
	// Sometimes the parser creates an import record and decides it isn't needed.
	// For example, TypeScript code may have import statements that later turn
	// out to be type-only imports after analyzing the whole file.
	IsUnused ImportRecordFlags = 1 << iota

	// If this is true, the import contains syntax like "* as ns". This is used
	// to determine whether modules that have no exports need to be wrapped in a
	// CommonJS wrapper or not.
	ContainsImportStar

	// If this is true, the import contains an import for the alias "default",
	// either via the "import x from" or "import {default as x} from" syntax.
	ContainsDefaultAlias

	// If this is true, the import contains an import for the alias "__esModule",
	// via the "import {__esModule} from" syntax.
	ContainsESModuleAlias

	// If true, this "export * from 'path'" statement is evaluated at run-time by
	// calling the "__reExport()" helper function
	CallsRunTimeReExportFn

	// Tell the printer to wrap this call to "require()" in "__toESM(...)"
	WrapWithToESM

	// Tell the printer to wrap this ESM exports object in "__toCJS(...)"
	WrapWithToCJS

	// Tell the printer to use the runtime "__require()" instead of "require()"
	CallRuntimeRequire

	// True for the following cases:
	//
	//   try { require('x') } catch { handle }
	//   try { await import('x') } catch { handle }
	//   try { require.resolve('x') } catch { handle }
	//   import('x').catch(handle)
	//   import('x').then(_, handle)
	//
	// In these cases we shouldn't generate an error if the path could not be
	// resolved.
	HandlesImportErrors

	// If true, this was originally written as a bare "import 'file'" statement
	WasOriginallyBareImport

	// If true, this import can be removed if it's unused
	IsExternalWithoutSideEffects

	// If true, "assert { type: 'json' }" was present
	AssertTypeJSON

	// If true, do not generate "external": true in the metafile
	ShouldNotBeExternalInMetafile

	// CSS "@import" of an empty file should be removed
	WasLoadedWithEmptyLoader

	// Unique keys are randomly-generated strings that are used to replace paths
	// in the source code after it's printed. These must not ever be split apart.
	ContainsUniqueKey
)

func (flags ImportRecordFlags) Has(flag ImportRecordFlags) bool {
	return (flags & flag) != 0
}

type ImportRecord struct {
	AssertOrWith *ImportAssertOrWith
	GlobPattern  *GlobPattern
	Path         logger.Path
	Range        logger.Range

	// If the "HandlesImportErrors" flag is present, then this is the location
	// of the error handler. This is used for error reporting.
	ErrorHandlerLoc logger.Loc

	// The resolved source index for an internal import (within the bundle) or
	// invalid for an external import (not included in the bundle)
	SourceIndex Index32

	// Files imported via the "copy" loader use this instead of "SourceIndex"
	// because they are sort of like external imports, and are not bundled.
	CopySourceIndex Index32

	Flags ImportRecordFlags
	Phase ImportPhase
	Kind  ImportKind
}

type AssertOrWithKeyword uint8

const (
	AssertKeyword AssertOrWithKeyword = iota
	WithKeyword
)

func (kw AssertOrWithKeyword) String() string {
	if kw == AssertKeyword {
		return "assert"
	}
	return "with"
}

type ImportAssertOrWith struct {
	Entries            []AssertOrWithEntry
	KeywordLoc         logger.Loc
	InnerOpenBraceLoc  logger.Loc
	InnerCloseBraceLoc logger.Loc
	OuterOpenBraceLoc  logger.Loc
	OuterCloseBraceLoc logger.Loc
	Keyword            AssertOrWithKeyword
}

type AssertOrWithEntry struct {
	Key             []uint16 // An identifier or a string
	Value           []uint16 // Always a string
	KeyLoc          logger.Loc
	ValueLoc        logger.Loc
	PreferQuotedKey bool
}

func FindAssertOrWithEntry(assertions []AssertOrWithEntry, name string) *AssertOrWithEntry {
	for _, assertion := range assertions {
		if helpers.UTF16EqualsString(assertion.Key, name) {
			return &assertion
		}
	}
	return nil
}

type GlobPattern struct {
	Parts       []helpers.GlobPart
	ExportAlias string
	Kind        ImportKind
}

// This stores a 32-bit index where the zero value is an invalid index. This is
// a better alternative to storing the index as a pointer since that has the
// same properties but takes up more space and costs an extra pointer traversal.
type Index32 struct {
	flippedBits uint32
}

func MakeIndex32(index uint32) Index32 {
	return Index32{flippedBits: ^index}
}

func (i Index32) IsValid() bool {
	return i.flippedBits != 0
}

func (i Index32) GetIndex() uint32 {
	return ^i.flippedBits
}

type SymbolKind uint8

const (
	// An unbound symbol is one that isn't declared in the file it's referenced
	// in. For example, using "window" without declaring it will be unbound.
	SymbolUnbound SymbolKind = iota

	// This has special merging behavior. You're allowed to re-declare these
	// symbols more than once in the same scope. These symbols are also hoisted
	// out of the scope they are declared in to the closest containing function
	// or module scope. These are the symbols with this kind:
	//
	// - Function arguments
	// - Function statements
	// - Variables declared using "var"
	//
	SymbolHoisted
	SymbolHoistedFunction

	// There's a weird special case where catch variables declared using a simple
	// identifier (i.e. not a binding pattern) block hoisted variables instead of
	// becoming an error:
	//
	//   var e = 0;
	//   try { throw 1 } catch (e) {
	//     print(e) // 1
	//     var e = 2
	//     print(e) // 2
	//   }
	//   print(e) // 0 (since the hoisting stops at the catch block boundary)
	//
	// However, other forms are still a syntax error:
	//
	//   try {} catch (e) { let e }
	//   try {} catch ({e}) { var e }
	//
	// This symbol is for handling this weird special case.
	SymbolCatchIdentifier

	// Generator and async functions are not hoisted, but still have special
	// properties such as being able to overwrite previous functions with the
	// same name
	SymbolGeneratorOrAsyncFunction

	// This is the special "arguments" variable inside functions
	SymbolArguments

	// Classes can merge with TypeScript namespaces.
	SymbolClass

	// Class names are not allowed to be referenced by computed property keys
	SymbolClassInComputedPropertyKey

	// A class-private identifier (i.e. "#foo").
	SymbolPrivateField
	SymbolPrivateMethod
	SymbolPrivateGet
	SymbolPrivateSet
	SymbolPrivateGetSetPair
	SymbolPrivateStaticField
	SymbolPrivateStaticMethod
	SymbolPrivateStaticGet
	SymbolPrivateStaticSet
	SymbolPrivateStaticGetSetPair

	// Labels are in their own namespace
	SymbolLabel

	// TypeScript enums can merge with TypeScript namespaces and other TypeScript
	// enums.
	SymbolTSEnum

	// TypeScript namespaces can merge with classes, functions, TypeScript enums,
	// and other TypeScript namespaces.
	SymbolTSNamespace

	// In TypeScript, imports are allowed to silently collide with symbols within
	// the module. Presumably this is because the imports may be type-only.
	SymbolImport

	// Assigning to a "const" symbol will throw a TypeError at runtime
	SymbolConst

	// Injected symbols can be overridden by provided defines
	SymbolInjected

	// Properties can optionally be renamed to shorter names
	SymbolMangledProp

	// CSS identifiers that are never renamed
	SymbolGlobalCSS

	// CSS identifiers that are renamed to be unique to the file they are in
	SymbolLocalCSS

	// This annotates all other symbols that don't have special behavior
	SymbolOther
)

func (kind SymbolKind) IsPrivate() bool {
	return kind >= SymbolPrivateField && kind <= SymbolPrivateStaticGetSetPair
}

func (kind SymbolKind) IsHoisted() bool {
	return kind == SymbolHoisted || kind == SymbolHoistedFunction
}

func (kind SymbolKind) IsHoistedOrFunction() bool {
	return kind.IsHoisted() || kind == SymbolGeneratorOrAsyncFunction
}

func (kind SymbolKind) IsFunction() bool {
	return kind == SymbolHoistedFunction || kind == SymbolGeneratorOrAsyncFunction
}

func (kind SymbolKind) IsUnboundOrInjected() bool {
	return kind == SymbolUnbound || kind == SymbolInjected
}

var InvalidRef Ref = Ref{^uint32(0), ^uint32(0)}

// Files are parsed in parallel for speed. We want to allow each parser to
// generate symbol IDs that won't conflict with each other. We also want to be
//
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4535** (2026-09-03): **minifier: Multi-declarator `let`/`const` block creates TDZ violation when object destructuring references an adjacent assignment**
  *Symptoms*: When minifying code where an object destructuring fallback value depends on a previously declared local variable, the minifier aggressively aggregates the assignments into a single comma-separated `let` or `const` block.   While evaluated sequentially, wrapping an object destructuring property fallback (`end: s = n - 1`) inside the same multi-declarator declaration chain as the source dependency (`let n = d.length`) triggers a strict Temporal Dead Zone (TDZ) violation runtime error in certain environments (such as Firefox/V8 implementations): `Uncaught ReferenceError: can't access lexical declaration before initialization`.  To remain spec-compliant and crash-free, the minifier should isolate the initial assignment block using a statement terminator (semicolon) before initiating the object destructuring statement.  ### Input Code (input.js) ```javascript export function pathVars(points, segment, params = {}) {   const count = points.length;   const { start: paramsStart = 0, end: paramsEnd = count - 1 } = params;   const { start: segmentStart, end: segmentEnd } = segment;   const start2 = Math.max(paramsStart, segmentStart);   const end2 = Math.min(paramsEnd, segmentEnd);   const outside = paramsStart < segmentStart && paramsEnd < segmentStart || paramsStart > segmentEnd && paramsEnd > segmentEnd;   return {     count,     start: start2,     loop: segment.loop,     ilen: end2 < start2 && !outside ? count + end2 - start2 : end2 - start2   }; } ```  ### Command executed ```bash 
  **Post-Mortem & Fix Analysis**:
  > False alarm. It seems the tdewolff minifier is the culprit. Sorry for the noise.

- **Issue #4512** (2026-08-10): **SIMD with Go 1.27+**
  *Symptoms*: <!-- When reporting a bug or requesting a feature, please do the following:  * Describe what esbuild is doing incorrectly and what it should be doing instead.  * Provide a way to reproduce the issue. The best way to do this is to demonstrate the issue on the playground (https://esbuild.github.io/try/) and paste the URL here. A link to a minimal code sample with instructions for how to reproduce the issue may also work. Issues without a way to reproduce them may be closed. -->  Go 1.27 adds an experimental [simd](https://pkg.go.dev/simd@go1.27rc2) package.  Would this be worth exploring? I have not yet analyzed if the Esbuild code would benefit from the new SIMD features, and would appreciate an opinion beforehand.  Thank you again for the very successful Esbuild project.

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `5e52b56f` (2026-08-08)
**Commit Message**: fix service deadlock after failed build setup (#4506)

**File**: `cmd/esbuild/service.go` (modified, +7/-2)
```diff
@@ -639,6 +639,12 @@ func (service *serviceType) handleBuildRequest(id uint32, request map[string]int
 	}
 
 	activeBuild := service.createActiveBuild(key)
+	shouldDestroyActiveBuild := true
+	defer func() {
+		if shouldDestroyActiveBuild {
+			service.destroyActiveBuild(key)
+		}
+	}()
 
 	hasOnEndCallbacks := false
 	if plugins, ok := request["plugins"]; ok {
@@ -769,6 +775,7 @@ func (service *serviceType) handleBuildRequest(id uint32, request map[string]int
 		// Keep the build alive until "dispose" has been called
 		activeBuild.disposeWaitGroup.Add(1)
 		activeBuild.ctx = ctx
+		shouldDestroyActiveBuild = false
 
 		return encodePacket(packet{
 			id: id,
@@ -782,8 +789,6 @@ func (service *serviceType) handleBuildRequest(id uint32, request map[string]int
 	result := api.Build(options)
 	response := resultToResponse(result)
 
-	service.destroyActiveBuild(key)
-
 	return encodePacket(packet{
 		id:    id,
 		value: response,
```

**File**: `cmd/esbuild/service_test.go` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+package main
+
+import (
+	"os"
+	"testing"
+	"time"
+
+	"github.com/evanw/esbuild/internal/helpers"
+)
+
+func TestHandleBuildRequestReleasesActiveBuildAfterError(t *testing.T) {
+	absWorkingDir, err := os.Getwd()
+	if err != nil {
+		t.Fatal(err)
+	}
+
+	tests := []struct {
+		name            string
+		modifyRequest   func(map[string]interface{})
+		expectedError   string
+		expectedMessage string
+	}{
+		{
+			name: "InvalidPluginRegExp",
+			modifyRequest: func(request map[string]interface{}) {
+				request["plugins"] = []interface{}{map[string]interface{}{
+					"name":  "test",
+					"onEnd": false,
+					"onResolve": []interface{}{map[string]interface{}{
+						"id":        0,
+						"filter":    "x(?=y)",
+						"namespace": "",
+					}},
+					"onLoad": []interface{}{},
+				}}
+			},
+			expectedError: "[test] \"onResolve\" filter is not a valid Go regular expression: \"x(?=y)\"",
+		},
+		{
+			name: "InvalidContextOptions",
+			modifyRequest: func(request map[string]interface{}) {
+				request["context"] = true
+				request["flags"] = []interface{}{"--external:test"}
+			},
+			expectedMessage: "Cannot use \"external\" without \"bundle\"",
+		},
+	}
+
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			service := serviceType{
+				activeBuilds:       make(map[int]*activeBuild),
+				keepAliveWaitGroup: helpers.MakeThreadSafeWaitGroup(),
+			}
+			request := map[string]interface{}{
+				"context":       false,
+				"key":           0,
+				"write":         false,
+				"entries":       []interface{}{},
+				"flags":         []interface{}{},
+				"absWorkingDir": absWorkingDir,
+				"nodePaths":     []interface{}{},
+			}
+			test.modifyRequest(request)
+
+			encoded := service.handleBuildRequest(0, request)
+			bytes, _, ok := readLengthPrefixedSlice(encoded)
+			if !ok {
+				t.Fatal("Invalid encoded response")
+			}
+			response, ok := decodePacket(bytes)
+			if !ok {
+				t.Fatal("Invalid response packet")
+			}
+			value := response.value.(map[string]interface{})
+			if test.expectedError != "" && value["error"] != test.expectedError {
+				t.Fatalf("Expected error %q, got %q", test.expectedError, value["error"])
+			}
+			if test.expectedMessage != "" {
+				errors := value["errors"].([]interface{})
+				if len(errors) != 1 || errors[0].(map[string]interface{})["text"] != test.expectedMessage {
+					t.Fatalf("Expected message %q, got %v", test.expectedMessage, errors)
+				}
+			}
+
+			if service.getActiveBuild(0) != nil {
+				t.Fatal("Active build was not released")
+			}
+
+			done := make(chan struct{})
+			go func() {
+				service.keepAliveWaitGroup.Wait()
+				close(done)
+			}()
+			select {
+			case <-done:
+			case <-time.After(time.Second):
+				t.Fatal("Keep-alive wait group did not reach zero")
+			}
+		})
+	}
+}
```

---

### Incident Patch 2: `f6058f83` (2026-08-09)
**Commit Message**: close #3701, fix #3896: temp `ref` child for kill

**File**: `lib/npm/node.ts` (modified, +13/-5)
```diff
@@ -222,10 +222,9 @@ export let analyzeMetafileSync: typeof types.analyzeMetafileSync = (metafile, op
   return result!
 }
 
-export const stop = () => {
-  if (stopService) stopService()
+export const stop = async () => {
+  if (stopService) await stopService()
   if (workerThreadService) workerThreadService.stop()
-  return Promise.resolve()
 }
 
 let initializeWasCalled = false
@@ -251,7 +250,7 @@ interface Service {
 
 let defaultWD = process.cwd()
 let longLivedService: Service | undefined
-let stopService: (() => void) | undefined
+let stopService: (() => Promise<void>) | undefined
 
 let ensureServiceIsRunning = (): Service => {
   if (longLivedService) return longLivedService
@@ -288,13 +287,22 @@ let ensureServiceIsRunning = (): Service => {
   stdout.on('end', afterClose)
 
   stopService = () => {
-    // Close all resources related to the subprocess.
+    // Deno's implementation of node's API needs us to have a reference to the
+    // child while we kill it. See: https://github.com/evanw/esbuild/pull/3701
+    const promise = new Promise<void>(resolve => child.on('exit', () => {
+      child.unref()
+      resolve()
+    }))
+    child.ref()
+
+    // Close all resources related to the subprocess
     stdin.destroy()
     stdout.destroy()
     child.kill()
     initializeWasCalled = false
     longLivedService = undefined
     stopService = undefined
+    return promise
   }
 
   let refCount = 0
```

---

### Incident Patch 3: `0a491dac` (2026-08-08)
**Commit Message**: fix #4411: prevent duplicate chunks from merging

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -1,5 +1,13 @@
 # Changelog
 
+## Unreleased
+
+* Emit an error when code splitting chunks would be merged ([#4411](https://github.com/evanw/esbuild/issues/4411))
+
+    It's possible to configure esbuild such that separate output files end up with the same output path. For example, you could name all code splitting chunks `chunk` via the `chunkNames` setting, which might generate multiple output files with the same path `chunk.js`. This does not happen by default since by default the chunk names include a hash to make sure they're unique (e.g. named something like `chunk-GX7G2SBE.js` instead).
+
+    Previously esbuild allowed output files to be merged if both the file path and content were the same. This behavior was intended for assets (e.g. images) but is not appropriate for code, as code modules may still have their own internal state that needs to stay separate. This configuration is no longer allowed starting with this release. Doing this is now a build error. If your code structure generates conflicting chunk names, then you should make sure the chunk names include a placeholder for the hash.
+
 ## 0.28.2
 
 * Fix tree shaking bug due to TypeScript import alias ([#4507](https://github.com/evanw/esbuild/issues/4507))
```

**File**: `internal/bundler/bundler.go` (modified, +10/-5)
```diff
@@ -2805,6 +2805,7 @@ func (s *scanner) processScannedFiles(entryPointMeta []graph.EntryPoint) []scann
 				AbsPath:           s.fs.Join(s.options.AbsOutputDir, relPath),
 				Contents:          bytes,
 				JSONMetadataChunk: jsonMetadataChunk,
+				CanBeMerged:       true,
 			}}
 		}
 
@@ -3165,22 +3166,25 @@ func (b *Bundle) Compile(log logger.Log, timer *helpers.Timer, mangleCache map[s
 		// Make an exception for files that have identical contents. In that case
 		// the duplicate is just silently filtered out. This can happen with the
 		// "file" loader, for example.
-		outputFileMap := make(map[string][]byte)
+		outputFileMap := make(map[string]graph.OutputFile)
 		end := 0
 		for _, outputFile := range outputFiles {
 			absPathKey := canonicalFileSystemPathForWindows(outputFile.AbsPath)
-			contents, ok := outputFileMap[absPathKey]
+			existingFile, ok := outputFileMap[absPathKey]
 
 			// If this isn't a duplicate, keep the output file
 			if !ok {
-				outputFileMap[absPathKey] = outputFile.Contents
+				outputFileMap[absPathKey] = outputFile
 				outputFiles[end] = outputFile
 				end++
 				continue
 			}
 
-			// If the names and contents are both the same, only keep the first one
-			if bytes.Equal(contents, outputFile.Contents) {
+			// If the names and contents are both the same, only keep the first one.
+			// We only do this for assets, not for code, as two identical code files
+			// need unique identity as they might need to have their own separate
+			// copies of internal state. See https://github.com/evanw/esbuild/issues/4411
+			if existingFile.CanBeMerged && outputFile.CanBeMerged && bytes.Equal(existingFile.Contents, outputFile.Contents) {
 				continue
 			}
 
@@ -3189,6 +3193,7 @@ func (b *Bundle) Compile(log logger.Log, timer *helpers.Timer, mangleCache map[s
 			if relPath, ok := b.fs.Rel(b.fs.Cwd(), outputPath); ok {
 				outputPath = relPath
 			}
+			outputPath = strings.ReplaceAll(outputPath, "\\", "/")
 			log.AddError(nil, logger.Range{}, "Two output files share the same path but have different contents: "+outputPath)
 		}
 		outputFiles = outputFiles[:end]
```

**File**: `internal/bundler_tests/bundler_default_test.go` (modified, +64/-3)
```diff
@@ -3131,6 +3131,47 @@ func TestNoOverwriteInputFileError(t *testing.T) {
 	})
 }
 
+// https://github.com/evanw/esbuild/issues/4411
+func TestDuplicateChunkNameIssue4411(t *testing.T) {
+	default_suite.expectBundled(t, bundled{
+		files: map[string]string{
+			"/entry-a1.js": `
+				import { add } from "./shared-a/shared.js"
+				export const addA1 = () => add("a1")
+			`,
+			"/entry-a2.js": `
+				import { add } from "./shared-a/shared.js"
+				export const addA2 = () => add("a2")
+			`,
+			"/entry-b1.js": `
+				import { add } from "./shared-b/shared.js"
+				export const addB1 = () => add("b1")
+			`,
+			"/entry-b2.js": `
+				import { add } from "./shared-b/shared.js"
+				export const addB2 = () => add("b2")
+			`,
+			"/shared-a/shared.js": `
+				const cache = []
+				export const add = str => cache.push(str)
+			`,
+			"/shared-b/shared.js": `
+				const cache = []
+				export const add = str => cache.push(str)
+			`,
+		},
+		entryPaths: []string{"/entry-a1.js", "/entry-a2.js", "/entry-b1.js", "/entry-b2.js"},
+		options: config.Options{
+			Mode:              config.ModeBundle,
+			AbsOutputDir:      "/out",
+			CodeSplitting:     true,
+			ChunkPathTemplate: []config.PathTemplate{{Placeholder: config.NamePlaceholder}},
+		},
+		expectedCompileLog: `ERROR: Two output files share the same path but have different contents: out/chunk.js
+`,
+	})
+}
+
 func TestDuplicateEntryPoint(t *testing.T) {
 	default_suite.expectBundled(t, bundled{
 		files: map[string]string{
@@ -3141,8 +3182,10 @@ func TestDuplicateEntryPoint(t *testing.T) {
 		entryPaths: []string{"/entry.js", "/entry.js"},
 		options: config.Options{
 			Mode:         config.ModeBundle,
-			AbsOutputDir: "/out.js",
+			AbsOutputDir: "/out",
 		},
+		expectedCompileLog: `ERROR: Two output files share the same path but have different contents: out/entry.js
+`,
 	})
 }
 
@@ -3156,7 +3199,7 @@ func TestRelativeEntryPointError(t *testing.T) {
 		entryPaths: []string{"entry"},
 		options: config.Options{
 			Mode:         config.ModeBundle,
-			AbsOutputDir: "/out.js",
+			AbsOutputDir: "/out",
 		},
 		expectedScanLog: `ERROR: Could not resolve "entry"
 NOTE: Use the relative path "./entry" to reference the file "entry.js". Without the leading "./", the path "entry" is being interpreted as a package path instead.
@@ -3174,8 +3217,26 @@ func TestMultipleEntryPointsSameNameCollision(t *testing.T) {
 		entryPaths: []string{"/a/entry.js", "/b/entry.js"},
 		options: config.Options{
 			Mode:         config.ModeBundle,
-			AbsOutputDir: "/out/",
+			AbsOutputDir: "/out",
+		},
+	})
+}
+
+func TestMultipleEntryPointsSameNameCollisionError(t *testing.T) {
+	default_suite.expectBundled(t, bundled{
+		files: map[string]string{
+			"/a/entry.js": `import {foo} from '../common.js'; console.log(foo)`,
+			"/b/entry.js": `import {foo} from '../common.js'; console.log(foo)`,
+			"/common.js":  `export let foo = 123`,
 		},
+		entryPaths: []string{"/a/entry.js", "/b/entry.js"},
+		options: config.Options{
+			Mode:              config.ModeBundle,
+			AbsOutputDir:      "/out",
+			EntryPathTemplate: []config.PathTemplate{{Placeholder: config.NamePlaceholder}},
+		},
+		expectedCompileLog: `ERROR: Two output files share the same path but have different contents: out/entry.js
+`,
 	})
 }
 
```

**File**: `internal/bundler_tests/snapshots/snapshots_default.txt` (modified, +0/-6)
```diff
@@ -1156,12 +1156,6 @@ var require_index = __commonJS({
 var import__ = __toESM(require_index());
 console.log(import__.x);
 
-================================================================================
-TestDuplicateEntryPoint
----------- /out.js/entry.js ----------
-// entry.js
-console.log(123);
-
 ================================================================================
 TestDuplicatePropertyWarning
 ---------- /out/entry.js ----------
```

**File**: `internal/graph/input.go` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ type OutputFile struct {
 	AbsPath      string
 	Contents     []byte
 	IsExecutable bool
+	CanBeMerged  bool
 }
 
 type SideEffects struct {
```

**File**: `internal/linker/linker.go` (modified, +5/-0)
```diff
@@ -663,6 +663,7 @@ func (c *linkerContext) generateChunksInParallel(additionalFiles []graph.OutputF
 			// output directory. This is used by the "file" and "copy" loaders.
 			var commentPrefix string
 			var commentSuffix string
+			var canBeMerged bool
 			switch chunkRepr := chunk.chunkRepr.(type) {
 			case *chunkReprJS:
 				for _, sourceIndex := range chunkRepr.filesInChunkInOrder {
@@ -678,6 +679,7 @@ func (c *linkerContext) generateChunksInParallel(additionalFiles []graph.OutputF
 				}
 				commentPrefix = "/*"
 				commentSuffix = " */"
+				canBeMerged = true
 			}
 
 			// Path substitution for the chunk itself
@@ -708,6 +710,7 @@ func (c *linkerContext) generateChunksInParallel(additionalFiles []graph.OutputF
 					JSONMetadataChunk: fmt.Sprintf(
 						c.options.MetafileFormat.MaybeRemoveWhitespace("{\n      \"imports\": [],\n      \"exports\": [],\n      \"inputs\": {},\n      \"bytes\": %d\n    }"),
 						len(chunk.externalLegalComments)),
+					CanBeMerged: true,
 				})
 			}
 
@@ -747,6 +750,7 @@ func (c *linkerContext) generateChunksInParallel(additionalFiles []graph.OutputF
 						JSONMetadataChunk: fmt.Sprintf(
 							c.options.MetafileFormat.MaybeRemoveWhitespace("{\n      \"imports\": [],\n      \"exports\": [],\n      \"inputs\": {},\n      \"bytes\": %d\n    }"),
 							len(outputSourceMap)),
+						CanBeMerged: true,
 					})
 				}
 			}
@@ -771,6 +775,7 @@ func (c *linkerContext) generateChunksInParallel(additionalFiles []graph.OutputF
 				Contents:          outputContents,
 				JSONMetadataChunk: jsonMetadataChunk,
 				IsExecutable:      chunk.isExecutable,
+				CanBeMerged:       canBeMerged,
 			})
 
 			results[chunkIndex] = outputFiles
```

#### Recent Merged Pull Requests:
- **PR #4510** (closed): fix #4508: preserve lowered assignment bindings (@wanxiankai)
- **PR #4506** (2026-08-08): fix service deadlock after failed build setup (@ZuBB)
- **PR #4500** (2026-08-08): fix #4497: preserve nested ampersands during minification (@snoopuppy582)
- **PR #4493** (closed): fix #4484: actually skip writing the file when refusing to overwrite an input file (@Zelys-DFKH)
- **PR #4490** (closed): Create npm-publish.yml (@Huynhthuong2505)
- **PR #4488** (2026-08-08): css: fix green/blue channel swap in oklch gamut mapping (@chatman-media)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. service deadlock after failed build setup (#4506)

**RULE**:
When implementing operations in `cmd/esbuild/service.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in evanw/esbuild. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5e52b56f`: service deadlock after failed build setup (#4506). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/esbuild/service.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	shouldDestroyActiveBuild := true
	defer func() {
		if shouldDestroyActiveBuild {
			service.destroyActiveBuild(key)
		}
	}()
		shouldDestroyActiveBuild = false
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	service.destroyActiveBuild(key)

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5e52b56f` are properly handled with clean fallback behavior.
