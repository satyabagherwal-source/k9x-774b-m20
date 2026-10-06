# Forensic Learning Record (Deep Inspection): elastic/eui

> **Canonical Artifact**: `07_PROJECT_LEARNING/elastic-eui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/elastic/eui](https://github.com/elastic/eui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:01:48.572Z  
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

### Core Architecture Module: `packages/eslint-plugin/src/utils/has_meaningful_attr.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { TSESTree } from '@typescript-eslint/utils';

/**
 * Checks whether a JSX opening element has an attribute whose value is
 * statically "meaningful" — present and not a statically-known empty/falsy
 * value (`""`, `{''}`, `{0}`, `{false}`, `{null}`, `{undefined}`).
 *
 * Dynamic or otherwise non-statically-analyzable values (variables, JSX,
 * template literals, calls, …) are treated as meaningful, since their runtime
 * value is unknown. Boolean shorthand (`<El attr />`) is also meaningful.
 *
 * Useful for rules that must distinguish an attribute that actually renders
 * something from one that is present but effectively empty.
 *
 * @param openingElement - The `JSXOpeningElement` node (ESTree).
 * @param attrName - The attribute name to look up.
 * @returns `true` if the attribute is present with a non-empty/non-falsy or
 * dynamic value; otherwise `false`.
 */
export function hasMeaningfulAttr(
  openingElement: TSESTree.JSXOpeningElement,
  attrName: string
): boolean {
  const attr = openingElement.attributes.find(
    (a): a is TSESTree.JSXAttribute =>
      a.type === 'JSXAttribute' &&
      a.name.type === 'JSXIdentifier' &&
      a.name.name === attrName
  );

  if (!attr) return false;

  // Boolean shorthand: `<El attr />` → present and truthy.
  if (attr.value == null) return true;

  // String literal: `attr="…"`.
  if (attr.value.type === 'Literal') {
    return Boolean(attr.value.value);
  }

  if (attr.value.type === 'JSXExpressionContainer') {
    const { expression } = attr.value;

    // Statically-known literals: `{''}`, `{0}`, `{false}`, `{null}`.
    if (expression.type === 'Literal') {
      return Boolean(expression.value);
    }

    // `{undefined}` (an identifier, not a literal).
    if (expression.type === 'Identifier' && expression.name === 'undefined') {
      return false;
    }
  }

  // Dynamic / unknown value → treat as present.
  return true;
}

```

### Core Architecture Module: `packages/eslint-plugin/src/utils/has_spread.ts`
```
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import type { TSESTree } from '@typescript-eslint/utils';

/**
 * Checks whether a JSX opening element contains a spread attribute
 * (e.g., `...props`). Spreads make it impossible to statically know
 * all props present on an element, so ESLint rules often use this as
 * a quick bail-out to avoid false positives.
 *
 * @param attrs - The attributes array from a `JSXOpeningElement` node (ESTree).
 * @returns `true` if any attribute is a `JSXSpreadAttribute`; otherwise `false`.
 */

export function hasSpread(
  attrs: TSESTree.JSXOpeningElement['attributes']
): boolean {
  return attrs.some((a) => a.type === 'JSXSpreadAttribute');
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10177** (2026-10-05): **Release: @elastic/eui v123.1.0**
  *Symptoms*: Packages to release:  - `@elastic/eui` - v123.0.0 → v123.1.0
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5790) * Commit: cd26c5e293329a51292741427feda11de551e70b * [Documentation website](https://eui.elastic.co/pr_10177/) * [Storybook](https://eui.elastic.co/pr_10177/storybook/) * :no_entry_sign: Visual regression tests skipped: Has 'skip-vrt' label   cc @mgadewoll  <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5790","number":5790,"commit":"cd26c5e293329a51292741427feda11de551e70b"}],"number":5790} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8211) * Commit: cd26c5e293329a51292741427feda11de551e70b  cc @mgadewoll  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8211","number":8211,"commit":"cd26c5e293329a51292741427feda11de551e70b"}],"number":8211} buildkite-pr-comment-->

- **Issue #10176** (2026-10-05): **Release: @elastic/eui v123.1.0**
  *Symptoms*: Packages to release:  - `@elastic/eui` - v123.0.0 → v123.1.0
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5788) * Commit: 956abf9fbcdff52f38b03cc699828b8ba375aaef * [Documentation website](https://eui.elastic.co/pr_10176/) * [Storybook](https://eui.elastic.co/pr_10176/storybook/) * :no_entry_sign: Visual regression tests skipped: Has 'skip-vrt' label   <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5788","number":5788,"commit":"956abf9fbcdff52f38b03cc699828b8ba375aaef"}],"number":5788} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8210) * Commit: 956abf9fbcdff52f38b03cc699828b8ba375aaef  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8210","number":8210,"commit":"956abf9fbcdff52f38b03cc699828b8ba375aaef"}],"number":8210} buildkite-pr-comment-->
  > ℹ️ Closed in favor of https://github.com/elastic/eui/pull/10177 to include additional changes.

- **Issue #10174** (2026-10-05): **[ESLint] Fix license header in EuiListItemLayout test**
  *Symptoms*: ## Summary  - **What:** Reworded the license header in `packages/eui/src/components/list_item_layout/_list_item_layout.test.tsx` so it matches the standard header used everywhere else in `packages/eui`. - **Why:** Fixes #10126, part of #8350. The file had a header, but its last two lines said "at your election, either the Elastic License 2.0 or the Server Side Public License, v 1", so `local/require-license-header` didn't match it and reported "File must start with a license header". - **How:** Comment-only change, no code touched.  ### API Changes  | component / parent | prop / child | change | description | | ------------------ | ------------ | ------ | ----------- | |                    |              |        |             |  None.  ## Screenshots  N/A, comment-only change.  ## Impact Assessment  - [ ] 🔴 **Breaking changes** — What will break? How many usages in Kibana/Cloud UI are impacted? - [ ] 💅 **Visual changes** — May impact style overrides; could require visual testing. Explain and estimate impact. - [ ] 🧪 **Test impact** — May break functional or snapshot tests (e.g., HTML structure, class names, default values). - [ ] 🔧 **Hard to integrate** — If changes require substantial updates to Kibana, please [stage the changes](https://github.com/elastic/eui/blob/main/wiki/contributing-to-eui/testing/testing-in-kibana.md#staging-integrations) and link them here.  **Impact level:** 🟢 None  ## Release Readiness  - [ ] ~~**Documentation:** {
  **Post-Mortem & Fix Analysis**:
  > <!-- CLA-CHECK:10174 --> &#x1F49A; CLA has been signed
  > 👋 Since this is a community submitted pull request, a Buildkite build has not been started automatically. Would an Elastic organization member please verify the contents of this pull request and kick off a build manually?
  > I've signed the Elastic Contributor Agreement. Could the CLA check be refreshed?

- **Issue #10126** (2026-10-05): **[ESLint] `require-license-header`**
  *Symptoms*: Part of https://github.com/elastic/eui/issues/8350  `local/require-license-header` — 1 warning.  `src/components/list_item_layout/_list_item_layout.test.tsx` is missing the Elastic license header used by the rest of `packages/eui`.
  **Post-Mortem & Fix Analysis**:
  > 👋 Thank you for your suggestion or request! While the EUI team agrees that it's valid, it's unlikely that we will prioritize this issue on our roadmap. We'll leave the issue open if you or anyone else in the community wants to implement it by contributing to EUI. If not, this issue will auto close in one year.
  > I'd like to pick this up. The header is already there, but its last two lines are worded a bit differently from the standard one ("at your election, either the..."), which is why the rule doesn't match it. I'll bring it in line with the rest of `packages/eui`. 

- **Issue #10112** (2026-10-05): **[Chore] Add missing release prep commits for #10109**
  *Symptoms*: - **What:** Adds missing commit entry in `kibana-prep-commits`. - **Why:** Follow-up to https://github.com/elastic/eui/pull/10109. - **How:** Adds missing prepared changes to the release automation file. The changes have been run in CI (🟢  [build](https://buildkite.com/elastic/kibana-pull-request/builds/515821))
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5771) * Commit: 1a1353dbbcca935eb45ab8e2526802aa9ac128dc * [Documentation website](https://eui.elastic.co/pr_10112/) * [Storybook](https://eui.elastic.co/pr_10112/storybook/) * :no_entry_sign: Visual regression tests skipped: No VRT-relevant paths changed   cc @mgadewoll  <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5771","number":5771,"commit":"1a1353dbbcca935eb45ab8e2526802aa9ac128dc"}],"number":5771} buildkite-pr-comment-->
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8199) * Commit: 1a1353dbbcca935eb45ab8e2526802aa9ac128dc  cc @mgadewoll  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8199","number":8199,"commit":"1a1353dbbcca935eb45ab8e2526802aa9ac128dc"}],"number":8199} buildkite-pr-comment-->

- **Issue #10111** (2026-10-05): **[EuiIcon] Adding 11 new icons**
  *Symptoms*: ## Summary  Added 11 new icons, including:  - `chartMix` - `chartWaffle` - `clipboardWarning` - `clockUp` - `emergencyLight` - `productCanvas` - `productElasticAgent` - `productFleet` - `productLens` - `puzzlePiece` - `shield`  Addresses needs in the following issues:  - https://github.com/elastic/eui/issues/9926 - https://github.com/elastic/kibana/issues/288151  CC @boriskirov, @julianrosado.  ## Screenshots  <!-- Useful for review and release notes -- most PRs should provide these. -->  <img width="1533" height="1131" alt="CleanShot 2026-10-02 at 5 19 11 PM" src="https://github.com/user-attachments/assets/849dfc5e-3693-4a06-ac5f-35db9116647d" />  <img width="113" height="88" alt="CleanShot 2026-10-02 at 5 19 29 PM" src="https://github.com/user-attachments/assets/f95fc206-3871-48a2-8055-1023233a34e7" />  ## Impact Assessment  - [ ] 🔴 **Breaking changes** — What will break? How many usages in Kibana/Cloud UI are impacted? - [x] 💅 **Visual changes** — May impact style overrides; could require visual testing. Explain and estimate impact. - [ ] 🧪 **Test impact** — May break functional or snapshot tests (e.g., HTML structure, class names, default values). - [ ] 🔧 **Hard to integrate** — If changes require substantial updates to Kibana, please [stage the changes](https://github.com/elastic/eui/blob/main/wiki/contributing-to-eui/testing/testing-in-kibana.md#staging-integrations) and link them here.  **Impact level:** 🟢 None  ## Release R
  **Post-Mortem & Fix Analysis**:
  > ## :camera: 1 visual difference(s) found  Look at the visual diff below. If everything is expected, run [Approve visual changes](https://buildkite.com/elastic/eui-deploy-docs/builds/5765) to update baselines, re-run the job or make appropriate fixes.  See the [visual regression testing](https://github.com/elastic/eui/blob/main/wiki/contributing-to-eui/testing/visual-regression-testing.md) wiki for more information.  <details> <summary>Expand to review</summary> <br>  <p><strong>euiicon</strong> (1 difference)</p> <table> <thead>   <tr><th>Story</th><th>Diff %</th><th>Before</th><th>After</th><th>Diff</th></tr> </thead> <tbody>   <tr>     <td><a href="https://eui.elastic.co/pr_10111/storybook/?path=/story/display-euiicon--all-icons">all icons</a> <code>desktop</code></td>     <td>13.41%</td>     <td><img src="https://eui.elastic.co/pr_10111/vrt-diff/display-euiicon--all-icons-desktop-before.png" width="180"/></td>     <td><img src="https://eui.elastic.co/pr_10111/vrt-diff/display-euiico
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5773) * Commit: ba668997aaac94c4bfae2f0ebd447365baf5f6b9 * [Documentation website](https://eui.elastic.co/pr_10111/) * [Storybook](https://eui.elastic.co/pr_10111/storybook/) * :white_check_mark: Visual regression tests passed   ### History * :broken_heart: [Build #5765](https://buildkite.com/elastic/eui-deploy-docs/builds/5765) failed fa5729cd40e2c68217f5b9e62bc112c5bfc7599d  <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5773","number":5773,"commit":"ba668997aaac94c4bfae2f0ebd447365baf5f6b9"},{"buildStatus":{"state":"failed","success":false,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5765","number":5765,"commit":"fa5729cd40e2c68217f5b9e62bc112c5bfc759
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8201) * Commit: ba668997aaac94c4bfae2f0ebd447365baf5f6b9  ### History * :green_heart: [Build #8194](https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8194) succeeded fa5729cd40e2c68217f5b9e62bc112c5bfc7599d  <!--buildkite-pr-comment-eui-pull-request-test-and-deploy {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8201","number":8201,"commit":"ba668997aaac94c4bfae2f0ebd447365baf5f6b9"},{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-pull-request-test-and-deploy/builds/8194","number":8194,"commit":"fa5729cd40e2c68217f5b9e62bc112c5bfc7599d"}],"number":8201} buildkite-pr-comment-->

- **Issue #10110** (2026-10-05): **Clarify capitalization guidance for nav/section labels**
  *Symptoms*: ## Summary  - **What:** Clarified the sentence-case default and when Title Case applies: for branded product, app, and feature names, while descriptive UI labels remain sentence case. Added the rationale and DO/DON’T examples using buttons and `EuiSideNav`. - **Why:** Address feedback that “capability” was ambiguous and that names should be distinguished from labels describing what a section contains. - **How:** Updated the language guidelines and examples in `packages/website/docs/content/language.mdx`. No runtime code changed.  ### API Changes  | component / parent | prop / child | change | description | | ------------------ | ------------ | ------ | ----------- | | — | — | None | No public EUI API changes |  ## Screenshots  <img width="1880" height="3434" alt="CleanShot 2026-10-02 at 13 05 01@2x" src="https://github.com/user-attachments/assets/25d93e89-5367-444e-84d6-df687fa035ee" />   ## Impact Assessment  - [ ] 🔴 **Breaking changes** - [x] 💅 **Visual changes** — Documentation examples only; no component styling changes. - [ ] 🧪 **Test impact** - [ ] 🔧 **Hard to integrate**  **Impact level:** 🟢 Low  ## Release Readiness  - [x] **Documentation:** `packages/website/docs/content/language.mdx` - Figma: Not applicable - Migration guide: Not applicable - Adoption plan: Not applicable  ### QA instructions for reviewer  Review the Language documentation page. Confirm the proper-name versus descriptive-label guidance is clear and the button 
  **Post-Mortem & Fix Analysis**:
  > ## :green_heart: Build Succeeded * [Buildkite Build](https://buildkite.com/elastic/eui-deploy-docs/builds/5781) * Commit: 775be1f7c07212e2fecde37f2701668d15fe0dbd * [Documentation website](https://eui.elastic.co/pr_10110/) * [Storybook](https://eui.elastic.co/pr_10110/storybook/) * :no_entry_sign: Visual regression tests skipped: No VRT-relevant paths changed   ### History * :green_heart: [Build #5758](https://buildkite.com/elastic/eui-deploy-docs/builds/5758) succeeded 7e6769bda6e06c52967ce6795d9c1e4365520b0b  <!--buildkite-pr-comment-eui-deploy-docs {"builds":[{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5781","number":5781,"commit":"775be1f7c07212e2fecde37f2701668d15fe0dbd"},{"buildStatus":{"state":"passed","success":true,"hasRetries":false,"hasNonPreemptionRetries":false},"url":"https://buildkite.com/elastic/eui-deploy-docs/builds/5758","number":5758,"commit":"7e6769bd

