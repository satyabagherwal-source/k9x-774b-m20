> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webdriverio-webdriverio-learnings.md`  
> **Source**: github ([https://github.com/webdriverio/webdriverio](https://github.com/webdriverio/webdriverio))  
> **Source Version**: `ba88f76d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T19:13:39.314Z  
> **Learning ID**: `learn-github-webdriverio-webdriverio`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): webdriverio/webdriverio

> **Canonical Artifact**: `07_PROJECT_LEARNING/webdriverio-webdriverio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/webdriverio/webdriverio](https://github.com/webdriverio/webdriverio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T19:13:38.879Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webdriverio/webdriverio`
- **Description**: Next-gen browser and mobile automation test framework for Node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9861 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `__mocks__/@wdio/utils.ts`
```
/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest'
import {
    sleep as sleepOrig,
    isFunctionAsync as isFnAsync,
    getArgumentType as getArgumentTypeOrig,
    isValidParameter as isValidParameterOrig,
    commandCallStructure as commandCallStructureOrig
} from '../../packages/wdio-utils/src/utils.js'
import webdriverMonadOrig from '../../packages/wdio-utils/src/monad.js'
import {
    isBidi as isBidiOrig,
    sessionEnvironmentDetector as sessionEnvDetector,
    capabilitiesEnvironmentDetector as capabilitiesEnvDetector
} from '../../packages/wdio-utils/src/envDetector.js'
import { UNICODE_CHARACTERS as UNICODE_CHARACTERS_ORIG, HOOK_DEFINITION as HOOK_DEFINITION_ORIG } from '../../packages/wdio-utils/src/constants.js'

/**
 * the object brands have no side effects, and `webdriverio` uses them when its
 * modules load (for example on `MultiRemoteDriver.prototype`), so keep them real
 */
export { WDIO_KIND, WDIO_CHAINABLE, WDIO_KINDS, setWdioKind, getWdioKind, isArrayOfElements } from '../../packages/wdio-utils/src/kind.js'

class DotReporter {
    options: any
    emit: any
    constructor (options: any) {
        this.options = options
        this.emit = vi.fn()
    }
}

class RunnerMock {
    shutdown = vi.fn().mockResolvedValue(true)
    initialize = vi.fn()
}
class FoobarServiceMock {
    beforeSuite () {}
    afterCommand () {}
}

const frameworkMocks = {
    testNoFailures: {
        init () { return this },
        hasTests () { return true },
        run() { return 0 }
    },
    testWithFailures: {
        init () { return this },
        hasTests () { return true },
        run() { return 123 }
    },
    testThrows: {
        init () { return this },
        hasTests () { return true },
        run() { throw new Error('framework testThrows failed') }
    },
    testNoTests: {
        init () { return this },
        hasTests () { return false }
    }
}

const pluginMocks = {
    reporter: {
        dot: DotReporter
    },
    service: {
        foobar: FoobarServiceMock
    },
    runner: {
        local: RunnerMock
    },
    framework: frameworkMocks
}

export const initializePlugin = vi.fn().mockImplementation(
    async (name: keyof typeof frameworkMocks, type: keyof typeof pluginMocks) => (
        { default: (pluginMocks[type] as any)[name] }
    )
)
export const initializeWorkerService = vi.fn().mockReturnValue([])
export const initializeLauncherService = vi.fn().mockReturnValue({
    launcherServices: [],
    ignoredWorkerServices: []
})
export const isValidParameter = isValidParameterOrig
export const commandCallStructure = commandCallStructureOrig
export const isFunctionAsync = isFnAsync
export const safeRequire = vi.fn().mockReturnValue(() => {})
export const webdriverMonad = webdriverMonadOrig
export const getArgumentType = getArgumentTypeOrig

/**
 * shim
 */
export const executeSync = vi.fn()
export const executeAsync = vi.fn()
export const wrapCommand = (_: any, origFn: any) => origFn
export const setCommandHookStore = vi.fn()
/**
 * Element lists register their constructor at import time. Launcher tests mock
 * this module, so the registration has to exist or loading `webdriverio` throws.
 */
export const registerElementArrayFactory = vi.fn()
export const wrapGlobalTestMethod = vi.fn().mockReturnValue(vi.fn())
export const executeHooksWithArgs = vi.fn()
export const runFnInFiberContext = vi.fn().mockImplementation((fn) => {
    return function (this: unknown, ...args: any[]) {
        return Promise.resolve(fn.apply(this, args))
    }
})
export const setWdioSyncSupport = (value: boolean) => { hasWdioSyncSupport = value }
export let hasWdioSyncSupport = false
export const testFnWrapper = vi.fn()
export const isBidi = isBidiOrig
export const sessionEnvironmentDetector = vi.fn().mockImplementation(
    // @ts-ignore
    (...args) => sessionEnvDetector(...args))
export const capabilitiesEnvironmentDetector = capabilitiesEnvDetector
export const transformCommandLogResult = vi.fn().mockImplementation((data) => data)
export const sleep = vi.fn().mockImplementation(sleepOrig)
export const UNICODE_CHARACTERS = UNICODE_CHARACTERS_ORIG
export const HOOK_DEFINITION = HOOK_DEFINITION_ORIG

export const startWebDriver = vi.fn((params) => {
    params.hostname = '0.0.0.0'
    params.port = 4444
    params.path = '/'
})
export const setupBrowser = vi.fn()
export const setupDriver = vi.fn()
export const enableFileLogging = vi.fn()
export class TimingTracker {
    markTiming = vi.fn()
    getTimings = vi.fn().mockReturnValue({})
}

```

### Core Architecture Module: `__mocks__/@wdio/utils/node.ts`
```
import { vi } from 'vitest'

export const canAccess = vi.fn()
export const startWebDriver = vi.fn().mockResolvedValue({ pid: 42 })

```

### Core Architecture Module: `__mocks__/async-exit-hook.ts`
```
import { vi } from 'vitest'
export default vi.fn()

```

### Core Architecture Module: `__mocks__/lighthouse/lighthouse-core/audits/apple-touch-icon.ts`
```
import { vi } from 'vitest'
export default {
    audit: vi.fn().mockReturnValue({
        details: {},
        displayValue: 'apple-touch-icon',
        score: 1
    })
}

```

### Core Architecture Module: `__mocks__/lighthouse/lighthouse-core/audits/content-width.ts`
```
import { vi } from 'vitest'
export default {
    audit: vi.fn().mockReturnValue({
        details: {},
        displayValue: 'content-width',
        score: 1
    })
}

```

### Core Architecture Module: `__mocks__/lighthouse/lighthouse-core/audits/diagnostics.ts`
```
import { vi } from 'vitest'
export default {
    audit: vi.fn().mockImplementation((params: any) => {
        if (params.error) {
            throw params.error
        }

        return {
            details: {
                items: [{
                    numRequests: 201,
                    numScripts: 36,
                    numStylesheets: 7,
                    numFonts: 5,
                    numTasks: 110,
                    numTasksOver10ms: 1,
                    numTasksOver25ms: 0,
                    numTasksOver50ms: 0,
                    numTasksOver100ms: 0,
                    numTasksOver500ms: 0,
                    rtt: 19.016000000000002,
                    throughput: 569783.0945443822,
                    maxRtt: 145.65800000000002,
                    maxServerLatency: 4980.4710000000005,
                    totalByteWeight: 3897521,
                    totalTaskTime: 56.882000000000026,
                    mainDocumentTransferSize: 50074
                }]
            }
        }
    })
}

```

### Core Architecture Module: `__mocks__/lighthouse/lighthouse-core/audits/installable-manifest.ts`
```
import { vi } from 'vitest'
export default {
    audit: vi.fn().mockReturnValue({
        details: {},
        displayValue: 'installable-manifest',
        score: 1
    })
}

```

### Core Architecture Module: `__mocks__/lighthouse/lighthouse-core/audits/mainthread-work-breakdown.ts`
```
import { vi } from 'vitest'
export default {
    audit: vi.fn().mockReturnValue({
        details: {
            items: [{
                group: 'styleLayout',
                duration: 25.485
            }, {
                group: 'other',
                duration: 22.353
            }, {
                group: 'scriptEvaluation',
                duration: 4.353999999999999
            }, {
                group: 'parseHTML',
                duration: 1.678
            }, {
                group: 'garbageCollection',
                duration: 1.411
            }, {
                group: 'scriptParseCompile',
                duration: 0.8830000000000001
            }, {
                group: 'paintCompositeRender',
                duration: 0.718
            }]
        }
    })
}

```

### Core Architecture Module: `__mocks__/lighthouse/lighthouse-core/audits/maskable-icon.ts`
```
import { vi } from 'vitest'
export default {
    audit: vi.fn().mockReturnValue({
        details: {},
        displayValue: 'maskable-icon',
        score: 1
    })
}

```

