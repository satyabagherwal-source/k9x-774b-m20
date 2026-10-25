> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/elastic-eui-learnings.md`  
> **Source**: github ([https://github.com/elastic/eui](https://github.com/elastic/eui))  
> **Source Version**: `1d4161ec`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T05:52:29.333Z  
> **Learning ID**: `learn-github-elastic-eui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): elastic/eui

> **Canonical Artifact**: `07_PROJECT_LEARNING/elastic-eui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/elastic/eui](https://github.com/elastic/eui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T05:52:28.280Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `elastic/eui`
- **Description**: Elastic UI Framework 🙌
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6375 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/eslint-plugin/src/utils/are_attrs_equal.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

const normalizeAttrString = (str?: string) => str?.trim().replace(/\s+/g, ' ');

export const areAttrsEqual = (...strings: Array<string | undefined>): boolean => {
  const [first, ...rest] = strings.map(normalizeAttrString);
  return rest.every((s) => s === first);
};

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/button_group_constants.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export const BUTTON_GROUP = 'EuiButtonGroup';

export const VALID_BUTTONS = new Set([
  'EuiButton',
  'EuiButtonEmpty',
  'EuiButtonIcon',
]);

export const SEGMENTED_VALID_BUTTONS = new Set(['EuiButton', 'EuiButtonIcon']);

export const SELECTION_VALID_BUTTONS = new Set(['EuiButton', 'EuiButtonIcon']);

export const VALID_WRAPPERS = new Set(['EuiToolTip', 'EuiPopover', 'EuiCopy']);

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/collect_jsx_children.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { type TSESTree, type TSESLint } from '@typescript-eslint/utils';
import { walkJsxChildren } from './walk_jsx_children';

export function collectJsxChildren(
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode
): TSESTree.JSXElement[] {
  const results: TSESTree.JSXElement[] = [];
  walkJsxChildren(
    node,
    (leaf) => {
      if (leaf.type === 'JSXElement') {
        results.push(leaf as TSESTree.JSXElement);
      }
    },
    { sourceCode }
  );
  return results;
}

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/constants.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

/**
 * A list of standard HTML tags that are considered **non-interactive** elements.
 *
 * These tags generally do not provide any built-in user interaction
 * (such as click, input, or focus behavior) and are typically used for
 * layout, structure, or content presentation rather than direct
 * interactivity.
 *
 * This constant can be useful when:
 * - Determining whether an element should be treated as interactive.
 * - Enforcing accessibility rules (e.g., ensuring interactive behavior is only applied to proper elements).
 * - Filtering DOM nodes when processing or analyzing HTML structures.
 */
export const NON_INTERACTIVE_HTML_TAGS = [
  'div',
  'span',
  'p',
  'article',
  'aside',
  'blockquote',
  'br',
  'caption',
  'code',
  'dd',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'main',
  'nav',
  'ol',
  'pre',
  'section',
  'small',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul'
];

/**
 * A list of Elastic UI (EUI) React components that are considered **interactive**.
 *
 * These components are designed to be focusable and respond to user actions
 * such as clicks, keyboard events, or other interactions. Use this constant
 * when you need to determine if a given EUI component is inherently interactive,
 * for example, when enforcing accessibility rules or filtering components
 * for focus management.
 *
 * This list should be kept up to date with EUI's interactive component offerings.
 */
export const INTERACTIVE_EUI_COMPONENTS = [
  'EuiBadge',
  'EuiBasicTable',
  'EuiBetaBadge',
  'EuiBreadcrumbs',
  'EuiButton',
  'EuiButtonEmpty',
  'EuiButtonGroup',
  'EuiButtonIcon',
  'EuiCard',
  'EuiCheckableCard',
  'EuiCheckbox',
  'EuiColorPicker',
  'EuiComboBox',
  'EuiContextMenuItem',
  'EuiDatePicker',
  'EuiDualRange',
  'EuiFacetButton',
  'EuiFieldNumber',
  'EuiFieldPassword',
  'EuiFieldSearch',
  'EuiFieldText',
  'EuiFilterButton',
  'EuiFilterSelectItem',
  'EuiFilterSelectable',
  'EuiHeaderLink',
  'EuiHeaderLogo',
  'EuiHeaderSectionItemButton',
  'EuiInMemoryTable',
  'EuiKeyPadMenuItem',
  'EuiLink',
  'EuiListGroupItem',
  'EuiPagination',
  'EuiPinnableListGroup',
  'EuiRadio',
  'EuiRange',
  'EuiSelect',
  'EuiSelectable',
  'EuiSideNav',
  'EuiStepHorizontal',
  'EuiSuperDatePicker',
  'EuiSuperSelect',
  'EuiSwitch',
  'EuiTab',
  'EuiTextArea',
  'EuiTreeView'
];

/**
 * EUI components that render a focusable element only when given one of the
 * listed props. Without them they render plain, non-focusable markup — a
 * `<span>`, `<div>`, or `<li>` — so rules that need an unconditionally
 * interactive element must check the props rather than the name alone.
 *
 * - `EuiBadge` / `EuiBetaBadge` render a `<span>` unless clickable.
 * - `EuiCard` renders a plain panel; `selectable` also makes it clickable by
 *   rendering an `EuiCardSelect` button.
 * - `EuiContextMenuItem` renders a `<div>` unless it has an action, and is a
 *   `<button>` when given `toolTipContent`.
 * - `EuiHeaderLogo` renders an `<a>` without an `href` attribute, which is not
 *   focusable.
 * - `EuiListGroupItem` renders an `<li>` unless it has an action.
 */
export const CONDITIONALLY_INTERACTIVE_EUI_COMPONENTS: Record<string, string[]> =
  {
    EuiBadge: ['iconOnClick', 'onClick', 'href'],
    EuiBetaBadge: ['tooltipContent', 'onClick', 'href'],
    EuiCard: ['onClick', 'href', 'selectable'],
    EuiContextMenuItem: ['onClick', 'href', 'toolTipContent'],
    EuiHeaderLogo: ['href'],
    EuiListGroupItem: ['onClick', 'href'],
  };

/**
 * Native HTML elements that are focusable only when given one of the listed
 * attributes. An `<a>` without `href` is not a link and is not focusable.
 */
export const CONDITIONALLY_INTERACTIVE_HTML_ELEMENTS: Record<string, string[]> =
  {
    a: ['href'],
  };

/**
 * Conditional interactive props whose presence alone is enough to make the
 * rendered element focusable, even when the statically-known value is `""`.
 *
 * Native anchors and `EuiHeaderLogo` both forward `href=""` to the DOM, which
 * still creates a focusable same-document link.
 */
export const PRESENCE_INTERACTIVE_PROPS: Record<string, string[]> = {
  a: ['href'],
  EuiHeaderLogo: ['href'],
};

export const HTML_TEXT_ELEMENTS = new Set([
  'p',
  'span',
  'strong',
  'em',
  'b',
  'i',
  'small',
  'code',
]);

export const EUI_TEXT_COMPONENTS = new Set([
  'EuiText',
  'EuiTextColor',
  'EuiTextAlign',
  'EuiCode',
  'EuiMark',
  'EuiHighlight',
]);

export const HTML_ACTION_ELEMENTS = new Set(['button', 'a']);

/** Native HTML elements that are focusable and respond to user input. */
export const INTERACTIVE_HTML_ELEMENTS = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
];

/**
 * Transparent layout wrappers inside `EuiCallOut` children that the rule should
 * traverse rather than treat as opaque custom components.
 */
export const CALLOUT_LAYOUT_CONTAINERS = new Set([
  'Fragment',
  'EuiFlexGroup',
  'EuiFlexGrid',
  'EuiFlexItem',
  'div',
]);

/**
 * Third-party i18n components that render plain text and are common in EUI consumers
 * (e.g. `FormattedMessage` from react-intl used extensively in Kibana).
 * Rules treat these the same as `HTML_TEXT_ELEMENTS` / `EUI_TEXT_COMPONENTS`.
 */
export const I18N_TEXT_COMPONENTS = new Set(['FormattedMessage']);

/**
 * EUI components that render their content **inside** a single focusable
 * `<button>` or `<a>`.
 *
 * Nesting another interactive element in their content produces invalid HTML
 * (e.g. `<button>` inside `<button>`) and leaves the inner control unreachable
 * or ambiguous for keyboard and screen-reader users.
 *
 * This is deliberately narrower than `INTERACTIVE_EUI_COMPONENTS`, which also
 * contains composite components (`EuiBasicTable`, `EuiSelectable`, `EuiSideNav`,
 * …) whose entire purpose is to host controls.
 */
export const LEAF_INTERACTIVE_EUI_COMPONENTS = [
  'EuiButton',
  'EuiButtonEmpty',
  'EuiButtonIcon',
  'EuiContextMenuItem',
  'EuiFacetButton',
  'EuiFilterButton',
  'EuiHeaderLink',
  'EuiHeaderSectionItemButton',
  'EuiKeyPadMenuItem',
  'EuiLink',
  'EuiListGroupItem',
  'EuiStepHorizontal',
  'EuiTab',
];

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/flat_map.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

// `Array.prototype.flatMap` requires ES2019 lib; this shim keeps rules that
// need it within the package's es5 lib setting without widening it for others.
export function flatMap<T, U>(arr: readonly T[], fn: (item: T) => U[]): U[] {
  const out: U[] = [];
  for (const item of arr) {
    const items = fn(item);
    for (const i of items) out.push(i);
  }
  return out;
}

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/get_allowed_a11y_prop_names_for_component.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

/**
 * Configuration describing which components accept a `label` prop
 * and the baseline set of accessibility prop names allowed across components.
 */
export type A11yConfig = {
  interactiveComponentsWithLabel: ReadonlyArray<string>;
  wrappingComponents: ReadonlyArray<string>;
  baseA11yProps: ReadonlyArray<string>;
};

/**
 * Compute the set of allowed accessibility prop names for a given component.
 *
 * - Always includes the provided `baseA11yProps`.
 * - Conditionally includes `label` if the component is listed in either
 *   `interactiveComponentsWithLabel` or `wrappingComponents`.
 * - Does **not** mutate the provided configuration; a new array is returned.
 *
 * @param componentName - The EUI component name (e.g., `'EuiButtonIcon'`).
 * @param cfg - The accessibility configuration to use when resolving allowed props.
 * @returns A new array of allowed prop names for `componentName`.
 *
 */
export function getAllowedA11yPropNamesForComponent(
  componentName: string,
  cfg: A11yConfig
): string[] {
  const componentsWithLabel = new Set<string>([
    ...cfg.interactiveComponentsWithLabel,
    ...cfg.wrappingComponents,
  ]);

  if (componentsWithLabel.has(componentName)) {
    return [...cfg.baseA11yProps, 'label'];
  }
  return [...cfg.baseA11yProps];
}

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/get_attr_value.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { type TSESTree, type TSESLint} from '@typescript-eslint/utils';

export function findAttrValue<
  TContext extends TSESLint.RuleContext<string, unknown[]>
>(
  context: TContext,
  attributes: TSESTree.JSXOpeningElement['attributes'],
  attrName: string
) {
  const attr = attributes.find(
    (attr): attr is TSESTree.JSXAttribute =>
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === attrName
  );

  return extractAttrValue(context, attr);
}

export function extractAttrValue<
  TContext extends TSESLint.RuleContext<string, unknown[]>
>(
  context: TContext,
  attr: TSESTree.JSXAttribute | undefined,
): string | undefined {

  if (!attr?.value) {
    return undefined;
  }

  if (attr.value.type === 'Literal') {
    return String(attr.value.value);
  }

  if (attr.value.type === 'JSXExpressionContainer') {
    const expression = attr.value.expression;

    if (expression.type === 'Literal') {
      return String(expression.value);
    }

    return context.sourceCode.getText(expression);
  }

  return undefined;
}

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/get_element_name.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { type TSESTree } from '@typescript-eslint/utils';

export function getElementName(
  openingElement: TSESTree.JSXOpeningElement
): string | null {
  const { name } = openingElement;

  if (name.type === 'JSXIdentifier') return name.name;

  return null;
}

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/get_property_name.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { TSESTree } from '@typescript-eslint/utils';

export const getPropertyName = (
  propertyNode: TSESTree.Property | TSESTree.SpreadElement
): string | null => {
  if (propertyNode.type === 'Property') {
    if (propertyNode.key.type === 'Identifier') {
      return propertyNode.key.name;
    }
    if (propertyNode.key.type === 'Literal') {
      return String(propertyNode.key.value);
    }
  } else if (
    propertyNode.type === 'SpreadElement' &&
    propertyNode.argument.type === 'Identifier'
  ) {
    return propertyNode.argument.name;
  }
  return null;
};

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/has_a11y_prop_for_component.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { TSESTree } from '@typescript-eslint/utils';
import {
  getAllowedA11yPropNamesForComponent,
  type A11yConfig,
} from './get_allowed_a11y_prop_names_for_component';

/**
 * Determines whether a JSX element declares at least one **allowed**
 * accessibility-related prop for a given component.
 *
 * Allowed prop names are resolved via {@link getAllowedA11yPropNamesForComponent},
 * which combines baseline a11y props (e.g. `aria-*`) and conditionally adds
 * `label` for components that support it per the provided configuration.
 *
 * Only plain `JSXAttribute` nodes are considered—spread attributes are ignored here.
 *
 * @param componentName - The component name being checked (e.g., `"EuiButtonIcon"`).
 * @param attrs - The attributes array from a `JSXOpeningElement` (ESTree).
 * @param cfg - Accessibility configuration that defines base props and which
 *              components may accept a `label` prop.
 * @returns `true` if any attribute name on the element is in the allowed set; otherwise `false`.
 */

export function hasA11yPropForComponent(
  componentName: string,
  attrs: TSESTree.JSXOpeningElement['attributes'],
  cfg: A11yConfig
): boolean {
  const allowed = new Set(
    getAllowedA11yPropNamesForComponent(componentName, cfg)
  );
  return attrs.some(
    (attr): attr is TSESTree.JSXAttribute =>
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      allowed.has(attr.name.name)
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10238** (2026-10-23): **[Dependencies] Bump vulnerable dev dependencies within existing ranges**
  *Symptoms*: ## Summary  Lockfile-only bump of dev and tooling dependencies that have published security fixes within the ranges we already declare. No `package.json` changes, nothing in the published `@elastic/eui` runtime dependencies.  | Package | From | To | Pulled in by | | --- | --- | --- | --- | | vite | 7.3.6 | 7.3.7 | `@elastic/eui` devDep (Storybook) | | launch-editor | 2.6.1 | 2.14.2 | `webpack-dev-server` | | follow-redirects | 1.15.3, 1.15.6, 1.16.0 | 1.16.1 | `axios` (`wait-on`, `@storybook/test-runner`) | | markdown-it | 14.1.0 | 14.3.3 | `typedoc` | | undici | 6.21.1 | 6.29.1 | `@elastic/elasticsearch` (`eui-usage-analytics`) | | socks / ip-address | 2.7.1, 2.8.3 / 9.0.5 | 2.8.10 / 10.7.4 | `node-gyp` and `sigstore` tooling | | terser-webpack-plugin | 5.3.5, 5.3.10, 5.3.14 | 5.6.1 | `webpack` (Docusaurus); drops its `serialize-javascript` dependency | | express / body-parser / qs | 4.18.2 / 1.20.1 / 6.11.0, 6.15.2 | 4.22.3 / 1.20.9 / 6.16.1 | `webpack-dev-server`, `http-server` | | ws | 7.5.9 / 8.14.2, 8.17.0, 8.21.1 | 7.5.13 / 8.22.0 | `webpack-dev-server`, `webpack-bundle-analyzer`, `jsdom`, Storybook | | nanoid | 3.3.4, 3.3.6, 3.3.7, 3.3.16 | 3.3.20 | `postcss` | | postcss-selector-parser | 6.0.10, 6.0.13, 6.1.0 / 7.1.0 | 6.1.5 / 7.1.7 | `cssnano`, `css-loader`, `stylelint`, `postcss-preset-env` plugins |  Some copies can't be fixed without a major bump and are left as is: `qs@6.10.4` (Cypress), `serialize-javascript` 6.0.x (Docusaurus' `copy-webpack-plugin` and `css-mi

