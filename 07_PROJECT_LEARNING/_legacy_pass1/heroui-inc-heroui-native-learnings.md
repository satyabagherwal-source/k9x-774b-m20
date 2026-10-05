# Forensic Learning Record (Deep Inspection): heroui-inc/heroui-native

> **Canonical Artifact**: `07_PROJECT_LEARNING/heroui-inc-heroui-native-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/heroui-inc/heroui-native](https://github.com/heroui-inc/heroui-native))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:16:40.756Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `heroui-inc/heroui-native`
- **Description**: 📱Beautiful, fast and modern React Native UI library
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3664 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  overrides: [
    {
      exclude: /\/node_modules\//,
      presets: ['module:react-native-builder-bob/babel-preset'],
    },
    {
      include: /\/node_modules\//,
      presets: ['module:@react-native/babel-preset'],
    },
  ],
};

```

### Core Architecture Module: `eslint.config.mjs`
```
import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import lingui from 'eslint-plugin-lingui';
import prettier from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: fixupConfigRules(compat.extends('@react-native', 'prettier')),
    plugins: { prettier },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'prettier/prettier': [
        'error',
        {
          quoteProps: 'consistent',
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'es5',
          useTabs: false,
          plugins: ['prettier-plugin-organize-imports'],
        },
      ],
    },
  },
  {
    // Translation coverage guard for the example app. Showcases are
    // deliberately pinned to English, so they are excluded here in the same way
    // they are excluded from `example/lingui.config.ts`.
    files: ['example/src/**/*.{ts,tsx}'],
    ignores: [
      'example/src/components/showcases/**',
      'example/src/app/(home)/showcases/**',
      'example/src/locales/**',
      // Component API names (`Accordion`, `BottomSheet`) and route segments.
      'example/src/helpers/data/components.ts',
      // BCP 47 locale tags.
      'example/src/i18n/locales.ts',
    ],
    plugins: { lingui },
    rules: {
      'lingui/no-unlocalized-strings': [
        'error',
        {
          // Patterns are compiled without the unicode flag, so stick to ASCII
          // classes rather than `\p{...}` escapes.
          ignore: [
            // No letters at all, so never user-facing prose.
            '^[^a-zA-Z]*$',
            // Style tokens and identifiers: lowercase, no sentence punctuation,
            // and at least one `-` or `:` separator (`flex-row items-center`).
            '^(?=.*[-:])[a-z0-9][a-z0-9\\s:/\\[\\]._%-]*$',
            // Size, scale and dimension tokens (`XS`, `lg`, `10px`, `0.5x`).
            '^(xs|sm|md|lg|xl|xxl|xxxl)$',
            '^(XS|SM|MD|LG|XL|[SML]|X{2,3}L)$',
            '^\\d+px$',
            '^\\d+(\\.\\d+)?x$',
            // Uppercase codes and initials (`US`, `GB`, `EC`).
            '^[A-Z]{1,3}$',
            // Semantic version strings.
            '^v\\d+(\\.\\d+)*$',
            // Colors in every notation the demos use.
            '^#[0-9a-fA-F]{3,8}$',
            '^(rgb|rgba|hsl|hsla)\\(',
            // Edge, alignment and theme identifiers.
            '^(left|right|top|bottom|start|end|center)$',
            '^(default|lavender|mint|sky)$',
            // Keyboard shortcut hints such as `⌘ B`.
            '^[\\u2318\\u2325\\u21e7\\u2303] [A-Z]$',
            // URLs, hostnames, bundle identifiers and sample email addresses.
            '^https?://',
            '^com\\.',
            '^[a-z0-9-]+\\.[a-z]{2,}$',
            '^[^\\s@]+@[^\\s@]+$',
          ],
          // Props and object keys carrying identifiers, style tokens and
          // component API values rather than copy.
          ignoreNames: [
            { regex: { pattern: '^(data|aria)-', flags: 'i' } },
            { regex: { pattern: '^[A-Z0-9_]+$' } },
            { regex: { pattern: 'className$', flags: 'i' } },
            { regex: { pattern: 'colors?$', flags: 'i' } },
            { regex: { pattern: 'Id$' } },
            { regex: { pattern: 'style$', flags: 'i' } },
            { regex: { pattern: '^(keyboard|header|gesture)[A-Z]' } },
            { regex: { pattern: '^(light|dark)Variant$' } },
            { regex: { pattern: '^(primary|secondary|tertiary)$' } },
            'accessibilityRole',
            'align',
            'animation',
            'autoCapitalize',
            'autoComplete',
            'behavior',
            'borderCurve',
            'colorScheme',
            'contentFit',
            'currency',
            'decelerationRate',
            'direction',
            'displayName',
            'duration',
            'entering',
            'exiting',
            'fallback',
            'feedbackVariant',
            'flag',
            'fontFamily',
            'hostName',
            'href',
            'icon',
            'iconName',
            'id',
            'inputMode',
            'key',
            'mode',
            'name',
            'orientation',
            'path',
            'pathname',
            'placement',
            'pointerEvents',
            'position',
            'presentation',
            'resizeMode',
            'route',
            'selectionMode',
            'size',
            'source',
            'status',
            'testID',
            'textContentType',
            'tint',
            'type',
            'unit',
            'uri',
            'value',
            'variant',
            // react-native-svg geometry and paint attributes.
            'clipPath',
            'clipRule',
            'd',
            'fill',
            'fillRule',
            'gradientUnits',
            'mask',
            'offset',
            'points',
            'preserveAspectRatio',
            'stroke',
            'strokeLinecap',
            'strokeLinejoin',
            'transform',
            'viewBox',
          ],
          // Developer-facing APIs that take identifiers or diagnostics, not copy.
          ignoreFunctions: [
            '*.addEventListener',
            '*.endsWith',
            '*.startsWith',
            'console.*',
            'cn',
            'Error',
            'fetch',
            'Platform.select',
            'require',
            'router.*',
            'scheduleOnRN',
            'Set',
            'toast.hide',
            'Uniwind.*',
            'useState',
            'React.useState',
            'useThemeColor',
          ],
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/',
      'lib/',
      '.yarn/',
      'example/src/uniwind.d.ts',
      // Compiled Lingui catalogs, regenerated by `yarn i18n:compile`.
      'example/src/locales/',
    ],
  },
]);

```

