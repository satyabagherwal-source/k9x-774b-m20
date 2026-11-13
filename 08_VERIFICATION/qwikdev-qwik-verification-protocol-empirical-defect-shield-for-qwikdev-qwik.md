# Verification Protocol: Verification Protocol: Empirical Defect Shield for qwikdev/qwik

<!-- PROVENANCE_START
{
  "source_repository": "qwikdev/qwik",
  "source_url": "https://github.com/qwikdev/qwik",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [qwikdev/qwik](https://github.com/qwikdev/qwik) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `qwikdev/qwik` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/qwikdev-qwik-learnings.md`  
> **Source**: github ([https://github.com/QwikDev/qwik](https://github.com/QwikDev/qwik))  
> **Source Version**: `22e24311`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T14:31:41.013Z  
> **Learning ID**: `learn-github-qwikdev-qwik`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): QwikDev/qwik

> **Canonical Artifact**: `07_PROJECT_LEARNING/qwikdev-qwik-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/QwikDev/qwik](https://github.com/QwikDev/qwik))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-12T14:31:40.740Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `QwikDev/qwik`
- **Description**: Instant-loading web apps, without effort
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 22071 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/adapters-e2e/src/routes/service-worker.ts`
```
import { greeting } from '~/greeting';

export declare const self: ServiceWorkerGlobalScope;

self.addEventListener('message', (event) => {
  event.ports[0].postMessage(greeting());
});

```

### Core Architecture Module: `e2e/adapters-e2e/src/routes/worker/index.tsx`
```
import { component$, useSignal, useTask$ } from '@qwik.dev/core';
import { type DocumentHead } from '@qwik.dev/router';
import { worker$ } from '@qwik.dev/core/worker';

const serverWorker = worker$(() => {
  return 'hello from worker';
});

export default component$(() => {
  const result = useSignal('pending');

  useTask$(async () => {
    result.value = await serverWorker();
  });

  return (
    <>
      <h1>Worker page</h1>
      <div id="worker-server-result">{result.value}</div>
    </>
  );
});

export const head: DocumentHead = {
  title: 'Worker page',
};

```

### Core Architecture Module: `e2e/preloader-e2e/utils/app.ts`
```
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../qwik-e2e/apps/preloader-test'
);
export const PORT = 4318;
export const ORIGIN = `https://localhost:${PORT}`;

type Manifest = {
  core?: string;
  preloader?: string;
  bundleGraphAsset?: string;
  bundles: Record<string, { origins?: string[]; symbols?: string[] }>;
  symbols: Record<string, { ctxName?: string }>;
};

let manifest: Manifest | undefined;

export const getManifest = (): Manifest =>
  (manifest ||= JSON.parse(readFileSync(join(APP_DIR, 'dist/q-manifest.json'), 'utf8')));

let bundleGraph: Map<string, string[]> | undefined;

const getBundleGraph = () => {
  if (!bundleGraph) {
    const path = join(APP_DIR, 'dist', getManifest().bundleGraphAsset!);
    const flat: (string | number)[] = JSON.parse(readFileSync(path, 'utf8'));
    bundleGraph = new Map();
    let deps: string[] = [];
    for (const item of flat) {
      if (typeof item === 'string') {
        deps = [];
        bundleGraph.set(item, deps);
      } else if (item >= 0) {
        // Negative numbers are probability markers, not dependencies.
        deps.push(flat[item] as string);
      }
    }
  }
  return bundleGraph;
};

/** What the preloader marks needed with `bundle`: everything it reaches in the bundle graph. */
export const neededWith = (bundle: string) => {
  const graph = getBundleGraph();
  const needed = new Set<string>();
  const pending = [bundle];
  while (pending.length) {
    for (const dep of graph.get(pending.pop()!) ?? []) {
      if (!needed.has(dep)) {
        needed.add(dep);
        pending.push(dep);
      }
    }
  }
  return needed;
};

const SYMBOL_HASH = /_[A-Za-z0-9]{11}\.js$/;

const labelOrigin = (origin: string) =>
  origin
    .replace(/^src\/components\/fixtures\//, '')
    .replace(/^src\//, '')
    .replace(SYMBOL_HASH, '');

export const bundleFile = (url: string) => new URL(url).pathname.replace(/^\/build\//, '');

export const labelRequest = (url: string) => {
  const { pathname, search } = new URL(url);
  if (pathname.endsWith('-bundle-graph.json')) {
    return 'bundle-graph.json';
  }
  if (!pathname.startsWith('/build/')) {
    return `${pathname}${search}`;
  }
  const file = bundleFile(url);
  const origins = getManifest().bundles[file]?.origins;
  if (!origins?.length || !origins.every((origin) => origin.startsWith('src/'))) {
    return file;
  }
  return [...new Set(origins.map(labelOrigin))].sort().join(' + ');
};

export const chunkComesFrom = (url: string, paths: string[]) => {
  const origins = getManifest().bundles[bundleFile(url)]?.origins ?? [];
  return origins.some((origin) => paths.some((path) => origin.startsWith(path)));
};

export const chunkHoldsSegmentsFrom = (url: string, paths: string[]) =>
  chunkComesFrom(url, paths) && !!getManifest().bundles[bundleFile(url)]?.symbols?.length;

const chunkHasSymbolOf = (url: string, ctxName: string) => {
  const manifest = getManifest();
  return (manifest.bundles[bundleFile(url)]?.symbols ?? []).some(
    (symbol) => manifest.symbols[symbol]?.ctxName === ctxName
  );
};

export const chunkHasScopedStyles = (url: string) => chunkHasSymbolOf(url, 'useStylesScoped$');

export const chunkUrlsFrom = (path: string) =>
  Object.entries(getManifest().bundles)
    .filter(([, bundle]) => bundle.origins?.some((origin) => origin.startsWith(path)))
    .map(([file]) => `${ORIGIN}/build/${file}`);

```

### Core Architecture Module: `e2e/preloader-e2e/utils/fixtures.ts`
```
export const PRIMITIVE_STEPS = {
  'jsx-binding': 0,
  render: 1,
  'store-chain': 3,
  'task-chain': 3,
  'computed-chain': 3,
  'async-computed-chain': 3,
  'mixed-computed-chain': 3,
  'visible-task-chain': 3,
  all: 12,
};

export const SETUP_LEVELS = { single: 1, tree: 3, 'tree-context': 3, conditional: 3 };

export type Fixture = {
  id: string;
  path: string;
  sources: string[];
  expected?: string;
  warmRoundTrips?: number;
};

export const MATRIX: Fixture[] = Object.entries(SETUP_LEVELS).flatMap(([setup, levels]) =>
  Object.entries(PRIMITIVE_STEPS).map(([primitive, steps]) => ({
    id: `${setup}/${primitive}`,
    path: `/${setup}/${primitive}/`,
    sources: [
      `src/components/fixtures/${setup}/${primitive}/`,
      `src/routes/${setup}/${primitive}/`,
    ],
    expected: String(1 + levels * steps),
  }))
);

export const MODAL: Fixture = {
  id: 'modal',
  path: '/modal/',
  sources: ['src/components/fixtures/modal/', 'src/routes/modal/'],
  expected: '3',
};

export const USER_IMPORT: Fixture = {
  id: 'user-import',
  path: '/user-import/',
  sources: ['src/components/fixtures/user-import/', 'src/routes/user-import/', 'src/vendor-lib/'],
  warmRoundTrips: 1,
};

export const SHARED_HELPER: Fixture = {
  id: 'shared-helper',
  path: '/shared-helper/',
  sources: ['src/components/fixtures/shared-helper/', 'src/routes/shared-helper/'],
  expected: '1 clicks',
};

const handWritten = (name: string, expected: string): Fixture => ({
  id: name,
  path: `/${name}/`,
  sources: [`src/components/fixtures/${name}/`, `src/routes/${name}/`],
  expected,
});

export const SLOT = handWritten('slot', '1');
export const SCOPED_STYLES = handWritten('scoped-styles', 'styled');
export const QRL_PROP = handWritten('qrl-prop', '42');
export const SYNC = handWritten('sync', 'done');
export const BARREL = handWritten('barrel', 'alpha 1.0');

export const IMPORT_CHAIN: Fixture = {
  id: 'harness/import-chain',
  path: '/harness/import-chain/',
  sources: ['src/components/fixtures/harness/', 'src/routes/harness/'],
  expected: 'done',
};

export const VISIBLE_ABOVE: Fixture = {
  id: 'visible/above',
  path: '/visible/above/',
  sources: ['src/components/fixtures/visible/above.tsx', 'src/routes/visible/above/'],
  expected: '4',
};

export const VISIBLE_BELOW: Fixture = {
  id: 'visible/below',
  path: '/visible/below/',
  sources: ['src/components/fixtures/visible/below.tsx', 'src/routes/visible/below/'],
  expected: '4',
};

const visibleStrategy = (strategy: string): Fixture => ({
  id: `visible/${strategy}`,
  path: `/visible/${strategy}/`,
  sources: [`src/components/fixtures/visible/${strategy}.tsx`, `src/routes/visible/${strategy}/`],
  expected: '4',
});

export const VISIBLE_DOCUMENT_READY = visibleStrategy('document-ready');
export const VISIBLE_DOCUMENT_IDLE = visibleStrategy('document-idle');

export const fixtureById = (id: string) => {
  const fixture = MATRIX.find((candidate) => candidate.id === id);
  if (!fixture) {
    throw new Error(`No fixture has the id ${id}`);
  }
  return fixture;
};

export const CLICKABLE_ON_ALL_AT_ONCE: Fixture[] = [...MATRIX, USER_IMPORT, MODAL].map(
  (fixture) => ({ ...fixture, path: '/all-at-once/' })
);

const NEVER_UPDATES =
  'never shows its result on main: a sync computed reading an async computed prop stays at 0';
const OFF_SCREEN_VISIBLE_TASKS =
  'needs a round trip on main: off-screen visible task chunks are never preloaded, so the scroll to the first visible-task-chain fixture fetches them all';
const JSX_ONLY =
  'one round trip on main: the signal is only read in JSX, so the click only needs its handler';
const COMPUTEDS_WITH_HANDLER =
  'one round trip on main: the computed chunks go out with the click handler';
const VISIBLE_TASKS_LOADED =
  'one round trip on main: the visible task chunks loaded with the page, so the click only needs its handler';
const MIDDLE_LINK_LATE =
  'over the 2-round-trip cap on main: the middle link of an async computed chain loads a round trip late';

export const NEVER_SHOWS_RESULT: Record<string, string> = {
  'tree/mixed-computed-chain': NEVER_UPDATES,
  'tree-context/mixed-computed-chain': NEVER_UPDATES,
};

export type RoundTripsOnMain = { roundTrips: number; reason: string };

export const NOT_READY_WHEN_WARM: Record<string, RoundTripsOnMain> = {
  'single/visible-task-chain': { roundTrips: 1, reason: OFF_SCREEN_VISIBLE_TASKS },
};

export const ROUND_TRIPS_ON_MAIN: Record<string, RoundTripsOnMain> = {
  'single/jsx-binding': { roundTrips: 1, reason: JSX_ONLY },
  'tree/jsx-binding': { roundTrips: 1, reason: JSX_ONLY },
  'tree-context/jsx-binding': { roundTrips: 1, reason: JSX_ONLY },
  'single/computed-chain': { roundTrips: 1, reason: COMPUTEDS_WITH_HANDLER },
  'tree/computed-chain': { roundTrips: 1, reason: COMPUTEDS_WITH_HANDLER },
  'tree-context/computed-chain': { roundTrips: 1, reason: COMPUTEDS_WITH_HANDLER },
  'single/visible-task-chain': { roundTrips: 1, reason: VISIBLE_TASKS_LOADED },
  'tree/visible-task-chain': { roundTrips: 1, reason: VISIBLE_TASKS_LOADED },
  'tree-context/visible-task-chain': { roundTrips: 1, reason: VISIBLE_TASKS_LOADED },
  'single/async-computed-chain': { roundTrips: 3, reason: MIDDLE_LINK_LATE },
  'single/mixed-computed-chain': { roundTrips: 3, reason: MIDDLE_LINK_LATE },
  'tree/async-computed-chain': { roundTrips: 6, reason: MIDDLE_LINK_LATE },
  'tree-context/async-computed-chain': { roundTrips: 6, reason: MIDDLE_LINK_LATE },
};

export const NAVIGATION_SOURCES = ['src/components/fixtures/navigation/', 'src/routes/navigation/'];

```

### Core Architecture Module: `e2e/preloader-e2e/utils/gate.ts`
```
import type { Locator, Page, Request, Route } from '@playwright/test';
import { bundleFile, chunkHoldsSegmentsFrom, labelRequest, neededWith, ORIGIN } from './app';

export const FILLER = 'src/components/filler/';

const QUIET_MS = 250;
const MAX_ROUND_TRIPS = 20;
const DOWNLOAD_LIMIT_MS = 30_000;
const NETWORK_IDLE_LIMIT_MS = 60_000;

export type Gate = {
  page: Page;
  mode: 'pass' | 'hold';
  held: Route[];
  holdWhilePassing?: (url: string) => boolean;
};

export type RoundTrip = {
  urls: string[];
};

export type PreloaderLink = { href: string; speculative: boolean };

type PreloaderWindow = Window & {
  __preloaderLinks?: PreloaderLink[];
  __speculativeInFlight?: number;
  __maxSpeculativeInFlight?: number;
  __holdsSpeculativePreloads?: boolean;
  __heldSpeculativePreloads?: number;
  __resumeSpeculativePreloads?: () => void;
  __sendHeldSpeculativePreloads?: (hrefs: string[]) => void;
};

export const recordSpeculativePreloads = (page: Page) =>
  page.addInitScript(() => {
    const win = window as PreloaderWindow;
    win.__preloaderLinks = [];
    win.__speculativeInFlight = 0;
    win.__maxSpeculativeInFlight = 0;
    const heldLinks: [Node, HTMLLinkElement][] = [];
    const appendChild = Node.prototype.appendChild;
    win.__sendHeldSpeculativePreloads = (hrefs) => {
      for (let i = heldLinks.length - 1; i >= 0; i--) {
        const [parent, link] = heldLinks[i];
        if (hrefs.includes(link.href)) {
          heldLinks.splice(i, 1);
          appendChild.call(parent, link);
        }
      }
    };
    win.__resumeSpeculativePreloads = () => {
      win.__holdsSpeculativePreloads = false;
      for (const [parent, link] of heldLinks.splice(0)) {
        appendChild.call(parent, link);
      }
    };
    Node.prototype.appendChild = function <T extends Node>(this: Node, node: T): T {
      if (node instanceof HTMLLinkElement && /preload/i.test(node.rel)) {
        const speculative = node.getAttribute('fetchpriority') === 'low';
        win.__preloaderLinks!.push({ href: node.href, speculative });
        if (speculative) {
          win.__speculativeInFlight!++;
          win.__maxSpeculativeInFlight = Math.max(
            win.__maxSpeculativeInFlight!,
            win.__speculativeInFlight!
          );
          const settled = () => win.__speculativeInFlight!--;
          node.addEventListener('load', settled, { once: true });
          node.addEventListener('error', settled, { once: true });
          if (win.__holdsSpeculativePreloads) {
            heldLinks.push([this, node]);
            win.__heldSpeculativePreloads = heldLinks.length;
            return node;
          }
        }
      }
      return appendChild.call(this, node) as T;
    };
  });

export const holdSpeculativePreloads = (page: Page) =>
  page.addInitScript(() => {
    (window as PreloaderWindow).__holdsSpeculativePreloads = true;
  });

/**
 * The preloader counts a held speculative preload as in flight, so it never requests that chunk
 * again once it is needed. Send it when a request makes it needed, as the preloader would.
 */
const sendHeldPreloadsNeededWith = (page: Page, url: string) => {
  if (!url.startsWith(`${ORIGIN}/build/`)) {
    return;
  }
  const hrefs = [...neededWith(bundleFile(url))].map((bundle) => `${ORIGIN}/build/${bundle}`);
  page
    .evaluate((hrefs) => (window as PreloaderWindow).__sendHeldSpeculativePreloads?.(hrefs), hrefs)
    .catch(() => {});
};

const resumeSpeculativePreloads = (page: Page) =>
  page.evaluate(() => (window as PreloaderWindow).__resumeSpeculativePreloads?.());

export const maxSpeculativeInFlight = (page: Page) =>
  page.evaluate(() => (window as PreloaderWindow).__maxSpeculativeInFlight ?? 0);

export const preloaderLinks = (page: Page) =>
  page.evaluate(() => (window as PreloaderWindow).__preloaderLinks ?? []);

export const speculativePreloads = async (page: Page) =>
  new Set((await preloaderLinks(page)).filter((link) => link.speculative).map((link) => link.href));

export const createGate = async (page: Page): Promise<Gate> => {
  const gate: Gate = { page, mode: 'pass', held: [] };
  await page.route(`${ORIGIN}/**`, (route) => {
    const request = route.request();
    const holds =
      gate.mode === 'hold'
        ? !request.isNavigationRequest()
        : gate.holdWhilePassing?.(request.url());
    if (!holds) {
      return route.continue();
    }
    gate.held.push(route);
    if (gate.mode === 'hold') {
      sendHeldPreloadsNeededWith(page, request.url());
    }
  });
  return gate;
};

export const settle = async (page: Page, gate: Gate, quietMs = QUIET_MS) => {
  let lastCount = -1;
  let stableRounds = 0;
  while (stableRounds < 2) {
    await page.evaluate(
      () => new Promise((resolve) => requestIdleCallback(() => resolve(null), { timeout: 2000 }))
    );
    await page.waitForTimeout(quietMs);
    if (gate.held.length === lastCount) {
      stableRounds++;
    } else {
      stableRounds = 0;
      lastCount = gate.held.length;
    }
  }
};

const failAfter = (ms: number, message: string) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failure = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return { failure, cancel: () => clearTimeout(timer) };
};

const releaseUntilDownloaded = async (route: Route) => {
  await route.continue().catch(() => {});
  const url = route.request().url();
  const deadline = failAfter(DOWNLOAD_LIMIT_MS, `${url} did not finish downloading`);
  try {
    await Promise.race([
      route
        .request()
        .response()
        .then((response) => response?.finished())
        .catch(() => {}),
      deadline.failure,
    ]);
  } finally {
    deadline.cancel();
  }
};

export const release = async (routes: Route[]) => {
  await Promise.all(routes.map(releaseUntilDownloaded));
};

export const waitForNetworkIdle = async (
  page: Page,
  action: () => Promise<unknown>,
  quietMs = 1000
) => {
  const pending = new Set<Request>();
  let lastActivity = Date.now();
  const onRequest = (request: Request) => {
    pending.add(request);
    lastActivity = Date.now();
  };
  const onDone = (request: Request) => {
    pending.delete(request);
    lastActivity = Date.now();
  };
  page.on('request', onRequest);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);
  try {
    await action();
    const startedAt = Date.now();
    while (pending.size || Date.now() - lastActivity < quietMs) {
      if (Date.now() - startedAt > NETWORK_IDLE_LIMIT_MS) {
        const urls = [...pending].map((request) => request.url());
        throw new Error(`The network never went idle; still pending: ${urls.join(', ')}`);
      }
      await page.waitForTimeout(100);
    }
  } finally {
    page.off('request', onRequest);
    page.off('requestfinished', onDone);
    page.off('requestfailed', onDone);
  }
};

export const releaseAll = async (gate: Gate, heldBack: Route[] = []) => {
  gate.mode = 'pass';
  await resumeSpeculativePreloads(gate.page);
  await release([...gate.held.splice(0), ...heldBack.splice(0)]);
};

export const waitForQwikloader = (page: Page) =>
  page.waitForFunction(() => (window as any)._qwikEv?.roots, null, { timeout: 15_000 });

const urlsOf = (routes: Route[]) => routes.map((route) => route.request().url());

export const openCold = async (page: Page, gate: Gate, path: string) => {
  await holdSpeculativePreloads(page);
  await waitForNetworkIdle(page, async () => {
    await page.goto(path);
    await waitForQwikloader(page);
    await page.waitForFunction(() => (window as PreloaderWindow).__heldSpeculativePreloads, null, {
      timeout: 15_000,
    });
  });
  gate.mode = 'hold';
};

export const openWarm = async (page: Page, gate: Gate, path: string) => {
  await waitForNetworkIdle(page, async () => {
    await page.goto(path);
    await waitForQwikloader(page);
    await page.waitForFunction(() => typeof (globalThis as any).qPreload === 'function', null, {
      timeout: 15_000,
    });
  });
  gate.mode = 'hold';
};

export const countRoundTrips = async (
  page: Page,
  gate: Gate,
  action: () => Promise<unknown>,
  isDone: () => Promise<boolean>,
  heldBack: Route[] = []
) => {
  gate.mode = 'hold';
  await action();
  const roundTrips: RoundTrip[] = [];
  for (;;) {
    await settle(page, gate);
    if (await isDone()) {
      return roundTrips;
    }
    const routes = gate.held.length ? gate.held.splice(0) : heldBack.splice(0);
    if (!routes.length) {
      throw new Error(`Not done and nothing requested after ${roundTrips.length} round trips`);
    }
    if (roundTrips.length === MAX_ROUND_TRIPS) {
      throw new Error(`More than ${MAX_ROUND_TRIPS} round trips`);
    }
    roundTrips.push({ urls: urlsOf(routes) });
    await release(routes);
  }
};

export const resultIsDone = (result: Locator) => () =>
  result.evaluateAll((elements) =>
    elements.some((element) => element.hasAttribute('data-done') && element.checkVisibility())
  );

export const formatRoundTrips = (
  roundTrips: RoundTrip[],
  { segmentsFrom }: { segmentsFrom?: string[] } = {}
) =>
  roundTrips
    .map(({ urls }, index) => ({
      number: index + 1,
      urls: segmentsFrom ? urls.filter((url) => chunkHoldsSegmentsFrom(url, segmentsFrom)) : urls,
    }))
    .filter(({ urls }) => urls.length)
    .map(({ number, urls }) => {
      const labels = [...new Set(urls.map(labelRequest))].sort();
      return [`round trip ${number}:`, ...labels.map((label) => `  ${label}`)].join('\n');
    })
    .join('\n') + '\n';

export const collectUntilQuiet = async (page: Page, gate: Gate, action: () => Promise<unknown>) => {
  gate.mode = 'hold';
  await action();
  const urls: string[] = [];
  for (;;) {
    await settle(page, gate);
    const routes = gate.held.splice(0);
    if (!routes.length) {
      return urls;
    }
    urls.push(...routes.map((route) => route.request().url()));
    await release(routes);
  }
};

export const sp
```

### Core Architecture Module: `e2e/preloader-e2e/utils/long-tasks.ts`
```
import type { Browser, Page } from '@playwright/test';

const LONG_TASK_MS = 50;
const MID_TIER_PHONE_INDEX = 400;
const SLOW_NETWORK = {
  offline: false,
  latency: 40,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};

// Adapted from Lighthouse's computeBenchmarkIndex (core/lib/page-functions.js, Apache-2.0).
const computeBenchmarkIndex = () => {
  const benchmarkIndexGC = () => {
    const start = Date.now();
    let iterations = 0;
    while (Date.now() - start < 500) {
      let s = '';
      for (let j = 0; j < 10000; j++) {
        s += 'a';
      }
      if (s.length === 1) {
        throw new Error('unreachable');
      }
      iterations++;
    }
    return Math.round(iterations / 10 / ((Date.now() - start) / 1000));
  };
  const benchmarkIndexNoGC = () => {
    const arrA: number[] = [];
    const arrB: number[] = [];
    for (let i = 0; i < 100000; i++) {
      arrA[i] = arrB[i] = i;
    }
    const start = Date.now();
    let iterations = 0;
    while (iterations % 10 !== 0 || Date.now() - start < 500) {
      const src = iterations % 2 === 0 ? arrA : arrB;
      const tgt = iterations % 2 === 0 ? arrB : arrA;
      for (let j = 0; j < src.length; j++) {
        tgt[j] = src[j];
      }
      iterations++;
    }
    return Math.round(iterations / 10 / ((Date.now() - start) / 1000));
  };
  return (benchmarkIndexGC() + benchmarkIndexNoGC()) / 2;
};

const measureCpuRate = async (page: Page) => {
  const indexes: number[] = [];
  for (let i = 0; i < 3; i++) {
    indexes.push(await page.evaluate(computeBenchmarkIndex));
  }
  const median = indexes.sort((a, b) => a - b)[1];
  return Math.max(1, median / MID_TIER_PHONE_INDEX);
};

export const throttleLikeAMidTierPhone = async (page: Page) => {
  const cdp = await page.context().newCDPSession(page);
  await page.goto('about:blank');
  const cpuRate = await measureCpuRate(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  return cpuRate;
};

export type TraceEvent = {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  tts?: number;
  tdur?: number;
  pid: number;
  tid: number;
  args?: {
    name?: string;
    fileName?: string;
    data?: { url?: string; fileName?: string; functionName?: string; lineNumber?: number };
  };
};

export type LongTask = {
  durationMs: number;
  preloaderMs: number;
  scripts: string[];
  longestEvents: { name: string; source: string; wallMs: number; cpuMs: number }[];
};

const SCRIPT_EVENTS = new Set([
  'FunctionCall',
  'EvaluateScript',
  'v8.compile',
  'v8.compileModule',
  'v8.evaluateModule',
]);

const GC_EVENTS = new Set(['MajorGC', 'MinorGC']);
const LONGEST_EVENTS_KEPT = 8;

const urlOf = (event: TraceEvent) =>
  event.args?.data?.url ?? event.args?.fileName ?? event.args?.data?.fileName ?? '';

const hasThreadTime = (event: TraceEvent) => event.tts !== undefined && event.tdur !== undefined;

const cpuDuration = (event: TraceEvent) => event.tdur ?? event.dur!;

const wallInterval = (event: TraceEvent): [number, number] => [event.ts, event.ts + event.dur!];

const cpuInterval = (event: TraceEvent): [number, number] => [event.tts!, event.tts! + event.tdur!];

const toMs = (microseconds: number) => Math.round(microseconds / 100) / 10;

const describeEvent = (event: TraceEvent) => {
  const { functionName = '', lineNumber } = event.args?.data ?? {};
  const file = urlOf(event).split('/').pop();
  const line = lineNumber === undefined ? '' : `:${lineNumber}`;
  return {
    name: event.name,
    source: `${functionName} ${file}${line}`.trim(),
    wallMs: toMs(event.dur!),
    cpuMs: toMs(cpuDuration(event)),
  };
};

const mergedDuration = (intervals: [number, number][]) => {
  let total = 0;
  let end = -Infinity;
  for (const [from, to] of intervals.sort((a, b) => a[0] - b[0])) {
    if (to > end) {
      total += to - Math.max(from, end);
      end = to;
    }
  }
  return total;
};

const findRendererMainThread = (events: TraceEvent[]) => {
  const candidates = events.filter(
    (event) => event.name === 'thread_name' && event.args?.name === 'CrRendererMain'
  );
  let best: TraceEvent | undefined;
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = events.filter(
      (event) =>
        event.pid === candidate.pid && event.tid === candidate.tid && event.name === 'RunTask'
    ).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
};

export const findLongTasks = (
  events: TraceEvent[],
  preloaderUrl: string,
  preloadedUrls: Set<string>
): LongTask[] => {
  const main = findRendererMainThread(events);
  if (!main) {
    throw new Error('The trace has no renderer main thread to measure');
  }
  const onMain = events.filter(
    (event) => event.pid === main.pid && event.tid === main.tid && event.ph === 'X' && event.dur
  );
  return onMain
    .filter((event) => event.name === 'RunTask' && cpuDuration(event) >= LONG_TASK_MS * 1000)
    .map((task) => {
      const inTheTask = onMain.filter(
        (event) =>
          event !== task && event.ts >= task.ts && event.ts + event.dur! <= task.ts + task.dur!
      );
      const scripts = inTheTask.filter((event) => SCRIPT_EVENTS.has(event.name));
      const isPreloaderWork = (event: TraceEvent) =>
        urlOf(event) === preloaderUrl ||
        (event.name.startsWith('v8.compile') && preloadedUrls.has(urlOf(event)));
      const preloaderEvents = scripts.filter(isPreloaderWork);
      const intervalOf = preloaderEvents.every(hasThreadTime) ? cpuInterval : wallInterval;
      return {
        durationMs: Math.round(cpuDuration(task) / 1000),
        preloaderMs: Math.round(mergedDuration(preloaderEvents.map(intervalOf)) / 1000),
        scripts: [
          ...new Set(scripts.map((event) => `${event.name} ${urlOf(event).split('/').pop()}`)),
        ],
        longestEvents: inTheTask
          .filter((event) => SCRIPT_EVENTS.has(event.name) || GC_EVENTS.has(event.name))
          .sort((a, b) => b.dur! - a.dur!)
          .slice(0, LONGEST_EVENTS_KEPT)
          .map(describeEvent),
      };
    });
};

export const longTasksFromThePreloader = (tasks: LongTask[]) =>
  tasks.filter(
    (task) =>
      task.preloaderMs >= LONG_TASK_MS ||
      (task.preloaderMs > 0 && task.durationMs - task.preloaderMs < LONG_TASK_MS)
  );

export const traceLongTasks = async (
  browser: Browser,
  page: Page,
  run: () => Promise<void>,
  preloaderUrl: () => string,
  preloadedUrls: () => Promise<Set<string>>
) => {
  await browser.startTracing(page, {
    categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'v8.execute'],
  });
  await run();
  const trace = JSON.parse((await browser.stopTracing()).toString());
  return findLongTasks(trace.traceEvents ?? trace, preloaderUrl(), await preloadedUrls());
};

```

### Core Architecture Module: `e2e/preloader-e2e/utils/scenarios.ts`
```
import { expect, type Page } from '@playwright/test';
import type { Fixture } from './fixtures';
import {
  countRoundTrips,
  createGate,
  openCold,
  openWarm,
  recordSpeculativePreloads,
  releaseAll,
  resultIsDone,
  type Gate,
} from './gate';

export type OpenFixture = {
  page: Page;
  fixture: Fixture;
  gate: Gate;
};

export const fixtureRoot = (page: Page, fixture: Fixture) =>
  page.locator(`[data-fixture="${fixture.id}"]`);

export const fixtureResult = (page: Page, fixture: Fixture) =>
  fixtureRoot(page, fixture).locator('[data-testid=result]');

export const expectResult = async (page: Page, fixture: Fixture) => {
  const result = fixtureResult(page, fixture).filter({ visible: true });
  await expect(result).toHaveAttribute('data-done');
  if (fixture.expected) {
    await expect(result).toHaveText(fixture.expected);
  }
};

export const openFixture = async (
  page: Page,
  fixture: Fixture,
  state: 'cold' | 'warm'
): Promise<OpenFixture> => {
  await recordSpeculativePreloads(page);
  const gate = await createGate(page);
  await (state === 'cold' ? openCold : openWarm)(page, gate, fixture.path);
  return { page, fixture, gate };
};

export const countFixtureRoundTrips = (
  { page, gate }: OpenFixture,
  action: () => Promise<unknown>,
  isDone: () => Promise<boolean>
) => countRoundTrips(page, gate, action, isDone);

export const clickTrigger = (opened: OpenFixture) =>
  countFixtureRoundTrips(
    opened,
    () => fixtureRoot(opened.page, opened.fixture).locator('[data-testid=trigger]').click(),
    resultIsDone(fixtureResult(opened.page, opened.fixture))
  );

const clickOnce = async (page: Page, fixture: Fixture, state: 'cold' | 'warm') => {
  const opened = await openFixture(page, fixture, state);
  const roundTrips = await clickTrigger(opened);
  await releaseAll(opened.gate);
  await expectResult(page, fixture);
  return roundTrips;
};

export const coldClick = (page: Page, fixture: Fixture) => clickOnce(page, fixture, 'cold');

export const warmClick = (page: Page, fixture: Fixture) => clickOnce(page, fixture, 'warm');

```

### Core Architecture Module: `e2e/qwik-cli-e2e/utils/index.ts`
```
import { ChildProcess, exec, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { yellow } from 'kleur/colors';
import { dirname, join, resolve } from 'path';
import { dirSync } from 'tmp';
import treeKill from 'tree-kill';
import { promisify } from 'util';
import { createDocument } from '../../../packages/qwik/src/testing/document';

export type QwikProjectType = 'playground' | 'library' | 'empty';
export function scaffoldQwikProject(type: QwikProjectType): {
  tmpDir: string;
  cleanupFn: () => void;
} {
  const tmpHostDirData = getTmpDirSync(
    process.env.TEMP_E2E_PATH ? `${process.env.TEMP_E2E_PATH}/${type}` : undefined
  );
  const cleanupFn = () => {
    if (!tmpHostDirData.overridden) {
      cleanup(tmpHostDirData.path);
    } else {
      log('Custom E2E test path was used, skipping the removal of test folder');
    }
  };
  try {
    const tmpDir = runCreateQwikCommand(tmpHostDirData.path, type);
    log(`Created test application at "${tmpDir}"`);
    replacePackagesWithLocalOnes(tmpDir);
    return { cleanupFn, tmpDir };
  } catch (error) {
    cleanupFn();
    throw error;
  }
}

function cleanup(tmpDir: string) {
  log(`Removing tmp dir "${tmpDir}"`);
  rmSync(tmpDir, { recursive: true });
}

function getTmpDirSync(tmpDirOverride?: string) {
  if (tmpDirOverride) {
    tmpDirOverride = resolve(workspaceRoot, tmpDirOverride);
  }

  if (tmpDirOverride && !existsSync(tmpDirOverride)) {
    throw new Error(`"${tmpDirOverride}" does not exist.`);
  }
  if (tmpDirOverride) {
    const p = join(tmpDirOverride, 'qwik_e2e');
    if (existsSync(p)) {
      log(`Removing project folder "${p}" (will be recreated).`);
      rmSync(p, { recursive: true });
    }
    mkdirSync(p);
    return { path: p, overridden: true };
  }
  return { path: dirSync({ prefix: 'qwik_e2e' }).name, overridden: false };
}

function runCreateQwikCommand(tmpDir: string, type: 'playground' | 'library' | 'empty'): string {
  const appDir = 'e2e-app';
  execSync(
    `node "${workspaceRoot}/packages/create-qwik/create-qwik.mjs" ${type} "${join(tmpDir, appDir)}"`
  );
  return join(tmpDir, appDir);
}

function replacePackagesWithLocalOnes(tmpDir: string) {
  const tarballConfig = JSON.parse(
    readFileSync(join(workspaceRoot, 'temp/tarballs/paths.json'), 'utf-8')
  );
  for (const { name, absolutePath } of tarballConfig) {
    patchPackageJsonForPlugin(tmpDir, name, absolutePath);
  }
  writeFileSync(
    join(tmpDir, 'pnpm-workspace.yaml'),
    "packages:\n  - .\nallowBuilds:\n  '@parcel/watcher': true\n  sharp: true\n"
  );
  execSync('pnpm i', {
    cwd: tmpDir,
    // only output errors
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

function patchPackageJsonForPlugin(tmpDirName: string, npmPackageName: string, distPath: string) {
  const path = join(tmpDirName, 'package.json');
  const json = JSON.parse(readFileSync(path, 'utf-8'));
  json.devDependencies[npmPackageName] = `file:${distPath}`;
  writeFileSync(path, JSON.stringify(json));
}

export function registerExecutedChildProcess(process: ChildProcess) {
  if (typeof global !== 'undefined') {
    (global.pIds ??= []).push(process.pid);
    log(`Registered a process with id "${process.pid}"`);
  } else {
    throw new Error('"global" is not defined');
  }
}

export function runCommandUntil(
  command: string,
  tmpDir: string,
  criteria: (output: string) => boolean,
  env?: Record<string, string>
): Promise<ChildProcess> {
  const p = exec(command, {
    cwd: tmpDir,
    encoding: 'utf-8',
    env: env && { ...process.env, ...env },
  });
  registerExecutedChildProcess(p);
  return new Promise<ChildProcess>((res, rej) => {
    let output = '';
    let complete = false;

    function checkCriteria(c: any) {
      output += c.toString();
      console.warn(output);
      if (criteria(stripConsoleColors(output)) && !complete) {
        complete = true;
        res(p);
      }
    }

    p.stdout?.on('data', checkCriteria);
    p.stderr?.on('data', checkCriteria);
    p.on('exit', (code) => {
      if (!complete) {
        rej(`Exited with ${code}`);
      } else {
        res(p);
      }
    });
  });
}

function stripConsoleColors(log: string): string {
  return log.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
}

export async function getPageHtml(pageUrl: string): Promise<Document> {
  const res = await fetch(pageUrl, { headers: { accept: 'text/html' } }).then((r) => r.text());
  return createDocument({ html: res });
}

export async function assertHostUnused(host: string): Promise<void> {
  try {
    const response = await fetch(host, { headers: { accept: 'text/html' } });
  } catch (error) {
    // TODO: test this in different environments
    if (error.cause.code === 'ECONNREFUSED') {
      return;
    }
  }
  throw new Error(`Host ${host} is already in use!`);
}

// promisify fails to get the proper type overload, so manually enforcing the type
const _promisifiedTreeKill = promisify(treeKill) as (pid: number, signal: string) => Promise<void>;

export const promisifiedTreeKill = async (pid: number, signal: string) => {
  try {
    return await _promisifiedTreeKill(pid, signal);
  } catch (error) {
    // Don't treat process termination failures as test failures
    // This is especially important on Windows where processes may already be gone
    // or may not be properly terminated with tree-kill
    log(`Process ${pid} could not be killed, but continuing: ${error.message}`);
    return Promise.resolve();
  }
};

export async function killAllRegisteredProcesses() {
  const pIds = (global?.pIds as number[]) ?? [];
  const result = await Promise.allSettled(pIds.map((pId) => promisifiedTreeKill(pId, 'SIGKILL')));
  const stringifiedResult = JSON.stringify(
    result.map((v, i) => ({
      pId: pIds[i],
      status: v.status === 'fulfilled' ? 'success' : 'failure',
    }))
  );
  log('Cleaned up processes invoked by e2e test: ' + stringifiedResult);
}

export const workspaceRoot = _computeWorkspaceRoot(process.cwd());

function _computeWorkspaceRoot(cwd: string) {
  if (dirname(cwd) === cwd) {
    return process.cwd();
  }

  const packageJsonAtCwd = join(cwd, 'package.json');
  if (existsSync(packageJsonAtCwd)) {
    const content = JSON.parse(readFileSync(packageJsonAtCwd, 'utf-8'));
    if (content.name === 'qwik-monorepo') {
      return cwd;
    }
  }
  return _computeWorkspaceRoot(dirname(cwd));
}

export function log(text: string) {
  // eslint-disable-next-line no-console
  console.log(yellow('E2E: ' + text));
}

export const DEFAULT_TIMEOUT = process.env.CI ? 120000 : 30000;

```

### Core Architecture Module: `e2e/qwik-cli-e2e/utils/setup.ts`
```
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { workspaceRoot } from '.';

const OPTIMIZER_PACKAGE = '@qwik.dev/optimizer';
const CORE_PACKAGE = '@qwik.dev/core';
const corePackagePath = join(workspaceRoot, 'packages/qwik/package.json');

const packageCfg: Record<string, { packagePath: string; distPath: string }> = {
  '@qwik.dev/optimizer': {
    packagePath: 'packages/optimizer',
    distPath: 'packages/optimizer/dist',
  },
  '@qwik.dev/core': {
    packagePath: 'packages/qwik',
    distPath: 'packages/qwik/dist',
  },
  '@qwik.dev/router': {
    packagePath: 'packages/qwik-router',
    distPath: 'packages/qwik-router/lib',
  },
  'eslint-plugin-qwik': {
    packagePath: 'packages/eslint-plugin-qwik',
    distPath: 'packages/eslint-plugin-qwik/dist',
  },
};
function ensurePackageBuilt() {
  for (const [name, cfg] of Object.entries(packageCfg)) {
    if (!existsSync(join(workspaceRoot, cfg.distPath))) {
      throw new Error(`Looks like package "${name}" has not been built yet.`);
    }
  }
  // The scaffolded starters use the Rust optimizer, which needs prebuilt bindings.
  if (!existsSync(join(workspaceRoot, 'packages/optimizer/bindings'))) {
    throw new Error(
      `Missing ${OPTIMIZER_PACKAGE} bindings. Run "pnpm build.rust" (needs the Rust toolchain) or "pnpm build.platform.copy" (downloads the published bindings) first.`
    );
  }
}
function packPackages() {
  const tarballPaths: { name: string; absolutePath: string }[] = [];
  const tarballOutDir = join(workspaceRoot, 'temp', 'tarballs');
  const originalCorePackageJson = readFileSync(corePackagePath, 'utf-8');

  try {
    for (const [name, cfg] of Object.entries(packageCfg)) {
      if (name === CORE_PACKAGE) {
        const optimizerTarball = tarballPaths.find((pkg) => pkg.name === OPTIMIZER_PACKAGE);
        if (!optimizerTarball) {
          throw new Error(`Missing packed ${OPTIMIZER_PACKAGE} package.`);
        }
        updateCoreOptimizerDependency(optimizerTarball.absolutePath);
      }

      tarballPaths.push({
        name,
        absolutePath: packPackage(join(workspaceRoot, cfg.packagePath), tarballOutDir),
      });
    }
  } finally {
    writeFileSync(corePackagePath, originalCorePackageJson);
  }

  writeFileSync(join(tarballOutDir, 'paths.json'), JSON.stringify(tarballPaths));
}

function packPackage(packagePath: string, tarballOutDir: string) {
  const out = execSync(`pnpm pack --json --pack-destination=${tarballOutDir}`, {
    cwd: packagePath,
    encoding: 'utf-8',
  });
  const json = JSON.parse(out);
  return json.filename;
}

function updateCoreOptimizerDependency(optimizerTarballPath: string) {
  const packageJson = JSON.parse(readFileSync(corePackagePath, 'utf-8'));
  packageJson.dependencies = {
    ...packageJson.dependencies,
    [OPTIMIZER_PACKAGE]: `file:${optimizerTarballPath.replace(/\\/g, '/')}`,
  };
  writeFileSync(corePackagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

ensurePackageBuilt();
packPackages();

```

### Core Architecture Module: `e2e/qwik-e2e/apps/e2e/src/components/events/events-lifecycle.tsx`
```
import { $, component$, useOnDocument, useSignal } from '@qwik.dev/core';

export const EventsLifecycle = component$(() => {
  const count = useSignal(0);

  useOnDocument(
    'qinit',
    $(async () => {
      await new Promise<void>((resolve) => {
        (window as any).releaseQinit = resolve;
      });
      document.getElementById('init-state')!.textContent = 'done';
    })
  );

  return (
    <div>
      <p id="init-state">pending</p>
      <button id="lifecycle-counter" onClick$={() => count.value++}>
        Count {count.value}
      </button>
    </div>
  );
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9402** (2026-11-09): **[🐞] v2 rc.4 dev server breaks on StackBlitz: createOptimizer is not a constructor**
  *Symptoms*: ### Which component is affected?  Qwik Rollup / Vite plugin  ### Describe the bug  Since `2.0.0-rc.4`, the dev server fails on StackBlitz (WebContainer), which breaks qwik.new. Every request fails with:  ``` [vite] (ssr) Error when evaluating SSR module src/entry.ssr: _qwik_dev_optimizer.createOptimizer is not a constructor   Plugin: vite-plugin-qwik   File: /home/projects/.../node_modules/@qwik.dev/core/dist/core.mjs       at e.split (.../@qwik.dev/core/dist/optimizer.mjs:647:11)       at e._splitChunk (.../@qwik.dev/core/dist/optimizer.mjs:1102:13)       ...       at e.replace (.../@qwik.dev/core/dist/optimizer.mjs:1190:38)       at Object._e [as transform] (.../@qwik.dev/core/dist/optimizer.mjs:1641:6) ```  The same project works on plain Node (24.21.0, Linux).  **Cause:** an identifier collision in the minified `dist/optimizer.mjs`, which trips a scoping bug in WebContainer's module handling.  - `packages/qwik-vite/src/index.ts:15` has `export { createOptimizer } from '@qwik.dev/optimizer'`, which ends up as `import { createOptimizer as e } from "@qwik.dev/optimizer"` at the top of the bundle. - The same bundle inlines `magic-string`, whose classes are minified to named class expressions: `_e = class e { … split(t) { … new e(t, this.end, i) … } }`.  This is valid JS, and `new e()` should resolve to the class. WebContainer resolves it to the import instead, so the first `MagicString` chunk split throws. That is why a `createOptimizer` error comes out of a `magic-string` st

- **Issue #9041** (2026-10-26): **router: visible `<Link>` prefetch skips bundles for dynamic and catch-all routes**
  *Symptoms*: # What is it?  - Bug  # Description  A visible `<Link>` (`prefetchBundles="visible"`, the default) preloads nothing for dynamic routes. `link-prefetch.ts` calls `preloadRouteBundles(url.pathname)`, so the preloader gets `products/123/`, but the bundle graph keys routes by name (`products/[id]/`, see `get-route-imports.ts`). Static routes work because their pathname is their route name. Link clicks and SPA navigation go through `prefetchRoute()`, which resolves the route name first. 48fb84ed0 had moved the visible path to `prefetchRoute()` too, but the merge with the shared-observer refactor (4ba1ad594) only carried over the data branch.  Catch-all routes miss even through `prefetchRoute()`. The build keys `docs/[...slug]/index.tsx` as `docs/[...slug]` with no trailing slash, because `normalizePathname` treats a last segment containing `.` as a file name. `prefetchRoute()` calls `ensureSlash` and looks up `docs/[...slug]/`, so Link clicks and SPA navigation miss catch-all bundles too. Other routes whose last segment contains a dot, and maybe every route with `trailingSlash: false`, likely hit the same mismatch (not checked).  Reproduced on a production build of the `qwikrouter-test.prod` e2e app with temporary `[id]`, `[...slug]` and static routes: only the static link's bundles loaded. #9040 (closed, untested) switched the observer to `prefetchRoute()`. With it, `[id]` links loaded their route module and component bundle, but `[...slug]` links only got their route module. `pr

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

### Incident Patch 1: `7a5562d2` (2026-11-11)
**Commit Message**: fix(router): isolate concurrent adapter build entries

Builds sharing a root can use different SSR output directories. Keep their entries and cleanup independent.

**File**: `.changeset/ssg-adapter-app-build-state.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 '@qwik.dev/router': patch
 ---
 
-fix: the SSG adapter no longer warns "Qwik Router SSG was skipped" on builds that prerender, and passes the server entries to the adapter's `generate()`
+fix: correct ssg warnings and isolate server entries per build
```

**File**: `packages/qwik-router/src/adapters/shared/vite/index.ts` (modified, +16/-13)
```diff
@@ -20,12 +20,13 @@ const QWIK_SSG_ENTRY_RESOLVED = '\0@qwik-ssg-entry';
 const QWIK_SSG_WORKER_ENTRY_ID = '@qwik-ssg-worker-entry';
 const QWIK_SSG_WORKER_ENTRY_RESOLVED = '\0@qwik-ssg-worker-entry';
 
-// App builds in progress, by resolved root. `buildApp` runs on the top-level instance of the
-// adapter plugin, but Vite resolves the config again for each environment, which creates new
-// plugin instances (unless a plugin sets `sharedDuringBuild`). So the `ssr` build's
-// `generateBundle` cannot reach `buildApp` through the plugin closure, and finds it here instead.
+// Vite creates separate adapter instances for each build environment.
 const appBuilds = new Map<string, { outputEntries: string[] }>();
 
+function getAppBuildKey(root: string, outDir: string) {
+  return JSON.stringify([resolve(root), resolve(root, outDir)]);
+}
+
 /** @public */
 export function viteAdapter(opts: ViteAdapterPluginOptions) {
   let qwikRouterPlugin: QwikRouterPlugin | null = null;
@@ -222,7 +223,8 @@ export function viteAdapter(opts: ViteAdapterPluginOptions) {
     generateBundle(_, bundles) {
       // Capture the deployed entries (the `ssr` environment), not the throwaway `ssg` output.
       if (this.environment.name === 'ssr') {
-        const appBuild = appBuilds.get(resolve(this.environment.config.root));
+        const { root, build } = this.environment.config;
+        const appBuild = appBuilds.get(getAppBuildKey(root, build.outDir));
         if (appBuild) {
           appBuild.outputEntries.length = 0;
           for (const fileName in bundles) {
@@ -252,17 +254,18 @@ export function viteAdapter(opts: ViteAdapterPluginOptions) {
     // prerendered route code never reaches the `ssr` bundle — then render the pages and post-build.
     // (The client builds in its own `vite build`.)
     async buildApp(builder: ViteBuilder) {
-      const root = resolve(builder.config.root);
+      const ssr = builder.environments.ssr;
+      if (!ssr) {
+        return;
+      }
+      const buildKey = getAppBuildKey(ssr.config.root, ssr.config.build.outDir);
       const appBuild = { outputEntries: [] as string[] };
-      appBuilds.set(root, appBuild);
+      appBuilds.set(buildKey, appBuild);
       try {
-        const ssr = builder.environments.ssr;
-        if (ssr) {
-          await builder.build(ssr);
-        }
+        await builder.build(ssr);
         // Read the deployed server outDir from the `ssr` environment, not a closure: in builder mode
         // `configResolved` runs per environment, so the later `ssg` build would clobber a shared value.
-        const serverOutDir = ssr?.config.build.outDir;
+        const serverOutDir = ssr.config.build.outDir;
         if (!serverOutDir || !qwikRouterPlugin?.api || !qwikVitePlugin?.api) {
           return;
         }
@@ -344,7 +347,7 @@ export function viteAdapter(opts: ViteAdapterPluginOptions) {
             `\n==============================================`
         );
       } finally {
-        appBuilds.delete(root);
+        appBuilds.delete(buildKey);
       }
     },
   };
```

**File**: `packages/qwik-router/src/adapters/shared/vite/index.unit.ts` (modified, +90/-25)
```diff
@@ -77,35 +77,91 @@ describe('viteAdapter app build', () => {
     'entry.azure-swa.js': { type: 'chunk', isEntry: true },
     'q-chunk.js': { type: 'chunk', isEntry: false },
   };
+  const ssrConfig = { root: '/app', build: { outDir: '/app/server' } };
 
-  it('hands the ssr entries to generate() without warning, across plugin instances', async () => {
-    const generate = vi.fn();
-    const opts = { name: 'test', origin: 'https://example.com', generate };
-    // Vite resolves the config again for each environment, so the `ssr` build uses another
-    // instance of the plugin than the one `buildApp` runs on.
-    const [topLevelPlugin] = viteAdapter(opts) as any[];
-    const [ssrPlugin] = viteAdapter(opts) as any[];
-    topLevelPlugin.configResolved(resolvedConfig);
-    ssrPlugin.configResolved(resolvedConfig);
+  it.each(['/app/server', 'server'])(
+    'hands the ssr entries across plugin instances with server output %s',
+    async (outDir) => {
+      const generate = vi.fn();
+      const opts = { name: 'test', origin: 'https://example.com', generate };
+      // Vite resolves the config again for each environment, so the `ssr` build uses another
+      // instance of the plugin than the one `buildApp` runs on.
+      const [topLevelPlugin] = viteAdapter(opts) as any[];
+      const [ssrPlugin] = viteAdapter(opts) as any[];
+      topLevelPlugin.configResolved(resolvedConfig);
+      ssrPlugin.configResolved(resolvedConfig);
 
-    const warn = vi.fn();
-    const ssr = { config: { build: { outDir: '/app/server' } } };
-    await topLevelPlugin.buildApp({
-      environments: { ssr },
-      config: { root: '/app', define: {}, logger: { warn() {} } },
+      const warn = vi.fn();
+      const ssr = { config: { ...ssrConfig, build: { outDir } } };
+      await topLevelPlugin.buildApp({
+        environments: { ssr },
+        config: { root: '/app', define: {}, logger: { warn() {} } },
+        build: async () => {
+          ssrPlugin.generateBundle.call(
+            { environment: { name: 'ssr', config: ssrConfig }, warn },
+            {},
+            ssrBundles
+          );
+        },
+      });
+
+      expect(warn).not.toHaveBeenCalled();
+      expect(generate).toHaveBeenCalledWith(
+        expect.objectContaining({ outputEntries: ['entry.azure-swa.js'] })
+      );
+    }
+  );
+
+  it('keeps parallel builds of one root with different server outputs apart', async () => {
+    const firstGenerate = vi.fn();
+    const secondGenerate = vi.fn();
+    const opts = { name: 'test', origin: 'https://example.com', ssg: null };
+    const [firstPlugin] = viteAdapter({ ...opts, generate: firstGenerate }) as any[];
+    const [secondPlugin] = viteAdapter({ ...opts, generate: secondGenerate }) as any[];
+    const [firstSsrPlugin] = viteAdapter(opts) as any[];
+    const [secondSsrPlugin] = viteAdapter(opts) as any[];
+    for (const plugin of [firstPlugin, secondPlugin, firstSsrPlugin, secondSsrPlugin]) {
+      plugin.configResolved(resolvedConfig);
+    }
+
+    const config = { root: '/app', define: {}, logger: { warn() {} } };
+    const firstSsr = { config: { root: '/app', build: { outDir: '/app/server-first' } } };
+    const secondSsr = { config: { root: '/app', build: { outDir: '/app/server-second' } } };
+    let finishFirstBuild!: () => void;
+    const firstBuild = firstPlugin.buildApp({
+      environments: { ssr: firstSsr },
+      config,
+      build: () =>
+        new Promise<void>((resolve) => {
+          finishFirstBuild = resolve;
+        }),
+    });
+
+    await secondPlugin.buildApp({
+      environments: { ssr: secondSsr },
+      config,
       build: async () => {
-        ssrPlugin.generateBundle.call(
-          { environment: { name: 'ssr', config: { root: '/app' } }, warn },
+        firstSsrPlugin.generateBundle.call(
+          { environment: { name: 'ssr', config: firstSsr.config }, warn: vi.fn() },
           {},
           ssrBundles
         );
+        finishFirstBuild();
+        await firstBuild;
+        secondSsrPlugin.generateBundle.call(
+          { environment: { name: 'ssr', config: secondSsr.config }, warn: vi.fn() },
+          {},
+          { 'entry.second.js': { type: 'chunk', isEntry: true } }
+        );
       },
     });
 
-    expect(warn).not.toHaveBeenCalled();
-    expect(generate).toHaveBeenCalledWith(
+    expect(firstGenerate).toHaveBeenCalledWith(
       expect.objectContaining({ outputEntries: ['entry.azure-swa.js'] })
     );
+    expect(secondGenerate).toHaveBeenCalledWith(
+      expect.objectContaining({ outputEntries: ['entry.second.js'] })
+    );
   });
 
   it('warns when the ssr environment is built outside buildApp', () => {
@@ -114,7 +170,7 @@ describe('viteAdapter app build', () => {
 
     const warn = vi.fn();
     plugin.generateBundle.call(
-      { environment: { name: 'ssr', config: { root: '/app' } }, warn },
+      { environment: { name: 'ssr', config: ssrConfig }, warn },
       {},
       ssrBundles
     
```

---

### Incident Patch 2: `2fe2eec9` (2026-11-11)
**Commit Message**: Merge pull request #9393 from alloutflo/fix/router-send-stream-errors

fix(router): handle response stream failures from send

**File**: `.changeset/stable-birds-stream.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@qwik.dev/router": patch
+---
+
+fix: prevent response stream failures from crashing the server
```

**File**: `packages/qwik-router/src/middleware/node/http.unit.ts` (modified, +61/-0)
```diff
@@ -11,6 +11,7 @@ import { connect } from 'node:net';
 import { performance } from 'node:perf_hooks';
 import { Readable } from 'node:stream';
 import { assert, describe, expect, test, vi } from 'vitest';
+import { createRequestEvent } from '../request-handler/request-event-core';
 import { fromNodeHttp, normalizeUrl } from './http';
 
 [
@@ -474,6 +475,66 @@ describe('fromNodeHttp()', () => {
     expect(res.end).not.toHaveBeenCalled();
   });
 
+  test.each([
+    { source: 'response error event', timing: 'during write', abortsRequest: true },
+    { source: 'write callback', timing: 'during write', abortsRequest: false },
+    { source: 'response error event', timing: 'before drain', abortsRequest: true },
+    { source: 'write callback', timing: 'before drain', abortsRequest: false },
+  ])('logs unexpected errors from the $source $timing', async ({ timing, abortsRequest }) => {
+    const error = new Error('unexpected write failure');
+    const req = createBodyRequest([]);
+    const res = createResponse();
+    const waitsForDrain = timing === 'before drain';
+    let drainListenersAtFailure: number | undefined;
+    res.setHeader = vi.fn();
+    res.write = vi.fn(
+      (
+        _chunk: Uint8Array,
+        encoding?: BufferEncoding | ((error?: Error | null) => void),
+        callback?: (error?: Error | null) => void
+      ) => {
+        const onWrite = typeof encoding === 'function' ? encoding : callback;
+        const fail = () => {
+          drainListenersAtFailure = res.listenerCount('drain');
+          if (abortsRequest) {
+            res.emit('error', error);
+          } else {
+            onWrite?.(error);
+          }
+        };
+        if (waitsForDrain) {
+          queueMicrotask(fail);
+        } else {
+          fail();
+        }
+        return false;
+      }
+    );
+    const serverRequestEv = await fromNodeHttp(new URL('http://localhost/'), req, res, 'server');
+    const requestEv = createRequestEvent(
+      serverRequestEv,
+      { $routeName$: '/', $params$: {}, $mods$: [] },
+      [],
+      '/',
+      vi.fn()
+    );
+    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
+
+    try {
+      requestEv.send(200, 'hello');
+
+      await vi.waitFor(() =>
+        expect(consoleError).toHaveBeenCalledWith('Response stream failed:', error)
+      );
+      expect(consoleError).toHaveBeenCalledTimes(1);
+      expect(requestEv.signal.aborted).toBe(abortsRequest);
+      expect(drainListenersAtFailure).toBe(waitsForDrain ? 1 : 0);
+      expect(res.listenerCount('drain')).toBe(0);
+    } finally {
+      consoleError.mockRestore();
+    }
+  });
+
   // Verifies the Node adapter starts making response-write progress before a large SSR render fully completes.
   test('should make Node response progress before render completes', async () => {
     const timings = {
```

**File**: `packages/qwik-router/src/middleware/request-handler/request-event-core.ts` (modified, +19/-4)
```diff
@@ -50,6 +50,7 @@ export const RequestEvCaughtError = '@caughtError';
 export const RequestEvSentServerError = '@sentServerError';
 export const RequestEvHttpStatusMessage = '@httpStatusMessage';
 
+/** Builds shared request state and controls route handler execution. */
 export function createRequestEvent(
   serverRequestEv: ServerRequestEvent,
   loadedRoute: LoadedRoute,
@@ -125,14 +126,18 @@ export function createRequestEvent(
     }
   };
 
+  /** Exits the route synchronously while handling stream failures asynchronously. */
   const send = (statusOrResponse: number | Response, body: string | Uint8Array) => {
     check();
+    let responseWrite: Promise<unknown>;
     if (typeof statusOrResponse === 'number') {
       status = statusOrResponse;
       const writableStream = requestEv.getWritableStream();
       const writer = writableStream.getWriter();
-      writer.write(typeof body === 'string' ? encoder.encode(body) : body);
-      writer.close();
+      responseWrite = Promise.all([
+        writer.write(typeof body === 'string' ? encoder.encode(body) : body),
+        writer.close(),
+      ]);
     } else {
       status = statusOrResponse.status;
       statusOrResponse.headers.forEach((value, key) => {
@@ -152,11 +157,21 @@ export function createRequestEvent(
       });
       if (statusOrResponse.body) {
         const writableStream = requestEv.getWritableStream();
-        statusOrResponse.body.pipeTo(writableStream);
+        responseWrite = statusOrResponse.body.pipeTo(writableStream);
       } else {
-        requestEv.getWritableStream().getWriter().close();
+        responseWrite = requestEv.getWritableStream().getWriter().close();
       }
     }
+    void responseWrite.catch((error) => {
+      const signal = request.signal;
+      if (
+        signal.aborted &&
+        ((error instanceof Error && error.name === 'AbortError') || error === signal.reason)
+      ) {
+        return;
+      }
+      console.error('Response stream failed:', error);
+    });
     return exit();
   };
 
```

**File**: `packages/qwik-router/src/middleware/request-handler/request-event.unit.ts` (modified, +85/-0)
```diff
@@ -91,6 +91,91 @@ describe('request-event internalRequest', () => {
   });
 });
 
+describe('request-event send', () => {
+  describe.each([
+    new Error('broken response stream'),
+    new DOMException('Upstream cancelled', 'AbortError'),
+  ])('reports $name stream failures for active requests', (error) => {
+    it.each([
+      {
+        name: 'reading a response body',
+        send: (ev: ReturnType<typeof createMockRequestEvent>, error: Error) =>
+          ev.send(
+            new Response(new ReadableStream({ start: (controller) => controller.error(error) }))
+          ),
+        sink: () => ({}),
+      },
+      {
+        name: 'writing a response body',
+        send: (ev: ReturnType<typeof createMockRequestEvent>) => ev.send(200, 'hello'),
+        sink: (error: Error) => ({
+          write: () => {
+            throw error;
+          },
+        }),
+      },
+      {
+        name: 'closing an empty response',
+        send: (ev: ReturnType<typeof createMockRequestEvent>) => ev.send(new Response(null)),
+        sink: (error: Error) => ({
+          close: () => {
+            throw error;
+          },
+        }),
+      },
+    ])('handles failures while $name', async ({ send, sink }) => {
+      const serverRequestEv = createMockServerRequestEvent();
+      vi.mocked(serverRequestEv.getWritableStream).mockReturnValue(new WritableStream(sink(error)));
+      const requestEv = createRequestEvent(serverRequestEv, mockRoute, [], '/', vi.fn());
+      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
+
+      try {
+        send(requestEv, error);
+
+        expect(requestEv.exited).toBe(true);
+        await vi.waitFor(() =>
+          expect(consoleError).toHaveBeenCalledWith('Response stream failed:', error)
+        );
+        expect(consoleError).toHaveBeenCalledTimes(1);
+      } finally {
+        consoleError.mockRestore();
+      }
+    });
+  });
+
+  it.each([
+    ['an abort error', new DOMException('Client disconnected', 'AbortError'), false],
+    ['an aborted request', new Error('Client disconnected'), true],
+  ] as const)('does not report %s', async (_, error, useAbortReason) => {
+    const controller = new AbortController();
+    const serverRequestEv = createMockServerRequestEvent(undefined, { signal: controller.signal });
+    vi.mocked(serverRequestEv.getWritableStream).mockReturnValue(
+      new WritableStream({
+        write() {
+          controller.abort(useAbortReason ? error : undefined);
+          throw error;
+        },
+      })
+    );
+    const requestEv = createRequestEvent(serverRequestEv, mockRoute, [], '/', vi.fn());
+    const cancel = vi.fn();
+    const body = new ReadableStream({
+      start: (stream) => stream.enqueue(new TextEncoder().encode('hello')),
+      cancel,
+    });
+    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
+
+    try {
+      requestEv.send(new Response(body));
+
+      await vi.waitFor(() => expect(cancel).toHaveBeenCalledWith(error));
+      expect(consoleError).not.toHaveBeenCalled();
+    } finally {
+      consoleError.mockRestore();
+    }
+  });
+});
+
 describe('request-event redirect', () => {
   it('should not cache redirects by default', () => {
     const requestEv = createMockRequestEvent();
```

---

### Incident Patch 3: `c8ac60ac` (2026-11-12)
**Commit Message**: Merge bundle overview review fix into relationships

**File**: `packages/insights/src/routes/app/[publicApiKey]/symbols/bundles/bundle-view.ts` (modified, +4/-0)
```diff
@@ -44,6 +44,10 @@ export function createBundleViewData(vectors: SymbolVectors, bundles: Bundle[])
   };
 }
 
+export function getSelectedBundleIndex(selectedIndex: number, bundleCount: number): number {
+  return selectedIndex >= 0 && selectedIndex < bundleCount ? selectedIndex : 0;
+}
+
 export function getBundleExecutionCount(bundle: {
   name: string;
   symbols: { count: number }[];
```

**File**: `packages/insights/src/routes/app/[publicApiKey]/symbols/bundles/bundle-view.unit.ts` (modified, +8/-0)
```diff
@@ -1,13 +1,21 @@
 import { describe, expect, it } from 'vitest';
 import {
   getBundleExecutionCount,
+  getSelectedBundleIndex,
   createBundleViewData,
   getMatrixCellColor,
   getStrongestRelationships,
 } from './bundle-view';
 import type { Symbol } from '~/stats/edges';
 
 describe('bundle view', () => {
+  it('falls back to the first group when navigation returns fewer groups', () => {
+    expect(getSelectedBundleIndex(2, 3)).toBe(2);
+    expect(getSelectedBundleIndex(2, 1)).toBe(0);
+    expect(getSelectedBundleIndex(2, 0)).toBe(0);
+    expect(getSelectedBundleIndex(-1, 3)).toBe(0);
+  });
+
   it('sends only matrix cells that are visible in the report', () => {
     const vectors = {
       symbols: [],
```

**File**: `packages/insights/src/routes/app/[publicApiKey]/symbols/bundles/index.tsx` (modified, +5/-3)
```diff
@@ -13,6 +13,7 @@ import {
 import {
   createBundleViewData,
   getBundleExecutionCount,
+  getSelectedBundleIndex,
   getMatrixCellColor,
   type MatrixCell,
 } from './bundle-view';
@@ -51,7 +52,8 @@ export default component$(() => {
   const selectedIndex = useSignal(0);
   const selectedSymbol = useSignal('');
   const selectedRelationship = useSignal(-1);
-  const selectedBundle = data.value.bundles.at(selectedIndex.value) ?? data.value.bundles.at(0);
+  const effectiveIndex = getSelectedBundleIndex(selectedIndex.value, data.value.bundles.length);
+  const selectedBundle = data.value.bundles.at(effectiveIndex);
   const strongestRelationships = selectedSymbol.value
     ? (selectedBundle?.symbolRelationships[selectedSymbol.value] ?? [])
     : (selectedBundle?.relationships ?? []);
@@ -78,7 +80,7 @@ export default component$(() => {
         {selectedBundle && (
           <div class="md:text-right">
             <code class="font-editorial-mono text-editorial-20 font-semibold">
-              Group {selectedIndex.value + 1}
+              Group {effectiveIndex + 1}
             </code>
             <p class="mt-editorial-1 text-editorial-12 text-editorial-secondary">
               {selectedBundle.symbols.length.toLocaleString('en')} symbols ·{' '}
@@ -142,7 +144,7 @@ export default component$(() => {
               </div>
               <ol class="p-editorial-2">
                 {data.value.bundles.map((bundle, index) => {
-                  const isSelected = index === selectedIndex.value;
+                  const isSelected = index === effectiveIndex;
                   return (
                     <li key={bundle.name}>
                       <button
```

#### Recent Merged Pull Requests:
- **PR #9462** (2026-11-12): test(preloader): send held speculative preloads once a cold click needs them (@wmertens)
- **PR #9452** (2026-11-12): Lead bundle exploration with relationships and selectable views (@mhevery)
- **PR #9451** (2026-11-12): Explain directional symbol relationships with selectable details (@mhevery)
- **PR #9450** (2026-11-12): Clarify suggested bundle groups and their sizes (@mhevery)
- **PR #9432** (2026-11-11): feat(insights): configure source previews and migrate before deployment (@mhevery)
- **PR #9431** (2026-11-11): feat(insights): keep the current application visible across reports (@mhevery)

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

## X. router): isolate concurrent adapter build entries

**RULE**:
When implementing operations in `.changeset/ssg-adapter-app-build-state.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in QwikDev/qwik. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7a5562d2`: router): isolate concurrent adapter build entries. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/ssg-adapter-app-build-state.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
fix: correct ssg warnings and isolate server entries per build
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
fix: the SSG adapter no longer warns "Qwik Router SSG was skipped" on builds that prerender, and passes the server entries to the adapter's `generate()`
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7a5562d2` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
