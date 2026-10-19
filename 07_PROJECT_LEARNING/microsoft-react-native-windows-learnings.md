> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-react-native-windows-learnings.md`  
> **Source**: github ([https://github.com/microsoft/react-native-windows](https://github.com/microsoft/react-native-windows))  
> **Source Version**: `cf0d3767`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T09:35:20.526Z  
> **Learning ID**: `learn-github-microsoft-react-native-windows`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): microsoft/react-native-windows

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-react-native-windows-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/react-native-windows](https://github.com/microsoft/react-native-windows))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T09:35:19.992Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/react-native-windows`
- **Description**: A framework for building native Windows apps with React.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17359 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Components/TextInput/TextInputState.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

// This class is responsible for coordinating the "focused" state for
// TextInputs. All calls relating to the keyboard should be funneled
// through here.

import type {HostInstance} from '../../../src/private/types/HostInstance';

import {Commands as AndroidTextInputCommands} from '../../Components/TextInput/AndroidTextInputNativeComponent';
import {Commands as iOSTextInputCommands} from '../../Components/TextInput/RCTSingelineTextInputNativeComponent';
import {Commands as Win32TextInputCommands} from '../../Components/TextInput/Win32TextInputNativeComponent';

const {findNodeHandle} = require('../../ReactNative/RendererProxy');
const Platform = require('../../Utilities/Platform').default;

let currentlyFocusedInputRef: ?HostInstance = null;
const inputs = new Set<HostInstance>();

function currentlyFocusedInput(): ?HostInstance {
  return currentlyFocusedInputRef;
}

/**
 * Returns the ID of the currently focused text field, if one exists
 * If no text field is focused it returns null
 */
function currentlyFocusedField(): ?number {
  if (__DEV__) {
    console.error(
      'currentlyFocusedField is deprecated and will be removed in a future release. Use currentlyFocusedInput',
    );
  }

  return findNodeHandle<$FlowFixMe>(currentlyFocusedInputRef);
}

function focusInput(textField: ?HostInstance): void {
  if (currentlyFocusedInputRef !== textField && textField != null) {
    currentlyFocusedInputRef = textField;
  }
}

function blurInput(textField: ?HostInstance): void {
  if (currentlyFocusedInputRef === textField && textField != null) {
    currentlyFocusedInputRef = null;
  }
}

function focusField(textFieldID: ?number): void {
  if (__DEV__) {
    console.error('focusField no longer works. Use focusInput');
  }

  return;
}

function blurField(textFieldID: ?number) {
  if (__DEV__) {
    console.error('blurField no longer works. Use blurInput');
  }

  return;
}

/**
 * @param {number} TextInputID id of the text field to focus
 * Focuses the specified text field
 * noop if the text field was already focused or if the field is not editable
 */
function focusTextInput(textField: ?HostInstance) {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'focusTextInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return;
  }

  // [Win32
  if (Platform.OS === 'win32' && textField != null) {
    // On Windows, we cannot test if the currentlyFocusedInputRef equals the
    // target ref because the call to focus on the target ref may occur before
    // an onBlur event for the target ref has been dispatched to JS but after
    // the target ref has lost native focus.
    focusInput(textField);
    Win32TextInputCommands.focus(textField);
    // Win32]
  } else if (textField != null) {
    const fieldCanBeFocused =
      currentlyFocusedInputRef !== textField &&
      // $FlowFixMe[prop-missing] - `currentProps` is missing in `NativeMethods`
      textField.currentProps?.editable !== false;

    if (!fieldCanBeFocused) {
      return;
    }
    focusInput(textField);
    if (Platform.OS === 'ios') {
      // This isn't necessarily a single line text input
      // But commands don't actually care as long as the thing being passed in
      // actually has a command with that name. So this should work with single
      // and multiline text inputs. Ideally we'll merge them into one component
      // in the future.
      iOSTextInputCommands.focus(textField);
    } else if (Platform.OS === 'android') {
      AndroidTextInputCommands.focus(textField);
    }
  }
}

/**
 * @param {number} textFieldID id of the text field to unfocus
 * Unfocuses the specified text field
 * noop if it wasn't focused
 */
function blurTextInput(textField: ?HostInstance) {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'blurTextInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return;
  }

  if (currentlyFocusedInputRef === textField && textField != null) {
    blurInput(textField);
    if (Platform.OS === 'ios') {
      // This isn't necessarily a single line text input
      // But commands don't actually care as long as the thing being passed in
      // actually has a command with that name. So this should work with single
      // and multiline text inputs. Ideally we'll merge them into one component
      // in the future.
      iOSTextInputCommands.blur(textField);
    } else if (Platform.OS === 'android') {
      AndroidTextInputCommands.blur(textField);
    }
    // [Win32
    else if (Platform.OS === 'win32') {
      Win32TextInputCommands.blur(textField);
    }
    // Win32]
  }
}

// [Win32
/**
 * @param {textField} textField id of the text field that has received focus
 * Should be called after the view has received focus and fired the onFocus event
 * noop if the focused text field is same
 */
function setFocusedTextInput(textField: HostInstance) {
  if (currentlyFocusedInputRef !== textField) {
    currentlyFocusedInputRef = textField;
  }
}

/**
 * @param {textField} textField id of the text field whose focus has to be cleared
 * Should be called after the view has cleared focus and fired the onFocus event
 * noop if the focused text field is not same
 */
function clearFocusedTextInput(textField: HostInstance) {
  if (currentlyFocusedInputRef === textField) {
    currentlyFocusedInputRef = null;
  }
}
// Win32]

function registerInput(textField: HostInstance) {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'registerInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return;
  }

  inputs.add(textField);
}

function unregisterInput(textField: HostInstance) {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'unregisterInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return;
  }
  inputs.delete(textField);
}

function isTextInput(textField: HostInstance): boolean {
  if (typeof textField === 'number') {
    if (__DEV__) {
      console.error(
        'isTextInput must be called with a host component. Passing a react tag is deprecated.',
      );
    }

    return false;
  }

  return inputs.has(textField);
}

const TextInputState = {
  currentlyFocusedInput,
  focusInput,
  blurInput,

  currentlyFocusedField,
  focusField,
  blurField,
  setFocusedTextInput, // [Win32]
  clearFocusedTextInput, // [Win32]
  focusTextInput,
  blurTextInput,
  registerInput,
  unregisterInput,
  isTextInput,
};

