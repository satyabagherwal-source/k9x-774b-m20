# Forensic Learning Record (Deep Inspection): infinitered/reactotron

> **Canonical Artifact**: `07_PROJECT_LEARNING/infinitered-reactotron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/infinitered/reactotron](https://github.com/infinitered/reactotron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:49:45.402Z  
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

### Core Architecture Module: `apps/example-app/app/mobxStateTree/LogoStore.ts`
```
import { Instance, SnapshotOut, types } from "mobx-state-tree"

export const LogoStoreModel = types
  .model("LogoStore")
  .props({
    size: types.optional(types.number, 80),
    speed: types.optional(types.number, 25),
  })
  .actions((store) => ({
    faster: () => {
      store.speed = 10
    },
    slower: () => {
      store.speed = 50
    },
    bigger: () => {
      store.size = 140
    },
    smaller: () => {
      store.size = 40
    },
    reset: () => {
      store.size = 80
      store.speed = 25
    },
  }))

export interface LogoStore extends Instance<typeof LogoStoreModel> {}
export interface LogoStoreSnapshot extends SnapshotOut<typeof LogoStoreModel> {}

```

### Core Architecture Module: `apps/example-app/app/mobxStateTree/RepoStore.ts`
```
import { Instance, SnapshotOut, flow, types } from "mobx-state-tree"

export const RepoStoreModel = types
  .model("RepoStore")
  .props({
    message: types.maybe(types.string),
    repoName: types.maybe(types.string),
    url: types.maybe(types.string),
    name: types.maybe(types.string),
    sha: types.maybe(types.string),
    avatar: types.maybe(types.string),

    fetching: types.optional(types.boolean, false),
    error: types.maybe(types.string),
  })
  .actions((store) => ({
    reset: () => {
      store.message = undefined
      store.repoName = undefined
      store.url = undefined
      store.name = undefined
      store.sha = undefined
      store.avatar = undefined
      store.fetching = false
      store.error = undefined
    },
  }))
  .actions((store) => {
    const fetchRepo = flow(function* (repo: string) {
      // <- note the star, this is a generator function!
      store.fetching = true
      try {
        const json = yield fetchRepoAsync(repo)

        const lastCommit = json[0]
        console.log("Last commit: ", lastCommit)
        const { commit, author, committer, html_url: url } = lastCommit
        const { message, tree } = commit
        const { sha } = tree
        const { login, avatar_url: avatar } = author || committer

        store.repoName = repo
        store.message = message
        store.url = url
        store.name = login
        store.sha = sha
        store.avatar = avatar
        store.fetching = false
      } catch (error) {
        // ... including try/catch error handling
        console.error("Failed to fetch projects", error)
        store.fetching = false
        store.error = error.message
      }
      return true
    })
    return {
      fetchRepo,
    }
  })

const fetchRepoAsync = async (repo: string) => {
  const response = await fetch(`https://api.github.com/repos/${repo}/commits`)
  const json = await response.json()
  return json
}

export interface RepoStore extends Instance<typeof RepoStoreModel> {}
export interface RepoStoreSnapshot extends SnapshotOut<typeof RepoStoreModel> {}

```

### Core Architecture Module: `apps/example-app/app/mobxStateTree/RootStore.ts`
```
import { Instance, SnapshotOut, types } from "mobx-state-tree"
import { LogoStoreModel } from "./LogoStore"
import { RepoStoreModel } from "./RepoStore"

/**
 * A RootStore model.
 */
export const RootStoreModel = types.model("RootStore").props({
  repo: types.optional(RepoStoreModel, {}),
  logo: types.optional(LogoStoreModel, {}),
})

/**
 * The RootStore instance.
 */
export interface RootStore extends Instance<typeof RootStoreModel> {}
/**
 * The data of a RootStore.
 */
export interface RootStoreSnapshot extends SnapshotOut<typeof RootStoreModel> {}

```

### Core Architecture Module: `apps/example-app/app/mobxStateTree/helpers/getRootStore.ts`
```
import { getRoot, IStateTreeNode } from "mobx-state-tree"
import { RootStore, RootStoreModel } from "../RootStore"

/**
 * Returns a RootStore object in strongly typed way
 * for stores to access other stores.
 */
export const getRootStore = (self: IStateTreeNode): RootStore => {
  return getRoot<typeof RootStoreModel>(self)
}

```

### Core Architecture Module: `apps/example-app/app/mobxStateTree/helpers/setupRootStore.ts`
```
/**
 * This file is where we do "rehydration" of your RootStore from AsyncStorage.
 * This lets you persist your state between app launches.
 *
 * Navigation state persistence is handled in navigationUtilities.tsx.
 *
 * Note that Fast Refresh doesn't play well with this file, so if you edit this,
 * do a full refresh of your app instead.
 *
 * @refresh reset
 */
import { applySnapshot, IDisposer, onSnapshot } from "mobx-state-tree"
import { RootStore, RootStoreSnapshot } from "../RootStore"
import * as storage from "../../utils/storage"

/**
 * The key we'll be saving our state as within async storage.
 */
const ROOT_STATE_STORAGE_KEY = "root-v1"

/**
 * Setup the root state.
 */
let _disposer: IDisposer | undefined
export async function setupRootStore(rootStore: RootStore) {
  let restoredState: RootStoreSnapshot | undefined | null

  try {
    // load the last known state from AsyncStorage
    restoredState = ((await storage.load(ROOT_STATE_STORAGE_KEY)) ?? {}) as RootStoreSnapshot
    applySnapshot(rootStore, restoredState)
  } catch (e) {
    // if there's any problems loading, then inform the dev what happened
    if (__DEV__) {
      if (e instanceof Error) console.error(e.message)
    }
  }

  // stop tracking state changes if we've already setup
  if (_disposer) _disposer()

  // track changes & save to AsyncStorage
  _disposer = onSnapshot(rootStore, (snapshot) => storage.save(ROOT_STATE_STORAGE_KEY, snapshot))

  const unsubscribe = () => {
    _disposer?.()
    _disposer = undefined
  }

  return { rootStore, restoredState, unsubscribe }
}

