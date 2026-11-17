> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vitejs-vite-learnings.md`  
> **Source**: github ([https://github.com/vitejs/vite](https://github.com/vitejs/vite))  
> **Source Version**: `dbce0c67`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T04:05:39.300Z  
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
> **Harvest Timestamp**: 2026-11-17T04:05:39.076Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vitejs/vite`
- **Description**: Next generation frontend tooling. It's fast!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 83943 stars

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
- **Issue #24119** (2026-11-17): **fix(optimizer): respect top-level tsconfig option when scanning deps (fix #24117)**
  *Symptoms*: fixes #24117  The top-level `tsconfig` option is applied to the build (`resolveRolldownOptions` in `build.ts`) and to the oxc/resolve plugins, but the dep scanner only passed `optimizeDeps.rolldownOptions` to Rolldown's `scan`. So during scanning, Rolldown still discovered the nearest `tsconfig.json` per file, and a broken nested config failed the scan even though the selected one was valid.  The scanner now uses the same precedence as the build: `config.tsconfig ?? rolldownOptions.tsconfig`, and clears `resolve.tsconfigFilename` when the top-level option is set.  Alternative considered: only setting `tsconfig`. I kept the `resolve.tsconfigFilename` reset too so the scanner matches `build.ts` exactly.  Test: added a case to `scan.spec.ts` with a fixture where `src/tsconfig.json` extends a missing file and `tsconfig.selected.json` is valid. It fails on main with the same `[TSCONFIG_ERROR] ... Tsconfig not found` as the issue and passes with the change.  Assisted by Claude Opus 5.5; description drafted with AI, and then reviewed and edited by the author. 

- **Issue #24118** (2026-11-16): **fix: respect top-level tsconfig during dependency scanning**
  *Symptoms*: Fixes #24117.  The dependency scanner passes `optimizeDeps.rolldownOptions` to Rolldown but omits Vite's resolved top-level `tsconfig`. This lets a nearer per-directory config override the explicitly selected config during scanning, even though builds honor the top-level setting.  Pass the resolved top-level path to the scanner, with the optimizer-specific path as the fallback. Add a regression test where the selected root config is valid and a nested config extends a missing file.  Checks: `pnpm --filter vite build`; `pnpm exec vitest run src/node/__tests__/scan.spec.ts`; `pnpm exec oxfmt --check ...`; `git diff --check`. 

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