- **Issue #10236** (2026-10-23): **[CI] Bump Node.js to 24.22.1**
  *Symptoms*: ## Summary  Bumps Node.js from 24.19.0 to 24.22.1, the [October 2026 Node.js security release](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) (CVE-2026-111497, CVE-2026-106069, CVE-2026-105481, CVE-2026-106072, CVE-2026-106073, CVE-2026-106074).  - `.nvmrc` - CI Docker image base in `packages/eui/scripts/docker-ci/Dockerfile` - `DOCKER_BASE_IMAGE` in `.buildkite/scripts/lifecycle/pre_command.sh`: `eui/ci:6.7` → `eui/ci:6.8`  `docker.elastic.co/eui/ci:6.8` is already built from this Dockerfile and published (Node v24.22.1, linux/amd64). After merge, the CI VM image needs a rebuild from the new `.nvmrc` via the `ci-vm-images` pipeline.  Locally on Node 24.22.1, `yarn workspace @elastic/eui run build` and Storybook startup run with no errors or Node deprecation warnings.  Only dev and CI tooling is affected. Nothing changes in the published packages.  ### API Changes  None.  ## Impact Assessment  **Impact level:** 🟢 None  ## Release Readiness  - [ ] ~~**Documentation**~~ - [ ] ~~**Figma**~~ - [ ] ~~**Migration guide**~~ - [ ] ~~**Adoption plan**~~  ### QA instructions for reviewer  - [x] `docker manifest inspect docker.elastic.co/eui/ci:6.8` shows `linux/amd64`. - [ ] CI passes on the new image. 
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8324) * Commit: f5a3606fb1e64311b9842d176587363e58624834  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8324","number":8324,"commit":"f5a3606fb1e64311b9842d176587363e58624834"}],"number":8324} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5954) * Commit: f5a3606fb1e64311b9842d176587363e58624834 * [Documentation website](https://eui.elastic.co/pr_10236/) * [Storybook](https://eui.elastic.co/pr_10236/storybook/) * :white_check_mark: Visual regression tests passed   <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5954","number":5954,"commit":"f5a3606fb1e64311b9842d176587363e58624834"}],"number":5954} buildkite-pr-comment-->

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

