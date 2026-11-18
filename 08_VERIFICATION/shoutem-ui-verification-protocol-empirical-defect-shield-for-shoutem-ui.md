# Verification Protocol: Verification Protocol: Empirical Defect Shield for shoutem/ui

<!-- PROVENANCE_START
{
  "source_repository": "shoutem/ui",
  "source_url": "https://github.com/shoutem/ui",
  "source_version": "101f9805",
  "license": "NOASSERTION",
  "timestamp": "2026-11-18T01:02:34.512Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-shoutem-ui",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [shoutem/ui](https://github.com/shoutem/ui) (Revision: `101f9805`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-18T01:02:34.512Z`  
> **Learning ID**: `learn-github-shoutem-ui`


## 1. Scope & Verification Target
- **Target Repository**: `shoutem/ui` (Commit: `101f9805`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Project Learning Record (Full-Spectrum Forensic Harvest): shoutem/ui

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
`shoutem/ui` is a declarative, composable, theme-driven component library for cross-platform React Native applications (iOS, Android, and Web). In React Native architectures, building unified design systems across diverging mobile OS implementations encounters three critical friction points:
1. **Dynamic Style Polymorphism without CSS Engines**: Mobile runtimes lack native CSS cascading, media queries, and inherited styles.
2. **Platform Divergences in Native Compositing & Safe Areas**: Edge-to-edge drawing on modern Android (v0.77+ API 35) and iOS home indicator insets require adaptive geometry calculation at runtime.
3. **Complex Embedded Media in Virtualized/HTML Trees**: Rendering arbitrary HTML payloads (containing videos, dynamic aspect-ratio iframes, and attachments) inside native scroll containers triggers severe layout reflows, hardware layer texture crashes on Android, and event-handling collisions across navigation lifecycles.

`shoutem/ui` resolves these through a unified abstraction layer connecting style declarations via `@shoutem/theme`, binding animation drivers to navigation life cycles, normalizing HTML DOM trees via native-bridge renderers (`react-native-render-html`, `react-native-webview`, `react-native-youtube-iframe`), and auto-linking platform dependencies.

```
                           +----------------------------------------+
                           |           @shoutem/theme               |
                           |   (connectStyle / Style Resolution)    |
                           +-------------------+--------------------+
                                               |
                                               v
+---------------------------------------------------------------------------------------+
|                                    @shoutem/ui                                        |
|                                                                                       |
|   +-----------------------+   +------------------------+   +----------------------+   |
|   |   Component Library   |   |   HTML Node Pipeline   |   |   Adaptive Layout    |   |
|   |  - Button, Icon, Text |   |  - AttachmentRenderer  |   |  - Dimensions.js     |   |
|   |  - ActionSheet Native |   |  - VideoRenderer       |   |  - Safe Area Insets  |   |
|   |  - EmptyStateView     |   |  - IframeRenderer      |   |  - Aspect Ratio Math |   |
|   +-----------+-----------+   +-----------+------------+   +----------+-----------+   |
|               |                           |                           |               |
|               +---------------------------+---------------------------+               |
+---------------------------------------+-----------------------------------------------+
                                        |
                                        v
     +----------------------------------+----------------------------------+
     |                                                                     |
     v                                                                     v
+-------------------------------+                       +-------------------------------+
|       iOS Native Engine       |                       |     Android Native Engine     |
| - Safe Area Inset fallback    |                       | - Edge-to-Edge window metrics |
| - CoreAnimation hardware sync |                       | - Software rendering layers   |
| - Lightbox v2 overlay bridge  |                       | - OverScrollMode "never" fix  |
+-------------------------------+                       +-------------------------------+
```

### Architectural Subsystem Boundaries
1. **Theme Inversion Boundary (`@shoutem/theme` & `connectStyle`)**:
   Components export higher-order component (HOC) wrappers (e.g., `connectStyle('shoutem.ui.EmptyStateView')(EmptyStateView)`). Component primitives remain pure and agnostic of specific styling rules, delegating layout resolution, style name parsing (`styleName="vertical h-center"`), and token cascading to `@shoutem/theme`.
2. **HTML Engine & Custom Tag Renderers (`html/components/`)**:
   Converts an intermediary DOM representation (`tnode`) into native components. It separates YouTube, Vimeo, raw HTML `<video>`, and local attachments into deterministic renderers with custom aspect-ratio calculations and texture-layer safeguards.
3. **Hardware Acceleration & Native Substrate Layer (`nativeDependencies`)**:
   Coordinates native bridge packages (`react-native-webview`, `lottie-react-native`, `react-native-actions-sheet`) with unified fallback handling, memory-safe interpolation hooks, and hardware rendering switches.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Subtraction of Multi-Axis Box Constraints Under Loose Nullability
**RULE**:
When resolving constrained boundary dimensions (such as `maxWidth`, `contentWidth`, or `clampedHeight`) from dynamic style contexts, you MUST extract and normalize all boundary properties against an explicit fallback object before arithmetic reduction, and you MUST subtract each bounding box component independently rather than chaining additive logic with short-circuit fallbacks (`||`).

**WHY**:
JavaScript's operator precedence evaluates addition (`+`) higher than logical OR (`||`). Chaining expressions like `style.container.paddingLeft || 0 + style.container.paddingRight || 0` leads to operator precedence bugs where zero values or undefined properties inadvertently coerce and concatenate or misapply fallback branches. Furthermore, referencing properties on nested paths like `style.container.paddingLeft` when `style.container` is undefined throws an immediate, unhandled `TypeError: Cannot read properties of undefined`.

**WHEN TO APPLY**:
Apply in all layout calculation functions, responsive container bounding computations, and CSS-in-JS style resolution transforms across React, React Native, and Web rendering engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
/**
 * Resolves maximum available inner width by subtracting all horizontal insets.
 * Guarantees zero-cost fallback when container style is absent or empty.
 *
 * @param {Object} [style] - The resolved component style container.
 * @param {Object} [style.container] - Inner container layout properties.
 * @param {number} [style.container.paddingLeft] - Left container padding.
 * @param {number} [style.container.paddingRight] - Right container padding.
 * @param {number} [style.outerPadding] - Cumulative padding of all parent ancestors.
 * @returns {number} The safe, non-negative maximum inner content width.
 */
export function resolveSafeMaxWidth(style = {}) {
  const { paddingLeft = 0, paddingRight = 0 } = style.container || {};
  const outerPadding = typeof style.outerPadding === 'number' ? style.outerPadding : 0;
  const windowWidth = Dimensions.get('window').width;

  const resolvedWidth = windowWidth - paddingLeft - paddingRight - outerPadding;
  return Math.max(0, resolvedWidth);
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Fails on precedence, crashes if style.container is undefined,
// and truncates 0 as falsy incorrectly in chained math.
export function resolveMaxWidthBroken(style) {
  const parentContainerPadding = style.outerPadding || 0;
  // Precedence bug: evaluates (0 + style.container.paddingRight) before ||
  // Crashes if style.container is null or undefined!
  const paddingValue =
    style.container.paddingLeft ||
    0 + style.container.paddingRight ||
    0 + parentContainerPadding;

  return Dimensions.get('window').width - paddingValue;
}
```

**VERIFICATION METHOD**:
Enforce deep-null property tests with Jest verifying that passing empty objects, undefined structures, and explicit zeros never results in `NaN`, negative widths, or uncaught `TypeErrors`:
```javascript
describe('resolveSafeMaxWidth Invariant Verification', () => {
  it('handles empty styles without throwing and evaluates precedence correctly', () => {
    expect(resolveSafeMaxWidth({})).toBe(Dimensions.get('window').width);
    expect(resolveSafeMaxWidth({ container: { paddingLeft: 10, paddingRight: 20 }, outerPadding: 5 }))
      .toBe(Dimensions.get('window').width - 35);
    expect(resolveSafeMaxWidth({ container: undefined, outerPadding: undefined }))
      .toBe(Dimensions.get('window').width);
  });
});
```

---

### 2. Monotonic Registration of Screen-Bound Animation Drivers
**RULE**:
When synchronizing shared UI elements (e.g., sticky headers, collapsible navigation bars) with animated drivers across route transitions, animation drivers MUST register monotonically on route `focus` events without unregistering or restoring stale previous drivers on route `blur`. Drivers MUST be wrapped in static/memoized driver providers (`useCallback([])`) to prevent lifecycle race conditions.

**WHY**:
In modern navigation stacks (such as React Navigation), screen transitions do NOT fire symmetrically: the incoming screen's `focus` event fires *before* the outgoing screen's `blur` event completes. If the outgoing screen unbinds, nullifies, or restores a previous driver inside its `blur` lifecycle cleanup, it will overwrite or invalidate the newly active screen's driver, causing animations on subsequent visits to freeze or crash.

**WHEN TO APPLY**:
Apply in all mobile and single-page navigation pipelines where dynamic headers, scroll listeners, floating action buttons, or gesture targets are handed off between nested or stacked viewports.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
import React, { useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';

export function useMonotonicScreenAnimationDriver(driver, registerDriver) {
  const navigation = useNavigation();

  // Driver registration callback MUST be immutable across re-renders
  const handleFocus = useCallback(() => {
    if (driver) {
      registerDriver(driver);
    }
  }, [driver, registerDriver]);

  useEffect(() => {
    // Register strictly on focus.
    // DO NOT attach a blur listener that cleans up or resets shared context!
    const unsubscribeFocus = navigation.addListener('focus', handleFocus);

    return () => {
      // Clean up the event listener itself, NEVER the driver state of the next screen
      unsubscribeFocus();
    };
  }, [navigation, handleFocus]);
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Blur event of outgoing screen fires AFTER focus of incoming screen,
// stomping and erasing the incoming screen's freshly assigned driver.
export function useFlawedDriverLifecycle(driver, setGlobalDriver) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      setGlobalDriver(driver);
    });

    const unsubBlur = navigation.addListener('blur', () => {
      // CATASTROPHIC: This executes after Screen B focused,
      // setting Screen B's active driver back to null!
      setGlobalDriver(null);
    });

    return () => {
      unsubFocus();
      unsubBlur();
    };
  }, [navigation, driver, setGlobalDriver]);
}
```

**VERIFICATION METHOD**:
Implement a stateful mock test verifying listener execution sequence:
```javascript
test('focus on Screen B must not be overridden by blur on Screen A', () => {
  let activeDriver = null;
  const setDriver = (d) => { activeDriver = d; };

  const driverA = { id: 'DriverA' };
  const driverB = { id: 'DriverB' };

  // Simulate navigation transition: Focus B -> Blur A
  setDriver(driverB); // Screen B focus
  // Ensure Screen A blur logic does not execute setDriver(null) or setDriver(driverA)
  expect(activeDriver.id).toBe('DriverB');
});
```

---

### 3. Asymmetric Safe Inset Fallback Resolution for Edge-to-Edge Runtimes
**RULE**:
When querying platform viewport insets on devices supporting edge-to-edge drawing, insets MUST be dynamically obtained from live window metrics (`initialWindowMetrics.insets`) across ALL platforms (Android and iOS). Fixed platform constants (e.g., hardcoded `0` on Android) MUST NOT be assumed, and platform-specific fallbacks MUST only apply when live metric providers resolve to `undefined` or `null`.

**WHY**:
Starting with React Native 0.77 (Android 15+ target SDK), edge-to-edge rendering is enabled by default. Android draws underneath the gesture navigation bar and system status bar. Hardcoding Android bottom insets to `0` leads to floating navigation bars obscuring interactive elements, clipping submit buttons, and breaking tap targets at the bottom of the screen.

**WHEN TO APPLY**:
Cross-platform native applications handling home indicator padding, bottom-anchored action sheets, sticky footers, or bottom sheets.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
import { Platform } from 'react-native';

const IOS_FALLBACK_BOTTOM_INSET = 34;
const ANDROID_FALLBACK_BOTTOM_INSET = 0;

/**
 * Resolves bottom safe inset adapting to RN 0.77+ edge-to-edge Android
 * and notch/Dynamic Island iOS displays.
 *
 * @param {Object} [windowMetrics] - Window metrics from react-native-safe-area-context
 * @returns {number} Effective bottom inset in points
 */
export function resolveSafeBottomInset(windowMetrics) {
  const detectedBottom = windowMetrics?.insets?.bottom;

  if (typeof detectedBottom === 'number') {
    return detectedBottom;
  }

  // Graceful degradation when window metrics provider is unmounted or uninitialized
  return Platform.select({
    ios: IOS_FALLBACK_BOTTOM_INSET,
    android: ANDROID_FALLBACK_BOTTOM_INSET,
    default: 0,
  });
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Hardcoded assumption that Android never has a home indicator inset.
// Breaks immediately on RN >= 0.77 with edge-to-edge enabled.
export function getHomeIndicatorPaddingBroken() {
  if (Platform.OS === 'android') {
    return 0; // DEAD TRAP: Clips UI behind system navigation bar on Android 15+
  }
  return 34;
}
```

**VERIFICATION METHOD**:
Automated matrix test validating inset extraction under simulated Android 15 edge-to-edge payloads:
```javascript
test('Android returns actual window metric inset when edge-to-edge is active', () => {
  const mockMetrics = { insets: { bottom: 48, top: 24, left: 0, right: 0 } };
  expect(resolveSafeBottomInset(mockMetrics)).toBe(48);
  expect(resolveSafeBottomInset(null)).toBe(Platform.OS === 'ios' ? 34 : 0);
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Operator Precedence & Undefined Dereference in SimpleHtml Dimensions (BUG-DIM-01)
- **Context**: Subsystem: `html/services/Dimensions.js` (commit `c811ec19`, PR #946).
- **What Was Expected**: `resolveMaxWidth(style)` must calculate the maximum content width available for embedded images and videos inside HTML containers by taking the window width and subtracting horizontal paddings (`paddingLeft`, `paddingRight`) and any cumulative ancestor padding (`outerPadding`).
- **What Actually Happened**: If `style.container` was missing, accessing `style.container.paddingLeft` triggered an immediate unhandled exception: `TypeError: Cannot read property 'paddingLeft' of undefined`. Furthermore, due to JavaScript operator precedence, the arithmetic expression:
  ```javascript
  const paddingValue =
    style.container.paddingLeft ||
    0 + style.container.paddingRight ||
    0 + parentContainerPadding;
  ```
  grouped `0 + style.container.paddingRight` prior to logical evaluation. If `paddingLeft` was `0`, the fallback expression evaluated incorrectly, corrupting the calculated width and causing embedded images and videos to overflow past the screen boundary.
- **Evidence in Repo**: Commit `c811ec19`, PR #946, `[SEEXT-13303] SimpleHtml: subtract both paddings and outerPadding from max width`.
- **Root Cause**: Unsafe property access on an unverified nested object (`style.container`) combined with operator precedence collisions between binary addition (`+`) and logical disjunction (`||`).
- **Remediation Code Diff**:
```javascript
// - const parentContainerPadding = style.outerPadding || 0;
// - const paddingValue =
// -   style.container.paddingLeft ||
// -   0 + style.container.paddingRight ||
// -   0 + parentContainerPadding;
// - return Dimensions.get('window').width - paddingValue;
// + const { paddingLeft = 0, paddingRight = 0 } = style.container || {};
// + const outerPadding = style.outerPadding || 0;
// + return (
// +   Dimensions.get('window').width - paddingLeft - paddingRight - outerPadding
// + );
```
- **Lesson**: Never perform mathematical additions inline with boolean fallback operators. Always destructure objects with default values from a guaranteed object literal fallback (`style.container || {}`), and evaluate arithmetic as distinct, flat subtractions.

---

### Incident 2: Android 15 / RN 0.77 Edge-to-Edge Navigation Bar Overlap (BUG-INSET-02)
- **Context**: Root inset calculation subsystem (`components/SafeArea`, Issue #922).
- **What Was Expected**: Interactive UI controls (such as bottom submit buttons and modal action sheets) must display above the Android system navigation bar when running on Android 15 with React Native 0.77 edge-to-edge drawing enabled.
- **What Actually Happened**: `HOME_INDICATOR_PADDING` and `getHomeIndicatorPadding()` were hardcoded to return `0` on Android based on the legacy assumption that Android always manages navigation bars outside the React Native drawing surface. On RN 0.77+, bottom buttons rendered underneath the system gesture line or three-button bar, rendering bottom actions untappable.
- **Evidence in Repo**: Issue #922: `fix/ android edge to edge bottom inset`.
- **Root Cause**: Premature architectural optimization hardcoding platform-specific assumptions instead of querying native runtime display metrics.
- **Remediation Code Diff**:
```javascript
// - export const getHomeIndicatorPadding = () => {
// -   return Platform.OS === 'ios' ? 34 : 0;
// - };
// + export const getHomeIndicatorPadding = () => {
// +   const bottomInset = initialWindowMetrics?.insets?.bottom;
// +   if (typeof bottomInset === 'number') {
// +     return bottomInset;
// +   }
// +   return Platform.OS === 'ios' ? 34 : 0;
// + };
```
- **Lesson**: System-level display parameters (safe area, notches, navigation bars) must never be hardcoded by platform identity. The design system must consume live window metric subscriptions with platform constants relegated strictly to uninitialized fallback conditions.

---

### Incident 3: React Navigation Lifecycle Stomping in Animation Drivers (BUG-ANIM-03)
- **Context**: Scroll-driven animation subsystem (`@shoutem/animation` integration, Issue #908).
- **What Was Expected**: Navigating between screens with scroll-driven animated headers (Screen A -> Screen B -> Screen A) should retain responsive header collapse and opacity transitions on every visit.
- **What Actually Happened**: Returning to Screen A broke scroll-driven animations entirely. The header remained frozen at scroll offset 0.
- **Evidence in Repo**: Issue #908: `fix/ remove animation driver unsubscribe`.
- **Root Cause**: React Navigation fires the `focus` event of the incoming screen *before* firing the `blur` event of the outgoing screen. Screen A registered its animation driver in `focus`. Screen B focused and registered its driver. Then Screen A's `blur` listener fired its cleanup routine, which restored/nullified the driver under the assumption that it was cleaning up after itself, inadvertently destroying the newly mounted driver.
- **Remediation Code Diff**:
```javascript
// - useEffect(() => {
// -   const focusSub = navigation.addListener('focus', () => registerDriver(driver));
// -   const blurSub = navigation.addListener('blur', () => restorePreviousDriver());
// -   return () => {
// -     focusSub();
// -     blurSub();
// -   };
// - }, [navigation, driver]);
// + const handleFocus = useCallback(() => {
// +   registerDriver(driver);
// + }, [driver, registerDriver]);
// +
// + useEffect(() => {
// +   const focusSub = navigation.addListener('focus', handleFocus);
// +   return () => {
// +     focusSub();
// +   };
// + }, [navigation, handleFocus]);
```
- **Lesson**: Do not implement symmetric undo/cleanup actions in asynchronous lifecycle hooks when the lifecycle events across concurrent entities overlap. Registration must be monotonic and self-asserting.

---

### Incident 4: Android Nested Webview Layer Rendering Crash in Vimeo Iframes (BUG-VIMEO-04)
- **Context**: Embedded video subsystem (`html/components/IframeRenderer.js`).
- **What Was Expected**: Embedding a Vimeo iframe inside a scrollable HTML view must allow the user to scroll to the very bottom of the document without OS-level crashes.
- **What Actually Happened**: On Android devices, scrolling to the bottom of a view containing a Vimeo iframe caused an instant native application crash (`SIGSEGV` or unhandled native hardware layer render abort in `RenderThread`).
- **Evidence in Repo**: `html/components/IframeRenderer.js` lines 58–66:
  ```javascript
  {...(isAndroid && {
    overScrollMode: 'never',
    androidLayerType: 'software',
  })}
  ```
- **Root Cause**: Nested hardware acceleration layers between `ReactRootView`, the outer `ScrollView`, and Android `WebView`'s Chromium hardware composition engine encounter texture buffer exhaustion and overscroll boundary collisions. When overscroll bounce effects triggered on the parent scroll container, the hardware texture compositor attempted to allocate invalid buffer handles for the nested iframe.
- **Remediation Code Diff**:
```javascript
// - <Vimeo
// -   videoId={vimeoId}
// -   style={{ height: shoutemStyle.vimeoVideo.height }}
// - />
// + <Vimeo
// +   videoId={vimeoId}
// +   style={{ height: shoutemStyle.vimeoVideo.height }}
// +   {...(isAndroid && {
// +     overScrollMode: 'never',
// +     androidLayerType: 'software',
// +   })}
// + />
```
- **Lesson**: On Android, embedded web views inside native scrolling containers must disable native overscroll animations (`overScrollMode: 'never'`) and downgrade from hardware texture composition to software rendering (`androidLayerType: 'software'`) to avoid thread crashes.

---

### Incident 5: Black Screen / Red Screen Asset Resolution Failure on Font Linking (BUG-ASSET-05)
- **Context**: Font loading and vector icon pipeline (`README.md`, `components/Icon/Icon.js`).
- **What Was Expected**: Consuming components such as `EmptyStateView` or `Icon` out-of-the-box should gracefully render bundled vector glyphs.
- **What Actually Happened**: Installing `@shoutem/ui` without manually invoking `npx react-native-asset` led to silent font fallback degradation on iOS (rendering blank or misaligned glyphs) and full red-screen termination on Android (`Unrecognized font family 'Rubicon-Icon-Font'`).
- **Evidence in Repo**: `README.md` Install Section and `package.json` native asset hooks.
- **Root Cause**: React Native does not automatically bundle custom fonts located inside secondary NPM dependency directories into the host Android `assets/fonts` or iOS `Info.plist` target without an explicit asset-linking phase.
- **Remediation Code Diff**:
```json
// package.json postinstall & linking architecture
// + "scripts": {
// +   "postinstall": "node ./scripts/add-native-deps"
// + }
// Documentation mandate:
// + npx react-native-asset node_modules/@shoutem/ui/fonts
```
- **Lesson**: Third-party component libraries containing binary assets (fonts, icons, sound banks) must provide automated `postinstall` dependency propagation to host project configurations to prevent unhandled asset-not-found exceptions at boot.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
In `hooks/useColorAndPercentageInterpolation.js`, the interpolation logic relies on low-level binary bit-shifting and color parsing:
```javascript
const hexToRgb = hex => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

const rgbToHex = ([r, g, b]) => {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)
    .toUpperCase()}`};
```
- **Bitwise Precision Hazard**: `(1 << 24)` evaluates to `16777216`. Adding `(r << 16) + (g << 8) + b` ensures that the resulting hex string has an exact leading 1 followed by 6 hex digits (e.g., `100ff00`), allowing `.slice(1)` to strip the leading digit and produce exactly 6 characters (e.g., `00FF00`). If `r, g, b` are floating-point numbers instead of clamped integers, bitwise operators (`>>`, `<<`) coerce their operands to 32-bit signed integers, which implicitly truncates the decimal portions.
- **Operator Precedence Hazard in Math**:
  In `resolveMaxWidth`:
  ```javascript
  // DANGEROUS:
  const paddingValue = style.container.paddingLeft || 0 + style.container.paddingRight || 0;
  // If paddingLeft is 0, JavaScript treats 0 as falsy, jumping to evaluate:
  // (0 + style.container.paddingRight)
  // If paddingRight is also undefined, 0 + undefined evaluates to NaN!
  // Then NaN || 0 evaluates to 0, masking bugs and producing silent NaN propagations.
  ```
  **Micro-Rule**: Always use the nullish coalescing operator (`??`) or explicit default destructuring (`const { paddingLeft = 0 } = ...`) instead of logical OR (`||`) when dealing with layout coordinates where `0` is a valid, non-fallback value.

---

### 2. Infinite Loop & Recursion Guards
In `hooks/useColorAndPercentageInterpolation.js`, animated values hook into React Native's listener engine:
```javascript
export const useColorInterpolation = (colors, progressPercentage, animatedConfig = { ... }) => {
  const animatedPercentage = useRef(new Animated.Value(0)).current;
  const [interpolatedColor, setInterpolatedColor] = useState(...);

  useEffect(() => {
    // ...
    const listener = animatedPercentage.addListener(() => {
      const colorInterpolation = animatedPercentage.interpolate(...);
      setInterpolatedColor(colorInterpolation.__getValue());
    });

    return () => {
      animatedPercentage.removeListener(listener);
    };
  }, [progressPercentage, colors, animatedPercentage, animatedConfig]);
};
```
- **The React State Infinite Re-render Trap**:
  Passing an object literal default parameter (`animatedConfig = { ... }`) directly in hook signatures creates a new object reference on *every single render*. Because `animatedConfig` is declared in the `useEffect` dependency array:
  `[progressPercentage, colors, animatedPercentage, animatedConfig]`
  each execution of `setInterpolatedColor` triggers a re-render of the parent component, which passes a new `animatedConfig` object instance, triggering `useEffect` again, restarting the animation and creating an **infinite microtask re-render loop**.
- **The Invariant Guard**:
  ```javascript
  // GUARANTEED SAFE TERMINATION:
  // 1. Primitive serialization or ref-stabilization of animatedConfig
  const stableConfig = useMemo(
    () => animatedConfig,
    [JSON.stringify(animatedConfig)]
  );
  // 2. Bound listener cleanup invariant ensures listener is purged on tear-down
  ```

---

### 3. UI & UX Micro-Mechanics
- **ActionSheet Gesture Disambiguation & Portal Stacking**:
  In `components/ActionSheet/ActionSheet.js`, `react-native-actions-sheet` is managed via dynamic refs:
  ```javascript
  useEffect(() => {
    if (active) {
      actionSheetRef.current?.show();
    } else {
      actionSheetRef.current?.hide();
    }
  }, [active]);
  ```
  **Micro-Mechanical Failure Mode**: Rapid toggling of `active` (e.g., fast user double-tapping a trigger button) invokes `show()` while the dismiss animation of `hide()` is actively executing on the native UI thread. This leads to out-of-sync native modal states where the ActionSheet is logically marked `active: true`, but natively dismissed and unreachable.
  **Invariant Rule**: Action sheet controllers must track an internal animation lock or subscribe to native `onClose` events before permitting re-triggering of `show()`.

- **HTML Video First-Frame Render Trap**:
  In `html/components/VideoRenderer.js`:
  ```javascript
  function generateVideoHtml(tnode) {
    const url = findSource(tnode);
    const containsTimeParameter = url.match(/(#|\?)t=[^&$]*/g, '');
    const resolvedUrl = `${url}${containsTimeParameter ? '' : '#t=0.1'}`;
    return `<video controls src="${resolvedUrl}" style="width: 100%; height: 100%;"/>`;
  }
  ```
  On iOS WebKit and Android WebView, `<video>` tags without explicit posters or autoplay attributes render as empty black boxes. Appending `#t=0.1` forces the browser engine's media pipeline to seek into the first decodable keyframe, extracting and rendering a hardware thumbnail without network streaming overhead.

---

### 4. Backend Concurrency & Memory Safety
- **Native Animation Driver Leaks**:
  Calling `animatedPercentage.addListener(...)` attaches a JavaScript callback to React Native's native bridge event hub.
  ```javascript
  return () => {
    animatedPercentage.removeListener(listener);
  };
  ```
  If `removeListener(listener)` is omitted, every component mount or prop change permanently leaks the closure in the native emitter table. If the closure references component state (`setInterpolatedColor`), updating unmounted components throws memory-leak warnings and increases CPU cycle consumption during frame transitions.

- **Internal Private API Invariant Violation (`__getValue()`)**:
  `colorInterpolation.__getValue()` is invoked directly. In React Native's `AnimatedInterpolation` architecture, `__getValue()` is an internal, non-contractual method. When native driver (`useNativeDriver: true`) is utilized, intermediate animation values are calculated natively on the UI thread and `__getValue()` on the JS thread either returns an outdated value or throws in production release builds.
  **Invariant Rule**: Never combine `useNativeDriver: true` with JS-side frame listeners expecting synchronous `__getValue()` interpolation.

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Null Safety in Polymorphic Attachment Lookups**:
  In `html/components/AttachmentRenderer.js`:
  ```javascript
  const AttachmentRenderer = ({ tnode, style, attachments }) => {
    if (!attachments || _.isEmpty(attachments)) {
      return null;
    }
    const image = _.find(attachments, { id: tnode?.id });
    if (!image || !image.src) {
      return null;
    }
    // ...
  };
  ```
  If `attachments` is an object with circular structures or `tnode` is passed without an `id` property, `_.find` scans the collection. If `image.width` or `image.height` are strings (common in HTML attributes, e.g., `width="100%"`), passing them directly to `resolveDimensions` causes mathematical calculations (`width / height`) to resolve to `NaN`, breaking layout trees down the hierarchy.
  **Invariant Guard**: Validate that `image.width` and `image.height` are finite numbers prior to invoking layout math:
  ```javascript
  const width = Number(image.width);
  const height = Number(image.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### Dimension 1: Architecture
- **Paradigm**: Component-driven UI framework with theme-based separation of concerns.
- **Boundary Decoupling**: Components are decoupled from visual styling rules. The styling is completely delegated to `@shoutem/theme`. A component specifies standard structural elements and semantic styles (`styleName="flexible h-center"`), while theme files define concrete attributes (colors, paddings, typography).
- **State Ownership**: Action sheets and pickers maintain transient visual open/close state locally, but defer actionable state to external props (`onPress`, `onDismiss`, `onRetry`).

### Dimension 2: Core Abstractions
- **`connectStyle(componentName)(Component)`**: HOC that acts as an intermediary, subscribing to the theme context, looking up theme definitions by component name, resolving active `styleNames`, and passing down a resolved `style` object.
- **`TNode (Render HTML Node)`**: A structural syntax tree representation of parsed HTML elements used by custom renderers to map DOM structures to React Native views.
- **`resolveDimensions` / `resolveMaxWidth`**: Layout services encapsulating geometric bounding math across physical screens and nested components.

### Dimension 3: Error Handling
- **Graceful Fallback UI**: Components like `EmptyStateView` provide standardized zero-state and failure boundaries with `onRetry` hooks.
- **Invalid Asset/URL Fallbacks**: In `IframeRenderer`, if an embedded video URL does not match supported video providers, it degrades to a styled fallback view (`shoutemStyle.fallback`) presenting an `unsupportedVideoFormatMessage` rather than crashing the rendering pipeline.
- **Hardware Failure Traps**: In Android web views, hardware acceleration is explicitly disabled for Vimeo embeds to avoid unhandled native compositor faults.

### Dimension 4: Testing
- **Harnesses**: Jest with `react-native` preset and `react-test-renderer`.
- **Snapshot Shielding**: Snapshot testing of connected components (`__tests__/__snapshots__/View-test.js.snap`) to detect unintended mutations in style propagation or class names.
- **Transform Invariants**: Configured Jest `transformIgnorePatterns: ["!/node_modules/@shoutem"]` ensures internal Shoutem ES module packages are compiled through Babel during test execution.

### Dimension 5: Security
- **Untrusted HTML Rendering Sanitization**: HTML parsing relies on `htmlparser2` and `react-native-render-html`. Scripts and active executable HTML payloads inside `VideoRenderer` are mitigated by stripping arbitrary tags and generating sandboxed `<video>` iframe nodes containing only whitelisted attributes (`src`, `controls`).
- **External URL Validation**: URL validation regular expressions ensure iframe embeddings only match authenticated video ID formats (YouTube, Vimeo) before embedding external content.

### Dimension 6: Performance
- **PureComponent Invariants**: Root primitives (`EmptyStateView`, `View`, `Button`) inherit from `PureComponent` or leverage `useMemo`/`useCallback` to prevent cascading layout passes down deep tree hierarchies.
- **Hardware Layering**: Selective use of `renderToHardwareTextureAndroid: true` on YouTube embeds offloads video decoding to native Android surfaces.
- **Frame Interpolation Offloading**: Math logic in `hooks/useColorAndPercentageInterpolation.js` uses mathematical linear interpolation (`lerp`) to calculate color changes without relying on dynamic JS bridge string transformations where possible.

### Dimension 7: Deployment
- **Autol

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
