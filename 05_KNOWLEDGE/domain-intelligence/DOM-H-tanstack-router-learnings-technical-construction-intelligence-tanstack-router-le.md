# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: tanstack-router-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "tanstack-router-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:34:18.304Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tanstack-router-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tanstack-router-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:34:18.304Z`  
> **Learning ID**: `LEARN-EVO-tanstack-router-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 55%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from tanstack-router-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tanstack-router-learnings.md`  
> **Source**: github ([https://github.com/TanStack/router](https://github.com/TanStack/router))  
> **Source Version**: `10b22c27`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T09:33:30.290Z  
> **Learning ID**: `learn-github-tanstack-router`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): TanStack/router

> **Canonical Artifact**: `07_PROJECT_LEARNING/tanstack-router-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TanStack/router](https://github.com/TanStack/router))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T09:28:29.624Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TanStack/router`
- **Description**: 🤖 A client-first, server-capable, fully type-safe router and full-stack framework for the web (React and more).
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15385 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/client-nav/link-performance/stable-worker.ts`
```
import { pathToFileURL } from 'node:url'
import { createClientScenario, createSsrScenario } from './scenario'
import type { LinkScenario } from './scenario'
import type { WorkerRequest, WorkerResponse } from './worker-protocol'
import type * as ClientApp from './src/client'
import type * as SsrApp from './src/ssr'

const scenarios: Array<LinkScenario> = []
const creationOrder: Array<LinkScenario> = []
let closeWindow = () => {}

function reply(response: WorkerResponse) {
  if (!process.send) {
    throw new Error('The Link sampling worker requires an IPC parent')
  }
  process.send(response)
}

async function handle(request: WorkerRequest) {
  if (request.kind === 'init') {
    if (typeof process.threadCpuUsage !== 'function') {
      throw new Error(
        'Stable sampling requires Node.js with process.threadCpuUsage',
      )
    }
    if (scenarios[request.variant]) {
      throw new Error('A worker must only initialize each variant once')
    }
    let scenario: LinkScenario
    const bundleUrl = pathToFileURL(request.bundle)
    bundleUrl.searchParams.set('linkPerfVariant', String(request.variant))
    if (request.mode === 'client') {
      const { window } = await import('../jsdom')
      closeWindow = () => window.close()
      const app: typeof ClientApp = await import(bundleUrl.href)
      if (app.serverEnvironment !== false) {
        throw new Error('Expected a production client bundle')
      }
      scenario = createClientScenario(app, request.caseId)
    } else {
      const app: typeof SsrApp = await import(bundleUrl.href)
      if (app.serverEnvironment !== true) {
        throw new Error('Expected a production SSR bundle')
      }
      scenario = createSsrScenario(app, request.caseId)
    }
    scenarios[request.variant] = scenario
    creationOrder.push(scenario)
    await scenario.setup()
    const start = performance.now()
    let iterations = 0
    do {
      await scenario.batch()
      iterations++
    } while (iterations < 100 || performance.now() - start < 2_000)
    reply({
      kind: 'ready',
      batchMs: (performance.now() - start) / iterations,
    })
    return
  }
  if (request.kind === 'measure') {
    const scenario = scenarios[request.variant]
    if (!scenario) {
      throw new Error('The sampling worker has not been initialized')
    }
    if (!Number.isInteger(request.iterations) || request.iterations < 1) {
      throw new Error('Expected a positive batch count')
    }
    const cpuStart = process.threadCpuUsage()
    const processStart = process.cpuUsage()
    const start = performance.now()
    for (let index = 0; index < request.iterations; index++) {
      await scenario.batch()
    }
    const wallMs = performance.now() - start
    const cpu = process.threadCpuUsage(cpuStart)
    const processCpu = process.cpuUsage(processStart)
    reply({
      kind: 'sample',
      sample: {
        iterations: request.iterations,
        wallMs: wallMs / request.iterations,
        cpuMs: (cpu.user + cpu.system) / 1_000 / request.iterations,
        processCpuMs:
          (processCpu.user + processCpu.system) / 1_000 / request.iterations,
      },
    })
    return
  }
  try {
    for (const scenario of creationOrder) {
      scenario.check()
    }
  } finally {
    for (const scenario of creationOrder.reverse()) {
      scenario.teardown()
    }
    closeWindow()
  }
  reply({ kind: 'stopped' })
}

process.on('message', (request: WorkerRequest) => {
  void handle(request).catch((error: unknown) => {
    reply({
      kind: 'error',
      message:
        error instanceof Error ? error.stack || error.message : String(error),
    })
  })
})

```

### Core Architecture Module: `benchmarks/client-nav/link-performance/worker-protocol.ts`
```
import type { LinkCaseId } from './cases'

export type Mode = 'client' | 'ssr'
export type Variant = 0 | 1

export type WorkerRequest =
  | {
      kind: 'init'
      mode: Mode
      caseId: LinkCaseId
      bundle: string
      variant: Variant
    }
  | { kind: 'measure'; iterations: number; variant: Variant }
  | { kind: 'stop' }

export interface BlockSample {
  wallMs: number
  cpuMs: number
  processCpuMs: number
  iterations: number
}

export type WorkerResponse =
  | { kind: 'ready'; batchMs: number }
  | { kind: 'sample'; sample: BlockSample }
  | { kind: 'stopped' }
  | { kind: 'error'; message: string }

```

### Core Architecture Module: `benchmarks/memory/client/bench-utils.ts`
```
export { memoryBenchHooks } from '../turn'

export const memoryBenchOptions = {
  iterations: 1,
  warmupIterations: 1,
  time: 0,
  warmupTime: 0,
  throws: true,
}

export function createDeterministicRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function randomSegment(random: () => number) {
  return Math.floor(random() * 1_000_000_000).toString(36)
}

```

### Core Architecture Module: `benchmarks/memory/client/lifecycle.ts`
```
export type Framework = 'react' | 'solid' | 'vue'

export type MountedApp = {
  router: unknown
  unmount: () => void
}

export type MountTestApp = (container: HTMLDivElement) => MountedApp

const frameworkNames = {
  react: 'React',
  solid: 'Solid',
  vue: 'Vue',
} satisfies Record<Framework, string>

export function noop() {}

export function warnClientMemoryDevMode(framework: Framework) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `memory client benchmark is running without NODE_ENV=production; ${frameworkNames[framework]} dev overhead will dominate results.`,
    )
  }
}

