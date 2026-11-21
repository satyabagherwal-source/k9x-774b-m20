# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: software-mansion-react-native-reanimated-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "software-mansion-react-native-reanimated-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T20:25:10.590Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-software-mansion-react-native-reanimated-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [software-mansion-react-native-reanimated-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T20:25:10.590Z`  
> **Learning ID**: `LEARN-EVO-software-mansion-react-native-reanimated-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), F (Design Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 69%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from software-mansion-react-native-reanimated-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/software-mansion-react-native-reanimated-learnings.md`  
> **Source**: github ([https://github.com/software-mansion/react-native-reanimated](https://github.com/software-mansion/react-native-reanimated))  
> **Source Version**: `2d283998`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T20:24:56.801Z  
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
> **Harvest Timestamp**: 2026-11-21T20:24:56.794Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `software-mansion/react-native-reanimated`
- **Description**: React Native's Animated library reimplemented
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 11089 stars

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

### Incident Patch 1: `816d62ba` (2026-11-20)
**Commit Message**: fix(Worklets): preserve UI scheduler order (#11439)

> [!NOTE]
> This pull request was authored by AI on behalf of @tjzel.

## Human track

### Why

Fixes #11429.

`IOSUIScheduler::scheduleOnUI` and its Android counterpart run a job
inline when called from the UI thread. This lets the new job overtake
older jobs already queued from another thread. A synchronous React event
can therefore unregister a frame callback before its earlier
registration reaches the UI runtime. The same ordering problem can
affect mapper and shared-value setup.

### How

Every UI job now enters the shared FIFO queue before the platform
scheduler decides how to trigger it:

```text
background caller ─┐
                   ├─> FIFO queue ─> guarded drain on UI thread
UI-thread caller ──┘
```

A drain guard prevents a job that schedules another UI job from
recursively draining the queue. Explicit exception handling resets the
state and rethrows if a queued job fails.

Follow-up PR #11457 adds a separate Reanimated defense against unknown
frame callback IDs.

### Testing

Added a Bundle Mode runtime regression that holds an active UI job while
a worker queues older work, then verifies that the older work runs
fi

**File**: `apps/common-app/runtime-tests/worklets/tests/runtimes/scheduleOnUI.test.tsx` (modified, +48/-1)
```diff
@@ -1,11 +1,13 @@
 import {
-  scheduleOnRuntime,
+  createSynchronizable,
   scheduleOnRN,
+  scheduleOnRuntime,
   scheduleOnUI,
 } from 'react-native-worklets';
 
 import {
   beforeEach,
+  createOrderConstraint,
   describe,
   expect,
   getWorkletRuntimesFromPool,
@@ -48,6 +50,51 @@ describe('scheduleOnUI', () => {
   });
 
   if (globalThis._WORKLETS_BUNDLE_MODE_ENABLED) {
+    test('preserves queued UI work before a UI caller', async () => {
+      const [confirmedOrder, order] = createOrderConstraint();
+      const uiActive = createSynchronizable(false);
+      const queued = createSynchronizable(false);
+      const [first, second] = ['first', 'second'];
+
+      scheduleOnRuntime(workletRuntime, () => {
+        'worklet';
+        const deadline = performance.now() + 1000;
+        while (!uiActive.getBlocking() && performance.now() < deadline) {
+          uiActive.getBlocking();
+        }
+        if (!uiActive.getBlocking()) {
+          throw new Error('UI job did not start.');
+        }
+        scheduleOnUI(() => {
+          'worklet';
+          order(1, first);
+        });
+        queueMicrotask(() => {
+          queued.setBlocking(true);
+        });
+      });
+
+      scheduleOnUI(() => {
+        'worklet';
+        uiActive.setBlocking(true);
+        const deadline = performance.now() + 1000;
+        while (!queued.getBlocking() && performance.now() < deadline) {
+          queued.getBlocking();
+        }
+        if (!queued.getBlocking()) {
+          throw new Error('Worker did not enqueue the UI job.');
+        }
+        scheduleOnUI(() => {
+          'worklet';
+          order(2, second);
+        });
+      });
+
+      await waitForNotification(first);
+      await waitForNotification(second);
+      expect(confirmedOrder.value).toBe(2);
+    });
+
     test('schedules on UI Runtime to UI Runtime', async () => {
       scheduleOnUI(() => {
         'worklet';
```

**File**: `packages/react-native-worklets/Common/cpp/worklets/Tools/UIScheduler.cpp` (modified, +14/-4)
```diff
@@ -12,11 +12,21 @@ void UIScheduler::scheduleOnUI(std::function<void()> job) {
 }
 
 void UIScheduler::triggerUI() {
-  scheduledOnUI_ = false;
-  while (!uiJobs_.empty()) {
-    const auto job = uiJobs_.pop();
-    job();
+  if (drainingUI_) {
+    return;
   }
+  drainingUI_ = true;
+  try {
+    scheduledOnUI_ = false;
+    while (!uiJobs_.empty()) {
+      const auto job = uiJobs_.pop();
+      job();
+    }
+  } catch (...) {
+    drainingUI_ = false;
+    throw;
+  }
+  drainingUI_ = false;
 }
 
 bool UIScheduler::isOnUIThread() const {
```

**File**: `packages/react-native-worklets/Common/cpp/worklets/Tools/UIScheduler.h` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ class UIScheduler {
  protected:
   virtual bool queryIsOnUIThread() const = 0;
 
+  bool drainingUI_{false};
   std::atomic<bool> scheduledOnUI_{false};
   ThreadSafeQueue<std::function<void()>> uiJobs_;
 };
```

**File**: `packages/react-native-worklets/android/src/main/cpp/worklets/android/AndroidUIScheduler.cpp` (modified, +2/-2)
```diff
@@ -25,11 +25,11 @@ class UISchedulerWrapper : public UIScheduler {
   }
 
   void scheduleOnUI(std::function<void()> job) override {
+    UIScheduler::scheduleOnUI(std::move(job));
     if (isOnUIThread()) {
-      job();
+      triggerUI();
       return;
     }
-    UIScheduler::scheduleOnUI(job);
     if (!scheduledOnUI_) {
       scheduledOnUI_ = true;
       static const auto method = androidUiScheduler_->getClass()->getMethod<void()>("scheduleTriggerOnUI");
```

**File**: `packages/react-native-worklets/apple/worklets/apple/IOSUIScheduler.mm` (modified, +3/-3)
```diff
@@ -1,5 +1,6 @@
 #import <Foundation/Foundation.h>
 #import <dispatch/dispatch.h>
+#import <utility>
 
 #import <worklets/apple/IOSUIScheduler.h>
 
@@ -15,13 +16,12 @@
 
 void IOSUIScheduler::scheduleOnUI(std::function<void()> job)
 {
+  UIScheduler::scheduleOnUI(std::move(job));
   if (isOnUIThread()) {
-    job();
+    triggerUI();
     return;
   }
 
-  UIScheduler::scheduleOnUI(job);
-
   if (!scheduledOnUI_) {
     dispatch_async(dispatch_get_main_queue(), [weakThis = weak_from_this()] {
       // Before triggering the UI, we check if the weak pointer is still valid to avoid possible dangling pointer
```

**File**: `packages/react-native-worklets/changelog/preserve-ui-scheduler-order.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Preserve UI job order when scheduling work from the UI thread.
```

---

### Incident Patch 2: `861c4ac0` (2026-11-19)
**Commit Message**: fix(Worklets): run the microtasks of synchronous calls when the outermost call returns (#11410)

> [!NOTE]
> This pull request was authored by AI on behalf of @tjzel.

## Summary

Stacked on #11421 and #11377. Needed by #11372. Refs #10845.

## Human track

### Why

A synchronous call into a Worklet Runtime (`runOnUISync`,
`runOnRuntimeSync`, and the calls Reanimated makes for events, sensors
and layout animations) did not run a microtask checkpoint. Microtasks
queued in such a call waited for a later task. On the UI runtime that
task was the next frame of the frame loop, which always runs today.
#11372 makes the frame loop run on demand, so there may be no next
frame, and a promise reaction queued in an event handler or in
`runOnUISync` would then never run.

### How

```
before: sync call -> returns, microtasks stay queued -> a later task or frame drains them
after:  sync call -> requests a checkpoint -> the outermost call into the runtime drains when it returns
```

- The checkpoint is still a policy of each call. A call that requests it
marks the request on the runtime. The outermost call runs the checkpoint
when it returns, if a request was made by it or by a call nested in it

**File**: `apps/common-app/runtime-tests/worklets/suites.ts` (modified, +1/-0)
```diff
@@ -54,6 +54,7 @@ export const WORKLETS_TEST_SUITES: RuntimeTestSuite[] = [
       require('./tests/runtimes/runOnRuntimeSyncWithId.test');
       require('./tests/runtimes/scheduleOnRuntimeWithId.test');
       require('./tests/runtimes/microtaskDrains.test');
+      require('./tests/runtimes/reentrantModuleLoad.test');
       require('./tests/runtimes/microtaskErrors.test');
       require('./tests/runtimes/weakRef.test');
       require('./tests/runtimes/performanceNow.test');
```

**File**: `apps/common-app/runtime-tests/worklets/tests/runtimes/microtaskDrains.test.tsx` (modified, +149/-31)
```diff
@@ -1,6 +1,7 @@
 import type { Synchronizable } from 'react-native-worklets';
 import {
   createSynchronizable,
+  isBundleModeEnabled,
   runOnRuntimeAsync,
   runOnRuntimeAsyncWithId,
   runOnRuntimeSync,
@@ -25,23 +26,24 @@ import {
   waitForNotifications,
 } from '../../../ReJest/RuntimeTestsApi';
 
-const DONE_NOTIFICATION = 'DONE';
-
 type OrderSetter = ReturnType<typeof createOrderConstraint>[1];
 
-describe('microtask draining', () => {
-  const [workletRuntime] = getWorkletRuntimesFromPool(1);
+const MICROTASK_NOT_RUN = 0;
+const MICROTASK_RAN_IN_SAME_CALL = 1;
+const MICROTASK_RAN_IN_LATER_CALL = 2;
+const NESTED_CALL_RESULT = 42;
 
-  const notifyDone = () => {
-    notify(DONE_NOTIFICATION);
-  };
+type RootTaskIdGlobal = typeof globalThis & {
+  __getRootTaskId: () => number;
+};
 
-  const flushProbe = () => {
-    'worklet';
-    queueMicrotask(() => {
-      scheduleOnRN(notifyDone);
-    });
-  };
+function getRootTaskId() {
+  'worklet';
+  return (globalThis as RootTaskIdGlobal).__getRootTaskId();
+}
+
+describe('microtask draining', () => {
+  const [workletRuntime] = getWorkletRuntimesFromPool(1);
 
   const checkpointProbe = (order: OrderSetter) => {
     'worklet';
@@ -51,10 +53,15 @@ describe('microtask draining', () => {
     order(1, 'task');
   };
 
-  const pendingMicrotaskProbe = (flag: Synchronizable<boolean>) => {
+  const pendingMicrotaskProbe = (state: Synchronizable<number>) => {
     'worklet';
+    const rootTaskId = getRootTaskId();
     queueMicrotask(() => {
-      flag.setBlocking(true);
+      state.setBlocking(
+        getRootTaskId() === rootTaskId
+          ? MICROTASK_RAN_IN_SAME_CALL
+          : MICROTASK_RAN_IN_LATER_CALL
+      );
     });
   };
 
@@ -123,31 +130,26 @@ describe('microtask draining', () => {
     });
   });
 
-  const noCheckpointCases: {
+  const syncCases: {
     name: string;
-    runtimeId: number;
-    invoke: (flag: Synchronizable<boolean>) => void;
+    invoke: (state: Synchronizable<number>) => void;
   }[] = [
     {
       name: 'runOnUISync',
-      runtimeId: UIRuntimeId,
       invoke: (flag) => runOnUISync(pendingMicrotaskProbe, flag),
     },
     {
       name: 'runOnRuntimeSync',
-      runtimeId: workletRuntime.runtimeId,
       invoke: (flag) =>
         runOnRuntimeSync(workletRuntime, pendingMicrotaskProbe, flag),
     },
     {
       name: 'runOnRuntimeSyncWithId, UI Runtime',
-      runtimeId: UIRuntimeId,
       invoke: (flag) =>
         runOnRuntimeSyncWithId(UIRuntimeId, pendingMicrotaskProbe, flag),
     },
     {
       name: 'runOnRuntimeSyncWithId, Worker Runtime',
-      runtimeId: workletRuntime.runtimeId,
       invoke: (flag) =>
         runOnRuntimeSyncWithId(
           workletRuntime.runtimeId,
@@ -157,20 +159,136 @@ describe('microtask draining', () => {
     },
   ];
 
-  noCheckpointCases.forEach(({ name, runtimeId, invoke }) => {
+  syncCases.forEach(({ name, invoke }) => {
     describe(name, () => {
-      test('defers queued microtasks past the synchronous call', async () => {
-        const flag = createSynchronizable(false);
+      test('runs queued microtasks at the end of the synchronous call', () => {
+        const state = createSynchronizable(MICROTASK_NOT_RUN);
 
-        invoke(flag);
+        invoke(state);
 
-        expect(flag.getBlocking()).toBe(false);
+        expect(state.getBlocking()).toBe(MICROTASK_RAN_IN_SAME_CALL);
+      });
+    });
+  });
 
-        scheduleOnRuntimeWithId(runtimeId, flushProbe);
-        await waitForNotification(DONE_NOTIFICATION);
+  const NESTED_NOTIFICATION = 'NESTED_SYNC_CALL';
+  const NESTED_MICROTASK_NOTIFICATION = 'NESTED_SYNC_CALL_MICROTASK';
+  const nestedResults = new Map<number, boolean>();
 
-        expect(flag.getBlocking()).toBe(true);
-      });
+  const nestedCallsExecuted = new Map<number, boolean>();
+
+  const onNestedResult = (
+    token: number,
+    ranDuringTask: boolean,
+    nestedCallExecuted: boolean
+  ) => {
+    nestedResults.set(token, ranDuringTask);
+    nestedCallsExecuted.set(token, nestedCallExecuted);
+    notify(`${NESTED_NOTIFICATION}_${token}`);
+  };
+
+  const nestedMicrotaskRanInOuterTask = new Map<number, boolean>();
+
+  const onNestedMicrotask = (token: number, ranInOuterTask: boolean) => {
+    nestedMicrotaskRanInOuterTask.set(token, ranInOuterTask);
+    notify(`${NESTED_MICROTASK_NOTIFICATION}_${token}`);
+  };
+
+  const nestedSyncCallProbe = (runtimeId: number, token: number) => {
+    'worklet';
+    const rootTaskId = getRootTaskId();
+    let microtaskRan = false;
+    queueMicrotask(() => {
+      microtaskRan = true;
+      scheduleOnRN(onNestedMicrotask, token, getRootTaskId() === rootTaskId);
+    });
+    const nestedCallResult = runOnRuntimeSyncWithId(runtimeId, () => {
+      'worklet';
+      return NESTED_CALL_RESULT;
+    });
+    scheduleOnRN(
+      onNestedResult,
+      token,
+      microtaskRan,
+      nestedCallResult === NESTED_CALL_RESULT
+    );
+  };
+
+  const nestedSyncC
```

**File**: `apps/common-app/runtime-tests/worklets/tests/runtimes/microtaskErrors.test.tsx` (modified, +24/-0)
```diff
@@ -1,4 +1,5 @@
 import {
+  runOnUISync,
   scheduleOnRN,
   scheduleOnRuntime,
   scheduleOnUI,
@@ -15,6 +16,7 @@ import {
 
 const UI_ERROR = 'microtask error on the UI Runtime';
 const WORKER_ERROR = 'microtask error on a Worker Runtime';
+const SYNC_CALL_ERROR = 'microtask error in a synchronous call';
 const ALIVE_NOTIFICATION = 'RUNTIME_ALIVE_AFTER_MICROTASK_ERROR';
 
 describe('errors thrown by microtasks', () => {
@@ -47,6 +49,28 @@ describe('errors thrown by microtasks', () => {
     }
   );
 
+  debugTest(
+    'reports an error thrown at the checkpoint of a synchronous call into the UI Runtime',
+    async () => {
+      await expect(() => {
+        runOnUISync(() => {
+          'worklet';
+          queueMicrotask(() => {
+            throw new Error(SYNC_CALL_ERROR);
+          });
+        });
+      }).toThrow(SYNC_CALL_ERROR);
+
+      scheduleOnUI(() => {
+        'worklet';
+        queueMicrotask(() => {
+          scheduleOnRN(onAlive);
+        });
+      });
+      await waitForNotification(ALIVE_NOTIFICATION);
+    }
+  );
+
   debugTest(
     'reports an error thrown at the checkpoint of a worklet scheduled on a Worker Runtime',
     async () => {
```

**File**: `apps/common-app/runtime-tests/worklets/tests/runtimes/reentrantModule.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import {
+  getRuntimeKind,
+  runOnRuntimeSyncWithId,
+  RuntimeKind,
+} from 'react-native-worklets';
+
+type ReentrantModuleGlobal = typeof globalThis & {
+  __reentrantModuleRuntimeId?: number;
+};
+
+export const evaluationLog: string[] = [];
+
+const runtimeId = (globalThis as ReentrantModuleGlobal)
+  .__reentrantModuleRuntimeId;
+
+if (getRuntimeKind() === RuntimeKind.Worker && runtimeId !== undefined) {
+  evaluationLog.push('module begins');
+  queueMicrotask(() => {
+    evaluationLog.push('microtask');
+  });
+  runOnRuntimeSyncWithId(runtimeId, () => {
+    'worklet';
+  });
+  evaluationLog.push('module ends');
+}
```

**File**: `apps/common-app/runtime-tests/worklets/tests/runtimes/reentrantModuleLoad.test.tsx` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import {
+  createWorkletRuntime,
+  isBundleModeEnabled,
+  runOnRuntimeSync,
+} from 'react-native-worklets';
+
+import { describe, expect, test } from '../../../ReJest/RuntimeTestsApi';
+import { evaluationLog } from './reentrantModule';
+
+type ReentrantModuleGlobal = typeof globalThis & {
+  __reentrantModuleRuntimeId?: number;
+};
+
+describe('module loaded while a worklet is unpacked', () => {
+  const reentrantModuleTest = isBundleModeEnabled() ? test : test.skip;
+
+  reentrantModuleTest(
+    'runs microtasks queued by the module after the worklet',
+    () => {
+      const runtime = createWorkletRuntime({
+        name: 'reentrant module load',
+      });
+      runOnRuntimeSync(
+        runtime,
+        (runtimeId: number) => {
+          'worklet';
+          (globalThis as ReentrantModuleGlobal).__reentrantModuleRuntimeId =
+            runtimeId;
+        },
+        runtime.runtimeId
+      );
+
+      runOnRuntimeSync(runtime, () => {
+        'worklet';
+        evaluationLog.push('worklet body');
+      });
+      const log = runOnRuntimeSync(runtime, () => {
+        'worklet';
+        return evaluationLog.join(', ');
+      });
+
+      expect(log).toBe('module begins, module ends, worklet body, microtask');
+    }
+  );
+});
```

**File**: `apps/fabric-example/babel.config.js` (modified, +3/-0)
```diff
@@ -6,6 +6,9 @@ const workletsPluginOptions = {
   getHBCBinary,
   importForwarding: {
     moduleNames: ['axios'],
+    relativePaths: [
+      'runtime-tests/worklets/tests/runtimes/reentrantModuleLoad.test.tsx',
+    ],
   },
 };
 
```

**File**: `apps/fabric-example/metro.config.js` (modified, +17/-0)
```diff
@@ -24,6 +24,23 @@ const appsRoot = path.resolve(monorepoRoot, 'apps');
 let config = {
   projectRoot: __dirname,
   watchFolders: [monorepoRoot, appsRoot],
+  transformer: {
+    getTransformOptions: async () => ({
+      transform: {
+        experimentalImportSupport: false,
+        inlineRequires: true,
+        nonInlinedRequires: [
+          'React',
+          'react',
+          'react/jsx-dev-runtime',
+          'react/jsx-runtime',
+          'react-compiler-runtime',
+          'react-native',
+          '../../../apps/common-app/runtime-tests/worklets/tests/runtimes/reentrantModule',
+        ],
+      },
+    }),
+  },
   resolver: {
     blockList,
     extraNodeModules,
```

**File**: `packages/react-native-worklets/Common/cpp/worklets/Compat/StableApi.cpp` (modified, +6/-5)
```diff
@@ -117,33 +117,34 @@ std::shared_ptr<Serializable> extractSerializable(
 void runSyncOnRuntime(
     const std::shared_ptr<WorkletRuntime> &workletRuntime,
     const std::shared_ptr<Serializable> &worklet) {
-  workletRuntime->runSyncAndDiscard(std::static_pointer_cast<SerializableWorklet>(worklet));
+  workletRuntime->runSyncAndDiscardAndDrainMicrotasks(std::static_pointer_cast<SerializableWorklet>(worklet));
 }
 
 void runSyncOnRuntime(
     const std::shared_ptr<WorkletRuntime> &workletRuntime,
     const std::shared_ptr<Serializable> &worklet,
     const facebook::jsi::Value &arg0) {
-  workletRuntime->runSyncAndDiscard(std::static_pointer_cast<SerializableWorklet>(worklet), arg0);
+  workletRuntime->runSyncAndDiscardAndDrainMicrotasks(std::static_pointer_cast<SerializableWorklet>(worklet), arg0);
 }
 
 void runSyncOnRuntime(
     const std::shared_ptr<WorkletRuntime> &workletRuntime,
     const std::shared_ptr<Serializable> &worklet,
     const facebook::jsi::Value &arg0,
     const facebook::jsi::Value &arg1) {
-  workletRuntime->runSyncAndDiscard(std::static_pointer_cast<SerializableWorklet>(worklet), arg0, arg1);
+  workletRuntime->runSyncAndDiscardAndDrainMicrotasks(
+      std::static_pointer_cast<SerializableWorklet>(worklet), arg0, arg1);
 }
 
 void runSyncOnRuntime(const std::shared_ptr<WorkletRuntime> &workletRuntime, const facebook::jsi::Function &function) {
-  workletRuntime->runSyncAndDiscard(function);
+  workletRuntime->runSyncAndDiscardAndDrainMicrotasks(function);
 }
 
 void runSyncOnRuntime(
     const std::shared_ptr<WorkletRuntime> &workletRuntime,
     const facebook::jsi::Function &function,
     const facebook::jsi::Value &arg0) {
-  workletRuntime->runSyncAndDiscard(function, arg0);
+  workletRuntime->runSyncAndDiscardAndDrainMicrotasks(function, arg0);
 }
 
 std::shared_ptr<WorkletRuntime> getWorkletRuntimeFromHolder(
```

---

### Incident Patch 3: `6c644f09` (2026-11-19)
**Commit Message**: fix(Worklets): report an error thrown by a microtask at a task checkpoint (#11421)

> [!NOTE]
> This pull request was authored by AI on behalf of @tjzel.

## Summary

Stacked on #11377. #11410 is stacked on this PR.

## Human track

### Why

Bug fix. A microtask that throws at the checkpoint of a scheduled
worklet crashes the app in a debug build:

```ts
scheduleOnUI(() => {
  'worklet';
  queueMicrotask(() => {
    throw new Error('boom');
  });
});
```

An error thrown by the worklet itself is caught and reported to the RN
runtime. The checkpoint that runs after the worklet has no such
handling, so the exception leaves the scheduled task as an uncaught C++
exception.

#11410 makes more calls run a checkpoint (`runOnUISync`,
`runOnRuntimeSync`, the calls Reanimated makes for events), so the gap
is closed first.

### How

In debug builds, the checkpoint catches the error of a microtask and
reports it with the same function that reports worklet errors. Release
builds are unchanged: there, neither a worklet error nor a microtask
error is caught.

After the error is reported, the runtime keeps working. The microtasks
that were queued after the throwing one stay queued and run at the n

**File**: `apps/common-app/runtime-tests/worklets/suites.ts` (modified, +1/-0)
```diff
@@ -54,6 +54,7 @@ export const WORKLETS_TEST_SUITES: RuntimeTestSuite[] = [
       require('./tests/runtimes/runOnRuntimeSyncWithId.test');
       require('./tests/runtimes/scheduleOnRuntimeWithId.test');
       require('./tests/runtimes/microtaskDrains.test');
+      require('./tests/runtimes/microtaskErrors.test');
       require('./tests/runtimes/weakRef.test');
       require('./tests/runtimes/performanceNow.test');
     },
```

**File**: `apps/common-app/runtime-tests/worklets/tests/runtimes/microtaskErrors.test.tsx` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+import {
+  scheduleOnRN,
+  scheduleOnRuntime,
+  scheduleOnUI,
+} from 'react-native-worklets';
+
+import {
+  describe,
+  expect,
+  getWorkletRuntimesFromPool,
+  notify,
+  test,
+  waitForNotification,
+} from '../../../ReJest/RuntimeTestsApi';
+
+const UI_ERROR = 'microtask error on the UI Runtime';
+const WORKER_ERROR = 'microtask error on a Worker Runtime';
+const ALIVE_NOTIFICATION = 'RUNTIME_ALIVE_AFTER_MICROTASK_ERROR';
+
+describe('errors thrown by microtasks', () => {
+  const [workletRuntime] = getWorkletRuntimesFromPool(1);
+  const debugTest = __DEV__ ? test : test.skip;
+
+  const onAlive = () => {
+    notify(ALIVE_NOTIFICATION);
+  };
+
+  debugTest(
+    'reports an error thrown at the checkpoint of a worklet scheduled on the UI Runtime',
+    async () => {
+      await expect(() => {
+        scheduleOnUI(() => {
+          'worklet';
+          queueMicrotask(() => {
+            throw new Error(UI_ERROR);
+          });
+        });
+      }).toThrow(UI_ERROR);
+
+      scheduleOnUI(() => {
+        'worklet';
+        queueMicrotask(() => {
+          scheduleOnRN(onAlive);
+        });
+      });
+      await waitForNotification(ALIVE_NOTIFICATION);
+    }
+  );
+
+  debugTest(
+    'reports an error thrown at the checkpoint of a worklet scheduled on a Worker Runtime',
+    async () => {
+      await expect(() => {
+        scheduleOnRuntime(workletRuntime, () => {
+          'worklet';
+          queueMicrotask(() => {
+            throw new Error(WORKER_ERROR);
+          });
+        });
+      }).toThrow(WORKER_ERROR);
+
+      scheduleOnRuntime(workletRuntime, () => {
+        'worklet';
+        queueMicrotask(() => {
+          scheduleOnRN(onAlive);
+        });
+      });
+      await waitForNotification(ALIVE_NOTIFICATION);
+    }
+  );
+});
```

**File**: `packages/react-native-worklets/Common/cpp/worklets/WorkletRuntime/WorkletRuntime.h` (modified, +10/-1)
```diff
@@ -419,7 +419,16 @@ class WorkletRuntime : public jsi::HostObject, public std::enable_shared_from_th
       }
       if constexpr (TCheckpoint == MicrotaskCheckpoint::Run) {
         if (microtaskQueueEnabled_) {
-          getJSIRuntime().drainMicrotasks();
+          jsi::Runtime &rt = getJSIRuntime();
+#ifndef NDEBUG
+          try {
+            rt.drainMicrotasks();
+          } catch (jsi::JSError &e) {
+            JSLogger::handleJSError(jsScheduler_, rt, name_, e, std::nullopt);
+          }
+#else
+          rt.drainMicrotasks();
+#endif // NDEBUG
         }
       }
       rootTaskRunning_ = false;
```

**File**: `packages/react-native-worklets/changelog/report-microtask-errors.fix.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Report an error thrown by a microtask at the checkpoint of a scheduled worklet the same way as an error thrown by the worklet, instead of crashing the app in debug builds.
```

#### Recent Merged Pull Requests:
- **PR #11467** (2026-11-20): docs(Reanimated): serve testimonial avatars from the docs site (@tjzel)
- **PR #11463** (2026-11-20): release(Worklets): 0.12.3 (@tjzel)
- **PR #11462** (2026-11-20): test(Reanimated): step the held clock in the all-rows Animated.Text test (@tjzel)
- **PR #11460** (2026-11-20): docs(Worklets): remove the serialization TODO from the returning results tutorial (@tjzel)
- **PR #11459** (2026-11-20): docs(Worklets): redirect getting-started to the About page (@tjzel)
- **PR #11457** (2026-11-20): fix(Reanimated): ignore unknown frame callbacks (@tjzel)

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

## X. Worklets): preserve UI scheduler order

**RULE**:
When implementing operations in `apps/common-app/runtime-tests/worklets/tests/runtimes/scheduleOnUI.test.tsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in software-mansion/react-native-reanimated. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `816d62ba`: Worklets): preserve UI scheduler order. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/common-app/runtime-tests/worklets/tests/runtimes/scheduleOnUI.test.tsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  createSynchronizable,
  scheduleOnRuntime,
  createOrderConstraint,
    test('preserves queued UI work before a UI caller', async () => {
      const [confirmedOrder, order] = createOrderConstraint();
      const uiActive = createSynchronizable(false);
      const queued = createSynchronizable(false);
      const [first, second] = ['first', 'second'];

      scheduleOnRuntime(workletRuntime, () => {
        'worklet';
        const deadline = performance.now() + 1000;
        while (!uiActive.getBlocking() && performance.now() < deadline) {
          uiActive.getBlocking();
        }
        if (!uiActive.getBlocking()) {
          throw new Error('UI job did not start.');
        }
        scheduleOnUI(() => {
          'worklet';
          order(1, first);
        });
        queueMicrotask(() => {
          queued.setBlocking(true);
        });
      });

      scheduleOnUI(() => {
        'worklet';
        uiActive.setBlocking(true);
        const deadline = performance.now() + 1000;
        while (!queued.getBlocking() && performance.now() < deadline) {
          queued.getBlocking();
        }
        if (!queued.getBlocking()) {
          throw new Error('Worker did not e
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
  scheduleOnRuntime,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `816d62ba` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
