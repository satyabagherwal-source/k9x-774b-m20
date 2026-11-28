# Domain G — Architecture Intelligence: Architecture Intelligence: vitejs-vite-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "vitejs-vite-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T07:40:48.073Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-vitejs-vite-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vitejs-vite-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T07:40:48.073Z`  
> **Learning ID**: `LEARN-EVO-vitejs-vite-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 58%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from vitejs-vite-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vitejs-vite-learnings.md`  
> **Source**: github ([https://github.com/vitejs/vite](https://github.com/vitejs/vite))  
> **Source Version**: `7d0c054f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T07:40:09.493Z  
> **Learning ID**: `learn-github-vitejs-vite`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): vitejs/vite

> **Canonical Artifact**: `07_PROJECT_LEARNING/vitejs-vite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vitejs/vite](https://github.com/vitejs/vite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T07:40:09.488Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vitejs/vite`
- **Description**: Next generation frontend tooling. It's fast!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 84153 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/vite/src/module-runner/utils.ts`
```
import * as pathe from 'pathe'
import { isWindows } from '../shared/utils'

const textDecoder = new TextDecoder()

export const decodeBase64: (base64: string) => string = (() => {
  // Capture the binding at module load: realms may legitimately delete
  // `globalThis.Buffer` afterwards (e.g. browser-parity tests), and this
  // decoder runs lazily while preparing stack traces
  const capturedBuffer = typeof Buffer === 'function' ? Buffer : undefined
  if (capturedBuffer && typeof capturedBuffer.from === 'function') {
    return (base64: string) =>
      capturedBuffer.from(base64, 'base64').toString('utf-8')
  }

  return (base64: string) =>
    textDecoder.decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)))
})()

const CHAR_FORWARD_SLASH = 47
const CHAR_BACKWARD_SLASH = 92

const percentRegEx = /%/g
const backslashRegEx = /\\/g
const newlineRegEx = /\n/g
const carriageReturnRegEx = /\r/g
const tabRegEx = /\t/g
const questionRegex = /\?/g
const hashRegex = /#/g

function encodePathChars(filepath: string) {
  if (filepath.includes('%')) filepath = filepath.replace(percentRegEx, '%25')
  // In posix, backslash is a valid character in paths:
  if (!isWindows && filepath.includes('\\'))
    filepath = filepath.replace(backslashRegEx, '%5C')
  if (filepath.includes('\n')) filepath = filepath.replace(newlineRegEx, '%0A')
  if (filepath.includes('\r'))
    filepath = filepath.replace(carriageReturnRegEx, '%0D')
  if (filepath.includes('\t')) filepath = filepath.replace(tabRegEx, '%09')
  return filepath
}

export const posixDirname: (path: string) => string = pathe.dirname
export const posixResolve: (...paths: string[]) => string = pathe.resolve
export const posixJoin: (...paths: string[]) => string = pathe.join

export function posixPathToFileHref(posixPath: string): string {
  let resolved = posixResolve(posixPath)
  // path.resolve strips trailing slashes so we must add them back
  const filePathLast = posixPath.charCodeAt(posixPath.length - 1)
  if (
    (filePathLast === CHAR_FORWARD_SLASH ||
      (isWindows && filePathLast === CHAR_BACKWARD_SLASH)) &&
    resolved.at(-1) !== '/'
  )
    resolved += '/'

  // Call encodePathChars first to avoid encoding % again for ? and #.
  resolved = encodePathChars(resolved)

  // Question and hash character should be included in pathname.
  // Therefore, encoding is required to eliminate parsing them in different states.
  // This is done as an optimization to not creating a URL instance and
  // later triggering pathname setter, which impacts performance
  if (resolved.includes('?')) resolved = resolved.replace(questionRegex, '%3F')
  if (resolved.includes('#')) resolved = resolved.replace(hashRegex, '%23')
  return new URL(`file://${resolved}`).href
}

export function toWindowsPath(path: string): string {
  return path.replace(/\//g, '\\')
}

```

### Core Architecture Module: `packages/vite/src/node/plugins/worker.ts`
```
import path from 'node:path'
import { type Import, init, parse } from 'es-module-lexer'
import MagicString from 'magic-string'
import colors from 'picocolors'
import type {
  OutputAsset,
  OutputChunk,
  PluginContext,
  RolldownOutput,
  RollupError,
} from 'rolldown'
import { viteWebWorkerPostPlugin as nativeWebWorkerPostPlugin } from 'rolldown/experimental'
import { cleanUrl, splitFileAndPostfix } from '../../shared/utils'
import {
  BuildEnvironment,
  ChunkMetadataMap,
  injectEnvironmentToHooks,
  onRollupLog,
} from '../build'
import type { ResolvedConfig } from '../config'
import { ENV_ENTRY, ENV_PUBLIC_PATH } from '../constants'
import type { Environment } from '../environment'
import type { Logger } from '../logger'
import type { Plugin } from '../plugin'
import {
  injectQuery,
  normalizePath,
  prettifyUrl,
  trailingSeparatorRE,
  urlRE,
} from '../utils'
import { fileToUrl, toOutputFilePathInJSForBundledDev } from './asset'
import { getChunkOriginalFileName, type Manifest } from './manifest'

type WorkerChunkManifest = {
  fileName: string
  name: string
  originalFileName: string | undefined
  isEntry: boolean
  isDynamicEntry: boolean
  imports: string[]
  dynamicImports: string[]
  importedCss: string[]
  importedAssets: string[]
}

type WorkerBundle = {
  entryFilename: string
  entryCode: string
  chunkManifests: WorkerChunkManifest[]
  referencedAssets: Set<string>
  moduleIds: Set<string>
  watchedFiles: string[]
  /**
   * referenceId of the entry emitted for each build via
   * `import.meta.ROLLDOWN_FILE_URL_<id>`. Keyed by `Environment` because
   * referenceIds are per-build and this bundle is shared across the main build
   * and nested worker sub-builds.
   */
  entryReferenceIds: WeakMap<Environment, /* referenceId */ string>
}

type WorkerBundleAsset = {
  fileName: string
  /** @deprecated */
  originalFileName: string | null
  originalFileNames: string[]
  source: string | Uint8Array
}

/** The input ID of a worker entry, which identifies its bundle. */
type WorkerBundleId = string

/** `undefined` identifies the main bundle. */
type BundleId = WorkerBundleId | undefined

const workerManifests = new WeakMap<Environment, Manifest>()

export function getWorkerManifest(
  environment: Environment,
): Manifest | undefined {
  return workerManifests.get(environment)
}

class WorkerOutputCache {
  /**
   * worker bundle information for each input id
   * used to bundle the same worker file only once
   */
  private bundles = new Map</* inputId */ string, WorkerBundle>()
  /** list of assets emitted for the worker bundles */
  private assets = new Map<string, WorkerBundleAsset>()
  private invalidatedBundles = new Set</* inputId */ string>()
  /**
   * Worker references grouped by their containing bundle and module.
   * `referencingModuleId` is the module whose inclusion keeps the reference
   * live: the worker wrapper module for a `?worker` import, or the importing
   * module for a `new URL(..., import.meta.url)` worker reference.
   * `childBundleId` identifies the referenced worker bundle and is used as its
   * `BundleId` when traversing that bundle's references.
   */
  private bundleReferences = new Map<
    BundleId,
    Map<
      /* referencingModuleId */ string,
      Set</* childBundleId */ WorkerBundleId>
    >
  >()

  saveWorkerBundle(
    file: string,
    watchedFiles: string[],
    outputEntryFilename: string,
    outputEntryCode: string,
    chunkManifests: WorkerChunkManifest[],
    outputAssets: WorkerBundleAsset[],
    moduleIds: Set<string>,
    logger: Logger,
  ): WorkerBundle {
    for (const asset of outputAssets) {
      this.saveAsset(asset, logger)
    }
    const bundle: WorkerBundle = {
      entryFilename: outputEntryFilename,
      entryCode: outputEntryCode,
      chunkManifests: chunkManifests,
      referencedAssets: new Set(outputAssets.map((asset) => asset.fileName)),
      moduleIds,
      watchedFiles,
      entryReferenceIds: new WeakMap(),
    }
    this.bundles.set(file, bundle)
    return bundle
  }

  saveAsset(asset: WorkerBundleAsset, logger: Logger) {
    const duplicateAsset = this.assets.get(asset.fileName)
    if (duplicateAsset) {
      if (!isSameContent(duplicateAsset.source, asset.source)) {
        logger.warn(
          `\n` +
            colors.yellow(
              `The emitted file ${JSON.stringify(asset.fileName)} overwrites a previously emitted file of the same name.`,
            ),
        )
      }
    }
    this.assets.set(asset.fileName, asset)
  }

  invalidateAffectedBundles(file: string) {
    for (const [bundleInputFile, bundle] of this.bundles.entries()) {
      if (bundle.watchedFiles.includes(file)) {
        this.invalidatedBundles.add(bundleInputFile)
      }
    }
  }

  removeBundleIfInvalidated(file: string) {
    if (this.invalidatedBundles.has(file)) {
      this.invalidatedBundles.delete(file)
      this.removeBundle(file)
    }
  }

  private removeBundle(file: string) {
    const bundle = this.bundles.get(file)
    if (!bundle) return

    this.bundles.delete(file)

    this.assets.delete(bundle.entryFilename)

    const keptBundles = [...this.bundles.values()]
    // remove assets that are only referenced by this bundle
    for (const asset of bundle.referencedAssets) {
      if (keptBundles.every((b) => !b.referencedAssets.has(asset))) {
        this.assets.delete(asset)
      }
    }

    this.bundleReferences.delete(file)
  }

  recordReference(
    parentInputId: BundleId,
    childBundleId: WorkerBundleId,
    referencingModuleId: string,
  ) {
    let referencesByModule = this.bundleReferences.get(parentInputId)
    if (!referencesByModule) {
      referencesByModule = new Map()
      this.bundleReferences.set(parentInputId, referencesByModule)
    }
    let childBundleIds = referencesByModule.get(referencingModuleId)
    if (!childBundleIds) {
      childBundleIds = new Set()
      referencesByModule.set(referencingModuleId, childBundleIds)
    }
    childBundleIds.add(childBundleId)
  }

  getLiveAssetFileNames(
    rootBundleId: BundleId,
    rootLiveModuleIds: Set<string>,
  ): Set<string> {
    const liveBundles = new Set<string>()
    const queue: [BundleId, Set<string>][] = [[rootBundleId, rootLiveModuleIds]]
    while (queue.length > 0) {
      const [bundleId, moduleIds] = queue.shift()!
      const referencesByModule = this.bundleReferences.get(bundleId)
      if (!referencesByModule) continue
      for (const moduleId of moduleIds) {
        const childBundleIds = referencesByModule.get(moduleId)
        if (!childBundleIds) continue
        for (const childBundleId of childBundleIds) {
          if (liveBundles.has(childBundleId)) continue
          liveBundles.add(childBundleId)
          const childBundle = this.bundles.get(childBundleId)
          if (childBundle) {
            queue.push([childBundleId, childBundle.moduleIds])
          }
        }
      }
    }

    const liveFileNames = new Set<string>()
    for (const inputId of liveBundles) {
      const wb = this.bundles.get(inputId)
      if (!wb) continue
      liveFileNames.add(wb.entryFilename)
      for (const fileName of wb.referencedAssets) {
        liveFileNames.add(fileName)
      }
    }
    return liveFileNames
  }

  getDeadDirectlyReferencedBundles(
    bundleId: BundleId,
    liveModuleIds: Set<string>,
  ): WorkerBundle[] {
    const referencesByModule = this.bundleReferences.get(bundleId)
    if (!referencesByModule) return []
    const deadBundleIds = new Set<WorkerBundleId>()
    for (const references of referencesByModule.values()) {
      for (const childBundleId of references) {
        deadBundleIds.add(childBundleId)
      }
    }
    for (const moduleId of liveModuleIds) {
      for (const childBundleId of referencesByModule.get(moduleId) || []) {
        deadBundleIds.delete(childBundleId)
      }
    }
    const deadBundles: WorkerBundle[] = []
    for (const childBundleId of deadBundleIds) {
      const bundle = this.bundles.get(childBundleId)
      if (bundle) deadBundles.push(bundle)
    }
    return deadBundles
  }

  getWorkerBundle(file: string) {
    return this.bundles.get(file)
  }

  getAssets() {
    return this.assets.values()
  }

  getChunkManifest(liveFileNames?: Set<string>): Manifest {
    const manifest: Manifest = {}
    for (const bundle of this.bundles.values()) {
      // Inline workers are bundled but their entry is not emitted.
      if (!this.assets.has(bundle.entryFilename)) continue

      const keysByFileName = new Map(
        bundle.chunkManifests.map((chunk) => [
          chunk.fileName,
          `_worker_${chunk.fileName}`,
        ]),
      )

      for (const chunk of bundle.chunkManifests) {
        if (liveFileNames && !liveFileNames.has(chunk.fileName)) continue

        const imports = chunk.imports.flatMap((fileName) => {
          const key = keysByFileName.get(fileName)
          return key ? [key] : []
        })
        const dynamicImports = chunk.dynamicImports.flatMap((fileName) => {
          const key = keysByFileName.get(fileName)
          return key ? [key] : []
        })

        manifest[keysByFileName.get(chunk.fileName)!] = {
          src: chunk.originalFileName,
          file: chunk.fileName,
          css: chunk.importedCss.length > 0 ? chunk.importedCss : undefined,
          assets:
            chunk.importedAssets.length > 0 ? chunk.importedAssets : undefined,
          isWorkerEntry: chunk.isEntry,
          name: chunk.name,
          isDynamicEntry: chunk.isDynamicEntry,
          isWorker: true,
          imports: imports.length > 0 ? imports : undefined,
          dynamicImports:
            dynamicImports.length > 0 ? dynamicImports : undefined,
        }
      }
    }
    return manifest
  }

  /**
   * Emit the worker entry as an asset (once per build) and return the JS
   * expression referencing it: `import.meta.ROLLDOWN_FILE_URL_<referenceId>`. The
   * `vite:asset` `resolveFileUrl` hook turns that into the final URL (r
```

### Core Architecture Module: `packages/vite/src/node/plugins/workerImportMetaUrl.ts`
```
import path from 'node:path'
import MagicString from 'magic-string'
import type { RollupError } from 'rolldown'
import { parseAstAsync } from 'rolldown/parseAst'
import type { ESTree } from 'rolldown/utils'
import { stripLiteral } from 'strip-literal'
import { cleanUrl, slash, splitFileAndPostfix } from '../../shared/utils'
import type { ResolvedConfig } from '../config'
import { createBackCompatIdResolver } from '../idResolver'
import type { ResolveIdFn } from '../idResolver'
import type { Plugin } from '../plugin'
import { evalValue, transformStableResult } from '../utils'
import { toOutputFilePathInJSForBundledDev } from './asset'
import { hasViteIgnoreRE } from './importAnalysis'
import type { InternalResolveOptions } from './resolve'
import { tryFsResolve } from './resolve'
import type { WorkerType } from './worker'
import {
  emitWorkerAssetsForBundledDev,
  recordWorkerReference,
  generateWorkerEntryUrlExpr,
  workerFileToDevUrl,
  workerFileToUrl,
} from './worker'

interface WorkerOptions {
  type?: WorkerType
}

function err(e: string, pos: number) {
  const error = new Error(e) as RollupError
  error.pos = pos
  return error
}

function findClosingParen(input: string, fromIndex: number) {
  let count = 1

  for (let i = fromIndex; i < input.length; i++) {
    if (input[i] === '(') count++
    if (input[i] === ')') count--
    if (count === 0) return i
  }

  return -1
}

function extractWorkerTypeFromAst(
  expression: ESTree.Expression,
  optsStartIndex: number,
): 'classic' | 'module' | undefined {
  if (expression.type !== 'ObjectExpression') {
    return
  }

  let lastSpreadElementIndex = -1
  let typeProperty = null
  let typePropertyIndex = -1

  for (let i = 0; i < expression.properties.length; i++) {
    const property = expression.properties[i]

    if (property.type === 'SpreadElement') {
      lastSpreadElementIndex = i
      continue
    }

    if (
      property.type === 'Property' &&
      ((property.key.type === 'Identifier' && property.key.name === 'type') ||
        (property.key.type === 'Literal' && property.key.value === 'type'))
    ) {
      typeProperty = property
      typePropertyIndex = i
    }
  }

  if (typePropertyIndex === -1 && lastSpreadElementIndex === -1) {
    // No type property or spread element in use. Assume safe usage and default to classic
    return 'classic'
  }

  if (typePropertyIndex < lastSpreadElementIndex) {
    throw err(
      'Expected object spread to be used before the definition of the type property. ' +
        'Vite needs a static value for the type property to correctly infer it.',
      optsStartIndex,
    )
  }

  if (typeProperty?.value.type !== 'Literal') {
    throw err(
      'Expected worker options type property to be a literal value.',
      optsStartIndex,
    )
  }

  // Silently default to classic type like the getWorkerType method
  return typeProperty?.value.value === 'module' ? 'module' : 'classic'
}

async function parseWorkerOptions(
  rawOpts: string,
  optsStartIndex: number,
): Promise<WorkerOptions> {
  let opts: WorkerOptions = {}
  try {
    opts = evalValue<WorkerOptions>(rawOpts)
  } catch {
    const optsNode = (
      (await parseAstAsync(`(${rawOpts})`))
        .body[0] as ESTree.ExpressionStatement
    ).expression

    const type = extractWorkerTypeFromAst(optsNode, optsStartIndex)
    if (type) {
      return { type }
    }

    throw err(
      'Vite is unable to parse the worker options as the value is not static. ' +
        'To ignore this error, please use /* @vite-ignore */ in the worker options.',
      optsStartIndex,
    )
  }

  if (opts == null) {
    return {}
  }

  if (typeof opts !== 'object') {
    throw err(
      `Expected worker options to be an object, got ${typeof opts}`,
      optsStartIndex,
    )
  }

  return opts
}

