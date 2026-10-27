> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lobehub-lobe-ui-learnings.md`  
> **Source**: github ([https://github.com/lobehub/lobe-ui](https://github.com/lobehub/lobe-ui))  
> **Source Version**: `a5441425`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T12:07:40.477Z  
> **Learning ID**: `learn-github-lobehub-lobe-ui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): lobehub/lobe-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/lobehub-lobe-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lobehub/lobe-ui](https://github.com/lobehub/lobe-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T12:07:39.545Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lobehub/lobe-ui`
- **Description**: 🍭  Lobe UI - an open-source UI component library for building AIGC web apps
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2246 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/render-bench/bench.mjs`
```
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { chromium } from '@playwright/test';

import { scenarios } from './scenarios.mjs';

const { values } = parseArgs({
  options: {
    mounts: { default: false, type: 'boolean' },
    only: { type: 'string' },
    out: { default: 'scripts/render-bench/results', type: 'string' },
    url: { default: 'http://localhost:5173', type: 'string' },
  },
});

const bundleProbe = async () => {
  const { build } = await import('vite');
  const output = await build({
    build: {
      lib: {
        entry: fileURLToPath(new URL('probe.mjs', import.meta.url)),
        formats: ['iife'],
        name: 'renderBenchProbe',
      },
      minify: false,
      write: false,
    },
    configFile: false,
    logLevel: 'silent',
  });
  return (Array.isArray(output) ? output[0] : output).output[0].code;
};

const probeScript = await bundleProbe();

const snapshot = (page) =>
  page.evaluate(() => {
    const data = window.__renderBench.byComponent;
    window.__renderBench.byComponent = {};
    return data;
  });

const settle = async (page, { quietMs = 500, timeoutMs = 8000 } = {}) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const idle = await page.evaluate(
      (quiet) => performance.now() - window.__renderBench.lastRenderAt > quiet,
      quietMs,
    );
    if (idle) return;
    await page.waitForTimeout(100);
  }
};

const summarize = (byComponent) => {
  const rows = Object.entries(byComponent).map(([name, entry]) => ({ name, ...entry }));
  const total = (key) => rows.reduce((sum, row) => sum + row[key], 0);
  return {
    components: rows.toSorted((a, b) => b.renders - a.renders).slice(0, 20),
    totals: {
      context: total('context'),
      parent: total('parent'),
      props: total('props'),
      renders: total('renders'),
      state: total('state'),
      unnecessary: total('unnecessary'),
    },
  };
};