### Core Architecture Module: `example/babel.config.js`
```
const path = require('path');
const pkg = require('../package.json');

module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    // Must run first so Lingui macros are expanded before any other transform.
    '@lingui/babel-plugin-lingui-macro',
    [
      'module-resolver',
      {
        extensions: ['.tsx', '.ts', '.js', '.json'],
        alias: {
          // For development, we want to alias the library to the source
          [pkg.name]: path.join(__dirname, '..', pkg.source),
          '@': path.join(__dirname, '../src'),
        },
      },
    ],
  ],
};

```

### Core Architecture Module: `example/lingui.config.ts`
```
import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

/**
 * Lingui catalog configuration for the example app.
 *
 * Showcase screens (`src/components/showcases`, `src/app/(home)/showcases`) are
 * intentionally left untranslated and pinned to LTR, because the goal of the
 * localization work is previewing *components* in RTL rather than translating
 * marketing copy and brand clones.
 *
 * Lingui is pinned to v5. The v6 CLI forwards catalog `exclude` to Node's
 * `fs.globSync` as `options.exclude`, which only accepts an array from Node
 * 22.15 onwards and throws on the runtimes this repo currently targets.
 */
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'ar', 'he'],
  fallbackLocales: {
    default: 'en',
  },
  format: formatter({ lineNumbers: false }),
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: [
        '<rootDir>/src/components/showcases',
        '<rootDir>/src/app/(home)/showcases',
        '<rootDir>/src/locales',
      ],
    },
  ],
});

```

