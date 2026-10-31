> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-reanimated-learnings.md`  
> **Source**: github ([https://github.com/software-mansion/react-native-reanimated](https://github.com/software-mansion/react-native-reanimated))  
> **Source Version**: `c8b40ef3`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T03:59:01.180Z  
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
> **Harvest Timestamp**: 2026-10-31T03:59:00.743Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-reanimated`
- **Description**: React Native's Animated library reimplemented
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11039 stars

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

### Incident Patch 1: `1ae46345` (2026-10-29)
**Commit Message**: fix(Reanimated): don't crash on Android when worklets run during the teardown of the React host (#10858)

> [!NOTE]
> This pull request was authored by AI on behalf of @tomekzaw.

## Summary

Fixes an Android crash that happens when the React host is torn down (a
reload, for example an `expo-updates` restart) while worklets still run
on the UI thread:

```
JNI DETECTED ERROR IN APPLICATION: obj == null
  _JNIEnv::CallLongMethod(_jobject*, _jmethodID*, ...)
  reanimated::NativeProxy::getAnimationTimestamp()
  ...
  worklets::UIScheduler::triggerUI()
  com.swmansion.worklets.AndroidUIScheduler.mUIThreadRunnable
```

### The bug

- `NativeProxy::invalidateCpp()` reset `javaPart_`, but the functions
returned by `bindThis` captured a raw `this` and called JNI on
`javaPart_` without checking it. Some of them are globals of the UI
runtime (`_getAnimationTimestamp`, `_setGestureState`). Worklets owns
that runtime, so they outlive the invalidation.
- React Native invalidates TurboModules on a background thread, in the
order in which they were first requested. When `ReanimatedModule` goes
before `WorkletsModule`, the UI scheduler of Worklets is still active,
and the first worklet that starts

**File**: `packages/react-native-reanimated/android/src/main/cpp/reanimated/android/NativeProxy.cpp` (modified, +8/-6)
```diff
@@ -30,6 +30,12 @@ NativeProxy::NativeProxy(
     const std::shared_ptr<WorkletRuntime> &uiRuntime,
     const std::shared_ptr<UIScheduler> &uiScheduler)
     : javaPart_(jni::make_global(jThis)),
+      strongThis_(
+          this,
+          [](NativeProxy *self) {
+            // The Java part can destroy `self` as soon as it is released, so move it out first.
+            const auto javaPart = std::move(self->javaPart_);
+          }),
       rnRuntime_(rnRuntime),
       uiRuntime_(uiRuntime),
       reanimatedModuleProxy_(std::make_shared<ReanimatedModuleProxy>(
@@ -180,11 +186,6 @@ void NativeProxy::registerEventHandler() {
 }
 
 void NativeProxy::maybeFlushUIUpdatesQueue() {
-  // Module might be already destroyed.
-  if (!javaPart_) {
-    return;
-  }
-
   static const auto method = getJniMethod<void()>("maybeFlushUIUpdatesQueue");
   method(javaPart_.get());
 }
@@ -455,7 +456,8 @@ void NativeProxy::invalidateCpp() {
   // the pointer and it will be too late after it
   reanimatedModuleProxy_->cleanupSensors();
   reanimatedModuleProxy_.reset();
-  javaPart_ = nullptr;
+  // Releases `javaPart_`, but only after the calls in flight on other threads return.
+  strongThis_.reset();
 }
 
 } // namespace reanimated
```

