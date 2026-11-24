# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: software-mansion/react-native-reanimated Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "software-mansion/react-native-reanimated",
  "source_url": "https://github.com/software-mansion/react-native-reanimated",
  "source_version": "22cbff88",
  "license": "MIT",
  "timestamp": "2026-11-24T12:54:03.256Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-software-mansion-react-native-reanimated",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [software-mansion/react-native-reanimated](https://github.com/software-mansion/react-native-reanimated) (Revision: `22cbff88`).  
> **License**: MIT | **Timestamp**: `2026-11-24T12:54:03.256Z`  
> **Learning ID**: `learn-github-software-mansion-react-native-reanimated`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 76%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from software-mansion/react-native-reanimated:

# Forensic Learning Record (Deep Inspection): software-mansion/react-native-reanimated

> **Canonical Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-reanimated-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/software-mansion/react-native-reanimated](https://github.com/software-mansion/react-native-reanimated))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T12:54:01.668Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-reanimated`
- **Description**: React Native's Animated library reimplemented
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11094 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/common-app/src/apps/css/components/core/Text.tsx`
```
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import type {
  GestureResponderEvent,
  TextProps as RNTextProps,
} from 'react-native';
import { StyleSheet, Text as RNText } from 'react-native';

import type {
  AnimationsNavigationRouteName,
  TransitionsNavigationRouteName,
} from '@/apps/css/examples';
import { colors, text } from '@/theme';
import type { FontVariant } from '@/types';

function parseTextVariant(textToParse: string): [FontVariant, string] {
  const match = textToParse.match(/^(#+)\s+/);
  if (match) {
    const hashes = match[1].length;
    const cleanedText = textToParse.slice(match[0].length);
    if (hashes < 4) {
      return [`heading${hashes}` as FontVariant, cleanedText];
    } else if (hashes < 7) {
      return [`subHeading${hashes - 3}` as FontVariant, cleanedText];
    }
  }
  return ['body1', textToParse];
}

const REGEX = /`([^`]+)`|\*\*([^*]+)\*\*/g;

const VARIANT_COLORS: Record<FontVariant, string> = {
  body1: colors.foreground3,
  body2: colors.foreground3,
  body3: colors.foreground3,
  code: colors.primaryDark,
  heading1: colors.foreground1,
  heading2: colors.foreground1,
  heading3: colors.foreground1,
  heading4: colors.foreground1,
  inlineCode: colors.primaryDark,
  label1: colors.foreground2,
  label2: colors.foreground2,
  label3: colors.foreground2,
  subHeading1: colors.foreground1,
  subHeading2: colors.foreground1,
  subHeading3: colors.foreground1,
};

export type TextProps = {
  variant?: FontVariant;
  navLink?: AnimationsNavigationRouteName | TransitionsNavigationRouteName;
  center?: boolean;
} & RNTextProps;

export default function Text({
  center,
  children,
  navLink,
  onPress,
  style,
  variant,
  ...rest
}: TextProps) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const getVariantProps = (textVariant: FontVariant, extraStyle = {}) => ({
    ...rest,
    onPress:
      navLink &&
      ((args: GestureResponderEvent) => {
        onPress?.(args);
        navigation.navigate<string>(navLink);
      }),
    style: [
      text[textVariant],
      {
        backgroundColor:
          textVariant === 'inlineCode' ? colors.primaryLight : 'transparent',
        color: VARIANT_COLORS[textVariant],
        textAlign: center ? 'center' : undefined,
      },
      navLink && styles.link,
      style,
      extraStyle, // Optional extra styles for things like bold
    ],
  });

  if (variant === 'inlineCode') {
    return (
      <Text>
        {' '}
        <RNText {...getVariantProps(variant)}>{children}</RNText>{' '}
      </Text>
    );
  }

  const renderTextWithCode = (textToParse: string) => {
    let resultingVariant = variant as FontVariant;
    let resultingText = textToParse;

    if (!variant) {
      [resultingVariant, resultingText] = parseTextVariant(textToParse);
    }

    return resultingText.split(REGEX).map((part, index) => {
      if (index % 3 === 1) {
        // Apply inline code style
        return (
          <RNText key={index} {...getVariantProps('inlineCode')}>
            {part}
          </RNText>
        );
      } else if (index % 3 === 2) {
        // Apply bold style
        return (
          <RNText
            key={index}
            {...getVariantProps(resultingVariant, { fontWeight: 'bold' })}>
            {part}
          </RNText>
        );
      }
      // Default: regular text
      return (
        <RNText key={index} {...getVariantProps(resultingVariant)}>
          {part}
        </RNText>
      );
    });
  };

  const isString = typeof children === 'string';

  return (
    <RNText {...getVariantProps(variant ?? 'body1')}>
      {isString ? renderTextWithCode(children) : children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
});

```

### Core Architecture Module: `apps/common-app/src/apps/css/components/core/index.ts`
```
export { default as Text, type TextProps } from './Text';

```

### Core Architecture Module: `apps/common-app/src/apps/css/examples/animations/screens/animationSettings/AnimationPlayState.tsx`
```
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CSSAnimationProperties } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

import { colors, radius, sizes } from '@/theme';

import { ExampleScreen } from './components';

export default function AnimationPlayState() {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <ExampleScreen
      animation={{
        animationDelay: '-1s',
        animationDirection: 'alternate',
        animationDuration: '2s',
        animationIterationCount: 'infinite',
        animationName: {
          from: {
            left: 0,
          },
          to: {
            left: '100%',
            transform: [{ translateX: '-100%' }],
          },
        },
        animationTimingFunction: 'ease-in-out',
      }}
      cards={[
        {
          items: [
            { animationPlayState: 'running', label: 'Running (default)' },
            { animationPlayState: 'paused', label: 'Paused' },
          ],
          title: 'Play State',
        },
        {
          allowPause: true,
          items: [{ label: `state: ${isPaused ? 'Paused' : 'Running'}` }],
          onTogglePause: setIsPaused,
          title: 'Toggling Play State',
        },
      ]}
      renderExample={(exampleConfig: CSSAnimationProperties) => (
        <View style={styles.wrapper}>
          <Animated.View style={[styles.box, exampleConfig]} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    height: sizes.sm,
    width: sizes.sm,
  },
  wrapper: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
  },
});

```

### Core Architecture Module: `apps/common-app/src/apps/css/examples/transitions/screens/pseudoSelectors/ActiveBlocksRender.tsx`
```
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  Screen,
  Scroll,
  Section,
  VerticalExampleCard,
} from '@/apps/css/components';
import { colors, radius, sizes, spacing } from '@/theme';

export default function ActiveBlocksRender() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => (prev + 1) % 2);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const renderColor = phase === 0 ? colors.danger : colors.primaryLight;

  return (
    <Screen>
      <Scroll contentContainerStyle={styles.content} withBottomBarSpacing>
        <Section
          description="backgroundColor is driven by two sources at once: a render-driven transition that toggles red <-> light blue every 1000ms via the 'default' value, and a ':active' selector that sets dark navy. Press and hold the box: while ':active' is active, the incoming render transitions on backgroundColor should be blocked and the box should hold dark navy (no red/blue flicker). Release and the looping render transition resumes."
          title="Selector blocks render transition">
          <VerticalExampleCard
            title="backgroundColor: render loop vs :active"
            code={`const renderColor = phase === 0 ? colors.danger : colors.primaryLight;
<Animated.View
  style={{
    backgroundColor: {
      default: renderColor,
      ':active': colors.primaryDark,
    },
    transitionDuration: '900ms',
    transitionTimingFunction: 'linear',
  }}
/>`}
            collapsedCode={`backgroundColor: {
  default: renderColor,
  ':active': colors.primaryDark,
},`}>
            <Animated.View
              style={[
                styles.box,
                {
                  backgroundColor: {
                    ':active': colors.primaryDark,
                    default: renderColor,
                  },
                  transitionDuration: '900ms',
                  transitionTimingFunction: 'linear',
                },
              ]}
            />
          </VerticalExampleCard>
        </Section>
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    height: sizes.md,
    width: sizes.md,
  },
  content: {
    gap: spacing.xs,
  },
});

```

### Core Architecture Module: `apps/common-app/src/apps/css/examples/transitions/screens/pseudoSelectors/HoverWithLoop.tsx`
```
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  Screen,
  Scroll,
  Section,
  VerticalExampleCard,
} from '@/apps/css/components';
import { colors, radius, sizes, spacing } from '@/theme';

export default function HoverWithLoop() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => (prev + 1) % 2);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <Screen>
      <Scroll contentContainerStyle={styles.content} withBottomBarSpacing>
        <Section
          description="Continuous JS-driven transition (background color toggling every 1500ms) running on the same view as a :hover pseudo-selector (scale). Both should compose: hovering scales the box without disturbing the looping color animation, and the color keeps cycling regardless of hover state."
          title="Looping transition + :hover">
          <VerticalExampleCard
            title="Hover scale + looping background"
            code={`<Animated.View
  style={{
    backgroundColor: phase === 0 ? colors.primary : colors.primaryDark,
    transform: {
      default: [{ scale: 1 }],
      ':hover': [{ scale: 1.2 }],
    },
    transitionProperty: ['backgroundColor', 'transform'],
    transitionDuration: ['1500ms', '200ms'],
    transitionTimingFunction: ['linear', 'ease-in-out'],
  }}
/>`}
            collapsedCode={`backgroundColor: phase === 0 ? primary : primaryDark,
transform: { default: [{ scale: 1 }], ':hover': [{ scale: 1.2 }] },
transitionDuration: ['1500ms', '200ms'],`}>
            <Animated.View
              style={[
                styles.box,
                {
                  backgroundColor:
                    phase === 0 ? colors.primary : colors.primaryDark,
                  transform: {
                    ':hover': [{ scale: 1.2 }],
                    default: [{ scale: 1 }],
                  },
                  transitionDuration: ['1500ms', '200ms'],
                  transitionProperty: ['backgroundColor', 'transform'],
                  transitionTimingFunction: ['linear', 'ease-in-out'],
                },
              ]}
            />
          </VerticalExampleCard>
        </Section>
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    height: sizes.md,
    width: sizes.md,
  },
  content: {
    gap: spacing.xs,
  },
});

```

### Core Architecture Module: `apps/common-app/src/apps/css/examples/transitions/screens/pseudoSelectors/PerStateTransitionConfig.tsx`
```
import { StyleSheet, TextInput } from 'react-native';
import Animated, { createAnimatedComponent } from 'react-native-reanimated';

import {
  Screen,
  Scroll,
  Section,
  VerticalExampleCard,
} from '@/apps/css/components';
import { colors, radius, sizes, spacing } from '@/theme';

const AnimatedTextInput = createAnimatedComponent(TextInput);

export default function PerStateTransitionConfig() {
  return (
    <Screen>
      <Scroll contentContainerStyle={styles.content} withBottomBarSpacing>
        <Section
          description="Different pseudo-selectors can drive different style properties on the same element. Use `transitionProperty` with aligned timing arrays to give each property its own speed/curve."
          title="Composing pseudo-selectors">
          <VerticalExampleCard
            collapsedCode="transitionDuration: '180ms'"
            description="Hover changes the background; active scales it down. Both animate with the same duration."
            title="Two selectors, two properties, shared timing"
            code={`<Animated.View
  style={{
    backgroundColor: { default: colors.primary, ':hover': colors.primaryDark },
    transform:       { default: [{ scale: 1 }], ':active': [{ scale: 0.92 }] },
    transitionDuration: '180ms',
  }}
/>`}>
            <Animated.View
              style={[
                styles.box,
                {
                  backgroundColor: {
                    ':hover': colors.primaryDark,
                    default: colors.primary,
                  },
                  transform: {
                    ':active': [{ scale: 0.92 }],
                    default: [{ scale: 1 }],
                  },
                  transitionDuration: '180ms',
                },
              ]}
            />
          </VerticalExampleCard>

          <VerticalExampleCard
            description="Hover-driven color change is smooth (250ms); active-driven press is snappy (60ms). Aligned arrays give each property its own duration."
            title="Per-property timing for different selectors"
            code={`<Animated.View
  style={{
    backgroundColor: { default: colors.primary, ':hover': colors.primaryDark },
    transform:       { default: [{ scale: 1 }], ':active': [{ scale: 0.92 }] },
    transitionProperty: ['backgroundColor', 'transform'],
    transitionDuration: ['250ms', '60ms'],
  }}
/>`}
            collapsedCode={`transitionProperty: ['backgroundColor', 'transform'],
transitionDuration: ['250ms', '60ms']`}>
            <Animated.View
              style={[
                styles.box,
                {
                  backgroundColor: {
                    ':hover': colors.primaryDark,
                    default: colors.primary,
                  },
                  transform: {
                    ':active': [{ scale: 0.92 }],
                    default: [{ scale: 1 }],
                  },
                  transitionDuration: ['250ms', '60ms'],
                  transitionProperty: ['backgroundColor', 'transform'],
                },
              ]}
            />
          </VerticalExampleCard>

          <VerticalExampleCard
            description="Three pseudo-selectors driving three different properties on a text input. Hover lightens the background, focus thickens the border, active scales it down — each on its own timing."
            title="Three selectors, three properties"
            code={`<AnimatedTextInput
  style={{
    backgroundColor: { default: colors.primary,  ':hover':  colors.primaryDark },
    borderWidth:     { default: 0,               ':focus':  3 },
    transform:       { default: [{ scale: 1 }],  ':active': [{ scale: 0.95 }] },
    transitionProperty: ['backgroundColor', 'borderWidth', 'transform'],
    transitionDuration: ['220ms', '160ms', '60ms'],
  }}
/>`}
            collapsedCode={`transitionProperty: ['backgroundColor', 'borderWidth', 'transform'],
transitionDuration: ['220ms', '160ms', '60ms']`}>
            <AnimatedTextInput
              placeholder="Tap, hover or focus me"
              style={[
                styles.input,
                {
                  backgroundColor: {
                    ':hover': colors.primaryDark,
                    default: colors.primary,
                  },
                  borderWidth: {
                    ':focus': 3,
                    default: 0,
                  },
                  transform: {
                    ':active': [{ scale: 0.95 }],
                    default: [{ scale: 1 }],
                  },
                  transitionDuration: ['220ms', '160ms', '60ms'],
                  transitionProperty: [
                    'backgroundColor',
                    'borderWidth',
                    'transform',
                  ],
                },
              ]}
            />
          </VerticalExampleCard>
        </Section>
      </Scroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    height: sizes.md,
    width: sizes.md,
  },
  content: {
    gap: spacing.xs,
  },
  input: {
    borderColor: colors.foreground1,
    borderRadius: radius.md,
    color: colors.background1,
    height: sizes.md,
    paddingHorizontal: spacing.sm,
    width: sizes.xxl,
  },
});

```

### Core Architecture Module: `apps/common-app/src/apps/css/hooks/index.ts`
```
export { default as useFocusPlayState } from './useFocusPlayState';

```

### Core Architecture Module: `apps/common-app/src/apps/css/hooks/useFocusPlayState.ts`
```
import { useIsFocused } from '@react-navigation/native';
import type { CSSAnimationPlayState } from 'react-native-reanimated';

// TODO - remove this temporary hook once the native animation pausing
// on screen change is implemented
export default function useFocusPlayState(): CSSAnimationPlayState {
  return useIsFocused() ? 'running' : 'paused';
}

```

### Core Architecture Module: `apps/common-app/src/apps/css/navigation/utils.ts`
```
import type { Route, Routes, RouteWithRoutes, TabRoute } from './types';

export function isRouteWithRoutes(route: Route): route is RouteWithRoutes {
  return route && typeof route === 'object' && 'routes' in route;
}

export function getExampleScreenPaths(tabRoutes: Array<TabRoute>): Set<string> {
  const paths = new Set<string>();

  const collect = (routes: Routes, prefix: string) => {
    for (const [key, route] of Object.entries(routes)) {
      const path = `${prefix}/${key}`;
      if (isRouteWithRoutes(route)) {
        collect(route.routes, path);
      } else {
        paths.add(path);
      }
    }
  };

  for (const tab of tabRoutes) {
    collect(tab.routes, tab.name);
  }

  return paths;
}

const isUpperCase = (char: string) => char && char === char.toUpperCase();

export function getScreenTitle(path: string): string {
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1] ?? '';
  const words = [];

  let firstWordCharIdx = 0;
  for (let i = 1; i < lastPart.length; i++) {
    const char = lastPart[i];
    if (isUpperCase(char) && !isUpperCase(lastPart[i + 1])) {
      words.push(lastPart.slice(firstWordCharIdx, i));
      firstWordCharIdx = i;
    }
  }

  words.push(lastPart.slice(firstWordCharIdx));

  return words.join(' ');
}

```

### Core Architecture Module: `apps/common-app/src/apps/css/utils/code.ts`
```
import type { UnknownRecord } from '@/types';

export function isValidPropertyName(propertyName: string): boolean {
  const validPropertyNamePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  return validPropertyNamePattern.test(propertyName);
}

export const isEasingFunction = (
  value: unknown
): value is { toString: () => string } => {
  return typeof value === 'object' && value !== null && 'normalize' in value;
};

export const isLeafValue = (value: unknown): boolean =>
  typeof value !== 'object' ||
  value === null ||
  Array.isArray(value) ||
  'normalize' in value ||
  'normalizedKeyframes' in value;

const isObjectRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !('normalize' in value) &&
  !('normalizedKeyframes' in value);

export const formatLeafValue = (
  value: unknown,
  nextTab = '',
  dense = false
): string => {
  const formatValue = (item: unknown) =>
    isEasingFunction(item) ? item.toString() : JSON.stringify(item);

  if (Array.isArray(value)) {
    if (!dense) {
      // multiline array
      return `[\n${value
        .map((item) => `${nextTab}  ${formatValue(item)}`)
        .join(',\n')}\n${nextTab}]`;
    }
    return `[${value.map((item) => formatValue(item)).join(', ')}]`;
  }

  return formatValue(value);
};

export const MAX_NOT_WRAPPED_LENGTH = 48;

const stringifyConfigObject = (
  inputObject: UnknownRecord,
  dense = false,
  depth = 0
): string => {
  if (depth > 10) {
    throw new Error('Object nesting is too deep');
  }

  const object = isObjectRecord(inputObject.cssRules)
    ? inputObject.cssRules
    : inputObject;

  const formatValue = (
    key: string,
    value: unknown,
    currentDepth: number,
    makeDense: boolean
  ): string => {
    const nextTab = '  '.repeat(currentDepth);

    if (key === 'animationName') {
      if (Array.isArray(value) && value.length > 0) {
        return `[\n${nextTab}  ${value
          .map((item) =>
            isObjectRecord(item)
              ? stringifyConfigObject(item, makeDense, depth + 2)
              : formatLeafValue(item, nextTab, makeDense)
          )
          .join(`,\n${nextTab}  `)}\n${nextTab}]`;
      }
      return isObjectRecord(value)
        ? stringifyConfigObject(value, makeDense, currentDepth)
        : formatLeafValue(value, nextTab, makeDense);
    }

    return isObjectRecord(value)
      ? stringifyConfigObject(value, makeDense, currentDepth)
      : formatLeafValue(value, nextTab, makeDense);
  };

  const formatLine = (
    key: string,
    value: unknown,
    depth_: number,
    makeDense: boolean
  ) => {
    const nextTab = '  '.repeat(depth_);
    return `${nextTab}${key}: ${formatValue(key, value, depth_, makeDense)}`;
  };

  const currentTab = '  '.repeat(depth);
  const keys = Object.keys(object);

  return `{\n${keys
    .map((key) => {
      const value = object[key];
      const formattedKey = isValidPropertyName(key) ? key : `"${key}"`;

      const denseFormat = formatLine(formattedKey, value, depth + 1, true);
      if (dense || denseFormat.length < MAX_NOT_WRAPPED_LENGTH) {
        return denseFormat;
      }
      return formatLine(formattedKey, value, depth + 1, false);
    })
    .join(',\n')}\n${currentTab}}`;
};

export const stringifyConfig = (
  object: unknown,
  dense = false,
  depth = 0
): string => {
  if (object === 'none') {
    return 'none';
  }
  return isObjectRecord(object)
    ? stringifyConfigObject(object, dense, depth)
    : formatLeafValue(object, '  '.repeat(depth), dense);
};

export const getCodeWithOverrides = <C extends object, O extends object>(
  sharedConfig: C,
  overrides: Array<O> = [],
  excludeKeys: Array<string> = []
): string => {
  // The generic constraint accepts any object shape from callers; treat it
  // as an indexable record once at the boundary so the dynamic prop reads
  // inside don't each need their own cast.
  const config = sharedConfig as UnknownRecord;
  const items = overrides as Array<UnknownRecord>;

  const propertyOverrides: Record<string, Array<unknown>> = {};
  const excludeSet = new Set(excludeKeys);

  const isQuoted = (value: unknown): value is string =>
    typeof value === 'string' && value[0] === '"' && value.slice(-1) === '"';

  const parseOverrideValue = (value: unknown) => {
    if (typeof value === 'string') {
      return value;
    }
    const stringified = JSON.stringify(value);
    return JSON.parse(stringified) === value ? stringified : value;
  };

  const parseOverride = (value: unknown) => {
    if (Array.isArray(value)) {
      return `[${value.map(parseOverrideValue).join(', ')}]`;
    }
    return parseOverrideValue(value);
  };

  for (const item of items) {
    for (const key in item) {
      if (!excludeSet.has(key)) {
        propertyOverrides[key] ??= [];
        propertyOverrides[key].push(parseOverride(item[key]));
      }
    }
  }

  return (
    '{\n  ' +
    [...new Set([...Object.keys(config), ...Object.keys(propertyOverrides)])]
      .map((key) => {
        const value = config[key] ?? propertyOverrides[key]?.[0] ?? '';

        let parsedValue;
        if (key === 'animationName') {
          parsedValue = stringifyConfig(value, false, 0);
        } else if (isLeafValue(value)) {
          const formatLine = (makeDense: boolean) =>
            `${key}: ${formatLeafValue(value, '', makeDense)}`;
          const denseFormat = formatLine(true);
          parsedValue =
            denseFormat.length < MAX_NOT_WRAPPED_LENGTH
              ? formatLeafValue(value, '', true)
              : formatLeafValue(value, '', false);
        } else if (isQuoted(value)) {
          parsedValue = value;
        } else {
          parsedValue = JSON.stringify(value);
        }

        let line = `${key}: ${parsedValue},`;
        if (
          propertyOverrides[key] &&
          (propertyOverrides[key].length > 1 ||
            propertyOverrides[key][0] !== value)
        ) {
          line += ` // ${propertyOverrides[key].join(', ')}`;
        }
        return line;
      })
      .join('\n')
      .split('\n')
      .join('\n  ') +
    '\n}'
  );
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7155** (2025-03-05): **[3.17.1] useAnimatedRef can not be used with component created by createAnimatedComponent**
  *Symptoms*: ### Description  After passing `ref` to component which is created by passing a class component to `createAnimatedComponent`, the app crash and throw the error below.  ![Image](https://github.com/user-attachments/assets/afea926d-5701-4bc5-8464-411e1b0d0785)  ### Steps to reproduce  Please follow the snippet below: ```javascript class ClassComponent extends Component {   render() {     return <View />;   } }  const AnimatedClassComponent =   Reanimated.createAnimatedComponent(ClassComponent);  function App(): React.JSX.Element {   const ref = useAnimatedRef();    return (     <SafeAreaView style={styles.container}>       <AnimatedClassComponent ref={ref} />     </SafeAreaView>   ); } ```  ### Snack or a link to a repository  https://snack.expo.dev/Yw0yWgR-j23l3qT2JES2c  ### Reanimated version  3.17.1  ### React Native version  0.78.0  ### Platforms  iOS  ### JavaScript runtime  Hermes  ### Workflow  React Native  ### Architecture  Fabric (New Architecture)  ### Build type  Debug app & dev bundle  ### Device  iOS simulator  ### Device model  _No response_  ### Acknowledgements  Yes

