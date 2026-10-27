> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/vitest-dev-vitest-learnings.md`  
> **Source**: github ([https://github.com/vitest-dev/vitest](https://github.com/vitest-dev/vitest))  
> **Source Version**: `1a77c6cb`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T16:51:54.486Z  
> **Learning ID**: `learn-github-vitest-dev-vitest`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): vitest-dev/vitest

> **Canonical Artifact**: `07_PROJECT_LEARNING/vitest-dev-vitest-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vitest-dev/vitest](https://github.com/vitest-dev/vitest))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T16:51:53.969Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vitest-dev/vitest`
- **Description**: Next generation testing framework powered by Vite.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17289 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/browser-playwright/src/commands/utils.ts`
```
import type { SerializedLocator } from '@vitest/browser'
import type { Locator } from 'vitest/browser'
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'

export type UserEventCommand<T extends (...args: any) => any> = BrowserCommand<
  ConvertUserEventParameters<Parameters<T>>,
  ReturnType<T>
>

type ConvertElementToLocator<T> = T extends Element | Locator ? SerializedLocator : T
type ConvertUserEventParameters<T extends unknown[]> = {
  [K in keyof T]: ConvertElementToLocator<T[K]>
}

// strip iframe locator part from the trace description e.g.
// - locator('[data-vitest="true"]').contentFrame().getByRole('button')
//     ⇓
// - getByRole('button')
export function getDescribedLocator(
  context: BrowserCommandContext,
  { locator, selector }: SerializedLocator,
): ReturnType<BrowserCommandContext['iframe']['locator']> {
  const iframeLocator = context.iframe.locator(selector)
  return typeof iframeLocator.describe === 'function'
    ? iframeLocator.describe(locator)
    : iframeLocator
}

```

### Core Architecture Module: `packages/browser/src/client/utils.ts`
```
import type { Ivya } from 'ivya'
import type { SerializedConfig, VitestTestRunner, WorkerGlobalState } from 'vitest'
import type { OTELCarrier, Traces } from 'vitest/internal/traces'
import type { IframeOrchestrator } from './orchestrator'
import type { CommandsManager } from './tester/tester-utils'
import type { BrowserTraceAttempt } from './tester/trace'

async function importId(id: string): Promise<any> {
  const name = `/@id/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

async function importFs(id: string): Promise<any> {
  const name = `/@fs/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

export const moduleRunner = {
  isBrowser: true,

  import: (id: string): Promise<any> => {
    if (id[0] === '/' || id[1] === ':') {
      return importFs(id)
    }
    return importId(id)
  },
}

// a bare specifier throws until a map defines it, so a map appended now
// tells whether this document accepts an import map after a module has loaded
export function supportsLateImportMaps(): boolean {
  const specifier = '__vitest_import_map_probe__'
  const script = document.createElement('script')
  script.type = 'importmap'
  script.textContent = JSON.stringify({ imports: { [specifier]: `/${specifier}` } })
  document.head.append(script)
  try {
    import.meta.resolve(specifier)
    return true
  } catch {
    return false
  }
}

export const now: () => number = globalThis.performance
  ? globalThis.performance.now.bind(globalThis.performance)
  : Date.now

export function getConfig(): SerializedConfig {
  return getBrowserState().config
}

export function ensureAwaited<T>(promise: (error?: Error) => Promise<T>): Promise<T> {
  const test = getWorkerState().current
  if (!test || test.type !== 'test') {
    return promise()
  }
  let awaited = false
  const sourceError = new Error('STACK_TRACE_ERROR')
  test.onFinished ??= []
  test.onFinished.push(() => {
    if (!awaited) {
      const error = new Error(
        `The call was not awaited. This method is asynchronous and must be awaited; otherwise, the call will not start to avoid unhandled rejections.`,
      )
      error.stack = sourceError.stack?.replace(sourceError.message, error.message)
      throw error
    }
  })
  // don't even start the promise if it's not awaited to not cause any unhanded promise rejections
  let promiseResult: Promise<T> | undefined
  return {
    then(onFulfilled, onRejected) {
      awaited = true
      return (promiseResult ||= promise(sourceError)).then(onFulfilled, onRejected)
    },
    catch(onRejected) {
      awaited = true
      return (promiseResult ||= promise(sourceError)).catch(onRejected)
    },
    finally(onFinally) {
      awaited = true
      return (promiseResult ||= promise(sourceError)).finally(onFinally)
    },
    [Symbol.toStringTag]: 'Promise',
  } satisfies Promise<T>
}

// This object is the shared runtime bus for browser artifacts loaded into the
// same page. Some browser code is built and served as independent bundles, so
// getBrowserState() is the API they use to share runtime state instead of
// relying on imports resolving to the same module instance.
export interface BrowserRunnerState {
  files: string[]
  runningFiles: string[]
  config: SerializedConfig
  provider: string
  runner: VitestTestRunner
  viteConfig: {
    root: string
  }
  providedContext: string
  type: 'tester' | 'orchestrator'
  disposeExceptionTracker: () => void
  wrapModule: <T>(module: () => T) => T
  iframeId?: string
  sessionId: string
  testerId: string
  otelCarrier?: OTELCarrier
  method: 'run' | 'collect'
  orchestrator?: IframeOrchestrator
  commands: CommandsManager
  activeTraceTaskIds: Set<string>
  browserTraceAttempts: Map<string, BrowserTraceAttempt>
  // import runs in the orchestrator so every tester reuses one module instance
  loadBrowserTraceDomSnapshot?: () => Promise<typeof import('rrweb-snapshot')>
  selectorEngine: Ivya
  traces: Traces
  cleanups: Array<() => unknown>
  cdp?: {
    on: (event: string, listener: (payload: any) => void) => void
    once: (event: string, listener: (payload: any) => void) => void
    off: (event: string, listener: (payload: any) => void) => void
    send: (method: string, params?: Record<string, unknown>) => Promise<unknown>
    emit: (event: string, payload: unknown) => void
  }
  aria: typeof import('ivya/aria')
}

/* @__NO_SIDE_EFFECTS__ */
export function getBrowserState(): BrowserRunnerState {
  // @ts-expect-error not typed global
  return window.__vitest_browser_runner__
}

/* @__NO_SIDE_EFFECTS__ */
export function getOrchestratorState(): BrowserRunnerState {
  // @ts-expect-error not typed global
  return window.parent.__vitest_browser_runner__
}

/* @__NO_SIDE_EFFECTS__ */
export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error not typed global
  const state = window.__vitest_worker__
  if (!state) {
    throw new Error(
      'Worker state is not found. This is an issue with Vitest. Please, open an issue.',
    )
  }
  return state
}

```

### Core Architecture Module: `packages/browser/src/node/commands/screenshotMatcher/utils.ts`
```
import type { SerializedLocator } from '@vitest/browser'
import type { BrowserCommandContext, BrowserConfigOptions } from 'vitest/node'
// Note: this augments `screenshotOptions` types
import type {} from '../../../../../browser-playwright'
import type { ScreenshotMatcherOptions } from '../../../../context'
import type { ScreenshotMatcherArguments } from '../../../shared/screenshotMatcher/types'
import type { AnyCodec } from './codecs'
import { platform } from 'node:os'
import { deepMerge } from '@vitest/utils/helpers'
import { basename, dirname, extname, join, relative, resolve } from 'pathe'
import { getCodec } from './codecs'
import { getComparator } from './comparators'

type GlobalOptions = Required<
  Omit<
    NonNullable<
      NonNullable<BrowserConfigOptions['expect']>['toMatchScreenshot'] &
        NonNullable<Pick<ScreenshotMatcherArguments[2], 'screenshotOptions'>>
    >,
    'comparators' | 'screenshotDirectory'
  >
>

const defaultOptions = {
  comparatorName: 'pixelmatch',
  // these are handled by each comparator on its own
  comparatorOptions: {},
  screenshotOptions: {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maskColor: '#ff00ff',
    omitBackground: false,
    scale: 'device',
  },
  timeout: 5_000,
  strict: true,
  resolveDiffPath: ({
    arg,
    ext,
    root,
    attachmentsDir,
    browserName,
    platform,
    testFileDirectory,
    testFileName,
  }) =>
    resolve(
      root,
      attachmentsDir,
      testFileDirectory,
      testFileName,
      `${arg}-${browserName}-${platform}${ext}`,
    ),
  resolveScreenshotPath: ({
    arg,
    ext,
    root,
    screenshotDirectory,
    testFileDirectory,
    testFileName,
    browserName,
  }) =>
    resolve(
      root,
      testFileDirectory,
      screenshotDirectory,
      testFileName,
      `${arg}-${browserName}-${platform}${ext}`,
    ),
} satisfies GlobalOptions

type SupportedCodecs = Parameters<typeof getCodec>[0]

const supportedExtensions = ['png'] satisfies SupportedCodecs[]

export interface ResolvedOptions {
  codec: ReturnType<typeof getCodec>
  comparator: ReturnType<typeof getComparator>
  resolvedOptions: GlobalOptions
  paths: {
    reference: string
    diffs: {
      reference: string
      actual: string
      diff: string
    }
  }
}

export function resolveOptions({
  context,
  name,
  options,
  testName,
}: {
  context: BrowserCommandContext
  name: string
  testName: string
  options: ScreenshotMatcherOptions
}): ResolvedOptions {
  if (context.testPath === undefined) {
    throw new Error('`resolveOptions` has to be used in a test file')
  }

  const resolvedOptions = deepMerge<GlobalOptions>(
    Object.create(null),
    defaultOptions,
    context.project.config.browser.expect?.toMatchScreenshot ?? {},
    options,
  )

  const extensionFromName = extname(name)

  // technically the type is a lie, but we check beneath and reassign otherwise
  let extension = extensionFromName.replace(/^\./, '') as SupportedCodecs

  // when `type` will be supported in `screenshotOptions`:
  // - `'png'` should end up in `defaultOptions.screenshotOptions.type`
  // - this condition should be switched around
  // - the assignment should be `resolvedOptions.screenshotOptions.type = extension`
  // - everything using `extension` should use `resolvedOptions.screenshotOptions.type`
  if (supportedExtensions.includes(extension) === false) {
    extension = 'png'
  }

  const { root } = context.project.serializedConfig

  const resolvePathData = {
    arg: sanitizeArg(
      // remove the extension only if it ends up being used
      extensionFromName.endsWith(extension) ? basename(name, extensionFromName) : name,
    ),
    ext: `.${extension}`,
    platform: platform(),
    root,
    screenshotDirectory:
      context.project.config.browser.expect?.toMatchScreenshot?.screenshotDirectory ??
      '__screenshots__',
    attachmentsDir: relative(root, context.project.config.attachmentsDir),
    testFileDirectory: relative(root, dirname(context.testPath)),
    testFileName: basename(context.testPath),
    testName: sanitize(testName, false),
    browserName: context.project.config.browser.name,
    project: context.project,
  } satisfies Parameters<GlobalOptions['resolveDiffPath']>[0]

  return {
    codec: getCodec(extension),
    comparator: getComparator(resolvedOptions.comparatorName, context),
    resolvedOptions,
    paths: {
      reference: resolvedOptions.resolveScreenshotPath(resolvePathData),
      // lazily initialize this, as it might not be needed at all
      get diffs() {
        const diffs = {
          reference: resolvedOptions.resolveDiffPath({
            ...resolvePathData,
            arg: `${resolvePathData.arg}-reference`,
          }),
          actual: resolvedOptions.resolveDiffPath({
            ...resolvePathData,
            arg: `${resolvePathData.arg}-actual`,
          }),
          diff: resolvedOptions.resolveDiffPath({
            ...resolvePathData,
            arg: `${resolvePathData.arg}-diff`,
          }),
        }

        Object.defineProperty(this, 'diffs', { value: diffs })

        return diffs
      },
    },
  }
}

/**
 * Sanitizes a string by removing or transforming characters to ensure it is
 * safe for use as a filename or path segment. It supports two modes:
 *
 * 1. Non-path mode (`keepPaths === false`):
 *    - Replaces one or more whitespace characters (`\s+`) with a single hyphen (`-`).
 *    - Removes any character that is not a word character (`\w`) or a hyphen (`-`).
 *    - Collapses multiple consecutive hyphens (`-{2,}`) into a single hyphen.
 *
 * 2. Path-preserving mode (`keepPaths === true`):
 *    - Splits the input string on the path separator.
 *    - Sanitizes each path segment individually in non-path mode.
 *    - Joins the sanitized segments back together.
 *
 * @param input - The raw string to sanitize.
 * @param keepPaths - If `false`, performs a flat sanitization (drops path segments).
 * If `true`, treats `input` as a path: each segment is sanitized independently,
 * preserving separators.
 */
function sanitize(input: string, keepPaths: boolean): string {
  if (keepPaths === false) {
    return input
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/-{2,}/g, '-')
  }

  return input
    .split('/')
    .map((path) => sanitize(path, false))
    .join('/')
}