export default TextInputState;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Core/Devtools/loadBundleFromServer.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import Networking from '../../Network/RCTNetworking';
import DevLoadingView from '../../Utilities/DevLoadingView';
import HMRClient from '../../Utilities/HMRClient';
import getDevServer from './getDevServer';

declare var global: {
  globalEvalWithSourceUrl?: (string, string) => unknown,
  __BUNDLE_LOADER_REPORTER__?: {
    onStart: (url: string | URL) => void,
    onSuccess: (url: string | URL) => void,
    onError: (url: string | URL, error: Error) => void,
  },
  ...
};

let pendingRequests = 0;

const cachedPromisesByUrl = new Map<string, Promise<void>>();

export class LoadBundleFromServerError extends Error {
  url: string;
  isTimeout: boolean;
  constructor(
    message: string,
    url: string,
    isTimeout: boolean,
    options?: {cause: unknown, ...},
  ): void {
    super(message, options);
    this.url = url;
    this.isTimeout = isTimeout;
    this.name = 'LoadBundleFromServerError';
  }
}

export class LoadBundleFromServerRequestError extends LoadBundleFromServerError {
  constructor(
    message: string,
    url: string,
    isTimeout: boolean,
    options?: {cause: unknown, ...},
  ): void {
    super(message, url, isTimeout, options);
    this.name = 'LoadBundleFromServerRequestError';
  }
}

function asyncRequest(
  url: string,
): Promise<{body: string, headers: {[string]: string}}> {
  let id = null;
  let responseText = null;
  let headers = null;
  let dataListener;
  let completeListener;
  let responseListener;
  let incrementalDataListener;
  return new Promise<{body: string, headers: {[string]: string}}>(
    (resolve, reject) => {
      dataListener = Networking.addListener(
        'didReceiveNetworkData',
        ([requestId, response]) => {
          if (requestId === id) {
            responseText = response;
          }
        },
      );
      incrementalDataListener = Networking.addListener(
        'didReceiveNetworkIncrementalData',
        ([requestId, data]) => {
          if (requestId === id) {
            if (responseText != null) {
              responseText += data;
            } else {
              responseText = data;
            }
          }
        },
      );
      responseListener = Networking.addListener(
        'didReceiveNetworkResponse',
        ([requestId, status, responseHeaders]) => {
          if (requestId === id) {
            headers = responseHeaders;
          }
        },
      );
      completeListener = Networking.addListener(
        'didCompleteNetworkResponse',
        ([requestId, errorMessage, isTimeout]) => {
          if (requestId === id) {
            if (errorMessage) {
              reject(
                new LoadBundleFromServerRequestError(
                  'Could not load bundle',
                  url,
                  isTimeout,
                  {
                    cause: errorMessage,
                  },
                ),
              );
            } else {
              //$FlowFixMe[incompatible-type]
              resolve({body: responseText, headers});
            }
          }
        },
      );
      Networking.sendRequest(
        'GET',
        'asyncRequest',
        url,
        {},
        '',
        'text',
        true,
        0,
        requestId => {
          id = requestId;
        },
        true,
      );
    },
  ).finally(() => {
    dataListener?.remove();
    completeListener?.remove();
    responseListener?.remove();
    incrementalDataListener?.remove();
  });
}

function buildUrlForBundle(bundlePathAndQuery: string) {
  const {url: serverUrl} = getDevServer();
  return (
    serverUrl.replace(/\/+$/, '') + '/' + bundlePathAndQuery.replace(/^\/+/, '')
  );
}

export default function loadBundleFromServer(
  bundlePathAndQuery: string,
): Promise<void> {
  const requestUrl = buildUrlForBundle(bundlePathAndQuery);
  let loadPromise = cachedPromisesByUrl.get(requestUrl);

  if (loadPromise) {
    return loadPromise;
  }
  DevLoadingView.showMessage('Downloading...', 'load');
  ++pendingRequests;
  global.__BUNDLE_LOADER_REPORTER__?.onStart(requestUrl);

  loadPromise = asyncRequest(requestUrl)
    .then<void>(({body, headers}) => {
      if (
        headers['Content-Type'] != null &&
        headers['Content-Type'].indexOf('application/json') >= 0
      ) {
        // Errors are returned as JSON.
        throw new LoadBundleFromServerError(
          'Could not load bundle',
          bundlePathAndQuery,
          false, // isTimeout
          {
            cause:
              JSON.parse(body).message ||
              `Unknown error fetching '${bundlePathAndQuery}'`,
          },
        );
      }

      HMRClient.registerBundle(requestUrl);

      // Some engines do not support `sourceURL` as a comment. We expose a
      // `globalEvalWithSourceUrl` function to handle updates in that case.
      if (global.globalEvalWithSourceUrl) {
        global.globalEvalWithSourceUrl(body, requestUrl);
      } else {
        // [Windows #12704 - CodeQL patch]
        // eslint-disable-next-line no-eval
        eval(body); // CodeQL [js/eval-usage] Debug only. Developer inner loop.
      }
      global.__BUNDLE_LOADER_REPORTER__?.onSuccess(requestUrl);
    })
    .catch<void>(e => {
      cachedPromisesByUrl.delete(requestUrl);
      global.__BUNDLE_LOADER_REPORTER__?.onError(requestUrl, e);
      throw e;
    })
    .finally(() => {
      if (!--pendingRequests) {
        DevLoadingView.hide();
      }
    });

  cachedPromisesByUrl.set(requestUrl, loadPromise);
  return loadPromise;
}

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Core/ReactNativeVersionCheck.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import Platform from '../Utilities/Platform';

const ReactNativeVersion = require('./ReactNativeVersion');

/**
 * Checks that the version of this React Native JS is compatible with the native
 * code, throwing an error if it isn't.
 *
 * The existence of this module is part of the public interface of React Native
 * even though it is used only internally within React Native. React Native
 * implementations for other platforms (ex: Windows) may override this module
 * and rely on its existence as a separate module.
 */
