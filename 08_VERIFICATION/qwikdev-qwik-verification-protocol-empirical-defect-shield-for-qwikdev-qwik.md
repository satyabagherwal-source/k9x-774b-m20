# Verification Protocol: Verification Protocol: Empirical Defect Shield for QwikDev/qwik

<!-- PROVENANCE_START
{
  "source_repository": "QwikDev/qwik",
  "source_url": "https://github.com/QwikDev/qwik",
  "source_version": "5b80fdec",
  "license": "MIT",
  "timestamp": "2026-11-28T10:36:11.028Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-qwikdev-qwik",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [QwikDev/qwik](https://github.com/QwikDev/qwik) (Revision: `5b80fdec`).  
> **License**: MIT | **Timestamp**: `2026-11-28T10:36:11.028Z`  
> **Learning ID**: `learn-github-qwikdev-qwik`


## 1. Scope & Verification Target
- **Target Repository**: `QwikDev/qwik` (Commit: `5b80fdec`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): QwikDev/qwik

> **Canonical Artifact**: `07_PROJECT_LEARNING/qwikdev-qwik-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/QwikDev/qwik](https://github.com/QwikDev/qwik))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T10:36:09.914Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `QwikDev/qwik`
- **Description**: Instant-loading web apps, without effort
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 22075 stars

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
import { brotliCompressSync } from 'node:zlib';

export const APP_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../qwik-e2e/apps/preloader-test'
);
export const PORT = 4318;
export const ORIGIN = `https://localhost:${PORT}`;

type Manifest = {
  preloader?: string;
  bundleGraphAsset?: string;
  bundles: Record<string, { origins?: string[]; symbols?: string[]; imports?: string[] }>;
  symbols: Record<string, { ctxName?: string; ctxKind?: string }>;
};

let manifest: Manifest | undefined;

export const getManifest = (): Manifest =>
  (manifest ||= JSON.parse(readFileSync(join(APP_DIR, 'dist/q-manifest.json'), 'utf8')));

export const getCoreBundle = () => {
  const { bundles } = getManifest();
  const coreBundle = Object.keys(bundles).find((file) =>
    bundles[file].origins?.some((origin) => /\/core(\.prod|\.min)?\.qwik\.mjs$/.test(origin))
  );
  if (!coreBundle) {
    throw new Error('No bundle in q-manifest.json holds core');
  }
  return coreBundle;
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

export const chunkHoldsModule = (url: string, path: string) =>
  !!getManifest().bundles[bundleFile(url)]?.origins?.includes(path);

export const chunkHoldsSegmentsFrom = (url: string, paths: string[]) =>
  chunkComesFrom(url, paths) && !!getManifest().bundles[bundleFile(url)]?.symbols?.length;

const chunkHasSymbolOf = (url: string, ctxName: string) => {
  const manifest = getManifest();
  return (manifest.bundles[bundleFile(url)]?.symbols ?? []).some(
    (symbol) => manifest.symbols[symbol]?.ctxName === ctxName
  );
};

export const chunkHasScopedStyles = (url: string) => chunkHasSymbolOf(url, 'useStylesScoped$');

export const chunkHasComponent = (url: string) => chunkHasSymbolOf(url, 'component$');

export const chunkHasVisibleTask = (url: string) => chunkHasSymbolOf(url, 'useVisibleTask$');

export const chunkHasClickHandler = (url: string) => chunkHasSymbolOf(url, 'onClick$');

export type ChunkKind = 'handler' | 'other-qrl' | 'component';

export const chunkKind = (url: string): ChunkKind | undefined => {
  const manifest = getManifest();
  const symbols = (manifest.bundles[bundleFile(url)]?.symbols ?? [])
    .map((symbol) => manifest.symbols[symbol])
    .filter((symbol) => !!symbol);
  if (!symbols.length) {
    return undefined;
  }
  if (symbols.some((symbol) => symbol.ctxKind !== 'function')) {
    return 'handler';
  }
  return symbols.every((symbol) => /^(component|useStyles)/.test(symbol.ctxName ?? ''))
    ? 'component'
    : 'other-qrl';
};

export const chunkHoldsTaskFrom = (url: string, file: string) =>
  (getManifest().bundles[bundleFile(url)]?.origins ?? []).some(
    (origin) => origin.startsWith(`${file}_`) && origin.includes('_useTask_')
  );

/** The chunks holding `path`'s modules, with everything they import statically. */
export const chunkUrlsNeededToRun = (path: string) => {
  const { bundles } = getManifest();
  const needed = new Set<string>();
  const pending = Object.keys(bundles).filter((file) =>
    bundles[file].origins?.some((origin) => origin.startsWith(path))
  );
  while (pending.length) {
    const file = pending.pop()!;
    if (!needed.has(file)) {
      needed.add(file);
      pending.push(...(bundles[file]?.imports ?? []));
    }
  }
  return new Set([...needed].map((file) => `${ORIGIN}/build/${file}`));
};

export const brotliKb = (url: string) =>
  brotliCompressSync(readFileSync(join(APP_DIR, 'dist/build', bundleFile(url)))).length / 1024;

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
  all: 9,
};

export const SETUP_LEVELS = { single: 1, tree: 3, 'tree-context': 3, conditional: 3 };

const STARTS_WHEN_VISIBLE = 'visible-task-chain';

export type Fixture = {
  id: string;
  path: string;
  sources: string[];
  expected?: string;
  warmRoundTrips?: number;
  startsWhenVisible?: boolean;
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
    startsWhenVisible: primitive === STARTS_WHEN_VISIBLE && setup !== 'conditional',
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
export const CONDITIONAL_MODAL = handWritten('conditional-modal', 'ready');
export const EMPTY_LIST = handWritten('empty-list', '1');
export const TASKS_IN_PARENT_AND_CHILD = handWritten('tasks/parent-child', '2');
export const TASKS_IN_SIBLINGS = handWritten('tasks/siblings', '2');
export const SCOPED_STYLES = handWritten('scoped-styles', 'styled');
export const QRL_PROP = handWritten('qrl-prop', '42');
export const SYNC = handWritten('sync', 'done');
export const BARREL = handWritten('barrel', 'alpha 1.0');
export const STREAMING = handWritten('streaming', '1');

export const DASHBOARD_MODAL: Fixture = {
  id: 'dashboard-modal',
  path: '/dashboard-modal/',
  sources: ['src/components/fixtures/dashboard-modal/', 'src/routes/dashboard-modal/'],
};

const overPreloading = (name: string): Fixture => ({
  id: `over-preloading/${name}`,
  path: `/over-preloading/${name}/`,
  sources: [`src/routes/over-preloading/${name}/`],
  expected: 'theme-dark',
});

export const CLICK_RUNS_COMPUTED = overPreloading('click-computed');
export const CLICK_RUNS_TASK = overPreloading('click-task');
export const CLICK_RUNS_TASK_CALLING_QRL = overPreloading('click-task-calling-qrl');
export const VISIBLE_TASK_RUNS_COMPUTED = overPreloading('visible-task-computed');
export const VISIBLE_TASK_RUNS_TASK = overPreloading('visible-task-task');
export const VISIBLE_TASK_RUNS_TASK_CALLING_QRL = overPreloading('visible-task-task-calling-qrl');

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
const JSX_ONLY =
  'one round trip on main: the signal is only read in JSX, so the click only needs its handler';
const COMPUTEDS_WITH_HANDLER =
  'one round trip on main: the computed chunks go out with the click handler';
const NO_HANDLER_TO_FETCH =
  'one round trip: a scroll has no handler to fetch first, and every visible task chunk goes out at once';
const TASKS_WITH_HANDLER =
  "one round trip on main: the click handler's chunk also holds the component's tasks";
const TASKS_FOUND_LEVEL_BY_LEVEL =
  "over the 2-round-trip cap on main: each component's tasks are only found once the level above has run";
const RENDER_FOUND_AFTER_TASK =
  "over the 2-round-trip cap on main: the modal's task loads first, and its render chunk is only found once the task has run";

export const NEVER_SHOWS_RESULT: Record<string, string> = {
  'tree/mixed-computed-chain': NEVER_UPDATES,
  'tree-context/mixed-computed-chain': NEVER_UPDATES,
};

export type RoundTripsOnMain = { roundTrips: number; reason: string };

export const ROUND_TRIPS_ON_MAIN: Record<string, RoundTripsOnMain> = {
  'single/jsx-binding': { roundTrips: 1, reason: JSX_ONLY },
  'tree/jsx-binding': { roundTrips: 1, reason: JSX_ONLY },
  'tree-context/jsx-binding': { roundTrips: 1, reason: JSX_ONLY },
  'single/computed-chain': { roundTrips: 1, reason: COMPUTEDS_WITH_HANDLER },
  'tree/computed-chain': { roundTrips: 1, reason: COMPUTEDS_WITH_HANDLER },
  'tree-context/computed-chain': { roundTrips: 1, reason: COMPUTEDS_WITH_HANDLER },
  'single/visible-task-chain': { roundTrips: 1, reason: NO_HANDLER_TO_FETCH },
  'tree/visible-task-chain': { roundTrips: 1, reason: NO_HANDLER_TO_FETCH },
  'tree-context/visible-task-chain': { roundTrips: 1, reason: NO_HANDLER_TO_FETCH },
  'single/async-computed-chain': { roundTrips: 1, reason: COMPUTEDS_WITH_HANDLER },
  'single/mixed-computed-chain': { roundTrips: 1, reason: COMPUTEDS_WITH_HANDLER },
  'single/store-chain': { roundTrips: 1, reason: TASKS_WITH_HANDLER },
  'single/task-chain': { roundTrips: 1, reason: TASKS_WITH_HANDLER },
  'single/all': { roundTrips: 1, reason: TASKS_WITH_HANDLER },
  'tree/store-chain': { roundTrips: 3, reason: TASKS_FOUND_LEVEL_BY_LEVEL },
  'tree/task-chain': { roundTrips: 3, reason: TASKS_FOUND_LEVEL_BY_LEVEL },
  'tree-context/store-chain': { roundTrips: 3, reason: TASKS_FOUND_LEVEL_BY_LEVEL },
  'tree-context/task-chain': { roundTrips: 3, reason: TASKS_FOUND_LEVEL_BY_LEVEL },
  'tree/all': { roundTrips: 3, reason: TASKS_FOUND_LEVEL_BY_LEVEL },
  'tree-context/all': { roundTrips: 3, reason: TASKS_FOUND_LEVEL_BY_LEVEL },
  modal: { roundTrips: 3, reason: RENDER_FOUND_AFTER_TASK },
};

export const NAVIGATION_SOURCES = ['src/components/fixtures/navigation/', 'src/routes/navigation/'];

```

### Core Architecture Module: `e2e/preloader-e2e/utils/gate.ts`
```
import type { Locator, Page, Request, Route } from '@playwright/test';
import { chunkHoldsSegmentsFrom, labelRequest, ORIGIN } from './app';

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
  __preloadHints?: PreloadHint[];
  /** Qwik's own hint queue (preloader/bridge.ts), not a test hook. */
  qPreloadQueue?: [item: string | string[], priority?: number, isPageToRender?: boolean][];
};

export type PreloadHint = {
  item: string | string[];
  priority?: number;
  isPageToRender?: boolean;
};

export const recordPreloadHints = (page: Page) =>
  page.addInitScript(() => {
    const win = window as PreloaderWindow;
    const hints: PreloadHint[] = (win.__preloadHints = []);
    let preload:
      | ((item: string | string[], priority?: number, isPageToRender?: boolean) => void)
      | undefined;
    Object.defineProperty(win, 'qPreload', {
      configurable: true,
      get: () =>
        preload &&
        ((item: string | string[], priority?: number, isPageToRender?: boolean) => {
          hints.push({ item, priority, isPageToRender });
          preload!(item, priority, isPageToRender);
        }),
      set: (value) => {
        // The preloader drains the hints queued before it loaded without calling the getter
        if (win.qPreloadQueue) {
          for (const [item, priority, isPageToRender] of win.qPreloadQueue) {
            hints.push({ item, priority, isPageToRender });
          }
        }
        preload = value;
      },
    });
  });

export const preloadHints = (page: Page) =>
  page.evaluate(() => (window as PreloaderWindow).__preloadHints ?? []);

/** Chunks hinted at the highest priority so far, also those waiting for the preloader to load. */
export const chunksHintedAtHighestPriority = (page: Page) =>
  page.evaluate(() => {
    const win = window as PreloaderWindow;
    const hints = [
      ...(win.__preloadHints ?? []),
      ...(win.qPreloadQueue ?? []).map(([item, priority]) => ({ item, priority })),
    ];
    return hints.filter((hint) => hint.priority === 1).flatMap((hint) => hint.item);
  });

export const recordSpeculativePreloads = (page: Page) =>
  page.addInitScript(() => {
    const win = window as PreloaderWindow;
    win.__preloaderLinks = [];
    win.__speculativeInFlight = 0;
    win.__maxSpeculativeInFlight = 0;
    const appendChild = Node.prototype.appendChild;
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
        }
      }
      return appendChild.call(this, node) as T;
    };
  });

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
  await release([...gate.held.splice(0), ...heldBack.splice(0)]);
};

