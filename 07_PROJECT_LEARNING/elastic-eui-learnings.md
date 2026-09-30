# Forensic Learning Record (Deep Inspection): elastic/eui

> **Canonical Artifact**: `07_PROJECT_LEARNING/elastic-eui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/elastic/eui](https://github.com/elastic/eui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:43:17.490Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `elastic/eui`
- **Description**: Elastic UI Framework 🙌
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6370 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/docusaurus-preset/src/index.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type {
  LoadContext,
  PluginConfig,
  PluginModule,
  PluginOptions,
  Preset,
} from '@docusaurus/types';
import { Options } from './options';

/**
 * Docusaurus plugin to ignore any unwanted style imports, e.g. like Infima stylesheet imports.
 * This is needed so that Infima doesn't pollute global CSS scope
 * and affect how EUI components are rendered
 */
const ignoreInheritedStylesPlugin: PluginModule = () => ({
  name: 'ignore-styles-plugin',
  configureWebpack() {
    return {
      module: {
        rules: [
          {
            test: /node_modules\/infima/,
            use: 'null-loader',
          },
          {
            test: /node_modules\/@docusaurus\/theme-common\/lib\/hooks\/styles.css/,
            use: 'null-loader',
          },
        ],
      },
    };
  },
});

const makePluginConfig = (
  source: string,
  options?: PluginOptions
): string | [string, PluginOptions] => {
  if (!options) {
    return require.resolve(source);
  }

  return [require.resolve(source), options];
};

export default function preset(
  context: LoadContext,
  options: Options = {}
): Preset {
  const isProd = process.env.NODE_ENV === 'production';

  const themes: PluginConfig[] = [
    // EUI theme is based on the classic docusaurus theme
    require.resolve('@docusaurus/theme-classic'),

    require.resolve('@elastic/eui-docusaurus-theme'),
  ];

  const plugins: PluginConfig[] = [
    ignoreInheritedStylesPlugin,
    makePluginConfig('@docusaurus/plugin-content-docs', options.docs),
    makePluginConfig('@docusaurus/plugin-content-pages', options.pages),
    makePluginConfig('@docusaurus/plugin-svgr', options.svgr),
  ];

  if (options.blog !== false) {
    plugins.push(
      makePluginConfig('@docusaurus/plugin-content-blog', options.blog)
    );
  }

  if (isProd) {
    plugins.push(
      makePluginConfig('@docusaurus/plugin-sitemap', options.sitemap)
    );
  }

  if (options.googleAnalytics) {
    plugins.push(
      makePluginConfig(
        '@docusaurus/plugin-google-analytics',
        options.googleAnalytics
      )
    );
  }

  if (options.googleTagManager) {
    plugins.push(
      makePluginConfig(
        '@docusaurus/plugin-google-tag-manager',
        options.googleTagManager
      )
    );
  }

  if (options.gtag) {
    plugins.push(
      makePluginConfig('@docusaurus/plugin-google-gtag', options.gtag)
    );
  }

  return { themes, plugins };
}

export type { Options };

```

### Core Architecture Module: `packages/docusaurus-preset/src/options.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

// Based on https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-preset-classic/src/options.ts

import type { ThemeConfig as BaseThemeConfig } from '@docusaurus/types';
import type { UserThemeConfig as ClassicThemeConfig } from '@docusaurus/theme-common';

import type { Options as DocsPluginOptions } from '@docusaurus/plugin-content-docs';
import type { Options as BlogPluginOptions } from '@docusaurus/plugin-content-blog';
import type { Options as PagesPluginOptions } from '@docusaurus/plugin-content-pages';
import type { Options as SitemapPluginOptions } from '@docusaurus/plugin-sitemap';
import type { Options as SVGRPluginOptions } from '@docusaurus/plugin-svgr';
import type { Options as ThemeOptions } from '@docusaurus/theme-classic';
import type { Options as GAPluginOptions } from '@docusaurus/plugin-google-analytics';
import type { Options as GtagPluginOptions } from '@docusaurus/plugin-google-gtag';
import type { Options as GTMPluginOptions } from '@docusaurus/plugin-google-tag-manager';

export type Options = {
  /**
   * Options for `@docusaurus/plugin-content-docs`.
   */
  docs?: DocsPluginOptions;

  /**
   * Options for `@docusaurus/plugin-content-pages`.
   */
  pages?: PagesPluginOptions;

  /**
   * Options for `@docusaurus/plugin-svgr`.
   */
  svgr?: SVGRPluginOptions;

  /**
   * Options for `@docusaurus/plugin-sitemap`.
   * Enabled in production builds
   */
  sitemap?: SitemapPluginOptions;

  /**
   * Options for `@docusaurus/theme-classic`.
   */
  theme?: ThemeOptions;

  /**
   * Options for `@docusaurus/plugin-content-blog`.
   * Use `false` to disable.
   */
  blog?: false | BlogPluginOptions;

  /**
   * Options for `@docusaurus/plugin-google-analytics`. Only enabled when the
   * key is present.
   */
  googleAnalytics?: GAPluginOptions;

  /**
   * Options for `@docusaurus/plugin-google-gtag`. Only enabled when the key
   * is present.
   */
  gtag?: GtagPluginOptions;

  /**
   * Options for `@docusaurus/plugin-google-tag-manager`. Only enabled when
   * the key is present.
   */
  googleTagManager?: GTMPluginOptions;
};

export type ThemeConfig = BaseThemeConfig & ClassicThemeConfig;

```

### Core Architecture Module: `packages/docusaurus-theme/src/components/badge/index.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { EuiBadge } from '@elastic/eui';

export const Badge = EuiBadge;

```

### Core Architecture Module: `packages/docusaurus-theme/src/components/codesandbox_icon/codesandbox_icon.tsx`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { HTMLAttributes } from 'react';

type Props = HTMLAttributes<SVGElement>;

export const CodeSandboxIcon = (props: Props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    preserveAspectRatio="xMidYMid"
    viewBox="-20 0 296 296"
    {...props}
  >
    <path d="M115.498 261.088v-106.61L23.814 101.73v60.773l41.996 24.347v45.7l49.688 28.54Zm23.814.627 50.605-29.151V185.78l42.269-24.495v-60.011l-92.874 53.621v106.82Zm80.66-180.887-48.817-28.289-42.863 24.872-43.188-24.897-49.252 28.667 91.914 52.882 92.206-53.235ZM0 222.212V74.495L127.987 0 256 74.182v147.797l-128.016 73.744L0 222.212Z" />
  </svg>
);

```

### Core Architecture Module: `packages/docusaurus-theme/src/components/codesandbox_icon/index.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export { CodeSandboxIcon } from './codesandbox_icon';

```

### Core Architecture Module: `packages/docusaurus-theme/src/components/demo/actions_bar/actions_bar.tsx`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import {
  EuiButton,
  EuiButtonIcon,
  EuiFlexGroup,
  EuiToolTip,
  useEuiMemoizedStyles,
  UseEuiTheme,
  darken,
} from '@elastic/eui';
import { css } from '@emotion/react';
import { extraActions } from '@theme/Demo/actions';
import { DemoSourceMeta, ExtraFiles } from '../demo';

export interface DemoActionsBarProps {
  activeSource: DemoSourceMeta | null;
  sources: DemoSourceMeta[];
  extraFiles?: ExtraFiles;
  previewWrapperSource?: string;
  isSourceOpen: boolean;
  setSourceOpen(isOpen: boolean): void;
  onClickReloadExample(): void;
  onClickCopyToClipboard(): void;
}

const getDemoActionsBarStyles = (euiTheme: UseEuiTheme) => {
  return {
    actionsBar: css`
      padding: var(--eui-size-s);
      background: ${darken(euiTheme.euiTheme.colors.body, 0.05)};
      border-top: 1px solid var(--docs-demo-border-color);

      &:last-child {
        // border radius should be 1px smaller to work nicely
        // with the wrapper border width of 1px
        border-radius: 0 0 calc(var(--docs-demo-border-radius) - 1px)
          calc(var(--docs-demo-border-radius) - 1px);
      }
    `,
    button: css`
      margin-right: auto;
    `,
  };
};

export const DemoActionsBar = ({
  isSourceOpen,
  setSourceOpen,
  activeSource,
  sources,
  extraFiles,
  previewWrapperSource,
  onClickReloadExample,
  onClickCopyToClipboard,
}: DemoActionsBarProps) => {
  const styles = useEuiMemoizedStyles(getDemoActionsBarStyles);
  const copyToClipboardLabel = 'Copy to clipboard';
  const reloadExampleLabel = 'Reload example';

  return (
    <EuiFlexGroup alignItems="center" css={styles.actionsBar} gutterSize="s">
      <EuiButton
        css={styles.button}
        onClick={() => setSourceOpen(!isSourceOpen)}
        size="s"
        color="text"
        minWidth={false}
      >
        {isSourceOpen ? 'Hide source' : 'Show source'}
      </EuiButton>
      {extraActions.map((ActionComponent) => (
        <ActionComponent
          key={ActionComponent.displayName ?? ActionComponent.name}
          sources={sources}
          extraFiles={extraFiles}
          previewWrapperSource={previewWrapperSource}
          activeSource={activeSource}
        />
      ))}
      <EuiToolTip content={copyToClipboardLabel} disableScreenReaderOutput>
        <EuiButtonIcon
          size="s"
          iconType="copy"
          color="text"
          onClick={onClickCopyToClipboard}
          aria-label={copyToClipboardLabel}
        />
      </EuiToolTip>
      <EuiToolTip content={reloadExampleLabel} disableScreenReaderOutput>
        <EuiButtonIcon
          size="s"
          iconType="refresh"
          color="text"
          onClick={onClickReloadExample}
          aria-label={reloadExampleLabel}
        />
      </EuiToolTip>
    </EuiFlexGroup>
  );
};

```

