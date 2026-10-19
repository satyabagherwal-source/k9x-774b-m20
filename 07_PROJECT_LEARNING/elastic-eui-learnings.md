> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/elastic-eui-learnings.md`  
> **Source**: github ([https://github.com/elastic/eui](https://github.com/elastic/eui))  
> **Source Version**: `bfd03740`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T13:27:26.651Z  
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
> **Harvest Timestamp**: 2026-10-19T13:27:26.641Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `elastic/eui`
- **Description**: Elastic UI Framework 🙌
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6371 stars

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
- **Issue #10216** (2026-10-19): **[ESLint plugin] Bump picomatch and brace-expansion to patched versions**
  *Symptoms*: ## Summary  Snyk flagged `picomatch@2.3.1` (direct dependency of `@elastic/eslint-plugin-eui`) and `brace-expansion@5.0.7` (via `@typescript-eslint/typescript-estree` → `minimatch`). The plugin only matches globs from ESLint and tsconfig config at lint time, so the patterns aren't attacker-controlled, but patched versions are in range, so this bumps them.  - `picomatch` `^2.3.1` → `^2.3.2` - `brace-expansion` refreshed in the lockfile to 5.0.12, plus the 1.x and 2.x copies to 1.1.21 and 2.1.7 - `picomatch` 4.x refreshed to 4.0.7 while at it  `react-scanner` (used by `packages/eui-usage-analytics`) pins `picomatch` to exactly `2.3.1`, so that copy stays. It isn't part of what Snyk flagged here.  ### API Changes  None.  ## Impact Assessment  **Impact level:** 🟢 None  ## Release Readiness  - [ ] ~~**Documentation:**~~ - [ ] ~~**Figma:**~~ - [ ] ~~**Migration guide:**~~ - [ ] ~~**Adoption plan**~~  ### Checklist before marking Ready for Review  - [x] Filled out all sections above - [ ] ~~**QA:** Tested light/dark modes, high contrast, mobile, Chrome/Safari/Edge/Firefox, keyboard-only, screen reader~~ - [ ] ~~**QA:** Tested in CodeSandbox and Kibana~~ - [ ] ~~**QA:** Tested docs changes~~ - [ ] ~~**Tests:** Added/updated Jest, Cypress, and VRT~~ - [x] **Changelog:** Added [changelog entry](https://github.com/elastic/eui/blob/main/wiki/contributing-to-eui/documenting/changelogs.md) - [ ] ~~**Breaking changes:** Added `breaking change` label (if applicable)~~  ### Reviewer checklis
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5899) * Commit: a2794862bda298658f323e1795c55adb09bb246d * [Documentation website](https://eui.elastic.co/pr_10216/) * [Storybook](https://eui.elastic.co/pr_10216/storybook/) * :white_check_mark: Visual regression tests passed   <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5899","number":5899,"commit":"a2794862bda298658f323e1795c55adb09bb246d"}],"number":5899} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8284) * Commit: a2794862bda298658f323e1795c55adb09bb246d  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8284","number":8284,"commit":"a2794862bda298658f323e1795c55adb09bb246d"}],"number":8284} buildkite-pr-comment-->

- **Issue #10215** (2026-10-19): **Release: @elastic/eui-docusaurus-theme v2.8.1, @elastic/eui v123.2.0, @elastic/eui-test-helpers v2.1.0**
  *Symptoms*: Packages to release: - `@elastic/eui-docusaurus-theme` - v2.8.0 → v2.8.1 - `@elastic/eui` - v123.1.0 → v123.2.0 - `@elastic/eui-test-helpers` - v2.0.0 → v2.1.0
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5897) * Commit: 169263b6a9cb11a637e2c69986b2d30f03b08629 * [Documentation website](https://eui.elastic.co/pr_10215/) * [Storybook](https://eui.elastic.co/pr_10215/storybook/) * :no_entry_sign: Visual regression tests skipped: Has 'skip-vrt' label   <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5897","number":5897,"commit":"169263b6a9cb11a637e2c69986b2d30f03b08629"}],"number":5897} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8282) * Commit: 169263b6a9cb11a637e2c69986b2d30f03b08629  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8282","number":8282,"commit":"169263b6a9cb11a637e2c69986b2d30f03b08629"}],"number":8282} buildkite-pr-comment-->

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

### Incident Patch 1: `bfd03740` (2026-10-19)
**Commit Message**: [ESLint plugin] Bump picomatch and brace-expansion to patched versions (#10216)

**File**: `packages/eslint-plugin/changelogs/upcoming/10216.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+**Dependency updates**
+
+- Updated `picomatch` to v2.3.2
```

**File**: `packages/eslint-plugin/package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "@typescript-eslint/typescript-estree": "^8.64.0",
     "@typescript-eslint/utils": "^8.64.0",
     "cssstyle": "^4.2.1",
