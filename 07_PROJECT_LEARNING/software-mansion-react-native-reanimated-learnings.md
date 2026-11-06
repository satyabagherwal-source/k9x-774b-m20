> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-reanimated-learnings.md`  
> **Source**: github ([https://github.com/software-mansion/react-native-reanimated](https://github.com/software-mansion/react-native-reanimated))  
> **Source Version**: `ea12300d`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T21:59:28.619Z  
> **Learning ID**: `learn-github-software-mansion-react-native-reanimated`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): software-mansion/react-native-reanimated

> **Canonical Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-reanimated-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/software-mansion/react-native-reanimated](https://github.com/software-mansion/react-native-reanimated))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-06T21:59:27.165Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-reanimated`
- **Description**: React Native's Animated library reimplemented
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11057 stars

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

### Incident Patch 1: `ea12300d` (2026-11-06)
**Commit Message**: fix(Reanimated): handle node removals with the animation backend (#11114)

> [!NOTE]
> This pull request was authored by AI on behalf of @bartlomiejbloniarz.

## Summary

Every animated component calls `markNodeAsRemovable` when it unmounts.
After a mount, `handleNodeRemovals` drops the props of each marked view
that is no longer in the mounted tree from the registries. A hidden
`<Activity>` or a frozen screen stays in the tree, so it keeps its
props.

With `USE_ANIMATION_BACKEND` this never ran. The commit hook returned
before it registered the surface in `MountedRootsRegistry`, and the
mount hook returned before it drained. So with the backend every
unmounted animated view kept its entries in the props registries until
the app closed.

This PR:

- registers and removes surfaces in the commit hook with the backend
too;
- records the mounted root and drains removals in the mount hook with
the backend;
- drains the nodes of the reported surface, and the nodes of surfaces
that have stopped, in place;
- drains the nodes of a stopping surface when it commits its empty root,
so they are released even if no mount is reported after that, for
example on a paused Android host.

With the bac

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/CSS/misc/ViewStylesRepository.cpp` (modified, +0/-17)
```diff
@@ -1,5 +1,4 @@
 #include <reanimated/CSS/misc/ViewStylesRepository.h>
-#include <reanimated/Tools/FeatureFlags.h>
 
 #include <memory>
 #include <string>
@@ -68,13 +67,6 @@ jsi::Value ViewStylesRepository::getParentNodeProp(
 
 std::shared_ptr<const ShadowNode> ViewStylesRepository::getNewestNode(
     const std::shared_ptr<const ShadowNode> &shadowNode) const {
-  if constexpr (StaticFeatureFlags::getFlag("USE_ANIMATION_BACKEND")) {
-    // Backend mode has no commit hook (it returns before taking the updates-registry
-    // lock), so reading the live tree here cannot deadlock and needs no snapshot.
-    const auto newestNode = uiManager_->getNewestCloneOfShadowNode(*shadowNode);
-    return newestNode ? newestNode : shadowNode;
-  }
-
   // Resolve shadowNode against the last mounted root without the ShadowTree lock (the
   // deadlock) that getNewestCloneOfShadowNode takes, falling back to the passed node.
   // Mirrors RN's getShadowNodeInSubtree:
@@ -99,15 +91,6 @@ std::shared_ptr<const ShadowNode> ViewStylesRepository::getNewestNode(
 
 std::shared_ptr<const ShadowNode> ViewStylesRepository::getParentNode(
     const std::shared_ptr<const ShadowNode> &shadowNode) const {
-  if constexpr (StaticFeatureFlags::getFlag("USE_ANIMATION_BACKEND")) {
-    // Backend mode resolves against the live tree (see getNewestNode).
-    std::shared_ptr<const ShadowNode> parentNode = nullptr;
-    uiManager_->getShadowTreeRegistry().visit(shadowNode->getSurfaceId(), [&](const ShadowTree &shadowTree) {
-      parentNode = dom::getParentNode(shadowTree.getCurrentRevision().rootShadowNode, *shadowNode);
-    });
-    return parentNode;
-  }
-
   const auto root = mountedRootsRegistry_->get(shadowNode->getSurfaceId());
   if (!root) {
     return nullptr;
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/CSS/misc/ViewStylesRepository.h` (modified, +0/-6)
```diff
@@ -8,7 +8,6 @@
 #include <react/renderer/components/view/ViewProps.h>
 #include <react/renderer/core/LayoutableShadowNode.h>
 #include <react/renderer/dom/DOM.h>
-#include <react/renderer/uimanager/UIManager.h>
 
 #include <memory>
 #include <string>
@@ -25,16 +24,11 @@ class ViewStylesRepository {
       const std::shared_ptr<AnimatedPropsRegistry> &animatedPropsRegistry,
       const std::shared_ptr<MountedRootsRegistry> &mountedRootsRegistry);
 
-  void setUIManager(const std::shared_ptr<UIManager> &uiManager) {
-    uiManager_ = uiManager;
-  }
-
   jsi::Value getNodeProp(const std::shared_ptr<const ShadowNode> &shadowNode, const std::string &propName);
   jsi::Value getParentNodeProp(const std::shared_ptr<const ShadowNode> &shadowNode, const std::string &propName);
   folly::dynamic getStyleProp(Tag tag, const PropertyPath &propertyPath);
 
  private:
-  std::shared_ptr<UIManager> uiManager_;
   std::shared_ptr<StaticPropsRegistry> staticPropsRegistry_;
   std::shared_ptr<AnimatedPropsRegistry> animatedPropsRegistry_;
   std::shared_ptr<MountedRootsRegistry> mountedRootsRegistry_;
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/MountedRootsRegistry.cpp` (modified, +5/-0)
```diff
@@ -26,6 +26,11 @@ RootShadowNode::Shared MountedRootsRegistry::get(const SurfaceId surfaceId) cons
   return it == rootsBySurface_.end() ? nullptr : it->second;
 }
 
+bool MountedRootsRegistry::isRunning(const SurfaceId surfaceId) const {
+  react_native_assert(UpdatesRegistryManager::isLockedByCurrentThread());
+  return rootsBySurface_.contains(surfaceId);
+}
+
 bool MountedRootsRegistry::isMounted(const ShadowNodeFamily &shadowNodeFamily) const {
   react_native_assert(UpdatesRegistryManager::isLockedByCurrentThread());
   const auto it = rootsBySurface_.find(shadowNodeFamily.getSurfaceId());
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/MountedRootsRegistry.h` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ class MountedRootsRegistry {
   void set(const RootShadowNode::Shared &rootShadowNode);
   void remove(SurfaceId surfaceId);
   RootShadowNode::Shared get(SurfaceId surfaceId) const;
+  bool isRunning(SurfaceId surfaceId) const;
   bool isMounted(const ShadowNodeFamily &shadowNodeFamily) const;
 
  private:
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/ReanimatedCommitHook.cpp` (modified, +13/-4)
```diff
@@ -17,11 +17,13 @@ ReanimatedCommitHook::ReanimatedCommitHook(
     const std::shared_ptr<UpdatesRegistryManager> &updatesRegistryManager,
     const std::shared_ptr<MountedRootsRegistry> &mountedRootsRegistry,
     const std::shared_ptr<LayoutAnimationsProxyRegistry> &layoutAnimationsProxyRegistry,
+    const std::shared_ptr<LayoutAnimationsManager> &layoutAnimationsManager,
     const std::shared_ptr<SynchronousWritesTracker> &synchronousWritesTracker)
     : uiManager_(uiManager),
       updatesRegistryManager_(updatesRegistryManager),
       mountedRootsRegistry_(mountedRootsRegistry),
       layoutAnimationsProxyRegistry_(layoutAnimationsProxyRegistry),
+      layoutAnimationsManager_(layoutAnimationsManager),
       synchronousWritesTracker_(synchronousWritesTracker) {
   uiManager_->registerCommitHook(*this);
   uiManager_->getShadowTreeRegistry().enumerate([this](const ShadowTree &shadowTree, bool & /*stop*/) {
@@ -54,15 +56,13 @@ RootShadowNode::Unshared ReanimatedCommitHook::shadowTreeWillCommit(
     proxy->shadowTreeWillCommit(newRootShadowNode->getChildren().empty());
   }
 
-  if constexpr (StaticFeatureFlags::getFlag("USE_ANIMATION_BACKEND")) {
-    return newRootShadowNode;
-  }
-
+  std::vector<Tag> removedTags;
   {
     auto lock = updatesRegistryManager_->lock();
     if (newRootShadowNode->getChildren().empty()) {
       // A stopping surface commits an empty root; its mount is not reported on a paused Android host.
       mountedRootsRegistry_->remove(shadowTree.getSurfaceId());
+      removedTags = updatesRegistryManager_->handleNodeRemovals(shadowTree.getSurfaceId());
       if (synchronousWritesTracker_) {
         synchronousWritesTracker_->onSurfaceStop(shadowTree.getSurfaceId());
       }
@@ -71,6 +71,15 @@ RootShadowNode::Unshared ReanimatedCommitHook::shadowTreeWillCommit(
     }
   }
 
+  // The proxy of the stopping surface still maps these views, so it releases their configs when it unmaps them.
+  if (layoutAnimationsProxyRegistry_) {
+    layoutAnimationsProxyRegistry_->releaseSharedTransitionConfigs(removedTags, *layoutAnimationsManager_);
+  }
+
+  if constexpr (StaticFeatureFlags::getFlag("USE_ANIMATION_BACKEND")) {
+    return newRootShadowNode;
+  }
+
   auto reaShadowNode = std::reinterpret_pointer_cast<ReanimatedCommitShadowNode>(newRootShadowNode);
 
   if (reaShadowNode->hasReanimatedCommitTrait()) {
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/ReanimatedCommitHook.h` (modified, +2/-0)
```diff
@@ -22,6 +22,7 @@ class ReanimatedCommitHook : public UIManagerCommitHook {
       const std::shared_ptr<UpdatesRegistryManager> &updatesRegistryManager,
       const std::shared_ptr<MountedRootsRegistry> &mountedRootsRegistry,
       const std::shared_ptr<LayoutAnimationsProxyRegistry> &layoutAnimationsProxyRegistry,
+      const std::shared_ptr<LayoutAnimationsManager> &layoutAnimationsManager,
       const std::shared_ptr<SynchronousWritesTracker> &synchronousWritesTracker);
 
   ~ReanimatedCommitHook() noexcept override;
@@ -54,6 +55,7 @@ class ReanimatedCommitHook : public UIManagerCommitHook {
   std::shared_ptr<UpdatesRegistryManager> updatesRegistryManager_;
   std::shared_ptr<MountedRootsRegistry> mountedRootsRegistry_;
   std::shared_ptr<LayoutAnimationsProxyRegistry> layoutAnimationsProxyRegistry_;
+  std::shared_ptr<LayoutAnimationsManager> layoutAnimationsManager_;
   std::shared_ptr<SynchronousWritesTracker> synchronousWritesTracker_;
 };
 
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/ReanimatedMountHook.cpp` (modified, +15/-9)
```diff
@@ -36,7 +36,13 @@ void ReanimatedMountHook::shadowTreeDidMount(
   ReanimatedSystraceSection s("ReanimatedMountHook::shadowTreeDidMount");
 
   if constexpr (StaticFeatureFlags::getFlag("USE_ANIMATION_BACKEND")) {
-    // With the animation backend this hook only tracks surface unmounts.
+    std::vector<Tag> removedTags;
+    {
+      auto lock = updatesRegistryManager_->lock();
+      mountedRootsRegistry_->set(rootShadowNode);
+      removedTags = updatesRegistryManager_->handleNodeRemovals(rootShadowNode->getSurfaceId());
+    }
+    releaseSharedTransitionConfigs(removedTags);
     return;
   }
 
@@ -57,7 +63,7 @@ void ReanimatedMountHook::shadowTreeDidMount(
     // animations run every mount carries the mount trait, so returning early here
     // would skip removals for the whole animation and leak unmounted nodes if the
     // tree is torn down mid-animation.
-    removedTags = updatesRegistryManager_->handleNodeRemovals();
+    removedTags = updatesRegistryManager_->handleNodeRemovals(rootShadowNode->getSurfaceId());
 
     if (!isReanimatedMount) {
       // When a commit from React Native has finished, we reset the skip commit
@@ -69,13 +75,13 @@ void ReanimatedMountHook::shadowTreeDidMount(
     }
   }
 
-  // Outside the registry lock: a pull holds the layout animations lock while it reads synchronous props.
-  // Only after the mount: the pull that deletes a shared transition source still reads its config.
-  if constexpr (StaticFeatureFlags::getFlag("ENABLE_SHARED_ELEMENT_TRANSITIONS")) {
-    if (!removedTags.empty() && layoutAnimationsProxyRegistry_) {
-      layoutAnimationsManager_->clearSharedTransitionConfigs(
-          layoutAnimationsProxyRegistry_->sharedTransitionConfigsToRelease(removedTags));
-    }
+  releaseSharedTransitionConfigs(removedTags);
+}
+
+// Only after the mount: the pull that deletes a shared transition source still reads its config.
+void ReanimatedMountHook::releaseSharedTransitionConfigs(const std::vector<Tag> &removedTags) const {
+  if (layoutAnimationsProxyRegistry_) {
+    layoutAnimationsProxyRegistry_->releaseSharedTransitionConfigs(removedTags, *layoutAnimationsManager_);
   }
 }
 
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/Fabric/ReanimatedMountHook.h` (modified, +3/-0)
```diff
@@ -10,6 +10,7 @@
 #include <react/renderer/uimanager/UIManagerMountHook.h>
 
 #include <memory>
+#include <vector>
 
 namespace reanimated {
 
@@ -32,6 +33,8 @@ class ReanimatedMountHook : public UIManagerMountHook {
   void shadowTreeDidUnmount(SurfaceId surfaceId, HighResTimeStamp unmountTime) noexcept override;
 
  private:
+  void releaseSharedTransitionConfigs(const std::vector<Tag> &removedTags) const;
+
   const std::shared_ptr<UIManager> uiManager_;
   const std::shared_ptr<UpdatesRegistryManager> updatesRegistryManager_;
   const std::shared_ptr<MountedRootsRegistry> mountedRootsRegistry_;
```

---

### Incident Patch 2: `68d7650a` (2026-11-05)
**Commit Message**: fix(SET): show the real content of a removed RN Modal while its shared element flies out on iOS (#11112)

> [!NOTE]
> This pull request was authored by AI on behalf of @bartlomiejbloniarz.

Replaces #11038. GitHub closed that PR as merged into the
`@bartlomiejbloniarz/set-config-release` branch when I moved it below
#11037 in the stack, so it can no longer be updated. The review threads
stay there: the two fixes for them are the last two commits on this
branch.

Rebased onto `main` after #10880 landed. #10884 no longer has the
`renderInContext:` render described below, so this PR now only adds the
hold. The before/after recordings show the old render against the hold.

## Summary

When React unmounts an RN `Modal` while it is presented, for example
`{open && <Modal visible>}`, React Native dismisses it from a snapshot
of what the screen showed, taken with
`snapshotViewAfterScreenUpdates:NO`. A shared element source inside that
modal is hidden in the same mount, too late to be left out of the
snapshot. That is why the sheet slid away with a copy of the element.
Until now we replaced React Native's snapshot with our own
`renderInContext:` render of the modal without its sources. That

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp` (modified, +56/-0)
```diff
@@ -981,6 +981,18 @@ void LayoutAnimationsProxy::handleSubtreeRemoval(const std::shared_ptr<LightNode
     }
   }
   const bool defersTeardown = holdsSnapshottedScreen(node);
+#ifdef __APPLE__
+  if (!defersTeardown && holdsSourceInModal(node, transaction)) {
+    std::unordered_set<Tag> heldTags;
+    collectSubtreeTags(node, heldTags);
+    for (const auto tag : heldTags) {
+      layoutAnimationsManager_->clearLayoutAnimationConfig(tag);
+    }
+    node->setExitingState(COMPLETED);
+    transaction.modalsToHold.push_back(node);
+    return;
+  }
+#endif
   const SubtreeRemovalConfig config = {
       .shouldRemoveSubviewsWithoutAnimations = true,
       .shouldAnimate = !transaction.surfaceDropped,
@@ -1027,6 +1039,30 @@ bool LayoutAnimationsProxy::holdsSnapshottedScreen([[maybe_unused]] const std::s
   return false;
 }
 
+#ifdef __APPLE__
+// React Native animates a modal that it removes while presented from a snapshot of what the screen shows, which lags a
+// mount by up to two frames. A modal that holds the source of a transition stays mounted until 34 ms, two frames of a
+// 60 Hz display, after the mount that hides the source.
+bool LayoutAnimationsProxy::holdsSourceInModal(
+    const std::shared_ptr<LightNode> &node,
+    const TransactionMeta &transaction) const {
+  return std::ranges::any_of(transaction.transitionMap, [&](const auto &entry) {
+    bool insideModal = false;
+    for (const auto &ancestor : entry.second.ancestors[BEFORE]) {
+      const auto ancestorIt = lightNodes_.find(ancestor.tag);
+      if (ancestorIt == lightNodes_.end()) {
+        return false;
+      }
+      insideModal = insideModal || !strcmp(ancestorIt->second->current.componentName, "ModalHostView");
+      if (ancestorIt->second == node) {
+        return insideModal;
+      }
+    }
+    return false;
+  });
+}
+#endif
+
 // A UI-thread pull on Android must not update the views that the next flushing pull removes, because
 // Android can mount that JS-thread pull first.
 void LayoutAnimationsProxy::collectDueRemovals(TransactionMeta &transaction) const {
@@ -1039,6 +1075,23 @@ void LayoutAnimationsProxy::collectDueRemovals(TransactionMeta &transaction) con
     }
     finishedExits.push_back(nodeIt->second);
   }
+#ifdef __APPLE__
+  const auto now = std::chrono::steady_clock::now();
+  for (auto &node : transaction.modalsToHold) {
+    heldModals_.push_back({std::move(node), now + std::chrono::milliseconds(34)});
+  }
+  std::erase_if(heldModals_, [&](const HeldModal &held) {
+    if (!isLightNodeMapped(held.node)) {
+      return true;
+    }
+    if (transaction.surfaceDropped || now >= held.removableAt) {
+      finishedExits.push_back(held.node);
+      return true;
+    }
+    schedulePullOnNextFrame();
+    return false;
+  });
+#endif
   transaction.dueRemovals = collectRemovals(finishedExits);
 }
 
@@ -1253,6 +1306,9 @@ void LayoutAnimationsProxy::clearSurfaceState() const {
     uncommittedScreenPop_.reset();
     visibleScreens_.clear();
   }
+#ifdef __APPLE__
+  heldModals_.clear();
+#endif
 #ifdef ANDROID
   cleanupPullScheduled_ = false;
   unqueuedBatchTags_.clear();
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.h` (modified, +13/-0)
```diff
@@ -16,6 +16,7 @@
 #include <react/renderer/uimanager/UIManagerBinding.h>
 
 #include <array>
+#include <chrono>
 #include <memory>
 #include <optional>
 #include <string>
@@ -141,6 +142,13 @@ struct CollectedTransition {
 using CollectedTransitionMap = std::unordered_map<SharedTag, CollectedTransition>;
 using CollectedTransitions = std::vector<std::pair<SharedTag, CollectedTransition>>;
 
+#ifdef __APPLE__
+struct HeldModal {
+  std::shared_ptr<LightNode> node;
+  std::chrono::steady_clock::time_point removableAt;
+};
+#endif
+
 struct TransactionMeta {
   ShadowViewMutationList filteredMutations;
   ShadowViewMutationList teardownMutations;
@@ -156,6 +164,7 @@ struct TransactionMeta {
   std::optional<size_t> screenSnapshotRemoval;
   std::unordered_map<Tag, Tag> staleSnapshots;
   std::unordered_set<Tag> dueRemovals;
+  std::vector<std::shared_ptr<LightNode>> modalsToHold;
   std::unordered_set<Tag> recreatedTags;
   // Whatever changes a node's children or their exiting states during updateLightTree must reset its cursors.
   std::unordered_map<Tag, IndexCursors> indexCursors;
@@ -200,6 +209,7 @@ struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
 #endif
 
 #ifdef __APPLE__
+  mutable std::vector<HeldModal> heldModals_;
   ForceScreenSnapshotFunction forceScreenSnapshot_;
   SetSharedTransitionOverlayFunction setSharedTransitionOverlay_;
   NativeViewPlacementFunction nativeViewPlacement_;
@@ -500,6 +510,9 @@ struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
 
   void handleSubtreeRemoval(const std::shared_ptr<LightNode> &node, TransactionMeta &transaction) const;
   bool holdsSnapshottedScreen(const std::shared_ptr<LightNode> &node) const;
+#ifdef __APPLE__
+  bool holdsSourceInModal(const std::shared_ptr<LightNode> &node, const TransactionMeta &transaction) const;
+#endif
   void collectDueRemovals(TransactionMeta &transaction) const;
   void tearDown(const std::unordered_set<Tag> &removals, ShadowViewMutationList &mutations) const;
 
```

**File**: `packages/react-native-reanimated/changelog/shared-transition-modal-snapshot.other.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Animate a React Native modal that is removed during a shared element transition on iOS with React Native's own snapshot.
```

---

### Incident Patch 3: `ce75f0ce` (2026-11-06)
**Commit Message**: fix(LayoutAnimations): report a JS error thrown by a layout animation start instead of terminating the app (#11173)

> [!NOTE]
> This pull request was authored by AI on behalf of @tjzel.

## Summary

Since #11135 the Reanimated runtime tests terminate the app on both
platforms in the suite "Shared transition to a new native stack screen",
which made every PR red. The test's UI-runtime `start` override reads
`values.source.globalOriginY`, but the native side builds a flat object
with `currentGlobalOriginY` and `targetGlobalOriginY`, so the override
throws a TypeError. The `jsi::JSError` left
`LayoutAnimationsManager::startLayoutAnimation` on the main thread
inside `pullTransaction` with no handler, and `std::terminate` aborted
the app without a crash report. I fixed the test to read the flat keys.
I also made the native `start` and `stop` calls go through the worklets
stable API `runSyncOnRuntime`, so a JS error thrown by a layout
animation start or stop on the UI runtime is reported like an error in
`runOnUI` instead of terminating the app. This guard is active in Debug
builds only, the same policy that Worklets applies to every worklet
runtime call.

## Test plan

Suites "shared e

**File**: `apps/common-app/runtime-tests/reanimated/suites.ts` (modified, +1/-0)
```diff
@@ -168,6 +168,7 @@ export const REANIMATED_TEST_SUITES: RuntimeTestSuite[] = [
     testSuiteName: 'layout animations entering',
     importTest: () => {
       require('./tests/layoutAnimations/entering/movedBeforeFirstPaint.test');
+      require('./tests/layoutAnimations/startError.test');
     },
   },
   {
```

**File**: `apps/common-app/runtime-tests/reanimated/tests/layoutAnimations/startError.test.tsx` (added, +186/-0)
```diff
@@ -0,0 +1,186 @@
+import { StyleSheet } from 'react-native';
+import type {
+  EntryExitAnimationFunction,
+  EntryOrExitLayoutType,
+  LayoutAnimation,
+} from 'react-native-reanimated';
+import Animated, {
+  FadeIn,
+  FadeOut,
+  LinearTransition,
+} from 'react-native-reanimated';
+
+import {
+  describe,
+  expect,
+  expectEventually,
+  getTestComponent,
+  isViewMountedNatively,
+  render,
+  test,
+  notify,
+  useTestRef,
+  waitForFrames,
+  waitForNotification,
+} from '../../../ReJest/RuntimeTestsApi';
+import { ComparisonMode } from '../../../ReJest/types';
+import { runOnUIBlocking } from '../../../ReJest/utils/runOnUIBlocking';
+
+const START_ERROR = 'layout animation start throws on purpose';
+const ON_START_ERROR = 'layout animation onStart throws on purpose';
+const FADE_IN_FINISHED = 'startErrorFadeInFinished';
+
+const throwingOnStart: EntryExitAnimationFunction = () => {
+  'worklet';
+  return {
+    initialValues: { opacity: 0 },
+    animations: {
+      opacity: {
+        current: 0,
+        onStart: () => {
+          throw new Error(ON_START_ERROR);
+        },
+        onFrame: () => true,
+      },
+    },
+  } as unknown as LayoutAnimation;
+};
+
+const notifyingFadeIn = FadeIn.duration(100).withCallback((finished) => {
+  'worklet';
+  if (finished) {
+    notify(FADE_IN_FINISHED);
+  }
+});
+
+function Box({
+  exiting,
+  entering = exiting ? undefined : FadeIn.duration(100),
+}: {
+  exiting?: boolean;
+  entering?: EntryOrExitLayoutType;
+}) {
+  const ref = useTestRef('box');
+  return (
+    <Animated.View
+      ref={ref}
+      entering={entering}
+      exiting={exiting ? FadeOut.duration(100) : undefined}
+      style={styles.box}
+    />
+  );
+}
+
+function LayoutBox({ wide }: { wide: boolean }) {
+  const ref = useTestRef('layoutBox');
+  return (
+    <Animated.View
+      ref={ref}
+      layout={LinearTransition.duration(100)}
+      style={wide ? styles.wideBox : styles.box}
+    />
+  );
+}
+
+function readMountedProps(tag: number) {
+  return runOnUIBlocking(() => {
+    'worklet';
+    return global._obtainMountedViewProps(tag, true);
+  });
+}
+
+function readFrameTimestampOnUI() {
+  return runOnUIBlocking(() => {
+    'worklet';
+    return global.__frameTimestamp;
+  });
+}
+
+async function throwFromLayoutAnimationStart() {
+  await runOnUIBlocking(() => {
+    'worklet';
+    global.originalLayoutAnimationsManager = global.LayoutAnimationsManager;
+    global.LayoutAnimationsManager = {
+      start: () => {
+        throw new Error(START_ERROR);
+      },
+      stop: global.originalLayoutAnimationsManager.stop,
+    };
+  });
+}
+
+async function restoreLayoutAnimationStart() {
+  await runOnUIBlocking(() => {
+    'worklet';
+    global.LayoutAnimationsManager = global.originalLayoutAnimationsManager;
+  });
+}
+
+if (__DEV__) {
+  describe('Layout animation start that throws', () => {
+    test('is reported without terminating the app', async () => {
+      await throwFromLayoutAnimationStart();
+      try {
+        await render(<Box />);
+        await waitForFrames(5);
+      } finally {
+        await restoreLayoutAnimationStart();
+      }
+      const tag = getTestComponent('box').getTag();
+      expect((await readMountedProps(tag))?.opacity).toBe(1);
+      await render(null);
+    });
+
+    test('shows the final frame and props of a layout change', async () => {
+      await render(<LayoutBox wide={false} />);
+      await waitForFrames(3);
+      const tag = getTestComponent('layoutBox').getTag();
+      await throwFromLayoutAnimationStart();
+      try {
+        await render(<LayoutBox wide />);
+        await waitForFrames(5);
+      } finally {
+        await restoreLayoutAnimationStart();
+      }
+      const props = await readMountedProps(tag);
+      expect(props?.width).toBe(WIDE_WIDTH);
+      expect(props?.backgroundColor).toBe(WIDE_COLOR, ComparisonMode.COLOR);
+      await render(null);
+    });
+
+    test('drops the JS state of an animation whose onStart throws', async () => {
+      await render(<Box entering={throwingOnStart} />);
+      await waitForFrames(5);
+      expect(await readFrameTimestampOnUI()).toBe(undefined);
+      await render(null);
+
+      await render(<Box entering={notifyingFadeIn} />);
+      await waitForNotification(FADE_IN_FINISHED);
+      await render(null);
+    });
+
+    test('removes the exiting view at once', async () => {
+      await render(<Box exiting />);
+      await waitForFrames(3);
+      const tag = getTestComponent('box').getTag();
+      expect(await isViewMountedNatively(tag)).toBe(true);
+      await throwFromLayoutAnimationStart();
+      try {
+        await render(null);
+        await expectEventually(() => isViewMountedNatively(tag), 1000).toBe(
+          false
+        );
+      } finally {
+        await restoreLayoutAnimationStart();
+      }
+    });
+  });
+}
+
+const WIDE_WIDTH = 200;
+const WIDE_COLOR = '#dd2222';
+
+const styles = StyleSheet.create({
+  bo
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsManager.cpp` (modified, +44/-13)
```diff
@@ -2,6 +2,7 @@
 
 #include <react/debug/react_native_assert.h>
 
+#include <functional>
 #include <memory>
 #include <unordered_map>
 #include <utility>
@@ -130,30 +131,60 @@ void LayoutAnimationsManager::clearSharedTransitionConfigs(const std::vector<Tag
   }
 }
 
-void LayoutAnimationsManager::startLayoutAnimation(
+bool LayoutAnimationsManager::startLayoutAnimation(
     jsi::Runtime &rt,
     const int tag,
     const LayoutAnimationType type,
     const jsi::Object &values,
     const std::shared_ptr<Serializable> &config) {
   react_native_assert(config && "layout animation config is null");
   if (!config) {
-    return;
+    return false;
   }
-  // TODO: cache the following!!
-  jsi::Value layoutAnimationRepositoryAsValue =
-      rt.global().getPropertyAsObject(rt, "global").getProperty(rt, "LayoutAnimationsManager");
-  jsi::Function startAnimationForTag =
-      layoutAnimationRepositoryAsValue.getObject(rt).getPropertyAsFunction(rt, "start");
-  startAnimationForTag.call(rt, jsi::Value(tag), jsi::Value(static_cast<int>(type)), values, config->toJSValue(rt));
+  const auto configValue = config->toJSValue(rt);
+  return callLayoutAnimationsManager(rt, "start", [&](jsi::Runtime &runtime, const jsi::Function &start) {
+    start.call(runtime, jsi::Value(tag), jsi::Value(static_cast<int>(type)), values, configValue);
+  });
 }
 
 void LayoutAnimationsManager::cancelLayoutAnimation(jsi::Runtime &rt, const int tag) const {
-  jsi::Value layoutAnimationRepositoryAsValue =
-      rt.global().getPropertyAsObject(rt, "global").getProperty(rt, "LayoutAnimationsManager");
-  jsi::Function cancelLayoutAnimation =
-      layoutAnimationRepositoryAsValue.getObject(rt).getPropertyAsFunction(rt, "stop");
-  cancelLayoutAnimation.call(rt, jsi::Value(tag));
+  callLayoutAnimationsManager(
+      rt, "stop", [&](jsi::Runtime &runtime, const jsi::Function &stop) { stop.call(runtime, jsi::Value(tag)); });
+}
+
+bool LayoutAnimationsManager::callLayoutAnimationsManager(
+    jsi::Runtime &rt,
+    const char *methodName,
+    const std::function<void(jsi::Runtime &, const jsi::Function &)> &call) {
+  return runGuardedOnUIRuntime(rt, methodName, [&](jsi::Runtime &runtime) {
+    const auto method = runtime.global()
+                            .getPropertyAsObject(runtime, "global")
+                            .getPropertyAsObject(runtime, "LayoutAnimationsManager")
+                            .getPropertyAsFunction(runtime, methodName);
+    call(runtime, method);
+  });
+}
+
+bool LayoutAnimationsManager::runGuardedOnUIRuntime(
+    jsi::Runtime &rt,
+    const char *name,
+    const std::function<void(jsi::Runtime &)> &call) {
+  const auto uiRuntime = worklets::getWeakRuntimeFromJSIRuntime(rt).lock();
+  if (!uiRuntime) {
+    return false;
+  }
+  bool completed = false;
+  const auto guardedCall = jsi::Function::createFromHostFunction(
+      rt,
+      jsi::PropNameID::forAscii(rt, name),
+      0,
+      [&](jsi::Runtime &runtime, const jsi::Value &, const jsi::Value *, size_t) {
+        call(runtime);
+        completed = true;
+        return jsi::Value::undefined();
+      });
+  worklets::runSyncOnRuntime(uiRuntime, guardedCall);
+  return completed;
 }
 
 void LayoutAnimationsManager::transferConfigFromNativeID(const int nativeId, const int tag) {
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsManager.h` (modified, +8/-1)
```diff
@@ -6,6 +6,7 @@
 #include <reanimated/LayoutAnimations/LayoutAnimationType.h>
 
 #include <jsi/jsi.h>
+#include <functional>
 #include <memory>
 #include <mutex>
 #include <optional>
@@ -68,7 +69,7 @@ class LayoutAnimationsManager {
   bool hasLayoutAnimationConfigs(const LayoutAnimationType type);
   std::optional<SharedTransitionConfig> getSharedTransitionConfig(const int tag);
   std::shared_ptr<Serializable> takeExitingAnimationConfigAndClearTag(int tag);
-  void startLayoutAnimation(
+  bool startLayoutAnimation(
       jsi::Runtime &rt,
       const int tag,
       const LayoutAnimationType type,
@@ -80,8 +81,14 @@ class LayoutAnimationsManager {
   void cancelLayoutAnimation(jsi::Runtime &rt, const int tag) const;
   void transferConfigFromNativeID(const int nativeId, const int tag);
   std::shared_ptr<SharedTransitionManager> getSharedTransitionManager();
+  static bool
+  runGuardedOnUIRuntime(jsi::Runtime &rt, const char *name, const std::function<void(jsi::Runtime &)> &call);
 
  private:
+  static bool callLayoutAnimationsManager(
+      jsi::Runtime &rt,
+      const char *methodName,
+      const std::function<void(jsi::Runtime &, const jsi::Function &)> &call);
   std::unordered_map<int, std::shared_ptr<Serializable>> &getConfigsForType(const LayoutAnimationType type);
 
   std::shared_ptr<SharedTransitionManager> sharedTransitionManager_;
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp` (modified, +1/-1)
```diff
@@ -941,7 +941,7 @@ void LayoutAnimationsProxy::initializeLightTree(const ShadowTreeRevision &baseRe
 
 // MARK: Layout Animation Updates
 
-std::optional<SurfaceId> LayoutAnimationsProxy::endLayoutAnimation(int tag, bool shouldRemove) {
+std::optional<SurfaceId> LayoutAnimationsProxy::endLayoutAnimation(int tag, bool shouldRemove) const {
   auto lock = std::unique_lock<std::recursive_mutex>(mutex);
   auto layoutAnimationIt = layoutAnimations_.find(tag);
 
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.h` (modified, +1/-1)
```diff
@@ -365,7 +365,7 @@ struct LayoutAnimationsProxy : public LayoutAnimationsProxyCommon {
   void keepTransitioningViewsHidden(
       ShadowViewMutationList &filteredMutations,
       const PropsParserContext &propsParserContext) const;
-  std::optional<SurfaceId> endLayoutAnimation(int tag, bool shouldRemove) override;
+  std::optional<SurfaceId> endLayoutAnimation(int tag, bool shouldRemove) const override;
   void startSurface(
       const facebook::react::ShadowTree &shadowTree,
       std::weak_ptr<const facebook::react::MountingOverrideDelegate> mountingOverrideDelegate) override;
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxyCommon.cpp` (modified, +11/-3)
```diff
@@ -417,6 +417,7 @@ void LayoutAnimationsProxyCommon::flushLayoutAnimationOperationsLocked() const {
   pendingLayoutAnimations_.clear();
   reconcileLayoutAnimationOperations(operations);
   auto deferredStarts = takeDeferredLayoutAnimationStarts(operations);
+  bool hasFailedStart = false;
   for (auto operation = takeNextLayoutAnimationOperation(operations); operation;
        operation = takeNextLayoutAnimationOperation(operations)) {
     if (const auto *stop = std::get_if<LayoutAnimationStop>(&*operation)) {
@@ -462,11 +463,14 @@ void LayoutAnimationsProxyCommon::flushLayoutAnimationOperationsLocked() const {
     }
     values.setProperty(uiRuntime_, "windowWidth", window.width);
     values.setProperty(uiRuntime_, "windowHeight", window.height);
-    layoutAnimationsManager_->startLayoutAnimation(uiRuntime_, start.tag, start.type, values, start.config);
+    if (!layoutAnimationsManager_->startLayoutAnimation(uiRuntime_, start.tag, start.type, values, start.config)) {
+      endLayoutAnimation(start.tag, start.type == LayoutAnimationType::EXITING);
+      hasFailedStart = true;
+    }
   }
   const bool hasNewOperations = !layoutAnimationOperations_.empty();
   requeueLayoutAnimationStarts(std::move(deferredStarts));
-  if (hasNewOperations) {
+  if (hasNewOperations || hasFailedStart) {
     requestLayoutAnimationFlush_(surfaceId_);
   }
 }
@@ -773,7 +777,11 @@ void LayoutAnimationsProxyCommon::cleanupCompletedAnimations(
     auto &animation = completedAnimation.animation;
     auto finalView = animation.currentView;
     if (needsFinalFrameReconciliation(animation.type)) {
-      finalView.layoutMetrics = animation.finalView.layoutMetrics;
+      if (animation.currentView == animation.startView) {
+        finalView = animation.finalView;
+      } else {
+        finalView.layoutMetrics = animation.finalView.layoutMetrics;
+      }
     }
     if (!completedAnimation.shouldRemove && animation.opacity) {
 #ifdef ANDROID
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxyCommon.h` (modified, +1/-1)
```diff
@@ -143,7 +143,7 @@ class LayoutAnimationsProxyCommon : public facebook::react::MountingOverrideDele
     return false;
   }
   std::optional<SurfaceId> progressLayoutAnimation(int tag, const jsi::Object &newStyle);
-  virtual std::optional<SurfaceId> endLayoutAnimation(int tag, bool shouldRemove) = 0;
+  virtual std::optional<SurfaceId> endLayoutAnimation(int tag, bool shouldRemove) const = 0;
   virtual void startSurface(
       const facebook::react::ShadowTree &shadowTree,
       std::weak_ptr<const facebook::react::MountingOverrideDelegate> mountingOverrideDelegate);
```

#### Recent Merged Pull Requests:
- **PR #11212** (2026-11-06): test(runtime-tests): compare recorded shared transition starts with the measured view position (@tjzel)
- **PR #11211** (2026-11-06): test(Reanimated): compare react-freeze boxes by drift, not by absolute spread (@tjzel)
- **PR #11210** (2026-11-06): fix(Worklets): resolve the Babel plugin tests against the workspace on 4.7-stable (@tjzel)
- **PR #11208** (2026-11-06): chore(common-app): mark the fixed iOS shared element transition examples as working (@bartlomiejbloniarz)
- **PR #11183** (2026-11-06): @tjzel/runtime tests/shared transition start values (@tjzel)
- **PR #11182** (closed): fix(LayoutAnimations): Fix Android entering animations with reduced motion (@pawicao)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
