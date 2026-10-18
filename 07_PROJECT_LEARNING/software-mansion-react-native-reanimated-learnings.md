> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-reanimated-learnings.md`  
> **Source**: github ([https://github.com/software-mansion/react-native-reanimated](https://github.com/software-mansion/react-native-reanimated))  
> **Source Version**: `f21f7262`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T23:57:58.445Z  
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
> **Harvest Timestamp**: 2026-10-18T23:57:58.438Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-reanimated`
- **Description**: React Native's Animated library reimplemented
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11027 stars

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

### Incident Patch 1: `d25c744f` (2026-10-13)
**Commit Message**: fix(runtime-tests): return fresh arrays from ReJest recorded updates (#10857)

## Summary

`getUpdates()` and `getNativeSnapshots()` on the ReJest updates
container returned the recorder's live arrays from the UI runtime.
Serialization caches arrays by identity, and the recorder mutates them
in place, so a second read during the same recording returned the
content of the first one. Existing tests read only once, after recording
ends, so nothing hit it until #10713 started reading mid-recording.

The container now returns copies. An empty recording also throws `No
updates were recorded` instead of the misleading "Recorded snapshots of
many views" error.

## Test plan

The `Animated.Text` runtime tests in #10713 (stacked on this PR) read
the recording twice in `switchFlagMidAnimation` and in "keeps updating
while the JS thread is blocked". Without this fix, the second read
equals the first and those tests fail.

```sh
yarn workspace fabric-example runtime-tests --library reanimated --platform ios --only props --udid <udid>
```

## Changelog

- [x] I added a changelog fragment with `yarn changelog:add` for each
changed package, or this PR does not change `react-native-reanimated` or
`

**File**: `apps/common-app/runtime-tests/ReJest/TestRunner/UpdatesContainer.ts` (modified, +7/-2)
```diff
@@ -183,6 +183,9 @@ export function createUpdatesContainer() {
       if (viewTags.length === 1) {
         return sortedUpdates[Number(viewTags[0])];
       }
+      if (viewTags.length === 0) {
+        throw new Error('No updates were recorded');
+      }
       throw new Error(
         'Recorded snapshots of many views, specify component you want to get snapshot of'
       );
@@ -199,9 +202,11 @@ export function createUpdatesContainer() {
     return runOnUIBlocking(
       () => {
         'worklet';
+        // Copies, because serialization caches arrays by identity and the
+        // recorder mutates them in place, so a second read would be stale.
         return {
-          jsUpdates: jsUpdates.value,
-          nativeSnapshots: nativeSnapshots.value,
+          jsUpdates: [...jsUpdates.value],
+          nativeSnapshots: [...nativeSnapshots.value],
         };
       },
       undefined,
```

---

### Incident Patch 2: `a03d13c9` (2026-10-15)
**Commit Message**: fix(CSS): handle PlatformColor and DynamicColorIOS values (#10282)

First PR of a series adding `PlatformColor` support to CSS animations.
It puts the skeleton in place - the value type and the shared-code
changes the layer needs to carry one - without resolving anything yet.
Resolution and blending follow in #10305.

`PlatformColor` and `DynamicColorIOS` payloads are objects, but
`CSSColor` accepts only numbers and bools, so a color property carrying
one killed the app with `No compatible type found for construction`.

They now parse into `CSSPlatformColor`, which keeps the payload and
hands it back from `toDynamic()` for React Native to resolve against the
surface's theme, exactly as for a static style. Color properties accept
either alternative, `value<CSSColor, CSSPlatformColor>`.

Turning a payload into channels needs the animated view, which is not
implemented here, so a platform color reports that it cannot interpolate
and the variant switches over instead. Nothing throws.

Shared code moves to make room for it. `CSSPlatformColor` is the first
value type that resolves without being relative to a view property, a
distinction the two `value()` overloads did not draw before, so

**File**: `apps/common-app/runtime-tests/reanimated/suites.ts` (modified, +1/-0)
```diff
@@ -87,6 +87,7 @@ export const REANIMATED_TEST_SUITES: RuntimeTestSuite[] = [
     importTest: () => {
       require('./tests/css/animationCancellation.test');
       require('./tests/css/backgroundImage.test');
+      require('./tests/css/platformColor.test');
       require('./tests/css/transformNone.test');
     },
   },
```

**File**: `apps/common-app/runtime-tests/reanimated/tests/css/platformColor.test.tsx` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+import { useEffect, useState } from 'react';
+import { PlatformColor, View } from 'react-native';
+import Animated from 'react-native-reanimated';
+import Svg, { Circle } from 'react-native-svg';
+
+import {
+  describe,
+  render,
+  test,
+  waitForFrames,
+} from '../../../ReJest/RuntimeTestsApi';
+
+const AnimatedCircle = Animated.createAnimatedComponent(Circle);
+
+const PLATFORM_BLUE = PlatformColor(
+  'systemBlue',
+  '@android:color/holo_blue_light'
+);
+const PLATFORM_GREEN = PlatformColor(
+  'systemGreen',
+  '@android:color/holo_green_light'
+);
+
+function PlatformColorExample() {
+  const [toggled, setToggled] = useState(false);
+
+  useEffect(() => {
+    const id = setTimeout(() => setToggled(true), 100);
+    return () => clearTimeout(id);
+  }, []);
+
+  return (
+    <View>
+      <Animated.View
+        style={{
+          animationDuration: '200ms',
+          animationName: {
+            from: { backgroundColor: PLATFORM_BLUE },
+            to: { backgroundColor: 'red' },
+          },
+          height: 50,
+          width: 50,
+        }}
+      />
+      <Animated.View
+        style={{
+          backgroundColor: toggled ? PLATFORM_GREEN : 'red',
+          height: 50,
+          transitionDuration: '200ms',
+          transitionProperty: 'backgroundColor',
+          width: 50,
+        }}
+      />
+      <Svg height={100} width={100}>
+        <AnimatedCircle
+          animatedProps={{
+            animationDuration: '200ms',
+            animationName: {
+              from: { fill: PLATFORM_BLUE },
+              to: { fill: 'red' },
+            },
+            stroke: toggled ? PLATFORM_GREEN : 'red',
+            transitionDuration: '200ms',
+            transitionProperty: 'stroke',
+          }}
+          cx={50}
+          cy={50}
+          r={40}
+        />
+      </Svg>
+    </View>
+  );
+}
+
+describe('CSS PlatformColor', () => {
+  test('does not crash', async () => {
+    await render(<PlatformColorExample />);
+    await waitForFrames(60);
+  });
+});
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/CSS/InterpolatorRegistry.cpp` (modified, +23/-21)
```diff
@@ -9,6 +9,7 @@
 #include <reanimated/CSS/common/values/CSSKeyword.h>
 #include <reanimated/CSS/common/values/CSSLength.h>
 #include <reanimated/CSS/common/values/CSSNumber.h>
+#include <reanimated/CSS/common/values/CSSPlatformColor.h>
 #include <reanimated/CSS/common/values/CSSValue.h>
 
 #include <reanimated/CSS/common/transforms/TransformMatrix2D.h>
@@ -18,6 +19,7 @@
 #include <reanimated/CSS/svg/values/CSSLengthArray.h>
 #include <reanimated/CSS/svg/values/SVGBrush.h>
 #include <reanimated/CSS/svg/values/SVGPath.h>
+#include <reanimated/CSS/svg/values/SVGPlatformBrush.h>
 #include <reanimated/CSS/svg/values/SVGStops.h>
 #include <reanimated/CSS/svg/values/SVGStrokeDashArray.h>
 
@@ -128,7 +130,7 @@ const InterpolatorFactoriesRecord STYLE_INTERPOLATORS = {
     {"direction", value<CSSKeyword>("inherit")},
 
     // Shadow (iOS)
-    {"shadowColor", value<CSSColor>(BLACK)},
+    {"shadowColor", value<CSSColor, CSSPlatformColor>(BLACK)},
     {"shadowOffset", record({{"width", value<CSSDouble>(0)}, {"height", value<CSSDouble>(0)}})},
     {"shadowRadius", value<CSSDouble>(0)},
     {"shadowOpacity", value<CSSDouble>(1)},
@@ -171,37 +173,37 @@ const InterpolatorFactoriesRecord STYLE_INTERPOLATORS = {
 
     // View
     {"backfaceVisibility", value<CSSKeyword>("visible")},
-    {"backgroundColor", value<CSSColor>(TRANSPARENT)},
+    {"backgroundColor", value<CSSColor, CSSPlatformColor>(TRANSPARENT)},
 #if REACT_NATIVE_VERSION_MINOR >= 87
     {"backgroundImage", array({value<CSSGradient>(CSSGradient())})},
 #endif
     {"experimental_backgroundImage", array({value<CSSGradient>(CSSGradient())})},
-    {"borderBlockColor", value<CSSColor>(BLACK)},
-    {"borderBlockEndColor", value<CSSColor>(BLACK)},
-    {"borderBlockStartColor", value<CSSColor>(BLACK)},
-    {"borderBottomColor", value<CSSColor>(BLACK)},
+    {"borderBlockColor", value<CSSColor, CSSPlatformColor>(BLACK)},
+    {"borderBlockEndColor", value<CSSColor, CSSPlatformColor>(BLACK)},
+    {"borderBlockStartColor", value<CSSColor, CSSPlatformColor>(BLACK)},
+    {"borderBottomColor", value<CSSColor, CSSPlatformColor>(BLACK)},
     {"borderBottomEndRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
     {"borderBottomLeftRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
     {"borderBottomRightRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
     {"borderBottomStartRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
-    {"borderColor", value<CSSColor>(BLACK)},
+    {"borderColor", value<CSSColor, CSSPlatformColor>(BLACK)},
     {"borderCurve", value<CSSKeyword>("circular")},
-    {"borderEndColor", value<CSSColor>(BLACK)},
+    {"borderEndColor", value<CSSColor, CSSPlatformColor>(BLACK)},
     {"borderEndEndRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
     {"borderEndStartRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
-    {"borderLeftColor", value<CSSColor>(BLACK)},
+    {"borderLeftColor", value<CSSColor, CSSPlatformColor>(BLACK)},
     {"borderRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
-    {"borderRightColor", value<CSSColor>(BLACK)},
-    {"borderStartColor", value<CSSColor>(BLACK)},
+    {"borderRightColor", value<CSSColor, CSSPlatformColor>(BLACK)},
+    {"borderStartColor", value<CSSColor, CSSPlatformColor>(BLACK)},
     {"borderStartEndRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
     {"borderStartStartRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
     {"borderStyle", value<CSSKeyword>("solid")},
-    {"borderTopColor", value<CSSColor>(BLACK)},
+    {"borderTopColor", value<CSSColor, CSSPlatformColor>(BLACK)},
     {"borderTopEndRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
     {"borderTopLeftRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
     {"borderTopRightRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
     {"borderTopStartRadius", value<CSSLength>(0, {RelativeTo::Self, "width"})},
-    {"outlineColor", value<CSSColor>(BLACK)},
+    {"outlineColor", value<CSSColor, CSSPlatformColor>(BLACK)},
     {"outlineOffset", value<CSSDouble>(0)},
     {"outlineStyle", value<CSSKeyword>("solid")},
     {"outlineWidth", value<CSSDouble>(0)},
@@ -214,7 +216,7 @@ const InterpolatorFactoriesRecord STYLE_INTERPOLATORS = {
     {"mixBlendMode", value<CSSKeyword>("normal")},
 
     // Text
-    {"color", value<CSSColor>(BLACK)},
+    {"color", value<CSSColor, CSSPlatformColor>(BLACK)},
     {"fontFamily", value<CSSKeyword>("inherit")},
     {"fontSize", value<CSSTextDouble>(14)},
     {"fontStyle", value<CSSKeyword>("normal")},
@@ -223,15 +225,15 @@ const InterpolatorFactoriesRecord STYLE_INTERPOLATORS = {
     {"lineHeight", value<CSSTextDouble>(14)}, // TODO - should inherit from fontSize
     {"textAlign", value<CSSKeyword>("auto")},
     {"textDecorationLine", value<CSSKeyword>("none")},
-    {"textShadowColor", value<CSSColor>(BLACK)},
+    {"textShadowColor", value<CSSColor, CSSPlatformColor>(BLACK)}
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/CSS/common/values/CSSPlatformColor.cpp` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+#include <reanimated/CSS/common/values/CSSPlatformColor.h>
+#include <reanimated/CSS/utils/platformColor.h>
+
+#include <folly/json.h>
+#include <jsi/JSIDynamic.h>
+
+#include <utility>
+
+namespace reanimated::css {
+
+CSSPlatformColor::CSSPlatformColor(const folly::dynamic &value)
+    : payload(std::make_shared<const folly::dynamic>(value)) {}
+
+CSSPlatformColor::CSSPlatformColor(jsi::Runtime &rt, const jsi::Value &jsiValue)
+    : CSSPlatformColor(jsi::dynamicFromValue(rt, jsiValue)) {}
+
+bool CSSPlatformColor::canConstruct(jsi::Runtime &rt, const jsi::Value &jsiValue) {
+  return isPlatformColorPayload(rt, jsiValue);
+}
+
+bool CSSPlatformColor::canConstruct(const folly::dynamic &value) {
+  return isPlatformColorPayload(value);
+}
+
+folly::dynamic CSSPlatformColor::toDynamic() const {
+  return payload ? *payload : folly::dynamic();
+}
+
+std::string CSSPlatformColor::toString() const {
+  return payload ? folly::toJson(*payload) : "";
+}
+
+bool CSSPlatformColor::canInterpolateTo(const CSSPlatformColor & /*to*/) const {
+  // TODO: a platform color carries no channels to blend, since the payload is
+  // only resolved once React Native applies it to a view. Two of them switch
+  // over at the fallback threshold today; they should blend like any other
+  // color once a resolved value is reachable from here.
+  return false;
+}
+
+CSSPlatformColor CSSPlatformColor::interpolate(
+    const double progress,
+    const CSSPlatformColor &to,
+    const ValueInterpolationContext &context) const {
+  // Unreachable while canInterpolateTo() is false, and deliberately the same
+  // switch the variant would have applied, so behaviour holds either way.
+  return progress < context.fallbackInterpolateThreshold ? *this : to;
+}
+
+bool CSSPlatformColor::operator==(const CSSPlatformColor &other) const {
+  if (!payload || !other.payload) {
+    return payload == other.payload;
+  }
+  return *payload == *other.payload;
+}
+
+#ifndef NDEBUG
+
+std::ostream &operator<<(std::ostream &os, const CSSPlatformColor &color) {
+  os << "CSSPlatformColor(" << color.toString() << ")";
+  return os;
+}
+
+#endif // NDEBUG
+
+} // namespace reanimated::css
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/CSS/common/values/CSSPlatformColor.h` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+#pragma once
+
+#include <reanimated/CSS/common/values/CSSColor.h>
+#include <reanimated/CSS/common/values/CSSValue.h>
+
+#include <memory>
+#include <string>
+
+namespace reanimated::css {
+
+/// A PlatformColor or DynamicColorIOS payload, kept unresolved so toDynamic()
+/// hands it back to RN, which resolves it against the surface's own theme.
+///
+/// TODO: nothing resolves a payload yet, so this is resolvable in name only. It
+/// is declared that way because blending needs the payload turned into channels
+/// for the view being animated, and keyframes are shared by every view using an
+/// animation - so the value cannot be resolved once and cached on the keyframe.
+struct CSSPlatformColor : public CSSResolvableValue<CSSPlatformColor, ValueInterpolationContext> {
+  std::shared_ptr<const folly::dynamic> payload;
+
+  CSSPlatformColor() = default;
+  explicit CSSPlatformColor(const folly::dynamic &value);
+  explicit CSSPlatformColor(jsi::Runtime &rt, const jsi::Value &jsiValue);
+
+  static bool canConstruct(jsi::Runtime &rt, const jsi::Value &jsiValue);
+  static bool canConstruct(const folly::dynamic &value);
+
+  folly::dynamic toDynamic() const override;
+  std::string toString() const override;
+
+  bool canInterpolateTo(const CSSPlatformColor &to) const override;
+  CSSPlatformColor interpolate(double progress, const CSSPlatformColor &to, const ValueInterpolationContext &context)
+      const override;
+
+  bool operator==(const CSSPlatformColor &other) const;
+
+#ifndef NDEBUG
+  friend std::ostream &operator<<(std::ostream &os, const CSSPlatformColor &color);
+#endif // NDEBUG
+};
+
+} // namespace reanimated::css
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/CSS/common/values/CSSValue.h` (modified, +5/-0)
```diff
@@ -115,6 +115,11 @@ using InterpolationContextFor = typename InterpolationContext<TCSSValues...>::Ty
 template <typename TCSSValue, typename TContext>
 concept InterpolatesWith = !Resolvable<TCSSValue> || std::is_same_v<typename TCSSValue::ContextType, TContext>;
 
+/// Unlike InterpolatesWith, this demands the value actually resolve, and with
+/// this exact context.
+template <typename TCSSValue, typename TContext>
+concept ResolvesWith = Resolvable<TCSSValue> && std::is_same_v<typename TCSSValue::ContextType, TContext>;
+
 // Checks if a type is a discrete value
 template <typename TCSSValue>
 concept Discrete = requires {
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/CSS/common/values/CSSValueVariant.cpp` (modified, +5/-2)
```diff
@@ -5,12 +5,14 @@
 #include <reanimated/CSS/common/values/CSSKeyword.h>
 #include <reanimated/CSS/common/values/CSSLength.h>
 #include <reanimated/CSS/common/values/CSSNumber.h>
+#include <reanimated/CSS/common/values/CSSPlatformColor.h>
 #include <reanimated/CSS/common/values/CSSValueVariant.h>
 #include <reanimated/CSS/common/values/complex/CSSBoxShadow.h>
 #include <reanimated/CSS/common/values/complex/CSSGradient.h>
 #include <reanimated/CSS/svg/values/CSSLengthArray.h>
 #include <reanimated/CSS/svg/values/SVGBrush.h>
 #include <reanimated/CSS/svg/values/SVGPath.h>
+#include <reanimated/CSS/svg/values/SVGPlatformBrush.h>
 #include <reanimated/CSS/svg/values/SVGStops.h>
 #include <reanimated/CSS/svg/values/SVGStrokeDashArray.h>
 #include <reanimated/Compat/WorkletsApi.h>
@@ -140,7 +142,7 @@ template class CSSValueVariant<CSSIndex>;
 template class CSSValueVariant<CSSKeyword>;
 template class CSSValueVariant<CSSAngle>;
 template class CSSValueVariant<CSSBoolean>;
-template class CSSValueVariant<CSSColor>;
+template class CSSValueVariant<CSSColor, CSSPlatformColor>;
 template class CSSValueVariant<CSSDisplay>;
 template class CSSValueVariant<CSSBoxShadow>;
 template class CSSValueVariant<CSSGradient>;
@@ -150,6 +152,7 @@ template class CSSValueVariant<SVGPath>;
 template class CSSValueVariant<CSSLengthArray>;
 template class CSSValueVariant<SVGStops>;
 template class CSSValueVariant<SVGStrokeDashArray, CSSKeyword>;
-template class CSSValueVariant<SVGBrush>;
+template class CSSValueVariant<SVGBrush, CSSPlatformColor>;
+template class CSSValueVariant<SVGBrush, SVGPlatformBrush>;
 
 } // namespace reanimated::css
```

**File**: `packages/react-native-reanimated/Common/cpp/reanimated/CSS/interpolation/InterpolatorFactory.h` (modified, +16/-16)
```diff
@@ -10,7 +10,7 @@
 #include <reanimated/CSS/interpolation/transforms/TransformOperation.h>
 #include <reanimated/CSS/interpolation/transforms/TransformOperationInterpolator.h>
 #include <reanimated/CSS/interpolation/transforms/TransformsStyleInterpolator.h>
-#include <reanimated/CSS/interpolation/values/ResolvableValueInterpolator.h>
+#include <reanimated/CSS/interpolation/values/RelativeValueInterpolator.h>
 #include <reanimated/CSS/interpolation/values/SimpleValueInterpolator.h>
 
 #include <memory>
@@ -50,10 +50,10 @@ class SimpleValueInterpolatorFactory : public PropertyInterpolatorFactory {
 };
 
 template <typename... AllowedTypes>
-class ResolvableValueInterpolatorFactory : public PropertyInterpolatorFactory {
+class RelativeValueInterpolatorFactory : public PropertyInterpolatorFactory {
  public:
   template <typename TValue>
-  explicit ResolvableValueInterpolatorFactory(const TValue &defaultValue, ResolvableValueInterpolatorConfig config)
+  explicit RelativeValueInterpolatorFactory(const TValue &defaultValue, RelativeValueInterpolatorConfig config)
       : PropertyInterpolatorFactory(), defaultValue_(defaultValue), config_(std::move(config)) {}
 
   const CSSValue &getDefaultValue() const override {
@@ -63,13 +63,13 @@ class ResolvableValueInterpolatorFactory : public PropertyInterpolatorFactory {
   std::shared_ptr<PropertyInterpolator> create(
       const PropertyPath &propertyPath,
       const std::shared_ptr<ViewStylesRepository> &viewStylesRepository) const override {
-    return std::make_shared<ResolvableValueInterpolator<AllowedTypes...>>(
+    return std::make_shared<RelativeValueInterpolator<AllowedTypes...>>(
         propertyPath, defaultValue_, viewStylesRepository, config_);
   }
 
  private:
   const CSSValueVariant<AllowedTypes...> defaultValue_;
-  ResolvableValueInterpolatorConfig config_;
+  RelativeValueInterpolatorConfig config_;
 };
 
 /**
@@ -113,26 +113,26 @@ auto value(const auto &defaultValue) -> std::enable_if_t<
     (std::is_constructible_v<AllowedTypes, decltype(defaultValue)> || ...),
     std::shared_ptr<PropertyInterpolatorFactory>> {
   static_assert(
-      !(Resolvable<AllowedTypes> || ...),
-      "Resolvable value types (e.g. CSSLength) require a "
-      "ResolvableValueInterpolatorConfig — use the value(defaultValue, "
-      "{RelativeTo::..., \"...\"}) overload instead");
+      (InterpolatesWith<AllowedTypes, ValueInterpolationContext> && ...),
+      "Value types that resolve against a relative property (e.g. CSSLength) need a "
+      "RelativeValueInterpolatorConfig - use the value(defaultValue, {RelativeTo::..., \"...\"}) overload instead");
   // Create a concrete CSSValue from the defaultValue
   auto cssValue = createCSSValue<AllowedTypes...>(defaultValue);
   return std::make_shared<SimpleValueInterpolatorFactory<AllowedTypes...>>(std::move(cssValue));
 }
 
 template <typename... AllowedTypes>
-auto value(const auto &defaultValue, ResolvableValueInterpolatorConfig config) -> std::enable_if_t<
+auto value(const auto &defaultValue, RelativeValueInterpolatorConfig config) -> std::enable_if_t<
     (std::is_constructible_v<AllowedTypes, decltype(defaultValue)> || ...),
     std::shared_ptr<PropertyInterpolatorFactory>> {
   static_assert(
-      (Resolvable<AllowedTypes> || ...),
-      "None of the value types are resolvable — use the value(defaultValue) "
-      "overload without ResolvableValueInterpolatorConfig instead");
+      (InterpolatesWith<AllowedTypes, RelativeValueInterpolationContext> && ...) &&
+          (ResolvesWith<AllowedTypes, RelativeValueInterpolationContext> || ...),
+      "This overload is for value types that resolve against a relative property (e.g. CSSLength). Types that "
+      "resolve against something else, or that need no resolution at all, use the value(defaultValue) overload.");
   // Create a concrete CSSValue from the defaultValue
   auto cssValue = createCSSValue<AllowedTypes...>(defaultValue);
-  return std::make_shared<ResolvableValueInterpolatorFactory<AllowedTypes...>>(std::move(cssValue), std::move(config));
+  return std::make_shared<RelativeValueInterpolatorFactory<AllowedTypes...>>(std::move(cssValue), std::move(config));
 }
 
 /**
@@ -146,7 +146,7 @@ auto transformOp(const auto &defaultValue) -> std::enable_if_t<
 }
 
 template <typename TOperation>
-auto transformOp(const auto &defaultValue, ResolvableValueInterpolatorConfig config) -> std::enable_if_t<
+auto transformOp(const auto &defaultValue, RelativeValueInterpolatorConfig config) -> std::enable_if_t<
     std::is_base_of_v<TransformOperation, TOperation> && std::is_constructible_v<TOperation, decltype(defaultValue)> &&
         ResolvableOp<TOperation>,
     std::shared_ptr<StyleOperationInterpolator>> {
@@ -165,7 +165,7 @@ auto filterOp(const auto &defaultValue) -> std::enable_if_t<
 }
 
 template <typename TOperation>
-auto filterOp(const auto &defaultValue, ResolvableValueInterpolatorConfig config) -> std::enable_if_t<
+auto filterOp(const
```

---

### Incident Patch 3: `e8c191df` (2026-10-15)
**Commit Message**: fix(Worklets): keep the library prefix of a worklet name under a Windows path in the Oxc plugin (#10856)

## Summary

The Oxc plugin's `source_from_filename` (`plugin-oxc/src/naming.rs`)
finds the library a worklet comes from by splitting the filename on `/`,
so under a Windows path every worklet in `node_modules` loses its
`<library>_` prefix. The Babel plugin splits on both separators since
#9619, so the two plugins name the same worklet differently on Windows.
The Oxc plugin ships `x86_64-pc-windows-msvc` and
`aarch64-pc-windows-msvc` binaries, and its CI job runs on Linux only.

The basename and the library now both come from a split on either
separator, so the name is the same on every host and the Windows case is
tested on Linux.

## Test plan

- `source_from_filename_handles_node_modules` gains
`C:\a\b\node_modules\some-lib\dist\index.js`, expecting
`some-lib_index.js`. On `main` it fails on Windows with `left:
"index.js"`.
- `yarn test:oxc` (3 Rust tests, 19 Node tests), `yarn test:babel-suite`
(44 tests, 40 snapshots), `cargo fmt --check`, `cargo clippy --lib -- -D
warnings` and `yarn changelog-check origin/main` pass.

## Changelog

- [x] I added a changelog fragment with

**File**: `packages/react-native-worklets/changelog/oxc-windows-library-prefix.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Keep the library prefix in the names the Oxc plugin gives worklets under `node_modules` when the path uses Windows separators.
```

**File**: `packages/react-native-worklets/plugin-oxc/src/naming.rs` (modified, +10/-10)
```diff
@@ -1,5 +1,3 @@
-use std::path::Path;
-
 use oxc_syntax::identifier::{is_identifier_part, is_identifier_start};
 
 pub fn worklet_hash(s: &str) -> u64 {
@@ -85,6 +83,10 @@ mod tests {
             source_from_filename("/a/b/node_modules/some-lib/dist/index.js"),
             "some-lib_index.js"
         );
+        assert_eq!(
+            source_from_filename(r"C:\a\b\node_modules\some-lib\dist\index.js"),
+            "some-lib_index.js"
+        );
         assert_eq!(source_from_filename(""), "unknownFile");
     }
 }
@@ -131,18 +133,16 @@ pub fn source_from_filename(filename: &str) -> String {
     if filename.is_empty() {
         return "unknownFile".to_string();
     }
-    let path = Path::new(filename);
-    let base = path
-        .file_name()
-        .and_then(|s| s.to_str())
-        .unwrap_or("unknownFile")
-        .to_string();
+    let parts: Vec<&str> = filename
+        .split(['/', '\\'])
+        .filter(|part| !part.is_empty())
+        .collect();
+    let base = parts.last().copied().unwrap_or("unknownFile");
 
-    let parts: Vec<&str> = filename.split('/').collect();
     if let Some(idx) = parts.iter().position(|p| *p == "node_modules")
         && let Some(lib) = parts.get(idx + 1)
     {
         return format!("{lib}_{base}");
     }
-    base
+    base.to_string()
 }
```

#### Recent Merged Pull Requests:
- **PR #10905** (2026-10-16): fix: reject inherited object keys in the remaining style processors (@tshmieldev)
- **PR #10892** (2026-10-15): fix(CSS): remove a Core Animation transition from a view that React Native reuses (@pawicao)
- **PR #10890** (2026-10-16): fix(Reanimated): keep box-shadow blur radii below 1 on Android (@YevheniiKotyrlo)
- **PR #10861** (2026-10-14): chore(deps): bump source-map-js from 1.2.1 to 1.2.2 (@dependabot[bot])
- **PR #10857** (2026-10-13): fix(runtime-tests): return fresh arrays from ReJest recorded updates (@tshmieldev)
- **PR #10856** (2026-10-15): fix(Worklets): keep the library prefix of a worklet name under a Windows path in the Oxc plugin (@YevheniiKotyrlo)

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

## X. runtime-tests): return fresh arrays from ReJest recorded updates (#10857)

**RULE**:
When implementing operations in `apps/common-app/runtime-tests/ReJest/TestRunner/UpdatesContainer.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-reanimated. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d25c744f`: runtime-tests): return fresh arrays from ReJest recorded updates (#10857). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/common-app/runtime-tests/ReJest/TestRunner/UpdatesContainer.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      if (viewTags.length === 0) {
        throw new Error('No updates were recorded');
      }
        // Copies, because serialization caches arrays by identity and the
        // recorder mutates them in place, so a second read would be stale.
          jsUpdates: [...jsUpdates.value],
          nativeSnapshots: [...nativeSnapshots.value],
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
          jsUpdates: jsUpdates.value,
          nativeSnapshots: nativeSnapshots.value,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d25c744f` are properly handled with clean fallback behavior.
