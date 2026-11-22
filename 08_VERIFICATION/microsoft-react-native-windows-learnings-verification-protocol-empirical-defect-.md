# Verification Protocol: Verification Protocol: Empirical Defect Shield for microsoft-react-native-windows-learnings

<!-- PROVENANCE_START
{
  "source_repository": "microsoft-react-native-windows-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T13:59:20.176Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-microsoft-react-native-windows-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [microsoft-react-native-windows-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T13:59:20.176Z`  
> **Learning ID**: `LEARN-EVO-microsoft-react-native-windows-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `microsoft-react-native-windows-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/microsoft-react-native-windows-learnings.md`  
> **Source**: github ([https://github.com/microsoft/react-native-windows](https://github.com/microsoft/react-native-windows))  
> **Source Version**: `aea3f3ad`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T13:59:06.919Z  
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
> **Harvest Timestamp**: 2026-11-22T13:59:06.912Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/react-native-windows`
- **Description**: A framework for building native Windows apps with React.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17383 stars

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
import Platform from '../../Utilities/Platform';
import {Commands as Win32TextInputCommands} from '../../Components/TextInput/Win32TextInputNativeComponent';

const {findNodeHandle} = require('../../ReactNative/RendererProxy');

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
  globalEvalWithSourceUrl?: (v0: string, v1: string) => unknown,
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
): Promise<{body: string, headers: {[key: string]: string}}> {
  let id = null;
  let responseText = null;
  let headers = null;
  let dataListener;
  let completeListener;
  let responseListener;
  let incrementalDataListener;
  return new Promise<{body: string, headers: {[key: string]: string}}>(
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

export type SafeAreaInsets = Readonly<{
  top: number,
  right: number,
  bottom: number,
  left: number,
}>;

export type SafeAreaInsetsChangeEvent = NativeSyntheticEvent<
  Readonly<{
    /**
     * Inset measurements in points (iOS) or dp (Android), not display pixels.
     */
    insets: SafeAreaInsets,
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
   * The actual key that was pressed. For example, F would be "f" or "F" dep
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
 * @flow strict-local
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
    handler: LegacyFunction,
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

- **Issue #16321** (2026-11-12): **[msvc] react-native-windows failed with warning C4864: expected 'template' keyword before dependent template name**
  *Symptoms*: ### Problem Description  When build react-native-windows with VS2026 on windows, it failed with 'warning C4864: expected 'template' keyword before dependent template name', could you please take a look?  Failures: ``` C:\gitP\microsoft\react-native-windows\vnext\Microsoft.ReactNative\Fabric\Composition\CompositionContextHelper.cpp(1799,52): error C2220: the following warning is treated as an error [C:\gitP\microsoft\react-native-windows\vnext\Desktop\React.Windows.Desktop.vcxproj]          (compiling source file '../Microsoft.ReactNative/Fabric/Composition/CompositionContextHelper.cpp')           C:\gitP\microsoft\react-native-windows\vnext\Microsoft.ReactNative\Fabric\Composition\CompositionContextHelper.cpp(1799,52): warning C4864: expected 'template' keyword before dependent template name [C:\gitP\microsoft\react-native-windows\vnext\Desktop\React.Windows.Desktop.vcxproj] ```  ### Steps To Reproduce  1. git clone https://github.com/microsoft/react-native-windows and checkout 883b2f4 2. cd /d C:\gitP\microsoft\react-native-windows 3. msbuild /m /restore /p:PlatformToolset=v145 /p:Platform=x64 /p:Configuration=Release /p:WindowsTargetPlatformVersion=10.0.26100.0 /p:PublishToolDuringBuild=true /p:RestoreLockedMode=true /p:RestoreForceEvaluate=true /p:VisualStudioVersion="18.0" vnext\ReactWindows-Desktop.sln /t:Rebuild  ### Expected Results  It builds successfully.  ### CLI version  20.0.0  ### Environment  ```markdown nfo Fetching system and libraries information... System:  

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

### Incident Patch 1: `aea3f3ad` (2026-11-20)
**Commit Message**: Apply origin policy checks when a same-origin request is redirected to another origin (#16631)

* Apply origin policy checks when a same-origin request is redirected to another origin

Co-authored-by: Copilot <[REDACTED_EMAIL]>

Copilot-Session: 6571d0a2-c95e-4c83-8fb7-82debbd8de73

* Change files

* Check cross-origin redirects before each hop is sent

- Apply the configured origin policy in OnRedirecting, before the request
  leaves the original origin, using the method and body of the next hop
  (301/302/303 rewrites). Rejected redirects are not sent.
- Check the redirect response of each cross-origin hop, and validate the
  final response with CORS when any hop left the original origin, even if
  the chain ends on the original origin.
- Ignore the default User-Agent and Origin headers added by the filter
  chain when deciding whether a redirected request is simple.
- Send the Origin header on the first cross-origin hop, and keep it when
  the redirect filter rebuilds the request.
- Document GetCrossOriginRedirectPolicy.

Co-authored-by: Copilot <[REDACTED_EMAIL]>
Copilot-Session: 6571d0a2-c95e-4c83-8fb7-82debbd8de73

* Address review comments on redirect checks

- Skip the chec

**File**: `change/react-native-windows-0630ea41-5851-45c7-b799-906060c3589c.json` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{
+  "type": "prerelease",
+  "comment": "Apply origin policy checks when a same-origin request is redirected to another origin",
+  "packageName": "react-native-windows",
+  "email": "anuagra@microsoft.com",
+  "dependentChangeType": "patch"
+}
```

**File**: `vnext/Desktop.UnitTests/OriginPolicyHttpFilterTest.cpp` (modified, +459/-5)
```diff
@@ -415,6 +415,7 @@ TEST_CLASS (OriginPolicyHttpFilterTest) {
   /// </summary>
   struct ServerParams {
     wstring Host; // Host name used to route requests to this endpoint (e.g. L"mockserver.rnw").
+    wstring Path; // Optional path used to route requests. Empty matches any path on Host.
     wstring WideUrl; // Wide URL form, used as Location / Access-Control-Allow-Origin header values.
     string Url; // Narrow URL form, used for runtime options and request URLs.
 
@@ -425,11 +426,28 @@ TEST_CLASS (OriginPolicyHttpFilterTest) {
     std::map<wstring, wstring> ResponseHeaders;
     wstring ResponseContent{L"RESPONSE_CONTENT"};
 
-    ServerParams(wstring host) : Host{std::move(host)}, WideUrl{L"http://" + Host}, Url{winrt::to_string(WideUrl)} {
+    ServerParams(wstring host, wstring path = {})
+        : Host{std::move(host)},
+          Path{std::move(path)},
+          WideUrl{L"http://" + Host + Path},
+          Url{winrt::to_string(WideUrl)} {
       PreflightHeaders[s_accessControlAllowMethods] = L"GET, POST, DELETE, PATCH";
     }
   };
 
+  // A request as received by the mocked network.
+  struct SentRequest {
+    wstring Host;
+    wstring Method;
+    wstring Origin;
+  };
+
+  // Requests received by the mocked network during the current test.
+  std::vector<SentRequest> m_sentRequests;
+
+  // Default User-Agent the redirect filter adds to every hop. Empty means none.
+  winrt::hstring m_userAgent;
+
   struct ClientParams {
     wstring Method;
     std::vector<std::pair<wstring, wstring>> Headers;
@@ -452,8 +470,7 @@ TEST_CLASS (OriginPolicyHttpFilterTest) {
   /// supplied mock filter instead of the live network stack. Reads the same runtime options.
   /// </summary>
   HttpClient MakeMockedClient(IHttpFilter const &innerMock) {
-    auto redirFilter =
-        winrt::make<RedirectHttpFilter>(IHttpFilter{innerMock}, IHttpFilter{innerMock}, winrt::hstring{});
+    auto redirFilter = winrt::make<RedirectHttpFilter>(IHttpFilter{innerMock}, IHttpFilter{innerMock}, m_userAgent);
 
     if (static_cast<OriginPolicy>(GetRuntimeOptionInt("Http.OriginPolicy")) == OriginPolicy::None) {
       return HttpClient{redirFilter};
@@ -498,12 +515,19 @@ TEST_CLASS (OriginPolicyHttpFilterTest) {
       std::vector<ServerParams *> const &servers, ClientParams const &client, string const &requestUrl) {
     auto mockFilter = winrt::make<MockHttpBaseFilter>();
     mockFilter.as<MockHttpBaseFilter>()->Mocks.SendRequestAsync =
-        [&servers](HttpRequestMessage const &request) -> ResponseOperation {
+        [&servers, this](HttpRequestMessage const &request) -> ResponseOperation {
       HttpResponseMessage response{};
 
+      auto origin = request.Headers().TryLookup(L"Origin");
+      m_sentRequests.push_back(
+          {wstring{request.RequestUri().Host()},
+           wstring{request.Method().ToString()},
+           origin ? wstring{*origin} : wstring{}});
+
       ServerParams const *match = nullptr;
       for (auto *server : servers) {
-        if (request.RequestUri().Host() == server->Host) {
+        if (request.RequestUri().Host() == server->Host &&
+            (server->Path.empty() || request.RequestUri().Path() == server->Path)) {
           match = server;
           break;
         }
@@ -592,6 +616,8 @@ TEST_CLASS (OriginPolicyHttpFilterTest) {
     SetRuntimeOptionInt("Http.OriginPolicy", static_cast<int32_t>(OriginPolicy::None));
     SetRuntimeOptionString("Http.GlobalOrigin", {});
     SetRuntimeOptionBool("Http.OmitCredentials", false);
+    m_userAgent = {};
+    m_sentRequests.clear();
   }
 
   BEGIN_TEST_METHOD_ATTRIBUTE(NoCorsForbiddenMethodSucceeds)
@@ -878,6 +904,434 @@ TEST_CLASS (OriginPolicyHttpFilterTest) {
     TestOriginPolicyWithRedirect(serverArgs, redirServerArgs, clientArgs, true /*shouldSucceed*/);
   } // FullCorsSameOriginToCrossOriginRedirectSucceeds
 
+  // A same-origin request redirected to another origin must pass the CORS checks of the final origin.
+  BEGIN_TEST_METHOD_ATTRIBUTE(FullCorsSameOriginToCrossOriginRedirectWithoutCorsHeadersFails)
+  END_TEST_METHOD_ATTRIBUTE()
+  TEST_METHOD(FullCorsSameOriginToCrossOriginRedirectWithoutCorsHeadersFails) {
+    ServerParams serverArgs(s_mockServerHost);
+    ServerParams redirServerArgs(s_redirectServerHost);
+
+    serverArgs.ResponseStatus = HttpStatusCode::MovedPermanently;
+    serverArgs.ResponseHeaders[s_location] = redirServerArgs.WideUrl;
+
+    // Server2 does not allow the original origin
+    redirServerArgs.ResponseStatus = HttpStatusCode::Accepted;
+
+    ClientParams clientArgs(L"GET", {{L"Content-Type", L"application/text"}});
+
+    SetRuntimeOptionString("Http.GlobalOrigin", serverArgs.Url.c_str());
+    SetRuntimeOptionInt("Http.OriginPolicy", static_cast<int32_t>(OriginPolicy::CrossOriginResourceSharing));
+
+    TestOriginPolicyWithRedirect(serverArgs, redirServerArgs, clientArgs, false /*shouldSucceed*/);
+  } // FullCorsSameOriginToCrossOriginRedirectWithoutCorsHeadersFails
+
+  BE
```

**File**: `vnext/Shared/Networking/OriginPolicyHttpFilter.cpp` (modified, +165/-0)
```diff
@@ -700,11 +700,159 @@ ResponseOperation OriginPolicyHttpFilter::SendPreflightAsync(HttpRequestMessage
   co_return {co_await m_innerFilter.SendRequestAsync(preflightRequest)};
 }
 
+/*static*/ bool OriginPolicyHttpFilter::IsSimpleCorsRedirectRequest(
+    HttpRequestMessage const &request,
+    HttpMethod const &method,
+    bool includeContent) noexcept {
+  bool callerSetUserAgent = false;
+  if (auto reqArgs = request.Properties().TryLookup(L"RequestArgs")) {
+    for (auto const &header : reqArgs.as<RequestArgs>()->Headers) {
+      if (boost::iequals(header.first, "User-Agent")) {
+        callerSetUserAgent = true;
+        break;
+      }
+    }
+  }
+
+  for (const auto &header : request.Headers()) {
+    // The redirect filter adds a default User-Agent and this filter manages Origin. Neither comes from the caller.
+    if ((!callerSetUserAgent && boost::iequals(header.Key(), L"User-Agent")) || boost::iequals(header.Key(), L"Origin"))
+      continue;
+
+    // The redirect filter removes these before sending a hop to another origin.
+    if (boost::iequals(header.Key(), L"Authorization") || boost::iequals(header.Key(), L"Cookie") ||
+        boost::iequals(header.Key(), L"Cookie2"))
+      continue;
+
+    if (s_simpleCorsRequestHeaderNames.find(header.Key().c_str()) == s_simpleCorsRequestHeaderNames.cend())
+      return false;
+  }
+
+  if (auto content = request.Content(); content && includeContent) {
+    for (const auto &header : content.Headers()) {
+      if (s_simpleCorsRequestHeaderNames.find(header.Key().c_str()) == s_simpleCorsRequestHeaderNames.cend() &&
+          !boost::iequals(header.Key(), "Content-Length"))
+        return false;
+
+      if (boost::iequals(header.Key(), L"Content-Type") &&
+          s_simpleCorsContentTypeValues.find(header.Value().c_str()) == s_simpleCorsContentTypeValues.cend())
+        return false;
+    }
+  }
+
+  return s_simpleCorsMethods.find(method.ToString().c_str()) != s_simpleCorsMethods.cend();
+}
+
+OriginPolicy OriginPolicyHttpFilter::GetCrossOriginRedirectPolicy(
+    HttpRequestMessage const &request,
+    HttpMethod const &method,
+    bool includeContent) const {
+  auto configuredPolicy =
+      static_cast<OriginPolicy>(request.Properties().Lookup(L"OriginPolicy").as<IPropertyValue>().GetUInt64());
+  bool isSimple = IsSimpleCorsRedirectRequest(request, method, includeContent);
+
+  switch (configuredPolicy) {
+    case OriginPolicy::SimpleCrossOriginResourceSharing:
+      if (!isSimple)
+        throw hresult_error{
+            E_INVALIDARG,
+            L"The redirected request does not meet the requirements for Simple Cross-Origin resource sharing"};
+      return OriginPolicy::SimpleCrossOriginResourceSharing;
+
+    case OriginPolicy::CrossOriginResourceSharing:
+      return isSimple ? OriginPolicy::SimpleCrossOriginResourceSharing : OriginPolicy::CrossOriginResourceSharing;
+
+    default:
+      throw hresult_error{E_INVALIDARG, L"SOP (same-origin policy) is enforced"};
+  }
+}
+
+void OriginPolicyHttpFilter::ValidateRedirectScheme(IMap<hstring, IInspectable> const &props, Uri const &nextUri)
+    const {
+  if (m_origin.SchemeName() == nextUri.SchemeName())
+    return;
+
+  // Same scheme rules as ValidateRequest applies to a direct request.
+  auto configuredPolicy = static_cast<OriginPolicy>(props.Lookup(L"OriginPolicy").as<IPropertyValue>().GetUInt64());
+  if (configuredPolicy == OriginPolicy::CrossOriginResourceSharing ||
+      (configuredPolicy == OriginPolicy::SimpleCrossOriginResourceSharing &&
+       GetRuntimeOptionBool("Http.BlockMixedContentSimpleCors")))
+    throw hresult_error{E_INVALIDARG, L"The origin and request URLs must have the same scheme"};
+}
+
+void OriginPolicyHttpFilter::CheckRedirectFromOriginalOrigin(
+    HttpRequestMessage const &request,
+    HttpResponseMessage const &response) const {
+  using winrt::Windows::Web::Http::HttpStatusCode;
+
+  auto props = request.Properties();
+  auto nextUri = Uri{response.Headers().Location().AbsoluteUri()};
+
+  // RedirectHttpFilter does not follow these redirects and returns the response as is.
+  auto nextScheme = nextUri.SchemeName();
+  if ((nextScheme != L"http" && nextScheme != L"https") ||
+      (request.RequestUri().SchemeName() == L"https" && nextScheme == L"http"))
+    return;
+
+  // See https://fetch.spec.whatwg.org/#http-redirect-fetch
+  if (!IsSameOrigin(m_origin, nextUri) && (!nextUri.UserName().empty() || !nextUri.Password().empty()))
+    throw hresult_error{E_INVALIDARG, L"A cross-origin redirect URL can not include credentials"};
+
+  if (props.HasKey(L"CrossOriginRedirect") || !IsSameOrigin(m_origin, request.RequestUri())) {
+    // The chain already left the original origin. Every later redirect response must pass CORS before it is
+    // followed, even when this hop is back on the original origin.
+    auto controlValues = ExtractAccessControlValues(response.Headers());
+    ValidateAllowOrigin(controlValues.AllowedOrigin, controlV
```

**File**: `vnext/Shared/Networking/OriginPolicyHttpFilter.h` (modified, +27/-0)
```diff
@@ -59,6 +59,14 @@ class OriginPolicyHttpFilter
 
   static bool IsSimpleCorsRequest(winrt::Windows::Web::Http::HttpRequestMessage const &request) noexcept;
 
+  // Like IsSimpleCorsRequest, but for a redirected hop: uses the given method, optionally ignores the body,
+  // ignores the User-Agent and Origin headers added by the filter chain, and ignores the credential headers
+  // (Authorization, Cookie, Cookie2) the redirect filter removes before a cross-origin hop.
+  static bool IsSimpleCorsRedirectRequest(
+      winrt::Windows::Web::Http::HttpRequestMessage const &request,
+      winrt::Windows::Web::Http::HttpMethod const &method,
+      bool includeContent) noexcept;
+
   static bool AreSafeRequestHeaders(
       winrt::Windows::Web::Http::Headers::HttpRequestHeaderCollection const &headers) noexcept;
 
@@ -91,6 +99,25 @@ class OriginPolicyHttpFilter
       winrt::Windows::Web::Http::HttpResponseMessage const &response,
       const OriginPolicy effectivePolicy) const;
 
+  // Returns the policy (Simple CORS or CORS) for a request that a redirect moved off the original origin.
+  // Uses the method and body the next hop will be sent with. Throws if the configured policy does not allow it.
+  OriginPolicy GetCrossOriginRedirectPolicy(
+      winrt::Windows::Web::Http::HttpRequestMessage const &request,
+      winrt::Windows::Web::Http::HttpMethod const &method,
+      bool includeContent) const;
+
+  // Throws if a redirect to nextUri breaks the scheme rules ValidateRequest applies to direct requests.
+  void ValidateRedirectScheme(
+      winrt::Windows::Foundation::Collections::IMap<winrt::hstring, winrt::Windows::Foundation::IInspectable> const
+          &props,
+      winrt::Windows::Foundation::Uri const &nextUri) const;
+
+  // Checks a redirect of a request that started on the original origin, before the next hop is sent.
+  // Throws if the redirect must not be followed.
+  void CheckRedirectFromOriginalOrigin(
+      winrt::Windows::Web::Http::HttpRequestMessage const &request,
+      winrt::Windows::Web::Http::HttpResponseMessage const &response) const;
+
   void ValidateAllowOrigin(
       winrt::hstring const &allowedOrigin,
       winrt::hstring const &allowCredentials,
```

**File**: `vnext/Shared/Networking/RedirectHttpFilter.cpp` (modified, +15/-2)
```diff
@@ -276,8 +276,9 @@ ResponseOperation RedirectHttpFilter::SendRequestAsync(HttpRequestMessage const
       throw winrt::hresult_error{HRESULT_FROM_WIN32(ERROR_HTTP_REDIRECT_FAILED), L"Too many redirects"};
     }
 
-    // Call event source's OnRedirecting before modifying request parameters.
-    if (coEventSrc && !coEventSrc->OnRedirecting(coRequest, response)) {
+    // Check whether the redirect will be followed before notifying the event source, so it only sees hops that are
+    // actually sent.
+    if (!coAllowAutoRedirect) {
       break;
     }
 
@@ -295,6 +296,11 @@ ResponseOperation RedirectHttpFilter::SendRequestAsync(HttpRequestMessage const
       break;
     }
 
+    // Call event source's OnRedirecting before modifying request parameters.
+    if (coEventSrc && !coEventSrc->OnRedirecting(coRequest, response)) {
+      break;
+    }
+
     // See https://fetch.spec.whatwg.org/#http-redirect-fetch
     // 301/302 change POST to GET; 303 changes any method other than GET/HEAD to GET.
     // 307/308 (and other redirect statuses) keep the method and body.
@@ -311,12 +317,19 @@ ResponseOperation RedirectHttpFilter::SendRequestAsync(HttpRequestMessage const
     }
 
     if (auto requestFactory = coRequestFactory.lock()) {
+      // The factory rebuilds headers from the original arguments. Keep the Origin header set by the origin policy.
+      auto origin = coRequest.Headers().TryLookup(L"Origin");
+
       coRequest = co_await requestFactory->CreateRequest(
           HttpMethod{method}, Uri{redirectUri}, coRequest.Properties(), /*includeContent*/ !removeBody);
 
       if (!coRequest) {
         throw winrt::hresult_error{E_INVALIDARG, L"Invalid request handle"};
       }
+
+      if (origin) {
+        coRequest.Headers().Insert(L"Origin", *origin);
+      }
     } else {
       coRequest.Method(method);
       coRequest.RequestUri(redirectUri);
```

---

### Incident Patch 2: `9ff3a931` (2026-11-20)
**Commit Message**: 📦 [main]: Bump the all-dependencies group with 3 updates (#16644)

Bumps the all-dependencies group with 3 updates: [@babel/generator](https://github.com/babel/babel/tree/HEAD/packages/babel-generator), [@babel/preset-env](https://github.com/babel/babel/tree/HEAD/packages/babel-preset-env) and [@babel/runtime](https://github.com/babel/babel/tree/HEAD/packages/babel-runtime).


Updates `@babel/generator` from 7.29.13 to 7.29.14
- [Release notes](https://github.com/babel/babel/releases)
- [Changelog](https://github.com/babel/babel/blob/main/CHANGELOG.md)
- [Commits](https://github.com/babel/babel/commits/v7.29.14/packages/babel-generator)

Updates `@babel/preset-env` from 7.29.7 to 7.29.14
- [Release notes](https://github.com/babel/babel/releases)
- [Changelog](https://github.com/babel/babel/blob/main/CHANGELOG.md)
- [Commits](https://github.com/babel/babel/commits/v7.29.14/packages/babel-preset-env)

Updates `@babel/runtime` from 7.29.13 to 7.29.14
- [Release notes](https://github.com/babel/babel/releases)
- [Changelog](https://github.com/babel/babel/blob/main/CHANGELOG.md)
- [Commits](https://github.com/babel/babel/commits/v7.29.14/packages/babel-runtime)

---
updated-dependencies

**File**: `yarn.lock` (modified, +176/-69)
```diff
@@ -78,16 +78,16 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/generator@npm:^7.25.0, @babel/generator@npm:^7.29.0, @babel/generator@npm:^7.29.1, @babel/generator@npm:^7.29.12, @babel/generator@npm:^7.29.13, @babel/generator@npm:^7.29.7, @babel/generator@npm:^7.7.2":
-  version: 7.29.13
-  resolution: "@babel/generator@npm:7.29.13"
+"@babel/generator@npm:^7.25.0, @babel/generator@npm:^7.29.0, @babel/generator@npm:^7.29.1, @babel/generator@npm:^7.29.12, @babel/generator@npm:^7.29.13, @babel/generator@npm:^7.29.14, @babel/generator@npm:^7.29.7, @babel/generator@npm:^7.7.2":
+  version: 7.29.14
+  resolution: "@babel/generator@npm:7.29.14"
   dependencies:
-    "@babel/parser": "npm:^7.29.13"
-    "@babel/types": "npm:^7.29.11"
+    "@babel/parser": "npm:^7.29.14"
+    "@babel/types": "npm:^7.29.14"
     "@jridgewell/gen-mapping": "npm:^0.3.12"
     "@jridgewell/trace-mapping": "npm:^0.3.28"
     jsesc: "npm:^3.0.2"
-  checksum: 10c0/3b6318f59aeaffe9305b1e4a8e3035f6223c808e961459945d896ba3c6f9dccb1e95d477b73d8e00b21d972b389292478dd1a50e8917d1629cd3c52005a64594
+  checksum: 10c0/39db746c47e0b80290b727e64025dd0ee9060f346271b5ca75ba07485df05f704a74358910bbe8e9f6e2a8fca62ac98f886640d2c84e7740af5fec42fbe0b71a
   languageName: node
   linkType: hard
 
@@ -165,6 +165,23 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@babel/helper-create-class-features-plugin@npm:^7.29.13":
+  version: 7.29.13
+  resolution: "@babel/helper-create-class-features-plugin@npm:7.29.13"
+  dependencies:
+    "@babel/helper-annotate-as-pure": "npm:^7.29.7"
+    "@babel/helper-member-expression-to-functions": "npm:^7.29.7"
+    "@babel/helper-optimise-call-expression": "npm:^7.29.7"
+    "@babel/helper-replace-supers": "npm:^7.29.7"
+    "@babel/helper-skip-transparent-expression-wrappers": "npm:^7.29.13"
+    "@babel/traverse": "npm:^7.29.13"
+    semver: "npm:^6.3.1"
+  peerDependencies:
+    "@babel/core": ^7.0.0
+  checksum: 10c0/c6d7ba6f3df266e04acbe44ec0626101d599d0928d64a9565fbbcab51d377e41f3a0bd3f3192dd529826af498d675c1d32e229382405ee8603171c8cd66cef8d
+  languageName: node
+  linkType: hard
+
 "@babel/helper-create-class-features-plugin@npm:^7.29.7":
   version: 7.29.7
   resolution: "@babel/helper-create-class-features-plugin@npm:7.29.7"
@@ -303,6 +320,19 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@babel/helper-module-transforms@npm:^7.29.14":
+  version: 7.29.14
+  resolution: "@babel/helper-module-transforms@npm:7.29.14"
+  dependencies:
+    "@babel/helper-module-imports": "npm:^7.29.7"
+    "@babel/helper-validator-identifier": "npm:^7.29.7"
+    "@babel/traverse": "npm:^7.29.14"
+  peerDependencies:
+    "@babel/core": ^7.0.0
+  checksum: 10c0/5ca8b9c36d5b9656196c758df1dc10148086b232f3df43d932a66d84f46faf93da7096667903c1f652539759789dc1ef5fbff0569baeabb110dce27faa988250
+  languageName: node
+  linkType: hard
+
 "@babel/helper-module-transforms@npm:^7.29.7":
   version: 7.29.7
   resolution: "@babel/helper-module-transforms@npm:7.29.7"
@@ -410,6 +440,16 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@babel/helper-skip-transparent-expression-wrappers@npm:^7.29.13":
+  version: 7.29.13
+  resolution: "@babel/helper-skip-transparent-expression-wrappers@npm:7.29.13"
+  dependencies:
+    "@babel/traverse": "npm:^7.29.13"
+    "@babel/types": "npm:^7.29.11"
+  checksum: 10c0/7ee6a71df0e921666b308e0c9ffa9b36961df8b7164f46d241885478b24195e506e4d9a0aff9bcd76c09eb27628a7f87af73f04b953b66714ec288d578047b7d
+  languageName: node
+  linkType: hard
+
 "@babel/helper-skip-transparent-expression-wrappers@npm:^7.29.7":
   version: 7.29.7
   resolution: "@babel/helper-skip-transparent-expression-wrappers@npm:7.29.7"
@@ -434,6 +474,13 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@babel/helper-string-parser@npm:^7.29.14":
+  version: 7.29.14
+  resolution: "@babel/helper-string-parser@npm:7.29.14"
+  checksum: 10c0/7e296ef8457872da9f9306ef29a67470505bca7f21728ff4fede08746eac2bb122a3a3be39135d337a9c56985bae24e4c2dd8f13896afe64a32e9251363ed7bd
+  languageName: node
+  linkType: hard
+
 "@babel/helper-string-parser@npm:^7.29.7":
   version: 7.29.7
   resolution: "@babel/helper-string-parser@npm:7.29.7"
@@ -534,6 +581,17 @@ __metadata:
   languageName: node
   linkType: hard
 
+"@babel/parser@npm:^7.29.14":
+  version: 7.29.14
+  resolution: "@babel/parser@npm:7.29.14"
+  dependencies:
+    "@babel/types": "npm:^7.29.14"
+  bin:
+    parser: ./bin/babel-parser.js
+  checksum: 10c0/5d76040cb386915a5086c864b5966a08bada9fa6074fa2b16cce42ed78ecae309003d3362fef88a96b9a40afc9761604502db93f7cea9db59af077d1ff2109f4
+  languageName: node
+  linkType: hard
+
 "@babel/parser@npm:^7.29.7":
   version: 7.29.7
   resolution: "@babel/parser@npm:7.29.7"
@@ -590,15 +648,15 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@babel/plugin-bugfix-safari-rest-destructuring-rhs-array@npm:^7.29.7":
-  version: 7.29.7
-  resolution: "@babel/plugin-bugfix-safari-rest-destructuring-rhs-array@npm
```

#### Recent Merged Pull Requests:
- **PR #16644** (2026-11-20): 📦 [main]: Bump the all-dependencies group with 3 updates (@dependabot[bot])
- **PR #16643** (2026-11-20): 🚀 [0.81]: Release 13 packages (@azure-pipelines[bot])
- **PR #16642** (2026-11-20): [0.81] Add opt-in V8 JSI ABI runtime that loads v8jsi2.dll (@vmoroz)
- **PR #16641** (2026-11-20): 🚀 [main]: Release 15 packages (@azure-pipelines[bot])
- **PR #16639** (2026-11-19): Integrate React Native November 10, 2026 nightly (@anuagragith)
- **PR #16638** (2026-11-18): 🚀 [0.81]: Release 13 packages (@azure-pipelines[bot])

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

## X. Apply origin policy checks when a same-origin request is redirected to another o

**RULE**:
When implementing operations in `change/react-native-windows-0630ea41-5851-45c7-b799-906060c3589c.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in microsoft/react-native-windows. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `aea3f3ad`: Apply origin policy checks when a same-origin request is redirected to another origin. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `change/react-native-windows-0630ea41-5851-45c7-b799-906060c3589c.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
{
  "type": "prerelease",
  "comment": "Apply origin policy checks when a same-origin request is redirected to another origin",
  "packageName": "react-native-windows",
  "email": "anuagra@microsoft.com",
  "dependentChangeType": "patch"
}
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `aea3f3ad` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
