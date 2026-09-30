# Forensic Learning Record (Deep Inspection): stenciljs/core

> **Canonical Artifact**: `07_PROJECT_LEARNING/stenciljs-core-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/stenciljs/core](https://github.com/stenciljs/core))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:40:55.327Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `stenciljs/core`
- **Description**: A toolchain for building scalable, enterprise-ready component systems on top of TypeScript and Web Component standards. Stencil components can be distributed natively to React, Angular, Vue, (+ more) and traditional web applications from a single, framework-agnostic codebase.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json
- **Stars / Engagement**: 13134 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jsdoc', 'jest', 'simple-import-sort', 'wdio'],
  extends: [
    'plugin:jest/recommended',
    // including prettier here ensures that we don't set any rules which will conflict
    // with Prettier's formatting. Keep it last in the list so that nothing else messes
    // with it!
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        // TODO(STENCIL-452): Investigate using eslint-plugin-react to remove the need for varsIgnorePattern
        varsIgnorePattern: '^(h|Fragment)$',
      },
    ],
    /**
     * Configuration for Jest rules can be found here:
     * https://github.com/jest-community/eslint-plugin-jest/tree/main/docs/rules
     */
    'jest/expect-expect': [
      'error',
      {
        // we set this to `expect*` so that any function whose name starts with expect will be counted
        // as an assertion function, allowing us to use functions to DRY up test suites.
        assertFunctionNames: ['expect*'],
      },
    ],
    // we...have a number of things disabled :)
    // TODO(STENCIL-488): Turn this rule back on once there are no violations of it remaining
    'jest/no-disabled-tests': ['off'],
    // we use this in enough places that we don't want to do per-line disables
    'jest/no-conditional-expect': ['off'],
    // this enforces that Jest hooks (e.g. `beforeEach`) are declared in test files in their execution order
    // see here for details: https://github.com/jest-community/eslint-plugin-jest/blob/main/docs/rules/prefer-hooks-in-order.md
    'jest/prefer-hooks-in-order': ['warn'],
    // this enforces that Jest hooks (e.g. `beforeEach`) are declared at the top of `describe` blocks
    'jest/prefer-hooks-on-top': ['warn'],
    /**
     * Configuration for the JSDoc plugin rules can be found at:
     * https://github.com/gajus/eslint-plugin-jsdoc
     */
    // validates that the name immediately following `@param` matches the parameter name in the function signature
    // this works in conjunction with "jsdoc/require-param"
    'jsdoc/check-param-names': [
      'error',
      {
        // if `checkStructured` is `true`, it asks that the JSDoc describe the fields being destructured.
        // turn this off to not leak function internals/discourage describing them
        checkDestructured: false,
      },
    ],
    // require that jsdoc attached to a method/function require one `@param` per parameter
    'jsdoc/require-param': [
      'error',
      {
        // if `checkStructured` is `true`, it asks that the JSDoc describe the fields being destructured.
        // turn this off to not leak function internals/discourage describing them
        checkDestructured: false,
        // always check setters as they should require a parameter (by definition)
        checkSetters: true,
      },
    ],
    'jsdoc/require-param-description': ['error'],
    // rely on TypeScript types to be the source of truth, minimize verbosity in comments
    'jsdoc/require-param-type': ['off'],
    'jsdoc/require-returns': ['error'],
    'jsdoc/require-returns-check': ['error'],
    'jsdoc/require-returns-description': ['error'],
    // rely on TypeScript types to be the source of truth, minimize verbosity in comments
    'jsdoc/require-returns-type': ['off'],
    'no-cond-assign': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'simple-import-sort/exports': 'error',
    'simple-import-sort/imports': 'error',
  },
  overrides: [
    {
      // the stencil entry point still uses `var`, ignore errors related to it
      files: 'bin/**',
      rules: {
        'no-var': 'off',
      },
    },
    {
      // we don't want to use jest-related lint rules in the wdio tests
      files: 'test/wdio/**/*.tsx',
      rules: {
        'jest/expect-expect': 'off',
        'wdio/await-expect': 'error',
      },
    },
  ],
  // inform ESLint about the global variables defined in a Jest context
  // see https://github.com/jest-community/eslint-plugin-jest/#usage
  env: {
    'jest/globals': true,
  },
};

```

### Core Architecture Module: `jest.config.js`
```
module.exports = {
  moduleNameMapper: {
    '@app-data': '<rootDir>/internal/app-data/index.cjs',
    '@app-globals': '<rootDir>/internal/app-globals/index.cjs',
    '@platform': '<rootDir>/internal/testing/index.js',
    '@runtime': '<rootDir>/internal/testing/index.js',
    '@stencil/core/cli': '<rootDir>/cli/index.cjs',
    '@stencil/core/compiler': '<rootDir>/compiler/stencil.js',
    '@stencil/core/mock-doc': '<rootDir>/mock-doc/index.cjs',
    '@stencil/core/testing': '<rootDir>/testing/index.js',
    '@sys-api-node': '<rootDir>/sys/node/index.js',
    '@utils': '<rootDir>/src/utils',
    '^typescript$': '<rootDir>/scripts/build/typescript-modified-for-jest.js',
    '^@stencil/core/internal/app-data$': '<rootDir>/internal/app-data/index.cjs',
    '^@stencil/core/internal/testing$': '<rootDir>/internal/testing/index.js',
  },
  coverageDirectory: './coverage/',
  coverageReporters: ['json', 'lcov', 'text', 'clover'],
  coveragePathIgnorePatterns: ['^.*\\.stub\\.tsx?$'],
  collectCoverageFrom: [
    '<rootDir>/scripts/**/*.{js,jsx,ts,tsx}',
    '!<rootDir>/scripts/build/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/app-data/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/app-globals/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/cli/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/compiler/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/declarations/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/dev-server/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/hydrate/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/internal/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/mock-doc/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/runtime/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/screenshot/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/sys/node/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/testing/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/utils/**/*.{js,jsx,ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'jsx', 'json', 'd.ts'],
  modulePathIgnorePatterns: ['/bin', '/www'],
  setupFilesAfterEnv: ['<rootDir>/testing/jest-setuptestframework.js'],
  testEnvironment: '<rootDir>/testing/jest-environment.js',
  testPathIgnorePatterns: [
    '<rootDir>/.cache/',
    '<rootDir>/.github/',
    '<rootDir>/.stencil/',
    '<rootDir>/.vscode/',
    '<rootDir>/bin/',
    '<rootDir>/build/',
    '<rootDir>/cli/',
    '<rootDir>/compiler/',
    '<rootDir>/dev-server/',
    '<rootDir>/dist/',
    '<rootDir>/internal/',
    '<rootDir>/mock-doc/',
    '<rootDir>/node_modules/',
    '<rootDir>/screenshot/',
    '<rootDir>/sys/',
    '<rootDir>/test/',
    '<rootDir>/testing/',
  ],
  testRegex: '/(src|scripts)/.*\\.spec\\.(ts|tsx|js)$',
  // TODO(STENCIL-307): Move away from Jasmine runner for internal Stencil tests as a part of the (internal) Jest 28+ upgrade
  testRunner: 'jest-jasmine2',
  transform: {
    '^.+\\.(ts|tsx|jsx|css|mjs)$': '<rootDir>/testing/jest-preprocessor.js',
  },
  watchPathIgnorePatterns: ['^.+\\.d\\.ts$'],
};

```

### Core Architecture Module: `screenshot/connector.js`
```
const { ScreenshotConnector } = require('./index.js');
module.exports = ScreenshotConnector;

```

### Core Architecture Module: `screenshot/local-connector.js`
```
const { ScreenshotLocalConnector } = require('./index.js');
module.exports = ScreenshotLocalConnector;

```

### Core Architecture Module: `scripts/index.ts`
```
import { join } from 'path';

import * as build from './build';

// This path is relative to the final location of the compiled script, not its TypeScript source
const stencilProjectRoot = join(__dirname, '..');
const args = process.argv.slice(2);
build.run(stencilProjectRoot, args);

```

