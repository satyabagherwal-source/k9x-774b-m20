> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/webdriverio-webdriverio-learnings.md`  
> **Source**: github ([https://github.com/webdriverio/webdriverio](https://github.com/webdriverio/webdriverio))  
> **Source Version**: `dc7be72b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T20:22:00.538Z  
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
> **Harvest Timestamp**: 2026-10-30T20:22:00.339Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webdriverio/webdriverio`
- **Description**: Next-gen browser and mobile automation test framework for Node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9866 stars

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
- **Issue #16308** (2026-10-30): **fix(webdriverio, @wdio/session): report a value the browser rejected or reformatted in fill, and reject an empty range value**
  *Symptoms*: ## Proposed changes  Since #16230, `setValue` throws `The browser rejected the value …` when an input it sets directly (date, time, range, color …) keeps its previous value. `wdio session fill` let that error through, so `e2e/session/inputs.test.ts` fails on `main` ([run 41008605345](https://github.com/webdriverio/webdriverio/actions/runs/41008605345/job/123909885702)). The PR did not run Session E2E, because the `session` path filter does not include `packages/webdriverio`.  | `wdio session fill …` | main | this PR | |---|---|---| | `#start 10/04/2026` (date) | `✖ The browser rejected the value "10/04/2026" for this input, …` | `✖ "#start" did not take "10/04/2026"; it has "".` + `A date input takes values like 2026-10-04.` | | `'label:has(#start)' 10/04/2026` (label around the date input) | same raw message, exit 1 | same as above, exit 2 | | `#volume loud` (range) | raw message | `did not take "loud"; it has "50".` + `A range input takes values like 50.` | | `#volume ''` (range at 70) | `Set "#volume" to 50 (it took 50: the nearest allowed value)` | `did not take ""; it has "70".` | | `#paint '#FF8800'` (color) | `✖ "#paint" did not take "#FF8800"; it has "#ff8800".` (the page has the color) | `Set "#paint" to #ff8800 (it took #ff8800: the format of the input)` | | `#start 2026-10-04` (the page puts back `2026-01-01`) | `did not take "2026-10-04"; it has "2026-01-01".` | same |  - `@wdio/session`: one helper turns the rejection into the usage error on the direct path and o

- **Issue #16303** (2026-10-29): **fix(@wdio/utils): don't pass spawnOpts to Chromedriver as a --spawn-ppts flag**
  *Symptoms*: ## Proposed changes  [//]: # (Describe the big picture of your changes here to communicate to the maintainers why we should accept this pull request. If it fixes a bug or resolves a feature request, be sure to link to that issue.)  ## How you tested  [//]: # (Name the smallest commands you ran, e.g. `pnpm run test:package webdriverio` or `pnpm run test:smoke mochaTestrunner`. Agents: see AGENTS.md.)  - [ ] Unit tests for the touched package(s) - [ ] Type definition tests (if the public API / command types changed) - [ ] Smoke or e2e (only if the testrunner, launcher, or a real browser path changed)  ## Types of changes  [//]: # (What types of changes does your code introduce to WebdriverIO?) [//]: # (_Put an `x` in the boxes that apply_)  - [ ] Polish (an improvement for an existing feature) - [ ] Bugfix (non-breaking change which fixes an issue) - [ ] New feature (non-breaking change which adds functionality) - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) - [ ] Documentation update (improvements to the project's docs) - [ ] Specification changes (updates to WebDriver command specifications) - [ ] Internal updates (everything related to internal scripts, governance documentation and CI files)  ## Checklist  [//]: # (_Put an `x` in the boxes that apply. You can also fill these out after creating the PR. If you're unsure about any of them, don't hesitate to ask. We're here to help! This is simply a reminder of what we are 

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

### Incident Patch 1: `cfe0e018` (2026-10-28)
**Commit Message**: fix(@wdio/html-reporter, @wdio/reporter, @wdio/video-reporter, @wdio/mocha-framework): label each failed attempt of a retried test, copy the styles safely on Windows, give the Mocha config root hooks their own title, and use the base reporter's hook owner and spec file attempt (#16277)

* refactor(@wdio/html-reporter): find the suite of an event with no test context from the hook owner of the base reporter

The base reporter gives the owner of the open hook: the suite of a before
all hook (hookSuiteUid) or the scenario of a Cucumber Before hook. The
html reporter keeps the waiting events of each suite and the suites in
which a test started, in place of its own stack of open suites; with no
hook kind (another framework) it takes the innermost open suite of the
base. No output change.

* test(@wdio/reporter): the attempt of a spec file with specFileRetries

This test fails: RunnerStats has only the runner value, which is
specFileRetries + 1 for the first attempt and 1 with no retries.

* refactor(@wdio/reporter, @wdio/html-reporter, @wdio/video-reporter): decode the spec file attempt one time in RunnerStats

* fix(@wdio/html-reporter): list each root hook one time, and label the fail

**File**: `packages/wdio-html-reporter/README.md` (modified, +2/-0)
```diff
@@ -66,6 +66,8 @@ When a worker stops before it writes its results (for example it is killed), or
 
 With [`specFileRetries`](https://webdriver.io/docs/retry#add-retries-on-a-per-specfile-basis), each attempt of a spec file writes its own file (`report-0-0.json`, `report-0-0-retry1.json`). The master report shows every attempt that wrote its results, with `(spec file attempt 1, retried)` after the suite titles of an earlier attempt, and counts only the last attempt. Only files with the same name except `-retry<n>` are attempts of one spec file (2 configurations with another `filename` stay separate); an old file of another spec file is left out, and a stopped attempt that a later attempt replaced does not make the report incomplete.
 
+When a test or a Cucumber scenario runs again (Mocha [`retries`](https://webdriver.io/docs/retry#rerun-suites-in-mocha), the Cucumber [`retry`](https://webdriver.io/docs/retry#rerunning-in-cucumber) option, Vitest `retry`), each failed attempt stays in the report as its own entry, with `(attempt 1, retried)` after its title; only the last attempt counts.
+
 The master report uses the options of the `ReportAggregator`: set `linkScreenshots`, `linkUrls`, `collapseTests`, `collapseSuites` and `showInBrowser` there. The options of the reporter are for the JSON files and the report of each worker (`produceHtml`).
 
 ## Options
```

**File**: `packages/wdio-html-reporter/src/htmlGenerator.ts` (modified, +33/-2)
```diff
@@ -13,6 +13,37 @@ import url from 'node:url'
 
 dayjs.extend(duration)
 
+/** Windows: a file that another worker copies, or that an antivirus scans, is locked for a short time */
+const BUSY_RETRIES = 20
+const BUSY_RETRY_WAIT = 50
+const BUSY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
+
+/**
+ * The workers of a run copy the same styles and font next to their reports, at the same time on parallel
+ * workers: wait for a locked copy, then check the file
+ */
+async function copyAsset (from: string, to: string) {
+    const content = await fsp.readFile(from)
+    const copied = () => fsp.readFile(to).then((existing) => existing.equals(content), () => false)
+    for (let tries = 0; ; tries++) {
+        if (await copied()) {
+            return
+        }
+        try {
+            return await fsp.copyFile(from, to)
+        } catch (err) {
+            if (!BUSY_CODES.has((err as NodeJS.ErrnoException).code ?? '') || tries === BUSY_RETRIES) {
+                // another worker can end its copy during the last try
+                if (await copied()) {
+                    return
+                }
+                throw err
+            }
+            await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_WAIT))
+        }
+    }
+}
+
 /**
  * The path of a file relative to the report, as a link: the browser reads `#`, `?`
  * and `%` in a file name as URL characters