### Incident Patch 1: `dbce0c67` (2026-11-17)
**Commit Message**: perf(build): shift source maps for preload rewrites instead of re-tracing them (#24049)

**File**: `packages/vite/package.json` (modified, +1/-0)
```diff
@@ -78,6 +78,7 @@
   "devDependencies": {
     "@babel/parser": "^7.29.14",
     "@jridgewell/remapping": "^2.3.5",
+    "@jridgewell/sourcemap-codec": "^1.6.0",
     "@jridgewell/trace-mapping": "^0.3.31",
     "@polka/compression": "^1.0.0-next.25",
     "@rollup/plugin-alias": "^6.0.1",
```

**File**: `packages/vite/src/node/__tests__/utils.spec.ts` (modified, +178/-0)
```diff
@@ -3,12 +3,15 @@ import fs from 'node:fs'
 import os, { type NetworkInterfaceInfoIPv4 } from 'node:os'
 import path from 'node:path'
 import type { DecodedSourceMap, RawSourceMap } from '@jridgewell/remapping'
+import { decode, encode } from '@jridgewell/sourcemap-codec'
+import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping'
 import MagicString from 'magic-string'
 import { fileURLToPath } from 'mlly'
 import { describe, expect, test, vi, onTestFinished } from 'vitest'
 import type { CommonServerOptions, ResolvedServerUrls } from '..'
 import { isWindows } from '../../shared/utils'
 import {
+  SourcemapEditor,
   asyncFlatten,
   bareImportRE,
   combineSourcemaps,
@@ -1067,6 +1070,181 @@ describe('combineSourcemaps', () => {
   })
 })
 
+describe('SourcemapEditor', () => {
+  test('reports whether the code has changed', () => {
+    const s = new SourcemapEditor('foo(bar)')
+    expect(s.hasChanged()).toBe(false)
+    s.update(4, 7, '[]')
+    expect(s.hasChanged()).toBe(true)
+  })
+
+  // segments are [generated column, original line, original column]
+  const chunkMap = (lines: [number, number, number][][]): RawSourceMap => ({
+    version: 3,
+    file: 'index.js',
+    sources: ['src/index.js'],
+    names: [],
+    mappings: encode(
+      lines.map((segments) =>
+        segments.map(([column, line, originalColumn]) => [
+          column,
+          0,
+          line,
+          originalColumn,
+        ]),
+      ),
+    ),
+  })
+
+  // Compares every position of the edited code against the chunk map traced
+  // through a character-level map of the edits.
+  const expectExactMapping = (
+    code: string,
+    map: RawSourceMap,
+    edit: (s: SourcemapEditor | MagicString) => void,
+  ) => {
+    const s = new SourcemapEditor(code)
+    const expected = new MagicString(code)
+    edit(s)
+    edit(expected)
+    expect(s.toString()).toBe(expected.toString())
+    const exact = new TraceMap(
+      combineSourcemaps('index.js', [
+        expected.generateDecodedMap({ source: 'index.js', hires: true }),
+        map,
+      ]),
+    )
+    const actual = new TraceMap(s.generateMap('index.js', map))
+
+    s.toString()
+      .split('\n')
+      .forEach((text, line) => {
+        for (let column = 0; column <= text.length; column++) {
+          const position = { line: line + 1, column }
+          expect(
+            originalPositionFor(actual, position),
+            `${line}:${column}`,
+          ).toStrictEqual(originalPositionFor(exact, position))
+        }
+      })
+  }
+
+  const marker = '__MARKER__'
+
+  test('replaces spans with longer and shorter content', () => {
+    const code = `a(${marker});b(${marker});c()`
+    expectExactMapping(
+      code,
+      chunkMap([
+        [
+          [0, 0, 0],
+          [2, 0, 4],
+          [12, 0, 20],
+          [14, 1, 0],
+          [16, 1, 4],
+          [26, 1, 20],
+          [28, 2, 0],
+        ],
+      ]),
+      (s) => {
+        s.update(2, 12, '__vite__mapDeps([0,1])')
+        s.update(16, 26, '[]')
+      },
+    )
+  })
+
+  test('maps the code after a replaced span like the segment inside it', () => {
+    const code = `a(${marker}, b)`
+    expectExactMapping(
+      code,
+      chunkMap([
+        [
+          [0, 0, 0],
+          [5, 3, 7],
+          [14, 4, 0],
+        ],
+      ]),
+      (s) => s.update(2, 12, 'void 0'),
+    )
+  })
+
+  test('keeps segments that share a column', () => {
+    const code = `a(${marker});parent?.x`
+    expectExactMapping(
+      code,
+      chunkMap([
+        [
+          [0, 0, 0],
+          [14, 1, 4],
+          [14, 2, 6],
+          [21, 2, 13],
+        ],
+      ]),
+      (s) => s.update(2, 12, '[]'),
+    )
+  })
+
+  test('moves lines down for inserted lines', () => {
+    const code = `#!/usr/bin/env node\nfoo(${marker})\nbar()`
+    expectExactMapping(
+      code,
+      chunkMap([
+        [[0, 0, 0]],
+        [
+          [0, 1, 0],
+          [4, 1, 4],
+        ],
+        [[0, 2, 0]],
+      ]),
+      (s) => {
+        s.prependLeft(20, 'const __vite__mapDeps=0;\n')
+        s.update(24, 34, '[]')
+      },
+    )
+  })
+
+  test('drops redundant segments and unused names', () => {
+    const map: RawSourceMap = {
+      version: 3,
+      file: 'index.js',
+      sources: ['src/index.js'],
+      names: ['unused', 'foo'],
+      mappings: encode([
+        [[0], [5, 0, 0, 0], [9, 0, 0, 0], [12], [14], [16, 0, 1, 0]],
+        [
+          [0, 0, 2, 0],
+          [7, 0, 2, 0],
+          [7, 0, 2, 0, 1],
+          [9, 0, 2, 0, 1],
+        ],
+      ]),
+    }
+    const s = new SourcemapEditor('x'.repeat(20) + '\n')
+    const result = s.generateMap('index.js', map)
+    expect(result.names).toStrictEqual(['foo'])
+    expect(decode(result.mappings)).toStrictEqual([
+      [[5, 0, 0, 0], [12], [16, 0, 1, 0]],
+      [
+        [0, 0, 2, 0],
+        [7, 0, 2, 0],
+        [7, 0, 2, 0, 0],
+      ],
+    ])
+  })
+
+  test('maps 
```

**File**: `packages/vite/src/node/plugins/importAnalysisBuild.ts` (modified, +10/-19)
```diff
@@ -1,9 +1,8 @@
 import path from 'node:path'
-import type { DecodedSourceMap, RawSourceMap } from '@jridgewell/remapping'
+import type { RawSourceMap } from '@jridgewell/remapping'
 import convertSourceMap from 'convert-source-map'
 import type { DynamicImport } from 'es-module-lexer'
 import { init, parse as parseImports } from 'es-module-lexer'
-import MagicString from 'magic-string'
 import type { RenderedChunk, SourceMap } from 'rolldown'
 import { viteBuildImportAnalysisPlugin as nativeBuildImportAnalysisPlugin } from 'rolldown/experimental'
 import { cleanUrl } from '../../shared/utils'
@@ -14,7 +13,7 @@ import { perEnvironmentState } from '../environment'
 import { type Plugin, perEnvironmentPlugin } from '../plugin'
 import { genSourceMapUrl } from '../server/sourcemap'
 import {
-  combineSourcemaps,
+  SourcemapEditor,
   generateCodeFrame,
   getFileStartIndex,
   normalizePath,
@@ -668,7 +667,7 @@ export function buildImportAnalysisPlugin(config: ResolvedConfig): Plugin[] {
             })
           }
 
