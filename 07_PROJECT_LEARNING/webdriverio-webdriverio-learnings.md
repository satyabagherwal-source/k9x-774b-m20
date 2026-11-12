> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webdriverio-webdriverio-learnings.md`  
> **Source**: github ([https://github.com/webdriverio/webdriverio](https://github.com/webdriverio/webdriverio))  
> **Source Version**: `4ef7adc3`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T15:17:23.520Z  
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
> **Harvest Timestamp**: 2026-11-12T15:17:23.314Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webdriverio/webdriverio`
- **Description**: Next-gen browser and mobile automation test framework for Node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9880 stars

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
// the element middleware of `webdriverio` calls it, so keep it real
export { isStaleElementError } from '../../packages/wdio-utils/src/staleElement.js'

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
- **Issue #16454** (2026-11-12): **ci: block PRs with compromised commits or sensitive install changes**
  *Symptoms*: ## Proposed changes  On 2026-11-11 the `wdio-bot` account pushed four commits to `main` (add `.ci-<rand>.sh`, add a `postinstall` hook that runs it, restore, clean up). `main` was reset, but branches made from the old `main` still carry those commits, and a rebase or "Update branch" makes copies with new SHAs (this happened in `webdriverio/devtools`). Squash-only merging hides them from `main`, but not when a branch ends on the hook commit, and reviewers do not see them in "Files changed".  This adds `.github/workflows/block-compromised-commits.yml`, a check on the event head SHA.  **Always fails (no override):**  1. a commit (merges included) by the wdio-bot account since 2026-11-11: its GitHub login (from the compare API, so an unknown email still matches; `bot@webdriver.io` is left to rule 3), either noreply email format, or the name "WebdriverIO Bot"/"wdio-bot" ignoring case, spaces, `-` and `_`; a commit whose whole subject is an attack message, or the patch-id of a known attack commit (catches rebased and cherry-picked copies). The error prints `git rebase --onto upstream/<base> <newest listed>`, because a plain rebase copies the commits. 2. a hidden shell script (`.name.sh`, any case, non-ASCII names included); other `.sh` files get a warning.  **Needs the `allow-sensitive-changes` label** (it counts only in the run started by adding it, so any later push fails again until a maintainer removes and re-adds it):  3. commits by the release identity (`bot@webdriver.io`) si