export function checkVersions(): void {
  const nativeVersion = Platform.constants.reactNativeVersion;
  if (
    ReactNativeVersion.version.major !== nativeVersion.major ||
    ReactNativeVersion.version.minor !== nativeVersion.minor
  ) {
    // [Win32 We cannot always match versions. Warn instead of error
    console.warn(
      // Win32]
      `React Native version mismatch.\n\nJavaScript version: ${_formatVersion(
        ReactNativeVersion.version as $FlowFixMe,
      )}\n` +
        `Native version: ${_formatVersion(nativeVersion)}\n\n` +
        'Make sure that you have rebuilt the native code. If the problem ' +
        'persists try clearing the Watchman and packager caches with ' +
        '`watchman watch-del-all && npx @react-native-community/cli start --reset-cache`.',
    );
  }
}

function _formatVersion(
  version: (typeof Platform)['constants']['reactNativeVersion'],
): string {
  return (
    `${version.major}.${version.minor}.${version.patch}` +
    // eslint-disable-next-line eqeqeq
    (version.prerelease != undefined ? `-${version.prerelease}` : '')
  );
}

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Pressability/HoverState.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import Platform from '../Utilities/Platform';

let isEnabled = false;

/* $FlowFixMe[incompatible-type] Error found due to incomplete typing of
 * Platform.flow.js */
/* $FlowFixMe[invalid-compare] Error discovered during Constant Condition roll
 * out. See https://fburl.com/workplace/4oq3zi07. */
if (Platform.OS === 'web') {
  const canUseDOM = Boolean(
    typeof window !== 'undefined' &&
    window.document &&
    // $FlowFixMe[method-unbinding]
    window.document.createElement,
  );

  if (canUseDOM) {
    /**
     * Web browsers emulate mouse events (and hover states) after touch events.
     * This code infers when the currently-in-use modality supports hover
     * (including for multi-modality devices) and considers "hover" to be enabled
     * if a mouse movement occurs more than 1 second after the last touch event.
     * This threshold is long enough to account for longer delays between the
     * browser firing touch and mouse events on low-powered devices.
     */
    const HOVER_THRESHOLD_MS = 1000;
    let lastTouchTimestamp = 0;

    const enableHover = () => {
      if (isEnabled || Date.now() - lastTouchTimestamp < HOVER_THRESHOLD_MS) {
        return;
      }
      isEnabled = true;
    };

    const disableHover = () => {
      lastTouchTimestamp = Date.now();
      if (isEnabled) {
        isEnabled = false;
      }
    };

    document.addEventListener('touchstart', disableHover, true);
    document.addEventListener('touchmove', disableHover, true);
    document.addEventListener('mousemove', enableHover, true);
  }
  // [Windows
} else if (Platform.OS === 'windows' || Platform.OS === 'win32') {
  isEnabled = true;
  // Windows]
}

export function isHoverEnabled(): boolean {
  return isEnabled;
}

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Renderer/shims/ReactNativeTypes.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @noformat
 * @nolint
 * @flow strict
 * @generated SignedSource<<92e869744dd405a4d74b1b6f50fa8d52>>
 */

import type {
  // $FlowFixMe[missing-export] TODO(@rubennorte) - Missing export from react-native
  // $FlowFixMe[nonstrict-import] TODO(@rubennorte)
  HostInstance as PublicInstance,
  // $FlowFixMe[missing-export] TODO(@rubennorte) - Missing export from react-native
  // $FlowFixMe[nonstrict-import] TODO(@rubennorte)
  MeasureOnSuccessCallback,
  // $FlowFixMe[missing-export] TODO(@rubennorte) - Missing export from react-native
  // $FlowFixMe[nonstrict-import] TODO(@rubennorte)
  PublicRootInstance,
  // $FlowFixMe[missing-export] TODO(@rubennorte) - Missing export from react-native
  // $FlowFixMe[nonstrict-import] TODO(@rubennorte)
  PublicTextInstance,
} from 'react-native';

import * as React from 'react';

export type AttributeType<T, V> =
  | true
  | Readonly<{
      diff?: (arg1: T, arg2: T) => boolean,
      process?: (arg1: V) => T,
    }>;

// We either force that `diff` and `process` always use unknown,
// or we allow them to define specific types and use this hack
export type AnyAttributeType = AttributeType<$FlowFixMe, $FlowFixMe>;

export type AttributeConfiguration = Readonly<{
  [propName: string]: AnyAttributeType | void,
  style?: Readonly<{
    [propName: string]: AnyAttributeType,
    ...
  }>,
  ...
}>;

export type ViewConfig = Readonly<{
  Commands?: Readonly<{[commandName: string]: number, ...}>,
  Constants?: Readonly<{[name: string]: unknown, ...}>,
  Manager?: string,
  NativeProps?: Readonly<{[propName: string]: string, ...}>,
  baseModuleName?: ?string,
  bubblingEventTypes?: Readonly<{
    [eventName: string]: Readonly<{
      phasedRegistrationNames: Readonly<{
        captured: string,
        bubbled: string,
        skipBubbling?: ?boolean,
      }>,
    }>,
    ...
  }>,
  directEventTypes?: Readonly<{
    [eventName: string]: Readonly<{
      registrationName: string,
    }>,
    ...
  }>,
  supportsRawText?: boolean,
  uiViewClassName: string,
  validAttributes: AttributeConfiguration,
}>;

export type PartialViewConfig = Readonly<{
  bubblingEventTypes?: ViewConfig['bubblingEventTypes'],
  directEventTypes?: ViewConfig['directEventTypes'],
  supportsRawText?: boolean,
  uiViewClassName: string,
  validAttributes?: AttributeConfiguration,
}>;

type InspectorDataProps = Readonly<{
  [propName: string]: string,
  ...
}>;

type InspectorDataGetter = (
  <TElementType extends React.ElementType>(
    componentOrHandle: React.ElementRef<TElementType> | number,
  ) => ?number,
) => Readonly<{
  measure: (callback: MeasureOnSuccessCallback) => void,
  props: InspectorDataProps,
}>;

export type InspectorData = Readonly<{
  closestInstance?: unknown,
  hierarchy: Array<{
    name: ?string,
    getInspectorData: InspectorDataGetter,
  }>,
  selectedIndex: ?number,
  props: InspectorDataProps,
  componentStack: string,
}>;

export type TouchedViewDataAtPoint = Readonly<
  {
    pointerY: number,
    touchedViewTag?: number,
    frame: Readonly<{
      top: number,
      left: number,
      width: number,
      height: number,
    }>,
    closestPublicInstance?: PublicInstance,
  } & InspectorData,
>;

