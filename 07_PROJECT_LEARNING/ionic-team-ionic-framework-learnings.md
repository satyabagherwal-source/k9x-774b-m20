# Forensic Learning Record (Deep Inspection): ionic-team/ionic-framework

> **Canonical Artifact**: `07_PROJECT_LEARNING/ionic-team-ionic-framework-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ionic-team/ionic-framework](https://github.com/ionic-team/ionic-framework))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:07:34.205Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ionic-team/ionic-framework`
- **Description**: A powerful cross-platform UI toolkit for building native-quality iOS, Android, and Progressive Web Apps with HTML, CSS, and JavaScript.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 52686 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/.prettierrc.js`
```
module.exports = {
  ...require('@ionic/prettier-config'),
  overrides: [
    {
      files: ['**/*.scss'],
      options: {
        singleQuote: false,
      },
    },
  ],
};

```

### Core Architecture Module: `core/custom-rules/await-playwright-promise-assertion.js`
```
module.exports = {
  meta: {
    messages: {
      awaitPlaywrightPromiseAssertion: 'This Playwright assertion returns a Promise. Add an "await" to avoid creating a flaky test.',
    },
  },
  create(context) {
    return {
      ExpressionStatement(node) {
        const expression = node.expression;

        /**
         * The first expression of a properly awaited
         * Playwright assertion should be an AwaitExpression,
         * so if it goes directly to the CallExpression
         * then we potentially need to report this.
         */
        if (expression.type === 'CallExpression') {
          const { object, property } = expression.callee;

          /**
           * Check to see if the property name is
           * of a known Playwright async assertion.
           */
          if (
            property !== undefined &&
            property.type === 'Identifier' &&
            hasPlaywrightAsyncAssertion(property.name)
          ) {
            context.report({ node: node, messageId: 'awaitPlaywrightPromiseAssertion' });
          }
        }
      }
    }
  }
};

/**
 * Returns `true` if `property` is the name
 * of a known async Playwright assertion.
 */
const hasPlaywrightAsyncAssertion = (property) => {
  return ASYNC_PLAYWRIGHT_ASSERTS.includes(property);
}

// https://playwright.dev/docs/test-assertions
const ASYNC_PLAYWRIGHT_ASSERTS = [
  'toBeChecked',
  'toBeDisabled',
  'toBeEditable',
  'toBeEmpty',
  'toBeEnabled',
  'toBeFocused',
  'toBeHidden',
  'toBeVisible',
  'toContainText',
  'toHaveAttribute',
  'toHaveClass',
  'toHaveCount',
  'toHaveCSS',
  'toHaveId',
  'toHaveJSProperty',
  'toHaveScreenshot',
  'toHaveText',
  'toHaveValue',
  'toHaveValues',
  'toHaveTitle',
  'toHaveURL',
  'toBeOK',
  'click'
];

```

### Core Architecture Module: `core/custom-rules/index.js`
```
module.exports = {
  rules: {
    'no-component-on-ready-method': require('./no-component-on-ready-method.js'),
    'await-playwright-promise-assertion': require('./await-playwright-promise-assertion.js'),
    'no-playwright-to-match-snapshot-assertion': require('./no-playwright-to-match-snapshot-assertion.js')
  }
}

```

### Core Architecture Module: `core/custom-rules/no-component-on-ready-method.js`
```
module.exports = {
  meta: {
    messages: {
      noComponentOnReadyMethod: 'Using the componentOnReady method is not allowed. Use the componentOnReady helper utility in src/utils/helpers.ts instead.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        /**
         * We only want to exclude usages of componentOnReady().
         * Checking for the existence of the componentOnReady method
         * is a way of determining if we are in a lazy loaded build
         * or custom elements build, so we want to allow that.
         */
        const callee = node.callee;
        if (callee.type === 'MemberExpression' && callee.property.name === 'componentOnReady') {
          context.report({ node: node, messageId: 'noComponentOnReadyMethod' });
        }
      }
    }
  }
};

```

### Core Architecture Module: `core/custom-rules/no-playwright-to-match-snapshot-assertion.js`
```
module.exports = {
  meta: {
    messages: {
      noPlaywrightToMatchSnapshotAssertion: '"toHaveScreenshot" assertions should be used in favor of "toMatchSnapshot". "toHaveScreenshot" brings file size reductions and anti-flake behaviors such as disabling animations by default.',
    },
  },
  create(context) {
    return {
      ExpressionStatement(node) {
        if (node.expression.callee === undefined) {
          return;
        }

        const { property } = node.expression.callee;

        /**
         * Check to see if toMatchSnapshot is being used
         */
        if (
          property !== undefined &&
          property.type === 'Identifier' &&
          property.name === 'toMatchSnapshot'
        ) {
          context.report({ node: node, messageId: 'noPlaywrightToMatchSnapshotAssertion' });
        }
      }
    }
  }
};

```

### Core Architecture Module: `core/eslint.config.js`
```
const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

/*
  The shared @ionic/eslint-config and the local custom-rules plugin are still
  authored in eslintrc format, so the previous config is bridged through
  FlatCompat. Configs without their own files scope are limited to TS files to
  match the previous `eslint src` behavior and keep the parser off plain JS
  files like this config.
*/
module.exports = [
  {
    ignores: [
      'dist/**',
      'src/components.d.ts',
      '**/test/**/*.spec.ts',
      '**/test/**/*.spec.tsx',
      '**/test/**/e2e.ts',
    ],
  },
  ...compat
    .config({
      env: {
        browser: true,
        es2021: true,
        node: true,
      },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        '@ionic/eslint-config/recommended',
        'prettier',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      plugins: ['@typescript-eslint', 'custom-rules'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { varsIgnorePattern: '^(h|Fragment)$' }],
        'no-useless-catch': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-case-declarations': 'off',
        '@typescript-eslint/strict-boolean-expressions': [
          'error',
          { allowNullableBoolean: true, allowNullableString: true, allowAny: true },
        ],
        '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
        'custom-rules/no-component-on-ready-method': 'error',
      },
      overrides: [
        {
          files: ['*.e2e.ts'],
          rules: {
            'custom-rules/await-playwright-promise-assertion': 'error',
            'custom-rules/no-playwright-to-match-snapshot-assertion': 'error',
          },
        },
      ],
    })
    .map((config) => (config.files ? config : { ...config, files: ['**/*.ts', '**/*.tsx'] })),
];

```

### Core Architecture Module: `core/playwright.config.ts`
```
import type { PlaywrightTestConfig, PlaywrightTestOptions, PlaywrightWorkerOptions, Project } from '@playwright/test';
import { devices, expect } from '@playwright/test';

import { matchers } from './src/utils/test/playwright';

expect.extend(matchers);

const projects: Project<PlaywrightTestOptions, PlaywrightWorkerOptions>[] = [
  {
    /**
     * This is really just desktop Firefox
     * but with a mobile viewport.
     */
    name: 'Mobile Firefox',
    use: {
      browserName: 'firefox',
      /**
       * This is the Pixel 5 configuration.
       * We can't use devices['Pixel 5']
       * because the "isMobile" option is
       * not supported on Firefox.
       */
      viewport: {
        width: 393,
        height: 727
      },
    },
  },
  {
    name: 'Mobile Chrome',
    use: {
      browserName: 'chromium',
      ...devices['Pixel 5']
    }
  },
  {
    name: 'Mobile Safari',
    use: {
      browserName: 'webkit',
      ...devices['iPhone 12']
    }
  }
];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testMatch: '*.e2e.ts',
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
    toHaveScreenshot: {
      threshold: 0.1
    }
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  maxFailures: 0,
  /* Test retries help catch flaky tests on CI */
  retries: process.env.CI ? 2 : 0,
  reportSlowTests: null,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['github']
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /**
     * All failed tests should create
     * a trace file for easier debugging.
     *
     * See https://playwright.dev/docs/trace-viewer
     */
    trace: 'retain-on-failure',
    baseURL: 'http://localhost:3333',
  },

  /* Configure projects for major browsers */
  projects,
  webServer: {
    command: 'serve -p 3333',
    port: 3333,
    reuseExistingServer: !process.env.CI
  }
};

export default config;

```

### Core Architecture Module: `core/scripts/clean.js`
```
const fs = require('fs-extra');
const path = require('path');


const cleanDirs = [
  'dist',
  'css'
];

cleanDirs.forEach(dir => {
  const cleanDir = path.join(__dirname, '../', dir);
  fs.removeSync(cleanDir);
});

```

### Core Architecture Module: `core/scripts/custom-elements/custom-elements.d.ts`
```
export * from './index';
export * from '../dist/types/interface';

```

### Core Architecture Module: `core/scripts/docker.mjs`
```
import chalk from 'chalk';
import { execa } from 'execa';
import * as fs from 'fs';
import { resolve } from 'path';

const removeNewline = (string) => {
  return string.replace(/(\r\n|\n|\r)/gm, "");
}

const readConfigFile = (file) => {
  if (fs.existsSync(file)) {
    return fs.readFileSync(file, { encoding: 'utf-8' });
  }

  return '';
}

// These files are optional, so we don't want to error if they don't exist
const display = removeNewline(readConfigFile('docker-display.txt'));
const displayVolume = removeNewline(readConfigFile('docker-display-volume.txt'));

// Using --mount requires an absolute path which is what this gives us.
const pwd = resolve('./');

/**
 * -it will let the user gracefully kill the process using Ctrl+C (or equivalent)
 * -e DISPLAY and -v handle configuration for headed mode
 * --ipc=host is recommended when using Chromium to avoid out of memory crashes: https://playwright.dev/docs/ci#docker
 * --init is recommended to avoid zombie processes: https://playwright.dev/docs/ci#docker
 * --mount allow us to mount the local Ionic project inside of the Docker container so devs do not need to re-build the project in Docker.
 */
const extraArgs = process.argv.slice(2);
const args = ['run', '--rm', '--init', '-e', `DISPLAY=${display}`, ...(displayVolume ? ['-v', displayVolume] : []), '--ipc=host', `--mount=type=bind,source=${pwd},target=/ionic`, 'ionic-playwright', 'npm', 'run', 'test.e2e', '--', ...extraArgs];

// Set the CI env variable so Playwright uses the CI config
if (process.env.CI) {
  args.splice(1, 0, '-e', 'CI=true');
/**
 * Otherwise, we should let the session be interactive locally. This will
 * not work on CI which is why we do not apply it there.
 */
} else {
  args.splice(1, 0, '-it');
}

/**
 * While these config files are optional to run the tests, they are required to run
 * the tests in headed mode. Add a warning if dev tries to run headed tests without
 * the correct config files.
 */
const requestHeaded = process.argv.find(arg => arg.includes('headed'));
const hasHeadedConfigFiles = display && displayVolume;
if (requestHeaded && !hasHeadedConfigFiles) {
  console.warn(chalk.yellow.bold('\n⚠️ You are running tests in headed mode, but one or more of your headed config files was not found.\nPlease ensure that both docker-display.txt and docker-display-volume.txt have been created in the correct location.\n'));
}

const res = await execa('docker', args, { stdio: 'inherit' });

// If underlying scripts failed this whole process should fail too
process.exit(res.exitCode);

```

### Core Architecture Module: `core/scripts/treeshaking.js`
```
const path = require('path');
const { rollup } = require('rollup');
const virtual = require('@rollup/plugin-virtual');
const fs = require('fs');

async function main() {
  const input = process.argv[2] || getMainEntry();
	const result = await check(input);
	const relative = path.relative(process.cwd(), input);

	if (result.shaken) {
		console.error(`Success! ${relative} is fully tree-shakeable`);
	} else {
		error(`Failed to tree-shake ${relative}`);
	};
}

function error(msg) {
  console.error(msg);
  process.exit(1);
}

function getMainEntry() {
	if (!fs.existsSync('package.json')) {
		error(`Could not find package.json`);
	}

  const pkg = JSON.parse(fs.readFileSync('package.json'), 'utf-8');

  const unresolved = pkg.module || pkg.main || 'index';
  const resolved = resolve(unresolved);

  if (!resolved) {
    error(`Could not resolve entry point`);
  }

  return resolved;
}

function resolve(file) {
	if (isDirectory(file)) {
		return ifExists(`${file}/index.cjs.js`) || ifExists(`${file}/index.js`);
	}

	return ifExists(file) || ifExists(`${file}.cjs.js`) || ifExists(`${file}.js`);
}

function isDirectory(file) {
	try {
		const stats = fs.statSync(file);
		return stats.isDirectory();
	} catch (err) {
		return false;
	}
}

function ifExists(file) {
  return fs.existsSync(file) ? file : null;
}

async function check(input) {
  const resolved = path.resolve(input);

  const bundle = await rollup({
    input: '__agadoo__',
    plugins: [
      virtual({
        __agadoo__: `import ${JSON.stringify(resolved)}`,
        tslib: `
          const noop = () => {};
          export const __awaiter = noop;
          export const __extends = noop;
          export const __generator = noop;
          export const __spreadArrays = noop;
        `,
      }),
    ],
    onwarn: (warning, handle) => {
      if (warning.code !== 'EMPTY_BUNDLE') handle(warning);
    },
  });

  const o = await bundle.generate({
    format: 'es',
  });

  const output = o.output;
  console.log(output);
  return {
    shaken: output.length === 1 && output[0].code.trim() === '',
  };
}

main();

```

### Core Architecture Module: `core/scripts/update-readme.js`
```

// the unpkg link cannot use "latest" in the url
// so this script is to keep the link updated
// with the latest

const fs = require('fs');
const path = require('path');

const version = process.argv[2];

if (!version) {
  throw new Error('version arg missing');
}

const readmePath = path.join(__dirname, '..', 'README.md');
let readmeContent = fs.readFileSync(readmePath, 'utf-8');

// https://unpkg.com/@ionic/core@latest/dist/ionic.js

readmeContent = readmeContent.replace(
  /https\:\/\/unpkg.com\/@ionic\/core@(.+?)\//g,
  'https://unpkg.com/@ionic/core@' + version + '/'
);

fs.writeFileSync(readmePath, readmeContent);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #31523** (2026-10-02): **fix(modal): derive sheet dismissal from drag distance rather than viewport position**
  *Symptoms*: Issue number: resolves internal  ---------  <!-- Please do not submit updates to dependencies unless it fixes an issue. -->  <!-- Please try to limit your pull request to one type (bugfix, feature, etc). Submit multiple pull requests if needed. -->  ## What is the current behavior? <!-- Please describe the current behavior that you are modifying. -->  ## What is the new behavior? <!-- Please describe the behavior or changes that are being added by this PR. -->  - - -  ## Does this introduce a breaking change?  - [ ] Yes - [ ] No  <!--   If this introduces a breaking change:   1. Describe the impact and migration path for existing applications below.   2. Update the BREAKING.md file with the breaking change.   3. Add "BREAKING CHANGE: [...]" to the commit description when merging. See https://github.com/ionic-team/ionic-framework/blob/main/docs/CONTRIBUTING.md#footer for more information. -->   ## Other information  <!-- Any other information that is important to this PR such as screenshots of how the component looks before and after the change. --> 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #MbZBdRMX9lvXusJYKa3oEChTpPORV91PS7XyHXCAAZI=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJpb25pYy1mcmFtZXdvcmsiLCJwcm9qZWN0SWQiOiJwcmpfSmY2RmRla2Z1SWtHWXk1U3pZR1JBQjRYSjR3UyIsInYwIjpmYWxzZSwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImlvbmljLWZyYW1ld29yay1naXQtcm91LTEzMDUxLWZpeC1tb2RhbC1zaGVldC1zY3JvbGwtaW9uaWMxLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2lvbmljL2lvbmljLWZyYW1ld29yay9DcnhoRkw5cVFKTm85QVhlQm54RzhXYkRydk10IiwicHJldmlld1VybCI6ImlvbmljLWZyYW1ld29yay1naXQtcm91LTEzMDUxLWZpeC1tb2RhbC1zaGVldC1zY3JvbGwtaW9uaWMxLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWlvbmljLXRlYW0mcmVwbz1pb25pYy1mcmFtZXdvcmsmcHI9MzE1MjMifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :

- **Issue #31522** (2026-10-02): **chore(deps): update dependency @types/node to v24.19.1**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [@types/node](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node) ([source](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node)) | [`24.19.0` → `24.19.1`](https://renovatebot.com/diffs/npm/@types%2fnode/24.19.0/24.19.1) | ![age](https://developer.mend.io/api/mc/badges/age/npm/@types%2fnode/24.19.1?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@types%2fnode/24.19.0/24.19.1?slim=true) |  ---  ### Configuration  📅 **Schedule**: (UTC)  - Branch creation   - "every weekday before 11am" - Automerge   - At any time (no schedule defined)  🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.  ♻ **Rebasing**: Never, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/ionic-team/ionic-framework). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMjUuMSIsInVwZGF0ZWRJblZlciI6IjQ0LjEyNS4xIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #KN6JjONdw0merAoHJFr3nbYwNyRqbcANuzEIEiNiofY=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJpb25pYy1mcmFtZXdvcmsiLCJwcm9qZWN0SWQiOiJwcmpfSmY2RmRla2Z1SWtHWXk1U3pZR1JBQjRYSjR3UyIsInYwIjpmYWxzZSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2lvbmljL2lvbmljLWZyYW1ld29yay9IVUZFZlg2aEx3RHM4aTRwUlpNcDRSOEdQN0gzIiwicHJldmlld1VybCI6ImlvbmljLWZyYW1ld29yay1naXQtcmVub3ZhdGUtbm9kZS0yNHgtbG9ja2ZpbGUtaW9uaWMxLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiaW9uaWMtZnJhbWV3b3JrLWdpdC1yZW5vdmF0ZS1ub2RlLTI0eC1sb2NrZmlsZS1pb25pYzEudmVyY2VsLmFwcCJ9LCJyb290RGlyZWN0b3J5IjoiY29yZSJ9XSwicmVxdWVzdFJldmlld1VybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS92ZXJjZWwtYWdlbnQvcmVxdWVzdC1yZXZpZXc/b3duZXI9aW9uaWMtdGVhbSZyZXBvPWlvbmljLWZyYW1ld29yayZwcj0zMTUyMiJ9 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | U

- **Issue #31517** (2026-10-05): **fix(react): prevent error when an outlet unmounts before it's ready**
  *Symptoms*: Issue number: resolves #31513  ---------  ## What is the current behavior?  Currently, an `IonRouterOutlet` with `ionPage` that unmounts before its `componentOnReady` callback fires throws `Cannot read properties of null (reading 'classList')`, because React has already cleared the ref the callback reads in `OutletPageManager`.  ## What is the new behavior?  We now capture the outlet element when the callback is scheduled and skip the callback if the ref no longer points to it, so an unmounted outlet doesn't touch its classes or register with the parent stack.  ## Does this introduce a breaking change?  - [ ] Yes - [X] No  ## Other information  The new test page mounts an outlet and removes it in a layout effect, which reproduces the error on every tap on `main`.  ## Current dev build ``` 9.0.7-dev.11790871695.14a4111c ```
  **Post-Mortem & Fix Analysis**:
  > [vc]: #maFwr+LWQpO96NB9CGtcY2W2p5S8AFIbTPPNRsR8ffs=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJpb25pYy1mcmFtZXdvcmsiLCJwcm9qZWN0SWQiOiJwcmpfSmY2RmRla2Z1SWtHWXk1U3pZR1JBQjRYSjR3UyIsInYwIjpmYWxzZSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2lvbmljL2lvbmljLWZyYW1ld29yay9IaVJEUmt6N0VRekw3SkMzSFY5QlVLWkp4VjhSIiwicHJldmlld1VybCI6ImlvbmljLWZyYW1ld29yay1naXQtZml4LTMxNTEzLW91dGxldC11bm1vdW50LWJlZm8tMzViMTM0LWlvbmljMS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImlvbmljLWZyYW1ld29yay1naXQtZml4LTMxNTEzLW91dGxldC11bm1vdW50LWJlZm8tMzViMTM0LWlvbmljMS52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJjb3JlIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1pb25pYy10ZWFtJnJlcG89aW9uaWMtZnJhbWV3b3JrJnByPTMxNTE3In0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Projec

- **Issue #31516** (2026-10-01): **fix(css): stop emitting :host-context selectors in global stylesheets**
  *Symptoms*: Issue number: resolves #30024  ---------  ## What is the current behavior?  Currently, `float-elements.css` (and `ionic.bundle.css` / `utils.bundle.css`, which include it) contains `:host-context([dir=rtl]) .ion-float-*` selectors from the `rtl()` mixin. Lightning CSS, the default CSS minifier in Vite 8, warns about every one of them. They can never match anyway, because these stylesheets apply to the document, not a shadow root.  ## What is the new behavior?  The `rtl()` mixin now skips its `:host-context` rule when `$rtl-use-host-context` is false, and `float-elements.scss` sets it. The float utilities still flip in RTL through the existing `[dir=rtl]` and `:dir(rtl)` rules. Component styles are unchanged, since they still need `:host-context`. A new spec compiles every global stylesheet and asserts none of them contain `:host-context`.  ## Does this introduce a breaking change?  - [ ] Yes - [X] No  ## Other information  The only output change is 10 removed `:host-context` rules in `float-elements.css`, which also come out of the two bundles that include it.  ## Dev build ``` 9.0.7-dev.11790870774.174de601 ```
  **Post-Mortem & Fix Analysis**:
  > [vc]: #qKmHQ++E+5tHMBY2A9xcw+CnSoj5VeCTkoIhlnFA9Yw=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJpb25pYy1mcmFtZXdvcmsiLCJwcm9qZWN0SWQiOiJwcmpfSmY2RmRla2Z1SWtHWXk1U3pZR1JBQjRYSjR3UyIsInYwIjpmYWxzZSwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImlvbmljLWZyYW1ld29yay1naXQtZml4LWxpZ2h0bmluZy1jc3MtaW9uaWMxLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2lvbmljL2lvbmljLWZyYW1ld29yay84Y3pjQzJBQ0RpQjl2ZWczVnRxVXFLNVNjTkZFIiwicHJldmlld1VybCI6ImlvbmljLWZyYW1ld29yay1naXQtZml4LWxpZ2h0bmluZy1jc3MtaW9uaWMxLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWlvbmljLXRlYW0mcmVwbz1pb25pYy1mcmFtZXdvcmsmcHI9MzE1MTYifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a 

- **Issue #31513** (2026-10-05): **bug: React IonRouterOutlet throws when unmounted before initialization completes**
  *Symptoms*: ### Prerequisites  - [x] I have read the [Contributing Guidelines](https://github.com/ionic-team/ionic-framework/blob/main/docs/CONTRIBUTING.md#creating-an-issue). - [x] I agree to follow the [Code of Conduct](https://ionicframework.com/code-of-conduct). - [x] I have searched for [existing issues](https://github.com/ionic-team/ionic-framework/issues) that already report this problem, without success.  ### Ionic Framework Version  v9.x  ### Current Behavior  While optimizing page loading in my Ionic React app, I started seeing intermittent uncaught exceptions during registration and onboarding in Playwright.  Astra analysis:  Unmounting an `IonRouterOutlet` with `ionPage` before its deferred initialization callback runs causes an uncaught exception:  ```text TypeError: Cannot read properties of null (reading 'classList')     at http://localhost:5173/node_modules/.vite/deps/chunk-K6ONCLJS.js?v=7fa17f37:13510:19     at http://localhost:5173/node_modules/.vite/deps/chunk-ANOI66QA.js?v=7fa17f37:35:75 ```  The first frame is the `componentOnReady` callback in `OutletPageManager.componentDidMount()`.  The reproduction mounts the outlet, then removes it in the parent component's layout effect. This makes the problematic lifecycle ordering deterministic: the child's `componentDidMount` schedules initialization before the parent's layout effect removes it. No framework internals are mocked or patched, and no timers or network throttling are needed.  ### Expected Behavior  If the outlet
  **Post-Mortem & Fix Analysis**:
  > I don't have a proposed fix for this, but I got Astra to generate a patch that works for me locally; I pushed that to my own repo here: https://github.com/ptmkenny/ionic-framework/tree/outletPageManager. This is for reference only.

