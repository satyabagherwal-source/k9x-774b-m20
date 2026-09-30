# Forensic Learning Record (Deep Inspection): tinyhumansai/openhuman

> **Canonical Artifact**: `07_PROJECT_LEARNING/tinyhumansai-openhuman-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tinyhumansai/openhuman](https://github.com/tinyhumansai/openhuman))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:06:09.407Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tinyhumansai/openhuman`
- **Description**: OpenHuman is the fastest, cheapest, most efficient open-source agent harness. Written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 40235 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/eslint.config.js`
```
// ESLint flat config for ESLint 9+
// This config is compatible with Prettier and won't conflict with formatting rules

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  // Base recommended rules
  js.configs.recommended,

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'target/**',
      '**/target/**',
      'dist/**',
      'dist-web/**',
      'coverage/**',
      'app/**',
      'src-tauri/**',
      'rust-core/**',
      'skills/**',
      'references/**',
      'scripts/**',
      '*.config.js',
      '*.config.ts',
      'test/vitest.config.ts',
      'tsconfig.tsbuildinfo',
    ],
  },

  // Browser environment globals
  {
    files: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'],
    languageOptions: {
      globals: {
        // Browser globals
        window: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        self: 'readonly',
        crypto: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        // React globals
        React: 'readonly',
        // Node.js globals (for Vite/node polyfills)
        require: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
  },

  // TypeScript files configuration
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      // Disable base no-unused-vars in favor of TypeScript version
      'no-unused-vars': 'off',
      // TypeScript recommended rules (disable base JS rules that TypeScript handles)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_|^[A-Z_]+$', // Ignore _prefixed vars and ALL_CAPS (enum members)
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Import/export rules
      // Note: import/order is disabled to let Prettier handle import sorting
      // ESLint still checks for other import issues
      'import/order': 'off', // Prettier plugin handles import sorting
      'import/no-unresolved': 'off', // TypeScript handles this
      'import/no-cycle': 'warn',
      'import/no-duplicates': 'error', // Prevent duplicate imports

      // General JavaScript/TypeScript rules
      'no-console': 'off', // Allow console in frontend code
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'off', // Covered by @typescript-eslint version
      '@typescript-eslint/no-unused-expressions': 'error',

      // Code quality
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',

      // Style: Enforce single-line statements on same line without braces when possible
      curly: ['error', 'multi', 'consistent'], // Allow single-line without braces, require braces only for multi-statement blocks
      'nonblock-statement-body-position': ['error', 'beside'], // Enforce single-line statements on same line (prevents braces on single-line)
    },
  },

  // Barrel-import enforcement, `settings/controls` half. This one IS global:
  // it has zero outstanding deep imports app-wide (confirmed via
  // `rg "from '.*settings/controls/[A-Za-z]"`), so there is nothing to
  // grandfather.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['src/components/settings/controls/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/settings/controls/*', '!**/settings/controls/index'],
              message:
                "Import settings controls from the 'settings/controls' barrel instead of a deep path into the control file.",
            },
          ],
        },
      ],
    },
  },

  // Barrel-import enforcement (S10). `src/components/ui` is documented as
  // the only sanctioned import path for shared UI primitives (see its
  // `index.ts` doc comment) and `src/components/settings/controls` is the
  // same shape for settings controls — reaching past either barrel into a
  // specific primitive file is exactly the drift this rule exists to stop
  // from regrowing once a directory has been migrated onto it.
  //
  // `**/assistant-ui/ui/*` is excluded: that is a different, barrel-less
  // vendored primitive set (shadcn-style, one file per component, no
  // `index.ts`) and deep-importing it is the intended, only way to use it.
  //
  // SCOPED, NOT GLOBAL — an allowlist, not a denylist. Turning this on
  // app-wide surfaced ~340 pre-existing deep `components/ui` imports across
  // `src/components/{accounts,BootCheckGate,channels,chat,feedback,
  // InitProgressScreen,intelligence,notifications,orchestration,rewards,
  // settings,shortcuts,skills}`, several root-level `src/components/*.tsx`
  // files, `src/features/**`, and most of `src/pages/**` — well past the 48
  // the S10 audit itself flagged, and far beyond this change's scope to fix.
  // `files` below lists exactly the directories this pass actually migrated
  // (confirmed clean via `rg "from '(\.\./)+ui/[A-Za-z]"` returning nothing
  // for each), so the rule is enforced everywhere it has already been
  // cleaned up without failing lint on code this change never touched.
  // Widen `files` as each remaining directory gets its own migration pass —
  // an allowlist only ever grows, never shrinks, so the net only tightens.
  {
    files: [
      'src/components/flows/**/*.tsx',
      'src/components/flows/**/*.ts',
      'src/components/layout/**/*.tsx',
      'src/components/layout/**/*.ts',
      'src/components/dashboard/**/*.tsx',
      'src/components/dashboard/**/*.ts',
      'src/components/approvals/**/*.tsx',
      'src/components/approvals/**/*.ts',
      'src/pages/FlowsPage.tsx',
      'src/pages/FlowCanvasPage.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui/*', '!**/assistant-ui/ui/*', '!**/ui/index'],
              message:
                "Import UI primitives from the 'components/ui' barrel (src/components/ui) instead of a deep path into the primitive file.",
            },
            // Repeated verbatim from the global block below. Flat config
            // REPLACES a rule's options rather than merging them, so a later
            // block that also sets `no-restricted-imports` would otherwise
            // silently drop whichever patterns it does not itself list. 
```

### Core Architecture Module: `app/playwright.config.ts`
```
import { defineConfig } from '@playwright/test';

const baseURL = process.env.PW_BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './test/playwright/specs',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: process.env.CI ? 90_000 : 60_000,
  expect: {
    timeout: process.env.CI ? 15_000 : 10_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [['list']],
});

```

### Core Architecture Module: `app/postcss.config.js`
```
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

### Core Architecture Module: `app/scripts/fetch-fonts.mjs`
```
#!/usr/bin/env node
/**
 * Vendor the app's webfonts into `public/fonts/` and generate
 * `src/styles/fonts.css` from the result.
 *
 * WHY THIS EXISTS: `index.css` used to `@import` Inter and JetBrains Mono from
 * fonts.googleapis.com. OpenHuman is an offline-capable desktop app, so on a
 * cold start without a network the CSS import fails and the entire UI renders
 * in a system fallback face — a first-run regression nobody sees in dev,
 * because dev machines are online and the font is already cached.
 *
 * Re-run after changing weights or families:
 *   node scripts/fetch-fonts.mjs
 *
 * It is deliberately a checked-in generator rather than a build step: fetching
 * from a third party during every build would put a network dependency back
 * into the thing this removes.
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// A modern desktop UA, so Google serves woff2 rather than legacy formats.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FAMILIES = [
  { family: 'Inter', slug: 'inter', weights: [300, 400, 500, 600, 700] },
  { family: 'JetBrains Mono', slug: 'jetbrains-mono', weights: [300, 400, 500, 600] },
];

const FONT_DIR = new URL('../public/fonts/', import.meta.url);
const OUT_CSS = new URL('../src/styles/fonts.css', import.meta.url);

/** Parses `/* subset *\/ @font-face { ... }` pairs out of Google's CSS. */
function parseFaces(css, family) {
  const faces = [];
  const re = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/gi;
  let match;
  while ((match = re.exec(css)) !== null) {
    const [, subset, body] = match;
    const weight = body.match(/font-weight:\s*(\d+)/)?.[1];
    const url = body.match(/src:\s*url\(([^)]+)\)/)?.[1];
    const unicodeRange = body.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!weight || !url || !unicodeRange) continue;
    faces.push({ family, subset, weight: Number(weight), url, unicodeRange: unicodeRange.trim() });
  }
  return faces;
}

