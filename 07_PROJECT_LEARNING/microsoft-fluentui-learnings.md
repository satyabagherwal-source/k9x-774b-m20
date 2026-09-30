# Forensic Learning Record (Deep Inspection): microsoft/fluentui

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-fluentui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/fluentui](https://github.com/microsoft/fluentui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:25:24.110Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/fluentui`
- **Description**: Fluent UI web represents a collection of utilities, React components, and web components for building web applications.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 20303 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.storybook/main.js`
```
const path = require('path');
const fs = require('fs');
// ESM import workaround for CJS modules
const remarkGfm = require('remark-gfm').default;

const {
  loadWorkspaceAddon,
  registerTsPaths,
  registerRules,
  rules,
  processBabelLoaderOptions,
  getImportMappingsForExportToSandboxAddon,
} = require('@fluentui/scripts-storybook');

const tsConfigPath = path.resolve(__dirname, '../tsconfig.base.json');

const previewHeadTemplate = fs.readFileSync(path.resolve(__dirname, 'preview-head-template.html'), 'utf8');

module.exports = /** @type {import('./types').StorybookConfig} */ ({
  stories: [],
  addons: [
    '@storybook/addon-a11y',
    {
      name: '@storybook/addon-docs',
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            // Enable GitHub Flavored Markdown support in MDX files
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
    '@storybook/addon-links',

    // internal monorepo custom addons
    /**  {@link file://./../packages/react-components/react-storybook-addon/package.json} */
    loadWorkspaceAddon('@fluentui/react-storybook-addon', { tsConfigPath }),
    /** {@link file://./../packages/react-components/react-storybook-addon-export-to-sandbox/package.json} */
    loadWorkspaceAddon('@fluentui/react-storybook-addon-export-to-sandbox', {
      tsConfigPath,
      /** @type {import('../packages/react-components/react-storybook-addon-export-to-sandbox/src/index').PresetConfig} */
      options: {
        importMappings: getImportMappingsForExportToSandboxAddon(),
        babelLoaderOptionsUpdater: processBabelLoaderOptions,
        webpackRule: {
          test: /\.stories\.tsx$/,
          include: /stories/,
        },
      },
    }),
  ],
  webpackFinal: config => {
    registerRules({ config, rules: [rules.swcRule] });
    registerTsPaths({ config, configFile: tsConfigPath });

    if ((process.env.CI || process.env.TF_BUILD) && config.plugins) {
      // Disable ProgressPlugin in PR/CI builds to reduce log verbosity (warnings and errors are still logged)
      config.plugins = config.plugins.filter(value => value && value.constructor.name !== 'ProgressPlugin');
    }

    return config;
  },
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      builder: {
        lazyCompilation: true,
      },
    },
  },
  /**
   * Programmatically enhance previewHead as inheriting just static file `preview-head.html` doesn't work in monorepo
   * @see https://storybook.js.org/docs/addons/writing-presets#ui-configuration
   */
  previewHead: head => head + previewHeadTemplate,

  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
});

```

### Core Architecture Module: `.storybook/preview.js`
```
import '../packages/react-components/react-storybook-addon/src/styles.css';
import '../packages/react-components/react-storybook-addon-export-to-sandbox/src/styles.css';
import { withLinks } from '@storybook/addon-links';

/** @typedef {import('../packages/react-components/react-storybook-addon-export-to-sandbox/src/index').Parameters & import('@storybook/react').Parameters} Parameters */

/** @type {import('@storybook/react').Decorator[]} */
export const decorators = [withLinks];

/** @type {Parameters} */
export const parameters = {
  viewMode: 'docs',
  controls: {
    disable: true,
    expanded: true,
  },
  docs: {
    source: {
      excludeDecorators: true,
      type: 'code',
    },
  },
  exportToSandbox: {
    provider: 'stackblitz-cloud',
    bundler: 'vite',
    requiredDependencies: {
      // for React
      react: '^18',
      'react-dom': '^18',
      // necessary for FluentProvider:
      '@fluentui/react-components': '^9.0.0',
    },
    optionalDependencies: {
      '@fluentui/react-icons': 'latest',
    },
  },
};

```

### Core Architecture Module: `.storybook/react-icons-webpack.js`
```
// @ts-check

const FluentUIReactIconsFontSubsettingPlugin = require('@fluentui/react-icons-font-subsetting-webpack-plugin').default;

const FONT_ICON_VARIANT = 'fonts';
const iconLoader = require.resolve('@fluentui/react-icons-atomic-webpack-loader');
const headlessBaseStyles = require.resolve('@fluentui/react-icons/headless/styles.css');
const headlessFontStyles = require.resolve('@fluentui/react-icons/headless/fonts/styles.css');
const fontIconStyles = require.resolve('./react-icons-font.css');

/** @typedef {string | string[] | import('webpack').EntryObject} ResolvedEntry */

/**
 * @param {ResolvedEntry} entry
 * @param {string[]} imports
 * @returns {ResolvedEntry}
 */
function prependEntryImports(entry, imports) {
  if (typeof entry === 'string') {
    return [...imports, entry];
  }

  if (Array.isArray(entry)) {
    return [...imports, ...entry];
  }

  if (entry && typeof entry === 'object') {
    return Object.fromEntries(
      Object.entries(entry).map(([name, value]) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return [name, prependEntryImports(value, imports)];
        }

        if (value && typeof value === 'object') {
          return [name, { ...value, import: prependEntryImports(value.import ?? [], imports) }];
        }

        return [name, value];
      }),
    );
  }

  return entry;
}

/**
 * Configures atomic Fluent icon imports for Storybook.
 * Set FLUENTUI_ICON_VARIANT=fonts to use subsetted font icons; SVG atoms are the default.
 *
 * @see https://github.com/microsoft/fluentui-system-icons/blob/main/packages/react-icons-atomic-webpack-loader/README.md
 * @see https://github.com/microsoft/fluentui-system-icons/tree/main/packages/react-icons-font-subsetting-webpack-plugin
 *
 * @param {{ config: import('webpack').Configuration; headless?: boolean }} options
 */
function configureReactIcons(options) {
  const { config, headless = false } = options;
  const useFontIcons = process.env.FLUENTUI_ICON_VARIANT === FONT_ICON_VARIANT;

  config.module ??= {};
  config.module.rules ??= [];
  config.module.rules.push({
    test: /\.[mc]?[jt]sx?$/,
    enforce: 'pre',
    use: [
      {
        loader: iconLoader,
        options: {
          iconVariant: useFontIcons ? 'fonts' : 'svg',
          fallbackVariant: 'svg',
          headless,
        },
      },
    ],
  });

  if (useFontIcons) {
    config.module.rules.push({
      test: /\.(ttf|woff2?)$/,
      type: 'asset',
    });
    config.plugins ??= [];
    config.plugins.push(new FluentUIReactIconsFontSubsettingPlugin());
  }

  /** @type {string[]} */
  const styleImports = [];
  if (headless) {
    styleImports.push(headlessBaseStyles);
  }
  if (useFontIcons) {
    if (headless) {
      styleImports.push(headlessFontStyles);
    }
    styleImports.push(fontIconStyles);
  }

  if (styleImports.length > 0) {
    const originalEntry = config.entry;

    config.entry = async () => {
      const entry = typeof originalEntry === 'function' ? await originalEntry() : originalEntry;
      return prependEntryImports(entry ?? [], styleImports);
    };
  }

  return config;
}

module.exports = { configureReactIcons };

```

### Core Architecture Module: `.storybook/types.d.ts`
```
import type { StorybookConfig as StorybookBaseConfig } from '@storybook/react-webpack5';

export type StorybookConfig = Omit<StorybookBaseConfig, 'stories' | 'addons' | 'webpackFinal'> & {
  stories: NonNullable<Exclude<StorybookBaseConfig['stories'], Function>>;
  addons: NonNullable<Exclude<StorybookBaseConfig['addons'], Function>>;
  webpackFinal: NonNullable<StorybookBaseConfig['webpackFinal']>;
};

```

### Core Architecture Module: `apps/pr-deploy-site/eslint.config.js`
```
// @ts-check
const fluentPlugin = require('@fluentui/eslint-plugin');
const sdl = require('@microsoft/eslint-plugin-sdl');

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...fluentPlugin.configs['flat/node'],
  ...sdl.configs.recommended,
  {
    files: ['**/pr-deploy-site.js'],
    rules: {
      curly: 'off',
      'no-var': 'off',
      'vars-on-top': 'off',
      'prefer-arrow-callback': 'off',
      'no-restricted-globals': 'off',
    },
  },
];

```

### Core Architecture Module: `apps/pr-deploy-site/just.config.ts`
```
import fs from 'fs';
import path from 'path';
import { series, task, copyInstructionsTask, copyInstructions, cleanTask } from '@fluentui/scripts-tasks';
import { findGitRoot, getAllPackageInfo } from '@fluentui/scripts-monorepo';