```

### Core Architecture Module: `apps/example-app/app/mobxStateTree/helpers/useStores.ts`
```
import { createContext, useContext, useEffect, useState } from "react"
import { RootStore, RootStoreModel } from "../RootStore"
import { setupRootStore } from "./setupRootStore"
/**
 * Create the initial (empty) global RootStore instance here.
 *
 * Later, it will be rehydrated in app.tsx with the setupRootStore function.
 *
 * If your RootStore requires specific properties to be instantiated,
 * you can do so here.
 *
 * If your RootStore has a _ton_ of sub-stores and properties (the tree is
 * very large), you may want to use a different strategy than immediately
 * instantiating it, although that should be rare.
 */
const _rootStore = RootStoreModel.create({})

/**
 * The RootStoreContext provides a way to access
 * the RootStore in any screen or component.
 */
const RootStoreContext = createContext<RootStore>(_rootStore)

/**
 * You can use this Provider to specify a *different* RootStore
 * than the singleton version above if you need to. Generally speaking,
 * this Provider & custom RootStore instances would only be used in
 * testing scenarios.
 */
export const RootStoreProvider = RootStoreContext.Provider

/**
 * A hook that screens and other components can use to gain access to
 * our stores:
 *
 * const rootStore = useStores()
 *
 * or:
 *
 * const { someStore, someOtherStore } = useStores()
 */
export const useStores = () => useContext(RootStoreContext)

/**
 * Used only in the app.tsx file, this hook sets up the RootStore
 * and then rehydrates it. It connects everything with Reactotron
 * and then lets the app know that everything is ready to go.
 */
export const useInitialRootStore = (callback: () => void | Promise<void>) => {
  const rootStore = useStores()
  const [rehydrated, setRehydrated] = useState(false)

  // Kick off initial async loading actions, like loading fonts and rehydrating RootStore
  useEffect(() => {
    let _unsubscribe: () => void | undefined
    ;(async () => {
      // set up the RootStore (returns the state restored from AsyncStorage)
      const { unsubscribe } = await setupRootStore(rootStore)
      _unsubscribe = unsubscribe

      // reactotron integration with the MST root store (DEV only)
      if (__DEV__) {
        console.tron.trackMstNode(rootStore)
      }

      // let the app know we've finished rehydrating
      setRehydrated(true)

      // invoke the callback, if provided
      if (callback) callback()
    })()

    return () => {
      // cleanup
      if (_unsubscribe !== undefined) _unsubscribe()
    }
  }, [])

  return { rootStore, rehydrated }
}

```

### Core Architecture Module: `apps/example-app/app/mobxStateTree/index.ts`
```
export * from "./RootStore"
export * from "./helpers/getRootStore"
export * from "./helpers/useStores"
export * from "./helpers/setupRootStore"

```

### Core Architecture Module: `apps/example-app/app/navigators/navigationUtilities.ts`
```
import { useState, useEffect, useRef } from "react"
import { BackHandler, Platform } from "react-native"
import {
  NavigationState,
  PartialState,
  createNavigationContainerRef,
} from "@react-navigation/native"
import Config from "../config"
import type { PersistNavigationConfig } from "../config/config.base"
import { useIsMounted } from "../utils/useIsMounted"
import type { AppStackParamList, NavigationProps } from "./AppNavigator"

import * as storage from "../utils/storage"

type Storage = typeof storage

/**
 * Reference to the root App Navigator.
 *
 * If needed, you can use this to access the navigation object outside of a
 * `NavigationContainer` context. However, it's recommended to use the `useNavigation` hook whenever possible.
 * @see https://reactnavigation.org/docs/navigating-without-navigation-prop/
 *
 * The types on this reference will only let you reference top level navigators. If you have
 * nested navigators, you'll need to use the `useNavigation` with the stack navigator's ParamList type.
 */
export const navigationRef = createNavigationContainerRef<AppStackParamList>()

/**
 * Gets the current screen from any navigation state.
 */
export function getActiveRouteName(state: NavigationState | PartialState<NavigationState>): string {
  const route = state.routes[state.index ?? 0]

  // Found the active route -- return the name
  if (!route.state) return route.name as keyof AppStackParamList

  // Recursive call to deal with nested routers
  return getActiveRouteName(route.state as NavigationState<AppStackParamList>)
}

/**
 * Hook that handles Android back button presses and forwards those on to
 * the navigation or allows exiting the app.
 */
export function useBackButtonHandler(canExit: (routeName: string) => boolean) {
  // ignore unless android... no back button!
  if (Platform.OS !== "android") return

  // The reason we're using a ref here is because we need to be able
  // to update the canExit function without re-setting up all the listeners
  const canExitRef = useRef(canExit)

  useEffect(() => {
    canExitRef.current = canExit
  }, [canExit])

  useEffect(() => {
    // We'll fire this when the back button is pressed on Android.
    const onBackPress = () => {
      if (!navigationRef.isReady()) {
        return false
      }

      // grab the current route
      const routeName = getActiveRouteName(navigationRef.getRootState())

      // are we allowed to exit?
      if (canExitRef.current(routeName)) {
        // exit and let the system know we've handled the event
        BackHandler.exitApp()
        return true
      }

      // we can't exit, so let's turn this into a back action
      if (navigationRef.canGoBack()) {
        navigationRef.goBack()
        return true
      }

      return false
    }

    // Subscribe when we come to life
    BackHandler.addEventListener("hardwareBackPress", onBackPress)

    // Unsubscribe when we're done
    return () => BackHandler.removeEventListener("hardwareBackPress", onBackPress)
  }, [])
}

/**
 * This helper function will determine whether we should enable navigation persistence
 * based on a config setting and the __DEV__ environment (dev or prod).
 */
function navigationRestoredDefaultState(persistNavigation: PersistNavigationConfig) {
  if (persistNavigation === "always") return false
  if (persistNavigation === "dev" && __DEV__) return false
  if (persistNavigation === "prod" && !__DEV__) return false

  // all other cases, disable restoration by returning true
  return true
}

/**
 * Custom hook for persisting navigation state.
 */