**File**: `packages/react-native-reanimated/android/src/main/cpp/reanimated/android/NativeProxy.h` (modified, +23/-7)
```diff
@@ -3,6 +3,7 @@
 #include <ReactCommon/CallInvokerHolder.h>
 #include <fbjni/fbjni.h>
 #include <jsi/jsi.h>
+#include <react/debug/react_native_assert.h>
 #include <react/fabric/JFabricUIManager.h>
 #include <react/jni/WritableNativeMap.h>
 #include <react/renderer/scheduler/Scheduler.h>
@@ -20,7 +21,7 @@ namespace reanimated {
 using namespace facebook;
 using namespace facebook::jni;
 
-class NativeProxy : public jni::HybridClass<NativeProxy>, std::enable_shared_from_this<NativeProxy> {
+class NativeProxy : public jni::HybridClass<NativeProxy>, public std::enable_shared_from_this<NativeProxy> {
  public:
   static auto constexpr kJavaDescriptor = "Lcom/swmansion/reanimated/NativeProxy;";
   static jni::local_ref<jhybriddata> initHybrid(
@@ -36,6 +37,13 @@ class NativeProxy : public jni::HybridClass<NativeProxy>, std::enable_shared_fro
  private:
   friend HybridBase;
   jni::global_ref<NativeProxy::javaobject> javaPart_;
+  /// The reference behind `weak_from_this()`. It does not own this object, the Java part does.
+  /// It guards `javaPart_` instead: `invalidateCpp()` drops it, and `javaPart_` is released once
+  /// the functions returned by `bindThis` that are running at that moment return. The UI runtime
+  /// keeps those functions, so they can be called during and after `invalidateCpp()`.
+  /// Declared after `javaPart_`, which its deleter releases, and before `reanimatedModuleProxy_`,
+  /// whose initializer calls `bindThis`.
+  std::shared_ptr<NativeProxy> strongThis_;
   jsi::Runtime *rnRuntime_;
   std::shared_ptr<worklets::WorkletRuntime> uiRuntime_;
   std::shared_ptr<ReanimatedModuleProxy> reanimatedModuleProxy_;
@@ -94,18 +102,26 @@ class NativeProxy : public jni::HybridClass<NativeProxy>, std::enable_shared_fro
   std::shared_ptr<css::CSSPlatformTransitionBackend> makePlatformTransitionBackend();
 
   /***
-   * Wraps a method of `NativeProxy` in a function object capturing `this`
+   * Wraps a method of `NativeProxy` in a function object holding a weak
+   * reference to `this`
    * @tparam TReturn return type of passed method
    * @tparam TParams parameter types of passed method
    * @param methodPtr pointer to method to be wrapped
-   * @return a function object with the same signature as the method, calling
-   * that method on `this`
+   * @return a function object with the same signature as the method. It calls
+   * that method on `this` while `javaPart_` is held, and returns a default
+   * value after `javaPart_` is released
    */
   template <class TReturn, class... TParams>
   std::function<TReturn(TParams...)> bindThis(TReturn (NativeProxy::*methodPtr)(TParams...)) {
-    // It's probably safe to pass `this` as reference here...
-    return [this, methodPtr](TParams &&...args) {
-      return (this->*methodPtr)(std::forward<TParams>(args)...);
+    auto weakThis = weak_from_this();
+    // Otherwise the function would never call the method.
+    react_native_assert(!weakThis.expired() && "`bindThis` called before `strongThis_` is initialized");
+    return [weakThis = std::move(weakThis), methodPtr](TParams &&...args) -> TReturn {
+      const auto strongThis = weakThis.lock();
+      if (!strongThis) {
+        return TReturn();
+      }
+      return (strongThis.get()->*methodPtr)(std::forward<TParams>(args)...);
     };
   }
 
```

**File**: `packages/react-native-reanimated/changelog/android-native-proxy-call-after-invalidate.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix an Android crash (`JNI DETECTED ERROR IN APPLICATION: obj == null` in `NativeProxy::getAnimationTimestamp`) when a worklet still runs on the UI thread while the React host is torn down, for example on an `expo-updates` restart.
```

---

### Incident Patch 2: `4670996b` (2026-10-28)
**Commit Message**: fix(Reanimated): don't throw when animating a component whose ref is an imperative handle (#11023)

> [!NOTE]
> This pull request was authored by AI on behalf of @bartlomiejbloniarz.

## Summary