async function getWorkerType(
  raw: string,
  clean: string,
  i: number,
): Promise<WorkerType> {
  const commaIndex = clean.indexOf(',', i)
  if (commaIndex === -1) {
    return 'classic'
  }
  const endIndex = findClosingParen(clean, i)

  // case: ') ... ,' mean no worker options params
  if (commaIndex > endIndex) {
    return 'classic'
  }

  // need to find in comment code
  let workerOptString = raw.substring(commaIndex + 1, endIndex)
  const hasViteIgnore = hasViteIgnoreRE.test(workerOptString)
  if (hasViteIgnore) {
    return 'ignore'
  }

  // need to find in no comment code
  const cleanWorkerOptString = clean.substring(commaIndex + 1, endIndex)
  const trimmedCleanWorkerOptString = cleanWorkerOptString.trim()
  if (!trimmedCleanWorkerOptString.length) {
    return 'classic'
  }

  // strip trailing comma for evalValue
  if (trimmedCleanWorkerOptString.endsWith(',')) {
    workerOptString = workerOptString.slice(
      0,
      cleanWorkerOptString.lastIndexOf(','),
    )
  }

  const workerOpts = await parseWorkerOptions(workerOptString, commaIndex + 1)
  if (
    workerOpts.type &&
    (workerOpts.type === 'module' || workerOpts.type === 'classic')
  ) {
    return workerOpts.type
  }

  return 'classic'
}