### Core Architecture Module: `scripts/release-tasks.ts`
```
import color from 'ansi-colors';
import Listr, { ListrTask } from 'listr';

import { buildAll } from './build';
import { BuildOptions } from './utils/options';
import { isPrereleaseVersion, isValidVersionInput, SEMVER_INCREMENTS, updateChangeLog } from './utils/release-utils';

/**
 * We have to wrap `execa` in a promise to ensure it works with `Listr`. `Listr` uses rxjs under the hood which
 * seems to have issues with `execa`'s `ResultPromise` as it never resolves a task.
 * @param command command to run
 * @param args    arguments to pass to the command
 * @param options `execa` options
 * @returns a promise that resolves with the stdout and stderr of the command
 */
async function execa(command: string, args: string[], options?: any) {
  /**
   * consecutive imports are cached and don't have an impact on the execution speed
   */
  const { execa: execaOrig } = await import('execa');

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const run = execaOrig(command, args, options);
    run.then(
      ({ stdout, stderr }) =>
        resolve({
          stdout: stdout as unknown as string,
          stderr: stderr as unknown as string,
        }),
      (err) => reject(err),
    );
  });
}

/**
 * Runs a litany of tasks used to ensure a safe release of a new version of Stencil
 * @param opts build options containing the metadata needed to release a new version of Stencil
 * @param args stringified arguments used to influence the release steps that are taken
 */
export async function runReleaseTasks(opts: BuildOptions, args: ReadonlyArray<string>): Promise<void> {
  const rootDir = opts.rootDir;
  const pkg = opts.packageJson;
  const tasks: ListrTask[] = [];
  const newVersion = opts.version;
  const isDryRun = args.includes('--dry-run') || opts.version.includes('dryrun');
  let tagPrefix: string;

  if (isDryRun) {
    console.log(color.bold.yellow(`\n  🏃‍ Dry Run!\n`));
  }

  if (!opts.isPublishRelease) {
    /**
     * For automated and manual releases, always verify that the version provided to the release scripts is a valid
     * semver 'word' (e.g. 'major', 'minor', etc.) or version (e.g. 1.0.0)
     */
    tasks.push({
      title: 'Validate version',
      task: () => {
        if (!isValidVersionInput(opts.version)) {
          throw new Error(`Version should be either ${SEMVER_INCREMENTS.join(', ')}, or a valid semver version.`);
        }
      },
      skip: () => isDryRun,
    });
  }

  if (opts.isPublishRelease) {
    tasks.push({
      title: 'Check for pre-release version',
      task: () => {
        if (!pkg.private && isPrereleaseVersion(newVersion) && !opts.tag) {
          throw new Error(
            'You must specify a dist-tag using --tag when publishing a pre-release version. This prevents accidentally tagging unstable versions as "latest". https://docs.npmjs.com/cli/dist-tag',
          );
        }
      },
    });
  }

  tasks.push({
    /**
     * When we both pre-release and release, it's beneficial to ensure that the tag does not already exist in git.
     * Doing so ought to catch out of the ordinary circumstances that ought to be investigated.
     */
    title: 'Check git tag existence',
    task: () =>
      execa('git', ['fetch'])
        // Retrieve the prefix for a version string - https://docs.npmjs.com/cli/v7/using-npm/config#tag-version-prefix
        .then(() => execa('npm', ['config', 'get', 'tag-version-prefix']))
        .then(
          ({ stdout }) => (tagPrefix = stdout),
          () => {},
        )
        // verify that a tag for the new version string does not already exist by checking the output of
        // `git rev-parse --verify`
        .then(() => execa('git', ['rev-parse', '--quiet', '--verify', `refs/tags/${tagPrefix}${newVersion}`]))
        .then(
          ({ stdout }) => {
            if (stdout) {
              throw new Error(`Git tag \`${tagPrefix}${newVersion}\` already exists.`);
            }
          },
          (err) => {
            // Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
            // https://github.com/sindresorhus/np/pull/73#discussion_r72385685
            if (err.stdout !== '' || err.stderr !== '') {
              throw err;
            }
          },
        ),
    skip: () => isDryRun,
  });

  tasks.push(
    {
      title: `Install npm dependencies ${color.dim('(npm ci)')}`,
      task: () => execa('npm', ['ci'], { cwd: rootDir }),
      // for pre-releases, this step will occur in GitHub after the PR has been created.
      // for actual releases, we'll need to build + bundle stencil in order to publish it to npm.
      skip: () => !opts.isPublishRelease,
    },
    {
      title: `Transpile Stencil ${color.dim('(tsc.prod)')}`,
      task: () => execa('npm', ['run', 'tsc.prod'], { cwd: rootDir }),
      // for pre-releases, this step will occur in GitHub after the PR has been created.
      // for actual releases, we'll need to build + bundle stencil in order to publish it to npm.
      skip: () => !opts.isPublishRelease,
    },
    {
      title: `Bundle @stencil/core ${color.dim('(' + opts.buildId + ')')}`,
      task: () => buildAll(opts),
      // for pre-releases, this step will occur in GitHub after the PR has been created.
      // for actual releases, we'll need to build + bundle stencil in order to publish it to npm.
      skip: () => !opts.isPublishRelease,
    },
  );

  if (!opts.isPublishRelease) {
    tasks.push(
      {
        title: `Set package.json version to ${color.bold.yellow(opts.version)}`,
        task: async () => {
          // use `--no-git-tag-version` to ensure that the tag for the release is not prematurely created
          await execa('npm', ['version', '--no-git-tag-version', opts.version], { cwd: rootDir });
        },
      },
      {
        title: `Generate ${opts.version} Changelog ${opts.vermoji}`,
        task: async () => {
          await updateChangeLog(opts);
        },
      },
    );
  }

  if (opts.isPublishRelease) {
    tasks.push(
      {
        title: 'Publish @stencil/core to npm',
        task: () => {
          const cmd = 'npm';
          const cmdArgs = ['publish'].concat(opts.tag ? ['--tag', opts.tag] : []).concat(['--provenance']);

          if (isDryRun) {
            return console.log(`[dry-run] ${cmd} ${cmdArgs.join(' ')}`);
          }
          return execa(cmd, cmdArgs, { cwd: rootDir });
        },
      },
      {
        title: 'Tagging the latest git commit',
        task: () => {
          const cmd = 'git';
          const cmdArgs = ['tag', `v${opts.version}`];

          if (isDryRun) {
            return console.log(`[dry-run] ${cmd} ${cmdArgs.join(' ')}`);
          }
          return execa(cmd, cmdArgs, { cwd: rootDir });
        },
      },
      {
        title: 'Pushing git tags',
        task: () => {
          const cmd = 'git';
          const cmdArgs = ['push', '--tags'];

          if (isDryRun) {
            return console.log(`[dry-run] ${cmd} ${cmdArgs.join(' ')}`);
          }
          return execa(cmd, cmdArgs, { cwd: rootDir });
        },
      },
    );
  }

  const listr = new Listr(tasks);

  try {
    await listr.run();
  } catch (err: any) {
    console.log(`\n🤒  ${color.red(err)}\n`);
    console.log(err);
    process.exit(1);
  }
  if (opts.isPublishRelease) {
    console.log(
      `\n ${opts.vermoji}  ${color.bold.magenta(pkg.name)} ${color.bold.yellow(newVersion)} published!! ${
        opts.vermoji
      }\n`,
    );
  } else {
    console.log(
      `\n ${opts.vermoji}  ${color.bold.magenta(pkg.name)} ${color.bold.yellow(
        newVersion,
      )} prepared, check the diffs and commit ${opts.vermoji}\n`,
    );
  }
}

```

### Core Architecture Module: `scripts/release.ts`
```
import color from 'ansi-colors';
import fs from 'fs-extra';
import { join } from 'path';

import { runReleaseTasks } from './release-tasks';
import { BuildOptions, getOptions } from './utils/options';
import { getNewVersion } from './utils/release-utils';
import { getLatestVermoji } from './utils/vermoji';

/**
 * Runner for creating a release of Stencil
 * @param rootDir the root directory of the Stencil repository
 * @param args stringified arguments used to influence the release steps that are taken
 * @returns a void promise
 */
export async function release(rootDir: string, args: ReadonlyArray<string>): Promise<void> {
  const buildDir = join(rootDir, 'build');

  if (args.includes('--ci-prepare')) {
    await fs.emptyDir(buildDir);
    const prepareOpts = getOptions(rootDir, {
      isCI: true,
      isPublishRelease: false,
      isProd: true,
    });

    const versionIdx = args.indexOf('--version');
    if (versionIdx === -1 || versionIdx === args.length) {
      console.log(`\n${color.bold.red('No `--version [VERSION]` argument was found. Exiting')}\n`);
      process.exit(1);
    }
    if (prepareOpts.packageJson.version) {
      prepareOpts.version = getNewVersion(prepareOpts.packageJson.version, args[versionIdx + 1]);
    }

    await prepareRelease(prepareOpts, args);
    console.log(`${color.bold.blue('Release Prepared!')}`);
  }

  if (args.includes('--ci-publish')) {
    const prepareOpts = getOptions(rootDir, {
      isCI: true,
      isPublishRelease: false,
      isProd: true,
    });
    // this was bumped already, we just need to copy it from package.json into this field
    if (prepareOpts.packageJson.version) {
      prepareOpts.version = prepareOpts.packageJson.version;
    }

    // we generated a vermoji during the preparation step, let's grab it from the changelog
    prepareOpts.vermoji = getLatestVermoji(prepareOpts.changelogPath);

    const tagIdx = args.indexOf('--tag');
    let newTag = null;
    if (tagIdx === -1 || tagIdx === args.length) {
      console.log(`\n${color.bold.yellow('No `--tag [TAG]` argument was found.')}\n`);
    } else if (args[tagIdx + 1] === 'use_pkg_json_version') {
      console.log(
        `\n${color.bold.green(
          'The default package.json version will be used for the tag. No additional tags will be applied.',
        )}\n`,
      );
    } else {
      newTag = args[tagIdx + 1];
      console.log(`\n${color.bold.green(`Set '--tag' argument to '${newTag}'.`)}\n`);
    }

    console.log(`${color.bold.blue(`Version: ${prepareOpts.version}`)}`);
    console.log(`${color.bold.blue(`Tag: ${newTag}`)}`);

    const publishOpts = getOptions(rootDir, {
      buildId: prepareOpts.buildId,
      version: prepareOpts.version,
      vermoji: prepareOpts.vermoji,
      isCI: prepareOpts.isCI,
      isPublishRelease: true,
      isProd: true,
      tag: newTag ?? undefined,
    });
    return await publishRelease(publishOpts, args);
  }
}

/**
 * Prepares a release of Stencil
 * @param opts build options containing the metadata needed to release a new version of Stencil
 * @param args stringified arguments used to influence the release steps that are taken
 */
async function prepareRelease(opts: BuildOptions, args: ReadonlyArray<string>): Promise<void> {
  const pkg = opts.packageJson;
  const oldVersion = opts.packageJson.version;
  console.log(
    `\nPrepare to publish ${opts.vermoji}  ${color.bold.magenta(pkg.name)} ${color.dim(`(currently ${oldVersion})`)}\n`,
  );

  try {
    await runReleaseTasks(opts, args);
  } catch (err: any) {
    console.log('\n', color.red(err), '\n');
    process.exit(0);
  }
}

/**
 * Initiates publishing a Stencil release.
 * @param opts build options containing the metadata needed to publish a new version of Stencil
 * @param args stringified arguments used to influence the steps that are taken
 * @returns a void promise
 */
async function publishRelease(opts: BuildOptions, args: ReadonlyArray<string>): Promise<void> {
  const pkg = opts.packageJson;
  if (opts.version !== pkg.version) {
    throw new Error(
      `Prepare release data (${opts.version}) and package.json (${pkg.version}) versions do not match. Try re-running release prepare.`,
    );
  }

  console.log(`\nPublish ${opts.vermoji}  ${color.bold.magenta(pkg.name)} ${color.yellow(`${opts.version}`)}\n`);

  try {
    await runReleaseTasks(opts, args);
  } catch (err: any) {
    console.log('\n', color.red(err), '\n');
    process.exit(0);
  }
}

```

### Core Architecture Module: `scripts/types/rollup-plugin-node-resolve.d.ts`
```
declare module '@rollup/plugin-node-resolve';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6920** (2026-09-30): **refactor(runtime): revert #6912 in-favour of children always waiting for parents to hydrate**
  *Symptoms*:   <!-- Please refer to our contributing documentation for any questions on submitting a pull request, or let us know here if you need any help: https://github.com/stenciljs/core/blob/main/CONTRIBUTING.md -->   ## What is the current behavior? <!-- Please describe the current behavior that you are modifying, or link to a relevant issue. -->  GitHub Issue Number: N/A   ## What is the new behavior? <!-- Please describe the behavior or changes that are being added by this PR. -->    ## Documentation  <!-- Please add any link(s) to documentation-related pull requests here -->  ## Does this introduce a breaking change?  - [ ] Yes - [ ] No  <!-- If this introduces a breaking change, please describe the impact and migration path for existing applications below. -->  ## Testing  <!-- Please describe the steps you took to test the changes in this PR. These steps can be programmatic (e.g. unit tests) and/or manual. -->  ## Other information  <!-- Any other information that is important to this PR such as screenshots of how a component looks before and after the change. --> 