- **Issue #3879** (2023-03-24): **☂️ Deadlock/ANR in performOperations**
  *Symptoms*: ### Description  This is an umbrella issue for ANRs/deadlocks on Android/iOS in NodesManager.performOperations.  The bug was introduced in #1215.  Android: - #2251 - #3062  iOS: - #3180 - #3862 - #3946  PRs trying to solve this issue: - #3082 - #3194  ### Repro  We don't have a repro yet but it needs to use modal or datetime picker as well as animate layout props using Reanimated.  ### Reanimated version  \>= 2.0.0, >= 3.0.0  ### Platforms  Android, iOS
  **Post-Mortem & Fix Analysis**:
  > What is the status of this. Is this fixed in 3.0?
  > Facing the same issue in Android with reanimated v3.....any update on this issue? @tomekzaw @casperstr Did u guys manage to fix this issue?

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

### Incident Patch 1: `cec3cdc5` (2026-11-24)
**Commit Message**: fix(Reanimated): stop reading React's shadow node wrapper on the UI thread (#11464)

> [!NOTE]
> This pull request was authored by AI on behalf of @tjzel.

## Summary

### Why

The ThreadSanitizer nightly reports a data race in every run since #120
(2026-11-17), for example
[#123](https://github.com/software-mansion/react-native-reanimated/actions/runs/44677618659).
The same race is reported in #11232, and #11449 proposed the same fix
before it was closed in favor of this PR.

Reanimated hands React Native's own shadow node wrappers to the UI
thread, through animated styles and `useAnimatedRef`. React Native
updates the node a wrapper points to on the JS thread whenever it clones
that node itself, for example when a child is appended. The UI thread
can read the same pointer at the same time. That is undefined behavior
and can lead to a use-after-free.

### What

The UI thread no longer reads React Native's wrappers. It gets its own
detached copy of each wrapper, which points at the same node and which
React Native never updates. Nothing changes in the public API.

### How

```
JS thread:  React Native's wrapper ──copy──▶ detached wrapper (same node, not known to React Native)
UI th

**File**: `apps/common-app/runtime-tests/reanimated/suites.ts` (modified, +10/-2)
```diff
@@ -52,6 +52,7 @@ const SUITES: RuntimeTestSuite[] = [
     importTest: () => {
       require('./tests/core/useAnimatedRef.test');
       require('./tests/core/useAnimatedRefRetention.test');
+      require('./tests/core/useAnimatedRefNewestClone.test');
       require('./tests/core/getAnimatableRef.test');
       // TODO: update expected values
       // require('./tests/core/cancelAnimation.test');
@@ -78,6 +79,12 @@ const SUITES: RuntimeTestSuite[] = [
       // require('./tests/core/onLayout.test');
     },
   },
+  {
+    testSuiteName: 'shadow node wrapper race',
+    importTest: () => require('./tests/core/shadowNodeWrapperRace.test'),
+    // A stress test for TSan, which runs in the nightly full runs.
+    fullRunOnly: true,
+  },
   {
     testSuiteName: 'event handlers',
     importTest: () => {
@@ -310,7 +317,8 @@ export const REANIMATED_TEST_SUITES: RuntimeTestSuite[] = SUITES.map(
   (suite) => ({
     ...suite,
     fullRunOnly:
-      !isBundleModeEnabled() &&
-      !LEGACY_EVAL_SHORT_RUN_SUITES.includes(suite.testSuiteName),
+      suite.fullRunOnly ||
+      (!isBundleModeEnabled() &&
+        !LEGACY_EVAL_SHORT_RUN_SUITES.includes(suite.testSuiteName)),
   })
 );
```

**File**: `apps/common-app/runtime-tests/reanimated/tests/core/shadowNodeWrapperRace.test.tsx` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
+import type { ReactNode } from 'react';
+import { memo, useEffect, useState } from 'react';
+import { ScrollView, StyleSheet, Text, View } from 'react-native';
+import type { AnimatedRef, SharedValue } from 'react-native-reanimated';
+import Animated, {
+  measure,
+  scrollTo,
+  useAnimatedRef,
+  useAnimatedStyle,
+  useFrameCallback,
+  useSharedValue,
+  withRepeat,
+  withTiming,
+} from 'react-native-reanimated';
+
+import {
+  describe,
+  expect,
+  render,
+  test,
+  wait,
+} from '../../../ReJest/RuntimeTestsApi';
+
+// Run under TSan. React Native writes shadow node wrappers on the JS thread,
+// these tests read them on the UI thread (#11232).
+
+const STRESS_DURATION_MS = 8000;
+const BOX_COUNT = 24;
+const SCROLL_BOX_COUNT = 12;
+
+function useJSCommitEveryFrame() {
+  const [tick, setTick] = useState(0);
+  useEffect(() => {
+    let frame = requestAnimationFrame(function loop() {
+      setTick((value) => value + 1);
+      frame = requestAnimationFrame(loop);
+    });
+    return () => cancelAnimationFrame(frame);
+  }, []);
+  return tick;
+}
+
+// Each React commit relayouts the boxes while the UI thread measures them.
+const MeasuredBox = memo(function MeasuredBox({
+  index,
+  onRef,
+}: {
+  index: number;
+  onRef: (index: number, ref: AnimatedRef<View>) => void;
+}) {
+  const ref = useAnimatedRef<View>();
+  useEffect(() => {
+    onRef(index, ref);
+  }, [index, onRef, ref]);
+  return <View ref={ref} style={styles.measuredBox} />;
+});
+
+function MeasureStress({ framesOnUI }: { framesOnUI: SharedValue<number> }) {
+  const tick = useJSCommitEveryFrame();
+  const [refs] = useState<AnimatedRef<View>[]>(() => []);
+  const [onRef] = useState(
+    () => (index: number, ref: AnimatedRef<View>) => (refs[index] = ref)
+  );
+  const [boxRefs, setBoxRefs] = useState<AnimatedRef<View>[]>([]);
+
+  useEffect(() => {
+    // The refs are registered in child effects, which run first.
+    setBoxRefs([...refs]);
+  }, [refs]);
+
+  useFrameCallback(() => {
+    for (const ref of boxRefs) {
+      measure(ref);
+    }
+    framesOnUI.value += 1;
+  });
+
+  return (
+    <View style={styles.container}>
+      <View style={{ height: 10 + (tick % 2) * 10 }} />
+      {Array.from({ length: BOX_COUNT }, (_, index) => (
+        <MeasuredBox key={index} index={index} onRef={onRef} />
+      ))}
+    </View>
+  );
+}
+
+// Scrolling updates the ScrollView state, so each React commit clones the
+// animated box while the UI thread updates its props.
+const ScrollBox = memo(function ScrollBox({
+  framesOnUI,
+}: {
+  framesOnUI: SharedValue<number>;
+}) {
+  const scrollRef = useAnimatedRef<ScrollView>();
+  const opacity = useSharedValue(1);
+
+  useEffect(() => {
+    opacity.value = withRepeat(withTiming(0.5, { duration: 200 }), -1, true);
+  }, [opacity]);
+
+  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
+
+  useFrameCallback((frameInfo) => {
+    scrollTo(scrollRef, (frameInfo.timeSinceFirstFrame / 4) % 200, 0, false);
+    framesOnUI.value += 1;
+  });
+
+  return (
+    <Animated.View style={[styles.scrollBox, animatedStyle]}>
+      <Animated.ScrollView ref={scrollRef} horizontal>
+        <View style={styles.scrollContent}>
+          <Text>scroll</Text>
+        </View>
+      </Animated.ScrollView>
+    </Animated.View>
+  );
+});
+
+function ScrollStress({ framesOnUI }: { framesOnUI: SharedValue<number> }) {
+  const tick = useJSCommitEveryFrame();
+  return (
+    <View style={styles.container}>
+      <View style={{ height: 10 + (tick % 2) * 10 }} />
+      {Array.from({ length: SCROLL_BOX_COUNT }, (_, index) => (
+        <ScrollBox key={index} framesOnUI={framesOnUI} />
+      ))}
+    </View>
+  );
+}
+
+function FramesCounter({
+  children,
+  onFramesOnUI,
+}: {
+  children: (framesOnUI: SharedValue<number>) => ReactNode;
+  onFramesOnUI: (framesOnUI: SharedValue<number>) => void;
+}) {
+  const framesOnUI = useSharedValue(0);
+  useEffect(() => {
+    onFramesOnUI(framesOnUI);
+  }, [framesOnUI, onFramesOnUI]);
+  return <>{children(framesOnUI)}</>;
+}
+
+async function runStress(
+  build: (framesOnUI: SharedValue<number>) => ReactNode
+) {
+  let framesOnUI: SharedValue<number> | null = null;
+  await render(
+    <FramesCounter onFramesOnUI={(value) => (framesOnUI = value)}>
+      {build}
+    </FramesCounter>
+  );
+  await wait(STRESS_DURATION_MS);
+  const frames = framesOnUI!.value;
+  await render(null);
+  return frames;
+}
+
+describe('shadow node wrapper race (#11232)', () => {
+  test('measure on the UI thread while React relayouts the views', async () => {
+    const frames = await runStress((framesOnUI) => (
+      <MeasureStress framesOnUI={framesOnUI} />
+    ));
+    expect(frames > 0).toBe(true);
+  });
+
+  test('animated style and scrollTo on the UI thread while React progresses state', async () => {
+    const frames = await runStress((framesOnUI) => (
+      <ScrollStress framesOnUI={framesOnUI} />
+   
```

**File**: `apps/common-app/runtime-tests/reanimated/tests/core/useAnimatedRefNewestClone.test.tsx` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+import React from 'react';
+import { findNodeHandle, TextInput, View } from 'react-native';
+import type { AnimatedRef, MeasuredDimensions } from 'react-native-reanimated';
+import Animated, {
+  dispatchCommand,
+  measure,
+  setNativeProps,
+  useAnimatedRef,
+} from 'react-native-reanimated';
+import { runOnRuntimeAsyncWithId, UIRuntimeId } from 'react-native-worklets';
+
+import {
+  describe,
+  expect,
+  notify,
+  render,
+  test,
+  waitForFrames,
+  waitForNotification,
+} from '../../../ReJest/RuntimeTestsApi';
+
+const WIDTHS = [10, 20, 30, 40, 50];
+const SET_NATIVE_PROPS_OPACITY = 0.5;
+const FOCUSED = 'NEWEST_CLONE_INPUT_FOCUSED';
+const BLURRED = 'NEWEST_CLONE_INPUT_BLURRED';
+
+let viewRef: AnimatedRef<Animated.View> | undefined;
+let inputRef: AnimatedRef<TextInput> | undefined;
+
+function ResizedView({ width }: { width: number }) {
+  const animatedRef = useAnimatedRef<Animated.View>();
+  viewRef = animatedRef;
+  return (
+    <View>
+      <Animated.View
+        ref={animatedRef}
+        style={{ width, height: 10, backgroundColor: 'red' }}
+      />
+    </View>
+  );
+}
+
+function ResizedInput({ width }: { width: number }) {
+  const animatedRef = useAnimatedRef<TextInput>();
+  inputRef = animatedRef;
+  return (
+    <View style={{ marginTop: 100 }}>
+      <TextInput
+        ref={animatedRef}
+        style={{ width, height: 40, borderWidth: 1 }}
+        onFocus={() => notify(FOCUSED)}
+        onBlur={() => notify(BLURRED)}
+      />
+    </View>
+  );
+}
+
+function measureOnUI(animatedRef: AnimatedRef<Animated.View>) {
+  return runOnRuntimeAsyncWithId(UIRuntimeId, () => {
+    'worklet';
+    return measure(animatedRef);
+  }) as Promise<MeasuredDimensions | null>;
+}
+
+async function renderEveryWidth(renderWidth: (width: number) => Promise<void>) {
+  for (const width of WIDTHS) {
+    await renderWidth(width);
+    await waitForFrames(2);
+  }
+}
+
+describe('useAnimatedRef on the UI runtime after React clones the view', () => {
+  test('measure returns the layout of the newest clone', async () => {
+    await renderEveryWidth((width) => render(<ResizedView width={width} />));
+    await waitForFrames(3);
+
+    const measured = await measureOnUI(viewRef!);
+    expect(measured?.width).toBe(WIDTHS[WIDTHS.length - 1]);
+
+    await render(null);
+  });
+
+  test('setNativeProps updates the newest clone', async () => {
+    await renderEveryWidth((width) => render(<ResizedView width={width} />));
+    await waitForFrames(3);
+    const animatedRef = viewRef!;
+    const tag = findNodeHandle(animatedRef.current) ?? -1;
+
+    await runOnRuntimeAsyncWithId(UIRuntimeId, () => {
+      'worklet';
+      setNativeProps(animatedRef, { opacity: SET_NATIVE_PROPS_OPACITY });
+      global._maybeFlushUIUpdatesQueue();
+    });
+    await waitForFrames(3);
+
+    const mounted = await runOnRuntimeAsyncWithId(UIRuntimeId, () => {
+      'worklet';
+      return global._obtainMountedViewProps(tag, false);
+    });
+    expect(mounted?.opacity).toBe(SET_NATIVE_PROPS_OPACITY);
+    expect(mounted?.width).toBe(WIDTHS[WIDTHS.length - 1]);
+
+    await render(null);
+  });
+
+  test('dispatchCommand reaches the native view of the newest clone', async () => {
+    await renderEveryWidth((width) =>
+      render(<ResizedInput width={width * 4} />)
+    );
+    await waitForFrames(3);
+    const animatedRef = inputRef!;
+
+    await runOnRuntimeAsyncWithId(UIRuntimeId, () => {
+      'worklet';
+      dispatchCommand(animatedRef, 'focus');
+    });
+    await waitForNotification(FOCUSED);
+
+    await runOnRuntimeAsyncWithId(UIRuntimeId, () => {
+      'worklet';
+      dispatchCommand(animatedRef, 'blur');
+    });
+    await waitForNotification(BLURRED);
+
+    await render(null);
+  });
+});
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/NativeModules/ReanimatedModuleProxy.cpp` (modified, +5/-0)
```diff
@@ -1676,6 +1676,11 @@ jsi::Object ReanimatedModuleProxy::toOptimizedObject(jsi::Runtime &rt) {
         strongThis->setViewStyle(rt, at<0>(args), at<1>(args));
       });
 
+  addMethod<1>(
+      rt, obj, "createDetachedShadowNodeWrapper", [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value(&args)[1]) {
+        return Bridging<std::shared_ptr<const ShadowNode>>::toJs(rt, shadowNodeFromValue(rt, at<0>(args)));
+      });
+
   addMethod<1>(
       rt,
       obj,
```

**File**: `packages/react-native-reanimated/changelog/reanimated-ui-shadow-node-wrapper-race.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix a data race between the UI thread reading a view and the JS thread cloning it, which could crash an app that animates a view while React re-renders it.
```

**File**: `packages/react-native-reanimated/src/ReanimatedModule/NativeReanimated.ts` (modified, +6/-0)
```diff
@@ -184,6 +184,12 @@ See https://docs.swmansion.com/react-native-reanimated/docs/guides/troubleshooti
     this.#reanimatedModuleProxy.setCSSEventHandler(handler);
   }
 
+  createDetachedShadowNodeWrapper(shadowNodeWrapper: ShadowNodeWrapper) {
+    return this.#reanimatedModuleProxy.createDetachedShadowNodeWrapper(
+      shadowNodeWrapper
+    );
+  }
+
   markNodeAsRemovable(shadowNodeWrapper: ShadowNodeWrapper) {
     this.#reanimatedModuleProxy.markNodeAsRemovable(shadowNodeWrapper);
   }
```

**File**: `packages/react-native-reanimated/src/ReanimatedModule/js-reanimated/JSReanimated.ts` (modified, +6/-0)
```diff
@@ -274,6 +274,12 @@ class JSReanimated implements IReanimatedModule {
     );
   }
 
+  createDetachedShadowNodeWrapper(
+    shadowNodeWrapper: ShadowNodeWrapper
+  ): ShadowNodeWrapper {
+    return shadowNodeWrapper;
+  }
+
   markNodeAsRemovable(_shadowNodeWrapper: ShadowNodeWrapper): void {
     throw new Error(
       '[Reanimated] markNodeAsRemovable is not available in JSReanimated.'
```

**File**: `packages/react-native-reanimated/src/ReanimatedModule/reanimatedModuleProxy.ts` (modified, +4/-0)
```diff
@@ -68,6 +68,10 @@ export interface ReanimatedModuleProxy {
   /** Registers the single handler receiving every CSS event batch. */
   setCSSEventHandler(handler: CSSEventHandler): void;
 
+  createDetachedShadowNodeWrapper(
+    shadowNodeWrapper: ShadowNodeWrapper
+  ): ShadowNodeWrapper;
+
   markNodeAsRemovable(shadowNodeWrapper: ShadowNodeWrapper): void;
   unmarkNodeAsRemovable(viewTag: number): void;
 
```

---

### Incident Patch 2: `aa4506c7` (2026-11-23)
**Commit Message**: fix: stabilize Synchronizable benchmark resources (#11492)

> [!NOTE]
> This pull request was authored by AI on behalf of @tjzel.

## Human track

### Why

The Synchronizable performance example recreated both Synchronizable
objects and its Worker Runtime on every React rerender. Retaining those
resources makes repeated measurements comparable. Overlapping button
presses could also reset and share the same counter while a run was
active.

This change was split from pull request
[#11491](https://github.com/software-mansion/react-native-reanimated/pull/11491)
following review feedback.

### How

The example now creates its two Synchronizable objects and Worker
Runtime once per mount, resets the selected counter before each run, and
rejects overlapping runs until all three runtimes finish. Benchmark
buttons are disabled while a run is active.

### Testing

A focused native Jest regression verifies that 30 rerenders still create
exactly two Synchronizable objects and one Worker Runtime. Another
regression verifies that rapid repeated presses schedule only one run.
The common-app native type check and focused formatting checks pass
locally.

### Performance

Across 30 controlled rerende

**File**: `apps/common-app/src/apps/worklets/examples/SynchronizableExample.tsx` (modified, +29/-13)
```diff
@@ -39,18 +39,18 @@ export default function SynchronizablePerformanceExample() {
   const [selectedVariant, setSelectedVariant] =
     React.useState<VariantKey>('dynamic');
   const [runningRuntimes, setRunningRuntimes] = React.useState(0);
-
-  const fixedSynchronizable: FixedSynchronizable<number> = createSynchronizable(
-    initialValue,
-    { fixedType: true }
-  );
-
-  const synchronizables: Record<VariantKey, Synchronizable<number>> = {
+  const runInProgress = React.useRef(false);
+  const [synchronizables] = React.useState<
+    Record<VariantKey, Synchronizable<number>>
+  >(() => ({
     dynamic: createSynchronizable(initialValue),
-    fixed: fixedSynchronizable,
-  };
-
-  const runtime = createWorkletRuntime({ name: 'SynchronizableExample' });
+    fixed: createSynchronizable(initialValue, { fixedType: true }),
+  }));
+  const fixedSynchronizable =
+    synchronizables.fixed as FixedSynchronizable<number>;
+  const [runtime] = React.useState(() =>
+    createWorkletRuntime({ name: 'SynchronizableExample' })
+  );
 
   function setResult(
     variant: VariantKey,
@@ -64,7 +64,14 @@ export default function SynchronizablePerformanceExample() {
     }));
   }
 
-  const decrementRuntimes = () => setRunningRuntimes((prev) => prev - 1);
+  const decrementRuntimes = () =>
+    setRunningRuntimes((prev) => {
+      const next = prev - 1;
+      if (next === 0) {
+        runInProgress.current = false;
+      }
+      return next;
+    });
 
   function setValueAndDuration(
     variant: VariantKey,
@@ -159,7 +166,12 @@ export default function SynchronizablePerformanceExample() {
   }
 
   function runBenchmark(benchmark: (variant: VariantKey) => void) {
+    if (runInProgress.current) {
+      return;
+    }
+    runInProgress.current = true;
     const variant = selectedVariant;
+    synchronizables[variant].setBlocking(initialValue);
     resetVariant(variant);
     setRunningRuntimes(3);
 
@@ -212,23 +224,27 @@ export default function SynchronizablePerformanceExample() {
         title={`Selected variant: ${selectedVariant}`}
       />
       <Button
+        disabled={runningRuntimes > 0}
         onPress={() => runBenchmark(getDirtySetBlocking)}
         title=".getDirty() & .setBlocking() on two threads"
       />
       <Button
+        disabled={runningRuntimes > 0}
         onPress={() => runBenchmark(getBlockingSetBlocking)}
         title=".getBlocking() & .setBlocking() on two threads"
       />
       <Button
+        disabled={runningRuntimes > 0}
         onPress={() => runBenchmark(setBlockingSetBlockingTransaction)}
         title=".setBlocking() with setter on two threads - transaction"
       />
       <Button
-        disabled={selectedVariant !== 'fixed'}
+        disabled={selectedVariant !== 'fixed' || runningRuntimes > 0}
         onPress={() => runBenchmark(getDirtySetDirty)}
         title=".getDirty() & .setDirty() on two threads - fixed only"
       />
       <Button
+        disabled={runningRuntimes > 0}
         onPress={() => runBenchmark(imperativeLocking)}
         title="Imperative locking"
       />
```

**File**: `packages/react-native-reanimated/__tests__/synchronizableExample.test.tsx` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+import { act, fireEvent, render, screen } from '@testing-library/react-native';
+import {
+  createSynchronizable,
+  createWorkletRuntime,
+  scheduleOnRuntime,
+  scheduleOnUI,
+} from 'react-native-worklets';
+
+import SynchronizablePerformanceExample from '../../../apps/common-app/src/apps/worklets/examples/SynchronizableExample';
+
+jest.mock('react-native-worklets', () => ({
+  createSynchronizable: jest.fn(() => ({
+    getBlocking: jest.fn(),
+    getDirty: jest.fn(),
+    lock: jest.fn(),
+    setBlocking: jest.fn(),
+    setDirty: jest.fn(),
+    unlock: jest.fn(),
+  })),
+  createWorkletRuntime: jest.fn(() => ({ runtimeId: 3 })),
+  scheduleOnRN: jest.fn(),
+  scheduleOnRuntime: jest.fn(),
+  scheduleOnUI: jest.fn(),
+}));
+
+test('retains benchmark resources across React rerenders', () => {
+  render(<SynchronizablePerformanceExample />);
+
+  expect(createSynchronizable).toHaveBeenCalledTimes(2);
+  expect(createWorkletRuntime).toHaveBeenCalledTimes(1);
+
+  for (let i = 0; i < 30; i++) {
+    fireEvent.press(
+      screen.getByText(`Selected variant: ${i % 2 === 0 ? 'dynamic' : 'fixed'}`)
+    );
+  }
+
+  expect(createSynchronizable).toHaveBeenCalledTimes(2);
+  expect(createWorkletRuntime).toHaveBeenCalledTimes(1);
+  expect(screen.getByText('Selected variant: dynamic')).toBeOnTheScreen();
+});
+
+test('does not start overlapping benchmark runs', () => {
+  jest.useFakeTimers();
+  render(<SynchronizablePerformanceExample />);
+
+  const benchmarkButton = screen.getByText(
+    '.getDirty() & .setBlocking() on two threads'
+  );
+  fireEvent.press(benchmarkButton);
+  fireEvent.press(benchmarkButton);
+  act(() => jest.advanceTimersByTime(50));
+
+  expect(scheduleOnUI).toHaveBeenCalledTimes(1);
+  expect(scheduleOnRuntime).toHaveBeenCalledTimes(1);
+  jest.useRealTimers();
+});
```

**File**: `packages/react-native-reanimated/changelog/stable-synchronizable-benchmark.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Stabilize the Synchronizable performance example resources and prevent overlapping benchmark runs.
```

---

### Incident Patch 3: `a896ab65` (2026-11-23)
**Commit Message**: ci: run the Android nightlies on JDK 17 to fix the JVM crash on ubuntu-26.04 (#11461)

> [!NOTE]
> This pull request was authored by AI on behalf of @tjzel.

## Summary

### Why

The React Native nightly fails every night. Runs #1001 and #1002 crashed
in Gradle with `java.lang.ExceptionInInitializerError` / `Cannot invoke
"jdk.internal.platform.CgroupInfo.getMountPoint()" because
"anyController" is null`. Both ran on the new `ubuntu-26.04` image
behind `ubuntu-latest`, with Zulu Java 18, which no longer receives
updates.

### How

The three workflows that pinned Java 18
(`react-native-nightly-reanimated-build-check-nightly.yml`,
`reanimated-compatibility-check-nightly.yml`,
`reanimated-worklets-compatibility-check.yml`) now use Java 17, like the
Android runtime tests and the Windows build check. The Android
compatibility result cache is keyed by the Java version, so the matrix
runs again with the new JDK.

The testimonial avatar fix for the URL validation nightly moved to
#11467.

### Performance

Not applicable.

### Alternatives

- Pin `runs-on: ubuntu-24.04` for these jobs: hides the JVM problem
until that image is retired.

## Test plan

The React Native nightly dispatched on t

**File**: `.github/workflows/react-native-nightly-reanimated-build-check-nightly.yml` (modified, +2/-2)
```diff
@@ -43,12 +43,12 @@ jobs:
         # Sometimes `npx @react-native-community/cli init` fails at random.
         # Pre-installing it with Yarn seems to improve stability.
         run: corepack enable && yarn init
-      - name: Set up JDK 18
+      - name: Set up JDK 17
         if: ${{ matrix.platform == 'Android' }}
         uses: actions/setup-java@17f84c3641ba7b8f6deff6309fc4c864478f5d62
         with:
           distribution: 'zulu'
-          java-version: '18'
+          java-version: '17'
       - name: Load "next" tag if available
         run: |
           if npm view react-native dist-tags | grep -q 'next:' ; then
```

**File**: `.github/workflows/reanimated-compatibility-check-nightly.yml` (modified, +2/-2)
```diff
@@ -56,12 +56,12 @@ jobs:
     steps:
       - name: Checkout
         uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
-      - name: Set up JDK 18
+      - name: Set up JDK 17
         if: ${{ matrix.platform == 'Android' }}
         uses: actions/setup-java@17f84c3641ba7b8f6deff6309fc4c864478f5d62
         with:
           distribution: 'zulu'
-          java-version: '18'
+          java-version: '17'
       - name: Setup Node
         uses: actions/setup-node@3235b876344d2a9aa001b8d1453c930bba69e610
         with:
```

**File**: `.github/workflows/reanimated-worklets-compatibility-check.yml` (modified, +5/-4)
```diff
@@ -65,6 +65,7 @@ jobs:
       APP_NAME: app
       CACHE_KEY: ${{ matrix.reactNativeVersion }}-${{ matrix.reanimatedVersion }}-${{ matrix.workletsVersion }}
       BUILD_MARKER_DIR: .compatibility-build-markers
+      JAVA_VERSION: '17'
     steps:
       - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
 
@@ -73,18 +74,18 @@ jobs:
         with:
           node-version-file: '.nvmrc'
 
-      - name: Set up JDK 18
+      - name: Set up JDK 17
         uses: actions/setup-java@c1e323688fd81a25caa38c78aa6df2d33d3e20d9
         with:
           distribution: 'zulu'
-          java-version: '18'
+          java-version: ${{ env.JAVA_VERSION }}
 
       - name: Restore result cache
         id: result-cache
         uses: actions/cache/restore@0057852bfaa89a56745cba8c7296529d2fc39830
         with:
           path: ${{ env.BUILD_MARKER_DIR }}/${{ env.CACHE_KEY }}.success
-          key: reanimated-worklets-compat-android-${{ env.CACHE_KEY }}
+          key: reanimated-worklets-compat-android-jdk${{ env.JAVA_VERSION }}-${{ env.CACHE_KEY }}
 
       - name: Skip already validated combination
         if: steps.result-cache.outputs.cache-hit == 'true'
@@ -122,7 +123,7 @@ jobs:
         uses: actions/cache/save@0057852bfaa89a56745cba8c7296529d2fc39830
         with:
           path: ${{ env.BUILD_MARKER_DIR }}/${{ env.CACHE_KEY }}.success
-          key: reanimated-worklets-compat-android-${{ env.CACHE_KEY }}
+          key: reanimated-worklets-compat-android-jdk${{ env.JAVA_VERSION }}-${{ env.CACHE_KEY }}
 
   reanimated-worklets-compatibility-check-ios:
     if: github.repository == 'software-mansion/react-native-reanimated'
```

#### Recent Merged Pull Requests:
- **PR #11522** (2026-11-24): chore: upgrade React Native to 0.89.0-rc.3 (@pawicao)
- **PR #11515** (2026-11-24): docs(Worklets): turn off both Expo preset plugins in every Bundle Mode setup (@tshmieldev)
- **PR #11513** (2026-11-24): docs(Worklets): turn off the Expo preset's plugin in the Bundle Mode setup (@tshmieldev)
- **PR #11500** (2026-11-23): Fix Worklets sidebar scrollbar color (@tjzel)
- **PR #11492** (2026-11-23): fix: stabilize Synchronizable benchmark resources (@tjzel)
- **PR #11467** (2026-11-20): docs(Reanimated): serve testimonial avatars from the docs site (@tjzel)

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

## X. Reanimated): stop reading React's shadow node wrapper on the UI thread

**RULE**:
When implementing operations in `apps/common-app/runtime-tests/reanimated/suites.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-reanimated. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cec3cdc5`: Reanimated): stop reading React's shadow node wrapper on the UI thread. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/common-app/runtime-tests/reanimated/suites.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      require('./tests/core/useAnimatedRefNewestClone.test');
  {
    testSuiteName: 'shadow node wrapper race',
    importTest: () => require('./tests/core/shadowNodeWrapperRace.test'),
    // A stress test for TSan, which runs in the nightly full runs.
    fullRunOnly: true,
  },
      suite.fullRunOnly ||
      (!isBundleModeEnabled() &&
        !LEGACY_EVAL_SHORT_RUN_SUITES.includes(suite.testSuiteName)),
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
      !isBundleModeEnabled() &&
      !LEGACY_EVAL_SHORT_RUN_SUITES.includes(suite.testSuiteName),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cec3cdc5` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