### Core Architecture Module: `example/metro.config.js`
```
const path = require('path');
const escape = require('escape-string-regexp');
const { getDefaultConfig } = require('@expo/metro-config');
const {
  wrapWithReanimatedMetroConfig,
} = require('react-native-reanimated/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const exampleNodeModules = path.join(projectRoot, 'node_modules');
const workspaceRootNodeModules = path.join(workspaceRoot, 'node_modules');

// Library peer deps must resolve to a single copy (the example's).
const rootPkg = require('../package.json');
const peerDependencies = Object.keys(rootPkg.peerDependencies ?? {});

const config = getDefaultConfig(projectRoot);

// Watch the workspace root so library source changes trigger reloads.
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), workspaceRoot])
);

// The library source is consumed from outside the example via a babel alias,
// and the workspace root has its own `node_modules` with overlapping deps.
// Pinning resolution here prevents duplicate copies of `react`, reanimated,
// etc., which would otherwise crash Hermes with
// "Maximum call stack size exceeded (native stack depth)" at startup.
// Requires `uniwind >= 1.6.3` (see https://github.com/uni-stack/uniwind/issues/505).
config.resolver.nodeModulesPaths = [
  exampleNodeModules,
  workspaceRootNodeModules,
];
config.resolver.disableHierarchicalLookup = true;

// Explicit hardening on top of `disableHierarchicalLookup`.
config.resolver.blockList = [
  ...(toArray(config.resolver.blockList) ?? []),
  ...peerDependencies.map(
    (name) =>
      new RegExp(`^${escape(path.join(workspaceRootNodeModules, name))}\\/.*$`)
  ),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...peerDependencies.reduce((acc, name) => {
    acc[name] = path.join(exampleNodeModules, name);
    return acc;
  }, {}),
};

module.exports = withUniwindConfig(wrapWithReanimatedMetroConfig(config), {
  cssEntryFile: './global.css',
  dtsFile: './src/uniwind.d.ts',
  extraThemes: [
    'lavender-light',
    'lavender-dark',
    'mint-light',
    'mint-dark',
    'sky-light',
    'sky-dark',
  ],
});

/**
 * Normalizes Metro's `blockList` (RegExp | RegExp[] | undefined) to an array.
 *
 * @param {RegExp | readonly RegExp[] | null | undefined} value
 * @returns {RegExp[] | undefined}
 */
function toArray(value) {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value;
  return [value];
}

```

