# Forensic Learning Record (Deep Inspection): callstack/react-native-paper

> **Canonical Artifact**: `07_PROJECT_LEARNING/callstack-react-native-paper-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/callstack/react-native-paper](https://github.com/callstack/react-native-paper))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:56:32.146Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `callstack/react-native-paper`
- **Description**: Material Design for React Native (Android & iOS)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 14465 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `example/utils/index.ts`
```
import { Platform } from 'react-native';

import { DarkTheme, LightTheme } from 'react-native-paper';
import type { Theme } from 'react-native-paper';

type ReducerAction<T extends keyof State> = {
  payload: State[T];
  type: T;
};

type IconsColor = {
  flatLeftIcon: string | undefined;
  flatRightIcon: string | undefined;
  outlineLeftIcon: string | undefined;
  outlineRightIcon: string | undefined;
  customIcon: string | undefined;
};

export type State = {
  text: string;
  customIconText: string;
  name: string;
  outlinedText: string;
  largeText: string;
  flatTextPassword: string;
  flatLongText: string;
  outlinedLargeText: string;
  outlinedCustomLabel: string;
  outlinedTextPassword: string;
  outlinedLongText: string;
  nameNoPadding: string;
  customStyleText: string;
  nameRequired: string;
  flatDenseText: string;
  flatDense: string;
  outlinedDenseText: string;
  outlinedDense: string;
  flatMultiline: string;
  flatTextArea: string;
  flatUnderlineColors: string;
  outlinedMultiline: string;
  outlinedTextArea: string;
  outlinedColors: string;
  outlinedLongLabel: string;
  maxLengthName: string;
  flatTextSecureEntry: boolean;
  outlineTextSecureEntry: boolean;
  iconsColor: IconsColor;
};

export function inputReducer<T extends keyof State>(
  state: State,
  action: ReducerAction<T>
) {
  switch (action.type) {
    case action.type:
      return { ...state, [action.type]: action.payload };
    default:
      return state;
  }
}

export const animatedFABExampleData = [
  {
    id: '1',
    sender: 'Hermann, Pfannel & Schumm',
    header:
      'Cras mi pede, malesuada in, imperdiet et, commodo vulputate, justo. In blandit ultrices enim. Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Proin interdum mauris non ligula pellentesque ultrices. Phasellus id sapien in sapien iaculis congue. Vivamus metus arcu, adipiscing molestie, hendrerit at, vulputate vitae, nisl. Aenean lectus. Pellentesque eget nunc. Donec quis orci eget orci vehicula condimentum.',
    message:
      'Duis consequat dui nec nisi volutpat eleifend. Donec ut dolor. Morbi vel lectus in quam fringilla rhoncus.\n\nMauris enim leo, rhoncus sed, vestibulum sit amet, cursus id, turpis. Integer aliquet, massa id lobortis convallis, tortor risus dapibus augue, vel accumsan tellus nisi eu orci. Mauris lacinia sapien quis libero.\n\nNullam sit amet turpis elementum ligula vehicula consequat. Morbi a ipsum. Integer a nibh.',
    initials: 'H',
    date: '29.1.2021',
    read: false,
    favorite: false,
    bgColor: '#ff0173',
  },
  {
    id: '2',
    sender: 'Ziemann, Lockman and Kuvalis',
    header:
      'Vivamus vestibulum sagittis sapien. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Etiam vel augue.',
    message:
      'Maecenas leo odio, condimentum id, luctus nec, molestie sed, justo. Pellentesque viverra pede ac diam. Cras pellentesque volutpat dui.\n\nMaecenas tristique, est et tempus semper, est quam pharetra magna, ac consequat metus sapien ut nunc. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Mauris viverra diam vitae quam. Suspendisse potenti.\n\nNullam porttitor lacus at turpis. Donec posuere metus vitae ipsum. Aliquam non mauris.',
    initials: 'J',
    date: '5.9.2020',
    read: false,
    favorite: false,
    bgColor: '#b287a9',
  },
  {
    id: '3',
    sender: 'Daniel, Kuhn and Wolf',
    header:
      'Aenean fermentum. Donec ut mauris eget massa tempor convallis. Nulla neque libero, convallis eget, eleifend luctus, ultricies eu, nibh. Quisque id justo sit amet sapien dignissim vestibulum.',
    message:
      'Nam ultrices, libero non mattis pulvinar, nulla pede ullamcorper augue, a suscipit nulla elit ac nulla. Sed vel enim sit amet nunc viverra dapibus. Nulla suscipit ligula in lacus.\n\nCurabitur at ipsum ac tellus semper interdum. Mauris ullamcorper purus sit amet nulla. Quisque arcu libero, rutrum ac, lobortis vel, dapibus at, diam.',
    initials: 'Y',
    date: '13.6.2020',
    read: true,
    favorite: false,
    bgColor: '#c1bde9',
  },
  {
    id: '4',
    sender: 'Crona, Lind and Stoltenberg',
    header:
      'Quisque erat eros, viverra eget, congue eget, semper rutrum, nulla. Nunc purus. Phasellus in felis. Donec semper sapien a libero. Nam dui. Proin leo odio, porttitor id, consequat in, consequat ut, nulla.',
    message:
      'Aenean lectus. Pellentesque eget nunc. Donec quis orci eget orci vehicula condimentum.',
    initials: 'W',
    date: '20.5.2020',
    read: false,
    favorite: false,
    bgColor: '#932a24',
  },
  {
    id: '5',
    sender: 'Bashirian-Hudson',
    header:
      'Fusce congue, diam id ornare imperdiet, sapien urna pretium nisl, ut volutpat sapien arcu sed augue. Aliquam erat volutpat. In congue. Etiam justo. Etiam pretium iaculis justo. In hac habitasse platea dictumst.',
    message:
      'Sed sagittis. Nam congue, risus semper porta volutpat, quam pede lobortis ligula, sit amet eleifend pede libero quis orci. Nullam molestie nibh in lectus.\n\nPellentesque at nulla. Suspendisse potenti. Cras in purus eu magna vulputate luctus.\n\nCum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Vivamus vestibulum sagittis sapien. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.',
    initials: 'V',
    date: '21.9.2020',
    read: true,
    favorite: false,
    bgColor: '#eda5b7',
  },
  {
    id: '6',
    sender: 'Schmitt-Jacobs',
    header:
      'Integer aliquet, massa id lobortis convallis, tortor risus dapibus augue, vel accumsan tellus nisi eu orci. Mauris lacinia sapien quis libero. Nullam sit amet turpis elementum ligula vehicula consequat. Morbi a ipsum. Integer a nibh. In quis justo.',
    message:
      'Phasellus sit amet erat. Nulla tempus. Vivamus in felis eu sapien cursus vestibulum.',
    initials: 'M',
    date: '2.6.2020',
    read: true,
    favorite: true,
    bgColor: '#18aaba',
  },
  {
    id: '7',
    sender: 'Graham-Champlin',
    header:
      'Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Nulla dapibus dolor vel est. Donec odio justo, sollicitudin ut, suscipit a, feugiat et, eros. Vestibulum ac est lacinia nisi venenatis tristique. Fusce congue, diam id ornare imperdiet, sapien urna pretium nisl, ut volutpat sapien arcu sed augue. Aliquam erat volutpat. In congue.',
    message:
      'In hac habitasse platea dictumst. Morbi vestibulum, velit id pretium iaculis, diam erat fermentum justo, nec condimentum neque sapien placerat ante. Nulla justo.\n\nAliquam quis turpis eget elit sodales scelerisque. Mauris sit amet eros. Suspendisse accumsan tortor quis turpis.',
    initials: 'T',
    date: '17.10.2020',
    read: false,
    favorite: true,
    bgColor: '#cc5e54',
  },
  {
    id: '8',
    sender: 'Schoen, Carroll and Herzog',
    header:
      'Ut tellus. Nulla ut erat id mauris vulputate elementum. Nullam varius. Nulla facilisi.',
    message:
      'Cras non velit nec nisi vulputate nonummy. Maecenas tincidunt lacus at velit. Vivamus vel nulla eget eros elementum pellentesque.\n\nQuisque porta volutpat erat. Quisque erat eros, viverra eget, congue eget, semper rutrum, nulla. Nunc purus.',
    initials: 'F',
    date: '31.10.2020',
    read: false,
    favorite: false,
    bgColor: '#28db04',
  },
  {
    id: '9',
    sender: 'Pouros-Fay',
    header:
      'Donec semper sapien a libero. Nam dui. Proin leo odio, porttitor id, consequat in, consequat ut, nulla. Sed accumsan felis. Ut at dolor quis odio consequat varius. Integer ac leo. Pellentesque ultrices mattis odio. Donec vitae nisi.',
    message:
      'Aliquam quis turpis eget elit sodales scelerisque. Mauris sit amet eros. Suspendisse accumsan tortor quis turpis.\n\nSed ante. Vivamus tortor. Duis mattis egestas metus.\n\nAenean fermentum. Donec ut mauris eget massa tempor convallis. Nulla neque libero, convallis eget, eleifend luctus, ultricies eu, nibh.',
    initials: 'Z',
    date: '6.1.2021',
    read: true,
    favorite: true,
    bgColor: '#b6f3fb',
  },
  {
    id: '10',
    sender: 'McKenzie, Ruecker and Bernhard',
    header: 'Nunc purus. Phasellus in felis.',
    message:
      'In quis justo. Maecenas rhoncus aliquam lacus. Morbi quis tortor id nulla ultrices aliquet.',
    initials: 'F',
    date: '23.2.2021',
    read: false,
    favorite: false,
    bgColor: '#96f066',
  },
  {
    id: '11',
    sender: 'Olson Inc',
    header:
      'Maecenas leo odio, condimentum id, luctus nec, molestie sed, justo. Pellentesque viverra pede ac diam. Cras pellentesque volutpat dui. Maecenas tristique, est et tempus semper, est quam pharetra magna, ac consequat metus sapien ut nunc. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Mauris viverra diam vitae quam. Suspendisse potenti.',
    message:
      'Phasellus sit amet erat. Nulla tempus. Vivamus in felis eu sapien cursus vestibulum.\n\nProin eu mi. Nulla ac enim. In tempor, turpis nec euismod scelerisque, quam turpis adipiscing lorem, vitae mattis nibh ligula nec sem.\n\nDuis aliquam convallis nunc. Proin at turpis a pede posuere nonummy. Integer non velit.',
    initials: 'V',
    date: '17.10.2020',
    read: false,
    favorite: false,
    bgColor: '#f2d49d',
  },
  {
    id: '12',
    sender: 'Walsh LLC',
    header:
      'Morbi sem mauris, laoreet ut, rhoncus aliquet, pulvinar sed, nisl. Nunc rhoncus dui vel sem. Sed sagittis.',
    message: 'Phasellus in felis. Donec semper sapien a libero. Nam dui.',
    initials: 'O',
    date: '6.1.2021',
    read: false,
    favorite: true,
    bgColor: '#f477dc',
  },
  {
    id: '13',
    sender: 'Lemke, Cremin and Kutch',
    header:
      'Praesent blandit lacinia erat. Vestibulum sed magna at nunc commodo placerat. Praesent blandit. Nam nulla. Integer pede justo, lacinia eget, tincidunt eget, tempus vel, pede. Morbi porttitor lorem id ligula. Suspen
```

### Core Architecture Module: `example/utils/themes.ts`
```
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';
import type { Theme as ReactNavigationTheme } from '@react-navigation/native';
import {
  adaptNavigationTheme,
  DarkTheme,
  LightTheme,
  configureFonts,
} from 'react-native-paper';
import type { Theme } from 'react-native-paper';

const { LightTheme: NavLightTheme, DarkTheme: NavDarkTheme } =
  adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
  });

export const CombinedDefaultTheme = {
  ...LightTheme,
  ...NavLightTheme,
  colors: {
    ...LightTheme.colors,
    ...NavLightTheme.colors,
  },
  fonts: {
    ...LightTheme.fonts,
    ...NavLightTheme.fonts,
  },
};

export const CombinedDarkTheme = {
  ...DarkTheme,
  ...NavDarkTheme,
  colors: {
    ...DarkTheme.colors,
    ...NavDarkTheme.colors,
  },
  fonts: {
    ...DarkTheme.fonts,
    ...NavDarkTheme.fonts,
  },
};

export const createConfiguredFontTheme = (
  theme: Theme & ReactNavigationTheme
) => ({
  ...theme,
  fonts: configureFonts({
    config: {
      fontFamily: 'Abel',
    },
  }),
});

export const createConfiguredFontNavigationTheme = (
  theme: Theme & ReactNavigationTheme
) => ({
  ...theme,
  fonts: {
    ...theme.fonts,
    regular: {
      ...theme.fonts.regular,
      fontFamily: 'Abel',
    },
    medium: {
      ...theme.fonts.medium,
      fontFamily: 'Abel',
    },
    heavy: {
      ...theme.fonts.heavy,
      fontFamily: 'Abel',
    },
    bold: {
      ...theme.fonts.bold,
      fontFamily: 'Abel',
    },
  },
});

```

### Core Architecture Module: `src/components/Appbar/utils.ts`
```
import React from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { white } from '../../theme/colors';
import type { InternalTheme, ThemeProp } from '../../theme/types';

export type AppbarModes = 'small' | 'medium' | 'large' | 'center-aligned';

export type AppbarChildProps = {
  isLeading?: boolean;
  color: string;
  style?: StyleProp<ViewStyle>;
};

const borderStyleProperties = [
  'borderRadius',
  'borderBottomEndRadius',
  'borderBottomStartRadius',
  'borderEndEndRadius',
  'borderEndStartRadius',
  'borderStartEndRadius',
  'borderStartStartRadius',
  'borderTopEndRadius',
  'borderTopStartRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  'borderCurve',
] satisfies readonly (keyof ViewStyle)[];

export const getAppbarBackgroundColor = (
  theme: InternalTheme,
  elevated: boolean,
  customBackground?: ColorValue
) => {
  const { colors } = theme;
  if (customBackground) {
    return customBackground;
  }

  if (elevated) {
    return colors.surfaceContainer;
  }

  return colors.surface;
};

export const getAppbarColor = ({
  color,
  isDark,
}: BaseProps & { color: string }) => {
  if (typeof color !== 'undefined') {
    return color;
  }

  if (isDark) {
    return white;
  }

  return undefined;
};

export const getAppbarBorders = (style: ViewStyle) => {
  let borders: ViewStyle = {};

  for (const property of borderStyleProperties) {
    const value = style[property];

    if (typeof value === 'number' || typeof value === 'string') {
      borders = { ...borders, [property]: value };
    }
  }

  return borders;
};

type BaseProps = {
  isDark: boolean;
};

type RenderAppbarContentProps = BaseProps & {
  children: React.ReactNode;
  shouldCenterContent?: boolean;
  renderOnly?: (string | boolean)[];
  renderExcept?: string[];
  mode?: AppbarModes;
  theme?: ThemeProp;
};

export const DEFAULT_APPBAR_HEIGHT = 56;
const MD3_DEFAULT_APPBAR_HEIGHT = 64;

export const modeAppbarHeight = {
  small: MD3_DEFAULT_APPBAR_HEIGHT,
  medium: 112,
  large: 152,
  'center-aligned': MD3_DEFAULT_APPBAR_HEIGHT,
};

export const modeTextVariant = {
  small: 'titleLarge',
  medium: 'headlineSmall',
  large: 'headlineMedium',
  'center-aligned': 'titleLarge',
} as const;

export const filterAppbarActions = (
  children: React.ReactNode,
  isLeading = false
) => {
  return React.Children.toArray(children).filter((child) => {
    if (!React.isValidElement<AppbarChildProps>(child)) return false;
    return isLeading ? child.props.isLeading : !child.props.isLeading;
  });
};

export const renderAppbarContent = ({
  children,
  isDark,
  shouldCenterContent = false,
  renderOnly,
  renderExcept,
  mode = 'small',
  theme,
}: RenderAppbarContentProps) => {
  return React.Children.toArray(children)
    .filter((child) => child != null && typeof child !== 'boolean')
    .filter((child) =>
      // @ts-expect-error: TypeScript complains about the type of type but it doesn't matter
      renderExcept ? !renderExcept.includes(child.type.displayName) : child
    )
    .filter((child) =>
      // @ts-expect-error: TypeScript complains about the type of type but it doesn't matter
      renderOnly ? renderOnly.includes(child.type.displayName) : child
    )
    .map((child, i) => {
      if (
        !React.isValidElement<AppbarChildProps>(child) ||
        ![
          'Appbar.Content',
          'Appbar.Action',
          'Appbar.BackAction',
          'Tooltip',
        ].includes(
          // @ts-expect-error: TypeScript complains about the type of type but it doesn't matter
          child.type.displayName
        )
      ) {
        return child;
      }

      const props: {
        color?: string;
        style?: StyleProp<ViewStyle>;
        mode?: AppbarModes;
        theme?: ThemeProp;
      } = {
        theme,
        color: getAppbarColor({ color: child.props.color, isDark }),
      };

      // @ts-expect-error: TypeScript complains about the type of type but it doesn't matter
      if (child.type.displayName === 'Appbar.Content') {
        props.mode = mode;
        props.style = [
          i === 0 && !shouldCenterContent && styles.v3Spacing,
          shouldCenterContent && styles.centerAlignedContent,
          child.props.style,
        ];
        props.color;
      }
      return React.cloneElement(child, props);
    });
};

const styles = StyleSheet.create({
  centerAlignedContent: {
    alignItems: 'center',
  },
  v3Spacing: {
    marginLeft: 12,
  },
});

```

### Core Architecture Module: `src/components/BottomNavigation/utils.ts`
```
import type { ColorValue } from 'react-native';

import type { InternalTheme } from '../../theme/types';

export const getActiveTintColor = ({
  activeColor,
  theme,
}: {
  activeColor: ColorValue | undefined;
  theme: InternalTheme;
}) => {
  if (activeColor != null) {
    return activeColor;
  }

  return theme.colors.onSecondaryContainer;
};

export const getInactiveTintColor = ({
  inactiveColor,
  theme,
}: {
  inactiveColor: ColorValue | undefined;
  theme: InternalTheme;
}) => {
  if (inactiveColor != null) {
    return inactiveColor;
  }

  return theme.colors.onSurfaceVariant;
};

export const getLabelColor = ({
  tintColor,
  hasColor,
  focused,
  theme,
}: {
  tintColor: ColorValue;
  hasColor: boolean;
  focused: boolean;
  theme: InternalTheme;
}) => {
  const { colors } = theme;
  if (hasColor) {
    return tintColor;
  }

  if (focused) {
    return colors.onSurface;
  }
  return colors.onSurfaceVariant;
};

```

### Core Architecture Module: `src/components/Button/utils.tsx`
```
import type { ColorValue, ViewStyle } from 'react-native';

import { black, white } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { InternalTheme } from '../../theme/types';
import { splitStyles } from '../../utils/splitStyles';

const stateOpacity = tokens.md.sys.state.opacity;

export type ButtonMode =
  | 'text'
  | 'outlined'
  | 'contained'
  | 'elevated'
  | 'contained-tonal';