- **Issue #10109** (2026-10-02): **[EuiCallOut] Remove the left color highlight**
  *Symptoms*: ## Summary  Removes the left color stripe from `EuiCallOut`. With the larger panel radius, that highlight follows the corner and curves at both ends.  - Color still comes from the panel background, the 1px border, and the icon. - Custom icons keep the `borderStrong` color. - `EuiToast` is unchanged.  ## Screenshots  _Before_ <img width="1556" height="212" alt="CleanShot 2026-10-01 at 11 43 03@2x" src="https://github.com/user-attachments/assets/41bf67aa-d25b-4046-b946-231e880e488b" />  _After_ <img width="1868" height="202" alt="CleanShot 2026-10-01 at 11 44 34@2x" src="https://github.com/user-attachments/assets/4426e69d-198b-4e07-bd52-26a73631a0f3" />   ## Impact Assessment  - [x] 💅 **Visual changes** — Callouts no longer have the left color highlight. Background, border, and icon color are unchanged. - [x] 🧪 **Test impact** — Jest snapshots no longer include `--euiCallOutTypeColor`. Visual regression references for callout stories will need updating.  **Impact level:** 🟡 Moderate  ### Reviewer checklist  - [ ] Approved **Impact Assessment** — Acceptable to merge given the consumer impact. - [ ] Approved **Release Readiness** — Docs, Figma, and migration info are sufficient to ship.   Made with [Cursor](https://cursor.com)
  **Post-Mortem & Fix Analysis**:
  > ## :camera: 38 visual difference(s) found  Look at the visual diff below. If everything is expected, run [Approve visual changes](https://buildkite.com/elastic/eui-deploy-docs/builds/5750) to update baselines, re-run the job or make appropriate fixes.  See the [visual regression testing](https://github.com/elastic/eui/blob/main/wiki/contributing-to-eui/testing/visual-regression-testing.md) wiki for more information.  <details> <summary>Expand to review</summary> <br>  <p><strong>euicallout</strong> (18 differences)</p> <table> <thead>   <tr><th>Story</th><th>Diff %</th><th>Before</th><th>After</th><th>Diff</th></tr> </thead> <tbody>   <tr>     <td><a href="https://eui.elastic.co/pr_10109/storybook/?path=/story/display-euicallout--kitchen-sink-custom-children">kitchen sink custom children</a> <code>desktop</code></td>     <td>0.20%</td>     <td><img src="https://eui.elastic.co/pr_10109/vrt-diff/display-euicallout--kitchen-sink-custom-children-desktop-before.png" width="180"/></td>     <
  > ## :camera: 38 visual difference(s) found  Look at the visual diff below. If everything is expected, run [Approve visual changes](https://buildkite.com/elastic/eui-deploy-docs/builds/5751) to update baselines, re-run the job or make appropriate fixes.  See the [visual regression testing](https://github.com/elastic/eui/blob/main/wiki/contributing-to-eui/testing/visual-regression-testing.md) wiki for more information.  <details> <summary>Expand to review</summary> <br>  <p><strong>euicallout</strong> (18 differences)</p> <table> <thead>   <tr><th>Story</th><th>Diff %</th><th>Before</th><th>After</th><th>Diff</th></tr> </thead> <tbody>   <tr>     <td><a href="https://eui.elastic.co/pr_10109/storybook/?path=/story/display-euicallout--kitchen-sink-custom-children">kitchen sink custom children</a> <code>desktop</code></td>     <td>0.20%</td>     <td><img src="https://eui.elastic.co/pr_10109/vrt-diff/display-euicallout--kitchen-sink-custom-children-desktop-before.png" width="180"/></td>     <
  > ## :camera: 38 visual difference(s) found  Look at the visual diff below. If everything is expected, run [Approve visual changes](https://buildkite.com/elastic/eui-deploy-docs/builds/5755) to update baselines, re-run the job or make appropriate fixes.  See the [visual regression testing](https://github.com/elastic/eui/blob/main/wiki/contributing-to-eui/testing/visual-regression-testing.md) wiki for more information.  <details> <summary>Expand to review</summary> <br>  <p><strong>euicallout</strong> (18 differences)</p> <table> <thead>   <tr><th>Story</th><th>Diff %</th><th>Before</th><th>After</th><th>Diff</th></tr> </thead> <tbody>   <tr>     <td><a href="https://eui.elastic.co/pr_10109/storybook/?path=/story/display-euicallout--kitchen-sink-custom-children">kitchen sink custom children</a> <code>desktop</code></td>     <td>0.20%</td>     <td><img src="https://eui.elastic.co/pr_10109/vrt-diff/display-euicallout--kitchen-sink-custom-children-desktop-before.png" width="180"/></td>     <

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

