# Verification Protocol: Verification Protocol: Empirical Defect Shield for vitejs/vite

<!-- PROVENANCE_START
{
  "source_repository": "vitejs/vite",
  "source_url": "https://github.com/vitejs/vite",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vitejs/vite](https://github.com/vitejs/vite) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `vitejs/vite` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vitejs-vite-learnings.md`  
> **Source**: github ([https://github.com/vitejs/vite](https://github.com/vitejs/vite))  
> **Source Version**: `3e1a86e6`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T12:32:39.043Z  
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
> **Harvest Timestamp**: 2026-11-12T12:32:38.713Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vitejs/vite`
- **Description**: Next generation frontend tooling. It's fast!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 83885 stars

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
import { evalValue, injectQuery, transformStableResult } from '../utils'
import { fileToUrl, toOutputFilePathInJSForBundledDev } from './asset'
import { hasViteIgnoreRE } from './importAnalysis'
import type { InternalResolveOptions } from './resolve'
import { tryFsResolve } from './resolve'
import type { WorkerType } from './worker'
import {
  WORKER_FILE_ID,
  emitWorkerAssetsForBundledDev,
  recordWorkerReference,
  generateWorkerEntryUrlExpr,
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
              builtUrlExpr = await fileToUrl(this, cleanUrl(file), 'string')
              builtUrlExpr = injectQuery(
                `${builtUrlExpr}${queryPostfix}`,
                `${WORKER_FILE_ID}&type=${workerType}`,
              )
              builtUrlExpr = JSON.stringify(builtUrlExpr)
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
import type { Equal } from '@type-challenges/utils'
import type MagicString from 'magic-string'
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
export function removeDirectQuery(url: string): string {
  return url.replace(directRequestRE, '$1').replace(trailingSeparatorRE, '')
}

export const urlRE: RegExp = 
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
- **Issue #24080** (2026-11-12): **fix: escape imported name in `transformCjsImport`**
  *Symptoms*: <!-- - What is this PR solving? Write a clear and concise description. - Reference the issues it solves (e.g. `fixes #123`). - What other alternatives have you explored? - Are there any parts you think require more attention from reviewers?  Also, please make sure you do the following:  - Read the Contributing Guidelines at https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md. - Check that there isn't already a PR that solves the problem the same way. If you find a duplicate, please help us review it. If you've solved it in a different way, clarify what is different and link the other PRs in the PR description. - Update the corresponding documentation if needed. - Include relevant tests that fail without this PR but pass with it. If the tests are not included, explain why.  If you have used AI:  - Read the AI Policy at https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md#ai-policy. - Keep the PR description and discussion concise. Use your own words, do not let AI write for you. - Disclose and describe how you have reviewed its code, e.g. the thought process and decisions that lead to the final code.  Thank you for contributing to Vite! --> To supplement the omissions in #24074.

- **Issue #24079** (2026-11-12): **refactor: use `tinyexec` instead of `execa`**
  *Symptoms*: <!-- - What is this PR solving? Write a clear and concise description. - Reference the issues it solves (e.g. `fixes #123`). - What other alternatives have you explored? - Are there any parts you think require more attention from reviewers?  Also, please make sure you do the following:  - Read the Contributing Guidelines at https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md. - Check that there isn't already a PR that solves the problem the same way. If you find a duplicate, please help us review it. If you've solved it in a different way, clarify what is different and link the other PRs in the PR description. - Update the corresponding documentation if needed. - Include relevant tests that fail without this PR but pass with it. If the tests are not included, explain why.  If you have used AI:  - Read the AI Policy at https://github.com/vitejs/vite/blob/main/CONTRIBUTING.md#ai-policy. - Keep the PR description and discussion concise. Use your own words, do not let AI write for you. - Disclose and describe how you have reviewed its code, e.g. the thought process and decisions that lead to the final code.  Thank you for contributing to Vite! --> https://e18e.dev/docs/replacements/execa

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

### Incident Patch 1: `2dcd391e` (2026-11-11)
**Commit Message**: fix(client): fallback to waiting on main thread for server start when trusted types are enforced (#21483)

Co-authored-by: sapphi-red <[REDACTED_EMAIL]>

**File**: `packages/vite/src/client/client.ts` (modified, +17/-2)
```diff
@@ -352,7 +352,7 @@ function hasErrorOverlay() {
 }
 
 function waitForSuccessfulPing(socketUrl: string) {
-  if (typeof SharedWorker === 'undefined') {
+  const useMainThreadFallback = () => {
     const visibilityManager: VisibilityManager = {
       currentState: document.visibilityState,
       listeners: new Set(),
@@ -367,6 +367,10 @@ function waitForSuccessfulPing(socketUrl: string) {
     return waitForSuccessfulPingInternal(socketUrl, visibilityManager)
   }
 
+  if (typeof SharedWorker === 'undefined') {
+    return useMainThreadFallback()
+  }
+
   // needs to be inlined to
   //   - load the worker after the server is closed
   //   - make it work with backend integrations
@@ -380,7 +384,18 @@ function waitForSuccessfulPing(socketUrl: string) {
     { type: 'application/javascript' },
   )
   const objURL = URL.createObjectURL(blob)
-  const sharedWorker = new SharedWorker(objURL)
+
+  let sharedWorker: SharedWorker
+  try {
+    sharedWorker = new SharedWorker(objURL)
+  } catch (error) {
+    URL.revokeObjectURL(objURL)
+    // Trusted Types enforcement rejects string worker URLs.
+    if (error instanceof TypeError) {
+      return useMainThreadFallback()
+    }
+    throw error
+  }
   return new Promise<void>((resolve, reject) => {
     const onVisibilityChange = () => {
       sharedWorker.port.postMessage({ visibility: document.visibilityState })
```

**File**: `playground/csp/__tests__/csp.spec.ts` (modified, +23/-1)
```diff
@@ -1,5 +1,13 @@
 import { expect, test } from 'vitest'
-import { bundledDevTodo, getColor, page } from '~utils'
+import {
+  browserErrors,
+  bundledDevTodo,
+  getColor,
+  isServe,
+  page,
+  untilBrowserLogAfter,
+  viteServer,
+} from '~utils'
 
 const transformIndexHtmlTodo = bundledDevTodo(
   '`server.transformIndexHtml` currently returns HTML that points at the source files, not at the files bundled dev produces; how it should work in bundled dev is not decided yet, e.g. return the HTML that the build HTML plugin emits as `index.html` in `bundledDev.memoryFiles`',
@@ -48,3 +56,17 @@ test('meta[property=csp-nonce] is injected', async () => {
   const meta = await page.$('meta[property=csp-nonce]')
   expect(await (await meta.getProperty('nonce')).jsonValue()).not.toBe('')
 })
+
+test.runIf(isServe)('reconnects after a server restart', async () => {
+  browserErrors.length = 0
+
+  await untilBrowserLogAfter(
+    () => viteServer.restart(),
+    [
+      '[vite] server connection lost. Polling for restart...',
+      '[vite] connected.',
+    ],
+  )
+
+  expect(browserErrors).toStrictEqual([])
+})
```

**File**: `playground/csp/vite.config.js` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ const createNonce = () => crypto.randomBytes(16).toString('base64')
 const setNonceHeader = (res, nonce) => {
   res.setHeader(
     'Content-Security-Policy',
-    `default-src 'nonce-${nonce}'; connect-src 'self'`,
+    `default-src 'nonce-${nonce}'; connect-src 'self'; require-trusted-types-for 'script'; trusted-types 'none'; worker-src 'none'`,
   )
 }
 
```

---

### Incident Patch 2: `2155e125` (2026-11-11)
**Commit Message**: feat(build): support retrying failed CSS preloads (#23710)

**File**: `packages/vite/src/node/__tests__/plugins/importAnalysisBuild.spec.ts` (modified, +14/-3)
```diff
@@ -252,18 +252,29 @@ describe('preloadOnce', () => {
     expect(preloadCount).toBe(1)
   })
 
-  test('shares a preload rejection with every waiter', async () => {
+  test('shares a preload rejection with every waiter and retries later', async () => {
     const seen = {}
     const { promise, reject } = promiseWithResolvers<void>()
     const error = new Error('failed to preload')
+    let preloadCount = 0
+    const preload = () => {
+      preloadCount++
+      return preloadCount === 1 ? promise : Promise.resolve()
+    }
 
-    const first = preloadOnce(seen, 'style.css', () => promise)
-    const second = preloadOnce(seen, 'style.css', () => promise)
+    const first = preloadOnce(seen, 'style.css', preload)
+    const second = preloadOnce(seen, 'style.css', preload)
     reject(error)
 
     expect(await Promise.allSettled([first, second])).toStrictEqual([
       { status: 'rejected', reason: error },
       { status: 'rejected', reason: error },
     ])
+    expect(preloadCount).toBe(1)
+
+    await expect(
+      preloadOnce(seen, 'style.css', preload),
+    ).resolves.toBeUndefined()
+    expect(preloadCount).toBe(2)
   })
 })
```

**File**: `packages/vite/src/node/plugins/importAnalysisBuild.ts` (modified, +14/-4)
```diff
@@ -230,7 +230,7 @@ export function preloadOnce(
       seen[href] = undefined
     },
     (err) => {
-      seen[href] = undefined
+      delete seen[href]
       throw err
     },
   )
@@ -240,6 +240,7 @@ export function preloadOnce(
 
 declare const scriptRel: string
 declare const seen: PreloadSeen
+declare const failedCssLinks: Record<string, HTMLLinkElement | undefined>
 function preload(
   baseModule: () => Promise<unknown>,
   deps?: string[],
@@ -310,7 +311,8 @@ function preload(
             const preloadedHrefSet = isCss
               ? preloadedHrefs.styles
               : preloadedHrefs.all
-            if (preloadedHrefSet.has(dep.href)) {
+            const failedCssLink = isCss ? failedCssLinks[dep.href] : undefined
+            if (!failedCssLink && preloadedHrefSet.has(dep.href)) {
               return
             }
 
@@ -324,13 +326,21 @@ function preload(
             if (cspNonce) {
               link.setAttribute('nonce', cspNonce)
             }
-            document.head.appendChild(link)
+            if (failedCssLink) {
+              delete failedCssLinks[dep.href]
+            }
+            if (failedCssLink?.isConnected) {
+              failedCssLink.replaceWith(link)
+            } else {
+              document.head.appendChild(link)
+            }
             if (isCss) {
               return new Promise((res, rej) => {
                 const handleSettle = (e: Event) => {
                   link.removeEventListener('load', handleSettle)
                   link.removeEventListener('error', handleSettle)
                   if (e.type === 'error') {
+                    failedCssLinks[dep.href] = link
                     rej(new Error(`Unable to preload CSS for ${dep}`))
                   } else {
                     res(e)
@@ -397,7 +407,7 @@ function getPreloadCode(
         `function(dep) { return ${JSON.stringify(environment.config.base)}+dep }`
   // replace `import` as a workaround for stackblitz: https://stackblitz.com/edit/node-vqfvv8dy?file=index.js
   const preloadMethodCode = preload.toString().replaceAll('𝐢𝐦𝐩𝐨𝐫𝐭', 'import')
-  const preloadCode = `const scriptRel = ${scriptRel};const assetsURL = ${assetsURL};const seen = {};const isCssPreloadUrl = ${isCssPreloadUrl.toString()};const preloadOnce = ${preloadOnce.toString()};export const ${preloadMethod} = ${preloadMethodCode}`
+  const preloadCode = `const scriptRel = ${scriptRel};const assetsURL = ${assetsURL};const seen = {};const failedCssLinks = {};const isCssPreloadUrl = ${isCssPreloadUrl.toString()};const preloadOnce = ${preloadOnce.toString()};export const ${preloadMethod} = ${preloadMethodCode}`
   return preloadCode
 }
 
```

**File**: `playground/js-sourcemap/__tests__/js-sourcemap.spec.ts` (modified, +2/-2)
```diff
@@ -365,7 +365,7 @@ describe.runIf(isBuild)('build tests', () => {
         SourceMap {
           content: {
             "debugId": "00000000-0000-0000-0000-000000000000",
-            "mappings": ";gkDAAAA,MAAA,OAAO,qDAEP,QAAQ,IAAI,uBAAuB,E",
+            "mappings": ";sqDAAAA,MAAA,OAAO,qDAEP,QAAQ,IAAI,uBAAuB,E",
             "names": [
               "__vitePreload",
             ],
@@ -380,7 +380,7 @@ describe.runIf(isBuild)('build tests', () => {
             ],
             "version": 3,
           },
-          visualization: "https://evanw.github.io/source-map-visualization/#MTk3MQBjb25zdCBfX3ZpdGVfX21hcERlcHM9KGksbT1fX3ZpdGVfX21hcERlcHMsZD0obS5mfHwobS5mPVsiYXNzZXRzL2R5bmFtaWMtZm9vLUJ3aFpUa3RCLmpzIiwiYXNzZXRzL2R5bmFtaWMtZm9vLURzcUtSckV5LmNzcyJdKSkpPT5pLm1hcChpPT5kW2ldKTsKdmFyIGU9ZnVuY3Rpb24oZSl7cmV0dXJuYC9gK2V9LHQ9e30sbj1mdW5jdGlvbihlKXtyZXR1cm4gZS5wYXRobmFtZS5lbmRzV2l0aChgLmNzc2ApfSxyPWZ1bmN0aW9uKGUsdCxuKXtpZih0IGluIGUpcmV0dXJuIGVbdF07bGV0IHI9bigpO2lmKCFyKXtlW3RdPXZvaWQgMDtyZXR1cm59bGV0IGk9ci50aGVuKCgpPT57ZVt0XT12b2lkIDB9LG49Pnt0aHJvdyBlW3RdPXZvaWQgMCxufSk7cmV0dXJuIGVbdF09aSxpfSxpPWZ1bmN0aW9uKGksYSxvKXtsZXQgcz1Qcm9taXNlLnJlc29sdmUoKTtpZihhJiZhLmxlbmd0aD4wKXtsZXQgaSxjPWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYG1ldGFbcHJvcGVydHk9Y3NwLW5vbmNlXWApLGw9Yz8ubm9uY2V8fGM/LmdldEF0dHJpYnV0ZShgbm9uY2VgKTtmdW5jdGlvbiB1KGUpe3JldHVybiBQcm9taXNlLmFsbChlLm1hcChlPT5Qcm9taXNlLnJlc29sdmUoZSkudGhlbihlPT4oe3N0YXR1czpgZnVsZmlsbGVkYCx2YWx1ZTplfSksZT0+KHtzdGF0dXM6YHJlamVjdGVkYCxyZWFzb246ZX0pKSkpfWZ1bmN0aW9uIGQoZSl7cmV0dXJuIGltcG9ydC5tZXRhLnJlc29sdmU/bmV3IFVSTChpbXBvcnQubWV0YS5yZXNvbHZlKGUpKTpuZXcgVVJMKGUsaW1wb3J0Lm1ldGEudXJsKX1zPXUoYS5tYXAoYT0+e2E9ZShhLG8pO2xldCBzPWQoYSksYz1uKHMpO3JldHVybiByKHQscy5ocmVmLCgpPT57aWYoaT09PXZvaWQgMCl7aT17YWxsOm5ldyBTZXQsc3R5bGVzOm5ldyBTZXR9O2xldCBlPWRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKGBsaW5rYCk7Zm9yKGxldCB0PWUubGVuZ3RoLTE7dD49MDt0LS0pe2xldCBuPWVbdF07aS5hbGwuYWRkKG4uaHJlZiksbi5yZWw9PT1gc3R5bGVzaGVldGAmJmkuc3R5bGVzLmFkZChuLmhyZWYpfX1pZigoYz9pLnN0eWxlczppLmFsbCkuaGFzKHMuaHJlZikpcmV0dXJuO2xldCBlPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoYGxpbmtgKTtpZihlLnJlbD1jP2BzdHlsZXNoZWV0YDpgbW9kdWxlcHJlbG9hZGAsY3x8KGUuYXM9YHNjcmlwdGApLGUuY3Jvc3NPcmlnaW49YGAsZS5ocmVmPXMuaHJlZixsJiZlLnNldEF0dHJpYnV0ZShgbm9uY2VgLGwpLGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQoZSksYylyZXR1cm4gbmV3IFByb21pc2UoKHQsbik9PntsZXQgcj1pPT57ZS5yZW1vdmVFdmVudExpc3RlbmVyKGBsb2FkYCxyKSxlLnJlbW92ZUV2ZW50TGlzdGVuZXIoYGVycm9yYCxyKSxpLnR5cGU9PT1gZXJyb3JgP24oRXJyb3IoYFVuYWJsZSB0byBwcmVsb2FkIENTUyBmb3IgJHtzfWApKTp0KGkpfTtlLmFkZEV2ZW50TGlzdGVuZXIoYGxvYWRgLHIpLGUuYWRkRXZlbnRMaXN0ZW5lcihgZXJyb3JgLHIpfSl9KX0pLmZpbHRlcihlPT5lIT09dm9pZCAwKSl9ZnVuY3Rpb24gYyhlKXtsZXQgdD1uZXcgRXZlbnQoYHZpdGU6cHJlbG9hZEVycm9yYCx7Y2FuY2VsYWJsZTohMH0pO2lmKHQucGF5bG9hZD1lLHdpbmRvdy5kaXNwYXRjaEV2ZW50KHQpLCF0LmRlZmF1bHRQcmV2ZW50ZWQpdGhyb3cgZX1yZXR1cm4gcy50aGVuKGU9Pntmb3IobGV0IHQgb2YgZXx8W10pdC5zdGF0dXM9PT1gcmVqZWN0ZWRgJiZjKHQucmVhc29uKTtyZXR1cm4gaSgpLmNhdGNoKGMpfSl9O2koKCk9PmltcG9ydChgLi9keW5hbWljLWZvby1Cd2haVGt0Qi5qc2ApLF9fdml0ZV9fbWFwRGVwcyhbMCwxXSkpLGNvbnNvbGUubG9nKGBhZnRlciBwcmVsb2FkIGR5bmFtaWNgKTtleHBvcnR7aSBhcyB0fTsKLy8jIGRlYnVnSWQ9ZGQ4NDE1ZDItMGE1Ni00YzM3LWE3ZDItYmYxZDhiMjgxY2NjCi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFmdGVyLXByZWxvYWQtZHluYW1pYy1EZGhCWFNDbC5qcy5tYXAyODUAeyJkZWJ1Z0lkIjoiMDAwMDAwMDAtMDAwMC0wMDAwLTAwMDAtMDAwMDAwMDAwMDAwIiwibWFwcGluZ3MiOiI7Z2tEQUFBQSxNQUFBLE9BQU8scURBRVAsUUFBUSxJQUFJLHVCQUF1QixFIiwibmFtZXMiOlsiX192aXRlUHJlbG9hZCJdLCJzb3VyY2VzIjpbIi4uLy4uL2FmdGVyLXByZWxvYWQtZHluYW1pYy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQoJy4vZHluYW1pYy9keW5hbWljLWZvbycpXG5cbmNvbnNvbGUubG9nKCdhZnRlciBwcmVsb2FkIGR5bmFtaWMnKVxuIl0sInZlcnNpb24iOjN9"
+          visualization: "https://evanw.github.io/source-map-visualization/#MjA3MwBjb25zdCBfX3ZpdGVfX21hcERlcHM9KGksbT1fX3ZpdGVfX21hcERlcHMsZD0obS5mfHwobS5mPVsiYXNzZXRzL2R5bmFtaWMtZm9vLUJ3aFpUa3RCLmpzIiwiYXNzZXRzL2R5bmFtaWMtZm9vLURzcUtSckV5LmNzcyJdKSkpPT5pLm1hcChpPT5kW2ldKTsKdmFyIGU9ZnVuY3Rpb24oZSl7cmV0dXJuYC9gK2V9LHQ9e30sbj17fSxyPWZ1bmN0aW9uKGUpe3JldHVybiBlLnBhdGhuYW1lLmVuZHNXaXRoKGAuY3NzYCl9LGk9ZnVuY3Rpb24oZSx0LG4pe2lmKHQgaW4gZSlyZXR1cm4gZVt0XTtsZXQgcj1uKCk7aWYoIXIpe2VbdF09dm9pZCAwO3JldHVybn1sZXQgaT1yLnRoZW4oKCk9PntlW3RdPXZvaWQgMH0sbj0+e3Rocm93IGRlbGV0ZSBlW3RdLG59KTtyZXR1cm4gZVt0XT1pLGl9LGE9ZnVuY3Rpb24oYSxvLHMpe2xldCBjPVByb21pc2UucmVzb2x2ZSgpO2lmKG8mJm8ubGVuZ3RoPjApe2xldCBhLGw9ZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgbWV0YVtwcm9wZXJ0eT1jc3Atbm9uY2VdYCksdT1sPy5ub25jZXx8bD8uZ2V0QXR0cmlidXRlKGBub25jZWApO2Z1bmN0aW9uIGQoZSl7cmV0dXJuIFByb21pc2UuYWxsKGUubWFwKGU9PlByb21pc2UucmVzb2x2ZShlKS50aGVuKGU9Pih7c3RhdHVzOmBmdWxmaWxsZWRgLHZhbHVlOmV9KSxlPT4oe3N0YXR1czpgcmVqZWN0ZWRgLHJlYXNvbjplfSkpKSl9ZnVuY3Rpb24gZihlKXtyZXR1cm4gaW1wb3J0Lm1ldGEucmVzb2x2ZT9uZXcgVVJMKGltcG9ydC5tZXRhLnJlc29sdmUoZSkpOm5ldyBVUkwoZSxpbXBvcnQubWV0YS51cmwpfWM9ZChvLm1hcChvPT57bz1lKG8scyk7bGV0IGM9ZihvKSxsPXIoYyk7cmV0dXJuIGkodCxjLmhyZWYsKCk9PntpZihhPT09dm9pZCAwKXthPXthbGw6bmV3IFNldCxzdHlsZXM6bmV3IFNldH07bGV0IGU9ZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoYGxpbmtgKTtmb3IobGV0IHQ9ZS5sZW5ndGgtMTt0Pj0wO3QtLSl7bGV0IG49ZVt0XTthLm
```

**File**: `playground/preload/__tests__/preload.spec.ts` (modified, +50/-1)
```diff
@@ -1,5 +1,5 @@
 import { describe, expect, test } from 'vitest'
-import { browserLogs, isBuild, page } from '~utils'
+import { browserLogs, getColor, isBuild, page } from '~utils'
 
 test('should have no 404s', () => {
   browserLogs.forEach((msg) => {
@@ -13,6 +13,55 @@ describe.runIf(isBuild)('build', () => {
     expect(await page.textContent('#done')).toBe('ran js')
   })
 
+  test('retries a stylesheet preload in place after it fails', async () => {
+    let requestCount = 0
+    await page.route(/\/assets\/hello-.*\.css$/, async (route) => {
+      requestCount++
+      if (requestCount === 1) {
+        await route.abort()
+      } else {
+        await route.continue()
+      }
+    })
+    await page.evaluate(() => {
+      window.addEventListener(
+        'vite:preloadError',
+        () => {
+          document.documentElement.dataset.preloadError = 'true'
+        },
+        { once: true },
+      )
+    })
+
+    await page.click('#hello .load')
+    await page.waitForFunction(
+      () => document.documentElement.dataset.preloadError === 'true',
+    )
+
+    const stylesheetSelector = 'link[rel="stylesheet"][href*="/assets/hello-"]'
+    expect(await page.locator(stylesheetSelector).count()).toBe(1)
+    await page.locator(stylesheetSelector).evaluate((failedLink) => {
+      const marker = document.createElement('meta')
+      marker.id = 'css-precedence-marker'
+      failedLink.after(marker)
+    })
+
+    await page.click('#hello .load')
+    await page.waitForSelector('#hello output')
+
+    expect(requestCount).toBe(2)
+    expect(await getColor('#hello .msg')).toBe('red')
+    // make sure the link tag exists in the same place
+    // so that the precedence of the CSS link is maintained
+    expect(
+      await page
+        .locator(stylesheetSelector)
+        .evaluate(
+          (link) => link.nextElementSibling?.id === 'css-precedence-marker',
+        ),
+    ).toBe(true)
+  })
+
   test('dynamic import with comments', async () => {
     await page.click('#hello .load')
     await page.waitForSelector('#hello output')
```

---

### Incident Patch 3: `c5be55f5` (2026-11-12)
**Commit Message**: feat(css): skip emitting empty CSS files (#24059)

**File**: `packages/vite/src/node/__tests__/build.spec.ts` (modified, +57/-0)
```diff
@@ -466,6 +466,63 @@ describe('build', () => {
     ).rejects.toThrow('CSS files cannot be used as entry points')
   })
 
+  describe('empty CSS assets', () => {
+    async function buildProject(
+      css: string,
+      cssCodeSplit: boolean,
+      input = 'entry.js',
+    ) {
+      return (await build({
+        root: resolve(dirname, 'packages/build-project'),
+        configFile: false,
+        input,
+        logLevel: 'silent',
+        build: {
+          write: false,
+          cssCodeSplit,
+        },
+        plugins: [
+          {
+            name: 'test-empty-css',
+            resolveId(id) {
+              if (id === 'entry.js' || id === 'empty.css') {
+                return '\0' + id
+              }
+            },
+            load(id) {
+              if (id === '\0entry.js') {
+                return `import 'empty.css'; console.log('entry')`
+              }
+              if (id === '\0empty.css') return css
+            },
+          },
+        ],
+      })) as RolldownOutput
+    }
+
+    for (const css of ['', '.empty {}']) {
+      for (const cssCodeSplit of [true, false]) {
+        test(`skips empty CSS ${JSON.stringify(css)} (cssCodeSplit: ${cssCodeSplit})`, async () => {
+          const { output } = await buildProject(css, cssCodeSplit)
+          expect(output.filter((file) => file.type === 'chunk')).toHaveLength(1)
+          expect(
+            output.filter((file) => file.fileName.endsWith('.css')),
+          ).toHaveLength(0)
+        })
+      }
+
+      test(`preserves an empty CSS entrypoint (${JSON.stringify(css)})`, async () => {
+        const { output } = await buildProject(css, true, 'empty.css')
+        expect(output).toHaveLength(1)
+        expect(output[0]).toMatchObject({
+          type: 'asset',
+          fileName: expect.stringMatching(/\.css$/),
+          source: '',
+        })
+      })
+    }
+  })
+
   test('file hash should change when pure css chunk changes', async () => {
     const buildProject = async (cssColor: string) => {
       return (await build({
```

**File**: `packages/vite/src/node/plugins/css.ts` (modified, +23/-17)
```diff
@@ -972,22 +972,24 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
                     return finalizeCss(chunkCSS!, config)
                   })
 
-                  // emit corresponding css file
-                  const referenceId = this.emitFile({
-                    type: 'asset',
-                    name: cssAssetName,
-                    originalFileName,
-                    source: chunkCSS,
-                  })
-                  chunkCssReferences.set(chunk.fileName, referenceId)
-                  if (isEntry) {
-                    cssEntriesMap
-                      .get(this.environment)!
-                      .set(chunk.fileName, { referenceId, name: chunk.name })
+                  if (chunkCSS || isEntry) {
+                    // emit corresponding css file
+                    const referenceId = this.emitFile({
+                      type: 'asset',
+                      name: cssAssetName,
+                      originalFileName,
+                      source: chunkCSS,
+                    })
+                    chunkCssReferences.set(chunk.fileName, referenceId)
+                    if (isEntry) {
+                      cssEntriesMap
+                        .get(this.environment)!
+                        .set(chunk.fileName, { referenceId, name: chunk.name })
+                    }
+                    chunk.viteMetadata!.importedCss.add(
+                      this.getFileName(referenceId),
+                    )
                   }
-                  chunk.viteMetadata!.importedCss.add(
-                    this.getFileName(referenceId),
-                  )
                 } else if (this.environment.config.consumer === 'client') {
                   // legacy build and inline css
 
@@ -1102,10 +1104,13 @@ export function cssPostPlugin(config: ResolvedConfig): Plugin {
           collect(bundle[chunkName])
         }
 
-        // Finally, if there's any extracted CSS, we emit the asset
         if (extractedCss) {
-          hasEmitted = true
           extractedCss = await finalizeCss(extractedCss, config)
+        }
+
+        // Emit the asset if CSS remains after finalization.
+        if (extractedCss) {
+          hasEmitted = true
           this.emitFile({
             name: getCssBundleName(),
             type: 'asset',
@@ -2046,6 +2051,7 @@ async function finalizeCss(css: string, config: ResolvedConfig) {
   if (config.build.cssMinify) {
     css = await minifyCSS(css, config, false)
   }
+  if (!css.trim()) return ''
   // inject an additional string to generate a different hash for https://github.com/vitejs/vite/issues/18038
   //
   // pre-5.4.3, we generated CSS link tags without crossorigin attribute and generated an hash without
```

#### Recent Merged Pull Requests:
- **PR #24080** (2026-11-12): fix: escape imported name in `transformCjsImport` (@btea)
- **PR #24079** (2026-11-12): refactor: use `tinyexec` instead of `execa` (@btea)
- **PR #24076** (2026-11-12): chore: exclude pnpm test fixture from workspace packages (@btea)
- **PR #24074** (2026-11-12): fix: escape import specifiers (@sapphi-red)
- **PR #24072** (closed): fix: preserve Windows device namespace prefix in normalizePath (fix #23986) (@TbhVishal)
- **PR #24068** (2026-11-11): build: look up dts identifier replacements by imported name (@hyfdev)

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

## X. client): fallback to waiting on main thread for server start when trusted types 

**RULE**:
When implementing operations in `packages/vite/src/client/client.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in vitejs/vite. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2dcd391e`: client): fallback to waiting on main thread for server start when trusted types are enforced (#21483). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/vite/src/client/client.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  const useMainThreadFallback = () => {
  if (typeof SharedWorker === 'undefined') {
    return useMainThreadFallback()
  }


  let sharedWorker: SharedWorker
  try {
    sharedWorker = new SharedWorker(objURL)
  } catch (error) {
    URL.revokeObjectURL(objURL)
    // Trusted Types enforcement rejects string worker URLs.
    if (error instanceof TypeError) {
      return useMainThreadFallback()
    }
    throw error
  }
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  if (typeof SharedWorker === 'undefined') {
  const sharedWorker = new SharedWorker(objURL)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2dcd391e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