### Incident Patch 1: `05ac983e` (2026-10-23)
**Commit Message**: fix(ci): remove invalid queue: max from Kibana dependencies workflow concurrency (#10231)

Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/update_kibana_dependencies__open_pr.yml` (modified, +0/-1)
```diff
@@ -43,7 +43,6 @@ concurrency:
   # A newer run for the same source PR supersedes the older run and reports
   # status for the latest commits.
   cancel-in-progress: ${{ !!inputs.source_pr_number }}
-  queue: max
 permissions:
   contents: read
   id-token: write
```

---

### Incident Patch 2: `af925019` (2026-10-23)
**Commit Message**: [test-helpers] Add EuiCallOutObject (#10234)

**File**: `packages/release-cli/kibana-prep-commits` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@
 # Nightly cherry-picks both sections, skipping commits that are missing or already applied.
 
 # @next
+https://github.com/elastic/kibana/pull/299882/commits/ced5b8fc0de17b394f574d3b3800eddbc5ccb1f0
 https://github.com/elastic/kibana/pull/299589/commits/f23a90a18b48b9d5d6aca0078fdfe983e46a8633
 https://github.com/elastic/kibana/pull/299489/commits/7b13b631bb435fd4b8a244978e7afa11f6391bac
 
```

**File**: `packages/test-helpers/README.md` (modified, +1/-0)
```diff
@@ -65,6 +65,7 @@ their own version at runtime.
 | `EuiTableObject` | [src/components/table/README.md](src/components/table/README.md) |
 | `EuiPaginationObject` | [src/components/pagination/README.md](src/components/pagination/README.md) |
 | `EuiBasicTableObject` | [src/components/basic_table/README.md](src/components/basic_table/README.md) |
+| `EuiCallOutObject` | [src/components/call_out/README.md](src/components/call_out/README.md) |
 | `EuiColorPickerObject` | [src/components/color_picker/README.md](src/components/color_picker/README.md) |
 | `EuiTreeViewObject` | [src/components/tree_view/README.md](src/components/tree_view/README.md) |
 | `EuiToolTipObject` | [src/components/tool_tip/README.md](src/components/tool_tip/README.md) |
```

**File**: `packages/test-helpers/changelogs/upcoming/10234.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Added `EuiCallOutObject` with `getTitle()`, `getText()`, `getColor()`, `dismissButton` and `dismiss()`
```

**File**: `packages/test-helpers/src/components/call_out/README.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+# EuiCallOutObject
+
+Playwright Component Object for [EuiCallOut](https://eui.elastic.co/docs/components/display/callout/).
+
+## Usage
+
+```ts
+import { EuiCallOutObject } from '@elastic/eui-test-helpers';
+
+const callOut = new EuiCallOutObject(page, 'myCallOut');
+expect(await callOut.getColor()).toBe('warning');
+expect(await callOut.getTitle()).toBe('Index is read only');
+```
+
+Set `data-test-subj` on `<EuiCallOut>`. EUI puts it on the panel root and derives `<subj>__message`, `<subj>__content` and `<subj>__actions` for the inner blocks. The root lookup matches whole tokens, so those derived values are not mistaken for the root.
+
+## API
+
+| Member | Description |
+|---|---|
+| `getTitle()` | The title text, or an empty string without a `title`. |
+| `getText()` | The `text` block, or an empty string without a `text`. |
+| `getColor()` | The color variant read from the root class: `primary`, `success`, `warning` or `danger`. |
+| `dismissButton` | `Locator` for the dismiss button, found by its test subj or its cross icon so a `dismissButtonProps` test subj override still works. Zero elements without `onDismiss`. |
+| `dismiss()` | Click the dismiss button. What follows is the consumer's `onDismiss`, nothing is asserted. |
+
+## Deliberately excluded
+
+Custom `children` and `actions` are consumer content, use `locator` to reach them. The `announceOnMount` live region renders a second, off-screen copy of the content under `role="status"`, it is outside the root and does not affect this object.
```

**File**: `packages/test-helpers/src/components/call_out/selectors.ts` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+/**
+ * Stable selectors for
+ * {@link https://eui.elastic.co/docs/components/display/callout/|EuiCallOut}.
+ * `*_SELECTOR` values are CSS, `*_TEST_SUBJ` values are `data-test-subj` names EUI sets itself.
+ */
+export const EuiCallOutSelectors = {
+  /** The panel root carrying the consumer's `data-test-subj`. */
+  ROOT_SELECTOR: '.euiCallOut',
+
+  /** The title element, rendered only with a `title`. */
+  TITLE_SELECTOR: '.euiCallOutHeader__title',
+
+  /** The `text` block, rendered only with a `text`. */
+  TEXT_SELECTOR: '.euiCallOut__text',
+
+  /** Prefix of the root class that carries the color, e.g. `euiCallOut--warning`. */
+  COLOR_CLASS_PREFIX: 'euiCallOut--',
+
+  /** The dismiss button, rendered only with `onDismiss`. */
+  DISMISS_BUTTON_TEST_SUBJ: 'euiDismissCalloutButton',
+
+  /**
+   * The dismiss button by its test subj, or by its cross icon when
+   * `dismissButtonProps` replaced the test subj.
+   */
+  DISMISS_BUTTON_SELECTOR:
+    '[data-test-subj="euiDismissCalloutButton"], button:has([data-icon-type="cross"])',
+};
```

**File**: `packages/test-helpers/src/index.ts` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ export { EuiModalObject } from './playwright/components/modal/object';
 export { EuiTableObject } from './playwright/components/table/object';
 export { EuiPaginationObject } from './playwright/components/pagination/object';
 export { EuiBasicTableObject } from './playwright/components/basic_table/object';
+export { EuiCallOutObject } from './playwright/components/call_out/object';
 export { EuiColorPickerObject } from './playwright/components/color_picker/object';
 export { EuiTreeViewObject } from './playwright/components/tree_view/object';
 export { EuiToolTipObject } from './playwright/components/tool_tip/object';
```

**File**: `packages/test-helpers/src/playwright/components/call_out/object.props.spec.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+import { test, expect } from '@playwright/test';
+
+import { EuiCallOutObject } from './object';
+import { storyUrl } from '../../../storybook';
+
+/**
+ * Validates `EuiCallOutObject` against a dismissible call out. The Playground
+ * story's `onDismiss` toggle logs the callback instead of unmounting, so the
+ * click itself is the observable outcome.
+ */
+
+const TEST_SUBJ = 'testCallOut';
+
+test.describe('EuiCallOutObject (onDismiss)', () => {
+  let callOut: EuiCallOutObject;
+
+  test.beforeEach(async ({ page }) => {
+    await page.goto(
+      storyUrl(
+        'display-euicallout--playground',
+        `data-test-subj:${TEST_SUBJ};onDismiss:!true`
+      )
+    );
+    callOut = new EuiCallOutObject(page, TEST_SUBJ);
+    await callOut.locator.waitFor({ state: 'visible' });
+  });
+
+  test('exposes the dismiss button and clicks it', async () => {
+    await expect(callOut.dismissButton).toBeVisible();
+
+    await callOut.dismiss();
+
+    await expect(callOut.dismissButton).toBeFocused();
+  });
+});
```

**File**: `packages/test-helpers/src/playwright/components/call_out/object.spec.ts` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+import { test, expect } from '@playwright/test';
+
+import { EuiCallOutObject } from './object';
+import { storyUrl } from '../../../storybook';
+
+/**
+ * Validates `EuiCallOutObject` against the live component in EUI Storybook.
+ * The Playground story has a title and text and no dismiss button.
+ */
+
+const TEST_SUBJ = 'testCallOut';
+
+const STORY_ID = 'display-euicallout--playground';
+
+test.describe('EuiCallOutObject', () => {
+  let callOut: EuiCallOutObject;
+
+  test.beforeEach(async ({ page }) => {
+    await page.goto(storyUrl(STORY_ID, `data-test-subj:${TEST_SUBJ}`));
+    callOut = new EuiCallOutObject(page, TEST_SUBJ);
+    await callOut.locator.waitFor({ state: 'visible' });
+  });
+
+  test('resolves the root, not the derived inner blocks', async () => {
+    await expect(callOut.locator).toHaveCount(1);
+    await expect(callOut.locator).toHaveAttribute('data-test-subj', TEST_SUBJ);
+  });
+
+  test('reads the panel when a shared token also matches a derived block', async ({
+    page,
+  }) => {
+    // `notice shared__message` still carries the `notice` token.
+    await page.goto(storyUrl(STORY_ID, 'data-test-subj:notice%20shared'));
+    const shared = new EuiCallOutObject(page, 'notice');
+    await shared.locator.waitFor({ state: 'visible' });
+
+    await expect(shared.locator).toHaveCount(1);
+    expect(await shared.getColor()).toBe('primary');
+    expect(await shared.getTitle()).toBe('Callout title');
+  });
+
+  test.describe('getTitle and getText', () => {
+    test('read the title and the text block', async () => {
+      expect(await callOut.getTitle()).toBe('Callout title');
+      expect(await callOut.getText()).toBe('A short callout text');
+    });
+
+    test('return an empty string when the text prop is absent', async ({
+      page,
+    }) => {
+      await page.goto(
+        storyUrl(STORY_ID, `data-test-subj:${TEST_SUBJ};text:!undefined`)
+      );
+      const titleOnly = new EuiCallOutObject(page, TEST_SUBJ);
+      await titleOnly.locator.waitFor({ state: 'visible' });
+
+      expect(await titleOnly.getTitle()).toBe('Callout title');
+      expect(await titleOnly.getText()).toBe('');
+    });
+  });
+
+  test.describe('getColor', () => {
+    test('reads the default color', async () => {
+      expect(await callOut.getColor()).toBe('primary');
+    });
+
+    test('reads a non default color', async ({ page }) => {
+      await page.goto(
+        storyUrl(STORY_ID, `data-test-subj:${TEST_SUBJ};color:warning`)
+      );
+      const warning = new EuiCallOutObject(page, TEST_SUBJ);
+      await warning.locator.waitFor({ state: 'visible' });
+
+      expect(await warning.getColor()).toBe('warning');
+    });
+  });
+
+  test.describe('dismissButton', () => {
+    test('is absent without onDismiss', async () => {
+      await expect(callOut.dismissButton).toHaveCount(0);
+    });
+  });
+});
```

---

### Incident Patch 3: `fde3925a` (2026-10-23)
**Commit Message**: [test-helpers] Add EuiFieldSearchObject and EuiSearchBarObject (#10222)

**File**: `packages/eui/src/components/search_bar/search_bar.stories.tsx` (modified, +17/-0)
```diff
@@ -157,3 +157,20 @@ export const Playground: Story = {
     toolsRight: false as any,
   },
 };
