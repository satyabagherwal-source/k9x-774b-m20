# Forensic Learning Record (Deep Inspection): gluestack/gluestack-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/gluestack-gluestack-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gluestack/gluestack-ui](https://github.com/gluestack/gluestack-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:01:45.809Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gluestack/gluestack-ui`
- **Description**: React & React Native Components & Patterns (copy-paste components & patterns crafted with Tailwind CSS (NativeWind))
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5317 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/kitchen-sink/app/(home)/_layout.tsx`
```
import { View, Pressable } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useRouter, Slot, useSegments } from 'expo-router';
import { LayoutGrid, Sparkles } from 'lucide-react-native';
import { useState, createContext, useContext, useEffect } from 'react';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

/* -------------------------------------------------------------------------- */
/*                             TAB VISIBILITY CONTEXT                         */
/* -------------------------------------------------------------------------- */

type TabBarContextValue = {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

const TabBarContext = createContext<TabBarContextValue>({
  hidden: false,
  setHidden: () => {},
});

export const useTabBar = () => useContext(TabBarContext);

/* -------------------------------------------------------------------------- */
/*                                   LAYOUT                                   */
/* -------------------------------------------------------------------------- */

export default function HomeLayout() {
  const supportsLiquidGlass = isLiquidGlassAvailable();
  const segments = useSegments();
  const [hidden, setHidden] = useState(false);

  // Auto-hide native tabs on detail screens based on route depth
  // Show tabs only on root tab screens (e.g., /components or /showcases)
  // Hide tabs on detail screens (e.g., /components/button or /showcases/showcase-1)
  const shouldHideTabs = segments.length > 2;

  // ✅ Native iOS Liquid Glass with automatic tab visibility control
  if (supportsLiquidGlass) {
    return (
      <TabBarContext.Provider value={{ hidden: shouldHideTabs, setHidden }}>
        <NativeTabs hidden={shouldHideTabs}>
          <NativeTabs.Trigger name="components">
            <NativeTabs.Trigger.Label>Components</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="view_module" />
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="showcases">
            <NativeTabs.Trigger.Label>Showcases</NativeTabs.Trigger.Label>
            <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
          </NativeTabs.Trigger>
        </NativeTabs>
      </TabBarContext.Provider>
    );
  }

  // ✅ Custom Tabs with route-based visibility
  return (
    <TabBarContext.Provider value={{ hidden: shouldHideTabs, setHidden }}>
      <View className="flex-1">
        <Slot />
        <CustomTabs />
      </View>
    </TabBarContext.Provider>
  );
}

function CustomTabs() {
  const router = useRouter();
  const segments = useSegments();

  // Determine current active tab from route segments
  const currentTab = (segments[1] as 'components' | 'showcases') || 'components';

  // Animated value for sliding indicator
  const translateX = useSharedValue(0);

  // Update animation when tab changes
  useEffect(() => {
    // Approximate tab width + gap (adjust these values based on your actual measurements)
    const TAB_WIDTH = 100; // Width of each tab item
    const GAP = 0; // Gap between tabs

    if (currentTab === 'components') {
      translateX.value = withTiming(0, {
        duration: 150,
        easing: Easing.linear, // Ease-in-out cubic
      });
    } else {
      translateX.value = withTiming(TAB_WIDTH + GAP, {
        duration: 150,
        easing: Easing.linear, // Ease-in-out cubic
      });
    }
  }, [currentTab]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  function onTabPress(tab: 'components' | 'showcases') {
    // Only navigate if we're not already on this tab
    if (currentTab !== tab) {
      router.replace(`/(home)/${tab}`);
    }
  }

  // Hide tabs on detail screens (e.g., /components/button or /showcases/showcase-1)
  // Show tabs only on root tab screens (e.g., /components or /showcases)
  const shouldHideTabs = segments.length > 2; // ['(home)', 'components'] = 2, ['(home)', 'components', 'button'] = 3

  if (shouldHideTabs) {
    return null;
  }

  return (
    <View className="absolute web:bottom-4 bottom-safe left-0 right-0 items-center w-fit mx-auto">
      <View
        style={{
          shadowColor: 'rgba(0, 0, 0, 0.4)',
          shadowOffset: {
            width: 0,
            height: 12,
          },
          shadowOpacity: 0.3,
          shadowRadius: 16.0,

          elevation: 30,
        }}
        className="flex-row  p-1 rounded-full bg-white dark:bg-muted justify-center "
      >
        {/* Animated Background Indicator */}
        <Animated.View
          style={[animatedStyle]}
          className="absolute left-1 top-1 bottom-1 w-[100px] dark:bg-white/15 bg-black/10  rounded-full"
        />

        <TabItem
          active={currentTab === 'components'}
          label="Components"
          IconComponent={LayoutGrid}
          onPress={() => onTabPress('components')}
        />

        <TabItem
          active={currentTab === 'showcases'}
          label="Showcases"
          IconComponent={Sparkles}
          onPress={() => onTabPress('showcases')}
        />
      </View>
    </View>
  );
}

function TabItem({
  active,
  label,
  IconComponent,
  onPress,
}: {
  active: boolean;
  label: string;
  IconComponent: React.ComponentType<any>;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View className=" py-2 rounded-full flex-col items-center gap-0.5 w-[100px]">
        <Icon
          as={IconComponent}
          size="xl"
          className={`stroke-[1.5] ${IconComponent === Sparkles && active ? 'fill-blue-400 stroke-blue-400' : IconComponent === Sparkles ? 'fill-foreground stroke-foreground' : IconComponent===LayoutGrid&&active ? 'fill-none stroke-blue-400' : IconComponent===LayoutGrid ? 'fill-none stroke-foreground' : ''}`}
        />

        <Text
          className={`text-[10px] font-medium  ${active ? 'text-blue-400' : 'text-foreground/60'}`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

```

### Core Architecture Module: `apps/kitchen-sink/app/(home)/_tabs/components-tab.tsx`
```
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useAccessibilityInfo } from '@/helpers/use-accessability-info';
import { useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  BottomControlBar,
  type ComponentItem,
} from '@/components/custom/bottom-control-bar';
import { HStack } from '@/components/ui/hstack';
import { Image } from '@/components/ui/image';
import { COMPONENTS_LIST } from '@/constants/components-list';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Cards gradient colors
const GRADIENT_COLORS = [
  ['#3497D266', '#3497D2'] as const,
  ['#C94AB480', '#C94AB4'] as const,
  ['#4facfe', '#3497D2'] as const,
  ['#26AF5F80', '#26AF5F'] as const,
  ['#fa709a', '#fee140'] as const,
  ['#30cfd0', '#330867'] as const,
  ['#a8edea', '#fed6e3'] as const,
  ['#ff9a9e', '#fecfef'] as const,
  ['#ffecd2', '#fcb69f'] as const,
  ['#ff6e7f', '#bfe9ff'] as const,
  ['#e0c3fc', '#8ec5fc'] as const,
  ['#f093fb', '#f5576c'] as const,
  ['#fbc2eb', '#a6c1ee'] as const,
  ['#fdcbf1', '#e6dee9'] as const,
  ['#a1c4fd', '#c2e9fb'] as const,
  ['#d299c2', '#fef9d7'] as const,
  ['#667eea', '#764ba2'] as const,
  ['#fa709a', '#fee140'] as const,
  ['#30cfd0', '#330867'] as const,
  ['#43e97b', '#38f9d7'] as const,
  ['#4facfe', '#00f2fe'] as const,
];

const components = COMPONENTS_LIST;

type ComponentCardProps = {
  item: ComponentItem;
  index: number;
  displayIndex: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  spacing: number;
  height: number;
  onPress: () => void;
};

const ComponentCard = memo(
  ({
    item,
    index,
    displayIndex,
    scrollX,
    itemWidth,
    spacing,
    height,
    onPress,
  }: ComponentCardProps) => {
    const { reduceTransparencyEnabled } = useAccessibilityInfo();
    const applyOpacity = reduceTransparencyEnabled;

    const animatedStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * (itemWidth + spacing),
        index * (itemWidth + spacing),
        (index + 1) * (itemWidth + spacing),
      ];

      return {
        opacity: applyOpacity
          ? interpolate(
              scrollX.get(),
              inputRange,
              [0.6, 1, 0.6],
              Extrapolation.CLAMP
            )
          : 1,
        transform: [
          {
            scale: interpolate(
              scrollX.get(),
              inputRange,
              [0.8, 1.1, 0.8],
              Extrapolation.CLAMP
            ),
          },
        ],
      };
    });

    const gradientColors = GRADIENT_COLORS[index % GRADIENT_COLORS.length];

    return (
      <View
        style={{
          width: itemWidth + spacing,
          height,
          paddingTop: 100,
          alignItems: 'center',
        }}
      >
        <Animated.View
          style={[
            {
              width: itemWidth,
              height: height * 0.55,
            },
            animatedStyle,
          ]}
        >
          <Pressable
            onPress={onPress}
            style={{ width: '100%', height: '100%' }}
          >
            <Card className="flex-1 justify-center p-8 pr-0 overflow-hidden max-h-[400px] rounded-3xl border-0">
              <AnimatedLinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View className="flex-1 justify-between">
                <Text className="text-white font-sans text-8xl font-bold opacity-30 leading-[1.1] tracking-tighter">
                  {displayIndex.toString()}
                </Text>
                {item.icon && (
                  <Icon as={item.icon} className="h-32 w-full stroke-none" />
                )}
                <View className="gap-1">
                  <Text className="text-white font-sans text-2xl font-semibold">
                    {item.title}
                  </Text>
                  <Text className="text-slate-50 text-sm font-sans">
                    {item.count} Variants
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        </Animated.View>
      </View>
    );
  }
);

ComponentCard.displayName = 'ComponentCard';

export default function ComponentsTab() {
  const router = useRouter();
  const [currentComponent, setCurrentComponent] = useState<ComponentItem>(
    components[0]!
  );

  const { isDark } = useAppTheme();
  const { width, height } = useWindowDimensions();

  const ITEM_WIDTH = width > 680 ? width * 0.3 : width * 0.6;
  const SPACING = 5;
  const SIDE_OFFSET = (width - ITEM_WIDTH) / 2 - SPACING / 2;
  const CONTENT_HEIGHT = height * 0.75;

  const { reduceTransparencyEnabled } = useAccessibilityInfo();
  const applyBlur = !reduceTransparencyEnabled && Platform.OS === 'ios';

  const listRef = useRef<FlatList<ComponentItem>>(null);
  const isNavigatingRef = useRef(false);

  // Reset navigation guard when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
    }, [])
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ item: ComponentItem }> }) => {
      if (viewableItems.length > 0 && viewableItems[0]) {
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setCurrentComponent(viewableItems[0].item);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
  });

  const animatedProps = useAnimatedProps(() => {
    if (components.length === 1) {
      return { intensity: 0 };
    }

    const inputRange: number[] = [];
    const outputRange: number[] = [];

    for (let i = 0; i < components.length; i++) {
      inputRange.push(i * (ITEM_WIDTH + SPACING));
      outputRange.push(0);

      if (i < components.length - 1) {
        inputRange.push((i + 0.5) * (ITEM_WIDTH + SPACING));
        outputRange.push(30);
      }
    }

    return {
      intensity: interpolate(scrollX.get(), inputRange, outputRange),
    };
  });

  const Header = useMemo(() => {
    return (
      <View className="items-center justify-center z-10 mt-20 gap-2">
        <HStack className="items-center gap-2">
          <Image
            source={{
              uri: isDark
                ? 'https://i.imgur.com/EUqtUMu.png'
                : 'https://i.imgur.com/9bvua6C.png',
            }}
            alt="Kitchensink App Logo"
            className="h-6 w-6"
          />
          <Text className="text-2xl font-bold font-sans">Kitchensink App</Text>
        </HStack>
        <Text className="max-w-[80%] text-foreground/80 text-center font-serif">
          Demo app showcasing all the gluestack ui components in action.
        </Text>
      </View>
    );
  }, [isDark]);

  const handleCardPress = useCallback(
    (path: string) => {
      // Prevent multiple rapid navigations
      if (isNavigatingRef.current) return;
      i
```

### Core Architecture Module: `apps/kitchen-sink/app/(home)/_tabs/showcases-tab.tsx`
```
import {
  BottomControlBar,
  type ComponentItem,
} from '@/components/custom/bottom-control-bar';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useAccessibilityInfo } from '@/helpers/use-accessability-info';
import { useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { memo, useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { styled } from 'nativewind';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Showcase1 from '../showcases/showcase-1';
import Showcase2 from '../showcases/showcase-2';
import Showcase3 from '../showcases/showcase-3';

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const StyledAnimatedFlatList = styled(Animated.FlatList, { className: 'style' });

// Define showcases with their components in one place
type ShowcaseItem = ComponentItem & {
  component: React.ComponentType;
};

const showcases: ShowcaseItem[] = [
  {
    title: 'Showcase 1',
    path: 'showcase-1',
    component: Showcase1,
  },
  {
    title: 'Showcase 2',
    path: 'showcase-2',
    component: Showcase2,
  },
  {
    title: 'Showcase 3',
    path: 'showcase-3',
    component: Showcase3,
  },
];

type ShowcaseCardProps = {
  item: ShowcaseItem;
  index: number;
  scrollX: SharedValue<number>;
  spacing: number;
  onPress: () => void;
};

const ShowcaseCard = memo(
  ({ item, index, scrollX, spacing, onPress }: ShowcaseCardProps) => {
    const { reduceTransparencyEnabled } = useAccessibilityInfo();
    const { width, height } = useWindowDimensions();
    const applyOpacity = reduceTransparencyEnabled;

    const cardWidth = width * 0.7;
    const cardHeight = height * 0.7;
    const SCALE = 0.7;

    const animatedStyle = useAnimatedStyle(() => {
      const inputRange = [
        (index - 1) * (cardWidth + spacing),
        index * (cardWidth + spacing),
        (index + 1) * (cardWidth + spacing),
      ];

      return {
        opacity: applyOpacity
          ? interpolate(
              scrollX.get(),
              inputRange,
              [0.7, 1, 0.7],
              Extrapolation.CLAMP
            )
          : 1,
      };
    });

    const ShowcaseComponent = item.component;

    return (

      <View
        style={{
          width: cardWidth + spacing,
          height: cardHeight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={[
            {
              width: cardWidth,
              height: cardHeight,
            },
            animatedStyle,
          ]}
        >
          <Pressable
            onPress={onPress}
            style={{ width: '100%', height: '100%' }}
          >
            <View
              className="flex-1 overflow-hidden rounded-3xl bg-background border border-border"
              pointerEvents="none"
            >
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Animated.View
                  style={{
                    width: width,
                    height: height,
                    transform: [{ scale: SCALE }],
                  }}
                >
                  <ShowcaseComponent />
                </Animated.View>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </View>

    );
  }
);

ShowcaseCard.displayName = 'ShowcaseCard';

export default function ShowcasesTab() {
  const router = useRouter();
  const [currentShowcase, setCurrentShowcase] = useState<ShowcaseItem>(
    showcases[0]!
  );

  const { isDark } = useAppTheme();
  const { width } = useWindowDimensions();

  const CARD_WIDTH = width * 0.7;
  const SPACING = 100;
  const SIDE_OFFSET = (width - CARD_WIDTH) / 2 - SPACING / 2;

  const { reduceTransparencyEnabled } = useAccessibilityInfo();
  const applyBlur = !reduceTransparencyEnabled && Platform.OS === 'ios';

  const listRef = useRef<FlatList<ShowcaseItem>>(null);
  const isNavigatingRef = useRef(false);

  // Reset navigation guard when screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
    }, [])
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ item: ShowcaseItem }> }) => {
      if (viewableItems.length > 0 && viewableItems[0]) {
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setCurrentShowcase(viewableItems[0].item);
      }
    },
    []
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const scrollX = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
  });

  const animatedProps = useAnimatedProps(() => {
    if (showcases.length === 1) {
      return { intensity: 0 };
    }

    const inputRange: number[] = [];
    const outputRange: number[] = [];

    for (let i = 0; i < showcases.length; i++) {
      inputRange.push(i * (CARD_WIDTH + SPACING));
      outputRange.push(0);

      if (i < showcases.length - 1) {
        inputRange.push((i + 0.5) * (CARD_WIDTH + SPACING));
        outputRange.push(30);
      }
    }

    return {
      intensity: interpolate(scrollX.get(), inputRange, outputRange),
    };
  });

  const handleCardPress = useCallback(
    (path: string) => {
      // Prevent multiple rapid navigations
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      router.push(`/(home)/showcases/${path}` as any);
    },
    [router]
  );

  const handleShowcaseSelect = useCallback(
    (showcase: ShowcaseItem, index: number) => {
      // Find original index in showcases array
      const originalIndex = showcases.findIndex(
        (s) => s.path === showcase.path
      );
      if (originalIndex !== -1) {
        // Delay scrolling by 1 second
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index: originalIndex,
            animated: true,
          });
        }, 1000);
        setCurrentShowcase(showcase);
      }
    },
    []
  );

  return (
    <View className="flex-1 bg-background">
      <StyledAnimatedFlatList
        ref={listRef}
        data={showcases}
        renderItem={({ item, index }) => (
          <ShowcaseCard
            item={item}
            index={index}
            scrollX={scrollX}
            spacing={SPACING}
            onPress={() => handleCardPress(item.path)}
          />
        )}
        className="mt-20"
        keyExtractor={(item) => item.path}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH + SPACING,
          offset: (CARD_WIDTH + SPACING) * index,
          index,
        })}
        horizontal
        snapToInterval={CARD_WIDTH + SPACING}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: SIDE_OFFSET,
        }}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      />
      {applyBlur && (
        <AnimatedBlurView
          pointerEvents="none"
          style={Styl
```

### Core Architecture Module: `apps/kitchen-sink/app/(home)/components/_layout.tsx`
```
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { ChevronLeftIcon, Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAppTheme } from '@/contexts/app-theme-context';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Custom Header Component with NativeWind styling
function CustomHeader({ title }: { title: string }) {
  const { isDark } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Box
      className=""
      style={{
        paddingTop: insets.top,
      }}
    >
      <Box className="absolute inset-0 bg-background" />

      <HStack className="items-center justify-between px-4 h-14">
        {/* Back Button */}
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="w-10 items-start justify-center"
        >
          <Icon
            as={ChevronLeftIcon}
            size="xl"
            className={isDark ? 'text-white' : 'text-black'}
          />
        </Pressable>

        {/* Title */}
        <Text
          className={`text-lg font-sans font-semibold text-center flex-1 ${isDark ? 'text-white' : 'text-black'}`}
        >
          {title}
        </Text>

        {/* Right placeholder for alignment */}
        <Box className="w-10" />
      </HStack>
    </Box>
  );
}

export default function ComponentsLayout() {
  const { isDark } = useAppTheme();
  const themeColorBackground = isDark ? '#000000' : '#ffffff';

  return (
    <Stack
      screenLayout={({ children }) => (
        <Box className="flex-1 bg-background">{children}</Box>
      )}
      screenOptions={{
        headerShown: true,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        fullScreenGestureEnabled: true,
        contentStyle: {
          backgroundColor: themeColorBackground,
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="accordion"
        options={{
          header: () => <CustomHeader title="Accordion" />,
        }}
      />
      <Stack.Screen
        name="calendar"
        options={{
          header: () => <CustomHeader title="Calendar" />,
        }}
      />
      <Stack.Screen
        name="alert"
        options={{
          header: () => <CustomHeader title="Alert" />,
        }}
      />
      <Stack.Screen
        name="alert-dialog"
        options={{
          header: () => <CustomHeader title="Alert Dialog" />,
        }}
      />
      <Stack.Screen
        name="avatar"
        options={{
          header: () => <CustomHeader title="Avatar" />,
        }}
      />
      <Stack.Screen
        name="form-control"
        options={{
          header: () => <CustomHeader title="Form Control" />,
        }}
      />
      <Stack.Screen
        name="actionsheet"
        options={{
          header: () => <CustomHeader title="Actionsheet" />,
        }}
      />
      <Stack.Screen
        name="badge"
        options={{
          header: () => <CustomHeader title="Badge" />,
        }}
      />
      <Stack.Screen
        name="box"
        options={{
          header: () => <CustomHeader title="Box" />,
        }}
      />
      <Stack.Screen
        name="button"
        options={{
          header: () => <CustomHeader title="Button" />,
        }}
      />
      <Stack.Screen
        name="card"
        options={{
          header: () => <CustomHeader title="Card" />,
        }}
      />
      <Stack.Screen
        name="center"
        options={{
          header: () => <CustomHeader title="Center" />,
        }}
      />
      <Stack.Screen
        name="checkbox"
        options={{
          header: () => <CustomHeader title="Checkbox" />,
        }}
      />
      <Stack.Screen
        name="divider"
        options={{
          header: () => <CustomHeader title="Divider" />,
        }}
      />
      <Stack.Screen
        name="drawer"
        options={{
          header: () => <CustomHeader title="Drawer" />,
        }}
      />
      <Stack.Screen
        name="fab"
        options={{
          header: () => <CustomHeader title="Fab" />,
        }}
      />
      <Stack.Screen
        name="grid"
        options={{
          header: () => <CustomHeader title="Grid" />,
        }}
      />
      <Stack.Screen
        name="heading"
        options={{
          header: () => <CustomHeader title="Heading" />,
        }}
      />
      <Stack.Screen
        name="hstack"
        options={{
          header: () => <CustomHeader title="HStack" />,
        }}
      />
      <Stack.Screen
        name="icon"
        options={{
          header: () => <CustomHeader title="Icon" />,
        }}
      />
      <Stack.Screen
        name="image"
        options={{
          header: () => <CustomHeader title="Image" />,
        }}
      />
      <Stack.Screen
        name="input"
        options={{
          header: () => <CustomHeader title="Input" />,
        }}
      />
      <Stack.Screen
        name="link"
        options={{
          header: () => <CustomHeader title="Link" />,
        }}
      />
      <Stack.Screen
        name="menu"
        options={{
          header: () => <CustomHeader title="Menu" />,
        }}
      />
      <Stack.Screen
        name="modal"
        options={{
          header: () => <CustomHeader title="Modal" />,
        }}
      />
      <Stack.Screen
        name="popover"
        options={{
          header: () => <CustomHeader title="Popover" />,
        }}
      />
      <Stack.Screen
        name="portal"
        options={{
          header: () => <CustomHeader title="Portal" />,
        }}
      />
      <Stack.Screen
        name="pressable"
        options={{
          header: () => <CustomHeader title="Pressable" />,
        }}
      />
      <Stack.Screen
        name="progress"
        options={{
          header: () => <CustomHeader title="Progress" />,
        }}
      />
      <Stack.Screen
        name="radio"
        options={{
          header: () => <CustomHeader title="Radio" />,
        }}
      />
      <Stack.Screen
        name="select"
        options={{
          header: () => <CustomHeader title="Select" />,
        }}
      />
      <Stack.Screen
        name="skeleton"
        options={{
          header: () => <CustomHeader title="Skeleton" />,
        }}
      />
      <Stack.Screen
        name="slider"
        options={{
          header: () => <CustomHeader title="Slider" />,
        }}
      />
      <Stack.Screen
        name="spinner"
        options={{
          header: () => <CustomHeader title="Spinner" />,
        }}
      />
      <Stack.Screen
        name="switch"
        options={{
          header: () => <CustomHeader title="Switch" />,
        }}
      />
      <Stack.Screen
        name="table"
        options={{
          header: () => <CustomHeader title="Table" />,
        }}
      />
      <Stack.Screen
        name="text"
        options={{
          header: () => <CustomHeader title="Text" />,
        }}
      />
      <Stack.Screen
        name="textarea"
        options={{
          header: () => <CustomHeader title="Textarea" />,
        }}
      />
      <Stack.Screen
        name="toast"
        options={{
          header: () => <CustomHeader title="Toast" />,
        }}
      />
      <Stack.Screen
        name="tooltip"
        options={{
          header: () => <CustomHeader title="Tooltip" />,
        }}
      />
      <Stack.Screen
        name="vstack"
        options={{
          header: () => <CustomHeader title="VStack" />,
        }}
      />
          <Stack.Screen

        name="bottomsheet"
        options={{
          header: () => <CustomHeader title="BottomSheet" />,
        
```

### Core Architecture Module: `apps/kitchen-sink/app/(home)/components/accordion.tsx`
```
import { Accordion, AccordionItem, AccordionHeader, AccordionTrigger, AccordionTitleText, AccordionContent, AccordionContentText, AccordionIcon } from '@/components/ui/accordion'
import { Divider } from '@/components/ui/divider'
import { ChevronDownIcon, ChevronUpIcon, AddIcon, RemoveIcon } from '@/components/ui/icon'


import React from 'react';
import { UsageVariantFlatList } from '@/components/custom/component-presentation/usage-variant-flatlist';

const ExampleBasic = () => {
return (
    <Accordion
      type="single"
      isCollapsible={ true }
      isDisabled={ false }
      className=" w-[90%]"
    >
      <AccordionItem value="a">
        <AccordionHeader>
          <AccordionTrigger>
            {({ isExpanded }) => {
              return (
                <>
                  <AccordionTitleText>
                    How do I place an order?
                  </AccordionTitleText>
                
                    <AccordionIcon as={ChevronDownIcon}  />
                 
                </>
              )
            }}
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <AccordionContentText>
            To place an order, simply select the products you want, proceed to
            checkout, provide shipping and payment information, and finalize
            your purchase.
          </AccordionContentText>
        </AccordionContent>
      </AccordionItem>
      <Divider className="bg-border" />
      <AccordionItem value="b">
        <AccordionHeader>
          <AccordionTrigger>
            {({ isExpanded }) => {
              return (
                <>
                  <AccordionTitleText>
                    What payment methods do you accept?
                  </AccordionTitleText>
                  <AccordionIcon as={ChevronDownIcon}  />
                </>
              )
            }}
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <AccordionContentText>
            We accept all major credit cards, including Visa, Mastercard, and
            American Express. We also support payments through PayPal.
          </AccordionContentText>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
};

const ExampleCustomizedComponent = () => {
return (
      <Accordion
      className="w-[90%]"
      type="multiple"
    >
      <AccordionItem value="a"
           className="border-b border-border"
        >
        <AccordionHeader 
        >
          <AccordionTrigger>
            {({ isExpanded }) => {
              return (
                <>
                  <AccordionTitleText>
           What does the "type" prop of the Accordion component do?
                  </AccordionTitleText>
                    
                      <AccordionIcon as={ChevronDownIcon} />

                </>
              );
            }}
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <AccordionContentText>
            The type prop determines whether one or multiple items can be
            opened at the same time. The default value is "single" which means
            only one item can be opened at a time. 
          </AccordionContentText>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem
        value="b"
        className="border-b border-border"
      >
        <AccordionHeader>
          <AccordionTrigger>
            {({ isExpanded }) => {
              return (
                <>
                  <AccordionTitleText>
                 Can I disable the whole accordion?
                  </AccordionTitleText>
                      <AccordionIcon as={ChevronDownIcon} />
                      
                </>
              );
            }}
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <AccordionContentText>
            Yes, you can disable the whole accordion by setting the isDisabled
            prop to true on the Accordion component.
          </AccordionContentText>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem
        value="c"
      >
        <AccordionHeader
        >
          <AccordionTrigger>
            {({ isExpanded }) => {
              return (
                <>
                  <AccordionTitleText>
                 What is a controlled accordion? How can I make it controlled?
                  </AccordionTitleText>
                       
                    <AccordionIcon as={ChevronDownIcon} />
                
                </>
              );
            }}
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent className=""
        >
          <AccordionContentText>
      Controlled components refer to the components where the state and behaviors are controlled by the Parent component. You can make the accordion a controlled component by passing the value prop to the Accordion component and setting the onValueChange prop to update the value prop. Refer to the controlled accordion example in the docs.
          </AccordionContentText>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
)
};

const ExampleRoundedCorners = () => {
return (
          <Accordion className="rounded-sm w-[90%] border border-border max-w-[640px] bg-transparent">
      <AccordionItem value="item-1" className="rounded-lg px-4">
        <AccordionHeader>
          <AccordionTrigger
            className="focus:web:rounded-lg"
            >
            {({ isExpanded }) => {
              return (
                <>
                  {isExpanded ? (
                    <AccordionIcon as={RemoveIcon}/>
                  ) : (
                    <AccordionIcon as={AddIcon}/>
                  )}
                  <AccordionTitleText>
                    How do I place an order?
                  </AccordionTitleText>
                </>
              );
            }}
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <AccordionContentText>
            To place an order, simply select the products you want, proceed to
            checkout, provide shipping and payment information, and finalize
            your purchase.
          </AccordionContentText>
        </AccordionContent>
      </AccordionItem>
        <Divider className="bg-border" />
      <AccordionItem value="item-2" className="rounded-lg px-4">
        <AccordionHeader>
          <AccordionTrigger className="focus:web:rounded-lg">
            {({ isExpanded }) => {
              return (
                <>
                  {isExpanded ? (
                    <AccordionIcon as={RemoveIcon} />
                  ) : (
                    <AccordionIcon as={AddIcon} />
                  )}
                  <AccordionTitleText>
                   What payment methods do you accept?
                  </AccordionTitleText>
                </>
              );
            }}
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <AccordionContentText>
            We accept all major credit cards, including Visa, Mastercard, and
            American Express. We also support payments through PayPal.
          </AccordionContentText>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
)
};

const ExampleDisabledItem = () => {
return (
          <Accordion variant="unfilled" className="w-[90%]">
      <AccordionItem value="item-1" isDisabled={true}
      className= "border-b border-border"
      >
        <AccordionHeader>
          <AccordionTrigger>
            {({ isExpanded }) => {
              return (
                <>
                  <AccordionTitleText>
                   Disabled Item
                  </AccordionTitleText>
                  {isExpanded ? (
                    <AccordionIcon as={RemoveIcon}  />
                  ) : (
                    <AccordionIcon as={AddIcon}  />
      
```

### Core Architecture Module: `apps/kitchen-sink/app/(home)/components/actionsheet.tsx`
```
import { Actionsheet, ActionsheetContent, ActionsheetItem, ActionsheetItemText, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetBackdrop, ActionsheetIcon, ActionsheetVirtualizedList, ActionsheetFlatList, ActionsheetSectionList, ActionsheetSectionHeaderText } from '@/components/ui/actionsheet'
import { Button, ButtonText, ButtonGroup } from '@/components/ui/button'
import { VStack } from '@/components/ui/vstack'
import { HStack } from '@/components/ui/hstack'
import { Box } from '@/components/ui/box'
import { Image } from '@/components/ui/image'
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control'
import { Input, InputSlot, InputField, InputIcon } from '@/components/ui/input'
import { CreditCardIcon, UploadCloud } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Heading } from '@/components/ui/heading'
import { Radio, RadioGroup, RadioLabel, RadioIndicator, RadioIcon } from '@/components/ui/radio'
import { CircleIcon, EditIcon, EyeOffIcon, ClockIcon, DownloadIcon, TrashIcon, Icon, CloseIcon } from '@/components/ui/icon'
import { Pressable } from '@/components/ui/pressable'


import React from 'react';
import { UsageVariantFlatList } from '@/components/custom/component-presentation/usage-variant-flatlist';

const ExampleBasic = () => {
const [showActionsheet, setShowActionsheet] = React.useState(false)
  const handleClose = () => setShowActionsheet(false)
  return (
    <>
      <Button onPress={() => setShowActionsheet(true)}>
        <ButtonText>Open Actionsheet</ButtonText>
      </Button>
      <Actionsheet isOpen={showActionsheet} onClose={handleClose}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem onPress={handleClose}>
            <ActionsheetItemText>Edit Message</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={handleClose}>
            <ActionsheetItemText>Mark Unread</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={handleClose}>
            <ActionsheetItemText>Remind Me</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={handleClose}>
            <ActionsheetItemText>Add to Saved Items</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem isDisabled onPress={handleClose}>
            <ActionsheetItemText>Delete</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </>
  )
};

const ExampleWithoutSnapPoints = () => {
const [showActionsheet, setShowActionsheet] = React.useState(false)
  const handleClose = () => setShowActionsheet(false)
  return (
    <>
      <Button onPress={() => setShowActionsheet(true)}>
        <ButtonText>Open Actionsheet</ButtonText>
      </Button>
      <Actionsheet isOpen={showActionsheet} onClose={handleClose}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetItem onPress={handleClose}>
            <ActionsheetItemText>Edit Message</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={handleClose}>
            <ActionsheetItemText>Mark Unread</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={handleClose}>
            <ActionsheetItemText>Remind Me</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem onPress={handleClose}>
            <ActionsheetItemText>Add to Saved Items</ActionsheetItemText>
          </ActionsheetItem>
          <ActionsheetItem isDisabled onPress={handleClose}>
            <ActionsheetItemText>Delete</ActionsheetItemText>
          </ActionsheetItem>
        </ActionsheetContent>
      </Actionsheet>
    </>
  )
};

const ExampleWithSnapPoints = () => {
const [showActionsheet, setShowActionsheet] = React.useState(false);
  const handleClose = () => setShowActionsheet(false);

  return (
    <>
      <Button onPress={() => setShowActionsheet(true)}>
        <ButtonText>Open</ButtonText>
      </Button>
      <Actionsheet
        isOpen={showActionsheet}
        onClose={handleClose}
        snapPoints={[36]}
      >
       
          <ActionsheetBackdrop />
          <ActionsheetContent className="">
            <ActionsheetDragIndicatorWrapper>
              <ActionsheetDragIndicator />
            </ActionsheetDragIndicatorWrapper>
            <VStack className="w-full pt-5">
              <HStack space="md" className="justify-center items-center">
                <Box className="w-[50px] h-full px-2 border border-solid border-outline-300 rounded-sm">
                  <Image
                    source={{ uri: 'https://i.imgur.com/UwTLr26.png' }}
                    resizeMode="contain"
                    className="flex-1"
                  />
                </Box>
                <VStack className="flex-1">
                  <Text className="font-bold">Mastercard</Text>
                  <Text>Card ending in 2345</Text>
                </VStack>
              </HStack>
              <FormControl className="mt-9">
                <FormControlLabel>
                  <FormControlLabelText>
                    Confirm security code
                  </FormControlLabelText>
                </FormControlLabel>
                <Input className="w-full">
                  <InputSlot>
                    <InputIcon as={CreditCardIcon} className="ml-2" />
                  </InputSlot>
                  <InputField placeholder="CVC/CVV" />
                </Input>
                <Button onPress={handleClose} className="mt-3">
                  <ButtonText className="flex-1">Pay $1000</ButtonText>
                </Button>
              </FormControl>
            </VStack>
          </ActionsheetContent>

      </Actionsheet>
    </>
  )
};

const ExampleSelectionWithStatePersistence = () => {
const [showActionsheet, setShowActionsheet] = React.useState(false);
  const [preference, setPreference] = React.useState('all');
  const [tempPreference, setTempPreference] = React.useState('all');
  
  const handleClose = () => {
    setPreference(tempPreference);
    setShowActionsheet(false);
  };

  const options = [
    { value: 'all', label: 'All Notifications' },
    { value: 'mentions', label: 'Mentions Only' },
    { value: 'off', label: 'Off' },
  ];

  return (
    <>
      <VStack space="md">
        <Text>Current: {options.find(o => o.value === preference)?.label}</Text>
        <Button onPress={() => {
          setTempPreference(preference);
          setShowActionsheet(true);
        }}>
          <ButtonText>Change Preference</ButtonText>
        </Button>
      </VStack>
      <Actionsheet isOpen={showActionsheet} onClose={handleClose}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <VStack className="w-full p-4" space="xl">
            <Heading size="lg">Preferences</Heading>
            <RadioGroup value={tempPreference} onChange={setTempPreference} className="gap-4">
              {options.map((option) => (
                <Radio key={option.value} value={option.value} className="justify-between">
                  <RadioLabel>{option.label}</RadioLabel>
                  <RadioIndicator>
                    <RadioIcon as={CircleIcon} />
                  </RadioIndicator>
                </Radio>
              ))}
            </RadioGroup>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </>
  )
};

const ExampleIcons = () => {
const [showActionsheet, setShowActionsheet] = React.useState(false);
  const
```

### Core Architecture Module: `apps/kitchen-sink/app/(home)/components/alert-dialog.tsx`
```
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogBody, AlertDialogBackdrop } from '@/components/ui/alert-dialog'
import { Button, ButtonText } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Heading } from '@/components/ui/heading'
import { Box } from '@/components/ui/box'
import { Image } from '@/components/ui/image'
import { VStack } from '@/components/ui/vstack'
import { Icon, TrashIcon } from '@/components/ui/icon'
import { UploadCloud } from 'lucide-react-native'


import React from 'react';
import { UsageVariantFlatList } from '@/components/custom/component-presentation/usage-variant-flatlist';

const ExampleBasic = () => {
const [showAlertDialog, setShowAlertDialog] = React.useState(false)
  const handleClose = () => setShowAlertDialog(false)
  return (
    <>
      <Button onPress={() => setShowAlertDialog(true)}>
        <ButtonText>Open Dialog</ButtonText>
      </Button>
      <AlertDialog isOpen={showAlertDialog} onClose={handleClose}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading className="text-foreground font-semibold text-lg">
              Are you sure you want to delete this post?
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="mt-3 mb-4">
            <Text className="text-sm text-muted-foreground">
              Deleting the post will remove it permanently and cannot be undone.
              Please confirm if you want to proceed.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" onPress={handleClose}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button onPress={handleClose}>
              <ButtonText>Delete</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
};

const ExampleAlertDialogWithImage = () => {
const [showAlertDialog, setShowAlertDialog] = React.useState(false);
  const handleClose = () => setShowAlertDialog(false);
  return (
    <>
      <Button onPress={() => setShowAlertDialog(true)}>
        <ButtonText>Pay</ButtonText>
      </Button>
      <AlertDialog isOpen={showAlertDialog} onClose={handleClose}>
        <AlertDialogBackdrop />
        <AlertDialogContent className="p-0 max-w-[590px] sm:flex-row rounded-xl">
          <Box className="bg-primary min-w-[123px] items-center justify-center native:max-h-[95px]">
            <Image
              source={{
                uri: "https://gluestack.github.io/public-blog-video-assets/Image%20Container.png",
              }}
              alt="image"
              className="min-h-[95px] min-w-[95px] h-full w-full"
            />
          </Box>
          <AlertDialogBody
            className=""
            contentContainerClassName="p-6 flex-row justify-between gap-6 md:gap-9 items-center"
          >
            <VStack>
              <Heading className="text-foreground font-semibold text-lg leading-6">
                Get Additional Discount
              </Heading>
              <Text className="pt-2 text-foreground text-sm">
                Upgrade your plan before your trial ends yo get 5% discount. Use
                code{' '}
                <Text className="font-bold text-base">
                  #PRO005
                </Text>
              </Text>
            </VStack>
            <Button className="hidden sm:flex" onPress={handleClose}>
              <ButtonText>Upgrade</ButtonText>
            </Button>
          </AlertDialogBody>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
};

const ExampleAlertDialogWithIconCta = () => {
const [showAlertDialog, setShowAlertDialog] = React.useState(false);
  const handleClose = () => setShowAlertDialog(false);
  return (
    <>
      <Button onPress={() => setShowAlertDialog(true)}>
        <ButtonText>Upload</ButtonText>
      </Button>
      <AlertDialog isOpen={showAlertDialog} onClose={handleClose}>
        <AlertDialogBackdrop />
        <AlertDialogContent className="p-4 gap-4 max-w-[649px]  md:flex-row mx-2">
          <AlertDialogBody
            className=""
            contentContainerClassName="flex-row gap-4"
          >
            <Box className="h-10 min-[350px]:h-14 w-12 min-[350px]:w-14 rounded-full bg-muted items-center justify-center">
              <Icon
                as={UploadCloud}
                className="stroke-foreground h-6 w-6"
              />
            </Box>
            <VStack space="xs">
              <Heading className="text-foreground font-semibold text-lg">
                Cloud storage full!
              </Heading>
              <Text className="text-sm text-muted-foreground">You have used up all the storage you have.</Text>
            </VStack>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onPress={handleClose}
            >
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button onPress={handleClose}>
              <ButtonText>Upgrade Storage</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
};

const ExampleAlertDialogWithDeleteOption = () => {
const [showAlertDialog, setShowAlertDialog] = React.useState(false);
  const handleClose = () => setShowAlertDialog(false);
  return (
    <>
      <Button onPress={() => setShowAlertDialog(true)}>
        <ButtonText>Delete Invoice</ButtonText>
      </Button>
      <AlertDialog isOpen={showAlertDialog} onClose={handleClose}>
        <AlertDialogBackdrop />
        <AlertDialogContent className=" max-w-[415px] gap-4 items-center">
          <Box className="rounded-full h-[52px] w-[52px] bg-destructive/10 items-center justify-center">
            <Icon as={TrashIcon} className="stroke-destructive h-6 w-6" />
          </Box>
          <AlertDialogHeader className="mb-2">
            <Heading className="text-foreground font-semibold text-lg">Delete account?</Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text className="text-sm text-muted-foreground text-center">
              The invoice will be deleted from the invoices section and in
              the documents folder. This cannot be undone.
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="mt-5">
            <Button
              variant="destructive"
              onPress={handleClose}
              className="px-[30px]"
            >
              <ButtonText>Delete</ButtonText>
            </Button>
            <Button
              variant="outline"
              onPress={handleClose}
              className="px-[30px]"
            >
              <ButtonText>Cancel</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
};

const COMPONENT_VARIANTS = [
  {
    value: "basic",
    label: "Basic",
    content: <ExampleBasic />,
  },
  {
    value: "alertdialog-with-image",
    label: "AlertDialog with Image",
    content: <ExampleAlertDialogWithImage />,
  },
  {
    value: "alertdialog-with-icon-cta",
    label: "AlertDialog with icon + cta",
    content: <ExampleAlertDialogWithIconCta />,
  },
  {
    value: "alertdialog-with-delete-option",
    label: "AlertDialog with Delete Option",
    content: <ExampleAlertDialogWithDeleteOption />,
  }
];

export default function AlertDialogScreen() {
  return <UsageVariantFlatList data={COMPONENT_VARIANTS} />;
}
```

### Core Architecture Module: `apps/kitchen-sink/app/(home)/components/alert.tsx`
```
import { Alert, AlertText, AlertIcon } from '@/components/ui/alert'
import { InfoIcon, Icon, CloseIcon, EyeIcon, EyeOffIcon } from '@/components/ui/icon'
import { Center } from '@/components/ui/center'
import { VStack } from '@/components/ui/vstack'
import { Button, ButtonText } from '@/components/ui/button'
import { CloudIcon, Bomb } from 'lucide-react-native'
import { Text } from '@/components/ui/text'
import { Heading } from '@/components/ui/heading'
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input'


import React from 'react';
import { UsageVariantFlatList } from '@/components/custom/component-presentation/usage-variant-flatlist';

const ExampleBasic = () => {
return (
    
    <Alert variant="default" >
      <AlertIcon as={InfoIcon} />
      <AlertText>Description of alert!</AlertText>
    </Alert>
   
  )
};

const VariantDestructive = () => {
return (
    
    <Alert variant="destructive" >
      <AlertIcon as={InfoIcon} />
      <AlertText>Description of alert!</AlertText>
    </Alert>
   
  )
};

const ExampleAlertWithCTA = () => {
return (
    <Alert
      className="gap-4 max-w-[585px] w-full self-center items-start min-[400px]:items-center"
    >
      <VStack className="gap-4 min-[400px]:flex-row justify-between flex-1 min-[400px]:items-center">
        <AlertText className="font-semibold text-foreground/90" size="sm">
          Verify your phone number to create an API key
        </AlertText>
        <Button size="sm">
          <ButtonText>Start verification</ButtonText>
        </Button>
      </VStack>
      <Icon as={CloseIcon} />
    </Alert>
  )
};

const ExampleAlertOnCloudSync = () => {
return (
    <Alert
      className="gap-4 max-w-[585px] w-full self-center items-start min-[400px]:items-center bg-primary/10 border-primary/20"
    >
      <VStack className="gap-4 min-[400px]:flex-row justify-between flex-1 min-[400px]:items-center">
        <AlertText className="font-semibold text-foreground/90" size="sm">
          Your data has been synced to the cloud
        </AlertText>
        <Button size="sm">
          <ButtonText>View details</ButtonText>
        </Button>
      </VStack>
      <Icon as={CloseIcon} />
    </Alert>
  )
};

const ExampleWarningAlert = () => {
return (
    <Alert className="gap-3 bg-destructive/10 border-destructive/20">
      <AlertIcon as={Bomb} size="lg" className="mt-1" />
      <AlertText className="text-foreground/80" size="sm">
        <Text className="mr-2 font-semibold text-foreground/90">
          Heads up:
        </Text>
       {" "} Once done, this action cannot be undone
      </AlertText>
    </Alert>
  )
};

const ExampleAlertOnConfirmPasswordModal = () => {
const [showPassword, setShowPassword] = React.useState(false);
  const handleState = () => {
    setShowPassword((showState) => {
      return !showState;
    });
  };
  return (
    <VStack className="gap-5 sm:gap-8 p-6 sm:p-9 border border-border/80 bg-background rounded-xl shadow-hard-5 w-full max-w-[423px]">
      <VStack className="items-center gap-1">
        <Heading size="xl">Confirm our password?</Heading>
        <Text>johnsmith@gmail.com</Text>
      </VStack>
      <VStack className="gap-3 sm:gap-5">
        <Input className="rounded-md" size="sm">
          <InputField
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter password"
          />
          <InputSlot className="mr-3" onPress={handleState}>
            <InputIcon
              as={showPassword ? EyeIcon : EyeOffIcon}
              className="stroke-foreground/60"
            />
          </InputSlot>
        </Input>
        <Button className="w-full rounded-md" size="sm">
          <ButtonText>Confirm</ButtonText>
        </Button>
      </VStack>
      <Alert className="items-start bg-primary/10 border-primary/20">
        <AlertIcon as={InfoIcon} size="xs" className="stroke-foreground/60" />
        <AlertText className="text-foreground/60" size="xs">
          Minimum 8 characters, with at least 1 uppercase, 1 lowercase, and 1
          number required.
        </AlertText>
      </Alert>
    </VStack>
  )
};

const COMPONENT_VARIANTS = [
  {
    value: "basic",
    label: "Basic",
    content: <ExampleBasic />,
  },
  {
    value: "destructive",
    label: "Destructive",
    content: <VariantDestructive />,
  },
  {
    value: "alert-with-cta",
    label: "Alert with CTA",
    content: <ExampleAlertWithCTA />,
  },
  {
    value: "alert-on-cloud-sync",
    label: "Alert on cloud sync",
    content: <ExampleAlertOnCloudSync />,
  },
  {
    value: "warning-alert",
    label: "Warning alert",
    content: <ExampleWarningAlert />,
  },
  {
    value: "alert-on-confirm-password-modal",
    label: "Alert on confirm password modal",
    content: <ExampleAlertOnConfirmPasswordModal />,
  }
];

export default function AlertScreen() {
  return <UsageVariantFlatList data={COMPONENT_VARIANTS} />;
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3239** (2026-03-20): **Styles are not loading after upgrading from v2 to v3**
  *Symptoms*: I just upgraded a react native project from expo sdk 53 to sdk 54 and then from gluestack v2 to v3 as followed in the official steps:  https://gluestack.io/ui/docs/home/getting-started/installation https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/  Problem is that all gluestack elements are not styling as expected. A single <Button> element is not rendering as it should be.]  With expo 53 and gluestack v2 worked smoothly, but I had to upgrade in order to render the project in physical mobile devides through expo go.  Login.js:  return (     <Box height={150} className="bg-primary-0">       {/* <Animated.View style={{          flex: 1,         transform: [{ translateY: slideAnim }],         opacity: fadeAnim,       }}> */}          {/* <Box alignItems="center" justifyContent="center" paddingTop={80} >           <Image             source={require("./../../assets/images/logo-oro-miel.png")}             alt="OroyMiel Logo"             size="xl"             borderRadius={17}           />         </Box> */}          <Heading size="lg" style={styles.titleHeader}>           Accede a tu cuenta         </Heading>          <Box style={styles.textInput}>           <Text bold className="text-primary-0">             Email           </Text>           <Input className="text-center border border-primary-0" variant="rounded" backgroundColor="white">             <InputField               className="text-primary-0"               type="text"               placeholder="abc@gmail.com" 
  **Post-Mortem & Fix Analysis**:
  > This applies to create-react-native apps too. 
  > @vish404 @brokenerk  , The issue could very likely be related to `react-native-css-interop` or `nativewind` conflicting dependency after the upgrade. We’re looking into it, thanks for pointing that out and for reporting the issue!
  > Hi @vish404 @brokenerk , Could you please check your root layout (or the equivalent entry file) and ensure that the `global.css` (or `globals.css`) file is imported there?

- **Issue #3152** (2025-09-04): **Pin input component documentation is incomplete**
  *Symptoms*: ### Description  I would like to implement an otp field in my app but the documentation seems incomplete. The doc mentions a `numberOfFields` prop that doesn't exist in the component code, and I can't find the doc for it in gluestack v3.  ### CodeSandbox/Snack link  https://gluestack.io/ui/docs/components/pin-input  ### Steps to reproduce  1. Go to https://gluestack.io/ui/docs/components/pin-input 2. Scroll down to PinInput with caption 3. See error TypeError: Cannot read properties of null (reading 'useState')    ### gluestack-ui Version  0.0.14  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [ ] Web - [ ] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @raphaelbadia,  Thanks for trying out the component and sharing the details. The PinInput is currently an unreleased component and still a work in progress (WIP), which is why some props and docs may not match the actual implementation yet.  We’ll update the documentation and release it properly once it’s ready for production use.  Appreciate your patience! 🙏  Best, Sanchit
  > Oh alright ! I didn't know it was not yet released :D THanks !

- **Issue #3139** (2025-08-25): **react dom issue which is imported by @react-aria/utils**
  *Symptoms*: ### Description  Plain new setup of RN 0.81 & gluestack-ui v2 causes issue with peer deps  ### CodeSandbox/Snack link  not present  ### Steps to reproduce  nvm install 20.19.4 nvm use 20.19.4 npx @react-native-community/cli@latest init npx gluestack-ui init (failed on iOS pods) Manual Gluestack setup - Created provider manually in components/ui/ Fixed import path - Changed @/ to ./ in App.tsx Fixed react-native-reanimated - Downgraded to 3.15.0 (v4+ incompatible with RN 0.81) Fixed react-native-svg - Used 15.12.1 (other versions had build errors)  npm start npm run android  ### gluestack-ui Version  2  ### Platform  - [ ] Expo - [x] React Native CLI - [ ] Next - [ ] Web - [x] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  {   "name": "wms",   "version": "0.0.1",   "private": true,   "scripts": {     "android": "react-native run-android",     "ios": "react-native run-ios",     "lint": "eslint .",     "start": "react-native start",     "test": "jest"   },   "dependencies": {     "@gluestack-ui/nativewind-utils": "^1.0.26",     "@gluestack-ui/overlay": "^0.1.22",     "@gluestack-ui/toast": "^1.0.9",     "@react-native/new-app-screen": "0.81.0",     "nativewind": "^4.1.23",     "react": "19.1.0",     "react-native": "0.81.0",     "react-native-css-interop": "^0.1.22",     "react-native-reanimated": "^3.15.0",     "react-native-safe-area-context": "^5.6.1",     "react-native-svg": "^15.12.1",     "tailwindcss": "^3.4.17"   },   "devDependencies":
  **Post-Mortem & Fix Analysis**:
  > Solved. installed react-dom as dev dependency. Need to know why I needed to do that for the React Native application
  > > Solved. installed react-dom as dev dependency. Need to know why I needed to do that for the React Native application  That’s expected 🙂 — we ship our components as universal (web + native), so react-dom ends up being a dependency for most of our components. Even if you’re running React Native only, it’s required in the tree for type safety and compatibility with our universal setup
  > @Sanchitv3 Why react-dom is not automatically installed when we setup gluestack ? Also shouldn't we keep seperation of modules for web, native so we don't end up in conflicts ?

- **Issue #3131** (2026-03-20): **[v3] Upgrade CLI command doesn't have same package-manager behavior as other commands**
  *Symptoms*: ### Description  The new `upgrade` command doesn't use the same package-manager selection options as the other commands in the CLI.  ### CodeSandbox/Snack link  This is a CLI bug - can be proven on a vanilla project from gluestack init.  ### Steps to reproduce  1. Remove `yarn.lock`. 2. Run `npx gluestack-ui@alpha upgrade --use-yarn` 3. Note that the command still uses `npm` instead of `yarn` because in the repro project there is no `yarn.lock` file and the use-yarn command is ignored. ### gluestack-ui Version  alpha  ### Platform  - [x] Expo - [x] React Native CLI - [x] Next - [x] Web - [x] Android - [x] iOS  ### Other Platform  (this is a CLI issue - it is universal)  ### Additional Information  I will open a PR in like 5 minutes to fix this.

- **Issue #3124** (2025-10-31): **Actionsheet onClose state out of sync**
  *Symptoms*: ### Description  When I close an actionsheet by dragging, the saved state is behind by one. When I close by clicking the backdrop, the state on close is correct.  ### CodeSandbox/Snack link  https://snack.expo.dev/@nathan-hadley/actionsheet-state-bug-example  ### Steps to reproduce  1. Use the sandbox link to get a reproducible example. 2. Run the code in an environment with ActionSheet and Radio Gluestack components installed. 3. Open the sheet and select "Houses." 4. Close the sheet by dragging and you will see "Apartments" logged in console. 5. Open the sheet and select "Apartments." 6. Close the sheet and you will see "Houses" logged in console. 7. Open the sheet and select "Houses." 8. Close the sheet by clicking the backdrop and you will see "Houses" logged in console.   ### gluestack-ui Version  0.2.53 of @gluestack-ui/actionsheet  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [ ] Web - [x] Android - [x] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Oh, I understand the issue now — it’s related to the `RadioGroup`. I’ll get back to you with a solution soon.
  > @Sanchitv3 thanks! I think the `RadioGroup` might be a red herring. I think it could be anything using `useState`. I have another sheet with a date picker and the same issue occurs. A workaround is to use a ref, and reference that in the `onClose` but I still want to use `useState` for the UI state, and thus duplicate state, which is not ideal.

- **Issue #3101** (2025-08-08): **Actionsheet onClose state out of sync**
  *Symptoms*: ### Description  When I close an actionsheet by dragging, the saved state is behind by one. When I close by clicking the backdrop, the state on close is correct.  ### CodeSandbox/Snack link  https://snack.expo.dev/@nathan-hadley/actionsheet-state-bug-example  ### Steps to reproduce  1. Use the sandbox link to get a reproducible example.  2. Run the code in an environment with ActionSheet and Radio Gluestack components installed.  3. Open the sheet and select "Houses."  4. Close the sheet by dragging and you will see "Apartments" logged in console. 5. Open the sheet and select "Apartments." 6. Close the sheet and you will see "Houses" logged in console. 7. Open the sheet and select "Houses." 8. Close the sheet by clicking the backdrop and you will see "Houses" logged in console.   ### gluestack-ui Version  0.2.53 of @gluestack-ui/actionsheet  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [ ] Web - [ ] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @nathan-hadley , Your code seems to be incorrect , here is the updated code: ``` // RadioSheet.tsx import React from 'react'; import {   Actionsheet,   ActionsheetBackdrop,   ActionsheetContent,   ActionsheetDragIndicator,   ActionsheetDragIndicatorWrapper, } from '@/components/ui/actionsheet'; import { VStack } from '@/components/ui/vstack'; import {   Radio,   RadioGroup,   RadioIcon,   RadioIndicator,   RadioLabel, } from '@/components/ui/radio'; import { CircleIcon } from './ui/icon';  export const RadioSheet = ({   isOpen,   onClose, }: {   isOpen: boolean;   onClose: () => void; }) => {   const [value, setValue] = React.useState('Apartments');    function handleBackdropClose() {     console.log('Handle backdrop close', value);   }    function handleDragClose() {     onClose();     console.log('Handle drag close', value);   }    return (     <Actionsheet isOpen={isOpen} onClose={handleDragClose}>       <ActionsheetBackdrop onPress={handleBackdropClose} />       <ActionsheetCont
  > @Sanchitv3 would you mind trying to reproduce the issue with your corrected code? I accidentally removed the `onClose` when I was trying to simplify the example as much as possible
  > @Sanchitv3 for visibility, I'm reopening this issue with the corrected code here: https://github.com/gluestack/gluestack-ui/issues/3124

- **Issue #3099** (2026-03-27): **useRadio WeakMap returns undefined**
  *Symptoms*: ### Description  useRadio hook fails to return the incoming state value and instead returns `undefined`. Values are destructured from `undefined`, resulting in a runtime error.  ### CodeSandbox/Snack link  https://snack.expo.dev/@tim-headway/useradio-undefined-error  ### Steps to reproduce  Simply call `useRadio` with any values using `@react-native-aria/radio` version `0.2.13`   ### gluestack-ui Version  3.3.1  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [x] Web - [ ] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi! 👋 I’d love to work on this issue as my first contribution.
  > Thanks for reporting!  This is no longer applicable with the current version of the codebase.  Closing for now, please open a new issue if it still persists 🙌

- **Issue #3086** (2026-03-26): **Modal avoidkeyboard not working on android**
  *Symptoms*: ### Description  when using adding the prop avoidKeyboard  to  <Modal/> i works on ios but not android  ### CodeSandbox/Snack link  couldn't have one.  ### Steps to reproduce ```html <Modal avoidKeyboard={true}> ... </Modal> it will avoid the keyboard on ios but not android. ``` same with: ```html <KeyboardAvoidingView       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}       style={{ flex: 1 }} // with or witout     > <Modal> ... </Modal> </KeyboardAvoidingView ``` ### gluestack-ui Version  "@gluestack-ui/modal": "^0.1.39"  ### Platform  - [x] Expo - [ ] React Native CLI - [ ] Next - [ ] Web - [ ] Android - [ ] iOS  ### Other Platform  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > We’ve released the fix in `@gluestack-ui/utils@3.0.19` and `@gluestack-ui/utils@5.0.3-alpha.0`. Please update to the latest version and let us know if you’re still facing any issues 🙌 

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

### Incident Patch 1: `b712c854` (2026-09-02)
**Commit Message**: Merge pull request #3456 from gluestack/fix/remove-product-hunt-banner

fix: remove Product Hunt banner from header

**File**: `apps/website/components/page-components/header/index.tsx` (modified, +221/-221)
```diff
@@ -27,9 +27,12 @@ import { Link } from '@/components/ui/link';
 import { Text } from '@/components/ui/text';
 import { Box } from '@/components/ui/box';
 import { Icon } from '@/components/ui/icon';
-import { Menu as VersionMenu, MenuItem, MenuItemLabel } from '@/components/ui/menu';
+import {
+  Menu as VersionMenu,
+  MenuItem,
+  MenuItemLabel,
+} from '@/components/ui/menu';
 import { Pressable } from '@/components/ui/pressable';
-import ProductHuntBanner from '../landing-page/ProductHuntBanner';
 
 const Header = ({
   isOpenSidebar: propsIsOpenSidebar,
@@ -43,7 +46,6 @@ const Header = ({
   const pathname = usePathname();
   const { colorMode, setColorMode } = useColorMode();
   const [showModal, setShowModal] = useState(false);
-  const [showPHBanner, setShowPHBanner] = useState(true);
 
   // Check if current route is documentation
   const isDocsRoute = pathname?.includes('/ui/docs/');
@@ -57,246 +59,244 @@ const Header = ({
 
   return (
     <>
-      <ProductHuntBanner
-        showPHBanner={showPHBanner}
-        setShowPHBanner={setShowPHBanner}
-      />
       <div className="h-[53px] w-full sticky top-0 z-10 flex justify-center bg-white/80 border-b border-border dark:bg-background/80 backdrop-blur-md">
-      {/* @ts-ignore */}
-      <Nav className="items-center justify-center w-full mx-auto py-6">
-        <div
-          className={`flex flex-row justify-between items-center  ${
-            pathname?.includes('/ui/docs/')
-              ? 'w-[100%] px-5'
-              : 'w-[85%] max-w-[1440px]'
-          }`}
-        >
-          <div className="flex flex-row  gap-3 items-center shrink-0">
-            <NextLink
-              href="/"
-              className="no-underline z-1 flex sm:flex-row gap-1 items-center"
-            >
-              <Image
-                alt="gluestack-ui logo"
-                className="h-[20px] w-full max-w-fit"
-                src={colorMode === 'dark' ? GluestackLogoDark : GluestackLogo}
-                priority
-              />
-            </NextLink>
-            {/* Version selector */}
-            <VersionMenu
-              placement="bottom"
-              offset={18}
-              trigger={({ ...triggerProps }) => {
-                return (
-                  <Pressable
-                    {...triggerProps}
-                    className="flex-row items-center pb-0.5"
-                  >
-                    <Text className="font-bold text-foreground text-sm">
-                      v5
-                    </Text>
-                    <Icon
-                      as={ChevronDownIcon}
-                      className="w-3 h-3 ml-1 text-foreground"
-                    />
-                  </Pressable>
-                );
-              }}
-            >
-              <MenuItem className="min-w-fit px-5 py-2">
-                <MenuItemLabel>v5</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v4.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v4</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v3.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v3</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v2.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v2</MenuItemLabel>
-              </MenuItem>
-            </VersionMenu>
-            {/* Desktop: Show Docs and Demo buttons */}
-            <div className="hidden md:flex items-center xl:ml-10">
+        {/* @ts-ignore */}
+        <Nav className="items
```

---

### Incident Patch 2: `9dd869c1` (2026-09-02)
**Commit Message**: fix(header): remove unused state for Product Hunt banner

**File**: `apps/website/components/page-components/header/index.tsx` (modified, +0/-2)
```diff
@@ -33,7 +33,6 @@ import {
   MenuItemLabel,
 } from '@/components/ui/menu';
 import { Pressable } from '@/components/ui/pressable';
-import ProductHuntBanner from '../landing-page/ProductHuntBanner';
 
 const Header = ({
   isOpenSidebar: propsIsOpenSidebar,
@@ -47,7 +46,6 @@ const Header = ({
   const pathname = usePathname();
   const { colorMode, setColorMode } = useColorMode();
   const [showModal, setShowModal] = useState(false);
-  const [showPHBanner, setShowPHBanner] = useState(true);
 
   // Check if current route is documentation
   const isDocsRoute = pathname?.includes('/ui/docs/');
```

---

### Incident Patch 3: `3fe691c1` (2026-09-02)
**Commit Message**: fix: remove Product Hunt banner from header

**File**: `apps/website/components/page-components/header/index.tsx` (modified, +221/-219)
```diff
@@ -27,7 +27,11 @@ import { Link } from '@/components/ui/link';
 import { Text } from '@/components/ui/text';
 import { Box } from '@/components/ui/box';
 import { Icon } from '@/components/ui/icon';
-import { Menu as VersionMenu, MenuItem, MenuItemLabel } from '@/components/ui/menu';
+import {
+  Menu as VersionMenu,
+  MenuItem,
+  MenuItemLabel,
+} from '@/components/ui/menu';
 import { Pressable } from '@/components/ui/pressable';
 import ProductHuntBanner from '../landing-page/ProductHuntBanner';
 
@@ -57,246 +61,244 @@ const Header = ({
 
   return (
     <>
-      <ProductHuntBanner
-        showPHBanner={showPHBanner}
-        setShowPHBanner={setShowPHBanner}
-      />
       <div className="h-[53px] w-full sticky top-0 z-10 flex justify-center bg-white/80 border-b border-border dark:bg-background/80 backdrop-blur-md">
-      {/* @ts-ignore */}
-      <Nav className="items-center justify-center w-full mx-auto py-6">
-        <div
-          className={`flex flex-row justify-between items-center  ${
-            pathname?.includes('/ui/docs/')
-              ? 'w-[100%] px-5'
-              : 'w-[85%] max-w-[1440px]'
-          }`}
-        >
-          <div className="flex flex-row  gap-3 items-center shrink-0">
-            <NextLink
-              href="/"
-              className="no-underline z-1 flex sm:flex-row gap-1 items-center"
-            >
-              <Image
-                alt="gluestack-ui logo"
-                className="h-[20px] w-full max-w-fit"
-                src={colorMode === 'dark' ? GluestackLogoDark : GluestackLogo}
-                priority
-              />
-            </NextLink>
-            {/* Version selector */}
-            <VersionMenu
-              placement="bottom"
-              offset={18}
-              trigger={({ ...triggerProps }) => {
-                return (
-                  <Pressable
-                    {...triggerProps}
-                    className="flex-row items-center pb-0.5"
-                  >
-                    <Text className="font-bold text-foreground text-sm">
-                      v5
-                    </Text>
-                    <Icon
-                      as={ChevronDownIcon}
-                      className="w-3 h-3 ml-1 text-foreground"
-                    />
-                  </Pressable>
-                );
-              }}
-            >
-              <MenuItem className="min-w-fit px-5 py-2">
-                <MenuItemLabel>v5</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v4.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v4</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v3.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v3</MenuItemLabel>
-              </MenuItem>
-              <MenuItem
-                className="min-w-fit px-5 py-2"
-                onPress={() => {
-                  window.open('https://v2.gluestack.io', '_blank');
-                }}
-              >
-                <MenuItemLabel>v2</MenuItemLabel>
-              </MenuItem>
-            </VersionMenu>
-            {/* Desktop: Show Docs and Demo buttons */}
-            <div className="hidden md:flex items-center xl:ml-10">
+        {/* @ts-ignore */}
+        <Nav className="items-center justify-center w-full mx-auto py-6">
+          <div
+            className={`flex flex-row justify-between items-center  ${
+              pathname?.includes('/ui/docs/')
+                ? 'w-[100%] px-5'
+                : 'w-[85%] max-w-[1440px]'
+            }`}
+          >
+            <div className="flex flex-row  gap-3 items-center shrink-0">
               <NextLink
-           
```

---

### Incident Patch 4: `f87eaae7` (2026-08-19)
**Commit Message**: Merge pull request #3451 from gluestack/fix/landing-page-muted-text

fix: update landing page components for improved styling and function…

**File**: `apps/kitchen-sink/.gitignore` (modified, +2/-0)
```diff
@@ -11,6 +11,8 @@ expo-env.d.ts
 
 # Native
 .kotlin/
+android/
+ios/
 *.orig.*
 *.jks
 *.p8
```

**File**: `apps/website/components/page-components/landing-page/Example/index.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ const Example = () => {
         <Heading size="2xl" className="text-3xl md:text-4xl font-bold">
           Same code for Next.js and Expo
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] w-full md:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] w-full md:w-[75%]">
           Build universal apps with consistent code across Next.js and Expo
           projects. Boost productivity, ensure code consistency, and simplify
           maintenance for both web and mobile platforms using a powerful React
```

**File**: `apps/website/components/page-components/landing-page/Inspiration/index.tsx` (modified, +2/-6)
```diff
@@ -12,17 +12,13 @@ const Inspiration = () => {
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           Inspiration
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           This project wouldn't have been possible without the great work by
           community members and inspiration from these libraries.
         </Text>
       </VStack>
       <Box className="relative max-w-4xl w-full h-full aspect-[844/311]">
-        <Image
-          alt="tech logos"
-          src={insImg}
-          className="w-full h-full"
-        />
+        <Image alt="tech logos" src={insImg} className="w-full h-full" />
       </Box>
     </Box>
   );
```

**File**: `apps/website/components/page-components/landing-page/Kitchensink/index.tsx` (modified, +2/-2)
```diff
@@ -15,13 +15,13 @@ import { kitchensink } from '@/components/docs-components/apps/appConfig';
 
 const Kitchensink = () => {
   return (
-    <Box className="gap-10 p-4 bg-muted mt-[120px] sm:mt-0 sm:bg-background sm:p-0 sm:border-none border border-border rounded-lg sm:rounded-none">
+    <Box className="gap-10 p-4  mt-[120px] sm:mt-0  sm:p-0 sm:border-none border border-border rounded-lg sm:rounded-none">
       <VStack className="max-w-[1024px] sm:mt-[120px] gap-3">
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           Kitchensink
         </Heading>
         <VStack className="gap-4">
-          <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+          <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
             <a
               href="https://gluestack.io/ui/docs/apps/kitchensink-app"
               className="underline underline-offset-4 group-hover/link:underline"
```

**File**: `apps/website/components/page-components/landing-page/MCPServer/index.tsx` (modified, +2/-2)
```diff
@@ -78,7 +78,7 @@ const VadimStream = () => {
         <Heading className="text-3xl font-roboto font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           MCP Server
         </Heading>
-        <Text className="text-lg font-roboto font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           Our MCP (Model Context Protocol) Server is an intelligent code
           generation tool that creates production-ready, consistent UI
           components using gluestack-ui v2. It streamlines your development
@@ -95,7 +95,7 @@ const VadimStream = () => {
           src="https://www.youtube.com/embed/5lSvkESJgmY"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
           allowFullScreen
-          loading='lazy'
+          loading="lazy"
         />
       </Box>
     </Box>
```

---

### Incident Patch 5: `9b7f7735` (2026-08-19)
**Commit Message**: fix: update landing page components for improved styling and functionality

- Added 'android/' and 'ios/' to .gitignore for better project management.
- Updated text styles to use 'text-muted-foreground' for consistency across landing page components.
- Cleaned up code formatting in various components for better readability.
- Adjusted loading attributes for images to use double quotes for consistency.

**File**: `apps/kitchen-sink/.gitignore` (modified, +2/-0)
```diff
@@ -11,6 +11,8 @@ expo-env.d.ts
 
 # Native
 .kotlin/
+android/
+ios/
 *.orig.*
 *.jks
 *.p8
```

**File**: `apps/website/components/page-components/landing-page/Example/index.tsx` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ const Example = () => {
         <Heading size="2xl" className="text-3xl md:text-4xl font-bold">
           Same code for Next.js and Expo
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] w-full md:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] w-full md:w-[75%]">
           Build universal apps with consistent code across Next.js and Expo
           projects. Boost productivity, ensure code consistency, and simplify
           maintenance for both web and mobile platforms using a powerful React
```

**File**: `apps/website/components/page-components/landing-page/Inspiration/index.tsx` (modified, +2/-6)
```diff
@@ -12,17 +12,13 @@ const Inspiration = () => {
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           Inspiration
         </Heading>
-        <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           This project wouldn't have been possible without the great work by
           community members and inspiration from these libraries.
         </Text>
       </VStack>
       <Box className="relative max-w-4xl w-full h-full aspect-[844/311]">
-        <Image
-          alt="tech logos"
-          src={insImg}
-          className="w-full h-full"
-        />
+        <Image alt="tech logos" src={insImg} className="w-full h-full" />
       </Box>
     </Box>
   );
```

**File**: `apps/website/components/page-components/landing-page/Kitchensink/index.tsx` (modified, +2/-2)
```diff
@@ -15,13 +15,13 @@ import { kitchensink } from '@/components/docs-components/apps/appConfig';
 
 const Kitchensink = () => {
   return (
-    <Box className="gap-10 p-4 bg-muted mt-[120px] sm:mt-0 sm:bg-background sm:p-0 sm:border-none border border-border rounded-lg sm:rounded-none">
+    <Box className="gap-10 p-4  mt-[120px] sm:mt-0  sm:p-0 sm:border-none border border-border rounded-lg sm:rounded-none">
       <VStack className="max-w-[1024px] sm:mt-[120px] gap-3">
         <Heading className="text-3xl font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           Kitchensink
         </Heading>
         <VStack className="gap-4">
-          <Text className="text-lg font-normal leading-[30px] lg:w-[75%]">
+          <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
             <a
               href="https://gluestack.io/ui/docs/apps/kitchensink-app"
               className="underline underline-offset-4 group-hover/link:underline"
```

**File**: `apps/website/components/page-components/landing-page/MCPServer/index.tsx` (modified, +2/-2)
```diff
@@ -78,7 +78,7 @@ const VadimStream = () => {
         <Heading className="text-3xl font-roboto font-bold sm:leading-[54px] leading-9 text-foreground sm:text-4xl">
           MCP Server
         </Heading>
-        <Text className="text-lg font-roboto font-normal leading-[30px] lg:w-[75%]">
+        <Text className="text-lg text-muted-foreground font-normal leading-[30px] lg:w-[75%]">
           Our MCP (Model Context Protocol) Server is an intelligent code
           generation tool that creates production-ready, consistent UI
           components using gluestack-ui v2. It streamlines your development
@@ -95,7 +95,7 @@ const VadimStream = () => {
           src="https://www.youtube.com/embed/5lSvkESJgmY"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
           allowFullScreen
-          loading='lazy'
+          loading="lazy"
         />
       </Box>
     </Box>
```

---

### Incident Patch 6: `2b1650c0` (2026-08-10)
**Commit Message**: Merge pull request #3450 from gluestack/fix/modal-scroll-overflow

fix(modal): enable scroll when content overflows viewport

**File**: `src/components/ui/modal/index.tsx` (modified, +1/-2)
```diff
@@ -47,7 +47,7 @@ const modalBackdropStyle = tva({
 });
 
 const modalContentStyle = tva({
-  base: 'bg-background rounded-md overflow-hidden border border-border/80 shadow-hard-2 p-6',
+  base: 'bg-background rounded-md overflow-hidden border border-border/80 shadow-hard-2 p-6 max-h-[85vh]',
   parentVariants: {
     size: {
       xs: 'w-[60%] max-w-[360px]',
@@ -173,7 +173,6 @@ const ModalBody = React.forwardRef<
 >(function ModalBody({ className, ...props }, ref) {
   return (
     <UIModal.Body
-      scrollEnabled={false}
       ref={ref}
       {...props}
       className={modalBodyStyle({
```

---

### Incident Patch 7: `d758d98a` (2026-08-10)
**Commit Message**: fix(modal): enable scroll when content overflows viewport

- Remove scrollEnabled={false} from ModalBody so ScrollView can scroll
- Add max-h-[85vh] to ModalContent so overflowing content scrolls instead of spilling out

Co-Authored-By: Claude <noreply@anthropic.com>

**File**: `src/components/ui/modal/index.tsx` (modified, +1/-2)
```diff
@@ -47,7 +47,7 @@ const modalBackdropStyle = tva({
 });
 
 const modalContentStyle = tva({
-  base: 'bg-background rounded-md overflow-hidden border border-border/80 shadow-hard-2 p-6',
+  base: 'bg-background rounded-md overflow-hidden border border-border/80 shadow-hard-2 p-6 max-h-[85vh]',
   parentVariants: {
     size: {
       xs: 'w-[60%] max-w-[360px]',
@@ -173,7 +173,6 @@ const ModalBody = React.forwardRef<
 >(function ModalBody({ className, ...props }, ref) {
   return (
     <UIModal.Body
-      scrollEnabled={false}
       ref={ref}
       {...props}
       className={modalBodyStyle({
```

---

### Incident Patch 8: `ba8a7003` (2026-08-10)
**Commit Message**: Merge pull request #3449 from gluestack/fix/v5-docs-and-avatar-size

fix: align docs and examples with v5 component props, add Avatar size…

**File**: `src/docs/guides/more/troubleshooting/index.mdx` (modified, +5/-12)
```diff
@@ -5,7 +5,7 @@ description: Troubleshoot common Nativewind issues, including dark mode, Toast i
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
 
 ## Common Issues
 
@@ -40,23 +40,16 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+To ensure Tailwind styles override with higher specificity in Tailwind v4, use the `important` configuration in your `global.css`:
 
-```jsx
-// tailwind.config.js
-module.exports = {
-  ...
-  important: 'html',
-  ...
-}
+```css
+@import "tailwindcss/utilities.css" important(html);
 ```
 
-**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
-
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
+- `dark:` class strategy now works on both web and native in v5.
 
 ## Still Facing Issues?
 
```

**File**: `src/docs/home/theme-configuration/customizing-theme/index.mdx` (modified, +39/-36)
```diff
@@ -115,15 +115,17 @@ export const config = {
 };
 ```
 
-#### Step 2: Map tokens to Tailwind in `global.css`
+#### Step 2: Map tokens in `global.css`
 
-In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+NativeWind v5 uses a CSS-first approach. Map your tokens to Tailwind utilities in `global.css` using `@theme inline`:
 
 ```css
+@import "tailwindcss/theme.css" layer(theme);
+@import "tailwindcss/preflight.css" layer(base);
+@import "tailwindcss/utilities.css";
+@import "nativewind/theme";
+
 @theme inline {
-  --color-border: rgb(var(--border));
-  --color-input: rgb(var(--input));
-  --color-ring: rgb(var(--ring));
   --color-background: rgb(var(--background));
   --color-foreground: rgb(var(--foreground));
   --color-primary: rgb(var(--primary));
@@ -138,41 +140,44 @@ In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` usin
   --color-popover: rgb(var(--popover));
   --color-popover-foreground: rgb(var(--popover-foreground));
   --color-card: rgb(var(--card));
+  --color-border: rgb(var(--border));
+  --color-input: rgb(var(--input));
+  --color-ring: rgb(var(--ring));
 }
 ```
 
+The `vars()` in `config.ts` sets the CSS custom properties (like `--primary: 23 23 23`), and `@theme inline` in `global.css` maps them to Tailwind utilities (like `bg-primary`, `text-primary-foreground`).
+
 ### Usage in Components
 
 Once configured, use the semantic tokens in your components:
 
 ```jsx
-<>
-  {/* Primary button */}
-  <Button className="bg-primary text-primary-foreground">
-    <ButtonText>Primary Action</ButtonText>
-  </Button>
-
-  {/* Secondary button */}
-  <Button className="bg-secondary text-secondary-foreground">
-    <ButtonText>Secondary Action</ButtonText>
-  </Button>
-
-  {/* Card with proper contrast */}
-  <Box className="bg-card border border-border p-4">
-    <Text className="text-foreground">Card content</Text>
-    <Text className="text-muted-foreground">Muted description</Text>
-  </Box>
-
-  {/* Destructive action */}
-  <Button className="bg-destructive text-primary-foreground">
-    <ButtonText>Delete</ButtonText>
-  </Button>
-
-  {/* With opacity */}
-  <Box className="bg-primary/10">
-    <Text className="text-primary">Subtle primary background</Text>
-  </Box>
-</>
+// Primary button
+<Button className="bg-primary text-primary-foreground">
+  <ButtonText>Primary Action</ButtonText>
+</Button>
+
+// Secondary button
+<Button className="bg-secondary text-secondary-foreground">
+  <ButtonText>Secondary Action</ButtonText>
+</Button>
+
+// Card with proper contrast
+<Box className="bg-card border border-border p-4">
+  <Text className="text-foreground">Card content</Text>
+  <Text className="text-muted-foreground">Muted description</Text>
+</Box>
+
+// Destructive action
+<Button className="bg-destructive text-primary-foreground">
+  <ButtonText>Delete</ButtonText>
+</Button>
+
+// With opacity
+<Box className="bg-primary/10">
+  <Text className="text-primary">Subtle primary background</Text>
+</Box>
 ```
 
 ### Adding Custom Tokens
@@ -200,7 +205,7 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to `global.css`
+#### Step 2: Add to global.css
 
 ```css
 @theme inline {
@@ -231,7 +236,7 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to `global.css`
+#### Step 2: Add to global.css
 
 ```css
 @theme inline {
@@ -240,8 +245,6 @@ export const config = {
 }
 ```
 
-Then use it in your components with the `text-custom-heading-xl` class.
-
 #### Step 3: Configure tva for the component
 
 For custom font sizes to work with `tva` (Tailwind Variants Authority), add configuration:
```

**File**: `src/docs/home/theme-configuration/dark-mode/index.mdx` (modified, +10/-7)
```diff
@@ -20,26 +20,31 @@ gluestack-ui provides two ways of switching the color scheme or color mode: usin
 
 ### Using CSS Variables
 
-With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v5/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
+With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
 
 ### Usage
 
 Let's look at an example where we define the `primary` token and switch it.
 
-1. First, map the CSS variable to a Tailwind color utility in your `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+1. First, map the color token in your `global.css` file using `@theme inline`:
 
 ```css
 /* global.css */
+
+@import "tailwindcss/theme.css" layer(theme);
+@import "tailwindcss/preflight.css" layer(base);
+@import "tailwindcss/utilities.css";
+@import "nativewind/theme";
+
 @theme inline {
   --color-primary: rgb(var(--color-primary));
 }
 ```
 
-2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below:
+2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below. [Reference](https://www.nativewind.dev/v4/guides/themes).
 
 ```js
 // config.ts
-import { vars } from 'nativewind';
 
 export const config = {
   light: vars({
@@ -115,9 +120,7 @@ export default function App() {
 }
 ```
 
-In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 uses Tailwind CSS v4, where the `dark:` variant works out of the box using `prefers-color-scheme: dark` — no `tailwind.config.js` or `DARK_MODE` environment variable needed.
-
-For web apps that need manual dark mode toggling (class-based), define `:root.dark` and `:root.light` selectors in your `global.css` `@layer theme` block. The `GluestackUIProvider` `mode` prop handles the toggle on both native and web. See the [installation guide](/ui/docs/home/getting-started/installation) for the full `global.css` setup.
+In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 automatically handles the color scheme switching — no `tailwind.config.js` configuration is required.
 
 ## Persist Color Mode
 
```

**File**: `src/docs/home/theme-configuration/default-tokens/index.mdx` (modified, +8/-34)
```diff
@@ -82,13 +82,11 @@ export const config = {
 
 Usage with opacity:
 ```jsx
-<>
-  {/* Full opacity — bg-primary (100% opacity) */}
-  <Box className="bg-primary" />
+// Full opacity
+<Box className="bg-primary" />
 
-  {/* 50% opacity — bg-primary/50 */}
-  <Box className="bg-primary/50" />
-</>
+// 50% opacity
+<Box className="bg-primary/50" />
 ```
 
 ### Benefits of This System
@@ -102,41 +100,17 @@ To customize colors, update `gluestack-ui-provider/config.ts` and `global.css`.
 
 ## Typography
 
-To manage Typography options, add tokens in `global.css` via `@theme inline`.
+To manage Typography options, update `global.css` using `@theme inline` or `@theme` in Tailwind v4.
 
-To add or update **Font Family**, use `@theme inline` in `global.css`:
+To add or update **Font Family**. Please refer [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family). We have also added a new family, '**roboto**', in `global.css`.
 
-```css
-@theme inline {
-  --font-family-roboto: 'Roboto', sans-serif;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family) for more details.
-
-To add or update **font sizes**, use `@theme inline` in `global.css`:
-
-```css
-@theme inline {
-  --font-size-2xs: 10px;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size) for more details.
+To add or update **font sizes**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size). We have added a new size, '**2xs**', in `global.css` with a value of '**10px**'.
 
 <FontSizeComponent />
 
 <br />
 
-To add or update **font weights**, use `@theme inline` in `global.css`:
-
-```css
-@theme inline {
-  --font-weight-extrablack: 950;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight) for more details.
+To add or update **font weights**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight). We have added a new weight, '**extrablack**', in `global.css` with a value of '**950**'.
 
 <FontWeightComponent />
 
```

---

### Incident Patch 9: `59ba4aca` (2026-08-10)
**Commit Message**: fix: align docs and examples with v5 component props, add Avatar size support

- Remove stale size/variant/action props from 8 component docs
- Remove stale size props from menu and form-control examples
- Add missing size/variant docs for radio, tooltip, textarea, toast
- Fix heading default size (md -> lg)
- Add size prop (sm/md/lg) to Avatar with React context propagation

**File**: `src/docs/guides/more/troubleshooting/index.mdx` (modified, +5/-12)
```diff
@@ -5,7 +5,7 @@ description: Troubleshoot common Nativewind issues, including dark mode, Toast i
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
 
 ## Common Issues
 
@@ -40,23 +40,16 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+To ensure Tailwind styles override with higher specificity in Tailwind v4, use the `important` configuration in your `global.css`:
 
-```jsx
-// tailwind.config.js
-module.exports = {
-  ...
-  important: 'html',
-  ...
-}
+```css
+@import "tailwindcss/utilities.css" important(html);
 ```
 
-**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
-
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
+- `dark:` class strategy now works on both web and native in v5.
 
 ## Still Facing Issues?
 
```

**File**: `src/docs/home/theme-configuration/customizing-theme/index.mdx` (modified, +39/-36)
```diff
@@ -115,15 +115,17 @@ export const config = {
 };
 ```
 
-#### Step 2: Map tokens to Tailwind in `global.css`
+#### Step 2: Map tokens in `global.css`
 
-In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+NativeWind v5 uses a CSS-first approach. Map your tokens to Tailwind utilities in `global.css` using `@theme inline`:
 
 ```css
+@import "tailwindcss/theme.css" layer(theme);
+@import "tailwindcss/preflight.css" layer(base);
+@import "tailwindcss/utilities.css";
+@import "nativewind/theme";
+
 @theme inline {
-  --color-border: rgb(var(--border));
-  --color-input: rgb(var(--input));
-  --color-ring: rgb(var(--ring));
   --color-background: rgb(var(--background));
   --color-foreground: rgb(var(--foreground));
   --color-primary: rgb(var(--primary));
@@ -138,41 +140,44 @@ In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` usin
   --color-popover: rgb(var(--popover));
   --color-popover-foreground: rgb(var(--popover-foreground));
   --color-card: rgb(var(--card));
+  --color-border: rgb(var(--border));
+  --color-input: rgb(var(--input));
+  --color-ring: rgb(var(--ring));
 }
 ```
 
+The `vars()` in `config.ts` sets the CSS custom properties (like `--primary: 23 23 23`), and `@theme inline` in `global.css` maps them to Tailwind utilities (like `bg-primary`, `text-primary-foreground`).
+
 ### Usage in Components
 
 Once configured, use the semantic tokens in your components:
 
 ```jsx
-<>
-  {/* Primary button */}
-  <Button className="bg-primary text-primary-foreground">
-    <ButtonText>Primary Action</ButtonText>
-  </Button>
-
-  {/* Secondary button */}
-  <Button className="bg-secondary text-secondary-foreground">
-    <ButtonText>Secondary Action</ButtonText>
-  </Button>
-
-  {/* Card with proper contrast */}
-  <Box className="bg-card border border-border p-4">
-    <Text className="text-foreground">Card content</Text>
-    <Text className="text-muted-foreground">Muted description</Text>
-  </Box>
-
-  {/* Destructive action */}
-  <Button className="bg-destructive text-primary-foreground">
-    <ButtonText>Delete</ButtonText>
-  </Button>
-
-  {/* With opacity */}
-  <Box className="bg-primary/10">
-    <Text className="text-primary">Subtle primary background</Text>
-  </Box>
-</>
+// Primary button
+<Button className="bg-primary text-primary-foreground">
+  <ButtonText>Primary Action</ButtonText>
+</Button>
+
+// Secondary button
+<Button className="bg-secondary text-secondary-foreground">
+  <ButtonText>Secondary Action</ButtonText>
+</Button>
+
+// Card with proper contrast
+<Box className="bg-card border border-border p-4">
+  <Text className="text-foreground">Card content</Text>
+  <Text className="text-muted-foreground">Muted description</Text>
+</Box>
+
+// Destructive action
+<Button className="bg-destructive text-primary-foreground">
+  <ButtonText>Delete</ButtonText>
+</Button>
+
+// With opacity
+<Box className="bg-primary/10">
+  <Text className="text-primary">Subtle primary background</Text>
+</Box>
 ```
 
 ### Adding Custom Tokens
@@ -200,7 +205,7 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to `global.css`
+#### Step 2: Add to global.css
 
 ```css
 @theme inline {
@@ -231,7 +236,7 @@ export const config = {
 };
 ```
 
-#### Step 2: Add to `global.css`
+#### Step 2: Add to global.css
 
 ```css
 @theme inline {
@@ -240,8 +245,6 @@ export const config = {
 }
 ```
 
-Then use it in your components with the `text-custom-heading-xl` class.
-
 #### Step 3: Configure tva for the component
 
 For custom font sizes to work with `tva` (Tailwind Variants Authority), add configuration:
```

**File**: `src/docs/home/theme-configuration/dark-mode/index.mdx` (modified, +10/-7)
```diff
@@ -20,26 +20,31 @@ gluestack-ui provides two ways of switching the color scheme or color mode: usin
 
 ### Using CSS Variables
 
-With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v5/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
+With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
 
 ### Usage
 
 Let's look at an example where we define the `primary` token and switch it.
 
-1. First, map the CSS variable to a Tailwind color utility in your `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+1. First, map the color token in your `global.css` file using `@theme inline`:
 
 ```css
 /* global.css */
+
+@import "tailwindcss/theme.css" layer(theme);
+@import "tailwindcss/preflight.css" layer(base);
+@import "tailwindcss/utilities.css";
+@import "nativewind/theme";
+
 @theme inline {
   --color-primary: rgb(var(--color-primary));
 }
 ```
 
-2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below:
+2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below. [Reference](https://www.nativewind.dev/v4/guides/themes).
 
 ```js
 // config.ts
-import { vars } from 'nativewind';
 
 export const config = {
   light: vars({
@@ -115,9 +120,7 @@ export default function App() {
 }
 ```
 
-In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 uses Tailwind CSS v4, where the `dark:` variant works out of the box using `prefers-color-scheme: dark` — no `tailwind.config.js` or `DARK_MODE` environment variable needed.
-
-For web apps that need manual dark mode toggling (class-based), define `:root.dark` and `:root.light` selectors in your `global.css` `@layer theme` block. The `GluestackUIProvider` `mode` prop handles the toggle on both native and web. See the [installation guide](/ui/docs/home/getting-started/installation) for the full `global.css` setup.
+In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 automatically handles the color scheme switching — no `tailwind.config.js` configuration is required.
 
 ## Persist Color Mode
 
```

**File**: `src/docs/home/theme-configuration/default-tokens/index.mdx` (modified, +8/-34)
```diff
@@ -82,13 +82,11 @@ export const config = {
 
 Usage with opacity:
 ```jsx
-<>
-  {/* Full opacity — bg-primary (100% opacity) */}
-  <Box className="bg-primary" />
+// Full opacity
+<Box className="bg-primary" />
 
-  {/* 50% opacity — bg-primary/50 */}
-  <Box className="bg-primary/50" />
-</>
+// 50% opacity
+<Box className="bg-primary/50" />
 ```
 
 ### Benefits of This System
@@ -102,41 +100,17 @@ To customize colors, update `gluestack-ui-provider/config.ts` and `global.css`.
 
 ## Typography
 
-To manage Typography options, add tokens in `global.css` via `@theme inline`.
+To manage Typography options, update `global.css` using `@theme inline` or `@theme` in Tailwind v4.
 
-To add or update **Font Family**, use `@theme inline` in `global.css`:
+To add or update **Font Family**. Please refer [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family). We have also added a new family, '**roboto**', in `global.css`.
 
-```css
-@theme inline {
-  --font-family-roboto: 'Roboto', sans-serif;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family) for more details.
-
-To add or update **font sizes**, use `@theme inline` in `global.css`:
-
-```css
-@theme inline {
-  --font-size-2xs: 10px;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size) for more details.
+To add or update **font sizes**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size). We have added a new size, '**2xs**', in `global.css` with a value of '**10px**'.
 
 <FontSizeComponent />
 
 <br />
 
-To add or update **font weights**, use `@theme inline` in `global.css`:
-
-```css
-@theme inline {
-  --font-weight-extrablack: 950;
-}
-```
-
-Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight) for more details.
+To add or update **font weights**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight). We have added a new weight, '**extrablack**', in `global.css` with a value of '**950**'.
 
 <FontWeightComponent />
 
```

---

### Incident Patch 10: `28689a71` (2026-08-10)
**Commit Message**: Merge pull request #3447 from gluestack/fix/v5-theming-docs

fix(docs): update theming docs from tailwind.config.js to NativeWind …

**File**: `apps/website/app/ui/docs/guides/more/troubleshooting/index.mdx` (modified, +5/-3)
```diff
@@ -2,7 +2,7 @@ import { CodeBlock } from "@/components/custom/markdown/code-block";
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
 
 ## Common Issues
 
@@ -37,7 +37,7 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
 
 ```jsx
 // tailwind.config.js
@@ -48,10 +48,12 @@ module.exports = {
 }
 ```
 
+**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
+
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices.
+- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
 
 ## Still Facing Issues?
 
```

**File**: `apps/website/app/ui/docs/home/theme-configuration/customizing-theme/index.mdx` (modified, +66/-85)
```diff
@@ -105,82 +105,64 @@ export const config = {
 };
 ```
 
-#### Step 2: Map tokens to Tailwind in `tailwind.config.js`
-
-Ensure your Tailwind config maps the CSS variables to Tailwind classes:
-
-```jsx
-module.exports = {
-  theme: {
-    extend: {
-      colors: {
-        border: 'rgb(var(--border))',
-        input: 'rgb(var(--input))',
-        ring: 'rgb(var(--ring))',
-        background: 'rgb(var(--background))',
-        foreground: 'rgb(var(--foreground))',
-        primary: {
-          DEFAULT: 'rgb(var(--primary))',
-          foreground: 'rgb(var(--primary-foreground))',
-        },
-        secondary: {
-          DEFAULT: 'rgb(var(--secondary))',
-          foreground: 'rgb(var(--secondary-foreground))',
-        },
-        destructive: {
-          DEFAULT: 'rgb(var(--destructive))',
-        },
-        muted: {
-          DEFAULT: 'rgb(var(--muted))',
-          foreground: 'rgb(var(--muted-foreground))',
-        },
-        accent: {
-          DEFAULT: 'rgb(var(--accent))',
-          foreground: 'rgb(var(--accent-foreground))',
-        },
-        popover: {
-          DEFAULT: 'rgb(var(--popover))',
-          foreground: 'rgb(var(--popover-foreground))',
-        },
-        card: {
-          DEFAULT: 'rgb(var(--card))',
-        },
-      },
-    },
-  },
-};
+#### Step 2: Map tokens to Tailwind in `global.css`
+
+In NativeWind v5, Tailwind theme tokens are mapped directly in `global.css` using `@theme inline` — no `tailwind.config.js` needed:
+
+```css
+@theme inline {
+  --color-border: rgb(var(--border));
+  --color-input: rgb(var(--input));
+  --color-ring: rgb(var(--ring));
+  --color-background: rgb(var(--background));
+  --color-foreground: rgb(var(--foreground));
+  --color-primary: rgb(var(--primary));
+  --color-primary-foreground: rgb(var(--primary-foreground));
+  --color-secondary: rgb(var(--secondary));
+  --color-secondary-foreground: rgb(var(--secondary-foreground));
+  --color-destructive: rgb(var(--destructive));
+  --color-muted: rgb(var(--muted));
+  --color-muted-foreground: rgb(var(--muted-foreground));
+  --color-accent: rgb(var(--accent));
+  --color-accent-foreground: rgb(var(--accent-foreground));
+  --color-popover: rgb(var(--popover));
+  --color-popover-foreground: rgb(var(--popover-foreground));
+  --color-card: rgb(var(--card));
+}
 ```
 
 ### Usage in Components
 
 Once configured, use the semantic tokens in your components:
 
 ```jsx
-// Primary button
-<Button className="bg-primary text-primary-foreground">
-  <ButtonText>Primary Action</ButtonText>
-</Button>
-
-// Secondary button
-<Button className="bg-secondary text-secondary-foreground">
-  <ButtonText>Secondary Action</ButtonText>
-</Button>
-
-// Card with proper contrast
-<Box className="bg-card border border-border p-4">
-  <Text className="text-foreground">Card content</Text>
-  <Text className="text-muted-foreground">Muted description</Text>
-</Box>
-
-// Destructive action
-<Button className="bg-destructive text-primary-foreground">
-  <ButtonText>Delete</ButtonText>
-</Button>
-
-// With opacity
-<Box className="bg-primary/10">
-  <Text className="text-primary">Subtle primary background</Text>
-</Box>
+<>
+  {/* Primary button */}
+  <Button className="bg-primary text-primary-foreground">
+    <ButtonText>Primary Action</ButtonText>
+  </Button>
+
+  {/* Secondary button */}
+  <Button className="bg-secondary text-secondary-foreground">
+    <ButtonText>Secondary Action</ButtonText>
+  </Button>
+
+  {/* Card with proper contrast */}
+  <Box className="bg-card border border-border p-4">
+    <Text className="text-foreground">Card content</Text>
+    <Text className="text-muted-foreground">Muted description</Text>
+  </Box>
+
+  {/* Destructive action */}
+  <Button className="bg-destructive text-primary-foreground">
+    <ButtonText>Delete</ButtonText>
+  </Button>
+
+  {/* With opacity */}
+  <Box className="bg-primary/10">
+    <Text className="text-primary">Subtle primary background</Text>
+  </Box>
```

**File**: `apps/website/app/ui/docs/home/theme-configuration/dark-mode/index.mdx` (modified, +11/-40)
```diff
@@ -14,32 +14,26 @@ gluestack-ui provides two ways of switching the color scheme or color mode: usin
 
 ### Using CSS Variables
 
-With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v4/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
+With CSS variables, you can configure multiple color schemes in the `config.ts` file. This file contains two predefined color schemes: `light` and `dark`. It utilizes the [vars](https://www.nativewind.dev/v5/api/vars) functionality from nativewind to switch token values when the color mode is changed. This approach results in less code and makes configuring tokens for different color schemes easier.
 
 ### Usage
 
 Let's look at an example where we define the `primary` token and switch it.
 
-1. First, define the color token in your `tailwind.config.js` file and assign a variable value as shown below, following Tailwind's recommendation for [using CSS variables in Tailwind](https://tailwindcss.com/docs/customizing-colors#using-css-variables).
+1. First, map the CSS variable to a Tailwind color utility in your `global.css` using `@theme inline` — no `tailwind.config.js` needed:
 
-```js
-// tailwind.config.js
-
-module.exports = {
-  theme: {
-    extend: {
-      colors: {
-        primary: 'rgb(var(--color-primary)/<alpha-value>)',
-      },
-    },
-  },
-};
+```css
+/* global.css */
+@theme inline {
+  --color-primary: rgb(var(--color-primary));
+}
 ```
 
-2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below. [Reference](https://www.nativewind.dev/v4/guides/themes).
+2. Now, define the values of that CSS variable for the `light` and `dark` color schemes in the `config.ts` file as shown below:
 
 ```js
 // config.ts
+import { vars } from 'nativewind';
 
 export const config = {
   light: vars({
@@ -115,32 +109,9 @@ export default function App() {
 }
 ```
 
-In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. To use dark mode, we need to change the `darkMode` strategy to `"class"` for the web and `"media"` for native devices in the `tailwind.config.js` file. You can achieve this by setting the `DARK_MODE` environment variable as shown below.
-
-```js
-// tailwind.config.js
-
-module.exports = {
-  darkMode: process.env.DARK_MODE ? process.env.DARK_MODE : 'media',
-  // rest of the config
-};
-```
-
-After this, we need to update our scripts in the `package.json` file as shown below:
-
-```json
-{
-  "scripts": {
-    "android": "DARK_MODE=media expo start --android",
-    "ios": "DARK_MODE=media expo start --ios",
-    "web": "DARK_MODE=class expo start --web"
-  }
-}
-```
-
-For Next.js projects, you can directly set the `darkMode` strategy to `"class"` without needing to change the scripts.
+In the above example, we switch the background color of our Box component in dark mode using the `dark:` syntax. NativeWind v5 uses Tailwind CSS v4, where the `dark:` variant works out of the box using `prefers-color-scheme: dark` — no `tailwind.config.js` or `DARK_MODE` environment variable needed.
 
-> Note: This is a temporary solution until we fix the issue with nativewind for the `darkMode:"class"` strategy.
+For web apps that need manual dark mode toggling (class-based), define `:root.dark` and `:root.light` selectors in your `global.css` `@layer theme` block. The `GluestackUIProvider` `mode` prop handles the toggle on both native and web. See the [installation guide](/ui/docs/home/getting-started/installation) for the full `global.css` setup.
 
 ## Persist Color Mode
 
```

**File**: `apps/website/app/ui/docs/home/theme-configuration/default-tokens/index.mdx` (modified, +35/-9)
```diff
@@ -72,11 +72,13 @@ export const config = {
 
 Usage with opacity:
 ```jsx
-// Full opacity
-<Box className="bg-primary" />
+<>
+  {/* Full opacity — bg-primary (100% opacity) */}
+  <Box className="bg-primary" />
 
-// 50% opacity
-<Box className="bg-primary/50" />
+  {/* 50% opacity — bg-primary/50 */}
+  <Box className="bg-primary/50" />
+</>
 ```
 
 ### Benefits of This System
@@ -86,21 +88,45 @@ Usage with opacity:
 3. **Guaranteed contrast** - Foreground tokens ensure readable text
 4. **Design system consistency** - Follows industry-standard patterns
 
-To customize colors, update `gluestack-ui-provider/config.ts` and `tailwind.config.js`. For detailed instructions, see [Customizing Theme](/ui/docs/home/theme-configuration/customizing-theme).
+To customize colors, update `gluestack-ui-provider/config.ts` and `global.css`. For detailed instructions, see [Customizing Theme](/ui/docs/home/theme-configuration/customizing-theme).
 
 ## Typography
 
-To manage Typography options, update **theme** in `tailwind.config.js`.
+To manage Typography options, add tokens in `global.css` via `@theme inline`.
 
-To add or update **Font Family**. Please refer [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family). We have also added a new family, '**roboto**', in our `tailwind.config.js`.
+To add or update **Font Family**, use `@theme inline` in `global.css`:
 
-To add or update **font sizes**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size). We have added a new size, '**2xs**', in `tailwind.config.js` with a value of '**10px**'.
+```css
+@theme inline {
+  --font-family-roboto: 'Roboto', sans-serif;
+}
+```
+
+Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-family) for more details.
+
+To add or update **font sizes**, use `@theme inline` in `global.css`:
+
+```css
+@theme inline {
+  --font-size-2xs: 10px;
+}
+```
+
+Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-size) for more details.
 
 <FontSizeComponent />
 
 <br />
 
-To add or update **font weights**, please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight). We have added a new weight, '**extrablack**', in `tailwind.config.js` with a value of '**950**'.
+To add or update **font weights**, use `@theme inline` in `global.css`:
+
+```css
+@theme inline {
+  --font-weight-extrablack: 950;
+}
+```
+
+Please refer to the [Tailwind CSS documentation](https://tailwindcss.com/docs/font-weight) for more details.
 
 <FontWeightComponent />
 
```

**File**: `apps/website/public/llms-full.txt` (modified, +143/-160)
```diff
@@ -2284,14 +2284,16 @@ const RootComponent = withStyleContext(View, SCOPE);
 const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
 const AnimatedView = Animated.createAnimatedComponent(View);
 
+const StyledAnimatedPressable = styled(AnimatedPressable, { className: 'style' });
+
 const UIAccessibleAlertDialog = createAlertDialog({
   Root: RootComponent,
   Body: ScrollView,
   Content: AnimatedView,
   CloseButton: Pressable,
   Header: View,
   Footer: View,
-  Backdrop: AnimatedPressable,
+  Backdrop: StyledAnimatedPressable,
 });
 
 const alertDialogStyle = tva({
@@ -2335,7 +2337,7 @@ const alertDialogFooterStyle = tva({
 const alertDialogBodyStyle = tva({ base: '' });
 
 const alertDialogBackdropStyle = tva({
-  base: 'absolute left-0 top-0 right-0 bottom-0 bg-black/50 web:cursor-default',
+  base: 'absolute left-0 top-0 right-0 bottom-0 bg-[#000]/50 web:cursor-default',
 });
 
 type IAlertDialogProps = React.ComponentPropsWithoutRef<
@@ -26134,6 +26136,10 @@ Create an intuitive UI using the gluestack-ui Tooltip component in React & React
 This is an illustration of **Tooltip** component.
 
 
+
+
+
+
 ```jsx
 function Example() {
   return (
@@ -28002,7 +28008,7 @@ URL: /ui/docs/guides/more/troubleshooting/index
 
 # Troubleshooting
 
-If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v4/guides/troubleshooting).
+If you encounter any issues while using nativewind, please refer to the nativewind [troubleshooting guide](https://www.nativewind.dev/v5/guides/troubleshooting).
 
 ## Common Issues
 
@@ -28035,7 +28041,7 @@ If encountering flashing issues in Next.js:
 
 ### 4. TailwindCSS Classnames Not Overriding in react-native-web
 
-To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
+**NativeWind v4:** To ensure Tailwind styles override with higher specificity, add `important: 'html'` to your `tailwind.config.js`.
 
 ```jsx
 // tailwind.config.js
@@ -28046,10 +28052,12 @@ module.exports = {
 }
 ```
 
+**NativeWind v5:** This uses Tailwind CSS v4 (CSS-first) and does not use `tailwind.config.js`. See the [upgrade to v5 guide](/ui/docs/guides/more/upgrade-to-v5) for the current setup.
+
 ## Known Issues
 
 - `placeholder` does not work with CSS tokens.
-- `dark:` does not function with "class" as a strategy in native devices.
+- `dark:` does not function with "class" as a strategy in native devices (NativeWind v4). In NativeWind v5, Tailwind CSS v4 handles dark mode via `prefers-color-scheme` by default.
 
 ## Still Facing Issues?
 
@@ -29582,7 +29590,7 @@ Both engines eliminate `tailwind.config.js` in favor of defining theme tokens di
 ## Automated Upgrade (Recommended)
 
 ```bash
-npx gluestack-ui@alpha upgrade
+npx gluestack-ui@latest upgrade
 ```
 
 The CLI auto-detects your current version and asks which engine to upgrade to:
@@ -29605,7 +29613,7 @@ The CLI auto-detects your current version and asks which engine to upgrade to:
 | Area | Before (NativeWind v4) | After (NativeWind v5) |
 | --- | --- | --- |
 | Tailwind version | `tailwindcss@^3.x` | `tailwindcss@^4.2.0` |
-| NativeWind version | `nativewind@^4.1.23` | `nativewind@^5.0.0-preview.2` |
+| NativeWind version | `nativewind@^4.1.23` | `nativewind@^5.0.0-preview.4` |
 | New package | — | `react-native-css@^3.0.4` |
 | PostCSS config | — | `postcss.config.js` with `@tailwindcss/postcss` |
 | Theme tokens | `tailwind.config.js` | `global.css` via `@layer theme` |
@@ -29616,13 +29624,13 @@ The CLI auto-detects your current version and asks which engine to upgrade to:
 ## Automated CLI Upgrade
 
 ```bash
-npx gluestack-ui@alpha upgrade
+npx gluestack-ui@latest upgrade
 ```
 
 Select **NativeWind v5 (Tailwind CSS v4)**. The CLI will:
 
 1. Pin `lightningcss@1.30.1` in `package.json` overrides/resolutions
-2. Replace `nativewind@^4.x` with `nativewind@^5.0.0-preview.2`, add `react-native-css`
+2. Replace `n
```

#### Recent Merged Pull Requests:
- **PR #3461** (closed): fix (#3460): add option to disable native select on web (@holyarsenic)
- **PR #3456** (2026-09-02): fix: remove Product Hunt banner from header (@T-Reddappa)
- **PR #3451** (2026-08-19): fix: update landing page components for improved styling and function… (@T-Reddappa)
- **PR #3450** (2026-08-10): fix(modal): enable scroll when content overflows viewport (@T-Reddappa)
- **PR #3449** (2026-08-10): fix: align docs and examples with v5 component props, add Avatar size… (@T-Reddappa)
- **PR #3448** (2026-08-10): fix: align docs and examples with v5 component props, add Avatar size… (@T-Reddappa)
- **PR #3447** (2026-08-10): fix(docs): update theming docs from tailwind.config.js to NativeWind … (@T-Reddappa)
- **PR #3445** (2026-08-06): feat: add Product Hunt banner to website header (@T-Reddappa)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