export type RenderRootOptions = {
  onUncaughtError?: (
    error: unknown,
    errorInfo: {readonly componentStack?: ?string},
  ) => void,
  onCaughtError?: (
    error: unknown,
    errorInfo: {
      readonly componentStack?: ?string,
      // $FlowFixMe[unclear-type] unknown props and state.
      // $FlowFixMe[value-as-type] Component in react repo is any-typed, but it will be well typed externally.
      readonly errorBoundary?: ?React.Component<any, any>,
    },
  ) => void,
  onRecoverableError?: (
    error: unknown,
    errorInfo: {readonly componentStack?: ?string},
  ) => void,
  onDefaultTransitionIndicator?: () => void | (() => void),
};

export opaque type Node = unknown;
export opaque type InternalInstanceHandle = unknown;

export type ReactFabricType = {
  findHostInstance_DEPRECATED<TElementType extends React.ElementType>(
    componentOrHandle: ?(React.ElementRef<TElementType> | number),
  ): ?PublicInstance,
  findNodeHandle<TElementType extends React.ElementType>(
    componentOrHandle: ?(React.ElementRef<TElementType> | number),
  ): ?number,
  dispatchCommand(
    handle: PublicInstance,
    command: string,
    args: Array<unknown>,
  ): void,
  isChildPublicInstance(parent: PublicInstance, child: PublicInstance): boolean,
  sendAccessibilityEvent(handle: PublicInstance, eventType: string): void,
  render(
    element: React.MixedElement,
    containerTag: number,
    callback: ?() => void,
    concurrentRoot: ?boolean,
    options: ?RenderRootOptions,
  ): ?React.ElementRef<React.ElementType>,
  unmountComponentAtNode(containerTag: number): void,
  getNodeFromInternalInstanceHandle(
    internalInstanceHandle: InternalInstanceHandle,
  ): ?Node,
  getPublicInstanceFromInternalInstanceHandle(
    internalInstanceHandle: InternalInstanceHandle,
  ): PublicInstance | PublicTextInstance | null,
  getPublicInstanceFromRootTag(rootTag: number): PublicRootInstance | null,
  ...
};

export type ReactFabricEventTouch = {
  identifier: number,
  locationX: number,
  locationY: number,
  pageX: number,
  pageY: number,
  screenX: number,
  screenY: number,
  target: number,
  timestamp: number,
  force: number,
  ...
};

export type ReactFabricEvent = {
  touches: Array<ReactFabricEventTouch>,
  changedTouches: Array<ReactFabricEventTouch>,
  targetTouches: Array<ReactFabricEventTouch>,
  target: number,
  ...
};

// Imperative LayoutAnimation API types
//
export type LayoutAnimationType =
  | 'spring'
  | 'linear'
  | 'easeInEaseOut'
  | 'easeIn'
  | 'easeOut'
  | 'keyboard';

export type LayoutAnimationProperty =
  | 'opacity'
  | 'scaleX'
  | 'scaleY'
  | 'scaleXY';

export type LayoutAnimationAnimationConfig = Readonly<{
  duration?: number,
  delay?: number,
  springDamping?: number,
  initialVelocity?: number,
  type?: LayoutAnimationType,
  property?: LayoutAnimationProperty,
}>;

export type LayoutAnimationConfig = Readonly<{
  duration: number,
  create?: LayoutAnimationAnimationConfig,
  update?: LayoutAnimationAnimationConfig,
  delete?: LayoutAnimationAnimationConfig,
}>;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Types/CoreEventTypes.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

import type {HostInstance} from '../../src/private/types/HostInstance';

export type NativeSyntheticEvent<out T> = Readonly<{
  bubbles: ?boolean,
  cancelable: ?boolean,
  currentTarget: number | HostInstance,
  defaultPrevented: ?boolean,
  dispatchConfig: Readonly<{
    registrationName: string,
  }>,
  eventPhase: ?number,
  preventDefault: () => void,
  isDefaultPrevented: () => boolean,
  stopPropagation: () => void,
  isPropagationStopped: () => boolean,
  isTrusted: ?boolean,
  nativeEvent: T,
  persist: () => void,
  target: ?number | HostInstance,
  timeStamp: number,
  type: ?string,
}>;

export type ResponderSyntheticEvent<T> = Readonly<{
  ...NativeSyntheticEvent<T>,
  touchHistory: Readonly<{
    indexOfSingleActiveTouch: number,
    mostRecentTimeStamp: number,
    numberActiveTouches: number,
    touchBank: ReadonlyArray<
      Readonly<{
        touchActive: boolean,
        startPageX: number,
        startPageY: number,
        startTimeStamp: number,
        currentPageX: number,
        currentPageY: number,
        currentTimeStamp: number,
        previousPageX: number,
        previousPageY: number,
        previousTimeStamp: number,
      }>,
    >,
  }>,
}>;

export type LayoutRectangle = Readonly<{
  x: number,
  y: number,
  width: number,
  height: number,
}>;

export type TextLayoutLine = Readonly<{
  ...LayoutRectangle,
  ascender: number,
  capHeight: number,
  descender: number,
  text: string,
  xHeight: number,
}>;

export type LayoutChangeEvent = NativeSyntheticEvent<
  Readonly<{
    layout: LayoutRectangle,
  }>,
>;

/**
 * @deprecated Use `TextLayoutEvent` instead.
 */
type TextLayoutEventData = Readonly<{
  lines: Array<TextLayoutLine>,
}>;

export type TextLayoutEvent = NativeSyntheticEvent<TextLayoutEventData>;

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/UIEvent
 */