@@ -277,11 +308,11 @@ class HtmlGenerator {
 
                         const reportCss = rootdirname + '/css/report-styles.css'
                         const destCss = reportOptions.outputDir + '/report-styles.css'
-                        await fsp.copyFile(reportCss, destCss)
+                        await copyAsset(reportCss, destCss)
 
                         const cssFont = rootdirname + '/css/glyphicons-halflings-regular.woff'
                         const fontDest = reportOptions.outputDir + '/glyphicons-halflings-regular.woff'
-                        await fsp.copyFile(cssFont, fontDest)
+                        await copyAsset(cssFont, fontDest)
                     }
                 } catch (error) {
                     failed = true
```

**File**: `packages/wdio-html-reporter/src/htmlReporter.ts` (modified, +60/-38)
```diff
@@ -3,10 +3,9 @@ import type {
     CommandArgs,
     HookStats,
     RunnerStats,
-    SuiteStats,
     TestStats
 } from '@wdio/reporter'
-import WDIOReporter, { getSessionNames, hookCountsAsFailure, knownFramework } from '@wdio/reporter'
+import WDIOReporter, { getSessionNames, hookCountsAsFailure, knownFramework, SuiteStats } from '@wdio/reporter'
 
 import  { HtmlReporterOptions, InternalReportEvent, Metrics, ReportData } from './types.js'
 import dayjs from 'dayjs'
@@ -21,8 +20,6 @@ import util from 'node:util'
 import logger from '@wdio/logger'
 
 type ReportEvent = InternalReportEvent | { type: string, value: unknown }
-/** sequential mode: a suite whose first test did not start yet, and the events of its before hooks */
-type WaitingSuite = { uid?: string, events: ReportEvent[] }
 
 const reportProxy = new ReportEvents()
 const TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSS[Z]'
@@ -43,17 +40,6 @@ function reportCapabilities (capabilities: unknown) {
     return Object.fromEntries(REPORT_CAPABILITIES.filter((name) => caps[name] !== undefined).map((name) => [name, caps[name]]))
 }
 
-/**
- * The attempt of a spec file with `specFileRetries`: 0 for the first one. The runner gives
- * the first attempt `specFileRetries + 1` (the launcher does not know the retries yet),
- * and 1 when there are no retries
- */
-function specFileAttempt (runner: RunnerStats) {
-    const specFileRetries = (runner.config as { specFileRetries?: number } | undefined)?.specFileRetries ?? 0
-    const retry = runner.retry ?? 0
-    return specFileRetries && retry <= specFileRetries ? retry : 0
-}
-
 /**
  * The runner data for the report files, which are often shared (for example as CI
  * artifacts): only the fields that the report uses, and no configuration, session
@@ -75,7 +61,7 @@ function reportInfo (runner: RunnerStats): RunnerStats {
         end: runner.end,
         _duration: runner._duration,
         isMultiRemote: runner.isMultiRemote,
-        retry: specFileAttempt(runner),
+        retry: runner.specFileAttempt,
         capabilities,
         // the names of the full capabilities: the reduced copy above cannot name an app
         browserNames: getSessionNames(runner.capabilities, runner.isMultiRemote),
@@ -113,11 +99,12 @@ export default class HtmlReporter extends WDIOReporter {
     /** parallel mode: the events of a context before its test starts (a before hook) */
     #earlyEvents = new Map<string, ReportEvent[]>()
     /**
-     * sequential mode: the open suites whose first test did not start yet, the outer one first
-     * (the first one is for the events before any suite). An event with no test context (a
-     * `before all` or Cucumber `Before` hook) waits in the innermost one for the next test
+     * sequential mode: the events with no test context of each suite in which no test started yet
+     * (a `before all` or Cucumber `Before` hook, or the root suite before any suite), for its next test
      */
-    #waitingSuites: WaitingSuite[] = [{ events: [] }]
+    #suiteEvents = new Map<SuiteStats, ReportEvent[]>()
+    /** sequential mode: the suites in which a test started */
+    #startedSuites = new WeakSet<SuiteStats>()
     /** parallel mode: a test of a context started (a skipped test never starts); until then, events with no context wait */
     #contextTestStarted = false
     /** the screenshot files of `useOnAfterCommandForScreenshot` */
@@ -175,8 +162,8 @@ export default class HtmlReporter extends WDIOReporter {
         this.on('suite:retry', ({ uid, contextId }: { uid: string, contextId?: string }) => {
             if (contextId) {
                 this.#contextTests.delete(contextId)
-            } else {
-                this.#waitingSuites = [{ uid, events: [] }]
+            } else if (this.suites[uid]) {
+                this.#startedSuites.delete(this.suites[uid])
             }
         })
     }
@@ -203,9 +190,6 @@ export default class HtmlReporter extends WDIOReporter {
 
     onSuiteStart(suite: SuiteStats) {
         this._suiteUids.set(suite.uid, suite)
-        if (!this.#contextTestStarted) {
-            this.#waitingSuites.push({ uid: suite.uid, events: [] })
-        }
         suite.start = new Date()
         this.LOG.info(`onSuiteStart: ${suite.cid}:${suite.uid}`)
     }
@@ -246,9 +230,33 @@ export default class HtmlReporter extends WDIOReporter {
         }
     }
 
+    /** the waiting events of the open suites, the outer suite first (the first parallel test also takes those of the other suites) */
     #takeWaitingEvents(events: ReportEvent[]) {
-        events.push(...this.#waitingSuites.flatMap((suite) => suite.events))
-        this.#waitingSuites = []
+        for (const suite of [...this.currentSuites, ...this.#suiteEvents.keys()]) {
+            events.push(...this.#suiteEvents.get(suite) ?? [])
+            this.#suiteEvents.delete(suite)
+            this.#startedSuites.add(suite)
+        }
+    }
+
+    /**
+     * sequential mode: the suite whose next test
```

**File**: `packages/wdio-html-reporter/tests/htmlGenerator.test.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import fs from 'node:fs'
+import fsp from 'node:fs/promises'
+import os from 'node:os'
+import path from 'node:path'
+import { describe, expect, it, vi } from 'vitest'
+
+import HtmlGenerator from '../src/htmlGenerator.js'
+import { Metrics, ReportData } from '../src/types.js'
+import type { HtmlReporterOptions } from '../src/types.js'
+import { RUNNER } from './testdata.js'
+
+describe('HtmlGenerator.htmlOutput', () => {
+    // the workers of a run write their reports to the same folder, and each copies the styles and the font
+    it('copies the styles and the font when several reports in one folder end at the same time', async () => {
+        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-assets-'))
+        const options = { outputDir, filename: 'report.html', reportTitle: 'Assets', produceHtml: true } as HtmlReporterOptions
+        for (let round = 0; round < 5; round++) {
+            const results = await Promise.all(Array.from({ length: 16 }, (_, worker) => HtmlGenerator.htmlOutput(options,
+                new ReportData('Assets', RUNNER, [], new Metrics(), path.join(outputDir, `report-${round}-${worker}.html`), 'chrome'))))
+            expect(results.every(Boolean)).toBe(true)
+        }
+        const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'report-styles.css'))
+        expect(fs.readFileSync(path.join(outputDir, 'report-styles.css')).equals(css)).toBe(true)
+        expect(fs.existsSync(path.join(outputDir, 'glyphicons-halflings-regular.woff'))).toBe(true)
+    })
+
+    // Windows: a copy fails with EBUSY while the file is locked, for example while another worker copies it
+    it.each([
+        ['passes when another worker writes the same file', 'same', 1, true],
+        ['passes when another worker writes the same file after 9 busy copies (an antivirus scan)', 'same', 10, true],
+        ['fails when an old file stays locked', 'old', 1, false],
+        ['fails when the file is not there', 'none', 1, false]
+    ])('a busy copy of the styles %s', async (_name, file, writtenAtCall, expected) => {
+        const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-busy-'))
+        const options = { outputDir, filename: 'report.html', reportTitle: 'Busy', produceHtml: true } as HtmlReporterOptions
+        let calls = 0
+        const copyFile = vi.spyOn(fsp, 'copyFile').mockImplementation(async (from, to) => {
+            if (file !== 'none' && ++calls >= writtenAtCall) {
+                fs.writeFileSync(to as string, file === 'same' ? fs.readFileSync(from as string) : 'old styles')
+            }
+            throw Object.assign(new Error('EBUSY: resource busy or locked, copyfile'), { code: 'EBUSY' })
+        })
+        try {
+            const result = await HtmlGenerator.htmlOutput(options, new ReportData('Busy', RUNNER, [], new Metrics(), path.join(outputDir, 'report.html'), 'chrome'))
+            expect(result).toBe(expected)
+        } finally {
+            copyFile.mockRestore()
+        }
+    })
+})
```

**File**: `packages/wdio-html-reporter/tests/reporter.test.ts` (modified, +51/-4)
```diff
@@ -747,6 +747,35 @@ describe('retries and hooks of a feature', () => {
         expect(classOf('flaky suite')).toBe('suite-pass')
     })
 
+    // Mocha `retries`, Cucumber scenario level and Vitest retry a test: each failed attempt is its own entry
+    it.each([
+        ['a new uid for each attempt (Mocha)', (attempt: number) => attempt ? `t1-retry${attempt}` : 't1'],
+        ['the same uid for each attempt (Cucumber scenario level)', () => 't1']
+    ])('labels the failed attempts of a retried test, %s', async (_name, uid) => {
+        const { json } = await run(`retried-test-${uid(1)}`, (reporter) => {
+            reporter.emit('suite:start', suite('flaky suite'))
+            for (const attempt of [0, 1]) {
+                reporter.emit('test:start', { ...test(uid(attempt), 'flaky', 'flaky suite'), retries: attempt })
+                reporter.emit('test:retry', { ...test(uid(attempt), 'flaky', 'flaky suite'), error: { message: `attempt ${attempt + 1}` } })
+            }
+            reporter.emit('test:start', { ...test(uid(2), 'flaky', 'flaky suite'), retries: 2 })
+            reporter.emit('test:pass', test(uid(2), 'flaky', 'flaky suite'))
+            reporter.emit('test:end', test(uid(2), 'flaky', 'flaky suite'))
+            reporter.emit('suite:end', suite('flaky suite'))
+        })
+        expect(json.suites[0].tests.map((entry: { title: string, state: string }) => [entry.title, entry.state])).toEqual([
+            ['flaky (attempt 1, retried)', 'failed'],
+            ['flaky (attempt 2, retried)', 'failed'],
+            ['flaky', 'passed']
+        ])
+        // the page shows the error of each failed attempt
+        expect(json.suites[0].tests.map((entry: { events: { type: string, value: { message: string } }[] }) => entry.events.filter((event) => event.type === 'Error').map((event) => event.value.message))).toEqual([
+            ['attempt 1'],
+            ['attempt 2'],
+            []
+        ])
+    })
+
     // @wdio/vitest-framework sends the failed hook of a retried attempt with `retried: true`
     it('shows a suite with a failed hook of a retried attempt as passed when the test passed on retry', async () => {
         const { classOf } = await run('k24-hook', (reporter) => {
@@ -800,8 +829,10 @@ describe('retries and hooks of a feature', () => {
             const attempts = feature.suites.map((entry: { title: string, start: string, end: string, _duration: number, tests: { state: string }[] }) => ({
                 title: entry.title, start: entry.start, end: entry.end, duration: entry._duration, states: entry.tests.map((step) => step.state)
             }))
+            // the scenario has the label, not its failed step
+            expect(feature.suites[0].tests[0].title).toBe('a step')
             expect(attempts).toEqual([
-                { title: 'S', start: '2026-10-25T10:00:00.000Z', end: '2026-10-25T10:00:03.000Z', duration: 3000, states: ['failed', ...after] },
+                { title: 'S (attempt 1, retried)', start: '2026-10-25T10:00:00.000Z', end: '2026-10-25T10:00:03.000Z', duration: 3000, states: ['failed', ...after] },
                 // the scenario keeps the start of its first attempt and the duration of all attempts, as main
                 { title: 'S', start: '2026-10-25T10:00:00.000Z', end: '2026-10-25T10:00:07.000Z', duration: 7000, states: ['passed', ...after.map(() => 'passed')] }
             ])
@@ -814,7 +845,7 @@ describe('retries and hooks of a feature', () => {
         }
     })
 
-    it('gives the second failed attempt of a Cucumber scenario its own times', async () => {
+    it('gives the second failed attempt of a Cucumber scenario its own times and attempt label', async () => {
         vi.useFakeTimers({ toFake: ['Date'] })
         const at = (time: string) => vi.setSystemTime(new Date(`2026-10-25T10:00:${time}.000Z`))
         try {
@@ -837,8 +868,8 @@ describe('retries and hooks of a feature', () => {
                 reporter.emit('suite:end', suite('S', 'scenario', 'F'))
                 reporter.emit('suite:end', suite('F', 'feature'))
             }, cucumber)
-            const times = json.suites[0].suites.map((entry: { start: string, end: string }) => [entry.start.slice(17, 19), entry.end.slice(17, 19)])
-            expect(times).toEqual([['00', '03'], ['03', '06'], ['00', '08']])
+            const times = json.suites[0].suites.map((entry: { title: string, start: string, end: string }) => [entry.title, entry.start.slice(17, 19), entry.end.slice(17, 19)])
+            expect(times).toEqual([['S (attempt 1, retried)', '00', '03'], ['S (attempt 2, retried)', '03', '06'], ['S', '00', '08']])
         } finally {
             vi.useRealTimers()
         }
@@ -1407,6 +1438,22 @@ describe('sequential mode: events of a before hook', () => {
         expect(logsOf(reporter, 'B1')).toEqual(['before all of A', 'before all of B'])
     })
 
+    it('takes the suite of a before all hook from the hook owner of the base reporte
```

**File**: `packages/wdio-mocha-framework/src/index.ts` (modified, +41/-28)
```diff
@@ -27,10 +27,16 @@ interface ParsedConfiguration extends Required<WebdriverIO.Config> {
     mochaOpts: MochaOptsImport
 }
 
-/** The reporter fields of a root-suite hook in a sequential run (Mocha's setHookTitle) */
+/** a hook of the config or of a service to run (the runner adds the service hooks before the framework starts) */
+function hasHooks(hooks: unknown) {
+    return [hooks].flat().some((hook) => typeof hook === 'function')
+}
+
+/** The reporter fields of the root-suite hook of the config hooks in a sequential run (Mocha's setHookTitle) */
 function rootHookMessage(kind: 'before all' | 'after all', tests: { title: string }[] = []) {
     const test = kind === 'before all' ? tests[0] : tests[tests.length - 1]
-    const title = test ? `"${kind}" hook for "${test.title}"` : `"${kind}" hook in "{root}"`
+    const hook = `"${kind}" hook: ${kind === 'before all' ? 'beforeSuite' : 'afterSuite'}`
+    const title = test ? `${hook} for "${test.title}"` : `${hook} in "{root}"`
     return { title, fullTitle: title, parent: '', hookKind: kind === 'before all' ? 'beforeAll' as const : 'afterAll' as const }
 }
 
@@ -140,6 +146,8 @@ class MochaAdapter {
 
     async run () {
         const mocha = this._mocha!
+        // the suite duration of afterSuite, also with no beforeSuite hook (which sets it again)
+        this._suiteStartDate = Date.now()
 
         const parallelMode = this._config.mochaOpts?.parallelMode
         if (parallelMode === 'contexts' || parallelMode === 'userContexts') {
@@ -191,21 +199,8 @@ class MochaAdapter {
             mochaSuite.filterOnly?.()
         }
 
-        // Config hooks are surfaced as paired hook:start/hook:end events like
-        // sequential mode's root-suite hooks (wrapHook): prepareMessage payloads
-        // with Mocha's root hook title. They run against the session-global context (no tab).
         const rootTests = (mocha.suite as unknown as { tests?: { title: string }[] }).tests
-        const beforeSuiteMsg = this.prepareMessage('beforeSuite')
-        const beforeSuiteHook = { ...beforeSuiteMsg, ...rootHookMessage('before all', rootTests) }
-        const beforeSuiteUid = this.getSyncEventIdStart('hook')
-        this._reporter.emit('hook:start', { ...beforeSuiteHook, type: 'hook:start', cid: this._cid, specs: this._specs, uid: beforeSuiteUid })
-        try {
-            await executeHooksWithArgs('beforeSuite', this._config.beforeSuite as Function, [beforeSuiteMsg])
-            this._reporter.emit('hook:end', { ...beforeSuiteHook, type: 'hook:end', state: 'pass', duration: Date.now() - this._suiteStartDate, cid: this._cid, specs: this._specs, uid: beforeSuiteUid })
-        } catch (err) {
-            log.error(`Error in beforeSuite hook: ${(err as Error).stack?.slice(7) || (err as Error).message}`)
-            this._reporter.emit('hook:end', { ...beforeSuiteHook, type: 'hook:end', state: 'fail', duration: Date.now() - this._suiteStartDate, error: { name: (err as Error).name || 'Error', message: (err as Error).message, stack: (err as Error).stack }, cid: this._cid, specs: this._specs, uid: beforeSuiteUid })
-        }
+        await this._runRootHook('beforeSuite', rootTests)
 
         let failures: number
         let runtimeError: Error | undefined
@@ -229,19 +224,32 @@ class MochaAdapter {
             failures = 1
         }
 
-        const afterSuiteMsg = this.prepareMessage('afterSuite')
-        const afterSuiteHook = { ...afterSuiteMsg, ...rootHookMessage('after all', rootTests) }
-        const afterSuiteStartUid = this.getSyncEventIdStart('hook')
-        this._reporter.emit('hook:start', { ...afterSuiteHook, type: 'hook:start', cid: this._cid, specs: this._specs, uid: afterSuiteStartUid })
+        await this._runRootHook('afterSuite', rootTests)
+
+        return this._finalize(failures, runtimeError)
+    }
+
+    /**
+     * Parallel mode: the config hooks surface as paired hook:start/hook:end events like sequential mode's
+     * root-suite hooks (wrapHook): prepareMessage payloads with Mocha's root hook title. They run against
+     * the session-global context (no tab)
+     */
+    private async _runRootHook(hookName: 'beforeSuite' | 'afterSuite', rootTests?: { title: string }[]) {
+        if (!hasHooks(this._config[hookName])) {
+            return
+        }
+        const message = this.prepareMessage(hookName)
+        const hook = { ...message, ...rootHookMessage(hookName === 'beforeSuite' ? 'before all' : 'after all', rootTests) }
+        const fields = { cid: this._cid, specs: this._specs, uid: this.getSyncEventIdStart('hook') }
+        const start = Date.now()
+        this._reporter.emit('hook:start', { ...hook, type: 'hook:start', ...fields })
         try {
-            await executeHooksWithArgs('afterSuite', this._config.afterSuite as Function, [afterSuiteMsg])
-            this._reporter.emit('hook:end', { ...afterSuiteHook, type: 'hook:end', state: 'pass', duration: Date.now() - this._suiteStartDate, cid: th
```

**File**: `packages/wdio-mocha-framework/tests/adapter.test.ts` (modified, +74/-11)
```diff
@@ -31,6 +31,9 @@ const adapterFactory = (config: any) => new MochaAdapter(
     wdioReporter as any
 )
 
+/** a config with `beforeSuite` and `afterSuite` hooks (of the config or of a service) */
+const SUITE_HOOKS = { beforeSuite: [() => {}], afterSuite: [() => {}] }
+
 beforeEach(() => {
     wdioReporter.write.mockReset()
     wdioReporter.emit.mockReset()
@@ -50,6 +53,21 @@ test('comes with a factory', async () => {
     expect(result).toBe(0)
 })
 
+test.each([
+    ['beforeSuite and afterSuite', SUITE_HOOKS, ['beforeSuite'], ['afterSuite']],
+    ['beforeSuite only', { beforeSuite: [() => {}], afterSuite: [] }, ['beforeSuite'], []],
+    ['afterSuite only', { afterSuite: () => {} }, [], ['afterSuite']]
+])('adds a root hook with its own title for each config hook to run: %s', async (_name, hooks, before, after) => {
+    // @ts-ignore params not needed for test scenario
+    const adapter = adapterFactory(hooks)
+    await adapter.init()
+    await adapter.run()
+    // @ts-ignore outdated types
+    const runner = adapter['_mocha']!['runner']
+    expect(runner.suite.beforeAll.mock.calls.map(([title]: [string]) => title)).toEqual(before)
+    expect(runner.suite.afterAll.mock.calls.map(([title]: [string]) => title)).toEqual(after)
+})
+
 test('should properly set up mocha', async () => {
     // @ts-ignore params not needed for test scenario
     const adapter = adapterFactory()
@@ -67,10 +85,11 @@ test('should properly set up mocha', async () => {
     // @ts-ignore outdated types
     const runner = adapter['_mocha']!['runner']
     expect(runner.on.mock.calls).toHaveLength(Object.keys(EVENTS).length)
-    expect(runner.suite.beforeAll).toBeCalled()
+    // no beforeSuite / afterSuite hook to run: no root hook for them
+    expect(runner.suite.beforeAll).not.toBeCalled()
     expect(runner.suite.beforeEach).not.toBeCalled()
     expect(runner.suite.afterEach).not.toBeCalled()
-    expect(runner.suite.afterAll).toBeCalled()
+    expect(runner.suite.afterAll).not.toBeCalled()
 
     expect(adapter['_mocha']!.addFile).toBeCalledWith('/foo/bar.test.js')
 })
@@ -202,9 +221,26 @@ describe('prepareMessage', () => {
 })
 
 describe('parallel mode config hooks', () => {
+    test('emits no hook event with no beforeSuite / afterSuite hook to run', async () => {
+        // @ts-ignore params not needed for test scenario
+        const adapter = adapterFactory({ mochaOpts: { parallelMode: 'contexts' }, beforeSuite: [], afterSuite: [] })
+        await adapter.init()
+        adapter['_mocha']!.suite = { suites: [{ title: 'first suite' }] } as any
+
+        ;(globalThis as any).browser = { isBidi: true, __bidiCommandsEnabled: true }
+        try {
+            expect(await adapter.run()).toBe(0)
+        } finally {
+            delete (globalThis as any).browser
+        }
+
+        expect(wdioReporter.emit.mock.calls.filter((c) => c[0].startsWith('hook:'))).toEqual([])
+        expect(runParallelTests).toBeCalledTimes(1)
+    })
+
     test('emits paired hook events around beforeSuite/afterSuite', async () => {
         // @ts-ignore params not needed for test scenario
-        const adapter = adapterFactory({ mochaOpts: { parallelMode: 'contexts' } })
+        const adapter = adapterFactory({ mochaOpts: { parallelMode: 'contexts' }, ...SUITE_HOOKS })
         await adapter.init()
         adapter['_mocha']!.suite = { suites: [{ title: 'first suite' }] } as any
 
@@ -223,9 +259,9 @@ describe('parallel mode config hooks', () => {
         expect(hookStarts.length).toBe(2)
         expect(hookEnds.length).toBe(2)
         // the titles of the root-suite hooks of a sequential run
-        expect(hookStarts.map((c) => c[1].title)).toEqual(['"before all" hook in "{root}"', '"after all" hook in "{root}"'])
-        expect(hookEnds.map((c) => c[1].title)).toEqual(['"before all" hook in "{root}"', '"after all" hook in "{root}"'])
-        expect(hookStarts[0][1].fullTitle).toBe('"before all" hook in "{root}"')
+        expect(hookStarts.map((c) => c[1].title)).toEqual(['"before all" hook: beforeSuite in "{root}"', '"after all" hook: afterSuite in "{root}"'])
+        expect(hookEnds.map((c) => c[1].title)).toEqual(['"before all" hook: beforeSuite in "{root}"', '"after all" hook: afterSuite in "{root}"'])
+        expect(hookStarts[0][1].fullTitle).toBe('"before all" hook: beforeSuite in "{root}"')
         expect(hookStarts[0][1].parent).toBe('')
         expect(hookStarts[0][1].type).toBe('hook:start')
         // start/end share a uid; afterSuite end carries duration + state
@@ -238,7 +274,7 @@ describe('parallel mode config hooks', () => {
 
     test('sends the kind of the beforeSuite / afterSuite root hooks, and the uid of the hook:start on a failing hook:end', async () => {
         // @ts-ignore params not needed for test scenario
-        const adapter = adapterFactory({ mochaOpts: { parallelMode: 'contexts' } })
+        const adapter = adapterFactory({ mochaOpts: { parallelMode: 'contexts' }, ...SUITE_HO
```

**File**: `packages/wdio-mocha-framework/tests/hookKind.test.ts` (modified, +3/-3)
```diff
@@ -22,7 +22,7 @@ async function run(build: (root: Mocha.Suite) => void, mochaOpts: Record<string,
     }
     const adapter = new MochaAdapter(
         '0-0',
-        { mochaOpts: { failHookAffectedTests: true, ...mochaOpts }, after: [], beforeSuite: [], afterSuite: [] } as never,
+        { mochaOpts: { failHookAffectedTests: true, ...mochaOpts }, after: [], beforeSuite: [() => {}], afterSuite: [() => {}] } as never,
         ['/spec.js'],
         {},
         reporter
@@ -59,14 +59,14 @@ describe('Mocha sequential hook events: hookKind and hookSuiteUid', () => {
         expect(starts).toEqual([
             // the root `before` and WDIO beforeSuite: the root suite has no suite event, so no hookSuiteUid
             ['"before all" hook: root setup in "{root}"', 'beforeAll', undefined],
-            ['"before all" hook in "{root}"', 'beforeAll', undefined],
+            ['"before all" hook: beforeSuite in "{root}"', 'beforeAll', undefined],
             ['"before all" hook for outer', 'beforeAll', suiteUid(events, 'outer')],
             ['"before all" hook for inner', 'beforeAll', suiteUid(events, 'inner')],
             ['"before each" hook for outer', 'beforeEach', undefined],
             ['"after each" hook for outer', 'afterEach', undefined],
             ['"after all" hook for inner', 'afterAll', suiteUid(events, 'inner')],
             ['"after all" hook for outer', 'afterAll', suiteUid(events, 'outer')],
-            ['"after all" hook in "{root}"', 'afterAll', undefined]
+            ['"after all" hook: afterSuite in "{root}"', 'afterAll', undefined]
         ])
         expect(logMock.debug).not.toHaveBeenCalled()
     })
```

---

### Incident Patch 2: `f621b855` (2026-10-29)
**Commit Message**: fix(webdriver, @wdio/cli): don't crash on a failed BiDi attach, and reject --shard 0/N (#16265)

* fix(webdriver): don't crash the process when an attached session can't connect to BiDi

`attachToSession` registered its Bidi message listener on `socket.on(...)`
without checking that `waitForConnected()` resolved `true`. When the
websocket was unreachable there is no socket, so the callback threw a
TypeError in a promise nobody handled, and Node terminated the process
with an unhandledRejection.

A connection that fails before a socket exists (e.g. an invalid
`webSocketUrl`) also rejected `BidiCore.connect()` unhandled in
`initiateBidi`, and left `waitForConnected()` pending forever.

Now the attached session listens only once connected, `connect()`
resolves `waitForConnected()` with `false` when it throws, and
`initiateBidi` logs the failed connection. The session keeps working
over classic WebDriver.

Fixes #16240

* fix(@wdio/cli): reject a shard outside of 1..total instead of running no spec

The `shard` validation accepted `current: 0` although shards are
one-based: `--shard 0/4` ran no spec and exited with 0, while the specs
of the last shard ran in no job. `shard.current` now

**File**: `packages/wdio-cli/src/constants.ts` (modified, +9/-2)
```diff
@@ -302,8 +302,15 @@ export const TESTRUNNER_DEFAULTS: Options.Definition<Options.Testrunner & { capa
                 throw new Error('the "shard" option needs to have "current" and "total" properties with number values')
             }
 
-            if (p.current < 0 || p.current > p.total) {
-                throw new Error('the "shard.current" value has to be between 0 and "shard.total"')
+            if (!Number.isInteger(p.total) || p.total < 1) {
+                throw new Error('the "shard.total" value has to be a positive integer')
+            }
+
+            /**
+             * shards are one-based: a shard 0 would run no spec and pass (#16240)
+             */
+            if (!Number.isInteger(p.current) || p.current < 1 || p.current > p.total) {
+                throw new Error('the "shard.current" value has to be an integer between 1 and "shard.total"')
             }
         }
     },
```

**File**: `packages/wdio-cli/tests/constants.test.ts` (modified, +13/-0)
```diff
@@ -63,6 +63,19 @@ describe('constants', () => {
             expect(() => TESTRUNNER_DEFAULTS.execArgv!.validate!('foobar')).toThrow()
         })
 
+        it('should expect a one-based shard (#16240)', () => {
+            TESTRUNNER_DEFAULTS.shard!.validate!({ current: 1, total: 4 })
+            TESTRUNNER_DEFAULTS.shard!.validate!({ current: 4, total: 4 })
+
+            expect(() => TESTRUNNER_DEFAULTS.shard!.validate!({ current: 0, total: 4 }))
+                .toThrow('the "shard.current" value has to be an integer between 1 and "shard.total"')
+            expect(() => TESTRUNNER_DEFAULTS.shard!.validate!({ current: 5, total: 4 })).toThrow()
+            expect(() => TESTRUNNER_DEFAULTS.shard!.validate!({ current: 1.5, total: 4 })).toThrow()
+            expect(() => TESTRUNNER_DEFAULTS.shard!.validate!({ current: 0, total: 0 }))
+                .toThrow('the "shard.total" value has to be a positive integer')
+            expect(() => TESTRUNNER_DEFAULTS.shard!.validate!({ current: 1, total: 2.5 })).toThrow()
+        })
+
         it('should expect filesToWatch to be an array', () => {
             TESTRUNNER_DEFAULTS.filesToWatch!.validate!([])
             // @ts-expect-error wrong parameter
```

**File**: `packages/webdriver/src/bidi/core.ts` (modified, +9/-1)
```diff
@@ -126,7 +126,15 @@ export class BidiCore {
         /**
          * try to connect to different websocket urls depending on the protocol
          */
-        this.#ws = await environment.value.createBidiConnection(this.#webSocketUrl, this.#clientOptions, this.#connectTimeout)
+        try {
+            this.#ws = await environment.value.createBidiConnection(this.#webSocketUrl, this.#clientOptions, this.#connectTimeout)
+        } catch (err) {
+            /**
+             * e.g. an invalid url: `waitForConnected()` must not wait forever
+             */
+            this.#resolveWaitForConnected(false)
+            throw err
+        }
         this._isConnected = Boolean(this.#ws)
         this.#resolveWaitForConnected(this._isConnected)
 
```

**File**: `packages/webdriver/src/index.ts` (modified, +8/-2)
```diff
@@ -156,8 +156,14 @@ export default class WebDriver {
          * parse and propagate all Bidi events to the browser instance
          */
         if (isBidi(options.capabilities || {})) {
-            client._bidiHandler?.waitForConnected().then(()=>{
-                client._bidiHandler?.socket.on('message', parseBidiMessage.bind(client))
+            /**
+             * attaching doesn't wait for the connection: when it fails, there is no socket
+             * to listen on, and an error here would crash the process (#16240)
+             */
+            client._bidiHandler?.waitForConnected().then((isConnected: boolean) => {
+                if (isConnected) {
+                    client._bidiHandler?.socket?.on('message', parseBidiMessage.bind(client))
+                }
             })
         }
         return client
```

**File**: `packages/webdriver/src/utils.ts` (modified, +4/-1)
```diff
@@ -481,7 +481,10 @@ export function initiateBidi (
     socketUrl = socketUrl.replace('localhost', '127.0.0.1')
     const bidiReqOpts = getBidiRequestOptions(strictSSL, userHeaders)
     const handler = new BidiHandler(socketUrl, bidiReqOpts, responseTimeout, connectTimeout)
-    handler.connect().then((isConnected) => isConnected && log.info(`Connected to WebDriver Bidi interface at ${socketUrl}`))
+    handler.connect().then(
+        (isConnected) => isConnected && log.info(`Connected to WebDriver Bidi interface at ${socketUrl}`),
+        (err: Error) => log.error(`Could not connect to WebDriver Bidi interface at ${socketUrl}: ${err.message}`)
+    )
 
     return {
         _bidiHandler: { value: handler },
```

**File**: `packages/webdriver/tests/bidi.test.ts` (modified, +10/-0)
```diff
@@ -433,6 +433,16 @@ describe('BidiCore', () => {
         })
     })
 
+    describe('connect', () => {
+        it('stops waiting for the connection when it can not connect (#16240)', async () => {
+            vi.mocked(environment.value.createBidiConnection).mockRejectedValueOnce(new TypeError('Invalid URL'))
+            const handler = new BidiCore('not a url')
+            await expect(handler.connect()).rejects.toThrow('Invalid URL')
+            await expect(handler.waitForConnected()).resolves.toBe(false)
+            expect(handler.isConnected).toBe(false)
+        })
+    })
+
     describe('sendAsync', () => {
         beforeAll(() => {
             delete process.env.WDIO_UNIT_TESTS
```

**File**: `packages/webdriver/tests/index.test.ts` (modified, +31/-0)
```diff
@@ -381,6 +381,37 @@ describe('WebDriver', () => {
             expect(utils.initiateBidi).toHaveBeenLastCalledWith('ws://foo/bar', undefined, undefined, undefined, 30000)
         })
 
+        it('listens to the Bidi messages of an attached session once it connects', async () => {
+            const socket = { on: vi.fn() }
+            vi.spyOn(utils, 'initiateBidi').mockReturnValueOnce({
+                _bidiHandler: { value: { waitForConnected: () => Promise.resolve(true), socket } }
+            })
+            const capabilities = { browserName: 'chrome', webSocketUrl: 'ws://foo/bar' } as WebdriverIO.Capabilities
+            WebDriver.attachToSession({ ...sessionOptions, capabilities })
+            await vi.waitFor(() => expect(socket.on).toHaveBeenCalledWith('message', expect.any(Function)))
+        })
+
+        it('does not crash the process when the Bidi connection of an attached session fails (#16240)', async () => {
+            const onUnhandledRejection = vi.fn()
+            process.on('unhandledRejection', onUnhandledRejection)
+            try {
+                /**
+                 * a failed connection has no socket
+                 */
+                vi.spyOn(utils, 'initiateBidi').mockReturnValueOnce({
+                    _bidiHandler: { value: { waitForConnected: () => Promise.resolve(false), socket: undefined } }
+                })
+                const capabilities = { browserName: 'chrome', webSocketUrl: 'ws://foo/bar' } as WebdriverIO.Capabilities
+                const client = WebDriver.attachToSession({ ...sessionOptions, capabilities })
+                await new Promise((resolve) => setTimeout(resolve, 10))
+
+                expect(onUnhandledRejection).not.toHaveBeenCalled()
+                expect(client.sessionId).toBe('foobar')
+            } finally {
+                process.off('unhandledRejection', onUnhandledRejection)
+            }
+        })
+
         it('should fail attaching to session if sessionId is not given', () => {
             // @ts-ignore
             expect(() => WebDriver.attachToSession({}))
```

**File**: `packages/webdriver/tests/utils.test.ts` (modified, +27/-1)
```diff
@@ -4,9 +4,13 @@ import type { Capabilities, Options } from '@wdio/types'
 
 import '../src/browser.js'
 
+// @ts-expect-error mock feature
+import { logMock } from '@wdio/logger'
+import { environment } from '../src/environment.js'
 import {
     isSuccessfulResponse, getPrototype, getSessionError,
-    startWebDriverSession, setupDirectConnect, validateCapabilities, getBidiRequestOptions
+    startWebDriverSession, setupDirectConnect, validateCapabilities, getBidiRequestOptions,
+    initiateBidi
 } from '../src/utils.js'
 import type { Client, RemoteConfig } from '../src/types.js'
 
@@ -124,6 +128,28 @@ describe('utils', () => {
         })
     })
 
+    describe('initiateBidi', () => {
+        it('logs a failed connection instead of an unhandled rejection (#16240)', async () => {
+            const { createBidiConnection } = environment.value
+            const onUnhandledRejection = vi.fn()
+            process.on('unhandledRejection', onUnhandledRejection)
+            environment.value.createBidiConnection = vi.fn().mockRejectedValue(new TypeError('Invalid URL'))
+            try {
+                const { _bidiHandler } = initiateBidi('not a url')
+                await expect(_bidiHandler.value.waitForConnected()).resolves.toBe(false)
+                await new Promise((resolve) => setTimeout(resolve, 10))
+
+                expect(onUnhandledRejection).not.toHaveBeenCalled()
+                expect(logMock.error).toHaveBeenCalledWith(
+                    'Could not connect to WebDriver Bidi interface at not a url: Invalid URL'
+                )
+            } finally {
+                environment.value.createBidiConnection = createBidiConnection
+                process.off('unhandledRejection', onUnhandledRejection)
+            }
+        })
+    })
+
     describe('setupDirectConnect', () => {
         class TestClient implements Client {
             // @ts-expect-error
```

---

### Incident Patch 3: `ac46fc07` (2026-10-29)
**Commit Message**: fix(webdriverio): scope mockRestoreAll and mockClearAll to the tab or parallel test that calls them (#16273)

* fix(webdriverio): scope mockRestoreAll and mockClearAll to the tab or parallel test that calls them

tab.mockRestoreAll() / tab.mockClearAll() also restored or cleared the
session-wide mocks and the mocks of the other tabs, although the docs say
"Mock the requests of this tab or window only". In parallel mode, one
test's browser.mockRestoreAll() restored the mocks of the tests running
at the same time and the mocks created in beforeSuite.

A mock already knows its scope: mock() gives a tab mock or a parallel
test's mock its context, and a session-wide mock none. mocksOf() picks the
mocks of the caller with the same rule: every mock of the session for
`browser`, only the mocks made for the context on a tab or in a parallel
test. isOwnedBy() takes that context, and mock() uses the same
isContextScoped() rule, so creating and restoring cannot drift apart.
Outside a tab or a parallel test, nothing changes, so @wdio/session
`unmock --all` still removes every mock.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* fix(webdriverio): restore the mocks a parallel test made on

**File**: `e2e/wdio/headless/browsingContexts.e2e.ts` (modified, +27/-1)
```diff
@@ -95,7 +95,9 @@ describe('browsing contexts', () => {
         </script>`),
         '/api/scoped': () => 'real',
         '/api/restored': () => 'real',
-        '/api/closed': () => 'real'
+        '/api/closed': () => 'real',
+        '/api/session': () => 'real',
+        '/api/own': () => 'real'
     }
 
     const server = createServer((request, response) => {
@@ -435,6 +437,30 @@ describe('browsing contexts', () => {
             await expect(b.$('#result')).toHaveText('real')
         })
 
+        it('restores only the mocks of the tab it was called on', async () => {
+            const a = await open('/tab-a')
+            const b = await openTab('/tab-a')
+
+            try {
+                const sessionWide = await browser.mock('**/api/session')
+                sessionWide.respond('mocked', { headers: { 'Content-Type': 'text/plain' }, fetchResponse: false })
+                const own = await b.mock('**/api/own')
+                own.respond('mocked', { headers: { 'Content-Type': 'text/plain' }, fetchResponse: false })
+
+                await b.mockRestoreAll()
+                await b.navigate(`${origin}/fetch?endpoint=own`)
+                await expect(b.$('#result')).toHaveText('real')
+                await a.navigate(`${origin}/fetch?endpoint=session`)
+                await expect(a.$('#result')).toHaveText('mocked')
+
+                await browser.mockRestoreAll()
+                await a.navigate(`${origin}/fetch?endpoint=session`)
+                await expect(a.$('#result')).toHaveText('real')
+            } finally {
+                await browser.mockRestoreAll()
+            }
+        })
+
         it('shares cookies between tabs of the same origin', async () => {
             const a = await open('/tab-a')
             const b = await openTab('/tab-b')
```

**File**: `e2e/wdio/headless/parallel-mocks.e2e.ts` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+import { browser, expect } from '@wdio/globals'
+import { PARALLEL_FIXTURE_ORIGIN } from '../parallelFixtureServer.js'
+
+/**
+ * The two tests run at the same time (`maxParallelContexts: 2`): the second one
+ * waits for the mocks of the first, and the first checks its mocks after the
+ * second called `mockClearAll()` and `mockRestoreAll()`. `wdio.parallel.conf.ts`
+ * mocks `/api/suite-wide` in `beforeSuite`, outside the test windows.
+ */
+const fetchText = (endpoint: string, scope: WebdriverIO.Browser | WebdriverIO.BrowsingContext = browser) => scope.execute(
+    (url) => fetch(url, { cache: 'no-store' }).then((response) => response.text()),
+    `${PARALLEL_FIXTURE_ORIGIN}/api/${endpoint}`
+)
+
+const signal = (label: string) => {
+    let resolve!: () => void
+    const done = new Promise<void>((r) => { resolve = r })
+    const wait = () => Promise.race([
+        done,
+        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), 30_000))
+    ])
+    return { resolve, wait }
+}
+const mocked = signal('the first test to create its mock')
+const restored = signal('the second test to restore its mocks')
+const respondOptions = { headers: { 'Content-Type': 'text/plain' }, fetchResponse: false }
+
+describe('mocks in parallel mode', () => {
+    before(async () => {
+        // runs once per test, in the test's window
+        const hook = await browser.mock('**/api/hook')
+        hook.respond('mocked', respondOptions)
+    })
+
+    it('keeps its mocks when another test clears and restores all mocks', async () => {
+        const own = await browser.mock('**/api/own')
+        own.respond('mocked', respondOptions)
+        try {
+            await browser.url(`${PARALLEL_FIXTURE_ORIGIN}/checkboxes`)
+            expect(await fetchText('own')).toBe('mocked')
+        } finally {
+            mocked.resolve()
+        }
+
+        await restored.wait()
+        expect(await fetchText('own')).toBe('mocked')
+        expect(await fetchText('hook')).toBe('mocked')
+        expect(await fetchText('suite-wide')).toBe('mocked')
+        expect(own.calls.length).toBe(2)
+    })
+
+    it('clears and restores only its own mocks, also on a tab it opened', async () => {
+        let tab: WebdriverIO.BrowsingContext | undefined
+        try {
+            const own = await browser.mock('**/api/own')
+            own.respond('other', respondOptions)
+            await browser.url(`${PARALLEL_FIXTURE_ORIGIN}/checkboxes`)
+            const opened = await browser.newWindow(`${PARALLEL_FIXTURE_ORIGIN}/checkboxes`)
+            if (!('contextId' in opened)) {
+                throw new Error('expected newWindow() to return a browsing context')
+            }
+            tab = opened
+            const onTab = await tab.mock('**/api/tab')
+            onTab.respond('mocked', respondOptions)
+            expect(await fetchText('tab', tab)).toBe('mocked')
+            await mocked.wait()
+
+            await browser.mockClearAll()
+            await browser.mockRestoreAll()
+            expect(await fetchText('own')).toBe('Not found')
+            expect(await fetchText('hook')).toBe('Not found')
+            expect(await fetchText('tab', tab)).toBe('Not found')
+            expect(await fetchText('suite-wide')).toBe('mocked')
+        } finally {
+            restored.resolve()
+            await tab?.closeWindow().catch(() => {})
+        }
+    })
+})
```

**File**: `e2e/wdio/wdio.parallel.conf.ts` (modified, +9/-1)
```diff
@@ -13,7 +13,8 @@ export const config: WebdriverIO.Config = {
      */
     specs: [
         path.join(__dirname, 'headless', 'parallel.e2e.ts'),
-        path.join(__dirname, 'headless', 'parallel-storage.e2e.ts')
+        path.join(__dirname, 'headless', 'parallel-storage.e2e.ts'),
+        path.join(__dirname, 'headless', 'parallel-mocks.e2e.ts')
     ],
 
     /**
@@ -46,6 +47,13 @@ export const config: WebdriverIO.Config = {
     onComplete: async () => {
         await stopParallelFixtureServer(server)
     },
+    beforeSuite: async (suite) => {
+        // a mock outside the test windows, which mockRestoreAll() in a test keeps
+        if (suite.file.endsWith('parallel-mocks.e2e.ts')) {
+            const suiteWide = await browser.mock('**/api/suite-wide')
+            suiteWide.respond('mocked', { headers: { 'Content-Type': 'text/plain' }, fetchResponse: false })
+        }
+    },
 
     mochaOpts: {
         ui: 'bdd',
```

**File**: `packages/webdriverio/src/commands/browser/mock.ts` (modified, +4/-2)
```diff
@@ -176,9 +176,11 @@ export async function mock(
      * `browser.mock()` stays session-wide, except in a parallel test, where a
      * session-wide intercept would catch other tests' traffic.
      */
+    const test = getParallelContextStore().getStore()
     const networkInterception = await WebDriverInterception.initiate(url, normalizedFilterOptions, browser, {
-        contexts: isBrowsingContext(this) || getParallelContextStore().getStore() ? [context] : undefined,
-        sessionKey: context
+        contexts: isBrowsingContext(this) || test ? [context] : undefined,
+        sessionKey: context,
+        test
     })
     SESSION_MOCKS[context].add(networkInterception)
 
```

**File**: `packages/webdriverio/src/commands/browser/mockClearAll.ts` (modified, +9/-17)
```diff
@@ -1,12 +1,13 @@
 import logger from '@wdio/logger'
-import { getBrowserObject } from '@wdio/utils'
-
-import { SESSION_MOCKS } from './mock.js'
+import { mocksOf } from '../../utils/interception/scope.js'
 
 const log = logger('webdriverio:mockClearAll')
 
 /**
- * Resets all information stored in all registered mocks of the session.
+ * Resets all information stored in all registered mocks of the session. On a
+ * browsing context, it resets only the mocks made for that tab or window.
+ * Inside a parallel test, it resets only the mocks that the test created, also
+ * on tabs it opened.
  *
  * <example>
     :mockClearAll.js
@@ -32,18 +33,9 @@ const log = logger('webdriverio:mockClearAll')
  * @alias browser.mockClearAll
  */
 export async function mockClearAll (this: WebdriverIO.Browser | WebdriverIO.BrowsingContext): Promise<void> {
-    /**
-     * only touch mocks of this browser, on a multiremote browser this command
-     * runs once per instance and `SESSION_MOCKS` holds the mocks of all of them
-     */
-    const browser = getBrowserObject(this)
-    for (const [handle, mocks] of Object.entries(SESSION_MOCKS)) {
-        log.trace(`Clearing mocks for ${handle}`)
-        for (const mock of mocks) {
-            if (!mock.isOwnedBy(browser)) {
-                continue
-            }
-            mock.clear()
-        }
+    const mocks = mocksOf(this)
+    log.trace(`Clearing ${mocks.length} mock(s)`)
+    for (const mock of mocks) {
+        mock.clear()
     }
 }
```

**File**: `packages/webdriverio/src/commands/browser/mockRestoreAll.ts` (modified, +8/-17)
```diff
@@ -1,13 +1,13 @@
 import logger from '@wdio/logger'
-import { getBrowserObject } from '@wdio/utils'
-
-import { SESSION_MOCKS } from './mock.js'
+import { mocksOf } from '../../utils/interception/scope.js'
 
 const log = logger('webdriverio:mockRestoreAll')
 
 /**
  * Restores all mock information and behavior stored in all registered
- * mocks of the session.
+ * mocks of the session. On a browsing context, it restores only the mocks made
+ * for that tab or window. Inside a parallel test, it restores only the mocks
+ * that the test created, also on tabs it opened.
  *
  * <example>
     :mockRestoreAll.js
@@ -30,18 +30,9 @@ const log = logger('webdriverio:mockRestoreAll')
  * @alias browser.mockRestoreAll
  */
 export async function mockRestoreAll (this: WebdriverIO.Browser | WebdriverIO.BrowsingContext): Promise<void> {
-    /**
-     * only touch mocks of this browser, on a multiremote browser this command
-     * runs once per instance and `SESSION_MOCKS` holds the mocks of all of them
-     */
-    const browser = getBrowserObject(this)
-    for (const [handle, mocks] of Object.entries(SESSION_MOCKS)) {
-        log.trace(`Clearing mocks for ${handle}`)
-        for (const mock of mocks) {
-            if (!mock.isOwnedBy(browser)) {
-                continue
-            }
-            await mock.restore()
-        }
+    const mocks = mocksOf(this)
+    log.trace(`Restoring ${mocks.length} mock(s)`)
+    for (const mock of mocks) {
+        await mock.restore()
     }
 }
```

**File**: `packages/webdriverio/src/utils/interception/index.ts` (modified, +18/-9)
```diff
@@ -180,6 +180,10 @@ export default class WebDriverInterception {
     #filterOptions: MockFilterOptions
     #browser: WebdriverIO.Browser
     #contexts?: string[]
+    /**
+     * The window of the parallel test that created this mock
+     */
+    #test?: string
     /**
      * Iframes below an owned context. Their non-blocked events carry the iframe's
      * id, so ownership can't be read off `#contexts` alone.
@@ -253,7 +257,7 @@ export default class WebDriverInterception {
         url: string | URLPattern | globalThis.URLPattern,
         filterOptions: MockFilterOptions,
         browser: WebdriverIO.Browser,
-        scope: { contexts?: string[], sessionKey?: string } = {}
+        scope: { contexts?: string[], sessionKey?: string, test?: string } = {}
     ) {
         const pattern = parseUrlPattern(url)
         const isCollectingNetworkData = browser.options.maxSpyCollectedBodySize !== 0
@@ -301,6 +305,7 @@ export default class WebDriverInterception {
         })
 
         const mock = new WebDriverInterception(pattern, interception.intercept, filterOptions, browser, isCollectingNetworkData, scope.sessionKey, scope.contexts)
+        mock.#test = scope.test
         await mock.#seedDescendantContexts()
         return mock
     }
@@ -1248,15 +1253,19 @@ export default class WebDriverInterception {
     }
 
     /**
-     * Whether this mock was registered on the given browser session. `SESSION_MOCKS`
-     * is shared by all instances of a multiremote browser. Compares session ids
-     * rather than objects so that a client attached to the same session via
-     * `attach()` still owns mocks created by another client of that session.
-     * @param browser  browser instance to check
-     * @returns        `true` if this mock belongs to that browser's session
+     * Whether this mock belongs to the given browser session, and to the given tab or
+     * parallel test if one is passed. `SESSION_MOCKS` is shared by all instances of a
+     * multi-remote browser. Compares session ids rather than objects so that a client attached
+     * to the same session via `attach()` still owns mocks created by another client of that session.
+     * @param browser        browser instance to check
+     * @param scope.context  a tab: only mocks made for that tab match
+     * @param scope.test     the window of a parallel test: only mocks that test created match, also on tabs it opened
+     * @returns              `true` if this mock belongs to that browser's session (and scope)
      */
-    isOwnedBy(browser: WebdriverIO.Browser) {
-        return this.#browser.sessionId === browser.sessionId
+    isOwnedBy(browser: WebdriverIO.Browser, { context, test }: { context?: string, test?: string } = {}) {
+        return this.#browser.sessionId === browser.sessionId &&
+            (context === undefined || Boolean(this.#contexts?.includes(context))) &&
+            (test === undefined || this.#test === test)
     }
 
     isSameDefinition(url: string | URLPattern | globalThis.URLPattern, filterOptions: MockFilterOptions = {}) {
```

**File**: `packages/webdriverio/src/utils/interception/scope.ts` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import { getBrowserObject } from '@wdio/utils'
+
+import type WebDriverInterception from './index.js'
+import { SESSION_MOCKS } from '../../commands/browser/mock.js'
+import { getParallelContextStore } from '../../session/context.js'
+import { isBrowsingContext } from '../../session/browsingContext.js'
+
+/**
+ * The mocks `mockClearAll()` and `mockRestoreAll()` act on: on a tab, the mocks made
+ * for that tab; in a parallel test, the mocks that test created, also on tabs it opened;
+ * otherwise every mock of the session. `SESSION_MOCKS` also holds the mocks of the other
+ * instances of a multi-remote browser.
+ */
+export function mocksOf (scope: WebdriverIO.Browser | WebdriverIO.BrowsingContext): WebDriverInterception[] {
+    const browser = getBrowserObject(scope)
+    const filter = isBrowsingContext(scope)
+        ? { context: scope.contextId }
+        : { test: getParallelContextStore().getStore() }
+    return Object.values(SESSION_MOCKS)
+        .flatMap((mocks) => Array.from(mocks))
+        .filter((mock) => mock.isOwnedBy(browser, filter))
+}
```

#### Recent Merged Pull Requests:
- **PR #16308** (2026-10-30): fix(webdriverio, @wdio/session): report a value the browser rejected or reformatted in fill, and reject an empty range value (@plum117)
- **PR #16303** (2026-10-29): fix(@wdio/utils): don't pass spawnOpts to Chromedriver as a --spawn-ppts flag (@Winify)
- **PR #16302** (2026-10-29): docs(mcp): update MCP docs for v4 (@Winify)
- **PR #16301** (2026-10-30): chore(deps): bump @hono/node-server from 2.1.1 to 2.1.5 (@dependabot[bot])
- **PR #16300** (2026-10-30): fix(@wdio/reporter, @wdio/html-reporter, @wdio/jasmine-framework): hide an empty (root) box and show the spec files of its tests (@plum117)
- **PR #16298** (2026-10-29): chore(deps-dev): bump the minor-deps-updates-v9 group with 4 updates (@dependabot[bot])

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

## X. @wdio/html-reporter, @wdio/reporter, @wdio/video-reporter, @wdio/mocha-framework

**RULE**:
When implementing operations in `packages/wdio-html-reporter/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webdriverio/webdriverio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cfe0e018`: @wdio/html-reporter, @wdio/reporter, @wdio/video-reporter, @wdio/mocha-framework): label each failed attempt of a retried test, copy the styles safely on Windows, give the Mocha config root hooks their own title, and use the base reporter's hook owner and spec file attempt (#16277). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/wdio-html-reporter/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
When a test or a Cucumber scenario runs again (Mocha [`retries`](https://webdriver.io/docs/retry#rerun-suites-in-mocha), the Cucumber [`retry`](https://webdriver.io/docs/retry#rerunning-in-cucumber) option, Vitest `retry`), each failed attempt stays in the report as its own entry, with `(attempt 1, retried)` after its title; only the last attempt counts.

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cfe0e018` are properly handled with clean fallback behavior.