- **Issue #6919** (2026-09-30): **fix(ssr): lost child-rendered-first classes**
  *Symptoms*: <!-- Please refer to our contributing documentation for any questions on submitting a pull request, or let us know here if you need any help: https://github.com/stenciljs/core/blob/main/CONTRIBUTING.md -->   ## What is the current behavior? <!-- Please describe the current behavior that you are modifying, or link to a relevant issue. -->  GitHub Issue Number: https://github.com/stenciljs/core/issues/6911   ## What is the new behavior? <!-- Please describe the behavior or changes that are being added by this PR. -->  Fixes https://github.com/stenciljs/core/issues/6911  ## Documentation  <!-- Please add any link(s) to documentation-related pull requests here -->  ## Does this introduce a breaking change?  - [ ] Yes - [x] No  <!-- If this introduces a breaking change, please describe the impact and migration path for existing applications below. -->  ## Testing  <!-- Please describe the steps you took to test the changes in this PR. These steps can be programmatic (e.g. unit tests) and/or manual. -->  ## Other information  <!-- Any other information that is important to this PR such as screenshots of how a component looks before and after the change. --> 

- **Issue #6918** (2026-09-30): **fix(runtime): `document.hidden` page freezes**
  *Symptoms*: <!-- Please refer to our contributing documentation for any questions on submitting a pull request, or let us know here if you need any help: https://github.com/stenciljs/core/blob/main/CONTRIBUTING.md -->   ## What is the current behavior? <!-- Please describe the current behavior that you are modifying, or link to a relevant issue. -->  GitHub Issue Number: https://github.com/stenciljs/core/issues/6917   ## What is the new behavior? <!-- Please describe the behavior or changes that are being added by this PR. -->  Fixes https://github.com/stenciljs/core/issues/6917  ## Documentation  <!-- Please add any link(s) to documentation-related pull requests here -->  ## Does this introduce a breaking change?  - [ ] Yes - [x] No  <!-- If this introduces a breaking change, please describe the impact and migration path for existing applications below. -->  ## Testing  <!-- Please describe the steps you took to test the changes in this PR. These steps can be programmatic (e.g. unit tests) and/or manual. -->  ## Other information  <!-- Any other information that is important to this PR such as screenshots of how a component looks before and after the change. --> 

- **Issue #6917** (2026-09-30): **bug: pages freeze when document.hidden flushes the queue via microtasks**
  *Symptoms*: ### Prerequisites  - [x] I have read the [Contributing Guidelines](https://github.com/stenciljs/core/blob/main/CONTRIBUTING.md). - [x] I agree to follow the [Code of Conduct](https://github.com/stenciljs/core/blob/main/CODE_OF_CONDUCT.md). - [x] I have searched for [existing issues](https://github.com/stenciljs/core/issues) that already report this problem, without success.  ### Stencil Version  4.44.0  ### Current Behavior  This issues resumes in completely frozen pages for 2 of our consumers. Now a AI generated technical analysis follows:  Since 4.44.0, a document that reports `document.hidden === true` drains the task queue through microtasks instead of `requestAnimationFrame` (`src/runtime/task-queue.ts`):  ```ts const scheduleFlush = () => (win.document?.hidden ? nextTick(flush) : plt.raf(flush)) const nextTick = (cb: Function) => promiseResolve().then(cb) ```  `flush()` reschedules itself through that same helper whenever DOM reads remain:  ```ts if ((queuePending = queueDomReads.length > 0)) {   scheduleFlush() } ```  So work that `requestAnimationFrame` used to spread across frames now runs back to back inside a single task. A microtask cannot yield — the queue is drained to completion before the browser runs anything else.  This hits the ordinary "measure after render, then update" pattern, which is what `readTask()` exists for:  ```tsx componentDidRender() {   readTask(() => {     void this.el.offsetHeight     this.round++ // schedules the next render, and therefore

- **Issue #6916** (2026-09-30): **fix(compiler): exclude configured components from collection output**
  *Symptoms*: ## Why is this needed?  [Siemens iX](https://github.com/siemens/ix) uses `excludeComponents` to omit a testing-only component from production builds.  Right now, the component's CSS is excluded, but its JavaScript file is still emitted into the component collection. Because that JavaScript imports the missing CSS file, consumers of the iX package encounter build errors.  This change applies `excludeComponents` consistently when generating collection files and manifests. Development-mode behavior remains unchanged.  ## What does this change?  Ensures components matching `excludeComponents` are omitted from the `dist-collection` output, including:  - Compiled JavaScript files - Source maps - Entries in `collection-manifest.json`  ## Does this introduce a breaking change?  - [ ] Yes - [x] No  <!-- If this introduces a breaking change, please describe the impact and migration path for existing applications below. -->  ## Testing  Added unit coverage for:  - Exact component tag matches - Wildcard patterns - Non-matching and empty configurations - Development mode - JavaScript and source-map exclusion - Collection manifest generation - Incremental builds with unchanged components - Preservation of exported mixins  The focused test suite passes:  `npm run test.jest -- src/compiler/output-targets/test/output-targets-collection.spec.ts --runInBand`  ## Other information  <!-- Any other information that is important to this PR such as screensho