+
+export const WithBoxTestSubj: Story = {
+  name: 'With box data-test-subj',
+  parameters: {
+    vrt: {
+      // Same render as the Playground, only adds a test subj for test tooling
+      skip: true,
+    },
+  },
+  args: {
+    ...Playground.args,
+    box: {
+      ...Playground.args?.box,
+      'data-test-subj': 'searchBarBox',
+    },
+  },
+};
```

**File**: `packages/test-helpers/README.md` (modified, +2/-0)
```diff
@@ -54,6 +54,8 @@ their own version at runtime.
 | `EuiSideNavObject` | [src/components/side_nav/README.md](src/components/side_nav/README.md) |
 | `EuiDraggableObject` | [src/components/drag_and_drop/README.md](src/components/drag_and_drop/README.md) |
 | `EuiFilterButtonObject` | [src/components/filter_button/README.md](src/components/filter_button/README.md) |
+| `EuiFieldSearchObject` | [src/components/form/field_search/README.md](src/components/form/field_search/README.md) |
+| `EuiSearchBarObject` | [src/components/search_bar/README.md](src/components/search_bar/README.md) |
 | `EuiRangeObject` | [src/components/form/range/README.md](src/components/form/range/README.md) |
 | `EuiPopoverObject` | [src/components/popover/README.md](src/components/popover/README.md) |
 | `EuiFlyoutObject` | [src/components/flyout/README.md](src/components/flyout/README.md) |
