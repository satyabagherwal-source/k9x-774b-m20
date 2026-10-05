# Forensic Learning Record (Deep Inspection): tamagui/tamagui

> **Canonical Artifact**: `07_PROJECT_LEARNING/tamagui-tamagui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tamagui/tamagui](https://github.com/tamagui/tamagui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:22:54.569Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tamagui/tamagui`
- **Description**: Style React fast with 100% parity on React Native, an optional UI kit, and optimizing compiler.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 14212 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `code/compiler/static-worker/src/index.ts`
```
/**
 * @tamagui/static-worker
 *
 * Pure worker-based API for Tamagui static extraction.
 * All operations run in a worker thread for better performance and isolation.
 *
 * This package provides a clean async API that wraps @tamagui/static's worker
 * implementation without exposing any sync/legacy APIs.
 */

import type { TamaguiOptions } from '@tamagui/types'
import { fileURLToPath } from 'node:url'
import Piscina from 'piscina'

export type { ExtractedResponse, TamaguiProjectInfo } from '@tamagui/static'
export type { TamaguiOptions } from '@tamagui/types'

export const getPragmaOptions = async (props: { source: string; path: string }) => {
  const { default: Static } = await import('@tamagui/static')
  return Static.getPragmaOptions(props)
}

// Resolve worker path - works for both CJS and ESM
const getWorkerPath = () => {
  // Piscina needs the actual file path, not the module resolution
  // Use the CommonJS .js version which works for piscina
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    const workerPath = fileURLToPath(import.meta.resolve('@tamagui/static/worker'))
    // Replace .mjs with .js for CommonJS compatibility
    return workerPath.replace(/\.mjs$/, '.js')
  }

  // Fallback for CJS
  return require.resolve('@tamagui/static/worker').replace(/\.mjs$/, '.js')
}

// Use globalThis to share pool across module instances (Vite environments)
const POOL_KEY = '__tamagui_piscina_pool__'
const CLOSING_KEY = '__tamagui_piscina_closing__'
const TASK_COUNT_KEY = '__tamagui_piscina_task_count__'
const RECYCLING_KEY = '__tamagui_piscina_recycling__'

// recycle worker after this many tasks to prevent RSS bloat from V8 memory fragmentation
// Node.js worker threads don't release memory properly - see https://github.com/nodejs/node/issues/51868
// set high enough that builds (typically 200-400 files) never trigger a recycle,
// but long-running dev servers still get memory relief eventually
const MAX_TASKS_BEFORE_RECYCLE = 1000

function getSharedPool(): Piscina | null {
  return (globalThis as any)[POOL_KEY] ?? null
}

function setSharedPool(pool: Piscina | null) {
  ;(globalThis as any)[POOL_KEY] = pool
}

function isClosing(): boolean {
  return (globalThis as any)[CLOSING_KEY] === true
}

function setClosing(value: boolean) {
  ;(globalThis as any)[CLOSING_KEY] = value
}

function isRecycling(): boolean {
  return (globalThis as any)[RECYCLING_KEY] === true
}

function setRecycling(value: boolean) {
  ;(globalThis as any)[RECYCLING_KEY] = value
}

function getTaskCount(): number {
  return (globalThis as any)[TASK_COUNT_KEY] ?? 0
}

function incrementTaskCount(): number {
  const count = getTaskCount() + 1
  ;(globalThis as any)[TASK_COUNT_KEY] = count
  return count
}

function resetTaskCount() {
  ;(globalThis as any)[TASK_COUNT_KEY] = 0
}

/**
 * Create a new Piscina pool instance
 */
function createPool(): Piscina {
  const pool = new Piscina({
    filename: getWorkerPath(),
    // each worker loads and caches config independently
    minThreads: 2,
    maxThreads: 2,
    // Never terminate due to idle - worker stays alive until close() or process exit
    // This prevents "Terminating worker thread" errors from Piscina during idle
    idleTimeout: Number.POSITIVE_INFINITY,
    // no resourceLimits - we rely on task-based recycling instead
    // V8 resourceLimits cause "Terminating worker thread" messages when hit
  })

  // Handle error events to prevent uncaught exceptions during pool destruction
  pool.on('error', (err) => {
    if (isClosing() || isRecycling()) return
    const message =
      err && typeof err === 'object' && 'message' in err ? String(err.message) : ''
    // Suppress termination errors (can still occur during explicit close/destroy)
    if (message.includes('Terminating worker thread')) return
    console.error('[tamagui] Worker pool error:', err)
  })

  return pool
}

/**
 * Get or create the Piscina worker pool
 */
function getPool(): Piscina {
  let pool = getSharedPool()
  if (!pool) {
    pool = createPool()
    setSharedPool(pool)
  }
  return pool
}

/**
 * Load Tamagui configuration in worker
 * Sends a warmup task to trigger config loading
 * bundleConfig auto-detects if files exist and skips rebuild
 */
export async function loadTamagui(options: Partial<TamaguiOptions>): Promise<any> {
  const pool = getPool()

  // use extractToClassNames with a dummy request to trigger config loading
  // the worker will cache the config for subsequent requests
  const task = {
    type: 'extractToClassNames',
    source: '// dummy',
    sourcePath: '__dummy__.tsx',
    options: {
      components: ['tamagui'],
      ...options,
    },
    shouldPrintDebug: false,
  }

  try {
    await pool.run(task, { name: 'runTask' })
    return { success: true }
  } catch (error) {
    console.error('[static-worker] Error loading Tamagui config:', error)
    throw error
  }
}

/**
 * Recycle the worker pool to release RSS memory
 * Creates new pool, swaps immediately, then destroys old pool
 * V8 doesn't return memory to OS, so we need to restart the worker periodically
 */
async function recyclePool(options: TamaguiOptions): Promise<void> {
  if (isClosing() || isRecycling()) return

  const oldPool = getSharedPool()
  if (!oldPool) return

  setRecycling(true)

  const start = Date.now()

  try {
    // suppress "Terminating worker thread" messages during recycle
    const originalStderr = process.stderr.write.bind(process.stderr)
    const originalStdout = process.stdout.write.bind(process.stdout)
    const filter = (chunk: any, ...args: any[]) => {
      const str = typeof chunk === 'string' ? chunk : chunk?.toString?.() || ''
      if (str.includes('Terminating worker thread')) return true
      return false
    }
    process.stderr.write = ((chunk: any, ...args: any[]) => {
      if (filter(chunk)) return true
      return originalStderr(chunk, ...args)
    }) as any
    process.stdout.write = ((chunk: any, ...args: any[]) => {
      if (filter(chunk)) return true
      return originalStdout(chunk, ...args)
    }) as any

    // create new pool and swap immediately
    const newPool = createPool()
    setSharedPool(newPool)

    // warm up new pool with config (this caches it in the new worker)
    const warmupTask = {
      type: 'extractToClassNames',
      source: '// warmup',
      sourcePath: '__warmup__.tsx',
      options: {
        ...options,
        // skip the "built config" log on warmup since it's a recycle
        _skipBuildLog: true,
      },
      shouldPrintDebug: false,
    }

    await newPool.run(warmupTask, { name: 'runTask' })

    // destroy old pool - pending tasks will be rejected
    oldPool.removeAllListeners()
    oldPool.destroy().catch(() => {})

    // restore stderr/stdout after a delay
    setTimeout(() => {
      process.stderr.write = originalStderr
      process.stdout.write = originalStdout
    })

    console.log(`  ♻️  [tamagui] recycled worker pool (${Date.now() - start}ms)`)
  } finally {
    setRecycling(false)
  }
}

/**
 * Load Tamagui build configuration asynchronously
 * Uses esbuild-wasm to avoid EPIPE errors from native esbuild service lifecycle
 */
export async function loadTamaguiBuildConfig(
  tamaguiOptions: Partial<TamaguiOptions> | undefined
): Promise<TamaguiOptions> {
  const { default: Static } = await import('@tamagui/static')

  return Static.loadTamaguiBuildConfigAsync(tamaguiOptions)
}

/**
 * Extract Tamagui components to className-based CSS for web
 */
export async function extractToClassNames(params: {
  source: string | Buffer
  sourcePath?: string
  options: TamaguiOptions
  shouldPrintDebug?: boolean | 'verbose'
}): Promise<any> {
  const { source, sourcePath = '', options, shouldPrintDebug = false } = params

  if (typeof source !== 'string') {
    throw new Error('`source` must be a string of javascript')
  }

  const task = {
    type: 'extractToClassNames',
    source,
    sourcePath,
    options,
    shouldPrintDebug,
  }

  const pool = getPool()
  const result = (await pool.run(task, { name: 'runTask' })) as any

  if (!result.success) {
    const errorMessage = [
      `[tamagui-extract] Error processing file: ${sourcePath || '(unknown)'}`,
      ``,
      result.error,
      result.stack ? `\n${result.stack}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    throw new Error(errorMessage)
  }

  // check if we need to recycle the worker to prevent RSS bloat
  const count = incrementTaskCount()
  if (count >= MAX_TASKS_BEFORE_RECYCLE) {
    resetTaskCount()
    // recycle asynchronously with hot-swap to not block current request
    recyclePool(options).catch(() => {})
  }

  return result.data
}

/**
 * Extract Tamagui components to React Native StyleSheet format
 */