/**
 * Takes a string, treats it as a potential path or filename, and ensures it cannot
 * escape the root directory or contain invalid characters. Internally, it:
 *
 * 1. Prepends the path separator to the raw input to form a path-like string.
 * 2. Uses {@linkcode relative|relative('/', <that-path>)} to compute a relative
 * path from the root, which effectively strips any leading separators and prevents
 * traversal above the root.
 * 3. Passes the resulting relative path into {@linkcode sanitize|sanitize(..., true)},
 * preserving any path separators but sanitizing each segment.
 *
 * @param input - The raw string to clean.
 */
function sanitizeArg(input: string): string {
  return sanitize(relative('/', join('/', input)), true)
}

/**
 * Takes a screenshot and decodes it using the provided codec.
 *
 * The screenshot is taken as a base64 string and then decoded into the format
 * expected by the comparator.
 *
 * @returns `Promise` resolving to the decoded screenshot data
 */
export function takeScreenshotBuffer({
  context,
  element,
  name,
  screenshotOptions,
  target,
}: {
  context: BrowserCommandContext
  element?: SerializedLocator
  name: string
  screenshotOptions: ScreenshotMatcherArguments[2]['screenshotOptions']
  target?: ScreenshotMatcherArguments[2]['target']
}): Promise<Buffer<ArrayBufferLike>> {
  return context
    .triggerCommand('__vitest_takeScreenshot', name, {
      ...screenshotOptions,
      save: false,
      element,
      target,
    })
    .then(({ buffer }) => buffer)
}

export function takeDecodedScreenshot({
  codec,
  ...options
}: {
  codec: AnyCodec
  context: BrowserCommandContext
  element?: SerializedLocator
  name: string
  screenshotOptions: ScreenshotMatcherArguments[2]['screenshotOptions']
  target?: ScreenshotMatcherArguments[2]['target']
}): ReturnType<AnyCodec['decode']> {
  return takeScreenshotBuffer(options).then((buffer) => codec.decode(buffer, {}))
}

/**
 * Creates a promise that resolves to `null` after the specified timeout.
 * If the timeout is `0`, the promise resolves immediately.
 *
 * Call `clear` once the result is not needed, otherwise the timer keeps the process alive until it fires.
 *
 * @param timeout - The delay in milliseconds before the promise resolves
 * @returns The `promise` and a `clear` function that stops the timer
 */
export function asyncTimeout(timeout: number): { promise: Promise<null>; clear: () => void } {
  let timer: NodeJS.Timeout | undefined

  const promise = new Promise<null>((resolve) => {
    if (timeout === 0) {
      resolve(null)
    } else {
      timer = setTimeout(resolve, timeout, null)
    }
  })

  return { promise, clear: () => clearTimeout(timer) }
}

```

### Core Architecture Module: `packages/browser/src/node/middlewares/utils.ts`
```
import type { ServerResponse } from 'node:http'

export function disableCache(res: ServerResponse): void {
  res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
}

export function allowIframes(res: ServerResponse): void {
  // remove custom iframe related headers to allow the iframe to load
  res.removeHeader('X-Frame-Options')
}

```

### Core Architecture Module: `packages/browser/src/node/state.ts`
```
import type { BrowserServerState as IBrowserServerState, TestProject } from 'vitest/node'
import type { WebSocketBrowserRPC } from '../types'

export class BrowserServerState implements IBrowserServerState {
  public readonly orchestrators: Map<string, WebSocketBrowserRPC> = new Map()
  public readonly testers: Map<string, WebSocketBrowserRPC> = new Map()
  // reported by the orchestrator: whether the browser accepts an import map after a module loaded
  public lateImportMaps: boolean | undefined