- **Issue #31512** (2026-10-01): **chore(deps): update dependency vitest to v5.0.3**
  *Symptoms*: This PR contains the following updates:  | Package | Change | [Age](https://docs.renovatebot.com/merge-confidence/) | [Confidence](https://docs.renovatebot.com/merge-confidence/) | |---|---|---|---| | [vitest](https://vitest.dev) ([source](https://redirect.github.com/vitest-dev/vitest/tree/HEAD/packages/vitest)) | [`5.0.2` → `5.0.3`](https://renovatebot.com/diffs/npm/vitest/5.0.2/5.0.3) | ![age](https://developer.mend.io/api/mc/badges/age/npm/vitest/5.0.3?slim=true) | ![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/vitest/5.0.2/5.0.3?slim=true) |  ---  ### Release Notes  <details> <summary>vitest-dev/vitest (vitest)</summary>  ### [`v5.0.3`](https://redirect.github.com/vitest-dev/vitest/releases/tag/v5.0.3)  [Compare Source](https://redirect.github.com/vitest-dev/vitest/compare/v5.0.2...v5.0.3)  #####    🐞 Bug Fixes  - Isolate `result.status` between `repeats` runs  -  by [@&#8203;hi-ogawa](https://redirect.github.com/hi-ogawa), **Hiroshi Ogawa** and **Codex (GPT-6)** in [#&#8203;11218](https://redirect.github.com/vitest-dev/vitest/issues/11218) [<samp>(5dbeb)</samp>](https://redirect.github.com/vitest-dev/vitest/commit/5dbebe9e3) - Don't print an interceptor warning in browser mode  -  by [@&#8203;sheremet-va](https://redirect.github.com/sheremet-va) in [#&#8203;11377](https://redirect.github.com/vitest-dev/vitest/issues/11377) [<samp>(15cc0)</samp>](https://redirect.github.com/vitest-dev/vitest/commit/15cc006aa) - Don't retry when `test.fails` expected
  **Post-Mortem & Fix Analysis**:
  > [vc]: #NnfL2AwRlHLSIlVYjUamZweF5lnHIH3BMiSmBGqzyso=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJpb25pYy1mcmFtZXdvcmsiLCJwcm9qZWN0SWQiOiJwcmpfSmY2RmRla2Z1SWtHWXk1U3pZR1JBQjRYSjR3UyIsInYwIjpmYWxzZSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2lvbmljL2lvbmljLWZyYW1ld29yay81VHMxNlB3bjRpWmhwemg0WTI4NWRNVHNmb1pNIiwicHJldmlld1VybCI6ImlvbmljLWZyYW1ld29yay1naXQtcmVub3ZhdGUtdml0ZXN0LW1vbm9yZXBvLWlvbmljMS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImlvbmljLWZyYW1ld29yay1naXQtcmVub3ZhdGUtdml0ZXN0LW1vbm9yZXBvLWlvbmljMS52ZXJjZWwuYXBwIn0sInJvb3REaXJlY3RvcnkiOiJjb3JlIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1pb25pYy10ZWFtJnJlcG89aW9uaWMtZnJhbWV3b3JrJnByPTMxNTEyIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updat

- **Issue #31511** (2026-10-01): **fix(vue-router): reset tab with memory history**
  *Symptoms*: Issue number: resolves #29785  ---------  ## What is the current behavior?  Currently, with `createMemoryHistory`, tapping the active tab from a child page leaves the child on screen. Memory history doesn't store a position in `history.state`, so the offset `resetTab()` computes is `NaN` and `router.go(NaN)` goes nowhere. On 9.x it also throws `Cannot read properties of undefined (reading '0')`.  ## What is the new behavior?  When there's no position to traverse, `resetTab()` now replaces the current entry with the tab's `href`, the same fallback it already uses after a deep load. It uses the tab's `href` rather than the first route recorded for the tab, because after a deep load onto a child that first route is the child itself. Web and hash history always have a numeric position, so they're unaffected.  ## Does this introduce a breaking change?  - [ ] Yes - [X] No  ## Other information  The new tests are in `memory.spec.ts`, since the Vue test app uses web history and can't reproduce this. They cover resetting from a child page, resetting after a deep load onto a child, and replacing the child entry rather than pushing over it.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #prTQIHyukNXA3LsMvIvg8TQh12T75VAZxGOEp6CTo40=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJpb25pYy1mcmFtZXdvcmsiLCJwcm9qZWN0SWQiOiJwcmpfSmY2RmRla2Z1SWtHWXk1U3pZR1JBQjRYSjR3UyIsInYwIjpmYWxzZSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2lvbmljL2lvbmljLWZyYW1ld29yay9HbVVFNVUxZTh4d2pKMkN3Njc2cEJERzNiNmRDIiwicHJldmlld1VybCI6ImlvbmljLWZyYW1ld29yay1naXQtZnctNzc1Ni1pb25pYzEudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJpb25pYy1mcmFtZXdvcmstZ2l0LWZ3LTc3NTYtaW9uaWMxLnZlcmNlbC5hcHAifSwicm9vdERpcmVjdG9yeSI6ImNvcmUifV0sInJlcXVlc3RSZXZpZXdVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vdmVyY2VsLWFnZW50L3JlcXVlc3QtcmV2aWV3P293bmVyPWlvbmljLXRlYW0mcmVwbz1pb25pYy1mcmFtZXdvcmsmcHI9MzE1MTEifQ== The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | |

- **Issue #31510** (2026-10-01): **fix(vue-router): render the redirect target when a guard redirects**
  *Symptoms*: Issue number: internal  ---------  ## What is the current behavior?  Currently, when a guard returns a location instead of `false` during a back navigation, the URL updates to the redirect target but Ionic renders a different page. A redirect doesn't fail, so the original navigation never reaches `afterEach` or `onError`. Its staged delta and params are never cleared and get applied to the redirect target instead.  ## What is the new behavior?  The ownership `beforeEach` now discards the state a navigation claimed when a guard redirects it. We match it through `redirectedFrom`, which vue-router points at the first location in the redirect chain. That covers leave guards, which run before our hook, and a guard redirect to the current page, which fails as a duplicate before reaching `beforeEach`.   ## Does this introduce a breaking change?  - [ ] Yes - [X] No  ## Other information  This was [raised while reviewing #31364](https://github.com/ionic-team/ionic-framework/pull/31364#discussion_r3808016936) and left out of scope there.
  **Post-Mortem & Fix Analysis**:
  > [vc]: #sb5cZ3j5w//S9PMplAKXH5DoptXYzsck1SymY1igjCM=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJpb25pYy1mcmFtZXdvcmsiLCJwcm9qZWN0SWQiOiJwcmpfSmY2RmRla2Z1SWtHWXk1U3pZR1JBQjRYSjR3UyIsInYwIjpmYWxzZSwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6ImlvbmljLWZyYW1ld29yay1naXQtZnctNzY5OS1pb25pYzEudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vaW9uaWMvaW9uaWMtZnJhbWV3b3JrL2I1eGFSVG05MUtGNnpEb1R0bU5DdlFTaXMxdmkiLCJwcmV2aWV3VXJsIjoiaW9uaWMtZnJhbWV3b3JrLWdpdC1mdy03Njk5LWlvbmljMS52ZXJjZWwuYXBwIiwibmV4dENvbW1pdFN0YXR1cyI6IkRFUExPWUVEIn1dLCJyZXF1ZXN0UmV2aWV3VXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL3ZlcmNlbC1hZ2VudC9yZXF1ZXN0LXJldmlldz9vd25lcj1pb25pYy10ZWFtJnJlcG89aW9uaWMtZnJhbWV3b3JrJnByPTMxNTEwIn0= The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/ion

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

### Incident Patch 1: `d5bab2e8` (2026-10-05)
**Commit Message**: fix(react): prevent error when an outlet unmounts before it's ready (#31517)

Issue number: resolves #31513

---------

## What is the current behavior?

Currently, an `IonRouterOutlet` with `ionPage` that unmounts before its
`componentOnReady` callback fires throws `Cannot read properties of null
(reading 'classList')`, because React has already cleared the ref the
callback reads in `OutletPageManager`.

## What is the new behavior?

We now capture the outlet element when the callback is scheduled and
skip the callback if the ref no longer points to it, so an unmounted
outlet doesn't touch its classes or register with the parent stack.

## Does this introduce a breaking change?

- [ ] Yes
- [X] No

## Other information

The new test page mounts an outlet and removes it in a layout effect,
which reproduces the error on every tap on `main`.

## Current dev build
```
9.0.7-dev.11790871695.14a4111c
```

**File**: `packages/react-router/test/base/src/App.tsx` (modified, +2/-0)
```diff
@@ -56,6 +56,7 @@ import {
 } from './pages/router-link-modifier-click/RouterLinkModifierClick';
 import { NavigateRootPageA, NavigateRootPageB, NavigateRootPageC } from './pages/navigate-root/NavigateRoot';
 import SuspenseOutlet from './pages/suspense-outlet/SuspenseOutlet';
+import OutletUnmountBeforeReady from './pages/outlet-unmount-before-ready/OutletUnmountBeforeReady';
 import { PropsUpdateDirect, PropsUpdateRoutesWrapper } from './pages/props-update/PropsUpdate';
 import DisabledButton from './pages/disabled-button/DisabledButton';
 import SplatSibling from './pages/splat-sibling/SplatSibling';
@@ -126,6 +127,7 @@ const App: React.FC = () => {
           <Route path="/navigate-root/page-b" element={<NavigateRootPageB />} />
           <Route path="/navigate-root/page-c" element={<NavigateRootPageC />} />
           <Route path="/suspense-outlet/*" element={<SuspenseOutlet />} />
+          <Route path="/outlet-unmount-before-ready" element={<OutletUnmountBeforeReady />} />
           <Route path="/props-update-routes/*" element={<PropsUpdateRoutesWrapper />} />
           <Route path="/props-update-direct/*" element={<PropsUpdateDirect />} />
           <Route path="/splat-sibling/*" element={<SplatSibling />} />
```

**File**: `packages/react-router/test/base/src/pages/Main.tsx` (modified, +3/-0)
```diff
@@ -58,6 +58,9 @@ const Main: React.FC = () => {
           <IonItem routerLink="/suspense-outlet/content" id="go-to-suspense-outlet">
             <IonLabel>Suspense Outlet</IonLabel>
           </IonItem>
+          <IonItem routerLink="/outlet-unmount-before-ready">
+            <IonLabel>Outlet Unmount Before Ready</IonLabel>
+          </IonItem>
         </IonList>
 
         <IonList>
```

**File**: `packages/react-router/test/base/src/pages/outlet-unmount-before-ready/OutletUnmountBeforeReady.tsx` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import { IonButton, IonContent, IonHeader, IonPage, IonRouterOutlet, IonTitle, IonToolbar } from '@ionic/react';
+import React, { useLayoutEffect, useState } from 'react';
+import { Route } from 'react-router-dom';
+
+import TestDescription from '../../components/TestDescription';
+
+/**
+ * Unmounting from a layout effect removes the outlet before it's ready.
+ */
+const TransientOutlet: React.FC<{ onMounted: () => void }> = ({ onMounted }) => {
+  useLayoutEffect(onMounted, [onMounted]);
+
+  return (
+    <IonRouterOutlet ionPage>
+      <Route path="*" element={<IonPage>Transient page</IonPage>} />
+    </IonRouterOutlet>
+  );
+};
+
+const OutletUnmountBeforeReady: React.FC = () => {
+  const [mounted, setMounted] = useState(false);
+  const [attempts, setAttempts] = useState(0);
+
+  return (
+    <IonPage data-pageid="outlet-unmount-before-ready">
+      <IonHeader>
+        <IonToolbar>
+          <IonTitle>Outlet Unmount Before Ready</IonTitle>
+        </IonToolbar>
+      </IonHeader>
+      <IonContent>
+        <TestDescription>
+          Tap the button a few times. Each tap mounts a nested outlet and removes it before it's ready, so the counter
+          should go up without any errors in the console.
+        </TestDescription>
+        <IonButton
+          id="mount-transient-outlet"
+          onClick={() => {
+            setAttempts((count) => count + 1);
+            setMounted(true);
+          }}
+        >
+          Mount and unmount outlet
+        </IonButton>
+        <p id="attempts">{attempts}</p>
+        {mounted && <TransientOutlet onMounted={() => setMounted(false)} />}
+      </IonContent>
+    </IonPage>
+  );
+};
+
+export default OutletUnmountBeforeReady;
```

**File**: `packages/react-router/test/base/tests/e2e/playwright/outlet-unmount-before-ready.spec.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { test, expect } from '@playwright/test';
+import { ionPageVisible, withTestingMode } from './utils/test-utils';
+
+test.describe('Outlet Unmount Before Ready', () => {
+  test('should not throw when an ionPage outlet unmounts before it is ready', async ({ page }, testInfo) => {
+    testInfo.annotations.push({
+      type: 'issue',
+      description: 'https://github.com/ionic-team/ionic-framework/issues/31513',
+    });
+
+    const errors: string[] = [];
+    page.on('pageerror', (error) => errors.push(error.message));
+
+    await page.goto(withTestingMode('/outlet-unmount-before-ready'));
+    await ionPageVisible(page, 'outlet-unmount-before-ready');
+
+    for (let attempt = 1; attempt <= 3; attempt++) {
+      await page.locator('#mount-transient-outlet').click();
+      await expect(page.locator('#attempts')).toHaveText(String(attempt));
+    }
+
+    // Give the async ready callback time to fire.
+    await page.waitForTimeout(500);
+
+    expect(errors).toEqual([]);
+    await ionPageVisible(page, 'outlet-unmount-before-ready');
+  });
+});
```

**File**: `packages/react/src/routing/OutletPageManager.tsx` (modified, +7/-2)
```diff
@@ -46,7 +46,13 @@ export class OutletPageManager extends React.Component<OutletPageManagerProps> {
        * when React unmounts + remounts components.
        */
       if (!this.outletIsReady) {
-        componentOnReady(this.ionRouterOutlet, () => {
+        const el = this.ionRouterOutlet;
+        componentOnReady(el, () => {
+          /**
+           * The outlet can unmount before this fires, which clears the ref.
+           */
+          if (this.ionRouterOutlet !== el) return;
+
           /**
            * Guard against duplicate callbacks from React strict mode double-mount.
            * Both componentDidMount calls pass the outer !outletIsReady check before
@@ -65,7 +71,6 @@ export class OutletPageManager extends React.Component<OutletPageManagerProps> {
            * outlet's forward animation removes ion-page-invisible, preventing
            * a flash where the outlet is briefly visible at full opacity.
            */
-          const el = this.ionRouterOutlet!;
           if (!el.classList.contains('ion-page-invisible') && !el.classList.contains('ion-page-hidden')) {
             el.classList.add('ion-page');
             el.classList.add('ion-page-invisible');
```

---

### Incident Patch 2: `e4258258` (2026-10-02)
**Commit Message**: fix(input-otp): sync value when length changes (#31485)

Issue number: resolves #31484

---------

## What is the current behavior?

Changing the length prop at runtime updates the rendered input boxes but
can leave the public value longer than the rendered inputs.

## What is the new behavior?

The component now reinitializes its values and tab indexes when length
changes, keeping the public value synchronized with the rendered inputs.

- Added a runtime length-change end-to-end regression test.
- ESLint passes for the changed files.
- Targeted Playwright execution is pending because the local browser
executable is unavailable.

## Does this introduce a breaking change?

- [ ] Yes
- [x] No

## Other information

Fixes #31484. No dependency updates or breaking API changes.

---------

Co-authored-by: ShaneK <[REDACTED_EMAIL]>

**File**: `core/src/components/input-otp/input-otp.tsx` (modified, +27/-1)
```diff
@@ -43,6 +43,12 @@ export class InputOTP implements ComponentInterface {
    */
   private isKeyboardNavigation = false;
 
+  /**
+   * The `length` watcher runs before new inputs render, so
+   * `componentDidRender` updates their tab indexes instead.
+   */
+  private updateTabIndexesAfterRender = false;
+
   @Element() el!: HTMLIonInputOtpElement;
 
   @State() private inputValues: string[] = [];
@@ -197,6 +203,12 @@ export class InputOTP implements ComponentInterface {
     this.updateTabIndexes();
   }
 
+  @Watch('length')
+  lengthChanged() {
+    this.initializeValues();
+    this.updateTabIndexesAfterRender = true;
+  }
+
   /**
    * Processes the separators prop into an array of numbers.
    *
@@ -272,6 +284,13 @@ export class InputOTP implements ComponentInterface {
     this.updateTabIndexes();
   }
 
+  componentDidRender() {
+    if (this.updateTabIndexesAfterRender) {
+      this.updateTabIndexesAfterRender = false;
+      this.updateTabIndexes();
+    }
+  }
+
   /**
    * Get the regex pattern for allowed characters.
    * If a pattern is provided, use it to create a regex pattern
@@ -851,7 +870,14 @@ export class InputOTP implements ComponentInterface {
                   tabIndex={index === tabbableIndex ? 0 : -1}
                   value={inputValues[index] || ''}
                   autocomplete="one-time-code"
-                  ref={(el) => (inputRefs[index] = el as HTMLInputElement)}
+                  ref={(el) => {
+                    if (el) {
+                      inputRefs[index] = el as HTMLInputElement;
+                    } else {
+                      // The input was removed, so drop its ref and any after it.
+                      inputRefs.splice(index);
+                    }
+                  }}
                   onInput={this.onInput(index)}
                   onBlur={this.onBlur}
                   onFocus={this.onFocus(index)}
```

**File**: `core/src/components/input-otp/test/a11y/input-otp.e2e.ts` (modified, +21/-0)
```diff
@@ -46,6 +46,27 @@ configs().forEach(({ title, config }) => {
       await expect(inputBoxes.nth(3)).toHaveAttribute('aria-hidden', 'true');
     });
 
+    test('should update aria-hidden when length increases', async ({ page }, testInfo) => {
+      testInfo.annotations.push({
+        type: 'issue',
+        description: 'https://github.com/ionic-team/ionic-framework/issues/31484',
+      });
+
+      await page.setContent(`<ion-input-otp length="2"></ion-input-otp>`, config);
+
+      const inputOtp = page.locator('ion-input-otp');
+      await inputOtp.evaluate((el: HTMLIonInputOtpElement) => {
+        el.length = 4;
+      });
+
+      const inputBoxes = page.locator('ion-input-otp input');
+
+      await expect(inputBoxes.nth(0)).toHaveAttribute('aria-hidden', 'false');
+      await expect(inputBoxes.nth(1)).toHaveAttribute('aria-hidden', 'true');
+      await expect(inputBoxes.nth(2)).toHaveAttribute('aria-hidden', 'true');
+      await expect(inputBoxes.nth(3)).toHaveAttribute('aria-hidden', 'true');
+    });
+
     test('should update aria-hidden when typing a value', async ({ page }) => {
       await page.setContent(`<ion-input-otp></ion-input-otp>`, config);
 
```

**File**: `core/src/components/input-otp/test/basic/input-otp.e2e.ts` (modified, +63/-0)
```diff
@@ -71,6 +71,39 @@ configs({ modes: ['ios'] }).forEach(({ title, config }) => {
       await verifyInputValues(inputOtp, ['1', '2', '3', '4', '5', '6', '7', '8']);
     });
 
+    test('should synchronize the value when length changes', async ({ page }, testInfo) => {
+      testInfo.annotations.push({
+        type: 'issue',
+        description: 'https://github.com/ionic-team/ionic-framework/issues/31484',
+      });
+
+      await page.setContent(`<ion-input-otp length="4" value="1234">Description</ion-input-otp>`, config);
+
+      const inputOtp = page.locator('ion-input-otp');
+      await inputOtp.evaluate((el) => el.setAttribute('length', '2'));
+
+      await verifyInputValues(inputOtp, ['1', '2']);
+    });
+
+    test('should add empty input boxes when length increases', async ({ page }, testInfo) => {
+      testInfo.annotations.push({
+        type: 'issue',
+        description: 'https://github.com/ionic-team/ionic-framework/issues/31484',
+      });
+
+      await page.setContent(`<ion-input-otp length="2" value="12">Description</ion-input-otp>`, config);
+
+      const inputOtp = page.locator('ion-input-otp');
+      await inputOtp.evaluate((el: HTMLIonInputOtpElement) => {
+        el.length = 4;
+      });
+
+      const inputBoxes = page.locator('ion-input-otp input');
+      await expect(inputBoxes).toHaveCount(4);
+
+      await verifyInputValues(inputOtp, ['1', '2', '', '']);
+    });
+
     test('should accept numbers only by default', async ({ page }) => {
       await page.setContent(`<ion-input-otp>Description</ion-input-otp>`, config);
 
@@ -1033,6 +1066,36 @@ configs({ modes: ['ios'], directions: ['ltr'] }).forEach(({ title, config }) =>
       await expect(ionChange).toHaveReceivedEventTimes(1);
     });
 
+    test('should emit ionChange event when blurring with a new value after length decreases', async ({
+      page,
+    }, testInfo) => {
+      testInfo.annotations.push({
+        type: 'issue',
+        description: 'https://github.com/ionic-team/ionic-framework/issues/31484',
+      });
+
+      await page.setContent(`<ion-input-otp length="4">Description</ion-input-otp>`, config);
+
+      const ionChange = await page.spyOnEvent('ionChange');
+
+      const inputOtp = page.locator('ion-input-otp');
+      await inputOtp.evaluate((el: HTMLIonInputOtpElement) => {
+        el.length = 2;
+      });
+      await page.waitForChanges();
+
+      const firstInput = page.locator('ion-input-otp input').first();
+      await firstInput.focus();
+
+      await page.keyboard.type('12');
+
+      // Click outside the input to trigger the blur event
+      await page.mouse.click(0, 0);
+
+      await ionChange.next();
+      await expect(ionChange).toHaveReceivedEventDetail({ value: '12', event: { isTrusted: true } });
+    });
+
     test('should not emit ionChange event when blurring with the same value', async ({ page }) => {
       await page.setContent(`<ion-input-otp value="12">Description</ion-input-otp>`, config);
 
```

---

### Incident Patch 3: `35bd2fa9` (2026-10-01)
**Commit Message**: fix(css): stop emitting :host-context selectors in global stylesheets (#31516)

Issue number: resolves #30024

---------

## What is the current behavior?

Currently, `float-elements.css` (and `ionic.bundle.css` /
`utils.bundle.css`, which include it) contains `:host-context([dir=rtl])
.ion-float-*` selectors from the `rtl()` mixin. Lightning CSS, the
default CSS minifier in Vite 8, warns about every one of them. They can
never match anyway, because these stylesheets apply to the document, not
a shadow root.

## What is the new behavior?

The `rtl()` mixin now skips its `:host-context` rule when
`$rtl-use-host-context` is false, and `float-elements.scss` sets it. The
float utilities still flip in RTL through the existing `[dir=rtl]` and
`:dir(rtl)` rules. Component styles are unchanged, since they still need
`:host-context`. A new spec compiles every global stylesheet and asserts
none of them contain `:host-context`.

## Does this introduce a breaking change?

- [ ] Yes
- [X] No

## Other information

The only output change is 10 removed `:host-context` rules in
`float-elements.css`, which also come out of the two bundles that
include it.

## Dev build
```
9.0.7-dev.11790870774.174

**File**: `core/src/css/float-elements.scss` (modified, +3/-0)
```diff
@@ -1,3 +1,6 @@
+// Global stylesheet: `:host-context()` never matches outside a shadow root
+$rtl-use-host-context: false;
+
 @import "../themes/ionic.globals";
 @import "../themes/ionic.mixins";
 
```

**File**: `core/src/css/test/global-stylesheets.spec.ts` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+import { execFileSync } from 'child_process';
+import { readdirSync } from 'fs';
+import { dirname, join } from 'path';
+
+const cssDir = join(__dirname, '..');
+const sassCli = join(dirname(require.resolve('sass')), 'sass.js');
+
+/**
+ * Compiles through the sass CLI, the same way `npm run css.sass` builds
+ * the published stylesheets. The sass JS API can't be imported here
+ * because it detects the spec window and never populates its exports.
+ */
+const compileStylesheet = (file: string) =>
+  execFileSync(process.execPath, [sassCli, '--style=compressed', '--no-source-map', join(cssDir, file)], {
+    encoding: 'utf8',
+  });
+
+const globalStylesheets = ['.', 'palettes'].flatMap((dir) =>
+  readdirSync(join(cssDir, dir))
+    .filter((file) => file.endsWith('.scss'))
+    .map((file) => join(dir, file))
+);
+
+describe('global stylesheets', () => {
+  // https://github.com/ionic-team/ionic-framework/issues/30024
+  it.each(globalStylesheets)('%s should not contain :host-context', (file) => {
+    expect(compileStylesheet(file)).not.toContain(':host-context');
+  });
+
+  it('float-elements.scss should flip start and end floats for an ancestor dir=rtl', () => {
+    const css = compileStylesheet('float-elements.scss');
+
+    expect(css).toContain('[dir=rtl] .ion-float-start{float:right !important}');
+    expect(css).toContain('[dir=rtl] .ion-float-end{float:left !important}');
+    expect(css).toContain('.ion-float-start:dir(rtl){float:right !important}');
+    expect(css).toContain('.ion-float-end:dir(rtl){float:left !important}');
+  });
+});
```

**File**: `core/src/themes/ionic.mixins.scss` (modified, +6/-1)
```diff
@@ -226,6 +226,11 @@
   // }
 }
 
+// Whether `rtl()` emits `:host-context()` selectors. Global stylesheets
+// set this to false: they apply to the document, where `:host-context()`
+// never matches, and Lightning CSS warns about every occurrence.
+$rtl-use-host-context: true !default;
+
 @mixin rtl() {
   $root: #{&};
 
@@ -254,7 +259,7 @@
   }
 
   // Supported by Chrome.
-  @if length($hostContextSelectors) > 0 {
+  @if $rtl-use-host-context and length($hostContextSelectors) > 0 {
     @at-root #{$hostContextSelectors} {
       @content;
     }
```

---

### Incident Patch 4: `edbc304f` (2026-10-01)
**Commit Message**: fix(vue-router): reset tab with memory history (#31511)

Issue number: resolves #29785

---------

## What is the current behavior?

Currently, with `createMemoryHistory`, tapping the active tab from a
child page leaves the child on screen. Memory history doesn't store a
position in `history.state`, so the offset `resetTab()` computes is
`NaN` and `router.go(NaN)` goes nowhere. On 9.x it also throws `Cannot
read properties of undefined (reading '0')`.

## What is the new behavior?

When there's no position to traverse, `resetTab()` now replaces the
current entry with the tab's `href`, the same fallback it already uses
after a deep load. It uses the tab's `href` rather than the first route
recorded for the tab, because after a deep load onto a child that first
route is the child itself. Web and hash history always have a numeric
position, so they're unaffected.

## Does this introduce a breaking change?

- [ ] Yes
- [X] No

## Other information

The new tests are in `memory.spec.ts`, since the Vue test app uses web
history and can't reproduce this. They cover resetting from a child
page, resetting after a deep load onto a child, and replacing the child
entry rather than pushing over

**File**: `packages/vue-router/src/router.ts` (modified, +10/-0)
```diff
@@ -827,6 +827,16 @@ export const createIonRouter = (
     const routeInfo = locationHistory.getFirstRouteInfoForTab(tab);
     if (routeInfo) {
       const delta = routeInfo.position! - currentHistoryPosition;
+      /**
+       * Memory history doesn't store a position in `history.state`, so
+       * `delta` is NaN and there's nothing to traverse. Replace instead.
+       */
+      if (Number.isNaN(delta)) {
+        if (originalHref) {
+          handleNavigate(originalHref, "pop", "back", undefined, tab);
+        }
+        return;
+      }
       if (delta !== 0) {
         router.go(delta);
         return;
```

**File**: `packages/vue/test/base/tests/unit/memory.spec.ts` (modified, +114/-0)
```diff
@@ -10,6 +10,9 @@ import {
   IonApp,
   IonRouterOutlet,
   IonPage,
+  IonTabs,
+  IonTabBar,
+  IonTabButton,
 } from '@ionic/vue';
 import { waitForRouter } from './utils';
 
@@ -112,4 +115,115 @@ describe('createMemoryHistory', () => {
     await waitForRouter();
     expect(router.currentRoute.value.path).toBe('/page3');
   });
+
+  // Verifies fix for https://github.com/ionic-team/ionic-framework/issues/29785
+  describe('tapping the active tab', () => {
+    const Tabs = {
+      components: { IonPage, IonTabs, IonTabBar, IonTabButton, IonRouterOutlet },
+      template: `
+        <ion-page>
+          <ion-tabs>
+            <ion-router-outlet></ion-router-outlet>
+            <ion-tab-bar slot="bottom">
+              <ion-tab-button tab="tab1" href="/tabs/tab1">Tab 1</ion-tab-button>
+              <ion-tab-button tab="tab2" href="/tabs/tab2">Tab 2</ion-tab-button>
+            </ion-tab-bar>
+          </ion-tabs>
+        </ion-page>
+      `,
+    };
+    const Tab1 = {
+      components: { IonPage },
+      template: '<ion-page>Tab 1</ion-page>',
+    };
+    const Tab1Child = {
+      components: { IonPage },
+      template: '<ion-page>Tab 1 Child</ion-page>',
+    };
+    const Tab2 = {
+      components: { IonPage },
+      template: '<ion-page>Tab 2</ion-page>',
+    };
+
+    const createTabsRouter = () =>
+      createRouter({
+        history: createMemoryHistory(process.env.BASE_URL),
+        routes: [
+          { path: '/', redirect: '/tabs/tab1' },
+          {
+            path: '/tabs/',
+            component: Tabs,
+            children: [
+              { path: 'tab1', component: Tab1 },
+              { path: 'tab1/child', component: Tab1Child },
+              { path: 'tab2', component: Tab2 },
+            ],
+          },
+        ],
+      });
+
+    const tapTab = async (wrapper: ReturnType<typeof mount>, tab: string) => {
+      const button = wrapper
+        .findAllComponents(IonTabButton)
+        .find((b) => b.props('tab') === tab)!;
+      await button.trigger('click');
+      await waitForRouter();
+    };
+
+    it('should return to the tab root from a child page', async () => {
+      const router = createTabsRouter();
+
+      router.push('/tabs/tab1');
+      await router.isReady();
+      const wrapper = mount(App, {
+        global: { plugins: [router, IonicVue] },
+      });
+      await waitForRouter();
+
+      router.push('/tabs/tab1/child');
+      await waitForRouter();
+      expect(router.currentRoute.value.path).toBe('/tabs/tab1/child');
+
+      await tapTab(wrapper, 'tab1');
+
+      expect(router.currentRoute.value.path).toBe('/tabs/tab1');
+    });
+
+    it('should return to the tab root when the app started on a child page', async () => {
+      const router = createTabsRouter();
+
+      router.push('/tabs/tab1/child');
+      await router.isReady();
+      const wrapper = mount(App, {
+        global: { plugins: [router, IonicVue] },
+      });
+      await waitForRouter();
+
+      await tapTab(wrapper, 'tab1');
+
+      expect(router.currentRoute.value.path).toBe('/tabs/tab1');
+    });
+
+    it('should replace the child page entry rather than push over it', async () => {
+      const router = createTabsRouter();
+
+      router.push('/tabs/tab1');
+      await router.isReady();
+      const wrapper = mount(App, {
+        global: { plugins: [router, IonicVue] },
+      });
+      await waitForRouter();
+
+      router.push('/tabs/tab1/child');
+      await waitForRouter();
+
+      await tapTab(wrapper, 'tab1');
+      expect(router.currentRoute.value.path).toBe('/tabs/tab1');
+
+      router.back();
+      await waitForRouter();
+
+      expect(router.currentRoute.value.path).toBe('/tabs/tab1');
+    });
+  });
 })
```

---

### Incident Patch 5: `643584b3` (2026-10-01)
**Commit Message**: fix(vue-router): render the redirect target when a guard redirects (#31510)

Issue number: internal

---------

## What is the current behavior?

Currently, when a guard returns a location instead of `false` during a
back navigation, the URL updates to the redirect target but Ionic
renders a different page. A redirect doesn't fail, so the original
navigation never reaches `afterEach` or `onError`. Its staged delta and
params are never cleared and get applied to the redirect target instead.

## What is the new behavior?

The ownership `beforeEach` now discards the state a navigation claimed
when a guard redirects it. We match it through `redirectedFrom`, which
vue-router points at the first location in the redirect chain. That
covers leave guards, which run before our hook, and a guard redirect to
the current page, which fails as a duplicate before reaching
`beforeEach`.

## Does this introduce a breaking change?

- [ ] Yes
- [X] No

## Other information

This was [raised while reviewing
#31364](https://github.com/ionic-team/ionic-framework/pull/31364#discussion_r3808016936)
and left out of scope there.

**File**: `packages/vue-router/src/router.ts` (modified, +62/-11)
```diff
@@ -117,10 +117,6 @@ export const createIonRouter = (
    * instead, so there is no failure to inspect there and the staged state
    * would survive. The error is re-thrown to the app the same way it was
    * before, so navigation outcomes are unchanged.
-   *
-   * A guard that returns a location is still not covered, because that
-   * redirects rather than fails and afterEach is never called for the original
-   * navigation.
    */
   addErrorHandler((error: unknown, to: RouteLocationNormalized) => {
     discardStagedStateFor(to);
@@ -183,20 +179,71 @@ export const createIonRouter = (
     incomingRouteParamsUnclaimed = false;
   };
 
+  /**
+   * Whether `to` is a guard redirect of the navigation that claimed `owner`.
+   * vue-router points `redirectedFrom` at the first location in a redirect
+   * chain, so an owner that a `redirect:` record led to is matched on its own
+   * `redirectedFrom`.
+   */
+  const isGuardRedirectOf = (
+    owner: RouteLocationNormalized | undefined,
+    to: RouteLocationNormalized
+  ) =>
+    owner !== undefined &&
+    to.redirectedFrom !== undefined &&
+    (owner.redirectedFrom ?? owner) === to.redirectedFrom;
+
+  /**
+   * Whether `to` was redirected by a guard rather than a `redirect:` record.
+   * This can't tell a record redirect apart from one a leave guard redirected
+   * again afterwards.
+   */
+  const isRedirectedByGuard = (to: RouteLocationNormalized) => {
+    const origin = to.redirectedFrom;
+
+    return (
+      origin !== undefined &&
+      origin.matched[origin.matched.length - 1]?.redirect === undefined
+    );
+  };
+
   /**
    * The navigation that starts first after params are staged is the one they
    * were staged for, so it takes ownership of them here. Registered before any
    * guard the app adds so that it still runs when one of those aborts.
+   *
+   * A guard that returns a location starts a new navigation and the original
+   * never reaches afterEach or onError, so we discard what it claimed here
+   * instead. Leave guards run before this hook, so a navigation they redirect
+   * hasn't claimed anything yet and its state is discarded unclaimed.
    */
   router.beforeEach((to: RouteLocationNormalized) => {
+    if (isGuardRedirectOf(currentNavigationInfoOwner, to)) {
+      clearNavigationInfo();
+    }
+
+    if (isGuardRedirectOf(incomingRouteParamsOwner, to)) {
+      clearStagedParams();
+    }
+
+    const redirectedByGuard = isRedirectedByGuard(to);
+
     if (incomingRouteParamsUnclaimed) {
-      incomingRouteParamsOwner = to;
-      incomingRouteParamsUnclaimed = false;
+      if (redirectedByGuard) {
+        clearStagedParams();
+      } else {
+        incomingRouteParamsOwner = to;
+        incomingRouteParamsUnclaimed = false;
+      }
     }
 
     if (currentNavigationInfoUnclaimed) {
-      currentNavigationInfoOwner = to;
-      currentNavigationInfoUnclaimed = false;
+      if (redirectedByGuard) {
+        clearNavigationInfo();
+      } else {
+        currentNavigationInfoOwner = to;
+        currentNavigationInfoUnclaimed = false;
+      }
     }
   });
 
@@ -219,18 +266,22 @@ export const createIonRouter = (
    * Both are matched on the navigation that owns them rather than on where it
    * was heading, because two navigations can head for the same path and a path
    * cannot tell them apart. State still unclaimed belongs to this navigation,
-   * since nothing has started since it was staged.
+   * since nothing has started since it was staged. A guard redirect that fails
+   * before reaching beforeEach, like one to the current page, is matched
+   * through the navigation it redirected.
    */
   const discardStagedStateFor = (to: RouteLocationNormalized) => {
     const deltaIsForThisNavigation =
       currentNavigationInfoOwner === undefined
         ? currentNavigationInfoUnclaimed
-        : currentNavigationInfoOwner === to;
+        : currentNavigationInfoOwner === to ||
+          isGuardRedirectOf(currentNavigationInfoOwner, to);
 
     const paramsAreForThisNavigation =
       incomingRouteParamsOwner === undefined
         ? incomingRouteParamsUnclaimed
-        : incomingRouteParamsOwner === to;
+        : incomingRouteParamsOwner === to ||
+          isGuardRedirectOf(incomingRouteParamsOwner, to);
 
     if (deltaIsForThisNavigation) {
       clearNavigationInfo();
```

**File**: `packages/vue/test/base/tests/unit/routing.spec.ts` (modified, +308/-0)
```diff
@@ -75,6 +75,16 @@ const waitUntil = async (predicate: () => boolean, label: string) => {
   throw new Error(`timed out waiting for ${label}`);
 };
 
+/*
+ * A redirect ends a navigation somewhere other than where it started, so wait
+ * for the path it should end on before letting the router settle.
+ */
+const navigateTo = async (router: any, path: string, navigate: () => void) => {
+  navigate();
+  await waitUntil(() => router.currentRoute.value.path === path, `the navigation to ${path}`);
+  await waitForRouter();
+};
+
 describe('Routing', () => {
   it('should pass no props', async () => {
     const Page1 = {
@@ -1609,6 +1619,304 @@ describe('Routing', () => {
     ]);
   });
 
+  const mountBackRedirect = async () => {
+    let navManager: any;
+
+    const Home = {
+      ...createPage('home'),
+      setup() {
+        navManager = inject('navManager');
+      }
+    };
+
+    const router = createRouter({
+      history: createWebHistory(process.env.BASE_URL),
+      routes: [
+        { path: '/', redirect: '/home' },
+        { path: '/home', component: Home },
+        { path: '/login', component: createPage('login') },
+        { path: '/profile', component: createPage('profile') }
+      ]
+    });
+
+    router.beforeEach((to, from) => {
+      if (from.path === '/profile' && to.path === '/home') {
+        return '/login';
+      }
+
+      return true;
+    });
+
+    router.push('/');
+    await router.isReady();
+    const wrapper = mount(IonRouterOutlet, {
+      global: {
+        plugins: [router, IonicVue]
+      }
+    });
+
+    router.push('/profile');
+    await waitForRouter();
+
+    return { router, navManager, wrapper };
+  };
+
+  it('should show the redirect target when a guard redirects a browser back', async () => {
+    const { router, navManager, wrapper } = await mountBackRedirect();
+
+    await navigateTo(router, '/login', () => router.back());
+
+    expect(currentRoute(navManager)).toEqual({
+      pathname: '/login',
+      routerAction: 'push',
+      routerDirection: 'forward'
+    });
+    expect(viewStack(wrapper)).toEqual([
+      { id: 'home', hidden: true },
+      { id: 'profile', hidden: true },
+      { id: 'login', hidden: false }
+    ]);
+  });
+
+  it('should show the redirect target when a guard redirects a back button navigation', async () => {
+    const { router, navManager, wrapper } = await mountBackRedirect();
+
+    /*
+     * The back button stages the Home route it expects to go back to, which
+     * Login would inherit if it were carried over.
+     */
+    await navigateTo(router, '/login', () => navManager.handleNavigateBack());
+
+    expect(currentRoute(navManager)).toEqual({
+      pathname: '/login',
+      routerAction: 'push',
+      routerDirection: 'forward'
+    });
+    expect(viewStack(wrapper)).toEqual([
+      { id: 'home', hidden: true },
+      { id: 'profile', hidden: true },
+      { id: 'login', hidden: false }
+    ]);
+  });
+
+  it('should go back normally after a guard redirects a browser back', async () => {
+    const { router, navManager, wrapper } = await mountBackRedirect();
+
+    await navigateTo(router, '/login', () => router.back());
+
+    // The redirect replaced Profile's history entry, so back lands on Home.
+    await navigateTo(router, '/home', () => router.back());
+
+    expect(currentRoute(navManager)).toEqual({
+      pathname: '/home',
+      routerAction: 'pop',
+      routerDirection: 'back'
+    });
+    expect(viewStack(wrapper)).toEqual([
+      { id: 'home', hidden: false },
+      { id: 'profile', hidden: true }
+    ]);
+  });
+
+  /*
+   * Leave guards run before any global guard, so Ionic never sees the
+   * navigation they redirect start.
+   */
+  const mountLeaveRedirect = async () => {
+    let navManager: any;
+
+    const Home = {
+      ...createPage('home'),
+      setup() {
+        navManager = inject('navManager');
+      }
+    };
+    const Profile = {
+      ...createPage('profile'),
+      setup() {
+        onBeforeRouteLeave((to) => (to.path === '/home' ? '/login' : true));
+      }
+    };
+
+    const router = createRouter({
+      history: createWebHistory(process.env.BASE_URL),
+      routes: [
+        { path: '/', redirect: '/home' },
+        { path: '/home', component: Home },
+        { path: '/login', component: createPage('login') },
+        { path: '/profile', component: Profile }
+      ]
+    });
+
+    router.push('/');
+    await router.isReady();
+    const wrapper = mount(IonRouterOutlet, {
+      global: {
+        plugins: [router, IonicVue]
+      }
+    });
+
+    router.push('/profile');
+    await waitForRouter();
+
+    return { router, navManager, wrapper };
+  };
+
+  it('should show the redirect target when a leave guard redirects a browser back', async () => {
+    const { router, navManager, wrapper } = await mountLeaveRedirect();
+
+    await navigateTo(router, '/login', () => router.back());
+
+    expect(currentRoute(navManager)).to
```

---

### Incident Patch 6: `f01e9a75` (2026-09-30)
**Commit Message**: fix(react-router): dispatch view lifecycle events on non-animated transitions (#31497)

Issue number: resolves #31479

---------

<!-- Please do not submit updates to dependencies unless it fixes an
issue. -->

<!-- Please try to limit your pull request to one type (bugfix, feature,
etc). Submit multiple pull requests if needed. -->

## What is the current behavior?

Currently, switching tabs or following a link with
`routerDirection="none"` fires none of the four view lifecycle events,
so a page that loads its data in `useIonViewWillEnter` renders empty.
The non-animated branch of `StackManager.transitionPage()` skips
`routerOutlet.commit()` and swaps the page classes itself to avoid
intermediate paints, and core dispatches all four events from inside
`commit()`, so they never fire. A capturing listener on the
`ion-router-outlet` gets nothing either, so it isn't a problem with the
hooks.

## What is the new behavior?

That branch now dispatches the four events itself, in the same order
core's `transition()` uses. The class swap moved to after all four, so
the leaving page is still on screen for its leave events and the
entering page is revealed only once they've fired. That's what

**File**: `packages/react-router/package-lock.json` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@
       "version": "9.0.5",
       "license": "MIT",
       "dependencies": {
+        "@ionic/core": "^9.0.5",
         "@ionic/react": "^9.0.5",
         "tslib": "*"
       },
```

**File**: `packages/react-router/package.json` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@
     "dist/"
   ],
   "dependencies": {
+    "@ionic/core": "^9.0.5",
     "@ionic/react": "^9.0.5",
     "tslib": "*"
   },
```

**File**: `packages/react-router/src/ReactRouter/StackManager.tsx` (modified, +51/-14)
```diff
@@ -4,6 +4,12 @@
  * particularly with animations and swipe gestures.
  */
 
+import {
+  LIFECYCLE_DID_ENTER,
+  LIFECYCLE_DID_LEAVE,
+  LIFECYCLE_WILL_ENTER,
+  LIFECYCLE_WILL_LEAVE,
+} from '@ionic/core/components';
 import type { RouteInfo, StackContextState, ViewItem } from '@ionic/react';
 import { IonRoute, RouteManagerContext, StackContext, createDebugLogger, generateId, getConfig } from '@ionic/react';
 import React from 'react';
@@ -89,6 +95,19 @@ const revealIonPageForSwipeBack = (element: HTMLElement | undefined): void => {
   }
 };
 
+type ViewLifecycleEvent =
+  | typeof LIFECYCLE_WILL_ENTER
+  | typeof LIFECYCLE_DID_ENTER
+  | typeof LIFECYCLE_WILL_LEAVE
+  | typeof LIFECYCLE_DID_LEAVE;
+
+/** Dispatches a view lifecycle event the way core's `lifecycle()` does. */
+const dispatchLifecycleEvent = (element: HTMLElement | undefined, eventName: ViewLifecycleEvent): void => {
+  if (element) {
+    element.dispatchEvent(new CustomEvent(eventName, { bubbles: false, cancelable: false }));
+  }
+};
+
 /**
  * A leaf view is "preservable" on browser-back (pop) when its React state
  * should survive a forward-pop round-trip. Non-parameterized leaf paths
@@ -367,12 +386,8 @@ export class StackManager extends React.PureComponent<StackManagerProps> {
     const allViewsInOutlet = this.context.getViewItemsForOutlet(this.id);
     allViewsInOutlet.forEach((viewItem) => {
       if (viewItem.ionPageElement && isViewVisible(viewItem.ionPageElement)) {
-        viewItem.ionPageElement.dispatchEvent(
-          new CustomEvent('ionViewWillLeave', { bubbles: false, cancelable: false })
-        );
-        viewItem.ionPageElement.dispatchEvent(
-          new CustomEvent('ionViewDidLeave', { bubbles: false, cancelable: false })
-        );
+        dispatchLifecycleEvent(viewItem.ionPageElement, LIFECYCLE_WILL_LEAVE);
+        dispatchLifecycleEvent(viewItem.ionPageElement, LIFECYCLE_DID_LEAVE);
       }
     });
 
@@ -409,12 +424,8 @@ export class StackManager extends React.PureComponent<StackManagerProps> {
         return;
       }
       if (viewItem.ionPageElement && isViewVisible(viewItem.ionPageElement)) {
-        viewItem.ionPageElement.dispatchEvent(
-          new CustomEvent('ionViewWillLeave', { bubbles: false, cancelable: false })
-        );
-        viewItem.ionPageElement.dispatchEvent(
-          new CustomEvent('ionViewDidLeave', { bubbles: false, cancelable: false })
-        );
+        dispatchLifecycleEvent(viewItem.ionPageElement, LIFECYCLE_WILL_LEAVE);
+        dispatchLifecycleEvent(viewItem.ionPageElement, LIFECYCLE_DID_LEAVE);
       }
       this.context.unMountViewItem(viewItem);
     });
@@ -1782,10 +1793,36 @@ export class StackManager extends React.PureComponent<StackManagerProps> {
           // Bail out if the component unmounted during waitForComponentsReady
           if (!this._isMounted) return;
 
+          const isCurrent = myGeneration === this.transitionGeneration;
+          // A page the newest transition is entering is not leaving after all.
+          const isLeaving = isCurrent || leavingEl !== this.transitionEnteringElement;
+          // Already hidden means the leave events have fired. This checks the class rather
+          // than `isViewVisible` because a nested outlet marks its leaving page
+          // `visibility: hidden` before we get here and still needs `ionViewDidLeave`.
+          const announceLeaving = isLeaving && !leavingEl.classList.contains('ion-page-hidden');
+
+          /**
+           * Dispatch the lifecycle events, since we skipped `commit()`. Only the
+           * newest transition fires the entering events, and the class swap follows
+           * all four so the ordering matches core's `transition()`.
+           *
+           * These run after `waitForComponentsReady` because on a first mount the
+           * page has not attached its listeners yet.
+           */
+          if (announceLeaving) {
+            dispatchLifecycleEvent(leavingEl, LIFECYCLE_WILL_LEAVE);
+          }
+          if (isCurrent) {
+            dispatchLifecycleEvent(enteringEl, LIFECYCLE_WILL_ENTER);
+            dispatchLifecycleEvent(enteringEl, LIFECYCLE_DID_ENTER);
+          }
+          if (announceLeaving) {
+            dispatchLifecycleEvent(leavingEl, LIFECYCLE_DID_LEAVE);
+          }
+
           // Swap visibility synchronously - show entering, hide leaving
-          // Skip hiding if a newer transition already made leavingEl the entering view
           enteringEl.classList.remove('ion-page-invisible');
-          if (myGeneration === this.transitionGeneration || leavingEl !== this.transitionEnteringElement) {
+          if (isLeaving) {
             leavingEl.classList.add('ion-page-hidden');
             leavingEl.setAttribute('aria-hidden', 'true');
           }
```

**File**: `packages/react-router/test/base/src/pages/direction-none-back/DirectionNoneBack.tsx` (modified, +15/-0)
```diff
@@ -8,18 +8,28 @@ import {
   IonRouterOutlet,
   IonBackButton,
   IonButtons,
+  useIonViewDidEnter,
+  useIonViewDidLeave,
+  useIonViewWillEnter,
+  useIonViewWillLeave,
 } from '@ionic/react';
 import React from 'react';
 import { Route, Navigate } from 'react-router-dom';
 
 import TestDescription from '../../components/TestDescription';
+import { pushLifecycleEvent } from '../../utils';
 
 /**
  * Tests that IonBackButton works correctly after navigating with
  * routerDirection="none". The back button should use history to
  * determine the previous page, not fall back to defaultHref.
  */
 const PageA: React.FC = () => {
+  useIonViewWillEnter(() => pushLifecycleEvent('a:ionViewWillEnter'));
+  useIonViewDidEnter(() => pushLifecycleEvent('a:ionViewDidEnter'));
+  useIonViewWillLeave(() => pushLifecycleEvent('a:ionViewWillLeave'));
+  useIonViewDidLeave(() => pushLifecycleEvent('a:ionViewDidLeave'));
+
   return (
     <IonPage data-pageid="direction-none-page-a">
       <IonHeader>
@@ -41,6 +51,11 @@ const PageA: React.FC = () => {
 };
 
 const PageB: React.FC = () => {
+  useIonViewWillEnter(() => pushLifecycleEvent('b:ionViewWillEnter'));
+  useIonViewDidEnter(() => pushLifecycleEvent('b:ionViewDidEnter'));
+  useIonViewWillLeave(() => pushLifecycleEvent('b:ionViewWillLeave'));
+  useIonViewDidLeave(() => pushLifecycleEvent('b:ionViewDidLeave'));
+
   return (
     <IonPage data-pageid="direction-none-page-b">
       <IonHeader>
```

**File**: `packages/react-router/test/base/src/pages/tab-lifecycle/TabLifecycle.tsx` (modified, +9/-13)
```diff
@@ -21,11 +21,7 @@ import React from 'react';
 import { Route, Navigate } from 'react-router';
 
 import TestDescription from '../../components/TestDescription';
-
-const pushEvent = (event: string) => {
-  (window as any).lifecycleEvents = (window as any).lifecycleEvents || [];
-  (window as any).lifecycleEvents.push(event);
-};
+import { pushLifecycleEvent } from '../../utils';
 
 const TabLifecycle: React.FC = () => {
   return (
@@ -50,10 +46,10 @@ const TabLifecycle: React.FC = () => {
 };
 
 const HomeTab: React.FC = () => {
-  useIonViewWillEnter(() => pushEvent('home:ionViewWillEnter'));
-  useIonViewDidEnter(() => pushEvent('home:ionViewDidEnter'));
-  useIonViewWillLeave(() => pushEvent('home:ionViewWillLeave'));
-  useIonViewDidLeave(() => pushEvent('home:ionViewDidLeave'));
+  useIonViewWillEnter(() => pushLifecycleEvent('home:ionViewWillEnter'));
+  useIonViewDidEnter(() => pushLifecycleEvent('home:ionViewDidEnter'));
+  useIonViewWillLeave(() => pushLifecycleEvent('home:ionViewWillLeave'));
+  useIonViewDidLeave(() => pushLifecycleEvent('home:ionViewDidLeave'));
 
   return (
     <IonPage data-pageid="tab-lifecycle-home">
@@ -73,10 +69,10 @@ const HomeTab: React.FC = () => {
 };
 
 const SettingsTab: React.FC = () => {
-  useIonViewWillEnter(() => pushEvent('settings:ionViewWillEnter'));
-  useIonViewDidEnter(() => pushEvent('settings:ionViewDidEnter'));
-  useIonViewWillLeave(() => pushEvent('settings:ionViewWillLeave'));
-  useIonViewDidLeave(() => pushEvent('settings:ionViewDidLeave'));
+  useIonViewWillEnter(() => pushLifecycleEvent('settings:ionViewWillEnter'));
+  useIonViewDidEnter(() => pushLifecycleEvent('settings:ionViewDidEnter'));
+  useIonViewWillLeave(() => pushLifecycleEvent('settings:ionViewWillLeave'));
+  useIonViewDidLeave(() => pushLifecycleEvent('settings:ionViewDidLeave'));
 
   return (
     <IonPage data-pageid="tab-lifecycle-settings">
```

**File**: `packages/react-router/test/base/src/utils/index.ts` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
 export * from './generateId';
+export * from './lifecycleEvents';
 export * from './dev';
```

**File**: `packages/react-router/test/base/src/utils/lifecycleEvents.ts` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+/** Records a view lifecycle event on `window.lifecycleEvents` for a spec to assert on. */
+export const pushLifecycleEvent = (event: string) => {
+  (window as any).lifecycleEvents = (window as any).lifecycleEvents || [];
+  (window as any).lifecycleEvents.push(event);
+};
```

**File**: `packages/react-router/test/base/tests/e2e/playwright/direction-none-lifecycle.spec.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { test, expect, type Page } from '@playwright/test';
+import { ionPageVisible, resetLifecycleEvents, settledLifecycleEvents, withTestingMode } from './utils/test-utils';
+
+/**
+ * A navigation with routerDirection="none" is not animated, but it must still
+ * fire the four view lifecycle events, in the same order an animated one does.
+ */
+test.describe('routerDirection="none" lifecycle events', () => {
+  const expectedEvents = ['a:ionViewWillLeave', 'b:ionViewWillEnter', 'b:ionViewDidEnter', 'a:ionViewDidLeave'];
+
+  const goToPageA = async (page: Page) => {
+    await page.goto(withTestingMode('/direction-none-back/a'));
+    await ionPageVisible(page, 'direction-none-page-a');
+    await resetLifecycleEvents(page);
+  };
+
+  test('should fire enter and leave events on a routerDirection="none" navigation', async ({ page }, testInfo) => {
+    testInfo.annotations.push({
+      type: 'issue',
+      description: 'https://github.com/ionic-team/ionic-framework/issues/31479',
+    });
+
+    await goToPageA(page);
+
+    await page.locator('#go-none').click();
+    await ionPageVisible(page, 'direction-none-page-b');
+
+    expect(await settledLifecycleEvents(page)).toEqual(expectedEvents);
+  });
+
+  /**
+   * The control. A forward navigation keeps its direction, so it takes the
+   * regular transition path, and its event order is the one the test above
+   * has to match.
+   */
+  test('should fire the same events for a forward navigation', async ({ page }) => {
+    await goToPageA(page);
+
+    await page.locator('#go-forward').click();
+    await ionPageVisible(page, 'direction-none-page-b');
+
+    expect(await settledLifecycleEvents(page)).toEqual(expectedEvents);
+  });
+});
```

---

### Incident Patch 7: `1130c2cc` (2026-09-28)
**Commit Message**: fix(react-router): keep splat route page mounted when a sibling route is pushed (#31481)

Issue number: resolves #31477

---------

## What is the current behavior?

Currently, an outlet holding a splat route alongside a more specific
sibling loses the splat's page when you push that sibling. A splat
matches every pathname, so `findViewItems` hands back its view item for
a pathname the sibling owns, and `handlePageTransition` then overwrites
that item's `reactElement`, which swaps the page and unmounts it.
Whatever was underneath, usually tabs or a nested outlet, is destroyed
along with its state and scroll position.

A root-level `/*` has two further problems. Going back blanks the whole
outlet, because `getParentPath` caches an inferred `outletMountPath` on
the root outlet, which scopes it to whatever route was active and makes
the next pathname look out of scope, so `handleOutOfScopeOutlet` aborts
the transition and tears the outlet down. Swipe-to-go-back does nothing,
because the deactivation scan in `renderViewItem` re-applies
`ion-page-hidden` on the next render and undoes
`revealIonPageForSwipeBack`, leaving the user dragging a page with
`display: none`.

## What is the new 

**File**: `packages/react-router/src/ReactRouter/ReactRouterViewStack.tsx` (modified, +16/-6)
```diff
@@ -15,7 +15,7 @@ import { analyzeRouteChildren, computeParentPath } from './utils/computeParentPa
 import { derivePathnameToMatch, matchPath } from './utils/pathMatching';
 import { normalizePathnameForComparison } from './utils/pathNormalization';
 import { extractRouteChildren, isNavigateElement } from './utils/routeElements';
-import { sortViewsBySpecificity } from './utils/viewItemUtils';
+import { isForwardPush, isSwipeRevealed, sortViewsBySpecificity } from './utils/viewItemUtils';
 
 /**
  * Delay in milliseconds before removing a Navigate view item after a redirect.
@@ -454,7 +454,7 @@ export class ReactRouterViewStack extends ViewStacks {
 
     // Deactivate wildcard (catch-all) and empty-path (default) routes when a more-specific route matches.
     // This prevents "Not found" or fallback pages from showing alongside valid routes.
-    if (routePath === '*' || routePath === '') {
+    if (routePath === '*' || routePath === '/*' || routePath === '') {
       // Check if any other view in this outlet has a match for the current route
       const outletViews = this.getViewItemsForOutlet(viewItem.outletId);
 
@@ -510,8 +510,15 @@ export class ReactRouterViewStack extends ViewStacks {
         }
       }
 
-      if (hasSpecificMatch) {
-        viewItem.mount = false;
+      if (hasSpecificMatch && !isSwipeRevealed(viewItem)) {
+        // A splat can be the outlet's container page rather than a "not found" fallback.
+        // Pushed over it is the page underneath, so unmounting it destroys its state and
+        // leaves nothing for back to reveal. Hiding it below covers that. A view with no
+        // ion-page was never a page in the stack and has nothing to hide, so it still
+        // unmounts.
+        if (!isForwardPush(routeInfo) || !viewItem.ionPageElement) {
+          viewItem.mount = false;
+        }
         if (viewItem.ionPageElement) {
           viewItem.ionPageElement.classList.add('ion-page-hidden');
           viewItem.ionPageElement.setAttribute('aria-hidden', 'true');
@@ -629,8 +636,11 @@ export class ReactRouterViewStack extends ViewStacks {
 
         // Persist the mount path for subsequent calls, mirroring StackManager.outletMountPath.
         // Unlike outletParentPaths (cleared when parentPath is undefined), the mount path is
-        // intentionally sticky — it anchors the outlet's scope and is only removed in clear().
-        if (result.outletMountPath && !this.outletMountPaths.has(outletId)) {
+        // intentionally sticky, it anchors the outlet's scope and is only removed in clear().
+        // A root outlet is skipped because it is mounted under nothing, so an inferred path
+        // would scope it to whatever route was active. parentPathnameBase is undefined
+        // exactly when the outlet has no parent matches.
+        if (parentPathnameBase && result.outletMountPath && !this.outletMountPaths.has(outletId)) {
           this.outletMountPaths.set(outletId, result.outletMountPath);
         }
       }
```

**File**: `packages/react-router/src/ReactRouter/StackManager.tsx` (modified, +64/-19)
```diff
@@ -20,6 +20,7 @@ import {
 import { derivePathnameToMatch, matchPath } from './utils/pathMatching';
 import { stripTrailingSlash } from './utils/pathNormalization';
 import { extractRouteChildren, getRoutesChildren, isNavigateElement } from './utils/routeElements';
+import { clearSwipeRevealed, isForwardPush, isOverMatchingRoute, markSwipeRevealed } from './utils/viewItemUtils';
 
 /**
  * Delay in milliseconds before unmounting a view after a transition completes.
@@ -118,6 +119,8 @@ export class StackManager extends React.PureComponent<StackManagerProps> {
   routerOutletElement: HTMLIonRouterOutletElement | undefined;
   prevProps?: StackManagerProps;
   skipTransition: boolean;
+  /** The view item the in-flight swipe gesture revealed, so the same one gets cleared. */
+  private swipeRevealedViewItem?: ViewItem;
 
   stackContextValue: StackContextState = {
     registerIonPage: this.registerIonPage.bind(this),
@@ -219,7 +222,9 @@ export class StackManager extends React.PureComponent<StackManagerProps> {
           hasWildcardRoute,
         });
 
-        if (result.outletMountPath && !this.outletMountPath) {
+        // A root outlet is mounted under nothing, so caching the inferred path would scope
+        // it to whatever route was active and make every other pathname look out of scope.
+        if (!this.isRootOutlet && result.outletMountPath && !this.outletMountPath) {
           this.outletMountPath = result.outletMountPath;
         }
 
@@ -297,14 +302,19 @@ export class StackManager extends React.PureComponent<StackManagerProps> {
     }
 
     // For non-replace actions, only unmount for back navigation
-    const isForwardPush = routeInfo.routeAction === 'push' && (routeInfo as any).routeDirection === 'forward';
-    if (!isForwardPush && routeInfo.routeDirection !== 'none' && enteringViewItem !== leavingViewItem) {
+    if (!isForwardPush(routeInfo) && routeInfo.routeDirection !== 'none' && enteringViewItem !== leavingViewItem) {
       return true;
     }
 
     return false;
   }
 
+  /** Clears the reveal flag from the view item the gesture marked. */
+  private clearSwipeRevealedView(): void {
+    clearSwipeRevealed(this.swipeRevealedViewItem);
+    this.swipeRevealedViewItem = undefined;
+  }
+
   /**
    * Handles out-of-scope outlet. Returns true if transition should be aborted.
    */
@@ -524,7 +534,9 @@ export class StackManager extends React.PureComponent<StackManagerProps> {
       const previousInContainer =
         routeInfo.lastPathname.startsWith(containerBase + '/') || routeInfo.lastPathname === containerBase;
 
-      if (currentInContainer && previousInContainer) {
+      // A root-level "/*" leaves an empty base, so both checks above are true for every
+      // pathname and the shortcut would otherwise skip every navigation in this outlet.
+      if (containerBase !== '' && currentInContainer && previousInContainer) {
         const updatedMatch = matchComponent(
           enteringViewItem.reactElement,
           routeInfo.pathname,
@@ -1085,6 +1097,7 @@ export class StackManager extends React.PureComponent<StackManagerProps> {
     }
     this.waitingForIonPage = false;
     this.preservedViewItems.clear();
+    this.clearSwipeRevealedView();
 
     // Hide all views in this outlet before clearing.
     // This is critical for nested outlets - when the parent component unmounts,
@@ -1120,15 +1133,41 @@ export class StackManager extends React.PureComponent<StackManagerProps> {
       return;
     }
 
+    // A completed swipe keeps its reveal flag past goBack() so the deactivation scan does
+    // not re-hide the page between the gesture ending and the URL settling. Clear it at
+    // the start of the transition for the new pathname.
+    this.clearSwipeRevealedView();
+
     // Find entering and leaving view items
     const viewItems = this.findViewItems(routeInfo);
     let enteringViewItem = viewItems.enteringViewItem;
     let leavingViewItem = viewItems.leavingViewItem;
-    let shouldUnmountLeavingViewItem = this.shouldUnmountLeavingView(routeInfo, enteringViewItem, leavingViewItem);
 
     // Get parent path for nested outlets
     const parentPath = this.getParentPath();
 
+    // Find the matching route element. This is React Router's own ranking of the outlet's
+    // routes, so it decides which route owns the pathname.
+    const enteringRoute = findRouteByRouteInfo(this.ionRouterOutlet?.props.children, routeInfo, parentPath) as
+      | React.ReactElement
+      | undefined;
+
+    // The lookup above only matches view items that already exist, so a sibling route with
+    // no view item yet never wins there and an over-matching route (splat, index, empty
+    // path) comes back for pathnames it does not own. Drop it rather than reusing it,
+    // because overwriting its reactElement below would swap its page for the winning
+    // route's and unmount it. This has to resolve before shouldUnmountLeavingView and
+    // handleRootNavigation, which
```

**File**: `packages/react-router/src/ReactRouter/utils/viewItemUtils.ts` (modified, +43/-1)
```diff
@@ -1,4 +1,4 @@
-import type { ViewItem } from '@ionic/react';
+import type { RouteInfo, ViewItem } from '@ionic/react';
 
 /**
  * Compares two routes by specificity for sorting (most specific first).
@@ -37,6 +37,48 @@ export const compareRouteSpecificity = (
   return 0;
 };
 
+/**
+ * True when a route matches more pathnames than its own path, so a splat, an index route,
+ * or a route with an empty or absent path. A lookup can return one of these for a pathname
+ * a more specific sibling owns, so callers must confirm ownership against React Router's
+ * ranking before reusing the view item.
+ *
+ * This is deliberately wider than the catch-all checks in ReactRouterViewStack, which each
+ * gate on a narrower shape for a different reason. Don't unify them with this helper.
+ */
+export const isOverMatchingRoute = (route: { path?: string; index?: boolean }): boolean => {
+  const { path, index } = route;
+  return !path || path.includes('*') || !!index;
+};
+
+/** True when the navigation pushed a new page forward on top of the current one. */
+export const isForwardPush = (routeInfo: Pick<RouteInfo, 'routeAction' | 'routeDirection'>): boolean =>
+  routeInfo.routeAction === 'push' && routeInfo.routeDirection === 'forward';
+
+const swipeRevealed = new WeakSet<ViewItem>();
+
+/**
+ * Marks the page a swipe-back gesture has revealed. For the length of the drag that page
+ * is on screen while a more specific sibling still matches the current pathname, and the
+ * deactivation scan in `renderViewItem` would otherwise re-hide it on the next render and
+ * leave the user dragging a blank page.
+ */
+export const markSwipeRevealed = (viewItem: ViewItem | undefined): void => {
+  if (viewItem) {
+    swipeRevealed.add(viewItem);
+  }
+};
+
+/** Drops the mark once the gesture ends, so the view is hidden normally again. */
+export const clearSwipeRevealed = (viewItem: ViewItem | undefined): void => {
+  if (viewItem) {
+    swipeRevealed.delete(viewItem);
+  }
+};
+
+/** True while a swipe-back gesture is showing this view. */
+export const isSwipeRevealed = (viewItem: ViewItem): boolean => swipeRevealed.has(viewItem);
+
 /**
  * Sorts view items by route specificity (most specific first).
  *
```

**File**: `packages/react-router/test/base/src/App.tsx` (modified, +12/-23)
```diff
@@ -1,25 +1,9 @@
-import { IonApp, setupIonicReact, LogLevel, IonRouterOutlet } from '@ionic/react';
+import { IonApp, IonRouterOutlet } from '@ionic/react';
 import React from 'react';
 import { Route, Navigate } from 'react-router-dom';
 
-/* Core CSS required for Ionic components to work properly */
-import '@ionic/react/css/core.css';
-
-/* Basic CSS for apps built with Ionic */
-import '@ionic/react/css/normalize.css';
-import '@ionic/react/css/structure.css';
-import '@ionic/react/css/typography.css';
-
-/* Optional CSS utils that can be commented out */
-import '@ionic/react/css/display.css';
-import '@ionic/react/css/flex-utils.css';
-import '@ionic/react/css/float-elements.css';
-import '@ionic/react/css/padding.css';
-import '@ionic/react/css/text-alignment.css';
-import '@ionic/react/css/text-transformation.css';
-
-/* Theme variables */
-import './theme/variables.css';
+/* Ionic CSS and setupIonicReact */
+import './ionic-setup';
 import Main from './pages/Main';
 
 import { IonReactRouter } from '@ionic/react-router';
@@ -66,14 +50,16 @@ import { Step1, Step2, Step3, Step4 } from './pages/replace-params/ReplaceParams
 import { ParamSwipeBack, ParamSwipeBackB } from './pages/param-swipe-back/ParamSwipeBack';
 import TabLifecycle from './pages/tab-lifecycle/TabLifecycle';
 import TabLifecycleOutside from './pages/tab-lifecycle/TabLifecycleOutside';
-import { RouterLinkModifierClick, RouterLinkModifierClickTarget } from './pages/router-link-modifier-click/RouterLinkModifierClick';
+import {
+  RouterLinkModifierClick,
+  RouterLinkModifierClickTarget,
+} from './pages/router-link-modifier-click/RouterLinkModifierClick';
 import { NavigateRootPageA, NavigateRootPageB, NavigateRootPageC } from './pages/navigate-root/NavigateRoot';
 import SuspenseOutlet from './pages/suspense-outlet/SuspenseOutlet';
 import { PropsUpdateDirect, PropsUpdateRoutesWrapper } from './pages/props-update/PropsUpdate';
 import DisabledButton from './pages/disabled-button/DisabledButton';
-
-// Debug logs on so failing specs include the navigation diagnostics.
-setupIonicReact({ logLevel: LogLevel.DEBUG });
+import SplatSibling from './pages/splat-sibling/SplatSibling';
+import { EmptyPathSibling, IndexSibling } from './pages/index-sibling/IndexSibling';
 
 const App: React.FC = () => {
   return (
@@ -142,6 +128,9 @@ const App: React.FC = () => {
           <Route path="/suspense-outlet/*" element={<SuspenseOutlet />} />
           <Route path="/props-update-routes/*" element={<PropsUpdateRoutesWrapper />} />
           <Route path="/props-update-direct/*" element={<PropsUpdateDirect />} />
+          <Route path="/splat-sibling/*" element={<SplatSibling />} />
+          <Route path="/index-sibling/*" element={<IndexSibling />} />
+          <Route path="/empty-path-sibling/*" element={<EmptyPathSibling />} />
         </IonRouterOutlet>
       </IonReactRouter>
     </IonApp>
```

**File**: `packages/react-router/test/base/src/index.tsx` (modified, +11/-5)
```diff
@@ -2,11 +2,17 @@ import React from 'react';
 import { createRoot } from 'react-dom/client';
 
 import App from './App';
+import RootSplatSiblingApp from './root-splat-sibling/RootSplatSiblingApp';
+import { ROOT_SPLAT_SIBLING_BASENAME } from './root-splat-sibling/basename';
+
+/**
+ * A root-level splat route swallows every pathname in its outlet, so it can't share App's
+ * route tree. It gets its own root, picked here by pathname before anything renders.
+ */
+const { pathname } = window.location;
+const isRootSplatSibling =
+  pathname === ROOT_SPLAT_SIBLING_BASENAME || pathname.startsWith(`${ROOT_SPLAT_SIBLING_BASENAME}/`);
 
 const container = document.getElementById('root');
 const root = createRoot(container!);
-root.render(
-  <React.StrictMode>
-    <App />
-  </React.StrictMode>
-);
+root.render(<React.StrictMode>{isRootSplatSibling ? <RootSplatSiblingApp /> : <App />}</React.StrictMode>);
```

**File**: `packages/react-router/test/base/src/ionic-setup.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+/**
+ * Ionic CSS and runtime config. Both App and RootSplatSiblingApp import this because
+ * App.test.tsx renders App with no index.tsx in the graph.
+ *
+ * Debug logging is on so a failing spec includes the navigation diagnostics.
+ */
+import { setupIonicReact, LogLevel } from '@ionic/react';
+
+/* Core CSS required for Ionic components to work properly */
+import '@ionic/react/css/core.css';
+
+/* Basic CSS for apps built with Ionic */
+import '@ionic/react/css/normalize.css';
+import '@ionic/react/css/structure.css';
+import '@ionic/react/css/typography.css';
+
+/* Optional CSS utils that can be commented out */
+import '@ionic/react/css/display.css';
+import '@ionic/react/css/flex-utils.css';
+import '@ionic/react/css/float-elements.css';
+import '@ionic/react/css/padding.css';
+import '@ionic/react/css/text-alignment.css';
+import '@ionic/react/css/text-transformation.css';
+
+/* Theme variables */
+import './theme/variables.css';
+
+setupIonicReact({ logLevel: LogLevel.DEBUG });
```

**File**: `packages/react-router/test/base/src/pages/Main.tsx` (modified, +14/-0)
```diff
@@ -10,6 +10,7 @@ import {
   IonLabel,
 } from '@ionic/react';
 import React from 'react';
+import { ROOT_SPLAT_SIBLING_BASENAME } from '../root-splat-sibling/basename';
 
 const Main: React.FC = () => {
   return (
@@ -153,6 +154,19 @@ const Main: React.FC = () => {
           <IonItem routerLink="/wildcard-no-heuristic">
             <IonLabel>Wildcard No Heuristic</IonLabel>
           </IonItem>
+          <IonItem routerLink="/splat-sibling">
+            <IonLabel>Splat Sibling</IonLabel>
+          </IonItem>
+          <IonItem routerLink="/index-sibling">
+            <IonLabel>Index Sibling</IonLabel>
+          </IonItem>
+          <IonItem routerLink="/empty-path-sibling">
+            <IonLabel>Empty Path Sibling</IonLabel>
+          </IonItem>
+          {/* A separate React root, so a plain href rather than a routerLink. */}
+          <IonItem href={`${ROOT_SPLAT_SIBLING_BASENAME}/feed`}>
+            <IonLabel>Root Splat Sibling</IonLabel>
+          </IonItem>
         </IonList>
 
         <IonList>
```

**File**: `packages/react-router/test/base/src/pages/index-sibling/IndexSibling.tsx` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+import {
+  IonBackButton,
+  IonButton,
+  IonButtons,
+  IonContent,
+  IonHeader,
+  IonItem,
+  IonLabel,
+  IonList,
+  IonPage,
+  IonRouterOutlet,
+  IonTitle,
+  IonToolbar,
+} from '@ionic/react';
+import React, { useState } from 'react';
+import { Route, useParams } from 'react-router-dom';
+
+import TestDescription from '../../components/TestDescription';
+
+/**
+ * Companion to SplatSibling for the pathless shapes. An index route and an
+ * empty-path route both carry no path of their own, so they can be handed a
+ * pathname that a more specific sibling owns, the same way a splat can.
+ */
+
+const Home: React.FC<{ pageId: string; detailHref: string }> = ({ pageId, detailHref }) => {
+  const [count, setCount] = useState(0);
+
+  return (
+    <IonPage data-pageid={pageId}>
+      <IonHeader>
+        <IonToolbar>
+          <IonTitle>Home</IonTitle>
+        </IonToolbar>
+      </IonHeader>
+      <IonContent>
+        <IonButton data-testid="increment" onClick={() => setCount((c) => c + 1)}>
+          Increment
+        </IonButton>
+        <div data-testid="count">{count}</div>
+        <IonList>
+          <IonItem detail routerLink={detailHref} data-testid="open-detail">
+            <IonLabel>Open item 12</IonLabel>
+          </IonItem>
+        </IonList>
+        <TestDescription>
+          Increment the counter, then open item 12. The detail page should push over this page, leaving it mounted
+          behind. Going back should reveal this same page with the counter unchanged.
+        </TestDescription>
+      </IonContent>
+    </IonPage>
+  );
+};
+
+const Detail: React.FC<{ pageId: string; backHref: string }> = ({ pageId, backHref }) => {
+  const { id } = useParams<{ id: string }>();
+
+  return (
+    <IonPage data-pageid={pageId}>
+      <IonHeader>
+        <IonToolbar>
+          <IonButtons slot="start">
+            <IonBackButton defaultHref={backHref} />
+          </IonButtons>
+          <IonTitle>Detail</IonTitle>
+        </IonToolbar>
+      </IonHeader>
+      <IonContent>
+        <div data-testid="detail-id">{id}</div>
+      </IonContent>
+    </IonPage>
+  );
+};
+
+/** Outlet whose home page is an index route. */
+export const IndexSibling: React.FC = () => {
+  return (
+    <IonRouterOutlet>
+      <Route index element={<Home pageId="index-sibling-home" detailHref="/index-sibling/detail/12" />} />
+      <Route path="detail/:id" element={<Detail pageId="index-sibling-detail" backHref="/index-sibling" />} />
+    </IonRouterOutlet>
+  );
+};
+
+/** Outlet whose home page is an empty-path route. */
+export const EmptyPathSibling: React.FC = () => {
+  return (
+    <IonRouterOutlet>
+      <Route path="" element={<Home pageId="empty-path-sibling-home" detailHref="/empty-path-sibling/detail/12" />} />
+      <Route path="detail/:id" element={<Detail pageId="empty-path-sibling-detail" backHref="/empty-path-sibling" />} />
+    </IonRouterOutlet>
+  );
+};
```

---

### Incident Patch 8: `879e91d5` (2026-09-25)
**Commit Message**: docs(vue): fix dead links in vue testing docs and README (#31482)

Issue number: N/A (docs-only link fix)

---------

## What is the current behavior?

Two links in the Vue contributor docs point at sections that don't
exist:

- `docs/vue/testing.md` step 1 links "Build" to `../README.md#building`.
`docs/README.md` has no Building section.
- `packages/vue/README.md` links "test-app directory" to
`test/README.md#syncing-local-changes`. `packages/vue/test/README.md` is
now a two-line pointer with no such section; the syncing steps live in
`docs/vue/testing.md`.

## What is the new behavior?

- "Build" points at the Building section of `packages/vue/README.md`,
which walks through building `core`, `packages/vue` and
`packages/vue-router`, the three projects step 1 names.
- The sync sentence links to `docs/vue/testing.md#syncing-local-changes`
with an absolute GitHub URL, following the Contributing Guide link in
the same README, so it also works on npmjs.com where this README is
published.

## Does this introduce a breaking change?

- [ ] Yes
- [x] No

## Other information

Docs only, no code changes. Found and prepared with AI assistance
(Claude Code); I checked both target headings e

**File**: `docs/vue/testing.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ Run `npm run typecheck` in `packages/vue` to check types. The rollup build only
 
 The Vue test app supports syncing your locally built changes for validation.
 
-1. [Build](../README.md#building) the `core`, `packages/vue`, and `packages/vue-router` projects using `npm run build`.
+1. [Build](../../packages/vue/README.md#building) the `core`, `packages/vue`, and `packages/vue-router` projects using `npm run build`.
 2. [Build the Vue test app](#test-app-build-structure).
 3. Navigate to the built test app directory (e.g. `packages/vue/test/build/vue3`).
 4. Install dependencies using `npm install`.
```

**File**: `packages/vue/README.md` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ npm run build
 
 * Run `npm run typecheck` to check types. Run it in `packages/vue-router` too when you change `@ionic/vue-router`. The rollup build only reports type errors as warnings, so a passing build does not mean the types are clean.
 * E2E Tests are found in the `packages/vue/test/base/tests` directory and use Cypress.
-* When making changes to `@ionic/vue` or `@ionic/vue-router` you can run `npm run sync` in the [test-app directory](test/README.md#syncing-local-changes) to ensure that the test application is using your built changes. Be sure to build in the `vue` and `vue-router` directories first.
+* When making changes to `@ionic/vue` or `@ionic/vue-router` you can run `npm run sync` in the test app directory (see [Syncing Local Changes](https://github.com/ionic-team/ionic-framework/blob/main/docs/vue/testing.md#syncing-local-changes)) to ensure that the test application is using your built changes. Be sure to build in the `vue` and `vue-router` directories first.
 * Tests can be run in headless mode by running `npm run cypress`.
 * If you want to open the Cypress test runner, you can run `node_modules/.bin/cypress open`.
 * Bug fix and feature PRs should have new tests verifying the PR functionality.
```

---

### Incident Patch 9: `193a30a2` (2026-09-24)
**Commit Message**: docs(angular): fix source paths in component guide (#31480)

Issue number: N/A (docs-only link fix)

---------

## What is the current behavior?

`docs/component-guide.md` links to Angular source files that no longer
exist, so every link in the "Angular value accessors" and "Interface
Exports" steps returns a 404 on GitHub:

-
`/packages/angular/src/directives/control-value-accessors/{text,numeric,boolean,select}-value-accessor.ts`
(5 links)
- `/packages/angular/src/index.ts`

`packages/angular/src/` now only contains `common/`, `lazy/` and
`standalone/`.

## What is the new behavior?

- The value accessor links point at
`packages/angular/src/lazy/directives/control-value-accessors/`, where
the four directives live (their selectors match the ones the guide
quotes).
- The Angular interface-export step points at
`packages/angular/src/lazy/index.ts` and
`packages/angular/src/standalone/index.ts`, which are the two files that
export the `*CustomEvent` / `*EventDetail` types today.

## Does this introduce a breaking change?

- [ ] Yes
- [x] No

## Other information

Docs only, no code changes. Found and prepared with AI assistance
(Claude Code); I checked every new path exists on `main`

**File**: `docs/component-guide.md` (modified, +6/-6)
```diff
@@ -835,14 +835,14 @@ When creating a new component that renders native input elements (such as `<inpu
 
 For Angular integration, you should use one of the existing value accessors based on your component's needs. Choose the one that most closely matches your component's behavior:
 
-- For text input (handles string values): Use [`TextValueAccessorDirective`](/packages/angular/src/directives/control-value-accessors/text-value-accessor.ts) which handles `ion-input:not([type=number])`, `ion-input-otp[type=text]`, `ion-textarea`, and `ion-searchbar`
-- For numeric input (converts string to number): Use [`NumericValueAccessorDirective`](/packages/angular/src/directives/control-value-accessors/numeric-value-accessor.ts) which handles `ion-input[type=number]`, `ion-input-otp:not([type=text])`, and `ion-range`
-- For boolean input (handles true/false): Use [`BooleanValueAccessorDirective`](/packages/angular/src/directives/control-value-accessors/boolean-value-accessor.ts) which handles `ion-checkbox` and `ion-toggle`
-- For select-like input (handles option selection): Use [`SelectValueAccessorDirective`](/packages/angular/src/directives/control-value-accessors/select-value-accessor.ts) which handles `ion-select`, `ion-radio-group`, `ion-segment`, and `ion-datetime`
+- For text input (handles string values): Use [`TextValueAccessorDirective`](/packages/angular/src/lazy/directives/control-value-accessors/text-value-accessor.ts) which handles `ion-input:not([type=number])`, `ion-input-otp[type=text]`, `ion-textarea`, and `ion-searchbar`
+- For numeric input (converts string to number): Use [`NumericValueAccessorDirective`](/packages/angular/src/lazy/directives/control-value-accessors/numeric-value-accessor.ts) which handles `ion-input[type=number]`, `ion-input-otp:not([type=text])`, and `ion-range`
+- For boolean input (handles true/false): Use [`BooleanValueAccessorDirective`](/packages/angular/src/lazy/directives/control-value-accessors/boolean-value-accessor.ts) which handles `ion-checkbox` and `ion-toggle`
+- For select-like input (handles option selection): Use [`SelectValueAccessorDirective`](/packages/angular/src/lazy/directives/control-value-accessors/select-value-accessor.ts) which handles `ion-select`, `ion-radio-group`, `ion-segment`, and `ion-datetime`
 
 These value accessors are already set up in the `@ionic/angular` package and handle all the necessary form integration. You don't need to create a new value accessor unless your component has unique requirements that aren't covered by these existing ones.
 
-For example, if your component renders a text input, it should be included in the `TextValueAccessorDirective` selector in [`text-value-accessor.ts`](/packages/angular/src/directives/control-value-accessors/text-value-accessor.ts):
+For example, if your component renders a text input, it should be included in the `TextValueAccessorDirective` selector in [`text-value-accessor.ts`](/packages/angular/src/lazy/directives/control-value-accessors/text-value-accessor.ts):
 
 ```diff
 @Directive({
@@ -1004,7 +1004,7 @@ These files contain tests for input behavior. Review how similar components are
 
 Add your component's interfaces to the framework packages:
 
-1. Angular ([`packages/angular/src/index.ts`](/packages/angular/src/index.ts)):
+1. Angular ([`packages/angular/src/lazy/index.ts`](/packages/angular/src/lazy/index.ts) and [`packages/angular/src/standalone/index.ts`](/packages/angular/src/standalone/index.ts), which exports these from `@ionic/core/components` instead):
 ```typescript
 export {
   NewComponentCustomEvent,
```

---

### Incident Patch 10: `bf0607ee` (2026-09-21)
**Commit Message**: fix(datetime): tear down ready state only when the host is hidden (#31460)

Issue number: resolves #30933

---------

## What is the current behavior?

Currently, an `ion-datetime` in a modal or popover sometimes opens with
a blank calendar on iOS 26. The host is missing `datetime-ready`, so
`.calendar-body` stays at `opacity: 0`. It doesn't happen every time,
and when it does the calendar stays blank until the overlay is reopened.

The `ion-datetime` component runs two IntersectionObservers on the same
root and target, one that adds `datetime-ready` and one that removes it.
WebKit reports an element that is still on screen as not intersecting,
and it doesn't deliver that entry to every observer, so the removing
observer tears the ready state down and the adding one never hears the
recovery.

## What is the new behavior?

The hidden-state observer now checks the host before tearing anything
down. An overlay hides its contents with `display: none`, which leaves
the host without a layout box, so a host that still has one is on screen
and the entry is wrong. The `hasBeenIntersecting` flag added in #31108
is gone, because the same check covers the synthetic "not intersecting"
entry tha

**File**: `core/src/components/datetime-button/test/overlays/datetime-button.e2e.ts` (modified, +18/-0)
```diff
@@ -267,6 +267,24 @@ configs({ modes: ['md'], directions: ['ltr'] }).forEach(({ title, config }) => {
       await expect(selectedDay).toBeInViewport();
     });
 
+    test('should keep the calendar visible across repeated open and dismiss cycles', async ({ page }, testInfo) => {
+      testInfo.annotations.push({
+        type: 'issue',
+        description: 'https://github.com/ionic-team/ionic-framework/issues/30933',
+      });
+
+      const calendarBody = datetime.locator('.calendar-body');
+
+      for (let cycle = 0; cycle < 10; cycle++) {
+        await openModal(page);
+
+        await expect(calendarBody).toHaveCSS('opacity', '1');
+        await expect(monthYear).toHaveText('March 2022');
+
+        await dismissModal();
+      }
+    });
+
     test('should navigate to the previous month when reopened', async ({ page }, testInfo) => {
       testInfo.annotations.push({
         type: 'issue',
```

**File**: `core/src/components/datetime/datetime.tsx` (modified, +27/-18)
```diff
@@ -136,16 +136,6 @@ export class Datetime implements ComponentInterface {
   private todayParts!: DatetimeParts;
   private defaultParts!: DatetimeParts;
   private loadTimeout: ReturnType<typeof setTimeout> | undefined;
-  /**
-   * Set true only by `visibleCallback`. Lets `hiddenCallback` ignore the
-   * synthetic "not intersecting" entry IntersectionObserver fires on
-   * `observe()` when the host mounts offscreen.
-   *
-   * Don't reset this in `disconnectedCallback`. Overlays disconnect and
-   * reconnect the host without re-creating the observers, so a reset there
-   * makes `hiddenCallback` miss the dismissal.
-   */
-  private hasBeenIntersecting = false;
 
   private prevPresentation: string | null = null;
 
@@ -1158,14 +1148,23 @@ export class Datetime implements ComponentInterface {
       return;
     }
 
-    const rect = this.el.getBoundingClientRect();
-    if (rect.width === 0 || rect.height === 0) {
+    if (!this.hasLayoutBox()) {
       return;
     }
 
     this.markReady();
   };
 
+  /**
+   * Whether the datetime is on screen. A modal or popover hides its contents
+   * with `display: none`, which leaves the host without a layout box.
+   */
+  private hasLayoutBox = () => {
+    const { width, height } = this.el.getBoundingClientRect();
+
+    return width > 0 && height > 0;
+  };
+
   private markReady = () => {
     if (this.el.classList.contains('datetime-ready')) {
       return;
@@ -1203,12 +1202,15 @@ export class Datetime implements ComponentInterface {
      * areas will not have the correct values snapped into place.
      */
     const visibleCallback = (entries: IntersectionObserverEntry[]) => {
-      const ev = entries[0];
+      /**
+       * The browser can batch several observations into one callback, so
+       * only the last entry describes the datetime now.
+       */
+      const ev = entries[entries.length - 1];
       if (!ev.isIntersecting) {
         return;
       }
 
-      this.hasBeenIntersecting = true;
       this.markReady();
     };
     const visibleIO = new IntersectionObserver(visibleCallback, { threshold: 0.01, root: el });
@@ -1244,16 +1246,23 @@ export class Datetime implements ComponentInterface {
      * we did originally has been lost.
      */
     const hiddenCallback = (entries: IntersectionObserverEntry[]) => {
-      const ev = entries[0];
+      const ev = entries[entries.length - 1];
       if (ev.isIntersecting) {
         return;
       }
 
-      // Ignore the initial "not intersecting" entry IntersectionObserver fires on observe().
-      if (!this.hasBeenIntersecting) {
+      /**
+       * WebKit reports a datetime that is still on screen as not
+       * intersecting, and it doesn't deliver that entry to every observer on
+       * the same root and target, so `visibleCallback` may never hear about
+       * it and add `datetime-ready` back. That is what left the calendar
+       * blank in #30933. Checking the host instead of trusting the entry
+       * also covers the synthetic "not intersecting" entry `observe()` fires
+       * when the datetime mounts offscreen.
+       */
+      if (this.hasLayoutBox()) {
         return;
       }
-      this.hasBeenIntersecting = false;
 
       this.destroyInteractionListeners();
 
```

**File**: `core/src/components/datetime/test/basic/datetime.e2e.ts` (modified, +101/-0)
```diff
@@ -488,6 +488,107 @@ configs({ modes: ['md'], directions: ['ltr'] }).forEach(({ title, config }) => {
   });
 });
 
+/**
+ * WebKit can report a datetime that is still on screen as not intersecting,
+ * so the datetime must not tear down its ready state on that alone.
+ */
+configs({ modes: ['md'], directions: ['ltr'] }).forEach(({ title, config }) => {
+  test.describe(title('datetime: spurious hidden report'), () => {
+    test('should stay ready when the observer reports it hidden while it is on screen', async ({ page }, testInfo) => {
+      testInfo.annotations.push({
+        type: 'issue',
+        description: 'https://github.com/ionic-team/ionic-framework/issues/30933',
+      });
+
+      await page.addInitScript(() => {
+        const OriginalIO = window.IntersectionObserver;
+        const datetimeObservers: {
+          callback: IntersectionObserverCallback;
+          targets: Element[];
+          sawVisible: boolean;
+        }[] = [];
+        let reportedHidden = false;
+
+        /**
+         * The datetime only tears down once its observers have reported it
+         * visible, so the test waits for that first.
+         */
+        (window as any).datetimeObserversSawVisible = () =>
+          datetimeObservers.length > 0 && datetimeObservers.every(({ sawVisible }) => sawVisible);
+
+        /**
+         * Reports the datetime as not intersecting and then goes quiet,
+         * since WebKit never sends a recovery entry to undo it.
+         */
+        (window as any).reportHiddenToDatetimeObservers = () => {
+          reportedHidden = true;
+          datetimeObservers.forEach(({ callback, targets }) => {
+            targets.forEach((target) => {
+              callback([{ isIntersecting: false, target } as IntersectionObserverEntry], null as any);
+            });
+          });
+        };
+
+        (window as any).IntersectionObserver = function (
+          callback: IntersectionObserverCallback,
+          options?: IntersectionObserverInit
+        ) {
+          const root = options?.root as Element | null;
+
+          if (root?.tagName !== 'ION-DATETIME') {
+            return new OriginalIO(callback, options);
+          }
+
+          const record = { callback, targets: [] as Element[], sawVisible: false };
+          datetimeObservers.push(record);
+
+          const instance = new OriginalIO((entries, observer) => {
+            if (reportedHidden) {
+              return;
+            }
+
+            if (entries.some((entry) => entry.isIntersecting)) {
+              record.sawVisible = true;
+            }
+
+            callback(entries, observer);
+          }, options);
+
+          const originalObserve = instance.observe.bind(instance);
+          instance.observe = (target: Element) => {
+            record.targets.push(target);
+            originalObserve(target);
+          };
+
+          return instance;
+        } as any;
+      });
+
+      await page.setContent(`<ion-datetime value="2022-05-03"></ion-datetime>`, config);
+
+      const datetime = page.locator('ion-datetime');
+      const calendarBody = datetime.locator('.calendar-body');
+
+      await expect(datetime).toHaveClass(/datetime-ready/);
+      await expect(calendarBody).toHaveCSS('opacity', '1');
+      await page.waitForFunction(() => (window as any).datetimeObserversSawVisible());
+
+      /**
+       * A one-shot layout fallback runs 100ms after the datetime loads and
+       * would add the class back. Real reports arrive long after that, so
+       * wait it out.
+       */
+      await page.waitForTimeout(300);
+
+      await page.evaluate(() => (window as any).reportHiddenToDatetimeObservers());
+      await page.waitForChanges();
+
+      await expect(datetime).toHaveClass(/datetime-ready/);
+      await expect(calendarBody).toHaveCSS('opacity', '1');
+    });
+  });
+});
+
 /**
  * We are setting RTL on the component
  * instead, so we don't need to test
```

---

### Incident Patch 11: `96ff7dff` (2026-09-18)
**Commit Message**: fix(popover): account for CSS zoom in positioning and sizing (#31426)

Issue number: resolves #30919

---------

Supersedes #31047, which this builds on. @KanhaiyaPandey is credited as
co-author on the commit.

## What is the current behavior?

When a CSS `zoom` other than `1` applies to the popover, `ion-popover`
renders incorrectly: it is positioned away from its trigger, and with
`size="cover"` it is given the wrong width. This affects a documented
workflow — adjusting the `html` zoom is the approach Ionic's
documentation recommends for dynamic font scaling on Chrome for Android.

The zoom factor is effectively applied twice. Geometry APIs
(`getBoundingClientRect()` on the trigger, content and arrow, plus
`clientX`/`clientY` for `reference="event"`) report values in the zoomed
coordinate space. Those values are written straight into the inline
`top`/`left`/`--width` styles on `.popover-content`, which are
interpreted in the unzoomed layout space and then re-scaled by the
browser.

## What is the new behavior?

- The effective zoom is read from the **popover's own context** via
`currentCSSZoom`, not from `document.documentElement`. This picks up a
zoom applied anywhere above the 

**File**: `core/src/components/popover/animations/ios.enter.ts` (modified, +23/-6)
```diff
@@ -5,6 +5,7 @@ import type { Animation } from '../../../interface';
 import {
   calculateWindowAdjustment,
   getArrowDimensions,
+  getElementCSSZoom,
   getPopoverDimensions,
   getPopoverPosition,
   getSafeAreaInsets,
@@ -31,16 +32,31 @@ export const iosEnterAnimation = (baseEl: HTMLElement, opts?: any): Animation =>
   const { event: ev, size, trigger, reference, side, align } = opts;
   const doc = baseEl.ownerDocument as any;
   const isRTL = doc.dir === 'rtl';
-  const bodyWidth = doc.defaultView.innerWidth;
-  const bodyHeight = doc.defaultView.innerHeight;
-
   const root = getElementRoot(baseEl);
   const contentEl = root.querySelector('.popover-content') as HTMLElement;
   const arrowEl = root.querySelector('.popover-arrow') as HTMLElement | null;
 
+  /**
+   * A CSS `zoom` other than 1 on an ancestor (e.g. the `html` element) causes
+   * geometry APIs like `getBoundingClientRect()` to report zoomed values while
+   * inline `top`/`left`/`--width` styles are interpreted in the unzoomed layout
+   * space. Normalize all rect-derived measurements by this factor so the
+   * popover is positioned and sized correctly.
+   */
+  const zoom = getElementCSSZoom(contentEl);
+
+  /**
+   * `innerWidth`/`innerHeight` are not affected by CSS `zoom`, so they must be
+   * scaled down to the same layout space as the normalized measurements above.
+   * Otherwise the popover would be clamped against a viewport that is larger
+   * than the space actually available to it.
+   */
+  const bodyWidth = doc.defaultView.innerWidth / zoom;
+  const bodyHeight = doc.defaultView.innerHeight / zoom;
+
   const referenceSizeEl = trigger || ev?.detail?.ionShadowTarget || ev?.target;
-  const { contentWidth, contentHeight } = getPopoverDimensions(size, contentEl, referenceSizeEl);
-  const { arrowWidth, arrowHeight } = getArrowDimensions(arrowEl);
+  const { contentWidth, contentHeight } = getPopoverDimensions(size, contentEl, referenceSizeEl, zoom);
+  const { arrowWidth, arrowHeight } = getArrowDimensions(arrowEl, zoom);
 
   const defaultPosition = {
     top: bodyHeight / 2 - contentHeight / 2,
@@ -60,7 +76,8 @@ export const iosEnterAnimation = (baseEl: HTMLElement, opts?: any): Animation =>
     align,
     defaultPosition,
     trigger,
-    ev
+    ev,
+    zoom
   );
 
   const padding = size === 'cover' ? 0 : POPOVER_IOS_BODY_PADDING;
```

**File**: `core/src/components/popover/animations/md.enter.ts` (modified, +28/-6)
```diff
@@ -2,7 +2,13 @@ import { createAnimation } from '@utils/animation/animation';
 import { getElementRoot } from '@utils/helpers';
 
 import type { Animation } from '../../../interface';
-import { calculateWindowAdjustment, getPopoverDimensions, getPopoverPosition, getSafeAreaInsets } from '../utils';
+import {
+  calculateWindowAdjustment,
+  getElementCSSZoom,
+  getPopoverDimensions,
+  getPopoverPosition,
+  getSafeAreaInsets,
+} from '../utils';
 
 const POPOVER_MD_BODY_PADDING = 12;
 
@@ -15,14 +21,29 @@ export const mdEnterAnimation = (baseEl: HTMLElement, opts?: any): Animation =>
   const doc = baseEl.ownerDocument as any;
   const isRTL = doc.dir === 'rtl';
 
-  const bodyWidth = doc.defaultView.innerWidth;
-  const bodyHeight = doc.defaultView.innerHeight;
-
   const root = getElementRoot(baseEl);
   const contentEl = root.querySelector('.popover-content') as HTMLElement;
 
+  /**
+   * A CSS `zoom` other than 1 on an ancestor (e.g. the `html` element) causes
+   * geometry APIs like `getBoundingClientRect()` to report zoomed values while
+   * inline `top`/`left`/`--width` styles are interpreted in the unzoomed layout
+   * space. Normalize all rect-derived measurements by this factor so the
+   * popover is positioned and sized correctly.
+   */
+  const zoom = getElementCSSZoom(contentEl);
+
+  /**
+   * `innerWidth`/`innerHeight` are not affected by CSS `zoom`, so they must be
+   * scaled down to the same layout space as the normalized measurements above.
+   * Otherwise the popover would be clamped against a viewport that is larger
+   * than the space actually available to it.
+   */
+  const bodyWidth = doc.defaultView.innerWidth / zoom;
+  const bodyHeight = doc.defaultView.innerHeight / zoom;
+
   const referenceSizeEl = trigger || ev?.detail?.ionShadowTarget || ev?.target;
-  const { contentWidth, contentHeight } = getPopoverDimensions(size, contentEl, referenceSizeEl);
+  const { contentWidth, contentHeight } = getPopoverDimensions(size, contentEl, referenceSizeEl, zoom);
 
   const defaultPosition = {
     top: bodyHeight / 2 - contentHeight / 2,
@@ -42,7 +63,8 @@ export const mdEnterAnimation = (baseEl: HTMLElement, opts?: any): Animation =>
     align,
     defaultPosition,
     trigger,
-    ev
+    ev,
+    zoom
   );
 
   const padding = size === 'cover' ? 0 : POPOVER_MD_BODY_PADDING;
```

**File**: `core/src/components/popover/test/util.spec.ts` (modified, +86/-1)
```diff
@@ -1,4 +1,89 @@
-import { isTriggerElement, getIndexOfItem, getNextItem, getPrevItem } from '../utils';
+import {
+  isTriggerElement,
+  getIndexOfItem,
+  getNextItem,
+  getPrevItem,
+  getElementCSSZoom,
+  getPopoverDimensions,
+  getArrowDimensions,
+} from '../utils';
+
+describe('getElementCSSZoom', () => {
+  it('should return 1 when no element is provided', () => {
+    expect(getElementCSSZoom(null)).toEqual(1);
+  });
+
+  it('should use currentCSSZoom when available', () => {
+    const el = document.createElement('div');
+    Object.defineProperty(el, 'currentCSSZoom', { value: 1.5, configurable: true });
+
+    expect(getElementCSSZoom(el)).toEqual(1.5);
+  });
+
+  it('should fall back to the ratio between the client rect and offsetWidth', () => {
+    const el = document.createElement('div');
+    // No currentCSSZoom support in this environment.
+    el.getBoundingClientRect = () => ({ width: 300, height: 0, top: 0, left: 0, bottom: 0, right: 0 } as DOMRect);
+    Object.defineProperty(el, 'offsetWidth', { value: 200, configurable: true });
+
+    expect(getElementCSSZoom(el)).toEqual(1.5);
+  });
+
+  it('should treat sub-pixel rounding in the fallback as no zoom', () => {
+    const el = document.createElement('div');
+    // offsetWidth is rounded to an integer, the bounding rect is not.
+    el.getBoundingClientRect = () => ({ width: 250.4, height: 0, top: 0, left: 0, bottom: 0, right: 0 } as DOMRect);
+    Object.defineProperty(el, 'offsetWidth', { value: 250, configurable: true });
+
+    expect(getElementCSSZoom(el)).toEqual(1);
+  });
+
+  it('should return 1 when the fallback measurements are unavailable', () => {
+    const el = document.createElement('div');
+    el.getBoundingClientRect = () => ({ width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 } as DOMRect);
+    Object.defineProperty(el, 'offsetWidth', { value: 0, configurable: true });
+
+    expect(getElementCSSZoom(el)).toEqual(1);
+  });
+});
+
+describe('getPopoverDimensions', () => {
+  it('should normalize the content dimensions by the zoom factor', () => {
+    const contentEl = document.createElement('div');
+    contentEl.getBoundingClientRect = () =>
+      ({ width: 300, height: 450, top: 0, left: 0, bottom: 0, right: 0 } as DOMRect);
+
+    const { contentWidth, contentHeight } = getPopoverDimensions('auto', contentEl, undefined, 1.5);
+
+    expect(contentWidth).toEqual(200);
+    expect(contentHeight).toEqual(300);
+  });
+
+  it('should normalize the trigger width by the zoom factor when size is cover', () => {
+    const contentEl = document.createElement('div');
+    contentEl.getBoundingClientRect = () =>
+      ({ width: 300, height: 450, top: 0, left: 0, bottom: 0, right: 0 } as DOMRect);
+    const triggerEl = document.createElement('div');
+    triggerEl.getBoundingClientRect = () =>
+      ({ width: 150, height: 60, top: 0, left: 0, bottom: 0, right: 0 } as DOMRect);
+
+    const { contentWidth } = getPopoverDimensions('cover', contentEl, triggerEl, 1.5);
+
+    expect(contentWidth).toEqual(100);
+  });
+});
+
+describe('getArrowDimensions', () => {
+  it('should normalize the arrow dimensions by the zoom factor', () => {
+    const arrowEl = document.createElement('div');
+    arrowEl.getBoundingClientRect = () => ({ width: 15, height: 15, top: 0, left: 0, bottom: 0, right: 0 } as DOMRect);
+
+    const { arrowWidth, arrowHeight } = getArrowDimensions(arrowEl, 1.5);
+
+    expect(arrowWidth).toEqual(10);
+    expect(arrowHeight).toEqual(10);
+  });
+});
 
 describe('isTriggerElement', () => {
   it('should return true is element is a trigger', () => {
```

**File**: `core/src/components/popover/test/zoom/index.html` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+<!DOCTYPE html>
+<html lang="en" dir="ltr">
+  <head>
+    <meta charset="UTF-8" />
+    <title>Popover - Zoom</title>
+    <meta
+      name="viewport"
+      content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
+    />
+    <link href="../../../../../css/ionic.bundle.css" rel="stylesheet" />
+    <link href="../../../../../scripts/testing/styles.css" rel="stylesheet" />
+    <script src="../../../../../scripts/testing/scripts.js"></script>
+    <script type="module" src="../../../../../dist/ionic/ionic.esm.js"></script>
+
+    <style>
+      /*
+       * Applying a CSS zoom to the html element is the approach recommended by
+       * the Ionic documentation for dynamic font scaling on Chrome for Android.
+       * https://github.com/ionic-team/ionic-framework/issues/30919
+       */
+      html {
+        zoom: 1.5;
+      }
+
+      ion-content button.trigger {
+        display: block;
+
+        width: 100px;
+
+        margin-bottom: 40px;
+        padding: 8px;
+      }
+
+      ion-popover {
+        --width: 120px;
+      }
+
+      /*
+       * Positioned so that the popover would extend past the right edge of the
+       * zoomed layout viewport unless it is adjusted back onto the screen.
+       */
+      ion-content button.edge {
+        width: 60px;
+
+        margin-left: 164px;
+      }
+    </style>
+  </head>
+
+  <body>
+    <ion-app>
+      <ion-header>
+        <ion-toolbar>
+          <ion-title>Popover - Zoom</ion-title>
+        </ion-toolbar>
+      </ion-header>
+
+      <ion-content class="ion-padding">
+        <button id="auto-trigger" class="trigger">Auto</button>
+        <ion-popover trigger="auto-trigger" class="auto-popover">
+          <ion-content class="ion-padding">Auto</ion-content>
+        </ion-popover>
+
+        <button id="cover-trigger" class="trigger">Cover</button>
+        <ion-popover trigger="cover-trigger" class="cover-popover" size="cover">
+          <ion-content class="ion-padding">Cover</ion-content>
+        </ion-popover>
+
+        <button id="edge-trigger" class="trigger edge">Edge</button>
+        <ion-popover trigger="edge-trigger" class="edge-popover">
+          <ion-content class="ion-padding">Edge</ion-content>
+        </ion-popover>
+      </ion-content>
+    </ion-app>
+  </body>
+</html>
```

**File**: `core/src/components/popover/test/zoom/popover.e2e.ts` (added, +315/-0)
```diff
@@ -0,0 +1,315 @@
+import { expect } from '@playwright/test';
+import type { E2EPage } from '@utils/test/playwright';
+import { configs, test } from '@utils/test/playwright';
+
+import { openPopover } from '../test.utils';
+
+/**
+ * A CSS `zoom` causes geometry APIs such as `getBoundingClientRect()` and
+ * pointer `clientX`/`clientY` to report values in the zoomed coordinate space,
+ * while the inline `top`/`left`/`--width` styles the popover sets are
+ * interpreted in the unzoomed layout space. The popover needs to account for
+ * this so it stays anchored to its trigger.
+ *
+ * These are functional assertions rather than screenshots because what is being
+ * verified is the popover's geometry relative to its trigger, not its
+ * appearance. Both boxes are read in the same coordinate space, so the
+ * relationship between them holds at any zoom level.
+ */
+
+/**
+ * Maximum difference, in pixels, between two positions still considered
+ * aligned. Generous enough for sub-pixel rounding across browsers, far tighter
+ * than the error a missing zoom adjustment produces (tens of pixels).
+ */
+const TOLERANCE = 2;
+
+const expectAligned = (actual: number, expected: number) => {
+  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE);
+};
+
+/**
+ * Builds a page with a trigger and a popover, with `zoomStyles` controlling
+ * where in the tree the zoom is applied. The trigger is kept near the top left
+ * so the popover is never pushed onto the screen by the offscreen adjustment,
+ * which would mask a positioning error.
+ */
+const zoomedPage = (zoomStyles: string) => `
+  <style>
+    ${zoomStyles}
+
+    #trigger {
+      display: block;
+
+      width: 80px;
+
+      margin: 20px;
+      padding: 8px;
+    }
+
+    ion-popover {
+      --width: 100px;
+    }
+  </style>
+
+  <button id="trigger">Trigger</button>
+  <ion-popover trigger="trigger">
+    <ion-content class="ion-padding">Content</ion-content>
+  </ion-popover>
+`;
+
+/**
+ * Markup where the zoom wraps only the trigger, leaving the popover outside the
+ * zoomed subtree. This is the split `popoverController.create()` produces by
+ * default, since the overlay is appended to `ion-app`.
+ */
+const triggerOnlyZoomPage = `
+  <style>
+    .panel {
+      zoom: 1.5;
+    }
+
+    #trigger {
+      display: block;
+
+      width: 80px;
+
+      margin: 20px;
+      padding: 8px;
+    }
+
+    ion-popover {
+      --width: 100px;
+    }
+  </style>
+
+  <div class="panel">
+    <button id="trigger">Trigger</button>
+  </div>
+  <ion-popover trigger="trigger">
+    <ion-content class="ion-padding">Content</ion-content>
+  </ion-popover>
+`;
+
+/**
+ * The vertical sides take a larger zoom. The gap a missing `arrowHeight`
+ * normalization opens between the arrow and the content edge scales with it,
+ * so a larger factor keeps that gap comfortably clear of the tolerance. Going
+ * much beyond this leaves too little layout height below the trigger and the
+ * popover flips above it, which changes which edge the arrow sits against.
+ */
+const VERTICAL_SIDE_ZOOM = 1.5;
+
+/**
+ * The horizontal sides need a smaller one: at a larger zoom the popover no
+ * longer fits beside the trigger, and the offscreen adjustment would move it
+ * and mask the arrow position under test.
+ */
+const HORIZONTAL_SIDE_ZOOM = 1.25;
+
+/**
+ * Builds a page with the popover on a given side, under a zoom. The trigger sits
+ * in the middle so the popover fits on every side without the offscreen
+ * adjustment moving it, which would mask an arrow positioning error.
+ */
+const zoomedSidePage = (side: string, zoom: number) => `
+  <style>
+    html {
+      zoom: ${zoom};
+    }
+
+    #trigger {
+      display: block;
+
+      width: 60px;
+
+      margin: 200px auto 0;
+      padding: 8px;
+    }
+
+    ion-popover {
+      --width: 80px;
+    }
+  </style>
+
+  <button id="trigger">Trigger</button>
+  <ion-popover trigger="trigger" side="${side}">
+    <ion-content class="ion-padding">Content</ion-content>
+  </ion-popover>
+`;
+
+const expectAnchoredToTrigger = async (page: E2EPage) => {
+  const triggerBox = (await page.locator('#trigger').boundingBox())!;
+  const contentBox = (await page.locator('ion-popover').locator('.popover-content').boundingBox())!;
+
+  expectAligned(contentBox.x, triggerBox.x);
+  expectAligned(contentBox.y, triggerBox.y + triggerBox.height);
+};
+
+/**
+ * This behavior does not vary across directions. MD mode is used because it has
+ * no arrow offsetting the content and defaults to `start` alignment, which
+ * makes the expected relationship to the trigger unambiguous.
+ */
+configs({ modes: ['md'], directions: ['ltr'] }).forEach(({ title, config }) => {
+  test.describe(title('popover: zoom'), () => {
+    test.beforeEach(() => {
+      test.info().annotations.push({
+        type: 'issue',
+        description: 'https://github.com/ionic-team/ionic-framework/issues/30919',
+      });
+    });
+
+    test.describe('zoom on
```

**File**: `core/src/components/popover/utils.ts` (modified, +70/-13)
```diff
@@ -105,33 +105,89 @@ export const getSafeAreaInsets = (doc: Document): SafeAreaInsets => {
   return insets;
 };
 
+/**
+ * Largest difference from 1 that the `offsetWidth` based zoom detection below
+ * attributes to integer rounding rather than to an actual CSS `zoom`. The
+ * rounding error is at most half a pixel over the width of the popover, which
+ * is well under this threshold for any realistic popover size.
+ */
+const ZOOM_ROUNDING_TOLERANCE = 0.01;
+
+/**
+ * Returns the cumulative CSS `zoom` factor applied to an element.
+ *
+ * When a CSS `zoom` other than 1 is set on an ancestor (e.g. the `html`
+ * element, as recommended by the docs for dynamic font scaling on Chrome for
+ * Android), `getBoundingClientRect()`, `clientX`/`clientY` and other geometry
+ * APIs report values in the *zoomed* (visual) coordinate space, while inline
+ * `top`/`left`/`--width` styles we set are interpreted in the *unzoomed*
+ * (layout) space and re-scaled by the browser. Dividing the rect-derived
+ * values by this factor converts them back to layout space so the popover is
+ * positioned and sized correctly. Returns 1 when no zoom is applied.
+ */
+export const getElementCSSZoom = (el: HTMLElement | null): number => {
+  if (!el) {
+    return 1;
+  }
+
+  /**
+   * `currentCSSZoom` exposes the exact effective zoom of an element
+   * (Chromium 128+). When available we use it directly.
+   */
+  const currentCSSZoom = el.currentCSSZoom;
+  if (typeof currentCSSZoom === 'number' && currentCSSZoom > 0) {
+    return currentCSSZoom;
+  }
+
+  /**
+   * Fallback for browsers without `currentCSSZoom`: compare the rendered
+   * (zoomed) width from `getBoundingClientRect()` against the layout width
+   * from `offsetWidth`, which is not affected by CSS `zoom`.
+   */
+  const { width } = el.getBoundingClientRect();
+  const { offsetWidth } = el;
+  if (offsetWidth > 0 && width > 0) {
+    const ratio = width / offsetWidth;
+    /**
+     * `offsetWidth` is rounded to an integer while the bounding rect is not,
+     * so the ratio is rarely exactly 1 even when no zoom is applied. Treat
+     * sub-pixel differences as "no zoom" so that unzoomed popovers are not
+     * shifted by the rounding error. A real zoom deviates far more, though
+     * the same rounding leaves the detected factor approximate.
+     */
+    return Math.abs(ratio - 1) < ZOOM_ROUNDING_TOLERANCE ? 1 : ratio;
+  }
+
+  return 1;
+};
+
 /**
  * Returns the dimensions of the popover
  * arrow on `ios` mode. If arrow is disabled
  * returns (0, 0).
  */
-export const getArrowDimensions = (arrowEl: HTMLElement | null) => {
+export const getArrowDimensions = (arrowEl: HTMLElement | null, zoom = 1) => {
   if (!arrowEl) {
     return { arrowWidth: 0, arrowHeight: 0 };
   }
   const { width, height } = arrowEl.getBoundingClientRect();
 
-  return { arrowWidth: width, arrowHeight: height };
+  return { arrowWidth: width / zoom, arrowHeight: height / zoom };
 };
 
 /**
  * Returns the recommended dimensions of the popover
  * that takes into account whether or not the width
  * should match the trigger width.
  */
-export const getPopoverDimensions = (size: PopoverSize, contentEl: HTMLElement, triggerEl?: HTMLElement) => {
+export const getPopoverDimensions = (size: PopoverSize, contentEl: HTMLElement, triggerEl?: HTMLElement, zoom = 1) => {
   const contentDimentions = contentEl.getBoundingClientRect();
-  const contentHeight = contentDimentions.height;
-  let contentWidth = contentDimentions.width;
+  const contentHeight = contentDimentions.height / zoom;
+  let contentWidth = contentDimentions.width / zoom;
 
   if (size === 'cover' && triggerEl) {
     const triggerDimensions = triggerEl.getBoundingClientRect();
-    contentWidth = triggerDimensions.width;
+    contentWidth = triggerDimensions.width / zoom;
   }
 
   return {
@@ -526,7 +582,8 @@ export const getPopoverPosition = (
   align: PositionAlign,
   defaultPosition: PopoverPosition,
   triggerEl?: HTMLElement,
-  event?: MouseEvent | CustomEvent
+  event?: MouseEvent | CustomEvent,
+  zoom = 1
 ): PopoverPosition => {
   let referenceCoordinates = {
     top: 0,
@@ -549,8 +606,8 @@ export const getPopoverPosition = (
       const mouseEv = event as MouseEvent;
 
       referenceCoordinates = {
-        top: mouseEv.clientY,
-        left: mouseEv.clientX,
+        top: mouseEv.clientY / zoom,
+        left: mouseEv.clientX / zoom,
         width: 1,
         height: 1,
       };
@@ -585,10 +642,10 @@ export const getPopoverPosition = (
       }
       const triggerBoundingBox = actualTriggerEl.getBoundingClientRect();
       referenceCoordinates = {
-        top: triggerBoundingBox.top,
-        left: triggerBoundingBox.left,
-        width: triggerBoundingBox.width,
-        height: triggerBoundingBox.height,
+        top: triggerBoundingBox.top / zoom,
+        left: triggerBoundingBox.left / zoom,
+        width: triggerBoundingBox.width / zoom,
+        height: triggerBoundingBox.height / 
```

---

### Incident Patch 12: `edb3e48e` (2026-09-17)
**Commit Message**: fix(vue): respect config log level (#31452)

Issue number: internal

---------

## What is the current behavior?

The Vue package has two warnings that are printed regardless of the
configured log level.

## What is the new behavior?

- Export `printIonWarning` and `printIonError` from core, enabling
packages to log messages with Ionic's configured log level.
- Use `printIonWarning` in the Vue package instead of `console.warn`
directly. This checks the log level before printing.

## Does this introduce a breaking change?

- [ ] Yes
- [X] No

**File**: `core/src/index.ts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ export { getTimeGivenProgression } from './utils/animation/cubic-bezier';
 export { createGesture } from './utils/gesture';
 export { initialize } from './global/ionic-global';
 export { componentOnReady } from './utils/helpers';
-export { LogLevel } from './utils/logging';
+export { LogLevel, printIonWarning, printIonError } from './utils/logging';
 export { isPlatform, Platforms, PlatformConfig, getPlatforms } from './utils/platform';
 export { IonicSafeString } from './utils/sanitization';
 export { IonicConfig, getMode, setupConfig } from './utils/config';
```

**File**: `core/src/utils/logging/index.ts` (modified, +4/-0)
```diff
@@ -34,6 +34,8 @@ const isLogLevelEnabled = (minimum: LogLevel): boolean => {
  * to indicate the library that is warning the developer.
  *
  * @param message - The string message to be logged to the console.
+ *
+ * @internal
  */
 export const printIonWarning = (message: string, ...params: any[]) => {
   if (isLogLevelEnabled(LogLevel.WARN)) {
@@ -47,6 +49,8 @@ export const printIonWarning = (message: string, ...params: any[]) => {
  *
  * @param message - The string message to be logged to the console.
  * @param params - Additional arguments to supply to the console.error.
+ *
+ * @internal
  */
 export const printIonError = (message: string, ...params: any[]) => {
   if (isLogLevelEnabled(LogLevel.ERROR)) {
```

**File**: `packages/vue/src/components/IonRouterOutlet.ts` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 import type { AnimationBuilder } from "@ionic/core/components";
 import {
+  printIonWarning,
   LIFECYCLE_DID_ENTER,
   LIFECYCLE_DID_LEAVE,
   LIFECYCLE_WILL_ENTER,
@@ -292,7 +293,7 @@ export const IonRouterOutlet = /*@__PURE__*/ defineComponent({
        * methods to work properly.
        */
       if (enteringEl === undefined) {
-        console.warn(`[@ionic/vue Warning]: The view you are trying to render for path ${routeInfo.pathname} does not have the required <ion-page> component. Transitions and lifecycle methods may not work as expected.
+        printIonWarning(`The view you are trying to render for path ${routeInfo.pathname} does not have the required <ion-page> component. Transitions and lifecycle methods may not work as expected.
 
 See https://ionicframework.com/docs/vue/navigation#ionpage for more information.`);
       }
```

**File**: `packages/vue/src/hooks/lifecycle.ts` (modified, +3/-2)
```diff
@@ -1,3 +1,4 @@
+import { printIonWarning } from "@ionic/core/components";
 import type { ComponentInternalInstance } from "vue";
 import { getCurrentInstance } from "vue";
 
@@ -35,8 +36,8 @@ const injectHook = (
 
     return wrappedHook;
   } else {
-    console.warn(
-      "[@ionic/vue]: Ionic Lifecycle Hooks can only be used during execution of setup()."
+    printIonWarning(
+      "Ionic Lifecycle Hooks can only be used during execution of setup()."
     );
   }
 };
```

---

### Incident Patch 13: `6244cec3` (2026-09-17)
**Commit Message**: chore(deps): transitively update postcss (#31436)

Issue number: internal

---------

## What is the current behavior?

Several dependencies throughout the repo have postcss as a dependency.
While it doesn't affect users, a vulnerability in postcss causes
dependabot to log high severity alerts.

## What is the new behavior?

- Bumped dependencies in vue and vue-router that were on the old
postcss.
- Added overrides for ng18, ng19, and ng20 test apps, which are stuck on
older versions.
- Ran `npm update` for all other packages that inherited postcss. This
has a few side effects:
- Bumps the `lockFileVersion` from 2 to 3, which accounts for most of
the diff in the package-lock files.
- Bumps the `react-router` from 5 to 6 in the React 18 test app
package-lock.

## Does this introduce a breaking change?

- [ ] Yes
- [X] No

## Other information

Core uses old versions of stylelint and stylelint-order that cannot be
easily updated, and these use an old postcss with the vulnerability.

---------

Co-authored-by: @anupamme

---------

Co-authored-by: Maria Hutt <[REDACTED_EMAIL]>

**File**: `packages/angular/test/apps/ng18/package-lock.json` (modified, +19/-15)
```diff
@@ -10778,15 +10778,16 @@
       }
     },
     "node_modules/nanoid": {
-      "version": "3.3.7",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.7.tgz",
-      "integrity": "sha512-eSRppjcPIatRIMC1U6UngP8XFcz8MQWGQdt1MTBQ7NaAmvXDfvNxbvWV3x2y6CdEUciCSsDHDQZbhYaB8QEo2g==",
+      "version": "3.3.18",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz",
+      "integrity": "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
       "funding": [
         {
           "type": "github",
           "url": "https://github.com/sponsors/ai"
         }
       ],
+      "license": "MIT",
       "bin": {
         "nanoid": "bin/nanoid.cjs"
       },
@@ -11793,9 +11794,10 @@
       }
     },
     "node_modules/picocolors": {
-      "version": "1.0.1",
-      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.0.1.tgz",
-      "integrity": "sha512-anP1Z8qwhkbmu7MFP5iTt+wQKXgwzf7zTyGlcdzabySa9vd0Xt392U0rVmz9poOaBj0uHJKyyo9/upk0HrEQew=="
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz",
+      "integrity": "sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==",
+      "license": "ISC"
     },
     "node_modules/picomatch": {
       "version": "4.0.2",
@@ -11963,9 +11965,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.4.38",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.38.tgz",
-      "integrity": "sha512-Wglpdk03BSfXkHoQa3b/oulrotAkwrlLDRSOb9D0bN86FdRyE9lppSp33aHNPgBa0JKCoB+drFLZkQoRRYae5A==",
+      "version": "8.5.28",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.28.tgz",
+      "integrity": "sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==",
       "funding": [
         {
           "type": "opencollective",
@@ -11980,10 +11982,11 @@
           "url": "https://github.com/sponsors/ai"
         }
       ],
+      "license": "MIT",
       "dependencies": {
-        "nanoid": "^3.3.7",
-        "picocolors": "^1.0.0",
-        "source-map-js": "^1.2.0"
+        "nanoid": "^3.3.18",
+        "picocolors": "^1.1.1",
+        "source-map-js": "^1.2.1"
       },
       "engines": {
         "node": "^10 || ^12 || >=14"
@@ -13142,9 +13145,10 @@
       }
     },
     "node_modules/source-map-js": {
-      "version": "1.2.0",
-      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.0.tgz",
-      "integrity": "sha512-itJW8lvSA0TXEphiRoawsCksnlf8SyvmFzIhltqAHluXd88pkCd+cXJVHTDwdCr0IzwptSm035IHQktUu1QUMg==",
+      "version": "1.2.1",
+      "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.1.tgz",
+      "integrity": "sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==",
+      "license": "BSD-3-Clause",
       "engines": {
         "node": ">=0.10.0"
       }
```

**File**: `packages/angular/test/apps/ng18/package.json` (modified, +3/-0)
```diff
@@ -60,6 +60,9 @@
     "webpack": "^5.61.0",
     "webpack-cli": "^4.9.2"
   },
+  "overrides": {
+    "postcss": "^8.5.23"
+  },
   "engines": {
     "node": ">= 18"
   }
```

**File**: `packages/angular/test/apps/ng19/package-lock.json` (modified, +7/-7)
```diff
@@ -12277,9 +12277,9 @@
       }
     },
     "node_modules/nanoid": {
-      "version": "3.3.7",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.7.tgz",
-      "integrity": "sha512-eSRppjcPIatRIMC1U6UngP8XFcz8MQWGQdt1MTBQ7NaAmvXDfvNxbvWV3x2y6CdEUciCSsDHDQZbhYaB8QEo2g==",
+      "version": "3.3.18",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz",
+      "integrity": "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
       "dev": true,
       "funding": [
         {
@@ -13351,9 +13351,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.4.49",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.4.49.tgz",
-      "integrity": "sha512-OCVPnIObs4N29kxTjzLfUryOkvZEq+pf8jTF0lg8E7uETuWHA+v7j3c/xJmiqpX450191LlmZfUKkXxkTry7nA==",
+      "version": "8.5.28",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.28.tgz",
+      "integrity": "sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==",
       "dev": true,
       "funding": [
         {
@@ -13371,7 +13371,7 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "nanoid": "^3.3.7",
+        "nanoid": "^3.3.18",
         "picocolors": "^1.1.1",
         "source-map-js": "^1.2.1"
       },
```

**File**: `packages/angular/test/apps/ng19/package.json` (modified, +3/-0)
```diff
@@ -62,6 +62,9 @@
     "webpack": "^5.61.0",
     "webpack-cli": "^4.9.2"
   },
+  "overrides": {
+    "postcss": "^8.5.23"
+  },
   "engines": {
     "node": ">= 18"
   }
```

**File**: `packages/angular/test/apps/ng20/package-lock.json` (modified, +7/-7)
```diff
@@ -11363,9 +11363,9 @@
       }
     },
     "node_modules/nanoid": {
-      "version": "3.3.11",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.11.tgz",
-      "integrity": "sha512-N8SpfPUnUp1bK+PMYW8qSWdl9U+wwNWI4QKxOYDy9JAro3WMX7p2OeVRF9v+347pnakNevPmiHhNmZ2HbFA76w==",
+      "version": "3.3.18",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz",
+      "integrity": "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
       "dev": true,
       "funding": [
         {
@@ -12485,9 +12485,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.5.3",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.3.tgz",
-      "integrity": "sha512-dle9A3yYxlBSrt8Fu+IpjGT8SY8hN0mlaA6GY8t0P5PjIOZemULz/E2Bnm/2dcUOena75OTNkHI76uZBNUUq3A==",
+      "version": "8.5.28",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.28.tgz",
+      "integrity": "sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==",
       "dev": true,
       "funding": [
         {
@@ -12505,7 +12505,7 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "nanoid": "^3.3.8",
+        "nanoid": "^3.3.18",
         "picocolors": "^1.1.1",
         "source-map-js": "^1.2.1"
       },
```

**File**: `packages/angular/test/apps/ng20/package.json` (modified, +3/-0)
```diff
@@ -62,6 +62,9 @@
     "webpack": "^5.61.0",
     "webpack-cli": "^4.9.2"
   },
+  "overrides": {
+    "postcss": "^8.5.23"
+  },
   "engines": {
     "node": ">=20"
   }
```

**File**: `packages/react-router/test/apps/reactrouter6-react19/package-lock.json` (modified, +581/-527)
```diff
@@ -38,18 +38,18 @@
       }
     },
     "node_modules/@adobe/css-tools": {
-      "version": "4.4.4",
-      "resolved": "https://registry.npmjs.org/@adobe/css-tools/-/css-tools-4.4.4.tgz",
-      "integrity": "sha512-Elp+iwUx5rN5+Y8xLt5/GRoG20WGoDCQ/1Fb+1LiGtvwbDavuSk0jhD/eZdckHAuzcDzccnkv+rEjyWfRx18gg==",
+      "version": "4.5.0",
+      "resolved": "https://registry.npmjs.org/@adobe/css-tools/-/css-tools-4.5.0.tgz",
+      "integrity": "sha512-6OzddxPio9UiWTCemp4N8cYLV2ZN1ncRnV1cVGtve7dhPOtRkleRyx32GQCYSwDYgaHU3USMm84tNsvKzRCa1Q==",
       "license": "MIT"
     },
     "node_modules/@babel/code-frame": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.0.tgz",
-      "integrity": "sha512-9NhCeYjq9+3uxgdtp20LSiJXJvN0FeCtNGpJxuMFZ1Kv3cWUNb6DOhJwUvcVCzKGR66cw4njwM6hrJLqgOwbcw==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/code-frame/-/code-frame-7.29.7.tgz",
+      "integrity": "sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==",
       "license": "MIT",
       "dependencies": {
-        "@babel/helper-validator-identifier": "^7.28.5",
+        "@babel/helper-validator-identifier": "^7.29.7",
         "js-tokens": "^4.0.0",
         "picocolors": "^1.1.1"
       },
@@ -58,31 +58,31 @@
       }
     },
     "node_modules/@babel/compat-data": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.0.tgz",
-      "integrity": "sha512-T1NCJqT/j9+cn8fvkt7jtwbLBfLC/1y1c7NtCeXFRgzGTsafi68MRv8yzkYSapBnFA6L3U2VSc02ciDzoAJhJg==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/compat-data/-/compat-data-7.29.7.tgz",
+      "integrity": "sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==",
       "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/core": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.0.tgz",
-      "integrity": "sha512-CGOfOJqWjg2qW/Mb6zNsDm+u5vFQ8DxXfbM09z69p5Z6+mE1ikP2jUXw+j42Pf1XTYED2Rni5f95npYeuwMDQA==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/core/-/core-7.29.7.tgz",
+      "integrity": "sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@babel/code-frame": "^7.29.0",
-        "@babel/generator": "^7.29.0",
-        "@babel/helper-compilation-targets": "^7.28.6",
-        "@babel/helper-module-transforms": "^7.28.6",
-        "@babel/helpers": "^7.28.6",
-        "@babel/parser": "^7.29.0",
-        "@babel/template": "^7.28.6",
-        "@babel/traverse": "^7.29.0",
-        "@babel/types": "^7.29.0",
+        "@babel/code-frame": "^7.29.7",
+        "@babel/generator": "^7.29.7",
+        "@babel/helper-compilation-targets": "^7.29.7",
+        "@babel/helper-module-transforms": "^7.29.7",
+        "@babel/helpers": "^7.29.7",
+        "@babel/parser": "^7.29.7",
+        "@babel/template": "^7.29.7",
+        "@babel/traverse": "^7.29.7",
+        "@babel/types": "^7.29.7",
         "@jridgewell/remapping": "^2.3.5",
         "convert-source-map": "^2.0.0",
         "debug": "^4.1.0",
@@ -99,14 +99,14 @@
       }
     },
     "node_modules/@babel/generator": {
-      "version": "7.29.1",
-      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.1.tgz",
-      "integrity": "sha512-qsaF+9Qcm2Qv8SRIMMscAvG4O3lJ0F1GuMo5HR/Bp02LopNgnZBC/EkbevHFeGs4ls/oPz9v+Bsmzbkbe+0dUw==",
+      "version": "7.29.8",
+      "resolved": "https://registry.npmjs.org/@babel/generator/-/generator-7.29.8.tgz",
+      "integrity": "sha512-gZbepsdh3WDtgZKWL+vTPh71LSBrm/Y4/QDZBVCcYfmeTEEuoOYwlSy+G1StfJg+/Zy550u/3TATbm7qDbbMtg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@babel/parser": "^7.29.0",
-        "@babel/types": "^7.29.0",
+        "@babel/parser": "^7.29.8",
+        "@babel/types": "^7.29.8",
         "@jridgewell/gen-mapping": "^0.3.12",
         "@jridgewell/trace-mapping": "^0.3.28",
         "jsesc": "^3.0.2"
@@ -116,14 +116,14 @@
       }
     },
     "node_modules/@babel/helper-compilation-targets": {
-      "version": "7.28.6",
-      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.28.6.tgz",
-      "integrity": "sha512-JYtls3hqi15fcx5GaSNL7SCTJ2MNmjrkHXg4FSpOA/grxK8KwyZ5bubHsCq8FXCkua6xhuaaBit+3b7+VZRfcA==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/helper-compilation-targets/-/helper-compilation-targets-7.29.7.tgz",
+      "integrity": "sha512-wem6WaBj4NaVYVdNhLPPVacES6ZJ+KBBfSkTMD3YZxbP3rm3Di85tJU5ljaUNhaOynt+Aj0xruhYuzQBt8n71g==",
       "dev": true,
       "license": "M
```

**File**: `packages/vue-router/package-lock.json` (modified, +81/-109)
```diff
@@ -26,7 +26,7 @@
         "rimraf": "^3.0.2",
         "rollup": "^4.2.0",
         "typescript": "^6.0.0",
-        "vue": "^3.5.0",
+        "vue": "^3.5.42",
         "vue-router": "^5.2.0"
       }
     },
@@ -99,30 +99,30 @@
       }
     },
     "node_modules/@babel/helper-string-parser": {
-      "version": "7.27.1",
-      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.27.1.tgz",
-      "integrity": "sha512-qMlSxKbpRlAridDExk92nSobyDdpPijUq2DW6oDnUqd0iOGxmQjyqhMIihI9+zv4LPyZdRje2cavWPbCbWm3eA==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.29.7.tgz",
+      "integrity": "sha512-Pb5ijPrZ89GDH8223L4UP8i6QApWxs04RbPQJTeWDV0/keR2E36MeKnyr6LYmUUvqRRI+Iv87SuF1W6ErINzYw==",
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/helper-validator-identifier": {
-      "version": "7.28.5",
-      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.28.5.tgz",
-      "integrity": "sha512-qSs4ifwzKJSV39ucNjsvc6WVHs6b7S03sOh2OcHF9UHfVPqWWALUsNUVzhSBiItjRZoLHx7nIarVjqKVusUZ1Q==",
+      "version": "7.29.7",
+      "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.29.7.tgz",
+      "integrity": "sha512-qehxGkRj55h/ff8EMaJ+cYhyaKlHIxqYDn682wQD7RNp9UujOQsHog2uS0r2vzr4pW+sXf90NeeayjcNaX3fFg==",
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/parser": {
-      "version": "7.29.3",
-      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.29.3.tgz",
-      "integrity": "sha512-b3ctpQwp+PROvU/cttc4OYl4MzfJUWy6FZg+PMXfzmt/+39iHVF0sDfqay8TQM3JA2EUOyKcFZt75jWriQijsA==",
+      "version": "7.29.8",
+      "resolved": "https://registry.npmjs.org/@babel/parser/-/parser-7.29.8.tgz",
+      "integrity": "sha512-E8lTAYNB1KW+FH+VGJuZM1ioAx2E6oVlvQFRrf5P8ZZmsiJXYAD9vTFV7yyEURNzgh1dFqMZuO6tUwcARbqFCA==",
       "license": "MIT",
       "dependencies": {
-        "@babel/types": "^7.29.0"
+        "@babel/types": "^7.29.8"
       },
       "bin": {
         "parser": "bin/babel-parser.js"
@@ -132,13 +132,13 @@
       }
     },
     "node_modules/@babel/types": {
-      "version": "7.29.0",
-      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.29.0.tgz",
-      "integrity": "sha512-LwdZHpScM4Qz8Xw2iKSzS+cfglZzJGvofQICy7W7v4caru4EaAmyUuO6BGrbyQ2mYV11W0U8j5mBhd14dd3B0A==",
+      "version": "7.29.8",
+      "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.29.8.tgz",
+      "integrity": "sha512-Vj1jF3cPfxg7OAfoI7QnVKLoILlm2JF9pnVHrX8qx7AHMiYWT+NDAA7jChlNgRS4WTLc/fD1lXLmPixluj+3Gg==",
       "license": "MIT",
       "dependencies": {
-        "@babel/helper-string-parser": "^7.27.1",
-        "@babel/helper-validator-identifier": "^7.28.5"
+        "@babel/helper-string-parser": "^7.29.7",
+        "@babel/helper-validator-identifier": "^7.29.7"
       },
       "engines": {
         "node": ">=6.9.0"
@@ -498,7 +498,6 @@
       "cpu": [
         "arm"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -512,7 +511,6 @@
       "cpu": [
         "arm64"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -552,7 +550,6 @@
       "cpu": [
         "arm64"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -566,7 +563,6 @@
       "cpu": [
         "x64"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -580,7 +576,6 @@
       "cpu": [
         "arm"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -594,7 +589,6 @@
       "cpu": [
         "arm"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -634,7 +628,6 @@
       "cpu": [
         "loong64"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -648,7 +641,6 @@
       "cpu": [
         "loong64"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -662,7 +654,6 @@
       "cpu": [
         "ppc64"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -676,7 +667,6 @@
       "cpu": [
         "ppc64"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -690,7 +680,6 @@
       "cpu": [
         "riscv64"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -704,7 +693,6 @@
       "cpu": [
         "riscv64"
       ],
-      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -718,7 +706,6 @@
       "cpu": [
         "s390x"
       ],
-      "dev": true,
       "
```

---

### Incident Patch 14: `e7715193` (2026-09-17)
**Commit Message**: fix(button): sync aria attributes between host and native button (#31264)

Issue number: resolves #30626 

---------

<!-- Please do not submit updates to dependencies unless it fixes an
issue. -->

<!-- Please try to limit your pull request to one type (bugfix, feature,
etc). Submit multiple pull requests if needed. -->

## What is the current behavior?
<!-- Please describe the current behavior that you are modifying. -->
The native `button` inside `ion-button` is not being updated with the
aria-attributes if it changes on `ion-button` after initial render,
including `aria-description`. Additionally, the same dynamic is
happening with other button like elements, including `ion-card` and
`ion-item`.

## What is the new behavior?
<!-- Please describe the behavior or changes that are being added by
this PR. -->
The native `button` inside `ion-button` updates with the aria attributes
if it changes on `ion-button`. Changes include:
- Add 2 helper functions to [helpers.ts](http://helpers.ts/)
    - A mutation observer watching for all attribute changes.
- One which watches only for aria attribute changes, which calls the
mutation observer.
- Add 4 tests to
[button.e2e.ts](https://github

**File**: `core/src/components/button/button.tsx` (modified, +24/-40)
```diff
@@ -1,8 +1,9 @@
 import type { ComponentInterface, EventEmitter } from '@stencil/core';
 import { Component, Element, Event, Host, Prop, Watch, State, forceUpdate, h } from '@stencil/core';
+import type { AttributeController } from '@utils/attribute-controller';
+import { createAriaAttributeController } from '@utils/attribute-controller';
 import type { AnchorInterface, ButtonInterface } from '@utils/element-interface';
-import type { Attributes } from '@utils/helpers';
-import { inheritAriaAttributes, hasShadowDom } from '@utils/helpers';
+import { hasShadowDom } from '@utils/helpers';
 import { printIonWarning } from '@utils/logging';
 import { createColorClasses, hostContext, openURL } from '@utils/theme';
 
@@ -34,7 +35,7 @@ export class Button implements ComponentInterface, AnchorInterface, ButtonInterf
   private inToolbar = false;
   private formButtonEl: HTMLButtonElement | null = null;
   private formEl: HTMLFormElement | null = null;
-  private inheritedAttributes: Attributes = {};
+  private ariaController?: AttributeController;
 
   @Element() el!: HTMLElement;
 
@@ -158,27 +159,6 @@ export class Button implements ComponentInterface, AnchorInterface, ButtonInterf
    */
   @Event() ionBlur!: EventEmitter<void>;
 
-  /**
-   * This component is used within the `ion-input-password-toggle` component
-   * to toggle the visibility of the password input.
-   * These attributes need to update based on the state of the password input.
-   * Otherwise, the values will be stale.
-   *
-   * @param newValue
-   * @param _oldValue
-   * @param propName
-   */
-  @Watch('aria-checked')
-  @Watch('aria-label')
-  @Watch('aria-pressed')
-  onAriaChanged(newValue: string, _oldValue: string, propName: string) {
-    this.inheritedAttributes = {
-      ...this.inheritedAttributes,
-      [propName]: newValue,
-    };
-    forceUpdate(this);
-  }
-
   /**
    * This is responsible for rendering a hidden native
    * button element inside the associated form. This allows
@@ -220,7 +200,24 @@ export class Button implements ComponentInterface, AnchorInterface, ButtonInterf
     this.inToolbar = !!this.el.closest('ion-buttons');
     this.inListHeader = !!this.el.closest('ion-list-header');
     this.inItem = !!this.el.closest('ion-item') || !!this.el.closest('ion-item-divider');
-    this.inheritedAttributes = inheritAriaAttributes(this.el);
+
+    /**
+     * The ARIA state has to stay live, since `ion-input-password-toggle` rewrites
+     * `aria-label` and `aria-pressed` on its `ion-button` on every toggle. We keep
+     * `aria-disabled` out of the watch because the `<Host>` below renders it from the
+     * `disabled` prop and those writes would clobber a developer's value, and `role` out
+     * because a post-load write stays on the host too, which would put the same role on
+     * two elements in the accessibility tree.
+     */
+    this.ariaController = createAriaAttributeController(this.el, () => forceUpdate(this), ['aria-disabled', 'role']);
+  }
+
+  connectedCallback() {
+    this.ariaController?.init();
+  }
+
+  disconnectedCallback() {
+    this.ariaController?.destroy();
   }
 
   private get hasIconOnly() {
@@ -339,21 +336,8 @@ export class Button implements ComponentInterface, AnchorInterface, ButtonInterf
 
   render() {
     const mode = getIonMode(this);
-    const {
-      buttonType,
-      type,
-      disabled,
-      rel,
-      target,
-      size,
-      href,
-      color,
-      expand,
-      hasIconOnly,
-      shape,
-      strong,
-      inheritedAttributes,
-    } = this;
+    const { buttonType, type, disabled, rel, target, size, href, color, expand, hasIconOnly, shape, strong } = this;
+    const inheritedAttributes = this.ariaController?.attributes ?? {};
     const finalSize = size === undefined && this.inItem ? 'small' : size;
     const TagType = href === undefined ? 'button' : ('a' as any);
     const attrs =
```

**File**: `core/src/components/button/test/a11y/button.e2e.ts` (modified, +173/-0)
```diff
@@ -148,3 +148,176 @@ configs({ directions: ['ltr'] }).forEach(({ title, screenshot, config }) => {
     });
   });
 });
+
+/**
+ * Attribute syncing does not vary across modes or directions
+ */
+configs({ modes: ['md'], directions: ['ltr'] }).forEach(({ title, config }) => {
+  test.describe(title('button: aria attribute sync'), () => {
+    /**
+     * A sample rather than the full ARIA list, since they all go through the same
+     * membership check and looping every one of them only multiplies the run time.
+     */
+    const ariaAttributes = ['aria-checked', 'aria-label', 'aria-pressed', 'aria-description'];
+
+    for (const attr of ariaAttributes) {
+      test(`should sync ${attr} to the native button when it changes on the host`, async ({ page }) => {
+        test.info().annotations.push({
+          type: 'issue',
+          description: 'https://github.com/ionic-team/ionic-framework/issues/30626',
+        });
+
+        await page.setContent(`<ion-button ${attr}="initial">Button</ion-button>`, config);
+
+        const host = page.locator('ion-button');
+        const nativeButton = host.locator('button');
+
+        await expect(nativeButton).toHaveAttribute(attr, 'initial');
+
+        await host.evaluate((el, attr) => el.setAttribute(attr, 'updated'), attr);
+
+        await expect(nativeButton).toHaveAttribute(attr, 'updated');
+      });
+    }
+
+    test('should not sync aria-disabled from the host', async ({ page }) => {
+      await page.setContent(`<ion-button aria-disabled="true">Button</ion-button>`, config);
+
+      const host = page.locator('ion-button');
+      const nativeButton = host.locator('button');
+
+      // The developer-provided value is still copied to the native button at load.
+      await expect(nativeButton).toHaveAttribute('aria-disabled', 'true');
+
+      // The host's `aria-disabled` belongs to the `disabled` prop from here on, so later
+      // writes to it must not reach the native button. We write `aria-label` in the same
+      // batch as a barrier, since once that lands the sync has run.
+      await host.evaluate((el) => {
+        el.setAttribute('aria-disabled', 'false');
+        el.setAttribute('aria-label', 'barrier');
+      });
+      await expect(nativeButton).toHaveAttribute('aria-label', 'barrier');
+      await expect(nativeButton).toHaveAttribute('aria-disabled', 'true');
+
+      // Toggling disabled makes the component write and then clear aria-disabled on the
+      // host. Neither write should reach the native button.
+      await host.evaluate((el: HTMLIonButtonElement) => {
+        el.disabled = true;
+        el.setAttribute('aria-label', 'disabled');
+      });
+      await expect(nativeButton).toHaveAttribute('aria-label', 'disabled');
+      await expect(nativeButton).toHaveAttribute('aria-disabled', 'true');
+
+      await host.evaluate((el: HTMLIonButtonElement) => {
+        el.disabled = false;
+        el.setAttribute('aria-label', 'enabled');
+      });
+      await expect(nativeButton).toHaveAttribute('aria-label', 'enabled');
+      await expect(nativeButton).toHaveAttribute('aria-disabled', 'true');
+    });
+
+    test('should not sync role from the host', async ({ page }) => {
+      await page.setContent(`<ion-button role="switch">Button</ion-button>`, config);
+
+      const host = page.locator('ion-button');
+      const nativeButton = host.locator('button');
+
+      // The initial copy moves role onto the native button, as it always has.
+      await expect(nativeButton).toHaveAttribute('role', 'switch');
+
+      // A later write is only read, so it stays on the host. Copying it as well would put
+      // the same role on both elements, and two of that role in the accessibility tree.
+      await host.evaluate((el) => {
+        el.setAttribute('role', 'checkbox');
+        el.setAttribute('aria-label', 'barrier');
+      });
+      await expect(nativeButton).toHaveAttribute('aria-label', 'barrier');
+      await expect(nativeButton).toHaveAttribute('role', 'switch');
+    });
+
+    test('should keep syncing after the button is detached and reattached', async ({ page }) => {
+      await page.setContent(
+        `
+          <div id="container">
+            <ion-button aria-description="described">Button</ion-button>
+          </div>
+        `,
+        config
+      );
+
+      const host = page.locator('ion-button');
+      const nativeButton = host.locator('button');
+
+      await expect(nativeButton).toHaveAttribute('aria-description', 'described');
+
+      await host.evaluate((el) => {
+        const parent = el.parentElement!;
+        parent.removeChild(el);
+        parent.appendChild(el);
+      });
+      await page.waitForChanges();
+
+      // The value captured at load survives the move.
+      await expect(nativeButton).toHaveAttribute('aria-description', 'described');
+
+      // Updates made after the move must still reach the native button.
+      await host.evaluate((el) => el.setAt
```

**File**: `core/src/components/card/card.tsx` (modified, +20/-6)
```diff
@@ -1,8 +1,8 @@
 import type { ComponentInterface } from '@stencil/core';
-import { Element, Component, Host, Prop, h } from '@stencil/core';
+import { Element, Component, Host, Prop, h, forceUpdate } from '@stencil/core';
+import type { AttributeController } from '@utils/attribute-controller';
+import { createAttributeController } from '@utils/attribute-controller';
 import type { AnchorInterface, ButtonInterface } from '@utils/element-interface';
-import type { Attributes } from '@utils/helpers';
-import { inheritAttributes } from '@utils/helpers';
 import { createColorClasses, openURL } from '@utils/theme';
 
 import { getIonMode } from '../../global/ionic-global';
@@ -23,7 +23,7 @@ import type { RouterDirection } from '../router/utils/interface';
   shadow: true,
 })
 export class Card implements ComponentInterface, AnchorInterface, ButtonInterface {
-  private inheritedAriaAttributes: Attributes = {};
+  private ariaController?: AttributeController;
 
   @Element() el!: HTMLElement;
   /**
@@ -88,7 +88,20 @@ export class Card implements ComponentInterface, AnchorInterface, ButtonInterfac
   @Prop() target: string | undefined;
 
   componentWillLoad() {
-    this.inheritedAriaAttributes = inheritAttributes(this.el, ['aria-label']);
+    /**
+     * Only the initial copy takes the attribute off the host, so an `aria-label` written
+     * after load stays on the host too. That's harmless here, because unlike `ion-item`
+     * the card host renders no role of its own, so nothing reads the leftover copy.
+     */
+    this.ariaController = createAttributeController(this.el, ['aria-label'], () => forceUpdate(this));
+  }
+
+  connectedCallback() {
+    this.ariaController?.init();
+  }
+
+  disconnectedCallback() {
+    this.ariaController?.destroy();
   }
 
   private isClickable(): boolean {
@@ -101,7 +114,8 @@ export class Card implements ComponentInterface, AnchorInterface, ButtonInterfac
     if (!clickable) {
       return [<slot></slot>];
     }
-    const { href, routerAnimation, routerDirection, inheritedAriaAttributes } = this;
+    const { href, routerAnimation, routerDirection } = this;
+    const inheritedAriaAttributes = this.ariaController?.attributes ?? {};
     const TagType = clickable ? (href === undefined ? 'button' : 'a') : ('div' as any);
     const attrs =
       TagType === 'button'
```

**File**: `core/src/components/card/test/a11y/card.e2e.ts` (modified, +127/-0)
```diff
@@ -32,3 +32,130 @@ configs({ directions: ['ltr'] }).forEach(({ title, screenshot, config }) => {
     });
   });
 });
+
+/**
+ * Attribute syncing does not vary across modes or directions
+ */
+configs({ modes: ['md'], directions: ['ltr'] }).forEach(({ title, config }) => {
+  test.describe(title('card: aria attribute sync'), () => {
+    test('should sync aria-label to the native element when it changes on the host', async ({ page }) => {
+      test.info().annotations.push({
+        type: 'issue',
+        description: 'https://github.com/ionic-team/ionic-framework/issues/30626',
+      });
+
+      await page.setContent(`<ion-card button="true" aria-label="label">Card</ion-card>`, config);
+
+      const host = page.locator('ion-card');
+      const nativeCard = host.locator('[part="native"]');
+
+      await expect(nativeCard).toHaveAttribute('aria-label', 'label');
+
+      await host.evaluate((el) => el.setAttribute('aria-label', 'updated'));
+
+      await expect(nativeCard).toHaveAttribute('aria-label', 'updated');
+    });
+
+    test('should keep syncing after the card is detached and reattached', async ({ page }) => {
+      await page.setContent(
+        `
+          <div id="container">
+            <ion-card button="true" aria-label="label">Card</ion-card>
+          </div>
+        `,
+        config
+      );
+
+      const host = page.locator('ion-card');
+      const nativeCard = host.locator('[part="native"]');
+
+      await expect(nativeCard).toHaveAttribute('aria-label', 'label');
+
+      await host.evaluate((el) => {
+        const parent = el.parentElement!;
+        parent.removeChild(el);
+        parent.appendChild(el);
+      });
+      await page.waitForChanges();
+
+      // The value captured at load survives the move.
+      await expect(nativeCard).toHaveAttribute('aria-label', 'label');
+
+      // Updates made after the move must still reach the native element.
+      await host.evaluate((el) => el.setAttribute('aria-label', 'updated'));
+      await expect(nativeCard).toHaveAttribute('aria-label', 'updated');
+
+      // So must one made while it was detached, when nothing is watching.
+      await host.evaluate((el) => {
+        const parent = el.parentElement!;
+        parent.removeChild(el);
+        el.setAttribute('aria-label', 'while detached');
+        parent.appendChild(el);
+      });
+      await expect(nativeCard).toHaveAttribute('aria-label', 'while detached');
+    });
+
+    test('should sync updates, empty values and removals after the initial copy', async ({ page }) => {
+      await page.setContent(`<ion-card button="true" aria-label="initial">Card</ion-card>`, config);
+
+      const host = page.locator('ion-card');
+      const nativeCard = host.locator('[part="native"]');
+
+      // The initial copy moves the value from the host to the native element.
+      await expect(host).not.toHaveAttribute('aria-label');
+      await expect(nativeCard).toHaveAttribute('aria-label', 'initial');
+
+      // Post-load writes stay on the host and are copied to the native element.
+      await host.evaluate((el) => el.setAttribute('aria-label', 'second'));
+      await expect(host).toHaveAttribute('aria-label', 'second');
+      await expect(nativeCard).toHaveAttribute('aria-label', 'second');
+
+      // An empty string is a valid ARIA attribute value.
+      await host.evaluate((el) => el.setAttribute('aria-label', ''));
+      await expect(nativeCard).toHaveAttribute('aria-label', '');
+
+      // A removal of a post-load write does reach the native element.
+      await host.evaluate((el) => el.removeAttribute('aria-label'));
+      await expect(host).not.toHaveAttribute('aria-label');
+      await expect(nativeCard).not.toHaveAttribute('aria-label');
+    });
+
+    test('should apply aria-label to the native element when the card becomes clickable', async ({ page }) => {
+      await page.setContent(`<ion-card aria-label="label">Card</ion-card>`, config);
+
+      const host = page.locator('ion-card');
+      await page.waitForChanges();
+
+      // A card that is neither a button nor a link renders no native element.
+      await expect(host.locator('[part="native"]')).toHaveCount(0);
+
+      // Both `button` and `href` can be set after load, and the native element that
+      // appears then still needs the label copied at load.
+      await host.evaluate((el: HTMLIonCardElement) => (el.button = true));
+
+      await expect(host.locator('[part="native"]')).toHaveAttribute('aria-label', 'label');
+    });
+
+    test('should not sync ARIA attributes other than aria-label', async ({ page }) => {
+      await page.setContent(`<ion-card button="true" aria-label="label">Card</ion-card>`, config);
+
+      const host = page.locator('ion-card');
+      const nativeCard = host.locator('[part="native"]');
+
+      /**
+       * Only `aria-label` should reach the native element. A wider watch set would put
+       * attributes there after load that the elemen
```

**File**: `core/src/components/item/item.tsx` (modified, +16/-5)
```diff
@@ -1,8 +1,9 @@
 import type { ComponentInterface } from '@stencil/core';
 import { Build, Component, Element, Host, Listen, Prop, State, Watch, forceUpdate, h } from '@stencil/core';
+import type { AttributeController } from '@utils/attribute-controller';
+import { createAttributeController } from '@utils/attribute-controller';
 import type { AnchorInterface, ButtonInterface } from '@utils/element-interface';
-import type { Attributes } from '@utils/helpers';
-import { inheritAttributes, raf } from '@utils/helpers';
+import { raf } from '@utils/helpers';
 import { createColorClasses, hostContext, openURL } from '@utils/theme';
 import { chevronForward } from 'ionicons/icons';
 
@@ -35,9 +36,9 @@ const INDICATOR_CONTROL_SELECTOR = 'ion-checkbox, ion-radio, ion-toggle';
 export class Item implements ComponentInterface, AnchorInterface, ButtonInterface {
   private labelColorStyles = {};
   private itemStyles = new Map<string, CssClassMap>();
-  private inheritedAriaAttributes: Attributes = {};
   private indicatorControlObserver?: MutationObserver;
   private didLoad = false;
+  private ariaController?: AttributeController;
 
   @Element() el!: HTMLIonItemElement;
 
@@ -180,10 +181,18 @@ export class Item implements ComponentInterface, AnchorInterface, ButtonInterfac
       this.watchForIndicatorControls();
       this.updateInteractivityOnSlotChange();
     }
+
+    this.ariaController?.init();
   }
 
   componentWillLoad() {
-    this.inheritedAriaAttributes = inheritAttributes(this.el, ['aria-label']);
+    /**
+     * Only the initial copy takes the attribute off the host, so an `aria-label` written
+     * after load names both the native element and the Host, which is a `listitem` when
+     * the item is in an `ion-list`. The two names always agree, so a screen reader just
+     * reads it twice.
+     */
+    this.ariaController = createAttributeController(this.el, ['aria-label'], () => forceUpdate(this));
   }
 
   componentDidLoad() {
@@ -203,6 +212,8 @@ export class Item implements ComponentInterface, AnchorInterface, ButtonInterfac
       this.indicatorControlObserver.disconnect();
       this.indicatorControlObserver = undefined;
     }
+
+    this.ariaController?.destroy();
   }
 
   private totalNestedInputs() {
@@ -355,9 +366,9 @@ export class Item implements ComponentInterface, AnchorInterface, ButtonInterfac
       target,
       routerAnimation,
       routerDirection,
-      inheritedAriaAttributes,
       multipleInputs,
     } = this;
+    const inheritedAriaAttributes = this.ariaController?.attributes ?? {};
     const childStyles = {} as StyleEventDetail;
     const mode = getIonMode(this);
     const clickable = this.isClickable();
```

**File**: `core/src/components/item/test/a11y/item.e2e.ts` (modified, +112/-0)
```diff
@@ -153,3 +153,115 @@ configs({ directions: ['ltr'] }).forEach(({ config, screenshot, title }) => {
     });
   });
 });
+
+/**
+ * Attribute syncing does not vary across modes or directions
+ */
+configs({ modes: ['md'], directions: ['ltr'] }).forEach(({ title, config }) => {
+  test.describe(title('item: aria attribute sync'), () => {
+    test('should sync aria-label to the native element when it changes on the host', async ({ page }) => {
+      test.info().annotations.push({
+        type: 'issue',
+        description: 'https://github.com/ionic-team/ionic-framework/issues/30626',
+      });
+
+      await page.setContent(`<ion-item button="true" aria-label="label">Item</ion-item>`, config);
+
+      const host = page.locator('ion-item');
+      const nativeItem = host.locator('[part="native"]');
+
+      await expect(nativeItem).toHaveAttribute('aria-label', 'label');
+
+      await host.evaluate((el) => el.setAttribute('aria-label', 'updated'));
+
+      await expect(nativeItem).toHaveAttribute('aria-label', 'updated');
+    });
+
+    test('should keep syncing after the item is detached and reattached', async ({ page }) => {
+      await page.setContent(
+        `
+          <div id="container">
+            <ion-item button="true" aria-label="label">Item</ion-item>
+          </div>
+        `,
+        config
+      );
+
+      const host = page.locator('ion-item');
+      const nativeItem = host.locator('[part="native"]');
+
+      await expect(nativeItem).toHaveAttribute('aria-label', 'label');
+
+      await host.evaluate((el) => {
+        const parent = el.parentElement!;
+        parent.removeChild(el);
+        parent.appendChild(el);
+      });
+      await page.waitForChanges();
+
+      // The value captured at load survives the move.
+      await expect(nativeItem).toHaveAttribute('aria-label', 'label');
+
+      // Updates made after the move must still reach the native element.
+      await host.evaluate((el) => el.setAttribute('aria-label', 'updated'));
+      await expect(nativeItem).toHaveAttribute('aria-label', 'updated');
+
+      // So must one made while it was detached, when nothing is watching.
+      await host.evaluate((el) => {
+        const parent = el.parentElement!;
+        parent.removeChild(el);
+        el.setAttribute('aria-label', 'while detached');
+        parent.appendChild(el);
+      });
+      await expect(nativeItem).toHaveAttribute('aria-label', 'while detached');
+    });
+
+    test('should sync updates, empty values and removals after the initial copy', async ({ page }) => {
+      await page.setContent(`<ion-item button="true" aria-label="initial">Item</ion-item>`, config);
+
+      const host = page.locator('ion-item');
+      const nativeItem = host.locator('[part="native"]');
+
+      // The initial copy moves the value from the host to the native element.
+      await expect(host).not.toHaveAttribute('aria-label');
+      await expect(nativeItem).toHaveAttribute('aria-label', 'initial');
+
+      // Post-load writes stay on the host and are copied to the native element.
+      await host.evaluate((el) => el.setAttribute('aria-label', 'second'));
+      await expect(host).toHaveAttribute('aria-label', 'second');
+      await expect(nativeItem).toHaveAttribute('aria-label', 'second');
+
+      // An empty string is a valid ARIA attribute value.
+      await host.evaluate((el) => el.setAttribute('aria-label', ''));
+      await expect(nativeItem).toHaveAttribute('aria-label', '');
+
+      // A removal of a post-load write does reach the native element.
+      await host.evaluate((el) => el.removeAttribute('aria-label'));
+      await expect(host).not.toHaveAttribute('aria-label');
+      await expect(nativeItem).not.toHaveAttribute('aria-label');
+    });
+
+    test('should not sync ARIA attributes other than aria-label', async ({ page }) => {
+      await page.setContent(`<ion-item button="true" aria-label="label">Item</ion-item>`, config);
+
+      const host = page.locator('ion-item');
+      const nativeItem = host.locator('[part="native"]');
+
+      /**
+       * Only `aria-label` should reach the native element. An `ion-item` in a list renders
+       * `role="listitem"` on its own Host, so watching `role` would copy that onto the
+       * native button.
+       */
+      await host.evaluate((el) => {
+        el.setAttribute('role', 'presentation');
+        el.setAttribute('aria-describedby', 'hint');
+        // Written in the same batch as a barrier, since once it lands the sync has run.
+        el.setAttribute('aria-label', 'updated');
+      });
+
+      await expect(nativeItem).toHaveAttribute('aria-label', 'updated');
+      await expect(nativeItem).not.toHaveAttribute('aria-describedby');
+      await expect(nativeItem).not.toHaveAttribute('role');
+    });
+  });
+});
```

**File**: `core/src/utils/attribute-controller.ts` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+import { win } from '@utils/browser';
+import type { Attributes } from '@utils/helpers';
+import { ariaAttributes, inheritAttributes } from '@utils/helpers';
+
+/**
+ * Copies a set of attributes off the host element so they can be applied to an element
+ * inside the shadow root, then keeps that copy in sync as the host attributes change.
+ * Using `inheritAttributes` alone copies once at load, so anything written to the host
+ * afterwards never reaches the element the assistive technology reads.
+ *
+ * Create the controller in `componentWillLoad`. It takes the initial copy and starts
+ * watching right away, so `init()` is only needed to resume after a move.
+ *
+ * Two things to know before adopting it. Only the initial copy removes the attributes
+ * from the host, so a value written after load sits on the host as well as on the
+ * element it is applied to, which matters if the host has a role of its own. And an
+ * attribute from the initial markup can never be removed, only overwritten, since the
+ * copy already took it off the host and a `removeAttribute` there fires no mutation.
+ * An empty string works for `aria-label` and friends, but a token-valued attribute
+ * has to be set to its default instead, so `aria-pressed="false"` rather than empty.
+ *
+ * @internal
+ * @param el The host element to copy from and watch.
+ * @param attributes The attributes to copy and watch.
+ * @param onChange Called after `attributes` changes, so the component can re-render.
+ * @param hostOwnedAttributes Attributes copied at load but not watched. Use it for
+ * attributes the component renders on its own `<Host>`, since a later change to one of
+ * those is the component's own write, and for attributes that would put a second node in
+ * the accessibility tree if the host kept a copy alongside the one we apply.
+ */
+export const createAttributeController = (
+  el: HTMLElement,
+  attributes: string[],
+  onChange: () => void,
+  hostOwnedAttributes: string[] = []
+): AttributeController => {
+  let inherited: Attributes = inheritAttributes(el, attributes);
+  let observer: MutationObserver | undefined;
+
+  const watchedAttributes = attributes.filter((attr) => !hostOwnedAttributes.includes(attr));
+
+  /**
+   * The names still on the host, which is everything written after load. The initial
+   * copy removes what it captures, so a missing attribute only counts as a removal
+   * when its name is in here.
+   */
+  const hostWritten = new Set<string>();
+
+  const setPresence = (name: string, value: string | null) => {
+    if (value === null) {
+      hostWritten.delete(name);
+    } else {
+      hostWritten.add(name);
+    }
+  };
+
+  /**
+   * Nothing is watching while the host is out of the tree, since `disconnectedCallback`
+   * calls `destroy()`, and `forceUpdate` is a no-op on a disconnected host anyway. So
+   * the host has to be re-read on the way back in.
+   */
+  const readMissedChanges = () => {
+    const changed: Attributes = {};
+
+    for (const name of watchedAttributes) {
+      const value = el.getAttribute(name);
+      const wasOnHost = hostWritten.has(name);
+
+      setPresence(name, value);
+
+      /**
+       * An attribute that was never written to the host is missing because the initial
+       * copy took it, not because the developer cleared it.
+       */
+      if ((value === null && !wasOnHost) || value === inherited[name]) {
+        continue;
+      }
+
+      changed[name] = value;
+    }
+
+    if (Object.keys(changed).length > 0) {
+      inherited = { ...inherited, ...changed };
+      onChange();
+    }
+  };
+
+  const init = () => {
+    // There is no MutationObserver in SSR or the hydrate build.
+    if (observer !== undefined || watchedAttributes.length === 0 || win === undefined || !('MutationObserver' in win)) {
+      return;
+    }
+
+    readMissedChanges();
+
+    observer = new MutationObserver((mutations) => {
+      const changed: Attributes = {};
+
+      for (const mutation of mutations) {
+        const name = mutation.attributeName!;
+        // A removed attribute reads back as null, which clears it from the element the
+        // values are spread onto.
+        const value = el.getAttribute(name);
+
+        setPresence(name, value);
+        changed[name] = value;
+      }
+
+      inherited = { ...inherited, ...changed };
+      onChange();
+    });
+
+    observer.observe(el, { attributeFilter: watchedAttributes });
+  };
+
+  const destroy = () => {
+    observer?.disconnect();
+    observer = undefined;
+  };
+
+  /**
+   * Has to run after the initial copy, because that copy removes the attributes from the
+   * host and an observer armed any earlier would read the removal as a developer clearing
+   * them.
+   */
+  init();
+
+  return {
+    get attributes() {
+      return inherited;
+    },
+    init,
+    destroy,
+  };
+};
+
+/**
+ * The `createAttributeController` equivalent of `inheritAriaAttributes`, which 
```

**File**: `core/src/utils/helpers.ts` (modified, +5/-3)
```diff
@@ -99,8 +99,8 @@ export type Attributes = { [key: string]: any };
  * helper function should be called in componentWillLoad and assigned to a variable
  * that is later used in the render function.
  *
- * This does not need to be reactive as changing attributes on the host element
- * does not trigger a re-render.
+ * This copies once. Use `createAttributeController` instead when the attributes can
+ * change after load, since a host attribute change does not trigger a re-render.
  */
 export const inheritAttributes = (el: HTMLElement, attributes: string[] = []) => {
   const attributeObject: Attributes = {};
@@ -122,8 +122,10 @@ export const inheritAttributes = (el: HTMLElement, attributes: string[] = []) =>
  * List of available ARIA attributes + `role`.
  * Removed deprecated attributes.
  * https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes
+ *
+ * @internal Exported for `attribute-controller.ts`, which needs the same set.
  */
-const ariaAttributes = [
+export const ariaAttributes = [
   'role',
   'aria-activedescendant',
   'aria-atomic',
```

---

### Incident Patch 15: `8a713ab8` (2026-09-14)
**Commit Message**: fix(modal): prevent ion-content collapsing at content-based heights (#31413)

Issue number: resolves #31149

---------

## What is the current behavior?
Setting `--height` to any of the following on an `ion-modal` containing
an `ion-content` results in the `ion-content` collapsing to `0` height:
`auto`, `fit-content`, `min-content`, or `max-content`.

## What is the new behavior?
- Checks if modal `--height` is set to `auto`, `fit-content`,
`min-content,` or `max-content` and styles the `ion-content`, `ion-nav`
and `.ion-page` appropriately if so
- Watches for changes to `--height` on `ion-modal` to dynamically add
and remove the class that sizes the `ion-content` to its content
- Updates modal `--max-height` to `100%` which allows the content to
scroll instead of overflowing and being clipped
- Adds a preview test for different scenarios where `ion-modal` has
`--height` set
- Adds e2e tests for the various `--height` scenarios
- Updates `safe-area-utils` to account for the new content-sized modals
- Adds spec tests for all new functions

## Does this introduce a breaking change?

- [ ] Yes
- [x] No

## Other information

**Dev build**: `9.0.1-dev.11788212611.154b1596`

**Previews*

**File**: `core/src/components.d.ts` (modified, +1/-1)
```diff
@@ -867,7 +867,7 @@ export namespace Components {
          */
         "getScrollElement": () => Promise<HTMLElement>;
         /**
-          * Recalculate content dimensions. Called by overlays (e.g., popover) when sibling elements like headers or footers have finished rendering and their heights are available, ensuring accurate offset-top calculations.
+          * Recalculates the content dimensions and whether it should size itself to its content. Called by overlays when something they own changes, such as a header finishing its render or `--height` being updated.
          */
         "recalculateDimensions": () => Promise<void>;
         /**
```

**File**: `core/src/components/content/content.tsx` (modified, +61/-4)
```diff
@@ -8,13 +8,15 @@ import {
   Listen,
   Method,
   Prop,
+  State,
   Watch,
   forceUpdate,
   h,
   readTask,
 } from '@stencil/core';
 import { componentOnReady, hasLazyBuild, inheritAriaAttributes } from '@utils/helpers';
 import type { Attributes } from '@utils/helpers';
+import { getOverlaySizeType } from '@utils/overlays';
 import { isPlatform } from '@utils/platform';
 import { isRTL } from '@utils/rtl';
 import { createColorClasses, hostContext } from '@utils/theme';
@@ -77,6 +79,11 @@ export class Content implements ComponentInterface {
 
   @Element() el!: HTMLIonContentElement;
 
+  /**
+   * Whether the host is sized to its content.
+   */
+  @State() sizeToContent = false;
+
   /**
    * The color to use from your application's color palette.
    * Default options are: `"primary"`, `"secondary"`, `"tertiary"`, `"success"`, `"warning"`, `"danger"`, `"light"`, `"medium"`, and `"dark"`.
@@ -148,6 +155,7 @@ export class Content implements ComponentInterface {
 
   componentWillLoad() {
     this.inheritedAttributes = inheritAriaAttributes(this.el);
+    this.sizeToContent = this.readSizeToContent();
   }
 
   connectedCallback() {
@@ -190,6 +198,7 @@ export class Content implements ComponentInterface {
 
     // Re-observe on reattach, since componentDidLoad only fires once.
     this.setupFullscreenResizeObserver();
+    this.updateSizeToContent();
   }
 
   componentDidLoad() {
@@ -258,6 +267,17 @@ export class Content implements ComponentInterface {
     this.fullscreenResizeObserver.observe(this.el);
   }
 
+  /**
+   * Picks up an overlay that is no longer sized the way the last render
+   * assumed, re-rendering only when the answer changes. Read in a `readTask`
+   * because resolving the custom property forces a style recalculation.
+   */
+  private updateSizeToContent() {
+    readTask(() => {
+      this.sizeToContent = this.readSizeToContent();
+    });
+  }
+
   private destroyFullscreenResizeObserver() {
     if (this.fullscreenResizeObserver !== undefined) {
       this.fullscreenResizeObserver.disconnect();
@@ -310,6 +330,34 @@ export class Content implements ComponentInterface {
     return forceOverscroll === undefined ? mode === 'ios' && isPlatform('ios') : forceOverscroll;
   }
 
+  /**
+   * Reads whether to size the component to its content height. Forces a style
+   * recalculation, so it belongs in a read task or before the first render.
+   *
+   * This applies inside popovers and modals with a content-based `--height`,
+   * where the overlay does not provide the content with a definite height
+   * to fill.
+   *
+   * Only `--height` is consulted. Styling the wrapper directly, such as
+   * `ion-modal::part(content) { height: fit-content; }`, does not change
+   * `--height` and therefore cannot be observed. `--height` is the only
+   * supported way to opt into content-based sizing.
+   */
+  private readSizeToContent() {
+    if (hostContext('ion-popover', this.el)) {
+      return true;
+    }
+
+    const modal = this.el.closest('ion-modal');
+    if (modal === null) {
+      return false;
+    }
+
+    const height = getComputedStyle(modal).getPropertyValue('--height');
+
+    return getOverlaySizeType(height) === 'content';
+  }
+
   private resize() {
     /**
      * Only force update if the component is rendered in a browser context.
@@ -320,6 +368,13 @@ export class Content implements ComponentInterface {
      * TODO: Remove if STENCIL-834 determines Stencil will account for this.
      */
     if (Build.isBrowser) {
+      /**
+       * A window resize can cross a media query that changes the modal's
+       * `--height`. The content's own offsets are unchanged, so neither branch
+       * below re-renders and the class from the last render would go stale.
+       */
+      this.updateSizeToContent();
+
       if (this.fullscreen) {
         readTask(() => this.readDimensions());
       } else if (this.cTop !== 0 || this.cBottom !== 0) {
@@ -330,14 +385,16 @@ export class Content implements ComponentInterface {
   }
 
   /**
-   * Recalculate content dimensions. Called by overlays (e.g., popover) when
-   * sibling elements like headers or footers have finished rendering and their
-   * heights are available, ensuring accurate offset-top calculations.
+   * Recalculates the content dimensions and whether it should size itself to
+   * its content. Called by overlays when something they own changes, such as
+   * a header finishing its render or `--height` being updated.
+   *
    * @internal
    */
   @Method()
   async recalculateDimensions(): Promise<void> {
     readTask(() => this.readDimensions());
+    this.updateSizeToContent();
   }
 
   private readDimensions() {
@@ -538,7 +595,7 @@ export class Content implements ComponentInterface {
         class={createColorClasses(this.color, {
           [mode]: true,
           'content-fullscreen': this.fullscreen,
-          'content-sizing': hostContext('ion-popover', this.el),
+          'content-sizing'
```

**File**: `core/src/components/modal/modal.scss` (modified, +14/-1)
```diff
@@ -27,7 +27,12 @@
   --max-width: auto;
   --height: 100%;
   --min-height: auto;
-  --max-height: auto;
+  /**
+   * Clamps a content-sized `--height` (auto, fit-content, ...) to the
+   * overlay, giving the wrapper's flex children something to shrink
+   * toward so `ion-content` scrolls instead of overflowing.
+   */
+  --max-height: 100%;
   --overflow: hidden;
   --border-radius: 0;
   --border-width: 0;
@@ -87,8 +92,16 @@ ion-backdrop {
 /**
  * The wrapper receives programmatic focus for screen readers but should not
  * show a visible focus ring, which is meant only for keyboard navigation.
+ *
+ * A flex layout is required for the wrapper to size itself to its content
+ * when the modal is content-sized (`--height` is auto, fit-content, ...).
+ * This makes it so that the content can scroll when it overflows the wrapper.
  */
 .modal-wrapper {
+  display: flex;
+
+  flex-direction: column;
+
   outline: none;
 }
 
```

**File**: `core/src/components/modal/modal.tsx` (modified, +32/-4)
```diff
@@ -53,10 +53,10 @@ import {
   clearSafeAreaOverrides,
   getRootSafeAreaTop,
   onRootSafeAreaTopChange,
-  hasCustomModalDimensions,
+  getModalCoveredAxes,
   type ModalSafeAreaContext,
 } from './safe-area-utils';
-import { setCardStatusBarDark, setCardStatusBarDefault } from './utils';
+import { onModalHeightChange, setCardStatusBarDark, setCardStatusBarDefault } from './utils';
 
 // TODO(FW-2832): types
 
@@ -114,6 +114,7 @@ export class Modal implements ComponentInterface, OverlayInterface {
   private viewTransitionAnimation?: Animation;
   private resizeTimeout?: any;
   private unsubscribeRootSafeAreaTop?: () => void;
+  private unsubscribeHeightChange?: () => void;
   // True from the first safe-area write in `present()` until the enter
   // animation settles. A position-based read in that window is not the rest position.
   private isPresenting = false;
@@ -1487,7 +1488,7 @@ export class Modal implements ComponentInterface, OverlayInterface {
   /**
    * Creates the context object for safe-area utilities.
    *
-   * `hasCustomDimensions` is only set by `setInitialSafeAreaOverrides()`
+   * `coveredAxes` is only set by `setInitialSafeAreaOverrides()`
    * because it is only read by `getInitialSafeAreaConfig()`. Other callers
    * (resize handler, post-animation update, fullscreen-padding apply) would
    * pay a `getComputedStyle()` cost for a value they never consult.
@@ -1502,6 +1503,28 @@ export class Modal implements ComponentInterface, OverlayInterface {
     };
   }
 
+  /**
+   * Keeps the content's sizing in sync with `--height`. The content reads the
+   * property to determine whether it should size itself to its content, and
+   * changes to `--height` on an ancestor or the root can change that behavior
+   * without changing the modal itself.
+   */
+  private watchHeightForContent(): void {
+    /**
+     * A sheet's height comes from its breakpoints, so its content never sizes
+     * itself to `--height`. Watching it would cause the drag to recalculate on
+     * every frame.
+     */
+    if (this.isSheetModal) {
+      return;
+    }
+
+    this.unsubscribeHeightChange?.();
+    this.unsubscribeHeightChange = onModalHeightChange(this.el, () => {
+      this.el.querySelectorAll('ion-content').forEach((contentEl) => contentEl.recalculateDimensions());
+    });
+  }
+
   /**
    * Sets initial safe-area overrides before modal animation.
    * Called in present() before animation starts.
@@ -1515,11 +1538,13 @@ export class Modal implements ComponentInterface, OverlayInterface {
   private setInitialSafeAreaOverrides(): void {
     const context: ModalSafeAreaContext = {
       ...this.getSafeAreaContext(),
-      hasCustomDimensions: hasCustomModalDimensions(this.el),
+      coveredAxes: getModalCoveredAxes(this.el),
     };
     const safeAreaConfig = getInitialSafeAreaConfig(context);
     applySafeAreaOverrides(this.el, safeAreaConfig);
 
+    this.watchHeightForContent();
+
     // Set the internal offset property with the resolved root safe-area-top value
     if (context.isSheetModal) {
       this.updateSheetOffsetTop();
@@ -1646,6 +1671,9 @@ export class Modal implements ComponentInterface, OverlayInterface {
     this.unsubscribeRootSafeAreaTop?.();
     this.unsubscribeRootSafeAreaTop = undefined;
 
+    this.unsubscribeHeightChange?.();
+    this.unsubscribeHeightChange = undefined;
+
     // Remove internal sheet offset property
     this.el.style.removeProperty('--ion-modal-offset-top');
 
```

**File**: `core/src/components/modal/safe-area-utils.spec.ts` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+import { getModalCoveredAxes } from './safe-area-utils';
+
+/**
+ * Tests `getModalCoveredAxes()` across fullscreen, fixed-size, and
+ * content-sized modals. The helper uses computed CSS sizes when both
+ * dimensions are fullscreen and measures the rendered wrapper otherwise,
+ * so the tests mock both sources of size information as needed.
+ */
+describe('modal: getModalCoveredAxes', () => {
+  const VIEWPORT_WIDTH = window.innerWidth;
+  const VIEWPORT_HEIGHT = window.innerHeight;
+
+  let host: HTMLElement;
+  let wrapper: HTMLElement;
+  let hiddenDuringMeasurement: boolean;
+  let originalGetComputedStyle: PropertyDescriptor | undefined;
+  let sizes: Record<string, string>;
+
+  const setSize = (width: string, height: string) => {
+    sizes = { '--width': width, '--height': height };
+  };
+
+  const setWrapperBox = (width: number, height: number) => {
+    wrapper.getBoundingClientRect = () => {
+      hiddenDuringMeasurement = host.classList.contains('overlay-hidden');
+      return { width, height } as DOMRect;
+    };
+  };
+
+  beforeEach(() => {
+    host = document.createElement('ion-modal');
+    host.classList.add('overlay-hidden');
+    document.body.appendChild(host);
+
+    wrapper = document.createElement('div');
+    wrapper.classList.add('modal-wrapper');
+    host.attachShadow({ mode: 'open' }).appendChild(wrapper);
+
+    hiddenDuringMeasurement = true;
+    setWrapperBox(0, 0);
+
+    /**
+     * Replace the mocked `getComputedStyle` getter so tests can control
+     * the modal's `--width` and `--height` values.
+     */
+    sizes = {};
+    originalGetComputedStyle = Object.getOwnPropertyDescriptor(globalThis, 'getComputedStyle');
+    Object.defineProperty(globalThis, 'getComputedStyle', {
+      value: () => ({ getPropertyValue: (property: string) => sizes[property] ?? '' }),
+      configurable: true,
+      writable: true,
+    });
+  });
+
+  afterEach(() => {
+    if (originalGetComputedStyle) {
+      Object.defineProperty(globalThis, 'getComputedStyle', originalGetComputedStyle);
+    }
+    host.remove();
+  });
+
+  it('should cover both axes when the sizes span the viewport', () => {
+    setSize('100%', '100%');
+
+    expect(getModalCoveredAxes(host)).toEqual({ vertical: true, horizontal: true });
+  });
+
+  it('should cover neither axis for a dialog that stays clear of the viewport edges', () => {
+    setSize('300px', '200px');
+    setWrapperBox(300, 200);
+
+    expect(getModalCoveredAxes(host)).toEqual({ vertical: false, horizontal: false });
+  });
+
+  it('should cover only the horizontal axis for a full-width dialog that fits its content', () => {
+    setSize('100%', 'fit-content');
+    setWrapperBox(VIEWPORT_WIDTH, 244);
+
+    expect(getModalCoveredAxes(host)).toEqual({ vertical: false, horizontal: true });
+  });
+
+  it('should cover only the vertical axis for a narrow modal that fills the viewport', () => {
+    setSize('300px', 'fit-content');
+    setWrapperBox(300, VIEWPORT_HEIGHT);
+
+    expect(getModalCoveredAxes(host)).toEqual({ vertical: true, horizontal: false });
+  });
+
+  it('should cover an axis whose definite size reaches the viewport', () => {
+    setSize('300px', `${VIEWPORT_HEIGHT}px`);
+    setWrapperBox(300, VIEWPORT_HEIGHT);
+
+    expect(getModalCoveredAxes(host)).toEqual({ vertical: true, horizontal: false });
+  });
+
+  it('should allow a few pixels of tolerance when comparing to the viewport', () => {
+    setSize('300px', 'fit-content');
+    setWrapperBox(300, VIEWPORT_HEIGHT - 4);
+
+    expect(getModalCoveredAxes(host)).toEqual({ vertical: true, horizontal: false });
+  });
+
+  it('should temporarily show a hidden modal while measuring and hide it again', () => {
+    setSize('300px', 'fit-content');
+    setWrapperBox(300, VIEWPORT_HEIGHT);
+
+    getModalCoveredAxes(host);
+
+    expect(hiddenDuringMeasurement).toBe(false);
+    expect(host.classList.contains('overlay-hidden')).toBe(true);
+  });
+
+  it('should not change visibility when measuring an already visible modal', () => {
+    host.classList.remove('overlay-hidden');
+    setSize('300px', 'fit-content');
+    setWrapperBox(300, 244);
+
+    getModalCoveredAxes(host);
+
+    expect(host.classList.contains('overlay-hidden')).toBe(false);
+  });
+
+  it('should not measure when both sizes span the viewport', () => {
+    setSize('100%', '100vh');
+    setWrapperBox(0, 0);
+
+    expect(getModalCoveredAxes(host)).toEqual({ vertical: true, horizontal: true });
+    expect(hiddenDuringMeasurement).toBe(true);
+  });
+});
```

**File**: `core/src/components/modal/safe-area-utils.ts` (modified, +90/-95)
```diff
@@ -1,5 +1,6 @@
 import { win } from '@utils/browser';
-import { raf } from '@utils/helpers';
+import { onCustomPropertyChange, raf } from '@utils/helpers';
+import { getOverlaySizeType } from '@utils/overlays';
 
 type SafeAreaValue = '0px' | 'inherit';
 
@@ -14,6 +15,17 @@ export interface SafeAreaConfig {
   right: SafeAreaValue;
 }
 
+/**
+ * Indicates whether the modal spans the viewport on each axis.
+ *
+ * `vertical` means the modal reaches both the top and bottom edges.
+ * `horizontal` means the modal reaches both the left and right edges.
+ */
+export interface ModalCoveredAxes {
+  vertical: boolean;
+  horizontal: boolean;
+}
+
 /**
  * Context information about the modal used to determine safe-area behavior.
  */
@@ -23,50 +35,23 @@ export interface ModalSafeAreaContext {
   presentingElement?: HTMLElement;
   breakpoints?: number[];
   currentBreakpoint?: number;
+
   /**
-   * Only consulted by `getInitialSafeAreaConfig()`. Callers that only use the
-   * context for non-initial paths can omit this. See `hasCustomModalDimensions()`.
+   * Only used by `getInitialSafeAreaConfig()` to predict safe-area
+   * requirements before the modal is presented. Callers that only use
+   * the context for non-initial paths can omit this.
    */
-  hasCustomDimensions?: boolean;
+  coveredAxes?: ModalCoveredAxes;
 }
 
-/**
- * These thresholds match the SCSS media query breakpoints in modal.vars.scss
- * that trigger the centered dialog layout (non-fullscreen modal).
- *
- * SCSS defines two height breakpoints: $modal-inset-min-height-small (600px)
- * and $modal-inset-min-height-large (768px). We use the smaller one because
- * that's the threshold where the modal transitions from fullscreen to centered
- * dialog — the larger breakpoint only increases the dialog's height.
- */
-const MODAL_INSET_MIN_WIDTH = 768;
-const MODAL_INSET_MIN_HEIGHT = 600;
 const EDGE_THRESHOLD = 5;
 
-/**
- * CSS values for `--width` / `--height` that are treated as fullscreen
- * (modal touches the corresponding screen edges). Empty string means the
- * property was not overridden. See `hasCustomModalDimensions()`.
- */
-const FULLSCREEN_SIZE_VALUES = new Set(['', '100%', '100vw', '100vh', '100dvw', '100dvh', '100svw', '100svh']);
-
 /**
  * Cache for resolved root safe-area-top value, invalidated once per frame.
  */
 let cachedRootSafeAreaTop: number | null = null;
 let cacheInvalidationScheduled = false;
 
-/**
- * Determines if the current viewport meets the CSS media query conditions
- * that cause regular modals to render as centered dialogs instead of fullscreen.
- * Matches: @media (min-width: 768px) and (min-height: 600px)
- */
-const isCenteredDialogViewport = (): boolean => {
-  if (!win) return false;
-  return win.matchMedia(`(min-width: ${MODAL_INSET_MIN_WIDTH}px) and (min-height: ${MODAL_INSET_MIN_HEIGHT}px)`)
-    .matches;
-};
-
 /**
  * Resolves the current root --ion-safe-area-top value to pixels.
  * Uses a temporary element because getComputedStyle on :root returns
@@ -105,59 +90,72 @@ export const getRootSafeAreaTop = (): number => {
 };
 
 /**
- * Calls back when the resolved root `--ion-safe-area-top` changes, which no
- * event and no window resize covers. The probe's height tracks the variable, so
- * a change to it becomes a size change the observer can see.
+ * Calls back when the resolved root `--ion-safe-area-top` changes. The value
+ * the caller already applied is passed as the baseline, so a change between
+ * that read and the observer starting is still reported.
  */
 export const onRootSafeAreaTopChange = (callback: (safeAreaTop: number) => void): (() => void) => {
-  const doc = win?.document;
-  if (!doc?.body || typeof ResizeObserver === 'undefined') {
-    return () => undefined;
-  }
+  return onCustomPropertyChange(win?.document?.body, '--ion-safe-area-top', callback, getRootSafeAreaTop());
+};
 
-  const probe = doc.createElement('div');
-  probe.style.cssText =
-    'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;width:0;' +
-    'height:var(--ion-safe-area-top,0px);';
-  doc.body.appendChild(probe);
+/**
+ * Determines which viewport axes the modal spans so safe-area requirements
+ * can be predicted independently for each axis.
+ *
+ * A modal that spans an axis reaches both edges on that axis and needs the
+ * corresponding safe-area insets. A modal that does not span an axis reaches
+ * neither edge on that axis.
+ *
+ * When both `--width` and `--height` are `fullscreen`, coverage can be
+ * determined directly. Otherwise, coverage is based on the rendered wrapper,
+ * including cases where content sizing or `--max-height` causes the modal
+ * to reach the viewport.
+ */
+export const getModalCoveredAxes = (hostEl: HTMLElement): ModalCoveredAxes => {
+  const styles = getComputedStyle(hostEl);
+  const width = getOverlaySizeType(styles.getPropertyValue('--width'));
+  const height = getOverlaySizeType(styles.getPropertyValue('--height'));
 
-  /**
-   * Seede
```

**File**: `core/src/components/modal/test/content-height/index.html` (added, +403/-0)
```diff
@@ -0,0 +1,403 @@
+<!DOCTYPE html>
+<html lang="en" dir="ltr">
+  <head>
+    <meta charset="UTF-8" />
+    <title>Modal - Content Height</title>
+    <meta name="apple-mobile-web-app-capable" content="yes" />
+    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
+    <meta
+      name="viewport"
+      content="viewport-fit=cover, width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no"
+    />
+    <link href="../../../../../css/ionic.bundle.css" rel="stylesheet" />
+    <link href="../../../../../scripts/testing/styles.css" rel="stylesheet" />
+    <script src="../../../../../scripts/testing/scripts.js"></script>
+    <script type="module" src="../../../../../dist/ionic/ionic.esm.js"></script>
+    <script>
+      /* Page two is taller than page one, to show the modal resize on navigation. */
+      class NavPageOne extends HTMLElement {
+        connectedCallback() {
+          this.innerHTML = `
+            <ion-header>
+              <ion-toolbar>
+                <ion-title>Page One</ion-title>
+              </ion-toolbar>
+            </ion-header>
+            <ion-content class="ion-padding">
+              <p>Short first page.</p>
+              <ion-nav-link router-direction="forward" component="nav-page-two">
+                <button id="go-page-two">Go to Page Two</button>
+              </ion-nav-link>
+            </ion-content>
+          `;
+        }
+      }
+
+      class NavPageTwo extends HTMLElement {
+        connectedCallback() {
+          this.innerHTML = `
+            <ion-header>
+              <ion-toolbar>
+                <ion-buttons slot="start">
+                  <ion-back-button></ion-back-button>
+                </ion-buttons>
+                <ion-title>Page Two</ion-title>
+              </ion-toolbar>
+            </ion-header>
+            <ion-content class="ion-padding">
+              <div id="tall-block" style="height: 320px; background: #d0e6ff"></div>
+            </ion-content>
+          `;
+        }
+      }
+
+      class NavHost extends HTMLElement {
+        connectedCallback() {
+          this.innerHTML = `
+            <ion-content>
+              <ion-nav root="nav-page-one"></ion-nav>
+            </ion-content>
+          `;
+        }
+      }
+
+      customElements.define('nav-page-one', NavPageOne);
+      customElements.define('nav-page-two', NavPageTwo);
+      customElements.define('nav-host', NavHost);
+    </script>
+
+    <style>
+      /**
+      * Danger style for buttons.
+      */
+      ion-content button.red {
+        background: #ea445a;
+        border-color: #a82f40;
+      }
+
+      /**
+       * Shared modal styles. Only the height differs
+       * between the modal examples.
+       */
+      ion-modal {
+        --width: fit-content;
+        --min-width: 250px;
+        --border-radius: 6px;
+        --box-shadow: 0 28px 48px rgba(0, 0, 0, 0.4);
+      }
+
+      /**
+       * Content-based Heights
+       * --------------------------------------------------
+       * Each of these sizes the modal from its contents.
+       */
+      ion-modal#fit-content-modal {
+        --height: fit-content;
+      }
+
+      ion-modal#auto-modal {
+        --height: auto;
+      }
+
+      ion-modal#min-content-modal {
+        --height: min-content;
+      }
+
+      ion-modal#max-content-modal {
+        --height: max-content;
+      }
+
+      /**
+       * Definite Heights
+       * --------------------------------------------------
+       * A definite height is not sized from its contents,
+       * so the content is free to overflow.
+       */
+      ion-modal#px-modal {
+        --height: 300px;
+      }
+
+      /**
+       * Taller than the overlay. The default `--max-height: 100%` clamps this,
+       * where before it would run off screen.
+       */
+      ion-modal#px-tall-modal {
+        --height: 2000px;
+      }
+
+      /**
+       * Overflowing Content
+       * --------------------------------------------------
+       * A content-sized modal with overflowing content.
+       * The default `--max-height: 100%` clamps this, where
+       * before it would run off screen.
+       */
+      ion-modal#long-modal {
+        --height: fit-content;
+      }
+
+      /* The same long list with a max height. */
+      ion-modal#long-max-height-modal {
+        --height: fit-content;
+        --max-height: 50%;
+      }
+
+      /**
+       * Other Content-based Cases
+       * --------------------------------------------------
+       */
+
+      /**
+       * A content-sized modal containing an `ion-nav` must be handled
+       * differently because a nav uses `position: absolute` by default.
+       */
+      ion-modal#nav-modal {
+        --height: fit-content;
+      }
+
+      /**
+       * No `ion-content` at all. This does not require any special handling,
+       * but we want to make sure it did not regress.
+       */
+      ion-modal#n
```

**File**: `core/src/components/modal/test/content-height/modal.e2e.ts` (added, +478/-0)
```diff
@@ -0,0 +1,478 @@
+import { expect } from '@playwright/test';
+import type { E2EPage } from '@utils/test/playwright';
+import { configs, test } from '@utils/test/playwright';
+
+const ISSUE = 'https://github.com/ionic-team/ionic-framework/issues/31149';
+
+/** Height of the child inside `ion-content`, so sizing can be asserted exactly. */
+const CHILD_HEIGHT = 200;
+
+/** Taller than any viewport under test, to force the overflow cases. */
+const TALL_CHILD_HEIGHT = 2000;
+
+/**
+ * Delays the remount long enough to trigger a fresh evaluation, but not long
+ * enough for the modal's later safe-area write to clear the stale class.
+ */
+const REMOUNT_TIMEOUT = 100;
+
+/**
+ * `setContent` has animations enabled by default, so `toBeVisible()` resolves as
+ * the modal starts animating in and everything after it is measured
+ * mid-animation. This turns animations off for each modal.
+ */
+const DISABLE_ANIMATIONS = `<script>window.Ionic.config.animated = false;</script>`;
+
+const contentModal = (css = '', childHeight = CHILD_HEIGHT) => `
+  ${DISABLE_ANIMATIONS}
+  ${css === '' ? '' : `<style>${css}</style>`}
+  <ion-modal is-open="true">
+    <ion-header>
+      <ion-toolbar>
+        <ion-title>Modal</ion-title>
+      </ion-toolbar>
+    </ion-header>
+    <ion-content>
+      <div style="height: ${childHeight}px" class="ion-padding">height: ${childHeight}px</div>
+    </ion-content>
+  </ion-modal>
+`;
+
+/**
+ * Nav pages have to be registered before `ion-nav` resolves its root, and the
+ * nav has to arrive through the modal's `component` delegate. An `ion-nav`
+ * slotted inline renders no pages at all.
+ */
+const navModal = (css = '') => `
+  ${css === '' ? '' : `<style>${css}</style>`}
+  <ion-modal></ion-modal>
+  <script>
+    class NavPageOne extends HTMLElement {
+      connectedCallback() {
+        this.innerHTML = \`
+          <ion-header>
+            <ion-toolbar>
+              <ion-title>Modal - Nav - One</ion-title>
+            </ion-toolbar>
+          </ion-header>
+          <ion-content>
+            <div style="height: 120px" class="ion-padding">height: 120px</div>
+          </ion-content>
+        \`;
+      }
+    }
+    class NavPageTwo extends HTMLElement {
+      connectedCallback() {
+        this.innerHTML = \`
+          <ion-header>
+            <ion-toolbar>
+              <ion-title>Modal - Nav - Two</ion-title>
+            </ion-toolbar>
+          </ion-header>
+          <ion-content>
+            <div id="tall-block" style="height: 400px" class="ion-padding">height: 400px</div>
+          </ion-content>
+        \`;
+      }
+    }
+    class NavHost extends HTMLElement {
+      connectedCallback() {
+        this.innerHTML = '<ion-content><ion-nav root="nav-page-one"></ion-nav></ion-content>';
+      }
+    }
+    customElements.define('nav-page-one', NavPageOne);
+    customElements.define('nav-page-two', NavPageTwo);
+    customElements.define('nav-host', NavHost);
+  </script>
+`;
+
+const getContentHeight = async (page: E2EPage) => {
+  const box = await page.locator('ion-modal ion-content').first().boundingBox();
+  return box?.height ?? 0;
+};
+
+const getWrapperHeight = async (page: E2EPage) => {
+  const box = await page.locator('ion-modal .modal-wrapper').boundingBox();
+  return box?.height ?? 0;
+};
+
+/**
+ * A content-sized modal has no definite height to hand down, so the scroll
+ * container only scrolls if it can shrink against the modal's `--max-height`.
+ * `scrollHeight > clientHeight` is what separates scrolling from clipping.
+ */
+const getScrollMetrics = (page: E2EPage) => {
+  return page.locator('ion-modal ion-content').evaluate(async (el: HTMLIonContentElement) => {
+    const scrollEl = await el.getScrollElement();
+    return { scrollHeight: scrollEl.scrollHeight, clientHeight: scrollEl.clientHeight };
+  });
+};
+
+/**
+ * Simulates a framework-driven detach/reattach around a modal height change:
+ * removes the content from the DOM, updates the modal's `--height` while the
+ * content is detached, then restores it to its original parent.
+ *
+ * The same element has to come back for this to reach the reconnect path, the
+ * way a framework moves a subtree it owns instead of rebuilding it, such as
+ * Vue's `<KeepAlive>`. Conditional rendering that discards the element and
+ * creates a new one is sized by that element's first render instead.
+ */
+const setHeightWhileDetached = (page: E2EPage, height: string) => {
+  return page.locator('ion-modal').evaluate(async (el: HTMLElement, height: string) => {
+    const content = el.querySelector('ion-content')!;
+    const parent = content.parentElement!;
+
+    content.remove();
+    el.style.setProperty('--height', height);
+
+    await new Promise((resolve) => setTimeout(resolve, 200));
+    parent.appendChild(content);
+  }, height);
+};
+
+/** Presents a nav modal through the delegate and waits for its first page. */
+const presentNavModal = async (page: E2EPage) => {
+  const ionMod
```

#### Recent Merged Pull Requests:
- **PR #31523** (closed): fix(modal): derive sheet dismissal from drag distance rather than viewport position (@OS-susmitabhowmik)
- **PR #31522** (2026-10-02): chore(deps): update dependency @types/node to v24.19.1 (@renovate[bot])
- **PR #31517** (2026-10-05): fix(react): prevent error when an outlet unmounts before it's ready (@ShaneK)
- **PR #31516** (2026-10-01): fix(css): stop emitting :host-context selectors in global stylesheets (@ShaneK)
- **PR #31512** (2026-10-01): chore(deps): update dependency vitest to v5.0.3 (@renovate[bot])
- **PR #31511** (2026-10-01): fix(vue-router): reset tab with memory history (@ShaneK)
- **PR #31510** (2026-10-01): fix(vue-router): render the redirect target when a guard redirects (@ShaneK)
- **PR #31509** (2026-09-30): chore(git): sync with main (@ShaneK)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