### Core Architecture Module: `packages/docusaurus-theme/src/components/demo/actions_bar/index.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export { DemoActionsBar, type DemoActionsBarProps } from './actions_bar';

```

### Core Architecture Module: `packages/docusaurus-theme/src/components/demo/code_transformer.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

const IMPORT_REGEX = /^import [^'"]* from ['"]([^'"\n ]*)['"];?/gm;
const DEFAULT_EXPORT_REGEX = /export default /;
const COMPONENT_ONLY_REGEX = /^\(?</;

/**
 * Transforms input JS/TS source code to a react-live compatible syntax.
 * react-live uses the surcase library to transform input source code into
 * browser-readable JavaScript.
 *
 * While surcase does support CommonJS and ESM import/export statements,
 * it's not trivial to expose our internal React and EUI exports through it
 * and because we already control the execution scope of the interactive demos
 * it isn't really necessary to implement a smart `require()` replacement.
 *
 * Returning an IIFE is necessary when the source code is more than just
 * a JSX component definition (e.g. it contains a variable definition
 * or `export default` statement).
 *
 * @see https://github.com/alangpierce/sucrase
 * @see https://github.com/FormidableLabs/react-live/blob/master/packages/react-live/src/utils/transpile/index.ts
 */
export const demoCodeTransformer = (code: string) => {
  // Remove ESM imports
  code = code.replace(IMPORT_REGEX, '');

  // Handle ESM default exports
  code = code.replace(DEFAULT_EXPORT_REGEX, 'return ');

  // If the demo is JSX only return as-is
  if (COMPONENT_ONLY_REGEX.test(code)) {
    return code;
  }

  // If the demo is more than just JSX wrap in an immediately invoked function expression
  return `(() => { ${code} })()`;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10101** (2026-09-29): **Release: @elastic/eslint-plugin-eui v3.2.0, @elastic/eui v123.0.0, @elastic/eui-test-helpers v2.0.0**
  *Symptoms*: Packages to release:  - `@elastic/eslint-plugin-eui` - v3.1.0 → v3.2.0 - `@elastic/eui` - v122.1.0 → v123.0.0 - `@elastic/eui-test-helpers` - v1.8.0 → v2.0.0
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5729) * Commit: 22cdbe4766a2a1a403bb52382b88dc7cccbbbe79 * [Documentation website](https://eui.elastic.co/pr_10101/) * [Storybook](https://eui.elastic.co/pr_10101/storybook/) * :no_entry_sign: Visual regression tests skipped: Has 'skip-vrt' label   cc @tsullivan  <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5729","number":5729,"commit":"22cdbe4766a2a1a403bb52382b88dc7cccbbbe79"}],"number":5729} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8172) * Commit: 22cdbe4766a2a1a403bb52382b88dc7cccbbbe79  cc @tsullivan  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8172","number":8172,"commit":"22cdbe4766a2a1a403bb52382b88dc7cccbbbe79"}],"number":8172} buildkite-pr-comment-->

- **Issue #10095** (2026-09-29): **[Chore] Ping elastic/eui-icons team on issues labelled "icons"**
  *Symptoms*: Super simple - write "cc `@elastic/eui-icons`" which pings the team whenever an issue labelled "icons" is created in elastic/eui repo. Ran this by @MichaelMarcialis   Not testable.

- **Issue #10094** (2026-09-29): **[ESLint] Replace micromatch with picomatch**
  *Symptoms*: ## Summary - `@elastic/eslint-plugin-eui` only uses `micromatch.isMatch` in `no-restricted-eui-imports`. That function delegates straight to `picomatch`, so matching behavior is unchanged. - Swap the production dependency to `picomatch@2.3.1`, which has no dependencies. This drops `braces` from the published plugin. `braces@3.0.3` has no fixed release (CVE-2026-93687).  ## Test plan - [x] `yarn workspace @elastic/eslint-plugin-eui test-unit` (790 tests, including `no_restricted_eui_imports`) - [x] `tsc --noEmit` in `packages/eslint-plugin` - [ ] Confirm the ESLint plugin release no longer lists `micromatch` or `braces` in its production dependency tree   Made with [Cursor](https://cursor.com)
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8165) * Commit: 25884af16c2dc699edceb788e8eebad286aeee8b  ### History * :green_heart: [Build #8163](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8163) succeeded 54444351057cc2ceb65aaed4c5dea9e6dd39c559  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8165","number":8165,"commit":"25884af16c2dc699edceb788e8eebad286aeee8b"},{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8163","number":8163,"commit":"54444351057cc2ceb65aaed4c5dea9e6dd39c559"}],"number":8165} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5719) * Commit: 25884af16c2dc699edceb788e8eebad286aeee8b * [Documentation website](https://eui.elastic.co/pr_10094/) * [Storybook](https://eui.elastic.co/pr_10094/storybook/) * :white_check_mark: Visual regression tests passed   ### History * :broken_heart: [Build #5716](https://buildkite.com/elastic/eui-deploy-docs/builds/5716) failed 54444351057cc2ceb65aaed4c5dea9e6dd39c559  <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5719","number":5719,"commit":"25884af16c2dc699edceb788e8eebad286aeee8b"},{"buildStatus":{"state":"failed","success":false,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5716","number":5716,"commit":"54444351057cc2ceb65aaed4c5dea9e6dd39c5

- **Issue #10089** (2026-09-27): **[Icon] AlertZero**
  *Symptoms*: **Metaphor**  A distinctive product icon for AlertZero — Elastic Security's **agentic SOC** experience — that conveys the concept of reaching zero alerts (inbox-zero for security operations). The icon represents an AI-driven analyst that actively works the queue, not just a passive alert list.  **Do alternative icon or workarounds exist?**  Currently no dedicated icon exists. Workarounds include generic security icons (e.g., `securitySignal`, `alert`, `bellSlash`) or custom SVGs embedded in the product.  **Use Case**  AlertZero is Elastic Security's agentic SOC surface — an AI-powered experience that helps analysts triage, respond to, and investigate alerts autonomously. The icon is needed for: - The side navigation of Elastic Security (nav item) - Product headers and empty states - Cross-linking from other Elastic Security surfaces  [Figma design file →](https://www.figma.com/design/TcWNK0j1OaPGaUw2GULGox/AlertZero-Icon?node-id=1-649&t=ie2UG5u07xowS1BX-1)  **Value / Impact**  AlertZero is a flagship agentic SOC feature and needs a distinct, recognisable identity in the nav. A dedicated EUI icon ensures it's represented consistently across all Elastic surfaces and theming contexts (light/dark, high-contrast). Without it, teams resort to one-off SVG embeds that don't respond to EUI theming or scale correctly.  **Urgency**  This is a dependency for the AlertZero launch. Please cc the relevant stakeholders once prioritised.  **Related code or customizations**  The icon will be u

- **Issue #10086** (2026-09-25): **[EuiTextTruncate] Add toolTipProps to customize the full text tooltip**
  *Symptoms*: Needed for elastic/kibana#293498 Related: elastic/kibana#291807  ## Summary  `EuiTextTruncate` shows the full text in an `EuiToolTip` while it truncates, but consumers can't configure that tooltip. In the Kibana sidenav popover the labels are middle-truncated, and the tooltip always opens on top, covering the rows above. We want it to open to the right, next to the popover.  This adds `toolTipProps`, passed through to that tooltip. It only picks the placement props (`position`, `offset`, `repositionOnScroll`). Other components like `EuiComboBox` pass through almost all `EuiToolTipProps`, but here overriding `display` would break the width measurement and `disableScreenReaderOutput` would make screen readers read the full text twice. Starting narrow also keeps it easy to add more props later without a breaking change.  I also updated the text truncation docs: they still said the full text shows in a native `title` tooltip, which hasn't been true since #9643.  ### API Changes  | component / parent | prop / child | change | description | | ------------------ | ------------ | ------ | ----------- | | EuiTextTruncate    | toolTipProps | Added  | Placement (`position`, `offset`, `repositionOnScroll`) of the tooltip that shows the full text while truncating |  ## Impact Assessment  - [ ] 🔴 **Breaking changes** - [ ] 💅 **Visual changes** - [ ] 🧪 **Test impact** - [ ] 🔧 **Hard to integrate**  Additive and opt-in. Nothing changes unless `toolTipProps` is passed.  **Impact level:** 
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5698) * Commit: 65f0dbec86d7d70d9853451a7abbe7be6f275a56 * [Documentation website](https://eui.elastic.co/pr_10086/) * [Storybook](https://eui.elastic.co/pr_10086/storybook/) * :white_check_mark: Visual regression tests passed   <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5698","number":5698,"commit":"65f0dbec86d7d70d9853451a7abbe7be6f275a56"}],"number":5698} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8146) * Commit: 65f0dbec86d7d70d9853451a7abbe7be6f275a56  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8146","number":8146,"commit":"65f0dbec86d7d70d9853451a7abbe7be6f275a56"}],"number":8146} buildkite-pr-comment-->

- **Issue #10084** (2026-09-28): **Fix tooltip flicker issue in EuiDataGrid cell tooltips**
  *Symptoms*: Closes https://github.com/elastic/eui/issues/10083  ## Summary  - **What:** Prevents `react-window` from disabling pointer events while scrolling `EuiDataGrid`. - **Why:** Fixes #10083. In Firefox at fractional scaling (like 125%), scrolling to the very bottom can trigger rounding issues (`scrollTop` > `scrollHeight - clientHeight`). This triggers unnecessary scroll events in `react-window`, which briefly disables pointer events, causing cell tooltips to repeatedly open and close (flicker) as the pointer is lost and regained. - **How:** By setting `pointerEvents: undefined` on the inner element's styles, we override `react-window`'s default behavior of setting `pointer-events: none` during scroll.  ### API Changes  N/A  ## Screenshots  This uses the temporary storybook and caveats for launching Firefox described here: https://github.com/elastic/eui/issues/10083#issuecomment-5819554759  **Before**  https://github.com/user-attachments/assets/35294c04-6fb3-41d2-bf90-ef53c42c675e  **After**  https://github.com/user-attachments/assets/5549251b-4096-4a69-becc-674258a56c5f  ## Impact Assessment  Note: Most PRs should be [tested in Kibana](https://github.com/elastic/eui/blob/main/wiki/contributing-to-eui/testing/testing-in-kibana.md) to help gauge their **Impact** before merging.  - [ ] 🔴 **Breaking changes** — What will break? How many usages in Kibana/Cloud UI are impacted? - [x] 💅 **Visual changes** — May impact style overrides; could require visual 
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8161) * Commit: f88d175b353221dde3b94ca05cbbbb8eb7ffedde  ### History * :broken_heart: [Build #8148](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8148) failed 45b17073431bd1f72d0243bf0138879187ce3d7d * :green_heart: [Build #8139](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8139) succeeded 010f1ade8b1ed26c41c3673df4d8b35392be4f44  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8161","number":8161,"commit":"f88d175b353221dde3b94ca05cbbbb8eb7ffedde"},{"buildStatus":{"state":"failed","success":false,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/buil
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5714) * Commit: f88d175b353221dde3b94ca05cbbbb8eb7ffedde * [Documentation website](https://eui.elastic.co/pr_10084/) * [Storybook](https://eui.elastic.co/pr_10084/storybook/) * :white_check_mark: Visual regression tests passed   ### History * :green_heart: [Build #5701](https://buildkite.com/elastic/eui-deploy-docs/builds/5701) succeeded 45b17073431bd1f72d0243bf0138879187ce3d7d * :green_heart: [Build #5689](https://buildkite.com/elastic/eui-deploy-docs/builds/5689) succeeded 010f1ade8b1ed26c41c3673df4d8b35392be4f44  <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5714","number":5714,"commit":"f88d175b353221dde3b94ca05cbbbb8eb7ffedde"},{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRet

- **Issue #10083** (2026-09-28): **[EuiToolTip]  Tooltip flickers in EuiDataGrid on Firefox when scrolled to the bottom**
  *Symptoms*: **Summary** https://github.com/elastic/sdh-kibana/issues/6540  In Firefox, the tooltip on a cell in EuiDataGrid keeps opening and closing when you hover it. It only happens when the grid is scrolled to the very bottom. If you scroll up a little, it stops.  We found it in the Kibana Discover document flyout (hovering a field name).  **How to reproduce**  Use Firefox with Windows display **scaling at 125%.** Scroll a data grid to the very bottom. Hover a cell that has a tooltip. It depends on the window size. If you don't see it, resize the window a little.  **Why it seems to happen**  Opening the tooltip seems to make Firefox think the grid was scrolled, even though nothing moved. When the grid is at the very bottom, it reacts to that "scroll" by briefly ignoring the mouse, so the tooltip closes. Closing it triggers the same thing again, and the tooltip keeps opening and closing.  Example in Discover  https://github.com/user-attachments/assets/e74f3b18-1cf1-45b4-b1b9-dff5a498ae9e
  **Post-Mortem & Fix Analysis**:
  > NOTE: I assume this is for EUI v122.0.0. The latest version as of this writing is 122.1.0 
  > 🤖  > The flicker is a feedback loop between react-window's scroll handling within EuiDataGrid and Firefox's rounding of scroll positions to device pixels at 125% display scaling. EuiToolTip triggers the issue but is not the root cause. It was reproduced in Firefox 156 on macOS by setting `layout.css.devPixelsPerPx` to 1.25, which gives the same `devicePixelRatio` as Windows at 125%. > > **Mechanism** > > During scrolling, react-window disables pointer events on its inner container by setting `pointer-events: none`. It clears this state 150ms after the final `scroll` event (`IS_SCROLLING_DEBOUNCE_INTERVAL = 150` and `pointerEvents: isScrolling ? 'none' : undefined` in `react-window/dist/index.cjs.js`). > > react-window's scroll handler ignores a `scroll` event if the element's `scrollTop` matches the `scrollTop` stored in state. However, the state value is clamped to the maximum scroll position (`Math.min(scrollTop, scrollHeight - clientHeight)`), while the comparison uses the element'
  > This can be reproduced in Storybook with Firefox at a device pixel ratio of 1.25. On macOS retina screens the browser zoom controls can't get there: the ratio is always 2 × the zoom level, and Firefox's zoom steps never land on 1.25. The workaround is a temporary Firefox profile with a custom preference. **1. Add a repro story**  Save this as `packages/eui/src/components/datagrid/data_grid_tooltip_flicker_repro.stories.tsx`:  ```tsx import React, { useState } from 'react'; import type { Meta, StoryObj } from '@storybook/react-vite';  import { EuiToolTip } from '../tool_tip'; import { EuiDataGrid } from './data_grid'; import type { EuiDataGridProps } from './data_grid_types';  type ReproArgs = { height: number };  const meta: Meta<ReproArgs> = {   title: 'Tabular Content/EuiDataGrid/Tooltip flicker repro (temporary)',   parameters: {     vrt: { skip: true },     codeSnippet: { skip: true },   },   argTypes: {     height: { control: { type: 'number', step: 1 } },   },   args: { height: 4

- **Issue #10082** (2026-09-24): **[Chore] Add missing release prep commits for #10060**
  *Symptoms*: - **What:** Adds missing commit entry in `kibana-prep-commits`. - **Why:** Follow-up to https://github.com/elastic/eui/pull/10060. - **How:** Adds missing prepared changes to the release automation file. The changes have been run in CI (🟢  [build](https://buildkite.com/elastic/kibana-pull-request/builds/509713))
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8136) * Commit: 8d8993f843504e97d3897a43efca502dca12453b  cc @mgadewoll  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8136","number":8136,"commit":"8d8993f843504e97d3897a43efca502dca12453b"}],"number":8136} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5683) * Commit: 8d8993f843504e97d3897a43efca502dca12453b * [Documentation website](https://eui.elastic.co/pr_10082/) * [Storybook](https://eui.elastic.co/pr_10082/storybook/) * :no_entry_sign: Visual regression tests skipped: No VRT-relevant paths changed   cc @mgadewoll  <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5683","number":5683,"commit":"8d8993f843504e97d3897a43efca502dca12453b"}],"number":5683} buildkite-pr-comment-->

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

### Incident Patch 1: `92aff27e` (2026-09-28)
**Commit Message**: Fix tooltip flicker issue in EuiDataGrid cell tooltips (#10084)

**File**: `packages/eui/changelogs/upcoming/10084.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+**Bug fixes**
+
+- Fixed an issue where `EuiDataGrid` cell tooltips repeatedly opened and closed in Firefox when the grid was scrolled to the very bottom at fractional display scaling (e.g., 125%).
```

**File**: `packages/eui/src/components/datagrid/body/data_grid_body_virtualized.test.tsx` (modified, +154/-2)
```diff
@@ -6,12 +6,13 @@
  * Side Public License, v 1.
  */
 
-import React from 'react';
-import { fireEvent } from '@testing-library/react';
+import React, { forwardRef } from 'react';
+import { act, fireEvent, waitFor } from '@testing-library/react';
 import { render } from '../../../test/rtl';
 
 import { dataGridBodyProps } from './data_grid_body.test';
 
+import { EuiDataGridBodyProps } from '../data_grid_types';
 import { EuiDataGridBodyVirtualized } from './data_grid_body_virtualized';
 
 describe('EuiDataGridBodyVirtualized', () => {
@@ -81,6 +82,22 @@ describe('EuiDataGridBodyVirtualized', () => {
   });
 
   describe('scrolling', () => {
+    const originalDescriptors = (
+      ['scrollTop', 'scrollHeight', 'clientHeight'] as const
+    ).map(
+      (name) =>
+        [
+          name,
+          Object.getOwnPropertyDescriptor(Element.prototype, name)!,
+        ] as const
+    );
+
+    afterEach(() => {
+      originalDescriptors.forEach(([name, descriptor]) =>
+        Object.defineProperty(Element.prototype, name, descriptor)
+      );
+    });
+
     it('passes correct scroll position data to virtualizationOptions.onScroll', () => {
       Object.defineProperty(Element.prototype, 'scrollHeight', {
         configurable: true,
@@ -127,6 +144,141 @@ describe('EuiDataGridBodyVirtualized', () => {
         isScrolledToInlineEnd: false,
       });
     });
+
+    describe('pointer events', () => {
+      beforeEach(() => {
+        Object.defineProperty(Element.prototype, 'scrollHeight', {
+          configurable: true,
+          value: 200,
+        });
+        Object.defineProperty(Element.prototype, 'clientHeight', {
+          configurable: true,
+          value: 100,
+        });
+      });
+
+      const setScrollTop = (value: number) =>
+        Object.defineProperty(Element.prototype, 'scrollTop', {
+          configurable: true,
+          value,
+        });
+
+      const renderGrid = (
+        virtualizationOptions?: EuiDataGridBodyProps['virtualizationOptions'],
+        gridRef: EuiDataGridBodyProps['gridRef'] = dataGridBodyProps.gridRef
+      ) => {
+        const { container } = render(
+          <EuiDataGridBodyVirtualized
+            {...dataGridBodyProps}
+            gridRef={gridRef}
+            virtualizationOptions={virtualizationOptions}
+          />
+        );
+        const outer = container.querySelector<HTMLElement>(
+          '.euiDataGrid__virtualized'
+        )!;
+        return { outer, inner: outer.firstElementChild as HTMLElement };
+      };
+
+      it('disables pointer events on the inner element while scrolling', () => {
+        const { outer, inner } = renderGrid();
+
+        setScrollTop(50);
+        fireEvent.scroll(outer);
+
+        expect(inner.style.pointerEvents).toBe('none');
+      });
+
+      it('does not disable pointer events for a scroll event that does not move the grid, with `scrollTop` rounded above the maximum', async () => {
+        const { outer, inner } = renderGrid();
+
+        // Firefox at a devicePixelRatio of 1.25 can report a `scrollTop` above
+        // `scrollHeight - clientHeight` (100) when scrolled to the very bottom. This test
+        // ensures that pointer events are not disabled in the case of this false positive.
+        setScrollTop(100.4);
+        fireEvent.scroll(outer);
+        await waitFor(() => expect(inner.style.pointerEvents).not.toBe('none'));
+
+        act(() => {
+          fireEvent.scroll(outer);
+        });
+
+        expect(inner.style.pointerEvents).not.toBe('none');
+      });
+
+      it('passes on a scroll back to the previous position that arrives before the grid re-renders', () => {
+        const onScroll = jest.fn();
+        const { outer } = renderGrid({ onScroll });
+
+        // Both events are handled before React re-renders the grid
+        act(() => {
+          setScrollTop(50);
+          fireEvent.scroll(outer);
+          setScrollTop(0);
+          fireEvent.scroll(outer);
+        })
```

**File**: `packages/eui/src/components/datagrid/body/data_grid_body_virtualized.tsx` (modified, +154/-28)
```diff
@@ -16,7 +16,10 @@ import React, {
   useEffect,
   useRef,
   useMemo,
+  MutableRefObject,
   PropsWithChildren,
+  UIEvent,
+  UIEventHandler,
   memo,
 } from 'react';
 import {
@@ -113,6 +116,84 @@ const InnerElement: VariableSizeGridProps['innerElementType'] = memo(
 );
 InnerElement.displayName = 'EuiDataGridInnerElement';
 
+type ScrollPosition = Pick<GridOnScrollProps, 'scrollTop' | 'scrollLeft'>;
+
+type DataGridOuterElementContextShape = {
+  outerElementType?: VariableSizeGridProps['outerElementType'];
+  direction?: VariableSizeGridProps['direction'];
+  scrollPositionRef: MutableRefObject<ScrollPosition | null>;
+};
+
+const DataGridOuterElementContext =
+  createContext<DataGridOuterElementContextShape>({
+    scrollPositionRef: { current: null },
+  });
+
+type OuterElementProps = PropsWithChildren & {
+  onScroll: UIEventHandler<HTMLDivElement>;
+};
+
+const clampScrollOffset = (offset: number, max: number) =>
+  Math.max(0, Math.min(offset, max));
+
+const OuterElement = forwardRef<HTMLDivElement, OuterElementProps>(
+  ({ onScroll, ...rest }, ref) => {
+    const {
+      outerElementType: Element = 'div',
+      direction,
+      scrollPositionRef,
+    } = useContext(DataGridOuterElementContext);
+
+    // react-window compares the raw scroll offsets against its own clamped
+    // offsets, and flags the grid as scrolling (setting `pointer-events: none`
+    // on the inner element) whenever they differ. Firefox can report a
+    // `scrollTop` above the maximum at fractional device pixel ratios, which
+    // makes every scroll event at the bottom of the grid look like a scroll,
+    // so hovered cells lose the pointer and tooltips repeatedly open and close.
+    const onScrollIfMoved = useCallback(
+      (event: UIEvent<HTMLDivElement>) => {
+        if (direction !== 'rtl') {
+          const {
+            scrollTop,
+            scrollLeft,
+            scrollHeight,
+            scrollWidth,
+            clientHeight,
+            clientWidth,
+          } = event.currentTarget;
+          const scrollPosition = {
+            scrollTop: clampScrollOffset(
+              scrollTop,
+              scrollHeight - clientHeight
+            ),
+            scrollLeft: clampScrollOffset(
+              scrollLeft,
+              scrollWidth - clientWidth
+            ),
+          };
+          const previousScrollPosition = scrollPositionRef.current;
+          if (
+            previousScrollPosition &&
+            scrollPosition.scrollTop === previousScrollPosition.scrollTop &&
+            scrollPosition.scrollLeft === previousScrollPosition.scrollLeft
+          ) {
+            return;
+          }
+          // react-window may not have rendered the previous event's position
+          // yet, so the ref must reflect every forwarded event, not only the
+          // positions react-window reports back through its `onScroll` prop.
+          scrollPositionRef.current = scrollPosition;
+        }
+        onScroll(event);
+      },
+      [onScroll, direction, scrollPositionRef]
+    );
+
+    return <Element ref={ref} onScroll={onScrollIfMoved} {...rest} />;
+  }
+);
+OuterElement.displayName = 'EuiDataGridOuterElement';
+
 export const EuiDataGridBodyVirtualized: FunctionComponent<EuiDataGridBodyProps> =
   memo(
     ({
@@ -377,8 +458,48 @@ export const EuiDataGridBodyVirtualized: FunctionComponent<EuiDataGridBodyProps>
           footerRow,
         };
       }, [headerRowHeight, headerRow, footerRow, showHeader]);
+
+      const scrollPositionRef = useRef<ScrollPosition | null>(null);
+      const outerElementContextValue = useMemo(() => {
+        return {
+          outerElementType: virtualizationOptions?.outerElementType,
+          direction: virtualizationOptions?.direction,
+          scrollPositionRef,
+        };
+      }, [
+        virtualizationOptions?.outerElementType,
+        virtualizationOptions?.direction,
+      ]);
+
       const onScroll = useCallback(
         (args: Gr
```

**File**: `packages/eui/src/components/datagrid/utils/row_heights.ts` (modified, +2/-1)
```diff
@@ -351,7 +351,8 @@ export const useRowHeightUtils = ({
       return;
     }
 
-    requestAnimationFrame(forceRenderRef.current);
+    const frameId = requestAnimationFrame(forceRenderRef.current);
+    return () => cancelAnimationFrame(frameId);
   }, [
     // Effects that should cause rerendering
     rowHeightsOptions?.defaultHeight,
```

---

### Incident Patch 2: `ea1b0098` (2026-09-21)
**Commit Message**: [Chore] Update/Fix release prep commits (#10073)

**File**: `packages/release-cli/kibana-prep-commits` (modified, +1/-6)
```diff
@@ -11,9 +11,4 @@ https://github.com/elastic/kibana/pull/291881/changes/2ce22ac9d123fa758ac99f9a67
 # @previous
 https://github.com/elastic/kibana/pull/291720/changes/cb858a767b4c123c22be4733c103859d7205d119
 https://github.com/elastic/kibana/pull/244898/commits/564140f3f1eea91dc2646ea89a6848130904a6e5
-https://github.com/elastic/kibana/pull/288032/commits/8ce9406a13f21821ae7c74ab48bc798299a242a4
-https://github.com/elastic/kibana/pull/288032/commits/5a4fbee09edf651ff604ed961198a1addeb302a2
-https://github.com/elastic/kibana/pull/288032/commits/49203e24d63cc70fcb20a75b5d931809ca2eb3bf
-https://github.com/elastic/kibana/pull/288032/commits/6c2fa47f2583dd401ee5e5710a5e1879256db591
-https://github.com/elastic/kibana/pull/288032/commits/8f1d3133f046f3465bcd9d1677cc5115497c6c64
-https://github.com/elastic/kibana/pull/288032/commits/470a660af6133a5db1d9b0e8dfe119d00af8e418
+https://github.com/elastic/kibana/pull/288032/commits/72e47bcf31009b632e416d9d7e92680a1380b8cc
```

---

### Incident Patch 3: `208c9412` (2026-09-21)
**Commit Message**: [Chore] Fix VRT timeout (#10018)

Co-authored-by: kibanamachine <infra-root+kibanamachine@elastic.co>

**File**: `packages/eui/.storybook/test-runner.ts` (modified, +37/-24)
```diff
@@ -11,7 +11,7 @@ import path from 'path';
 import { fileURLToPath } from 'url';
 import type { Page } from 'playwright';
 import type { TestRunnerConfig } from '@storybook/test-runner';
-import { getStoryContext, waitForPageReady } from '@storybook/test-runner';
+import { getStoryContext } from '@storybook/test-runner';
 import { toMatchImageSnapshot } from 'jest-image-snapshot';
 
 import {
@@ -28,7 +28,10 @@ import {
  * `{ animations: 'disabled' }` pauses CSS animations before taking a screenshot,
  * preventing stability timeouts on infinite looping animations (spinners etc.).
  */
-const SCREENSHOT_OPTIONS = { animations: 'disabled' } as const;
+const SCREENSHOT_OPTIONS = {
+  animations: 'disabled',
+  timeout: 2_000,
+} as const;
 
 /**
  * Allow a few pixels of subpixel noise.
@@ -46,32 +49,28 @@ const activeVariantName: VariantName = isVariantName(process.env.VRT_VARIANT)
   : 'desktop';
 const activeVariant = VARIANTS[activeVariantName];
 
+const WAIT_OPTIONS = { timeout: 20_000, polling: 100 } as const;
+
 /**
  * Ensures all `<img>` elements are fully loaded before taking a screenshot.
  */
 const waitForImagesToLoad = async (page: Page) => {
-  await page.evaluate(() =>
-    Promise.all(
-      Array.from(document.images)
-        .filter((img) => !img.complete)
-        .map(
-          (img) =>
-            new Promise((resolve) => {
-              img.addEventListener('load', resolve);
-              img.addEventListener('error', resolve);
-            })
-        )
-    )
+  await page.waitForFunction(
+    () => Array.from(document.images).every((img) => img.complete),
+    undefined,
+    WAIT_OPTIONS
   );
 };
 
 /**
  * Ensure all fonts are loaded before taking a screenshot.
  */
 const waitForFonts = async (page: Page) => {
-  await page.evaluate(async () => {
-    await document.fonts.ready;
-  });
+  await page.waitForFunction(
+    () => document.fonts.status === 'loaded',
+    undefined,
+    WAIT_OPTIONS
+  );
 };
 
 /**
@@ -80,19 +79,25 @@ const waitForFonts = async (page: Page) => {
  */
 const waitForEuiIcons = async (page: Page) => {
   await page.waitForFunction(
-    () => !document.querySelector('[data-is-loading]')
+    () => !document.querySelector('[data-is-loading]'),
+    undefined,
+    WAIT_OPTIONS
   );
 };
 
 /**
  * Ensure the page layout has stabilized before taking a screenshot.
  */
 const waitForLayout = async (page: Page) => {
-  await page.evaluate(
-    () =>
-      new Promise<void>((resolve) =>
-        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
-      )
+  await page.evaluate(() =>
+    Promise.race([
+      new Promise((resolve) => {
+        requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
+      }),
+      new Promise((resolve) => {
+        setTimeout(() => resolve(true), 1000);
+      }),
+    ])
   );
 };
 
@@ -135,9 +140,17 @@ const config: TestRunnerConfig = {
     const selector =
       storyContext.parameters?.vrt?.selector ?? VRT_SELECTORS.default;
 
-    await waitForPageReady(page);
+    // Do not call Storybook's `waitForPageReady`: it ends with
+    // `page.evaluate(() => document.fonts.ready)` which has no Playwright
+    // timeout if that promise never settles and hangs the worker until the
+    // job is killed. Load/idle are already done by the time `postVisit` runs.
     await waitForImagesToLoad(page);
     await waitForFonts(page);
+
+    await page.evaluate(() => {
+      window.dispatchEvent(new Event('resize'));
+    });
+
     await waitForLayout(page);
     await waitForEuiIcons(page);
 
```

**File**: `packages/eui/.storybook/test.ts` (modified, +0/-4)
```diff
@@ -42,10 +42,6 @@ const customWithin = (canvasElement: HTMLElement) => {
         expect(canvasElement.querySelector('[data-popover-open]')).toBeVisible()
       );
 
-      const { defaultView, fonts } = canvasElement.ownerDocument;
-      await fonts.ready;
-      defaultView?.dispatchEvent(new defaultView.Event('resize'));
-
       if (anchorSelector) {
         await waitFor(() =>
           expect(canvasElement.querySelector(anchorSelector)).toBeTruthy()
```

**File**: `packages/eui/scripts/test-visual-regression.js` (modified, +2/-3)
```diff
@@ -245,9 +245,9 @@ if (useDocker) {
       `if ! (echo > /dev/tcp/127.0.0.1/${STATIC_PORT}) 2>/dev/null; then echo "Timed out waiting for static Storybook on port ${STATIC_PORT}"; kill "$server_pid"; exit 1; fi; `
     : '';
 
-  // `--maxWorkers`/`--testTimeout` add headroom for the slower emulated env.
+  // `--maxWorkers` adds headroom for the slower emulated env.
   const failed = runVariants((variant) => {
-    const innerCmd = `set -e; ${setup}; ${staticServe}VRT_VARIANT=${variant} yarn test-storybook --maxWorkers=2 --testTimeout=60000${argsSuffix}`;
+    const innerCmd = `set -e; ${setup}; ${staticServe}VRT_VARIANT=${variant} yarn test-storybook --maxWorkers=2${argsSuffix}`;
     runInDocker(innerCmd);
   });
 
@@ -291,7 +291,6 @@ const runNativeTests = async () => {
   const baseCmd = [
     'yarn test-storybook',
     !isCI && '--maxWorkers=2',
-    !isCI && '--testTimeout=60000',
     isUpdate && '--updateSnapshot',
     !useStatic && argv.url && `--url ${argv.url}`,
     ...extraArgs,
```

**File**: `packages/eui/src/components/date_picker/super_date_picker/super_date_picker.stories.tsx` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ export const CustomQuickSelectPanel: Story = {
   play: async ({ canvasElement, step }) => {
     const canvas = within(canvasElement);
     await step('show popover on click of the quick select button', async () => {
-      canvas.waitForAndClick('superDatePickerToggleQuickMenuButton');
+      await canvas.waitForAndClick('superDatePickerToggleQuickMenuButton');
       await canvas.waitForEuiPopoverVisible();
       expect(canvas.getByText('Custom quick select panel')).toBeVisible();
     });
```

**File**: `packages/eui/src/components/selectable/selectable.stories.tsx` (modified, +3/-3)
```diff
@@ -8,7 +8,7 @@
 
 import React, { useState } from 'react';
 import type { Meta, StoryObj } from '@storybook/react-vite';
-import { userEvent, waitFor, within, expect } from 'storybook/test';
+import { userEvent, within } from 'storybook/test';
 
 import {
   enableFunctionToggleControls,
@@ -157,9 +157,9 @@ export const WithTooltip: Story = {
     const options = body.getAllByRole('option');
     const tooltipTarget = (options[0].firstElementChild ??
       options[0]) as HTMLElement;
-    await userEvent.hover(tooltipTarget);
 
-    await waitFor(() => expect(body.getByRole('tooltip')).toBeVisible());
+    await userEvent.hover(tooltipTarget, { pointerEventsCheck: 0 });
+    await body.findByRole('tooltip');
   }),
 };
 
```

---

### Incident Patch 4: `4c3f02ad` (2026-09-21)
**Commit Message**: Fix description list compressed text style (#10036)

Co-authored-by: kibanamachine <infra-root+kibanamachine@elastic.co>
Co-authored-by: Arturo Castillo Delgado <arturo.castillo@elastic.co>
Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

**File**: `packages/eui/changelogs/upcoming/10036.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+**Bug fixes**
+
+Fixed `EuiDescriptionListTitle` and `EuiDescriptionListDescription`  compressed font size.
+
```

**File**: `packages/eui/src/components/datagrid/controls/__snapshots__/keyboard_shortcuts.test.tsx.snap` (modified, +26/-26)
```diff
@@ -90,7 +90,7 @@ exports[`useDataGridKeyboardShortcuts [React 17] returns a popover containing a
                 </kbd>
               </dt>
               <dd
-                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-normal-left"
+                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressedNormal-left"
               >
                 Move one cell up
               </dd>
@@ -102,7 +102,7 @@ exports[`useDataGridKeyboardShortcuts [React 17] returns a popover containing a
                 </kbd>
               </dt>
               <dd
-                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-normal-left"
+                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressedNormal-left"
               >
                 Move one cell down
               </dd>
@@ -114,7 +114,7 @@ exports[`useDataGridKeyboardShortcuts [React 17] returns a popover containing a
                 </kbd>
               </dt>
               <dd
-                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-normal-left"
+                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressedNormal-left"
               >
                 Move one cell right
               </dd>
@@ -126,7 +126,7 @@ exports[`useDataGridKeyboardShortcuts [React 17] returns a popover containing a
                 </kbd>
               </dt>
               <dd
-                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-normal-left"
+                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressedNormal-left"
               >
                 Move one cell left
               </dd>
@@ -138,7 +138,7 @@ exports[`useDataGridKeyboardShortcuts [React 17] returns a popover containing a
                 </kbd>
               </dt>
               <dd
-                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-normal-left"
+                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressedNormal-left"
               >
                 Move to the first cell of the current row
               </dd>
@@ -150,7 +150,7 @@ exports[`useDataGridKeyboardShortcuts [React 17] returns a popover containing a
                 </kbd>
               </dt>
               <dd
-                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-normal-left"
+                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressedNormal-left"
               >
                 Move to the last cell of the current row
               </dd>
@@ -166,7 +166,7 @@ exports[`useDataGridKeyboardShortcuts [React 17] returns a popover containing a
                 </kbd>
               </dt>
               <dd
-                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-normal-left"
+                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressedNormal-left"
               >
                 Move to the first cell of the current page
               </dd>
@@ -182,7 +182,7 @@ exports[`useDataGridKeyboardShortcuts [React 17] returns a popover containing a
                 </kbd>
               </dt>
               <dd
-                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-normal-left"
+                class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressedNormal-left"
               >
                 Move to the last cell of the current page
               </dd>
@@ -194,7 +194,7 @@ exports[`useDataGridKeyboardShortcuts [React 17] re
```

**File**: `packages/eui/src/components/description_list/__snapshots__/description_list_description.test.tsx.snap` (modified, +25/-1)
```diff
@@ -6,9 +6,33 @@ exports[`EuiDescriptionListDescription EuiDescriptionListDescription prop variat
 />
 `;
 
+exports[`EuiDescriptionListDescription EuiDescriptionListDescription prop variations compressed combined with text styles column + normal text style uses the compressed font size 1`] = `
+<dd
+  class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressedNormal"
+/>
+`;
+
+exports[`EuiDescriptionListDescription EuiDescriptionListDescription prop variations compressed combined with text styles column + reverse text style uses the compressed font size 1`] = `
+<dd
+  class="euiDescriptionList__description emotion-euiDescriptionList__description-column-compressed"
+/>
+`;
+
+exports[`EuiDescriptionListDescription EuiDescriptionListDescription prop variations compressed combined with text styles row + normal text style uses the compressed font size 1`] = `
+<dd
+  class="euiDescriptionList__description emotion-euiDescriptionList__description-row-compressedNormal"
+/>
+`;
+
+exports[`EuiDescriptionListDescription EuiDescriptionListDescription prop variations compressed combined with text styles row + reverse text style uses the compressed font size 1`] = `
+<dd
+  class="euiDescriptionList__description emotion-euiDescriptionList__description-row-compressed"
+/>
+`;
+
 exports[`EuiDescriptionListDescription EuiDescriptionListDescription prop variations compressed is rendered 1`] = `
 <dd
-  class="euiDescriptionList__description emotion-euiDescriptionList__description-row-normal"
+  class="euiDescriptionList__description emotion-euiDescriptionList__description-row-compressedNormal"
 />
 `;
 
```

**File**: `packages/eui/src/components/description_list/__snapshots__/description_list_title.test.tsx.snap` (modified, +12/-0)
```diff
@@ -6,6 +6,18 @@ exports[`EuiDescriptionListTitle EuiDescriptionListTitle prop variations align c
 />
 `;
 
+exports[`EuiDescriptionListTitle EuiDescriptionListTitle prop variations compressed combined with reverse text style column uses the compressed font size without inline pill padding 1`] = `
+<dt
+  class="euiDescriptionList__title emotion-euiDescriptionList__title-column-compressedReverse"
+/>
+`;
+
+exports[`EuiDescriptionListTitle EuiDescriptionListTitle prop variations compressed combined with reverse text style row uses the compressed font size without inline pill padding 1`] = `
+<dt
+  class="euiDescriptionList__title emotion-euiDescriptionList__title-row-compressedReverse-s"
+/>
+`;
+
 exports[`EuiDescriptionListTitle EuiDescriptionListTitle prop variations compressed is rendered 1`] = `
 <dt
   class="euiDescriptionList__title emotion-euiDescriptionList__title-row-compressed-s"
```

**File**: `packages/eui/src/components/description_list/description_list_description.styles.ts` (modified, +3/-0)
```diff
@@ -35,6 +35,9 @@ export const euiDescriptionListDescriptionStyles = (
       compressed: css`
         ${euiTitle(euiThemeContext, 'xxs')}
       `,
+      compressedNormal: css`
+        ${euiFontSize(euiThemeContext, 'xs')}
+      `,
     },
 
     // Nested inline styles for type and font
```

---

### Incident Patch 5: `d607b865` (2026-09-18)
**Commit Message**: [Chore] Add all tests in CI labels to Kibana regression PRs (#10045)

**File**: `.github/workflows/update_kibana_dependencies__open_pr.yml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ on:
       pr_labels:
         description: Comma-separated list of labels to add to the PR
         type: string
-        default: 'EUI,backport:skip,release_note:skip'
+        default: 'EUI,backport:skip,release_note:skip,ci:all-ui-test-suites,ci:prevent-selective-testing'
       source_pr_number:
         description: Source PR number that triggered this workflow
         type: number
```

---

### Incident Patch 6: `869d3b2c` (2026-09-17)
**Commit Message**: [EuiToolTip] Follow-up fix for the disabled selector (#10043)

**File**: `packages/eui/src/components/tool_tip/tool_tip.styles.ts` (modified, +3/-6)
```diff
@@ -9,11 +9,7 @@
 import { css, keyframes } from '@emotion/react';
 import { euiCanAnimate, euiShadow } from '@elastic/eui-theme-common';
 
-import {
-  euiDisabledSelector,
-  logicalCSS,
-  euiFontSize,
-} from '../../global_styling';
+import { logicalCSS, euiFontSize } from '../../global_styling';
 import { UseEuiTheme } from '../../services';
 import { _popoverArrowStyles } from '../../services/popover';
 import { euiPanelBorderStyles } from '../panel/panel.styles';
@@ -96,7 +92,8 @@ export const euiToolTipAnchorStyles = () => ({
        on disabled / aria-disabled elements means any mouse events remain handled by
        parent elements
        https://jakearchibald.com/2017/events-and-disabled-form-fields/ */
-    *:is(${euiDisabledSelector}) {
+    *[disabled],
+    *[aria-disabled='true'] {
       pointer-events: none;
     }
   `,
```

**File**: `packages/release-cli/kibana-prep-commits` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 # Nightly cherry-picks both sections, skipping commits that are missing or already applied.
 
 # @next
+https://github.com/elastic/kibana/pull/244898/commits/564140f3f1eea91dc2646ea89a6848130904a6e5
 
 # @previous
 https://github.com/elastic/kibana/pull/288940/commits/1fdf41c2776f0419124623ed1f6fa1e435c264b7
```

---

### Incident Patch 7: `7e7cb0b2` (2026-09-10)
**Commit Message**: [EuiSelectable][EuiComboBox] Fix duplicated screen reader announcements of option name and checked state (#9850)

Co-authored-by: Claude Fable 5 <noreply@anthropic.com>
Co-authored-by: Arturo Castillo Delgado <arturo@arturu.com>

**File**: `packages/eui/changelogs/upcoming/9850.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+**Accessibility**
+
+- Improved the accessibility of `EuiSelectable` by removing redundant "Checked option." screen-reader text (checked state is already conveyed via `aria-checked`/`aria-selected`)
+- Improved the accessibility of `EuiSelectable` and `EuiComboBox` by moving the `title` attribute to the inner text element, preventing duplicate screen-reader announcements of option names
```

**File**: `packages/eui/src/components/combo_box/__snapshots__/combo_box.test.tsx.snap` (modified, +9/-9)
```diff
@@ -180,13 +180,13 @@ exports[`EuiComboBox renders the options list dropdown 1`] = `
                     id="generated-id__option-0"
                     role="option"
                     style="position: absolute; left: 0px; top: 0px; height: 29px; width: 100%;"
-                    title="Titan"
                   >
                     <span
                       class="euiListItemLayout__content euiComboBoxOption__content emotion-euiListItemLayout__content"
                     >
                       <span
                         class="euiListItemLayout__text emotion-euiListItemLayout__text-truncate"
+                        title="Titan"
                       >
                         Titan
                       </span>
@@ -201,13 +201,13 @@ exports[`EuiComboBox renders the options list dropdown 1`] = `
                     id="generated-id__option-1"
                     role="option"
                     style="position: absolute; left: 0px; top: 29px; height: 29px; width: 100%;"
-                    title="Enceladus"
                   >
                     <span
                       class="euiListItemLayout__content euiComboBoxOption__content emotion-euiListItemLayout__content"
                     >
                       <span
                         class="euiListItemLayout__text emotion-euiListItemLayout__text-truncate"
+                        title="Enceladus"
                       >
                         Enceladus
                       </span>
@@ -222,13 +222,13 @@ exports[`EuiComboBox renders the options list dropdown 1`] = `
                     id="generated-id__option-2"
                     role="option"
                     style="position: absolute; left: 0px; top: 58px; height: 29px; width: 100%;"
-                    title="Mimas"
                   >
                     <span
                       class="euiListItemLayout__content euiComboBoxOption__content emotion-euiListItemLayout__content"
                     >
                       <span
                         class="euiListItemLayout__text emotion-euiListItemLayout__text-truncate"
+                        title="Mimas"
                       >
                         Mimas
                       </span>
@@ -243,13 +243,13 @@ exports[`EuiComboBox renders the options list dropdown 1`] = `
                     id="generated-id__option-3"
                     role="option"
                     style="position: absolute; left: 0px; top: 87px; height: 29px; width: 100%;"
-                    title="Dione"
                   >
                     <span
                       class="euiListItemLayout__content euiComboBoxOption__content emotion-euiListItemLayout__content"
                     >
                       <span
                         class="euiListItemLayout__text emotion-euiListItemLayout__text-truncate"
+                        title="Dione"
                       >
                         Dione
                       </span>
@@ -264,13 +264,13 @@ exports[`EuiComboBox renders the options list dropdown 1`] = `
                     id="generated-id__option-4"
                     role="option"
                     style="position: absolute; left: 0px; top: 116px; height: 29px; width: 100%;"
-                    title="Iapetus"
                   >
                     <span
                       class="euiListItemLayout__content euiComboBoxOption__content emotion-euiListItemLayout__content"
                     >
                       <span
                         class="euiListItemLayout__text emotion-euiListItemLayout__text-truncate"
+                        title="Iapetus"
                       >
                         Iapetus
                       </span>
@@ -285,13 +285,13 @@ exports[`EuiComboBox renders the options list dropdown 1`] = `
                     id="generated-id__option-5"
                     role="option"
                     style="position: absolute; left: 0px; top: 145px; height: 29px
```

**File**: `packages/eui/src/components/combo_box/combo_box_options_list/combo_box_options_list.tsx` (modified, +9/-1)
```diff
@@ -177,6 +177,7 @@ export class EuiComboBoxOptionsList<T> extends Component<
       truncationProps: _truncationProps,
       toolTipContent,
       toolTipProps,
+      title,
       ...rest
     } = option;
     const {
@@ -255,7 +256,6 @@ export class EuiComboBoxOptionsList<T> extends Component<
         // uses the original `options` array for the index to ensure a stable `id`, otherwise `aria-activedescendant`
         // loses focus on selecting an option (due to actively removing it from the list)
         id={rootId(`_option-${options.indexOf(option)}`)}
-        title={hasNativeTruncation && !toolTipContent ? label : undefined}
         key={option.key ?? option.label}
         prepend={option.prepend}
         append={
@@ -289,6 +289,14 @@ export class EuiComboBoxOptionsList<T> extends Component<
         contentProps={{
           className: 'euiComboBoxOption__content',
         }}
+        textProps={{
+          // `title` must not be set on the option element itself - it would
+          // become the option's accessible description, causing screen readers
+          // to announce the option name twice
+          title:
+            title ??
+            (hasNativeTruncation && !toolTipContent ? label : undefined),
+        }}
         onClick={() => {
           if (onOptionClick) {
             onOptionClick(option);
```

**File**: `packages/eui/src/components/filter_group/filter_group.a11y.tsx` (modified, +1/-1)
```diff
@@ -259,7 +259,7 @@ describe('EuiFilterGroup multiselect example', () => {
           .find('span.euiSelectableListItem__text')
           .should(
             'have.text',
-            'Dmitri Shostakovich. Checked option. To exclude this option, press Enter.'
+            'Dmitri Shostakovich. To exclude this option, press Enter.'
           );
       });
       cy.realPress('ArrowDown');
```

**File**: `packages/eui/src/components/list_item_layout/_list_item_layout.tsx` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ export type EuiListItemLayoutSharedProps = CommonProps &
     /**
      * Props applied to the label text element.
      */
-    textProps?: CommonProps;
+    textProps?: CommonProps & HTMLAttributes<HTMLElement>;
     prependProps?: CommonProps;
     appendProps?: CommonProps;
     tooltipProps?: Omit<EuiToolTipProps, 'children'>;
```

---

### Incident Patch 8: `27e94278` (2026-09-08)
**Commit Message**: [EuiDataGrid] Fix copy/paste column alignment with control columns (#9954)

Co-authored-by: Cursor <cursoragent@cursor.com>
Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `packages/eui/changelogs/upcoming/9954.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+**Bug fixes**
+
+- Fixed `EuiDataGrid` copy/paste shifting body rows one column right of the headers when control columns were present
```

**File**: `packages/eui/cypress/support/copy/select_and_copy.tsx` (modified, +11/-2)
```diff
@@ -6,7 +6,7 @@
  * Side Public License, v 1.
  */
 
-const selectAndCopy = (selectorToCopy: string) => {
+const selectAndCopy = (selectorToCopy: string, startSelector?: string) => {
   // Force Chrome devtools to allow reading from the clipboard
   cy.wrap(
     Cypress.automation('remote:debugger:protocol', {
@@ -35,7 +35,16 @@ const selectAndCopy = (selectorToCopy: string) => {
     const el = $el[0];
     const document = el.ownerDocument;
     const range = document.createRange();
-    range.selectNodeContents(el);
+    if (startSelector) {
+      const start = el.querySelector(startSelector);
+      if (!start) {
+        throw new Error(`Could not find start selector: ${startSelector}`);
+      }
+      range.selectNodeContents(el);
+      range.setStartBefore(start);
+    } else {
+      range.selectNodeContents(el);
+    }
     document.getSelection()!.removeAllRanges();
     document.getSelection()!.addRange(range);
   });
```

**File**: `packages/eui/cypress/support/index.d.ts` (modified, +5/-1)
```diff
@@ -53,9 +53,13 @@ declare global {
       /**
        * Select an element's content and copy it to the browser clipboard
        * @param selectorToCopy e.g. '.euiDataGrid__content'
+       * @param startSelector optional selector within the copied node to start the range
        * @returns a chainable .then((string) => { doSomethingWith(string); })
        */
-      selectAndCopy(selectorToCopy: string): Chainable<string>;
+      selectAndCopy(
+        selectorToCopy: string,
+        startSelector?: string
+      ): Chainable<string>;
 
       /*
        * Get the value of a CSS variable from the element's computed styles.
```

**File**: `packages/eui/src/components/datagrid/__snapshots__/data_grid.test.tsx.snap` (modified, +80/-24)
```diff
@@ -1205,15 +1205,22 @@ exports[`EuiDataGrid rendering renders control columns 1`] = `
                 style="width: 50px;"
                 tabindex="-1"
               >
+                <span
+                  aria-hidden="true"
+                  class="euiScreenReaderOnly"
+                  data-tabular-copy-marker="no-copy"
+                >
+                  ✄𐘗
+                </span>
                 <span>
                   leading heading
                 </span>
                 <span
                   aria-hidden="true"
                   class="euiScreenReaderOnly"
-                  data-tabular-copy-marker="tab"
+                  data-tabular-copy-marker="no-copy"
                 >
-                  ↦
+                  ✄𐘗
                 </span>
               </div>
               <div
@@ -1315,9 +1322,9 @@ exports[`EuiDataGrid rendering renders control columns 1`] = `
                 <span
                   aria-hidden="true"
                   class="euiScreenReaderOnly"
-                  data-tabular-copy-marker="tab"
+                  data-tabular-copy-marker="newline"
                 >
-                  ↦
+                  ↵
                 </span>
               </div>
               <div
@@ -1331,15 +1338,22 @@ exports[`EuiDataGrid rendering renders control columns 1`] = `
                 style="width: 50px;"
                 tabindex="-1"
               >
+                <span
+                  aria-hidden="true"
+                  class="euiScreenReaderOnly"
+                  data-tabular-copy-marker="no-copy"
+                >
+                  ✄𐘗
+                </span>
                 <span>
                   trailing heading
                 </span>
                 <span
                   aria-hidden="true"
                   class="euiScreenReaderOnly"
-                  data-tabular-copy-marker="newline"
+                  data-tabular-copy-marker="no-copy"
                 >
-                  ↵
+                  ✄𐘗
                 </span>
               </div>
             </div>
@@ -1355,6 +1369,13 @@ exports[`EuiDataGrid rendering renders control columns 1`] = `
               style="position: absolute; left: 0px; top: 0px; height: 34px; width: 50px;"
               tabindex="-1"
             >
+              <span
+                aria-hidden="true"
+                class="euiScreenReaderOnly"
+                data-tabular-copy-marker="no-copy"
+              >
+                ✄𐘗
+              </span>
               <div
                 class="euiDataGridRowCell__content euiDataGridRowCell__content--defaultHeight emotion-euiDataGridRowCell__content-controlColumn-autoHeight"
                 data-datagrid-cellcontent="true"
@@ -1364,9 +1385,9 @@ exports[`EuiDataGrid rendering renders control columns 1`] = `
               <span
                 aria-hidden="true"
                 class="euiScreenReaderOnly"
-                data-tabular-copy-marker="tab"
+                data-tabular-copy-marker="no-copy"
               >
-                ↦
+                ✄𐘗
               </span>
             </div>
             <div
@@ -1416,9 +1437,9 @@ exports[`EuiDataGrid rendering renders control columns 1`] = `
               <span
                 aria-hidden="true"
                 class="euiScreenReaderOnly"
-                data-tabular-copy-marker="tab"
+                data-tabular-copy-marker="newline"
               >
-                ↦
+                ↵
               </span>
             </div>
             <div
@@ -1433,6 +1454,13 @@ exports[`EuiDataGrid rendering renders control columns 1`] = `
               style="position: absolute; left: 250px; top: 0px; height: 34px; width: 50px;"
               tabindex="-1"
             >
+              <span
+                aria-hidden="true"
+                class="euiScreenReaderOnly"
+                data-tabular-copy-marker="no-copy"
+              >
+                ✄𐘗
+              </span>
     
```

**File**: `packages/eui/src/components/datagrid/body/cell/data_grid_cell.styles.ts` (modified, +4/-0)
```diff
@@ -161,6 +161,10 @@ export const euiDataGridRowCellStyles = (euiThemeContext: UseEuiTheme) => {
       &:where(.euiDataGridRowCell--capitalize) {
         text-transform: capitalize;
       }
+
+      &:where(.euiDataGridRowCell--controlColumn) {
+        user-select: none;
+      }
     `,
 
     content: {
```

---

### Incident Patch 9: `6ba5cff3` (2026-09-04)
**Commit Message**: [test-helpers] Fix EuiComboBoxObject clear() on singleSelection combo boxes (#9998)

**File**: `packages/test-helpers/changelogs/upcoming/9998.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+**Bug fixes**
+
+- Fixed `EuiComboBoxObject.clear()` and `setSelectedOptions()` timing out on `singleSelection` combo boxes, whose pills have no close button
```

**File**: `packages/test-helpers/src/playwright/components/combo_box/object.props.spec.ts` (modified, +10/-1)
```diff
@@ -45,7 +45,7 @@ test.describe('EuiComboBoxObject — singleSelection=true', () => {
   let comboBox: EuiComboBoxObject;
 
   test.beforeEach(async ({ page }) => {
-    await page.goto(playgroundUrl('singleSelection:true'));
+    await page.goto(playgroundUrl('singleSelection:!true'));
     await page.getByTestId(TEST_SUBJ).waitFor({ state: 'visible' });
     comboBox = new EuiComboBoxObject(page, TEST_SUBJ);
     await comboBox.clear();
@@ -70,6 +70,15 @@ test.describe('EuiComboBoxObject — singleSelection=true', () => {
 
     expect(await comboBox.getSelectedOptions()).toEqual([]);
   });
+
+  // Also catches the story silently falling back to multi-select, whose pills do have one.
+  test('the pill has no close button', async () => {
+    await comboBox.setSelectedOptions(['Item 2']);
+
+    await expect(
+      comboBox.locator.locator(EuiComboBoxSelectors.PILL_SELECTOR).locator('button')
+    ).toHaveCount(0);
+  });
 });
 
 // ---------------------------------------------------------------------------
```

**File**: `packages/test-helpers/src/playwright/components/combo_box/object.ts` (modified, +24/-3)
```diff
@@ -128,7 +128,8 @@ export class EuiComboBoxObject extends BaseObject {
    * Clear all selected options. No-op if nothing is selected.
    *
    * Auto-detects the combo box configuration and uses the appropriate strategy:
-   * - Pills present → {@link clickPillClearButtons}
+   * - Pills with a close button → {@link clickPillClearButtons}
+   * - Pills without a close button (`singleSelection`) → {@link clearPillWithoutCloseButton}
    * - `asPlainText` with a confirmed input selection → {@link deleteSearchInput}
    * - Otherwise → {@link deselectAllFromDropdown}
    *
@@ -142,7 +143,11 @@ export class EuiComboBoxObject extends BaseObject {
     }
 
     if (await this.hasPills()) {
-      await this.clickPillClearButtons();
+      if (await this.hasPillCloseButtons()) {
+        await this.clickPillClearButtons();
+      } else {
+        await this.clearPillWithoutCloseButton();
+      }
       return;
     }
 
@@ -176,9 +181,12 @@ export class EuiComboBoxObject extends BaseObject {
     return (await this.pills.count()) > 0;
   }
 
+  private async hasPillCloseButtons(): Promise<boolean> {
+    return (await this.pills.first().locator('button').count()) > 0;
+  }
+
   /**
    * Clicks the `×` button on each selected pill individually.
-   * Works regardless of `isClearable` — pill close buttons are always present.
    * No-op if no pills are rendered.
    */
   private async clickPillClearButtons(): Promise<void> {
@@ -189,6 +197,19 @@ export class EuiComboBoxObject extends BaseObject {
     }
   }
 
+  /**
+   * `singleSelection` pills render without a close button, whatever
+   * `isClearable` is. Backspace on an empty search input removes the
+   * selection instead.
+   */
+  private async clearPillWithoutCloseButton(): Promise<void> {
+    while (await this.hasPills()) {
+      const countBefore = await this.pills.count();
+      await this.searchInput.press('Backspace');
+      await expect(this.pills).not.toHaveCount(countBefore);
+    }
+  }
+
   /**
    * Opens the dropdown and clicks each `aria-selected="true"` option to
    * deselect it. Works for all `isClearable` and `singleSelection`
```

**File**: `packages/test-helpers/src/storybook.ts` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
  * Returns the Storybook iframe URL for a given story ID and optional args.
  *
  * @param id - The Storybook story ID (e.g. `'forms-euicombobox--playground'`)
- * @param args - Optional semicolon-separated Storybook args string (e.g. `'data-test-subj:myCombo;singleSelection:true'`)
+ * @param args - Optional semicolon-separated Storybook args string (e.g. `'data-test-subj:myCombo;singleSelection:!true'`)
  */
 export const storyUrl = (id: string, args?: string): string =>
   `/iframe.html?id=${id}&viewMode=story${args ? `&args=${args}` : ''}`;
```

---

### Incident Patch 10: `891499be` (2026-09-01)
**Commit Message**: [Chore] Wait for registry to fix broken CI (#9978)

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `.github/workflows/update_kibana_dependencies__prepare_changes.yml` (modified, +12/-1)
```diff
@@ -240,7 +240,18 @@ jobs:
       - name: Run Kibana bootstrap script and normalize dependencies
         # language=bash
         run: |
-          yarn kbn bootstrap
+          set -euo pipefail
+          # Retry a few times; the npm registry can lag behind a snapshot publish.
+          for attempt in 1 2 3 4 5; do
+            if yarn kbn bootstrap; then
+              break
+            fi
+            if [[ "$attempt" -eq 5 ]]; then
+              exit 1
+            fi
+            echo "bootstrap failed (attempt ${attempt}/5); retrying in 60s"
+            sleep 60
+          done
           node scripts/yarn_deduplicate
           yarn kbn bootstrap --force-install
       - name: Sync EUI i18n tokens
```

#### Recent Merged Pull Requests:
- **PR #10101** (2026-09-29): Release: @elastic/eslint-plugin-eui v3.2.0, @elastic/eui v123.0.0, @elastic/eui-test-helpers v2.0.0 (@tsullivan)
- **PR #10095** (2026-09-29): [Chore] Ping elastic/eui-icons team on issues labelled "icons" (@weronikaolejniczak)
- **PR #10094** (2026-09-29): [ESLint] Replace micromatch with picomatch (@weronikaolejniczak)
- **PR #10086** (2026-09-25): [EuiTextTruncate] Add toolTipProps to customize the full text tooltip (@Dosant)
- **PR #10084** (2026-09-28): Fix tooltip flicker issue in EuiDataGrid cell tooltips (@tsullivan)
- **PR #10082** (2026-09-24): [Chore] Add missing release prep commits for #10060 (@mgadewoll)
- **PR #10081** (2026-09-24): [Chore] Add Kibana prep commit for the test-helpers selectors object (@steliosmavro)
- **PR #10080** (closed): [Chore] Add missing commit to kibana-prep-commits (@mgadewoll)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