### Core Architecture Module: `__mocks__/lighthouse/lighthouse-core/audits/metrics.ts`
```
import { vi } from 'vitest'
export default {
    audit: vi.fn().mockReturnValue({
        details: {
            items: [
                {
                    domContentLoaded: 20608,
                    firstVisualChange: 18114,
                    firstPaint: 18090,
                    firstContentfulPaint: 18090,
                    firstMeaningfulPaint: 23117,
                    largestContentfulPaint: 23117,
                    lastVisualChange: 24347,
                    interactive: 24117,
                    load: 54730,
                    maxPotentialFID: 1234,
                    speedIndex: 20411,
                    totalBlockingTime: 20411,
                    cumulativeLayoutShift: 24347,
                },
            ],
        },
    }),
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16279** (2026-10-27): **fix(@wdio/mocha-framework): give the root hooks of beforeSuite and afterSuite their own title**
  *Symptoms*: ## Proposed changes  The Mocha adapter adds a root `before all` and `after all` hook to every run: they run the `beforeSuite` and `afterSuite` hooks of the config and the services. The hooks had no name, so Mocha gave them the title of an anonymous user root hook (`"before all" hook in "{root}"`). A reporter that lists root hooks showed each user root hook 2 times, the second one empty. Now they have their own title, in sequential and parallel mode:  - `"before all" hook: beforeSuite in "{root}"` (or `for "<first test>"`) - `"after all" hook: afterSuite in "{root}"` (or `for "<last test>"`)  **Named change:** the title of these 2 hooks in the reporter events. The title still starts with `"before all" hook` / `"after all" hook` and ends with `"{root}"` (or the test), which `@wdio/runner` and `@wdio/spec-reporter` check.  Real run (Mocha, root `before` + `after` with one command each, `describe('A')`), tracking: #16168:  | Report | `main` | This PR | |---|---|---| | Allure fixtures of test A1 | `"before all" hook in "{root}"` (1 step), `"before all" hook in "{root}"` (0 steps), `"after all" hook in "{root}"` (1 step), `"after all" hook in "{root}"` (0 steps) | `"before all" hook in "{root}"` (1 step), `"before all" hook: beforeSuite in "{root}"` (0 steps), `"after all" hook in "{root}"` (1 step), `"after all" hook: afterSuite in "{root}"` (0 steps) | | html `(root)` hooks (`removeOutput: false`) | `"before all" hook in "{root}"` 2 times, `"after all" hook in "{root}"` 2 times |

- **Issue #16274** (2026-10-27): **fix(@wdio/cli, webdriver): load tsx on Node.js 18 and add the bidiConnectTimeout option (v9)**
  *Symptoms*: ## Proposed changes  Two v9 fixes in one PR, to save CI time.  ### 1. `@wdio/cli`: tsx on Node.js 18  tsx 4.21.1 and later call `Array.prototype.toReversed` (Node.js 20+) when a tsconfig `extends` another one. `@wdio/cli` 9 depends on `tsx ^4.7.2`, so a fresh install on Node.js 18 gets tsx 4.23.15. The worker then stops at start:  ``` TypeError: E.toReversed is not a function or its return value is not iterable     at resolveEntry (.../tsx@4.23.15/node_modules/tsx/dist/register-B1c7OH6V.cjs:7:12650)     at resolveExtendsChain (...) ```  Seen on Dependabot #16263 (tsx 4.21.0 → 4.23.15): Component Test on Node 18.20.8 fails, Node 20 to 26 pass. The wdio CLI sets `TSX_TSCONFIG_PATH` to `e2e/browser-runner/tsconfig.json`, which has `extends`.  | Node.js | Change | |---|---| | 18 | Import a polyfill before tsx: in the launcher process (`importTsx()`) and in the worker `NODE_OPTIONS` (`--import <polyfill> --import tsx`). The polyfill also registers itself as a loader module, because Node.js 18 runs the tsx ESM hooks in a separate thread. | | 20+ | No change. |  The polyfill adds a non-enumerable `toReversed` only when it is missing. `toReversed` is the only Node.js 20+ API in tsx 4.23.15.  ### 2. `webdriver`: `bidiConnectTimeout` option (backport of #15987, with #15996)  On v9 the BiDi connection has a fixed 10 s limit. A busy Windows Firefox can accept it later, then the session continues as Classic and a BiDi-only call fails. Seen on Dependabot #16267, Multi-remote windows-latest

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

### Incident Patch 1: `4257f55e` (2026-10-25)
**Commit Message**: feat(@wdio/vitest-framework): Introducing Vitest with parallel run and fixtures (#16154)

* refactor(@wdio/utils): share parallel context allocation between frameworks

Mocha and Cucumber each carried their own copy of the BiDi window and
user-context allocation and cleanup. Move them to @wdio/utils so the
upcoming Vitest framework can use the same code.

* feat(@wdio/vitest-framework): run Vitest specs from the wdio testrunner

framework: 'vitest' hands the run to Vitest: wdio.conf specs, maxInstances and
capabilities become the Vitest include, maxWorkers and one project per
capability. Each spec file gets its own session with the WDIO globals and
expect-webdriverio as the default expect. test.concurrent tests run in their
own browsing context (or user context) through the parallel context store,
and throw without vitestOpts.parallelMode instead of sharing one window.

The launcher delegates to any framework that exports launch(), so other
frameworks keep the worker path.

* fix(@wdio/vitest-framework): give session start a hook timeout

beforeAll starts the browser session, and Vitest's 10s hook default cut it
off on a loaded machine, leaving the fork to hang until the pool kille

**File**: `packages/wdio-cli/src/launcher.ts` (modified, +94/-3)
```diff
@@ -1,19 +1,22 @@
 import fs from 'node:fs/promises'
+import { fileURLToPath } from 'node:url'
 import exitHook from 'async-exit-hook'
 
 import logger from '@wdio/logger'
 import { validateConfig, DEFAULT_MAX_INSTANCES_PER_CAPABILITY_VALUE } from '@wdio/config'
 import { ConfigParser } from '@wdio/config/node'
 import { initializePlugin, initializeLauncherService, sleep, enableFileLogging } from '@wdio/utils'
 import { setupDriver, setupBrowser } from '@wdio/utils/node'
-import type { Capabilities, Services } from '@wdio/types'
+import type { Capabilities, Frameworks, Services } from '@wdio/types'
 
 import CLInterface from './interface.js'
 import { runLauncherHook, runOnCompleteHook, runServiceHook, type HookError, shouldEnableTsx, enableTsx } from './utils.js'
 import { TESTRUNNER_DEFAULTS, TS_FILE_EXTENSIONS, WORKER_GROUPLOGS_MESSAGES } from './constants.js'
 import type { RunCommandArguments } from './types.js'
 const log = logger('@wdio/cli:launcher')
 
