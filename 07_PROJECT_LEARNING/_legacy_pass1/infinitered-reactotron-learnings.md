# Forensic Learning Record (Deep Inspection): infinitered/reactotron

> **Canonical Artifact**: `07_PROJECT_LEARNING/infinitered-reactotron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infinitered/reactotron](https://github.com/infinitered/reactotron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:15:16.554Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `infinitered/reactotron`
- **Description**: A desktop app for inspecting your React JS and React Native projects. macOS, Linux, and Windows.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15592 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.eslintrc.js`
```
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:import/errors",
    "standard",
    "prettier",
  ],
  plugins: ["@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname, // this option prevents us from specifying this file in "eslintConfig" package.json key https://github.com/typescript-eslint/typescript-eslint/issues/251
    project: [
      "./tsconfig.base.json",
      "./apps/*/tsconfig.json",
      "./lib/*/tsconfig.json",
    ],
  },
  settings: {
    "import/extensions": [".js", ".jsx", ".ts", ".tsx"],
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    },
    "import/ignore": [
      "node_modules/react-native/index\\.js$",
      "react-native/Libraries/LogBox/Data/parseLogBoxLog.js",
      "react-native/Libraries/LogBox/LogBox.js",
      "react-native/Libraries/Core/NativeExceptionsManager.js",
      "react-native/Libraries/NativeModules/specs/NativeDevMenu.js",
    ],
  },
  rules: {
    "no-unused-vars": 0,
    "no-undef": 0,
    "space-before-function-paren": 0,
    "@typescript-eslint/indent": 0,
    "@typescript-eslint/explicit-member-accessibility": 0,
    "@typescript-eslint/explicit-function-return-type": 0,
    "@typescript-eslint/no-explicit-any": 0,
    "@typescript-eslint/no-object-literal-type-assertion": 0,
    "@typescript-eslint/no-empty-function": [2, { allow: ["arrowFunctions"] }],
    "@typescript-eslint/no-empty-interface": 0,
    "@typescript-eslint/no-var-requires": 0,
    "@typescript-eslint/member-delimiter-style": 0,
    "import/no-cycle": "error",
  },
  ignorePatterns: [
    "**/dist/**/*",
    "**/node_modules/**/*",
    "**/build/**/*",
    "examples",
    "scripts",
    "**/CHANGELOG.md",
  ],
}

```

### Core Architecture Module: `apps/example-app/App.tsx`
```
import App from "./app/app"
import React from "react"
import * as SplashScreen from "expo-splash-screen"

SplashScreen.preventAutoHideAsync()

function IgniteApp() {
  return <App hideSplashScreen={SplashScreen.hideAsync} />
}

export default IgniteApp

```

### Core Architecture Module: `apps/example-app/app/app.tsx`
```
/* eslint-disable import/first */
/**
 * Welcome to the main entry point of the app. In this file, we'll
 * be kicking off our app.
 *
 * Most of this file is boilerplate and you shouldn't need to modify
 * it very often. But take some time to look through and understand
 * what is going on here.
 *
 * The app navigation resides in app/app/navigators, so head over there
 * if you're interested in adding screens and navigators.
 */
if (__DEV__) {
  // Load Reactotron configuration in development. We don't want to
  // include this in our production bundle, so we are using `if (__DEV__)`
  // to only execute this in development.
  require("./devtools/ReactotronConfig.ts")
}
import "app/i18n"
import "app/utils/ignoreWarnings"
import { useFonts } from "expo-font"
import React from "react"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"
import * as Linking from "expo-linking"
import { useInitialRootStore } from "app/mobxStateTree"
import { AppNavigator, useNavigationPersistence } from "app/navigators"
import { ErrorBoundary } from "app/screens/ErrorScreen/ErrorBoundary"
import * as storage from "app/utils/storage"
import { customFontsToLoad } from "app/theme"
import Config from "app/config"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { StatusBar, ViewStyle } from "react-native"
import { store } from "app/redux"
import { Provider as ReduxProvider } from "react-redux"

export const NAVIGATION_PERSISTENCE_KEY = "NAVIGATION_STATE"

StatusBar.setBarStyle("light-content")

// Web linking configuration
const prefix = Linking.createURL("/")
const config = {
  screens: {
    Login: {
      path: "",
    },
    Welcome: "welcome",
    Demo: {
      screens: {
        DemoShowroom: {
          path: "showroom/:queryIndex?/:itemIndex?",
        },
        DemoDebug: "debug",
        DemoPodcastList: "podcast",
        DemoCommunity: "community",
      },
    },
  },
}

interface AppProps {
  hideSplashScreen: () => Promise<boolean>
}

/**
 * This is the root component of our app.
 */
function App(props: AppProps) {
  const { hideSplashScreen } = props
  const {
    initialNavigationState,
    onNavigationStateChange,
    isRestored: isNavigationStateRestored,
  } = useNavigationPersistence(storage, NAVIGATION_PERSISTENCE_KEY)

  const [areFontsLoaded] = useFonts(customFontsToLoad)

  const { rehydrated } = useInitialRootStore(() => {
    // This runs after the root store has been initialized and rehydrated.

    // If your initialization scripts run very fast, it's good to show the splash screen for just a bit longer to prevent flicker.
    // Slightly delaying splash screen hiding for better UX; can be customized or removed as needed,
    // Note: (vanilla Android) The splash-screen will not appear if you launch your app via the terminal or Android Studio. Kill the app and launch it normally by tapping on the launcher icon. https://stackoverflow.com/a/69831106
    // Note: (vanilla iOS) You might notice the splash-screen logo change size. This happens in debug/development mode. Try building the app for release.
    setTimeout(hideSplashScreen, 500)
  })

  // Before we show the app, we have to wait for our state to be ready.
  // In the meantime, don't render anything. This will be the background
  // color set in native by rootView's background color.
  // In iOS: application:didFinishLaunchingWithOptions:
  // In Android: https://stackoverflow.com/a/45838109/204044
  // You can replace with your own loading component if you wish.
  if (!rehydrated || !isNavigationStateRestored || !areFontsLoaded) return null

  const linking = {
    prefixes: [prefix],
    config,
  }

  // otherwise, we're ready to render the app
  return (
    <ReduxProvider store={store}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ErrorBoundary catchErrors={Config.catchErrors}>
          <GestureHandlerRootView style={$container}>
            <AppNavigator
              linking={linking}
              initialState={initialNavigationState}
              onStateChange={onNavigationStateChange}
            />
          </GestureHandlerRootView>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ReduxProvider>
  )
}

// eslint-disable-next-line reactotron/no-tron-in-production
export default __DEV__ ? console.tron.overlay(App) : App

const $container: ViewStyle = {
  flex: 1,
}

```

### Core Architecture Module: `apps/example-app/app/components/Button.tsx`
```
import React, { ComponentType } from "react"
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native"
import { colors, spacing, typography } from "app/theme"
import { Text, TextProps } from "./Text"

type Presets = keyof typeof $viewPresets

export interface ButtonAccessoryProps {
  style: StyleProp<any>
  pressableState: PressableStateCallbackType
  disabled?: boolean
}

export interface ButtonProps extends PressableProps {
  /**
   * Text which is looked up via i18n.
   */
  tx?: TextProps["tx"]
  /**
   * The text to display if not using `tx` or nested components.
   */
  text?: TextProps["text"]
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  txOptions?: TextProps["txOptions"]
  /**
   * An optional style override useful for padding & margin.
   */
  style?: StyleProp<ViewStyle>
  /**
   * An optional style override for the "pressed" state.
   */
  pressedStyle?: StyleProp<ViewStyle>
  /**
   * An optional style override for the button text.
   */
  textStyle?: StyleProp<TextStyle>
  /**
   * An optional style override for the button text when in the "pressed" state.
   */
  pressedTextStyle?: StyleProp<TextStyle>
  /**
   * An optional style override for the button text when in the "disabled" state.
   */
  disabledTextStyle?: StyleProp<TextStyle>
  /**
   * One of the different types of button presets.
   */
  preset?: Presets
  /**
   * An optional component to render on the right side of the text.
   * Example: `RightAccessory={(props) => <View {...props} />}`
   */
  RightAccessory?: ComponentType<ButtonAccessoryProps>
  /**
   * An optional component to render on the left side of the text.
   * Example: `LeftAccessory={(props) => <View {...props} />}`
   */
  LeftAccessory?: ComponentType<ButtonAccessoryProps>
  /**
   * Children components.
   */
  children?: React.ReactNode
  /**
   * disabled prop, accessed directly for declarative styling reasons.
   * https://reactnative.dev/docs/pressable#disabled
   */
  disabled?: boolean
  /**
   * An optional style override for the disabled state
   */
  disabledStyle?: StyleProp<ViewStyle>
}

/**
 * A component that allows users to take actions and make choices.
 * Wraps the Text component with a Pressable component.
 *
 * - [Documentation and Examples](https://github.com/infinitered/ignite/blob/master/docs/Components-Button.md)
 */
export function Button(props: ButtonProps) {
  const {
    tx,
    text,
    txOptions,
    style: $viewStyleOverride,
    pressedStyle: $pressedViewStyleOverride,
    textStyle: $textStyleOverride,
    pressedTextStyle: $pressedTextStyleOverride,
    disabledTextStyle: $disabledTextStyleOverride,
    children,
    RightAccessory,
    LeftAccessory,
    disabled,
    disabledStyle: $disabledViewStyleOverride,
    ...rest
  } = props

  const preset: Presets = props.preset ?? "default"
  function $viewStyle({ pressed }: PressableStateCallbackType) {
    return [
      $viewPresets[preset],
      $viewStyleOverride,
      !!pressed && [$pressedViewPresets[preset], $pressedViewStyleOverride],
      !!disabled && $disabledViewStyleOverride,
    ]
  }
  function $textStyle({ pressed }: PressableStateCallbackType) {
    return [
      $textPresets[preset],
      $textStyleOverride,
      !!pressed && [$pressedTextPresets[preset], $pressedTextStyleOverride],
      !!disabled && $disabledTextStyleOverride,
    ]
  }

  return (
    <Pressable
      style={$viewStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      {...rest}
      disabled={disabled}
    >
      {(state) => (
        <>
          {!!LeftAccessory && (
            <LeftAccessory style={$leftAccessoryStyle} pressableState={state} disabled={disabled} />
          )}

          <Text tx={tx} text={text} txOptions={txOptions} style={$textStyle(state)}>
            {children}
          </Text>

          {!!RightAccessory && (
            <RightAccessory
              style={$rightAccessoryStyle}
              pressableState={state}
              disabled={disabled}
            />
          )}
        </>
      )}
    </Pressable>
  )
}

const $baseViewStyle: ViewStyle = {
  minHeight: 56,
  borderRadius: 4,
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "row",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  overflow: "hidden",
}

const $baseTextStyle: TextStyle = {
  fontSize: 16,
  lineHeight: 20,
  fontFamily: typography.primary.medium,
  textAlign: "center",
  flexShrink: 1,
  flexGrow: 0,
  zIndex: 2,
}

const $rightAccessoryStyle: ViewStyle = { marginStart: spacing.xs, zIndex: 1 }
const $leftAccessoryStyle: ViewStyle = { marginEnd: spacing.xs, zIndex: 1 }

const $viewPresets = {
  default: [
    $baseViewStyle,
    {
      borderWidth: 1,
      borderColor: colors.palette.neutral400,
      backgroundColor: colors.palette.neutral100,
    },
  ] as StyleProp<ViewStyle>,

  filled: [$baseViewStyle, { backgroundColor: colors.palette.neutral300 }] as StyleProp<ViewStyle>,

  reversed: [
    $baseViewStyle,
    { backgroundColor: colors.palette.neutral800 },
  ] as StyleProp<ViewStyle>,
}

const $textPresets: Record<Presets, StyleProp<TextStyle>> = {
  default: $baseTextStyle,
  filled: $baseTextStyle,
  reversed: [$baseTextStyle, { color: colors.palette.neutral100 }],
}

const $pressedViewPresets: Record<Presets, StyleProp<ViewStyle>> = {
  default: { backgroundColor: colors.palette.neutral200 },
  filled: { backgroundColor: colors.palette.neutral400 },
  reversed: { backgroundColor: colors.palette.neutral700 },
}

const $pressedTextPresets: Record<Presets, StyleProp<TextStyle>> = {
  default: { opacity: 0.9 },
  filled: { opacity: 0.9 },
  reversed: { opacity: 0.9 },
}

```

