# Forensic Learning Record (Deep Inspection): necolas/react-native-web

> **Canonical Artifact**: `07_PROJECT_LEARNING/necolas-react-native-web-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/necolas/react-native-web](https://github.com/necolas/react-native-web))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:07:09.114Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `necolas/react-native-web`
- **Description**: Cross-platform React UI packages
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 22138 stars

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

export default function renderApplication<Props: Object>(
  RootComponent: ComponentType<Props>,
  WrapperComponent?: ?ComponentType<*>,
  callback?: () => void,
  options: {
    hydrate: boolean,
    initialProps: Props,
    rootTag: any
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
  WrapperComponent?: ?ComponentType<*>
): {| element: Node, getStyleElement: (Object) => Node |} {
  const element = (
    <AppContainer WrapperComponent={WrapperComponent} rootTag={{}}>
      <RootComponent {...initialProps} />
    </AppContainer>
  );
  // Don't escape CSS text
  const getStyleElement = (props) => {
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

// Android 4.4 browser
const isPrefixed =
  canUseDOM &&
  !document.hasOwnProperty('hidden') &&
  document.hasOwnProperty('webkitHidden');

const EVENT_TYPES = ['change', 'memoryWarning'];
const VISIBILITY_CHANGE_EVENT = isPrefixed
  ? 'webkitvisibilitychange'
  : 'visibilitychange';
const VISIBILITY_STATE_PROPERTY = isPrefixed
  ? 'webkitVisibilityState'
  : 'visibilityState';

const AppStates = {
  BACKGROUND: 'background',
  ACTIVE: 'active'
};

let changeEmitter = null;

export default class AppState {
  static isAvailable = canUseDOM && !!document[VISIBILITY_STATE_PROPERTY];

  static get currentState() {
    if (!AppState.isAvailable) {
      return AppStates.ACTIVE;
    }

    switch (document[VISIBILITY_STATE_PROPERTY]) {
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
            VISIBILITY_CHANGE_EVENT,
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

### Core Architecture Module: `packages/react-native-web/src/exports/InteractionManager/TaskQueue.js`
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

import invariant from 'fbjs/lib/invariant';

type SimpleTask = {|
  name: string,
  run: () => void
|};
type PromiseTask = {|
  name: string,
  gen: () => Promise<void>
|};
export type Task = SimpleTask | PromiseTask | (() => void);

class TaskQueue {
  constructor({ onMoreTasks }: { onMoreTasks: () => void, ... }) {
    this._onMoreTasks = onMoreTasks;
    this._queueStack = [{ tasks: [], popable: true }];
  }

  enqueue(task: Task): void {
    this._getCurrentQueue().push(task);
  }

  enqueueTasks(tasks: Array<Task>): void {
    tasks.forEach((task) => this.enqueue(task));
  }

  cancelTasks(tasksToCancel: Array<Task>): void {
    this._queueStack = this._queueStack
      .map((queue) => ({
        ...queue,
        tasks: queue.tasks.filter((task) => tasksToCancel.indexOf(task) === -1)
      }))
      .filter((queue, idx) => queue.tasks.length > 0 || idx === 0);
  }

  hasTasksToProcess(): boolean {
    return this._getCurrentQueue().length > 0;
  }

  /**
   * Executes the next task in the queue.
   */
  processNext(): void {
    const queue = this._getCurrentQueue();
    if (queue.length) {
      const task = queue.shift();
      try {
        if (typeof task === 'object' && task.gen) {
          this._genPromise(task);
        } else if (typeof task === 'object' && task.run) {
          task.run();
        } else {
          invariant(
            typeof task === 'function',
            'Expected Function, SimpleTask, or PromiseTask, but got:\n' +
              JSON.stringify(task, null, 2)
          );
          task();
        }
      } catch (e) {
        e.message =
          'TaskQueue: Error with task ' + (task.name || '') + ': ' + e.message;
        throw e;
      }
    }
  }

  _queueStack: Array<{
    tasks: Array<Task>,
    popable: boolean,
    ...
  }>;
  _onMoreTasks: () => void;

  _getCurrentQueue(): Array<Task> {
    const stackIdx = this._queueStack.length - 1;
    const queue = this._queueStack[stackIdx];
    if (queue.popable && queue.tasks.length === 0 && stackIdx > 0) {
      this._queueStack.pop();
      return this._getCurrentQueue();
    } else {
      return queue.tasks;
    }
  }

  _genPromise(task: PromiseTask) {
    const length = this._queueStack.push({ tasks: [], popable: false });
    const stackIdx = length - 1;
    const stackItem = this._queueStack[stackIdx];
    task
      .gen()
      .then(() => {
        stackItem.popable = true;
        this.hasTasksToProcess() && this._onMoreTasks();
      })
      .catch((ex) => {
        setTimeout(() => {
          ex.message = `TaskQueue: Error resolving Promise in task ${task.name}: ${ex.message}`;
          throw ex;
        }, 0);
      });
  }
}

export default TaskQueue;

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

const roleComponents = {
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

const accessibilityRoleToWebRole = {
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
  _currentlyFocusedNode: (null: ?Object),

  /**
   * Returns the ID of the currently focused text field, if one exists
   * If no text field is focused it returns null
   */
  currentlyFocusedField(): ?Object {
    if (document.activeElement !== this._currentlyFocusedNode) {
      this._currentlyFocusedNode = null;
    }
    return this._currentlyFocusedNode;
  },

  /**
   * @param {Object} TextInputID id of the text field to focus
   * Focuses the specified text field
   * noop if the text field was already focused
   */
  focusTextInput(textFieldNode: ?Object) {
    if (textFieldNode !== null) {
      this._currentlyFocusedNode = textFieldNode;
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
      this._currentlyFocusedNode = null;
      if (document.activeElement === textFieldNode) {
        UIManager.blur(textFieldNode);
      }
    }
  }
};

export default TextInputState;

```

### Core Architecture Module: `packages/react-native-web/src/modules/useResponderEvents/utils.js`
```
/**
 * Copyright (c) Nicolas Gallagher
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import isSelectionValid from '../../modules/isSelectionValid';

const keyName = '__reactResponderId';

function getEventPath(domEvent: any): Array<any> {
  // The 'selectionchange' event always has the 'document' as the target.
  // Use the anchor node as the initial target to reconstruct a path.
  // (We actually only need the first "responder" node in practice.)
  if (domEvent.type === 'selectionchange') {
    const target = window.getSelection().anchorNode;
    return composedPathFallback(target);
  } else {
    const path =
      domEvent.composedPath != null
        ? domEvent.composedPath()
        : composedPathFallback(domEvent.target);
    return path;
  }
}

function composedPathFallback(target: any): Array<any> {
  const path = [];
  while (target != null && target !== document.body) {
    path.push(target);
    target = target.parentNode;
  }
  return path;
}

/**
 * Retrieve the responderId from a host node
 */
function getResponderId(node: any): ?number {
  if (node != null) {
    return node[keyName];
  }
  return null;
}

/**
 * Store the responderId on a host node
 */
export function setResponderId(node: any, id: number) {
  if (node != null) {
    node[keyName] = id;
  }
}

/**
 * Filter the event path to contain only the nodes attached to the responder system
 */
export function getResponderPaths(domEvent: any): {|
  idPath: Array<number>,
  nodePath: Array<any>
|} {
  const idPath = [];
  const nodePath = [];
  const eventPath = getEventPath(domEvent);
  for (let i = 0; i < eventPath.length; i++) {
    const node = eventPath[i];
    const id = getResponderId(node);
    if (id != null) {
      idPath.push(id);
      nodePath.push(node);
    }
  }
  return { idPath, nodePath };
}

/**
 * Walk the paths and find the first common ancestor
 */
export function getLowestCommonAncestor(
  pathA: Array<any>,
  pathB: Array<any>
): any {
  let pathALength = pathA.length;
  let pathBLength = pathB.length;
  if (
    // If either path is empty
    pathALength === 0 ||
    pathBLength === 0 ||
    // If the last elements aren't the same there can't be a common ancestor
    // that is connected to the responder system
    pathA[pathALength - 1] !== pathB[pathBLength - 1]
  ) {
    return null;
  }

  let itemA = pathA[0];
  let indexA = 0;
  let itemB = pathB[0];
  let indexB = 0;

  // If A is deeper, skip indices that can't match.
  if (pathALength - pathBLength > 0) {
    indexA = pathALength - pathBLength;
    itemA = pathA[indexA];
    pathALength = pathBLength;
  }

  // If B is deeper, skip indices that can't match
  if (pathBLength - pathALength > 0) {
    indexB = pathBLength - pathALength;
    itemB = pathB[indexB];
    pathBLength = pathALength;
  }

  // Walk in lockstep until a match is found
  let depth = pathALength;
  while (depth--) {
    if (itemA === itemB) {
      return itemA;
    }
    itemA = pathA[indexA++];
    itemB = pathB[indexB++];
  }
  return null;
}

/**
 * Determine whether any of the active touches are within the current responder.
 * This cannot rely on W3C `targetTouches`, as neither IE11 nor Safari implement it.
 */
export function hasTargetTouches(target: any, touches: any): boolean {
  if (!touches || touches.length === 0) {
    return false;
  }
  for (let i = 0; i < touches.length; i++) {
    const node = touches[i].target;
    if (node != null) {
      if (target.contains(node)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Ignore 'selectionchange' events that don't correspond with a person's intent to
 * select text.
 */
export function hasValidSelection(domEvent: any): boolean {
  if (domEvent.type === 'selectionchange') {
    return isSelectionValid();
  }
  return domEvent.type === 'select';
}

/**
 * Events are only valid if the primary button was used without specific modifier keys.
 */
export function isPrimaryPointerDown(domEvent: any): boolean {
  const { altKey, button, buttons, ctrlKey, type } = domEvent;
  const isTouch = type === 'touchstart' || type === 'touchmove';
  const isPrimaryMouseDown =
    type === 'mousedown' && (button === 0 || buttons === 1);
  const isPrimaryMouseMove = type === 'mousemove' && buttons === 1;
  const noModifiers = altKey === false && ctrlKey === false;

  if (
    isTouch ||
    (isPrimaryMouseDown && noModifiers) ||
    (isPrimaryMouseMove && noModifiers)
  ) {
    return true;
  }
  return false;
}

```