+const LAUNCHER_FRAMEWORKS = new Set(['vitest', '@wdio/vitest-framework'])
+
 interface Schedule {
     cid: number
     caps: WebdriverIO.Capabilities
@@ -28,6 +31,18 @@ interface WorkerSpecs {
     rid?: string
 }
 
+/** Vitest `provide` structured-clones the args into forked workers, and programmatic callers may pass functions or classes */
+function cloneableEntries<T extends object>(args: T): Partial<T> {
+    return Object.fromEntries(Object.entries(args).filter(([, value]) => {
+        try {
+            structuredClone(value)
+            return true
+        } catch {
+            return false
+        }
+    })) as Partial<T>
+}
+
 export interface EndMessage {
     cid: string, // is actually rid
     exitCode: number,
@@ -59,6 +74,8 @@ class Launcher {
 
     private _launcher?: Services.ServiceInstance[]
     private _resolve?: Function
+    #frameworkAbort = new AbortController()
+    #frameworkLaunch?: Promise<number>
 
     constructor(
         private _configFilePath: string,
@@ -98,6 +115,12 @@ class Launcher {
         let error: HookError | undefined = undefined
         const caps = this.configParser.getCapabilities() as Capabilities.TestrunnerCapabilities
 
+        // Rejecting here keeps every hook, service and runner shutdown from running for a run that never starts
+        const framework = await this.#loadFrameworkLauncher(config)
+        if (framework) {
+            this.#assertFrameworkSupportsRun(config.framework, caps)
+        }
+
         try {
             const { ignoredWorkerServices, launcherServices } = await initializeLauncherService(config, caps)
             this._launcher = launcherServices
@@ -134,7 +157,11 @@ class Launcher {
                     .reduce((a, b) => a + b, 0)
                 : 1
 
-            this.interface = new CLInterface(config, totalWorkerCnt, this._isWatchMode)
+            if (framework && config.specFileRetries > 0) {
+                log.warn('specFileRetries is not supported with this framework and is ignored')
+            }
+            // The framework schedules specs itself, so no spec file is ever retried
+            this.interface = new CLInterface(framework ? { ...config, specFileRetries: 0 } : config, totalWorkerCnt, this._isWatchMode)
             config.runnerEnv!.FORCE_COLOR = Number(this.interface.hasAnsiSupport).toString()
 
             /**
@@ -145,7 +172,34 @@ class Launcher {
                 setupBrowser(config, caps)
             ])
 
-            exitCode = await this._runMode(config, caps)
+            const cliInterface = this.interface
+            if (framework) {
+                this.#frameworkLaunch = framework.launch({
+                    // ConfigParser keeps capabilities outside of getConfig()
+                    config: { ...config, capabilities: caps } as WebdriverIO.Config,
+                    specs: this.configParser.getSpecs().flat().map((spec) => spec.startsWith('file://') ? fileURLToPath(spec) : spec),
+                    configFile: this._configFilePath,
+                    args: cloneableEntries(this._args),
+                    signal: this.#frameworkAbort.signal,
+                    onEvent: (event) => {
+                        if (event.type === 'job:start') {
+                            const { cid, caps, specs } = event
+                            cliInterface.emit('job:start', { cid, caps, specs, hasTests: true })
+                        } else if (event.type === 'job:end') {
+                            cliInterface.emit('job:end', { cid: event.cid, passed: event.passed, retries: 0 })
+                        } else {
+                            cliInterface.onMessage(event.message as Parameters<CLInterface['onMessage']>[0])
+                        }
+                    }
+                })
+            }
+            exitCode = this.#frameworkLaunch
+                ? Number(await this.#frameworkLaunch.catch((err) => {
+                    // onComplete hooks must not see a green exit code for a crashed run
+        
```

**File**: `packages/wdio-cli/tests/launcher.test.ts` (modified, +213/-1)
```diff
@@ -1,7 +1,9 @@
 import path from 'node:path'
+import { pathToFileURL } from 'node:url'
 import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest'
 import logger from '@wdio/logger'
 import { sleep, enableFileLogging, initializePlugin, initializeLauncherService } from '@wdio/utils'
+import type { Frameworks } from '@wdio/types'
 import Launcher from '../src/launcher.js'
 
 const caps: WebdriverIO.Capabilities = {
@@ -34,7 +36,7 @@ vi.mock('../src/interface', () => ({
         logHookError = vi.fn()
         finalise = vi.fn()
 
-        constructor (_config: WebdriverIO.Config, totalWorkerCnt: number) {
+        constructor (public _config: WebdriverIO.Config, totalWorkerCnt: number) {
             this.totalWorkerCnt = totalWorkerCnt
         }
     }
@@ -981,6 +983,216 @@ describe('launcher', () => {
             expect(dispose.mock.invocationCallOrder[0]).toBeGreaterThan(serviceOnComplete.mock.invocationCallOrder[0])
         })
 
+        describe('framework with launch export', () => {
+            const launch = vi.fn()
+            const defaultPlugin = vi.mocked(initializePlugin).getMockImplementation()!
+            const [specA, specB, specC] = ['/repo/a.ts', '/repo/b.ts', '/repo/c.ts'].map((spec) => path.resolve(spec))
+
+            const mockFramework = (framework: () => Promise<unknown>) => vi.mocked(initializePlugin).mockImplementation(
+                (name, type) => type === 'framework' ? framework() as never : defaultPlugin(name, type)
+            )
+
+            beforeEach(() => {
+                launch.mockReset()
+                launcher.interface!.logHookError = vi.fn()
+                config.framework = 'vitest'
+                launcher['_configFilePath'] = '/repo/wdio.conf.ts'
+                launcher.configParser.getSpecs = vi.fn().mockReturnValue([pathToFileURL(specA).href, [specB, pathToFileURL(specC).href]])
+            })
+
+            afterEach(() => {
+                vi.mocked(initializePlugin).mockImplementation(defaultPlugin)
+            })
+
+            it('delegates to launch instead of scheduling workers', async () => {
+                mockFramework(async () => ({ launch }))
+                launch.mockResolvedValue(0)
+
+                expect(await launcher.run()).toEqual(0)
+                expect(launch).toHaveBeenCalledWith({
+                    config: { ...config, capabilities: {} },
+                    specs: [specA, specB, specC],
+                    configFile: '/repo/wdio.conf.ts',
+                    args: launcher['_args'],
+                    signal: expect.any(AbortSignal),
+                    onEvent: expect.any(Function)
+                })
+                expect(launcher['_runMode']).not.toBeCalled()
+                expect(config.onComplete![0]).toBeCalledTimes(1)
+            })
+
+            it('maps framework events onto the CLI interface', async () => {
+                mockFramework(async () => ({ launch }))
+                launch.mockImplementation(async ({ onEvent }: Frameworks.FrameworkLaunchParams) => {
+                    onEvent!({ type: 'job:start', cid: '0-0', caps: { browserName: 'chrome' }, specs: ['/repo/a.ts'] })
+                    onEvent!({ type: 'message', message: { origin: 'reporter', name: 'x', cid: '0-0' } })
+                    onEvent!({ type: 'job:end', cid: '0-0', passed: false })
+                    return 1
+                })
+
+                await launcher.run()
+
+                expect(launcher.interface!.emit).toHaveBeenCalledWith('job:start', { cid: '0-0', caps: { browserName: 'chrome' }, specs: ['/repo/a.ts'], hasTests: true })
+                expect(launcher.interface!.onMessage).toHaveBeenCalledWith({ origin: 'reporter', name: 'x', cid: '0-0' })
+                expect(launcher.interface!.emit).toHaveBeenCalledWith('job:end', { cid: '0-0', passed: false, retries: 0 })
+            })
+
+            it('creates the CLI interface without spec file retries and warns once', async () => {
+                mockFramework(async () => ({ launch }))
+                launch.mockResolvedValue(0)
+                config.specFileRetries = 2
+                const warn = vi.mocked(logger('@wdio/cli:launcher').warn)
+                warn.mockClear()
+
+                await launcher.run()
+
+                expect((launcher.interface as any)._config.specFileRetries).toBe(0)
+                expect(config.specFileRetries).toBe(2)
+                expect(warn.mock.calls.filter(([message]) => String(message).includes('specFileRetries'))).toHaveLength(1)
+            })
+
+            it('keeps spec file retries for frameworks without launch', async () => {
+                mockFramework(async () => ({}))
+                config.specFileRetries = 2
+
+                await launcher.run()
+
+                expect((launcher.interface as any)._config.specFileRetries).toBe(2)
+            })
+
+            it('turns a failure count into exit code 1', async () => {
+                mockFramewo
```

**File**: `packages/wdio-config/src/index.ts` (modified, +3/-2)
```diff
@@ -1,6 +1,6 @@
 /* istanbul ignore file */
 
-import { DEFAULT_CONFIGS, DEFAULT_MAX_INSTANCES_PER_CAPABILITY_VALUE } from './constants.js'
+import { DEFAULT_CONFIGS, DEFAULT_MAX_INSTANCES_PER_CAPABILITY_VALUE, SUPPORTED_HOOKS } from './constants.js'
 import { defineConfig, validateConfig, isCloudCapability } from './utils.js'
 
 export {
@@ -15,7 +15,8 @@ export {
      * constants
      */
     DEFAULT_CONFIGS,
-    DEFAULT_MAX_INSTANCES_PER_CAPABILITY_VALUE
+    DEFAULT_MAX_INSTANCES_PER_CAPABILITY_VALUE,
+    SUPPORTED_HOOKS
 }
 
 export * from './types.js'
```

**File**: `packages/wdio-cucumber-framework/src/parallel.ts` (modified, +1/-60)
```diff
@@ -37,6 +37,7 @@ import { EventEmitter } from 'node:events'
 import type { AsyncLocalStorage } from 'node:async_hooks'
 
 import logger from '@wdio/logger'
+import { allocateContext, cleanupAllocation, resolveMaxContexts, type ParallelContextAllocation } from '@wdio/utils'
 import * as Gherkin from '@cucumber/gherkin'
 import { IdGenerator } from '@cucumber/messages'
 import type * as messages from '@cucumber/messages'
@@ -263,66 +264,6 @@ export function isParallelAvailable(): boolean {
     return parallelModulesAvailable
 }
 
-// ============================================================
-// Context allocation
-// ============================================================
-
-interface ParallelContextAllocation {
-    context: string
-    userContext?: string
-}
-
-function resolveMaxContexts(value: unknown, fallback: number): number {
-    return typeof value === 'number' && Number.isFinite(value) && value > 0
-        ? Math.max(1, Math.floor(value))
-        : Math.max(1, fallback)
-}
-
-async function removeUserContext(bidi: ParallelBrowser, userContext: string): Promise<void> {
-    try {
-        await bidi.browserRemoveUserContext?.({ userContext })
-    } catch (err) {
-        log.debug(`Cleanup error removing user context ${userContext}: ${(err as Error).message}`)
-    }
-}
-
-async function closeContext(bidi: ParallelBrowser, context: string, level: 'debug' | 'warn', label: string): Promise<void> {
-    try {
-        await bidi.browsingContextClose({ context })
-    } catch (err) {
-        log[level](`${label} ${context}: ${(err as Error).message}`)
-    }
-}
-
-async function cleanupAllocation(bidi: ParallelBrowser, { context, userContext }: ParallelContextAllocation): Promise<void> {
-    await closeContext(bidi, context, 'debug', 'Cleanup error closing context')
-    if (userContext) {
-        await removeUserContext(bidi, userContext)
-    }
-    bidi.__parallelContexts?.delete(context)
-}
-
-async function allocateContext(bidi: ParallelBrowser, mode: ParallelMode): Promise<ParallelContextAllocation> {
-    let allocation: ParallelContextAllocation
-    if (mode !== 'userContexts') {
-        const { context } = await bidi.browsingContextCreate({ type: 'window' })
-        allocation = { context }
-    } else {
-        const { userContext } = await bidi.browserCreateUserContext!({})
-        try {
-            const { context } = await bidi.browsingContextCreate({ type: 'window', userContext })
-            allocation = { context, userContext }
-        } catch (err) {
-            await removeUserContext(bidi, userContext)
-            throw err
-        }
-    }
-    // Register with the session ContextManager so navigations inside these
-    // windows don't trigger session-global re-anchoring (tree fetch + switchToWindow).
-    bidi.__parallelContexts?.add(allocation.context)
-    return allocation
-}
-
 // ============================================================
 // Feature-grouped pickle collection
 // ============================================================
```

**File**: `packages/wdio-mocha-framework/src/index.ts` (modified, +1/-2)
```diff
@@ -8,13 +8,12 @@ import Mocha from 'mocha'
 import { handleRequires } from 'mocha/lib/cli/run-helpers.cjs'
 
 import logger from '@wdio/logger'
-import { executeHooksWithArgs } from '@wdio/utils'
+import { executeHooksWithArgs, type ParallelMode } from '@wdio/utils'
 import type { Services } from '@wdio/types'
 
 import { applyMochaDefaults, formatMessage, setupEnv } from './common.js'
 import { EVENTS, NOOP } from './constants.js'
 import type { MochaOpts as MochaOptsImport, FrameworkMessage, MochaError } from './types.js'
-import type { ParallelMode } from './parallel.js'
 import { runParallelTests } from './parallel.js'
 import type { EventEmitter } from 'node:events'
 
```

**File**: `packages/wdio-mocha-framework/src/parallel.ts` (modified, +2/-62)
```diff
@@ -20,6 +20,7 @@ import Mocha from 'mocha'
 import type { Suite } from 'mocha'
 import logger from '@wdio/logger'
 import { dottedFullTitle, formatError, type TitledNode } from './common.js'
+import { allocateContext, cleanupAllocation, resolveMaxContexts, type ParallelContextAllocation, type ParallelContextBrowser, type ParallelMode } from '@wdio/utils'
 import { MOCHA_TIMEOUT_MESSAGE } from './constants.js'
 import type { MochaError } from './types.js'
 import type { EventEmitter } from 'node:events'
@@ -77,28 +78,9 @@ function resolveTimeoutMs(timeout?: number | string): number {
  * webdriverio (to avoid a circular dependency), so we declare the shape
  * we need here.
  */
-interface ParallelBrowser extends WebdriverIO.Browser {
+interface ParallelBrowser extends WebdriverIO.Browser, ParallelContextBrowser {
     isBidi: boolean
     __parallelContextStore?: AsyncLocalStorage<string>
-    /** Set of framework-managed parallel contexts (see session/context.ts). */
-    __parallelContexts?: Set<string>
-    browsingContextCreate?(params: { type: string; userContext?: string }): Promise<{ context: string }>
-    browsingContextClose?(params: { context: string }): Promise<void>
-    browserCreateUserContext?(params: Record<string, never>): Promise<{ userContext: string }>
-    browserRemoveUserContext?(params: { userContext: string }): Promise<void>
-}
-
-export type ParallelMode = 'contexts' | 'userContexts'
-
-export interface ParallelContextAllocation {
-    context: string
-    userContext?: string
-}
-
-export function resolveMaxContexts(value: number | undefined, fallback: number): number {
-    return typeof value === 'number' && Number.isFinite(value) && value > 0
-        ? Math.max(1, Math.floor(value))
-        : Math.max(1, fallback)
 }
 
 interface CollectedTest {
@@ -550,48 +532,6 @@ function callHook(hook: any, ctx: object, timeoutMs?: number, uncaught?: Uncaugh
     })
 }
 
-// ============================================================
-// Context pre-allocation
-// ============================================================
-
-async function removeUserContext(bidi: ParallelBrowser, userContext: string, level: 'warn' | 'debug' = 'warn') {
-    await bidi.browserRemoveUserContext!({ userContext }).catch(
-        (err) => { log[level](`[Parallel] failed to remove user context ${userContext}: ${(err as Error).message}`) }
-    )
-}
-
-async function allocateContext(bidi: ParallelBrowser, mode: ParallelMode): Promise<ParallelContextAllocation> {
-    let allocation: ParallelContextAllocation
-    if (mode !== 'userContexts') {
-        const { context } = await bidi.browsingContextCreate!({ type: 'window' })
-        allocation = { context }
-    } else {
-        const { userContext } = await bidi.browserCreateUserContext!({})
-        try {
-            const { context } = await bidi.browsingContextCreate!({ type: 'window', userContext })
-            allocation = { context, userContext }
-        } catch (err) {
-            await removeUserContext(bidi, userContext)
-            throw err
-        }
-    }
-    // Register with the session ContextManager so navigations inside these
-    // windows don't trigger session-global re-anchoring (tree fetch + switchToWindow).
-    bidi.__parallelContexts?.add(allocation.context)
-    return allocation
-}
-
-/** Never rejects: close window, then remove its user context, then unregister. */
-async function cleanupAllocation(bidi: ParallelBrowser, { context, userContext }: ParallelContextAllocation) {
-    await bidi.browsingContextClose!({ context }).catch(
-        (err) => { log.debug(`[Parallel] cleanup: failed to close context ${context}: ${(err as Error).message}`) }
-    )
-    if (userContext) {
-        await removeUserContext(bidi, userContext, 'debug')
-    }
-    bidi.__parallelContexts?.delete(context)
-}
-
 interface TestRunResult {
     status: 'passed' | 'failed' | 'pending'
     name: string
```

**File**: `packages/wdio-types/src/Frameworks.ts` (modified, +30/-0)
```diff
@@ -152,3 +152,33 @@ export interface Scenario {
      */
     tags: Tag[]
 }
+
+export interface FrameworkLaunchParams {
+    config: WebdriverIO.Config
+    /** Resolved absolute spec file paths, after `--spec` and `exclude` filtering. */
+    specs: string[]
+    configFile: string
+    /** CLI arguments the launcher was started with, so framework workers can rebuild the same config. */
+    args?: Record<string, unknown>
+    /** Aborted when the launcher receives SIGINT/SIGTERM. The framework must cancel its run and resolve. */
+    signal?: AbortSignal
+    /** Receives the job and reporter events the CLI needs to render the run. */
+    onEvent?: (event: FrameworkLaunchEvent) => void
+}
+
+export type FrameworkLaunchEvent =
+    | { type: 'job:start', cid: string, caps: WebdriverIO.Capabilities, specs: string[] }
+    | { type: 'job:end', cid: string, passed: boolean }
+    | { type: 'message', message: unknown }
+
+/**
+ * Frameworks that schedule specs themselves export `launch`. The CLI then
+ * calls it in the launcher process instead of starting WDIO workers.
+ *
+ * @experimental Internal to first-party frameworks (the CLI only honors an
+ * allowlist). The contract may change in any release, without a major version.
+ */
+export interface FrameworkLauncher {
+    /** @returns number of failures, `0` when the run passed */
+    launch(params: FrameworkLaunchParams): Promise<number>
+}
```

**File**: `packages/wdio-utils/src/index.ts` (modified, +12/-1)
```diff
@@ -20,6 +20,7 @@ import { TimingTracker, type TimingMetrics, type TimingPhase } from './profiler.
 import {
     WDIO_KIND, WDIO_CHAINABLE, WDIO_KINDS, setWdioKind, getWdioKind, getLoadedWdioKind, isLoadedElement, isArrayOfElements, type WdioKind
 } from './kind.js'
+import { allocateContext, cleanupAllocation, resolveMaxContexts, type ParallelMode, type ParallelContextAllocation, type ParallelContextBrowser } from './parallel/contexts.js'
 import { knownRoles, roleTable, ROLE_SYNONYMS, type AttributeTest, type RoleRule } from './roles.js'
 
 export {
@@ -100,5 +101,15 @@ export {
     knownRoles,
     ROLE_SYNONYMS,
     type AttributeTest,
-    type RoleRule
+    type RoleRule,
+
+    /**
+     * BiDi context allocation for parallel test execution
+     */
+    allocateContext,
+    cleanupAllocation,
+    resolveMaxContexts,
+    type ParallelMode,
+    type ParallelContextAllocation,
+    type ParallelContextBrowser
 }
```

---

### Incident Patch 2: `f5499765` (2026-10-25)
**Commit Message**: fix(webdriverio): remove the log of the ChromeDriver BiDi Mapper so that BiDi commands do not get slower (#16225)

* fix(webdriverio): remove the log of the ChromeDriver BiDi Mapper so that BiDi commands do not get slower

ChromeDriver runs the BiDi Mapper in a hidden target with a 0x0 viewport, and
the Mapper writes each BiDi message into its page. The layout of that log made
each large message (for example a screenshot) slower than the one before.
WebdriverIO now removes the #logs element of the Mapper page once for each
Chrome BiDi session. https://issues.chromium.org/issues/577213792

* fix(webdriverio): find the BiDi Mapper by its title and stop after a blocked CDP endpoint

- find the Mapper target by its title (chrome-headless-shell gives it the type page)
- detach from the Mapper target also when the script cannot be sent
- after a failed CDP request, do not use the endpoint again in this process
  (a grid can block it, and each failed request is retried)
- an e2e test checks that the Mapper page has no log

Code review 1 of #16225.

* fix(webdriverio): remove the BiDi Mapper log only with a local driver and an "other" target

- attach only to a Mapper target of type other:

**File**: `e2e/wdio/headless/bidiMapperLog.e2e.ts` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+import { browser, expect } from '@wdio/globals'
+
+interface TargetInfo {
+    targetId: string
+    type: string
+    title: string
+}
+
+const MAPPER_TITLE = 'BiDi-CDP Mapper'
+
+// random pixels: the PNG does not compress, so its BiDi message is large
+const NOISE_PAGE = 'data:text/html,<body style="margin:0"><canvas id=c width=455 height=455></canvas><script>' +
+    'const c=document.getElementById("c").getContext("2d");const d=c.createImageData(455,455);' +
+    'for(let i=0;i<d.data.length;i++)d.data[i]=i%4===3?255:Math.random()*256|0;c.putImageData(d,0,0)</script>'
+
+/**
+ * The page of the ChromeDriver BiDi Mapper is a hidden target. A script there
+ * cannot return a value through the ChromeDriver CDP endpoint, so it writes the
+ * result into the page title, and `Target.getTargets` reads it. This uses
+ * another channel than `session/bidiMapperLog.ts` on purpose: a bug there must
+ * not hide here.
+ */
+async function getMapperPage () {
+    const targets = async () => (await browser.sendCommandAndGetResult('Target.getTargets', { filter: [{}] }) as { targetInfos: TargetInfo[] }).targetInfos
+    const mapper = (await targets()).find(({ title, type }) => title === MAPPER_TITLE && type === 'other')
+    expect(mapper).toBeDefined()
+    const { sessionId } = await browser.sendCommandAndGetResult('Target.attachToTarget', { targetId: mapper!.targetId, flatten: false }) as { sessionId: string }
+    const send = (id: number, expression: string) => browser.sendCommandAndGetResult('Target.sendMessageToTarget', {
+        sessionId,
+        message: JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression } })
+    })
+    try {
+        await send(1, `document.title = '${MAPPER_TITLE} ' + JSON.stringify({ logs: Boolean(document.getElementById('logs')), size: document.documentElement.outerHTML.length })`)
+        let title = ''
+        await browser.waitUntil(async () => {
+            title = (await targets()).find(({ targetId }) => targetId === mapper!.targetId)?.title ?? ''
+            return title.startsWith(`${MAPPER_TITLE} {`)
+        })
+        return JSON.parse(title.slice(MAPPER_TITLE.length + 1)) as { logs: boolean, size: number }
+    } finally {
+        await send(2, `document.title = '${MAPPER_TITLE}'`)
+        await browser.sendCommandAndGetResult('Target.detachFromTarget', { sessionId })
+    }
+}
+
+// https://issues.chromium.org/issues/577213792
+describe('ChromeDriver BiDi Mapper', () => {
+    it('has no log in its page, so large BiDi messages do not slow down later commands', async () => {
+        expect(browser.isBidi).toBe(true)
+        await browser.url(NOISE_PAGE)
+        const { data } = await browser.browsingContextCaptureScreenshot({ context: await browser.getWindowHandle() })
+        expect(data.length).toBeGreaterThan(500_000)
+
+        const page = await getMapperPage()
+        expect(page.logs).toBe(false)
+        // also when a Chrome update writes the log into another element
+        expect(page.size).toBeLessThan(data.length / 10)
+    })
+})
```

**File**: `e2e/wdio/wdio.conf.ts` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ export const config: WebdriverIO.Config = {
         path.join(__dirname, 'headless', 'missingListItemOverwrite.e2e.ts'),
         path.join(__dirname, 'headless', 'setFiles.e2e.ts'),
         path.join(__dirname, 'headless', 'browsingContexts.e2e.ts'),
+        path.join(__dirname, 'headless', 'bidiMapperLog.e2e.ts'),
     ],
 
     /**
```

**File**: `packages/webdriverio/src/environment.ts` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ export const isNode = !!(typeof process !== 'undefined' && process.version)
 export interface EnvironmentVariables {
     WDIO_UNIT_TESTS?: string
     WDIO_WORKER_ID?: string
+    WDIO_KEEP_BIDI_MAPPER_LOG?: string
 }
 
 export interface EnvironmentDependencies {
```

**File**: `packages/webdriverio/src/session/bidiMapperLog.ts` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+import logger from '@wdio/logger'
+import { capabilitiesEnvironmentDetector } from '@wdio/utils'
+
+import { SessionManager } from './session.js'
+import { environment } from '../environment.js'
+
+const log = logger('webdriverio:BidiMapperLogManager')
+
+const MAPPER_TITLE = 'BiDi-CDP Mapper'
+
+/**
+ * Chrome lists the Mapper as `other` (chrome-headless-shell: `page`), and also
+ * as a `tab` that runs no script
+ */
+const MAPPER_TYPES = ['other', 'page']
+
+/**
+ * before, the Mapper is a page with a viewport and its log does not slow down
+ * the commands (and Chrome 132 has no `goog:cdp`)
+ */
+const FIRST_SLOW_VERSION = 137
+
+export const MAPPER_LOG_TIMEOUT = 5000
+
+/**
+ * Runs in the page of the BiDi Mapper. Without `#logs`, the Mapper does not
+ * write the BiDi messages into its page; nothing else reads that element.
+ */
+export const REMOVE_MAPPER_LOG = `if (document.title === "${MAPPER_TITLE}") { document.getElementById("logs")?.remove() }`
+
+interface TargetInfo {
+    targetId: string
+    type: string
+    title: string
+}
+
+interface CdpBidiHandler {
+    send (command: { method: 'goog:cdp.sendCommand', params: { method: string, params: object } }): Promise<{ result?: { result?: unknown } }>
+}
+
+export function getBidiMapperLogManager(browser: WebdriverIO.Browser) {
+    return SessionManager.getSessionManager(browser, BidiMapperLogManager)
+}
+
+/**
+ * ChromeDriver runs the BiDi Mapper in a hidden target with a 0x0 viewport, and
+ * the Mapper writes each BiDi message into its page. The layout of that 20px wide
+ * log makes each large message (e.g. a screenshot) slower than the one before:
+ * https://issues.chromium.org/issues/577213792
+ * Remove this manager when Chrome fixes that issue.
+ */
+export class BidiMapperLogManager extends SessionManager {
+    #initialize: Promise<boolean>
+
+    constructor(browser: WebdriverIO.Browser) {
+        super(browser, BidiMapperLogManager.name)
+
+        // `browser.isChromium` does not change with `reloadSession()` to another browser
+        const { isChromium } = capabilitiesEnvironmentDetector(browser.capabilities)
+        // NaN for an unknown version, which does not skip
+        const majorVersion = parseInt(browser.capabilities.browserVersion ?? '', 10)
+        if (!this.isEnabled() || !isChromium || browser.isMobile || majorVersion < FIRST_SLOW_VERSION) {
+            this.#initialize = Promise.resolve(true)
+            return
+        }
+        // the switch to turn off the fix when it causes a problem
+        if (['1', 'true'].includes(environment.value.variables.WDIO_KEEP_BIDI_MAPPER_LOG?.toLowerCase() ?? '')) {
+            log.info('WDIO_KEEP_BIDI_MAPPER_LOG is set: keep the log of the ChromeDriver BiDi Mapper')
+            this.#initialize = Promise.resolve(true)
+            return
+        }
+
+        this.#initialize = withTimeout((signal) => removeMapperLog(browser, signal)).then(() => true, (err: Error) => {
+            log.warn(
+                `Could not remove the log of the ChromeDriver BiDi Mapper (${err.message}), so large ` +
+                'WebDriver BiDi messages (e.g. screenshots) can make the next commands slower: ' +
+                'https://issues.chromium.org/issues/577213792'
+            )
+            return false
+        })
+    }
+
+    async initialize() {
+        return this.#initialize
+    }
+}
+
+/**
+ * after the timeout, `run` sends no new command; the race also handles its late rejection
+ */
+function withTimeout(run: (signal: AbortSignal) => Promise<void>) {
+    const controller = new AbortController()
+    let timer: ReturnType<typeof setTimeout> | undefined
+    const timeout = new Promise<never>((_, reject) => {
+        timer = setTimeout(() => {
+            controller.abort()
+            reject(new Error(`no answer after ${MAPPER_LOG_TIMEOUT}ms`))
+        }, MAPPER_LOG_TIMEOUT)
+    })
+    return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer))
+}
+
+async function removeMapperLog(browser: WebdriverIO.Browser, signal: AbortSignal) {
+    /**
+     * CDP through the BiDi connection (chromium-bidi `goog:cdp.sendCommand`)
+     * also reaches the browser through a grid or a cloud service
+     */
+    const handler = (browser as unknown as { _bidiHandler: CdpBidiHandler })._bidiHandler
+    const cdp = async <T>(method: string, params: object) => (
+        await handler.send({ method: 'goog:cdp.sendCommand', params: { method, params } })
+    ).result?.result as T
+
+    // hidden targets are listed only with an explicit filter
+    const { targetInfos } = await cdp<{ targetInfos: TargetInfo[] }>('Target.getTargets', { filter: [{}] })
+    let error: unknown
+    for (const { targetId } of targetInfos.filter(({ title, type }) => title === MAPPER_TITLE && MAPPER_TYPES.includes(type))) {
+        if (signal.aborted) {
+            return
+        }
+        try {
+            /**
+             * the Mapper detaches 
```

**File**: `packages/webdriverio/src/session/index.ts` (modified, +3/-1)
```diff
@@ -3,6 +3,7 @@ import { getShadowRootManager } from './shadowRoot.js'
 import { getNetworkManager } from './networkManager.js'
 import { getDialogManager } from './dialog.js'
 import { getContextManager } from './context.js'
+import { getBidiMapperLogManager } from './bidiMapperLog.js'
 import { setIOSScriptTimeout, trackScriptTimeout } from '../utils/scriptTimeout.js'
 
 /**
@@ -25,7 +26,8 @@ export function registerSessionManager(instance: WebdriverIO.Browser) {
             getPolyfillManager(instance).initialize(),
             getShadowRootManager(instance).initialize(),
             getNetworkManager(instance).initialize(),
-            getDialogManager(instance).initialize()
+            getDialogManager(instance).initialize(),
+            getBidiMapperLogManager(instance).initialize()
         )
     }
 
```

**File**: `packages/webdriverio/tests/session/bidiMapperLog.test.ts` (added, +325/-0)
```diff
@@ -0,0 +1,325 @@
+/// <reference path="../../src/index.ts" />
+import path from 'node:path'
+import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
+import logger from '@wdio/logger'
+
+import { BidiMapperLogManager, REMOVE_MAPPER_LOG } from '../../src/session/bidiMapperLog.js'
+
+vi.mock('@wdio/logger', () => import(path.join(process.cwd(), '__mocks__', '@wdio/logger')))
+
+vi.mock('../../src/session/session.js', () => ({
+    SessionManager: class SessionManagerMock {
+        removeListeners = vi.fn()
+        isEnabled: () => boolean
+        constructor(public browser: { isEnabled: () => boolean }) {
+            this.isEnabled = () => browser.isEnabled()
+        }
+    }
+}))
+
+const log = logger('test')
+
+const PAGE = { targetId: 'page', type: 'page', url: 'about:blank', title: 'about:blank' }
+// Chrome lists the hidden Mapper target and a tab entry for it with the same title
+const MAPPER = { targetId: 'mapper', type: 'other', url: 'about:blank', title: 'BiDi-CDP Mapper' }
+const MAPPER_TAB = { targetId: 'mapper-tab', type: 'tab', url: 'about:blank', title: 'BiDi-CDP Mapper' }
+
+type CdpHandler = (method: string, params: Record<string, unknown>) => unknown
+
+let browser: WebdriverIO.Browser & { _bidiHandler: { send: Mock } }
+
+/**
+ * answers `goog:cdp.sendCommand` as chromium-bidi does: the CDP result is in `result.result`
+ */
+function answer(handler: CdpHandler) {
+    browser._bidiHandler.send.mockImplementation(async ({ method, params }: { method: string, params: { method: string, params: Record<string, unknown> } }) => {
+        if (method !== 'goog:cdp.sendCommand') {
+            throw new Error(`unexpected BiDi command ${method}`)
+        }
+        return { type: 'success', id: 1, result: { result: await handler(params.method, params.params) } }
+    })
+}
+
+const defaultCdp: CdpHandler = (method) => {
+    if (method === 'Target.getTargets') {
+        return { targetInfos: [PAGE, { targetId: 'other', type: 'other', url: 'about:blank', title: 'about:blank' }, MAPPER, MAPPER_TAB] }
+    }
+    if (method === 'Target.attachToTarget') {
+        return { sessionId: 'mapper-session' }
+    }
+    return {}
+}
+
+const cdpCalls = () => browser._bidiHandler.send.mock.calls.map(([{ params }]) => params)
+const cdpMethods = () => cdpCalls().map(({ method }: { method: string }) => method)
+
+describe('BidiMapperLogManager', () => {
+    beforeEach(() => {
+        vi.mocked(log.warn).mockClear()
+        vi.mocked(log.debug).mockClear()
+        vi.mocked(log.info).mockClear()
+        browser = {
+            isMobile: false,
+            capabilities: { browserName: 'chrome', browserVersion: '156.0.8078.47', 'goog:chromeOptions': {} },
+            options: { hostname: 'localhost', port: 4321 },
+            isEnabled: vi.fn().mockReturnValue(true),
+            _bidiHandler: { send: vi.fn() }
+        } as unknown as WebdriverIO.Browser & { _bidiHandler: { send: Mock } }
+        answer(defaultCdp)
+    })
+
+    afterEach(() => {
+        vi.useRealTimers()
+    })
+
+    it('removes the log of the hidden BiDi Mapper target through the WebDriver BiDi connection', async () => {
+        expect(await new BidiMapperLogManager(browser).initialize()).toBe(true)
+        expect(browser._bidiHandler.send.mock.calls.map(([command]) => command)).toEqual([
+            // hidden targets are listed only with an explicit filter
+            { method: 'goog:cdp.sendCommand', params: { method: 'Target.getTargets', params: { filter: [{}] } } },
+            { method: 'goog:cdp.sendCommand', params: { method: 'Target.attachToTarget', params: { targetId: 'mapper', flatten: false } } },
+            { method: 'goog:cdp.sendCommand', params: {
+                method: 'Target.sendMessageToTarget',
+                params: {
+                    sessionId: 'mapper-session',
+                    message: JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: REMOVE_MAPPER_LOG } })
+                }
+            } },
+            { method: 'goog:cdp.sendCommand', params: { method: 'Target.detachFromTarget', params: { sessionId: 'mapper-session' } } }
+        ])
+        expect(log.warn).not.toBeCalled()
+    })
+
+    // chrome-headless-shell gives the Mapper the type `page`
+    it('removes the log of a BiDi Mapper of the type page', async () => {
+        answer((method, params) => method === 'Target.getTargets'
+            ? { targetInfos: [PAGE, { ...MAPPER, type: 'page' }] }
+            : defaultCdp(method, params))
+        expect(await new BidiMapperLogManager(browser).initialize()).toBe(true)
+        expect(cdpCalls()).toContainEqual({ method: 'Target.attachToTarget', params: { targetId: 'mapper', flatten: false } })
+    })
+
+    it('does not attach to the tab entry of the BiDi Mapper or to another target', async () => {
+        answer((method, params) => method === 'Target.getTargets'
+            ? { targetInfos: [PAGE, MAPPER_TAB, { ...M
```

**File**: `packages/webdriverio/tests/session/index.test.ts` (modified, +6/-0)
```diff
@@ -5,6 +5,7 @@ import { getShadowRootManager } from '../../src/session/shadowRoot.js'
 import { getNetworkManager } from '../../src/session/networkManager.js'
 import { getDialogManager } from '../../src/session/dialog.js'
 import { getContextManager } from '../../src/session/context.js'
+import { getBidiMapperLogManager } from '../../src/session/bidiMapperLog.js'
 import { registerSessionManager } from '../../src/session/index.js'
 import { setIOSScriptTimeout, trackScriptTimeout } from '../../src/utils/scriptTimeout.js'
 
@@ -20,6 +21,9 @@ vi.mock('../../src/session/networkManager.js', () => ({
 vi.mock('../../src/session/dialog.js', () => ({
     getDialogManager: vi.fn(() => ({ initialize: vi.fn() }))
 }))
+vi.mock('../../src/session/bidiMapperLog.js', () => ({
+    getBidiMapperLogManager: vi.fn(() => ({ initialize: vi.fn() }))
+}))
 vi.mock('../../src/session/context.js', () => ({
     getContextManager: vi.fn(() => ({ initialize: vi.fn() }))
 }))
@@ -40,6 +44,7 @@ describe('webdriverio session manager', () => {
         expect(getShadowRootManager).toBeCalledWith(browser)
         expect(getNetworkManager).toBeCalledWith(browser)
         expect(getDialogManager).toBeCalledWith(browser)
+        expect(getBidiMapperLogManager).toBeCalledWith(browser)
         expect(getContextManager).toBeCalledWith(browser)
         expect(trackScriptTimeout).toBeCalledWith(browser)
         expect(setIOSScriptTimeout).toBeCalledWith(browser)
@@ -54,6 +59,7 @@ describe('webdriverio session manager', () => {
         expect(getShadowRootManager).not.toBeCalledWith(browser)
         expect(getNetworkManager).not.toBeCalledWith(browser)
         expect(getDialogManager).not.toBeCalledWith(browser)
+        expect(getBidiMapperLogManager).not.toBeCalledWith(browser)
         expect(trackScriptTimeout).not.toBeCalledWith(browser)
         // ContextManager is always registered for caching current window handle
         expect(getContextManager).toBeCalledWith(browser)
```

**File**: `website/docs/Capabilities.md` (modified, +2/-0)
```diff
@@ -101,6 +101,8 @@ In a WebDriver BiDi session, runs element commands and browser commands like `ge
 }
 ```
 
+In every WebDriver BiDi session with Chrome or Edge 137 and later (or when the browser version is not known), with or without this capability, WebdriverIO removes the on-page log of the ChromeDriver BiDi Mapper when the session starts: that log makes each command after a large BiDi message (for example a screenshot) slower ([crbug.com/577213792](https://issues.chromium.org/issues/577213792)). To keep the log, set the environment variable `WDIO_KEEP_BIDI_MAPPER_LOG=1`.
+
 </Option>
 
 #### `wdio:electronVersion`
```

---

### Incident Patch 3: `1868575b` (2026-10-25)
**Commit Message**: fix(@wdio/session): act on a ref that has no selector instead of reporting it as stale (#16244)

* fix(@wdio/session): act on a ref that has no selector instead of reporting it as stale

Since #16131 a ref can have no selector candidates, e.g. a nameless button
repeated in shadow roots. resolveTarget found the element through the page
store, then stableSelector threw REF_STALE and asked for a new snapshot,
which gave the same ref again, so the action could never run.

The action now runs on the resolved element. The recorded code uses
ref('eN') with a comment that the step only replays in the session. A ref
whose element is gone still reports REF_STALE.

Claude-Session: https://claude.ai/code/session_018aEoYqM4KhkksR6qCfRhwo

* test(@wdio/session): check that snapshot selectors find their element under BiDi and classic

#16131 changed which selectors a snapshot attaches to a ref, so that every
attached selector finds its element in a WebDriver BiDi session (#16095).
Its tests checked the generated strings. This e2e test opens a page with
the cases of #16095 (leading and trailing icons, a non-breaking space,
block children, repeated names, nameless buttons in shadow roots) in both
p

**File**: `e2e/session/__fixtures__/site/names.html` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+<!doctype html>
+<html lang="en">
+<head>
+  <meta charset="utf-8">
+  <title>Accessible Names Fixture</title>
+  <style>.icon::before { content: ""; display: inline-block; width: 8px; height: 8px; background: currentColor }</style>
+</head>
+<body>
+  <!-- the cases of #16095: names whose whitespace differs between the snapshot and WebDriver BiDi -->
+  <nav>
+    <a href="#logout"><i class="icon"></i> Logout</a>
+    <a href="#docs">Docs <i class="icon"></i></a>
+    <a href="#next"><div>Next</div><div>Protocol Commands</div></a>
+  </nav>
+  <main>
+    <button type="button"><svg width="8" height="8" aria-hidden="true"></svg> Submit</button>
+    <button type="button">Save&nbsp;draft</button>
+    <section><div><button type="button">Same</button></div></section>
+    <section><div><button type="button">Same</button></div></section>
+    <icon-button></icon-button>
+    <icon-button></icon-button>
+    <icon-button></icon-button>
+  </main>
+  <script>
+    // nameless buttons repeated in shadow roots: no selector names one of them alone
+    customElements.define('icon-button', class extends HTMLElement {
+      connectedCallback () {
+        const root = this.attachShadow({ mode: 'open' })
+        root.innerHTML = '<button type="button"></button>'
+        root.querySelector('button').addEventListener('click', () => this.setAttribute('data-clicked', ''))
+      }
+    })
+  </script>
+</body>
+</html>
```

**File**: `e2e/session/selectors.test.ts` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import { describe, it, expect, beforeAll, afterAll } from 'vitest'
+
+import { createProject, startServer, type FixtureServer, type Project } from './helpers.js'
+
+/**
+ * The selector a snapshot attaches to a ref must find exactly that element when a script
+ * runs it later, in a WebDriver BiDi session and in a classic one (#16095).
+ */
+describe.each([
+    ['WebDriver BiDi', []],
+    ['WebDriver classic', ['--no-bidi']]
+])('wdio session snapshot selectors (%s)', (_protocol, openArgs) => {
+    let server: FixtureServer
+    let project: Project
+
+    const run = (...args: string[]) => project.run(args)
+
+    beforeAll(async () => {
+        server = await startServer()
+        project = createProject('selectors')
+        const open = await project.run(['open', 'chrome', `${server.url}/names.html`, '--no-snapshot', ...openArgs])
+        expect(open.code, open.stderr).toBe(0)
+    }, 60_000)
+
+    afterAll(async () => {
+        await project.cleanup()
+        await server.close()
+    })
+
+    it('attaches only selectors that find exactly the element of their ref', async () => {
+        const snapshot = await run('snapshot', '-i', '--selectors')
+        expect(snapshot.code, snapshot.stderr).toBe(0)
+        const refs = snapshot.stdout.split('\n')
+            .map((line) => line.match(/\[ref=(e\d+)\].*?(?: {2}→ (.+?)(?: \(positional\))?)?$/))
+            .filter((match): match is RegExpMatchArray => Boolean(match))
+            .map(([, id, selector]) => ({ id, selector }))
+        const withSelector = refs.filter(({ selector }) => selector)
+        // 3 links, Submit, Save draft and the 2 "Same" buttons
+        expect(withSelector.length, snapshot.stdout).toBeGreaterThanOrEqual(7)
+
+        for (const { id, selector } of withSelector) {
+            const check = await run('exec', '-e', [
+                `const found = await $$(${JSON.stringify(selector)}).getElements()`,
+                `return found.length === 1 && await found[0].isEqual(await ref(${JSON.stringify(id)})) ? 'ok' : 'found ' + found.length`
+            ].join('; '))
+            expect(check.code, check.stderr).toBe(0)
+            expect(`${id} ${selector}: ${check.stdout.trim()}`).toBe(`${id} ${selector}: ok`)
+        }
+    })
+
+    it('acts on a nameless button repeated in shadow roots, which has no selector of its own', async () => {
+        const snapshot = await run('snapshot', '-i', '--selectors')
+        const nameless = snapshot.stdout.split('\n').filter((line) => /- button \[ref=e\d+\]/.test(line))
+        expect(nameless, snapshot.stdout).toHaveLength(3)
+        const id = nameless[1].match(/\[ref=(e\d+)\]/)![1]
+
+        const clicked = await run('click', id)
+        expect(clicked.code, clicked.stderr).toBe(0)
+        const marked = await run('exec', '-e', 'return await browser.execute(() => [...document.querySelectorAll("icon-button")].map((el) => el.hasAttribute("data-clicked")))')
+        expect(JSON.parse(marked.stdout)).toEqual([false, true, false])
+    })
+})
```

**File**: `packages/wdio-session/src/actions/contexts.ts` (modified, +5/-2)
```diff
@@ -182,6 +182,9 @@ const switchCode = async (session: Session, tab: Tab) => session.isBidi
 
 const joinCode = (...lines: string[]) => lines.filter(Boolean).join('\n')
 
+const queryOn = (varName: string, code: string) =>
+    code.startsWith(`${varName}.`) || code.startsWith('ref(') ? code : `${varName}.${code}`
+
 function resetFrame (session: Session) {
     session.set('frame', undefined)
     session.set('frameStack', [])
@@ -508,7 +511,7 @@ export async function holdFrame (session: Session, frameRef: string) {
         }
     }
     return {
-        lines: [`const page = ${page}`, `const frame = await page.frame(page.${resolved.code})`],
+        lines: [`const page = ${page}`, `const frame = await page.frame(${queryOn('page', resolved.code)})`],
         /**
          * Back to where the session was, without asking the browser, for an
          * action that is given up while the page may not answer at all.
@@ -603,7 +606,7 @@ async function frameBidi (session: Session, target: string): Promise<ActionOutco
      */
     const ownerVar = await declareHeld(session, owner)
     // in a held frame the selector code already queries through its variable
-    const query = ownerVar.name && resolved.code.startsWith(`${ownerVar.name}.`) ? resolved.code : `${ownerVar.name}.${resolved.code}`
+    const query = ownerVar.name && queryOn(ownerVar.name, resolved.code)
     const childVar = ownerVar.name
         ? await declareContext(session, 'frame', child.contextId, () => `await ${ownerVar.name}.frame(${query})`)
         : { code: '' }
```

**File**: `packages/wdio-session/src/snapshot/target.ts` (modified, +13/-2)
```diff
@@ -63,14 +63,25 @@ export async function resolveTarget (session: Session, target: unknown): Promise
     const id = refId(target)
     if (id) {
         const element = await session.refs.resolve(scopeOf(session), id)
-        const selector = await session.refs.stableSelector(scopeOf(session), id, element)
         const entry = session.refs.get(id)!
+        const label = `${id} (${entry.role}${entry.name ? ` ${JSON.stringify(entry.name)}` : ''})`
+        // a ref can have no selector at all, e.g. a nameless button repeated in shadow roots; the element
+        // resolved, so act on it: a new snapshot would give the same ref without selectors again
+        const selector = await session.refs.stableSelector(scopeOf(session), id, element).catch((err: unknown) => {
+            if (entry.candidates.length > 0) {
+                throw err
+            }
+        })
+        if (!selector) {
+            const ref = `ref(${quote(id)})`
+            return { element, selector: ref, code: `${ref} /* no selector matches this element, this step only replays in this session */`, label }
+        }
         return {
             element,
             selector,
             // a replay with a selector that misses the element would fail or act on another one
             code: inScope(session, `$(${quote(selector)})`) + (entry.unverified ? ' /* no selector matches only this element (closed shadow root?), this step may not replay */' : ''),
-            label: `${id} (${entry.role}${entry.name ? ` ${JSON.stringify(entry.name)}` : ''})`
+            label
         }
     }
     let element: WebdriverIO.Element
```

**File**: `packages/wdio-session/tests/actions/contexts.test.ts` (modified, +20/-2)
```diff
@@ -10,12 +10,14 @@ vi.mock('webdriverio', () => ({
 vi.mock('../../src/snapshot/target.js', () => ({
     resolveTarget: async (_session: Session, target: string) => ({
         element: { getTagName: async () => 'iframe' },
-        code: `$('${target}')`,
+        code: /^e\d+$/.test(target)
+            ? `ref('${target}') /* no selector matches this element, this step only replays in this session */`
+            : `$('${target}')`,
         label: target
     })
 }))
 
-const { frame, tabs } = await import('../../src/actions/contexts.js')
+const { frame, holdFrame, tabs } = await import('../../src/actions/contexts.js')
 
 function harness ({ secondUrl = 'https://b.test/', outerSiblings = ['https://a.test/outer.html'] } = {}) {
     const store = new Map<string, unknown>()
@@ -109,6 +111,22 @@ describe('frame (BiDi)', () => {
             "const frame = await page.frame(page.$('iframe#outer'))"
         )
     })
+
+    it('passes a ref without a selector to frame() as the exec global, not a page method', async () => {
+        const { session, record } = harness()
+        expect(await record((await frame(session, { target: 'e5', $cwd: '/' })).history)).toBe(
+            "const page = (await browser.browsingContexts()).find((context) => context.url === 'https://a.test/')!\n" +
+            "const frame = await page.frame(ref('e5') /* no selector matches this element, this step only replays in this session */)"
+        )
+    })
+
+    it('holds a frame given by a ref without a selector through the exec global', async () => {
+        const { session } = harness()
+        expect((await holdFrame(session, 'e5')).lines).toEqual([
+            "const page = (await browser.browsingContexts()).find((context) => context.url === 'https://a.test/')!",
+            "const frame = await page.frame(ref('e5') /* no selector matches this element, this step only replays in this session */)"
+        ])
+    })
 })
 
 describe('frame (BiDi) after a cleared history', () => {
```

**File**: `packages/wdio-session/tests/snapshot/target.test.ts` (modified, +19/-0)
```diff
@@ -44,4 +44,23 @@ describe('resolveTarget', () => {
         expect(resolved.selector).toBe('button')
         expect(resolved.code).toMatch(/^\$\('button'\) \/\* .*may not replay \*\/$/)
     })
+
+    it('acts on a resolved ref that has no selector candidates instead of asking for a new snapshot', async () => {
+        const refs = new RefRegistry()
+        refs.set({ id: 'e5', kind: 'web', role: 'button', name: '', candidates: [], generation: 1 })
+        const element = { elementId: '1' }
+        const browser = { $: () => ({ getElement: async () => element }), $$: () => ({ getElements: async () => [] }) }
+        const resolved = await resolveTarget({ browser, refs } as unknown as Session, 'e5')
+        expect(resolved.element).toBe(element)
+        expect(resolved.selector).toBe("ref('e5')")
+        expect(resolved.code).toBe("ref('e5') /* no selector matches this element, this step only replays in this session */")
+        expect(resolved.label).toBe('e5 (button)')
+    })
+
+    it('still reports a ref without candidates whose element is gone as stale', async () => {
+        const refs = new RefRegistry()
+        refs.set({ id: 'e6', kind: 'web', role: 'button', name: '', candidates: [], generation: 1 })
+        const browser = { $: () => ({ getElement: async () => ({}) }) }
+        await expect(resolveTarget({ browser, refs } as unknown as Session, 'e6')).rejects.toMatchObject({ code: 'REF_STALE' })
+    })
 })
```

**File**: `website/docs/session/export.md` (modified, +2/-0)
```diff
@@ -6,6 +6,8 @@ description: Turn the steps you ran in wdio session into a spec, page objects an
 
 `export` writes a spec from the recorded steps. Refs are replaced with stable selectors. For a web page, the first of these that matches exactly one element is used: a test id (`data-testid`, `data-test`, `data-qa`), a [role selector](/docs/selectors#role-selector) such as `role/button[name="Add to cart"]`, an accessible name (`aria/Add to cart`), an id, the text of a button or link, a form field name, and finally a CSS path.
 
+A role selector or accessible name is skipped when the name the snapshot computed may not be the one the driver computes, for example a name next to an icon, with a non-breaking space or spread over block elements. This happens in WebDriver BiDi and in classic sessions, and the text or CSS path is used instead. When the element has no selector at all, such as one of several nameless buttons inside shadow roots, the action still runs on the ref. The step is recorded as `ref('e12')` with a comment: it replays in the session, but `export` stops with `Step N still contains ref()` until the step is removed or rewritten with a selector.
+
 ```sh
 npx wdio session export --out test/specs/cart.e2e.ts
 npx wdio run wdio.conf.ts --spec test/specs/cart.e2e.ts
```

#### Recent Merged Pull Requests:
- **PR #16279** (closed): fix(@wdio/mocha-framework): give the root hooks of beforeSuite and afterSuite their own title (@plum117)
- **PR #16274** (2026-10-27): fix(@wdio/cli, webdriver): load tsx on Node.js 18 and add the bidiConnectTimeout option (v9) (@plum117)
- **PR #16272** (2026-10-27): ci: auto-merge only minor and patch Dependabot updates on v9, and not on cancelled checks (@plum117)
- **PR #16271** (2026-10-27): ci: auto-merge only minor and patch Dependabot updates (@plum117)
- **PR #16270** (2026-10-27): docs(devtools): read a heading example.com still serves in the Selenium example (@vishnuv688)
- **PR #16269** (2026-10-27): chore: keep v9 on TypeScript 5 and make its unit tests pass with Vite 7 and globals 17.13 (@plum117)

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

## X. @wdio/vitest-framework): Introducing Vitest with parallel run and fixtures (#161

**RULE**:
When implementing operations in `packages/wdio-cli/src/launcher.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webdriverio/webdriverio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4257f55e`: @wdio/vitest-framework): Introducing Vitest with parallel run and fixtures (#16154). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/wdio-cli/src/launcher.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { fileURLToPath } from 'node:url'
import type { Capabilities, Frameworks, Services } from '@wdio/types'
const LAUNCHER_FRAMEWORKS = new Set(['vitest', '@wdio/vitest-framework'])

/** Vitest `provide` structured-clones the args into forked workers, and programmatic callers may pass functions or classes */
function cloneableEntries<T extends object>(args: T): Partial<T> {
    return Object.fromEntries(Object.entries(args).filter(([, value]) => {
        try {
            structuredClone(value)
            return true
        } catch {
            return false
        }
    })) as Partial<T>
}

    #frameworkAbort = new AbortController()
    #frameworkLaunch?: Promise<number>
        // Rejecting here keeps every hook, service and runner shutdown from running for a run that never starts
        const framework = await this.#loadFrameworkLauncher(config)
        if (framework) {
            this.#assertFrameworkSupportsRun(config.framework, caps)
        }

            if (framework && config.specFileRetries > 0) {
                log.warn('specFileRetries is not supported with this framework and is ignored')
            }
            // The framework schedules specs itself, so 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
import type { Capabilities, Services } from '@wdio/types'
            this.interface = new CLInterface(config, totalWorkerCnt, this._isWatchMode)
            exitCode = await this._runMode(config, caps)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4257f55e` are properly handled with clean fallback behavior.