type BaseProps = {
  isMode: (mode: ButtonMode) => boolean;
  theme: InternalTheme;
  disabled?: boolean;
};

const isDark = ({
  dark,
  backgroundColor,
}: {
  dark?: boolean;
  backgroundColor?: ColorValue;
}) => {
  if (typeof dark === 'boolean') {
    return dark;
  }

  if (backgroundColor === 'transparent') {
    return false;
  }

  return false;
};

const getButtonBackgroundColor = ({
  isMode,
  theme,
  disabled,
  customButtonColor,
}: BaseProps & {
  customButtonColor?: ColorValue;
}) => {
  const { colors } = theme;
  if (customButtonColor && !disabled) {
    return customButtonColor;
  }

  if (disabled) {
    if (isMode('outlined') || isMode('text')) {
      return 'transparent';
    }
    return colors.onSurface;
  }

  if (isMode('elevated')) {
    return colors.surfaceContainerLow;
  }

  if (isMode('contained')) {
    return colors.primary;
  }

  if (isMode('contained-tonal')) {
    return colors.secondaryContainer;
  }

  return 'transparent';
};

const getButtonTextColor = ({
  isMode,
  theme,
  disabled,
  customTextColor,
  backgroundColor,
  dark,
}: BaseProps & {
  customTextColor?: ColorValue;
  backgroundColor: ColorValue;
  dark?: boolean;
}) => {
  const { colors } = theme;
  if (customTextColor && !disabled) {
    return customTextColor;
  }

  if (disabled) {
    return theme.colors.onSurface;
  }

  if (typeof dark === 'boolean') {
    if (
      isMode('contained') ||
      isMode('contained-tonal') ||
      isMode('elevated')
    ) {
      return isDark({ dark, backgroundColor }) ? white : black;
    }
  }

  if (isMode('outlined') || isMode('text') || isMode('elevated')) {
    return colors.primary;
  }

  if (isMode('contained')) {
    return colors.onPrimary;
  }

  if (isMode('contained-tonal')) {
    return colors.onSecondaryContainer;
  }

  return colors.primary;
};

const getButtonBorderColor = ({ isMode, theme }: BaseProps) => {
  if (isMode('outlined')) {
    return theme.colors.outlineVariant;
  }

  return 'transparent';
};

const getButtonBorderWidth = ({ isMode }: Omit<BaseProps, 'disabled'>) => {
  if (isMode('outlined')) {
    return 1;
  }

  return 0;
};

export const getButtonColors = ({
  theme,
  mode,
  customButtonColor,
  customTextColor,
  disabled,
  dark,
}: {
  theme: InternalTheme;
  mode: ButtonMode;
  customButtonColor?: ColorValue;
  customTextColor?: ColorValue;
  disabled?: boolean;
  dark?: boolean;
}) => {
  const isMode = (modeToCompare: ButtonMode) => {
    return mode === modeToCompare;
  };

  const backgroundColor = getButtonBackgroundColor({
    isMode,
    theme,
    disabled,
    customButtonColor,
  });

  const textColor = getButtonTextColor({
    isMode,
    theme,
    disabled,
    customTextColor,
    backgroundColor,
    dark,
  });

  const borderColor = getButtonBorderColor({ isMode, theme });

  const borderWidth = getButtonBorderWidth({ isMode, theme });

  const textOpacity = disabled ? stateOpacity.disabled : stateOpacity.enabled;

  const backgroundOpacity =
    disabled && !isMode('outlined') && !isMode('text')
      ? stateOpacity.pressed
      : stateOpacity.enabled;

  return {
    backgroundColor,
    borderColor,
    textColor,
    textOpacity,
    borderWidth,
    backgroundOpacity,
  };
};

type ViewStyleBorderRadiusStyles = Partial<
  Pick<
    ViewStyle,
    | 'borderBottomEndRadius'
    | 'borderBottomLeftRadius'
    | 'borderBottomRightRadius'
    | 'borderBottomStartRadius'
    | 'borderTopEndRadius'
    | 'borderTopLeftRadius'
    | 'borderTopRightRadius'
    | 'borderTopStartRadius'
    | 'borderRadius'
  >
>;
export const getButtonTouchableRippleStyle = (
  style?: ViewStyle,
  borderWidth: number = 0
): ViewStyleBorderRadiusStyles => {
  if (!style) return {};
  const touchableRippleStyle: ViewStyleBorderRadiusStyles = {};

  const [, borderRadiusStyles] = splitStyles(
    style,
    (style) => style.startsWith('border') && style.endsWith('Radius')
  );

  const borderRadiusKeys =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    Object.keys(borderRadiusStyles) as Array<keyof ViewStyleBorderRadiusStyles>;

  borderRadiusKeys.forEach((key) => {
    const value = style[key];
    if (typeof value === 'number') {
      // Only subtract borderWidth if value is greater than 0
      const radius = value > 0 ? value - borderWidth : 0;
      touchableRippleStyle[key] = radius;
    }
  });
  return touchableRippleStyle;
};

```

### Core Architecture Module: `src/components/Card/utils.tsx`
```
import type { StyleProp, ViewStyle } from 'react-native';

import type { InternalTheme } from '../../theme/types';

type CardMode = 'elevated' | 'outlined' | 'contained';

type BorderRadiusStyles = Pick<
  ViewStyle,
  Extract<keyof ViewStyle, `border${string}Radius`>
>;

export type CardActionChildProps = {
  compact?: boolean;
  mode?: string;
  style?: StyleProp<ViewStyle>;
};

export const getCardCoverStyle = ({
  theme,
  index: _index,
  total: _total,
  borderRadiusStyles,
}: {
  theme: InternalTheme;
  borderRadiusStyles: BorderRadiusStyles;
  index?: number;
  total?: number;
}) => {
  if (Object.keys(borderRadiusStyles).length > 0) {
    return {
      borderRadius: theme.shapes.corner.medium,
      ...borderRadiusStyles,
    };
  }

  return {
    borderRadius: theme.shapes.corner.medium,
  };
};

const getBorderColor = ({ theme }: { theme: InternalTheme }) => {
  return theme.colors.outline;
};

const getBackgroundColor = ({
  theme,
  isMode,
}: {
  theme: InternalTheme;
  isMode: (mode: CardMode) => boolean;
}) => {
  const { colors } = theme;
  if (isMode('contained')) {
    return colors.surfaceVariant;
  }
  if (isMode('outlined')) {
    return colors.surface;
  }
  return undefined;
};

export const getCardColors = ({
  theme,
  mode,
}: {
  theme: InternalTheme;
  mode: CardMode;
}) => {
  const isMode = (modeToCompare: CardMode) => {
    return mode === modeToCompare;
  };

  return {
    backgroundColor: getBackgroundColor({
      theme,
      isMode,
    }),
    borderColor: getBorderColor({ theme }),
  };
};

```

### Core Architecture Module: `src/components/Checkbox/utils.ts`
```
import type { ColorValue } from 'react-native';

import { CheckboxTokens } from './tokens';
import { tokens } from '../../theme/tokens';
import type { InternalTheme } from '../../theme/types';

// MD3 Checkbox spec: https://m3.material.io/components/checkbox/specs

const stateOpacity = tokens.md.sys.state.opacity;

type SelectionState = {
  theme: InternalTheme;
  selected: boolean;
  disabled?: boolean;
  error?: boolean;
  customColor?: ColorValue;
  customUncheckedColor?: ColorValue;
};

type SelectionVisualState = {
  containerColor: ColorValue;
  outlineColor: ColorValue;
  containerOpacity: number;
  iconColor: ColorValue;
};

const getContainerColor = ({
  theme,
  disabled,
  error,
  customColor,
}: SelectionState): ColorValue => {
  if (disabled) {
    return theme.colors[CheckboxTokens.disabledContainerColor];
  }
  if (customColor) {
    return customColor;
  }
  if (error) {
    return theme.colors[CheckboxTokens.errorContainerColor];
  }
  return theme.colors[CheckboxTokens.containerColor];
};

const getOutlineColor = ({
  theme,
  disabled,
  error,
  customUncheckedColor,
}: SelectionState): ColorValue => {
  if (disabled) {
    return theme.colors[CheckboxTokens.disabledOutlineColor];
  }
  if (customUncheckedColor) {
    return customUncheckedColor;
  }
  if (error) {
    return theme.colors[CheckboxTokens.errorOutlineColor];
  }
  return theme.colors[CheckboxTokens.outlineColor];
};

const getIconColor = ({
  theme,
  disabled,
  error,
}: SelectionState): ColorValue => {
  if (disabled) {
    return theme.colors[CheckboxTokens.disabledIconColor];
  }
  if (error) {
    return theme.colors[CheckboxTokens.errorIconColor];
  }
  return theme.colors[CheckboxTokens.iconColor];
};

/**
 * Resolve the static (non-interactive) colors + opacity for the Checkbox
 * renderer. Hover / pressed / focused visuals are owned by `TouchableRipple`
 * and the focus-ring outline, so they don't appear here.
 */
export const getSelectionVisualState = ({
  theme,
  selected,
  disabled,
  error,
  customColor,
  customUncheckedColor,
}: SelectionState): SelectionVisualState => {
  return {
    containerColor: getContainerColor({
      theme,
      selected,
      disabled,
      error,
      customColor,
      customUncheckedColor,
    }),
    outlineColor: getOutlineColor({
      theme,
      selected,
      disabled,
      error,
      customColor,
      customUncheckedColor,
    }),
    containerOpacity: disabled ? stateOpacity.disabled : stateOpacity.enabled,
    iconColor: getIconColor({
      theme,
      selected,
      disabled,
      error,
      customColor,
      customUncheckedColor,
    }),
  };
};

```

### Core Architecture Module: `src/components/Dialog/utils.ts`
```
import * as React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export const DialogTitleIdContext = React.createContext<string | undefined>(
  undefined
);

export type DialogChildProps = {
  style?: StyleProp<ViewStyle>;
};

export type DialogActionChildProps = DialogChildProps & {
  compact?: boolean;
  uppercase?: boolean;
};

```

### Core Architecture Module: `src/components/FAB/utils.ts`
```
import type { ColorValue } from 'react-native';

import { Tokens } from './tokens';
import type { Size, Variant } from './tokens';
import type { InternalTheme, TypescaleKey } from '../../theme/types';
import { contentColorFor } from '../../theme/utils/color';
import { resolveCornerRadius } from '../../theme/utils/shape';
import type { ShapeToken } from '../../theme/utils/shape';

export type ResolvedColors = {
  container: ColorValue;
  content: ColorValue;
};

/**
 * Resolve container + content colors. Explicit overrides win; when only
 * `containerColor` is set, the content color is derived via
 * `contentColorFor`.
 */
export const resolveColors = ({
  theme,
  variant = 'tonalPrimary',
  containerColor,
  contentColor,
}: {
  theme: InternalTheme;
  variant?: Variant;
  containerColor?: ColorValue;
  contentColor?: ColorValue;
}): ResolvedColors => {
  const roles = Tokens.variants[variant];
  const container = containerColor ?? theme.colors[roles.container];
  const content =
    contentColor ??
    (containerColor != null
      ? contentColorFor(theme, container)
      : theme.colors[roles.content]);
  return { container, content };
};

export type Dimensions = {
  height: number;
  width: number;
  borderRadius: number;
  iconSize: number;
  leading: number;
  trailing: number;
  iconLabelGap: number;
  labelTypescale: TypescaleKey;
};

/**
 * Resolve geometry for a FAB at a given size, with optional shape, icon
 * size, and leading/trailing overrides for FAB Menu items and the close
 * button.
 */
export const getDimensions = ({
  theme,
  size = 'default',
  shape,
  iconSize,
  leading,
  trailing,
}: {
  theme: InternalTheme;
  size?: Size;
  shape?: ShapeToken;
  iconSize?: number;
  leading?: number;
  trailing?: number;
}): Dimensions => {
  const spec = Tokens.sizes[size];
  const shapeToken: ShapeToken = shape ?? spec.shape;
  return {
    height: spec.container,
    width: spec.container,
    borderRadius: resolveCornerRadius(theme, shapeToken),
    iconSize: iconSize ?? spec.icon,
    leading: leading ?? spec.leading,
    trailing: trailing ?? spec.trailing,
    iconLabelGap: spec.iconLabelGap,
    labelTypescale: spec.labelTypescale,
  };
};

```

### Core Architecture Module: `src/components/IconButton/utils.ts`
```
import type { ColorValue } from 'react-native';

import { tokens } from '../../theme/tokens';
import type { InternalTheme } from '../../theme/types';

const stateOpacity = tokens.md.sys.state.opacity;

type IconButtonMode = 'outlined' | 'contained' | 'contained-tonal';

type BaseProps = {
  theme: InternalTheme;
  isMode: (mode: IconButtonMode) => boolean;
  disabled?: boolean;
  selected?: boolean;
};

const getBackgroundColor = ({
  theme,
  isMode,
  disabled,
  selected,
  customContainerColor,
}: BaseProps & { customContainerColor?: ColorValue }) => {
  if (disabled) {
    if (isMode('contained') || isMode('contained-tonal')) {
      return theme.colors.onSurface;
    }
  }

  if (typeof customContainerColor !== 'undefined') {
    return customContainerColor;
  }

  if (isMode('contained')) {
    if (selected) {
      return theme.colors.primary;
    }
    return theme.colors.surfaceVariant;
  }

  if (isMode('contained-tonal')) {
    if (selected) {
      return theme.colors.secondaryContainer;
    }
    return theme.colors.surfaceVariant;
  }

  if (isMode('outlined')) {
    if (selected) {
      return theme.colors.inverseSurface;
    }
  }

  return undefined;
};

const getIconColor = ({
  theme,
  isMode,
  disabled,
  selected,
  customIconColor,
}: BaseProps & { customIconColor?: ColorValue }) => {
  if (disabled) {
    return theme.colors.onSurface;
  }

  if (typeof customIconColor !== 'undefined') {
    return customIconColor;
  }

  if (isMode('contained')) {
    if (selected) {
      return theme.colors.onPrimary;
    }
    return theme.colors.primary;
  }

  if (isMode('contained-tonal')) {
    if (selected) {
      return theme.colors.onSecondaryContainer;
    }
    return theme.colors.onSurfaceVariant;
  }

  if (isMode('outlined')) {
    if (selected) {
      return theme.colors.inverseOnSurface;
    }
    return theme.colors.onSurfaceVariant;
  }

  if (selected) {
    return theme.colors.primary;
  }
  return theme.colors.onSurfaceVariant;
};

export const getIconButtonColor = ({
  theme,
  disabled,
  mode,
  selected,
  customIconColor,
  customContainerColor,
}: {
  theme: InternalTheme;
  disabled?: boolean;
  selected?: boolean;
  mode?: IconButtonMode;
  customIconColor?: ColorValue;
  customContainerColor?: ColorValue;
}) => {
  const isMode = (modeToCompare: IconButtonMode) => {
    return mode === modeToCompare;
  };

  const baseIconColorProps = {
    theme,
    isMode,
    disabled,
    selected,
  };

  const iconColor = getIconColor({
    ...baseIconColorProps,
    customIconColor,
  });

  const iconOpacity = disabled ? stateOpacity.disabled : stateOpacity.enabled;

  const backgroundColor = getBackgroundColor({
    ...baseIconColorProps,
    customContainerColor,
  });

  const backgroundOpacity =
    disabled && (isMode('contained') || isMode('contained-tonal'))
      ? stateOpacity.disabled
      : stateOpacity.enabled;

  return {
    iconColor,
    iconOpacity,
    backgroundColor,
    borderColor: theme.colors.outlineVariant,
    backgroundOpacity,
  };
};

```

### Core Architecture Module: `src/components/List/utils.ts`
```
import { StyleSheet } from 'react-native';
import type { StyleProp, TextProps, ViewStyle } from 'react-native';

import type { InternalTheme, ThemeProp } from '../../theme/types';

type Description =
  | React.ReactNode
  | ((props: {
      selectable: boolean;
      ellipsizeMode: TextProps['ellipsizeMode'];
      color: string;
      fontSize: number;
    }) => React.ReactNode);

export type ListChildProps = {
  left?: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  theme?: ThemeProp;
};

export type Style = {
  marginLeft?: number;
  marginRight?: number;
  marginVertical?: number;
  alignSelf?: 'flex-start' | 'center';
};

const stylesV3Left = {
  marginRight: 0,
  marginLeft: 16,
};

const stylesV3Right = {
  marginLeft: 16,
};

export const getLeftStyles = (
  alignToTop: boolean,
  description: Description
) => {
  const stylesV3: Style = {
    ...stylesV3Left,
    alignSelf: alignToTop ? 'flex-start' : 'center',
  };

  if (!description) {
    return {
      ...styles.iconMarginLeft,
      ...styles.marginVerticalNone,
      ...stylesV3,
    };
  }

  return {
    ...styles.iconMarginLeft,
    ...stylesV3,
  };
};

export const getRightStyles = (
  alignToTop: boolean,
  description: Description
) => {
  const stylesV3: Style = {
    ...stylesV3Right,
    alignSelf: alignToTop ? 'flex-start' : 'center',
  };

  if (!description) {
    return {
      ...styles.iconMarginRight,
      ...styles.marginVerticalNone,
      ...stylesV3,
    };
  }

  return {
    ...styles.iconMarginRight,
    ...stylesV3,
  };
};

const styles = StyleSheet.create({
  marginVerticalNone: { marginVertical: 0 },
  iconMarginLeft: { marginLeft: 0, marginRight: 16 },
  iconMarginRight: { marginRight: 0 },
});

export const getAccordionColors = ({
  theme,
  isExpanded,
}: {
  theme: InternalTheme;
  isExpanded?: boolean;
}) => {
  const titleColor = theme.colors.onSurface;

  const descriptionColor = theme.colors.onSurfaceVariant;

  const titleTextColor = isExpanded ? theme.colors?.primary : titleColor;

  return {
    descriptionColor,
    titleTextColor,
  };
};

```

### Core Architecture Module: `src/components/Menu/utils.ts`
```
import { tokens } from '../../theme/tokens';
import type { InternalTheme } from '../../theme/types';
import type { IconSource } from '../Icon';

const stateOpacity = tokens.md.sys.state.opacity;

export const MIN_WIDTH = 112;
export const MAX_WIDTH = 280;

type ContentProps = {
  iconWidth: number;
  leadingIcon?: IconSource;
  trailingIcon?: IconSource;
};

type ColorProps = {
  theme: InternalTheme;
  disabled?: boolean;
};

const getTitleColor = ({ theme }: ColorProps) => {
  return theme.colors.onSurface;
};

const getIconColor = ({ theme }: ColorProps) => {
  return theme.colors.onSurfaceVariant;
};

export const getMenuItemColor = ({ theme, disabled }: ColorProps) => {
  const contentOpacity = disabled
    ? stateOpacity.disabled
    : stateOpacity.enabled;

  return {
    titleColor: getTitleColor({ theme, disabled }),
    iconColor: getIconColor({ theme, disabled }),
    contentOpacity,
  };
};