### Core Architecture Module: `apps/example-app/app/components/Icon.tsx`
```
import * as React from "react"
import { ComponentType } from "react"
import {
  Image,
  ImageStyle,
  StyleProp,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewProps,
  ViewStyle,
} from "react-native"

export type IconTypes = keyof typeof iconRegistry

interface IconProps extends TouchableOpacityProps {
  /**
   * The name of the icon
   */
  icon: IconTypes

  /**
   * An optional tint color for the icon
   */
  color?: string

  /**
   * An optional size for the icon. If not provided, the icon will be sized to the icon's resolution.
   */
  size?: number

  /**
   * Style overrides for the icon image
   */
  style?: StyleProp<ImageStyle>

  /**
   * Style overrides for the icon container
   */
  containerStyle?: StyleProp<ViewStyle>

  /**
   * An optional function to be called when the icon is pressed
   */
  onPress?: TouchableOpacityProps["onPress"]
}

/**
 * A component to render a registered icon.
 * It is wrapped in a <TouchableOpacity /> if `onPress` is provided, otherwise a <View />.
 *
 * - [Documentation and Examples](https://github.com/infinitered/ignite/blob/master/docs/Components-Icon.md)
 */
export function Icon(props: IconProps) {
  const {
    icon,
    color,
    size,
    style: $imageStyleOverride,
    containerStyle: $containerStyleOverride,
    ...WrapperProps
  } = props

  const isPressable = !!WrapperProps.onPress
  const Wrapper = (WrapperProps?.onPress ? TouchableOpacity : View) as ComponentType<
    TouchableOpacityProps | ViewProps
  >

  const $imageStyle: StyleProp<ImageStyle> = [
    $imageStyleBase,
    color !== undefined && { tintColor: color },
    size !== undefined && { width: size, height: size },
    $imageStyleOverride,
  ]

  return (
    <Wrapper
      accessibilityRole={isPressable ? "imagebutton" : undefined}
      {...WrapperProps}
      style={$containerStyleOverride}
    >
      <Image style={$imageStyle} source={iconRegistry[icon]} />
    </Wrapper>
  )
}

export const iconRegistry = {
  caretRight: require("../../assets/icons/caretRight.png"),
  ladybug: require("../../assets/icons/ladybug.png"),
}

const $imageStyleBase: ImageStyle = {
  resizeMode: "contain",
}

```

### Core Architecture Module: `apps/example-app/app/components/ListItem.tsx`
```
import React, { ReactElement } from "react"
import {
  StyleProp,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from "react-native"
import { colors, spacing } from "app/theme"
import { Icon, IconTypes } from "./Icon"
import { Text, TextProps } from "./Text"

export interface ListItemProps extends TouchableOpacityProps {
  /**
   * How tall the list item should be.
   * Default: 56
   */
  height?: number
  /**
   * Whether to show the top separator.
   * Default: false
   */
  topSeparator?: boolean
  /**
   * Whether to show the bottom separator.
   * Default: false
   */
  bottomSeparator?: boolean
  /**
   * Text to display if not using `tx` or nested components.
   */
  text?: TextProps["text"]
  /**
   * Text which is looked up via i18n.
   */
  tx?: TextProps["tx"]
  /**
   * Children components.
   */
  children?: TextProps["children"]
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  txOptions?: TextProps["txOptions"]
  /**
   * Optional text style override.
   */
  textStyle?: StyleProp<TextStyle>
  /**
   * Pass any additional props directly to the Text component.
   */
  TextProps?: TextProps
  /**
   * Optional View container style override.
   */
  containerStyle?: StyleProp<ViewStyle>
  /**
   * Optional TouchableOpacity style override.
   */
  style?: StyleProp<ViewStyle>
  /**
   * Icon that should appear on the left.
   */
  leftIcon?: IconTypes
  /**
   * An optional tint color for the left icon
   */
  leftIconColor?: string
  /**
   * Icon that should appear on the right.
   */
  rightIcon?: IconTypes
  /**
   * An optional tint color for the right icon
   */
  rightIconColor?: string
  /**
   * Right action custom ReactElement.
   * Overrides `rightIcon`.
   */
  RightComponent?: ReactElement
  /**
   * Left action custom ReactElement.
   * Overrides `leftIcon`.
   */
  LeftComponent?: ReactElement
}

interface ListItemActionProps {
  icon?: IconTypes
  iconColor?: string
  Component?: ReactElement
  size: number
  side: "left" | "right"
}

/**
 * A styled row component that can be used in FlatList, SectionList, or by itself.
 *
 * - [Documentation and Examples](https://github.com/infinitered/ignite/blob/master/docs/Components-ListItem.md)
 */
export function ListItem(props: ListItemProps) {
  const {
    bottomSeparator,
    children,
    height = 56,
    LeftComponent,
    leftIcon,
    leftIconColor,
    RightComponent,
    rightIcon,
    rightIconColor,
    style,
    text,
    TextProps,
    topSeparator,
    tx,
    txOptions,
    textStyle: $textStyleOverride,
    containerStyle: $containerStyleOverride,
    ...TouchableOpacityProps
  } = props

  const $textStyles = [$textStyle, $textStyleOverride, TextProps?.style]

  const $containerStyles = [
    topSeparator && $separatorTop,
    bottomSeparator && $separatorBottom,
    $containerStyleOverride,
  ]

  const $touchableStyles = [$touchableStyle, { minHeight: height }, style]

  return (
    <View style={$containerStyles}>
      <TouchableOpacity {...TouchableOpacityProps} style={$touchableStyles}>
        <ListItemAction
          side="left"
          size={height}
          icon={leftIcon}
          iconColor={leftIconColor}
          Component={LeftComponent}
        />

        <Text {...TextProps} tx={tx} text={text} txOptions={txOptions} style={$textStyles}>
          {children}
        </Text>

        <ListItemAction
          side="right"
          size={height}
          icon={rightIcon}
          iconColor={rightIconColor}
          Component={RightComponent}
        />
      </TouchableOpacity>
    </View>
  )
}

function ListItemAction(props: ListItemActionProps) {
  const { icon, Component, iconColor, size, side } = props

  const $iconContainerStyles = [$iconContainer]

  if (Component) return Component

  if (icon !== undefined) {
    return (
      <Icon
        size={24}
        icon={icon}
        color={iconColor}
        containerStyle={[
          $iconContainerStyles,
          side === "left" && $iconContainerLeft,
          side === "right" && $iconContainerRight,
          { height: size },
        ]}
      />
    )
  }

  return null
}

const $separatorTop: ViewStyle = {
  borderTopWidth: 1,
  borderTopColor: colors.separator,
}

const $separatorBottom: ViewStyle = {
  borderBottomWidth: 1,
  borderBottomColor: colors.separator,
}

const $textStyle: TextStyle = {
  paddingVertical: spacing.xs,
  alignSelf: "center",
  flexGrow: 1,
  flexShrink: 1,
}

const $touchableStyle: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
}

const $iconContainer: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
  flexGrow: 0,
}
const $iconContainerLeft: ViewStyle = {
  marginEnd: spacing.md,
}

const $iconContainerRight: ViewStyle = {
  marginStart: spacing.md,
}

```

### Core Architecture Module: `apps/example-app/app/components/ListView.tsx`
```
import React, { forwardRef, PropsWithoutRef } from "react"
import { FlatList } from "react-native"
import { isRTL } from "app/i18n"
import { FlashList, FlashListProps } from "@shopify/flash-list"

export type ListViewRef<T> = FlashList<T> | FlatList<T>

export type ListViewProps<T> = PropsWithoutRef<FlashListProps<T>>

/**
 * This is a Higher Order Component meant to ease the pain of using @shopify/flash-list
 * when there is a chance that a user would have their device language set to an
 * RTL language like Arabic or Punjabi. This component will use react-native's
 * FlatList if the user's language is RTL or FlashList if the user's language is LTR.
 *
 * Because FlashList's props are a superset of FlatList's, you must pass estimatedItemSize
 * to this component if you want to use it.
 *
 * This is a temporary workaround until the FlashList component supports RTL at
 * which point this component can be removed and we will default to using FlashList everywhere.
 *
 * @see {@link https://github.com/Shopify/flash-list/issues/544|RTL Bug Android}
 * @see {@link https://github.com/Shopify/flash-list/issues/840|Flashlist Not Support RTL}
 *
 * @param props - FlashListProps | FlatListProps
 * @param forwardRef - React.Ref<ListProps<T>>
 * @returns JSX.Element
 */

const ListViewComponent = forwardRef(
  <T,>(props: ListViewProps<T>, ref: React.ForwardedRef<ListViewRef<T>>) => {
    const ListComponentWrapper = isRTL ? FlatList : FlashList

    return <ListComponentWrapper {...props} ref={ref} />
  },
)

ListViewComponent.displayName = "ListView"

export const ListView = ListViewComponent as <T>(
  props: ListViewProps<T> & {
    ref?: React.RefObject<ListViewRef<T>>
  },
) => React.ReactElement

```

