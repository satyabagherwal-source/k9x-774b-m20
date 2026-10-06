# Forensic Learning Record (Deep Inspection): software-mansion/react-native-reanimated

> **Canonical Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-reanimated-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/software-mansion/react-native-reanimated](https://github.com/software-mansion/react-native-reanimated))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:42:03.186Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-reanimated`
- **Description**: React Native's Animated library reimplemented
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11020 stars

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

### Core Architecture Module: `apps/common-app/src/apps/css/utils/index.ts`
```
export * from './code';
export * from './normalization';

```

### Core Architecture Module: `apps/common-app/src/apps/css/utils/normalization.ts`
```
type KeywordConversions = Record<string, `${number}%` | number>;

type TransformOrigin = Array<number | string> | string;

type NormalizedTransformOrigin = [
  `${number}%` | number,
  `${number}%` | number,
  number,
];

const HORIZONTAL_CONVERSIONS: KeywordConversions = {
  center: '50%',
  left: 0,
  right: '100%',
} satisfies KeywordConversions;

const VERTICAL_CONVERSIONS = {
  bottom: '100%',
  center: '50%',
  top: 0,
} satisfies KeywordConversions;

export const normalizeTransformOrigin = (
  transformOrigin: TransformOrigin
): NormalizedTransformOrigin => {
  const components = Array.isArray(transformOrigin)
    ? transformOrigin
    : transformOrigin.split(/\s+/);

  if (components.length < 1 || components.length > 3) {
    throw new Error(
      `Invalid transformOrigin: ${JSON.stringify(transformOrigin)}. Expected 1-3 values.`
    );
  }

  // Swap x and y components if they are in the wrong order
  if (
    components[0] in VERTICAL_CONVERSIONS &&
    (components[1] === undefined || components[1] in HORIZONTAL_CONVERSIONS)
  ) {
    [components[0], components[1]] = [components[1], components[0]];
  }

  const result = [
    normalizeComponent(components[0] ?? '50%', HORIZONTAL_CONVERSIONS),
    normalizeComponent(components[1] ?? '50%', VERTICAL_CONVERSIONS),
    normalizeComponent(components[2] ?? 0),
  ];

  const validatedResult = validateResult(result);

  if (!validatedResult) {
    throw new Error(
      `Invalid transformOrigin: ${JSON.stringify(transformOrigin)}. Expected 1-3 values.`
    );
  }

  return validatedResult;
};

const normalizeComponent = (
  component: number | string,
  keywords?: KeywordConversions
): `${number}%` | null | number => {
  if (keywords && component in keywords) {
    return keywords[component];
  } else if (typeof component === 'number') {
    return component;
  }

  const num = parseFloat(component);
  if (!isNaN(num)) {
    if (component.endsWith('%') && num !== 0) {
      return `${num}%`;
    }
    return num;
  }

  return null;
};

const validateResult = (
  result: Array<`${number}%` | null | number>
): NormalizedTransformOrigin | null => {
  const nullIdx = result.indexOf(null);

  if (
    nullIdx !== -1 ||
    (result[2] !== undefined && typeof result[2] !== 'number')
  ) {
    return null;
  }

  return result as NormalizedTransformOrigin;
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
  > Fixed in #4239, will be released in 3.1.0 and 2.15.0.

- **Issue #3757** (2024-06-25): **[Android] Views with exiting layout animations aren't removed immediately when a stack screen is popped**
  *Symptoms*: ### Description  #### Current behaviour When a screen containing components with `exiting` layout animations is popped from a stack navigator, the views disappear, but remain mounted in the view hierarchy until their animations end. You can see these views aren't unmounted by using the Layout Inspector tool.  This issue prevents interacting with the UI covered by these invisible views, which is especially noticeable with long exiting animations.  #### Expected behaviour When a screen is popped, all of the components on that screen should be removed immediately, without running their exiting animations  ### Steps to reproduce  In the snack: 1. Press the button to go to the "Test" screen. 2. Go back to the "Home" screen. 3. Try pressing the button to go to the "Test" screen again.  The button will be unresponsive for roughly 20 seconds, while the view from the "Test" screen finishes its `exiting` animation 4. After 20 seconds, the button should work again.  ### Snack or a link to a repository  https://snack.expo.dev/@jwajgelt/long-exiting-layout-animation-causes-views-to-not-be-unmounted-when-screen-is-popped  ### Reanimated version  2.9.1  ### React Native version  0.70.5  ### Platforms  Android  ### JavaScript runtime  _No response_  ### Workflow  _No response_  ### Architecture  _No response_  ### Build type  _No response_  ### Device  _No response_  ### Device model  _No response_  ### Acknowledgements  Yes
  **Post-Mortem & Fix Analysis**:
  > Hey! 👋   It looks like you've omitted a few important sections from the issue template.  Please complete **Description** section.
  > Seeing the same issue on Android for me as well
  > Can happily confirm it is fixed by now in latest Reanimated version (3.12.1) 🥳 

- **Issue #3188** (2022-07-27): **[Android] `measure` giving incorrect values**
  *Symptoms*: ## Description  I'm using `measure` with an animated ref.  On iOS, this works as expected and outputs the right values.  On Android, the values are (as far as I can tell) unrelated to the component's size, and seem to change over time.  ### Expected behavior  I'm animating some text using ReText, and using the final size of that text in a padding animation.  So, at the end of the ReText change, I measure the view that's around the text, and set some padding based on that.  The measure step is where the below console logs come from.  Steps to Reproduce includes a minimal example with more context.  Output of `console.log(measured)` on iOS: ``` {   "height": 17,   "pageX": 174,   "pageY": 296.3333231508732,   "width": 44.66667175292969,   "x": 0,   "y": -0.3333333432674408 } ``` This is great and gives me exactly what I need.  ### Actual behavior  Output of `console.log(measured)` on Android: ``` {   "height": 6.740754805355325e-33,   "pageX": -8.02794075012207,   "pageY": -1.1921103748591122e-7,   "width": 9.219562986332269e-41,   "x": 7.715996607199058e+31,   "y": 5.14818588087719e+22 } ``` These values aren't stable.  For example if I run this again directly afterward (this is after the ReText has stopped resizing), I get: ``` {   "height": -8.048060130728983e+34,   "pageX": -1.6282598256782247e+32,   "pageY": 1.7796490496925177e-43,   "width": 9.219562986332269e-41,   "x": 7.715996607199058e+31,   "y": 5.14818588087719e+22 }, ``
  **Post-Mortem & Fix Analysis**:
  > Running into the same issue. Have you managed to patch this up somehow or did you end up having to use another method for grabbing `width`?
  > Unfortunately I did not find a good way around this, and we ended up changing the design.
  > ##Update For some unknown reason if i change from` <View ref={aRef}>` to `<View ref={aRef} style={style}>`, it gives the proper number...  ##Original Having the same kind of problem. While logging it gave random values https://snack.expo.dev/@boxedition/ripple-measure-random-values  ### Packages Info | Name| Version| | --- | --- | | expo | 45 | | node | 16.14.2 | | react-native-reanimated| 2.8.0 | | react-native-gesture-handler| 2.2.1 | | react| 17.0.2 |  Logs on my end: Object {   "height": 7.673845534663173e+22,   "pageX": -0.00003062416362809017,   "pageY": -5.308031791884105e-12,   "width": 9.183689745645554e-41,   "x": 7.715996607199058e+31,   "y": 5.14818588087719e+22, } Object {   "height": -3.679299364635867e-21,   "pageX": -0.00003062416362809017,   "pageY": -5.308031791884105e-12,   "width": 4.627788178432708e-41,   "x": 7.715996607199058e+31,   "y": 5.14818588087719e+22, } Object {   "height": -4.1168678491221554e-30,   "pageX": -0.00003062

- **Issue #2899** (2022-04-01): **Hot reload iOS crash due to EXC_BAD_ACCESS on rt.global()**
  *Symptoms*: With this issue I'd like to gather all bug reports related to EXC_BAD_ACCESS crash when hot-reloading the app on iOS:  - #2035 (confirmed) - ...  This is how the crash looks like in its natural environment:  ![](https://user-images.githubusercontent.com/20516055/151563308-27911aee-0f95-44e5-93b6-aa5ab4a42408.png)  The crash happens because when `requestRender` lambda is executed, the JS runtime has already been deallocated (as a result of hot-reload). Most likely, this is due to some missing cleanup.  **Note:** This bug is mostly relevant in debug mode during development as the JS runtime gets deallocated when reloading the app. However, it also appears in release builds when using code-push updates. 
  **Post-Mortem & Fix Analysis**:
  > This bug is in the release mode as well. Sometimes we need to reload the app after updating JS code with [code-push](https://github.com/microsoft/code-push)
  > Hi @tomekzaw Does you have plan for fixing this crash in next release?
  > @phamhungvn Yeah, we'll be definitely taking a look on it. It seems to be hard to reproduce, though. Don't know if next release but certainly soon.

- **Issue #2831** (2023-12-14): **__reanimatedHostObjectRef > Attempted to dereference null pointer**
  *Symptoms*: <!-- NOTE: please submit only bug reports here, any new questions or feature requests should be submitted in Discussions: https://github.com/software-mansion/react-native-reanimated/discussions  -->  ## Description  Receiving this crash report from some of the users:  ``` __reanimatedHostObjectRef > Attempted to dereference null pointer.  Thread 3 Crashed: 0   RNReanimated                    0x1039118a4         _ZNSt3__112__hash_tableINS_17__hash_value_typeIPN8facebook3jsi7RuntimeEN10reanimated11RuntimeTypeEEENS_22__unordered_map_hasherIS5_S8_NS_4hashIS5_EENS_8equal_toIS5_EELb1EEENS_21__unordered_map_equalIS5_S8_SD_SB_Lb1EEENS_9allocatorIS8_EEE4findIS5_EENS_15... 1   RNReanimated                    0x103910ed4         reanimated::MutableValue::get 2   jsi                             0x1041df074         facebook::jsc::JSCRuntime::createObject::HostObjectProxy::getProperty 3   JavaScriptCore                  0x3175d8190         <redacted> 4   JavaScriptCore                  0x3175010b8         <redacted> 5   JavaScriptCore                  0x3175eb144         JSObjectGetProperty 6   jsi                             0x1041dd1b0         facebook::jsc::JSCRuntime::getProperty 7   RNReanimated                    0x10393a8e0         reanimated::ShareableValue::adapt 8   RNReanimated                    0x10393ca34         reanimated::ShareableValue::adapt 9   RNReanimated                    0x1039099b4         reanimated::FrozenObject::FrozenObject 10  RNReanim
  **Post-Mortem & Fix Analysis**:
  > Similar to #2775
  > In case it helps, I'm seeing exception reports in Sentry for this, immediately after what appears to be multiple backgrounding events: ![image](https://user-images.githubusercontent.com/450345/162473093-23fbff96-a164-4955-a58a-10946bb5a444.png)  react-native@0.67.4 react-native-reanimated@2.5.0 iOS 15.3.1 
  > Seeing this logged in Sentry with reanimated 2.8.0.  I can also confirm that it seems to happen after backgrounding.  <img width="1293" alt="Screenshot 2022-06-02 at 17 02 12" src="https://user-images.githubusercontent.com/697707/171647031-527813c3-c652-4ceb-9f14-b288fbe7d119.png"> 

- **Issue #2806** (2023-06-22): **Layout Animation with flatlist numColumns > 1**
  *Symptoms*: <!-- NOTE: please submit only bug reports here, any new questions or feature requests should be submitted in Discussions: https://github.com/software-mansion/react-native-reanimated/discussions  -->  ## Description   Hey i was trying to make layout animation with flatlist it works just fine with numColumns 1 but if i try 2 or more than 1 it doesn't work anymore when i delete item or add new one the whole item re render which not happening when numColumns set to 1   ### Expected behavior when add new item or delete it should animate the other item to re order them not re render the whole list again!.   ### Actual behavior & steps to reproduce  https://user-images.githubusercontent.com/70872870/148182776-944a7e96-8179-4893-8c99-9189288c6e84.mov   https://user-images.githubusercontent.com/70872870/148182794-d7820ebb-8029-487e-9b51-2b71aeabca29.mov     ## Snack or minimal code example Flatlist -:  ``` <Animated.FlatList           key={columns ? "oneRow" : "twoRow"}           data={Tasks.data}           numColumns={columns ? 1 : 2}           showsVerticalScrollIndicator={false}           itemLayoutAnimation={Layout}           style={styles.Wrapper}           renderItem={({ item, index }) => (             <List               key={index}               index={index}               item={item}               DeleteHanlder={DeleteHanlder}             />           )}         /> ```  item itself -:  ``` <Animated.View         entering={FadeI
  **Post-Mortem & Fix Analysis**:
  > ## Issue validator  The issue is valid!
  > Did you solve this?
  > > Did you solve this?  no, i even made repo for this issue if anyone want to clone and test it out [here](https://github.com/Majiedo/TwoColumnsReactNative)

- **Issue #2804** (2023-08-04): **Problems with babel-plugin-istanbul**
  *Symptoms*: ## Description  I am trying to instrument my code using ```babel-plugin-istanbul``` but whenever I add that to my plugins list I get always the same error saying that I tried to call function { } from a different thread.  ### Expected behavior  I expect the animations to work with the instrumentation that babel produces.  ### Actual behavior & steps to reproduce  The app does not even start and if you clone the repo and try to run it you'll face the issue.  ## Snack or minimal code example  I've created [this](https://github.com/LeoRedin/reanimated-istanbul) repo to reproduce the error.  ## Package versions  - React Native: 0.66.4 - React Native Reanimated: ^2.3.1 - NodeJS: v14.16.1 - Xcode: 13.1 (13A1030d)  ## Affected platforms  - [x] Android (I marked but I haven't tested, the problem should persist) - [x] iOS - [ ] Web 
  **Post-Mortem & Fix Analysis**:
  > ## Issue validator  The issue is valid!
  > Close due to inactivity

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

### Incident Patch 1: `0d286e61` (2026-10-05)
**Commit Message**: fix(LayoutAnimations): keep the mounted view when React re-creates a view whose removal is withheld (#10795)

> [!NOTE]
> This pull request was authored by AI on behalf of @bartlomiejbloniarz.

## Summary

React can delete a view and later create it again with the same tag:
when a view flattens and unflattens, or when `display: none` (also used
by Suspense) hides and shows it. If the proxy still withholds the
removal, because the view or a descendant is exiting, the re-created tag
meets a view that is still mounted. `reconcileContradictedRemovals()`
then emitted a `Remove` and a `Delete` for the withheld view, and the
same transaction carried React's `Create` and `Insert` for it.

Android does not apply these in order.
`FabricMountingManager::executeMount()` writes all Deletes after the
other items of a batch. `SurfaceMountingManager.createView()` returns
early because the old view still exists, the view is inserted, and the
`Delete` at the end removes its view state. The view stays mounted
without a view state, so every later mutation of it logs `Unable to find
viewState`: `removeViewAt`, `updateLayout` and `deleteView`.

Now such a view keeps its native view. React's `Create` bec

**File**: `apps/common-app/runtime-tests/reanimated/suites.ts` (modified, +6/-0)
```diff
@@ -142,6 +142,12 @@ export const REANIMATED_TEST_SUITES: RuntimeTestSuite[] = [
       require('./tests/layoutAnimations/nestedText.test');
     },
   },
+  {
+    testSuiteName: 'layout animations re-created views',
+    importTest: () => {
+      require('./tests/layoutAnimations/recreatedViews.test');
+    },
+  },
   {
     testSuiteName: 'shared element transitions',
     importTest: () => {
```

**File**: `apps/common-app/runtime-tests/reanimated/tests/layoutAnimations/flattening.test.tsx` (modified, +75/-1)
```diff
@@ -80,15 +80,40 @@ function FlattenedWrapper({
   flat: boolean;
   dropped: DroppedKind;
 }) {
+  const wrapperRef = useTestRef('wrapper');
   const ref = useTestRef('kept');
   return (
-    <View style={flat ? undefined : styles.wrapper}>
+    <View ref={wrapperRef} style={flat ? undefined : styles.wrapper}>
       <Animated.View ref={ref} style={styles.kept} />
       {!flat && <DroppedChild kind={dropped} />}
     </View>
   );
 }
 
+function NestedFlattenedWrappers({
+  flat,
+  flattensOuter,
+  dropped,
+}: {
+  flat: boolean;
+  flattensOuter: boolean;
+  dropped: DroppedKind;
+}) {
+  const outerRef = useTestRef('outer');
+  const innerRef = useTestRef('inner');
+  const keptRef = useTestRef('kept');
+  return (
+    <View
+      ref={outerRef}
+      style={flat && flattensOuter ? undefined : styles.wrapper}>
+      <View ref={innerRef} style={flat ? undefined : styles.wrapper}>
+        <Animated.View ref={keptRef} style={styles.kept} />
+        {!flat && <DroppedChild kind={dropped} />}
+      </View>
+    </View>
+  );
+}
+
 // Y > X > [moved, sibling]. Y unflattens while X flattens in the same commit, so
 // the children of X move to Y. The differ emits the Remove of X before the
 // Removes of its children. `moved` stays mounted throughout, so its FadeOut must
@@ -150,6 +175,8 @@ describe('View flattening', () => {
       await waitForFrames();
       const secondDroppedTags = getDroppedTags(dropped);
       await expectMountedNatively(secondDroppedTags, true);
+      const wrapperTag = getTestComponent('wrapper').getTag();
+      expect(await isViewMountedNatively(wrapperTag)).toBe(true);
       await wait(500);
       await expectMountedNatively(firstDroppedTags, false);
       await render(<FlattenedWrapper flat dropped={dropped} />);
@@ -162,6 +189,53 @@ describe('View flattening', () => {
     }
   );
 
+  test.each(
+    [true, false].flatMap((flattensOuter) =>
+      (['plain', 'nested', 'exiting'] as const).map((dropped) => ({
+        parents: flattensOuter ? 'both parents' : 'the inner parent',
+        flattensOuter,
+        dropped,
+      }))
+    )
+  )(
+    'flattens ${parents} of two nested ones while a child of the inner one is deleted, child: ${dropped}',
+    async ({ flattensOuter, dropped }) => {
+      const renderWrappers = (flat: boolean) =>
+        render(
+          <NestedFlattenedWrappers
+            flat={flat}
+            flattensOuter={flattensOuter}
+            dropped={dropped}
+          />
+        );
+      await renderWrappers(false);
+      await waitForFrames();
+      const tag = getTestComponent('kept').getTag();
+      const outerTag = getTestComponent('outer').getTag();
+      const innerTag = getTestComponent('inner').getTag();
+      const firstDroppedTag = getTestComponent('dropped').getTag();
+      expect(await isViewMountedNatively(firstDroppedTag)).toBe(true);
+
+      await renderWrappers(true);
+      await waitForFrames();
+      // unflattens the wrappers while they may still be withheld for the exiting child
+      await renderWrappers(false);
+      await waitForFrames();
+      const secondDroppedTag = getTestComponent('dropped').getTag();
+      expect(await isViewMountedNatively(outerTag)).toBe(true);
+      expect(await isViewMountedNatively(innerTag)).toBe(true);
+      expect(await isViewMountedNatively(secondDroppedTag)).toBe(true);
+      await renderWrappers(true);
+      await wait(500);
+
+      expect(getTestComponent('kept').getTag()).toBe(tag);
+      expect(await isViewMountedNatively(tag)).toBe(true);
+      expect(await isViewMountedNatively(outerTag)).toBe(!flattensOuter);
+      expect(await isViewMountedNatively(firstDroppedTag)).toBe(false);
+      expect(await isViewMountedNatively(secondDroppedTag)).toBe(false);
+    }
+  );
+
   test.each([false, true])(
     'unflattens a parent while its child flattens, moved child exiting: %s',
     async (exiting) => {
```

**File**: `apps/common-app/runtime-tests/reanimated/tests/layoutAnimations/recreatedViews.test.tsx` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+import React, { Suspense, use } from 'react';
+import type { ViewStyle } from 'react-native';
+import { StyleSheet, View } from 'react-native';
+import Animated, { FadeOut } from 'react-native-reanimated';
+
+import {
+  describe,
+  expect,
+  expectEventually,
+  getTestComponent,
+  render,
+  test,
+  useTestRef,
+  wait,
+  waitForFrames,
+} from '../../../ReJest/RuntimeTestsApi';
+import { ComparisonMode } from '../../../ReJest/types';
+
+const EXIT_MS = 600;
+
+const styles = StyleSheet.create({
+  box: { width: 100, height: 60, backgroundColor: '#2277dd' },
+  hidden: { display: 'none' },
+});
+
+function Box() {
+  const ref = useTestRef('box');
+  return (
+    <Animated.View
+      ref={ref}
+      exiting={FadeOut.duration(EXIT_MS)}
+      style={styles.box}
+    />
+  );
+}
+
+function HiddenBox({ hidden }: { hidden: boolean }) {
+  const ref = useTestRef('box');
+  return (
+    <Animated.View
+      ref={ref}
+      exiting={FadeOut.duration(EXIT_MS)}
+      style={[styles.box, hidden && styles.hidden]}
+    />
+  );
+}
+
+function Wrapper({ style, withBox }: { style?: ViewStyle; withBox: boolean }) {
+  const ref = useTestRef('wrapper');
+  return (
+    <View ref={ref} style={style}>
+      {withBox && <Box />}
+    </View>
+  );
+}
+
+const delays = new Map<string, Promise<void>>();
+
+function Suspending({ dataKey }: { dataKey: string }) {
+  if (!delays.has(dataKey)) {
+    delays.set(
+      dataKey,
+      new Promise((resolve) => setTimeout(resolve, EXIT_MS / 3))
+    );
+  }
+  use(delays.get(dataKey)!);
+  return null;
+}
+
+function SuspendedBox({ dataKey }: { dataKey: string }) {
+  return (
+    <Suspense fallback={<View style={styles.box} />}>
+      <Suspending dataKey={dataKey} />
+      <Box />
+    </Suspense>
+  );
+}
+
+async function expectShownAt(name: string, tag: number) {
+  const component = getTestComponent(name);
+  expect(component.getTag()).toBe(tag);
+  await expectEventually(
+    async () => (await component.getMountedViewProps())?.opacity
+  ).toBe(1, ComparisonMode.FLOAT_DISTANCE);
+}
+
+// On iOS, React Native hides a `display: none` view by leaving it out of the mounted tree, so
+// showing it again creates the same tag while its exit animation still runs.
+describe('Views that React re-creates', () => {
+  test('shows a view again while its exit animation runs', async () => {
+    await render(<HiddenBox hidden={false} />);
+    await waitForFrames();
+    const tag = getTestComponent('box').getTag();
+
+    await render(<HiddenBox hidden />);
+    await wait(EXIT_MS / 3);
+    await render(<HiddenBox hidden={false} />);
+    await wait(EXIT_MS);
+
+    await expectShownAt('box', tag);
+  });
+
+  test('shows a suspended view again while its exit animation runs', async () => {
+    await render(<SuspendedBox dataKey="first" />);
+    await wait(EXIT_MS);
+    const tag = getTestComponent('box').getTag();
+
+    await render(<SuspendedBox dataKey="second" />);
+    await wait(EXIT_MS);
+
+    await expectShownAt('box', tag);
+  });
+
+  // A wrapper without a style flattens, and its removal is withheld while its child exits.
+  test('shows a flattened wrapper again without the props of its earlier commits', async () => {
+    await render(
+      <Wrapper style={{ opacity: 0.5, backgroundColor: '#aa0000' }} withBox />
+    );
+    await waitForFrames();
+    await render(
+      <Wrapper style={{ opacity: 0.5, backgroundColor: '#00aa00' }} withBox />
+    );
+    await waitForFrames();
+    const tag = getTestComponent('wrapper').getTag();
+
+    await render(<Wrapper withBox={false} />);
+    await waitForFrames();
+    await render(
+      <Wrapper style={{ backgroundColor: '#00aa00' }} withBox={false} />
+    );
+    await wait(EXIT_MS);
+
+    await expectShownAt('wrapper', tag);
+  });
+});
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp` (modified, +65/-6)
```diff
@@ -135,6 +135,20 @@ void LayoutAnimationsProxy::warnIfSnapshotIsStale(const ShadowView &snapshot, co
   }
 }
 
+// A layout animation sends its frames to the platform as Updates from its current view.
+const ShadowView &LayoutAnimationsProxy::mountedView(const std::shared_ptr<LightNode> &node) const {
+  const auto tag = node->current.tag;
+  if (const auto animationIt = layoutAnimations_.find(tag); animationIt != layoutAnimations_.end()) {
+    return animationIt->second.currentView;
+  }
+  if (const auto completedAnimationIt = completedAnimations_.find(tag);
+      completedAnimationIt != completedAnimations_.end()) {
+    return completedAnimationIt->second.animation.currentView;
+  }
+  resolveLightNodeProps(node);
+  return node->current;
+}
+
 std::optional<ShadowView> LayoutAnimationsProxy::reparentLayoutAnimation(
     const Tag tag,
     const Tag parentTag,
@@ -190,7 +204,7 @@ std::optional<MountingTransaction> LayoutAnimationsProxy::pullTransaction(
   auto rootChildCount = static_cast<int>(lightNodes_[surfaceId_]->children.size());
   const bool flushStructuralMutations = shouldFlushStructuralMutations();
 
-  reconcileContradictedRemovals(mutations, filteredMutations);
+  reconcileContradictedRemovals(mutations, transaction, propsParserContext);
 
   if constexpr (!StaticFeatureFlags::getFlag("ENABLE_SHARED_ELEMENT_TRANSITIONS")) {
     if (!mutations.empty()) {
@@ -274,6 +288,7 @@ std::optional<MountingTransaction> LayoutAnimationsProxy::pullTransaction(
     keepTransitioningViewsHidden(filteredMutations, propsParserContext);
   }
 
+  react_native_assert(!deletesCreatedTag(filteredMutations) && "Transaction deletes a view that it creates");
   return MountingTransaction{surfaceId, transactionNumber, std::move(filteredMutations), telemetry};
 }
 
@@ -306,23 +321,65 @@ void LayoutAnimationsProxy::unmapLightNode(const std::shared_ptr<LightNode> &nod
 }
 
 // React re-creating a tag whose removal is withheld contradicts that removal, so the withheld node is torn
-// down before updateLightTree registers the tag again.
+// down before updateLightTree registers the tag again. The tag keeps its mounted view: React's Create
+// becomes an Update of it, because Android mounts the Deletes of a transaction after its Creates.
 void LayoutAnimationsProxy::reconcileContradictedRemovals(
     const ShadowViewMutationList &mutations,
-    ShadowViewMutationList &filteredMutations) const {
+    TransactionMeta &transaction,
+    [[maybe_unused]] const PropsParserContext &propsParserContext) const {
+  auto &filteredMutations = transaction.filteredMutations;
+  auto &recreatedTags = transaction.recreatedTags;
   std::vector<std::shared_ptr<LightNode>> recreatedNodes;
   for (const auto &mutation : mutations) {
     if (mutation.type != ShadowViewMutation::Type::Create) {
       continue;
     }
     const auto it = lightNodes_.find(mutation.newChildShadowView.tag);
-    if (it != lightNodes_.end() && it->second->state != LIVE) {
-      recreatedNodes.push_back(it->second);
+    if (it == lightNodes_.end() || it->second->state == LIVE) {
+      continue;
     }
+    const auto &node = it->second;
+    const auto tag = node->current.tag;
+    const auto parent = node->parent.lock();
+    react_native_assert(parent && "Parent node is nullptr");
+    recreatedTags.insert(tag);
+    const auto &mounted = mountedView(node);
+    auto recreated = mutation.newChildShadowView;
+#ifdef ANDROID
+    recreated = resetPropsMissingFrom(recreated, mounted, propsParserContext);
+#endif
+    filteredMutations.push_back(ShadowViewMutation::UpdateMutation(mounted, recreated, parent->current.tag));
+    recreatedNodes.push_back(node);
   }
   tearDown(collectRemovals(recreatedNodes), filteredMutations);
+  std::erase_if(filteredMutations, [&recreatedTags](const ShadowViewMutation &mutation) {
+    return mutation.type == ShadowViewMutation::Delete && recreatedTags.contains(mutation.oldChildShadowView.tag);
+  });
 }
 
+#ifdef ANDROID
+// Android applies the raw props of an Update as they are, so a prop that the mounted view has and the view leaves
+// out is set to null, which resets it.
+ShadowView LayoutAnimationsProxy::resetPropsMissingFrom(
+    const ShadowView &view,
+    const ShadowView &mounted,
+    const PropsParserContext &propsParserContext) const {
+  auto rawProps = view.props->rawProps;
+  for (const auto &[name, _] : mounted.props->rawProps.items()) {
+    if (rawProps.count(name) == 0) {
+      rawProps[name] = nullptr;
+    }
+  }
+  if (rawProps.size() == view.props->rawProps.size()) {
+    return view;
+  }
+  auto newView = view;
+  newView.props = componentDescriptorRegistry_->at(view.componentHandle)
+                      .cloneProps(propsParserContext, view.props, RawProps(std::move(rawProps)));
+  return newView;
+}
+#endif
+
 bool LayoutAnimationsProxy::shouldOverridePullTransaction() const {
   // we need to listen to every possible mutation to keep the light tree updated
   return true;
@@ -413,7 
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.h` (modified, +12/-2)
```diff
@@ -89,6 +89,7 @@ struct TransactionMeta {
   std::vector<std::shared_ptr<LightNode>> containersToRemove;
   std::unordered_map<Tag, Tag> staleSnapshots;
   std::unordered_set<Tag> dueRemovals;
+  std::unordered_set<Tag> recreatedTags;
 };
 
 struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
@@ -148,6 +149,7 @@ struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
 
   std::optional<ShadowView>
   reparentLayoutAnimation(Tag tag, Tag parentTag, const ShadowView &newView, react::Point offset) const;
+  const ShadowView &mountedView(const std::shared_ptr<LightNode> &node) const;
 
   void applyInitialMutationsToLightTree(const ShadowViewMutationList &mutations) const;
   void updateLightNodeProps(
@@ -162,8 +164,16 @@ struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
 
   void applySynchronousProps(const UpdatesBatch &updatesBatch, bool trackInLightTree) const override;
 
-  void reconcileContradictedRemovals(const ShadowViewMutationList &mutations, ShadowViewMutationList &filteredMutations)
-      const;
+  void reconcileContradictedRemovals(
+      const ShadowViewMutationList &mutations,
+      TransactionMeta &transaction,
+      const PropsParserContext &propsParserContext) const;
+#ifdef ANDROID
+  ShadowView resetPropsMissingFrom(
+      const ShadowView &view,
+      const ShadowView &mounted,
+      const PropsParserContext &propsParserContext) const;
+#endif
 
   void handleSharedTransitionsStart(
       const std::shared_ptr<LightNode> &afterTopScreen,
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsUtils.h` (modified, +15/-0)
```diff
@@ -12,6 +12,7 @@
 #include <cstring>
 #include <memory>
 #include <optional>
+#include <unordered_set>
 #include <vector>
 
 namespace reanimated {
@@ -311,4 +312,18 @@ static inline const ViewProps &getViewProps(const ShadowView &view) {
   return static_cast<const ViewProps &>(*view.props);
 }
 
+// Android mounts the Deletes of a transaction after its Creates, so a transaction that deletes and
+// creates one tag loses the created view.
+static inline bool deletesCreatedTag(const ShadowViewMutationList &mutations) {
+  std::unordered_set<Tag> created;
+  for (const auto &mutation : mutations) {
+    if (mutation.type == ShadowViewMutation::Create) {
+      created.insert(mutation.newChildShadowView.tag);
+    }
+  }
+  return std::ranges::any_of(mutations, [&created](const auto &mutation) {
+    return mutation.type == ShadowViewMutation::Delete && created.contains(mutation.oldChildShadowView.tag);
+  });
+}
+
 } // namespace reanimated
```

**File**: `packages/react-native-reanimated/changelog/android-recreated-withheld-view.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix `Unable to find viewState` warnings on Android when a view that flattened while its child was exiting unflattens again before the exit ends.
```

---

### Incident Patch 2: `273575e5` (2026-10-05)
**Commit Message**: fix(LayoutAnimations): don't update a view on Android in the pull before it is removed (#10794)

> [!NOTE]
> This pull request was authored by AI on behalf of @bartlomiejbloniarz.

## Summary

Since #10372, a pull on the Android UI thread does not flush completed
exit removals. It schedules a JS-thread pull that flushes them. The
UI-thread pull still emitted layout animation updates for views that
this JS-thread pull deletes, for example a removed parent that keeps
running its layout transition while its only child exits.

Android's push model holds no lock from a pull to the mount queue, so
the JS-thread batch can reach `MountItemDispatcher` first. The UI thread
then deletes the view and updates it afterwards, and logs `Unable to
find viewState` for `updateLayout` and `updateProps`.

Now every pull first collects the views that the flush removes: the
subtree of each finished exit, and every exiting ancestor that it leaves
without children. The flush removes exactly that set, and a UI-thread
pull on Android skips updates for it. The JS-thread pull removes these
views without a last update, so the order in which Android mounts the
two batches no longer matters.

When React re-create

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp` (modified, +87/-85)
```diff
@@ -59,6 +59,39 @@ std::vector<AncestorOrigin> ancestorOrigins(
   }
   return chain;
 }
+
+void collectSubtreeTags(const std::shared_ptr<LightNode> &node, std::unordered_set<Tag> &tags) {
+  tags.insert(node->current.tag);
+  for (const auto &child : node->children) {
+    collectSubtreeTags(child, tags);
+  }
+}
+
+// Every exiting ancestor that the removals leave without children.
+void collectDroppedAncestors(const std::shared_ptr<LightNode> &node, std::unordered_set<Tag> &removals) {
+  for (auto ancestor = node->parent.lock(); ancestor && ancestor->isExiting() && ancestor->state != ANIMATING;
+       ancestor = ancestor->parent.lock()) {
+    const auto tag = ancestor->current.tag;
+    const auto keepsAChild = std::ranges::any_of(
+        ancestor->children, [&removals](const auto &child) { return !removals.contains(child->current.tag); });
+    if (removals.contains(tag) || keepsAChild) {
+      return;
+    }
+    removals.insert(tag);
+  }
+}
+
+// The subtrees of the roots and the ancestors that they drop.
+std::unordered_set<Tag> collectRemovals(const std::vector<std::shared_ptr<LightNode>> &roots) {
+  std::unordered_set<Tag> removals;
+  for (const auto &root : roots) {
+    collectSubtreeTags(root, removals);
+  }
+  for (const auto &root : roots) {
+    collectDroppedAncestors(root, removals);
+  }
+  return removals;
+}
 } // namespace
 
 std::shared_ptr<LayoutAnimationsProxyRegistry> createLayoutAnimationsProxyDefaultRegistry(
@@ -217,14 +250,15 @@ std::optional<MountingTransaction> LayoutAnimationsProxy::pullTransaction(
   filteredMutations.insert(
       filteredMutations.end(), transaction.teardownMutations.begin(), transaction.teardownMutations.end());
 
+  collectDueRemovals(transaction);
   if (flushStructuralMutations) {
-    flushCompletedRemovals(filteredMutations);
+    tearDown(transaction.dueRemovals, filteredMutations);
   }
 
   configLock.unlock();
   flushLayoutAnimationOperations(lock);
 
-  addOngoingAnimations(filteredMutations);
+  addOngoingAnimations(transaction);
 
   cleanupAnimations(transaction, propsParserContext, flushStructuralMutations);
 
@@ -271,46 +305,22 @@ void LayoutAnimationsProxy::unmapLightNode(const std::shared_ptr<LightNode> &nod
   }
 }
 
-// If React re-creates or re-inserts a tag whose exiting removal we are still
-// withholding, it has contradicted that withheld removal. Flush it now instead
-// of letting the stale node linger: updateLightTree would overwrite its
-// lightNodes_ entry (the "LightNode already exists" assert is compiled out in
-// release), orphaning the still-mounted exiting view, and the eventual
-// removal flush would then remove the wrong, live view and crash the
-// mounting layer.
-//
-// This must run before updateLightTree (so the tag is re-registered cleanly)
-// and before addOngoingAnimations (which would otherwise emit an Update for a
-// tag we are about to Delete this frame).
+// React re-creating a tag whose removal is withheld contradicts that removal, so the withheld node is torn
+// down before updateLightTree registers the tag again.
 void LayoutAnimationsProxy::reconcileContradictedRemovals(
     const ShadowViewMutationList &mutations,
     ShadowViewMutationList &filteredMutations) const {
+  std::vector<std::shared_ptr<LightNode>> recreatedNodes;
   for (const auto &mutation : mutations) {
-    if (mutation.type != ShadowViewMutation::Type::Create && mutation.type != ShadowViewMutation::Type::Insert) {
+    if (mutation.type != ShadowViewMutation::Type::Create) {
       continue;
     }
-    const auto tag = mutation.newChildShadowView.tag;
-    const auto it = lightNodes_.find(tag);
-    if (it == lightNodes_.end() || it->second->state == LIVE) {
-      continue;
-    }
-    const auto node = it->second;
-    completedAnimations_.erase(tag);
-    updateMap_.erase(tag);
-    unmapLightNode(node);
-    const auto parent = node->parent.lock();
-    react_native_assert(parent && "Parent node is nullptr");
-    if (!parent) {
-      continue;
-    }
-    const auto index = parent->removeChild(node);
-    react_native_assert(index != -1 && "Exiting node not found");
-    if (index == -1) {
-      continue;
+    const auto it = lightNodes_.find(mutation.newChildShadowView.tag);
+    if (it != lightNodes_.end() && it->second->state != LIVE) {
+      recreatedNodes.push_back(it->second);
     }
-    endAnimationsRecursively(node, index, filteredMutations);
-    maybeDropAncestors(parent, filteredMutations);
   }
+  tearDown(collectRemovals(recreatedNodes), filteredMutations);
 }
 
 bool LayoutAnimationsProxy::shouldOverridePullTransaction() const {
@@ -427,6 +437,7 @@ void LayoutAnimationsProxy::updateLightTree(
       case ShadowViewMutation::Insert: {
         transferConfigFromNativeID(mutation.newChildShadowView.props->nativeId, mutation.newChildShadowView.tag);
         auto &node = lightNodes_[mutation.newChildShadowView.tag];
+        react_native_assert(node->state == LIVE && "React inserts a view whose
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.h` (modified, +4/-3)
```diff
@@ -88,6 +88,7 @@ struct TransactionMeta {
   std::vector<std::shared_ptr<LightNode>> nodesToRestore;
   std::vector<std::shared_ptr<LightNode>> containersToRemove;
   std::unordered_map<Tag, Tag> staleSnapshots;
+  std::unordered_set<Tag> dueRemovals;
 };
 
 struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
@@ -250,9 +251,10 @@ struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
       const std::shared_ptr<LightNode> &parent,
       TransactionMeta &transaction) const;
   bool holdsSnapshottedScreen(const std::shared_ptr<LightNode> &node) const;
-  void flushCompletedRemovals(ShadowViewMutationList &filteredMutations) const;
+  void collectDueRemovals(TransactionMeta &transaction) const;
+  void tearDown(const std::unordered_set<Tag> &removals, ShadowViewMutationList &mutations) const;
 
-  void addOngoingAnimations(ShadowViewMutationList &mutations) const;
+  void addOngoingAnimations(TransactionMeta &transaction) const;
   ShadowView cloneViewWithoutOpacity(const ShadowView &shadowView, const PropsParserContext &propsParserContext) const;
 
   bool startAnimationsRecursively(
@@ -261,7 +263,6 @@ struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
       StartAnimationsRecursivelyConfig config) const;
   void endAnimationsRecursively(const std::shared_ptr<LightNode> &node, int index, ShadowViewMutationList &mutations)
       const;
-  void maybeDropAncestors(const std::shared_ptr<LightNode> &node, ShadowViewMutationList &cleanupMutations) const;
 
   // MountingOverrideDelegate
 
```

**File**: `packages/react-native-reanimated/changelog/android-update-before-exiting-removal.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix `Unable to find viewState` warnings on Android when a layout animation updates a view in the frame before an exit animation in its subtree removes it.
```

---

### Incident Patch 3: `bd1e94fa` (2026-10-05)
**Commit Message**: fix(LayoutAnimations): show an entering view that only transforms when Android diffs props (#10812)

> [!NOTE]
> This pull request was authored by AI on behalf of @bartlomiejbloniarz.

## Summary

On Android with React Native's `enablePropsUpdateReconciliationAndroid`,
an entering animation that does not animate opacity, such as `ZoomIn` or
`SlideInLeft`, left its view invisible. The proxy inserts the view and
hides it with an Update to opacity 0. The animation then started from
the unhidden view, so its first frame went out as an Update from opacity
1 to opacity 1. With that flag, Android sends only the props that differ
between the two sides of an Update, so the opacity was never sent again.

An entering animation now starts from the hidden view that the host has,
so its first frame sends the opacity. Both proxies do this.

One case is left. When the only frame is dropped (#10811), the opacity
is restored through the shadow tree, which already holds opacity 1. With
this flag the view then stays hidden. The flag is off by default.

**Android, `enablePropsUpdateReconciliationAndroid` on, the screen
below**

<table>
<tr><th>Before</th><th>After</th></tr>
<tr>
<td>


https://github.c

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp` (modified, +2/-1)
```diff
@@ -1110,10 +1110,11 @@ void LayoutAnimationsProxy::startEnteringAnimation(
   const auto opacity = getViewProps(newChildShadowView).opacity;
   const auto &parent = node->parent.lock();
   react_native_assert(parent && "Parent node is nullptr");
+  const PropsParserContext propsParserContext{surfaceId_, *contextContainer_};
   enqueueLayoutAnimation(ManagedLayoutAnimationStart{
       .tag = newChildShadowView.tag,
       .type = LayoutAnimationType::ENTERING,
-      .before = newChildShadowView,
+      .before = cloneViewWithoutOpacity(newChildShadowView, propsParserContext),
       .after = newChildShadowView,
       .parentTag = parent->current.tag,
       .opacity = opacity,
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy_Legacy.cpp` (modified, +4/-4)
```diff
@@ -364,11 +364,10 @@ void LayoutAnimationsProxy_Legacy::handleUpdatesAndEnterings(
           continue;
         }
 
-        startEnteringAnimation(tag, mutation, enteringConfig);
-        filteredMutations.push_back(mutation);
-
         // temporarily set opacity to 0 to prevent flickering on android
         std::shared_ptr<ShadowView> newView = cloneViewWithoutOpacity(mutation, propsParserContext);
+        startEnteringAnimation(tag, mutation, *newView, enteringConfig);
+        filteredMutations.push_back(mutation);
 
         filteredMutations.push_back(
             ShadowViewMutation::UpdateMutation(mutation.newChildShadowView, *newView, parentTag));
@@ -651,14 +650,15 @@ bool LayoutAnimationsProxy_Legacy::shouldOverridePullTransaction() const {
 void LayoutAnimationsProxy_Legacy::startEnteringAnimation(
     const int tag,
     ShadowViewMutation &mutation,
+    const ShadowView &hiddenView,
     const std::shared_ptr<Serializable> &config) const {
 #ifdef LAYOUT_ANIMATIONS_LOGS
   LOG(INFO) << "start entering animation for tag " << tag << std::endl;
 #endif
   enqueueLayoutAnimation(ManagedLayoutAnimationStart{
       .tag = tag,
       .type = LayoutAnimationType::ENTERING,
-      .before = mutation.newChildShadowView,
+      .before = hiddenView,
       .after = mutation.newChildShadowView,
       .parentTag = mutation.parentTag,
       .opacity = getViewProps(mutation.newChildShadowView).opacity,
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy_Legacy.h` (modified, +5/-2)
```diff
@@ -111,8 +111,11 @@ struct LayoutAnimationsProxy_Legacy : public LayoutAnimationsProxyCommon {
   LayoutAnimationsProxy_Legacy(const SurfaceId surfaceId, const LayoutAnimationsProxyDependencies &dependencies)
       : LayoutAnimationsProxyCommon(surfaceId, dependencies) {}
 
-  void startEnteringAnimation(const int tag, ShadowViewMutation &mutation, const std::shared_ptr<Serializable> &config)
-      const;
+  void startEnteringAnimation(
+      const int tag,
+      ShadowViewMutation &mutation,
+      const ShadowView &hiddenView,
+      const std::shared_ptr<Serializable> &config) const;
   void startExitingAnimation(const int tag, ShadowViewMutation &mutation, const std::shared_ptr<Serializable> &config)
       const;
   void startLayoutAnimation(
```

**File**: `packages/react-native-reanimated/changelog/android-entering-props-diff-opacity.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix entering animations that only transform the view, such as `ZoomIn`, leaving the view invisible on Android when React Native diffs props with `enablePropsUpdateReconciliationAndroid`.
```

---

### Incident Patch 4: `653e94b9` (2026-10-05)
**Commit Message**: fix(LayoutAnimations): keep an entering view visible on Android when its only frame is dropped (#10811)

> [!NOTE]
> This pull request was authored by AI on behalf of @bartlomiejbloniarz.

## Summary

With Reduce Motion, an entering animation could leave its view invisible
on Android. The proxy inserts an entering view with opacity 0 and keeps
its opacity to restore later. A frame that animated opacity discarded
the kept opacity as soon as the frame was computed. On Android the first
frames can arrive before the view is mounted, and the proxy drops them.
With Reduce Motion the animation has a single frame. When that frame was
dropped, nothing restored the opacity.

The proxy now discards the kept opacity only when a frame that animates
opacity reaches the host. A dropped frame leaves it for the end of the
animation to restore. Both proxies do this.

The Reduce Motion part of #10806, where most rows of a list are missing,
matches this.

**Android, `[LA] Entering view moved before first paint`, Reduce Motion
on, "Remount, held UI" twice**

<table>
<tr><th>Before</th><th>After</th></tr>
<tr>
<td>


https://github.com/user-attachments/assets/6c863c1f-3eaa-4af6-8273-93693f7f43fb

</td>


**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp` (modified, +2/-1)
```diff
@@ -864,7 +864,8 @@ void LayoutAnimationsProxy::addOngoingAnimations(ShadowViewMutationList &mutatio
     mutations.push_back(
         ShadowViewMutation::UpdateMutation(layoutAnimation.currentView, newView, layoutAnimation.parentTag));
     layoutAnimation.currentView = newView;
-    if (layoutAnimation.opacity && getViewProps(newView).opacity == *layoutAnimation.opacity) {
+    if (layoutAnimation.opacity &&
+        (updateValues.animatesOpacity || getViewProps(newView).opacity == *layoutAnimation.opacity)) {
       layoutAnimation.opacity.reset();
     }
   }
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxyCommon.cpp` (modified, +3/-5)
```diff
@@ -80,12 +80,10 @@ std::optional<SurfaceId> LayoutAnimationsProxyCommon::progressLayoutAnimation(
   }
 
   auto &layoutAnimation = layoutAnimationIt->second;
-  if (newStyle.hasProperty(uiRuntime_, "opacity")) {
-    layoutAnimation.opacity.reset();
-  }
+  const bool animatesOpacity = newStyle.hasProperty(uiRuntime_, "opacity");
 
   auto rawProps = std::make_shared<RawProps>(uiRuntime_, jsi::Value(uiRuntime_, newStyle));
-  if (layoutAnimation.opacity) {
+  if (layoutAnimation.opacity && !animatesOpacity) {
     auto props = (folly::dynamic)*rawProps;
     props["opacity"] = *layoutAnimation.opacity;
     rawProps = std::make_shared<RawProps>(std::move(props));
@@ -97,7 +95,7 @@ std::optional<SurfaceId> LayoutAnimationsProxyCommon::progressLayoutAnimation(
 #endif
   auto newProps = componentDescriptorRegistry_->at(layoutAnimation.finalView.componentHandle)
                       .cloneProps(propsParserContext, layoutAnimation.finalView.props, std::move(*rawProps));
-  updateMap_.insert_or_assign(tag, UpdateValues{newProps, Frame(uiRuntime_, newStyle)});
+  updateMap_.insert_or_assign(tag, UpdateValues{newProps, Frame(uiRuntime_, newStyle), animatesOpacity});
 
   return surfaceId_;
 }
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy_Legacy.cpp` (modified, +2/-1)
```diff
@@ -471,7 +471,8 @@ void LayoutAnimationsProxy_Legacy::addOngoingAnimations(ShadowViewMutationList &
     mutations.push_back(
         ShadowViewMutation::UpdateMutation(layoutAnimation.currentView, newView, layoutAnimation.parentTag));
     layoutAnimation.currentView = newView;
-    if (layoutAnimation.opacity && getViewProps(newView).opacity == *layoutAnimation.opacity) {
+    if (layoutAnimation.opacity &&
+        (updateValues.animatesOpacity || getViewProps(newView).opacity == *layoutAnimation.opacity)) {
       layoutAnimation.opacity.reset();
     }
   }
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsUtils.h` (modified, +1/-0)
```diff
@@ -44,6 +44,7 @@ struct Frame {
 struct UpdateValues {
   Props::Shared newProps;
   Frame frame;
+  bool animatesOpacity = false;
 };
 
 struct Snapshot {
```

**File**: `packages/react-native-reanimated/changelog/android-entering-dropped-frame-opacity.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix views with an `entering` animation that stayed invisible on Android when the only frame of the animation, for example with Reduce Motion, arrived before the view was mounted.
```

---

### Incident Patch 5: `c6833f5f` (2026-10-05)
**Commit Message**: fix(LayoutAnimations): apply a layout change that arrives before an entering animation starts (#10808)

> [!NOTE]
> This pull request was authored by AI on behalf of @pawicao.

## Summary

Fixes #10806.

Since #10537, a layout change that arrives while an `entering` animation
waits for its start on the UI thread updates the target of the
animation, and the proxy drops the Update mutation. The start then
recorded that target as the view that the host has. Android applies a
layout only when the old and the new side of an Update differ, so the
host view kept its mount-time frame, also after the animation ended.

I made the start of an `entering` animation use the view that the Insert
mounted. The first animation frame now carries the layout change to the
host. The view has opacity 0 until that frame, so the old frame is not
visible.

## Test plan

Paste the code below into
`apps/common-app/src/apps/reanimated/examples/EmptyExample.tsx`, build
the Android app in the release variant, and open the `Empty` example.
The ten rows are one under another. Before this change they stay stacked
at the top.

On a Pixel 9a release build, a mount of this layout was wrong in 9 of 15
runs before this 

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxyCommon.cpp` (modified, +6/-7)
```diff
@@ -264,13 +264,12 @@ ShadowView LayoutAnimationsProxyCommon::materializeLayoutAnimation(
     const std::shared_ptr<Serializable> &config) const {
   auto currentView = before;
   const auto activeAnimationIt = layoutAnimations_.find(tag);
-  if (type == LayoutAnimationType::ENTERING) {
-    currentView = after;
-  } else if (activeAnimationIt != layoutAnimations_.end()) {
-    currentView = activeAnimationIt->second.currentView;
-  } else if (const auto completedAnimationIt = completedAnimations_.find(tag);
-             completedAnimationIt != completedAnimations_.end()) {
-    if (!completedAnimationIt->second.shouldRemove) {
+  // An entering view starts from the view that the Insert mounted.
+  if (type != LayoutAnimationType::ENTERING) {
+    if (activeAnimationIt != layoutAnimations_.end()) {
+      currentView = activeAnimationIt->second.currentView;
+    } else if (const auto completedAnimationIt = completedAnimations_.find(tag);
+               completedAnimationIt != completedAnimations_.end() && !completedAnimationIt->second.shouldRemove) {
       currentView = completedAnimationIt->second.animation.currentView;
     }
   }
```

**File**: `packages/react-native-reanimated/changelog/entering-stale-frame.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix a view with an `entering` animation that kept its mount-time frame on Android when its layout changed before the animation started.
```

---

### Incident Patch 6: `4789aace` (2026-10-05)
**Commit Message**: fix(Reanimated): ignore invalid style values with a warning instead of throwing (#10687)

Co-authored-by: tshmieldev <[REDACTED_EMAIL]>

**File**: `docs/docs-reanimated/docs/guides/supported-properties.mdx` (modified, +4/-0)
```diff
@@ -172,6 +172,10 @@ For animating `react-native-svg` components, see [Animating SVG](/docs/guides/an
 
 Style inheritance is not supported. Properties that would normally inherit values (e.g., textDecorationColor inheriting from color) must be provided separately, as inheritance is not implemented.
 
+### Invalid values
+
+A style value that Reanimated cannot process on native, such as `backgroundColor: 'notacolor'` or a transform string with an unknown function, is ignored the way an invalid declaration is ignored in CSS: the property is left out of the keyframe or style it appears in, so the view keeps its current value. In development builds a warning describing the value is logged through the [Reanimated logger](/docs/debugging/logger-configuration) as long as its strict mode is enabled.
+
 ### Relative Margins
 
 Yoga applies relative (%) margins in a different way than the web browser does. In React Native, the margin is added as a space between items without changing dimensions of the se items. As a result, the size of the parent container can change if the total size of its children with added margins exceeds the parent container size.
```

**File**: `packages/react-native-reanimated/changelog/style-values-warn-instead-of-throw.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Ignore invalid style values instead of throwing, which could crash the app from the UI runtime, and warn about them in development. An invalid `filter` now keeps the current filter instead of clearing it, and `null` resets a style property like in React Native instead of being rejected.
```

**File**: `packages/react-native-reanimated/src/common/style/__tests__/createPropsBuilder.test.ts` (modified, +30/-0)
```diff
@@ -62,6 +62,36 @@ const createBuilder = (configOverrides: Partial<TestConfig>) => {
 };
 
 describe(createPropsBuilder, () => {
+  test('omits a property whose value the processor rejects', () => {
+    const builder = createBuilder({
+      width: true,
+      padding: {
+        process: () => {
+          throw new Error('[Reanimated] Invalid padding');
+        },
+      },
+    });
+
+    expect(builder.build({ width: 120, padding: 5 })).toEqual({ width: 120 });
+  });
+
+  test('passes null through without processing it', () => {
+    const process = jest.fn();
+    const builder = createBuilder({ padding: { process } });
+
+    expect(builder.build({ padding: null as never })).toEqual({
+      padding: null,
+    });
+    expect(process).not.toHaveBeenCalled();
+  });
+
+  test('keeps a property whose processor returns undefined', () => {
+    // e.g. `boxShadow: 'none'`, which is sent as null to clear the shadow
+    const builder = createBuilder({ padding: { process: () => undefined } });
+
+    expect(builder.build({ padding: 5 })).toEqual({ padding: undefined });
+  });
+
   test('ignores properties not present in config', () => {
     const builder = createBuilder({ width: true });
 
```

**File**: `packages/react-native-reanimated/src/common/style/__tests__/processStyleValue.test.ts` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+'use strict';
+import { logger } from '../../logger';
+import { processTransform } from '../processors';
+import {
+  processStylePropInPlace,
+  warnIgnoredStyleValue,
+  WARN_MESSAGES,
+} from '../processStyleValue';
+
+const warn = jest.fn();
+logger.warn = warn;
+
+describe(warnIgnoredStyleValue, () => {
+  afterEach(() => {
+    warn.mockClear();
+  });
+
+  test('warns with the error message without its prefix', () => {
+    warnIgnoredStyleValue(new Error('[Reanimated] Invalid value: nope'));
+
+    expect(warn).toHaveBeenCalledTimes(1);
+    expect(warn).toHaveBeenCalledWith(
+      WARN_MESSAGES.ignoredValue('Invalid value: nope'),
+      { strict: true }
+    );
+  });
+
+  test('warns with a value thrown that is not an error', () => {
+    warnIgnoredStyleValue('Invalid value: nope');
+
+    expect(warn).toHaveBeenCalledWith(
+      WARN_MESSAGES.ignoredValue('Invalid value: nope'),
+      { strict: true }
+    );
+  });
+
+  test('does not warn outside development', () => {
+    const globalWithDev = globalThis as unknown as { __DEV__: boolean };
+    const originalDev = globalWithDev.__DEV__;
+    globalWithDev.__DEV__ = false;
+    try {
+      warnIgnoredStyleValue(new Error('[Reanimated] Invalid value: nope'));
+      expect(warn).not.toHaveBeenCalled();
+    } finally {
+      globalWithDev.__DEV__ = originalDev;
+    }
+  });
+});
+
+describe(processStylePropInPlace, () => {
+  afterEach(() => {
+    warn.mockClear();
+  });
+
+  test('replaces the value with the processed one', () => {
+    const props = { opacity: 1, transform: ' rotate(45deg) ' };
+
+    processStylePropInPlace(props, 'transform', processTransform);
+
+    expect(props).toEqual({ opacity: 1, transform: [{ rotate: '45deg' }] });
+  });
+
+  test('removes a rejected value so the prop keeps its current value', () => {
+    const props = { opacity: 1, transform: 'spin(45deg)' };
+
+    processStylePropInPlace(props, 'transform', processTransform);
+
+    expect(props).toEqual({ opacity: 1 });
+    expect(warn).toHaveBeenCalledTimes(1);
+  });
+
+  test('keeps null without processing it', () => {
+    const props = { backgroundColor: null };
+
+    processStylePropInPlace(props, 'backgroundColor', () => {
+      throw new Error('[Reanimated] should not be called');
+    });
+
+    expect(props).toEqual({ backgroundColor: null });
+    expect(warn).not.toHaveBeenCalled();
+  });
+
+  test('keeps an undefined result, which clears the prop', () => {
+    const props = { boxShadow: 'none' };
+
+    processStylePropInPlace(props, 'boxShadow', () => undefined);
+
+    expect(props).toEqual({ boxShadow: undefined });
+    expect('boxShadow' in props).toBe(true);
+  });
+});
```

**File**: `packages/react-native-reanimated/src/common/style/__tests__/stylePropsBuilder.test.ts` (modified, +21/-0)
```diff
@@ -1,8 +1,14 @@
 'use strict';
 
+import { logger } from '../../logger';
 import { ValueProcessorTarget } from '../../types';
+import { ERROR_MESSAGES as COLOR_ERROR_MESSAGES } from '../processors/colors';
+import { WARN_MESSAGES } from '../processStyleValue';
 import { createNativePropsBuilder, stylePropsBuilder } from '../propsBuilder';
 
+const warn = jest.fn();
+logger.warn = warn;
+
 describe('createNativePropsBuilder', () => {
   describe('build without context', () => {
     test('creates builder with boolean config values', () => {
@@ -250,6 +256,21 @@ describe('stylePropsBuilder', () => {
     });
   });
 
+  test.each([
+    ['drop-shadow(0 0 4px notacolor)', 'notacolor'],
+    ['drop-shadow(2em 4em)', '4em'],
+  ])('ignores the invalid filter %s with a warning', (filter, color) => {
+    expect(stylePropsBuilder.build({ filter, opacity: 1 })).toEqual({
+      opacity: 1,
+    });
+    expect(warn).toHaveBeenCalledTimes(1);
+    expect(warn).toHaveBeenCalledWith(
+      WARN_MESSAGES.ignoredValue(COLOR_ERROR_MESSAGES.invalidColor(color)),
+      { strict: true }
+    );
+    warn.mockClear();
+  });
+
   test('trims every padded value of a multi-property style', () => {
     expect(
       stylePropsBuilder.build({
```

**File**: `packages/react-native-reanimated/src/common/style/createPropsBuilder.ts` (modified, +15/-2)
```diff
@@ -6,7 +6,7 @@ import type {
 } from '../types';
 import { ValueProcessorTarget } from '../types';
 import { isRecord } from '../utils';
-import { processStyleValue } from './processStyleValue';
+import { processStyleValue, warnIgnoredStyleValue } from './processStyleValue';
 
 const MAX_PROCESS_DEPTH = 10;
 
@@ -94,7 +94,20 @@ export default function createPropsBuilder<
           continue;
         }
 
-        const processedValue = processStyleValue(configValue, value, context);
+        // null resets the prop, the same as in React Native, so there is
+        // nothing to process.
+        if (value === null) {
+          result[property] = null;
+          continue;
+        }
+
+        let processedValue;
+        try {
+          processedValue = processStyleValue(configValue, value, context);
+        } catch (error) {
+          warnIgnoredStyleValue(error);
+          continue;
+        }
 
         if (isRecord(processedValue) && !isRecord(value)) {
           // The value processor may return multiple values for a single property
```

**File**: `packages/react-native-reanimated/src/common/style/processStyleValue.ts` (modified, +47/-0)
```diff
@@ -1,7 +1,9 @@
 'use strict';
 
+import { logger } from '../logger';
 import type {
   NonMutable,
+  UnknownRecord,
   ValueProcessor,
   ValueProcessorContext,
 } from '../types';
@@ -19,3 +21,48 @@ export function processStyleValue<V, R>(
   ) as NonMutable<V>;
   return processor(normalizedValue, context);
 }
+
+// Thrown errors carry the prefix that the logger adds on its own.
+const ERROR_PREFIX = '[Reanimated] ';
+
+export const WARN_MESSAGES = {
+  ignoredValue(reason: string) {
+    'worklet';
+    return `${reason}\nThe value is ignored.`;
+  },
+};
+
+/**
+ * Reports a style value that a processor rejected. The value is ignored like an
+ * invalid CSS declaration instead of throwing, which on the UI runtime would
+ * crash the app.
+ */
+export function warnIgnoredStyleValue(error: unknown) {
+  'worklet';
+  if (__DEV__) {
+    const message = error instanceof Error ? error.message : String(error);
+    const reason = message.replace(ERROR_PREFIX, '');
+    logger.warn(WARN_MESSAGES.ignoredValue(reason), { strict: true });
+  }
+}
+
+/**
+ * Processes `props[key]` in place. A rejected value is removed, so the prop
+ * keeps its current value.
+ */
+export function processStylePropInPlace<V, R>(
+  props: UnknownRecord,
+  key: string,
+  processor: ValueProcessor<V, R>
+) {
+  'worklet';
+  if (props[key] === null) {
+    return;
+  }
+  try {
+    props[key] = processStyleValue(processor, props[key] as NonMutable<V>);
+  } catch (error) {
+    warnIgnoredStyleValue(error);
+    delete props[key];
+  }
+}
```

**File**: `packages/react-native-reanimated/src/common/style/processors/__tests__/colors.android.test.ts` (modified, +15/-5)
```diff
@@ -1,4 +1,6 @@
 'use strict';
+import { logger } from '../../../logger';
+import { WARN_MESSAGES } from '../../processStyleValue';
 import {
   DynamicColorIOS,
   ERROR_MESSAGES,
@@ -7,16 +9,24 @@ import {
   processColorsInProps,
 } from '../colors';
 
+const warn = jest.fn();
+logger.warn = warn;
+
 describe('DynamicColorIOS support on Android', () => {
-  test('processColorsInProps throws for DynamicColorIOS', () => {
+  test('processColorsInProps ignores DynamicColorIOS with a warning', () => {
     const props = {
+      opacity: 0.5,
       backgroundColor: DynamicColorIOS({ light: '#ffffff', dark: '#000000' }),
     };
 
-    expect(() => processColorsInProps(props)).toThrow(
-      new Error(
-        `[Reanimated] ${ERROR_MESSAGES.dynamicNotAvailableOnPlatform()}`
-      )
+    processColorsInProps(props);
+
+    expect(props).toEqual({ opacity: 0.5 });
+    expect(warn).toHaveBeenCalledWith(
+      WARN_MESSAGES.ignoredValue(
+        ERROR_MESSAGES.dynamicNotAvailableOnPlatform()
+      ),
+      { strict: true }
     );
   });
 
```

---

### Incident Patch 7: `7e30b2ef` (2026-10-05)
**Commit Message**: docs: fix withClamp config table rendering (#10807)

## Summary

The `config` table on the `withClamp` page rendered as raw pipes and
dashes. Its header row had two cells (`Type Description` was missing a
`|`) while the delimiter row had three, so Markdown did not treat the
block as a table.

This PR splits the header into `Name | Type | Description` on the 4.x
page and on the 3.x versioned copy, which had the same typo. No other
docs table has a header/delimiter column mismatch.

**Docs — `withClamp`, dark theme**

<table>
<tr><th>Before</th><th>After</th></tr>
<tr>
<td>


![Before](https://github.com/user-attachments/assets/bf307823-de77-40b7-8101-1a6a21e31d53)

</td>
<td>


![After](https://github.com/user-attachments/assets/f95e1be8-278c-4bcc-92d2-38aa4a343dc3)

</td>
</tr>
</table>

## Test plan

- Run `yarn docusaurus start` in `docs/docs-reanimated` and open
`/docs/animations/withClamp`. The `config` arguments render as a
three-column table.
- `yarn format:md` passes.

## Changelog

- [x] I added a changelog fragment with `yarn changelog:add` for each
changed package, or this PR does not change `react-native-reanimated` or
`react-native-worklets`.

**File**: `docs/docs-reanimated/docs/animations/withClamp.mdx` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ function App() {
 
 An object with following properties:
 
-| Name             | Type Description |
+| Name             | Type             | Description |
 | ---------------- | ---------------- | ------------------------------------------------ |
 | min <Optional/> | `number`         | The lowest value your animation can ever reach   |
 | max <Optional/> | `number`         | The greatest value your animation can ever reach |
```

**File**: `docs/docs-reanimated/versioned_docs/version-3.x/animations/withClamp.mdx` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ function App() {
 
 An object with following properties:
 
-| Name             | Type Description |
+| Name             | Type             | Description |
 | ---------------- | ---------------- | ------------------------------------------------ |
 | min <Optional/> | `number`         | The lowest value your animation can ever reach   |
 | max <Optional/> | `number`         | The greatest value your animation can ever reach |
```

---

### Incident Patch 8: `7cb92821` (2026-10-02)
**Commit Message**: fix: keep synchronously updated props when a mount inserts a view again (#10800)

> [!NOTE]
> This pull request was authored by AI on behalf of @pawicao.

## Summary

With `IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS` on, a view showed old values of
its animated props for one or two frames after a commit moved it to
another position in its parent. On iOS, I made the Insert mutation of
such a view carry the props that the view holds when the mount reaches
it, so the Insert changes nothing on the view. The code is in the plain
moved-Insert branch of `LayoutAnimationsProxy::updateLightTree`. On
Android the defect exists only with React Native's
`enableAccumulatedUpdatesInRawPropsAndroid` flag; there I merged the
synchronous values of the updates registry into the Insert.

### Why Insert differs from Update

A synchronous write changes the props of the view and does not change
the shadow tree. The shadow node keeps the values of the last React
commit.

- **Update:** iOS writes props only when the shadow node has a new props
object
([`RCTMountingManager.mm:112`](https://github.com/facebook/react-native/blob/v0.88.0-rc.1/packages/react-native/React/Fabric/Mounting/RCTMountingManager.mm#L112)).
A s

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/updates/UpdatesRegistry.cpp` (modified, +15/-0)
```diff
@@ -37,6 +37,21 @@ void UpdatesRegistry::mergeInto(const Tag tag, folly::dynamic &target) const {
   target.update(it->second.second);
 }
 
+#ifdef ANDROID
+void UpdatesRegistry::mergeInto(const Tag tag, folly::dynamic &target, const PropNamePredicate isIncluded) const {
+  react_native_assert(UpdatesRegistryManager::isLockedByCurrentThread());
+  auto it = updatesRegistry_.find(tag);
+  if (it == updatesRegistry_.cend()) {
+    return;
+  }
+  for (const auto &[name, value] : it->second.second.items()) {
+    if (isIncluded(name.getString())) {
+      target[name] = value;
+    }
+  }
+}
+#endif // ANDROID
+
 void UpdatesRegistry::remove(const Tag tag) {
   react_native_assert(UpdatesRegistryManager::isLockedByCurrentThread());
   removeTag(tag);
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/updates/UpdatesRegistry.h` (modified, +5/-0)
```diff
@@ -29,6 +29,8 @@ struct AnimatedPropsEntry {
 };
 using UpdatesBatchAnimatedProps = std::vector<AnimatedPropsEntry>;
 
+using PropNamePredicate = bool (*)(const std::string &);
+
 using RegistryMap = std::unordered_map<Tag, std::pair<ShadowNodeFamily::Shared, folly::dynamic>>;
 
 #ifdef ANDROID
@@ -48,6 +50,9 @@ class UpdatesRegistry {
   virtual bool isEmpty() const;
   folly::dynamic get(Tag tag) const;
   void mergeInto(Tag tag, folly::dynamic &target) const;
+#ifdef ANDROID
+  void mergeInto(Tag tag, folly::dynamic &target, PropNamePredicate isIncluded) const;
+#endif
   void remove(Tag tag);
 
 #ifdef ANDROID
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/updates/UpdatesRegistryManager.cpp` (modified, +10/-0)
```diff
@@ -115,6 +115,16 @@ void UpdatesRegistryManager::mergeRegistryProps(const Tag viewTag, folly::dynami
 
 #ifdef ANDROID
 
+void UpdatesRegistryManager::mergeRegistryProps(
+    const Tag viewTag,
+    folly::dynamic &target,
+    const PropNamePredicate isIncluded) {
+  react_native_assert(isLockedByCurrentThread());
+  for (const auto &registry : registries_) {
+    registry->mergeInto(viewTag, target, isIncluded);
+  }
+}
+
 bool UpdatesRegistryManager::hasPropsToRevert() {
   react_native_assert(isLockedByCurrentThread());
   for (auto &registry : registries_) {
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/updates/UpdatesRegistryManager.h` (modified, +3/-0)
```diff
@@ -49,6 +49,9 @@ class UpdatesRegistryManager {
   void handleNodeRemovals(const RootShadowNode &rootShadowNode);
   PropsMap collectProps();
   void mergeRegistryProps(Tag viewTag, folly::dynamic &target);
+#ifdef ANDROID
+  void mergeRegistryProps(Tag viewTag, folly::dynamic &target, PropNamePredicate isIncluded);
+#endif
 
 #ifdef ANDROID
   bool hasPropsToRevert();
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp` (modified, +7/-2)
```diff
@@ -457,8 +457,13 @@ void LayoutAnimationsProxy::updateLightTree(
             filteredMutations.push_back(
                 ShadowViewMutation::InsertMutation(mutation.parentTag, node->previous, hostIndex));
           } else {
-            filteredMutations.push_back(
-                ShadowViewMutation::InsertMutation(mutation.parentTag, mutation.newChildShadowView, hostIndex));
+            auto view = mutation.newChildShadowView;
+            const auto updatedViewIt = updatedViews.find(tag);
+            const bool propsChanged = updatedViewIt != updatedViews.end() && updatedViewIt->second.props != view.props;
+            if (!propsChanged) {
+              view.props = propsOfMountedView(view);
+            }
+            filteredMutations.push_back(ShadowViewMutation::InsertMutation(mutation.parentTag, view, hostIndex));
           }
         } else if (enteringConfig) {
           transaction.entering.push_back({node, enteringConfig});
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxyCommon.cpp` (modified, +19/-0)
```diff
@@ -156,6 +156,25 @@ void LayoutAnimationsProxyCommon::flushLayoutAnimationOperations(std::unique_loc
   flushLayoutAnimationOperationsLocked();
 }
 
+// iOS, and Android with accumulated raw props, write the props of an Insert to the view. The shadow props of a view
+// that only moves lack the values that were written synchronously.
+Props::Shared LayoutAnimationsProxyCommon::propsOfMountedView(const ShadowView &view) const {
+#ifdef __APPLE__
+  if (readMountedViewProps_) {
+    if (auto mountedProps = readMountedViewProps_(view.tag)) {
+      return mountedProps;
+    }
+  }
+#elif defined(ANDROID)
+  if (readSynchronousProps_) {
+    if (const auto synchronousProps = readSynchronousProps_(view.tag); !synchronousProps.empty()) {
+      return mergeSynchronousProps(view, synchronousProps);
+    }
+  }
+#endif
+  return view.props;
+}
+
 Props::Shared LayoutAnimationsProxyCommon::mergeSynchronousProps(const ShadowView &view, const folly::dynamic &props)
     const {
   auto rawProps = props;
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxyCommon.h` (modified, +17/-1)
```diff
@@ -63,6 +63,10 @@ struct LayoutAnimationCancellation {
 using LayoutAnimationOperation =
     std::variant<ManagedLayoutAnimationStart, ProgressLayoutAnimationStart, LayoutAnimationCancellation>;
 
+#ifdef ANDROID
+using SynchronousPropsReader = std::function<folly::dynamic(Tag tag)>;
+#endif
+
 struct LayoutAnimationsProxyDependencies {
   std::shared_ptr<LayoutAnimationsManager> layoutAnimationsManager;
   SharedComponentDescriptorRegistry componentDescriptorRegistry;
@@ -74,9 +78,11 @@ struct LayoutAnimationsProxyDependencies {
 #ifdef ANDROID
   PreserveMountedTagsFunction filterUnmountedTagsFunction;
   std::shared_ptr<facebook::react::CallInvoker> jsInvoker;
+  SynchronousPropsReader readSynchronousProps;
 #endif
 #ifdef __APPLE__
   ForceScreenSnapshotFunction forceScreenSnapshot;
+  ReadMountedViewPropsFunction readMountedViewProps;
 #endif
 };
 
@@ -95,7 +101,12 @@ class LayoutAnimationsProxyCommon : public facebook::react::MountingOverrideDele
 #ifdef ANDROID
         ,
         preserveMountedTags_(dependencies.filterUnmountedTagsFunction),
-        jsInvoker_(dependencies.jsInvoker)
+        jsInvoker_(dependencies.jsInvoker),
+        readSynchronousProps_(dependencies.readSynchronousProps)
+#endif
+#ifdef __APPLE__
+        ,
+        readMountedViewProps_(dependencies.readMountedViewProps)
 #endif
   {
   }
@@ -115,6 +126,7 @@ class LayoutAnimationsProxyCommon : public facebook::react::MountingOverrideDele
   void flushLayoutAnimationOperations() const;
 
  protected:
+  Props::Shared propsOfMountedView(const ShadowView &view) const;
   Props::Shared mergeSynchronousProps(const ShadowView &view, const folly::dynamic &props) const;
   bool hasLayoutAnimationRecords() const;
   void applySynchronousPropsToLayoutAnimation(Tag tag, const folly::dynamic &props) const;
@@ -169,6 +181,10 @@ class LayoutAnimationsProxyCommon : public facebook::react::MountingOverrideDele
 #ifdef ANDROID
   PreserveMountedTagsFunction preserveMountedTags_;
   std::shared_ptr<facebook::react::CallInvoker> jsInvoker_;
+  SynchronousPropsReader readSynchronousProps_;
+#endif
+#ifdef __APPLE__
+  ReadMountedViewPropsFunction readMountedViewProps_;
 #endif
 
  private:
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/SharedTransitions.cpp` (modified, +7/-8)
```diff
@@ -493,21 +493,20 @@ void LayoutAnimationsProxy::hideTransitioningViews(
 }
 
 // The hide in hideTransitioningViews is not stored in the light tree, so a
-// later Update for the same view carries full opacity and would show the view
-// again. Force opacity 0 on every outgoing Update for a hidden view until the
-// restore in cleanupSharedTransitions removes its tag from hiddenViewTags_.
+// later Update or Insert for the same view carries full opacity and would show
+// the view again. Force opacity 0 on every outgoing Update and Insert for a
+// hidden view until the restore in cleanupSharedTransitions removes its tag
+// from hiddenViewTags_.
 void LayoutAnimationsProxy::keepTransitioningViewsHidden(
     ShadowViewMutationList &filteredMutations,
     const PropsParserContext &propsParserContext) const {
   if (hiddenViewTags_.empty()) {
     return;
   }
   for (auto &mutation : filteredMutations) {
-    if (mutation.type == ShadowViewMutation::Update && hiddenViewTags_.contains(mutation.newChildShadowView.tag)) {
-      mutation = ShadowViewMutation::UpdateMutation(
-          mutation.oldChildShadowView,
-          cloneViewWithoutOpacity(mutation.newChildShadowView, propsParserContext),
-          mutation.parentTag);
+    const bool writesProps = mutation.type == ShadowViewMutation::Update || mutation.type == ShadowViewMutation::Insert;
+    if (writesProps && hiddenViewTags_.contains(mutation.newChildShadowView.tag)) {
+      mutation.newChildShadowView = cloneViewWithoutOpacity(mutation.newChildShadowView, propsParserContext);
     }
   }
 }
```

---

### Incident Patch 9: `d5c4d347` (2026-10-02)
**Commit Message**: feat(Worklets): cross-runtime stack traces for scheduleOnRN and runOnRNSync (#10798)

## Summary

Stacked on #10767. In debug builds, `scheduleOnRN` and
`experimental_runOnRNSync` now pass the caller's schedule stack, so
errors thrown on the RN Runtime show the RN frames labeled `[RN]`
followed by the calling worklet's stack, like the other scheduling
functions.

## Test plan

New `Error traces from RN` runtime tests (scheduleOnRN from UI and
Worker, runOnRNSync caught and uncaught) pass on the iOS simulator.

**File**: `apps/common-app/runtime-tests/worklets/tests/runtimes/errorTraces.test.tsx` (modified, +82/-0)
```diff
@@ -1,4 +1,6 @@
 import {
+  runOnRNSync,
+  isBundleModeEnabled,
   runOnUISync,
   scheduleOnUI,
   scheduleOnRuntime,
@@ -150,3 +152,83 @@ describe('Error traces from UI', () => {
     expect(errorData?.stack).not.toInclude('at [UI]: functionNameJob3');
   });
 });
+
+describe('Error traces from RN', () => {
+  let errorData: Error | null = null;
+  let caughtStack = '';
+
+  const [testRuntime] = getWorkletRuntimesFromPool(1);
+
+  beforeEach(() => {
+    caughtStack = '';
+    // eslint-disable-next-line @typescript-eslint/no-unused-vars
+    globalThis.__reportFatalRemoteError = (a: Error, _: boolean) => {
+      errorData = a;
+      notify('errorReported');
+    };
+  });
+
+  afterEach(() => {
+    globalThis.__reportFatalRemoteError = originalReportFatalRemoteError;
+  });
+
+  function functionNameRN() {
+    throw new Error();
+  }
+
+  const reportCaughtStack = (stack: string) => {
+    caughtStack = stack;
+    notify('stackCaught');
+  };
+
+  test('scheduleOnRN from UI has good stack trace added', async () => {
+    scheduleOnUI(function functionNameUICaller() {
+      'worklet';
+      scheduleOnRN(functionNameRN);
+    });
+
+    await waitForNotification('errorReported');
+    expect(errorData?.stack).toInclude('at [RN]: functionNameRN');
+    expect(errorData?.stack).toInclude('functionNameUICaller');
+  });
+
+  test('scheduleOnRN from a Worker Runtime has good stack trace added', async () => {
+    scheduleOnRuntime(testRuntime, function functionNameWorkerCaller() {
+      'worklet';
+      scheduleOnRN(functionNameRN);
+    });
+
+    await waitForNotification('errorReported');
+    expect(errorData?.stack).toInclude('at [RN]: functionNameRN');
+    expect(errorData?.stack).toInclude('functionNameWorkerCaller');
+  });
+
+  if (isBundleModeEnabled()) {
+    test('runOnRNSync rethrows with the RN stack and the caller stack', async () => {
+      scheduleOnUI(function functionNameSyncCaller() {
+        'worklet';
+        try {
+          runOnRNSync(functionNameRN);
+        } catch (error) {
+          scheduleOnRN(reportCaughtStack, (error as Error).stack ?? '');
+        }
+      });
+
+      await waitForNotification('stackCaught');
+      expect(caughtStack).toInclude('at [RN]: functionNameRN');
+      expect(caughtStack).toInclude('functionNameSyncCaller');
+    });
+
+    test('uncaught runOnRNSync error keeps RN frames and labels UI frames', async () => {
+      scheduleOnUI(function functionNameUncaughtCaller() {
+        'worklet';
+        runOnRNSync(functionNameRN);
+      });
+
+      await waitForNotification('errorReported');
+      expect(errorData?.stack).toInclude('at [RN]: functionNameRN');
+      expect(errorData?.stack).toInclude('at [UI]: functionNameUncaughtCaller');
+      expect(errorData?.stack).not.toInclude('[UI]: [RN]');
+    });
+  }
+});
```

**File**: `docs/docs-worklets/docs/threading/runOnRNSync.mdx` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ Arguments to pass to the function. They must be convertible to a [Serializable](
 
 - When called on the RN Runtime, `runOnRNSync` calls the function directly.
 - On the UI Runtime and Worker Runtimes, `runOnRNSync` works only with the [Bundle Mode](/docs/bundleMode/).
-- An error thrown by the function is rethrown on the calling runtime with the same message and stack.
+- An error thrown by the function is rethrown on the calling runtime with the same message. In development builds its stack holds the RN Runtime frames, labeled `[RN]`, followed by the stack of the `runOnRNSync` call.
 - The calling thread is blocked while the JavaScript thread runs the function. Don't call `runOnRNSync` in code that runs every frame.
 - `runOnRNSync` deadlocks if the JavaScript thread is waiting for the calling runtime at the same time. For example, a worklet on the UI Runtime must not call `runOnRNSync` while the RN Runtime waits in [`runOnUISync`](/docs/threading/runOnUISync) for the UI Runtime. Calling `runOnRNSync` from inside `runOnUISync` is safe, because that worklet already runs on the JavaScript thread.
 
```

**File**: `packages/react-native-worklets/Common/cpp/worklets/NativeModules/JSIWorkletsModuleProxy.cpp` (modified, +69/-23)
```diff
@@ -143,11 +143,33 @@ runOnRuntimeSync(jsi::Runtime &rt, const jsi::Value &workletRuntimeValue, const
 }
 #endif // NDEBUG
 
+template <typename TCall>
+void callOnRN(
+    [[maybe_unused]] const std::shared_ptr<JSScheduler> &jsScheduler,
+    [[maybe_unused]] jsi::Runtime &rnRuntime,
+    [[maybe_unused]] const std::optional<std::string> &scheduleStack,
+    TCall &&call) {
+#ifndef NDEBUG
+  try {
+    call();
+  } catch (jsi::JSError &error) {
+    JSLogger::handleJSError(jsScheduler, rnRuntime, RuntimeData::rnRuntimeName, error, scheduleStack);
+  }
+#else
+  call();
+#endif // NDEBUG
+}
+
 jsi::Value runOnRNSync(
     const std::shared_ptr<JSScheduler> &jsScheduler,
     jsi::Runtime &rt,
     const jsi::Value &funValue,
-    const jsi::Value &argsValue) {
+    const jsi::Value &argsValue
+#ifndef NDEBUG
+    ,
+    const std::optional<std::string> &scheduleStack
+#endif // NDEBUG
+) {
   const auto funObject = funValue.getObject(rt);
   std::shared_ptr<Serializable> serializableFun;
   std::optional<jsi::HostFunctionType> hostFun;
@@ -184,7 +206,12 @@ jsi::Value runOnRNSync(
                 rnRuntime, rnRuntime.global().getPropertyAsFunction(rnRuntime, "__serializer").call(rnRuntime, result));
     } catch (const jsi::JSError &error) {
       errorMessage = error.getMessage();
+#ifndef NDEBUG
+      errorStack =
+          JSLogger::joinStacks(error.getMessage(), error.getStack(), RuntimeData::rnRuntimeName, scheduleStack);
+#else
       errorStack = error.getStack();
+#endif // NDEBUG
     } catch (const std::exception &error) {
       errorMessage = error.what();
     }
@@ -473,41 +500,52 @@ jsi::Object JSIWorkletsModuleProxy::toOptimizedObject(jsi::Runtime &rt) const {
         registerCustomSerializable(runtimeManager, memoryManager, determine, pack, unpack, typeId);
       });
 
-  jsi_utils::addMethod<2>(
+  jsi_utils::addMethod<3>(
       rt,
       obj,
       "scheduleOnRN",
-      [jsScheduler = jsScheduler_](jsi::Runtime &rt, const jsi::Value &, const jsi::Value(&args)[2]) {
+      [jsScheduler = jsScheduler_](jsi::Runtime &rt, const jsi::Value &, const jsi::Value(&args)[3]) {
         const auto &fun = at<0>(args).getObject(rt).getFunction(rt);
         const auto &remoteArgs = at<1>(args);
 
         auto serializableArgs = remoteArgs.isUndefined()
             ? nullptr
             : extractSerializableOrThrow<SerializableArray>(rt, remoteArgs, "[Worklets] Args must be an array.");
 
+        std::optional<std::string> scheduleStack;
+        if (at<2>(args).isString()) {
+          scheduleStack = at<2>(args).asString(rt).utf8(rt);
+        }
+
         if (!fun.getProperty(rt, "__remoteFunction").isUndefined()) [[likely]] {
           const auto remoteFunction = extractSerializableOrThrow<SerializableRemoteFunction>(rt, fun);
-          jsScheduler->scheduleOnJS([remoteFunction, serializableArgs](jsi::Runtime &rnRuntime) {
-            const auto unpackedFun = remoteFunction->toJSValue(rnRuntime).getObject(rnRuntime).getFunction(rnRuntime);
-            if (serializableArgs == nullptr) {
-              // fast path for remote function w/o arguments
-              unpackedFun.call(rnRuntime);
-            } else {
-              const auto args = serializableArgs->getJSIValueArr(rnRuntime);
-              unpackedFun.call(rnRuntime, args.data(), args.size());
-            }
+          jsScheduler->scheduleOnJS([jsScheduler, remoteFunction, serializableArgs, scheduleStack](
+                                        jsi::Runtime &rnRuntime) {
+            callOnRN(jsScheduler, rnRuntime, scheduleStack, [&]() {
+              const auto unpackedFun = remoteFunction->toJSValue(rnRuntime).getObject(rnRuntime).getFunction(rnRuntime);
+              if (serializableArgs == nullptr) {
+                // fast path for remote function w/o arguments
+                unpackedFun.call(rnRuntime);
+              } else {
+                const auto args = serializableArgs->getJSIValueArr(rnRuntime);
+                unpackedFun.call(rnRuntime, args.data(), args.size());
+              }
+            });
           });
         } else if (fun.isHostFunction(rt)) {
           auto hostFun = fun.getHostFunction(rt);
-          jsScheduler->scheduleOnJS([hostFun = std::move(hostFun), serializableArgs](jsi::Runtime &rnRuntime) {
-            if (serializableArgs == nullptr) {
-              // fast path for host function w/o arguments
-              hostFun(rnRuntime, jsi::Value::undefined(), nullptr, 0);
-            } else {
-              const auto args = serializableArgs->getJSIValueArr(rnRuntime);
-              hostFun(rnRuntime, jsi::Value::undefined(), args.data(), args.size());
-            }
-          });
+          jsScheduler->scheduleOnJS(
+              [jsScheduler, hostFun = std::move(hostFun), serializableArgs, scheduleStack](jsi::Runtime &rnRuntime) {
+                callOnRN(jsScheduler, rnRuntime, scheduleStack, [&]() {
+                  if (serializableArgs == nullptr) {
+      
```

**File**: `packages/react-native-worklets/Common/cpp/worklets/Tools/JSLogger.cpp` (modified, +20/-3)
```diff
@@ -53,7 +53,15 @@ static std::string labelStackFrames(const std::string &rawStack, const std::stri
   while (pos != std::string::npos) {
     size_t next = rawStack.find(sep, pos + sep.size());
     size_t end = (next == std::string::npos) ? rawStack.size() : next;
-    result += "\n    at [" + label + "]:" + rawStack.substr(pos + sep.size(), end - (pos + sep.size()));
+    const auto frame = rawStack.substr(pos + sep.size(), end - (pos + sep.size()));
+    if (frame.starts_with(" [")) {
+      result += sep;
+    } else {
+      result += "\n    at [";
+      result += label;
+      result += "]:";
+    }
+    result += frame;
     pos = next;
   }
   return result;
@@ -78,14 +86,23 @@ void JSLogger::handleJSError(
   }
 
   const auto &message = error.getMessage();
-  std::string combined = message + labelStackFrames(error.getStack(), runtimeName);
+  const auto combined = joinStacks(message, error.getStack(), runtimeName, scheduleStack);
+  reportFatalErrorOnJS(jsScheduler, JSErrorData{.message = message, .stack = combined, .name = name});
+}
+
+std::string JSLogger::joinStacks(
+    const std::string &message,
+    const std::string &rawStack,
+    const std::string &runtimeName,
+    const std::optional<std::string> &scheduleStack) {
+  std::string combined = message + labelStackFrames(rawStack, runtimeName);
   if (scheduleStack.has_value()) {
     auto pos = scheduleStack->find("\n    at");
     if (pos != std::string::npos) {
       combined += scheduleStack->substr(pos);
     }
   }
-  reportFatalErrorOnJS(jsScheduler, JSErrorData{.message = message, .stack = combined, .name = name});
+  return combined;
 }
 #endif // NDEBUG
 
```

**File**: `packages/react-native-worklets/Common/cpp/worklets/Tools/JSLogger.h` (modified, +6/-0)
```diff
@@ -37,6 +37,12 @@ class JSLogger {
       const std::string &runtimeName,
       facebook::jsi::JSError &error,
       const std::optional<std::string> &scheduleStack);
+
+  static std::string joinStacks(
+      const std::string &message,
+      const std::string &rawStack,
+      const std::string &runtimeName,
+      const std::optional<std::string> &scheduleStack);
 #endif // NDEBUG
 
  private:
```

**File**: `packages/react-native-worklets/changelog/runonrnsync-stack-traces.feature.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Add cross-runtime stack traces to errors thrown by functions run with `scheduleOnRN` and `runOnRNSync`.
```

**File**: `packages/react-native-worklets/src/WorkletsModule/NativeWorklets.native.ts` (modified, +6/-4)
```diff
@@ -239,16 +239,18 @@ See https://docs.swmansion.com/react-native-worklets/docs/guides/troubleshooting
 
   scheduleOnRN<TArgs extends unknown[]>(
     fun: RemoteFunction | ((...args: TArgs) => unknown),
-    args: SerializableRef<TArgs> | undefined
+    args: SerializableRef<TArgs> | undefined,
+    scheduleStack?: string
   ): void {
-    this.#workletsModuleProxy.scheduleOnRN(fun, args);
+    this.#workletsModuleProxy.scheduleOnRN(fun, args, scheduleStack);
   }
 
   runOnRNSync<TArgs extends unknown[], TReturn>(
     fun: RemoteFunction | SerializableRef | ((...args: TArgs) => unknown),
-    args: SerializableRef<TArgs> | undefined
+    args: SerializableRef<TArgs> | undefined,
+    scheduleStack?: string
   ): TReturn {
-    return this.#workletsModuleProxy.runOnRNSync(fun, args);
+    return this.#workletsModuleProxy.runOnRNSync(fun, args, scheduleStack);
   }
 
   scheduleOnUI<TValue>(
```

**File**: `packages/react-native-worklets/src/WorkletsModule/workletsModuleProxy.ts` (modified, +4/-2)
```diff
@@ -141,12 +141,14 @@ export interface WorkletsModuleProxy {
 
   scheduleOnRN<TArgs extends unknown[]>(
     fun: RemoteFunction | ((...args: TArgs) => unknown),
-    args: SerializableRef<TArgs> | undefined
+    args: SerializableRef<TArgs> | undefined,
+    scheduleStack?: string
   ): void;
 
   runOnRNSync<TArgs extends unknown[], TReturn>(
     fun: RemoteFunction | SerializableRef | ((...args: TArgs) => unknown),
-    args: SerializableRef<TArgs> | undefined
+    args: SerializableRef<TArgs> | undefined,
+    scheduleStack?: string
   ): TReturn;
 
   scheduleOnUI<TValue>(
```

---

### Incident Patch 10: `6bcd8a41` (2026-10-01)
**Commit Message**: fix(Android): crash in useAnimatedSensor on events labeled with another sensor (#10792)

> [!NOTE]
> This pull request was authored by AI on behalf of @pawicao.

## Summary

Fixes #10773.

On some Android devices `useAnimatedSensor` crashed the app with
`[Reanimated] Unknown sensor type.` on the first sensor event.
`ReanimatedSensorListener` used `event.sensor.type` to decide how to
read an event, and threw when that type was not one it knew. Android
sets `event.sensor` for each event from its own handle lookup
([`SystemSensorManager.dispatchSensorEvent`](https://github.com/aosp-mirror/platform_frameworks_base/blob/android-13.0.0_r1/core/java/android/hardware/SystemSensorManager.java#L853-L875)),
so it can differ from the sensor that the listener was registered for.

I made the listener use the `ReanimatedSensorType` it was registered
with, so no event can reach a `throw`. When the event carries a
different sensor, the listener logs one warning and still passes the
values on.

This does not change behavior on devices that label events correctly.
There the event type equals the registered type, so the listener takes
the same branch as before, and the branches themselves are the same

**File**: `packages/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/sensor/ReanimatedSensor.kt` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ internal class ReanimatedSensor(
     init {
         val wm = reactContext.get()!!.getSystemService(Context.WINDOW_SERVICE) as WindowManager
         val display = wm.defaultDisplay
-        listener = ReanimatedSensorListener(setter, interval.toDouble(), display)
+        listener = ReanimatedSensorListener(setter, interval.toDouble(), display, sensorType)
         sensorManager =
             reactContext.get()!!.getSystemService(Context.SENSOR_SERVICE) as SensorManager
         this.interval = if (interval == -1) DEFAULT_INTERVAL else interval
```

**File**: `packages/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/sensor/ReanimatedSensorListener.kt` (modified, +44/-33)
```diff
@@ -4,6 +4,7 @@ import android.hardware.Sensor
 import android.hardware.SensorEvent
 import android.hardware.SensorEventListener
 import android.hardware.SensorManager
+import android.util.Log
 import android.view.Display
 import android.view.Surface
 import com.swmansion.reanimated.nativeProxy.SensorSetter
@@ -12,8 +13,10 @@ class ReanimatedSensorListener(
     private val setter: SensorSetter,
     private val interval: Double,
     private val display: Display,
+    private val sensorType: ReanimatedSensorType,
 ) : SensorEventListener {
     private var lastRead = System.currentTimeMillis().toDouble()
+    private var didWarnAboutMislabeledEvent = false
 
     private val rotation = FloatArray(9)
     private val orientation = FloatArray(3)
@@ -24,8 +27,8 @@ class ReanimatedSensorListener(
         if (current - lastRead < interval) {
             return
         }
-        val sensorType = event.sensor.type
         lastRead = current
+        warnOnceAboutMislabeledEvent(event.sensor)
 
         val orientationDegrees =
             when (display.rotation) {
@@ -35,43 +38,51 @@ class ReanimatedSensorListener(
                 else -> 0
             }
 
-        when (sensorType) {
-            Sensor.TYPE_ROTATION_VECTOR -> {
-                SensorManager.getQuaternionFromVector(quaternion, event.values)
-                SensorManager.getRotationMatrixFromVector(rotation, event.values)
-                SensorManager.getOrientation(rotation, orientation)
-                val data =
-                    floatArrayOf(
-                        quaternion[1], // qx
-                        quaternion[3], // qy -> we set qz to match iOS
-                        -quaternion[2], // qz -> we set -qy to match iOS
-                        quaternion[0], // qw
-                        // make Android consistent with iOS, which is better documented here:
-                        // https://developer.apple.com/documentation/coremotion/getting_processed_device-motion_data/
-                        -orientation[0], // yaw
-                        -orientation[1], // pitch
-                        orientation[2], // roll
-                    )
-                setter.sensorSetter(data, orientationDegrees)
+        val values = event.values
+        val data =
+            when (sensorType) {
+                ReanimatedSensorType.ROTATION_VECTOR -> rotationData(values)
+                ReanimatedSensorType.GYROSCOPE,
+                ReanimatedSensorType.MAGNETIC_FIELD,
+                -> floatArrayOf(values[0], values[1], values[2])
+                ReanimatedSensorType.GRAVITY,
+                ReanimatedSensorType.ACCELEROMETER,
+                -> floatArrayOf(-values[0], -values[1], -values[2])
             }
-            Sensor.TYPE_GYROSCOPE,
-            Sensor.TYPE_MAGNETIC_FIELD,
-            -> {
-                val data = floatArrayOf(event.values[0], event.values[1], event.values[2])
-                setter.sensorSetter(data, orientationDegrees)
-            }
-            Sensor.TYPE_GRAVITY,
-            Sensor.TYPE_LINEAR_ACCELERATION,
-            -> {
-                val data = floatArrayOf(-event.values[0], -event.values[1], -event.values[2])
-                setter.sensorSetter(data, orientationDegrees)
-            }
-            else -> throw IllegalArgumentException("[Reanimated] Unknown sensor type.")
-        }
+        setter.sensorSetter(data, orientationDegrees)
     }
 
     override fun onAccuracyChanged(
         sensor: Sensor,
         accuracy: Int,
     ) {}
+
+    private fun warnOnceAboutMislabeledEvent(eventSensor: Sensor) {
+        if (didWarnAboutMislabeledEvent || eventSensor.type == sensorType.getType()) {
+            return
+        }
+        didWarnAboutMislabeledEvent = true
+        Log.w(
+            "Reanimated",
+            "Sensor $sensorType (type ${sensorType.getType()}) receives events from " +
+                "\"${eventSensor.name}\" (type ${eventSensor.type}).",
+        )
+    }
+
+    private fun rotationData(values: FloatArray): FloatArray {
+        SensorManager.getQuaternionFromVector(quaternion, values)
+        SensorManager.getRotationMatrixFromVector(rotation, values)
+        SensorManager.getOrientation(rotation, orientation)
+        return floatArrayOf(
+            quaternion[1], // qx
+            quaternion[3], // qy -> we set qz to match iOS
+            -quaternion[2], // qz -> we set -qy to match iOS
+            quaternion[0], // qw
+            // make Android consistent with iOS, which is better documented here:
+            // https://developer.apple.com/documentation/coremotion/getting_processed_device-motion_data/
+            -orientation[0], // yaw
+            -orientation[1], // pitch
+            orientation[2], // roll
+        )
+    }
 }
```

**File**: `packages/react-native-reanimated/changelog/android-sensor-mislabeled-event-crash.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix an Android crash with `[Reanimated] Unknown sensor type.` in `useAnimatedSensor` on devices that deliver sensor events labeled with a sensor other than the registered one.
```

---

### Incident Patch 11: `6855f36b` (2026-10-01)
**Commit Message**: fix(Android): stop crashing when the React host is torn down during a background animation (#10661)

> [!NOTE]
> This pull request was authored by AI on behalf of @bartlomiejbloniarz.

## Summary

React Native invalidates TurboModules on its teardown executor. On
Android nothing ordered that against the UI thread, which still delivers
Choreographer frames and Fabric events to `NodesManager`. A frame that
had read a non-null `mNativeProxy` could call
`NativeProxy::performOperations()` after `invalidateCpp()` reset
`reanimatedModuleProxy_`. A foreground teardown runs `onHostPause()`,
which removes the frame callback. A teardown while the app is
backgrounded skips `onHostPause()`, and CSS and layout animations keep
requesting frames in the background. `expo-updates` restarts the host
that way, which is the reporter's setup.

Now `NativeProxy` owns a `ReentrantReadWriteLock` next to the C++ state
that `invalidateCpp()` destroys. `invalidate()` takes the write lock.
The native entry points (`performOperations`,
`performNonLayoutOperations`, `isAnyHandlerWaitingForEvent`,
`toggleSlowAnimationsOnUIRuntime`) are private and reachable only
through `ifNotInvalidated`, which only tries the re

**File**: `packages/react-native-reanimated/android/src/main/cpp/reanimated/android/NativeProxy.cpp` (modified, +3/-3)
```diff
@@ -159,9 +159,9 @@ void NativeProxy::registerNatives() {
   registerHybrid(
       {makeNativeMethod("initHybrid", NativeProxy::initHybrid),
        makeNativeMethod("installJSIBindings", NativeProxy::installJSIBindings),
-       makeNativeMethod("isAnyHandlerWaitingForEvent", NativeProxy::isAnyHandlerWaitingForEvent),
-       makeNativeMethod("performOperations", NativeProxy::performOperations),
-       makeNativeMethod("performNonLayoutOperations", NativeProxy::performNonLayoutOperations),
+       makeNativeMethod("isAnyHandlerWaitingForEventCpp", NativeProxy::isAnyHandlerWaitingForEvent),
+       makeNativeMethod("performOperationsCpp", NativeProxy::performOperations),
+       makeNativeMethod("performNonLayoutOperationsCpp", NativeProxy::performNonLayoutOperations),
        makeNativeMethod("hasSynchronousWritesTracker", NativeProxy::hasSynchronousWritesTracker),
        makeNativeMethod("rewriteSynchronousProps", NativeProxy::rewriteSynchronousProps),
        makeNativeMethod("invalidateCpp", NativeProxy::invalidateCpp),
```

**File**: `packages/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NativeProxy.kt` (modified, +45/-16)
```diff
@@ -33,6 +33,8 @@ import com.swmansion.reanimated.sensor.ReanimatedSensorContainer
 import com.swmansion.reanimated.sensor.ReanimatedSensorType
 import java.lang.ref.WeakReference
 import java.util.concurrent.atomic.AtomicBoolean
+import java.util.concurrent.locks.ReentrantReadWriteLock
+import kotlin.concurrent.write
 
 @Suppress("KotlinJniMissingFunction")
 @OptIn(FrameworkAPI::class)
@@ -67,8 +69,8 @@ open class NativeProxy {
      */
     private val mInvalidated = AtomicBoolean(false)
 
-    /** A mount callback on the UI thread must not run native code while a different thread destroys it. */
-    private val invalidationLock = Any()
+    // Guards the C++ state that invalidateCpp() destroys against calls from the UI thread.
+    private val mNativeStateLock = ReentrantReadWriteLock()
 
     @field:DoNotStrip
     @Suppress("unused")
@@ -81,13 +83,7 @@ open class NativeProxy {
 
             override fun willMountItems(uiManager: UIManager) = Unit
 
-            override fun didMountItems(uiManager: UIManager) {
-                synchronized(invalidationLock) {
-                    if (!mInvalidated.get()) {
-                        rewriteSynchronousProps()
-                    }
-                }
-            }
+            override fun didMountItems(uiManager: UIManager) = ifNotInvalidated(Unit) { rewriteSynchronousProps() }
 
             override fun didDispatchMountItems(uiManager: UIManager) = Unit
 
@@ -147,14 +143,14 @@ open class NativeProxy {
         fabricUIManager: FabricUIManager,
     ): HybridData
 
-    external fun isAnyHandlerWaitingForEvent(
+    private external fun isAnyHandlerWaitingForEventCpp(
         eventName: String,
         emitterReactTag: Int,
     ): Boolean
 
-    external fun performOperations()
+    private external fun performOperationsCpp()
 
-    external fun performNonLayoutOperations()
+    private external fun performNonLayoutOperationsCpp()
 
     private external fun hasSynchronousWritesTracker(): Boolean
 
@@ -164,10 +160,38 @@ open class NativeProxy {
 
     private external fun invalidateCpp()
 
-    external fun toggleSlowAnimationsOnUIRuntime()
+    private external fun toggleSlowAnimationsOnUIRuntime()
 
     protected fun getHybridData(): HybridData = mHybridData
 
+    // tryLock, because the UI thread may hold the UI runtime lock, which could deadlock with invalidate()
+    private inline fun <T> ifNotInvalidated(
+        fallback: T,
+        block: () -> T,
+    ): T {
+        val readLock = mNativeStateLock.readLock()
+        if (!readLock.tryLock()) {
+            return fallback
+        }
+        try {
+            if (mInvalidated.get()) {
+                return fallback
+            }
+            return block()
+        } finally {
+            readLock.unlock()
+        }
+    }
+
+    fun isAnyHandlerWaitingForEvent(
+        eventName: String,
+        emitterReactTag: Int,
+    ): Boolean = ifNotInvalidated(false) { isAnyHandlerWaitingForEventCpp(eventName, emitterReactTag) }
+
+    fun performOperations() = ifNotInvalidated(Unit) { performOperationsCpp() }
+
+    fun performNonLayoutOperations() = ifNotInvalidated(Unit) { performNonLayoutOperationsCpp() }
+
     fun invalidate() {
         if (mInvalidated.getAndSet(true)) {
             return
@@ -176,7 +200,7 @@ open class NativeProxy {
         mFabricUIManager.removeUIManagerEventListener(mountListener)
         pseudoSelectorManager.invalidate()
         cssPlatformTransitionsManager.invalidate()
-        synchronized(invalidationLock) {
+        mNativeStateLock.write {
             if (mHybridData.isValid) {
                 invalidateCpp()
             }
@@ -190,7 +214,7 @@ open class NativeProxy {
         }
         mNodesManager!!.enableSlowAnimations(slowAnimationsEnabled, animationsDragFactor)
         cssPlatformTransitionsManager.enableSlowAnimations(slowAnimationsEnabled, animationsDragFactor)
-        toggleSlowAnimationsOnUIRuntime()
+        ifNotInvalidated(Unit) { toggleSlowAnimationsOnUIRuntime() }
     }
 
     private fun addDevMenuOption() {
@@ -213,8 +237,12 @@ open class NativeProxy {
 
     @DoNotStrip
     fun requestRender(callback: AnimationFrameCallback) {
+        val guardedCallback =
+            object : NodesManager.OnAnimationFrame {
+                override fun onAnimationFrame(timestampMs: Double) = ifNotInvalidated(Unit) { callback.onAnimationFrame(timestampMs) }
+            }
         UiThreadUtil.assertOnUiThread()
-        mNodesManager!!.postOnAnimation(callback)
+        mNodesManager!!.postOnAnimation(guardedCallback)
     }
 
     @DoNotStrip fun getReanimatedJavaVersion(): String = BuildConfig.REANIMATED_VERSION_JAVA
@@ -376,6 +404,7 @@ open class NativeProxy {
     fun registerEventHandler(handler: EventHandler) {
         handler.mCustomEventNamesResolver = mNodesManager!!.getEventNameResolver()
         handler.isInDrawPassProvider = { mNodesManager!!.isInDrawPass() }
+        handler.nativeCallGuard = { receive -> ifNotInva
```

**File**: `packages/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NodesManager.kt` (modified, +2/-4)
```diff
@@ -199,9 +199,7 @@ class NodesManager(
                 Trace.beginSection("onEventDispatch")
             }
 
-            if (mNativeProxy == null) {
-                return
-            }
+            val nativeProxy = mNativeProxy ?: return
             // Events can be dispatched from any thread so we have to make sure handleEvent is run from
             // the UI thread.
             if (UiThreadUtil.isOnUiThread()) {
@@ -213,7 +211,7 @@ class NodesManager(
             } else {
                 val eventName = mCustomEventNamesResolver.resolveCustomEventName(event.eventName) ?: return
                 val viewTag = event.viewTag
-                val shouldSaveEvent = mNativeProxy!!.isAnyHandlerWaitingForEvent(eventName, viewTag)
+                val shouldSaveEvent = nativeProxy.isAnyHandlerWaitingForEvent(eventName, viewTag)
                 if (shouldSaveEvent) {
                     mEventQueue.offer(CopiedEvent(event))
                 }
```

**File**: `packages/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/nativeProxy/EventHandler.kt` (modified, +4/-3)
```diff
@@ -14,6 +14,7 @@ class EventHandler : RCTModernEventEmitter {
 
     var mCustomEventNamesResolver: UIManagerModule.CustomEventNamesResolver? = null
     internal var isInDrawPassProvider: (() -> Boolean)? = null
+    internal var nativeCallGuard: (() -> Unit) -> Unit = { it() }
 
     @DoNotStrip
     private constructor(hybridData: HybridData) {
@@ -32,7 +33,7 @@ class EventHandler : RCTModernEventEmitter {
         category: Int,
     ) {
         val resolvedEventName = mCustomEventNamesResolver!!.resolveCustomEventName(eventName) ?: eventName
-        receiveEvent(resolvedEventName, targetTag, params, isInDrawPass())
+        nativeCallGuard { receiveEvent(resolvedEventName, targetTag, params, isInDrawPass()) }
     }
 
     override fun receiveEvent(
@@ -42,7 +43,7 @@ class EventHandler : RCTModernEventEmitter {
         params: WritableMap?,
     ) {
         val resolvedEventName = mCustomEventNamesResolver!!.resolveCustomEventName(eventName) ?: eventName
-        receiveEvent(resolvedEventName, targetTag, params, isInDrawPass())
+        nativeCallGuard { receiveEvent(resolvedEventName, targetTag, params, isInDrawPass()) }
     }
 
     override fun receiveEvent(
@@ -51,7 +52,7 @@ class EventHandler : RCTModernEventEmitter {
         params: WritableMap?,
     ) {
         val resolvedEventName = mCustomEventNamesResolver!!.resolveCustomEventName(eventName) ?: eventName
-        receiveEvent(resolvedEventName, targetTag, params, isInDrawPass())
+        nativeCallGuard { receiveEvent(resolvedEventName, targetTag, params, isInDrawPass()) }
     }
 
     override fun receiveTouches(
```

**File**: `packages/react-native-reanimated/changelog/android-nodes-manager-teardown-race.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix an Android crash in `performOperations` when the React host is torn down while a CSS or layout animation runs in the background, for example on an `expo-updates` restart.
```

---

### Incident Patch 12: `a8a6f67d` (2026-10-01)
**Commit Message**: fix(LayoutAnimations): remove a view's children before the view, as React does (#10754)

## Summary

With the light tree layout animations proxy, a subtree that React
removes without an exiting animation was unmounted root first. The proxy
emitted the root's `Remove` in stream order and moved the descendants'
`Remove` and `Delete` mutations to the end of the transaction. React
unmounts children before their parent, and react-native-screens before
4.27 relies on that order. When a native stack screen that holds a
nested native stack with header buttons is removed, for example on
sign-out, a header update reaches a screen that has already left its
stack, and Android crashes with `ScreenStackFragment added into a
non-stack container`. This was reported on 4.7.0 in #10620.

Now `handleSubtreeRemoval` emits the descendants' `Remove` and `Delete`
first, then the root's `Remove` and `Delete` at its current host index.
On iOS, a subtree that holds a screen react-native-screens snapshots
keeps the old order. The shared element transition code switches such a
screen to snapshot after updates, so its content must still be mounted
when the screen is removed. The proxy tracks these screens in
`

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp` (modified, +28/-6)
```diff
@@ -188,7 +188,9 @@ std::optional<MountingTransaction> LayoutAnimationsProxy::pullTransaction(
       // shared element, the issue should be gone with the new stack
       // implementation
       if (auto screen = findParentRNSScreen(afterTopScreen)) {
-        forceScreenSnapshot_(screen->current.tag);
+        if (forceScreenSnapshot_(screen->current.tag)) {
+          snapshottedScreens_.insert(screen->current.tag);
+        }
       }
 #endif
     }
@@ -256,6 +258,7 @@ void LayoutAnimationsProxy::unmapLightNode(const std::shared_ptr<LightNode> &nod
     return;
   }
   lightNodes_.erase(it);
+  snapshottedScreens_.erase(node->current.tag);
   if (node == topScreen_) {
     topScreen_ = nullptr;
   }
@@ -721,17 +724,20 @@ std::optional<SurfaceId> LayoutAnimationsProxy::endLayoutAnimation(int tag, bool
 }
 
 // A subtree that animates keeps its place in the host tree, so nothing is emitted for its root.
-// A subtree that does not animate is removed at its current host index. Its teardown mounts at the
-// end of the transaction, so native code that reads a view on unmount still sees its children.
+// A subtree that does not animate is removed at its current host index after its descendants, like React
+// removes it. On iOS a subtree that holds a screen React Native Screens snapshots is removed before its
+// descendants instead, and their teardown mounts at the end of the transaction.
 void LayoutAnimationsProxy::handleSubtreeRemoval(
     const std::shared_ptr<LightNode> &node,
     const std::shared_ptr<LightNode> &parent,
     TransactionMeta &transaction) const {
   ReanimatedSystraceSection s("handleSubtreeRemoval");
+  const bool defersTeardown = holdsSnapshottedScreen(node);
   const StartAnimationsRecursivelyConfig config = {
       .shouldRemoveSubviewsWithoutAnimations = true,
       .shouldAnimate = !transaction.surfaceDropped,
       .isScreenPop = false,
+      .defersTeardown = defersTeardown,
   };
   if (startAnimationsRecursively(node, transaction, config)) {
     return;
@@ -747,7 +753,22 @@ void LayoutAnimationsProxy::handleSubtreeRemoval(
   }
   transaction.filteredMutations.push_back(
       ShadowViewMutation::RemoveMutation(parent->current.tag, node->current, hostIndex));
-  transaction.teardownMutations.push_back(ShadowViewMutation::DeleteMutation(node->current));
+  (defersTeardown ? transaction.teardownMutations : transaction.filteredMutations)
+      .push_back(ShadowViewMutation::DeleteMutation(node->current));
+}
+
+// React Native Screens snapshots a screen in snapshottedScreens_ after pending updates when the screen is removed,
+// so its content must still be mounted then.
+bool LayoutAnimationsProxy::holdsSnapshottedScreen([[maybe_unused]] const std::shared_ptr<LightNode> &node) const {
+#ifdef __APPLE__
+  if constexpr (StaticFeatureFlags::getFlag("ENABLE_SHARED_ELEMENT_TRANSITIONS")) {
+    return std::ranges::any_of(snapshottedScreens_, [&](const Tag tag) {
+      const auto it = lightNodes_.find(tag);
+      return it != lightNodes_.end() && isInSubtree(it->second, node);
+    });
+  }
+#endif
+  return false;
 }
 
 void LayoutAnimationsProxy::flushCompletedRemovals(ShadowViewMutationList &filteredMutations) const {
@@ -902,8 +923,8 @@ bool LayoutAnimationsProxy::startAnimationsRecursively(
     TransactionMeta &transaction,
     StartAnimationsRecursivelyConfig config) const {
   react_native_assert(node->state == DECISION_PENDING && "Subtree removal of a view that React does not delete");
-  auto &mutations = transaction.teardownMutations;
-  auto &[shouldRemoveSubviewsWithoutAnimations, shouldAnimate, isScreenPop] = config;
+  auto &[shouldRemoveSubviewsWithoutAnimations, shouldAnimate, isScreenPop, defersTeardown] = config;
+  auto &mutations = defersTeardown ? transaction.teardownMutations : transaction.filteredMutations;
   if (isRNSScreenOrStack(node)) {
     isScreenPop = true;
   }
@@ -979,6 +1000,7 @@ void LayoutAnimationsProxy::clearSurfaceState() const {
   LayoutAnimationsProxyCommon::clearSurfaceState();
   if constexpr (StaticFeatureFlags::getFlag("ENABLE_SHARED_ELEMENT_TRANSITIONS")) {
     sharedContainers_.clear();
+    snapshottedScreens_.clear();
     transition_.reset();
     uncommittedScreenPop_.reset();
   }
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.h` (modified, +5/-0)
```diff
@@ -33,6 +33,7 @@ struct StartAnimationsRecursivelyConfig {
   bool shouldRemoveSubviewsWithoutAnimations;
   bool shouldAnimate;
   bool isScreenPop;
+  bool defersTeardown;
 };
 
 struct PendingNodeAnimation {
@@ -93,6 +94,9 @@ struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
   mutable std::optional<ProgressTransition> transition_;
   mutable std::optional<UncommittedScreenPop> uncommittedScreenPop_;
   mutable std::shared_ptr<LightNode> topScreen_;
+  // screens that forceScreenSnapshot_ switched to snapshots after updates; React Native Screens never switches them
+  // back
+  mutable std::unordered_set<Tag> snapshottedScreens_;
   mutable std::unordered_map<Tag, SharedContainer> sharedContainers_;
   mutable std::unordered_set<Tag> hiddenViewTags_;
   std::shared_ptr<SharedTransitionManager> sharedTransitionManager_;
@@ -245,6 +249,7 @@ struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
       const std::shared_ptr<LightNode> &node,
       const std::shared_ptr<LightNode> &parent,
       TransactionMeta &transaction) const;
+  bool holdsSnapshottedScreen(const std::shared_ptr<LightNode> &node) const;
   void flushCompletedRemovals(ShadowViewMutationList &filteredMutations) const;
 
   void addOngoingAnimations(ShadowViewMutationList &mutations) const;
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsUtils.h` (modified, +9/-0)
```diff
@@ -264,6 +264,15 @@ static inline std::shared_ptr<LightNode> findParentRNSScreen(const std::shared_p
   return current;
 }
 
+static inline bool isInSubtree(std::shared_ptr<LightNode> node, const std::shared_ptr<LightNode> &root) {
+  for (; node; node = node->parent.lock()) {
+    if (node == root) {
+      return true;
+    }
+  }
+  return false;
+}
+
 static inline bool isSETBoundary(const std::shared_ptr<LightNode> &node) {
   return !std::strcmp(node->current.componentName, "REASharedTransitionBoundary");
 }
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Tools/PlatformDepMethodsHolder.h` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ using KeyboardEventSubscribeFunction = std::function<int(std::function<void(int,
 using KeyboardEventUnsubscribeFunction = std::function<void(int)>;
 using MaybeFlushUIUpdatesQueueFunction = std::function<void()>;
 
-using ForceScreenSnapshotFunction = std::function<void(Tag tag)>;
+using ForceScreenSnapshotFunction = std::function<bool(Tag tag)>;
 
 using PlatformAttachPseudoSelectorFunction = std::function<void(Tag, PseudoSelector, std::function<void(bool)>)>;
 using PlatformDetachPseudoSelectorFunction = std::function<void(Tag, PseudoSelector)>;
```

**File**: `packages/react-native-reanimated/apple/reanimated/apple/native/PlatformDepMethodsHolderImpl.mm` (modified, +3/-1)
```diff
@@ -194,14 +194,16 @@ void stopTransition(Tag viewTag, const std::string &propertyName) override
 
 ForceScreenSnapshotFunction makeForceScreenSnapshotFunction(REANodesManager *nodesManager)
 {
-  auto forceScreenSnapshot = [=](Tag tag) {
+  auto forceScreenSnapshot = [=](Tag tag) -> bool {
     RCTSurfacePresenter *surfacePresenter = nodesManager.surfacePresenter;
     RCTComponentViewRegistry *componentViewRegistry = surfacePresenter.mountingManager.componentViewRegistry;
     REAUIView<RCTComponentViewProtocol> *maybeRNSScreenView = [componentViewRegistry findComponentViewWithTag:tag];
     SEL setSnapshotAfterUpdatesSelector = @selector(setSnapshotAfterUpdates:);
     if ([maybeRNSScreenView respondsToSelector:setSnapshotAfterUpdatesSelector]) {
       [static_cast<id<RNScreenViewOptionalProtocol>>(maybeRNSScreenView) setSnapshotAfterUpdates:YES];
+      return true;
     }
+    return false;
   };
   return forceScreenSnapshot;
 }
```

**File**: `packages/react-native-reanimated/changelog/layout-animations-removal-order.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix an Android crash with `react-native-screens` before 4.27 when a native stack screen that holds a nested stack with header buttons is removed.
```

---

### Incident Patch 13: `bc8a1140` (2026-09-30)
**Commit Message**: fix(Worklets): crash in release builds when the createWorkletRuntime initializer throws (#10774)

**File**: `apps/common-app/runtime-tests/worklets/tests/runtimes/createWorkletRuntime.test.tsx` (modified, +14/-0)
```diff
@@ -132,4 +132,18 @@ describe('createWorkletRuntime', () => {
     expect(scheduledValue).toBe(42);
     expect(runtime.name).toBe('test');
   });
+
+  if (!__DEV__) {
+    test('throws when the initializer throws', async () => {
+      await expect(() => {
+        createWorkletRuntime({
+          name: 'test',
+          initializer: () => {
+            'worklet';
+            throw new Error('Initializer error');
+          },
+        });
+      }).toThrow('Initializer error');
+    });
+  }
 });
```

**File**: `packages/react-native-worklets/Common/cpp/worklets/WorkletRuntime/RuntimeManager.cpp` (modified, +6/-1)
```diff
@@ -3,6 +3,7 @@
 #include <worklets/WorkletRuntime/RuntimeManager.h>
 
 #include <memory>
+#include <stdexcept>
 #include <string>
 #include <utility>
 #include <vector>
@@ -71,7 +72,11 @@ std::shared_ptr<WorkletRuntime> RuntimeManager::createWorkletRuntime(
 #endif // NDEBUG
 
   if (initializer) {
-    workletRuntime->runSyncAndDiscard(initializer);
+    try {
+      workletRuntime->runSyncAndDiscard(initializer);
+    } catch (const jsi::JSError &error) {
+      throw std::runtime_error(error.getMessage());
+    }
   }
 
   registerRuntime(runtimeId, workletRuntime);
```

**File**: `packages/react-native-worklets/changelog/initializererrorcrashfix.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix a crash in release builds when the initializer passed to `createWorkletRuntime` throws.
```

---

### Incident Patch 14: `7597db09` (2026-09-30)
**Commit Message**: fix(Worklets): missing serializable mapping for some types (#10771)

**File**: `packages/react-native-worklets/changelog/addclonemappingfix.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix RegExp, Error and typed array Serializables being serialized again when passed to `createSerializable`.
```

**File**: `packages/react-native-worklets/src/memory/serializable.native.ts` (modified, +3/-0)
```diff
@@ -599,13 +599,15 @@ function cloneRegExp(value: RegExp): SerializableRef<RegExp> {
     value.flags
   );
   serializableMappingCache.set(value, clone);
+  serializableMappingCache.set(clone);
   return clone;
 }
 
 function cloneError(value: Error): SerializableRef<Error> {
   const { name, message, stack } = value;
   const clone = WorkletsModule.createSerializableError(name, message, stack);
   serializableMappingCache.set(value, clone);
+  serializableMappingCache.set(clone);
   return clone;
 }
 
@@ -637,6 +639,7 @@ function cloneArrayBufferView<TValue extends ArrayBufferView>(
     length
   );
   serializableMappingCache.set(value, clone);
+  serializableMappingCache.set(clone);
   return clone;
 }
 
```

---

### Incident Patch 15: `fa3e4a00` (2026-09-30)
**Commit Message**: fix: data race on the mounted root in ReanimatedMountHook (#10772)

## Summary

`ReanimatedMountHook` cleared `ReanimatedMountTrait` on the mounted
root, while React Native could clone that same root on the JS thread.
This is a data race, reported by the TSan nightly.

The write wasn't needed. `ReanimatedCommitHook` already sets the trait
on Reanimated commits and clears it on React commits. The mount hook now
only reads the trait, through a const pointer.

## Test plan

- Run the iOS TSan runtime tests and check that the
`ReanimatedMountHook` race is no longer reported.
- Run the reanimated runtime tests on iOS and Android.

## Changelog

- [x] I added an entry to the `Unpublished` section of each changed
package's `CHANGELOG.md`, or this PR does not change
`react-native-reanimated` or `react-native-worklets`.

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/ReanimatedCommitShadowNode.h` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@ class ReanimatedCommitShadowNode : public ShadowNode {
   inline void unsetReanimatedCommitTrait() {
     traits_.unset(ReanimatedCommitTrait);
   }
-  inline bool hasReanimatedCommitTrait() {
+  inline bool hasReanimatedCommitTrait() const {
     return traits_.check(ReanimatedCommitTrait);
   }
   inline void setReanimatedMountTrait() {
@@ -38,7 +38,7 @@ class ReanimatedCommitShadowNode : public ShadowNode {
   inline void unsetReanimatedMountTrait() {
     traits_.unset(ReanimatedMountTrait);
   }
-  inline bool hasReanimatedMountTrait() {
+  inline bool hasReanimatedMountTrait() const {
     return traits_.check(ReanimatedMountTrait);
   }
 };
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/ReanimatedMountHook.cpp` (modified, +1/-9)
```diff
@@ -41,17 +41,9 @@ void ReanimatedMountHook::shadowTreeDidMount(
     synchronousWritesTracker_->onMountReport(rootShadowNode);
   }
 
-  auto reaShadowNode = std::reinterpret_pointer_cast<ReanimatedCommitShadowNode>(
-      std::const_pointer_cast<RootShadowNode>(rootShadowNode));
+  auto reaShadowNode = std::reinterpret_pointer_cast<const ReanimatedCommitShadowNode>(rootShadowNode);
 
-  // We mark reanimated commits with ReanimatedMountTrait. We don't want other
-  // shadow nodes to use this trait, but since this rootShadowNode is Shared,
-  // we don't have that guarantee. That's why we also unset this trait in the
-  // commit hook. We remove it here mainly for the sake of cleanliness.
   const bool isReanimatedMount = reaShadowNode->hasReanimatedMountTrait();
-  if (isReanimatedMount) {
-    reaShadowNode->unsetReanimatedMountTrait();
-  }
 
   {
     auto lock = updatesRegistryManager_->lock();
```

**File**: `packages/react-native-reanimated/changelog/mount-hook-trait-race.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix a data race in the mount hook, which cleared a trait on the mounted root while React Native cloned it on the JS thread.
```

#### Recent Merged Pull Requests:
- **PR #10812** (2026-10-05): fix(LayoutAnimations): show an entering view that only transforms when Android diffs props (@bartlomiejbloniarz)
- **PR #10811** (2026-10-05): fix(LayoutAnimations): keep an entering view visible on Android when its only frame is dropped (@bartlomiejbloniarz)
- **PR #10809** (2026-10-05): test(LayoutAnimations): cover entering views moved before their animation starts (@bartlomiejbloniarz)
- **PR #10808** (2026-10-05): fix(LayoutAnimations): apply a layout change that arrives before an entering animation starts (@pawicao)
- **PR #10807** (2026-10-05): docs: fix withClamp config table rendering (@bartlomiejbloniarz)
- **PR #10803** (2026-10-02): cherry-pick(4.7-stable): Keep synchronously updated props when a mount inserts a view again (#10800) (@pawicao)
- **PR #10800** (2026-10-02): fix: keep synchronously updated props when a mount inserts a view again (@pawicao)
- **PR #10798** (2026-10-02): feat(Worklets): cross-runtime stack traces for scheduleOnRN and runOnRNSync (@tshmieldev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