export function useNavigationPersistence(storage: Storage, persistenceKey: string) {
  const [initialNavigationState, setInitialNavigationState] =
    useState<NavigationProps["initialState"]>()
  const isMounted = useIsMounted()

  const initNavState = navigationRestoredDefaultState(Config.persistNavigation)
  const [isRestored, setIsRestored] = useState(initNavState)

  const routeNameRef = useRef<keyof AppStackParamList | undefined>()

  const onNavigationStateChange = (state: NavigationState | undefined) => {
    const previousRouteName = routeNameRef.current
    if (state !== undefined) {
      const currentRouteName = getActiveRouteName(state)

      if (previousRouteName !== currentRouteName) {
        // track screens.
        if (__DEV__) {
          console.log(currentRouteName)
        }
      }

      // Save the current route name for later comparison
      routeNameRef.current = currentRouteName as keyof AppStackParamList

      // Persist state to storage
      storage.save(persistenceKey, state)
    }
  }

  const restoreState = async () => {
    try {
      const state = (await storage.load(persistenceKey)) as NavigationProps["initialState"] | null
      if (state) setInitialNavigationState(state)
    } finally {
      if (isMounted()) setIsRestored(true)
    }
  }

  useEffect(() => {
    if (!isRestored) restoreState()
  }, [isRestored])

  return { onNavigationStateChange, restoreState, isRestored, initialNavigationState }
}

/**
 * use this to navigate without the navigation
 * prop. If you have access to the navigation prop, do not use this.
 * @see https://reactnavigation.org/docs/navigating-without-navigation-prop/
 */
export function navigate(name: unknown, params?: unknown) {
  if (navigationRef.isReady()) {
    // @ts-expect-error
    navigationRef.navigate(name as never, params as never)
  }
}

/**
 * This function is used to go back in a navigation stack, if it's possible to go back.
 * If the navigation stack can't go back, nothing happens.
 * The navigationRef variable is a React ref that references a navigation object.
 * The navigationRef variable is set in the App component.
 */
export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack()
  }
}

/**
 * resetRoot will reset the root navigation state to the given params.
 */
export function resetRoot(
  state: Parameters<typeof navigationRef.resetRoot>[0] = { index: 0, routes: [] },
) {
  if (navigationRef.isReady()) {
    navigationRef.resetRoot(state)
  }
}

```

### Core Architecture Module: `apps/example-app/app/screens/MobxStateTreeScreen.tsx`
```
import { observer } from "mobx-react-lite"
import React from "react"
import { ScrollView, TextStyle, View, ViewStyle } from "react-native"
import { Button, Text } from "app/components"
import { AppStackScreenProps } from "app/navigators"
import { colors, spacing } from "app/theme"
import { useStores } from "app/mobxStateTree"
import { Repo } from "app/components/Repo"
import { useSafeAreaInsetsStyle } from "app/utils/useSafeAreaInsetsStyle"

interface MobxStateTreeScreenProps extends AppStackScreenProps<"MobxStateTree"> {}

export const MobxStateTreeScreen: React.FC<MobxStateTreeScreenProps> = observer(
  function MobxStateTreeScreen() {
    const { logo, repo } = useStores()

    const { avatar, name, message, repoName, fetchRepo, reset: repoReset } = repo
    const { size, speed, faster, slower, bigger, smaller, reset: logoReset } = logo

    const requestReactotron = () => fetchRepo("infinitered/reactotron")
    const requestReactNative = () => fetchRepo("facebook/react-native")
    const requestMobx = () => fetchRepo("mobxjs/mobx")
    const requestRedux = () => fetchRepo("reactjs/redux")

    const $bottomContainerInsets = useSafeAreaInsetsStyle(["bottom"])

    return (
      <ScrollView style={$container} contentContainerStyle={$bottomContainerInsets}>
        <View style={$topContainer}>
          <Text style={$text} tx="mobxStateTreeScreen.title" />
        </View>
        <View style={{ marginTop: spacing.lg }}>
          <View style={$buttons}>
            <Button textStyle={$darkText} tx="repos.reactotron" onPress={requestReactotron} />
            <Button textStyle={$darkText} tx="repos.redux" onPress={requestRedux} />
            <Button textStyle={$darkText} tx="repos.mobx" onPress={requestMobx} />
            <Button textStyle={$darkText} tx="repos.reactNative" onPress={requestReactNative} />
          </View>
          <Repo
            avatar={avatar}
            repo={repoName}
            name={name}
            message={message}
            size={size}
            speed={speed}
            bigger={bigger}
            smaller={smaller}
            faster={faster}
            slower={slower}
            reset={() => {
              logoReset()
              repoReset()
            }}
          />
        </View>
      </ScrollView>
    )
  }
)

const $buttons: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  marginBottom: 20,
  justifyContent: "center",
}

const $container: ViewStyle = {
  flex: 1,
  backgroundColor: colors.background,
}
const $topContainer: ViewStyle = {
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.xl,
}
const $text: TextStyle = {
  color: colors.text,
}
const $darkText: TextStyle = {
  color: colors.textDim,
}

```

### Core Architecture Module: `apps/example-app/app/utils/crashReporting.ts`
```
/**
 * If you're using Sentry
 *   RN   https://docs.sentry.io/platforms/react-native/
 *   Expo https://docs.expo.dev/guides/using-sentry/
 */
// import * as Sentry from "sentry-expo"
// import * as Sentry from "@sentry/react-native"

/**
 * If you're using Crashlytics: https://rnfirebase.io/crashlytics/usage
 */
// import crashlytics from "@react-native-firebase/crashlytics"

/**
 * If you're using Bugsnag:
 *   RN   https://docs.bugsnag.com/platforms/react-native/)
 *   Expo https://docs.bugsnag.com/platforms/react-native/expo/
 */
// import Bugsnag from "@bugsnag/react-native"
// import Bugsnag from "@bugsnag/expo"

/**
 *  This is where you put your crash reporting service initialization code to call in `./app/app.tsx`
 */
export const initCrashReporting = () => {
  // Sentry.init({
  //   dsn: "YOUR DSN HERE",
  //   enableInExpoDevelopment: true,
  //   debug: true, // If `true`, Sentry will try to print out useful debugging information if something goes wrong with sending the event. Set it to `false` in production
  // })
  // Bugsnag.start("YOUR API KEY")
}

/**
 * Error classifications used to sort errors on error reporting services.
 */
export enum ErrorType {
  /**
   * An error that would normally cause a red screen in dev
   * and force the user to sign out and restart.
   */
  FATAL = "Fatal",
  /**
   * An error caught by try/catch where defined using Reactotron.tron.error.
   */
  HANDLED = "Handled",
}