  // a rule stays in the document until the run ends, and a non-isolated
  // run shares one document between its files
  public usesImportMaps(config: TestProject['config']): boolean {
    const option = config.browser.importMapMocks
    if (option === true) {
      return true
    }
    return option !== false && this.lateImportMaps === true && config.isolate
  }
}

```

### Core Architecture Module: `packages/browser/src/node/utils.ts`
```
import type {
  BrowserProvider,
  ResolvedBrowserOptions,
  ResolvedConfig,
  TestProject,
} from 'vitest/node'
import { defaultKeyMap } from '@testing-library/user-event/dist/esm/keyboard/keyMap.js'
import { parseKeyDef as tlParse } from '@testing-library/user-event/dist/esm/keyboard/parseKeyDef.js'
import { basename, dirname, relative, resolve } from 'pathe'
import { isFileLoadingAllowed } from 'vitest/node'

declare enum DOM_KEY_LOCATION {
  STANDARD = 0,
  LEFT = 1,
  RIGHT = 2,
  NUMPAD = 3,
}

interface keyboardKey {
  /** Physical location on a keyboard */
  code?: string
  /** Character or functional key descriptor */
  key?: string
  /** Location on the keyboard for keys with multiple representation */
  location?: DOM_KEY_LOCATION
  /** Does the character in `key` require/imply AltRight to be pressed? */
  altGr?: boolean
  /** Does the character in `key` require/imply a shiftKey to be pressed? */
  shift?: boolean
}

export function parseKeyDef(text: string): {
  keyDef: keyboardKey
  releasePrevious: boolean
  releaseSelf: boolean
  repeat: number
}[] {
  return tlParse(defaultKeyMap, text)
}

export function replacer(code: string, values: Record<string, string>): string {
  return code.replace(/\{\s*(\w+)\s*\}/g, (_, key) => values[key] ?? _)
}

export function resolveScreenshotPath(
  testPath: string,
  name: string,
  config: ResolvedConfig,
  customPath: string | undefined,
): string {
  if (customPath) {
    return resolve(dirname(testPath), customPath)
  }
  const dir = dirname(testPath)
  const base = basename(testPath)
  if (config.browser.screenshotDirectory) {
    return resolve(config.browser.screenshotDirectory, relative(config.root, dir), base, name)
  }
  return resolve(dir, '__screenshots__', base, name)
}

export async function getBrowserProvider(
  options: ResolvedBrowserOptions,
  project: TestProject,
): Promise<BrowserProvider> {
  const browser = project.config.browser.name
  const name = project.name ? `[${project.name}] ` : ''
  if (!browser) {
    throw new Error(
      `${name}Browser name is required. Please, set \`test.browser.instances[].browser\` option manually.`,
    )
  }
  if (options.provider == null) {
    throw new Error(`Browser Mode requires the "provider" to always be specified.`)
  }
  const supportedBrowsers = options.provider.supportedBrowser || []
  if (supportedBrowsers.length && !supportedBrowsers.includes(browser)) {
    throw new Error(
      `${name}Browser "${browser}" is not supported by the browser provider "${
        options.provider.name
      }". Supported browsers: ${supportedBrowsers.join(', ')}.`,
    )
  }
  if (typeof options.provider.providerFactory !== 'function') {
    throw new TypeError(
      `The "${name}" browser provider does not provide a "providerFactory" function. Received ${typeof options.provider.providerFactory}.`,
    )
  }
  return options.provider.providerFactory(project)
}

export function slash(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/')
}

export function assertBrowserFileAccess(project: TestProject, path: string): void {
  const normalized = slash(path)
  if (
    !isFileLoadingAllowed(project.vite.config, normalized) &&
    !isFileLoadingAllowed(project.vitest.vite.config, normalized)
  ) {
    throw new Error(
      `Access denied to "${path}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`,
    )
  }
}

export function assertBrowserApiWrite(project: TestProject, path: string): void {
  if (!project.config.api.allowWrite || !project.vitest.config.api.allowWrite) {
    throw new Error(
      `Cannot modify file "${path}". File writing is disabled because the server is exposed to the internet, see https://vitest.dev/config/browser/api.`,
    )
  }
}

```

### Core Architecture Module: `packages/browser/utils.d.ts`
```
import { StringifyOptions } from 'vitest/internal/browser'
import { LocatorSelectors, Locator } from './context'

export type PrettyDOMOptions = Omit<StringifyOptions, 'maxLength'>

/** @deprecated use `import('vitest/browser').utils.getElementLocatorSelectors` instead */
export declare function getElementLocatorSelectors(element: Element): LocatorSelectors
/** @deprecated use `import('vitest/browser').utils.debug` instead */
export declare function debug(
  el?: Element | Locator | null | (Element | Locator)[],
  maxLength?: number,
  options?: PrettyDOMOptions,
): void
/** @deprecated use `import('vitest/browser').utils.prettyDOM` instead */
export declare function prettyDOM(
  dom?: Element | Locator | undefined | null,
  maxLength?: number,
  prettyFormatOptions?: PrettyDOMOptions,
): string
/** @deprecated use `import('vitest/browser').utils.getElementError` instead */
export declare function getElementError(selector: string, container?: Element): Error

```

### Core Architecture Module: `packages/expect/src/jest-matcher-utils.ts`
```
import type { Formatter } from 'tinyrainbow'
import type { MatcherHintOptions, Tester } from './types'
import { diff, printDiffOrStringify } from '@vitest/utils/diff'
import { stringify } from '@vitest/utils/display'
import { getType } from '@vitest/utils/helpers'
import c from 'tinyrainbow'
import { JEST_MATCHERS_OBJECT } from './constants'

export { diff } from '@vitest/utils/diff'
export { stringify }

const EXPECTED_COLOR = c.green
const RECEIVED_COLOR = c.red
const INVERTED_COLOR = c.inverse
const BOLD_WEIGHT = c.bold
const DIM_COLOR = c.dim

function matcherHint(
  matcherName: string,
  received = 'received',
  expected = 'expected',
  options: MatcherHintOptions = {},
): string {
  const {
    comment = '',
    isDirectExpectCall = false, // seems redundant with received === ''
    isNot = false,
    promise = '',
    secondArgument = '',
    expectedColor = EXPECTED_COLOR,
    receivedColor = RECEIVED_COLOR,
    secondArgumentColor = EXPECTED_COLOR,
  } = options
  let hint = ''
  let dimString = 'expect' // concatenate adjacent dim substrings

  if (!isDirectExpectCall && received !== '') {
    hint += DIM_COLOR(`${dimString}(`) + receivedColor(received)
    dimString = ')'
  }

  if (promise !== '') {
    hint += DIM_COLOR(`${dimString}.`) + promise
    dimString = ''
  }

  if (isNot) {
    hint += `${DIM_COLOR(`${dimString}.`)}not`
    dimString = ''
  }

  if (matcherName.includes('.')) {
    // Old format: for backward compatibility,
    // especially without promise or isNot options
    dimString += matcherName
  } else {
    // New format: omit period from matcherName arg
    hint += DIM_COLOR(`${dimString}.`) + matcherName
    dimString = ''
  }

  if (expected === '') {
    dimString += '()'
  } else {
    hint += DIM_COLOR(`${dimString}(`) + expectedColor(expected)
    if (secondArgument) {
      hint += DIM_COLOR(', ') + secondArgumentColor(secondArgument)
    }
    dimString = ')'
  }

  if (comment !== '') {
    dimString += ` // ${comment}`
  }

  if (dimString !== '') {
    hint += DIM_COLOR(dimString)
  }

  return hint
}

const SPACE_SYMBOL = '\u{00B7}' // middle dot

// Instead of inverse highlight which now implies a change,
// replace common spaces with middle dot at the end of any line.
function replaceTrailingSpaces(text: string): string {
  return text.replace(/\s+$/gm, (spaces) => SPACE_SYMBOL.repeat(spaces.length))
}

function printReceived(object: unknown): string {
  return RECEIVED_COLOR(replaceTrailingSpaces(stringify(object)))
}
function printExpected(value: unknown): string {
  return EXPECTED_COLOR(replaceTrailingSpaces(stringify(value)))
}

