# Forensic Learning Record (Deep Inspection): react-navigation/react-navigation

> **Canonical Artifact**: `07_PROJECT_LEARNING/react-navigation-react-navigation-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/react-navigation/react-navigation](https://github.com/react-navigation/react-navigation))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:03.543Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `react-navigation/react-navigation`
- **Description**: Routing and navigation for React Native and Web apps
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 24510 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    '@babel/plugin-transform-explicit-resource-management',
    'react-native-worklets/plugin',
  ],
};

```

### Core Architecture Module: `commitlint.config.js`
```
module.exports = {
  extends: ['@commitlint/config-conventional'],
};

```

### Core Architecture Module: `eslint.config.mjs`
```
import { defineConfig, globalIgnores } from 'eslint/config';
import { jest, react, recommended } from 'eslint-config-satya164';
import * as tsResolver from 'eslint-import-resolver-typescript';
import sort from 'eslint-plugin-simple-import-sort';

export default defineConfig([
  recommended,
  react,
  jest,

  globalIgnores([
    '**/node_modules/',
    '**/coverage/',
    '**/dist/',
    '**/lib/',
    '**/.expo/',
    '**/.pnpm-store/',
    '**/.vscode/',
  ]),

  {
    files: ['**/*.{ts,mts,tsx}'],

    settings: {
      'import-x/resolver': {
        name: 'typescript-resolver',
        resolver: tsResolver,
        options: {
          conditionNames: [
            '@react-navigation/source',
            ...tsResolver.defaultConditionNames,
          ],
        },
      },
    },
  },

  {
    plugins: {
      'simple-import-sort': sort,
    },

    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@react-navigation/*/*',
            '!@react-navigation/elements/internal',
            '!@react-navigation/native/server',
          ],

          paths: [
            {
              name: 'react-native',
              importNames: ['Text'],
              message:
                'Import `Text` from `@react-navigation/elements` instead.',
            },
            {
              name: 'react-native-safe-area-context',
              importNames: ['useSafeAreaFrame'],
              message:
                'Import `useFrameSize` from `@react-navigation/elements` instead.',
            },
            {
              name: '@react-navigation/core',
              message: 'Import from `@react-navigation/native` instead.',
            },
          ],
        },
      ],

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',

      'import-x/no-default-export': 'error',

      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      'react-hooks/exhaustive-deps': [
        'error',
        {
          additionalHooks: '(useAnimatedStyle|useAnimatedProps)',
        },
      ],
    },
  },
  {
    files: ['**/__tests__/**/*.{js,jsx,ts,tsx}', '**/*.test.{js,jsx,ts,tsx}'],

    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@react-navigation/*/*',
            '!@react-navigation/native/server',
          ],

          paths: [
            {
              name: '@react-navigation/core',
              message: 'Import from `@react-navigation/native` instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/{native,devtools}/src/**'],

    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@react-navigation/*/*'],
          paths: [],
        },
      ],
    },
  },
  {
    files: ['**/*.config.{ts,mts,js,cjs,mjs}', '**/.*rc.{ts,mts,js,cjs,mjs}'],

    rules: {
      'import-x/no-default-export': 'off',
    },
  },
]);

```

### Core Architecture Module: `example/App.tsx`
```
import './gesture-handler';

import { setDynamicLoadingEnabled } from '@react-native-vector-icons/common';
import Feather from '@react-native-vector-icons/feather/fonts/Feather.ttf';
import Ionicons from '@react-native-vector-icons/ionicons/fonts/Ionicons.ttf';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/fonts/MaterialDesignIcons.ttf';
import { registerRootComponent } from 'expo';
import { loadAsync } from 'expo-font';
import * as React from 'react';
import { AppRegistry, LogBox, Platform } from 'react-native';
import { configure } from 'react-native-showtime';

import { App } from './src/index';

if (Platform.OS === 'ios') {
  configure({
    size: 24,
    strokeColor: '#7b61c1',
    strokeWidth: 2,
  });
}

LogBox.ignoreLogs([
  'Open debugger to view warnings',
  'findHostInstance_DEPRECATED is deprecated in StrictMode',
  'findNodeHandle is deprecated in StrictMode',
]);

function Root() {
  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

export const fonts = {
  Feather,
  Ionicons,
  MaterialDesignIcons,
};

if (Platform.OS === 'web') {
  AppRegistry.registerComponent('main', () => Root);

  if (typeof window !== 'undefined') {
    setDynamicLoadingEnabled(false);

    loadAsync(fonts);

    const rootTag = document.getElementById('root');

    AppRegistry.runApplication('main', {
      hydrate: rootTag?.firstElementChild != null,
      initialProps: {},
      rootTag,
    });
  }
} else {
  registerRootComponent(Root);
}

```

### Core Architecture Module: `example/__typechecks__/common.check.tsx`
```
/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import type {
  BottomTabNavigationOptions,
  BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import type {
  DrawerNavigationOptions,
  DrawerNavigationProp,
  DrawerScreenProps,
} from '@react-navigation/drawer';
import { Button } from '@react-navigation/elements';
import {
  type CompositeNavigationProp,
  type CompositeScreenProps,
  createNavigatorFactory,
  type DefaultNavigatorOptions,
  type DrawerNavigationState,
  type GenericNavigation,
  Link,
  type LinkingOptions,
  type NavigationAction,
  NavigationContainer,
  type NavigationContainerRef,
  type NavigationHelpers,
  type NavigationProp,
  type NavigationRoute,
  type NavigationState,
  type NavigatorScreenParams,
  type NavigatorTypeBagBase,
  type ParamListBase,
  type RootParamList,
  type Route,
  type RouteForName,
  type RouteProp,
  type StackActionHelpers,
  type StackNavigationState,
  type StaticScreenProps,
  type Theme,
  useLinkProps,
  useNavigation,
  useNavigationState,
  useRoute,
} from '@react-navigation/native';
import {
  createStackNavigator,
  type StackNavigationOptions,
  type StackNavigationProp,
  type StackOptionsArgs,
  type StackScreenProps,
} from '@react-navigation/stack';
import { expectTypeOf } from 'expect-type';

import type { BottomTabParamList } from '../src/Screens/BottomTabs';
import type { StaticScreenParamList } from '../src/Screens/StaticConfig';

/**
 * Check for the type of the `navigation` and `route` objects with regular usage
 */
type RootStackParamList = {
  Home: NavigatorScreenParams<HomeDrawerParamList>;
  Albums: NavigatorScreenParams<AlbumTabParamList>;
  Updates: NavigatorScreenParams<UpdatesTabParamList> | undefined;
  PostDetails: { id: string; section?: string };
  Settings: { path: string } | undefined;
  Login: undefined;
  NotFound: undefined;
};

type RootStackScreenProps<T extends keyof RootStackParamList> =
  StackScreenProps<RootStackParamList, T>;

type HomeDrawerParamList = {
  Feed: NavigatorScreenParams<FeedTabParamList>;
  Account: undefined;
};

type AlbumTabParamList = {
  Playlist: undefined;
  Artist: { id: string };
};

type UpdatesTabParamList = {
  Notifications: { type: 'all' | 'mentions' | 'replies' };
  Timeline: undefined;
};

type HomeDrawerScreenProps<T extends keyof HomeDrawerParamList> =
  CompositeScreenProps<
    DrawerScreenProps<HomeDrawerParamList, T>,
    RootStackScreenProps<'Home'>
  >;

type FeedTabParamList = {
  Popular: { filter: 'day' | 'week' | 'month' };
  Latest: undefined;
};

type FeedTabScreenProps<T extends keyof FeedTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<FeedTabParamList, T>,
    HomeDrawerScreenProps<'Feed'>
  >;

const Stack = createStackNavigator<RootStackParamList>();

expectTypeOf(Stack.Navigator).parameter(0).toMatchObjectType<{
  initialRouteName?: keyof RootStackParamList | undefined;
}>();

expectTypeOf(Stack.Screen).parameter(0).toExtend<{
  name?: keyof RootStackParamList | undefined;
}>();

export const PostDetailsScreen = ({
  navigation,
  route,
}: RootStackScreenProps<'PostDetails'>) => {
  expectTypeOf(route.name).toEqualTypeOf<'PostDetails'>();
  expectTypeOf(route.name).not.toEqualTypeOf<'Details'>();
  expectTypeOf(route.params).toEqualTypeOf<
    Readonly<{ id: string; section?: string }>
  >();

  expectTypeOf(navigation.setParams)
    .parameter(0)
    .toEqualTypeOf<{ id?: string; section?: string }>();

  expectTypeOf(navigation.replaceParams)
    .parameter(0)
    .toEqualTypeOf<{ id: string; section?: string }>();

  expectTypeOf(navigation.push)
    .parameter(0)
    .toEqualTypeOf<keyof RootStackParamList>();
  expectTypeOf(navigation.remove).parameters.toEqualTypeOf<
    [screen: keyof RootStackParamList, count?: number | undefined]
  >();

  expectTypeOf(navigation.setOptions)
    .parameter(0)
    .toEqualTypeOf<Partial<StackNavigationOptions>>();

  expectTypeOf(navigation.addListener)
    .parameter(0)
    .toEqualTypeOf<
      | 'focus'
      | 'blur'
      | 'state'
      | 'beforeRemove'
      | 'transitionStart'
      | 'transitionEnd'
      | 'gestureStart'
      | 'gestureEnd'
      | 'gestureCancel'
    >();
  expectTypeOf(navigation.addListener).returns.toEqualTypeOf<() => void>();

  navigation.addListener('transitionStart', (e) => {
    expectTypeOf(e.type).toEqualTypeOf<'transitionStart'>();
  });

  expectTypeOf(navigation.getState().type).toEqualTypeOf<'stack'>();
  expectTypeOf(navigation.getParent)
    .parameter(0)
    .toEqualTypeOf<'PostDetails' | undefined>();
};

export const FeedScreen = ({
  navigation,
  route,
}: HomeDrawerScreenProps<'Feed'>) => {
  expectTypeOf(route.name).toEqualTypeOf<'Feed'>();

  expectTypeOf(navigation.push)
    .parameter(0)
    .toEqualTypeOf<keyof RootStackParamList>();
  expectTypeOf(navigation.jumpTo)
    .parameter(0)
    .toEqualTypeOf<keyof HomeDrawerParamList>();

  expectTypeOf(navigation.openDrawer).toBeFunction();

  expectTypeOf(navigation.setOptions)
    .parameter(0)
    .toEqualTypeOf<Partial<DrawerNavigationOptions>>();

  expectTypeOf(navigation.addListener)
    .parameter(0)
    .toEqualTypeOf<
      | 'focus'
      | 'blur'
      | 'state'
      | 'beforeRemove'
      | 'drawerItemPress'
      | 'transitionStart'
      | 'transitionEnd'
      | 'gestureStart'
      | 'gestureEnd'
      | 'gestureCancel'
    >();

  expectTypeOf(navigation.getState().type).toEqualTypeOf<'drawer'>();
  expectTypeOf(navigation.getParent)
    .parameter(0)
    .toEqualTypeOf<'Feed' | 'Home' | undefined>();
};

export const PopularScreen = ({
  navigation,
  route,
}: FeedTabScreenProps<'Popular'>) => {
  expectTypeOf(route.name).toEqualTypeOf<'Popular'>();

  expectTypeOf(navigation.push)
    .parameter(0)
    .toEqualTypeOf<keyof RootStackParamList>();

  expectTypeOf<Parameters<typeof navigation.jumpTo>[0]>().toEqualTypeOf<
    keyof HomeDrawerParamList
  >();

  expectTypeOf(navigation.openDrawer).toBeFunction();

  expectTypeOf(navigation.setOptions)
    .parameter(0)
    .toEqualTypeOf<Partial<BottomTabNavigationOptions>>();

  expectTypeOf(navigation.addListener)
    .parameter(0)
    .toEqualTypeOf<
      | 'focus'
      | 'blur'
      | 'state'
      | 'beforeRemove'
      | 'tabPress'
      | 'tabLongPress'
      | 'transitionStart'
      | 'transitionEnd'
    >();

  expectTypeOf(navigation.setParams)
    .parameter(0)
    .toEqualTypeOf<Partial<FeedTabParamList['Popular']>>();

  expectTypeOf(navigation.getState().type).toEqualTypeOf<'tab'>();
  expectTypeOf(navigation.getParent)
    .parameter(0)
    .toEqualTypeOf<'Feed' | 'Home' | 'Popular' | undefined>();
};

export const LatestScreen = ({
  navigation,
  route,
}: FeedTabScreenProps<'Latest'>) => {
  expectTypeOf(route.name).toEqualTypeOf<'Latest'>();

  expectTypeOf(navigation.push)
    .parameter(0)
    .toEqualTypeOf<keyof RootStackParamList>();

  expectTypeOf<Parameters<typeof navigation.jumpTo>[0]>().toEqualTypeOf<
    keyof HomeDrawerParamList
  >();

  expectTypeOf(navigation.openDrawer).toBeFunction();

  expectTypeOf(navigation.setOptions)
    .parameter(0)
    .toEqualTypeOf<Partial<BottomTabNavigationOptions>>();

  expectTypeOf(navigation.setParams).parameter(0).toEqualTypeOf<undefined>();

  expectTypeOf(navigation.getState().type).toEqualTypeOf<'tab'>();
  expectTypeOf(navigation.getParent)
    .parameter(0)
    .toEqualTypeOf<'Feed' | 'Home' | 'Latest' | undefined>();
};

/**
 * Check for errors when the screen component isn't typed correctly
 */
type SecondParamList = {
  HasParams1: { id: string };
  HasParams2: { user: string };
  NoParams: undefined;
};

const SecondStack = createStackNavigator<SecondParamList>();

// No error when type for props is correct
<SecondStack.Screen
  name="HasParams1"
  component={(_: StackScreenProps<SecondParamList, 'HasParams1'>) => <></>}
/>;

<SecondStack.Screen
  name="HasParams1"
  component={(_: { route: { params: { id: string } } }) =>
```