/**
 * Manually report a handled error.
 */
export const reportCrash = (error: Error, type: ErrorType = ErrorType.FATAL) => {
  if (__DEV__) {
    // Log to console and Reactotron in development
    const message = error.message || "Unknown"
    console.error(error)
    console.log(message, type)
  } else {
    // In production, utilize crash reporting service of choice below:
    // RN
    // Sentry.captureException(error)
    // Expo
    // Sentry.Native.captureException(error)
    // crashlytics().recordError(error)
    // Bugsnag.notify(error)
  }
}

```

### Core Architecture Module: `apps/example-app/app/utils/delay.ts`
```
/**
 * A "modern" sleep statement.
 *
 * @param ms The number of milliseconds to wait.
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

```

### Core Architecture Module: `apps/example-app/app/utils/formatDate.ts`
```
// Note the syntax of these imports from the date-fns library.
// If you import with the syntax: import { format } from "date-fns" the ENTIRE library
// will be included in your production bundle (even if you only use one function).
// This is because react-native does not support tree-shaking.
import type { Locale } from "date-fns"
import format from "date-fns/format"
import parseISO from "date-fns/parseISO"
import en from "date-fns/locale/en-US"

type Options = Parameters<typeof format>[2]

const getLocale = (): Locale => {
  return en
}

export const formatDate = (date: string, dateFormat?: string, options?: Options) => {
  const locale = getLocale()
  const dateOptions = {
    ...options,
    locale,
  }
  return format(parseISO(date), dateFormat ?? "MMM dd, yyyy", dateOptions)
}

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
+    const [method, url] = open.mock.calls[0]
+    expect(method).toBe("GET")
+    expect(url).toBe("https://example.com/from-url")
+  })
 })
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
+  // wrapped fetch on top of us since, the global is left alone and our wrapper
+  // just goes inert (pass-through) — ripping out a later wrapper isn't ours to do.
   disableInterception() {
     if (!originalFetch) {
       return
     }
-    globalThis.fetch = originalFetch
+    if (wrapperState) {
+      wrapperState.stopped = true
+    }
+    if (globalThis.fetch === wrappedFetch && previousGlobalFetch) {
+      // Restore what was global when we wrapped — not necessarily the wrapped
+      // function itself (an explicitly passed fetch may never have been global).
+      globalThis.fetch = previousGlobalFetch
+    }
     originalFetch = null
+    wrappedFetch = null
+    previousGlobalFetch = null
+    wrapperState = null
     openCallback = null
     responseCallback = null
   },
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
+    const [, tronResponse] = reactotron.apiResponse.mock.calls[0]
+    expect(tronResponse.body).toBe("~~~ unreadable ~~~")
+  })
+
+  it("skips bodies for streaming content types without touching the response", async () => {
+    const response = makeResponse(200, { "content-type": "text/event-stream" })
+    const cloneSpy = jest.spyOn(response, "clone")
+    connect(response)
+
+    await (globalThis.fetch as any)("https://example.com/stream")
+    await flushPromises()
+
+    expect(cloneSpy).not.toHaveBeenCalled()
+    const [, tronResponse] = reactotron.apiResponse.mock.calls[0]
+    expect(tronResponse.body).toBe("~~~ skipped ~~~")
+  })
+
+  it("does not report requests matching ignoreUrls", async () => {
+    connect(makeResponse(200, { "content-type": "application/json" }, "{}"), {
+      ignoreUrls: /\/logs$/,
+    })
+
+    await (globalThis.fetch as any)("https://example.com/logs")
+    await flushPromises()
+
+    expect(reactotron.apiResponse).not.toHaveBeenCalled()
+  })
+})
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

### Incident Patch 2: `ecc24953` (2026-08-12)
**Commit Message**: docs(contributing): add runtime verification guide (#1614)

## Describe your PR

Adds `docs/contributing/runtime-verification.md`: a maintainer guide for
verifying fixes at runtime — and more generally, for scriptable
end-to-end testing between a real development build of the desktop app
and an app on a simulator. Covers: PR worktree + packed tarballs,
running the desktop app under a CDP port with a copy-paste `cdp.js`
timeline reader, building a test app that matches the bug's environment,
and baseline-vs-fix methodology with a control request.

Also adds a super-minimal root `AGENTS.md` (with `CLAUDE.md` symlinked
to it) that just routes coding agents to the existing contributing docs,
so it won't go stale.

Docs-only change.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---------

Co-authored-by: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `AGENTS.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+# Agent Notes
+
+Minimal router — the linked docs are the source of truth.
+
+- **Monorepo layout, build, test**: [docs/contributing/monorepo.md](docs/contributing/monorepo.md) and [docs/contributing/architecture.md](docs/contributing/architecture.md)
+- **Verifying fixes at runtime** (real desktop dev build + simulator app, fully scriptable e2e — use this to verify PRs, not just unit tests): [docs/contributing/runtime-verification.md](docs/contributing/runtime-verification.md)
+- **CI and trusting fork PRs**: [docs/contributing/ci.md](docs/contributing/ci.md)
+- **Releasing**: [docs/contributing/releasing.md](docs/contributing/releasing.md)
```

**File**: `CLAUDE.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+AGENTS.md
\ No newline at end of file
```

**File**: `docs/contributing/runtime-verification.md` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+---
+name: Verifying Fixes at Runtime
+sidebar_position: 98
+---
+
+# Verifying Fixes at Runtime
+
+Unit tests catch regressions in the mechanism, but many Reactotron bugs live in the seams between the client library, the app's runtime environment, and the desktop app. This guide documents an end-to-end flow for verifying a fix against a **real app on a real simulator talking to a real Reactotron desktop build**. Beyond bug verification, this is a general recipe for testing full end-to-end interactions between a real development build of the desktop app and an app running on a simulator — both sides scriptable, so the whole loop (app fires an event → client reports it → desktop renders it) can be exercised and asserted without manual clicking.
+
+The core idea: run the Reactotron desktop app from the PR branch with a Chrome DevTools Protocol (CDP) port open so you can read its timeline programmatically, run a test app with the PR's client library installed from packed tarballs, and compare **baseline** (published packages, bug reproduced) against **fix** (PR tarballs, bug gone).
+
+## 1. Set up a worktree for the PR
+
+```bash
+git fetch origin pull/<PR_NUMBER>/head:pr-<PR_NUMBER>
+git worktree add ../reactotron-pr-<PR_NUMBER> pr-<PR_NUMBER>
+cd ../reactotron-pr-<PR_NUMBER>
+yarn install && yarn build
+yarn workspace <changed-package> test
+```
+
+This keeps your main checkout clean and lets you build everything from the PR's exact commits. (For fork PRs, CI needs the [trust process](./ci.md) separately — local verification doesn't.)
+
+## 2. Pack the client libraries as tarballs
+
+Test apps should consume the PR's packages the way users do — from installable tarballs, not workspace symlinks. Pack the changed package **and its workspace dependencies** (`yarn pack` rewrites `workspace:*` to concrete versions, which may not exist on npm yet):
+
+```bash
+mkdir -p /tmp/tarballs
+yarn workspace reactotron-core-contract pack --out /tmp/tarballs/reactotron-core-contract.tgz
+yarn workspace reactotron-core-client pack --out /tmp/tarballs/reactotron-core-client.tgz
+yarn workspace reactotron-react-native pack --out /tmp/tarballs/reactotron-react-native.tgz
+```
+
+## 3. Run the desktop app with a CDP port
+
+The dev server (`yarn start`) is fine for manual testing, but for scripted verification run the built app directly with remote debugging enabled. One gotcha: `electron-webpack` writes the renderer to `dist/renderer/`, while `dist/main/main.js` loads `index.html` from its own directory — copy the renderer assets next to it first:
+
+```bash
+cd apps/reactotron-app
+cp -R dist/renderer/ dist/main/
+../../node_modules/.bin/electron dist/main/main.js --remote-debugging-port=9315
+```
+
+Now the timeline can be read (and clicked) from short Node scripts over raw CDP — no extra dependencies beyond Node 22+ (built-in `WebSocket` and `fetch`):
+
+```js
+// cdp.js — usage: node cdp.js '<js expression>'  (evaluates in the renderer)
+const expr = process.argv[2] || "document.title"
+const targets = await (await fetch("http://localhost:9315/json")).json()
+const page = targets.find((t) => t.type === "page")
+const ws = new WebSocket(page.webSocketDebuggerUrl)
+await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)))
+const result = await new Promise((res) => {
+  ws.onmessage = (m) => {
+    const d = JSON.parse(m.data)
+    if (d.id === 1) res(d.result)
+  }
+  ws.send(
+    JSON.stringify({
+      id: 1,
+      method: "Runtime.evaluate",
+      params: { expression: expr, returnByValue: true, awaitPromise: true },
+    })
+  )
+})
+console.log(JSON.stringify(result, null, 2))
+ws.close()
+```
+
+The workhorse invocation is simply:
+
+```bash
+node cdp.js 'document.body.innerText'   # dump the visible timeline
+```
+
+which shows connections ("port 9090 | 1 connections") and timeline entries ("API RESPONSE (200) …"). You can also dispatch `.click()` on timeline rows through `Runtime.evaluate` to expand entries and read request/response details. (Note: Playwright's `connectOverCDP` does not work against the Electron version currently used — raw CDP does.)
+
+## 4. Build a test app that reproduces the bug's environment
+
+**Match the environment the bug report describes, not just any app.** The repo's `apps/example-app` is handy for generic checks, but it may not reproduce environment-specific bugs (its Expo SDK version can lag well behind current). Scaffolding a fresh `create-expo-app` gets you the current SDK *and* the default template's runtime setup (e.g. expo-router), which can behave differently from the environment a fix was developed against — that difference is often where the bugs are.
+
+Give the test app:
+
+- Buttons for each code path under test, with `testID`s (e.g. one firing `fetch`, one firing raw `XMLHttpRequest` as a **control** that should always be tracked)
+- On-screen text for any environment preconditions the fix depends on (e.g. whether `globalThis.fetch` carrie
```

---

### Incident Patch 3: `d07f3fa0` (2026-04-06)
**Commit Message**: release(reactotron-core-ui): 2.7.0 [skip ci]

**File**: `lib/reactotron-core-ui/CHANGELOG.md` (modified, +8/-0)
```diff
@@ -2,6 +2,14 @@
 
 This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).
 
+## [2.7.0](https://github.com/infinitered/reactotron/compare/reactotron-core-ui@2.6.3...reactotron-core-ui@2.7.0) (2026-04-06)
+
+
+### Features
+
+* add MCP server for Claude Code integration ([#1598](https://github.com/infinitered/reactotron/issues/1598)) ([5aba55f](https://github.com/infinitered/reactotron/commit/5aba55fb97d80a69e8176f4c46588937fb507848))
+* **reactotron-core-ui:** add copy button for nested objects in API response   ([#1597](https://github.com/infinitered/reactotron/issues/1597)) ([2ad8856](https://github.com/infinitered/reactotron/commit/2ad885683eeed4faf92d6b7728d243d68cb6a3f6))
+
 ### [2.6.3](https://github.com/infinitered/reactotron/compare/reactotron-core-ui@2.6.2...reactotron-core-ui@2.6.3) (2025-10-06)
 
 ### [2.6.2](https://github.com/infinitered/reactotron/compare/reactotron-core-ui@2.6.1...reactotron-core-ui@2.6.2) (2025-09-16)
```

**File**: `lib/reactotron-core-ui/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "reactotron-core-ui",
-  "version": "2.6.3",
+  "version": "2.7.0",
   "description": "Core UI components for Reactotron",
   "author": "Infinite Red",
   "license": "MIT",
```

---

### Incident Patch 4: `2ad88568` (2026-04-06)
**Commit Message**: feat(reactotron-core-ui): add copy button for nested objects in API response   (#1597)

## Please verify the following:

- [x] `yarn build-and-test:local` passes  
- [ ] I have added tests for any new features, if relevant  
- [ ] `README.md` (or relevant documentation) has been updated with your
changes

---

# Describe your PR

Adds a **Copy button for nested objects** in the `TreeView` component
inside the **Response Body** tab.

This allows users to quickly copy the JSON representation of any nested
object in an API response without manually selecting or expanding large
sections of the tree.

---

# Motivation

Previously, Reactotron only allowed copying **top-level values**.  
When API responses contained deeply nested objects, users had to
manually expand the tree and select the text to copy.

This change enables **one-click copying of any nested object**,
improving the developer experience when inspecting API responses.

---

# Implementation

- **TreeView/index.tsx**
  - Accepts an optional `copyToClipboard` prop
  - Renders a `ButtonCopy` next to object-type nodes (e.g. `{3}`)
  - Copies `JSON.stringify(data, null, 2)` when clicked
- Uses `event.stopPropagation()` so click

**File**: `lib/reactotron-core-ui/src/components/ContentView/index.tsx` (modified, +3/-2)
```diff
@@ -21,9 +21,10 @@ interface Props {
   // value: object | string | number | boolean | null | undefined
   value: any
   treeLevel?: number
+  copyToClipboard?: (text: string) => void
 }
 
-export default function ContentView({ value, treeLevel }: Props) {
+export default function ContentView({ value, treeLevel, copyToClipboard }: Props) {
   if (value === null) return <NullContainer>null</NullContainer>
   if (value === undefined) return <UndefinedContainer>undefined</UndefinedContainer>
 
@@ -54,7 +55,7 @@ export default function ContentView({ value, treeLevel }: Props) {
     return isShallow(checkValue) ? (
       makeTable(checkValue)
     ) : (
-      <TreeView value={checkValue} level={treeLevel} />
+      <TreeView value={checkValue} level={treeLevel} copyToClipboard={copyToClipboard} />
     )
   }
 
```

**File**: `lib/reactotron-core-ui/src/components/TreeView/index.tsx` (modified, +30/-2)
```diff
@@ -29,6 +29,22 @@ const theme = {
 
 const MutedContainer = styled.span`
   color: ${(props) => props.theme.highlight};
+  display: inline-flex;
+`
+
+const ButtonCopy = styled.button`
+  margin-left: 6px;
+  padding: 0 6px;
+  font-size: 10px;
+  border: none;
+  border-radius: 3px;
+  cursor: pointer;
+  color: ${(props) => props.theme.background};
+  background-color: ${(props) => props.theme.highlight};
+
+  &:hover {
+    opacity: 0.85;
+  }
 `
 
 const getTreeTheme = (baseTheme: ReactotronTheme) => ({
@@ -41,9 +57,10 @@ interface Props {
   // value: object
   value: any
   level?: number
+  copyToClipboard?: (text: string) => void
 }
 
-export default function TreeView({ value, level = 1 }: Props) {
+export default function TreeView({ value, level = 1, copyToClipboard }: Props) {
   const colorScheme = useColorScheme()
 
   return (
@@ -54,7 +71,18 @@ export default function TreeView({ value, level = 1 }: Props) {
       theme={getTreeTheme(themes[colorScheme])}
       getItemString={(type, data, itemType, itemString) => {
         if (type === "Object") {
-          return <MutedContainer>{itemType}</MutedContainer>
+          const handleCopy = copyToClipboard
+            ? (event: React.MouseEvent) => {
+                event.stopPropagation()
+                copyToClipboard(JSON.stringify(data, null, 2))
+              }
+            : undefined
+          return (
+            <MutedContainer>
+              {itemType}
+              {handleCopy && <ButtonCopy onClick={handleCopy}>Copy</ButtonCopy>}
+            </MutedContainer>
+          )
         }
 
         return (
```

**File**: `lib/reactotron-core-ui/src/timelineCommands/ApiResponseCommand/index.tsx` (modified, +3/-1)
```diff
@@ -167,7 +167,9 @@ const ApiResponseCommand: FunctionComponent<Props> = ({
         {!!request.params && tabBuilder(Tab.RequestParams, "Request Params")}
         {tabBuilder(Tab.RequestHeaders, "Request Headers")}
       </TabsContainer>
-      {onTab === Tab.ResponseBody && <ContentView value={response.body} />}
+      {onTab === Tab.ResponseBody && (
+        <ContentView value={response.body} copyToClipboard={copyToClipboard} />
+      )}
       {onTab === Tab.ResponseHeaders && <ContentView value={response.headers} />}
       {onTab === Tab.RequestBody && <ContentView value={request.data} treeLevel={1} />}
       {onTab === Tab.RequestParams && <ContentView value={request.params} />}
```

---

### Incident Patch 5: `0250737e` (2026-03-30)
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

### Incident Patch 6: `65dd6b75` (2025-10-13)
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

### Incident Patch 7: `cb68a287` (2025-10-06)
**Commit Message**: release(reactotron-core-ui): 2.6.3 [skip ci]

**File**: `lib/reactotron-core-ui/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).
 
+### [2.6.3](https://github.com/infinitered/reactotron/compare/reactotron-core-ui@2.6.2...reactotron-core-ui@2.6.3) (2025-10-06)
+
 ### [2.6.2](https://github.com/infinitered/reactotron/compare/reactotron-core-ui@2.6.1...reactotron-core-ui@2.6.2) (2025-09-16)
 
 ### [2.6.1](https://github.com/infinitered/reactotron/compare/reactotron-core-ui@2.6.0...reactotron-core-ui@2.6.1) (2025-03-17)
```

**File**: `lib/reactotron-core-ui/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "reactotron-core-ui",
-  "version": "2.6.2",
+  "version": "2.6.3",
   "description": "Core UI components for Reactotron",
   "author": "Infinite Red",
   "license": "MIT",
```

---

### Incident Patch 8: `28d5884b` (2025-10-01)
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

### Incident Patch 9: `8c16592f` (2025-09-19)
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

### Incident Patch 10: `c3623172` (2025-09-16)
**Commit Message**: release(reactotron-redux): 3.2.1 [skip ci]

**File**: `lib/reactotron-redux/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).
 
+### [3.2.1](https://github.com/infinitered/reactotron/compare/reactotron-redux@3.2.0...reactotron-redux@3.2.1) (2025-09-16)
+
 ## [3.2.0](https://github.com/infinitered/reactotron/compare/reactotron-redux@3.1.11...reactotron-redux@3.2.0) (2025-03-16)
 
 
```

**File**: `lib/reactotron-redux/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "reactotron-redux",
-  "version": "3.2.0",
+  "version": "3.2.1",
   "description": "A Reactotron plugin for Redux.",
   "author": "Infinite Red",
   "license": "MIT",
```

---

### Incident Patch 11: `ffda8fab` (2025-09-16)
**Commit Message**: release(reactotron-core-ui): 2.6.2 [skip ci]

**File**: `lib/reactotron-core-ui/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).
 
+### [2.6.2](https://github.com/infinitered/reactotron/compare/reactotron-core-ui@2.6.1...reactotron-core-ui@2.6.2) (2025-09-16)
+
 ### [2.6.1](https://github.com/infinitered/reactotron/compare/reactotron-core-ui@2.6.0...reactotron-core-ui@2.6.1) (2025-03-17)
 
 
```

**File**: `lib/reactotron-core-ui/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "reactotron-core-ui",
-  "version": "2.6.1",
+  "version": "2.6.2",
   "description": "Core UI components for Reactotron",
   "author": "Infinite Red",
   "license": "MIT",
```

---

### Incident Patch 12: `0195955b` (2025-09-16)
**Commit Message**: chore: replace Rollup with react-native-builder-bob for package builds (#1572)

## Please verify the following:

- [x] `yarn build-and-test:local` passes
- [x] I have added tests for any new features, if relevant
- [ ] `README.md` (or relevant documentation) has been updated with your
changes

## Why?

Our current rollup build system shoves all the source code into one
minified file. This is fine for most things, but rollup does not respect
platform extensions like `.web.ts` or `.native.ts`. This is a blocker
for implementing https://github.com/infinitered/reactotron/issues/1384.
Instead of manually trying to recreate all the build settings for
Metro/babel in rollup, this PR uses
[react-native-builder-bob](https://callstack.github.io/react-native-builder-bob/build)
since it is used by [several
packages](https://github.com/search?q=%22react-native-builder-bob%22+path%3A%22package.json%22&type=code)
in the react native community and we can think less about react native
specific bundling logic developing features going forward.

## Describe your PR

This PR completely migrates the build system from Rollup to
`react-native-builder-bob` across all packages in the monorepo,
including com

**File**: `.tool-versions` (modified, +1/-1)
```diff
@@ -1 +1 @@
-nodejs 21.6.2
+nodejs 22.19.0
```

**File**: `lib/eslint-plugin-reactotron/.babelrc` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 {
-  "presets": ["@babel/preset-env", "@babel/preset-typescript"]
+  "presets": ["react-native-builder-bob/babel-preset"]
 }
```

**File**: `lib/eslint-plugin-reactotron/package.json` (modified, +31/-19)
```diff
@@ -13,14 +13,17 @@
     "dist",
     "src"
   ],
-  "main": "dist/index.js",
-  "module": "dist/index.esm.js",
-  "types": "dist/types/src/index.d.ts",
-  "react-native": "src/index.ts",
+  "main": "./dist/commonjs/index.js",
+  "module": "./dist/module/index.js",
+  "types": "./dist/typescript/commonjs/src/index.d.ts",
   "exports": {
-    "import": "./dist/index.esm.js",
-    "types": "./dist/types/src/index.d.ts",
-    "default": "./dist/index.js"
+    ".": {
+      "source": "./src/index.ts",
+      "types": "./dist/typescript/commonjs/src/index.d.ts",
+      "module": "./dist/module/index.js",
+      "default": "./dist/commonjs/index.js"
+    },
+    "./package.json": "./package.json"
   },
   "scripts": {
     "test": "jest --passWithNoTests",
@@ -29,16 +32,15 @@
     "format:check": "yarn format --check",
     "format:write": "yarn format --write",
     "prebuild": "yarn clean",
-    "build": "yarn tsc && yarn compile",
+    "build": "bob build",
     "prebuild:dev": "yarn clean",
-    "build:dev": "yarn tsc && yarn compile:dev",
+    "build:dev": "bob build",
     "clean": "rimraf ./dist",
     "lint": "eslint 'src/**/**.{ts,tsx}'",
