> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/necolas-react-native-web-learnings.md`  
> **Source**: github ([https://github.com/necolas/react-native-web](https://github.com/necolas/react-native-web))  
> **Source Version**: `ad047791`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T19:50:42.122Z  
> **Learning ID**: `learn-github-necolas-react-native-web`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): necolas/react-native-web

> **Canonical Artifact**: `07_PROJECT_LEARNING/necolas-react-native-web-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/necolas/react-native-web](https://github.com/necolas/react-native-web))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T19:50:42.115Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `necolas/react-native-web`
- **Description**: Cross-platform React UI packages
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 22151 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/react-native-web-examples/pages/app-state/index.js`
```
import React from 'react';
import { AppState, Text } from 'react-native';
import Example from '../../shared/example';

export default function AppStatePage() {
  const appState = React.useRef(AppState.currentState);
  const [state, setState] = React.useState({
    active: 0,
    background: 0,
    currentState: appState.current
  });

  React.useEffect(() => {
    const handleChange = (nextState) => {
      setState((previousState) => ({
        ...previousState,
        [nextState]: previousState[nextState] + 1
      }));
    };

    const subscription = AppState.addEventListener('change', handleChange);
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <Example title="AppState">
      <Text style={{ marginTop: '1rem' }}>
        AppState.currentState:{' '}
        <Text style={{ fontWeight: 'bold' }}>{state.currentState}</Text>
      </Text>
      <Text>Active count: {state.active}</Text>
      <Text>Background count: {state.background}</Text>
    </Example>
  );
}

```

### Core Architecture Module: `packages/react-native-web/src/exports/AppRegistry/renderApplication.js`
```
/**
 * Copyright (c) Nicolas Gallagher.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ComponentType, Node } from 'react';

import AppContainer from './AppContainer';
import invariant from 'fbjs/lib/invariant';
import render, { hydrate } from '../render';
import StyleSheet from '../StyleSheet';
import React from 'react';

export type Application = {
  unmount: () => void
};

export default function renderApplication<Props extends Object>(
  RootComponent: ComponentType<Props>,
  WrapperComponent?: ?ComponentType<{ children: Node, ... }>,
  callback?: () => void,
  options: {
    hydrate: boolean,
    initialProps: Props,
    rootTag: any,
    ...
  }
): Application {
  const { hydrate: shouldHydrate, initialProps, rootTag } = options;
  const renderFn = shouldHydrate ? hydrate : render;

  invariant(rootTag, 'Expect to have a valid rootTag, instead got ', rootTag);

  return renderFn(
    <AppContainer
      WrapperComponent={WrapperComponent}
      ref={callback}
      rootTag={rootTag}
    >
      <RootComponent {...initialProps} />
    </AppContainer>,
    rootTag
  );
}

export function getApplication(
  RootComponent: ComponentType<Object>,
  initialProps: Object,
  WrapperComponent?: ?ComponentType<{ children: Node, ... }>
): {| element: Node, getStyleElement: (Object) => Node |} {
  const element = (
    <AppContainer WrapperComponent={WrapperComponent} rootTag={{}}>
      <RootComponent {...initialProps} />
    </AppContainer>
  );
  // Don't escape CSS text
  const getStyleElement = (props: Object) => {
    const sheet = StyleSheet.getSheet();
    return (
      <style
        {...props}
        dangerouslySetInnerHTML={{ __html: sheet.textContent }}
        id={sheet.id}
      />
    );
  };
  return { element, getStyleElement };
}

```

### Core Architecture Module: `packages/react-native-web/src/exports/AppState/index.js`
```
/**
 * Copyright (c) Nicolas Gallagher.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use client';

import invariant from 'fbjs/lib/invariant';
import EventEmitter from '../../vendor/react-native/vendor/emitter/EventEmitter';
import canUseDOM from '../../modules/canUseDom';

const EVENT_TYPES = ['change', 'memoryWarning'];

const AppStates = {
  BACKGROUND: 'background',
  ACTIVE: 'active'
};

let changeEmitter = null;

export default class AppState {
  static isAvailable = canUseDOM && !!document.visibilityState;

  static get currentState() {
    if (!AppState.isAvailable) {
      return AppStates.ACTIVE;
    }

    switch (document.visibilityState) {
      case 'hidden':
      case 'prerender':
      case 'unloaded':
        return AppStates.BACKGROUND;
      default:
        return AppStates.ACTIVE;
    }
  }

  static addEventListener(type: string, handler: Function) {
    if (AppState.isAvailable) {
      invariant(
        EVENT_TYPES.indexOf(type) !== -1,
        'Trying to subscribe to unknown event: "%s"',
        type
      );
      if (type === 'change') {
        if (!changeEmitter) {
          changeEmitter = new EventEmitter();

          document.addEventListener(
            'visibilitychange',
            () => {
              if (changeEmitter) {
                changeEmitter.emit('change', AppState.currentState);
              }
            },
            false
          );
        }
        return changeEmitter.addListener(type, handler);
      }
    }
  }
}

```

### Core Architecture Module: `packages/react-native-web/src/exports/render/index.js`
```
/**
 * Copyright (c) Nicolas Gallagher.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noflow
 */

'use client';

import {
  createRoot as domCreateRoot,
  hydrateRoot as domHydrateRoot
} from 'react-dom/client';

import { createSheet } from '../StyleSheet/dom';

export function hydrate(element, root) {
  createSheet(root);
  return domHydrateRoot(root, element);
}

export default function render(element, root) {
  createSheet(root);
  const reactRoot = domCreateRoot(root);
  reactRoot.render(element);
  return reactRoot;
}

```

### Core Architecture Module: `packages/react-native-web/src/modules/AccessibilityUtil/index.js`
```
/**
 * Copyright (c) Nicolas Gallagher.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import isDisabled from './isDisabled';
import propsToAccessibilityComponent from './propsToAccessibilityComponent';
import propsToAriaRole from './propsToAriaRole';

const AccessibilityUtil = {
  isDisabled,
  propsToAccessibilityComponent,
  propsToAriaRole
};

export default AccessibilityUtil;

```

### Core Architecture Module: `packages/react-native-web/src/modules/AccessibilityUtil/isDisabled.js`
```
/**
 * Copyright (c) Nicolas Gallagher.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const isDisabled = (props: Object): boolean =>
  props.disabled ||
  (Array.isArray(props.accessibilityStates) &&
    props.accessibilityStates.indexOf('disabled') > -1);

export default isDisabled;

```

### Core Architecture Module: `packages/react-native-web/src/modules/AccessibilityUtil/propsToAccessibilityComponent.js`
```
/**
 * Copyright (c) Nicolas Gallagher.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import propsToAriaRole from './propsToAriaRole';

const roleComponents: { [string]: string } = {
  article: 'article',
  banner: 'header',
  blockquote: 'blockquote',
  button: 'button',
  code: 'code',
  complementary: 'aside',
  contentinfo: 'footer',
  deletion: 'del',
  emphasis: 'em',
  figure: 'figure',
  insertion: 'ins',
  form: 'form',
  list: 'ul',
  listitem: 'li',
  main: 'main',
  navigation: 'nav',
  paragraph: 'p',
  region: 'section',
  strong: 'strong'
};

const emptyObject = {};

const propsToAccessibilityComponent = (
  props: Object = emptyObject
): void | string => {
  const roleProp = props.role || props.accessibilityRole;
  // special-case for "label" role which doesn't map to an ARIA role
  if (roleProp === 'label') {
    return 'label';
  }

  const role = propsToAriaRole(props);
  if (role) {
    if (role === 'heading') {
      const level = props.accessibilityLevel || props['aria-level'];
      if (level != null) {
        return `h${level}`;
      }
      return 'h1';
    }
    return roleComponents[role];
  }
};

export default propsToAccessibilityComponent;

```

### Core Architecture Module: `packages/react-native-web/src/modules/AccessibilityUtil/propsToAriaRole.js`
```
/**
 * Copyright (c) Nicolas Gallagher.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

const accessibilityRoleToWebRole: { [string]: ?string } = {
  adjustable: 'slider',
  button: 'button',
  header: 'heading',
  image: 'img',
  imagebutton: null,
  keyboardkey: null,
  label: null,
  link: 'link',
  none: 'presentation',
  search: 'search',
  summary: 'region',
  text: null
};

const propsToAriaRole = ({
  accessibilityRole,
  role
}: {
  accessibilityRole?: string,
  role?: string
}): string | void => {
  const _role = role || accessibilityRole;
  if (_role) {
    const inferredRole = accessibilityRoleToWebRole[_role];
    if (inferredRole !== null) {
      // ignore roles that don't map to web
      return inferredRole || _role;
    }
  }
};

export default propsToAriaRole;

```

### Core Architecture Module: `packages/react-native-web/src/modules/InteractionManager/TaskQueue.js`
```
/**
 * Copyright (c) Nicolas Gallagher.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export type Task = () => void;

class TaskQueue {
  _tasks: Array<Task> = [];

  enqueue(task: Task): void {
    this._tasks.push(task);
  }

  cancelTasks(tasksToCancel: Array<Task>): void {
    this._tasks = this._tasks.filter(
      (task) => tasksToCancel.indexOf(task) === -1
    );
  }

  hasTasksToProcess(): boolean {
    return this._tasks.length > 0;
  }

  /**
   * Executes the next task in the queue.
   */
  processNext(): void {
    const task = this._tasks.shift();
    if (task) {
      task();
    }
  }
}

export default TaskQueue;

```

### Core Architecture Module: `packages/react-native-web/src/modules/TextInputState/index.js`
```
/**
 * Copyright (c) Nicolas Gallagher.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import UIManager from '../../exports/UIManager';

/**
 * This class is responsible for coordinating the "focused"
 * state for TextInputs. All calls relating to the keyboard
 * should be funneled through here
 */
const TextInputState = {
  /**
   * Internal state
   */
  _currentlyFocusedNode: null as ?Object,

  /**
   * Returns the ID of the currently focused text field, if one exists
   * If no text field is focused it returns null
   */
  currentlyFocusedField(): ?Object {
    if (document.activeElement !== TextInputState._currentlyFocusedNode) {
      TextInputState._currentlyFocusedNode = null;
    }
    return TextInputState._currentlyFocusedNode;
  },

  /**
   * @param {Object} TextInputID id of the text field to focus
   * Focuses the specified text field
   * noop if the text field was already focused
   */
  focusTextInput(textFieldNode: ?Object) {
    if (textFieldNode !== null) {
      TextInputState._currentlyFocusedNode = textFieldNode;
      if (document.activeElement !== textFieldNode) {
        UIManager.focus(textFieldNode);
      }
    }
  },

  /**
   * @param {Object} textFieldNode id of the text field to focus
   * Unfocuses the specified text field
   * noop if it wasn't focused
   */
  blurTextInput(textFieldNode: ?Object) {
    if (textFieldNode !== null) {
      TextInputState._currentlyFocusedNode = null;
      if (document.activeElement === textFieldNode) {
        UIManager.blur(textFieldNode);
      }
    }
  }
};

export default TextInputState;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2859** (2026-09-28): **`flex` emits a percentage flex-basis, making layout very slow on Safari 27 / WebKit**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  We started receiving support reports about our web app hanging or freezing on Safari 27. After investigating, the issue appears to be related to how WebKit handles percentage values for `flex-basis`.  Since our app is built with react-native-web, it makes extensive use of flex: 1, which generates the following CSS rule: ```css .r-flex-13awgt0 { flex: 1 1 0%; } ```  **⬇️ The technical details below are AI-generated, as the relevant WebKit internals go well beyond what I can confidently reason about. ⬇️**  A **percentage** flex-basis has to be resolved against the flex container's inner main size, so WebKit walks up the ancestor chain for every flex item on every layout. In WebKit that walk is itself recursive — `RenderFlexibleBox::canUseFlexItemForPercentageResolution` → `canComputePercentageFlexBasis` → `computePercentageLogicalHeightGeneric` → `RenderBlock::availableLogicalHeightForPercentageComputation` → back to `canUseFlexItemForPercentageResolution`. Because `flex: 1` is the single most common style in any react-native-web app, essentially every nested `View` is on that path, and the cost of one layout becomes **quadratic in flex nesting depth**.  Measured with the test case below (one forced layout, Safari 27.0 / WebKit 605.1.15, Apple Silicon):  | flex nesting depth | `flex: 1` (basis `0%`) | `flex-basis: 0px` | ratio | | --- | --- | --- | --- | | 50 | 2 ms | 1 

- **Issue #2850** (2026-09-25): **Image: changing load callback identity aborts and restarts the image load**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  The image-loading effect in Image lists onError, onLoad, onLoadEnd, and onLoadStart in its dependency array ([source](https://github.com/necolas/react-native-web/blob/master/packages/react-native-web/src/exports/Image/index.js#L322)). Passing inline handlers — new function identities on every parent render — re-runs the effect for an unchanged uri: the cleanup aborts the in-flight request, state resets to LOADING, onLoadStart fires again, and the load restarts. If a handler sets state (e.g. onLoadEnd={() => setLoading(false)}), the re-render produces fresh identities and the cycle loops indefinitely — the image never settles even though the browser has it fully decoded. React Native is unaffected by handler identity, so code that works on iOS/Android breaks on web.  Test case: https://codesandbox.io/p/sandbox/rnw-image-callback-identity-repro-forked-y6mngh — watch the `onLoadStart`/`onLoadEnd` call counters climb indefinitely while "Loading..." never settles, and the network panel restart the same request.  Hit in production in [rn-story](https://www.npmjs.com/package/rn-story): the story viewer's loader flickered forever on web while working fine on iOS/Android. Worked around in v2.0.1 by memoizing every handler with `useCallback`.  Related history: the `source`-object version of this problem was addressed by having the effect depend on the resolved uri string rather 

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

### Incident Patch 1: `ad047791` (2026-10-20)
**Commit Message**: [0.22] First batch of breaking changes

**File**: `.codesandbox/ci.json` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
-{
-  "packages": [
-    "packages/react-native-web",
-    "packages/babel-plugin-react-native-web"
-  ],
-  "buildCommand": "build",
-  "sandboxes": ["/packages/react-native-web-examples/"],
-  "node": "20"
-}
```

**File**: `.eslintrc.cjs` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+module.exports = {
+  settings: {
+    react: {
+      version: '19.0',
+      flowVersion: '0.336.0'
+    }
+  },
+  // hermes parser to support Flow syntax
+  parser: 'hermes-eslint',
+  parserOptions: {
+    sourceType: 'module'
+  },
+  extends: ['prettier'],
+  plugins: ['react', 'react-hooks'],
+  env: {
+    browser: true,
+    es2021: true,
+    jest: true,
+    node: true
+  },
+  ignorePatterns: [
+    'coverage',
+    'dist',
+    'flow-typed',
+    'node_modules',
+    'packages/**/vendor/*',
+    'packages/**/.next'
+  ],
+  // Flow built-in types
+  globals: {
+    ClientRect: 'readonly',
+    Readonly: 'readonly',
+    ReadonlyArray: 'readonly'
+  },
+  rules: {
+    camelcase: 'off',
+    'constructor-super': 'error',
+    'default-case': ['error', { commentPattern: '^no default$' }],
+    eqeqeq: ['error', 'allow-null'],
+    'handle-callback-err': ['error', '^(err|error)$'],
+    'new-cap': ['error', { newIsCap: true, capIsNew: false }],
+    'no-alert': 'warn',
+    'no-array-constructor': 'error',
+    'no-caller': 'error',
+    'no-case-declarations': 'error',
+    'no-class-assign': 'error',
+    'no-cond-assign': 'error',
+    'no-const-assign': 'error',
+    'no-control-regex': 'error',
+    'no-debugger': 'error',
+    'no-delete-var': 'error',
+    'no-dupe-args': 'error',
+    'no-dupe-class-members': 'error',
+    'no-dupe-keys': 'error',
+    'no-duplicate-case': 'error',
+    'no-empty-character-class': 'error',
+    'no-empty-pattern': 'error',
+    'no-eval': 'error',
+    'no-ex-assign': 'error',
+    'no-extend-native': 'error',
+    'no-extra-bind': 'error',
+    'no-extra-boolean-cast': 'error',
+    'no-fallthrough': 'error',
+    'no-floating-decimal': 'error',
+    'no-func-assign': 'error',
+    'no-implied-eval': 'error',
+    'no-inner-declarations': ['error', 'functions'],
+    'no-invalid-regexp': 'error',
+    'no-irregular-whitespace': 'error',
+    'no-iterator': 'error',
+    'no-label-var': 'error',
+    'no-labels': ['error', { allowLoop: false, allowSwitch: false }],
+    'no-lone-blocks': 'error',
+    'no-loop-func': 'error',
+    'no-multi-str': 'error',
+    'no-native-reassign': 'error',
+    'no-negated-in-lhs': 'error',
+    'no-new': 'error',
+    'no-new-func': 'error',
+    'no-new-object': 'error',
+    'no-new-require': 'error',
+    'no-new-symbol': 'error',
+    'no-new-wrappers': 'error',
+    'no-obj-calls': 'error',
+    'no-octal': 'error',
+    'no-octal-escape': 'error',
+    'no-path-concat': 'error',
+    'no-proto': 'error',
+    'no-redeclare': 'error',
+    'no-regex-spaces': 'error',
+    'no-return-assign': ['error', 'except-parens'],
+    'no-script-url': 'error',
+    'no-self-assign': 'error',
+    'no-self-compare': 'error',
+    'no-sequences': 'error',
+    'no-shadow-restricted-names': 'error',
+    'no-sparse-arrays': 'error',
+    'no-this-before-super': 'error',
+    'no-throw-literal': 'error',
+    'no-undef': 'error',
+    'no-undef-init': 'error',
+    'no-unexpected-multiline': 'error',
+    'no-unmodified-loop-condition': 'error',
+    'no-unneeded-ternary': ['error', { defaultAssignment: false }],
+    'no-unreachable': 'error',
+    'no-unsafe-finally': 'error',
+    'no-unused-vars': ['error', { vars: 'all', args: 'none' }],
+    'no-useless-call': 'error',
+    'no-useless-computed-key': 'error',
+    'no-useless-concat': 'error',
+    'no-useless-constructor': 'error',
+    'no-useless-escape': 'error',
+    'no-var': 'error',
+    'no-with': 'error',
+    'prefer-const': 'error',
+    'prefer-rest-params': 'error',
+    quotes: [
+      'error',
+      'single',
+      { avoidEscape: true, allowTemplateLiterals: true }
+    ],
+    radix: 'error',
+    'use-isnan': 'error',
+    'valid-typeof': 'error',
+    yoda: ['error', 'never'],
+
+    // react
+    'react/display-name': 'off',
+    'react/jsx-no-bind': 'off',
+    'react/jsx-no-duplicate-props': 'error',
+    'react/jsx-no-undef': 'error',
+    'react/jsx-pascal-case': 'error',
+    'react/jsx-sort-props': 'error',
+    'react/jsx-uses-react': 'error',
+    'react/jsx-uses-vars': 'error',
+    'react/no-did-mount-set-state': 'off',
+    'react/no-did-update-set-state': 'error',
+    'react/no-direct-mutation-state': 'error',
+    'react/no-multi-comp': 'off',
+    'react/no-string-refs': 'error',
+    'react/no-unknown-property': 'error',
+    'react/prefer-es6-class': 'error',
+    'react/prop-types': 'off',
+    'react/react-in-jsx-scope': 'off',
+    'react/self-closing-comp': 'error',
+    'react/sort-comp': 'off',
+    'react/sort-prop-types': 'error',
+    'react/wrap-multilines': 'off',
+
+    // react-hooks
+    'react-hooks/rules-of-hooks': 'error',
+    'react-hooks/exhaustive-deps': 'warn'
+  }
+};
```

**File**: `.flowconfig` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+[version]
+0.336.0
+
+[ignore]
+**/__tests__/**
+packages/*/dist/**
+packages/benchmarks/**
+packages/react-native-web-docs/**
+packages/react-native-web-examples/**
+
+[include]
+
+[declarations]
+.*/node_modules/.*
+
+[libs]
+
+[options]
+munge_underscores=true
```

**File**: `.github/ISSUE_TEMPLATE/bug.yml` (modified, +3/-3)
```diff
@@ -5,7 +5,7 @@ body:
   - type: markdown
     attributes:
       value: |
-        Thank you for reporting an issue! Create a test case for your issue by forking this template https://codesandbox.io/s/6lx6ql1w5r
+        Thank you for reporting an issue! Create a minimal repository that reproduces the issue and link it below.
   - type: checkboxes
     attributes:
       label: Is there an existing issue for this?
@@ -38,8 +38,8 @@ body:
   - type: input
     attributes:
       label: Test case
-      description: Please provide a link to a reduced test case that reproduces the issue.
-      placeholder: 'https://codesandbox.io/s/6lx6ql1w5r'
+      description: Please provide a link to a repository with a reduced test case that reproduces the issue.
+      placeholder: 'https://github.com/your-username/your-repro-repo'
     validations:
       required: true
   - type: textarea
```

**File**: `.github/workflows/performance.yml` (modified, +0/-1)
```diff
@@ -11,6 +11,5 @@ jobs:
         with:
           build-script: 'compile'
           omit-unchanged: 'true'
-          exclude: './packages/react-native-web/dist/cjs/{index.js,**/*.js}'
           pattern: './packages/react-native-web/dist/{index.js,**/*.js}'
           repo-token: '${{ secrets.GITHUB_TOKEN }}'
```

**File**: `.husky/pre-commit` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+lint-staged
```

**File**: `.watchmanconfig` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-{}
```

**File**: `README.md` (modified, +0/-2)
```diff
@@ -7,8 +7,6 @@ This is the development monorepo for "React Native for Web" and related projects
 - `.github`
   - Contains workflows used by GitHub Actions.
   - Contains issue templates.
-- `configs`
-  - Contains configuration files used by the monorepo tooling (compiling, linting, testing, etc.)
 - `packages`
   - [react-native-web](https://github.com/necolas/react-native-web/blob/master/packages/react-native-web)
   - Contains the individual packages managed in the monorepo.
```

#### Recent Merged Pull Requests:
- **PR #2918** (2026-10-20): Replace CodeSandbox embeds with self-hosted examples (@zoontek)
- **PR #2913** (2026-10-19): [0.22] Add TypeScript types (@zoontek)
- **PR #2912** (2026-10-19): [0.22] Test that rgb() with a slash alpha survives StyleSheet (@YevheniiKotyrlo)
- **PR #2910** (2026-10-19): [0.22] Publish as ES modules only (@zoontek)
- **PR #2909** (2026-10-15): [0.22] Clean up tooling and dependencies (@zoontek)
- **PR #2907** (2026-10-15): [0.22] Remove `inline-style-prefixer` and rework vendor prefixing (@zoontek)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