### Core Architecture Module: `example/__typechecks__/standalone/dynamic/assets.d.ts`
```
declare module '*.png';

```

### Core Architecture Module: `example/__typechecks__/standalone/dynamic/index.check.tsx`
```
import {
  type BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import {
  type NavigatorScreenParams,
  useNavigation,
  useNavigationState,
  useRoute,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { expectTypeOf } from 'expect-type';

type FeaturedStackParamList = {
  ProductList: undefined;
  ProductDetails: { productId: number };
  ProductReviews: { productId: number; page: number };
  ProductGallery: { productId: number; index: number };
};

const FeaturedStack = createNativeStackNavigator<FeaturedStackParamList>();

type OnSaleStackParamList = {
  DealsList: undefined;
  DealDetails: { dealId: number };
  FlashSale: { saleId: string };
};

const OnSaleStack = createNativeStackNavigator<OnSaleStackParamList>();

type NewArrivalsStackParamList = {
  NewArrivalsList: undefined;
  NewArrivalDetails: { itemId: number };
};

const NewArrivalsStack =
  createNativeStackNavigator<NewArrivalsStackParamList>();

type CategoryTabParamList = {
  Featured: NavigatorScreenParams<FeaturedStackParamList>;
  OnSale: NavigatorScreenParams<OnSaleStackParamList>;
  NewArrivals: NavigatorScreenParams<NewArrivalsStackParamList>;
};

const CategoryTabs = createMaterialTopTabNavigator<
  CategoryTabParamList,
  {
    Featured: typeof FeaturedStack;
    OnSale: typeof OnSaleStack;
    NewArrivals: typeof NewArrivalsStack;
  }
>();

type SearchStackParamList = {
  SearchHome: undefined;
  SearchResults: { query: string; sort: 'price' | 'rating' };
};

const SearchStack = createNativeStackNavigator<SearchStackParamList>();

// Tabs whose screens are added at runtime, keyed by a category id.
// The id is branded so the keys stay distinct from plain `string`.
// A plain `string` key would widen every route name in the app to `string`.
type CategorySlug = string & { readonly __brand: 'CategorySlug' };

type BrandTabParamList = Record<CategorySlug, undefined>;

const BrandTabs = createMaterialTopTabNavigator<BrandTabParamList>();

type ShopStackParamList = {
  Categories: NavigatorScreenParams<typeof CategoryTabs>;
  Search: NavigatorScreenParams<SearchStackParamList>;
  Brands: NavigatorScreenParams<typeof BrandTabs>;
  Cart: undefined;
  Checkout: { cartId: string };
  PromoCode: { code: string };
};

const ShopStack = createNativeStackNavigator<ShopStackParamList>();

type OrderArchiveParamList = {
  ArchivedOrders: undefined;
  ArchivedOrderDetails: { orderId: string };
};

type OrderSupportStackParamList = {
  OrderSupportHome: undefined;
  OrderSupportTicket: { ticketId: string };
};

const OrderSupportStack =
  createNativeStackNavigator<OrderSupportStackParamList>();

type OrdersStackParamList = {
  OrderList: undefined;
  OrderDetails: { orderId: string };
  TrackShipment: { orderId: string; carrier: string };
  OrderArchive: NavigatorScreenParams<OrderArchiveParamList>;
  OrderSupport: NavigatorScreenParams<typeof OrderSupportStack>;
};

const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();

type InboxStackParamList = {
  InboxHome: undefined;
  MessageThread: { threadId: string };
};

const InboxStack = createNativeStackNavigator<InboxStackParamList>();

type MainTabParamList = {
  Shop: NavigatorScreenParams<typeof ShopStack>;
  Orders: NavigatorScreenParams<OrdersStackParamList>;
  Inbox: NavigatorScreenParams<InboxStackParamList>;
  Account: { userId: string };
};

const MainTabs = createBottomTabNavigator<MainTabParamList>();

type RootStackParamList = {
  Main: NavigatorScreenParams<typeof MainTabs>;
  SignIn: { redirectTo: string };
  Paywall: { plan: 'monthly' | 'yearly' };
  EditProfile: { userId: string };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

// The navigators are rendered at runtime; this keeps a value reference to each
// since they're otherwise only referenced as types in the nesting maps above.
export const navigators = {
  FeaturedStack,
  OnSaleStack,
  NewArrivalsStack,
  CategoryTabs,
  SearchStack,
  BrandTabs,
  ShopStack,
  OrderSupportStack,
  OrdersStack,
  InboxStack,
  MainTabs,
  RootStack,
};

declare module '@react-navigation/native' {
  interface RootNavigator extends RootStackType {}
}

type RootStackType = typeof RootStack;

export const ProductListScreen = () => {
  const navigation = useNavigation('ProductList');

  expectTypeOf(navigation.getState().type).toEqualTypeOf<'stack'>();

  expectTypeOf(navigation.getState().routeNames).toEqualTypeOf<
    ('ProductList' | 'ProductDetails' | 'ProductReviews' | 'ProductGallery')[]
  >();

  // Navigate within the same navigator
  navigation.push('ProductDetails', { productId: 1 });
  navigation.push('ProductReviews', { productId: 1, page: 2 });
  navigation.push('ProductGallery', { productId: 1, index: 0 });

  // @ts-expect-error - productId is required.
  navigation.push('ProductDetails');

  // @ts-expect-error - productId must be a number.
  navigation.push('ProductDetails', { productId: '1' });

  // @ts-expect-error - DealDetails is in a sibling navigator, not reachable by name.
  navigation.push('DealDetails', { dealId: 1 });

  // Navigate to routes in ancestor navigators via the composite
  navigation.navigate('Checkout', { cartId: 'c1' });
  navigation.navigate('Account', { userId: 'u1' });
  navigation.navigate('SignIn', { redirectTo: '/home' });

  // Navigate into a sibling navigator through the nested params
  navigation.navigate('Main', {
    screen: 'Shop',
    params: { screen: 'Search', params: { screen: 'SearchHome' } },
  });

  expectTypeOf(navigation.setParams).parameter(0).toEqualTypeOf<undefined>();

  expectTypeOf(navigation.setOptions)
    .parameter(0)
    .toEqualTypeOf<Partial<NativeStackNavigationOptions>>();

  expectTypeOf(navigation.getParent)
    .parameter(0)
    .toEqualTypeOf<
      'ProductList' | 'Featured' | 'Categories' | 'Shop' | 'Main' | undefined
    >();

  return null;
};

/**
 * Material top tabs nested four navigators deep.
 */
export const FeaturedTabScreen = () => {
  const navigation = useNavigation('Featured');

  expectTypeOf(navigation.getState().type).toEqualTypeOf<'tab'>();

  expectTypeOf(navigation.jumpTo).toBeFunction();

  expectTypeOf(navigation.setOptions)
    .parameter(0)
    .toEqualTypeOf<Partial<MaterialTopTabNavigationOptions>>();

  return null;
};

/**
 * Native stack nested three navigators deep, navigating through leaves.
 */
export const CartScreen = () => {
  const navigation = useNavigation('Cart');

  expectTypeOf(navigation.getState().type).toEqualTypeOf<'stack'>();

  navigation.push('Checkout', { cartId: 'c1' });
  navigation.push('PromoCode', { code: 'SALE' });

  // @ts-expect-error - cartId is required.
  navigation.push('Checkout');

  expectTypeOf(navigation.setParams).parameter(0).toEqualTypeOf<undefined>();

  expectTypeOf(navigation.setOptions)
    .parameter(0)
    .toEqualTypeOf<Partial<NativeStackNavigationOptions>>();

  return null;
};

/**
 * Plain param-list nested routes expose generic navigation, parent navigation,
 * and concrete navigator props when a child is declared with `typeof Navigator`.
 */
export const ParamListOnlyNestedScreen = () => {
  /**
   * ParamList > ParamList
   */
  {
    const navigation = useNavigation('ArchivedOrderDetails');

    navigation.navigate('ArchivedOrders');
    navigation.navigate('ArchivedOrderDetails', {
      orderId: 'archived-order-1',
    });

    navigation.navigate('OrderDetails', { orderId: 'order-1' });
    navigation.navigate('Account', { userId: 'u1' });
    navigation.navigate('SignIn', { redirectTo: '/orders' });

    // @ts-expect-error - orderId is required.
    navigation.navigate('ArchivedOrderDetails');

    // @ts-expect-error - param-list-only nested routes don't know the navigator type.
    navigati
```