-    "compile": "NODE_ENV=production rollup -c rollup.config.ts",
-    "compile:dev": "NODE_ENV=development rollup -c rollup.config.ts",
     "tsc": "tsc",
-    "typecheck": "tsc",
-    "ci:test": "yarn test --runInBand"
+    "typecheck": "tsc --noEmit --emitDeclarationOnly false",
+    "ci:test": "yarn test --runInBand",
+    "prepare": "bob build"
   },
   "peerDependencies": {
     "reactotron-core-client": "*"
@@ -65,13 +67,8 @@
     "eslint-plugin-standard": "^5.0.0",
     "jest": "^29.7.0",
     "prettier": "^3.0.3",
+    "react-native-builder-bob": "^0.40.13",
     "reactotron-core-client": "workspace:*",
-    "rollup": "^1.1.2",
-    "rollup-plugin-babel": "^4.4.0",
-    "rollup-plugin-babel-minify": "^7.0.0",
-    "rollup-plugin-filesize": "^6.0.1",
-    "rollup-plugin-node-resolve": "^4.0.0",
-    "rollup-plugin-resolve": "^0.0.1-predev.1",
     "testdouble": "^3.20.0",
     "ts-jest": "^29.1.1",
     "typescript": "^4.9.5"
@@ -81,5 +78,20 @@
     "rules": {
       "import/no-unresolved": "off"
     }
+  },
+  "react-native-builder-bob": {
+    "source": "src",
+    "output": "dist",
+    "exclude": "**/*.test.{tsx,ts}",
+    "targets": [
+      "commonjs",
+      [
+        "module",
+        {
+          "esm": true
+        }
+      ],
+      "typescript"
+    ]
   }
 }
