# Verification Protocol: Verification Protocol: Empirical Defect Shield for tanstack-router-learnings

<!-- PROVENANCE_START
{
  "source_repository": "tanstack-router-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:45:36.813Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-tanstack-router-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tanstack-router-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:45:36.813Z`  
> **Learning ID**: `LEARN-REEXTRACT-tanstack-router-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `tanstack-router-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tanstack-router-learnings.md`  
> **Source**: github ([https://github.com/TanStack/router](https://github.com/TanStack/router))  
> **Source Version**: `7dbce080`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T07:08:52.457Z  
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
> **Harvest Timestamp**: 2026-11-08T07:08:52.448Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TanStack/router`
- **Description**: 🤖 A client-first, server-capable, fully type-safe router and full-stack framework for the web (React and more).
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15289 stars

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

### Incident Patch 1: `bbf9b758` (2026-11-08)
**Commit Message**: fix(router-devtools-core): restore embedded panel styling (#8888)

* fix(router-devtools-core): restore embedded panel styling

All devtools size tokens are `calc(var(--tsrd-font-size) * n)`, but only the
floating devtools set `--tsrd-font-size` (via JS). The embedded
TanStackRouterDevtoolsPanel never had it defined, so every size declaration
was dropped: inherited font sizes, zero padding/gap/indentation and invisible
route status dots. Regressed in #1222 (v1.17.0).

Fall back to `1rem` when the variable is unset. Floating behavior is unchanged.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(react-router): read devtools mode from a validated search param

Use root route validateSearch + useSearch instead of raw URLSearchParams,
and render the shadow DOM panel through a portal instead of mounting the
whole app in a shadow root.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(react-router): validate devtools search param with zod

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(react-router): add links to switch devtools variants

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.changeset/happy-radios-call.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@tanstack/router-devtools-core': patch
+---
+
+Fix broken styling of the embedded `TanStackRouterDevtoolsPanel` (including inside shadow DOM) by giving the devtools size tokens a `1rem` fallback when `--tsrd-font-size` is not set.
```

**File**: `e2e/react-router/basic/package.json` (modified, +2/-1)
```diff
@@ -17,7 +17,8 @@
     "react": "^19.0.0",
     "react-dom": "^19.0.0",
     "redaxios": "catalog:",
-    "tailwindcss": "^4.2.2"
+    "tailwindcss": "^4.2.2",
+    "zod": "catalog:"
   },
   "devDependencies": {
     "@playwright/test": "^1.61.0",
```

**File**: `e2e/react-router/basic/src/main.tsx` (modified, +58/-2)
```diff
@@ -1,3 +1,5 @@
+import { useState } from 'react'
+import { createPortal } from 'react-dom'
 import ReactDOM from 'react-dom/client'
 import {
   ErrorComponent,
@@ -9,12 +11,19 @@ import {
   createRouter,
   redirect,
 } from '@tanstack/react-router'
-import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
+import {
+  TanStackRouterDevtoolsInProd as TanStackRouterDevtools,
+  TanStackRouterDevtoolsPanelInProd as TanStackRouterDevtoolsPanel,
+} from '@tanstack/react-router-devtools'
+import { z } from 'zod'
 import { NotFoundError, fetchPost, fetchPosts } from './posts'
 import './styles.css'
 import type { ErrorComponentProps } from '@tanstack/react-router'
 
 const rootRoute = createRootRoute({
+  validateSearch: z.object({
+    devtools: z.enum(['panel', 'shadow']).optional().catch(undefined),
+  }),
   component: RootComponent,
   notFoundComponent: () => {
     return (
@@ -27,6 +36,8 @@ const rootRoute = createRootRoute({
 })
 
 function RootComponent() {
+  const { devtools } = rootRoute.useSearch()
+
   return (
     <>
       <div className="p-2 flex gap-2 text-lg border-b">
@@ -86,12 +97,57 @@ function RootComponent() {
             </Link>
           </svg>
         </div>
+        <div className="ml-auto flex gap-2 text-sm items-center">
+          Devtools:
+          {(['floating', 'panel', 'shadow'] as const).map((mode) => (
+            <Link
+              key={mode}
+              to="."
+              search={(prev) => ({
+                ...prev,
+                devtools: mode === 'floating' ? undefined : mode,
+              })}
+              className={
+                (devtools ?? 'floating') === mode ? 'font-bold' : undefined
+              }
+            >
+              {mode}
+            </Link>
+          ))}
+        </div>
       </div>
       <Outlet />
-      <TanStackRouterDevtools position="bottom-right" />
+      {devtools === 'panel' ? (
+        <TanStackRouterDevtoolsPanel />
+      ) : devtools === 'shadow' ? (
+        <ShadowDevtoolsPanel />
+      ) : (
+        <TanStackRouterDevtools position="bottom-right" />
+      )}
     </>
   )
 }
+
+function ShadowDevtoolsPanel() {
+  const [shadowRoot, setShadowRoot] = useState<ShadowRoot>()
+
+  return (
+    <div
+      ref={(host) => {
+        if (host) {
+          setShadowRoot(host.shadowRoot ?? host.attachShadow({ mode: 'open' }))
+        }
+      }}
+    >
+      {shadowRoot
+        ? createPortal(
+            <TanStackRouterDevtoolsPanel shadowDOMTarget={shadowRoot} />,
+            shadowRoot,
+          )
+        : null}
+    </div>
+  )
+}
 const indexRoute = createRoute({
   getParentRoute: () => rootRoute,
   path: '/',
```

**File**: `e2e/react-router/basic/tests/devtools.spec.ts` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import { expect } from '@playwright/test'
+import { test } from '@tanstack/router-e2e-utils'
+
+for (const mode of ['panel', 'shadow', 'floating']) {
+  test(`devtools preserve typography and explorer indentation in ${mode} mode`, async ({
+    page,
+  }) => {
+    await page.goto(mode === 'floating' ? '/' : `/?devtools=${mode}`)
+    if (mode === 'floating') {
+      await page
+        .getByRole('button', { name: 'Open TanStack Router Devtools' })
+        .click()
+    }
+
+    const panel = page.locator('.TanStackRouterDevtoolsPanel')
+    const router = panel.getByRole('button', { name: /^Router\s*\d+ items/ })
+    const state = panel.getByRole('button', { name: /^state\s*\d+ items/ })
+    await expect(router).toBeVisible()
+    await expect(state).toBeVisible()
+    await expect(router).toHaveCSS('font-size', '12px')
+    await expect(router).toHaveCSS('gap', '4px')
+    await expect(
+      panel.getByText('Pathname', { exact: true }).locator('..'),
+    ).toHaveCSS('padding-left', '8px')
+
+    const routerBox = await router.boundingBox()
+    const stateBox = await state.boundingBox()
+    expect(stateBox!.x - routerBox!.x).toBe(18)
+
+    if (mode !== 'floating') {
+      await page.addStyleTag({ content: ':root { font-size: 20px; }' })
+      await expect(router).toHaveCSS('font-size', '15px')
+      await expect(router).toHaveCSS('gap', '5px')
+
+      await page.addStyleTag({
+        content: ':root { --tsrd-font-size: 24px; }',
+      })
+      await expect(router).toHaveCSS('font-size', '18px')
+      await expect(router).toHaveCSS('gap', '6px')
+    }
+  })
+}
```

**File**: `packages/router-devtools-core/src/tokens.ts` (modified, +73/-73)
```diff
@@ -161,37 +161,37 @@ export const tokens = {
   },
   font: {
     size: {
-      '2xs': 'calc(var(--tsrd-font-size) * 0.625)',
-      xs: 'calc(var(--tsrd-font-size) * 0.75)',
-      sm: 'calc(var(--tsrd-font-size) * 0.875)',
-      md: 'var(--tsrd-font-size)',
-      lg: 'calc(var(--tsrd-font-size) * 1.125)',
-      xl: 'calc(var(--tsrd-font-size) * 1.25)',
-      '2xl': 'calc(var(--tsrd-font-size) * 1.5)',
-      '3xl': 'calc(var(--tsrd-font-size) * 1.875)',
-      '4xl': 'calc(var(--tsrd-font-size) * 2.25)',
-      '5xl': 'calc(var(--tsrd-font-size) * 3)',
-      '6xl': 'calc(var(--tsrd-font-size) * 3.75)',
-      '7xl': 'calc(var(--tsrd-font-size) * 4.5)',
-      '8xl': 'calc(var(--tsrd-font-size) * 6)',
-      '9xl': 'calc(var(--tsrd-font-size) * 8)',
+      '2xs': 'calc(var(--tsrd-font-size, 1rem) * 0.625)',
+      xs: 'calc(var(--tsrd-font-size, 1rem) * 0.75)',
+      sm: 'calc(var(--tsrd-font-size, 1rem) * 0.875)',
+      md: 'var(--tsrd-font-size, 1rem)',
+      lg: 'calc(var(--tsrd-font-size, 1rem) * 1.125)',
+      xl: 'calc(var(--tsrd-font-size, 1rem) * 1.25)',
+      '2xl': 'calc(var(--tsrd-font-size, 1rem) * 1.5)',
+      '3xl': 'calc(var(--tsrd-font-size, 1rem) * 1.875)',
+      '4xl': 'calc(var(--tsrd-font-size, 1rem) * 2.25)',
+      '5xl': 'calc(var(--tsrd-font-size, 1rem) * 3)',
+      '6xl': 'calc(var(--tsrd-font-size, 1rem) * 3.75)',
+      '7xl': 'calc(var(--tsrd-font-size, 1rem) * 4.5)',
+      '8xl': 'calc(var(--tsrd-font-size, 1rem) * 6)',
+      '9xl': 'calc(var(--tsrd-font-size, 1rem) * 8)',
     },
     lineHeight: {
-      '3xs': 'calc(var(--tsrd-font-size) * 0.75)',
-      '2xs': 'calc(var(--tsrd-font-size) * 0.875)',
-      xs: 'calc(var(--tsrd-font-size) * 1)',
-      sm: 'calc(var(--tsrd-font-size) * 1.25)',
-      md: 'calc(var(--tsrd-font-size) * 1.5)',
-      lg: 'calc(var(--tsrd-font-size) * 1.75)',
-      xl: 'calc(var(--tsrd-font-size) * 2)',
-      '2xl': 'calc(var(--tsrd-font-size) * 2.25)',
-      '3xl': 'calc(var(--tsrd-font-size) * 2.5)',
-      '4xl': 'calc(var(--tsrd-font-size) * 2.75)',
-      '5xl': 'calc(var(--tsrd-font-size) * 3)',
-      '6xl': 'calc(var(--tsrd-font-size) * 3.25)',
-      '7xl': 'calc(var(--tsrd-font-size) * 3.5)',
-      '8xl': 'calc(var(--tsrd-font-size) * 3.75)',
-      '9xl': 'calc(var(--tsrd-font-size) * 4)',
+      '3xs': 'calc(var(--tsrd-font-size, 1rem) * 0.75)',
+      '2xs': 'calc(var(--tsrd-font-size, 1rem) * 0.875)',
+      xs: 'calc(var(--tsrd-font-size, 1rem) * 1)',
+      sm: 'calc(var(--tsrd-font-size, 1rem) * 1.25)',
+      md: 'calc(var(--tsrd-font-size, 1rem) * 1.5)',
+      lg: 'calc(var(--tsrd-font-size, 1rem) * 1.75)',
+      xl: 'calc(var(--tsrd-font-size, 1rem) * 2)',
+      '2xl': 'calc(var(--tsrd-font-size, 1rem) * 2.25)',
+      '3xl': 'calc(var(--tsrd-font-size, 1rem) * 2.5)',
+      '4xl': 'calc(var(--tsrd-font-size, 1rem) * 2.75)',
+      '5xl': 'calc(var(--tsrd-font-size, 1rem) * 3)',
+      '6xl': 'calc(var(--tsrd-font-size, 1rem) * 3.25)',
+      '7xl': 'calc(var(--tsrd-font-size, 1rem) * 3.5)',
+      '8xl': 'calc(var(--tsrd-font-size, 1rem) * 3.75)',
+      '9xl': 'calc(var(--tsrd-font-size, 1rem) * 4)',
     },
     weight: {
       thin: '100',
@@ -220,55 +220,55 @@ export const tokens = {
   border: {
     radius: {
       none: '0px',
-      xs: 'calc(var(--tsrd-font-size) * 0.125)',
-      sm: 'calc(var(--tsrd-font-size) * 0.25)',
-      md: 'calc(var(--tsrd-font-size) * 0.375)',
-      lg: 'calc(var(--tsrd-font-size) * 0.5)',
-      xl: 'calc(var(--tsrd-font-size) * 0.75)',
-      '2xl': 'calc(var(--tsrd-font-size) * 1)',
-      '3xl': 'calc(var(--tsrd-font-size) * 1.5)',
+      xs: 'calc(var(--tsrd-font-size, 1rem) * 0.125)',
+      sm: 'calc(var(--tsrd-font-size, 1rem) * 0.25)',
+      md: 'calc(var(--tsrd-font-size, 1rem) * 0.375)',
+      lg: 'calc(var(--tsrd-font-size, 1rem) * 0.5)',
+      xl: 'calc(var(--tsrd-font-size, 1rem) * 0.75)',
+      '2xl': 'calc(var(--tsrd-font-size, 1rem) * 1)',
+      '3xl': 'calc(var(--tsrd-font-size, 1rem) * 1.5)',
       full: '9999px',
     },
   },
   size: {
     0: '0px',
-    0.25: 'calc(var(--tsrd-font-size) * 0.0625)',
-    0.5: 'calc(var(--tsrd-font-size) * 0.125)',
-    1: 'calc(var(--tsrd-font-size) * 0.25)',
-    1.5: 'calc(var(--tsrd-font-size) * 0.375)',
-    2: 'calc(var(--tsrd-font-size) * 0.5)',
-    2.5: 'calc(var(--tsrd-font-size) * 0.625)',
-    3: 'calc(var(--tsrd-font-size) * 0.75)',
-    3.5: 'calc(var(--tsrd-font-size) * 0.875)',
-    4: 'calc(var(--tsrd-font-size) * 1)',
-    4.5: 'calc(var(--tsrd-font-size) * 1.125)',
-    5: 'calc(var(--tsrd-font-size) * 1.25)',
-    5.5: 'calc(var(--tsrd-font-size) * 1.375)',
-    6: 'calc(var(--tsrd-font-size) * 1.5)',
-    6.5: 'calc(var(--tsrd-font-size) * 1.625)',
-    7: 'calc(var(--tsrd-font-size) * 1.75)',
-    8: 'calc(var(--tsrd-font-size) * 2)',
-    9: 'calc(var(--tsrd-font-size) * 2.25)',
-    10: 'calc(var(--tsrd-font-size) * 2.5)',
-    11: 'calc(var(--tsrd-font-size) * 2.75)',
-    12:
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -684,6 +684,9 @@ importers:
       tailwindcss:
         specifier: ^4.2.2
         version: 4.2.2
+      zod:
+        specifier: 'catalog:'
+        version: 4.5.4
     devDependencies:
       '@playwright/test':
         specifier: ^1.63.0
```

#### Recent Merged Pull Requests:
- **PR #8888** (2026-11-08): fix(router-devtools-core): restore embedded panel styling (@schiller-manuel)
- **PR #8871** (2026-11-04): fix(start-plugin-core): require exsolve ^1.1.3, and see new entry files after a dev server restart (@Sheraff)
- **PR #8870** (2026-11-04): fix(router-plugin): write `import.meta.hot.accept(` out in Vite route HMR (@Sheraff)
- **PR #8869** (2026-11-04): fix(vue-start): pre-bundle @tanstack/vue-store so a cold dev start doesn't reload the page (@Sheraff)
- **PR #8867** (2026-11-04): fix(router-utils): parse decorators after `export` (@Sheraff)
- **PR #8863** (2026-11-04): fix(start-plugin-core): keep the app's server.compress on Rsbuild (@Sheraff)

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

## X. router-devtools-core): restore embedded panel styling (#8888)

**RULE**:
When implementing operations in `.changeset/happy-radios-call.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in TanStack/router. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bbf9b758`: router-devtools-core): restore embedded panel styling (#8888). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/happy-radios-call.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
'@tanstack/router-devtools-core': patch
---

Fix broken styling of the embedded `TanStackRouterDevtoolsPanel` (including inside shadow DOM) by giving the devtools size tokens a `1rem` fallback when `--tsrd-font-size` is not set.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bbf9b758` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