### Core Architecture Module: `apps/example-app/app/components/Repo.tsx`
```
import React, { Component } from "react"
import {
  Animated,
  Easing,
  TouchableWithoutFeedback,
  View,
  Text,
  Image,
  ViewStyle,
  ImageStyle,
  TextStyle,
  ImageSourcePropType,
} from "react-native"
import { Button } from "./Button"
import { mergeRight } from "ramda"
import { colors } from "app/theme"

interface RepoProps {
  repo?: string
  name?: string
  avatar?: string
  message?: string
  bigger?: () => void
  smaller?: () => void
  faster?: () => void
  slower?: () => void
  reset?: () => void
  size: number
  speed: number
}

const ROTATION = { inputRange: [0, 1], outputRange: ["0deg", "360deg"] }

class Repo extends Component<RepoProps> {
  animation: Animated.CompositeAnimation | null = null
  state = {
    spinny: new Animated.Value(0),
  }

  UNSAFE_componentWillReceiveProps(newProps: RepoProps) {
    if (newProps.avatar && newProps.speed) {
      // stop the current running animation
      if (this.animation) {
        this.animation.stop()
        this.animation = null
      }
      setTimeout(this.animate, 10)
    }

    if (newProps.avatar === undefined) {
      if (this.animation) {
        this.animation.stop()
        this.animation = null
      }
    }
  }

  animate = () => {
    const duration = 100 * (this.props.speed || 1)
    const easing = Easing.linear
    this.state.spinny.setValue(0)
    this.animation = Animated.sequence([
      Animated.timing(this.state.spinny, { toValue: 1, duration, easing, useNativeDriver: false }),
    ])
    this.animation.start(({ finished }) => {
      if (finished) {
        this.animate()
      } else {
        this.animation = null
      }
    })
  }

  getAnimationStyle = () => {
    return {
      transform: [{ rotate: this.state.spinny.interpolate(ROTATION) }],
    }
  }

  render() {
    const { repo, name, avatar, message, size } = this.props
    const avatarSource = avatar !== undefined ? { uri: avatar } : false

    const avatarStyles: ImageStyle = mergeRight($avatar, {
      width: size,
      height: size,
      borderRadius: size ? size * 0.5 : undefined,
    })

    const centerStyles = mergeRight($center, this.getAnimationStyle())

    return (
      <View style={$container}>
        <Text style={$repo}>{repo || " "}</Text>
        <View style={$middle}>
          <View style={$left}>
            <Button
              style={$button}
              textStyle={$darkText}
              disabledTextStyle={$disabledText}
              tx="imageActions.bigger"
              onPress={this.props.bigger}
              disabled={this.props.size >= 140}
            />
            <Button
              style={$button}
              textStyle={$darkText}
              disabledTextStyle={$disabledText}
              tx="imageActions.smaller"
              onPress={this.props.smaller}
              disabled={this.props.size <= 40}
            />
          </View>
          <Animated.View style={centerStyles}>
            <TouchableWithoutFeedback onPress={this.props.reset}>
              {avatarSource ? (
                <Image style={avatarStyles} source={avatarSource as ImageSourcePropType} />
              ) : (
                <View style={avatarStyles} />
              )}
            </TouchableWithoutFeedback>
          </Animated.View>
          <View style={$right}>
            <Button
              style={$button}
              textStyle={$darkText}
              disabledTextStyle={$disabledText}
              tx="imageActions.faster"
              onPress={this.props.faster}
              disabled={this.props.speed <= 10}
            />
            <Button
              style={$button}
              textStyle={$darkText}
              disabledTextStyle={$disabledText}
              tx="imageActions.slower"
              onPress={this.props.slower}
              disabled={this.props.speed >= 50}
            />
          </View>
        </View>
        <Text style={$name}>{name || " "}</Text>
        <Text style={$message}>{message}</Text>
        {this.props.reset && (
          <Button
            style={$button}
            textStyle={$darkText}
            disabledTextStyle={$disabledText}
            tx="imageActions.reset"
            onPress={this.props.reset}
          />
        )}
      </View>
    )
  }
}

const $avatar: ImageStyle = {
  borderColor: colors.white,
  borderRadius: 40,
  borderWidth: 4,
  height: 80,
  marginVertical: 15,
  width: 80,
}
const $center: ViewStyle = {
  alignItems: "center",
  justifyContent: "center",
}
const $container: ViewStyle = {
  alignItems: "center",
}
const $left: ViewStyle = {
  alignItems: "flex-end",
  justifyContent: "flex-end",
  paddingRight: 10,
}
const $message: TextStyle = {
  color: colors.repoText,
  fontSize: 12,
  height: 100,
  marginTop: 20,
  overflow: "hidden",
  paddingHorizontal: 50,
}
const $middle: ViewStyle = {
  alignItems: "center",
  flexDirection: "row",
}
const $name: TextStyle = {
  color: colors.text,
}
const $repo: TextStyle = {
  color: colors.text,
  fontWeight: "bold",
}
const $right: ViewStyle = {
  alignItems: "center",
  justifyContent: "center",
  paddingLeft: 10,
}

const $darkText: TextStyle = {
  color: colors.textDim,
}
const $disabledText: TextStyle = {
  color: colors.palette.neutral400,
}
const $button: ViewStyle = {
  minWidth: 100,
}

export { Repo }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1615** (2026-08-13): **fix(reactotron-react-native): harden fetch interceptor error isolation and restore**
  *Symptoms*: ## Please verify the following:  - [x] `yarn build-and-test:local` passes - [x] I have added tests for any new features, if relevant - [x] `README.md` (or relevant documentation) has been updated with your changes  ## Describe your PR  > **Stacked on #1613 — do not merge first.** This branch contains #1613's two commits plus one hardening commit (`171bbc6e`). Once #1613 merges, this rebases down to just the fix commit.  Follow-up hardening for the expo/fetch interceptor from #1613, aligning it with how mainstream fetch instrumentors (Sentry, Datadog RUM, OpenTelemetry) guard the monkey-patching boundary:  ### Error isolation All reactotron-internal work inside the wrapped fetch (request parsing, open/response callbacks) now runs in try/catch, so an instrumentation bug can never make the app's own `fetch` throw, reject a successful response, or replace a network error. Previously `fetch("https://x.test/?q=%E0%A4%A")` threw a synchronous `URIError` out of the app's own call via `decodeURIComponent`; query-param decoding now falls back to the raw string on malformed percent-encoding.  ### Guarded restore ("good citizen" unpatching) `disableInterception` only reassigns `globalThis.fetch` when it is still our wrapper. If a third party (Sentry, MSW, a polyfill) wrapped fetch after us, the global is left alone and our wrapper goes inert (pass-through) — matching Datadog's documented instrumentation etiquette. It also restores what was global at enable time, so disabling after wrappi

- **Issue #1614** (2026-08-12): **docs(contributing): add runtime verification guide**
  *Symptoms*: ## Describe your PR  Adds `docs/contributing/runtime-verification.md`: a maintainer guide for verifying fixes at runtime — and more generally, for scriptable end-to-end testing between a real development build of the desktop app and an app on a simulator. Covers: PR worktree + packed tarballs, running the desktop app under a CDP port with a copy-paste `cdp.js` timeline reader, building a test app that matches the bug's environment, and baseline-vs-fix methodology with a control request.  Also adds a super-minimal root `AGENTS.md` (with `CLAUDE.md` symlinked to it) that just routes coding agents to the existing contributing docs, so it won't go stale.  Docs-only change.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #1613** (2026-08-13): **feat(reactotron-react-native): track Expo expo/fetch in the networking plugin**
  *Symptoms*: ## Please verify the following:  - [x] `yarn build-and-test:local` passes - [x] I have added tests for any new features, if relevant - [x] `README.md` (or relevant documentation) has been updated with your changes  ## Describe your PR    Closes #1612 .  ### Problem  Expo SDK 56 installs `expo/fetch` as the default `globalThis.fetch`. `expo/fetch` is backed by a native module and **bypasses `XMLHttpRequest`**, so the `networking` plugin's `XHRInterceptor` never sees it — on Expo SDK 56+ the plugin silently misses all `fetch` traffic.  (For context, the existing `XHRInterceptor` only covers React Native's XHR-backed `fetch`. The same blind spot affects other XHR-based network inspectors on Expo SDK 56+.)  ### Solution  Add a `FetchInterceptor` that mirrors `XHRInterceptor`'s shape (`set*Callback` / `enableInterception` / `disableInterception`) and wraps the global `fetch` **only when it is the `expo/fetch` builtin**, detected via `Symbol.for("expo.builtin")`. React Native's XHR-backed `fetch` is left to `XHRInterceptor`, so there is **no double-reporting**. The `networking` plugin wires Reactotron into it in `onConnect`, gated by a new `ignoreExpoFetch` option.  Care was taken to keep this safe for `expo/fetch`'s streaming model:  - The wrapper returns the original `Response` **immediately** and reads the body off a **clone**, asynchronously — the caller is never blocked and streaming bodies stay intact. - `text/event-stream` (and the existing image conte
  **Post-Mortem & Fix Analysis**:
  > Following up on the expo-router gap above with a concrete proposal: ShanavasPS/reactotron#1 (stacked on this PR's branch, for you to verify and merge into this PR if you like the approach).  Instead of more environment sniffing, it uses dependency injection — the app passes the exact fetch reference it wants tracked:  ```ts .useReactNative({ networking: { fetch: globalThis.fetch } }) ```  Auto-detection stays the default so nothing changes for existing users, but expo-router apps get a one-line fix instead of a silent no-op — and injecting a reference composes with other non-XHR fetch implementations too (e.g. [react-native-nitro-fetch](https://github.com/margelo/react-native-nitro-fetch); untested there, only the expo path was verified). We verified it at runtime on an expo-router SDK 57 iOS app where this branch currently no-ops: with the option set, fetch traffic appears in the timeline with correct method/params/status, the caller's response is untouched, and XHR reports exactly on

- **Issue #1612** (2026-08-13): **Network requests not captured on Expo SDK 56**
  *Symptoms*: ### Describe the bug  ### Summary  On Expo SDK 56, Reactotron's networking timeline shows **no network requests**. SDK 56 installs `expo/fetch` as the global `fetch` by default, and `expo/fetch` is a native implementation that does **not** go through `XMLHttpRequest`. Reactotron's network instrumentation only patches `XMLHttpRequest`, so it never observes any traffic. Console `log`/`display` events are unaffected — only the network timeline is empty.  This affects **both** project types:  - **Managed Expo apps** — `expo` is loaded at startup (e.g. via `expo-router/entry`), so the `fetch` swap happens from app launch and the network timeline is empty from the start. - **Bare React Native apps that use Expo packages** — the swap runs the first time anything imports the `expo` package at runtime. Importing an Expo package triggers `expo/src/Expo.fx`, which loads the Winter runtime and replaces `global.fetch`. For example, calling `useCameraPermissions()` from `expo-camera` (which imports from `expo`) is enough. So in a bare app the network timeline can appear to work and then go empty once such a code path is loaded. (A type-only reference like `useRef<CameraView>(null)` is elided by the Babel pipeline and does NOT trigger it — only a runtime import does.)  ### Environment  - `reactotron-react-native`: 5.2.0 (also confirmed against `master`, last pushed 2026-05-28) - Reactotron desktop: 3.11.0 - Expo SDK: 56 - React Native: 0.85.3 (New Architecture) - Platform: iOS & Android - R
  **Post-Mortem & Fix Analysis**:
  > A PR for this is up: #1613  — adds a FetchInterceptor (mirroring the existing xhr-interceptor.ts) that wraps the global fetch only when it's the expo.builtin implementation, wired into the networking plugin behind a new ignoreExpoFetch option.
  > Status update for anyone landing here:  - **The base fix is in #1613** (approved, merging soon): the networking plugin now detects Expo SDK 56+'s `expo/fetch` global and tracks it, with no double-reporting alongside XHR. - **If you use expo-router** (the default `create-expo-app` template): the router's startup polyfill re-wraps `globalThis.fetch` in a way that hides it from the automatic detection, so fetch tracking silently won't kick in. **Workaround** — pass fetch explicitly:    ```js   Reactotron.configure()     .useReactNative({       networking: { fetch: globalThis.fetch },     })     .connect();   ```    Caveats: capture `globalThis.fetch` in your app code (which runs after `expo-router/entry`), and don't use this together with `EXPO_PUBLIC_USE_RN_FETCH=1` (that fetch is XHR-backed and already tracked — you'd get duplicates). Full docs land with #1615. - **Automatic detection for expo-router apps is in the works** — the router wrapper carries its own marker symbol we can recogn
  > 📦 Released: **reactotron-react-native@5.3.0** adds Expo `expo/fetch` tracking to the networking plugin (#1613), and **5.3.1** hardens the fetch interceptor's error isolation and restore behavior (#1615). Both are on npm now.  Note for **expo-router** apps: the router setup drops the `expo.builtin` symbol from `globalThis.fetch`, so automatic detection doesn't kick in yet. Until auto-detection lands, pass fetch explicitly:  ```js Reactotron.useReactNative({   networking: { fetch: globalThis.fetch }, }) ```  Verified end-to-end against the published npm artifact on an Expo SDK 57 expo-router app (iOS simulator): fetch requests appear in the timeline with correct method/status/body, XHR is not double-reported, malformed percent-encoded URLs no longer throw, and the app runs fine with Reactotron disconnected.

- **Issue #1611** (2026-05-28): **feat(reactotron-react-native): re-export McpRedaction types for mcpRedaction config**
  *Symptoms*: The nx tasks didn't pick up reactotron-react-native for a new release with the latest changes, this forces a new release with the mcp redaction config changes via declaring reactotron-core-contract a direct dependency and re-exporting the redaction types 

- **Issue #1610** (2026-05-04): **chore(ci): bump publish-docs orb to @0.5**
  *Symptoms*: ## Please verify the following:  - [x] `yarn build-and-test:local` passes - [ ] I have added tests for any new features, if relevant - [x] `README.md` (or relevant documentation) has been updated with your changes  ## Describe your PR  Bumps the `infinitered/publish-docs` orb from `@0.4` (resolves to v0.4.13) to `@0.5` (resolves to v0.5.1). This unbreaks `publish-docs/publish_docs` on master pushes when the merge commit body contains markdown / multi-line content.  ### Why  The orb's v0.4.13 wrote unescaped multi-line shell content to `$BASH_ENV` via `echo "export VAR=\"$VAL\""`. When the merge commit's body had colons (e.g. inline JSON snippets) or newlines, bash interpreted each line as a command after sourcing `$BASH_ENV` at the start of the next step. Symptom on the master push for #1609:  ``` /tmp/.bash_env-...-build: line 39: README.md: command not found /tmp/.bash_env-...-build: line 39: NPM_TOKEN: command not found ... [40+ more] Error: Not a GitHub URL. Exited with code exit status 1 ```  ### Changes  - `.circleci/config.yml` — bump `publish-docs: infinitered/publish-docs@0.4` → `@0.5`.  ### Notes  - Fix is upstream in [infinitered/orb-publish-docs#40](https://github.com/infinitered/orb-publish-docs/pull/40), released as `v0.5.1` today. Replaces the unsafe `echo "export VAR=\"$VAL\""` patterns with `printf 'export VAR=%q\n' "$VAL"` in 5 internal scripts. - The `0.4 → 0.5` diff is internal only — no job, command, or parameter signatures change. All existing usage (`pu