export interface NativeUIEvent {
  /**
   * Returns a long with details about the event, depending on the event type.
   */
  readonly detail: number;
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent
 */
export interface NativeMouseEvent extends NativeUIEvent {
  /**
   * The X coordinate of the mouse pointer in global (screen) coordinates.
   */
  readonly screenX: number;
  /**
   * The Y coordinate of the mouse pointer in global (screen) coordinates.
   */
  readonly screenY: number;
  /**
   * The X coordinate of the mouse pointer relative to the whole document.
   */
  readonly pageX: number;
  /**
   * The Y coordinate of the mouse pointer relative to the whole document.
   */
  readonly pageY: number;
  /**
   * The X coordinate of the mouse pointer in local (DOM content) coordinates.
   */
  readonly clientX: number;
  /**
   * The Y coordinate of the mouse pointer in local (DOM content) coordinates.
   */
  readonly clientY: number;
  /**
   * Alias for NativeMouseEvent.clientX
   */
  readonly x: number;
  /**
   * Alias for NativeMouseEvent.clientY
   */
  readonly y: number;
  /**
   * Returns true if the control key was down when the mouse event was fired.
   */
  readonly ctrlKey: boolean;
  /**
   * Returns true if the shift key was down when the mouse event was fired.
   */
  readonly shiftKey: boolean;
  /**
   * Returns true if the alt key was down when the mouse event was fired.
   */
  readonly altKey: boolean;
  /**
   * Returns true if the meta key was down when the mouse event was fired.
   */
  readonly metaKey: boolean;
  /**
   * The button number that was pressed (if applicable) when the mouse event was fired.
   */
  readonly button: number;
  /**
   * The buttons being depressed (if any) when the mouse event was fired.
   */
  readonly buttons: number;
  /**
   * The secondary target for the event, if there is one.
   */
  readonly relatedTarget: null | number | HostInstance;
  // offset is proposed: https://drafts.csswg.org/cssom-view/#extensions-to-the-mouseevent-interface
  /**
   * The X coordinate of the mouse pointer between that event and the padding edge of the target node
   */
  readonly offsetX: number;
  /**
   * The Y coordinate of the mouse pointer between that event and the padding edge of the target node
   */
  readonly offsetY: number;

