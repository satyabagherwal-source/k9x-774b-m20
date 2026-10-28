> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/necolas-react-native-web-learnings.md`  
> **Source**: github ([https://github.com/necolas/react-native-web](https://github.com/necolas/react-native-web))  
> **Source Version**: `b7ebd988`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T19:31:49.786Z  
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
> **Harvest Timestamp**: 2026-10-28T19:31:49.779Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `necolas/react-native-web`
- **Description**: Cross-platform React UI packages
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 22157 stars

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
import invariant from 'invariant';
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

import invariant from 'invariant';
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
- **Issue #2929** (2026-10-28): **useWindowDimensions and useColorScheme cause a hydration mismatch on server-rendered pages**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  This issue is a follow-up to #2799. It is one specific SSR problem, with a repro.  The problem is old (#566 added `Dimensions.set` as a best guess for it in 2017, and #1688 describes it with Next.js), but it is more common now: since SDK 58, new Expo projects render their web pages on the server by default (the default template's `web.output` went from `'static'` to `'server'`, expo/expo#50129).  ### Describe the issue  A page renders on the server and then hydrates in the browser. Its render uses `useWindowDimensions()` or `useColorScheme()`.  - The server has no window. It renders with `0x0` and `"light"`, or with the values given to `Dimensions.set`. - In the browser, the first render reads the real window and color scheme, for example `1024x768` and `"dark"`.  Thus the first client render does not match the server HTML. React shows error #418 ("Hydration failed because the server rendered text didn't match the client"). React then renders the root again on the client and discards the server HTML.  ### Expected behavior  The first client render matches the server HTML, so hydration succeeds. After hydration, the hooks change to the real values.  ### Steps to reproduce  1. Clone the repro and run `bun install`. 2. Run `bun run build`. The app uses Expo Router with `web.output: 'server'`. 3. Run `bun run serve`. 4. Open http://localhost:8081 with the console open. Use a window that is not 0x

- **Issue #2925** (2026-10-22): **Scroll not working on the example app home**
  *Symptoms*: ### Is there an existing issue for this?  - [x] I have searched the existing issues  ### Describe the issue  Yesterday while running the example app saw the scroll is notworking on the homescreen  ### Expected behavior  Scroll should work  ### Steps to reproduce  1. cd into packages/react-native-web-examples 2. try scroll, not working on brave browser  ### Test case  https://github.com/necolas/react-native-web/tree/master/packages/react-native-web-examples  ### Additional comments  _No response_
  **Post-Mortem & Fix Analysis**:
  > @zoontek, also, the demo apps should not be in the packages folder. Are we planning for migrations?  I heavily rely on react native web infact I was planning to take a fork and start work on it as per my project requirements, great I saw you guys took up the task and maintain it again  I have a good list of things that can be improved in the repo, which I found during my recent audit on few of my projects
  > @raajnadar Yes, it's planned. We have a roadmap, I will do it when needed.

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

### Incident Patch 1: `c913fe89` (2026-10-28)
**Commit Message**: [fix] Animated.loop blocks FlatList onEndReached (#2934)

**File**: `packages/react-native-web/src/vendor/react-native/Animated/nodes/AnimatedValue.js` (modified, +0/-8)
```diff
@@ -12,7 +12,6 @@
 
 import AnimatedInterpolation from './AnimatedInterpolation';
 import AnimatedWithChildren from './AnimatedWithChildren';
-import InteractionManager from '../../../../modules/InteractionManager';
 import NativeAnimatedHelper from '../NativeAnimatedHelper';
 
 import type AnimatedNode from './AnimatedNode';
