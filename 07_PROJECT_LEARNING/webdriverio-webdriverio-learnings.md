> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webdriverio-webdriverio-learnings.md`  
> **Source**: github ([https://github.com/webdriverio/webdriverio](https://github.com/webdriverio/webdriverio))  
> **Source Version**: `33a17ec7`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-07T21:55:45.844Z  
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
> **Harvest Timestamp**: 2026-11-07T21:55:45.632Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webdriverio/webdriverio`
- **Description**: Next-gen browser and mobile automation test framework for Node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9871 stars

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
    commandCallStructure as commandCallStructureOrig,
    specFilePath as specFilePathOrig
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
export const specFilePath = specFilePathOrig

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
- **Issue #16393** (2026-11-07): **ci: retry the Session apt download without the slow Azure mirror**
  *Symptoms*: ## Proposed changes  The Session E2E job (30 min limit) was cancelled 11 times since 2026-10-23, for example on main in [run 42202360126](https://github.com/webdriverio/webdriverio/actions/runs/42202360126) (step 11:05–11:35). The cause is the step "Ensure Xvfb and ffmpeg": `apt-get install ffmpeg` downloads 69 MB, and the Azure apt mirror sometimes sends at about 45 kB/s (normally 2.5 MB/s, 28 s).  The runner already has a mirror list (`/etc/apt/apt-mirrors.txt`: Azure, then `archive.ubuntu.com`, then `security.ubuntu.com`), but apt moves to the next mirror only on an error, not when a mirror is slow.  ```diff  sudo apt-get update -sudo apt-get install -y "${missing[@]}" +if ! sudo timeout 240 apt-get install -y --download-only "${missing[@]}"; then +  # warning, remove the Azure line from /etc/apt/apt-mirrors.txt +  sudo apt-get update +  sudo timeout 480 apt-get install -y --download-only "${missing[@]}" +fi +sudo apt-get install -y --no-download "${missing[@]}" ```  - The timeout stops only the download, never `dpkg`. The retry keeps the files that are already downloaded. - The step has `timeout-minutes: 15`, so a bad case fails the step clearly, and does not use all of the job time. - A normal run does not change: no warning, same mirror.  ## How you tested  The exact step text (from the workflow file) in `ubuntu:26.04` (amd64, Docker), with the runner mirror list. Mirror 1 is a local proxy, named like the Azure mirror, that sends `.deb` files at 40 kB/s:  | Case | Resul

- **Issue #16392** (2026-11-07): **test(webdriverio): make the waitForEnabled test of a removed element stable (v9, #16083)**
  *Symptoms*: ## Proposed changes  Backport of #16083 to `v9`. It fixes a flaky test that failed 4 times in v9 CI with `expected 2 to be 1`. Three of these runs:  | Run | Job | |---|---| | [40865503876](https://github.com/webdriverio/webdriverio/actions/runs/40865503876) (#16296) | Unit Test (ubuntu-latest, Node 20) | | [41551696791](https://github.com/webdriverio/webdriverio/actions/runs/41551696791) (push) | Unit Test (ubuntu-latest, Node 22) | | [41827166588](https://github.com/webdriverio/webdriverio/actions/runs/41827166588) (push) | Unit Test (macos-latest, Node 26) |  ``` FAIL staleElement.test.ts > one wait for an element that the page removed > waits once in waitForEnabled, with the error of the element as cause AssertionError: expected 2 to be 1 ```  **Cause:** `waitForEnabled` and the wait for the removed element both use `waitforTimeout` (100 ms in the test). Under load, the first wait for the element ends just after 100 ms, and the outer `waitUntil` still checks again: a second lookup and a second wait.  **Change:** same as #16083. The test uses `waitForEnabled({ timeout: 50 })`, which is shorter than the wait for the element. The test still proves one wait, the `cause`, and the error message.  **Not in this PR:** the same race exists in the product on `main` and `v9`. Under load, a `waitFor*` command on a removed element can take 2 × its timeout. A fix in `waitUntil`/`Timer` is a separate change.  ## How you tested  - `npx vitest run packages/webdriverio/tests/utils/staleElem

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