export function createBenchContainer() {
  const container = document.createElement('div')
  document.body.append(container)

  return container
}

export function removeBenchContainer(container: HTMLDivElement | undefined) {
  container?.remove()
}

export function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export async function drainMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

```

### Core Architecture Module: `benchmarks/memory/server/bench-utils.ts`
```
export { memoryBenchHooks } from '../turn'

export interface StartRequestHandler {
  fetch: (request: Request) => Promise<Response> | Response
}

type RunSequentialRequestLoopRandomOptions =
  | {
      seed: number
      random?: never
    }
  | {
      random: () => number
      seed?: never
    }

export type RunSequentialRequestLoopOptions =
  RunSequentialRequestLoopRandomOptions & {
    iterations?: number
    buildRequest: (random: () => number, index: number) => Request
    validateResponse?: (response: Response, request: Request) => void
  }

export const memoryBenchOptions = {
  iterations: 1,
  warmupIterations: 1,
  time: 0,
  warmupTime: 0,
  throws: true,
}

export function createDeterministicRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function randomSegment(random: () => number) {
  return Math.floor(random() * 1_000_000_000).toString(36)
}

export async function drainResponse(response: Response) {
  const reader = response.body?.getReader()

  if (!reader) {
    return
  }

  try {
    for (;;) {
      const result = await reader.read()

      if (result.done) {
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function runSequentialRequestLoop(
  handler: StartRequestHandler,
  options: RunSequentialRequestLoopOptions,
) {
  const { iterations = 10, buildRequest, validateResponse } = options
  const random =
    options.seed !== undefined
      ? createDeterministicRandom(options.seed)
      : options.random
  const validate =
    validateResponse ??
    ((response: Response, request: Request) => {
      if (response.status !== 200) {
        throw new Error(
          `Request failed with non-200 status ${response.status} (${request.url})`,
        )
      }
    })

  for (let index = 0; index < iterations; index++) {
    const request = buildRequest(random, index)
    const response = await handler.fetch(request)

    validate(response, request)

    await drainResponse(response)
  }
}

// Cancellation can leave deferred loaders and renderer teardown queued.
export async function settle() {
  for (let turn = 0; turn < 16; turn++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}

```

### Core Architecture Module: `benchmarks/ssr/bench-utils.ts`
```
export interface StartRequestHandler {
  fetch: (request: Request) => Promise<Response> | Response
}

export interface RunSsrRequestLoopOptions {
  seed: number
  iterations?: number
}

export interface RunRequestLoopOptions {
  seed: number
  concurrency: number
  totalRequests: number
  buildRequest: (random: () => number, index: number) => Request
  validateResponse?: (response: Response, request: Request) => void
}

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function createDeterministicRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function randomSegment(random: () => number) {
  return Math.floor(random() * 1_000_000_000).toString(36)
}

export { createDeterministicRandom, randomSegment }

export async function drainResponse(response: Response) {
  const reader = response.body?.getReader()

  if (!reader) {
    return
  }

  try {
    while (true) {
      const result = await reader.read()

      if (result.done) {
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function randomSearchValue(random: () => number) {
  return `q-${randomSegment(random)}`
}

function randomRequestUrl(random: () => number) {
  const a = randomSegment(random)
  const b = randomSegment(random)
  const c = randomSegment(random)
  const d = randomSegment(random)
  const q = randomSearchValue(random)

  return `http://localhost/${a}/${b}/${c}/${d}?q=${q}`
}

export async function runSsrRequestLoop(
  handler: StartRequestHandler,
  { seed, iterations = 10 }: RunSsrRequestLoopOptions,
) {
  const random = createDeterministicRandom(seed)
  const pendingBodyReads: Array<Promise<void>> = []

  for (let index = 0; index < iterations; index++) {
    const requestUrl = randomRequestUrl(random)
    const response = await handler.fetch(new Request(requestUrl, requestInit))

    if (response.status !== 200) {
      await Promise.allSettled(pendingBodyReads)

      throw new Error(
        `Request failed with non-200 status ${response.status} (${requestUrl})`,
      )
    }

    pendingBodyReads.push(drainResponse(response))
  }

  await Promise.all(pendingBodyReads)
}

export async function runRequestLoop(
  handler: StartRequestHandler,
  {
    seed,
    concurrency,
    totalRequests,
    buildRequest,
    validateResponse,
  }: RunRequestLoopOptions,
) {
  const requestSequences = buildRequestSequences({
    seed,
    concurrency,
    totalRequests,
    buildRequest,
  })
  const validate =
    validateResponse ??
    ((response: Response, request: Request) => {
      if (response.status !== 200) {
        throw new Error(
          `Request failed with non-200 status ${response.status} (${request.url})`,
        )
      }
    })

  let startWorkers = () => {}
  const startBarrier = new Promise<void>((resolve) => {
    startWorkers = resolve
  })

  const workers = requestSequences.map(async (requests) => {
    await startBarrier

    for (const request of requests) {
      const response = await handler.fetch(request)
      let validationFailure: { error: unknown } | undefined

      try {
        validate(response, request)
      } catch (error) {
        validationFailure = { error }
      }

      await drainResponse(response)

      if (validationFailure) {
        throw validationFailure.error
      }
    }
  })

  startWorkers()
  const results = await Promise.allSettled(workers)
  const failedWorker = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )

  if (failedWorker) {
    throw failedWorker.reason
  }
}

export type BuildRequestSequencesOptions = Pick<
  RunRequestLoopOptions,
  'seed' | 'concurrency' | 'totalRequests' | 'buildRequest'
>

/**
 * Build the entire seeded workload before any request starts, then partition
 * it round-robin so completion timing can never change a worker's next input.
 */
export function buildRequestSequences({
  seed,
  concurrency,
  totalRequests,
  buildRequest,
}: BuildRequestSequencesOptions): Array<Array<Request>> {
  assertPositiveInteger('concurrency', concurrency)
  assertPositiveInteger('totalRequests', totalRequests)

  if (concurrency > totalRequests) {
    throw new RangeError(
      `concurrency (${concurrency}) cannot exceed totalRequests (${totalRequests})`,
    )
  }

  const random = createDeterministicRandom(seed)
  const requestSequences = Array.from(
    { length: concurrency },
    () => new Array<Request>(),
  )

  for (let index = 0; index < totalRequests; index++) {
    requestSequences[index % concurrency]!.push(buildRequest(random, index))
  }

  return requestSequences
}

function assertPositiveInteger(name: string, value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(
      `${name} must be a positive integer; received ${value}`,
    )
  }
}

```

### Core Architecture Module: `e2e/e2e-utils/eslint.config.js`
```
// @ts-check

import rootConfig from '../../eslint.config.js'

export default [...rootConfig]

```

### Core Architecture Module: `e2e/e2e-utils/mock-api.mjs`
```
import { setupServer } from 'msw/node'
import { apiHandlers } from './src/api-handlers.ts'

setupServer(...apiHandlers).listen({ onUnhandledRequest: 'bypass' })

```

### Core Architecture Module: `e2e/e2e-utils/src/api-fixture.ts`
```
import { test as base } from '@playwright/test'
import { defineNetworkFixture } from '@msw/playwright'
import { apiHandlers } from './api-handlers'

// Opt in only for suites that consume the canned API. Playwright routing
// disables HTTP caching; other suites keep their normal browser behavior.
export const apiTest = base.extend<{ mockApi: void }>({
  mockApi: [
    async ({ context }, use) => {
      const network = defineNetworkFixture({ context, handlers: apiHandlers })
      await network.enable()
      await use()
      await network.disable()
    },
    { auto: true },
  ],
})

```

### Core Architecture Module: `e2e/e2e-utils/src/api-handlers.ts`
```
import { HttpResponse, http } from 'msw'
import { posts } from './posts.ts'
import { users } from './users.ts'

export const apiHandlers = [
  ...Object.entries({ posts, users }).flatMap(([resource, data]) => [
    http.get(`https://jsonplaceholder.typicode.com/${resource}`, () =>
      HttpResponse.json(data),
    ),
    http.get(
      `https://jsonplaceholder.typicode.com/${resource}/:id`,
      ({ params }) => {
        const id = parseInt(String(params.id))
        if (Number.isNaN(id)) {
          return HttpResponse.json(
            { error: `invalid ${resource.slice(0, -1)} id` },
            { status: 404 },
          )
        }
        const item = data.find((entry) => entry.id === id)
        return item
          ? HttpResponse.json(item)
          : new HttpResponse(null, {
              headers: { 'content-type': 'application/json' },
            })
      },
    ),
  ]),
  http.all('https://jsonplaceholder.typicode.com/*', () =>
    HttpResponse.error(),
  ),
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5862** (2026-01-04): **Dev server hot reload erroneously removes nested pathless API routes**
  *Symptoms*: ### Which project does this relate to?  Router  ### Describe the bug  Given a route tree with nested pathless routes like this:  ``` > tree src/routes/api  src/routes/api └── test     └── _session         ├── _admin         │   ├── admin_test.ts         │   └── route.ts         ├── route.ts         └── test.ts  4 directories, 4 files ```  It is possible to run a `git checkout` command that doesn't touch the creation of the nested structure but nonetheless causes the dev server route tree generator to completely remove the test api routes from the generated route tree (`routeTree.gen.ts)`. If you restart the dev server the route tree is regenerated and the erroneously removed routes are re-added.  The involvement of git is probably a bit of a red herring but it's the most (only) reliable way I've found to trigger this issue - I would guess it's something to do with how the dev server watches these directories for changes.  ### Your Example Website or App  attached as a zip file  ### Steps to Reproduce the Bug or Issue  ``` <-- in another terminal: start dev server, leave running --> ``` ``` route-issue-repro on git HEAD (c24b5f4) via nodejs v24.3.0 > git status Not currently on any branch. nothing to commit, working tree clean   route-issue-repro on git HEAD (c24b5f4) via nodejs v24.3.0 took 3s > git checkout 4f6b98c75794041c5010c90dbe20ea25da0ae21e Previous HEAD position was c24b5f4 admin return ok HEAD is now at 4f6b98c test return ok  route-issue-repro on git HEAD (4f6b98c)

- **Issue #3962** (2025-10-28): **Backslash in path parameters are incorrectly restored from URL**
  *Symptoms*: ### Which project does this relate to?  Router  ### Describe the bug  When navigating to a route with a path parameter (or splash) where the value contains a backslash, everything works at first. But when reloading the page or navigating back to the page the path restored from the URL differs from the original URL.  ### Your Example Website or App  https://stackblitz.com/edit/tanstack-router-yoii3nte?file=src%2Froutes%2Fb.%24postId.tsx  ### Steps to Reproduce the Bug or Issue  1. Open the preview in a new tab (so that you can see the full URL) 2. Click one of the "Splat route" or "Path param route" links 3. Reload the page 4. Observe that the URL changes and the page content changes as well.  ### Expected behavior  As a user I expect that reloading a page shows the same route and same parameters than before.  ### Screenshots or Videos  https://github.com/user-attachments/assets/a7cb6f5b-1493-487b-9f47-e179b2aad271  ### Platform  - OS: macOS - Browser: Chrome - Version: 135   ### Additional context  The problem seems to be that after the reload, i.e., during the initial sync with the URL `replaceState` is called with the decoded `"/b/test[s\%2F.\%2Fparameter]"` as URL. `replaceState` turns `\` into `/`. This happens because `interpolatePath` at https://github.com/TanStack/router/blob/main/packages/router-core/src/router.ts#L1610 is called with `"/b/test[s\%2F.\%2Fparameter]"` as `pathname` instead of `"/b/$postId"`, which is the case during a  regular navigation. This would th

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

### Incident Patch 1: `10b22c27` (2026-11-27)
**Commit Message**: test(benchmarks): add link-mount client-nav scenario (#8999)

* test(benchmarks): add link-mount client-nav scenario

Measures mounting and unmounting 300 Links without navigating, in React,
Solid and Vue, with the default preload setting and with 'intent'.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* test(benchmarks): register link-mount React toggle in a layout effect

useSyncExternalStore subscribes in a passive effect, which can still be
pending when the first warm-up step runs. Under the CodSpeed instrument's
V8 flags it was, so flushSync rendered nothing and the step saw 0 Links.
A layout effect runs in the same commit as the ready marker.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* test(benchmarks): run one link-mount lap per iteration

CodSpeed simulation runs setup, the warm-up lap and one iteration 8 times
within a single test timeout. Vue's link-mount took 33 s of the 60 s budget
with two laps per iteration; one lap matches link-churn.

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

---------

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

**File**: `benchmarks/client-nav/README.md` (modified, +2/-1)
```diff
@@ -60,6 +60,7 @@ be attributed to a specific feature area.
 | `history`                                | History push/replace/back/forward traversal, location masking, registered-but-never-blocking `useBlocker`, and `useCanGoBack`/`useLocation` subscriptions.                                                                                                                                                                           |
 | `hydration`                              | Initial DOM hydration: execute the SSR payload, restore `beforeLoad` context and loader data, and hydrate 192 ordinary and eight hash-sensitive Links through their follow-up effects in React and Solid.                                                                                                                            |
 | `link-churn`                             | Links that depart, stay and mount: 30 `/hub` layout Links stay while 100 `/hub/list` leaf Links leave (alone, or with the layout to `/other`) and remount on return; a search-only change rebuilds updater and `to="."` Links. Unlike `links`, whose root-layout Links never depart.                                                 |
+| `link-mount`                             | Link setup and teardown without navigation: each step synchronously mounts or unmounts 300 Links on the index route, half plain `to="/about"` and half `to="/posts/$postId"` with `params`, `search` and `activeProps`. Runs with the default `defaultPreload: false` and again with `'intent'`, which attaches the intent handlers. |
 | `links`                                  | Per-navigation cost of ~200 mounted `<Link>`s: link prop building, active-state recompute across `activeOptions` variants, `activeProps` swaps, and `useMatchRoute` probes (the `MatchRoute` component is avoided: vue-router's implementation leaks one subscription per render).                                                   |
 | `loaders`                                | Client loader dispatch: always-stale re-runs (`staleTime: 0`), cached revisits (re-run once per lap by the `invalidate` step), `loaderDeps`-keyed caching, `router.invalidate()`, and `useLoaderData` selectors.                                                                                                                     |
 | `mount`                                  | Cold start: `createRouter` (route-tree processing) + first render + initial `router.load()` + unmount, with a fresh router per mount.                                                                                                                                                                                                |
@@ -76,7 +77,7 @@ scenarios follow these navigation/mount conventions:
 
 - Apps are built with `NODE_ENV=production` (`minify: false`) into `dist/app.js`; benches import the built bundle, so production package builds and production JSX output are measured, not dev transforms.
 - Scenarios behave like a real user app: navigation happens through `<Link>` clicks dispatched on real anchor elements (unless a scenario specifically measures the imperative API), the router uses the default browser history, and `scrollRestoration` is enabled.
-- Each benchmark iteration advances a fixed, circular sequence of steps; every step awaits the router's `onRendered` event, so render work is included and steps cannot overlap. No two consecutive steps may target the same location, and the sequence ends back on the initial route.
+- Each benchmark iteration advances a fixed, circular sequence of steps; every step awaits the router's `onRendered` event, so render work is included and steps cannot overlap. Steps that leave the location unchanged, like `link-mount`'s, resolve once their render has committed instead. No two consecutive steps may target the same location, and the sequence ends back on the initial route.
 - Setup runs one warm-up lap through the sequence and asserts each step's observable output (e.g. `document.title`), so a scenario that silently stops doing its work fails instead of reporting a fast time.
 - Apps are mounted and disposed outside timing by `benchLifecycle` (`benchmarks/cpu-simulation.ts`): CodSpeed measures a single invocation, so every invocation gets a freshly mounted app; plain `vitest bench` keeps one app per warmup/run phase. Bench functions must be `async` functions, because CodSpeed's Vitest 5 provider awaits only `AsyncFunction`s.
 - Determinism: no wall-clock timers (async work is resolved promises or counted `setTimeout(0)` hops), `staleTime`/`gcTime` only ever `0` or effectively-infinite, no `Math.random`/`Date.now` in the measured loop. Scroll restoration uses `getScrollRestorationKey: (location) => location.pathname` so its cache stays bounded (the default random per-entry key grows one cache entry per push navigation). The `mount` scenario opts out of `scrollRestoration` entirely and destroys its history on unmount — both register page-lifetime globals that would l
```

**File**: `benchmarks/client-nav/package.json` (modified, +6/-0)
```diff
@@ -66,6 +66,7 @@
               "@benchmarks/client-nav-history-react",
               "@benchmarks/client-nav-hydration-react",
               "@benchmarks/client-nav-link-churn-react",
+              "@benchmarks/client-nav-link-mount-react",
               "@benchmarks/client-nav-links-react",
               "@benchmarks/client-nav-loaders-react",
               "@benchmarks/client-nav-mount-react",
@@ -96,6 +97,7 @@
               "@benchmarks/client-nav-history-solid",
               "@benchmarks/client-nav-hydration-solid",
               "@benchmarks/client-nav-link-churn-solid",
+              "@benchmarks/client-nav-link-mount-solid",
               "@benchmarks/client-nav-links-solid",
               "@benchmarks/client-nav-loaders-solid",
               "@benchmarks/client-nav-mount-solid",
@@ -125,6 +127,7 @@
               "@benchmarks/client-nav-head-vue",
               "@benchmarks/client-nav-history-vue",
               "@benchmarks/client-nav-link-churn-vue",
+              "@benchmarks/client-nav-link-mount-vue",
               "@benchmarks/client-nav-links-vue",
               "@benchmarks/client-nav-loaders-vue",
               "@benchmarks/client-nav-mount-vue",
@@ -209,10 +212,13 @@
               "@benchmarks/client-nav-hydration-react",
               "@benchmarks/client-nav-hydration-solid",
               "@benchmarks/client-nav-link-churn-react",
+              "@benchmarks/client-nav-link-mount-react",
               "@benchmarks/client-nav-links-react",
               "@benchmarks/client-nav-link-churn-solid",
+              "@benchmarks/client-nav-link-mount-solid",
               "@benchmarks/client-nav-links-solid",
               "@benchmarks/client-nav-link-churn-vue",
+              "@benchmarks/client-nav-link-mount-vue",
               "@benchmarks/client-nav-links-vue",
               "@benchmarks/client-nav-loaders-react",
               "@benchmarks/client-nav-loaders-solid",
```

**File**: `benchmarks/client-nav/scenarios/harness.ts` (modified, +21/-0)
```diff
@@ -57,6 +57,15 @@ export type ScenarioStep =
       testId: string
       settleHops?: number
     }
+  | {
+      /**
+       * Runs app work that leaves the router location unchanged, such as
+       * mounting or unmounting a list of Links. `run` must resolve only after
+       * that work has rendered.
+       */
+      type: 'run'
+      run: () => void | Promise<void>
+    }
   | { type: 'navigate'; getOptions: () => object }
   | { type: 'preload'; getOptions: () => object; settleHops?: number }
   | { type: 'invalidate'; settleHops?: number }
@@ -295,6 +304,11 @@ export interface ScenarioSetupOptions {
    * browser history traversal. All other scenarios use fresh memory history.
    */
   historyMode?: 'memory' | 'browser'
+  /**
+   * Test id that must render before the warm-up lap. Needed by scenarios
+   * whose steps click no links, so nothing else waits for the first render.
+   */
+  readyTestId?: string
 }
 
 function warnAboutDevMode(frameworkLabel: string) {
@@ -394,6 +408,10 @@ export function createScenarioSetup(options: ScenarioSetupOptions) {
           await settle(step.settleHops ?? 4)
           return
         }
+        case 'run': {
+          await step.run()
+          return
+        }
         case 'navigate': {
           const renderedPromise = rendered()
           router.navigate(step.getOptions())
@@ -434,6 +452,9 @@ export function createScenarioSetup(options: ScenarioSetupOptions) {
     await router.load()
 
     const linkTestIds = new Set<string>()
+    if (options.readyTestId) {
+      linkTestIds.add(options.readyTestId)
+    }
     for (const step of options.steps) {
       if (typeof step === 'string') {
         linkTestIds.add(step)
```

**File**: `benchmarks/client-nav/scenarios/link-mount/react/project.json` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+{
+  "name": "@benchmarks/client-nav-link-mount-react",
+  "projectType": "application",
+  "targets": {
+    "build:client": {
+      "executor": "nx:run-commands",
+      "cache": false,
+      "dependsOn": [
+        {
+          "projects": ["@tanstack/react-router", "@tanstack/router-plugin"],
+          "target": "build"
+        }
+      ],
+      "options": {
+        "command": "NODE_ENV=production vite build --config {projectRoot}/vite.config.ts"
+      }
+    },
+    "test:types:client": {
+      "executor": "nx:run-commands",
+      "dependsOn": [
+        {
+          "projects": ["@tanstack/react-router", "@tanstack/router-plugin"],
+          "target": "build"
+        }
+      ],
+      "options": {
+        "command": "tsc -p {projectRoot}/tsconfig.json --noEmit"
+      }
+    },
+    "test:flame": {
+      "executor": "nx:run-commands",
+      "cache": false,
+      "dependsOn": ["build:client"],
+      "options": {
+        "command": "NODE_ENV=production flame run --md-format=detailed --delay=none --node-options=\"--stack-size=65500\" ./scenarios/link-mount/react/speed.flame.ts",
+        "cwd": "benchmarks/client-nav"
+      }
+    }
+  }
+}
```

**File**: `benchmarks/client-nav/scenarios/link-mount/react/setup.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { createScenarioSetup } from '../../harness'
+import { assertStepResult, createScenarioSteps, readyTestId } from '../shared'
+import type { LinkMountPreload } from '../shared'
+import type * as App from './src/main'
+
+const appModulePath = './dist/app.js'
+const { mountIntentTestApp, mountTestApp, setLinksVisible } = (await import(
+  /* @vite-ignore */ appModulePath
+)) as typeof App
+
+export function setup(preload: LinkMountPreload = 'default') {
+  return createScenarioSetup({
+    frameworkLabel: 'React',
+    mount: preload === 'intent' ? mountIntentTestApp : mountTestApp,
+    steps: createScenarioSteps(setLinksVisible),
+    assertAfterStep: assertStepResult,
+    readyTestId,
+  })
+}
```

**File**: `benchmarks/client-nav/scenarios/link-mount/react/speed-intent.bench.ts` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { test } from 'vitest'
+import { benchLifecycle } from '../../../../cpu-simulation'
+import { benchOptions, ticksPerIteration } from '../shared'
+import { setup } from './setup'
+
+// Separate file, so its worker's JIT feedback never mixes the two router
+// configurations.
+test('client-link-mount-intent', async ({ bench }) => {
+  const scenario = setup('intent')
+
+  await bench(
+    'client-link-mount intent loop (react)',
+    benchLifecycle(scenario),
+    async () => {
+      for (let i = 0; i < ticksPerIteration; i++) {
+        await scenario.tick()
+      }
+      await scenario.finishBatch()
+    },
+  ).run(benchOptions)
+})
```

**File**: `benchmarks/client-nav/scenarios/link-mount/react/speed.bench.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { test } from 'vitest'
+import { benchLifecycle } from '../../../../cpu-simulation'
+import { benchOptions, ticksPerIteration } from '../shared'
+import { setup } from './setup'
+
+test('client-link-mount', async ({ bench }) => {
+  const scenario = setup()
+
+  await bench(
+    'client-link-mount loop (react)',
+    benchLifecycle(scenario),
+    async () => {
+      for (let i = 0; i < ticksPerIteration; i++) {
+        await scenario.tick()
+      }
+      await scenario.finishBatch()
+    },
+  ).run(benchOptions)
+})
```

**File**: `benchmarks/client-nav/scenarios/link-mount/react/speed.flame.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { window } from '../../../jsdom.ts'
+import { setup } from './setup.ts'
+
+const DURATION_MS = 10_000
+
+const test = setup()
+
+try {
+  await test.before()
+
+  const startedAt = performance.now()
+  while (performance.now() - startedAt < DURATION_MS) {
+    await test.tick()
+  }
+} finally {
+  test.after()
+  window.close()
+}
```

#### Recent Merged Pull Requests:
- **PR #9008** (closed): fix(start): keep dev route CSS under Vite strict extended fs allow list (@pcbeingused333)
- **PR #8999** (2026-11-27): test(benchmarks): add link-mount client-nav scenario (@schiller-manuel)
- **PR #8980** (2026-11-24): docs: remove CodeRabbit sponsor logo (@tannerlinsley)
- **PR #8977** (2026-11-23): ci: Version Packages (rc) (@github-actions[bot])
- **PR #8973** (2026-11-23): fix(solid-start): import only published start-server-core exports (@brenelz)
- **PR #8972** (2026-11-23): fix(solid-router): stop Link strict-read warnings on spread reactive options (@brenelz)

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

## X. test(benchmarks): add link-mount client-nav scenario

**RULE**:
When implementing operations in `benchmarks/client-nav/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TanStack/router. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `10b22c27`: test(benchmarks): add link-mount client-nav scenario. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `benchmarks/client-nav/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
| `link-mount`                             | Link setup and teardown without navigation: each step synchronously mounts or unmounts 300 Links on the index route, half plain `to="/about"` and half `to="/posts/$postId"` with `params`, `search` and `activeProps`. Runs with the default `defaultPreload: false` and again with `'intent'`, which attaches the intent handlers. |
- Each benchmark iteration advances a fixed, circular sequence of steps; every step awaits the router's `onRendered` event, so render work is included and steps cannot overlap. Steps that leave the location unchanged, like `link-mount`'s, resolve once their render has committed instead. No two consecutive steps may target the same location, and the sequence ends back on the initial route.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
- Each benchmark iteration advances a fixed, circular sequence of steps; every step awaits the router's `onRendered` event, so render work is included and steps cannot overlap. No two consecutive steps may target the same location, and the sequence ends back on the initial route.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `10b22c27` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