### Core Architecture Module: `configs/babel.config.js`
```
const createConfig = ({ modules }) => {
  const plugins = [
    '@babel/plugin-transform-flow-strip-types',
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    ['@babel/plugin-proposal-object-rest-spread', { useBuiltIns: true }],
    '@babel/plugin-proposal-nullish-coalescing-operator',
    [
      '@babel/plugin-transform-runtime',
      {
        version: '7.18.6'
      }
    ]
  ].concat(modules ? ['babel-plugin-add-module-exports'] : []);

  return {
    assumptions: {
      iterableIsArray: true
    },
    comments: true,
    presets: [
      [
        '@babel/preset-env',
        {
          loose: true,
          modules,
          exclude: ['transform-typeof-symbol'],
          targets: {
            browsers: [
              'chrome 49',
              // https://www.mozilla.org/en-US/firefox/all/#product-desktop-esr
              'firefox 91',
              'ios_saf 10',
              'safari 10',
              // https://docs.microsoft.com/en-us/DeployEdge/microsoft-edge-support-lifecycle
              'edge 94',
              'opera 36'
            ]
          }
        }
      ],
      '@babel/preset-react',
      '@babel/preset-flow'
    ],
    plugins: plugins
  };
};

module.exports = function (api) {
  if (api) {
    api.cache(true);
  }

  return process.env.BABEL_ENV === 'commonjs' || process.env.NODE_ENV === 'test'
    ? createConfig({ modules: 'commonjs' })
    : createConfig({ modules: false });
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2859** (2026-09-28): **`flex` emits a percentage flex-basis, making layout very slow on Safari 27 / WebKit**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  We started receiving support reports about our web app hanging or freezing on Safari 27. After investigating, the issue appears to be related to how WebKit handles percentage values for `flex-basis`.  Since our app is built with react-native-web, it makes extensive use of flex: 1, which generates the following CSS rule: ```css .r-flex-13awgt0 { flex: 1 1 0%; } ```  **⬇️ The technical details below are AI-generated, as the relevant WebKit internals go well beyond what I can confidently reason about. ⬇️**  A **percentage** flex-basis has to be resolved against the flex container's inner main size, so WebKit walks up the ancestor chain for every flex item on every layout. In WebKit that walk is itself recursive — `RenderFlexibleBox::canUseFlexItemForPercentageResolution` → `canComputePercentageFlexBasis` → `computePercentageLogicalHeightGeneric` → `RenderBlock::availableLogicalHeightForPercentageComputation` → back to `canUseFlexItemForPercentageResolution`. Because `flex: 1` is the single most common style in any react-native-web app, essentially every nested `View` is on that path, and the cost of one layout becomes **quadratic in flex nesting depth**.  Measured with the test case below (one forced layout, Safari 27.0 / WebKit 605.1.15, Apple Silicon):  | flex nesting depth | `flex: 1` (basis `0%`) | `flex-basis: 0px` | ratio | | --- | --- | --- | --- | | 50 | 2 ms | 1 
  **Post-Mortem & Fix Analysis**:
  > Closing, because Apple fixed the WebKit bug.

- **Issue #2850** (2026-09-25): **Image: changing load callback identity aborts and restarts the image load**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  The image-loading effect in Image lists onError, onLoad, onLoadEnd, and onLoadStart in its dependency array ([source](https://github.com/necolas/react-native-web/blob/master/packages/react-native-web/src/exports/Image/index.js#L322)). Passing inline handlers — new function identities on every parent render — re-runs the effect for an unchanged uri: the cleanup aborts the in-flight request, state resets to LOADING, onLoadStart fires again, and the load restarts. If a handler sets state (e.g. onLoadEnd={() => setLoading(false)}), the re-render produces fresh identities and the cycle loops indefinitely — the image never settles even though the browser has it fully decoded. React Native is unaffected by handler identity, so code that works on iOS/Android breaks on web.  Test case: https://codesandbox.io/p/sandbox/rnw-image-callback-identity-repro-forked-y6mngh — watch the `onLoadStart`/`onLoadEnd` call counters climb indefinitely while "Loading..." never settles, and the network panel restart the same request.  Hit in production in [rn-story](https://www.npmjs.com/package/rn-story): the story viewer's loader flickered forever on web while working fine on iOS/Android. Worked around in v2.0.1 by memoizing every handler with `useCallback`.  Related history: the `source`-object version of this problem was addressed by having the effect depend on the resolved uri string rather 

- **Issue #2806** (2026-09-25): **Missing `InputAccessoryView` export?**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  I might be misunderstanding how the `react-native-web` package is meant to work. So far, it’s been great for rendering my `react-native` UI library in a Storybook web app, simply by aliasing `react-native` to `react-native-web`.  That worked fine until I needed to import `InputAccessoryView`. Importing this component throws an error:  ``` The requested module ... does not provide an export named 'InputAccessoryView' ```  What’s confusing is that `react-native-web` actually does include an `InputAccessoryView` module, it just isn’t exported from the package’s entry file. I was able to work around this by applying a [pnpm patch](https://pnpm.io/cli/patch) and adding the following line to `dist/index.js` in the `react-native-web` package:  ```ts export { default as InputAccessoryView } from './exports/InputAccessoryView'; ```  Is there a configuration step I’m missing here? What's the intended setup?  Thanks in advance!   ### Expected behavior  Expected behaviour is for RNW shim to load and no error is thrown.  ### Steps to reproduce  ```ts import { InputAccessoryView } from 'react-native' // This is aliased to `react-native-web` ``` Above line throws error  ### Test case  https://codesandbox.io/p/devbox/react-native-web-test-7zgmfn  ### Additional comments  <img width="1196" height="628" alt="Image" src="https://github.com/user-attachments/assets/85ffa133-4af3-45cd-8728-
  **Post-Mortem & Fix Analysis**:
  > Fixed in [v0.21.3](https://github.com/necolas/react-native-web/releases/tag/0.21.3)

- **Issue #2804** (2026-05-16): **ImageLoader memory leak**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  Open Chrome devtools, go to the Memory tab, take a heap snapshot (Detached elements) you should see a lot of `img` instances that are not garbage collected.   <img width="726" height="310" alt="Image" src="https://github.com/user-attachments/assets/f3e3fd51-ff71-4889-85f4-a01778672a3e" />  ### Expected behavior  zero Detached `img`   ### Steps to reproduce  1. create app 2. render 10 img 3. unmount them 4. take a heap snapshot (Detached elements)  ### Test case  https://snack.expo.dev/@retyui/imageloader-memory-leak  ### Additional comments  _No response_
  **Post-Mortem & Fix Analysis**:
  > Here is the patch that I use  ```diff diff --git a/node_modules/react-native-web/dist/modules/ImageLoader/index.js b/node_modules/react-native-web/dist/modules/ImageLoader/index.js index 008d0d6..d76d643 100644 --- a/node_modules/react-native-web/dist/modules/ImageLoader/index.js +++ b/node_modules/react-native-web/dist/modules/ImageLoader/index.js @@ -119,12 +119,19 @@ var ImageLoader = {    },    load: function load(uri, onLoad, onError) {      id += 1; +    var reqId = "" + id;      var image = new window.Image(); -    image.onerror = onError; +    image.onerror = function (e) { +      ImageLoader.abort(reqId); // Fix memory leak by removing from requests on error +      if (typeof onError === 'function') { +        return onError(e); +      } +    };        image.onload = function (e) {        // avoid blocking the main thread        var onDecode = function onDecode() { +        ImageLoader.abort(reqId); // Fix memory leak by removing from requests on load          return onLoad({ 
  > Hi, with the changes provided in the patch, `getSize` won't work. `ImageLoader.abort` should be called after calling `onLoad` or `onError`.
  > > `getSize` won't work  could you please explain more ?

- **Issue #2801** (2025-08-29): **[Bug] Wrong `pointerEvents` behaviour on 0.21.1**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  While working on the bump we've noticed that `pointerEvents` behaviour has changed causing multiple strange bugs in the app. After an investigation I noticed that in many places the `pointerEvents` got overridden by other inherited values.   After creating a minimal reproduction I discovered that the `pointerEvents` _worked correctly in the previous version_. However they must have been passed to components via `StyleSheet.create()`. When passed by inline styling or a JavaScript object, `box-none` nor `box-only` properties were **not** applied.   The previous version worked correctly, because even when passing the `pointer-event` only to the closest children via `> *` CSS was taking care of everything via inheritance.   https://github.com/user-attachments/assets/e75a15fa-967a-4d34-8edf-daa13d22e1e8  ### Expected behavior  Passing the `pointerEvents` property should behave the same no matter if passed by `StyleSheet.create()` or inline styling.   What's more I believe that the previous StyleSheet.create() implementation should be brought back, since it worked as I would expect:  ``` <View style={styles.pointerEventsNone}> // none   <View style={styles.pointerEventsBoxNone}> // none   // From here we should have 'auto'     <View>        <View          onClick={() => {           console.log("Should work");         }}       />     </View>   </View> </View> ```  The only th
  **Post-Mortem & Fix Analysis**:
  > Thanks for providing the kind of debugging and write up that OSS projects dream about.   @hassankhan #2797 appears to be the cause of this regression.   I'll leave you both to determine the best way to fix this
  > In the implementation of `StyleSheet.create()` I see that the function returns the same object it has received as argument. In theory we could extract the logic related to style compilation and execute it for all styles passed to components:  ``` function generateCSSClasses(styles) {   Object.keys(styles).forEach(key => {     var styleObj = styles[key];     // Only compile at runtime if the style is not already compiled     if (styleObj != null && styleObj.$$css !== true) {       var compiledStyles;       if (key.indexOf('$raw') > -1) {         compiledStyles = compileAndInsertReset(styleObj, key.split('$raw')[0]);       } else {         if (process.env.NODE_ENV !== 'production') {           validate(styleObj);           styles[key] = Object.freeze(styleObj);         }         compiledStyles = compileAndInsertAtomic(styleObj);       }       staticStyleMap.set(styleObj, compiledStyles);     }   }); }  function create(styles) {   generateCSSClasses(styles)   return styles; } ```  In the 
  > The problem is that inline objects are recreated each render. Only the static styles are worth compiling and caching.  But `pointerEvents` had some[ special handling](https://github.com/necolas/react-native-web/blob/2da322a8f9da54f842d780edd42f2636de9871ba/packages/react-native-web/src/modules/createDOMProps/index.js#L29-L42) to map the prop to compiled styles. So that could probably be done for `pointerEvents` in inline styles too

- **Issue #2794** (2025-08-11): **Regression: pointer-events:"none" is no longer respected by child components in version 0.21.0**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  I have a view which has pointer events set to `none`, however a child component with an onPress event can now be triggered. Reverting to 0.20.0 fixes the issue. I suspect #2789 caused this regression  ### Expected behavior  pointer-events:"none" should block all child/grandchild pointer events  ### Steps to reproduce  1. Create a View with pointer-events:"none"  2. Create a child component with an onPress event 3. Press the child and see the event is triggered  ### Test case  NA  ### Additional comments  _No response_
  **Post-Mortem & Fix Analysis**:
  > @hassankhan @EvanBacon IIRC you wanted #2789 for a use case in react-navigation
  > @necolas I'll have a look at it this week

- **Issue #2792** (2026-05-16): **Image component causes unnecessary re-renders when `defaultSource` is emply**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  Image component changes state onLoad event, that causes lots of unnecessary re-renders if `defaultSource` is empty:  <img src="https://github.com/user-attachments/assets/0edd2409-9617-4a14-893e-e9cc5a20d4e0" />  these lines:  https://github.com/necolas/react-native-web/blob/3c27decd16e1cc62736e33d4458372b42f186f42/packages/react-native-web/src/exports/Image/index.js#L282-L299  ### Expected behavior  No set state inside Image component if `defaultSource` is empty   ### Steps to reproduce  1. Render the image: `<Image defaultSource={null} source={...} />` 2. Open a React Profile to check renders  ### Test case  https://codesandbox.io/skip  ### Additional comments  Here is a patch (if we ignore those state changes nothing changes image will be displayed as it was before)  [react-native-web+0.17.7+001+no-image-state-change.txt](https://github.com/user-attachments/files/21528561/react-native-web%2B0.17.7%2B001%2Bno-image-state-change.txt)

- **Issue #2788** (2025-07-16): **Unable to resolve "./BaseViewConfig" from "node_modules/react-native/Libraries/NativeComponent/PlatformBaseViewConfig.js"**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  Basically I had a RN project using: - Expo SDK 53 - RN 0.79.5 - RNW 0.20.0  And every thing was working perfectly even on the web! So I decided to migrate another RN project based on Expo SDK 52 to 53 using my first project as a reference.  **Except**, I got stuck in the "Unable to resolve …" hell on React Native Web. For a reason I can't understand, the project doesn't resolve files like `PlatformBaseViewConfig.js`, and I check and it does exist, but only `PlatformBaseViewConfig.js.flow`.  But same thing in the first project and that's not an issue, so I'm lost.  ### Expected behavior  It should work or at least have a clear error message  ### Steps to reproduce  Hard to say, basically, a complex RN Project, that works fine on android and iOS, but on the web throws errors like: ``` Unable to resolve RNFile from RNPackage ```  ### Test case  Sorry I don't have a link but I see a lot of common issue on the web  ### Additional comments  _No response_
  **Post-Mortem & Fix Analysis**:
  > The solution I found is to delete everything inside my /app folder (I'm using expo router). And add pages back 1 by 1, trying to find the pages causing issues by dichotomy 😅  It's gonna take a while **but** it works

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

### Incident Patch 1: `c0d4ff76` (2026-09-25)
**Commit Message**: [fix] Export InputAccessoryView from the package entry

**File**: `package-lock.json` (modified, +0/-43)
```diff
@@ -3365,42 +3365,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/@types/prop-types": {
-      "version": "15.7.5",
-      "dev": true,
-      "license": "MIT",
-      "optional": true,
-      "peer": true
-    },
-    "node_modules/@types/react": {
-      "version": "18.0.28",
-      "dev": true,
-      "license": "MIT",
-      "optional": true,
-      "peer": true,
-      "dependencies": {
-        "@types/prop-types": "*",
-        "@types/scheduler": "*",
-        "csstype": "^3.0.2"
-      }
-    },
-    "node_modules/@types/react-dom": {
-      "version": "18.0.10",
-      "dev": true,
-      "license": "MIT",
-      "optional": true,
-      "peer": true,
-      "dependencies": {
-        "@types/react": "*"
-      }
-    },
-    "node_modules/@types/scheduler": {
-      "version": "0.16.2",
-      "dev": true,
-      "license": "MIT",
-      "optional": true,
-      "peer": true
-    },
     "node_modules/@types/stack-utils": {
       "version": "2.0.3",
       "dev": true,
@@ -5410,13 +5374,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/csstype": {
-      "version": "3.1.1",
-      "dev": true,
-      "license": "MIT",
-      "optional": true,
-      "peer": true
-    },
     "node_modules/d3-color": {
       "version": "3.1.0",
       "license": "ISC",
```

**File**: `packages/react-native-web/src/index.js` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@ export { default as CheckBox } from './exports/CheckBox';
 export { default as FlatList } from './exports/FlatList';
 export { default as Image } from './exports/Image';
 export { default as ImageBackground } from './exports/ImageBackground';
+export { default as InputAccessoryView } from './exports/InputAccessoryView';
 export { default as KeyboardAvoidingView } from './exports/KeyboardAvoidingView';
 export { default as Modal } from './exports/Modal';
 export { default as Picker } from './exports/Picker';
```

---

### Incident Patch 2: `6dcfb4a6` (2026-09-25)
**Commit Message**: [fix] Image: update load handlers ref in a layout effect

**File**: `packages/react-native-web/src/exports/Image/index.js` (modified, +2/-1)
```diff
@@ -20,6 +20,7 @@ import ImageLoader from '../../modules/ImageLoader';
 import PixelRatio from '../PixelRatio';
 import StyleSheet from '../StyleSheet';
 import TextAncestorContext from '../Text/TextAncestorContext';
+import useLayoutEffect from '../../modules/useLayoutEffect';
 import View from '../View';
 import { warnOnce } from '../../modules/warnOnce';
 
@@ -285,7 +286,7 @@ const Image: React.AbstractComponent<
     onLoadEnd,
     onLoadStart
   });
-  React.useEffect(() => {
+  useLayoutEffect(() => {
     loadEventHandlersRef.current = { onError, onLoad, onLoadEnd, onLoadStart };
   });
 
```

---

### Incident Patch 3: `cc1b13dd` (2026-09-25)
**Commit Message**: Fix useColorScheme subscription lifecycle (#2853)

**File**: `packages/react-native-web/src/exports/useColorScheme/__tests__/index-test.js` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * @flow
+ */
+
+import * as React from 'react';
+import { render } from '@testing-library/react';
+import Appearance from '../../Appearance';
+import useColorScheme from '..';
+
+describe('useColorScheme', () => {
+  test('keeps its subscription active across rerenders', () => {
+    const remove = jest.fn();
+    const addChangeListener = jest
+      .spyOn(Appearance, 'addChangeListener')
+      .mockReturnValue({ remove });
+
+    function Component({ label }): React.Node {
+      const colorScheme = useColorScheme();
+      return <div>{`${label}:${colorScheme}`}</div>;
+    }
+
+    const { rerender, unmount } = render(<Component label="first" />);
+    expect(addChangeListener).toHaveBeenCalledTimes(1);
+    expect(remove).not.toHaveBeenCalled();
+
+    rerender(<Component label="second" />);
+    expect(addChangeListener).toHaveBeenCalledTimes(1);
+    expect(remove).not.toHaveBeenCalled();
+
+    unmount();
+    expect(remove).toHaveBeenCalledTimes(1);
+  });
+});
```

**File**: `packages/react-native-web/src/exports/useColorScheme/index.js` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ export default function useColorScheme(): ColorSchemeName {
     }
     const { remove } = Appearance.addChangeListener(listener);
     return remove;
-  });
+  }, []);
 
   return colorScheme;
 }