### Incident Patch 1: `c652768f` (2026-11-07)
**Commit Message**: fix(webdriverio): keep the BiDi context when switchToWindow fails (#16385)

* fix(webdriverio): keep the BiDi context when switchToWindow fails

The context manager sets the BiDi context to the handle of a
switchToWindow before the command runs. When the switch fails (the
handle is of a closed tab, or not a window), the driver stays in the
window it was in, but the context stayed on the failed handle. So
execute() failed with "no such frame - Context ... not found", and $()
and url() only worked through their WebDriver Classic fallbacks.

Keep the context from before the switch when it fails. Another switch
can be in flight at the same time, e.g. one that was not awaited, so
only the result for the same handle restores it, and only if no newer
transition changed the context.

* fix(webdriverio): keep a live BiDi context across overlapping failed switches

Two switchToWindow calls that overlap and both fail restored the
handle of the first one, which the driver never switched to. A frame
that was destroyed while a failed switch was pending was restored too.

Track the switches that have no result yet and the context the driver
is in while they run: the one before them, then the hand

**File**: `e2e/wdio/headless/bidi.e2e.ts` (modified, +33/-0)
```diff
@@ -752,4 +752,37 @@ describe('bidi e2e test', () => {
             }
         })
     })
+
+    describe('a switchToWindow that fails', () => {
+        const closedTab = async () => {
+            const { context } = await browser.browsingContextCreate({ type: 'tab' })
+            await browser.browsingContextClose({ context })
+            return context
+        }
+        const handles: [string, () => Promise<string>][] = [
+            ['the handle of a closed tab', closedTab],
+            ['a handle that is not a window', async () => 'not-a-window-handle']
+        ]
+
+        for (const [name, getHandle] of handles) {
+            it(`keeps the BiDi context in the window the driver stays in, for ${name}`, async function () {
+                if (!browser.isBidi) {
+                    return this.skip()
+                }
+
+                await browser.url('https://guinea-pig.webdriver.io/')
+                const original = await browser.getWindowHandle()
+                const title = await browser.execute(() => document.title)
+                const handle = await getHandle()
+
+                // geckodriver gives "Unable to locate window"
+                await expect(browser.switchToWindow(handle)).rejects.toThrow(/no such window|Unable to locate window/)
+                try {
+                    expect(await browser.execute(() => document.title)).toBe(title)
+                } finally {
+                    await browser.switchToWindow(original)
+                }
+            })
+        }
+    })
 })
```

**File**: `packages/webdriverio/src/session/context.ts` (modified, +117/-3)
```diff
@@ -120,6 +120,42 @@ export function getContextManager(browser: WebdriverIO.Browser) {
 
 export type FlatContextTree = Omit<local.BrowsingContextInfo, 'children'> & { children: string[] }
 
+interface WindowSwitches {
+    /**
+     * the `switchToWindow` commands without a result yet, in the order they were sent. A switch
+     * is superseded when one sent after it succeeds, or a newer transition sets the context.
+     */
+    pending: { handle: string, body: unknown, superseded?: boolean }[]
+    /**
+     * the context to go back to when the pending switches fail: the one before the switches
+     * (or that a newer transition set), then the handle of each switch that succeeds, in the
+     * order of the results
+     */
+    context?: string
+}
+
+/**
+ * The context that `switchToWindow` commands give: the target of the last one without a
+ * result yet that is not superseded, or else the context to go back to.
+ */
+function windowSwitchTarget ({ pending, context }: WindowSwitches) {
+    for (let i = pending.length - 1; i >= 0; i--) {
+        if (!pending[i].superseded) {
+            return pending[i].handle
+        }
+    }
+    return context
+}
+
+/**
+ * The pending switch a result is for. The command and the result event of a request share
+ * its body, so a switch to a handle that is pending more than once is still the right one.
+ */
+function findWindowSwitch ({ pending }: WindowSwitches, body: unknown, handle: string) {
+    const index = pending.findIndex((pendingSwitch) => pendingSwitch.body === body)
+    return index > -1 ? index : pending.findIndex((pendingSwitch) => pendingSwitch.handle === handle)
+}
+
 /**
  * This class is responsible for managing context in a WebDriver session. Many BiDi commands
  * require to be executed in a specific context. This class is responsible for keeping track
@@ -132,6 +168,10 @@ export class ContextManager extends SessionManager {
     #isNativeContext: boolean
     #getContextSupport = true
     #currentWindowHandle?: string
+    /**
+     * the `switchToWindow` commands without a result yet, and the context to go back to when they fail
+     */
+    #windowSwitches?: WindowSwitches
     #onCommandResultBidiAndClassicListener: (event: { command: string, result: unknown, body: unknown }) => void
     #onCommandListener: (event: { command: string, body: unknown, endpoint?: string }) => void
     #onCommandResultMobileListener: (event: { command: string, result: unknown }) => void
@@ -271,6 +311,16 @@ export class ContextManager extends SessionManager {
     }
 
     async #contextDestroyed(destroyed: local.BrowsingContextInfo) {
+        /**
+         * A `switchToWindow` that fails goes back to the context from before it. If that
+         * context is gone (e.g. the page removed the frame), the next command resolves the
+         * window the driver is in instead.
+         */
+        const switches = this.#windowSwitches
+        if (switches?.context && this.findContext(switches.context, [destroyed], 'byContextId')) {
+            switches.context = undefined
+        }
+
         /**
          * no need to do anything if the destroyed context is not the current one
          */
@@ -369,11 +419,43 @@ export class ContextManager extends SessionManager {
          * `switchToWindow` returns null on success, so the handle comes from the request body
          */
         if (event.command === 'switchToWindow') {
+            // the result of a wrapper, e.g. of an overwritten `switchToWindow`, has no body
+            const handle = (event.body as { handle?: unknown } | undefined)?.handle
+            if (typeof handle !== 'string') {
+                return
+            }
             const err = (event.result as { error?: unknown }).error || undefined
             // Only update current window handle when 'switchToWindow' has no error
             if (!err) {
-                const windowHandle = (event.body as { handle?: string }).handle || undefined
-                this.#currentWindowHandle = windowHandle
+                this.#currentWindowHandle = handle
+            }
+
+            const switches = this.#windowSwitches
+            const index = switches ? findWindowSwitch(switches, event.body, handle) : -1
+            if (switches && index > -1) {
+                // no newer transition changed the context while the switch ran
+                const unchanged = this.#currentContext === windowSwitchTarget(switches)
+                if (!err) {
+                    /**
+                     * The driver is in this window now. The results can come in another order
+                     * than the switches were sent, so a switch sent before this one is not where
+                     * commands go until its own result shows where the driver is.
+                     */
+                    switches.context = handle
+                    switches.pending.slice(0, index).forEach((pending) => { pending.superseded = true })
+                }
```

**File**: `packages/webdriverio/tests/session/context.test.ts` (modified, +204/-1)
```diff
@@ -134,10 +134,200 @@ describe('ContextManager', () => {
         const resultHandlers = getListeners().result
         const handler = resultHandlers![0]
         const error = new Error('no such window')
-        handler({ command: 'switchToWindow', result: { error } })
+        handler({ command: 'switchToWindow', body: { handle: 'closed-tab' }, result: { error } })
         expect(getContextManager(browser).getCurrentWindowHandle()).toBeUndefined()
     })
 
+    describe('a switchToWindow that fails in a BiDi session', () => {
+        const switchToWindow = { command: 'switchToWindow', body: { handle: 'closed-tab' } }
+        const setup = () => {
+            const wid = process.env.WDIO_UNIT_TESTS
+            delete process.env.WDIO_UNIT_TESTS
+            const stub = createBrowserStub({ isBidi: true } as any)
+            const manager = getContextManager(stub.browser)
+            process.env.WDIO_UNIT_TESTS = wid
+            manager.setCurrentContext('context-1')
+            const emit = (event: string, payload: unknown) => stub.getListeners()[event]!.forEach((handler) => handler(payload))
+            return { manager, emit, browser: stub.browser }
+        }
+
+        it('keeps the context that the driver stays in', async () => {
+            const { manager, emit } = setup()
+
+            emit('command', switchToWindow)
+            emit('result', { ...switchToWindow, result: { error: new Error('no such window') } })
+
+            expect(await manager.getCurrentContext()).toBe('context-1')
+        })
+
+        it('keeps the context of a switch that finished while it was in flight', async () => {
+            const { manager, emit } = setup()
+            // another switch that was not awaited
+            const remaining = { command: 'switchToWindow', body: { handle: 'remaining-window' } }
+
+            emit('command', remaining)
+            emit('command', switchToWindow)
+            emit('result', { ...remaining, result: { value: null } })
+            emit('result', { ...switchToWindow, result: { error: new Error('no such window') } })
+
+            expect(await manager.getCurrentContext()).toBe('remaining-window')
+        })
+
+        it('keeps the context from before overlapping switches that both fail', async () => {
+            const { manager, emit } = setup()
+            // another switch that was not awaited
+            const other = { command: 'switchToWindow', body: { handle: 'other-closed-tab' } }
+
+            emit('command', other)
+            emit('command', switchToWindow)
+            emit('result', { ...other, result: { error: new Error('no such window') } })
+            emit('result', { ...switchToWindow, result: { error: new Error('no such window') } })
+
+            expect(await manager.getCurrentContext()).toBe('context-1')
+        })
+
+        describe('with the results of overlapping switches in reverse order', () => {
+            const other = { command: 'switchToWindow', body: { handle: 'other-window' } }
+
+            it('uses the window of a switch that succeeds after a later one failed', async () => {
+                const { manager, emit } = setup()
+
+                emit('command', other)
+                emit('command', switchToWindow)
+                emit('result', { ...switchToWindow, result: { error: new Error('no such window') } })
+                // the other switch has no result yet, so its window is the context until then
+                expect(await manager.getCurrentContext()).toBe('other-window')
+                emit('result', { ...other, result: { value: null } })
+
+                expect(await manager.getCurrentContext()).toBe('other-window')
+            })
+
+            it('keeps the context from before both switches when both fail', async () => {
+                const { manager, emit } = setup()
+
+                emit('command', other)
+                emit('command', switchToWindow)
+                emit('result', { ...switchToWindow, result: { error: new Error('no such window') } })
+                emit('result', { ...other, result: { error: new Error('no such window') } })
+
+                expect(await manager.getCurrentContext()).toBe('context-1')
+            })
+
+            it('keeps the window of a later switch that succeeds before an earlier one', async () => {
+                const { manager, emit } = setup()
+
+                emit('command', switchToWindow)
+                emit('command', other)
+                emit('result', { ...other, result: { value: null } })
+                // a command after the awaited switch, before the earlier switch has a result
+                expect(await manager.getCurrentContext()).toBe('other-window')
+                emit('result', { ...switchToWindow, result: { error: new Error('no such window') } })
+
+                expect(await manager.getCurrentContext()).toBe('other-window')
+            })
+
+            it('uses the window of an earlier switch th
```

---

### Incident Patch 2: `19159e04` (2026-11-06)
**Commit Message**: docs: add the missing v9 to v10 changes, with small reporter and template fixes (#16369)

* docs: add the missing v9 to v10 changes to the migration guide and skill

The commits since v10.1.0 changed behavior that a v9 project can see, and
the guide and the skill did not have it. Also add the guide items that had
no skill row, and correct the pages that omit or contradict Vitest, the
Cucumber strict default, connectionRetryCount and undici 8.

* docs: correct the review findings and add the smaller doc gaps

Correct the shared store, JSON reporter, Cucumber event, W3C retry and
--shard text, name expect.assertSoftFailures(), and complete the skill rows.
Add the smaller gaps: Vitest in the remaining pages, reporter API, html and
video READMEs, peer dependency notes, --exclude rules, and JSDoc of mock,
mockRestoreAll and setCookies. Remove the STRICT_SSL text: nothing reads it.
Source files change in comments only.

* fix(create-wdio, @wdio/video-reporter, @wdio/session): match the strict default and correct two messages

New Cucumber projects get strict: true, so they follow the new default.
The video reporter warning names its own limit: Allure supports Cucumber
parallel mode. The 

**File**: `.agents/skills/wdio-v10-migration/SKILL.md` (modified, +26/-2)
```diff
@@ -45,6 +45,8 @@ Do not set `strictSelectors: false` unless the user asks to keep the v9 behavior
 | `jasmineNodeOpts` | `jasmineOpts`. Setting the old key throws. |
 | `jasmineOpts.failFast` | `jasmineOpts.stopOnSpecFailure`. A leftover `failFast` is ignored. Cucumber's `failFast` stays. |
 | `jasmineOpts.stopSpecOnExpectationFailure` | `jasmineOpts.oneFailurePerSpec`. Setting the old key throws. |
+| `expect-webdriverio/jasmine-wdio-expect-async` in `tsconfig.json` `types` | remove it, and add `jasmine`. |
+| `.then()` or `.catch()` on a Jasmine sync matcher, such as `expect(total).toBe(3).then(...)` | call it without them: a sync matcher returns `undefined`. |
 | `cucumberOpts.tagExpression` | `cucumberOpts.tags`. Setting the old key throws. |
 | a Cucumber suite with pending steps that passed (no `cucumberOpts.strict`) | `strict` now defaults to `true`, as in Cucumber: set `cucumberOpts.strict: false` to keep the v9 behavior. Values in a Cucumber profile or config file (also a default `cucumber.js` in the working folder) are now used; a value in `cucumberOpts` wins over them. The `require` and `import` lists of the profile are loaded too; its `paths`, `requireModule` and `loader` are not used (use `specs` and `cucumberOpts.requireModule`), and a folder in its `require` / `import` is not loaded (use a glob). Remove an unused Cucumber config file, or set `cucumberOpts.file: false`. |
 | a report that expects no hook for a Cucumber `BeforeAll` / `AfterAll`, or the commands and logs of an `AfterAll` on the last step | a `BeforeAll` / `AfterAll` is now a hook of the feature, passed or failed, and its commands and logs belong to it. Allure shows a fixture for each one (`disableMochaHooks: true` hides the passed ones), `@wdio/json-reporter` lists it in the feature `hooks`. |
@@ -53,7 +55,7 @@ Do not set `strictSelectors: false` unless the user asks to keep the v9 behavior
 | `mochaOpts.compilers` | `mochaOpts.require`. A leftover `compilers` list is ignored. |
 | a script or report filter that matches `wrappedHook` in a Mocha hook title | the title has the hook description or function name (`"before each" hook: login for "my test"`), or no name for an anonymous hook (`"before each" hook for "my test"`) |
 | `this.timeout(ms)` in a Mocha test | keep it. WebdriverIO now follows it (v9 ignored `this.timeout()` inside a test), and `mochaOpts.timeout: 0` turns the timeout off. The `retry` argument does not run a test again after a timeout. For `mochaOpts.parallelMode`, see the guide. |
-| New in v10, no migration needed | [parallel tests in a spec file](https://webdriver.io/docs/parallel-tests.md) with `mochaOpts.parallelMode` or `cucumberOpts.parallelMode`. |
+| New in v10, no migration needed | [parallel tests in a spec file](https://webdriver.io/docs/parallel-tests.md) with `mochaOpts.parallelMode` or `cucumberOpts.parallelMode`, and [`@wdio/vitest-framework`](https://webdriver.io/docs/frameworks.md#using-vitest) with `framework: 'vitest'`. |
 | `multiremotebrowser` | `multiRemoteBrowser` |
 | `browser.isMultiremote`, `isMultiremote` | `isMultiRemote` |
 | `multiremote(` | `multiRemote(` |
@@ -63,9 +65,11 @@ Do not set `strictSelectors: false` unless the user asks to keep the v9 behavior
 | Sauce `tunnelIdentifier` / `parentTunnel` | `tunnelName` / `tunnelOwner` |
 | `import type { Element }` from `webdriverio` | `WebdriverIO.Element` (also `MultiRemoteBrowser`, `MultiRemoteElement`) |
 | `onAfterCommand` argument `name` | `command` |
+| a custom reporter that ends a Cucumber test in `onTestPass` / `onTestFail`, or counts a retried step in `onTestFail` | finish the work in `onTestEnd`: sequential Cucumber now sends it. A failed step of a retried attempt calls `onTestRetry`. A scenario attempt retried with `scenarioLevelReporter` gets `onTestRetry` and no `onTestEnd`: finish its work there. |
+| a script or filter on the JUnit `classname` or `capabilities` of a multi-remote test | the value now names each instance and its browser. Before, it was empty. See the guide. |
 | a `beforeCommand` / `afterCommand` hook that expects an element command 2 or 3 times, `[]` as `args`, or an `emit` command | the hooks run once for each element command, with its arguments, and not for `emit`. `beforeCommand` runs before the wait for the element: read the found element in `afterCommand`. |
 | `wdio-video-reporter` | `@wdio/video-reporter`. Uninstall the old package. `reporters: ['video']` stays. Install ffmpeg on every machine that runs the tests (also CI and Docker), or set `ffmpegPath`: v10 does not install it. Rename JSON Wire Protocol names in `snapshotCommands` (see the guide). `GET` commands (for example `getUrl`) give no frame. |
-| `wdio-html-nice-reporter`, reporter name `html-nice` | `@wdio/html-reporter`, reporter name `html`. Uninstall the old package. `@rpii/wdio-report-events` can become `ReportEvents` from `@wdio/html-reporter`. `lib/makeReport.js` is `build/makeReport.js`. |
+| `wdio-html-nice-reporter`, reporte
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -139,6 +139,7 @@ Adapters that bring the WebdriverIO DevTools UI to test suites running outside W
 - [@wdio/cucumber-framework](https://github.com/webdriverio/webdriverio/tree/main/packages/wdio-cucumber-framework) - Adapter for [Cucumber](https://cucumber.io/) testing framework
 - [@wdio/jasmine-framework](https://github.com/webdriverio/webdriverio/tree/main/packages/wdio-jasmine-framework) - Adapter for [Jasmine](https://jasmine.github.io/) testing framework
 - [@wdio/mocha-framework](https://github.com/webdriverio/webdriverio/tree/main/packages/wdio-mocha-framework) - Adapter for [Mocha](https://mochajs.org/) testing framework.
+- [@wdio/vitest-framework](https://github.com/webdriverio/webdriverio/tree/main/packages/wdio-vitest-framework) - Adapter for [Vitest](https://vitest.dev/) testing framework.
 
 ### Others
 
```

**File**: `e2e/AGENTS.md` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ pnpm run test:e2e:display-server # @wdio/display-server
 pnpm run test:e2e:chromedriver # Chromedriver setup; needs CHROMIUM_130_BINARY (see test-chromedriver.yml)
 pnpm run test:e2e:cucumberjs-json-reporter # @wdio/cucumberjs-json-reporter in Chrome, with its multiple-cucumber-html-reporter report (local only)
 pnpm run test:e2e:video-reporter # @wdio/video-reporter + Allure in Chrome; needs ffmpeg on PATH (also in the CI testrunner lane)
-pnpm run test:e2e:video-reporter-parallel # the same in Mocha parallel mode: one video per test, no frame of another test
+pnpm run test:e2e:video-reporter-parallel # the same in Mocha and Cucumber parallel mode: one video per test, no frame of another test
 pnpm run test:e2e:html-reporter # @wdio/html-reporter in Chrome (local only)
 pnpm run test:e2e:html-reporter-parallel # the same in Mocha and Cucumber parallel mode: each log and screenshot under its test (also in the CI testrunner lane)
 pnpm run test:e2e:cloud        # Sauce — needs credentials, main-branch CI
```

**File**: `e2e/wdio/reporters/video/colorServer.ts` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ export function startColorServer () {
 }
 
 /**
- * the 2 colors of each test of `video.parallel.e2e.ts`
+ * the 2 colors of each test of `video.parallel.e2e.ts` and each scenario of `video.parallel.feature`
  */
 export const COLORS = {
     'red test': ['ff0000', '800000'],
```

**File**: `e2e/wdio/reporters/video/video.parallel.feature` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+Feature: parallel videos
+
+  Scenario: red test
+    Given I open the page of "red test"
+    When I wait 600 ms
+    And I click the button
+    Then I wait 300 ms
+
+  Scenario: blue test
+    Given I open the page of "blue test"
+    When I wait 100 ms
+    And I click the button
+    Then I wait 300 ms
+
+  Scenario: green test
+    Given I open the page of "green test"
+    When I wait 400 ms
+    And I click the button
+    Then I wait 300 ms
+
+  Scenario: yellow test
+    Given I open the page of "yellow test"
+    When I click the button of "yellow test" in a new tab
+    Then I click the button
```

**File**: `e2e/wdio/reporters/video/video.parallel.steps.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { Given, When } from '@wdio/cucumber-framework'
+import { browser, $ } from '@wdio/globals'
+
+import { COLORS } from './colorServer.js'
+
+const urlOf = (from: string, to: string) => `${process.env.VIDEO_COLOR_ORIGIN}/${from}?to=${to}`
+const colorsOf = (test: string) => COLORS[test as keyof typeof COLORS]
+
+Given(/^I open the page of "([^"]+)"$/, async (test: string) => {
+    const [from, to] = colorsOf(test)
+    await browser.url(urlOf(from, to))
+})
+
+When(/^I wait (\d+) ms$/, async (ms: string) => {
+    await browser.pause(Number(ms))
+})
+
+When(/^I click the button$/, async () => {
+    await $('#btn').click()
+})
+
+// a tab of the scenario: its frames belong to the scenario
+When(/^I click the button of "([^"]+)" in a new tab$/, async (test: string) => {
+    const [from, to] = colorsOf(test)
+    const tab = await browser.newWindow(urlOf(to, from), { type: 'tab' }) as WebdriverIO.BrowsingContext
+    await tab.$('#btn').click()
+    await tab.closeWindow()
+})
```

**File**: `e2e/wdio/reporters/video/wdio.parallel.cucumber.conf.ts` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import url from 'node:url'
+import path from 'node:path'
+
+import { config as mochaConfig } from './wdio.parallel.conf.js'
+
+const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
+
+/**
+ * The checks of `wdio.parallel.conf.ts` in Cucumber parallel mode: one video for each
+ * scenario, no frame of another scenario, and each Allure video is the video of its scenario.
+ */
+export const config: WebdriverIO.Config = {
+    ...mochaConfig,
+    specs: [path.join(__dirname, 'video.parallel.feature')],
+    framework: 'cucumber',
+    cucumberOpts: {
+        require: [path.join(__dirname, 'video.parallel.steps.ts')],
+        timeout: 60000,
+        parallelMode: 'contexts',
+        maxParallelContexts: 4
+    }
+}
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@
     "test:e2e:chromedriver": "cd ./e2e && npx wdio run ./wdio/chromedriver/wdio.conf.ts",
     "test:e2e:cucumberjs-json-reporter": "cd ./e2e && npx wdio run ./wdio/reporters/cucumberjs-json/wdio.conf.ts",
     "test:e2e:video-reporter": "cd ./e2e && npx wdio run ./wdio/reporters/video/wdio.conf.ts",
-    "test:e2e:video-reporter-parallel": "cd ./e2e && npx wdio run ./wdio/reporters/video/wdio.parallel.conf.ts",
+    "test:e2e:video-reporter-parallel": "cd ./e2e && npx wdio run ./wdio/reporters/video/wdio.parallel.conf.ts && npx wdio run ./wdio/reporters/video/wdio.parallel.cucumber.conf.ts",
     "test:e2e:html-reporter": "cd ./e2e && npx wdio run ./wdio/reporters/html/wdio.conf.ts",
     "test:e2e:html-reporter-parallel": "cd ./e2e && node ./wdio/reporters/html/checkParallel.mjs",
     "test:e2e": "run-s test:e2e:* ",
```