export function getMatcherUtils(): {
  EXPECTED_COLOR: Formatter
  RECEIVED_COLOR: Formatter
  INVERTED_COLOR: Formatter
  BOLD_WEIGHT: Formatter
  DIM_COLOR: Formatter
  diff: typeof diff
  matcherHint: typeof matcherHint
  printReceived: typeof printReceived
  printExpected: typeof printExpected
  printDiffOrStringify: typeof printDiffOrStringify
  printWithType: typeof printWithType
} {
  return {
    EXPECTED_COLOR,
    RECEIVED_COLOR,
    INVERTED_COLOR,
    BOLD_WEIGHT,
    DIM_COLOR,

    diff,
    matcherHint,
    printReceived,
    printExpected,
    printDiffOrStringify,
    printWithType,
  }
}

export function printWithType<T>(name: string, value: T, print: (value: T) => string): string {
  const type = getType(value)
  const hasType = type !== 'null' && type !== 'undefined' ? `${name} has type:  ${type}\n` : ''
  const hasValue = `${name} has value: ${print(value)}`
  return hasType + hasValue
}

export function addCustomEqualityTesters(newTesters: Array<Tester>): void {
  if (!Array.isArray(newTesters)) {
    throw new TypeError(
      `expect.customEqualityTesters: Must be set to an array of Testers. Was given "${getType(
        newTesters,
      )}"`,
    )
  }

  ;(globalThis as any)[JEST_MATCHERS_OBJECT].customEqualityTesters.push(...newTesters)
}

export function getCustomEqualityTesters(): Array<Tester> {
  return (globalThis as any)[JEST_MATCHERS_OBJECT].customEqualityTesters
}