function getDeployDirectoryName(packageName: string) {
  return packageName.replace(/^@[^/]+\//, '');
}

task('clean', cleanTask());

const gitRoot = findGitRoot();
const instructions = copyInstructions.copyFilesToDestinationDirectory(
  ['pr-deploy-site.css', 'chiclet-test.html', 'index.html'],
  'dist',
);

// If you are adding a new tile into this site, please make sure it is also listed in the siteInfo of
// `pr-deploy-site.js`
//
// Dependencies are listed here and NOT in package.json because declaring in package.json would
// prevent scoped/partial builds from working. (Since the demo site has both v0 and v8 packages,
// it would cause both of those dependency trees to get built every time.)
const dependencies = [
  // v8
  '@fluentui/public-docsite-resources',
  '@fluentui/public-docsite',
  '@fluentui/react',
  '@fluentui/react-experiments',
  '@fluentui/perf-test',
  '@fluentui/theming-designer',
  // v9
  '@fluentui/public-docsite-v9',
  '@fluentui/perf-test-react-components',
  '@fluentui/theme-designer',
  '@fluentui/public-docsite-v9-headless',
  // web-components
  '@fluentui/web-components',
  // charting
  '@fluentui/react-charting',
  '@fluentui/chart-web-components',
  '@fluentui/chart-docsite',
];

const allPackages = getAllPackageInfo();
const repoDeps = dependencies.map(dep => allPackages[dep]);
const deployedPackages = new Set<string>();
repoDeps.forEach(dep => {
  const packageDist = path.join(gitRoot, dep.packagePath, 'dist');

  if (fs.existsSync(packageDist)) {
    instructions.push(
      ...copyInstructions.copyFilesInDirectory(
        packageDist,
        path.join('dist', getDeployDirectoryName(dep.packageJson.name)),
      ),
    );
    deployedPackages.add(dep.packageJson.name);
  }
});

/**
 * Sets the list of tiles to render based on which packages were actually built
 */
task('generate:js', () => {
  const jsContent = fs.readFileSync(path.join(__dirname, './pr-deploy-site.js'), 'utf-8');
  const placeholder = '/* __PACKAGES_LIST_PLACEHOLDER__ */';

  if (!jsContent.includes(placeholder)) {
    console.error(`pr-deploy-site.js must contain the placeholder "${placeholder}"`);
    process.exit(1);
  }

  fs.writeFileSync(
    path.join('dist', 'pr-deploy-site.js'),
    jsContent.replace(
      placeholder,
      JSON.stringify([...deployedPackages], null, 2)
        // remove the surrounding array brackets
        .slice(1, -1)
        .trim(),
    ),
  );
});

/**
 * Copies all the built dist files and updates the JS to load the ones that were actually built
 */
task('generate:site', series(copyInstructionsTask({ copyInstructions: instructions }), 'generate:js'));

```

### Core Architecture Module: `apps/pr-deploy-site/pr-deploy-site.js`
```
// @ts-check
// If you are adding a new tile into this site, place make sure it is also being copied from `just.config.ts`

main();

/** @typedef {{package: string; link: string; icon: string; title: string}} SiteInfo */

function main() {
  /**
   * NOTE: A build step will replace this with the list of actual built packages
   * @type {string[]}
   */
  var packages = [
    /* __PACKAGES_LIST_PLACEHOLDER__ */
  ];

  /**
   * @type {SiteInfo[]}
   */
  var siteInfo = [
    {
      package: '@fluentui/public-docsite-resources',
      link: './public-docsite-resources/demo/index.html',
      icon: 'FavoriteStar',
      title: '@fluentui/react demo',
    },
    {
      package: '@fluentui/react',
      link: './react/storybook/index.html',
      icon: 'FavoriteStar',
      title: '@fluentui/react storybook',
    },
    {
      package: '@fluentui/public-docsite',
      link: './public-docsite/index.html',
      icon: 'Website',
      title: 'Website',
    },
    {
      package: '@fluentui/public-docsite-v9',
      link: './public-docsite-v9/react/index.html',
      icon: 'Teamwork',
      title: 'Converged (@fluentui/public-docsite-v9)',
    },
    {
      package: '@fluentui/web-components',
      link: './web-components/storybook/index.html',
      icon: 'Globe',
      title: 'web-components',
    },
    {
      package: '@fluentui/react-experiments',
      link: './react-experiments/demo/index.html',
      icon: 'TestBeaker',
      title: 'Experiments',
    },
    {
      package: '@fluentui/chart-docsite',
      link: './chart-docsite/storybook/index.html',
      icon: 'BarChart4',
      title: 'Charts v9',
    },
    {
      package: '@fluentui/react-charting',
      link: './react-charting/demo/index.html',
      icon: 'BarChart4',
      title: 'Charting',
    },
    {
      package: '@fluentui/chart-web-components',
      link: './chart-web-components/storybook/index.html',
      icon: 'BarChart4',
      title: 'Chart web components',
    },
    {
      package: '@fluentui/theming-designer',
      link: './theming-designer/index.html',
      icon: 'CheckMark',
      title: 'Theme Designer Example',
    },
    {
      package: '@fluentui/theme-designer',
      link: './theme-designer/storybook/index.html',
      icon: 'CheckMark',
      title: 'Theme Designer v9',
    },
    {
      package: '@fluentui/public-docsite-v9-headless',
      link: './public-docsite-v9-headless/storybook/index.html',
      icon: 'Code',
      title: 'Headless Components',
    },
    {
      package: '@fluentui/perf-test',
      link: './perf-test/index.html',
      icon: 'SpeedHigh',
      title: 'Perf Tests',
    },
    {
      package: '@fluentui/perf-test-react-components',
      link: './perf-test-react-components/index.html',
      icon: 'SpeedHigh',
      title: 'Perf Tests React-Components',
    },
  ];

  updatePrOrBranchLink(window.location.pathname);
  renderSiteLinks(packages, siteInfo);
}

/**
 * Updates the PR/branch link based on the current path.
 *
 * Note: Do not use `innerHTML` here. `window.location.pathname` is user-controlled,
 * and branch names can contain characters which would lead to XSS if injected as HTML.
 * @param {string} urlPath
 */
function updatePrOrBranchLink(urlPath) {
  // location.pathname will be like /pull/17568/ or /heads/master/
  var hrefMatch = urlPath.match(/^\/(pull|heads)\/([^/]+)/);
  if (!hrefMatch) {
    return;
  }

  var link = /** @type {HTMLAnchorElement | null} */ (document.getElementById('prLink'));
  if (!link) {
    return;
  }

  var repoUrl = 'https://github.com/microsoft/fluentui';
  var type = hrefMatch[1];
  var value = hrefMatch[2];

  if (type === 'heads') {
    // NOTE: this isn't used anymore, we deploy only from PRs, but keeping the code for potential future use
    link.textContent = value;
    link.href = repoUrl + '/tree/' + encodeURIComponent(value);

    // remove the PR-specific explanation
    var prExplanation = document.getElementById('prExplanation');
    if (prExplanation && prExplanation.parentElement) {
      prExplanation.parentElement.removeChild(prExplanation);
    }
  } else {
    // PR numbers should be digits; bail if not.
    if (!/^\d+$/.test(value)) {
      return;
    }

    link.textContent = 'PR #' + value;
    link.href = repoUrl + '/pull/' + value;
  }
}

/**
 *
 * @param {string[]} packages
 * @param {SiteInfo[]} siteInfo
 * @returns
 */
function renderSiteLinks(packages, siteInfo) {
  if (!packages || packages.length === 0) {
    return;
  }

  var siteLink = document.getElementById('site-list');
  if (!siteLink) {
    return;
  }

  siteInfo.forEach(function (info) {
    if (packages.indexOf(info.package) > -1) {
      var li = /** @type {HTMLLIElement} */ (document.createElement('LI'));
      li.className = 'Tile';

      var a = /** @type {HTMLAnchorElement} */ (document.createElement('A'));
      a.href = info.link;
      a.className = 'Tile-link';

      var icon = document.createElement('I');
      icon.className = 'ms-Icon ms-Icon--' + info.icon;
      a.appendChild(icon);
      a.appendChild(document.createTextNode(info.title));

      li.appendChild(a);

      /** @type {HTMLUListElement} */ (siteLink).appendChild(li);
    }
  });
}

```

### Core Architecture Module: `apps/theming-designer/eslint.config.js`
```
// @ts-check
const fluentPlugin = require('@fluentui/eslint-plugin');

/** @type {import("eslint").Linter.Config[]} */
module.exports = [
  ...fluentPlugin.configs['flat/react-legacy'],
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'import/no-webpack-loader-syntax': 'off', // ok in this project
      'prefer-const': 'off',
      'react/jsx-no-bind': 'off',
      'no-restricted-globals': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
];

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #36797** (2026-09-25): **feat: add build-time icon variants to public Storybooks**
  *Symptoms*: ## Previous Behavior  The v9 and headless public Storybooks loaded Fluent icons without build-time SVG/font selection. The root icon version was older than the atomic icon tooling, and the Nx Storybook build cache did not account for icon mode.  ## New Behavior  - Use atomic SVG icons by default in the v9 and headless public Storybooks. Set `FLUENTUI_ICON_VARIANT=fonts` when building to enable font icons, font subsetting, and SVG fallback for unsupported icons. - Include the mode in both public Storybook projects' Nx build cache inputs. - Upgrade `@fluentui/react-icons` and install the required atomic webpack loader and font-subsetting plugin at the repository root only. Deduplicate `@fluentui/react-icons` and Griffel in the lockfile so story packages resolve compatible icon exports without package-level manifest edits. - Refresh only Jest snapshots affected by the icon dependency upgrade. This PR does not migrate component/stories icon usages or visual baselines.  Validation: - `NX_SKIP_NX_CACHE=true yarn nx run-many -t test -p 'packages/react-components/**' --outputStyle=static` (91 projects and 21 dependent tasks passed). - `yarn nx run public-docsite-v9:build-storybook` and `yarn nx run public-docsite-v9-headless:build-storybook`, both with the default and with `FLUENTUI_ICON_VARIANT=fonts` (all four passed). V9 font output contains subsetted FluentSystemIcons assets. - `yarn nx run-many -t lint -p public-docsite-v9 public-docsite-v9-headless`, `yarn nx format:check --bas
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  | Package & Exports | Baseline (minified/GZIP) | PR    | Change     | | :---------------- | -----------------------: | ----: | ---------: | | <samp>react-accordion</samp> <br /> <abbr title='bundle-size/Accordion.fixture.js'>Accordion (including children components)</abbr>  | `91.918 kB`<br />`29.05 kB` | `92.893 kB`<br />`29.415 kB` | `975 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`365 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-avatar</samp> <br /> <abbr title='bundle-size/Avatar.fixture.js'>Avatar</abbr>  | `48.392 kB`<br />`15.303 kB` | `49.059 kB`<br />`15.626 kB` | `667 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`323 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-avatar</samp> <br /> <abbr title='bundle-size/AvatarGroup.fi
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36797/) <!-- Sticky Pull Request Commentdeploy-pr-site -->
  > > The one thing I couldn’t figure out from the PR is where the env var should be set - in the repo secrets/CI? Or are we planning to keep using SVGs on the deployed docsites, with the env var only needed for the local development?  - when invoking build target per project https://github.com/microsoft/fluentui/pull/36797/changes#diff-f93973b9fd00829a9aa10ead36005c283cd731228885312a88a5753a66d2f371R13 - svg stays default, the original reasoning was to have it for troubleshooting, dev testing.   not sure if we should switch by default, having 2 deployed SB is probably overkill as there are not VR test for our docs 

- **Issue #36794** (2026-09-25): **fix(react-tooltip): preserve virtual target tooltips**
  *Symptoms*: ## Previous Behavior  Tooltip previously used `escaped || referenceHidden` to hide after positioning. That incorrectly hid a visible trigger when its portaled Tooltip surface escaped a static `overflow: hidden` ancestor: `escaped` describes the floating surface, not whether the trigger is clipped.  #36605 corrected this by using only `referenceHidden`, preserving hide-and-restore behavior when a real trigger is fully clipped or scrolled out of view.  A separate case affects virtual positioning targets. Their synthetic geometry can yield `referenceHidden: true`, even though there is no clipped DOM trigger. This caused the Tooltip to hide. A downstream workaround removed the entire `onPositioningEnd` callback, but that also disables fully-clipped-trigger hiding for every Tooltip.  ## New Behavior  Tooltip now ignores `referenceHidden` only when the configured `positioning.target` is virtual. Implicit trigger targets and explicit DOM targets retain the existing fully-clipped hide-and-restore behavior.  Regression tests cover the two relevant cases:  - A virtual target receiving `referenceHidden: true` remains visible. - An explicit DOM target receiving `referenceHidden: true` hides.  The tests also verify that the caller continues to receive the original positioning event.  ## Related Issue(s)  - Fixes #36604
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  | Package & Exports | Baseline (minified/GZIP) | PR    | Change     | | :---------------- | -----------------------: | ----: | ---------: | | <samp>react-charts</samp> <br /> <abbr title='bundle-size/AreaChart.fixture.js'>AreaChart</abbr>  | `407.045 kB`<br />`127.162 kB` | `407.084 kB`<br />`127.182 kB` | `39 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`20 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-charts</samp> <br /> <abbr title='bundle-size/DeclarativeChart.fixture.js'>DeclarativeChart</abbr>  | `759.395 kB`<br />`222.743 kB` | `759.434 kB`<br />`222.762 kB` | `39 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`19 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-charts</samp> <br /> <abbr title='bundle-size/DonutChart.fixture.js'>D

- **Issue #36793** (2026-09-24): **feat(storybook): enable atomic React icons**
  *Symptoms*: ## Previous Behavior  Storybook bundles imported the full `@fluentui/react-icons` implementation and did not configure atomic icon imports or font subsetting.  ## New Behavior  - Adds a shared Storybook helper that registers the React Icons atomic webpack loader. - Registers the font subsetting plugin for font-based icons. - Enables atomic icons for the public v9 docs and headless component Storybook, including headless icon paths. - Updates `@fluentui/react-icons` and adds the required webpack packages. - Adds focused unit coverage for loader options and font plugin registration.  ## Related Issue(s)  - None  ## Validation  - `yarn nx run-many -t test type-check lint -p scripts-storybook --outputStyle=static` - `yarn nx run react-headless-components-preview-stories:build-storybook --outputStyle=static` - `yarn nx run public-docsite-v9:build-storybook --outputStyle=static` 
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  | Package & Exports | Baseline (minified/GZIP) | PR    | Change     | | :---------------- | -----------------------: | ----: | ---------: | | <samp>react-accordion</samp> <br /> <abbr title='bundle-size/Accordion.fixture.js'>Accordion (including children components)</abbr>  | `91.918 kB`<br />`29.05 kB` | `92.893 kB`<br />`29.415 kB` | `975 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`365 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-avatar</samp> <br /> <abbr title='bundle-size/Avatar.fixture.js'>Avatar</abbr>  | `48.392 kB`<br />`15.303 kB` | `49.044 kB`<br />`15.615 kB` | `652 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />`312 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" />| | <samp>react-avatar</samp> <br /> <abbr title='bundle-size/AvatarGroup.fi
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36793/) <!-- Sticky Pull Request Commentdeploy-pr-site -->
  > I had this implemented for the prefer resizable plugin. are we in rush for this ? if yes i suggest to go with the uniform registration driven by env variable https://github.com/microsoft/fluentui/pull/36705/changes#diff-8f50a54679ee6db752d9fa3b115c3f6bbd048f7a7d8716695cbd031b1dd5fdfa

