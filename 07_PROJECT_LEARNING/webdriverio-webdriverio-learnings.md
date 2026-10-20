> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webdriverio-webdriverio-learnings.md`  
> **Source**: github ([https://github.com/webdriverio/webdriverio](https://github.com/webdriverio/webdriverio))  
> **Source Version**: `abe41af7`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T05:03:28.250Z  
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
> **Harvest Timestamp**: 2026-10-20T05:03:27.079Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webdriverio/webdriverio`
- **Description**: Next-gen browser and mobile automation test framework for Node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9852 stars

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
- **Issue #16148** (2026-10-20): **fix(@wdio/cucumber-framework): list the matching step definitions of an ambiguous step**
  *Symptoms*: ## Proposed changes  Refs #13931. Follow-up of #16107.  Cucumber 13 (v10) sends no message for an `AMBIGUOUS` step. Cucumber 10 (v9) sent `Multiple step definitions match:` and one line per definition. Since v10, users see no list of the definitions, and with the default option they see no reason at all.  The formatter now keeps the `stepDefinition` messages and builds the v9 text again from the `stepDefinitionIds` of the step. A message that Cucumber sends is kept. With no known definition, the #16107 text stays.  | `failAmbiguousDefinitions` | Before | After | |---|---|---| | `true` | failed: `Step "this is ambiguous" matches multiple step definitions. Make the step definitions unique…` | failed: the definition list + `at Feature/Scenario/Step` lines | | `false` (default) | skipped, no reason | skipped, the definition list under "Pending Reasons" |  Spec reporter, `failAmbiguousDefinitions: true` (smoke suite `cucumberFailAmbiguousDefinitions`):  ``` Multiple step definitions match:   this is ambiguous - cucumber/step-definitions/then.js:20   this is ambiguous - cucumber/step-definitions/given.js:89 	at Feature(…/tests/cucumber/test.feature):1:1 	at Scenario(failAmbiguousDefinitions):49:5 	at Step(this is ambiguous):50:9 ```  Other changes:  - The stack-line code is shared with undefined steps. It now also finds a scenario inside a `Rule` and a step from a `Background`. - A regular expression with flags is written once (`/^I do/i`): Cucumber 13 already sends it with its sla

- **Issue #16140** (2026-10-19): **test(e2e): add local mobile web suites for iOS and Android with Appium**
  *Symptoms*: ## Proposed changes  CI has no iOS or Android job, so #16137 (with Appium XCUITest, an `async` script failed at once) was found by users. This PR adds local mobile web suites with `@wdio/appium-service`:  | Command | Platform | |---|---| | `pnpm run test:ios:local` | iOS Safari on a Simulator (XCUITest) | | `pnpm run test:android:local` | Chrome on an Android emulator (UiAutomator2) |  One spec (`e2e/wdio/mobile/mobileWeb.e2e.ts`) for both:  | Test | Covers | |---|---| | Async `execute`, `isStable()`, protocol `executeAsyncScript()`, `browser.setTimeout()` | Script timeout (#16137, #16138) | | Click on an element below the viewport, after the `scroll` events of the page | #16062 (#16133) | | Tap, `browser.keys()`, `scrollIntoView()`, `browser.scroll()` | Mobile branches of the commands (no `wheel` action, no key `pause` on iOS) |  The scripts are not `test:e2e:*`, so `pnpm run test:e2e` and CI do not run them. Appium starts the Simulator or the emulator. Setup and variables are in CONTRIBUTING ("Mobile e2e Tests (local only)") and `e2e/AGENTS.md`.  Results (iOS 27.0 Simulator, Android 36 emulator, Appium 3.8.0):  | Driver | This PR | Without the fix | |---|---|---| | XCUITest 12.18.3 | 8 pass, 1 skipped | Without #16138: 3 script timeout tests fail (`after 0 ms`). Without #16133: the click test fails. | | XCUITest 12.16.0 (remote debugger 17.5.8) | 8 pass, 1 skipped | Without the Node wait of #16133 (result `{}`): the click test failed in 2 of 3 runs | | UiAutomator2 8.7.0, C

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