```

**File**: `lib/eslint-plugin-reactotron/rollup.config.ts` (removed, +0/-31)
```diff
@@ -1,31 +0,0 @@
-import resolve from "rollup-plugin-node-resolve"
-import babel from "rollup-plugin-babel"
-import filesize from "rollup-plugin-filesize"
-import minify from "rollup-plugin-babel-minify"
-
-const pkg = require("./package.json")
-
-export default {
-  input: "src/index.ts",
-  output: [
-    {
-      file: pkg.main,
-      format: "commonjs",
-    },
-    {
-      file: pkg.module,
-      format: "esm",
-    },
-  ],
-  plugins: [
-    resolve({ extensions: [".ts"] }),
-    babel({ extensions: [".ts"], runtimeHelpers: true }),
-    process.env.NODE_ENV === "production"
-      ? minify({
-          comments: false,
-        })
-      : null,
-    filesize(),
-  ],
-  external: ["reactotron-core-client"],
-}
```

**File**: `lib/eslint-plugin-reactotron/tsconfig.json` (modified, +0/-1)
```diff
@@ -3,7 +3,6 @@
   "compilerOptions": {
     "allowJs": false,
     "declaration": true,
-    "declarationDir": "dist/types",
     "rootDir": ".",
     "emitDeclarationOnly": true,
     "emitDecoratorMetadata": true,
```

**File**: `lib/reactotron-apisauce/.babelrc` (modified, +1/-4)
```diff
@@ -1,6 +1,3 @@
 {
-  "presets": [
-    "@babel/preset-env",
-    "@babel/preset-typescript"
-  ]
+  "presets": ["react-native-builder-bob/babel-preset"]
 }
```

**File**: `lib/reactotron-apisauce/package.json` (modified, +31/-20)
```diff
@@ -13,14 +13,17 @@
     "dist",
     "src"
   ],
