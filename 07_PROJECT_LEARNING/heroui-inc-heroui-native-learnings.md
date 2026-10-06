# Forensic Learning Record (Deep Inspection): heroui-inc/heroui-native

> **Canonical Artifact**: `07_PROJECT_LEARNING/heroui-inc-heroui-native-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/heroui-inc/heroui-native](https://github.com/heroui-inc/heroui-native))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:15:11.938Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `heroui-inc/heroui-native`
- **Description**: 📱Beautiful, fast and modern React Native UI library
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3670 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `example/src/components/toast/use-shared-state.ts`
```
import { useCallback, useEffect, useState } from 'react';

/**
 * Shared state store for toast components
 * Uses a Map to store state by key and listeners for each key
 */
const sharedStateStore = new Map<string, unknown>();
const stateListeners = new Map<string, Set<(value: unknown) => void>>();

/**
 * Generic hook to access and update shared state
 * Can be used in both parent component and toast component
 *
 * Why we need this:
 * - The toast component is rendered via a memoized callback that doesn't depend on state
 * - When parent updates state, the toast component needs to be notified to re-render
 * - We use sharedStateStore to track current value and listeners to notify components
 *
 * When setState is called, all components using this hook with the same key will re-render
 * with the new state, even if they're memoized or rendered separately
 *
 * @param key - Unique key to identify the shared state
 * @param initialValue - Initial value if state doesn't exist yet
 * @returns Object with state value and setState function
 */
export function useSharedState<T>(key: string, initialValue: T) {
  /**
   * Initialize state from shared value (important if component mounts after state was set)
   */
  const [state, setStateValue] = useState<T>(() => {
    const existingValue = sharedStateStore.get(key);
    return (existingValue as T) ?? initialValue;
  });

  useEffect(() => {
    /**
     * Initialize shared state if it doesn't exist
     */
    if (!sharedStateStore.has(key)) {
      sharedStateStore.set(key, initialValue);
    }

    /**
     * Initialize listeners set if it doesn't exist
     */
    if (!stateListeners.has(key)) {
      stateListeners.set(key, new Set());
    }

    /**
     * Subscribe to state changes
     * When setState is called elsewhere, this component will update
     */
    const updateState = (value: unknown) => {
      setStateValue(value as T);
    };

    const listeners = stateListeners.get(key);
    if (!listeners) return;

    /**
     * Sync with current shared state immediately (important if component mounts after state was set)
     */
    const currentValue = sharedStateStore.get(key);
    if (currentValue !== undefined && currentValue !== state) {
      setStateValue(currentValue as T);
    }

    /**
     * Add listener to receive future updates
     */
    listeners.add(updateState);

    /**
     * Cleanup listener on unmount
     */
    return () => {
      listeners.delete(updateState);
      /**
       * Clean up empty listener sets
       */
      if (listeners.size === 0) {
        stateListeners.delete(key);
      }
    };
  }, [key, initialValue, state]);

  /**
   * Set state and notify all listeners (all components using this hook with the same key)
   *
   * @param value - New state value
   */
  const setState = useCallback(
    (value: T | ((prev: T) => T)) => {
      const newValue =
        typeof value === 'function'
          ? (value as (prev: T) => T)(sharedStateStore.get(key) as T)
          : value;

      sharedStateStore.set(key, newValue);

      const listeners = stateListeners.get(key);
      if (listeners) {
        listeners.forEach((listener) => listener(newValue));
      }
    },
    [key]
  );

  /**
   * Reset state to initial value
   */
  const resetState = useCallback(() => {
    sharedStateStore.set(key, initialValue);

    const listeners = stateListeners.get(key);
    if (listeners) {
      listeners.forEach((listener) => listener(initialValue));
    }
  }, [key, initialValue]);

  return { state, setState, resetState };
}

```

### Core Architecture Module: `example/src/components/with-state-toggle.tsx`
```
import { ControlField, Description, Label, Separator } from 'heroui-native';
import { type FC, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useHeaderHeight from '../helpers/hooks/use-header-height';

/**
 * Props for the WithStateToggle component
 */
export interface WithStateToggleProps {
  /** Main content to render */
  children: ReactNode;

  /** Whether the toggle is selected */
  isSelected: boolean;

  /** Callback when selection state changes */
  onSelectedChange: (isSelected: boolean) => void;

  /** Label text for the toggle */
  label: string;

  /** Description text displayed below the label */
  description?: string;
}

/**
 * Reusable container component that wraps content with a toggle at the bottom.
 * Provides consistent styling and layout with proper safe area handling.
 *
 * @example
 * ```tsx
 * <WithStateToggle
 *   isSelected={enabled}
 *   onSelectedChange={setEnabled}
 *   label="Enable Feature"
 *   description="Turn on this feature to enable advanced options"
 * >
 *   <YourContent />
 * </WithStateToggle>
 * ```
 */
export const WithStateToggle: FC<WithStateToggleProps> = ({
  children,
  isSelected,
  onSelectedChange,
  label,
  description,
}) => {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 justify-between px-5"
      style={{
        paddingTop: headerHeight + 20,
        paddingBottom:
          insets.bottom + (Platform.select({ ios: 110, android: 150 }) ?? 0),
      }}
    >
      {children}
      <View>
        <ControlField
          isSelected={isSelected}
          onSelectedChange={onSelectedChange}
          className="pe-2"
        >
          <View className="flex-1">
            <Label>
              <Label.Text maxFontSizeMultiplier={1.2}>{label}</Label.Text>
            </Label>
            {description && (
              <Description maxFontSizeMultiplier={1.2}>
                {description}
              </Description>
            )}
          </View>
          <ControlField.Indicator />
        </ControlField>
        <Separator className="mt-6" />
      </View>
    </View>
  );
};

```

### Core Architecture Module: `example/src/helpers/hooks/use-accessability-info.ts`
```
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export const useAccessibilityInfo = () => {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [reduceTransparencyEnabled, setReduceTransparencyEnabled] =
    useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const reduceMotionChangedSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (isReduceMotionEnabled) => {
        setReduceMotionEnabled(isReduceMotionEnabled);
      }
    );
    const reduceTransparencyChangedSubscription =
      AccessibilityInfo.addEventListener(
        'reduceTransparencyChanged',
        (isReduceTransparencyEnabled) => {
          setReduceTransparencyEnabled(isReduceTransparencyEnabled);
        }
      );

    AccessibilityInfo.isReduceMotionEnabled().then((isReduceMotionEnabled) => {
      setReduceMotionEnabled(isReduceMotionEnabled);
    });
    AccessibilityInfo.isReduceTransparencyEnabled().then(
      (isReduceTransparencyEnabled) => {
        setReduceTransparencyEnabled(isReduceTransparencyEnabled);
      }
    );

    return () => {
      reduceMotionChangedSubscription.remove();
      reduceTransparencyChangedSubscription.remove();
    };
  }, []);

  return {
    reduceMotionEnabled,
    reduceTransparencyEnabled,
  };
};

```

### Core Architecture Module: `example/src/helpers/hooks/use-header-height.ts`
```
import { useHeaderHeight as useHeaderHeightElements } from 'expo-router/react-navigation';
import { useRef } from 'react';
import { Platform } from 'react-native';

function useHeaderHeight(): number {
  const headerHeight = useHeaderHeightElements();
  const fixedHeight = useRef(headerHeight);

  return Platform.OS === 'android' ? fixedHeight.current : headerHeight;
}
export default useHeaderHeight;

```

### Core Architecture Module: `example/src/helpers/hooks/use-ota-update.ts`
```
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

type UseOtaUpdateOptions = {
  /** Whether the initial version check against the store has completed */
  isVersionChecked: boolean;
  /** Whether a newer native version exists in the store */
  isNewVersionAvailable: boolean;
  /** Called when an OTA update has been fetched and is ready to apply */
  onUpdateReady: () => void;
};

/**
 * Manages EAS OTA updates. Fetches available updates and notifies the layout
 * when one is ready to apply. Re-checks when the app returns to the foreground.
 * Skipped entirely in development builds.
 */