export const workerImportMetaUrlRE: RegExp =
  /\bnew\s+(?:Worker|SharedWorker)\s*\(\s*(new\s+URL\s*\(\s*('[^']+'|"[^"]+"|`[^`]+`)\s*,\s*import\.meta\.url\s*(?:,\s*)?\))/dg

export function workerImportMetaUrlPlugin(config: ResolvedConfig): Plugin {
  let workerResolver: ResolveIdFn

  const fsResolveOptions: InternalResolveOptions = {
    ...config.resolve,
    root: config.root,
    isProduction: config.isProduction,
    isBuild: config.command === 'build',
    packageCache: config.packageCache,
    asSrc: true,
  }

  return {
    name: 'vite:worker-import-meta-url',

    applyToEnvironment(environment) {
      return environment.config.consumer === 'client'
    },

    transform: {
      filter: { code: workerImportMetaUrlRE },
      async handler(code, id) {
        const isBundled = this.environment.config.isBundled
        let s: MagicString | undefined
        const cleanString = stripLiteral(code)
        const re = new RegExp(workerImportMetaUrlRE)

        let match: RegExpExecArray | null
        while ((match = re.exec(cleanString))) {
          const [[, endIndex], [expStart, expEnd], [urlStart, urlEnd]] =
            match.indices as Array<[number, number]>

          const rawUrl = code.slice(urlStart, urlEnd)

          // potential dynamic template string
          if (rawUrl[0] === '`' && rawUrl.includes('${')) {
            this.error(
              `\`new URL(url, import.meta.url)\` is not supported in dynamic template string.`,
              expStart,
            )
          }

          s ||= new MagicString(code)
          const workerType = await getWorkerType(code, cleanString, endIndex)
          const url = rawUrl.slice(1, -1)
          const { file: urlWithoutPostfix, postfix } = splitFileAndPostfix(url)
          const queryPostfix = postfix[0] === '?' ? postfix : ''
          let file: string | undefined
          if (urlWithoutPostfix[0] === '.') {
            file = path.resolve(path.dirname(id), urlWithoutPostfix)
            file = slash(tryFsResolve(file, fsResolveOptions) ?? file)
            if (this.environment.mode === 'dev') {
              this.environment.safeModulePaths.add(file)
            }
          } else {
            workerResolver ??= createBackCompatIdResolver(config, {
              extensions: [],
              tryIndex: false,
              preferRelative: true,
            })
            file = await workerResolver(this.environment, urlWithoutPostfix, id)
            if (file !== undefined) {
              if (this.environment.mode === 'dev') {
                this.environment.safeModulePaths.addId(file)
              }
            } else {
              file =
                urlWithoutPostfix[0] === '/'
                  ? slash(path.join(config.publicDir, urlWithoutPostfix))
                  : slash(path.resolve(path.dirname(id), urlWithoutPostfix))
              if (this.environment.mode === 'dev') {
                this.environment.safeModulePaths.add(file)
              }
            }
          }

          if (
            isBundled &&
            config.isWorker &&
            config.bundleChain.at(-1) === cleanUrl(file)
          ) {
            s.update(expStart, expEnd, 'self.location.href')
          } else {
            let builtUrlExpr: string
            if (isBundled) {
              recordWorkerReference(
                config,
                config.bundleChain.at(-1),
                cleanUrl(file),
                id,
              )
              const result = await workerFileToUrl(config, file)
              if (this.environment.config.command === 'serve') {
                emitWorkerAssetsForBundledDev(this, config)
                builtUrlExpr = JSON.stringify(
                  toOutputFilePathInJSForBundledDev(
                    this.environment,
                    result.entryFilename,
                  ),
                )
              } else {
                builtUrlExpr = generateWorkerEntryUrlExpr(this, config, result)
              }
              for (const file of result.watchedFiles) {
                this.addWatchFile(file)
              }
            } else {
              const url = await workerFileToDevUrl(
                this,
                cleanUrl(file),
                queryPostfix,
                workerType,
              )
              builtUrlExpr = JSON.stringify(url)
            }
            s.update(
              expStart,
              expEnd,
              // NOTE: add `'' +` to opt-out rolldown's transform: https://github.com/rolldown/rolldown/issues/2745
              `new URL(/* @vite-ignore */ ${builtUrlExpr}, '' + import.meta.url)`,
            )
          }
        }

        if (s) {
          return transformStableResult(s, id, this.environment.config)
        }

        return null
      },
    },
  }
}

```

### Core Architecture Module: `packages/vite/src/node/typeUtils.ts`
```
import type {
  ObjectHook,
  MinimalPluginContext as RolldownMinimalPluginContext,
  Plugin as RolldownPlugin,
} from 'rolldown'

export type NonNeverKeys<T> = {
  [K in keyof T]: T[K] extends never ? never : K
}[keyof T]

export type GetHookContextMap<Plugin> = {
  [K in keyof Plugin]-?: Plugin[K] extends ObjectHook<infer T, unknown>
    ? T extends (this: infer This, ...args: any[]) => any
      ? This extends RolldownMinimalPluginContext
        ? This
        : never
      : never
    : never
}

type RollupPluginHooksContext = GetHookContextMap<RolldownPlugin>
export type RollupPluginHooks = NonNeverKeys<RollupPluginHooksContext>

export type RequiredExceptFor<T, K extends keyof T> = Pick<T, K> &
  Required<Omit<T, K>>

```

### Core Architecture Module: `packages/vite/src/node/utils.ts`
```
import { exec } from 'node:child_process'
import crypto from 'node:crypto'
import { promises as dns } from 'node:dns'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { ServerOptions as HttpsServerOptions } from 'node:https'
import { builtinModules } from 'node:module'
import net from 'node:net'
import type { AddressInfo, Server } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import remapping from '@jridgewell/remapping'
import type { DecodedSourceMap, RawSourceMap } from '@jridgewell/remapping'
import { decode, encode } from '@jridgewell/sourcemap-codec'
import type { SourceMapSegment } from '@jridgewell/sourcemap-codec'
import type { Equal } from '@type-challenges/utils'
import MagicString from 'magic-string'
import type { Debugger } from 'obug'
import debug from 'obug'
import colors from 'picocolors'

import { createFilter as _createFilter } from '@rollup/pluginutils'
import type { InputOption, TransformResult } from 'rolldown'
import type { Alias, AliasOptions } from '#dep-types/alias'
import type { FSWatcher } from '#dep-types/chokidar'
import { createIsBuiltin } from '../shared/builtin'
import { VALID_ID_PREFIX } from '../shared/constants'
import {
  cleanUrl,
  isWindows,
  slash,
  splitFileAndPostfix,
  withTrailingSlash,
} from '../shared/utils'
import type { BuildEnvironmentOptions } from './build'
import type { ResolvedConfig } from './config'
import {
  CLIENT_ENTRY,
  CLIENT_PUBLIC_PATH,
  CSS_LANGS_RE,
  ENV_PUBLIC_PATH,
  FS_PREFIX,
  OPTIMIZABLE_ENTRY_RE,
  loopbackHosts,
  wildcardHosts,
} from './constants'
import type { DepOptimizationOptions } from './optimizer'
import { type PackageCache, findNearestPackageData } from './packages'
import type { PreviewServer } from './preview'
import type { ResolvedServerUrls, ServerOptions, ViteDevServer } from './server'
import type { CommonServerOptions } from '.'

/**
 * Inlined to keep `@rollup/pluginutils` in devDependencies
 */
export type FilterPattern =
  | ReadonlyArray<string | RegExp>
  | string
  | RegExp
  | null
export const createFilter = _createFilter as (
  include?: FilterPattern,
  exclude?: FilterPattern,
  options?: { resolve?: string | false | null },
) => (id: unknown) => boolean

export { withFilter } from 'rolldown/filter'

// eslint-disable-next-line no-control-regex
const invalidUrlPathCharRE = /[\u0000-\u001F"#$%&*+,:;<=>?[\]^`{|}\u007F]/g
const replaceNestedIdRE = /\s*>\s*/g
export const flattenId = (id: string): string => {
  const flatId = limitFlattenIdLength(
    id
      .replaceAll(/_+/g, '$&__')
      .replaceAll('/', '_')
      .replaceAll('.', '__')
      .replace(replaceNestedIdRE, '_n_')
      // replace any characters that will be replaced by sanitizeFileName
      .replace(
        invalidUrlPathCharRE,
        (c) => '_0' + c.charCodeAt(0).toString(16) + '_',
      ),
  )
  return flatId
}

const FLATTEN_ID_HASH_LENGTH = 8
const FLATTEN_ID_MAX_FILE_LENGTH = 170

const limitFlattenIdLength = (
  id: string,
  limit: number = FLATTEN_ID_MAX_FILE_LENGTH,
): string => {
  if (id.length <= limit) {
    return id
  }
  return id.slice(0, limit - (FLATTEN_ID_HASH_LENGTH + 1)) + '_' + getHash(id)
}

export const normalizeId = (id: string): string =>
  id.replace(replaceNestedIdRE, ' > ')

// Supported by Node, Deno, Bun
const NODE_BUILTIN_NAMESPACE = 'node:'
// Supported by Bun
const BUN_BUILTIN_NAMESPACE = 'bun:'
// Some runtimes like Bun injects namespaced modules here, which is not a node builtin
const nodeBuiltins = builtinModules.filter((id) => !id.includes(':'))

const isBuiltinCache = new WeakMap<
  (string | RegExp)[],
  (id: string, importer?: string) => boolean
>()

export function isBuiltin(builtins: (string | RegExp)[], id: string): boolean {
  let isBuiltin = isBuiltinCache.get(builtins)
  if (!isBuiltin) {
    isBuiltin = createIsBuiltin(builtins)
    isBuiltinCache.set(builtins, isBuiltin)
  }
  return isBuiltin(id)
}

export const nodeLikeBuiltins: (string | RegExp)[] = [
  ...nodeBuiltins,
  new RegExp(`^${NODE_BUILTIN_NAMESPACE}`),
  new RegExp(`^${BUN_BUILTIN_NAMESPACE}`),
]

export function isNodeLikeBuiltin(id: string): boolean {
  return isBuiltin(nodeLikeBuiltins, id)
}

export function isNodeBuiltin(id: string): boolean {
  if (id.startsWith(NODE_BUILTIN_NAMESPACE)) return true
  return nodeBuiltins.includes(id)
}

const inNodeModulesRE = /(?:^|[\\/])node_modules(?:[\\/]|$)/

export function isInNodeModules(id: string): boolean {
  return inNodeModulesRE.test(id)
}

export function moduleListContains(
  moduleList: string[] | undefined,
  id: string,
): boolean | undefined {
  return moduleList?.some(
    (m) => m === id || id.startsWith(withTrailingSlash(m)),
  )
}

export function isOptimizable(
  id: string,
  optimizeDeps: DepOptimizationOptions,
): boolean {
  const { extensions } = optimizeDeps
  return (
    OPTIMIZABLE_ENTRY_RE.test(id) ||
    (extensions?.some((ext) => id.endsWith(ext)) ?? false)
  )
}

export const bareImportRE: RegExp = /^(?![a-zA-Z]:)[\w@](?!.*:\/\/)/
export const deepImportRE: RegExp = /^([^@][^/]*)\/|^(@[^/]+\/[^/]+)\//

export const _dirname: string = path.dirname(
  fileURLToPath(/** #__KEEP__ */ import.meta.url),
)

// https://github.com/rolldown/rolldown/blob/62fba31428af244f871f0e119ed43936ee5d01fd/packages/rolldown/src/log/logger.ts#L64
export const rollupVersion = '4.23.0'
export { VERSION as rolldownVersion } from 'rolldown'

// set in bin/vite.js
const filter = process.env.VITE_DEBUG_FILTER

const DEBUG = process.env.DEBUG

interface DebuggerOptions {
  onlyWhenFocused?: boolean | string
  depth?: number
}

export type ViteDebugScope = `vite:${string}`

export function createDebugger(
  namespace: ViteDebugScope,
  options: DebuggerOptions = {},
): Debugger['log'] | undefined {
  const log = debug(namespace)
  const { onlyWhenFocused, depth } = options

  if (depth && log.inspectOpts && log.inspectOpts.depth == null) {
    log.inspectOpts.depth = options.depth
  }

  let enabled = log.enabled
  if (enabled && onlyWhenFocused) {
    const ns = typeof onlyWhenFocused === 'string' ? onlyWhenFocused : namespace
    enabled = !!DEBUG?.includes(ns)
  }

  if (enabled) {
    return (...args: [string, ...any[]]) => {
      if (!filter || args.some((a) => a?.includes?.(filter))) {
        log(...args)
      }
    }
  }
}

function testCaseInsensitiveFS() {
  if (!CLIENT_ENTRY.endsWith('client.mjs')) {
    throw new Error(
      `cannot test case insensitive FS, CLIENT_ENTRY const doesn't contain client.mjs`,
    )
  }
  if (!fs.existsSync(CLIENT_ENTRY)) {
    throw new Error(
      'cannot test case insensitive FS, CLIENT_ENTRY does not point to an existing file: ' +
        CLIENT_ENTRY,
    )
  }
  return fs.existsSync(CLIENT_ENTRY.replace('client.mjs', 'cLiEnT.mjs'))
}

export const isCaseInsensitiveFS: boolean = testCaseInsensitiveFS()

const VOLUME_RE = /^[A-Z]:/i

export function normalizePath(id: string): string {
  return path.posix.normalize(isWindows ? slash(id) : id)
}

export function fsPathFromId(id: string): string {
  const fsPath = normalizePath(
    id.startsWith(FS_PREFIX) ? id.slice(FS_PREFIX.length) : id,
  )
  return fsPath[0] === '/' || VOLUME_RE.test(fsPath) ? fsPath : `/${fsPath}`
}

export function fsPathFromUrl(url: string): string {
  return fsPathFromId(cleanUrl(url))
}

/**
 * Check if dir is a parent of file
 *
 * Warning: parameters are not validated, only works with normalized absolute paths
 *
 * @param dir - normalized absolute path
 * @param file - normalized absolute path
 * @returns true if dir is a parent of file
 */
export function isParentDirectory(dir: string, file: string): boolean {
  dir = withTrailingSlash(dir)
  return (
    file.startsWith(dir) ||
    (isCaseInsensitiveFS && file.toLowerCase().startsWith(dir.toLowerCase()))
  )
}

/**
 * Check if 2 file name are identical
 *
 * Warning: parameters are not validated, only works with normalized absolute paths
 *
 * @param file1 - normalized absolute path
 * @param file2 - normalized absolute path
 * @returns true if both files url are identical
 */
export function isSameFilePath(file1: string, file2: string): boolean {
  return (
    file1 === file2 ||
    (isCaseInsensitiveFS && file1.toLowerCase() === file2.toLowerCase())
  )
}

export const externalRE: RegExp = /^([a-z]+:)?\/\//
export const isExternalUrl = (url: string): boolean => externalRE.test(url)

export const dataUrlRE: RegExp = /^\s*data:/i
export const isDataUrl = (url: string): boolean => dataUrlRE.test(url)

export const virtualModuleRE: RegExp = /^virtual-module:.*/
export const virtualModulePrefix = 'virtual-module:'

// NOTE: We should start relying on the "Sec-Fetch-Dest" header instead of this
// hardcoded list. We can eventually remove this function when the minimum version
// of browsers we support in dev all support this header.
const knownJsSrcRE =
  /\.(?:[jt]sx?|m[jt]s|vue|marko|svelte|astro|imba|mdx)(?:$|\?)/
export const isJSRequest = (url: string): boolean => {
  url = cleanUrl(url)
  if (knownJsSrcRE.test(url)) {
    return true
  }
  if (!path.extname(url) && url.at(-1) !== '/') {
    return true
  }
  return false
}

export const isCSSRequest = (request: string): boolean =>
  CSS_LANGS_RE.test(request)

const importQueryRE = /(\?|&)import=?(?:&|$)/
const directRequestRE = /(\?|&)direct=?(?:&|$)/
const internalPrefixes = [
  FS_PREFIX,
  VALID_ID_PREFIX,
  CLIENT_PUBLIC_PATH,
  ENV_PUBLIC_PATH,
]
const InternalPrefixRE = new RegExp(`^(?:${internalPrefixes.join('|')})`)
export const trailingSeparatorRE: RegExp = /[?&]$/
export const isImportRequest = (url: string): boolean => importQueryRE.test(url)
export const isInternalRequest = (url: string): boolean =>
  InternalPrefixRE.test(url)

export function removeImportQuery(url: string): string {
  return url.replace(importQueryRE, '$1').replace(trailingSeparatorRE, '')
}
export function removeDirectQuery(url: str
```

### Core Architecture Module: `packages/vite/src/shared/utils.ts`
```
import { NULL_BYTE_PLACEHOLDER, VALID_ID_PREFIX } from './constants'

export const isWindows: boolean =
  typeof process !== 'undefined' && process.platform === 'win32'

/**
 * Prepend `/@id/` and replace null byte so the id is URL-safe.
 * BrowserURL rendering wraps ModuleURLs that are not valid browser import
 * specifiers before adding base.
 */
export function wrapId(id: string): string {
  return id.startsWith(VALID_ID_PREFIX)
    ? id
    : VALID_ID_PREFIX + id.replace('\0', NULL_BYTE_PLACEHOLDER)
}

/**
 * Undo {@link wrapId}'s `/@id/` and null byte replacements.
 */
export function unwrapId(id: string): string {
  return id.startsWith(VALID_ID_PREFIX)
    ? id.slice(VALID_ID_PREFIX.length).replace(NULL_BYTE_PLACEHOLDER, '\0')
    : id
}

/** Render a decoded ModuleURL as a BrowserURL, wrapping virtual IDs and adding base. */
export function moduleUrlToBrowserUrl(moduleUrl: string, base: string): string {
  const browserUrl =
    moduleUrl[0] !== '.' && moduleUrl[0] !== '/' ? wrapId(moduleUrl) : moduleUrl
  return base ? joinUrlSegments(base, browserUrl) : browserUrl
}

export function joinUrlSegments(a: string, b: string): string {
  if (!a || !b) {
    return a || b || ''
  }
  if (a.endsWith('/')) {
    a = a.substring(0, a.length - 1)
  }
  if (b[0] !== '/') {
    b = '/' + b
  }
  return a + b
}

const windowsSlashRE = /\\/g
export function slash(p: string): string {
  return p.replace(windowsSlashRE, '/')
}

const postfixRE = /[?#].*$/
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}

export function splitFileAndPostfix(path: string): {
  file: string
  postfix: string
} {
  const file = cleanUrl(path)
  return { file, postfix: path.slice(file.length) }
}

export function isPrimitive(value: unknown): boolean {
  return !value || (typeof value !== 'object' && typeof value !== 'function')
}

export function withTrailingSlash(path: string): string {
  if (path.at(-1) !== '/') {
    return `${path}/`
  }
  return path
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const AsyncFunction = async function () {}.constructor as typeof Function

// https://github.com/nodejs/node/issues/43047#issuecomment-1564068099
let asyncFunctionDeclarationPaddingLineCount: number | undefined

export function getAsyncFunctionDeclarationPaddingLineCount(): number {
  if (typeof asyncFunctionDeclarationPaddingLineCount === 'undefined') {
    const body = '/*code*/'
    const source = new AsyncFunction('a', 'b', body).toString()
    asyncFunctionDeclarationPaddingLineCount =
      source.slice(0, source.indexOf(body)).split('\n').length - 1
  }
  return asyncFunctionDeclarationPaddingLineCount
}

export interface PromiseWithResolvers<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}
export function promiseWithResolvers<T>(): PromiseWithResolvers<T> {
  let resolve: any
  let reject: any
  const promise = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return { promise, resolve, reject }
}

const whitespaceRE = /\s/g
const percentEncodedRE = /(?:%[0-9a-f]{2})+/gi
const whitespaceOnlyRE = /^\s+$/

/** Percent-encodes whitespace, which terminates a `//# sourceURL=` value in V8. */
export function encodeSourceURL(id: string): string {
  return id.replace(whitespaceRE, encodeURIComponent)
}

/** Reverses {@link encodeSourceURL}. */
export function decodeSourceURL(url: string): string {
  return url.replace(percentEncodedRE, (match) => {
    let decoded: string
    try {
      decoded = decodeURIComponent(match)
    } catch {
      return match
    }
    return whitespaceOnlyRE.test(decoded) ? decoded : match
  })
}

```

### Core Architecture Module: `playground/assets/asset/emitted-worker.js`
```
self.postMessage('worker loaded')

```

### Core Architecture Module: `playground/chunk-importmap/worker.js`
```
self.onmessage = (e) => {
  if (e.data === 'ping') {
    self.postMessage({ message: 'worker: pong' })
  }
}

```

### Core Architecture Module: `playground/dynamic-import/alias/worker.js`
```
self.onmessage = (event) => {
  self.postMessage({
    msg: 'load worker',
  })
}

```

### Core Architecture Module: `playground/hmr-full-bundle-mode/worker-accept-src.js`
```
const msg = 'worker-accept'

self.onmessage = (e) => {
  if (e.data === 'ping') {
    self.postMessage(msg)
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24247** (2026-11-28): **feat(css): treat root-relative @import as external URL (fix #13998)**
  *Symptoms*: ### What is this PR solving?  A root-relative `@import` specifier like `/cdn/my-resource.css` currently fails with `ENOENT`: both the postcss-import resolver and the lightningcss resolver treat it as a local file path. Browsers resolve such specifiers against the origin though, and `url()` references to external URLs already pass through untouched, so this PR extends the same treatment to `@import` — root-relative specifiers are left as-is in the output for the browser to fetch at runtime.  Fixes #13998.  **Why it's a missing capability, not polish**  - It is a capability gap: external `@import` errors out instead of working. The reporter serves `/cdn/my-resource.css` from a different service and is fine with the browser failing to load it — currently they cannot even build. - It follows existing precedent in this codebase: `skipUrlReplacer` passes external `url()` through, and the lightningcss resolver already returns `{ external: id }` for absolute URLs. This fills the same gap for root-relative paths, which `isExternalUrl` / `absoluteOrProtocolRelativeUrlRE` do not match. - It aligns with browser semantics instead of introducing a new concept.  **Alternatives considered**  - A better error message: the reporter needs the import to work, not a nicer error. - Appending a query (`?shared`) to skip postcss-import's resolution: a workaround that also does not help the lightningcss path. - Matching `build.rolldownOptions.external` regexes for `@import` (tsup-style `external`): l

- **Issue #24244** (2026-11-27): **fix: allow SPA fallback for root directory names in server.fs.strict 'extended'**
  *Symptoms*: ﻿### Description  Fixes #24240  When `server.fs.strict` is `'extended'` in a SPA dev server, `checkLoadingAccess()` checked `isFileReadable(path)` without filtering out directories (`statSync` returning a readable directory with `EACCES === false`). When a client navigated to an extensionless route whose name happened to match an existing top-level filesystem directory (such as `/Users` on Windows/macOS or `/var`/`/etc` on Linux), `serveRawFsMiddleware` passed that directory path to `checkLoadingAccess()`, which returned `'denied'` and responded with `403 Restricted` instead of falling through to `indexHtmlMiddleware`.  This change checks `!tryStatSync(path)?.isDirectory() && isFileReadable(path)` before treating a candidate outside `server.fs.allow` as a readable restricted file, returning `'fallback'` for directory paths while keeping readable outside files `'denied'` (`403 Restricted`).  ### Alternatives Considered  Filtering inside `serveRawFsMiddleware` was considered, but handling directories directly inside `checkLoadingAccess()` is localized to the access-decision helper and avoids misclassifying directories in any caller using `sirvOptions` (`extensions: []`, which never serves directories).  ### Verification  - `pnpm --filter vite run build` (`rolldown` bundle + `.d.ts` + `tsc --project tsconfig.check.json`): passed (`0` errors) - `pnpm exec oxfmt --check packages/vite/src/node/server/middlewares/static.ts packages/vite/src/node/server/__tests__/strictExtendedFsServ

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

### Incident Patch 1: `7d0c054f` (2026-11-27)
**Commit Message**: docs(guide/migration): update to latest state (#24225)

**File**: `docs/guide/migration.md` (modified, +0/-3)
```diff
@@ -212,8 +212,6 @@ The Oxc Minifier is now used for JavaScript minification instead of esbuild. You
 
 If you were using the `esbuild.minify*` options to control minification behavior, you can now use `build.rolldownOptions.output.minify` instead. If you were using the `esbuild.drop` option, you can now use [`build.rolldownOptions.output.minify.compress.drop*` options](https://oxc.rs/docs/guide/usage/minifier/dead-code-elimination).
 
-Property mangling and its related options ([`mangleProps`, `reserveProps`, `mangleQuoted`, `mangleCache`](https://esbuild.github.io/api/#mangle-props)) are not supported by Oxc. If you need these options, please see [oxc-project/oxc#15375](https://github.com/oxc-project/oxc/issues/15375).
-
 esbuild and Oxc Minifier make slightly different assumptions about source code. In case you suspect the minifier is causing breakage in your code, you can compare these assumptions here:
 
 - [esbuild minify assumptions](https://esbuild.github.io/api/#minify-considerations)
@@ -370,7 +368,6 @@ These breaking changes are expected to only affect a minority of use cases:
   - `shouldTransformCachedModule` hook ([rolldown#4389](https://github.com/rolldown/rolldown/issues/4389))
   - `resolveImportMeta` hook ([rolldown#1010](https://github.com/rolldown/rolldown/issues/1010))
   - `renderDynamicImport` hook ([rolldown#4532](https://github.com/rolldown/rolldown/issues/4532))
-  - `resolveFileUrl` hook
 - `parseAst` / `parseAstAsync` functions are now deprecated in favor of `parseSync` / `parse` functions which have more features.
 - comments are removed before the `renderChunk` hook instead of after the `renderChunk` hook
 - comments other than the ones listed [here](https://rolldown.rs/reference/OutputOptions.comments) are moved, while Rollup only removes comments if the adjacent code is removed
```

---

### Incident Patch 2: `1b34d86d` (2026-11-25)
**Commit Message**: fix(css): dedupe CSS of inlined common chunks when `cssCodeSplit: false` (#24168)

Co-authored-by: sapphi-red <[REDACTED_EMAIL]>

**File**: `packages/vite/src/node/__tests__/build.spec.ts` (modified, +40/-0)
```diff
@@ -632,6 +632,46 @@ describe('build', () => {
     assertOutputHashContentChange(result[0], result[1])
   })
 
+  test('cssCodeSplit: false emits the CSS of an inlined common chunk once', async () => {
+    const root = resolve(
+      dirname,
+      'fixtures/css-single-bundle-inline-common-chunks',
+    )
+    const result = (await build({
+      root,
+      logLevel: 'silent',
+      build: {
+        write: false,
+        cssCodeSplit: false,
+        cssMinify: false,
+        rolldownOptions: {
+          input: [resolve(root, 'a.js'), resolve(root, 'b.js')],
+          output: {
+            codeSplitting: {
+              experimentalInlineCommonChunks: { maxSize: 10_000 },
+            },
+          },
+        },
+      },
+    })) as RolldownOutput
+
+    const sharedCarriers = result.output.filter(
+      (o) =>
+        o.type === 'chunk' &&
+        o.moduleIds.some((id) => id.endsWith('shared.css')),
+    )
+    expect(sharedCarriers).toHaveLength(2)
+    const css = result.output.find(
+      (output): output is OutputAsset =>
+        output.type === 'asset' && output.fileName.endsWith('.css'),
+    )!
+    // shared.css comes once, before the a.css rule that overrides it
+    expect(css.source.toString().match(/color: \w+/g)).toStrictEqual([
+      'color: red',
+      'color: blue',
+    ])
+  })
+
   test('css entries with the same basename should not cross-link manifest assets', async () => {
     const root = resolve(dirname, 'fixtures/css-entry-same-basename')
     const result = (await build({
```

**File**: `packages/vite/src/node/__tests__/fixtures/css-single-bundle-inline-common-chunks/a.css` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+/* overrides shared.css */
+.shared {
+  color: blue;
+}
```

**File**: `packages/vite/src/node/__tests__/fixtures/css-single-bundle-inline-common-chunks/a.js` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+import './shared.css'
+import './a.css'
```

**File**: `packages/vite/src/node/__tests__/fixtures/css-single-bundle-inline-common-chunks/b.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import './shared.css'
```

**File**: `packages/vite/src/node/__tests__/fixtures/css-single-bundle-inline-common-chunks/shared.css` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+.shared {
+  color: red;
+}
```

**File**: `packages/vite/src/node/plugins/css.ts` (modified, +41/-20)
```diff
@@ -521,6 +521,11 @@ export function cssPlugin(config: ResolvedConfig): Plugin {
   }
 }
 
+interface ChunkStyle {
+  content: string
+  moduleId: string
+}
+
 /**
  * Plugin applied after user plugins
  */
@@ -536,7 +541,8 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
   // when there are multiple rollup outputs and extracting CSS, only emit once,
   // since output formats have no effect on the generated CSS.
   let hasEmitted = false
-  let chunkCSSMap: Map<string, string>
+  // the CSS of each style module in a chunk, keyed by the chunk's file name
+  let chunkCSSMap: Map<string, ChunkStyle[]>
 
   const rolldownOptionsOutput = config.build.rolldownOptions.output
   const assetFileNames = (
@@ -719,13 +725,14 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
     ...(config.command === 'build'
       ? {
           async renderChunk(code, chunk, opts, meta) {
-            let chunkCSS: string | undefined
+            const chunkStyles: ChunkStyle[] = []
             // the chunk is empty if it's a dynamic entry chunk that only contains a CSS import
             const isJsChunkEmpty = code === '' && !chunk.isEntry
             let isPureCssChunk = chunk.exports.length === 0
             const ids = Object.keys(chunk.modules)
             for (const id of ids) {
-              if (styles.has(id)) {
+              const content = styles.get(id)
+              if (content !== undefined) {
                 // ?transform-only is used for ?url and shouldn't be included in normal CSS chunks
                 if (transformOnlyRE.test(id)) {
                   continue
@@ -747,7 +754,7 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
                   isPureCssChunk = false
                 }
 
-                chunkCSS = (chunkCSS || '') + styles.get(id)
+                chunkStyles.push({ content, moduleId: id })
               } else if (!isJsChunkEmpty) {
                 // if the module does not have a style, then it's not a pure css chunk.
                 // this is true because in the `transform` hook above, only modules
@@ -762,11 +769,9 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
             const resolveAssetUrlsInCss = (
               chunkCSS: string,
               cssAssetName: string,
-              originalFileName?: string,
+              assetDirname: string,
             ) => {
-              const cssAssetDirname = slash(
-                getCssAssetDirname(cssAssetName, originalFileName),
-              )
+              const cssAssetDirname = slash(assetDirname)
 
               const toRelative = (filename: string) => {
                 // relative base + extracted CSS
@@ -841,18 +846,17 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
                   path.basename(originalFileName),
                   '.css',
                 )
-                if (!styles.has(id)) {
+                let cssContent = styles.get(id)
+                if (cssContent === undefined) {
                   throw new Error(
                     `css content for ${JSON.stringify(id)} was not found`,
                   )
                 }
 
-                let cssContent = styles.get(id)!
-
                 cssContent = resolveAssetUrlsInCss(
                   cssContent,
                   cssAssetName,
-                  originalFileName,
+                  getCssAssetDirname(cssAssetName, originalFileName),
                 )
 
                 urlEmitTasks.push({
@@ -914,7 +918,7 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
               }
             }
 
-            if (chunkCSS !== undefined) {
+            if (chunkStyles.length > 0) {
               if (
                 isPureCssChunk &&
                 (opts.format === 'es' || opts.format === 'cjs')
@@ -932,6 +936,9 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
               }
 
               if (this.environment.config.build.cssCodeSplit) {
+                let chunkCSS = chunkStyles
+                  .map(({ content }) => content)
+                  .join('')
                 if (
                   (opts.format === 'es' || opts.format === 'cjs') &&
                   !chunk.fileName.includes('-legacy')
@@ -958,12 +965,12 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
                   chunkCSS = resolveAssetUrlsInCss(
                     chunkCSS,
                     cssAssetName,
-                    originalFileName,
+                    getCssAssetDirname(cssAssetName, originalFileName),
                   )
 
                   // wait for previous tasks as well
                   chunkCSS = await codeSplitEmitQueue.run(async () => {
-                    return finalizeCss(chunkCSS!, config)
+                    return finalizeCss(chunkCSS, config)
                   })
 
                   if (chunkCSS || isEntry) {
@@ -1013,14 +1020,21 @@ export function cssPostPlugin(con
```

---

### Incident Patch 3: `a78fb8a2` (2026-11-25)
**Commit Message**: fix(dev): register references to safe modules only for `server.fs.strict: 'extended'` (#24206)

Co-authored-by: lufeirider <[REDACTED_EMAIL]>

**File**: `packages/vite/src/node/__tests__/dev.spec.ts` (modified, +1/-1)
```diff
@@ -414,7 +414,7 @@ describe('the dev server', () => {
       environments: { ssr: { input: 'virtual:ssr-entry' } },
       optimizeDeps: { noDiscovery: true },
       server: {
-        fs: { allow: [root] },
+        fs: { allow: [root], strict: 'extended' },
         host: '127.0.0.1',
         port: 0,
         ws: false,
```

**File**: `packages/vite/src/node/plugins/asset.ts` (modified, +16/-2)
```diff
@@ -34,11 +34,13 @@ import {
   encodeURIPath,
   getHash,
   injectQuery,
+  isCSSRequest,
   normalizePath,
   rawRE,
   removeUrlQuery,
   urlRE,
 } from '../utils'
+import { isDirectRequest } from './css'
 import { getImportMapFilename } from './html'
 
 // referenceId is a 22-character base64url string but replaces - with $
@@ -481,9 +483,21 @@ export async function fileToDevUrl(
     return pathToFileURL(cleanedId).href
   }
 
-  if (!publicFile && environment.mode === 'dev') {
+  if (
+    !publicFile &&
+    environment.mode === 'dev' &&
+    // `fileToUrl` may be called for modules that are not checked by the `server.fs` check for `server.fs.strict: true`
+    // for example, `/@fs/<absolute-path>?worker&import`
+    config.server.fs.strict === 'extended'
+  ) {
     // Asset URLs are fetched by the browser even when emitted by SSR.
-    config.environments.client.safeModulePaths.addId(id)
+    const { safeModulePaths } = config.environments.client
+    const requestId = id.split('#', 1)[0]
+    safeModulePaths.addId(requestId)
+    if (isCSSRequest(requestId) && !isDirectRequest(requestId)) {
+      // The transform middleware adds this query to stylesheet requests.
+      safeModulePaths.addId(injectQuery(requestId, 'direct'))
+    }
   }
 
   const moduleUrl = publicFile ? id : fileToModuleUrl(id, config.root)
```

**File**: `packages/vite/src/node/plugins/worker.ts` (modified, +21/-5)
```diff
@@ -370,6 +370,26 @@ export function splitWorkerRequest(id: string): {
 }
 
 export const WORKER_FILE_ID = 'worker_file'
+
+export async function workerFileToDevUrl(
+  context: PluginContext,
+  file: string,
+  postfix: string,
+  workerType: WorkerType,
+): Promise<string> {
+  const assetUrl = await fileToUrl(context, file, 'string')
+  const query = `${WORKER_FILE_ID}&type=${workerType}`
+  if (
+    context.environment.mode === 'dev' &&
+    context.environment.config.server.fs.strict === 'extended'
+  ) {
+    const clientEnvironment =
+      context.environment.getTopLevelConfig().environments.client
+    clientEnvironment.safeModulePaths.addId(injectQuery(file + postfix, query))
+  }
+  return injectQuery(assetUrl + postfix, query)
+}
+
 const workerOutputCaches = new WeakMap<ResolvedConfig, WorkerOutputCache>()
 
 export function recordWorkerReference(
@@ -806,11 +826,7 @@ export function webWorkerPlugin(config: ResolvedConfig): Plugin {
           }
         } else {
           const { file, postfix } = splitWorkerRequest(id)
-          let url = await fileToUrl(this, file, 'string')
-          url = injectQuery(
-            `${url}${postfix}`,
-            `${WORKER_FILE_ID}&type=${workerType}`,
-          )
+          const url = await workerFileToDevUrl(this, file, postfix, workerType)
           urlCode = JSON.stringify(url)
         }
 
```

**File**: `packages/vite/src/node/plugins/workerImportMetaUrl.ts` (modified, +9/-8)
```diff
@@ -9,17 +9,17 @@ import type { ResolvedConfig } from '../config'
 import { createBackCompatIdResolver } from '../idResolver'
 import type { ResolveIdFn } from '../idResolver'
 import type { Plugin } from '../plugin'
-import { evalValue, injectQuery, transformStableResult } from '../utils'
-import { fileToUrl, toOutputFilePathInJSForBundledDev } from './asset'
+import { evalValue, transformStableResult } from '../utils'
+import { toOutputFilePathInJSForBundledDev } from './asset'
 import { hasViteIgnoreRE } from './importAnalysis'
 import type { InternalResolveOptions } from './resolve'
 import { tryFsResolve } from './resolve'
 import type { WorkerType } from './worker'
 import {
-  WORKER_FILE_ID,
   emitWorkerAssetsForBundledDev,
   recordWorkerReference,
   generateWorkerEntryUrlExpr,
+  workerFileToDevUrl,
   workerFileToUrl,
 } from './worker'
 
@@ -297,12 +297,13 @@ export function workerImportMetaUrlPlugin(config: ResolvedConfig): Plugin {
                 this.addWatchFile(file)
               }
             } else {
-              builtUrlExpr = await fileToUrl(this, cleanUrl(file), 'string')
-              builtUrlExpr = injectQuery(
-                `${builtUrlExpr}${queryPostfix}`,
-                `${WORKER_FILE_ID}&type=${workerType}`,
+              const url = await workerFileToDevUrl(
+                this,
+                cleanUrl(file),
+                queryPostfix,
+                workerType,
               )
-              builtUrlExpr = JSON.stringify(builtUrlExpr)
+              builtUrlExpr = JSON.stringify(url)
             }
             s.update(
               expStart,
```

**File**: `packages/vite/src/node/server/middlewares/indexHtml.ts` (modified, +5/-0)
```diff
@@ -260,6 +260,11 @@ const devHtmlHook: IndexHtmlTransformHook = async (
     const moduleUrl = `${proxyModuleUrl}?html-proxy&index=${inlineModuleIndex}.${ext}`
     inlineModuleUrls.push(moduleUrl)
     const browserUrl = moduleUrlToBrowserUrl(moduleUrl, decodedBase)
+    if (config.server.fs.strict === 'extended') {
+      safeModulePathRegistrations.push(
+        addHtmlRequestToSafeModulePaths(moduleUrl, server!, 'script'),
+      )
+    }
 
     s.update(
       node.sourceCodeLocation!.startOffset,
```

**File**: `playground/assets-sanitize/__tests__/assets-sanitize.spec.ts` (modified, +3/-1)
```diff
@@ -44,5 +44,7 @@ test.runIf(!isBuild)('denied .env', async () => {
   expect(await page.textContent('.unsafe-dotenv')).toBe(
     isBundledDev ? '200' : '403',
   )
-  expect(await page.textContent('.unsafe-dotenv-double-slash')).toBe('200') // SPA fallback
+  expect(await page.textContent('.unsafe-dotenv-double-slash')).toBe(
+    isBundledDev ? '200' : '403',
+  )
 })
```

**File**: `playground/fs-serve/__tests__/commonTests.ts` (modified, +23/-1)
```diff
@@ -26,7 +26,7 @@ import {
 import { getWindows83ShortNameForDotEnv as getWindows83ShortNameForDotEnv } from '../root/windows83Filename'
 import testJSON from '../safe.json'
 
-export function tests() {
+export function tests(fsStrict: true | 'extended' = true) {
   // `viteTestUrl` is set lazily, so this must be a function.
   // `viteTestUrl` keeps its trailing slash when the playground sets a base, so
   // plain concatenation would produce `//`-prefixed paths, which the server
@@ -237,6 +237,28 @@ export function tests() {
         status: '403',
         disableVariants: [''],
       },
+      // Legacy strict mode serves the worker wrappers. Extended strict mode
+      // denies the requests before serving a wrapper.
+      {
+        name: 'unsafe fetch with worker import query',
+        testId: 'unsafe-worker-import',
+        content: fsStrict === 'extended' ? /403 Restricted/ : /WorkerWrapper/,
+        status: fsStrict === 'extended' ? '403' : '200',
+      },
+      {
+        name: 'unsafe fetch with sharedworker import query',
+        testId: 'unsafe-sharedworker-import',
+        content: fsStrict === 'extended' ? /403 Restricted/ : /WorkerWrapper/,
+        status: fsStrict === 'extended' ? '403' : '200',
+      },
+      // The page fetches the same file after both worker wrapper requests to
+      // check that the file is still restricted.
+      {
+        name: 'unsafe fetch after a worker import query',
+        testId: 'unsafe-after-worker-import',
+        content: /403 Restricted/,
+        status: '403',
+      },
       // It is 404 in `fs-serve/base` test, 403 in `fs-serve` test
       {
         name: 'unsafe fetch with relative path after query',
```

**File**: `playground/fs-serve/__tests__/extended/fs-serve-extended.spec.ts` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ import { describe, expect, test } from 'vitest'
 import { bundledDevUnsupported, isServe, page, viteTestUrl } from '~utils'
 import { tests } from '../commonTests'
 
-tests()
+tests('extended')
 
 describe.runIf(isServe)(
   'extended filesystem checks',
```

#### Recent Merged Pull Requests:
- **PR #24247** (closed): feat(css): treat root-relative @import as external URL (fix #13998) (@Surri757)
- **PR #24244** (closed): fix: allow SPA fallback for root directory names in server.fs.strict 'extended' (@tranhoangtu-it)
- **PR #24243** (closed): docs: fix typos in build and features guides (@Brilliancoder)
- **PR #24237** (closed): fix(html): treat og:audio:url and og:video:url as asset sources (@shreyanshj10)
- **PR #24235** (closed): Pull (@hassankhalifemd-sudo)
- **PR #24227** (closed): fix(build): run closeBundle when a watch build fails (@harpreetkbadhan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