- **Issue #36789** (2026-09-24): **fix(react-headless-components): allow changing the root element for PopoverSurface**
  *Symptoms*: ## Previous Behavior  `PopoverSurface` selected its root element from `trapFocus` and prevented consumers from overriding it with the `as` prop.  ## New Behavior  `PopoverSurface` uses `dialog` as its default root while allowing consumers to override the root element, for example with `as="div"`. The semantic role still reflects whether focus trapping is enabled.  Unit coverage was updated for the default root and the `as="div"` override. A patch change file is included.  ## Related Issue(s)  None. 
  **Post-Mortem & Fix Analysis**:
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36789/) <!-- Sticky Pull Request Commentdeploy-pr-site -->
  > ## 📊 Bundle size report  | Package & Exports | Baseline (minified/GZIP) | PR    | Change     | | :---------------- | -----------------------: | ----: | ---------: | | <samp>react-headless-components-preview</samp> <br /> <abbr title='bundle-size/AllComponents.fixture.js'>react-headless-components-preview: entire library</abbr>  | `242.141 kB`<br />`68.253 kB` | `242.134 kB`<br />`68.245 kB` | `-7 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/decrease.png" /><br />`-8 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/decrease.png" />| | <samp>react-headless-components-preview</samp> <br /> <abbr title='bundle-size/TeachingPopover.fixture.js'>@fluentui/react-headless-components-preview/teaching-popover</abbr>  | `36.057 kB`<br />`12.003 kB` | `36.05 kB`<br />`11.996 kB` | `-7 B` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/decrease.png" /><br />`-7 B` <img aria-hidden="true" src="https://microsoft.github

- **Issue #36788** (2026-09-23): **Fix Tab selection in Combobox and TagPicker**
  *Symptoms*: ## Summary  - allow open Dropdown triggers to handle Tab/Shift+Tab directly instead of Tabster intercepting the keydown - keep single-select controls selecting the active option on Tab while multiselect controls close without selection - add an optional `selectionMode` to TagPicker, defaulting to `multiselect`, and update the single-select story - preserve TagPicker's tag-based value rendering so selected text is not duplicated in the input - add Cypress coverage for keyboard-opened and mouse-opened controls, forward/reverse Tab, selection modes, light dismiss, and programmatic focus  Fixes #31365  ## Validation  - `yarn nx run react-combobox:e2e --skip-nx-cache` - `yarn nx run react-tag-picker:e2e --skip-nx-cache` - `yarn nx run react-combobox:lint --skip-nx-cache` - `yarn nx run react-combobox:type-check --skip-nx-cache` - `yarn nx run react-tag-picker:lint --skip-nx-cache` - `yarn nx run react-tag-picker:type-check --skip-nx-cache` - `yarn nx run react-combobox:generate-api --skip-nx-cache` - `yarn nx run react-tag-picker:generate-api --skip-nx-cache` - `yarn nx run react-tag-picker-stories:lint --skip-nx-cache`  ## Notes  - `selectionMode` is optional on TagPicker props, state, and context; missing values normalize to `multiselect` for backward compatibility. - local `react-tag-picker-stories:type-check` is blocked by an unrelated missing `@fluentui/babel-preset-storybook-full-source` module.
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  | Package & Exports | Baseline (minified/GZIP) | PR    | Change     | | :---------------- | -----------------------: | ----: | ---------: | | <samp>react-combobox</samp> <br /> <abbr title='bundle-size/Combobox.fixture.js'>Combobox (including child components)</abbr>  | `0 B`<br />`0 B` | `139.544 kB`<br />`45.169 kB` | 🆕 New entry| | <samp>react-combobox</samp> <br /> <abbr title='bundle-size/Dropdown.fixture.js'>Dropdown (including child components)</abbr>  | `0 B`<br />`0 B` | `139.952 kB`<br />`45.091 kB` | 🆕 New entry| | <samp>react-components</samp> <br /> <abbr title='bundle-size/BaseHooks.fixture.js'>react-components: all base hooks</abbr>  | `0 B`<br />`0 B` | `218.242 kB`<br />`68.369 kB` | 🆕 New entry| | <samp>react-components</samp> <br /> <abbr title='bundle-size/ButtonProviderAndTheme.fixture.js'>react-components: Button, FluentProvider & webLightTheme</abbr>  | `0 B`<br />`0 B` | `67.471 kB`<br />`19.465 kB` | 🆕 New entry| | <samp>react-comp
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36788/) <!-- Sticky Pull Request Commentdeploy-pr-site -->

- **Issue #36783** (2026-09-24): **chore: require explicit invocation for operational skills**
  *Symptoms*: ## Previous Behavior  The `review-pr` and `triage-issues` skills could be inferred and loaded automatically from ordinary user prompts.  ## New Behavior  Both operational workflows now set `disable-model-invocation: true`, requiring direct slash-command invocation while remaining user-invocable. The lightweight, read-only `package-info` and `token-lookup` skills remain available for model inference.  ## Related Issue(s)  - None  ## Validation  - `yarn prettier --check .agents/skills/review-pr/SKILL.md .agents/skills/triage-issues/SKILL.md` - `git diff --check`
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  ✅ No changes found  <!-- Sticky Pull Request Commentbundle-size-report -->
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36783/) <!-- Sticky Pull Request Commentdeploy-pr-site -->

- **Issue #36781** (2026-09-30): **Fix incomplete Markdown table escaping in Fluent UI CLI**
  *Symptoms*: The CLI metadata formatter did not escape input backslashes, allowing them to neutralize generated pipe escapes and corrupt Markdown tables.  - **Escaping**   - Escape backslashes before Markdown metacharacters.   - Preserve safe rendering of pipes in table cells.  ```ts value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|'); ```  - **Coverage**   - Add regression coverage for a backslash immediately preceding a pipe.