- **Issue #1609** (2026-05-01): **chore(ci): migrate npm publish to trusted publishing via OIDC**
  *Symptoms*: ## Please verify the following:  - [x] `yarn build-and-test:local` passes - [ ] I have added tests for any new features, if relevant - [x] `README.md` (or relevant documentation) has been updated with your changes  ## Describe your PR  Migrates the reactotron CI publish pipeline from classic `NPM_TOKEN` auth to **npm Trusted Publishing via CircleCI OIDC**. npm GA'd CircleCI support on [2026-04-06](https://github.blog/changelog/2026-04-06-npm-trusted-publishing-now-supports-circleci/); this PR wires us up.  The pipeline has been broken since npm revoked classic tokens on 2025-12-09 and #1602 left the renamed `reactotron-npm-context` with an empty `NPM_TOKEN`. Rather than mint a granular replacement (capped at 90 days) and rotate forever, OIDC eliminates the human-managed token entirely.  ### Changes  - `.circleci/config.yml` (`release_package` job) — replaces the `npm whoami` + `~/.npmrc` token write with a "Mint npm OIDC token" step using `circleci run oidc get --claims '{"aud":"npm:registry.npmjs.org"}'`. - `scripts/release.artifacts.mjs` — accepts either `NPM_TOKEN` or `NPM_ID_TOKEN`, and performs the npm OIDC token exchange directly (`POST /-/npm/v1/oidc/token/exchange/package/<ident>`). This in-script exchange is a workaround for [yarnpkg/berry#7122](https://github.com/yarnpkg/berry/pull/7122): Yarn 4.14.1's `getOidcToken` helper handles CircleCI, but the `allowOidc` gate in `publish.ts` only flips on for `GITHUB_ACTIONS` / `GITLAB_CI`. Once 7122 lands and we bump Yarn, t

- **Issue #1608** (2026-04-24): **feat(reactotron-mcp): expand redaction defaults and add form-urlencoded body support**
  *Symptoms*: ## Summary  Stacks on top of #1607. Expands the MCP redactor's default denylists to match the cross-tool industry consensus and adds per-field redaction for `application/x-www-form-urlencoded` request bodies. Research comparing how other developer tools handle this is below — the short version: the closest analogs (Proxyman MCP, Sentry MCP, GitHub MCP, Postman) all redact at the server boundary by default, and their built-in denylists are broader than what #1607 currently ships.  ## Changes  ### Default rules — additions  **Header names** - CSRF / XSRF variants: `x-csrf-token`, `x-xsrf-token`, `csrf-token` - IP-forwarding PII headers: `x-forwarded-for`, `x-real-ip`  **Sensitive keys** - Password aliases: `passwd`, `pwd` - Generic auth-token names: `token`, `bearer`, `jwt`, `id_token`, `idtoken` - Session & CSRF: `session`, `sessionid`, `session_id`, `csrf`, `xsrf`, `csrf_token`, `xsrf_token` - OAuth: `client_secret`, `clientsecret`, `x-api-key`  **Value patterns** - Anthropic API keys (`sk-ant-…`) - AWS access key IDs (`AKIA…`) - Google API keys (`AIza…` + 35 chars) - Stripe secret/publishable/restricted keys, live + test (`(?:sk|pk|rk)_(?:test|live)_…`) - PEM-encoded private key blocks (RSA, EC, DSA, OPENSSH, PGP, generic) - GitHub PAT regex broadened from `ghp_` only to `gh[pousr]_` — covers classic, server-to-server, OAuth, user-to-server, and refresh tokens  ### Form-urlencoded body redaction  A new code path catches strings shaped like `k=v&k=v` with no URL prefix (typic

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