---

### Incident Patch 3: `6580f356` (2026-11-05)
**Commit Message**: fix(shared-store): preserve stored null values (#16360)

Return the stored value directly from getValue and getValueFromPool so null is preserved. Missing keys still return undefined.

Add strict null assertions and falsy-value coverage. Validated with 45 package tests, the sharedStoreServiceTest smoke suite (7 passing), test:changed and Node 24 agent setup/doctor.

Co-authored-by: David Prévost <[REDACTED_EMAIL]>

**File**: `packages/wdio-shared-store-service/src/client.ts` (modified, +2/-2)
```diff
@@ -36,7 +36,7 @@ export const getValue = async (key: string): Promise<string | number | boolean |
         headers
     }).catch(errHandler)
     const responseBody = await res.json()
-    return responseBody.value ?? undefined
+    return responseBody.value
 }
 
 /**
@@ -88,7 +88,7 @@ export const getValueFromPool = async (key: string, options?: GetValueOptions) =
         headers
     }).catch(errHandler)
     const responseBody = await res.json()
-    return responseBody.value ?? undefined
+    return responseBody.value
 }
 
 /**
```

**File**: `packages/wdio-shared-store-service/tests/client.test.ts` (modified, +15/-0)
```diff
@@ -99,6 +99,16 @@ describe('client', () => {
             expect(result).toBeUndefined()
         })
 
+        it.each([null, false, 0, ''])('should return a stored %j value as is', async (value) => {
+            vi.mocked(fetch).mockResolvedValueOnce(Response.json({ value }))
+            expect(await getValue('foo')).toBe(value)
+        })
+
+        it('should return undefined if the response has no value', async () => {
+            vi.mocked(fetch).mockResolvedValueOnce(Response.json({}))
+            expect(await getValue('foo')).toBeUndefined()
+        })
+
         it('should throw an error on get error', async () => {
             await expect(() => getValue('fail')).rejects.toThrowError('Mock error')
         })
@@ -141,6 +151,11 @@ describe('client', () => {
                 })
                 expect(result).toEqual('getResult')
             })
+
+            it.each([null, false, 0, ''])('should return a %j value from the pool as is', async (value) => {
+                vi.mocked(fetch).mockResolvedValueOnce(Response.json({ value }))
+                expect(await getValueFromPool('foo')).toBe(value)
+            })
         })
 
         describe('and when /pool/get fails', () => {
```

**File**: `tests/mocha/shared-store-service.js` (modified, +6/-1)
```diff
@@ -21,7 +21,7 @@ describe('Shared store service', () => {
         assert.equal(await browser.sharedStore.get('boolean'), true)
         assert.equal(await browser.sharedStore.get('number'), 123)
         assert.equal(await browser.sharedStore.get('string'), 'foobar')
-        assert.equal(await browser.sharedStore.get('null'), null)
+        assert.strictEqual(await browser.sharedStore.get('null'), null)
     })
 
     it('should be able to fetch all key/value pairs', async () => {
@@ -64,4 +64,9 @@ describe('Shared store service', () => {
             assert.equal(await browser.sharedStore.getValueFromPool(key), `pool value of ${key}`)
         }
     })
+
+    it('should return a null value from the resource pool', async () => {
+        await browser.sharedStore.setResourcePool('null-pool', [null])
+        assert.strictEqual(await browser.sharedStore.getValueFromPool('null-pool'), null)
+    })
 })
```

#### Recent Merged Pull Requests:
- **PR #16393** (2026-11-07): ci: retry the Session apt download without the slow Azure mirror (@plum117)
- **PR #16392** (2026-11-07): test(webdriverio): make the waitForEnabled test of a removed element stable (v9, #16083) (@plum117)
- **PR #16385** (2026-11-07): fix(webdriverio): keep the BiDi context when switchToWindow fails (@DanLambe)
- **PR #16373** (2026-11-06): chore(deps): bump the minor-deps-updates-main group across 1 directory with 11 updates (@dependabot[bot])
- **PR #16372** (2026-11-07): chore(deps): bump minimatch from 10.2.5 to 11.0.5 (@dependabot[bot])
- **PR #16371** (2026-11-06): test: keep the automocks of @wdio/utils and @wdio/local-runner on Vitest 5.1 (@plum117)

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

## X. webdriverio): keep the BiDi context when switchToWindow fails (#16385)

**RULE**:
When implementing operations in `e2e/wdio/headless/bidi.e2e.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webdriverio/webdriverio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c652768f`: webdriverio): keep the BiDi context when switchToWindow fails (#16385). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `e2e/wdio/headless/bidi.e2e.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

    describe('a switchToWindow that fails', () => {
        const closedTab = async () => {
            const { context } = await browser.browsingContextCreate({ type: 'tab' })
            await browser.browsingContextClose({ context })
            return context
        }
        const handles: [string, () => Promise<string>][] = [
            ['the handle of a closed tab', closedTab],
            ['a handle that is not a window', async () => 'not-a-window-handle']
        ]

        for (const [name, getHandle] of handles) {
            it(`keeps the BiDi context in the window the driver stays in, for ${name}`, async function () {
                if (!browser.isBidi) {
                    return this.skip()
                }

                await browser.url('https://guinea-pig.webdriver.io/')
                const original = await browser.getWindowHandle()
                const title = await browser.execute(() => document.title)
                const handle = await getHandle()

                // geckodriver gives "Unable to locate window"
                await expect(browser.switchToWindow(handle)).rejects.toThrow(/no such window|Unable to locate window/)
                try 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c652768f` are properly handled with clean fallback behavior.