When Reanimated can't read the native view straight from an animated
component's ref, it falls back to React's `findHostInstance_DEPRECATED`.
Since #9589 that fallback receives the component's own ref. React
resolves only class component instances there and throws for anything
else. So wrapping a component whose ref is a `useImperativeHandle`
handle, such as react-native-video's `<Video>`, in
`Animated.createAnimatedComponent` threw "Argument appears to not be a
ReactComponent" on mount.

Now Reanimated passes the component's ref only when it is a class
component instance. Otherwise it resolves the view through the animated
component itself, the same path it already takes when a component has no
ref. Refs forwarded to a class component keep the behavior from #9589.

**iOS**

<table>
<tr><th>Before</th><th>After</th></tr>
<tr>
<td>


https://github.com/user-attachments/assets/a9ec42c9-01f6-49db-9e34-df5ec06b787f

</td>
<td>


https://github.com/user-attachments/assets/02ff36b6-c8bb-437c-9ef

**File**: `apps/common-app/runtime-tests/reanimated/tests/props/hostReplacement.test.tsx` (modified, +25/-0)
```diff
@@ -129,12 +129,27 @@ function FreshHandleHost({
   );
 }
 
+// Exposes methods instead of a view, so the animated component has to find
+// the view itself.
+function ImperativeHandleHost({
+  ref,
+  hostKey: _hostKey,
+  innerRef,
+  ...viewProps
+}: HostProps & { ref?: React.Ref<{ ping: () => void }> }) {
+  useImperativeHandle(ref, () => ({ ping: () => undefined }));
+
+  return <View ref={innerRef} {...viewProps} />;
+}
+
 const AnimatedAnimatableRefHost =
   Animated.createAnimatedComponent(AnimatableRefHost);
 const AnimatedForwardedRefHost =
   Animated.createAnimatedComponent(ForwardedRefHost);
 const AnimatedFreshHandleHost =
   Animated.createAnimatedComponent(FreshHandleHost);
+const AnimatedImperativeHandleHost =
+  Animated.createAnimatedComponent(ImperativeHandleHost);
 
 type HostComponent = React.ComponentType<AnimatedProps<HostProps>>;
 
@@ -273,4 +288,14 @@ describe('Host replacement', () => {
       await expectTransitionOnCurrentHost(AnimatedFreshHandleHost);
     });
   });
+
+  describe('the ref is an imperative handle', () => {
+    test('binds to the view the component renders', async () => {
+      await render(<Example Host={AnimatedImperativeHandleHost} />);
+      await waitForFrames();
+
+      await expectBindingsOnCurrentHost();
+      await expectTransitionOnCurrentHost(AnimatedImperativeHandleHost);
+    });
+  });
 });
```