export async function extractToNative(
  sourceFileName: string,
  sourceCode: string,
  options: TamaguiOptions
): Promise<any> {
  const task = {
    type: 'extractToNative',
    sourceFileName,
    sourceCode,
    options,
  }

  const pool = getPool()
  const result = (await pool.run(task, { name: 'runTask' })) as any

  if (!result.success) {
    const errorMessage = [
      `[tamagui-extract] Error processing file: ${sourceFileName || '(unknown)'}`,
      ``,
      result.error,
      result.stack ? `\n${result.stack}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    throw new Error(errorMessage)
  }

  // check if we need to recycle the worker to prevent RSS bloat
  const count = incrementTaskCount()
  if (count >= MAX_TASKS_BEFORE_RECYCLE) {
    resetTaskCount()
    // recycle asynchronously with hot-swap to not block current request
    recyclePool(options).catch(() => {})
  }

  return result.data
}

/**
 * Watch Tamagui config for changes and reload when it changes
 */
export async function watchTamaguiConfig(
  options: TamaguiOptions
): Promise<{ dispose: () => void } | undefined> {
  // For now, we'll use the static package's watcher directly
  // This could be improved to use worker-based watching
```

### Core Architecture Module: `code/compiler/static-worker/types/index.d.ts`
```
/**
 * @tamagui/static-worker
 *
 * Pure worker-based API for Tamagui static extraction.
 * All operations run in a worker thread for better performance and isolation.
 *
 * This package provides a clean async API that wraps @tamagui/static's worker
 * implementation without exposing any sync/legacy APIs.
 */
import type { TamaguiOptions } from '@tamagui/types';
export type { ExtractedResponse, TamaguiProjectInfo } from '@tamagui/static';
export type { TamaguiOptions } from '@tamagui/types';
export declare const getPragmaOptions: (props: {
    source: string;
    path: string;
}) => Promise<{
    shouldPrintDebug: boolean | "verbose";
    shouldDisable: boolean;
}>;
/**
 * Load Tamagui configuration in worker
 * Sends a warmup task to trigger config loading
 * bundleConfig auto-detects if files exist and skips rebuild
 */
export declare function loadTamagui(options: Partial<TamaguiOptions>): Promise<any>;
/**
 * Load Tamagui build configuration asynchronously
 * Uses esbuild-wasm to avoid EPIPE errors from native esbuild service lifecycle
 */
export declare function loadTamaguiBuildConfig(tamaguiOptions: Partial<TamaguiOptions> | undefined): Promise<TamaguiOptions>;
/**
 * Extract Tamagui components to className-based CSS for web
 */
export declare function extractToClassNames(params: {
    source: string | Buffer;
    sourcePath?: string;
    options: TamaguiOptions;
    shouldPrintDebug?: boolean | 'verbose';
}): Promise<any>;
/**
 * Extract Tamagui components to React Native StyleSheet format
 */
export declare function extractToNative(sourceFileName: string, sourceCode: string, options: TamaguiOptions): Promise<any>;
/**
 * Watch Tamagui config for changes and reload when it changes
 */
export declare function watchTamaguiConfig(options: TamaguiOptions): Promise<{
    dispose: () => void;
} | undefined>;
/**
 * Clear the worker's config cache
 * Call this when config files change
 */
export declare function clearWorkerCache(): Promise<void>;
/**
 * Clean up the worker pool on exit
 * Should be called when the build process completes
 */
export declare function destroyPool(): Promise<void>;
/**
 * Get pool statistics for debugging
 */
export declare function getPoolStats(): {
    threads: number;
    queueSize: number;
    completed: number;
    duration: number;
    utilization: number;
} | null;
//# sourceMappingURL=index.d.ts.map
```

### Core Architecture Module: `code/compiler/static/src/extractor/removeUnusedHooks.ts`
```
import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'

const hooks = {
  useMedia: true,
  useTheme: true,
}

export function removeUnusedHooks(
  compFn: NodePath<any>,
  shouldPrintDebug: boolean | 'verbose'
) {
  compFn.scope.crawl()
  // check the top level statements
  let bodyStatements = compFn?.get('body')
  if (!bodyStatements) {
    console.info('no body statemnts?', compFn)
    return
  }
  if (!Array.isArray(bodyStatements)) {
    if (bodyStatements.isFunctionExpression()) {
      bodyStatements = bodyStatements.scope.path.get('body')
    } else {
      bodyStatements = bodyStatements.get('body')
    }
  }
  if (!bodyStatements || !Array.isArray(bodyStatements)) {
    return
  }
  const statements = bodyStatements as NodePath<any>[]
  for (const statement of statements) {
    if (!statement.isVariableDeclaration()) {
      continue
    }
    const declarations = statement.get('declarations')
    if (!Array.isArray(declarations)) {
      continue
    }
    const isBindingReferenced = (name: string) => {
      return !!statement.scope.getBinding(name)?.referenced
    }
    for (const declarator of declarations) {
      const id = declarator.get('id')
      const init = declarator.node.init
      if (Array.isArray(id) || Array.isArray(init)) {
        continue
      }
      const shouldRemove = (() => {
        const isHook =
          init &&
          t.isCallExpression(init) &&
          t.isIdentifier(init.callee) &&
          hooks[init.callee.name]
        if (!isHook) {
          return false
        }
        if (t.isIdentifier(id.node)) {
          // remove "const media = useMedia()"
          const name = id.node.name
          return !isBindingReferenced(name)
        }
        if (t.isObjectPattern(id.node)) {
          // remove "const { sm } = useMedia()"
          const propPaths = id.get('properties') as NodePath<any>[]
          return propPaths.every((prop) => {
            if (!prop.isObjectProperty()) return false
            const value = prop.get('value')
            if (Array.isArray(value) || !value.isIdentifier()) return false
            const name = value.node.name
            return !isBindingReferenced(name)
          })
        }
        return false
      })()
      if (shouldRemove) {
        declarator.remove()
        if (shouldPrintDebug) {
          console.info(`  [🪝] removed ${id.node['name'] ?? ''}`)
        }
      }
    }
  }
}

```

### Core Architecture Module: `code/compiler/static/src/helpers/requireTamaguiCore.ts`
```
// this allows us to swap between core native and web in the same process:

import type { TamaguiPlatform } from '../types'

export function requireTamaguiCore(
  platform: TamaguiPlatform,
  ogRequire: Function = require
): typeof import('@tamagui/core') {
  if (!platform) {
    throw new Error(`No platform given to requireTamaguiCore`)
  }

  // avoid tree shaking out themes
  const og1 = process.env.TAMAGUI_IS_SERVER
  const og2 = process.env.TAMAGUI_KEEP_THEMES
  process.env.TAMAGUI_IS_SERVER ||= '1'
  process.env.TAMAGUI_KEEP_THEMES ||= '1'

  const exported = ogRequire(
    platform === 'native' ? '@tamagui/core/native' : '@tamagui/core'
  )

  // restore back
  process.env.TAMAGUI_IS_SERVER = og1
  process.env.TAMAGUI_KEEP_THEMES = og2

  return exported
}

```

### Core Architecture Module: `code/compiler/static/src/worker.ts`
```
/**
 * Worker thread implementation for Tamagui extraction
 * Used by both piscina (async) and synckit (sync for babel)
 */

import type { BabelFileResult } from '@babel/core'
import { createExtractor } from './extractor/createExtractor'
import type { ExtractedResponse } from './extractor/extractToClassNames'
import { extractToClassNames as extractToClassNamesImpl } from './extractor/extractToClassNames'
import { extractToNative as extractToNativeImpl } from './extractor/extractToNative'
import type { TamaguiOptions } from './types'

// Create extractors lazily to avoid loading unused ones
let webExtractor: ReturnType<typeof createExtractor> | null = null
let nativeExtractor: ReturnType<typeof createExtractor> | null = null

function getWebExtractor() {
  if (!webExtractor) {
    webExtractor = createExtractor({ platform: 'web' })
  }
  return webExtractor
}

function getNativeExtractor() {
  if (!nativeExtractor) {
    nativeExtractor = createExtractor({ platform: 'native' })
  }
  return nativeExtractor
}

// Cache config loading to avoid reloading
const configCache: Map<string, Promise<any>> = new Map()

export interface ExtractToClassNamesTask {
  type: 'extractToClassNames'
  source: string
  sourcePath: string
  options: TamaguiOptions
  shouldPrintDebug: boolean | 'verbose'
}

export interface ExtractToNativeTask {
  type: 'extractToNative'
  sourceFileName: string
  sourceCode: string
  options: TamaguiOptions
}

export interface ClearCacheTask {
  type: 'clearCache'
}

export type WorkerTask = ExtractToClassNamesTask | ExtractToNativeTask | ClearCacheTask

export type WorkerResult =
  | { success: true; data: ExtractedResponse | null }
  | { success: true; data: BabelFileResult }
  | { success: false; error: string; stack?: string }

/**
 * Main worker function that handles both extraction types
 * This is called by piscina for async usage
 */
export async function runTask(task: WorkerTask): Promise<WorkerResult> {
  try {
    if (task.type === 'extractToClassNames') {
      // Load web config if needed (with caching)
      // only skip if both extraction AND debug attrs are disabled (fully disabled)
      const isFullyDisabled =
        task.options.disableExtraction && task.options.disableDebugAttr
      if (!isFullyDisabled && !task.options['_disableLoadTamagui']) {
        const cacheKey = JSON.stringify({
          config: task.options.config,
          components: task.options.components,
        })

        if (!configCache.has(cacheKey)) {
          configCache.set(cacheKey, getWebExtractor().loadTamagui(task.options))
        }

        await configCache.get(cacheKey)
      }

      const result = await extractToClassNamesImpl({
        extractor: getWebExtractor(),
        source: task.source,
        sourcePath: task.sourcePath,
        options: task.options,
        shouldPrintDebug: task.shouldPrintDebug,
      })

      return { success: true, data: result }
    }

    if (task.type === 'extractToNative') {
      // Load native config if needed (with caching)
      const cacheKey = JSON.stringify({
        config: task.options.config,
        components: task.options.components,
      })

      if (!configCache.has(cacheKey)) {
        configCache.set(cacheKey, getNativeExtractor().loadTamagui(task.options))
      }

      await configCache.get(cacheKey)

      // extractToNative uses its own module-level extractor
      // This is for babel plugin which uses visitor pattern
      const result = extractToNativeImpl(
        task.sourceFileName,
        task.sourceCode,
        task.options
      )

      return { success: true, data: result }
    }

    if (task.type === 'clearCache') {
      // Clear config caches when files change
      configCache.clear()
      return { success: true, data: null }
    }

    return {
      success: false,
      error: `Unknown task type: ${(task as any).type}`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }
  }
}

/**
 * For synckit compatibility - exports the runTask as default
 * Synckit will call this function synchronously using worker threads
 */
export default runTask

```

### Core Architecture Module: `code/compiler/static/types/extractor/removeUnusedHooks.d.ts`
```
import type { NodePath } from '@babel/traverse';
export declare function removeUnusedHooks(compFn: NodePath<any>, shouldPrintDebug: boolean | 'verbose'): void;
//# sourceMappingURL=removeUnusedHooks.d.ts.map
```

### Core Architecture Module: `code/compiler/static/types/helpers/requireTamaguiCore.d.ts`
```
import type { TamaguiPlatform } from '../types';
export declare function requireTamaguiCore(platform: TamaguiPlatform, ogRequire?: Function): typeof import('@tamagui/core');
//# sourceMappingURL=requireTamaguiCore.d.ts.map
```

### Core Architecture Module: `code/compiler/static/types/worker.d.ts`
```
/**
 * Worker thread implementation for Tamagui extraction
 * Used by both piscina (async) and synckit (sync for babel)
 */
import type { BabelFileResult } from '@babel/core';
import type { ExtractedResponse } from './extractor/extractToClassNames';
import type { TamaguiOptions } from './types';
export interface ExtractToClassNamesTask {
    type: 'extractToClassNames';
    source: string;
    sourcePath: string;
    options: TamaguiOptions;
    shouldPrintDebug: boolean | 'verbose';
}
export interface ExtractToNativeTask {
    type: 'extractToNative';
    sourceFileName: string;
    sourceCode: string;
    options: TamaguiOptions;
}
export interface ClearCacheTask {
    type: 'clearCache';
}
export type WorkerTask = ExtractToClassNamesTask | ExtractToNativeTask | ClearCacheTask;
export type WorkerResult = {
    success: true;
    data: ExtractedResponse | null;
} | {
    success: true;
    data: BabelFileResult;
} | {
    success: false;
    error: string;
    stack?: string;
};
/**
 * Main worker function that handles both extraction types
 * This is called by piscina for async usage
 */
export declare function runTask(task: WorkerTask): Promise<WorkerResult>;
/**
 * For synckit compatibility - exports the runTask as default
 * Synckit will call this function synchronously using worker threads
 */
export default runTask;
//# sourceMappingURL=worker.d.ts.map
```

### Core Architecture Module: `code/core/animation-helpers/src/index.ts`
```
export {
  normalizeTransition,
  getAnimationForProperty,
  hasAnimation,
  getAnimatedProperties,
  getEffectiveAnimation,
  getAnimationConfigsForKeys,
} from './normalizeTransition'

export type { AnimationConfig, NormalizedTransition, TransitionPropInput } from './types'

```

### Core Architecture Module: `code/core/animation-helpers/src/normalizeTransition.ts`
```
import type {
  AnimationConfig,
  NormalizedTransition,
  SpringConfig,
  TransitionPropInput,
} from './types'

const SPRING_CONFIG_KEYS: Set<string> = new Set([
  'stiffness',
  'damping',
  'mass',
  'tension',
  'friction',
  'velocity',
  'overshootClamping',
  'duration',
  'bounciness',
  'speed',
])

/**
 * Check if a key is a spring config parameter
 */
function isSpringConfigKey(key: string): key is keyof SpringConfig {
  return SPRING_CONFIG_KEYS.has(key)
}

/**
 * Normalizes the various transition prop formats into a consistent structure.
 *
 * Supported input formats:
 * - String: "bouncy" -> { default: "bouncy", enter: null, exit: null, properties: {} }
 * - Object: { x: 'quick', default: 'slow' } -> { default: "slow", enter: null, exit: null, properties: { x: "quick" } }
 * - Object with enter/exit: { enter: 'bouncy', exit: 'quick' } -> { default: null, enter: "bouncy", exit: "quick", properties: {} }
 * - Array: ['bouncy', { delay: 100, x: 'quick' }] -> { default: "bouncy", enter: null, exit: null, delay: 100, properties: { x: "quick" } }
 *
 * @param transition - The transition prop value in any supported format
 * @returns Normalized transition object with consistent structure
 */
export function normalizeTransition(
  transition: TransitionPropInput
): NormalizedTransition {
  // Handle null/undefined
  if (!transition) {
    return {
      default: null,
      enter: null,
      exit: null,
      delay: undefined,
      properties: {},
    }
  }

  // String format: "bouncy"
  if (typeof transition === 'string') {
    return {
      default: transition,
      enter: null,
      exit: null,
      delay: undefined,
      properties: {},
    }
  }

  // Array format: ['bouncy', { delay: 100, x: 'quick', enter: 'slow', exit: 'fast' }]
  // Also supports spring config overrides: ['bouncy', { stiffness: 1000, damping: 70 }]
  if (Array.isArray(transition)) {
    const [defaultAnimation, configObj] = transition
    const properties: Record<string, string | AnimationConfig> = {}
    const springConfig: SpringConfig = {}
    let delay: number | undefined
    let enter: string | null = null
    let exit: string | null = null

    if (configObj && typeof configObj === 'object') {
      for (const [key, value] of Object.entries(configObj)) {
        if (key === 'delay' && typeof value === 'number') {
          delay = value
        } else if (key === 'enter' && typeof value === 'string') {
          enter = value
        } else if (key === 'exit' && typeof value === 'string') {
          exit = value
        } else if (isSpringConfigKey(key) && value !== undefined) {
          // Spring config override: { stiffness: 1000, damping: 70 }
          springConfig[key] = value as SpringConfig[keyof SpringConfig]
        } else if (value !== undefined) {
          // Property-specific animation: string or config object
          properties[key] = value as string | AnimationConfig
        }
      }
    }

    return {
      default: defaultAnimation,
      enter,
      exit,
      delay,
      properties,
      config: Object.keys(springConfig).length > 0 ? springConfig : undefined,
    }
  }

  // Object format: { x: 'quick', y: 'bouncy', default: 'slow', enter: 'bouncy', exit: 'quick' }
  // Also supports spring config overrides: { default: 'bouncy', stiffness: 1000 }
  if (typeof transition === 'object') {
    const properties: Record<string, string | AnimationConfig> = {}
    const springConfig: SpringConfig = {}
    let defaultAnimation: string | null = null
    let enter: string | null = null
    let exit: string | null = null
    let delay: number | undefined

    for (const [key, value] of Object.entries(transition)) {
      if (key === 'default' && typeof value === 'string') {
        defaultAnimation = value
      } else if (key === 'enter' && typeof value === 'string') {
        enter = value
      } else if (key === 'exit' && typeof value === 'string') {
        exit = value
      } else if (key === 'delay' && typeof value === 'number') {
        delay = value
      } else if (isSpringConfigKey(key) && value !== undefined) {
        // Spring config override: { stiffness: 1000, damping: 70 }
        springConfig[key] = value as SpringConfig[keyof SpringConfig]
      } else if (value !== undefined) {
        // Property-specific animation: string or config object
        properties[key] = value as string | AnimationConfig
      }
    }

    return {
      default: defaultAnimation,
      enter,
      exit,
      delay,
      properties,
      config: Object.keys(springConfig).length > 0 ? springConfig : undefined,
    }
  }

  // Fallback
  return {
    default: null,
    enter: null,
    exit: null,
    delay: undefined,
    properties: {},
  }
}

/**
 * Gets the animation key for a specific property from a normalized transition.
 * Falls back to the default animation if no property-specific one is defined.
 *
 * @param normalized - The normalized transition object
 * @param property - The property name to get animation for (e.g., 'x', 'opacity')
 * @returns The animation key/config or null if none defined
 */
export function getAnimationForProperty(
  normalized: NormalizedTransition,
  property: string
): string | AnimationConfig | null {
  // Check for property-specific animation
  const propertyAnimation = normalized.properties[property]
  if (propertyAnimation !== undefined) {
    return propertyAnimation
  }

  // Fall back to default
  return normalized.default
}

/**
 * Checks if the normalized transition has any animations defined.
 */
export function hasAnimation(normalized: NormalizedTransition): boolean {
  return (
    normalized.default !== null ||
    normalized.enter !== null ||
    normalized.exit !== null ||
    Object.keys(normalized.properties).length > 0
  )
}

/**
 * Gets all property names that have specific animations defined.
 * Does not include 'default' in the list.
 */
export function getAnimatedProperties(normalized: NormalizedTransition): string[] {
  return Object.keys(normalized.properties)
}

/**
 * Gets the effective animation key based on the current animation state.
 * Priority: enter/exit specific > default > null
 *
 * @param normalized - The normalized transition object
 * @param state - The animation state: 'enter', 'exit', or 'default'
 * @returns The effective animation key or null
 */
export function getEffectiveAnimation(
  normalized: NormalizedTransition,
  state: 'enter' | 'exit' | 'default'
): string | null {
  if (state === 'enter' && normalized.enter) {
    return normalized.enter
  }
  if (state === 'exit' && normalized.exit) {
    return normalized.exit
  }
  return normalized.default
}

/**
 * Gets the resolved animation config for each key, looking up in animations config.
 * Useful for calculating max duration across all animated properties.
 *
 * @param normalized - The normalized transition object
 * @param animations - The animations config object (driver-specific format)
 * @param keys - Property keys to get animations for
 * @param defaultAnimation - The default animation value to fall back to
 * @returns Map of key -> resolved animation config (or null if not found)
 */
export function getAnimationConfigsForKeys<T>(
  normalized: NormalizedTransition,
  animations: Record<string, T>,
  keys: string[],
  defaultAnimation: T | null
): Map<string, T | null> {
  const result = new Map<string, T | null>()

  for (const key of keys) {
    const propAnimation = normalized.properties[key]
    let animationValue: T | null = null

    if (typeof propAnimation === 'string') {
      animationValue = animations[propAnimation] ?? null
    } else if (
      propAnimation &&
      typeof propAnimation === 'object' &&
      (propAnimation as any).type
    ) {
      animationValue = animations[(propAnimation as any).type] ?? null
    }

    // fall back to default if no per-property config found
    if (animationValue === null) {
      animationValue = defaultAnimation
    }

    result.set(key, animationValue)
  }

  return result
}

```

### Core Architecture Module: `code/core/animation-helpers/src/types.ts`
```
/**
 * Animation configuration that can include additional properties
 * like delay, duration, stiffness, damping, etc.
 */
export type AnimationConfig = {
  type?: string
  [key: string]: any
}

/**
 * Input format for the transition prop - supports multiple syntaxes:
 *
 * 1. String: "bouncy"
 * 2. Object with property mappings: { x: 'quick', y: 'bouncy', default: 'slow' }
 * 3. Array with config: ['bouncy', { delay: 100, x: 'quick' }]
 * 4. Object with enter/exit: { enter: 'bouncy', exit: 'quick', default: 'slow' }
 *
 * Note: Uses `any` to be compatible with the TransitionProp type from @tamagui/web
 * which has more complex union types.
 */
export type TransitionPropInput = any

/**
 * Spring configuration parameters that can override preset defaults.
 * These are the common parameters across animation drivers.
 */
export type SpringConfig = {
  stiffness?: number
  damping?: number
  mass?: number
  tension?: number
  friction?: number
  velocity?: number
  overshootClamping?: boolean
  duration?: number
  bounciness?: number
  speed?: number
}

/**
 * Normalized output format that all animation drivers consume.
 * Provides a consistent structure regardless of input format.
 */
export type NormalizedTransition = {
  /** Default animation key for properties not explicitly listed */
  default: string | null
  /** Animation key to use during enter transitions (mount) */
  enter: string | null
  /** Animation key to use during exit transitions (unmount) */
  exit: string | null
  /** Global delay in ms */
  delay: number | undefined
  /** Per-property animation configs: propertyName -> animationKey or config */
  properties: Record<string, string | AnimationConfig>
  /** Global spring config overrides that merge with the preset defaults */
  config?: SpringConfig
}

```

### Core Architecture Module: `code/core/animation-helpers/types/index.d.ts`
```
export { normalizeTransition, getAnimationForProperty, hasAnimation, getAnimatedProperties, getEffectiveAnimation, getAnimationConfigsForKeys } from "./normalizeTransition";
export type { AnimationConfig, NormalizedTransition, TransitionPropInput } from "./types";

//# sourceMappingURL=index.d.ts.map
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3426** (2025-05-25): **Docs - menu button does not work on mobile**
  *Symptoms*: ### Current Behavior  When pressing the hamburger/menu button , no menu is displayed.  ### Expected Behavior  A menu with contents is displayed.  ### Tamagui Version  ```markdown Na?  Unless docs is made with Tamagui ```  ### Platform (Web, iOS, Android)  ```markdown Na? ```  ### Reproduction  ```markdown 1. On an iOS device navigate to https://tamagui.dev/docs/intro/introduction 2. Press the menu button   Device: iPhone 15+ iOS version: 18.4.1 Browser: Safari, Edge ```  ### System Info  ```markdown  ```
  **Post-Mortem & Fix Analysis**:
  > @krcourville Thank your feedback. I will take a look in this PR: https://github.com/tamagui/tamagui/pull/3430

- **Issue #2580** (2024-04-30): **Switch & Switch.Thumb Animation Bug on React Native**
  *Symptoms*: ### Current Behavior  When we try to use animation property on Switch component it does not apply to thumb slide action. Using animation property on Slide.Thumb provides a smooth animation and experience with the Switch. But this breaks the checked behavior of the Switch component and thumb always stays in the left on load. Also if the checked value is true by initial, it slips and goes of the Switch area. (Both checked and defaultChecked has same behavior.)  Basic Usage with animation property: (while checked switch bg is red) ![switch1](https://github.com/tamagui/tamagui/assets/52458408/340073f4-6bc9-4019-a550-55d1103c3a51)  Behavior video with animation property: (when checked property is true from any state or storage while Switch.Thumb animation property is set. Switch on the top is default false and bottom is true and first of all red screen means i refreshed the app.) https://github.com/tamagui/tamagui/assets/52458408/e28e7033-7039-4166-ae01-d81d8b85f0c1   Usage without animation property: Then when i remove the animation property from Switch.Thumb (also loses smooth animation 😢) ![switch2](https://github.com/tamagui/tamagui/assets/52458408/a1918b0e-9b95-426d-a292-87d3438dbd60)  Behavior video without animation property: https://github.com/tamagui/tamagui/assets/52458408/2662192d-310c-4ba1-bd84-be5f698a00a6     ### Expected Behavior  I should able to use animation on Switch.Thumb without any issue or Switch animation should pass to Switch.Thu
  **Post-Mortem & Fix Analysis**:
  > there is a fix for this issue on the master branch, which will be available with the next tamagui release

- **Issue #2579** (2024-07-20): **Tamagui Website: Overload Animation Frames - Reanimated**
  *Symptoms*: ### Current Behavior  Website crashes when zooming in and out. Web Inspector points to reanimated creating too many frames which crashes and shows 404 / A problem repeatedly occurred on "https://tamagui.dev"  [tamagui.dev-recording.json](https://github.com/tamagui/tamagui/files/15083918/tamagui.dev-recording.json)    https://github.com/tamagui/tamagui/assets/10137509/ea2365d9-cb43-4f9f-82a5-428f14787f40   ### Platform (Web, iOS, Android)  ```markdown iOS (Safari, Chrome) : iPhone 13 Pro Max Did not test on Android ```   ### Reproduction  ```markdown - Go to Tamagui.dev on iPhone.  - Zoom in all the way then out.  - Website crashes for me ``` 
  **Post-Mortem & Fix Analysis**:
  > wasn't able to re-reproduce on a simulator, I'll check that with a real device 
  > I'm not getting any CPU hikes which I thought was the problem. Sim works fine for me as well
  > Atm the website [https://tamagui.dev/](https://tamagui.dev/) currently renders a little bit slowly for me. It doesn't feel snappy or performant at all. On my linux pc the cpu fan starts to spin up and my cpu processor temp jumps from around 50°C up to 75-80°C while the website is loading and rendering stuff in Firefox. On chromium it feels more performant but still the animations don't feel really smooth. On the windows machine the temperature issue isn't that dramatic (jumps up to 60-70°C). My guess would be that it has to do with the animation elements but I didn't analyze it yet.  Tested on: Firefox 126.0 (64-bit) - Linux (Kernel 6.6.31) ("recommended performance settings" activated)  Chromium 125.0.6422.76 (Official Build) (64-bit) (Chromium has "use graphics acceleration when available" activated) Firefox 126.0 (64-bit) - Windows 10 22H2 ("recommended performance settings" activated)    

- **Issue #2556** (2024-12-31): **(vite-config): repo for resolving vite config issues**
  *Symptoms*: Issues to resolve:  - https://github.com/tamagui/tamagui/issues/2481  - https://github.com/tamagui/tamagui/issues/2482 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #lfCl3d+NLeEU4dM6vqGSLD6adQ46CtglcZP+SNRXr6w=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJzaXRlIiwicm9vdERpcmVjdG9yeSI6bnVsbCwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3RhbWFndWkvc2l0ZS9BSzhQWnZvanNhQ0hlZHNjc2lra0VzRXl2OTNNIiwicHJldmlld1VybCI6InNpdGUtZ2l0LXZpdGUtY29uZmlnLXRlc3QtdGFtYWd1aS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6InNpdGUtZ2l0LXZpdGUtY29uZmlnLXRlc3QtdGFtYWd1aS52ZXJjZWwuYXBwIn19LHsibmFtZSI6InN0dWRpbyIsInJvb3REaXJlY3RvcnkiOiJhcHBzL3N0dWRpbyIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90YW1hZ3VpL3N0dWRpby84bkcyYnZhc1BWa0xBck1DcW93ZW9vVlJpUEpoIiwicHJldmlld1VybCI6InN0dWRpby1naXQtdml0ZS1jb25maWctdGVzdC10YW1hZ3VpLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiUEVORElORyJ9LHsibmFtZSI6InRhbWFndWkiLCJyb290RGlyZWN0b3J5IjoiYXBwcy9pbnRlZ3JhdGlvbiIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS90YW1hZ3VpL3RhbWFndWkvRHF3bk1QS1Z1c0JMcFc5Z25meXlDckVDNlBZ

- **Issue #2553** (2024-05-29): **`onPress` not executed the first time when pressing a `Tabs.Tab`**
  *Symptoms*: ### Current Behavior  When I pass an `onPress` handler for a `Tabs.Tab`, on native it works correctly, but on web I have to press the tab twice before my handler is executed. This applies to each tab in the tabs list. Starting with the second press, the handler is subsequently executed properly.   ### Expected Behavior  _No response_  ### Tamagui Version  ```markdown 1.94.4 ```   ### Platform (Web, iOS, Android)  ```markdown Web ```   ### Reproduction  ```markdown <Tabs.Tab   onPress={() => {     alert("Pressed")   }} >   // ... </Tabs.Tab> ``` ```   ### System Info  _No response_
  **Post-Mortem & Fix Analysis**:
  > ### Diagnosis  Looks like the `onPress` event handler is getting interference from the web-specific behaviors. Specifically, the `onFocus`. My thinking is that if the first click sets the focus but does not immediately trigger the tab selection change. Then the second click, finding the tab already focused, successfully triggers the selection change.  ### Potential Resolution  Could try to adjust the event handling logic to ensure the tab change is triggered on the initial click regardless of the focus state.  [`Tabs.tsx#L247`](https://github.com/tamagui/tamagui/blob/7fffe12a8b25009d9605e401abd0e85d3fc1403d/packages/tabs/src/Tabs.tsx#L247) ```   if (!disabled && !isSelected && webChecks) {     context.onChange(value);      if (!isSelected) {       event.preventDefault();     }   } else {     event.preventDefault();   } ```  ### Notes  - I'm just getting started with Tamagui. I'll give this a try and update soon
  > This seems to have fixed itself. Closing.

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

### Incident Patch 1: `0eb99e3f` (2026-09-24)
**Commit Message**: chore: sync bun.lock with the platform-package build fixture

Team-Machine-Session: r45223

**File**: `bun.lock` (modified, +10/-0)
```diff
@@ -1511,6 +1511,14 @@
         "typescript": "~5.9.2",
       },
     },
+    "code/packages/build/__tests__/fixtures/platform-package": {
+      "name": "tamagui-build-test-platform-package",
+      "version": "1.0.0",
+      "devDependencies": {
+        "@tamagui/build": "workspace:*",
+        "typescript": "~5.9.2",
+      },
+    },
     "code/packages/build/__tests__/fixtures/simple-package": {
       "name": "tamagui-build-test-simple-tpackage",
       "version": "2.0.0-rc.0-1769885482630",
@@ -8344,6 +8352,8 @@
 
     "tamagui-build-test-js-main-package": ["tamagui-build-test-js-main-package@workspace:code/packages/build/__tests__/fixtures/js-main-package"],
 
+    "tamagui-build-test-platform-package": ["tamagui-build-test-platform-package@workspace:code/packages/build/__tests__/fixtures/platform-package"],
+
     "tamagui-build-test-simple-tpackage": ["tamagui-build-test-simple-tpackage@workspace:code/packages/build/__tests__/fixtures/simple-package"],
 
     "tamagui-build-test-watch-package": ["tamagui-build-test-watch-package@workspace:code/packages/build/__tests__/fixtures/watch-package"],
```

---

### Incident Patch 2: `fb7c6b22` (2026-09-24)
**Commit Message**: merge tm/build-platform-files: ship .ios/.android files from tamagui-build

**File**: `code/packages/babel-plugin-fully-specified/__tests__/fixtures/platform-split/Widget.android.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export const Widget = 'android'
```

**File**: `code/packages/babel-plugin-fully-specified/__tests__/fixtures/platform-split/Widget.ios.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export const Widget = 'ios'
```

**File**: `code/packages/babel-plugin-fully-specified/__tests__/fixtures/platform-split/Widget.native.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export const Widget = 'base'
```

**File**: `code/packages/babel-plugin-fully-specified/__tests__/fixtures/platform-split/index.native.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export * from './Widget'
```

**File**: `code/packages/babel-plugin-fully-specified/__tests__/index.test.ts` (modified, +16/-0)
```diff
@@ -145,4 +145,20 @@ describe('transforming actual files', () => {
       ].join('\n')
     )
   })
+
+  test('native output leaves platform-split imports extensionless', () => {
+    const { code } =
+      transformFileSync(
+        path.join(__dirname, 'fixtures', 'platform-split', 'index.native.js'),
+        getTransformOptions({
+          pluginOptions: {
+            ensureFileExists: true,
+            esExtensionDefault: '.native.js',
+            esExtensions: ['.js'],
+          },
+        })
+      ) || {}
+
+    expect(code).toBe(`export * from './Widget';`)
+  })
 })
```

**File**: `code/packages/babel-plugin-fully-specified/permanent/cjs/commonjs.js` (modified, +1/-87)
```diff
@@ -1,88 +1,2 @@
-var __defProp = Object.defineProperty
-var __getOwnPropDesc = Object.getOwnPropertyDescriptor
-var __getOwnPropNames = Object.getOwnPropertyNames
-var __hasOwnProp = Object.prototype.hasOwnProperty
-var __export = (target, all) => {
-    for (var name in all) __defProp(target, name, { get: all[name], enumerable: !0 })
-  },
-  __copyProps = (to, from, except, desc) => {
-    if ((from && typeof from == 'object') || typeof from == 'function')
-      for (let key of __getOwnPropNames(from))
-        !__hasOwnProp.call(to, key) &&
-          key !== except &&
-          __defProp(to, key, {
-            get: () => from[key],
-            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
-          })
-    return to
-  }
-var __toCommonJS = (mod) => __copyProps(__defProp({}, '__esModule', { value: !0 }), mod)
-var commonjs_exports = {}
-__export(commonjs_exports, {
-  default: () => fullySpecifyCommonJS,
-})
-module.exports = __toCommonJS(commonjs_exports)
-var import_node_fs = require('node:fs'),
-  import_node_path = require('node:path')
-function fullySpecifyCommonJS(api, options) {
-  return (
-    api.assertVersion(7),
-    {
-      name: 'babel-plugin-fully-specified-cjs',
-      visitor: {
-        CallExpression(path, state) {
-          if (
-            path.get('callee').isIdentifier({ name: 'require' }) &&
-            path.node.arguments.length === 1
-          ) {
-            const arg = path.node.arguments[0]
-            if (arg.type === 'StringLiteral') {
-              let moduleSpecifier = arg.value
-              if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
-                const filePath = state.file.opts.filename
-                if (!filePath) return
-                const fileDir = (0, import_node_path.dirname)(filePath),
-                  cjsExtension = options.esExtensionDefault || '.cjs',
-                  jsExtension = '.js'
-                if (!(0, import_node_path.extname)(moduleSpecifier)) {
-                  const resolvedPath = (0, import_node_path.resolve)(
-                    fileDir,
-                    moduleSpecifier
-                  )
-                  let newModuleSpecifier = moduleSpecifier
-                  if (isLocalDirectory(resolvedPath)) {
-                    const indexPath = (0, import_node_path.resolve)(
-                      resolvedPath,
-                      'index' + jsExtension
-                    )
-                    if ((0, import_node_fs.existsSync)(indexPath)) {
-                      ;(newModuleSpecifier.endsWith('/') || (newModuleSpecifier += '/'),
-                        (newModuleSpecifier += 'index' + cjsExtension),
-                        (arg.value = newModuleSpecifier))
-                      return
-                    }
-                  }
-                  if (
-                    (0, import_node_fs.existsSync)(resolvedPath + jsExtension) ||
-                    (0, import_node_fs.existsSync)(resolvedPath + cjsExtension)
-                  ) {
-                    ;((newModuleSpecifier += cjsExtension),
-                      (arg.value = newModuleSpecifier))
-                    return
-                  }
-                }
-              }
-            }
-          }
-        },
-      },
-    }
-  )
-}
-function isLocalDirectory(absolutePath) {
-  return (
-    (0, import_node_fs.existsSync)(absolutePath) &&
-    (0, import_node_fs.lstatSync)(absolutePath).isDirectory()
-  )
-}
+"use strict";var d=Object.defineProperty;var b=Object.getOwnPropertyDescriptor;var v=Object.getOwnPropertyNames;var S=Object.prototype.hasOwnProperty;var h=(e,i)=>{for(var n in i)d(e,n,{get:i[n],enumerable:!0})},D=(e,i,n,c)=>{if(i&&typeof i=="object"||typeof i=="function")for(let o of v(i))!S.call(e,o)&&o!==n&&d(e,o,{get:()=>i[o],enumerable:!(c=b(i,o))||c.enumerable});return e};var E=e=>D(d({},"__esModule",{value:!0}),e);var P={};h(P,{default:()=>j});module.exports=E(P);var t=require("node:fs"),s=require("node:path");function j(e,i){return e.assertVersion(7),{name:"babel-plugin-fully-specified-cjs",visitor:{CallExpression(n,c){if(n.get("callee").isIdentifier({name:"require"})&&n.node.arguments.length===1){let u=n.node.arguments[0];if(u.type==="StringLiteral"){let a=u.value;if(a.startsWith(".")||a.startsWith("/")){let m=c.file.opts.filename;if(!m)return;let p=(0,s.dirname)(m),f=i.esExtensionDefault||".cjs",x=".js";if(!(0,s.extname)(a)){let r=(0,s.resolve)(p,a),l=a;if(f.startsWith(".native")&&((0,t.existsSync)(`${r}.ios.js`)||(0,t.existsSync)(`${r}.android.js`)))return;if(W(r)){let g=(0,s.resolve)(r,"index");if(f.startsWith(".native")&&((0,t.existsSync)(`${g}.ios.js`)||(0,t.existsSync)(`${g}.android.js`)))return;let y=(0,s.resolve)(r,"index"+x);if((0,t.existsSync)(y)){l.endsWith("/")||(l+="/"),l+="index"+f,u.value=l;return}}if((0,t.existsSync)(r+x)||(0,t.existsSync)(r+f)){l+=f,u.value=l;return}}}}}}}}}function W(e){return(0,t.existsSync)(e)&&(0,t.lstatSync)(e).isDirectory()}
 //
```

**File**: `code/packages/babel-plugin-fully-specified/permanent/cjs/commonjs.js.map` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "version": 3,
   "sources": ["../../src/commonjs.ts"],
-  "mappings": ";;;;;;;;;;;;;;AAAA;AAAA;AAAA;AAAA;AAAA;AAAA,qBAAsC,oBACtC,mBAA0C;AAE3B,SAAR,qBACL,KACA,SAGiB;AACjB,aAAI,cAAc,CAAC,GAEZ;AAAA,IACL,MAAM;AAAA,IACN,SAAS;AAAA,MACP,eAAe,MAAM,OAAO;AAG1B,YAFe,KAAK,IAAI,QAAQ,EAGvB,aAAa,EAAE,MAAM,UAAU,CAAC,KACvC,KAAK,KAAK,UAAU,WAAW,GAC/B;AACA,gBAAM,MAAM,KAAK,KAAK,UAAU,CAAC;AACjC,cAAI,IAAI,SAAS,iBAAiB;AAChC,gBAAI,kBAAkB,IAAI;AAG1B,gBAAI,gBAAgB,WAAW,GAAG,KAAK,gBAAgB,WAAW,GAAG,GAAG;AACtE,oBAAM,WAAW,MAAM,KAAK,KAAK;AACjC,kBAAI,CAAC,SAAU;AAEf,oBAAM,cAAU,0BAAQ,QAAQ,GAC1B,eAAe,QAAQ,sBAAsB,QAC7C,cAAc;AAGpB,kBAAI,KAAC,0BAAQ,eAAe,GAAG;AAC7B,sBAAM,mBAAe,0BAAQ,SAAS,eAAe;AACrD,oBAAI,qBAAqB;AAGzB,oBAAI,iBAAiB,YAAY,GAAG;AAClC,wBAAM,gBAAY,0BAAQ,cAAc,UAAU,WAAW;AAC7D,0BAAI,2BAAW,SAAS,GAAG;AAEzB,oBAAK,mBAAmB,SAAS,GAAG,MAClC,sBAAsB,MAExB,sBAAsB,UAAU,cAChC,IAAI,QAAQ;AACZ;AAAA,kBACF;AAAA,gBACF;AAGA,sBAAM,iBAAiB,eAAe;AACtC,wBAAI,2BAAW,cAAc,GAAG;AAC9B,wCAAsB,cACtB,IAAI,QAAQ;AACZ;AAAA,gBACF;AAAA,cACF;AAAA,YACF;AAAA,UACF;AAAA,QACF;AAAA,MACF;AAAA,IACF;AAAA,EACF;AACF;AAEA,SAAS,iBAAiB,cAA+B;AACvD,aAAO,2BAAW,YAAY,SAAK,0BAAU,YAAY,EAAE,YAAY;AACzE;",
-  "names": []
+  "mappings": "yaAAA,IAAAA,EAAA,GAAAC,EAAAD,EAAA,aAAAE,IAAA,eAAAC,EAAAH,GAAA,IAAAI,EAAsC,mBACtCC,EAA0C,qBAE3B,SAARH,EACLI,EACAC,EAGiB,CACjB,OAAAD,EAAI,cAAc,CAAC,EAEZ,CACL,KAAM,mCACN,QAAS,CACP,eAAeE,EAAMC,EAAO,CAG1B,GAFeD,EAAK,IAAI,QAAQ,EAGvB,aAAa,CAAE,KAAM,SAAU,CAAC,GACvCA,EAAK,KAAK,UAAU,SAAW,EAC/B,CACA,IAAME,EAAMF,EAAK,KAAK,UAAU,CAAC,EACjC,GAAIE,EAAI,OAAS,gBAAiB,CAChC,IAAIC,EAAkBD,EAAI,MAG1B,GAAIC,EAAgB,WAAW,GAAG,GAAKA,EAAgB,WAAW,GAAG,EAAG,CACtE,IAAMC,EAAWH,EAAM,KAAK,KAAK,SACjC,GAAI,CAACG,EAAU,OAEf,IAAMC,KAAU,WAAQD,CAAQ,EAC1BE,EAAeP,EAAQ,oBAAsB,OAC7CQ,EAAc,MAGpB,GAAI,IAAC,WAAQJ,CAAe,EAAG,CAC7B,IAAMK,KAAe,WAAQH,EAASF,CAAe,EACjDM,EAAqBN,EAIzB,GACEG,EAAa,WAAW,SAAS,OAChC,cAAW,GAAGE,CAAY,SAAS,MAClC,cAAW,GAAGA,CAAY,aAAa,GAEzC,OAIF,GAAIE,EAAiBF,CAAY,EAAG,CAClC,IAAMG,KAAY,WAAQH,EAAc,OAAO,EAC/C,GACEF,EAAa,WAAW,SAAS,OAChC,cAAW,GAAGK,CAAS,SAAS,MAC/B,cAAW,GAAGA,CAAS,aAAa,GAEtC,OAEF,IAAMC,KAAY,WAAQJ,EAAc,QAAUD,CAAW,EAC7D,MAAI,cAAWK,CAAS,EAAG,CAEpBH,EAAmB,SAAS,GAAG,IAClCA,GAAsB,KAExBA,GAAsB,QAAUH,EAChCJ,EAAI,MAAQO,EACZ,MACF,CACF,CAGA,MACE,cAAWD,EAAeD,CAAW,MACrC,cAAWC,EAAeF,CAAY,EACtC,CACAG,GAAsBH,EACtBJ,EAAI,MAAQO,EACZ,MACF,CACF,CACF,CACF,CACF,CACF,CACF,CACF,CACF,CAEA,SAASC,EAAiBG,EAA+B,CACvD,SAAO,cAAWA,CAAY,MAAK,aAAUA,CAAY,EAAE,YAAY,CACzE",
+  "names": ["commonjs_exports", "__export", "fullySpecifyCommonJS", "__toCommonJS", "import_node_fs", "import_node_path", "api", "options", "path", "state", "arg", "moduleSpecifier", "filePath", "fileDir", "cjsExtension", "jsExtension", "resolvedPath", "newModuleSpecifier", "isLocalDirectory", "indexBase", "indexPath", "absolutePath"]
 }
```

**File**: `code/packages/babel-plugin-fully-specified/permanent/cjs/commonjs.mjs` (modified, +67/-83)
```diff
@@ -1,98 +1,82 @@
-var __defProp = Object.defineProperty
-var __getOwnPropDesc = Object.getOwnPropertyDescriptor
-var __getOwnPropNames = Object.getOwnPropertyNames
-var __hasOwnProp = Object.prototype.hasOwnProperty
+"use strict";
+var __defProp = Object.defineProperty;
+var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
+var __getOwnPropNames = Object.getOwnPropertyNames;
+var __hasOwnProp = Object.prototype.hasOwnProperty;
 var __export = (target, all) => {
-    for (var name in all)
-      __defProp(target, name, {
-        get: all[name],
-        enumerable: !0,
-      })
-  },
-  __copyProps = (to, from, except, desc) => {
-    if ((from && typeof from == 'object') || typeof from == 'function')
-      for (let key of __getOwnPropNames(from))
-        !__hasOwnProp.call(to, key) &&
-          key !== except &&
-          __defProp(to, key, {
-            get: () => from[key],
-            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
-          })
-    return to
+  for (var name in all)
+    __defProp(target, name, { get: all[name], enumerable: true });
+};
+var __copyProps = (to, from, except, desc) => {
+  if (from && typeof from === "object" || typeof from === "function") {
+    for (let key of __getOwnPropNames(from))
+      if (!__hasOwnProp.call(to, key) && key !== except)
+        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
   }
-var __toCommonJS = (mod) =>
-  __copyProps(
-    __defProp({}, '__esModule', {
-      value: !0,
-    }),
-    mod
-  )
-var commonjs_exports = {}
+  return to;
+};
+var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
+
+// src/commonjs.ts
+var commonjs_exports = {};
 __export(commonjs_exports, {
-  default: () => fullySpecifyCommonJS,
-})
-module.exports = __toCommonJS(commonjs_exports)
-var import_node_fs = require('node:fs'),
-  import_node_path = require('node:path')
+  default: () => fullySpecifyCommonJS
+});
+module.exports = __toCommonJS(commonjs_exports);
+var import_node_fs = require("node:fs");
+var import_node_path = require("node:path");
 function fullySpecifyCommonJS(api, options) {
-  return (
-    api.assertVersion(7),
-    {
-      name: 'babel-plugin-fully-specified-cjs',
-      visitor: {
-        CallExpression(path, state) {
-          if (
-            path.get('callee').isIdentifier({
-              name: 'require',
-            }) &&
-            path.node.arguments.length === 1
-          ) {
-            const arg = path.node.arguments[0]
-            if (arg.type === 'StringLiteral') {
-              let moduleSpecifier = arg.value
-              if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
-                const filePath = state.file.opts.filename
-                if (!filePath) return
-                const fileDir = (0, import_node_path.dirname)(filePath),
-                  cjsExtension = options.esExtensionDefault || '.cjs',
-                  jsExtension = '.js'
-                if (!(0, import_node_path.extname)(moduleSpecifier)) {
-                  const resolvedPath = (0, import_node_path.resolve)(
-                    fileDir,
-                    moduleSpecifier
-                  )
-                  let newModuleSpecifier = moduleSpecifier
-                  if (isLocalDirectory(resolvedPath)) {
-                    const indexPath = (0, import_node_path.resolve)(
-                      resolvedPath,
-                      'index' + jsExtension
-                    )
-                    if ((0, import_node_fs.existsSync)(indexPath)) {
-                      ;(newModuleSpecifier.endsWith('/') || (newModuleSpecifier += '/'),
-                        (newModuleSpecifier += 'index' + cjsExtension),
-                        (arg.value = newModuleSpecifier))
-                      return
-                    }
+  api.assertVersion(7);
+  return {
+    name: "babel-plugin-fully-specified-cjs",
+    visitor: {
+      CallExpression(path, state) {
+        const callee = path.get("callee");
+        if (callee.isIdentifier({ name: "require" }) && path.node.arguments.length === 1) {
+          const arg = path.node.arguments[0];
+          if (arg.type === "StringLiteral") {
+            let moduleSpecifier = arg.value;
+            if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/")) {
+              const filePath = state.file.opts.filename;
+              if (!filePath) return;
+              const fileDir = (0, import_node_path.dirname)(filePath);
+              const cjsExtension = options.esExtensionDefault || ".cjs";
+              const jsExtension = ".js";
+              if (!(0, import_node_path.extname)(moduleSpecifier)) {
+                const resolvedPath = (0, import_node_path.resolve)(fileDir, moduleSpecifier);
+                let newModuleSpecifier = moduleSpecifier;
+                if (cjsExtension.startsWith(".native") && ((0, impor
```

---

### Incident Patch 3: `e4a4d387` (2026-09-24)
**Commit Message**: fix(build): ship .ios/.android files and leave their native imports extensionless

Team-Machine-Session: m16593

**File**: `code/packages/babel-plugin-fully-specified/__tests__/fixtures/platform-split/Widget.android.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export const Widget = 'android'
```

**File**: `code/packages/babel-plugin-fully-specified/__tests__/fixtures/platform-split/Widget.ios.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export const Widget = 'ios'
```

**File**: `code/packages/babel-plugin-fully-specified/__tests__/fixtures/platform-split/Widget.native.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export const Widget = 'base'
```

**File**: `code/packages/babel-plugin-fully-specified/__tests__/fixtures/platform-split/index.native.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export * from './Widget'
```

**File**: `code/packages/babel-plugin-fully-specified/__tests__/index.test.ts` (modified, +16/-0)
```diff
@@ -145,4 +145,20 @@ describe('transforming actual files', () => {
       ].join('\n')
     )
   })
+
+  test('native output leaves platform-split imports extensionless', () => {
+    const { code } =
+      transformFileSync(
+        path.join(__dirname, 'fixtures', 'platform-split', 'index.native.js'),
+        getTransformOptions({
+          pluginOptions: {
+            ensureFileExists: true,
+            esExtensionDefault: '.native.js',
+            esExtensions: ['.js'],
+          },
+        })
+      ) || {}
+
+    expect(code).toBe(`export * from './Widget';`)
+  })
 })
```

**File**: `code/packages/babel-plugin-fully-specified/permanent/cjs/commonjs.js` (modified, +1/-87)
```diff
@@ -1,88 +1,2 @@
-var __defProp = Object.defineProperty
-var __getOwnPropDesc = Object.getOwnPropertyDescriptor
-var __getOwnPropNames = Object.getOwnPropertyNames
-var __hasOwnProp = Object.prototype.hasOwnProperty
-var __export = (target, all) => {
-    for (var name in all) __defProp(target, name, { get: all[name], enumerable: !0 })
-  },
-  __copyProps = (to, from, except, desc) => {
-    if ((from && typeof from == 'object') || typeof from == 'function')
-      for (let key of __getOwnPropNames(from))
-        !__hasOwnProp.call(to, key) &&
-          key !== except &&
-          __defProp(to, key, {
-            get: () => from[key],
-            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
-          })
-    return to
-  }
-var __toCommonJS = (mod) => __copyProps(__defProp({}, '__esModule', { value: !0 }), mod)
-var commonjs_exports = {}
-__export(commonjs_exports, {
-  default: () => fullySpecifyCommonJS,
-})
-module.exports = __toCommonJS(commonjs_exports)
-var import_node_fs = require('node:fs'),
-  import_node_path = require('node:path')
-function fullySpecifyCommonJS(api, options) {
-  return (
-    api.assertVersion(7),
-    {
-      name: 'babel-plugin-fully-specified-cjs',
-      visitor: {
-        CallExpression(path, state) {
-          if (
-            path.get('callee').isIdentifier({ name: 'require' }) &&
-            path.node.arguments.length === 1
-          ) {
-            const arg = path.node.arguments[0]
-            if (arg.type === 'StringLiteral') {
-              let moduleSpecifier = arg.value
-              if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
-                const filePath = state.file.opts.filename
-                if (!filePath) return
-                const fileDir = (0, import_node_path.dirname)(filePath),
-                  cjsExtension = options.esExtensionDefault || '.cjs',
-                  jsExtension = '.js'
-                if (!(0, import_node_path.extname)(moduleSpecifier)) {
-                  const resolvedPath = (0, import_node_path.resolve)(
-                    fileDir,
-                    moduleSpecifier
-                  )
-                  let newModuleSpecifier = moduleSpecifier
-                  if (isLocalDirectory(resolvedPath)) {
-                    const indexPath = (0, import_node_path.resolve)(
-                      resolvedPath,
-                      'index' + jsExtension
-                    )
-                    if ((0, import_node_fs.existsSync)(indexPath)) {
-                      ;(newModuleSpecifier.endsWith('/') || (newModuleSpecifier += '/'),
-                        (newModuleSpecifier += 'index' + cjsExtension),
-                        (arg.value = newModuleSpecifier))
-                      return
-                    }
-                  }
-                  if (
-                    (0, import_node_fs.existsSync)(resolvedPath + jsExtension) ||
-                    (0, import_node_fs.existsSync)(resolvedPath + cjsExtension)
-                  ) {
-                    ;((newModuleSpecifier += cjsExtension),
-                      (arg.value = newModuleSpecifier))
-                    return
-                  }
-                }
-              }
-            }
-          }
-        },
-      },
-    }
-  )
-}
-function isLocalDirectory(absolutePath) {
-  return (
-    (0, import_node_fs.existsSync)(absolutePath) &&
-    (0, import_node_fs.lstatSync)(absolutePath).isDirectory()
-  )
-}
+"use strict";var d=Object.defineProperty;var b=Object.getOwnPropertyDescriptor;var v=Object.getOwnPropertyNames;var S=Object.prototype.hasOwnProperty;var h=(e,i)=>{for(var n in i)d(e,n,{get:i[n],enumerable:!0})},D=(e,i,n,c)=>{if(i&&typeof i=="object"||typeof i=="function")for(let o of v(i))!S.call(e,o)&&o!==n&&d(e,o,{get:()=>i[o],enumerable:!(c=b(i,o))||c.enumerable});return e};var E=e=>D(d({},"__esModule",{value:!0}),e);var P={};h(P,{default:()=>j});module.exports=E(P);var t=require("node:fs"),s=require("node:path");function j(e,i){return e.assertVersion(7),{name:"babel-plugin-fully-specified-cjs",visitor:{CallExpression(n,c){if(n.get("callee").isIdentifier({name:"require"})&&n.node.arguments.length===1){let u=n.node.arguments[0];if(u.type==="StringLiteral"){let a=u.value;if(a.startsWith(".")||a.startsWith("/")){let m=c.file.opts.filename;if(!m)return;let p=(0,s.dirname)(m),f=i.esExtensionDefault||".cjs",x=".js";if(!(0,s.extname)(a)){let r=(0,s.resolve)(p,a),l=a;if(f.startsWith(".native")&&((0,t.existsSync)(`${r}.ios.js`)||(0,t.existsSync)(`${r}.android.js`)))return;if(W(r)){let g=(0,s.resolve)(r,"index");if(f.startsWith(".native")&&((0,t.existsSync)(`${g}.ios.js`)||(0,t.existsSync)(`${g}.android.js`)))return;let y=(0,s.resolve)(r,"index"+x);if((0,t.existsSync)(y)){l.endsWith("/")||(l+="/"),l+="index"+f,u.value=l;return}}if((0,t.existsSync)(r+x)||(0,t.existsSync)(r+f)){l+=f,u.value=l;return}}}}}}}}}function W(e){return(0,t.existsSync)(e)&&(0,t.lstatSync)(e).isDirectory()}
 //
```

**File**: `code/packages/babel-plugin-fully-specified/permanent/cjs/commonjs.js.map` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "version": 3,
   "sources": ["../../src/commonjs.ts"],
-  "mappings": ";;;;;;;;;;;;;;AAAA;AAAA;AAAA;AAAA;AAAA;AAAA,qBAAsC,oBACtC,mBAA0C;AAE3B,SAAR,qBACL,KACA,SAGiB;AACjB,aAAI,cAAc,CAAC,GAEZ;AAAA,IACL,MAAM;AAAA,IACN,SAAS;AAAA,MACP,eAAe,MAAM,OAAO;AAG1B,YAFe,KAAK,IAAI,QAAQ,EAGvB,aAAa,EAAE,MAAM,UAAU,CAAC,KACvC,KAAK,KAAK,UAAU,WAAW,GAC/B;AACA,gBAAM,MAAM,KAAK,KAAK,UAAU,CAAC;AACjC,cAAI,IAAI,SAAS,iBAAiB;AAChC,gBAAI,kBAAkB,IAAI;AAG1B,gBAAI,gBAAgB,WAAW,GAAG,KAAK,gBAAgB,WAAW,GAAG,GAAG;AACtE,oBAAM,WAAW,MAAM,KAAK,KAAK;AACjC,kBAAI,CAAC,SAAU;AAEf,oBAAM,cAAU,0BAAQ,QAAQ,GAC1B,eAAe,QAAQ,sBAAsB,QAC7C,cAAc;AAGpB,kBAAI,KAAC,0BAAQ,eAAe,GAAG;AAC7B,sBAAM,mBAAe,0BAAQ,SAAS,eAAe;AACrD,oBAAI,qBAAqB;AAGzB,oBAAI,iBAAiB,YAAY,GAAG;AAClC,wBAAM,gBAAY,0BAAQ,cAAc,UAAU,WAAW;AAC7D,0BAAI,2BAAW,SAAS,GAAG;AAEzB,oBAAK,mBAAmB,SAAS,GAAG,MAClC,sBAAsB,MAExB,sBAAsB,UAAU,cAChC,IAAI,QAAQ;AACZ;AAAA,kBACF;AAAA,gBACF;AAGA,sBAAM,iBAAiB,eAAe;AACtC,wBAAI,2BAAW,cAAc,GAAG;AAC9B,wCAAsB,cACtB,IAAI,QAAQ;AACZ;AAAA,gBACF;AAAA,cACF;AAAA,YACF;AAAA,UACF;AAAA,QACF;AAAA,MACF;AAAA,IACF;AAAA,EACF;AACF;AAEA,SAAS,iBAAiB,cAA+B;AACvD,aAAO,2BAAW,YAAY,SAAK,0BAAU,YAAY,EAAE,YAAY;AACzE;",
-  "names": []
+  "mappings": "yaAAA,IAAAA,EAAA,GAAAC,EAAAD,EAAA,aAAAE,IAAA,eAAAC,EAAAH,GAAA,IAAAI,EAAsC,mBACtCC,EAA0C,qBAE3B,SAARH,EACLI,EACAC,EAGiB,CACjB,OAAAD,EAAI,cAAc,CAAC,EAEZ,CACL,KAAM,mCACN,QAAS,CACP,eAAeE,EAAMC,EAAO,CAG1B,GAFeD,EAAK,IAAI,QAAQ,EAGvB,aAAa,CAAE,KAAM,SAAU,CAAC,GACvCA,EAAK,KAAK,UAAU,SAAW,EAC/B,CACA,IAAME,EAAMF,EAAK,KAAK,UAAU,CAAC,EACjC,GAAIE,EAAI,OAAS,gBAAiB,CAChC,IAAIC,EAAkBD,EAAI,MAG1B,GAAIC,EAAgB,WAAW,GAAG,GAAKA,EAAgB,WAAW,GAAG,EAAG,CACtE,IAAMC,EAAWH,EAAM,KAAK,KAAK,SACjC,GAAI,CAACG,EAAU,OAEf,IAAMC,KAAU,WAAQD,CAAQ,EAC1BE,EAAeP,EAAQ,oBAAsB,OAC7CQ,EAAc,MAGpB,GAAI,IAAC,WAAQJ,CAAe,EAAG,CAC7B,IAAMK,KAAe,WAAQH,EAASF,CAAe,EACjDM,EAAqBN,EAIzB,GACEG,EAAa,WAAW,SAAS,OAChC,cAAW,GAAGE,CAAY,SAAS,MAClC,cAAW,GAAGA,CAAY,aAAa,GAEzC,OAIF,GAAIE,EAAiBF,CAAY,EAAG,CAClC,IAAMG,KAAY,WAAQH,EAAc,OAAO,EAC/C,GACEF,EAAa,WAAW,SAAS,OAChC,cAAW,GAAGK,CAAS,SAAS,MAC/B,cAAW,GAAGA,CAAS,aAAa,GAEtC,OAEF,IAAMC,KAAY,WAAQJ,EAAc,QAAUD,CAAW,EAC7D,MAAI,cAAWK,CAAS,EAAG,CAEpBH,EAAmB,SAAS,GAAG,IAClCA,GAAsB,KAExBA,GAAsB,QAAUH,EAChCJ,EAAI,MAAQO,EACZ,MACF,CACF,CAGA,MACE,cAAWD,EAAeD,CAAW,MACrC,cAAWC,EAAeF,CAAY,EACtC,CACAG,GAAsBH,EACtBJ,EAAI,MAAQO,EACZ,MACF,CACF,CACF,CACF,CACF,CACF,CACF,CACF,CACF,CAEA,SAASC,EAAiBG,EAA+B,CACvD,SAAO,cAAWA,CAAY,MAAK,aAAUA,CAAY,EAAE,YAAY,CACzE",
+  "names": ["commonjs_exports", "__export", "fullySpecifyCommonJS", "__toCommonJS", "import_node_fs", "import_node_path", "api", "options", "path", "state", "arg", "moduleSpecifier", "filePath", "fileDir", "cjsExtension", "jsExtension", "resolvedPath", "newModuleSpecifier", "isLocalDirectory", "indexBase", "indexPath", "absolutePath"]
 }
```

**File**: `code/packages/babel-plugin-fully-specified/permanent/cjs/commonjs.mjs` (modified, +67/-83)
```diff
@@ -1,98 +1,82 @@
-var __defProp = Object.defineProperty
-var __getOwnPropDesc = Object.getOwnPropertyDescriptor
-var __getOwnPropNames = Object.getOwnPropertyNames
-var __hasOwnProp = Object.prototype.hasOwnProperty
+"use strict";
+var __defProp = Object.defineProperty;
+var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
+var __getOwnPropNames = Object.getOwnPropertyNames;
+var __hasOwnProp = Object.prototype.hasOwnProperty;
 var __export = (target, all) => {
-    for (var name in all)
-      __defProp(target, name, {
-        get: all[name],
-        enumerable: !0,
-      })
-  },
-  __copyProps = (to, from, except, desc) => {
-    if ((from && typeof from == 'object') || typeof from == 'function')
-      for (let key of __getOwnPropNames(from))
-        !__hasOwnProp.call(to, key) &&
-          key !== except &&
-          __defProp(to, key, {
-            get: () => from[key],
-            enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
-          })
-    return to
+  for (var name in all)
+    __defProp(target, name, { get: all[name], enumerable: true });
+};
+var __copyProps = (to, from, except, desc) => {
+  if (from && typeof from === "object" || typeof from === "function") {
+    for (let key of __getOwnPropNames(from))
+      if (!__hasOwnProp.call(to, key) && key !== except)
+        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
   }
-var __toCommonJS = (mod) =>
-  __copyProps(
-    __defProp({}, '__esModule', {
-      value: !0,
-    }),
-    mod
-  )
-var commonjs_exports = {}
+  return to;
+};
+var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
+
+// src/commonjs.ts
+var commonjs_exports = {};
 __export(commonjs_exports, {
-  default: () => fullySpecifyCommonJS,
-})
-module.exports = __toCommonJS(commonjs_exports)
-var import_node_fs = require('node:fs'),
-  import_node_path = require('node:path')
+  default: () => fullySpecifyCommonJS
+});
+module.exports = __toCommonJS(commonjs_exports);
+var import_node_fs = require("node:fs");
+var import_node_path = require("node:path");
 function fullySpecifyCommonJS(api, options) {
-  return (
-    api.assertVersion(7),
-    {
-      name: 'babel-plugin-fully-specified-cjs',
-      visitor: {
-        CallExpression(path, state) {
-          if (
-            path.get('callee').isIdentifier({
-              name: 'require',
-            }) &&
-            path.node.arguments.length === 1
-          ) {
-            const arg = path.node.arguments[0]
-            if (arg.type === 'StringLiteral') {
-              let moduleSpecifier = arg.value
-              if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('/')) {
-                const filePath = state.file.opts.filename
-                if (!filePath) return
-                const fileDir = (0, import_node_path.dirname)(filePath),
-                  cjsExtension = options.esExtensionDefault || '.cjs',
-                  jsExtension = '.js'
-                if (!(0, import_node_path.extname)(moduleSpecifier)) {
-                  const resolvedPath = (0, import_node_path.resolve)(
-                    fileDir,
-                    moduleSpecifier
-                  )
-                  let newModuleSpecifier = moduleSpecifier
-                  if (isLocalDirectory(resolvedPath)) {
-                    const indexPath = (0, import_node_path.resolve)(
-                      resolvedPath,
-                      'index' + jsExtension
-                    )
-                    if ((0, import_node_fs.existsSync)(indexPath)) {
-                      ;(newModuleSpecifier.endsWith('/') || (newModuleSpecifier += '/'),
-                        (newModuleSpecifier += 'index' + cjsExtension),
-                        (arg.value = newModuleSpecifier))
-                      return
-                    }
+  api.assertVersion(7);
+  return {
+    name: "babel-plugin-fully-specified-cjs",
+    visitor: {
+      CallExpression(path, state) {
+        const callee = path.get("callee");
+        if (callee.isIdentifier({ name: "require" }) && path.node.arguments.length === 1) {
+          const arg = path.node.arguments[0];
+          if (arg.type === "StringLiteral") {
+            let moduleSpecifier = arg.value;
+            if (moduleSpecifier.startsWith(".") || moduleSpecifier.startsWith("/")) {
+              const filePath = state.file.opts.filename;
+              if (!filePath) return;
+              const fileDir = (0, import_node_path.dirname)(filePath);
+              const cjsExtension = options.esExtensionDefault || ".cjs";
+              const jsExtension = ".js";
+              if (!(0, import_node_path.extname)(moduleSpecifier)) {
+                const resolvedPath = (0, import_node_path.resolve)(fileDir, moduleSpecifier);
+                let newModuleSpecifier = moduleSpecifier;
+                if (cjsExtension.startsWith(".native") && ((0, impor
```

---

### Incident Patch 4: `795200db` (2026-09-18)
**Commit Message**: fix(animations-reanimated): hold enterStyle through a transition delay

**File**: `code/core/animations-reanimated/src/createAnimations.tsx` (modified, +4/-4)
```diff
@@ -443,6 +443,10 @@ const applyAnimation = (
     typeof animatedValue !== 'boolean' &&
     typeof animatedValue !== 'undefined'
 
+  if (isAnimationDescriptor && delay && delay > 0) {
+    animatedValue = withDelay(delay, animatedValue)
+  }
+
   if (isAnimationDescriptor && (seedValue !== undefined || validateStartAsColor)) {
     const innerOnStart = animatedValue.onStart
     animatedValue.onStart = (
@@ -461,10 +465,6 @@ const applyAnimation = (
     }
   }
 
-  if (isAnimationDescriptor && delay && delay > 0) {
-    animatedValue = withDelay(delay, animatedValue)
-  }
-
   return animatedValue
 }
 
```

**File**: `code/kitchen-sink/src/usecases/DelayedEnterStyleCase.tsx` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+import { useState } from 'react'
+import { Button, Paragraph, Square, XStack, YStack } from 'tamagui'
+
+export function DelayedEnterStyleCase() {
+  const [show, setShow] = useState(false)
+
+  return (
+    <YStack gap="$4" padding="$4">
+      <Paragraph fontWeight="bold" fontSize="$5">
+        Delayed Enter Style
+      </Paragraph>
+
+      <XStack gap="$2">
+        <Button testID="delayed-enter-show" onPress={() => setShow(true)}>
+          Show
+        </Button>
+        <Button testID="delayed-enter-hide" onPress={() => setShow(false)}>
+          Hide
+        </Button>
+      </XStack>
+
+      <XStack height={120} items="center" justify="center">
+        {show ? (
+          <Square
+            testID="delayed-enter-target"
+            transition={['quick', { delay: 1000 }]}
+            size={80}
+            bg="$blue10"
+            enterStyle={{ opacity: 0 }}
+          />
+        ) : null}
+      </XStack>
+    </YStack>
+  )
+}
```

**File**: `code/kitchen-sink/src/usecases/index.web.ts` (modified, +1/-0)
```diff
@@ -52,6 +52,7 @@ const loaders: Record<string, () => ComponentType<any>> = {
     require('./CustomStyledAnimatedPopover').CustomStyledAnimatedPopover,
   CustomStyledAnimatedTooltip: () =>
     require('./CustomStyledAnimatedTooltip').CustomStyledAnimatedTooltip,
+  DelayedEnterStyleCase: () => require('./DelayedEnterStyleCase').DelayedEnterStyleCase,
   DriverDisableAnimationPropsCase: () =>
     require('./DriverDisableAnimationPropsCase').DriverDisableAnimationPropsCase,
   DOMNodeAPIs: () => require('./DOMNodeAPIs').DOMNodeAPIs,
```

**File**: `code/kitchen-sink/tests/DelayedEnterStyle.animated.test.tsx` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import { expect, test, type Page } from '@playwright/test'
+import { setupPage } from './test-utils'
+
+/**
+ * DELAYED ENTER STYLE TESTS
+ *
+ * A delayed enter animation should hold its enterStyle for the whole delay,
+ * then animate in. Runs across all animation drivers.
+ *
+ * Bug: The reanimated driver used to paint the final value during the delay,
+ * snap back to enterStyle once it ended, and only then animate in.
+ */
+
+async function getOpacity(page: Page, testId: string): Promise<number> {
+  return page
+    .getByTestId(testId)
+    .evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity))
+}
+
+test.beforeEach(async ({ page }) => {
+  await setupPage(page, { name: 'DelayedEnterStyleCase', type: 'useCase' })
+})
+
+test('delayed enterStyle stays at enterStyle until the delay ends', async ({ page }) => {
+  // transition={['quick', { delay: 1000 }]}, enterStyle={{ opacity: 0 }}
+  await page.getByTestId('delayed-enter-show').click()
+
+  // halfway through the delay
+  await page.waitForTimeout(500)
+  const duringDelay = await getOpacity(page, 'delayed-enter-target')
+  expect(duringDelay, 'During delay, opacity should be at enterStyle').toBeCloseTo(0, 1)
+
+  // wait for delay + animation to complete
+  await page.waitForTimeout(2000)
+  const endOpacity = await getOpacity(page, 'delayed-enter-target')
+  expect(endOpacity, 'End opacity').toBeCloseTo(1, 1)
+})
```

---

### Incident Patch 5: `c4e2aab8` (2026-09-19)
**Commit Message**: docs: finalize v2 bug triage status

Team-Machine-Session: m15551

**File**: `plans/v3-rc1-v2-bug-triage.md` (modified, +6/-6)
```diff
@@ -11,9 +11,9 @@ then be forward-ported to v3-beta.
 | Issue | Status | Evidence |
 | --- | --- | --- |
 | [#4193 Reanimated remount crash](https://github.com/tamagui/tamagui/issues/4193) | Already fixed on main and v3-beta; issue closed | Primitive return values from Reanimated are guarded before touching `onStart`; the native regression is in `ReanimatedInitialUpdater.native.test.tsx`. |
-| [#4163 native ScrollView `onScroll`](https://github.com/tamagui/tamagui/issues/4163) | Merged in [#4221](https://github.com/tamagui/tamagui/pull/4221) | Removed `onScroll` from the native web-prop skip map. Native split-style regression: 21 passed, 7 expected failures. |
-| [#4152 Tooltip keyboard focus](https://github.com/tamagui/tamagui/issues/4152) | In merge queue as [#4222](https://github.com/tamagui/tamagui/pull/4222) | Reproduced on the webpack dev server. Floating focus/blur handlers were generated but lost during `asChild` composition; they are now composed on `PopoverTrigger`. Focus open/blur close regression passes, and related Tooltip suites pass 7/7. |
-| [#4217 Android Button disabled reset](https://github.com/tamagui/tamagui/issues/4217) | In merge queue as [#4223](https://github.com/tamagui/tamagui/pull/4223) | Preserves contributor @boiboif's authored fix from #4219 on a repository branch so required checks can run. Native regression passes 3/3. |
+| [#4163 native ScrollView `onScroll`](https://github.com/tamagui/tamagui/issues/4163) | Merged in [#4221](https://github.com/tamagui/tamagui/pull/4221) and forward-ported to v3-beta | Removed `onScroll` from the native web-prop skip map. Native split-style regression: 21 passed with 7 expected failures on main; 24 passed with 7 expected failures on v3. |
+| [#4152 Tooltip keyboard focus](https://github.com/tamagui/tamagui/issues/4152) | Merged in [#4222](https://github.com/tamagui/tamagui/pull/4222) and forward-ported to v3-beta | Reproduced on the webpack dev server. Floating focus/blur handlers were generated but lost during `asChild` composition; they are now composed on `PopoverTrigger`. Focus open/blur close regression passes, and related Tooltip suites pass 7/7 on both branches. |
+| [#4217 Android Button disabled reset](https://github.com/tamagui/tamagui/issues/4217) | Merged in [#4223](https://github.com/tamagui/tamagui/pull/4223) and adapted for v3-beta | Preserves contributor @boiboif's authorship from #4219. Native regression passes 3/3 on both branches; v3's `useButton` also emits an explicit false accessibility state. |
 
 ## Fixed issues closed during this pass
 
@@ -48,6 +48,6 @@ Ordered by release risk, not by age.
 ## RC1 recommendation
 
 Do not block RC1 on the full historical backlog. Block it on #4194 and on a
-current-tip result for #3996/#4165. Land the queued interaction fixes and run one
-focused native Sheet/Reanimated/portal matrix. Forward-port each main commit
-independently to v3-beta and retain the same regression at the v3 layer.
+current-tip result for #3996/#4165. Run one focused native
+Sheet/Reanimated/portal matrix; the interaction fixes from this pass are already
+on main and v3-beta with regressions at both layers.
```

---

### Incident Patch 6: `de84ab62` (2026-09-19)
**Commit Message**: docs: record v2 bug triage for v3 rc1

Team-Machine-Session: m15551

**File**: `plans/v3-rc1-v2-bug-triage.md` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+# V3 RC1: v2 bug triage
+
+Date: 2026-09-19
+
+This is a release-focused pass over the 71 open issues, biased toward crashes,
+production-only correctness bugs, and fixes that can land safely on v2/main and
+then be forward-ported to v3-beta.
+
+## Landed or in the merge queue
+
+| Issue | Status | Evidence |
+| --- | --- | --- |
+| [#4193 Reanimated remount crash](https://github.com/tamagui/tamagui/issues/4193) | Already fixed on main and v3-beta; issue closed | Primitive return values from Reanimated are guarded before touching `onStart`; the native regression is in `ReanimatedInitialUpdater.native.test.tsx`. |
+| [#4163 native ScrollView `onScroll`](https://github.com/tamagui/tamagui/issues/4163) | Merged in [#4221](https://github.com/tamagui/tamagui/pull/4221) | Removed `onScroll` from the native web-prop skip map. Native split-style regression: 21 passed, 7 expected failures. |
+| [#4152 Tooltip keyboard focus](https://github.com/tamagui/tamagui/issues/4152) | In merge queue as [#4222](https://github.com/tamagui/tamagui/pull/4222) | Reproduced on the webpack dev server. Floating focus/blur handlers were generated but lost during `asChild` composition; they are now composed on `PopoverTrigger`. Focus open/blur close regression passes, and related Tooltip suites pass 7/7. |
+| [#4217 Android Button disabled reset](https://github.com/tamagui/tamagui/issues/4217) | In merge queue as [#4223](https://github.com/tamagui/tamagui/pull/4223) | Preserves contributor @boiboif's authored fix from #4219 on a repository branch so required checks can run. Native regression passes 3/3. |
+
+## Fixed issues that are still open
+
+These should be closed after a brief reporter-facing note rather than consuming
+RC work again.
+
+| Issue | Current evidence | Recommendation |
+| --- | --- | --- |
+| [#4146 vertical Slider drifts after scrolling](https://github.com/tamagui/tamagui/issues/4146) | Main uses track-relative web pointer coordinates and has three browser regressions. All 3 passed against the dev server after rebuilding `@tamagui/slider`. | Close. |
+| [#4031 swapped forwarded ref receives no host](https://github.com/tamagui/tamagui/issues/4031) | Fixed by `26eb212569`; `composedRef.web.test.tsx` covers ref identity handoff. | Close. |
+| [#4000 Button `maxFontSizeMultiplier`](https://github.com/tamagui/tamagui/issues/4000) | Fixed by `1842ec2b55`, covered by native Button tests, and verified by the reporter. | Close. |
+| [#3314 Dialog accessibility](https://github.com/tamagui/tamagui/issues/3314) | Dialog content now exposes the dialog role/modal semantics; the follow-up reports a clean axe result and spec-compliant focus. | Close. |
+| [#3998 iOS Button `cursor` crash](https://github.com/tamagui/tamagui/issues/3998) | The internal Text cursor is web-gated and a native regression asserts it is not emitted. | Ask the reporter to confirm the broader Fabric-prop portion, then close if clean. |
+
+## Must investigate before RC1
+
+Ordered by release risk, not by age.
+
+1. [#4194 compiler conditional-style corruption](https://github.com/tamagui/tamagui/issues/4194): production extraction can silently select the wrong styles when an element has multiple conditionals. The report includes a root-cause analysis and says a patch already exists downstream. This is the highest-priority follow-up because dev renders correctly while production renders incorrectly.
+2. [#3996 v2 Reanimated Sheet crash](https://github.com/tamagui/tamagui/issues/3996): iOS crashes while switching a Sheet between modal and inline with the Reanimated driver. There is a standalone reproduction. Retest on the current v2 tip and Reanimated 4 before deciding whether #4193 also covered part of it.
+3. [#4165 native portal setup crash](https://github.com/tamagui/tamagui/issues/4165): current v2.7.6 report on Expo 57/RN 0.86 for both iOS and Android. Verify whether the documentation names the wrong package (`react-native-portal` versus `react-native-teleport`) before changing runtime code.
+4. [#3079 Theme undefined/subtheme crash](https://github.com/tamagui/tamagui/issues/3079): old report but repeatedly confirmed. Reproduce against v2.7.x; if current, add the transition as a core native test before changing Theme state logic.
+5. [#3978 nested Sheet teleport z-index](https://github.com/tamagui/tamagui/issues/3978), [#3468 nested Sheet unmount](https://github.com/tamagui/tamagui/issues/3468), and [#3427 Sheet scroll starts drag](https://github.com/tamagui/tamagui/issues/3427): treat these as one native Sheet/portal pass so fixes do not fight each other.
+
+## Small next wins
+
+- [#4192 docs search mouse navigation](https://github.com/tamagui/tamagui/issues/4192): recent, clear web reproduction, and likely isolated to result click/pointer handling. Good site-only follow-up.
+- [#3628 Select does not close when selecting the active item](https://github.com/tamagui/tamagui/issues/3628): narrow interaction contract; reproduce and add one 
```

---

### Incident Patch 7: `a7668a74` (2026-09-16)
**Commit Message**: fix(button): reset disabled accessibility state Fixes #4217

Team-Machine-Session: m15551

**File**: `code/core/core-test/buttonDisabledHooks.native.test.tsx` (modified, +22/-0)
```diff
@@ -103,4 +103,26 @@ describe('styled(Button) disabled hook stability', () => {
       }).not.toThrow()
     }
   )
+
+  test('resets the native accessibility state when re-enabled', () => {
+    const app = (disabled: boolean) => (
+      <TamaguiProvider config={config} defaultTheme="light">
+        <Button testID="target-button" disabled={disabled} onPress={() => {}}>
+          Submit
+        </Button>
+      </TamaguiProvider>
+    )
+
+    const rendered = render(app(true))
+    const getTarget = () =>
+      rendered
+        .UNSAFE_getAllByProps({ testID: 'target-button' })
+        .find((node) => 'aria-disabled' in node.props)!
+
+    expect(getTarget().props['aria-disabled']).toBe(true)
+
+    rendered.rerender(app(false))
+
+    expect(getTarget().props['aria-disabled']).toBe(false)
+  })
 })
```

**File**: `code/ui/button/src/Button.tsx` (modified, +4/-0)
```diff
@@ -141,6 +141,10 @@ const Frame = styled(View, {
         // @ts-ignore
         'aria-disabled': true,
       },
+      false: {
+        // @ts-ignore
+        'aria-disabled': false,
+      },
     },
   } as const,
 
```

---

### Incident Patch 8: `0c50189b` (2026-09-19)
**Commit Message**: fix(popover): compose floating focus handlers on triggers Fixes #4152

Team-Machine-Session: m15551

**File**: `code/kitchen-sink/src/usecases/TooltipCase.tsx` (modified, +9/-0)
```diff
@@ -5,6 +5,15 @@ export function TooltipCase() {
     <YStack flex={1} gap="$8" p="$4" bg="$background">
       <TooltipComp />
 
+      <Tooltip focus={{ enabled: true }} delay={0} restMs={0}>
+        <Tooltip.Trigger data-testid="focus-tooltip-trigger">
+          <Button>focus tooltip</Button>
+        </Tooltip.Trigger>
+        <Tooltip.Content>
+          <Paragraph data-testid="focus-tooltip-content">focus tooltip content</Paragraph>
+        </Tooltip.Content>
+      </Tooltip>
+
       <TooltipSimple label="wtf">
         <Button>simple tool</Button>
       </TooltipSimple>
```

**File**: `code/kitchen-sink/tests/TooltipFocus.test.tsx` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { expect, test } from '@playwright/test'
+
+import { setupPage } from './test-utils'
+
+test.beforeEach(async ({ page }) => {
+  await setupPage(page, { name: 'TooltipCase', type: 'useCase' })
+})
+
+test('opens a focus-enabled tooltip when its trigger receives keyboard focus', async ({
+  page,
+}) => {
+  const trigger = page.getByTestId('focus-tooltip-trigger').getByRole('button')
+
+  for (let attempt = 0; attempt < 5; attempt++) {
+    if (await trigger.evaluate((node) => node === document.activeElement)) break
+    await page.keyboard.press('Tab')
+  }
+
+  await expect(trigger).toBeFocused()
+  await expect(page.getByTestId('focus-tooltip-content')).toBeVisible()
+
+  await page.keyboard.press('Tab')
+  await expect(page.getByTestId('focus-tooltip-content')).not.toBeVisible()
+})
```

**File**: `code/ui/popover/src/Popover.tsx` (modified, +9/-1)
```diff
@@ -43,6 +43,7 @@ import {
   type PopperProps,
   PopperProvider,
   usePopperContext,
+  usePopperContextSlow,
 } from '@tamagui/popper'
 import { needsPortalRepropagation, Portal } from '@tamagui/portal'
 import { RemoveScroll } from '@tamagui/remove-scroll'
@@ -382,6 +383,7 @@ export const PopoverTrigger = React.memo(
     function PopoverTrigger(props, forwardedRef) {
       const { scope, disablePressTrigger, ...rest } = props
       const triggerContext = usePopoverTriggerContext(scope)
+      const popperContext = usePopperContextSlow(scope)
       const triggerId = React.useId()
       const [open, setOpen] = React.useState(false)
       const anchorTo = triggerContext.anchorTo
@@ -424,7 +426,13 @@ export const PopoverTrigger = React.memo(
           })}
           onMouseEnter={composeEventHandlers(rest.onMouseEnter as any, activateSelf)}
           onPressIn={composeEventHandlers(rest.onPressIn as any, activateSelf)}
-          onFocus={composeEventHandlers(rest.onFocus as any, activateSelf)}
+          onFocus={composeEventHandlers(rest.onFocus as any, (event) => {
+            activateSelf()
+            popperContext.getReferenceProps?.({ ref: triggerElRef }).onFocus?.(event)
+          })}
+          onBlur={composeEventHandlers(rest.onBlur as any, (event) => {
+            popperContext.getReferenceProps?.({ ref: triggerElRef }).onBlur?.(event)
+          })}
         />
       )
 
```

---

### Incident Patch 9: `fd108d6e` (2026-09-19)
**Commit Message**: fix(core): preserve native ScrollView onScroll Fixes #4163

Team-Machine-Session: m15551

**File**: `code/core/core-test/webAlignment.native.test.tsx` (modified, +9/-0)
```diff
@@ -244,6 +244,15 @@ describe('Web Alignment - Native Event Mapping', () => {
   })
 
   describe('RN event props still work (kept for cross-platform compatibility)', () => {
+    test('onScroll is passed through on native ScrollViews', () => {
+      const handler = () => {}
+      const result = getSplitStylesFor({
+        onScroll: handler,
+      })
+
+      expect(result.viewProps.onScroll).toBe(handler)
+    })
+
     test('onPress is passed through on native', () => {
       const handler = () => {}
       const result = getSplitStylesFor({
```

**File**: `code/core/web/src/helpers/webPropsToSkip.native.ts` (modified, +0/-1)
```diff
@@ -45,7 +45,6 @@ export const webPropsToSkip = {
   onChange: 1,
   onInput: 1,
   onBeforeInput: 1,
-  onScroll: 1,
   onCopy: 1,
   onCut: 1,
   onPaste: 1,
```

**File**: `code/core/web/types/helpers/webPropsToSkip.native.d.ts` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ export declare const webPropsToSkip: {
     onChange: number;
     onInput: number;
     onBeforeInput: number;
-    onScroll: number;
     onCopy: number;
     onCut: number;
     onPaste: number;
```

---

### Incident Patch 10: `3bb99dfb` (2026-09-18)
**Commit Message**: fix(bun): pin bun 1.4.2

bun 1.4.0's --compile leaves a Mach-O whose signature no longer matches its
pages and macOS 27 kills it at launch. CI reads bun-version-file from
package.json, so packageManager moves with mise.toml and the workflows follow.

RAN: `bun install --frozen-lockfile --dry-run` under 1.4.2 exits 0.
Team-Machine-Session: r36885

**File**: `mise.toml` (modified, +1/-1)
```diff
@@ -1,2 +1,2 @@
 [tools]
-bun = "1.4.0"
+bun = "1.4.2"
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@
     "ws": "8.21.0",
     "yaml": "2.8.3"
   },
-  "packageManager": "bun@1.4.0",
+  "packageManager": "bun@1.4.2",
   "manypkg": {
     "workspaceProtocol": "require",
     "ignoredRules": [
```

---

### Incident Patch 11: `990f446a` (2026-09-14)
**Commit Message**: Merge branch 'fix/typescript-7-static-imports'

Land TypeScript 7 tsconfig path support onto main.

Team-Machine-Session: r31045

**File**: `bun.lock` (modified, +1/-0)
```diff
@@ -136,6 +136,7 @@
         "find-cache-dir": "^3.3.2",
         "find-root": "^1.1.0",
         "fs-extra": "^11.2.0",
+        "get-tsconfig": "^4.13.6",
         "invariant": "^2.2.4",
         "js-yaml": "^4.1.0",
         "react-native-web": "~0.21.0",
```

**File**: `code/compiler/static-tests/tests/tsconfigPaths.web.test.ts` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { pathToFileURL } from 'node:url'
+import { build } from 'esbuild'
+import { afterAll, describe, expect, test } from 'vitest'
+import {
+  loadTsconfigPathMatcher,
+  TsconfigPathsPlugin,
+} from '../../static/src/extractor/esbuildTsconfigPaths'
+
+const fixtureRoot = mkdtempSync(join(tmpdir(), 'tamagui-tsconfig-paths-'))
+
+afterAll(() => {
+  rmSync(fixtureRoot, { force: true, recursive: true })
+})
+
+describe('tsconfig path resolution', () => {
+  test('parses JSONC and resolves the most specific alias from the config directory', async () => {
+    mkdirSync(join(fixtureRoot, 'fallback', 'feature'), { recursive: true })
+    mkdirSync(join(fixtureRoot, 'src', 'feature'), { recursive: true })
+    const configPath = join(fixtureRoot, 'tsconfig.json')
+    const outputPath = join(fixtureRoot, 'bundle.mjs')
+    writeFileSync(
+      configPath,
+      `{
+        // consumer configs can contain comments and trailing commas
+        "compilerOptions": {
+          "baseUrl": ".",
+          "paths": {
+            "@app/*": ["fallback/*"],
+            "@app/feature/*": ["src/feature/*"],
+          },
+        },
+      }`
+    )
+    writeFileSync(
+      join(fixtureRoot, 'fallback', 'feature', 'button.ts'),
+      'export default 1'
+    )
+    writeFileSync(join(fixtureRoot, 'src', 'feature', 'button.ts'), 'export default 42')
+
+    const matchTsconfigPath = loadTsconfigPathMatcher(configPath)
+
+    expect(matchTsconfigPath('@app/feature/button')).toEqual([
+      join(fixtureRoot, 'src', 'feature', 'button'),
+    ])
+    expect(matchTsconfigPath('react')).toEqual([])
+
+    const previousDirectory = process.cwd()
+    try {
+      process.chdir(fixtureRoot)
+      const result = await build({
+        bundle: true,
+        format: 'esm',
+        outfile: outputPath,
+        platform: 'node',
+        plugins: [TsconfigPathsPlugin()],
+        stdin: {
+          contents: "export { default } from '@app/feature/button'",
+          resolveDir: fixtureRoot,
+          sourcefile: 'entry.ts',
+        },
+        write: false,
+      })
+      writeFileSync(outputPath, result.outputFiles[0].contents)
+    } finally {
+      process.chdir(previousDirectory)
+    }
+
+    const bundled = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`)
+    expect(bundled.default).toBe(42)
+  })
+})
```

**File**: `code/compiler/static/package.json` (modified, +1/-0)
```diff
@@ -73,6 +73,7 @@
     "find-cache-dir": "^3.3.2",
     "find-root": "^1.1.0",
     "fs-extra": "^11.2.0",
+    "get-tsconfig": "^4.13.6",
     "invariant": "^2.2.4",
     "js-yaml": "^4.1.0",
     "react-native-web": "~0.21.0"
```

**File**: `code/compiler/static/src/extractor/createExtractor.ts` (modified, +21/-35)
```diff
@@ -12,9 +12,8 @@ import {
   type StaticConfig,
   type TamaguiComponentState,
 } from '@tamagui/web'
-import { existsSync, readFileSync } from 'node:fs'
+import { existsSync, readFileSync, statSync } from 'node:fs'
 import { basename, dirname, resolve, relative } from 'node:path'
-import { nodeModuleNameResolver, sys } from 'typescript'
 import type { ViewStyle } from 'react-native'
 
 import { FAILED_EVAL } from '../constants'
@@ -51,7 +50,7 @@ import { setPropsToFontFamily } from './propsToFontFamilyCache'
 import { timer } from './timer'
 import { validHTMLAttributes } from './validHTMLAttributes'
 import { BailOptimizationError } from './errors'
-import { loadCompilerOptionsFromTsconfig } from './esbuildTsconfigPaths'
+import { loadTsconfigPathMatcher } from './esbuildTsconfigPaths'
 
 const UNTOUCHED_PROPS = {
   key: true,
@@ -182,57 +181,44 @@ export function createExtractor(
   const dynamicComponentCache = new Map<string, LoadedComponents>()
   const dynamicLoadingInProgress = new Set<string>()
 
-  // lazily loaded tsconfig compiler options for path alias resolution
-  let _compilerOptions: any = null
-  function getCompilerOptions() {
-    if (!_compilerOptions) {
+  // lazily loaded tsconfig path matcher for aliased source imports
+  let _matchTsconfigPath: ReturnType<typeof loadTsconfigPathMatcher> | null = null
+  function getTsconfigPathMatcher() {
+    if (!_matchTsconfigPath) {
       try {
-        _compilerOptions = loadCompilerOptionsFromTsconfig()
+        _matchTsconfigPath = loadTsconfigPathMatcher()
       } catch {
-        _compilerOptions = {}
+        _matchTsconfigPath = () => []
       }
     }
-    return _compilerOptions
+    return _matchTsconfigPath
   }
 
   function resolveImportPath(fromFile: string, importPath: string): string | null {
-    if (importPath.startsWith('.')) {
-      // relative path resolution
-      const dir = dirname(fromFile)
-      const base = resolve(dir, importPath)
-      const extensions = ['.tsx', '.ts', '.jsx', '.js']
+    const resolveSourcePath = (base: string) => {
+      if (existsSync(base) && statSync(base).isFile() && !base.endsWith('.d.ts')) {
+        return base
+      }
+      const extensions = ['.tsx', '.ts', '.mts', '.cts', '.jsx', '.js', '.mjs', '.cjs']
       for (const ext of extensions) {
         const full = base + ext
         if (existsSync(full)) return full
       }
-      // try index files
       for (const ext of extensions) {
         const full = resolve(base, `index${ext}`)
         if (existsSync(full)) return full
       }
       return null
     }
 
+    if (importPath.startsWith('.')) {
+      return resolveSourcePath(resolve(dirname(fromFile), importPath))
+    }
+
     // tsconfig path alias resolution (e.g. ~/foo, @/bar)
-    const compilerOptions = getCompilerOptions()
-    if (compilerOptions.paths) {
-      try {
-        const { resolvedModule } = nodeModuleNameResolver(
-          importPath,
-          fromFile,
-          compilerOptions,
-          sys
-        )
-        if (
-          resolvedModule &&
-          !resolvedModule.resolvedFileName.endsWith('.d.ts') &&
-          !resolvedModule.isExternalLibraryImport
-        ) {
-          return resolvedModule.resolvedFileName
-        }
-      } catch {
-        // fallback - tsconfig resolution failed
-      }
+    for (const candidate of getTsconfigPathMatcher()(importPath)) {
+      const resolved = resolveSourcePath(candidate)
+      if (resolved) return resolved
     }
 
     return null
```

**File**: `code/compiler/static/src/extractor/esbuildTsconfigPaths.ts` (modified, +64/-70)
```diff
@@ -1,103 +1,97 @@
 import type { Plugin } from 'esbuild'
+import {
+  createPathsMatcher,
+  getTsconfig,
+  parseTsconfig,
+  type TsConfigJsonResolved,
+  type TsConfigResult,
+} from 'get-tsconfig'
 import fs from 'node:fs'
 import path from 'node:path'
-import {
-  findConfigFile,
-  nodeModuleNameResolver,
-  parseJsonConfigFileContent,
-  readConfigFile,
-  sys,
-} from 'typescript'
 
 const name = 'tsconfig-paths'
 
-interface Tsconfig {
-  compilerOptions?: {
-    baseUrl?: string
-    paths?: Record<string, string[]>
-  }
-}
+type TsconfigPathMatcher = (specifier: string) => string[]
 
 export function TsconfigPathsPlugin(): Plugin {
-  const compilerOptions = loadCompilerOptionsFromTsconfig()
+  const matchTsconfigPath = loadTsconfigPathMatcher()
 
   return {
     name,
-    setup({ onResolve }) {
-      onResolve({ filter: /.*/ }, (args) => {
-        // skip @tamagui packages - they should be externalized, not resolved via tsconfig
-        if (args.path.startsWith('@tamagui/')) {
+    setup(build) {
+      build.onResolve({ filter: /.*/ }, async (args) => {
+        if (
+          args.pluginData &&
+          typeof args.pluginData === 'object' &&
+          args.pluginData.tamaguiTsconfigPathsResolved === true
+        ) {
           return null
         }
 
-        const paths = compilerOptions.paths || {}
-        const hasMatchingPath = Object.keys(paths).some((p) =>
-          new RegExp(p.replace('*', '\\w*')).test(args.path)
-        )
-
-        if (!hasMatchingPath) {
-          return null
-        }
-
-        const { resolvedModule } = nodeModuleNameResolver(
-          args.path,
-          args.importer,
-          compilerOptions,
-          sys
-        )
-
-        if (!resolvedModule) {
+        // skip @tamagui packages - they should be externalized, not resolved via tsconfig
+        if (args.path.startsWith('@tamagui/')) {
           return null
         }
 
-        const { resolvedFileName } = resolvedModule
-
-        if (!resolvedFileName || resolvedFileName.endsWith('.d.ts')) {
-          return null
+        for (const candidate of matchTsconfigPath(args.path)) {
+          const resolved = await build.resolve(candidate, {
+            importer: args.importer,
+            kind: args.kind,
+            namespace: args.namespace,
+            pluginData: {
+              ...(args.pluginData && typeof args.pluginData === 'object'
+                ? args.pluginData
+                : {}),
+              tamaguiTsconfigPathsResolved: true,
+            },
+            resolveDir: args.resolveDir,
+          })
+          if (
+            resolved.path &&
+            !resolved.path.endsWith('.d.ts') &&
+            resolved.errors.length === 0
+          ) {
+            return resolved
+          }
         }
 
-        return {
-          path: resolvedFileName,
-        }
+        return null
       })
     },
   }
 }
 
-export function loadCompilerOptionsFromTsconfig(tsconfig?: Tsconfig | string) {
+export function loadTsconfigPathMatcher(
+  tsconfig?: TsConfigJsonResolved | string
+): TsconfigPathMatcher {
+  let result: TsConfigResult | null
   if (!tsconfig) {
-    const configPath =
-      findConfigFile(process.cwd(), sys.fileExists, 'tsconfig.json') ||
-      findConfigFile(process.cwd(), sys.fileExists, 'jsconfig.json')
-
-    if (configPath) {
-      return parseTsconfig(configPath)
-    }
-    return {}
-  }
-
-  if (typeof tsconfig === 'string') {
+    result = getTsconfig(process.cwd()) || getTsconfig(process.cwd(), 'jsconfig.json')
+  } else if (typeof tsconfig === 'string') {
     if (fs.existsSync(tsconfig)) {
-      return parseTsconfig(tsconfig)
+      const configPath = path.resolve(tsconfig)
+      result = { config: parseTsconfig(configPath), path: configPath }
     } else {
       throw new Error(`Specified tsconfig file not found: ${tsconfig}`)
     }
+  } else {
+    result = { config: tsconfig, path: path.join(process.cwd(), 'tsconfig.json') }
   }
 
-  const baseDir = process.cwd()
-  const parsed = parseJsonConfigFileContent(tsconfig, sys, baseDir)
-  return parsed.options
-}
-
-function parseTsconfig(configFilePath: string) {
-  const configFile = readConfigFile(configFilePath, sys.readFile)
-  if (configFile.error) {
-    throw new Error(
-      `Error reading tsconfig file '${configFilePath}': ${configFile.error.messageText}`
-    )
+  if (!result) return () => []
+  const matchPaths = createPathsMatcher(result)
+  const patterns = Object.keys(result.config.compilerOptions?.paths || {})
+  if (!matchPaths || patterns.length === 0) return () => []
+
+  return (specifier) => {
+    const matchesExplicitPath = patterns.some((pattern) => {
+      const wildcardIndex = pattern.indexOf('*')
+      if (wildcardIndex === -1) return pattern === specifier
+      return (
+        specifier.startsWith(pattern.slice(0, wildcardIndex)) &&
+        specifier.endsWith(pattern.slice(wildcardIndex + 1))
+      )
+    })
+    return matchesExplicitPat
```

**File**: `code/compiler/static/types/extractor/esbuildTsconfigPaths.d.ts` (modified, +3/-7)
```diff
@@ -1,11 +1,7 @@
 import type { Plugin } from 'esbuild';
-interface Tsconfig {
-    compilerOptions?: {
-        baseUrl?: string;
-        paths?: Record<string, string[]>;
-    };
-}
+import { type TsConfigJsonResolved } from 'get-tsconfig';
+type TsconfigPathMatcher = (specifier: string) => string[];
 export declare function TsconfigPathsPlugin(): Plugin;
-export declare function loadCompilerOptionsFromTsconfig(tsconfig?: Tsconfig | string): import("typescript").CompilerOptions;
+export declare function loadTsconfigPathMatcher(tsconfig?: TsConfigJsonResolved | string): TsconfigPathMatcher;
 export {};
 //# sourceMappingURL=esbuildTsconfigPaths.d.ts.map
\ No newline at end of file
```

---

### Incident Patch 12: `687bb500` (2026-09-14)
**Commit Message**: fix(static): support TypeScript 7 tsconfig paths

Team-Machine-Session: p42910

**File**: `bun.lock` (modified, +1/-0)
```diff
@@ -136,6 +136,7 @@
         "find-cache-dir": "^3.3.2",
         "find-root": "^1.1.0",
         "fs-extra": "^11.2.0",
+        "get-tsconfig": "^4.13.6",
         "invariant": "^2.2.4",
         "js-yaml": "^4.1.0",
         "react-native-web": "~0.21.0",
```

**File**: `code/compiler/static-tests/tests/tsconfigPaths.web.test.ts` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
+import { tmpdir } from 'node:os'
+import { join } from 'node:path'
+import { pathToFileURL } from 'node:url'
+import { build } from 'esbuild'
+import { afterAll, describe, expect, test } from 'vitest'
+import {
+  loadTsconfigPathMatcher,
+  TsconfigPathsPlugin,
+} from '../../static/src/extractor/esbuildTsconfigPaths'
+
+const fixtureRoot = mkdtempSync(join(tmpdir(), 'tamagui-tsconfig-paths-'))
+
+afterAll(() => {
+  rmSync(fixtureRoot, { force: true, recursive: true })
+})
+
+describe('tsconfig path resolution', () => {
+  test('parses JSONC and resolves the most specific alias from the config directory', async () => {
+    mkdirSync(join(fixtureRoot, 'fallback', 'feature'), { recursive: true })
+    mkdirSync(join(fixtureRoot, 'src', 'feature'), { recursive: true })
+    const configPath = join(fixtureRoot, 'tsconfig.json')
+    const outputPath = join(fixtureRoot, 'bundle.mjs')
+    writeFileSync(
+      configPath,
+      `{
+        // consumer configs can contain comments and trailing commas
+        "compilerOptions": {
+          "baseUrl": ".",
+          "paths": {
+            "@app/*": ["fallback/*"],
+            "@app/feature/*": ["src/feature/*"],
+          },
+        },
+      }`
+    )
+    writeFileSync(
+      join(fixtureRoot, 'fallback', 'feature', 'button.ts'),
+      'export default 1'
+    )
+    writeFileSync(join(fixtureRoot, 'src', 'feature', 'button.ts'), 'export default 42')
+
+    const matchTsconfigPath = loadTsconfigPathMatcher(configPath)
+
+    expect(matchTsconfigPath('@app/feature/button')).toEqual([
+      join(fixtureRoot, 'src', 'feature', 'button'),
+    ])
+    expect(matchTsconfigPath('react')).toEqual([])
+
+    const previousDirectory = process.cwd()
+    try {
+      process.chdir(fixtureRoot)
+      const result = await build({
+        bundle: true,
+        format: 'esm',
+        outfile: outputPath,
+        platform: 'node',
+        plugins: [TsconfigPathsPlugin()],
+        stdin: {
+          contents: "export { default } from '@app/feature/button'",
+          resolveDir: fixtureRoot,
+          sourcefile: 'entry.ts',
+        },
+        write: false,
+      })
+      writeFileSync(outputPath, result.outputFiles[0].contents)
+    } finally {
+      process.chdir(previousDirectory)
+    }
+
+    const bundled = await import(`${pathToFileURL(outputPath).href}?test=${Date.now()}`)
+    expect(bundled.default).toBe(42)
+  })
+})
```

**File**: `code/compiler/static/package.json` (modified, +1/-0)
```diff
@@ -73,6 +73,7 @@
     "find-cache-dir": "^3.3.2",
     "find-root": "^1.1.0",
     "fs-extra": "^11.2.0",
+    "get-tsconfig": "^4.13.6",
     "invariant": "^2.2.4",
     "js-yaml": "^4.1.0",
     "react-native-web": "~0.21.0"
```

**File**: `code/compiler/static/src/extractor/createExtractor.ts` (modified, +21/-35)
```diff
@@ -12,9 +12,8 @@ import {
   type StaticConfig,
   type TamaguiComponentState,
 } from '@tamagui/web'
-import { existsSync, readFileSync } from 'node:fs'
+import { existsSync, readFileSync, statSync } from 'node:fs'
 import { basename, dirname, resolve, relative } from 'node:path'
-import { nodeModuleNameResolver, sys } from 'typescript'
 import type { ViewStyle } from 'react-native'
 
 import { FAILED_EVAL } from '../constants'
@@ -51,7 +50,7 @@ import { setPropsToFontFamily } from './propsToFontFamilyCache'
 import { timer } from './timer'
 import { validHTMLAttributes } from './validHTMLAttributes'
 import { BailOptimizationError } from './errors'
-import { loadCompilerOptionsFromTsconfig } from './esbuildTsconfigPaths'
+import { loadTsconfigPathMatcher } from './esbuildTsconfigPaths'
 
 const UNTOUCHED_PROPS = {
   key: true,
@@ -182,57 +181,44 @@ export function createExtractor(
   const dynamicComponentCache = new Map<string, LoadedComponents>()
   const dynamicLoadingInProgress = new Set<string>()
 
-  // lazily loaded tsconfig compiler options for path alias resolution
-  let _compilerOptions: any = null
-  function getCompilerOptions() {
-    if (!_compilerOptions) {
+  // lazily loaded tsconfig path matcher for aliased source imports
+  let _matchTsconfigPath: ReturnType<typeof loadTsconfigPathMatcher> | null = null
+  function getTsconfigPathMatcher() {
+    if (!_matchTsconfigPath) {
       try {
-        _compilerOptions = loadCompilerOptionsFromTsconfig()
+        _matchTsconfigPath = loadTsconfigPathMatcher()
       } catch {
-        _compilerOptions = {}
+        _matchTsconfigPath = () => []
       }
     }
-    return _compilerOptions
+    return _matchTsconfigPath
   }
 
   function resolveImportPath(fromFile: string, importPath: string): string | null {
-    if (importPath.startsWith('.')) {
-      // relative path resolution
-      const dir = dirname(fromFile)
-      const base = resolve(dir, importPath)
-      const extensions = ['.tsx', '.ts', '.jsx', '.js']
+    const resolveSourcePath = (base: string) => {
+      if (existsSync(base) && statSync(base).isFile() && !base.endsWith('.d.ts')) {
+        return base
+      }
+      const extensions = ['.tsx', '.ts', '.mts', '.cts', '.jsx', '.js', '.mjs', '.cjs']
       for (const ext of extensions) {
         const full = base + ext
         if (existsSync(full)) return full
       }
-      // try index files
       for (const ext of extensions) {
         const full = resolve(base, `index${ext}`)
         if (existsSync(full)) return full
       }
       return null
     }
 
+    if (importPath.startsWith('.')) {
+      return resolveSourcePath(resolve(dirname(fromFile), importPath))
+    }
+
     // tsconfig path alias resolution (e.g. ~/foo, @/bar)
-    const compilerOptions = getCompilerOptions()
-    if (compilerOptions.paths) {
-      try {
-        const { resolvedModule } = nodeModuleNameResolver(
-          importPath,
-          fromFile,
-          compilerOptions,
-          sys
-        )
-        if (
-          resolvedModule &&
-          !resolvedModule.resolvedFileName.endsWith('.d.ts') &&
-          !resolvedModule.isExternalLibraryImport
-        ) {
-          return resolvedModule.resolvedFileName
-        }
-      } catch {
-        // fallback - tsconfig resolution failed
-      }
+    for (const candidate of getTsconfigPathMatcher()(importPath)) {
+      const resolved = resolveSourcePath(candidate)
+      if (resolved) return resolved
     }
 
     return null
```

**File**: `code/compiler/static/src/extractor/esbuildTsconfigPaths.ts` (modified, +64/-70)
```diff
@@ -1,103 +1,97 @@
 import type { Plugin } from 'esbuild'
+import {
+  createPathsMatcher,
+  getTsconfig,
+  parseTsconfig,
+  type TsConfigJsonResolved,
+  type TsConfigResult,
+} from 'get-tsconfig'
 import fs from 'node:fs'
 import path from 'node:path'
-import {
-  findConfigFile,
-  nodeModuleNameResolver,
-  parseJsonConfigFileContent,
-  readConfigFile,
-  sys,
-} from 'typescript'
 
 const name = 'tsconfig-paths'
 
-interface Tsconfig {
-  compilerOptions?: {
-    baseUrl?: string
-    paths?: Record<string, string[]>
-  }
-}
+type TsconfigPathMatcher = (specifier: string) => string[]
 
 export function TsconfigPathsPlugin(): Plugin {
-  const compilerOptions = loadCompilerOptionsFromTsconfig()
+  const matchTsconfigPath = loadTsconfigPathMatcher()
 
   return {
     name,
-    setup({ onResolve }) {
-      onResolve({ filter: /.*/ }, (args) => {
-        // skip @tamagui packages - they should be externalized, not resolved via tsconfig
-        if (args.path.startsWith('@tamagui/')) {
+    setup(build) {
+      build.onResolve({ filter: /.*/ }, async (args) => {
+        if (
+          args.pluginData &&
+          typeof args.pluginData === 'object' &&
+          args.pluginData.tamaguiTsconfigPathsResolved === true
+        ) {
           return null
         }
 
-        const paths = compilerOptions.paths || {}
-        const hasMatchingPath = Object.keys(paths).some((p) =>
-          new RegExp(p.replace('*', '\\w*')).test(args.path)
-        )
-
-        if (!hasMatchingPath) {
-          return null
-        }
-
-        const { resolvedModule } = nodeModuleNameResolver(
-          args.path,
-          args.importer,
-          compilerOptions,
-          sys
-        )
-
-        if (!resolvedModule) {
+        // skip @tamagui packages - they should be externalized, not resolved via tsconfig
+        if (args.path.startsWith('@tamagui/')) {
           return null
         }
 
-        const { resolvedFileName } = resolvedModule
-
-        if (!resolvedFileName || resolvedFileName.endsWith('.d.ts')) {
-          return null
+        for (const candidate of matchTsconfigPath(args.path)) {
+          const resolved = await build.resolve(candidate, {
+            importer: args.importer,
+            kind: args.kind,
+            namespace: args.namespace,
+            pluginData: {
+              ...(args.pluginData && typeof args.pluginData === 'object'
+                ? args.pluginData
+                : {}),
+              tamaguiTsconfigPathsResolved: true,
+            },
+            resolveDir: args.resolveDir,
+          })
+          if (
+            resolved.path &&
+            !resolved.path.endsWith('.d.ts') &&
+            resolved.errors.length === 0
+          ) {
+            return resolved
+          }
         }
 
-        return {
-          path: resolvedFileName,
-        }
+        return null
       })
     },
   }
 }
 
-export function loadCompilerOptionsFromTsconfig(tsconfig?: Tsconfig | string) {
+export function loadTsconfigPathMatcher(
+  tsconfig?: TsConfigJsonResolved | string
+): TsconfigPathMatcher {
+  let result: TsConfigResult | null
   if (!tsconfig) {
-    const configPath =
-      findConfigFile(process.cwd(), sys.fileExists, 'tsconfig.json') ||
-      findConfigFile(process.cwd(), sys.fileExists, 'jsconfig.json')
-
-    if (configPath) {
-      return parseTsconfig(configPath)
-    }
-    return {}
-  }
-
-  if (typeof tsconfig === 'string') {
+    result = getTsconfig(process.cwd()) || getTsconfig(process.cwd(), 'jsconfig.json')
+  } else if (typeof tsconfig === 'string') {
     if (fs.existsSync(tsconfig)) {
-      return parseTsconfig(tsconfig)
+      const configPath = path.resolve(tsconfig)
+      result = { config: parseTsconfig(configPath), path: configPath }
     } else {
       throw new Error(`Specified tsconfig file not found: ${tsconfig}`)
     }
+  } else {
+    result = { config: tsconfig, path: path.join(process.cwd(), 'tsconfig.json') }
   }
 
-  const baseDir = process.cwd()
-  const parsed = parseJsonConfigFileContent(tsconfig, sys, baseDir)
-  return parsed.options
-}
-
-function parseTsconfig(configFilePath: string) {
-  const configFile = readConfigFile(configFilePath, sys.readFile)
-  if (configFile.error) {
-    throw new Error(
-      `Error reading tsconfig file '${configFilePath}': ${configFile.error.messageText}`
-    )
+  if (!result) return () => []
+  const matchPaths = createPathsMatcher(result)
+  const patterns = Object.keys(result.config.compilerOptions?.paths || {})
+  if (!matchPaths || patterns.length === 0) return () => []
+
+  return (specifier) => {
+    const matchesExplicitPath = patterns.some((pattern) => {
+      const wildcardIndex = pattern.indexOf('*')
+      if (wildcardIndex === -1) return pattern === specifier
+      return (
+        specifier.startsWith(pattern.slice(0, wildcardIndex)) &&
+        specifier.endsWith(pattern.slice(wildcardIndex + 1))
+      )
+    })
+    return matchesExplicitPat
```

**File**: `code/compiler/static/types/extractor/esbuildTsconfigPaths.d.ts` (modified, +3/-7)
```diff
@@ -1,11 +1,7 @@
 import type { Plugin } from 'esbuild';
-interface Tsconfig {
-    compilerOptions?: {
-        baseUrl?: string;
-        paths?: Record<string, string[]>;
-    };
-}
+import { type TsConfigJsonResolved } from 'get-tsconfig';
+type TsconfigPathMatcher = (specifier: string) => string[];
 export declare function TsconfigPathsPlugin(): Plugin;
-export declare function loadCompilerOptionsFromTsconfig(tsconfig?: Tsconfig | string): import("typescript").CompilerOptions;
+export declare function loadTsconfigPathMatcher(tsconfig?: TsConfigJsonResolved | string): TsconfigPathMatcher;
 export {};
 //# sourceMappingURL=esbuildTsconfigPaths.d.ts.map
\ No newline at end of file
```

---

### Incident Patch 13: `dccd1ada` (2026-09-12)
**Commit Message**: site: keep Supabase service key out of Docker builds

Team-Machine-Session: p41720

**File**: `Dockerfile` (modified, +0/-1)
```diff
@@ -31,7 +31,6 @@ ARG SHOULD_UNLOCK_GIT_CRYPT
 ARG STRIPE_SECRET_KEY
 ARG STRIPE_SIGNING_SIGNATURE_SECRET
 ARG STUDIO_JWT_SECRET
-ARG SUPABASE_SERVICE_ROLE_KEY
 ARG TAKEOUT_RENEWAL_COUPON_ID
 ARG URL
 ARG ONE_SERVER_URL
```

---

### Incident Patch 14: `5e4a2c50` (2026-09-09)
**Commit Message**: docs(skill): correct the animation prop and shadow props in the tamagui skill

The draft skill taught `animation="quick"` in 16 places across SKILL.md and the
two references. There is no `animation` prop: `animation?:` appears nowhere in
code/core/web/src, in 2.7.7 or in the 3.0 beta. The prop is `transition` and it
takes a TransitionProp, so every one of those examples produced code that does
nothing.

Also replaced the legacy RN shadow group in the canonical styled() example with
boxShadow, and added two anti-patterns: the invented animation prop, and
assuming backdropFilter / mixBlendMode / boxShadow / filter are web-only when
the New Architecture implements them natively.

Kept the $ sigil grammar throughout, which is correct for 2.7.7 on latest.

Team-Machine-Session: p40315

**File**: `plans/tamagui-skill/skills/tamagui/SKILL.md` (modified, +45/-6)
```diff
@@ -53,8 +53,7 @@ const Card = styled(View, {
     },
     elevated: {
       true: {
-        shadowColor: '$shadowColor',
-        shadowRadius: 10,
+        boxShadow: '0 8px 24px $shadow4',
       },
     },
   } as const,  // required for type inference
@@ -149,7 +148,7 @@ import { AnimatePresence } from 'tamagui'
   {show && (
     <YStack
       key="modal"  // key required for exit animations
-      animation="quick"
+      transition="quick"
       enterStyle={{ opacity: 0, y: -20 }}
       exitStyle={{ opacity: 0, y: 20 }}
       opacity={1}
@@ -242,14 +241,14 @@ import { Dialog, Sheet, Adapt, Button } from 'tamagui'
   <Dialog.Portal>
     <Dialog.Overlay
       key="overlay"
-      animation="quick"
+      transition="quick"
       opacity={0.5}
       enterStyle={{ opacity: 0 }}
       exitStyle={{ opacity: 0 }}
     />
     <Dialog.Content
       key="content"
-      animation="quick"
+      transition="quick"
       enterStyle={{ opacity: 0, scale: 0.95 }}
       exitStyle={{ opacity: 0, scale: 0.95 }}
     >
@@ -290,6 +289,46 @@ import { Input, Label, YStack, XStack, Button } from 'tamagui'
 
 ## Anti-Patterns
 
+### ❌ The `animation` prop
+
+There is no `animation` prop. It is the most commonly invented one. The prop is
+`transition`, and its value is a `TransitionProp`: a configured animation name,
+an object, or an array. A CSS transition string is not one.
+
+```tsx
+// bad - no such prop
+<View animation="quick" />
+
+// bad - a CSS string is not a TransitionProp
+<View transition="all 0.2s ease" />
+
+// good - a name the config registers under `animations`
+<View transition="quick" />
+```
+
+Use `animatedBy="<driver>"` only when the config registers more than one driver.
+
+### ❌ Assuming modern style props are web-only
+
+`backdropFilter`, `mixBlendMode`, `boxShadow`, `filter`, `backgroundImage`,
+`transition`, `cursor`, and `userSelect` are first-class typed props that React
+Native's New Architecture implements natively. `backdropFilter` is a real native
+gaussian backdrop blur, so frosting a surface needs no separate blur view
+package. Treating one of these as a no-op on iOS is a stale assumption.
+
+```tsx
+// bad - the legacy RN shadow group splits web and native
+<View shadowColor="$shadowColor" shadowOffset={{ width: 0, height: 8 }} shadowRadius={10} />
+
+// good - one tokenized path for both
+<View boxShadow="0 8px 24px $shadow4" />
+```
+
+Tamagui is moving this way itself: a config setting removes the border, outline,
+and shadow longhands from the type system in favor of the combined `border`,
+`outline`, and `boxShadow` props, because mixing shorthand and longhand fights
+over atomic CSS specificity.
+
 ### ❌ Hardcoded values instead of tokens
 
 ```tsx
@@ -426,7 +465,7 @@ interface ExtendedProps extends MyComponentProps {
 | Color scale | `color="$color11"` (high contrast text) |
 | Responsive | `$gtSm={{ padding: '$6' }}` |
 | Variant | `<Button size="large" variant="outlined" />` |
-| Animation | `animation="quick" enterStyle={{ opacity: 0 }}` |
+| Animation | `transition="quick" enterStyle={{ opacity: 0 }}` |
 | Theme switch | `<Theme name="dark"><Theme name="blue">` |
 | Compound | `<Card><Card.Title>` with `createStyledContext` |
 
```

**File**: `plans/tamagui-skill/skills/tamagui/references/animations.md` (modified, +10/-10)
```diff
@@ -77,7 +77,7 @@ const animations = createAnimations({
 
 ```tsx
 <View
-  animation="medium"
+  transition="medium"
   opacity={isVisible ? 1 : 0}
   y={isVisible ? 0 : 10}
 />
@@ -87,7 +87,7 @@ const animations = createAnimations({
 
 ```tsx
 <View
-  animation="fast"
+  transition="fast"
   enterStyle={{
     opacity: 0,
     y: -20,
@@ -115,7 +115,7 @@ import { AnimatePresence } from 'tamagui'
   {show && (
     <View
       key="unique-key"  // key is required
-      animation="medium"
+      transition="medium"
       enterStyle={{ opacity: 0 }}
       exitStyle={{ opacity: 0 }}
       opacity={1}
@@ -130,7 +130,7 @@ Override animation for specific properties:
 
 ```tsx
 <View
-  animation={[
+  transition={[
     'fast',
     {
       opacity: { type: 'timing', duration: 500 },
@@ -160,7 +160,7 @@ State-based animations:
 
 ```tsx
 <Button
-  animation="fast"
+  transition="fast"
   hoverStyle={{
     scale: 1.05,
     backgroundColor: '$blue9',
@@ -201,7 +201,7 @@ const AnimatedCard = styled(View, {
 
 ```tsx
 <View
-  animation="medium"
+  transition="medium"
   enterStyle={{ opacity: 0 }}
   opacity={1}
 />
@@ -211,7 +211,7 @@ const AnimatedCard = styled(View, {
 
 ```tsx
 <View
-  animation="fast"
+  transition="fast"
   enterStyle={{ opacity: 0, y: 20 }}
   opacity={1}
   y={0}
@@ -222,7 +222,7 @@ const AnimatedCard = styled(View, {
 
 ```tsx
 <View
-  animation="bouncy"
+  transition="bouncy"
   enterStyle={{ opacity: 0, scale: 0.8 }}
   opacity={1}
   scale={1}
@@ -233,7 +233,7 @@ const AnimatedCard = styled(View, {
 
 ```tsx
 <Dialog.Overlay
-  animation="fast"
+  transition="fast"
   enterStyle={{ opacity: 0 }}
   exitStyle={{ opacity: 0 }}
   opacity={0.5}
@@ -244,7 +244,7 @@ const AnimatedCard = styled(View, {
 
 ```tsx
 <Dialog.Content
-  animation={['medium', { opacity: { overshootClamping: true } }]}
+  transition={['medium', { opacity: { overshootClamping: true } }]}
   enterStyle={{ opacity: 0, y: -20, scale: 0.95 }}
   exitStyle={{ opacity: 0, y: 10, scale: 0.98 }}
   opacity={1}
```

**File**: `plans/tamagui-skill/skills/tamagui/references/components.md` (modified, +1/-1)
```diff
@@ -275,7 +275,7 @@ import { Spinner } from 'tamagui'
 import { Progress } from 'tamagui'
 
 <Progress value={60}>
-  <Progress.Indicator animation="bouncy" />
+  <Progress.Indicator transition="bouncy" />
 </Progress>
 ```
 
```

---

### Incident Patch 15: `ec4bbced` (2026-09-03)
**Commit Message**: fix(slider): use track-relative pointer coords on web so scrolling can't drift the value Fixes #4146

Co-authored-by: Mad Dinh <[REDACTED_EMAIL]>
Team-Machine-Session: m12700

**File**: `code/kitchen-sink/src/constants/test-ids.ts` (modified, +5/-0)
```diff
@@ -49,4 +49,9 @@ export const TEST_IDS = {
   accentBgToken: 'accent-bg-token',
   baseBackground: 'base-background',
   baseButton: 'base-button',
+  // Slider scroll offset test IDs (Issue #4146)
+  sliderScrollVertical: 'slider-scroll-vertical',
+  sliderScrollVerticalValue: 'slider-scroll-vertical-value',
+  sliderScrollHorizontal: 'slider-scroll-horizontal',
+  sliderScrollHorizontalValue: 'slider-scroll-horizontal-value',
 } as const
```

**File**: `code/kitchen-sink/src/usecases/SliderScrollOffsetCase.tsx` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+import { useState } from 'react'
+import { Slider, Text, YStack } from 'tamagui'
+
+import { TEST_IDS } from '../constants/test-ids'
+
+/**
+ * Test case for GitHub issue #4146: slider thumb stops following the cursor once
+ * the page is scrolled.
+ *
+ * A responder event's pageX/pageY are document-relative, while the track is
+ * measured with getBoundingClientRect (viewport-relative). Mixing the two makes
+ * the reported value drift by exactly the scroll offset, so the case puts a tall
+ * spacer above the sliders to force a scroll before dragging.
+ */
+export function SliderScrollOffsetCase() {
+  const [vertical, setVertical] = useState([50])
+  const [horizontal, setHorizontal] = useState([50])
+
+  return (
+    <YStack padding="$4" gap="$4">
+      {/* pushes the sliders below the fold so the drag happens while scrolled */}
+      <YStack height={1200} backgroundColor="$color3" />
+
+      <Text id={TEST_IDS.sliderScrollVerticalValue}>{vertical[0]}</Text>
+      <Slider
+        id={TEST_IDS.sliderScrollVertical}
+        orientation="vertical"
+        height={200}
+        width={20}
+        value={vertical}
+        onValueChange={setVertical}
+        min={0}
+        max={100}
+        step={1}
+      >
+        <Slider.Track>
+          <Slider.TrackActive />
+        </Slider.Track>
+        <Slider.Thumb index={0} circular size="$2" />
+      </Slider>
+
+      {/* makes the document wider than the viewport so the horizontal slider can
+          only be reached by scrolling on x, which is what its test needs */}
+      <YStack width={3000} height={1} />
+
+      <Text id={TEST_IDS.sliderScrollHorizontalValue} marginLeft={1400}>
+        {horizontal[0]}
+      </Text>
+      <Slider
+        id={TEST_IDS.sliderScrollHorizontal}
+        orientation="horizontal"
+        marginLeft={1400}
+        width={200}
+        value={horizontal}
+        onValueChange={setHorizontal}
+        min={0}
+        max={100}
+        step={1}
+      >
+        <Slider.Track>
+          <Slider.TrackActive />
+        </Slider.Track>
+        <Slider.Thumb index={0} circular size="$2" />
+      </Slider>
+
+      <YStack height={600} />
+    </YStack>
+  )
+}
```

**File**: `code/kitchen-sink/src/usecases/index.web.ts` (modified, +2/-0)
```diff
@@ -284,6 +284,8 @@ const loaders: Record<string, () => ComponentType<any>> = {
   VariantsOrder: () => require('./VariantsOrder').VariantsOrder,
   ZIndex: () => require('./ZIndex').ZIndex,
   NestedPressExclusive: () => require('./NestedPressExclusive').NestedPressExclusive,
+  SliderScrollOffsetCase: () =>
+    require('./SliderScrollOffsetCase').SliderScrollOffsetCase,
 }
 
 export const useCases: Record<string, ComponentType<any>> = {}
```

**File**: `code/kitchen-sink/tests/SliderScrollOffset.test.tsx` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+import { expect, test } from '@playwright/test'
+import { setupPage } from './test-utils'
+import { TEST_IDS } from '../src/constants/test-ids'
+
+/**
+ * Tests for GitHub issue #4146: the slider thumb stops following the cursor once
+ * the page is scrolled.
+ *
+ * A responder event's pageX/pageY come straight off the DOM event and are
+ * document-relative, while the track is measured with getBoundingClientRect and
+ * is viewport-relative. Mixing the two makes the dragged value drift by exactly
+ * the scroll offset, and with a tall page it saturates at the minimum.
+ *
+ * The press itself is unaffected (it uses locationY, which is already relative to
+ * the responder element), so these tests have to *drag* to exercise the bug.
+ */
+
+test.beforeEach(async ({ page }) => {
+  await setupPage(page, { name: 'SliderScrollOffsetCase', type: 'useCase' })
+})
+
+test('vertical slider tracks the cursor after the page is scrolled', async ({ page }) => {
+  const slider = page.locator(`#${TEST_IDS.sliderScrollVertical}`)
+  await slider.scrollIntoViewIfNeeded()
+
+  // the whole point of the repro: without a scroll offset the bug can't show
+  const scrollY = await page.evaluate(() => window.scrollY)
+  expect(scrollY).toBeGreaterThan(0)
+
+  const box = (await slider.boundingBox())!
+  expect(box).not.toBeNull()
+
+  // drag from the middle of the track to a quarter down from the top
+  const targetY = box.y + box.height * 0.25
+  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
+  await page.mouse.down()
+  await page.mouse.move(box.x + box.width / 2, targetY, { steps: 10 })
+  await page.mouse.up()
+
+  // vertical runs bottom(min) -> top(max)
+  const expected = 100 - ((targetY - box.y) / box.height) * 100
+  const value = Number(
+    await page.locator(`#${TEST_IDS.sliderScrollVerticalValue}`).innerText()
+  )
+  expect(value).toBeGreaterThan(expected - 4)
+  expect(value).toBeLessThan(expected + 4)
+})
+
+test('horizontal slider tracks the cursor after the page is scrolled', async ({
+  page,
+}) => {
+  const slider = page.locator(`#${TEST_IDS.sliderScrollHorizontal}`)
+  await slider.scrollIntoViewIfNeeded()
+
+  // a horizontal drag only drifts if the page is scrolled on x, and the slider
+  // may already be in view on a wide viewport, so scroll x by hand. the case has
+  // a 3000px spacer so there is always room for this
+  await page.evaluate(() => window.scrollBy(400, 0))
+  const scrollX = await page.evaluate(() => window.scrollX)
+  expect(scrollX).toBeGreaterThan(0)
+
+  const box = (await slider.boundingBox())!
+  expect(box).not.toBeNull()
+
+  const targetX = box.x + box.width * 0.75
+  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
+  await page.mouse.down()
+  await page.mouse.move(targetX, box.y + box.height / 2, { steps: 10 })
+  await page.mouse.up()
+
+  const expected = ((targetX - box.x) / box.width) * 100
+  const value = Number(
+    await page.locator(`#${TEST_IDS.sliderScrollHorizontalValue}`).innerText()
+  )
+  expect(value).toBeGreaterThan(expected - 4)
+  expect(value).toBeLessThan(expected + 4)
+})
+
+test('vertical slider tracks the cursor after a scroll that does not re-measure', async ({
+  page,
+}) => {
+  const slider = page.locator(`#${TEST_IDS.sliderScrollVertical}`)
+  await slider.scrollIntoViewIfNeeded()
+
+  // park the track a fixed distance down the viewport so the nudge below can't
+  // push it out of view or cross an IntersectionObserver threshold
+  await page.evaluate(() => {
+    const el = document.getElementById('slider-scroll-vertical')!
+    window.scrollBy(0, el.getBoundingClientRect().top - 300)
+  })
+  // the measure is debounced 200ms behind the observer, so let it settle first,
+  // otherwise the cached offset is stale for a reason this test isn't about
+  await page.waitForTimeout(500)
+
+  // nudge the page while the track stays fully visible. nothing re-measures on
+  // scroll: only resize, an observer threshold crossing, and a 1s interval. so
+  // the cached offset is now wrong, and any math that subtracts it drifts by 60px.
+  // locationY is read against the live rect and doesn't care.
+  await page.evaluate(() => window.scrollBy(0, 60))
+
+  const box = (await slider.boundingBox())!
+  const targetY = box.y + box.height * 0.25
+  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
+  await page.mouse.down()
+  await page.mouse.move(box.x + box.width / 2, targetY, { steps: 10 })
+  await page.mouse.up()
+
+  const expected = 100 - ((targetY - box.y) / box.height) * 100
+  const value = Number(
+    await page.locator(`#${TEST_IDS.sliderScrollVerticalValue}`).innerText()
+  )
+  expect(value).toBeGreaterThan(expected - 4)
+  expect(value).toBeLessThan(expected + 4)
+})
```

**File**: `code/ui/slider/src/Slider.tsx` (modified, +33/-4)
```diff
@@ -72,6 +72,27 @@ if (process.env.TAMAGUI_TARGET === 'web') {
   }
 }
 
+// on web a responder event's pageX/pageY come straight off the DOM event and are
+// document-relative, while `measure` reports the track through getBoundingClientRect
+// and is viewport-relative. subtracting the cached offset therefore mixes origins and
+// the thumb lags the cursor by exactly the page scroll (#4146). locationX/locationY
+// are `client - track.getBoundingClientRect()`, read fresh on every event, so they
+// need no offset at all - which is why onSlideStart was already correct. that also
+// closes the window where the cached offset is stale: nothing re-measures on scroll,
+// only on resize, an IntersectionObserver threshold crossing, and a 1s interval.
+// native measures the track and the touch against the screen, so it keeps the offset.
+const getTrackPosition = (
+  event: GestureReponderEvent,
+  offset: number,
+  orientation: 'horizontal' | 'vertical'
+) => {
+  const { locationX, locationY, pageX, pageY } = event.nativeEvent
+  if (isWeb) {
+    return orientation === 'horizontal' ? locationX : locationY
+  }
+  return (orientation === 'horizontal' ? pageX : pageY) - offset
+}
+
 /* -------------------------------------------------------------------------------------------------
  * SliderHorizontal
  * -----------------------------------------------------------------------------------------------*/
@@ -136,13 +157,17 @@ const SliderHorizontal = React.forwardRef<View, SliderHorizontalProps>(
             }
           }}
           onSlideMove={(event) => {
-            const value = getValueFromPointer(event.nativeEvent.pageX - state.offset)
+            const value = getValueFromPointer(
+              getTrackPosition(event, state.offset, 'horizontal')
+            )
             if (value) {
               onSlideMove?.(value, event)
             }
           }}
           onSlideEnd={(event) => {
-            const value = getValueFromPointer(event.nativeEvent.pageX - state.offset)
+            const value = getValueFromPointer(
+              getTrackPosition(event, state.offset, 'horizontal')
+            )
             if (value) {
               onSlideEnd?.(event, value)
             }
@@ -276,13 +301,17 @@ const SliderVertical = React.forwardRef<View, SliderVerticalProps>(
             }
           }}
           onSlideMove={(event) => {
-            const value = getValueFromPointer(event.nativeEvent.pageY - state.offset)
+            const value = getValueFromPointer(
+              getTrackPosition(event, state.offset, 'vertical')
+            )
             if (value) {
               onSlideMove?.(value, event)
             }
           }}
           onSlideEnd={(event) => {
-            const value = getValueFromPointer(event.nativeEvent.pageY - state.offset)
+            const value = getValueFromPointer(
+              getTrackPosition(event, state.offset, 'vertical')
+            )
             onSlideEnd?.(event, value)
           }}
           onStepKeyDown={(event) => {
```

#### Recent Merged Pull Requests:
- **PR #4234** (2026-09-27): fix(sheet): ignore unrelated Adapt parents (@natew)
- **PR #4228** (closed): site: align browser tests with deployed v3 site (@natew)
- **PR #4227** (2026-09-19): ci: retry transient npm OIDC failures (@natew)
- **PR #4226** (2026-09-22): ci: retry transient npm audit failures (@natew)
- **PR #4225** (2026-09-19): docs: finalize v2 bug triage status (@natew)
- **PR #4224** (2026-09-19): docs: record v2 bug triage for v3 rc1 (@natew)
- **PR #4223** (2026-09-19): fix(button): reset disabled accessibility state (@natew)
- **PR #4222** (2026-09-19): fix(popover): compose floating focus handlers on triggers (@natew)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