-  "main": "dist/index.js",
-  "module": "dist/index.esm.js",
-  "types": "dist/types/src/index.d.ts",
-  "react-native": "src/index.ts",
+  "main": "./dist/commonjs/index.js",
+  "module": "./dist/module/index.js",
+  "types": "./dist/typescript/commonjs/src/index.d.ts",
   "exports": {
-    "import": "./dist/index.esm.js",
-    "types": "./dist/types/src/index.d.ts",
-    "default": "./dist/index.js"
+    ".": {
+      "source": "./src/index.ts",
+      "types": "./dist/typescript/commonjs/src/index.d.ts",
+      "module": "./dist/module/index.js",
+      "default": "./dist/commonjs/index.js"
+    },
+    "./package.json": "./package.json"
   },
   "scripts": {
     "test": "jest",
@@ -29,16 +32,15 @@
     "format:write": "yarn format --write",
     "format:check": "yarn format --check",
     "prebuild": "yarn clean",
-    "build": "yarn tsc && yarn compile",
+    "build": "bob build",
     "prebuild:dev": "yarn clean",
-    "build:dev": "yarn tsc && yarn compile:dev",
+    "build:dev": "bob build",
     "clean": "rimraf dist",
     "lint": "eslint src test --ext .ts,.tsx",
-    "compile": "NODE_ENV=production rollup -c",
-    "compile:dev": "NODE_ENV=development rollup -c",
     "tsc": "tsc",
-    "typecheck": "tsc",
-    "ci:test": "yarn test --runInBand"
+    "typecheck": "tsc --noEmit --emitDeclarationOnly false",
+    "ci:test": "yarn test --runInBand",
+    "prepare": "bob build"
   },
   "dependencies": {
     "apisauce": "^3.0.1"
@@ -65,14 +67,8 @@
     "jest": "^29.7.0",
     "json-server": "^0.17.4",
     "prettier": "^3.0.3",
+    "react-native-builder-bob": "^0.40.13",
     "rimraf": "5.0.5",
-    "rollup": "^1.2.3",
-    "rollup-plugin-babel": "^4.4.0",
-    "rollup-plugin-babel-minify": "^7.0.0",
-    "rollup-plugin-filesize": "^6.0.1",
-    "rollup-plugin-node-resolve": "^4.0.0",
-    "rollup-plugin-replace": "^2.1.0",
-    "rollup-plugin-resolve": "^0.0.1-predev.1",
     "ts-jest": "^29.1.1",
     "typescript": "^4.9.5"
   },