export function useOtaUpdate({
  isVersionChecked,
  isNewVersionAvailable,
  onUpdateReady,
}: UseOtaUpdateOptions) {
  const { isUpdateAvailable } = Updates.useUpdates();
  const appState = useRef(AppState.currentState);

  const handleUpdate = useCallback(async () => {
    if (!isUpdateAvailable || !isVersionChecked || isNewVersionAvailable) {
      return;
    }

    try {
      await Updates.fetchUpdateAsync();
      onUpdateReady();
    } catch (error) {
      console.log('[useOtaUpdate] Failed to fetch update:', error);
    }
  }, [
    isUpdateAvailable,
    isVersionChecked,
    isNewVersionAvailable,
    onUpdateReady,
  ]);

  useEffect(() => {
    if (__DEV__) {
      return;
    }

    handleUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpdateAvailable, isVersionChecked, isNewVersionAvailable]);

  useEffect(() => {
    if (__DEV__) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        Updates.checkForUpdateAsync()
          .then(() => handleUpdate())
          .catch((error) => {
            console.log(
              '[useOtaUpdate] Failed to check for update on foreground:',
              error
            );
          });
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

```

### Core Architecture Module: `example/src/helpers/hooks/use-version-check.ts`
```
import Constants from 'expo-constants';
import { useEffect } from 'react';
import {
  getAppInfoFromTheStore,
  shouldUpdateApp,
} from '../utils/version-check';

type UseVersionCheckOptions = {
  /**
   * Called when the version check completes.
   * @param isNewVersionAvailable - `true` when the store has a newer version
   */
  onVersionChecked: (isNewVersionAvailable: boolean) => void;
};

/**
 * Checks the App Store for a newer version on mount.
 * Skipped entirely in development builds.
 */
export function useVersionCheck({ onVersionChecked }: UseVersionCheckOptions) {
  useEffect(() => {
    if (__DEV__) {
      return;
    }

    let cancelled = false;

    const checkForUpdate = async () => {
      try {
        const result = await getAppInfoFromTheStore();
        const newestVersion = result?.version;
        const installedVersion = Constants.expoConfig?.version;

        if (cancelled) {
          return;
        }

        if (
          installedVersion &&
          newestVersion &&
          shouldUpdateApp(installedVersion, newestVersion)
        ) {
          onVersionChecked(true);
        } else {
          onVersionChecked(false);
        }
      } catch (error) {
        console.log('[useVersionCheck] Failed to check for updates:', error);

        if (!cancelled) {
          onVersionChecked(false);
        }
      }
    };

    checkForUpdate();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

```

### Core Architecture Module: `example/src/helpers/utils/simulate-press.ts`
```
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';

export const simulatePress = () => {
  if (__DEV__) {
    // eslint-disable-next-line lingui/no-unlocalized-strings -- Dev-only diagnostic, never shipped.
    Alert.alert('Pressed');
  }

  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

```

### Core Architecture Module: `example/src/helpers/utils/version-check.ts`
```
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** App Store link for the HeroUI Native app */
export const APP_STORE_URL =
  'https://apps.apple.com/us/app/heroui-native/id6757860059';

/** Resolved bundle/package identifier per platform */
const bundleInfo = Platform.select({
  ios: {
    id: Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.herouinative.app',
  },
  android: {
    id: Constants.expoConfig?.android?.package ?? 'com.herouinative.android',
  },
});

/** Shape returned by both store-lookup helpers */
interface AppInfoFromStore {
  version: string;
  storeUrl: string;
}

/**
 * Fetches the latest app info from the iOS App Store via the iTunes lookup API.
 * @param country - optional ISO country code for regional lookups
 */
export async function getInfoFromAppStore(
  country = ''
): Promise<AppInfoFromStore | null> {
  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${bundleInfo?.id}&country=${country}`,
      { cache: 'no-store' }
    );

    const data = (await response.json()) as {
      results: Array<{ trackViewUrl: string; version: string }>;
    };

    const firstResult = data.results[0];
    if (!firstResult) {
      return null;
    }

    return {
      storeUrl: firstResult.trackViewUrl ?? '',
      version: firstResult.version ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Fetches the latest app info from the Google Play Store by scraping the
 * store page. Currently a stub -- returns `null` until an Android build is
 * published and the scraping targets are verified.
 * @param _country - reserved for future use
 */
export async function getInfoFromPlayStore(
  _country = ''
): Promise<AppInfoFromStore | null> {
  return null;
}

/**
 * Platform-aware wrapper that delegates to the correct store lookup function.
 * @param country - optional ISO country code for regional lookups
 */
export async function getAppInfoFromTheStore(
  country = ''
): Promise<AppInfoFromStore | null> {
  const selectedFunction = Platform.select({
    ios: getInfoFromAppStore,
    android: getInfoFromPlayStore,
  });

  if (selectedFunction) {
    return selectedFunction(country);
  }

  return null;
}

/**
 * Compares two semver-style version strings (e.g. "1.2.3") and returns `true`
 * when `newestVersion` is strictly greater than `installedVersion`.
 */
export function shouldUpdateApp(
  installedVersion: string,
  newestVersion: string
): boolean {
  if (!installedVersion || !newestVersion) {
    return false;
  }

  const installed = installedVersion.split('.').map(Number);
  const newest = newestVersion.split('.').map(Number);

  for (let i = 0; i < Math.max(installed.length, newest.length); i++) {
    const installedPart = installed[i] ?? 0;
    const newestPart = newest[i] ?? 0;

    if (installedPart < newestPart) {
      return true;
    } else if (installedPart > newestPart) {
      return false;
    }
  }

  return false;
}

```

### Core Architecture Module: `src/components/alert/alert.hooks.ts`
```
import { useThemeColor } from '../../helpers/external/hooks';
import type { AlertStatus } from '../../primitives/alert/alert.types';

/**
 * Resolves the default icon color based on the current alert status.
 */
export function useStatusColor(status: AlertStatus): string {
  const [foreground, accent, success, warning, danger] = useThemeColor([
    'foreground',
    'accent-soft-foreground',
    'success-soft-foreground',
    'warning-soft-foreground',
    'danger-soft-foreground',
  ]);

  switch (status) {
    case 'accent':
      return accent;
    case 'success':
      return success;
    case 'warning':
      return warning;
    case 'danger':
      return danger;
    default:
      return foreground;
  }
}

```

### Core Architecture Module: `src/components/alert/alert.utils.tsx`
```
import type { AlertStatus } from '../../primitives/alert/alert.types';
import { DEFAULT_ICON_SIZE } from './alert.constants';
import type { AlertIconProps } from './alert.types';
import { DefaultIcon } from './default-icon';
import { SuccessIcon } from './success-icon';
import { WarningIcon } from './warning-icon';

/**
 * Resolves the default icon component based on the current alert status.
 */
export function getStatusIcon(
  status: AlertStatus,
  iconProps: AlertIconProps
): React.ReactElement {
  const { size = DEFAULT_ICON_SIZE, color } = iconProps;

  switch (status) {
    case 'success':
      return <SuccessIcon size={size} color={color} />;
    case 'warning':
      return <WarningIcon size={size} color={color} />;
    default:
      return <DefaultIcon size={size} color={color} />;
  }
}

```

### Core Architecture Module: `src/components/button/button.utils.ts`
```
import type { ButtonRootProps } from './button.types';

/**
 * Resolves the animation prop into its object form.
 * Returns `undefined` when the animation is a non-object value (boolean / string).
 */
export function resolveAnimationObject(
  animation: ButtonRootProps['animation']
): Record<string, unknown> | undefined {
  if (typeof animation === 'object' && animation !== null) {
    return animation;
  }
  return undefined;
}

/**
 * Determines whether all animations should be disabled based on the animation prop value.
 */
export function isAnimationDisabled(
  animation: ButtonRootProps['animation']
): boolean {
  if (
    animation === false ||
    animation === 'disabled' ||
    animation === 'disable-all'
  ) {
    return true;
  }
  if (typeof animation === 'object' && animation !== null) {
    const { state } = animation;
    return state === false || state === 'disabled' || state === 'disable-all';
  }
  return false;
}

```

### Core Architecture Module: `src/components/glass-view/glass-view.utils.ts`
```
/**
 * Parsed RGBA color channels. RGB channels are 0–255; alpha is 0–1.
 */
type RgbaChannels = {
  r: number;
  g: number;
  b: number;
  a: number;
};

/**
 * Expands a single hex digit to two digits (`f` → `ff`).
 */
function expandHexDigit(digit: string): string {
  return `${digit}${digit}`;
}

/**
 * Parses a `#rgb`, `#rrggbb`, or `#rrggbbaa` color string into RGBA channels.
 * Returns `null` when the string is not a valid hex color.
 */
function parseHexColor(color: string): RgbaChannels | null {
  const hex = color.slice(1);

  if (hex.length === 3) {
    const r = Number.parseInt(expandHexDigit(hex[0] ?? ''), 16);
    const g = Number.parseInt(expandHexDigit(hex[1] ?? ''), 16);
    const b = Number.parseInt(expandHexDigit(hex[2] ?? ''), 16);
    if ([r, g, b].some((channel) => Number.isNaN(channel))) {
      return null;
    }
    return { r, g, b, a: 1 };
  }

  if (hex.length === 6 || hex.length === 8) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((channel) => Number.isNaN(channel))) {
      return null;
    }
    if (hex.length === 6) {
      return { r, g, b, a: 1 };
    }
    const alphaByte = Number.parseInt(hex.slice(6, 8), 16);
    if (Number.isNaN(alphaByte)) {
      return null;
    }
    return { r, g, b, a: alphaByte / 255 };
  }

  return null;
}

/**
 * Parses an `rgb(...)` or `rgba(...)` color string into RGBA channels.
 * Returns `null` when the string is not a valid rgb/rgba color.
 */
function parseRgbColor(color: string): RgbaChannels | null {
  const match = color.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i
  );
  if (!match) {
    return null;
  }

  const r = Number.parseFloat(match[1] ?? '');
  const g = Number.parseFloat(match[2] ?? '');
  const b = Number.parseFloat(match[3] ?? '');
  const a = match[4] === undefined ? 1 : Number.parseFloat(match[4]);

  if ([r, g, b, a].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return { r, g, b, a };
}

/**
 * Parses a percentage-or-number token (`80%` → 0.8 with `percentScale` 0.01,
 * `0.8` → 0.8). Returns `null` for invalid numbers.
 */
function parseScaledNumber(token: string, percentScale: number): number | null {
  const isPercent = token.endsWith('%');
  const numeric = Number.parseFloat(isPercent ? token.slice(0, -1) : token);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return isPercent ? numeric * percentScale : numeric;
}

/**
 * Parses an `oklch(L C H / A)` color string into RGBA channels, converting
 * through OKLab → LMS → linear sRGB per the OKLab reference implementation.
 * Returns `null` when the string is not a valid oklch color.
 *
 * Needed on web, where uniwind resolves theme variables via
 * `getComputedStyle` and custom properties keep their authored `oklch(...)`
 * form instead of being converted to rgb.
 */
function parseOklchColor(color: string): RgbaChannels | null {
  const match = color.match(
    /^oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+(-?[0-9.]+)(?:deg)?\s*(?:\/\s*([0-9.]+%?)\s*)?\)$/i
  );
  if (!match) {
    return null;
  }

  /** Lightness: `100%` → 1; chroma percentage maps `100%` → 0.4 per spec. */
  const lightness = parseScaledNumber(match[1] ?? '', 0.01);
  const chroma = parseScaledNumber(match[2] ?? '', 0.004);
  const hueDegrees = Number.parseFloat(match[3] ?? '');
  const alpha = match[4] === undefined ? 1 : parseScaledNumber(match[4], 0.01);

  if (
    lightness === null ||
    chroma === null ||
    Number.isNaN(hueDegrees) ||
    alpha === null
  ) {
    return null;
  }

  const hueRadians = (hueDegrees * Math.PI) / 180;
  const labA = chroma * Math.cos(hueRadians);
  const labB = chroma * Math.sin(hueRadians);

  const lPrime = lightness + 0.3963377774 * labA + 0.2158037573 * labB;
  const mPrime = lightness - 0.1055613458 * labA - 0.0638541728 * labB;
  const sPrime = lightness - 0.0894841775 * labA - 1.291485548 * labB;

  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  const linearR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linearG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linearBChannel = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const toGammaByte = (channel: number): number =>
    Math.min(255, Math.max(0, linearChannelToSrgb(channel)));

  return {
    r: toGammaByte(linearR),
    g: toGammaByte(linearG),
    b: toGammaByte(linearBChannel),
    a: Math.min(1, Math.max(0, alpha)),
  };
}

/**
 * Parses a CSS color string returned by `useThemeColor` into RGBA channels.
 * Supports `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, and
 * `oklch()` (the form web custom properties resolve to).
 * Returns `null` when the format is unsupported or invalid.
 */
function parseColor(color: string): RgbaChannels | null {
  const trimmed = color.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.startsWith('#')) {
    return parseHexColor(trimmed);
  }
  if (trimmed.toLowerCase().startsWith('rgb')) {
    return parseRgbColor(trimmed);
  }
  if (trimmed.toLowerCase().startsWith('oklch')) {
    return parseOklchColor(trimmed);
  }
  return null;
}

/**
 * Formats RGB channels as a 6-digit opaque hex string (`#rrggbb`).
 */
function toOpaqueHex(r: number, g: number, b: number): string {
  const toByte = (channel: number): string =>
    Math.round(Math.min(255, Math.max(0, channel)))
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

/**
 * Converts a gamma-encoded sRGB channel (0–255) to linear-light (0–1),
 * per the IEC 61966-2-1 sRGB transfer function.
 */
function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Converts a linear-light channel (0–1) back to gamma-encoded sRGB (0–255),
 * per the IEC 61966-2-1 sRGB transfer function.
 */
function linearChannelToSrgb(channel: number): number {
  const encoded =
    channel <= 0.0031308
      ? channel * 12.92
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return encoded * 255;
}

/**
 * Alpha-composites a foreground color over an opaque background and returns
 * the resulting opaque hex (`#rrggbb`).
 *
 * Used by `GlassView` on platforms without native backdrop blur: the glass
 * tint (e.g. `#ffffffbf`) is flattened over the theme `--background` so the
 * fallback layer approximates the frosted look without translucency.
 *
 * Channels are blended in linear-light space (sRGB values are decoded before
 * the lerp and re-encoded after). Blending gamma-encoded values directly
 * biases the mix darker whenever a light tint sits over a darker backdrop;
 * linear-light compositing is the physically correct model of light passing
 * through a translucent layer and better matches the native blur result.
 *
 * Returns `color` unchanged when either string cannot be parsed.
 *
 * @param color - Foreground color (may include alpha), from `useThemeColor`
 * @param background - Opaque background color to composite onto
 * @returns Opaque hex string approximating the composited result
 */
export function flattenColorOverBackground(
  color: string,
  background: string
): string {
  const foreground = parseColor(color);
  const backdrop = parseColor(background);

  if (!foreground || !backdrop) {
    return color;
  }

  const alpha = foreground.a;
  const compositeChannel = (fg: number, bg: number): number =>
    linearChannelToSrgb(
      alpha * srgbChannelToLinear(fg) + (1 - alpha) * srgbChannelToLinear(bg)
    );

  return toOpaqueHex(
    compositeChannel(foreground.r, backdrop.r),
    compositeChannel(foreground.g, backdrop.g),
    compositeChannel(foreground.b, backdrop.b)
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #504** (2026-09-25): **fix(input): preserve native ref types in published declarations**
  *Symptoms*: Fixes #497; follows up on #499.  ## 📝 Description  Native input refs still fail typechecking with the published 1.0.10 package on React Native 0.87+. Preserve the native ref relationship in the declarations for Input, TextArea, SearchField.Input and InputGroup.Input.  ## ⛳️ Current behavior (updates)  The source uses the corrected ref aliases, but the inferred component declarations resolve them to the build environment's `TextInput` type. A clean build against React Native 0.86.3 therefore produces declarations that reject native input instances on the Strict API.  ## 🚀 New behavior  Add one internal `TextInputComponent<Props>` type and use it to annotate the four forwarded components. Declaration generation retains that named type, so the native ref resolves against the consumer's React Native version. Existing compound components, props, and runtime implementations stay the same.  ### Alternatives considered  Explicitly annotating each compound export also fixes declaration generation, but repeats the compound component shape. A shared component type preserves the ref alias across all four inputs with less duplication and no runtime changes.  ## 💣 Is this a breaking change (Yes/No):  No. No public API additions, runtime changes, dependencies, or migration steps.  ## 📝 Additional Information  Verified against main `122f63db` using standalone consumers of the packed package:  | React Native | Published 1.0.10 | Fixed package | | --- | --- | --- | | 0.86.3 | Pass | Pass |
  **Post-Mortem & Fix Analysis**:
  > Thank you for catching this! Looks like we missed the generated declaration issue in v1.0.10. The fix looks good.

- **Issue #503** (2026-09-25): **docs: fix customizing colors example to include :root**
  *Symptoms*: Closes #502   ## 📝 Description  This PR fixes the example of customizing colors in `docs/colors.md`

- **Issue #500** (2026-09-21): **1.0.10**
  *Symptoms*: PRs included in this release:  PR #499: fix(input): type refs as native TextInput instance PR #498: fix(bottom-sheet): hide closed sheet handle peek on Android PR #496: fix(bottom-sheet): hide dismissed sheet during container resize PR #495: fix(skeleton): skip default FadeIn/FadeOut for variant="none" PR #484: fix(switch): keep a consumer provided aria-valuetext PR #493: fix(dialog,select): let outside taps pass through animated wrappers on iOS PR #483: docs(glass-view): correct documented intensity default PR #487: docs: correct documented icon defaults for CloseButton, Alert and SubMenu PR #486: fix(select): apply the documented default trigger variant PR #492: fix(menu,popover,select): refresh open anchors when the app window changes Also on 1.0.10 (no PR): commit 8274a31 — fix(input): remove outline width for iOS  Resolved issues:  #497: Input ref is incompatible with React Native Strict TypeScript API #485: [Select] Switching between portrait and landscape modes will cause Select.Content to pop up automatically #494: Skeleton animation causes severe list jank / lag on New Architecture #489: Open Select, Popover and Menu panels retain stale anchors when the app window changes

- **Issue #499** (2026-09-21): **fix(input): type refs as native TextInput instance**
  *Symptoms*: Closes #497   ## 📝 Description  Input, TextArea, SearchField, and InputGroup forwarded refs as `typeof TextInput`, which breaks under React Native's Strict TypeScript API (0.87+) where `TextInput` is the component function, not the instance. Refs now resolve via `React.ComponentRef` so callers can type-check `.focus()`, `.blur()`, and `.clear()`.  ## ⛳️ Current behavior (updates)  Ref types on these components use the `TextInput` component constructor, so assigning a native instance ref fails typecheck on the Strict API.  ## 🚀 New behavior  - Shared `TextInputRef` primitive (`React.ComponentRef<typeof TextInput>`) used by HeroTextInput and all input wrappers - Public `InputRef` and `TextAreaRef` exports - `SearchField.Input` and `InputGroup.Input` accept the same native instance ref - Compile-time assertion test in `src/__tests__/input-ref.types.ts`  ## 💣 Is this a breaking change (Yes/No):  **No** - New exported types are additive. On legacy RN types, `InputRef` still equals `TextInput`; on the Strict API it correctly becomes `TextInputInstance`.  ## 📝 Additional Information  Covered by a type-level assertion checked with `yarn typecheck` (not a Jest runtime test). No new runtime dependencies or behavior changes.

- **Issue #498** (2026-09-21): **fix(bottom-sheet): hide closed sheet handle peek on Android**
  *Symptoms*: ## 📝 Description  Closed bottom sheets on Android could flash their handle above the bottom edge because Gorhom parks them at `window.height`, which is shorter than the measured container on edge-to-edge devices. This applies the closed-position correction on first layout and ignores Gorhom's own open animations while `isOpen` is still false.  ## ⛳️ Current behavior (updates)  On Android (Samsung edge-to-edge, 3-button navigation, translucent status bars), a closed bottom sheet's handle can peek at the bottom until something animates it away.  ## 🚀 New behavior  - Correct the closed position on the first layout, not only on later resizes - Treat near-0 / near-2 animation progress as dismissed so a slightly off-screen sheet stays hidden - Un-hide the sheet only when `isOpen` is true, so Gorhom auto-snaps cannot reveal a closed sheet - Pin uniwind to 1.12.0 and enable translucent status/nav bars on the example `KeyboardProvider`  ## 💣 Is this a breaking change (Yes/No):  **No** - Public APIs are unchanged; this is a visibility fix for closed sheets plus a uniwind version pin.  ## 📝 Additional Information  Uniwind is pinned from `^1.10.0` to `1.12.0` in both the library and the example app. The example `KeyboardProvider` translucent flags help reproduce the Android inset mismatch used by this fix.

- **Issue #497** (2026-09-21): **Input ref is incompatible with React Native Strict TypeScript API**
  *Symptoms*: ### Bug summary  After upgrading to Expo SDK 58 beta, passing a correctly typed native input ref to HeroUI `Input` produces TS2322. The same ref works with React Native's `TextInput`.  This appears to come from React Native's Strict TypeScript API, enabled by default since RN 0.87, rather than Expo itself. Component types and instance types are now separate; React Native documents `TextInputInstance` for refs: [migration guide](https://reactnative.dev/docs/strict-typescript-api#refs-now-use-instance-types).  ### Library version  `heroui-native@1.0.9` (latest stable). The same `TextInput` ref annotation remains in current `main`.  ### Environment info  Encountered with Expo `58.0.0-preview.2`, React Native `0.88.0-rc.0`, TypeScript `6.0.3`. Also reproduced separately with stable React Native `0.87.1`, without Expo configuration.  ### Steps to reproduce  Typecheck this with `strict: true`, `skipLibCheck: true`, `jsx: "react-jsx"` and `moduleResolution: "bundler"`:  ```tsx import { useRef } from 'react'; import { TextInput, type TextInputInstance } from 'react-native'; import { Input } from 'heroui-native';  export function Example() {   const ref = useRef<TextInputInstance>(null);   return (     <>       <TextInput ref={ref} /> {/* passes */}       <Input ref={ref} /> {/* TS2322 */}     </>   ); } ```  ```text Type 'RefObject<_TextInputInstance | null>' is not assignable to type 'Ref<TextInputType> | undefined'. ```  Expected: both accept the native input instance ref, for exam
  **Post-Mortem & Fix Analysis**:
  > Thanks for the fix! I checked the published 1.0.10 package and found a remaining declaration-generation issue. Could we reopen this issue for the follow-up?  The source and exported `InputRef` alias are corrected, but the published component declarations still use `RefAttributes<import("react-native").TextInput>`. As a result, Input, TextArea, SearchField.Input and InputGroup.Input still reject native instance refs in a standalone React Native 0.87.1 consumer. React Native 0.86.3 passes; 0.88.0-rc.0 also fails.  A clean build of current main reproduces this, so it is not only a stale npm artifact. A shared named component type preserves the native ref relationship during declaration generation. I opened #504 with the focused fix, verified using packed-package consumers on both legacy and Strict API versions. The fixed tarball passes all three versions, and the generated JavaScript is unchanged apart from comments. 

- **Issue #496** (2026-09-18): **fix(bottom-sheet): hide dismissed sheet during container resize**
  *Symptoms*: Closes #485   ## 📝 Description  Dismissed bottom sheets could flash back into view when the container resized — device rotation or iPad split view — because they stayed mounted at a stale closed offset. This keeps a closed sheet aligned with the new container and out of the paint until it is opened again.  ## � keeps a closed sheet aligned with the new container and out of the paint until it is opened again.  ## ⛳️ Current behavior (updates)  A closed sheet can reappear mid-resize even though `isOpen` is still `false`, and it is then unreachable through the overlay.  ## 🚀 New behavior  - An idle dismissed sheet is moved to the new closed offset in the same frame as the resize - A close that is still animating is retargeted with a zero-duration close so it stays in step with the resize - A dismissed sheet is taken out of the paint (`opacity: 0`, `pointerEvents: none`) so iOS cannot flash it before React Native reports the new size - Opening via `isOpen` or snapping through the sheet ref brings it back into view  ## 💣 Is this a breaking change (Yes/No):  **No** - The public API is unchanged; this is an internal dismissed-state and animation fix.  ## 📝 Additional Information  Changes are limited to `bottom-sheet-content.tsx` and `bottom-sheet-content-container.tsx`. Verify by closing a sheet (Select, DatePicker, or BottomSheet) and rotating the device or resizing iPad split view — the sheet should stay hidden and remain reachable only after it is ope

- **Issue #495** (2026-09-18): **fix(skeleton): skip default FadeIn/FadeOut for variant="none"**
  *Symptoms*: Closes #494   ## 📝 Description  Skeleton `variant="none"` now skips the default FadeIn/FadeOut layout animations unless enter/exit is set explicitly. This keeps static bones cheap to mount and recycle in lists.  ## ⛳️ Current behavior (updates)  `variant="none"` still disables shimmer and pulse, but the root still applies default FadeIn/FadeOut on mount and unmount.  ## 🚀 New behavior  - `variant="none"` is a static placeholder with no default enter/exit animation - Explicit `animation.entering` / `animation.exiting` still apply - Lists that recycle `none` skeletons no longer pay layout-animation cost on every mount  ## 💣 Is this a breaking change (Yes/No):  **No** - Default `shimmer` behavior is unchanged. Existing `variant="none"` usage can restore enter/exit by passing `animation.entering` / `animation.exiting`.  ## 📝 Additional Information  Covered by JSDoc on `useSkeletonRootAnimation` and the `variant` prop. No new dependencies. Main gain is lower layout-animation cost for recycled static skeletons.

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

### Incident Patch 1: `0de7da78` (2026-09-21)
**Commit Message**: Merge pull request #500 from heroui-inc/1.0.10

1.0.10

**File**: `example/package.json` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@
     "tailwind-merge": "^3.6.0",
     "tailwind-variants": "^3.2.2",
     "tailwindcss": "^4.3.2",
-    "uniwind": "^1.10.0"
+    "uniwind": "1.12.0"
   },
   "devDependencies": {
     "@babel/core": "^7.29.0",
```

**File**: `example/src/app/_layout.tsx` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@ export default function Layout() {
 
   return (
     <GestureHandlerRootView style={styles.root}>
-      <KeyboardProvider>
+      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
         <AppLocaleProvider>
           <AppContent />
         </AppLocaleProvider>
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@
     "tailwind-variants": "^3.2.2",
     "tailwindcss": "^4.3.2",
     "typescript": "^5.8.3",
-    "uniwind": "^1.10.0"
+    "uniwind": "1.12.0"
   },
   "peerDependencies": {
     "@gorhom/bottom-sheet": "^5.2.9",
```

**File**: `src/__tests__/select.styles.test.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { selectClassNames } from '../components/select/select.styles';
+
+describe('selectClassNames.trigger', () => {
+  it('applies the default variant when no variant is passed', () => {
+    expect(selectClassNames.trigger()).toBe('select__trigger--variant-default');
+  });
+
+  it('keeps the default variant when other props are passed', () => {
+    expect(selectClassNames.trigger({ isDisabled: true })).toBe(
+      'select__trigger--variant-default select__trigger--is-disabled'
+    );
+  });
+
+  it('omits the default variant styles when unstyled is requested', () => {
+    expect(
+      selectClassNames.trigger({ variant: 'unstyled', isDisabled: true })
+    ).toBe('select__trigger--is-disabled');
+  });
+});
```

**File**: `src/__tests__/switch-primitive.test.tsx` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import type { ReactElement } from 'react';
+import { Root as SwitchRoot } from '../primitives/switch/switch';
+import type { RootProps } from '../primitives/switch/switch.types';
+
+/**
+ * The Switch primitive Root calls no hooks, so its `forwardRef` render function
+ * can be invoked directly to read the props handed to the underlying Pressable.
+ */
+function getRootProps(props: RootProps): Record<string, unknown> {
+  const { render } = SwitchRoot as unknown as {
+    render: (props: RootProps, ref: null) => ReactElement;
+  };
+
+  return render(props, null).props as Record<string, unknown>;
+}
+
+describe('Switch primitive aria-valuetext', () => {
+  it('derives the value text from the selected state when none is provided', () => {
+    expect(getRootProps({ isSelected: true })['aria-valuetext']).toBe('on');
+    expect(getRootProps({ isSelected: false })['aria-valuetext']).toBe('off');
+  });
+
+  it('forwards a consumer provided value text unchanged', () => {
+    expect(
+      getRootProps({
+        'isSelected': false,
+        'aria-valuetext': 'Silent mode off',
+      })['aria-valuetext']
+    ).toBe('Silent mode off');
+
+    expect(
+      getRootProps({ 'isSelected': true, 'aria-valuetext': 'Silent mode on' })[
+        'aria-valuetext'
+      ]
+    ).toBe('Silent mode on');
+  });
+});
```

**File**: `src/components/alert/alert.types.ts` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ export interface AlertIconProps {
   /**
    * Icon size in pixels
    *
-   * @default 20
+   * @default 18
    */
   size?: number;
   /**
```

**File**: `src/components/close-button/close-button.md` (modified, +1/-1)
```diff
@@ -105,5 +105,5 @@ For inherited props including `isDisabled`, `className`, `animation`, `feedbackV
 
 | prop    | type     | default                | description       |
 | ------- | -------- | ---------------------- | ----------------- |
-| `size`  | `number` | `20`                   | Size of the icon  |
+| `size`  | `number` | `18`                   | Size of the icon  |
 | `color` | `string` | Uses theme muted color | Color of the icon |
```

**File**: `src/components/close-button/close-button.types.ts` (modified, +2/-2)
```diff
@@ -6,12 +6,12 @@ import type { ButtonRootProps } from '../button/button.types';
 export interface CloseButtonIconProps {
   /**
    * Size of the icon
-   * @default 16
+   * @default 18
    */
   size?: number;
   /**
    * Color of the icon
-   * @default Uses theme foreground color
+   * @default Uses theme muted color
    */
   color?: string;
 }
```

---

### Incident Patch 2: `8274a31f` (2026-09-21)
**Commit Message**: fix(input): update input styles to remove outline width for iOS

**File**: `src/components/input/input.styles.ts` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ const background = tv({
  * explicitly aligned to the trailing side in RTL layouts.
  */
 const input = tv({
-  base: 'input__input ios:outline-2 ios:outline-transparent ios:focus:outline-accent android:border-[1.5px] android:border-transparent android:focus:border-accent rtl:text-right',
+  base: 'input__input ios:outline ios:outline-transparent ios:focus:outline-accent android:border-[1.5px] android:border-transparent android:focus:border-accent rtl:text-right',
   variants: {
     variant: {
       primary:
```

---

### Incident Patch 3: `c966d446` (2026-09-21)
**Commit Message**: Merge pull request #499 from heroui-inc/fix/text-input-ref

fix(input): type refs as native TextInput instance

**File**: `src/__tests__/input-ref.types.ts` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+/**
+ * Compile-time check that Input accepts a native text input instance ref.
+ *
+ * `React.ComponentRef<typeof TextInput>` is `TextInput` on the legacy RN
+ * types and `TextInputInstance` under the Strict TypeScript API (0.87+).
+ * This file is typechecked by `yarn typecheck`; it is not a Jest test.
+ */
+import { createElement, createRef } from 'react';
+import { TextInput } from 'react-native';
+import { Input, type InputRef } from '../components/input';
+import { InputGroup } from '../components/input-group';
+import { SearchField } from '../components/search-field';
+import { TextArea, type TextAreaRef } from '../components/text-area';
+
+type NativeTextInputRef = React.ComponentRef<typeof TextInput>;
+
+type AssertEqual<A, B> =
+  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
+    ? true
+    : never;
+
+export const assertInputRef: AssertEqual<InputRef, NativeTextInputRef> = true;
+export const assertTextAreaRef: AssertEqual<TextAreaRef, NativeTextInputRef> =
+  true;
+
+const nativeInputRef = createRef<NativeTextInputRef>();
+
+createElement(Input, { ref: nativeInputRef });
+createElement(TextArea, { ref: nativeInputRef });
+createElement(SearchField.Input, { ref: nativeInputRef });
+createElement(InputGroup.Input, { ref: nativeInputRef });
```

**File**: `src/components/input-group/input-group.tsx` (modified, +3/-7)
```diff
@@ -1,16 +1,12 @@
 import { forwardRef, useCallback, useMemo, useState } from 'react';
-import {
-  type LayoutChangeEvent,
-  type TextInput as TextInputType,
-  View,
-} from 'react-native';
+import { type LayoutChangeEvent, View } from 'react-native';
 import {
   AnimationSettingsProvider,
   useFormField,
 } from '../../helpers/internal/contexts';
 import type { ViewRef } from '../../helpers/internal/types';
 import { createContext } from '../../helpers/internal/utils';
-import { Input } from '../input';
+import { Input, type InputRef } from '../input';
 import { useInputGroupRootAnimation } from './input-group.animation';
 import { DISPLAY_NAME } from './input-group.constants';
 import { inputGroupClassNames } from './input-group.styles';
@@ -161,7 +157,7 @@ const InputGroupSuffix = forwardRef<ViewRef, InputGroupSuffixProps>(
 
 // --------------------------------------------------
 
-const InputGroupInput = forwardRef<TextInputType, InputGroupInputProps>(
+const InputGroupInput = forwardRef<InputRef, InputGroupInputProps>(
   (props, ref) => {
     const { style, isDisabled: localIsDisabled, ...restProps } = props;
 
```

**File**: `src/components/input/index.ts` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 export { default as Input } from './input';
 export { inputClassNames } from './input.styles';
-export type { InputBackgroundProps, InputProps } from './input.types';
+export type { InputBackgroundProps, InputProps, InputRef } from './input.types';
```

**File**: `src/components/input/input.tsx` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 import { forwardRef } from 'react';
-import { View, type TextInput as TextInputType } from 'react-native';
+import { View } from 'react-native';
 import { useIsOnSurface } from '../../helpers/external/hooks';
 import { cn } from '../../helpers/external/utils';
 import {
@@ -10,7 +10,7 @@ import {
 import { useFormField } from '../../helpers/internal/contexts';
 import { DISPLAY_NAME } from './input.constants';
 import { inputClassNames, inputStyleSheet } from './input.styles';
-import type { InputBackgroundProps, InputProps } from './input.types';
+import type { InputBackgroundProps, InputProps, InputRef } from './input.types';
 
 // --------------------------------------------------
 
@@ -38,7 +38,7 @@ const InputBackground = forwardRef<View, InputBackgroundProps>(
 
 // --------------------------------------------------
 
-const InputRoot = forwardRef<TextInputType, InputProps>((props, ref) => {
+const InputRoot = forwardRef<InputRef, InputProps>((props, ref) => {
   const {
     isInvalid: localIsInvalid,
     isDisabled: localIsDisabled,
```

**File**: `src/components/input/input.types.ts` (modified, +9/-0)
```diff
@@ -1,6 +1,7 @@
 import type { ReactNode } from 'react';
 import type { TextInputProps, ViewProps } from 'react-native';
 import type { ThemeColor } from '../../helpers/external/hooks';
+import type { TextInputRef } from '../../helpers/internal/types';
 
 /**
  * Props for the Input.Background sub-component.
@@ -73,3 +74,11 @@ export interface InputProps extends TextInputProps {
    */
   placeholderColorClassName?: string;
 }
+
+/**
+ * Reference type for the Input component.
+ * Resolves to the native text input instance (`TextInputInstance` under
+ * React Native's Strict TypeScript API), so refs can call `.focus()`,
+ * `.blur()`, `.clear()`, and other instance methods.
+ */
+export type InputRef = TextInputRef;
```

**File**: `src/components/search-field/search-field.tsx` (modified, +3/-7)
```diff
@@ -1,9 +1,5 @@
 import { forwardRef, useLayoutEffect, useMemo, useState } from 'react';
-import {
-  type GestureResponderEvent,
-  type TextInput as TextInputType,
-  View,
-} from 'react-native';
+import { type GestureResponderEvent, View } from 'react-native';
 import { useThemeColor } from '../../helpers/external/hooks';
 import { CloseIcon } from '../../helpers/internal/components';
 import {
@@ -13,7 +9,7 @@ import {
 import type { ViewRef } from '../../helpers/internal/types';
 import { createContext } from '../../helpers/internal/utils';
 import { Button } from '../button';
-import { Input } from '../input';
+import { Input, type InputRef } from '../input';
 import { useSearchFieldRootAnimation } from './search-field.animation';
 import { DISPLAY_NAME } from './search-field.constants';
 import { searchFieldClassNames } from './search-field.styles';
@@ -177,7 +173,7 @@ const SearchFieldSearchIcon = forwardRef<View, SearchFieldSearchIconProps>(
 
 // --------------------------------------------------
 
-const SearchFieldInput = forwardRef<TextInputType, SearchFieldInputProps>(
+const SearchFieldInput = forwardRef<InputRef, SearchFieldInputProps>(
   (props, ref) => {
     const {
       className,
```

**File**: `src/components/text-area/index.ts` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 export { default as TextArea } from './text-area';
 export { textAreaClassNames } from './text-area.styles';
-export type { TextAreaProps } from './text-area.types';
+export type { TextAreaProps, TextAreaRef } from './text-area.types';
```

**File**: `src/components/text-area/text-area.tsx` (modified, +2/-3)
```diff
@@ -1,13 +1,12 @@
 import { forwardRef } from 'react';
-import { type TextInput as TextInputType } from 'react-native';
 import Input from '../input/input';
 import { DISPLAY_NAME } from './text-area.constants';
 import { textAreaClassNames } from './text-area.styles';
-import type { TextAreaProps } from './text-area.types';
+import type { TextAreaProps, TextAreaRef } from './text-area.types';
 
 // --------------------------------------------------
 
-const TextAreaRoot = forwardRef<TextInputType, TextAreaProps>((props, ref) => {
+const TextAreaRoot = forwardRef<TextAreaRef, TextAreaProps>((props, ref) => {
   const {
     multiline = true,
     textAlignVertical = 'top',
```

---

### Incident Patch 4: `cae9dd8f` (2026-09-21)
**Commit Message**: Merge pull request #498 from heroui-inc/fix/bottom-sheet-android

fix(bottom-sheet): hide closed sheet handle peek on Android

**File**: `example/package.json` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@
     "tailwind-merge": "^3.6.0",
     "tailwind-variants": "^3.2.2",
     "tailwindcss": "^4.3.2",
-    "uniwind": "^1.10.0"
+    "uniwind": "1.12.0"
   },
   "devDependencies": {
     "@babel/core": "^7.29.0",
```

**File**: `example/src/app/_layout.tsx` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@ export default function Layout() {
 
   return (
     <GestureHandlerRootView style={styles.root}>
-      <KeyboardProvider>
+      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
         <AppLocaleProvider>
           <AppContent />
         </AppLocaleProvider>
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@
     "tailwind-variants": "^3.2.2",
     "tailwindcss": "^4.3.2",
     "typescript": "^5.8.3",
-    "uniwind": "^1.10.0"
+    "uniwind": "1.12.0"
   },
   "peerDependencies": {
     "@gorhom/bottom-sheet": "^5.2.9",
```

**File**: `src/helpers/internal/components/bottom-sheet-content-container.tsx` (modified, +11/-2)
```diff
@@ -98,7 +98,17 @@ export function BottomSheetContentContainer({
    * inside the new container, so the sheet shows up again even though `isOpen`
    * is still `false`, which leaves it unreachable through the overlay.
    *
-   * An idle sheet is moved on the spot, in the same frame the resize lands, so
+   * The same mismatch happens on the first layout on Android. Gorhom parks a
+   * closed sheet at `Dimensions.get('window').height` ([#2747](https://github.com/gorhom/react-native-bottom-sheet/issues/2747),
+   * [#329](https://github.com/gorhom/react-native-bottom-sheet/issues/329)). On
+   * devices where `window` excludes the status bar and/or the nav bar — Samsung
+   * edge-to-edge, 3-button navigation, translucent status bars — that value is
+   * shorter than the measured container, so the handle peeks above the bottom
+   * edge until something animates the sheet. Skipping the first
+   * `closedDetentPosition` (when `previous` is still `undefined`) is exactly
+   * the frame that needs the correction.
+   *
+   * An idle sheet is moved on the spot, in the same frame the layout lands, so
    * the stale offset is never painted. Hopping to the JS thread to close it
    * instead costs a couple of frames, which is long enough to flash the sheet
    * on screen. A close that is still animating owns the position, so that one
@@ -110,7 +120,6 @@ export function BottomSheetContentContainer({
       if (
         isOpen ||
         closedPosition === undefined ||
-        previousClosedPosition === undefined ||
         closedPosition === previousClosedPosition
       ) {
         return;
```

**File**: `src/helpers/internal/components/bottom-sheet-content.tsx` (modified, +15/-9)
```diff
@@ -179,20 +179,26 @@ export const BottomSheetContent = forwardRef<
     useAnimatedReaction(
       () => progress.get(),
       (value) => {
-        // 0 and 2 are the two resting points of a closed sheet.
-        if (!isOpen && (value === 0 || value === 2)) {
+        /**
+         * 0 and 2 are the two resting points of a closed sheet. Compare with
+         * a small epsilon: on Android a closed sheet can sit slightly above
+         * index `-1` when gorhom's initial `window.height` is shorter than
+         * the container, so progress never lands on exactly `0` or `2` and
+         * the peek would stay painted.
+         */
+        if (!isOpen && (value <= 0.01 || value >= 1.99)) {
           scheduleOnRN(setIsDismissed, true);
         }
       },
       [isOpen, progress]
     );
 
     /**
-     * Snapping the sheet through its ref opens it without going through
-     * `isOpen`, so the open state alone is not enough to tell whether the
-     * sheet is meant to be seen. A resize leaves a dismissed sheet where it
-     * is rather than animating it, so reacting to the animation keeps those
-     * two apart.
+     * Reveal the sheet only when our open state says it should be seen.
+     * Gorhom can fire `onAnimate` to a snap index `>= 0` on its own — dynamic
+     * sizing and the `window` vs container height mismatch both do this while
+     * `isOpen` is still `false` — and treating that as a real open would
+     * un-hide a closed sheet so its handle peeks at the bottom of the screen.
      */
     const onAnimate = restProps.onAnimate;
     const handleAnimate = useCallback(
@@ -202,13 +208,13 @@ export const BottomSheetContent = forwardRef<
         fromPosition: number,
         toPosition: number
       ) => {
-        if (toIndex >= 0) {
+        if (toIndex >= 0 && isOpen) {
           setIsDismissed(false);
         }
 
         onAnimate?.(fromIndex, toIndex, fromPosition, toPosition);
       },
-      [onAnimate]
+      [isOpen, onAnimate]
     );
 
     const containerStyle = useMemo(
```

**File**: `yarn.lock` (modified, +101/-101)
```diff
@@ -2615,31 +2615,31 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@emnapi/core@npm:^1.10.0":
-  version: 1.11.1
-  resolution: "@emnapi/core@npm:1.11.1"
+"@emnapi/core@npm:^1.11.1":
+  version: 1.11.3
+  resolution: "@emnapi/core@npm:1.11.3"
   dependencies:
-    "@emnapi/wasi-threads": 1.2.2
+    "@emnapi/wasi-threads": 1.2.3
     tslib: ^2.4.0
-  checksum: 3d86058b236210b6a892bd1bbd7ff5a1665b5856e5429ba85e926c2713ff8050bd211dc5fe5275a13cba0f2ef54ac5d5152f91cd56a7ebdbd22a5865f85647ee
+  checksum: 2c1df28b4dd441ec5abeeee9787a088a104de5508edf147c38bbf7c6408d89ccfdfcdb014d9e40e7be5328d8832331b0fdbdba200bdf51c2e26436e731b5261c
   languageName: node
   linkType: hard
 
-"@emnapi/runtime@npm:^1.10.0":
-  version: 1.11.1
-  resolution: "@emnapi/runtime@npm:1.11.1"
+"@emnapi/runtime@npm:^1.11.1":
+  version: 1.11.3
+  resolution: "@emnapi/runtime@npm:1.11.3"
   dependencies:
     tslib: ^2.4.0
-  checksum: d00f25faca4d30ab09e64a8674bd44adec3805b3c99fe7de45d9f1ecd7dcbdec4a8e0d19d06cfa837a6f3f383eb92186106fa67ef13a1b8951a7f898718e7bf2
+  checksum: 844b828dee5318f3645d7eb673e59e527e552483d8caa42afe420753363c6ff2599718100a456483d589dff4f1f3cf1c66010d80b11154c899ebf68fd40fc359
   languageName: node
   linkType: hard
 
-"@emnapi/wasi-threads@npm:1.2.2, @emnapi/wasi-threads@npm:^1.2.1":
-  version: 1.2.2
-  resolution: "@emnapi/wasi-threads@npm:1.2.2"
+"@emnapi/wasi-threads@npm:1.2.3, @emnapi/wasi-threads@npm:^1.2.2":
+  version: 1.2.3
+  resolution: "@emnapi/wasi-threads@npm:1.2.3"
   dependencies:
     tslib: ^2.4.0
-  checksum: 6cb1a1ddd1902c2bb8ec09090afa0e950f21b2801a38903d33b29ec8223c03e7862e820dc2807842e8dea0575421641fabbde4fd4fabecf8d176d443794e5f72
+  checksum: 764a16312b0b63a274be96538662d2cb13c33a91b2357e198f5ce6cbae00742e21fbe067f650084e3e360858db12270ee9f2426fc96e9f3b25b9407c746db2cd
   languageName: node
   linkType: hard
 
@@ -5174,128 +5174,128 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@tailwindcss/node@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/node@npm:4.3.0"
+"@tailwindcss/node@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/node@npm:4.3.3"
   dependencies:
     "@jridgewell/remapping": ^2.3.5
-    enhanced-resolve: ^5.21.0
-    jiti: ^2.6.1
+    enhanced-resolve: ^5.24.1
+    jiti: ^2.7.0
     lightningcss: 1.32.0
     magic-string: ^0.30.21
     source-map-js: ^1.2.1
-    tailwindcss: 4.3.0
-  checksum: 9141fb0f45814c7d9b0c71653971201e2af2358df1294877e292198eb4c2f55de304bd9573706348eceba5d079b9618f1c1b36d8e39bbca53e88c12aeff74a33
+    tailwindcss: 4.3.3
+  checksum: fe10ab88574d14e2369d6c37c4e4a04d634628a4e508c70f44e663537a1f95b21bbd7f995ad1a700914274a6d7c0e09ee6bf446a604919980051106b4f759943
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-android-arm64@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-android-arm64@npm:4.3.0"
+"@tailwindcss/oxide-android-arm64@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-android-arm64@npm:4.3.3"
   conditions: os=android & cpu=arm64
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-darwin-arm64@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-darwin-arm64@npm:4.3.0"
+"@tailwindcss/oxide-darwin-arm64@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-darwin-arm64@npm:4.3.3"
   conditions: os=darwin & cpu=arm64
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-darwin-x64@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-darwin-x64@npm:4.3.0"
+"@tailwindcss/oxide-darwin-x64@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-darwin-x64@npm:4.3.3"
   conditions: os=darwin & cpu=x64
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-freebsd-x64@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-freebsd-x64@npm:4.3.0"
+"@tailwindcss/oxide-freebsd-x64@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-freebsd-x64@npm:4.3.3"
   conditions: os=freebsd & cpu=x64
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-linux-arm-gnueabihf@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-linux-arm-gnueabihf@npm:4.3.0"
+"@tailwindcss/oxide-linux-arm-gnueabihf@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-linux-arm-gnueabihf@npm:4.3.3"
   conditions: os=linux & cpu=arm
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-linux-arm64-gnu@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-linux-arm64-gnu@npm:4.3.0"
+"@tailwindcss/oxide-linux-arm64-gnu@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-linux-arm64-gnu@npm:4.3.3"
   conditions: os=linux & cpu=arm64 & libc=glibc
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-linux-arm64-musl@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-linux-arm64-musl@npm:4.3.0"
+"@tailwindcss/oxide-linux-arm64-musl@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-linux-arm64-musl@npm:4.3.3"
  
```

---

### Incident Patch 5: `4cea6881` (2026-09-21)
**Commit Message**: fix(bottom-sheet): enhance handling of closed sheet visibility and animation during layout changes

**File**: `example/package.json` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@
     "tailwind-merge": "^3.6.0",
     "tailwind-variants": "^3.2.2",
     "tailwindcss": "^4.3.2",
-    "uniwind": "^1.10.0"
+    "uniwind": "1.12.0"
   },
   "devDependencies": {
     "@babel/core": "^7.29.0",
```

**File**: `example/src/app/_layout.tsx` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@ export default function Layout() {
 
   return (
     <GestureHandlerRootView style={styles.root}>
-      <KeyboardProvider>
+      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
         <AppLocaleProvider>
           <AppContent />
         </AppLocaleProvider>
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -108,7 +108,7 @@
     "tailwind-variants": "^3.2.2",
     "tailwindcss": "^4.3.2",
     "typescript": "^5.8.3",
-    "uniwind": "^1.10.0"
+    "uniwind": "1.12.0"
   },
   "peerDependencies": {
     "@gorhom/bottom-sheet": "^5.2.9",
```

**File**: `src/helpers/internal/components/bottom-sheet-content-container.tsx` (modified, +11/-2)
```diff
@@ -98,7 +98,17 @@ export function BottomSheetContentContainer({
    * inside the new container, so the sheet shows up again even though `isOpen`
    * is still `false`, which leaves it unreachable through the overlay.
    *
-   * An idle sheet is moved on the spot, in the same frame the resize lands, so
+   * The same mismatch happens on the first layout on Android. Gorhom parks a
+   * closed sheet at `Dimensions.get('window').height` ([#2747](https://github.com/gorhom/react-native-bottom-sheet/issues/2747),
+   * [#329](https://github.com/gorhom/react-native-bottom-sheet/issues/329)). On
+   * devices where `window` excludes the status bar and/or the nav bar — Samsung
+   * edge-to-edge, 3-button navigation, translucent status bars — that value is
+   * shorter than the measured container, so the handle peeks above the bottom
+   * edge until something animates the sheet. Skipping the first
+   * `closedDetentPosition` (when `previous` is still `undefined`) is exactly
+   * the frame that needs the correction.
+   *
+   * An idle sheet is moved on the spot, in the same frame the layout lands, so
    * the stale offset is never painted. Hopping to the JS thread to close it
    * instead costs a couple of frames, which is long enough to flash the sheet
    * on screen. A close that is still animating owns the position, so that one
@@ -110,7 +120,6 @@ export function BottomSheetContentContainer({
       if (
         isOpen ||
         closedPosition === undefined ||
-        previousClosedPosition === undefined ||
         closedPosition === previousClosedPosition
       ) {
         return;
```

**File**: `src/helpers/internal/components/bottom-sheet-content.tsx` (modified, +15/-9)
```diff
@@ -179,20 +179,26 @@ export const BottomSheetContent = forwardRef<
     useAnimatedReaction(
       () => progress.get(),
       (value) => {
-        // 0 and 2 are the two resting points of a closed sheet.
-        if (!isOpen && (value === 0 || value === 2)) {
+        /**
+         * 0 and 2 are the two resting points of a closed sheet. Compare with
+         * a small epsilon: on Android a closed sheet can sit slightly above
+         * index `-1` when gorhom's initial `window.height` is shorter than
+         * the container, so progress never lands on exactly `0` or `2` and
+         * the peek would stay painted.
+         */
+        if (!isOpen && (value <= 0.01 || value >= 1.99)) {
           scheduleOnRN(setIsDismissed, true);
         }
       },
       [isOpen, progress]
     );
 
     /**
-     * Snapping the sheet through its ref opens it without going through
-     * `isOpen`, so the open state alone is not enough to tell whether the
-     * sheet is meant to be seen. A resize leaves a dismissed sheet where it
-     * is rather than animating it, so reacting to the animation keeps those
-     * two apart.
+     * Reveal the sheet only when our open state says it should be seen.
+     * Gorhom can fire `onAnimate` to a snap index `>= 0` on its own — dynamic
+     * sizing and the `window` vs container height mismatch both do this while
+     * `isOpen` is still `false` — and treating that as a real open would
+     * un-hide a closed sheet so its handle peeks at the bottom of the screen.
      */
     const onAnimate = restProps.onAnimate;
     const handleAnimate = useCallback(
@@ -202,13 +208,13 @@ export const BottomSheetContent = forwardRef<
         fromPosition: number,
         toPosition: number
       ) => {
-        if (toIndex >= 0) {
+        if (toIndex >= 0 && isOpen) {
           setIsDismissed(false);
         }
 
         onAnimate?.(fromIndex, toIndex, fromPosition, toPosition);
       },
-      [onAnimate]
+      [isOpen, onAnimate]
     );
 
     const containerStyle = useMemo(
```

**File**: `yarn.lock` (modified, +101/-101)
```diff
@@ -2615,31 +2615,31 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@emnapi/core@npm:^1.10.0":
-  version: 1.11.1
-  resolution: "@emnapi/core@npm:1.11.1"
+"@emnapi/core@npm:^1.11.1":
+  version: 1.11.3
+  resolution: "@emnapi/core@npm:1.11.3"
   dependencies:
-    "@emnapi/wasi-threads": 1.2.2
+    "@emnapi/wasi-threads": 1.2.3
     tslib: ^2.4.0
-  checksum: 3d86058b236210b6a892bd1bbd7ff5a1665b5856e5429ba85e926c2713ff8050bd211dc5fe5275a13cba0f2ef54ac5d5152f91cd56a7ebdbd22a5865f85647ee
+  checksum: 2c1df28b4dd441ec5abeeee9787a088a104de5508edf147c38bbf7c6408d89ccfdfcdb014d9e40e7be5328d8832331b0fdbdba200bdf51c2e26436e731b5261c
   languageName: node
   linkType: hard
 
-"@emnapi/runtime@npm:^1.10.0":
-  version: 1.11.1
-  resolution: "@emnapi/runtime@npm:1.11.1"
+"@emnapi/runtime@npm:^1.11.1":
+  version: 1.11.3
+  resolution: "@emnapi/runtime@npm:1.11.3"
   dependencies:
     tslib: ^2.4.0
-  checksum: d00f25faca4d30ab09e64a8674bd44adec3805b3c99fe7de45d9f1ecd7dcbdec4a8e0d19d06cfa837a6f3f383eb92186106fa67ef13a1b8951a7f898718e7bf2
+  checksum: 844b828dee5318f3645d7eb673e59e527e552483d8caa42afe420753363c6ff2599718100a456483d589dff4f1f3cf1c66010d80b11154c899ebf68fd40fc359
   languageName: node
   linkType: hard
 
-"@emnapi/wasi-threads@npm:1.2.2, @emnapi/wasi-threads@npm:^1.2.1":
-  version: 1.2.2
-  resolution: "@emnapi/wasi-threads@npm:1.2.2"
+"@emnapi/wasi-threads@npm:1.2.3, @emnapi/wasi-threads@npm:^1.2.2":
+  version: 1.2.3
+  resolution: "@emnapi/wasi-threads@npm:1.2.3"
   dependencies:
     tslib: ^2.4.0
-  checksum: 6cb1a1ddd1902c2bb8ec09090afa0e950f21b2801a38903d33b29ec8223c03e7862e820dc2807842e8dea0575421641fabbde4fd4fabecf8d176d443794e5f72
+  checksum: 764a16312b0b63a274be96538662d2cb13c33a91b2357e198f5ce6cbae00742e21fbe067f650084e3e360858db12270ee9f2426fc96e9f3b25b9407c746db2cd
   languageName: node
   linkType: hard
 
@@ -5174,128 +5174,128 @@ __metadata:
   languageName: node
   linkType: hard
 
-"@tailwindcss/node@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/node@npm:4.3.0"
+"@tailwindcss/node@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/node@npm:4.3.3"
   dependencies:
     "@jridgewell/remapping": ^2.3.5
-    enhanced-resolve: ^5.21.0
-    jiti: ^2.6.1
+    enhanced-resolve: ^5.24.1
+    jiti: ^2.7.0
     lightningcss: 1.32.0
     magic-string: ^0.30.21
     source-map-js: ^1.2.1
-    tailwindcss: 4.3.0
-  checksum: 9141fb0f45814c7d9b0c71653971201e2af2358df1294877e292198eb4c2f55de304bd9573706348eceba5d079b9618f1c1b36d8e39bbca53e88c12aeff74a33
+    tailwindcss: 4.3.3
+  checksum: fe10ab88574d14e2369d6c37c4e4a04d634628a4e508c70f44e663537a1f95b21bbd7f995ad1a700914274a6d7c0e09ee6bf446a604919980051106b4f759943
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-android-arm64@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-android-arm64@npm:4.3.0"
+"@tailwindcss/oxide-android-arm64@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-android-arm64@npm:4.3.3"
   conditions: os=android & cpu=arm64
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-darwin-arm64@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-darwin-arm64@npm:4.3.0"
+"@tailwindcss/oxide-darwin-arm64@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-darwin-arm64@npm:4.3.3"
   conditions: os=darwin & cpu=arm64
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-darwin-x64@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-darwin-x64@npm:4.3.0"
+"@tailwindcss/oxide-darwin-x64@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-darwin-x64@npm:4.3.3"
   conditions: os=darwin & cpu=x64
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-freebsd-x64@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-freebsd-x64@npm:4.3.0"
+"@tailwindcss/oxide-freebsd-x64@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-freebsd-x64@npm:4.3.3"
   conditions: os=freebsd & cpu=x64
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-linux-arm-gnueabihf@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-linux-arm-gnueabihf@npm:4.3.0"
+"@tailwindcss/oxide-linux-arm-gnueabihf@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-linux-arm-gnueabihf@npm:4.3.3"
   conditions: os=linux & cpu=arm
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-linux-arm64-gnu@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-linux-arm64-gnu@npm:4.3.0"
+"@tailwindcss/oxide-linux-arm64-gnu@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-linux-arm64-gnu@npm:4.3.3"
   conditions: os=linux & cpu=arm64 & libc=glibc
   languageName: node
   linkType: hard
 
-"@tailwindcss/oxide-linux-arm64-musl@npm:4.3.0":
-  version: 4.3.0
-  resolution: "@tailwindcss/oxide-linux-arm64-musl@npm:4.3.0"
+"@tailwindcss/oxide-linux-arm64-musl@npm:4.3.3":
+  version: 4.3.3
+  resolution: "@tailwindcss/oxide-linux-arm64-musl@npm:4.3.3"
  
```

---

### Incident Patch 6: `7488dd4b` (2026-09-18)
**Commit Message**: Merge pull request #496 from heroui-inc/fix/bottom-sheet-landscape

fix(bottom-sheet): hide dismissed sheet during container resize

**File**: `src/helpers/internal/components/bottom-sheet-content-container.tsx` (modified, +61/-1)
```diff
@@ -1,4 +1,4 @@
-import { useEffect, useRef } from 'react';
+import { useCallback, useEffect, useRef } from 'react';
 import { BackHandler } from 'react-native';
 import { useAnimatedReaction } from 'react-native-reanimated';
 import { scheduleOnRN } from 'react-native-worklets';
@@ -7,6 +7,14 @@ import type { BottomSheetContentContainerProps } from '../types/bottom-sheet';
 
 const BottomSheetView = GorhomBottomSheetPackage?.BottomSheetView;
 const useBottomSheet = GorhomBottomSheetPackage?.useBottomSheet;
+const useBottomSheetInternal = GorhomBottomSheetPackage?.useBottomSheetInternal;
+
+/**
+ * `ANIMATION_STATUS.RUNNING` read eagerly: worklets can capture the plain
+ * value, but not the enum object behind the optional package import.
+ */
+const ANIMATION_STATUS_RUNNING: number =
+  GorhomBottomSheetPackage?.ANIMATION_STATUS?.RUNNING ?? 1;
 
 /**
  * Reusable BottomSheetContentContainer component
@@ -30,6 +38,8 @@ export function BottomSheetContentContainer({
   enablePanDownToClose,
 }: BottomSheetContentContainerProps) {
   const { close, snapToIndex } = useBottomSheet();
+  const { animatedAnimationState, animatedDetentsState, animatedPosition } =
+    useBottomSheetInternal();
   const prevIsOpenRef = useRef(isOpen);
 
   const closeBottomSheet = () => {
@@ -72,6 +82,56 @@ export function BottomSheetContentContainer({
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isOpen, enablePanDownToClose]);
 
+  /**
+   * Retargets a close that is still animating when the container is resized.
+   * The zero duration keeps the sheet in step with the resize instead of
+   * sliding away afterwards.
+   */
+  const realignDismissedSheet = useCallback(() => {
+    close({ duration: 0 });
+  }, [close]);
+
+  /**
+   * A dismissed sheet rests at the offset it was closed at, and that offset is
+   * only recalculated while the sheet sits at a snap point. Once the container
+   * is resized — device rotation, iPad split view — the stale offset can land
+   * inside the new container, so the sheet shows up again even though `isOpen`
+   * is still `false`, which leaves it unreachable through the overlay.
+   *
+   * An idle sheet is moved on the spot, in the same frame the resize lands, so
+   * the stale offset is never painted. Hopping to the JS thread to close it
+   * instead costs a couple of frames, which is long enough to flash the sheet
+   * on screen. A close that is still animating owns the position, so that one
+   * is retargeted through the public method rather than overwritten.
+   */
+  useAnimatedReaction(
+    () => animatedDetentsState.get().closedDetentPosition,
+    (closedPosition, previousClosedPosition) => {
+      if (
+        isOpen ||
+        closedPosition === undefined ||
+        previousClosedPosition === undefined ||
+        closedPosition === previousClosedPosition
+      ) {
+        return;
+      }
+
+      if (animatedAnimationState.get().status === ANIMATION_STATUS_RUNNING) {
+        scheduleOnRN(realignDismissedSheet);
+        return;
+      }
+
+      animatedPosition.set(closedPosition);
+    },
+    [
+      isOpen,
+      animatedAnimationState,
+      animatedDetentsState,
+      animatedPosition,
+      realignDismissedSheet,
+    ]
+  );
+
   useEffect(() => {
     const wasOpen = prevIsOpenRef.current;
     prevIsOpenRef.current = isOpen;
```

**File**: `src/helpers/internal/components/bottom-sheet-content.tsx` (modified, +80/-3)
```diff
@@ -3,11 +3,19 @@ import type {
   BottomSheetProps,
   BottomSheetBackgroundProps as GorhomBottomSheetBackgroundProps,
 } from '@gorhom/bottom-sheet';
-import { forwardRef, useMemo, type FC } from 'react';
+import {
+  forwardRef,
+  useCallback,
+  useEffect,
+  useMemo,
+  useState,
+  type FC,
+} from 'react';
 import type { StyleProp, ViewStyle } from 'react-native';
-import { View } from 'react-native';
+import { StyleSheet, View } from 'react-native';
 import type { SharedValue } from 'react-native-reanimated';
-import { ReduceMotion } from 'react-native-reanimated';
+import { ReduceMotion, useAnimatedReaction } from 'react-native-reanimated';
+import { scheduleOnRN } from 'react-native-worklets';
 import { withUniwind } from 'uniwind';
 import { useBottomSheetContentAnimation } from '../../../components/bottom-sheet/bottom-sheet.animation';
 import { DISPLAY_NAME as BOTTOM_SHEET_DISPLAY_NAME } from '../../../components/bottom-sheet/bottom-sheet.constants';
@@ -151,6 +159,66 @@ export const BottomSheetContent = forwardRef<
       animation,
     });
 
+    /**
+     * The sheet stays mounted for its whole lifetime, so a dismissed one is
+     * still rendered — parked below the container. iOS resizes the container
+     * a few frames before React Native reports the new size, and in that gap
+     * the sheet is painted at the offset the previous size parked it at, which
+     * flashes it on screen mid-rotation. Taking a dismissed sheet out of the
+     * paint entirely closes that gap: it is only ever hidden while it is
+     * already meant to be invisible.
+     */
+    const [isDismissed, setIsDismissed] = useState(!isOpen);
+
+    useEffect(() => {
+      if (isOpen) {
+        setIsDismissed(false);
+      }
+    }, [isOpen]);
+
+    useAnimatedReaction(
+      () => progress.get(),
+      (value) => {
+        // 0 and 2 are the two resting points of a closed sheet.
+        if (!isOpen && (value === 0 || value === 2)) {
+          scheduleOnRN(setIsDismissed, true);
+        }
+      },
+      [isOpen, progress]
+    );
+
+    /**
+     * Snapping the sheet through its ref opens it without going through
+     * `isOpen`, so the open state alone is not enough to tell whether the
+     * sheet is meant to be seen. A resize leaves a dismissed sheet where it
+     * is rather than animating it, so reacting to the animation keeps those
+     * two apart.
+     */
+    const onAnimate = restProps.onAnimate;
+    const handleAnimate = useCallback(
+      (
+        fromIndex: number,
+        toIndex: number,
+        fromPosition: number,
+        toPosition: number
+      ) => {
+        if (toIndex >= 0) {
+          setIsDismissed(false);
+        }
+
+        onAnimate?.(fromIndex, toIndex, fromPosition, toPosition);
+      },
+      [onAnimate]
+    );
+
+    const containerStyle = useMemo(
+      () => [
+        restProps.containerStyle,
+        isDismissed && styles.dismissedContainer,
+      ],
+      [restProps.containerStyle, isDismissed]
+    );
+
     /**
      * Theme-aware background layer support: render the default background
      * component unless the caller provides their own `backgroundComponent`.
@@ -205,6 +273,8 @@ export const BottomSheetContent = forwardRef<
           gestureEventsHandlersHook={useBottomSheetGestureHandlers}
           {...restProps}
           backgroundComponent={backgroundComponent}
+          containerStyle={containerStyle}
+          onAnimate={handleAnimate}
         >
           <BottomSheetContentContainer
             initialIndex={initialIndex ?? 0}
@@ -227,3 +297,10 @@ export const BottomSheetContent = forwardRef<
 );
 
 BottomSheetContent.displayName = 'HeroUINative.BottomSheetContent';
+
+const styles = StyleSheet.create({
+  dismissedContainer: {
+    opacity: 0,
+    pointerEvents: 'none',
+  },
+});
```

---

### Incident Patch 7: `56c3e1a9` (2026-09-18)
**Commit Message**: fix(bottom-sheet): improve handling of dismissed state and animation during container resize

**File**: `src/helpers/internal/components/bottom-sheet-content-container.tsx` (modified, +61/-1)
```diff
@@ -1,4 +1,4 @@
-import { useEffect, useRef } from 'react';
+import { useCallback, useEffect, useRef } from 'react';
 import { BackHandler } from 'react-native';
 import { useAnimatedReaction } from 'react-native-reanimated';
 import { scheduleOnRN } from 'react-native-worklets';
@@ -7,6 +7,14 @@ import type { BottomSheetContentContainerProps } from '../types/bottom-sheet';
 
 const BottomSheetView = GorhomBottomSheetPackage?.BottomSheetView;
 const useBottomSheet = GorhomBottomSheetPackage?.useBottomSheet;
+const useBottomSheetInternal = GorhomBottomSheetPackage?.useBottomSheetInternal;
+
+/**
+ * `ANIMATION_STATUS.RUNNING` read eagerly: worklets can capture the plain
+ * value, but not the enum object behind the optional package import.
+ */
+const ANIMATION_STATUS_RUNNING: number =
+  GorhomBottomSheetPackage?.ANIMATION_STATUS?.RUNNING ?? 1;
 
 /**
  * Reusable BottomSheetContentContainer component
@@ -30,6 +38,8 @@ export function BottomSheetContentContainer({
   enablePanDownToClose,
 }: BottomSheetContentContainerProps) {
   const { close, snapToIndex } = useBottomSheet();
+  const { animatedAnimationState, animatedDetentsState, animatedPosition } =
+    useBottomSheetInternal();
   const prevIsOpenRef = useRef(isOpen);
 
   const closeBottomSheet = () => {
@@ -72,6 +82,56 @@ export function BottomSheetContentContainer({
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isOpen, enablePanDownToClose]);
 
+  /**
+   * Retargets a close that is still animating when the container is resized.
+   * The zero duration keeps the sheet in step with the resize instead of
+   * sliding away afterwards.
+   */
+  const realignDismissedSheet = useCallback(() => {
+    close({ duration: 0 });
+  }, [close]);
+
+  /**
+   * A dismissed sheet rests at the offset it was closed at, and that offset is
+   * only recalculated while the sheet sits at a snap point. Once the container
+   * is resized — device rotation, iPad split view — the stale offset can land
+   * inside the new container, so the sheet shows up again even though `isOpen`
+   * is still `false`, which leaves it unreachable through the overlay.
+   *
+   * An idle sheet is moved on the spot, in the same frame the resize lands, so
+   * the stale offset is never painted. Hopping to the JS thread to close it
+   * instead costs a couple of frames, which is long enough to flash the sheet
+   * on screen. A close that is still animating owns the position, so that one
+   * is retargeted through the public method rather than overwritten.
+   */
+  useAnimatedReaction(
+    () => animatedDetentsState.get().closedDetentPosition,
+    (closedPosition, previousClosedPosition) => {
+      if (
+        isOpen ||
+        closedPosition === undefined ||
+        previousClosedPosition === undefined ||
+        closedPosition === previousClosedPosition
+      ) {
+        return;
+      }
+
+      if (animatedAnimationState.get().status === ANIMATION_STATUS_RUNNING) {
+        scheduleOnRN(realignDismissedSheet);
+        return;
+      }
+
+      animatedPosition.set(closedPosition);
+    },
+    [
+      isOpen,
+      animatedAnimationState,
+      animatedDetentsState,
+      animatedPosition,
+      realignDismissedSheet,
+    ]
+  );
+
   useEffect(() => {
     const wasOpen = prevIsOpenRef.current;
     prevIsOpenRef.current = isOpen;
```

**File**: `src/helpers/internal/components/bottom-sheet-content.tsx` (modified, +80/-3)
```diff
@@ -3,11 +3,19 @@ import type {
   BottomSheetProps,
   BottomSheetBackgroundProps as GorhomBottomSheetBackgroundProps,
 } from '@gorhom/bottom-sheet';
-import { forwardRef, useMemo, type FC } from 'react';
+import {
+  forwardRef,
+  useCallback,
+  useEffect,
+  useMemo,
+  useState,
+  type FC,
+} from 'react';
 import type { StyleProp, ViewStyle } from 'react-native';
-import { View } from 'react-native';
+import { StyleSheet, View } from 'react-native';
 import type { SharedValue } from 'react-native-reanimated';
-import { ReduceMotion } from 'react-native-reanimated';
+import { ReduceMotion, useAnimatedReaction } from 'react-native-reanimated';
+import { scheduleOnRN } from 'react-native-worklets';
 import { withUniwind } from 'uniwind';
 import { useBottomSheetContentAnimation } from '../../../components/bottom-sheet/bottom-sheet.animation';
 import { DISPLAY_NAME as BOTTOM_SHEET_DISPLAY_NAME } from '../../../components/bottom-sheet/bottom-sheet.constants';
@@ -151,6 +159,66 @@ export const BottomSheetContent = forwardRef<
       animation,
     });
 
+    /**
+     * The sheet stays mounted for its whole lifetime, so a dismissed one is
+     * still rendered — parked below the container. iOS resizes the container
+     * a few frames before React Native reports the new size, and in that gap
+     * the sheet is painted at the offset the previous size parked it at, which
+     * flashes it on screen mid-rotation. Taking a dismissed sheet out of the
+     * paint entirely closes that gap: it is only ever hidden while it is
+     * already meant to be invisible.
+     */
+    const [isDismissed, setIsDismissed] = useState(!isOpen);
+
+    useEffect(() => {
+      if (isOpen) {
+        setIsDismissed(false);
+      }
+    }, [isOpen]);
+
+    useAnimatedReaction(
+      () => progress.get(),
+      (value) => {
+        // 0 and 2 are the two resting points of a closed sheet.
+        if (!isOpen && (value === 0 || value === 2)) {
+          scheduleOnRN(setIsDismissed, true);
+        }
+      },
+      [isOpen, progress]
+    );
+
+    /**
+     * Snapping the sheet through its ref opens it without going through
+     * `isOpen`, so the open state alone is not enough to tell whether the
+     * sheet is meant to be seen. A resize leaves a dismissed sheet where it
+     * is rather than animating it, so reacting to the animation keeps those
+     * two apart.
+     */
+    const onAnimate = restProps.onAnimate;
+    const handleAnimate = useCallback(
+      (
+        fromIndex: number,
+        toIndex: number,
+        fromPosition: number,
+        toPosition: number
+      ) => {
+        if (toIndex >= 0) {
+          setIsDismissed(false);
+        }
+
+        onAnimate?.(fromIndex, toIndex, fromPosition, toPosition);
+      },
+      [onAnimate]
+    );
+
+    const containerStyle = useMemo(
+      () => [
+        restProps.containerStyle,
+        isDismissed && styles.dismissedContainer,
+      ],
+      [restProps.containerStyle, isDismissed]
+    );
+
     /**
      * Theme-aware background layer support: render the default background
      * component unless the caller provides their own `backgroundComponent`.
@@ -205,6 +273,8 @@ export const BottomSheetContent = forwardRef<
           gestureEventsHandlersHook={useBottomSheetGestureHandlers}
           {...restProps}
           backgroundComponent={backgroundComponent}
+          containerStyle={containerStyle}
+          onAnimate={handleAnimate}
         >
           <BottomSheetContentContainer
             initialIndex={initialIndex ?? 0}
@@ -227,3 +297,10 @@ export const BottomSheetContent = forwardRef<
 );
 
 BottomSheetContent.displayName = 'HeroUINative.BottomSheetContent';
+
+const styles = StyleSheet.create({
+  dismissedContainer: {
+    opacity: 0,
+    pointerEvents: 'none',
+  },
+});
```

---

### Incident Patch 8: `2942f997` (2026-09-18)
**Commit Message**: Merge pull request #495 from heroui-inc/fix/skeleton-none

fix(skeleton): skip default FadeIn/FadeOut for variant="none"

**File**: `src/components/skeleton/skeleton.animation.ts` (modified, +26/-3)
```diff
@@ -51,7 +51,8 @@ export { SkeletonAnimationProvider, useSkeletonAnimation };
 
 /**
  * Animation hook for Skeleton root component
- * Handles entering/exiting animations, cascades animation disabled state, and manages progress animation
+ * Handles entering/exiting animations, cascades animation disabled state, and manages progress animation.
+ * `variant="none"` skips default FadeIn/FadeOut unless enter/exit is set explicitly.
  */
 export function useSkeletonRootAnimation(options: {
   animation: SkeletonRootAnimation | undefined;
@@ -122,6 +123,22 @@ export function useSkeletonRootAnimation(options: {
     defaultValue: FadeOut,
   });
 
+  /**
+   * `variant="none"` is a static bone. Skip the default FadeIn/FadeOut so
+   * lists do not pay layout-animation cost on every mount/recycle.
+   * Explicit `animation.entering` / `animation.exiting` still apply.
+   */
+  const hasExplicitEntering =
+    typeof animation === 'object' &&
+    animation !== null &&
+    'entering' in animation;
+  const hasExplicitExiting =
+    typeof animation === 'object' &&
+    animation !== null &&
+    'exiting' in animation;
+  const skipDefaultEntering = variant === 'none' && !hasExplicitEntering;
+  const skipDefaultExiting = variant === 'none' && !hasExplicitExiting;
+
   // Extract shimmer animation configuration for progress animation
   const shimmerDuration = getAnimationValueProperty({
     animationValue: shimmerAnimationConfig,
@@ -204,8 +221,14 @@ export function useSkeletonRootAnimation(options: {
 
   return {
     isAllAnimationsDisabled,
-    entering: isEnteringAnimationDisabledValue ? undefined : enteringValue,
-    exiting: isExitingAnimationDisabledValue ? undefined : exitingValue,
+    entering:
+      isEnteringAnimationDisabledValue || skipDefaultEntering
+        ? undefined
+        : enteringValue,
+    exiting:
+      isExitingAnimationDisabledValue || skipDefaultExiting
+        ? undefined
+        : exitingValue,
   };
 }
 
```

**File**: `src/components/skeleton/skeleton.types.ts` (modified, +4/-0)
```diff
@@ -111,6 +111,10 @@ export interface SkeletonProps extends AnimatedProps<ViewProps> {
   /**
    * Animation variant
    * @default 'shimmer'
+   *
+   * `none` is a static placeholder: no shimmer, pulse, or default
+   * FadeIn/FadeOut. Pass `animation.entering` / `animation.exiting` to
+   * opt back into enter/exit transitions.
    */
   variant?: SkeletonAnimation;
 
```

---

### Incident Patch 9: `d65da7ac` (2026-09-18)
**Commit Message**: fix(skeleton): enhance animation handling for variant="none" to skip default transitions

**File**: `src/components/skeleton/skeleton.animation.ts` (modified, +26/-3)
```diff
@@ -51,7 +51,8 @@ export { SkeletonAnimationProvider, useSkeletonAnimation };
 
 /**
  * Animation hook for Skeleton root component
- * Handles entering/exiting animations, cascades animation disabled state, and manages progress animation
+ * Handles entering/exiting animations, cascades animation disabled state, and manages progress animation.
+ * `variant="none"` skips default FadeIn/FadeOut unless enter/exit is set explicitly.
  */
 export function useSkeletonRootAnimation(options: {
   animation: SkeletonRootAnimation | undefined;
@@ -122,6 +123,22 @@ export function useSkeletonRootAnimation(options: {
     defaultValue: FadeOut,
   });
 
+  /**
+   * `variant="none"` is a static bone. Skip the default FadeIn/FadeOut so
+   * lists do not pay layout-animation cost on every mount/recycle.
+   * Explicit `animation.entering` / `animation.exiting` still apply.
+   */
+  const hasExplicitEntering =
+    typeof animation === 'object' &&
+    animation !== null &&
+    'entering' in animation;
+  const hasExplicitExiting =
+    typeof animation === 'object' &&
+    animation !== null &&
+    'exiting' in animation;
+  const skipDefaultEntering = variant === 'none' && !hasExplicitEntering;
+  const skipDefaultExiting = variant === 'none' && !hasExplicitExiting;
+
   // Extract shimmer animation configuration for progress animation
   const shimmerDuration = getAnimationValueProperty({
     animationValue: shimmerAnimationConfig,
@@ -204,8 +221,14 @@ export function useSkeletonRootAnimation(options: {
 
   return {
     isAllAnimationsDisabled,
-    entering: isEnteringAnimationDisabledValue ? undefined : enteringValue,
-    exiting: isExitingAnimationDisabledValue ? undefined : exitingValue,
+    entering:
+      isEnteringAnimationDisabledValue || skipDefaultEntering
+        ? undefined
+        : enteringValue,
+    exiting:
+      isExitingAnimationDisabledValue || skipDefaultExiting
+        ? undefined
+        : exitingValue,
   };
 }
 
```

**File**: `src/components/skeleton/skeleton.types.ts` (modified, +4/-0)
```diff
@@ -111,6 +111,10 @@ export interface SkeletonProps extends AnimatedProps<ViewProps> {
   /**
    * Animation variant
    * @default 'shimmer'
+   *
+   * `none` is a static placeholder: no shimmer, pulse, or default
+   * FadeIn/FadeOut. Pass `animation.entering` / `animation.exiting` to
+   * opt back into enter/exit transitions.
    */
   variant?: SkeletonAnimation;
 
```

---

### Incident Patch 10: `5a3d4d1c` (2026-09-17)
**Commit Message**: Merge pull request #484 from giaBaoJS/fix/switch-aria-valuetext

fix(switch): keep a consumer provided aria-valuetext

**File**: `src/__tests__/switch-primitive.test.tsx` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+import type { ReactElement } from 'react';
+import { Root as SwitchRoot } from '../primitives/switch/switch';
+import type { RootProps } from '../primitives/switch/switch.types';
+
+/**
+ * The Switch primitive Root calls no hooks, so its `forwardRef` render function
+ * can be invoked directly to read the props handed to the underlying Pressable.
+ */
+function getRootProps(props: RootProps): Record<string, unknown> {
+  const { render } = SwitchRoot as unknown as {
+    render: (props: RootProps, ref: null) => ReactElement;
+  };
+
+  return render(props, null).props as Record<string, unknown>;
+}
+
+describe('Switch primitive aria-valuetext', () => {
+  it('derives the value text from the selected state when none is provided', () => {
+    expect(getRootProps({ isSelected: true })['aria-valuetext']).toBe('on');
+    expect(getRootProps({ isSelected: false })['aria-valuetext']).toBe('off');
+  });
+
+  it('forwards a consumer provided value text unchanged', () => {
+    expect(
+      getRootProps({
+        'isSelected': false,
+        'aria-valuetext': 'Silent mode off',
+      })['aria-valuetext']
+    ).toBe('Silent mode off');
+
+    expect(
+      getRootProps({ 'isSelected': true, 'aria-valuetext': 'Silent mode on' })[
+        'aria-valuetext'
+      ]
+    ).toBe('Silent mode on');
+  });
+});
```

**File**: `src/primitives/switch/switch.tsx` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ const Root = forwardRef<RootRef, RootProps>(
         aria-disabled={isDisabled}
         role="switch"
         aria-checked={isSelected}
-        aria-valuetext={(ariaValueText ?? isSelected) ? 'on' : 'off'}
+        aria-valuetext={ariaValueText ?? (isSelected ? 'on' : 'off')}
         onPress={onPress}
         accessibilityState={{
           checked: isSelected,
```

---

### Incident Patch 11: `2654b8aa` (2026-09-17)
**Commit Message**: Merge pull request #493 from eliotgevers/fix/ios-dialog-outside-taps

fix(dialog,select): let outside taps pass through animated wrappers on iOS

**File**: `src/components/dialog/dialog.tsx` (modified, +1/-0)
```diff
@@ -315,6 +315,7 @@ const DialogContent = forwardRef<
         <GestureDetector gesture={panGesture}>
           <Animated.View
             ref={dragContainerRef}
+            pointerEvents="box-none"
             entering={entering}
             exiting={exiting}
             collapsable={false}
```

**File**: `src/components/select/select.tsx` (modified, +6/-1)
```diff
@@ -664,11 +664,16 @@ const SelectContentDialog = forwardRef<
       background === undefined ? <SelectContentBackground /> : background;
 
     return (
-      <View className={wrapperClassName} style={styles?.wrapper}>
+      <View
+        className={wrapperClassName}
+        style={styles?.wrapper}
+        pointerEvents="box-none"
+      >
         <PortalGestureRoot>
           <GestureDetector gesture={panGesture}>
             <Animated.View
               ref={dragContainerRef}
+              pointerEvents="box-none"
               entering={entering}
               exiting={exiting}
               collapsable={false}
```

---

### Incident Patch 12: `b34501d5` (2026-09-11)
**Commit Message**: fix(select): pass outside taps through dialog layout wrapper

**File**: `src/components/select/select.tsx` (modified, +5/-1)
```diff
@@ -664,7 +664,11 @@ const SelectContentDialog = forwardRef<
       background === undefined ? <SelectContentBackground /> : background;
 
     return (
-      <View className={wrapperClassName} style={styles?.wrapper}>
+      <View
+        className={wrapperClassName}
+        style={styles?.wrapper}
+        pointerEvents="box-none"
+      >
         <PortalGestureRoot>
           <GestureDetector gesture={panGesture}>
             <Animated.View
```

---

### Incident Patch 13: `e065dc0a` (2026-09-10)
**Commit Message**: chore: merge pull request #486 from giaBaoJS/fix/select-trigger-default-variant

fix(select): apply the documented default trigger variant

**File**: `src/__tests__/select.styles.test.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { selectClassNames } from '../components/select/select.styles';
+
+describe('selectClassNames.trigger', () => {
+  it('applies the default variant when no variant is passed', () => {
+    expect(selectClassNames.trigger()).toBe('select__trigger--variant-default');
+  });
+
+  it('keeps the default variant when other props are passed', () => {
+    expect(selectClassNames.trigger({ isDisabled: true })).toBe(
+      'select__trigger--variant-default select__trigger--is-disabled'
+    );
+  });
+
+  it('omits the default variant styles when unstyled is requested', () => {
+    expect(
+      selectClassNames.trigger({ variant: 'unstyled', isDisabled: true })
+    ).toBe('select__trigger--is-disabled');
+  });
+});
```

**File**: `src/components/select/select.styles.ts` (modified, +3/-0)
```diff
@@ -14,6 +14,9 @@ const trigger = tv({
       false: '',
     },
   },
+  defaultVariants: {
+    variant: 'default',
+  },
 });
 
 /**
```

---

### Incident Patch 14: `1cc36797` (2026-09-10)
**Commit Message**: chore: merge pull request #492 from eliotgevers/fix/open-window-anchors

fix(menu,popover,select): refresh open anchors when the app window changes

**File**: `src/helpers/internal/hooks/use-relative-position.ts` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 import * as React from 'react';
 import {
-  Dimensions,
+  useWindowDimensions,
   type LayoutRectangle,
   type ScaledSize,
 } from 'react-native';
@@ -27,7 +27,7 @@ export function useRelativePosition({
   placement,
   disablePositioningStyle,
 }: UseRelativePositionArgs) {
-  const dimensions = Dimensions.get('screen');
+  const dimensions = useWindowDimensions();
   const isRTL = useIsRTL();
 
   return React.useMemo(() => {
```

**File**: `src/primitives/menu/menu.tsx` (modified, +20/-0)
```diff
@@ -5,6 +5,7 @@ import React, {
   useContext,
   useEffect,
   useId,
+  useLayoutEffect,
   useMemo,
   useState,
 } from 'react';
@@ -13,6 +14,7 @@ import {
   Pressable,
   Text,
   View,
+  useWindowDimensions,
   type GestureResponderEvent,
   type LayoutChangeEvent,
   type LayoutRectangle,
@@ -141,8 +143,11 @@ const Trigger = forwardRef<TriggerRef, TriggerProps>(
       setContentLayout,
       isDefaultOpen,
       triggerPosition,
+      presentation,
     } = useRootContext();
 
+    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
+
     const isDisabledValue = isDisabled ?? isDisabledRoot ?? undefined;
 
     const augmentedRef = useAugmentedRef({
@@ -165,6 +170,21 @@ const Trigger = forwardRef<TriggerRef, TriggerProps>(
       deps: [isOpen],
     });
 
+    // A centered ancestor can move without changing the trigger's local layout.
+    useLayoutEffect(() => {
+      if (!isOpen || presentation !== 'popover') return;
+      augmentedRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
+        setTriggerPosition({ width, height, pageX, pageY });
+      });
+    }, [
+      isOpen,
+      presentation,
+      windowWidth,
+      windowHeight,
+      augmentedRef,
+      setTriggerPosition,
+    ]);
+
     // Open menu on mount if isDefaultOpen is true
     useEffect(() => {
       if ((isDefaultOpen || isOpen) && !triggerPosition) {
```

**File**: `src/primitives/popover/popover.tsx` (modified, +19/-0)
```diff
@@ -3,12 +3,14 @@ import React, {
   useContext,
   useEffect,
   useId,
+  useLayoutEffect,
   useState,
 } from 'react';
 import {
   BackHandler,
   Pressable,
   View,
+  useWindowDimensions,
   type GestureResponderEvent,
   type LayoutChangeEvent,
   type LayoutRectangle,
@@ -108,9 +110,11 @@ const Trigger = forwardRef<TriggerRef, TriggerProps>(
       setContentLayout,
       isDefaultOpen,
       triggerPosition,
+      presentation,
     } = useRootContext();
 
     const isDisabledValue = isDisabled ?? isDisabledRoot ?? undefined;
+    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
 
     const augmentedRef = useAugmentedRef({
       ref,
@@ -132,6 +136,21 @@ const Trigger = forwardRef<TriggerRef, TriggerProps>(
       deps: [isOpen],
     });
 
+    // A centered ancestor can move without changing the trigger's local layout.
+    useLayoutEffect(() => {
+      if (!isOpen || presentation !== 'popover') return;
+      augmentedRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
+        setTriggerPosition({ width, height, pageX, pageY });
+      });
+    }, [
+      isOpen,
+      presentation,
+      windowWidth,
+      windowHeight,
+      augmentedRef,
+      setTriggerPosition,
+    ]);
+
     // Open popover on mount if isDefaultOpen is true
     useEffect(() => {
       if ((isDefaultOpen || isOpen) && !triggerPosition) {
```

**File**: `src/primitives/select/select.tsx` (modified, +19/-0)
```diff
@@ -4,6 +4,7 @@ import React, {
   useContext,
   useEffect,
   useId,
+  useLayoutEffect,
   useMemo,
   useState,
 } from 'react';
@@ -12,6 +13,7 @@ import {
   Pressable,
   StyleSheet,
   Text,
+  useWindowDimensions,
   View,
   type GestureResponderEvent,
   type LayoutChangeEvent,
@@ -151,9 +153,11 @@ const Trigger = forwardRef<TriggerRef, TriggerProps>(
       setContentLayout,
       isDefaultOpen,
       triggerPosition,
+      presentation,
     } = useRootContext();
 
     const isDisabledValue = isDisabled || isDisabledRoot;
+    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
 
     const augmentedRef = useAugmentedRef({
       ref,
@@ -175,6 +179,21 @@ const Trigger = forwardRef<TriggerRef, TriggerProps>(
       deps: [isOpen],
     });
 
+    // A centered ancestor can move without changing the trigger's local layout.
+    useLayoutEffect(() => {
+      if (!isOpen || presentation !== 'popover') return;
+      augmentedRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
+        setTriggerPosition({ width, height, pageX, pageY });
+      });
+    }, [
+      isOpen,
+      presentation,
+      windowWidth,
+      windowHeight,
+      augmentedRef,
+      setTriggerPosition,
+    ]);
+
     // Open popover on mount if isDefaultOpen is true or isOpen is true initially
     useEffect(() => {
       if ((isDefaultOpen || isOpen) && !triggerPosition) {
```

---

### Incident Patch 15: `fa68f73e` (2026-09-08)
**Commit Message**: fix(dialog,select): pass outside taps through animated wrappers

**File**: `src/components/dialog/dialog.tsx` (modified, +1/-0)
```diff
@@ -315,6 +315,7 @@ const DialogContent = forwardRef<
         <GestureDetector gesture={panGesture}>
           <Animated.View
             ref={dragContainerRef}
+            pointerEvents="box-none"
             entering={entering}
             exiting={exiting}
             collapsable={false}
```

**File**: `src/components/select/select.tsx` (modified, +1/-0)
```diff
@@ -669,6 +669,7 @@ const SelectContentDialog = forwardRef<
           <GestureDetector gesture={panGesture}>
             <Animated.View
               ref={dragContainerRef}
+              pointerEvents="box-none"
               entering={entering}
               exiting={exiting}
               collapsable={false}
```

#### Recent Merged Pull Requests:
- **PR #504** (2026-09-25): fix(input): preserve native ref types in published declarations (@eliotgevers)
- **PR #503** (2026-09-25): docs: fix customizing colors example to include :root (@thomasstevens89)
- **PR #500** (2026-09-21): 1.0.10 (@vvv-sss)
- **PR #499** (2026-09-21): fix(input): type refs as native TextInput instance (@vvv-sss)
- **PR #498** (2026-09-21): fix(bottom-sheet): hide closed sheet handle peek on Android (@vvv-sss)
- **PR #496** (2026-09-18): fix(bottom-sheet): hide dismissed sheet during container resize (@vvv-sss)
- **PR #495** (2026-09-18): fix(skeleton): skip default FadeIn/FadeOut for variant="none" (@vvv-sss)
- **PR #493** (2026-09-17): fix(dialog,select): let outside taps pass through animated wrappers on iOS (@eliotgevers)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