### Core Architecture Module: `example/src/app/(home)/_layout.tsx`
```
import { useLingui } from '@lingui/react/macro';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Stack } from 'expo-router';
import { useThemeColor, useToast } from 'heroui-native';
import { useCallback, useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import LogoDark from '../../../assets/logo-dark.png';
import LogoLight from '../../../assets/logo-light.png';
import { type UpdateBottomSheetMode } from '../../components/bottom-sheet/update-bottom-sheet';
import { SettingsBottomSheet } from '../../components/settings/settings-bottom-sheet';
import { SettingsButton } from '../../components/settings/settings-button';
import { ThemeToggle } from '../../components/theme-toggle';
import { useAppTheme } from '../../contexts/app-theme-context';
import { COMPONENTS } from '../../helpers/data/components';
import { useOtaUpdate } from '../../helpers/hooks/use-ota-update';
import { useVersionCheck } from '../../helpers/hooks/use-version-check';

export default function Layout() {
  const { t } = useLingui();
  const { isDark } = useAppTheme();
  const [themeColorForeground, themeColorBackground] = useThemeColor([
    'foreground',
    'background',
  ]);

  const reducedMotion = useReducedMotion();
  const { toast } = useToast();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // -- Update management state --
  const [isVersionChecked, setIsVersionChecked] = useState(false);
  const [isNewVersionAvailable, setIsNewVersionAvailable] = useState(false);
  const [_updateSheetOpen, setUpdateSheetOpen] = useState(false);
  const [_updateSheetMode, setUpdateSheetMode] =
    useState<UpdateBottomSheetMode>('new-version');

  const handleVersionChecked = useCallback((isNew: boolean) => {
    setIsVersionChecked(true);
    setIsNewVersionAvailable(isNew);

    if (isNew) {
      setUpdateSheetMode('new-version');
      setUpdateSheetOpen(true);
    }
  }, []);

  const handleOtaUpdateReady = useCallback(() => {
    setUpdateSheetMode('ota-update');
    setUpdateSheetOpen(true);
  }, []);

  useVersionCheck({ onVersionChecked: handleVersionChecked });

  useOtaUpdate({
    isVersionChecked,
    isNewVersionAvailable,
    onUpdateReady: handleOtaUpdateReady,
  });

  useEffect(() => {
    if (reducedMotion) {
      toast.show({
        duration: 'persistent',
        variant: 'warning',
        label: t`Reduce motion enabled`,
        description: t`All animations will be disabled`,
        actionLabel: t`Close`,
        onActionPress: ({ hide }) => hide(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const _renderTitle = () => {
    return (
      <Image
        source={isDark ? LogoLight : LogoDark}
        style={styles.logo}
        resizeMode="contain"
      />
    );
  };

  const _renderThemeToggle = useCallback(() => <ThemeToggle />, []);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const _renderSettingsButton = useCallback(
    () => (
      <SettingsButton
        onPress={handleOpenSettings}
        accessibilityLabel={t`Open settings`}
      />
    ),
    [handleOpenSettings, t]
  );

  return (
    <View className="flex-1 bg-background">
      <Stack
        screenOptions={{
          headerTitleAlign: 'center',
          headerTransparent: true,
          headerBlurEffect: isDark ? 'dark' : 'light',
          headerTintColor: themeColorForeground,
          headerStyle: {
            backgroundColor: Platform.select({
              ios: undefined,
              android: themeColorBackground,
            }),
          },
          headerTitleStyle: {
            fontFamily: 'Inter_600SemiBold',
          },
          headerRight: _renderThemeToggle,
          headerBackButtonDisplayMode: 'generic',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          fullScreenGestureEnabled: isLiquidGlassAvailable() ? false : true,
          contentStyle: {
            backgroundColor: themeColorBackground,
          },
        }}
      >
        {/*
         * `headerLeft` is set per-screen rather than in `screenOptions`: a
         * global value would replace the native back button on every pushed
         * screen.
         */}
        <Stack.Screen
          name="index"
          options={{
            headerTitle: _renderTitle,
            headerLeft: _renderSettingsButton,
          }}
        />
        <Stack.Screen
          name="components/index"
          options={{ headerTitle: t`Components` }}
        />
        {COMPONENTS.map((component) => (
          <Stack.Screen
            key={component.path}
            name={`components/${component.path}`}
            options={{ title: component.title }}
          />
        ))}
        <Stack.Screen
          name="components/bottom-sheet-native-modal"
          options={{
            title: t`BottomSheet Native Modal`,
            presentation: 'formSheet',
          }}
        />
        <Stack.Screen
          name="components/dialog-native-modal"
          options={{
            title: t`Dialog Native Modal`,
            presentation: 'formSheet',
          }}
        />
        <Stack.Screen
          name="components/popover-native-modal"
          options={{
            title: t`Popover Native Modal`,
            presentation: 'formSheet',
          }}
        />
        <Stack.Screen
          name="components/select-native-modal"
          options={{
            title: t`Select Native Modal`,
            presentation: 'formSheet',
          }}
        />
        <Stack.Screen
          name="components/toast-native-modal"
          options={{
            title: t`Toast From Native Modal`,
            presentation: 'formSheet',
          }}
        />
        <Stack.Screen
          name="themes/index"
          options={{ headerTitle: t`Themes` }}
        />
        <Stack.Screen
          name="showcases"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
            animationDuration: 300,
          }}
        />
      </Stack>
      <SettingsBottomSheet
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
      {/* <UpdateBottomSheet
        isOpen={updateSheetOpen}
        onOpenChange={setUpdateSheetOpen}
        mode={updateSheetMode}
      /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 80,
    height: 24,
  },
});

```

