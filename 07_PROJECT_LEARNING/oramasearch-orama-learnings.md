# Forensic Learning Record (Deep Inspection): oramasearch/orama

> **Canonical Artifact**: `07_PROJECT_LEARNING/oramasearch-orama-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oramasearch/orama](https://github.com/oramasearch/orama))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:59:01.160Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oramasearch/orama`
- **Description**: 🌌  A complete search engine and RAG pipeline in your browser, server or edge network with support for full-text, vector, and hybrid search in less than 2kb.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10570 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/orama/src/components/hooks.ts`
```
import {
  BeforeSearch,
  AfterSearch,
  AnyOrama,
  MultipleCallbackComponent,
  Results,
  SearchParams,
  SingleCallbackComponent,
  TypedDocument,
  AfterCreate
} from '../types.js'
import { isAsyncFunction } from '../utils.js'

export const OBJECT_COMPONENTS = ['tokenizer', 'index', 'documentsStore', 'sorter', 'pinning']

export const FUNCTION_COMPONENTS = [
  'validateSchema',
  'getDocumentIndexId',
  'getDocumentProperties',
  'formatElapsedTime'
]

export const SINGLE_OR_ARRAY_COMPONENTS = [
  /* deprecated with v2.0.0-beta.5 */
]

export function runSingleHook<T extends AnyOrama, ResultDocument extends TypedDocument<T>>(
  hooks: SingleCallbackComponent<T>[],
  orama: T,
  id: string,
  doc?: ResultDocument
): Promise<void> | void {
  const needAsync = hooks.some(isAsyncFunction)

  if (needAsync) {
    return (async () => {
      for (const hook of hooks) {
        await hook(orama, id, doc)
      }
    })()
  } else {
    for (const hook of hooks) {
      hook(orama, id, doc)
    }
  }
}

export function runMultipleHook<T extends AnyOrama, ResultDocument extends TypedDocument<T>>(
  hooks: MultipleCallbackComponent<T>[],
  orama: T,
  docsOrIds: ResultDocument[] | string[]
): Promise<void> | void {
  const needAsync = hooks.some(isAsyncFunction)

  if (needAsync) {
    return (async () => {
      for (const hook of hooks) {
        await hook(orama, docsOrIds)
      }
    })()
  } else {
    for (const hook of hooks) {
      hook(orama, docsOrIds)
    }
  }
}
export function runAfterSearch<T extends AnyOrama, ResultDocument extends TypedDocument<T>>(
  hooks: AfterSearch<T, ResultDocument>[],
  db: T,
  params: SearchParams<T, ResultDocument>,
  language: string | undefined,
  results: Results<ResultDocument>
): Promise<void> | void {
  const needAsync = hooks.some(isAsyncFunction)

  if (needAsync) {
    return (async () => {
      for (const hook of hooks) {
        await hook(db, params, language, results)
      }
    })()
  } else {
    for (const hook of hooks) {
      hook(db, params, language, results)
    }
  }
}

export function runBeforeSearch<T extends AnyOrama>(
  hooks: BeforeSearch<T>[],
  db: T,
  params: SearchParams<T, TypedDocument<any>>,
  language: string | undefined
): Promise<void> | void {
  const needAsync = hooks.some(isAsyncFunction)
  if (needAsync) {
    return (async () => {
      for (const hook of hooks) {
        await hook(db, params, language)
      }
    })()
  } else {
    for (const hook of hooks) {
      hook(db, params, language)
    }
  }
}

export function runAfterCreate<T extends AnyOrama>(hooks: AfterCreate<T>[], db: T): Promise<void> | void {
  const needAsync = hooks.some(isAsyncFunction)

  if (needAsync) {
    return (async () => {
      for (const hook of hooks) {
        await hook(db)
      }
    })()
  } else {
    for (const hook of hooks) {
      hook(db)
    }
  }
}

```

### Core Architecture Module: `packages/orama/src/utils.ts`
```
import type { AnyDocument, GeosearchDistanceUnit, Optional, Results, SearchableValue, TokenScore } from './types.js'
import { createError } from './errors.js'

const baseId = Date.now().toString().slice(5)
let lastId = 0

const k = 1024
const nano = BigInt(1e3)
const milli = BigInt(1e6)
const second = BigInt(1e9)

export const isServer = typeof window === 'undefined'

/**
 * This value can be increased up to 100_000
 * But i don't know if this value change from nodejs to nodejs
 * So I will keep a safer value here.
 */
export const MAX_ARGUMENT_FOR_STACK = 65535

/**
 * This method is needed to used because of issues like: https://github.com/oramasearch/orama/issues/301
 * that issue is caused because the array that is pushed is huge (>100k)
 *
 * @example
 * ```ts
 * safeArrayPush(myArray, [1, 2])
 * ```
 */
export function safeArrayPush<T>(arr: T[], newArr: T[]): void {
  if (newArr.length < MAX_ARGUMENT_FOR_STACK) {
    Array.prototype.push.apply(arr, newArr)
  } else {
    const newArrLength = newArr.length
    for (let i = 0; i < newArrLength; i += MAX_ARGUMENT_FOR_STACK) {
      Array.prototype.push.apply(arr, newArr.slice(i, i + MAX_ARGUMENT_FOR_STACK))
    }
  }
}

export function sprintf(template: string, ...args: Array<string | number>): string {
  return template.replace(
    /%(?:(?<position>\d+)\$)?(?<width>-?\d*\.?\d*)(?<type>[dfs])/g,
    function (...replaceArgs: Array<string | number | Record<string, string>>): string {
      const groups = replaceArgs[replaceArgs.length - 1] as Record<string, string>
      const { width: rawWidth, type, position } = groups

      const replacement = position ? args[Number.parseInt(position) - 1]! : args.shift()!
      const width = rawWidth === '' ? 0 : Number.parseInt(rawWidth)

      switch (type) {
        case 'd':
          return replacement.toString().padStart(width, '0')
        case 'f': {
          let value = replacement
          const [padding, precision] = rawWidth.split('.').map((w) => Number.parseFloat(w))

          if (typeof precision === 'number' && precision >= 0) {
            value = (value as number).toFixed(precision)
          }

          return typeof padding === 'number' && padding >= 0 ? value.toString().padStart(width, '0') : value.toString()
        }
        case 's':
          return width < 0
            ? (replacement as string).toString().padEnd(-width, ' ')
            : (replacement as string).toString().padStart(width, ' ')

        default:
          return replacement as string
      }
    }
  )
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return '0 Bytes'
  }
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function isInsideWebWorker(): boolean {
  // @ts-expect-error - WebWorker global scope
  return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope
}

export function isInsideNode(): boolean {
  return typeof process !== 'undefined' && process.release && process.release.name === 'node'
}

export function getNanosecondTimeViaPerformance() {
  return BigInt(Math.floor(performance.now() * 1e6))
}

export function formatNanoseconds(value: number | bigint): string {
  if (typeof value === 'number') {
    value = BigInt(value)
  }

  if (value < nano) {
    return `${value}ns`
  } else if (value < milli) {
    return `${value / nano}μs`
  } else if (value < second) {
    return `${value / milli}ms`
  }

  return `${value / second}s`
}

export function getNanosecondsTime(): bigint {
  if (isInsideWebWorker()) {
    return getNanosecondTimeViaPerformance()
  }

  if (isInsideNode()) {
    return process.hrtime.bigint()
  }

  if (typeof process !== 'undefined' && typeof process?.hrtime?.bigint === 'function') {
    return process.hrtime.bigint()
  }

  if (typeof performance !== 'undefined') {
    return getNanosecondTimeViaPerformance()
  }

  // @todo: fallback to V8 native method to get microtime
  return BigInt(0)
}

export function uniqueId(): string {
  return `${baseId}-${lastId++}`
}

export function getOwnProperty<T = unknown>(object: Record<string, T>, property: string): T | undefined {
  // Checks if `hasOwn` method is defined avoiding errors with older Node.js versions
  if (Object.hasOwn === undefined) {
    return Object.prototype.hasOwnProperty.call(object, property) ? object[property] : undefined
  }

  return Object.hasOwn(object, property) ? object[property] : undefined
}

export function getTokenFrequency(token: string, tokens: string[]): number {
  let count = 0

  for (const t of tokens) {
    if (t === token) {
      count++
    }
  }

  return count
}

export function insertSortedValue(
  arr: TokenScore[],
  el: TokenScore,
  compareFn = sortTokenScorePredicate
): TokenScore[] {
  let low = 0
  let high = arr.length
  let mid

  while (low < high) {
    mid = (low + high) >>> 1
    if (compareFn(el, arr[mid]) < 0) {
      high = mid
    } else {
      low = mid + 1
    }
  }

  arr.splice(low, 0, el)

  return arr
}

export function sortTokenScorePredicate(a: TokenScore, b: TokenScore): number {
  if (b[1] === a[1]) {
    return a[0] - b[0]
  }

  return b[1] - a[1]
}

// Intersection function taken from https://github.com/lovasoa/fast_array_intersect.
// MIT Licensed at the time of writing.
export function intersect<T>(arrays: Array<readonly T[]>): T[] {
  if (arrays.length === 0) {
    return []
  } else if (arrays.length === 1) {
    return arrays[0] as T[]
  }

  for (let i = 1; i < arrays.length; i++) {
    if (arrays[i].length < arrays[0].length) {
      const tmp = arrays[0]
      arrays[0] = arrays[i]
      arrays[i] = tmp
    }
  }

  const set = new Map()
  for (const elem of arrays[0]) {
    set.set(elem, 1)
  }
  for (let i = 1; i < arrays.length; i++) {
    let found = 0
    for (const elem of arrays[i]) {
      const count = set.get(elem)
      if (count === i) {
        set.set(elem, count + 1)
        found++
      }
    }
    if (found === 0) return []
  }

  return arrays[0].filter((e) => {
    const count = set.get(e)
    if (count !== undefined) set.set(e, 0)
    return count === arrays.length
  })
}

export function getDocumentProperties(doc: AnyDocument, paths: string[]): Record<string, SearchableValue> {
  const properties: Record<string, SearchableValue> = {}

  const pathsLength = paths.length
  for (let i = 0; i < pathsLength; i++) {
    const path = paths[i]
    const pathTokens = path.split('.')

    let current: SearchableValue | AnyDocument | undefined = doc
    const pathTokensLength = pathTokens.length
    for (let j = 0; j < pathTokensLength; j++) {
      current = current[pathTokens[j]!]

      // We found an object but we were supposed to be done
      if (typeof current === 'object') {
        if (
          current !== null &&
          'lat' in current &&
          'lon' in current &&
          typeof current.lat === 'number' &&
          typeof current.lon === 'number'
        ) {
          current = properties[path] = current as SearchableValue
          break
        } else if (!Array.isArray(current) && current !== null && j === pathTokensLength - 1) {
          current = undefined
          break
        }
      } else if ((current === null || typeof current !== 'object') && j < pathTokensLength - 1) {
        // We can't recurse anymore but we were supposed to
        current = undefined
        break
      }
    }

    if (typeof current !== 'undefined') {
      properties[path] = current as SearchableValue
    }
  }

  return properties
}

export function getNested<T = SearchableValue>(obj: object, path: string): Optional<T> {
  const props = getDocumentProperties(obj as AnyDocument, [path])

  return props[path] as T | undefined
}

export function flattenObject(obj: object, prefix = ''): AnyDocument {
  const result: AnyDocument = {}

  for (const key in obj) {
    const prop = `${prefix}${key}`
    const objKey = (obj as AnyDocument)[key]

    if (typeof objKey === 'object' && objKey !== null) {
      Object.assign(result, flattenObject(objKey, `${prop}.`))
    } else {
      result[prop] = objKey
    }
  }
  return result
}

const mapDistanceToMeters = {
  cm: 0.01,
  m: 1,
  km: 1000,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344
}

export function convertDistanceToMeters(distance: number, unit: GeosearchDistanceUnit): number {
  const ratio = mapDistanceToMeters[unit]

  if (ratio === undefined) {
    throw new Error(createError('INVALID_DISTANCE_SUFFIX', distance).message)
  }

  return distance * ratio
}

export function removeVectorsFromHits(searchResult: Results<AnyDocument>, vectorProperties: string[]): void {
  searchResult.hits = searchResult.hits.map((result) => ({
    ...result,
    document: {
      ...result.document,
      // Remove embeddings from the result
      ...vectorProperties.reduce((acc, prop) => {
        const path = prop.split('.')
        const lastKey = path.pop()!
        let obj = acc
        for (const key of path) {
          obj[key] = obj[key] ?? {}
          obj = obj[key] as any
        }
        obj[lastKey] = null
        return acc
      }, result.document)
    }
  }))
}

export function isPromise(obj: any): obj is Promise<unknown> {
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function'
}

/**
 * Checks if the provided input is an async function or if the input is an array
 * containing at least one async function.
 *
 * @param func - A single function or an array of functions to check.
 *               Non-function values are ignored.
 * @returns `true` if the input is an async function or an array containing at least
 *          one async function, otherwise `false`.
 */