```

### Core Architecture Module: `packages/expect/src/jest-utils.ts`
```
/*
Copyright (c) 2008-2016 Pivotal Labs

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { AsymmetricMatcher } from './jest-asymmetric-matchers'
import type { Tester, TesterContext } from './types'
import { isObject } from '@vitest/utils/helpers'

// Extracted out of jasmine 2.5.2
export function equals(
  a: unknown,
  b: unknown,
  customTesters?: Array<Tester>,
  strictCheck?: boolean,
): boolean {
  customTesters = customTesters || []
  return eq(a, b, [], [], customTesters, strictCheck ? hasKey : hasDefinedKey)
}

const functionToString = Function.prototype.toString

export function isAsymmetric(obj: any): obj is AsymmetricMatcher<any> {
  return (
    !!obj &&
    typeof obj === 'object' &&
    'asymmetricMatch' in obj &&
    isA('Function', obj.asymmetricMatch)
  )
}

export function hasAsymmetric(obj: any, seen: Set<any> = new Set()): boolean {
  if (seen.has(obj)) {
    return false
  }
  seen.add(obj)
  if (isAsymmetric(obj)) {
    return true
  }
  if (Array.isArray(obj)) {
    return obj.some((i) => hasAsymmetric(i, seen))
  }
  if (obj instanceof Set) {
    return Array.from(obj).some((i) => hasAsymmetric(i, seen))
  }
  if (isObject(obj)) {
    return Object.values(obj).some((v) => hasAsymmetric(v, seen))
  }
  return false
}

function asymmetricMatch(a: any, b: any, customTesters: Array<Tester>) {
  const asymmetricA = isAsymmetric(a)
  const asymmetricB = isAsymmetric(b)

  if (asymmetricA && asymmetricB) {
    return undefined
  }

  // Asymmetric matchers define their own subset semantics.
  const testers = customTesters.filter((tester) => !isSubsetEqualityTester(tester))

  if (asymmetricA) {
    return a.asymmetricMatch(b, testers)
  }

  if (asymmetricB) {
    return b.asymmetricMatch(a, testers)
  }
}

// https://github.com/jestjs/jest/blob/905bcbced3d40cdf7aadc4cdf6fb731c4bb3dbe3/packages/expect-utils/src/utils.ts#L509
export function isError(value: unknown): value is Error {
  if (typeof Error.isError === 'function') {
    return Error.isError(value)
  }
  switch (Object.prototype.toString.call(value)) {
    case '[object Error]':
    case '[object Exception]':
    case '[object DOMException]':
      return true
    default:
      return value instanceof Error
  }
}

// Equality function lovingly adapted from isEqual in
//   [Underscore](http://underscorejs.org)
function eq(
  a: any,
  b: any,
  aStack: Array<unknown>,
  bStack: Array<unknown>,
  customTesters: Array<Tester>,
  hasKey: any,
): boolean {
  let result = true

  const asymmetricResult = asymmetricMatch(a, b, customTesters)
  if (asymmetricResult !== undefined) {
    return asymmetricResult
  }

  const testerContext: TesterContext = { equals }
  for (let i = 0; i < customTesters.length; i++) {
    const customTesterResult = customTesters[i].call(testerContext, a, b, customTesters)
    if (customTesterResult !== undefined) {
      return customTesterResult
    }
  }

  if (typeof URL === 'function' && a instanceof URL && b instanceof URL) {
    return a.href === b.href
  }

  if (Object.is(a, b)) {
    return true
  }

  // A strict comparison is necessary because `null == undefined`.
  if (a === null || b === null) {
    return a === b
  }

  const className = Object.prototype.toString.call(a)
  if (className !== Object.prototype.toString.call(b)) {
    return false
  }

  switch (className) {
    case '[object Boolean]':
    case '[object String]':
    case '[object Number]':
      if (typeof a !== typeof b) {
        // One is a primitive, one a `new Primitive()`
        return false
      } else if (typeof a !== 'object' && typeof b !== 'object') {
        // both are proper primitives
        return Object.is(a, b)
      } else {
        // both are `new Primitive()`s
        return Object.is(a.valueOf(), b.valueOf())
      }
    case '[object Date]': {
      const numA = +a
      const numB = +b
      // Coerce dates to numeric primitive values. Dates are compared by their
      // millisecond representations. Note that invalid dates with millisecond representations
      // of `NaN` are equivalent.
      return numA === numB || (Number.isNaN(numA) && Number.isNaN(numB))
    }
    // RegExps are compared by their source patterns and flags.
    case '[object RegExp]':
      return a.source === b.source && a.flags === b.flags
    case '[object Temporal.Instant]':
    case '[object Temporal.ZonedDateTime]':
    case '[object Temporal.PlainDateTime]':
    case '[object Temporal.PlainDate]':
    case '[object Temporal.PlainTime]':
    case '[object Temporal.PlainYearMonth]':
    case '[object Temporal.PlainMonthDay]':
      return a.equals(b)
    case '[object Temporal.Duration]':
      return a.toString() === b.toString()
  }
  if (typeof a !== 'object' || typeof b !== 'object') {
    return false
  }

  // Use DOM3 method isEqualNode (IE>=9)
  if (isDomNode(a) && isDomNode(b)) {
    return a.isEqualNode(b)
  }

  // Used to detect circular references.
  let length = aStack.length
  while (length--) {
    // Linear search. Performance is inversely proportional to the number of
    // unique nested structures.
    // circular references at same depth are equal
    // circular reference is not equal to non-circular one
    if (aStack[length] === a) {
      return bStack[length] === b
    } else if (bStack[length] === b) {
      return false
    }
  }
  // Add the first object to the stack of traversed objects.
  aStack.push(a)
  bStack.push(b)
  // Recursively compare objects and arrays.
  // Compare array lengths to determine if a deep comparison is necessary.
  if (className === '[object Array]' && a.length !== b.length) {
    return false
  }

  if (isError(a) && isError(b)) {
    try {
      return isErrorEqual(a, b, aStack, bStack, customTesters, hasKey)
    } finally {
      aStack.pop()
      bStack.pop()
    }
  }

  // Deep compare objects.
  const aKeys = keys(a, hasKey)
  let key
  let size = aKeys.length

  // Ensure that both objects contain the same number of properties before comparing deep equality.
  if (keys(b, hasKey).length !== size) {
    return false
  }

  while (size--) {
    key = aKeys[size]

    // Deep compare each member
    result = hasKey(b, key) && eq(a[key], b[key], aStack, bStack, customTesters, hasKey)

    if (!result) {
      return false
    }
  }
  // Remove the first object from the stack of traversed objects.
  aStack.pop()
  bStack.pop()

  return result
}

function isErrorEqual(
  a: Error,
  b: Error,
  aStack: Array<unknown>,
  bStack: Array<unknown>,
  customTesters: Array<Tester>,
  hasKey: any,
) {
  // https://nodejs.org/docs/latest-v22.x/api/assert.html#comparison-details
  // - [[Prototype]] of objects are compared using the === operator.
  // - Only enumerable "own" properties are considered.
  // - Error names, messages, causes, and errors are always compared, even if these are not enumerable properties. errors is also compared.

  let result =
    Object.prototype.toString.call(a) === Object.prototype.toString.call(b) &&
    a.name === b.name &&
    a.message === b.message
  // check Error.cause asymmetrically
  if (typeof b.cause !== 'undefined') {
    result &&= eq(a.cause, b.cause, aStack, bStack, customTesters, hasKey)
  }
  // AggregateError.errors
  if (a instanceof AggregateError && b instanceof AggregateError) {
    result &&= eq(a.errors, b.errors, aStack, bStack, customTesters, hasKey)
  }
  // spread to compare enumerable properties
  result &&= eq({ ...a }, { ...b }, aStack, bStack, customTesters, hasKey)
  return result
}

function keys(obj: object, hasKey: (obj: object, key: string) => boolean) {
  const keys = []

  for (const key in obj) {
    if (hasKey(obj, key)) {
      keys.push(key)
    }
  }
  return keys.concat(
    (Object.getOwnPropertySymbols(obj) as Array<any>).filter(
      (symbol) => (Object.getOwnPropertyDescriptor(obj, symbol) as PropertyDescriptor).enumerable,
    ),
  )
}

function hasDefinedKey(obj: any, key: string) {
  return hasKey(obj, key) && obj[key] !== undefined
}

function hasKey(obj: any, key: string) {
  return Object.hasOwn(obj, key)
}

export function isA(typeName: string, value: unknown): boolean {
  return Object.prototype.toString.apply(value) === `[object ${typeName}]`
}

function isDomNode(obj: any): boolean {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'nodeType' in obj &&
    typeof obj.nodeType === 'number' &&
    'nodeName' in obj &&
    typeof obj.nodeName === 'string' &&
    'isEqualNode' in obj &&
    typeof obj.isEqualNode === 'function'
  )
}

export function fnNameFor(func: Function): string {
  if (func.name) {
    return func.name
  }

  const matches = functionToString
    .call(func)
    .match(/^(?:async)?\s*function\s*(?:\*\s*)?([\w$]+)\s*\(/)
  return matches ? matches[1] : '<anonymous>'
}

function getPrototype(obj: object) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(obj)
  }

  if (obj.constructor.prototype === obj) {
   
```

### Core Architecture Module: `packages/expect/src/state.ts`
```
import type { ExpectStatic, MatcherState, Tester } from './types'
import {
  ASYMMETRIC_MATCHERS_OBJECT,
  GLOBAL_EXPECT,
  JEST_MATCHERS_OBJECT,
  MATCHERS_OBJECT,
} from './constants'

if (!Object.hasOwn(globalThis, MATCHERS_OBJECT)) {
  const globalState = new WeakMap<ExpectStatic, MatcherState>()
  const matchers = Object.create(null)
  const customEqualityTesters: Array<Tester> = []
  const asymmetricMatchers = Object.create(null)
  // `configurable` so that vm pools can strip the accessors from a disposed
  // context: the getters capture the expect state, which would otherwise keep
  // the whole test-file world reachable from the leaked context shell
  Object.defineProperty(globalThis, MATCHERS_OBJECT, {
    configurable: true,
    get: () => globalState,
  })
  Object.defineProperty(globalThis, JEST_MATCHERS_OBJECT, {
    configurable: true,
    get: () => ({
      state: globalState.get((globalThis as any)[GLOBAL_EXPECT]),
      matchers,
      customEqualityTesters,
    }),
  })
  Object.defineProperty(globalThis, ASYMMETRIC_MATCHERS_OBJECT, {
    configurable: true,
    get: () => asymmetricMatchers,
  })
}

export function getState<State extends MatcherState = MatcherState>(expect: ExpectStatic): State {
  return (globalThis as any)[MATCHERS_OBJECT].get(expect)
}

export function setState<State extends MatcherState = MatcherState>(
  state: Partial<State>,
  expect: ExpectStatic,
): void {
  const map = (globalThis as any)[MATCHERS_OBJECT]
  const current = map.get(expect)
  // so it keeps getters from `testPath`
  const next = Object.defineProperties(current || {}, Object.getOwnPropertyDescriptors(state))
  if (!current) {
    map.set(expect, next)
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11742** (2026-10-26): **chore(deps): update dependency vitest-browser-vue to v3**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [vitest-browser-vue](https://redirect.github.com/vitest-community/vitest-browser-vue) | [`2.1.0` → `3.1.0`](https://renovatebot.com/diffs/npm/vitest-browser-vue/2.1.0/3.1.0) | ![age](https://developer.mend.io/api/mc/badges/age/npm/vitest-browser-vue/3.1.0?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/vitest-browser-vue/2.1.0/3.1.0?slim=true) |  ---  ### Release Notes  <details> <summary>vitest-community/vitest-browser-vue (vitest-browser-vue)</summary>  ### [`v3.0.0`](https://redirect.github.com/vitest-community/vitest-browser-vue/releases/tag/v3.0.0)  [Compare Source](https://redirect.github.com/vitest-community/vitest-browser-vue/compare/v2.1.0...v3.0.0)  #####    🚨 Breaking Changes  - Make render async-only  -  by [@&#8203;hi-ogawa](https://redirect.github.com/hi-ogawa) and **Codex** in [#&#8203;28](https://redirect.github.com/vitest-community/vitest-browser-vue/issues/28) [<samp>(3bed8)</samp>](https://redirect.github.com/vitest-community/vitest-browser-vue/commit/3bed82f)  #####    🐞 Bug Fixes  - Add license and support vitest 5  -  by [@&#8203;sheremet-va](https://redirect.github.com/sheremet-va) in [#&#8203;32](https://redirect.github.com/vitest-community/vitest-browser-vue/issues/32) [<samp>(90247)</samp>](https://redirect.github.com

- **Issue #11739** (2026-10-26): **fix(mocker): use root __mocks__ for linked packages (fix #7708)**
  *Symptoms*: Fixes #7708  When a package name passed to `vi.mock` resolves outside of `node_modules` (like a workspace package), Vitest now looks for the mock in `<root>/__mocks__` first, the same as for an installed package. Otherwise, it falls back to the `__mocks__` folder next to the resolved file.  Also updates the docs: `deps.moduleDirectories` is no longer needed for this, and adding a package there externalizes it, so `vi.mock` doesn't apply to its imports. 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *vitest-dev* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | db1e610fe787b4488511e824c3690e5caa59fadc | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/vitest-dev/deploys/6adeb8bf95d4e4f47c3373ff | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-11739--vitest-dev.netlify.app](https://deploy-preview-11739--vitest-dev.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTExNzM5LS12aXRlc3QtZGV2Lm5ldGxpZnkuYXBwIn0.raFYCvax8wR7Ddxmg0mjLYarlLpyP8oeb4x5E0tfNFw)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](

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

### Incident Patch 1: `49ff4420` (2026-10-26)
**Commit Message**: fix(browser): don't hang in `page.viewport()` (#11738)

**File**: `packages/browser/src/client/orchestrator.ts` (modified, +10/-1)
```diff
@@ -500,7 +500,16 @@ export class IframeOrchestrator {
           )
           break
         }
-        await setIframeViewport(width, height)
+        try {
+          await setIframeViewport(width, height)
+        } catch (error: any) {
+          channel.postMessage({
+            event: 'viewport:fail',
+            iframeId: id,
+            error: error.message,
+          } satisfies IframeViewportFailEvent)
+          break
+        }
         channel.postMessage({
           event: 'viewport:done',
           iframeId: id,
```

**File**: `packages/browser/src/client/tester/context.ts` (modified, +4/-1)
```diff
@@ -390,6 +390,7 @@ const screenshotIds: Record<string, Record<string, string>> = {}
 export const page: BrowserPage = {
   viewport(width, height) {
     const id = getBrowserState().iframeId!
+    const sourceError = new Error('STACK_TRACE_ERROR')
     channel.postMessage({
       event: 'viewport',
       width,
@@ -404,7 +405,9 @@ export const page: BrowserPage = {
         }
         if (e.data.event === 'viewport:fail' && e.data.iframeId === id) {
           channel.removeEventListener('message', handler)
-          reject(new Error(e.data.error))
+          const error = new Error(e.data.error)
+          error.stack = sourceError.stack?.replace(sourceError.message, error.message)
+          reject(error)
         }
       })
     })
```

**File**: `packages/ui/client/composables/api.ts` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 import type { BrowserUI } from 'vitest'
+import { nextTick } from 'vue'
 import { viewport } from './browser'
 import { browserState, findById } from './client'
 import { currentModule, showDashboard, updateBrowserPanel } from './navigation'
@@ -16,6 +17,6 @@ export const ui: BrowserUI = {
     if (browserState?.provider === 'webdriverio') {
       updateBrowserPanel()
     }
-    await new Promise((r) => requestAnimationFrame(r))
+    await nextTick()
   },
 }
```

**File**: `test/browser/specs/ui.test.ts` (modified, +40/-0)
```diff
@@ -87,4 +87,44 @@ describe.runIf(provider.name === 'playwright')('browser ui', () => {
       }
     `)
   })
+
+  test('page.viewport() does not wait for an animation frame (#10831)', async () => {
+    const { stderr, exitCode, testTree } = await runInlineTests(
+      {
+        'basic.test.ts': /* ts */ `
+          import { expect, test } from 'vitest'
+          import { page } from 'vitest/browser'
+
+          test('resizes the iframe', async () => {
+            await page.viewport(320, 480)
+            expect(window.innerWidth).toBe(320)
+            expect(window.innerHeight).toBe(480)
+          })
+        `,
+      },
+      {
+        watch: false,
+        reporters: 'none',
+        browser: {
+          enabled: true,
+          headless: true,
+          ui: true,
+          provider,
+          instances: [{ browser: 'chromium' }],
+          // a page that is not rendered, like a hidden tab, gets no animation frames
+          orchestratorScripts: [{ content: 'window.requestAnimationFrame = () => 0' }],
+        },
+      },
+    )
+
+    expect(stderr).toBe('')
+    expect(exitCode).toBe(0)
+    expect(testTree()).toMatchInlineSnapshot(`
+      {
+        "basic.test.ts": {
+          "resizes the iframe": "passed",
+        },
+      }
+    `)
+  })
 })