**File**: `packages/react-native-reanimated/__tests__/findHostInstance.test.ts` (modified, +41/-5)
```diff
@@ -1,4 +1,6 @@
 /* eslint-disable eslint-core/camelcase */
+import { Component } from 'react';
+
 import type { IAnimatedComponentInternalBase } from '../src/createAnimatedComponent/commonTypes';
 import { findHostInstance } from '../src/platform-specific/findHostInstance';
 
@@ -9,13 +11,20 @@ jest.mock('react-native/Libraries/Renderer/shims/ReactFabric', () => ({
 const ReactFabric: { findHostInstance_DEPRECATED: jest.Mock } =
   jest.requireMock('react-native/Libraries/Renderer/shims/ReactFabric');
 
+class ClassComponent extends Component {}
+
+class ScrollableClassComponent extends Component {
+  getNativeScrollRef = () => null;
+  getScrollableNode = () => 42;
+}
+
 describe('findHostInstance', () => {
   beforeEach(() => {
     ReactFabric.findHostInstance_DEPRECATED.mockReset();
   });
 
   test('uses the resolved component ref when the fast path cannot handle it', () => {
-    const componentRef = { __nativeTag: 42 };
+    const componentRef = new ClassComponent({});
     const hostInstance = { host: true };
     const animatedComponent = {
       _componentRef: componentRef,
@@ -77,10 +86,7 @@ describe('findHostInstance', () => {
 
   test('falls back when getScrollableNode returns a view tag', () => {
     const hostInstance = { host: true };
-    const componentRef = {
-      getNativeScrollRef: () => null,
-      getScrollableNode: () => 42,
-    };
+    const componentRef = new ScrollableClassComponent({});
     const animatedComponent = {
       _componentRef: componentRef,
       _hasAnimatedRef: false,
@@ -93,4 +99,34 @@ describe('findHostInstance', () => {
       componentRef
     );
   });
+
+  test('falls back to the animated component for an imperative handle', () => {
+    const hostInstance = { host: true };
+    const animatedComponent = {
+      _componentRef: { seek: jest.fn(), pause: jest.fn() },
+      _hasAnimatedRef: false,
+    } as unknown as IAnimatedComponentInternalBase;
+
+    ReactFabric.findHostInstance_DEPRECATED.mockReturnValue(hostInstance);
+
+    expect(findHostInstance(animatedComponent)).toBe(hostInstance);
+    expect(ReactFabric.findHostInstance_DEPRECATED).toHaveBeenCalledWith(
+      animatedComponent
+    );
+  });
+
+  test('falls back to the animated component without a component ref', () => {
+    const hostInstance = { host: true };
+    const animatedComponent = {
+      _componentRef: null,
+      _hasAnimatedRef: false,
+    } as unknown as IAnimatedComponentInternalBase;
+
+    ReactFabric.findHostInstance_DEPRECATED.mockReturnValue(hostInstance);
+
+    expect(findHostInstance(animatedComponent)).toBe(hostInstance);
+    expect(ReactFabric.findHostInstance_DEPRECATED).toHaveBeenCalledWith(
+      animatedComponent
+    );
+  });
 });
```

**File**: `packages/react-native-reanimated/changelog/imperative-handle-host-lookup.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix `createAnimatedComponent` throwing on mount for components whose ref is a `useImperativeHandle` handle.
```

**File**: `packages/react-native-reanimated/src/platform-specific/findHostInstance.native.ts` (modified, +10/-4)
```diff
@@ -1,6 +1,8 @@
 /* eslint-disable eslint-core/camelcase */
 'use strict';
 
+import { Component } from 'react';
+
 import type { InternalHostInstance } from '../commonTypes';
 import type { IAnimatedComponentInternalBase } from '../createAnimatedComponent/commonTypes';
 import type { HostInstance } from './types';
@@ -92,9 +94,13 @@ export function findHostInstance(
   resolveFindHostInstance_DEPRECATED();
   /*
     The Fabric implementation of `findHostInstance_DEPRECATED` requires a React ref as an argument
-    rather than a native ref. Prefer the resolved component ref when available so components can
-    forward their ref to the host view that should be animated. Components that expose an animatable
-    ref via `getAnimatableRef` already have it resolved into `_componentRef`.
+    rather than a native ref, and it throws for anything that is not a class component instance,
+    such as a `useImperativeHandle` handle. Prefer the resolved component ref when it is a class
+    component so components can forward their ref to the host view that should be animated, and
+    use the animated component otherwise. Components that expose an animatable ref via
+    `getAnimatableRef` already have it resolved into `_componentRef`.
   */
-  return findHostInstance_DEPRECATED(componentRef ?? ref);
+  return findHostInstance_DEPRECATED(
+    componentRef instanceof Component ? componentRef : ref
+  );
 }
```

---

### Incident Patch 3: `cc8e5c5e` (2026-10-30)
**Commit Message**: fix(Reanimated): run an animated ref's observers again only when its view changes (#10909)

## Summary

`useScrollOffset` unregisters its scroll handler and registers it again
on every render of a component that passes the animated ref through an
inline callback ref, such as `ref={(instance) => {
animatedRef(instance); localRef.current = instance; }}`.