- **Issue #6915** (2026-09-29): **chore(deps-dev): bump ip-address from 10.4.0 to 10.7.2**
  *Symptoms*: Bumps [ip-address](https://github.com/beaugunderson/ip-address) from 10.4.0 to 10.7.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/beaugunderson/ip-address/releases">ip-address's releases</a>.</em></p> <blockquote> <h2>v10.7.2</h2> <h2>What's Changed</h2> <ul> <li>Accept an arpa suffix in any case and without the root dot in fromArpa by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/227">beaugunderson/ip-address#227</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2">https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2</a></p> <h2>v10.7.1</h2> <h2>What's Changed</h2> <ul> <li>Bump js-yaml and brace-expansion in the lockfile by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/226">beaugunderson/ip-address#226</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.0...v10.7.1">https://github.com/beaugunderson/ip-address/compare/v10.7.0...v10.7.1</a></p> <h2>v10.7.0</h2> <h2>What's Changed</h2> <ul> <li>Add offset() and nextNetwork(), accept prefix-length ip6.arpa names, correct the IPv6 end-address docs by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in

- **Issue #6914** (2026-09-30): **fix(scope-css): scope rules inside @container**
  *Symptoms*: <!-- Please refer to our contributing documentation for any questions on submitting a pull request, or let us know here if you need any help: https://github.com/stenciljs/core/blob/main/CONTRIBUTING.md -->   ## What is the current behavior? <!-- Please describe the current behavior that you are modifying, or link to a relevant issue. -->  GitHub Issue Number: N/A  `scopeCss` only goes inside the at-rules listed in `isScopableAtRule`: `@media`, `@supports`, `@page`, `@document` and, since #6858, `@layer`. `@container` is not on that list, so rules inside a container query are never scoped.  For a `scoped: true` component with these styles:  ```css .title { color: red; } @container (min-width: 400px) { .title { color: blue; } } ```  the compiler (`transpileSync`, `add-static-style`) emits:  ```css .title.sc-my-card { color: red; } @container (min-width: 400px) { .title { color: blue; } } ```  So the container-query rule applies to every `.title` on the page, not only the component's own. With `commentOriginalSelector` (hydrate `serializeShadowRoot: 'scoped'`), the `/*!@...*/` original-selector comment is also missing inside `@container`. This is the same problem #6858 fixed for `@layer`.  ## What is the new behavior? <!-- Please describe the behavior or changes that are being added by this PR. -->  `@container` is added to `isScopableAtRule`. Its rules are now scoped and commented like `@media` and `@layer`:  ```css .title.sc-my-card { color: red; } @container (min-width: 400px
  **Post-Mortem & Fix Analysis**:
  > <!-- __CODSPEED_PERFORMANCE_REPORT_COMMENT__ --> ## Merging this PR will **not alter performance**   `✅ 2` untouched benchmarks        ---  <sub>Comparing <code>breken-ai:fix/scope-css-container</code> (8ecd1a4) with <code>main</code> (b6842e9)</sub>  <a href="https://app.codspeed.io/stenciljs/core/branches/breken-ai%3Afix%2Fscope-css-container?utm_source=github&utm_medium=comment-v2&utm_content=button">   <picture>     <source media="(prefers-color-scheme: dark)" srcset="https://codspeed.io/pr-report/open-in-codspeed-dark.svg">     <source media="(prefers-color-scheme: light)" srcset="https://codspeed.io/pr-report/open-in-codspeed-light.svg">     <img alt="Open in CodSpeed" src="https://codspeed.io/pr-report/open-in-codspeed-light.svg" width="169" height="32">   </picture> </a>  

- **Issue #6913** (2026-09-30): **fix(mock-doc): support force in classList.toggle**
  *Symptoms*: <!-- Please refer to our contributing documentation for any questions on submitting a pull request, or let us know here if you need any help: https://github.com/stenciljs/core/blob/main/CONTRIBUTING.md -->   ## What is the current behavior? <!-- Please describe the current behavior that you are modifying, or link to a relevant issue. -->  GitHub Issue Number: N/A  `MockTokenList.toggle()` (used for `classList` and `part` in mock-doc) takes only the token. It ignores the `force` argument and returns `undefined`:  - `el.classList.toggle('open', false)` adds `open` when it is missing. - `el.classList.toggle('ready', true)` removes `ready` when it is already there.  Components often write `this.el.classList.toggle('active', this.isActive)`. In `newSpecPage` tests, and in hydrate/SSR output (which runs on mock-doc), those classes come out inverted. For example, this component:  ```tsx componentWillLoad() {   this.el.classList.toggle('open', false);   this.el.classList.toggle('ready', true);   this.el.classList.toggle('ready', true); } ```  renders with `class="open"` in `newSpecPage`. A browser gives `class="ready"`.  ## What is the new behavior? <!-- Please describe the behavior or changes that are being added by this PR. -->  `toggle(token, force?)` now matches `DOMTokenList.toggle`: - with no `force`, it flips the token - `force === true` only adds - `force === false` only removes  It also returns whether the token is present afterwards.  ## Documentation  <!-- Please add any l

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

### Incident Patch 1: `bc393d02` (2026-09-30)
**Commit Message**: fix(scope-css): scope rules inside @container (#6914)

scopeCss only descends into @media, @supports, @page, @document and @layer. Rules inside @container were left unscoped, so a scoped component's container query styles applied to matching elements across the whole page, and the original selector comment used for scoped to shadow conversion was not added.

Co-authored-by: breken-ai <312387581+breken-ai@users.noreply.github.com>
Co-authored-by: John Jenkins <johnljenkins@Hotmail.com>

**File**: `src/utils/shadow-css.ts` (modified, +2/-1)
```diff
@@ -476,7 +476,8 @@ const isScopableAtRule = (selector: string) =>
   selector.startsWith('@supports') ||
   selector.startsWith('@page') ||
   selector.startsWith('@document') ||
-  selector.startsWith('@layer');
+  selector.startsWith('@layer') ||
+  selector.startsWith('@container');
 
 const scopeSelectors = (
   cssText: string,
```

**File**: `src/utils/test/scope-css.spec.ts` (modified, +12/-0)
```diff
@@ -113,6 +113,18 @@ describe('scopeCSS', function () {
     expect(s(css, 'a')).toEqual(expected);
   });
 
+  it('should handle container rules', () => {
+    const css = '@container card (min-width: 400px) {section {display: flex;}}';
+    const expected = '@container card (min-width:400px) {section.a {display:flex;}}';
+    expect(s(css, 'a')).toEqual(expected);
+  });
+
+  it('should preserve original selectors in container rules', () => {
+    const css = '@container (min-width: 400px) {:host {display: flex;}}';
+    const expected = '@container (min-width:400px) {/*!@:host*/.a-h {display:flex;}}';
+    expect(s(css, 'a', true)).toEqual(expected);
+  });
+
   it('should preserve original selectors in nested grouping rules', () => {
     const css = '@layer defaults {@media (min-width: 640px) {:host {display: block;}}}';
     const expected = '@layer defaults {@media (min-width:640px) {/*!@:host*/.a-h {display:block;}}}';
```

---

### Incident Patch 2: `804ea4d8` (2026-09-30)
**Commit Message**: fix + tests (#6916)

Co-authored-by: John Jenkins <johnljenkins@Hotmail.com>

**File**: `src/compiler/output-targets/dist-collection/index.ts` (modified, +11/-2)
```diff
@@ -7,6 +7,7 @@ import {
   join,
   normalizePath,
   relative,
+  shouldExcludeComponent,
   sortBy,
 } from '@utils';
 import ts from 'typescript';
@@ -37,11 +38,14 @@ export const outputCollection = async (
     return;
   }
 
+  const collectionModuleFiles = changedModuleFiles.filter(
+    (mod) => config.devMode || !mod.cmps.some((cmp) => shouldExcludeComponent(cmp.tagName, config.excludeComponents)),
+  );
   const bundlingEventMessage = `generate collections${config.sourceMap ? ' + source maps' : ''}`;
   const timespan = buildCtx.createTimeSpan(`${bundlingEventMessage} started`, true);
   try {
     await Promise.all(
-      changedModuleFiles.map(async (mod) => {
+      collectionModuleFiles.map(async (mod) => {
         let code = mod.staticSourceFileText;
         if (config.preamble) {
           code = `${generatePreamble(config)}\n${code}`;
@@ -122,7 +126,12 @@ const serializeCollectionManifest = (config: d.ValidatedConfig, compilerCtx: d.C
   // create the single collection we're going to fill up with data
   const collectionManifest: d.CollectionManifest = {
     entries: buildCtx.moduleFiles
-      .filter((mod) => !mod.isCollectionDependency && mod.cmps.length > 0)
+      .filter(
+        (mod) =>
+          !mod.isCollectionDependency &&
+          mod.cmps.length > 0 &&
+          (config.devMode || !mod.cmps.some((cmp) => shouldExcludeComponent(cmp.tagName, config.excludeComponents))),
+      )
       .map((mod) => relative(config.srcDir, mod.jsFilePath)),
     // Include mixin/abstract class modules that can be extended by consuming projects
     // These are modules with Stencil static members but no @Component decorator
```

**File**: `src/compiler/output-targets/test/output-targets-collection.spec.ts` (modified, +88/-1)
```diff
@@ -1,4 +1,10 @@
-import { mockBuildCtx, mockCompilerCtx, mockModule, mockValidatedConfig } from '@stencil/core/testing';
+import {
+  mockBuildCtx,
+  mockCompilerCtx,
+  mockComponentMeta,
+  mockModule,
+  mockValidatedConfig,
+} from '@stencil/core/testing';
 
 import type * as d from '../../../declarations';
 import * as test from '../../transformers/map-imports-to-path-aliases';
@@ -23,6 +29,7 @@ describe('Dist Collection output target', () => {
   beforeEach(() => {
     mockConfig = mockValidatedConfig({
       srcDir: '/src',
+      bundles: [],
     });
     mockedBuildCtx = mockBuildCtx();
     mockedCompilerCtx = mockCompilerCtx();
@@ -44,6 +51,86 @@ describe('Dist Collection output target', () => {
     jest.restoreAllMocks();
   });
 
+  it.each([
+    { devMode: false, excludeComponents: ['my-playground'], excluded: true },
+    { devMode: false, excludeComponents: ['*-playground'], excluded: true },
+    { devMode: false, excludeComponents: ['other-component'], excluded: false },
+    { devMode: false, excludeComponents: [], excluded: false },
+    { devMode: false, excludeComponents: undefined, excluded: false },
+    { devMode: true, excludeComponents: ['my-playground'], excluded: false },
+    { devMode: true, excludeComponents: ['*-playground'], excluded: false },
+  ])(
+    'writes collections with devMode=$devMode and excludeComponents=$excludeComponents (excluded=$excluded)',
+    async ({ devMode, excludeComponents, excluded }) => {
+      mockConfig.outputTargets = [target];
+      mockConfig.devMode = devMode;
+      mockConfig.excludeComponents = excludeComponents;
+      const includedModule = mockModule({
+        staticSourceFileText: 'export class Button {}',
+        jsFilePath: '/src/button.js',
+        sourceFilePath: '/src/button.tsx',
+        cmps: [mockComponentMeta({ tagName: 'my-button' })],
+      });
+      const excludedModule = mockModule({
+        staticSourceFileText: 'export class Playground {}',
+        jsFilePath: '/src/playground.js',
+        sourceFilePath: '/src/playground.tsx',
+        sourceMapPath: '/src/playground.js.map',
+        sourceMapFileText: '{}',
+        cmps: [mockComponentMeta({ tagName: 'my-playground' })],
+      });
+      const mixinModule = mockModule({
+        staticSourceFileText: 'export class Base {}',
+        jsFilePath: '/src/base.js',
+        sourceFilePath: '/src/base.ts',
+        hasExportableMixins: true,
+        cmps: [],
+      });
+      changedModules.push(includedModule, excludedModule, mixinModule);
+      mockedBuildCtx.moduleFiles = changedModules;
+
+      await outputCollection(mockConfig, mockedCompilerCtx, mockedBuildCtx, changedModules);
+
+      expect(mockedBuildCtx.diagnostics).toEqual([]);
+      const writtenPaths = jest.mocked(mockedCompilerCtx.fs.writeFile).mock.calls.map(([filePath]) => filePath);
+      expect(writtenPaths).toEqual(
+        expect.arrayContaining([
+          '/dist/collection/main.js',
+          '/dist/collection/button.js',
+          '/dist/collection/base.js',
+          '/dist/collection/collection-manifest.json',
+        ]),
+      );
+      expect(writtenPaths.includes('/dist/collection/playground.js')).toBe(!excluded);
+      expect(writtenPaths.includes('/dist/collection/playground.js.map')).toBe(!excluded);
+      const manifest = JSON.parse(await mockedCompilerCtx.fs.readFile('/dist/collection/collection-manifest.json'));
+      expect(manifest.entries).toEqual(excluded ? ['button.js'] : ['button.js', 'playground.js']);
+      expect(manifest.mixins).toEqual(['base.js']);
+    },
+  );
+
+  it('excludes unchanged components from the collection manifest', async () => {
+    mockConfig.outputTargets = [target];
+    mockConfig.devMode = false;
+    mockConfig.excludeComponents = ['my-playground'];
+    mockedBuildCtx.moduleFiles = [
+      mockModule({
+        jsFilePath: '/src/button.js',
+        cmps: [mockComponentMeta({ tagName: 'my-button' })],
+      }),
+      mockModule({
+
```

---

### Incident Patch 3: `992ab546` (2026-09-30)
**Commit Message**: fix(mock-doc): support force in classList.toggle (#6913)

MockTokenList.toggle ignored the second argument and returned nothing, so toggle('x', false) added the class when it was missing and toggle('x', true) removed it when present. This affected spec tests and hydrate (SSR) output. Honor force and return whether the token is present.

Co-authored-by: breken-ai <312387581+breken-ai@users.noreply.github.com>

**File**: `src/mock-doc/test/token-list.spec.ts` (modified, +20/-0)
```diff
@@ -36,6 +36,26 @@ describe('token-list', () => {
     expect(tokenList.toString()).toEqual('');
   });
 
+  it('toggle adds or removes a token and returns whether it is present', () => {
+    expect(tokenList.toggle('one')).toBe(true);
+    expect(tokenList.contains('one')).toBe(true);
+    expect(tokenList.toggle('one')).toBe(false);
+    expect(tokenList.contains('one')).toBe(false);
+  });
+
+  it('toggle with force only adds when true and only removes when false', () => {
+    expect(tokenList.toggle('one', false)).toBe(false);
+    expect(tokenList.contains('one')).toBe(false);
+
+    expect(tokenList.toggle('one', true)).toBe(true);
+    expect(tokenList.toggle('one', true)).toBe(true);
+    expect(tokenList.contains('one')).toBe(true);
+
+    expect(tokenList.toggle('one', false)).toBe(false);
+    expect(tokenList.toggle('one', false)).toBe(false);
+    expect(tokenList.contains('one')).toBe(false);
+  });
+
   it('should throw if empty', () => {
     expect(() => {
       tokenList.add('');
```

**File**: `src/mock-doc/token-list.ts` (modified, +6/-4)
```diff
@@ -42,13 +42,15 @@ export class MockTokenList {
     return getItems(this.elm, this.attr).includes(token);
   }
 
-  toggle(token: string) {
+  toggle(token: string, force?: boolean) {
     token = String(token);
-    if (this.contains(token) === true) {
-      this.remove(token);
-    } else {
+    const shouldAdd = force === undefined ? !this.contains(token) : !!force;
+    if (shouldAdd) {
       this.add(token);
+    } else {
+      this.remove(token);
     }
+    return shouldAdd;
   }
 
   get length() {
```

---

### Incident Patch 4: `b6842e98` (2026-09-30)
**Commit Message**: fix(runtime): keep child host classes on first render after hydration (#6912)

On client-side hydration, the old vnode of every child element is seeded
with the element's full server `className`. When a child component
hydrates and renders before its parent (e.g. with `dist-custom-elements`,
where dependencies are defined first), the parent's first render removed
every class it did not set itself, including the classes the child had
set on its own `<Host>` and the hydrated flag. Nothing added them again.

On that first render, keep the classes that an already rendered child
component set on its own host. Classes the parent rendered on the server
but not on the client are still removed.

**File**: `src/runtime/vdom/set-accessor.ts` (modified, +32/-2)
```diff
@@ -9,9 +9,10 @@
 
 import { BUILD } from '@app-data';
 import { getHostRef, isMemberInElement, plt, win } from '@platform';
-import { isComplexType } from '../../utils/helpers';
 
 import type * as d from '../../declarations';
+import { HOST_FLAGS } from '../../utils/constants';
+import { isComplexType } from '../../utils/helpers';
 import { NODE_TYPE, VNODE_FLAGS, XLINK_NS } from '../runtime-constants';
 import { queueRefAttachment } from './vdom-render';
 
@@ -62,7 +63,15 @@ export const setAccessor = (
       newClasses = [...new Set(newClasses)].filter((c) => c);
       classList.add(...newClasses);
     } else {
-      classList.remove(...oldClasses.filter((c) => c && !newClasses.includes(c)));
+      let removedClasses = oldClasses.filter((c) => c && !newClasses.includes(c));
+      if (BUILD.hydrateClientSide && initialRender && !(flags & VNODE_FLAGS.isHost)) {
+        // on the first render after hydration, the old classes are the element's server
+        // `className`. For a child component that has already rendered, they include the
+        // classes it set on its own host, which the parent must not remove
+        const ownClasses = getOwnHostClasses(elm);
+        removedClasses = removedClasses.filter((c) => !ownClasses.includes(c));
+      }
+      classList.remove(...removedClasses);
       classList.add(...newClasses.filter((c) => c && !oldClasses.includes(c)));
     }
   } else if (BUILD.vdomStyle && memberName === 'style') {
@@ -263,6 +272,27 @@ const isEnumeratedAttribute = (attrName: string): boolean =>
   ENUMERATED_ATTRIBUTES.has(attrName) || attrName.startsWith('aria-');
 
 const parseClassListRegex = /\s/;
+
+/**
+ * Get the classes a rendered Stencil component set on its own host element: the classes
+ * of its `<Host>` and the hydrated flag.
+ *
+ * @param elm the element to check, which may be the host element of a Stencil component
+ * @returns the classes the component set on its host, or an empty list when `elm` is not
+ * the host of a rendered Stencil component
+ */
+const getOwnHostClasses = (elm: d.RenderNode): string[] => {
+  const hostRef = getHostRef(elm);
+  if (!hostRef || !(hostRef.$flags$ & HOST_FLAGS.hasRendered)) {
+    return [];
+  }
+  const ownClasses = parseClassList(hostRef.$vnode$?.$attrs$?.class);
+  if (BUILD.hydratedClass) {
+    ownClasses.push(BUILD.hydratedSelectorName ?? 'hydrated');
+  }
+  return ownClasses;
+};
+
 /**
  * Parsed a string of classnames into an array
  * @param value className string, e.g. "foo bar baz"
```

**File**: `src/runtime/vdom/test/set-accessor.spec.ts` (modified, +51/-0)
```diff
@@ -1,6 +1,9 @@
 import { BUILD } from '@app-data';
+import { getHostRef, registerHost } from '@platform';
 
+import { HOST_FLAGS } from '../../../utils/constants';
 import { VNODE_FLAGS } from '../../runtime-constants';
+import { newVNode } from '../h';
 import { parseClassList, setAccessor } from '../set-accessor';
 
 describe('setAccessor for custom elements', () => {
@@ -904,6 +907,54 @@ describe('setAccessor for standard html elements', () => {
       setAccessor(elm, 'class', 'something-old a-scope-id-something', 'something-new', false, 0);
       expect(elm.className).toEqual('something-new');
     });
+
+    describe('hydrated child component', () => {
+      // A child component that rendered its host as <Host class="own">, e.g. before its
+      // parent was defined in a custom elements build
+      const renderedChild = (tagName = 'cmp-child') => {
+        const elm = document.createElement(tagName) as any;
+        registerHost(elm, { $flags$: 0, $tagName$: tagName });
+        const hostRef = getHostRef(elm);
+        hostRef.$flags$ |= HOST_FLAGS.hasRendered;
+        hostRef.$vnode$ = newVNode(null, null);
+        hostRef.$vnode$.$attrs$ = { class: 'own own-state' };
+        elm.className = 'parent-old own own-state sc-cmp-child hydrated';
+        return elm;
+      };
+      // The old class the hydration seeds for the child: its full server `className`
+      const serverClassName = 'parent-old own own-state sc-cmp-child hydrated';
+
+      it('should keep the classes of its own host when the parent sets no class on initial render', () => {
+        const elm = renderedChild();
+        setAccessor(elm, 'class', serverClassName, undefined, false, 0, true);
+        expect(elm.className).toEqual('own own-state hydrated');
+      });
+
+      it('should keep the classes of its own host next to the classes of the parent on initial render', () => {
+        const elm = renderedChild();
+        setAccessor(elm, 'class', serverClassName, 'parent-new', false, 0, true);
+        expect(elm.className).toEqual('own own-state hydrated parent-new');
+      });
+
+      it('should keep the classes of its own host only on initial render', () => {
+        const elm = renderedChild();
+        setAccessor(elm, 'class', serverClassName, undefined, false, 0);
+        expect(elm.className).toEqual('');
+      });
+
+      it('should remove every old class when the child has not rendered yet', () => {
+        const elm = renderedChild();
+        getHostRef(elm).$flags$ &= ~HOST_FLAGS.hasRendered;
+        setAccessor(elm, 'class', serverClassName, undefined, false, 0, true);
+        expect(elm.className).toEqual('');
+      });
+
+      it('should remove every old class when the component renders its own host', () => {
+        const elm = renderedChild();
+        setAccessor(elm, 'class', serverClassName, undefined, false, VNODE_FLAGS.isHost, true);
+        expect(elm.className).toEqual('');
+      });
+    });
   });
 
   describe('style attribute', () => {
```

**File**: `test/wdio/ssr-hydration/class-child-cmp.tsx` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+import { Component, h, Host, Prop } from '@stencil/core';
+
+@Component({
+  tag: 'ssr-class-child-cmp',
+  shadow: true,
+})
+export class SsrClassChildCmp {
+  @Prop() disabled = false;
+
+  render() {
+    return (
+      <Host class={{ 'child-own': true, 'child-disabled': this.disabled }}>
+        <slot />
+      </Host>
+    );
+  }
+}
```

**File**: `test/wdio/ssr-hydration/class-cmp.test.tsx` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { browser } from '@wdio/globals';
+
+import { renderToString } from '../hydrate/index.mjs';
+import { setupIFrameTest } from '../util.js';
+
+describe('SSR > Client hydration of child component host classes', () => {
+  it('keeps the classes a child sets on its own host when it hydrates before its parent', async () => {
+    // an iframe, so no other test has defined the components through the lazy loader
+    await setupIFrameTest('/ssr-hydration/class-custom-element.html', 'class-custom-elements');
+    const frameEle: HTMLIFrameElement = document.querySelector('iframe#class-custom-elements');
+    const doc = frameEle.contentDocument;
+
+    const { html } = await renderToString(`<ssr-class-parent-cmp></ssr-class-parent-cmp>`, {
+      fullDocument: true,
+      serializeShadowRoot: 'declarative-shadow-dom',
+    });
+    const stage = doc.createElement('div');
+    stage.setAttribute('id', 'stage');
+    stage.setHTMLUnsafe(html);
+    doc.body.appendChild(stage);
+
+    // define the child first, so it hydrates and renders before its parent
+    const script = doc.createElement('script');
+    script.type = 'module';
+    script.textContent = `
+      import { defineCustomElement as defineChild } from '/test-components/ssr-class-child-cmp.js';
+      import { defineCustomElement as defineParent } from '/test-components/ssr-class-parent-cmp.js';
+      defineChild();
+      defineParent();
+    `;
+    doc.head.appendChild(script);
+
+    const parent = doc.querySelector('ssr-class-parent-cmp');
+    await browser.waitUntil(async () => !!frameEle.contentWindow.customElements.get('ssr-class-parent-cmp'));
+    await browser.pause(100);
+
+    const withClass = parent.shadowRoot.querySelector('#with-class');
+    const withoutClass = parent.shadowRoot.querySelector('#without-class');
+    await expect(Array.from(withClass.classList).sort()).toEqual([
+      'child-disabled',
+      'child-own',
+      'hydrated',
+      'parent-set',
+    ]);
+    await expect(Array.from(withoutClass.classList).sort()).toEqual(['child-disabled', 'child-own', 'hydrated']);
+  });
+});
```

**File**: `test/wdio/ssr-hydration/class-custom-element.html` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<html>
+<head>
+  <title>SSR testing host classes of hydrated child components</title>
+</head>
+<body>
+</body>
+</html>
```

---

### Incident Patch 5: `5a92cc7e` (2026-09-30)
**Commit Message**: fix(runtime): `document.hidden` page freezes (#6918)

* fix(runtime): `document.hidden` page freezes

* chore: spelling

**File**: `cspell-wordlist.txt` (modified, +2/-1)
```diff
@@ -155,4 +155,5 @@ jsxmode
 jsxdev
 jsxs
 labelable
-reentrancy
\ No newline at end of file
+reentrancy
+macrotask
\ No newline at end of file
```

**File**: `src/client/client-task-queue.ts` (modified, +5/-3)
```diff
@@ -12,9 +12,11 @@ const queueDomReads: d.RafCallback[] = [];
 const queueDomWrites: d.RafCallback[] = [];
 const queueDomWritesLow: d.RafCallback[] = [];
 
-// Fallback to microtask when `document.hidden`: `requestAnimationFrame` callbacks
-// do not fire so scheduling flush queues tasks indefinitely.
-const scheduleFlush = () => (win.document?.hidden ? nextTick(flush) : plt.raf(flush));
+// Fallback to a macrotask when `document.hidden`: `requestAnimationFrame` callbacks
+// do not fire so scheduling flush queues tasks indefinitely. A microtask can't be used
+// because `flush` reschedules itself while work remains, which would never yield to the browser.
+// The 16ms delay keeps flush pacing in line with a ~60fps `requestAnimationFrame`.
+const scheduleFlush = () => (win.document?.hidden ? setTimeout(flush, 16) : plt.raf(flush));
 
 const queueTask = (queue: d.RafCallback[], write: boolean) => (cb: d.RafCallback) => {
   queue.push(cb);
```

**File**: `src/client/test/client-task-queue.spec.ts` (modified, +23/-7)
```diff
@@ -3,6 +3,7 @@ import type { plt as pltType, win as winType } from '../client-window';
 describe('client task queue', () => {
   let plt: typeof pltType;
   let win: typeof winType;
+  let readTask: typeof import('../client-task-queue').readTask;
   let writeTask: typeof import('../client-task-queue').writeTask;
 
   beforeEach(() => {
@@ -11,14 +12,14 @@ describe('client task queue', () => {
     // otherwise leak between tests
     jest.resetModules();
     ({ plt, win } = require('../client-window'));
-    ({ writeTask } = require('../client-task-queue'));
+    ({ readTask, writeTask } = require('../client-task-queue'));
   });
 
   afterEach(() => {
     jest.restoreAllMocks();
   });
 
-  it('flushes a queued write task via a microtask when the document is hidden, without ever calling rAF', async () => {
+  it('flushes a queued write task via a macrotask when the document is hidden, without ever calling rAF', async () => {
     (win as any).document = { hidden: true };
     const rafSpy = jest.spyOn(plt, 'raf').mockImplementation(() => 0);
 
@@ -27,16 +28,31 @@ describe('client task queue', () => {
       called = true;
     });
 
-    expect(called).toBe(false);
-
-    // let the microtask queue drain
-    await Promise.resolve();
-    await Promise.resolve();
+    await new Promise((resolve) => setTimeout(resolve, 16));
 
     expect(called).toBe(true);
     expect(rafSpy).not.toHaveBeenCalled();
   });
 
+  it('yields to the event loop between flushes when reads and writes keep queuing each other while the document is hidden', async () => {
+    (win as any).document = { hidden: true };
+
+    let rounds = 0;
+    const measure = () => {
+      rounds++;
+      writeTask(render);
+    };
+    const render = () => rounds < 2 && readTask(measure);
+    readTask(measure);
+
+    // a macrotask queued now must run before the second flush
+    await new Promise((resolve) => setTimeout(resolve, 16));
+    expect(rounds).toBe(1);
+
+    await new Promise((resolve) => setTimeout(resolve, 16));
+    expect(rounds).toBe(2);
+  });
+
   it('still schedules the flush via rAF when the document is visible', async () => {
     (win as any).document = { hidden: false };
     let rafCallback: FrameRequestCallback | undefined;
```

---

### Incident Patch 6: `e2e5dfc0` (2026-09-24)
**Commit Message**: fix(runtime): lazy getter/setter `@Prop` writes before first render (#6909)

**File**: `src/runtime/initialize-component.ts` (modified, +2/-1)
```diff
@@ -7,7 +7,7 @@ import { expandPartSelectors, scopeCss } from '../utils/shadow-css';
 import { computeMode } from './mode';
 import { normalizeWatchers } from './normalize-watchers';
 import { createTime, uniqueTime } from './profile';
-import { proxyComponent } from './proxy-component';
+import { proxyComponent, replayPendingSetterValues } from './proxy-component';
 import { MAX_LAZY_LOAD_RETRIES, PROXY_FLAGS } from './runtime-constants';
 import { getScopeId, registerStyle } from './styles';
 import { safeCall, scheduleUpdate } from './update-component';
@@ -95,6 +95,7 @@ export const initializeComponent = async (
 
         if (BUILD.member) {
           hostRef.$flags$ &= ~HOST_FLAGS.isConstructingInstance;
+          replayPendingSetterValues(hostRef, cmpMeta);
         }
         if (BUILD.propChangeCallback) {
           hostRef.$flags$ |= HOST_FLAGS.isWatchReady;
```

**File**: `src/runtime/proxy-component.ts` (modified, +29/-46)
```diff
@@ -19,6 +19,27 @@ import { getValue, setValue } from './set-value';
 const reflectedAttrValue = (propValue: any): string | null =>
   propValue == null || propValue === false ? null : propValue === true ? '' : String(propValue);
 
+/**
+ * Hand values written to a lazy component's element before its instance existed to the
+ * instance's own `@Prop` setters. Must run as soon as the instance is constructed, so that
+ * whenever `$lazyInstance$` is set, reads through it agree with the element's last write.
+ *
+ * @param hostRef the runtime bookkeeping object of a freshly constructed lazy instance
+ * @param cmpMeta runtime metadata for the component (with any run-time only setters flagged)
+ */
+export const replayPendingSetterValues = (hostRef: d.HostRef, cmpMeta: d.ComponentRuntimeMeta) => {
+  const instance = hostRef.$lazyInstance$;
+  if (!instance) return;
+  for (const [memberName, [memberFlags]] of Object.entries(cmpMeta.$members$ ?? {})) {
+    if (memberFlags & MEMBER_FLAGS.Setter && hostRef.$instanceValues$.has(memberName)) {
+      const pendingValue = hostRef.$instanceValues$.get(memberName);
+      if (instance[memberName] !== pendingValue) {
+        instance[memberName] = pendingValue;
+      }
+    }
+  }
+};
+
 /**
  * Attach a series of runtime constructs to a compiled Stencil component
  * constructor, including getters and setters for the `@Prop` and `@State`
@@ -114,9 +135,9 @@ export const proxyComponent = (
                   return getValue(this, memberName);
                 }
                 const ref = getHostRef(this);
-                const instance = ref ? ref.$lazyInstance$ : prototype;
-                if (!instance) return;
-                return instance[memberName];
+                if (!ref) return prototype[memberName];
+                // no instance yet: return the pending value, same as a plain Prop
+                return ref.$lazyInstance$ ? ref.$lazyInstance$[memberName] : getValue(this, memberName);
               }
               if (!BUILD.lazyLoad) {
                 return origGetter ? origGetter.apply(this) : getValue(this, memberName);
@@ -202,21 +223,6 @@ export const proxyComponent = (
                 (cmpMeta.$members$[memberName][0] & MEMBER_FLAGS.Setter) === 0
               ) {
                 setValue(this, memberName, newValue, cmpMeta);
-                // if this is a value set on an Element *before* the instance has initialized (e.g. via an html attr)...
-                if (flags & PROXY_FLAGS.isElementConstructor && !ref.$lazyInstance$) {
-                  // wait for lazy instance...
-                  ref.$fetchedCbList$.push(() => {
-                    // check if this instance member has a setter doesn't match what's already on the element
-                    if (
-                      cmpMeta.$members$[memberName][0] & MEMBER_FLAGS.Setter &&
-                      ref.$lazyInstance$[memberName] !== ref.$instanceValues$.get(memberName)
-                    ) {
-                      // this catches cases where there's a run-time only setter (e.g. via a decorator)
-                      // *and* no initial value, so the initial setter never gets called
-                      ref.$lazyInstance$[memberName] = newValue;
-                    }
-                  });
-                }
                 return;
               }
 
@@ -228,7 +234,7 @@ export const proxyComponent = (
                 memberFlags,
                 BUILD.formAssociated && !!(cmpMeta.$flags$ & CMP_FLAGS.formAssociated),
               );
-              const setterSetVal = (val: any) => {
+              if (ref.$lazyInstance$) {
                 const currentValue = ref.$lazyInstance$[memberName];
                 if (!ref.$instanceValues$.get(memberName) && currentValue) {
                   // on init `get()` make sure the hostRef matches class instance
@@ -241,25 +247,12 @@ export const proxyComponent = (
                 }
                 // this sets the value via the `set()`
```

**File**: `test/wdio/prop-setter-lazy-race/cmp-cold.tsx` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+import { Component, Prop } from '@stencil/core';
+
+/**
+ * Only ever touched by one test, so its chunk is guaranteed to still be loading when that test
+ * writes to it.
+ */
+@Component({
+  tag: 'prop-setter-lazy-race-cold',
+})
+export class PropSetterLazyRaceCold {
+  private _isDisabled = false;
+  @Prop()
+  get isDisabled() {
+    return this._isDisabled;
+  }
+  set isDisabled(newValue: boolean) {
+    this._isDisabled = newValue;
+  }
+
+  private _note = '';
+  @Prop()
+  get note() {
+    return this._note;
+  }
+  set note(newValue: string) {
+    this._note = newValue;
+  }
+
+  render() {
+    return `${this.isDisabled}`;
+  }
+}
```

**File**: `test/wdio/prop-setter-lazy-race/cmp.test.tsx` (modified, +58/-0)
```diff
@@ -57,4 +57,62 @@ describe('getter/setter @Prop write ordering before first render', () => {
     expect(el.isReadonly).toBe(false);
     expect(el.hasAttribute('is-readonly')).toBe(false);
   });
+
+  it('the last attribute write wins when it lands before the lazy instance exists', async () => {
+    await customElements.whenDefined('prop-setter-lazy-race-cold');
+
+    // not connected yet
+    const detached = document.createElement('prop-setter-lazy-race-cold') as any;
+    detached.setAttribute('is-disabled', '');
+    detached.removeAttribute('is-disabled');
+    document.body.appendChild(detached);
+
+    // connected, but the component's chunk is still loading
+    const loading = document.createElement('prop-setter-lazy-race-cold') as any;
+    document.body.appendChild(loading);
+    loading.setAttribute('is-disabled', '');
+    loading.removeAttribute('is-disabled');
+
+    // reads before the instance exists return the pending value, same as a plain @Prop
+    loading.note = 'pending';
+    expect(loading.note).toBe('pending');
+
+    await Promise.all([detached.componentOnReady(), loading.componentOnReady()]);
+
+    expect(detached.isDisabled).toBe(false);
+    expect(loading.isDisabled).toBe(false);
+    expect(loading.note).toBe('pending');
+  });
+
+  it('an attribute write equal to the current instance value is not dropped before first render', async () => {
+    const warmup = document.createElement('prop-setter-lazy-race');
+    document.body.appendChild(warmup);
+    await warmup.componentOnReady();
+
+    const el = document.createElement('prop-setter-lazy-race') as any;
+    el.count = 5;
+    document.body.appendChild(el);
+
+    // `0` is the instance's constructor default; it must still override the earlier `5`
+    el.setAttribute('count', '0');
+
+    await el.componentOnReady();
+
+    expect(el.count).toBe(0);
+  });
+
+  it("the instance's connectedCallback sees writes made before it was constructed", async () => {
+    const warmup = document.createElement('prop-setter-lazy-race');
+    document.body.appendChild(warmup);
+    await warmup.componentOnReady();
+
+    const el = document.createElement('prop-setter-lazy-race') as any;
+    el.isReadonly = true;
+    el.count = 3;
+    document.body.appendChild(el);
+
+    await el.componentOnReady();
+
+    expect(el.connectedSnapshot).toBe('true-3');
+  });
 });
```

**File**: `test/wdio/prop-setter-lazy-race/cmp.tsx` (modified, +15/-0)
```diff
@@ -15,6 +15,21 @@ export class PropSetterLazyRace {
     this._isReadonly = !!newValue;
   }
 
+  private _count = 0;
+  @Prop()
+  get count() {
+    return this._count;
+  }
+  set count(newValue: number) {
+    this._count = newValue;
+  }
+
+  @Prop({ mutable: true }) connectedSnapshot = '';
+
+  connectedCallback() {
+    this.connectedSnapshot = `${this.isReadonly}-${this.count}`;
+  }
+
   render() {
     return `${this.isReadonly}-${this.plainReadonly}`;
   }
```

---

### Incident Patch 7: `f971133d` (2026-09-24)
**Commit Message**: fix(runtime): form-associated boolean attribute `"false"` parses as true (#6908)

**File**: `src/runtime/proxy-component.ts` (modified, +5/-2)
```diff
@@ -430,9 +430,12 @@ export const proxyComponent = (
           const isSpuriousBooleanRemoval = isBooleanTarget && newValue === null && this[propName] === undefined;
 
           // special handling of boolean attributes. Null (removal) means false.
-          // everything else means true (including an empty string
+          // everything else means true (including an empty string).
+          // Non form-associated components also treat the string "false" as false; form-associated
+          // components follow the HTML spec, where any present attribute is true (see `parsePropertyValue()`)
           if (isBooleanTarget) {
-            (newValue as any) = newValue === null || newValue === 'false' ? false : true;
+            const isFormAssociated = BUILD.formAssociated && !!(cmpMeta.$flags$ & CMP_FLAGS.formAssociated);
+            (newValue as any) = newValue === null || (newValue === 'false' && !isFormAssociated) ? false : true;
           }
 
           // A lazy getter/setter Prop's element-side read (`this[propName]`) goes through to the
```

**File**: `test/wdio/form-associated/prop-check-attr.test.tsx` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import { h } from '@stencil/core';
+import { render } from '@wdio/browser-runner/stencil';
+import { browser, expect } from '@wdio/globals';
+
+describe('form associated boolean attributes', function () {
+  let container: HTMLElement;
+
+  beforeEach(async () => {
+    render({
+      components: [],
+      template: () => <div id="attr-container"></div>,
+    });
+    container = document.querySelector('#attr-container');
+  });
+
+  const getText = (el: Element) => el.shadowRoot?.querySelector('p')?.textContent;
+
+  it('treats a parsed `disabled="false"` attribute as true', async () => {
+    container.innerHTML = `<form-associated-prop-check disabled="false"></form-associated-prop-check>`;
+    const cmp = container.querySelector('form-associated-prop-check');
+
+    await browser.waitUntil(async () => getText(cmp) === 'Disabled prop value: true');
+    expect(cmp.disabled).toBe(true);
+  });
+
+  it('treats `setAttribute("disabled", "false")` as true and attribute removal as false', async () => {
+    container.innerHTML = `<form-associated-prop-check></form-associated-prop-check>`;
+    const cmp = container.querySelector('form-associated-prop-check');
+    await browser.waitUntil(async () => getText(cmp) === 'Disabled prop value: undefined');
+
+    cmp.setAttribute('disabled', 'false');
+    await browser.waitUntil(async () => getText(cmp) === 'Disabled prop value: true');
+    expect(cmp.disabled).toBe(true);
+
+    cmp.removeAttribute('disabled');
+    await browser.waitUntil(async () => getText(cmp) === 'Disabled prop value: false');
+    expect(cmp.disabled).toBe(false);
+  });
+});
```

---

### Incident Patch 8: `ca9273df` (2026-09-23)
**Commit Message**: fix(ssr): clear modeResolutionChain on `setMode`. Fixes memory leak (#6903)

**File**: `src/client/client-style.ts` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import type * as d from '../declarations';
 
 export const styles: d.StyleMap = /*@__PURE__*/ new Map();
-export const modeResolutionChain: d.ResolutionHandler[] = [];
+export const modeResolver: d.ResolutionHandler[] = [];
 export const setScopedSSR = (_opts: d.HydrateFactoryOptions) => {};
 export const needsScopedSSR = () => false;
```

**File**: `src/compiler/output-targets/dist-hydrate-script/generate-hydrate-app.ts` (modified, +3/-7)
```diff
@@ -11,11 +11,7 @@ import {
   STENCIL_MOCK_DOC_ID,
 } from '../../bundle/entry-alias-ids';
 import { bundleHydrateFactory } from './bundle-hydrate-factory';
-import {
-  HYDRATE_FACTORY_INTRO,
-  HYDRATE_FACTORY_OUTRO,
-  MODE_RESOLUTION_CHAIN_DECLARATION,
-} from './hydrate-factory-closure';
+import { HYDRATE_FACTORY_INTRO, HYDRATE_FACTORY_OUTRO, MODE_RESOLVER_DECLARATION } from './hydrate-factory-closure';
 import { updateToHydrateComponents } from './update-to-hydrate-components';
 import { writeHydrateOutputs } from './write-hydrate-outputs';
 
@@ -86,11 +82,11 @@ export const generateHydrateApp = async (
           },
           transform(code) {
             /**
-             * Remove the modeResolutionChain variable from the generated code.
+             * Remove the modeResolution variable from the generated code.
              * This variable is redefined in `HYDRATE_FACTORY_INTRO` to ensure we can
              * use it within the hydrate and global runtime.
              */
-            return code.replace(`var ${MODE_RESOLUTION_CHAIN_DECLARATION}`, '');
+            return code.replace(`var ${MODE_RESOLVER_DECLARATION}`, '');
           },
         },
       ],
```

**File**: `src/compiler/output-targets/dist-hydrate-script/hydrate-factory-closure.ts` (modified, +4/-4)
```diff
@@ -1,16 +1,16 @@
 export const HYDRATE_APP_CLOSURE_START = `/*hydrateAppClosure start*/`;
 
-export const MODE_RESOLUTION_CHAIN_DECLARATION = `modeResolutionChain = [];`;
+export const MODE_RESOLVER_DECLARATION = `modeResolver = [];`;
 
 /**
  * This is the entry point for the hydrate factory.
  *
- * __Note:__ the `modeResolutionChain` will be uncommented in the
+ * __Note:__ the `modeResolver` will be uncommented in the
  * `src/compiler/output-targets/dist-hydrate-script/write-hydrate-outputs.ts` file. This enables us to use
- * one module resolution chain across hydrate and core runtime.
+ * one mode resolver across hydrate and core runtime.
  */
 export const HYDRATE_FACTORY_INTRO = `
-// const ${MODE_RESOLUTION_CHAIN_DECLARATION}
+// const ${MODE_RESOLVER_DECLARATION}
 
 // captured here, at true module scope, before hydrateFactory shadows the
 // AbortController identifier for component code below.
```

**File**: `src/compiler/output-targets/dist-hydrate-script/write-hydrate-outputs.ts` (modified, +3/-6)
```diff
@@ -4,7 +4,7 @@ import type { RollupOutput } from 'rollup';
 
 import type * as d from '../../../declarations';
 import { optimizeModule } from '../../optimize/optimize-module';
-import { MODE_RESOLUTION_CHAIN_DECLARATION } from './hydrate-factory-closure';
+import { MODE_RESOLVER_DECLARATION } from './hydrate-factory-closure';
 import { relocateHydrateContextConst } from './relocate-hydrate-context';
 
 export const writeHydrateOutputs = (
@@ -66,12 +66,9 @@ const writeHydrateOutput = async (
         let code = relocateHydrateContextConst(config, compilerCtx, output.code);
 
         /**
-         * Enable the line where we define `modeResolutionChain` for the hydrate module.
+         * Enable the line where we define `modeResolver` for the hydrate module.
          */
-        code = code.replace(
-          `// const ${MODE_RESOLUTION_CHAIN_DECLARATION}`,
-          `const ${MODE_RESOLUTION_CHAIN_DECLARATION}`,
-        );
+        code = code.replace(`// const ${MODE_RESOLVER_DECLARATION}`, `const ${MODE_RESOLVER_DECLARATION}`);
 
         /**
          * Inject the $stencilTagTransform variable definition.
```

**File**: `src/hydrate/platform/hydrate-app.ts` (modified, +26/-2)
```diff
@@ -1,6 +1,14 @@
 import { globalScripts } from '@app-globals';
-import { addHostEventListeners, getHostRef, loadModule, plt, registerHost, setScopedSSR } from '@platform';
-import { connectedCallback, insertVdomAnnotations } from '@runtime';
+import {
+  addHostEventListeners,
+  getHostRef,
+  loadModule,
+  modeResolver,
+  plt,
+  registerHost,
+  setScopedSSR,
+} from '@platform';
+import { connectedCallback, insertVdomAnnotations, setMode } from '@runtime';
 import { CMP_FLAGS } from '@utils';
 
 import type * as d from '../../declarations';
@@ -29,6 +37,9 @@ export function hydrateApp(
 
   let tmrId: any;
   let ranCompleted = false;
+  // In case a per-call `opts.modes` is provided, cache any global mode
+  // resolver so we can restore it after the render is complete
+  let modeResolverSnapshot: d.ResolutionHandler[] | undefined;
   // Resolves once the render is finalizing (error or timeout), so components
   // still mid-`await` can stop waiting instead of resuming against a window
   // that's about to be torn down, and so their own in-flight `fetch()` calls
@@ -47,6 +58,12 @@ export function hydrateApp(
     createdElements.clear();
     connectedElements.clear();
 
+    if (modeResolverSnapshot) {
+      modeResolver.length = 0;
+      modeResolver.push(...modeResolverSnapshot);
+      modeResolverSnapshot = undefined;
+    }
+
     if (!ranCompleted) {
       ranCompleted = true;
       try {
@@ -191,6 +208,13 @@ export function hydrateApp(
 
     globalScripts();
 
+    // Apply `opts.modes` after the global script runs
+    // so an explicit per-call override always wins
+    if (Array.isArray(opts.modes)) {
+      modeResolverSnapshot = modeResolver.slice();
+      opts.modes.forEach((mode) => setMode(mode));
+    }
+
     patchChild(win.document.body);
 
     waitLoop().then(hydratedComplete).catch(hydratedError);
```

---

### Incident Patch 9: `1c81131f` (2026-09-21)
**Commit Message**: fix(docs): derive CEM readonly from getter/setter instead of mutable (#6900)

**File**: `src/compiler/docs/cem/index.ts` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ const componentToDeclaration = (component: d.JsonDocsComponent): CustomElementDe
         ...(prop.type && { type: createType(prop.type, prop.complexType?.references) }),
         ...(prop.default !== undefined && { default: prop.default }),
         ...(prop.deprecation !== undefined && { deprecated: prop.deprecation || true }),
-        ...(!prop.mutable && { readonly: true }),
+        ...(prop.getter && !prop.setter && { readonly: true }),
         ...(prop.attr && { attribute: prop.attr }),
         ...(prop.reflectToAttr && { reflects: true }),
       }),
```

**File**: `src/compiler/docs/test/custom-elements-manifest.spec.ts` (modified, +72/-0)
```diff
@@ -208,9 +208,59 @@ describe('custom-elements-manifest', () => {
     expect(field).toBeDefined();
     expect(field.name).toBe('count');
     expect(field.type).toEqual({ text: 'number' });
+    expect(field.readonly).toBeUndefined();
+  });
+
+  it('marks props with a getter and no setter as readonly', async () => {
+    const docsData: d.JsonDocs = {
+      timestamp: 'test',
+      compiler: { name: '@stencil/core', version: '1.0.0', typescriptVersion: '4.0.0' },
+      components: [
+        createMockComponent({
+          tag: 'my-component',
+          filePath: 'src/my-component.tsx',
+          props: [createMockProp({ name: 'readOnlyProp', getter: true, setter: false })],
+        }),
+      ],
+      typeLibrary: {},
+    };
+    const outputTargets: d.OutputTargetDocsCustomElementsManifest[] = [
+      { type: 'docs-custom-elements-manifest', file: '/output/custom-elements.json' },
+    ];
+
+    await generateCustomElementsManifestDocs(compilerCtx, docsData, outputTargets);
+
+    const writtenContent = JSON.parse(writeFileSpy.mock.calls[0][1]);
+    const field = writtenContent.modules[0].declarations[0].members.find((m: any) => m.kind === 'field');
+    expect(field.name).toBe('readOnlyProp');
     expect(field.readonly).toBe(true);
   });
 
+  it('does not mark props with both a getter and a setter as readonly', async () => {
+    const docsData: d.JsonDocs = {
+      timestamp: 'test',
+      compiler: { name: '@stencil/core', version: '1.0.0', typescriptVersion: '4.0.0' },
+      components: [
+        createMockComponent({
+          tag: 'my-component',
+          filePath: 'src/my-component.tsx',
+          props: [createMockProp({ name: 'validatedProp', getter: true, setter: true })],
+        }),
+      ],
+      typeLibrary: {},
+    };
+    const outputTargets: d.OutputTargetDocsCustomElementsManifest[] = [
+      { type: 'docs-custom-elements-manifest', file: '/output/custom-elements.json' },
+    ];
+
+    await generateCustomElementsManifestDocs(compilerCtx, docsData, outputTargets);
+
+    const writtenContent = JSON.parse(writeFileSpy.mock.calls[0][1]);
+    const field = writtenContent.modules[0].declarations[0].members.find((m: any) => m.kind === 'field');
+    expect(field.name).toBe('validatedProp');
+    expect(field.readonly).toBeUndefined();
+  });
+
   it('includes methods', async () => {
     const docsData: d.JsonDocs = {
       timestamp: 'test',
@@ -613,3 +663,25 @@ function createMockComponent(overrides: Partial<d.JsonDocsComponent> = {}): d.Js
     ...overrides,
   };
 }
+
+/**
+ * Helper to create a mock JsonDocsProp with sensible defaults
+ * @param overrides the fields to override on the generated prop
+ * @returns a mock JsonDocsProp
+ */
+function createMockProp(overrides: Partial<d.JsonDocsProp> = {}): d.JsonDocsProp {
+  return {
+    name: 'myProp',
+    type: 'string',
+    mutable: false,
+    reflectToAttr: false,
+    docs: '',
+    docsTags: [],
+    values: [],
+    optional: false,
+    required: false,
+    getter: false,
+    setter: false,
+    ...overrides,
+  };
+}
```

**File**: `test/end-to-end/custom-elements-manifest.json` (modified, +0/-23)
```diff
@@ -38,7 +38,6 @@
                   }
                 ]
               },
-              "readonly": true,
               "attribute": "car"
             }
           ]
@@ -99,7 +98,6 @@
                   }
                 ]
               },
-              "readonly": true,
               "attribute": "cars"
             },
             {
@@ -254,7 +252,6 @@
                   }
                 ]
               },
-              "readonly": true,
               "attribute": "car"
             }
           ]