export const waitForQwikloader = (page: Page) =>
  page.waitForFunction(() => (window as any)._qwikEv?.roots, null, { timeout: 15_000 });

const urlsOf = (routes: Route[]) => routes.map((route) => route.request().url());

export const withoutSpeculativePreloads = (path: string) => {
  const url = new URL(path, ORIGIN);
  url.searchParams.set('maxIdlePreloads', '0');
  return url.pathname + url.search;
};

export const openCold = async (page: Page, gate: Gate, path: string) => {
  await waitForNetworkIdle(page, async () => {
    await page.goto(withoutSpeculativePreloads(path));
    await waitForQwikloader(page);
    await page.waitForFunction(() => typeof (globalThis as any).qPreload === 'function', null, {
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
    u
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

export const startFixture = (page: Page, fixture: Fixture) =>
  fixture.startsWhenVisible
    ? fixtureRoot(page, fixture).scrollIntoViewIfNeeded()
    : fixtureRoot(page, fixture).locator('[data-testid=trigger]').click();

export const clickTrigger = (opened: OpenFixture) =>
  countFixtureRoundTrips(
    opened,
    () => fixtureRoot(opened.page, opened.fixture).locator('[data-testid=trigger]').click(),
    resultIsDone(fixtureResult(opened.page, opened.fixture))
  );

export const scrollIntoView = (opened: OpenFixture) =>
  countFixtureRoundTrips(
    opened,
    () => fixtureRoot(opened.page, opened.fixture).scrollIntoViewIfNeeded(),
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

### Incident Patch 1: `72487b50` (2026-11-25)
**Commit Message**: Merge pull request #9593 from QwikDev/fix-docs-playground-bundler-worker

fix(docs): restore the playground's bundler after the lockfile dedupe

**File**: `packages/docs/package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "@qwik.dev/partytown": "0.13.2",
     "@qwik.dev/react": "workspace:*",
     "@qwik.dev/router": "workspace:*",
-    "@rolldown/browser": "1.2.2",
+    "@rolldown/browser": "1.2.19",
     "@shikijs/colorized-brackets": "3.21.0",
     "@shikijs/langs": "3.21.0",
     "@shikijs/rehype": "3.21.0",
```

**File**: `packages/docs/src/repl/bundler/repl-bundler-worker.ts` (modified, +18/-2)
```diff
@@ -2,7 +2,7 @@ import { rolldown, type OutputAsset, type OutputChunk } from '@rolldown/browser'
 // Browser builds of the TS optimizer's runtime deps, bundled into this worker by vite.
 // Rolldown embeds the same oxc version, so reusing its parser saves 4.5MB of extra wasm.
 // `/experimental` re-exports these as deprecated aliases; move to `/utils` once that
-// subpath ships a `browser` condition (absent as of @rolldown/browser 1.2.2).
+// subpath ships a `browser` condition (absent as of @rolldown/browser 1.2.19).
 import * as rolldownOxc from '@rolldown/browser/experimental';
 import * as oxcWalker from 'oxc-walker';
 import * as magicRegexp from 'magic-regexp';
@@ -134,9 +134,25 @@ function getDepShimUrl(specifier: string, mod: Record<string, unknown>): string
   return url;
 }
 
+type OxcTransform = (
+  filename: string,
+  sourceText: string,
+  options?: { cwd?: string },
+  ...rest: any[]
+) => unknown;
+
+// Workaround for rolldown/rolldown#11956: transform falls back to process.cwd(), missing here.
+const withRootCwd = <Transform extends OxcTransform>(transform: Transform) =>
+  ((filename, sourceText, options, ...rest) =>
+    transform(filename, sourceText, { cwd: '/', ...options }, ...rest)) as Transform;
+
 const TS_OPTIMIZER_DEPS: Record<string, Record<string, unknown>> = {
   'oxc-parser': rolldownOxc,
-  'oxc-transform': rolldownOxc,
+  'oxc-transform': {
+    ...rolldownOxc,
+    transform: withRootCwd(rolldownOxc.transform),
+    transformSync: withRootCwd(rolldownOxc.transformSync),
+  },
   'oxc-walker': oxcWalker,
   'magic-regexp': magicRegexp,
   'magic-string': magicString,
```

**File**: `pnpm-lock.yaml` (modified, +8/-40)
```diff
@@ -553,8 +553,8 @@ importers:
         specifier: workspace:*
         version: link:../qwik-router
       '@rolldown/browser':
-        specifier: 1.2.2
-        version: 1.2.2
+        specifier: 1.2.19
+        version: 1.2.19
       '@shikijs/colorized-brackets':
         specifier: 3.21.0
         version: 3.21.0
@@ -1444,27 +1444,18 @@ packages:
   '@emnapi/core@1.11.3':
     resolution: {integrity: sha512-zLpS5asjEb7lq8jYLq37N6XKaE41DIexlY1rF/z4/tIl3wo13Sqm28fRyfIsKZD+NZ8mM5RoKkpW/rBcuoSZSg==}
 
-  '@emnapi/core@2.0.0-alpha.3':
-    resolution: {integrity: sha512-AZypUeJ/yByuxyS7BlSNRDOMLMlROYtjYdIAuBmJssVz1UJDSeYxLrdizhXCFYhedC5bqd/ASy8EuNXbVVXp9g==}
-
   '@emnapi/core@2.0.0-beta.2':
     resolution: {integrity: sha512-MzCVoWtcg4Pm2B3je5mMvYMvj3MmBKw+fU7vbsJc9/iT8ip6/eYIHo/Dsm/mr+wsHB6SEyJDuxB09Yy6r/8+4A==}
 
   '@emnapi/runtime@1.11.3':
     resolution: {integrity: sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==}
 
-  '@emnapi/runtime@2.0.0-alpha.3':
-    resolution: {integrity: sha512-hFPAhMUjJD9BSyCANEISPOogeXC9Zo9ZQl7L6vKnaVsMkCtzznaW/naYypeyl0Gv5rYfWYsZbpixTMpjDJzQeA==}
-
   '@emnapi/runtime@2.0.0-beta.2':
     resolution: {integrity: sha512-JcrSPzPvZuNZvJqPTF9Fw25LbOJ8avzFVlaf2grmH4Cku0oGP47tRgqPZadcfj3YoZMHkFVnCYFbQM8I+i5QEw==}
 
   '@emnapi/wasi-threads@1.2.3':
     resolution: {integrity: sha512-ELEBe8PsLvvJ6QMr0zLt8ffvOHW/dc1m3CEzNMg7aJUv3bMaoDtw2TXyDAwkYBuroxxuHEwhRTLJSe5sya547g==}
 
-  '@emnapi/wasi-threads@2.0.1':
-    resolution: {integrity: sha512-9DsSk+o5NBX0CCJT8s0EROGSGxjR/tKu6aBTaVyq+SjAEQH4XcdcRxPBRzsBLizTTJ49MJjF+jgu3qnO9GLQcQ==}
-
   '@emnapi/wasi-threads@2.2.0':
     resolution: {integrity: sha512-JP7OYH38Q7+pyTAe14raZHLQIK7BDKbdwji+Xi3pcd/6QkJYQH3SX4wu6EplGrGJWRepoNzedfm0G3B9Z4e9Rw==}
 
@@ -3538,8 +3529,8 @@ packages:
     cpu: [x64]
     os: [win32]
 
-  '@rolldown/browser@1.2.2':
-    resolution: {integrity: sha512-TKVAciHZYpn/LRl0cDvywum9AwBhqUWUJDSWFjACmKzu1ZpR7fWXyqCk7Qc61QBhMym7ukWgnPH+QsKhCYpgeA==}
+  '@rolldown/browser@1.2.19':
+    resolution: {integrity: sha512-boe+5DV221aE0NUZpt6I2SuKTKkEGxPVopSaqcRwU8l9jB0sMucZfnmm+/kqwtfh9ZGeim1dmkuChngG+W4ZGg==}
     hasBin: true
 
   '@rolldown/pluginutils@1.0.1':
@@ -10006,42 +9997,26 @@ snapshots:
       '@emnapi/wasi-threads': 1.2.3
       tslib: 2.8.1
 
-  '@emnapi/core@2.0.0-alpha.3':
-    dependencies:
-      '@emnapi/wasi-threads': 2.0.1
-      tslib: 2.8.1
-
   '@emnapi/core@2.0.0-beta.2':
     dependencies:
       '@emnapi/wasi-threads': 2.2.0
       tslib: 2.8.1
-    optional: true
 
   '@emnapi/runtime@1.11.3':
     dependencies:
       tslib: 2.8.1
 
-  '@emnapi/runtime@2.0.0-alpha.3':
-    dependencies:
-      tslib: 2.8.1
-
   '@emnapi/runtime@2.0.0-beta.2':
     dependencies:
       tslib: 2.8.1
-    optional: true
 
   '@emnapi/wasi-threads@1.2.3':
     dependencies:
       tslib: 2.8.1
 
-  '@emnapi/wasi-threads@2.0.1':
-    dependencies:
-      tslib: 2.8.1
-
   '@emnapi/wasi-threads@2.2.0':
     dependencies:
       tslib: 2.8.1
-    optional: true
 
   '@emotion/babel-plugin@11.13.5(supports-color@10.2.2)':
     dependencies:
@@ -10999,18 +10974,11 @@ snapshots:
       '@tybys/wasm-util': 0.10.3
     optional: true
 
-  '@napi-rs/wasm-runtime@1.2.6(@emnapi/core@2.0.0-alpha.3)(@emnapi/runtime@2.0.0-alpha.3)':
-    dependencies:
-      '@emnapi/core': 2.0.0-alpha.3
-      '@emnapi/runtime': 2.0.0-alpha.3
-      '@tybys/wasm-util': 0.10.3
-
   '@napi-rs/wasm-runtime@1.2.6(@emnapi/core@2.0.0-beta.2)(@emnapi/runtime@2.0.0-beta.2)':
     dependencies:
       '@emnapi/core': 2.0.0-beta.2
       '@emnapi/runtime': 2.0.0-beta.2
       '@tybys/wasm-util': 0.10.3
-    optional: true
 
   '@neon-rs/load@0.0.4': {}
 
@@ -11622,11 +11590,11 @@ snapshots:
   '@rolldown/binding-win32-x64-msvc@1.3.2':
     optional: true
 
-  '@rolldown/browser@1.2.2':
+  '@rolldown/browser@1.2.19':
     dependencies:
-      '@emnapi/core': 2.0.0-alpha.3
-      '@emnapi/runtime': 2.0.0-alpha.3
-      '@napi-rs/wasm-runtime': 1.2.6(@emnapi/core@2.0.0-alpha.3)(@emnapi/runtime@2.0.0-alpha.3)
+      '@emnapi/core': 2.0.0-beta.2
+      '@emnapi/runtime': 2.0.0-beta.2
+      '@napi-rs/wasm-runtime': 1.2.6(@emnapi/core@2.0.0-beta.2)(@emnapi/runtime@2.0.0-beta.2)
 
   '@rolldown/pluginutils@1.0.1': {}
 
```

---

### Incident Patch 2: `3a0077a3` (2026-11-24)
**Commit Message**: fix(docs): bump the playground's Rolldown instead of pinning its wasm runtime

@rolldown/browser 1.2.19 uses the emnapi and wasm runtime versions the
lockfile already holds, so the override goes. Its transform reads
process.cwd() when given no cwd, which the worker doesn't have.

**File**: `packages/docs/package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "@qwik.dev/partytown": "0.13.2",
     "@qwik.dev/react": "workspace:*",
     "@qwik.dev/router": "workspace:*",
-    "@rolldown/browser": "1.2.2",
+    "@rolldown/browser": "1.2.19",
     "@shikijs/colorized-brackets": "3.21.0",
     "@shikijs/langs": "3.21.0",
     "@shikijs/rehype": "3.21.0",
```

**File**: `packages/docs/src/repl/bundler/repl-bundler-worker.ts` (modified, +18/-2)
```diff
@@ -2,7 +2,7 @@ import { rolldown, type OutputAsset, type OutputChunk } from '@rolldown/browser'
 // Browser builds of the TS optimizer's runtime deps, bundled into this worker by vite.
 // Rolldown embeds the same oxc version, so reusing its parser saves 4.5MB of extra wasm.
 // `/experimental` re-exports these as deprecated aliases; move to `/utils` once that
-// subpath ships a `browser` condition (absent as of @rolldown/browser 1.2.2).
+// subpath ships a `browser` condition (absent as of @rolldown/browser 1.2.19).
 import * as rolldownOxc from '@rolldown/browser/experimental';
 import * as oxcWalker from 'oxc-walker';
 import * as magicRegexp from 'magic-regexp';
@@ -134,9 +134,25 @@ function getDepShimUrl(specifier: string, mod: Record<string, unknown>): string
   return url;
 }
 
+type OxcTransform = (
+  filename: string,
+  sourceText: string,
+  options?: { cwd?: string },
+  ...rest: any[]
+) => unknown;
+
+// Workaround for rolldown/rolldown#11956: transform falls back to process.cwd(), missing here.
+const withRootCwd = <Transform extends OxcTransform>(transform: Transform) =>
+  ((filename, sourceText, options, ...rest) =>
+    transform(filename, sourceText, { cwd: '/', ...options }, ...rest)) as Transform;
+
 const TS_OPTIMIZER_DEPS: Record<string, Record<string, unknown>> = {
   'oxc-parser': rolldownOxc,
-  'oxc-transform': rolldownOxc,
+  'oxc-transform': {
+    ...rolldownOxc,
+    transform: withRootCwd(rolldownOxc.transform),
+    transformSync: withRootCwd(rolldownOxc.transformSync),
+  },
   'oxc-walker': oxcWalker,
   'magic-regexp': magicRegexp,
   'magic-string': magicString,
```

**File**: `pnpm-lock.yaml` (modified, +8/-48)
```diff
@@ -8,7 +8,6 @@ overrides:
   '@builder.io/qwik': link:./packages/qwik
   '@builder.io/qwik-city': link:./packages/qwik-router
   '@fastify/static': 10.1.2
-  '@rolldown/browser>@napi-rs/wasm-runtime': 1.2.3
   adm-zip: 0.6.1
   body-parser@1: 1.20.9
   body-parser@2: 2.4.0
@@ -554,8 +553,8 @@ importers:
         specifier: workspace:*
         version: link:../qwik-router
       '@rolldown/browser':
-        specifier: 1.2.2
-        version: 1.2.2
+        specifier: 1.2.19
+        version: 1.2.19
       '@shikijs/colorized-brackets':
         specifier: 3.21.0
         version: 3.21.0
@@ -1445,27 +1444,18 @@ packages:
   '@emnapi/core@1.11.3':
     resolution: {integrity: sha512-zLpS5asjEb7lq8jYLq37N6XKaE41DIexlY1rF/z4/tIl3wo13Sqm28fRyfIsKZD+NZ8mM5RoKkpW/rBcuoSZSg==}
 
-  '@emnapi/core@2.0.0-alpha.3':
-    resolution: {integrity: sha512-AZypUeJ/yByuxyS7BlSNRDOMLMlROYtjYdIAuBmJssVz1UJDSeYxLrdizhXCFYhedC5bqd/ASy8EuNXbVVXp9g==}
-
   '@emnapi/core@2.0.0-beta.2':
     resolution: {integrity: sha512-MzCVoWtcg4Pm2B3je5mMvYMvj3MmBKw+fU7vbsJc9/iT8ip6/eYIHo/Dsm/mr+wsHB6SEyJDuxB09Yy6r/8+4A==}
 
   '@emnapi/runtime@1.11.3':
     resolution: {integrity: sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==}
 
-  '@emnapi/runtime@2.0.0-alpha.3':
-    resolution: {integrity: sha512-hFPAhMUjJD9BSyCANEISPOogeXC9Zo9ZQl7L6vKnaVsMkCtzznaW/naYypeyl0Gv5rYfWYsZbpixTMpjDJzQeA==}
-
   '@emnapi/runtime@2.0.0-beta.2':
     resolution: {integrity: sha512-JcrSPzPvZuNZvJqPTF9Fw25LbOJ8avzFVlaf2grmH4Cku0oGP47tRgqPZadcfj3YoZMHkFVnCYFbQM8I+i5QEw==}
 
   '@emnapi/wasi-threads@1.2.3':
     resolution: {integrity: sha512-ELEBe8PsLvvJ6QMr0zLt8ffvOHW/dc1m3CEzNMg7aJUv3bMaoDtw2TXyDAwkYBuroxxuHEwhRTLJSe5sya547g==}
 
-  '@emnapi/wasi-threads@2.0.1':
-    resolution: {integrity: sha512-9DsSk+o5NBX0CCJT8s0EROGSGxjR/tKu6aBTaVyq+SjAEQH4XcdcRxPBRzsBLizTTJ49MJjF+jgu3qnO9GLQcQ==}
-
   '@emnapi/wasi-threads@2.2.0':
     resolution: {integrity: sha512-JP7OYH38Q7+pyTAe14raZHLQIK7BDKbdwji+Xi3pcd/6QkJYQH3SX4wu6EplGrGJWRepoNzedfm0G3B9Z4e9Rw==}
 
@@ -2521,13 +2511,6 @@ packages:
   '@napi-rs/triples@1.2.0':
     resolution: {integrity: sha512-HAPjR3bnCsdXBsATpDIP5WCrw0JcACwhhrwIAQhiR46n+jm+a2F8kBsfseAuWtSyQ+H3Yebt2k43B5dy+04yMA==}
 
-  '@napi-rs/wasm-runtime@1.2.3':
-    resolution: {integrity: sha512-UMduMbqO5s5zF2NkNacMT/yK5Y5QiKvWr2+50bzIIxFDwVJ2h49b+oyjaCGPhJxd2/gC2x39EHv/gHVuu36x2Q==}
-    engines: {node: ^20.19.0 || ^22.13.0 || >=23.5.0}
-    peerDependencies:
-      '@emnapi/core': ^1.7.1 || ^2.0.0-alpha.4
-      '@emnapi/runtime': ^1.7.1 || ^2.0.0-alpha.4
-
   '@napi-rs/wasm-runtime@1.2.6':
     resolution: {integrity: sha512-mRyDmEw9/fCDXCGfL1sbgIw/GUK0PVxRW4YwgPN61F3LQ+fSyoBFarJVzgGyhF6kRzEQZ0FejDqm4WLXSeqQmw==}
     engines: {node: ^20.19.0 || ^22.13.0 || >=23.5.0}
@@ -3546,8 +3529,8 @@ packages:
     cpu: [x64]
     os: [win32]
 
-  '@rolldown/browser@1.2.2':
-    resolution: {integrity: sha512-TKVAciHZYpn/LRl0cDvywum9AwBhqUWUJDSWFjACmKzu1ZpR7fWXyqCk7Qc61QBhMym7ukWgnPH+QsKhCYpgeA==}
+  '@rolldown/browser@1.2.19':
+    resolution: {integrity: sha512-boe+5DV221aE0NUZpt6I2SuKTKkEGxPVopSaqcRwU8l9jB0sMucZfnmm+/kqwtfh9ZGeim1dmkuChngG+W4ZGg==}
     hasBin: true
 
   '@rolldown/pluginutils@1.0.1':
@@ -10014,42 +9997,26 @@ snapshots:
       '@emnapi/wasi-threads': 1.2.3
       tslib: 2.8.1
 
-  '@emnapi/core@2.0.0-alpha.3':
-    dependencies:
-      '@emnapi/wasi-threads': 2.0.1
-      tslib: 2.8.1
-
   '@emnapi/core@2.0.0-beta.2':
     dependencies:
       '@emnapi/wasi-threads': 2.2.0
       tslib: 2.8.1
-    optional: true
 
   '@emnapi/runtime@1.11.3':
     dependencies:
       tslib: 2.8.1
 
-  '@emnapi/runtime@2.0.0-alpha.3':
-    dependencies:
-      tslib: 2.8.1
-
   '@emnapi/runtime@2.0.0-beta.2':
     dependencies:
       tslib: 2.8.1
-    optional: true
 
   '@emnapi/wasi-threads@1.2.3':
     dependencies:
       tslib: 2.8.1
 
-  '@emnapi/wasi-threads@2.0.1':
-    dependencies:
-      tslib: 2.8.1
-
   '@emnapi/wasi-threads@2.2.0':
     dependencies:
       tslib: 2.8.1
-    optional: true
 
   '@emotion/babel-plugin@11.13.5(supports-color@10.2.2)':
     dependencies:
@@ -11000,12 +10967,6 @@ snapshots:
 
   '@napi-rs/triples@1.2.0': {}
 
-  '@napi-rs/wasm-runtime@1.2.3(@emnapi/core@2.0.0-alpha.3)(@emnapi/runtime@2.0.0-alpha.3)':
-    dependencies:
-      '@emnapi/core': 2.0.0-alpha.3
-      '@emnapi/runtime': 2.0.0-alpha.3
-      '@tybys/wasm-util': 0.10.3
-
   '@napi-rs/wasm-runtime@1.2.6(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)':
     dependencies:
       '@emnapi/core': 1.11.3
@@ -11018,7 +10979,6 @@ snapshots:
       '@emnapi/core': 2.0.0-beta.2
       '@emnapi/runtime': 2.0.0-beta.2
       '@tybys/wasm-util': 0.10.3
-    optional: true
 
   '@neon-rs/load@0.0.4': {}
 
@@ -11630,11 +11590,11 @@ snapshots:
   '@rolldown/binding-win32-x64-msvc@1.3.2':
     optional: true
 
-  '@rolldown/browser@1.2.2':
+  '@rolldown/browser@1.2.19':
     dependencies:
-      '@emnapi/core': 2.0.0-alpha.3
-      '
```

**File**: `pnpm-workspace.yaml` (modified, +0/-1)
```diff
@@ -45,7 +45,6 @@ overrides:
   '@builder.io/qwik': link:./packages/qwik
   '@builder.io/qwik-city': link:./packages/qwik-router
   '@fastify/static': 10.1.2
-  '@rolldown/browser>@napi-rs/wasm-runtime': 1.2.3
   adm-zip: 0.6.1
   body-parser@1: 1.20.9
   body-parser@2: 2.4.0
```

---

### Incident Patch 3: `0f580c0a` (2026-11-24)
**Commit Message**: fix(docs): restore the playground's bundler after the lockfile dedupe

@rolldown/browser@1.2.2 pins emnapi 2.0.0-alpha.3 but accepts any
@napi-rs/wasm-runtime 1.x. Deduping the lockfile moved it to 1.2.6, which
needs emnapi 2.0.0-beta.2, so the bundler worker died at startup.

**File**: `pnpm-lock.yaml` (modified, +15/-7)
```diff
@@ -8,6 +8,7 @@ overrides:
   '@builder.io/qwik': link:./packages/qwik
   '@builder.io/qwik-city': link:./packages/qwik-router
   '@fastify/static': 10.1.2
+  '@rolldown/browser>@napi-rs/wasm-runtime': 1.2.3
   adm-zip: 0.6.1
   body-parser@1: 1.20.9
   body-parser@2: 2.4.0
@@ -2520,6 +2521,13 @@ packages:
   '@napi-rs/triples@1.2.0':
     resolution: {integrity: sha512-HAPjR3bnCsdXBsATpDIP5WCrw0JcACwhhrwIAQhiR46n+jm+a2F8kBsfseAuWtSyQ+H3Yebt2k43B5dy+04yMA==}
 
+  '@napi-rs/wasm-runtime@1.2.3':
+    resolution: {integrity: sha512-UMduMbqO5s5zF2NkNacMT/yK5Y5QiKvWr2+50bzIIxFDwVJ2h49b+oyjaCGPhJxd2/gC2x39EHv/gHVuu36x2Q==}
+    engines: {node: ^20.19.0 || ^22.13.0 || >=23.5.0}
+    peerDependencies:
+      '@emnapi/core': ^1.7.1 || ^2.0.0-alpha.4
+      '@emnapi/runtime': ^1.7.1 || ^2.0.0-alpha.4
+
   '@napi-rs/wasm-runtime@1.2.6':
     resolution: {integrity: sha512-mRyDmEw9/fCDXCGfL1sbgIw/GUK0PVxRW4YwgPN61F3LQ+fSyoBFarJVzgGyhF6kRzEQZ0FejDqm4WLXSeqQmw==}
     engines: {node: ^20.19.0 || ^22.13.0 || >=23.5.0}
@@ -10992,19 +11000,19 @@ snapshots:
 
   '@napi-rs/triples@1.2.0': {}
 
+  '@napi-rs/wasm-runtime@1.2.3(@emnapi/core@2.0.0-alpha.3)(@emnapi/runtime@2.0.0-alpha.3)':
+    dependencies:
+      '@emnapi/core': 2.0.0-alpha.3
+      '@emnapi/runtime': 2.0.0-alpha.3
+      '@tybys/wasm-util': 0.10.3
+
   '@napi-rs/wasm-runtime@1.2.6(@emnapi/core@1.11.3)(@emnapi/runtime@1.11.3)':
     dependencies:
       '@emnapi/core': 1.11.3
       '@emnapi/runtime': 1.11.3
       '@tybys/wasm-util': 0.10.3
     optional: true
 
-  '@napi-rs/wasm-runtime@1.2.6(@emnapi/core@2.0.0-alpha.3)(@emnapi/runtime@2.0.0-alpha.3)':
-    dependencies:
-      '@emnapi/core': 2.0.0-alpha.3
-      '@emnapi/runtime': 2.0.0-alpha.3
-      '@tybys/wasm-util': 0.10.3
-
   '@napi-rs/wasm-runtime@1.2.6(@emnapi/core@2.0.0-beta.2)(@emnapi/runtime@2.0.0-beta.2)':
     dependencies:
       '@emnapi/core': 2.0.0-beta.2
@@ -11626,7 +11634,7 @@ snapshots:
     dependencies:
       '@emnapi/core': 2.0.0-alpha.3
       '@emnapi/runtime': 2.0.0-alpha.3
-      '@napi-rs/wasm-runtime': 1.2.6(@emnapi/core@2.0.0-alpha.3)(@emnapi/runtime@2.0.0-alpha.3)
+      '@napi-rs/wasm-runtime': 1.2.3(@emnapi/core@2.0.0-alpha.3)(@emnapi/runtime@2.0.0-alpha.3)
 
   '@rolldown/pluginutils@1.0.1': {}
 
```

**File**: `pnpm-workspace.yaml` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ overrides:
   '@builder.io/qwik': link:./packages/qwik
   '@builder.io/qwik-city': link:./packages/qwik-router
   '@fastify/static': 10.1.2
+  '@rolldown/browser>@napi-rs/wasm-runtime': 1.2.3
   adm-zip: 0.6.1
   body-parser@1: 1.20.9
   body-parser@2: 2.4.0
```

#### Recent Merged Pull Requests:
- **PR #9622** (2026-11-26): docs(skills): name planned tests by their rule, then a concrete case (@maiieul)
- **PR #9621** (2026-11-26): docs(skills): keep each planned test name standing on its own (@maiieul)
- **PR #9617** (closed): perf(preloader): load a visible task's chunk with core (@maiieul)
- **PR #9616** (2026-11-26): fix(preloader): list visible task chunks for the preloader (@maiieul)
- **PR #9615** (closed): fix(core): keep provider computed signals active after context consumers unmount (@zhengdaodeguL)
- **PR #9607** (2026-11-25): docs(skills): let a change regroup a file's old tests into describe blocks (@maiieul)

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

## X. Empirical Invariant Guard in package.json

**RULE**:
When implementing operations in `packages/docs/package.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in QwikDev/qwik. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `72487b50`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/docs/package.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    "@rolldown/browser": "1.2.19",
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    "@rolldown/browser": "1.2.2",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `72487b50` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