```

**File**: `packages/test-helpers/changelogs/upcoming/10222.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Added `EuiFieldSearchObject` with `setQuery(text)`, `getQuery()` and `clear()`, and `EuiSearchBarObject` for the same input reached through the search bar `box` prop
```

**File**: `packages/test-helpers/src/components/form/field_search/README.md` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+# EuiFieldSearchObject
+
+Playwright Component Object for [EuiFieldSearch](https://eui.elastic.co/docs/components/forms/search-and-filter/search/).
+
+## Usage
+
+```ts
+import { EuiFieldSearchObject } from '@elastic/eui-test-helpers';
+
+const search = new EuiFieldSearchObject(page, 'mySearch');
+await search.setQuery('logs');
+expect(await search.getQuery()).toBe('logs');
+```
+
+Set `data-test-subj` on `<EuiFieldSearch>`. EUI spreads it onto the `<input type="search">`, which the component-type guard verifies.
+
+## API
+
+| Member | Description |
+|---|---|
+| `setQuery(text)` | Replace the text and submit it with Enter. Triggers `onSearch` for both the incremental and the plain variant. |
+| `getQuery()` | The current text of the input. |
+| `clear()` | Empty the input and submit, so `onSearch` receives an empty query. |
+
+`clear()` does not use the clear button since it only renders with `isClearable` and a value. Submitting an empty query has the same effect.
+
+## Deliberately excluded
+
+Per keystroke `onSearch` of the incremental variant. `setQuery` fills the text in one go and submits once. Use `locator.pressSequentially()` if a test needs every keystroke.
```