@@ -315,7 +312,6 @@
                   }
                 ]
               },
-              "readonly": true,
               "attribute": "cars"
             },
             {
@@ -488,7 +484,6 @@
                 "text": "number"
               },
               "default": "0",
-              "readonly": true,
               "attribute": "initial-counter"
             }
           ]
@@ -1100,7 +1095,6 @@
                 "text": "number"
               },
               "default": "0",
-              "readonly": true,
               "attribute": "some-prop"
             },
             {
@@ -1240,7 +1234,6 @@
               "type": {
                 "text": "string"
               },
-              "readonly": true,
               "attribute": "foo-prop"
             },
             {
@@ -1250,7 +1243,6 @@
               "type": {
                 "text": "any"
               },
-              "readonly": true,
               "attribute": "mode"
             }
           ]
@@ -1328,7 +1320,6 @@
               "type": {
                 "text": "string"
               },
-              "readonly": true,
               "attribute": "foo-prop"
             },
             {
@@ -1338,7 +1329,6 @@
               "type": {
                 "text": "any"
               },
-              "readonly": true,
               "attribute": "mode"
             }
           ]
@@ -1743,7 +1733,6 @@
                 "text": "string"
               },
               "default": "'life preservers'",
-              "readonly": true,
               "attribute": "clothes"
             },
             {
@@ -1752,7 +1741,6 @@
               "type": {
                 "text": "string"
               },
-              "readonly": true,
               "attribute": "first"
             },
             {
@@ -1770,7 +1758,6 @@
               "type": {
                 "text": "string"
               },
-              "readonly": true,
               "attribute": "last-name"
             },
             {
@@ -1780,7 +1767,6 @@
               "type": {
                 "text": "any"
               },
-              "readonly": true,
               "attribute": "mode"
             }
           ]