React calls a callback ref again whenever the ref passed to an element
changes, and `ScrollView` from `react-native` forwards each new `ref`
prop as a new ref on its native view, so the animated ref is called with
the same scroll view on every render. `useAnimatedRefBase` runs every
observer's cleanup and then the observer again on each of these calls,
and the observer `useScrollOffset` registers unregisters its handler and
registers it again.

Each observer now keeps the tag it last ran with, and the animated ref
runs it again only when the view's tag changes. Moving the ref to
another view still runs the cleanup and the observer for the new tag.

## Test plan

- `__tests__/hooks.useScrollOffset.test.tsx` re-renders a scroll view
whose animated ref goes through an inline callback ref and expects the
scroll handler to register once;

**File**: `packages/react-native-reanimated/__tests__/hooks.useScrollOffset.test.tsx` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+import { render } from '@testing-library/react-native';
+import { ScrollView } from 'react-native';
+
+import { useAnimatedRef, useScrollOffset } from '../src';
+import { WorkletEventHandler } from '../src/WorkletEventHandler';
+
+jest.mock('../src/platformFunctions/findNodeHandle', () => {
+  const tags = new WeakMap<object, number>();
+  let nextTag = 1000;
+  return {
+    findNodeHandle: jest.fn((componentOrHandle: unknown) => {
+      if (typeof componentOrHandle !== 'object' || componentOrHandle === null) {
+        return componentOrHandle ?? null;
+      }
+      if (!tags.has(componentOrHandle)) {
+        tags.set(componentOrHandle, nextTag++);
+      }
+      return tags.get(componentOrHandle);
+    }),
+  };
+});
+
+describe('useScrollOffset', () => {
+  let registerForEvents: jest.SpyInstance;
+  let unregisterFromEvents: jest.SpyInstance;
+
+  beforeEach(() => {
+    registerForEvents = jest.spyOn(
+      WorkletEventHandler.prototype,
+      'registerForEvents'
+    );
+    unregisterFromEvents = jest.spyOn(
+      WorkletEventHandler.prototype,
+      'unregisterFromEvents'
+    );
+  });
+
+  afterEach(() => {
+    jest.restoreAllMocks();
+  });
+
+  test('keeps the scroll handler registered while an inline ref re-attaches the same scroll view', () => {
+    function TrackedScrollView() {
+      const animatedRef = useAnimatedRef<ScrollView>();
+      useScrollOffset(animatedRef);
+      return (
+        <ScrollView
+          ref={(instance) => {
+            animatedRef(instance);
+          }}
+        />
+      );
+    }
+
+    const { rerender } = render(<TrackedScrollView />);
+    rerender(<TrackedScrollView />);
+    rerender(<TrackedScrollView />);
+
+    expect(registerForEvents).toHaveBeenCalledTimes(1);
+    expect(unregisterFromEvents).not.toHaveBeenCalled();
+  });
+
+  test('moves the scroll handler to the scroll view the ref attaches to next', () => {
+    function TrackedScrollView({ scrollViewKey }: { scrollViewKey: string }) {
+      const animatedRef = useAnimatedRef<ScrollView>();
+      useScrollOffset(animatedRef);
+      return (
+        <ScrollView
+          key={scrollViewKey}
+          ref={(instance) => {
+            animatedRef(instance);
+          }}
+        />
+      );
+    }
+
+    const { rerender } = render(<TrackedScrollView scrollViewKey="first" />);
+    rerender(<TrackedScrollView scrollViewKey="second" />);
+    rerender(<TrackedScrollView scrollViewKey="second" />);
+
+    const [[firstTag], [secondTag]] = registerForEvents.mock.calls;
+    expect(registerForEvents).toHaveBeenCalledTimes(2);
+    expect(secondTag).not.toBe(firstTag);
+    expect(unregisterFromEvents.mock.calls).toEqual([[firstTag]]);
+  });
+});
```

**File**: `packages/react-native-reanimated/changelog/animated-ref-observers-same-view.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fix `useScrollOffset` unregistering and re-registering its scroll handler each time React re-attaches its animated ref to the same view, which an inline callback ref does on every render.
```

**File**: `packages/react-native-reanimated/src/hook/useAnimatedRefCommon.ts` (modified, +18/-6)
```diff
@@ -13,10 +13,15 @@ import type {
   MaybeObserverCleanup,
 } from './commonTypes';
 