```

---

### Incident Patch 4: `3abdab42` (2026-09-25)
**Commit Message**: Fix TextInput placeholder documentation (#2854)

**File**: `packages/react-native-web-docs/src/pages/docs/components/text-input.md` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ Callback that is called when the text input's selection changes.
 Callback that is called when the keyboard's submit button is pressed. When `multiline={true}`, this is only called if `blurOnSubmit={true}`.
 {% endcall %}
 
-{% call macro.prop('placeholder', '?boolean') %}
+{% call macro.prop('placeholder', '?string') %}
 Text that appears in the form control when it has no value set.
 {% endcall %}
 
```

---

### Incident Patch 5: `4aa12f52` (2026-09-25)
**Commit Message**: Fix TextInput maxLength documentation (#2856)

**File**: `packages/react-native-web-docs/src/pages/docs/components/text-input.md` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ Hints at the type of data that might be entered by the user while editing the el
 Equivalent to [HTMLElement.lang](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang). This prop is used to infer writing direction if no `dir` is set.
 {% endcall %}
 
-{% call macro.prop('maxLength', '?string') %}
+{% call macro.prop('maxLength', '?number') %}
 Equivalent to [HTMLElement.maxlength](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/maxlength).
 {% endcall %}
 
```

---

### Incident Patch 6: `d9021583` (2025-10-11)
**Commit Message**: Fix memory leak in AnimatedProps constructor

Removes __attach() call from AnimatedProps constructor that caused
duplicate child additions when combined with lifecycle hook.

The constructor was calling __attach(), then useLayoutEffect in
useAnimatedProps called it again on the same instance, causing each
AnimatedProps to be added as a child twice to its parent nodes.
This led to unbounded memory growth in applications with frequent
re-renders.

This change aligns with React Native core implementation, which does
not call __attach() in the AnimatedProps constructor

**File**: `packages/react-native-web/src/vendor/react-native/Animated/nodes/AnimatedProps.js` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ class AnimatedProps extends AnimatedNode {
     }
     this._props = props;
     this._callback = callback;
-    this.__attach();
   }
 
   __getValue(): Object {
```

---

### Incident Patch 7: `fb510d04` (2025-08-29)
**Commit Message**: Fix benchmarks

* Import 'createRoot' from the right place
* Update class name hashes that have changed

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -15326,8 +15326,8 @@
         "classnames": "^2.3.1",
         "d3-scale-chromatic": "^3.0.0",
         "prop-types": "^15.6.0",
-        "react": ">=17.0.2",
-        "react-dom": ">=17.0.2",
+        "react": "^19.0.0",
+        "react-dom": "^19.0.0",
         "react-native-web": "0.18.10"
       },
       "devDependencies": {
```

**File**: `packages/benchmarks/package.json` (modified, +2/-2)
```diff
@@ -11,8 +11,8 @@
     "classnames": "^2.3.1",
     "d3-scale-chromatic": "^3.0.0",
     "prop-types": "^15.6.0",
-    "react": ">=17.0.2",
-    "react-dom": ">=17.0.2",
+    "react": "^19.0.0",
+    "react-dom": "^19.0.0",
     "react-native-web": "0.18.10"
   },
   "devDependencies": {
```

**File**: `packages/benchmarks/src/implementations/styleq/Box.js` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ const styles = {
   },
   color4: {
     $$css: true,
-    backgroundColor: 'r-1dgebii'
+    backgroundColor: 'r-18z3xeu'
   },
   color5: {
     $$css: true,
```

**File**: `packages/benchmarks/src/implementations/styleq/View.js` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ function View(props) {
 const styles = {
   root: {
     $$css: true,
-    'css-g5y9jx': 'css-g5y9jx'
+    'css-wkmxpp': 'css-wkmxpp'
   }
 };
 
```

**File**: `packages/benchmarks/src/index.js` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ import Tree from './cases/Tree';
 import SierpinskiTriangle from './cases/SierpinskiTriangle';
 
 import React from 'react';
-import ReactDOM from 'react-dom';
+import { createRoot } from 'react-dom/client';
 
 const implementations = impl;
 const packageNames = Object.keys(implementations);
@@ -74,4 +74,4 @@ const tests = {
 const root = document.querySelector('.root');
 const element = <App tests={tests} />;
 
-ReactDOM.createRoot(root).render(element);
+createRoot(root).render(element);
```

---

### Incident Patch 8: `21342d40` (2025-08-26)
**Commit Message**: Fix pointerEvents propagation

Fix #2801
Close #2802

**File**: `packages/react-native-web/src/exports/AppRegistry/__tests__/__snapshots__/index-test.js.snap` (modified, +6/-6)
```diff
@@ -16,11 +16,11 @@ exports[`AppRegistry runApplication styles roots in different documents 1`] = `
   ".r-bottom-1p0dtai {bottom: 0px;}",
   ".r-left-1d2f490 {left: 0px;}",
   ".r-pointerEvents-105ug2t {pointer-events: auto !important;}",
-  ".r-pointerEvents-12vffkv * {pointer-events: auto;}",
+  ".r-pointerEvents-12vffkv>* {pointer-events: auto;}",
   ".r-pointerEvents-12vffkv {pointer-events: none !important;}",
-  ".r-pointerEvents-633pao * {pointer-events: none;}",
+  ".r-pointerEvents-633pao>* {pointer-events: none;}",
   ".r-pointerEvents-633pao {pointer-events: none !important;}",
-  ".r-pointerEvents-ah5dr5 * {pointer-events: none;}",
+  ".r-pointerEvents-ah5dr5>* {pointer-events: none;}",
   ".r-pointerEvents-ah5dr5 {pointer-events: auto !important;}",
   ".r-position-u8s1d {position: absolute;}",
   ".r-right-zchlnj {right: 0px;}",
@@ -44,11 +44,11 @@ exports[`AppRegistry runApplication styles roots in different documents 2`] = `
   ".r-bottom-1p0dtai {bottom: 0px;}",
   ".r-left-1d2f490 {left: 0px;}",
   ".r-pointerEvents-105ug2t {pointer-events: auto !important;}",
-  ".r-pointerEvents-12vffkv * {pointer-events: auto;}",
+  ".r-pointerEvents-12vffkv>* {pointer-events: auto;}",
   ".r-pointerEvents-12vffkv {pointer-events: none !important;}",
-  ".r-pointerEvents-633pao * {pointer-events: none;}",
+  ".r-pointerEvents-633pao>* {pointer-events: none;}",
   ".r-pointerEvents-633pao {pointer-events: none !important;}",
-  ".r-pointerEvents-ah5dr5 * {pointer-events: none;}",
+  ".r-pointerEvents-ah5dr5>* {pointer-events: none;}",
   ".r-pointerEvents-ah5dr5 {pointer-events: auto !important;}",
   ".r-position-u8s1d {position: absolute;}",
   ".r-right-zchlnj {right: 0px;}",
```

**File**: `packages/react-native-web/src/exports/AppRegistry/__tests__/index-test.node.js` (modified, +9/-9)
```diff
@@ -61,11 +61,11 @@ describe('AppRegistry', () => {
         .r-left-1d2f490{left:0px;}
         .r-maxWidth-dnmrzs{max-width:100%;}
         .r-pointerEvents-105ug2t{pointer-events:auto!important;}
-        .r-pointerEvents-12vffkv * {pointer-events:auto;}
+        .r-pointerEvents-12vffkv>* {pointer-events:auto;}
         .r-pointerEvents-12vffkv{pointer-events:none!important;}
-        .r-pointerEvents-633pao * {pointer-events:none;}
+        .r-pointerEvents-633pao>* {pointer-events:none;}
         .r-pointerEvents-633pao{pointer-events:none!important;}
-        .r-pointerEvents-ah5dr5 * {pointer-events:none;}
+        .r-pointerEvents-ah5dr5>* {pointer-events:none;}
         .r-pointerEvents-ah5dr5{pointer-events:auto!important;}
         .r-position-u8s1d{position:absolute;}
         .r-right-zchlnj{right:0px;}
@@ -120,11 +120,11 @@ describe('AppRegistry', () => {
         .r-left-1d2f490{left:0px;}
         .r-maxWidth-dnmrzs{max-width:100%;}
         .r-pointerEvents-105ug2t{pointer-events:auto!important;}
-        .r-pointerEvents-12vffkv * {pointer-events:auto;}
+        .r-pointerEvents-12vffkv>* {pointer-events:auto;}
         .r-pointerEvents-12vffkv{pointer-events:none!important;}
-        .r-pointerEvents-633pao * {pointer-events:none;}
+        .r-pointerEvents-633pao>* {pointer-events:none;}
         .r-pointerEvents-633pao{pointer-events:none!important;}
-        .r-pointerEvents-ah5dr5 * {pointer-events:none;}
+        .r-pointerEvents-ah5dr5>* {pointer-events:none;}
         .r-pointerEvents-ah5dr5{pointer-events:auto!important;}
         .r-position-u8s1d{position:absolute;}
         .r-right-zchlnj{right:0px;}
@@ -172,11 +172,11 @@ describe('AppRegistry', () => {
         .r-left-1d2f490{left:0px;}
         .r-maxWidth-dnmrzs{max-width:100%;}
         .r-pointerEvents-105ug2t{pointer-events:auto!important;}
-        .r-pointerEvents-12vffkv * {pointer-events:auto;}
+        .r-pointerEvents-12vffkv>* {pointer-events:auto;}
         .r-pointerEvents-12vffkv{pointer-events:none!important;}
-        .r-pointerEvents-633pao * {pointer-events:none;}
+        .r-pointerEvents-633pao>* {pointer-events:none;}
         .r-pointerEvents-633pao{pointer-events:none!important;}
-        .r-pointerEvents-ah5dr5 * {pointer-events:none;}
+        .r-pointerEvents-ah5dr5>* {pointer-events:none;}
         .r-pointerEvents-ah5dr5{pointer-events:auto!important;}
         .r-position-u8s1d{position:absolute;}
         .r-right-zchlnj{right:0px;}
```

**File**: `packages/react-native-web/src/exports/StyleSheet/__tests__/compiler-test.js` (modified, +3/-3)
```diff
@@ -142,7 +142,7 @@ describe('StyleSheet/compile', () => {
             ],
             [
               [
-                ".r-pointerEvents-ah5dr5 * {pointer-events:none;}",
+                ".r-pointerEvents-ah5dr5>* {pointer-events:none;}",
                 ".r-pointerEvents-ah5dr5{pointer-events:auto!important;}",
               ],
               3,
@@ -191,7 +191,7 @@ describe('StyleSheet/compile', () => {
           [
             [
               [
-                ".r-pointerEvents-633pao * {pointer-events:none;}",
+                ".r-pointerEvents-633pao>* {pointer-events:none;}",
                 ".r-pointerEvents-633pao{pointer-events:none!important;}",
               ],
               3,
@@ -215,7 +215,7 @@ describe('StyleSheet/compile', () => {
           [
             [
               [
-                ".r-pointerEvents-12vffkv * {pointer-events:auto;}",
+                ".r-pointerEvents-12vffkv>* {pointer-events:auto;}",
                 ".r-pointerEvents-12vffkv{pointer-events:none!important;}",
               ],
               3,
```

**File**: `packages/react-native-web/src/exports/StyleSheet/compiler/index.js` (modified, +3/-3)
```diff
@@ -387,15 +387,15 @@ function createAtomicRules(identifier: string, property, value): Rules {
       } else if (value === 'none') {
         finalValue = 'none!important';
         const block = createDeclarationBlock({ pointerEvents: 'none' });
-        rules.push(`${selector} * ${block}`);
+        rules.push(`${selector}>* ${block}`);
       } else if (value === 'box-none') {
         finalValue = 'none!important';
         const block = createDeclarationBlock({ pointerEvents: 'auto' });
-        rules.push(`${selector} * ${block}`);
+        rules.push(`${selector}>* ${block}`);
       } else if (value === 'box-only') {
         finalValue = 'auto!important';
         const block = createDeclarationBlock({ pointerEvents: 'none' });
-        rules.push(`${selector} * ${block}`);
+        rules.push(`${selector}>* ${block}`);
       }
       const block = createDeclarationBlock({ pointerEvents: finalValue });
       rules.push(`${selector}${block}`);
```

**File**: `packages/react-native-web/src/modules/createDOMProps/index.js` (modified, +1/-0)
```diff
@@ -879,6 +879,7 @@ const createDOMProps = (elementType, props, options) => {
       `props.pointerEvents is deprecated. Use style.pointerEvents`
     );
   }
+
   const [className, inlineStyle] = StyleSheet(
     [style, pointerEvents && pointerEventsStyles[pointerEvents]],
     {
```

---

### Incident Patch 9: `ae6ad8fd` (2025-06-28)
**Commit Message**: Fix Animated.loop and Animated.sequence crash

Close #2783

**File**: `packages/react-native-web/src/exports/Animated/__tests__/index-test.js` (modified, +71/-0)
```diff
@@ -9,6 +9,7 @@
 
 import Animated from '..';
 import Easing from '../../Easing';
+import AnimatedImplementation from '../../../vendor/react-native/Animated/AnimatedImplementation';
 
 const AnimatedInterpolation = Animated.Interpolation;
 
@@ -329,4 +330,74 @@ describe('Animated', () => {
       expect(interpolation(2 / 3)).toBe('rgba(0, 0, 0, 0.667)');
     });
   });
+
+  describe('sequence and loop', () => {
+    it('supports restarting sequence after it was stopped during execution', () => {
+      const anim1 = { start: jest.fn(), stop: jest.fn() };
+      const anim2 = { start: jest.fn(), stop: jest.fn() };
+      const cb = jest.fn();
+
+      const seq = AnimatedImplementation.sequence([anim1, anim2]);
+
+      seq.start(cb);
+
+      anim1.start.mock.calls[0][0]({ finished: true });
+      seq.stop();
+
+      // anim1 should be finished so anim2 should also start
+      expect(anim1.start).toHaveBeenCalledTimes(1);
+      expect(anim2.start).toHaveBeenCalledTimes(1);
+
+      seq.start(cb);
+
+      // after restart the sequence should resume from the anim2
+      expect(anim1.start).toHaveBeenCalledTimes(1);
+      expect(anim2.start).toHaveBeenCalledTimes(2);
+    });
+
+    it('supports restarting sequence after it was finished without a reset', () => {
+      const anim1 = { start: jest.fn(), stop: jest.fn() };
+      const anim2 = { start: jest.fn(), stop: jest.fn() };
+      const cb = jest.fn();
+
+      const seq = AnimatedImplementation.sequence([anim1, anim2]);
+
+      seq.start(cb);
+      anim1.start.mock.calls[0][0]({ finished: true });
+      anim2.start.mock.calls[0][0]({ finished: true });
+
+      // sequence should be finished
+      expect(cb).toBeCalledWith({ finished: true });
+
+      seq.start(cb);
+
+      // sequence should successfully restart from the anim1
+      expect(anim1.start).toHaveBeenCalledTimes(2);
+      expect(anim2.start).toHaveBeenCalledTimes(1);
+    });
+
+    it('restarts sequence normally in a loop if resetBeforeIteration is false', () => {
+      const anim1 = { start: jest.fn(), stop: jest.fn() };
+      const anim2 = { start: jest.fn(), stop: jest.fn() };
+      const seq = AnimatedImplementation.sequence([anim1, anim2]);
+
+      const loop = AnimatedImplementation.loop(seq, {
+        resetBeforeIteration: false
+      });
+
+      loop.start();
+
+      expect(anim1.start).toHaveBeenCalledTimes(1);
+
+      anim1.start.mock.calls[0][0]({ finished: true });
+
+      expect(anim2.start).toHaveBeenCalledTimes(1);
+
+      anim2.start.mock.calls[0][0]({ finished: true });
+
+      // after anim2 is finished, the sequence is finished,
+      // hence the loop iteration is finished, so the next iteration starts
+      expect(anim1.start).toHaveBeenCalledTimes(2);
+    });
+  });
 });
```

**File**: `packages/react-native-web/src/vendor/react-native/Animated/AnimatedImplementation.js` (modified, +2/-0)
```diff
@@ -318,6 +318,8 @@ const sequence = function (
         current++;
 
         if (current === animations.length) {
+          // if the start is called, even without a reset, it should start from the beginning
+          current = 0;
           callback && callback(result);
           return;
         }
```

---

### Incident Patch 10: `e351aad6` (2025-08-20)
**Commit Message**: Fix memory leak with Animated API

**File**: `packages/react-native-web/src/vendor/react-native/Animated/nodes/AnimatedProps.js` (modified, +1/-0)
```diff
@@ -78,6 +78,7 @@ class AnimatedProps extends AnimatedNode {
     if (this.__isNative && this._animatedView) {
       this.__disconnectAnimatedView();
     }
+    this._animatedView = null;
     for (const key in this._props) {
       const value = this._props[key];
       if (value instanceof AnimatedNode) {
```

---

### Incident Patch 11: `f58fd393` (2025-08-06)
**Commit Message**: [fix] Correctly propagate `pointer-events` to children

Corrects `pointer-events` behavior to match what's described at https://reactnative.dev/docs/view#pointerevents.

Fixes #2794

**File**: `packages/react-native-web/src/exports/AppRegistry/__tests__/__snapshots__/index-test.js.snap` (modified, +4/-2)
```diff
@@ -18,8 +18,9 @@ exports[`AppRegistry runApplication styles roots in different documents 1`] = `
   ".r-pointerEvents-105ug2t {pointer-events: auto !important;}",
   ".r-pointerEvents-12vffkv * {pointer-events: auto;}",
   ".r-pointerEvents-12vffkv {pointer-events: none !important;}",
+  ".r-pointerEvents-633pao * {pointer-events: none;}",
   ".r-pointerEvents-633pao {pointer-events: none !important;}",
-  ".r-pointerEvents-ah5dr5>* {pointer-events: none;}",
+  ".r-pointerEvents-ah5dr5 * {pointer-events: none;}",
   ".r-pointerEvents-ah5dr5 {pointer-events: auto !important;}",
   ".r-position-u8s1d {position: absolute;}",
   ".r-right-zchlnj {right: 0px;}",
@@ -45,8 +46,9 @@ exports[`AppRegistry runApplication styles roots in different documents 2`] = `
   ".r-pointerEvents-105ug2t {pointer-events: auto !important;}",
   ".r-pointerEvents-12vffkv * {pointer-events: auto;}",
   ".r-pointerEvents-12vffkv {pointer-events: none !important;}",
+  ".r-pointerEvents-633pao * {pointer-events: none;}",
   ".r-pointerEvents-633pao {pointer-events: none !important;}",
-  ".r-pointerEvents-ah5dr5>* {pointer-events: none;}",
+  ".r-pointerEvents-ah5dr5 * {pointer-events: none;}",
   ".r-pointerEvents-ah5dr5 {pointer-events: auto !important;}",
   ".r-position-u8s1d {position: absolute;}",
   ".r-right-zchlnj {right: 0px;}",
```

**File**: `packages/react-native-web/src/exports/AppRegistry/__tests__/index-test.node.js` (modified, +6/-3)
```diff
@@ -63,8 +63,9 @@ describe('AppRegistry', () => {
         .r-pointerEvents-105ug2t{pointer-events:auto!important;}
         .r-pointerEvents-12vffkv * {pointer-events:auto;}
         .r-pointerEvents-12vffkv{pointer-events:none!important;}
+        .r-pointerEvents-633pao * {pointer-events:none;}
         .r-pointerEvents-633pao{pointer-events:none!important;}
-        .r-pointerEvents-ah5dr5>*{pointer-events:none;}
+        .r-pointerEvents-ah5dr5 * {pointer-events:none;}
         .r-pointerEvents-ah5dr5{pointer-events:auto!important;}
         .r-position-u8s1d{position:absolute;}
         .r-right-zchlnj{right:0px;}
@@ -121,8 +122,9 @@ describe('AppRegistry', () => {
         .r-pointerEvents-105ug2t{pointer-events:auto!important;}
         .r-pointerEvents-12vffkv * {pointer-events:auto;}
         .r-pointerEvents-12vffkv{pointer-events:none!important;}
+        .r-pointerEvents-633pao * {pointer-events:none;}
         .r-pointerEvents-633pao{pointer-events:none!important;}
-        .r-pointerEvents-ah5dr5>*{pointer-events:none;}
+        .r-pointerEvents-ah5dr5 * {pointer-events:none;}
         .r-pointerEvents-ah5dr5{pointer-events:auto!important;}
         .r-position-u8s1d{position:absolute;}
         .r-right-zchlnj{right:0px;}
@@ -172,8 +174,9 @@ describe('AppRegistry', () => {
         .r-pointerEvents-105ug2t{pointer-events:auto!important;}
         .r-pointerEvents-12vffkv * {pointer-events:auto;}
         .r-pointerEvents-12vffkv{pointer-events:none!important;}
+        .r-pointerEvents-633pao * {pointer-events:none;}
         .r-pointerEvents-633pao{pointer-events:none!important;}
-        .r-pointerEvents-ah5dr5>*{pointer-events:none;}
+        .r-pointerEvents-ah5dr5 * {pointer-events:none;}
         .r-pointerEvents-ah5dr5{pointer-events:auto!important;}
         .r-position-u8s1d{position:absolute;}
         .r-right-zchlnj{right:0px;}
```

**File**: `packages/react-native-web/src/exports/StyleSheet/__tests__/compiler-test.js` (modified, +25/-1)
```diff
@@ -142,7 +142,7 @@ describe('StyleSheet/compile', () => {
             ],
             [
               [
-                ".r-pointerEvents-ah5dr5>*{pointer-events:none;}",
+                ".r-pointerEvents-ah5dr5 * {pointer-events:none;}",
                 ".r-pointerEvents-ah5dr5{pointer-events:auto!important;}",
               ],
               3,
@@ -177,6 +177,30 @@ describe('StyleSheet/compile', () => {
       `);
     });
 