- **Issue #36780** (2026-09-23): **Pin actions to full-length SHAs**
  *Symptoms*: ## Previous Behavior  Most actions were not pinned to full-length SHAs, which is a security risk if the referenced tag is changed by a malicious user.  ## New Behavior  Pin all actions to full length SHAs instead of tags.  Update some of the actions: - [`actions/checkout`](https://github.com/actions/checkout/releases) v6 to v7: it appears the one breaking change in this version (refusing unsafe `workflow_run` checkout) was backported to earlier versions as the default behavior, so fluentui would already have been picking it up automatically. - [`actions/setup-node`](https://github.com/actions/setup-node/releases) v6 to v7: nothing breaking - [`nrwl/nx-set-shas`](https://github.com/nrwl/nx-set-shas/releases) v4 to v5: node runtime update 
  **Post-Mortem & Fix Analysis**:
  > ## 📊 Bundle size report  ✅ No changes found  <!-- Sticky Pull Request Commentbundle-size-report -->
  > Pull request demo site: [URL](https://fluentuipr.z22.web.core.windows.net/pull/36780/) <!-- Sticky Pull Request Commentdeploy-pr-site -->

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

### Incident Patch 1: `45af0379` (2026-09-28)
**Commit Message**: fix(web-components): keep switch indicator visible in forced-colors mode (#36742)

Co-authored-by: Chris Holt <13071055+chrisdholt@users.noreply.github.com>

**File**: `change/@fluentui-web-components-8f3c2a1d-5e6b-4c7d-9a0e-1b2c3d4e5f60.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "patch",
+  "comment": "fix(switch): keep the indicator visible in forced-colors mode",
+  "packageName": "@fluentui/web-components",
+  "email": "jiayin.3zh@gmail.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `packages/web-components/src/switch/switch.styles.ts` (modified, +2/-2)
```diff
@@ -137,12 +137,12 @@ export const styles = css`
     .checked-indicator,
     :host(:hover) .checked-indicator,
     :host(:active) .checked-indicator {
-      background-color: ActiveCaption;
+      background-color: CanvasText;
     }
     :host(${checkedState}) .checked-indicator,
     :host(${checkedState}:hover) .checked-indicator,
     :host(${checkedState}:active) .checked-indicator {
-      background-color: ButtonFace;
+      background-color: HighlightText;
     }
     :host(${nativeDisabledState}) .checked-indicator,
     :host(${checkedState}${nativeDisabledState}) .checked-indicator {
```

---

### Incident Patch 2: `a1d67784` (2026-09-25)
**Commit Message**: fix(react-tooltip): preserve virtual target tooltips (#36794)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

**File**: `change/@fluentui-react-tooltip-f9eda5e9-9f5b-4117-b6a4-eb3c882eba45.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix: preserve virtual target tooltips",
+  "packageName": "@fluentui/react-tooltip",
+  "email": "paulmardling@microsoft.com"
+}
```

**File**: `packages/react-components/react-tooltip/library/src/components/Tooltip/Tooltip.test.tsx` (modified, +50/-0)
```diff
@@ -2,6 +2,7 @@ import * as React from 'react';
 import { Tooltip } from './Tooltip';
 import { isConformant } from '../../testing/isConformant';
 import type { IsConformantOptions } from '@fluentui/react-conformance';
+import type { PositioningVirtualElement } from '@fluentui/react-positioning';
 import type { RenderResult } from '@testing-library/react';
 import { act, fireEvent, render, waitFor } from '@testing-library/react';
 import { resetIdsForTests } from '@fluentui/react-utilities';
@@ -225,4 +226,53 @@ describe('Tooltip', () => {
     expect(onPositioningEnd).toHaveBeenCalledTimes(2);
     expect(onPositioningEnd).toHaveBeenLastCalledWith(visibleEvent);
   });
+
+  it('hides when positioning reports an explicit DOM target as hidden', () => {
+    const onPositioningEnd = jest.fn();
+    const result = render(
+      <Tooltip
+        content="Tooltip content"
+        relationship="label"
+        visible
+        positioning={{ target: document.body, onPositioningEnd }}
+      >
+        <button />
+      </Tooltip>,
+    );
+    const tooltip = getByRoleTooltip(result);
+    const positioningEvent = new CustomEvent('fui-positioningend', {
+      detail: { placement: 'top', escaped: false, referenceHidden: true },
+    });
+
+    act(() => tooltip.dispatchEvent(positioningEvent));
+
+    expect(getComputedStyle(tooltip).visibility).toBe('hidden');
+    expect(onPositioningEnd).toHaveBeenLastCalledWith(positioningEvent);
+  });
+
+  it('remains visible when positioning reports a virtual target as hidden', () => {
+    const onPositioningEnd = jest.fn();
+    const virtualTarget: PositioningVirtualElement = {
+      getBoundingClientRect: () => new DOMRect(),
+    };
+    const result = render(
+      <Tooltip
+        content="Tooltip content"
+        relationship="label"
+        visible
+        positioning={{ target: virtualTarget, onPositioningEnd }}
+      >
+        <button />
+      </Tooltip>,
+    );
+    const tooltip = getByRoleTooltip(result);
+    const positioningEvent = new CustomEvent('fui-positioningend', {
+      detail: { placement: 'top', escaped: false, referenceHidden: true },
+    });
+
+    act(() => tooltip.dispatchEvent(positioningEvent));
+
+    expect(getComputedStyle(tooltip).visibility).not.toBe('hidden');
+    expect(onPositioningEnd).toHaveBeenLastCalledWith(positioningEvent);
+  });
 });
```

**File**: `packages/react-components/react-tooltip/library/src/components/Tooltip/useTooltipBase.tsx` (modified, +4/-1)
```diff
@@ -21,6 +21,7 @@ import {
   useEventCallback,
   slot,
   getReactElementRef,
+  isHTMLElement,
 } from '@fluentui/react-utilities';
 import type { TooltipBaseProps, TooltipBaseState, TooltipChildProps, OnVisibleChangeData } from './Tooltip.types';
 import { arrowHeight, tooltipBorderRadius } from './private/constants';
@@ -82,9 +83,11 @@ export const useTooltipBase_unstable = (props: TooltipBaseProps): TooltipBaseSta
   state.content.id = useId('tooltip-', state.content.id);
 
   const resolvedPositioning = resolvePositioningShorthand(state.positioning);
+  const isVirtualTarget = resolvedPositioning.target !== undefined && !isHTMLElement(resolvedPositioning.target);
   const onPositioningEnd = useEventCallback((event: OnPositioningEndEvent) => {
     // Portaled tooltips can escape the trigger's clipping ancestors while the trigger is still visible.
-    setHidden(event.detail.referenceHidden);
+    // Virtual targets can be reported as hidden based on synthetic geometry.
+    setHidden(!isVirtualTarget && event.detail.referenceHidden);
     resolvedPositioning.onPositioningEnd?.(event);
   });
 
```

---

### Incident Patch 3: `5f32665b` (2026-09-25)
**Commit Message**: fixed line&Area chart voice control access issue (#36703)

**File**: `change/@fluentui-react-charts-c03f5c14-f431-4232-af89-3fed5653212d.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "Fixed voice control accessibility issue for the chart line and area charts",
+  "packageName": "@fluentui/react-charts",
+  "email": "v-baambati@microsoft.com"
+}
```

**File**: `packages/charts/react-charts/library/src/components/AreaChart/AreaChart.tsx` (modified, +31/-3)
```diff
@@ -759,7 +759,7 @@ export const AreaChart: React.FunctionComponent<AreaChartProps> = React.forwardR
             <g
               key={`${index}-dots-${_uniqueIdForGraph}`}
               clipPath="url(#clip)"
-              role="region"
+              role="listbox"
               aria-label={`${points[index].legend}, series ${index + 1} of ${points.length} with ${
                 points[index].data.length
               } data points.`}
@@ -769,6 +769,12 @@ export const AreaChart: React.FunctionComponent<AreaChartProps> = React.forwardR
                 const xDataPoint = singlePoint.xVal instanceof Date ? singlePoint.xVal.getTime() : singlePoint.xVal;
                 lineColor = points[index]!.color!;
                 const legend = points[index]!.legend;
+                const { opacity: circleOpacity, radius: circleRadiusValue } = _getCircleOpacityAndRadius(
+                  xDataPoint,
+                  circleRadius,
+                  circleId,
+                  legend,
+                );
                 return (
                   <circle
                     key={circleId}
@@ -779,14 +785,16 @@ export const AreaChart: React.FunctionComponent<AreaChartProps> = React.forwardR
                     stroke={lineColor}
                     strokeWidth={3}
                     fill={_updateCircleFillColor(xDataPoint, lineColor, circleId)}
+                    // Elements with visibility: hidden cannot receive focus, so use opacity: 0 instead to hide them.
+                    opacity={circleOpacity}
                     onMouseOut={_onRectMouseOut}
                     onMouseOver={event => _onRectMouseMove(event)}
                     {..._getOnClickHandler(points, index, pointIndex)}
                     onFocus={event => _handleFocus(event, index, pointIndex, circleId)}
                     onBlur={_handleBlur}
                     {...getSecureProps(pointOptions)}
-                    r={_getCircleRadius(xDataPoint, circleRadius, circleId, legend)}
-                    role="img"
+                    r={circleRadiusValue}
+                    role="option"
                     aria-label={
                       (!_hasDuplicateXValues && !_hasMissingXValues && _getAriaLabel(index, pointIndex)) || undefined
                     }
@@ -867,6 +875,26 @@ export const AreaChart: React.FunctionComponent<AreaChartProps> = React.forwardR
       }
     }
 
+    function _getCircleOpacityAndRadius(
+      xDataPoint: number,
+      circleRadius: number,
+      circleId: string,
+      legend: string,
+    ): { opacity: number; radius: number } {
+      // Hide points whose legend isn't highlighted.
+      if (!_noLegendHighlighted() && !_legendHighlighted(legend)) {
+        return { opacity: 0, radius: 0 };
+      }
+      if (isCircleClicked && nearestCircleToHighlight === xDataPoint) {
+        return { opacity: 1, radius: 1 };
+      } else if (nearestCircleToHighlight === xDataPoint || activePoint === circleId) {
+        return { opacity: 1, radius: circleRadius };
+      }
+      // Keep focusable points full-size but transparent (opacity:0, not visibility:hidden) so Voice Control
+      // can target them while they stay visually hidden and remain focusable.
+      return { opacity: 0, radius: circleRadius };
+    }
+
     /**
      * This function checks if the given legend is highlighted or not.
      * A legend can be highlighted in 2 ways:
```

**File**: `packages/charts/react-charts/library/src/components/LineChart/LineChart.test.tsx` (modified, +7/-0)
```diff
@@ -788,6 +788,13 @@ describe('LineChart snapShot testing', () => {
     expect(wrapper).toMatchSnapshot();
   });
 
+  it('exposes optimized large-data lines as labeled options', () => {
+    render(<LineChart data={basicChartPoints} optimizeLargeData />);
+
+    expect(screen.getByRole('listbox', { name: 'metaData1 data series' })).toBeInTheDocument();
+    expect(screen.getByRole('option', { name: 'metaData1, line 1 of 3 with 2 data points.' })).toBeInTheDocument();
+  });
+
   it('Should render with default colors when line color is not provided', async () => {
     const points: LineChartPoints[] = [
       {
```

**File**: `packages/charts/react-charts/library/src/components/LineChart/LineChart.tsx` (modified, +13/-8)
```diff
@@ -538,6 +538,9 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
         const pointsForLine: JSXElement[] = [];
 
         const legendVal: string = _points[i].legend;
+        const seriesAriaLabel = `${legendVal}, line ${i + 1} of ${_points.length} with ${
+          _points[i].data.length
+        } data points.`;
         const lineColor: string = _points[i].color!;
         const verticaLineHeight = containerHeight - margins.bottom! + 6;
         const useSecondaryYScale = !!(_points[i].useSecondaryYScale && _yScaleSecondary);
@@ -623,7 +626,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                     onMouseOut={_handleMouseOut}
                     strokeWidth={activePoint === circleId ? DEFAULT_LINE_STROKE_SIZE : 0}
                     stroke={activePoint === circleId ? lineColor : ''}
-                    role="img"
+                    role="option"
                     aria-label={_points[i].data[0].text ?? _getAriaLabel(i, 0)}
                     ref={(e: SVGCircleElement | null) => {
                       _refCallback(e!, circleId);
@@ -731,6 +734,8 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                 {..._getClickHandler(_points[i].onLineClick)}
                 opacity={1}
                 tabIndex={isLegendSelected ? 0 : undefined}
+                role={props.optimizeLargeData ? 'option' : undefined}
+                aria-label={props.optimizeLargeData ? seriesAriaLabel : undefined}
               />,
             );
           } else if (shouldDrawLines) {
@@ -806,7 +811,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                     onMouseOver={event => _onMouseOverLargeDataset(i, verticaLineHeight, event, yScale)}
                     onFocus={event => _onFocusLargeDataset(i, verticaLineHeight, event, yScale, k)}
                     onMouseOut={_handleMouseOut}
-                    role="img"
+                    role="option"
                     aria-label={_points[i].data[k].text ?? _getAriaLabel(i, k)}
                   />,
                 );
@@ -910,7 +915,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                       fill={_points[i].data[j - 1]?.markerColor || _getPointFill(lineColor, circleId, j, false)}
                       stroke={_points[i].data[j - 1]?.markerColor || lineColor}
                       strokeWidth={strokeWidth}
-                      role="img"
+                      role="option"
                       aria-label={_points[i].data[j - 1].text ?? _getAriaLabel(i, j - 1)}
                     />
                     {!_isScatterPolar && supportsTextMode && text && (
@@ -988,7 +993,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                     fill={_points[i].data[j - 1]?.markerColor || _getPointFill(lineColor, circleId, j, false)}
                     stroke={_points[i].data[j - 1]?.markerColor || lineColor}
                     strokeWidth={strokeWidth}
-                    role="img"
+                    role="option"
                     aria-label={_getAriaLabel(i, j - 1)}
                     tabIndex={isLegendSelected ? 0 : undefined}
                   />
@@ -1076,7 +1081,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forwardR
                           fill={_getPointFill(lineColor, lastCircleId, j, true)}
                           stroke={lineColor}
                           strokeWidth={strokeWidth}
-                          role="img"
+                          role="option"
                           aria-label={_points[i].data[j].text ?? _getAriaLabel(i, j)}
                         />
                         {!_isScatterPolar && lastSupportsTextMode && lastText && (
@@ -1153,7 +1158,7 @@ export const LineChart: React.FunctionComponent<LineChartProps> = React.forward
```

**File**: `packages/charts/react-charts/library/src/components/LineChart/__snapshots__/LineChart.test.tsx.snap` (modified, +243/-243)
```diff
@@ -367,7 +367,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
           <g>
             <g
               aria-label="metaData3, line 3 of 3 with 2 data points."
-              role="region"
+              role="listbox"
             >
               <line
                 id="lineID_r_1__2_1"
@@ -390,7 +390,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="yellow"
                 id="circle_r_0__2_1"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="yellow"
                 stroke-width="4"
                 tabindex="0"
@@ -405,7 +405,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="yellow"
                 id="circle_r_0__2_11L"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="yellow"
                 stroke-width="4"
                 tabindex="0"
@@ -423,7 +423,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
             </g>
             <g
               aria-label="metaData2, line 2 of 3 with 2 data points."
-              role="region"
+              role="listbox"
             >
               <line
                 id="lineID_r_1__1_1"
@@ -446,7 +446,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="green"
                 id="circle_r_0__1_1"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="green"
                 stroke-width="4"
                 tabindex="0"
@@ -461,7 +461,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="green"
                 id="circle_r_0__1_11L"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="green"
                 stroke-width="4"
                 tabindex="0"
@@ -479,7 +479,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
             </g>
             <g
               aria-label="metaData1, line 1 of 3 with 2 data points."
-              role="region"
+              role="listbox"
             >
               <line
                 id="lineID_r_1__0_1"
@@ -502,7 +502,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="red"
                 id="circle_r_0__0_1"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="red"
                 stroke-width="4"
                 tabindex="0"
@@ -517,7 +517,7 @@ exports[`Line chart rendering Should render the Line chart with numeric x-axis d
                 fill="red"
                 id="circle_r_0__0_11L"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="red"
                 stroke-width="4"
                 tabindex="0"
@@ -992,7 +992,7 @@ exports[`Line chart rendering Should render the Line chart with points in multip
           <g>
             <g
               aria-label="metaData3, line 3 of 3 with 2 data points."
-              role="region"
+              role="listbox"
             >
               <line
                 id="lineID_r_c__2_1"
@@ -1013,7 +1013,7 @@ exports[`Line chart rendering Should render the Line chart with points in multip
                 fill="yellow"
                 id="circle_r_b__2_1"
                 opacity="1"
-                role="img"
+                role="option"
                 stroke="yellow"
                 stroke-width="4"
                 tabindex="0"
@@ -1026,7 +1026,7 @@ exports[`Line chart rendering Should render the Line chart with points in multip
                 fill="yellow"
                 id="circle_r_b__2_11L"
```

---

### Incident Patch 4: `aa2f85a0` (2026-09-24)
**Commit Message**: fix(react-avatar): make enclosure cleanup linear (#36738)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Co-authored-by: Dmytro Kirpa <kirpadv@gmail.com>

**File**: `change/@fluentui-react-avatar-43a7ed01-2573-4a4a-9a5b-6b56387b4e86.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "patch",
+  "comment": "fix: avoid repeated scanning of unmatched name enclosures when generating initials",
+  "packageName": "@fluentui/react-avatar",
+  "email": "223556219+Copilot@users.noreply.github.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `packages/react-components/react-avatar/library/src/utils/getInitials.enclosures.test.tsx` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+import * as React from 'react';
+import { performance } from 'node:perf_hooks';
+import { runInNewContext } from 'node:vm';
+import { render, screen } from '@testing-library/react';
+import { Avatar } from '../components/Avatar/Avatar';
+import { getInitials } from './getInitials';
+
+describe('Avatar name enclosure cleanup', () => {
+  it('preserves enclosure, initials, and Unicode behavior', () => {
+    for (const name of [
+      'Ada Lovelace',
+      'Ada (Team) Lovelace',
+      'Ada [Team] Lovelace',
+      'Ada {Team} Lovelace',
+      'Ada [Team) Lovelace',
+      'Ada [[Team] Lovelace',
+      'Ada [[[ Lovelace',
+    ]) {
+      expect(getInitials(name, false)).toBe('AL');
+      expect(getInitials(name, true)).toBe('LA');
+      expect(getInitials(name, false, { firstInitialOnly: true })).toBe('A');
+    }
+
+    expect(getInitials('\u00cdrissa \u00de\u00f3r\u00f0ard\u00f3ttir', false)).toBe('\u00cd\u00de');
+    expect(getInitials('\u{20000} [Team]', false)).toBe('\u{20000}');
+    expect(getInitials('\u6842\u82f1', false)).toBe('');
+    expect(getInitials('\uac15\ud604', false)).toBe('');
+    expect(getInitials('\u062e\u0633\u0631\u0648', true)).toBe('');
+    expect(getInitials('+1 (555) 123-4567 ext.4567', false)).toBe('');
+  });
+
+  it('derives initials from a public name containing unmatched brackets', () => {
+    // A Jest timeout alone cannot interrupt synchronous regex execution.
+    runInNewContext(
+      'renderAvatar()',
+      {
+        renderAvatar: () => {
+          const name = `Ada ${'['.repeat(128)} Lovelace`;
+          render(<Avatar name={name} />);
+          expect(screen.getByText('AL')).toBeTruthy();
+          expect(screen.getByRole('img').getAttribute('aria-label')).toBe(name);
+        },
+      },
+      { timeout: 1000 },
+    );
+  });
+
+  it('avoids superlinear growth when opening brackets have no closing enclosure', () => {
+    const samples: {
+      length: number;
+      squareMs: number;
+      parenthesisMs: number;
+      braceMs: number;
+      balancedMs: number;
+      nonBracketMs: number;
+      extendedNameMs: number;
+    }[] = [];
+    let ordinaryNameMs = 0;
+
+    const measureName = (name: string, expected: string): number => {
+      for (let warmup = 0; warmup < 2; warmup++) {
+        expect(getInitials(name, false)).toBe(expected);
+      }
+
+      const durations: number[] = [];
+      for (let sample = 0; sample < 5; sample++) {
+        let initials = '';
+        const start = performance.now();
+        for (let call = 0; call < 3; call++) {
+          initials = getInitials(name, false);
+        }
+        durations.push((performance.now() - start) / 3);
+        expect(initials).toBe(expected);
+      }
+      return durations.sort((a, b) => a - b)[2];
+    };
+
+    // These are experiment bounds, not an application name-length policy.
+    runInNewContext(
+      'measure()',
+      {
+        measure: () => {
+          ordinaryNameMs = measureName('Ada Lovelace', 'AL');
+          for (const length of [64, 128, 256, 512, 1024, 2048, 4096]) {
+            samples.push({
+              length,
+              squareMs: measureName('['.repeat(length), ''),
+              parenthesisMs: measureName('('.repeat(length), ''),
+              braceMs: measureName('{'.repeat(length), ''),
+              balancedMs: measureName('['.repeat(length / 2) + ']'.repeat(length / 2), ''),
+              nonBracketMs: measureName('A'.repeat(length), 'A'),
+              extendedNameMs: measureName('A'.repeat(length - 9) + ' Lovelace', 'AL'),
+            });
+          }
+        },
+      },
+      { timeout: 2500 },
+    );
+
+    console.info(
+      'Avatar enclosure measurements (milliseconds per call):',
+      JSON.stringify({ ordinaryNameMs, sampleCount: 5, callsPerSample: 3, maxNameLength: 4096, samples }),
+    );
+
+    const small = samples.find(sample => sample.length === 1024);
+    const large = samples.find(sample => sampl
```

**File**: `packages/react-components/react-avatar/library/src/utils/getInitials.test.ts` (modified, +60/-0)
```diff
@@ -60,6 +60,66 @@ describe('getInitials', () => {
     expect(result).toEqual('DG');
   });
 
+  it.each([
+    ['(', ')'],
+    ['(', ']'],
+    ['(', '}'],
+    ['[', ')'],
+    ['[', ']'],
+    ['[', '}'],
+    ['{', ')'],
+    ['{', ']'],
+    ['{', '}'],
+  ])('ends an enclosure opened with %s at the first %s', (opening, closing) => {
+    const name = `${opening}Team ${opening}Inner${closing} Grace${closing} Hopper`;
+    expect(getInitials(name, false)).toBe('GH');
+    expect(getInitials(name, true)).toBe('HG');
+  });
+
+  it.each([
+    ['(Team)Ada[Role]Lovelace', 'A'],
+    ['Ada (Team) []{}(Role) Lovelace', 'AL'],
+    ['Ada (Team [Inner] Hopper)', 'AH'],
+    ['[Team {Inner) Grace] Hopper', 'GH'],
+    ['[Ada [Grace] Hopper', 'H'],
+    ['Ada (Grace [Hopper', 'AH'],
+    ['[Team] Ada [Grace Hopper', 'AH'],
+    ['Ada )Grace] Hopper}', 'AH'],
+    ['Ada [Team\n[Inner] Hopper]', 'AH'],
+    ['Ada [Team\u2028Role] Lovelace', 'AL'],
+    ['Ada [Grace\n', 'AG'],
+    [' \tAda\u00a0[Team]\u2003Lovelace \n', 'AL'],
+    ['[Team] \u{20000} \u{20001}', '\u{20000}\u{20001}'],
+    ['\ud800[Team]\udc00 Lovelace', '\u{10000}L'],
+    ['[Team] \u6842\u82f1', ''],
+    ['[Team] \uac15\ud604', ''],
+    ['[Team] \u062e\u0633\u0631\u0648', ''],
+  ])('preserves initials and direction after cleaning %s', (name, expected) => {
+    expect(getInitials(name, false)).toBe(expected);
+    expect(getInitials(name, true)).toBe([...expected].reverse().join(''));
+    expect(getInitials(name, false, { firstInitialOnly: true })).toBe([...expected][0] ?? '');
+    expect(getInitials(name, true, { firstInitialOnly: true })).toBe([...expected][0] ?? '');
+  });
+
+  it('matches the original enclosure semantics for all short delimiter combinations', () => {
+    const tokens = ['(', '[', '{', ')', ']', '}', 'A', 'B', ' '];
+    const compare = (name: string, remaining: number): void => {
+      // Bound the original regex to at most four characters, then remove leftover delimiters
+      // so the reference initials do not depend on the new enclosure implementation.
+      const cleanedName = name.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').replace(/[\(\)\[\]\{\}]/g, '');
+      expect(getInitials(name, false)).toBe(getInitials(cleanedName, false));
+      expect(getInitials(name, true)).toBe(getInitials(cleanedName, true));
+
+      if (remaining > 0) {
+        for (const token of tokens) {
+          compare(name + token, remaining - 1);
+        }
+      }
+    };
+
+    compare('', 4);
+  });
+
   it('calculates an expected initials in RTL if one was not specified', () => {
     const result = getInitials('Kat Larrson', true);
     expect(result).toEqual('LK');
```

**File**: `packages/react-components/react-avatar/library/src/utils/getInitials.ts` (modified, +3/-8)
```diff
@@ -1,12 +1,7 @@
 /**
- * Regular expressions matching characters to ignore when calculating the initials.
+ * Regular expression matching complete enclosures or an unmatched enclosure tail.
  */
-
-/**
- * Regular expression matching characters within various types of enclosures, including the enclosures themselves
- *  so for example, (xyz) [xyz] {xyz} all would be ignored
- */
-const UNWANTED_ENCLOSURES_REGEX: RegExp = /[\(\[\{][^\)\]\}]*[\)\]\}]/g;
+const UNWANTED_ENCLOSURES_REGEX: RegExp = /[\(\[\{][^\)\]\}]*([\)\]\}]|$)/g;
 
 /**
  * Regular expression matching special ASCII characters except space, plus some unicode special characters.
@@ -73,7 +68,7 @@ function getInitialsLatin(displayName: string, isRtl: boolean, firstInitialOnly?
 }
 
 function cleanupDisplayName(displayName: string): string {
-  displayName = displayName.replace(UNWANTED_ENCLOSURES_REGEX, '');
+  displayName = displayName.replace(UNWANTED_ENCLOSURES_REGEX, (match, closing: string) => (closing ? '' : match));
   displayName = displayName.replace(UNWANTED_CHARS_REGEX, '');
   displayName = displayName.replace(MULTIPLE_WHITESPACES_REGEX, ' ');
   displayName = displayName.trim();
```

---

### Incident Patch 5: `862a351e` (2026-09-24)
**Commit Message**: fix(react-headless-components): allow changing the root element for PopoverSurface (#36789)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

**File**: `change/@fluentui-react-headless-components-preview-db3d166c-a92e-49ef-801a-4566268c0fd1.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix: allow changing the root element for PopoverSurface",
+  "packageName": "@fluentui/react-headless-components-preview",
+  "email": "dmytrokirpa@microsoft.com"
+}
```

**File**: `packages/react-components/react-headless-components-preview/library/docs/popover-spec.md` (modified, +25/-25)
```diff
@@ -4,7 +4,7 @@
 
 Popover is an anchored overlay surface that displays transient content (actions, details, confirmations, rich tooltips) next to a trigger element. It composes a trigger (optional if opened programmatically), a surface (the floating content), and an optional arrow. The surface elevates into the browser's **top layer** via the native HTML Popover API. Placement is computed via the native **CSS Anchor Positioning API** — no JS layout loop.
 
-Popover lets the browser manage dismissal: the surface is rendered with `popover="auto"`, so Escape, click-outside, and popover-stack peer-dismissal happen at HTML Popover spec timing and are mirrored back into React via the surface's `toggle` event. Open paths (click, hover, context-menu, controlled `open`) flow through React; close paths defer to the browser. Focus trapping is deferred to a later iteration — the surface is currently a non-modal `role="group"`.
+Popover lets the browser manage dismissal: a non-modal surface is rendered with `popover="auto"`, so Escape, click-outside, and popover-stack peer-dismissal happen at HTML Popover spec timing and are mirrored back into React via the surface's `toggle` event. Open paths (click, hover, context-menu, controlled `open`) flow through React; close paths defer to the browser. When `trapFocus` is enabled, the default `<dialog>` surface opens modally with `role="dialog"`.
 
 ## Composition
 
@@ -45,21 +45,22 @@ Popover is a compound component. `PopoverTrigger` is optional — a surface with
 
 ### `PopoverSurface`
 
-| Prop       | Type        | Default | Description                                                                                                             |
-| ---------- | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
-| `tabIndex` | `number`    | —       | Forwarded to the rendered `<dialog>` so the surface can be focusable when the consumer needs it (e.g. `tabIndex={-1}`). |
-| `children` | `ReactNode` | —       | Surface content.                                                                                                        |
+| Prop       | Type                | Default    | Description                                                                                                                                      |
+| ---------- | ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
+| `as`       | `'dialog' \| 'div'` | `'dialog'` | Root element. Use `as="div"` only for non-modal surfaces; focus trapping requires the default `<dialog>` and warns in development when combined. |
+| `tabIndex` | `number`            | —          | Forwarded to the rendered root so the surface can be focusable when the consumer needs it (e.g. `tabIndex={-1}`).                                |
+| `children` | `ReactNode`         | —          | Surface content.                                                                                                                                 |
 
 ## States
 
-| State              | Trigger                                                                                                                                    | Behaviour                                                                                                                                                                                                                                                                                                                                                                              | ARIA                                                                                                                                                                  |
-| ------------------ | ---------------------------------------------------------------------
```

**File**: `packages/react-components/react-headless-components-preview/library/etc/avatar-group.api.md` (modified, +0/-1)
```diff
@@ -16,7 +16,6 @@ import { AvatarGroupProvider } from '@fluentui/react-avatar';
 import { AvatarGroupSlots } from '@fluentui/react-avatar';
 import type { ComponentProps } from '@fluentui/react-utilities';
 import type { ComponentState } from '@fluentui/react-utilities';
-import type { DistributiveOmit } from '@fluentui/react-utilities';
 import type { EventData } from '@fluentui/react-utilities';
 import type { EventHandler } from '@fluentui/react-utilities';
 import type { ForwardRefComponent } from '@fluentui/react-utilities';
```

**File**: `packages/react-components/react-headless-components-preview/library/etc/info-label.api.md` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@
 
 import type { ComponentProps } from '@fluentui/react-utilities';
 import type { ComponentState } from '@fluentui/react-utilities';
-import type { DistributiveOmit } from '@fluentui/react-utilities';
 import type { EventData } from '@fluentui/react-utilities';
 import type { EventHandler } from '@fluentui/react-utilities';
 import type { ForwardRefComponent } from '@fluentui/react-utilities';
```

**File**: `packages/react-components/react-headless-components-preview/library/etc/popover.api.md` (modified, +1/-2)
```diff
@@ -8,7 +8,6 @@ import type { ARIAButtonType } from '@fluentui/react-aria';
 import type { ComponentProps } from '@fluentui/react-utilities';
 import type { ComponentState } from '@fluentui/react-utilities';
 import type { ContextSelector } from '@fluentui/react-context-selector';
-import type { DistributiveOmit } from '@fluentui/react-utilities';
 import type { EventData } from '@fluentui/react-utilities';
 import type { EventHandler } from '@fluentui/react-utilities';
 import type { ForwardRefComponent } from '@fluentui/react-utilities';
@@ -82,7 +81,7 @@ export type PopoverState = Required<Pick<PopoverProps, 'open' | 'trapFocus'>> &
 export const PopoverSurface: ForwardRefComponent<PopoverSurfaceProps>;
 
 // @public (undocumented)
-export type PopoverSurfaceProps = DistributiveOmit<ComponentProps<PopoverSurfaceSlots>, 'as'>;
+export type PopoverSurfaceProps = ComponentProps<PopoverSurfaceSlots>;
 
 // @public
 export type PopoverSurfaceSlots = {
```

---

### Incident Patch 6: `a54b5314` (2026-09-23)
**Commit Message**: fix(react-spinbutton): prevent double-step on trackpad tap (#36777)

**File**: `change/@fluentui-react-spinbutton-3a903811-3f74-41a7-9e69-97a49a5aa25e.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "type": "patch",
+  "comment": "fix(react-spinbutton): prevent double-step on trackpad tap by raising initial spin repeat delay",
+  "packageName": "@fluentui/react-spinbutton",
+  "email": "bernardo.sunderhus@gmail.com"
+}
```

**File**: `packages/react-components/react-spinbutton/library/src/components/SpinButton/SpinButton.test.tsx` (modified, +42/-1)
```diff
@@ -1,5 +1,5 @@
 import * as React from 'react';
-import { fireEvent, render, screen } from '@testing-library/react';
+import { act, fireEvent, render, screen } from '@testing-library/react';
 import userEvent from '@testing-library/user-event';
 import { Field } from '@fluentui/react-field';
 import { SpinButton } from './SpinButton';
@@ -78,6 +78,47 @@ describe('SpinButton', () => {
     expect(spinButtonInput.value).toEqual('1');
   });
 
+  it('does not auto-repeat on a short trackpad tap', () => {
+    jest.useFakeTimers();
+
+    render(<SpinButton defaultValue={0} />);
+
+    const [incrementButton] = screen.getAllByRole('button') as HTMLButtonElement[];
+
+    act(() => {
+      fireEvent.mouseDown(incrementButton);
+      jest.advanceTimersByTime(200);
+    });
+    act(() => {
+      fireEvent.mouseUp(incrementButton);
+    });
+
+    expect(getSpinButtonInput().value).toEqual('1');
+
+    jest.useRealTimers();
+  });
+
+  it('still auto-repeats after a true hold gesture', () => {
+    jest.useFakeTimers();
+
+    render(<SpinButton defaultValue={0} />);
+
+    const [incrementButton] = screen.getAllByRole('button') as HTMLButtonElement[];
+
+    act(() => {
+      fireEvent.mouseDown(incrementButton);
+      jest.advanceTimersByTime(350);
+    });
+
+    expect(getSpinButtonInput().value).toBe('2');
+
+    act(() => {
+      fireEvent.mouseUp(incrementButton);
+    });
+
+    jest.useRealTimers();
+  });
+
   describe('displayValue', () => {
     it('does not render `displayValue` when uncontrolled', () => {
       render(<SpinButton defaultValue={1} displayValue="$1.00" onChange={jest.fn()} />);
```

**File**: `packages/react-components/react-spinbutton/library/src/components/SpinButton/useSpinButton.tsx` (modified, +4/-1)
```diff
@@ -33,7 +33,10 @@ type InternalState = {
   atBound: SpinButtonBounds;
 };
 
-const DEFAULT_SPIN_DELAY_MS = 150;
+// A single tap on a trackpad can take ~200-250ms before mouseup fires. Keep the initial
+// repeat delay above that range so a tap is treated as one click while a true hold still
+// triggers repeat behavior.
+const DEFAULT_SPIN_DELAY_MS = 300;
 const MIN_SPIN_DELAY_MS = 80;
 const MAX_SPIN_TIME_MS = 1000;
 
```

---

### Incident Patch 7: `1c7519b6` (2026-09-22)
**Commit Message**: fix(react-positioning): improve safe zone hit testing (#36708)

Co-authored-by: Jakub Miskech <jakubmiskech@microsoft.com>

**File**: `change/@fluentui-react-positioning-982975b8-77a6-4364-bb65-696fed1f0904.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "patch",
+  "comment": "fix: improve safe zone hit testing and avoid rerenders during pointer movement",
+  "packageName": "@fluentui/react-positioning",
+  "email": "jakubmiskech@microsoft.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `packages/react-components/react-positioning/library/src/hooks/useSafeZoneArea/SafeZoneArea.styles.ts` (modified, +2/-2)
```diff
@@ -20,10 +20,10 @@ export const useStyles = makeStyles({
     top: 0,
     left: 0,
   },
-  triangle: {
+  safeZone: {
     pointerEvents: 'auto',
   },
-  triangleDebug: {
+  safeZoneDebug: {
     cursor: 'crosshair',
     fill: `color-mix(in srgb, ${tokens.colorPaletteGreenBackground3} 20%, transparent)`,
   },
```

**File**: `packages/react-components/react-positioning/library/src/hooks/useSafeZoneArea/SafeZoneArea.tsx` (modified, +62/-136)
```diff
@@ -13,6 +13,7 @@ import { pointsToSvgPath } from './pointsToSvgPath';
 import { useStyles } from './SafeZoneArea.styles';
 import type { Point } from './types';
 import { computeOutsideClipPath } from './computeOutsideClipPath';
+import { getSafeZonePoints } from './getSafeZonePoints';
 
 export type SafeZoneAreaImperativeHandle = {
   updateSVG: (options: { containerRect: DOMRect; targetRect: DOMRect; mouseCoordinates: Point }) => void;
@@ -35,55 +36,13 @@ export type SafeZoneAreaProps = {
   stateStore: ReturnType<typeof createSafeZoneAreaStateStore>;
 };
 
-/**
- * @internal
- */
-type SafeZoneAreaState = {
-  containerRect: DOMRect;
-  targetRect: DOMRect;
-  mouseCoordinates: Point;
-};
-
-// ---
-
-const EMPTY_RECT: DOMRect = {
-  top: 0,
-  right: 0,
-  bottom: 0,
-  left: 0,
-  width: 0,
-  height: 0,
-  x: 0,
-  y: 0,
-  toJSON() {
-    return '';
-  },
-};
-
-export function isSameRect(a: DOMRect, b: DOMRect): boolean {
-  return (
-    a.top === b.top &&
-    a.right === b.right &&
-    a.bottom === b.bottom &&
-    a.left === b.left &&
-    a.width === b.width &&
-    a.height === b.height
-  );
-}
-
-export function isSameCoordinates(a: Point, b: Point): boolean {
-  return a[0] === b[0] && a[1] === b[1];
-}
-
 // ---
 
 /**
  * A component that renders a safe zone area with SVG shapes. Uses `useSyncExternalStore` to manage its active state
  * to avoid causing re-renders in `useSafeZoneArea()` as the hook might be used in host components like `Menu`.
  *
- * Draws two shapes:
- * - a triangle that points to the target element which is an actual safe zone
- * - a rectangle for a clip path that clips out the target element
+ * Draws a polygon from the mouse to the facing edges of the container and clips out the target element.
  *
  * @internal
  */
@@ -95,112 +54,79 @@ export const SafeZoneArea = React.memo((props: SafeZoneAreaProps): JSXElement =>
 
   const active = useSyncExternalStore(stateStore.subscribe, stateStore.isActive);
   const svgRef = React.useRef<SVGSVGElement>(null);
-
-  const [state, setState] = React.useState<SafeZoneAreaState>(() => ({
-    containerRect: EMPTY_RECT,
-    targetRect: EMPTY_RECT,
-    mouseCoordinates: [0, 0],
-  }));
+  const safeZoneRef = React.useRef<SVGPathElement>(null);
+  const clipPathRef = React.useRef<SVGPathElement>(null);
+  const rectDebugRef = React.useRef<SVGPathElement>(null);
 
   React.useImperativeHandle(
     props.imperativeRef,
     () => ({
-      updateSVG(newState) {
-        setState(prevState => {
-          // Heads up!
-          // A small optimization to avoid unnecessary re-renders
-          if (
-            isSameRect(prevState.containerRect, newState.containerRect) &&
-            isSameRect(prevState.targetRect, newState.targetRect) &&
-            isSameCoordinates(prevState.mouseCoordinates, newState.mouseCoordinates)
-          ) {
-            return prevState;
-          }
-
-          return newState;
+      updateSVG({ containerRect, targetRect, mouseCoordinates }) {
+        const topOffset = Math.min(targetRect.top, containerRect.top);
+        const leftOffset = Math.min(targetRect.left, containerRect.left);
+        const bottomOffset = Math.max(targetRect.bottom, containerRect.bottom);
+        const rightOffset = Math.max(targetRect.right, containerRect.right);
+
+        const containerCorners = getRectCorners(containerRect, [leftOffset, topOffset]);
+        const targetCorners = getRectCorners(targetRect, [leftOffset, topOffset]);
+
+        // SVG coordinates are relative to its top-left corner.
+        const relativeMouseCoordinates: Point = [mouseCoordinates[0] - leftOffset, mouseCoordinates[1] - topOffset];
+        const mouseAnchor = getMouseAnchor(
+          containerCorners.topLeft,
+          containerCorners.bottomRight,
+          relativeMouseCoordinates,
+        );
+
+        const svgWidth = rightOffset - leftOffset;
+        const svgHeight = bottomOffset - topOffset;
+        const clipPath = computeOutsid
```

**File**: `packages/react-components/react-positioning/library/src/hooks/useSafeZoneArea/__snapshots__/SafeZoneArea.test.tsx.snap` (modified, +10/-46)
```diff
@@ -12,28 +12,19 @@ exports[`SafeZoneArea updateSVGs updates SVGs 1`] = `
     clip-path="url(#fui-_r_0_)"
   >
     <path
-      d="M -2.978932121654964,-205.2166790391817,200,0,400,0 z"
-    />
-    <path
-      d="M -2.978932121654964,-205.2166790391817,400,0,400,300 z"
-    />
-    <path
-      d="M -2.978932121654964,-205.2166790391817,400,300,200,300 z"
-    />
-    <path
-      d="M -2.978932121654964,-205.2166790391817,200,300,200,0 z"
+      d="M -2.978932121654964,-205.2166790391817,200,300,200,0,400,0 z"
     />
   </g>
   <clippath
     id="fui-_r_0_"
   >
     <path
-      d="M 0,0 H 400 V 300 H 0 Z M 0,100 V 150 H 100 V 100 H 0 Z M 200,0 V 300 H 400 V 0 H 200 Z "
+      d="M 0,0 H 400 V 300 H 0 Z M 0,100 V 150 H 100 V 100 H 0 Z "
     />
   </clippath>
   <path
     class=""
-    d="M 0,0 H 400 V 300 H 0 Z M 0,100 V 150 H 100 V 100 H 0 Z M 200,0 V 300 H 400 V 0 H 200 Z "
+    d="M 0,0 H 400 V 300 H 0 Z M 0,100 V 150 H 100 V 100 H 0 Z "
   />
 </svg>
 `;
@@ -49,29 +40,20 @@ exports[`SafeZoneArea updateSVGs updates SVGs 2`] = `
     class=""
     clip-path="url(#fui-_r_1_)"
   >
-    <path
-      d="M 111.2475657231036,329.9610515696578,0,0,200,0 z"
-    />
-    <path
-      d="M 111.2475657231036,329.9610515696578,200,0,200,300 z"
-    />
     <path
       d="M 111.2475657231036,329.9610515696578,200,300,0,300 z"
     />
-    <path
-      d="M 111.2475657231036,329.9610515696578,0,300,0,0 z"
-    />
   </g>
   <clippath
     id="fui-_r_1_"
   >
     <path
-      d="M 0,0 H 400 V 300 H 0 Z M 300,100 V 150 H 400 V 100 H 300 Z M 0,0 V 300 H 200 V 0 H 0 Z "
+      d="M 0,0 H 400 V 300 H 0 Z M 300,100 V 150 H 400 V 100 H 300 Z "
     />
   </clippath>
   <path
     class=""
-    d="M 0,0 H 400 V 300 H 0 Z M 300,100 V 150 H 400 V 100 H 300 Z M 0,0 V 300 H 200 V 0 H 0 Z "
+    d="M 0,0 H 400 V 300 H 0 Z M 300,100 V 150 H 400 V 100 H 300 Z "
   />
 </svg>
 `;
@@ -87,15 +69,6 @@ exports[`SafeZoneArea updateSVGs updates SVGs 3`] = `
     class=""
     clip-path="url(#fui-_r_2_)"
   >
-    <path
-      d="M -210,350,0,200,200,200 z"
-    />
-    <path
-      d="M -210,350,200,200,200,500 z"
-    />
-    <path
-      d="M -210,350,200,500,0,500 z"
-    />
     <path
       d="M -210,350,0,500,0,200 z"
     />
@@ -104,12 +77,12 @@ exports[`SafeZoneArea updateSVGs updates SVGs 3`] = `
     id="fui-_r_2_"
   >
     <path
-      d="M 0,0 H 200 V 500 H 0 Z M 100,0 V 50 H 200 V 0 H 100 Z M 0,200 V 500 H 200 V 200 H 0 Z "
+      d="M 0,0 H 200 V 500 H 0 Z M 100,0 V 50 H 200 V 0 H 100 Z "
     />
   </clippath>
   <path
     class=""
-    d="M 0,0 H 200 V 500 H 0 Z M 100,0 V 50 H 200 V 0 H 100 Z M 0,200 V 500 H 200 V 200 H 0 Z "
+    d="M 0,0 H 200 V 500 H 0 Z M 100,0 V 50 H 200 V 0 H 100 Z "
   />
 </svg>
 `;
@@ -126,28 +99,19 @@ exports[`SafeZoneArea updateSVGs updates SVGs 4`] = `
     clip-path="url(#fui-_r_3_)"
   >
     <path
-      d="M 218.33309420986427,408.18129645788565,0,0,200,0 z"
-    />
-    <path
-      d="M 218.33309420986427,408.18129645788565,200,0,200,300 z"
-    />
-    <path
-      d="M 218.33309420986427,408.18129645788565,200,300,0,300 z"
-    />
-    <path
-      d="M 218.33309420986427,408.18129645788565,0,300,0,0 z"
+      d="M 218.33309420986427,408.18129645788565,200,0,200,300,0,300 z"
     />
   </g>
   <clippath
     id="fui-_r_3_"
   >
     <path
-      d="M 0,0 H 200 V 450 H 0 Z M 100,400 V 450 H 200 V 400 H 100 Z M 0,0 V 300 H 200 V 0 H 0 Z "
+      d="M 0,0 H 200 V 450 H 0 Z M 100,400 V 450 H 200 V 400 H 100 Z "
     />
   </clippath>
   <path
     class=""
-    d="M 0,0 H 200 V 450 H 0 Z M 100,400 V 450 H 200 V 400 H 100 Z M 0,0 V 300 H 200 V 0 H 0 Z "
+    d="M 0,0 H 200 V 450 H 0 Z M 100,400 V 450 H 200 V 400 H 100 Z "
   />
 </svg>
 `;
```

**File**: `packages/react-components/react-positioning/library/src/hooks/useSafeZoneArea/computeOutsideClipPath.test.ts` (modified, +13/-58)
```diff
@@ -5,61 +5,43 @@ describe('computeOutsideClipPath', () => {
     const svgWidth = 1000;
     const svgHeight = 800;
     const targetRect = { x: 100, y: 100, width: 200, height: 150 };
-    const containerRect = { x: 400, y: 400, width: 300, height: 200 };
+    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect);
 
-    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect, containerRect);
-
-    expect(pathData).toBe(
-      [
-        'M 0,0 H 1000 V 800 H 0 Z ',
-        'M 100,100 V 250 H 300 V 100 H 100 Z ',
-        'M 400,400 V 600 H 700 V 400 H 400 Z ',
-      ].join(''),
-    );
+    expect(pathData).toBe(['M 0,0 H 1000 V 800 H 0 Z ', 'M 100,100 V 250 H 300 V 100 H 100 Z '].join(''));
   });
 
   it('should handle zero-sized SVG dimensions', () => {
     const svgWidth = 0;
     const svgHeight = 0;
     const targetRect = { x: 10, y: 10, width: 50, height: 50 };
-    const containerRect = { x: 100, y: 100, width: 50, height: 50 };
-
-    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect, containerRect);
+    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect);
 
-    expect(pathData).toBe(
-      ['M 0,0 H 0 V 0 H 0 Z ', 'M 10,10 V 60 H 60 V 10 H 10 Z ', 'M 100,100 V 150 H 150 V 100 H 100 Z '].join(''),
-    );
+    expect(pathData).toBe(['M 0,0 H 0 V 0 H 0 Z ', 'M 10,10 V 60 H 60 V 10 H 10 Z '].join(''));
   });
 
   it('should skip rectangles with zero width', () => {
     const svgWidth = 1000;
     const svgHeight = 800;
     const targetRect = { x: 100, y: 100, width: 0, height: 150 };
-    const containerRect = { x: 400, y: 400, width: 300, height: 200 };
-
-    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect, containerRect);
+    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect);
 
-    expect(pathData).toBe(['M 0,0 H 1000 V 800 H 0 Z ', 'M 400,400 V 600 H 700 V 400 H 400 Z '].join(''));
+    expect(pathData).toBe('M 0,0 H 1000 V 800 H 0 Z ');
   });
 
   it('should skip rectangles with zero height', () => {
     const svgWidth = 1000;
     const svgHeight = 800;
     const targetRect = { x: 100, y: 100, width: 200, height: 0 };
-    const containerRect = { x: 400, y: 400, width: 300, height: 200 };
-
-    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect, containerRect);
+    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect);
 
-    expect(pathData).toBe(['M 0,0 H 1000 V 800 H 0 Z ', 'M 400,400 V 600 H 700 V 400 H 400 Z '].join(''));
+    expect(pathData).toBe('M 0,0 H 1000 V 800 H 0 Z ');
   });
 
   it('should skip rectangles with negative dimensions', () => {
     const svgWidth = 1000;
     const svgHeight = 800;
     const targetRect = { x: 100, y: 100, width: 200, height: 150 };
-    const containerRect = { x: 400, y: 400, width: -10, height: -20 };
-
-    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect, containerRect);
+    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect);
 
     expect(pathData).toBe(['M 0,0 H 1000 V 800 H 0 Z ', 'M 100,100 V 250 H 300 V 100 H 100 Z '].join(''));
   });
@@ -68,46 +50,19 @@ describe('computeOutsideClipPath', () => {
     const svgWidth = 1000.5;
     const svgHeight = 800.25;
     const targetRect = { x: 100.75, y: 100.5, width: 200.25, height: 150.5 };
-    const containerRect = { x: 400.25, y: 400.75, width: 300.5, height: 200.25 };
-
-    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect, containerRect);
+    const pathData = computeOutsideClipPath(svgWidth, svgHeight, targetRect);
 
     expect(pathData).toBe(
-      [
-        'M 0,0 H 1000.5 V 800.25 H 0 Z ',
-        'M 100.75,100.5 V 251 H 301 V 100.5 H 100.75 Z ',
-        'M 400.25,400.75 V 601 H 700.75 V 400.75 H 400.25 Z ',
-      ].join(''),
-    );
-  });
-
-  it('should handle overlapping rectangles correctly', () => {
-    const svgWidth = 1000;
-    const svgHei
```

---

### Incident Patch 8: `b7469bcb` (2026-09-22)
**Commit Message**: Fix Dropdown filled boundary in high contrast themes (#36637)

**File**: `change/@fluentui-react-combobox-dropdown-high-contrast-border.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "patch",
+  "comment": "fix: render filled Dropdown boundaries in high contrast themes",
+  "packageName": "@fluentui/react-combobox",
+  "email": "bernardo.sunderhus@gmail.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `packages/react-components/react-combobox/library/src/components/Dropdown/useDropdownStyles.styles.ts` (modified, +2/-2)
```diff
@@ -171,11 +171,11 @@ const useStyles = makeStyles({
   },
   'filled-lighter': {
     backgroundColor: tokens.colorNeutralBackground1,
-    border: `${tokens.strokeWidthThin} solid transparent`,
+    border: `${tokens.strokeWidthThin} solid ${tokens.colorTransparentStroke}`,
   },
   'filled-darker': {
     backgroundColor: tokens.colorNeutralBackground3,
-    border: `${tokens.strokeWidthThin} solid transparent`,
+    border: `${tokens.strokeWidthThin} solid ${tokens.colorTransparentStroke}`,
   },
   invalid: {
     ':not(:focus-within),:hover:not(:focus-within)': {
```

---

### Incident Patch 9: `3246cff3` (2026-09-22)
**Commit Message**: fix(react-tooltip): hide tooltips only when their trigger is fully clipped (#36605)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Co-authored-by: Dmytro Kirpa <dmytrokirpa@microsoft.com>

**File**: `change/@fluentui-react-tooltip-36604-tooltip-hide-boundary.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "patch",
+  "comment": "fix: hide tooltips only when their trigger is fully clipped, not when portaled content escapes the trigger's clipping boundary",
+  "packageName": "@fluentui/react-tooltip",
+  "email": "paulmardling@microsoft.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `packages/react-components/react-tooltip/library/src/components/Tooltip/Tooltip.cy.tsx` (modified, +294/-1)
```diff
@@ -10,6 +10,11 @@ const mount = (element: React.ReactElement) => {
   mountBase(<FluentProvider theme={teamsLightTheme}>{element}</FluentProvider>);
 };
 
+const hoverTrigger = () => {
+  cy.get('body').realHover({ position: 'bottomRight' });
+  cy.get('#trigger').realHover();
+};
+
 describe('Tooltip', () => {
   describe('overflow behavior (regression: #32882)', () => {
     it('hides and restores the tooltip when its trigger scrolls out of view', () => {
@@ -31,7 +36,7 @@ describe('Tooltip', () => {
         </div>,
       );
 
-      cy.get('#trigger').realHover();
+      hoverTrigger();
 
       cy.get('[role="tooltip"]')
         .should('be.visible')
@@ -43,5 +48,293 @@ describe('Tooltip', () => {
           cy.wrap($tooltip).should('be.visible');
         });
     });
+
+    it('keeps partially clipped triggers visible and hides only after full clipping', () => {
+      mount(
+        <div id="scroll-container" style={{ height: '100px', overflow: 'auto', position: 'relative' }}>
+          <div style={{ height: '400px', paddingTop: '8px' }}>
+            <Tooltip content="Partially clipped trigger" relationship="label" visible>
+              <Button id="trigger">Trigger</Button>
+            </Tooltip>
+          </div>
+        </div>,
+      );
+
+      cy.get('[role="tooltip"]')
+        .should('be.visible')
+        .then($tooltip => {
+          cy.get('#scroll-container').scrollTo(0, 20);
+          cy.get('#trigger').should($trigger => {
+            const triggerRect = $trigger[0].getBoundingClientRect();
+            const containerRect = $trigger[0].closest('#scroll-container')!.getBoundingClientRect();
+
+            expect(triggerRect.top).to.be.lessThan(containerRect.top);
+            expect(triggerRect.bottom).to.be.greaterThan(containerRect.top);
+          });
+          cy.wrap($tooltip).should('be.visible');
+
+          cy.get('#scroll-container').scrollTo(0, 300);
+          cy.wrap($tooltip).should('not.be.visible');
+          cy.get('#scroll-container').scrollTo(0, 0);
+          cy.wrap($tooltip).should('be.visible');
+        });
+    });
+  });
+
+  describe('viewport boundaries', () => {
+    [
+      { position: 'above' as const, top: 0, left: 300 },
+      { position: 'below' as const, bottom: 0, left: 300 },
+      { position: 'before' as const, top: 200, left: 0 },
+      { position: 'after' as const, top: 200, right: 0 },
+    ].forEach(({ position, ...style }) => {
+      it(`keeps the tooltip in view at the ${position} viewport edge`, () => {
+        cy.viewport(800, 600);
+        mount(
+          <div style={{ position: 'fixed', ...style }}>
+            <Tooltip content="Viewport tooltip" relationship="label" visible positioning={position}>
+              <Button id="trigger">Trigger</Button>
+            </Tooltip>
+          </div>,
+        );
+
+        cy.get('[role="tooltip"]')
+          .should($tooltip => expect($tooltip).to.have.attr('data-popper-placement'))
+          .should('be.visible')
+          .should($tooltip => {
+            const rect = $tooltip[0].getBoundingClientRect();
+
+            expect(rect.top).to.be.at.least(0);
+            expect(rect.left).to.be.at.least(0);
+            expect(rect.bottom).to.be.at.most(600);
+            expect(rect.right).to.be.at.most(800);
+          });
+      });
+    });
+
+    it('does not hide escaped content for a visible trigger with a pinned large offset', () => {
+      const Example = () => {
+        const [offset, setOffset] = React.useState(1000);
+
+        return (
+          <>
+            <Button onClick={() => setOffset(4)}>Reset offset</Button>
+            <div style={{ position: 'fixed', top: '200px', left: '300px' }}>
+              <Tooltip content="Offset tooltip" relationship="label" visible positioning={{ pinned: true, offset }}>
+                <Button id="trigger">Trigger</Button>
+              </Tooltip>
+            </div>
+          </>
+        );
+      };
+
+      cy.viewport(800, 
```

**File**: `packages/react-components/react-tooltip/library/src/components/Tooltip/Tooltip.test.tsx` (modified, +14/-8)
```diff
@@ -189,9 +189,11 @@ describe('Tooltip', () => {
   });
 
   it.each([
+    { escaped: false, referenceHidden: false },
     { escaped: true, referenceHidden: false },
     { escaped: false, referenceHidden: true },
-  ])('hides and restores the tooltip based on positioning visibility flags', flags => {
+    { escaped: true, referenceHidden: true },
+  ])('follows reference visibility for positioning flags %o', flags => {
     const onPositioningEnd = jest.fn();
     const result = render(
       <Tooltip content="Tooltip content" relationship="label" visible positioning={{ onPositioningEnd }}>
@@ -200,23 +202,27 @@ describe('Tooltip', () => {
     );
     const tooltip = getByRoleTooltip(result);
 
-    const hiddenEvent = new CustomEvent('fui-positioningend', {
+    const positioningEvent = new CustomEvent('fui-positioningend', {
       detail: { placement: 'top', ...flags },
     });
-    act(() => tooltip.dispatchEvent(hiddenEvent));
+    act(() => tooltip.dispatchEvent(positioningEvent));
 
     expect(getByRoleTooltip(result)).toBe(tooltip);
-    expect(getComputedStyle(tooltip).visibility).toBe('hidden');
-    expect(getComputedStyle(tooltip).pointerEvents).toBe('none');
-    expect(onPositioningEnd).toHaveBeenCalledWith(hiddenEvent);
+    expect(getComputedStyle(tooltip).visibility === 'hidden').toBe(flags.referenceHidden);
+    if (flags.referenceHidden) {
+      expect(getComputedStyle(tooltip).pointerEvents).toBe('none');
+    }
+    expect(onPositioningEnd).toHaveBeenCalledTimes(1);
+    expect(onPositioningEnd).toHaveBeenLastCalledWith(positioningEvent);
 
     const visibleEvent = new CustomEvent('fui-positioningend', {
-      detail: { placement: 'top', escaped: false, referenceHidden: false },
+      detail: { placement: 'top', escaped: flags.escaped, referenceHidden: false },
     });
     act(() => tooltip.dispatchEvent(visibleEvent));
 
     expect(getByRoleTooltip(result)).toBe(tooltip);
     expect(getComputedStyle(tooltip).visibility).not.toBe('hidden');
-    expect(onPositioningEnd).toHaveBeenCalledWith(visibleEvent);
+    expect(onPositioningEnd).toHaveBeenCalledTimes(2);
+    expect(onPositioningEnd).toHaveBeenLastCalledWith(visibleEvent);
   });
 });
```

**File**: `packages/react-components/react-tooltip/library/src/components/Tooltip/useTooltipBase.tsx` (modified, +2/-3)
```diff
@@ -83,9 +83,8 @@ export const useTooltipBase_unstable = (props: TooltipBaseProps): TooltipBaseSta
 
   const resolvedPositioning = resolvePositioningShorthand(state.positioning);
   const onPositioningEnd = useEventCallback((event: OnPositioningEndEvent) => {
-    const { escaped, referenceHidden } = event.detail;
-
-    setHidden(escaped || referenceHidden);
+    // Portaled tooltips can escape the trigger's clipping ancestors while the trigger is still visible.
+    setHidden(event.detail.referenceHidden);
     resolvedPositioning.onPositioningEnd?.(event);
   });
 
```

---

### Incident Patch 10: `c3bb4b97` (2026-09-22)
**Commit Message**: fix(react-headless-components-preview): preserve popover focus (#36774)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

**File**: `change/@fluentui-react-headless-components-preview-a2604a42-42f7-4ea0-8a67-55b981296869.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "patch",
+  "comment": "fix: preserve focus when opening non-modal Popover surfaces",
+  "packageName": "@fluentui/react-headless-components-preview",
+  "email": "dmytrokirpa@microsoft.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `packages/react-components/react-headless-components-preview/library/etc/avatar-group.api.md` (modified, +3/-0)
```diff
@@ -16,6 +16,7 @@ import { AvatarGroupProvider } from '@fluentui/react-avatar';
 import { AvatarGroupSlots } from '@fluentui/react-avatar';
 import type { ComponentProps } from '@fluentui/react-utilities';
 import type { ComponentState } from '@fluentui/react-utilities';
+import type { DistributiveOmit } from '@fluentui/react-utilities';
 import type { EventData } from '@fluentui/react-utilities';
 import type { EventHandler } from '@fluentui/react-utilities';
 import type { ForwardRefComponent } from '@fluentui/react-utilities';
@@ -30,6 +31,8 @@ import { renderAvatarGroup_unstable as renderAvatarGroup } from '@fluentui/react
 import { renderAvatarGroupItem_unstable as renderAvatarGroupItem } from '@fluentui/react-avatar';
 import type { Slot } from '@fluentui/react-utilities';
 import type { TooltipBaseProps } from '@fluentui/react-tooltip';
+import type { TooltipTriggerProps as TooltipTriggerProps_2 } from '@fluentui/react-tooltip';
+import type { TriggerProps } from '@fluentui/react-utilities';
 import { useAvatarGroupContext_unstable as useAvatarGroupContext } from '@fluentui/react-avatar';
 
 // @public
```

**File**: `packages/react-components/react-headless-components-preview/library/etc/info-label.api.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 
 import type { ComponentProps } from '@fluentui/react-utilities';
 import type { ComponentState } from '@fluentui/react-utilities';
+import type { DistributiveOmit } from '@fluentui/react-utilities';
 import type { EventData } from '@fluentui/react-utilities';
 import type { EventHandler } from '@fluentui/react-utilities';
 import type { ForwardRefComponent } from '@fluentui/react-utilities';
```

**File**: `packages/react-components/react-headless-components-preview/library/etc/popover.api.md` (modified, +8/-4)
```diff
@@ -8,6 +8,7 @@ import type { ARIAButtonType } from '@fluentui/react-aria';
 import type { ComponentProps } from '@fluentui/react-utilities';
 import type { ComponentState } from '@fluentui/react-utilities';
 import type { ContextSelector } from '@fluentui/react-context-selector';
+import type { DistributiveOmit } from '@fluentui/react-utilities';
 import type { EventData } from '@fluentui/react-utilities';
 import type { EventHandler } from '@fluentui/react-utilities';
 import type { ForwardRefComponent } from '@fluentui/react-utilities';
@@ -81,18 +82,21 @@ export type PopoverState = Required<Pick<PopoverProps, 'open' | 'trapFocus'>> &
 export const PopoverSurface: ForwardRefComponent<PopoverSurfaceProps>;
 
 // @public (undocumented)
-export type PopoverSurfaceProps = ComponentProps<PopoverSurfaceSlots>;
+export type PopoverSurfaceProps = DistributiveOmit<ComponentProps<PopoverSurfaceSlots>, 'as'>;
 
 // @public
 export type PopoverSurfaceSlots = {
-    root: Slot<'dialog'>;
+    root: Slot<'dialog', 'div'>;
 };
 
 // @public (undocumented)
 export type PopoverSurfaceState = ComponentState<PopoverSurfaceSlots> & {
     withArrow: boolean | undefined;
     arrowRef: React_2.RefObject<HTMLDivElement | null>;
-    'data-open': string;
+    root: {
+        'data-open'?: string;
+        'data-popover-surface'?: string;
+    };
 };
 
 // @public
@@ -132,7 +136,7 @@ export const usePopoverContextValues: (state: PopoverState) => {
 };
 
 // @public
-export const usePopoverSurface: (props: PopoverSurfaceProps, ref: React_2.Ref<HTMLDialogElement>) => PopoverSurfaceState;
+export const usePopoverSurface: (props: PopoverSurfaceProps, ref: React_2.Ref<HTMLDialogElement | HTMLDivElement>) => PopoverSurfaceState;
 
 // @public
 export const usePopoverTrigger: (props: PopoverTriggerProps) => PopoverTriggerState;
```

**File**: `packages/react-components/react-headless-components-preview/library/etc/teaching-popover.api.md` (modified, +8/-4)
```diff
@@ -7,6 +7,7 @@
 import type { ARIAButtonType } from '@fluentui/react-aria';
 import type { ComponentProps } from '@fluentui/react-utilities';
 import type { ComponentState } from '@fluentui/react-utilities';
+import type { DistributiveOmit } from '@fluentui/react-utilities';
 import type { EventData } from '@fluentui/react-utilities';
 import type { EventHandler } from '@fluentui/react-utilities';
 import type { ForwardRefComponent } from '@fluentui/react-utilities';
@@ -264,18 +265,21 @@ export type TeachingPopoverState = Required<Pick<TeachingPopoverProps, 'open' |
 export const TeachingPopoverSurface: ForwardRefComponent<TeachingPopoverSurfaceProps>;
 
 // @public (undocumented)
-export type TeachingPopoverSurfaceProps = ComponentProps<TeachingPopoverSurfaceSlots>;
+export type TeachingPopoverSurfaceProps = DistributiveOmit<ComponentProps<TeachingPopoverSurfaceSlots>, 'as'>;
 
 // @public
 export type TeachingPopoverSurfaceSlots = {
-    root: Slot<'dialog'>;
+    root: Slot<'dialog', 'div'>;
 };
 
 // @public (undocumented)
 export type TeachingPopoverSurfaceState = ComponentState<TeachingPopoverSurfaceSlots> & {
     withArrow: boolean | undefined;
     arrowRef: React_2.RefObject<HTMLDivElement | null>;
-    'data-open': string;
+    root: {
+        'data-open'?: string;
+        'data-popover-surface'?: string;
+    };
 };
 
 // @public (undocumented)
@@ -336,7 +340,7 @@ export { useTeachingPopoverFooter }
 export { useTeachingPopoverHeader }
 
 // @public
-export const useTeachingPopoverSurface: (props: TeachingPopoverSurfaceProps, ref: React_2.Ref<HTMLDialogElement>) => TeachingPopoverSurfaceState;
+export const useTeachingPopoverSurface: (props: TeachingPopoverSurfaceProps, ref: React_2.Ref<HTMLDialogElement | HTMLDivElement>) => TeachingPopoverSurfaceState;
 
 export { useTeachingPopoverTitle }
 
```

#### Recent Merged Pull Requests:
- **PR #36797** (2026-09-25): feat: add build-time icon variants to public Storybooks (@Hotell)
- **PR #36794** (2026-09-25): fix(react-tooltip): preserve virtual target tooltips (@PaulGMardling)
- **PR #36793** (closed): feat(storybook): enable atomic React icons (@dmytrokirpa)
- **PR #36789** (2026-09-24): fix(react-headless-components): allow changing the root element for PopoverSurface (@dmytrokirpa)
- **PR #36788** (closed): Fix Tab selection in Combobox and TagPicker (@bsunderhus)
- **PR #36783** (2026-09-24): chore: require explicit invocation for operational skills (@Hotell)
- **PR #36781** (closed): Fix incomplete Markdown table escaping in Fluent UI CLI (@Copilot)
- **PR #36780** (2026-09-23): Pin actions to full-length SHAs (@ecraig12345)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
