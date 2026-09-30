# Forensic Learning Record (Deep Inspection): mui/base-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/mui-base-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mui/base-ui](https://github.com/mui/base-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:28:00.941Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mui/base-ui`
- **Description**: Unstyled UI components for building accessible web apps and design systems. From the creators of Radix, Floating UI, and Material UI.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11043 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.remarkrc.mjs`
```
import { createRemarkConfig } from '@mui/internal-code-infra/remark';

export default createRemarkConfig({
  overrides: [
    {
      files: '**/*.{md,mdx}',
      rules: {
        // `[//]: # 'comment'` is used as a markdown comment idiom across the docs.
        'no-duplicate-headings': false,
        'no-unused-definitions': false,
        'no-empty-url': false,
        'no-undefined-references': false,
      },
    },
    {
      files: '.github/**/*.md',
      rules: {
        'mui-first-block-heading': false,
      },
    },
  ],
});

```

### Core Architecture Module: `babel.config.mjs`
```
import getBaseConfig from '@mui/internal-code-infra/babel-config';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const errorCodesPath = path.join(dirname, 'docs/src/error-codes.json');

export default function getBabelConfig(api) {
  const baseConfig = getBaseConfig(api);

  const plugins = [
    [
      '@mui/internal-babel-plugin-minify-errors',
      {
        missingError: 'annotate',
        runtimeModule: '#formatErrorMessage',
        detection: 'opt-out',
        errorCodesPath,
        outExtension: process.env.MUI_OUT_FILE_EXTENSION ?? undefined,
      },
    ],
  ];

  const displayNamePlugin = baseConfig.plugins.find(
    (p) => p[2] === '@mui/internal-babel-plugin-display-name',
  );
  displayNamePlugin[1].allowedCallees ??= {};
  displayNamePlugin[1].allowedCallees['@base-ui/utils/fastHooks'] = [
    'fastComponent',
    'fastComponentRef',
  ];

  return {
    ...baseConfig,
    plugins: [...baseConfig.plugins, ...plugins],
    overrides: [
      ...(baseConfig.overrides ?? []),
      {
        exclude: /\.test\.(js|ts|tsx)$/,
        plugins: ['@babel/plugin-transform-react-constant-elements'],
      },
    ],
    env: {
      test: {
        sourceMaps: 'both',
      },
    },
  };
}

```

### Core Architecture Module: `eslint.config.mjs`
```
import {
  baseSpecRules,
  createBaseConfig,
  createDocsConfig,
  createTestConfig,
  EXTENSION_TEST_FILE,
  EXTENSION_TS,
} from '@mui/internal-code-infra/eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import * as path from 'node:path';
import { fileURLToPath } from 'url';
import remarkConfig from './.remarkrc.mjs';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const playgroundRootDir = path.join(dirname, 'playground', 'vite-app');

const baseConfig = createBaseConfig({
  baseDirectory: dirname,
  markdown: true,
  consistentTypeImports: true,
});

// Flat config replaces rule options rather than merging them, so any block that sets
// `no-restricted-syntax` for a narrower set of files drops everything the base config declared.
// Re-including these keeps the shared restrictions (React namespace imports, `throw Error()`,
// the `window.setTimeout` family) in force wherever an override adds an entry of its own.
const baseRestrictedSyntax = baseConfig
  .flatMap((entry) => entry.rules?.['no-restricted-syntax'] ?? [])
  .filter((entry) => typeof entry === 'object');

if (baseRestrictedSyntax.length === 0) {
  // Extracting nothing would silently drop every shared restriction from the overrides below,
  // which is the failure this re-inclusion exists to prevent — so fail loudly instead.
  throw new Error(
    'eslint.config.mjs: found no `no-restricted-syntax` entries in the base config. ' +
      'Its shape likely changed; update the extraction above before the overrides lose these rules.',
  );
}

const OneLevelImportMessage = [
  'Prefer one level nested imports to avoid bundling everything in dev mode or breaking CJS/ESM split.',
  'See https://github.com/mui/material-ui/pull/24147 for the kind of win it can unlock.',
].join('\n');

const NO_RESTRICTED_IMPORTS_PATTERNS_DEEPLY_NESTED = [
  {
    regex: '@base-ui/react/(?:(?!internals/).+|internals/.+)/.+',
    message: OneLevelImportMessage,
  },
];

// Add relevant packages to the list below.
const NO_RESTRICTED_IMPORTS_PATHS_TOP_LEVEL_PACKAGES = [
  // { name: string, message: string }
];