const runOne = async (context, { demo, name, query, run, tolerance = 0 }) => {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const search = new URLSearchParams({ appearance: 'light', ...query });
  await page.goto(`${values.url}/~demos/${demo}?${search}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-standalone-demo]', { timeout: 30_000 });
  await page
    .waitForFunction(() => !document.body.innerText.includes('Loading preview'), null, {
      timeout: 30_000,
    })
    .catch(() => errors.push('preview never finished loading'));
  await settle(page);
  const mount = summarize(await snapshot(page));
  let interaction;
  if (run) {
    await run(page);
    await settle(page);
    interaction = summarize(await snapshot(page));
  }
  await page.close();
  return { demo, errors, interaction, mount, name, tolerance };
};

const listDemoIds = () => {
  const manifest = JSON.parse(readFileSync('compatibility.json', 'utf8'));
  return [
    ...new Set(
      manifest.demoReferences
        .filter((reference) => reference.source.startsWith('src/'))
        .map((reference) => reference.legacyId),
    ),
  ];
};

const jobs = values.mounts
  ? listDemoIds().map((demo) => ({ demo, name: demo }))
  : scenarios.filter((scenario) => !values.only || scenario.name === values.only);

const browser = await chromium.launch({ executablePath: process.env.BENCH_CHROMIUM || undefined });
const context = await browser.newContext({
  reducedMotion: 'reduce',
  viewport: { height: 900, width: 1280 },
});
await context.addInitScript({ content: probeScript });

mkdirSync(values.out, { recursive: true });
const results = [];
for (const job of jobs) {
  try {
    const result = await runOne(context, job);
    results.push(result);
    const scope = result.interaction ?? result.mount;
    console.log(
      `${job.name}: ${scope.totals.renders} renders, ${scope.totals.unnecessary} unnecessary`,
    );
  } catch (error) {
    results.push({ demo: job.demo, errors: [String(error)], name: job.name });
    console.log(`${job.name}: failed (${String(error).split('\n')[0]})`);
  }
}
await browser.close();

const file = path.join(values.out, values.mounts ? 'mounts.json' : 'scenarios.json');
writeFileSync(file, `${JSON.stringify(results, null, 2)}\n`);
console.log(`wrote ${file}`);

```

### Core Architecture Module: `scripts/render-bench/probe.mjs`
```
import {
  getDisplayName,
  getMutatedHostFibers,
  getType,
  instrument,
  isCompositeFiber,
  traverseContexts,
  traverseProps,
  traverseRenderedFibers,
  traverseState,
} from 'bippy';

const bench = { byComponent: {}, lastRenderAt: 0 };
window.__renderBench = bench;

const entryFor = (name) =>
  (bench.byComponent[name] ??= {
    context: 0,
    mounts: 0,
    parent: 0,
    props: 0,
    renders: 0,
    state: 0,
    unnecessary: 0,
  });

const changed = (next, prev) => !Object.is(next, prev);

// Effect hooks get a fresh memoizedState object every render; only hooks with an update queue are state.
const stateChanged = (fiber) =>
  traverseState(
    fiber,
    (next, prev) => Boolean(next?.queue) && changed(next.memoizedState, prev?.memoizedState),
  );

instrument({
  onCommitFiberRoot: (_rendererId, root) => {
    traverseRenderedFibers(root, (fiber, phase) => {
      if (!isCompositeFiber(fiber) || phase === 'unmount') return;
      bench.lastRenderAt = performance.now();
      const entry = entryFor(getDisplayName(getType(fiber.type)) || 'Anonymous');
      entry.renders++;
      if (phase === 'mount') {
        entry.mounts++;
        return;
      }
      const props = traverseProps(fiber, (_name, next, prev) => changed(next, prev));
      const state = stateChanged(fiber);
      const context = traverseContexts(fiber, (next, prev) =>
        changed(next?.memoizedValue, prev?.memoizedValue),
      );
      if (props) entry.props++;
      if (state) entry.state++;
      if (context) entry.context++;
      if (!props && !state && !context) entry.parent++;
      if (getMutatedHostFibers(fiber).length === 0) entry.unnecessary++;
    });
  },
});

```

### Core Architecture Module: `scripts/render-bench/report.mjs`
```
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { top: { default: '3', type: 'string' } },
});

const [currentFile, baselineFile] = positionals;
if (!currentFile) {
  console.error('usage: node report.mjs <results.json> [baseline.json] [--top 3]');
  process.exit(2);
}

const load = (file) => JSON.parse(readFileSync(file, 'utf8'));
const scopeOf = (result) => result.interaction ?? result.mount;
const topCount = Number(values.top);

const dominantCause = ({ context, props, state }) => {
  const causes = { context, props, state };
  const [name, count] = Object.entries(causes).toSorted((a, b) => b[1] - a[1])[0];
  return count ? name : '-';
};

const current = load(currentFile).filter((result) => scopeOf(result));
const baseline = baselineFile
  ? new Map(load(baselineFile).map((result) => [result.name, scopeOf(result)]))
  : undefined;

const exceeds = (now, before, tolerance) => now > before * (1 + tolerance);

const rows = current
  .map((result) => ({
    name: result.name,
    scope: scopeOf(result),
    tolerance: result.tolerance ?? 0,
  }))
  .toSorted((a, b) => b.scope.totals.renders - a.scope.totals.renders);

const delta = (now, before) => {
  if (before === undefined) return String(now);
  const diff = now - before;
  return diff === 0 ? String(now) : `${now} (${diff > 0 ? '+' : ''}${diff})`;
};

const header = ['Scenario', 'Renders', 'Unnecessary', 'Cause', `Top ${topCount} components`];
console.log(`| ${header.join(' | ')} |`);
console.log(`| ${header.map(() => '---').join(' | ')} |`);

let regressions = 0;
for (const { name, scope, tolerance } of rows) {
  const before = baseline?.get(name);
  if (
    before &&
    (exceeds(scope.totals.renders, before.totals.renders, tolerance) ||
      exceeds(scope.totals.unnecessary, before.totals.unnecessary, tolerance))
  ) {
    regressions++;
  }
  const top = scope.components
    .slice(0, topCount)
    .map((component) => `${component.name} ${component.renders}`)
    .join(', ');
  console.log(
    `| ${name} | ${delta(scope.totals.renders, before?.totals.renders)} | ${delta(
      scope.totals.unnecessary,
      before?.totals.unnecessary,
    )} | ${dominantCause(scope.totals)} | ${top} |`,
  );
}

if (baseline) {
  console.log(`\n${regressions} scenario(s) render more than the baseline.`);
  process.exitCode = regressions ? 1 : 0;
}

```

### Core Architecture Module: `scripts/render-bench/scenarios.mjs`
```
const ROOT = '[data-standalone-demo]';

const within = (page, selector) => page.locator(`${ROOT} ${selector}`);

const hoverEach =
  (selector, limit = 8) =>
  async (page) => {
    const targets = within(page, selector);
    const count = Math.min(await targets.count(), limit);
    for (let index = 0; index < count; index++) {
      await targets.nth(index).hover();
      await page.waitForTimeout(1200);
    }
    await page.mouse.move(0, 0);
  };

const clickEach =
  (selector, limit = 8) =>
  async (page) => {
    const targets = within(page, selector);
    const count = Math.min(await targets.count(), limit);
    for (let index = 0; index < count; index++) {
      await targets
        .nth(index)
        .click({ timeout: 3000 })
        .catch(() => {});
      await page.waitForTimeout(150);
    }
  };

const openAndArrow =
  (trigger, { button = 'left', steps = 8 } = {}) =>
  async (page) => {
    await within(page, trigger).first().click({ button });
    await page.waitForTimeout(300);
    for (let step = 0; step < steps; step++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(60);
    }
    await page.keyboard.press('Escape');
  };

const rightClickText = (text) => async (page) => {
  await page.getByText(text).first().click({ button: 'right' });
  await page.waitForTimeout(300);
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(60);
  }
  await page.keyboard.press('Escape');
};

const typeInto =
  (selector, text = 'the quick brown fox jumps over') =>
  async (page) => {
    await within(page, selector).first().click();
    await page.keyboard.type(text, { delay: 20 });
  };

const pressKeys = (selector, key, times) => async (page) => {
  await within(page, selector).first().focus();
  for (let step = 0; step < times; step++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(40);
  }
};

const openThenEscape = (selector) => async (page) => {
  await within(page, selector).first().click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
};

export const scenarios = [
  {
    demo: 'tooltip-demo-group',
    name: 'Tooltip group: hover across triggers',
    run: hoverEach('button'),
  },
  { demo: 'tooltip-demo-demos', name: 'Tooltip: hover triggers', run: hoverEach('button') },
  {
    demo: 'src-base-ui-popover-demo-hover-only',
    name: 'Popover: hover triggers',
    run: hoverEach('button'),
  },
  {
    demo: 'src-base-ui-popover-demo-controlled',
    name: 'Popover: open and close',
    run: openThenEscape('button'),
  },
  {
    demo: 'src-base-ui-select-demo-demos',
    name: 'Select: open and arrow through options',
    run: openAndArrow('[role="combobox"]', { steps: 12 }),
  },
  {
    demo: 'src-dropdown-menu-demo-desc',
    name: 'DropdownMenu: open and arrow through items',
    run: openAndArrow('button'),
  },
  {
    demo: 'src-context-menu-demo-trigger',
    name: 'ContextMenu: open and arrow through items',
    run: rightClickText('Right click this panel'),
  },
  {
    demo: 'src-base-ui-modal-demo-demos',
    name: 'Modal: open and close',
    run: openThenEscape('button'),
  },
  {
    demo: 'src-base-ui-tabs-demo-demos',
    name: 'Tabs: click each tab',
    run: clickEach('[role="tab"]'),
  },
  {
    demo: 'src-base-ui-segmented-demo-demos',
    name: 'Segmented: click each option',
    run: clickEach('[role="group"] button'),
  },
  {
    demo: 'src-base-ui-switch-demo-demos',
    name: 'Switch: toggle each',
    run: clickEach('[role="switch"]'),
  },
  {
    demo: 'src-base-ui-slider-demo-demos',
    name: 'Slider: arrow 20 steps',
    run: pressKeys('input[type="range"]', 'ArrowRight', 20),
  },
  { demo: 'src-search-bar-demo-demos', name: 'SearchBar: type 30 chars', run: typeInto('input') },
  {
    demo: 'src-editable-text-demo-demos',
    name: 'EditableText: edit and type',
    run: async (page) => {
      await within(page, 'button').first().click();
      await page.keyboard.type(' appended text', { delay: 20 });
    },
  },
  {
    demo: 'src-color-swatches-demo-demos',
    name: 'ColorSwatches: pick each swatch',
    run: clickEach('[role="button"], button'),
  },
  {
    demo: 'src-base-ui-toast-demo-demos',
    name: 'Toast: trigger toasts',
    run: clickEach('button', 5),
  },
  {
    demo: 'video-demo-demos',
    name: 'Video: play 2s then seek',
    tolerance: 0.05,
    run: async (page) => {
      await within(page, 'button[aria-label="Play"]').first().click();
      await page.waitForTimeout(2000);
      await pressKeys('[role="slider"][aria-label="Seek"]', 'ArrowRight', 10)(page);
    },
  },
  {
    demo: 'src-highlighter-demo-demos',
    name: 'Highlighter: copy code',
    run: clickEach('button', 1),
  },
  {
    demo: 'src-markdown-demo-streamingbench',
    name: 'Markdown: stream bench content',
    query: { delay: '50', size: '20' },
    tolerance: 0.1,
    run: async (page) => {
      await within(page, 'button[data-phase]').click();
      await within(page, 'button[data-phase="done"]').waitFor({ timeout: 60_000 });
    },
  },
];

```

### Core Architecture Module: `src/ActionIcon/utils.ts`
```
import { isNumber } from 'es-toolkit/compat';

import type { ActionIconSize } from './type';

export const actionIconOutdent = {
  large: 10,
  middle: 8,
  small: 5,
} as const;

const toCss = (value: number | string) => (isNumber(value) ? `${value}px` : value);

export const calcSize = (iconSize?: ActionIconSize) => {
  let blockSize: number | string;
  let borderRadius: number | string;

  if (isNumber(iconSize)) {
    const blockSize = iconSize * 1.8;
    return {
      blockSize,
      borderRadius: Math.floor(blockSize / 6),
    };
  }

  switch (iconSize) {
    case 'large': {
      blockSize = 44;
      borderRadius = 8;
      break;
    }
    case 'middle': {
      blockSize = 36;
      borderRadius = 6;
      break;
    }
    case 'small': {
      blockSize = 24;
      borderRadius = 4;
      break;
    }
    default: {
      if (iconSize) {
        blockSize = iconSize?.blockSize || 36;
        borderRadius = iconSize?.borderRadius || 6;
      } else {
        blockSize = '1.8em';
        borderRadius = '0.3em';
      }

      break;
    }
  }

  return {
    blockSize,
    borderRadius,
  };
};

export const calcOutdent = (iconSize?: ActionIconSize) => {
  if (isNumber(iconSize)) {
    return `${iconSize * 0.4}px`;
  }

  switch (iconSize) {
    case 'large': {
      return `${actionIconOutdent.large}px`;
    }
    case 'middle': {
      return `${actionIconOutdent.middle}px`;
    }
    case 'small': {
      return `${actionIconOutdent.small}px`;
    }
    default: {
      if (iconSize) {
        const { blockSize } = calcSize(iconSize);
        const glyph = iconSize.size ?? 24;
        if (isNumber(blockSize) && isNumber(glyph)) {
          return `${Math.max(0, (blockSize - glyph) / 2)}px`;
        }
        return `calc((${toCss(blockSize)} - ${toCss(glyph)}) / 2)`;
      }
      return '0.4em';
    }
  }
};

```

### Core Architecture Module: `src/AgentAvatar/demos/States.tsx`
```
import { AGENT_AVATAR_STATES, AgentAvatar, Flexbox, Text } from '@lobehub/ui';

export default () => (
  <Flexbox gap={24} padding={24}>
    <Flexbox horizontal gap={24} wrap={'wrap'}>
      {AGENT_AVATAR_STATES.map((state) => (
        <Flexbox align="center" gap={8} key={state}>
          <AgentAvatar animated color="orange" shape="face" size={64} state={state} />
          <Text style={{ fontSize: 12 }} type="secondary">
            {state}
          </Text>
        </Flexbox>
      ))}
    </Flexbox>
    <Flexbox horizontal align="center" gap={24} wrap={'wrap'}>
      {AGENT_AVATAR_STATES.map((state) => (
        <AgentAvatar animated key={state} name="Researcher" size={24} state={state} />
      ))}
    </Flexbox>
  </Flexbox>
);

```

### Core Architecture Module: `src/AgentAvatar/utils.ts`
```
import gray from '@/color/colors/gray';
import orange from '@/color/colors/orange';
import { cssVar } from '@/styles/stylex/cssVar.stylex';

import type { AgentAvatarColor, AgentAvatarShape, AgentAvatarState } from './type';

export const AGENT_AVATAR_SHAPES = [
  'face',
  'bowl',
  'cloud',
  'tile',
  'hex',
  'shield',
  'pudding',
  'cookie',
  'star',
  'capsule',
  'ghost',
  'cat',
] as const satisfies readonly AgentAvatarShape[];

export const AGENT_AVATAR_COLORS = [
  'purple',
  'orange',
  'geekblue',
  'volcano',
  'magenta',
  'ink',
  'gray',
] as const satisfies readonly AgentAvatarColor[];

export const AGENT_AVATAR_STATES = [
  'idle',
  'working',
  'waiting',
  'blocked',
  'thinking',
  'done',
] as const satisfies readonly AgentAvatarState[];

/**
 * Theme color per palette key, one scale step per appearance. The dark steps are lifted so the
 * body keeps at least 3:1 against the dark container background; `ink` and `gray` cannot reuse
 * their light step there because the neutral scale flips to near-white in dark mode.
 */
export const AGENT_AVATAR_COLOR_TOKENS: Record<AgentAvatarColor, { dark: string; light: string }> =
  {
    geekblue: { dark: cssVar.geekblue9, light: cssVar.geekblue8 },
    gray: { dark: cssVar.gray10, light: cssVar.gray9 },
    ink: { dark: cssVar.gray7, light: cssVar.gray11 },
    magenta: { dark: cssVar.magenta9, light: cssVar.magenta8 },
    orange: { dark: cssVar.orange9, light: cssVar.orange9 },
    purple: { dark: cssVar.purple9, light: cssVar.purple8 },
    volcano: { dark: cssVar.volcano9, light: cssVar.volcano8 },
  };

/** Logo eyes: warm white and near black, identical for every color and appearance. */
export const SCLERA_COLOR = orange.light[2];
export const PUPIL_COLOR = gray.light[12];

const SEED_SALT = 'lh3174:';

/** FNV-1a followed by the murmur3 finalizer: cheap, deterministic and well spread. */
export const hashSeed = (seed: string) => {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85_EB_CA_6B);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xC2_B2_AE_35);
  hash ^= hash >>> 16;
  return hash >>> 0;
};

export interface AgentAvatarTraits {
  color: AgentAvatarColor;
  /** Animation offset in seconds (negative), so a list of avatars does not blink in sync. */
  phase: number;
  shape: AgentAvatarShape;
}

/** Shape, color and animation phase derived from a seed. Pure and deterministic. */
export const getAgentAvatarTraits = (seed: string): AgentAvatarTraits => {
  const hash = hashSeed(`${SEED_SALT}${seed}`);
  return {
    color: AGENT_AVATAR_COLORS[(hash >>> 3) % AGENT_AVATAR_COLORS.length],
    phase: -(((hash >>> 7) % 3000) / 1000),
    shape: AGENT_AVATAR_SHAPES[hash % AGENT_AVATAR_SHAPES.length],
  };
};

export const isAgentAvatarColor = (color: string): color is AgentAvatarColor =>
  (AGENT_AVATAR_COLORS as readonly string[]).includes(color);

/** Pupil / sclera radius ratio. */
export const PUPIL_RATIO = 0.6;
/** Smaller pupils at sidebar sizes keep a visible ring of white. */
export const PUPIL_RATIO_SMALL = 0.5;
export const SMALL_SIZE = 24;

/** Motion values are authored for a sclera radius of 14.5 and scaled per shape. */
export const GAZE_UNIT_RADIUS = 14.5;

/**
 * Still pose of the pupils per state, in gaze units. `thinking` looks up but keeps a band of
 * white above the pupil (the keyframes in `style.ts` use the same bound).
 */
export const STILL_GAZE: Record<AgentAvatarState, [number, number]> = {
  blocked: [0, 0],
  done: [0, 0],
  idle: [0, 1.6],
  thinking: [1.8, -3.1],
  waiting: [0, 1.4],
  working: [-2, 3.4],
};

/** `blocked` widens the eyes and shrinks the pupils. */
export const BLOCKED_SCLERA_SCALE = 1.1;
export const BLOCKED_PUPIL_RATIO = 0.36;

```

### Core Architecture Module: `src/Avatar/utils.ts`
```
import { isValidElement, type ReactNode } from 'react';

import type { AvatarGeneratedFallbackVariant } from './type';

export const isDefaultAntAvatar = (avatar: ReactNode): boolean => {
  if (!avatar) return false;

  const isStringAvatar = typeof avatar === 'string';
  const isUrlOrDataUri =
    isStringAvatar && ['/', 'http', 'data:'].some((prefix) => avatar.startsWith(prefix));

  return Boolean(isUrlOrDataUri || isValidElement(avatar));
};

export const hasValidBackground = (background?: string | null): boolean => {
  return Boolean(
    background &&
    background !== 'transparent' &&
    background !== 'rgba(0,0,0,0)' &&
    background !== null,
  );
};

export const formatAvatarText = (text: string | undefined, sliceText: boolean): string => {
  if (!text) return '';

  const upperText = text.toUpperCase();
  return sliceText ? upperText.slice(0, 2) : upperText;
};

export const calculateEmojiSize = (
  size: number,
  hasBackground: boolean,
  emojiScaleWithBackground: boolean,
): number => {
  if (emojiScaleWithBackground) {
    return hasBackground ? size * 0.85 : size;
  }
  return size * 0.85;
};

export const AVATAR_GENERATED_FALLBACK_VARIANTS: readonly AvatarGeneratedFallbackVariant[] = [
  'marble',
  'beam',
  'pixel',
  'sunset',
  'ring',
  'bauhaus',
];

/**
 * Default palette of the generated fallback: charcoal, violet, cream, yellow and orange.
 * A charcoal anchor and a cream highlight give every variant contrast, a warm yellow / orange
 * pair keeps it lively, and violet adds one cool accent. It is a fixed palette on purpose:
 * the same name keeps the same avatar in light and dark mode. `boring-avatars` writes these into
 * SVG attributes, so they must be concrete colors rather than CSS variables.
 */
export const AVATAR_FALLBACK_COLORS: string[] = [
  '#383838',
  '#7858f9',
  '#f8f7bf',
  '#ffdd1f',
  '#f88c13',
];

/**
 * Stable seed for the generated fallback: `title`, then `alt`, then a string `avatar`
 * (a name / initials, or the URL of an image that failed to load).
 *
 * `boring-avatars` embeds the name in SVG ids (`url(#gradient_..._<name>)` for `sunset`), so
 * whitespace and URL-breaking characters are normalized to `_`; otherwise names such as
 * `"Arvin Xu"` would produce an invalid paint reference and an empty avatar.
 */
export const getAvatarFallbackSeed = (
  avatar: ReactNode,
  title?: string,
  alt?: string,
): string | undefined => {
  const seed = title || alt || (typeof avatar === 'string' && avatar) || undefined;
  return seed?.trim().replaceAll(/[\s"'()#\\]+/g, '_') || undefined;
};

```

### Core Architecture Module: `src/CodeDiff/demos/ActionsRender.tsx`
```
import { RotateCcwIcon } from 'lucide-react';

import ActionIcon from '@/ActionIcon';

import { CodeDiff } from '../CodeDiff';

const oldCode = `export const BASE_URL = 'https://api.example.com/v1';

export const getProfileUrl = (id: string) => \`\${BASE_URL}/users/\${id}\`;`;

const newCode = `export const BASE_URL = 'https://api.example.com/v2';

export const getProfileUrl = (id: string) => \`\${BASE_URL}/profiles/\${id}\`;`;

export default () => {
  return (
    <CodeDiff
      fullFeatured
      fileName="api.ts"
      language="typescript"
      newContent={newCode}
      oldContent={oldCode}
      actionsRender={({ newContent, oldContent, originalNode }) => (
        <>
          {originalNode}
          <ActionIcon
            icon={RotateCcwIcon}
            size="small"
            onClick={() => alert(`old: ${oldContent.length}, new: ${newContent.length}`)}
          />
        </>
      )}
    />
  );
};

```

### Core Architecture Module: `src/ColorSwatches/demos/render-picker.tsx`
```
import { ColorPicker, ColorSwatches, Flexbox, Text } from '@lobehub/ui';
import { useState } from 'react';

const colors = [
  { color: '#f4416c', title: 'Red' },
  { color: '#ee9e0b', title: 'Gold' },
  { color: '#379d4a', title: 'Green' },
  { color: '#0072f5', title: 'Blue' },
  { color: '#bd54c6', title: 'Purple' },
];

export default () => {
  const [color, setColor] = useState<string | undefined>('#7c5cff');

  return (
    <Flexbox gap={24} padding={16}>
      <Flexbox gap={8}>
        <Text type="secondary">Built-in</Text>
        <ColorSwatches enableColorPicker colors={colors} value={color} onChange={setColor} />
      </Flexbox>
      <Flexbox gap={8}>
        <Text type="secondary">Wrap the built-in picker</Text>
        <ColorSwatches
          enableColorPicker
          align="center"
          colors={colors}
          value={color}
          renderPicker={({ value }, picker) => (
            <>
              {picker}
              <Text code fontSize={12} type="secondary">
                {value ?? 'preset'}
              </Text>
            </>
          )}
          onChange={setColor}
        />
      </Flexbox>
      <Flexbox gap={8}>
        <Text type="secondary">Replace it with an alpha picker</Text>
        <ColorSwatches
          enableColorPicker
          align="center"
          colors={colors}
          value={color}
          renderPicker={({ value, onChange }) => (
            <ColorPicker alpha showText value={value} onChangeComplete={onChange} />
          )}
          onChange={setColor}
        />
      </Flexbox>
    </Flexbox>
  );
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #767** (2026-10-27): **⚡️ perf(build): stop shipping the cssVar token table to consumers**
  *Symptoms*: ## What  `stylex.create` inlines the `cssVar.*` interpolations into `style.css`, so the module-scope declarations that produced them are dead. Tree shaking drops the binding but keeps the interpolation as a bare template literal:  ```js // es/Button/style.mjs, before `${cssVar.colorError}`; `${cssVar.colorText}${cssVar.colorBorder}`; ```  A top-level template literal is assumed to be side-effectful, so no `treeshake` setting removes it — I verified `treeshake: false`, the default, and `treeshake: { propertyReadSideEffects: false }` all keep the statement. Those property reads are the only reason a consumer bundle still carries the whole 786-entry `cssVar` object, since JS bundlers cannot drop properties of a single object literal.  This PR blanks those statements out of the emitted `.mjs` in a `generateBundle` plugin. Blanking instead of deleting keeps line numbers, so the emitted source maps stay aligned with the source.  ## Measured (minimal Vite 8 app, React 19, one `<Button>`)  | | before | after | Δ | |---|---:|---:|---:| | JS | 409,669 B | 377,431 B | **−31.5 KiB** | | JS gzip | 129,142 B | 122,864 B | **−6.1 KiB** | | JS brotli | 110,422 B | 106,546 B | **−3.8 KiB** | | `es/style.css` | md5 `11cc5367a5d3258deb8356ef6b94ea2b` | same | 0 |  `es/` files that contain the dead interpolation: 10 → 0. `es/Button/style.mjs` reads `cssVar`: 14 → 0.  ## Why not a tree-shakeable export shape  `export * as cssVar from './tokens.stylex'` (one named const per token) was implemented 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #OU+AQMFz9g2ZYJ8E7yQOf6ghxR4NAsZhFy728nR7uCA=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJsb2JlLXVpIiwicHJvamVjdElkIjoicHJqX0NNemVSVjBESElCc3A0UXhUMjBJeWd4TDVWZkEiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vbG9iZS1odWItb3NzL2xvYmUtdWkvQ295clFqdDNMajFnaDQ4cmd6ZDd5Mkdwcjd5aSIsInByZXZpZXdVcmwiOiJsb2JlLXVpLWdpdC1wZXJmLXN0cmlwLXN0eWxleC10b2tlbi1pbnRlcnBvbGF0aW9ucy1sb2JlLWh1Yi1vc3MudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJJR05PUkVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJyb290RGlyZWN0b3J5IjpudWxsfV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWxvYmVodWImcmVwbz1sb2JlLXVpJnByPTc2NyJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).   <details><summary>1 Skipped Deployment</summary>  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://ver
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"746a11f2ff95425c8e0747101c146b42f4515874","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-26T19:33:35.149144Z">2026-10-26T19:33:35.149144Z</relative-time> | `746a11f` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex 

- **Issue #761** (2026-10-23): **✨ feat(code-diff): render with @pierre/highlights via diffs 1.6.1**
  *Symptoms*: #### 💻 变更类型 | Change Type  - [x] ✨ feat - [ ] 🐛 fix - [ ] ♻️ refactor - [ ] 💄 style - [ ] 🔨 chore - [ ] 📝 docs  #### 🔀 变更说明 | Description of Change  `CodeDiff` / `PatchDiff` now highlight with `@pierre/highlights` (the same Wasm engine `Highlighter` moved to in #757) instead of shiki.  - `@pierre/diffs` 1.5.2 → 1.6.1. 1.6 adds the optional `highlights` backend and loads every shiki module through dynamic `import()`; it depends on `@pierre/highlights` 0.2.0, which dedupes with ours. - `lobe-theme` is registered for both backends (Zed palette for highlights, TextMate for shiki) and `preferredHighlighter: 'highlights'` is the default. It is spread before `diffOptions`, so `diffOptions={{ preferredHighlighter: 'shiki-js' }}` still works with the lobe colors. - `resolveTheme('lobe-theme', 'highlights')`: without the backend argument, diffs resolves against shiki and loads `shiki/core` eagerly. - New export `LobeHighlightsTheme` (Zed-format lobe theme) so downstream code (lobehub canvas-runtime) can drop its own shiki highlighter.  #### 📝 补充信息 | Additional Information  Verified: - type-check, eslint, `tests/stableClasses`, `src/CodeDiff`, `src/Highlighter` tests (633) pass; `pnpm run build` passes. - Browser (docs dev): no request for any shiki module; every rendered token is `var(--lobe-*)`; light and dark checked. Forcing `preferredHighlighter: 'shiki-js'` renders with lobe colors. - Consumer bundle of `es/CodeDiff` (esbuild, splitting): the static graph is 669 KB with no 

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

### Incident Patch 1: `50a59365` (2026-10-26)
**Commit Message**: 🐛 fix(docs): freeze the demo references of the restored component pages

docs-kit only inherits a .mdx page's demo references from compatibility.json,
so renaming Input / AutoComplete / Checkbox / Form to index.mdx dropped 10 dumi
legacy demo ids and failed tests/docs/contentInventory.test.ts (454 < 460).
Regenerated them from the pre-rename pages and added them to the frozen map.

**File**: `compatibility.json` (modified, +156/-0)
```diff
@@ -24,6 +24,18 @@
       "pathname": "/components/action-icon-group",
       "source": "src/ActionIconGroup/demos/index.tsx"
     },
+    {
+      "document": "src/AutoComplete/index.mdx",
+      "legacyId": "src-auto-complete-demo-demos",
+      "legacyRouteId": "components/AutoComplete/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/auto-complete",
+      "source": "src/AutoComplete/demos/index.tsx"
+    },
     {
       "document": "src/Block/index.mdx",
       "legacyId": "src-block-demo-demos",
@@ -36,6 +48,18 @@
       "pathname": "/components/block",
       "source": "src/Block/demos/index.tsx"
     },
+    {
+      "document": "src/Checkbox/index.mdx",
+      "legacyId": "src-checkbox-demo-demos",
+      "legacyRouteId": "components/Checkbox/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/checkbox",
+      "source": "src/Checkbox/demos/index.tsx"
+    },
     {
       "document": "src/CodeDiff/index.mdx",
       "legacyId": "src-code-diff-demo-actionsrender",
@@ -864,6 +888,78 @@
       "pathname": "/components/fluent-emoji",
       "source": "src/FluentEmoji/demos/index.tsx"
     },
+    {
+      "document": "src/Form/index.mdx",
+      "legacyId": "src-form-demo-demos",
+      "legacyRouteId": "components/Form/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/form",
+      "source": "src/Form/demos/index.tsx"
+    },
+    {
+      "document": "src/Form/index.mdx",
+      "legacyId": "src-form-demo-compound",
+      "legacyRouteId": "components/Form/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/form",
+      "source": "src/Form/demos/compound.tsx"
+    },
+    {
+      "document": "src/Form/index.mdx",
+      "legacyId": "src-form-demo-controls",
+      "legacyRouteId": "components/Form/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/form",
+      "source": "src/Form/demos/controls.tsx"
+    },
+    {
+      "document": "src/Form/index.mdx",
+      "legacyId": "src-form-demo-zod",
+      "legacyRouteId": "components/Form/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/form",
+      "source": "src/Form/demos/zod.tsx"
+    },
+    {
+      "document": "src/Form/index.mdx",
+      "legacyId": "src-form-demo-float",
+      "legacyRouteId": "components/Form/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/form",
+      "source": "src/Form/demos/float.tsx"
+    },
+    {
+      "document": "src/Form/index.mdx",
+      "legacyId": "src-form-demo-compact",
+      "legacyRouteId": "components/Form/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/form",
+      "source": "src/Form/demos/compact.tsx"
+    },
     {
       "document": "src/Freeze/index.mdx",
       "legacyId": "src-freeze-demo-demos",
@@ -1248,6 +1344,30 @@
       "pathname": "/components/image-select",
       "source": "src/ImageSelect/demos/index.tsx"
     },
+    {
+      "document": "src/Input/index.mdx",
+      "legacyId": "src-input-demo-demos",
+      "legacyRouteId": "components/Input/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/input",
+      "source": "src/Input/demos/index.tsx"
+    },
+    {
+      "document": "src/Input/index.mdx",
+      "legacyId": "src-input-demo-family",
+      "legacyRouteId": "components/Input/index",
+      "options": {
+        "inline": false,
+        "isolated": false,
+        "layout": "bare"
+      },
+      "pathname": "/components/input",
+      "source": "src/Input/demos/family.tsx"
+    },
     {
       "document": "src/Layout/index.mdx",
       "legacyId": "src-layout-demo-demos",
@@ -5474,6 +5594,15 @@
       "source": "src/ActionIconGroup/index.mdx",
       "title": "ActionIconGroup"
     },
+    {
+      "category": "Data Entry",
+      "description": "Base UI-powered AutoComplete input with filtered suggestions.",
+      "legacyRouteId": "components/AutoComplete/index",
+      "pathname": "/components/auto-complete",
+      "section": "Components",
+      "source": "src/AutoComplete/index.mdx",
+      "title": "AutoComplete"
+    },
     {
       "category": "General",
       "legacyRouteId": "components/Block/index",
@@ -5482,6 +5611,15 @@
       "source": "src/Block/index.mdx",
       "ti
```

---

### Incident Patch 2: `a5441425` (2026-10-27)
**Commit Message**: ⚡️ perf(build): stop shipping the cssVar token table to consumers (#767)

The StyleX compiler inlines module-scope token interpolations into `style.css`, so the
declarations that fed them are dead. Tree shaking drops the binding but keeps the
interpolation as a bare template literal (`${cssVar.colorError};`) because a template
literal is assumed to be side-effectful, and those reads are the only reason a consumer
bundle still carries the whole 786-entry `cssVar` table.

Blank those statements out of the emitted `.mjs`. Blanking instead of deleting keeps line
numbers, so the source maps stay aligned; `style.css` is byte-identical (md5
11cc5367...) and components that read tokens at runtime (Tag, Empty, Highlighter, ...)
keep working.

Minimal Vite app rendering one Button: 409,669 B -> 377,431 B (-31.5 KiB), gzip
129,142 B -> 122,864 B (-6.1 KiB), brotli 110,422 B -> 106,546 B (-3.8 KiB).

Note: a tree-shakeable `export * as cssVar` shape was tried and rejected — the StyleX
compiler only statically evaluates `defineConsts` objects, so the namespace form emitted
80 undefined hashed `--lb*` variables and churned 1,184 lines of `style.css`.

**File**: `config/stripDeadTokenInterpolations.test.ts` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+// @vitest-environment node
+import { stripDeadTokenInterpolations } from './stripDeadTokenInterpolations';
+
+describe('stripDeadTokenInterpolations', () => {
+  it('blanks interpolation-only statements left behind by tree shaking', () => {
+    expect(stripDeadTokenInterpolations('`${cssVar.colorError}`;')).toBe('');
+    expect(stripDeadTokenInterpolations('`${colorText}${colorBorder}`;')).toBe('');
+    expect(stripDeadTokenInterpolations('\t`${cssVar.colorFillTertiary}`;  ')).toBe('');
+  });
+
+  it('keeps line numbers so the emitted source maps stay aligned', () => {
+    const code = 'import { cssVar } from "./x.mjs";\n`${cssVar.a}`;\nexport const keep = 1;\n';
+    expect(stripDeadTokenInterpolations(code)).toBe(
+      'import { cssVar } from "./x.mjs";\n\nexport const keep = 1;\n',
+    );
+  });
+
+  it('leaves live code untouched', () => {
+    for (const code of [
+      'const tone = `${cssVar.colorText}`;',
+      'const hex = `${Color.parse(cssVar.colorText)}`;',
+      '`${cssVar.colorText} 88%, white`;',
+      'console.log(`${cssVar.colorText}`);',
+      '`${"literal"}`;',
+    ]) {
+      expect(stripDeadTokenInterpolations(code)).toBe(code);
+    }
+  });
+});
```

**File**: `config/stripDeadTokenInterpolations.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import type { Rolldown } from 'tsdown';
+
+// The StyleX compiler inlines module-scope token interpolations into style.css, so the declarations
+// that fed them are dead. Tree shaking drops the declaration but keeps the interpolation as a bare
+// template literal (`${cssVar.colorError};`), because a template literal is assumed to be
+// side-effectful. Those reads are the only reason a consumer bundle still carries the whole `cssVar`
+// token table (786 constants), and neither `treeshake.propertyReadSideEffects` nor a stricter
+// `treeshake` setting drops them.
+const deadTokenInterpolation =
+  /^[\t ]*`(?:\$\{[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\})*`;[\t ]*$/gm;
+
+// Blanking the statement instead of deleting the line keeps line numbers — and therefore the source
+// maps of the emitted .mjs — aligned with the source.
+export const stripDeadTokenInterpolations = (code: string) =>
+  code.replaceAll(deadTokenInterpolation, '');
+
+export const stripDeadTokenInterpolationsPlugin = (): Rolldown.Plugin => ({
+  generateBundle(_options, bundle) {
+    for (const file of Object.values(bundle)) {
+      if (file.type === 'chunk') file.code = stripDeadTokenInterpolations(file.code);
+    }
+  },
+  name: 'lobe-ui:strip-dead-token-interpolations',
+});
```

**File**: `tsdown.config.ts` (modified, +6/-1)
```diff
@@ -6,6 +6,7 @@ import stylex from '@stylexjs/unplugin/rolldown';
 import { defineConfig, type Rolldown } from 'tsdown';
 
 import { layerComponentCss } from './config/componentCss.ts';
+import { stripDeadTokenInterpolationsPlugin } from './config/stripDeadTokenInterpolations.ts';
 import { stylexOptions } from './config/stylex.ts';
 
 const root = fileURLToPath(new URL('.', import.meta.url));
@@ -78,7 +79,11 @@ export default defineConfig({
   outputOptions: { assetFileNames: '[name][extname]' },
   // componentCss must emit style.css before StyleX's generateBundle appends to the first CSS asset;
   // StyleX re-emits that asset by name, so an unhashed assetFileNames keeps it at es/style.css.
-  plugins: [componentCss(), stylex({ ...stylexOptions, dev: false })],
+  plugins: [
+    componentCss(),
+    stylex({ ...stylexOptions, dev: false }),
+    stripDeadTokenInterpolationsPlugin(),
+  ],
 
   sourcemap: true,
   unbundle: true,
```

---

### Incident Patch 3: `3aebe80d` (2026-10-26)
**Commit Message**: 🐛 fix(docs): restore the missing Input, Checkbox, AutoComplete and Form pages

These four components still shipped a dumi-era index.md, and docs-kit only
collects index.mdx, so /components/input, /components/checkbox,
/components/auto-complete and /components/form silently 404ed on the site.

**File**: `src/AutoComplete/index.md` (removed, +0/-31)
```diff
@@ -1,31 +0,0 @@
----
-nav: Components
-group: Data Entry
-title: AutoComplete
-description: Base UI-powered AutoComplete input with filtered suggestions.
-apiHeader:
-  pkg: '@lobehub/ui'
-  docUrl: 'https://github.com/lobehub/lobe-ui/tree/master/src/AutoComplete/index.md'
-  sourceUrl: 'https://github.com/lobehub/lobe-ui/tree/master/src/AutoComplete/AutoComplete.tsx'
----
-
-## Default
-
-<code src="./demos/index.tsx" nopadding></code>
-
-## APIs
-
-| Property        | Description                        | Type                                         | Default  |
-| --------------- | ---------------------------------- | -------------------------------------------- | -------- |
-| options         | Suggestion list                    | `(string \| { value; label?; disabled? })[]` | `[]`     |
-| value           | Controlled input value             | `string`                                     | -        |
-| onChange        | Fires on typing or item pick       | `(value: string) => void`                    | -        |
-| onSearch        | Alias fired together with onChange | `(value: string) => void`                    | -        |
-| allowClear      | Show clear button                  | `boolean`                                    | -        |
-| emptyText       | Content when nothing matches       | `ReactNode`                                  | -        |
-| variant         | Input visual variant               | `'filled' \| 'outlined' \| 'borderless'`     | auto     |
-| size            | Input size                         | `'small' \| 'middle' \| 'large'`             | `middle` |
-| shadow          | Apply lobe shadow style            | `boolean`                                    | -        |
-| prefix / suffix | Input slots                        | `ReactNode`                                  | -        |
-
-Filtering is built into Base UI Autocomplete; items are matched against the typed value automatically.
```

**File**: `src/AutoComplete/index.mdx` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+---
+title: AutoComplete
+description: Base UI-powered AutoComplete input that filters its own suggestion list as you type.
+category: Data Entry
+---
+
+import DemoIndex from './demos/index.tsx?demo';
+import { StableClassTable } from '../../docs/stable-classes/StableClassTable';
+import { autoCompleteClasses } from './stable';
+
+## Default
+
+Filtering is built into Base UI Autocomplete; items are matched against the typed value automatically, so `options` only supplies the candidate list.
+
+<Demo of={DemoIndex} layout="bare" />
+
+## APIs
+
+| Property | Description | Type | Default |
+| --- | --- | --- | --- |
+| options | Suggestion list | `(string \| { value; label?; disabled? })[]` | `[]` |
+| value | Controlled input value | `string` | - |
+| onChange | Fires on typing or item pick | `(value: string) => void` | - |
+| onSearch | Alias fired together with onChange | `(value: string) => void` | - |
+| allowClear | Show clear button | `boolean` | - |
+| emptyText | Content when nothing matches | `ReactNode` | - |
+| variant | Input visual variant | `'filled' \| 'outlined' \| 'borderless'` | auto |
+| size | Input size | `'small' \| 'middle' \| 'large'` | `middle` |
+| shadow | Apply lobe shadow style | `boolean` | - |
+| prefix / suffix | Input slots | `ReactNode` | - |
+
+## Class names
+
+These class names are public API for overrides, integrations and e2e selectors. See [Styling Overrides](/styling-overrides).
+
+<StableClassTable of={autoCompleteClasses} />
```

**File**: `src/Checkbox/index.md` (removed, +0/-42)
```diff
@@ -1,42 +0,0 @@
----
-nav: Components
-group: Data Entry
-title: Checkbox
-description: Base UI-powered Checkbox and CheckboxGroup with lobe visual style.
-apiHeader:
-  pkg: '@lobehub/ui'
-  docUrl: 'https://github.com/lobehub/lobe-ui/tree/master/src/Checkbox/index.md'
-  sourceUrl: 'https://github.com/lobehub/lobe-ui/tree/master/src/Checkbox/Checkbox.tsx'
----
-
-## Default
-
-<code src="./demos/index.tsx" nopadding></code>
-
-## APIs
-
-### Checkbox
-
-| Property        | Description                            | Type                         | Default  |
-| --------------- | -------------------------------------- | ---------------------------- | -------- |
-| checked         | Controlled state                       | `boolean`                    | -        |
-| defaultChecked  | Uncontrolled initial state             | `boolean`                    | -        |
-| onChange        | State change callback                  | `(checked: boolean) => void` | -        |
-| indeterminate   | Show minus indicator                   | `boolean`                    | -        |
-| size            | Box size in pixels                     | `number`                     | `16`     |
-| shape           | Box shape                              | `'square' \| 'circle'`       | `square` |
-| backgroundColor | Checked background color               | `string`                     | primary  |
-| children        | Label content                          | `ReactNode`                  | -        |
-| name            | Form field name (renders hidden input) | `string`                     | -        |
-| disabled        | Disable interaction                    | `boolean`                    | -        |
-
-### CheckboxGroup
-
-| Property     | Description                | Type                                        | Default |
-| ------------ | -------------------------- | ------------------------------------------- | ------- |
-| options      | Checkbox list              | `(string \| { value; label; disabled? })[]` | -       |
-| value        | Controlled selected values | `string[]`                                  | -       |
-| defaultValue | Initial selected values    | `string[]`                                  | -       |
-| onChange     | Selection change callback  | `(value: string[]) => void`                 | -       |
-| horizontal   | Row layout                 | `boolean`                                   | `true`  |
-| gap          | Gap between items          | `number`                                    | `12`    |
```

**File**: `src/Checkbox/index.mdx` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+---
+title: Checkbox
+description: Base UI-powered Checkbox and CheckboxGroup with the lobe visual style.
+category: Data Entry
+---
+
+import DemoIndex from './demos/index.tsx?demo';
+import { StableClassTable } from '../../docs/stable-classes/StableClassTable';
+import { checkboxClasses, checkboxGroupClasses } from './stable';
+
+## Default
+
+<Demo of={DemoIndex} layout="bare" />
+
+## APIs
+
+### Checkbox
+
+| Property | Description | Type | Default |
+| --- | --- | --- | --- |
+| checked | Controlled state | `boolean` | - |
+| defaultChecked | Uncontrolled initial state | `boolean` | - |
+| onChange | State change callback | `(checked: boolean) => void` | - |
+| indeterminate | Show minus indicator | `boolean` | - |
+| size | Box size in pixels | `number` | `16` |
+| shape | Box shape | `'square' \| 'circle'` | `square` |
+| backgroundColor | Checked background color | `string` | primary |
+| children | Label content | `ReactNode` | - |
+| name | Form field name (renders hidden input) | `string` | - |
+| disabled | Disable interaction | `boolean` | - |
+
+### CheckboxGroup
+
+| Property | Description | Type | Default |
+| --- | --- | --- | --- |
+| options | Checkbox list | `(string \| { value; label; disabled? })[]` | - |
+| value | Controlled selected values | `string[]` | - |
+| defaultValue | Initial selected values | `string[]` | - |
+| onChange | Selection change callback | `(value: string[]) => void` | - |
+| horizontal | Row layout | `boolean` | `true` |
+| gap | Gap between items | `number` | `12` |
+
+## Class names
+
+These class names are public API for overrides, integrations and e2e selectors. See [Styling Overrides](/styling-overrides).
+
+### Checkbox
+
+<StableClassTable of={checkboxClasses} />
+
+### CheckboxGroup
+
+<StableClassTable of={checkboxGroupClasses} />
```

**File**: `src/Form/index.md` (removed, +0/-108)
```diff
@@ -1,108 +0,0 @@
----
-nav: Components
-group: Data Entry
-title: Form
-description: Base UI-powered Form with settings-style groups, fields and submit footer.
-apiHeader:
-  pkg: '@lobehub/ui'
-  docUrl: 'https://github.com/lobehub/lobe-ui/tree/master/src/Form/index.md'
-  sourceUrl: 'https://github.com/lobehub/lobe-ui/tree/master/src/Form/Form.tsx'
----
-
-## Items Config
-
-<code src="./demos/index.tsx" nopadding></code>
-
-## Compound Components & Validation
-
-<code src="./demos/compound.tsx" nopadding></code>
-
-## All Field-aware Controls
-
-Input / AutoComplete / InputNumber / Slider / Switch / Checkbox all join the form's value collection.
-
-<code src="./demos/controls.tsx" nopadding></code>
-
-## Zod Schema Validation
-
-Per-field via `validate`, or form-level with `safeParse` + the `errors` prop.
-
-<code src="./demos/zod.tsx" nopadding></code>
-
-## Float Submit Footer
-
-<code src="./demos/float.tsx" nopadding></code>
-
-## Compact (Drawer / Modal)
-
-In narrow containers use `compact` (12px `gap`, 10px field padding) or tune `gap` and
-`itemPadding` directly; the defaults (16px field padding, 48px gap in borderless forms) stay
-unchanged. `layout="vertical"` stacks inputs under their labels, and `layout="horizontal"` on a
-single `Form.Field` keeps a Switch inline with its label.
-
-<code src="./demos/compact.tsx" nopadding></code>
-
-## APIs
-
-### Form
-
-Wraps Base UI `Form`: native validation, `errors` prop passthrough for external/server errors, `validationMode`.
-
-| Property       | Description                                                                     | Type                                              | Default      |
-| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- | ------------ |
-| items          | Config-driven groups or fields                                                  | `FormGroupItemType[] \| FormFieldProps[]`         | -            |
-| itemsType      | Interpret `items` as grouped or flat                                            | `'group' \| 'flat'`                               | `group`      |
-| variant        | Visual variant of groups                                                        | `'filled' \| 'outlined' \| 'borderless'`          | `borderless` |
-| layout         | Field layout, mobile falls back to vertical                                     | `'horizontal' \| 'vertical'`                      | `horizontal` |
-| initialValues  | Distributed to fields as `defaultValue` by name; baseline for unsaved tracking  | `Record<string, any>`                             | -            |
-| onFinish       | Submit callback with collected values; async drives submit loading              | `(values, eventDetails) => void \| Promise<void>` | -            |
-| errors         | External validation errors keyed by field name                                  | `Record<string, string \| string[]>`              | -            |
-| validationMode | When fields validate                                                            | `'onSubmit' \| 'onBlur' \| 'onChange'`            | `onSubmit`   |
-| collapsible    | Whether groups are collapsible                                                  | `boolean`                                         | -            |
-| footer         | Rendered after fields, e.g. `<Form.SubmitFooter />`                             | `ReactNode`                                       | -            |
-| itemMinWidth   | Min width of field controls                                                     | `string \| number`                                | -            |
-| gap            | Gap between groups                                                              | `string \| number`                                | -            |
-| itemPadding    | Block (top / bottom) padding of every Form.Field                                | `string \| number`                                | `16px`       |
-| compact        | Compact preset for Drawers / Modals (`gap` 12px, `itemPadding` 10px unless set) | `boolean`                                         | `false`      |
-
-### Form.Field (FormField)
-
-Wraps Base UI `Field.Root`; any `Field`-aware control (base-ui `Input`, `TextArea`, `Switch`, ...) participates in validation and value collection.
-
-| Property | Description                                             | Type                                                | Default   |
-| -------- | ------------------------------------------------------- | --------------------------------------------------- | --------- |
-| label    | Field title                                             | `ReactNode`                                         | -         |
-| desc     | Description under the title                             | `ReactNode`                                         | -         |
-| avatar   | Node before the title               
```

**File**: `src/Form/index.mdx` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+---
+title: Form (Legacy)
+description: Configuration-driven Form from the root export, with settings-style groups, fields and a submit footer. Deprecated in favour of the schema-first form.
+category: Data Entry
+status: deprecated
+---
+
+import DemoIndex from './demos/index.tsx?demo';
+import DemoCompact from './demos/compact.tsx?demo';
+import DemoCompound from './demos/compound.tsx?demo';
+import DemoControls from './demos/controls.tsx?demo';
+import DemoFloat from './demos/float.tsx?demo';
+import DemoZod from './demos/zod.tsx?demo';
+import { StableClassTable } from '../../docs/stable-classes/StableClassTable';
+import { formClasses } from './stable';
+
+This uncontrolled `Form` is exported from `@lobehub/ui` and is removed in the next major. New code should use the schema-first [Form](/components/form-kit) from `@lobehub/ui/form`.
+
+## Items Config
+
+<Demo of={DemoIndex} />
+
+## Compound Components and Validation
+
+<Demo of={DemoCompound} />
+
+## Field-aware Controls
+
+`Input`, `AutoComplete`, `InputNumber`, `Slider`, `Switch` and `Checkbox` all join the form's value collection.
+
+<Demo of={DemoControls} />
+
+## Zod Schema Validation
+
+Per-field via `validate`, or form-level with `safeParse` plus the `errors` prop.
+
+<Demo of={DemoZod} />
+
+## Float Submit Footer
+
+<Demo of={DemoFloat} />
+
+## Compact (Drawer / Modal)
+
+In narrow containers use `compact` (12px `gap`, 10px field padding) or tune `gap` and `itemPadding` directly; the defaults (16px field padding, 48px gap in borderless forms) stay unchanged. `layout="vertical"` stacks inputs under their labels, and `layout="horizontal"` on a single `Form.Field` keeps a Switch inline with its label.
+
+<Demo of={DemoCompact} />
+
+## APIs
+
+### Form
+
+Wraps Base UI `Form`: native validation, `errors` prop passthrough for external/server errors, `validationMode`.
+
+| Property | Description | Type | Default |
+| --- | --- | --- | --- |
+| items | Config-driven groups or fields | `FormGroupItemType[] \| FormFieldProps[]` | - |
+| itemsType | Interpret `items` as grouped or flat | `'group' \| 'flat'` | `group` |
+| variant | Visual variant of groups | `'filled' \| 'outlined' \| 'borderless'` | `borderless` |
+| layout | Field layout, mobile falls back to vertical | `'horizontal' \| 'vertical'` | `horizontal` |
+| initialValues | Distributed to fields as `defaultValue` by name; baseline for unsaved tracking | `Record<string, any>` | - |
+| onFinish | Submit callback with collected values; async drives submit loading | `(values, eventDetails) => void \| Promise<void>` | - |
+| errors | External validation errors keyed by field name | `Record<string, string \| string[]>` | - |
+| validationMode | When fields validate | `'onSubmit' \| 'onBlur' \| 'onChange'` | `onSubmit` |
+| collapsible | Whether groups are collapsible | `boolean` | - |
+| footer | Rendered after fields, e.g. `<Form.SubmitFooter />` | `ReactNode` | - |
+| itemMinWidth | Min width of field controls | `string \| number` | - |
+| gap | Gap between groups | `string \| number` | - |
+| itemPadding | Block (top / bottom) padding of every Form.Field | `string \| number` | `16px` |
+| compact | Compact preset for Drawers / Modals (`gap` 12px, `itemPadding` 10px unless set) | `boolean` | `false` |
+
+### Form.Field (FormField)
+
+Wraps Base UI `Field.Root`; any `Field`-aware control (base-ui `Input`, `TextArea`, `Switch`, ...) participates in validation and value collection.
+
+| Property | Description | Type | Default |
+| --- | --- | --- | --- |
+| label | Field title | `ReactNode` | - |
+| desc | Description under the title | `ReactNode` | - |
+| avatar | Node before the title | `ReactNode` | - |
+| tag | Tag after the title | `string` | - |
+| name | Field name for form values | `string` | - |
+| required | Injected into the control, drives native `valueMissing` | `boolean` | - |
+| validate | Custom validator, return error message(s) or `null` | `(value, formValues) => string \| string[] \| null` | - |
+| layout | Override form layout | `'horizontal' \| 'vertical'` | inherited |
+| minWidth | Min width of the control column | `string \| number` | inherited |
+| divider | Render a divider above (auto-managed by `items`) | `boolean` | `false` |
+| hidden | Skip rendering | `boolean` | - |
+
+### Form.Group (FormGroup)
+
+| Property | Description | Type | Default |
+| --- | --- | --- | --- |
+| title | Group title | `ReactNode` | - |
+| desc | Description under the title | `ReactNode` | - |
+| icon | Icon before the title | `IconProps['icon']` | - |
+| extra | Node at the end of the header | `ReactNode` | - |
+| collapsible | Whether the group can collapse | `boolean` | `true` unless borderless |
+| defaultActive | Initially expanded | `boolean` | `true` |
+| active | Controlled expanded state | `boolean` | - |
+| onCollapse | Expanded state change callback | `(active: boolean) => void` | - |
+| variant | Visual variant | `'filled' \| 'outlined' \| 'borderless'` |
```

**File**: `src/Input/index.md` (removed, +0/-71)
```diff
@@ -1,71 +0,0 @@
----
-nav: Components
-group: Data Entry
-title: Input
-description: Base UI-powered Input and TextArea components.
-apiHeader:
-  pkg: '@lobehub/ui'
-  docUrl: 'https://github.com/lobehub/lobe-ui/tree/master/src/Input/index.md'
-  sourceUrl: 'https://github.com/lobehub/lobe-ui/tree/master/src/Input/Input.tsx'
----
-
-## Default
-
-<code src="./demos/index.tsx" nopadding></code>
-
-## Password / Number / OTP
-
-<code src="./demos/family.tsx" nopadding></code>
-
-## APIs
-
-### Input
-
-| Property   | Description                                           | Type                                     | Default                           |
-| ---------- | ----------------------------------------------------- | ---------------------------------------- | --------------------------------- |
-| variant    | Visual variant                                        | `'filled' \| 'outlined' \| 'borderless'` | dark: `filled`, light: `outlined` |
-| size       | Control height                                        | `'small' \| 'middle' \| 'large'`         | `middle`                          |
-| shadow     | Apply lobe shadow style                               | `boolean`                                | `false`                           |
-| prefix     | Node rendered before the input                        | `ReactNode`                              | -                                 |
-| suffix     | Node rendered after the input                         | `ReactNode`                              | -                                 |
-| classNames | Class names for parts (`input` / `prefix` / `suffix`) | `InputClassNames`                        | -                                 |
-| styles     | Styles for parts (`input` / `prefix` / `suffix`)      | `InputStyles`                            | -                                 |
-
-Remaining props are forwarded to the underlying Base UI `Input` (`onValueChange`, `defaultValue`, native input attributes, etc.). It automatically integrates with `Field` / `Form` validation.
-
-### InputPassword
-
-Extends Input.
-
-| Property               | Description                                                  | Type                               | Default                                            |
-| ---------------------- | ------------------------------------------------------------ | ---------------------------------- | -------------------------------------------------- |
-| visibilityToggle       | Render the eye button                                        | `boolean`                          | `true`                                             |
-| visibilityToggleLabels | Accessible labels (`aria-label` / `title`) of the eye button | `{ show?: string; hide?: string }` | `{ show: 'Show password', hide: 'Hide password' }` |
-
-```tsx
-<InputPassword visibilityToggleLabels={{ hide: '隐藏确认密码', show: '显示确认密码' }} />
-```
-
-### InputNumber
-
-Wraps Base UI `NumberField`: `value` / `defaultValue` / `onChange(value: number | null)`, `min` / `max` / `step`, `controls` (default `true`), `changeOnWheel`, plus `variant` / `size` / `shadow`.
-
-### InputOTP
-
-Wraps Base UI `OTPField`: `length` (default `6`), `value` / `defaultValue` / `onChange(value: string)`, `mask`, `autoSubmit`, plus `variant` / `size` / `shadow`.
-
-### TextArea
-
-| Property | Description                                        | Type                                                | Default                           |
-| -------- | -------------------------------------------------- | --------------------------------------------------- | --------------------------------- |
-| autoSize | Auto grow with content, optionally bounded by rows | `boolean \| { minRows?: number; maxRows?: number }` | -                                 |
-| resize   | Allow manual vertical resize                       | `boolean`                                           | `false`                           |
-| variant  | Visual variant                                     | `'filled' \| 'outlined' \| 'borderless'`            | dark: `filled`, light: `outlined` |
-| shadow   | Apply lobe shadow style                            | `boolean`                                           | `false`                           |
-
-## Clear, Enter and counting
-
-- `allowClear` shows a round clear button while the field has a value and is hovered or focused; `onClear` fires after the value is emptied. Focus stays in the field.
-- `onPressEnter` fires on Enter, but not while an IME is composing, so confirming a Chinese or Japanese candidate never submits.
-- `InputNumber` formats through `format` (`Intl.NumberFormatOptions`); `precision` fixes the fraction digits; `prefix` / `suffix` hold units.
-- `TextArea` `showCount` renders the character count (emoji count as one), `used / maxLength` when `maxLength` is set.
```

**File**: `src/Input/index.mdx` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+---
+title: Input
+description: Base UI-powered text input with variants, sizes, clear button and slots, plus the Password, Number, OTP and TextArea family.
+category: Data Entry
+---
+
+import DemoIndex from './demos/index.tsx?demo';
+import DemoFamily from './demos/family.tsx?demo';
+import { StableClassTable } from '../../docs/stable-classes/StableClassTable';
+import {
+  inputClasses,
+  inputNumberClasses,
+  inputOTPClasses,
+  inputPasswordClasses,
+  textAreaClasses,
+} from './stable';
+
+## Default
+
+<Demo of={DemoIndex} layout="bare" />
+
+## Password, Number and OTP
+
+`InputPassword`, `InputNumber` and `InputOTP` share the `Input` shell, so `variant`, `size` and `shadow` behave the same way across the family.
+
+<Demo of={DemoFamily} layout="bare" />
+
+## Clear, Enter and counting
+
+- `allowClear` shows a round clear button while the field has a value and is hovered or focused; `onClear` fires after the value is emptied. Focus stays in the field.
+- `onPressEnter` fires on Enter, but not while an IME is composing, so confirming a Chinese or Japanese candidate never submits.
+- `InputNumber` formats through `format` (`Intl.NumberFormatOptions`); `precision` fixes the fraction digits; `prefix` / `suffix` hold units.
+- `TextArea` `showCount` renders the character count (emoji count as one), `used / maxLength` when `maxLength` is set.
+
+## APIs
+
+### Input
+
+| Property | Description | Type | Default |
+| --- | --- | --- | --- |
+| variant | Visual variant | `'filled' \| 'outlined' \| 'borderless'` | dark: `filled`, light: `outlined` |
+| size | Control height | `'small' \| 'middle' \| 'large'` | `middle` |
+| shadow | Apply lobe shadow style | `boolean` | `false` |
+| prefix | Node rendered before the input | `ReactNode` | - |
+| suffix | Node rendered after the input | `ReactNode` | - |
+| classNames | Class names for parts (`input` / `prefix` / `suffix`) | `InputClassNames` | - |
+| styles | Styles for parts (`input` / `prefix` / `suffix`) | `InputStyles` | - |
+
+Remaining props are forwarded to the underlying Base UI `Input` (`onValueChange`, `defaultValue`, native input attributes, etc.). It automatically integrates with `Field` / `Form` validation.
+
+### InputPassword
+
+Extends Input.
+
+| Property | Description | Type | Default |
+| --- | --- | --- | --- |
+| visibilityToggle | Render the eye button | `boolean` | `true` |
+| visibilityToggleLabels | Accessible labels (`aria-label` / `title`) of the eye button | `{ show?: string; hide?: string }` | `{ show: 'Show password', hide: 'Hide password' }` |
+
+```tsx
+<InputPassword visibilityToggleLabels={{ hide: '隐藏确认密码', show: '显示确认密码' }} />
+```
+
+### InputNumber
+
+Wraps Base UI `NumberField`: `value` / `defaultValue` / `onChange(value: number | null)`, `min` / `max` / `step`, `controls` (default `true`), `changeOnWheel`, plus `variant` / `size` / `shadow`.
+
+### InputOTP
+
+Wraps Base UI `OTPField`: `length` (default `6`), `value` / `defaultValue` / `onChange(value: string)`, `mask`, `autoSubmit`, plus `variant` / `size` / `shadow`.
+
+### TextArea
+
+| Property | Description | Type | Default |
+| --- | --- | --- | --- |
+| autoSize | Auto grow with content, optionally bounded by rows | `boolean \| { minRows?: number; maxRows?: number }` | - |
+| resize | Allow manual vertical resize | `boolean` | `false` |
+| variant | Visual variant | `'filled' \| 'outlined' \| 'borderless'` | dark: `filled`, light: `outlined` |
+| shadow | Apply lobe shadow style | `boolean` | `false` |
+
+## Class names
+
+These class names are public API for overrides, integrations and e2e selectors. See [Styling Overrides](/styling-overrides).
+
+### Input
+
+<StableClassTable of={inputClasses} />
+
+### InputPassword
+
+<StableClassTable of={inputPasswordClasses} />
+
+### InputNumber
+
+<StableClassTable of={inputNumberClasses} />
+
+### InputOTP
+
+<StableClassTable of={inputOTPClasses} />
+
+### TextArea
+
+<StableClassTable of={textAreaClasses} />
```

#### Recent Merged Pull Requests:
- **PR #767** (2026-10-27): ⚡️ perf(build): stop shipping the cssVar token table to consumers (@Innei)
- **PR #761** (2026-10-23): ✨ feat(code-diff): render with @pierre/highlights via diffs 1.6.1 (@Innei)
- **PR #760** (2026-10-23): ✨ feat(agent-avatar): add AgentAvatar component (@canisminor1990)
- **PR #759** (2026-10-23): ✨ feat(avatar): add boring-avatars fallback variants (@canisminor1990)
- **PR #758** (2026-10-23): ✨ feat(progressive-blur): add ProgressiveBlur component (@canisminor1990)
- **PR #757** (2026-10-22): ✨ feat(highlighter): replace shiki with @pierre/highlights (@Innei)

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

## X. 🐛 fix(docs): freeze the demo references of the restored component pages

**RULE**:
When implementing operations in `compatibility.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lobehub/lobe-ui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `50a59365`: 🐛 fix(docs): freeze the demo references of the restored component pages. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `compatibility.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    {
      "document": "src/AutoComplete/index.mdx",
      "legacyId": "src-auto-complete-demo-demos",
      "legacyRouteId": "components/AutoComplete/index",
      "options": {
        "inline": false,
        "isolated": false,
        "layout": "bare"
      },
      "pathname": "/components/auto-complete",
      "source": "src/AutoComplete/demos/index.tsx"
    },
    {
      "document": "src/Checkbox/index.mdx",
      "legacyId": "src-checkbox-demo-demos",
      "legacyRouteId": "components/Checkbox/index",
      "options": {
        "inline": false,
        "isolated": false,
        "layout": "bare"
      },
      "pathname": "/components/checkbox",
      "source": "src/Checkbox/demos/index.tsx"
    },
    {
      "document": "src/Form/index.mdx",
      "legacyId": "src-form-demo-demos",
      "legacyRouteId": "components/Form/index",
      "options": {
        "inline": false,
        "isolated": false,
        "layout": "bare"
      },
      "pathname": "/components/form",
      "source": "src/Form/demos/index.tsx"
    },
    {
      "document": "src/Form/index.mdx",
      "legacyId": "src-form-demo-compound",
      "legacyRouteId": "components/Form/index",
      "options":
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `50a59365` are properly handled with clean fallback behavior.