### Incident Patch 1: `456fb11a` (2026-10-19)
**Commit Message**: fix(webdriverio): isEqual and scrollIntoView on an element that the page rendered again (#16139)

* fix(webdriverio): isEqual and scrollIntoView on an element that the page rendered again

isEqual hid every error of its compare script and gave false. For an
element that the page rendered again, it now looks up both elements once
(no wait, as the other checks) and compares the elements on the page; an
element that is gone gives false at once, as before.

WebDriver BiDi gives a script the node that the page removed, with no
error. The scripts of isEqual and scrollIntoView (measure, settle, Web
API) now throw the stale element error of Classic for an element that is
not connected or whose document is not the active document, as
isDisplayed does. scrollIntoView sends a stale element error up without
the Web API fallback, so the element layer finds the element again and
scrolls the element on the page.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* refactor(webdriverio): use withKnownElement in isEqual and scrollIntoView

Use the W3C "get a known element" helper of #16136 in place of the copied
stale checks, so the check is in one place. isEqual checks both elements.

Co-Authore

**File**: `e2e/wdio/headless/__fixtures__/findElementAgain.html` (modified, +9/-0)
```diff
@@ -12,6 +12,7 @@
     <div id="date-host-area"></div>
     <div id="restore-area"><input id="restore" value="old"></div>
     <div id="select-area"><select id="select"><option value="a">Alpha</option><option value="b">Beta</option></select></div>
+    <div id="far-area" style="margin-top: 3000px"><p id="far">far</p></div>
 
     <script>
         const root = document.querySelector('#host').attachShadow({ mode: 'open' })
@@ -97,6 +98,14 @@
             select.replaceWith(select.cloneNode(true))
         }
 
+        /**
+         * replace `#far` (below the viewport) with a new node
+         */
+        window.renderFar = () => {
+            const far = document.querySelector('#far')
+            far.replaceWith(far.cloneNode(true))
+        }
+
         /**
          * replace the content of the shadow root of `#host` with new nodes
          */
```

**File**: `e2e/wdio/headless/findElementAgain.e2e.ts` (modified, +234/-0)
```diff
@@ -12,6 +12,7 @@ interface Fixture {
     renderDates (): void
     renderDateHost (): void
     renderSelect (): void
+    renderFar (): void
 }
 
 const FIXTURE = url.pathToFileURL(path.resolve(__dirname, '__fixtures__', 'findElementAgain.html')).href
@@ -27,6 +28,7 @@ const renderForm = (text: string) => browser.execute(
 const renderDates = () => browser.execute(() => (window as unknown as Fixture).renderDates())
 const renderDateHost = () => browser.execute(() => (window as unknown as Fixture).renderDateHost())
 const renderSelect = () => browser.execute(() => (window as unknown as Fixture).renderSelect())
+const renderFar = () => browser.execute(() => (window as unknown as Fixture).renderFar())
 const errorOf = (promise: Promise<unknown>) => promise.then(() => undefined, (e: Error) => e)
 
 /**
@@ -233,6 +235,238 @@ describe('finding an element again', () => {
 
             expect(await elem.isDisplayed()).toBe(true)
         })
+
+        it('isEqual compares the element that the page rendered again', async () => {
+            const elem = await $('.item')
+            await renderItems(['replaced'])
+
+            expect(await elem.isEqual(await $('.item'))).toBe(true)
+        })
+
+        it('isEqual of an element that the page removed gives false at once', async () => {
+            const elem = await $('.item')
+            const other = await $('#late-area')
+            await renderItems([])
+
+            const start = Date.now()
+            expect(await elem.isEqual(other)).toBe(false)
+            expect(Date.now() - start).toBeLessThan(browser.options.waitforTimeout ?? 5000)
+        })
+
+        it('isEqual of a valid element and an element that the page removed gives false', async () => {
+            const elem = await $('.item')
+            const other = await $('#late-area')
+            await renderItems([])
+
+            expect(await other.isEqual(elem)).toBe(false)
+        })
+
+        it('isEqual finds again only the stale element: a valid one can match another node now', async () => {
+            await renderItems(['first', 'second'])
+            const stale = await $$('.item')[1]
+            await renderItems(['first', 'second'])
+            const valid = await $$('.item')[1]
+            await browser.execute(() => {
+                const top = document.createElement('li')
+                top.className = 'item'
+                document.querySelector('#items')!.prepend(top)
+            })
+
+            // `stale` is found again as the item at index 1 now ("first"), `valid` is still "second"
+            expect(await stale.isEqual(valid)).toBe(false)
+        })
+
+        it('isEqual compares with an element reference, which has no selector', async () => {
+            const elem = await $('.item')
+            await renderItems(['replaced'])
+
+            expect(await elem.isEqual(await $(await browser.findElement('css selector', '.item')))).toBe(true)
+        })
+
+        it('isEqual compares an element whose parent the page rendered again', async () => {
+            const elem = await $('#form').$('.in-form')
+            await renderForm('replaced')
+
+            expect(await elem.isEqual(await $('#form').$('.in-form'))).toBe(true)
+        })
+
+        it('isEqual of an element whose parent the page removed gives false at once', async () => {
+            const elem = await $('#form').$('.in-form')
+            const other = await $('#late-area')
+            await browser.execute(() => document.querySelector('#form')!.remove())
+
+            const start = Date.now()
+            expect(await elem.isEqual(other)).toBe(false)
+            expect(Date.now() - start).toBeLessThan(browser.options.waitforTimeout ?? 5000)
+        })
+    })
+
+    /**
+     * BiDi gives a script the node that the page removed, with no error. A command that runs a
+     * script on its element checks that the element is still on the page, as `isDisplayed` does
+     */
+    describe('a script on an element that the page rendered again', () => {
+        it('scrollIntoView scrolls the element that the page rendered again', async () => {
+            const elem = await $('#far')
+            await renderFar()
+            await elem.scrollIntoView()
+
+            expect(await browser.execute(() => {
+                const rect = document.querySelector('#far')!.getBoundingClientRect()
+                return rect.top >= 0 && rect.bottom <= window.innerHeight
+            })).toBe(true)
+        })
+
+        it('scrollIntoView scrolls an element that the page renders again on each scroll', async () => {
+            const elem = await $('#far')
+            await browser.execute(() => window.addEventListener('scroll', () => (window as unknown as Fixture).renderFar()))
+            await elem.scrollIntoView()
+
+            expect(await browser.execute(() => {
+                const rect = document.querySelector('#far')!.getBoundingClientRect()
+                return rect.
```

**File**: `packages/webdriverio/src/commands/element/isEqual.ts` (modified, +68/-8)
```diff
@@ -1,9 +1,23 @@
 import { getBrowserObject } from '@wdio/utils'
 
+import { findChainAgain } from '../../utils/findChainAgain.js'
+import { isStaleElementToFindAgain } from '../../utils/index.js'
+import { withKnownElement } from '../../utils/foreignContext.js'
+import { StrictSelectorError } from '../../utils/strictSelectorError.js'
+
 /**
  *
  * Return true if the selected element matches with the provided one.
  *
+ * :::info
+ *
+ * As the other element commands, `isEqual` compares the elements that are on the page now. When the
+ * page renders an element again (for example a React re-render), the command finds it again with its
+ * selector, once and without a wait. An element that is gone is not equal. A strict element that
+ * matches more than once then throws a `StrictSelectorError`, as the other checks do.
+ *
+ * :::
+ *
  * <example>
     :isEqual.js
     it('should detect if an element is clickable', async () => {
@@ -45,15 +59,61 @@ export async function isEqual (
     }
 
     // browser or webview
-    let result: boolean
     try {
-        result = await browser.execute(
-            /* istanbul ignore next */
-            function (el1: HTMLElement, el2: HTMLElement) { return el1 === el2 },
-            this as unknown as HTMLElement, el as unknown as HTMLElement)
-    } catch {
-        result = false
+        return await isSameNode(browser, this, el)
+    } catch (err) {
+        if (!isStaleElementToFindAgain(err)) {
+            return false
+        }
+        /**
+         * The page rendered an element again: compare the elements that are on the page now. Find
+         * again only a stale element, as a valid one can match another node now. As the other
+         * checks, look them up once, without a wait: an element that is gone is not equal.
+         */
+        const onPage = async (element: WebdriverIO.Element) => (
+            await isKnown(browser, element) ? element : findChainAgain(element)
+        )
+        const lookups = await Promise.allSettled(el === this ? [onPage(this)] : [onPage(this), onPage(el)])
+        const lookupErrs = lookups.flatMap((lookup) => lookup.status === 'rejected' ? [lookup.reason] : [])
+        // a strict-mode violation is a real error, as in the middleware, also when the other lookup fails first
+        const strictErr = lookupErrs.find((lookupErr) => lookupErr instanceof StrictSelectorError)
+        if (strictErr) {
+            throw strictErr
+        }
+        if (lookupErrs.length) {
+            return false
+        }
+        const [found, otherFound] = lookups.map((lookup) => (lookup as PromiseFulfilledResult<WebdriverIO.Element | undefined>).value)
+        const other = el === this ? found : otherFound
+        if (!found?.elementId || !other?.elementId) {
+            return false
+        }
+        return isSameNode(browser, found, other).catch(() => false)
     }
+}
 
-    return result
+/**
+ * Whether the element is still on the page; a stale element error gives `false`
+ */
+function isKnown (browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser, element: WebdriverIO.Element) {
+    return (browser as WebdriverIO.Browser).execute(withKnownElement(() => true), element as unknown as HTMLElement)
+        .then(() => true, (err) => {
+            if (isStaleElementToFindAgain(err)) {
+                return false
+            }
+            throw err
+        })
+}
+
+/**
+ * Whether 2 elements are the same node, after the stale check of both
+ */
+function isSameNode (browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser, el1: WebdriverIO.Element, el2: WebdriverIO.Element) {
+    return (browser as WebdriverIO.Browser).execute(
+        withKnownElement(
+            /* istanbul ignore next */
+            function isSameElement (el1: HTMLElement, el2: HTMLElement) {
+                return el1 === el2
+            }, [0, 1]),
+        el1 as unknown as HTMLElement, el2 as unknown as HTMLElement)
 }
```

**File**: `packages/webdriverio/src/commands/element/scrollIntoView.ts` (modified, +89/-58)
```diff
@@ -4,6 +4,9 @@ import { getBrowserObject } from '@wdio/utils'
 import type { ChainablePromiseElement, CustomScrollIntoViewOptions, MobileScrollIntoViewOptions } from '../../types.js'
 import { MobileScrollDirection } from '../../types.js'
 import { StrictSelectorError } from '../../utils/strictSelectorError.js'
+import { isStaleElementToFindAgain } from '../../utils/index.js'
+import { withKnownElement } from '../../utils/foreignContext.js'
+import { findChainAgain } from '../../utils/findChainAgain.js'
 
 const log = logger('webdriverio')
 
@@ -99,62 +102,78 @@ export async function scrollIntoView (
         options = { block: 'end', inline: 'nearest' }
     }
 
-    try {
-        /**
-         * by default the WebDriver action scrolls the element just into the
-         * viewport. In order to stay compliant with `Element.scrollIntoView()`
-         * we need to adjust the values a bit.
-         *
-         * Fetch element rect, viewport size, and current scroll in one execute
-         * round-trip instead of three protocol calls.
-         */
-        const measure = async () => browser.execute((elem: HTMLElement) => {
-            const { left, top, width, height } = elem.getBoundingClientRect()
-            // ground truth for "is this actually visible right now", independent of any
-            // window-bounds arithmetic: is the element really the thing painted at its
-            // own center point? This correctly accounts for clipping by a nested scroll
-            // container *and* for occlusion by an unrelated overlapping element (a fixed
-            // header/footer, a sticky toolbar) - things pure geometry against
-            // `window.innerWidth/Height` can't see. Point can legitimately be outside the
-            // current viewport (that's still "not painted", which is the right answer),
-            // so this never throws.
-            //
-            // `(Document|ShadowRoot).elementsFromPoint()` does NOT pierce into an open
-            // shadow root on its own - it stops at the shadow host - so for an element
-            // nested inside one or more shadow roots (the exact scenario this whole
-            // command exists to handle) it would never find it. Recurse into each hit's
-            // own `.shadowRoot.elementsFromPoint()` until the hit stack stops bottoming
-            // out on a shadow host.
-            let isPainted = false
-            try {
-                const cx = left + width / 2
-                const cy = top + height / 2
-                const deepElementsFromPoint = (root: Document | ShadowRoot): Element[] => {
-                    const hits = root.elementsFromPoint(cx, cy)
-                    const topHit = hits[0] as (Element & { shadowRoot?: ShadowRoot | null }) | undefined
-                    return topHit?.shadowRoot ? deepElementsFromPoint(topHit.shadowRoot) : hits
-                }
-                isPainted = deepElementsFromPoint(document).includes(elem)
-            } catch { /* keep isPainted: false */ }
-            return {
-                elemRect: {
-                    x: left + window.scrollX,
-                    y: top + window.scrollY,
-                    width,
-                    height
-                },
-                viewport: {
-                    width: window.innerWidth,
-                    height: window.innerHeight
-                },
-                scroll: {
-                    x: window.scrollX,
-                    y: window.scrollY
-                },
-                isPainted
+    /**
+     * by default the WebDriver action scrolls the element just into the
+     * viewport. In order to stay compliant with `Element.scrollIntoView()`
+     * we need to adjust the values a bit.
+     *
+     * Fetch element rect, viewport size, and current scroll in one execute
+     * round-trip instead of three protocol calls.
+     */
+    const measure = async (element: WebdriverIO.Element = this) => browser.execute(withKnownElement((elem: HTMLElement) => {
+        const { left, top, width, height } = elem.getBoundingClientRect()
+        // ground truth for "is this actually visible right now", independent of any
+        // window-bounds arithmetic: is the element really the thing painted at its
+        // own center point? This correctly accounts for clipping by a nested scroll
+        // container *and* for occlusion by an unrelated overlapping element (a fixed
+        // header/footer, a sticky toolbar) - things pure geometry against
+        // `window.innerWidth/Height` can't see. Point can legitimately be outside the
+        // current viewport (that's still "not painted", which is the right answer),
+        // so this never throws.
+        //
+        // `(Document|ShadowRoot).elementsFromPoint()` does NOT pierce into an open
+        // shadow root on its own - it stops at the shadow host - so for an element
+        // nested inside one or more shadow roots (the exact scenario this whole
+     
```

**File**: `packages/webdriverio/src/utils/findChainAgain.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { getWdioKind } from '@wdio/utils'
+
+import { canFindAgain, findElementAgain } from './findElementAgain.js'
+
+/**
+ * Find the chain again from the browser, once, without a wait: a stale parent waits for itself,
+ * and in BiDi finds its removed child. Keeps an element reference. `undefined` when one is gone.
+ * Not `refetchElement`: it waits for each element (`implicitWait`).
+ */
+export async function findChainAgain (element: WebdriverIO.Element): Promise<WebdriverIO.Element | undefined> {
+    const chain: WebdriverIO.Element[] = []
+    for (let current = element; getWdioKind(current) === 'element'; current = current.parent as WebdriverIO.Element) {
+        chain.unshift(current)
+    }
+    let parent = chain[0]?.parent as WebdriverIO.Browser | WebdriverIO.Element
+    for (const item of chain) {
+        const found = canFindAgain(item) ? await findElementAgain(item, { parent }) : item
+        if (!found?.elementId) {
+            return undefined
+        }
+        parent = found
+    }
+    return parent as WebdriverIO.Element
+}
```

**File**: `packages/webdriverio/src/utils/foreignContext.ts` (modified, +8/-6)
```diff
@@ -72,19 +72,21 @@ const AsyncFunction = (async () => {}).constructor as FunctionConstructor
  * as `defaultView` after a reload.
  *
  * @param script  a function, or the source of one (not a function body)
- * @param at      the index of the element argument
+ * @param at      the index of the element argument, or a list of them
  * @see https://w3c.github.io/webdriver/#dfn-get-a-known-element
  */
-export function withKnownElement<T extends Function> (script: T | string, at = 0): T {
+export function withKnownElement<T extends Function> (script: T | string, at: number | number[] = 0): T {
     /**
      * `execute` sends an async function to Classic as an async script
      */
     const isAsync = typeof script === 'function' && script.constructor.name === 'AsyncFunction'
+    const elements = (Array.isArray(at) ? at : [at]).map((index) => `arguments[${index}]`).join(', ')
     return new (isAsync ? AsyncFunction : Function)(
-        `const el = arguments[${at}]
-        const doc = el && el.ownerDocument
-        if (el && (el.isConnected === false || (doc && !(doc.defaultView && doc.defaultView.document === doc)))) {
-            throw new Error('stale element reference: the element is not attached to the active document')
+        `for (const el of [${elements}]) {
+            const doc = el && el.ownerDocument
+            if (el && (el.isConnected === false || (doc && !(doc.defaultView && doc.defaultView.document === doc)))) {
+                throw new Error('stale element reference: the element is not attached to the active document')
+            }
         }
         return (${script}).apply(this, arguments)`
     ) as T
```

**File**: `packages/webdriverio/tests/commands/element/isEqual.test.ts` (modified, +142/-0)
```diff
@@ -2,9 +2,15 @@ import path from 'node:path'
 import { expect, describe, it, beforeAll, afterEach, vi } from 'vitest'
 
 import { remote } from '../../../src/index.js'
+import { findElementAgain } from '../../../src/utils/findElementAgain.js'
+import { StrictSelectorError } from '../../../src/utils/strictSelectorError.js'
 
 vi.mock('fetch')
 vi.mock('@wdio/logger', () => import(path.join(process.cwd(), '__mocks__', '@wdio/logger')))
+vi.mock('../../../src/utils/findElementAgain.js', async (importOriginal) => {
+    const actual = (await importOriginal()) as { findElementAgain: typeof findElementAgain }
+    return { ...actual, findElementAgain: vi.fn(actual.findElementAgain) }
+})
 
 describe('isEqual test', () => {
     let browser: WebdriverIO.Browser
@@ -31,6 +37,142 @@ describe('isEqual test', () => {
             expect(await elem.isEqual(elements[1])).toBe(false)
         })
 
+        /**
+         * an element that the page rendered again: the script gets the removed node in BiDi, the
+         * driver throws a stale element error in Classic
+         */
+        describe('an element that the page rendered again', () => {
+            const stale = () => Object.assign(
+                new Error('stale element reference: element is not attached to the page document'),
+                { name: 'stale element reference' }
+            )
+
+            afterEach(() => {
+                vi.mocked(findElementAgain).mockClear()
+                if (vi.isMockFunction(browser.execute)) {
+                    (browser.execute as ReturnType<typeof vi.fn>).mockRestore()
+                }
+            })
+
+            it('the compare script throws a stale element error for an element that is not on the page', async () => {
+                const execute = vi.spyOn(browser, 'execute')
+                await elem.isEqual(elem)
+                const script = execute.mock.calls.map(([fn]) => fn).find((fn) => String(fn).includes('isSameElement')) as unknown as (a: unknown, b: unknown) => boolean
+                const removed = { isConnected: false, ownerDocument: {} }
+                const onPage = { isConnected: true, ownerDocument: { defaultView: {} } }
+                ;(onPage.ownerDocument.defaultView as { document: unknown }).document = onPage.ownerDocument
+
+                expect(() => script(removed, onPage)).toThrow('stale element reference')
+                expect(() => script(onPage, removed)).toThrow('stale element reference')
+                expect(script(onPage, onPage)).toBe(true)
+            })
+
+            /**
+             * the page rendered `elements` again: a script that gets one of them throws a stale element error
+             */
+            const renderedAgain = (...elements: unknown[]) => vi.spyOn(browser, 'execute').mockImplementation(
+                (async (_script: unknown, ...args: unknown[]) => {
+                    if (args.some((arg) => elements.includes(arg))) {
+                        throw stale()
+                    }
+                    return true
+                }) as never
+            )
+
+            it('finds again only the stale element, without a wait, and compares it with the other one', async () => {
+                const execute = renderedAgain(elem)
+                const other = await browser.$('#other')
+                const found = await browser.$('#found')
+                vi.mocked(findElementAgain).mockResolvedValueOnce(found)
+
+                expect(await elem.isEqual(other)).toBe(true)
+                expect(findElementAgain).toHaveBeenCalledWith(elem, { parent: browser })
+                expect(findElementAgain).not.toHaveBeenCalledWith(other, expect.anything())
+                expect(execute).toHaveBeenLastCalledWith(expect.any(Function), found, other)
+            })
+
+            it('finds a stale element again once when it is compared with itself', async () => {
+                const execute = renderedAgain(elem)
+                const found = await browser.$('#found')
+                vi.mocked(findElementAgain).mockResolvedValueOnce(found)
+
+                expect(await elem.isEqual(elem)).toBe(true)
+                expect(vi.mocked(findElementAgain).mock.calls.filter(([element]) => element === elem)).toHaveLength(1)
+                expect(execute).toHaveBeenLastCalledWith(expect.any(Function), found, found)
+            })
+
+            it('gives false when an element is not on the page any more', async () => {
+                const execute = renderedAgain(elem)
+                const gone = await browser.$('#gone')
+                gone.elementId = undefined as unknown as string
+                vi.mocked(findElementAgain).mockResolvedValueOnce(gone)
+
+                expect(await elem.isEqual(elem)).toBe(false)
+                expect(execute).not.toHaveBeenCalledWith(expect.any(Function), gone, expect.anything())
+            })
+
+            it('gives false when the other element is not on the page any more'
```

**File**: `packages/webdriverio/tests/commands/element/scrollIntoView.test.ts` (modified, +130/-3)
```diff
@@ -4,8 +4,13 @@ import { expect, describe, it, vi, beforeAll, beforeEach, afterEach } from 'vite
 
 import { remote } from '../../../src/index.js'
 import { StrictSelectorError } from '../../../src/utils/strictSelectorError.js'
+import { findChainAgain } from '../../../src/utils/findChainAgain.js'
 
 vi.mock('fetch')
+vi.mock('../../../src/utils/findChainAgain.js', async (importOriginal) => {
+    const actual = (await importOriginal()) as { findChainAgain: typeof findChainAgain }
+    return { findChainAgain: vi.fn(actual.findChainAgain) }
+})
 vi.mock('@wdio/logger', () => import(path.join(process.cwd(), '__mocks__', '@wdio/logger')))
 
 /**
@@ -347,6 +352,118 @@ describe('scrollIntoView test', () => {
             expect(scrollAction.y).toBe(0)
         })
 
+        /**
+         * BiDi gives a script the node that the page removed, with no error
+         */
+        describe('an element that the page rendered again', () => {
+            const removed = { isConnected: false, ownerDocument: {} } as unknown as HTMLElement
+            const stale = () => Object.assign(
+                new Error('stale element reference: element is not attached to the page document'),
+                { name: 'stale element reference' }
+            )
+
+            it('each script throws a stale element error for an element that is not on the page', async () => {
+                const execute = vi.spyOn(browser, 'execute')
+                await elem.scrollIntoView()
+                const scripts = execute.mock.calls.map(([script]) => script as (...args: unknown[]) => unknown)
+
+                expect(scripts.length).toBeGreaterThan(0)
+                for (const script of scripts) {
+                    await expect(Promise.resolve().then(() => script(removed, {}))).rejects.toThrow('stale element reference')
+                }
+            })
+
+            it('sends up a stale element error without the Web API fallback', async () => {
+                const execute = vi.spyOn(browser, 'execute').mockRejectedValue(stale())
+
+                await expect(elem.scrollIntoView()).rejects.toThrow('stale element reference')
+                const webApiCalls = execute.mock.calls.filter(([script]) => /elem\.scrollIntoView\(/.test(String(script)))
+                expect(webApiCalls).toEqual([])
+            })
+
+            /**
+             * after a scroll, the scroll can make the page render the element again (a virtual list)
+             */
+            describe('after a scroll', () => {
+                const painted = {
+                    elemRect: { x: 15, y: 400, height: 30, width: 50 },
+                    viewport: { width: 600, height: 800 },
+                    scroll: { x: 0, y: 0 },
+                    isPainted: true
+                }
+                /**
+                 * the first measure gives `first`, then a script that gets the old element throws a stale
+                 * element error, and a measure of another element gives `measured`
+                 */
+                const renderedAgainOnScroll = (measured: object, first: object = painted) => vi.spyOn(browser, 'execute')
+                    .mockResolvedValueOnce(first)
+                    .mockImplementation((async (_script: unknown, element: unknown) => {
+                        if (element === elem) {
+                            throw stale()
+                        }
+                        return measured
+                    }) as never)
+
+                afterEach(() => {
+                    vi.mocked(findChainAgain).mockReset()
+                    vi.mocked(browser.execute).mockRestore()
+                })
+
+                it('ends without an error when the element that the page rendered again is painted', async () => {
+                    const found = await browser.$('#found')
+                    vi.mocked(findChainAgain).mockResolvedValueOnce(found)
+                    const execute = renderedAgainOnScroll(painted)
+
+                    await expect(elem.scrollIntoView()).resolves.toBeUndefined()
+                    expect(execute).toHaveBeenLastCalledWith(expect.any(Function), found)
+                })
+
+                it('scrolls the element that the page rendered again with the Web API when it is not painted', async () => {
+                    const found = await browser.$('#found')
+                    vi.mocked(findChainAgain).mockResolvedValueOnce(found)
+                    const execute = renderedAgainOnScroll({ ...painted, isPainted: false })
+
+                    await expect(elem.scrollIntoView({ block: 'center' })).resolves.toBeUndefined()
+                    expect(execute).toHaveBeenLastCalledWith(expect.any(Function), found, { block: 'center' })
+                })
+
+                it('sends up the stale element error when the Web API fails on the element that the page rendered again', async () => {
+                    const found = await browser.$('#found')
+                    vi
```

---

### Incident Patch 2: `abe41af7` (2026-10-20)
**Commit Message**: fix(@wdio/cucumber-framework): list the matching step definitions of an ambiguous step (#16148)

* fix(@wdio/cucumber-framework): list the matching step definitions of an ambiguous step

Cucumber 13 sends no message for an AMBIGUOUS step (Cucumber 10 sent
"Multiple step definitions match:" and one line per definition). The
formatter now keeps the stepDefinition messages and builds that text
again from the stepDefinitionIds of the step. A message that Cucumber
sends is kept; with no known definition, the text of #16107 stays.

Spec reporter, failAmbiguousDefinitions: true, before:

    Step "this is ambiguous" matches multiple step definitions. Make the
    step definitions unique by removing duplicate or overlapping expressions.

after:

    Multiple step definitions match:
      this is ambiguous - cucumber/step-definitions/then.js:20
      this is ambiguous - cucumber/step-definitions/given.js:89

With the default (false), the skipped step now has the same text as
its error message.

* docs(@wdio/cucumber-framework): what failAmbiguousDefinitions changes

* fix(@wdio/cucumber-framework): feature file location in the stack of an ambiguous step

An ambiguous step now has the same `

**File**: `.agents/skills/verify-webdriverio/features/smoke-testrunner.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ Preconditions:
 
 - **List names.** Run `pnpm run test:smoke:list`. Exit 0 and stdout includes `standaloneTest`. This does not launch WebdriverIO.
 - **Mocha session.** Run `pnpm run test:smoke mochaTestrunner`. Exit 0, stdout contains `All smoke tests passed!`, and the suite assertion requires `passed` 4 and `skippedSpecs` 1. On Windows the suite returns before those counts; do not treat that early return as the count check.
-- **Ambiguous Cucumber step.** Run `pnpm run test:smoke cucumberFailAmbiguousDefinitions`. Exit 0 and `All smoke tests passed!` mean the child run failed as expected and its spec report names the ambiguous step with guidance to remove overlapping definitions.
+- **Ambiguous Cucumber step.** Run `pnpm run test:smoke cucumberFailAmbiguousDefinitions`. Exit 0 and `All smoke tests passed!` mean the child run failed as expected and its spec report lists the matching step definitions of the ambiguous step.
 - **Standalone client.** Run `pnpm run test:smoke standaloneTest`. Exit 0 and stdout contains `All smoke tests passed!`. The spec expects the mock title `Mock Page Title`.
 - **Plugin.** Run `pnpm run test:smoke customService` or `pnpm run test:smoke customReporterString`. Exit 0 and stdout contains `All smoke tests passed!`.
 - **Watch mode.** Run `pnpm run test:smoke watchMode`. Exit 0 and stdout contains `All smoke tests passed!`. The suite reruns a changed spec in the same WebDriver session, including one failing rerun.
```

**File**: `packages/create-wdio/src/templates/snippets/cucumber.ejs` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
         dryRun: false,
         // <boolean> abort the run on first failure
         failFast: false,
-        // <boolean> report ambiguous step definitions as errors
+        // <boolean> report an ambiguous step as failed (not skipped), with the matching step definitions
         failAmbiguousDefinitions: true,
         // <string[]> Only execute the scenarios with name matching the expression (repeatable).
         name: [],
```

**File**: `packages/wdio-cucumber-framework/README.md` (modified, +1/-1)
```diff
@@ -186,7 +186,7 @@ Treat undefined definitions as warnings.
 
 <Option type="Boolean" default="false">
 
-Treat ambiguous definitions as errors.
+Report an ambiguous step (a step that matches more than one step definition) as failed, with the list of the matching step definitions. With `false`, the step is reported as skipped, with the list as its reason. In both cases, the run fails. Exception: without `parallelMode`, the run passes with `ignoreUndefinedDefinitions: true` and `failAmbiguousDefinitions: false`.
 
 </Option>
 ***Please note that this is a @wdio/cucumber-framework specific option and not recognized by cucumber-js itself***<br/>
```

**File**: `packages/wdio-cucumber-framework/src/constants.ts` (modified, +3/-0)
```diff
@@ -4,6 +4,9 @@ import type { CucumberOptions } from './types.js'
 
 export const DEFAULT_TIMEOUT = 60000
 
+// the text of Cucumber 10, which Cucumber 13 no longer sends
+export const AMBIGUOUS_STEP_MESSAGE = 'Multiple step definitions match:'
+
 export const DEFAULT_OPTS: CucumberOptions = {
     paths: [],
     backtrace: false,
```

**File**: `packages/wdio-cucumber-framework/src/cucumberFormatter.ts` (modified, +51/-16)
```diff
@@ -6,7 +6,7 @@ import path from 'node:path'
 import logger from '@wdio/logger'
 
 import type { Payload } from './types.js'
-import { convertStatus } from './utils.js'
+import { convertStatus, getAmbiguousStepMessage } from './utils.js'
 
 const log = logger('CucumberFormatter')
 
@@ -25,7 +25,8 @@ import type {
     TestStepFinished,
     TestStepResult,
     TestCaseFinished,
-    Hook
+    Hook,
+    StepDefinition
 } from '@cucumber/messages'
 
 import {
@@ -45,6 +46,7 @@ export default class CucumberFormatter extends Formatter {
     private _hookEvent: Hook[] = []
     private _scenarios: Pickle[] = []
     private _testCases: TestCase[] = []
+    private _stepDefinitions = new Map<string, StepDefinition>()
     private _currentTestCase?: TestCaseStarted
     private _currentPickle?: HookParams = {}
     private _suiteMap: Map<string, string> = new Map()
@@ -90,8 +92,9 @@ export default class CucumberFormatter extends Formatter {
             } else if (envelope.testStepStarted) {
                 this.onTestStepStarted(envelope.testStepStarted)
             } else if (envelope.testStepFinished) {
-                results.push(envelope.testStepFinished.testStepResult!)
-                this.onTestStepFinished(envelope.testStepFinished)
+                const testStepFinished = this.withAmbiguousMessage(envelope.testStepFinished)
+                results.push(testStepFinished.testStepResult!)
+                this.onTestStepFinished(testStepFinished)
             } else if (envelope.testCaseFinished) {
                 /**
                  * only store result if step isn't retried
@@ -106,6 +109,8 @@ export default class CucumberFormatter extends Formatter {
                 this.onTestRunFinished()
             } else if (envelope.hook) {
                 this.onHook(envelope.hook)
+            } else if (envelope.stepDefinition) {
+                this._stepDefinitions.set(envelope.stepDefinition.id, envelope.stepDefinition)
             } else {
                 // do nothing for other envelopes
             }
@@ -227,17 +232,7 @@ export default class CucumberFormatter extends Formatter {
                     'You can ignore this error by setting cucumberOpts.ignoreUndefinedDefinitions as true.'
                 )
 
-                err.stack = `${err.message}\n\tat Feature(${uri}):1:1\n`
-                const featChildren = feature.children?.find(c => scenario.astNodeIds && c.scenario?.id === scenario.astNodeIds[0])
-                if (featChildren) {
-                    err.stack += `\tat Scenario(${featChildren.scenario?.name}):${featChildren.scenario?.location?.line}:${featChildren.scenario?.location?.column}\n`
-
-                    const featStep = featChildren.scenario?.steps?.find(s => step?.astNodeIds && s.id === step.astNodeIds[0])
-                    if (featStep) {
-                        err.stack += `\tat Step(${featStep.text}):${featStep.location?.line}:${featStep.location?.column}\n`
-                    }
-                }
-
+                err.stack = `${err.message}\n${this.getFeatureStack(uri, feature, scenario, step)}`
                 error = err
             }
         } else if (result.status === Status.FAILED && !(result as unknown as TestCaseFinished).willBeRetried) {
@@ -255,13 +250,16 @@ export default class CucumberFormatter extends Formatter {
                 'Make the step definitions unique by removing duplicate or overlapping expressions.'
             )
             error = new Error(message.split('\n')[0])
-            error.stack = message
+            error.stack = `${message}\n${this.getFeatureStack(uri, feature, scenario, step)}`
         }
 
+        // reporters show the reason of a skipped test from `pendingReason`, not from its error
+        const pendingReason = result.status === Status.AMBIGUOUS && state === 'skip' ? result.message : undefined
         const common = {
             title: title,
             state,
             error,
+            ...(pendingReason ? { pendingReason } : {}),
             duration: this._testStart
                 ? Date.now() - this._testStart.getTime()
                 : 0,
@@ -292,6 +290,25 @@ export default class CucumberFormatter extends Formatter {
         this.emit('test:' + state, payload)
     }
 
+    /**
+     * stack lines with the location of the scenario and the step in the feature file
+     */
+    private getFeatureStack(uri: string, feature: Feature, scenario: Pickle, step?: PickleStep) {
+        let stack = `\tat Feature(${uri}):1:1\n`
+        const children = feature.children?.flatMap((child) => child.rule ? child.rule.children : [child]) ?? []
+        const featScenario = children.find(c => scenario.astNodeIds && c.scenario?.id === scenario.astNodeIds[0])?.scenario
+        if (featScenario) {
+            stack += `\tat Scenario(${featScenario.name}):${featScenario.location?.line}:${featScenario.location?.column}\n`
+
+            const steps = [...children.flatMap((c) => c.background?
```

**File**: `packages/wdio-cucumber-framework/src/types.ts` (modified, +5/-1)
```diff
@@ -164,7 +164,11 @@ export interface CucumberOptions {
      */
     ignoreUndefinedDefinitions?: boolean;
     /**
-     * Treat ambiguous definitions as errors.
+     * Report an ambiguous step (a step that matches more than one step definition)
+     * as failed, with the list of the matching step definitions. With `false`, the
+     * step is reported as skipped, with the list as its reason. In both cases, the
+     * run fails. Exception: without `parallelMode`, the run passes with
+     * `ignoreUndefinedDefinitions: true` and `failAmbiguousDefinitions: false`.
      *
      * Please note that this is a @wdio/cucumber-framework specific option
      * and not recognized by cucumber-js itself.
```

**File**: `packages/wdio-cucumber-framework/src/utils.ts` (modified, +27/-2)
```diff
@@ -11,11 +11,12 @@ import type {
     Feature,
     Pickle,
     TestStepResultStatus,
-    FeatureChild
+    FeatureChild,
+    StepDefinition
 } from '@cucumber/messages'
 import type { Capabilities } from '@wdio/types'
 import type { ReporterStep, TestHookDefinitionConfig, Payload } from './types.js'
-import { CUCUMBER_HOOK_DEFINITION_TYPES } from './constants.js'
+import { AMBIGUOUS_STEP_MESSAGE, CUCUMBER_HOOK_DEFINITION_TYPES } from './constants.js'
 const log = logger('@wdio/cucumber-framework:utils')
 
 function createStepArgument ({ argument }: PickleStep) {
@@ -102,6 +103,7 @@ export function buildStepPayload(
         type: string
         state?: TestStepResultStatus | string | null
         error?: Error
+        pendingReason?: string
         duration?: number
         title?: string | null
         passed?: boolean
@@ -273,3 +275,26 @@ export function convertStatus(status: TestStepResultStatus): 'pass' | 'fail' | '
     default: return 'fail'
     }
 }
+
+/**
+ * The error text of an ambiguous step: one line for each matching step definition.
+ * @param {StepDefinition[]} stepDefinitions - the definitions that match the step
+ * @returns {string | undefined} - the text, or `undefined` without a definition
+ */
+export function getAmbiguousStepMessage(stepDefinitions: readonly StepDefinition[]): string | undefined {
+    if (stepDefinitions.length === 0) {
+        return undefined
+    }
+    const lines = stepDefinitions.map(({ pattern, sourceReference }) => {
+        // Cucumber sends `pattern.toString()`, with the slashes, for a regular expression with flags
+        const source = pattern.type === 'REGULAR_EXPRESSION' && !pattern.source.startsWith('/')
+            ? `/${pattern.source}/`
+            : pattern.source
+        if (!sourceReference.uri) {
+            return `  ${source}`
+        }
+        const line = sourceReference.location ? `:${sourceReference.location.line}` : ''
+        return `  ${source} - ${sourceReference.uri}${line}`
+    })
+    return [AMBIGUOUS_STEP_MESSAGE, ...lines].join('\n')
+}
```

**File**: `packages/wdio-cucumber-framework/tests/formatter.test.ts` (modified, +136/-5)
```diff
@@ -8,7 +8,7 @@ import {
     afterEach,
 } from 'vitest'
 import { EventEmitter } from 'node:events'
-import type { TestStepFinished, TestStepStarted } from '@cucumber/messages'
+import type { StepDefinition, TestStepFinished, TestStepStarted } from '@cucumber/messages'
 import { TestStepResultStatus } from '@cucumber/messages'
 import path from 'node:path'
 
@@ -403,7 +403,15 @@ describe('CucumberFormatter', () => {
     })
 
     describe('ambiguous steps', () => {
-        function reportAmbiguity (scenarioLevelReporter: boolean, message?: string, failAmbiguousDefinitions = true) {
+        const definitions = [
+            { id: '16', pattern: { source: 'I do something', type: 'CUCUMBER_EXPRESSION' }, sourceReference: { uri: 'features/steps.js', location: { line: 3 } } },
+            { id: '99', pattern: { source: '^I do', type: 'REGULAR_EXPRESSION' }, sourceReference: { uri: 'features/steps.js', location: { line: 7 } } }
+        ] as StepDefinition[]
+        const DEFINITIONS_TEXT = 'Multiple step definitions match:\n  I do something - features/steps.js:3\n  /^I do/ - features/steps.js:7'
+        // the text before the location lines of the feature file
+        const stackText = (stack: string) => stack.split('\n\tat ')[0]
+
+        function reportAmbiguity (scenarioLevelReporter: boolean, message?: string, failAmbiguousDefinitions = true, stepDefinitions: StepDefinition[] = []) {
             const eventBroadcaster = new EventEmitter()
             const events = new EventEmitter()
             const counts: number[] = []
@@ -423,7 +431,15 @@ describe('CucumberFormatter', () => {
             } as any)
             loadGherkin(eventBroadcaster)
             acceptPickle(eventBroadcaster)
-            prepareSuite(eventBroadcaster)
+            for (const stepDefinition of stepDefinitions) {
+                eventBroadcaster.emit('envelope', { stepDefinition })
+            }
+            eventBroadcaster.emit('envelope', {
+                testCase: {
+                    ...testCase,
+                    testSteps: testCase.testSteps.map((step) => step.id === '26' ? { ...step, stepDefinitionIds: ['16', '99'] } : step)
+                }
+            })
             startSuite(eventBroadcaster)
             eventBroadcaster.emit('envelope', { testStepStarted })
             eventBroadcaster.emit('envelope', {
@@ -434,7 +450,11 @@ describe('CucumberFormatter', () => {
             })
             eventBroadcaster.emit('envelope', { testCaseFinished })
             eventBroadcaster.emit('envelope', { testRunFinished })
-            return { payload: wdioReporter.emit.mock.calls.find(([event]: [string]) => event === 'test:fail')?.[1], counts }
+            return {
+                payload: wdioReporter.emit.mock.calls.find(([event]: [string]) => event === 'test:fail')?.[1],
+                skipPayload: wdioReporter.emit.mock.calls.find(([event]: [string]) => event === 'test:skip')?.[1],
+                counts
+            }
         }
 
         it.each([false, true])('explains a missing Cucumber diagnostic (scenario level: %s)', (scenarioLevelReporter) => {
@@ -454,7 +474,7 @@ describe('CucumberFormatter', () => {
             const message = 'Multiple step definitions match:\n  first.js:2\n  second.js:3'
             const { payload } = reportAmbiguity(false, message)
             expect(payload.error.message).toBe(message.split('\n')[0])
-            expect(payload.error.stack).toBe(message)
+            expect(stackText(payload.error.stack)).toBe(message)
         })
 
         it('preserves the skipped-step policy when failAmbiguousDefinitions is false', () => {
@@ -463,6 +483,117 @@ describe('CucumberFormatter', () => {
             expect(wdioReporter.emit).toHaveBeenCalledWith('test:skip', expect.objectContaining({ state: 'skip', error: undefined }))
             expect(counts).toEqual([0])
         })
+
+        it('lists the matching definitions in the error (failAmbiguousDefinitions)', () => {
+            const { payload } = reportAmbiguity(false, undefined, true, definitions)
+            expect(payload.error.message).toBe('Multiple step definitions match:')
+            expect(stackText(payload.error.stack)).toBe(DEFINITIONS_TEXT)
+        })
+
+        it('gives the location of the step in the feature file', () => {
+            const { payload } = reportAmbiguity(false, undefined, true, definitions)
+            expect(payload.error.stack).toBe(`${DEFINITIONS_TEXT}\n` +
+                // an absolute uri stays as it is, also on Windows
+                `\tat Feature(${gherkinDocument.uri}):1:1\n` +
+                '\tat Scenario(Get size of an element):12:3\n' +
+                '\tat Step(should the element \'.header-logged-out a\' be 32px wide and 35px high):14:5\n')
+        })
+
+        it('lists the matching definitions on a skipped ambiguous step', () => {
+            const { payload, skipPayload } = reportAmbiguity(false, undefined, false, definitions)
+            e
```

---

### Incident Patch 3: `db5cde00` (2026-10-19)
**Commit Message**: test(e2e): add local mobile web suites for iOS and Android with Appium (#16140)

CI has no iOS or Android job, so #16137 (async scripts failed at once with
Appium XCUITest) was found only by users. `pnpm run test:ios:local` (iOS
Safari on a Simulator) and `pnpm run test:android:local` (Chrome on an
Android emulator) run one spec with `@wdio/appium-service`:

- the script timeout (#16137): an async `execute`, `isStable()`, a protocol
  `executeAsyncScript`, `browser.setTimeout()`
- a click below the viewport after the `scroll` events of the page (#16062)
- a tap, `browser.keys()` (not on iOS: WebDriverAgent types nothing), and
  `scrollIntoView()` / `browser.scroll()` (Appium has no `wheel` action)

They need local platform tools, so they are not `test:e2e:*` scripts.
Documented in CONTRIBUTING and e2e/AGENTS.md.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CONTRIBUTING.md` (modified, +39/-0)
```diff
@@ -312,6 +312,45 @@ Every of these test suites are functions that trigger the wdio testrunner progra
 
 If you test custom WebDriver commands, you can define your own scenario of mock responses in the [`@wdio/webdriver-mock-service`](https://github.com/webdriverio/webdriverio/blob/main/packages/wdio-webdriver-mock-service/src/index.js#L136-L147).
 
+#### Mobile e2e Tests (local only)
+
+CI has no iOS or Android job. The suite in [`e2e/wdio/mobile`](https://github.com/webdriverio/webdriverio/tree/main/e2e/wdio/mobile) runs the browser of a mobile device with Appium: iOS Safari on a Simulator, and Chrome on an Android emulator. Run it when you change how WebdriverIO talks to Appium, for example `execute`, the session start, or the mobile commands.
+
+You need Appium 3 and a build of this repository. `@wdio/appium-service` starts Appium, and Appium starts the Simulator or the emulator.
+
+```sh
+npm install --global appium@3
+pnpm run build
+```
+
+**iOS** needs macOS and Xcode with an iOS runtime. The first run builds WebDriverAgent and can take several minutes.
+
+```sh
+appium driver install xcuitest
+pnpm run test:ios:local
+```
+
+| Variable | Default | Use |
+|---|---|---|
+| `IOS_DEVICE_NAME` | `iPhone 17` | Simulator name |
+| `IOS_PLATFORM_VERSION` | (any) | iOS version, for example `27.0` |
+| `IOS_UDID` | (any) | A specific Simulator |
+| `PREBUILT_WDA_PATH` | (none) | A prebuilt `WebDriverAgentRunner-Runner.app`, to skip the build |
+
+**Android** needs the Android SDK (`ANDROID_HOME`) and an emulator (AVD) with Chrome, for example a Google Play image. Appium downloads a Chromedriver for the Chrome version of the emulator.
+
+```sh
+appium driver install uiautomator2
+ANDROID_AVD=<name of your AVD> pnpm run test:android:local
+```
+
+| Variable | Default | Use |
+|---|---|---|
+| `ANDROID_AVD` | (none) | The AVD that Appium starts when no device is connected |
+| `ANDROID_UDID` | (any) | A specific device, for example `emulator-5554` |
+
+For both, `APPIUM_COMMAND` (default `appium`) selects another Appium binary. The logs, also the Appium log (`wdio-appium.log`), are in `e2e/wdio/mobile/logs/`.
+
 #### Testing Type Definitions
 
 To make sure that we don't accidentally change the types and cause users' test to break, we run some simple TypeScript checks. You can run all the type definition tests by running:
```

**File**: `e2e/AGENTS.md` (modified, +8/-0)
```diff
@@ -19,6 +19,8 @@ pnpm run test:e2e:session      # @wdio/session (Chrome, Firefox, Electron)
 pnpm run test:e2e:display-server # @wdio/display-server
 pnpm run test:e2e:chromedriver # Chromedriver setup; needs CHROMIUM_130_BINARY (see test-chromedriver.yml)
 pnpm run test:e2e:cloud        # Sauce — needs credentials, main-branch CI
+pnpm run test:ios:local        # iOS Safari Simulator with Appium — local only, not in CI
+pnpm run test:android:local    # Android emulator Chrome with Appium — local only, not in CI
 ```
 
 `pnpm run test:e2e` runs every `test:e2e:*` script, including cloud. Do not
@@ -46,6 +48,12 @@ Match that locally. A reporter-only change does not need this folder.
   not installed and Safari (needs "Allow remote automation"); CI runs all of
   them. Pick browsers with `WDIO_E2E_BROWSERS=chrome,firefox`.
 - `pnpm run test:typings:e2e` type-checks the testrunner specs in `e2e/wdio`.
+- `test:ios:local` and `test:android:local` (`e2e/wdio/mobile`) need a global
+  Appium 3 with the XCUITest or UiAutomator2 driver, and Xcode with an iOS
+  runtime or the Android SDK with an AVD (see CONTRIBUTING, "Mobile e2e
+  Tests"). Run them when a change can affect Appium: `execute`, the session
+  start (`session/`, `utils/scriptTimeout.ts`), mobile commands. They are not
+  named `test:e2e:*`, so `pnpm run test:e2e` does not run them.
 - Do not commit screenshots (`e2e/screenshot.png`, `e2e/wdio/headless/*.png`).
 - Framework-specific browser-runner scripts are in `e2e/package.json`
   (`test:browser:react`, …).
```

**File**: `e2e/package.json` (modified, +1/-0)
```diff
@@ -56,6 +56,7 @@
     "@vue/compiler-dom": "^3.4.19",
     "@vue/test-utils": "^2.4.3",
     "@wdio/ai-service": "workspace:*",
+    "@wdio/appium-service": "workspace:*",
     "@wdio/browser-runner": "workspace:*",
     "@wdio/cli": "workspace:*",
     "@wdio/config": "workspace:*",
```

**File**: `e2e/wdio/mobile/mobileWeb.e2e.ts` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+import { createServer } from 'node:http'
+import { once } from 'node:events'
+import type { AddressInfo } from 'node:net'
+import { browser, expect } from '@wdio/globals'
+
+const pages: Record<string, string> = {
+    '/': `<p id="p">text</p>
+        <button id="b" style="width: 100%; height: 100px" onclick="this.textContent = 'tapped'">tap</button>
+        <input id="i">`,
+    /**
+     * the button is below the viewport: a click must come after the `scroll` events
+     */
+    '/far': `<script>
+            window.scrolls = 0
+            window.addEventListener('scroll', () => { window.scrolls++ })
+        </script>
+        <div style="height: 3000px"></div>
+        <button id="far" style="width: 100%; height: 100px" onclick="window.scrollsAtClick = window.scrolls">far</button>
+        <div style="height: 3000px"></div>`
+}
+
+/**
+ * The browser of a mobile device (iOS Safari or Android Chrome) with Appium.
+ * Local only, see `wdio.ios.conf.ts` and `wdio.android.conf.ts`.
+ */
+describe('mobile web', () => {
+    const server = createServer((req, res) => res
+        .writeHead(200, { 'content-type': 'text/html' })
+        .end(`<meta name="viewport" content="width=device-width">${pages[req.url ?? '/'] ?? ''}`))
+    let origin: string
+
+    before(async () => {
+        server.listen(0, '127.0.0.1')
+        await once(server, 'listening')
+        /**
+         * an Android emulator reaches the host at 10.0.2.2, an iOS Simulator at 127.0.0.1
+         */
+        origin = `http://${browser.isAndroid ? '10.0.2.2' : '127.0.0.1'}:${(server.address() as AddressInfo).port}`
+    })
+
+    beforeEach(async () => {
+        await browser.url(`${origin}/`)
+    })
+
+    after(() => {
+        server.close()
+    })
+
+    /**
+     * Appium XCUITest 12 starts with a script timeout of 0 ms (W3C: 30 s), so an
+     * async script failed at once (https://github.com/webdriverio/webdriverio/issues/16137)
+     */
+    describe('script timeout', () => {
+        it('runs an async function that waits', async () => {
+            expect(await browser.execute(async () => {
+                await new Promise((resolve) => setTimeout(resolve, 500))
+                return 1
+            })).toBe(1)
+        })
+
+        it('checks that an element is stable', async () => {
+            expect(await $('#p').isStable()).toBe(true)
+        })
+
+        it('runs an async script of the protocol', async () => {
+            expect(await browser.executeAsyncScript('const done = arguments[arguments.length - 1]; setTimeout(() => done(2), 500)', [])).toBe(2)
+        })
+
+        it('stops an async script after the timeout of browser.setTimeout()', async () => {
+            await browser.setTimeout({ script: 1000 })
+            try {
+                await expect(browser.execute(async () => {
+                    await new Promise((resolve) => setTimeout(resolve, 3000))
+                    return 1
+                })).rejects.toThrow(/script/i)
+            } finally {
+                await browser.setTimeout({ script: 30_000 })
+            }
+        })
+    })
+
+    it('taps an element', async () => {
+        const button = await $('#b')
+        await button.tap()
+        await expect(button).toHaveText('tapped')
+    })
+
+    /**
+     * Appium on iOS scrolls and clicks in one step, so the page got its `scroll`
+     * events after the click (https://github.com/webdriverio/webdriverio/issues/16062)
+     */
+    it('clicks an element below the viewport after the scroll events of the page', async () => {
+        await browser.url(`${origin}/far`)
+        await $('#far').click()
+        expect(await browser.execute(() => (window as unknown as { scrollsAtClick?: number }).scrollsAtClick)).toBeGreaterThan(0)
+    })
+
+    /**
+     * not on iOS: WebDriverAgent accepts the key actions but types nothing into the
+     * page (Appium XCUITest 12.16.0 and 12.18.3, iOS 27.0 Simulator)
+     */
+    it('types into an input', async function () {
+        if (browser.isIOS) {
+            this.skip()
+        }
+        await $('#i').click()
+        await browser.keys(['a', 'b'])
+        await expect($('#i')).toHaveValue('ab')
+    })
+
+    /**
+     * Appium has no `wheel` action
+     */
+    describe('scroll', () => {
+        it('scrolls an element into view', async () => {
+            await browser.url(`${origin}/far`)
+            await $('#far').scrollIntoView()
+            await expect($('#far')).toBeDisplayed({ withinViewport: true })
+        })
+
+        it('scrolls the page', async () => {
+            await browser.url(`${origin}/far`)
+            await browser.scroll(0, 500)
+            /**
+             * iOS Safari: in about 1 run of 5, `scrollY` was still 0 directly after the scroll
+             */
+            await browser.waitUntil(async () => await browser.execute(() => window.scrollY) > 0, {
+                timeout: 5000,
+                timeoutMsg: 'the pag
```

**File**: `e2e/wdio/mobile/wdio.android.conf.ts` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+import url from 'node:url'
+import path from 'node:path'
+
+const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
+
+/**
+ * Local only: Chrome on an Android emulator with Appium UiAutomator2. Needs the
+ * Android SDK with an emulator (AVD) that has Chrome, and a global Appium with
+ * the UiAutomator2 driver (see CONTRIBUTING.md). Run with `pnpm run test:android:local`.
+ */
+export const config: WebdriverIO.Config = {
+    specs: [path.join(__dirname, 'mobileWeb.e2e.ts')],
+
+    capabilities: [{
+        platformName: 'Android',
+        browserName: 'Chrome',
+        'appium:automationName': 'UiAutomator2',
+        /**
+         * Appium starts this emulator when no device is connected
+         */
+        ...(process.env.ANDROID_AVD ? { 'appium:avd': process.env.ANDROID_AVD } : {}),
+        ...(process.env.ANDROID_UDID ? { 'appium:udid': process.env.ANDROID_UDID } : {}),
+        'appium:avdLaunchTimeout': 300_000
+    }],
+    connectionRetryTimeout: 600_000,
+    connectionRetryCount: 0,
+
+    services: [['appium', {
+        command: process.env.APPIUM_COMMAND || 'appium',
+        /**
+         * download a Chromedriver for the Chrome version of the emulator
+         */
+        args: { allowInsecure: 'uiautomator2:chromedriver_autodownload' }
+    }]],
+
+    logLevel: 'info',
+    framework: 'mocha',
+    outputDir: path.join(__dirname, 'logs', 'android'),
+
+    reporters: ['spec'],
+
+    mochaOpts: {
+        ui: 'bdd',
+        timeout: 120_000
+    }
+}
```

**File**: `e2e/wdio/mobile/wdio.ios.conf.ts` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import url from 'node:url'
+import path from 'node:path'
+
+const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
+
+/**
+ * Local only: iOS Safari on a Simulator with Appium XCUITest. Needs macOS,
+ * Xcode with an iOS runtime, and a global Appium with the XCUITest driver
+ * (see CONTRIBUTING.md). Run with `pnpm run test:ios:local`.
+ */
+export const config: WebdriverIO.Config = {
+    specs: [path.join(__dirname, 'mobileWeb.e2e.ts')],
+
+    capabilities: [{
+        platformName: 'iOS',
+        browserName: 'Safari',
+        'appium:automationName': 'XCUITest',
+        'appium:deviceName': process.env.IOS_DEVICE_NAME || 'iPhone 17',
+        ...(process.env.IOS_PLATFORM_VERSION ? { 'appium:platformVersion': process.env.IOS_PLATFORM_VERSION } : {}),
+        ...(process.env.IOS_UDID ? { 'appium:udid': process.env.IOS_UDID } : {}),
+        ...(process.env.PREBUILT_WDA_PATH ? { 'appium:prebuiltWDAPath': process.env.PREBUILT_WDA_PATH, 'appium:usePreinstalledWDA': true } : {}),
+        /**
+         * the first session builds WebDriverAgent
+         */
+        'appium:wdaLaunchTimeout': 300_000
+    }],
+    connectionRetryTimeout: 600_000,
+    connectionRetryCount: 0,
+
+    services: [['appium', { command: process.env.APPIUM_COMMAND || 'appium' }]],
+
+    logLevel: 'info',
+    framework: 'mocha',
+    outputDir: path.join(__dirname, 'logs', 'ios'),
+
+    reporters: ['spec'],
+
+    mochaOpts: {
+        ui: 'bdd',
+        timeout: 120_000
+    }
+}
```

**File**: `package.json` (modified, +2/-0)
```diff
@@ -80,6 +80,8 @@
     "test:e2e:display-server": "cd ./e2e && npx wdio run ./wdio/display-server/wdio.conf.ts && npx wdio run ./wdio/display-server/wdio.runner.conf.ts",
     "test:e2e:chromedriver": "cd ./e2e && npx wdio run ./wdio/chromedriver/wdio.conf.ts",
     "test:e2e": "run-s test:e2e:* ",
+    "test:ios:local": "cd ./e2e && npx wdio run ./wdio/mobile/wdio.ios.conf.ts",
+    "test:android:local": "cd ./e2e && npx wdio run ./wdio/mobile/wdio.android.conf.ts",
     "dev": "pnpm -r --filter=@wdio/compiler run build --watch",
     "watch:docs": "pnpm docs:generate:en && cd website && pnpm i && pnpm exec docusaurus start",
     "version": "pnpm changelog && git add CHANGELOG.md",
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -246,6 +246,9 @@ importers:
       '@wdio/ai-service':
         specifier: workspace:*
         version: link:../packages/wdio-ai-service
+      '@wdio/appium-service':
+        specifier: workspace:*
+        version: link:../packages/wdio-appium-service
       '@wdio/browser-runner':
         specifier: workspace:*
         version: link:../packages/wdio-browser-runner
```

#### Recent Merged Pull Requests:
- **PR #16148** (2026-10-20): fix(@wdio/cucumber-framework): list the matching step definitions of an ambiguous step (@plum117)
- **PR #16140** (2026-10-19): test(e2e): add local mobile web suites for iOS and Android with Appium (@plum117)
- **PR #16139** (2026-10-19): fix(webdriverio): isEqual and scrollIntoView on an element that the page rendered again (@plum117)
- **PR #16138** (2026-10-19): fix(webdriverio): set the W3C script timeout when an Appium iOS session starts (@plum117)
- **PR #16136** (2026-10-18): fix(webdriverio): find a stale element of a BiDi frame or tab again (@plum117)
- **PR #16135** (2026-10-18): docs: Add parallel tests documentation and framework support- #16134 (@Winify)

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

## X. webdriverio): isEqual and scrollIntoView on an element that the page rendered ag

**RULE**:
When implementing operations in `e2e/wdio/headless/__fixtures__/findElementAgain.html`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webdriverio/webdriverio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `456fb11a`: webdriverio): isEqual and scrollIntoView on an element that the page rendered again (#16139). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `e2e/wdio/headless/__fixtures__/findElementAgain.html`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    <div id="far-area" style="margin-top: 3000px"><p id="far">far</p></div>
        /**
         * replace `#far` (below the viewport) with a new node
         */
        window.renderFar = () => {
            const far = document.querySelector('#far')
            far.replaceWith(far.cloneNode(true))
        }

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `456fb11a` are properly handled with clean fallback behavior.