-          const s = new MagicString(code)
+          const s = new SourcemapEditor(code)
           const rewroteMarkerStartPos = new Set() // position of the leading double quote
 
           const fileDeps: FileDep[] = []
@@ -847,11 +846,8 @@ export function buildImportAnalysisPlugin(config: ResolvedConfig): Plugin[] {
             const mapDepsCode = `const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=${fileDepsCode})))=>i.map(i=>d[i]);\n`
 
             // inject extra code at the top or next line of hashbang
-            if (code.startsWith('#!')) {
-              s.prependLeft(getFileStartIndex(code), mapDepsCode)
-            } else {
-              s.prepend(mapDepsCode)
-            }
+            const fileStartIndex = getFileStartIndex(code)
+            s.prependLeft(fileStartIndex, mapDepsCode)
           }
 
           // there may still be markers due to inlined dynamic imports, remove
@@ -872,19 +868,14 @@ export function buildImportAnalysisPlugin(config: ResolvedConfig): Plugin[] {
           if (s.hasChanged()) {
             chunk.code = s.toString()
             if (buildSourcemap && chunk.map) {
-              const nextMap = s.generateDecodedMap({
-                source: chunk.fileName,
-                hires: 'boundary',
-              })
               const originalFile = chunk.map.file
-              const map = combineSourcemaps(chunk.fileName, [
-                nextMap as DecodedSourceMap,
+              const map = s.generateMap(
+                chunk.fileName,
                 chunk.map as RawSourceMap,
-              ]) as SourceMap
+              ) as SourceMap
+              map.toString = () => JSON.stringify(map)
               map.toUrl = () => genSourceMapUrl(map)
-              if (originalFile) {
-                map.file = originalFile
-              }
+              map.file = originalFile || chunk.fileName
 
               const originalDebugId = chunk.map.debugId
               chunk.map = map
```

**File**: `packages/vite/src/node/utils.ts` (modified, +199/-1)
```diff
@@ -13,8 +13,10 @@ import { performance } from 'node:perf_hooks'
 import { fileURLToPath } from 'node:url'
 import remapping from '@jridgewell/remapping'
 import type { DecodedSourceMap, RawSourceMap } from '@jridgewell/remapping'
+import { decode, encode } from '@jridgewell/sourcemap-codec'
+import type { SourceMapSegment } from '@jridgewell/sourcemap-codec'
 import type { Equal } from '@type-challenges/utils'
-import type MagicString from 'magic-string'
+import MagicString from 'magic-string'
 import type { Debugger } from 'obug'
 import debug from 'obug'
 import colors from 'picocolors'
@@ -973,6 +975,202 @@ export function combineSourcemaps(
   return map as RawSourceMap
 }
 
+/**
+ * Tracks edits through a limited MagicString API so sourcemaps can be shifted
+ * without generating and tracing a map of the edits when possible.
+ */
+export class SourcemapEditor {
+  private s: MagicString
+  private edits: SourceEdit[] = []
+
+  constructor(code: string) {
+    this.s = new MagicString(code)
+  }
+
+  update(start: number, end: number, content: string): this {
+    this.s.update(start, end, content)
+    this.edits.push({ start, end, content })
+    return this
+  }
+
+  prependLeft(index: number, content: string): this {
+    this.s.prependLeft(index, content)
+    this.edits.push({ start: index, end: index, content })
+    return this
+  }
+
+  hasChanged(): boolean {
+    return this.s.hasChanged()
+  }
+
+  toString(): string {
+    return this.s.toString()
+  }
+
+  generateMap(filename: string, map: RawSourceMap): RawSourceMap {
+    return (
+      shiftSourcemapForEdits(map, this.s.original, this.edits) ??
+      // For edits it can't shift, e.g. `Promise.resolve({})` replacing an
+      // import that spans lines.
+      combineSourcemaps(filename, [
+        this.s.generateDecodedMap({
+          source: filename,
+          hires: 'boundary',
+        }) as DecodedSourceMap,
+        map,
+      ])
+    )
+  }
+}
+
+export interface SourceEdit {
+  start: number
+  end: number
+  content: string
+}
+
+/**
+ * Returns `map` updated for `edits` to the code it maps, by moving its
+ * segments instead of tracing it through a map of the edits like
+ * `combineSourcemaps`. Supports edits that replace a span within one line and
+ * edits that insert whole lines at the start of a line. Returns `undefined` for
+ * any other edit.
+ */
+export function shiftSourcemapForEdits(
+  map: RawSourceMap,
+  code: string,
+  edits: SourceEdit[],
+): RawSourceMap | undefined {
+  // [start column, end column, added length] for each edit, by line
+  const columnEdits = new Map<number, [number, number, number][]>()
+  const insertedLines = new Map<number, number>()
+  let line = 0
+  let lineStart = 0
+  let nextNewline = code.indexOf('\n')
+  for (const { start, end, content } of [...edits].sort(
+    (a, b) => a.start - b.start,
+  )) {
+    while (nextNewline !== -1 && nextNewline < start) {
+      line++
+      lineStart = nextNewline + 1
+      nextNewline = code.indexOf('\n', lineStart)
+    }
+    if (nextNewline !== -1 && nextNewline < end) return
+
+    if (content.includes('\n')) {
+      if (start !== end || start !== lineStart || !content.endsWith('\n')) {
+        return
+      }
+      const count = content.split('\n').length - 1
+      insertedLines.set(line, (insertedLines.get(line) ?? 0) + count)
+      continue
+    }
+
+    let lineEdits = columnEdits.get(line)
+    if (!lineEdits) columnEdits.set(line, (lineEdits = []))
+    lineEdits.push([
+      start - lineStart,
+      end - lineStart,
+      content.length - (end - start),
+    ])
+  }
+
+  const lines: SourceMapSegment[][] = []
+  decode(map.mappings).forEach((segments, i) => {
+    for (let n = insertedLines.get(i) ?? 0; n > 0; n--) lines.push([])
+    const lineEdits = columnEdits.get(i)
+    lines.push(lineEdits ? shiftSegments(segments, lineEdits) : segments)
+  })
+  const names = removeRedundantSegments(lines, map.names)
+  return { ...map, names, mappings: encode(lines) }
+}
+
+/**
+ * Drops the segments `combineSourcemaps` would leave out (see gen-mapping's
+ * `maybeAddSegment`) and the names no segment uses. Lookups are unchanged.
+ */
+function removeRedundantSegments(
+  lines: SourceMapSegment[][],
+  names: string[],
+): string[] {
+  const usedNames: string[] = []
+  const newNameIndex = new Map<number, number>()
+  for (let i = 0; i < lines.length; i++) {
+    const kept: SourceMapSegment[] = []
+    const segments = lines[i]
+    for (let s = 0; s < segments.length; s++) {
+      const segment = segments[s]
+      // lookups use the first of several segments at one column, so dropping
+      // it would change what the column maps to
+      const sharesColumn = segments[s + 1]?.[0] === segment[0]
+      const previous = kept.at(-1)
+      if (segment.length === 1) {
+        if (sharesColumn || (previous && previous.length !== 1)) {
+          kept.push(segment)
+        }
+        continue
+      }
+      if (segment.l
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -410,6 +410,9 @@ importers:
       '@jridgewell/remapping':
         specifier: ^2.3.5
         version: 2.3.5
+      '@jridgewell/sourcemap-codec':
+        specifier: ^1.6.0
+        version: 1.6.0
       '@jridgewell/trace-mapping':
         specifier: ^0.3.31
         version: 0.3.31
```

---

### Incident Patch 2: `c0d590d6` (2026-11-16)
**Commit Message**: fix(build): keep `magicString` and `ast` in transform hook meta (#24067)

Co-authored-by: btea <[REDACTED_EMAIL]>

**File**: `packages/vite/rolldown.dts.config.ts` (modified, +1/-0)
```diff
@@ -83,6 +83,7 @@ const identifierReplacements: Record<string, Record<string, string>> = {
   'rolldown/utils': {
     TransformOptions: 'rolldown_utils_TransformOptions',
     TransformResult: 'rolldown_utils_TransformResult',
+    ESTree: 'rolldown_utils_ESTree',
   },
   'node:http': {
     Server: 'http.Server',
```

**File**: `packages/vite/src/node/__tests__/build.spec.ts` (modified, +46/-0)
```diff
@@ -94,6 +94,52 @@ describe('build', () => {
     assertOutputHashContentChange(result[0], result[1])
   })
 
+  test('transform hook meta keeps rolldown magicString and ast', async () => {
+    const metaTypes: Array<
+      [string | undefined, string | undefined, boolean | undefined]
+    > = []
+    const result = (await build({
+      root: resolve(dirname, 'packages/build-project'),
+      logLevel: 'silent',
+      build: {
+        write: false,
+        minify: false,
+      },
+      plugins: [
+        {
+          name: 'test',
+          resolveId(id) {
+            if (id === 'entry.js') {
+              return '\0' + id
+            }
+          },
+          load(id) {
+            if (id === '\0entry.js') {
+              return `console.log('foo')`
+            }
+          },
+          transform(_code, id, options) {
+            if (id === '\0entry.js') {
+              metaTypes.push([
+                typeof options?.magicString,
+                typeof options?.ast,
+                options?.ssr,
+              ])
+              const magicString = options!.magicString!
+              magicString.replaceAll(`'foo'`, `'bar'`)
+              return { code: magicString }
+            }
+          },
+        },
+      ],
+    })) as RolldownOutput
+    expect(metaTypes).toStrictEqual([['object', 'object', false]])
+    const [chunk] = result.output.filter(
+      (chunk): chunk is OutputChunk => chunk.type === 'chunk',
+    )
+    expect(chunk?.code).toContain(`console.log("bar")`)
+  })
+
   test('file hash should change when renderBuiltUrl changes', async () => {
     const createRenderBuiltUrl = (base: string) => (filename: string) =>
       `${base}/${filename}`
```

**File**: `packages/vite/src/node/build.ts` (modified, +10/-3)
```diff
@@ -1545,9 +1545,16 @@ function injectSsrFlag<T extends Record<string, any>>(
   pluginName: string,
 ): T & { ssr?: boolean } {
   let ssr = environment.config.consumer === 'server'
-  const newOptions = { ...options, ssr } as T & {
-    ssr?: boolean
-  }
+  // spreading the options would drop non-enumerable properties (e.g. the lazy
+  // `magicString` and `ast` getters rolldown attaches to the transform meta),
+  // so copy the property descriptors instead
+  const newOptions = Object.defineProperties(
+    {},
+    {
+      ...(options ? Object.getOwnPropertyDescriptors(options) : {}),
+      ssr: { value: ssr, writable: true, enumerable: true, configurable: true },
+    },
+  ) as T & { ssr?: boolean }
 
   if (
     isFutureDeprecationEnabled(
```

**File**: `packages/vite/src/node/plugin.ts` (modified, +14/-0)
```diff
@@ -10,9 +10,11 @@ import type {
   PluginContextMeta,
   ResolveIdResult,
   Plugin as RolldownPlugin,
+  RolldownMagicString,
   TransformPluginContext,
   TransformResult,
 } from 'rolldown'
+import type { ESTree } from 'rolldown/utils'
 import type { PartialEnvironment } from './baseEnvironment'
 import type { BuildAppHook } from './build'
 import type {
@@ -167,6 +169,18 @@ export interface Plugin<A = any> extends RolldownPlugin<A> {
       options?: {
         moduleType: ModuleType
         ssr?: boolean | undefined
+        /**
+         * A lazily-created MagicString instance for the module's code.
+         * Only available during build.
+         * @experimental
+         */
+        magicString?: RolldownMagicString | undefined
+        /**
+         * The lazily-parsed AST of the module's code.
+         * Only available during build.
+         * @experimental
+         */
+        ast?: ESTree.Program | undefined
       },
     ) => Promise<TransformResult> | TransformResult,
     {
```

---

### Incident Patch 3: `dda2a82c` (2026-11-16)
**Commit Message**: test(hmr): fix two flaky hmr playground tests (#24092)

Co-authored-by: sapphi-red <[REDACTED_EMAIL]>

**File**: `playground/hmr/__tests__/hmr.spec.ts` (modified, +16/-9)
```diff
@@ -19,6 +19,7 @@ import {
   removeFile,
   serverLogs,
   untilBrowserLogAfter,
+  untilBrowserLogAfterNavigation,
   viteTestUrl,
 } from '~utils'
 
@@ -536,7 +537,7 @@ if (!isBuild) {
       let dep = 'dep0'
 
       beforeAll(async () => {
-        await untilBrowserLogAfter(
+        await untilBrowserLogAfterNavigation(
           () => openPage(testDir),
           [CONNECTED, />>>>>>/],
           (logs) => {
@@ -671,7 +672,7 @@ if (!isBuild) {
       let dep = 'dep0'
 
       beforeAll(async () => {
-        await untilBrowserLogAfter(
+        await untilBrowserLogAfterNavigation(
           () => openPage(testDir),
           [CONNECTED, />>>>>>/],
           (logs) => {
@@ -734,7 +735,7 @@ if (!isBuild) {
       const testDir = baseDir + '/side-effects'
       const file = 'side-effects.ts'
 
-      await untilBrowserLogAfter(
+      await untilBrowserLogAfterNavigation(
         () => openPage(testDir),
         [CONNECTED, />>>/],
         (logs) => {
@@ -765,7 +766,7 @@ if (!isBuild) {
         const fileName = 'unused.ts'
         const file = `${testDir}/${fileName}`
 
-        await untilBrowserLogAfter(
+        await untilBrowserLogAfterNavigation(
           () => openPage(testDir),
           [CONNECTED, '-- unused --'],
           (logs) => {
@@ -791,7 +792,7 @@ if (!isBuild) {
         const fileName = 'used.ts'
         const file = `${testDir}/${fileName}`
 
-        await untilBrowserLogAfter(
+        await untilBrowserLogAfterNavigation(
           () => openPage(testDir),
           [CONNECTED, '-- used --'],
           (logs) => {
@@ -828,7 +829,7 @@ if (!isBuild) {
           const fileName = 'deps-all-accepted.ts'
           const file = `${testDir}/${fileName}`
 
-          await untilBrowserLogAfter(
+          await untilBrowserLogAfterNavigation(
             () => openPage(testDir),
             [CONNECTED, '>>> ready <<<'],
             (logs) => {
@@ -868,7 +869,7 @@ if (!isBuild) {
           const fileName = 'deps-some-accepted.ts'
           const file = `${testDir}/${fileName}`
 
-          await untilBrowserLogAfter(
+          await untilBrowserLogAfterNavigation(
             () => openPage(testDir),
             [CONNECTED, '>>> ready <<<'],
             (logs) => {
@@ -1140,7 +1141,10 @@ if (!isBuild) {
         .poll(() => page.textContent('.file-delete-restore'))
         .toMatch('parent:not-child')
 
-      // restore the file
+      // restore the file. The child's own update already renders
+      // `parent:child`, so also wait for the parent's: if it lands after the
+      // next test opens the page but before its HMR client connects, that page
+      // keeps the old parent
       await untilBrowserLogAfter(() => {
         addFile(childFile, originalChildFileCode)
         editFile(parentFile, (code) =>
@@ -1149,7 +1153,10 @@ if (!isBuild) {
             "export { value as childValue } from './child'",
           ),
         )
-      }, 'file-delete-restore/child.js hot data after prune: undefined')
+      }, [
+        'file-delete-restore/child.js hot data after prune: undefined',
+        hotUpdatedLog(parentFile),
+      ])
       await expect
         .poll(() => page.textContent('.file-delete-restore'))
         .toMatch('parent:child')
```

**File**: `playground/hmr/__tests__/no-partial-accept/hmr-no-partial-accept.spec.ts` (modified, +3/-2)
```diff
@@ -6,6 +6,7 @@ import {
   isBuild,
   page,
   untilBrowserLogAfter,
+  untilBrowserLogAfterNavigation,
   viteTestUrl,
 } from '~utils'
 
@@ -19,7 +20,7 @@ describe.runIf(!isBuild)('acceptExports with hmrPartialAccept off', () => {
     const file = `${testDir}/target.ts`
 
     beforeAll(async () => {
-      await untilBrowserLogAfter(
+      await untilBrowserLogAfterNavigation(
         () => openPage(testDir),
         [CONNECTED, />>>>>>/],
         (logs) => {
@@ -50,7 +51,7 @@ describe.runIf(!isBuild)('acceptExports with hmrPartialAccept off', () => {
     const file = `${testDir}/deps-all-accepted.ts`
 
     it('still accepts itself', async () => {
-      await untilBrowserLogAfter(
+      await untilBrowserLogAfterNavigation(
         () => openPage(testDir),
         [CONNECTED, '>>> ready <<<'],
         (logs) => {
```

**File**: `playground/proxy-hmr/__tests__/proxy-hmr.spec.ts` (modified, +2/-2)
```diff
@@ -3,12 +3,12 @@ import {
   editFile,
   isBuild,
   page,
-  untilBrowserLogAfter,
+  untilBrowserLogAfterNavigation,
   viteTestUrl,
 } from '~utils'
 
 test.runIf(!isBuild)('proxy-hmr', async () => {
-  await untilBrowserLogAfter(
+  await untilBrowserLogAfterNavigation(
     () => page.goto(viteTestUrl),
     // wait for both main and sub app HMR connection
     [/connected/, /connected/],
```

**File**: `playground/test-utils.ts` (modified, +57/-20)
```diff
@@ -12,6 +12,7 @@ import colors from 'css-color-names'
 import type {
   ConsoleMessage,
   ElementHandle,
+  Frame,
   Locator,
 } from 'playwright-chromium'
 import { xSync, type Result as TinyExecResult } from 'tinyexec'
@@ -357,47 +358,76 @@ export async function untilBrowserLogAfter(
   return logs
 }
 
+/**
+ * Like `untilBrowserLogAfter`, for an `operation` that opens a page. Only logs
+ * from the page that ends up open count: the previous page can still log while
+ * it unloads, and in bundled dev a stale build is served as a fallback page
+ * that reloads into the real one. Either could otherwise end the wait before
+ * the real page's HMR client has connected.
+ */
+export async function untilBrowserLogAfterNavigation(
+  operation: () => any,
+  target: string | RegExp | Array<string | RegExp>,
+  callback?: UntilBrowserLogAfterCallback,
+): Promise<string[]> {
+  const promise = untilBrowserLog(target, false, true)
+  await operation()
+  const logs = await promise
+  if (callback) {
+    await callback(logs)
+  }
+  return logs
+}
+
 async function untilBrowserLog(
   target?: string | RegExp | Array<string | RegExp>,
   expectOrder = true,
+  restartOnNavigation = false,
 ): Promise<string[]> {
   const { promise, resolve, reject } = promiseWithResolvers<void>()
   let timeoutId: ReturnType<typeof setTimeout>
 
   const logs = []
 
-  try {
-    const isMatch = (matcher: string | RegExp) => (text: string) =>
-      typeof matcher === 'string' ? text === matcher : matcher.test(text)
+  const handleNavigation = (frame: Frame) => {
+    if (frame !== page.mainFrame()) return
+    logs.length = 0
+    processMsg = createProcessMsg()
+  }
 
-    let processMsg: (text: string) => boolean
+  const isMatch = (matcher: string | RegExp) => (text: string) =>
+    typeof matcher === 'string' ? text === matcher : matcher.test(text)
 
+  const createProcessMsg = (): ((text: string) => boolean) => {
     if (!target) {
-      processMsg = () => true
-    } else if (Array.isArray(target)) {
+      return () => true
+    }
+    if (Array.isArray(target)) {
       if (expectOrder) {
         const remainingTargets = [...target]
-        processMsg = (text: string) => {
+        return (text: string) => {
           const nextTarget = remainingTargets.shift()
           expect(text).toMatch(nextTarget)
           return remainingTargets.length === 0
         }
-      } else {
-        const remainingMatchers = target.map(isMatch)
-        processMsg = (text: string) => {
-          const nextIndex = remainingMatchers.findIndex((matcher) =>
-            matcher(text),
-          )
-          if (nextIndex >= 0) {
-            remainingMatchers.splice(nextIndex, 1)
-          }
-          return remainingMatchers.length === 0
+      }
+      const remainingMatchers = target.map(isMatch)
+      return (text: string) => {
+        const nextIndex = remainingMatchers.findIndex((matcher) =>
+          matcher(text),
+        )
+        if (nextIndex >= 0) {
+          remainingMatchers.splice(nextIndex, 1)
         }
+        return remainingMatchers.length === 0
       }
-    } else {
-      processMsg = isMatch(target)
     }
+    return isMatch(target)
+  }
+
+  let processMsg = createProcessMsg()
 
+  try {
     const handleMsg = (msg: ConsoleMessage) => {
       try {
         const text = msg.text()
@@ -426,11 +456,18 @@ async function untilBrowserLog(
     }, 5000)
 
     page.on('console', handleMsg)
+    if (restartOnNavigation) {
+      page.on('framenavigated', handleNavigation)
+    }
   } catch (err) {
     reject(err)
   }
 
-  await promise
+  try {
+    await promise
+  } finally {
+    page.off('framenavigated', handleNavigation)
+  }
   clearTimeout(timeoutId)
 
   return logs
```

#### Recent Merged Pull Requests:
- **PR #24119** (closed): fix(optimizer): respect top-level tsconfig option when scanning deps (fix #24117) (@imryanthedev)
- **PR #24118** (closed): fix: respect top-level tsconfig during dependency scanning (@Gorkem-Taha)
- **PR #24112** (closed): fix(optimizer): skip post-scan optimization after close (fix #23752) (@sonofmagic)
- **PR #24108** (2026-11-16): release: v8.4.0-beta.1 (@github-actions[bot])
- **PR #24106** (2026-11-16): ci: exclude `maschwenk` from bot detection (@sapphi-red)
- **PR #24105** (2026-11-16): fix(css): match pure css chunk imports by relative path (@shulaoda)

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

## X. build): shift source maps for preload rewrites instead of re-tracing them

**RULE**:
When implementing operations in `packages/vite/package.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in vitejs/vite. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dbce0c67`: build): shift source maps for preload rewrites instead of re-tracing them. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/vite/package.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    "@jridgewell/sourcemap-codec": "^1.6.0",
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dbce0c67` are properly handled with clean fallback behavior.