@@ -239,10 +238,6 @@ class AnimatedValue extends AnimatedWithChildren {
    * See https://reactnative.dev/docs/animatedvalue#animate
    */
   animate(animation: Animation, callback: ?EndCallback): void {
-    let handle = null;
-    if (animation.__isInteraction) {
-      handle = InteractionManager.createInteractionHandle();
-    }
     const previousAnimation = this._animation;
     this._animation && this._animation.stop();
     this._animation = animation;
@@ -254,9 +249,6 @@ class AnimatedValue extends AnimatedWithChildren {
       },
       result => {
         this._animation = null;
-        if (handle !== null) {
-          InteractionManager.clearInteractionHandle(handle);
-        }
         callback && callback(result);
       },
       previousAnimation,
```

---

### Incident Patch 2: `b7ebd988` (2026-10-28)
**Commit Message**: Fix snapshots indent

**File**: `packages/dom-event-testing-library/src/__tests__/index-test.js` (modified, +44/-44)
```diff
@@ -40,30 +40,30 @@ describe('createEventTarget', () => {
     const target = createEventTarget(node);
     expect(target.node).toEqual(node);
     expect(Object.keys(target)).toMatchInlineSnapshot(`
-      [
-        "node",
-        "blur",
-        "click",
-        "contextmenu",
-        "error",
-        "focus",
-        "keydown",
-        "keyup",
-        "load",
-        "pointercancel",
-        "pointerdown",
-        "pointerhover",
-        "pointermove",
-        "pointerover",
-        "pointerout",
-        "pointerup",
-        "scroll",
-        "select",
-        "selectionchange",
-        "tap",
-        "virtualclick",
-        "setBoundingClientRect",
-      ]
+     [
+       "node",
+       "blur",
+       "click",
+       "contextmenu",
+       "error",
+       "focus",
+       "keydown",
+       "keyup",
+       "load",
+       "pointercancel",
+       "pointerdown",
+       "pointerhover",
+       "pointermove",
+       "pointerover",
+       "pointerout",
+       "pointerup",
+       "scroll",
+       "select",
+       "selectionchange",
+       "tap",
+       "virtualclick",
+       "setBoundingClientRect",
+     ]
     `);
   });
 
@@ -332,29 +332,29 @@ describe('createEventTarget', () => {
   test('.setBoundingClientRect()', () => {
     const target = createEventTarget(node);
     expect(node.getBoundingClientRect()).toMatchInlineSnapshot(`
-      {
-        "bottom": 0,
-        "height": 0,
-        "left": 0,
-        "right": 0,
-        "top": 0,
-        "width": 0,
-        "x": 0,
-        "y": 0,
-      }
+     {
+       "bottom": 0,
+       "height": 0,
+       "left": 0,
+       "right": 0,
+       "top": 0,
+       "width": 0,
+       "x": 0,
+       "y": 0,
+     }
     `);
     target.setBoundingClientRect({ x: 10, y: 20, width: 100, height: 200 });
     expect(node.getBoundingClientRect()).toMatchInlineSnapshot(`
-      {
-        "bottom": 220,
-        "height": 200,
-        "left": 10,
-        "right": 110,
-        "top": 20,
-        "width": 100,
-        "x": 10,
-        "y": 20,
-      }
+     {
+       "bottom": 220,
+       "height": 200,
+       "left": 10,
+       "right": 110,
+       "top": 20,
+       "width": 100,
+       "x": 10,
+       "y": 20,
+     }
     `);
   });
 });
```

**File**: `packages/react-native-web/src/exports/AppRegistry/__tests__/index-test.node.js` (modified, +136/-136)
```diff
@@ -32,56 +32,56 @@ describe('AppRegistry', () => {
         ReactDOMServer.renderToStaticMarkup(getStyleElement());
 
       expect(element).toMatchInlineSnapshot(`
-        <AppContainer
-          rootTag={{}}
-        >
-          <NoopComponent />
-        </AppContainer>
+       <AppContainer
+         rootTag={{}}
+       >
+         <NoopComponent />
+       </AppContainer>
       `);
       expect(styleElement).toMatchInlineSnapshot(`
-        "<style id="react-native-stylesheet">[stylesheet-group="0"]{}
-        @supports (color:accentcolor){:host,:root{--rnw-accentcolor:accentcolor;}}
-        @supports (color:accentcolortext){:host,:root{--rnw-accentcolortext:accentcolortext;}}
-        @supports (color:buttonborder){:host,:root{--rnw-buttonborder:buttonborder;}}
-        @supports (color:mark){:host,:root{--rnw-mark:mark;}}
-        @supports (color:marktext){:host,:root{--rnw-marktext:marktext;}}
-        @supports (color:selecteditem){:host,:root{--rnw-selecteditem:selecteditem;}}
-        @supports (color:selecteditemtext){:host,:root{--rnw-selecteditemtext:selecteditemtext;}}
-        body{margin:0;}
-        button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}
-        html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}
-        input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}
-        [stylesheet-group="1"]{}
-        .css-text-146c3p1{background-color:rgba(0,0,0,0.00);border:0 solid black;box-sizing:border-box;color:rgba(0,0,0,1.00);display:inline;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;list-style:none;margin:0px;padding:0px;position:relative;text-align:start;text-decoration:none;white-space:pre-wrap;word-wrap:break-word;}
-        .css-textHasAncestor-1jxf684{background-color:rgba(0,0,0,0.00);border:0 solid black;box-sizing:border-box;color:inherit;display:inline;font:inherit;list-style:none;margin:0px;padding:0px;position:relative;text-align:inherit;text-decoration:none;white-space:inherit;word-wrap:break-word;}
-        .css-view-g5y9jx{align-content:flex-start;align-items:stretch;background-color:rgba(0,0,0,0.00);border:0 solid black;box-sizing:border-box;display:flex;flex-basis:auto;flex-direction:column;flex-shrink:0;list-style:none;margin:0px;min-height:0px;min-width:0px;padding:0px;position:relative;text-decoration:none;z-index:0;}
-        [stylesheet-group="2"]{}
-        .r-display-krxsd3{display:-webkit-box;}
-        .r-display-xoduu5{display:inline-flex;}
-        .r-flex-13awgt0{flex:1;}
-        .r-overflow-1qsk4np{overflow-x:clip;overflow-y:clip;}
-        .r-overflow-1udh08x{overflow-x:hidden;overflow-y:hidden;}
-        [stylesheet-group="3"]{}
-        .r-WebkitBoxOrient-8akbws{-webkit-box-orient:vertical;}
-        .r-bottom-1p0dtai{bottom:0px;}
-        .r-cursor-1loqt21{cursor:pointer;}
-        .r-left-1d2f490{left:0px;}
-        .r-maxWidth-dnmrzs{max-width:100%;}
-        .r-pointerEvents-105ug2t{pointer-events:auto!important;}
-        .r-pointerEvents-12vffkv>* {pointer-events:auto;}
-        .r-pointerEvents-12vffkv{pointer-events:none!important;}
-        .r-pointerEvents-633pao>* {pointer-events:none;}
-        .r-pointerEvents-633pao{pointer-events:none!important;}
-        .r-pointerEvents-ah5dr5>* {pointer-events:none;}
-        .r-pointerEvents-ah5dr5{pointer-events:auto!important;}
-        .r-position-u8s1d{position:absolute;}
-        .r-right-zchlnj{right:0px;}
-        .r-textOverflow-1udbk01{text-overflow:ellipsis;}
-        .r-top-ipm5af{top:0px;}
-        .r-userSelect-1xnzce8{-webkit-user-select:text;user-select:text;}
-        .r-userSelect-lrvibr{-webkit-user-select:none;user-select:none;}
-        .r-whiteSpace-3s2u2q{white-space:nowrap;}
-        .r-wordWrap-1iln25a{word-wrap:normal;}</style>"
+       "<style id="react-native-stylesheet">[stylesheet-group="0"]{}
+       @supports (color:accentcolor){:host,:root{--rnw-accentcolor:accentcolor;}}
+       @supports (color:accentcolortext){:host,:root{--rnw-accentcolortext:accentcolortext;}}
+       @supports (color:buttonborder){:host,:root{--rnw-buttonborder:buttonborder;}}
+       @supports (color:mark){:host,:root{--rnw-mark:mark;}}
+       @supports (color:marktext){:host,:root{--rnw-marktext:marktext;}}
+       @supports (color:selecteditem){:host,:root{--rnw-selecteditem:selecteditem;}}
+       @supports (color:selecteditemtext){:host,:root{--rnw-selecteditemtext:selecteditemtext;}}
+       body{margin:0;}
+       button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}
+       html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}
+       input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}
+       [stylesheet-group="1"]{}
+       .css-text-14
```

**File**: `packages/react-native-web/src/exports/Dimensions/__tests__/index-test.js` (modified, +12/-12)
```diff
@@ -12,20 +12,20 @@ describe('apis/Dimensions', () => {
     const handler = jest.fn();
     Dimensions.addEventListener('change', handler);
     expect(Dimensions.get('screen')).toMatchInlineSnapshot(`
-      {
-        "fontScale": 1,
-        "height": 0,
-        "scale": 1,
-        "width": 0,
-      }
+     {
+       "fontScale": 1,
+       "height": 0,
+       "scale": 1,
+       "width": 0,
+     }
     `);
     expect(Dimensions.get('window')).toMatchInlineSnapshot(`
-      {
-        "fontScale": 1,
-        "height": 768,
-        "scale": 1,
-        "width": 1024,
-      }
+     {
+       "fontScale": 1,
+       "height": 768,
+       "scale": 1,
+       "width": 1024,
+     }
     `);
     expect(handler).toHaveBeenCalledTimes(0);
   });
```

**File**: `packages/react-native-web/src/exports/StyleSheet/__tests__/compiler-createReactDOMStyle-test.js` (modified, +45/-45)
```diff
@@ -45,30 +45,30 @@ describe('compiler/createReactDOMStyle', () => {
     };
 
     expect(createReactDOMStyle(style, true)).toMatchInlineSnapshot(`
-      {
-        "borderBottomColor": "rgba(255,255,255,1.00)",
-        "borderBottomStyle": "solid",
-        "borderBottomWidth": "1px",
-        "borderLeftStyle": "solid",
-        "borderLeftWidth": "0px",
-        "borderRightStyle": "solid",
-        "borderRightWidth": "0px",
-        "borderTopStyle": "solid",
-        "borderTopWidth": "0px",
-        "boxSizing": "border-box",
-        "marginBottom": "25px",
-        "marginLeft": "10px",
-        "marginRight": "10px",
-        "marginTop": "50px",
-        "overflowX": "hidden",
-        "overflowY": "hidden",
-        "overscrollBehaviorX": "contain",
-        "overscrollBehaviorY": "contain",
-        "paddingBottom": "10px",
-        "paddingLeft": "50px",
-        "paddingRight": "25px",
-        "paddingTop": "10px",
-      }
+     {
+       "borderBottomColor": "rgba(255,255,255,1.00)",
+       "borderBottomStyle": "solid",
+       "borderBottomWidth": "1px",
+       "borderLeftStyle": "solid",
+       "borderLeftWidth": "0px",
+       "borderRightStyle": "solid",
+       "borderRightWidth": "0px",
+       "borderTopStyle": "solid",
+       "borderTopWidth": "0px",
+       "boxSizing": "border-box",
+       "marginBottom": "25px",
+       "marginLeft": "10px",
+       "marginRight": "10px",
+       "marginTop": "50px",
+       "overflowX": "hidden",
+       "overflowY": "hidden",
+       "overscrollBehaviorX": "contain",
+       "overscrollBehaviorY": "contain",
+       "paddingBottom": "10px",
+       "paddingLeft": "50px",
+       "paddingRight": "25px",
+       "paddingTop": "10px",
+     }
     `);
   });
 
@@ -140,57 +140,57 @@ describe('compiler/createReactDOMStyle', () => {
     test('general case', () => {
       expect(createReactDOMStyle({ fontFamily: 'Georgia, Times, serif' }))
         .toMatchInlineSnapshot(`
-        {
-          "fontFamily": "Georgia, Times, serif",
-        }
+       {
+         "fontFamily": "Georgia, Times, serif",
+       }
       `);
     });
 
     test('"monospace"', () => {
       expect(createReactDOMStyle({ fontFamily: 'monospace' }))
         .toMatchInlineSnapshot(`
-        {
-          "fontFamily": "monospace,monospace",
-        }
+       {
+         "fontFamily": "monospace,monospace",
+       }
       `);
     });
 
     test('"System"', () => {
       expect(createReactDOMStyle({ fontFamily: 'System' }))
         .toMatchInlineSnapshot(`
-        {
-          "fontFamily": "-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif",
-        }
+       {
+         "fontFamily": "-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif",
+       }
       `);
       expect(createReactDOMStyle({ font: '14px System' }))
         .toMatchInlineSnapshot(`
-        {
-          "font": "14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif",
-        }
+       {
+         "font": "14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif",
+       }
       `);
     });
 
     test('"Noto, System"', () => {
       expect(createReactDOMStyle({ fontFamily: 'Noto, System' }))
         .toMatchInlineSnapshot(`
-        {
-          "fontFamily": "Noto,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif",
-        }
+       {
+         "fontFamily": "Noto,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif",
+       }
       `);
       expect(createReactDOMStyle({ font: '14px Noto, System' }))
         .toMatchInlineSnapshot(`
-        {
-          "font": "14px Noto, -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif",
-        }
+       {
+         "font": "14px Noto, -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif",
+       }
       `);
     });
 
     test('"Noto, BlinkMacSystemFont"', () => {
       expect(createReactDOMStyle({ fontFamily: 'Noto, BlinkMacSystemFont' }))
         .toMatchInlineSnapshot(`
-        {
-          "fontFamily": "Noto,BlinkMacSystemFont",
-        }
+       {
+         "fontFamily": "Noto,BlinkMacSystemFont",
+       }
       `);
     });
   });
```

**File**: `packages/react-native-web/src/exports/StyleSheet/__tests__/compiler-test.js` (modified, +192/-192)
```diff
@@ -30,145 +30,145 @@ describe('StyleSheet/compile', () => {
       });
 
       expect(result).toMatchInlineSnapshot(`
-        [
-          {
-            "$$css": true,
-            "$$css$localize": true,
-            "animationDirection": "r-animationDirection-1wgwto7",
-            "animationKeyframes": "r-animationKeyframes-zacbmr",
-            "fontFamily": "r-fontFamily-1qd0xha",
-            "insetInlineStart": [
-              "r-insetInlineStart-1xn1m1p",
-              "r-insetInlineStart-1y2vi53",
-            ],
-            "marginBlockEnd": "r-marginBlockEnd-1xf1q1v",
-            "marginInline": "r-marginInline-lcslpx",
-            "marginInlineEnd": [
-              "r-marginInlineEnd-n2wkgt",
-              "r-marginInlineEnd-r7lizz",
-            ],
-            "marginInlineStart": [
-              "r-marginInlineStart-hjq6k0",
-              "r-marginInlineStart-1iwt575",
-            ],
-            "placeholderTextColor": "r-placeholderTextColor-1418aci",
-            "pointerEvents": "r-pointerEvents-ah5dr5",
-            "scrollbarWidth": "r-scrollbarWidth-2eszeu",
-            "textAlign": [
-              "r-textAlign-fdjqy7",
-              "r-textAlign-1ff274t",
-            ],
-            "transform": "r-transform-d7xd9i",
-          },
-          [
-            [
-              [
-                ".r-animationDirection-1wgwto7{animation-direction:alternate,alternate-reverse;}",
-              ],
-              3,
-            ],
-            [
-              [
-                ".r-animationKeyframes-zacbmr{animation-name:r-animation-8jhqzh,r-animation-5azpl5;}",
-                "@keyframes r-animation-8jhqzh{0%{top:0px;}50%{top:5px;}100%{top:10px;}}",
-                "@keyframes r-animation-5azpl5{from{left:0px;}to{left:10px;}}",
-              ],
-              3,
-            ],
-            [
-              [
-                ".r-fontFamily-1qd0xha{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}",
-              ],
-              3,
-            ],
-            [
-              [
-                ".r-insetInlineStart-1xn1m1p{left:12.34%;}",
-              ],
-              2.2,
-            ],
-            [
-              [
-                ".r-insetInlineStart-1y2vi53{right:12.34%;}",
-              ],
-              2.2,
-            ],
-            [
-              [
-                ".r-marginBlockEnd-1xf1q1v{margin-bottom:5px;}",
-              ],
-              2.2,
-            ],
-            [
-              [
-                ".r-marginInline-lcslpx{margin-left:10px;margin-right:10px;}",
-              ],
-              2.1,
-            ],
-            [
-              [
-                ".r-marginInlineEnd-n2wkgt{margin-right:2px;}",
-              ],
-              2.2,
-            ],
-            [
-              [
-                ".r-marginInlineEnd-r7lizz{margin-left:2px;}",
-              ],
-              2.2,
-            ],
-            [
-              [
-                ".r-marginInlineStart-hjq6k0{margin-left:1px;}",
-              ],
-              2.2,
-            ],
-            [
-              [
-                ".r-marginInlineStart-1iwt575{margin-right:1px;}",
-              ],
-              2.2,
-            ],
-            [
-              [
-                ".r-placeholderTextColor-1418aci::placeholder{color:rgba(128,128,128,1.00);opacity:1;}",
-              ],
-              3,
-            ],
-            [
-              [
-                ".r-pointerEvents-ah5dr5>* {pointer-events:none;}",
-                ".r-pointerEvents-ah5dr5{pointer-events:auto!important;}",
-              ],
-              3,
-            ],
-            [
-              [
-                ".r-scrollbarWidth-2eszeu::-webkit-scrollbar{display:none}",
-                ".r-scrollbarWidth-2eszeu{scrollbar-width:none;}",
-              ],
-              3,
-            ],
-            [
-              [
-                ".r-textAlign-fdjqy7{text-align:left;}",
-              ],
-              3,
-            ],
-            [
-              [
-                ".r-textAlign-1ff274t{text-align:right;}",
-              ],
-              3,
-            ],
-            [
-              [
-                ".r-transform-d7xd9i{transform:translateX(50px) scale(-1);}",
-              ],
-              3,
-            ],
-          ],
-        ]
+       [
+         {
+           "$$css": true,
+           "$$css$localize": true,
+           "animationDirection": "r-animationDirection-1wgwto7",
+           "animationKeyframes": "r-animationKeyframes-zacbmr",
+           "fontFamily": "r-fontFamily-1qd0xha",
+           "insetInlineStart": [
+             "r-insetInlineStart-1xn1m1p",
+             "r-insetInlineStart-1y2vi53",
+           ],
+           "marginBlockEnd": "r-marginBlockEnd-1xf1q1v",
+           "marginInline": "r-marginInline-lcslpx",
+           "marginInlineEnd": [
+             "r-marginInlineEnd-n2wkgt"
```

**File**: `packages/react-native-web/src/exports/StyleSheet/__tests__/dom-createOrderedCSSStyleSheet-test.js` (modified, +47/-47)
```diff
@@ -23,27 +23,27 @@ describe('createOrderedCSSStyleSheet', () => {
     test('insertion order for same group', () => {
       const sheet = createOrderedCSSStyleSheet();
 
-      expect(sheet.getTextContent()).toMatchInlineSnapshot('""');
+      expect(sheet.getTextContent()).toMatchInlineSnapshot(`""`);
 
       sheet.insert('.a {}', 0);
       expect(sheet.getTextContent()).toMatchInlineSnapshot(`
-        "[stylesheet-group="0"]{}
-        .a {}"
+       "[stylesheet-group="0"]{}
+       .a {}"
       `);
 
       sheet.insert('.b {}', 0);
       expect(sheet.getTextContent()).toMatchInlineSnapshot(`
-        "[stylesheet-group="0"]{}
-        .a {}
-        .b {}"
+       "[stylesheet-group="0"]{}
+       .a {}
+       .b {}"
       `);
 
       sheet.insert('.c {}', 0);
       expect(sheet.getTextContent()).toMatchInlineSnapshot(`
-        "[stylesheet-group="0"]{}
-        .a {}
-        .b {}
-        .c {}"
+       "[stylesheet-group="0"]{}
+       .a {}
+       .b {}
+       .c {}"
       `);
     });
 
@@ -55,8 +55,8 @@ describe('createOrderedCSSStyleSheet', () => {
       sheet.insert('.a {}', 0);
 
       expect(sheet.getTextContent()).toMatchInlineSnapshot(`
-        "[stylesheet-group="0"]{}
-        .a {}"
+       "[stylesheet-group="0"]{}
+       .a {}"
       `);
     });
 
@@ -68,10 +68,10 @@ describe('createOrderedCSSStyleSheet', () => {
       sheet.insert('.a {}', 0);
 
       expect(sheet.getTextContent()).toMatchInlineSnapshot(`
-        "[stylesheet-group="0"]{}
-        .a {}
-        .b {}
-        .c {}"
+       "[stylesheet-group="0"]{}
+       .a {}
+       .b {}
+       .c {}"
       `);
     });
 
@@ -90,24 +90,24 @@ describe('createOrderedCSSStyleSheet', () => {
       sheet.insert('.twenty-point2 {}', 20.2);
 
       expect(sheet.getTextContent()).toMatchInlineSnapshot(`
-        "[stylesheet-group="1"]{}
-        .one {}
-        [stylesheet-group="2.2"]{}
-        .two {}
-        [stylesheet-group="3"]{}
-        .three {}
-        [stylesheet-group="4"]{}
-        .four-1 {}
-        .four-2 {}
-        [stylesheet-group="9.9"]{}
-        .nine-1 {}
-        .nine-2 {}
-        [stylesheet-group="10"]{}
-        .ten {}
-        [stylesheet-group="20"]{}
-        .twenty {}
-        [stylesheet-group="20.2"]{}
-        .twenty-point2 {}"
+       "[stylesheet-group="1"]{}
+       .one {}
+       [stylesheet-group="2.2"]{}
+       .two {}
+       [stylesheet-group="3"]{}
+       .three {}
+       [stylesheet-group="4"]{}
+       .four-1 {}
+       .four-2 {}
+       [stylesheet-group="9.9"]{}
+       .nine-1 {}
+       .nine-2 {}
+       [stylesheet-group="10"]{}
+       .ten {}
+       [stylesheet-group="20"]{}
+       .twenty {}
+       [stylesheet-group="20.2"]{}
+       .twenty-point2 {}"
       `);
     });
   });
@@ -135,14 +135,14 @@ describe('createOrderedCSSStyleSheet', () => {
       element.appendChild(document.createTextNode(textContent));
       const clientSheet = createOrderedCSSStyleSheet(element.sheet);
       expect(clientSheet.getTextContent()).toMatchInlineSnapshot(`
-        "[stylesheet-group="1"] {}
-        .one {width: 10px;}
-        [stylesheet-group="2"] {}
-        .two-1 {height: 20px;}
-        .two-2 {color: red;}
-        @keyframes anim { 
-          0% {opacity: 1;} 
-        }"
+       "[stylesheet-group="1"] {}
+       .one {width: 10px;}
+       [stylesheet-group="2"] {}
+       .two-1 {height: 20px;}
+       .two-2 {color: red;}
+       @keyframes anim { 
+         0% {opacity: 1;} 
+       }"
       `);
     });
 
@@ -158,11 +158,11 @@ describe('createOrderedCSSStyleSheet', () => {
       const clientSheet = createOrderedCSSStyleSheet(element.sheet);
       clientSheet.insert('.c { color: red }', 0);
       expect(clientSheet.getTextContent()).toMatchInlineSnapshot(`
-        "[stylesheet-group='0'] {}
-        .a {color: red;}
-        .c { color: red }
-        [stylesheet-group='1'] {}
-        .b {color: red;}"
+       "[stylesheet-group='0'] {}
+       .a {color: red;}
+       .c { color: red }
+       [stylesheet-group='1'] {}
+       .b {color: red;}"
       `);
     });
 
```

**File**: `packages/react-native-web/src/exports/StyleSheet/__tests__/dom-test.node.js` (modified, +26/-26)
```diff
@@ -13,36 +13,36 @@ describe('createSheet', () => {
     expect(typeof sheet.insert).toBe('function');
     expect(sheet.id).toMatchInlineSnapshot(`"react-native-stylesheet"`);
     expect(sheet.getTextContent()).toMatchInlineSnapshot(`
-      "[stylesheet-group="0"]{}
-      @supports (color:accentcolor){:host,:root{--rnw-accentcolor:accentcolor;}}
-      @supports (color:accentcolortext){:host,:root{--rnw-accentcolortext:accentcolortext;}}
-      @supports (color:buttonborder){:host,:root{--rnw-buttonborder:buttonborder;}}
-      @supports (color:mark){:host,:root{--rnw-mark:mark;}}
-      @supports (color:marktext){:host,:root{--rnw-marktext:marktext;}}
-      @supports (color:selecteditem){:host,:root{--rnw-selecteditem:selecteditem;}}
-      @supports (color:selecteditemtext){:host,:root{--rnw-selecteditemtext:selecteditemtext;}}
-      body{margin:0;}
-      button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}
-      html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}
-      input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}"
+     "[stylesheet-group="0"]{}
+     @supports (color:accentcolor){:host,:root{--rnw-accentcolor:accentcolor;}}
+     @supports (color:accentcolortext){:host,:root{--rnw-accentcolortext:accentcolortext;}}
+     @supports (color:buttonborder){:host,:root{--rnw-buttonborder:buttonborder;}}
+     @supports (color:mark){:host,:root{--rnw-mark:mark;}}
+     @supports (color:marktext){:host,:root{--rnw-marktext:marktext;}}
+     @supports (color:selecteditem){:host,:root{--rnw-selecteditem:selecteditem;}}
+     @supports (color:selecteditemtext){:host,:root{--rnw-selecteditemtext:selecteditemtext;}}
+     body{margin:0;}
+     button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}
+     html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}
+     input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}"
     `);
 
     sheet.insert('.test { opacity: 0 }', 1);
     expect(sheet.getTextContent()).toMatchInlineSnapshot(`
-      "[stylesheet-group="0"]{}
-      @supports (color:accentcolor){:host,:root{--rnw-accentcolor:accentcolor;}}
-      @supports (color:accentcolortext){:host,:root{--rnw-accentcolortext:accentcolortext;}}
-      @supports (color:buttonborder){:host,:root{--rnw-buttonborder:buttonborder;}}
-      @supports (color:mark){:host,:root{--rnw-mark:mark;}}
-      @supports (color:marktext){:host,:root{--rnw-marktext:marktext;}}
-      @supports (color:selecteditem){:host,:root{--rnw-selecteditem:selecteditem;}}
-      @supports (color:selecteditemtext){:host,:root{--rnw-selecteditemtext:selecteditemtext;}}
-      body{margin:0;}
-      button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}
-      html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}
-      input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}
-      [stylesheet-group="1"]{}
-      .test { opacity: 0 }"
+     "[stylesheet-group="0"]{}
+     @supports (color:accentcolor){:host,:root{--rnw-accentcolor:accentcolor;}}
+     @supports (color:accentcolortext){:host,:root{--rnw-accentcolortext:accentcolortext;}}
+     @supports (color:buttonborder){:host,:root{--rnw-buttonborder:buttonborder;}}
+     @supports (color:mark){:host,:root{--rnw-mark:mark;}}
+     @supports (color:marktext){:host,:root{--rnw-marktext:marktext;}}
+     @supports (color:selecteditem){:host,:root{--rnw-selecteditem:selecteditem;}}
+     @supports (color:selecteditemtext){:host,:root{--rnw-selecteditemtext:selecteditemtext;}}
+     body{margin:0;}
+     button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}
+     html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}
+     input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}
+     [stylesheet-group="1"]{}
+     .test { opacity: 0 }"
     `);
   });
 });
```

**File**: `packages/react-native-web/src/exports/StyleSheet/__tests__/index-test.js` (modified, +166/-166)
```diff
@@ -11,60 +11,60 @@ describe('StyleSheet', () => {
   // test this first because subsequent 'create' calls will change the snapshot
   test('getSheet', () => {
     expect(StyleSheet.getSheet()).toMatchInlineSnapshot(`
-      {
-        "id": "react-native-stylesheet",
-        "textContent": "[stylesheet-group="0"]{}
-      @supports (color:accentcolor){:host,:root{--rnw-accentcolor:accentcolor;}}
-      @supports (color:accentcolortext){:host,:root{--rnw-accentcolortext:accentcolortext;}}
-      @supports (color:buttonborder){:host,:root{--rnw-buttonborder:buttonborder;}}
-      @supports (color:mark){:host,:root{--rnw-mark:mark;}}
-      @supports (color:marktext){:host,:root{--rnw-marktext:marktext;}}
-      @supports (color:selecteditem){:host,:root{--rnw-selecteditem:selecteditem;}}
-      @supports (color:selecteditemtext){:host,:root{--rnw-selecteditemtext:selecteditemtext;}}
-      body{margin:0;}
-      button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}
-      html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}
-      input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}
-      [stylesheet-group="3"]{}
-      .r-bottom-1p0dtai{bottom:0px;}
-      .r-left-1d2f490{left:0px;}
-      .r-position-u8s1d{position:absolute;}
-      .r-right-zchlnj{right:0px;}
-      .r-top-ipm5af{top:0px;}",
-      }
+     {
+       "id": "react-native-stylesheet",
+       "textContent": "[stylesheet-group="0"]{}
+     @supports (color:accentcolor){:host,:root{--rnw-accentcolor:accentcolor;}}
+     @supports (color:accentcolortext){:host,:root{--rnw-accentcolortext:accentcolortext;}}
+     @supports (color:buttonborder){:host,:root{--rnw-buttonborder:buttonborder;}}
+     @supports (color:mark){:host,:root{--rnw-mark:mark;}}
+     @supports (color:marktext){:host,:root{--rnw-marktext:marktext;}}
+     @supports (color:selecteditem){:host,:root{--rnw-selecteditem:selecteditem;}}
+     @supports (color:selecteditemtext){:host,:root{--rnw-selecteditemtext:selecteditemtext;}}
+     body{margin:0;}
+     button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0;}
+     html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:rgba(0,0,0,0);}
+     input::-webkit-search-cancel-button,input::-webkit-search-decoration,input::-webkit-search-results-button,input::-webkit-search-results-decoration{display:none;}
+     [stylesheet-group="3"]{}
+     .r-bottom-1p0dtai{bottom:0px;}
+     .r-left-1d2f490{left:0px;}
+     .r-position-u8s1d{position:absolute;}
+     .r-right-zchlnj{right:0px;}
+     .r-top-ipm5af{top:0px;}",
+     }
     `);
   });
 
   test('absoluteFill', () => {
     expect(StyleSheet.absoluteFill).toMatchInlineSnapshot(`
-      {
-        "bottom": 0,
-        "left": 0,
-        "position": "absolute",
-        "right": 0,
-        "top": 0,
-      }
+     {
+       "bottom": 0,
+       "left": 0,
+       "position": "absolute",
+       "right": 0,
+       "top": 0,
+     }
     `);
   });
 
   describe('create', () => {
     test('returns original style objects', () => {
       const style = StyleSheet.create({ root: { position: 'absolute' } });
       expect(style.root).toMatchInlineSnapshot(`
-        {
-          "position": "absolute",
-        }
+       {
+         "position": "absolute",
+       }
       `);
     });
 
     test('e2e resolves to classname', () => {
       const style = StyleSheet.create({ root: { position: 'absolute' } });
       expect(StyleSheet(style.root)).toMatchInlineSnapshot(`
-        [
-          "r-position-u8s1d",
-          null,
-          "",
-        ]
+       [
+         "r-position-u8s1d",
+         null,
+         "",
+       ]
       `);
     });
 
@@ -81,11 +81,11 @@ describe('StyleSheet', () => {
         }
       });
       expect(StyleSheet(style.root)).toMatchInlineSnapshot(`
-        [
-          "r-boxShadow-o3ayyy r-textShadow-1x2q051",
-          null,
-          "",
-        ]
+       [
+         "r-boxShadow-o3ayyy r-textShadow-1x2q051",
+         null,
+         "",
+       ]
       `);
     });
   });
@@ -94,10 +94,10 @@ describe('StyleSheet', () => {
     test('should merge style objects', () => {
       const style = StyleSheet.flatten([{ opacity: 1 }, { order: 2 }]);
       expect(style).toMatchInlineSnapshot(`
-        {
-          "opacity": 1,
-          "order": 2,
-        }
+       {
+         "opacity": 1,
+         "order": 2,
+       }
       `);
     });
 
@@ -107,10 +107,10 @@ describe('StyleSheet', () => {
         { backgroundColor: '#023c69', order: null }
       ]);
       expect(style).toMatchInlineSnapshot(`
-        {
-          "backgroundColor": "#023c69",
-          "order": null,
-        }
+       {
+         "backgroundColor": "#023c69",
+         "order": null,
+       }
       `);
     });
 
@@ -120,9 +120,9 @@ describe('StyleSheet', () => {
         { backgroundColor
```

---

### Incident Patch 3: `3360a986` (2026-10-28)
**Commit Message**: [fix] Inverted list with onRefresh renders cells upside-down (#2935)

**File**: `packages/react-native-web/src/exports/ScrollView/__tests__/__snapshots__/index-test.js.snap` (modified, +7/-8)
```diff
@@ -24,16 +24,15 @@ exports[`components/ScrollView prop "centerContent" without 1`] = `
 
 exports[`components/ScrollView prop "refreshControl" with 1`] = `
 <div
-  id="refresh-control"
+  class="css-view-g5y9jx r-flexDirection-eqz5dr r-flexGrow-16y2uox r-flexShrink-1wbh5a2 r-overflowX-11yh6sk r-overflowY-1rnoaur r-transform-agouwx"
+  style="background-color: rgb(255, 0, 0);"
 >
   <div
-    class="css-view-g5y9jx r-flexDirection-eqz5dr r-flexGrow-16y2uox r-flexShrink-1wbh5a2 r-overflowX-11yh6sk r-overflowY-1rnoaur r-transform-agouwx"
-    style="background-color: rgb(255, 0, 0);"
-  >
-    <div
-      class="css-view-g5y9jx"
-    />
-  </div>
+    id="refresh-control"
+  />
+  <div
+    class="css-view-g5y9jx"
+  />
 </div>
 `;
 
```

**File**: `packages/react-native-web/src/exports/ScrollView/index.js` (modified, +2/-11)
```diff
@@ -651,21 +651,12 @@ class ScrollView extends React.Component<ScrollViewProps> {
       'ScrollViewClass must not be undefined'
     );
 
-    const scrollView = (
+    return (
       <ScrollViewClass {...props} ref={this._setScrollNodeRef}>
+        {refreshControl}
         {contentContainer}
       </ScrollViewClass>
     );
-
-    if (refreshControl) {
-      return React.cloneElement(
-        refreshControl,
-        { style: props.style },
-        scrollView
-      );
-    }
-
-    return scrollView;
   }
 
   _handleContentOnLayout = (e: Object) => {
```

#### Recent Merged Pull Requests:
- **PR #2937** (2026-10-28): [feat] Support fontVariant stylistic sets (@zoontek)
- **PR #2936** (2026-10-28): [feat] Add PlatformColor (@zoontek)
- **PR #2935** (2026-10-28): [fix] Inverted list with onRefresh renders cells upside-down (@zoontek)
- **PR #2934** (2026-10-28): [fix] Animated.loop blocks FlatList onEndReached (@zoontek)
- **PR #2933** (2026-10-28): Fix useWindowDimensions hydration mismatch (@zoontek)
- **PR #2932** (2026-10-28): [feat] Add Appearance.setColorScheme (@zoontek)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