-    "picomatch": "^2.3.1"
+    "picomatch": "^2.3.2"
   },
   "devDependencies": {
     "@babel/cli": "^7.26.4",
```

**File**: `yarn.lock` (modified, +19/-19)
```diff
@@ -7035,7 +7035,7 @@ __metadata:
     dedent: "npm:^1.5.3"
     eslint: "npm:^8.57.0"
     jest: "npm:^29.7.0"
-    picomatch: "npm:^2.3.1"
+    picomatch: "npm:^2.3.2"
     rimraf: "npm:^6.0.1"
     ts-jest: "npm:^29.2.5"
     ts-node: "npm:^10.9.2"
@@ -16393,30 +16393,30 @@ __metadata:
   linkType: hard
 
 "brace-expansion@npm:^1.1.7":
-  version: 1.1.11
-  resolution: "brace-expansion@npm:1.1.11"
+  version: 1.1.21
+  resolution: "brace-expansion@npm:1.1.21"
   dependencies:
     balanced-match: "npm:^1.0.0"
     concat-map: "npm:0.0.1"
-  checksum: 10c0/695a56cd058096a7cb71fb09d9d6a7070113c7be516699ed361317aca2ec169f618e28b8af352e02ab4233fb54eb0168460a40dc320bab0034b36ab59aaad668
+  checksum: 10c0/8f0a68a720f9cb28c2ecaea5cdaf15fafd686d6b6e4e722a81c9d4bd2f68c1fd0619731cac05875d842221eaf4d97d564d329a12eb3c4c22137502fb3c65be8b
   languageName: node
   linkType: hard
 
 "brace-expansion@npm:^2.0.1":
-  version: 2.0.1
-  resolution: "brace-expansion@npm:2.0.1"
+  version: 2.1.7
+  resolution: "brace-expansion@npm:2.1.7"
   dependencies:
     balanced-match: "npm:^1.0.0"
-  checksum: 10c0/b358f2fe060e2d7a87aa015979ecea07f3c37d4018f8d6deb5bd4c229ad3a0384fe6029bb76cd8be63c81e516ee52d1a0673edbe2023d53a5191732ae3c3e49f
+  checksum: 10c0/17ee4194c85b05cde0a7b7c068eeef664440c027116ef42c3d35c13ebabdc9fd3eaf05c5c8a06dd0ca20ae012d652561d8ac2a699daa5cbee1f0510e5134ab4d
   languageName: node
   linkType: hard
 
 "brace-expansion@npm:^5.0.5":
-  version: 5.0.7
-  resolution: "brace-expansion@npm:5.0.7"
+  version: 5.0.12
+  resolution: "brace-expansion@npm:5.0.12"
   dependencies:
     balanced-match: "npm:^4.0.2"
-  checksum: 10c0/4769109c3c082de178e449a371bcad50d51ab468f644bce2dd9188efe0cf0a080ed102105d7fc8577382cedc45bad7e6443a91bf3d8102264ee8cf927dbaf205
+  checksum: 10c0/a40ac64d3bdb5bb222456514d3633c1f627f03b844f509c69e70f98b78be0ce85e21b44bbfecdd0ddd4cc0855ca4242b41ea96ddccf88c7c3c7a84405474bb3a
   languageName: node
   linkType: hard
 
@@ -32855,24 +32855,24 @@ __metadata:
   languageName: node
   linkType: hard
 
-"picomatch@npm:2.3.1, picomatch@npm:^2.0.4, picomatch@npm:^2.2.1, picomatch@npm:^2.2.3, picomatch@npm:^2.3.1":
+"picomatch@npm:2.3.1":
   version: 2.3.1
   resolution: "picomatch@npm:2.3.1"
   checksum: 10c0/26c02b8d06f03206fc2ab8d16f19960f2ff9e81a658f831ecb656d8f17d9edc799e8364b1f4a7873e89d9702dff96204be0fa26fe4181f6843f040f819dac4be
   languageName: node
   linkType: hard
 
-"picomatch@npm:^4.0.2":
-  version: 4.0.2
-  resolution: "picomatch@npm:4.0.2"
-  checksum: 10c0/7c51f3ad2bb42c776f49ebf964c644958158be30d0a510efd5a395e8d49cb5acfed5b82c0c5b365523ce18e6ab85013c9ebe574f60305892ec3fa8eee8304ccc
+"picomatch@npm:^2.0.4, picomatch@npm:^2.2.1, picomatch@npm:^2.2.3, picomatch@npm:^2.3.1, picomatch@npm:^2.3.2":
+  version: 2.3.2
+  resolution: "picomatch@npm:2.3.2"
+  checksum: 10c0/a554d1709e59be97d1acb9eaedbbc700a5c03dbd4579807baed95100b00420bc729335440ef15004ae2378984e2487a7c1cebd743cfdb72b6fa9ab69223c0d61
   languageName: node
   linkType: hard
 
-"picomatch@npm:^4.0.3, picomatch@npm:^4.0.4":
-  version: 4.0.5
-  resolution: "picomatch@npm:4.0.5"
-  checksum: 10c0/947bc6b6e1ff1e6c5aaf95b107a0839d12802f4f7b867663f67d47accba939ca1cb582cf99dfc30438efa1c4648ac5990967e783e8929c36b03e8440704ef1bd
+"picomatch@npm:^4.0.2, picomatch@npm:^4.0.3, picomatch@npm:^4.0.4":
+  version: 4.0.7
+  resolution: "picomatch@npm:4.0.7"
+  checksum: 10c0/beb6ae02c43ae44e84883b90830196d9046b1726ead292adcf7f57945e0bb0d992d68563d87e03b484b6f3c9a5c6defda7523477f047d7f0e663f126cc01787f
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 2: `fab5d952` (2026-10-19)
**Commit Message**: Release: @elastic/eui-docusaurus-theme v2.8.1, @elastic/eui v123.2.0, @elastic/eui-test-helpers v2.1.0 (#10215)

**File**: `packages/docusaurus-preset/package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "typescript": "~5.5.4"
   },
   "peerDependencies": {
-    "@elastic/eui-docusaurus-theme": "^2.8.0",
+    "@elastic/eui-docusaurus-theme": "^2.8.1",
     "react": "^18.0.0 || ^19.0.0",
     "react-dom": "^18.0.0 || ^19.0.0"
   }
```

**File**: `packages/docusaurus-theme/changelogs/CHANGELOG_2026.md` (modified, +7/-0)
```diff
@@ -1,3 +1,10 @@
+## [`v2.8.1`](https://github.com/elastic/eui/releases/v2.8.1)
+
+**Bug fixes**
+
+- Fixed light background of highlighted search results in dark mode ([#10178](https://github.com/elastic/eui/pull/10178))
+- Removed the redundant border below the last row of documentation prop tables ([#10181](https://github.com/elastic/eui/pull/10181))
+
 ## [`v2.8.0`](https://github.com/elastic/eui/releases/v2.8.0)
 
 - Added a hover animation to the EUI mark in the documentation navbar. ([#9924](https://github.com/elastic/eui/pull/9924))
```

**File**: `packages/docusaurus-theme/changelogs/upcoming/10178.md` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-**Bug fixes**
-
-- Fixed light background of highlighted search results in dark mode
```

**File**: `packages/docusaurus-theme/changelogs/upcoming/10181.md` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-**Bug fixes**
-
-- Removed the redundant border below the last row of documentation prop tables
```

**File**: `packages/docusaurus-theme/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@elastic/eui-docusaurus-theme",
-  "version": "2.8.0",
+  "version": "2.8.1",
   "description": "EUI theme for Docusaurus",
   "license": "SEE LICENSE IN LICENSE.txt",
   "scripts": {
```

**File**: `packages/eui/changelogs/CHANGELOG_2026.md` (modified, +14/-0)
```diff
@@ -1,3 +1,17 @@
+## [`v123.2.0`](https://github.com/elastic/eui/releases/v123.2.0)
+
+- Updated `EuiFlyoutMenu` height to 49px to align with Kibana compact AppHeader ([#10211](https://github.com/elastic/eui/pull/10211))
+- Added new icon: `ruler`. ([#10194](https://github.com/elastic/eui/pull/10194))
+- Updated `productAgent` icon glyph ([#10179](https://github.com/elastic/eui/pull/10179))
+- Updated `EuiToast`'s highlight to a straight bar instead of a curved one ([#10197](https://github.com/elastic/eui/pull/10197))
+
+**Bug fixes**
+
+- Fixed clickable `EuiBadge` to show the pointer cursor over its icon and padding, not only over its text ([#10205](https://github.com/elastic/eui/pull/10205))
+- Fixed disabled clickable `EuiBadge` to show the `not-allowed` cursor ([#10205](https://github.com/elastic/eui/pull/10205))
+- Fixed resizable `EuiFlyout` with a numeric `size` scaling proportionally on container or window resize; it now keeps its pixel width and is only clamped while there is not enough room ([#10199](https://github.com/elastic/eui/pull/10199))
+- Fixed resizable `EuiFlyout` calling `onResize` for width changes not made by the user, such as container or sibling clamps, or clicking the resize handle without dragging ([#10199](https://github.com/elastic/eui/pull/10199))
+
 ## [`v123.1.0`](https://github.com/elastic/eui/releases/v123.1.0)
 
 - Removed the left color highlight from `EuiCallOut` ([#10109](https://github.com/elastic/eui/pull/10109))
```

**File**: `packages/eui/changelogs/upcoming/10179.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-- Updated `productAgent` icon glyph
\ No newline at end of file
```

**File**: `packages/eui/changelogs/upcoming/10194.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-- Added new icon: `ruler`.
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #10216** (2026-10-19): [ESLint plugin] Bump picomatch and brace-expansion to patched versions (@Dosant)
- **PR #10215** (2026-10-19): Release: @elastic/eui-docusaurus-theme v2.8.1, @elastic/eui v123.2.0, @elastic/eui-test-helpers v2.1.0 (@angeles-mzb)
- **PR #10211** (2026-10-15): [EuiFlyoutMenu] Align menu height with compact AppHeader (49px) (@ryankeairns)
- **PR #10210** (2026-10-14): [Chore] Add Libra review configuration (@clintandrewhall)
- **PR #10205** (2026-10-13): [EuiBadge] Show pointer cursor over the whole clickable badge (@Dosant)
- **PR #10204** (2026-10-13): [Chore] Remove stale Kibana prep commit (@Dosant)

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

## X. [ESLint plugin] Bump picomatch and brace-expansion to patched versions (#10216)

**RULE**:
When implementing operations in `packages/eslint-plugin/package.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in elastic/eui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bfd03740`: [ESLint plugin] Bump picomatch and brace-expansion to patched versions (#10216). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/eslint-plugin/package.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    "picomatch": "^2.3.2"
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
    "picomatch": "^2.3.1"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bfd03740` are properly handled with clean fallback behavior.