### Core Architecture Module: `example/__typechecks__/standalone/static/assets.d.ts`
```
declare module '*.png';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13254** (2026-09-17): **[Web] Stacked card drop shadow is clipped — inactive CardA11yWrapper overflow: hidden has no opt-out**
  *Symptoms*: ### Current behavior  On web, I style each card as a floating panel with cardStyle: rounded corners, a border and a boxShadow. While a card is on top this looks right. As soon as I push another screen over it, the shadow on the card underneath is cut off. Only its 1px border stays. When I go back, the shadow shows again.  The cause is that the stack wraps every screen that is not on top in a View with overflow: 'hidden'. In 7.11.1 this is in CardA11yWrapper (overflow: active ? undefined : 'hidden'), on main the same rule sits on ActivityView in CardStack.tsx. It was added in 522fa47a so a taller inactive page does not make the document scroll.  There is no option to turn this off. Returning containerStyle: {overflow: 'visible'} from cardStyleInterpolator does not help, that style lands inside the wrapper that clips. cardOverlayEnabled, cardShadowEnabled, detachPreviousScreen and presentation: 'transparentModal' do not change it either. My page has overflow: hidden on body and the stack sits in a fixed-size container, so the scroll problem the clip was meant to fix cannot happen here. The clip only removes visuals.   ### Expected behavior  A card that is no longer on top should keep looking the same as when it was on top, shadow included. Or an option to skip the clip, in the style of cardOverlayEnabled or cardShadowEnabled, for layouts where the page cannot scroll anyway.  ### Reproduction  https://snack.expo.dev/@bartekholinice/stacked-card-drop-shadow  The packages in the S
  **Post-Mortem & Fix Analysis**:
  > The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/native` (found: `7.1.33`, latest: `7.4.1`) - `@react-navigation/bottom-tabs` (found: `7.15.5`, latest: `7.19.1`) - `@react-navigation/material-top-tabs` (found: `7.4.19`, latest: `7.7.1`) - `@react-navigation/stack` (found: `7.8.5`, latest: `7.11.1`) - `react-native-tab-view` (found: `4.3.0`, latest: `4.3.2`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?
  > Hey @BartekObudzinski! Thanks for opening the issue. It seems that the issue doesn't contain a link to a repro, or the provided repro is not valid (e.g. broken link, private repo, code doesn't run etc.).    **The best way to get attention to your issue is to provide an easy way for a developer to reproduce the issue.**    You can provide a repro using any of the following:    - Public GitHub repo under your username   - [TypeScript Playground](https://www.typescriptlang.org/play)    Try to keep the repro as small as possible by narrowing down the minimal amount of code needed to reproduce the issue. See ["How to create a Minimal, Reproducible Example"](https://stackoverflow.com/help/minimal-reproducible-example) for more information.    **Don't:**    - Link to your entire project or a project containing code unrelated to the issue.   - Link to a specific file in a GitHub repo, as it won't be detected.    You can edit your original issue to include a link to the repro, or leave it as a 

- **Issue #13223** (2026-08-30): **Nested TopTabNavigator inside a BottomTabNavigator will only render the TopTabs the first time the Bottom Tab is selected**
  *Symptoms*: ### Current behavior  **Description:** When using a nested MaterialTopTabNavigator inside a BottomTabNavigator, the Top Tabs of the MaterialTopTab Screen are only displayed the first time the Bottom Tab is selected. Sequential access to the MaterialTopTab Screen will not display  the Top Tabs.  **Video:** https://github.com/user-attachments/assets/6833155d-0028-4ee5-94bd-5b5e5353190e  ### Expected behavior  When switching the Bottom Tabs, the Top Tabs screen should always be rendered  ### Reproduction  https://github.com/davilavillalobosa/react-navigation-material-top-tabs-bug  ### Platform  - [x] Android - [ ] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [x] @react-navigation/bottom-tabs - [ ] @react-navigation/drawer - [x] @react-navigation/material-top-tabs - [ ] @react-navigation/stack - [ ] @react-navigation/native-stack - [ ] react-native-drawer-layout - [ ] react-native-tab-view  ### Environment  - [x] I've removed the packages that I don't use  | package                                | version | | -------------------------------------- | ------- | | @react-navigation/native               | ^7.3.17 | | @react-navigation/bottom-tabs               | ^7.18.17 | | @react-navigation/material-top-tabs    | ^7.6.16 | | react-native-screens                   | ^4.27.0 | | react-native-safe-area-context         | ^5.9.1 | | react-native-pager-view                | ^9.0.2 | | react-native                           | 0.86.2 | | node                                   
  **Post-Mortem & Fix Analysis**:
  > This looks like a real bug to me. Would it be okay if I try to work on a fix?
  > Yes of course, Everything that you require is in the description of this bug report
  > Thank you @scs0209 for giving it a try. I tested your pull request, but didn't work.  After some tests I realized that the problem is related to the react-native-pager-view library version 9.0.2. If I downgrade the version to 8.0.5 it will Nested TopTabNavigator inside a BottomTabNavigator will render every time. I will open an issue in react-native-paper-view and just suggests to update the documentation so that the working react-native-pager-view version is installed

- **Issue #13220** (2026-08-19): **RN 0.87, TypeScript – `useScrollToTop` no longer accepts `SectionList` refs**
  *Symptoms*: ### Current behavior  Passing a `SectionList` ref (or `SectionListInstance`) to `useScrollToTop` produces a TypeScript error under React Native 0.87. The same code works fine for `ScrollView` and `FlatList`.  ### Minimal repro  ```tsx import { useRef } from 'react'; import { ScrollViewInstance, FlatListInstance, SectionList, SectionListInstance } from 'react-native'; import { useScrollToTop } from '@react-navigation/native';  const App = () => {   const scrollViewRef = useRef<ScrollViewInstance>(null);   useScrollToTop(scrollViewRef); // All good    const flatListRef = useRef<FlatListInstance>(null);   useScrollToTop(flatListRef); // All good    const ref1 = useRef<SectionListInstance>(null);   useScrollToTop(ref1); // Error TS2345    const ref2 = useRef<SectionList>(null);   useScrollToTop(ref2); // Also Error TS2345    return <SectionList ref={ref1} sections={[]} />; }; ```  Error produced:  ``` App.tsx(21,18): error TS2345: Argument of type 'RefObject<SectionListInstance | null>' is not assignable to parameter of type 'RefObject<ScrollableWrapper>'.   Type 'SectionListInstance | null' is not assignable to type 'ScrollableWrapper'.     Type 'SectionListInstance' is not assignable to type 'ScrollableWrapper'.       Type 'SectionList<any, DefaultSectionT>' is not assignable to type '{ getScrollResponder(): ReactNode | (((props: ...) => ReactNode) & Readonly<...>); }'.         The types returned by 'getScrollResponder()' are incompatible between these types.           Type 'Sc

- **Issue #13208** (2026-08-07): **Back-swipe doesn't work on JS stack screens with transparent background (new arch)**
  *Symptoms*: ### Current behavior  The back-swipe in `@react-navigation/stack` doesn't work on screens that have no background.  https://github.com/user-attachments/assets/a58744e9-7ef5-4f5b-adcd-1050109563bf  Also here: https://snack.expo.dev/@valeriiia/stack-back-swipe-no-background?platform=ios  Regression from v6: the `Animated.View` inside the card's`PanGestureHandler` was `pointerEvents: 'auto'`. Now it's `'box-none'` ([`Card.tsx#L571`](https://github.com/react-navigation/react-navigation/blob/680d8891630ccf512a2b0c44758392ee50318bd0/packages/stack/src/views/Stack/Card.tsx#L571)) and on the new architecture the touch never reaches the pan handler.  ### Expected behavior  Back-swipe works on screens without a background as in v6  ### Reproduction  https://github.com/valeriiamykhalova/rn-stack-swipe-back-repro  ### Platform  - [x] Android - [x] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [ ] @react-navigation/bottom-tabs - [ ] @react-navigation/drawer - [ ] @react-navigation/material-top-tabs - [x] @react-navigation/stack - [ ] @react-navigation/native-stack - [ ] react-native-drawer-layout - [ ] react-native-tab-view  ### Environment  - [x] I've removed the packages that I don't use    | package                        | version |   | ------------------------------ | ------- |   | @react-navigation/native       | 7.3.15  |   | @react-navigation/stack        | 7.10.20 |   | react-native-screens           | 4.16.0  |   | react-native-safe-area-context | 5.6.0   |   | react-
  **Post-Mortem & Fix Analysis**:
  > The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/native` (found: `7.3.15`, latest: `7.3.16`) - `@react-navigation/stack` (found: `7.10.20`, latest: `7.10.21`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?
  > Hey @valeriiamykhalova! Thanks for opening the issue. It seems that the issue doesn't contain a link to a repro, or the provided repro is not valid (e.g. broken link, private repo, code doesn't run etc.).    **The best way to get attention to your issue is to provide an easy way for a developer to reproduce the issue.**    You can provide a repro using any of the following:    - Public GitHub repo under your username   - [TypeScript Playground](https://www.typescriptlang.org/play)    Try to keep the repro as small as possible by narrowing down the minimal amount of code needed to reproduce the issue. See ["How to create a Minimal, Reproducible Example"](https://stackoverflow.com/help/minimal-reproducible-example) for more information.    **Don't:**    - Link to your entire project or a project containing code unrelated to the issue.   - Link to a specific file in a GitHub repo, as it won't be detected.    You can edit your original issue to include a link to the repro, or leave it as a

- **Issue #13204** (2026-08-05): **Some automatic imports from @react-navigation/native stopped working starting with release 7.2.3**
  *Symptoms*: ### Current behavior  Starting with version 7.2.3, some imports from `@react-navigation/native` are no longer being automatically imported in VS Code using exported values. This also affects the latest release, 7.3.14 and may affect other packages other than just `native`.  I'm able to reproduce this reliably in the provided reproducer, an Expo app, but I don't believe it is related to Expo as I am able to reproduce it in a bare React Native app as well. The reproducer is a bare-bones app created using the following steps: 1. `npx create-expo-app@latest --template blank-typescript@sdk-57` 2. `npm i @react-navigation/native@7.2.3`  Installing version 7.2.2, the problem goes away. Here's a short video which demonstrates the problem: https://github.com/user-attachments/assets/c0f03dca-18b1-405e-a095-eb72ec3ccd67  A few notes: - The exported values function as expected once the import is manually added - If something else from the package is already imported in the file, the automatic import works as expected - the problem only occurs when nothing from the package is imported - Not all imports are affected. For example, `useNavigation` does not import automatically, but `useLinkTo` does  ### Expected behavior  Imports should automatically be added when used, and all imports should behave consistently  ### Reproduction  https://github.com/BrandonWade/react-navigation-reproducer  ### Platform  - [ ] Android - [ ] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [ ] @react-n
  **Post-Mortem & Fix Analysis**:
  > It seems that VSCode breaks with [this module augmentation](https://github.com/react-navigation/react-navigation/blob/cb17c7a0a08e98140445491f0bf900691a3b6c2c/packages/native/src/types.tsx#L9-L11).  Not sure how to fix yet, tho it seems like bug in VSCode.
  > please try `@react-navigation/native@7.3.15`
  > Hey! This issue is closed and isn't watched by the core team. You are welcome to discuss the issue with others in this thread, but if you think this issue is still valid and needs to be tracked, please open a new issue with a repro.

- **Issue #13186** (2026-07-16): **Drawer gets stuck open on Android after closeDrawer + navigate, AppState background, or external intents (RN 0.86 / drawer v7)**
  *Symptoms*: ### Current behavior  After upgrading to React Native 0.86 and React Navigation 7, the drawer can get **stuck open** on Android. The drawer UI remains visible, but `closeDrawer()` / `DrawerActions.closeDrawer()` no longer closes it reliably. This happens especially when: 1. **Close drawer then navigate immediately** (e.g. profile tap → push stack screen, or sign-in flow) 2. **App goes to background** while the drawer is open or closing (Google Sign-In, Contact Us `mailto:` intent, etc.) and returns to foreground 3. **Nested navigation**: drawer is nested inside a parent stack (`DrawerMenu` screen inside `MainStack`, with a nested stack inside the drawer) Typical sequence: - Open drawer - Tap an item that calls `navigation.closeDrawer()` then navigates (or opens an external activity) - Drawer may appear to close, then reopen, or stay stuck open - Close button / back button no longer dismiss the drawer On iOS this is less frequent; **Android is consistently affected**.  ### Expected behavior  - Drawer closes once - Navigation / external intent proceeds - Drawer stays closed after returning from background or SSO - Close button and `closeDrawer()` keep working  ### Reproduction  https://github.com/iam-ank-it/DrawerStuck.git  ### Platform  - [x] Android - [ ] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [ ] @react-navigation/bottom-tabs - [x] @react-navigation/drawer - [ ] @react-navigation/material-top-tabs - [ ] @react-navigation/stack - [ ] @react-navigation/native
  **Post-Mortem & Fix Analysis**:
  > The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/native` (found: `7.3.4`, latest: `7.3.8`) - `@react-navigation/drawer` (found: `7.12.3`, latest: `7.12.8`) - `@react-navigation/stack` (found: `7.10.6`, latest: `7.10.11`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?
  > thanks for the repro @iam-ank-it   can you try this patch and confirm if it fixes the issue? https://github.com/react-navigation/react-navigation/commit/6478873961cc2e3ae010331a25419f30ad732207
  > Hey! This issue is closed and isn't watched by the core team. You are welcome to discuss the issue with others in this thread, but if you think this issue is still valid and needs to be tracked, please open a new issue with a repro.

- **Issue #13178** (2026-08-03): **The stack navigator breaks certain interactions on New Arch iOS if animations are disabled**
  *Symptoms*: ### Current behavior  If you have a stack navigator with a screen with `animation: 'none'`, navigating to that screen can scramble touch target handlers in a way that breaks the application. This did not happen on the legacy architecture.  https://github.com/user-attachments/assets/3dc309fc-1a69-4303-8437-885ef15fa2eb  ### Expected behavior  Switching between screens should not affect buttons.  ### Reproduction  https://github.com/simon-abbott/react-navigation-bug-13178  ### Platform  - [ ] Android - [x] iOS - [ ] Web - [ ] Windows - [ ] MacOS  ### Packages  - [ ] @react-navigation/bottom-tabs - [ ] @react-navigation/drawer - [ ] @react-navigation/material-top-tabs - [x] @react-navigation/stack - [ ] @react-navigation/native-stack - [ ] react-native-drawer-layout - [ ] react-native-tab-view  ### Environment  - [x] I've removed the packages that I don't use  | package                        | version      | | ------------------------------ | ------------ | | @react-navigation/native        | 7.3.14     | | @react-navigation/stack        | 7.10.17      | | react-native-safe-area-context | 5.8.0        | | react-native-gesture-handler   | 3.1.0        | | react-native                   | 0.86.0       | | node                           | 24.16.0      | | npm or pnpm                    | yarn 1.22.19 | 
  **Post-Mortem & Fix Analysis**:
  > Couldn't find version numbers for the following packages in the issue: - `@react-navigation/native`  Can you update the issue to include version numbers for those packages? The version numbers must match the format 1.2.3.
  > ~~I am not using `@react-navigation/native`, so I removed that entry from the version table.~~  EDIT: wait no I am, my bad, I got it mixed up with `@react-navigation/native-stack`. Fixed.
  > The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/native` (found: `7.3.7`, latest: `7.3.14`) - `@react-navigation/stack` (found: `7.10.10`, latest: `7.10.17`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?

- **Issue #13174** (2026-07-03): **Error/Regression - useInsertionEffect must not schedule updates at every screen navigation after upgrading to @react-navigation/core@7.21.4**
  *Symptoms*: ### Current behavior  Apologies for not providing a minimal reproduction repository. I am short on time, but I was able to compare installed package versions and library source before and after the issue.  After upgrading React Navigation packages, the app logs this error when navigating from the Home screen to other screens:  ```text ERROR  useInsertionEffect must not schedule updates. ERROR  useInsertionEffect must not schedule updates. ```  ## App Structure  The app uses nested navigation:  ```text NavigationContainer └─ Root routing    └─ Drawer Navigator       ├─ Home screen       ├─ Other drawer screens       └─ Screens/routes that use native-stack navigation ```  The error appears during navigation from Home to other screens in this nested navigator setup.  ## Environment  ```text react@19.2.3 react-native@0.86.0 ```  ## Versions Where The Error Happens  ```text @react-navigation/native@7.3.6 @react-navigation/drawer@7.12.5 @react-navigation/native-stack@7.17.8 @react-navigation/core@7.21.4 @react-navigation/elements@2.9.28 ```  ## Versions Where The Error Does Not Happen  The error no longer happens after forcing:  ```json "overrides": {   "@react-navigation/core": "7.21.2",   "@react-navigation/elements": "2.9.26" } ```  Verified installed tree:  ```text @react-navigation/core@7.21.2 @react-navigation/elements@2.9.26 ```  ## Confirmed Code Difference  In the working install, `@react-navigation/core@7.21.2` has this in `useScheduleUpdate.tsx`:  ```ts scheduleUpdate(ca
  **Post-Mortem & Fix Analysis**:
  > Couldn't find version numbers for the following packages in the issue: - `@react-navigation/bottom-tabs` - `@react-navigation/material-top-tabs` - `@react-navigation/stack` - `react-native-drawer-layout` - `react-native-tab-view`  Can you update the issue to include version numbers for those packages? The version numbers must match the format 1.2.3.  The versions mentioned in the issue for the following packages differ from the latest versions on npm: - `@react-navigation/core` (found: `7.21.2`, latest: `7.21.4`)  Can you verify that the issue still exists after upgrading to the latest versions of these packages?
  > Hey @spasmodiumspam-web! Thanks for opening the issue. It seems that the issue doesn't contain a link to a repro, or the provided repro is not valid (e.g. broken link, private repo, code doesn't run etc.).    **The best way to get attention to your issue is to provide an easy way for a developer to reproduce the issue.**    You can provide a repro using any of the following:    - Public GitHub repo under your username   - [TypeScript Playground](https://www.typescriptlang.org/play)    Try to keep the repro as small as possible by narrowing down the minimal amount of code needed to reproduce the issue. See ["How to create a Minimal, Reproducible Example"](https://stackoverflow.com/help/minimal-reproducible-example) for more information.    **Don't:**    - Link to your entire project or a project containing code unrelated to the issue.   - Link to a specific file in a GitHub repo, as it won't be detected.    You can edit your original issue to include a link to the repro, or leave it as 
  > fixed in `@react-navigation/core@7.21.5`/`@react-navigation/native@7.3.7`

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

### Incident Patch 1: `a9f81b8c` (2026-09-29)
**Commit Message**: fix: support `| undefined` to better work with `exactOptionalPropertyTypes`

**File**: `packages/bottom-tabs/src/types.tsx` (modified, +105/-81)
```diff
@@ -110,18 +110,22 @@ export type BottomTabOptionsArgs<
 
 export type TimingKeyboardAnimationConfig = {
   animation: 'timing';
-  config?: Omit<
-    Partial<Animated.TimingAnimationConfig>,
-    'toValue' | 'useNativeDriver'
-  >;
+  config?:
+    | Omit<
+        Partial<Animated.TimingAnimationConfig>,
+        'toValue' | 'useNativeDriver'
+      >
+    | undefined;
 };
 
 export type SpringKeyboardAnimationConfig = {
   animation: 'spring';
-  config?: Omit<
-    Partial<Animated.SpringAnimationConfig>,
-    'toValue' | 'useNativeDriver'
-  >;
+  config?:
+    | Omit<
+        Partial<Animated.SpringAnimationConfig>,
+        'toValue' | 'useNativeDriver'
+      >
+    | undefined;
 };
 
 export type TabBarVisibilityAnimationConfig =
@@ -141,21 +145,21 @@ type BottomTabCustomOptions = {
    *
    * Only supported with `custom` implementation.
    */
-  animation?: TabAnimationName;
+  animation?: TabAnimationName | undefined;
 
   /**
    * Function which specifies interpolated styles for bottom-tab scenes.
    *
    * Only supported with `custom` implementation.
    */
-  sceneStyleInterpolator?: BottomTabSceneStyleInterpolator;
+  sceneStyleInterpolator?: BottomTabSceneStyleInterpolator | undefined;
 
   /**
    * Object which specifies the animation type (timing or spring) and their options (such as duration for timing).
    *
    * Only supported with `custom` implementation.
    */
-  transitionSpec?: TransitionSpec;
+  transitionSpec?: TransitionSpec | undefined;
 
   /**
    * Whether the label is shown below the icon or beside the icon.
@@ -176,7 +180,7 @@ type BottomTabCustomOptions = {
    *
    * Only supported with `custom` implementation.
    */
-  tabBarAllowFontScaling?: boolean;
+  tabBarAllowFontScaling?: boolean | undefined;
 
   /**
    * Style object for the tab item container.
@@ -199,24 +203,26 @@ type BottomTabCustomOptions = {
    *
    * Only supported with `custom` implementation.
    */
-  tabBarHideOnKeyboard?: boolean;
+  tabBarHideOnKeyboard?: boolean | undefined;
 
   /**
    * Animation config for showing and hiding the tab bar when the keyboard is shown/hidden.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarVisibilityAnimationConfig?: {
-    show?: TabBarVisibilityAnimationConfig;
-    hide?: TabBarVisibilityAnimationConfig;
-  };
+  tabBarVisibilityAnimationConfig?:
+    | {
+        show?: TabBarVisibilityAnimationConfig | undefined;
+        hide?: TabBarVisibilityAnimationConfig | undefined;
+      }
+    | undefined;
 
   /**
    * Variant of the tab bar. Defaults to `uikit`.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarVariant?: Variant;
+  tabBarVariant?: Variant | undefined;
 
   /**
    * Style object for the tab bar container.
@@ -234,36 +240,38 @@ type BottomTabCustomOptions = {
    *
    * Only supported with `custom` implementation.
    */
-  tabBarBackground?: () => React.ReactNode;
+  tabBarBackground?: (() => React.ReactNode) | undefined;
 
   /**
    * Position of the tab bar on the screen. Defaults to `bottom`.
    *
    * Only supported with `custom` implementation or if custom tab bar is provided.
    */
-  tabBarPosition?: 'bottom' | 'left' | 'right' | 'top';
+  tabBarPosition?: 'bottom' | 'left' | 'right' | 'top' | undefined;
 
   /**
    * Background color for the active tab.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarActiveBackgroundColor?: ColorValue;
+  tabBarActiveBackgroundColor?: ColorValue | undefined;
 
   /**
    * Background color for the inactive tabs.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarInactiveBackgroundColor?: ColorValue;
+  tabBarInactiveBackgroundColor?: ColorValue | undefined;
 
   /**
    * Function which returns a React element to render as the tab bar button.
    * Renders `PlatformPressable` by default.
    *
    * Only supported with `custom` implementation.
    */
-  tabBarButton?: (props: BottomTabBarButtonProps) => React.
```

**File**: `packages/core/src/BaseNavigationContainer.tsx` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ import { useSyncState } from './useSyncState';
 type State = NavigationState | PartialState<NavigationState> | undefined;
 
 type Props<ParamList extends {}> = NavigationContainerProps & {
-  ref?: React.Ref<NavigationContainerRef<ParamList>>;
+  ref?: React.Ref<NavigationContainerRef<ParamList>> | undefined;
 };
 
 /**
```

**File**: `packages/core/src/types.tsx` (modified, +1/-1)
```diff
@@ -259,7 +259,7 @@ export type EventEmitter<in out EventMap extends EventMapBase> = {
   emit<EventName extends KeyOf<EventMap>>(
     options: {
       type: EventName;
-      target?: string;
+      target?: string | undefined;
     } & (EventMap[EventName]['canPreventDefault'] extends true
       ? { canPreventDefault: true }
       : {}) &
```

**File**: `packages/core/src/useEventEmitter.tsx` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ export function useEventEmitter<T extends Record<string, any>>(
     }: {
       type: string;
       data?: any;
-      target?: string;
+      target?: string | undefined;
       canPreventDefault?: boolean;
     }) => {
       const items = listeners.current[type];
```

**File**: `packages/drawer/src/types.tsx` (modified, +30/-24)
```diff
@@ -29,31 +29,33 @@ export type DrawerNavigationConfig = {
    * Function that returns React element to render as the content of the drawer, for example, navigation items.
    * Defaults to `DrawerContent`.
    */
-  drawerContent?: (props: DrawerContentComponentProps) => React.ReactNode;
+  drawerContent?:
+    | ((props: DrawerContentComponentProps) => React.ReactNode)
+    | undefined;
 };
 
 export type DrawerNavigationOptions = HeaderOptions & {
   /**
    * Title text for the screen.
    */
-  title?: string;
+  title?: string | undefined;
 
   /**
    * Whether this screens should render the first time it's accessed. Defaults to `true`.
    * Set it to `false` if you want to render the screen on initial render.
    */
-  lazy?: boolean;
+  lazy?: boolean | undefined;
 
   /**
    * Function that returns a React Element to display as a header.
    */
-  header?: (props: DrawerHeaderProps) => React.ReactNode;
+  header?: ((props: DrawerHeaderProps) => React.ReactNode) | undefined;
 
   /**
    * Whether to show the header. Setting this to `false` hides the header.
    * Defaults to `true`.
    */
-  headerShown?: boolean;
+  headerShown?: boolean | undefined;
 
   /**
    * Title string of a screen displayed in the drawer
@@ -62,7 +64,8 @@ export type DrawerNavigationOptions = HeaderOptions & {
    */
   drawerLabel?:
     | string
-    | ((props: { color: ColorValue; focused: boolean }) => React.ReactNode);
+    | ((props: { color: ColorValue; focused: boolean }) => React.ReactNode)
+    | undefined;
 
   /**
    * Icon to display for the drawer item.
@@ -73,32 +76,33 @@ export type DrawerNavigationOptions = HeaderOptions & {
         color: ColorValue;
         size: number;
         focused: boolean;
-      }) => Icon | React.ReactNode);
+      }) => Icon | React.ReactNode)
+    | undefined;
 
   /**
    * Color for the icon and label in the active item in the drawer.
    */
-  drawerActiveTintColor?: ColorValue;
+  drawerActiveTintColor?: ColorValue | undefined;
 
   /**
    * Background color for the active item in the drawer.
    */
-  drawerActiveBackgroundColor?: ColorValue;
+  drawerActiveBackgroundColor?: ColorValue | undefined;
 
   /**
    * Color for the icon and label in the inactive items in the drawer.
    */
-  drawerInactiveTintColor?: ColorValue;
+  drawerInactiveTintColor?: ColorValue | undefined;
 
   /**
    * Background color for the inactive items in the drawer.
    */
-  drawerInactiveBackgroundColor?: ColorValue;
+  drawerInactiveBackgroundColor?: ColorValue | undefined;
 
   /**
    * Whether label font should scale to respect Text Size accessibility settings.
    */
-  drawerAllowFontScaling?: boolean;
+  drawerAllowFontScaling?: boolean | undefined;
 
   /**
    * Style object for the single item, which can contain an icon and/or a label.
@@ -108,7 +112,7 @@ export type DrawerNavigationOptions = HeaderOptions & {
   /**
    * ID to locate this drawer item in tests.
    */
-  drawerItemTestID?: string;
+  drawerItemTestID?: string | undefined;
 
   /**
    * Style object to apply to the `Text` inside content section which renders a label.
@@ -134,7 +138,7 @@ export type DrawerNavigationOptions = HeaderOptions & {
   /**
    * Position of the drawer on the screen. Defaults to `left`.
    */
-  drawerPosition?: 'left' | 'right';
+  drawerPosition?: 'left' | 'right' | undefined;
 
   /**
    * Type of the drawer. It determines how the drawer looks and animates.
@@ -150,12 +154,12 @@ export type DrawerNavigationOptions = HeaderOptions & {
   /**
    * Whether the statusbar should be hidden when the drawer is pulled or opens,
    */
-  drawerHideStatusBarOnOpen?: boolean;
+  drawerHideStatusBarOnOpen?: boolean | undefined;
 
   /**
    * Animation of the statusbar when hiding it. use in combination with `drawerHideStatusBarOnOpen`.
    */
-  drawerStatusBarAnimation?: 'slide' | 'none' | 'fade';
+  drawerStatusBarAnimation?: 'slide' | 'none' | 'fade' | undefined;
 
   /**
    * Color of the overlay t
```

---

### Incident Patch 2: `1f8cd35e` (2026-09-29)
**Commit Message**: fix: use isRepeated from the native event to check repeated press

**File**: `packages/bottom-tabs/src/views/BottomTabViewNativeImpl.tsx` (modified, +4/-7)
```diff
@@ -209,7 +209,8 @@ export function BottomTabViewNative({
   // JS sends a requested tab with the native provenance it was based on.
   // Native replies with the selected tab and its new provenance.
   const onTabSelected = (event: NativeSyntheticEvent<TabSelectedEvent>) => {
-    const { selectedScreenKey, provenance, actionOrigin } = event.nativeEvent;
+    const { selectedScreenKey, provenance, actionOrigin, isRepeated } =
+      event.nativeEvent;
 
     const confirmed = {
       routeKey: selectedScreenKey,
@@ -230,8 +231,6 @@ export function BottomTabViewNative({
       const { tabBarRepeatedPressBehavior } =
         descriptors[route.key]?.options ?? {};
 
-      const isRepeatedPress = focusedRouteKey === route.key;
-
       const event = navigation.emit({
         type: 'tabPress',
         target: route.key,
@@ -240,11 +239,9 @@ export function BottomTabViewNative({
           origin: 'native',
           behavior: {
             scrollToTop:
-              isRepeatedPress &&
-              tabBarRepeatedPressBehavior?.scrollToTop !== false,
+              isRepeated && tabBarRepeatedPressBehavior?.scrollToTop !== false,
             popToTop:
-              isRepeatedPress &&
-              tabBarRepeatedPressBehavior?.popToTop !== false,
+              isRepeated && tabBarRepeatedPressBehavior?.popToTop !== false,
           },
         },
       });
```

---

### Incident Patch 3: `57d79ba8` (2026-09-28)
**Commit Message**: chore: fix loader test failure on small devices

**File**: `example/e2e/maestro/loaders.yml` (modified, +8/-2)
```diff
@@ -82,7 +82,10 @@ name: Loaders
     file: ../launch.yml
     env:
       LINK: loaders
-      TEXT: 'Make next load fail'
+      TEXT: 'Tyrannosaurus rex'
+- scrollUntilVisible:
+    element:
+      text: 'Make next load fail'
 - tapOn:
     text: 'Make next load fail'
 - tapOn:
@@ -109,7 +112,10 @@ name: Loaders
     file: ../launch.yml
     env:
       LINK: loaders
-      TEXT: 'Make next load fail'
+      TEXT: 'Tyrannosaurus rex'
+- scrollUntilVisible:
+    element:
+      text: 'Make next load fail'
 - tapOn:
     text: 'Make next load fail'
 - tapOn:
```

**File**: `example/e2e/tests/maestro.test.ts` (modified, +12/-0)
```diff
@@ -240,6 +240,18 @@ async function runStep(page: Page, step: any) {
       break;
     }
 
+    case 'scrollUntilVisible': {
+      const locator = query(page, step.scrollUntilVisible.element)
+        .filter({ visible: true })
+        .last();
+
+      await locator.scrollIntoViewIfNeeded({
+        timeout: step.scrollUntilVisible.timeout,
+      });
+
+      break;
+    }
+
     case 'swipe': {
       const duration = step.swipe.duration || 300;
 
```

**File**: `example/src/Screens/Loaders.tsx` (modified, +7/-0)
```diff
@@ -21,6 +21,7 @@ import {
   StyleSheet,
   View,
 } from 'react-native';
+import { SafeAreaView } from 'react-native-screens/experimental';
 
 import iconBookOpen from '../../assets/icons/book-open.png';
 import iconPawPrint from '../../assets/icons/paw-print.png';
@@ -318,6 +319,12 @@ const LoaderTabs = createBottomTabNavigator({
   screens: {
     DinoList: {
       screen: DinoCatalogScreen,
+      layout: ({ children }) =>
+        Platform.OS === 'android' ? (
+          <SafeAreaView edges={{ bottom: true }}>{children}</SafeAreaView>
+        ) : (
+          children
+        ),
       options: {
         title: 'Catalog',
         tabBarIcon: Platform.select<Icon>({
```

---

### Incident Patch 4: `859fb191` (2026-09-28)
**Commit Message**: chore: fix loader test failure on Android and iOS

**File**: `example/src/Screens/Loaders.tsx` (modified, +1/-0)
```diff
@@ -311,6 +311,7 @@ function Provider({ children }: { children: React.ReactNode }) {
 }
 
 const LoaderTabs = createBottomTabNavigator({
+  layout: ({ children }) => <Layout>{children}</Layout>,
   screenOptions: {
     lazy: true,
   },
```

---

### Incident Patch 5: `f3da8cda` (2026-09-28)
**Commit Message**: fix: handle source for navigate and jumpTo in tab and drawer

- navigating from an invalid `source` is no longer handled
- for `history` and `fullHistory`, history entries after `source` are
  now removed
- if `source` is a valid route, but not in history, it's handled as
  normal

**File**: `packages/routers/src/SwitchRouter.tsx` (modified, +33/-0)
```diff
@@ -420,6 +420,39 @@ export function SwitchRouter<Type extends SwitchRouterType>({
             return null;
           }
 
+          if (action.source !== undefined) {
+            const sourceIndex = state.routes.findIndex(
+              (route) => route.key === action.source
+            );
+
+            if (sourceIndex === -1) {
+              return null;
+            }
+
+            if (backBehavior === 'history' || backBehavior === 'fullHistory') {
+              const sourceHistoryIndex = state.history.findLastIndex(
+                (item) => item.type === 'route' && item.key === action.source
+              );
+
+              if (sourceHistoryIndex !== -1) {
+                const history = state.history.filter(
+                  (item, index) =>
+                    item.type !== 'route' || index <= sourceHistoryIndex
+                );
+
+                state = {
+                  ...state,
+                  ...changeIndex<Type>(
+                    { routes: state.routes, history },
+                    sourceIndex,
+                    backBehavior,
+                    initialRouteName
+                  ),
+                };
+              }
+            }
+          }
+
           const route = state.routes[index];
 
           if (route == null) {
```

**File**: `packages/routers/src/__tests__/DrawerRouter.test.tsx` (modified, +188/-0)
```diff
@@ -1211,6 +1211,194 @@ test('go back closes drawer if it is open', () => {
   });
 });
 
+test('closes drawer on navigate from an unfocused source with backBehavior: history', () => {
+  const router = DrawerRouter({ backBehavior: 'history' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: DrawerNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'drawer',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+      { type: 'drawer', status: 'open' },
+    ],
+    preloadedRouteKeys: [],
+    default: 'closed',
+  };
+
+  expect(
+    router.getStateForAction(
+      state,
+      { ...CommonActions.navigate('qux'), source: 'bar' },
+      options
+    )
+  ).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+});
+
+test('closes drawer on jump to action from an unfocused source with backBehavior: history', () => {
+  const router = DrawerRouter({ backBehavior: 'history' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: DrawerNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'drawer',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+      { type: 'drawer', status: 'open' },
+    ],
+    preloadedRouteKeys: [],
+    default: 'closed',
+  };
+
+  expect(
+    router.getStateForAction(
+      state,
+      { ...DrawerActions.jumpTo('qux'), source: 'bar' },
+      options
+    )
+  ).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+});
+
+test('closes drawer on navigate from an unfocused source with backBehavior: fullHistory', () => {
+  const router = DrawerRouter({ backBehavior: 'fullHistory' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: DrawerNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'drawer',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+      { type: 'drawer', status: 'open' },
+    ],
+    preloadedRouteKeys: [],
+    default: 'closed',
+  };
+
+  expect(
+    router.getStateForAction(
+      state,
+      { ...CommonActions.navigate('qux'), source: 'bar' },
+      options
+    )
+  ).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+});
+
+test('closes drawer on jump to action from an unfocused source with backBehavior: fullHistory', () => {
+  const router = DrawerRouter({ backBehavior: 'fullHistory' });
+  const options: RouterConfigOptions = {
+    routeName
```

**File**: `packages/routers/src/__tests__/TabRouter.test.tsx` (modified, +1384/-0)
```diff
@@ -3663,6 +3663,1390 @@ test('goBack falls back to tab history when route history is empty', () => {
   });
 });
 
+test('goes back to the source after navigate from an unfocused route with backBehavior: history', () => {
+  const router = TabRouter({ backBehavior: 'history' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: TabNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'tab',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+    ],
+    preloadedRouteKeys: [],
+  };
+
+  const result = router.getStateForAction(
+    state,
+    { ...CommonActions.navigate('qux'), source: 'bar' },
+    options
+  );
+
+  expect(result).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+
+  if (result == null || result.stale !== false) {
+    throw new Error('Expected navigate to return a complete state.');
+  }
+
+  expect(
+    router.getStateForAction(result, CommonActions.goBack(), options)
+  ).toEqual({
+    ...state,
+    index: 1,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+    ],
+  });
+});
+
+test('goes back to the source after jump to action from an unfocused route with backBehavior: history', () => {
+  const router = TabRouter({ backBehavior: 'history' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: TabNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'tab',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+    ],
+    preloadedRouteKeys: [],
+  };
+
+  const result = router.getStateForAction(
+    state,
+    { ...TabActions.jumpTo('qux'), source: 'bar' },
+    options
+  );
+
+  expect(result).toEqual({
+    ...state,
+    index: 3,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'qux' },
+    ],
+  });
+
+  if (result == null || result.stale !== false) {
+    throw new Error('Expected jumpTo to return a complete state.');
+  }
+
+  expect(
+    router.getStateForAction(result, CommonActions.goBack(), options)
+  ).toEqual({
+    ...state,
+    index: 1,
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+    ],
+  });
+});
+
+test('goes back to the source after navigate from an unfocused route with backBehavior: fullHistory', () => {
+  const router = TabRouter({ backBehavior: 'fullHistory' });
+  const options: RouterConfigOptions = {
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routeParamList: {},
+    routeGetIdList: {},
+  };
+
+  const state: TabNavigationState<ParamListBase> = {
+    stale: false,
+    type: 'tab',
+    key: 'root',
+    index: 2,
+    routeNames: ['foo', 'bar', 'baz', 'qux'],
+    routes: [
+      { key: 'foo', name: 'foo' },
+      { key: 'bar', name: 'bar' },
+      { key: 'baz', name: 'baz' },
+      { key: 'qux', name: 'qux' },
+    ],
+    history: [
+      { type: 'route', key: 'foo' },
+      { type: 'route', key: 'bar' },
+      { type: 'route', key: 'baz' },
+    ],
+    preloadedRoute
```

---

### Incident Patch 6: `6870eda7` (2026-09-21)
**Commit Message**: fix: handle browser back from committed navigation state

**File**: `packages/native/src/__tests__/useLinking.web.test.tsx` (modified, +1094/-1)
```diff
@@ -10,13 +10,17 @@ import {
   type NavigationState,
   type NavigatorScreenParams,
   type ParamListBase,
+  type RouteProp,
   StackActions,
   StackRouter,
   TabRouter,
+  useIsFocused,
+  useNavigation,
   useNavigationBuilder,
   usePreventRemove,
 } from '@react-navigation/core';
-import { act, render, waitFor } from '@testing-library/react';
+import { act, render, screen, waitFor } from '@testing-library/react';
+import userEvent from '@testing-library/user-event';
 import * as React from 'react';
 import { Text } from 'react-native';
 
@@ -2140,6 +2144,1095 @@ test("doesn't update URL until navigation to a suspending screen commits", async
   await waitFor(() => expect(window.location.pathname).toBe('/profile'));
 });
 
+test('preserves updated params on browser back when navigation suspends', async () => {
+  const Stack = createStackNavigator();
+
+  const linking = {
+    config: {
+      screens: { Home: '', Profile: 'profile', Settings: 'settings' },
+    },
+  };
+
+  const { promise, resolve } = Promise.withResolvers<void>();
+
+  const SettingsScreen = () => {
+    React.use(promise);
+
+    return <Text>Settings</Text>;
+  };
+
+  const navigation = createNavigationContainerRef<ParamListBase>();
+
+  render(
+    <NavigationContainer ref={navigation} linking={linking}>
+      <React.Suspense fallback={<Text>Loading</Text>}>
+        <Stack.Navigator>
+          <Stack.Screen name="Home" component={TestScreen} />
+          <Stack.Screen name="Profile" component={TestScreen} />
+          <Stack.Screen name="Settings" component={SettingsScreen} />
+        </Stack.Navigator>
+      </React.Suspense>
+    </NavigationContainer>
+  );
+
+  const homeKey = navigation.getCurrentRoute()?.key;
+
+  await act(async () => navigation.navigate('Profile'));
+
+  await waitFor(() => expect(window.location.pathname).toBe('/profile'));
+
+  await act(async () =>
+    navigation.dispatch({
+      ...CommonActions.setParams({ updated: true }),
+      source: homeKey,
+    })
+  );
+
+  await act(async () => navigation.navigate('Settings'));
+
+  expect(window.location.pathname).toBe('/profile');
+
+  act(() => window.history.back());
+
+  await waitFor(() => expect(navigation.getCurrentRoute()?.name).toBe('Home'));
+
+  expect(navigation.getRootState()?.routes).toEqual([
+    expect.objectContaining({
+      key: homeKey,
+      name: 'Home',
+      params: { updated: true },
+    }),
+  ]);
+  expect(window.location.pathname).toBe('/');
+
+  await act(async () => {
+    resolve();
+
+    await promise;
+  });
+
+  expect(navigation.getCurrentRoute()?.name).toBe('Home');
+
+  act(() => window.history.forward());
+
+  await waitFor(() =>
+    expect(navigation.getCurrentRoute()?.name).toBe('Profile')
+  );
+
+  expect(window.location.pathname).toBe('/profile');
+});
+
+test('replaces an interrupted destination when navigating again from the visible screen', async () => {
+  const Stack = createStackNavigator();
+
+  const linking = {
+    config: {
+      screens: { Home: '', Profile: 'profile', Settings: 'settings' },
+    },
+  };
+
+  const { promise, resolve } = Promise.withResolvers<void>();
+
+  const HomeScreen = () => {
+    const navigation = useNavigation();
+
+    return (
+      <button
+        type="button"
+        onClick={() => navigation.dispatch(CommonActions.navigate('Settings'))}
+      >
+        Open settings
+      </button>
+    );
+  };
+
+  const ProfileScreen = () => {
+    React.use(promise);
+
+    return <Text>Profile</Text>;
+  };
+
+  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
+
+  const navigation = createNavigationContainerRef<ParamListBase>();
+
+  render(
+    <NavigationContainer ref={navigation} linking={linking}>
+      <React.Suspense fallback={<Text>Loading</Text>}>
+        <Stack.Navigator>
+          <Stack.Screen name="Home" component={HomeScreen} />
+          <Stack.Screen name="Profile" component={ProfileScreen} />
+          <Stack.Screen name="
```

**File**: `packages/native/src/useLinking.tsx` (modified, +118/-60)
```diff
@@ -136,6 +136,38 @@ const findMatchingState = <T extends NavigationState>(
   return findMatchingState(aChildState, bChildState);
 };
 
+/**
+ * Calculate the history delta between 2 navigation states.
+ * If no common navigation state is found, only replace the history entry.
+ */
+const getHistoryDelta = (
+  previous: NavigationState | undefined,
+  next: NavigationState | undefined
+): PopStateDelta => {
+  const [previousFocused, nextFocused] = findMatchingState(previous, next);
+
+  return previousFocused && nextFocused
+    ? getTotalHistoryLength(nextFocused) -
+        getTotalHistoryLength(previousFocused)
+    : 'replace';
+};
+
+/**
+ * Check if navigator history matches between committed and latest state.
+ */
+const hasMatchingBackHistory = (
+  current: NavigationState,
+  latest: NavigationState
+): boolean => {
+  if (current.history !== undefined || latest.history !== undefined) {
+    return isEqual(current.history, latest.history);
+  }
+
+  return current.routes
+    .slice(0, Math.min(current.index, latest.index) + 1)
+    .every((route, i) => route.key === latest.routes[i]?.key);
+};
+
 /**
  * Check if the state change is popping the last route or history entry.
  */
@@ -314,9 +346,9 @@ export function useLinking<ParamList extends ParamListBase>(
 
   const previousIndexRef = React.useRef<number | undefined>(undefined);
   const previousStateRef = React.useRef<NavigationState | undefined>(undefined);
-  const pendingPopStateDeltaRef = React.useRef<PopStateDelta | undefined>(
-    undefined
-  );
+  const pendingPopStateRef = React.useRef<
+    { state: NavigationState | undefined; delta: PopStateDelta } | undefined
+  >(undefined);
 
   React.useEffect(() => {
     if (!history) {
@@ -397,7 +429,10 @@ export function useLinking<ParamList extends ParamListBase>(
         if (actionChangedState) {
           // The change may be committed later, e.g. with transitions
           // Remember the delta so it can be subtracted when syncing the commit
-          pendingPopStateDeltaRef.current = pendingDelta;
+          pendingPopStateRef.current = {
+            state: navigation.getRootState(),
+            delta: pendingDelta,
+          };
         } else if (removePrevented) {
           rollbackHistory();
         }
@@ -429,37 +464,73 @@ export function useLinking<ParamList extends ParamListBase>(
       const record = history.get(index);
 
       if (record?.path === path && record?.state) {
-        const currentState = navigation.getRootState();
+        const pending = pendingPopStateRef.current;
+
+        // Use the state synced to browser history or the result of a pending traversal,
+        // since the store may already contain another navigation that hasn't committed yet.
+        const currentState = pending?.state ?? previousStateRef.current;
 
         const [currentFocused, recordFocused] = findMatchingState(
           currentState,
           record.state
         );
 
+        const [latestFocused] = findMatchingState(
+          navigation.getRootState(),
+          record.state
+        );
+
+        const [pendingFocused] = findMatchingState(
+          previousStateRef.current,
+          pending?.state
+        );
+
+        const currentRoute = currentFocused?.routes[currentFocused.index];
+        const latestRoute =
+          latestFocused &&
+          getRoutesUntilIndex(latestFocused).find(
+            (route) => route.key === currentRoute?.key
+          );
+
         if (
           previousIndex - index === 1 &&
           currentFocused &&
           recordFocused &&
+          latestFocused &&
+          currentFocused.key === latestFocused.key &&
+          // Only combine pending browser history deltas within the same navigator,
+          // as history lengths from different navigators aren't comparable.
+          (!pending?.state || pendingFocused?.key === currentFocused.key) &&
+          // We don't want to dispatch `goBack` if route history has grown since,
+ 
```

---

### Incident Patch 7: `fa94afe7` (2026-09-21)
**Commit Message**: fix: use the remove action when dismissing stack screens

**File**: `packages/native-stack/src/__tests__/index.test.tsx` (modified, +241/-1)
```diff
@@ -7,8 +7,15 @@ import {
   test,
 } from '@jest/globals';
 import { useHeaderHeight } from '@react-navigation/elements';
-import { NavigationContainer } from '@react-navigation/native';
 import {
+  CommonActions,
+  createNavigationContainerRef,
+  NavigationContainer,
+  StackActions,
+} from '@react-navigation/native';
+import {
+  act,
+  fireEvent,
   isHiddenFromAccessibility,
   render,
   screen,
@@ -40,6 +47,239 @@ afterEach(() => {
   jest.restoreAllMocks();
 });
 
+test('keeps a newly pushed screen when an earlier screen finishes dismissing', async () => {
+  type ParamList = {
+    A: undefined;
+    B: undefined;
+    C: undefined;
+  };
+
+  const Stack = createNativeStackNavigator<ParamList>();
+
+  const navigation = createNavigationContainerRef<ParamList>();
+
+  const Test = ({ route }: NativeStackScreenProps<ParamList>) => (
+    <Text>Screen {route.name}</Text>
+  );
+
+  await render(
+    <NavigationContainer
+      ref={navigation}
+      initialState={{
+        index: 1,
+        routes: [{ name: 'A' }, { name: 'B' }],
+      }}
+    >
+      <Stack.Navigator>
+        <Stack.Screen name="A" component={Test} />
+        <Stack.Screen name="B" component={Test} />
+        <Stack.Screen name="C" component={Test} />
+      </Stack.Navigator>
+    </NavigationContainer>
+  );
+
+  await act(() => navigation.dispatch(StackActions.push('C')));
+
+  await fireEvent(
+    screen.getByText('Screen B', { includeHiddenElements: true }),
+    'dismissed',
+    { nativeEvent: { dismissCount: 1 } }
+  );
+
+  expect(navigation.getRootState()?.routes.map((route) => route.name)).toEqual([
+    'A',
+    'C',
+  ]);
+
+  expect(isHiddenFromAccessibility(screen.getByText('Screen C'))).toBe(false);
+});
+
+test('keeps a newly pushed screen when multiple screens finish dismissing', async () => {
+  type ParamList = {
+    A: undefined;
+    B: undefined;
+    C: { value: number };
+    D: undefined;
+  };
+
+  const Stack = createNativeStackNavigator<ParamList>();
+
+  const navigation = createNavigationContainerRef<ParamList>();
+
+  const Test = ({ route }: NativeStackScreenProps<ParamList>) => (
+    <Text>Screen {route.name}</Text>
+  );
+
+  await render(
+    <NavigationContainer
+      ref={navigation}
+      initialState={{
+        index: 2,
+        routes: [
+          { name: 'A' },
+          { name: 'B' },
+          { name: 'C', params: { value: 1 } },
+        ],
+      }}
+    >
+      <Stack.Navigator>
+        <Stack.Screen name="A" component={Test} />
+        <Stack.Screen name="B" component={Test} />
+        <Stack.Screen name="C" component={Test} />
+        <Stack.Screen name="D" component={Test} />
+      </Stack.Navigator>
+    </NavigationContainer>
+  );
+
+  await act(() => navigation.dispatch(CommonActions.pushParams({ value: 2 })));
+
+  await act(() => navigation.dispatch(StackActions.push('D')));
+
+  await fireEvent(
+    screen.getByText('Screen C', { includeHiddenElements: true }),
+    'dismissed',
+    { nativeEvent: { dismissCount: 2 } }
+  );
+
+  expect(isHiddenFromAccessibility(screen.getByText('Screen D'))).toBe(false);
+  expect(
+    screen.queryByText('Screen B', { includeHiddenElements: true })
+  ).toBeNull();
+  expect(
+    screen.queryByText('Screen C', { includeHiddenElements: true })
+  ).toBeNull();
+
+  await act(() => navigation.goBack());
+
+  expect(isHiddenFromAccessibility(screen.getByText('Screen A'))).toBe(false);
+});
+
+test('preserves retained and preloaded screens when multiple screens are dismissed', async () => {
+  type ParamList = {
+    A: undefined;
+    B: undefined;
+    C: undefined;
+    D: undefined;
+    E: undefined;
+  };
+
+  const Stack = createNativeStackNavigator<ParamList>();
+
+  const navigation = createNavigationContainerRef<ParamList>();
+
+  const Test = ({ route }: NativeStackScreenProps<ParamList>) => (
+    <Text>Screen {route.name}</Text>
+  );
+
+  await render(
+    <NavigationContainer
+      ref={navigation}
+      initial
```

**File**: `packages/native-stack/src/views/NativeStackView.native.tsx` (modified, +12/-14)
```diff
@@ -570,19 +570,14 @@ export function NativeStackView({ state, navigation, descriptors }: Props) {
                 });
               }}
               onDismissed={(event) => {
-                const currentState = navigation.getState();
-                const currentActiveRoutes = currentState.routes.slice(
-                  0,
-                  currentState.index + 1
-                );
-
-                if (currentActiveRoutes.some((r) => r.key === route.key)) {
-                  navigation.dispatch({
-                    ...StackActions.pop(event.nativeEvent.dismissCount),
-                    source: route.key,
-                    target: currentState.key,
-                  });
-                }
+                navigation.dispatch({
+                  ...StackActions.remove(
+                    route.name,
+                    event.nativeEvent.dismissCount
+                  ),
+                  source: route.key,
+                  target: state.key,
+                });
 
                 setNextDismissedKey(route.key);
               }}
@@ -595,7 +590,10 @@ export function NativeStackView({ state, navigation, descriptors }: Props) {
               }}
               onNativeDismissCancelled={(event) => {
                 navigation.dispatch({
-                  ...StackActions.pop(event.nativeEvent.dismissCount),
+                  ...StackActions.remove(
+                    route.name,
+                    event.nativeEvent.dismissCount
+                  ),
                   source: route.key,
                   target: state.key,
                 });
```

**File**: `packages/stack/src/views/Stack/StackView.tsx` (modified, +5/-3)
```diff
@@ -440,16 +440,18 @@ export class StackView extends React.Component<Props, State> {
   };
 
   private handleCloseRoute = ({ route }: { route: Route<string> }) => {
-    const { state, navigation } = this.props;
+    const { navigation } = this.props;
+
+    const state = navigation.getState();
 
     const activeRoutes = state.routes.slice(0, state.index + 1);
 
     if (activeRoutes.some((r) => r.key === route.key)) {
-      // If a route exists in state, trigger a pop
+      // If a route exists in state, remove it
       // This will happen in when the route was closed from the card component
       // e.g. When the close animation triggered from a gesture ends
       navigation.dispatch({
-        ...StackActions.pop(),
+        ...StackActions.remove(route.name),
         source: route.key,
         target: state.key,
       });
```

---

### Incident Patch 8: `34a10510` (2026-09-21)
**Commit Message**: fix: preserve navigator state types in navigation helpers

**File**: `packages/bottom-tabs/src/types.tsx` (modified, +2/-1)
```diff
@@ -61,6 +61,7 @@ export type LabelPosition = 'beside-icon' | 'below-icon';
 
 export type BottomTabNavigationHelpers = NavigationHelpers<
   ParamListBase,
+  TabNavigationState<ParamListBase>,
   BottomTabNavigationEventMap
 > &
   TabActionHelpers<ParamListBase>;
@@ -685,7 +686,7 @@ export type BottomTabHeaderProps = {
 export type BottomTabBarProps = {
   state: TabNavigationState<ParamListBase>;
   descriptors: BottomTabDescriptorMap;
-  navigation: NavigationHelpers<ParamListBase, BottomTabNavigationEventMap>;
+  navigation: BottomTabNavigationHelpers;
 };
 
 export type BottomTabBarButtonProps = Omit<
```

**File**: `packages/core/src/types.tsx` (modified, +3/-2)
```diff
@@ -81,7 +81,7 @@ export type DefaultNavigatorOptions<
   layout?:
     | ((props: {
         state: State;
-        navigation: NavigationHelpers<ParamList>;
+        navigation: NavigationHelpers<ParamList, State>;
         descriptors: Record<
           string,
           Descriptor<
@@ -470,8 +470,9 @@ type NavigationHelpersRoute<
 
 export type NavigationHelpers<
   ParamList extends ParamListBase,
+  State extends NavigationState = NavigationState<ParamList>,
   EventMap extends EventMapBase = {},
-> = NavigationHelpersCommon<ParamList> &
+> = NavigationHelpersCommon<ParamList, State> &
   EventEmitter<EventMap> &
   NavigationHelpersRoute<ParamList, keyof ParamList> &
   PrivateValueStore<[ParamList, unknown, unknown, unknown]>;
```

**File**: `packages/core/src/useDescriptors.tsx` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ type Options<
     ScreenConfigWithParent<State, ScreenOptions, EventMap>
   >;
   state: State;
-  navigation: NavigationHelpers<ParamListBase>;
+  navigation: NavigationHelpers<ParamListBase, State>;
   screenOptions: ScreenOptionsOrCallback<ScreenOptions> | undefined;
   screenLayout: ScreenLayout<ScreenOptions> | undefined;
   onAction: (action: NavigationAction) => boolean;
```

**File**: `packages/core/src/useNavigationCache.tsx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ type Options<
 > = {
   routes: State['routes'];
   getState: () => State;
-  navigation: NavigationHelpers<ParamListBase> &
+  navigation: NavigationHelpers<ParamListBase, State> &
     Partial<NavigationProp<ParamListBase, string, any, any, any>>;
   setOptions: (
     cb: (
```

**File**: `packages/core/src/useNavigationHelpers.tsx` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ export function useNavigationHelpers<
         );
       },
       getState,
-    } as NavigationHelpers<ParamListBase, EventMap> & ActionHelpers;
+    } as NavigationHelpers<ParamListBase, State, EventMap> & ActionHelpers;
 
     return navigationHelpers;
   }, [
```

---

### Incident Patch 9: `341b9627` (2026-09-22)
**Commit Message**: fix: fix animating state get stuck in bottom tabs in some scenarios

**File**: `packages/bottom-tabs/src/views/BottomTabViewCustom.tsx` (modified, +1/-3)
```diff
@@ -206,9 +206,7 @@ export function BottomTabViewCustom({
           // Delay clearing `animating` state
           // This will give time for `popToTop` to get handled before pause
           timer = setTimeout(() => {
-            setLastUpdate((update) =>
-              update.animating ? { ...update, animating: false } : update
-            );
+            setLastUpdate({ current: focusedRouteKey, animating: false });
           }, 32);
         }
       });
```

---

### Incident Patch 10: `f7fbf6f0` (2026-09-19)
**Commit Message**: fix: improve memoization for material top tabs

**File**: `packages/material-top-tabs/package.json` (modified, +2/-1)
```diff
@@ -47,7 +47,8 @@
   },
   "dependencies": {
     "@react-navigation/elements": "workspace:^",
-    "react-native-tab-view": "workspace:^"
+    "react-native-tab-view": "workspace:^",
+    "use-latest-callback": "^0.3.5"
   },
   "devDependencies": {
     "@jest/globals": "^30.4.1",
```

**File**: `packages/material-top-tabs/src/views/MaterialTopTabBar.tsx` (modified, +109/-57)
```diff
@@ -3,14 +3,25 @@ import { Color } from '@react-navigation/elements/internal';
 import { useLinkBuilder, useLocale, useTheme } from '@react-navigation/native';
 import * as React from 'react';
 import { type ColorValue, StyleSheet } from 'react-native';
-import { type Route, TabBar, type TabDescriptor } from 'react-native-tab-view';
+import {
+  type Route,
+  TabBar,
+  type TabBarProps,
+  type TabDescriptor,
+} from 'react-native-tab-view';
+import useLatestCallback from 'use-latest-callback';
 
 import type { MaterialTopTabBarProps } from '../types';
 
 type MaterialLabelProps = Parameters<
   NonNullable<TabDescriptor<Route>['label']>
 >[0];
 
+type CachedOptions = {
+  deps: readonly unknown[];
+  options: TabDescriptor<Route>;
+};
+
 const MaterialLabel = ({
   color,
   labelText,
@@ -68,10 +79,10 @@ export function MaterialTopTabBar({
       .string() ??
     (dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)');
 
-  const tabBarOptions = Object.fromEntries(
-    state.routes.map((route) => {
-      const options = descriptors[route.key]?.options ?? {};
+  const optionsCache = React.useRef<Record<string, CachedOptions>>({});
 
+  const nextOptions = Object.fromEntries<CachedOptions>(
+    state.routes.map((route) => {
       const {
         title,
         tabBarLabel,
@@ -83,13 +94,41 @@ export function MaterialTopTabBar({
         tabBarIcon,
         tabBarAllowFontScaling,
         tabBarLabelStyle,
-      } = options;
+      } = descriptors[route.key]?.options ?? {};
+
+      const focused = focusedRoute.key === route.key;
+      const href = buildHref(route.name, route.params);
+
+      const previous = optionsCache.current[route.key];
+
+      const deps = [
+        href,
+        route.name,
+        title,
+        tabBarLabel,
+        tabBarButtonTestID,
+        tabBarAccessibilityLabel,
+        tabBarBadge,
+        tabBarShowIcon,
+        tabBarShowLabel,
+        tabBarIcon,
+        tabBarAllowFontScaling,
+        tabBarLabelStyle,
+        typeof tabBarLabel === 'function' && focused,
+      ];
+
+      if (
+        previous &&
+        Object.hasOwn(optionsCache.current, route.key) &&
+        previous.deps.length === deps.length &&
+        deps.every((dep, index) => Object.is(dep, previous.deps[index]))
+      ) {
+        return [route.key, previous];
+      }
 
       let icon;
 
-      if (tabBarShowIcon === false) {
-        icon = undefined;
-      } else if (tabBarIcon) {
+      if (tabBarShowIcon !== false && tabBarIcon) {
         icon = ({
           focused,
           color,
@@ -120,37 +159,63 @@ export function MaterialTopTabBar({
         };
       }
 
-      return [
-        route.key,
-        {
-          href: buildHref(route.name, route.params),
-          testID: tabBarButtonTestID,
-          accessibilityLabel: tabBarAccessibilityLabel,
-          badge: tabBarBadge,
-          icon,
-          label:
-            tabBarShowLabel === false
-              ? undefined
-              : typeof tabBarLabel === 'function'
-                ? ({ labelText, color }: MaterialLabelProps) =>
-                    tabBarLabel({
-                      focused: focusedRoute.key === route.key,
-                      color,
-                      children: labelText ?? route.name,
-                    })
-                : renderLabelDefault,
-          labelAllowFontScaling: tabBarAllowFontScaling,
-          labelStyle: tabBarLabelStyle,
-          labelText:
-            options.tabBarShowLabel === false
-              ? undefined
-              : typeof tabBarLabel === 'string'
-                ? tabBarLabel
-                : title !== undefined
-                  ? title
-                  : route.name,
-        },
-      ];
+      const tabOptions: TabDescriptor<Route> = {
+        href,
+        testID: tabBarButtonTestID,
+        accessibilityLabel: tabBarAccessibilityLabel,
+        badge: tabBarBadge,
+        icon,
+        label:
+          tabBarShowLabel === false

```

**File**: `packages/react-native-tab-view/src/TabView.tsx` (modified, +30/-8)
```diff
@@ -187,20 +187,42 @@ export function TabView<T extends Route>({
     }
   };
 
+  const optionsCache = React.useRef<
+    | {
+        commonOptions: Props<T>['commonOptions'];
+        sceneOptions: Props<T>['options'];
+        options: Record<string, TabDescriptor<T>>;
+      }
+    | undefined
+  >(undefined);
+
   const options = React.useMemo(
     () =>
       Object.fromEntries(
-        navigationState.routes.map((route) => [
-          route.key,
-          {
-            ...commonOptions,
-            ...sceneOptions?.[route.key],
-          },
-        ])
+        navigationState.routes.map((route) => {
+          const previous = optionsCache.current;
+          const routeOptions = sceneOptions?.[route.key];
+          const cachedOptions = previous?.options[route.key];
+
+          return [
+            route.key,
+            previous &&
+            cachedOptions &&
+            Object.hasOwn(previous.options, route.key) &&
+            previous.commonOptions === commonOptions &&
+            previous.sceneOptions?.[route.key] === routeOptions
+              ? cachedOptions
+              : { ...commonOptions, ...routeOptions },
+          ];
+        })
       ),
-    [navigationState.routes, commonOptions, sceneOptions]
+    [navigationState.routes, commonOptions, sceneOptions, optionsCache]
   );
 
+  React.useInsertionEffect(() => {
+    optionsCache.current = { commonOptions, sceneOptions, options };
+  });
+
   const element = renderAdapter({
     navigationState,
     keyboardDismissMode,
```

**File**: `pnpm-lock.yaml` (modified, +3/-0)
```diff
@@ -566,6 +566,9 @@ importers:
       react-native-tab-view:
         specifier: workspace:^
         version: link:../react-native-tab-view
+      use-latest-callback:
+        specifier: ^0.3.5
+        version: 0.3.5(react@19.2.3)
     devDependencies:
       '@jest/globals':
         specifier: ^30.4.1
```

#### Recent Merged Pull Requests:
- **PR #13263** (2026-09-21): chore: add AI Usage Policy (@satya164)
- **PR #13260** (2026-09-18): fix: fix slow layout on safari on iOS 27 (@satya164)
- **PR #13259** (closed): fix: give drawer onOpen and onClose a stable identity (@ahmdshrif)
- **PR #13255** (2026-09-17): fix(stack): clip inactive cards inside Card so their shadow stays visible (@BartekObudzinski)
- **PR #13253** (2026-09-17): refactor: remove unnecessary nanoid from core (@satya164)
- **PR #13252** (2026-09-17): fix: handle AGP9's built-in kotlin support (@satya164)
- **PR #13251** (2026-09-17): fix: measure frame size in layout effect (@satya164)
- **PR #13246** (2026-09-13): fix: avoid deprecated shadow style on web in stack (@satya164)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