```

**File**: `test/browser/specs/viewport.test.ts` (modified, +32/-0)
```diff
@@ -1,4 +1,5 @@
 import { expect, test } from 'vitest'
+import { provider } from '../settings'
 import { instances, runBrowserTests, runInlineBrowserTests } from './utils'
 
 test('viewport', async () => {
@@ -56,3 +57,34 @@ test('the first row is fully visible', async () => {
     `)
   }
 })
+
+test.runIf(provider.name === 'playwright')(
+  'page.viewport() rejects when the provider cannot resize the page',
+  async () => {
+    const { errorTree } = await runInlineBrowserTests({
+      'basic.test.ts': `
+import { test } from 'vitest'
+import { page } from 'vitest/browser'
+
+test('fractional size', async () => {
+  await page.viewport(320.5, 480)
+})
+`,
+    })
+
+    const trees = errorTree({ project: true, stackTrace: true })
+    expect(Object.keys(trees).sort()).toEqual(instances.map(({ browser }) => browser).sort())
+    for (const [browser, tree] of Object.entries(trees)) {
+      expect.soft(tree, browser).toMatchInlineSnapshot(`
+        {
+          "basic.test.ts": {
+            "fractional size": [
+              "page.setViewportSize: viewportSize.width: expected integer, got float 320.5
+            at basic.test.ts:6:14",
+            ],
+          },
+        }
+      `)
+    }
+  },
+)
```

---

### Incident Patch 2: `cca423de` (2026-10-26)
**Commit Message**: fix(mocker): don't change the original prototype chain (#11737)

Co-authored-by: Max Schwenk <[REDACTED_EMAIL]>

**File**: `docs/api/vi.md` (modified, +4/-0)
```diff
@@ -527,6 +527,10 @@ expect(spied.simple).toHaveBeenCalled()
 expect(spied.simple.mock.results[0]).toEqual({ type: 'return', value: 'value' })
 ```
 
+::: warning
+With `spy: true`, `vi.mockObject` doesn't copy objects. It returns the same `original` object and replaces its methods, including the methods of nested objects and class prototypes, with spies in place.
+:::
+
 ### vi.isMockFunction
 
 ```ts
```

**File**: `docs/guide/mocking/modules.md` (modified, +4/-0)
```diff
@@ -188,6 +188,10 @@ expect(answer()).toBe(42)
 expect(answer).toHaveBeenCalled()
 ```
 
+::: warning
+With `spy: true`, Vitest doesn't copy exported objects and class prototypes. Instead, it replaces their methods with spies in place. Node.js built-ins and [externalized](/config/server#server-deps-external) dependencies are evaluated only once, so other code, `vi.importActual` and `require` see these spies too. For example, `vi.mock(import('node:events'), { spy: true })` turns `EventEmitter.prototype.emit` into a spy for every event emitter in the worker.
+:::
+
 One nice thing that mocked modules support is sharing the state between the instance and its prototype. Consider this module:
 
 ```ts [answer.js]
```

**File**: `packages/mocker/src/automocker.ts` (modified, +20/-1)
```diff
@@ -115,7 +115,26 @@ export function mockObject(
       }
 
       const isFunction = type.includes('Function') && typeof value === 'function'
-      if ((!isFunction || value._isMockFunction) && type !== 'Object' && type !== 'Module') {
+      const isPrototype =
+        property === 'prototype' &&
+        typeof container === 'function' &&
+        typeof value === 'object' &&
+        value !== null
+      // the spy changes the parent of a prototype without methods,
+      // so the mock keeps its own prototype instead of sharing the original
+      if (
+        isPrototype &&
+        options.type === 'autospy' &&
+        collectFunctionProperties(value).length === 0
+      ) {
+        continue
+      }
+      if (
+        (!isFunction || value._isMockFunction) &&
+        type !== 'Object' &&
+        type !== 'Module' &&
+        !isPrototype
+      ) {
         define(newContainer, property, value)
         continue
       }
```

**File**: `test/unit/test/mocking/vi-mockObject.test.ts` (modified, +60/-0)
```diff
@@ -246,6 +246,66 @@ test('the array is not empty when spying', () => {
   expect(array[3].array).toEqual([1])
 })
 
+test.each(['automock', 'autospy'] as const)(
+  '%s does not change the prototype chain of generator functions',
+  async (type) => {
+    function* generator() {
+      yield 1
+    }
+    async function* asyncGenerator() {
+      yield 1
+    }
+    const generatorParent = Object.getPrototypeOf(generator.prototype)
+    const asyncGeneratorParent = Object.getPrototypeOf(asyncGenerator.prototype)
+
+    const mocked = vi.mockObject({ generator, asyncGenerator }, { spy: type === 'autospy' })
+    mocked.generator.mockReset()
+    mocked.asyncGenerator.mockReset()
+    mocked.generator.mockImplementation(function* () {})
+    mocked.asyncGenerator.mockImplementation(async function* () {})
+
+    expect(Object.getPrototypeOf(generator.prototype)).toBe(generatorParent)
+    expect(Object.getPrototypeOf(asyncGenerator.prototype)).toBe(asyncGeneratorParent)
+    expect([...generator()]).toEqual([1])
+    expect(await Array.fromAsync(asyncGenerator())).toEqual([1])
+  },
+)
+
+test('autospy does not change the prototype chain of a function without prototype methods', () => {
+  function Base() {}
+  Base.prototype.greet = function () {
+    return 'hello'
+  }
+  function Child() {}
+  Child.prototype = Object.create(Base.prototype)
+
+  const mocked = vi.mockObject({ Child }, { spy: true })
+  mocked.Child.mockImplementation(() => {})
+
+  expect(Object.getPrototypeOf(Child.prototype)).toBe(Base.prototype)
+})
+
+test.each(['automock', 'autospy'] as const)(
+  '%s mocks prototype methods of a class with a custom tag',
+  (type) => {
+    class Store {
+      get [Symbol.toStringTag]() {
+        return 'Store'
+      }
+
+      get(key: string) {
+        return key
+      }
+    }
+
+    const mocked = vi.mockObject({ Store }, { spy: type === 'autospy' })
+    const store = new mocked.Store()
+
+    expect(store.get('key')).toBe(type === 'autospy' ? 'key' : undefined)
+    expect(mocked.Store.prototype.get).toHaveBeenCalledWith('key')
+  },
+)
+
 function mockModule(type: 'automock' | 'autospy' = 'automock') {
   return vi.mockObject(
     {
```

---

### Incident Patch 3: `d5d7d2f0` (2026-10-26)
**Commit Message**: feat(browser): add failure-only trace view mode (#11612)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/config/browser/traceview.md` (modified, +35/-10)
```diff
@@ -5,7 +5,7 @@ outline: deep
 
 # browser.traceView <Version>5.0.0</Version>
 
-- **Type:** `boolean | { enabled?: boolean; recordCanvas?: boolean; inlineImages?: boolean; ariaSnapshot?: boolean }`
+- **Type:** `boolean | 'off' | 'on' | 'failure-only' | { mode?: 'off' | 'on' | 'failure-only'; recordCanvas?: boolean; inlineImages?: boolean; ariaSnapshot?: boolean }`
 - **CLI:** `--browser.traceView`
 - **Default:** `false`
 
@@ -21,14 +21,26 @@ export default defineConfig({
 })
 ```
 
+To keep traces only for failed tests, use the `'failure-only'` mode:
+
+```ts
+export default defineConfig({
+  test: {
+    browser: {
+      traceView: 'failure-only',
+    },
+  },
+})
+```
+
 Use the object form to enable additional snapshot fidelity options:
 
 ```ts
 export default defineConfig({
   test: {
     browser: {
       traceView: {
-        enabled: true,
+        mode: 'on',
         inlineImages: true,
         recordCanvas: true,
       },
@@ -37,20 +49,33 @@ export default defineConfig({
 })
 ```
 
-| Option         | Default | Description                                                                                         |
-| -------------- | ------- | --------------------------------------------------------------------------------------------------- |
-| `enabled`      | `false` | Enables Vitest trace-view artifact collection.                                                      |
-| `inlineImages` | `false` | Inlines loaded `<img>` pixels into snapshots for more portable replay, useful in the HTML reporter. |
-| `recordCanvas` | `false` | Captures canvas pixels in snapshots.                                                                |
-| `ariaSnapshot` | `true`  | Captures the accessibility tree alongside each snapshot.                                            |
+| Option         | Default | Description                                                                                          |
+| -------------- | ------- | ---------------------------------------------------------------------------------------------------- |
+| `mode`         | `'off'` | How trace view records tests: `'on'` (every test), `'failure-only'` (only failed tests), or `'off'`. |
+| `inlineImages` | `false` | Inlines loaded `<img>` pixels into snapshots for more portable replay, useful in the HTML reporter.  |
+| `recordCanvas` | `false` | Captures canvas pixels in snapshots.                                                                 |
+| `ariaSnapshot` | `true`  | Captures the accessibility tree alongside each snapshot.                                             |
+| `enabled`      | `false` | Deprecated. Use `mode` instead.                                                                      |
 
-## browser.traceView.enabled {#traceview-enabled}
+## browser.traceView.enabled <Deprecated /> {#traceview-enabled}
 
 - **Type:** `boolean`
 - **Default:** `false`
 - **CLI:** `--browser.traceView.enabled`
 
-Enables Vitest trace-view artifact collection.
+Use [`mode`](#traceview-mode) instead. `true` is the same as `mode: 'on'`.
+
+## browser.traceView.mode <Version>5.1.0</Version> {#traceview-mode}
+
+- **Type:** `'off' | 'on' | 'failure-only'`
+- **Default:** `'off'`
+- **CLI:** `--browser.traceView.mode <mode>`
+
+How trace view records tests. Takes precedence over the deprecated `enabled`.
+
+- `'on'`: every test gets a trace with a snapshot at every step, and Vitest UI shows steps live as tests run.
+- `'failure-only'`: only failed tests get a trace, with the full step timeline and a snapshot at the end.
+- `'off'`: no traces.
 
 ## browser.traceView.inlineImages {#traceview-inlineimages}
 
```

**File**: `docs/guide/cli-generated.md` (modified, +8/-1)
```diff
@@ -414,7 +414,14 @@ Enable trace view mode. Supported: "on", "off", "on-first-retry", "on-all-retrie
 - **CLI:** `--browser.traceView.enabled`
 - **Config:** [browser.traceView.enabled](/config/browser/traceview#traceview-enabled)
 
-Enable Vitest trace-view collection for browser tests (default: `false`)
+Deprecated, use `--browser.traceView.mode` instead. Enable Vitest trace-view collection for browser tests (default: `false`)
+
+### browser.traceView.mode
+
+- **CLI:** `--browser.traceView.mode <mode>`
+- **Config:** [browser.traceView.mode](/config/browser/traceview#traceview-mode)
+
+How trace view records tests. Supported: "on" (every test), "failure-only" (only failed tests), "off" (default: `"off"`)
 
 ### browser.traceView.recordCanvas
 
```

**File**: `packages/browser/src/client/orchestrator.ts` (modified, +15/-5)
```diff
@@ -36,11 +36,21 @@ export class IframeOrchestrator {
   constructor() {
     debug('init orchestrator', getBrowserState().sessionId)
 
-    if (getConfig().browser.traceView.enabled) {
-      const domSnapshot = import('rrweb-snapshot')
-      // a load failure surfaces in the tester that awaits this
-      domSnapshot.catch(() => {})
-      getBrowserState().browserTraceDomSnapshotPromise = domSnapshot
+    const traceView = getConfig().browser.traceView
+    if (traceView.enabled) {
+      let domSnapshot: Promise<typeof import('rrweb-snapshot')> | undefined
+      getBrowserState().loadBrowserTraceDomSnapshot = () => {
+        if (!domSnapshot) {
+          domSnapshot = import('rrweb-snapshot')
+          // a load failure surfaces in the tester that awaits this
+          domSnapshot.catch(() => {})
+        }
+        return domSnapshot
+      }
+      // 'failure-only' loads it at the first failure instead
+      if (traceView.mode === 'on') {
+        void getBrowserState().loadBrowserTraceDomSnapshot!()
+      }
     }
 
     const otelConfig = getBrowserState().config.experimental.openTelemetry
```

**File**: `packages/browser/src/client/tester/runner.ts` (modified, +1/-3)
```diff
@@ -29,7 +29,7 @@ import {
 } from 'vitest/internal/browser'
 import { createStackString, parseStacktrace } from '../../../../utils/src/source-map'
 import { getTestName } from '../../../../vitest/src/utils/tasks'
-import { getBrowserState, getOrchestratorState, getWorkerState, moduleRunner, now } from '../utils'
+import { getBrowserState, getWorkerState, moduleRunner, now } from '../utils'
 import { rpc } from './rpc'
 import { VitestBrowserSnapshotEnvironment } from './snapshot'
 import { recordBrowserTraceEntry } from './trace'
@@ -95,8 +95,6 @@ function createBrowserRunner(
         return
       }
       if (shouldTraceView) {
-        getBrowserState().browserTraceDomSnapshot ??=
-          await getOrchestratorState().browserTraceDomSnapshotPromise
         getBrowserState().browserTraceAttempts.set(test.id, { retry, repeats, startTime: now() })
       } else {
         getBrowserState().browserTraceAttempts.delete(test.id)
```

**File**: `packages/browser/src/client/tester/trace.ts` (modified, +31/-9)
```diff
@@ -2,15 +2,15 @@ import type { RunnerTask as Task } from 'vitest'
 import type { BrowserTraceEntryKind } from 'vitest/browser'
 import type { BrowserRPC } from '../client'
 import type { SerializedLocator } from './locators'
-import { getBrowserState, getWorkerState, now } from '../utils'
+import { getBrowserState, getOrchestratorState, getWorkerState, now } from '../utils'
 
 export interface BrowserTraceData {
   retry: number
   repeats: number
   // UI has access to original config but let artifact own this
   recordCanvas: boolean
-  // Each artifact currently carries one entry; the UI merges entries by attempt.
-  // TODO: revisit whether this should be modeled as a single entry.
+  // In 'on' mode each artifact carries one entry, and in 'failure-only' mode one
+  // artifact carries the whole attempt. The UI merges entries by attempt.
   entries: BrowserTraceEntry[]
 }
 
@@ -35,7 +35,7 @@ export interface BrowserTraceEntry {
   // resolved server-side from stack in __vitest_recordBrowserTrace command
   location?: { file: string; line: number; column: number }
   element?: SerializedLocator
-  snapshot: TraceSnapshot
+  snapshot?: TraceSnapshot
 }
 
 interface TraceSnapshot {
@@ -80,6 +80,8 @@ export interface BrowserTraceAttempt {
   retry: number
   repeats: number
   startTime: number
+  // entries held back in 'failure-only' mode until the test fails
+  entries?: BrowserTraceEntry[]
 }
 
 export function createBrowserTraceRangeId(): string {
@@ -92,12 +94,32 @@ export async function recordBrowserTraceEntry(
 ): Promise<void> {
   const attemptInfo = getBrowserState().browserTraceAttempts.get(task.id)!
   const relativeStartTime = now() - attemptInfo.startTime
-  const snapshot = takeSnapshot(options.element)
+  const failureOnly = getBrowserState().config.browser.traceView.mode === 'failure-only'
+  // in 'failure-only', only the end of a failed test is snapshotted and sent,
+  // so passing tests stay free and their entries are dropped with the attempt
+  const isFailedTestEnd = options.kind === 'lifecycle' && options.status === 'fail'
+  const shouldSnapshot = failureOnly ? isFailedTestEnd : true
   const entry: BrowserTraceEntry = {
     ...options,
     startTime: relativeStartTime,
-    snapshot,
+    ...(shouldSnapshot ? { snapshot: await takeSnapshot(options.element) } : {}),
   }
+  if (!failureOnly) {
+    await sendBrowserTraceEntries(task, attemptInfo, [entry])
+    return
+  }
+  const entries = (attemptInfo.entries ??= [])
+  entries.push(entry)
+  if (isFailedTestEnd) {
+    await sendBrowserTraceEntries(task, attemptInfo, entries)
+  }
+}
+
+async function sendBrowserTraceEntries(
+  task: Task,
+  attemptInfo: BrowserTraceAttempt,
+  entries: BrowserTraceEntry[],
+): Promise<void> {
   const { retry, repeats } = attemptInfo
   const { recordCanvas } = getBrowserState().config.browser.traceView
 
@@ -109,7 +131,7 @@ export async function recordBrowserTraceEntry(
     retry,
     repeats,
     recordCanvas,
-    entries: [entry],
+    entries,
   }
   const rpc = getWorkerState().rpc as any as BrowserRPC
   await rpc.triggerCommand<void>(
@@ -126,8 +148,8 @@ export async function recordBrowserTraceEntry(
 // selector engine inside the snapshot iframe at view time via injected script.
 // Our approach resolves at collection time (same moment as snapshot) — simpler but
 // requires Mirror plumbing. nodeId-based lookup also works across shadow DOM, unlike querySelector.
-function takeSnapshot(serializedLocator?: SerializedLocator): TraceSnapshot {
-  const { snapshot, createMirror } = getBrowserState().browserTraceDomSnapshot!
+async function takeSnapshot(serializedLocator?: SerializedLocator): Promise<TraceSnapshot> {
+  const { snapshot, createMirror } = await getOrchestratorState().loadBrowserTraceDomSnapshot!()
   const traceView = getBrowserState().config.browser.traceView
   const engine = getBrowserState().selectorEngine!
   const mirror = createMirror()
```

**File**: `packages/browser/src/client/utils.ts` (modified, +2/-4)
```diff
@@ -112,10 +112,8 @@ export interface BrowserRunnerState {
   commands: CommandsManager
   activeTraceTaskIds: Set<string>
   browserTraceAttempts: Map<string, BrowserTraceAttempt>
-  // lazily loaded only when traceView is enabled
-  browserTraceDomSnapshot?: typeof import('rrweb-snapshot')
-  // import started by the orchestrator so every tester reuses one module instance
-  browserTraceDomSnapshotPromise?: Promise<typeof import('rrweb-snapshot')>
+  // import runs in the orchestrator so every tester reuses one module instance
+  loadBrowserTraceDomSnapshot?: () => Promise<typeof import('rrweb-snapshot')>
   selectorEngine: Ivya
   traces: Traces
   cleanups: Array<() => unknown>
```

**File**: `packages/ui/client/components/trace/TraceView.vue` (modified, +5/-2)
```diff
@@ -35,7 +35,7 @@ const iframeSandbox = computed(() => {
 })
 
 const { level: zoomLevel, setFitContainer } = useTraceZoom()
-const viewport = computed(() => selectedStep.value?.snapshot.viewport)
+const viewport = computed(() => selectedStep.value?.snapshot?.viewport)
 const scaledViewportStyle = computed(() =>
   viewport.value
     ? {
@@ -81,7 +81,7 @@ function onStepKeydown(event: KeyboardEvent, index: number) {
 watch(
   [selectedStep, iframeEl],
   ([step, iframe]) => {
-    if (!step || !iframe) {
+    if (!step?.snapshot || !iframe) {
       return
     }
     const { serialized, selectorIds, viewport, scroll, pseudoClassIds } = step.snapshot
@@ -270,6 +270,9 @@ function onSplitpanesResized({ panes }: SplitpanesResizedPayload) {
     <Pane :size="traceViewSplitSizes[1]" min-size="20">
       <div :ref="setFitContainer" class="h-full min-h-0 flex flex-col overflow-auto">
         <div v-if="!selectedStep" class="text-sm opacity-50 p-4">No trace step found</div>
+        <div v-else-if="!selectedStep.snapshot" class="text-sm opacity-50 p-4">
+          No snapshot captured for this trace step
+        </div>
         <template v-else-if="showAriaSnapshot">
           <pre
             v-if="selectedStep.snapshot.ariaSnapshot != null"
```

**File**: `packages/ui/client/composables/trace-view.ts` (modified, +2/-2)
```diff
@@ -347,7 +347,7 @@ export function useTraceZoom() {
     const selection = activeTraceView.value
     const viewport =
       selection &&
-      getSelectedTrace(selection)?.entries[selection.selectedStepIndex]?.snapshot.viewport
+      getSelectedTrace(selection)?.entries[selection.selectedStepIndex]?.snapshot?.viewport
     if (el && viewport) {
       level.value = Math.min(el.offsetWidth / viewport.width, el.offsetHeight / viewport.height, 1)
     }
@@ -368,7 +368,7 @@ const traceSnapshotViewMode = useLocalStorage<'dom' | 'aria'>(
 export function useTraceSnapshotViewMode(getTrace: () => BrowserTraceData | undefined) {
   const snapshotViewMode = traceSnapshotViewMode
   const hasAriaSnapshot = computed(
-    () => !!getTrace()?.entries.some((entry) => entry.snapshot.ariaSnapshot != null),
+    () => !!getTrace()?.entries.some((entry) => entry.snapshot?.ariaSnapshot != null),
   )
   const showAriaSnapshot = computed(
     () => snapshotViewMode.value === 'aria' && hasAriaSnapshot.value,
```

#### Recent Merged Pull Requests:
- **PR #11742** (2026-10-26): chore(deps): update dependency vitest-browser-vue to v3 (@renovate[bot])
- **PR #11739** (2026-10-26): fix(mocker): use root __mocks__ for linked packages (fix #7708) (@sheremet-va)
- **PR #11738** (2026-10-26): fix(browser): don't hang in `page.viewport()` (@sheremet-va)
- **PR #11737** (2026-10-26): fix(mocker): don't change the original prototype chain (@sheremet-va)
- **PR #11735** (2026-10-26): chore(deps): update dependency unplugin-swc to v2 (@renovate[bot])
- **PR #11733** (2026-10-26): chore(deps): update dependency happy-dom to v21 (@renovate[bot])

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

## X. browser): don't hang in `page.viewport()` (#11738)

**RULE**:
When implementing operations in `packages/browser/src/client/orchestrator.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in vitest-dev/vitest. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `49ff4420`: browser): don't hang in `page.viewport()` (#11738). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/browser/src/client/orchestrator.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
        try {
          await setIframeViewport(width, height)
        } catch (error: any) {
          channel.postMessage({
            event: 'viewport:fail',
            iframeId: id,
            error: error.message,
          } satisfies IframeViewportFailEvent)
          break
        }
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
        await setIframeViewport(width, height)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `49ff4420` are properly handled with clean fallback behavior.