export default defineConfig(
  globalIgnores(['./examples', './playground/vite-app/dist']),
  baseConfig,
  // eslint-plugin-mdx loads `.remarkrc.mjs` itself, but ESLint doesn't know
  // that file is a config dependency, so `--cache` doesn't invalidate when
  // it changes. Embedding the imported value in a setting puts its content
  // into the resolved-config hash, forcing cache invalidation on edits.
  { settings: { remarkConfig } },
  {
    name: 'Playground Vite app overrides',
    files: ['playground/vite-app/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json'],
        tsconfigRootDir: playgroundRootDir,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    name: 'Base UI overrides',
    files: [`**/*${EXTENSION_TS}`],
    settings: {
      'import/resolver': {
        typescript: {
          project: ['tsconfig.json'],
        },
      },
      next: {
        rootDir: 'docs',
      },
    },
    /**
     * Sorted alphanumerically within each group. built-in and each plugin form
     * their own groups.
     */
    rules: {
      // @TODO: Remove this once we move away from namespaces
      '@typescript-eslint/no-namespace': 'off',
      'import/export': 'off', // FIXME: Maximum call stack exceeded
      'no-restricted-imports': [
        'error',
        {
          patterns: NO_RESTRICTED_IMPORTS_PATTERNS_DEEPLY_NESTED,
        },
      ],
      // We LOVE non-breaking spaces, and both straight and curly quotes here
      'no-irregular-whitespace': ['warn', { skipJSXText: true, skipStrings: true }],
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': ['warn', { forbid: ['>', '}'] }],
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: 'useIsoLayoutEffect',
        },
      ],

      // Modern browsers imply rel="noopener" for target="_blank", so no rel is required.
      // See https://github.com/mui/material-ui/pull/40447
      // TODO move to mui/mui-public.
      'react/jsx-no-target-blank': 'off',

      // This prevents us from creating components like `<h1 {...props} />`
      'jsx-a11y/heading-has-content': 'off',
      'jsx-a11y/anchor-has-content': 'off',

      // This rule doesn't recognise <label> wrapped around custom controls
      'jsx-a11y/label-has-associated-control': 'off',
      // Turn off new eslint-plugin-react-hooks rules till we can fix all warnings
      'react-hooks/error-boundaries': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
  {
    files: [`packages/*/src/**/*${EXTENSION_TS}`],
    ignores: [`**/*${EXTENSION_TEST_FILE}`, `**/*.spec${EXTENSION_TS}`, `test/**/*${EXTENSION_TS}`],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname,
      },
    },
    rules: {
      'mui/add-undef-to-optional': 'error',
      'mui/disallow-react-api-in-server-components': 'error',
      'mui/no-floating-cleanup': 'error',
    },
  },
  {
    files: [
      // matching the pattern of the test runner
      `**/*${EXTENSION_TEST_FILE}`,
    ],
    extends: createTestConfig(),
    rules: {
      'mui/add-undef-to-optional': 'off',
      // Tests type lazily-loaded modules with `typeof import('./x')`, which the rule's
      // `disallowTypeAnnotations` default rejects. Top-level type imports stay enforced.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
      ],
      // These helpers assert internally (shared between multiple tests).
      'vitest/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            'expect',
            'expect*',
            'assert*',
            'openAndCloseDialog',
            'openAndClosePopover',
            'takeScreenshot',
            'waitForBubbleToOverlapActiveTab',
          ],
        },
      ],
      // Parameterized suites pass loop variables as titles.
      'vitest/valid-title': ['error', { allowArguments: true }],
      'no-restricted-syntax': [
        'error',
        ...baseRestrictedSyntax,
        {
          // `timeStamp` is read-only and not an `EventInit` member, so `fireEvent` accepts it from
          // the type system and then silently drops it: the event ends up stamped off the
          // environment's clock instead, which is the real one in a browser. Velocity-sensitive
          // assertions then depend on how long the runner took between two calls.
          selector:
            "CallExpression[callee.object.name='fireEvent'] ObjectExpression > Property[key.name='timeStamp']",
          message:
            '`fireEvent` silently drops `timeStamp`, so the event is stamped off the environment clock ' +
            '— the real one in a browser. Use `firePointer` from `#test-utils` for pointer events; ' +
            'touch events have no equivalent helper yet.',
        },
      ],
    },
  },
  {
    files: [`test/e2e/**/*${EXTENSION_TEST_FILE}`],
    rules: {
      // The e2e suite asserts with Playwright's `expect` (initPlaywrightMatchers),
      // which the scope-naive vitest globals rule mistakes for the vitest global.
      'vitest/prefer-importing-vitest-globals': 'off',
    },
  },
  baseSpecRules,
  {
    name: 'MUI ESLint config for docs',
    files: [`docs/**/*${EXTENSION_TS}`],
    extends: createDocsConfig(),
    rules: {
      '@typescript-eslint/no-use-before-define': 'off',
      'import/extensio
```

### Core Architecture Module: `examples/tanstack-start-tailwind-css/eslint.config.js`
```
//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';

export default [
  ...tanstackConfig,
  {
    files: ['**/*.js'],
    languageOptions: {
      parserOptions: { project: null, projectService: { allowDefaultProject: ['*.js'] } },
    },
  },
];

```

### Core Architecture Module: `examples/tanstack-start-tailwind-css/prettier.config.js`
```
//  @ts-check

/** @type {import('prettier').Config} */
const config = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
};

export default config;

```

### Core Architecture Module: `examples/tanstack-start-tailwind-css/src/components/button.tsx`
```
import { Button as BaseButton } from '@base-ui/react/button';
import clsx from 'clsx';

export function Button({ className, ...props }: React.ComponentPropsWithoutRef<'button'>) {
  return (
    <BaseButton
      type="button"
      className={clsx(
        'flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 font-inherit text-sm font-medium leading-5 text-gray-900 outline-0 select-none hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-600 active:bg-gray-100 data-disabled:text-gray-400 data-disabled:hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800 dark:focus-visible:outline-blue-400 dark:active:bg-gray-800 dark:data-disabled:bg-gray-900 dark:data-disabled:text-gray-500',
        className,
      )}
      {...props}
    />
  );
}

```

### Core Architecture Module: `examples/tanstack-start-tailwind-css/src/components/combobox.tsx`
```
import * as React from 'react';
import clsx from 'clsx';
import { Combobox } from '@base-ui/react/combobox';
import { Check, ChevronDown, X } from 'lucide-react';

export function Root(props: Combobox.Root.Props<any, any>) {
  return <Combobox.Root {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, Combobox.Input.Props>(function (
  { className, ...props }: Combobox.Input.Props,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  return (
    <Combobox.Input
      ref={forwardedRef}
      className={clsx(
        'h-8 w-64 rounded-md border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 focus:outline-2 focus:-outline-offset-1 focus:outline-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 dark:focus:outline-blue-400',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export function Clear({ className, ...props }: Combobox.Clear.Props) {
  return (
    <Combobox.Clear
      className={clsx(
        'combobox-clear flex h-8 w-6 items-center justify-center rounded-sm bg-transparent p-0',
        className,
      )}
      {...props}
    >
      <X className="size-4" />
    </Combobox.Clear>
  );
}

export function Trigger({ className, ...props }: Combobox.Trigger.Props) {
  return (
    <Combobox.Trigger
      className={clsx(
        'flex h-8 w-6 items-center justify-center rounded-sm bg-transparent p-0',
        className,
      )}
      {...props}
    >
      <ChevronDown className="size-4" />
    </Combobox.Trigger>
  );
}

export function Portal(props: Combobox.Portal.Props) {
  return <Combobox.Portal {...props} />;
}

export function Positioner({ className, ...props }: Combobox.Positioner.Props) {
  return (
    <Combobox.Positioner className={clsx('outline-hidden', className)} sideOffset={4} {...props} />
  );
}

export function Popup({ className, ...props }: Combobox.Popup.Props) {
  return (
    <Combobox.Popup
      className={clsx(
        'w-(--anchor-width) max-h-92 max-w-(--available-width) origin-(--transform-origin) rounded-md bg-white text-gray-900 shadow-xl shadow-black/10 outline-1 outline-gray-200 transition-[transform,scale,opacity] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 duration-100 dark:bg-gray-900 dark:text-gray-50 dark:shadow-2xl dark:shadow-black/50 dark:outline-gray-800',
        className,
      )}
      {...props}
    />
  );
}

export function Empty({ className, ...props }: Combobox.Empty.Props) {
  return (
    <Combobox.Empty
      className={clsx(
        'p-3 text-sm leading-5 text-gray-500 empty:m-0 empty:p-0 dark:text-gray-400',
        className,
      )}
      {...props}
    />
  );
}

export function List({ className, ...props }: Combobox.List.Props) {
  return (
    <Combobox.List
      className={clsx(
        'outline-0 overflow-y-auto scroll-py-2 py-1 overscroll-contain max-h-[min(23rem,var(--available-height))] data-empty:p-0',
        className,
      )}
      {...props}
    />
  );
}

export function Item({ className, ...props }: Combobox.Item.Props) {
  return (
    <Combobox.Item
      className={clsx(
        'grid cursor-default grid-cols-[0.75rem_1fr] items-center gap-2 py-2 pr-8 pl-4 text-sm leading-5 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-gray-50 data-highlighted:before:absolute data-highlighted:before:inset-x-1 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:rounded-sm data-highlighted:before:bg-gray-900 dark:data-highlighted:text-gray-900 dark:data-highlighted:before:bg-gray-50',
        className,
      )}
      {...props}
    />
  );
}

export function ItemIndicator({ className, ...props }: Combobox.ItemIndicator.Props) {
  return (
    <Combobox.ItemIndicator className={clsx('col-start-1', className)} {...props}>
      <Check className="size-4" />
    </Combobox.ItemIndicator>
  );
}

```

### Core Architecture Module: `examples/tanstack-start-tailwind-css/src/components/dialog.tsx`
```
import clsx from 'clsx';
import { Dialog } from '@base-ui/react/dialog';

export function Root(props: Dialog.Root.Props) {
  return <Dialog.Root {...props} />;
}

export function Trigger({ className, ...props }: Dialog.Trigger.Props) {
  return (
    <Dialog.Trigger
      className={clsx(
        'flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 select-none hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-600 active:bg-gray-100 data-popup-open:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800 dark:focus-visible:outline-blue-400 dark:active:bg-gray-800 dark:data-popup-open:bg-gray-800',
        className,
      )}
      {...props}
    />
  );
}

export function Portal(props: Dialog.Portal.Props) {
  return <Dialog.Portal {...props} />;
}

export function Backdrop({ className, ...props }: Dialog.Backdrop.Props) {
  return (
    <Dialog.Backdrop
      className={clsx(
        'fixed inset-0 min-h-dvh bg-black/20 transition-all duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:bg-black/70 supports-[-webkit-touch-callout:none]:absolute',
        className,
      )}
      {...props}
    />
  );
}

export function Popup({ className, ...props }: Dialog.Popup.Props) {
  return (
    <Dialog.Popup
      className={clsx(
        'fixed top-[calc(50%+1.25rem*var(--nested-dialogs))] left-1/2 -mt-8 w-96 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 scale-[calc(1-0.1*var(--nested-dialogs))] rounded-lg bg-white p-5 text-gray-900 shadow-xl shadow-black/10 outline-1 outline-gray-200 transition-all duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-nested-dialog-open:after:absolute data-nested-dialog-open:after:inset-0 data-nested-dialog-open:after:rounded-[inherit] data-nested-dialog-open:after:bg-black/5 data-starting-style:scale-95 data-starting-style:opacity-0 dark:bg-gray-900 dark:text-gray-50 dark:shadow-2xl dark:shadow-black/50 dark:outline-gray-800 dark:data-nested-dialog-open:after:bg-black/20',
        className,
      )}
      {...props}
    />
  );
}

export function Title({ className, ...props }: Dialog.Title.Props) {
  return (
    <Dialog.Title
      className={clsx('-mt-0.5 mb-1 text-base leading-6 font-semibold', className)}
      {...props}
    />
  );
}

export function Close({ className, ...props }: Dialog.Close.Props) {
  return (
    <Dialog.Close
      className={clsx(
        'flex h-8 items-center justify-center rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 select-none hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-blue-600 active:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50 dark:hover:bg-gray-800 dark:focus-visible:outline-blue-400 dark:active:bg-gray-800',
        className,
      )}
      {...props}
    />
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5830** (2026-09-30): **[docs] Use default cursor for slider demo label**
  *Symptoms*: The Slider steps demo label renders a `div`, so hovering its text displays a text cursor instead of the default cursor used by native form labels.  Set `cursor: default` in the CSS Modules variant and `cursor-default` in the Tailwind variant.  - [x] I have followed (at least) the [PR section of the contributing guide](https://github.com/mui/base-ui/blob/HEAD/CONTRIBUTING.md#sending-a-pull-request). 
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/ec6e3f17-f9a9-40b7-a63b-88b4a574b236) - [vite-css-base-ui-example](https://pkg.pr.new/template/7bf3b495-0649-4f6b-87fa-d511dc49b116)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5830   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5830   ```     _commit: <a href="https://github.com/mui/base-ui/runs/109856280280"><code>bcf8a10</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react |  0B<sup>(0.00%)</sup> |  0B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=bcf8a10b27cc53b521919f34b3fae23d41e69e20&base=ced9c8171cd563271e5e8654b6f0984419786a0e&prNumber=5830&baseRef=master)  ## Performance  **Total duration:** 397.02 ms -16.10 ms<sup>(-3.9%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 723.21 ms -28.38 ms<sup>(-3.8%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Mixed surface mount (app-like density) | 32.94 ms ▼-9.75 ms<sup>(-22.8%)</sup> | 5 <sup>(+0)</sup> | | Combobox open — 500 items | 10.22 ms ▼-2.82 ms<sup>(-21.6%)</sup> | 4 <sup>(+0)</sup> |  *13 tests within noise — [details](https://code-infra-dashboard.onrender.com/benchmark-details/mui/base-ui?sha=bcf8a10b27cc53b521919f34b3fae23d41e69e20&prNumber=5830&baseR
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | bcf8a10b27cc53b521919f34b3fae23d41e69e20 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6abceba5a4ed3e000970d77f | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5830--base-ui.netlify.app](https://deploy-preview-5830--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4MzAtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.oQONl1aec6yYHHNyl7ynFIucdJIT3l2cJsjP5uuyjvY)<br /><br />_Use your smartphone cam

- **Issue #5824** (2026-09-30): **[menu] Toggle submenus on repeated trigger activation**
  *Symptoms*: TalkBack users can open a submenu but cannot close it by activating its trigger again with the default `openOnHover` behavior. TalkBack virtual-cursor navigation does not fire DOM focus events, so moving outside the submenu does not dismiss it; moving the cursor forward again re-enters it. Keep trigger toggling enabled so users can close the submenu and continue to the next item in the parent menu.  Normal keyboard navigation already closes the submenu when returning to its trigger, so activating that trigger still opens it again. Mouse presses retain the existing hover behavior. The toggle applies to supported trigger activations generally, including touch; TalkBack is the motivating case because its virtual cursor leaves DOM focus unchanged.  Extends the TalkBack activation test to cover open → close → reopen with the full virtual pointerdown/mousedown/click sequence, without manually focusing the trigger, and verifies the parent menu stays open and clarifies the existing test for ignoring the trailing click of a TalkBack press.  Validation: submenu tests passed in jsdom (30 passed) and Chromium (33 passed); TypeScript, focused ESLint, and Prettier checks passed. 
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/35c74410-b0a1-4440-8ec6-5705b09037cf) - [vite-css-base-ui-example](https://pkg.pr.new/template/374f5a0e-edd0-4941-a26d-b5a25717227f)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5824   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5824   ```     _commit: <a href="https://github.com/mui/base-ui/runs/109511751221"><code>18c3645</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react | ▼-1B<sup>(0.00%)</sup> | ▼-5B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=18c364537ffaf1c0d054946f67771d98394b0718&base=6a29b4b3b414251bf0ed23aa36e145d55e947c37&prNumber=5824&baseRef=master)  ## Performance  **Total duration:** 1,249.34 ms 🔺+334.26 ms<sup>(+36.5%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 2,098.42 ms 🔺+556.00 ms<sup>(+36.0%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Tabs mount (200 instances) | 255.87 ms 🔺+59.17 ms<sup>(+30.1%)</sup> | 3 <sup>(+0)</sup> | | Slider mount (300 instances) | 147.68 ms 🔺+44.33 ms<sup>(+42.9%)</sup> | 2 <sup>(+0)</sup> | | Select open (500 options) | 86.42 ms 🔺+43.23 ms<sup>(+100.1%)</sup> | 14 <sup>(+0)</sup> | | Checkbox mount (500 instances) | 106.35 ms 🔺+41.39 ms<sup>(+63.7
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | eb5cb8001c9d9d834527d0c3fa9258a7eb6413f7 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6abbbfdb12bdba00082a1e2b | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5824--base-ui.netlify.app](https://deploy-preview-5824--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4MjQtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.N_x-w4qdGX-b37ctfWdqgmAklzbY6etvUxBgHtmcFfc)<br /><br />_Use your smartphone cam

- **Issue #5823** (2026-09-30): **[code-infra] Bump pnpm to 12.6.0 and enable `autoDedupe`**
  *Symptoms*: Mirrors https://github.com/mui/mui-x/pull/23706. pnpm 12.6.0 adds the `autoDedupe` setting, so `pnpm install` and `pnpm add` deduplicate compatible versions and contributors no longer need a separate `pnpm dedupe` run to pass the `pnpm dedupe --check` CI step.  Includes the pnpm 12.6.0 bump the setting requires (mui/mui-x#23694). The lockfile only changes pnpm's own entries.
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/dba0a930-b13f-42d0-818c-e4d9a7f723e3) - [vite-css-base-ui-example](https://pkg.pr.new/template/7a6097ea-683c-4516-8b28-48694eab0362)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5823   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5823   ```     _commit: <a href="https://github.com/mui/base-ui/runs/109427228368"><code>c4fd2f2</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react |  0B<sup>(0.00%)</sup> |  0B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=c4fd2f2ff1906b92dc0e43adf1578fc2f33c6a5f&base=99f7a80b5e6352774a9de82c9dcd3a58ce0ff039&prNumber=5823&baseRef=master)  ## Performance  **Total duration:** 1,029.26 ms +97.48 ms<sup>(+10.5%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 1,734.86 ms +161.32 ms<sup>(+10.3%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Menu mount (300 instances) | 87.71 ms 🔺+16.78 ms<sup>(+23.7%)</sup> | 1 <sup>(+0)</sup> | | Menu open (500 items) | 46.63 ms 🔺+15.19 ms<sup>(+48.3%)</sup> | 11 <sup>(+0)</sup> | | Select open (500 options) | 70.47 ms 🔺+12.52 ms<sup>(+21.6%)</sup> | 14 <sup>(+0)</sup> | | Tooltip mount (300 contained roots) | 54.57 ms 🔺+9.45 ms<sup>(+21.0%)</sup> | 1 
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | c4fd2f2ff1906b92dc0e43adf1578fc2f33c6a5f | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6abbbb5aa6d4de0008d9aeec | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5823--base-ui.netlify.app](https://deploy-preview-5823--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4MjMtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.lgRQNPNz8paEe3kApqXBnr3RiJ1MFNAm5AigbdFCVYQ)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify

- **Issue #5819** (2026-09-29): **[select][menu][combobox] Improve mount performance of large lists**
  *Symptoms*: This PR reduces the mount cost of large Menu, Select, and Combobox lists. It came out of checking whether the store (`useSyncExternalStore`) is what makes our lists slower than a plain context + memo setup. In an isolated 1000-item list, the store added about 0.3 ms on mount and was on par or faster for highlight changes. Most of the gap came from CompositeList and from items subscribing to more than they need.  ## Changes  - **Menu items no longer read the positioner context.** Items only needed `nodeId` from it, but the context value changes identity twice while the popup positions itself. So every item rendered 3 times on open. Items now read `floatingNodeId` from the menu store, which is the same value the positioner passes to its floating context. `Menu.SubmenuTrigger` is unchanged, because its node id belongs to the parent menu. - **CompositeList sorting skips `compareDocumentPosition` for adjacent siblings.** In Chromium that call scans siblings from the parent's first child, so sorting a long flat list was effectively O(n²). Already-ordered lists now sort in linear time.  ## Performance  Lists with 1000 items, measured in headless Chromium with a production React 19 build, as medians of interleaved runs:  | Scenario (1000 items) | Before | After | Delta | | --- | ---: | ---: | ---: | | Menu: synchronous mount | 18.6 ms | 11.5 ms | −38% | | Select: synchronous mount | 15.8 ms | 14.2 ms | −10% | | Combobox: synchronous mount | 11.3 ms | 10.1 ms | −11% | | Menu: full eve
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/41626dcc-4556-4201-b4b5-a4dc9697d5a5) - [vite-css-base-ui-example](https://pkg.pr.new/template/6b13e9a1-f47c-4fdc-b177-b2cc1b0d109f)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5819   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5819   ```     _commit: <a href="https://github.com/mui/base-ui/runs/109369241782"><code>0d0280d</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react | 🔺+79B<sup>(+0.02%)</sup> | 🔺+18B<sup>(+0.01%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=0d0280d3fd02eb0d66e108eeadac8636af88da4c&base=8ab69a1f8a3c385225c3edd78a9c2439e0b763d6&prNumber=5819&baseRef=master)  ## Performance  **Total duration:** 852.03 ms -37.15 ms<sup>(-4.2%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 1,405.71 ms -59.60 ms<sup>(-4.1%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Checkbox mount (500 instances) | 61.47 ms 🔺+12.89 ms<sup>(+26.5%)</sup> | 1 <sup>(+0)</sup> | | Menu open (500 items) | 27.62 ms ▼-37.14 ms<sup>(-57.3%)</sup> | 11 <sup>(+0)</sup> |  *13 tests within noise — [details](https://code-infra-dashboard.onrender.com/benchmark-details/mui/base-ui?sha=0d0280d3fd02eb0d66e108eeadac8636af88da4c&prNumber=5819&bas
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 0d0280d3fd02eb0d66e108eeadac8636af88da4c | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6abb95beb81c430007c2f85f | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5819--base-ui.netlify.app](https://deploy-preview-5819--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4MTktLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.AfUYaN9Lcg2FaNLVDWcA2A68Q7njiecN0LVNvVz5IoU)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify

- **Issue #5816** (2026-09-29): **[menu][select][combobox] Call onTyping(false) when closing without moving focus**
  *Symptoms*: ### Reproduction    1. Go to https://base-ui.com/react/components/menu#checkbox-items.   2. Click the Workspace button.   3. Type "s"   4. Within 500 ms, press Escape.   5. Press "Enter" to reopen the popup.   6. Press "Space" to toggle the checkbox.    **Expected**: The checkbox toggles.   **Actual**: The checkbox does not toggle.    - [x] I have followed (at least) the [PR section of the contributing guide](https://github.com/mui/base-ui/blob/HEAD/CONTRIBUTING.md#sending-a-pull-request). 
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/de791b9d-8f43-4c81-a030-02825c596dda) - [vite-css-base-ui-example](https://pkg.pr.new/template/8da85a58-bb2c-4576-a4dc-6c861c8e0b74)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5816   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5816   ```     _commit: <a href="https://github.com/mui/base-ui/runs/109097694608"><code>62353f1</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react | 🔺+17B<sup>(0.00%)</sup> | 🔺+15B<sup>(+0.01%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=62353f1034a3b00195a56407bdcd25ebc4618ee6&base=62b54e8c944784c4de992eb424286b77cea4415a&prNumber=5816&baseRef=master)  ## Performance  **Total duration:** 1,053.47 ms -95.96 ms<sup>(-8.3%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 1,745.70 ms -181.55 ms<sup>(-9.4%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Select mount (200 instances) | 122.49 ms ▼-31.53 ms<sup>(-20.5%)</sup> | 3 <sup>(+0)</sup> | | Menu mount (300 instances) | 73.42 ms ▼-21.91 ms<sup>(-23.0%)</sup> | 1 <sup>(+0)</sup> | | Tooltip mount (300 contained roots) | 47.92 ms ▼-15.48 ms<sup>(-24.4%)</sup> | 1 <sup>(+0)</sup> | | Combobox type — 500 items, narrows to ~11 (type "Row 25") | 27.
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 62353f1034a3b00195a56407bdcd25ebc4618ee6 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6ababf64fd529700087b4edf | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5816--base-ui.netlify.app](https://deploy-preview-5816--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4MTYtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.KcdvfYRQmEjlrmwoqevkHqImrFwTU6Ka4uzdR9YFEcc)<br /><br />_Use your smartphone cam

- **Issue #5815** (2026-09-30): **[combobox] Fix inline highlight reset on close**
  *Symptoms*: Fix spurious `onItemHighlighted` callbacks when an inline Combobox shares controlled `open` state with a Dialog using `keepMounted`. Selecting an item could clear the highlight, re-highlight the selection while closing, and clear it again. Reopening could also restore an unwanted highlight.  The inline exemption added in #5586, after v1.8.0, allowed automatic selected-index synchronization while closed. Suppress that synchronization while preserving imperative navigation and highlight resets when an unbound inline list unmounts. Clear saved input highlights and pending query-clear restoration when the dialog closes.  Regression coverage includes single and multiple selection, filtered queries, close callbacks, repeated reopening, Enter without a highlight, and unbound dialog unmounts. Navigation cursor synchronization is deferred to a separate PR. 
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/2f422c9a-5e56-496e-923a-f3748540ce6f) - [vite-css-base-ui-example](https://pkg.pr.new/template/5fd84014-a926-4106-8ad6-09cce7299a32)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5815   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5815   ```     _commit: <a href="https://github.com/mui/base-ui/runs/109711894666"><code>53d19a4</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react | 🔺+101B<sup>(+0.02%)</sup> | 🔺+35B<sup>(+0.02%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=53d19a40daff901862e2316a29a82e275d2dac16&base=6a29b4b3b414251bf0ed23aa36e145d55e947c37&prNumber=5815&baseRef=master)  ## Performance  **Total duration:** 1,007.61 ms +112.33 ms<sup>(+12.5%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 1,703.08 ms +212.02 ms<sup>(+14.2%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Select open (500 options) | 63.01 ms 🔺+14.78 ms<sup>(+30.6%)</sup> | 14 <sup>(+0)</sup> | | Dialog mount (300 instances) | 32.79 ms 🔺+10.54 ms<sup>(+47.4%)</sup> | 1 <sup>(+0)</sup> | | Popover mount (300 instances) | 44.78 ms 🔺+10.28 ms<sup>(+29.8%)</sup> | 1 <sup>(+0)</sup> | | Menu open (500 items) | 33.06 ms 🔺+6.49 ms<sup>(+24.4%)</sup>
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 53d19a40daff901862e2316a29a82e275d2dac16 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6abc72ecb5580900089a6f27 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5815--base-ui.netlify.app](https://deploy-preview-5815--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4MTUtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.Yw5kM79l-EalpFK_o3eAqmtA_18am8GtzVLuK_kUpTI)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify

- **Issue #5813** (2026-09-28): **[scroll-area] Remove presentational viewport role**
  *Symptoms*: Remove the viewport's default presentational role and add a regression test. Fixes #5812.
  **Post-Mortem & Fix Analysis**:
  >  - [base-ui-tanstack-start](https://pkg.pr.new/template/bd4ba42d-4969-44d5-9398-0a28a0605b42) - [vite-css-base-ui-example](https://pkg.pr.new/template/37dc162f-32cd-4758-8b23-712d71dd698b)     ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/react@5813   ```       ```   pnpm add https://pkg.pr.new/mui/base-ui/@base-ui/utils@5813   ```     _commit: <a href="https://github.com/mui/base-ui/runs/108402395574"><code>9cf43c1</code></a>_ 
  > <!-- ci-report-comment -->  ## Bundle size  | Bundle | Parsed size | Gzip size | |:----------|----------:|----------:| | @base-ui/react | ▼-20B<sup>(0.00%)</sup> | ▼-2B<sup>(0.00%)</sup> |    [Details of bundle changes](https://code-infra-dashboard.onrender.com/size-comparison/mui/base-ui/diff?sha=9cf43c108599b74d530f2f59169e5376291c11c4&base=45a75a5785046af3700ac5671ecde620cdff8900&prNumber=5813&baseRef=master)  ## Performance  **Total duration:** 972.71 ms -87.30 ms<sup>(-8.2%)</sup> | **Renders:** 76 <sup>(+0)</sup> | **Paint:** 1,623.63 ms -141.80 ms<sup>(-8.0%)</sup>  | Test | Duration | Renders | |:-----|----------:|--------:| | Menu open (500 items) | 58.72 ms ▼-26.68 ms<sup>(-31.2%)</sup> | 11 <sup>(+0)</sup> |  *14 tests within noise — [details](https://code-infra-dashboard.onrender.com/benchmark-details/mui/base-ui?sha=9cf43c108599b74d530f2f59169e5376291c11c4&prNumber=5813&baseRef=master)*  <hr>  Check out the [code infra dashboard](https://code-infra-dashboard.onrender.com/r
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *base-ui* ready! Built [without sensitive environment variables](https://docs.netlify.com/configure-builds/environment-variables/#sensitive-variable-policy)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 29d8bd5b0aa8ce8c26eeda56775ecc0b14ebecc5 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/base-ui/deploys/6ab7b62d250e9f00085b13e5 | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-5813--base-ui.netlify.app](https://deploy-preview-5813--base-ui.netlify.app) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTU4MTMtLWJhc2UtdWkubmV0bGlmeS5hcHAifQ.XWAmRFmkg76SJg_EAp4skHoLY1gxO7c81Esw-KpSnlw)<br /><br />_Use your smartphone cam

- **Issue #5812** (2026-09-28): **[scroll area] Remove the presentational role from the viewport**
  *Symptoms*: # Bug report  ## Current behavior  `ScrollArea.Viewport` renders `role="presentation"` and sets `tabIndex` to `0` when scrollable or `-1` otherwise. Aria Toolkit reports an accessibility issue because the viewport has a presentational role while it is focusable.  ## Expected behavior  The viewport should remain keyboard-focusable when it has scrollable content, without a default role="presentation".  ## Base UI version  `1.8.0`  ## Which assistive tech are you using (if applicable)?  Aria Toolkit automated check  ## Additional context  WAI-ARIA says browsers ignore role="presentation" on focusable elements. Suggested fix: remove the viewport’s default presentational role and retain its existing conditional `tabIndex` behavior. - [WAI-ARIA APG: Hiding Semantics with the `presentation` Role](https://www.w3.org/WAI/ARIA/apg/practices/hiding-semantics/) - [Deque: Presentation role conflict](https://dequeuniversity.com/rules/axe-devtools/4.6/presentation-role-conflict) 
  **Post-Mortem & Fix Analysis**:
  > This fix will be available in the next npm release of Base UI.  In the meantime, use the [canary build](https://base-ui.com/react/overview/releases#canary-releases) from [PR #5813](https://github.com/mui/base-ui/pull/5813):  ```sh npm i https://pkg.pr.new/@base-ui/react@9cf43c1 ```  This installs a complete package for `@base-ui/react` with the fix included. It is hosted by pkg.pr.new rather than npm, and the URL is available for up to six months.

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

### Incident Patch 1: `aa73ef09` (2026-09-30)
**Commit Message**: [code-infra] Add the Claude CI flake-fix caller (#5729)

**File**: `.github/workflows/claude-flake-fix.yml` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+name: Claude CI flake fix
+
+# Runs mui-public's reusable flake-fix workflow against this repo's CircleCI: it triages recent
+# failures and, unless report-only, opens a draft PR proposing a fix. Runs weekly, and can be
+# dispatched by hand. This repo already has the four ANTHROPIC_* variables set; Actions must also be
+# allowed to create pull requests (Settings → Actions → General).
+
+on:
+  schedule:
+    - cron: '0 7 * * 1' # Monday 07:00 UTC
+  workflow_dispatch:
+    inputs:
+      report-only:
+        description: Classify and report, but never open a PR.
+        type: boolean
+        default: false
+      model:
+        description: Optional model override; leave blank to use mui-public's default.
+        type: string
+
+permissions: {}
+
+jobs:
+  flake-fix:
+    permissions:
+      actions: read # read this run's referenced_workflows (resolve-ref job)
+      id-token: write # Anthropic WIF (triage job)
+      contents: write # push the fix branch (publish job)
+      pull-requests: write # open the draft PR (publish job)
+      issues: write # rolling tracking issue (publish job)
+    uses: mui/mui-public/.github/workflows/claude-flake-fix.yml@4b286a4cc42bae9aa48222c28896330a125eac55 # master
+    with:
+      report-only: ${{ inputs.report-only || false }}
+      model: ${{ inputs.model }} # blank falls through to mui-public's central default
+      debug: true # always surface the agent's full output in the run log
```

---

### Incident Patch 2: `eb9e23e3` (2026-09-30)
**Commit Message**: [combobox] Fix inline highlight reset on close (#5815)

**File**: `packages/react/src/combobox/input/ComboboxInput.tsx` (modified, +10/-4)
```diff
@@ -1,6 +1,7 @@
 'use client';
 import * as React from 'react';
 import { useStableCallback } from '@base-ui/utils/useStableCallback';
+import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
 import { platform } from '@base-ui/utils/platform';
 import type { BaseUIComponentProps } from '../../internals/types';
 import { useBaseUiId } from '../../internals/useBaseUiId';
@@ -99,7 +100,13 @@ export const ComboboxInput = React.forwardRef(function ComboboxInput(
   const [composingValue, setComposingValue] = React.useState<string | null>(null);
   const isComposingRef = React.useRef(false);
   const lastActiveIndexRef = React.useRef<number | null>(null);
-  const shouldRestoreActiveIndexRef = React.useRef(false);
+
+  // Restore the saved highlight on refocus only within the same open cycle.
+  useIsoLayoutEffect(() => {
+    if (!open) {
+      lastActiveIndexRef.current = null;
+    }
+  }, [open]);
 
   const inputOwnsFormValue = selectionMode === 'none' && !hasPositionerParent;
 
@@ -210,12 +217,12 @@ export const ComboboxInput = React.forwardRef(function ComboboxInput(
         onFocus() {
           setFocused(true);
 
-          if (!inline || !shouldRestoreActiveIndexRef.current) {
+          if (!inline) {
             return;
           }
 
-          shouldRestoreActiveIndexRef.current = false;
           const nextActiveIndex = lastActiveIndexRef.current;
+          lastActiveIndexRef.current = null;
 
           if (
             nextActiveIndex == null ||
@@ -234,7 +241,6 @@ export const ComboboxInput = React.forwardRef(function ComboboxInput(
           const activeIndex = store.state.activeIndex;
           if (inline && activeIndex !== null && autoHighlightMode !== 'always') {
             lastActiveIndexRef.current = activeIndex;
-            shouldRestoreActiveIndexRef.current = true;
             store.context.setIndices({ activeIndex: null });
           }
 
```

**File**: `packages/react/src/combobox/root/AriaCombobox.tsx` (modified, +17/-7)
```diff
@@ -1054,6 +1054,13 @@ export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', I
   }, [items, flatFilteredValues]);
 
   useIsoLayoutEffect(() => {
+    // A kept-mounted dialog hides its inline list on close. Discard query-clear restoration
+    // before it can overwrite the cleared highlight or report an item from the unfiltered list.
+    if (!open && inline && resolvedPopupRef.current) {
+      pendingQueryHighlightRef.current = null;
+      return;
+    }
+
     const pendingHighlight = pendingQueryHighlightRef.current;
     if (pendingHighlight) {
       // A directly rendered list remains visible when the popup state is closed, while a
@@ -1084,7 +1091,7 @@ export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', I
           // commit, so the item registries are mid-update here. Defer past React's cascade.
           queueMicrotask(() => {
             if (
-              (!store.state.open && !store.state.inline) ||
+              (!store.state.open && (!store.state.inline || resolvedPopupRef.current)) ||
               (inputRef.current && inputRef.current.value.trim() !== '')
             ) {
               return;
@@ -1180,6 +1187,7 @@ export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', I
     flatFilteredValues,
     inline,
     open,
+    resolvedPopupRef,
     store,
     // Reruns the effect when the query changes without affecting the deps above, such as
     // clearing the input when no items are filtered out (individually rendered items).
@@ -1376,12 +1384,14 @@ export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', I
     disabledIndices: EMPTY_ARRAY,
     grid: grid ? gridNavigation : undefined,
     onNavigate(nextActiveIndex, event, source) {
-      // Retain the highlight only while actually transitioning out or closed. `inline` lists are
-      // navigable while `open` is false, and the floating store is told they are open (see the
-      // `useFloatingRootContext` call above), so they must not be vetoed here either: doing so
-      // would discard programmatic navigation while `useListNavigation` had already advanced its
-      // internal cursor, leaving the two permanently out of sync.
-      if ((!event && !open && !inline) || transitionStatus === 'ending') {
+      // Ignore automatic navigation while closed, including selected-index sync for inline lists.
+      // Inline lists remain navigable while `open` is false, so still allow imperative navigation
+      // (keeping the highlight in sync with the cursor advanced by `highlightItem()`) and resets
+      // (clearing the highlight when an unbound inline list unmounts, e.g. in a closed dialog).
+      if (
+        (!event && !open && source !== 'imperative' && !(inline && nextActiveIndex === null)) ||
+        transitionStatus === 'ending'
+      ) {
         return;
       }
 
```

**File**: `packages/react/src/combobox/root/ComboboxRoot.test.tsx` (modified, +128/-0)
```diff
@@ -10720,6 +10720,134 @@ describe('<Combobox.Root />', () => {
     const fruits = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];
     const asyncFruits = ['apple', 'banana', 'cherry'];
 
+    it.each([
+      [false, ''],
+      [false, 'Ba'],
+      [true, ''],
+      [true, 'Ba'],
+    ] as const)(
+      'clears the highlight when a keepMounted dialog closes (multiple=%s, query="%s")',
+      async (multiple, query) => {
+        const onItemHighlighted = vi.fn();
+        const onValueChange = vi.fn();
+
+        function Test() {
+          const [open, setOpen] = React.useState(false);
+          return (
+            <Combobox.Root
+              inline
+              multiple={multiple}
+              items={['Apple', 'Banana']}
+              open={open}
+              onOpenChange={setOpen}
+              onItemHighlighted={onItemHighlighted}
+              onValueChange={(value) => {
+                onValueChange(value);
+                setOpen(false);
+              }}
+            >
+              <Dialog.Root open={open} onOpenChange={setOpen}>
+                <Dialog.Trigger>Choose fruit</Dialog.Trigger>
+                <Dialog.Portal keepMounted>
+                  <Dialog.Popup
+                    aria-label="Fruit chooser"
+                    style={{ opacity: open ? 1 : 0, transition: 'opacity 50ms' }}
+                  >
+                    <Combobox.Input />
+                    <Combobox.List>
+                      {(item: string) => (
+                        <Combobox.Item key={item} value={item}>
+                          {item}
+                        </Combobox.Item>
+                      )}
+                    </Combobox.List>
+                    <Dialog.Close>Done</Dialog.Close>
+                  </Dialog.Popup>
+                </Dialog.Portal>
+              </Dialog.Root>
+            </Combobox.Root>
+          );
+        }
+
+        const { user } = await render(<Test />);
+        const trigger = screen.getByRole('button', { name: 'Choose fruit' });
+        await user.click(trigger);
+        const input = screen.getByRole('combobox');
+        await waitFor(() => expect(input).toHaveFocus());
+        if (query) {
+          await user.type(input, query);
+        }
+        await user.keyboard(query ? '{ArrowDown}' : '{ArrowDown}{ArrowDown}');
+        expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute('data-highlighted');
+        onItemHighlighted.mockClear();
+
+        await user.keyboard('{Enter}');
+        await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
+        expect(onValueChange).toHaveBeenLastCalledWith(multiple ? ['Banana'] : 'Banana');
+        expect(onItemHighlighted.mock.calls.map(([value]) => value)).toEqual([undefined]);
+
+        async function reopenAndNavigate(closeWithEscape = false) {
+          await user.click(trigger);
+          await waitFor(() => expect(input).toHaveFocus());
+          expect(input).not.toHaveAttribute('aria-activedescendant');
+          onValueChange.mockClear();
+          await user.keyboard('{Enter}');
+          expect(onValueChange).not.toHaveBeenCalled();
+          await user.keyboard('{ArrowDown}');
+          if (closeWithEscape) {
+            await user.keyboard('{Escape}');
+          } else {
+            await user.click(screen.getByRole('button', { name: 'Done' }));
+          }
+          await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
+        }
+
+        await reopenAndNavigate(true);
+        await reopenAndNavigate();
+        await reopenAndNavigate();
+      },
+    );
+
+    it('clears the highlight when an inline list in an unbound dialog unmounts', async () => {
+      await render(
+        <Combobox.Root inline items={['Apple', 'Banana', 'Cherry']}>
+          <Dialog.Root>
+            <Dialog.Trigger>Choose fruit</Dialog.Trigger>
+            <Dialog.Portal>
+              <Dialog.Popup aria-label="Fruit chooser">
+         
```

---

### Incident Patch 3: `5cc9fbd5` (2026-09-25)
**Commit Message**: [all components] Fix stale focused field state (#5345)

**File**: `packages/react/src/checkbox/root/CheckboxRoot.test.tsx` (modified, +60/-0)
```diff
@@ -1469,6 +1469,66 @@ describe('<Checkbox.Root />', () => {
       expect(button).not.toHaveAttribute('data-focused');
     });
 
+    describe('[data-focused] without a blur event', () => {
+      function Checkboxes(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
+        const { firstMounted = true, firstDisabled = false } = props;
+        return (
+          <Field.Root data-testid="root">
+            {firstMounted && <Checkbox.Root data-testid="first" disabled={firstDisabled} />}
+          </Field.Root>
+        );
+      }
+
+      it('is removed when the focused checkbox becomes disabled', async () => {
+        const { setProps } = await render(<Checkboxes />);
+
+        const button = screen.getByTestId('first');
+        act(() => {
+          button.focus();
+        });
+
+        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
+
+        await setProps({ firstDisabled: true });
+
+        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
+        expect(button).not.toHaveAttribute('data-focused');
+      });
+
+      it('is removed when the focused checkbox unmounts', async () => {
+        const { setProps } = await render(<Checkboxes />);
+
+        act(() => {
+          screen.getByTestId('first').focus();
+        });
+
+        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
+
+        await setProps({ firstMounted: false });
+
+        expect(screen.getByTestId('root')).not.toHaveAttribute('data-focused');
+      });
+
+      it('is kept when the checkbox is focused during mount in StrictMode', async () => {
+        function FocusOnMount() {
+          const ref = React.useRef<HTMLButtonElement>(null);
+          React.useEffect(() => {
+            ref.current?.focus();
+          }, []);
+          return (
+            <Field.Root data-testid="root">
+              <Checkbox.Root ref={ref} />
+            </Field.Root>
+          );
+        }
+
+        // `render` is strict, so the checkbox's effects re-run after the mount-time focus.
+        await render(<FocusOnMount />);
+
+        expect(screen.getByTestId('root')).toHaveAttribute('data-focused', '');
+      });
+    });
+
     it('[data-invalid]', async () => {
       await render(
         <Field.Root invalid>
```

**File**: `packages/react/src/checkbox/root/CheckboxRoot.tsx` (modified, +3/-4)
```diff
@@ -20,6 +20,7 @@ import { mergeProps } from '../../merge-props';
 import { useButton } from '../../internals/use-button/useButton';
 import type { FieldRootState } from '../../field/root/FieldRoot';
 import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
+import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
 import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
 import { useFieldItemContext } from '../../field/item/FieldItemContext';
 import { useFormContext } from '../../internals/form-context/FormContext';
@@ -76,7 +77,6 @@ export const CheckboxRoot = React.forwardRef(function CheckboxRoot(
     name: fieldName,
     setDirty,
     setFilled,
-    setFocused,
     setTouched,
     state: fieldState,
     validationMode,
@@ -126,6 +126,7 @@ export const CheckboxRoot = React.forwardRef(function CheckboxRoot(
   const groupValue = groupContext?.value;
 
   const controlRef = React.useRef<HTMLButtonElement>(null);
+  const setFocused = useSetFieldFocused(disabled, controlRef);
 
   const { getButtonProps, buttonRef } = useButton({
     disabled,
@@ -303,9 +304,7 @@ export const CheckboxRoot = React.forwardRef(function CheckboxRoot(
         'aria-labelledby': ariaLabelledBy,
         [PARENT_CHECKBOX as string]: parent ? '' : undefined,
         onFocus() {
-          if (!disabled) {
-            setFocused(true);
-          }
+          setFocused(true);
         },
         onBlur() {
           const inputEl = inputRef.current;
```

**File**: `packages/react/src/combobox/input/ComboboxInput.tsx` (modified, +3/-1)
```diff
@@ -13,6 +13,7 @@ import {
   FieldRootContext,
   useFieldRootContext,
 } from '../../internals/field-root-context/FieldRootContext';
+import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
 import { DEFAULT_FIELD_STATE_ATTRIBUTES } from '../../internals/field-constants/constants';
 import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
 import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
@@ -54,7 +55,6 @@ export const ComboboxInput = React.forwardRef(function ComboboxInput(
     state: fieldState,
     disabled: fieldDisabled,
     setTouched,
-    setFocused,
     validationMode,
     validation,
   } = useFieldRootContext();
@@ -89,6 +89,8 @@ export const ComboboxInput = React.forwardRef(function ComboboxInput(
   const disabled = fieldDisabled || comboboxDisabled || disabledProp;
   const listEmpty = useListEmpty();
 
+  const setFocused = useSetFieldFocused(disabled, store.context.inputRef);
+
   const isInsidePopup = hasPositionerParent || inline;
   const focusManagerModal = !isInsidePopup || modal;
   const id = useBaseUiId(idProp ?? (!isInsidePopup ? rootId : undefined));
```

**File**: `packages/react/src/combobox/root/ComboboxRoot.test.tsx` (modified, +86/-0)
```diff
@@ -12116,6 +12116,92 @@ describe('<Combobox.Root />', () => {
       expect(trigger).not.toHaveAttribute('data-focused');
     });
 
+    describe('[data-focused] without a blur event', () => {
+      function Comboboxes(props: { firstMounted?: boolean; firstDisabled?: boolean }) {
+        const { firstMounted = true, firstDisabled = false } = props;
+        return (
+          <Field.Root data-testid="field">
+            {firstMounted && (
+              <Combobox.Root disabled={firstDisabled}>
+                <Combobox.Input data-testid="first" />
+              </Combobox.Root>
+            )}
+          </Field.Root>
+        );
+      }
+
+      it('is removed when the focused input becomes disabled', async () => {
+        const { setProps } = await render(<Comboboxes />);
+
+        const input = screen.getByTestId('first');
+        act(() => {
+          input.focus();
+        });
+
+        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
+
+        await setProps({ firstDisabled: true });
+
+        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
+        expect(input).not.toHaveAttribute('data-focused');
+      });
+
+      it('is removed when the focused input unmounts', async () => {
+        const { setProps } = await render(<Comboboxes />);
+
+        act(() => {
+          screen.getByTestId('first').focus();
+        });
+
+        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
+
+        await setProps({ firstMounted: false });
+
+        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
+      });
+
+      function Triggers(props: { disabled?: boolean; mounted?: boolean }) {
+        const { disabled = false, mounted = true } = props;
+        return (
+          <Field.Root data-testid="field">
+            <Combobox.Root disabled={disabled}>
+              {mounted && <Combobox.Trigger data-testid="trigger" />}
+            </Combobox.Root>
+          </Field.Root>
+        );
+      }
+
+      it('is removed when the focused trigger becomes disabled', async () => {
+        const { setProps } = await render(<Triggers />);
+
+        const trigger = screen.getByTestId('trigger');
+        act(() => {
+          trigger.focus();
+        });
+
+        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
+
+        await setProps({ disabled: true });
+
+        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
+        expect(trigger).not.toHaveAttribute('data-focused');
+      });
+
+      it('is removed when the focused trigger unmounts', async () => {
+        const { setProps } = await render(<Triggers />);
+
+        act(() => {
+          screen.getByTestId('trigger').focus();
+        });
+
+        expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
+
+        await setProps({ mounted: false });
+
+        expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
+      });
+    });
+
     it('does not mark as touched when focus moves into the popup', async () => {
       const validateSpy = vi.fn(() => 'error');
 
```

**File**: `packages/react/src/combobox/trigger/ComboboxTrigger.tsx` (modified, +5/-2)
```diff
@@ -13,6 +13,7 @@ import {
 } from '../root/ComboboxRootContext';
 import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
 import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
+import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
 import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
 import { stopEvent, contains, getTarget } from '../../floating-ui-react/utils';
 import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
@@ -50,7 +51,6 @@ export const ComboboxTrigger = React.forwardRef(function ComboboxTrigger(
     state: fieldState,
     disabled: fieldDisabled,
     setTouched,
-    setFocused,
     validationMode,
     validation,
   } = useFieldRootContext();
@@ -83,6 +83,9 @@ export const ComboboxTrigger = React.forwardRef(function ComboboxTrigger(
   const listEmpty = useListEmpty();
   const popupSide = usePopupSide(store);
 
+  const triggerRef = React.useRef<HTMLElement | null>(null);
+  const setFocused = useSetFieldFocused(disabled, triggerRef);
+
   useLabelableId({ id: inputInsidePopup ? idProp : undefined });
   const id = inputInsidePopup ? (idProp ?? rootId) : idProp;
   const ariaLabelledBy = resolveAriaLabelledBy(fieldLabelId, comboboxLabelId);
@@ -143,7 +146,7 @@ export const ComboboxTrigger = React.forwardRef(function ComboboxTrigger(
   });
 
   const element = useRenderElement('button', componentProps, {
-    ref: [forwardedRef, buttonRef, setTriggerElement],
+    ref: [forwardedRef, buttonRef, triggerRef, setTriggerElement],
     state,
     props: [
       triggerProps,
```

---

### Incident Patch 4: `0b7b639d` (2026-09-24)
**Commit Message**: [slider] Fix touch track tap not firing onValueCommitted (#5779)

**File**: `packages/react/src/slider/control/SliderControl.tsx` (modified, +28/-9)
```diff
@@ -20,6 +20,7 @@ import { useDirection } from '../../internals/direction-context/DirectionContext
 import { useSliderRootContext } from '../root/SliderRootContext';
 import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
 import type { SliderRootState } from '../root/SliderRoot';
+import { isTouchLikePointerType } from '../../internals/usePressAndHold';
 import { getMidpoint } from '../utils/getMidpoint';
 import { roundValueToStep } from '../utils/roundValueToStep';
 import { validateMinimumDistance } from '../utils/validateMinimumDistance';
@@ -134,6 +135,9 @@ export const SliderControl = React.forwardRef(function SliderControl(
   // This value should be equal to the radius or half the width/height of the thumb.
   const insetThumbOffsetRef = React.useRef(0);
   const currentInteractionValueRef = React.useRef<number | number[] | null>(null);
+  // Whether `pointerdown` started the current gesture, so the `touchstart` that follows it
+  // doesn't restart it.
+  const pointerGestureRef = React.useRef(false);
   const latestValuesRef = useValueAsRef(values);
 
   function getThumbInput(el: Element | null | undefined) {
@@ -380,6 +384,11 @@ export const SliderControl = React.forwardRef(function SliderControl(
   });
 
   const handleTouchStart = useStableCallback((nativeEvent: TouchEvent) => {
+    // Only the `touchstart` right after `pointerdown` belongs to the pointer gesture, so consume
+    // the flag here where it can't outlive a cancelled gesture.
+    const startedByPointer = pointerGestureRef.current;
+    pointerGestureRef.current = false;
+
     if (disabled) {
       return;
     }
@@ -396,19 +405,24 @@ export const SliderControl = React.forwardRef(function SliderControl(
 
     touchIdRef.current = touch.identifier;
 
-    const fingerCoords = { x: touch.clientX, y: touch.clientY };
-    startPressing(fingerCoords);
+    // The pointer handlers already started this gesture. Keep its state and only add the touch
+    // listeners, which continue tracking the finger if the browser cancels the pointer.
+    if (!startedByPointer) {
+      const fingerCoords = { x: touch.clientX, y: touch.clientY };
+      startPressing(fingerCoords);
 
-    const finger = getFingerState(fingerCoords);
+      const finger = getFingerState(fingerCoords);
 
-    if (finger == null) {
-      return;
-    }
+      if (finger == null) {
+        return;
+      }
 
-    focusThumb(finger.thumbIndex);
-    setValueFromPointer(finger, REASONS.trackPress, nativeEvent);
+      focusThumb(finger.thumbIndex);
+      setValueFromPointer(finger, REASONS.trackPress, nativeEvent);
+
+      moveCountRef.current = 0;
+    }
 
-    moveCountRef.current = 0;
     const doc = ownerDocument(controlRef.current);
     doc.addEventListener('touchmove', handleTouchMove, { passive: true });
     doc.addEventListener('touchend', handleTouchEnd, { passive: true });
@@ -422,6 +436,7 @@ export const SliderControl = React.forwardRef(function SliderControl(
     doc.removeEventListener('touchend', handleTouchEnd);
     pressedValuesRef.current = null;
     currentInteractionValueRef.current = null;
+    pointerGestureRef.current = false;
   });
 
   const focusFrame = useAnimationFrame();
@@ -457,6 +472,8 @@ export const SliderControl = React.forwardRef(function SliderControl(
       {
         ['data-base-ui-slider-control' as string]: renderBeforeHydration ? '' : undefined,
         onPointerDown(event) {
+          // Replace a flag left by a cancelled gesture that had no `touchstart` to consume it.
+          pointerGestureRef.current = false;
           const control = controlRef.current;
           const target = getTarget(event.nativeEvent);
 
@@ -510,6 +527,8 @@ export const SliderControl = React.forwardRef(function SliderControl(
           }
 
           moveCountRef.current = 0;
+          // Touch and pen presses can be followed by a compatibility `touchstart` (Apple Pencil).
+          pointerGestureRef.current = isTouchLikePoin
```

**File**: `packages/react/src/slider/root/SliderRoot.test.tsx` (modified, +265/-7)
```diff
@@ -1,4 +1,4 @@
-import { expect, vi, describe, beforeAll, it } from 'vitest';
+import { expect, vi, describe, beforeAll, afterAll, it } from 'vitest';
 import * as React from 'react';
 import { act, flushMicrotasks, fireEvent, screen, waitFor } from '@mui/internal-test-utils';
 import { DirectionProvider, type TextDirection } from '@base-ui/react/direction-provider';
@@ -21,6 +21,7 @@ import type { SliderRoot } from './SliderRoot';
 import { createTouches, getHorizontalSliderRect } from '../utils/test-utils';
 
 const isWebKit = platform.engine.webkit;
+const isBlink = platform.engine.blink;
 
 const USD_NUMBER_FORMAT: Intl.NumberFormatOptions = {
   style: 'currency',
@@ -73,12 +74,35 @@ function TestMultiThumbSlider(props: SliderRoot.Props) {
 }
 
 describe('<Slider.Root />', () => {
-  beforeAll(function beforeHook() {
-    // jsdom implements PointerEvent now (jsdom#2527 is fixed), but not the pointer capture methods
-    // on Element, so the slider throws on `setPointerCapture`/`hasPointerCapture` without this.
-    // Note this also applies in real browsers, where it costs `pointerId` and `pointerType` on
-    // every event. Replace with stubs for the three capture methods to drop it.
-    (window as any).PointerEvent = window.MouseEvent;
+  const pointerCaptureMethods = [
+    'setPointerCapture',
+    'hasPointerCapture',
+    'releasePointerCapture',
+  ] as const;
+  const pointerCaptureDescriptors = pointerCaptureMethods.map((method) =>
+    Object.getOwnPropertyDescriptor(Element.prototype, method),
+  );
+
+  beforeAll(() => {
+    // Synthetic pointer events have no active pointer to capture. Preserve PointerEvent so
+    // gesture tests still exercise their pointerType and pointerId.
+    pointerCaptureMethods.forEach((method) => {
+      Object.defineProperty(Element.prototype, method, {
+        configurable: true,
+        value: vi.fn(() => false),
+      });
+    });
+  });
+
+  afterAll(() => {
+    pointerCaptureMethods.forEach((method, index) => {
+      const descriptor = pointerCaptureDescriptors[index];
+      if (descriptor) {
+        Object.defineProperty(Element.prototype, method, descriptor);
+      } else {
+        Reflect.deleteProperty(Element.prototype, method);
+      }
+    });
   });
 
   const { render, renderToString } = createRenderer();
@@ -834,6 +858,240 @@ describe('<Slider.Root />', () => {
       expect(handleValueCommitted.mock.results.at(-1)?.value.reason).toBe(REASONS.inputChange);
     });
 
+    it.each(['touch', 'pen'])('commits a %s track tap', async (pointerType) => {
+      const handleValueCommitted = vi.fn();
+
+      function ControlledSlider() {
+        const [value, setValue] = React.useState(0);
+        return (
+          <Slider.Root
+            value={value}
+            onValueChange={setValue}
+            onValueCommitted={handleValueCommitted}
+          >
+            <Slider.Control data-testid="control">
+              <Slider.Thumb />
+            </Slider.Control>
+          </Slider.Root>
+        );
+      }
+
+      await render(<ControlledSlider />);
+
+      const sliderControl = screen.getByTestId('control');
+
+      vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(getHorizontalSliderRect);
+
+      const touches = createTouches([{ identifier: 1, clientX: 50, clientY: 0 }]);
+
+      // Browsers fire pointer events before the compatibility touch events, including for
+      // Apple Pencil.
+      fireEvent.pointerDown(sliderControl, {
+        pointerType,
+        pointerId: 1,
+        buttons: 1,
+        clientX: 50,
+      });
+      fireEvent.touchStart(sliderControl, touches);
+      fireEvent.pointerUp(sliderControl, { pointerType, pointerId: 1, clientX: 50 });
+      fireEvent.touchEnd(document.body, touches);
+
+      expect(handleValueCommitted.mock.calls.length).toBe(1);
+      expect(handleValueCommitted.mock.calls[0][0]).toBe(50);
+    });
+
+    // Real touch input, so the browser decides the pointer and c
```

---

### Incident Patch 5: `540c176c` (2026-09-22)
**Commit Message**: [drawer] Fix native focus scrolling on iOS 27 (#5769)

**File**: `packages/react/src/drawer/virtual-keyboard-provider/DrawerVirtualKeyboardProvider.test.tsx` (modified, +110/-15)
```diff
@@ -1718,6 +1718,13 @@ describe('<Drawer.VirtualKeyboardProvider />', () => {
         };
         document.addEventListener('focusout', onFocusOut);
         const blurSpy = vi.spyOn(second, 'blur');
+        const focusSpy = vi.spyOn(second, 'focus');
+        const onFocus = vi.fn();
+        second.addEventListener('focus', onFocus);
+        let optionsDuringFocusIn: FocusOptions | undefined;
+        second.addEventListener('focusin', () => {
+          optionsDuringFocusIn = focusSpy.mock.lastCall?.[0];
+        });
 
         try {
           // Simulates the iOS keyboard's next-field arrow: focus moves with no touch events.
@@ -1729,10 +1736,16 @@ describe('<Drawer.VirtualKeyboardProvider />', () => {
           expect(second.style.transform).toBe('');
           expect(second.style.opacity).toBe('');
           expect(blurSpy).not.toHaveBeenCalled();
+          // The iOS 27 native focus request is recorded between focus and focusin.
+          // Protect it during focus without emitting another focus/blur cycle.
+          expect(optionsDuringFocusIn).toEqual({ preventScroll: true });
+          expect(focusSpy).toHaveBeenCalledTimes(2);
+          expect(onFocus).toHaveBeenCalledTimes(1);
           expect(second).toHaveFocus();
         } finally {
           document.removeEventListener('focusout', onFocusOut);
           blurSpy.mockRestore();
+          focusSpy.mockRestore();
         }
       } finally {
         visualViewport.restore();
@@ -2895,17 +2908,105 @@ describe('<Drawer.VirtualKeyboardProvider />', () => {
     },
   );
 
-  it.skipIf(isJSDOM)('focuses the labelled control when a label is tapped', async () => {
+  it.skipIf(isJSDOM).each(['explicit', 'implicit'])(
+    'preserves preventScroll after activating an %s label with no input focused',
+    async (association) => {
+      const field = <input data-testid="input" id="note" type="text" />;
+      await render(
+        <Drawer.Root open modal={false}>
+          <Drawer.VirtualKeyboardProvider>
+            <Drawer.Portal>
+              <Drawer.Viewport>
+                <Drawer.Popup initialFocus={false}>
+                  <label
+                    data-testid="label"
+                    htmlFor={association === 'explicit' ? 'note' : undefined}
+                  >
+                    <span data-testid="label-text">Note</span>
+                    {association === 'implicit' && field}
+                  </label>
+                  {association === 'explicit' && field}
+                </Drawer.Popup>
+              </Drawer.Viewport>
+            </Drawer.Portal>
+          </Drawer.VirtualKeyboardProvider>
+        </Drawer.Root>,
+      );
+
+      const label = screen.getByTestId('label');
+      const input = screen.getByTestId('input');
+      const labelText = screen.getByTestId('label-text');
+      expect(input).not.toHaveFocus();
+      const focusSpy = vi.spyOn(input, 'focus');
+      const onFocus = vi.fn();
+      const onBlur = vi.fn();
+      input.addEventListener('focus', onFocus);
+      input.addEventListener('blur', onBlur);
+      const inputClickEvents: MouseEvent[] = [];
+      let focusCallsDuringActivation = 0;
+      input.addEventListener('click', (clickEvent) => {
+        inputClickEvents.push(clickEvent);
+        focusCallsDuringActivation = focusSpy.mock.calls.length;
+      });
+      const labelClickEvents: MouseEvent[] = [];
+      label.addEventListener('click', (clickEvent) => {
+        if (clickEvent.target === labelText) {
+          labelClickEvents.push(clickEvent);
+        }
+      });
+      const originalElementFromPoint = document.elementFromPoint;
+      document.elementFromPoint = () => labelText;
+
+      try {
+        fireEvent.touchStart(labelText, {
+          touches: [createTouch(labelText, { clientX: 24, clientY: 48 })],
+        });
+
+        const touchEnd = createNativeTouchEnd(labelText, { clientX: 24, clientY: 48 });
+
+        await act(async () => {
+          labelText.
```

**File**: `packages/react/src/drawer/virtual-keyboard-provider/DrawerVirtualKeyboardProvider.tsx` (modified, +19/-0)
```diff
@@ -415,6 +415,15 @@ export function DrawerVirtualKeyboardProvider(props: DrawerVirtualKeyboardProvid
       return true;
     };
 
+    const handleFocus = (event: FocusEvent) => {
+      const target = focusedKeyboardTargetRef.current;
+      // iOS 27 dispatches focus before recording the native focus options. Reapply
+      // preventScroll here, before focusin, so keyboard-arrow navigation retains it.
+      if (restorePreemptedFocus && target && target === getTarget(event)) {
+        target.focus({ preventScroll: true });
+      }
+    };
+
     const handleFocusIn = (event: FocusEvent) => {
       // The programmatic transition is over once focus lands, which happens before
       // `.focus()` returns. Any later `focusout` is the consumer's own — an `onFocus`
@@ -502,6 +511,7 @@ export function DrawerVirtualKeyboardProvider(props: DrawerVirtualKeyboardProvid
     };
 
     cleanupListeners.push(
+      addEventListener(doc, 'focus', handleFocus, true),
       addEventListener(doc, 'focusin', handleFocusIn, true),
       addEventListener(doc, 'focusout', handleFocusOut, true),
       addEventListener(win, 'scroll', handleWindowScroll),
@@ -631,6 +641,15 @@ export function DrawerVirtualKeyboardProvider(props: DrawerVirtualKeyboardProvid
       // events, including `click`; redispatch an untrusted replacement on the
       // original tap target so click handlers still run with the tap coordinates.
       dispatchKeyboardClick(keyboardClickTarget, touch);
+      // Label activation refocuses its control without preventScroll. While the keyboard
+      // is opening, WebKit replaces the pending focus options even for an already-focused
+      // input. Reapply preventScroll without blurring or undoing a consumer's focus change.
+      if (
+        keyboardClickTarget !== keyboardFocusTarget &&
+        activeElement(ownerDocument(keyboardFocusTarget)) === keyboardFocusTarget
+      ) {
+        keyboardFocusTarget.focus({ preventScroll: true });
+      }
       resetTouchTrackingState();
       return;
     }
```

---

### Incident Patch 6: `218c9e8f` (2026-09-21)
**Commit Message**: [menu] Fix event listener cleanup in MenuTrigger component (#5764)

**File**: `packages/react/src/menu/trigger/MenuTrigger.test.tsx` (modified, +36/-0)
```diff
@@ -133,6 +133,42 @@ describe('<Menu.Trigger />', () => {
     expect(menuPopup).toHaveAttribute('data-open', '');
   });
 
+  it('removes the hover mouseup listener when unmounted before mouseup', async () => {
+    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
+    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
+
+    try {
+      const { user, unmount } = await render(
+        <Menu.Root>
+          <Menu.Trigger delay={0} openOnHover>
+            Open
+          </Menu.Trigger>
+          <Menu.Portal>
+            <Menu.Positioner>
+              <Menu.Popup />
+            </Menu.Positioner>
+          </Menu.Portal>
+        </Menu.Root>,
+      );
+
+      const trigger = screen.getByRole('button', { name: 'Open' });
+      addEventListenerSpy.mockClear();
+      await user.hover(trigger);
+      await screen.findByRole('menu', { hidden: false });
+
+      const mouseUpListener = addEventListenerSpy.mock.calls.find(
+        (call) => call[0] === 'mouseup',
+      )?.[1];
+      expect(mouseUpListener).toBeTypeOf('function');
+
+      unmount();
+      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', mouseUpListener);
+    } finally {
+      addEventListenerSpy.mockRestore();
+      removeEventListenerSpy.mockRestore();
+    }
+  });
+
   describe('keyboard navigation', () => {
     [
       <Menu.Trigger>Open</Menu.Trigger>,
```

**File**: `packages/react/src/menu/trigger/MenuTrigger.tsx` (modified, +8/-1)
```diff
@@ -154,10 +154,17 @@ export const MenuTrigger = fastComponentRef(function MenuTrigger(
   });
 
   React.useEffect(() => {
+    const doc = ownerDocument(triggerRef.current);
+
     if (isOpenedByThisTrigger && store.select('lastOpenChangeReason') === REASONS.triggerHover) {
-      const doc = ownerDocument(triggerRef.current);
       doc.addEventListener('mouseup', handleDocumentMouseUp, { once: true });
+
+      return () => {
+        doc.removeEventListener('mouseup', handleDocumentMouseUp);
+      };
     }
+
+    return undefined;
   }, [isOpenedByThisTrigger, handleDocumentMouseUp, store]);
 
   const parentMenubarHasSubmenuOpen = isInMenubar && parent.context.hasSubmenuOpen;
```

---

### Incident Patch 7: `b982ca9b` (2026-09-21)
**Commit Message**: [popover] Fix focus guard loop when the trigger is the only tabbable element (#5733)

**File**: `packages/react/src/context-menu/root/ContextMenuRoot.test.tsx` (modified, +29/-0)
```diff
@@ -283,6 +283,35 @@ describe('<ContextMenu.Root />', () => {
     });
   });
 
+  it('returns focus to the focused surface when closing with Shift+Tab', async () => {
+    const { user } = await render(
+      <ContextMenu.Root>
+        <ContextMenu.Trigger render={<button />}>Surface</ContextMenu.Trigger>
+        <ContextMenu.Portal>
+          <ContextMenu.Positioner>
+            <ContextMenu.Popup>
+              <ContextMenu.Item>Item</ContextMenu.Item>
+            </ContextMenu.Popup>
+          </ContextMenu.Positioner>
+        </ContextMenu.Portal>
+      </ContextMenu.Root>,
+    );
+
+    const surface = screen.getByRole('button', { name: 'Surface' });
+    await user.tab();
+    expect(surface).toHaveFocus();
+    fireEvent.contextMenu(surface, { clientX: 20, clientY: 20, button: 2 });
+    await waitFor(() => {
+      expect(screen.getByRole('menu')).toHaveFocus();
+    });
+
+    await user.tab({ shift: true });
+    await waitFor(() => {
+      expect(screen.queryByRole('menu')).toBe(null);
+    });
+    expect(surface).toHaveFocus();
+  });
+
   describe.skipIf(isJSDOM)('prop: collisionAvoidance', () => {
     const popupHeight = 100;
     const popupWidth = 150;
```

**File**: `packages/react/src/floating-ui-react/components/FloatingFocusManager.tsx` (modified, +6/-1)
```diff
@@ -766,7 +766,12 @@ export function FloatingFocusManager(props: FloatingFocusManagerProps): React.JS
         closeTypeRef.current = getEventType(details.nativeEvent, lastInteractionTypeRef.current);
       }
 
-      if (details.reason === REASONS.triggerHover && details.nativeEvent.type === 'mouseleave') {
+      // Focus guards transfer focus themselves; other close handlers may still need return focus.
+      if (
+        (details.reason === REASONS.focusOut &&
+          details.triggerElement?.hasAttribute(createAttribute('focus-guard'))) ||
+        (details.reason === REASONS.triggerHover && details.nativeEvent.type === 'mouseleave')
+      ) {
         preventReturnFocusRef.current = true;
       }
 
```

**File**: `packages/react/src/floating-ui-react/utils/tabbable.test.ts` (modified, +69/-1)
```diff
@@ -1,7 +1,7 @@
 import { afterEach, it, expect } from 'vitest';
 import { isJSDOM } from '#test-utils';
 import { visuallyHidden, visuallyHiddenInput } from '@base-ui/utils/visuallyHidden';
-import { isTabbable, tabbable } from './tabbable';
+import { getTabbableNearElement, isTabbable, tabbable } from './tabbable';
 
 afterEach(() => {
   document.body.innerHTML = '';
@@ -377,3 +377,71 @@ it('treats slotted elements inside inert shadow content as untabbable', () => {
 
   expect(tabbable(document.body)).not.toContain(button);
 });
+
+it.each(['shadow', 'slot'] as const)(
+  'finds adjacent controls around a non-tabbable anchor in a %s tree',
+  (type) => {
+    const before = document.createElement('button');
+    const after = document.createElement('button');
+    const host = document.createElement('div');
+    const shadowRoot = host.attachShadow({ mode: 'open' });
+    const anchor = document.createElement('button');
+    anchor.tabIndex = -1;
+    if (type === 'slot') {
+      shadowRoot.appendChild(document.createElement('slot'));
+      host.appendChild(anchor);
+    } else {
+      shadowRoot.appendChild(anchor);
+    }
+    document.body.append(before, host, after);
+
+    expect(getTabbableNearElement(anchor, -1)).toBe(before);
+    expect(getTabbableNearElement(anchor, 1)).toBe(after);
+    expect(tabbable(document.body)).toEqual([before, after]);
+    expect(anchor.tabIndex).toBe(-1);
+  },
+);
+
+it('finds adjacent controls around a disabled anchor', () => {
+  const before = document.createElement('button');
+  const anchor = document.createElement('button');
+  const after = document.createElement('button');
+  anchor.disabled = true;
+  document.body.append(before, anchor, after);
+
+  expect(getTabbableNearElement(anchor, -1)).toBe(before);
+  expect(getTabbableNearElement(anchor, 1)).toBe(after);
+});
+
+it('does not choose a destination when the anchor is absent from the composed tree', () => {
+  document.body.appendChild(document.createElement('button'));
+  const detachedAnchor = document.createElement('button');
+
+  expect(getTabbableNearElement(detachedAnchor, -1)).toBe(null);
+  expect(getTabbableNearElement(detachedAnchor, 1)).toBe(null);
+});
+
+it.each([
+  [false, 1],
+  [false, -1],
+  [true, 1],
+  [true, -1],
+] as const)(
+  'does not let a disabled radio anchor suppress its peer when checked=%s and direction=%s',
+  (checked, direction) => {
+    const anchor = document.createElement('input');
+    const peer = document.createElement('input');
+    const other = document.createElement('button');
+    anchor.type = 'radio';
+    peer.type = 'radio';
+    anchor.name = 'group';
+    peer.name = 'group';
+    anchor.disabled = true;
+    anchor.checked = checked;
+    document.body.append(...(direction === 1 ? [anchor, peer, other] : [other, peer, anchor]));
+
+    expect(tabbable(document.body)).toEqual(direction === 1 ? [peer, other] : [other, peer]);
+    expect(getTabbableNearElement(anchor, direction)).toBe(peer);
+    expect(getTabbableNearElement(anchor, direction === 1 ? -1 : 1)).toBe(other);
+  },
+);
```

**File**: `packages/react/src/floating-ui-react/utils/tabbable.ts` (modified, +20/-18)
```diff
@@ -223,34 +223,36 @@ export function getPreviousTabbable(referenceElement: Element | null): Focusable
   );
 }
 
-function getTabbableNearElement(referenceElement: Element | null, dir: 1 | -1) {
+export function getTabbableNearElement(
+  referenceElement: Element | null,
+  direction: 1 | -1,
+  exclude?: Element | null,
+): FocusableElement | null {
   if (!referenceElement) {
     return null;
   }
 
-  const list = tabbable(ownerDocument(referenceElement).body);
-  const elementCount = list.length;
-  if (elementCount === 0) {
-    return null;
-  }
-
+  // Keep the anchor's composed-tree position separate from the focusable radio candidates.
+  const list: FocusableElement[] = [];
+  appendCandidates(ownerDocument(referenceElement).body, list);
   const index = list.indexOf(referenceElement as FocusableElement);
   if (index === -1) {
     return null;
   }
 
-  const nextIndex = (index + dir + elementCount) % elementCount;
-  return list[nextIndex];
-}
-
-export function getTabbableAfterElement(referenceElement: Element | null): FocusableElement | null {
-  return getTabbableNearElement(referenceElement, 1);
-}
+  const candidates = list.filter(isFocusableElement);
+  for (let offset = 1; offset < list.length; offset += 1) {
+    const element = list[(index + direction * offset + list.length) % list.length];
+    if (
+      !contains(exclude, element) &&
+      isTabbable(element) &&
+      isTabbableRadio(element, candidates)
+    ) {
+      return element;
+    }
+  }
 
-export function getTabbableBeforeElement(
-  referenceElement: Element | null,
-): FocusableElement | null {
-  return getTabbableNearElement(referenceElement, -1);
+  return list[index];
 }
 
 export function isOutsideEvent(event: FocusEvent | React.FocusEvent, container?: Element) {
```

**File**: `packages/react/src/menu/popup/MenuPopup.tsx` (modified, +5/-0)
```diff
@@ -128,6 +128,11 @@ export const MenuPopup = React.forwardRef(function MenuPopup(
       returnFocus={finalFocus === undefined ? returnFocus : finalFocus}
       initialFocus={parent.type !== 'menu'}
       restoreFocus
+      getInsideElements={
+        parent.type === undefined
+          ? () => [store.context.beforeTriggerFocusGuardRef.current]
+          : undefined
+      }
       externalTree={parent.type !== 'menubar' ? floatingTreeRoot : undefined}
       previousFocusableElement={activeTriggerElement as HTMLElement | null}
       nextFocusableElement={
```

---

### Incident Patch 8: `1b07aae3` (2026-09-15)
**Commit Message**: [docs] Fix horizontal overflow in quick nav (#5723)

**File**: `docs/src/components/QuickNav/QuickNav.css` (modified, +1/-2)
```diff
@@ -114,9 +114,8 @@
   }
 
   .QuickNavLink {
-    display: flex;
+    display: inline-flex;
     padding: var(--quick-nav-item-padding-y) 0.5rem;
-    margin-inline: 0 -0.5rem;
     border-radius: var(--radius-6);
 
     &:focus-visible {
```

---

### Incident Patch 9: `327ebfc0` (2026-09-15)
**Commit Message**: [chore] Fix broken lockfile (#5724)

**File**: `pnpm-lock.yaml` (modified, +1/-1)
```diff
@@ -13454,7 +13454,7 @@ snapshots:
       picocolors: 1.1.1
       redent: 3.0.0
     optionalDependencies:
-      vitest: 4.1.11(@types/node@22.20.1)(@vitest/browser-playwright@4.1.11)(@vitest/coverage-istanbul@4.1.11)(@vitest/ui@4.1.11)(jsdom@27.4.0(supports-color@7.2.0))(vite@8.2.2(@types/node@22.20.1)(esbuild@0.28.2)(jiti@2.7.0)(terser@5.49.2)(tsx@4.23.12)(yaml@2.9.0))
+      vitest: 4.1.11(@types/node@22.20.1)(@vitest/browser-playwright@4.1.11)(@vitest/coverage-istanbul@4.1.11)(@vitest/ui@4.1.11)(jsdom@27.4.0(supports-color@7.2.0))(vite@8.2.2(@types/node@22.20.1)(esbuild@0.28.2)(jiti@2.7.0)(terser@5.51.2)(tsx@4.23.13)(yaml@2.9.0))
 
   '@testing-library/react@16.3.2(@testing-library/dom@10.4.1)(@types/react-dom@19.2.7(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)':
     dependencies:
```

---

### Incident Patch 10: `04dc5a14` (2026-09-15)
**Commit Message**: [otp field] Fix Safari IME composition over-filling slots (#5098)

**File**: `packages/react/src/otp-field/input/OTPFieldInput.android.test.tsx` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import { describe, expect, it, vi } from 'vitest';
+import * as React from 'react';
+import { act, fireEvent, screen } from '@mui/internal-test-utils';
+import { OTPField } from '@base-ui/react/otp-field';
+import { createRenderer } from '#test-utils';
+
+vi.mock('@base-ui/utils/platform', async () => {
+  const actual =
+    await vi.importActual<typeof import('@base-ui/utils/platform')>('@base-ui/utils/platform');
+
+  return {
+    ...actual,
+    platform: {
+      ...actual.platform,
+      os: { ...actual.platform.os, android: true },
+    },
+  };
+});
+
+describe('<OTPField.Input /> Android', () => {
+  const { render } = createRenderer();
+
+  it('commits each change during an IME composition', async () => {
+    const onValueChange = vi.fn();
+
+    await render(
+      <OTPField.Root length={3} validationType="alphanumeric" onValueChange={onValueChange}>
+        <OTPField.Input />
+        <OTPField.Input />
+        <OTPField.Input />
+      </OTPField.Root>,
+    );
+
+    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
+
+    await act(async () => {
+      inputs[0].focus();
+    });
+
+    fireEvent.compositionStart(inputs[0]);
+    fireEvent.change(inputs[0], { target: { value: 'a' } });
+
+    expect(onValueChange).toHaveBeenCalledTimes(1);
+    expect(onValueChange).toHaveBeenLastCalledWith('a', expect.anything());
+    expect(document.activeElement).toBe(inputs[1]);
+
+    fireEvent.compositionEnd(inputs[0]);
+
+    expect(onValueChange).toHaveBeenCalledTimes(1);
+    expect(inputs.map((input) => input.value)).toEqual(['a', '', '']);
+  });
+});
```

**File**: `packages/react/src/otp-field/input/OTPFieldInput.test.tsx` (modified, +124/-0)
```diff
@@ -7,6 +7,7 @@ import { OTPField } from '@base-ui/react/otp-field';
 import { Field } from '@base-ui/react/field';
 import { DirectionProvider } from '@base-ui/react/direction-provider';
 import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
+import { REASONS } from '../../internals/reasons';
 
 describe('<OTPField.Input />', () => {
   const { render } = createRenderer();
@@ -191,6 +192,129 @@ describe('<OTPField.Input />', () => {
     expect(firstInput.selectionEnd).toBe(1);
   });
 
+  it('commits an IME composition once on compositionend instead of per intermediate change', async () => {
+    const onValueChange = vi.fn();
+
+    await render(<OTPFieldTest validationType="alphanumeric" onValueChange={onValueChange} />);
+
+    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
+    const firstInput = inputs[0];
+
+    await act(async () => {
+      firstInput.focus();
+    });
+
+    fireEvent.compositionStart(firstInput);
+
+    // Safari can surface in-progress IME text through `change` as an accumulating string.
+    fireEvent.change(firstInput, { target: { value: 'd' } });
+    fireEvent.change(firstInput, { target: { value: 'dd' } });
+    fireEvent.change(firstInput, { target: { value: 'ddd' } });
+
+    // No value commits while the composition is active; the text is only buffered for display.
+    expect(onValueChange).not.toHaveBeenCalled();
+    expect(inputs.map((input) => input.value)).toEqual(['ddd', '', '', '', '', '']);
+
+    fireEvent.compositionEnd(firstInput, { target: { value: 'ddd' } });
+
+    // The final composed value commits once across three slots, not six.
+    expect(onValueChange).toHaveBeenCalledTimes(1);
+    expect(onValueChange).toHaveBeenLastCalledWith('ddd', expect.anything());
+    expect(inputs.map((input) => input.value)).toEqual(['d', 'd', 'd', '', '', '']);
+    expect(document.activeElement).toBe(inputs[3]);
+  });
+
+  it('reports characters rejected from a committed IME composition', async () => {
+    const onValueChange = vi.fn();
+    const onValueInvalid = vi.fn();
+
+    await render(<OTPFieldTest onValueChange={onValueChange} onValueInvalid={onValueInvalid} />);
+
+    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
+    const firstInput = inputs[0];
+
+    await act(async () => {
+      firstInput.focus();
+    });
+
+    fireEvent.compositionStart(firstInput);
+    fireEvent.change(firstInput, { target: { value: '1a' } });
+
+    expect(onValueInvalid).not.toHaveBeenCalled();
+
+    fireEvent.compositionEnd(firstInput, { target: { value: '1a' } });
+
+    expect(onValueInvalid).toHaveBeenCalledTimes(1);
+    expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
+    expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
+    expect(onValueChange).toHaveBeenCalledTimes(1);
+    expect(onValueChange).toHaveBeenLastCalledWith('1', expect.anything());
+    expect(inputs.map((input) => input.value)).toEqual(['1', '', '', '', '', '']);
+    expect(document.activeElement).toBe(inputs[1]);
+  });
+
+  it('ignores keyboard commands while a composition is buffered', async () => {
+    const onValueChange = vi.fn();
+
+    await render(
+      <OTPFieldTest
+        validationType="alphanumeric"
+        defaultValue="12"
+        onValueChange={onValueChange}
+      />,
+    );
+
+    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
+    const thirdInput = inputs[2];
+
+    await act(async () => {
+      thirdInput.focus();
+    });
+
+    fireEvent.compositionStart(thirdInput);
+    fireEvent.change(thirdInput, { target: { value: 'a' } });
+
+    // iOS Safari fires a real `Backspace` keydown while the IME is still composing.
+    fireEvent.keyDown(thirdInput, { key: 'Backspace' });
+
+    expect(onValueChange).not.toHaveBeenCalled();
+    expect(document.activeElement).toBe(thirdInput);
+    expect(inputs.map((input) => input.value)).toEqual(['1', '2', 'a', '', '', '']);
+
+    // The IME 
```

**File**: `packages/react/src/otp-field/input/OTPFieldInput.tsx` (modified, +75/-72)
```diff
@@ -2,6 +2,7 @@
 import * as React from 'react';
 import { SafeReact } from '@base-ui/utils/safeReact';
 import { warn } from '@base-ui/utils/warn';
+import { platform } from '@base-ui/utils/platform';
 import { stopEvent } from '../../floating-ui-react/utils';
 import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
 import type { BaseUIComponentProps } from '../../internals/types';
@@ -66,6 +67,12 @@ export const OTPFieldInput = React.forwardRef(function OTPFieldInput(
   const inputRef = React.useRef<HTMLInputElement | null>(null);
   const direction = useDirection();
 
+  // While an IME composition is active, Safari exposes the in-progress text through `onChange`
+  // as an accumulating string (`d`, then `dd`, then `ddd`). Committing those intermediate values
+  // would treat them as bulk input and fill too many slots, so the text is only buffered here
+  // and committed once on `compositionend`.
+  const [composingValue, setComposingValue] = React.useState<string | null>(null);
+
   const slotValue = value[index] ?? '';
   const inputState = getOTPFieldInputState(state, slotValue, index);
   const slotAriaLabel = externalAriaLabel;
@@ -88,9 +95,52 @@ export const OTPFieldInput = React.forwardRef(function OTPFieldInput(
     }, [index, slotAriaLabel]);
   }
 
+  function commitValue(
+    rawValue: string,
+    reason: typeof REASONS.inputChange | typeof REASONS.inputPaste,
+    event: React.SyntheticEvent<HTMLInputElement>,
+  ) {
+    const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
+      rawValue,
+      length,
+      validationType,
+      normalizeValue,
+    );
+
+    if (didRejectCharacters) {
+      reportValueInvalid(rawValue, createGenericEventDetails(reason, event.nativeEvent));
+    }
+
+    if (nextDigits === '') {
+      // Typed input edits the slot in place: clear it, or restore its character when every
+      // typed character was rejected. An empty or fully rejected paste changes nothing.
+      if (reason === REASONS.inputChange) {
+        if (rawValue === '') {
+          setValue(
+            removeOTPCharacter(value, index),
+            createChangeEventDetails(REASONS.inputClear, event.nativeEvent),
+          );
+        } else if (slotValue !== '') {
+          event.currentTarget.value = slotValue;
+          event.currentTarget.select();
+        }
+      }
+      return;
+    }
+
+    const committedValue = setValue(
+      replaceOTPValue(value, index, nextDigits, length, validationType, normalizeValue),
+      createChangeEventDetails(reason, event.nativeEvent),
+    );
+
+    if (committedValue != null) {
+      queueFocusInput(Math.min(index + nextDigits.length, length - 1), committedValue);
+    }
+  }
+
   const inputProps: React.ComponentProps<'input'> = {
     id: getInputId(index),
-    value: slotValue,
+    value: composingValue ?? slotValue,
     type: mask ? 'password' : 'text',
     inputMode,
     autoComplete: index === 0 ? autoComplete : 'off',
@@ -130,60 +180,40 @@ export const OTPFieldInput = React.forwardRef(function OTPFieldInput(
 
       handleInputBlur(event);
     },
-    onChange(event) {
-      if (event.defaultPrevented || disabled || readOnly) {
+    onCompositionStart() {
+      // Some Android keyboards report all text as always-composing, so Android keeps
+      // committing through `onChange`.
+      if (!platform.os.android) {
+        setComposingValue(slotValue);
+      }
+    },
+    onCompositionEnd(event) {
+      if (composingValue == null) {
         return;
       }
 
-      const rawValue = event.currentTarget.value;
-      const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
-        rawValue,
-        length,
-        validationType,
-        normalizeValue,
-      );
+      setComposingValue(null);
 
-      if (didRejectCharacters) {
-        reportValueInvalid(
-          rawValue,
-          createGenericEventDetails(REASONS.inputChange, event.nativeEvent),
-  
```

#### Recent Merged Pull Requests:
- **PR #5830** (2026-09-30): [docs] Use default cursor for slider demo label (@lyzno1)
- **PR #5824** (2026-09-30): [menu] Toggle submenus on repeated trigger activation (@jjenzz)
- **PR #5823** (2026-09-30): [code-infra] Bump pnpm to 12.6.0 and enable `autoDedupe` (@Janpot)
- **PR #5819** (2026-09-29): [select][menu][combobox] Improve mount performance of large lists (@atomiks)
- **PR #5816** (2026-09-29): [menu][select][combobox] Call onTyping(false) when closing without moving focus (@mdm317)
- **PR #5815** (2026-09-30): [combobox] Fix inline highlight reset on close (@atomiks)
- **PR #5813** (2026-09-28): [scroll-area] Remove presentational viewport role (@sarthakmalik0810)
- **PR #5804** (2026-09-25): [code-infra] Enforce top-level type-only imports (@brijeshb42)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