**File**: `packages/test-helpers/src/components/form/field_search/selectors.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+/**
+ * Stable selectors for
+ * {@link https://eui.elastic.co/docs/components/forms/search-and-filter/search/|EuiFieldSearch}.
+ * `*_SELECTOR` values are CSS, `*_TEST_SUBJ` values are `data-test-subj` names EUI sets itself.
+ */
+export const EuiFieldSearchSelectors = {
+  /** The `<input type="search">` carrying the consumer's `data-test-subj`. */
+  ROOT_SELECTOR: '.euiFieldSearch',
+
+  /** The clear button next to the input, rendered only with `isClearable` and a value. */
+  CLEAR_BUTTON_TEST_SUBJ: 'clearSearchButton',
+};
```

**File**: `packages/test-helpers/src/components/search_bar/README.md` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+# EuiSearchBarObject
+
+Playwright Component Object for [EuiSearchBar](https://eui.elastic.co/docs/components/forms/search-and-filter/search-bar/).
+
+## Usage
+
+```ts
+import { EuiSearchBarObject } from '@elastic/eui-test-helpers';
+
+const searchBar = new EuiSearchBarObject(page, 'mySearchBar');
+await searchBar.setQuery('type:dashboard');
+```
+
+The search bar has no root of its own. Pass the subj through the `box` prop, `box={{ 'data-test-subj': 'mySearchBar' }}`, EUI puts it on the search input. This object is [EuiFieldSearchObject](../form/field_search/README.md) under the search bar's own name, same API: `setQuery(text)`, `getQuery()`, `clear()`.
+
+## Deliberately excluded
+
+The filter buttons next to the box are `EuiFilterButton`, use `EuiFilterButtonObject`. Query parsing and the error tooltip are consumer facing results of `onChange`, assert on them in the test.
```

**File**: `packages/test-helpers/src/components/search_bar/selectors.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+/**
+ * Stable selectors for
+ * {@link https://eui.elastic.co/docs/components/forms/search-and-filter/search-bar/|EuiSearchBar}.
+ * `*_SELECTOR` values are CSS.
+ */
+export const EuiSearchBarSelectors = {
+  /** The wrapper of the search box. */
+  SEARCH_HOLDER_SELECTOR: '.euiSearchBar__searchHolder',
+
+  /** The wrapper of the filter buttons, rendered only with `filters`. */
+  FILTERS_HOLDER_SELECTOR: '.euiSearchBar__filtersHolder',
+};
```

**File**: `packages/test-helpers/src/index.ts` (modified, +2/-0)
```diff
@@ -15,6 +15,8 @@ export { EuiSelectableObject } from './playwright/components/selectable/object';
 export { EuiSideNavObject } from './playwright/components/side_nav/object';
 export { EuiDraggableObject } from './playwright/components/drag_and_drop/object';
 export { EuiFilterButtonObject } from './playwright/components/filter_button/object';
+export { EuiFieldSearchObject } from './playwright/components/form/field_search/object';
+export { EuiSearchBarObject } from './playwright/components/search_bar/object';
 export { EuiRangeObject } from './playwright/components/form/range/object';
 export { EuiPopoverObject } from './playwright/components/popover/object';
 export { EuiFlyoutObject } from './playwright/components/flyout/object';
```

#### Recent Merged Pull Requests:
- **PR #10238** (2026-10-23): [Dependencies] Bump vulnerable dev dependencies within existing ranges (@Dosant)
- **PR #10236** (2026-10-23): [CI] Bump Node.js to 24.22.1 (@Dosant)
- **PR #10234** (2026-10-23): [test-helpers] Add EuiCallOutObject (@steliosmavro)
- **PR #10231** (2026-10-23): fix(ci): remove invalid queue: max from Kibana dependencies workflow concurrency (@eokoneyo)
- **PR #10230** (closed): [Chore] Add Kibana prep commit for the EuiSideNav selectors (@steliosmavro)
- **PR #10229** (2026-10-22): [test-helpers] Add EuiSideNavObject (@steliosmavro)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