@@ -1919,7 +1905,6 @@
                 "text": "string"
               },
               "default": "'basicProp'",
-              "readonly": true,
               "attribute": "basic-prop",
               "reflects": true
             },
@@ -1929,7 +1914,6 @@
               "type": {
                 "text": "number"
               },
-              "readonly": true,
               "attribute": "decorated-getter-setter-prop",
               "reflects": true
             },
@@ -1940,7 +1924,6 @@
                 "text": "number"
               },
               "default": "-10",
-              "readonly": true,
               "attribute": "decorated-prop",
               "reflects": true
             }
@@ -2001,7 +1984,6 @@
                   }
                 ]
               },
-              "readonly": true,
               "attribute": "car"
             }
           ]
@@ -2062,7 +2044,6 @@
                   }
                 ]
               },
-              "readonly": true,
               "attribute": "cars"
             },
             {
@@ -2279,7 +2260,6 @@
               "type": {
                 "text": "string"
               },
-              "readonly": true,
               "attribute": "label"
             }
           ],
@@ -2334,7 +2314,6
```

---

### Incident Patch 10: `332a8fad` (2026-09-15)
**Commit Message**: fix(compiler): correct CSS minifier selector-list splitting (#6895)

* fix(compiler): fix css minifier nested parens selectors

* chore: add comments

* fix(compiler): esm css respects minify false config

* chore: revert css minify

**File**: `src/compiler/style/css-parser/parse-css.ts` (modified, +47/-9)
```diff
@@ -4,6 +4,49 @@ import { type CssNode, CssNodeType, type CssParsePosition, type ParseCssResults
 // (note - We can't use something like postcss / lightningCSS here
 // because it would be bundled in the user's hydrate-script)
 
+/**
+ * Splits a selector list on top-level commas in a single pass: a comma only
+ * splits when it's outside a quoted string and at paren depth 0, so commas in
+ * `:is(:a,:has(:b))` or `[title="a,b"]` aren't treated as separators.
+ * Backslash escapes (inside or outside a string) are skipped so they can't shift state,
+ * so e.g. `[title="a\,b"]` is treated as a single selector.
+ */
+const splitSelectorList = (selectors: string): string[] => {
+  const parts: string[] = [];
+  let depth = 0;
+  let quote: string | null = null;
+  let start = 0;
+
+  for (let i = 0; i < selectors.length; i++) {
+    const ch = selectors[i];
+
+    if (quote) {
+      if (ch === '\\') {
+        i++;
+      } else if (ch === quote) {
+        quote = null;
+      }
+      continue;
+    }
+
+    if (ch === '"' || ch === "'") {
+      quote = ch;
+    } else if (ch === '\\') {
+      i++;
+    } else if (ch === '(') {
+      depth++;
+    } else if (ch === ')') {
+      depth = Math.max(0, depth - 1);
+    } else if (ch === ',' && depth === 0) {
+      parts.push(selectors.slice(start, i));
+      start = i + 1;
+    }
+  }
+  parts.push(selectors.slice(start));
+
+  return parts.map((s) => s.trim());
+};
+
 /**
  * Parses CSS string input into an AST representation.
  * Used for minification, finding & resolving URLs and during SSR / prerendering, removing unused selectors.
@@ -164,15 +207,10 @@ export const parseCss = (css: string, filePath?: string): ParseCssResults => {
     const m: any = match(/^([^{]+)/);
     if (!m) return null;
 
-    return trim(m[0])
-      .replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '')
-      .replace(/"(?:\\"|[^"])*"|'(?:\\'|[^'])*'/g, function (m) {
-        return m.replace(/,/g, '\u200C');
-      })
-      .split(/\s*(?![^(]*\)),\s*/)
-      .map(function (s) {
-        return s.replace(/\u200C/g, ',');
-      });
+    // Remove comments and trim
+    const cleaned = trim(m[0]).replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '');
+
+    return splitSelectorList(cleaned);
   };
 
   const declaration = () => {
```

**File**: `src/compiler/style/css-parser/test/parse-serialize.spec.ts` (modified, +7/-0)
```diff
@@ -293,6 +293,13 @@ describe('css parse/serialize', () => {
       `abbr[title] , abbr   [title="hello   world"] {   cursor: help;  border-bottom:  1px dotted  #777;}`,
       `abbr[title],abbr [title="hello   world"]{cursor:help;border-bottom:1px dotted  #777}`,
     ],
+    [
+      `comma-selector-nested-parens`,
+      `x:is(:a,:has(:b),.c),y:is(:a,:has(:b),.c){color:red}.after{color:blue}`,
+      `x:is(:a,:has(:b),.c),y:is(:a,:has(:b),.c){color:red}.after{color:blue}`,
+    ],
+    [`comma-attribute-with-paren`, `[title="a(b"],div{color:red}`, `[title="a(b"],div{color:red}`],
+    [`comma-selector-escaped`, `.foo\\,bar,div{color:red}`, `.foo\\,bar,div{color:red}`],
   ])('%s', (_testName, cssString, expectedOutput) => {
     const results = parseCss(cssString);
     const output = serializeCss(results.stylesheet, {});
```

**File**: `src/compiler/style/test/optimize-css.spec.ts` (modified, +8/-0)
```diff
@@ -130,6 +130,14 @@ describe('optimizeCss', () => {
     expect(output).toBe(`h1+p,h2,h3{color:red}`);
   });
 
+  it('minifies selectors with nested parens', async () => {
+    const styleText = `x:is(:a,:has(:b),.c),y:is(:a,:has(:b),.c){color:red}.after{color:blue}`;
+    const output = await optimizeCss(config, compilerCtx, diagnostics, styleText, MOCK_FILE_PATH);
+
+    expect(diagnostics).toHaveLength(0);
+    expect(output).toBe(`x:is(:a,:has(:b),.c),y:is(:a,:has(:b),.c){color:red}.after{color:blue}`);
+  });
+
   it('minify-params', async () => {
     const styleText = `
       @media only screen   and ( min-width: 400px, min-height: 500px ) {
```

#### Recent Merged Pull Requests:
- **PR #6920** (2026-09-30): refactor(runtime): revert #6912 in-favour of children always waiting for parents to hydrate (@johnjenkins)
- **PR #6919** (closed): fix(ssr): lost child-rendered-first classes (@johnjenkins)
- **PR #6918** (2026-09-30): fix(runtime): `document.hidden` page freezes (@johnjenkins)
- **PR #6916** (2026-09-30): fix(compiler): exclude configured components from collection output (@lzeiml)
- **PR #6915** (2026-09-29): chore(deps-dev): bump ip-address from 10.4.0 to 10.7.2 (@dependabot[bot])
- **PR #6914** (2026-09-30): fix(scope-css): scope rules inside @container (@breken-ai)
- **PR #6913** (2026-09-30): fix(mock-doc): support force in classList.toggle (@breken-ai)
- **PR #6912** (2026-09-30): fix(runtime): keep child host classes on first render after hydration (@marcomattes)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