async function main() {
  await mkdir(FONT_DIR, { recursive: true });
  for (const existing of await readdir(FONT_DIR).catch(() => [])) {
    if (existing.endsWith('.woff2')) await rm(new URL(existing, FONT_DIR));
  }

  const chunks = [
    `/*\n * GENERATED by scripts/fetch-fonts.mjs - do not edit by hand.\n *\n * Self-hosted so the desktop app renders its real typefaces offline.\n *\n * ONE FILE PER SUBSET, NOT PER WEIGHT: both families are variable fonts on\n * Google Fonts, so every weight of a given subset resolves to the identical\n * woff2. Emitting one @font-face per weight downloaded the same bytes five\n * times (59 files, 13 unique payloads). Each rule below therefore declares a\n * font-weight RANGE and the browser interpolates.\n *\n * unicode-range is preserved from Google's own CSS, so a Latin-only session\n * still loads only the Latin subset.\n */\n`,
  ];

  for (const { family, slug, weights } of FAMILIES) {
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weights.join(';')}&display=swap`;
    const res = await fetch(href, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`${family}: ${res.status} ${res.statusText}`);
    const css = await res.text();

    const faces = parseFaces(css, family);
    if (faces.length === 0) throw new Error(`${family}: parsed no @font-face blocks`);

    // Collapse to one entry per subset, asserting the payload really is shared.
    const bySubset = new Map();
    for (const face of faces) {
      const entry = bySubset.get(face.subset);
      if (!entry) {
        bySubset.set(face.subset, { ...face, urls: new Set([face.url]) });
        continue;
      }
      entry.urls.add(face.url);
      entry.weight = Math.max(entry.weight, face.weight);
    }

    const minWeight = Math.min(...weights);
    const maxWeight = Math.max(...weights);

    for (const [subset, entry] of bySubset) {
      if (entry.urls.size !== 1) {
        // Not a variable font for this subset - fall back to per-weight files
        // rather than silently dropping weights.
        throw new Error(
          `${family}/${subset}: ${entry.urls.size} distinct payloads; this generator assumes a variable font`
        );
      }
      const [url] = entry.urls;
      const filename = `${slug}-${subset}.woff2`;
      const fontRes = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!fontRes.ok) throw new Error(`${filename}: ${fontRes.status}`);
      await writeFile(new URL(filename, FONT_DIR), Buffer.from(await fontRes.arrayBuffer()));

      chunks.push(
        `@font-face {\n` +
          `  font-family: '${family}';\n` +
          `  font-style: normal;\n` +
          `  font-weight: ${minWeight} ${maxWeight};\n` +
          `  font-display: swap;\n` +
          `  src: url('/fonts/${filename}') format('woff2');\n` +
          `  unicode-range: ${entry.unicodeRange};\n` +
          `}\n`
      );
    }
    console.log(`${family}: ${bySubset.size} subsets (from ${faces.length} weight-subset pairs)`);
  }

  await writeFile(OUT_CSS, chunks.join('\n'));
  console.log(`wrote ${join('src', 'styles', 'fonts.css')}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

```

### Core Architecture Module: `app/scripts/lint-undefined-scales.mjs`
```
#!/usr/bin/env node
/**
 * lint:ui-tokens companion — fail on Tailwind utilities that name a scale or
 * token the theme never defines.
 *
 * Motivation: `ocean-*` shipped across ~26 component files and emitted ZERO
 * CSS, because `ocean` is not a colour in `tailwind.config.js` (it is only a
 * *theme preset id* in `src/lib/theme/presets.ts`). Those elements rendered
 * with no background, no text colour and no border. The old rg-based
 * `lint:ui-tokens` regex only banned scales that DO exist but are off-palette
 * (`neutral|stone|slate|canvas|white|black`), so an undefined scale — the more
 * damaging case, since it is silently invisible — slipped straight through.
 *
 * This script inverts the check: instead of a hand-maintained deny-list it
 * derives the ALLOWED names from the theme itself (`src/index.css`'s `@theme`
 * block plus Tailwind's own default theme) and fails on anything else.
 *
 * Two passes, because two different shapes of dead utility exist:
 *
 *  1. SHADED — `<utility>-<scale>-<shade>` whose `<scale>-<shade>` pair the
 *     theme does not define (`bg-ocean-500`).
 *  2. SHADELESS — `<utility>-<name>` (optionally `/<alpha>`) whose `<name>` is
 *     neither a bare colour (`--color-<name>`), a non-colour keyword of that
 *     utility (`text-center`, `border-dashed`), nor a named scale the utility
 *     reads (`--shadow-*` for `shadow-`, `--text-*` for `text-`). This pass is
 *     what catches `text-danger`, `text-ink`, `text-coral` / `bg-coral/20`
 *     (`coral` is defined only WITH shade steps), `bg-surface-secondary`,
 *     `text-md` and `shadow-strong` — every one of which renders with no
 *     colour, no size or no elevation at all.
 *
 * Deliberately NOT flagged:
 *  - bare words (`ocean` as a preset id, a CSS custom property `--ocean`, a
 *    comment) — only utility-shaped matches count;
 *  - arbitrary values (`bg-[#D97757]`, `transition-[border-color]`), which
 *    need no scale — bracket groups are stripped before matching;
 *  - non-shade numeric suffixes (`border-l-2`, `w-12`, `divide-y-0`), because
 *    the shaded pass requires a real Tailwind shade step and the shadeless
 *    pass requires every name segment to begin with a letter;
 *  - prose. The shadeless pass skips `src/lib/i18n/`, the tool phrase catalogue,
 *    and test files, where
 *    "text-to-speech", "to-do" and fixture strings like `bg-noise` are English
 *    and test data, not class lists. The shaded pass still scans them.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindColorsModule from 'tailwindcss/colors';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');

const SHADES = new Set([
  '50',
  '100',
  '150',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
]);

/** Colour-bearing utility prefixes, including directional border/divide forms. */
const UTILITY_PREFIXES = [
  'bg',
  'text',
  'border',
  'border-x',
  'border-y',
  'border-t',
  'border-r',
  'border-b',
  'border-l',
  'ring',
  'ring-offset',
  'divide',
  'divide-x',
  'divide-y',
  'outline',
  'shadow',
  'fill',
  'stroke',
  'accent',
  'caret',
  'decoration',
  'placeholder',
  'from',
  'to',
  'via',
];

/**
 * Non-colour names each utility legitimately accepts. Without these the
 * shadeless pass would flag `text-center`, `border-dashed` and friends, none
 * of which is a colour at all. Keyed by the exact prefix that matched, so a
 * directional form (`border-t-`) only ever accepts a colour.
 */
const NON_COLOR_NAMES = {
  bg: [
    'auto',
    'bottom',
    'center',
    'contain',
    'cover',
    'fixed',
    'left',
    'local',
    'none',
    'right',
    'scroll',
    'top',
  ],
  text: [
    'balance',
    'center',
    'clip',
    'ellipsis',
    'end',
    'justify',
    'left',
    'nowrap',
    'pretty',
    'right',
    'start',
    'wrap',
  ],
  border: [
    'b',
    'collapse',
    'dashed',
    'dotted',
    'double',
    'e',
    'hidden',
    'l',
    'none',
    'r',
    's',
    'separate',
    'solid',
    't',
    'x',
    'y',
  ],
  divide: [
    'dashed',
    'dotted',
    'double',
    'hidden',
    'none',
    'solid',
    'x',
    'x-reverse',
    'y',
    'y-reverse',
  ],
  'divide-x': ['reverse'],
  'divide-y': ['reverse'],
  outline: ['dashed', 'dotted', 'double', 'hidden', 'none', 'solid'],
  ring: ['inset'],
  shadow: ['none'],
  fill: ['none'],
  stroke: ['none'],
  accent: ['auto'],
  caret: [],
  decoration: [
    'auto',
    'clone',
    'dashed',
    'dotted',
    'double',
    'from-font',
    'none',
    'slice',
    'solid',
    'wavy',
  ],
  placeholder: [],
};

/**
 * Name FAMILIES (matched by leading segment) each utility accepts. These are
 * the multi-part non-colour utilities — `bg-linear-to-br`, `bg-clip-text`,
 * `fill-mode-forwards` (tw-animate-css) — where enumerating every member would
 * rot. A family entry allows `<prefix>-<family>` and `<prefix>-<family>-…`.
 */
const NON_COLOR_FAMILIES = {
  bg: [
    'blend',
    'clip',
    'conic',
    'gradient',
    'linear',
    'origin',
    'position',
    'radial',
    'repeat',
    'no-repeat',
    'size',
  ],
  text: ['shadow'],
  border: ['spacing'],
  fill: ['mode'],
  decoration: [],
};

/**
 * Hyphenated identifiers that are NOT class names but do look like one to the
 * regex, in files the shadeless pass still scans. Keep this list short and
 * justified — every entry is a hole in the check.
 *
 *  - `bg-image`   — a tailwind-merge class-group key in `src/lib/cn.ts`.
 *  - `stroke-*`   — SVG presentation attributes inside the inline data-URI
 *                   chevron in `src/components/ui/NativeSelect.tsx`.
 */
const NON_UTILITY_IDENTIFIERS = new Set([
  'bg-image',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-width',
]);

/**
 * Tailwind v4 removed `resolveConfig` and this app now defines its custom
 * palette in `src/index.css`'s `@theme` block. Build the effective shade set
 * from Tailwind's exported default palette plus every numeric
 * `--color-<scale>-<shade>` variable declared by the app, and the bare-name
 * sets (`--color-<name>`, `--shadow-<name>`, `--text-<name>`) alongside them.
 */
function shadeResolver() {
  const colors = tailwindColorsModule.default ?? tailwindColorsModule;
  const shades = new Set();
  const scaleNames = new Set();
  /** Colours usable with no shade step at all: `bg-white`, `text-content`. */
  const bareColors = new Set();
  /** Named scales `shadow-<name>` reads. */
  const shadowNames = new Set(['none']);
  /** Named scales `text-<name>` reads for font size. */
  const textScaleNames = new Set();
  /** Named scales `bg-<name>` reads for background images. */
  const backgroundImageNames = new Set();

  for (const [scale, values] of Object.entries(colors)) {
    if (typeof values === 'string') {
      // `inherit` / `current` / `transparent` / `black` / `white`.
      bareColors.add(scale);
      continue;
    }
    if (!values || typeof values !== 'object') continue;
    for (const shade of Object.keys(values)) {
      if (!/^\d+$/.test(shade)) continue;
      shades.add(`${scale}-${shade}`);
      scaleNames.add(scale);
    }
  }

  /** Fold one `@theme`-shaped stylesheet into the sets above. */
  const absorbThemeCss = css => {
    for (const [, name] of css.matchAll(/--color-([a-z][a-z0-9-]*)\s*:/g)) {
      const shaded = name.match(/^(.*)-(\d{1,3})$/);
      if (shaded) {
        shades.add(name);
        scaleNames.add(shaded[1]);
      } else {
        bareColors.add(name);
      }
    }
    for (const [, name] of css.matchAll(/--shadow-([a-z][a-z0-9-]*)\s*:/g)) shadowNames.add(name);
    for (const [, name] of css.matchAll(/--text-([a-z][a-z0-9-]*)\s*:/g)) {
      // Skip the paired `--text-<size>--line-height` / `--letter-spacing` keys.
      if (name.includes('--'))
```

### Core Architecture Module: `app/src-tauri-mobile/src/lib.rs`
```
// OpenHuman mobile (iOS + Android) Tauri host.
//
// No CEF runtime, no Rust core sidecar, no desktop chrome. The React app
// (built from `app/src/`) is loaded into a single WKWebView (iOS) /
// Android WebView; it talks to a remote desktop core via the TS-side
// TransportManager (LAN HTTP / encrypted tunnel / cloud HTTP — see
// `app/src/services/transport/`).

#[cfg(not(any(target_os = "ios", target_os = "android")))]
compile_error!(
    "openhuman-mobile only supports iOS and Android. Use crates/openhuman-app for desktop."
);

use tauri::{AppHandle, Runtime};

/// Tauri command: terminate the app cleanly. Used by the Settings page
/// "Sign out / forget device" flow when the user wants to back out of a
/// paired session.
#[tauri::command]
async fn app_quit<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    log::info!("[mobile] app_quit invoked");
    app.exit(0);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    log::info!("[mobile] run() — starting mobile Tauri builder");

    tauri::Builder::default()
        .plugin(tauri_plugin_barcode_scanner::init())
        // PTT ships Swift sources for iOS only; on Android the plugin
        // registers as a no-op stub (all commands return NotSupported).
        // See packages/tauri-plugin-ptt/src/lib.rs.
        .plugin(tauri_plugin_ptt::init())
        .invoke_handler(tauri::generate_handler![app_quit])
        .run(tauri::generate_context!())
        .expect("error while running mobile tauri application");
}

```

### Core Architecture Module: `app/src-tauri-mobile/src/main.rs`
```
fn main() {
    openhuman_mobile::run();
}

```

### Core Architecture Module: `app/src/App.tsx`
```
import * as Sentry from '@sentry/react';
import { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import {
  HashRouter as Router,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom';
import { PersistGate } from 'redux-persist/integration/react';

import AppRoutes from './AppRoutes';
import { AnalyticsPageTracker } from './components/analytics';
import AnnouncementGate from './components/Announcement/AnnouncementGate';
import AppBackground from './components/AppBackground';
import AppUpdatePrompt from './components/AppUpdatePrompt';
import BootCheckGate from './components/BootCheckGate/BootCheckGate';
import CommandProvider from './components/commands/CommandProvider';
import ServiceBlockingGate from './components/daemon/ServiceBlockingGate';
import DictationHotkeyManager from './components/DictationHotkeyManager';
import ErrorFallbackScreen from './components/ErrorFallbackScreen';
import HarnessInitOverlay from './components/InitProgressScreen/HarnessInitOverlay';
import KeyringConsentOverlay from './components/keyring/KeyringConsentOverlay';
import AppSidebar from './components/layout/shell/AppSidebar';
import RootShellLayout from './components/layout/shell/RootShellLayout';
import { SidebarSlotProvider } from './components/layout/shell/SidebarSlot';
import WindowDragBar from './components/layout/shell/WindowDragBar';
import WindowsWindowControls, {
  isWindowsDesktop,
} from './components/layout/shell/WindowsWindowControls';
import LocalAIDownloadSnackbar from './components/LocalAIDownloadSnackbar';
import NoticeCenter from './components/notices/NoticeCenter';
import OpenhumanLinkModal from './components/OpenhumanLinkModal';
import PersistRehydrationScreen from './components/PersistRehydrationScreen';
import PttHotkeyManager from './components/PttHotkeyManager';
import SecurityBanner from './components/SecurityBanner';
import AppWalkthrough from './components/walkthrough/AppWalkthrough';
import { useDevSkipOnboarding } from './hooks/useDevSkipOnboarding';
import { useNotchBootSync } from './hooks/useNotchBootSync';
import { I18nProvider } from './lib/i18n/I18nContext';
import {
  startNativeNotificationsService,
  stopNativeNotificationsService,
} from './lib/nativeNotifications';
import { getIsMobile } from './lib/platform';
import ChatRuntimeProvider from './providers/ChatRuntimeProvider';
import CoreStateProvider, { useCoreState } from './providers/CoreStateProvider';
import SocketProvider from './providers/SocketProvider';
import ThemeProvider from './providers/ThemeProvider';
import { startCoreHealthMonitor, stopCoreHealthMonitor } from './services/coreHealthMonitor';
import {
  startInternetStatusListener,
  stopInternetStatusListener,
} from './services/internetStatusListener';
import { persistor, store } from './store';
import { DEV_FORCE_ONBOARDING, DEV_SKIP_ONBOARDING } from './utils/config';
import { installExternalLinkGuard } from './utils/externalLinkGuard';
import { installFileDropGuard } from './utils/fileDropGuard';

startNativeNotificationsService();
// Connectivity status (#1527): wire navigator.onLine + start core sidecar
// health poll. Both idempotent via internal `started` guards.
startInternetStatusListener();
startCoreHealthMonitor();

export function stopBootServicesForHmr(): void {
  stopNativeNotificationsService();
  stopInternetStatusListener();
  stopCoreHealthMonitor();
}

if (import.meta.hot) {
  import.meta.hot.dispose(stopBootServicesForHmr);
}

function App() {
  const onMobile = getIsMobile();

  // The desktop shell is one webview with no back button, so a link that
  // navigates it away strands the user on that page with no route back to the
  // chat. Chat bubbles route their own links through `openUrl`; this guard
  // covers every other anchor the app renders. Installed here, above the
  // router, so it is live for the whole session.
  useEffect(() => installExternalLinkGuard(), []);

  // Same one-way trap for a dropped file: unclaimed, the webview opens it as
  // the top-level document. Only an open chat thread takes files; everywhere
  // else the drop is refused.
  useEffect(() => installFileDropGuard(), []);

  // On mobile (iOS or Android) the SocketProvider would try to connect to the
  // local core HTTP socket, which does not exist on device (the core runs on
  // the remote desktop). Gate it out to prevent spurious connection errors —
  // chat events arrive through TunnelTransport's socket.io relay instead.
  // NOTE: useHumanMascot's subscribeChatEvents() still returns a no-op unsub
  // when the socket is absent — mascot state falls back to 'idle'.
  const socketWrapped = (children: React.ReactNode) =>
    onMobile ? <>{children}</> : <SocketProvider>{children}</SocketProvider>;

  /*
   * @generated-source:provider-chain
   * Authoritative top-level provider / gate nesting for the desktop shell,
   * outermost first. Keep this list in sync with the JSX returned below;
   * `scripts/generate-architecture-docs.mjs` renders it into
   * `gitbooks/developing/architecture/frontend.md` and CI (`pnpm docs:check`)
   * fails if the doc drifts. Refresh the doc with `pnpm docs:generate`.
   * Format per line: `<order>. <Component> — <role>` (role must not contain " — ").
   * 1. Sentry.ErrorBoundary — Crash boundary; renders ErrorFallbackScreen
   * 2. Provider — Redux store; enables useAppSelector / dispatch app-wide
   * 3. PersistGate — Holds UI until persisted Redux slices rehydrate
   * 4. ThemeProvider — Theme tokens and dark-mode handling
   * 5. I18nProvider — Localization context consumed via useT
   * 6. BootCheckGate — Blocks render until the core boot snapshot resolves
   * 7. CoreStateProvider — Core app snapshot: auth, session, onboarding state
   * 8. SocketProvider — Core socket.io events; desktop only (mobile uses the TunnelTransport relay)
   * 9. ChatRuntimeProvider — Chat runtime events, tool timeline, and approvals
   * 10. Router — HashRouter navigation for all routes
   * 11. CommandProvider — Command palette context
   * 12. ServiceBlockingGate — Blocks the shell until required services are configured
   * @end-source:provider-chain
   */
  return (
    <div className={`relative h-screen overflow-hidden ${isWindowsDesktop() ? 'rounded-xs' : ''}`}>
      {!onMobile && <WindowDragBar />}
      <Sentry.ErrorBoundary
        fallback={({ error, componentStack, resetError, eventId }) => (
          <ErrorFallbackScreen
            error={error}
            componentStack={componentStack}
            eventId={eventId}
            onReset={resetError}
          />
        )}>
        <Provider store={store}>
          <PersistGate loading={<PersistRehydrationScreen />} persistor={persistor}>
            <ThemeProvider>
              <I18nProvider>
                {!onMobile && <WindowsWindowControls />}
                <BootCheckGate>
                  <CoreStateProvider>
                    {socketWrapped(
                      <ChatRuntimeProvider>
                        <Router>
                          <CommandProvider>
                            <ServiceBlockingGate>
                              <AnalyticsPageTracker />
                              <AppShell />
                              <SecurityBanner />
                              {!onMobile && <DictationHotkeyManager />}
                              {!onMobile && <PttHotkeyManager />}
                              {!onMobile && <LocalAIDownloadSnackbar />}
                              {!onMobile && <AppUpdatePrompt />}
                              <KeyringConsentOverlay />
                              <HarnessInitOverlay />
                              <AnnouncementGate />
                            </ServiceBlockingGate>
                          </CommandProvider>
                        </Router>
                      </ChatRuntimeProvider>
                    )}
                  </CoreStateProvider>
                </BootCheckGate>
              </I18n
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6766** (2026-09-29): **Auto-update is non-functional: update check reports asset=(none), so a newer version can never be downloaded**
  *Symptoms*: ## Description  The in-app updater correctly detects that a newer version exists but reports `asset=(none)`, so there is nothing to download and the update can never be applied. Every user is silently stuck on whatever build they installed manually.  **Build:** v0.64.6 → v0.64.7, macOS **Reproducible:** Yes — `asset=(none)` on every check, whether an update is available or not  ## Steps to Reproduce  1. Run a build one version behind the latest release (here: 0.64.6 with 0.64.7 published) 2. Wait for the periodic update check, or trigger one from the app 3. Read the `[update]` lines in `~/.openhuman/logs/`  ## Expected Behaviour  - When `update_available=true`, the check resolves a downloadable asset for the current platform and architecture - The user is offered an update they can actually install - If no asset can be resolved, that is surfaced as an error rather than reported as an available update  ## Actual Behaviour  ``` 11:24:01 INF [update] check complete — latest=0.64.7 current=0.64.6 update_available=true asset=(none) 11:24:01 WRN [update:scheduler] update available: 0.64.6 → 0.64.7 (download: (no asset)) ```  `update_available=true` with `asset=(none)`. The scheduler logs the availability and stops, because there is no artifact to fetch.  `asset=(none)` also appears when already current, so the field is empty on every check rather than only when behind:  ``` 11:35:10 INF [update] check complete — latest=0.64.7 current=0.64.7 update_available=false asset=(none) 11:35
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  Auto-update is non-functional: update check reports asset=(none), so a newer version can never be downloaded  Labelled `priority: p1`. 
  > Picking this one up.  This looks like an old fix that got lost in a later reshuffle: the check is hunting for a filename shape the releases stopped publishing, and the download side lost the matching piece at the same time, so fixing only the first half would swap one broken update for another. Planning to restore both and cover them with tests.

- **Issue #6732** (2026-09-28): **[TinyAgents] Harness fence guard drops bare-fenced tool calls on the unary path only, contradicting tinytools' fence policy**
  *Symptoms*: ## Summary  `tinyagents-harness` has its own fence guard, `text_dialect_markup_only_in_fenced_code` (`crates/tinyagents-harness/src/agent_loop/run_loop.rs:2381`, pin `3789696` = tinyagents main). It skips text-call recovery **entirely** when every line containing `<tool_call` sits inside a ```` ``` ```` fence. That contradicts the fence policy `tinytools-agent` already applies inside its parser (`parse/protected.rs`):  - a fence **with a language tag** (```` ```xml ````, ```` ```text ````) is protected, so quoted examples are never parsed; - a **bare** fence is *not* protected ("small models wrap a genuine call in a bare fence far more often than they quote one"); - a fence whose info string is a call tag is a call (refined by tinytools #30).  The guard only runs on the unary/batch path (`recover_text_dialect_calls`). The streaming path goes through `StreamScrubber`, which uses tinytools' policy. **So the same reply is dispatched or dropped depending on whether it was streamed.**  ## Evidence (harness, xml dialect, `max_model_calls: 2`, tinytools `52e9ab1`)  | Reply | unary: calls dispatched | streamed: calls dispatched | |---|---:|---:| | ```` ```\n<tool_call>{json call}</tool_call>\n``` ```` (bare fence) | **0** | 2 (one per model call; the mock replays) | | ```` Example:\n```xml\n<tool_call>{json call}</tool_call>\n``` ```` | 0 | 0 |  The ```` ```xml ```` row shows tinytools' own protection already stops quoted examples on both paths. The only thing the harness guard adds 
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  Harness fence guard drops bare-fenced tool calls on the unary path, contradicting tinytools' fence policy  Labelled `priority: p1`. 

- **Issue #6723** (2026-09-28): **[TinyAgents] Claimed-but-undecodable tool blocks are removed silently: no call, no nudge, no log**
  *Symptoms*: ## Summary  With a text tool-call dialect (xml / P-Format), a `<tool_call>` block that the tinytools grammar **claims but cannot decode** disappears. The stream scrubber cuts it out of the visible text and it produces zero calls. The harness never sees a signal, so the turn ends on whatever prose came before the block (usually "Let me search for …"). There is no call, no re-prompt and no log line. The user sees a promise, and the agent then waits.  ## Where the signal is lost (tinyagents `3789696` = upstream main)  - `tinytools-agent` `StreamScrubber::feed/flush` and `parse_text` both report `ParseDiagnostic::MalformedBlock` for such a block. - `tinyagents-harness/src/agent_loop/dialect.rs:483-491`: `DeltaScrubber::feed/flush` collect `step.calls` and **drop `step.diagnostics`**. - `dialect.rs:405`: `recover_text_calls` returns early when there are no calls, **before** its diagnostics loop at `:408`. The failure is not logged even at debug. - `run_loop.rs:1535-1549`: the existing dropped-call nudge (`RunPolicy::dropped_tool_call_nudges`, default 3) only fires on `finish_reason == "tool_calls"`. A text dialect always finishes with `stop`, so on this path the nudge can never fire. - `repeat_progress` / `no_progress` / `repeated_tool_failure` key on tool calls within one run. Each follow-up user message starts a fresh 1-iteration run with zero calls, so none of them can see the problem.  ## Evidence (thread with `dispatcher: xml`, `openrouter/deepseek/deepseek-v4-flash`)  15 tur
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  Claimed-but-undecodable tool blocks are removed silently: no call, no nudge, no log  Labelled `priority: p1`. 

- **Issue #6721** (2026-09-28): **trim_history splits tool-call groups: thread past 50 messages opens with orphaned tool results, provider rejects every later turn**
  *Symptoms*: ## Summary  `trim_history` (`crates/openhuman-core/src/agent/session_host/driver.rs:427`) bounds the durable history to `max_history_messages` (default 50, `config/schema/agent.rs`) with a raw `history.drain(..)`. It is not tool-pair aware: when the cut lands inside an assistant tool-call group, the assistant turn is dropped but some of its `tool` results are kept. With native tool calling, every later request then opens with orphaned `tool` messages and the provider rejects **every subsequent turn** of the thread — the thread is permanently stuck once it passes ~50 messages.  ## Evidence (proxy capture of a real repro, native tool calling — shapes only)  | Request | Messages | Head after the system prefix | |---|---|---| | req-029 | 61 | `system, system, user, assistant, user, assistant(tool_calls=2) …` | | req-031 | 53 | `system, system, **tool, tool**, system, assistant(tool_calls=2) …` | | req-032…038 | 53–54 | same — index 2 and 3 are `tool` |  Between req-029 and req-031 the trim dropped an assistant message that issued 3 tool calls plus the first result, and kept the other 2 results. The provider answered **HTTP 200 with an error body** for calls #31–#40 (every turn after the trim):  ``` Message at index 2 has role 'tool' but is not preceded by an assistant message with a matching tool_call ```  The history is persisted trimmed, so the thread never recovers.  ## Fix direction  The harness already ships a pairing-safe cutoff: `tinyagents_harness::summarization::find_saf
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  trim_history splits tool-call groups causing orphaned tool results; provider rejects later turns, thread permanently stuck after ~50 messages  Labelled `priority: p1`. 

- **Issue #6716** (2026-09-30): **guild.tinyhumans.ai: GitHub quest verification fails — 403 on stargazers, follow checks report not-following for followed accounts**
  *Symptoms*: ## Description  Quest verification on [guild.tinyhumans.ai](https://guild.tinyhumans.ai/) fails for every GitHub quest. Star quests fail with a hard `403 Resource not accessible by personal access token`, and Follow quests report "Not following yet" for a member who has already followed. Because the check never succeeds, the quests can never be completed and no points are awarded.  The star failure is unambiguous — the surfaced text matches `internal/guild/quests.go` exactly, where `GithubStar.fetch` wraps the error as `fmt.Errorf("github: stargazers of %s: %w", repo, err)` around a call to `GET /repos/{repo}/stargazers`.  **Site:** https://guild.tinyhumans.ai/ **Repo:** [tinyhumansai/teeny-guild-bot](https://github.com/tinyhumansai/teeny-guild-bot) @ 2026-09-26 **Reproducible:** Yes — every GitHub quest, every refresh  ## Steps to Reproduce  1. Sign in to https://guild.tinyhumans.ai/ and connect a GitHub account 2. Star `tinyhumansai/openhuman` and `tinyhumansai/opencompany`; follow `tinyhumansai` and `senamakel` on GitHub 3. Return to the Quests tab and press the refresh control on each GitHub quest 4. Observe every GitHub quest still reports failure or "not yet"  ## Expected Behaviour  - Starring a tracked repo completes "Star OpenHuman" / "Star OpenCompany" and awards 200 points each - Following a tracked account completes "Follow tinyhumansai" / "Follow senamakel" and awards 100 points each - Verification that cannot run reports a state the member can act on, not a raw u
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  GitHub quest verification on guild.tinyhumans.ai fails for star (403 from stargazers endpoint) and follow (falsely reports not following) quests, making all GitHub quests uncompletable. Core reward path broken with no workaround.  Labelled `priority: p1`. 

- **Issue #6715** (2026-09-29): **Teeny: auto-filed GitHub issues need the standard format — uninformative titles, no repro/expected/actual/acceptance sections**
  *Symptoms*: ## Description  Teeny successfully files GitHub issues from Discord bug reports — [tinyhumansai/opencompany#2434](https://github.com/tinyhumansai/opencompany/issues/2434) was created end to end with no human involvement, which is the hard part working. The problem is the shape of what it files: the issue is a verbatim paste of the Discord message plus Teeny's research notes, with no structure a developer can work from.  Issues Teeny files should follow the house format established by [tinyhumansai/openhuman#6247](https://github.com/tinyhumansai/openhuman/issues/6247): Description with build and reproducibility, Steps to Reproduce, Expected Behaviour, Actual Behaviour, Impact, Acceptance Criteria.  **Repo:** [tinyhumansai/teeny-guild-bot](https://github.com/tinyhumansai/teeny-guild-bot) @ 2026-09-26 **Reproducible:** Yes — every issue Teeny files has this shape  ## Steps to Reproduce  1. Post a bug report in a Discord channel Teeny watches 2. Let triage classify it as a bug with confidence ≥ 0.8 and a known product, so `ShouldFile` fires (`internal/qa/issue.go`) 3. Open the issue Teeny creates — e.g. opencompany#2434  ## Expected Behaviour  - **Title** summarises the defect, e.g. "OpenCompany: Google 2FA login leaves a blank screen; email-code fallback fails with no mail gateway" - **Body** follows the #6247 headings:   - `## Description` — prose summary, plus `**Build:**` and `**Reproducible:**`   - `## Steps to Reproduce` — numbered, extracted from the report rather than lef
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  Teeny's auto-filed GitHub issues from Discord bug reports lack standard format: uninformative titles, no repro/expected/actual/acceptance sections, making issues unfindable and hard to close.  Labelled `priority: p1`. 
  > <!-- tinysweeper:issue-triage -->  Teeny's auto-filed GitHub issues from Discord bug reports lack standard format: uninformative titles, no repro/expected/actual/acceptance sections, making issues unfindable and hard to close.  Labelled `priority: p2`. 

- **Issue #6710** (2026-09-28): **Prompt-injection detector blocks tool results as user input, permanently bricking the thread (fetching our own GitHub issues scores 0.72)**
  *Symptoms*: The prompt-injection detector scans **tool results** as if the user had typed them. Fetching your own GitHub issues — whose titles and bodies are full of words like `credential`, `auth` and `OAuth` — scores 0.72 and blocks the turn. The thread is then permanently unusable, and the UI tells the user to "try again", which is the one thing guaranteed to fail.  Reproduced on **v0.64.4**, macOS, clean install, `openrouter/deepseek/deepseek-v4-flash`.  ## What the user sees  Three consecutive turns, each returning a red `Something went wrong. Please try again.` card. Nothing in the UI names what was blocked or why. Two of the three failing messages were `?` and `why this error?` — neither has anything to block.  ## What the log says  ``` 23:03:28 WRN [tinyagents::host::security] blocked untrusted input              source=agent.user  score=0.7200000286102295  chars=25299              codes=exfiltration.intent,exfiltrate.secrets,tool.abuse 23:03:28 WRN [journal] run failed error=model error: hosted agent invocation failed 23:03:28 ERR agent.run_single failed: driver failed: tinyagents harness run failed 23:03:28 WRN [web-channel] dropping session agent after failed turn —              next turn cold-boots from the durable transcript ```  Four blocks in the session, all byte-identical: same score, same code set, same `chars=25299`.  ## The blocked content is a tool result, not user input  `chars=25299` matches row 46 of `session_raw/thread-d5e72767-…jsonl` exactly. That row is the to
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  Prompt-injection detector misclassifies tool results as user input, permanently bricking threads with no recovery.  Labelled `priority: p1`. 
  > ## New evidence: the real detector run on the real transcript  I ran `security/prompt_injection/detector.rs` unchanged in a small probe (`enforce_prompt_input`, `source = "agent.user"`, the same call `security_gate.rs::screen_input` makes). The input was every user-role row that the text dialect replays each turn. Only scores, rule codes and sizes appear below. No transcript content.  **Broken thread `d5e72767`**: 18 replayed user-role rows. 12 of them are `[Tool results]` rows and 6 are typed messages.  | user-role row | kind | verdict | score | codes | chars | |---|---|---|---|---|---| | 17 (last) | `[Tool results]`, 4 coalesced `<tool_result>` blocks | **Blocked** | **0.72** | `exfiltration.intent`, `exfiltrate.secrets`, `tool.abuse` | 25,299 | | 2, 3, 5, 10, 16 | mixed | Allow | 0.18 | `exfiltrate.secrets` | 1.2k–16.6k | | the other 12 | | Allow | 0.00 | | |  **Near-miss on the surviving thread `2279c1d8`**: 24 user-role rows. Row 23 is its GitHub `[Tool results]` row and scored **

- **Issue #6675** (2026-09-25): **continue_subagent rejects a durable session ID supplied as agent_id**
  *Symptoms*: ## Summary  In a production OpenHuman 0.63.12 turn, two `continue_subagent` calls failed because the caller put a durable `subsess-…` ID in both `task_id` and `agent_id`. The corresponding `scheduler_agent` sessions were idle and eligible to resume.  ## Problem  Observed September 25, 2026 at 13:36:25 and 13:36:53 UTC in the production Langfuse project. Both calls returned `agent_id mismatch` before the worker received the follow-up. The tool schema expects the worker type in `agent_id`, but the roster prominently exposes the durable session ID, which the caller reused in both fields.  Minimal reproduction: seed an idle durable subagent session, then call `continue_subagent` with its session ID in both fields and a follow-up message. Expected: resume that exact parent-owned worker using its stored agent type. Actual in 0.63.12: mismatch error. Platform is not recorded in the trace.  ## Solution  Resolve the durable session within the parent-scoped store first. Accept its exact session ID as an alias in `agent_id`, while continuing to reject unrelated agent IDs. PR #6674 implements this on current `main`.  ## Acceptance criteria  - [ ] **Repro gone** — A follow-up with the same durable session ID in both fields resumes the worker. - [ ] **Regression safety** — An unrelated agent ID still fails, and the resumed worker retains its prior history. - [ ] **Diff coverage ≥ 80%** — the fix PR meets the changed-lines coverage gate. - [ ] **Release verification** — Confirm the fix in a
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  continue_subagent rejects a durable session ID supplied as agent_id, causing mismatch error; expected to accept session ID as alias for the worker type.  Labelled `priority: p2`. 

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

### Incident Patch 1: `667aea21` (2026-09-30)
**Commit Message**: Merge pull request #6841 from YellowSnnowmann/fix/6718-hosted-memory

fix(memory): make hosted memory recall, refuse and sync correctly

**File**: `app/src/components/settings/panels/MemoryDataPanel.tsx` (modified, +3/-1)
```diff
@@ -88,7 +88,9 @@ const MemoryDataPanel = ({ embedded = false }: MemoryDataPanelProps = {}) => {
             </div>
           </dl>
         </SettingsSection>
-        <VaultHealthChecklist onToast={addToast} title={t('vaultHealth.setupTitle')} />
+        <MemoryFamilyGate family="tree">
+          <VaultHealthChecklist onToast={addToast} title={t('vaultHealth.setupTitle')} />
+        </MemoryFamilyGate>
         <MemoryWindowControl onError={handleWindowError} onSaved={handleWindowSaved} />
         <MemoryFamilyGate family="tree">
           <MemoryWorkspace onToast={addToast} />
```

**File**: `app/src/components/settings/panels/MemoryEngineErrorAlert.test.tsx` (modified, +15/-0)
```diff
@@ -25,6 +25,21 @@ describe('MemoryEngineErrorAlert', () => {
     expect(screen.getByTestId('memory-engine-sign-in')).toBeInTheDocument();
   });
 
+  test('a refused credential is its own state, never a sign-in prompt', () => {
+    renderWithProviders(
+      <MemoryEngineErrorAlert error="MEMORY_FORBIDDEN: the memory engine refused this credential" />
+    );
+    expect(screen.getByTestId('memory-engine-error-memory_forbidden')).toBeInTheDocument();
+    expect(screen.queryByTestId('memory-engine-sign-in')).toBeNull();
+  });
+
+  test('an unreachable engine shows the unavailable state', () => {
+    renderWithProviders(
+      <MemoryEngineErrorAlert error="MEMORY_UNREACHABLE: the memory engine is not available right now" />
+    );
+    expect(screen.getByTestId('memory-engine-error-backend_unavailable')).toBeInTheDocument();
+  });
+
   test('any other error shows the caller fallback text and no action', () => {
     renderWithProviders(<MemoryEngineErrorAlert error="boom" fallbackText="Graph failed" />);
     expect(screen.getByTestId('memory-engine-error-other')).toHaveTextContent('Graph failed');
```

**File**: `app/src/components/settings/panels/MemoryEngineErrorAlert.tsx` (modified, +5/-3)
```diff
@@ -12,9 +12,11 @@ export function useMemoryEngineErrorText(): (kind: MemoryEngineErrorKind) => str
       ? t('memoryEngine.error.insufficientCredits')
       : kind === 'session_expired'
         ? t('memoryEngine.error.sessionExpired')
-        : kind === 'backend_unavailable'
-          ? t('memoryEngine.error.backendUnavailable')
-          : t('memoryEngine.error.generic');
+        : kind === 'memory_forbidden'
+          ? t('memoryEngine.error.forbidden')
+          : kind === 'backend_unavailable'
+            ? t('memoryEngine.error.backendUnavailable')
+            : t('memoryEngine.error.generic');
 }
 
 interface MemoryEngineErrorAlertProps {
```

**File**: `app/src/components/settings/panels/memoryEngineUtils.ts` (modified, +7/-1)
```diff
@@ -3,6 +3,7 @@ import type { MemoryEngineDescriptor } from '../../../utils/tauriCommands/memory
 export type MemoryEngineErrorKind =
   | 'insufficient_credits'
   | 'session_expired'
+  | 'memory_forbidden'
   | 'backend_unavailable'
   | 'other';
 
@@ -11,7 +12,12 @@ export function classifyMemoryEngineError(err: unknown): MemoryEngineErrorKind {
   const message = err instanceof Error ? err.message : String(err ?? '');
   if (message.includes('INSUFFICIENT_CREDITS:')) return 'insufficient_credits';
   if (message.includes('SESSION_EXPIRED:')) return 'session_expired';
-  if (message.includes('BACKEND_UNAVAILABLE:')) return 'backend_unavailable';
+  // A refused credential (an API key without the memory scope): not a lapsed
+  // session, so it must never read as one and sign the user out.
+  if (message.includes('MEMORY_FORBIDDEN:')) return 'memory_forbidden';
+  if (message.includes('BACKEND_UNAVAILABLE:') || message.includes('MEMORY_UNREACHABLE:')) {
+    return 'backend_unavailable';
+  }
   return 'other';
 }
 
```

**File**: `app/src/lib/i18n/ar.ts` (modified, +2/-0)
```diff
@@ -7129,6 +7129,8 @@ const messages: TranslationMap = {
     'نفد رصيد OpenHuman لديك. أضف رصيدًا لاستخدام هذا المحرك.',
   'memoryEngine.error.sessionExpired': 'انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.',
   'memoryEngine.error.backendUnavailable': 'خدمة الذاكرة غير متاحة حاليًا. حاول مرة أخرى بعد قليل.',
+  'memoryEngine.error.forbidden':
+    'رفضت خدمة الذاكرة بيانات اعتماد هذا الحساب. إذا كنت تستخدم مفتاح API، فامنحه نطاق memory.',
   'memoryEngine.error.generic': 'تعذّر تغيير محرك الذاكرة. تحقق من الإعدادات وحاول مرة أخرى.',
   'memoryEngine.error.openBilling': 'فتح الفوترة',
   'memoryEngine.error.signIn': 'تسجيل الدخول',
```

---

### Incident Patch 2: `a1b98aa5` (2026-09-30)
**Commit Message**: fix(memory): let only the outermost error class decide a string's classification

A message's class is its outermost MemoryError class tag, at the start or
after a caller's context wrapper. Before, a tag quoted in the error's detail
could decide it: `invalid input: upstream error: unauthorized: (HTTP 403
Forbidden)` read MEMORY_FORBIDDEN, and a quoted `unavailable: ` read
MEMORY_UNREACHABLE. Both checks now read the outermost class.

A message with no class tag is a bare adapter payload, and its first status
is its own. So a hosted 403 without a backend code still keeps the user
signed in.

**File**: `crates/openhuman-core/src/memory/ops/engine.rs` (modified, +45/-19)
```diff
@@ -246,18 +246,42 @@ fn is_forbidden(message: &str) -> bool {
         .is_some_and(|at| message[at..].starts_with("(HTTP 403 Forbidden)"))
 }
 
-/// The `MemoryError::Unauthorized` rendering inside `message`, from after its
-/// `unauthorized: ` class tag: at the start, or after a caller's `context: `
-/// wrapper. The string path reads a 403 only here, the way the typed path
-/// reads it only in `Unauthorized`.
-fn unauthorized_clause(message: &str) -> Option<&str> {
-    const CLASS: &str = "unauthorized: ";
-    const WRAPPED: &str = ": unauthorized: ";
-    message.strip_prefix(CLASS).or_else(|| {
-        message
-            .find(WRAPPED)
-            .map(|at| &message[at + WRAPPED.len()..])
-    })
+/// `MemoryError`'s class tags, as its `Display` renders each variant.
+const MEMORY_ERROR_CLASSES: [&str; 12] = [
+    "not found: ",
+    "invalid input: ",
+    "budget exceeded: ",
+    "path escapes workspace: ",
+    "io error: ",
+    "serde error: ",
+    "unsupported capability: ",
+    "unauthorized: ",
+    "unreachable: ",
+    "timed out: ",
+    "unavailable: ",
+    "backend failed: ",
+];
+
+/// The not-now classes: the engine could not be reached or cannot serve yet.
+const NOT_NOW_CLASSES: [&str; 3] = ["unavailable: ", "unreachable: ", "timed out: "];
+
+/// The class of the error `message` renders, with the text after its tag:
+/// the outermost `MemoryError` class tag, at the start or after a caller's
+/// `context: ` wrapper. A tag further in is quoted detail of that error (an
+/// upstream body, say), never its class.
+fn memory_error_class(message: &str) -> Option<(&'static str, &str)> {
+    MEMORY_ERROR_CLASSES
+        .into_iter()
+        .filter_map(|class| {
+            let at = if message.starts_with(class) {
+                0
+            } else {
+                message.find(&format!(": {class}"))? + 2
+            };
+            Some((at, class))
+        })
+        .min_by_key(|&(at, _)| at)
+        .map(|(at, class)| (class, &message[at + class.len()..]))
 }
 
 /// [`classify_engine_error`] for a failure that is already a string.
@@ -274,7 +298,14 @@ pub fn classify_engine_message(message: &str) -> String {
     if message.contains("USER_INSUFFICIENT_CREDITS") {
         return format!("{INSUFFICIENT_CREDITS_PREFIX} the memory engine is out of credits");
     }
-    if unauthorized_clause(message).is_some_and(is_forbidden) {
+    // Only the error's own class decides, never a class quoted in its detail.
+    let class = memory_error_class(message);
+    let forbidden = match class {
+        Some((class, detail)) => class == "unauthorized: " && is_forbidden(detail),
+        // No class tag: a bare adapter message, whose first status is its own.
+        None => is_forbidden(message),
+    };
+    if forbidden {
         return format!("{MEMORY_FORBIDDEN_PREFIX} the memory engine refused this credential");
     }
     if message.contains(SESSION_EXPIRED_PREFIX)
@@ -283,12 +314,7 @@ pub fn classify_engine_message(message: &str) -> String {
     {
         return format!("{SESSION_EXPIRED_PREFIX} no TinyHumans session");
     }
-    // `MemoryError`'s own renderings of the not-now classes, at the start of
-    // the message or after a caller's `context: ` wrapper.
-    if ["unavailable: ", "unreachable: ", "timed out: "]
-        .iter()
-        .any(|class| message.starts_with(class) || message.contains(&format!(": {class}")))
-    {
+    if class.is_some_and(|(class, _)| NOT_NOW_CLASSES.contains(&class)) {
         return format!("{MEMORY_UNREACHABLE_PREFIX} the memory engine is not available right now");
     }
     message.to_string()
```

**File**: `crates/openhuman-core/src/memory/ops/engine_tests.rs` (modified, +25/-0)
```diff
@@ -214,6 +214,31 @@ fn a_403_counts_only_as_the_unauthorized_errors_own_status() {
     assert_eq!(classify_engine_message(other), other);
 }
 
+#[test]
+fn a_class_quoted_in_another_errors_detail_does_not_decide_it() {
+    // The outermost class tag is the error's class. A tag quoted in its detail
+    // (an upstream body, say) is not.
+    for quoted in [
+        "invalid input: upstream error: unauthorized: (HTTP 403 Forbidden)",
+        "invalid input: upstream error: unavailable: busy",
+        "not found: upstream error: timed out: after 30s",
+    ] {
+        assert_eq!(classify_engine_message(quoted), quoted);
+    }
+    // A caller's context wrapper is not a class, so the class after it decides.
+    let wrapped = classify_engine_message("memory recall failed: unavailable: busy");
+    assert!(wrapped.starts_with(MEMORY_UNREACHABLE_PREFIX), "{wrapped}");
+    // A bare adapter message has no class tag and its first status is its own,
+    // so a hosted 403 without a backend code still keeps the user signed in.
+    let bare = "[UNAUTHORIZED] memory API memory/recall on host (HTTP 403 Forbidden): \
+                Forbidden — the session expired or the API key was rejected; re-authenticate";
+    let classified = classify_engine_message(bare);
+    assert!(
+        classified.starts_with(MEMORY_FORBIDDEN_PREFIX),
+        "{classified}"
+    );
+}
+
 #[test]
 fn an_engine_that_cannot_serve_now_is_unreachable() {
     for error in [
```

---

### Incident Patch 3: `c0fe1f95` (2026-09-30)
**Commit Message**: chore(memory): pin tinymemory with the hosted driver hardening

Moves vendor/tinymemory from 99cdd6e to 21369bdf, the merge of
tinyhumansai/tinymemory#175. For hosted memory this brings:

- A health probe the memory API accepts. The old `zz_health` prefix fails
  the API's `type:id` scope grammar, so the probe could never pass.
- Keyed writes and tombstones retried under one idempotency claim, with
  recovery when a write's outcome is unknown.
- Export and import that step over empty namespaces, for migrations.
- The hosted wire's scope-depth limit (31 segments, one fewer than the
  direct wire).

tinymemory#175 changes only crates the core links directly: the remote
drivers, the conformance suite and an example. The loadable module, its
contract and the bus are unchanged, so the registry's module pin does not
need to move for it.

**File**: `vendor/tinymemory` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 99cdd6e33fbf6ecb1ce5d50af9526b6002af0f9a
+Subproject commit 21369bdf5dc24247efa5f9ddc18709e6485617bf
```

---

### Incident Patch 4: `eeb9ad6a` (2026-09-30)
**Commit Message**: fix(memory): hold the refusal block to the recall budget and anchor the 403 check

- The auto-recall refusal block respects `recall_max_chars`. It is kept
  whole when it fits and left out otherwise, like a recall line that does
  not fit.
- `is_forbidden` reads only the adapter's own status, which is the first one
  in the message, and requires exactly `(HTTP 403 Forbidden)`. On the string
  path it applies only inside the `unauthorized: ` clause. A 401 that quotes
  a 403 is not read as a refused credential, and neither is another error
  class that quotes one.
- The hosted Sync History E2E test says what it proves: the handler answers
  from the host log. The registry gate is open only because that fixture
  builds no context.

**File**: `crates/openhuman-core/src/memory/auto_recall/mod.rs` (modified, +2/-1)
```diff
@@ -257,7 +257,8 @@ impl AutoRecall {
             );
             // A refused lookup is not an empty one: say why, so the answer is
             // "memory is unavailable" rather than "that was never stored".
-            return refusal.map(refusal::render_refusal_block);
+            return refusal
+                .and_then(|refusal| refusal::render_refusal_block(refusal, self.recall_max_chars));
         }
         let block = render_block(&notes.hits, &tree.hits, self.recall_max_chars);
         log::info!(
```

**File**: `crates/openhuman-core/src/memory/auto_recall/refusal.rs` (modified, +21/-4)
```diff
@@ -14,7 +14,7 @@ use crate::memory::ops::engine::{
     MEMORY_UNREACHABLE_PREFIX, SESSION_EXPIRED_PREFIX,
 };
 
-use super::AUTO_RECALL_BANNER;
+use super::{fits_within, AUTO_RECALL_BANNER};
 
 /// Why memory could not be searched for a message.
 #[derive(Clone, Copy, Debug, PartialEq, Eq)]
@@ -77,13 +77,30 @@ impl MemoryRefusal {
 
 /// The block for a lookup that was refused and found nothing else: the usual
 /// banner over one line saying why memory is out of reach.
-pub(crate) fn render_refusal_block(refusal: MemoryRefusal) -> String {
-    format!(
+///
+/// It is held to `recall_max_chars` like any recall block. The reason is one
+/// sentence, so a cap it does not fit whole leaves the block out rather than
+/// cutting it.
+pub(crate) fn render_refusal_block(
+    refusal: MemoryRefusal,
+    recall_max_chars: Option<usize>,
+) -> Option<String> {
+    let block = format!(
         "{AUTO_RECALL_BANNER}\n\nMemory could not be searched for this message: {}. \
          If the user asks about something they saved, say that memory is unavailable \
          and why, rather than that it was never stored.\n\n",
         refusal.reason()
-    )
+    );
+    let chars = block.chars().count();
+    if !fits_within(0, chars, recall_max_chars) {
+        log::debug!(
+            "[auto_recall] refusal block omitted: {chars} chars would exceed \
+             recall_max_chars={recall_max_chars:?} refusal={}",
+            refusal.label()
+        );
+        return None;
+    }
+    Some(block)
 }
 
 #[cfg(test)]
```

**File**: `crates/openhuman-core/src/memory/auto_recall/refusal_tests.rs` (modified, +22/-1)
```diff
@@ -62,11 +62,32 @@ fn an_ordinary_failure_is_not_a_refusal() {
 
 #[test]
 fn the_refusal_block_heads_the_reason_with_the_usual_banner() {
-    let block = render_refusal_block(MemoryRefusal::OutOfCredits);
+    let block = render_refusal_block(MemoryRefusal::OutOfCredits, None).expect("no cap");
     assert!(block.starts_with(AUTO_RECALL_BANNER), "{block}");
     assert!(block.contains("out of credits"), "{block}");
     assert!(
         block.contains("rather than that it was never stored"),
         "{block}"
     );
 }
+
+#[test]
+fn the_refusal_block_is_held_to_the_recall_budget() {
+    for refusal in [
+        MemoryRefusal::OutOfCredits,
+        MemoryRefusal::SessionExpired,
+        MemoryRefusal::Forbidden,
+        MemoryRefusal::Unavailable,
+    ] {
+        let whole = render_refusal_block(refusal, None).expect("no cap");
+        let chars = whole.chars().count();
+        // A cap the block fits exactly keeps it whole.
+        assert_eq!(
+            render_refusal_block(refusal, Some(chars)).as_deref(),
+            Some(whole.as_str())
+        );
+        // One character short leaves it out: a cut reason would mislead.
+        assert_eq!(render_refusal_block(refusal, Some(chars - 1)), None);
+        assert_eq!(render_refusal_block(refusal, Some(0)), None);
+    }
+}
```

**File**: `crates/openhuman-core/src/memory/auto_recall/unscored_lane_tests.rs` (modified, +20/-0)
```diff
@@ -73,6 +73,26 @@ async fn a_credit_refusal_tells_the_model_why_memory_is_empty() {
     assert!(block.contains("out of credits"), "{block}");
 }
 
+#[tokio::test]
+async fn a_refusal_block_stays_within_the_guards_recall_budget() {
+    let tight = AutoRecall::new(
+        Scripted::hits(vec![]).with_refused_notes(out_of_credits),
+        true,
+        Some(40),
+    );
+    assert!(tight.block_for(TEA_QUESTION).await.is_none());
+    let roomy = AutoRecall::new(
+        Scripted::hits(vec![]).with_refused_notes(out_of_credits),
+        true,
+        Some(4_000),
+    );
+    let block = roomy
+        .block_for(TEA_QUESTION)
+        .await
+        .expect("a refusal block");
+    assert!(block.contains("out of credits"), "{block}");
+}
+
 #[tokio::test]
 async fn an_unreachable_engine_is_named_not_mistaken_for_an_empty_one() {
     let source = Scripted::hits(vec![]).with_refused_notes(unreachable);
```

**File**: `crates/openhuman-core/src/memory/ops/engine.rs` (modified, +22/-4)
```diff
@@ -236,10 +236,28 @@ pub fn classify_memory_error(error: &crate::memory::api::error::MemoryError) ->
 }
 
 /// Whether an `Unauthorized` message is a 403: the credential was valid and
-/// refused, as opposed to missing or lapsed. The remote adapters render the
-/// status into the message (`(HTTP 403 Forbidden)`).
+/// refused, as opposed to missing or lapsed. Both remote adapters render the
+/// status they received ahead of any body text, as `(HTTP 403 Forbidden)`, so
+/// only the message's first status counts: a 401 whose body quotes an
+/// upstream 403 is still a lapsed session.
 fn is_forbidden(message: &str) -> bool {
-    message.contains("(HTTP 403")
+    message
+        .find("(HTTP ")
+        .is_some_and(|at| message[at..].starts_with("(HTTP 403 Forbidden)"))
+}
+
+/// The `MemoryError::Unauthorized` rendering inside `message`, from after its
+/// `unauthorized: ` class tag: at the start, or after a caller's `context: `
+/// wrapper. The string path reads a 403 only here, the way the typed path
+/// reads it only in `Unauthorized`.
+fn unauthorized_clause(message: &str) -> Option<&str> {
+    const CLASS: &str = "unauthorized: ";
+    const WRAPPED: &str = ": unauthorized: ";
+    message.strip_prefix(CLASS).or_else(|| {
+        message
+            .find(WRAPPED)
+            .map(|at| &message[at + WRAPPED.len()..])
+    })
 }
 
 /// [`classify_engine_error`] for a failure that is already a string.
@@ -256,7 +274,7 @@ pub fn classify_engine_message(message: &str) -> String {
     if message.contains("USER_INSUFFICIENT_CREDITS") {
         return format!("{INSUFFICIENT_CREDITS_PREFIX} the memory engine is out of credits");
     }
-    if is_forbidden(message) {
+    if unauthorized_clause(message).is_some_and(is_forbidden) {
         return format!("{MEMORY_FORBIDDEN_PREFIX} the memory engine refused this credential");
     }
     if message.contains(SESSION_EXPIRED_PREFIX)
```

---

### Incident Patch 5: `57c1c07b` (2026-09-30)
**Commit Message**: docs(memory): describe hosted memory's recall, refusals and gating

Refs #6718

**File**: `crates/openhuman-core/src/memory/driver/README.md` (modified, +11/-0)
```diff
@@ -55,6 +55,17 @@ are capability-gated out of the registry when a context is ambient, and answer
 "memory driver does not support the ... family" otherwise. `provider_status`,
 the engine RPCs and the mandatory core/recall RPCs are never gated.
 
+Two host lanes read the mandatory recall on such an engine, and an engine that
+ranks without scoring (hosted CortexDB) changes what they can do. Auto-recall's
+notes leg keeps the engine's first `AUTO_RECALL_UNSCORED_NOTES` hits instead of
+flooring similarities that all read 0.0 (`memory/auto_recall`), and a refused
+lookup puts its reason in the block (`auto_recall/refusal.rs`). Situational
+preferences and the contradiction check (`memory/preferences`) cannot judge
+relevance without a score and answer nothing. A connector sync resolves the
+Sources sink before it asks the connector for pages, because the connector
+saves its cursor as it pages and records fetched for a driver without the
+family would never be fetched again.
+
 ## Where next
 
 - [`memory/README.md`](../README.md) for the full split between this host and
```

**File**: `docs/TEST-COVERAGE-MATRIX.md` (modified, +2/-2)
```diff
@@ -357,7 +357,7 @@ End-to-end coverage of the agent harness via the web-chat RPC surface against an
 | 8.2.5 | Coding-session persona ingestion | RU+RI+VU+WD | `vendor/tinymemory/crates/tinymemory-core/src/engine/persona_tests.rs` (vendored `tinymemory`), `crates/openhuman-core/src/memory/sources/rpc_tests.rs`, `tests/json_rpc_e2e.rs`, `app/src/components/intelligence/__tests__/CodingSessionsCard.test.tsx`, `app/src/services/memorySourcesService.test.ts`, `app/test/e2e/specs/coding-session-memory.spec.ts`, `app/test/playwright/specs/coding-session-memory.spec.ts` | ✅     | Discovers Codex and Claude Code histories, excludes machine-authored turns, exposes status/ingest RPCs, and surfaces incremental ingestion on Brain > Sources |
 | 8.2.6 | Folder-source path picker         | RU+VU       | `crates/openhuman-app/src/directory_picker.rs`, `app/src/utils/tauriCommands/directoryPicker.test.ts`, `app/src/components/intelligence/FolderField.test.tsx` | ✅     | Browse resolves an absolute path through the OS-native chooser and refuses to store a non-resolvable value (bare directory name) when none is available (#5831) |
 | 8.2.7 | Sync History and live sync activity | RU+RI+VU  | `crates/openhuman-core/src/memory/sources/run_history_tests.rs`, `crates/openhuman-core/src/memory/sources/rpc/driver_run_tests.rs`, `crates/openhuman-core/src/memory/sources/rpc_monthly_summary_tests_tests.rs`, `crates/openhuman-core/src/integrations/composio/ops/connector_runs_tests.rs`, `crates/openhuman-core/src/integrations/composio/ops/source_rows_tests.rs`, `crates/openhuman-core/src/memory/sync_activity_tests.rs`, `tests/memory_sources_e2e.rs` (`sources_sync_dispatches_to_the_module_rather_than_refusing_the_capability`), `app/src/components/intelligence/SyncAuditPanel.test.tsx`, `app/src/components/intelligence/SyncActivityCard.test.tsx`, `app/src/components/intelligence/__tests__/memorySyncActivityStore.test.ts`, `app/src/components/intelligence/MemorySourceRow.test.tsx`, `app/src/components/intelligence/MemoryTreeStatusPanel.test.tsx` | ✅     | Every host-driven run (Sync button, Apply all, Composio) leaves one history row merged with the driver's audit log; manual driver runs end in `completed` or `failed`; a late per-document stage cannot reopen a finished row; Brain > Sync shows what is syncing and the job queue, and re-reads the history when a run ends (#6257) |
-| 8.2.8 | Selectable memory engines and migration | RU+RI+VU | `crates/openhuman-core/src/memory/ops/engine_migrate_tests.rs`, `tests/memory_engine_e2e.rs`, `tests/memory_engine_migrate_e2e.rs`, `app/src/components/settings/panels/MemoryEnginePanel.test.tsx`, `app/src/components/intelligence/MemoryFamilyGate.test.tsx` | ✅ | Engine selection, migration copy/cancel/failure behavior, hosted and external drivers, and capability gating |
+| 8.2.8 | Selectable memory engines and migration | RU+RI+VU | `crates/openhuman-core/src/memory/ops/engine_migrate_tests.rs`, `crates/openhuman-core/src/memory/ops/engine_tests.rs`, `tests/memory_engine_e2e.rs`, `tests/memory_engine_migrate_e2e.rs`, `tests/memory_hosted_surface_e2e.rs`, `app/src/components/settings/panels/MemoryEnginePanel.test.tsx`, `app/src/components/settings/panels/MemoryEngineErrorAlert.test.tsx`, `app/src/components/intelligence/MemoryFamilyGate.test.tsx`, `app/src/pages/__tests__/Brain.test.tsx` | ✅ | Engine selection, migration copy/cancel/failure behavior, hosted and external drivers, and capability gating; on the hosted engine a 403 reads `MEMORY_FORBIDDEN:` (never a sign-out), an outage `MEMORY_UNREACHABLE:`, and Brain's sync panels say "Not available" (#6718) |
 
 ### 8.3 Memory Retrieval Benchmarks
 
@@ -383,7 +383,7 @@ End-to-end coverage of the agent harness via the web-chat RPC surface against an
 | 8.4.8 | Lane C Boot Warm-up                        | RU    | `crates/openhuman-core/src/memory/auto_recall/warm_tests.rs`                                                                                                         
```

**File**: `gitbooks/developing/engines.md` (modified, +16/-2)
```diff
@@ -115,13 +115,27 @@ most two `export_page` calls of `min(limit*4, 200)` records, and the document li
 scans at most 10 namespaces and returns at most 200 documents with a `truncated`
 flag. The proper fix is a bounded `recent(namespace, limit)` on the tinymemory
 contract, an upstream follow-up. Hosted 402 and 401 errors from ordinary memory
-RPCs read `INSUFFICIENT_CREDITS:` and `SESSION_EXPIRED:` too.
+RPCs read `INSUFFICIENT_CREDITS:` and `SESSION_EXPIRED:` too; a 403 (a credential
+the engine refuses, such as an API key without the memory scope) reads
+`MEMORY_FORBIDDEN:` and never signs the user out, and a timeout, refused
+connection, 429 or 5xx that outlasts the retries reads `MEMORY_UNREACHABLE:`.
 
 Not every engine advertises every capability family. The hosted and CortexDB
 engines have no `documents`, `tree`, `sources` or `graph` families, so the
 document, tree and source RPCs answer a clean "does not support" error on them
 (see the [`memory/driver` README](../../crates/openhuman-core/src/memory/driver/README.md)
-for the full table).
+for the full table). Brain's sync panels (activity, history, coding sessions)
+need `sources` and show "Not available" there.
+
+Auto-recall reads the notes a user saved through the mandatory recall on such an
+engine. Hosted CortexDB ranks its recall without scoring it, so its notes cannot
+be floored on similarity: the lane keeps the engine's first three, behind the
+same gate that decides whether a message needs memory at all. Situational
+preferences and the contradiction check need a scored engine and stay empty
+there. A lookup the engine refuses (out of credits, session not accepted,
+credential refused, unreachable) puts a one-line reason in the recall block
+instead of an empty result, so the model says memory is unavailable rather than
+that something was never stored.
 
 Related pages: [Memory](../features/obsidian-wiki/README.md) and its
 sub-pages for what TinyCortex actually does (memory tree, scoring, retrieval,
```

---

### Incident Patch 6: `18dfd3f1` (2026-09-30)
**Commit Message**: test(memory): cover the memory surface on the hosted engine

The four memory E2E suites run on the local module, whose engine serves
every family. This suite runs against the same hosted-CortexDB double as
`memory_engine_e2e`:

- auto-recall reaches a saved note, and a 402 yields the refusal block;
- a 403 reads `MEMORY_FORBIDDEN:` and a 503 `MEMORY_UNREACHABLE:`;
- Sync History answers from the host log;
- the graph and document RPCs name the family the engine lacks, and the
  tree health reads degrade to an empty or unhealthy answer.

Refs #6718

**File**: `crates/openhuman-cli/Cargo.toml` (modified, +7/-0)
```diff
@@ -279,6 +279,13 @@ name = "memory_engine_migrate_e2e"
 path = "../../tests/memory_engine_migrate_e2e.rs"
 required-features = ["modules", "memory-remote"]
 
+[[test]]
+# The memory surface on the hosted engine: auto-recall, refusals, the error
+# vocabulary and the families it does not serve (openhuman#6718).
+name = "memory_hosted_surface_e2e"
+path = "../../tests/memory_hosted_surface_e2e.rs"
+required-features = ["modules", "memory-remote"]
+
 [[test]]
 name = "memory_roundtrip_e2e"
 path = "../../tests/memory_roundtrip_e2e.rs"
```

**File**: `tests/memory_hosted_surface_e2e.rs` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+//! The memory surface on the hosted engine (openhuman#6718), against the same
+//! hosted-CortexDB double as `memory_engine_e2e.rs`.
+//!
+//! The four memory suites (`memory_roundtrip_e2e`, `memory_sources_e2e`,
+//! `memory_graph_roundtrip_e2e`, `memory_tree_health_e2e`) run on the local
+//! module, whose engine serves every family. The hosted engine serves the
+//! mandatory families plus ingestion and answers; this suite holds it to what
+//! that means for a user: what it serves works, what it does not serve answers
+//! a clean refusal rather than failing some other way, auto-recall reaches the
+//! notes a user saved, and a refused lookup says why.
+//!
+//! ```text
+//! RUST_MIN_STACK=67108864 cargo test -p openhuman-cli \
+//!   --features "$(bash scripts/ci/product-features.sh)" \
+//!   --test memory_hosted_surface_e2e
+//! ```
+
+#[path = "support/memory_engine_fixture.rs"]
+mod fixture;
+
+use std::sync::atomic::Ordering;
+
+use fixture::*;
+use openhuman_core::memory::api::types::{MemoryCategory, MemoryTaint};
+use openhuman_core::memory::auto_recall::{AutoRecall, AUTO_RECALL_NOTES_NAMESPACE};
+use serde_json::json;
+
+/// A question the auto-recall gate opens for. The double's recall matches by
+/// substring, so the note that should answer it quotes it.
+const QUESTION: &str = "who is my idol and why?";
+
+async fn bind_hosted(
+    fx: &Fixture,
+) -> std::sync::Arc<openhuman_core::memory::binding::MemoryBinding> {
+    let v = fx
+        .call(
+            "openhuman.memory_engine_set",
+            json!({ "driver": "tinyhumans" }),
+        )
+        .await;
+    assert_eq!(
+        result_of(&v, "engine_set tinyhumans")["driver"],
+        "tinyhumans"
+    );
+    let config = openhuman_core::config::load_config_with_timeout()
+        .await
+        .unwrap();
+    let binding = openhuman_core::memory::binding::for_config(&config).unwrap();
+    assert_eq!(binding.driver_id(), "tinyhumans");
+    binding
+}
+
+async fn unbind(fx: &Fixture) {
+    fx.hosted.force_status.store(0, Ordering::SeqCst);
+    fx.call(
+        "openhuman.memory_engine_set",
+        json!({ "driver": "tinymemory" }),
+    )
+    .await;
+}
+
+#[test]
+fn auto_recall_reaches_a_saved_note_on_the_hosted_engine() {
+    run_on_big_stack("hosted-auto-recall", || async {
+        let fx = Fixture::new().await;
+        let binding = bind_hosted(&fx).await;
+        binding
+            .provider()
+            .store(
+                AUTO_RECALL_NOTES_NAMESPACE,
+                "idol",
+                &format!("{QUESTION} The user's idol is Virat Kohli, for his discipline."),
+                MemoryCategory::Core,
+                None,
+                MemoryTaint::Internal,
+            )
+            .await
+            .expect("store the note");
+
+        // Hosted recall carries no score: the note reads 0.0, which the scored
+        // floor would drop. The lane keeps the engine's order instead.
+        let lane = AutoRecall::from_guard(binding.guard());
+        assert!(lane.enabled());
+        let block = lane.block_for(QUESTION).await.expect("a block");
+        assert!(block.contains("Virat Kohli"), "{block}");
+
+        // Out of credits: the block says so instead of reading as "nothing
+        // stored".
+        fx.hosted.force_status.store(402, Ordering::SeqCst);
+        let block = lane.block_for(QUESTION).await.expect("a refusal block");
+        assert!(block.contains("out of credits"), "{block}");
+        assert!(!block.contains("Virat Kohli"), "{block}");
+
+        unbind(&fx).await;
+    });
+}
+
+#[test]
+fn a_refused_credential_and_an_outage_have_their_own_names() {
+    run_on_big_stack("hosted-vocabulary", || async {
+        let fx = Fixture::new().await;
+        bind_hosted(&fx).await;
+
+        // A 403 is a valid credential refused (an API key without the memory
+        // scope). It must not read SESSION_EXPIRED, which signs the user out.
+        fx.hosted.force_st
```

---

### Incident Patch 7: `01e33737` (2026-09-30)
**Commit Message**: fix(app): show Brain's sync and vault panels only where the engine serves them

On an engine without the Sources family (hosted CortexDB), the whole
`memory_sources.*` namespace is absent, and Brain's sync activity, Sync
History and coding-sessions panels rendered and then failed. The vault
checklist in memory settings did the same without the Tree family. They now
sit behind `MemoryFamilyGate` like their neighbours, and show "Not
available with <engine>".

Refs #6718

**File**: `app/src/components/settings/panels/MemoryDataPanel.tsx` (modified, +3/-1)
```diff
@@ -88,7 +88,9 @@ const MemoryDataPanel = ({ embedded = false }: MemoryDataPanelProps = {}) => {
             </div>
           </dl>
         </SettingsSection>
-        <VaultHealthChecklist onToast={addToast} title={t('vaultHealth.setupTitle')} />
+        <MemoryFamilyGate family="tree">
+          <VaultHealthChecklist onToast={addToast} title={t('vaultHealth.setupTitle')} />
+        </MemoryFamilyGate>
         <MemoryWindowControl onError={handleWindowError} onSaved={handleWindowSaved} />
         <MemoryFamilyGate family="tree">
           <MemoryWorkspace onToast={addToast} />
```

**File**: `app/src/pages/Brain.tsx` (modified, +11/-5)
```diff
@@ -435,7 +435,9 @@ export default function Brain() {
                   {activeTab === 'sources' && (
                     <div className="space-y-5 animate-fade-up">
                       <MemoryEngineRow />
-                      <CodingSessionsCard onToast={addToast} />
+                      <MemoryFamilyGate family="sources">
+                        <CodingSessionsCard onToast={addToast} />
+                      </MemoryFamilyGate>
                       <MemoryFamilyGate family="sources">
                         <MemorySourcesRegistry onToast={addToast} />
                       </MemoryFamilyGate>
@@ -451,16 +453,20 @@ export default function Brain() {
                       </MemoryFamilyGate>
                       {/* openhuman#6257: what is syncing right now, beside the
                       history of what already ran. */}
-                      <Card padded divided={false} data-testid="brain-sync-activity">
-                        <SyncActivityCard />
-                      </Card>
+                      <MemoryFamilyGate family="sources">
+                        <Card padded divided={false} data-testid="brain-sync-activity">
+                          <SyncActivityCard />
+                        </Card>
+                      </MemoryFamilyGate>
                     </div>
                   )}
 
                   {/* Sync → History: the run history as a full-height table. */}
                   {activeTab === 'sync' && syncView === 'history' && (
                     <div className="flex min-h-0 flex-1 flex-col" data-testid="brain-sync-history">
-                      <SyncAuditPanel fill />
+                      <MemoryFamilyGate family="sources">
+                        <SyncAuditPanel fill />
+                      </MemoryFamilyGate>
                     </div>
                   )}
                 </div>
```

**File**: `app/src/pages/__tests__/Brain.test.tsx` (modified, +37/-0)
```diff
@@ -1,10 +1,18 @@
 import { act, screen, waitFor } from '@testing-library/react';
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 
+import { resetMemoryEngineCacheForTests } from '../../components/intelligence/useMemoryEngineCapabilities';
 import { renderWithProviders } from '../../test/test-utils';
 import Brain from '../Brain';
 
 const graphExportMock = vi.hoisted(() => vi.fn());
+// The bound memory engine, as `MemoryFamilyGate` reads it. Rejected by default,
+// so every gate fails open and the tabs render as they always have.
+const engineMock = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));
+vi.mock('../../utils/tauriCommands/memoryEngine', () => ({
+  memoryEnginesList: (...a: unknown[]) => engineMock.list(...a),
+  memoryEngineGet: (...a: unknown[]) => engineMock.get(...a),
+}));
 // Controllable authenticated identity so we can simulate a logout→login cycle
 // (userId null → set) and assert the graph reloads (#4149).
 const coreAuthRef = vi.hoisted(() => ({ current: 'user-A' as string | null }));
@@ -84,6 +92,9 @@ describe('Brain page', () => {
   beforeEach(() => {
     vi.clearAllMocks();
     coreAuthRef.current = 'user-A';
+    resetMemoryEngineCacheForTests();
+    engineMock.get.mockRejectedValue(new Error('no engine rpc in this test'));
+    engineMock.list.mockRejectedValue(new Error('no engine rpc in this test'));
   });
 
   afterEach(() => {
@@ -188,4 +199,30 @@ describe('Brain page', () => {
     expect(screen.queryByTestId('brain-sync-activity')).toBeNull();
     expect(screen.queryByTestId('brain-sync-activity-card')).toBeNull();
   });
+
+  // A remote engine without the Sources family (hosted CortexDB) has no
+  // `memory_sources.*` RPCs at all: the sync panels must say so rather than
+  // render and fail.
+  it('shows the sync panels as unavailable on an engine without sources', async () => {
+    graphExportMock.mockResolvedValue(makeGraph(0));
+    engineMock.get.mockResolvedValue({ driver: 'tinyhumans' });
+    engineMock.list.mockResolvedValue({
+      active: 'tinyhumans',
+      engines: [
+        {
+          id: 'tinyhumans',
+          label: 'CortexDB (via TinyHumans)',
+          capabilities: ['core', 'recall', 'portability', 'answer'],
+        },
+      ],
+    });
+    await act(async () => {
+      renderWithProviders(<Brain />, { initialEntries: ['/?tab=sync'] });
+    });
+    await waitFor(() => {
+      expect(screen.getAllByTestId('memory-family-unavailable').length).toBeGreaterThan(0);
+    });
+    expect(screen.queryByTestId('brain-sync-activity')).toBeNull();
+    expect(screen.queryByTestId('brain-sync-activity-card')).toBeNull();
+  });
 });
```

---

### Incident Patch 8: `172d5a49` (2026-09-30)
**Commit Message**: fix(memory): resolve the sources sink before a connector pages

A connector sync run saves the connection's cursor as it pages
(`tinyconnectors-sync`'s pipeline). `run_sync_pass` asked the connector for
pages first and resolved the memory sink after, so on a driver without the
Sources family every pass paged, advanced the cursor, then failed. Those
records were never fetched again, and the periodic loop did this to every
connection on every tick. The sink is now resolved first.

Sync History also answered an error for a driver that keeps no audit log of
its own. The host's run log is then the whole history, so it now returns
that.

Refs #6718

**File**: `crates/openhuman-core/src/integrations/composio/ops/providers_ops.rs` (modified, +14/-8)
```diff
@@ -554,6 +554,20 @@ pub(crate) async fn run_sync_pass(
     // through the years. `None` reads unbounded, as every earlier release did.
     let depth_days = source_sync_depth_days(config, toolkit, connection_id);
 
+    // The sink first, the fetch second. A connector run saves the
+    // connection's cursor as it pages (`tinyconnectors-sync`'s pipeline), so
+    // records fetched for a driver that cannot accept them are never fetched
+    // again: resolving the sink after the call lost every pass's records for
+    // good — on a remote engine without the Sources family, every connection,
+    // every periodic tick.
+    let binding = crate::memory::binding::for_config(config)?;
+    let sink = binding.provider().as_sources().ok_or_else(|| {
+        format!(
+            "the bound memory driver '{}' does not accept source items",
+            binding.driver_id()
+        )
+    })?;
+
     let response = connectors::call_slow::<_, ConnectorSyncResponse>(
         config,
         methods::SYNC,
@@ -591,14 +605,6 @@ pub(crate) async fn run_sync_pass(
         });
     }
 
-    let binding = crate::memory::binding::for_config(config)?;
-    let sink = binding.provider().as_sources().ok_or_else(|| {
-        format!(
-            "the bound memory driver '{}' does not accept source items",
-            binding.driver_id()
-        )
-    })?;
-
     // `ConnectorRecord` and memory's `SourceItem` carry the same seven keys —
     // the contract crate asserts that against a literal list, so a drift is a
     // failing test there rather than a decode error here.
```

**File**: `crates/openhuman-core/src/memory/sources/rpc/cost_reporting.rs` (modified, +12/-7)
```diff
@@ -49,17 +49,22 @@ pub async fn sync_audit_log_rpc() -> Result<Outcome<SyncAuditLogResponse>, Strin
     tracing::debug!("[memory_sources] sync_audit_log_rpc: entry");
     let config = config_rpc::load_config_with_timeout().await?;
     let binding = crate::memory::binding::for_config(&config)?;
-    let Some(sync) = binding.provider().as_source_sync() else {
-        return Err(unserved(&binding, "source sync", "sync_audit_log"));
-    };
 
     // `None` = the driver's own cap. A caller cannot raise it by asking for
     // more, so passing a number here would only be this host inventing a
     // ceiling the driver then clamps anyway.
-    let driver_entries = sync
-        .sync_audit_log(None)
-        .await
-        .map_err(|error| format!("sync audit log: {error}"))?;
+    //
+    // A driver that schedules no syncs of its own keeps no audit log, and the
+    // host's log is then the whole history — every run this host drove.
+    // Refusing would hide those runs behind the driver's absence, which is
+    // what a remote engine showed: an error where Sync History should be.
+    let driver_entries = match binding.provider().as_source_sync() {
+        Some(sync) => sync
+            .sync_audit_log(None)
+            .await
+            .map_err(|error| format!("sync audit log: {error}"))?,
+        None => Vec::new(),
+    };
     let host_entries = run_history::read_runs(&config.workspace_dir, run_history::KEEP_ROWS)
         .map_err(|error| format!("sync run log: {error}"))?;
     let (driver_rows, host_rows) = (driver_entries.len(), host_entries.len());
```

---

### Incident Patch 9: `292b6436` (2026-09-30)
**Commit Message**: fix(memory): let auto-recall reach saved notes on hosted memory

Hosted CortexDB ranks its recall but returns no score. The fallback for an
engine without the retrieval family read a missing score as 0.0, and the
notes leg's 0.35 similarity floor then dropped every note: on the hosted
engine a fact the user asked to keep was never auto-recalled, and the model
answered that it was not stored.

- The notes source now says whether the engine scored its hits
  (`ScoredNotes`). For an unscored engine the lane keeps the engine's first
  `AUTO_RECALL_UNSCORED_NOTES` (3) behind the same gate, instead of flooring
  zeros.
- A lookup the engine refuses (out of credits, session not accepted,
  credential refused, unreachable) puts a one-line reason in the recall
  block instead of an empty result, so the answer is "memory is
  unavailable" rather than "that was never stored". Other failures still
  yield no block.
- Situational preferences and the contradiction check cannot judge
  relevance without a score. They already answered nothing there, and now
  say why in the log.
- The fallback keeps the engine's error typed (`ranked_recall`), so the lane
  can tell a refusal from an outage.

Refs 

**File**: `crates/openhuman-core/src/memory/auto_recall/auto_recall_tests.rs` (modified, +31/-2)
```diff
@@ -54,6 +54,10 @@ fn response(hits: Vec<RetrievalHit>) -> RetrievalResponse {
 struct Scripted {
     outcome: Mutex<Result<RetrievalResponse, String>>,
     notes: Mutex<Result<Vec<NamespaceMemoryHit>, String>>,
+    /// Whether the scripted notes carry the engine's scores.
+    notes_scored: Mutex<bool>,
+    /// A typed refusal for the notes leg, instead of a plain failure.
+    notes_refusal: Mutex<Option<fn() -> MemoryError>>,
     delay: Duration,
     notes_delay: Mutex<Duration>,
     calls: AtomicUsize,
@@ -65,6 +69,8 @@ impl Scripted {
         Arc::new(Self {
             outcome: Mutex::new(outcome),
             notes: Mutex::new(Ok(Vec::new())),
+            notes_scored: Mutex::new(true),
+            notes_refusal: Mutex::new(None),
             delay,
             notes_delay: Mutex::new(Duration::ZERO),
             calls: AtomicUsize::new(0),
@@ -90,6 +96,20 @@ impl Scripted {
         self
     }
 
+    /// Scripts the notes leg's answer from an engine that ranks without
+    /// scoring: every similarity reads 0.0.
+    fn with_unscored_notes(self: Arc<Self>, notes: Vec<NamespaceMemoryHit>) -> Arc<Self> {
+        *self.notes.lock().unwrap() = Ok(notes);
+        *self.notes_scored.lock().unwrap() = false;
+        self
+    }
+
+    /// Scripts the notes leg to be refused with the error `refusal` makes.
+    fn with_refused_notes(self: Arc<Self>, refusal: fn() -> MemoryError) -> Arc<Self> {
+        *self.notes_refusal.lock().unwrap() = Some(refusal);
+        self
+    }
+
     /// Scripts the notes leg to fail.
     fn with_failing_notes(self: Arc<Self>, message: &str) -> Arc<Self> {
         *self.notes.lock().unwrap() = Err(message.to_string());
@@ -133,7 +153,7 @@ impl AutoRecallSource for Scripted {
         namespace: &str,
         _query: &str,
         limit: usize,
-    ) -> Result<Vec<NamespaceMemoryHit>, MemoryError> {
+    ) -> Result<ScoredNotes, MemoryError> {
         self.notes_calls.fetch_add(1, AtomicOrdering::SeqCst);
         // The lane owns both parameters; a fake that accepted anything would
         // let a wrong namespace or page size pass every test.
@@ -143,8 +163,14 @@ impl AutoRecallSource for Scripted {
         if !delay.is_zero() {
             tokio::time::sleep(delay).await;
         }
+        if let Some(refusal) = *self.notes_refusal.lock().unwrap() {
+            return Err(refusal());
+        }
         match &*self.notes.lock().unwrap() {
-            Ok(notes) => Ok(notes.clone()),
+            Ok(notes) => Ok(ScoredNotes {
+                hits: notes.clone(),
+                scored: *self.notes_scored.lock().unwrap(),
+            }),
             Err(message) => Err(MemoryError::Backend(message.clone())),
         }
     }
@@ -518,3 +544,6 @@ async fn from_guard_over_a_driver_without_retrieval_stays_silent() {
 
 #[path = "notes_lane_tests.rs"]
 mod notes_lane_tests;
+
+#[path = "unscored_lane_tests.rs"]
+mod unscored_lane_tests;
```

**File**: `crates/openhuman-core/src/memory/auto_recall/mod.rs` (modified, +67/-17)
```diff
@@ -77,11 +77,13 @@
 //! thresholds can be tuned from real logs.
 
 mod gate;
+mod refusal;
 mod source;
 pub mod warm;
 
 pub use gate::{gate_decision, GateDecision};
-pub use source::{AutoRecallSource, GuardSource};
+pub use refusal::MemoryRefusal;
+pub use source::{AutoRecallSource, GuardSource, ScoredNotes};
 
 use crate::agent::harness::memory_context_safety::{
     is_potentially_untrusted, wrap_untrusted_for_agent,
@@ -144,6 +146,16 @@ pub const AUTO_RECALL_NOTES_NAMESPACE: &str = DEFAULT_AGENT_MEMORY_NAMESPACE;
 /// The `[auto_recall]` line logs the best candidate before the floor.
 pub const AUTO_RECALL_NOTE_MIN_SIMILARITY: f64 = 0.35;
 
+/// How many notes an engine that ranks without scoring contributes (hosted
+/// CortexDB answers no score at all).
+///
+/// With no similarity to floor on, the engine's order is the only relevance
+/// signal, and the gate has already judged the message worth a lookup. So the
+/// first few are kept: enough that a paraphrased question still reaches its
+/// note, few enough that an unrelated one costs a couple of lines rather than
+/// the whole namespace.
+pub const AUTO_RECALL_UNSCORED_NOTES: usize = 3;
+
 /// The lane itself: a retrieval source, the switch, and the budgets.
 pub struct AutoRecall {
     source: Arc<dyn AutoRecallSource>,
@@ -225,17 +237,27 @@ impl AutoRecall {
             self.tree_leg(user_message, reason),
             self.notes_leg(user_message, reason)
         );
-        let notes_top = similarity_label(notes.top);
+        let notes_top = if notes.scored {
+            similarity_label(notes.top)
+        } else {
+            "unscored".to_string()
+        };
+        // Either leg can be refused, and both ask the same engine; the notes
+        // leg's reason is the one a user's saved facts depend on.
+        let refusal = notes.refusal.or(tree.refusal);
         if tree.hits.is_empty() && notes.hits.is_empty() {
             log::info!(
                 "[auto_recall] gate=open reason={reason} hits=0 total={} notes=0 \
-                 notes_top={notes_top} tree_ms={} notes_ms={} elapsed_ms={}",
+                 notes_top={notes_top} refusal={} tree_ms={} notes_ms={} elapsed_ms={}",
                 tree.total,
+                refusal.map_or("none", MemoryRefusal::label),
                 tree.elapsed_ms,
                 notes.elapsed_ms,
                 started.elapsed().as_millis()
             );
-            return None;
+            // A refused lookup is not an empty one: say why, so the answer is
+            // "memory is unavailable" rather than "that was never stored".
+            return refusal.map(refusal::render_refusal_block);
         }
         let block = render_block(&notes.hits, &tree.hits, self.recall_max_chars);
         log::info!(
@@ -269,11 +291,14 @@ impl AutoRecall {
                 leg.total = response.total;
                 leg.hits = select_hits(response.hits);
             }
-            Ok(Err(err)) => log::warn!(
-                "[auto_recall] gate=open reason={reason} tree retrieval failed after {}ms; \
-                 continuing without tree hits: {err}",
-                started.elapsed().as_millis()
-            ),
+            Ok(Err(err)) => {
+                leg.refusal = MemoryRefusal::of(&err);
+                log::warn!(
+                    "[auto_recall] gate=open reason={reason} tree retrieval failed after {}ms; \
+                     continuing without tree hits: {err}",
+                    started.elapsed().as_millis()
+                );
+            }
             Err(_elapsed) => log::warn!(
                 "[auto_recall] gate=open reason={reason} tree retrieval exceeded {:?}; \
                  continuing without tree hits",
@@ -300,15 +325,22 @@ impl AutoRecall {
         )
         .await
         {
-            Ok(Ok(candidates)) => {
-                leg.top = top_similarity(&candidates);
-                leg.hits = select_notes(candidates);
+            Ok(Ok(notes)) if notes
```

**File**: `crates/openhuman-core/src/memory/auto_recall/refusal.rs` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+//! Why a lookup could not run, when the engine said why.
+//!
+//! A remote engine can refuse a recall for reasons that are not "nothing
+//! relevant": the hosted account is out of credits, the session was not
+//! accepted, the credential lacks the memory scope, or the service cannot be
+//! reached. The lane used to log those and carry on as though memory were
+//! empty, so the model told the user a fact they had saved was never stored.
+//! A refused lookup now puts that reason in front of the model instead, in the
+//! block's usual place, so the answer can say what is actually wrong.
+
+use crate::memory::api::error::MemoryError;
+use crate::memory::ops::engine::{
+    classify_memory_error, INSUFFICIENT_CREDITS_PREFIX, MEMORY_FORBIDDEN_PREFIX,
+    MEMORY_UNREACHABLE_PREFIX, SESSION_EXPIRED_PREFIX,
+};
+
+use super::AUTO_RECALL_BANNER;
+
+/// Why memory could not be searched for a message.
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+pub enum MemoryRefusal {
+    /// The hosted engine's account has no credits left.
+    OutOfCredits,
+    /// The engine did not accept the session.
+    SessionExpired,
+    /// The engine refused the credential outright (HTTP 403).
+    Forbidden,
+    /// The engine could not be reached, or answered that it cannot serve now.
+    Unavailable,
+}
+
+impl MemoryRefusal {
+    /// The refusal `error` stands for, or `None` for an ordinary failure.
+    pub fn of(error: &MemoryError) -> Option<Self> {
+        let classified = classify_memory_error(error);
+        [
+            (INSUFFICIENT_CREDITS_PREFIX, Self::OutOfCredits),
+            (SESSION_EXPIRED_PREFIX, Self::SessionExpired),
+            (MEMORY_FORBIDDEN_PREFIX, Self::Forbidden),
+            (MEMORY_UNREACHABLE_PREFIX, Self::Unavailable),
+        ]
+        .into_iter()
+        .find_map(|(prefix, refusal)| classified.starts_with(prefix).then_some(refusal))
+    }
+
+    /// A stable label for log lines.
+    pub fn label(self) -> &'static str {
+        match self {
+            Self::OutOfCredits => "out_of_credits",
+            Self::SessionExpired => "session_expired",
+            Self::Forbidden => "forbidden",
+            Self::Unavailable => "unavailable",
+        }
+    }
+
+    /// What the model is told, as the clause after "could not be searched".
+    fn reason(self) -> &'static str {
+        match self {
+            Self::OutOfCredits => {
+                "the OpenHuman account is out of credits, and hosted memory is billed in \
+                 credits; it works again once credits are added"
+            }
+            Self::SessionExpired => {
+                "the memory service did not accept the session; it works again after the \
+                 user signs in"
+            }
+            Self::Forbidden => {
+                "the memory service refused this account's credential; an API key needs \
+                 the memory scope"
+            }
+            Self::Unavailable => {
+                "the memory service could not be reached; it may work again in a moment"
+            }
+        }
+    }
+}
+
+/// The block for a lookup that was refused and found nothing else: the usual
+/// banner over one line saying why memory is out of reach.
+pub(crate) fn render_refusal_block(refusal: MemoryRefusal) -> String {
+    format!(
+        "{AUTO_RECALL_BANNER}\n\nMemory could not be searched for this message: {}. \
+         If the user asks about something they saved, say that memory is unavailable \
+         and why, rather than that it was never stored.\n\n",
+        refusal.reason()
+    )
+}
+
+#[cfg(test)]
+#[path = "refusal_tests.rs"]
+mod tests;
```

**File**: `crates/openhuman-core/src/memory/auto_recall/refusal_tests.rs` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+use super::*;
+
+#[test]
+fn a_hosted_credit_refusal_is_out_of_credits() {
+    let error = MemoryError::BudgetExceeded(
+        "[USER_INSUFFICIENT_CREDITS] memory API memory/recall on api.example (HTTP 402 \
+         Payment Required): Insufficient credits — insufficient credits"
+            .into(),
+    );
+    assert_eq!(MemoryRefusal::of(&error), Some(MemoryRefusal::OutOfCredits));
+}
+
+#[test]
+fn a_401_is_a_session_the_engine_did_not_accept() {
+    let error = MemoryError::Unauthorized(
+        "[UNAUTHORIZED] memory API memory/recall on api.example (HTTP 401 Unauthorized): \
+         Invalid token — the session expired or the API key was rejected; re-authenticate"
+            .into(),
+    );
+    assert_eq!(
+        MemoryRefusal::of(&error),
+        Some(MemoryRefusal::SessionExpired)
+    );
+}
+
+#[test]
+fn a_403_is_a_refused_credential_not_a_lapsed_session() {
+    let error = MemoryError::Unauthorized(
+        "[FORBIDDEN] memory API memory/recall on api.example (HTTP 403 Forbidden): API key \
+         is missing the required scope: memory — the session expired or the API key was \
+         rejected; re-authenticate"
+            .into(),
+    );
+    assert_eq!(MemoryRefusal::of(&error), Some(MemoryRefusal::Forbidden));
+}
+
+#[test]
+fn an_outage_is_unavailable() {
+    for error in [
+        MemoryError::Unavailable("[RATE_LIMITED] memory API memory/recall (HTTP 429)".into()),
+        MemoryError::Unreachable("memory API request to api.example: could not connect".into()),
+        MemoryError::Timeout("memory API request to api.example: timed out".into()),
+    ] {
+        assert_eq!(
+            MemoryRefusal::of(&error),
+            Some(MemoryRefusal::Unavailable),
+            "{error}"
+        );
+    }
+}
+
+#[test]
+fn an_ordinary_failure_is_not_a_refusal() {
+    for error in [
+        MemoryError::Invalid("namespace must not be empty".into()),
+        MemoryError::Backend("engine answered 418".into()),
+        MemoryError::BudgetExceeded("the answer exceeded its token budget".into()),
+    ] {
+        assert_eq!(MemoryRefusal::of(&error), None, "{error}");
+    }
+}
+
+#[test]
+fn the_refusal_block_heads_the_reason_with_the_usual_banner() {
+    let block = render_refusal_block(MemoryRefusal::OutOfCredits);
+    assert!(block.starts_with(AUTO_RECALL_BANNER), "{block}");
+    assert!(block.contains("out of credits"), "{block}");
+    assert!(
+        block.contains("rather than that it was never stored"),
+        "{block}"
+    );
+}
```

**File**: `crates/openhuman-core/src/memory/auto_recall/source.rs` (modified, +34/-7)
```diff
@@ -33,13 +33,34 @@ pub trait AutoRecallSource: Send + Sync {
     ) -> Result<RetrievalResponse, MemoryError>;
 
     /// The driver's scored recall over `namespace` for `query`: at most `limit`
-    /// hits, each carrying the vector similarity the lane floors on.
+    /// hits, each carrying the vector similarity the lane floors on — or, for
+    /// an engine that ranks without scoring, the hits in its order with
+    /// [`ScoredNotes::scored`] false.
     async fn recall_namespace_scored(
         &self,
         namespace: &str,
         query: &str,
         limit: usize,
-    ) -> Result<Vec<NamespaceMemoryHit>, MemoryError>;
+    ) -> Result<ScoredNotes, MemoryError>;
+}
+
+/// What a notes recall answered, and whether its similarities are scores.
+#[derive(Debug)]
+pub struct ScoredNotes {
+    /// The hits, most relevant first.
+    pub hits: Vec<NamespaceMemoryHit>,
+    /// Whether each hit's `vector_similarity` is the engine's own score.
+    /// `false` for an engine whose recall is ranked but carries no score
+    /// (hosted CortexDB): its hits read 0.0, and flooring on that would drop
+    /// every one of them however well the engine ranked it.
+    pub scored: bool,
+}
+
+impl ScoredNotes {
+    /// Hits whose similarities are the engine's scores.
+    pub fn scored(hits: Vec<NamespaceMemoryHit>) -> Self {
+        Self { hits, scored: true }
+    }
 }
 
 /// The production source: the session's bound driver, behind its guard.
@@ -84,27 +105,33 @@ impl AutoRecallSource for GuardSource {
         namespace: &str,
         query: &str,
         limit: usize,
-    ) -> Result<Vec<NamespaceMemoryHit>, MemoryError> {
+    ) -> Result<ScoredNotes, MemoryError> {
         // No retrieval family (a remote engine): the notes still come from the
-        // mandatory ranked recall. Only the tree leg has no equivalent.
+        // mandatory ranked recall. Only the tree leg has no equivalent. The
+        // error stays typed so the lane can tell a credit or session refusal
+        // from an outage.
         let Some(retrieval) = self.guard.as_retrieval() else {
             log::debug!(
                 "[auto_recall] bound driver exposes no retrieval family; notes via mandatory recall"
             );
-            return crate::memory::ops::fallback::recall_hits(
+            let ranked = crate::memory::ops::fallback::ranked_recall(
                 self.guard.as_ref(),
                 namespace,
                 query,
                 limit,
             )
-            .await
-            .map_err(|e| MemoryError::Other(anyhow::anyhow!(e)));
+            .await?;
+            return Ok(ScoredNotes {
+                hits: ranked.hits,
+                scored: ranked.scored,
+            });
         };
         // No session to exclude: the notes namespace is never auto-saved per
         // session, and the lane runs before this turn is archived, so there is
         // no self-echo for the engine's exclusion to catch.
         retrieval
             .recall_namespace_scored(namespace, query, limit, None)
             .await
+            .map(ScoredNotes::scored)
     }
 }
```

---

### Incident Patch 10: `735b75a0` (2026-09-30)
**Commit Message**: fix(memory): name a refused credential and an unreachable engine

A remote memory engine's 403 and its outages had no name of their own:

- a 403 (a valid credential the engine refuses, such as a TinyHumans API
  key without the `memory` scope) was classified as `SESSION_EXPIRED:`, and
  the app treats any `SESSION_EXPIRED` RPC error as a confirmed lapsed
  session and signs the user out;
- a timeout, refused connection, 429 or 5xx that outlasted the retries
  reached the UI as raw engine text.

They now read `MEMORY_FORBIDDEN:` and `MEMORY_UNREACHABLE:`, on the typed
path (`classify_memory_error`, new) and on the string path, including
messages a caller wrapped. The app shows a refused credential as its own
state, with copy in every locale and no sign-in prompt, and an unreachable
engine as the existing "memory service unavailable" state.

Refs #6718

**File**: `app/src/components/settings/panels/MemoryEngineErrorAlert.test.tsx` (modified, +15/-0)
```diff
@@ -25,6 +25,21 @@ describe('MemoryEngineErrorAlert', () => {
     expect(screen.getByTestId('memory-engine-sign-in')).toBeInTheDocument();
   });
 
+  test('a refused credential is its own state, never a sign-in prompt', () => {
+    renderWithProviders(
+      <MemoryEngineErrorAlert error="MEMORY_FORBIDDEN: the memory engine refused this credential" />
+    );
+    expect(screen.getByTestId('memory-engine-error-memory_forbidden')).toBeInTheDocument();
+    expect(screen.queryByTestId('memory-engine-sign-in')).toBeNull();
+  });
+
+  test('an unreachable engine shows the unavailable state', () => {
+    renderWithProviders(
+      <MemoryEngineErrorAlert error="MEMORY_UNREACHABLE: the memory engine is not available right now" />
+    );
+    expect(screen.getByTestId('memory-engine-error-backend_unavailable')).toBeInTheDocument();
+  });
+
   test('any other error shows the caller fallback text and no action', () => {
     renderWithProviders(<MemoryEngineErrorAlert error="boom" fallbackText="Graph failed" />);
     expect(screen.getByTestId('memory-engine-error-other')).toHaveTextContent('Graph failed');
```

**File**: `app/src/components/settings/panels/MemoryEngineErrorAlert.tsx` (modified, +5/-3)
```diff
@@ -12,9 +12,11 @@ export function useMemoryEngineErrorText(): (kind: MemoryEngineErrorKind) => str
       ? t('memoryEngine.error.insufficientCredits')
       : kind === 'session_expired'
         ? t('memoryEngine.error.sessionExpired')
-        : kind === 'backend_unavailable'
-          ? t('memoryEngine.error.backendUnavailable')
-          : t('memoryEngine.error.generic');
+        : kind === 'memory_forbidden'
+          ? t('memoryEngine.error.forbidden')
+          : kind === 'backend_unavailable'
+            ? t('memoryEngine.error.backendUnavailable')
+            : t('memoryEngine.error.generic');
 }
 
 interface MemoryEngineErrorAlertProps {
```

**File**: `app/src/components/settings/panels/memoryEngineUtils.ts` (modified, +7/-1)
```diff
@@ -3,6 +3,7 @@ import type { MemoryEngineDescriptor } from '../../../utils/tauriCommands/memory
 export type MemoryEngineErrorKind =
   | 'insufficient_credits'
   | 'session_expired'
+  | 'memory_forbidden'
   | 'backend_unavailable'
   | 'other';
 
@@ -11,7 +12,12 @@ export function classifyMemoryEngineError(err: unknown): MemoryEngineErrorKind {
   const message = err instanceof Error ? err.message : String(err ?? '');
   if (message.includes('INSUFFICIENT_CREDITS:')) return 'insufficient_credits';
   if (message.includes('SESSION_EXPIRED:')) return 'session_expired';
-  if (message.includes('BACKEND_UNAVAILABLE:')) return 'backend_unavailable';
+  // A refused credential (an API key without the memory scope): not a lapsed
+  // session, so it must never read as one and sign the user out.
+  if (message.includes('MEMORY_FORBIDDEN:')) return 'memory_forbidden';
+  if (message.includes('BACKEND_UNAVAILABLE:') || message.includes('MEMORY_UNREACHABLE:')) {
+    return 'backend_unavailable';
+  }
   return 'other';
 }
 
```

**File**: `app/src/lib/i18n/ar.ts` (modified, +2/-0)
```diff
@@ -7129,6 +7129,8 @@ const messages: TranslationMap = {
     'نفد رصيد OpenHuman لديك. أضف رصيدًا لاستخدام هذا المحرك.',
   'memoryEngine.error.sessionExpired': 'انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.',
   'memoryEngine.error.backendUnavailable': 'خدمة الذاكرة غير متاحة حاليًا. حاول مرة أخرى بعد قليل.',
+  'memoryEngine.error.forbidden':
+    'رفضت خدمة الذاكرة بيانات اعتماد هذا الحساب. إذا كنت تستخدم مفتاح API، فامنحه نطاق memory.',
   'memoryEngine.error.generic': 'تعذّر تغيير محرك الذاكرة. تحقق من الإعدادات وحاول مرة أخرى.',
   'memoryEngine.error.openBilling': 'فتح الفوترة',
   'memoryEngine.error.signIn': 'تسجيل الدخول',
```

**File**: `app/src/lib/i18n/bn.ts` (modified, +2/-0)
```diff
@@ -7282,6 +7282,8 @@ const messages: TranslationMap = {
     'আপনার সেশনের মেয়াদ শেষ হয়েছে। চালিয়ে যেতে আবার সাইন ইন করুন।',
   'memoryEngine.error.backendUnavailable':
     'মেমোরি পরিষেবা এখন অনুপলব্ধ। একটু পরে আবার চেষ্টা করুন।',
+  'memoryEngine.error.forbidden':
+    'মেমরি পরিষেবা এই অ্যাকাউন্টের ক্রেডেনশিয়াল প্রত্যাখ্যান করেছে। আপনি API কী ব্যবহার করলে সেটিকে memory স্কোপ দিন।',
   'memoryEngine.error.generic':
     'মেমোরি ইঞ্জিন পরিবর্তন করা যায়নি। সেটিংস পরীক্ষা করে আবার চেষ্টা করুন।',
   'memoryEngine.error.openBilling': 'বিলিং খুলুন',
```

#### Recent Merged Pull Requests:
- **PR #6841** (2026-09-30): fix(memory): make hosted memory recall, refuse and sync correctly (@YellowSnnowmann)
- **PR #6839** (2026-09-30): chore(vendor): bump tinyagents for the Windows unsafe_code build fix (@M3gA-Mind)
- **PR #6827** (2026-09-30): fix(chat): warn instead of killing a silent turn; don't halt a turn on the first shell timeout (@senamakel)
- **PR #6826** (2026-09-30): Release (@M3gA-Mind)
- **PR #6824** (2026-09-30): chore(release): merge main into release (resolve promotion conflicts) (@M3gA-Mind)
- **PR #6823** (2026-09-30): feat(tokenjuice): REPL tools over a stored tool result; compaction on by default (@senamakel)
- **PR #6822** (2026-09-30): fix(voice): restore the macOS build after the tinycomputer-accessibility API change (@M3gA-Mind)
- **PR #6819** (2026-09-30): chore(vendor): bump tinyskills to d59fdd6 (non-SKILL.md blob sourceUrl fix) (@M3gA-Mind)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