### Incident Patch 1: `75d6437f` (2026-10-05)
**Commit Message**: [ESLint] Fix license header in EuiListItemLayout test (#10174)

**File**: `packages/eui/src/components/list_item_layout/_list_item_layout.test.tsx` (modified, +2/-2)
```diff
@@ -2,8 +2,8 @@
  * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
  * or more contributor license agreements. Licensed under the Elastic License
  * 2.0 and the Server Side Public License, v 1; you may not use this file except
- * in compliance with, at your election, either the Elastic License 2.0 or the
- * Server Side Public License, v 1.
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
  */
 
 import React from 'react';
```

---

### Incident Patch 2: `422cdf8c` (2026-10-05)
**Commit Message**: Release: @elastic/eui v123.1.0 (#10177)

**File**: `packages/eui/changelogs/CHANGELOG_2026.md` (modified, +15/-0)
```diff
@@ -1,3 +1,18 @@
+## [`v123.1.0`](https://github.com/elastic/eui/releases/v123.1.0)
+
+- Removed the left color highlight from `EuiCallOut` ([#10109](https://github.com/elastic/eui/pull/10109))
+- Updated Flyout menu height to 50px ([#10103](https://github.com/elastic/eui/pull/10103))
+- Added new icons: `chartMix`, `chartWaffle`, `clipboardWarning`, `clockUp`, `emergencyLight`, `productCanvas`, `productElasticAgent`, `productFleet`, `productLens`, `puzzlePiece`, `shield` ([#10111](https://github.com/elastic/eui/pull/10111))
+- Added `hasAriaDisabled` prop on `EuiSelectableListItem` and `type EuiSelectableOption` ([#10090](https://github.com/elastic/eui/pull/10090))
+- Added refs for `EuiFlyoutHeader`, `EuiFlyoutFooter`, and the outer `EuiFlyout` scroll container. ([#10105](https://github.com/elastic/eui/pull/10105))
+- Corrected `EuiFlyoutHeaderProps`, `EuiFlyoutFooterProps`, and `EuiFlyoutBodyProps` to describe component props instead of component types. ([#10105](https://github.com/elastic/eui/pull/10105))
+- Updated `EuiFormRow`'s `labelAppend` to render string content with an extra-small, subdued text style. ([#10067](https://github.com/elastic/eui/pull/10067))
+
+**Bug fixes**
+
+- Fixed a bug on `EuiSelectable` with `searchable={true}` that could result in an infinite loop if all search results are disabled ([#10090](https://github.com/elastic/eui/pull/10090))
+- Fixed `EuiSuperSelect` omitting the currently selected value from its accessible name when an `aria-label` or `aria-labelledby` was passed. External labels are now combined with the selected value instead of overriding it ([#10039](https://github.com/elastic/eui/pull/10039))
+
 ## [`v123.0.0`](https://github.com/elastic/eui/releases/v123.0.0)
 
 - Added `toolTipProps` to `EuiTextTruncate` to control where the full text tooltip opens, e.g. its `position` ([#10086](https://github.com/elastic/eui/pull/10086))
```

**File**: `packages/eui/changelogs/upcoming/10039.md` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-**Bug fixes**
-
-- Fixed `EuiSuperSelect` omitting the currently selected value from its accessible name when an `aria-label` or `aria-labelledby` was passed. External labels are now combined with the selected value instead of overriding it
```

**File**: `packages/eui/changelogs/upcoming/10067.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
- - Updated `EuiFormRow`'s `labelAppend` to render string content with an extra-small, subdued text style.
\ No newline at end of file
```

**File**: `packages/eui/changelogs/upcoming/10090.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
-- Added `hasAriaDisabled` prop on `EuiSelectableListItem` and `type EuiSelectableOption`
-
-**Bug fixes**
-
-- Fixed a bug on `EuiSelectable` with `searchable={true}` that could result in an infinite loop if all search results are disabled
\ No newline at end of file
```

**File**: `packages/eui/changelogs/upcoming/10103.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-- Updated Flyout menu height to 50px
\ No newline at end of file
```

**File**: `packages/eui/changelogs/upcoming/10105.md` (removed, +0/-2)
```diff
@@ -1,2 +0,0 @@
-- Added refs for `EuiFlyoutHeader`, `EuiFlyoutFooter`, and the outer `EuiFlyout` scroll container.
-- Corrected `EuiFlyoutHeaderProps`, `EuiFlyoutFooterProps`, and `EuiFlyoutBodyProps` to describe component props instead of component types.
```

**File**: `packages/eui/changelogs/upcoming/10109.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-- Removed the left color highlight from `EuiCallOut`
```

**File**: `packages/eui/changelogs/upcoming/10111.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-- Added new icons: `chartMix`, `chartWaffle`, `clipboardWarning`, `clockUp`, `emergencyLight`, `productCanvas`, `productElasticAgent`, `productFleet`, `productLens`, `puzzlePiece`, `shield`
\ No newline at end of file
```

---

### Incident Patch 3: `619f8ac1` (2026-10-05)
**Commit Message**: [EuiIcon] Adding 11 new icons (#10111)

Co-authored-by: kibanamachine <[REDACTED_EMAIL]>

**File**: `packages/eui/changelogs/upcoming/10111.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Added new icons: `chartMix`, `chartWaffle`, `clipboardWarning`, `clockUp`, `emergencyLight`, `productCanvas`, `productElasticAgent`, `productFleet`, `productLens`, `puzzlePiece`, `shield`
\ No newline at end of file
```

**File**: `packages/eui/src/components/icon/__snapshots__/icon.test.tsx.snap` (modified, +217/-0)
```diff
@@ -1853,6 +1853,26 @@ exports[`EuiIcon props type chartMetric is rendered 1`] = `
 </svg>
 `;
 
+exports[`EuiIcon props type chartMix is rendered 1`] = `
+<svg
+  class="euiIcon emotion-euiIcon-m-isLoaded"
+  data-icon-type="chartMix"
+  data-is-loaded="true"
+  height="16"
+  role="presentation"
+  viewBox="0 0 16 16"
+  width="16"
+  xmlns="http://www.w3.org/2000/svg"
+>
+  <path
+    d="M2 14h13v1H2a1 1 0 0 1-1-1V1h1z"
+  />
+  <path
+    d="M5 10a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1zm-1 2h1v-1H4zm5-4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm-1 4h1V9H8zm5-6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm-1 6h1V7h-1zM14.354 1.354 9.5 6.207l-2-2-4.146 4.147-.708-.708L7.5 2.793l2 2L13.647.646z"
+  />
+</svg>
+`;
+
 exports[`EuiIcon props type chartPie is rendered 1`] = `
 <svg
   class="euiIcon emotion-euiIcon-m-isLoaded"
@@ -1920,6 +1940,23 @@ exports[`EuiIcon props type chartThreshold is rendered 1`] = `
 </svg>
 `;
 
+exports[`EuiIcon props type chartWaffle is rendered 1`] = `
+<svg
+  class="euiIcon emotion-euiIcon-m-isLoaded"
+  data-icon-type="chartWaffle"
+  data-is-loaded="true"
+  height="16"
+  role="presentation"
+  viewBox="0 0 16 16"
+  width="16"
+  xmlns="http://www.w3.org/2000/svg"
+>
+  <path
+    d="M4.103 11.005A1 1 0 0 1 5 12v2l-.005.102A1 1 0 0 1 4 15H2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h2zM2 14h2v-2H2zm7.103-2.995A1 1 0 0 1 10 12v2l-.005.102A1 1 0 0 1 9 15H7a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h2zM7 14h2v-2H7zm7.103-2.995A1 1 0 0 1 15 12v2l-.005.102A1 1 0 0 1 14 15h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h2zM12 14h2v-2h-2zM4.103 6.005A1 1 0 0 1 5 7v2l-.005.103A1 1 0 0 1 4 10H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2zM2 9h2V7H2zm7.103-2.995A1 1 0 0 1 10 7v2l-.005.103A1 1 0 0 1 9 10H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2zM7 9h2V7H7zM14 9h-2V7h2zM4 4H2V2h2zm5 0H7V2h2zm5 0h-2V2h2z"
+  />
+</svg>
+`;
+
 exports[`EuiIcon props type chartWaterfall is rendered 1`] = `
 <svg
   class="euiIcon emotion-euiIcon-m-isLoaded"
@@ -2242,6 +2279,32 @@ exports[`EuiIcon props type clickRight is rendered 1`] = `
 </svg>
 `;
 
+exports[`EuiIcon props type clipboardWarning is rendered 1`] = `
+<svg
+  class="euiIcon emotion-euiIcon-m-isLoaded"
+  data-icon-type="clipboardWarning"
+  data-is-loaded="true"
+  height="16"
+  role="presentation"
+  viewBox="0 0 16 16"
+  width="16"
+  xmlns="http://www.w3.org/2000/svg"
+>
+  <path
+    d="M10.5 13a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1m.5-1h-1V9h1z"
+  />
+  <path
+    d="M10.5 6a1 1 0 0 1 .697.285l.025.025a1 1 0 0 1 .15.2l4.5 8A1 1 0 0 1 15 16H6a1 1 0 0 1-.871-1.49L8.79 8 9 7.627l.629-1.117.073-.113A1 1 0 0 1 10.5 6M6 15h9l-4.5-8z"
+  />
+  <path
+    d="M6 0c.74 0 1.385.403 1.73 1H9a1 1 0 0 1 1 1h1a1 1 0 0 1 1 1v2.68a2 2 0 0 0-1-.614V3h-1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3H1v11h3.268l-.011.02A2 2 0 0 0 4 15H1a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1-1h1.27C4.615.403 5.26 0 6 0m0 1a1 1 0 0 0-1 1H3v2h6V2H7a1 1 0 0 0-1-1"
+  />
+  <path
+    d="M5.393 12H3v-1h2.955zm1.125-2H3V9h4.08zm1.125-2H3V7h5.205z"
+  />
+</svg>
+`;
+
 exports[`EuiIcon props type clock is rendered 1`] = `
 <svg
   class="euiIcon emotion-euiIcon-m-isLoaded"
@@ -2309,6 +2372,29 @@ exports[`EuiIcon props type clockCounter is rendered 1`] = `
 </svg>
 `;
 
+exports[`EuiIcon props type clockUp is rendered 1`] = `
+<svg
+  class="euiIcon emotion-euiIcon-m-isLoaded"
+  data-icon-type="clockUp"
+  data-is-loaded="true"
+  height="16"
+  role="presentation"
+  viewBox="0 0 16 16"
+  width="16"
+  xmlns="http://www.w3.org/2000/svg"
+>
+  <path
+    d="m15.354 12.647-.707.707L13 11.707V16h-1v-4.293l-1.646 1.646-.708-.707L12.5 9.794z"
+  />
+  <path
+    d="M8 1a7 7 0 0 1 7 7c0 .858-.16 1.677-.442 2.437l-.79-.79a6 6 0 1 0-4.352 4.184l.807.806A7 7 0 1 1 8 1"
+  />
+  <path
+    d="M8.5 7.5H12v1H7.5V4h1z"
+  />
+</svg>
+`;
+
 exports[`EuiIcon props type cloud is rendered 1`] = `
 <svg
   class="euiIcon emotion-euiIcon-m-isLoaded"
@@ -3425,6 +3511,23 @@ exports[`EuiIcon props type ellipsis is rendered 1`] = `
 </svg>
 `;
 
+exports[`EuiIcon props type emergencyLight is rendered 1`] = `
+<svg
+  class="euiIcon emotion-euiIcon-m-isLoaded"
+  data-icon-type="emergencyLight"
+  data-is-loaded="true"
+  height="16"
+  role="presentation"
+  viewBox="0 0 16 16"
+  width="16"
+  xmlns="http://www.w3.org/2000/svg"
+>
+  <path
+    d="M8 4a5 5 0 0 1 5 5v3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1V9a5 5 0 0 1 5-5M3 14h10v-1H3zm5-9a4 4 0 0 0-4 4v3h3.5V9h1v3H12V9a4 4 0 0 0-4-4M15.186 5.438l-1.732 1-.5-.867 1.731-1zm-12.129.133-.5.866-1.733-1 .5-.866zm2.377-2.014-.867.5-1-1.733.867-.5zm7.008-1.234-1 1.733-.866-.5 1-1.733zM8.5 3h-1V1h1z"
+  />
+</svg>
+`;
+
 exports[`EuiIcon props type empty is rendered 1`] = `
 <svg
   class="euiIcon emotion-euiIcon-m-isLoaded"
@@ -9014,6 +9117,26 @@ exports[`EuiIcon props type productAgent is rendered 1`] = `
 </svg>
 `;
 
+exports[`EuiIcon props type productCanvas is rendered 1`] = `
+<svg
+  class="euiIcon emotion-euiIcon-m-isLoaded"
```

**File**: `packages/eui/src/components/icon/assets/chart_mix.tsx` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+// THIS IS A GENERATED FILE. DO NOT MODIFY MANUALLY. @see scripts/compile-icons.js
+
+import * as React from 'react';
+import type { SVGProps } from 'react';
+interface SVGRProps {
+  title?: string;
+  titleId?: string;
+}
+const EuiIconChartMix = ({
+  title,
+  titleId,
+  ...props
+}: SVGProps<SVGSVGElement> & SVGRProps) => (
+  <svg
+    xmlns="http://www.w3.org/2000/svg"
+    width={16}
+    height={16}
+    viewBox="0 0 16 16"
+    aria-labelledby={titleId}
+    {...props}
+  >
+    {title ? <title id={titleId}>{title}</title> : null}
+    <path d="M2 14h13v1H2a1 1 0 0 1-1-1V1h1z" />
+    <path d="M5 10a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1zm-1 2h1v-1H4zm5-4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm-1 4h1V9H8zm5-6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm-1 6h1V7h-1zM14.354 1.354 9.5 6.207l-2-2-4.146 4.147-.708-.708L7.5 2.793l2 2L13.647.646z" />
+  </svg>
+);
+export const icon = EuiIconChartMix;
```

**File**: `packages/eui/src/components/icon/assets/chart_waffle.tsx` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+// THIS IS A GENERATED FILE. DO NOT MODIFY MANUALLY. @see scripts/compile-icons.js
+
+import * as React from 'react';
+import type { SVGProps } from 'react';
+interface SVGRProps {
+  title?: string;
+  titleId?: string;
+}
+const EuiIconChartWaffle = ({
+  title,
+  titleId,
+  ...props
+}: SVGProps<SVGSVGElement> & SVGRProps) => (
+  <svg
+    xmlns="http://www.w3.org/2000/svg"
+    width={16}
+    height={16}
+    viewBox="0 0 16 16"
+    aria-labelledby={titleId}
+    {...props}
+  >
+    {title ? <title id={titleId}>{title}</title> : null}
+    <path d="M4.103 11.005A1 1 0 0 1 5 12v2l-.005.102A1 1 0 0 1 4 15H2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h2zM2 14h2v-2H2zm7.103-2.995A1 1 0 0 1 10 12v2l-.005.102A1 1 0 0 1 9 15H7a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h2zM7 14h2v-2H7zm7.103-2.995A1 1 0 0 1 15 12v2l-.005.102A1 1 0 0 1 14 15h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h2zM12 14h2v-2h-2zM4.103 6.005A1 1 0 0 1 5 7v2l-.005.103A1 1 0 0 1 4 10H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2zM2 9h2V7H2zm7.103-2.995A1 1 0 0 1 10 7v2l-.005.103A1 1 0 0 1 9 10H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2zM7 9h2V7H7zM14 9h-2V7h2zM4 4H2V2h2zm5 0H7V2h2zm5 0h-2V2h2z" />
+  </svg>
+);
+export const icon = EuiIconChartWaffle;
```

**File**: `packages/eui/src/components/icon/assets/clipboard_warning.tsx` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+// THIS IS A GENERATED FILE. DO NOT MODIFY MANUALLY. @see scripts/compile-icons.js
+
+import * as React from 'react';
+import type { SVGProps } from 'react';
+interface SVGRProps {
+  title?: string;
+  titleId?: string;
+}
+const EuiIconClipboardWarning = ({
+  title,
+  titleId,
+  ...props
+}: SVGProps<SVGSVGElement> & SVGRProps) => (
+  <svg
+    xmlns="http://www.w3.org/2000/svg"
+    width={16}
+    height={16}
+    viewBox="0 0 16 16"
+    aria-labelledby={titleId}
+    {...props}
+  >
+    {title ? <title id={titleId}>{title}</title> : null}
+    <path d="M10.5 13a.5.5 0 1 1 0 1 .5.5 0 0 1 0-1m.5-1h-1V9h1z" />
+    <path d="M10.5 6a1 1 0 0 1 .697.285l.025.025a1 1 0 0 1 .15.2l4.5 8A1 1 0 0 1 15 16H6a1 1 0 0 1-.871-1.49L8.79 8 9 7.627l.629-1.117.073-.113A1 1 0 0 1 10.5 6M6 15h9l-4.5-8z" />
+    <path d="M6 0c.74 0 1.385.403 1.73 1H9a1 1 0 0 1 1 1h1a1 1 0 0 1 1 1v2.68a2 2 0 0 0-1-.614V3h-1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3H1v11h3.268l-.011.02A2 2 0 0 0 4 15H1a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1-1h1.27C4.615.403 5.26 0 6 0m0 1a1 1 0 0 0-1 1H3v2h6V2H7a1 1 0 0 0-1-1" />
+    <path d="M5.393 12H3v-1h2.955zm1.125-2H3V9h4.08zm1.125-2H3V7h5.205z" />
+  </svg>
+);
+export const icon = EuiIconClipboardWarning;
```

**File**: `packages/eui/src/components/icon/assets/clock_up.tsx` (added, +36/-0)
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
+// THIS IS A GENERATED FILE. DO NOT MODIFY MANUALLY. @see scripts/compile-icons.js
+
+import * as React from 'react';
+import type { SVGProps } from 'react';
+interface SVGRProps {
+  title?: string;
+  titleId?: string;
+}
+const EuiIconClockUp = ({
+  title,
+  titleId,
+  ...props
+}: SVGProps<SVGSVGElement> & SVGRProps) => (
+  <svg
+    xmlns="http://www.w3.org/2000/svg"
+    width={16}
+    height={16}
+    viewBox="0 0 16 16"
+    aria-labelledby={titleId}
+    {...props}
+  >
+    {title ? <title id={titleId}>{title}</title> : null}
+    <path d="m15.354 12.647-.707.707L13 11.707V16h-1v-4.293l-1.646 1.646-.708-.707L12.5 9.794z" />
+    <path d="M8 1a7 7 0 0 1 7 7c0 .858-.16 1.677-.442 2.437l-.79-.79a6 6 0 1 0-4.352 4.184l.807.806A7 7 0 1 1 8 1" />
+    <path d="M8.5 7.5H12v1H7.5V4h1z" />
+  </svg>
+);
+export const icon = EuiIconClockUp;
```

**File**: `packages/eui/src/components/icon/assets/emergency_light.tsx` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+// THIS IS A GENERATED FILE. DO NOT MODIFY MANUALLY. @see scripts/compile-icons.js
+
+import * as React from 'react';
+import type { SVGProps } from 'react';
+interface SVGRProps {
+  title?: string;
+  titleId?: string;
+}
+const EuiIconEmergencyLight = ({
+  title,
+  titleId,
+  ...props
+}: SVGProps<SVGSVGElement> & SVGRProps) => (
+  <svg
+    xmlns="http://www.w3.org/2000/svg"
+    width={16}
+    height={16}
+    viewBox="0 0 16 16"
+    aria-labelledby={titleId}
+    {...props}
+  >
+    {title ? <title id={titleId}>{title}</title> : null}
+    <path d="M8 4a5 5 0 0 1 5 5v3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1V9a5 5 0 0 1 5-5M3 14h10v-1H3zm5-9a4 4 0 0 0-4 4v3h3.5V9h1v3H12V9a4 4 0 0 0-4-4M15.186 5.438l-1.732 1-.5-.867 1.731-1zm-12.129.133-.5.866-1.733-1 .5-.866zm2.377-2.014-.867.5-1-1.733.867-.5zm7.008-1.234-1 1.733-.866-.5 1-1.733zM8.5 3h-1V1h1z" />
+  </svg>
+);
+export const icon = EuiIconEmergencyLight;
```

**File**: `packages/eui/src/components/icon/assets/product_canvas.tsx` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+/*
+ * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
+ * or more contributor license agreements. Licensed under the Elastic License
+ * 2.0 and the Server Side Public License, v 1; you may not use this file except
+ * in compliance with, at your election, the Elastic License 2.0 or the Server
+ * Side Public License, v 1.
+ */
+
+// THIS IS A GENERATED FILE. DO NOT MODIFY MANUALLY. @see scripts/compile-icons.js
+
+import * as React from 'react';
+import type { SVGProps } from 'react';
+interface SVGRProps {
+  title?: string;
+  titleId?: string;
+}
+const EuiIconProductCanvas = ({
+  title,
+  titleId,
+  ...props
+}: SVGProps<SVGSVGElement> & SVGRProps) => (
+  <svg
+    xmlns="http://www.w3.org/2000/svg"
+    width={16}
+    height={16}
+    viewBox="0 0 16 16"
+    aria-labelledby={titleId}
+    {...props}
+  >
+    {title ? <title id={titleId}>{title}</title> : null}
+    <path d="M5 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4m0 1a1 1 0 1 0 1 1H5zM9 9H8V7h1zm2 0h-1V5h1zm2 0h-1V3h1zM5 4H3V3h2z" />
+    <path d="M9 0a1 1 0 0 1 1 1h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1.798l1.63 2.445A1 1 0 0 1 13 15h-1a1 1 0 0 1-.832-.445L10.132 13H5.868l-1.036 1.555A1 1 0 0 1 4 15H3a1 1 0 0 1-.832-1.555L3.798 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h4a1 1 0 0 1 1-1zM3 14h1l2-3H5zm9 0h1l-2-3h-1zm-5.465-2h2.93l-.666-1H7.2zM2 10h12V2h-4a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1H2zm5-9v1h2V1z" />
+  </svg>
+);
+export const icon = EuiIconProductCanvas;
```

---

### Incident Patch 4: `9213f218` (2026-10-05)
**Commit Message**: Clarify capitalization guidance for nav/section labels (#10110)

**File**: `packages/website/docs/content/language.mdx` (modified, +83/-6)
```diff
@@ -5,7 +5,10 @@ sidebar_position: 5
 import {
   EuiFlexGroup,
   EuiButton,
+  EuiSideNav,
   htmlIdGenerator,
+  EuiIcon,
+  EuiCallOut,
 } from '@elastic/eui';
 
 # Language
@@ -60,7 +63,30 @@ In American English, nouns that end with 'og' usually end with 'ogue' in British
 
 ## Case and capitalization
 
-Use **sentence case** by default. This goes for navigation menus, titles and headers, buttons, and so on.
+<EuiCallOut title="Use sentence case by default" color="primary">
+  This goes for navigation menus, titles and headers, buttons, and so on.
+</EuiCallOut>
+
+Use **sentence case** by default for UI copy, including actions, views, settings, section headers, and dialog titles. Sentence case is easier to read, even in headings, and helps branded names stand out. It also makes those names easier to recognize and preserve when localizing an interface. Title Case can feel more formal, so don't use it just to make a label look prominent.
+
+Reserve **Title Case** for proper names: branded products, apps, and features such as Entity Analytics and Machine Learning. A useful check is whether you'd refer to the item by that name in a product announcement, rather than using the words to describe what a section contains. For example, Stack management, GenAI settings, Budgets and notifications, API keys, and Trust management are descriptive labels, so use sentence case. Keep a proper name's established capitalization wherever it appears, and use sentence case for the surrounding words, as in "Open in Entity Analytics" or "Entity Analytics settings."
+
+Even with sentence case, make sure to capitalize the following terms and expressions:
+
+- [Branded terms](https://brand.elastic.co/302f66895/p/194a3b-writing-style-guide/t/159934) like solution and application names. For example, always write Elastic Observability, **not** elastic observability.
+- Acronyms, such as URL and API.
+
+Note that some names don't need to be capitalized when they're used as common names. For example, **Elastic Cloud Serverless** and **our serverless architecture** are both correct.
+
+| UI text | Casing | Why |
+| --- | --- | --- |
+| Entity Analytics | Title Case | Feature name |
+| Add data | Sentence case | Action, not a name |
+| Open in Entity Analytics | Sentence case, with the name unchanged | Sentence-case action containing a capability name |
+| Create Entity Analytics dashboard | Sentence case, with the name unchanged | "Entity Analytics" is a name; "dashboard" is generic |
+| Entity Analytics settings | Sentence case, with the name unchanged | "Settings" is a generic descriptor |
+| Add to case | Sentence case | "Case" is a generic object, not a name |
+| Open in Cases | Sentence case, with the name unchanged | "Cases" is the app name |
 
 <EuiFlexGroup>
 <Guideline type="do" text="Sentence case fits most situations.">
@@ -72,20 +98,71 @@ Use **sentence case** by default. This goes for navigation menus, titles and hea
 </Guideline>
 </EuiFlexGroup>
 
-Even with sentence case, make sure to capitalize the following terms and expressions:
+<EuiFlexGroup>
+<Guideline type="do" text="Use sentence case for actions and keep names capitalized.">
+  <EuiFlexGroup gutterSize="s">
+    <EuiButton fill>Add data</EuiButton>
+    <EuiButton>Open in Entity Analytics</EuiButton>
+  </EuiFlexGroup>
+</Guideline>
 
-- [Branded terms](https://brand.elastic.co/302f66895/p/194a3b-writing-style-guide/t/159934) like solution and application names. For example, always write Elastic Observability, **not** elastic observability.
-- Acronyms, such as URL and API.
+<Guideline type="dont" text="Don't use Title Case for actions or change a name's capitalization.">
+  <EuiFlexGroup gutterSize="s">
+    <EuiButton fill>Add Data</EuiButton>
+    <EuiButton>Open in entity analytics</EuiButton>
+  </EuiFlexGroup>
+</Guideline>
+</EuiFlexGroup>
 
-Note that some names don't need to be capitalized when they're used as common names. For example, **Elastic Cloud Serverless** and **our serverless architecture** are both correct.
+<EuiFlexGroup>
+<Guideline type="do" text="Use Title Case for the app name and sentence case for navigation labels.">
+  <EuiSideNav
+    mobileBreakpoints={[]}
+    aria-label="Entity Analytics navigation"
+    style={{ width: 220 }}
+    items={[
+      {
+        name: 'Entity Analytics',
+        id: htmlIdGenerator('entityAnalyticsDo')(),
+        icon: <EuiIcon type="logoElasticsearch" />,
+        items: [
+          { name: 'Overview', id: htmlIdGenerator('overviewDo')() , onClick: () => {}},
+          { name: 'Entities', id: htmlIdGenerator('entitiesDo')() , onClick: () => {}},
+          { name: 'Settings', id: htmlIdGenerator('settingsDo')() , onClick: () => {}},
+        ],
+      },
+    ]}
+  />
+</Guideline>
+
+<Guideline type="dont" text="Don't change the app name's capitalization or capitalize generic navigation labels as titles.">
+  <EuiSideNav
+    mobileBreakpoints={[]}
+    aria-label="Entity analytics navigation"
```

---

### Incident Patch 5: `06e5983b` (2026-10-05)
**Commit Message**: [Watch Mode] Simplify local EUI development in Kibana (#10071)

**File**: `package.json` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@
     "start": "printf $'\\x1b[K\\x1b[37;41mPlease run this script from the \\x1b[1;4mpackages/eui\\x1b[0m\\x1b[37;41m directory instead\\x1b[0m\\n'; exit 1",
     "build": "printf $'\\x1b[K\\x1b[37;41mPlease run this script from the \\x1b[1;4mpackages/eui\\x1b[0m\\x1b[37;41m directory instead\\x1b[0m\\n'; exit 1",
     "watch": "node scripts/watch-eui.js",
+    "watch:kibana": "node scripts/watch-kibana.js",
     "release": "node scripts/release",
     "release:prep": "bash scripts/release_prep.sh",
     "release:publish": "bash scripts/release_publish.sh",
```

**File**: `scripts/watch-eui.js` (modified, +14/-15)
```diff
@@ -90,7 +90,7 @@ const activePackages = selection.map((name) => {
     pendingChanges: new Map(),
     status: {
       activeProcess: null,
-      abortPending: false,
+      rebuildPending: false,
       resolvePromise: null,
       building: false,
       isInitial: kibanaEui,
@@ -227,8 +227,7 @@ function runBuild(pkg) {
   }
 
   if (pkg.status.activeProcess) {
-    pkg.status.abortPending = true;
-    pkg.status.activeProcess.kill('SIGTERM');
+    pkg.status.rebuildPending = true;
     return;
   }
 
@@ -243,21 +242,11 @@ function runBuild(pkg) {
   });
 
   pkg.status.activeProcess.on('close', async (code) => {
-    const wasAborted = pkg.status.abortPending;
+    const rebuildPending = pkg.status.rebuildPending;
     const resolveInitial = pkg.status.resolvePromise;
 
     pkg.status.activeProcess = null;
-    pkg.status.abortPending = false;
-    pkg.status.resolvePromise = null;
-
-    if (wasAborted) {
-      console.log(
-        chalk.yellow(`⚡ Build for ${pkg.name} cancelled. Restarting...`)
-      );
-
-      setTimeout(() => runBuild(pkg), RESTART_DELAY);
-      return;
-    }
+    pkg.status.rebuildPending = false;
 
     if (code === 0) {
       console.log(chalk.green(`✔ Built ${pkg.name} (${Date.now() - start}ms)`));
@@ -266,6 +255,15 @@ function runBuild(pkg) {
       console.log(chalk.red(`✘ Build failed [${pkg.name}]`));
     }
 
+    if (rebuildPending) {
+      console.log(
+        chalk.yellow(`⚡ Rebuilding ${pkg.name} with new changes...`)
+      );
+      setTimeout(() => runBuild(pkg), RESTART_DELAY);
+      return;
+    }
+
+    pkg.status.resolvePromise = null;
     if (resolveInitial) resolveInitial();
   });
 }
@@ -327,4 +325,5 @@ const IGNORED_FILES = [
   console.log(
     chalk.bold.green('\nWatcher is ready and listening for changes...')
   );
+  if (process.send) process.send('ready');
 })();
```

**File**: `scripts/watch-kibana.js` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+const { spawn } = require('child_process');
+const net = require('net');
+const path = require('path');
+const { parseArgs } = require('util');
+
+const { values: args } = parseArgs({
+  options: {
+    'kibana-dir': { type: 'string', short: 'd' },
+    package: { type: 'string', short: 'p' },
+  },
+});
+
+const EUI_ROOT = path.resolve(__dirname, '..');
+const KIBANA_ROOT = args['kibana-dir']
+  ? path.resolve(process.cwd(), args['kibana-dir'])
+  : path.resolve(__dirname, '../../kibana');
+const SHUTDOWN_TIMEOUT = 5000;
+
+const euiCommand = {
+  command: process.execPath,
+  args: [
+    path.join(EUI_ROOT, 'scripts/watch-eui.js'),
+    '--kibana-dir',
+    KIBANA_ROOT,
+    ...(args.package ? ['--package', args.package] : []),
+  ],
+  cwd: EUI_ROOT,
+};
+const kibanaCommands = [
+  {
+    name: 'Elasticsearch',
+    port: 9200,
+    command: 'pnpm',
+    args: ['es', 'snapshot', '--license', 'trial'],
+    cwd: KIBANA_ROOT,
+  },
+  {
+    name: 'Kibana',
+    port: 5601,
+    command: 'pnpm',
+    args: ['start', '--no-cache'],
+    cwd: KIBANA_ROOT,
+  },
+];
+
+const children = new Set();
+let exitCode = 0;
+let stopping = false;
+
+function isPortInUse(port) {
+  return new Promise((resolve) => {
+    const socket = net.createConnection({ host: '127.0.0.1', port });
+
+    socket.setTimeout(500);
+    socket.once('connect', () => {
+      socket.destroy();
+      resolve(true);
+    });
+    socket.once('error', () => resolve(false));
+    socket.once('timeout', () => {
+      socket.destroy();
+      resolve(false);
+    });
+  });
+}
+
+function stopChild(child, signal = 'SIGINT') {
+  if (!child.pid || child.exitCode !== null || child.signalCode !== null)
+    return;
+
+  if (process.platform === 'win32') {
+    child.kill(signal);
+    return;
+  }
+
+  try {
+    process.kill(-child.pid, signal);
+  } catch (error) {
+    if (error.code !== 'ESRCH') throw error;
+  }
+}
+
+function stop(code = 0) {
+  if (stopping) return;
+  stopping = true;
+  exitCode = code;
+
+  children.forEach((child) => stopChild(child));
+
+  const timeout = setTimeout(() => {
+    children.forEach((child) => stopChild(child, 'SIGKILL'));
+    process.exit(exitCode);
+  }, SHUTDOWN_TIMEOUT);
+  timeout.unref();
+}
+
+function startChild({ command, args, cwd }, stdio = 'inherit') {
+  const child = spawn(command, args, {
+    cwd,
+    detached: process.platform !== 'win32',
+    stdio,
+  });
+  children.add(child);
+
+  child.on('error', (error) => {
+    console.error(error.message);
+    stop(1);
+  });
+
+  child.on('close', (code) => {
+    children.delete(child);
+    if (!stopping) stop(code || 1);
+    if (stopping && children.size === 0) process.exit(exitCode);
+  });
+
+  return child;
+}
+
+async function startKibanaProcesses() {
+  for (const command of kibanaCommands) {
+    if (command.port && (await isPortInUse(command.port))) {
+      console.log(
+        `${command.name} is already running on port ${command.port}, not starting it`
+      );
+    } else {
+      startChild(command);
+    }
+  }
+}
+
+const euiWatcher = startChild(euiCommand, [
+  'inherit',
+  'inherit',
+  'inherit',
+  'ipc',
+]);
+euiWatcher.once('message', (message) => {
+  if (message === 'ready' && !stopping) {
+    startKibanaProcesses();
+  }
+});
+
+process.once('SIGINT', () => stop());
+process.once('SIGTERM', () => stop());
```

**File**: `wiki/contributing-to-eui/developing/developing-in-kibana.md` (modified, +17/-63)
```diff
@@ -32,70 +32,34 @@ This guide explains how to develop EUI library locally while seeing changes refl
 
 ## Usage
 
-### In Kibana
+### Start Kibana from EUI
 
-In the [Kibana](https://github.com/elastic/kibana) repository root, open terminal and start Elasticsearch:
+In the **EUI** repository root, run the Kibana processes in one terminal:
 
 ```bash
-pnpm es snapshot --license trial
+yarn watch:kibana
 ```
 
-Then, run the `@kbn/ui-shared-deps-npm` watcher:
+This starts the EUI watcher, then starts Elasticsearch and Kibana after the initial EUI build. Kibana's Rspack MultiCompiler watches the synced EUI output and rebuilds the affected shared and Kibana bundles. Press `Ctrl+C` to stop all managed processes.
 
-```bash
-npx moon run @kbn/ui-shared-deps-npm:watch-webpack
-```
+If Elasticsearch already uses port `9200`, or Kibana uses port `5601`, the corresponding process is not started.
 
-Finally, run the Kibana server:
+If your Kibana directory is located elsewhere:
 
 ```bash
-pnpm start --no-cache
-```
-
-### In EUI
-
-In the **EUI** repository root, run:
-
-```bash
-# Watch all packages and sync to Kibana
-yarn watch --kibana
+yarn watch:kibana --kibana-dir=/path/to/kibana
 # Shortcut:
-yarn watch -k
+yarn watch:kibana -d /path/to/kibana
 ```
 
-or if you want to watch a specific EUI package run:
+To watch only one EUI package:
 
 ```bash
-# Watch only @elastic/eui
-yarn watch --kibana --package @elastic/eui
-# Shortcuts:
-yarn watch -k -p @elastic/eui
-
-# Watch only @elastic/eui-theme-borealis
-yarn watch --kibana --package @elastic/eui-theme-borealis
-# Shortcuts:
-yarn watch -k -p @elastic/eui-theme-borealis
-
-# Watch only @elastic/eui-theme-common
-yarn watch --kibana --package @elastic/eui-theme-common
-# Shortcuts:
-yarn watch -k -p @elastic/eui-theme-common
-```
-
-If your Kibana directory is located elsewhere, you can configure the directory path:
-
-```bash
-yarn watch --kibana-dir=/path/to/kibana
+yarn watch:kibana --package @elastic/eui
 # Shortcut:
-yarn watch -d /path/to/kibana
+yarn watch:kibana -p @elastic/eui
 ```
 
-These commands will:
-
-1. Watch for changes in the selected package(s).
-2. Compile the changed package(s). With `--kibana`, `@elastic/eui` initially compiles `optimize/es` only (Kibana's alias), then incrementally compiles changed files.
-3. Sync the build artifacts into the Kibana directory, by default: `../kibana/node_modules`.
-
 ## How it works
 
 The integration relies on a chain of file watchers and build triggers to propagate changes from EUI source code to the browser running Kibana.
@@ -105,9 +69,8 @@ The integration relies on a chain of file watchers and build triggers to propaga
 1. The script watches `src` directories using `chokidar`.
 2. With `--kibana`, `@elastic/eui` runs one complete `build:optimize-es`, then Babel-compiles only changed source files. Changed JSON and SVG files are copied directly.
 3. `@elastic/eui` syncs only changed `optimize/es` files into Kibana's `node_modules` and touches `package.json` once per batch. Theme packages still rebuild and copy their full `files` list.
-4. Webpack detects the change and rebuilds `@kbn/ui-shared-deps-npm.dll.js`.
-5. The `@kbn/cli-dev-mode` detects the new DLL and restarts the **Optimizer**.
-6. When the optimizer has rebuilt all plugins, the browser window can be refreshed.
+4. Kibana's Rspack MultiCompiler detects the change and rebuilds shared dependencies before rebuilding Kibana.
+5. When Rspack has rebuilt, the browser reloads.
 
 ### Architecture diagram
 
@@ -123,27 +86,18 @@ flowchart TD
 
     %% Kibana
     subgraph Kibana [Kibana repository]
-        NodeModules --> |Detect| Webpack(Shared deps DLL)
-        Webpack --> |Update| Manifest(DLL Manifest)
-        Manifest --> |Watch| CLI(Dev Mode CLI)
-        CLI --> |Restart| Optimizer(Optimizer)
+        NodeModules --> |Detect| Rspack(Rspack MultiCompiler)
     end
 
-    Optimizer --> Browser((Update in the browser))
+    Rspack --> |Build shared deps and Kibana| Browser((Update in the browser))
 ```
 
 ## Troubleshooting
 
 - **Change not showing up?**
 
-Check the terminal output of the EUI watcher. If the `node_modules` propagation succeeded, check the Kibana terminal for "restarting optimizer". Ensure the `--kibana` (or `-k`) flag is present.
+Check the terminal output of the EUI watcher. If the `node_modules` propagation succeeded, check the Kibana terminal for Rspack rebuild output. Ensure you started the workflow with `yarn watch:kibana`.
 
 - **Slow feedback loop?**
 
-With `--kibana`, `@elastic/eui` skips `lib/`, `es/`, types, and the rest of the package build. After the initial `optimize/es` build, only changed files are compiled. Most of the remaining feedback time is Kibana's DLL and optimizer.
-
-`yarn watch` without `--kibana`, and theme packages, still run a full build. For those, you can omit generating type declaration files:
-
-```bash
-yarn watch --no-declarations
-```
+For `@elastic/eui`, the watcher skips `lib/`, `es/`
```

---

### Incident Patch 6: `8be2ac95` (2026-10-05)
**Commit Message**: [EuiSelectable] Support `hasAriaDisabled` prop on options (#10090)

Co-authored-by: kibanamachine <[REDACTED_EMAIL]>

**File**: `packages/eui/changelogs/upcoming/10090.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+- Added `hasAriaDisabled` prop on `EuiSelectableListItem` and `type EuiSelectableOption`
+
+**Bug fixes**
+
+- Fixed a bug on `EuiSelectable` with `searchable={true}` that could result in an infinite loop if all search results are disabled
\ No newline at end of file
```

**File**: `packages/eui/src/components/list_item_layout/_list_item_layout.styles.ts` (modified, +37/-23)
```diff
@@ -16,6 +16,10 @@ import {
   logicalCSS,
 } from '../../global_styling';
 
+// uses `aria-disabled` only as not all variants can have a native `:disabled` state
+const notDisabledSelector = `&:not([aria-disabled="true"])`;
+const ariaDisabledSelector = `&[aria-disabled="true"]`;
+
 export const euiListItemVariables = ({ euiTheme }: UseEuiTheme) => {
   const spacing = {
     horizontal: euiTheme.size.s,
@@ -56,29 +60,25 @@ export const euiListItemLayoutStyles = (euiThemeContext: UseEuiTheme) => {
 
   const { spacing, textPadding } = euiListItemVariables(euiThemeContext);
 
-  // uses `aria-disabled` only as not all variants can have a native `:disabled` state
-  const notDisabledSelector = `&:not([aria-disabled="true"])`;
   const sharedFlexStyles = `
     display: flex;
     align-items: center;
     flex-shrink: 0;
   `;
   const highlightedStyles = `
-    ${notDisabledSelector} {
-      background-color: ${euiTheme.colors.backgroundBaseInteractiveHover};
-
-      ${highContrastModeStyles(euiThemeContext, {
-        preferred: `
-          text-decoration: underline;
-
-          &:not(:focus, :focus-visible) {
-            /* uses outline to prevent layout jumps between navigated items */
-            outline: ${euiTheme.border.width.thin} solid ${euiTheme.colors.borderBasePlain};
-            outline-offset: -${euiTheme.border.width.thin};
-          }
-        `,
-      })}
-    }
+    background-color: ${euiTheme.colors.backgroundBaseInteractiveHover};
+
+    ${highContrastModeStyles(euiThemeContext, {
+      preferred: `
+        text-decoration: underline;
+
+        &:not(:focus, :focus-visible) {
+          /* uses outline to prevent layout jumps between navigated items */
+          outline: ${euiTheme.border.width.thin} solid ${euiTheme.colors.borderBasePlain};
+          outline-offset: -${euiTheme.border.width.thin};
+        }
+      `,
+    })}
   `;
 
   return {
@@ -142,7 +142,10 @@ export const euiListItemLayoutStyles = (euiThemeContext: UseEuiTheme) => {
     isDisabled: css`
       color: ${euiTheme.colors.textDisabled};
       cursor: not-allowed;
-      background-color: transparent;
+
+      ${notDisabledSelector} {
+        background-color: transparent;
+      }
     `,
     buttonIsDisabled: css`
       /* prevent user (mouse) interactions for custom disabled buttons.
@@ -160,21 +163,28 @@ export const euiListItemLayoutStyles = (euiThemeContext: UseEuiTheme) => {
     `,
     isSelected: css`
       color: ${euiTheme.colors.textPrimary};
-      background-color: ${euiTheme.colors.backgroundBaseInteractiveSelect};
 
       ${notDisabledSelector} {
+        background-color: ${euiTheme.colors.backgroundBaseInteractiveSelect};
+
         &:hover {
           background-color: ${euiTheme.colors
             .backgroundBaseInteractiveSelectHover};
         }
-      }
 
-      ${highContrastModeStyles(euiThemeContext, {
-        preferred: `
+        ${highContrastModeStyles(euiThemeContext, {
+          preferred: `
           outline: ${euiTheme.border.width.thin} solid ${euiTheme.colors.borderStrongPrimary};
           outline-offset: -${euiTheme.border.width.thin};
         `,
-      })}
+        })}
+      }
+
+      &${ariaDisabledSelector} {
+        &:hover {
+          background-color: ${euiTheme.colors.backgroundBaseInteractiveHover};
+        }
+      }
 
       .euiIcon,
       .euiButtonIcon {
@@ -193,6 +203,10 @@ export const euiListItemLayoutStyles = (euiThemeContext: UseEuiTheme) => {
         background-color: ${euiTheme.colors
           .backgroundBaseInteractiveSelectHover};
       }
+
+      &${ariaDisabledSelector} {
+        background-color: ${euiTheme.colors.backgroundBaseInteractiveHover};
+      }
     `,
     tooltip: {
       isDisabled: css`
```

**File**: `packages/eui/src/components/list_item_layout/_list_item_layout.tsx` (modified, +3/-2)
```diff
@@ -331,6 +331,7 @@ export const EuiListItemLayout = forwardRef<
     const classes = classNames('euiListItemLayout', className);
     const wrapperStyles = useEuiMemoizedStyles(euiListItemLayoutWrapperStyles);
     const styles = useEuiMemoizedStyles(euiListItemLayoutStyles);
+    const canHaveInteractiveStyles = !isDisabled || hasAriaDisabled;
 
     const interactiveStyles = [
       isInteractive && styles.isInteractive,
@@ -345,14 +346,14 @@ export const EuiListItemLayout = forwardRef<
     const wrapperCssStyles = [
       wrapperStyles.euiListItemLayout__wrapper,
       extraAction && wrapperStyles.hasExtraAction,
-      !isDisabled && hasWrapper && interactiveStyles,
+      canHaveInteractiveStyles && hasWrapper && interactiveStyles,
       hasWrapper && css,
       isDisabled && hasWrapper && styles.isDisabled,
     ];
     const cssStyles = [
       styles.euiListItemLayout,
       hasWrapper && styles.euiListItemLayout__action,
-      !isDisabled && !hasWrapper && interactiveStyles,
+      canHaveInteractiveStyles && !hasWrapper && interactiveStyles,
       !hasWrapper && css,
       isDisabled && styles.isDisabled,
       hasAriaDisabled &&
```

**File**: `packages/eui/src/components/selectable/selectable.spec.tsx` (modified, +71/-0)
```diff
@@ -442,6 +442,77 @@ describe('EuiSelectable', () => {
     });
   });
 
+  describe('hasAriaDisabled', () => {
+    const ariaDisabledOptions: EuiSelectableProps['options'] = [
+      { label: 'Normal option' },
+      { label: 'Plain disabled', disabled: true },
+      {
+        label: 'Aria disabled',
+        disabled: true,
+        hasAriaDisabled: true,
+        toolTipContent: 'This option is disabled',
+      },
+    ];
+
+    it('navigates hasAriaDisabled options but skips native disabled options', () => {
+      cy.realMount(
+        <EuiSelectableWithSearchInput options={ariaDisabledOptions}>
+          {(list) => <>{list}</>}
+        </EuiSelectableWithSearchInput>
+      );
+
+      cy.get('input').realClick();
+      cy.realPress('ArrowDown');
+      cy.get('li[role=option]')
+        .eq(0)
+        .should('have.class', 'euiSelectableListItem-isFocused');
+
+      cy.realPress('ArrowDown');
+      cy.get('li[role=option]')
+        .eq(1)
+        .should('not.have.class', 'euiSelectableListItem-isFocused');
+      cy.get('li[role=option]')
+        .eq(2)
+        .should('have.class', 'euiSelectableListItem-isFocused');
+    });
+
+    it('does not select a hasAriaDisabled option on Enter', () => {
+      const onChange = cy.stub();
+      cy.realMount(
+        <EuiSelectableWithSearchInput
+          options={ariaDisabledOptions}
+          onChange={onChange}
+        >
+          {(list) => <>{list}</>}
+        </EuiSelectableWithSearchInput>
+      );
+
+      cy.get('input').realClick();
+      cy.realPress('ArrowDown');
+      cy.realPress('ArrowDown');
+      cy.realPress('Enter').then(() => {
+        expect(onChange).not.to.have.been.called;
+      });
+    });
+
+    it('shows a tooltip when focusing a hasAriaDisabled option', () => {
+      cy.realMount(
+        <EuiSelectableWithSearchInput options={ariaDisabledOptions}>
+          {(list) => <>{list}</>}
+        </EuiSelectableWithSearchInput>
+      );
+
+      cy.get('input').realClick();
+      cy.realPress('ArrowDown');
+      cy.realPress('ArrowDown');
+
+      cy.get('[role="tooltip"]').should(
+        'contain.text',
+        'This option is disabled'
+      );
+    });
+  });
+
   describe('nested in `EuiPopover` component', () => {
     const EuiSelectableNested = () => {
       const [isPopoverOpen, setIsPopoverOpen] = useState(false);
```

**File**: `packages/eui/src/components/selectable/selectable.stories.tsx` (modified, +30/-1)
```diff
@@ -139,7 +139,7 @@ export const SingleSelection: Story = {
 export const WithTooltip: Story = {
   parameters: {
     controls: {
-      include: ['options', 'singleSelection', 'searchable'],
+      include: ['options', 'singleSelection', 'searchable', 'onChange'],
     },
     vrt: { selector: VRT_SELECTORS.portal },
   },
@@ -163,6 +163,35 @@ export const WithTooltip: Story = {
   }),
 };
 
+export const DisabledWithTooltip: Story = {
+  parameters: {
+    controls: {
+      include: ['options', 'singleSelection', 'searchable', 'onChange'],
+    },
+    vrt: { selector: VRT_SELECTORS.portal },
+  },
+  args: {
+    searchable: true,
+    options: options.map((option, idx) => ({
+      ...option,
+      checked: idx === 1 ? 'on' : option.checked,
+      hasAriaDisabled: option.disabled,
+      ...toolTipProps,
+      value: idx,
+    })),
+  },
+  render: ({ ...args }: EuiSelectableProps) => <StatefulSelectable {...args} />,
+  play: playDecorator(async ({ bodyElement }) => {
+    const body = within(bodyElement);
+    const options = body.getAllByRole('option');
+    const tooltipTarget = (options[1].firstElementChild ??
+      options[1]) as HTMLElement;
+
+    await userEvent.hover(tooltipTarget, { pointerEventsCheck: 0 });
+    await body.findByRole('tooltip');
+  }),
+};
+
 export const WithSearchAndGroups: Story = {
   args: {
     searchable: true,
```

**File**: `packages/eui/src/components/selectable/selectable.tsx` (modified, +25/-5)
```diff
@@ -372,15 +372,19 @@ export class EuiSelectable<T = {}> extends Component<
     }
 
     const firstSelected = this.state.visibleOptions.findIndex(
-      (option) => option.checked && !option.disabled && !option.isGroupLabel
+      (option) =>
+        option.checked &&
+        (!option.disabled || option.hasAriaDisabled) &&
+        !option.isGroupLabel
     );
 
     if (firstSelected > -1) {
       this.setState({ activeOptionIndex: firstSelected, isFocused: true });
     } else {
       this.setState({
         activeOptionIndex: this.state.visibleOptions.findIndex(
-          (option) => !option.disabled && !option.isGroupLabel
+          (option) =>
+            (!option.disabled || option.hasAriaDisabled) && !option.isGroupLabel
         ),
         isFocused: true,
       });
@@ -472,9 +476,12 @@ export class EuiSelectable<T = {}> extends Component<
 
       // Group titles and disabled options are included in option list but are not selectable
       const direction = amount > 0 ? 1 : -1;
+      const startIndex = nextActiveOptionIndex;
+
       while (
         visibleOptions[nextActiveOptionIndex].isGroupLabel ||
-        visibleOptions[nextActiveOptionIndex].disabled
+        (visibleOptions[nextActiveOptionIndex].disabled &&
+          !visibleOptions[nextActiveOptionIndex].hasAriaDisabled)
       ) {
         nextActiveOptionIndex = nextActiveOptionIndex + direction;
 
@@ -483,9 +490,22 @@ export class EuiSelectable<T = {}> extends Component<
         } else if (nextActiveOptionIndex === visibleOptions.length) {
           nextActiveOptionIndex = 0;
         }
+
+        // break on single options to prevent an infinite loop if no options are selectable
+        if (nextActiveOptionIndex === startIndex) {
+          break;
+        }
       }
 
-      return { activeOptionIndex: nextActiveOptionIndex };
+      // If the final index is also non-navigable, keep the current position
+      const finalOption = visibleOptions[nextActiveOptionIndex];
+      const finalActiveOptionIndex =
+        finalOption.isGroupLabel ||
+        (finalOption.disabled && !finalOption.hasAriaDisabled)
+          ? activeOptionIndex
+          : nextActiveOptionIndex;
+
+      return { activeOptionIndex: finalActiveOptionIndex };
     });
   };
 
@@ -788,7 +808,7 @@ export class EuiSelectable<T = {}> extends Component<
     ) : undefined;
 
     const resultsLength = visibleOptions.filter(
-      (option) => !option.disabled
+      (option) => !option.disabled || option.hasAriaDisabled
     ).length;
 
     const listAriaDescribedbyId = this.rootId('instructions');
```

**File**: `packages/eui/src/components/selectable/selectable_list/selectable_list.tsx` (modified, +2/-0)
```diff
@@ -415,6 +415,7 @@ export class EuiSelectableList<T> extends Component<
       isGroupLabel,
       checked,
       disabled,
+      hasAriaDisabled,
       prepend,
       append,
       ref,
@@ -507,6 +508,7 @@ export class EuiSelectableList<T> extends Component<
         }
         checked={checked}
         disabled={disabled}
+        hasAriaDisabled={hasAriaDisabled}
         prepend={prepend}
         append={append}
         aria-posinset={this.state.ariaPosInSetMap[index]}
```

**File**: `packages/eui/src/components/selectable/selectable_list/selectable_list_item.test.tsx` (modified, +46/-0)
```diff
@@ -162,6 +162,52 @@ describe('EuiSelectableListItem', () => {
       expect(container.firstChild).toMatchSnapshot();
     });
 
+    describe('hasAriaDisabled', () => {
+      it('renders as aria-disabled instead of native disabled', () => {
+        const { getByRole } = render(
+          <EuiSelectableListItem disabled hasAriaDisabled />
+        );
+
+        const option = getByRole('option');
+        expect(option).toHaveAttribute('aria-disabled', 'true');
+        expect(option).not.toHaveAttribute('disabled');
+      });
+
+      it('shows tooltip on hover when disabled', () => {
+        const { baseElement, getByTestSubject } = render(
+          <EuiSelectableListItem
+            disabled
+            hasAriaDisabled
+            toolTipContent="Disabled reason"
+            toolTipProps={{ 'data-test-subj': 'disabledTooltip' }}
+          >
+            Item content
+          </EuiSelectableListItem>
+        );
+
+        const tooltipAnchor = baseElement.querySelector('.euiToolTipAnchor');
+        fireEvent.mouseOver(tooltipAnchor!);
+
+        expect(getByTestSubject('disabledTooltip')).toBeInTheDocument();
+      });
+
+      it('shows tooltip when disabled and isFocused', () => {
+        const { getByTestSubject } = render(
+          <EuiSelectableListItem
+            disabled
+            hasAriaDisabled
+            isFocused
+            toolTipContent="Disabled reason"
+            toolTipProps={{ 'data-test-subj': 'disabledTooltip' }}
+          >
+            Item content
+          </EuiSelectableListItem>
+        );
+
+        expect(getByTestSubject('disabledTooltip')).toBeInTheDocument();
+      });
+    });
+
     test('prepend', () => {
       const { container } = render(
         <EuiSelectableListItem prepend={<span />} />
```

---

### Incident Patch 7: `7d763f0f` (2026-10-02)
**Commit Message**: [EuiCallOut] Remove the left color highlight (#10109)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `packages/eui/changelogs/upcoming/10109.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Removed the left color highlight from `EuiCallOut`
```

**File**: `packages/eui/src/components/call_out/__snapshots__/call_out.test.tsx.snap` (modified, +0/-8)
```diff
@@ -6,7 +6,6 @@ exports[`EuiCallOut is rendered 1`] = `
   class="euiPanel euiPanel--primary euiCallOut euiCallOut--primary testClass1 testClass2 emotion-euiPanel-none-primary-euiCallOut-primary-euiTestCss"
   data-size="m"
   data-test-subj="test subject string"
-  style="--euiCallOutTypeColor: #0B64DD;"
 >
   <div
     class="css-1slkmya-wrapper"
@@ -42,7 +41,6 @@ exports[`EuiCallOut props heading h1 is rendered 1`] = `
 <div
   class="euiPanel euiPanel--primary euiCallOut euiCallOut--primary emotion-euiPanel-none-primary-euiCallOut-primary"
   data-size="m"
-  style="--euiCallOutTypeColor: #0B64DD;"
 >
   <div
     class="css-1slkmya-wrapper"
@@ -72,7 +70,6 @@ exports[`EuiCallOut props heading h2 is rendered 1`] = `
 <div
   class="euiPanel euiPanel--primary euiCallOut euiCallOut--primary emotion-euiPanel-none-primary-euiCallOut-primary"
   data-size="m"
-  style="--euiCallOutTypeColor: #0B64DD;"
 >
   <div
     class="css-1slkmya-wrapper"
@@ -102,7 +99,6 @@ exports[`EuiCallOut props heading h3 is rendered 1`] = `
 <div
   class="euiPanel euiPanel--primary euiCallOut euiCallOut--primary emotion-euiPanel-none-primary-euiCallOut-primary"
   data-size="m"
-  style="--euiCallOutTypeColor: #0B64DD;"
 >
   <div
     class="css-1slkmya-wrapper"
@@ -132,7 +128,6 @@ exports[`EuiCallOut props heading h4 is rendered 1`] = `
 <div
   class="euiPanel euiPanel--primary euiCallOut euiCallOut--primary emotion-euiPanel-none-primary-euiCallOut-primary"
   data-size="m"
-  style="--euiCallOutTypeColor: #0B64DD;"
 >
   <div
     class="css-1slkmya-wrapper"
@@ -162,7 +157,6 @@ exports[`EuiCallOut props heading h5 is rendered 1`] = `
 <div
   class="euiPanel euiPanel--primary euiCallOut euiCallOut--primary emotion-euiPanel-none-primary-euiCallOut-primary"
   data-size="m"
-  style="--euiCallOutTypeColor: #0B64DD;"
 >
   <div
     class="css-1slkmya-wrapper"
@@ -192,7 +186,6 @@ exports[`EuiCallOut props heading h6 is rendered 1`] = `
 <div
   class="euiPanel euiPanel--primary euiCallOut euiCallOut--primary emotion-euiPanel-none-primary-euiCallOut-primary"
   data-size="m"
-  style="--euiCallOutTypeColor: #0B64DD;"
 >
   <div
     class="css-1slkmya-wrapper"
@@ -222,7 +215,6 @@ exports[`EuiCallOut props heading p is rendered 1`] = `
 <div
   class="euiPanel euiPanel--primary euiCallOut euiCallOut--primary emotion-euiPanel-none-primary-euiCallOut-primary"
   data-size="m"
-  style="--euiCallOutTypeColor: #0B64DD;"
 >
   <div
     class="css-1slkmya-wrapper"
```

**File**: `packages/eui/src/components/call_out/call_out.styles.ts` (modified, +1/-40)
```diff
@@ -11,35 +11,24 @@ import {
   logicalCSS,
   logicalShorthandCSS,
   mathWithUnits,
-  preventForcedColors,
 } from '../../global_styling';
 import { UseEuiTheme } from '../../services';
 
 /** Maximum reading width for `text` and `children` slots. */
 const TEXT_MAX_WIDTH = 1200;
 
 export const euiCallOutStyles = (euiThemeContext: UseEuiTheme) => {
-  const { euiTheme, highContrastMode } = euiThemeContext;
+  const { euiTheme } = euiThemeContext;
 
   const paddingSizes = {
     s: euiTheme.size.m,
     m: euiTheme.size.base,
   };
   const borderRadius = euiTheme.border.radius.panel;
-  const highlightSize = mathWithUnits(
-    [euiTheme.border.width.thin, euiTheme.border.width.thick],
-    (x, y) => (highContrastMode ? x * 2 + y : x + y)
-  );
-  const highlightOffset = euiTheme.border.width.thin;
-  const highlightSizeOffset = mathWithUnits([highlightOffset], (x) => x * 2);
   const separatorSize = mathWithUnits(
     [euiTheme.size.s, euiTheme.size.xxs],
     (x, y) => x + y
   );
-  const highlightClipSize = mathWithUnits(
-    [euiTheme.size.s, euiTheme.border.width.thin],
-    (x, y) => x + y
-  );
 
   return {
     euiCallOut: css`
@@ -54,34 +43,6 @@ export const euiCallOutStyles = (euiThemeContext: UseEuiTheme) => {
         outline-offset: 2px;
       }
 
-      &::before {
-        content: '';
-        position: absolute;
-        inset-block-start: -${highlightOffset};
-        inset-inline-start: -${highlightOffset};
-        block-size: calc(100% + ${highlightSizeOffset});
-        inline-size: 100%;
-        border-radius: ${borderRadius};
-        border-inline-start: ${highlightSize} solid var(--euiCallOutTypeColor);
-        clip-path: polygon(
-          0 0,
-          ${highlightClipSize} 0,
-          ${highlightClipSize} 100%,
-          0 100%
-        );
-        pointer-events: none;
-        ${preventForcedColors(euiThemeContext)}
-      }
-
-      [dir='rtl'] &::before {
-        clip-path: polygon(
-          calc(100% - ${highlightClipSize}) 0,
-          100% 0,
-          100% 100%,
-          calc(100% - ${highlightClipSize}) 100%
-        );
-      }
-
       &:where([data-size='s']) {
         ${logicalShorthandCSS('padding', `${paddingSizes.s} ${paddingSizes.m}`)}
       }
```

**File**: `packages/eui/src/components/call_out/call_out.tsx` (modified, +3/-10)
```diff
@@ -158,18 +158,11 @@ export const EuiCallOut = forwardRef<HTMLDivElement, EuiCallOutProps>(
       onDismiss && styles.hasDismissButton,
     ];
 
-    const highlightColorToken = getTokenName(
+    const iconColorToken = getTokenName(
       'borderStrong',
       color
     ) as keyof _EuiThemeBorderColors;
-    const typeColor = euiTheme.colors[highlightColorToken];
-
-    const cssVariables = useMemo(
-      () => ({
-        '--euiCallOutTypeColor': typeColor,
-      }),
-      [typeColor]
-    );
+    const typeColor = euiTheme.colors[iconColorToken];
 
     const classes = classNames(
       'euiCallOut',
@@ -326,7 +319,7 @@ export const EuiCallOut = forwardRef<HTMLDivElement, EuiCallOutProps>(
         className={classes}
         panelRef={panelRef}
         grow={false}
-        style={{ ...cssVariables, ...style }}
+        style={style}
         data-size={size}
         data-test-subj={dataTestSubj}
         {...rest}
```

**File**: `packages/eui/src/components/form/__snapshots__/form.test.tsx.snap` (modified, +0/-3)
```diff
@@ -27,7 +27,6 @@ exports[`EuiForm renders with error callout when isInvalid is "true" 1`] = `
     class="euiPanel euiPanel--danger euiCallOut euiCallOut--danger euiForm__errors emotion-euiPanel-none-danger-euiCallOut-danger"
     data-size="m"
     role="alert"
-    style="--euiCallOutTypeColor: #C61E25;"
     tabindex="-1"
   >
     <div
@@ -69,7 +68,6 @@ exports[`EuiForm renders with error callout when isInvalid is "true" and has mul
     class="euiPanel euiPanel--danger euiCallOut euiCallOut--danger euiForm__errors emotion-euiPanel-none-danger-euiCallOut-danger"
     data-size="m"
     role="alert"
-    style="--euiCallOutTypeColor: #C61E25;"
     tabindex="-1"
   >
     <div
@@ -131,7 +129,6 @@ exports[`EuiForm renders with error callout when isInvalid is "true" and has one
     class="euiPanel euiPanel--danger euiCallOut euiCallOut--danger euiForm__errors emotion-euiPanel-none-danger-euiCallOut-danger"
     data-size="m"
     role="alert"
-    style="--euiCallOutTypeColor: #C61E25;"
     tabindex="-1"
   >
     <div
```

---

### Incident Patch 8: `7fad9a28` (2026-10-02)
**Commit Message**: [EuiSuperSelect] Combine external labels with the selected value in the accessible name (#10039)

Co-authored-by: Weronika Olejniczak <[REDACTED_EMAIL]>
Co-authored-by: Claude Sonnet 5 <[REDACTED_EMAIL]>

**File**: `packages/eui/changelogs/upcoming/10039.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+**Bug fixes**
+
+- Fixed `EuiSuperSelect` omitting the currently selected value from its accessible name when an `aria-label` or `aria-labelledby` was passed. External labels are now combined with the selected value instead of overriding it
```

**File**: `packages/eui/src/components/color_picker/color_palette_picker/__snapshots__/color_palette_picker.test.tsx.snap` (modified, +48/-6)
```diff
@@ -8,6 +8,12 @@ exports[`EuiColorPalettePicker is rendered 1`] = `
     type="hidden"
     value=""
   />
+  <span
+    class="emotion-euiScreenReaderOnly"
+    id="generated-id_label"
+  >
+    aria-label
+  </span>
   <div
     class="euiFormControlLayout emotion-euiFormControlLayout"
   >
@@ -18,9 +24,10 @@ exports[`EuiColorPalettePicker is rendered 1`] = `
       <button
         aria-expanded="false"
         aria-haspopup="listbox"
-        aria-label="aria-label"
+        aria-labelledby="generated-id_button generated-id_label"
         class="euiSuperSelectControl testClass1 testClass2 emotion-euiSuperSelect__control-euiTestCss"
         data-test-subj="test subject string"
+        id="generated-id_button"
         type="button"
       />
       <div
@@ -49,6 +56,12 @@ exports[`EuiColorPalettePicker is rendered with a selected custom text 1`] = `
     type="hidden"
     value="custom"
   />
+  <span
+    class="emotion-euiScreenReaderOnly"
+    id="generated-id_label"
+  >
+    aria-label
+  </span>
   <div
     class="euiFormControlLayout emotion-euiFormControlLayout"
   >
@@ -59,9 +72,10 @@ exports[`EuiColorPalettePicker is rendered with a selected custom text 1`] = `
       <button
         aria-expanded="false"
         aria-haspopup="listbox"
-        aria-label="aria-label"
+        aria-labelledby="generated-id_button generated-id_label"
         class="euiSuperSelectControl testClass1 testClass2 emotion-euiSuperSelect__control-euiTestCss"
         data-test-subj="test subject string"
+        id="generated-id_button"
         type="button"
       >
         Plain text as a custom option
@@ -92,6 +106,12 @@ exports[`EuiColorPalettePicker is rendered with a selected fixed palette 1`] = `
     type="hidden"
     value="paletteFixed"
   />
+  <span
+    class="emotion-euiScreenReaderOnly"
+    id="generated-id_label"
+  >
+    aria-label
+  </span>
   <div
     class="euiFormControlLayout emotion-euiFormControlLayout"
   >
@@ -102,9 +122,10 @@ exports[`EuiColorPalettePicker is rendered with a selected fixed palette 1`] = `
       <button
         aria-expanded="false"
         aria-haspopup="listbox"
-        aria-label="aria-label"
+        aria-labelledby="generated-id_button generated-id_label"
         class="euiSuperSelectControl testClass1 testClass2 emotion-euiSuperSelect__control-euiTestCss"
         data-test-subj="test subject string"
+        id="generated-id_button"
         type="button"
       >
         <span
@@ -163,6 +184,12 @@ exports[`EuiColorPalettePicker is rendered with a selected gradient palette 1`]
     type="hidden"
     value="paletteLinear"
   />
+  <span
+    class="emotion-euiScreenReaderOnly"
+    id="generated-id_label"
+  >
+    aria-label
+  </span>
   <div
     class="euiFormControlLayout emotion-euiFormControlLayout"
   >
@@ -173,9 +200,10 @@ exports[`EuiColorPalettePicker is rendered with a selected gradient palette 1`]
       <button
         aria-expanded="false"
         aria-haspopup="listbox"
-        aria-label="aria-label"
+        aria-labelledby="generated-id_button generated-id_label"
         class="euiSuperSelectControl testClass1 testClass2 emotion-euiSuperSelect__control-euiTestCss"
         data-test-subj="test subject string"
+        id="generated-id_button"
         type="button"
       >
         <span
@@ -214,6 +242,12 @@ exports[`EuiColorPalettePicker is rendered with a selected gradient palette with
     type="hidden"
     value="paletteLinearStops"
   />
+  <span
+    class="emotion-euiScreenReaderOnly"
+    id="generated-id_label"
+  >
+    aria-label
+  </span>
   <div
     class="euiFormControlLayout emotion-euiFormControlLayout"
   >
@@ -224,9 +258,10 @@ exports[`EuiColorPalettePicker is rendered with a selected gradient palette with
       <button
         aria-expanded="false"
         aria-haspopup="listbox"
-        aria-label="aria-label"
+        aria-labelledby="generated-id_button generated-id_label"
         class="euiSuperSelectControl testClass1 testClass2 emotion-euiSuperSelect__control-euiTestCss"
         data-test-subj="test subject string"
+        id="generated-id_button"
         type="button"
       >
         <span
@@ -265,6 +300,12 @@ exports[`EuiColorPalettePicker is rendered with the prop selectionDisplay set as
     type="hidden"
     value="paletteFixed"
   />
+  <span
+    class="emotion-euiScreenReaderOnly"
+    id="generated-id_label"
+  >
+    aria-label
+  </span>
   <div
     class="euiFormControlLayout emotion-euiFormControlLayout"
   >
@@ -275,9 +316,10 @@ exports[`EuiColorPalettePicker is rendered with the prop selectionDisplay set as
       <button
         aria-expanded="false"
         aria-haspopup="listbox"
-        aria-label="aria-label"
+        aria-labelledby="generated-id_button generated-id_label"
         class="euiSuperSelectControl testClass1 testClass2 emotion-euiSuperSelect__control-euiTestCss"
         data-test-subj="test subject string"
+        id="generated-id_button"
       
```

**File**: `packages/eui/src/components/form/super_select/__snapshots__/super_select.test.tsx.snap` (modified, +8/-1)
```diff
@@ -161,6 +161,12 @@ exports[`EuiSuperSelect renders 1`] = `
         type="hidden"
         value=""
       />
+      <span
+        class="emotion-euiScreenReaderOnly"
+        id="generated-id_label"
+      >
+        aria-label
+      </span>
       <div
         class="euiFormControlLayout emotion-euiFormControlLayout"
       >
@@ -172,9 +178,10 @@ exports[`EuiSuperSelect renders 1`] = `
             aria-controls="euiPopover_generated-id_panelId"
             aria-expanded="true"
             aria-haspopup="listbox"
-            aria-label="aria-label"
+            aria-labelledby="generated-id_button generated-id_label"
             class="euiSuperSelectControl testClass1 testClass2 emotion-euiSuperSelect__control-open-euiTestCss"
             data-test-subj="test subject string"
+            id="generated-id_button"
             type="button"
           />
           <div
```

**File**: `packages/eui/src/components/form/super_select/__snapshots__/super_select_control.test.tsx.snap` (modified, +8/-1)
```diff
@@ -6,6 +6,12 @@ exports[`EuiSuperSelectControl is rendered 1`] = `
     type="hidden"
     value=""
   />
+  <span
+    class="emotion-euiScreenReaderOnly"
+    id="generated-id_label"
+  >
+    aria-label
+  </span>
   <div
     class="euiFormControlLayout emotion-euiFormControlLayout"
   >
@@ -15,9 +21,10 @@ exports[`EuiSuperSelectControl is rendered 1`] = `
     >
       <button
         aria-haspopup="listbox"
-        aria-label="aria-label"
+        aria-labelledby="generated-id_button generated-id_label"
         class="euiSuperSelectControl testClass1 testClass2 emotion-euiSuperSelect__control-euiTestCss"
         data-test-subj="test subject string"
+        id="generated-id_button"
         type="button"
       />
       <div
```

**File**: `packages/eui/src/components/form/super_select/super_select.test.tsx` (modified, +51/-0)
```diff
@@ -77,6 +77,57 @@ describe('EuiSuperSelect', () => {
     expect(control).toHaveAttribute('aria-describedby', 'test-help-0');
   });
 
+  it('combines an `aria-label` with the selected value instead of overriding it', () => {
+    const { getByTestSubject, getByText } = render(
+      <EuiSuperSelect
+        options={options}
+        valueOfSelected="2"
+        aria-label="Label"
+        data-test-subj="controlButton"
+      />
+    );
+    const control = getByTestSubject('controlButton');
+
+    expect(control).not.toHaveAttribute('aria-label');
+    expect(control).toHaveAccessibleName('Option #2 Label');
+    expect(getByText('Label')).toBeInTheDocument();
+  });
+
+  it('combines an `aria-labelledby` with the selected value instead of overriding it', () => {
+    const { getByTestSubject } = render(
+      <>
+        <span id="external-label">Label</span>
+        <EuiSuperSelect
+          options={options}
+          valueOfSelected="2"
+          aria-labelledby="external-label"
+          data-test-subj="controlButton"
+        />
+      </>
+    );
+    const control = getByTestSubject('controlButton');
+
+    expect(control).toHaveAttribute(
+      'aria-labelledby',
+      `${control.id} external-label`
+    );
+    expect(control).toHaveAccessibleName('Option #2 Label');
+  });
+
+  it('does not set `aria-labelledby` when no external label is passed', () => {
+    const { getByTestSubject } = render(
+      <EuiSuperSelect
+        options={options}
+        valueOfSelected="2"
+        data-test-subj="controlButton"
+      />
+    );
+    const control = getByTestSubject('controlButton');
+
+    expect(control).not.toHaveAttribute('aria-labelledby');
+    expect(control).toHaveAccessibleName('Option #2');
+  });
+
   describe('props', () => {
     test('fullWidth', () => {
       const { container } = render(
```

**File**: `packages/eui/src/components/form/super_select/super_select_control.tsx` (modified, +29/-11)
```diff
@@ -17,7 +17,7 @@ import React, {
 } from 'react';
 import classNames from 'classnames';
 
-import { useEuiMemoizedStyles } from '../../../services';
+import { useEuiMemoizedStyles, useGeneratedHtmlId } from '../../../services';
 import { CommonProps } from '../../common';
 import { EuiScreenReaderOnly } from '../../accessibility';
 
@@ -95,6 +95,8 @@ export const EuiSuperSelectControl: <T = string>(
     prepend,
     append,
     disabled,
+    'aria-label': ariaLabel,
+    'aria-labelledby': ariaLabelledByProp,
     ...rest
   } = props;
 
@@ -146,9 +148,26 @@ export const EuiSuperSelectControl: <T = string>(
     }
   }, [id]);
 
-  const buttonId = hasFormLabel ? `${id}-button` : undefined;
-  const ariaLabelledBy = hasFormLabel
-    ? `${buttonId} ${formLabelId}`
+  // `aria-label`s are rendered as a separate screen reader only element instead
+  // of being set on the <button>, so that the label can be combined with (rather
+  // than override) the currently selected value, which is the button's content
+  const ariaLabelId = useGeneratedHtmlId({ suffix: 'label' });
+  const generatedButtonId = useGeneratedHtmlId({ suffix: 'button' });
+
+  // Consumer-passed labels take precedence over the label rendered by EuiFormRow
+  const externalLabelId =
+    ariaLabelledByProp ||
+    (ariaLabel ? ariaLabelId : hasFormLabel ? formLabelId : undefined);
+
+  const buttonId = externalLabelId
+    ? hasFormLabel
+      ? `${id}-button`
+      : generatedButtonId
+    : undefined;
+  // Self-reference the button so that its content (the selected value) remains
+  // part of the accessible name alongside the external label
+  const ariaLabelledBy = externalLabelId
+    ? `${buttonId} ${externalLabelId}`
     : undefined;
 
   return (
@@ -161,6 +180,12 @@ export const EuiSuperSelectControl: <T = string>(
         readOnly={readOnly}
       />
 
+      {ariaLabel && !ariaLabelledByProp && (
+        <EuiScreenReaderOnly>
+          <span id={ariaLabelId}>{ariaLabel}</span>
+        </EuiScreenReaderOnly>
+      )}
+
       <EuiFormControlLayout
         isDropdown
         fullWidth={fullWidth}
@@ -193,13 +218,6 @@ export const EuiSuperSelectControl: <T = string>(
           ) : (
             selectedValue
           )}
-          {hasFormLabel && (
-            // Add a slight pause between reading out the multiple aria-labelledby elements,
-            // mimicking how screen readers handle native <select> elements
-            <EuiScreenReaderOnly>
-              <span>, </span>
-            </EuiScreenReaderOnly>
-          )}
         </button>
       </EuiFormControlLayout>
     </>
```

**File**: `packages/release-cli/kibana-prep-commits` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@
 
 # @next
 https://github.com/elastic/kibana/pull/294438/commits/7f815d4a4dd520f63996feddeb811b29eb80969a
+https://github.com/elastic/kibana/pull/294177/commits/cc7ee0c1cae23df31068671a603bf7b96e263cb3
 
 # @previous
 https://github.com/elastic/kibana/pull/293148/commits/44ac81b067c56b9a4c25b15e096eedb77a79ae6b
```

---

### Incident Patch 9: `a624afbb` (2026-10-01)
**Commit Message**: [EuiFlyout] Expose header, footer, and outer scroll refs (#10105)

**File**: `packages/eui/changelogs/upcoming/10105.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+- Added refs for `EuiFlyoutHeader`, `EuiFlyoutFooter`, and the outer `EuiFlyout` scroll container.
+- Corrected `EuiFlyoutHeaderProps`, `EuiFlyoutFooterProps`, and `EuiFlyoutBodyProps` to describe component props instead of component types.
```

**File**: `packages/eui/src/components/flyout/flyout.component.tsx` (modified, +8/-0)
```diff
@@ -21,6 +21,7 @@ import React, {
   ElementType,
   FunctionComponent,
   MutableRefObject,
+  Ref,
   JSX,
 } from 'react';
 import classnames from 'classnames';
@@ -83,6 +84,11 @@ import { EuiFlyoutParentProvider } from './flyout_parent_context';
 import { useEuiFlyoutMenu } from './use_flyout_menu';
 
 interface _EuiFlyoutComponentProps {
+  /**
+   * Access the outer flyout content container. This is distinct from
+   * `EuiFlyoutBody`'s internal `scrollContainerRef`.
+   */
+  scrollContainerRef?: Ref<HTMLDivElement>;
   /**
    * A required callback function fired when the flyout is closed.
    *
@@ -404,6 +410,7 @@ export const EuiFlyoutComponent = forwardRef(
       minWidth,
       onResize,
       onAnimationEnd,
+      scrollContainerRef,
       container: containerProp,
       ...rest
     } = usePropsWithComponentDefaults('EuiFlyout', props);
@@ -1240,6 +1247,7 @@ export const EuiFlyoutComponent = forwardRef(
               className="euiFlyout__content"
               css={styles.content}
               data-test-subj="euiFlyoutContent"
+              ref={scrollContainerRef}
             >
               <EuiFlyoutParentProvider>{children}</EuiFlyoutParentProvider>
             </div>
```

**File**: `packages/eui/src/components/flyout/flyout.test.tsx` (modified, +40/-0)
```diff
@@ -21,6 +21,7 @@ import {
 } from './flyout';
 import { EuiProvider } from '../provider';
 import { EuiFlyoutManager } from './manager';
+import { EuiFlyoutBody } from './flyout_body';
 import { MENU_DISPLAY_ALWAYS } from './const';
 
 jest.mock('../overlay_mask', () => ({
@@ -37,6 +38,45 @@ jest.mock('../portal', () => ({
 }));
 
 describe('EuiFlyout', () => {
+  test('exposes the outer scroll container separately from the flyout and body', () => {
+    const flyoutRef = React.createRef<HTMLDivElement>();
+    const scrollContainerRef = React.createRef<HTMLDivElement>();
+    const bodyScrollContainerRef = React.createRef<HTMLDivElement>();
+    const { unmount } = render(
+      <EuiFlyout
+        onClose={() => {}}
+        aria-label="Test flyout"
+        ref={flyoutRef}
+        scrollContainerRef={scrollContainerRef}
+      >
+        <EuiFlyoutBody scrollContainerRef={bodyScrollContainerRef} />
+      </EuiFlyout>
+    );
+
+    expect(scrollContainerRef.current).toHaveClass('euiFlyout__content');
+    expect(flyoutRef.current).toContainElement(scrollContainerRef.current);
+    expect(scrollContainerRef.current).not.toBe(flyoutRef.current);
+    expect(scrollContainerRef.current).not.toBe(bodyScrollContainerRef.current);
+    unmount();
+    expect(scrollContainerRef.current).toBeNull();
+  });
+
+  test('exposes the outer scroll container in a managed flyout', () => {
+    const scrollContainerRef = React.createRef<HTMLDivElement>();
+    render(
+      <EuiFlyoutManager>
+        <EuiFlyout
+          onClose={() => {}}
+          aria-label="Test managed flyout"
+          session="start"
+          scrollContainerRef={scrollContainerRef}
+        />
+      </EuiFlyoutManager>
+    );
+
+    expect(scrollContainerRef.current).toHaveClass('euiFlyout__content');
+  });
+
   shouldRenderCustomStyles(
     <EuiFlyout {...requiredProps} onClose={() => {}} />,
     { childProps: ['closeButtonProps', 'maskProps'] }
```

**File**: `packages/eui/src/components/flyout/flyout_body.tsx` (modified, +22/-24)
```diff
@@ -17,31 +17,29 @@ import { CommonProps } from '../common';
 import { useEuiMemoizedStyles } from '../../services';
 import { euiFlyoutBodyStyles } from './flyout_body.styles';
 
-export type EuiFlyoutBodyProps = FunctionComponent<
-  HTMLAttributes<HTMLDivElement> &
-    CommonProps & {
-      /**
-       * Use to display a banner at the top of the body. It is suggested to use `EuiCallOut` for it.
-       */
-      banner?: ReactNode;
-      /**
-       * [Scrollable regions (or their children) should be focusable](https://dequeuniversity.com/rules/axe/4.0/scrollable-region-focusable)
-       * to allow keyboard users to scroll the region via arrow keys.
-       *
-       * By default, EuiFlyoutBody's scroll overflow wrapper sets a `tabIndex` of `0`.
-       * If you know your flyout body content already contains focusable children
-       * that satisfy keyboard accessibility requirements, you can use this prop
-       * to override this default.
-       */
-      scrollableTabIndex?: number;
-      /**
-       * Use to access the flyout's internal scrollable container.
-       */
-      scrollContainerRef?: Ref<HTMLDivElement>;
-    }
->;
+export type EuiFlyoutBodyProps = HTMLAttributes<HTMLDivElement> &
+  CommonProps & {
+    /**
+     * Use to display a banner at the top of the body. It is suggested to use `EuiCallOut` for it.
+     */
+    banner?: ReactNode;
+    /**
+     * [Scrollable regions (or their children) should be focusable](https://dequeuniversity.com/rules/axe/4.0/scrollable-region-focusable)
+     * to allow keyboard users to scroll the region via arrow keys.
+     *
+     * By default, EuiFlyoutBody's scroll overflow wrapper sets a `tabIndex` of `0`.
+     * If you know your flyout body content already contains focusable children
+     * that satisfy keyboard accessibility requirements, you can use this prop
+     * to override this default.
+     */
+    scrollableTabIndex?: number;
+    /**
+     * Use to access the flyout's internal scrollable container.
+     */
+    scrollContainerRef?: Ref<HTMLDivElement>;
+  };
 
-export const EuiFlyoutBody: EuiFlyoutBodyProps = ({
+export const EuiFlyoutBody: FunctionComponent<EuiFlyoutBodyProps> = ({
   children,
   className,
   banner,
```

**File**: `packages/eui/src/components/flyout/flyout_footer.test.tsx` (modified, +9/-0)
```diff
@@ -13,6 +13,15 @@ import { render } from '../../test/rtl';
 import { EuiFlyoutFooter } from './flyout_footer';
 
 describe('EuiFlyoutFooter', () => {
+  test('forwards its ref to the footer element', () => {
+    const ref = React.createRef<HTMLDivElement>();
+    const { unmount } = render(<EuiFlyoutFooter ref={ref} />);
+
+    expect(ref.current).toHaveClass('euiFlyoutFooter');
+    unmount();
+    expect(ref.current).toBeNull();
+  });
+
   test('is rendered', () => {
     const { container } = render(<EuiFlyoutFooter {...requiredProps} />);
 
```

**File**: `packages/eui/src/components/flyout/flyout_footer.tsx` (modified, +15/-17)
```diff
@@ -6,28 +6,26 @@
  * Side Public License, v 1.
  */
 
-import React, { FunctionComponent, HTMLAttributes } from 'react';
+import React, { forwardRef, HTMLAttributes } from 'react';
 import classNames from 'classnames';
 import { CommonProps } from '../common';
 import { useEuiMemoizedStyles } from '../../services';
 import { euiFlyoutFooterStyles } from './flyout_footer.styles';
 
-export type EuiFlyoutFooterProps = FunctionComponent<
-  HTMLAttributes<HTMLDivElement> & CommonProps
->;
+export type EuiFlyoutFooterProps = HTMLAttributes<HTMLDivElement> & CommonProps;
 
-export const EuiFlyoutFooter: EuiFlyoutFooterProps = ({
-  children,
-  className,
-  ...rest
-}) => {
-  const classes = classNames('euiFlyoutFooter', className);
+export const EuiFlyoutFooter = forwardRef<HTMLDivElement, EuiFlyoutFooterProps>(
+  ({ children, className, ...rest }, ref) => {
+    const classes = classNames('euiFlyoutFooter', className);
 
-  const styles = useEuiMemoizedStyles(euiFlyoutFooterStyles);
+    const styles = useEuiMemoizedStyles(euiFlyoutFooterStyles);
 
-  return (
-    <div className={classes} css={styles.euiFlyoutFooter} {...rest}>
-      {children}
-    </div>
-  );
-};
+    return (
+      <div className={classes} css={styles.euiFlyoutFooter} {...rest} ref={ref}>
+        {children}
+      </div>
+    );
+  }
+);
+
+EuiFlyoutFooter.displayName = 'EuiFlyoutFooter';
```

**File**: `packages/eui/src/components/flyout/flyout_header.test.tsx` (modified, +9/-0)
```diff
@@ -13,6 +13,15 @@ import { render } from '../../test/rtl';
 import { EuiFlyoutHeader } from './flyout_header';
 
 describe('EuiFlyoutHeader', () => {
+  test('forwards its ref to the header element', () => {
+    const ref = React.createRef<HTMLDivElement>();
+    const { unmount } = render(<EuiFlyoutHeader ref={ref} />);
+
+    expect(ref.current).toHaveClass('euiFlyoutHeader');
+    unmount();
+    expect(ref.current).toBeNull();
+  });
+
   test('is rendered', () => {
     const { container } = render(<EuiFlyoutHeader {...requiredProps} />);
 
```

**File**: `packages/eui/src/components/flyout/flyout_header.tsx` (modified, +19/-22)
```diff
@@ -6,33 +6,30 @@
  * Side Public License, v 1.
  */
 
-import React, { FunctionComponent, HTMLAttributes } from 'react';
+import React, { forwardRef, HTMLAttributes } from 'react';
 import classNames from 'classnames';
 import { CommonProps } from '../common';
 import { useEuiMemoizedStyles } from '../../services';
 import { euiFlyoutHeaderStyles } from './flyout_header.styles';
 
-export type EuiFlyoutHeaderProps = FunctionComponent<
-  HTMLAttributes<HTMLDivElement> &
-    CommonProps & {
-      hasBorder?: boolean;
-    }
->;
+export type EuiFlyoutHeaderProps = HTMLAttributes<HTMLDivElement> &
+  CommonProps & {
+    hasBorder?: boolean;
+  };
 
-export const EuiFlyoutHeader: EuiFlyoutHeaderProps = ({
-  children,
-  className,
-  hasBorder = false,
-  ...rest
-}) => {
-  const classes = classNames('euiFlyoutHeader', className);
+export const EuiFlyoutHeader = forwardRef<HTMLDivElement, EuiFlyoutHeaderProps>(
+  ({ children, className, hasBorder = false, ...rest }, ref) => {
+    const classes = classNames('euiFlyoutHeader', className);
 
-  const styles = useEuiMemoizedStyles(euiFlyoutHeaderStyles);
-  const cssStyles = [styles.euiFlyoutHeader, hasBorder && styles.hasBorder];
+    const styles = useEuiMemoizedStyles(euiFlyoutHeaderStyles);
+    const cssStyles = [styles.euiFlyoutHeader, hasBorder && styles.hasBorder];
 
-  return (
-    <div className={classes} css={cssStyles} {...rest}>
-      {children}
-    </div>
-  );
-};
+    return (
+      <div className={classes} css={cssStyles} {...rest} ref={ref}>
+        {children}
+      </div>
+    );
+  }
+);
+
+EuiFlyoutHeader.displayName = 'EuiFlyoutHeader';
```

---

### Incident Patch 10: `8b4aaaa6` (2026-10-01)
**Commit Message**: [EuiRange] Migrate to function component (#10098)

**File**: `packages/eui/src/components/form/range/range.stories.tsx` (modified, +9/-11)
```diff
@@ -9,7 +9,10 @@
 import React, { useEffect, useState } from 'react';
 import type { Meta, StoryObj } from '@storybook/react-vite';
 
-import { VRT_SELECTORS } from '../../../../.storybook/vrt';
+import { userEvent } from 'storybook/test';
+
+import { within } from '../../../../.storybook/test';
+import { playDecorator, VRT_SELECTORS } from '../../../../.storybook/vrt';
 import {
   enableFunctionToggleControls,
   moveStorybookControlsToCategory,
@@ -255,16 +258,11 @@ export const InputWithPopover: Story = {
       { min: 20, max: 100, color: 'success' },
     ],
   },
-  // Force input popover open via programmatic ref
-  render: function Render(args) {
-    const [ref, setRef] = useState<any>();
-    useEffect(() => {
-      // Wrapping in a timeout avoids a width/render error during VRT.
-      // This doesn't happen on production
-      if (ref) setTimeout(() => ref.onInputFocus(), 1);
-    }, [ref]);
-    return <EuiRange {...args} ref={setRef} />;
-  },
+  play: playDecorator(async ({ canvasElement }) => {
+    const canvas = within(canvasElement);
+    await userEvent.click(canvas.getByRole('spinbutton'));
+    await canvas.waitForEuiPopoverVisible();
+  }),
 };
 
 export const HighContrast: Story = {
```

**File**: `packages/eui/src/components/form/range/range.tsx` (modified, +204/-250)
```diff
@@ -6,18 +6,22 @@
  * Side Public License, v 1.
  */
 
-import React, { Component, ReactNode } from 'react';
+import React, {
+  useRef,
+  useState,
+  type ChangeEvent,
+  type FocusEvent,
+  type FunctionComponent,
+  type MouseEvent,
+  type ReactElement,
+} from 'react';
 import classNames from 'classnames';
 
 import { isWithinRange } from '../../../services/number';
 import { EuiInputPopover } from '../../popover';
-import {
-  htmlIdGenerator,
-  withEuiTheme,
-  WithEuiThemeProps,
-} from '../../../services/';
+import { useEuiTheme, useGeneratedHtmlId, useLatest } from '../../../services';
+import { useFormContext } from '../eui_form_context';
 
-import { FormContext, FormContextValue } from '../eui_form_context';
 import { getLevelColor } from './range_levels_colors';
 import { EuiRangeHighlight } from './range_highlight';
 import { EuiRangeInput } from './range_input';
@@ -32,91 +36,95 @@ import type { EuiRangeProps, EuiRangeTick } from './types';
 import { euiRangeStyles } from './range.styles';
 import { EuiI18n } from '../../i18n';
 
-export class EuiRangeClass extends Component<
-  EuiRangeProps & WithEuiThemeProps
-> {
-  static contextType = FormContext;
-
-  static defaultProps = {
-    min: 0,
-    max: 100,
-    step: 1,
-    compressed: false,
-    isLoading: false,
-    showLabels: false,
-    showInput: false,
-    showRange: false,
-    showTicks: false,
-    showValue: false,
-    levels: [],
-  };
+/**
+ * @see {@link https://eui.elastic.co/docs/components/forms/numeric/range-sliders/|EuiRange documentation}
+ */
+export const EuiRange: FunctionComponent<EuiRangeProps> = ({
+  min = 0,
+  max = 100,
+  step = 1,
+  compressed = false,
+  isLoading = false,
+  showLabels = false,
+  showInput = false,
+  showRange = false,
+  showTicks = false,
+  showValue = false,
+  levels = [],
+  className,
+  disabled,
+  fullWidth: _fullWidth,
+  readOnly,
+  id: propsId,
+  name,
+  tickInterval,
+  ticks,
+  valueAppend,
+  valuePrepend,
+  onBlur,
+  onChange,
+  onFocus,
+  value,
+  tabIndex,
+  isInvalid,
+  inputPopoverProps,
+  ...rest
+}) => {
+  const theme = useEuiTheme();
+  const { defaultFullWidth } = useFormContext();
+  const generatedId = useGeneratedHtmlId();
+  const onBlurRef = useLatest(onBlur);
 
-  preventPopoverClose: boolean = false;
+  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
+  const [trackWidth, setTrackWidth] = useState(0);
+  const preventPopoverClose = useRef(false);
 
-  state = {
-    id: this.props.id || htmlIdGenerator()(),
-    isPopoverOpen: false,
-    trackWidth: 0,
-  };
+  const id = propsId || generatedId;
+  const isValid = isWithinRange(min, max, value || '');
+  const showInputOnly = showInput === 'inputWithPopover';
+  const canShowDropdown = showInputOnly && !readOnly && !disabled;
+  const classes = classNames('euiRange', className);
+  const styles = euiRangeStyles(theme);
+  const cssStyles = [styles.euiRange, showInput && styles.hasInput];
+  const thumbColor = levels && getLevelColor(levels, Number(value));
+  const fullWidth = _fullWidth ?? defaultFullWidth;
 
-  handleOnChange = (
-    e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>
+  const handleOnChange = (
+    e: ChangeEvent<HTMLInputElement> | MouseEvent<HTMLButtonElement>
   ) => {
-    const isValid = isWithinRange(
-      this.props.min,
-      this.props.max,
-      e.currentTarget.value
-    );
-    if (this.props.onChange) {
-      this.props.onChange(e, isValid);
-    }
+    const isValid = isWithinRange(min, max, e.currentTarget.value);
+    onChange?.(e, isValid);
   };
 
-  get isValid() {
-    return isWithinRange(
-      this.props.min,
-      this.props.max,
-      this.props.value || ''
-    );
-  }
-
-  setTrackWidth = ({ width }: { width: number }) => {
-    this.setState({ trackWidth: width });
+  const handleSetTrackWidth = ({ width }: { width: number }) => {
+    setTrackWidth(width);
   };
 
-  onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
-    if (this.props.onFocus) {
-      this.props.onFocus(e);
-    }
-    this.setState({
-      isPopoverOpen: true,
-    });
+  const onInputFocus = (e: FocusEvent<HTMLInputElement>) => {
+    onFocus?.(e);
+    setIsPopoverOpen(true);
   };
 
-  onInputBlur = (e: React.FocusEvent<HTMLInputElement>) =>
+  const onInputBlur = (e: FocusEvent<HTMLInputElement>) =>
     setTimeout(() => {
       // Safari does not recognize any focus-related eventing for input[type=range]
       // making it impossible to capture its state using active/focus/relatedTarget
       // Instead, a prevention flag is set on mousedown, with a waiting period here.
       // Mousedown is viable because in the popover case, it is inaccessible via keyboard (intentionally)
-      if (this.preventPopoverClose) {
-        this.preventPopoverClose = false;
+      if (preventPopoverClose.current) {
+        preventPopoverClose.current = false;
         return;
       }
-      if (this.props.onBlur) {
-  
```

**File**: `packages/release-cli/kibana-prep-commits` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@
 # Nightly cherry-picks both sections, skipping commits that are missing or already applied.
 
 # @next
+https://github.com/elastic/kibana/pull/294438/commits/7f815d4a4dd520f63996feddeb811b29eb80969a
 
 # @previous
 https://github.com/elastic/kibana/pull/293148/commits/44ac81b067c56b9a4c25b15e096eedb77a79ae6b
```

---

### Incident Patch 11: `4aa98461` (2026-10-01)
**Commit Message**: [Chore][Regression PR] Reuse Kibana regression PR (#10096)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ on:
         default: false
         type: boolean
 concurrency:
-  group: ${{ inputs.kibana_nightly && 'kibana-nightly' || format('release-{0}', github.run_id) }}
+  group: ${{ inputs.kibana_nightly && 'kibana-nightly' || format('release-{0}', inputs.kibana_source_pr_number && format('kibana-pr-{0}', inputs.kibana_source_pr_number) || github.run_id) }}
   cancel-in-progress: false
   queue: max
 permissions:
```

**File**: `.github/workflows/update_kibana_dependencies__open_pr.yml` (modified, +42/-37)
```diff
@@ -39,8 +39,10 @@ on:
         description: Published @elastic/eui snapshot version
         type: string
 concurrency:
-  group: ${{ inputs.nightly && 'kibana-nightly' || format('open-kibana-pr-{0}', github.run_id) }}
-  cancel-in-progress: false
+  group: ${{ inputs.nightly && 'kibana-nightly' || format('open-kibana-{0}', inputs.source_pr_number && format('pr-{0}', inputs.source_pr_number) || github.run_id) }}
+  # A newer run for the same source PR supersedes the older run and reports
+  # status for the latest commits.
+  cancel-in-progress: ${{ !!inputs.source_pr_number }}
   queue: max
 permissions:
   contents: read
@@ -112,45 +114,48 @@ jobs:
                 '' \
                 '</details>'
             )"
+          fi
 
-            # Reuse the open PR for the fixed nightly branch.
-            # The REST `head=owner:branch` filter cannot distinguish the base
-            # repository from a fork when both belong to the same organization.
-            existing_pr_url="$(
-              gh api graphql \
-                -f query='
-                  query ($owner: String!, $name: String!, $headRefName: String!) {
-                    repository(owner: $owner, name: $name) {
-                      pullRequests(first: 100, states: OPEN, headRefName: $headRefName) {
-                        nodes {
-                          url
-                          headRepository {
-                            nameWithOwner
-                          }
+          # Reuse the open PR for this head branch.
+          # Nightly uses a fixed branch. Regression runs use a branch keyed by
+          # the source PR number. Manual runs use a unique branch, so this
+          # lookup finds nothing and a new PR is created below.
+          # The REST `head=owner:branch` filter cannot distinguish the base
+          # repository from a fork when both belong to the same organization.
+          existing_pr_url="$(
+            gh api graphql \
+              -f query='
+                query ($owner: String!, $name: String!, $headRefName: String!) {
+                  repository(owner: $owner, name: $name) {
+                    pullRequests(first: 100, states: OPEN, headRefName: $headRefName) {
+                      nodes {
+                        url
+                        headRepository {
+                          nameWithOwner
                         }
                       }
                     }
-                  }' \
-                -f "owner=${base_repo%/*}" \
-                -f "name=${base_repo#*/}" \
-                -f "headRefName=$PR_HEAD" |
-                jq -r --arg head_repo "$head_repo" \
-                  '[.data.repository.pullRequests.nodes[] | select(.headRepository.nameWithOwner == $head_repo)] | first | .url // ""'
-            )"
-            if [[ -n "$existing_pr_url" ]]; then
-              gh pr edit "$existing_pr_url" --title "$PR_TITLE" --body "${PR_BODY:-}"
-              if [[ "$(gh pr view "$existing_pr_url" --json isDraft --jq .isDraft)" != "true" ]]; then
-                gh pr ready "$existing_pr_url" --undo
-              fi
-
-              echo "pr_url=$existing_pr_url" >> "$GITHUB_OUTPUT"
-              {
-                echo "### Pull request updated"
-                echo ""
-                echo "$existing_pr_url"
-              } >> "$GITHUB_STEP_SUMMARY"
-              exit 0
+                  }
+                }' \
+              -f "owner=${base_repo%/*}" \
+              -f "name=${base_repo#*/}" \
+              -f "headRefName=$PR_HEAD" |
+              jq -r --arg head_repo "$head_repo" \
+                '[.data.repository.pullRequests.nodes[] | select(.headRepository.nameWithOwner == $head_repo)] | first | .url // ""'
+          )"
+          if [[ -n "$existing_pr_url" ]]; then
+            gh pr edit "$existing_pr_url" --title "$PR_TITLE" --body "${PR_BODY:-}"
+            if [[ "$(gh pr view "$existing_pr_url" --json isDraft --jq .isDraft)" != "true" ]]; then
+              gh pr ready "$existing_pr_url" --undo
             fi
+
+            echo "pr_url=$existing_pr_url" >> "$GITHUB_OUTPUT"
+            {
+              echo "### Pull request updated"
+              echo ""
+              echo "$existing_pr_url"
+            } >> "$GITHUB_STEP_SUMMARY"
+            exit 0
           fi
 
           base_repo_id="$(gh api "repos/$base_repo" --jq .node_id)"
@@ -300,7 +305,7 @@ jobs:
     runs-on: ubuntu-slim
     needs: [open_pr, check_ci_status_1, check_ci_status_2]
     if: |
-      always() &&
+      !cancelled() &&
       (inputs.source_pr_number || inputs.nightly) &&
       (
         (needs.check_ci_status_1.result == 'success' && needs.check_ci_status_2.result == 'skipped') ||
```

**File**: `.github/workflows/update_kibana_dependencies__prepare_changes.yml` (modified, +10/-3)
```diff
@@ -44,7 +44,7 @@ on:
         description: Published @elastic/eui snapshot version
         type: string
 concurrency:
-  group: ${{ inputs.nightly && 'kibana-nightly' || format('prepare-kibana-{0}', github.run_id) }}
+  group: ${{ inputs.nightly && 'kibana-nightly' || format('prepare-kibana-{0}', inputs.source_pr_number && format('pr-{0}', inputs.source_pr_number) || github.run_id) }}
   cancel-in-progress: false
   queue: max
 permissions:
@@ -108,11 +108,15 @@ jobs:
         id: git_branch
         env:
           NIGHTLY: ${{ inputs.nightly }}
+          SOURCE_PR_NUMBER: ${{ inputs.source_pr_number }}
         # language=bash
         run: |
-          # Nightly runs reuse a fixed branch; all other runs remain unique.
+          # Nightly reuses a fixed branch. Regression runs reuse a branch keyed
+          # by the source PR number. Manual runs stay unique.
           if [[ "$NIGHTLY" == "true" ]]; then
             branch_name="nightly/update-dependencies"
+          elif [[ -n "${SOURCE_PR_NUMBER:-}" ]]; then
+            branch_name="update-dependencies/pr-${SOURCE_PR_NUMBER}"
           else
             branch_name="update-dependencies/$(date +%s)"
           fi
@@ -313,9 +317,12 @@ jobs:
           GH_TOKEN: ${{ steps.fetch_ephemeral_token.outputs.token }}
           BRANCH_NAME: ${{ steps.git_branch.outputs.BRANCH_NAME }}
           NIGHTLY: ${{ inputs.nightly }}
+          SOURCE_PR_NUMBER: ${{ inputs.source_pr_number }}
         # language=bash
         run: |
-          if [[ "$NIGHTLY" == "true" ]]; then
+          # Reused branches are recreated from latest Kibana main, so the
+          # remote history is replaced.
+          if [[ "$NIGHTLY" == "true" || -n "${SOURCE_PR_NUMBER:-}" ]]; then
             git push -u --force fork "$BRANCH_NAME"
           else
             git push -u fork "$BRANCH_NAME"
```

---

### Incident Patch 12: `cbdc2dbd` (2026-09-29)
**Commit Message**: Release: @elastic/eslint-plugin-eui v3.2.0, @elastic/eui v123.0.0, @elastic/eui-test-helpers v2.0.0 (#10101)

**File**: `packages/eslint-plugin/changelogs/CHANGELOG_2026.md` (modified, +8/-0)
```diff
@@ -1,3 +1,11 @@
+## [`v3.2.0`](https://github.com/elastic/eui/releases/tag/%40elastic%2Feslint-plugin-eui%403.2.0)
+
+- Updated `button-group-no-invalid-children` rule to support `additionalWrappers` option ([#10024](https://github.com/elastic/eui/pull/10024))
+
+**Dependency updates**
+
+- Replaced `micromatch` with `picomatch` in `@elastic/eui/no-restricted-eui-imports` ([#10094](https://github.com/elastic/eui/pull/10094))
+
 ## [`v3.1.0`](https://github.com/elastic/eui/releases/tag/%40elastic%2Feslint-plugin-eui%403.1.0)
 
 - Added new `@elastic/eui/no-nested-interactive-element` rule ([#10035](https://github.com/elastic/eui/pull/10035))
```

**File**: `packages/eslint-plugin/changelogs/upcoming/10024.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-- Updated `button-group-no-invalid-children` rule to support `additionalWrappers` option
\ No newline at end of file
```

**File**: `packages/eslint-plugin/changelogs/upcoming/10094.md` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-**Dependency updates**
-
-- Replaced `micromatch` with `picomatch` in `@elastic/eui/no-restricted-eui-imports`
```

**File**: `packages/eslint-plugin/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@elastic/eslint-plugin-eui",
-  "version": "3.1.0",
+  "version": "3.2.0",
   "license": "Apache-2.0",
   "repository": {
     "type": "git",
```

**File**: `packages/eui/changelogs/CHANGELOG_2026.md` (modified, +19/-0)
```diff
@@ -1,3 +1,22 @@
+## [`v123.0.0`](https://github.com/elastic/eui/releases/v123.0.0)
+
+- Added `toolTipProps` to `EuiTextTruncate` to control where the full text tooltip opens, e.g. its `position` ([#10086](https://github.com/elastic/eui/pull/10086))
+- Added export for `EuiButtonPropsForButton` and `EuiButtonPropsForAnchor` types ([#10064](https://github.com/elastic/eui/pull/10064))
+
+**Bug fixes**
+
+- Fixed an issue where `EuiDataGrid` cell tooltips repeatedly opened and closed in Firefox when the grid was scrolled to the very bottom at fractional display scaling (e.g., 125%). ([#10084](https://github.com/elastic/eui/pull/10084))
+- Fixed `EuiFlyout` opening a new `session="start"` flyout at the wrong width while another session was still open. The new flyout was clamped against the previous session's main flyout as if the two were siblings, so it opened narrower than its `size` and alternated between widths on every other open. The backgrounded flyout could also call `onResize` with a width the user never chose. ([#10075](https://github.com/elastic/eui/pull/10075))
+- Fixed a backgrounded main flyout keeping the global `--euiFlyoutMainWidth` CSS variable set, which could size the active session's `fill` child from the hidden flyout's width. Only the active session's main flyout publishes it now, and a closing or backgrounded flyout no longer clears a value another flyout has just published. ([#10075](https://github.com/elastic/eui/pull/10075))
+- Fixed `EuiFlyout` leaving stale or missing push padding when multiple `type="push"` flyouts share a padding target (a `container` or `document.body`). The applied offset is now derived from all currently pushed flyouts, so it no longer depends on the order in which they open, close or resize. ([#10063](https://github.com/elastic/eui/pull/10063))
+- Fixed `EuiFlyoutMenu` actions ignoring `data-test-subj` and other `data-*` attributes. ([#10038](https://github.com/elastic/eui/pull/10038))
+- Fixed `EuiFlyout` tearing down the foreground session when a managed main flyout is closed while backgrounded by a newer session; the backgrounded main now closes only its own session ([#10062](https://github.com/elastic/eui/pull/10062))
+- Fixed `EuiDescribedFormGroup` rendering its `role="group"` wrapper without an accessible name. The group is now named by its `title`, unless an `aria-label` or `aria-labelledby` is passed ([#10060](https://github.com/elastic/eui/pull/10060))
+
+**Breaking changes**
+
+- Updated `EuiFlyoutMenuAction` to accept any `EuiButtonIcon` prop and arbitrary `data-*` attributes. The menu bar controls `color`, `size`, `display`, `iconSize`, and `isSelected` props. ([#10038](https://github.com/elastic/eui/pull/10038))
+
 ## [`v122.1.0`](https://github.com/elastic/eui/releases/v122.1.0)
 
 - Updated `EuiLink`: ([#9989](https://github.com/elastic/eui/pull/9989))
```

**File**: `packages/eui/changelogs/upcoming/10038.md` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-**Breaking changes**
-
-- Updated `EuiFlyoutMenuAction` to accept any `EuiButtonIcon` prop and arbitrary `data-*` attributes. The menu bar controls `color`, `size`, `display`, `iconSize`, and `isSelected` props.
-
-**Bug fixes**
-
-- Fixed `EuiFlyoutMenu` actions ignoring `data-test-subj` and other `data-*` attributes.
```

**File**: `packages/eui/changelogs/upcoming/10060.md` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-**Bug fixes**
-
-- Fixed `EuiDescribedFormGroup` rendering its `role="group"` wrapper without an accessible name. The group is now named by its `title`, unless an `aria-label` or `aria-labelledby` is passed
```

**File**: `packages/eui/changelogs/upcoming/10062.md` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-**Bug fixes**
-
-- Fixed `EuiFlyout` tearing down the foreground session when a managed main flyout is closed while backgrounded by a newer session; the backgrounded main now closes only its own session
```

---

### Incident Patch 13: `303afeea` (2026-09-29)
**Commit Message**: [Chore] Ping elastic/eui-icons team on issues labelled "icons" (#10095)

**File**: `.github/workflows/label_commenter.yml` (modified, +13/-0)
```diff
@@ -29,6 +29,19 @@ jobs:
               body: process.env.COMMENT_BODY,
             });
 
+      - name: Comment on icons issues
+        if: ${{ github.event_name == 'issues' && github.event.label.name == 'icons' }}
+        uses: actions/github-script@v8
+        env:
+          COMMENT_BODY: 'cc @elastic/eui-icons'
+        with:
+          script: |
+            await github.rest.issues.createComment({
+              ...context.repo,
+              issue_number: context.issue.number,
+              body: process.env.COMMENT_BODY,
+            });
+
       - name: Comment on breaking change pull requests
         if: ${{ github.event_name == 'pull_request_target' && github.event.label.name == 'breaking change' }}
         uses: actions/github-script@v8
```

---

### Incident Patch 14: `92aff27e` (2026-09-28)
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
+        });
+
+        // The callback's `scrollTop` is read from the DOM mock, so it stays 0
+        // even when the second event was dropped. Direction does not: mount
+        // reports `forward`, and `backward` means the reversal was applied.
+        expect(onScroll).toHaveBeenLastCalledWith(
+          expect.objectContaining({
+            verticalScrollDirection: 'backward',
+          })
+        );
+      });
+
+      it('renders `virtualizationOptions.outerElementType` as the scroll container', () => {
+        const CustomOuter = forwardRef<
+          HTMLDivElement,
+          React.ComponentPropsWithoutRef<'div'>
+        >((props, ref) => (
+          <div data-test-subj="customOuter" ref={ref} {...props} />
+        ));
+        CustomOuter.displayName = 'CustomOuter';
+        const { outer, inner } = renderGrid({ outerElementType: CustomOuter });
+
+        expect(outer).toHaveAttribute('data-test-subj', 'customOuter');
+
+        setScrollTop(50);
+        fireEvent.scroll
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
         (args: GridOnScrollProps) => {
+          const element = outerGridRef.current;
+          // `scrollTo` reports the requested offset, which can sit past the
+          // end. Storing that would replace the clamped position already
+          // taken from the DOM. Leave the ref unchanged instead of writing
+          // the clamped value: a scroll event that has not arrived yet still
+          // differs from the previous position and is forwarded.
+          const topInRange =
+            element == null ||
+            args.scrollTop ===
+              clampScrollOffset(
+                args.scrollTop,
+                element.scrollHeight - element.clientHeight
+              );
+          const leftInRange =
+            element == null ||
+            args.scrollLeft ===
+              clampScrollOffset(
+                args.scrollLeft,
+                element.scrollWidth - element.clientWidth
+              );
+          if (topInRange && leftInRange) {
+            scrollPositionR
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

### Incident Patch 15: `04d65520` (2026-09-25)
**Commit Message**: [EuiTextTruncate] Add toolTipProps to customize the full text tooltip (#10086)

**File**: `packages/eui/changelogs/upcoming/10086.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+- Added `toolTipProps` to `EuiTextTruncate` to control where the full text tooltip opens, e.g. its `position`
```

**File**: `packages/eui/src/components/text_truncate/text_truncate.test.tsx` (modified, +12/-0)
```diff
@@ -118,6 +118,18 @@ describe('EuiTextTruncate', () => {
       expect(queryByRole('tooltip')).toHaveTextContent('Hello world');
     });
 
+    it('passes toolTipProps to the tooltip', () => {
+      const { container, getByRole } = render(
+        <EuiTextTruncate
+          text="Hello world"
+          width={0}
+          toolTipProps={{ position: 'right' }}
+        />
+      );
+      fireEvent.mouseOver(container.querySelector('.euiTextTruncate')!);
+      expect(getByRole('tooltip')).toHaveAttribute('data-position', 'right');
+    });
+
     it('does not render a tooltip when not truncating', () => {
       const { container, queryByRole } = render(
         <EuiTextTruncate text="Hello world" width={50} />
```

**File**: `packages/eui/src/components/text_truncate/text_truncate.tsx` (modified, +15/-2)
```diff
@@ -24,7 +24,7 @@ import {
   EuiResizeObserverProps,
 } from '../observer/resize_observer';
 import type { CommonProps } from '../common';
-import { EuiToolTip } from '../tool_tip';
+import { EuiToolTip, EuiToolTipProps } from '../tool_tip';
 
 import { TruncationUtils } from './utils';
 import { euiTextTruncateStyles } from './text_truncate.styles';
@@ -100,6 +100,13 @@ export type EuiTextTruncateProps = Omit<
      * may help resolve any rendering issues.
      */
     calculationDelayMs?: number;
+    /**
+     * Placement of the tooltip that shows the full text while truncating.
+     */
+    toolTipProps?: Pick<
+      EuiToolTipProps,
+      'position' | 'offset' | 'repositionOnScroll'
+    >;
   };
 
 export const EuiTextTruncate: FunctionComponent<EuiTextTruncateProps> = ({
@@ -130,6 +137,7 @@ const EuiTextTruncateWithWidth: FunctionComponent<
   calculationDelayMs,
   containerRef,
   className,
+  toolTipProps,
   ...rest
 }) => {
   // Note: This needs to be a state and not a ref to trigger a rerender on mount
@@ -251,7 +259,12 @@ const EuiTextTruncateWithWidth: FunctionComponent<
   );
 
   return isTruncating ? (
-    <EuiToolTip content={text} disableScreenReaderOutput display="block">
+    <EuiToolTip
+      content={text}
+      disableScreenReaderOutput
+      display="block"
+      {...toolTipProps}
+    >
       {content}
     </EuiToolTip>
   ) : (
```

**File**: `packages/website/docs/utilities/text-truncation.mdx` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ export default () => {
 
 * Screen readers should ignore the truncated text and only read out the full text.
 
-* Sighted mouse users will be able to briefly hover over the truncated text and read the full text in a native browser title tooltip.
+* Sighted mouse users will be able to briefly hover over the truncated text and read the full text in a tooltip. Use `toolTipProps` to control where it opens, e.g. its `position`.
 
 * For mouse users, double clicking to select the truncated line should allow copying the full untruncated text.
 :::
```

#### Recent Merged Pull Requests:
- **PR #10177** (2026-10-05): Release: @elastic/eui v123.1.0 (@mgadewoll)
- **PR #10176** (closed): Release: @elastic/eui v123.1.0 (@mgadewoll)
- **PR #10174** (2026-10-05): [ESLint] Fix license header in EuiListItemLayout test (@Darsh-Nandu)
- **PR #10112** (2026-10-05): [Chore] Add missing release prep commits for #10109 (@mgadewoll)
- **PR #10111** (2026-10-05): [EuiIcon] Adding 11 new icons (@MichaelMarcialis)
- **PR #10110** (2026-10-05): Clarify capitalization guidance for nav/section labels (@JoseLuisGJ)
- **PR #10109** (2026-10-02): [EuiCallOut] Remove the left color highlight (@ryankeairns)
- **PR #10105** (2026-10-01): [EuiFlyout] Expose header, footer, and outer scroll refs (@vianmangal)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