### Core Architecture Module: `example/src/app/(home)/components/accordion.tsx`
```
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Accordion, PressableFeedback, useAccordionItem } from 'heroui-native';
import { View } from 'react-native';
import Animated, {
  Easing,
  FadeInLeft,
  FadeInRight,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import { AccordionWithDepthEffect } from '../../../components/accordion/accordion-with-depth-effect';
import { AppText } from '../../../components/app-text';
import type { UsageVariant } from '../../../components/component-presentation/types';
import { UsageVariantFlatList } from '../../../components/component-presentation/usage-variant-flatlist';
import { BoxIcon } from '../../../components/icons/box';
import { MinusIcon } from '../../../components/icons/minus';
import { PlanetEarthIcon } from '../../../components/icons/planet-earth';
import { PlusIcon } from '../../../components/icons/plus';
import { ReceiptIcon } from '../../../components/icons/receipt';
import { ShoppingBagIcon } from '../../../components/icons/shopping-bag';

const TriggerTitle = ({ title }: { title: MessageDescriptor }) => {
  const { t } = useLingui();

  return (
    <AppText
      className="text-foreground text-base flex-1 text-left"
      maxFontSizeMultiplier={1}
    >
      {t(title)}
    </AppText>
  );
};

const ContentText = ({ text }: { text: MessageDescriptor }) => {
  const { t } = useLingui();

  return (
    <AppText
      className="text-muted text-base/relaxed px-7 text-left"
      maxFontSizeMultiplier={1}
    >
      {t(text)}
    </AppText>
  );
};

// ------------------------------------------------------------------------------

const ICON_SIZE = 16;

const CUSTOM_INDICATOR_ENTERING = ZoomIn.duration(200).easing(
  Easing.inOut(Easing.ease)
);
const CUSTOM_INDICATOR_EXITING = ZoomOut.duration(200).easing(
  Easing.inOut(Easing.ease)
);

const CustomIndicator = () => {
  const { isExpanded } = useAccordionItem();

  return (
    <View className="size-5 items-center justify-center">
      {isExpanded ? (
        <Animated.View
          key="minus"
          entering={CUSTOM_INDICATOR_ENTERING}
          exiting={CUSTOM_INDICATOR_EXITING}
        >
          <MinusIcon size={14} colorClassName="accent-muted" />
        </Animated.View>
      ) : (
        <Animated.View
          key="plus"
          entering={CUSTOM_INDICATOR_ENTERING}
          exiting={CUSTOM_INDICATOR_EXITING}
        >
          <PlusIcon size={14} colorClassName="accent-muted" />
        </Animated.View>
      )}
    </View>
  );
};

// ------------------------------------------------------------------------------

/**
 * Storefront FAQ entries driving every accordion demo on this screen.
 *
 * Answer lengths deliberately vary so the demos still show panels expanding to
 * different heights, which is what the previous lorem ipsum filler existed for.
 */
const accordionData = [
  {
    id: '1',
    title: msg`How do I place an order?`,
    icon: <ShoppingBagIcon size={ICON_SIZE} colorClassName="accent-muted" />,
    content: msg`Add items to your cart, then open checkout to pay by card or wallet. We'll email your confirmation within a few minutes.`,
  },
  {
    id: '2',
    title: msg`Can I modify or cancel my order?`,
    icon: <ReceiptIcon size={ICON_SIZE} colorClassName="accent-muted" />,
    content: msg`You can change or cancel an order free of charge within two hours of placing it. After that your parcel may already be packed, so contact support and we'll help where we can.`,
  },
  {
    id: '3',
    title: msg`How much does shipping cost?`,
    icon: <BoxIcon size={ICON_SIZE} colorClassName="accent-muted" />,
    content: msg`Standard delivery is free on orders over $50. Below that it's a flat $4.99.`,
  },
  {
    id: '4',
    title: msg`Do you ship internationally?`,
    icon: <PlanetEarthIcon size={ICON_SIZE} colorClassName="accent-muted" />,
    content: msg`We deliver to more than 60 countries, usually within 7 to 14 business days. Any customs duties are calculated and shown at checkout before you pay.`,
  },
];

// ------------------------------------------------------------------------------

const classNames = {
  triggerContentContainer: 'flex-row items-center flex-1 gap-3',
};

// ------------------------------------------------------------------------------