export function isAsyncFunction(func: any): boolean {
  if (Array.isArray(func)) {
    return func.some((item) => 
```

### Core Architecture Module: `packages/plugin-data-persistence/src/utils.ts`
```
import type { Runtime } from './types.js'

export function detectRuntime(): Runtime {
  /* c8 ignore next 11 */
  if (typeof process !== 'undefined' && process.versions !== undefined) {
    return 'node'

    // @ts-expect-error "Deno" global variable is defined in Deno only
  } else if (typeof Deno !== 'undefined') {
    return 'deno'
    // @ts-expect-error "Bun" global variable is defined in Bun only
  } else if (typeof Bun !== 'undefined') {
    return 'bun'
  } else if (typeof window !== 'undefined') {
    return 'browser'
  }

  return 'unknown'
}

```

### Core Architecture Module: `packages/plugin-docusaurus-v3/src/theme/SearchBar/utils.ts`
```
import { useActivePlugin } from '@docusaurus/plugin-content-docs/client'
import { ReactContextError, useDocsPreferredVersion } from '@docusaurus/theme-common'

export function getColorMode() {
  if (typeof document === 'undefined') {
    return 'light'
  }
  const html = document.querySelector('html')
  return html?.dataset.theme
}

export function getPreferredVersion(index: unknown) {
  const activePlugin = useActivePlugin()

  try {
    const { preferredVersion } = useDocsPreferredVersion(activePlugin?.pluginId ?? 'default') as {
      preferredVersion: { name: string }
    }

    if (!preferredVersion) {
      throw new ReactContextError('Not using versioned docs')
    }

    return preferredVersion.name
  } catch (e: unknown) {
    if (index) {
      if (e instanceof ReactContextError) {
        return 'current'
      } else {
        throw e
      }
    }

    return null
  }
}

```

### Core Architecture Module: `packages/plugin-docusaurus-v3/src/utils.ts`
```
import { AnyOrama, create, insertMultiple } from '@orama/orama'
import { IndexConfig, OramaDoc } from './types.js'
import { DOCS_PRESET_SCHEMA } from './constants.js'

export const restFetcher = async <T = unknown>(url: string, options?: any): Promise<T> => {
  const response = await fetch(url, options)

  if (response.status === 0) {
    throw new Error(`Request failed (network error): ${await response.text()}`)
  } else if (response.status >= 400) {
    const error = new Error(`Request failed (HTTP error ${response.status})}`)
    ;(error as any).response = response

    throw error
  }

  return await response.json()
}

export async function loggedOperation(preMessage: string, fn: () => Promise<any>, postMessage: string) {
  if (preMessage != null) {
    console.debug(preMessage)
  }

  try {
    const response = await fn()

    if (postMessage != null) {
      console.debug(postMessage)
    }

    return response
  } catch (error: any) {
    throw new Error(`Error: ${error.message}`)
  }
}

export async function fetchEndpointConfig(baseUrl: string, APIKey: string, indexId: string): Promise<IndexConfig> {
  const result = await loggedOperation(
    'Orama: Fetch index endpoint config',
    async () =>
      await restFetcher(`${baseUrl}/indexes/get-index?id=${indexId}`, {
        headers: {
          Authorization: `Bearer ${APIKey}`
        }
      }),
    'Orama: Fetch index endpoint config (success)'
  )

  return { endpoint: result?.api_endpoint, api_key: result?.api_key, collection_id: '' }
}

export async function createOramaInstance(oramaDocs: OramaDoc[]): Promise<AnyOrama> {
  console.debug('Orama: Creating instance.')
  const db = create({
    schema: { ...DOCS_PRESET_SCHEMA, version: 'enum' }
  })

  await insertMultiple(db, oramaDocs as any)

  console.debug('Orama: Instance created.')

  return db
}

```

### Core Architecture Module: `packages/plugin-docusaurus/src/utils.ts`
```
import { AnySchema } from '@orama/orama'

export const restFetcher = async <T = unknown>(url: string, options?: any): Promise<T> => {
  const response = await fetch(url, options)

  if (response.status === 0) {
    throw new Error(`Request failed (network error): ${await response.text()}`)
  } else if (response.status >= 400) {
    const error = new Error(`Request failed (HTTP error ${response.status})}`)
    ;(error as any).response = response

    throw error
  }

  return await response.json()
}

export const postFetcher = async <T = unknown>(url: string, body: any, headers?: any): Promise<T> => {
  return await restFetcher(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

export async function loggedOperation(preMessage: string, fn: () => Promise<any>, postMessage: string) {
  if (preMessage != null) {
    console.debug(preMessage)
  }

  try {
    const response = await fn()

    if (postMessage != null) {
      console.debug(postMessage)
    }

    return response
  } catch (error: any) {
    throw new Error(`Error: ${error.message}`)
  }
}

export async function fetchEndpointConfig(baseUrl: string, APIKey: string, indexId: string) {
  const result = await loggedOperation(
    'Start: Fetch index endpoint config',
    async () =>
      await restFetcher(`${baseUrl}/api/v1/indexes/get-index?id=${indexId}`, {
        headers: {
          Authorization: `Bearer ${APIKey}`
        }
      }),
    'End: Fetch index endpoint config (success)'
  )

  return { endpoint: result?.api_endpoint, public_api_key: result?.api_key }
}

export async function createSnapshot(baseUrl: string, APIKey: string, indexId: string, documents: any[]) {
  await loggedOperation(
    'Start: Create snapshot',
    async () =>
      await postFetcher(`${baseUrl}/api/v1/webhooks/${indexId}/snapshot`, documents, {
        Authorization: `Bearer ${APIKey}`
      }),
    'End: Create snapshot (success)'
  )
}

export async function deployIndex(baseUrl: string, APIKey: string, indexId: string) {
  await loggedOperation(
    'Start: Deploy index',
    async () =>
      await postFetcher(
        `${baseUrl}/api/v1/webhooks/${indexId}/deploy`,
        {},
        {
          Authorization: `Bearer ${APIKey}`
        }
      ),
    'End: Deploy index (success)'
  )
}

export const DOCS_PRESET_SCHEMA: AnySchema = {
  title: 'string',
  content: 'string',
  path: 'string',
  section: 'string',
  category: 'enum',
  version: 'enum'
}

```

### Core Architecture Module: `packages/plugin-nextra/src/utils/classNames.ts`
```
export const wrapperUl =
  'nextra-scrollbar nx-border nx-border-gray-200 nx-bg-white nx-text-gray-100 dark:nx-border-neutral-800 dark:nx-bg-neutral-900 nx-absolute nx-top-full nx-z-20 nx-mt-2 nx-overflow-auto nx-overscroll-contain nx-rounded-xl nx-py-2.5 nx-shadow-xl nx-max-h-[min(calc(50vh-11rem-env(safe-area-inset-bottom)),400px)] md:nx-max-h-[min(calc(100vh-5rem-env(safe-area-inset-bottom)),400px)] nx-inset-x-0 ltr:md:nx-left-auto rtl:md:nx-right-auto contrast-more:nx-border contrast-more:nx-border-gray-900 contrast-more:dark:nx-border-gray-50 nx-w-screen nx-min-h-[100px] nx-max-w-[min(calc(100vw-2rem),calc(100%+20rem))]'

export const titleDiv =
  'nx-mx-2.5 nx-mb-2 nx-mt-6 nx-select-none nx-border-b nx-border-black/10 nx-px-2.5 nx-pb-1.5 nx-text-xs nx-font-semibold nx-uppercase nx-text-gray-500 first:nx-mt-0 dark:nx-border-white/20 dark:nx-text-gray-300 contrast-more:nx-border-gray-600 contrast-more:nx-text-gray-900 contrast-more:dark:nx-border-gray-50 contrast-more:dark:nx-text-gray-50'
export const listItem =
  'nx-mx-2.5 nx-break-words nx-rounded-md contrast-more:nx-border nx-text-primary-600 contrast-more:nx-border-primary-500'

export const resultText =
  'excerpt nx-mt-1 nx-text-sm nx-leading-[1.35rem] nx-text-gray-600 dark:nx-text-gray-400 contrast-more:dark:nx-text-gray-50'

export const wrapperDiv = 'nextra-search nx-relative md:nx-w-64 nx-hidden md:nx-inline-block mx-min-w-[200px]'

export const inputWrapper =
  'nx-relative nx-flex nx-items-center nx-text-gray-900 contrast-more:nx-text-gray-800 dark:nx-text-gray-300 contrast-more:dark:nx-text-gray-300'

export const inputStyles =
  'nx-block nx-w-full nx-appearance-none nx-rounded-lg nx-px-3 nx-py-2 nx-transition-colors nx-text-base nx-leading-tight md:nx-text-sm nx-bg-black/[.05] dark:nx-bg-gray-50/10 focus:nx-bg-white dark:focus:nx-bg-dark placeholder:nx-text-gray-500 dark:placeholder:nx-text-gray-400 contrast-more:nx-border contrast-more:nx-border-current'

export const kbdStyles =
  'nx-absolute nx-my-1.5 nx-select-none ltr:nx-right-1.5 rtl:nx-left-1.5 nx-h-5 nx-rounded nx-bg-white nx-px-1.5 nx-font-mono nx-text-[10px] nx-font-medium nx-text-gray-500 nx-border dark:nx-border-gray-100/20 dark:nx-bg-dark/50 contrast-more:nx-border-current contrast-more:nx-text-current contrast-more:dark:nx-border-current nx-items-center nx-gap-1 nx-transition-opacity nx-z-20 nx-flex nx-cursor-pointer hover:nx-opacity-70'

export const attributionLi = 'nx-sticky nx-p-4 nx-text-sm nx-bottom-0 nx-bg-gray-100 dark:nx-bg-neutral-900'

export const attributionP = 'nx-text-center nx-text-gray-600 contrast-more:dark:nx-bg-neutral-100'

```

### Core Architecture Module: `packages/plugin-nextra/src/utils/index.ts`
```
import type { Orama, TypedDocument } from '@orama/orama'
import { create, insertMultiple } from '@orama/orama'
import type { SearchResultWithHighlight } from '@orama/plugin-match-highlight'
import { afterInsert as highlightAfterInsertHook } from '@orama/plugin-match-highlight'

export type NextraOrama = Orama<typeof defaultSchema>

type HighlightedHits = SearchResultWithHighlight<NextraOrama>['hits']

export function groupDocumentsBy(arr: HighlightedHits, key: string) {
  return arr.reduce((acc, current) => {
    const keyValue = current.document[key] as string

    if (!acc[keyValue]) {
      acc[keyValue] = []
    }

    acc[keyValue].push(current)
    return acc
  }, {})
}

const defaultSchema = {
  id: 'string',
  title: 'string',
  url: 'string',
  content: 'string'
} as const

export async function createOramaIndex(basePath, locale): Promise<NextraOrama> {
  const response = await fetch(`${basePath}/_next/static/chunks/nextra-data-${locale}.json`)
  const data = await response.json()

  const index = await create({
    schema: defaultSchema,
    components: {
      tokenizer: {
        stemming: false
      }
    },
    plugins: [
      {
        name: 'match-highlight',
        afterInsert: highlightAfterInsertHook
      }
    ]
  })

  const paths = Object.keys(data)
  const documents: TypedDocument<NextraOrama>[] = []

  for (const path of paths) {
    const url = path
    const title = data[path].title
    const content = data[path].data['']

    documents.push({
      id: url,
      title,
      url,
      content
    })

    const sectionData = data[path].data
    delete sectionData['']

    for (const sectionTitle in sectionData) {
      const [hash, title] = sectionTitle.split('#')
      const content = sectionData[sectionTitle]

      documents.push({
        id: `${url}#${hash}`,
        title,
        url: `${url}#${hash}`,
        content
      })
    }
  }

  await insertMultiple(index, documents)

  return index
}

```

### Core Architecture Module: `packages/plugin-nextra/src/utils/useCreateOramaIndex.ts`
```
import { useEffect, useState } from 'react'
import { createOramaIndex } from './index.js'
import { useRouter } from 'next/router.js'

export const useCreateOramaIndex = () => {
  const [, setIndexing] = useState(false)
  const [indexes, setIndexes] = useState({})
  const router = useRouter()
  const { basePath, locale = 'en-US' } = router

  // As soon as the page loads, we create the index on the client-side
  useEffect(() => {
    setIndexing(true)

    createOramaIndex(basePath, locale).then((index) => {
      setIndexes((i) => ({
        ...i,
        [locale]: index
      }))
      setIndexing(false)
    })
  }, [])

  // If the locale changes, we create the index on the client-side
  useEffect(() => {
    if (!(locale in indexes)) {
      setIndexing(true)
      createOramaIndex(basePath, locale).then((index) => {
        setIndexes((i) => ({
          ...i,
          [locale]: index
        }))
        setIndexing(false)
      })
    }
  }, [basePath, locale])

  return { indexes }
}

```

### Core Architecture Module: `packages/plugin-nextra/src/utils/useFocus.ts`
```
import { useRouter } from 'next/router.js'
import { useEffect, useState } from 'react'

export const useFocus = ({ inputRef }) => {
  const { asPath } = useRouter()
  const [hasFocus, setHasFocus] = useState(false)

  // If the user presses ESC, we close the search box
  useEffect(() => {
    if (document.activeElement === inputRef.current) {
      setHasFocus(true)
    } else {
      setHasFocus(false)
    }
  }, [])

  useEffect(() => {
    const onKeyDownHandler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        inputRef.current?.focus()
        setHasFocus(true)
      }
    }
    window.addEventListener('keydown', onKeyDownHandler)

    return () => {
      window.removeEventListener('keydown', onKeyDownHandler)
    }
  }, [])

  // If the path changes, we close the search box
  useEffect(() => {
    setHasFocus(false)
  }, [asPath])

  return {
    hasFocus,
    setHasFocus
  }
}

```

### Core Architecture Module: `benchmarks/algorithms.js`
```
import b from 'benny'
import { create, insertMultiple, search } from 'orama_latest'
import { pluginPT15 } from '@orama/plugin-pt15'
import { pluginQPS } from '@orama/plugin-qps'
import dataset from './src/dataset.json' assert { type: 'json' }
import {stopwords} from '@orama/stopwords/english'

const dbBM25 = create({
    schema: {
        description: 'string'
    },
    components: {
        tokenizer: {
            stopWords: stopwords,
        },
    }
})

const dbWithPT15 = create({
    schema: {
        description: 'string'
    },
    plugins: [pluginPT15()],
    components: {
        tokenizer: {
            stopWords: stopwords,
        },
    }
})

const dbWithQPS = create({
    schema: {
        description: 'string'
    },
    plugins: [pluginQPS()],
    components: {
        tokenizer: {
            stopWords: stopwords,
        },
    }
})

await insertMultiple(dbBM25, dataset)
await insertMultiple(dbWithPT15, dataset)
await insertMultiple(dbWithQPS, dataset)

b.suite('search-algorithms - single-term prefix',
    b.add('search bm25 - single-term prefix', () => {
        search(dbBM25, { term: 'L' })
    }),
    b.add('search pt15 - single-term prefix', () => {
        search(dbWithPT15, { term: 'L' })
    }),
    b.add('search qps - single-term prefix', () => {
        search(dbWithQPS, { term: 'L' })
    }),
    b.cycle(),
    b.complete(),
    b.save({ file: 'insert', version: '1.0.0' }),
    b.save({ file: 'search-algorithms-single-term-prefix', format: 'chart.html' }),
)

b.suite('search-algorithms - entire words',
    b.add('search bm25 - entire words', () => {
        search(dbBM25, { term: 'Legend of Zelda' })
    }),
    b.add('search pt15 - entire words', () => {
        search(dbWithPT15, { term: 'Legend of Zelda' })
    }),
    b.add('search qps - entire words', () => {
        search(dbWithQPS, { term: 'Legend of Zelda' })
    }),
    b.cycle(),
    b.complete(),
    b.save({ file: 'insert', version: '1.0.0' }),
    b.save({ file: 'search-algorithms-entire-words', format: 'chart.html' }),
)
```

### Core Architecture Module: `benchmarks/bundle-size.js`
```
import zlib from 'node:zlib'
import fs from 'node:fs'
import { persistToFile } from '@orama/plugin-data-persistence/server'
import { insertMultiple, db211, db300rc2, dbLatest, dbLatestPT15, dbLatestQPS } from './src/get-orama.js'

const db211Path = './bundle/db211.json'
const db300rc2Path = './bundle/db300rc2.json'
const dbLatestPath = './bundle/dbLatest.json'
const dbLatestPT15Path = './bundle/dbLatestPT15.json'
const dbLatestQPSPath = './bundle/dbLatestQPS.json'

await insertMultiple.orama211()
insertMultiple.orama300rc2()
insertMultiple.oramaLatest()
insertMultiple.oramaLatestPT15()
insertMultiple.oramaLatestQPS()

await persistToFile(db211, 'json', db211Path)
await persistToFile(db300rc2, 'json', db300rc2Path)
await persistToFile(dbLatest, 'json', dbLatestPath)
await persistToFile(dbLatestPT15, 'json', dbLatestPT15Path)
await persistToFile(dbLatestQPS, 'json', dbLatestQPSPath)


fs.writeFileSync(db211Path + '.gz', zlib.gzipSync(fs.readFileSync(db211Path)))
fs.writeFileSync(db300rc2Path + '.gz', zlib.gzipSync(fs.readFileSync(db300rc2Path)))
fs.writeFileSync(dbLatestPath + '.gz', zlib.gzipSync(fs.readFileSync(dbLatestPath)))
fs.writeFileSync(dbLatestPT15Path + '.gz', zlib.gzipSync(fs.readFileSync(dbLatestPT15Path)))
fs.writeFileSync(dbLatestQPSPath + '.gz', zlib.gzipSync(fs.readFileSync(dbLatestQPSPath)))
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1032** (2026-07-03): **Language support inconsistencies: implement missing stemmers, fix stemmer/stop-word/docs drift**
  *Symptoms*: Tracking issue for the language-support inconsistencies reported in #1027. The READMEs, the `@orama/stemmers` / `@orama/stopwords` package exports, and the core `SUPPORTED_LANGUAGES` map have drifted apart. I verified the matrix below against the code, so treat it as the ground truth over anything the READMEs say.  ## Ground truth from the code  | Language | In core `SUPPORTED_LANGUAGES`? | Stemmer (file + export) | Stop-words (file + export) | |---|---|---|---| | Japanese | ❌ no (separate `@orama/tokenizers/japanese`) | ❌ none | ✅ `ja.js` → `./japanese` | | Mandarin / Chinese | ❌ no (separate tokenizer) | ❌ none | ✅ `zh.js` → `./mandarin` | | Slovenian | ✅ but `slovenian: 'ru'` | ❌ no file, not exported | ⚠️ `./slovenian` → **`ru.js`** (Russian) | | Czech | ✅ `czech: 'cz'` | ❌ no file, not exported | ❌ no file, not exported | | Sanskrit | ✅ `sanskrit: 'sk'` | ✅ `sk.js` | ✅ `sk.js` |  Root cause: the `STEMMERS` map in `packages/orama/src/components/tokenizer/languages.ts` does three jobs at once. It defines the supported-language list, it names the stemmer/stop-word files, and it feeds `localeCompare` its collation locale. Japanese and Mandarin, which ship stop-words but no stemmer, have no place in that model and fell through the cracks.  ## Decision  Implement real support for the missing stemmers rather than dropping the languages.  ## Work items  ### Real stemmer implementation - [x] #1030: a real Slovenian stemmer + stop-words, replacing the Russian alias - [x] #1031: a 
  **Post-Mortem & Fix Analysis**:
  > All boxes ticked.  #1030 and #1031 landed in #1033. Czech and Slovenian now have real stemmers and stop-word lists, the Russian alias is gone, and both packages export `./czech` and `./slovenian`. The Czech stemmer ports Lucene's CzechStemmer and passes all 143 of its test vectors. Slovene has no official Snowball or Lucene implementation, so I wrote a light stemmer in the same style.  The same PR renamed `STEMMERS` to `SUPPORTED_LANGUAGE_LOCALES` and corrected every value to a valid BCP-47 tag, which fixes `localeCompare` collation for the dozen languages that carried bogus codes. Both package READMEs now regenerate their language lists from the build maps on each build, so the hand-edited drift ends here.  I updated the docs site in oramasearch/docs#26: the supported-languages table and the stemming and stop-words pages now match the code. The Chinese and Japanese guides already did.  One caveat on npm: the package pages there show the README of the last published version, so the cor

- **Issue #1031** (2026-07-03): **Implement real Czech stemmer + stop-words (czech: 'cz' is a phantom language)**
  *Symptoms*: ## Summary  Czech is a **phantom language**. It appears in core as a supported language but has no stemmer, no stop-words, and no package export anywhere:  - `packages/orama/src/components/tokenizer/languages.ts` → `czech: 'cz'`, so `czech` is in `SUPPORTED_LANGUAGES` and a `czech` entry exists in `SPLITTERS`. - There is **no** `cz.js` (or `cs.js`) in `packages/stemmers/lib` or `packages/stopwords/lib`. - Czech is **not** in either package's `scripts/build.js` map, so `@orama/stemmers/czech` and `@orama/stopwords/czech` do not exist.  Net effect: `language: 'czech'` is accepted and tokenizes (a splitter exists), but stemming can never be supplied (no package to import from), there are no stop-words, and `getLocale('czech')` returns `'cz'` — **not a valid BCP-47 locale** (Czech is `cs`), so `localeCompare` collation silently falls back to default. Surfaced during analysis of #1027.  ## Decision  Implement real Czech support (stemmer + stop-words) rather than removing the language.  ## Scope / checklist  - [ ] Source a Czech stemming algorithm. Czech is **not** in the official Snowball set; use a community Snowball `.sbl` or a port of a published Czech stemmer (e.g. a light/aggressive Czech stemmer), compiled via the Snowball compiler to match the other generated stemmers. - [ ] Add the generated stemmer as `packages/stemmers/lib/cs.js`. - [ ] Add a Czech stop-words list as `packages/stopwords/lib/cs.js`. - [ ] Add `czech: 'cs'` to:   - `packages/stemmers/scripts/build.js`   - 
  **Post-Mortem & Fix Analysis**:
  > Part of #1032.

- **Issue #1030** (2026-07-03): **Implement real Slovenian stemmer + stop-words (currently aliased to Russian)**
  *Symptoms*: ## Summary  Slovenian is advertised as a supported language but has **no real implementation**. It is silently aliased to Russian:  - `packages/orama/src/components/tokenizer/languages.ts` → `slovenian: 'ru'` (so `getLocale('slovenian')` returns the Russian locale, affecting `localeCompare` sort collation in `sorter.ts`). - `packages/stopwords/scripts/build.js` → `slovenian: 'ru'`, so `@orama/stopwords/slovenian` resolves to `dist/ru.js` — **Russian stop-words applied to Slovenian text**. - `packages/stemmers/scripts/build.js` — Slovenian is commented out with an explicit request for a PR:  ```js //  This is never implemented actually. //  We used `slovenian` as `russian`, but it was wrong, sorry! //  Instead of providing a wrong implementation, we don't export it. //  Anyway, this is never tested inside `orama` package. //  Please, we need a PR to implement this correctly! /* slovenian: 'sl', */ ```  Net effect: `language: 'slovenian'` is accepted by core (it is in `SUPPORTED_LANGUAGES`), but there is no Slovenian stemmer export, and the stop-words are actually Russian. Reported in #1027; previously requested in #281.  ## Decision  Implement real Slovenian support (stemmer + stop-words), not the Russian alias.  ## Scope / checklist  - [ ] Source a Slovenian stemming algorithm. Slovenian is **not** in the official Snowball set, so this needs a community Snowball `.sbl` (or a port of a published Slovenian stemmer) compiled via the Snowball compiler, consistent with `packages/s
  **Post-Mortem & Fix Analysis**:
  > Part of #1032.

- **Issue #480** (2023-10-11): **Bug: tolerance option not behaving as hoped**
  *Symptoms*: Thanks for the amazing lib and clear documentation!  I'm looking at using Orama to search local chat messages (typically involving a few words up to several sentences).   Using `@orama/orama ^1.2.3` I'm getting fast a correct results for exact and prefixed matching however however typos don't seem to work the way I was hoping. I'm probably missing the obvious but testing the `tolerance` parameter against an example in the docs returns poor results. So I'm wondering what could be wrong.   Looking at the following example. https://docs.oramasearch.com/usage/search/introduction#typo-tolerance  If I grab a slightly bigger database: https://github.com/erik-sytnyk/movies-list/blob/master/db.json  ```ts {    term: "Christopher Nolan",    properties: ["director"]  }  // result: OK: matches 1 exact result like expected ```   ```ts {   term: "Cris",   properties: ["director"], }  // result: OK: matches 1 document "Michael Cristofer" (no tolerance was set, so this is kind of expected) ```   ```ts {   term: 'Cris',   properties: ['director'],   tolerance: 1, }  // result: "fails": matches 0 documents, in the documentation this query would return all "Chris's" - not this would still fail bumping the tolerance level // one example in the DB: "director": "Pierre Coffin, Chris Renaud", ```  here's my playground (all output is in the console): https://codesandbox.io/p/sandbox/keen-knuth-9wql22?file=/src/main.ts:65,28  I've played with other options,
  **Post-Mortem & Fix Analysis**:
  > I fear that's a known issue. We're performing the Levenshtein edit distance on words living in the same prefix bucket, rather than performing the edit distance calculation on trees. For instance, searching for `Chris` and `hris` will give you totally different results, as they don't share a common prefix.  I'll be putting a bounty on this bug, thanks for opening it!  /bounty 500
  > ~~💎 **$500** bounty created by micheleriva~~ ~~🙋 If you start working on this, comment `/attempt #480` to notify everyone~~ ~~👉 To claim this bounty, submit a pull request that includes the text `/claim #480` somewhere in its body~~ ~~📝 Before proceeding, please make sure you can [**receive payouts**](https://docs.algora.io/bounties/payments#country-support) in your country~~ ~~💵 Payment arrives in your account 2-5 days after the bounty is rewarded~~ ~~💯 You keep 100% of the bounty award~~ ~~🙏 Thank you for contributing to oramasearch/orama!~~  | Attempt | Started (GMT+0) | Solution | |---|---|---| | 🟢 @mnmt7 | Sep 15, 2023, 5:50:54 AM | WIP | | 🟢 @bicky21 | Sep 18, 2023, 2:53:27 PM | WIP | | 🟢 @melsonic | Oct 2, 2023, 4:51:02 PM | WIP | | 🟢 @SP321 | Oct 10, 2023, 12:23:49 PM | [#516](https://github.com/oramasearch/orama/pull/516) |
  > Hey @micheleriva, I would like to work on this issue. Can you please assign this issue to me? /attempt #480  <details id="algora-options">   <summary>Options</summary>   <ul>     <li>       <a href="https://console.algora.io/api/bounties/clmjp59a80002jk0fwqukvrx5/cancel-attempt">         Cancel my attempt       </a>     </li>   </ul> </details> 

- **Issue #464** (2023-09-21): **Typo-tolerant Searches Don't Return Highlight Positions in @orama/plugin-match-highlight**
  *Symptoms*: **Describe the bug** When using @orama/plugin-match-highlight, the positions for the matches are not returned when there's a typo in the search query.  **To Reproduce** Steps to reproduce the behavior:  1. Initialize the database with provided seed data. 2. Use searchWithHighlight to search for the term "react". 3. Use searchWithHighlight to search for the term "reat" (typo). 4. Observe the results: Positions are returned for the exact term "react" but are missing for the typo "reat".  **Expected behavior** The searchWithHighlight function should return positions for typo-tolerant searches, helping in highlighting matches even when there are minor typos.  **Screenshots** Not applicable.  **Desktop**  OS:  macOS Browser:  Google Chrome Version: Version 115.0.5790.170 (Official Build) (x86_64)  **Smartphone** Not applicable for this issue.  **Additional context** I encountered this issue while trying to implement typo-tolerant searches with highlighted results. The absence of positions for typos can reduce the usefulness of the highlight plugin, especially in real-world scenarios where users may have small typos in their search queries.  Here is a code sandbox link: https://codesandbox.io/s/stupefied-aryabhata-typj85?file=/src/App.js:0-2081 

- **Issue #249** (2023-06-30): **[Astro] Use a Lyra database globally and pass it throught components.**
  *Symptoms*:  **Describe the bug** I'm trying to integrate Lyra inside an Astro project to use a global database built at build time. Despite the feasibility of the task, I did some tests beforehand, trying to build inside the Astro formatter a simple db and pass it to a React component. ```typescript --- import { create, insertBatch } from "@lyrasearch/lyra";  const newsDB = await create({   schema: {     title: "string",     author: "string",     description: "string",   },   defaultLanguage: "italian", }); await insertBatch(newsDB, [   {     title: "foo",     author: "foo",     description: "foo",   }, ]); --- <PostList posts={langPosts} db={newsDB} client:load /> ``` Then inside `PostList`: ```typescript import { search } from "@lyrasearch/lyra";  export const PostList = ({ db }) => {   console.log(db); // missing the `components` functions inside the db object   console.log(search(db, {term: "test"}); // crashes with error    ... } ```  For some reason during the props injection the `newsDB` loses some properties, for instance this is the components Object logged inside `PostList`: ``` "components": {     "tokenizer": {       "enableStopWords": true,       "enableStemming": true,       "stemmingFn": null,       "customStopWords": [],       "tokenizerFn": null,       "assertSupportedLanguage": null     },     "algorithms": {       "intersectTokenScores": null     }   } ```  As you can see the tokenizerFn and more is null for some r
  **Post-Mortem & Fix Analysis**:
  > This might be due to the fact that it is not possible to serialize functions, so whenever you create a new database via the `plugin-data-persistence` plugin, you're missing the tokenizer.  cc @castarco, we need to update the `plugin-data-persistence` plugin and then update the Astro plugin as well :)
  > > This might be due to the fact that it is not possible to serialize functions, so whenever you create a new database via the `plugin-data-persistence` plugin, you're missing the tokenizer. >  > cc @castarco, we need to update the `plugin-data-persistence` plugin and then update the Astro plugin as well :)  I'm not using the `plugin-data-persistence` tho. Just the standard Lyra library. Or is this related to something used by it under the hood?
  > That's really strange then. Could you please give us a reproduction repo?

- **Issue #230** (2023-08-16): **English: searching words via their non-diacritic form doesn't return results**
  *Symptoms*: **Describe the bug** English language doesn't return results when a word containing diacritic is searched via its non-diacritic form. Eg:  Currently the sentence `My name is Josè, nice to meet you` in NOT searchable via `jose` or `Jose` (diacritic removed).  Any other variation of the word seems to produce the expected result (`josè`, `josė`, `josę`, `josâ`, `jos`)  **To Reproduce** https://codesandbox.io/s/lyra-diacritics-english-language-b8tzv6  **Expected behavior** Words containing diacritics should be searchable via both their diacritical or non-diacritical form (or a mix of it).  Eg. The sentence `My name is Josè, nice to meet you` should be searchable via `jose`, `Jose`.  **Desktop (please complete the following information):**  - OS: MacOS 12  - Browser Chrome  **Additional context** Related to issue #213  Spanish language handles this example (`josè`) correctly, but fails when the input contains non-spanish diacritics (`ē`, `ė`, `ę`). Feel free to play with CodeSandbox demo.  ***English tokenizer*** Looking at the runtime execution, the most relevant difference seems to be how words are tokenized (english). More specifically diacritic forms (`josè`) get tokenized as `jo` while `jose` as `jose`.  `term` variable [here](https://github.com/LyraSearch/lyra/blob/main/src/methods/search.ts#L156) gets initialized with different values, therefore the 2 different results.  The root cause seems to be the [english regex](https://github.com/LyraSearc
  **Post-Mortem & Fix Analysis**:
  > In case we wanted to extend the tokenizer regexes [here](https://stackoverflow.com/questions/30225552/regex-for-diacritics) is a good starting point.
  > A solution might consist of extending tokenizer regexes to match all/some diacritics so that the tokenizer splits strings diacritic insensitively. Would it make any sense @micheleriva? If so shall we consider doing the same on other languages?
  > > Currently the sentence My name is Josè, nice to meet you in NOT searchable via jose or Jose (diacritic removed). > Any other variation of the word seems to produce the expected result (josè, josė, josę, josâ, jos)  This is a bug, they should ALWAYS return and it shouldn't depend on the language

- **Issue #226** (2023-01-04): **Cant search numbers when defaultLanguage is russian**
  *Symptoms*: **Describe the bug** Cant search numbers when defaultLanguage is russian  **To Reproduce** Steps to reproduce the behavior: 1. `const db = create({   schema: {     num: "string",     name: "string"   },   defaultLanguage:"russian" });` 2. `const data = [ {num:"123",name:"тест 1"}, {num:"321",name:"тест 2"}, {num:"6666",name:"тест 3"} ];` `data.forEach((doc)=>{    insert(db, doc) })` 3. `const searchResult = search(db, {     term: "6666",     properties: "*",   });`  **Expected behavior**  **Screenshots** If applicable, add screenshots to help explain your problem.  **Desktop (please complete the following information):**  - OS: Windows 10  - Node: 16.17
  **Post-Mortem & Fix Analysis**:
  > Hi @lpite, thanks for opening this!  Can you provide a reproduction of this issue? It would be helpful for anyone who wants to work on this.
  > @mateonunez added

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

### Incident Patch 1: `b030e1bd` (2026-07-03)
**Commit Message**: fix(plugin-match-highlight): highlight every token of a multi-token word (CJK) (#1028)

Co-authored-by: greymoth <[REDACTED_EMAIL]>

**File**: `packages/plugin-match-highlight/src/index.ts` (modified, +14/-12)
```diff
@@ -71,20 +71,22 @@ async function recursivePositionInsertion<T extends AnyOrama, ResultDocument = T
     let regExResult: RegExpExecArray | null
     while ((regExResult = wordRegEx.exec(text)) !== null) {
       const word = regExResult[0].toLowerCase()
-      const key = `${orama.tokenizer.language}:${word}`
-      let token: string
-      if (orama.tokenizer.normalizationCache.has(key)) {
-        token = orama.tokenizer.normalizationCache.get(key)!
-      } else {
-        ;[token] = orama.tokenizer.tokenize(word)
-        orama.tokenizer.normalizationCache.set(key, token)
-      }
-      if (!Array.isArray(orama.data.positions[id][propName][token])) {
-        orama.data.positions[id][propName][token] = []
-      }
       const start = regExResult.index
       const length = regExResult[0].length
-      orama.data.positions[id][propName][token].push({ start, length })
+      // A matched word can yield more than one token: CJK text has no word
+      // spaces, so a whole run is one word here that the tokenizer splits into
+      // many. Record every token instead of only the first one, otherwise the
+      // other tokens have no position and cannot be highlighted even though
+      // search matches them. This mirrors searchWithHighlight, which already
+      // iterates the full token array.
+      const tokens = orama.tokenizer.tokenize(word)
+      for (const token of tokens) {
+        if (!token) continue
+        if (!Array.isArray(orama.data.positions[id][propName][token])) {
+          orama.data.positions[id][propName][token] = []
+        }
+        orama.data.positions[id][propName][token].push({ start, length })
+      }
     }
   }
 }
```

**File**: `packages/plugin-match-highlight/test/index.test.ts` (modified, +44/-1)
```diff
@@ -1,4 +1,4 @@
-import { create, insert } from '@orama/orama'
+import { create, insert, Tokenizer } from '@orama/orama'
 import t from 'tap'
 import {
   afterInsert,
@@ -143,3 +143,46 @@ t.test('should correctly save and load data with positions', async (t) => {
     text: { hello: [{ start: 0, length: 5 }], world: [{ start: 6, length: 5 }] }
   })
 })
+
+// A minimal word-granularity CJK tokenizer, equivalent to @orama/tokenizers/mandarin.
+// CJK text has no word spaces, so a whole run is matched as a single word by the
+// position indexer and the tokenizer splits it into several tokens.
+function createCjkTokenizer(): Tokenizer {
+  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
+  return {
+    language: 'mandarin',
+    normalizationCache: new Map(),
+    tokenize(input: string): string[] {
+      if (typeof input !== 'string') return [input]
+      const tokens: string[] = []
+      for (const segment of segmenter.segment(input)) {
+        if (segment.isWordLike) tokens.push(segment.segment)
+      }
+      return tokens
+    }
+  }
+}
+
+t.test('it should record a position for every token of a multi-token word (CJK)', async (t) => {
+  const tokenizer = createCjkTokenizer()
+  const db = create({
+    schema: { text: 'string' } as const,
+    components: { tokenizer },
+    plugins: [{ name: 'highlight', afterInsert }]
+  })
+
+  const text = '我喜欢编程'
+  const expected = new Set(tokenizer.tokenize(text))
+  t.ok(expected.size > 1, 'the tokenizer splits the run into multiple tokens')
+
+  const id = await insert(db, { text })
+  const recorded = (db as OramaWithHighlight<typeof db>).data.positions[id].text
+
+  t.same(new Set(Object.keys(recorded)), expected, 'every token has a recorded position')
+
+  // a token other than the first one is found by search and can be highlighted
+  const lastToken = [...expected][expected.size - 1]
+  const results = await searchWithHighlight(db, { term: lastToken })
+  t.ok(results.hits.length > 0, 'search finds the document')
+  t.ok(Array.isArray(results.hits[0].positions.text[lastToken]), 'a non-leading token is highlightable')
+})
```

---

### Incident Patch 2: `d6b7afd4` (2026-06-27)
**Commit Message**: fix(orama): break the search circular dependency behind Metro/Expo failure (#961) (#1026)

**File**: `packages/orama/src/methods/fetch-documents.ts` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import { InternalDocumentID, getDocumentIdFromInternalId } from '../components/internal-document-id-store.js'
+import { getNested } from '../utils.js'
+import type { AnyOrama, LiteralUnion, Result, SearchableValue, TypedDocument } from '../types.js'
+
+export function fetchDocumentsWithDistinct<T extends AnyOrama, ResultDocument extends TypedDocument<T>>(
+  orama: T,
+  uniqueDocsArray: [InternalDocumentID, number][],
+  offset: number,
+  limit: number,
+  distinctOn: LiteralUnion<T['schema']>
+): Result<ResultDocument>[] {
+  const docs = orama.data.docs
+
+  // Keep track which values we already seen
+  const values = new Map<SearchableValue, true>()
+
+  // We cannot know how many results we will have in the end,
+  // so we need cannot pre-allocate the array.
+  const results: Result<ResultDocument>[] = []
+
+  const resultIDs: Set<InternalDocumentID> = new Set()
+  const uniqueDocsArrayLength = uniqueDocsArray.length
+  let count = 0
+  for (let i = 0; i < uniqueDocsArrayLength; i++) {
+    const idAndScore = uniqueDocsArray[i]
+
+    // If there are no more results, just break the loop
+    if (typeof idAndScore === 'undefined') {
+      continue
+    }
+
+    const [id, score] = idAndScore
+
+    if (resultIDs.has(id)) {
+      continue
+    }
+
+    const doc = orama.documentsStore.get(docs, id)
+    const value = getNested(doc as object, distinctOn)
+    if (typeof value === 'undefined' || values.has(value)) {
+      continue
+    }
+    values.set(value, true)
+
+    count++
+    // We shouldn't consider the document if it's not in the offset range
+    if (count <= offset) {
+      continue
+    }
+
+    results.push({ id: getDocumentIdFromInternalId(orama.internalDocumentIDStore, id), score, document: doc! })
+    resultIDs.add(id)
+
+    // reached the limit, break the loop
+    if (count >= offset + limit) {
+      break
+    }
+  }
+
+  return results
+}
+
+export function fetchDocuments<T extends AnyOrama, ResultDocument extends TypedDocument<T>>(
+  orama: T,
+  uniqueDocsArray: [InternalDocumentID, number][],
+  offset: number,
+  limit: number
+): Result<ResultDocument>[] {
+  const docs = orama.data.docs
+
+  const results: Result<ResultDocument>[] = Array.from({
+    length: limit
+  })
+
+  const resultIDs: Set<InternalDocumentID> = new Set()
+
+  // We already have the list of ALL the document IDs containing the search terms.
+  // We loop over them starting from a positional value "offset" and ending at "offset + limit"
+  // to provide pagination capabilities to the search.
+  for (let i = offset; i < limit + offset; i++) {
+    const idAndScore = uniqueDocsArray[i]
+
+    // If there are no more results, just break the loop
+    if (typeof idAndScore === 'undefined') {
+      break
+    }
+
+    const [id, score] = idAndScore
+
+    if (!resultIDs.has(id)) {
+      // We retrieve the full document only AFTER making sure that we really want it.
+      // We never retrieve the full document preventively.
+      const fullDoc = orama.documentsStore.get(docs, id)
+      results[i] = { id: getDocumentIdFromInternalId(orama.internalDocumentIDStore, id), score, document: fullDoc! }
+      resultIDs.add(id)
+    }
+  }
+  return results
+}
```

**File**: `packages/orama/src/methods/search-fulltext.ts` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ import type {
 } from '../types.js'
 import { getNanosecondsTime, removeVectorsFromHits, sortTokenScorePredicate } from '../utils.js'
 import { count } from './docs.js'
-import { fetchDocuments, fetchDocumentsWithDistinct } from './search.js'
+import { fetchDocuments, fetchDocumentsWithDistinct } from './fetch-documents.js'
 
 export function innerFullTextSearch<T extends AnyOrama>(
   orama: T,
```

**File**: `packages/orama/src/methods/search-hybrid.ts` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import type {
 import { getNanosecondsTime, formatNanoseconds, removeVectorsFromHits } from '../utils.js'
 import { getFacets } from '../components/facets.js'
 import { getGroups } from '../components/groups.js'
-import { fetchDocuments } from './search.js'
+import { fetchDocuments } from './fetch-documents.js'
 import { innerFullTextSearch } from './search-fulltext.js'
 import { innerVectorSearch } from './search-vector.js'
 import { runAfterSearch, runBeforeSearch } from '../components/hooks.js'
```

**File**: `packages/orama/src/methods/search.ts` (modified, +0/-101)
```diff
@@ -1,16 +1,11 @@
-import { InternalDocumentID, getDocumentIdFromInternalId } from '../components/internal-document-id-store.js'
 import { createError } from '../errors.js'
-import { getNested } from '../utils.js'
 import type {
   AnyOrama,
-  LiteralUnion,
-  Result,
   Results,
   SearchParams,
   SearchParamsFullText,
   SearchParamsHybrid,
   SearchParamsVector,
-  SearchableValue,
   TypedDocument
 } from '../types.js'
 import { MODE_FULLTEXT_SEARCH, MODE_HYBRID_SEARCH, MODE_VECTOR_SEARCH } from '../constants.js'
@@ -39,99 +34,3 @@ export function search<T extends AnyOrama, ResultDocument = TypedDocument<T>>(
 
   throw createError('INVALID_SEARCH_MODE', mode)
 }
-
-export function fetchDocumentsWithDistinct<T extends AnyOrama, ResultDocument extends TypedDocument<T>>(
-  orama: T,
-  uniqueDocsArray: [InternalDocumentID, number][],
-  offset: number,
-  limit: number,
-  distinctOn: LiteralUnion<T['schema']>
-): Result<ResultDocument>[] {
-  const docs = orama.data.docs
-
-  // Keep track which values we already seen
-  const values = new Map<SearchableValue, true>()
-
-  // We cannot know how many results we will have in the end,
-  // so we need cannot pre-allocate the array.
-  const results: Result<ResultDocument>[] = []
-
-  const resultIDs: Set<InternalDocumentID> = new Set()
-  const uniqueDocsArrayLength = uniqueDocsArray.length
-  let count = 0
-  for (let i = 0; i < uniqueDocsArrayLength; i++) {
-    const idAndScore = uniqueDocsArray[i]
-
-    // If there are no more results, just break the loop
-    if (typeof idAndScore === 'undefined') {
-      continue
-    }
-
-    const [id, score] = idAndScore
-
-    if (resultIDs.has(id)) {
-      continue
-    }
-
-    const doc = orama.documentsStore.get(docs, id)
-    const value = getNested(doc as object, distinctOn)
-    if (typeof value === 'undefined' || values.has(value)) {
-      continue
-    }
-    values.set(value, true)
-
-    count++
-    // We shouldn't consider the document if it's not in the offset range
-    if (count <= offset) {
-      continue
-    }
-
-    results.push({ id: getDocumentIdFromInternalId(orama.internalDocumentIDStore, id), score, document: doc! })
-    resultIDs.add(id)
-
-    // reached the limit, break the loop
-    if (count >= offset + limit) {
-      break
-    }
-  }
-
-  return results
-}
-
-export function fetchDocuments<T extends AnyOrama, ResultDocument extends TypedDocument<T>>(
-  orama: T,
-  uniqueDocsArray: [InternalDocumentID, number][],
-  offset: number,
-  limit: number
-): Result<ResultDocument>[] {
-  const docs = orama.data.docs
-
-  const results: Result<ResultDocument>[] = Array.from({
-    length: limit
-  })
-
-  const resultIDs: Set<InternalDocumentID> = new Set()
-
-  // We already have the list of ALL the document IDs containing the search terms.
-  // We loop over them starting from a positional value "offset" and ending at "offset + limit"
-  // to provide pagination capabilities to the search.
-  for (let i = offset; i < limit + offset; i++) {
-    const idAndScore = uniqueDocsArray[i]
-
-    // If there are no more results, just break the loop
-    if (typeof idAndScore === 'undefined') {
-      break
-    }
-
-    const [id, score] = idAndScore
-
-    if (!resultIDs.has(id)) {
-      // We retrieve the full document only AFTER making sure that we really want it.
-      // We never retrieve the full document preventively.
-      const fullDoc = orama.documentsStore.get(docs, id)
-      results[i] = { id: getDocumentIdFromInternalId(orama.internalDocumentIDStore, id), score, document: fullDoc! }
-      resultIDs.add(id)
-    }
-  }
-  return results
-}
```

---

### Incident Patch 3: `59fa064c` (2026-06-27)
**Commit Message**: fix(plugin-nextra): move next/react to peerDependencies for Next 14-16 + React 18/19 (#1025)

**File**: `packages/plugin-nextra/package.json` (modified, +13/-5)
```diff
@@ -24,15 +24,18 @@
   ],
   "scripts": {
     "build": "swc --delete-dir-on-start --extensions .ts,.tsx,.cts -d dist src",
-    "lint": "eslint src --ext .js,.ts,.cts"
+    "lint": "eslint src --ext .js,.ts,.cts",
+    "test": "tsc --noEmit"
   },
   "dependencies": {
     "@orama/orama": "workspace:*",
     "@orama/plugin-match-highlight": "workspace:*",
-    "classnames": "^2.5.1",
-    "next": "^14.2.30",
-    "react": "^18.3.1",
-    "react-dom": "^18.3.1"
+    "classnames": "^2.5.1"
+  },
+  "peerDependencies": {
+    "next": "^14.2.30 || ^15.0.0 || ^16.0.0",
+    "react": "^18.3.1 || ^19.0.0",
+    "react-dom": "^18.3.1 || ^19.0.0"
   },
   "publishConfig": {
     "access": "public"
@@ -43,6 +46,11 @@
   "devDependencies": {
     "@swc/cli": "^0.1.59",
     "@swc/core": "^1.3.27",
+    "@types/react": "^19.2.0",
+    "@types/react-dom": "^19.2.0",
+    "next": "^16.1.5",
+    "react": "^19.2.0",
+    "react-dom": "^19.2.0",
     "typescript": "^5.0.0"
   }
 }
\ No newline at end of file
```

**File**: `packages/plugin-nextra/src/components/Result.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import React, { useState } from 'react'
 import { listItem, resultText } from '../utils/classNames.js'
-import NextLink from 'next/link.js'
+import NextLink from 'next/link'
 import { HighlightedDocument } from './HighlightedDocument.js'
 import { Result, TypedDocument } from '@orama/orama'
 import { NextraOrama } from '../utils/index.js'
```

**File**: `packages/plugin-nextra/tsconfig.json` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
   "compilerOptions": {
     "allowJs": true,
     "target": "ES5",
-    "module": "NodeNext",
+    "module": "ESNext",
     "outDir": "dist",
     "jsx": "react",
     "noImplicitAny": false,
@@ -14,7 +14,7 @@
     "skipLibCheck": true,
     "resolveJsonModule": true,
     "sourceMap": true,
-    "moduleResolution": "nodenext"
+    "moduleResolution": "bundler"
   },
   "include": ["src/*.ts", "src/**/*.ts", "src/*.tsx", "src/**/*.tsx"]
 }
```

**File**: `pnpm-lock.yaml` (modified, +299/-322)
```diff
@@ -155,7 +155,7 @@ importers:
         version: 17.0.1
       tap:
         specifier: ^18.7.1
-        version: 18.8.0(@swc/core@1.13.3)(@types/node@20.19.11)(@types/react@19.2.2)(react-dom@19.2.0(react@19.2.0))(react@18.3.1)(typescript@5.9.2)
+        version: 18.8.0(@swc/core@1.13.3)(@types/node@20.19.11)(@types/react@19.2.2)(react-dom@19.2.0(react@18.3.1))(react@18.3.1)(typescript@5.9.2)
       tap-mocha-reporter:
         specifier: ^5.0.3
         version: 5.0.4
@@ -474,22 +474,28 @@ importers:
       classnames:
         specifier: ^2.5.1
         version: 2.5.1
-      next:
-        specifier: ^14.2.30
-        version: 14.2.32(@playwright/test@1.54.2)(react-dom@18.3.1(react@18.3.1))(react@18.3.1)
-      react:
-        specifier: ^18.3.1
-        version: 18.3.1
-      react-dom:
-        specifier: ^18.3.1
-        version: 18.3.1(react@18.3.1)
     devDependencies:
       '@swc/cli':
         specifier: ^0.1.59
         version: 0.1.65(@swc/core@1.13.3)(chokidar@3.6.0)
       '@swc/core':
         specifier: ^1.3.27
         version: 1.13.3
+      '@types/react':
+        specifier: ^19.2.0
+        version: 19.2.2
+      '@types/react-dom':
+        specifier: ^19.2.0
+        version: 19.2.3(@types/react@19.2.2)
+      next:
+        specifier: ^16.1.5
+        version: 16.2.9(@playwright/test@1.54.2)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)
+      react:
+        specifier: ^19.2.0
+        version: 19.2.0
+      react-dom:
+        specifier: ^19.2.0
+        version: 19.2.0(react@19.2.0)
       typescript:
         specifier: ^5.0.0
         version: 5.9.2
@@ -785,13 +791,13 @@ importers:
     dependencies:
       '@docusaurus/core':
         specifier: 3.9.1
-        version: 3.9.1(@mdx-js/react@3.1.0(@types/react@19.2.2)(react@19.2.0))(@swc/core@1.13.3)(acorn@8.15.0)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)(typescript@5.9.2)
+        version: 3.9.1(@mdx-js/react@3.1.0(@types/react@19.2.2)(react@19.2.0))(@swc/core@1.13.3)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)(typescript@5.9.2)
       '@docusaurus/preset-classic':
         specifier: 3.9.1
-        version: 3.9.1(@algolia/client-search@5.40.0)(@mdx-js/react@3.1.0(@types/react@19.2.2)(react@19.2.0))(@swc/core@1.13.3)(@types/react@19.2.2)(acorn@8.15.0)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)(search-insights@2.17.3)(typescript@5.9.2)
+        version: 3.9.1(@algolia/client-search@5.40.0)(@mdx-js/react@3.1.0(@types/react@19.2.2)(react@19.2.0))(@swc/core@1.13.3)(@types/react@19.2.2)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)(search-insights@2.17.3)(typescript@5.9.2)
       '@docusaurus/utils':
         specifier: ^3.9.1
-        version: 3.9.1(@swc/core@1.13.3)(acorn@8.15.0)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)
+        version: 3.9.1(@swc/core@1.13.3)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)
       '@mdx-js/react':
         specifier: ^3.0.0
         version: 3.1.0(@types/react@19.2.2)(react@19.2.0)
@@ -3600,59 +3606,53 @@ packages:
     resolution: {integrity: sha512-xJIPs+bYuc9ASBl+cvGsKbGrJmS6fAKaSZCnT0lhahT5rhA2VVy9/EcIgd2JhtEuFOJNx7UHNn/qiTPTY4nrQw==}
     engines: {node: '>= 10'}
 
-  '@next/env@14.2.32':
-    resolution: {integrity: sha512-n9mQdigI6iZ/DF6pCTwMKeWgF2e8lg7qgt5M7HXMLtyhZYMnf/u905M18sSpPmHL9MKp9JHo56C6jrD2EvWxng==}
+  '@next/env@16.2.9':
+    resolution: {integrity: sha512-ki5VxxXfzD/9TDe13wyeTKIjQTAwBVpnr8KhRDUr8ltMUq1/NBpWNT5tiPoxiGl+PHM4X2ahSOiPk6iAimIzPg==}
 
-  '@next/swc-darwin-arm64@14.2.32':
-    resolution: {integrity: sha512-osHXveM70zC+ilfuFa/2W6a1XQxJTvEhzEycnjUaVE8kpUS09lDpiDDX2YLdyFCzoUbvbo5r0X1Kp4MllIOShw==}
+  '@next/swc-darwin-arm64@16.2.9':
+    resolution: {integrity: sha512-HkfxNYUCmcct0Xsqib5KxqMSHV4AHJq857BNRchyBDs4YS19aHzVfn1kDuBYKqLLQBjXgnkIsjV2Kd4d2wzYhw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [darwin]
 
-  '@next/swc-darwin-x64@14.2.32':
-    resolution: {integrity: sha512-P9NpCAJuOiaHHpqtrCNncjqtSBi1f6QUdHK/+dNabBIXB2RUFWL19TY1Hkhu74OvyNQEYEzzMJCMQk5agjw1Qg==}
+  '@next/swc-darwin-x64@16.2.9':
+    resolution: {integrity: sha512-7IAtK4MeybpqRV9GRABWEhJ62mOS+rzWOzOTFie4cSEtm12xsoOMJRcECoZx3FHPzFAqN/IJtHqWAFOLfl152w==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [darwin]
 
-  '@next/swc-linux-arm64-gnu@14.2.32':
-    resolution: {integrity: sha512-v7JaO0oXXt6d+cFjrrKqYnR2ubrD+JYP7nQVRZgeo5uNE5hkCpWnHmXm9vy3g6foMO8SPwL0P3MPw1c+BjbAzA==}
+  '@next/swc-linux-arm64-gnu@16.2.9':
+    resolution: {integrity: sha512-hBD75iWpUtkL9SmQmcRhmLomn9jgkPzCEkbOcLgHymPEKzv+6ONy13RRiIEz/iEObjkS2Jlb5gYS2XGoS3X4rw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
 
-  '@next/swc-linux-arm64-musl@14.2.32':
-    resolution: {integrity: sha512-tA6sIKShXtSJBTH88i0DRd6I9n3ZTirmwpwAqH5zdJoQF7/wlJXR8DkPmKwYl5mFWhEKr5IIa3LfpMW9RRwKmQ==}
+  '@next/swc-linux-arm64-musl@16.2.9':
+    resolution: {integrity: sha512-qZTI3pf9SGc/obr8NkQAekBxmp1QK+kVm+VAf3BALLfFAj+1kUhkTxmrWpVos9R/UYIA8AWX2p6cGI5WdwzVUA==}
     engines: {node: '>= 10'}
     cpu: 
```

---

### Incident Patch 4: `bdeeef5e` (2026-06-26)
**Commit Message**: fix(plugin-astro): migrate to Astro 5 (#1020)

Co-authored-by: Claude Opus 4.6 <[REDACTED_EMAIL]>
Co-authored-by: thatjuan <[REDACTED_EMAIL]>

**File**: `packages/plugin-astro/package.json` (modified, +2/-2)
```diff
@@ -42,7 +42,7 @@
   },
   "dependencies": {
     "@orama/orama": "workspace:*",
-    "astro": "^2.0.2",
+    "astro": "^5.0.0",
     "html-to-text": "^9.0.3"
   },
   "devDependencies": {
@@ -58,6 +58,6 @@
     "node": ">= 20.0.0"
   },
   "peerDependencies": {
-    "astro": "^2.0.4"
+    "astro": "^5.0.0"
   }
 }
\ No newline at end of file
```

**File**: `packages/plugin-astro/src/index.ts` (modified, +11/-12)
```diff
@@ -1,6 +1,6 @@
 import type { AnyOrama, Orama, SearchParams } from '@orama/orama'
 import { create as createOramaDB, insert as insertIntoOramaDB, save as saveOramaDB } from '@orama/orama'
-import type { AstroIntegration, RouteData } from 'astro'
+import type { AstroIntegration } from 'astro'
 import { compile } from 'html-to-text'
 import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
 import path from 'node:path'
@@ -47,7 +47,7 @@ const h1Converter = compile({
 async function prepareOramaDb(
   dbConfig: OramaOptions,
   pages: AstroPage[],
-  routes: RouteData[],
+  assets: Map<string, (URL | string)[]>,
   dir: URL
 ): Promise<Orama<PageIndexSchema, any, any, any>> {
   const contentConverter = compile({
@@ -58,18 +58,17 @@ async function prepareOramaDb(
 
   // All routes are in the same folder, we can use the first one to get the basePath
   const basePath = dir.pathname.slice(isWindows ? 1 : 0)
-  // Create a dist urls
-  const distUrls = routes.flatMap((r) => r.distURL)
+  // Collect all asset file paths from the assets map (values may be URL objects or strings)
+  const assetPaths = [...assets.values()].flat().map((p) => (typeof p === 'string' ? p : p.pathname))
   const pathsToBeIndexed = pages
-    .filter(({ pathname }) => dbConfig.pathMatcher.test(pathname))
+    .filter(({ pathname }) => dbConfig.pathMatcher.test(`/${pathname}`))
     .map(({ pathname }) => {
       // Some pages like 404 are generated as 404.html while others are usually pageName/index.html
-      const matchingPathname = distUrls
-        .find((url) => url?.pathname.endsWith(pathname.replace(/\/$/, '') + '.html'))
-        ?.pathname?.slice(isWindows ? 1 : 0)
+      const matchingPath = assetPaths
+        .find((p) => p.endsWith(pathname.replace(/\/$/, '') + '.html'))
       return {
         pathname,
-        generatedFilePath: matchingPathname ?? `${basePath}${pathname.replace(/\/+$/, '')}/index.html`
+        generatedFilePath: matchingPath ?? `${basePath}${pathname.replace(/\/+$/, '')}/index.html`
       }
     })
     .filter(({ generatedFilePath }) => !!generatedFilePath)
@@ -105,16 +104,16 @@ export function createPlugin(options: Record<string, OramaOptions>): AstroIntegr
   return {
     name: PKG_NAME,
     hooks: {
-      'astro:build:done': async function ({ pages, routes, dir }): Promise<void> {
+      'astro:build:done': async function ({ pages, assets, dir }): Promise<void> {
         const assetsDir = joinPath(dir.pathname, 'assets').slice(isWindows ? 1 : 0)
         if (!existsSync(assetsDir)) {
           mkdirSync(assetsDir)
         }
 
         for (const [dbName, dbConfig] of Object.entries(options)) {
-          const namedDb = await prepareOramaDb(dbConfig, pages, routes, dir)
+          const namedDb = await prepareOramaDb(dbConfig, pages, assets, dir)
 
-          writeFileSync(joinPath(assetsDir, `oramaDB_${dbName}.json`), JSON.stringify(await saveOramaDB(namedDb)), {
+          writeFileSync(joinPath(assetsDir, `oramaDB_${dbName}.json`), JSON.stringify(saveOramaDB(namedDb)), {
             encoding: 'utf8'
           })
         }
```

**File**: `packages/plugin-astro/test/integration.ts` (modified, +18/-0)
```diff
@@ -81,6 +81,7 @@ await test('plugin is able to generate orama DB at build time', async () => {
   assert.ok(existsSync(resolve(sandbox, 'dist', 'assets', 'oramaDB_animals.json')))
   assert.ok(existsSync(resolve(sandbox, 'dist', 'assets', 'oramaDB_games.json')))
   assert.ok(existsSync(resolve(sandbox, 'dist', 'assets', 'oramaDB_dynamic.json')))
+  assert.ok(existsSync(resolve(sandbox, 'dist', 'assets', 'oramaDB_leadingSlash.json')))
 })
 
 await test('generated DBs have indexed pages content', async () => {
@@ -108,6 +109,12 @@ await test('generated DBs have indexed pages content', async () => {
   const allSiteDB = await createOramaDB({ schema: { _: 'string' } })
   await loadOramaDB(allSiteDB, allSiteData as any)
 
+  // Loading "leadingSlash DB"
+  const rawLeadingSlashData = await readFile(resolve(sandbox, 'dist/assets/oramaDB_leadingSlash.json'), 'utf8')
+  const leadingSlashData = JSON.parse(rawLeadingSlashData)
+  const leadingSlashDB = await createOramaDB({ schema: { _: 'string' } })
+  await loadOramaDB(leadingSlashDB, leadingSlashData as any)
+
   // Search results seem reasonable
   const catSearchResult = await search(animalsDB, { term: 'cat' })
   assert.ok(catSearchResult.count === 1)
@@ -131,6 +138,17 @@ await test('generated DBs have indexed pages content', async () => {
   // pathMatcher works on dynamic pages
   const dynamicTestMissingSearchResult = await search(dynamicDB, { term: 'ninja' })
   assert.ok(dynamicTestMissingSearchResult.count === 0)
+
+  // The leading-slash-anchored matcher (/^\/animals_cat\//) matches because since
+  // Astro 5 the plugin tests pathMatcher against `/${pathname}`. Only the
+  // /animals_cat/ page is collected into this DB.
+  const leadingSlashCatResult = await search(leadingSlashDB, { term: 'cat' })
+  assert.ok(leadingSlashCatResult.count === 1)
+  assert.ok((leadingSlashCatResult.hits[0].document as unknown as { path: string }).path === '/animals_cat/')
+
+  // No other page is indexed by the anchored matcher
+  const leadingSlashDogResult = await search(leadingSlashDB, { term: 'dog' })
+  assert.ok(leadingSlashDogResult.count === 0)
 })
 
 if (!process.env.KEEP_SANDBOX_ASTRO) {
```

**File**: `packages/plugin-astro/test/sandbox/astro.config.mjs` (modified, +5/-1)
```diff
@@ -15,7 +15,11 @@ export default defineConfig({
       animals: { pathMatcher: /animals_.+$/ },
       games: { pathMatcher: /games_.+$/ },
       dynamic: { pathMatcher: /blog\/inner-path\/article(.*)$/ },
-      allSite: { pathMatcher: /.*/ }
+      allSite: { pathMatcher: /.*/ },
+      // Anchored matcher that only matches when the path has a leading slash.
+      // Since Astro 5 the plugin tests pathMatcher against `/${pathname}`, so
+      // this collects exactly the `/animals_cat/` page and nothing else.
+      leadingSlash: { pathMatcher: /^\/animals_cat\// }
     })
   ],
   trailingSlash: 'always'
```

**File**: `packages/plugin-astro/test/sandbox/package.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   },
   "dependencies": {
     "@orama/plugin-astro": "^@VERSION@",
-    "astro": "^2.0.2"
+    "astro": "^5.0.0"
   },
   "pnpm": {
     "overrides": {
```

**File**: `packages/plugin-astro/test/sandbox/src/content.config.ts` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import { defineCollection, z } from 'astro:content'
+import { glob } from 'astro/loaders'
+
+const posts = defineCollection({
+  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
+  schema: z.object({
+    title: z.string()
+  })
+})
+
+export const collections = { posts }
```

**File**: `packages/plugin-astro/test/sandbox/src/pages/[...blog]/[...inner]/index.astro` (modified, +4/-3)
```diff
@@ -1,5 +1,5 @@
 ---
-import { getCollection } from 'astro:content'
+import { getCollection, render } from 'astro:content'
 
 export async function getStaticPaths() {
   const posts = await getCollection('posts')
@@ -8,16 +8,17 @@ export async function getStaticPaths() {
     return {
       params: {
         blog: 'blog',
-        inner: 'inner-path/' + post.slug
+        inner: 'inner-path/' + post.id
       },
       props: { post }
     }
   })
 }
 
 const { post } = Astro.props
+const { Content } = await render(post)
 ---
 
 <div class="content">
-  {post.body}
+  <Content />
 </div>
```

---

### Incident Patch 5: `b7868b5a` (2025-12-14)
**Commit Message**: fix: version name (#1005)

**File**: `packages/plugin-docusaurus-v3/src/theme/SearchBar/index.tsx` (modified, +13/-1)
```diff
@@ -72,14 +72,26 @@ export function OramaSearchNoDocs() {
   )
 }
 
+function getVersionName(version: string | { name: string } | null): string | undefined {
+  if (!version) {
+    return undefined
+  }
+
+  if (typeof version === 'string') {
+    return version
+  }
+
+  return version.name
+}
+
 export function OramaSearchWithDocs({ pluginId }: { pluginId: string }) {
   const colorMode = getColorMode()
   const { searchBoxConfig, searchBtnConfig } = useOrama()
   const collectionManager = searchBoxConfig.basic?.collectionManager
   const versions = useVersions(pluginId)
   const activeVersion = useActiveVersion(pluginId)
   const preferredVersion = getPreferredVersion(searchBoxConfig.basic.clientInstance)
-  const currentVersion = activeVersion || preferredVersion || versions[0]
+  const currentVersion = getVersionName(activeVersion) || getVersionName(preferredVersion) || getVersionName(versions[0]);
 
   const searchParams = {
     ...(currentVersion && {
```

---

### Incident Patch 6: `0cacaad5` (2025-10-10)
**Commit Message**: fix: #866 - Search with exact: true doesn't work as intended

**File**: `packages/orama/src/methods/search-fulltext.ts` (modified, +48/-0)
```diff
@@ -83,6 +83,35 @@ export function innerFullTextSearch<T extends AnyOrama>(
       whereFiltersIDs,
       threshold
     )
+
+    // When exact is true and we have a term, filter results to only include documents
+    // where the original text contains the exact search term (case-sensitive).
+    // This is a highly requested feature and although Orama is not case-sensitive by design,
+    // this is a reasonable compromise.
+    if (params.exact && term) {
+      const searchTerms = term.trim().split(/\s+/)
+      uniqueDocsIDs = uniqueDocsIDs.filter(([docId]) => {
+        const doc = orama.documentsStore.get(orama.data.docs, docId)
+        if (!doc) return false
+
+        // Check if any of the specified properties contain the exact search term
+        for (const prop of propertiesToSearch) {
+          const propValue = getPropValue(doc, prop)
+          if (typeof propValue === 'string') {
+            // Check if all search terms appear as complete words in the property value
+            const hasAllTerms = searchTerms.every((searchTerm) => {
+              // Create a regex that matches the term as a complete word (case-sensitive)
+              const regex = new RegExp(`\\b${escapeRegex(searchTerm)}\\b`)
+              return regex.test(propValue)
+            })
+            if (hasAllTerms) {
+              return true
+            }
+          }
+        }
+        return false
+      })
+    }
   } else {
     // Check if this is a geosearch-only query first
     if (hasFilters) {
@@ -105,6 +134,25 @@ export function innerFullTextSearch<T extends AnyOrama>(
   return uniqueDocsIDs
 }
 
+// Helper function to escape regex special characters
+function escapeRegex(str: string): string {
+  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
+}
+
+// Helper function to get nested property value
+function getPropValue(obj: any, path: string): any {
+  const keys = path.split('.')
+  let value = obj
+  for (const key of keys) {
+    if (value && typeof value === 'object' && key in value) {
+      value = value[key]
+    } else {
+      return undefined
+    }
+  }
+  return value
+}
+
 export function fullTextSearch<T extends AnyOrama, ResultDocument = TypedDocument<T>>(
   orama: T,
   params: SearchParamsFullText<T, ResultDocument>,
```

**File**: `packages/orama/tests/dataset.test.ts` (modified, +9/-6)
```diff
@@ -108,9 +108,10 @@ t.test("orama.dataset", async (t) => {
       Object.keys((db.data.docs as DocumentsStore).docs).length,
       (dataset as EventJson).result.events.length,
     );
-    t.equal(s1.count, 1117);
-    t.equal(s2.count, 7314);
-    t.equal(s3.count, 7314);
+    // Note: counts changed after adding case-sensitive exact matching in issue #866
+    t.equal(s1.count, 0); // "War" (capitalized) doesn't match "war" (lowercase) with exact: true
+    t.equal(s2.count, 0); // Same reason
+    t.equal(s3.count, 0); // Same reason
 
     t.end();
   });
@@ -214,8 +215,9 @@ t.test("orama.dataset", async (t) => {
       t.strictSame(s3, snapshots[`${t.name}-page-3`]);
     }
 
-    t.equal(s4.count, 2357);
-    t.equal(s5.hits.length, 10);
+    // Note: counts changed after adding case-sensitive exact matching in issue #866
+    t.equal(s4.count, 679); // Only lowercase "war" matches, not "War"
+    t.equal(s5.hits.length, 0); // No results at offset 2239 with only 679 total results
 
     t.end();
   });
@@ -241,7 +243,8 @@ t.test("orama.dataset", async (t) => {
       offset: 0,
     });
 
-    t.equal(newSearch.count, 2347);
+    // Note: counts changed after adding case-sensitive exact matching in issue #866
+    t.equal(newSearch.count, 669); // Only lowercase "war" matches, not "War", and after deleting 10 docs
 
     t.end();
   });
```

**File**: `packages/orama/tests/issue-866.test.ts` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+import t from 'tap'
+import { create, insert, search } from '../src/index.js'
+
+t.test('issue-866: exact search should only match exact terms', async (t) => {
+  t.test('should not match partial words when exact is true', async (t) => {
+    const db = create({
+      schema: {
+        path: 'string',
+        title: 'string'
+      }
+    })
+
+    await insert(db, { path: 'First Note.md', title: 'First Note' })
+    await insert(db, { path: 'Second Note.md', title: 'Second Note' })
+
+    // Without exact, should match because "first" is a prefix
+    const noExact = await search(db, {
+      term: 'first',
+      properties: ['path']
+    })
+
+    // With exact: true, should NOT match "First Note.md" because "first" !== "First"
+    const withExact = await search(db, {
+      term: 'first',
+      properties: ['path'],
+      exact: true
+    })
+
+    t.ok(noExact.count >= 1, 'Without exact, should find results with prefix match')
+    t.equal(withExact.count, 0, 'With exact: true, should not match "first" with "First"')
+  })
+
+  t.test('should match exact terms when exact is true', async (t) => {
+    const db = create({
+      schema: {
+        path: 'string',
+        title: 'string'
+      }
+    })
+
+    await insert(db, { path: 'First Note.md', title: 'First Note' })
+    await insert(db, { path: 'first note.md', title: 'first note' })
+    await insert(db, { path: 'another first file.md', title: 'another' })
+
+    // With exact: true, searching for "first" should only match documents with lowercase "first"
+    const result = await search(db, {
+      term: 'first',
+      properties: ['path'],
+      exact: true
+    })
+
+    t.equal(result.count, 2, 'Should match exactly two documents with lowercase "first"')
+    const paths = result.hits.map(h => h.document.path).sort()
+    t.strictSame(paths, ['another first file.md', 'first note.md'], 'Should match only lowercase versions')
+  })
+
+  t.test('should not match prefix when exact is true', async (t) => {
+    const db = create({
+      schema: {
+        name: 'string'
+      }
+    })
+
+    await insert(db, { name: 'apple' })
+    await insert(db, { name: 'application' })
+    await insert(db, { name: 'app' })
+
+    // Without exact, "app" should match all three
+    const noExact = await search(db, {
+      term: 'app',
+      exact: false
+    })
+
+    // With exact: true, "app" should only match the document with "app"
+    const withExact = await search(db, {
+      term: 'app',
+      exact: true
+    })
+
+    t.equal(noExact.count, 3, 'Without exact, should match all prefix matches')
+    t.equal(withExact.count, 1, 'With exact: true, should only match exact term')
+    t.equal(withExact.hits[0].document.name, 'app', 'Should match only "app"')
+  })
+
+  t.test('should handle case sensitivity with exact match', async (t) => {
+    const db = create({
+      schema: {
+        name: 'string'
+      }
+    })
+
+    await insert(db, { name: 'Test' })
+    await insert(db, { name: 'test' })
+    await insert(db, { name: 'testing' })
+    await insert(db, { name: 'test again' })
+
+    // With exact: true, searching for "test" should match only documents with lowercase "test"
+    const result = await search(db, {
+      term: 'test',
+      exact: true
+    })
+
+    t.equal(result.count, 2, 'Should match two documents with lowercase "test"')
+    const names = result.hits.map(h => h.document.name).sort()
+    t.strictSame(names, ['test', 'test again'], 'Should match only lowercase versions')
+  })
+})
```

**File**: `packages/orama/tests/search.test.ts` (modified, +5/-3)
```diff
@@ -83,12 +83,14 @@ t.test('search method', async (t) => {
       await insert(db, { quote: 'I like dogs. They are the best.', author: 'Jane Doe' })
       await insert(db, { quote: 'I like cats. They are the best.', author: 'Jane Doe' })
 
-      // Exact search
+      // Exact search - now case-sensitive
       const result1 = await search(db, { term: 'fox', exact: true })
       const result2 = await search(db, { term: 'dog', exact: true })
 
-      t.equal(result1.count, 2)
-      t.equal(result2.count, 3)
+      // Only lowercase "fox" matches, not "Foxes"
+      t.equal(result1.count, 1)
+      // "dog" appears in lowercase in 2 documents
+      t.equal(result2.count, 2)
 
       // Prefix search
       const result3 = await search(db, { term: 'fox', exact: false })
```

**File**: `packages/orama/tests/snapshots/events.json` (modified, +131/-131)
```diff
@@ -1,13 +1,13 @@
 {
   "should perform paginate search-page-1": {
-    "count": 2357,
+    "count": 679,
     "hits": [
       {
         "id": "",
         "score": 4.744426329679039,
         "document": {
-          "date": "-89",
-          "description": "Social War:",
+          "date": "-53",
+          "description": "Parthian war:",
           "granularity": "year",
           "categories": {
             "first": "By place",
@@ -17,23 +17,23 @@
       },
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 4.087300377720357,
         "document": {
-          "date": "-57",
-          "description": "Gallic Wars:",
+          "date": "1728/10/20",
+          "description": "The Meerkat–Mongoose war.",
           "granularity": "year",
           "categories": {
-            "first": "By place",
-            "second": "Roman Republic"
+            "first": "In fiction",
+            "second": ""
           }
         }
       },
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 3.544022161031509,
         "document": {
-          "date": "-55",
-          "description": "Gallic War",
+          "date": "-156",
+          "description": "The first Dalmatian war begins.",
           "granularity": "year",
           "categories": {
             "first": "By place",
@@ -43,10 +43,10 @@
       },
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 3.544022161031509,
         "document": {
-          "date": "-54",
-          "description": "Gallic Wars",
+          "date": "-119",
+          "description": "The second Dalmatian war begins.",
           "granularity": "year",
           "categories": {
             "first": "By place",
@@ -56,10 +56,10 @@
       },
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 3.544022161031509,
         "document": {
-          "date": "-53",
-          "description": "Parthian war:",
+          "date": "-78",
+          "description": "The Third Dalmatian war begins.",
           "granularity": "year",
           "categories": {
             "first": "By place",
@@ -69,335 +69,335 @@
       },
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 3.544022161031509,
         "document": {
-          "date": "-53",
-          "description": "Gallic War:",
+          "date": "599",
+          "description": "The Chinese win the war at Ordos.",
           "granularity": "year",
           "categories": {
             "first": "By place",
-            "second": "Roman Republic"
+            "second": "Asia"
           }
         }
       },
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 3.544022161031509,
         "document": {
-          "date": "-48",
-          "description": "Civil War:",
+          "date": "1027/08/16",
+          "description": "Civil war begins in Japan.",
           "granularity": "year",
           "categories": {
             "first": "By place",
-            "second": "Roman Republic"
+            "second": "Asia"
           }
         }
       },
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 3.544022161031509,
         "document": {
-          "date": "-47",
-          "description": "Civil War:",
+          "date": "1695/12/31",
+          "description": "Russia declares war on Turkey.",
           "granularity": "year",
           "categories": {
-            "first": "By place",
-            "second": "Roman Republic"
+            "first": "Date unknown",
+            "second": ""
           }
         }
       },
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 3.544022161031509,
         "document": {
-          "date": "-46",
-          "description": "Civil War:",
+          "date": "1792/04/20",
+          "description": " France declares war against Austria.",
           "granularity": "year",
           "categories": {
-            "first": "By place",
-            "second": "Roman Republic"
+            "first": "April/June",
+            "second": ""
           }
         }
       },
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 3.544022161031509,
         "document": {
-          "date": "1809/03/13",
-          "description": "Peninsular War",
+          "date": "1792/06/04",
+          "description": "Prussia declares war against France.",
           "granularity": "year",
           "categories": {
-            "first": "January/March",
+            "first": "April/June",
             "second": ""
           }
         }
       }
     ]
   },
   "should perform paginate search-page-2": {
-    "count": 2357,
+    "count": 679,
     "hits": [
       {
         "id": "",
-        "score": 4.744426329679039,
+        "score": 3.544022161031509,
         "document": {
-          "date": "1867/12/02",
-          "description": "Paraguay
```

---

### Incident Patch 7: `0c6d861f` (2025-10-09)
**Commit Message**: fix: #962 (#987)

**File**: `packages/plugin-docusaurus-v3/src/theme/SearchBar/utils.ts` (modified, +3/-0)
```diff
@@ -2,6 +2,9 @@ import {useActivePlugin} from "@docusaurus/plugin-content-docs/client";
 import {ReactContextError, useDocsPreferredVersion} from "@docusaurus/theme-common";
 
 export function getColorMode() {
+	if (typeof document === 'undefined') {
+		return 'light';
+	}
 	const html = document.querySelector("html");
 	return html?.dataset.theme
 }
```

---

### Incident Patch 8: `df66ccaf` (2025-10-09)
**Commit Message**: fix: #984 (#986)

**File**: `packages/orama/package.json` (modified, +1/-1)
```diff
@@ -177,4 +177,4 @@
     ]
   },
   "module": "./dist/esm/index.js"
-}
\ No newline at end of file
+}
```

**File**: `packages/plugin-docusaurus-v3/package.json` (modified, +8/-8)
```diff
@@ -26,7 +26,7 @@
     "watch": "tsc --watch"
   },
   "dependencies": {
-    "@orama/core": "^0.1.8",
+    "@orama/core": "^1.2.13",
     "@orama/highlight": "^0.1.5",
     "@orama/orama": "workspace:*",
     "@orama/plugin-analytics": "workspace:*",
@@ -35,18 +35,18 @@
     "@oramacloud/client": "^2.1.4",
     "github-slugger": "^2.0.0",
     "gray-matter": "^4.0.3",
-    "jsdom": "^23.2.0",
-    "markdown-it": "^13.0.2",
+    "jsdom": "^27.0.0",
+    "markdown-it": "^14.1.0",
     "pako": "^2.1.0",
     "tslib": "^2.6.2",
-    "vfile-message": "^3.1.4"
+    "vfile-message": "^4.0.3"
   },
   "devDependencies": {
-    "@docusaurus/types": "~3.6.3",
-    "@types/jsdom": "^21.1.6",
-    "@types/markdown-it": "^13.0.7",
+    "@docusaurus/types": "~3.9.1",
+    "@types/jsdom": "^27.0.0",
+    "@types/markdown-it": "^14.1.2",
     "@types/pako": "^2.0.3",
-    "@types/react": "^18.3.3",
+    "@types/react": "^19.2.2",
     "typescript": "^5.6.3"
   },
   "peerDependencies": {
```

**File**: `packages/plugin-docusaurus-v3/src/index.ts` (modified, +4/-3)
```diff
@@ -1,11 +1,11 @@
 import { parseMarkdownHeadingId, writeMarkdownHeadingId } from '@docusaurus/utils'
 import type { Plugin } from '@docusaurus/types'
-import type { LoadContext } from '@docusaurus/types';
+import type { LoadContext } from '@docusaurus/types'
 import { readFileSync, writeFileSync } from 'node:fs'
 import { cp } from 'node:fs/promises'
 import { resolve } from 'node:path'
 import { gzip } from 'pako'
-import { AnyOrama, create, insertMultiple, save } from '@orama/orama'
+import { AnyOrama, save } from '@orama/orama'
 import { CloudManager } from '@oramacloud/client'
 import { JSDOM } from 'jsdom'
 import MarkdownIt from 'markdown-it'
@@ -122,7 +122,8 @@ async function syncOramaIndex({
 }): Promise<IndexConfig> {
   const { apiKey, indexId, deploy, collectionId } = cloudConfig
 
-  if(!collectionId) { // NOTE: lack of collectionId means legacy Orama
+  if (!collectionId) {
+    // NOTE: lack of collectionId means legacy Orama
     const baseUrl = process.env.ORAMA_CLOUD_BASE_URL || 'https://cloud.oramasearch.com/api/v1'
 
     const cloudManager = new CloudManager({
```

**File**: `packages/plugin-docusaurus-v3/src/theme/SearchBar/index.tsx` (modified, +106/-102)
```diff
@@ -1,124 +1,128 @@
-import React, {useEffect, useState, lazy} from 'react'
-import {useLocation} from '@docusaurus/router'
-import BrowserOnly from '@docusaurus/BrowserOnly';
-import {useActiveVersion, useVersions} from '@docusaurus/plugin-content-docs/client'
-import {usePluginData} from '@docusaurus/useGlobalData'
-import {CollectionManager} from '@orama/core';
+import React, { lazy } from 'react'
+import { useLocation } from '@docusaurus/router'
+import BrowserOnly from '@docusaurus/BrowserOnly'
+import { useActiveVersion, useVersions } from '@docusaurus/plugin-content-docs/client'
+import { usePluginData } from '@docusaurus/useGlobalData'
+import { CollectionManager } from '@orama/core'
 
 import useOrama from './useOrama.js'
-import {OramaData} from '../../types.js'
-import {getColorMode, getPreferredVersion} from "./utils.js";
+import { OramaData } from '../../types.js'
+import { getColorMode, getPreferredVersion } from './utils.js'
 
-const OramaSearchButton = lazy(() =>
-	import('@orama/react-components').then(module => ({
-		default: module.OramaSearchButton
-	})) as Promise<{ default: React.ComponentType<{ children?: any, colorScheme?: string, className: string }> }>
-);
+const OramaSearchButton = lazy(
+  () =>
+    import('@orama/react-components').then((module) => ({
+      default: module.OramaSearchButton
+    })) as Promise<{ default: React.ComponentType<{ children?: any; colorScheme?: string; className: string }> }>
+)
 
-const OramaSearchBox = lazy(() =>
-	import('@orama/react-components').then(module => ({
-		default: module.OramaSearchBox
-	})) as Promise<{ default: React.ComponentType<{ children?: any, oramaCoreClientInstance?: CollectionManager, colorScheme?: string, searchParams: any }> }>
-);
+const OramaSearchBox = lazy(
+  () =>
+    import('@orama/react-components').then((module) => ({
+      default: module.OramaSearchBox
+    })) as Promise<{
+      default: React.ComponentType<{
+        children?: any
+        oramaCoreClientInstance?: CollectionManager
+        colorScheme?: string
+        searchParams: any
+      }>
+    }>
+)
 
 // Add `where` when collectionManager is provided
 // Handles different query APIs
-function formatSearchParams(
-	versionName: string,
-	collectionManager: CollectionManager | undefined) {
-	if (collectionManager) {
-		return {
-			version: versionName
-		}
-	}
+function formatSearchParams(versionName: string, collectionManager: CollectionManager | undefined) {
+  if (collectionManager) {
+    return {
+      version: versionName
+    }
+  }
 
-	return {
-		version: {eq: versionName} as any
-	}
+  return {
+    version: { eq: versionName } as any
+  }
 }
 
 export function OramaSearchNoDocs() {
-	const colorMode = getColorMode()
-	const {searchBoxConfig, searchBtnConfig = {
-		text: 'Search'
-	}} = useOrama()
-	const collectionManager = searchBoxConfig.basic?.collectionManager
+  const colorMode = getColorMode()
+  const {
+    searchBoxConfig,
+    searchBtnConfig = {
+      text: 'Search'
+    }
+  } = useOrama()
+  const collectionManager = searchBoxConfig.basic?.collectionManager
 
-	return (
-		<React.Fragment>
-			<OramaSearchButton
-				colorScheme={colorMode}
-				className="DocSearch-Button"
-				{...searchBtnConfig}
-			>
-				{searchBtnConfig?.text}
-			</OramaSearchButton>
-			<OramaSearchBox
-				{...(collectionManager ? {} : searchBoxConfig.basic)}
-				{...searchBoxConfig.custom}
-				oramaCoreClientInstance={collectionManager}
-				colorScheme={colorMode}
-				searchParams={{
-					where: formatSearchParams('current', collectionManager)
-				}}
-			/>
-		</React.Fragment>
-	)
+  return (
+    <React.Fragment>
+      <OramaSearchButton colorScheme={colorMode} className="DocSearch-Button" {...searchBtnConfig}>
+        {searchBtnConfig?.text}
+      </OramaSearchButton>
+      <OramaSearchBox
+        {...(collectionManager ? {} : searchBoxConfig.basic)}
+        {...searchBoxConfig.custom}
+        oramaCoreClientInstance={collectionManager}
+        colorScheme={colorMode}
+        searchParams={{
+          where: formatSearchParams('current', collectionManager)
+        }}
+      />
+    </React.Fragment>
+  )
 }
 
-export function OramaSearchWithDocs({pluginId}: { pluginId: string }) {
-	const colorMode = getColorMode()
-	const {searchBoxConfig, searchBtnConfig} = useOrama()
-	const collectionManager = searchBoxConfig.basic?.collectionManager
-	const versions = useVersions(pluginId)
-	const activeVersion = useActiveVersion(pluginId)
-	const preferredVersion = getPreferredVersion(searchBoxConfig.basic.clientInstance)
-	const currentVersion = activeVersion || preferredVersion || versions[0]
+export function OramaSearchWithDocs({ pluginId }: { pluginId: string }) {
+  const colorMode = getColorMode()
+  const { searchBoxConfig, searchBtnConfig } = useOrama()
+  const collectionManager = searchBoxConfig.basic?.collectionManager
+  const versions = useVersions(pluginId)
+  const activeVersion = useActiveVersion(pluginId)
+  const pr
```

**File**: `packages/plugin-docusaurus-v3/src/theme/SearchBar/useOrama.ts` (modified, +32/-33)
```diff
@@ -3,12 +3,12 @@ import useBaseUrl from '@docusaurus/useBaseUrl'
 import useIsBrowser from '@docusaurus/useIsBrowser'
 import { usePluginData } from '@docusaurus/useGlobalData'
 import { ungzip } from 'pako'
-import { create, insertMultiple } from '@orama/orama'
+import { create, load } from '@orama/orama'
 import { pluginAnalytics } from '@orama/plugin-analytics'
-import { CollectionManager } from '@orama/core';
+import { CollectionManager } from '@orama/core'
 
 import { DOCS_PRESET_SCHEMA } from '../../constants.js'
-import type {OramaCloudData, OramaData, OramaDoc, OramaPlugins} from '../../types.js'
+import type { OramaCloudData, OramaData, OramaPlugins } from '../../types.js'
 import { createOramaInstance } from '../../utils.js'
 
 function getOramaPlugins(plugins: OramaPlugins | undefined): any[] {
@@ -28,39 +28,38 @@ function getOramaPlugins(plugins: OramaPlugins | undefined): any[] {
 }
 
 async function getOramaLocalData(indexGzipURL: string, plugins: OramaPlugins | undefined) {
-	try {
-		const searchResponse = await fetch(indexGzipURL);
-
-		if (!searchResponse.ok) {
-			const errorText = await searchResponse.text();
-			throw new Error(`HTTP error ${searchResponse.status}: ${errorText}`);
-		}
-
-		const buffer = await searchResponse.arrayBuffer();
-		const deflatedString = ungzip(buffer, { to: 'string' });
-		const parsedData = JSON.parse(deflatedString);
-
-		const db = create({
-			schema: { ...DOCS_PRESET_SCHEMA, version: 'enum' },
-			plugins: getOramaPlugins(plugins)
-		});
-
-		const documents = Object.values(parsedData.docs.docs);
-		await insertMultiple(db, documents as OramaDoc[]);
-
-		return db;
-	} catch (error) {
-		console.error('Error loading search index:', error);
-		throw error;
-	}
+  try {
+    const searchResponse = await fetch(indexGzipURL)
+
+    if (!searchResponse.ok) {
+      const errorText = await searchResponse.text()
+      throw new Error(`HTTP error ${searchResponse.status}: ${errorText}`)
+    }
+
+    const buffer = await searchResponse.arrayBuffer()
+    const deflatedString = ungzip(buffer, { to: 'string' })
+    const parsedData = JSON.parse(deflatedString)
+
+    const db = create({
+      schema: { ...DOCS_PRESET_SCHEMA, version: 'enum' },
+      plugins: getOramaPlugins(plugins)
+    })
+
+    load(db, parsedData)
+
+    return db
+  } catch (error) {
+    console.error('Error loading search index:', error)
+    throw error
+  }
 }
 
 function isCloudData(data: OramaData): data is OramaCloudData {
   return data.oramaMode === 'cloud'
 }
 
 export default function useOrama() {
-  const [searchBoxConfig, setSearchBoxConfig] = useState < {
+  const [searchBoxConfig, setSearchBoxConfig] = useState<{
     basic: Record<string, any>
     custom: Record<string, any>
   }>({
@@ -81,13 +80,13 @@ export default function useOrama() {
         const collectionId = oramaData.indexConfig.collection_id
         const apiKey = oramaData.indexConfig.api_key
 
-        let collectionManager;
+        let collectionManager
 
-        if(collectionId) { // Note: collectionId is ONLY available in OramaCore
+        if (collectionId) {
+          // Note: collectionId is ONLY available in OramaCore
           collectionManager = new CollectionManager({
-            url: oramaData.indexConfig.endpoint,
             collectionID: collectionId,
-            readAPIKey: apiKey
+            apiKey
           })
         }
 
```

**File**: `packages/tokenizers/package.json` (modified, +1/-1)
```diff
@@ -82,4 +82,4 @@
     "tshy": "^3.0.2",
     "tsx": "^4.19.2"
   }
-}
\ No newline at end of file
+}
```

**File**: `sandboxes/plugin-docusaurus-v3-sandbox/package.json` (modified, +8/-8)
```diff
@@ -14,18 +14,18 @@
     "write-heading-ids": "docusaurus write-heading-ids"
   },
   "dependencies": {
-    "@docusaurus/core": "3.0.1",
-    "@docusaurus/preset-classic": "3.0.1",
-    "@docusaurus/utils": "^3.0.1",
+    "@docusaurus/core": "3.9.1",
+    "@docusaurus/preset-classic": "3.9.1",
+    "@docusaurus/utils": "^3.9.1",
     "@mdx-js/react": "^3.0.0",
     "@orama/plugin-docusaurus-v3": "workspace:*",
     "clsx": "^2.0.0",
-    "jsdom": "^23.0.1",
-    "markdown-it": "^13.0.2",
+    "jsdom": "^27.0.0",
+    "markdown-it": "^14.1.0",
     "pako": "^2.1.0",
     "prism-react-renderer": "^2.3.0",
-    "react": "^18.2.0",
-    "react-dom": "^18.2.0",
+    "react": "^19.2.0",
+    "react-dom": "^19.2.0",
     "slugify": "^1.6.6"
   },
   "devDependencies": {
@@ -47,4 +47,4 @@
   "engines": {
     "node": ">= 20.0.0"
   }
-}
+}
\ No newline at end of file
```

---

### Incident Patch 9: `72524ecc` (2025-09-16)
**Commit Message**: fix: vector.property access in plugin embeddings (#982)

**File**: `packages/orama/tests/plugin-embeddings-mock.test.ts` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+import t from 'tap'
+import { create, insert, search } from '../src/index.js'
+
+t.test('Plugin embeddings fix test', async (t) => {
+  t.test('should handle vector search with term parameter (no vector.property error)', async (t) => {
+    function mockEmbeddingsPlugin() {
+      return {
+        name: 'mock-embeddings-plugin',
+
+        async beforeSearch(_db, params) {
+          if (params.mode !== 'vector') {
+            return
+          }
+
+          if (params?.vector?.value) {
+            return
+          }
+
+          if (!params.term) {
+            throw new Error('No "term" or "vector" parameters were provided')
+          }
+
+          const mockEmbedding = new Array(5).fill(0).map((_, i) => Math.sin(i / 2 + params.term.length / 10))
+
+          if (!params.vector) {
+            params.vector = {
+              property: 'embeddings',
+              value: mockEmbedding
+            }
+          }
+        }
+      }
+    }
+
+    const db = create({
+      schema: {
+        title: 'string',
+        content: 'string',
+        embeddings: 'vector[5]'
+      },
+      plugins: [mockEmbeddingsPlugin()]
+    })
+
+    await insert(db, {
+      title: 'Test Document 1',
+      content: 'The quick brown fox jumps over the lazy dog',
+      embeddings: [0.1, 0.2, 0.3, 0.4, 0.5]
+    })
+
+    await insert(db, {
+      title: 'Test Document 2',
+      content: 'A lazy dog dreams of jumping over a quick brown fox',
+      embeddings: [0.2, 0.3, 0.4, 0.5, 0.6]
+    })
+
+    const results = await search(db, {
+      mode: 'vector',
+      term: 'quick brown fox'
+    })
+
+    t.ok(results, 'search completed successfully')
+    t.ok(results.hits, 'search results have hits')
+    t.ok(results.count >= 0, 'search results have count')
+
+    t.pass('Vector search with term parameter works without property undefined error')
+  })
+
+  t.test('should still work with explicit vector parameter', async (t) => {
+    const db = create({
+      schema: {
+        title: 'string',
+        embeddings: 'vector[5]'
+      }
+    })
+
+    await insert(db, {
+      title: 'Test Document',
+      embeddings: [0.1, 0.2, 0.3, 0.4, 0.5]
+    })
+
+    const results = await search(db, {
+      mode: 'vector',
+      vector: {
+        property: 'embeddings',
+        value: [0.1, 0.2, 0.3, 0.4, 0.5]
+      }
+    })
+
+    t.ok(results, 'explicit vector search works')
+    t.same(results.count, 1, 'found exact match')
+    t.ok(Math.abs(results.hits[0].score - 1) < 0.0001, 'perfect similarity score')
+  })
+})
```

**File**: `packages/plugin-embeddings/src/index.ts` (modified, +1/-3)
```diff
@@ -76,9 +76,7 @@ export async function pluginEmbeddings(pluginParams: PluginEmbeddingsParams): Pr
 
       if (!params.vector) {
         params.vector = {
-          // eslint-disable-next-line
-          // @ts-ignore
-          property: params?.vector?.property ?? pluginParams.embeddings.defaultProperty,
+          property: pluginParams.embeddings.defaultProperty,
           value: normalizeVector(embeddings)
         }
       }
```

---

### Incident Patch 10: `f3b85790` (2025-09-08)
**Commit Message**: fix: #834, Embeddings included in Memory index OR serialized JSON index (#977)

**File**: `packages/orama/package.json` (modified, +1/-1)
```diff
@@ -177,4 +177,4 @@
     ]
   },
   "module": "./dist/esm/index.js"
-}
\ No newline at end of file
+}
```

**File**: `packages/orama/src/methods/insert.ts` (modified, +10/-8)
```diff
@@ -54,16 +54,17 @@ async function innerInsertAsync<T extends AnyOrama>(
   }
 
   const internalId = getInternalDocumentId(orama.internalDocumentIDStore, id)
+  
+  if (!skipHooks) {
+    await runSingleHook(orama.beforeInsert, orama, id, doc as TypedDocument<T>)
+  }
+
   if (!orama.documentsStore.store(docs, id, internalId, doc)) {
     throw createError('DOCUMENT_ALREADY_EXISTS', id)
   }
 
   const docsCount = orama.documentsStore.count(docs)
 
-  if (!skipHooks) {
-    await runSingleHook(orama.beforeInsert, orama, id, doc as TypedDocument<T>)
-  }
-
   const indexableProperties = orama.index.getSearchableProperties(index)
   const indexablePropertiesWithTypes = orama.index.getSearchablePropertiesWithTypes(index)
   const indexableValues = orama.getDocumentProperties(doc, indexableProperties)
@@ -101,16 +102,17 @@ function innerInsertSync<T extends AnyOrama>(
   }
 
   const internalId = getInternalDocumentId(orama.internalDocumentIDStore, id)
+
+  if (!skipHooks) {
+    runSingleHook(orama.beforeInsert, orama, id, doc as TypedDocument<T>)
+  }
+  
   if (!orama.documentsStore.store(docs, id, internalId, doc)) {
     throw createError('DOCUMENT_ALREADY_EXISTS', id)
   }
 
   const docsCount = orama.documentsStore.count(docs)
 
-  if (!skipHooks) {
-    runSingleHook(orama.beforeInsert, orama, id, doc as TypedDocument<T>)
-  }
-
   const indexableProperties = orama.index.getSearchableProperties(index)
   const indexablePropertiesWithTypes = orama.index.getSearchablePropertiesWithTypes(index)
   const indexableValues = orama.getDocumentProperties(doc, indexableProperties)
```

**File**: `packages/orama/tests/plugin-embeddings-serialization.test.ts` (added, +180/-0)
```diff
@@ -0,0 +1,180 @@
+import t from 'tap'
+import { create, insert, save, load, search } from '../src/index.js'
+
+t.test('Plugin embeddings serialization', async (t) => {
+  t.test('should persist embeddings added by beforeInsert hook', async (t) => {
+    function mockEmbeddingsPlugin() {
+      return {
+        name: 'mock-embeddings-plugin',
+
+        async beforeInsert(_db, _id, doc) {
+          const mockEmbedding = new Array(5).fill(0).map((_, i) => Math.sin(i / 2 + doc.title.length / 10))
+
+          doc.embedding = mockEmbedding
+        }
+      }
+    }
+
+    const db = create({
+      schema: {
+        title: 'string',
+        embedding: 'vector[5]'
+      },
+      plugins: [mockEmbeddingsPlugin()]
+    })
+
+    await insert(db, {
+      title: 'Test document'
+    })
+
+    const searchResults = await search(db, {
+      term: '',
+      properties: ['title'],
+      includeVectors: true
+    })
+
+    t.ok(searchResults.count === 1, 'document inserted')
+    t.ok(searchResults.hits[0].document.embedding, 'document has embedding')
+    t.ok(Array.isArray(searchResults.hits[0].document.embedding), 'embedding is array')
+    t.ok(searchResults.hits[0].document.embedding.length === 5, 'embedding has correct size')
+
+    const serialized = save(db)
+
+    t.ok(serialized.index.vectorIndexes, 'vector indexes present in serialized data')
+    t.ok(serialized.index.vectorIndexes.embedding, 'embedding vector index present')
+    t.ok(serialized.index.vectorIndexes.embedding.vectors.length === 1, 'one vector in index')
+
+    const newDb = create({
+      schema: {
+        title: 'string',
+        embedding: 'vector[5]'
+      }
+    })
+
+    load(newDb, serialized)
+
+    const restoredResults = await search(newDb, {
+      term: '',
+      properties: ['title'],
+      includeVectors: true
+    })
+
+    t.ok(restoredResults.count === 1, 'document restored')
+    t.ok(restoredResults.hits[0].document.embedding, 'restored document has embedding')
+    t.same(
+      restoredResults.hits[0].document.embedding,
+      searchResults.hits[0].document.embedding,
+      'embedding values preserved after restoration'
+    )
+
+    const vectorSearchResults = await search(newDb, {
+      mode: 'vector',
+      vector: {
+        property: 'embedding',
+        value: searchResults.hits[0].document.embedding
+      }
+    })
+
+    t.ok(vectorSearchResults.count === 1, 'vector search works after restoration')
+    t.ok(vectorSearchResults.hits[0].score === 1, 'perfect similarity match')
+  })
+
+  t.test('should work with multiple documents and embeddings', async (t) => {
+    function mockEmbeddingsPlugin() {
+      return {
+        name: 'mock-embeddings-plugin',
+
+        async beforeInsert(_db, _id, doc) {
+          const seed = doc.title.length
+          const mockEmbedding = new Array(3).fill(0).map((_, i) => (seed + i) / 10)
+
+          doc.embedding = mockEmbedding
+        }
+      }
+    }
+
+    const db = await create({
+      schema: {
+        title: 'string',
+        embedding: 'vector[3]'
+      },
+      plugins: [mockEmbeddingsPlugin()]
+    })
+
+    await insert(db, { title: 'Doc A' })
+    await insert(db, { title: 'Doc B' })
+
+    const allDocs = await search(db, {
+      term: '',
+      properties: ['title'],
+      includeVectors: true
+    })
+
+    t.ok(allDocs.count === 2, 'both documents inserted')
+
+    const originalEmbeddings = new Map()
+    for (const hit of allDocs.hits) {
+      t.ok(hit.document.embedding, `original document "${hit.document.title}" has embedding`)
+      t.ok(hit.document.embedding.length === 3, 'embedding has correct size')
+      originalEmbeddings.set(hit.document.title, [...hit.document.embedding]) // Copy array
+    }
+
+    const serialized = save(db)
+
+    t.ok(serialized.index.vectorIndexes.embedding, 'vector index serialized')
+    t.ok(serialized.index.vectorIndexes.embedding.vectors.length === 2, 'both vectors in index')
+
+    t.ok(serialized.docs, 'documents serialized')
+    t.ok(Object.keys(serialized.docs).length > 0, 'serialized documents exist')
+
+    const newDb = create({
+      schema: {
+        title: 'string',
+        embedding: 'vector[3]'
+      }
+    })
+    load(newDb, serialized)
+
+    const restoredDocs = await search(newDb, {
+      term: '',
+      properties: ['title'],
+      includeVectors: true
+    })
+
+    t.ok(restoredDocs.count === 2, 'both documents restored')
+
+    const documentsToTest = [] as any[]
+    for (let i = 0; i < restoredDocs.hits.length; i++) {
+      const hit = restoredDocs.hits[i]
+      const originalEmbedding = originalEmbeddings.get(hit.document.title)
+
+      if (!hit.document.embedding) {
+        t.fail(`Document "${hit.document.title}" missing embedding after restoration`)
+        continue
+      }
+
+      t.ok(hit.document.embedding, `restored document "${hit.document.title}" has embedding`)
+
+      if (originalEmbedding && hit.document.embedding) {
+        t.same
```

**File**: `packages/tokenizers/package.json` (modified, +1/-1)
```diff
@@ -82,4 +82,4 @@
     "tshy": "^3.0.2",
     "tsx": "^4.19.2"
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 11: `64f0d200` (2025-09-04)
**Commit Message**: fix: #851 512MB seems to be the max supported file size for disk persistence plugin (#975)

**File**: `packages/plugin-data-persistence/src/server.ts` (modified, +164/-8)
```diff
@@ -1,8 +1,13 @@
 import type { AnyOrama } from '@orama/orama'
+import { save, create, load } from '@orama/orama'
+import { encode, decode } from '@msgpack/msgpack'
+// @ts-expect-error dpack does not expose types
+import * as dpack from 'dpack'
 import type { FileSystem, PersistenceFormat, Runtime } from './types.js'
-import { FILESYSTEM_NOT_SUPPORTED_ON_RUNTIME } from './errors.js'
+import { FILESYSTEM_NOT_SUPPORTED_ON_RUNTIME, UNSUPPORTED_FORMAT } from './errors.js'
 import { persist, restore } from './index.js'
 import { detectRuntime } from './utils.js'
+import { serializeOramaInstance } from './seqproto.js'
 
 export const DEFAULT_DB_NAME = `orama_bump_${+new Date()}`
 
@@ -26,13 +31,8 @@ export async function persistToFile<T extends AnyOrama>(
     path = await getDefaultOutputFilename(format, runtime)
   }
 
-  const serialized = await persist(db, format, runtime)
-  let toWrite: any = serialized
-  // Convert ArrayBuffer (seqproto) to Buffer/String for FS
-  if (serialized instanceof ArrayBuffer) {
-    toWrite = Buffer.from(serialized)
-  }
-  await _fs.writeFile(path, toWrite)
+  // For large datasets, use streaming approach to avoid memory issues
+  await persistToFileStreaming(db, format, path, runtime)
 
   return path
 }
@@ -55,6 +55,12 @@ export async function restoreFromFile<T extends AnyOrama>(
   }
 
   const data = await _fs.readFile(path)
+  
+  // Handle new binary format that stores data as binary instead of hex
+  if (format === 'binary' && data instanceof Buffer) {
+    return restoreFromBinaryData(data, runtime)
+  }
+  
   return restore(format, data, runtime)
 }
 
@@ -135,3 +141,153 @@ export async function getDefaultFileName(format: PersistenceFormat, runtime?: Ru
 
   return `${dbName}.${extension}`
 }
+
+// Streaming implementation to handle large datasets without memory issues
+async function persistToFileStreaming<T extends AnyOrama>(
+  db: T,
+  format: PersistenceFormat,
+  filePath: string,
+  runtime: Runtime
+): Promise<void> {
+  const dbExport = await save(db)
+  
+  switch (format) {
+    case 'json':
+      await streamJsonToFile(dbExport, filePath, runtime)
+      break
+    case 'binary':
+      await streamBinaryToFile(dbExport, filePath, runtime)
+      break
+    case 'dpack':
+      // dpack doesn't have streaming support, use regular approach
+      // but check size and warn if too large
+      const dpackSerialized = dpack.serialize(dbExport)
+      await _fs.writeFile(filePath, dpackSerialized)
+      break
+    case 'seqproto':
+      const seqprotoSerialized = serializeOramaInstance(db)
+      const buffer = Buffer.from(seqprotoSerialized)
+      await _fs.writeFile(filePath, buffer)
+      break
+    default:
+      throw new Error(UNSUPPORTED_FORMAT(format))
+  }
+}
+
+// Stream JSON to file using streaming JSON stringification
+async function streamJsonToFile(data: any, filePath: string, runtime: Runtime): Promise<void> {
+  if (runtime === 'node') {
+    const fs = await import('node:fs')
+    const { createWriteStream } = fs
+    
+    return new Promise((resolve, reject) => {
+      const stream = createWriteStream(filePath)
+      
+      // For very large objects, we need to stringify in chunks
+      // This is a simplified approach - in production you might want to use
+      // a streaming JSON library
+      try {
+        const jsonString = JSON.stringify(data)
+        stream.write(jsonString)
+        stream.end()
+        stream.on('finish', resolve)
+        stream.on('error', reject)
+      } catch (error) {
+        // If JSON.stringify fails due to size, try chunked approach
+        if (error instanceof Error && error.message.includes('string length')) {
+          streamLargeJsonToFile(data, stream, resolve, reject)
+        } else {
+          reject(error)
+        }
+      }
+    })
+  } else {
+    // For non-Node environments, fall back to regular approach
+    const jsonString = JSON.stringify(data)
+    await _fs.writeFile(filePath, jsonString)
+  }
+}
+
+// Handle extremely large JSON by breaking it into manageable chunks
+function streamLargeJsonToFile(data: any, stream: any, resolve: () => void, reject: (error: any) => void): void {
+  try {
+    stream.write('{')
+    
+    let isFirst = true
+    for (const [key, value] of Object.entries(data)) {
+      if (!isFirst) {
+        stream.write(',')
+      }
+      isFirst = false
+      
+      // Write key
+      stream.write(`"${key}":`)
+      
+      // For large values, try to stringify them separately
+      try {
+        const valueStr = JSON.stringify(value)
+        stream.write(valueStr)
+      } catch (valueError) {
+        // If individual value is too large, we need different handling
+        console.warn(`Skipping large value for key ${key}:`, valueError)
+        stream.write('null')
+      }
+    }
+    
+    stream.write('}')
+    stream.end()
+    stream.on('finish', resolve)
+    stream.on('error', reject)
+  } catch (error) {
+    reject(error)
+  }

```

---

### Incident Patch 12: `e535eac5` (2025-09-04)
**Commit Message**: fix: #843 loadRadixNode encountered type error when using @orama/plug… (#974)

**File**: `packages/orama/src/trees/radix.ts` (modified, +2/-2)
```diff
@@ -417,7 +417,7 @@ export class RadixNode {
     const node = new RadixNode(json.k, json.s, json.e)
     node.w = json.w
     node.d = new Set(json.d)
-    node.c = new Map(json?.c?.map(([key, nodeJson]: [string, any]) => [key, RadixNode.fromJSON(nodeJson)]))
+    node.c = new Map(json?.c?.map(([key, nodeJson]: [string, any]) => [key, RadixNode.fromJSON(nodeJson)]) || [])
     return node
   }
 }
@@ -434,7 +434,7 @@ export class RadixTree extends RadixNode {
     tree.e = json.e
     tree.k = json.k
     tree.d = new Set(json.d)
-    tree.c = new Map(json.c?.map(([key, nodeJson]: [string, any]) => [key, RadixNode.fromJSON(nodeJson)]))
+    tree.c = new Map(json?.c?.map(([key, nodeJson]: [string, any]) => [key, RadixNode.fromJSON(nodeJson)]) || [])
     return tree
   }
 
```

---

### Incident Patch 13: `c24cb817` (2025-09-04)
**Commit Message**: performance: improves avl tree traversal and fixes #895 (#973)

**File**: `packages/orama/src/trees/avl.ts` (modified, +12/-7)
```diff
@@ -1,7 +1,6 @@
 /* eslint-disable no-extra-semi */
 /* eslint-disable @typescript-eslint/no-this-alias */
 import { Nullable } from '../types.js'
-import { setUnion } from '../utils.js'
 
 export class AVLNode<K, V> {
   public k: K
@@ -374,7 +373,7 @@ export class AVLTree<K, V> {
   }
 
   public rangeSearch(min: K, max: K): Set<V> {
-    let result: Set<V> = new Set()
+    const result: Set<V> = new Set()
     const stack: Array<AVLNode<K, V>> = []
     let current = this.root
 
@@ -385,7 +384,9 @@ export class AVLTree<K, V> {
       }
       current = stack.pop()!
       if (current.k >= min && current.k <= max) {
-        result = setUnion(result, current.v)
+        for (const value of current.v) {
+          result.add(value)
+        }
       }
       if (current.k > max) {
         break
@@ -397,7 +398,7 @@ export class AVLTree<K, V> {
   }
 
   public greaterThan(key: K, inclusive = false): Set<V> {
-    let result: Set<V> = new Set()
+    const result: Set<V> = new Set()
     const stack: Array<AVLNode<K, V>> = []
     let current = this.root
 
@@ -408,7 +409,9 @@ export class AVLTree<K, V> {
       }
       current = stack.pop()!
       if ((inclusive && current.k >= key) || (!inclusive && current.k > key)) {
-        result = setUnion(result, current.v)
+        for (const value of current.v) {
+          result.add(value)
+        }
       } else if (current.k <= key) {
         break // Since we're traversing in descending order, we can break early
       }
@@ -419,7 +422,7 @@ export class AVLTree<K, V> {
   }
 
   public lessThan(key: K, inclusive = false): Set<V> {
-    let result: Set<V> = new Set()
+    const result: Set<V> = new Set()
     const stack: Array<AVLNode<K, V>> = []
     let current = this.root
 
@@ -430,7 +433,9 @@ export class AVLTree<K, V> {
       }
       current = stack.pop()!
       if ((inclusive && current.k <= key) || (!inclusive && current.k < key)) {
-        result = setUnion(result, current.v)
+        for (const value of current.v) {
+          result.add(value)
+        }
       } else if (current.k > key) {
         break // Since we're traversing in ascending order, we can break early
       }
```

---

### Incident Patch 14: `ed0ece5a` (2025-09-04)
**Commit Message**: fix: #860 unhandled error when using a wrong property for vector search (#971)

**File**: `packages/orama/package.json` (modified, +1/-1)
```diff
@@ -177,4 +177,4 @@
     ]
   },
   "module": "./dist/esm/index.js"
-}
\ No newline at end of file
+}
```

**File**: `packages/orama/src/errors.ts` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ const errors = {
   UNKNOWN_GROUP_BY_PROPERTY: `Unknown groupBy property "%s".`,
   INVALID_GROUP_BY_PROPERTY: `Invalid groupBy property "%s". Allowed types: "%s", but given "%s".`,
   UNKNOWN_FILTER_PROPERTY: `Unknown filter property "%s".`,
+  UNKNOWN_VECTOR_PROPERTY: `Unknown vector property "%s". Make sure the property exists in the schema and is configured as a vector.`,
   INVALID_VECTOR_SIZE: `Vector size must be a number greater than 0. Got "%s" instead.`,
   INVALID_VECTOR_VALUE: `Vector value must be a number greater than 0. Got "%s" instead.`,
   INVALID_INPUT_VECTOR: `Property "%s" was declared as a %s-dimensional vector, but got a %s-dimensional vector instead.\nInput vectors must be of the size declared in the schema, as calculating similarity between vectors of different sizes can lead to unexpected results.`,
```

**File**: `packages/orama/src/methods/search-vector.ts` (modified, +4/-0)
```diff
@@ -21,6 +21,10 @@ export function innerVectorSearch<T extends AnyOrama, ResultDocument = TypedDocu
   }
 
   const vectorIndex = orama.data.index.vectorIndexes[vector!.property]
+  if (!vectorIndex) {
+    throw createError('UNKNOWN_VECTOR_PROPERTY', vector!.property)
+  }
+  
   const vectorSize = vectorIndex.node.size
 
   if (vector?.value.length !== vectorSize) {
```

**File**: `packages/orama/tests/search-vector.test.ts` (modified, +25/-0)
```diff
@@ -173,6 +173,31 @@ t.test('search', async (t) => {
     t.same((results2.hits[1].document as any).vectors.embedding_2, [0.2, 0.2, 0.21, 0.21, 0.21, 0.21])
     t.same((results2.hits[2].document as any).vectors.embedding_2, [0.2, 0.02, 0.1, 0.1, 0.1, 0.1])
   })
+
+  t.test('should throw an error when using unknown vector property', async (t) => {
+    const db = await create({
+      schema: {
+        title: 'string',
+        embedding: 'vector[5]'
+      } as const
+    })
+
+    await insertMultiple(db, [{ title: 'foo', embedding: [1, 1, 1, 1, 1] }])
+
+    try {
+      await search(db, {
+        mode: 'vector',
+        vector: {
+          value: [1, 1, 1, 1, 1],
+          property: 'nonexistent_vector'
+        }
+      })
+      t.fail('Should have thrown an error')
+    } catch (err: any) {
+      t.ok(err.message.includes('Unknown vector property "nonexistent_vector"'), 'error message contains property name')
+      t.same(err.code, 'UNKNOWN_VECTOR_PROPERTY', 'correct error code')
+    }
+  })
 })
 
 t.test('vector search with where clause', async (t) => {
```

**File**: `packages/tokenizers/package.json` (modified, +1/-1)
```diff
@@ -82,4 +82,4 @@
     "tshy": "^3.0.2",
     "tsx": "^4.19.2"
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 15: `e13759a4` (2025-09-02)
**Commit Message**: Revert "adds tokenizers input to build"

This reverts commit 1abc0913be3f1888e38ceb4a65285e852243f927.

**File**: `packages/orama/package.json` (modified, +1/-1)
```diff
@@ -177,4 +177,4 @@
     ]
   },
   "module": "./dist/esm/index.js"
-}
+}
\ No newline at end of file
```

**File**: `packages/tokenizers/package.json` (modified, +1/-1)
```diff
@@ -82,4 +82,4 @@
     "tshy": "^3.0.2",
     "tsx": "^4.19.2"
   }
-}
+}
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #1037** (closed): chore(deps): bump ip-address from 10.2.0 to 10.4.0 (@dependabot[bot])
- **PR #1036** (closed): chore(deps-dev): bump next from 16.2.9 to 16.2.11 (@dependabot[bot])
- **PR #1034** (closed): chore(deps): bump astro from 5.18.2 to 7.1.0 (@dependabot[bot])
- **PR #1033** (2026-07-03): feat(languages): real Czech & Slovenian stemmers + language-support consistency (@thatjuan)
- **PR #1029** (2026-07-03): chore(deps): bump vite from 4.5.14 to 6.4.3 (@dependabot[bot])
- **PR #1028** (2026-07-03): fix(plugin-match-highlight): highlight every token of a multi-token word (CJK) (@mahirhir)
- **PR #1026** (2026-06-27): fix(orama): break the search circular dependency behind Metro/Expo failure (#961) (@thatjuan)
- **PR #1025** (2026-06-27): fix(plugin-nextra): move next/react to peerDependencies for Next 14-16 + React 18/19 (@thatjuan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