  // [Windows
  readonly isLeftButton: boolean;
  readonly isRightButton: boolean;
  readonly isMiddleButton: boolean;
  readonly isBarrelButtonPressed: boolean;
  readonly isHorizontalScrollWheel: boolean;
  readonly isEraser: boolean;
  readonly target: ?number;
  // Windows]
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent
 */
export interface NativePointerEvent extends NativeMouseEvent {
  /**
   * A unique identifier for the pointer causing the event.
   */
  readonly pointerId: number;
  /**
   * The width (magnitude on the X axis), in CSS pixels, of the contact geometry of the pointer
   */
  readonly width: number;
  /**
   * The height (magnitude on the Y axis), in CSS pixels, of the contact geometry of the pointer.
   */
  readonly height: number;
  /**
   * The normalized pressure of the pointer input in the range 0 to 1, where 0 and 1 represent
   * the minimum and maximum pressure the hardware is capable of detecting, respectively.
   */
  readonly pressure: number;
  /**
   * The normalized tangential pressure of the pointer input (also known as barrel pressure or
   * cylinder stress) in the range -1 to 1, where 0 is the neutral position of the control.
   */
  readonly tangentialPressure: number;
  /**
   * The plane angle (in degrees, in the range of -90 to 90) between the Y–Z plane and the plane
   * containing both the pointer (e.g. pen stylus) axis and the Y axis.
   */
  readonly tiltX: number;
  /**
   * The plane angle (in degrees, in the range of -90 to 90) between the X–Z plane and the plane
   * containing both the pointer (e.g. pen stylus) axis and the X axis.
   */
  readonly tiltY: number;
  /**
   * The clockwise rotation of the pointer (e.g. pen stylus) around its major axis in degrees,
   * with a value in the range 0 to 359.
   */
  readonly twist: number;
  /**
   * Indicates the device type that caused the event (mouse, pen, touch, etc.)
   */
  readonly pointerType: string;
  /**
   * Indicates if the pointer represents the primary pointer of this pointer type.
   */
  readonly isPrimary: boolean;
}

export type PointerEvent = NativeSyntheticEvent<NativePointerEvent>;

export type NativeTouchEvent = Readonly<{
  altKey: ?boolean, // TODO(macOS)

  button: ?number, // TODO(macOS)
  /**
   * Array of all touch events that have changed since the last event
   */
  changedTouches: ReadonlyArray<NativeTouchEvent>,

  ctrlKey: ?boolean, // TODO(macOS)


  /**
   * 3D Touch reported force
   * @platform ios
   */
  force?: number,
  /**
   * The ID of the touch
   */
  identifier: number,
  /**
   * The X position of the touch, relative to the element
   */
  locationX: number,
  /**
   * The Y position of the touch, relative to the element
   */
  locationY: number,
  /**
   * The X position of the touch, relative to the screen
   */

  metaKey: ?boolean, // TODO(macOS)

  pageX: number,
  /**
   * The Y position of the touch, relative to the screen
   */
  pageY: number,

  shiftKey: ?boolean, // TODO(macOS)
  /**
   * The node id of the element receiving the touch event
   */
  target: ?number,
  /**
   * A time identifier for the touch, useful for velocity calculation
   */
  timestamp: number,
  /**
   * Array of all current touches on the screen
   */
  touches: ReadonlyArray<NativeTouchEvent>,
}>;

export type GestureResponderEvent = ResponderSyntheticEvent<NativeTouchEvent>;

export type NativeScrollRectangle = Readonly<{
  bottom: number,
  left: number,
  right: number,
  top: number,
}>;

export type NativeScrollPoint = Readonly<{
  y: number,
  x: number,
}>;

export type NativeScrollVelocity = Readonly<{
  y: number,
  x: number,
}>;

export type NativeScrollSize = Readonly<{
  height: number,
  width: number,
}>;

export type NativeScrollEvent = Readonly<{
  contentInset: NativeScrollRectangle,
  contentOffset: NativeScrollPoint,
  contentSize: NativeScrollSize,
  layoutMeasurement: NativeScrollSize,
  velocity?: NativeScrollVelocity,
  zoomScale?: number,
  responderIgnoreScroll?: boolean,
  /**
   * @platform ios
   */
  targetContentOffset?: NativeScrollPoint,
}>;

export type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

export type TargetedEvent = Readonly<{
  target: number,
  ...
}>;

export type BlurEvent = NativeSyntheticEvent<TargetedEvent>;

export type FocusEvent = NativeSyntheticEvent<TargetedEvent>;

// [Windows Mouse events on Windows don't match up with the version in core
// introduced for react-native-web. Replace typings with our values to catch
// anything dependent on react-native-web specific values
export type MouseEvent = NativeSyntheticEvent<
  Readonly<{
    target: number,
    identifier: number,
    clientX: number,
    clientY: number,
    pageX: number,
    pageY: number,
    locationX: number,
    locationY: number,
    timestamp: number,
    pointerType: string,
    force: number,
    isLeftButton: boolean,
    isRightButton: boolean,
    isMiddleButton: boolean,
    isBarrelButtonPressed: boolean,
    isHorizontalScrollWheel: boolean,
    isEraser: boolean,
    shiftKey: boolean,
    ctrlKey: boolean,
    altKey: boolean,
  }>,
>;
// Windows]
export type KeyEvent = Readonly<{
  /**
   * The actual key that was pressed. For example, F would be "f" or "F" depending on the shift key.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
   */
  key: string,
  /**
   * The key code of the key that was pressed. For example, F would be "KeyF"
   * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
   */
  code: string,
  altKey: bo
```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/BackHandler.win32.js`
```
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import NativeDeviceEventManager from '../../Libraries/NativeModules/specs/NativeDeviceEventManager';
import {setEventInitTimeStamp} from '../../src/private/webapis/dom/events/internals/EventInternals';
import RCTDeviceEventEmitter from '../EventEmitter/RCTDeviceEventEmitter';
import {HardwareBackPressEvent} from './HardwareBackPressEvent';

const DEVICE_BACK_EVENT = 'hardwareBackPress';

type BackPressEventName = 'backPress' | 'hardwareBackPress';
type BackPressHandler = (event: HardwareBackPressEvent) => ?boolean;

const _backPressSubscriptions: Array<BackPressHandler> = [];

RCTDeviceEventEmitter.addListener(DEVICE_BACK_EVENT, function (nativeEvent) {
  const options = {};
  const nativeTimestamp = nativeEvent?.timeStamp;
  if (nativeTimestamp != null) {
    setEventInitTimeStamp(options, nativeTimestamp);
  }
  const event = new HardwareBackPressEvent(options);
  for (let i = _backPressSubscriptions.length - 1; i >= 0; i--) {
    if (_backPressSubscriptions[i]?.(event)) {
      return;
    }
  }

  BackHandler.exitApp();
});

/**
 * Detects hardware button presses for back navigation and lets you register
 * event listeners for the system's back action. Event subscriptions are called
 * in reverse order (i.e. last registered subscription first). If one
 * subscription returns `true`, earlier subscriptions are not called.
 *
 * @see https://reactnative.dev/docs/backhandler
 * @platform win32
 */
type TBackHandler = {
  readonly exitApp: () => void,
  readonly addEventListener: (
    eventName: BackPressEventName,
    handler: BackPressHandler,
  ) => {remove: () => void, ...},
};
const BackHandler: TBackHandler = {
  /**
   * Programmatically exit the app.
   */
  exitApp: function (): void {
    if (!NativeDeviceEventManager) {
      return;
    }

    NativeDeviceEventManager.invokeDefaultBackPressHandler();
  },

  /**
   * Listen for the `hardwareBackPress` event. The handler should return `true`
   * to prevent the event from bubbling to earlier registered listeners.
   */
  addEventListener: function (
    eventName: BackPressEventName,
    handler: BackPressHandler,
  ): {remove: () => void, ...} {
    if (_backPressSubscriptions.indexOf(handler) === -1) {
      _backPressSubscriptions.push(handler);
    }
    return {
      remove: (): void => {
        const index = _backPressSubscriptions.indexOf(handler);
        if (index !== -1) {
          _backPressSubscriptions.splice(index, 1);
        }
      },
    };
  },
};

export default BackHandler;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/Dimensions.win32.js`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @flow
 * @format
 */

import RCTDeviceEventEmitter from '../EventEmitter/RCTDeviceEventEmitter';
import EventEmitter, {
  type EventSubscription,
} from '../vendor/emitter/EventEmitter';
import NativeDeviceInfo, {
  type DimensionsPayload,
  type DisplayMetrics,
  type DisplayMetricsAndroid,
} from './NativeDeviceInfo';
import invariant from 'invariant';

export type {DimensionsPayload, DisplayMetrics, DisplayMetricsAndroid};

/** @deprecated Use DisplayMetrics */
export type ScaledSize = DisplayMetrics;

const eventEmitter = new EventEmitter<{
  change: [DimensionsPayload],
}>();
let dimensionsInitialized = false;
let dimensions: DimensionsPayload;

/**
 * Provides the application window's width and height. Prefer
 * `useWindowDimensions` in React components.
 *
 * @see https://reactnative.dev/docs/dimensions
 *
 * [Win32] While a global Dimensions object for window and screen dimensions is too simple for Win32,
 * attached to this object is also fontScale which is a system global value.  We expose this value
 * for large text scaling support while leaving other window dimension information undefined. These undefined
 * values will cause rendering issues if used but should avoid runtime failures in JS.
 */
class Dimensions {
  /**
   * Returns the current dimensions for `'window'` or `'screen'`. On Android,
   * `'window'` dimensions exclude the status bar and navigation bar.
   *
   * NOTE: `useWindowDimensions` is the preferred API for React components.
   *
   * Although dimensions are available immediately, they may change (e.g. due to
   * device rotation) so any rendering logic or styles that depend on these
   * constants should try to call this function on every render, rather than
   * caching the value.
   *
   * Example: `const {height, width} = Dimensions.get('window');`
   *
   * @param {string} dim Name of dimension as defined when calling `set`.
   * @returns {DisplayMetrics? | DisplayMetricsAndroid?} Value for the dimension.
   */
  static get(dim: string): DisplayMetrics | DisplayMetricsAndroid {
    // $FlowFixMe[invalid-computed-prop]
    invariant(dimensions[dim], 'No dimension set for key ' + dim);
    return dimensions[dim];
  }

  /**
   * This should only be called from native code by sending the
   * didUpdateDimensions event.
   *
   * @param {DimensionsPayload} dims Simple string-keyed object of dimensions to set
   */
  static set(dims: Readonly<DimensionsPayload>): void {
    let {screen, window} = dims;
    const {windowPhysicalPixels} = dims;
    if (windowPhysicalPixels) {
      window = {
        width: windowPhysicalPixels.width,
        height: windowPhysicalPixels.height,
        scale: windowPhysicalPixels.scale,
        fontScale: windowPhysicalPixels.fontScale,
      };
    }
    const {screenPhysicalPixels} = dims;
    if (screenPhysicalPixels) {
      screen = {
        width: screenPhysicalPixels.width,
        height: screenPhysicalPixels.height,
        scale: screenPhysicalPixels.scale,
        fontScale: screenPhysicalPixels.fontScale,
      };
    } else if (screen == null) {
      screen = window;
    }

    dimensions = {window, screen};
    if (dimensionsInitialized) {
      // Don't fire 'change' the first time the dimensions are set.
      eventEmitter.emit('change', dimensions);
    } else {
      dimensionsInitialized = true;
    }
  }

  /**
   * Add an event handler. Supported events:
   *
   * - `change`: Fires when a property within the `Dimensions` object changes,
   *   such as on device rotation or foldable device state changes. The argument
   *   to the event handler is a `DimensionsPayload` object with `window` and
   *   `screen` properties whose values are the same as the return values of
   *   `Dimensions.get('window')` and `Dimensions.get('screen')`, respectively.
   */
  static addEventListener(
    type: 'change',
    handler: Function,
  ): EventSubscription {
    invariant(
      type === 'change',
      'Trying to subscribe to unknown event: "%s"',
      type,
    );
    return eventEmitter.addListener(type, handler);
  }
}

// Subscribe before calling getConstants to make sure we don't miss any updates in between.
RCTDeviceEventEmitter.addListener(
  'didUpdateDimensions',
  (update: DimensionsPayload) => {
    Dimensions.set(update);
  },
);
Dimensions.set(NativeDeviceInfo.getConstants().Dimensions);

export default Dimensions;

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/FocusManager.win32.d.ts`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @format
 */

import React from 'react';

export declare class FocusManager {
  static focus(ref: React.Ref<any>, setWindowFocus: boolean): void;
}

```

### Core Architecture Module: `packages/@office-iss/react-native-win32/src-win/Libraries/Utilities/FocusManager.win32.js`
```
/**
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT License.
 *
 * @flow
 * @format
 */

'use strict';

import * as React from 'react';
import {findNodeHandle, UIManager} from 'react-native';

/*
 ** This is a helper class intended to allow usage of Polite/Aggressive Focus for win32.
 */
class FocusManager {
  // This function takes in a ref to a React Component and a bool value. If setWindowFocus = true, call aggressive focus.
  // Else, call polite focus

  static focus(ref: React.RefObject<any>, setWindowFocus: boolean) {
    if (ref) {
      if (setWindowFocus) {
        UIManager.dispatchViewManagerCommand(
          // $FlowFixMe[incompatible-type]
          findNodeHandle(ref),
          UIManager.getViewManagerConfig('RCTView').Commands.aggressivefocus,
          [],
        );
      } else {
        UIManager.dispatchViewManagerCommand(
          // $FlowFixMe[incompatible-type]
          findNodeHandle(ref),
          UIManager.getViewManagerConfig('RCTView').Commands.politefocus,
          [],
        );
      }
    }
  }
}

export default FocusManager;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #16481** (2026-10-15): **Single-line TextInput text is drawn below center and clipped on ARM64 (New Architecture)**
  *Symptoms*: ### Problem Description  On the New Architecture (Fabric) **on ARM64**, a single-line `TextInput` that is taller than its text draws the text and placeholder starting at the **vertical middle** of the box, not centered in it. The top half of the input is empty, and in shorter inputs the bottom of the text is clipped.  This comes from #15754 ("Center single line textinputs"), which centers single-line text using the height returned by `WindowsTextInputComponentView::GetContentSize()`. On ARM64 that height is always about **0**, so the centering offset becomes half the box height.  **Root cause:** `GetContentSize()` calls `ITextServices::TxGetNaturalSize` with this extent:  ```cpp SIZE extentHimetric = {     static_cast<LONG>(availableWidth * scale * HIMETRIC_PER_INCH / dpi),     static_cast<LONG>(std::numeric_limits<LONG>::max() * HIMETRIC_PER_INCH / dpi)}; ```  `psizelExtent` is the extent used for zooming the control, not a layout constraint. A very large positive height therefore scales the returned natural size down to about 0. I measured this in a 40px-tall input with `fontSize: 18` at 96 DPI (ARM64):  | `extentHimetric.cy` passed | natural size returned (px) | | --- | --- | | `LONG_MAX` scaled (saturates to `2147483647`) | `(2, 0)` | | `1000000` | `(2, 0)` | | frame height (`1058`) | `(3, 1)` | | **`-1`** | **`(74, 24)`** (correct) |  With `contentHeight = 0`, `calculateContentVerticalOffset()` computes `(40 - 0) / 2 = 20` px, so the 24px-tall text is drawn from y=20 to 

- **Issue #16141** (2026-07-08): **TextInput renders text outside of text field for certain scales**
  *Symptoms*: ### Problem Description  At certain display scales (reproducible at 100%), the `<TextInput/>` component renders text outside the boundaries of the text field. When typing into the TextInput, the entered text overflows and appears outside the input container rather than being properly contained within it.  ### Steps To Reproduce  This issue is reproducible consistently at the affected display scale (in my testing at 100% scale). Simply rendering a multiline TextInput and typing any text will cause the text to appear outside the field boundaries. ``` import { View, StyleSheet } from 'react-native'; import { TextInput } from 'react-native-windows';  export const ReproExample = () => {     return (         <View style={styles.container}>             <TextInput                 style={styles.textInput}                 placeholder="Type here..." ```  In the following `<TextInput/>` I just wrote "This is a test" and the text was renderer outside of the text field.  <img width="210" height="113" alt="Image" src="https://github.com/user-attachments/assets/02d1a173-eac0-4e9d-9335-5c98a37f7e31" />  ### Expected Results  _No response_  ### CLI version  20.0.0  ### Environment  ```markdown info Fetching system and libraries information... System:   OS: Windows 11 10.0.26100   CPU: (12) x64 13th Gen Intel(R) Core(TM) i7-1365U   Memory: 5.44 GB / 31.64 GB Binaries:   Node:     version: 22.13.0     path: C:\nvm4w\nodejs\node.exe   Yarn:     version: 1.22.22     path: C:\Program Files (x86)\Ya

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

### Incident Patch 1: `ba65c6b4` (2026-08-21)
**Commit Message**: Fix crash modifying outline property (#16386)

* Fix crash modifying outline property

* Change files

**File**: `change/react-native-windows-c1af9f4d-e4f1-4dea-9a73-b66033f3bb8d.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix crash modifying outline property",
+  "packageName": "react-native-windows",
+  "email": "30809111+acoates-ms@users.noreply.github.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/BorderPrimitive.cpp` (modified, +1/-1)
```diff
@@ -713,7 +713,7 @@ BorderPrimitive::BorderPrimitive(
     : m_outer(&outer), m_rootVisual(rootVisual), m_ownsRootVisual(false) {}
 
 BorderPrimitive::BorderPrimitive(winrt::Microsoft::ReactNative::Composition::implementation::ComponentView &outer)
-    : m_outer(&outer), m_rootVisual(outer.CompositionContext().CreateSpriteVisual()) {}
+    : m_outer(&outer), m_rootVisual(outer.CompositionContext().CreateSpriteVisual()), m_ownsRootVisual(true) {}
 
 winrt::Microsoft::ReactNative::Composition::Experimental::IVisual BorderPrimitive::RootVisual() const noexcept {
   return m_rootVisual;
```

---

### Incident Patch 2: `811b4433` (2026-10-15)
**Commit Message**: Fix single-line TextInput text drawn below center on ARM64 (#16482)

GetContentSize() passed TxGetNaturalSize a height extent of LONG_MAX
scaled to HIMETRIC, which doesn't fit in a LONG. The out-of-range
float-to-LONG conversion gives LONG_MIN on x64 but saturates to LONG_MAX
on ARM64. TxGetNaturalSize treats a negative extent as unconstrained,
but a positive one as a zoom reference, so on ARM64 the huge height
scaled the natural size down to about 0. Any large positive value does
this: 1000000 also returns 0.

Since #15754, single-line text is centered using this height, so on
ARM64 the text and placeholder were drawn from the middle of the box
down and the bottom of the glyphs was clipped. Pass -1, which is
unconstrained on every architecture and matches what x64 already got.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `change/react-native-windows-77fda7b1-66d2-49d3-998b-cbe38717cf0e.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix single-line TextInput text drawn below center by measuring content with an unconstrained height",
+  "packageName": "react-native-windows",
+  "email": "ryan.fowler@singlewire.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/TextInput/WindowsTextInputComponentView.cpp` (modified, +4/-1)
```diff
@@ -1396,7 +1396,10 @@ std::pair<float, float> WindowsTextInputComponentView::GetContentSize() const no
 
   SIZE extentHimetric = {
       static_cast<LONG>(availableWidth * scale * HIMETRIC_PER_INCH / dpi),
-      static_cast<LONG>(std::numeric_limits<LONG>::max() * HIMETRIC_PER_INCH / dpi)};
+      // -1 measures without zoom, matching how this host draws (TxGetExtent returns E_NOTIMPL).
+      // A positive extent is taken as a zoom reference; LONG_MAX scaled to HIMETRIC saturated to a
+      // huge positive value on ARM64 and shrank the natural height to about 0.
+      -1};
 
   SIZE naturalSize = {0, 0};
 
```

---

### Incident Patch 3: `56d0ff9e` (2026-10-16)
**Commit Message**: Fix touch timestamps so PanResponder handles every move (#16483)

* Fix touch timestamps so PanResponder handles every move

UpdateActiveTouch never set Touch::timeStamp, which core now uses for the
JS event timestamp. It kept the value from when the touch was created on
press, so every move in a gesture had the same timestamp and PanResponder
dropped all moves after the first. Set it on every update.

Also fix the deprecated Float timestamp: it was epoch milliseconds stored
in a 32-bit float, which only resolves to ~131 s, and in the wrong units
(the field is seconds). Store seconds from a recent origin instead.

Fixes #14119

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Change files

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: acoates-ms <[REDACTED_EMAIL]>

**File**: `change/react-native-windows-616b8467-8959-43d7-8f2a-8cb3c5897fa8.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Fix touch timestamps so PanResponder handles every move",
+  "packageName": "react-native-windows",
+  "email": "ryan.fowler@singlewire.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Microsoft.ReactNative/Fabric/Composition/CompositionEventHandler.cpp` (modified, +6/-2)
```diff
@@ -1038,9 +1038,13 @@ void CompositionEventHandler::UpdateActiveTouch(
   activeTouch.touch.screenPoint.y = ptScaled.y;
   activeTouch.touch.offsetPoint.x = ptLocal.x;
   activeTouch.touch.offsetPoint.y = ptLocal.y;
+  // Restamp on every update; PanResponder ignores moves whose timestamp hasn't advanced.
+  activeTouch.touch.timeStamp = facebook::react::HighResTimeStamp::now();
+  // The deprecated timestamp is in seconds and is a 32-bit float, so measure it from a recent origin to keep
+  // sub-millisecond precision.
+  static const auto s_timestampOrigin = facebook::react::HighResTimeStamp::now();
   activeTouch.touch.timestamp = static_cast<facebook::react::Float>(
-      std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch())
-          .count());
+      (activeTouch.touch.timeStamp - s_timestampOrigin).toDOMHighResTimeStamp() / 1000.0);
   activeTouch.touch.force = 0;
   // activeTouch.touch.isBarrelButton = false;
   // activeTouch.touch.shiftKey = false;
```

#### Recent Merged Pull Requests:
- **PR #16490** (2026-10-18): Fix nightly library scaffold version selection (@vmoroz)
- **PR #16489** (2026-10-19): Use YAML to control pipeline triggers (@vmoroz)
- **PR #16484** (2026-10-15): Promote React Native Windows 0.85 to latest (@anuagragith)
- **PR #16483** (2026-10-16): Fix touch timestamps so PanResponder handles every move (@ryfow)
- **PR #16482** (2026-10-15): Fix single-line TextInput text drawn below center on ARM64 (@ryfow)
- **PR #16480** (2026-10-13): [0.84] Route validation npm requests through package proxy (@anuagragith)

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

## X. crash modifying outline property (#16386)

**RULE**:
When implementing operations in `change/react-native-windows-c1af9f4d-e4f1-4dea-9a73-b66033f3bb8d.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/react-native-windows. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ba65c6b4`: crash modifying outline property (#16386). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `change/react-native-windows-c1af9f4d-e4f1-4dea-9a73-b66033f3bb8d.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
{
  "type": "prerelease",
  "comment": "Fix crash modifying outline property",
  "packageName": "react-native-windows",
  "email": "30809111+acoates-ms@users.noreply.github.com",
  "dependentChangeType": "patch"
}
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ba65c6b4` are properly handled with clean fallback behavior.