@@ -98,5 +94,20 @@
     "testMatch": [
       "**/*.test.[tj]s"
     ]
+  },
+  "react-native-builder-bob": {
+    "source": "src",
+    "output": "dist",
+    "exclude": "**/*.test.{tsx,ts}",
+    "targets": [
+      "commonjs",
+      [
+        "module",
+        {
+          "esm": true
+        }
+      ],
+      "typescript"
+    ]
   }
 }
```

**File**: `lib/reactotron-apisauce/rollup.config.js` (removed, +0/-35)
```diff
@@ -1,35 +0,0 @@
-import resolve from "rollup-plugin-node-resolve"
-import babel from "rollup-plugin-babel"
-import replace from "rollup-plugin-replace"
-import filesize from "rollup-plugin-filesize"
-import minify from "rollup-plugin-babel-minify"
-
-const coreClientVersion = require("./package.json").version
-
-/** @type {import('rollup').RollupOptions} */
-export default {
-  input: "src/index.ts",
-  output: [
-    {
-      file: "dist/index.js",
-      format: "cjs",
-    },
-    {
-      file: "dist/index.esm.js",
-      format: "esm",
-    },
-  ],
-  plugins: [
-    resolve({ extensions: [".ts"] }),
-    replace({
-      REACTOTRON_CORE_CLIENT_VERSION: coreClientVersion,
-    }),
-    babel({ extensions: [".ts"], runtimeHelpers: true }),
-    process.env.NODE_ENV === "production"
-      ? minify({
-          comments: false,
-        })
-      : null,
-    filesize(),
-  ],
-}
```

---

### Incident Patch 13: `a8eed616` (2025-09-09)
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
+    // $FlowFixMe[missing-this-annot]
+    XMLHttpRequest.prototype.setRequestHeader = function (header: string, value: string) {
+      if (requestHeaderCallback) {
+        requestHeaderCallback(header, value, this)
+      }
+      originalXHRSetRequestHeader.apply(this, arguments)
+    }
+
+    // Override `send` method of all XHR requests to intercept the data sent,
+    // register listeners to intercept the response, and invoke the callbacks.
+    // $FlowFixMe[cannot-write]
+    // $FlowFixMe[missing-this-annot]
+    XMLHttpRequest.prototype.send = function (data: string) {
+      if (sendCallback) {
+        sendCallback(data, this)
+      }
+      if (this.addEventListener) {
+        this.addEventListener(
+          "readystatechange",
+          () => {
+            if (!isInterceptorEnabled) {
+              return
+            }
+            if (this.readyState === this.HEADERS_RECEIVED) {
+              const contentTypeString = this.getResponseHeader("Content-Type")
+              const contentLengthS
```

---

### Incident Patch 14: `7f718b6d` (2025-08-12)
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

### Incident Patch 15: `187cbc11` (2025-06-23)
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
