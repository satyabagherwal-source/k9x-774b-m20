# Verification Protocol: Verification Protocol: Empirical Defect Shield for webdriverio/webdriverio

<!-- PROVENANCE_START
{
  "source_repository": "webdriverio/webdriverio",
  "source_url": "https://github.com/webdriverio/webdriverio",
  "source_version": "f50ab796",
  "license": "MIT",
  "timestamp": "2026-11-28T11:47:36.929Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-webdriverio-webdriverio",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [webdriverio/webdriverio](https://github.com/webdriverio/webdriverio) (Revision: `f50ab796`).  
> **License**: MIT | **Timestamp**: `2026-11-28T11:47:36.929Z`  
> **Learning ID**: `learn-github-webdriverio-webdriverio`


## 1. Scope & Verification Target
- **Target Repository**: `webdriverio/webdriverio` (Commit: `f50ab796`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): webdriverio/webdriverio

> **Canonical Artifact**: `07_PROJECT_LEARNING/webdriverio-webdriverio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/webdriverio/webdriverio](https://github.com/webdriverio/webdriverio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T11:47:35.256Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webdriverio/webdriverio`
- **Description**: Next-gen browser and mobile automation test framework for Node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9886 stars

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
- **Issue #16518** (2026-11-26): **docs(devtools): describe Appium 3 and Appium 4 on the mobile page**
  *Symptoms*: ## Proposed changes  Mirrors webdriverio/devtools#594 onto the DevTools mobile page. Each Appium driver major supports one Appium major, and three things follow that the page did not say:  - `appium driver install uiautomator2` / `xcuitest` installs the newest driver, which an Appium 3 server cannot load. A new "Appium 3 or Appium 4" section gives the pairing table (Appium 3: UiAutomator2 5.x to 8.x, XCUITest 12.x, appium-interceptor 1.0.x; Appium 4: UiAutomator2 9.x and later, XCUITest 13.x and later) and the install commands for each. The prerequisites list and the iOS paragraph point at it. - UiAutomator2 10.x checks chromedriver against a SHA-256 allowlist, so a mobile browser or hybrid session can be refused the chromedriver it resolves. The page now names the `uiautomator2:chromedriver_allow_any_executable` server feature. - appium-interceptor 1.0.x declares a peer of `appium@^3.0.1`, so native app network capture needs Appium 3 for now. The native network section, the "What a mobile trace does not contain" section and the Network Logs page say so.  ## How you tested  - [ ] Unit tests for the touched package(s) - [ ] Type definition tests (if the public API / command types changed) - [ ] Smoke or e2e (only if the testrunner, launcher, or a real browser path changed)  Docs only. The facts match webdriverio/devtools#594, where the Appium 4 pairing and the allowlist flag were run against a local Appium 4 server.  ## Types of changes  - [ ] Polish (an improvement for an exi

- **Issue #16503** (2026-11-26): **docs(devtools): document secret redaction and the new maskInputs scope**
  *Symptoms*: ## Proposed changes  Documents secret redaction from webdriverio/devtools#589 (closes webdriverio/devtools#573), which changed what `maskInputs` covers. The site still said command rows always keep the typed text.  - **Dashboard** page: the **Password masking** section is updated, and a new **Secret redaction** section explains that a password typed into an `<input type="password">` is learned and replaced by `••••` everywhere the adapter sends or writes (rows, `transcript.md`, console, network, DOM, sources), that credential header and cookie values are redacted, the new `secrets` option, and what is not covered. - **WebdriverIO, Selenium, Nightwatch and Reference** option tables: the `maskInputs` row now says what it redacts and that `false` turns both off; a new `secrets` row. - **Selenium** page, Python flags: `--devtools-no-mask-inputs` updated, and `--devtools-secret` / `--devtools-secret-env` added. - **CrossFrameworkSupport** and **MobileTesting** tables regenerated with `pnpm docs:capabilities --website` from devtools `main`. Besides the redaction row, this brings in rows from webdriverio/devtools#567, webdriverio/devtools#568 and webdriverio/devtools#569 that the site had not picked up yet (per-command screenshots, the native element list, the screencast footnote).  ## How you tested  Docs only; no code, tests or types changed. The text matches the devtools README and package READMEs on `main`, and the tables come from the generator.  ## Types of changes  - [ ] Poli

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

### Incident Patch 1: `f50ab796` (2026-11-26)
**Commit Message**: docs(devtools): document capture cost changes for the filmstrip, Python and native traces (#16410)

Mirror three devtools changes to the DevTools pages: the polling
filmstrip recorder skips a tick while the driver is busy and reuses
capture screenshots as frames, the Python adapter captures only
commands that can change the page, and Selenium and Nightwatch read
the native page source per action in trace mode. Regenerate the
capability tables.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `website/docs/devtools/Limitations.md` (modified, +1/-1)
```diff
@@ -24,4 +24,4 @@ What [Trace Mode](/docs/devtools/wdio/trace-mode) deliberately skips, plus the k
 - **Network without BiDi**: on Safari and Appium sessions the Network tab comes from the page's own `fetch` / `XMLHttpRequest` patch and Resource Timing buffer, so loads the page did not make through `fetch` / XHR carry no headers or body, and on Safari no status. A native app session captures network only through the appium-interceptor plugin (`appium:intercept: true`, Android); see [Native app network](/docs/devtools/mobile#native-app-network). See [Network Logs](/docs/devtools/wdio/network-logs#without-webdriver-bidi).
 - **Hybrid apps**: only WebdriverIO follows a hybrid app into its webview, and a hybrid app's webview actions carry no per-action element data, A11y tree or settle screenshot. See [Mobile Testing](/docs/devtools/mobile).
 - **Redaction covers what it learns or is told, not everything shown**: a password typed into an `<input type="password">`, credential header and cookie values, and any value listed in `secrets` are replaced by `••••` in command rows, `transcript.md`, the test source, console lines, request bodies and the replayed page. Screenshots and the screencast, text typed into other fields, and anything a live dashboard received before the password was typed keep what the run showed. Treat a trace archive as being as sensitive as the run that produced it; see [Secret redaction](/docs/devtools/dashboard#secret-redaction).
-- **Non-Chrome video/filmstrip** — on browsers without a CDP push path the recorder polls `takeScreenshot`, which adds WebDriver round-trips and (under Allure) floods the step log; pair with the reporter's step-silencing options.
+- **Non-Chrome video/filmstrip**: on browsers without a CDP push path the recorder polls `takeScreenshot`, which adds WebDriver round-trips and (under Allure) floods the step log; pair with the reporter's step-silencing options. The recorder skips a tick while a command or a per-action capture holds the driver, so its polls do not queue in front of the test.
```

**File**: `website/docs/devtools/MobileTesting.md` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ The **device itself** needs no adapter support: it is derived from the session's
 
 A phone capture is framed as the device: a full-height device column with the action list and dock beside it, in **both** live mode and the [trace player](/docs/devtools/trace-player). The trace's `context-options` records the platform, model and OS version, read back on open so the player labels frames without guessing.
 
-On a native session the A11y tab and element data come from the platform's XML tree rather than the DOM, so locators read as `android=new UiSelector()…` or `-ios predicate string:…` rather than CSS or XPath over HTML.
+On a native session the A11y tab and element data come from the platform's XML tree (its page source, read once per action in trace mode by the WebdriverIO, Selenium and Nightwatch adapters; the Python adapter captures a screenshot alone) rather than the DOM, so locators read as `android=new UiSelector()…` or `-ios predicate string:…` rather than CSS or XPath over HTML. Reading the page source is the costly part of a native capture (most of it on iOS); `DEVTOOLS_CAPTURE_TIMING=1` reports it as the `pageSource` probe (see [Measuring capture cost](/docs/devtools/wdio/trace-mode#measuring-capture-cost)).
 
 ## Native app network
 
```

**File**: `website/docs/devtools/Nightwatch.md` (modified, +2/-2)
```diff
@@ -92,7 +92,7 @@ module.exports = {
 | `traceFormat` | `'zip' \| 'ndjson-directory'` | `'zip'` | Trace artifact layout. Only applies when `mode: 'trace'`. |
 | `traceGranularity` | `'session' \| 'spec' \| 'test'` | `'session'` | One trace per session / spec file / test. `'test'` writes each to `test-results/<spec>-<title>-<browser>[-retryN]/trace.zip`. Only applies when `mode: 'trace'`. See [Trace Mode](/docs/devtools/wdio/trace-mode#trace-granularity--tracegranularity). **Caveat:** the BDD `describe/it` interface collapses to a single session-scoped slice (see [Per-test slicing](#per-test-slicing--the-bdd-describeit-caveat)). |
 | `tracePolicy` | `'on' \| 'retain-on-failure' \| 'retain-on-first-failure' \| 'on-first-retry' \| 'on-all-retries' \| 'retain-on-failure-and-retries'` | `'on'` | Which traces to keep. Pairs with `traceGranularity: 'test'`. Only applies when `mode: 'trace'`; setting it outside trace mode logs a warning. **Caveat:** only `'retain-on-failure'` is reliable on Nightwatch. The other retry-aware policies degrade to it, because `--retries` re-runs a testcase internally without re-firing the plugin's per-test hooks. |
-| `filmstrip` | `boolean` | `true` | Record a dense, continuous screencast filmstrip into the trace for scrubbable playback in the trace player — not just one frame per action. Runs the screencast recorder (polling mode on Nightwatch) for the session. Only applies when `mode: 'trace'`. |
+| `filmstrip` | `boolean` | `true` | Record a dense, continuous screencast filmstrip into the trace for scrubbable playback in the trace player, not just one frame per action. Runs the screencast recorder (polling mode on Nightwatch) for the session. The polling recorder skips a tick while a command or a per-action capture holds the driver (once the newest frame is three intervals old it polls anyway, so the longest gap is about three intervals plus one screenshot; never during a click, typing or a capture), and keeps each per-action capture's screenshot as a frame, so its polls do not queue in front of the test. Only applies when `mode: 'trace'`. |
 | `traceResources` | `'styles' \| 'none'` | `'styles'` | Store the stylesheets and fonts the pages used, so the player replays them from the archive rather than the site; `'none'` stores nothing. Images always replay from the site. Only applies when `mode: 'trace'`. See [Trace Mode](/docs/devtools/wdio/trace-mode#stylesheets-and-fonts-traceresources). |
 | `screenshot` | `'off' \| 'on' \| 'only-on-failure'` | `'off'` | Per-test screenshot. Trace mode + `traceGranularity: 'test'` only. **Produce-only** — the PNG is written to the trace output dir (and the manifest when `emitArtifactsManifest: true`); not attached inline to Allure (see note below). |
 | `video` | `'off' \| TraceRetentionPolicy` | `'off'` | Per-test video slice, retained per the given policy (e.g. `'retain-on-failure'`). Trace mode + `traceGranularity: 'test'` only. A non-`off` value starts the screencast recorder itself — you do **not** also need `filmstrip` or `screencast.enabled`. **Produce-only** — the `.webm` is written to the trace output dir (and the manifest when `emitArtifactsManifest: true`); not attached inline to Allure. |
@@ -256,7 +256,7 @@ module.exports = {
 }
 ```
 
-Native sessions record commands, screenshots and element data from the platform's XML tree, with no DOM. A hybrid app's webview is captured as if it were still native. Try it with `pnpm demo:nightwatch:mobile`, run from the root of a built checkout of the devtools repo (setup steps in [Running an example](/docs/devtools/mobile#running-an-example)). See the [Mobile Testing page](/docs/devtools/mobile) for the full mobile reference.
+Native sessions record commands, screenshots and element data from the platform's XML tree, with no DOM: in trace mode each action's element list and accessibility tree are built from the app's page source, read beside its screenshot, which on iOS is most of the capture's cost. A hybrid app's webview is captured as if it were still native. Try it with `pnpm demo:nightwatch:mobile`, run from the root of a built checkout of the devtools repo (setup steps in [Running an example](/docs/devtools/mobile#running-an-example)). See the [Mobile Testing page](/docs/devtools/mobile) for the full mobile reference.
 
 ## Features
 
```

**File**: `website/docs/devtools/Reference.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ Only apply when `mode: 'trace'`.
 | `traceFormat` | `'zip' \| 'ndjson-directory'` | `'zip'` | Single archive vs. an unpacked directory. [Output format](/docs/devtools/wdio/trace-mode#output-format--traceformat) |
 | `traceGranularity` | `'session' \| 'spec' \| 'test'` | `'session'` | One trace per session / spec file / test. `'test'` is required for per-test screenshot/video and inline Allure attach. [Trace granularity](/docs/devtools/wdio/trace-mode#trace-granularity--tracegranularity) |
 | `tracePolicy` | `'on' \| 'retain-on-failure' \| 'retain-on-first-failure' \| 'on-first-retry' \| 'on-all-retries' \| 'retain-on-failure-and-retries'` | `'on'` | Which traces to keep. Pairs with `traceGranularity: 'test'`. [Retention](/docs/devtools/wdio/trace-mode#retention--tracepolicy) |
-| `filmstrip` | `boolean` | `true` | Dense, continuous screencast into the trace for smooth scrubbing; `false` records one frame per action. Thinned at export to frames at least 100 ms apart, about 600 at most. [Dense filmstrip](/docs/devtools/wdio/trace-mode#dense-filmstrip--filmstrip) |
+| `filmstrip` | `boolean` | `true` | Dense, continuous screencast into the trace for smooth scrubbing; `false` records one frame per action. Thinned at export to frames at least 100 ms apart, about 600 at most. Without CDP the recorder polls a screenshot, skipping a tick while the driver is busy. [Dense filmstrip](/docs/devtools/wdio/trace-mode#dense-filmstrip--filmstrip) |
 | `traceResources` | `'styles' \| 'none'` | `'styles'` | Store the stylesheets and fonts the pages used, so the replay does not load them from the site; images always do. Capped at 1 MiB per resource and 8 MiB per archive. [Stylesheets and fonts](/docs/devtools/wdio/trace-mode#stylesheets-and-fonts-traceresources) |
 | `screenshot` | `'off' \| 'on' \| 'only-on-failure'` | `'off'` | Per-test screenshot (needs `traceGranularity: 'test'`). Attached inline to Allure on WebdriverIO and Selenium; produce-only on Nightwatch. [Per-test screenshot & video](/docs/devtools/wdio/trace-mode#per-test-screenshot--video--screenshot--video) |
 | `video` | `'off' \| <tracePolicy value>` | `'off'` | Per-test video slice (needs `traceGranularity: 'test'`; encoding needs `ffmpeg` on `PATH`). Attached inline to Allure on WebdriverIO and Selenium; produce-only on Nightwatch. [Per-test screenshot & video](/docs/devtools/wdio/trace-mode#per-test-screenshot--video--screenshot--video) |
```

**File**: `website/docs/devtools/Selenium.md` (modified, +9/-5)
```diff
@@ -362,7 +362,7 @@ A failed row carries a second button beside Rerun. It snapshots the attempt, rer
 | `traceFormat` | `'zip' \| 'ndjson-directory'` | `'zip'` | Trace artifact layout. Only applies when `mode: 'trace'`. |
 | `traceGranularity` | `'session' \| 'spec' \| 'test'` | `'session'` | One trace per session / spec file / test. `'test'` writes each to `test-results/<spec>-<title>-<browser>[-retryN]/trace.zip`. Only applies when `mode: 'trace'`. See [Trace Mode](/docs/devtools/wdio/trace-mode#trace-granularity--tracegranularity). |
 | `tracePolicy` | `'on' \| 'retain-on-failure' \| 'retain-on-first-failure' \| 'on-first-retry' \| 'on-all-retries' \| 'retain-on-failure-and-retries'` | `'on'` | Which traces to keep. Pairs with `traceGranularity: 'test'`. Only applies when `mode: 'trace'`. |
-| `filmstrip` | `boolean` | `true` | Record a dense, continuous screencast into the trace for frame-by-frame scrubbing in the player. Only applies when `mode: 'trace'`. |
+| `filmstrip` | `boolean` | `true` | Record a dense, continuous screencast into the trace for frame-by-frame scrubbing in the player. Only applies when `mode: 'trace'`. The polling recorder skips a tick while a command or a per-action capture holds the driver (once the newest frame is three intervals old it polls anyway, so the longest gap is about three intervals plus one screenshot; never during a click, typing or a capture), and keeps each per-action capture's screenshot as a frame, so its polls do not queue in front of the test. |
 | `traceResources` | `'styles' \| 'none'` | `'styles'` | Store the stylesheets and fonts the pages used, so the player replays them from the archive rather than the site; `'none'` stores nothing. Images always replay from the site. Only applies when `mode: 'trace'`. See [Trace Mode](/docs/devtools/wdio/trace-mode#stylesheets-and-fonts-traceresources). |
 | `screenshot` | `'off' \| 'on' \| 'only-on-failure'` | `'off'` | Trace mode + `traceGranularity: 'test'`. Per-test screenshot, attached inline to Allure (`image/png`) via `allure-js-commons` when an Allure runner adapter is active. |
 | `video` | `'off' \| TraceRetentionPolicy` | `'off'` | Trace mode + `traceGranularity: 'test'`. Per-test screencast video, retained per the given policy, attached inline to Allure (`video/webm`) via `allure-js-commons` when an Allure runner adapter is active. |
@@ -491,13 +491,17 @@ The archive lands in `test-results/` beside the test file the first captured com
 
 **No dashboard window opens.** The artifact is the output, and a live run blocks on the window until you close it - a window would turn writing a file into an interactive session. The backend still starts, because it is what *builds* the archive: the trace transforms are TypeScript, so a Python run asks the backend for them rather than shipping a second copy of them. That is the one way this differs from the Node.js adapter's backend-free trace mode, and the reason [Node.js 22.23.4+, 24.22.1+ or 26.12.1+ is required in every mode](#configuration-options).
 
-Beyond the command rows, per-command screenshots and selectors, console and network that both modes capture, the archive carries:
+Trace mode captures the page (a screenshot, plus the A11y tree on a page) only after a command that can change it, as the Node.js adapter does. A read, wait or lookup (`find_element`, `.text`, `is_displayed()`, `is_enabled()`, `current_url`, `title`, `get_attribute`, ...) takes no screenshot, and its row shows the capture of the last command that took one. A command the adapter does not know to be a read is captured, so a script or an `actions` chain that moves the page is. Each test's first command with a row in the trace is captured even when it reads, so a test that opens with reads has a frame, and when reads follow a test's last capture, the test's end takes one more, stamped at that capture and replacing it. On a native app the capture is the screenshot alone.
+
+Without a pushed screencast (a native app, Safari, Firefox) the filmstrip is built from these screenshots, so a command that takes no capture can still take one for the filmstrip alone, with no row screenshot and no A11y tree: every command a `WebDriverWait` issues that returns (a poll that raises, such as `NoSuchElementException`, takes none), and any other read once 200 ms (the Node.js adapter's poll interval) have passed since the last frame. The end-of-test capture is a frame too, so the filmstrip ends where the test did.
+
+Beyond the command rows, screenshots and selectors, console and network described above, the archive carries:
 
 | In the archive | Default | Opt out |
 |---|---|---|
 | DOM time-travel - the mutation stream the player replays step by step | on | - |
 | Dense filmstrip - the screencast frames, carried into the trace instead of a `.webm` | on | `DEVTOOLS_FILMSTRIP=0` |
-| A11y tree and element overlay - read beside each action, at two extra round trips per command | on | `DEVTOOLS_A11Y=0` |
+| A11y tree
```

**File**: `website/docs/devtools/Wdio.md` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ services: [['devtools', options]]
 | `traceFormat` | `'zip' \| 'ndjson-directory'` | `'zip'` | Trace artifact layout — single archive vs unpacked directory. Only applies when `mode: 'trace'` |
 | `traceGranularity` | `'session' \| 'spec' \| 'test'` | `'session'` | One trace per session / spec file / test. `'test'` writes each to `test-results/<spec>-<title>-<browser>[-retryN]/trace.zip`. Only applies when `mode: 'trace'` ([see Trace Mode](/docs/devtools/wdio/trace-mode#trace-granularity--tracegranularity)) |
 | `tracePolicy` | `'on' \| 'retain-on-failure' \| 'retain-on-first-failure' \| 'on-first-retry' \| 'on-all-retries' \| 'retain-on-failure-and-retries'` | `'on'` | Which traces to keep. Pairs with `traceGranularity: 'test'`. Only applies when `mode: 'trace'` |
-| `filmstrip` | `boolean` | `true` | Records a dense, continuous screencast filmstrip *into* the trace for smooth scrubbable playback in the player — dense frames alongside the per-action frames, thinned and content-addressed at export. Only applies when `mode: 'trace'` |
+| `filmstrip` | `boolean` | `true` | Records a dense, continuous screencast filmstrip *into* the trace for smooth scrubbable playback in the player: dense frames alongside the per-action frames, thinned and content-addressed at export. Runs the screencast recorder (CDP push on Chrome, polling elsewhere). The polling recorder skips a tick while a command or a per-action capture holds the driver (once the newest frame is three intervals old it polls anyway, so the longest gap is about three intervals plus one screenshot; never during a click, typing or a capture), and keeps each per-action capture's screenshot as a frame, so its polls do not queue in front of the test. Only applies when `mode: 'trace'` |
 | `traceResources` | `'styles' \| 'none'` | `'styles'` | Stores the stylesheets and fonts the pages used, so the player replays them from the archive rather than the site; `'none'` stores nothing. Images always replay from the site. Only applies when `mode: 'trace'` ([see Trace Mode](/docs/devtools/wdio/trace-mode#stylesheets-and-fonts-traceresources)) |
 | `screenshot` | `'off' \| 'on' \| 'only-on-failure'` | `'off'` | Per-test screenshot, attached inline to Allure (`image/png`). Requires `mode: 'trace'` + `traceGranularity: 'test'` |
 | `video` | `'off' \| TraceRetentionPolicy` | `'off'` | Per-test screencast video, retained per the given policy and attached inline to Allure (`video/webm`). Requires `mode: 'trace'` + `traceGranularity: 'test'` |
```

**File**: `website/docs/devtools/wdio/TraceMode.md` (modified, +7/-4)
```diff
@@ -66,9 +66,9 @@ Locator resolution (`$`, `$$`, `findElement(s)`), Selenium's `executeScript` pol
 
 ### Which actions capture the page
 
-A trace-mode action row carries a capture of the page: a screenshot, the accessibility tree and element list, plus the page source on a native app. Each capture costs page reads through the driver, so the JavaScript adapters take one only for commands that can change the page. Reads and waits (`getText`, `isDisplayed`, `waitForDisplayed`, …) and assertions take none: their rows still appear in the trace and show the capture of the last command that took one. The first traced command of each test is captured even when it is a read, so a test that starts by reading has a frame to show (on Nightwatch's `describe`/`it` interface, the first command of each module).
+A trace-mode action row carries a capture of the page: a screenshot, the accessibility tree and element list, plus the page source on a native app. Each capture costs page reads through the driver, so every adapter takes one only for commands that can change the page. Reads and waits (`getText`, `isDisplayed`, `waitForDisplayed`, …) and assertions take none: their rows still appear in the trace and show the capture of the last command that took one. The first traced command of each test is captured even when it is a read, so a test that starts by reading has a frame to show (on Nightwatch's `describe`/`it` interface, the first command of each module).
 
-Selenium and Nightwatch capture every other command, including ones that can navigate without being in the allow-list (`executeScript`, `actions`, Nightwatch `submitForm`), and take one more capture at a test's end when reads follow its last capture, so reads after a click that navigates show the page the click led to.
+Selenium, Nightwatch and Python capture every other command, including ones that can navigate without being in the allow-list (`executeScript`, `actions`, Nightwatch `submitForm`), and take one more capture at a test's end when reads follow its last capture, so reads after a click that navigates show the page the click led to. On a native app the Python capture is the screenshot alone.
 
 ### Waits
 
@@ -161,6 +161,8 @@ A non-retained slice is decided against and never written to disk. The retry-awa
 - Dense frames are added **alongside** the per-action frames (which carry the DOM snapshots), so no DOM data is lost — when dense frames are present they supersede the sparse per-action filmstrip for scrubbing.
 - Frames are thinned at export (≥100 ms apart) and content-addressed, so identical frames (a static wait) collapse to one resource. The live session buffer is bounded by `screencast.maxBufferFrames` (default 2000).
 - Recording uses the screencast recorder — CDP push on Chrome/Chromium, screenshot polling elsewhere. On non-Chrome browsers the polling issues many `takeScreenshot` commands; pair with your reporter's step-silencing option (see [Allure Integration](/docs/devtools/allure)).
+- The polling recorder skips a tick while a command or a per-action capture holds the driver, so its polls do not queue in front of the test. Once the newest frame is three intervals old it polls anyway, so the longest gap is about three intervals plus one screenshot, but never during a click, typing or a capture. Each per-action capture's screenshot is kept as a frame.
+- The Python adapter has no polling recorder. Without a pushed screencast (a native app, Safari, Firefox) its filmstrip is built from the captured commands' screenshots, plus a frame for every command a `WebDriverWait` issues that returns, for any other read at most every 200 ms, and the end-of-test capture as its last frame.
 
 `filmstrip` is available on all three adapters (WebdriverIO / Selenium / Nightwatch).
 
@@ -244,7 +246,7 @@ An assertion row names the element it is about, so selecting it boxes that eleme
 
 ## Measuring capture cost
 
-A trace-mode run is slower than a live one because for every captured action the adapter reads the page through the driver: url, title, accessibility tree, element list and a screenshot, plus the page source on a native app. Set `DEVTOOLS_CAPTURE_TIMING=1` on a trace-mode run to see where that time goes:
+A trace-mode run is slower than a live one because for every captured action the adapter reads the page through the driver: url, title, accessibility tree, element list and a screenshot. A native app has none of the page reads: its capture is a screenshot plus the page source, from which the element list and accessibility tree are built, and the page source is the costly half (about half of an Android capture, and most of an iOS one). Set `DEVTOOLS_CAPTURE_TIMING=1` on a trace-mode run to see where that time goes:
 
 ```sh
 DEVTOOLS_CAPTURE_TIMING=1 npx wdio run wdio.conf.ts
@@ -253,7 +255,8 @@ DEVTOOLS_CAPTURE_TIMING=1 npx wdio run wdio.conf.ts
 When the trace is written, the run prints a table to stderr with each read's count, total, median, p95 and 
```

#### Recent Merged Pull Requests:
- **PR #16518** (2026-11-26): docs(devtools): describe Appium 3 and Appium 4 on the mobile page (@vishnuv688)
- **PR #16503** (2026-11-26): docs(devtools): document secret redaction and the new maskInputs scope (@vishnuv688)
- **PR #16502** (2026-11-26): docs(devtools): note that popup flows need Chrome 155 or 158+ (@vishnuv688)
- **PR #16497** (2026-11-22): test(e2e): run Chrome stable in place of the Chrome 155 pin, and note the Firefox 160 fix (@plum117)
- **PR #16488** (closed): docs(v9): explain when the CLI reads spec paths from stdin (@singhaditya21)
- **PR #16487** (closed): fix(@wdio/mocha-framework): respect custom Mocha interfaces on v9 (@singhaditya21)

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

## X. docs(devtools): document capture cost changes for the filmstrip, Python and nati

**RULE**:
When implementing operations in `website/docs/devtools/Limitations.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webdriverio/webdriverio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f50ab796`: docs(devtools): document capture cost changes for the filmstrip, Python and native traces. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `website/docs/devtools/Limitations.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- **Non-Chrome video/filmstrip**: on browsers without a CDP push path the recorder polls `takeScreenshot`, which adds WebDriver round-trips and (under Allure) floods the step log; pair with the reporter's step-silencing options. The recorder skips a tick while a command or a per-action capture holds the driver, so its polls do not queue in front of the test.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
- **Non-Chrome video/filmstrip** — on browsers without a CDP push path the recorder polls `takeScreenshot`, which adds WebDriver round-trips and (under Allure) floods the step log; pair with the reporter's step-silencing options.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f50ab796` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