+type ObserverRun = {
+  readonly tag: number | null;
+  readonly cleanup: MaybeObserverCleanup;
+};
+
 export function useAnimatedRefBase<TRef extends InstanceOrElement>(
   getWrapper: (ref: InternalHostInstance) => ShadowNodeWrapper
 ): AnimatedRef<TRef> {
-  const observers = useRef<Map<AnimatedRefObserver, MaybeObserverCleanup>>(
+  const observers = useRef<Map<AnimatedRefObserver, ObserverRun>>(
     new Map()
   ).current;
   const wrapperRef = useRef<ShadowNodeWrapper | null>(null);
@@ -34,13 +39,20 @@ export function useAnimatedRefBase<TRef extends InstanceOrElement>(
 
         if (observers.size) {
           const currentTag = fun?.getTag?.() ?? null;
-          observers.forEach((cleanup, observer) => {
+          observers.forEach(({ tag, cleanup }, observer) => {
+            // React calls the ref again for the same view whenever the ref passed to it changes.
+            if (tag === currentTag) {
+              return;
+            }
             // Perform the cleanup before calling the observer again.
             // This ensures that all events that were set up in the observer
             // are cleaned up before the observer sets up new events during
             // the next call.
             cleanup?.();
-            observers.set(observer, observer(currentTag));
+            observers.set(observer, {
+              tag: currentTag,
+              cleanup: observer(currentTag),
+            });
           });
         }
       }
@@ -50,11 +62,11 @@ export function useAnimatedRefBase<TRef extends InstanceOrElement>(
 
     fun.observe = (observer: AnimatedRefObserver) => {
       // Call observer immediately to get the initial value
-      const cleanup = observer(fun?.getTag?.() ?? null);
-      observers.set(observer, cleanup);
+      const tag = fun?.getTag?.() ?? null;
+      observers.set(observer, { tag, cleanup: observer(tag) });
 
       return () => {
-        observers.get(observer)?.();
+        observers.get(observer)?.cleanup?.();
         observers.delete(observer);
       };
     };
```

#### Recent Merged Pull Requests:
- **PR #11099** (2026-10-30): fix(Reanimated): resolve web-only modules for __tests__ in the Jest resolver (@tomekzaw)
- **PR #11098** (2026-10-30): docs(Reanimated): keep the Slider example's handle in place until the pointer returns (@bartlomiejbloniarz)
- **PR #11080** (2026-10-30): chore(Reanimated): drop leftover cpplint NOLINT markers (@tshmieldev)
- **PR #11071** (closed): refactor(Worklets): merge SerializableRemoteFunction constructors (@tjzel)
- **PR #11067** (2026-10-29): test(Reanimated): stop recording before reading color frames in nonLayoutPropAndRender (@pawicao)
- **PR #11066** (2026-10-29): docs(Worklets): fix the shadowed variable in the isWorkletFunction example (@tjzel)

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

## X. Reanimated): don't crash on Android when worklets run during the teardown of the

**RULE**:
When implementing operations in `packages/react-native-reanimated/android/src/main/cpp/reanimated/android/NativeProxy.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-reanimated. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1ae46345`: Reanimated): don't crash on Android when worklets run during the teardown of the React host (#10858). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native-reanimated/android/src/main/cpp/reanimated/android/NativeProxy.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      strongThis_(
          this,
          [](NativeProxy *self) {
            // The Java part can destroy `self` as soon as it is released, so move it out first.
            const auto javaPart = std::move(self->javaPart_);
          }),
  // Releases `javaPart_`, but only after the calls in flight on other threads return.
  strongThis_.reset();
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  // Module might be already destroyed.
  if (!javaPart_) {
    return;
  }

  javaPart_ = nullptr;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1ae46345` are properly handled with clean fallback behavior.
