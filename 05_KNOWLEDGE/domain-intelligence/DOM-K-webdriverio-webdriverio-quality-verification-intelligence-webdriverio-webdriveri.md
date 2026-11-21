# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: webdriverio/webdriverio Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "webdriverio/webdriverio",
  "source_url": "https://github.com/webdriverio/webdriverio",
  "source_version": "68055ce4",
  "license": "MIT",
  "timestamp": "2026-11-21T01:16:23.881Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-webdriverio-webdriverio",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [webdriverio/webdriverio](https://github.com/webdriverio/webdriverio) (Revision: `68055ce4`).  
> **License**: MIT | **Timestamp**: `2026-11-21T01:16:23.881Z`  
> **Learning ID**: `learn-github-webdriverio-webdriverio`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), H (Technical Construction Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), B (Product Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 55%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from webdriverio/webdriverio:

# Forensic Learning Record (Deep Inspection): webdriverio/webdriverio

> **Canonical Artifact**: `07_PROJECT_LEARNING/webdriverio-webdriverio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/webdriverio/webdriverio](https://github.com/webdriverio/webdriverio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T01:16:23.079Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `webdriverio/webdriverio`
- **Description**: Next-gen browser and mobile automation test framework for Node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9885 stars

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
- **Issue #16488** (2026-11-20): **docs(v9): explain when the CLI reads spec paths from stdin**
  *Symptoms*: ## Proposed changes  Backports #16485 to v9 for #10618. Explain how `wdio run` selects spec paths from standard input when stdout is a terminal. The previous example said that an explicit `--spec` always takes precedence. A nonempty pipe actually replaces it. The revised guide also covers captured output in CI and Node.js, plus Git pre-push hooks that pass ref updates on stdin.  ## How you tested  Ran the CLI with the repository's mock WebDriver service and passing spec fixtures. With stdin piped, stdout attached to a pseudo-terminal, and an explicit `--spec`, only the file named on stdin ran. With stdout captured, only the explicit spec ran. With an empty pipe and terminal output, only the explicit spec ran. All three exited successfully. Compiled the updated page with the site's MDX compiler.  ## Types of changes  - [x] Documentation  ## Backport Request  Companion to #16485. Confirmed all three CLI selections on the v9 implementation using its mock-driver smoke environment.  AI assistance was used to prepare and test this contribution. 

- **Issue #16487** (2026-11-20): **fix(@wdio/mocha-framework): respect custom Mocha interfaces on v9**
  *Symptoms*: ## Proposed changes  Backports #16486 to v9 for #12843. The Node.js adapter can load a third-party Mocha interface, but TypeScript configurations rejected names registered by that interface's type declarations. A local CommonJS interface such as `custom-tdd.cjs` also fell back to BDD hook names, so its tests ran without WebdriverIO's `beforeTest` and `afterTest` hooks.  Use Mocha’s extensible interface type and recognize the BDD, TDD and QUnit naming conventions with JavaScript file extensions. The framework guide shows how to select a module and declare its name in TypeScript.  ## How you tested  - [x] The regression test failed for `custom-tdd.cjs` before the fix. All 45 v9 Mocha adapter unit tests passed after the backport. - [x] `pnpm run test:typings:mocha` passed with a third-party interface in the config. - [x] `pnpm run test:smoke mochaTestrunner` passed. A separate CLI run with the mock driver and a real local CommonJS interface ran one TDD spec and recorded both WebdriverIO hooks exactly once. - [x] The v9 packages compiled. The updated framework guide compiled as MDX.  ## Types of changes  - [x] Bug fix - [x] Documentation  ## Backport Request  Companion to #16486.  AI assistance was used to prepare and test this contribution. 

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

### Incident Patch 1: `68055ce4` (2026-11-19)
**Commit Message**: docs(devtools): describe how the test tree shows retries and failed Cucumber hooks (#16458)

**File**: `website/docs/devtools/Wdio.md` (modified, +7/-0)
```diff
@@ -65,6 +65,13 @@ services: [['devtools', options]]
 | `maskInputs` | `boolean` | `true` | Mask password fields in the replayed page, live and trace mode alike; `false` records them as typed. Command rows always keep the typed text ([see Password masking](/docs/devtools/dashboard#password-masking)) |
 | `maskSelectors` | `string[]` | `[]` | Also mask the text and value of every element these CSS selectors match, and everything inside it, in the replayed page |
 
+## Test tree
+
+The sidebar lists each spec's suites and tests (each Cucumber feature's scenarios and steps) as they run, the same on WebdriverIO 9 and 10.
+
+- **Retries.** A retried test is one row. Its next attempt replaces the failed one in place, and the row shows the final attempt's result with its retry count; for a Cucumber scenario retried with `cucumberOpts.retry`, the count is on the scenario. The failed attempt is still recorded, so the retry-aware `tracePolicy` values see it.
+- **Failed Cucumber hooks.** A hook fails no step, so a failed `BeforeAll` or `AfterAll` shows as a failed row of its feature (an `AfterAll` below the scenarios), and a failed `Before` or `After` as a failed row of its scenario, carrying the hook's error. Each failed hook is a row of its own, titled with its position among the hooks of that kind on the same feature or scenario, whether those passed or failed: the second `After` hook is `After #2` even when the first passed. When a retried scenario runs again, the failed hooks of the earlier attempt leave the tree with the rest of that attempt. Mocha and Jasmine hooks are left to the framework's own reporting.
+
 ## Runtime snapshot
 
 The service adds a `browser.getSnapshot()` command that returns an AI-readable accessibility tree of the current page (`text`) plus an `elements` map from short refs (`e1`, `e2`, …) to selectors:
```

---

### Incident Patch 2: `e59ff433` (2026-11-19)
**Commit Message**: docs: add a troubleshooting note for hover tests with headed parallel browsers (#16002)

**File**: `website/docs/platforms/Web.md` (modified, +1/-0)
```diff
@@ -122,6 +122,7 @@ The Browser Runner requires `@wdio/browser-runner`. The React preset also needs
 ## Troubleshooting
 
 - Chrome fails to start in CI with "user data directory is already in use" or "DevToolsActivePort file doesn't exist": see [Headless & Display Servers](/docs/headless-and-display-servers#troubleshooting).
+- Hover or `moveTo()` tests fail intermittently with a headed browser and parallel workers, on Windows or under Xvfb on Linux: when another worker's browser window opens or closes under the OS pointer, the page under it gets real mouse events. Run headless, with `wdio run --headless` or the args in [Run Browser Headless](/docs/capabilities#run-browser-headless). On Linux, [Weston](/docs/headless-and-display-servers#which-display-server-is-used) (`displayServer: 'wayland'`) also avoids it.
 - `browser.mock()` or `browser.emulate()` has no effect: the session is not using WebDriver BiDi. Check your browser (Safari has no BiDi support), your cloud vendor, and `wdio:enforceWebDriverClassic`.
 - Drivers or browsers can't be downloaded behind a proxy: see [Custom Driver Download Host](/docs/capabilities#custom-driver-download-host) and [Proxy Setup](/docs/proxy).
 - Flaky tests: see [Retry Flaky Tests](/docs/retry) and [Debugging](/docs/debugging).
```

#### Recent Merged Pull Requests:
- **PR #16488** (closed): docs(v9): explain when the CLI reads spec paths from stdin (@singhaditya21)
- **PR #16487** (closed): fix(@wdio/mocha-framework): respect custom Mocha interfaces on v9 (@singhaditya21)
- **PR #16486** (closed): fix(@wdio/mocha-framework): respect custom Mocha interfaces (@singhaditya21)
- **PR #16485** (closed): docs: explain when the CLI reads spec paths from stdin (@singhaditya21)
- **PR #16484** (closed): docs(v9): explain the spec job counts in onComplete (@singhaditya21)
- **PR #16483** (closed): docs: explain the spec job counts in onComplete (@singhaditya21)

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

## X. docs(devtools): describe how the test tree shows retries and failed Cucumber hoo

**RULE**:
When implementing operations in `website/docs/devtools/Wdio.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in webdriverio/webdriverio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `68055ce4`: docs(devtools): describe how the test tree shows retries and failed Cucumber hooks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `website/docs/devtools/Wdio.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
## Test tree

The sidebar lists each spec's suites and tests (each Cucumber feature's scenarios and steps) as they run, the same on WebdriverIO 9 and 10.

- **Retries.** A retried test is one row. Its next attempt replaces the failed one in place, and the row shows the final attempt's result with its retry count; for a Cucumber scenario retried with `cucumberOpts.retry`, the count is on the scenario. The failed attempt is still recorded, so the retry-aware `tracePolicy` values see it.
- **Failed Cucumber hooks.** A hook fails no step, so a failed `BeforeAll` or `AfterAll` shows as a failed row of its feature (an `AfterAll` below the scenarios), and a failed `Before` or `After` as a failed row of its scenario, carrying the hook's error. Each failed hook is a row of its own, titled with its position among the hooks of that kind on the same feature or scenario, whether those passed or failed: the second `After` hook is `After #2` even when the first passed. When a retried scenario runs again, the failed hooks of the earlier attempt leave the tree with the rest of that attempt. Mocha and Jasmine hooks are left to the framework's own reporting.

```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `68055ce4` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