### Incident Patch 1: `11162d76` (2026-08-13)
**Commit Message**: fix(reactotron-react-native): harden fetch interceptor error isolation and restore (#1615)

## Please verify the following:

- [x] `yarn build-and-test:local` passes
- [x] I have added tests for any new features, if relevant
- [x] `README.md` (or relevant documentation) has been updated with your
changes

## Describe your PR

> **Stacked on #1613 — do not merge first.** This branch contains
#1613's two commits plus one hardening commit (`171bbc6e`). Once #1613
merges, this rebases down to just the fix commit.

Follow-up hardening for the expo/fetch interceptor from #1613, aligning
it with how mainstream fetch instrumentors (Sentry, Datadog RUM,
OpenTelemetry) guard the monkey-patching boundary:

### Error isolation
All reactotron-internal work inside the wrapped fetch (request parsing,
open/response callbacks) now runs in try/catch, so an instrumentation
bug can never make the app's own `fetch` throw, reject a successful
response, or replace a network error. Previously
`fetch("https://x.test/?q=%E0%A4%A")` threw a synchronous `URIError` out
of the app's own call via `decodeURIComponent`; query-param decoding now
falls back to the raw string on malformed percent-encoding.

### Guard

**File**: `docs/plugins/networking.md` (modified, +20/-0)
```diff
@@ -33,10 +33,30 @@ And you're done! Now you can see your XMLHttpRequests in Reactotron.
 - `ignoreContentTypes`: a regular expression which, when matched against the `Content-Type` response header, will prevent the data from being displayed in Reactotron. You typically want to do this for images (which is the default). `text/event-stream` response bodies are always skipped so streaming responses are not buffered.
 - `ignoreUrls`: a regular expression which, when matched against the URL of the request, will prevent the request from being tracked in Reactotron. Can be useful for ignoring noisy logging requests.
 - `ignoreExpoFetch`: set to `true` to skip instrumenting Expo's `expo/fetch` (the default `globalThis.fetch` on Expo SDK 56+). Has no effect on non-Expo runtimes, where the global fetch is XHR-backed and already covered by XHR tracking.
+- `fetch`: explicitly pass the fetch function to track; it is wrapped and installed as `globalThis.fetch` on connect, skipping the automatic `expo/fetch` detection. Takes precedence over `ignoreExpoFetch`.
 
 ```js
 networking({
   ignoreContentTypes: /^(image)\/.*$/i,
   ignoreUrls: /\/(logs|symbolicate)$/,
 });
 ```
+
+### Tracking fetch in expo-router apps
+
+Expo Router (the default `create-expo-app` template) re-wraps `globalThis.fetch` at startup with its `window.location` polyfill, which drops the marker the automatic `expo/fetch` detection looks for — so on expo-router apps fetch requests are silently not tracked. Automatic detection for expo-router apps is in the works (tracked in [#1612](https://github.com/infinitered/reactotron/issues/1612)); until then, use the `fetch` option to track them:
+
+```js
+Reactotron.configure()
+  .useReactNative({
+    networking: { fetch: globalThis.fetch },
+  })
+  .connect();
+```
+
+Two caveats:
+
+- **Ordering**: capture `globalThis.fetch` in code that runs _after_ `expo-router/entry` has set up its wrapper (any module imported from your app code qualifies — the router entry runs first). Capturing it too early passes the pre-router fetch, and the router's wrapper will be bypassed or clobbered.
+- **No XHR-backed fetch**: only pass a fetch that does _not_ go through `XMLHttpRequest` (e.g. don't use this with `EXPO_PUBLIC_USE_RN_FETCH=1`). XHR-backed fetch is already tracked by the XHR interceptor, so wrapping it here would double-report every request.
+
+Also note: Expo SDK 56 releases before 56.0.19 have a `Response.clone()` bug ([expo#46397](https://github.com/expo/expo/pull/46397)) where cloning a response twice can throw a spurious "body already used" error. Reactotron reads response bodies off a clone while tracking is active, so if your app also clones responses, upgrade to expo 56.0.19+ (or SDK 57).
```

**File**: `lib/reactotron-react-native/src/fetch-interceptor.test.ts` (modified, +101/-0)
```diff
@@ -141,4 +141,105 @@ describe("FetchInterceptor", () => {
     expect(globalThis.fetch).toBe(original)
     expect(FetchInterceptor.isInterceptorEnabled()).toBe(false)
   })
+
+  it("does not break the caller's fetch when the open callback throws", async () => {
+    const response = makeResponse(200, {})
+    globalThis.fetch = makeExpoFetch(() => Promise.resolve(response))
+    FetchInterceptor.setOpenCallback(() => {
+      throw new Error("reactotron bug")
+    })
+    FetchInterceptor.enableInterception()
+
+    const result = await (globalThis.fetch as any)("https://x.test/?q=%E0%A4%A")
+    expect(result).toBe(response)
+  })
+
+  it("does not reject a successful response when the response callback throws", async () => {
+    const response = makeResponse(200, {})
+    globalThis.fetch = makeExpoFetch(() => Promise.resolve(response))
+    FetchInterceptor.setResponseCallback(() => {
+      throw new Error("reactotron bug")
+    })
+    FetchInterceptor.enableInterception()
+
+    const result = await (globalThis.fetch as any)("https://x.test")
+    expect(result).toBe(response)
+  })
+
+  it("propagates the app's own network error even when the response callback throws", async () => {
+    const boom = new Error("offline")
+    globalThis.fetch = makeExpoFetch(() => Promise.reject(boom))
+    FetchInterceptor.setResponseCallback(() => {
+      throw new Error("reactotron bug")
+    })
+    FetchInterceptor.enableInterception()
+
+    await expect((globalThis.fetch as any)("https://x.test")).rejects.toBe(boom)
+  })
+
+  it("leaves the global alone on disable when a third party wrapped fetch after us", async () => {
+    const response = makeResponse(200, {})
+    const original = makeExpoFetch(() => Promise.resolve(response))
+    globalThis.fetch = original
+    FetchInterceptor.enableInterception()
+    const ours = globalThis.fetch
+
+    // a third party wraps on top of us
+    const thirdParty: any = (...args: any[]) => (ours as any)(...args)
+    globalThis.fetch = thirdParty
+
+    FetchInterceptor.disableInterception()
+
+    // the third party's wrapper must survive, and ours must pass through inert
+    expect(globalThis.fetch).toBe(thirdParty)
+    const open = jest.fn()
+    FetchInterceptor.setOpenCallback(open)
+    const result = await (globalThis.fetch as any)("https://x.test")
+    expect(result).toBe(response)
+    expect(open).not.toHaveBeenCalled()
+  })
+
+  it("does not install an explicit non-global fetch onto the global on disable", () => {
+    const globalBefore: any = jest.fn()
+    globalThis.fetch = globalBefore
+    const explicit: any = jest.fn(() => Promise.resolve(makeResponse(200, {})))
+
+    FetchInterceptor.enableInterception(explicit)
+    expect(globalThis.fetch).not.toBe(globalBefore)
+
+    FetchInterceptor.disableInterception()
+    // restore what was global when we wrapped — never the explicit function
+    expect(globalThis.fetch).toBe(globalBefore)
+  })
+
+  it("extracts method and url from Request-object input", async () => {
+    const response = makeResponse(200, {})
+    globalThis.fetch = makeExpoFetch(() => Promise.resolve(response))
+    const open = jest.fn()
+    FetchInterceptor.setOpenCallback(open)
+    FetchInterceptor.enableInterception()
+
+    const request = new Request("https://example.com/req", { method: "PUT" })
+    await (globalThis.fetch as any)(request)
+
+    expect(open).toHaveBeenCalledTimes(1)
+    const [method, url] = open.mock.calls[0]
+    expect(method).toBe("PUT")
+    expect(url).toBe("https://example.com/req")
+  })
+
+  it("extracts the url from URL-object input", async () => {
+    const response = makeResponse(200, {})
+    globalThis.fetch = makeExpoFetch(() => Promise.resolve(response))
+    const open = jest.fn()
+    FetchInterceptor.setOpenCallback(open)
+    FetchInterceptor.enableInterception()
+
+    await (globalThis.fetch as any)(new URL("https://example.com/from-url"))
+
+    expect(open).toHaveBeenCalledTimes(1)
+    const
```

**File**: `lib/reactotron-react-native/src/fetch-interceptor.ts` (modified, +66/-19)
```diff
@@ -49,6 +49,9 @@ interface ReactotronFetch {
 let openCallback: FetchInterceptorOpenCallback | null
 let responseCallback: FetchInterceptorResponseCallback | null
 let originalFetch: typeof fetch | null = null
+let wrappedFetch: ReactotronFetch | null = null
+let previousGlobalFetch: typeof fetch | null = null
+let wrapperState: { stopped: boolean } | null = null
 let requestId = 0
 
 function isExpoFetch(fn: unknown): boolean {
@@ -140,35 +143,65 @@ export const FetchInterceptor = {
     }
 
     originalFetch = current as typeof fetch
+    previousGlobalFetch = globalThis.fetch
+
+    // Closed over (rather than reading module state) so the wrapper keeps
+    // working as a plain pass-through even after disableInterception, when a
+    // third party has wrapped fetch on top of us and we can't restore the global.
+    const original = current as typeof fetch
+    const state = { stopped: false }
 
     const wrapped: ReactotronFetch = function (input: any, init?: any) {
+      if (state.stopped) {
+        return original(input, init)
+      }
+
       const id = (requestId += 1)
-      const requestHeaders = headersToObject(
-        (init && init.headers) || (isRequest(input) ? input.headers : null)
-      )
-      const data =
-        init && typeof init.body === "string"
-          ? init.body
-          : init && init.body
-            ? "[non-string body]"
-            : null
-
-      if (openCallback) {
-        openCallback(getMethod(input, init), getUrl(input), requestHeaders, data, id)
+      // Reactotron-internal failures must never alter the app's fetch — parse
+      // and report inside try/catch, and always defer to the real fetch.
+      try {
+        if (openCallback) {
+          const requestHeaders = headersToObject(
+            (init && init.headers) || (isRequest(input) ? input.headers : null)
+          )
+          const data =
+            init && typeof init.body === "string"
+              ? init.body
+              : init && init.body
+                ? "[non-string body]"
+                : null
+          openCallback(getMethod(input, init), getUrl(input), requestHeaders, data, id)
+        }
+      } catch (instrumentationError) {
+        // swallow: reporting is best-effort, the request itself must proceed
       }
 
-      return (originalFetch as typeof fetch)(input, init).then(
+      return original(input, init).then(
         (response) => {
           // Fire synchronously and return the original response untouched, so
           // the caller is never blocked and streaming bodies stay intact.
-          if (responseCallback) {
-            responseCallback(id, response.status, headersToObject(response.headers), response, null)
+          try {
+            if (responseCallback) {
+              responseCallback(
+                id,
+                response.status,
+                headersToObject(response.headers),
+                response,
+                null
+              )
+            }
+          } catch (instrumentationError) {
+            // swallow: a reporting failure must not reject a successful response
           }
           return response
         },
         (error) => {
-          if (responseCallback) {
-            responseCallback(id, -1, null, null, error)
+          try {
+            if (responseCallback) {
+              responseCallback(id, -1, null, null, error)
+            }
+          } catch (instrumentationError) {
+            // swallow: the app's own network error must propagate unchanged
           }
           throw error
         }
@@ -180,16 +213,30 @@ export const FetchInterceptor = {
     if (isExpoFetch(current)) {
       wrapped[EXPO_BUILTIN] = true
     }
+    wrappedFetch = wrapped
+    wrapperState = state
     globalThis.fetch = wrapped
   },
 
-  // Unpatch the global fetch and remove the callbacks.
+  // Unpatch the global fetch and remove the callbacks. If something else has
+  // wrapped fetch on top of us since, the global
```

**File**: `lib/reactotron-react-native/src/plugins/networking.test.ts` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+/**
+ * Plugin-level tests for the expo/fetch side of the networking plugin
+ * (onFetchOpen / onFetchResponse), driven through the real FetchInterceptor.
+ */
+
+// xhr-interceptor captures XMLHttpRequest.prototype methods at module load, so
+// a stub must exist before the plugin (which imports it) is required.
+/* eslint-disable @typescript-eslint/no-empty-function */
+class FakeXMLHttpRequest {
+  open() {}
+
+  send() {}
+
+  setRequestHeader() {}
+}
+/* eslint-enable @typescript-eslint/no-empty-function */
+;(globalThis as any).XMLHttpRequest = FakeXMLHttpRequest
+
+// Disable reason: must require after the XMLHttpRequest stub is installed.
+/* eslint-disable @typescript-eslint/no-var-requires */
+const networking = require("./networking").default
+const { FetchInterceptor } = require("../fetch-interceptor")
+const { XHRInterceptor } = require("../xhr-interceptor")
+/* eslint-enable @typescript-eslint/no-var-requires */
+
+function makeResponse(
+  status: number,
+  headersObj: Record<string, string>,
+  bodyText = "",
+  cloneThrows = false
+) {
+  return {
+    status,
+    headers: {
+      get: (k: string) => headersObj[k.toLowerCase()] ?? null,
+      forEach: (cb: (v: string, k: string) => void) =>
+        Object.entries(headersObj).forEach(([k, v]) => cb(v, k)),
+    },
+    clone() {
+      if (cloneThrows) throw new TypeError("Response body is already used")
+      return this
+    },
+    text: () => Promise.resolve(bodyText),
+  }
+}
+
+const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))
+
+describe("networking plugin (expo/fetch path)", () => {
+  const realFetch = globalThis.fetch
+  let reactotron: { startTimer: () => () => number; apiResponse: jest.Mock }
+
+  function connect(response: any, options: Record<string, unknown> = {}) {
+    const fetchImpl: any = jest.fn(() => Promise.resolve(response))
+    reactotron = { startTimer: () => () => 42, apiResponse: jest.fn() }
+    const plugin = networking({ fetch: fetchImpl, ...options })(reactotron as any)
+    plugin.onConnect()
+    return fetchImpl
+  }
+
+  afterEach(() => {
+    FetchInterceptor.disableInterception()
+    XHRInterceptor.disableInterception()
+    globalThis.fetch = realFetch
+  })
+
+  it("reports request and response through apiResponse", async () => {
+    connect(makeResponse(200, { "content-type": "application/json" }, '{"ok":true}'))
+
+    await (globalThis.fetch as any)("https://example.com/x?a=1&b=two+words", { method: "POST" })
+    await flushPromises()
+
+    expect(reactotron.apiResponse).toHaveBeenCalledTimes(1)
+    const [tronRequest, tronResponse, duration] = reactotron.apiResponse.mock.calls[0]
+    expect(tronRequest.url).toBe("https://example.com/x?a=1&b=two+words")
+    expect(tronRequest.method).toBe("POST")
+    expect(tronRequest.params).toEqual({ a: "1", b: "two words" })
+    expect(tronResponse.status).toBe(200)
+    expect(tronResponse.body).toEqual({ ok: true })
+    expect(duration).toBe(42)
+  })
+
+  it("does not throw on malformed percent-encoding in query params", async () => {
+    connect(makeResponse(200, { "content-type": "application/json" }, "{}"))
+
+    // %E0%A4%A is malformed — decodeURIComponent would throw
+    await expect(
+      (globalThis.fetch as any)("https://example.com/x?q=%E0%A4%A&ok=1")
+    ).resolves.toBeDefined()
+    await flushPromises()
+
+    expect(reactotron.apiResponse).toHaveBeenCalledTimes(1)
+    const [tronRequest] = reactotron.apiResponse.mock.calls[0]
+    // malformed value falls back to the raw string; valid values still decode
+    expect(tronRequest.params).toEqual({ q: "%E0%A4%A", ok: "1" })
+  })
+
+  it("reports ~~~ unreadable ~~~ when clone() throws", async () => {
+    connect(makeResponse(200, { "content-type": "application/json" }, "", true))
+
+    await (globalThis.fetch as any)("https://example.com/x")
+    await flushPromises()
+
+    expect(reactotron.apiResponse).toHaveBeenCalledTimes(1)
+    const [, tro
```

**File**: `lib/reactotron-react-native/src/plugins/networking.ts` (modified, +23/-4)
```diff
@@ -38,6 +38,18 @@ export interface NetworkingOptions {
 
 const DEFAULTS: NetworkingOptions = {}
 
+/**
+ * decodeURIComponent that falls back to the raw string on malformed
+ * percent-encoding (e.g. `?q=%E0%A4%A`) instead of throwing.
+ */
+function tryDecodeURIComponent(value: string): string {
+  try {
+    return decodeURIComponent(value)
+  } catch (malformedUri) {
+    return value
+  }
+}
+
 const networking =
   (pluginConfig: NetworkingOptions = {}) =>
   (reactotron: ReactotronCore) => {
@@ -203,7 +215,7 @@ const networking =
           .forEach((pair) => {
             const [key, value] = pair.split("=")
             if (key && value !== undefined) {
-              params[key] = decodeURIComponent(value.replace(/\+/g, " "))
+              params[key] = tryDecodeURIComponent(value.replace(/\+/g, " "))
             }
           })
       }
@@ -249,9 +261,16 @@ const networking =
       }
 
       // Clone synchronously (before the caller consumes the body), then read
-      // asynchronously so we don't block the request.
-      response
-        .clone()
+      // asynchronously so we don't block the request. clone() itself can throw
+      // if the body is already disturbed (e.g. another tool consumed it first).
+      let clone: Response
+      try {
+        clone = response.clone()
+      } catch (cloneError) {
+        report("~~~ unreadable ~~~")
+        return
+      }
+      clone
         .text()
         .then((text) => {
           let body
```

---

### Incident Patch 2: `0250737e` (2026-03-30)
**Commit Message**: fix(reactotron-app): give the package description a glow-up (#1603)

**File**: `apps/reactotron-app/package.json` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   "name": "reactotron-app",
   "productName": "Reactotron",
   "version": "3.8.2",
-  "description": "Reactotron desktop mode engage!",
+  "description": "A desktop app for inspecting your React JS and React Native projects. macOS, Linux, and Windows.",
   "author": {
     "name": "Infinite Red",
     "email": "hello@infinite.red",
```

---

### Incident Patch 3: `65dd6b75` (2025-10-13)
**Commit Message**: fix: parseErrorStack export in reactotron-react-native (#1588)

## Please verify the following:

- [x] `yarn build-and-test:local` passes
- [ ] I have added tests for any new features, if relevant
- [ ] `README.md` (or relevant documentation) has been updated with your
changes

## Describe your PR

This PR fixes module loading issues in the `trackGlobalErrors` plugin
where React Native's internal error stack parsing utilities could fail
to load properly.

Resolves #1573

### Changes
- Added support for both CommonJS (`module.exports`) and ESM (`export
default`) module formats when requiring `parseErrorStack` and
`symbolicateStackTrace` from React Native
- Added runtime validation to ensure loaded utilities are functions
before use
- Enhanced error reporting with detailed debug logging including:
  - Availability checks for each utility
  - Type information when validation fails
  - Module structure details for debugging

### Problem
The previous implementation assumed a specific module export format from
React Native's internal modules
(`react-native/Libraries/Core/Devtools/parseErrorStack` and
`symbolicateStackTrace`), which could fail in certain React Native
versions or build con

**File**: `lib/reactotron-react-native/src/plugins/trackGlobalErrors.ts` (modified, +40/-5)
```diff
@@ -71,11 +71,23 @@ const trackGlobalErrors = (options?: TrackGlobalErrorsOptions) => (reactotron: R
   // manually fire an error
   function reportError(error: Parameters<typeof LogBox.addException>[0]) {
     try {
-      parseErrorStack =
-        parseErrorStack || require("react-native/Libraries/Core/Devtools/parseErrorStack")
-      symbolicateStackTrace =
-        symbolicateStackTrace ||
-        require("react-native/Libraries/Core/Devtools/symbolicateStackTrace")
+      if (!parseErrorStack) {
+        const parseErrorStackModule = require("react-native/Libraries/Core/Devtools/parseErrorStack")
+        // Handle both CommonJS (module.exports) and ESM (export default) formats
+        parseErrorStack =
+          typeof parseErrorStackModule === "function"
+            ? parseErrorStackModule
+            : parseErrorStackModule.default
+      }
+
+      if (!symbolicateStackTrace) {
+        const symbolicateStackTraceModule = require("react-native/Libraries/Core/Devtools/symbolicateStackTrace")
+        // Handle both CommonJS (module.exports) and ESM (export default) formats
+        symbolicateStackTrace =
+          typeof symbolicateStackTraceModule === "function"
+            ? symbolicateStackTraceModule
+            : symbolicateStackTraceModule.default
+      }
     } catch (e) {
       client.error(
         'Unable to load "react-native/Libraries/Core/Devtools/parseErrorStack" or "react-native/Libraries/Core/Devtools/symbolicateStackTrace"',
@@ -86,6 +98,29 @@ const trackGlobalErrors = (options?: TrackGlobalErrorsOptions) => (reactotron: R
     }
 
     if (!parseErrorStack || !symbolicateStackTrace) {
+      client.error("parseErrorStack or symbolicateStackTrace is not available", [])
+      client.debug({
+        parseErrorStackAvailable: !!parseErrorStack,
+        symbolicateStackTraceAvailable: !!symbolicateStackTrace,
+      })
+      return
+    }
+
+    if (typeof parseErrorStack !== "function") {
+      client.error("parseErrorStack is not a function", [])
+      client.debug({
+        parseErrorStackType: typeof parseErrorStack,
+        parseErrorStack,
+      })
+      return
+    }
+
+    if (typeof symbolicateStackTrace !== "function") {
+      client.error("symbolicateStackTrace is not a function", [])
+      client.debug({
+        symbolicateStackTraceType: typeof symbolicateStackTrace,
+        symbolicateStackTrace,
+      })
       return
     }
 
```

---

### Incident Patch 4: `28d5884b` (2025-10-01)
**Commit Message**: chore(circleci): fix windows release by adding build_and_test

**File**: `.circleci/config.yml` (modified, +8/-0)
```diff
@@ -438,6 +438,8 @@ workflows:
           filters:
             branches:
               only: *release_branch_names
+            tags:
+              only: *release_app_filter
       - release_tags:
           context:
             - infinitered-npm-package
@@ -474,6 +476,8 @@ workflows:
             branches: *release_branch_filter
             tags:
               only: *release_app_filter
+          requires:
+            - build_and_test
       - build_app_macos:
           context:
             - ReactotronCerts
@@ -482,13 +486,17 @@ workflows:
             branches: *release_branch_filter
             tags:
               only: *release_app_filter
+          requires:
+            - build_and_test
       - build_app_linux:
           context:
             - infinitered-npm-package
           filters:
             branches: *release_branch_filter
             tags:
               only: *release_app_filter
+          requires:
+            - build_and_test
       - release_app:
           context:
             - infinitered-npm-package
```

---

### Incident Patch 5: `8c16592f` (2025-09-19)
**Commit Message**: fix(eslint-plugin-reactotron): Fix ESLint Plugin CommonJS Export Compatibility (#1578)

## Please verify the following:

- [x] `yarn build-and-test:local` passes
- [ ] I have added tests for any new features, if relevant
- [ ] `README.md` (or relevant documentation) has been updated with your
changes

## Describe your PR
Fixes:
[infinitered/ignite#2997](https://github.com/infinitered/ignite/issues/2997)

### Problem
The eslint-plugin-reactotron v0.1.8 fails with "Definition for rule
'reactotron/no-tron-in-production' was not found". This affects all new
Ignite CLI projects and any project using the ESLint plugin.

### Root Cause 
Migration from Rollup to react-native-builder-bob changed the CommonJS
export format. Builder Bob outputs exports.default = plugin (standard
Babel behavior), but ESLint expects the plugin to be available directly
as the module export, not nested under .default.

### Solution
Modified the source code export structure to improve CommonJS
compatibility:

```ts
// Before
const eslintPluginReactotron: Linter.Plugin = {
  rules: {
    "no-tron-in-production": noTronInProduction,
  },
} satisfies Linter.Plugin

export default eslintPluginReactotron

// After  
ex

**File**: `lib/eslint-plugin-reactotron/src/index.ts` (modified, +6/-6)
```diff
@@ -16,10 +16,10 @@ import { noTronInProduction } from "./rules/no-tron-in-production"
     }
   ```
  */
-const eslintPluginReactotron: Linter.Plugin = {
-  rules: {
-    "no-tron-in-production": noTronInProduction,
-  },
-} satisfies Linter.Plugin
+export const rules: Record<string, any> = {
+  "no-tron-in-production": noTronInProduction,
+}
 
-export default eslintPluginReactotron
+// Export the plugin object directly
+const plugin: Linter.Plugin = { rules }
+export default plugin
```

---

### Incident Patch 6: `a8eed616` (2025-09-09)
**Commit Message**: fix(networking): vendor in XHRInterceptor implementation instead of importing (#1571)

## Please verify the following:

- [x] `yarn build-and-test:local` passes
- [ ] I have added tests for any new features, if relevant
- [ ] `README.md` (or relevant documentation) has been updated with your
changes

## Describe your PR

Introduced a new XHRInterceptor module to intercept and monitor
XMLHttpRequest methods in React Native. This replaces the brittle deep
import strategy that breaks between react native versions.

Closes #1569

## How To Test

### Using Example App

1. `yarn`
2. `yarn build`
3. `yarn workspace example-app start`
4. `yarn workspace example-app ios` or `yarn workspace example-app
android` to build the example app
5. `yarn workspace reactotron-app start` to start the local Reactotron
in development
6. Make sure Reactotron is connected to the native app
7. Navigate to the Networking tab in the example app
8. Tap "Make an API Call"
9. See API call happens in Reactotron plugin. 


https://github.com/user-attachments/assets/94635b4d-57cf-4197-88ba-9fa95595120e

**File**: `lib/reactotron-react-native/src/plugins/networking.ts` (modified, +1/-61)
```diff
@@ -1,65 +1,5 @@
 import type { ReactotronCore, Plugin } from "reactotron-core-client"
-
-// Attempt to require XHRInterceptor using static paths
-let XHRInterceptorModule
-try {
-  // Try path first (for RN >= 0.80)
-  XHRInterceptorModule = require("react-native/src/private/devsupport/devmenu/elementinspector/XHRInterceptor")
-} catch (e) {
-  try {
-    // Try path for RN 0.79
-    // Yay breaking changes :( https://github.com/facebook/react-native/releases/tag/v0.79.0#:~:text=APIs%3A%20Move-,XHRInterceptor,-API%20to%20src
-    XHRInterceptorModule = require("react-native/src/private/inspector/XHRInterceptor")
-  } catch (e2) {
-    try {
-      // Fallback to the old path (for RN < 0.79)
-      XHRInterceptorModule = require("react-native/Libraries/Network/XHRInterceptor")
-    } catch (e3) {
-      console.error("Reactotron: Failed to require XHRInterceptor from all known paths.", e, e2, e3)
-      console.warn(
-        "Reactotron: XHRInterceptor could not be loaded. Network monitoring will be disabled."
-      )
-      // Assign a dummy object later if checks fail
-      XHRInterceptorModule = null // Indicate failure to require
-    }
-  }
-}
-
-let XHRInterceptor
-if (XHRInterceptorModule) {
-  // Check if methods are directly on the module
-  if (
-    typeof XHRInterceptorModule.setSendCallback === "function" &&
-    typeof XHRInterceptorModule.setResponseCallback === "function" &&
-    typeof XHRInterceptorModule.enableInterception === "function"
-  ) {
-    XHRInterceptor = XHRInterceptorModule
-  }
-  // Check if methods are on the default export
-  else if (
-    XHRInterceptorModule.default &&
-    typeof XHRInterceptorModule.default.setSendCallback === "function" &&
-    typeof XHRInterceptorModule.default.setResponseCallback === "function" &&
-    typeof XHRInterceptorModule.default.enableInterception === "function"
-  ) {
-    XHRInterceptor = XHRInterceptorModule.default
-  }
-}
-
-// If still no valid XHRInterceptor after checking module and module.default, assign the dummy
-if (!XHRInterceptor) {
-  // Log error only if we initially managed to require *something*
-  if (XHRInterceptorModule) {
-    console.error("Reactotron: Required XHRInterceptor module does not have expected methods.")
-    console.warn("Reactotron: Network monitoring will be disabled.")
-  }
-  // Assign a dummy object to prevent crashes later when calling its methods
-  XHRInterceptor = {
-    setSendCallback: () => {},
-    setResponseCallback: () => {},
-    enableInterception: () => {},
-  }
-}
+import { XHRInterceptor } from "../xhr-interceptor"
 
 /**
  * Don't include the response bodies for images by default.
```

**File**: `lib/reactotron-react-native/src/xhr-interceptor.ts` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+/* eslint-disable prefer-rest-params */
+
+/**
+ * Copyright (c) Meta Platforms, Inc. and affiliates.
+ *
+ * This source code is licensed under the MIT license found in the
+ * LICENSE file in the root directory of this source tree.
+ *
+ * Vendored from: https://github.com/callstackincubator/rozenite/blob/402e3579878f72cbae7f8123f9ca80459dc1fe7f/packages/network-activity-plugin/src/react-native/http/xhr-interceptor.ts
+ * Original source: https://github.com/facebook/react-native/blob/2c683c5787dd03ac15d2aad45dcc53650529ee7f/packages/react-native/src/private/devsupport/devmenu/elementinspector/XHRInterceptor.js
+ */
+
+const originalXHROpen = XMLHttpRequest.prototype.open
+const originalXHRSend = XMLHttpRequest.prototype.send
+const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader
+
+type XHRInterceptorOpenCallback = (method: string, url: string, request: XMLHttpRequest) => void
+
+type XHRInterceptorSendCallback = (data: string, request: XMLHttpRequest) => void
+
+type XHRInterceptorRequestHeaderCallback = (
+  header: string,
+  value: string,
+  request: XMLHttpRequest
+) => void
+
+type XHRInterceptorHeaderReceivedCallback = (
+  responseContentType: string | undefined,
+  responseSize: number | undefined,
+  allHeaders: string,
+  request: XMLHttpRequest
+) => void
+
+type XHRInterceptorResponseCallback = (
+  status: number,
+  timeout: number,
+  response: string,
+  responseURL: string,
+  responseType: string,
+  request: XMLHttpRequest
+) => void
+
+let openCallback: XHRInterceptorOpenCallback | null
+let sendCallback: XHRInterceptorSendCallback | null
+let requestHeaderCallback: XHRInterceptorRequestHeaderCallback | null
+let headerReceivedCallback: XHRInterceptorHeaderReceivedCallback | null
+let responseCallback: XHRInterceptorResponseCallback | null
+
+let isInterceptorEnabled = false
+
+/**
+ * A network interceptor which monkey-patches XMLHttpRequest methods
+ * to gather all network requests/responses, in order to show their
+ * information in the React Native inspector development tool.
+ * This supports interception with XMLHttpRequest API, including Fetch API
+ * and any other third party libraries that depend on XMLHttpRequest.
+ */
+export const XHRInterceptor = {
+  /**
+   * Invoked before XMLHttpRequest.open(...) is called.
+   */
+  setOpenCallback(callback: XHRInterceptorOpenCallback) {
+    openCallback = callback
+  },
+
+  /**
+   * Invoked before XMLHttpRequest.send(...) is called.
+   */
+  setSendCallback(callback: XHRInterceptorSendCallback) {
+    sendCallback = callback
+  },
+
+  /**
+   * Invoked after xhr's readyState becomes xhr.HEADERS_RECEIVED.
+   */
+  setHeaderReceivedCallback(callback: XHRInterceptorHeaderReceivedCallback) {
+    headerReceivedCallback = callback
+  },
+
+  /**
+   * Invoked after xhr's readyState becomes xhr.DONE.
+   */
+  setResponseCallback(callback: XHRInterceptorResponseCallback) {
+    responseCallback = callback
+  },
+
+  /**
+   * Invoked before XMLHttpRequest.setRequestHeader(...) is called.
+   */
+  setRequestHeaderCallback(callback: XHRInterceptorRequestHeaderCallback) {
+    requestHeaderCallback = callback
+  },
+
+  isInterceptorEnabled(): boolean {
+    return isInterceptorEnabled
+  },
+
+  enableInterception() {
+    if (isInterceptorEnabled) {
+      return
+    }
+    // Override `open` method for all XHR requests to intercept the request
+    // method and url, then pass them through the `openCallback`.
+    // $FlowFixMe[cannot-write]
+    // $FlowFixMe[missing-this-annot]
+    XMLHttpRequest.prototype.open = function (method: string, url: string) {
+      if (openCallback) {
+        openCallback(method, url, this)
+      }
+      originalXHROpen.apply(this, arguments)
+    }
+
+    // Override `setRequestHeader` method for all XHR requests to intercept
+    // the request headers, then pass them through the `requestHeaderCallback`.
+    // $FlowFixMe[cannot-write]
+    // $FlowFixMe[missing-this-a
```

---

### Incident Patch 7: `7f718b6d` (2025-08-12)
**Commit Message**: fix: PLUGIN_DEFAULTS type in asyncStorage.ts (#1558)

**File**: `lib/reactotron-react-native/src/plugins/asyncStorage.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ export interface AsyncStorageOptions {
   ignore?: string[]
 }
 
-const PLUGIN_DEFAULTS: AsyncStorageOptions = {
+const PLUGIN_DEFAULTS: Required<AsyncStorageOptions> = {
   ignore: [],
 }
 
```

---

### Incident Patch 8: `187cbc11` (2025-06-23)
**Commit Message**: fix(networking): add XHRInterceptor path for RN 0.80 (#1563)

With the release of React Native 0.80, XHRInterceptor path got changed,
again.

This is an extension of RN 0.79 support PR https://github.com/infinitered/reactotron/pull/1556

**File**: `lib/reactotron-react-native/src/plugins/networking.ts` (modified, +16/-11)
```diff
@@ -3,20 +3,25 @@ import type { ReactotronCore, Plugin } from "reactotron-core-client"
 // Attempt to require XHRInterceptor using static paths
 let XHRInterceptorModule
 try {
-  // Try the new path first (for RN >= 0.79)
-  // Yay breaking changes :( https://github.com/facebook/react-native/releases/tag/v0.79.0#:~:text=APIs%3A%20Move-,XHRInterceptor,-API%20to%20src
-  XHRInterceptorModule = require("react-native/src/private/inspector/XHRInterceptor")
+  // Try path first (for RN >= 0.80)
+  XHRInterceptorModule = require("react-native/src/private/devsupport/devmenu/elementinspector/XHRInterceptor")
 } catch (e) {
   try {
-    // Fallback to the old path (for RN < 0.79)
-    XHRInterceptorModule = require("react-native/Libraries/Network/XHRInterceptor")
+    // Try path for RN 0.79
+    // Yay breaking changes :( https://github.com/facebook/react-native/releases/tag/v0.79.0#:~:text=APIs%3A%20Move-,XHRInterceptor,-API%20to%20src
+    XHRInterceptorModule = require("react-native/src/private/inspector/XHRInterceptor")
   } catch (e2) {
-    console.error("Reactotron: Failed to require XHRInterceptor from both known paths.", e, e2)
-    console.warn(
-      "Reactotron: XHRInterceptor could not be loaded. Network monitoring will be disabled."
-    )
-    // Assign a dummy object later if checks fail
-    XHRInterceptorModule = null // Indicate failure to require
+    try {
+      // Fallback to the old path (for RN < 0.79)
+      XHRInterceptorModule = require("react-native/Libraries/Network/XHRInterceptor")
+    } catch (e3) {
+      console.error("Reactotron: Failed to require XHRInterceptor from all known paths.", e, e2, e3)
+      console.warn(
+        "Reactotron: XHRInterceptor could not be loaded. Network monitoring will be disabled."
+      )
+      // Assign a dummy object later if checks fail
+      XHRInterceptorModule = null // Indicate failure to require
+    }
   }
 }
 
```

---

### Incident Patch 9: `e92a47bd` (2025-04-22)
**Commit Message**: fix(networking): require XHRInterceptor based on React Native version (#1556)

## Please verify the following:

- [x] `yarn build-and-test:local` passes

## Describe your PR

Resolves https://github.com/infinitered/reactotron/issues/420
https://github.com/infinitered/reactotron/issues/1554
- Now we try to require two different known paths for XHRInterceptor in
React Native.
- Implemented error handling for loading the XHRInterceptor module,
ensuring network monitoring is disabled gracefully if it fails to load.

## Test Plan

Install PR changes using [contributing
guide](https://docs.infinite.red/reactotron/contributing/#bring-your-own-application)

- Install `reactotron-react-native` in a `"react-native": "^0.79.0"` app
and verify that network calls are logged


https://github.com/user-attachments/assets/47826a64-c498-4bc8-a69e-b2b464150552


- Install `reactotron-react-native` in a `"react-native": "0.78.0"` app
and verify that network calls are logged


https://github.com/user-attachments/assets/1b5da333-5710-484f-a352-c1583f24c8d5

**File**: `lib/reactotron-react-native/src/plugins/networking.ts` (modified, +56/-1)
```diff
@@ -1,6 +1,61 @@
-import XHRInterceptor from "react-native/Libraries/Network/XHRInterceptor"
 import type { ReactotronCore, Plugin } from "reactotron-core-client"
 
+// Attempt to require XHRInterceptor using static paths
+let XHRInterceptorModule
+try {
+  // Try the new path first (for RN >= 0.79)
+  // Yay breaking changes :( https://github.com/facebook/react-native/releases/tag/v0.79.0#:~:text=APIs%3A%20Move-,XHRInterceptor,-API%20to%20src
+  XHRInterceptorModule = require("react-native/src/private/inspector/XHRInterceptor")
+} catch (e) {
+  try {
+    // Fallback to the old path (for RN < 0.79)
+    XHRInterceptorModule = require("react-native/Libraries/Network/XHRInterceptor")
+  } catch (e2) {
+    console.error("Reactotron: Failed to require XHRInterceptor from both known paths.", e, e2)
+    console.warn(
+      "Reactotron: XHRInterceptor could not be loaded. Network monitoring will be disabled."
+    )
+    // Assign a dummy object later if checks fail
+    XHRInterceptorModule = null // Indicate failure to require
+  }
+}
+
+let XHRInterceptor
+if (XHRInterceptorModule) {
+  // Check if methods are directly on the module
+  if (
+    typeof XHRInterceptorModule.setSendCallback === "function" &&
+    typeof XHRInterceptorModule.setResponseCallback === "function" &&
+    typeof XHRInterceptorModule.enableInterception === "function"
+  ) {
+    XHRInterceptor = XHRInterceptorModule
+  }
+  // Check if methods are on the default export
+  else if (
+    XHRInterceptorModule.default &&
+    typeof XHRInterceptorModule.default.setSendCallback === "function" &&
+    typeof XHRInterceptorModule.default.setResponseCallback === "function" &&
+    typeof XHRInterceptorModule.default.enableInterception === "function"
+  ) {
+    XHRInterceptor = XHRInterceptorModule.default
+  }
+}
+
+// If still no valid XHRInterceptor after checking module and module.default, assign the dummy
+if (!XHRInterceptor) {
+  // Log error only if we initially managed to require *something*
+  if (XHRInterceptorModule) {
+    console.error("Reactotron: Required XHRInterceptor module does not have expected methods.")
+    console.warn("Reactotron: Network monitoring will be disabled.")
+  }
+  // Assign a dummy object to prevent crashes later when calling its methods
+  XHRInterceptor = {
+    setSendCallback: () => {},
+    setResponseCallback: () => {},
+    enableInterception: () => {},
+  }
+}
+
 /**
  * Don't include the response bodies for images by default.
  */
```

---

### Incident Patch 10: `a4bbe6dd` (2025-03-17)
**Commit Message**: fix(reactotron-core-ui): Move commandListener callbacks outside of render cycle (#1544 by @jamonholmgren)

[skip ci]

**File**: `apps/reactotron-app/src/renderer/contexts/Standalone/useStandalone.ts` (modified, +15/-5)
```diff
@@ -135,12 +135,15 @@ export function reducer(state: State, action: Action) {
           return
         }
 
-        draftState.commandListeners.forEach((cl) => cl(action.payload))
-
         const connection = draftState.connections.find(
           (c) => c.clientId === action.payload.clientId
         )
 
+        if (!connection) {
+          console.error("Command received for unknown connection", action.payload)
+          return
+        }
+
         connection.commands = [action.payload, ...connection.commands]
       })
     case ActionTypes.ClearConnectionCommands:
@@ -205,9 +208,16 @@ function useStandalone() {
   }, [])
 
   // Called when commands are flowing in.
-  const commandReceived = useCallback((command: any) => {
-    dispatch({ type: ActionTypes.CommandReceived, payload: command })
-  }, [])
+  const commandReceived = useCallback(
+    (command: any) => {
+      // First dispatch to update state
+      dispatch({ type: ActionTypes.CommandReceived, payload: command })
+
+      // Then notify listeners
+      state.commandListeners.forEach((cl) => cl(command))
+    },
+    [state.commandListeners]
+  )
 
   // Called when a client disconnects. NOTE: They could be coming back. This could happen with a reload of the simulator!
   const connectionDisconnected = useCallback((connection: ReactotronConnection) => {
```

#### Recent Merged Pull Requests:
- **PR #1615** (2026-08-13): fix(reactotron-react-native): harden fetch interceptor error isolation and restore (@joshuayoes)
- **PR #1614** (2026-08-12): docs(contributing): add runtime verification guide (@joshuayoes)
- **PR #1613** (2026-08-13): feat(reactotron-react-native): track Expo expo/fetch in the networking plugin (@ShanavasPS)
- **PR #1611** (2026-05-28): feat(reactotron-react-native): re-export McpRedaction types for mcpRedaction config (@silasjmatson)
- **PR #1610** (2026-05-04): chore(ci): bump publish-docs orb to @0.5 (@joshuayoes)
- **PR #1609** (2026-05-01): chore(ci): migrate npm publish to trusted publishing via OIDC (@joshuayoes)
- **PR #1608** (2026-04-24): feat(reactotron-mcp): expand redaction defaults and add form-urlencoded body support (@joshuayoes)
- **PR #1607** (2026-05-28): feat: add MCP redaction filtering for sensitive data (@silasjmatson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