const DefaultVariantContent = () => {
  return (
    <View className="flex-1 items-center justify-center px-5">
      <Accordion defaultValue="2" className="w-full">
        {accordionData.map((item) => (
          <Accordion.Item key={item.id} value={item.id}>
            <Accordion.Trigger asChild>
              <PressableFeedback animation={{ scale: false }}>
                <PressableFeedback.Scale
                  className={classNames.triggerContentContainer}
                >
                  {item.icon}
                  <TriggerTitle title={item.title} />
                </PressableFeedback.Scale>
                <Accordion.Indicator />
                <PressableFeedback.Highlight
                  animation={{ opacity: { value: [0, 0.05] } }}
                />
              </PressableFeedback>
            </Accordion.Trigger>
            <Accordion.Content>
              <ContentText text={item.content} />
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
    </View>
  );
};

// ------------------------------------------------------------------------------

const SurfaceVariantContent = () => {
  return (
    <View className="flex-1 items-center justify-center px-5">
      <Accordion variant="surface" className="w-full">
        {accordionData.map((item) => (
          <Accordion.Item key={item.id} value={item.id}>
            <Accordion.Trigger>
              <View className={classNames.triggerContentContainer}>
                {item.icon}
                <TriggerTitle title={item.title} />
              </View>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <ContentText text={item.content} />
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
    </View>
  );
};

// ------------------------------------------------------------------------------

const MultipleSelectionContent = () => {
  return (
    <View className="flex-1 items-center justify-center px-5">
      <Accordion
        selectionMode="multiple"
        variant="surface"
        defaultValue={['1', '3']}
        className="w-full"
      >
        {accordionData.slice(0, 3).map((item) => (
          <Accordion.Item key={item.id} value={item.id}>
            <Accordion.Trigger>
              <View className={classNames.triggerContentContainer}>
                {item.icon}
                <TriggerTitle title={item.title} />
              </View>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <ContentText text={item.content} />
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
    </View>
  );
};

// ------------------------------------------------------------------------------

const WithoutSeparatorsContent = () => {
  return (
    <View className="flex-1 items-center justify-center px-5">
      <Accordion hideSeparator className="w-full">
        {accordionData.slice(0, 3).map((item) => (
          <Accordion.Item key={item.id} value={item.id}>
            <Accordion.Trigger className="rounded-lg">
              <View className={classNames.triggerContentContainer}>
                {item.icon}
                <TriggerTitle title={item.title} />
              </View>
              <Accordion.Indicator />
            </Accordion.Trigger>
            <Accordion.Content>
              <ContentText text={item.content} />
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
 
```

### Core Architecture Module: `example/src/app/(home)/components/alert.tsx`
```
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { Alert, Button, CloseButton, Spinner } from 'heroui-native';
import { View } from 'react-native';
import type { UsageVariant } from '../../../components/component-presentation/types';
import { UsageVariantFlatList } from '../../../components/component-presentation/usage-variant-flatlist';

const DefaultAndAccentContent = () => {
  const { t } = useLingui();

  return (
    <View className="flex-1 items-center justify-center px-5">
      <View className="w-full gap-4">
        <Alert>
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title maxFontSizeMultiplier={1.4}>
              {t`New features available`}
            </Alert.Title>
            <Alert.Description maxFontSizeMultiplier={1.4}>
              {t`Check out our latest updates including dark mode support and improved accessibility features.`}
            </Alert.Description>
          </Alert.Content>
        </Alert>
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title maxFontSizeMultiplier={1.4}>
              {t`Update available`}
            </Alert.Title>
            <Alert.Description maxFontSizeMultiplier={1.4}>
              {t`A new version of the application is available. Please refresh to get the latest features and bug fixes.`}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </View>
    </View>
  );
};

// ------------------------------------------------------------------------------

const SuccessWarningDangerContent = () => {
  const { t } = useLingui();

  return (
    <View className="flex-1 items-center justify-center px-5">
      <View className="w-full gap-4">
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title maxFontSizeMultiplier={1}>{t`Success`}</Alert.Title>
            <Alert.Description maxFontSizeMultiplier={1}>
              {t`Your profile information has been updated. Review the changes in your account settings.`}
            </Alert.Description>
          </Alert.Content>
        </Alert>
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title maxFontSizeMultiplier={1}>
              {t`Scheduled maintenance`}
            </Alert.Title>
            <Alert.Description maxFontSizeMultiplier={1}>
              {t`Our services will be unavailable on Sunday, March 15th from 2:00 AM to 6:00 AM UTC for scheduled maintenance.`}
            </Alert.Description>
          </Alert.Content>
        </Alert>

        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title maxFontSizeMultiplier={1}>
              {t`Unable to connect to server`}
            </Alert.Title>
            <Alert.Description maxFontSizeMultiplier={1}>
              {t`Unable to connect to the server. Check your internet connection and try again.`}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </View>
    </View>
  );
};

// ------------------------------------------------------------------------------

const WithButtonsContent = () => {
  const { t } = useLingui();

  return (
    <View className="flex-1 items-center justify-center px-5">
      <View className="w-full gap-4">
        <Alert status="accent">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title maxFontSizeMultiplier={1}>
              {t`Update available`}
            </Alert.Title>
            <Alert.Description maxFontSizeMultiplier={1}>
              {t`A new version of the application is available. Please refresh to get the latest features and bug fixes.`}
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="primary">
            {t`Refresh`}
          </Button>
        </Alert>

        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title maxFontSizeMultiplier={1}>
              {t`Unable to connect to server`}
            </Alert.Title>
            <Alert.Description maxFontSizeMultiplier={1}>
              {t`Unable to connect to the server. Check your internet connection and try again.`}
            </Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="danger">
            {t`Retry`}
          </Button>
        </Alert>

        <Alert status="success" className="items-center">
          <Alert.Indicator className="pt-0" />
          <Alert.Content>
            <Alert.Title maxFontSizeMultiplier={1}>
              {t`Profile updated successfully`}
            </Alert.Title>
          </Alert.Content>
          <CloseButton />
        </Alert>
      </View>
    </View>
  );
};

// ------------------------------------------------------------------------------

const WithCustomIndicatorContent = () => {
  const { t } = useLingui();

  return (
    <View className="flex-1 items-center justify-center px-5">
      <View className="w-full gap-4">
        <Alert status="accent">
          <Alert.Indicator className="pt-px">
            <Spinner>
              <Spinner.Indicator iconProps={{ width: 20, height: 20 }} />
            </Spinner>
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{t`Processing your request`}</Alert.Title>
            <Alert.Description>
              {t`Please wait while we sync your data. This may take a few moments.`}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </View>
    </View>
  );
};

// ------------------------------------------------------------------------------

const ALERT_VARIANTS: UsageVariant[] = [
  {
    value: 'default',
    label: msg`Default & Accent`,
    content: <DefaultAndAccentContent />,
  },
  {
    value: 'success-warning-danger',
    label: msg`Success, Warning, Danger`,
    content: <SuccessWarningDangerContent />,
  },
  {
    value: 'title-only',
    label: msg`With buttons`,
    content: <WithButtonsContent />,
  },
  {
    value: 'with-custom-indicator',
    label: msg`With custom indicator`,
    content: <WithCustomIndicatorContent />,
  },
];

export default function AlertScreen() {
  return <UsageVariantFlatList data={ALERT_VARIANTS} />;
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

### Incident Patch 1: `8274a31f` (2026-09-21)
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

### Incident Patch 2: `c966d446` (2026-09-21)
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

---

### Incident Patch 3: `cae9dd8f` (2026-09-21)
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

---

### Incident Patch 4: `4cea6881` (2026-09-21)
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

---

### Incident Patch 5: `7488dd4b` (2026-09-18)
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

### Incident Patch 6: `56c3e1a9` (2026-09-18)
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

### Incident Patch 7: `2942f997` (2026-09-18)
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

### Incident Patch 8: `d65da7ac` (2026-09-18)
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

### Incident Patch 9: `5a3d4d1c` (2026-09-17)
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

### Incident Patch 10: `2654b8aa` (2026-09-17)
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