+    test('when parent is pointer-events=none, pointer-events=none applied to children', () => {
+      const result = atomic({
+        pointerEvents: 'none'
+      });
+
+      expect(result).toMatchInlineSnapshot(`
+        [
+          {
+            "$$css": true,
+            "pointerEvents": "r-pointerEvents-633pao",
+          },
+          [
+            [
+              [
+                ".r-pointerEvents-633pao * {pointer-events:none;}",
+                ".r-pointerEvents-633pao{pointer-events:none!important;}",
+              ],
+              3,
+            ],
+          ],
+        ]
+      `);
+    });
+
     test('when parent is pointer-events=box-none, pointer-events=auto applied to children', () => {
       const result = atomic({
         pointerEvents: 'box-none'
```

**File**: `packages/react-native-web/src/exports/StyleSheet/compiler/index.js` (modified, +13/-10)
```diff
@@ -379,20 +379,23 @@ function createAtomicRules(identifier: string, property, value): Rules {
 
     // Polyfill for additional 'pointer-events' values
     // See d13f78622b233a0afc0c7a200c0a0792c8ca9e58
+    // See https://reactnative.dev/docs/view#pointerevents
     case 'pointerEvents': {
       let finalValue = value;
-      if (value === 'auto' || value === 'box-only') {
+      if (value === 'auto') {
         finalValue = 'auto!important';
-        if (value === 'box-only') {
-          const block = createDeclarationBlock({ pointerEvents: 'none' });
-          rules.push(`${selector}>*${block}`);
-        }
-      } else if (value === 'none' || value === 'box-none') {
+      } else if (value === 'none') {
         finalValue = 'none!important';
-        if (value === 'box-none') {
-          const block = createDeclarationBlock({ pointerEvents: 'auto' });
-          rules.push(`${selector} * ${block}`);
-        }
+        const block = createDeclarationBlock({ pointerEvents: 'none' });
+        rules.push(`${selector} * ${block}`);
+      } else if (value === 'box-none') {
+        finalValue = 'none!important';
+        const block = createDeclarationBlock({ pointerEvents: 'auto' });
+        rules.push(`${selector} * ${block}`);
+      } else if (value === 'box-only') {
+        finalValue = 'auto!important';
+        const block = createDeclarationBlock({ pointerEvents: 'none' });
+        rules.push(`${selector} * ${block}`);
       }
       const block = createDeclarationBlock({ pointerEvents: finalValue });
       rules.push(`${selector}${block}`);
```

---

### Incident Patch 12: `e76a17d7` (2025-07-18)
**Commit Message**: [fix] Correctly propagate `pointer-events: auto` to children when set to `box-none`

Corrects `pointer-events: box-none` behavior to match what's described
at https://reactnative.dev/docs/view#pointerevents

Fix #2606
Close #2789

**File**: `packages/react-native-web/src/exports/AppRegistry/__tests__/__snapshots__/index-test.js.snap` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@ exports[`AppRegistry runApplication styles roots in different documents 1`] = `
   ".r-bottom-1p0dtai {bottom: 0px;}",
   ".r-left-1d2f490 {left: 0px;}",
   ".r-pointerEvents-105ug2t {pointer-events: auto !important;}",
-  ".r-pointerEvents-12vffkv>* {pointer-events: auto;}",
+  ".r-pointerEvents-12vffkv * {pointer-events: auto;}",
   ".r-pointerEvents-12vffkv {pointer-events: none !important;}",
   ".r-pointerEvents-633pao {pointer-events: none !important;}",
   ".r-pointerEvents-ah5dr5>* {pointer-events: none;}",
@@ -43,7 +43,7 @@ exports[`AppRegistry runApplication styles roots in different documents 2`] = `
   ".r-bottom-1p0dtai {bottom: 0px;}",
   ".r-left-1d2f490 {left: 0px;}",
   ".r-pointerEvents-105ug2t {pointer-events: auto !important;}",
-  ".r-pointerEvents-12vffkv>* {pointer-events: auto;}",
+  ".r-pointerEvents-12vffkv * {pointer-events: auto;}",
   ".r-pointerEvents-12vffkv {pointer-events: none !important;}",
   ".r-pointerEvents-633pao {pointer-events: none !important;}",
   ".r-pointerEvents-ah5dr5>* {pointer-events: none;}",
```

**File**: `packages/react-native-web/src/exports/AppRegistry/__tests__/index-test.node.js` (modified, +3/-3)
```diff
@@ -61,7 +61,7 @@ describe('AppRegistry', () => {
         .r-left-1d2f490{left:0px;}
         .r-maxWidth-dnmrzs{max-width:100%;}
         .r-pointerEvents-105ug2t{pointer-events:auto!important;}
-        .r-pointerEvents-12vffkv>*{pointer-events:auto;}
+        .r-pointerEvents-12vffkv * {pointer-events:auto;}
         .r-pointerEvents-12vffkv{pointer-events:none!important;}
         .r-pointerEvents-633pao{pointer-events:none!important;}
         .r-pointerEvents-ah5dr5>*{pointer-events:none;}
@@ -119,7 +119,7 @@ describe('AppRegistry', () => {
         .r-left-1d2f490{left:0px;}
         .r-maxWidth-dnmrzs{max-width:100%;}
         .r-pointerEvents-105ug2t{pointer-events:auto!important;}
-        .r-pointerEvents-12vffkv>*{pointer-events:auto;}
+        .r-pointerEvents-12vffkv * {pointer-events:auto;}
         .r-pointerEvents-12vffkv{pointer-events:none!important;}
         .r-pointerEvents-633pao{pointer-events:none!important;}
         .r-pointerEvents-ah5dr5>*{pointer-events:none;}
@@ -170,7 +170,7 @@ describe('AppRegistry', () => {
         .r-left-1d2f490{left:0px;}
         .r-maxWidth-dnmrzs{max-width:100%;}
         .r-pointerEvents-105ug2t{pointer-events:auto!important;}
-        .r-pointerEvents-12vffkv>*{pointer-events:auto;}
+        .r-pointerEvents-12vffkv * {pointer-events:auto;}
         .r-pointerEvents-12vffkv{pointer-events:none!important;}
         .r-pointerEvents-633pao{pointer-events:none!important;}
         .r-pointerEvents-ah5dr5>*{pointer-events:none;}
```

**File**: `packages/react-native-web/src/exports/StyleSheet/__tests__/compiler-test.js` (modified, +24/-0)
```diff
@@ -176,6 +176,30 @@ describe('StyleSheet/compile', () => {
         ]
       `);
     });
+
+    test('when parent is pointer-events=box-none, pointer-events=auto applied to children', () => {
+      const result = atomic({
+        pointerEvents: 'box-none'
+      });
+
+      expect(result).toMatchInlineSnapshot(`
+        [
+          {
+            "$$css": true,
+            "pointerEvents": "r-pointerEvents-12vffkv",
+          },
+          [
+            [
+              [
+                ".r-pointerEvents-12vffkv * {pointer-events:auto;}",
+                ".r-pointerEvents-12vffkv{pointer-events:none!important;}",
+              ],
+              3,
+            ],
+          ],
+        ]
+      `);
+    });
   });
 
   describe('classic', () => {
```

**File**: `packages/react-native-web/src/exports/StyleSheet/compiler/index.js` (modified, +1/-1)
```diff
@@ -391,7 +391,7 @@ function createAtomicRules(identifier: string, property, value): Rules {
         finalValue = 'none!important';
         if (value === 'box-none') {
           const block = createDeclarationBlock({ pointerEvents: 'auto' });
-          rules.push(`${selector}>*${block}`);
+          rules.push(`${selector} * ${block}`);
         }
       }
       const block = createDeclarationBlock({ pointerEvents: finalValue });
```

---

### Incident Patch 13: `08f8bd3f` (2023-09-25)
**Commit Message**: [fix] Prevent clipped text from being scrolled by drag

Close #2584

**File**: `packages/react-native-web/src/exports/AppRegistry/__tests__/index-test.node.js` (modified, +3/-0)
```diff
@@ -52,6 +52,7 @@ describe('AppRegistry', () => {
         .r-display-krxsd3{display:-webkit-box;}
         .r-display-xoduu5{display:inline-flex;}
         .r-flex-13awgt0{flex:1;}
+        .r-overflow-1qsk4np{overflow-x:clip;overflow-y:clip;}
         .r-overflow-1udh08x{overflow-x:hidden;overflow-y:hidden;}
         [stylesheet-group="3"]{}
         .r-WebkitBoxOrient-8akbws{-webkit-box-orient:vertical;}
@@ -109,6 +110,7 @@ describe('AppRegistry', () => {
         .r-display-krxsd3{display:-webkit-box;}
         .r-display-xoduu5{display:inline-flex;}
         .r-flex-13awgt0{flex:1;}
+        .r-overflow-1qsk4np{overflow-x:clip;overflow-y:clip;}
         .r-overflow-1udh08x{overflow-x:hidden;overflow-y:hidden;}
         [stylesheet-group="3"]{}
         .r-WebkitBoxOrient-8akbws{-webkit-box-orient:vertical;}
@@ -158,6 +160,7 @@ describe('AppRegistry', () => {
         .r-display-krxsd3{display:-webkit-box;}
         .r-display-xoduu5{display:inline-flex;}
         .r-flex-13awgt0{flex:1;}
+        .r-overflow-1qsk4np{overflow-x:clip;overflow-y:clip;}
         .r-overflow-1udh08x{overflow-x:hidden;overflow-y:hidden;}
         [stylesheet-group="3"]{}
         .r-WebkitBoxOrient-8akbws{-webkit-box-orient:vertical;}
```

**File**: `packages/react-native-web/src/exports/Text/__tests__/__snapshots__/index-test.js.snap` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ exports[`components/Text prop "nativeID" value is set 1`] = `
 
 exports[`components/Text prop "numberOfLines" value is set 1`] = `
 <div
-  class="css-text-146c3p1 r-WebkitBoxOrient-8akbws r-display-krxsd3 r-maxWidth-dnmrzs r-overflow-1udh08x r-textOverflow-1udbk01"
+  class="css-text-146c3p1 r-WebkitBoxOrient-8akbws r-display-krxsd3 r-maxWidth-dnmrzs r-overflow-1qsk4np r-textOverflow-1udbk01"
   dir="auto"
 />
 `;
```

**File**: `packages/react-native-web/src/exports/Text/index.js` (modified, +1/-1)
```diff
@@ -223,7 +223,7 @@ const styles = StyleSheet.create({
   textMultiLine: {
     display: '-webkit-box',
     maxWidth: '100%',
-    overflow: 'hidden',
+    overflow: 'clip',
     textOverflow: 'ellipsis',
     WebkitBoxOrient: 'vertical'
   },
```

---

### Incident Patch 14: `4e2fcbfd` (2025-04-03)
**Commit Message**: [change] Update inline-style-prefixer

Close #2764

**File**: `package-lock.json` (modified, +5/-9)
```diff
@@ -41,7 +41,6 @@
         "gen-flow-files": "^0.4.11",
         "glob": "^8.0.3",
         "husky": "^8.0.0",
-        "inline-style-prefixer": "^6.0.0",
         "jest": "^29.7.0",
         "jest-environment-jsdom": "^29.7.0",
         "lint-staged": "^13.0.3",
@@ -6772,10 +6771,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/fast-loops": {
-      "version": "1.1.4",
-      "license": "MIT"
-    },
     "node_modules/fastest-levenshtein": {
       "version": "1.0.16",
       "dev": true,
@@ -7756,11 +7751,12 @@
       "license": "ISC"
     },
     "node_modules/inline-style-prefixer": {
-      "version": "6.0.4",
+      "version": "7.0.1",
+      "resolved": "https://registry.npmjs.org/inline-style-prefixer/-/inline-style-prefixer-7.0.1.tgz",
+      "integrity": "sha512-lhYo5qNTQp3EvSSp3sRvXMbVQTLrvGV6DycRMJ5dm2BLMiJ30wpXKdDdgX+GmJZ5uQMucwRKHamXSst3Sj/Giw==",
       "license": "MIT",
       "dependencies": {
-        "css-in-js-utils": "^3.1.0",
-        "fast-loops": "^1.1.3"
+        "css-in-js-utils": "^3.1.0"
       }
     },
     "node_modules/internal-slot": {
@@ -15355,7 +15351,7 @@
         "@babel/runtime": "^7.18.6",
         "@react-native/normalize-colors": "^0.74.1",
         "fbjs": "^3.0.4",
-        "inline-style-prefixer": "^6.0.1",
+        "inline-style-prefixer": "^7.0.1",
         "memoize-one": "^6.0.0",
         "nullthrows": "^1.1.1",
         "postcss-value-parser": "^4.2.0",
```

**File**: `package.json` (modified, +1/-2)
```diff
@@ -11,7 +11,7 @@
     "format": "prettier --check --ignore-path ./configs/.prettierignore \"**/*.js\"",
     "format:fix": "prettier --write --ignore-path ./configs/.prettierignore \"**/*.js\"",
     "lint": "eslint configs packages scripts --config ./configs/.eslintrc",
-    "lint:fix": "npm run lint --fix",
+    "lint:fix": "npm run lint -- --fix",
     "prerelease": "npm run test && npm run build",
     "release": "node ./scripts/releaseReactNativeWebPackages.js",
     "release:benchmarks": "git checkout gh-pages && rm -rf ./docs/benchmarks && mv packages/benchmarks/dist ./docs/benchmarks && git add -A && git commit -m \"Deploy benchmarks\" && git push origin gh-pages && git checkout -",
@@ -52,7 +52,6 @@
     "gen-flow-files": "^0.4.11",
     "glob": "^8.0.3",
     "husky": "^8.0.0",
-    "inline-style-prefixer": "^6.0.0",
     "jest": "^29.7.0",
     "jest-environment-jsdom": "^29.7.0",
     "lint-staged": "^13.0.3",
```

**File**: `packages/react-native-web/package.json` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@
     "@babel/runtime": "^7.18.6",
     "@react-native/normalize-colors": "^0.74.1",
     "fbjs": "^3.0.4",
-    "inline-style-prefixer": "^6.0.1",
+    "inline-style-prefixer": "^7.0.1",
     "memoize-one": "^6.0.0",
     "nullthrows": "^1.1.1",
     "postcss-value-parser": "^4.2.0",
```

**File**: `packages/react-native-web/src/modules/prefixStyles/static.js` (modified, +1/-14)
```diff
@@ -1,7 +1,4 @@
-import backgroundClip from 'inline-style-prefixer/lib/plugins/backgroundClip';
 import crossFade from 'inline-style-prefixer/lib/plugins/crossFade';
-import cursor from 'inline-style-prefixer/lib/plugins/cursor';
-import filter from 'inline-style-prefixer/lib/plugins/filter';
 import imageSet from 'inline-style-prefixer/lib/plugins/imageSet';
 import logical from 'inline-style-prefixer/lib/plugins/logical';
 import position from 'inline-style-prefixer/lib/plugins/position';
@@ -14,17 +11,7 @@ const wms = ['Webkit', 'ms'];
 const wmms = ['Webkit', 'Moz', 'ms'];
 
 export default {
-  plugins: [
-    backgroundClip,
-    crossFade,
-    cursor,
-    filter,
-    imageSet,
-    logical,
-    position,
-    sizing,
-    transition
-  ],
+  plugins: [crossFade, imageSet, logical, position, sizing, transition],
   prefixMap: {
     appearance: wmms,
     userSelect: wm,
```

---

### Incident Patch 15: `fcbe2d1e` (2024-12-27)
**Commit Message**: [fix] Support array syntax on transformOrigin

**File**: `packages/react-native-web/src/exports/StyleSheet/__tests__/preprocess-test.js` (modified, +22/-0)
```diff
@@ -188,6 +188,28 @@ describe('StyleSheet/preprocess', () => {
         });
       });
     });
+
+    describe('transformOrigin', () => {
+      // passthrough if transformOrigin value is ever a string
+      test('string', () => {
+        const transformOrigin = '2px 30% 10px';
+        const style = { transformOrigin };
+        const resolved = preprocess(style);
+
+        expect(resolved).toEqual({ transformOrigin });
+      });
+
+      test('array', () => {
+        const style = {
+          transformOrigin: [2, '30%', 10]
+        };
+        const resolved = preprocess(style);
+
+        expect(resolved).toEqual({
+          transformOrigin: '2px 30% 10px'
+        });
+      });
+    });
   });
 
   describe('preprocesses multiple shadow styles into a single declaration', () => {
```

**File**: `packages/react-native-web/src/exports/StyleSheet/preprocess.js` (modified, +12/-0)
```diff
@@ -92,6 +92,13 @@ export const createTransformValue = (value: Array<Object>): string => {
   return value.map(mapTransform).join(' ');
 };
 
+// [2, '30%', 10] => '2px 30% 10px'
+export const createTransformOriginValue = (
+  value: Array<number | string>
+): string => {
+  return value.map((v) => normalizeValueWithProperty(v)).join(' ');
+};
+
 const PROPERTIES_STANDARD: { [key: string]: string } = {
   borderBottomEndRadius: 'borderEndEndRadius',
   borderBottomStartRadius: 'borderEndStartRadius',
@@ -231,6 +238,11 @@ export const preprocess = <T: {| [key: string]: any |}>(
         value = createTransformValue(value);
       }
       nextStyle.transform = value;
+    } else if (prop === 'transformOrigin') {
+      if (Array.isArray(value)) {
+        value = createTransformOriginValue(value);
+      }
+      nextStyle.transformOrigin = value;
     } else {
       nextStyle[prop] = value;
     }
```

**File**: `packages/react-native-web/src/types/styles.js` (modified, +1/-1)
```diff
@@ -341,6 +341,6 @@ export type TransformStyles = {|
         | {| +translateZ: NumberOrString |}
         | {| +translate3d: string |}
       >,
-  transformOrigin?: ?string,
+  transformOrigin?: ?string | Array<NumberOrString>,
   transformStyle?: ?('flat' | 'preserve-3d')
 |};
```

#### Recent Merged Pull Requests:
- **PR #2856** (2026-09-25): Fix TextInput maxLength documentation (@huytdps13400)
- **PR #2854** (2026-09-25): Fix TextInput placeholder documentation (@huytdps13400)
- **PR #2853** (2026-09-25): Fix useColorScheme subscription lifecycle (@huytdps13400)
- **PR #2851** (2026-09-25): Image: do not restart loading when load callback identities change (@AbdullahAnsarii)
- **PR #2847** (closed): Re-export InputAccessoryView from the package root (@KAMRONBEK)
- **PR #2846** (closed): Support focusable aria-disabled-only buttons (do not force native disabled) (@KAMRONBEK)
- **PR #2845** (closed): Omit redundant role="heading" when rendering native h1-h6 elements (@KAMRONBEK)
- **PR #2844** (closed): Fix comma-operator bug that made shadow*/textShadow* deprecation warnings and conversion unconditional (@KAMRONBEK)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