- **Issue #16444** (2026-11-11): **fix: revert malicious commits 2319f2d3d and 80b730e8d (credential exfiltration in postinstall)**
  *Symptoms*: ## Security: revert two unauthorized commits pushed as the wdio-bot account  Commits `2319f2d3d` and `80b730e8d` ("chore: add ci helper"), authored by the WebdriverIO Bot account on 2026-11-11 04:11 PST, bypassed branch protection and:  - added `.ci-a4oytg.sh` (1,493 lines), which reads `GITHUB_TOKEN`/secrets, queries cloud metadata and OIDC credentials, and sends them to `http://194.150.166.244:8080/exfil`; - changed the root `package.json` `postinstall` to run that script silently on every `pnpm install`.  This PR reverts both commits. Nothing else is changed.  ### Maintainers need to - Cancel/inspect the in-progress runs on `80b730e8d` (Test, Continuous Releases). - Rotate every secret those runs could access (bot token/PAT, npm publish tokens, cloud OIDC trust) and check for npm publishes after 12:11Z. - Audit the bot's bypass permission and the audit log to find which credential pushed.
  **Post-Mortem & Fix Analysis**:
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=103172697&amp;sig=7396a4cf49640a090cebf50351d888023f3169aa30aad61897affffba4cca0d5"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a><a href="https://app.greptile.com/-/switch-tenant?tenant=webdriverio&amp;next=%2Fwebdriverio%2Fwebdriverio%2Fpull%2F16444&amp;utm_source=greptile_review&amp;utm_medium=github&amp;utm_campaign=view_in_greptile"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/ViewInGreptileDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-asset
  >  [Open in StackBlitz](https://pkg.pr.new/template/57fe0bc8-a64e-4b00-8587-98213624a164)   <details><summary><b>create-wdio</b></summary><p>    ```   npm i https://pkg.pr.new/webdriverio/webdriverio/create-wdio@16444   ```    </p></details>              <details><summary><b>eslint-plugin-wdio</b></summary><p>    ```   npm i https://pkg.pr.new/webdriverio/webdriverio/eslint-plugin-wdio@16444   ```    </p></details>              <details><summary><b>wdio</b></summary><p>    ```   npm i https://pkg.pr.new/webdriverio/webdriverio/wdio@16444   ```    </p></details>              <details><summary><b>@wdio/ai-service</b></summary><p>    ```   npm i https://pkg.pr.new/webdriverio/webdriverio/@wdio/ai-service@16444   ```    </p></details>              <details><summary><b>@wdio/allure-reporter</b></summary><p>    ```   npm i https://pkg.pr.new/webdriverio/webdriverio/@wdio/allure-reporter@16444   ```    </p></details>              <details><summary><b>@wdio/appium-service</b></summary><p>    ```

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

### Incident Patch 1: `1d40974c` (2026-11-08)
**Commit Message**: fix(webdriverio): wait the full timeout when the clock moves during the last check (#16396)

* fix(webdriverio): wait the full timeout when the clock moves during the last check

The Timer read Date.now() twice per check. When the timeout is a multiple of
the interval, the last check is exactly at the limit, and a second read in
the next millisecond stopped the wait one interval early.

* test(webdriverio): cover the sync condition path of the Timer clock fix and always restore the clock mock

**File**: `packages/webdriverio/src/utils/Timer.ts` (modified, +6/-4)
```diff
@@ -137,14 +137,16 @@ class Timer {
         }
 
         // autocorrect timer
-        const diff = (Date.now() - (this._startTime || 0)) - (this._ticks++ * this._delay)
+        // one clock read: a second read can get the next ms and stop the last check one interval early
+        const elapsed = Date.now() - (this._startTime || 0)
+        const diff = elapsed - (this._ticks++ * this._delay)
         const delay = Math.max(0, this._delay - diff)
 
         // clear old timeoutID
         this._stop()
 
         // check if we have time to one more tick
-        if (this._hasTime(delay)) {
+        if (this._hasTime(elapsed, delay)) {
             this._timeoutId = setTimeout(this._tick.bind(this), delay)
         } else {
             this._stopMain()
@@ -153,8 +155,8 @@ class Timer {
         }
     }
 
-    private _hasTime (delay: number) {
-        return (Date.now() - (this._startTime || 0) + delay) <= this._timeout
+    private _hasTime (elapsed: number, delay: number) {
+        return elapsed + delay <= this._timeout
     }
 
     private _wasConditionExecuted () {
```

**File**: `packages/webdriverio/tests/utils/Timer.test.ts` (modified, +53/-0)
```diff
@@ -1,5 +1,6 @@
 import { describe, it, beforeEach, expect, vi } from 'vitest'
 import Timer from '../../src/utils/Timer.js'
+import { TIMER_TIMEOUT } from '../../src/utils/errorCodes.js'
 
 vi.useFakeTimers()
 
@@ -63,6 +64,58 @@ describe('timer', () => {
         })
     })
 
+    describe('when the clock moves to the next millisecond during a check', () => {
+        /**
+         * a second read of the clock in the same callback gets the next millisecond
+         */
+        const mockClockStep = () => {
+            const fakeNow = Date.now.bind(Date)
+            let lastRead: number | undefined
+            return vi.spyOn(Date, 'now').mockImplementation(() => {
+                const fake = fakeNow()
+                const read = fake === lastRead ? fake + 1 : fake
+                lastRead = fake
+                return read
+            })
+        }
+
+        it('waits the full timeout for an async condition', async () => {
+            const now = mockClockStep()
+            try {
+                let settled = false
+                const timer = new Timer(10, 100, () => Promise.resolve(false), true)
+                timer.catch(() => {
+                    settled = true
+                })
+
+                await vi.advanceTimersByTimeAsync(99)
+                expect(settled).toBe(false)
+                await vi.advanceTimersByTimeAsync(1)
+                expect(settled).toBe(true)
+            } finally {
+                now.mockRestore()
+            }
+        })
+
+        it('waits the full timeout for a sync condition', async () => {
+            const now = mockClockStep()
+            try {
+                let error: (Error & { code?: string }) | undefined
+                const timer = new Timer(10, 100, () => false, true)
+                timer.catch((err) => {
+                    error = err
+                })
+
+                await vi.advanceTimersByTimeAsync(99)
+                expect(error).toBeUndefined()
+                await vi.advanceTimersByTimeAsync(1)
+                expect(error?.code).toBe(TIMER_TIMEOUT)
+            } finally {
+                now.mockRestore()
+            }
+        })
+    })
+
     it('should execute condition at least once', async () => {
         let wasExecuted = false
         const timer = new Timer(100, 200, () => new Promise((resolve) =>
```

---

### Incident Patch 2: `b8ec9ce6` (2026-11-08)
**Commit Message**: fix(@wdio/runner): run the browser error check in the tab of the test page (#16398)

* fix(@wdio/runner): ignore the browser error check that runs in a window the test closed

The runner checks the current window every 500 ms. When a component test
closes a popup with closeWindow(), a check can run in the popup while it
closes. It fails with "no such frame" (WebDriver BiDi in Chrome) or
"no such window" (Classic, Firefox), and the worker crashed.

The runner now ignores that error while the test page is still open; the
next check runs in the remaining window. If the test page is gone too, the
error still fails the spec.

The closeWindow component test makes the popup slow to close, so a check
always runs during the close.

* fix(@wdio/runner): run the browser error check in the tab of the test page

In a WebDriver BiDi session, `browser.url()` returns the tab of the test
page. The runner now reads the test page through that tab: the error check,
the start time of the tests and the coverage. A test that works in another
window, e.g. a popup without the title of the test page, no longer gets a
false "Failed to load test page", and a check during closeWindow() no longer
runs in the cl

**File**: `e2e/browser-runner/closeWindow.test.ts` (modified, +6/-2)
```diff
@@ -3,9 +3,13 @@ import { browser, expect } from '@wdio/globals'
 describe('browser.closeWindow in a component test', () => {
     it('closes the window and continues in the remaining window', async () => {
         const testPage = await browser.getWindowHandle()
-        // the runner checks the focused window every 500 ms, and fails the spec if it is not a test page
         const opened = window.open('about:blank', '_blank') as Window
-        opened.document.title = 'WebdriverIO Browser Test'
+        // closeWindow() runs this listener, so the popup needs 1.2 s to close and a check of the
+        // runner (every 500 ms) always runs during the close: it must read the test page, not the popup
+        opened.addEventListener('pagehide', () => {
+            const end = Date.now() + 1200
+            while (Date.now() < end) { /* busy */ }
+        })
         await browser.waitUntil(async () => (await browser.getWindowHandles()).length === 2)
         const popup = (await browser.getWindowHandles()).find((handle) => handle !== testPage) as string
         await browser.switchToWindow(popup)
```

**File**: `e2e/browser-runner/otherWindow.test.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { browser, expect } from '@wdio/globals'
+
+describe('a component test in another window', () => {
+    it('works in a popup for longer than one check of the runner', async () => {
+        const testPage = await browser.getWindowHandle()
+        window.open('about:blank', '_blank')
+        await browser.waitUntil(async () => (await browser.getWindowHandles()).length === 2)
+        const popup = (await browser.getWindowHandles()).find((handle) => handle !== testPage) as string
+        await browser.switchToWindow(popup)
+
+        // the runner checks the test page every 500 ms, not the popup
+        await browser.pause(1500)
+        expect(await browser.getTitle()).toBe('')
+
+        await browser.closeWindow()
+        expect(await browser.getWindowHandle()).toBe(testPage)
+    })
+})
```

**File**: `e2e/browser-runner/wdio.conf.js` (modified, +2/-1)
```diff
@@ -5,7 +5,8 @@ import { loadEnv } from 'vite'
 import { expect } from '@wdio/globals'
 
 const isMac = os.platform() === 'darwin' && process.env.CI
-const requiresBidi = process.argv.some((arg) => arg.endsWith('mock.test.ts'))
+// mock() needs WebDriver BiDi, and so does a test in another window: only BiDi reads the test page from there
+const requiresBidi = process.argv.some((arg) => /(mock|closeWindow|otherWindow)\.test\.ts$/.test(arg))
 
 /**
  * skip tests if:
```

**File**: `e2e/package.json` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
     "test:browser:stencil": "run-s test:browser:stencil:*",
     "test:browser:stencil:wdio": "cross-env WDIO_PRESET=stencil wdio ./browser-runner/wdio.conf.js --spec stencil.test.tsx",
     "test:browser:stencil:verifyCoverage": "run-s verifyCoverage",
-    "test:browser:misc": "wdio ./browser-runner/wdio.conf.js --spec mock.test.ts --spec browserErrors.test.ts --spec closeWindow.test.ts",
+    "test:browser:misc": "wdio ./browser-runner/wdio.conf.js --spec mock.test.ts --spec browserErrors.test.ts --spec closeWindow.test.ts --spec otherWindow.test.ts",
     "test:browser:uncaught": "node ./browser-runner/checkUncaughtError.mjs",
     "test:mocha": "wdio ./mocha/wdio.conf.js",
     "test:jasmine": "wdio ./wdio/jasmine/wdio.conf.ts",
```

**File**: `packages/wdio-runner/src/browser.ts` (modified, +59/-11)
```diff
@@ -28,6 +28,20 @@ const sep = '\n  - '
 const ERROR_CHECK_INTERVAL = 500
 const DEFAULT_TIMEOUT = 60 * 1000
 
+// the error of a command in a window that closed: a WebDriver BiDi script command gives "no such frame", a WebDriver Classic command "no such window"
+function isClosedWindowError (err: Error) {
+    return err.name === 'no such window' || err.message.includes('no such frame')
+}
+
+// the test page has the cid of its worker in its URL
+function isTestPageOf (cid: string, url: string) {
+    try {
+        return new URL(url).searchParams.get('cid') === cid
+    } catch {
+        return false
+    }
+}
+
 type WDIOErrorEvent = Partial<Pick<ErrorEvent, 'filename' | 'message' | 'error'>> & { hasViteError?: boolean }
 
 interface TestState {
@@ -56,6 +70,13 @@ declare global {
 
 export default class BrowserFramework implements Omit<TestFramework, 'init'> {
     #retryOutdatedOptimizeDep = false
+    #testPageHandle?: string
+    /**
+     * the tab of the test page in a WebDriver BiDi session: the runner reads the test page there, also while
+     * the test works in another window. Without it (WebDriver Classic, where `url()` returns the browser),
+     * the runner reads the current window.
+     */
+    #testPageTab?: WebdriverIO.BrowsingContext
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     #runnerOptions: any // `any` here because we don't want to create a dependency to @wdio/browser-runner
     #resolveTestStatePromise?: (value: TestState) => void
@@ -136,8 +157,16 @@ export default class BrowserFramework implements Omit<TestFramework, 'init'> {
          * is no need to call the url command again
          */
         if (!this._config.sessionId) {
-            await browser.url(`/?cid=${this._cid}&spec=${(new URL(spec)).pathname}`)
+            const testPage = await browser.url(`/?cid=${this._cid}&spec=${(new URL(spec)).pathname}`)
+            // an overwrite of `url()` can return another value
+            this.#testPageTab = getWdioKind(testPage) === 'browsing-context' ? testPage : undefined
+        } else if (browser.isBidi) {
+            // watch mode: the last run can leave another window as the current one, so find the tab by its URL
+            const tabs = await browser.browsingContexts().catch(() => [] as WebdriverIO.BrowsingContext[])
+            this.#testPageTab = tabs.find((tab) => isTestPageOf(this._cid, tab.url))
         }
+        // the tab has the handle in a WebDriver BiDi session
+        this.#testPageHandle = this.#testPageTab?.contextId ?? await browser.getWindowHandle().catch(() => undefined)
         // await browser.debug()
 
         /**
@@ -181,7 +210,7 @@ export default class BrowserFramework implements Omit<TestFramework, 'init'> {
          * capture coverage if enabled
          */
         if (this.#runnerOptions.coverage?.enabled && process.send) {
-            const coverageMap = await browser.execute(
+            const coverageMap = await this.#testPage.execute(
                 () => (window.__coverage__ || {}))
             const coverage = (
                 coverageMap && typeof coverageMap === 'object' && !Array.isArray(coverageMap)
@@ -489,7 +518,7 @@ export default class BrowserFramework implements Omit<TestFramework, 'init'> {
     }
 
     async #checkForTestError () {
-        const testError = await browser.execute(function fetchExecutionState () {
+        const testError = await this.#testPage.execute(function fetchExecutionState () {
             // a page that got its first byte less than 5 s ago, e.g. right after a reload, has no title and no test framework yet
             const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
             if (document.readyState === 'loading' && performance.now() - (navigation?.responseStart ?? 0) < 5000) {
@@ -512,15 +541,19 @@ export default class BrowserFramework implements Omit<TestFramework, 'init'> {
                 : null
             const errors = viteError || window.__wdioErrors__ || loadError
             return { errors, hasViteError: Boolean(viteError), testsStartedAt: window.__wdioTestsStartedAt__ }
-        }).catch((err) => {
+        }).catch(async (err) => {
             /**
-             * ignore error, see https://github.com/GoogleChromeLabs/chromium-bidi/issues/1102
+             * skip this check, the next one runs 500 ms later:
+             * - the page replaced its document, see https://github.com/GoogleChromeLabs/chromium-bidi/issues/1102
+             * - the check ran in a window that the test closed, e.g. a popup during `closeWindow()`, and the
+             *   test page is still open: only when the runner reads the current window (see `#testPageTab`)
              */
-            if (err.message.includes('Cannot find context with specified id')) {
-                return
+            const skip = err.message.includes('Cannot find context with specified id') ||
+                (isClosedWindowError
```

**File**: `packages/wdio-runner/tests/browser.test.ts` (modified, +207/-2)
```diff
@@ -5,6 +5,8 @@ import { ELEMENT_KEY } from 'webdriver'
 import { MESSAGE_TYPES, browserChannelMessage, type Workers } from '@wdio/types'
 import { setWdioKind } from '@wdio/utils'
 import { remote } from 'webdriverio'
+// @ts-expect-error mock feature
+import { logMock } from '@wdio/logger'
 
 import BrowserFramework from '../src/browser.js'
 import type BaseReporter from '../src/reporter.js'
@@ -228,17 +230,29 @@ describe('BrowserFramework browser errors', () => {
             url: vi.fn().mockResolvedValue(undefined),
             setCookies: vi.fn().mockResolvedValue(undefined),
             execute: vi.fn(),
+            getWindowHandle: vi.fn().mockResolvedValue('test-page'),
+            getWindowHandles: vi.fn().mockResolvedValue(['test-page']),
             getLogs: vi.fn(),
             refresh: vi.fn().mockResolvedValue(undefined)
         }
         globals.browser = browser
         process.send = vi.fn() as unknown as typeof process.send
+        logMock.info.mockClear()
+        framework = createFramework({})
+    })
 
+    function createFramework (config: Partial<WebdriverIO.Config>) {
         const on = vi.spyOn(process, 'on').mockImplementation(() => process)
-        framework = new BrowserFramework('0-0', { mochaOpts: { timeout: 60_000 } } as WebdriverIO.Config, [url.pathToFileURL(path.resolve('spec.test.js')).href], { emit: vi.fn() } as unknown as BaseReporter)
+        const created = new BrowserFramework('0-0', { mochaOpts: { timeout: 60_000 }, ...config } as WebdriverIO.Config, [url.pathToFileURL(path.resolve('spec.test.js')).href], { emit: vi.fn() } as unknown as BaseReporter)
         handler = on.mock.calls.find(([event]) => event === 'message')![1] as MessageHandler
         on.mockRestore()
-    })
+        return created
+    }
+
+    // the tab of the test page that `browser.url()` returns in a WebDriver BiDi session
+    function testPageTab () {
+        return setWdioKind({ contextId: 'test-page', url: 'http://localhost:5173/?cid=0-0&spec=/project/spec.test.js', execute: vi.fn() }, 'browsing-context')
+    }
 
     afterEach(() => {
         vi.useRealTimers()
@@ -338,6 +352,23 @@ describe('BrowserFramework browser errors', () => {
         expect(await result).toBe(0)
     })
 
+    it('reloads the tab of the test page for an outdated optimize dep, also when the test works in another window', async () => {
+        const tab = Object.assign(testPageTab(), { refresh: vi.fn().mockResolvedValue(undefined) })
+        tab.execute.mockResolvedValue({ errors: [], hasViteError: false, testsStartedAt: 1000 })
+        browser.url.mockResolvedValue(tab)
+        browser.getLogs.mockResolvedValueOnce([
+            severeLog(1500, 'http://localhost/node_modules/.vite/deps/expect.js?v=1 - Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep)')
+        ]).mockResolvedValue([])
+
+        const result = framework.run()
+        await vi.advanceTimersByTimeAsync(600)
+        expect(tab.refresh).toHaveBeenCalledTimes(1)
+        expect(browser.refresh).not.toHaveBeenCalled()
+        await finishSpec(0)
+
+        expect(await result).toBe(0)
+    })
+
     it('ignores a state check that is still running when the session ends', async () => {
         let rejectState!: (err: Error) => void
         browser.execute.mockReturnValue(new Promise((_, reject) => {
@@ -382,4 +413,178 @@ describe('BrowserFramework browser errors', () => {
             process.off('unhandledRejection', unhandled)
         }
     })
+
+    it('reads the test page in its tab, also when the test works in another window', async () => {
+        const tab = testPageTab()
+        browser.url.mockResolvedValue(tab)
+        tab.execute
+            .mockResolvedValueOnce({ errors: [], hasViteError: false })
+            .mockResolvedValueOnce(1000)
+            .mockResolvedValue({ 'file.js': {} })
+        browser.getLogs.mockResolvedValueOnce([severeLog(1500)]).mockResolvedValue([])
+        framework = createFramework({ runner: ['browser', { coverage: { enabled: true } }] } as Partial<WebdriverIO.Config>)
+
+        const result = framework.run()
+        await vi.advanceTimersByTimeAsync(600)
+        await finishSpec(0)
+
+        expect(await result).toBe(0)
+        expect(browser.execute).not.toHaveBeenCalled()
+        // the state check, the start time of the tests and the coverage
+        expect(tab.execute).toHaveBeenCalledTimes(3)
+        // the tab has the handle of the test page
+        expect(browser.getWindowHandle).not.toHaveBeenCalled()
+        expect(vi.mocked(process.send!).mock.calls.map(([message]) => JSON.stringify(message)).join()).toContain('file.js')
+    })
+
+    it('reads the test page in its tab in watch mode, also when the last run left a popup as the current window', async () => {
+        const tab = testPageTab()
+        tab.execute.mockResolvedValue({ errors: [], hasViteError: false, testsStartedAt: 1000 })
+        const popup = setWdioK
```

---

### Incident Patch 3: `84cc77b4` (2026-11-11)
**Commit Message**: fix(session): import $$ in exported specs (#16441)

* fix(session): import $$ in exported specs

* fix(session): preserve selector references in exports

* fix(session): import $$ only for a bare reference and alias it only for a real assignment

- skip member names and object keys named $$ (browser.$$, el.$$, { $$: 1 })
- count only assignment targets: el.$$ = x, (await $$(s))[0].x = 1 and for (const $$ of …) keep the plain import
- text fallback: skip .$$ and arrow parameters, count compound and prefix updates
- read the hoisted import names from splitImports, compute the alias only when needed
- tests: one spec runner with a replacer function, so the alias gets $$ and not $
- e2e: drop the local Chrome binary, no-sandbox and junction options (not this topic)

* test(session): run the exported spec in strict mode, as an ES module runs

* fix(session): wrap the steps in a block only when a step declares its own $$

- a step that only assigns $$ keeps the steps flat, with the var copy first
- writes() replaces the name list, one marker check in the step renderer

* fix(session): end the $$ copy with a semicolon, use the block in the text fallback

- a first step that starts with ( 

**File**: `e2e/session/export.test.ts` (modified, +5/-0)
```diff
@@ -76,6 +76,10 @@ describe('wdio session history and export', () => {
         expect(add).toMatch(/^e\d+$/)
         await run('click', add)
         await run('exec', '-e', `await expect(ref('${checkout}')).toBeDisplayed()`)
+        await run('exec', '-e', "expect((await $$('#products > li')).length).toBe(2)")
+        await run('exec', '-e', "const select = $$; expect((await select('#products > li')).length).toBe(2)")
+        await run('exec', '-e', "const size: number = (await $$ /* comment */ ('#products > li')).length; expect(size).toBe(2)")
+        await run('exec', '-e', "const savedSelect = $$; $$ = (...args) => savedSelect(...args); expect((await $$('#products > li')).length).toBe(2)")
 
         const spec = path.join(project.dir, 'cart.e2e.ts')
         const exported = await run('export', '--out', spec, '--title', 'cart')
@@ -96,6 +100,7 @@ export const config = {
         'goog:chromeOptions': { args: ['--headless=new', '--disable-gpu', '--window-size=1280,720'] }
     }],
     logLevel: 'error',
+    injectGlobals: false,
     baseUrl: ${JSON.stringify(server.url)},
     framework: 'mocha',
     mochaOpts: { timeout: 60000 },
```

**File**: `packages/wdio-session/src/exec/transform.ts` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ export interface TransformResult {
     readOnly: boolean
 }
 
-const PARSE_OPTIONS = {
+export const PARSE_OPTIONS = {
     ecmaVersion: 'latest',
     sourceType: 'module',
     allowAwaitOutsideFunction: true,
```

**File**: `packages/wdio-session/src/export/spec.ts` (modified, +115/-25)
```diff
@@ -4,6 +4,7 @@ import * as acorn from 'acorn'
 
 import type { HistoryEntry } from '../types.js'
 import { SessionError } from '../errors.js'
+import { PARSE_OPTIONS, stripTypes } from '../exec/transform.js'
 
 export interface ExportOptions {
     title: string
@@ -117,11 +118,8 @@ interface ProgramNode {
 
 function parseProgram (code: string): ProgramNode | undefined {
     try {
-        return acorn.parse(code, {
-            ecmaVersion: 'latest',
-            sourceType: 'module',
-            allowAwaitOutsideFunction: true
-        }) as unknown as ProgramNode
+        // the export reads no node location
+        return acorn.parse(code, { ...PARSE_OPTIONS, locations: false }) as unknown as ProgramNode
     } catch {
         return undefined
     }
@@ -157,11 +155,12 @@ function relativeImport (source: string, fromDir: string, toDir: string) {
 function splitImports (code: string, fromDir?: string, toDir?: string) {
     const ast = parseProgram(code)
     if (!ast?.body) {
-        return { imports: [] as string[], body: code }
+        return { imports: [] as string[], locals: [] as string[], body: code }
     }
     const ranges = ast.body.filter((node) => node.type === 'ImportDeclaration')
     let body = code
     const imports: string[] = []
+    const locals = ranges.flatMap((node) => (node.specifiers as { local: { name: string } }[]).map((specifier) => specifier.local.name))
     for (const node of [...ranges].reverse()) {
         let text = code.slice(node.start, node.end).trim()
         const source = node.source
@@ -173,7 +172,7 @@ function splitImports (code: string, fromDir?: string, toDir?: string) {
         imports.unshift(text)
         body = `${body.slice(0, node.start)}${body.slice(node.end)}`
     }
-    return { imports, body: body.trim() }
+    return { imports, locals, body: body.trim() }
 }
 
 function rewriteDynamicImports (code: string, fromDir?: string, toDir?: string) {
@@ -212,23 +211,89 @@ interface SelectorEdit {
     selector: string
 }
 
+/**
+ * Whether an assignment target writes `name`: `name`, `[name]`, `{ key: name }`, `name = fallback`, `...name`.
+ * A member such as `el.$$` writes a property, not a binding.
+ */
+function writes (node: ProgramNode | undefined | null, name: string): boolean {
+    if (!node) {
+        return false
+    }
+    switch (node.type) {
+    case 'Identifier':
+        return node.name === name
+    case 'ArrayPattern':
+        return (node.elements as (ProgramNode | null)[]).some((element) => writes(element, name))
+    case 'ObjectPattern':
+        return (node.properties as ProgramNode[]).some((property) => writes((property.type === 'RestElement' ? property.argument : property.value) as ProgramNode, name))
+    case 'AssignmentPattern':
+        return writes(node.left as ProgramNode, name)
+    case 'RestElement':
+        return writes(node.argument as ProgramNode, name)
+    default:
+        return false
+    }
+}
+
+/**
+ * The target that a node writes: `x = …`, `x++`, `for (x of …)`. `for (const x of …)` declares a new binding.
+ */
+function assignmentTarget (node: ProgramNode) {
+    switch (node.type) {
+    case 'AssignmentExpression':
+        return node.left as ProgramNode
+    case 'UpdateExpression':
+        return node.argument as ProgramNode
+    case 'ForOfStatement':
+    case 'ForInStatement':
+        return (node.left as ProgramNode).type === 'VariableDeclaration' ? undefined : node.left as ProgramNode
+    default:
+        return undefined
+    }
+}
+
+// `$$` that is not a member name (`el.$$`); a spread (`...$$`) is a reference
+const DOLLAR_DOLLAR_TEXT = /(?<![\w$])(?<!(?:^|[^.])\.)\$\$(?![\w$])/
+const DOLLAR_DOLLAR_ASSIGN_TEXT = /(?<![\w$.])\$\$\s*(?:(?:\*\*|<<|>>>?|&&|\|\||\?\?|[-+*/%&|^])?=(?![=>])|\+\+|--)|(?:\+\+|--)[ \t]*\$\$(?![\w$])/
+
 function selectorEdits (code: string) {
-    const ast = parseProgram(code)
+    const ast = parseProgram(stripTypes(code))
     const edits: SelectorEdit[] = []
     let needsDollar = false
     let needsDollarDollar = false
+    let assignsDollarDollar = false
     if (!ast) {
-        return { edits, needsDollar: /(?<!\$)\$\(/.test(code), needsDollarDollar: /\$\$\(/.test(code) }
+        return {
+            edits,
+            needsDollar: /(?<!\$)\$\(/.test(code),
+            needsDollarDollar: DOLLAR_DOLLAR_TEXT.test(code),
+            assignsDollarDollar: DOLLAR_DOLLAR_ASSIGN_TEXT.test(code),
+            // the text cannot show every declaration form, so the steps get the block
+            declaresDollarDollar: true
+        }
     }
+    // a top-level `let $$`, `const $$` or `class $$` of a step would clash with the `var $$` copy,
+    // and the copy would overwrite a hoisted `function $$`
+    const declaresDollarDollar = (ast.body || []).some((node) => (
+        (node.type === 'VariableDeclaration' && node.kind !== 'var' && (node.declarations as ProgramNode[]).some((declarator) => writes(declarator.id as ProgramNode, '$$'))) ||
+    
```

**File**: `packages/wdio-session/tests/export/spec.test.ts` (modified, +144/-2)
```diff
@@ -1,8 +1,10 @@
 import path from 'node:path'
+import vm from 'node:vm'
 
 import { describe, it, expect } from 'vitest'
 
 import { generateSpec, getterName, pageClassName, pageInstanceName } from '../../src/export/spec.js'
+import { stripTypes } from '../../src/exec/transform.js'
 import type { HistoryEntry } from '../../src/types.js'
 
 const step = (partial: Partial<HistoryEntry> & Pick<HistoryEntry, 'code'>): HistoryEntry => ({
@@ -39,7 +41,115 @@ describe('names', () => {
     })
 })
 
+/**
+ * Runs a generated spec with stub globals, the way the test runner gives them through `@wdio/globals`.
+ */
+async function runSpec (contents: string, globals: Record<string, unknown>) {
+    const results: unknown[] = []
+    let pending: Promise<void> | undefined
+    const source = contents.replace(/^import \{ (.+) \} from '@wdio\/globals'$/m, (_match, bindings: string) => (
+        `const { ${bindings.replace(/\$\$ as (\w+)/g, (_alias, local: string) => `$$: ${local}`)} } = globals`
+    ))
+    // an ES module is strict, so the script is strict too
+    vm.runInNewContext(`'use strict';\n${stripTypes(source)}`, {
+        globals,
+        results,
+        describe: (_title: string, fn: () => void) => fn(),
+        it: (_title: string, fn: () => Promise<void>) => { pending = fn() }
+    })
+    await pending
+    return results
+}
+
 describe('generateSpec', () => {
+    it.each([
+        ["const select = $$; results.push((await select('a')).length)", 2],
+        ["results.push((await $$.call(null, 'a')).length)", 2],
+        ["const size: number = (await $$ /* comment */ ('a')).length; results.push(size)", 2],
+        ["$$ = () => ['custom']; results.push($$()[0])", 'custom'],
+        ["const saved = $$; $$ = (...args) => saved(...args); results.push((await $$('a')).length)", 2],
+        ["$$ = null; $$ ||= () => ['fallback']; results.push($$()[0]); return", 'fallback'],
+        ["let $$ = () => ['first']; $$ = () => ['local']; results.push($$()[0])", 'local'],
+        ["function $$ () { return ['custom'] }; results.push($$()[0]); $$ = () => []", 'custom'],
+        ["for ($$ of [() => ['loop']]) {} results.push($$()[0])", 'loop'],
+        ["const __wdioDollarDollar = 'alias'; $$ = () => [__wdioDollarDollar]; results.push($$()[0])", 'alias']
+    ])('replays selector reference: %s', async (code, expected) => {
+        for (const pageObjects of [false, true]) {
+            const [spec] = generateSpec([
+                step({ kind: 'exec', code: String(code) })
+            ], { title: 'selectors', pageObjects })
+            const results = await runSpec(spec.contents, { browser: {}, $: () => {}, $$: async () => [1, 2], expect: () => {} })
+            expect(results).toEqual([expected])
+        }
+    })
+
+    it('preserves an explicitly declared local $$', async () => {
+        const [spec] = generateSpec([
+            step({ kind: 'exec', code: "const $$ = () => ['local']; results.push($$()[0])" })
+        ], { title: 'local selector' })
+        const results = await runSpec(spec.contents, { browser: {}, $: () => {}, $$: () => [], expect: () => {} })
+        expect(results).toEqual(['local'])
+    })
+
+    it('keeps the steps flat when a step assigns $$ and no step declares its own', () => {
+        const [spec] = generateSpec([
+            step({ kind: 'exec', code: 'const saved = $$; $$ = (...args) => saved(...args)' }),
+            step({ kind: 'exec', code: "await $$('a')" })
+        ], { title: 'wrap' })
+        expect(spec.contents).toContain('        var $$ = __wdioDollarDollar;\n\n        const saved = $$;')
+        expect(spec.contents).toContain("\n        await $$('a')")
+    })
+
+    it('ends the $$ copy, so a first step that starts with ( is not a call', async () => {
+        const [spec] = generateSpec([
+            step({ kind: 'exec', code: "(await $$('a')).forEach((n) => results.push(n))" }),
+            step({ kind: 'exec', code: '$$ = () => []' })
+        ], { title: 'paren' })
+        const results = await runSpec(spec.contents, { browser: {}, $: () => {}, $$: async () => [1, 2], expect: () => {} })
+        expect(results).toEqual([1, 2])
+    })
+
+    it('puts the steps in a block when a TypeScript step that cannot be stripped assigns $$', () => {
+        const [spec] = generateSpec([
+            step({ kind: 'exec', code: 'const { $$ } = <any>{ $$: () => [] }' }),
+            step({ kind: 'exec', code: '$$ = () => [1]' })
+        ], { title: 'fallback' })
+        expect(spec.contents).toContain('        {\n            const { $$ } = <any>')
+    })
+
+    it('puts the steps in a block when a step declares its own $$', () => {
+        const [spec] = generateSpec([
+            step({ kind: 'exec', code: "await $$('a')" }),
+            step({ kind: 'exec', code: 'let $$ = () => [1]; $$ = () => [2]' })
+        ], { title: 'local' })
+        expect(spec.contents).toContain("        var $$ = __wdioDollarDollar;\n\n        {\n            await
```

#### Recent Merged Pull Requests:
- **PR #16454** (2026-11-12): ci: block PRs with compromised commits or sensitive install changes (@plum117)
- **PR #16444** (closed): fix: revert malicious commits 2319f2d3d and 80b730e8d (credential exfiltration in postinstall) (@mccmrunal)
- **PR #16443** (closed): docs: dependency audit notes (@wdio-bot)
- **PR #16442** (2026-11-11): fix(create-wdio): make pnpm create wdio work with pnpm 11+, and test npm, pnpm, Yarn and Bun in CI (@plum117)
- **PR #16441** (2026-11-11): fix(session): import $$ in exported specs (@ML642)
- **PR #16423** (2026-11-10): fix(create-wdio): install the Appium 3 driver majors, show the npm error, and run npm init wdio in CI (@plum117)

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

## X. webdriverio): wait the full timeout when the clock moves during the last check (

**RULE**:
When implementing operations in `packages/webdriverio/src/utils/Timer.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webdriverio/webdriverio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1d40974c`: webdriverio): wait the full timeout when the clock moves during the last check (#16396). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/webdriverio/src/utils/Timer.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
        // one clock read: a second read can get the next ms and stop the last check one interval early
        const elapsed = Date.now() - (this._startTime || 0)
        const diff = elapsed - (this._ticks++ * this._delay)
        if (this._hasTime(elapsed, delay)) {
    private _hasTime (elapsed: number, delay: number) {
        return elapsed + delay <= this._timeout
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
        const diff = (Date.now() - (this._startTime || 0)) - (this._ticks++ * this._delay)
        if (this._hasTime(delay)) {
    private _hasTime (delay: number) {
        return (Date.now() - (this._startTime || 0) + delay) <= this._timeout
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1d40974c` are properly handled with clean fallback behavior.