export const getContentMaxWidth = ({
  iconWidth,
  leadingIcon,
  trailingIcon,
}: ContentProps) => {
  if (leadingIcon && trailingIcon) {
    return MAX_WIDTH - (2 * iconWidth + 24);
  }

  if (leadingIcon || trailingIcon) {
    return MAX_WIDTH - (iconWidth + 24);
  }

  return MAX_WIDTH - 12;
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5105** (2026-09-23): **Exception 1, Code 1, Subcode 11674116835123304857 > KERN_INVALID_ADDRESS at 0xa202cb68cfee9999. EXC_BAD_ACCESS folly::dynamic::hash**
  *Symptoms*: ### Current behaviour <!-- When i navigate between 2 screens then app got crash  --> When i navigate between 2 screens then app got crash  ### Expected behaviour <!-- Must be No crash while moving between 2 screens --> Must be No crash while moving between 2 screens  ### How to reproduce? <!-- Add 10-15 textinnut in screen and move to same screen again and again --> Add 10-15 textinnut in screen and move to same screen again and again  ### Issue stack trace  EXC_BAD_ACCESS: Exception 1, Code 1, Subcode 13012598385430910662 > KERN_INVALID_ADDRESS at 0xb4960949b06e56c6.   ReactNativeDependencies0x1052078ec  folly::dynamic::hash   ReactNativeDependencies0x105209b74  0x105209b40   ReactNativeDependencies0x105209b74  0x105209b40   ReactNativeDependencies0x1052098e0  0x105209898   ReactNativeDependencies0x1052069a4  folly::dynamic::dynamic   React               0x105dcd270  facebook::react::ShadowNode::clone   React               0x105db90b8  facebook::react::YogaLayoutableShadowNode::cloneChildInPlace   React               0x105dba074  facebook::react::YogaLayoutableShadowNode::yogaNodeCloneCallbackConnector   React               0x105c60138  facebook::yoga::Config::cloneNode   React               0x105c61dd4  facebook::yoga::Node::cloneChildrenIfNeeded   React               0x105c5bfa4  0x105c5ba90   React               0x105c5b92c  facebook::yoga::calculateLayoutInternal   React               0x105c58b38  facebook::yoga::layoutAbsoluteChild   React               0x105c59838  fac
  **Post-Mortem & Fix Analysis**:
  > Hi @manoj-mehra-spraxa   From the stack trace, this crash doesn't seem to come from react-native-paper. It happens in React Native's native layer (Fabric), in ShadowNode::clone during a layout pass triggered by the native navigation transition (SurfaceHandler::constraintLayout) while AddOutletScreen is mounting. That looks like a race condition or use-after-free in RN or react-native-navigation. Paper is JS-only, so it can't corrupt native memory directly.  Could you try:  Replacing Paper's TextInput with the core RN TextInput. Does it still crash? Sharing your react-native-navigation version (RN 0.86 support may be the issue). Upgrading Paper to the latest v5 (4.12.1 is no longer maintained). Providing a minimal repro repo.
  > Replacing Paper's TextInput with the core RN TextInput. Does it still crash? - **NO** Sharing your react-native-navigation version (RN 0.86 support may be the issue). - **"8.8.10"** Upgrading Paper to the latest v5 (4.12.1 is no longer maintained). - **Done - after that working fine** Providing a minimal repro repo.

- **Issue #4905** (2026-05-12): **Dialogs are broken with React Native 0.85.2**
  *Symptoms*: ### Current behaviour When this library is used with React Native 0.85.2, dialogs have a broken visual appearance (in both Android and iOS). The dialog appears at the bottom of the screen, and the darkened background only fills part of the screen:  <img width="270" height="600" alt="Image" src="https://github.com/user-attachments/assets/22234f55-864a-49d1-a9c3-887956289269" />  ### Expected behaviour The expected behavior occurs with React Native 0.84.1:  <img width="270" height="600" alt="Image" src="https://github.com/user-attachments/assets/892b228c-ac73-40f3-8746-3224f2c1cc5e" />  ### How to reproduce? 1. Create a new React Native project: `npx @react-native-community/cli@latest init DialogBugReproducer` 2. Enter the new project directory: `cd DialogBugReproducer` 3. Install react-native-paper: `npm install react-native-paper` 4. If you want to reproduce the bug in iOS as well as Android, run `cd ios`, `pod install`, and `cd ..` 5. Delete all content in App.tsx and replace it with the following code. (This code is copied from [the React Native Paper docs](https://oss.callstack.com/react-native-paper/docs/components/Dialog/#usage), except I have renamed `MyComponent` to `App` and added a `marginTop` to the button to prevent it from displaying underneath the status bar.) ```js // Code is from https://oss.callstack.com/react-native-paper/docs/components/Dialog/#usage // with minor changes described above.  import * as React from 'react'; import { View } from 'react-native'; 
  **Post-Mortem & Fix Analysis**:
  > `StyleSheet.absoluteFillObject` has been deprecated in latest version of react native. `StyleSheet.absoluteFill` should fix it. 
  > Replace `StyleSheet.absoluteFillObject` with `StyleSheet.absoluteFill` in paper src and lib.  If you are in windows, the following `powershell` cmd will help you find the related files:  ```ps1 Get-ChildItem -Path "node_modules/react-native-paper/lib","node_modules/react-native-paper/src" `     -Recurse -Include "*.js","*.tsx" |     Select-String -Pattern "absoluteFillObject" -List |     ForEach-Object { $_.Path } ```   And save the following script into a `ps1` file in the root of your project, exec this file will replace all `StyleSheet.absoluteFillObject` with `StyleSheet.absoluteFill`, and then the bug will be fixed.  ```ps1 Get-ChildItem -Path "node_modules/react-native-paper/lib","node_modules/react-native-paper/src" `     -Recurse -Include "*.js","*.tsx" |     ForEach-Object {         $content = Get-Content $_.FullName -Raw         if ($content -match 'absoluteFillObject') {             $content -replace 'absoluteFillObject', 'absoluteFill' |                 Set-Content $_.FullN
  > same for me. any updates?

- **Issue #4889** (2026-04-15): **Support React Native 0.85**
  *Symptoms*: ### Current behaviour Buttons with loading = true showing double spinners because React Native deprecated absoluteFillObject  ### Expected behaviour 1 spinner instead of two  ### How to reproduce? Upgrade to RN 0.85
  **Post-Mortem & Fix Analysis**:
  > paper-provider crashes on react-native version > 0.83 
  > I am getting this error in productional build, expo sdk 55, react native 0.83.4  ![Image](https://github.com/user-attachments/assets/21941f03-34b9-4a61-8012-b473b43ec1b2)
  > @SergiOnGit  I suspect this is possibly affected by https://github.com/expo/expo/issues/44487 as pinning to expo `55.0.9` resolves the issue, but any version after this throws the error.  _Update - The ticket has since been closed however, I'm still running into the same problem even after upgrading. Pinning to `55.0.9` is still my workaround until I find a solution. If I do find a solution, I'll report back._  Solution - After updating all expo dependencies to their current version, what ended up fixing it for my build was editing the `babel.config.js` to remove the `react-native-paper/babel` plugin despite contracting the [docs](https://oss.callstack.com/react-native-paper/docs/guides/getting-started#bundle-size-optimization). Hopefully that helps.

- **Issue #4878** (2026-06-03): **Outlined TextInput label background visible through Modal backdrop, transparent background causes outline strikethrough**
  *Symptoms*: ### Current behaviour  Outlined `TextInput` renders correctly under normal conditions, the label background matches the page and everything looks fine. The issue only occurs when the TextInput is visible behind a semi-transparent overlay, such as a `Modal` backdrop.  When a `Modal` opens over a screen containing outlined TextInputs, the label's opaque background rectangle is visible through the darkened backdrop, since the label background color does not update to account for the overlay. This makes the label look like it was struck through.   Attempting to fix this by setting the background to `'transparent'` does not work: - Setting `backgroundColor: 'transparent'` in the `style` prop causes the label to fall back to `theme.colors.background` (see code reference below), so the opaque rectangle remains — the outline border also strikes through the label text - Setting `theme.colors.background` to `'transparent'` removes the opaque rectangle, but the outline border still renders through the label text as a strikethrough, since there is no surface behind the label to mask the outline gap  ### Expected behaviour  When the label background is set to `'transparent'`, the outline gap behind the label text should still be clipped/masked so the border does not strike through the label. This would allow the TextInput to look correct both normally and behind overlays.  Alternatively, the label background color could be independently configurable from the input background, so it can be

- **Issue #4847** (2026-01-24): **The Provider disables all interactivity on Android**
  *Symptoms*: ### Current behaviour I use Provider in my application's App.tsx, which allows me to render my BottomSheetModal in the project root.  This only happens on Android 15; no issues found on iOS.  ### How to reproduce? Place a Provider in the project root, then have a Portal with a BottomSheetModal as its child. Launch an Android 15 emulator and none of the buttons will work, nor will the input field.  ### Your Environment  | software                      | version | --------------------- | ------- | android                        | 15 | react-native                | 0.81.5 | react-native-paper    | ^5.14.5 | node                            | 20.20.0 | expo sdk                     | 54

- **Issue #4838** (2026-03-12): **Weird display of ActivityIndicator**
  *Symptoms*: ### Current behaviour  https://github.com/user-attachments/assets/8505ab48-9dcc-4996-8a77-696952fb106a  ### Expected behaviour The ActivityIndicator is not correctly displayed  ### How to reproduce? ```typescript     <ActivityIndicator color={colors.activeColor} size={50} /> ```  ### Your Environment  | software                      | version | --------------------- | ------- | ios                                | 26 | android                        | x | react-native                | 0.78.3 | react-native-paper    | ^5.8.0 | node                            | 24.1.0 | npm or yarn                | 1.22.19 | expo sdk                     | x.x.x
  **Post-Mortem & Fix Analysis**:
  > @ArnaudFeelbat Could you provide more details (share your theme and settings or add an example app)? I wasn't able to reproduce your case.
  > Hello @ArnaudFeelbat , can you please share a reproducible demo or at least the configuration + screen/component code so we can investigate the issue ? Thanks.
  > Hey! Thanks for opening the issue. Can you provide a minimal repro which demonstrates the issue? Posting a snippet of your code in the issue is useful, but it's not usually straightforward to run. A repro will help us debug the issue faster. Please try to keep the repro as small as possible. The easiest way to provide a repro is on [snack.expo.dev](https://snack.expo.dev). If it's not possible to repro it on [snack.expo.dev](https://snack.expo.dev), then you can also provide the repro in a GitHub repository.

- **Issue #4835** (2025-11-25): **The documentation website is not working**
  *Symptoms*: ### Current behaviour When I access the website, it doesn't work; an error message appears.  ### Expected behaviour I expected the website to load correctly.  ### How to reproduce? The error can currently be reproduced by going to "https://oss.callstack.com/react-native-paper"  ### Preview  <img width="1036" height="662" alt="Image" src="https://github.com/user-attachments/assets/4710182e-3e73-4ab9-8538-c5188c19775d" />  ### What have you tried so far? I've tried accessing it from another browser, clearing the website cache, and changing internet providers, but the result was always the same; nothing worked.
  **Post-Mortem & Fix Analysis**:
  > Having the same issue. Is Callstack "killing" this project? No releases since May 20 and here we have a redirect issue with the main website
  > https://react-native-paper.netlify.app/ Thanks @mensonones for hosting it
  > Hey, Guys! Official website doc working...  https://oss.callstack.com/react-native-paper  Please, close issue! :D

- **Issue #4834** (2025-11-30): **Can't open React Native Paper docs website**
  *Symptoms*: ### Current behaviour When I try to open the docs of React Native Paper, I get "Too many redirects" error  ### Expected behaviour Docs website is accessible  ### How to reproduce? Go to https://oss.callstack.com/react-native-paper  ### Preview <img width="1393" height="952" alt="Image" src="https://github.com/user-attachments/assets/7058ee2a-053c-474c-b5ff-33cc0133e5a9" />  ### What have you tried so far? I tried deleting the cookies for callstack website, but it didn't work. I also tried accessing the documentation from different browsers + from my mobile device from my hotspot internet, but none of this worked
  **Post-Mortem & Fix Analysis**:
  > the same isssue   <img width="988" height="591" alt="Image" src="https://github.com/user-attachments/assets/731193a8-e885-4a17-a3ce-d8c16de59657" />
  > Can't offer a fix for the site, but there's a way to access the docs locally.  1. `git clone https://github.com/callstack/react-native-paper.git` 2. `cd react-native-paper` 3. `npm run docs` 4. `cd docs` 5. `npm run start`  Should give you locally hosted docs for you to refer to.
  > the same isssue 

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

### Incident Patch 1: `4ffc20ae` (2026-09-29)
**Commit Message**: ci: build and upload example app (#5131)

**File**: `.github/workflows/build-example-apps.yml` (added, +149/-0)
```diff
@@ -0,0 +1,149 @@
+name: Build example apps
+
+on:
+  push:
+    branches:
+      - main
+    paths:
+      - '**'
+      - '!docs/**'
+      - '!**/*.md'
+      - '!**/__tests__/**'
+      - '!jest/**'
+      - '!.github/workflows/**'
+      - '.github/workflows/build-example-apps.yml'
+  pull_request:
+    paths:
+      - '**'
+      - '!docs/**'
+      - '!**/*.md'
+      - '!**/__tests__/**'
+      - '!jest/**'
+      - '!.github/workflows/**'
+      - '.github/workflows/build-example-apps.yml'
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
+
+jobs:
+  build-android:
+    name: Build Android
+    runs-on: ubuntu-latest
+    timeout-minutes: 60
+    steps:
+      - name: Checkout
+        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
+
+      - name: Setup
+        uses: ./.github/actions/setup
+
+      - name: Calculate fingerprint
+        id: fingerprint
+        working-directory: example
+        run: |
+          fingerprint=$(yarn expo-updates fingerprint:generate --platform android | jq -er .hash)
+          echo "fingerprint=$fingerprint" >> "$GITHUB_OUTPUT"
+
+      - name: Cache release build
+        id: cache
+        uses: actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
+        with:
+          path: react-native-paper-example.apk
+          key: android-${{ steps.fingerprint.outputs.fingerprint }}-${{ hashFiles('.github/workflows/build-example-apps.yml') }}
+
+      - name: Setup JDK
+        uses: actions/setup-java@de7274f081f381c8f8158605e0321c36c376e2e6 # v6.0.1
+        with:
+          distribution: temurin
+          java-version: 17
+
+      - name: Build Android app
+        if: steps.cache.outputs.cache-hit != 'true'
+        working-directory: example
+        run: |
+          yarn expo prebuild --platform android --no-install
+          cd android
+          ./gradlew :app:assembleRelease -Dorg.gradle.jvmargs=-XX:MaxMetaspaceSize=1g -PreactNativeArchitectures=arm64-v8a,x86_64
+          mv app/build/outputs/apk/release/app-release.apk ../../react-native-paper-example.apk
+
+      - name: Repack cached build
+        if: steps.cache.outputs.cache-hit == 'true'
+        working-directory: example
+        run: |
+          yarn dlx @expo/repack-app@0.10.3 \
+            --platform android \
+            --source-app ../react-native-paper-example.apk \
+            --output ../react-native-paper-example.apk
+
+      - name: Upload APK
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
+        with:
+          path: react-native-paper-example.apk
+          archive: false
+          retention-days: 30
+
+  build-ios:
+    name: Build iOS
+    runs-on: macos-latest
+    timeout-minutes: 60
+    steps:
+      - name: Checkout
+        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
+
+      - name: Setup
+        uses: ./.github/actions/setup
+
+      - name: Calculate fingerprint
+        id: fingerprint
+        working-directory: example
+        run: |
+          fingerprint=$(yarn expo-updates fingerprint:generate --platform ios | jq -er .hash)
+          echo "fingerprint=$fingerprint" >> "$GITHUB_OUTPUT"
+
+      - name: Cache release build
+        id: cache
+        uses: actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
+        with:
+          path: react-native-paper-example.app
+          key: ios-${{ steps.fingerprint.outputs.fingerprint }}-${{ hashFiles('.github/workflows/build-example-apps.yml') }}
+
+      - name: Build iOS app
+        if: steps.cache.outputs.cache-hit != 'true'
+        working-directory: example
+        run: |
+          yarn expo prebuild --platform ios --no-install
+          cd ios
+          pod install
+          xcodebuild build \
+            -workspace ReactNativePaperExample.xcworkspace \
+            -scheme ReactNativePaperExample \
+            -configuration Release \
+            -destination 'generic/platform=iOS Simulator' \
+            -derivedDataPath build \
+            ARCHS=arm64
+          mv build/Build/Products/Release-iphonesimulator/ReactNativePaperExample.app ../../react-native-paper-example.app
+
+      - name: Repack cached build
+        if: steps.cache.outputs.cache-hit == 'true'
+        working-directory: example
+        run: |
+          mv ../react-native-paper-example.app "$RUNNER_TEMP/cached.app"
+          yarn dlx @expo/repack-app@0.10.3 \
+            --platform ios \
+            --source-app "$RUNNER_TEMP/cached.app" \
+            --output ../react-native-paper-example.app
+
+      - name: Archive app
+        run: ditto -c -k --keepParent react-native-paper-example.app react-native-paper-example.app.zip
+
+      - name: Upload app
+        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
+        with:
+     
```

---

### Incident Patch 2: `4201235a` (2026-09-28)
**Commit Message**: fix(modal): make Modal accessible (#5125)

Co-authored-by: Konstantin Marushchak <[REDACTED_EMAIL]>
Co-authored-by: Satyajit Sahoo <[REDACTED_EMAIL]>

**File**: `docs/6.x/docs/guides/migration.md` (modified, +55/-1)
```diff
@@ -195,9 +195,35 @@ e.g.:
 </Modal>
 ```
 
+The modal content now has the `dialog` role, so it needs an accessible name. You can provide one with the new `aria-label` prop:
+
+```diff
+-<Modal visible={visible} onDismiss={hideModal}>
++<Modal visible={visible} onDismiss={hideModal} aria-label="Example modal">
+   <Text>Content</Text>
+ </Modal>
+```
+
+The overlay behind the content is now hidden from assistive technology. Instead, when the modal is `dismissable`, screen reader users can dismiss it with a visually hidden button inside the dialog.
+
+The `overlayAccessibilityLabel` prop was renamed to `dismissAccessibilityLabel`, which is used for the button's accessibility label:
+
+```diff
+<Modal
+  visible={visible}
+  onDismiss={hideModal}
+- overlayAccessibilityLabel="Close"
++ dismissAccessibilityLabel="Close"
+>
+  <Text>Content</Text>
+</Modal>
+```
+
+Previously, the Android back button dismissed the modal when `dismissable` was `true`, even if `dismissableBackButton` was `false`. The `dismissableBackButton` prop can now prevent the modal from being dismissed via the back button independently of the `dismissable` prop.
+
 ### Dialog
 
-`Dialog` now uses a `Modal` internally and doesn't require an explicit `Portal` wrapper. So you need to remove any existing `Portal` wrappers around `Dialog`:
+`Dialog` now uses a `Portal` internally and doesn't require an explicit `Portal` wrapper. So you need to remove any existing `Portal` wrappers around `Dialog`:
 
 ```diff
 -<Portal>
@@ -210,9 +236,37 @@ e.g.:
 +</Dialog>
 ```
 
+The dialog now has the `dialog` role. On web, the dialog's accessible name is set automatically by `Dialog.Title`. You can specify a different name with the new `aria-label` prop, e.g. when the dialog has no title:
+
+```jsx
+<Dialog visible={visible} onDismiss={hideDialog} aria-label="Delete file">
+  <Dialog.Content>
+    <Text>Are you sure?</Text>
+  </Dialog.Content>
+</Dialog>
+```
+
+When the dialog is `dismissable`, screen reader users can dismiss it with a visually hidden button inside the dialog. You can change the button's accessibility label with the new `dismissAccessibilityLabel` prop.
+
 - The default elevation changed from level `1` to level `3`.
 - The `style` prop no longer configures the background color or border radius. You can override `theme.colors.surfaceContainerHigh` and `theme.shapes.corner.extraLarge` using the `theme` prop instead.
 
+### Menu
+
+The `overlayAccessibilityLabel` prop was renamed to `dismissAccessibilityLabel`:
+
+```diff
+<Menu
+  visible={visible}
+  onDismiss={closeMenu}
+  anchor={anchor}
+- overlayAccessibilityLabel="Close"
++ dismissAccessibilityLabel="Close"
+>
+  <Menu.Item title="Item" />
+</Menu>
+```
+
 ### Searchbar
 
 The misspelled `traileringIcon` props have been renamed:
```

**File**: `example/src/Examples/DialogExample.tsx` (modified, +14/-0)
```diff
@@ -10,6 +10,7 @@ import {
   DialogWithLoadingIndicator,
   DialogWithLongText,
   DialogWithRadioBtns,
+  DialogWithUndismissableBackButton,
   UndismissableDialog,
 } from './Dialogs';
 import ScreenWrapper from '../ScreenWrapper';
@@ -79,6 +80,15 @@ const DialogExample = () => {
           Dismissable back button
         </Button>
       )}
+      {Platform.OS === 'android' && (
+        <Button
+          mode="outlined"
+          onPress={_toggleDialog('dialog8')}
+          style={styles.button}
+        >
+          Undismissable back button
+        </Button>
+      )}
       <DialogWithLongText
         visible={_getVisible('dialog1')}
         close={_toggleDialog('dialog1')}
@@ -107,6 +117,10 @@ const DialogExample = () => {
         visible={_getVisible('dialog7')}
         close={_toggleDialog('dialog7')}
       />
+      <DialogWithUndismissableBackButton
+        visible={_getVisible('dialog8')}
+        close={_toggleDialog('dialog8')}
+      />
     </ScreenWrapper>
   );
 };
```

**File**: `example/src/Examples/Dialogs/DialogWithUndismissableBackButton.tsx` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import { Button, Dialog, Palette } from 'react-native-paper';
+
+import { TextComponent } from './DialogTextComponent';
+
+const DialogWithUndismissableBackButton = ({
+  visible,
+  close,
+}: {
+  visible: boolean;
+  close: () => void;
+}) => (
+  <Dialog onDismiss={close} visible={visible} dismissableBackButton={false}>
+    <Dialog.Title>Alert</Dialog.Title>
+    <Dialog.Content>
+      <TextComponent>
+        This dialog can be dismissed by tapping outside, however the hardware
+        back button will not close it!
+      </TextComponent>
+    </Dialog.Content>
+    <Dialog.Actions>
+      <Button textColor={Palette.tertiary50} disabled>
+        Disagree
+      </Button>
+      <Button onPress={close}>Agree</Button>
+    </Dialog.Actions>
+  </Dialog>
+);
+
+export default DialogWithUndismissableBackButton;
```

**File**: `example/src/Examples/Dialogs/index.tsx` (modified, +1/-0)
```diff
@@ -5,3 +5,4 @@ export { default as DialogWithRadioBtns } from './DialogWithRadioBtns';
 export { default as UndismissableDialog } from './UndismissableDialog';
 export { default as DialogWithIcon } from './DialogWithIcon';
 export { default as DialogWithDismissableBackButton } from './DialogWithDismissableBackButton';
+export { default as DialogWithUndismissableBackButton } from './DialogWithUndismissableBackButton';
```

**File**: `src/components/Dialog/Dialog.tsx` (modified, +28/-10)
```diff
@@ -13,6 +13,7 @@ import { useInternalTheme } from '../../core/theming';
 import type { Elevation, ThemeProp } from '../../theme/types';
 import Modal from '../Modal';
 import type { SurfaceStyle } from '../Surface';
+import { DialogTitleIdContext } from './utils';
 import type { DialogChildProps } from './utils';
 
 export type Props = {
@@ -28,6 +29,14 @@ export type Props = {
    * Callback that is called when the user dismisses the dialog.
    */
   onDismiss?: () => void;
+  /**
+   * Accessibility label for dismissing the dialog if it's `dismissable`.
+   */
+  dismissAccessibilityLabel?: string;
+  /**
+   * Accessible name for the dialog. On web, defaults to the text of `Dialog.Title`.
+   */
+  'aria-label'?: string;
   /**
    * Determines Whether the dialog is visible.
    */
@@ -95,6 +104,8 @@ const Dialog = ({
   dismissable = true,
   dismissableBackButton = dismissable,
   onDismiss,
+  dismissAccessibilityLabel,
+  'aria-label': ariaLabel,
   visible = false,
   style,
   theme: themeOverrides,
@@ -108,11 +119,16 @@ const Dialog = ({
 
   const backgroundColor = theme.colors.surfaceContainerHigh;
 
+  const titleId = React.useId();
+
   return (
     <Modal
+      aria-label={ariaLabel}
+      aria-labelledby={ariaLabel == null ? titleId : undefined}
       dismissable={dismissable}
       dismissableBackButton={dismissableBackButton}
       onDismiss={onDismiss}
+      dismissAccessibilityLabel={dismissAccessibilityLabel}
       visible={visible}
       contentBackgroundColor={backgroundColor}
       contentBorderRadius={borderRadius}
@@ -128,17 +144,19 @@ const Dialog = ({
       testID={testID}
       overlayTestID={overlayTestID}
     >
-      {React.Children.toArray(children)
-        .filter((child) => child != null && typeof child !== 'boolean')
-        .map((child, i) => {
-          if (i === 0 && React.isValidElement<DialogChildProps>(child)) {
-            return React.cloneElement(child, {
-              style: [{ marginTop: 24 }, child.props.style],
-            });
-          }
+      <DialogTitleIdContext.Provider value={titleId}>
+        {React.Children.toArray(children)
+          .filter((child) => child != null && typeof child !== 'boolean')
+          .map((child, i) => {
+            if (i === 0 && React.isValidElement<DialogChildProps>(child)) {
+              return React.cloneElement(child, {
+                style: [{ marginTop: 24 }, child.props.style],
+              });
+            }
 
-          return child;
-        })}
+            return child;
+          })}
+      </DialogTitleIdContext.Provider>
     </Modal>
   );
 };
```

**File**: `src/components/Dialog/DialogTitle.tsx` (modified, +4/-0)
```diff
@@ -2,6 +2,7 @@ import * as React from 'react';
 import { StyleSheet } from 'react-native';
 import type { StyleProp, TextStyle } from 'react-native';
 
+import { DialogTitleIdContext } from './utils';
 import { useInternalTheme } from '../../core/theming';
 import type { ThemeProp } from '../../theme/types';
 import Text from '../Typography/Text';
@@ -48,10 +49,12 @@ const DialogTitle = ({
   children,
   theme: themeOverrides,
   style,
+  nativeID,
   ...rest
 }: Props) => {
   const theme = useInternalTheme(themeOverrides);
   const { colors, fonts } = theme;
+  const titleId = React.useContext(DialogTitleIdContext);
 
   const headerTextStyle = {
     color: colors.onSurface,
@@ -62,6 +65,7 @@ const DialogTitle = ({
     <Text
       variant="headlineSmall"
       role="heading"
+      nativeID={titleId ?? nativeID}
       style={[styles.text, styles.v3Text, headerTextStyle, style]}
       {...rest}
     >
```

**File**: `src/components/Dialog/utils.ts` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
+import * as React from 'react';
 import type { StyleProp, ViewStyle } from 'react-native';
 
+export const DialogTitleIdContext = React.createContext<string | undefined>(
+  undefined
+);
+
 export type DialogChildProps = {
   style?: StyleProp<ViewStyle>;
 };
```

**File**: `src/components/Menu/Menu.tsx` (modified, +3/-3)
```diff
@@ -67,7 +67,7 @@ export type Props = {
   /**
    * Accessibility label for the overlay. This is read by the screen reader when the user taps outside the menu.
    */
-  overlayAccessibilityLabel?: string;
+  dismissAccessibilityLabel?: string;
   /**
    * testID for the overlay that is displayed behind the menu.
    */
@@ -189,7 +189,7 @@ const isCoordinate = (anchor: any): anchor is { x: number; y: number } =>
 const Menu = ({
   visible,
   statusBarHeight,
-  overlayAccessibilityLabel = 'Close menu',
+  dismissAccessibilityLabel = 'Close menu',
   overlayTestID,
   testID,
   anchor,
@@ -681,7 +681,7 @@ const Menu = ({
       {rendered ? (
         <Portal>
           <Pressable
-            aria-label={overlayAccessibilityLabel}
+            aria-label={dismissAccessibilityLabel}
             role="button"
             onPress={onDismiss}
             pointerEvents={visible ? 'auto' : 'none'}
```

---

### Incident Patch 3: `84529e06` (2026-09-16)
**Commit Message**: fix(portal): forward the reduce motion preference and match queued update keys (#5124)

**File**: `src/components/Portal/Portal.tsx` (modified, +7/-3)
```diff
@@ -8,6 +8,7 @@ import {
   Provider as SettingsProvider,
 } from '../../core/settings';
 import { ThemeProvider, useInternalTheme } from '../../core/theming';
+import { ReduceMotionContext } from '../../theme/accessibility/ReduceMotionContext';
 import type { ThemeProp } from '../../theme/types';
 
 export type Props = {
@@ -46,13 +47,16 @@ const Portal = ({ children, theme: themeOverrides }: Props) => {
   const { direction } = useLocale();
   const settings = React.useContext(SettingsContext);
   const manager = React.useContext(PortalContext);
+  const reduceMotion = React.useContext(ReduceMotionContext);
 
   return (
     <PortalConsumer manager={manager}>
       <SettingsProvider value={settings}>
-        <LocaleProvider direction={direction}>
-          <ThemeProvider theme={theme}>{children}</ThemeProvider>
-        </LocaleProvider>
+        <ReduceMotionContext.Provider value={reduceMotion}>
+          <LocaleProvider direction={direction}>
+            <ThemeProvider theme={theme}>{children}</ThemeProvider>
+          </LocaleProvider>
+        </ReduceMotionContext.Provider>
       </SettingsProvider>
     </PortalConsumer>
   );
```

**File**: `src/components/Portal/PortalHost.tsx` (modified, +3/-1)
```diff
@@ -92,7 +92,9 @@ export default class PortalHost extends React.Component<Props> {
     } else {
       const op: Operation = { type: 'mount', key, children };
       const index = this.queue.findIndex(
-        (o) => o.type === 'mount' || (o.type === 'update' && o.key === key)
+        (o) =>
+          (o.type === 'mount' && o.key === key) ||
+          (o.type === 'update' && o.key === key)
       );
 
       if (index > -1) {
```

**File**: `src/components/__tests__/Portal.test.tsx` (modified, +18/-0)
```diff
@@ -3,8 +3,10 @@ import { Text } from 'react-native';
 import { expect, it, jest } from '@jest/globals';
 
 import { LocaleProvider, useLocale } from '../../core/locale';
+import PaperProvider from '../../core/PaperProvider';
 import { useInternalTheme } from '../../core/theming';
 import { render, screen } from '../../test-utils';
+import { useReduceMotion } from '../../theme/accessibility/ReduceMotionContext';
 import Dialog from '../Dialog/Dialog';
 import Modal from '../Modal';
 import Portal from '../Portal/Portal';
@@ -60,6 +62,22 @@ it('passes local theme overrides and locale to portal content and updates them',
   expect(screen.queryByText('2 rtl')).not.toBeOnTheScreen();
 });
 
+const PortalReduceMotionContent = () => (
+  <Text>{`reduce motion: ${useReduceMotion()}`}</Text>
+);
+
+it('passes the reduce motion preference to portal content', async () => {
+  await render(
+    <PaperProvider reduceMotion="on">
+      <Portal>
+        <PortalReduceMotionContent />
+      </Portal>
+    </PaperProvider>
+  );
+
+  expect(await screen.findByText('reduce motion: true')).toBeOnTheScreen();
+});
+
 it('renders portals in source order when mounted in the same commit', async () => {
   await render(
     <Portal.Host>
```

---

### Incident Patch 4: `a74781ed` (2026-09-16)
**Commit Message**: ci: fix pull request check workflow permissions

**File**: `.github/workflows/pull-request-checks.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ on:
 
 permissions:
   issues: write
-  pull-requests: read
+  pull-requests: write
 
 concurrency:
   group: pull-request-checks-${{ github.event.pull_request.number }}
```

---

### Incident Patch 5: `31d8c58e` (2026-09-11)
**Commit Message**: fix: rename misspelled props and various typos (#5117)

**File**: `docs/6.x/docs/guides/fonts.md` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ Older Material Design 2 platform-split font configuration (`configureFonts` with
 In the latest version fonts in theme are structured based on the `variant` keys e.g. `displayLarge` or `bodyMedium` which are then used in `Text`'s component throughout the whole library.
 
 :::info
-The default `fontFamily` is different per particular platfrom:
+The default `fontFamily` is different per particular platform:
 
 ```js
 Platform.select({
```

**File**: `docs/6.x/docs/guides/migration.md` (modified, +22/-0)
```diff
@@ -188,6 +188,28 @@ e.g.:
 - The default elevation changed from level `1` to level `3`.
 - The `style` prop no longer configures the background color or border radius. You can override `theme.colors.surfaceContainerHigh` and `theme.shapes.corner.extraLarge` using the `theme` prop instead.
 
+### Searchbar
+
+The misspelled `traileringIcon` props have been renamed:
+
+- **`traileringIcon`** → **`trailingIcon`**
+- **`traileringIconColor`** → **`trailingIconColor`**
+- **`traileringIconAccessibilityLabel`** → **`trailingIconAccessibilityLabel`**
+- **`onTraileringIconPress`** → **`onTrailingIconPress`**
+
+```diff
+<Searchbar
+- traileringIcon="microphone"
+- traileringIconColor={colors.onSurfaceVariant}
+- traileringIconAccessibilityLabel="microphone button"
+- onTraileringIconPress={onMicrophonePress}
++ trailingIcon="microphone"
++ trailingIconColor={colors.onSurfaceVariant}
++ trailingIconAccessibilityLabel="microphone button"
++ onTrailingIconPress={onMicrophonePress}
+/>
+```
+
 ### TextInput
 
 The Paper 6.x `TextInput` is a complete rewrite with a new API. Import the component the same way, but note that the props and behavior have changed significantly.
```

**File**: `docs/src/components/ScreenshotTabs.tsx` (modified, +3/-3)
```diff
@@ -16,17 +16,17 @@ const getClassName = (value: string) =>
     : `tabScreenshot${value.includes('full-width') ? 'full-width' : ''}`;
 
 const ScreenshotTabs = ({ screenshotData }: ScreenshotTabsProps) => {
-  const renderScreenhot = (src: string): ReactNode => (
+  const renderScreenshot = (src: string): ReactNode => (
     <img src={withBase(src)} className={getClassName(src)} />
   );
 
   if (typeof screenshotData === 'string') {
-    return renderScreenhot(screenshotData);
+    return renderScreenshot(screenshotData);
   }
 
   const screenshots = Object.entries(screenshotData).map(([key, value]) => (
     <TabItem key={key} value={key} label={key} default>
-      {typeof value === 'string' ? renderScreenhot(value) : null}
+      {typeof value === 'string' ? renderScreenshot(value) : null}
     </TabItem>
   ));
 
```

**File**: `docs/src/data/themeColors.ts` (modified, +2/-2)
```diff
@@ -164,7 +164,7 @@ export const themeColors = {
       'textColor/iconColor': 'theme.colors.onTertiaryContainer',
     },
     surface: {
-      backgroundColor: 'theme.colors.elevarion.level3',
+      backgroundColor: 'theme.colors.elevation.level3',
       'textColor/iconColor': 'theme.colors.primary',
     },
   },
@@ -186,7 +186,7 @@ export const themeColors = {
       'textColor/iconColor': 'theme.colors.onTertiaryContainer',
     },
     surface: {
-      backgroundColor: 'theme.colors.elevarion.level3',
+      backgroundColor: 'theme.colors.elevation.level3',
       'textColor/iconColor': 'theme.colors.primary',
     },
   },
```

**File**: `example/src/Examples/SearchbarExample.tsx` (modified, +17/-17)
```diff
@@ -19,8 +19,8 @@ const SearchExample = () => {
   const [isVisible, setIsVisible] = React.useState(false);
   const [searchQueries, setSearchQuery] = React.useState({
     searchBarMode: '',
-    traileringIcon: '',
-    traileringIconWithRightItem: '',
+    trailingIcon: '',
+    trailingIconWithRightItem: '',
     rightItem: '',
     loadingBarMode: '',
     searchViewMode: '',
@@ -47,36 +47,36 @@ const SearchExample = () => {
             mode="bar"
           />
           <Searchbar
-            placeholder="Trailering icon"
+            placeholder="Trailing icon"
             onChangeText={(query) =>
-              setSearchQuery({ ...searchQueries, traileringIcon: query })
+              setSearchQuery({ ...searchQueries, trailingIcon: query })
             }
-            value={searchQueries.traileringIcon}
-            traileringIcon={'microphone'}
-            traileringIconColor={
+            value={searchQueries.trailingIcon}
+            trailingIcon={'microphone'}
+            trailingIconColor={
               isVisible ? Palette.error40 : colors.onSurfaceVariant
             }
-            traileringIconAccessibilityLabel={'microphone button'}
-            onTraileringIconPress={() => setIsVisible(true)}
+            trailingIconAccessibilityLabel={'microphone button'}
+            onTrailingIconPress={() => setIsVisible(true)}
             style={styles.searchbar}
             mode="bar"
           />
           <Searchbar
             mode="bar"
-            placeholder="Trailering icon with right item"
+            placeholder="Trailing icon with right item"
             onChangeText={(query) =>
               setSearchQuery({
                 ...searchQueries,
-                traileringIconWithRightItem: query,
+                trailingIconWithRightItem: query,
               })
             }
-            value={searchQueries.traileringIconWithRightItem}
-            traileringIcon={'microphone'}
-            traileringIconColor={
+            value={searchQueries.trailingIconWithRightItem}
+            trailingIcon={'microphone'}
+            trailingIconColor={
               isVisible ? Palette.error40 : colors.onSurfaceVariant
             }
-            traileringIconAccessibilityLabel={'microphone button'}
-            onTraileringIconPress={() => setIsVisible(true)}
+            trailingIconAccessibilityLabel={'microphone button'}
+            onTrailingIconPress={() => setIsVisible(true)}
             right={(props) => (
               <Avatar.Image
                 {...props}
@@ -117,7 +117,7 @@ const SearchExample = () => {
             style={styles.searchbar}
             mode="bar"
             loading
-            traileringIcon={'microphone'}
+            trailingIcon={'microphone'}
           />
         </List.Section>
         <List.Section title="View mode">
```

**File**: `src/components/Button/Button.tsx` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ export type Props = Omit<ViewProps, 'style'> & {
    */
   uppercase?: boolean;
   /**
-   * Type of background drawabale to display the feedback (Android).
+   * Type of background drawable to display the feedback (Android).
    * https://reactnative.dev/docs/pressable#rippleconfig
    */
   background?: PressableAndroidRippleConfig;
```

**File**: `src/components/Checkbox/CheckboxItem.tsx` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ export type Props = {
    */
   onLongPress?: (e: GestureResponderEvent) => void;
   /**
-   * Type of background drawabale to display the feedback (Android).
+   * Type of background drawable to display the feedback (Android).
    * https://reactnative.dev/docs/pressable#rippleconfig
    */
   background?: PressableAndroidRippleConfig;
```

**File**: `src/components/Chip/Chip.tsx` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ export type Props = Omit<ViewProps, 'style'> & {
    */
   disabled?: boolean;
   /**
-   * Type of background drawabale to display the feedback (Android).
+   * Type of background drawable to display the feedback (Android).
    * https://reactnative.dev/docs/pressable#rippleconfig
    */
   background?: PressableAndroidRippleConfig;
```

---

### Incident Patch 6: `23b4d3cd` (2026-09-11)
**Commit Message**: fix(portal): replay queued portal operations in order (#5048)

`PortalHost` queues portal operations that arrive before its
`PortalManager` ref is attached, which is every portal that mounts in the
first commit. `componentDidMount` drained that queue with `pop()`,
replaying the operations LIFO, so portals mounted in the same commit were
stacked in reverse source order.

Drain with `shift()` instead.

**File**: `src/components/Portal/PortalHost.tsx` (modified, +3/-1)
```diff
@@ -51,7 +51,9 @@ export default class PortalHost extends React.Component<Props> {
     const queue = this.queue;
 
     while (queue.length && manager) {
-      const action = queue.pop();
+      // Replay in the order the operations were recorded, otherwise portals
+      // that mounted in the same commit end up stacked in reverse.
+      const action = queue.shift();
       if (action) {
         switch (action.type) {
           case 'mount':
```

**File**: `src/components/__tests__/Portal.test.tsx` (modified, +48/-0)
```diff
@@ -5,6 +5,8 @@ import { expect, it, jest } from '@jest/globals';
 import { LocaleProvider, useLocale } from '../../core/locale';
 import { useInternalTheme } from '../../core/theming';
 import { render, screen } from '../../test-utils';
+import Dialog from '../Dialog/Dialog';
+import Modal from '../Modal';
 import Portal from '../Portal/Portal';
 
 jest.useRealTimers();
@@ -57,3 +59,49 @@ it('passes local theme overrides and locale to portal content and updates them',
   expect(screen.getByText('3 ltr')).toBeOnTheScreen();
   expect(screen.queryByText('2 rtl')).not.toBeOnTheScreen();
 });
+
+it('renders portals in source order when mounted in the same commit', async () => {
+  await render(
+    <Portal.Host>
+      <Portal>
+        <Text testID="portal-content">first</Text>
+      </Portal>
+      <Portal>
+        <Text testID="portal-content">second</Text>
+      </Portal>
+      <Portal>
+        <Text testID="portal-content">third</Text>
+      </Portal>
+    </Portal.Host>
+  );
+
+  const portals = await screen.findAllByTestId('portal-content');
+
+  expect(portals).toHaveLength(3);
+  expect(portals[0]).toHaveTextContent('first');
+  expect(portals[1]).toHaveTextContent('second');
+  expect(portals[2]).toHaveTextContent('third');
+});
+
+it('stacks components mounted in the same commit in source order', async () => {
+  await render(
+    <Portal.Host>
+      <Portal>
+        <Modal visible onDismiss={() => {}}>
+          <Text testID="layer">modal</Text>
+        </Modal>
+      </Portal>
+      <Portal>
+        <Dialog visible onDismiss={() => {}}>
+          <Text testID="layer">dialog</Text>
+        </Dialog>
+      </Portal>
+    </Portal.Host>
+  );
+
+  const layers = await screen.findAllByTestId('layer');
+
+  expect(layers).toHaveLength(2);
+  expect(layers[0]).toHaveTextContent('modal');
+  expect(layers[1]).toHaveTextContent('dialog');
+});
```

---

### Incident Patch 7: `46519b07` (2026-09-09)
**Commit Message**: fix: preserve reference for theme if overrides didn't change

**File**: `package.json` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@
   "dependencies": {
     "@callstack/react-theme-provider": "^3.0.9",
     "color": "^3.1.2",
+    "fast-deep-equal": "^3.1.3",
     "use-latest-callback": "^0.2.3"
   },
   "devDependencies": {
```

**File**: `src/components/Card/CardContent.tsx` (modified, +2/-2)
```diff
@@ -43,8 +43,8 @@ export type Props = ViewProps & {
  * ```
  */
 const CardContent = ({ index, total, siblings, style, ...rest }: Props) => {
-  const cover = 'withInternalTheme(CardCover)';
-  const title = 'withInternalTheme(CardTitle)';
+  const cover = 'Card.Cover';
+  const title = 'Card.Title';
 
   let contentStyle, prev, next;
 
```

**File**: `src/components/Portal/Portal.tsx` (modified, +23/-35)
```diff
@@ -2,13 +2,13 @@ import * as React from 'react';
 
 import PortalConsumer from './PortalConsumer';
 import PortalHost, { PortalContext } from './PortalHost';
-import { LocaleContext, LocaleProvider } from '../../core/locale';
+import { LocaleProvider, useLocale } from '../../core/locale';
 import {
-  Consumer as SettingsConsumer,
+  SettingsContext,
   Provider as SettingsProvider,
 } from '../../core/settings';
-import { ThemeProvider, withInternalTheme } from '../../core/theming';
-import type { InternalTheme } from '../../theme/types';
+import { ThemeProvider, useInternalTheme } from '../../core/theming';
+import type { ThemeProp } from '../../theme/types';
 
 export type Props = {
   /**
@@ -18,7 +18,7 @@ export type Props = {
   /**
    * @optional
    */
-  theme: InternalTheme;
+  theme?: ThemeProp;
 };
 
 /**
@@ -41,36 +41,24 @@ export type Props = {
  * export default MyComponent;
  * ```
  */
-class Portal extends React.Component<Props> {
-  // @component ./PortalHost.tsx
-  static Host = PortalHost;
+const Portal = ({ children, theme: themeOverrides }: Props) => {
+  const theme = useInternalTheme(themeOverrides);
+  const { direction } = useLocale();
+  const settings = React.useContext(SettingsContext);
+  const manager = React.useContext(PortalContext);
 
-  render() {
-    const { children, theme } = this.props;
+  return (
+    <PortalConsumer manager={manager}>
+      <SettingsProvider value={settings}>
+        <LocaleProvider direction={direction}>
+          <ThemeProvider theme={theme}>{children}</ThemeProvider>
+        </LocaleProvider>
+      </SettingsProvider>
+    </PortalConsumer>
+  );
+};
 
-    return (
-      <LocaleContext.Consumer>
-        {(locale) => (
-          <SettingsConsumer>
-            {(settings) => (
-              <PortalContext.Consumer>
-                {(manager) => (
-                  <PortalConsumer manager={manager}>
-                    <SettingsProvider value={settings}>
-                      {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */}
-                      <LocaleProvider direction={locale!.direction}>
-                        <ThemeProvider theme={theme}>{children}</ThemeProvider>
-                      </LocaleProvider>
-                    </SettingsProvider>
-                  </PortalConsumer>
-                )}
-              </PortalContext.Consumer>
-            )}
-          </SettingsConsumer>
-        )}
-      </LocaleContext.Consumer>
-    );
-  }
-}
+// @component ./PortalHost.tsx
+Portal.Host = PortalHost;
 
-export default withInternalTheme(Portal);
+export default Portal;
```

**File**: `src/components/__tests__/Portal.test.tsx` (modified, +36/-0)
```diff
@@ -2,6 +2,8 @@ import { Text } from 'react-native';
 
 import { expect, it, jest } from '@jest/globals';
 
+import { LocaleProvider, useLocale } from '../../core/locale';
+import { useInternalTheme } from '../../core/theming';
 import { render, screen } from '../../test-utils';
 import Portal from '../Portal/Portal';
 
@@ -21,3 +23,37 @@ it('renders portal with siblings', async () => {
 
   expect(toJSON()).toMatchSnapshot();
 });
+
+const PortalThemeContent = () => {
+  const theme = useInternalTheme(undefined);
+  const { direction } = useLocale();
+
+  return <Text>{`${theme.animation.scale} ${direction}`}</Text>;
+};
+
+it('passes local theme overrides and locale to portal content and updates them', async () => {
+  const { rerender } = await render(
+    <Portal.Host>
+      <LocaleProvider direction="rtl">
+        <Portal theme={{ animation: { scale: 2 } }}>
+          <PortalThemeContent />
+        </Portal>
+      </LocaleProvider>
+    </Portal.Host>
+  );
+
+  expect(screen.getByText('2 rtl')).toBeOnTheScreen();
+
+  await rerender(
+    <Portal.Host>
+      <LocaleProvider direction="ltr">
+        <Portal theme={{ animation: { scale: 3 } }}>
+          <PortalThemeContent />
+        </Portal>
+      </LocaleProvider>
+    </Portal.Host>
+  );
+
+  expect(screen.getByText('3 ltr')).toBeOnTheScreen();
+  expect(screen.queryByText('2 rtl')).not.toBeOnTheScreen();
+});
```

**File**: `src/theme/__tests__/provider.test.ts` (modified, +99/-1)
```diff
@@ -1,6 +1,17 @@
+import * as React from 'react';
+import { PlatformColor } from 'react-native';
+
 import { describe, expect, it } from '@jest/globals';
+import { renderHook } from '@testing-library/react-native';
 
-import { isPlatformColorSentinel, safeMerge } from '../provider';
+import {
+  defaultThemes,
+  isPlatformColorSentinel,
+  safeMerge,
+  ThemeProvider,
+  useInternalTheme,
+} from '../provider';
+import type { ThemeProp } from '../types';
 
 describe('isPlatformColorSentinel', () => {
   it('detects iOS PlatformColor (semantic)', () => {
@@ -114,3 +125,90 @@ describe('safeMerge', () => {
     expect(result.colors.tertiary).toBe('#222');
   });
 });
+
+describe('useInternalTheme', () => {
+  it('returns the default theme without overrides', async () => {
+    const { result } = await renderHook(() => useInternalTheme(undefined));
+
+    expect(result.current).toBe(defaultThemes.light);
+  });
+
+  it('keeps the theme reference when nested overrides have equal values', async () => {
+    const { result, rerender } = await renderHook(
+      (overrides: ThemeProp) => useInternalTheme(overrides),
+      { initialProps: { colors: { primary: '#123456' } } }
+    );
+    const theme = result.current;
+
+    await rerender({ colors: { primary: '#123456' } });
+
+    expect(result.current).toBe(theme);
+    expect(result.current.colors.primary).toBe('#123456');
+    expect(result.current.colors.secondary).toBe(
+      defaultThemes.light.colors.secondary
+    );
+  });
+
+  it('updates changed overrides and restores defaults when overrides are removed', async () => {
+    const { result, rerender } = await renderHook(
+      (overrides: ThemeProp | undefined) => useInternalTheme(overrides),
+      { initialProps: { colors: { primary: '#123456', secondary: '#abcdef' } } }
+    );
+    const theme = result.current;
+
+    await rerender({ colors: { primary: '#654321' } });
+
+    expect(result.current).not.toBe(theme);
+    expect(result.current.colors.primary).toBe('#654321');
+    expect(result.current.colors.secondary).toBe(
+      defaultThemes.light.colors.secondary
+    );
+
+    await rerender(undefined);
+
+    expect(result.current).toBe(defaultThemes.light);
+  });
+
+  it('updates the provider theme while keeping local overrides', async () => {
+    let theme = defaultThemes.light;
+    const wrapper = (props: { children: React.ReactNode }) =>
+      React.createElement(ThemeProvider, { ...props, theme });
+    const { result, rerender } = await renderHook(
+      (overrides: ThemeProp) => useInternalTheme(overrides),
+      { wrapper, initialProps: { colors: { primary: '#123456' } } }
+    );
+    const previous = result.current;
+
+    theme = defaultThemes.dark;
+    await rerender({ colors: { primary: '#123456' } });
+
+    expect(result.current).not.toBe(previous);
+    expect(result.current.dark).toBe(true);
+    expect(result.current.colors.primary).toBe('#123456');
+    expect(result.current.colors.secondary).toBe(
+      defaultThemes.dark.colors.secondary
+    );
+  });
+
+  it('preserves platform colors and keeps equal platform color overrides stable', async () => {
+    const primary = PlatformColor('label');
+    const { result, rerender } = await renderHook(
+      (overrides: ThemeProp) => useInternalTheme(overrides),
+      { initialProps: { colors: { primary } } }
+    );
+    const theme = result.current;
+
+    expect(result.current.colors.primary).toBe(primary);
+
+    await rerender({ colors: { primary: PlatformColor('label') } });
+
+    expect(result.current).toBe(theme);
+
+    await rerender({ colors: { primary: PlatformColor('secondaryLabel') } });
+
+    expect(result.current).not.toBe(theme);
+    expect(result.current.colors.primary).toEqual(
+      PlatformColor('secondaryLabel')
+    );
+  });
+});
```

**File**: `src/theme/provider.tsx` (modified, +9/-8)
```diff
@@ -1,8 +1,8 @@
 import * as React from 'react';
-import type { ComponentType } from 'react';
 
 import { createTheming } from '@callstack/react-theme-provider';
 import type { $DeepPartial } from '@callstack/react-theme-provider';
+import isEqual from 'fast-deep-equal';
 
 import { DarkTheme, LightTheme } from './schemes';
 import type { Theme, NavigationTheme } from './types';
@@ -55,21 +55,22 @@ export const safeMerge = <T,>(base: T, overrides: unknown): T => {
 };
 /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
 
-/** Memoize `themeOverrides` at the call site; inline object literals defeat the memo. */
 export const useInternalTheme = (
   themeOverrides: $DeepPartial<Theme> | undefined
 ): Theme => {
   const theme = useThemeBase<Theme>();
+  const [overrides, setOverrides] = React.useState(themeOverrides);
+
+  if (!isEqual(overrides, themeOverrides)) {
+    setOverrides(themeOverrides);
+  }
+
   return React.useMemo(
-    () => (themeOverrides ? safeMerge(theme, themeOverrides) : theme),
-    [theme, themeOverrides]
+    () => (overrides ? safeMerge(theme, overrides) : theme),
+    [theme, overrides]
   );
 };
 
-export const withInternalTheme = <Props extends { theme: Theme }, C>(
-  WrappedComponent: ComponentType<Props & { theme: Theme }> & C
-) => withTheme<Props, C>(WrappedComponent);
-
 export const defaultThemes = {
   light: LightTheme,
   dark: DarkTheme,
```

**File**: `yarn.lock` (modified, +1/-0)
```diff
@@ -18219,6 +18219,7 @@ __metadata:
     eslint: "npm:9.39.4"
     eslint-plugin-flowtype: "npm:^8.0.3"
     eslint-plugin-testing-library: "npm:^7.16.2"
+    fast-deep-equal: "npm:^3.1.3"
     jest: "npm:^29.6.3"
     jest-file-snapshot: "npm:^0.3.2"
     lefthook: "npm:^2.1.9"
```

---

### Incident Patch 8: `941bd4a8` (2026-09-09)
**Commit Message**: fix: support emphasized text variants in TypeScript and correct bold fonts on Android(#5068)

**File**: `docs/6.x/docs/guides/fonts.md` (modified, +23/-1)
```diff
@@ -67,6 +67,13 @@ Platform.select({
 }),
 ```
 
+Material Design 3 typescale uses two font families:
+
+- **Brand**: Display, Headline and Title Large
+- **Plain**: Title Medium/Small, Label and Body
+
+The default theme uses the platform default for both font families.
+
 :::
 
 - #### Display
@@ -291,14 +298,29 @@ Platform.select({
   "fontFamily": "Font",
   "fontSize": 16,
   "fontWeight": "400",
-  "letterSpacing": 0.15,
+  "letterSpacing": 0.5,
   "lineHeight": 24,
 }
 ```
 
   </div>
 </div>
 
+- #### Emphasized
+
+Each variant also has an `Emphasized` counterpart with a heavier font weight: `displayLargeEmphasized`,
+`bodyMediumEmphasized` etc.
+
+```json
+"bodyMediumEmphasized": {
+  "fontFamily": "Font",
+  "fontSize": 14,
+  "fontWeight": "500",
+  "letterSpacing": 0.25,
+  "lineHeight": 20,
+}
+```
+
 :::info
 If any component uses Paper's `Text` component, without specified <b>variant</b>, then `default` variant is applied:
 
```

**File**: `src/components/Typography/Text.tsx` (modified, +3/-0)
```diff
@@ -25,6 +25,9 @@ export type Props<T> = React.ComponentProps<typeof NativeText> & {
    *  Label:  `labelLarge`, `labelMedium`, `labelSmall`
    *
    *  Body: `bodyLarge`, `bodyMedium`, `bodySmall`
+   *
+   *  Each variant also has an `Emphasized` counterpart with a heavier font weight.
+   *  e.g. `displayLargeEmphasized`, `bodyMediumEmphasized` etc.
    */
   variant?: VariantProp<T>;
   children: React.ReactNode;
```

**File**: `src/theme/__tests__/fonts.test.js` (modified, +47/-0)
```diff
@@ -340,6 +340,53 @@ describe('configureFonts', () => {
     });
   });
 
+  it('resolves the Android font families per MD3 family assignment', () => {
+    mockPlatform('android');
+    const { typescale } = loadFonts();
+
+    for (const variant of ['bodyLarge', 'bodyMedium', 'bodySmall']) {
+      expect(typescale[variant]).toMatchObject({
+        fontFamily: 'sans-serif',
+        fontWeight: '400',
+      });
+    }
+
+    for (const variant of [
+      'displayLargeEmphasized',
+      'displayMediumEmphasized',
+      'displaySmallEmphasized',
+      'headlineLargeEmphasized',
+      'headlineMediumEmphasized',
+      'headlineSmallEmphasized',
+      'titleLargeEmphasized',
+    ]) {
+      expect(typescale[variant]).toMatchObject({
+        fontFamily: 'sans-serif-medium',
+        fontWeight: '500',
+      });
+    }
+
+    for (const variant of ['displayLarge', 'headlineLarge', 'titleLarge']) {
+      expect(typescale[variant]).toMatchObject({
+        fontFamily: 'sans-serif',
+        fontWeight: '400',
+      });
+    }
+
+    for (const variant of [
+      'titleMediumEmphasized',
+      'titleSmallEmphasized',
+      'labelLargeEmphasized',
+      'labelMediumEmphasized',
+      'labelSmallEmphasized',
+    ]) {
+      expect(typescale[variant]).toMatchObject({
+        fontFamily: 'sans-serif',
+        fontWeight: '700',
+      });
+    }
+  });
+
   it('applies flat properties to every variant when the config also has per-variant entries', () => {
     mockPlatform('ios');
     const { configureFonts, typescale } = loadFonts();
```

**File**: `src/theme/tokens/ref/typeface.ts` (modified, +12/-0)
```diff
@@ -9,8 +9,18 @@ export const typeface = {
     ios: 'System',
     default: 'sans-serif',
   }),
+  brandMedium: Platform.select({
+    web: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
+    ios: 'System',
+    default: 'sans-serif-medium',
+  }),
   weightRegular: '400',
 
+  plainRegular: Platform.select({
+    web: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
+    ios: 'System',
+    default: 'sans-serif',
+  }),
   plainMedium: Platform.select({
     web: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
     ios: 'System',
@@ -21,7 +31,9 @@ export const typeface = {
   weightBold: '700',
 } satisfies {
   brandRegular?: string;
+  brandMedium?: string;
   weightRegular: Font['fontWeight'];
+  plainRegular?: string;
   plainMedium?: string;
   weightMedium: Font['fontWeight'];
   weightBold: Font['fontWeight'];
```

**File**: `src/theme/tokens/sys/typography.ts` (modified, +48/-42)
```diff
@@ -1,217 +1,223 @@
 import type { Typescale } from '../../types';
 import { typeface } from '../ref/typeface';
 
-const regularType = {
+const brandRegularType = {
   fontFamily: typeface.brandRegular,
   letterSpacing: 0,
   fontWeight: typeface.weightRegular,
 };
 
-const mediumType = {
+const brandMediumType = {
+  fontFamily: typeface.brandMedium,
+  letterSpacing: 0,
+  fontWeight: typeface.weightMedium,
+};
+
+const plainRegularType = {
+  fontFamily: typeface.plainRegular,
+  letterSpacing: 0,
+  fontWeight: typeface.weightRegular,
+};
+
+const plainMediumType = {
   fontFamily: typeface.plainMedium,
   letterSpacing: 0.15,
   fontWeight: typeface.weightMedium,
 };
 
-const emphasizedMediumType = {
+const plainMediumEmphasizedType = {
   fontFamily: typeface.plainMedium,
   letterSpacing: 0,
   fontWeight: typeface.weightMedium,
 };
 
-const emphasizedBoldType = {
-  fontFamily: typeface.plainMedium,
+const plainBoldType = {
+  fontFamily: typeface.plainRegular,
   letterSpacing: 0,
   fontWeight: typeface.weightBold,
 };
 
 /** md.sys.typescale.* */
 export const typescale = {
   displayLarge: {
-    ...regularType,
+    ...brandRegularType,
     letterSpacing: -0.25,
     lineHeight: 64,
     fontSize: 57,
   },
   displayMedium: {
-    ...regularType,
+    ...brandRegularType,
     lineHeight: 52,
     fontSize: 45,
   },
   displaySmall: {
-    ...regularType,
+    ...brandRegularType,
     lineHeight: 44,
     fontSize: 36,
   },
 
   headlineLarge: {
-    ...regularType,
+    ...brandRegularType,
     lineHeight: 40,
     fontSize: 32,
   },
   headlineMedium: {
-    ...regularType,
+    ...brandRegularType,
     lineHeight: 36,
     fontSize: 28,
   },
   headlineSmall: {
-    ...regularType,
+    ...brandRegularType,
     lineHeight: 32,
     fontSize: 24,
   },
 
   titleLarge: {
-    ...regularType,
+    ...brandRegularType,
     lineHeight: 28,
     fontSize: 22,
   },
   titleMedium: {
-    ...mediumType,
+    ...plainMediumType,
     lineHeight: 24,
     fontSize: 16,
   },
   titleSmall: {
-    ...mediumType,
+    ...plainMediumType,
     letterSpacing: 0.1,
     lineHeight: 20,
     fontSize: 14,
   },
 
   labelLarge: {
-    ...mediumType,
+    ...plainMediumType,
     letterSpacing: 0.1,
     lineHeight: 20,
     fontSize: 14,
   },
   labelMedium: {
-    ...mediumType,
+    ...plainMediumType,
     letterSpacing: 0.5,
     lineHeight: 16,
     fontSize: 12,
   },
   labelSmall: {
-    ...mediumType,
+    ...plainMediumType,
     letterSpacing: 0.5,
     lineHeight: 16,
     fontSize: 11,
   },
 
   bodyLarge: {
-    ...mediumType,
-    fontWeight: typeface.weightRegular,
-    fontFamily: typeface.brandRegular,
+    ...plainRegularType,
     letterSpacing: 0.5,
     lineHeight: 24,
     fontSize: 16,
   },
   bodyMedium: {
-    ...mediumType,
-    fontWeight: typeface.weightRegular,
-    fontFamily: typeface.brandRegular,
+    ...plainRegularType,
     letterSpacing: 0.25,
     lineHeight: 20,
     fontSize: 14,
   },
   bodySmall: {
-    ...mediumType,
-    fontWeight: typeface.weightRegular,
-    fontFamily: typeface.brandRegular,
+    ...plainRegularType,
     letterSpacing: 0.4,
     lineHeight: 16,
     fontSize: 12,
   },
 
   displayLargeEmphasized: {
-    ...emphasizedMediumType,
+    ...brandMediumType,
     letterSpacing: -0.25,
     lineHeight: 64,
     fontSize: 57,
   },
   displayMediumEmphasized: {
-    ...emphasizedMediumType,
+    ...brandMediumType,
     lineHeight: 52,
     fontSize: 45,
   },
   displaySmallEmphasized: {
-    ...emphasizedMediumType,
+    ...brandMediumType,
     lineHeight: 44,
     fontSize: 36,
   },
 
   headlineLargeEmphasized: {
-    ...emphasizedMediumType,
+    ...brandMediumType,
     lineHeight: 40,
     fontSize: 32,
   },
   headlineMediumEmphasized: {
-    ...emphasizedMediumType,
+    ...brandMediumType,
     lineHeight: 36,
     fontSize: 28,
   },
   headlineSmallEmphasized: {
-    ...emphasizedMediumType,
+    ...brandMediumType,
     lineHeight: 32,
     fontSize: 24,
   },
 
   titleLargeEmphasized: {
-    ...emphasizedMediumType,
+    ...brandMediumType,
     lineHeight: 28,
     fontSize: 22,
   },
   titleMediumEmphasized: {
-    ...emphasizedBoldType,
+    ...plainBoldType,
     letterSpacing: 0.15,
     lineHeight: 24,
     fontSize: 16,
   },
   titleSmallEmphasized: {
-    ...emphasizedBoldType,
+    ...plainBoldType,
     letterSpacing: 0.1,
     lineHeight: 20,
     fontSize: 14,
   },
 
   labelLargeEmphasized: {
-    ...emphasizedBoldType,
+    ...plainBoldType,
     letterSpacing: 0.1,
     lineHeight: 20,
     fontSize: 14,
   },
   labelMediumEmphasized: {
-    ...emphasizedBoldType,
+    ...plainBoldType,
     letterSpacing: 0.5,
     lineHeight: 16,
     fontSize: 12,
   },
   labelSmallEmphasized: {
-    ...emphasizedBoldType,
+    ...plainBoldType,
     letterSpacing: 0.5,
     lineHeight: 16,
     fontSize: 11,
   },
 
   bodyLargeEmphasized: {
-    ...emphasizedMediumType,
+    ...plainMediumEmphasizedType,

```

**File**: `src/theme/types/typography.ts` (modified, +16/-1)
```diff
@@ -37,7 +37,22 @@ export type TypescaleKey =
   | 'labelSmall'
   | 'bodyLarge'
   | 'bodyMedium'
-  | 'bodySmall';
+  | 'bodySmall'
+  | 'displayLargeEmphasized'
+  | 'displayMediumEmphasized'
+  | 'displaySmallEmphasized'
+  | 'headlineLargeEmphasized'
+  | 'headlineMediumEmphasized'
+  | 'headlineSmallEmphasized'
+  | 'titleLargeEmphasized'
+  | 'titleMediumEmphasized'
+  | 'titleSmallEmphasized'
+  | 'labelLargeEmphasized'
+  | 'labelMediumEmphasized'
+  | 'labelSmallEmphasized'
+  | 'bodyLargeEmphasized'
+  | 'bodyMediumEmphasized'
+  | 'bodySmallEmphasized';
 
 export type TypescaleStyle = {
   fontFamily: string;
```

---

### Incident Patch 9: `cbcd52f7` (2026-09-07)
**Commit Message**: fix: remove hardcoded default testIDs from components (#5088)

**File**: `docs/6.x/docs/guides/migration.md` (modified, +55/-6)
```diff
@@ -71,12 +71,61 @@ You can use the component's color prop where available, or override the correspo
 
 ### Test IDs
 
-Some hardcoded and generated test IDs have been removed for the following components:
-
-- `Appbar.Header`: `${testID}-root-layer`
-- `Surface`: `surface` and `${testID}-outer-layer`
-
-You can specify a `testID` explicitly and use that value to query the component.
+Hardcoded default test IDs have been removed for the components listed below. Many of these components also derive test IDs for their internal parts by appending a suffix to the `testID` prop (e.g. `${testID}-container`). Since `testID` is no longer defaulted to a hardcoded value, none of these derived test IDs are set either unless you pass a `testID` explicitly — so all queries by the IDs below will stop matching:
+
+- `Appbar.Content`: `appbar-content`
+  - `appbar-content-title-text`
+- `Appbar.Header`: `appbar-header`
+  - `appbar-header-root-layer`
+- `BottomNavigation`: `bottom-navigation`
+  - `bottom-navigation-bar`
+- `BottomNavigation.Bar`: `bottom-navigation-bar`
+  - `bottom-navigation-bar-content`
+  - `bottom-navigation-bar-content-wrapper`
+- `Button`: `button`
+  - `button-container`
+  - `button-icon-container`
+  - `button-text`
+- `Card`: `card`
+  - `card-container`
+  - `card-outline`
+- `Chip`: `chip`
+  - `chip-container`
+- `Drawer.CollapsedItem`: `drawer-collapsed-item`
+  - `drawer-collapsed-item-outline`
+  - `drawer-collapsed-item-container`
+- `FAB`: `floating-action-button`
+  - `floating-action-button-container`
+  - `floating-action-button-text`
+- `FAB.Extended`: `extended-floating-action-button`
+  - `extended-floating-action-button-container`
+  - `extended-floating-action-button-text`
+- `FAB.Menu`: `floating-action-button-menu`
+- `IconButton`: `icon-button`
+  - `icon-button-container`
+  - `icon-button-icon` (and `icon-button-icon-previous` / `icon-button-icon-current` when `animated`)
+- `Menu`: `menu`
+  - `menu-view`
+  - `menu-surface`
+- `Menu.Item`: `menu-item`
+  - `menu-item-title`
+- `Modal`: `modal`
+  - `modal-backdrop`
+  - `modal-wrapper`
+  - `modal-surface`
+- `ProgressBar`: `progress-bar`
+  - `progress-bar-fill`
+- `Searchbar`: `search-bar`
+  - `search-bar-container`
+  - `search-bar-icon`
+  - `search-bar-icon-wrapper`
+  - `search-bar-clear-icon`
+  - `search-bar-trailering-icon`
+  - `search-bar-divider`
+- `Surface`: `surface`
+  - `surface-outer-layer`
+
+You can specify a `testID` explicitly to restore both the component's own test ID and all of its derived test IDs above, using the same suffixes.
 
 ## Components
 
```

**File**: `src/components/Appbar/AppbarContent.tsx` (modified, +2/-2)
```diff
@@ -95,7 +95,7 @@ const AppbarContent = ({
   titleMaxFontSizeMultiplier,
   mode = 'small',
   theme: themeOverrides,
-  testID = 'appbar-content',
+  testID,
   ...rest
 }: Props) => {
   const theme = useInternalTheme(themeOverrides);
@@ -135,7 +135,7 @@ const AppbarContent = ({
           numberOfLines={1}
           accessible
           role={onPress ? 'none' : 'heading'}
-          testID={`${testID}-title-text`}
+          testID={testID ? `${testID}-title-text` : undefined}
           maxFontSizeMultiplier={titleMaxFontSizeMultiplier}
         >
           {title}
```

**File**: `src/components/Appbar/AppbarHeader.tsx` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ const AppbarHeader = ({
   mode = Platform.OS === 'ios' ? 'center-aligned' : 'small',
   elevated = false,
   theme: themeOverrides,
-  testID = 'appbar-header',
+  testID,
   ...rest
 }: Props) => {
   const theme = useInternalTheme(themeOverrides);
```

**File**: `src/components/BottomNavigation/BottomNavigation.tsx` (modified, +2/-2)
```diff
@@ -335,7 +335,7 @@ const BottomNavigation = <Route extends BaseRoute>({
   safeAreaInsets,
   labelMaxFontSizeMultiplier = 1,
   compact: compactProp,
-  testID = 'bottom-navigation',
+  testID,
   theme: themeOverrides,
   getLazy = ({ route }: { route: Route }) => route.lazy,
 }: Props<Route>) => {
@@ -579,7 +579,7 @@ const BottomNavigation = <Route extends BaseRoute>({
         safeAreaInsets={safeAreaInsets}
         labelMaxFontSizeMultiplier={labelMaxFontSizeMultiplier}
         compact={compact}
-        testID={`${testID}-bar`}
+        testID={testID ? `${testID}-bar` : undefined}
         theme={theme}
       />
     </View>
```

**File**: `src/components/BottomNavigation/BottomNavigationBar.tsx` (modified, +3/-3)
```diff
@@ -323,7 +323,7 @@ const BottomNavigationBar = <Route extends BaseRoute>({
   safeAreaInsets,
   labelMaxFontSizeMultiplier = 1,
   compact: compactProp,
-  testID = 'bottom-navigation-bar',
+  testID,
   theme: themeOverrides,
 }: Props<Route>) => {
   const theme = useInternalTheme(themeOverrides);
@@ -495,7 +495,7 @@ const BottomNavigationBar = <Route extends BaseRoute>({
     >
       <Animated.View
         style={[styles.barContent, { backgroundColor }]}
-        testID={`${testID}-content`}
+        testID={testID ? `${testID}-content` : undefined}
       >
         <View
           style={[
@@ -509,7 +509,7 @@ const BottomNavigationBar = <Route extends BaseRoute>({
             },
           ]}
           role={'tablist'}
-          testID={`${testID}-content-wrapper`}
+          testID={testID ? `${testID}-content-wrapper` : undefined}
         >
           {routes.map((route, index) => {
             const focused = navigationState.index === index;
```

**File**: `src/components/Button/Button.tsx` (modified, +7/-4)
```diff
@@ -184,7 +184,7 @@ const Button = ({
   uppercase: uppercaseProp,
   contentStyle,
   labelStyle,
-  testID = 'button',
+  testID,
   accessible,
   background,
   maxFontSizeMultiplier,
@@ -292,7 +292,7 @@ const Button = ({
     <Surface
       {...rest}
       ref={ref}
-      testID={`${testID}-container`}
+      testID={testID ? `${testID}-container` : undefined}
       backgroundColor={backgroundOpacity < 1 ? 'transparent' : backgroundColor}
       {...touchableStyle}
       style={[
@@ -342,7 +342,10 @@ const Button = ({
       >
         <View style={[styles.content, { opacity: textOpacity }, contentStyle]}>
           {icon && loading !== true ? (
-            <View style={iconStyle} testID={`${testID}-icon-container`}>
+            <View
+              style={iconStyle}
+              testID={testID ? `${testID}-icon-container` : undefined}
+            >
               <Icon
                 source={icon}
                 size={customLabelSize ?? iconSize}
@@ -369,7 +372,7 @@ const Button = ({
             variant="labelLarge"
             selectable={false}
             numberOfLines={1}
-            testID={`${testID}-text`}
+            testID={testID ? `${testID}-text` : undefined}
             style={[
               styles.label,
               isMode('text')
```

**File**: `src/components/Card/Card.tsx` (modified, +3/-3)
```diff
@@ -141,7 +141,7 @@ const Card = ({
   style,
   contentStyle,
   theme: themeOverrides,
-  testID = 'card',
+  testID,
   accessible,
   disabled,
   ref,
@@ -225,13 +225,13 @@ const Card = ({
       style={[{ borderColor }, style]}
       theme={theme}
       elevation={elevation}
-      testID={`${testID}-container`}
+      testID={testID ? `${testID}-container` : undefined}
       {...rest}
     >
       {isMode('outlined') && (
         <View
           pointerEvents="none"
-          testID={`${testID}-outline`}
+          testID={testID ? `${testID}-outline` : undefined}
           style={[
             {
               borderColor,
```

**File**: `src/components/Checkbox/CheckboxItem.tsx` (modified, +1/-1)
```diff
@@ -174,7 +174,7 @@ const CheckboxItem = ({
         {isLeading && checkbox}
         <Text
           variant={labelVariant}
-          testID={`${testID}-text`}
+          testID={testID ? `${testID}-text` : undefined}
           maxFontSizeMultiplier={labelMaxFontSizeMultiplier}
           style={[styles.label, computedStyle, labelStyle]}
         >
```

---

### Incident Patch 10: `98e4a848` (2026-09-04)
**Commit Message**: refactor: fix type imports

**File**: `src/components/ActivityIndicator.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
 import type { ColorValue, StyleProp, ViewProps, ViewStyle } from 'react-native';
 
 import { useInternalTheme } from '../core/theming';
-import type { ThemeProp } from '../types';
+import type { ThemeProp } from '../theme/types';
 
 export type Props = ViewProps & {
   /**
```

**File**: `src/components/Appbar/Appbar.tsx` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ import {
 } from './utils';
 import type { AppbarModes, AppbarChildProps } from './utils';
 import { useInternalTheme } from '../../core/theming';
-import type { ThemeProp } from '../../types';
+import type { ThemeProp } from '../../theme/types';
 import Surface from '../Surface';
 
 const APPBAR_HORIZONTAL_PADDING = 4;
```

**File**: `src/components/Appbar/AppbarAction.tsx` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ import type { ColorValue, StyleProp, View, ViewStyle } from 'react-native';
 import type { AnimatedStyle } from 'react-native-reanimated';
 
 import { useInternalTheme } from '../../core/theming';
-import type { ThemeProp } from '../../types';
+import type { ThemeProp } from '../../theme/types';
 import type { IconSource } from '../Icon';
 import IconButton from '../IconButton/IconButton';
 import type { Props as IconButtonProps } from '../IconButton/IconButton';
```

**File**: `src/components/Appbar/AppbarContent.tsx` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ import type {
 
 import { modeTextVariant } from './utils';
 import { useInternalTheme } from '../../core/theming';
-import type { ThemeProp } from '../../types';
+import type { ThemeProp } from '../../theme/types';
 import Text from '../Typography/Text';
 import type { TextRef } from '../Typography/Text';
 
```

**File**: `src/components/Appbar/AppbarHeader.tsx` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import { Appbar } from './Appbar';
 import type { AppbarStyle, Props as AppbarProps } from './Appbar';
 import { getAppbarBackgroundColor, modeAppbarHeight } from './utils';
 import { useInternalTheme } from '../../core/theming';
-import type { ThemeProp } from '../../types';
+import type { ThemeProp } from '../../theme/types';
 
 export type Props = Omit<AppbarProps, 'safeAreaInsets' | 'style'> & {
   /**
```

**File**: `src/components/Appbar/utils.ts` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
 import { StyleSheet } from 'react-native';
 
 import { white } from '../../theme/colors';
-import type { InternalTheme, ThemeProp } from '../../types';
+import type { InternalTheme, ThemeProp } from '../../theme/types';
 
 export type AppbarModes = 'small' | 'medium' | 'large' | 'center-aligned';
 
```

**File**: `src/components/Avatar/AvatarIcon.tsx` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
 
 import { useInternalTheme } from '../../core/theming';
 import { white } from '../../theme/colors';
-import type { ThemeProp } from '../../types';
+import type { ThemeProp } from '../../theme/types';
 import getContrastingColor from '../../utils/getContrastingColor';
 import Icon from '../Icon';
 import type { IconSource } from '../Icon';
```

**File**: `src/components/Avatar/AvatarImage.tsx` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ import type {
 } from 'react-native';
 
 import { useInternalTheme } from '../../core/theming';
-import type { ThemeProp } from '../../types';
+import type { ThemeProp } from '../../theme/types';
 
 const defaultSize = 64;
 
```

---

### Incident Patch 11: `526af2b2` (2026-09-03)
**Commit Message**: fix(theme): keep flat font properties in a mixed configureFonts config (#5066)

**File**: `src/theme/__tests__/fonts.test.js` (modified, +44/-0)
```diff
@@ -340,6 +340,50 @@ describe('configureFonts', () => {
     });
   });
 
+  it('applies flat properties to every variant when the config also has per-variant entries', () => {
+    mockPlatform('ios');
+    const { configureFonts, typescale } = loadFonts();
+
+    const fonts = configureFonts({
+      config: {
+        fontFamily: 'NotoSans',
+        bodyLarge: {
+          fontSize: 18,
+        },
+      },
+    });
+
+    expect(fonts).toEqual({
+      ...Object.fromEntries(
+        Object.entries(typescale).map(([variantName, variantProperties]) => [
+          variantName,
+          { ...variantProperties, fontFamily: 'NotoSans' },
+        ])
+      ),
+      bodyLarge: {
+        ...typescale.bodyLarge,
+        fontFamily: 'NotoSans',
+        fontSize: 18,
+      },
+    });
+  });
+
+  it('does not add flat properties of a mixed config as typescale variants', () => {
+    mockPlatform('ios');
+    const { configureFonts } = loadFonts();
+
+    const fonts = configureFonts({
+      config: {
+        fontFamily: 'NotoSans',
+        bodyLarge: {
+          fontSize: 18,
+        },
+      },
+    });
+
+    expect(fonts.fontFamily).toBeUndefined();
+  });
+
   it('should be deterministic', () => {
     mockPlatform('ios');
     const { configureFonts } = loadFonts();
```

**File**: `src/theme/fonts.tsx` (modified, +32/-20)
```diff
@@ -13,34 +13,41 @@ function configureFontsConfig(
     return typescale;
   }
 
-  const isFlatConfig = Object.values(config).every(
-    (value) => typeof value !== 'object'
-  );
-
-  if (isFlatConfig) {
-    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
-    return Object.fromEntries(
-      Object.entries(typescale).map(([variantName, variantProperties]) => [
-        variantName,
-        { ...variantProperties, ...config },
-      ])
-    ) as Typescale;
+  // A config entry is either a whole variant (an object, e.g. `bodyLarge: { fontSize: 18 }`)
+  // or a single font property shared by every variant (e.g. `fontFamily: 'NotoSans'`).
+  // Both may appear in the same config, so they are collected separately instead of
+  // classifying the config as a whole.
+  const sharedProperties: Record<string, unknown> = {};
+  const variantOverrides: Record<string, object> = {};
+
+  for (const [key, value] of Object.entries(config)) {
+    if (typeof value === 'object' && value !== null) {
+      variantOverrides[key] = value;
+    } else {
+      sharedProperties[key] = value;
+    }
   }
 
   const typescaleByVariant: Partial<
     Record<string, Typescale[keyof Typescale]>
   > = typescale;
 
-  return Object.assign(
-    {},
-    typescale,
-    ...Object.entries(config).map(([variantName, variantProperties]) => ({
-      [variantName]: {
+  const variantNames = new Set([
+    ...Object.keys(typescale),
+    ...Object.keys(variantOverrides),
+  ]);
+
+  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
+  return Object.fromEntries(
+    Array.from(variantNames, (variantName) => [
+      variantName,
+      {
         ...typescaleByVariant[variantName],
-        ...variantProperties,
+        ...sharedProperties,
+        ...variantOverrides[variantName],
       },
-    }))
-  );
+    ])
+  ) as Typescale;
 }
 
 export default function configureFonts(params?: {
@@ -51,6 +58,11 @@ export default function configureFonts(params?: {
   config?: Partial<Record<TypescaleKey, Partial<TypescaleStyle>>>;
 }): Typescale;
 // eslint-disable-next-line no-redeclare
+export default function configureFonts(params: {
+  config: Partial<TypescaleStyle> &
+    Partial<Record<TypescaleKey, Partial<TypescaleStyle>>>;
+}): Typescale;
+// eslint-disable-next-line no-redeclare
 export default function configureFonts(params: {
   config: Record<string, TypescaleStyle>;
 }): Typescale & { [key: string]: TypescaleStyle };
```

---

### Incident Patch 12: `8fea1f00` (2026-09-03)
**Commit Message**: fix: emit forward slashes in generated import paths in babel plugin on Windows (#5054)

**File**: `.gitattributes` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+* text=auto eol=lf
```

**File**: `.github/workflows/ci.yml` (modified, +10/-4)
```diff
@@ -35,7 +35,13 @@ jobs:
 
   unit-tests:
     name: Unit tests
-    runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        os:
+          - ubuntu-latest
+          - windows-latest
+    runs-on: ${{ matrix.os }}
     steps:
       - name: Checkout
         uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
@@ -47,8 +53,8 @@ jobs:
         uses: actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5.0.5
         with:
           path: ./cache/jest
-          key: jest-cache-${{ github.ref_name }}
-          restore-keys: jest-cache-
+          key: jest-cache-${{ runner.os }}-${{ github.ref_name }}
+          restore-keys: jest-cache-${{ runner.os }}-
 
       - name: Run unit tests
         run: yarn test --maxWorkers=2 --coverage
@@ -57,7 +63,7 @@ jobs:
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
         if: always()
         with:
-          name: coverage
+          name: coverage-${{ runner.os }}
           path: coverage
 
   build-package:
```

**File**: `scripts/generate-mappings.ts` (modified, +11/-2)
```diff
@@ -2,7 +2,13 @@ import { parse } from '@babel/parser';
 import * as types from '@babel/types';
 import type { Identifier, StringLiteral } from '@babel/types';
 import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
-import { dirname, join, relative as relativePath, resolve } from 'node:path';
+import {
+  dirname,
+  join,
+  relative as relativePath,
+  resolve,
+  sep,
+} from 'node:path';
 import { fileURLToPath } from 'node:url';
 
 type PackageJson = {
@@ -49,8 +55,11 @@ const ast = parse(source, {
 });
 
 const index = packageJson.main;
+
 const relative = (value: string) =>
-  relativePath(root, resolve(root, dirname(index), value));
+  relativePath(root, resolve(root, dirname(index), value))
+    .split(sep)
+    .join('/');
 
 const mappings = ast.program.body.reduce<{ [key: string]: Mapping }>(
   (acc, declaration, _index, self) => {
```

---

### Incident Patch 13: `dfaecf05` (2026-08-25)
**Commit Message**: chore: render banner below the app bar on native in example (#5061)

**File**: `example/src/Examples/BannerExample.tsx` (modified, +5/-2)
```diff
@@ -36,7 +36,7 @@ const BannerExample = () => {
   };
 
   return (
-    <>
+    <View style={styles.container}>
       <ScreenWrapper>
         <View style={[styles.grid, { paddingTop: height }]}>
           {PHOTOS.map((uri) => (
@@ -78,13 +78,16 @@ const BannerExample = () => {
         Two line text string with two actions. One to two lines is preferable on
         mobile.
       </Banner>
-    </>
+    </View>
   );
 };
 
 BannerExample.title = 'Banner';
 
 const styles = StyleSheet.create({
+  container: {
+    flex: 1,
+  },
   ...Platform.select({
     web: {
       grid: {
```

---

### Incident Patch 14: `df3cdfd7` (2026-08-21)
**Commit Message**: fix: make elevation shadows on iOS & Web match android more closely (#5062)

### Motivation

On iOS and Web, we manually calculate elevation shadows. They are originally from material-web: https://github.com/callstack/react-native-paper/pull/3089

But looking at them side-by-side on all platforms, they look nothing like Android.

This reworks the shadows so they more closely match Android's elevation.

Note that it's an approximation. On Android, the elevation is dynamic and changes based on where the view is. Views toward the bottom have a larger shadow than views toward the top. But we can't achieve it with shadow styles directly, so we need to approximate it.

Also changed the example, as the huge rectangles fit fewer ones on screen and made it harder to see the shadows.

### Known issues

- Animated elevation doesn't work on Web. But it's a pre-existing bug. It should be fixed once we move to Reanimated.

### Test plan

**Before**

<img width="2668" height="1604" alt="elevation-before" src="https://github.com/user-attachments/assets/d127b3e7-d74e-474e-a393-d9385a69e665" />

**After**

<img width="2668" height="1626" alt="elevation-after" src="https://github.com/user-attachments

**File**: `example/src/Examples/SurfaceExample.tsx` (modified, +69/-23)
```diff
@@ -1,42 +1,87 @@
-import { ScrollView, StyleSheet, View } from 'react-native';
+import * as React from 'react';
+import { Animated, ScrollView, StyleSheet, View } from 'react-native';
 
-import { Surface, Text, Palette, List } from 'react-native-paper';
+import { Surface, Text, Palette, List, IconButton } from 'react-native-paper';
 import type { Elevation } from 'react-native-paper';
 
 import ScreenWrapper from '../ScreenWrapper';
 
+const elevationLevels: Elevation[] = [0, 1, 2, 3, 4, 5];
+
+const AnimatedSurface = () => {
+  const [index, setIndex] = React.useState(3);
+
+  const level = elevationLevels[index];
+  const elevation = React.useRef(new Animated.Value(level)).current;
+
+  React.useEffect(() => {
+    Animated.timing(elevation, {
+      toValue: level,
+      duration: 250,
+      useNativeDriver: false,
+    }).start();
+  }, [elevation, level]);
+
+  return (
+    <View style={styles.scroll}>
+      <Surface style={styles.surface} elevation={elevation}>
+        <Text variant="bodySmall">{`Elevation ${level}`}</Text>
+      </Surface>
+      <View style={styles.actions}>
+        <IconButton
+          mode="contained-tonal"
+          icon="minus"
+          disabled={index === 0}
+          onPress={() => setIndex(index - 1)}
+        />
+        <IconButton
+          mode="contained-tonal"
+          icon="plus"
+          disabled={index === elevationLevels.length - 1}
+          onPress={() => setIndex(index + 1)}
+        />
+      </View>
+    </View>
+  );
+};
+
 const SurfaceExample = () => {
   const elevationValues: Elevation[] = [0, 1, 2, 3, 4, 5];
 
   const renderSurface = (index: Elevation, mode: 'flat' | 'elevated') => (
-    <Surface
-      key={index}
-      style={[styles.surface, styles.v3Surface]}
-      mode={mode}
-      elevation={index}
-    >
-      <Text variant="bodyLarge">
-        {`Elevation ${index === 1 ? '(default)' : ''} ${index}`}
-      </Text>
+    <Surface key={index} style={styles.surface} mode={mode} elevation={index}>
+      <Text variant="bodySmall">{`Elevation ${index}`}</Text>
     </Surface>
   );
 
   return (
     <ScreenWrapper>
       <List.Section title="Elevated surface">
-        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
+        <ScrollView
+          horizontal
+          showsHorizontalScrollIndicator={false}
+          contentContainerStyle={styles.scroll}
+        >
           {elevationValues.map((elevation) =>
             renderSurface(elevation, 'elevated')
           )}
         </ScrollView>
       </List.Section>
 
       <List.Section title="Flat surface">
-        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
+        <ScrollView
+          horizontal
+          showsHorizontalScrollIndicator={false}
+          contentContainerStyle={styles.scroll}
+        >
           {elevationValues.map((elevation) => renderSurface(elevation, 'flat'))}
         </ScrollView>
       </List.Section>
 
+      <List.Section title="Animated elevation">
+        <AnimatedSurface />
+      </List.Section>
+
       <List.Section title="Layout">
         <View style={styles.content}>
           <View style={styles.horizontalSurfacesContainer}>
@@ -68,21 +113,22 @@ const styles = StyleSheet.create({
     padding: 24,
     alignItems: 'center',
   },
+  scroll: {
+    gap: 24,
+    paddingHorizontal: 16,
+    paddingVertical: 24,
+  },
   surface: {
-    margin: 24,
-    height: 80,
-    width: 80,
+    height: 120,
+    width: 120,
+    borderRadius: 8,
     alignItems: 'center',
     justifyContent: 'center',
   },
-  v3Surface: {
-    borderRadius: 16,
-    height: 200,
-    width: 200,
-    alignItems: 'center',
-    justifyContent: 'center',
+  actions: {
+    flexDirection: 'row',
+    gap: 16,
   },
-
   horizontalSurfacesContainer: {
     flexDirection: 'row',
     justifyContent: 'space-between',
```

**File**: `src/components/FAB/useVisibility.ts` (modified, +3/-4)
```diff
@@ -11,8 +11,6 @@ import {
 
 import { useReduceMotion } from '../../theme/accessibility/ReduceMotionContext';
 import {
-  IOS_SHADOW_RADIUS_FACTOR,
-  SHADOW_OPACITY,
   androidElevationLevels,
   shadow,
   shadowLayers,
@@ -79,6 +77,7 @@ export function useVisibility({
   const restingElevationDp = androidElevationLevels[elevation];
   const shadowOffsetHeight = shadowLayers[0].height[elevation];
   const shadowRadius = shadowLayers[0].shadowRadius[elevation];
+  const shadowOpacity = elevation ? shadowLayers[0].shadowOpacity : 0;
   const shadowColor = theme.colors.shadow;
 
   const webShadow =
@@ -93,9 +92,9 @@ export function useVisibility({
     }
     return {
       shadowColor,
-      shadowOpacity: alpha.value * (elevation ? SHADOW_OPACITY : 0),
+      shadowOpacity: alpha.value * shadowOpacity,
       shadowOffset: { width: 0, height: shadowOffsetHeight },
-      shadowRadius: shadowRadius * IOS_SHADOW_RADIUS_FACTOR,
+      shadowRadius,
     };
   });
 
```

**File**: `src/components/__tests__/Surface.test.tsx` (modified, +96/-39)
```diff
@@ -2,7 +2,14 @@ import type { ViewStyle } from 'react-native';
 import { StyleSheet } from 'react-native';
 import { Platform } from 'react-native';
 
-import { describe, expect, it } from '@jest/globals';
+import {
+  afterEach,
+  beforeEach,
+  describe,
+  expect,
+  it,
+  jest,
+} from '@jest/globals';
 
 import { getTheme } from '../../core/theming';
 import { render, screen } from '../../test-utils';
@@ -13,20 +20,31 @@ type StyleCase = {
   value: ViewStyle[keyof ViewStyle];
 };
 
+const SPOT_SHADOW_OPACITY = 0.19;
+const AMBIENT_SHADOW_OPACITY = 0.039;
+
+afterEach(() => {
+  jest.restoreAllMocks();
+});
+
 describe('Surface', () => {
   it('should properly render passed props', async () => {
-    const testID = 'surface-container';
     await render(
-      <Surface pointerEvents="box-none" testID={testID}>
+      <Surface pointerEvents="box-none" testID="surface-container">
         {null}
       </Surface>
     );
     // eslint-disable-next-line no-restricted-syntax -- TODO: replace TestInstance props access with a user-visible assertion.
-    expect(screen.getByTestId(testID).props.pointerEvents).toBe('box-none');
+    expect(screen.getByTestId('surface-container').props.pointerEvents).toBe(
+      'box-none'
+    );
   });
 
   describe('on iOS', () => {
-    Platform.OS = 'ios';
+    beforeEach(() => {
+      jest.replaceProperty(Platform, 'OS', 'ios');
+    });
+
     const styles = StyleSheet.create({
       absoluteStyles: {
         bottom: 10,
@@ -59,23 +77,34 @@ describe('Surface', () => {
         </Surface>
       );
 
-      expect(screen.getByTestId('surface-test')).not.toHaveStyle({
-        shadowColor: '#000',
-        shadowOpacity: 0.3,
-        shadowOffset: { width: 0, height: 4 },
-        shadowRadius: 4,
-      });
+      // @ts-expect-error
       expect(screen.getByTestId('surface-test-outer-layer')).not.toHaveStyle({
-        shadowColor: '#000',
-        shadowOpacity: 0.15,
-        shadowOffset: { width: 0, height: 8 },
-        shadowRadius: 12,
+        shadowOpacity: expect.any(Number),
+      });
+      // @ts-expect-error
+      expect(screen.getByTestId('surface-test')).not.toHaveStyle({
+        shadowOpacity: expect.any(Number),
       });
       expect(screen.getByTestId('surface-test')).toHaveStyle({
         backgroundColor: getTheme().colors.surfaceContainerHighest,
       });
     });
 
+    it('should render a spot shadow over an ambient shadow, if mode is elevated', async () => {
+      await render(
+        <Surface elevation={5} testID={'surface-test'}>
+          {null}
+        </Surface>
+      );
+
+      expect(screen.getByTestId('surface-test-outer-layer')).toHaveStyle({
+        shadowOpacity: SPOT_SHADOW_OPACITY,
+      });
+      expect(screen.getByTestId('surface-test')).toHaveStyle({
+        shadowOpacity: AMBIENT_SHADOW_OPACITY,
+      });
+    });
+
     it.each([
       { property: 'opacity', value: 0.7 },
       { property: 'transform', value: [{ scale: 1.02 }] },
@@ -170,59 +199,51 @@ describe('Surface', () => {
 
     describe('outer layer', () => {
       it('should not render rest style', async () => {
-        const testID = 'surface-test';
-
         await render(
-          <Surface testID={testID} style={styles.restStyle}>
+          <Surface testID="surface-test" style={styles.restStyle}>
             {null}
           </Surface>
         );
 
-        expect(screen.getByTestId(`${testID}-outer-layer`)).not.toHaveStyle(
+        expect(screen.getByTestId('surface-test-outer-layer')).not.toHaveStyle(
           styles.restStyle
         );
       });
 
       it('should render absolute position properties on outer layer', async () => {
-        const testID = 'surface-test';
-
         await render(
-          <Surface testID={testID} style={styles.absoluteStyles}>
+          <Surface testID="surface-test" style={styles.absoluteStyles}>
             {null}
           </Surface>
         );
 
-        expect(screen.getByTestId(`${testID}-outer-layer`)).toHaveStyle(
+        expect(screen.getByTestId('surface-test-outer-layer')).toHaveStyle(
           styles.absoluteStyles
         );
       });
 
       it('should render absolute position properties on the outer layer', async () => {
-        const testID = 'surface-test';
-
         await render(
-          <Surface testID={testID} style={styles.absoluteStyles}>
+          <Surface testID="surface-test" style={styles.absoluteStyles}>
             {null}
           </Surface>
         );
 
-        expect(screen.getByTestId(`${testID}-outer-layer`)).toHaveStyle(
+        expect(screen.getByTestId('surface-test-outer-layer')).toHaveStyle(
           styles.absoluteStyles
         );
       });
     });
 
     describe('inner layer', () => {
       it('should render inner layer styles on the inner layer', async () => {
-        const testID = 'surface-test';
-
         await render(
-          <Surface testID={testID} style={styles.innerLayerViewStyle}>
+          <Surface t
```

**File**: `src/components/__tests__/__snapshots__/Banner.test.tsx.snap` (modified, +36/-36)
```diff
@@ -9,11 +9,11 @@ exports[`render visible banner, with custom theme 1`] = `
       "opacity": 1,
       "shadowColor": "rgba(0, 0, 0, 1)",
       "shadowOffset": {
-        "height": 1,
+        "height": 0.55,
         "width": 0,
       },
-      "shadowOpacity": 0.15,
-      "shadowRadius": 3,
+      "shadowOpacity": 0.19,
+      "shadowRadius": 0.79,
     }
   }
   testID="surface-outer-layer"
@@ -26,11 +26,11 @@ exports[`render visible banner, with custom theme 1`] = `
         "flex": undefined,
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 1,
+          "height": 0,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 2,
+        "shadowOpacity": 0.039,
+        "shadowRadius": 0.25,
       }
     }
     testID="surface"
@@ -285,11 +285,11 @@ exports[`renders hidden banner, without action buttons and without image 1`] = `
       "opacity": 0,
       "shadowColor": "rgba(0, 0, 0, 1)",
       "shadowOffset": {
-        "height": 1,
+        "height": 0.55,
         "width": 0,
       },
-      "shadowOpacity": 0.15,
-      "shadowRadius": 3,
+      "shadowOpacity": 0.19,
+      "shadowRadius": 0.79,
     }
   }
   testID="surface-outer-layer"
@@ -302,11 +302,11 @@ exports[`renders hidden banner, without action buttons and without image 1`] = `
         "flex": undefined,
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 1,
+          "height": 0,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 2,
+        "shadowOpacity": 0.039,
+        "shadowRadius": 0.25,
       }
     }
     testID="surface"
@@ -420,11 +420,11 @@ exports[`renders visible banner, with action buttons and with image 1`] = `
       "opacity": 1,
       "shadowColor": "rgba(0, 0, 0, 1)",
       "shadowOffset": {
-        "height": 1,
+        "height": 0.55,
         "width": 0,
       },
-      "shadowOpacity": 0.15,
-      "shadowRadius": 3,
+      "shadowOpacity": 0.19,
+      "shadowRadius": 0.79,
     }
   }
   testID="surface-outer-layer"
@@ -437,11 +437,11 @@ exports[`renders visible banner, with action buttons and with image 1`] = `
         "flex": undefined,
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 1,
+          "height": 0,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 2,
+        "shadowOpacity": 0.039,
+        "shadowRadius": 0.25,
       }
     }
     testID="surface"
@@ -718,11 +718,11 @@ exports[`renders visible banner, with action buttons and without image 1`] = `
       "opacity": 1,
       "shadowColor": "rgba(0, 0, 0, 1)",
       "shadowOffset": {
-        "height": 1,
+        "height": 0.55,
         "width": 0,
       },
-      "shadowOpacity": 0.15,
-      "shadowRadius": 3,
+      "shadowOpacity": 0.19,
+      "shadowRadius": 0.79,
     }
   }
   testID="surface-outer-layer"
@@ -735,11 +735,11 @@ exports[`renders visible banner, with action buttons and without image 1`] = `
         "flex": undefined,
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 1,
+          "height": 0,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 2,
+        "shadowOpacity": 0.039,
+        "shadowRadius": 0.25,
       }
     }
     testID="surface"
@@ -1146,11 +1146,11 @@ exports[`renders visible banner, without action buttons and with image 1`] = `
       "opacity": 1,
       "shadowColor": "rgba(0, 0, 0, 1)",
       "shadowOffset": {
-        "height": 1,
+        "height": 0.55,
         "width": 0,
       },
-      "shadowOpacity": 0.15,
-      "shadowRadius": 3,
+      "shadowOpacity": 0.19,
+      "shadowRadius": 0.79,
     }
   }
   testID="surface-outer-layer"
@@ -1163,11 +1163,11 @@ exports[`renders visible banner, without action buttons and with image 1`] = `
         "flex": undefined,
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 1,
+          "height": 0,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 2,
+        "shadowOpacity": 0.039,
+        "shadowRadius": 0.25,
       }
     }
     testID="surface"
@@ -1291,11 +1291,11 @@ exports[`renders visible banner, without action buttons and without image 1`] =
       "opacity": 1,
       "shadowColor": "rgba(0, 0, 0, 1)",
       "shadowOffset": {
-        "height": 1,
+        "height": 0.55,
         "width": 0,
       },
-      "shadowOpacity": 0.15,
-      "shadowRadius": 3,
+      "shadowOpacity": 0.19,
+      "shadowRadius": 0.79,
     }
   }
   testID="surface-outer-layer"
@@ -1308,11 +1308,11 @@ exports[`renders visible banner, without action buttons and without image 1`] =
         "flex": undefined,
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 1,
+          "height": 0,
           "widt
```

**File**: `src/components/__tests__/__snapshots__/FAB.test.tsx.snap` (modified, +38/-38)
```diff
@@ -23,11 +23,11 @@ exports[`renders FAB large size 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -195,11 +195,11 @@ exports[`renders FAB medium size 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -367,11 +367,11 @@ exports[`renders FAB transitioning to not visible 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
         "shadowOpacity": 0,
-        "shadowRadius": 4,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "none",
@@ -539,11 +539,11 @@ exports[`renders FAB transitioning to visible 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -711,11 +711,11 @@ exports[`renders FAB with aria-label 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -884,11 +884,11 @@ exports[`renders FAB with containerColor and contentColor overrides 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -1056,11 +1056,11 @@ exports[`renders FAB with containerColor override 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -1228,11 +1228,11 @@ exports[`renders FAB with default props 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -1400,11 +1400,11 @@ exports[`renders FAB with primary variant 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -1572,11 +1572,11 @@ exports[`renders FAB with secondary variant 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -1744,11 +1744,11 @@ exports[`renders FAB with tertiary variant 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -1916,11 +1916,11 @@ exports[`renders FAB with tonalSecondary variant 1`] = `
       {
         "shadowColor": "rgba(0, 0, 0, 1)",
         "shadowOffset": {
-          "height": 4,
+          "height": 3.33,
           "width": 0,
         },
-        "shadowOpacity": 0.3,
-        "shadowRadius": 4,
+        "shadowOpacity": 0.19,
+        "shadowRadius": 4.75,
       },
       {
         "pointerEvents": "auto",
@@ -2088,11 +2088,11 @@ exports[`rende
```

**File**: `src/components/__tests__/__snapshots__/FABExtended.test.tsx.snap` (modified, +17/-17)
```diff
@@ -24,11 +24,11 @@ exports[`renders extended FAB collapsed 1`] = `
         {
           "shadowColor": "rgba(0, 0, 0, 1)",
           "shadowOffset": {
-            "height": 4,
+            "height": 3.33,
             "width": 0,
           },
-          "shadowOpacity": 0.3,
-          "shadowRadius": 4,
+          "shadowOpacity": 0.19,
+          "shadowRadius": 4.75,
         },
         {
           "pointerEvents": "auto",
@@ -263,11 +263,11 @@ exports[`renders extended FAB expanded 1`] = `
         {
           "shadowColor": "rgba(0, 0, 0, 1)",
           "shadowOffset": {
-            "height": 4,
+            "height": 3.33,
             "width": 0,
           },
-          "shadowOpacity": 0.3,
-          "shadowRadius": 4,
+          "shadowOpacity": 0.19,
+          "shadowRadius": 4.75,
         },
         {
           "pointerEvents": "auto",
@@ -502,11 +502,11 @@ exports[`renders extended FAB large size 1`] = `
         {
           "shadowColor": "rgba(0, 0, 0, 1)",
           "shadowOffset": {
-            "height": 4,
+            "height": 3.33,
             "width": 0,
           },
-          "shadowOpacity": 0.3,
-          "shadowRadius": 4,
+          "shadowOpacity": 0.19,
+          "shadowRadius": 4.75,
         },
         {
           "pointerEvents": "auto",
@@ -741,11 +741,11 @@ exports[`renders extended FAB medium size 1`] = `
         {
           "shadowColor": "rgba(0, 0, 0, 1)",
           "shadowOffset": {
-            "height": 4,
+            "height": 3.33,
             "width": 0,
           },
-          "shadowOpacity": 0.3,
-          "shadowRadius": 4,
+          "shadowOpacity": 0.19,
+          "shadowRadius": 4.75,
         },
         {
           "pointerEvents": "auto",
@@ -980,11 +980,11 @@ exports[`renders extended FAB not visible 1`] = `
         {
           "shadowColor": "rgba(0, 0, 0, 1)",
           "shadowOffset": {
-            "height": 4,
+            "height": 3.33,
             "width": 0,
           },
           "shadowOpacity": 0,
-          "shadowRadius": 4,
+          "shadowRadius": 4.75,
         },
         {
           "pointerEvents": "none",
@@ -1219,11 +1219,11 @@ exports[`renders extended FAB transitioning to collapsed 1`] = `
         {
           "shadowColor": "rgba(0, 0, 0, 1)",
           "shadowOffset": {
-            "height": 4,
+            "height": 3.33,
             "width": 0,
           },
-          "shadowOpacity": 0.3,
-          "shadowRadius": 4,
+          "shadowOpacity": 0.19,
+          "shadowRadius": 4.75,
         },
         {
           "pointerEvents": "auto",
```

**File**: `src/components/__tests__/__snapshots__/FABMenu.test.tsx.snap` (modified, +20/-20)
```diff
@@ -424,11 +424,11 @@ exports[`renders FAB.Menu closed 1`] = `
             {
               "shadowColor": "rgba(0, 0, 0, 1)",
               "shadowOffset": {
-                "height": 4,
+                "height": 3.33,
                 "width": 0,
               },
-              "shadowOpacity": 0.3,
-              "shadowRadius": 4,
+              "shadowOpacity": 0.19,
+              "shadowRadius": 4.75,
             },
             {
               "pointerEvents": "auto",
@@ -1109,11 +1109,11 @@ exports[`renders FAB.Menu not expanded when trigger is not visible 1`] = `
             {
               "shadowColor": "rgba(0, 0, 0, 1)",
               "shadowOffset": {
-                "height": 4,
+                "height": 3.33,
                 "width": 0,
               },
               "shadowOpacity": 0,
-              "shadowRadius": 4,
+              "shadowRadius": 4.75,
             },
             {
               "pointerEvents": "none",
@@ -1794,11 +1794,11 @@ exports[`renders FAB.Menu open 1`] = `
             {
               "shadowColor": "rgba(0, 0, 0, 1)",
               "shadowOffset": {
-                "height": 4,
+                "height": 3.33,
                 "width": 0,
               },
-              "shadowOpacity": 0.3,
-              "shadowRadius": 4,
+              "shadowOpacity": 0.19,
+              "shadowRadius": 4.75,
             },
             {
               "pointerEvents": "auto",
@@ -3139,11 +3139,11 @@ exports[`renders FAB.Menu with 6 items 1`] = `
             {
               "shadowColor": "rgba(0, 0, 0, 1)",
               "shadowOffset": {
-                "height": 4,
+                "height": 3.33,
                 "width": 0,
               },
-              "shadowOpacity": 0.3,
-              "shadowRadius": 4,
+              "shadowOpacity": 0.19,
+              "shadowRadius": 4.75,
             },
             {
               "pointerEvents": "auto",
@@ -3825,11 +3825,11 @@ exports[`renders FAB.Menu with center alignment 1`] = `
             {
               "shadowColor": "rgba(0, 0, 0, 1)",
               "shadowOffset": {
-                "height": 4,
+                "height": 3.33,
                 "width": 0,
               },
-              "shadowOpacity": 0.3,
-              "shadowRadius": 4,
+              "shadowOpacity": 0.19,
+              "shadowRadius": 4.75,
             },
             {
               "pointerEvents": "auto",
@@ -4568,11 +4568,11 @@ exports[`renders FAB.Menu with items having icons 1`] = `
             {
               "shadowColor": "rgba(0, 0, 0, 1)",
               "shadowOffset": {
-                "height": 4,
+                "height": 3.33,
                 "width": 0,
               },
-              "shadowOpacity": 0.3,
-              "shadowRadius": 4,
+              "shadowOpacity": 0.19,
+              "shadowRadius": 4.75,
             },
             {
               "pointerEvents": "auto",
@@ -5253,11 +5253,11 @@ exports[`renders FAB.Menu with start alignment 1`] = `
             {
               "shadowColor": "rgba(0, 0, 0, 1)",
               "shadowOffset": {
-                "height": 4,
+                "height": 3.33,
                 "width": 0,
               },
-              "shadowOpacity": 0.3,
-              "shadowRadius": 4,
+              "shadowOpacity": 0.19,
+              "shadowRadius": 4.75,
             },
             {
               "pointerEvents": "auto",
```

**File**: `src/components/__tests__/__snapshots__/Menu.test.tsx.snap` (modified, +12/-12)
```diff
@@ -269,11 +269,11 @@ exports[`renders menu with content styles 1`] = `
               "opacity": 0,
               "shadowColor": "rgba(0, 0, 0, 1)",
               "shadowOffset": {
-                "height": 2,
+                "height": 1.66,
                 "width": 0,
               },
-              "shadowOpacity": 0.15,
-              "shadowRadius": 6,
+              "shadowOpacity": 0.19,
+              "shadowRadius": 2.36,
               "transform": [
                 {
                   "scaleX": 0,
@@ -299,11 +299,11 @@ exports[`renders menu with content styles 1`] = `
                 "paddingVertical": 8,
                 "shadowColor": "rgba(0, 0, 0, 1)",
                 "shadowOffset": {
-                  "height": 1,
+                  "height": 0,
                   "width": 0,
                 },
-                "shadowOpacity": 0.3,
-                "shadowRadius": 2,
+                "shadowOpacity": 0.039,
+                "shadowRadius": 0.75,
               }
             }
             testID="menu-surface"
@@ -998,11 +998,11 @@ exports[`renders visible menu 1`] = `
               "opacity": 0,
               "shadowColor": "rgba(0, 0, 0, 1)",
               "shadowOffset": {
-                "height": 2,
+                "height": 1.66,
                 "width": 0,
               },
-              "shadowOpacity": 0.15,
-              "shadowRadius": 6,
+              "shadowOpacity": 0.19,
+              "shadowRadius": 2.36,
               "transform": [
                 {
                   "scaleX": 0,
@@ -1026,11 +1026,11 @@ exports[`renders visible menu 1`] = `
                 "paddingVertical": 8,
                 "shadowColor": "rgba(0, 0, 0, 1)",
                 "shadowOffset": {
-                  "height": 1,
+                  "height": 0,
                   "width": 0,
                 },
-                "shadowOpacity": 0.3,
-                "shadowRadius": 2,
+                "shadowOpacity": 0.039,
+                "shadowRadius": 0.75,
               }
             }
             testID="menu-surface"
```

---

### Incident Patch 15: `ea80c26d` (2026-08-21)
**Commit Message**: chore: fix failing docs build

**File**: `docs/src/data/componentDocs6x.json` (modified, +11/-2)
```diff
@@ -3637,10 +3637,19 @@
               "name": "Array",
               "elements": [
                 {
-                  "name": "string"
+                  "name": "union",
+                  "raw": "string | null",
+                  "elements": [
+                    {
+                      "name": "string"
+                    },
+                    {
+                      "name": "null"
+                    }
+                  ]
                 }
               ],
-              "raw": "Array<string>"
+              "raw": "Array<string | null>"
             },
             "description": "@internal"
           },
```

**File**: `package.json` (modified, +3/-0)
```diff
@@ -99,6 +99,9 @@
     "react-native-safe-area-context": "*",
     "react-native-worklets": ">=0.8.1"
   },
+  "resolutions": {
+    "ast-types": "0.16.1"
+  },
   "jest": {
     "preset": "@react-native/jest-preset",
     "setupFiles": [
```

**File**: `yarn.lock` (modified, +4/-4)
```diff
@@ -6500,12 +6500,12 @@ __metadata:
   languageName: node
   linkType: hard
 
-"ast-types@npm:0.14.2, ast-types@npm:^0.14.2":
-  version: 0.14.2
-  resolution: "ast-types@npm:0.14.2"
+"ast-types@npm:0.16.1":
+  version: 0.16.1
+  resolution: "ast-types@npm:0.16.1"
   dependencies:
     tslib: "npm:^2.0.1"
-  checksum: 10c0/5d66d89b6c07fe092087454b6042dbaf81f2882b176db93861e2b986aafe0bce49e1f1ff59aac775d451c1426ad1e967d250e9e3548f5166ea8a3475e66c169d
+  checksum: 10c0/abcc49e42eb921a7ebc013d5bec1154651fb6dbc3f497541d488859e681256901b2990b954d530ba0da4d0851271d484f7057d5eff5e07cb73e8b10909f711bf
   languageName: node
   linkType: hard
 
```

#### Recent Merged Pull Requests:
- **PR #5131** (2026-09-29): ci: build and upload example app (@alcpereira)
- **PR #5130** (closed): fix(ci): publish OTA updates when a labelled pull request merges (@KisaneNeko)
- **PR #5126** (2026-09-28): feat(portal)!: hide content below an overlay from assistive technology (@konstmar)
- **PR #5125** (2026-09-28): fix(modal): make Modal accessible and honour its dismissal props (@konstmar)
- **PR #5124** (2026-09-16): fix(portal): forward the reduce motion preference and match queued update keys (@konstmar)
- **PR #5117** (2026-09-11): fix: rename misspelled props and various typos (@k0ndee)
- **PR #5101** (closed): feat: fix residual md3 deviations in switch component (@likevy)
- **PR #5099** (2026-09-09): fix: remove derived testIDs (@k0ndee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
