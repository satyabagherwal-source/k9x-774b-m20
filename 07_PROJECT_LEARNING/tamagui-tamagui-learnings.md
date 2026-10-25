> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/tamagui-tamagui-learnings.md`  
> **Source**: github ([https://github.com/tamagui/tamagui](https://github.com/tamagui/tamagui))  
> **Source Version**: `32f3ba8b`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T15:09:45.550Z  
> **Learning ID**: `learn-github-tamagui-tamagui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): tamagui/tamagui

> **Canonical Artifact**: `07_PROJECT_LEARNING/tamagui-tamagui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tamagui/tamagui](https://github.com/tamagui/tamagui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T15:09:44.378Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tamagui/tamagui`
- **Description**: Style React fast with 100% parity on React Native, an optional UI kit, and optimizing compiler.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 14280 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `code/bento/src/elements/pickers/hooks/useDropZone.native.tsx`
```
export function useDropZone(options: any) {
  //fallback to make kitchensink work with bento
  return {}
}

```

### Core Architecture Module: `code/bento/src/elements/pickers/hooks/useDropZone.tsx`
```
// vite cjs compat:
import * as DropZone from 'react-dropzone'

import { MediaTypeOptions, type DropZoneOptionsCustom } from '../types'

export function useDropZone(options: DropZoneOptionsCustom) {
  const accept = options.mediaTypes?.includes(MediaTypeOptions.All)
    ? undefined
    : options.mediaTypes
        ?.map((mediaType) => mimTypes[mediaType])
        .reduce((a, b) => ({ ...a, ...b }))

  return DropZone.useDropzone({ ...options, accept })
}

const mimTypes = {
  Images: {
    'image/*': [],
  },
  Videos: {
    'video/*': [],
  },
  Audios: {
    'audio/*': [],
  },
  All: {},
}

```

### Core Architecture Module: `code/bento/src/elements/pickers/hooks/useFilePicker.native.tsx`
```
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import type { DropzoneInputProps, DropzoneRootProps } from 'react-dropzone'
import { useEvent } from 'tamagui'

import { useDropZone } from './useDropZone'

export type MediaTypeOptions = 'All' | 'Videos' | 'Images' | 'Audios'
export type UseFilePickerControl = {
  open: () => void
  getInputProps: <T extends DropzoneInputProps>(props?: T | undefined) => T
  getRootProps: <T extends DropzoneRootProps>(props?: T | undefined) => T
  dragStatus?: {
    isDragAccept: boolean
    isDragActive: boolean
    isDragReject: boolean
  }
  typeOfPicker: 'file' | 'image'
}

type NativeFiles<MT extends MediaTypeOptions[]> = MT[number] extends 'Images'
  ? ImagePicker.ImagePickerResult['assets']
  : DocumentPicker.DocumentPickerResult[]
export type OnPickType<MT extends MediaTypeOptions[]> = (param: {
  webFiles: File[] | null
  nativeFiles: NativeFiles<MT> | null
}) => void | Promise<void>
type UseFilePickerProps<MT extends MediaTypeOptions> = {
  mediaTypes: MT[]
  onPick: OnPickType<MT[]>
  /** multiple only works for image only types on native, but on web it works regarding the media types */
  multiple: boolean
  typeOfPicker: 'file' | 'image'
}

export function useFilePicker<MT extends MediaTypeOptions>(
  props?: UseFilePickerProps<MT>
) {
  const { mediaTypes, onPick, typeOfPicker, ...rest } = props || {}

  const _onOpenNative = useEvent((nativeFiles) => {
    if (onPick) {
      onPick({ webFiles: null, nativeFiles })
    }
  })

  const { open, getInputProps, getRootProps, isDragAccept, isDragActive, isDragReject } =
    useDropZone({
      onOpen: _onOpenNative,
      // @ts-ignore
      mediaTypes,
      noClick: true,
      ...rest,
    })

  const _handleOpenNative = async () => {
    // No permissions request is necessary for launching the image or document library
    if (typeOfPicker === 'image') {
      let result = await ImagePicker.launchImageLibraryAsync({
        quality: 1,
        allowsMultipleSelection: true,
      })
      _onOpenNative(result.assets)
    } else {
      let result = await DocumentPicker.getDocumentAsync()
      _onOpenNative(result.assets)
    }
  }

  const control = {
    dragStatus: {
      isDragAccept,
      isDragActive,
      isDragReject,
    },
    getInputProps: () => null,
    getRootProps: () => null,
    open: _handleOpenNative,
  }

  return { control, ...control }
}

```

### Core Architecture Module: `code/bento/src/elements/pickers/hooks/useFilePicker.tsx`
```
import type * as DocumentPicker from 'expo-document-picker'
import type * as ImagePicker from 'expo-image-picker/src/ImagePicker'
import type { DropzoneInputProps, DropzoneRootProps } from 'react-dropzone'
import { useEvent } from 'tamagui'

import { useDropZone } from './useDropZone'

export type MediaTypeOptions = 'All' | 'Videos' | 'Images' | 'Audios'
export type UseFilePickerControl = {
  open: () => void
  getInputProps: <T extends DropzoneInputProps>(props?: T | undefined) => T
  getRootProps: <T extends DropzoneRootProps>(props?: T | undefined) => T
  dragStatus?: {
    isDragAccept: boolean
    isDragActive: boolean
    isDragReject: boolean
  }
}

type NativeFiles<MT extends MediaTypeOptions[]> = MT[number] extends 'Images'
  ? ImagePicker.ImagePickerResult['assets']
  : DocumentPicker.DocumentPickerResult[]

export type OnPickType<MT extends MediaTypeOptions[]> = (param: {
  webFiles: File[] | null
  nativeFiles: NativeFiles<MT> | null
}) => void | Promise<void>
type UseFilePickerProps<MT extends MediaTypeOptions> = {
  mediaTypes: MT[]
  onPick: OnPickType<MT[]>
  /** multiple only works for image only types on native, but on web it works regarding the media types */
  multiple: boolean
  typeOfPicker: 'file' | 'image'
}

export function useFilePicker<MT extends MediaTypeOptions>(
  props?: UseFilePickerProps<MT>
) {
  const { mediaTypes, onPick, ...rest } = props || {}

  const _onDrop = useEvent((webFiles) => {
    if (onPick) {
      onPick({ webFiles, nativeFiles: null })
    }
  })

  const onOpen = useEvent((nativeFiles) => {
    if (onPick) {
      onPick({ webFiles: null, nativeFiles })
    }
  })

  const { open, getInputProps, getRootProps, isDragAccept, isDragActive, isDragReject } =
    useDropZone({
      // this is web only, it triggers both on drop and open
      onDrop: _onDrop,
      // this is native only
      onOpen,
      // @ts-ignore
      mediaTypes,
      noClick: true,
      ...rest,
    })

  const control = {
    open,
    getInputProps,
    getRootProps,
    dragStatus: {
      isDragAccept,
      isDragActive,
      isDragReject,
    },
  }

  return { control, ...control }
}

```

### Core Architecture Module: `code/bento/src/forms/inputs/hooks/useForwardFocus.tsx`
```
import type { RefObject } from 'react'
import { useEffect, useState } from 'react'
import type { TamaguiElement } from 'tamagui'

/** focus target element when trigger element is focused */
export const useForwardFocus = (target: RefObject<TamaguiElement | null>) => {
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (focused && target.current) {
      target.current.focus()
    }
  }, [focused])
  /** apply this object on focus trigger element */
  return {
    onFocus: () => {
      setFocused(true)
    },
    onBlur: () => {
      setFocused(false)
    },
    tabIndex: 0,
  }
}

```

### Core Architecture Module: `code/bento/src/forms/layouts/SignupValidatedHookForm.tsx`
```
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Info } from '../../icons'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { SafeAreaView } from 'react-native'
import { AnimatePresence, Button, H1, isWeb, Spinner, View } from 'tamagui'
import { z } from 'zod'
import { Input } from '../inputs/components/inputsParts'
import { useGroupMedia } from '../../hooks/useGroupMedia'
import { FormCard } from './components/layoutParts'
import { RadioGroup } from '../radiogroups/components/radioParts'

const schema = z
  .object({
    firstName: z.string().min(1, { message: 'First name is required' }),
    lastName: z.string().min(1, { message: 'Last name is required' }),
    email: z.string().email({ message: 'Invalid email format' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmedPassword: z
      .string()
      .min(6, { message: 'Confirm password must be at least 6 characters' }),
    postalCode: z.string().min(4, {
      message: 'Invalid postal code format',
    }),
    accountType: z.string().min(1, { message: 'Account type is required' }),
  })
  .refine((data) => data.password === data.confirmedPassword, {
    message: 'Passwords do not match',
    path: ['confirmedPassword'],
  })

export function SignupValidatedHookForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { 'max-sm': narrow } = useGroupMedia('window')

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmedPassword: '',
      postalCode: '',
      accountType: 'business',
    },
  })
  const onSubmit = (data: z.infer<typeof schema>) => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
    }, 2000)
  }

  return (
    <FormCard
      flexDirection="column"
      gap="5"
      px="@max-md/window:4"
      py="@max-md/window:6"
      render="form"
    >
      <H1 self="center" size={narrow ? '6' : '7'}>
        Create an account
      </H1>

      <View gap="5">
        <View
          flexWrap="wrap"
          flexDirection="row"
          justify="space-between"
          columnGap="4"
          rowGap="5"
        >
          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                {...(errors.firstName && {
                  theme: 'red',
                })}
                flex={1}
                minW="100% @md/window:inherit"
                flexBasis="@md/window:150px"
                onBlur={onBlur}
                style={{ transition: 'border-color 100ms ease' }}
              >
                <Input.Label>First Name</Input.Label>
                <Input.Box>
                  <Input.Area
                    placeholder="First name"
                    onChangeText={onChange}
                    value={value}
                  />
                </Input.Box>
                <AnimatePresence>
                  {errors.firstName && (
                    <View
                      b="-5"
                      l={0}
                      position="absolute"
                      gap="2"
                      flexDirection="row"
                      scaleY="1 enter:0.5 exit:0.5"
                      opacity="enter:0 exit:0"
                      y="enter:-10px exit:-10px"
                      style={{ transition: 'transform 250ms ease' }}
                    >
                      <Input.Icon p={0}>
                        <Info />
                      </Input.Icon>
                      <Input.Info>{errors.firstName.message}</Input.Info>
                    </View>
                  )}
                </AnimatePresence>
              </Input>
            )}
          />
          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                {...(errors.lastName && {
                  theme: 'red',
                })}
                flex={1}
                minW="100% @md/window:inherit"
                flexBasis="@md/window:150px"
                onBlur={onBlur}
                style={{ transition: 'border-color 100ms ease' }}
              >
                <Input.Label>Last Name</Input.Label>
                <Input.Box>
                  <Input.Area
                    placeholder="Last name"
                    onChangeText={onChange}
                    value={value}
                  />
                </Input.Box>
                <AnimatePresence>
                  {errors.lastName && (
                    <View
                      b="5"
                      l={0}
                      position="absolute"
                      gap="2"
                      flexDirection="row"
                      scaleY="1 enter:0.5 exit:0.5"
                      opacity="enter:0 exit:0"
                      y="enter:-10px exit:-10px"
                      style={{ transition: 'transform 250ms ease' }}
                    >
                      <Input.Icon p={0}>
                        <Info />
                      </Input.Icon>
                      <Input.Info>{errors.lastName.message}</Input.Info>
                    </View>
                  )}
                </AnimatePresence>
              </Input>
            )}
          />
        </View>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              {...(errors.email && {
                theme: 'red',
              })}
              onBlur={onBlur}
            >
              <Input.Label>Email</Input.Label>
              <Input.Box>
                <Input.Area
                  placeholder="email@example.com"
                  onChangeText={onChange}
                  value={value}
                />
              </Input.Box>
              <AnimatePresence>
                {errors.email && (
                  <View
                    b="5"
                    l={0}
                    position="absolute"
                    gap="2"
                    flexDirection="row"
                    scaleY="1 enter:0.5 exit:0.5"
                    opacity="enter:0 exit:0"
                    y="enter:-10px exit:-10px"
                    style={{ transition: 'transform 250ms ease' }}
                  >
                    <Input.Icon p={0}>
                      <Info />
                    </Input.Icon>
                    <Input.Info>{errors.email.message}</Input.Info>
                  </View>
                )}
              </AnimatePresence>
            </Input>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              {...(errors.password && {
                theme: 'red',
              })}
              onBlur={onBlur}
            >
              <Input.Label htmlFor={'password-t1'}>Password</Input.Label>
              <Input.Box>
                <Input.Area
                  id={'password-t1'}
                  secureTextEntry={!showPassword}
                  placeholder="Enter password"
                  onChangeText={onChange}
                  value={value}
                />
                <Input.Icon
                  cursor="pointer"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <Eye color="color-10" /> : <EyeOff color="color-10" />}
                </Input.Icon>
              </Input.Box>
              <AnimatePresence>
                {errors.password && (
                  <View
                    b="5"
                    l={0}
                    position="absolute"
                    gap="2"
                    flexDirection="row"
                    scaleY="1 enter:0.5 exit:0.5"
                    opacity="enter:0 exit:0"
                    y="enter:-10px exit:-10px"
                    style={{ transition: 'transform 250ms ease' }}
                  >
                    <Input.Icon p={0}>
                      <Info />
                    </Input.Icon>
                    <Input.Info>{errors.password.message}</Input.Info>
                  </View>
                )}
              </AnimatePresence>
            </Input>
          )}
        />

        <Controller
          control={control}
          name="confirmedPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              {...(errors.confirmedPassword && {
                theme: 'red',
              })}
              onBlur={onBlur}
            >
              <Input.Label htmlFor={'confirmed password'}>Confirm Password</Input.Label>
              <Input.Box>
                <Input.Area
                  id={'confirmed password'}
                  secureTextEntry={!showConfirmPassword}
                  placeholder="Confirm password"
                  onChangeText={onChange}
                  value={value}
                />
                <Input.Icon
                  cursor="pointer"
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <Eye color="color-10" />
                  ) : (
                    <EyeOff color="color-10" />
                  )}
                </Input.Icon>
              </Input.Box>
              <AnimatePresence>
                {errors.confirmedPassword && (
                  <View
                    b="-5"
                    l={0}

```

### Core Architecture Module: `code/bento/src/hooks/useContainerDim.native.tsx`
```
import { useWindowDimensions } from 'tamagui'
import type { Dim } from './useContainerDim'

export const useContainerDim = (name: string): Dim => {
  const { width, height } = useWindowDimensions()

  return { width, height }
}

```

### Core Architecture Module: `code/bento/src/hooks/useContainerDim.tsx`
```
import { GroupContext, debounce } from 'tamagui'
import { useContext, useEffect, useRef, useState } from 'react'
import { mergeIfNotShallowEqual } from '@tamagui/web'
import { usePhoneScale } from './usePhoneScale'

export type Dim = {
  width: number
  height: number
}

export const useContainerDim = (name: string): Dim => {
  const groupsConext = useContext(GroupContext)
  const groups = groupsConext?.[name]
  const { scale } = usePhoneScale()
  const psuedo = groups?.state?.pseudo
  if (!psuedo) {
    throw new Error(`useContainerDim: No parent group '${name}' found.`)
  }

  const mediaGroups = useRef<Set<string>>(new Set())

  const [dim, setDim] = useState<Dim>({ width: 0, height: 0 })

  const setDimDebounced = debounce(setDim, 50)

  useEffect(() => {
    const currentDim = {}
    return groups.subscribe(({ layout }) => {
      if (layout) {
        const next = mergeIfNotShallowEqual(currentDim, {
          width: layout.width + layout.width * (1 - scale),
          height: layout.height + layout.height * (1 - scale),
        })
        if (next !== currentDim) {
          Object.assign(currentDim, next)
          setDimDebounced({ ...(currentDim as any) })
        }
      }
    })
  }, [name])

  return new Proxy(dim!, {
    get(target, prop) {
      mediaGroups.current?.add(prop as string)
      return target[prop]
    },
  })
}

```

### Core Architecture Module: `code/bento/src/hooks/useGroupMedia.native.tsx`
```
import type { UseMediaState } from '@tamagui/web'
import { useMedia } from 'tamagui'

export const useGroupMedia = (name: string): UseMediaState => {
  const allMedia = useMedia()

  return allMedia
}

```

### Core Architecture Module: `code/bento/src/hooks/useGroupMedia.tsx`
```
import type { UseMediaState, WidthHeight } from '@tamagui/web'
import { GroupContext, mediaKeyMatch, mergeIfNotShallowEqual } from '@tamagui/web'
import { useContext, useEffect, useRef, useState } from 'react'

export const useGroupMedia = (name: string): UseMediaState => {
  const groupsConext = useContext(GroupContext)
  const groups = groupsConext?.[name]
  const psuedo = groups?.state?.pseudo

  if (!psuedo) {
    throw new Error(`useGroupMedia: No parent group '${name}' found.`)
  }

  const mediaGroups = useRef<Set<string>>(new Set())

  const [finalState, setMediaState] = useState<UseMediaState>({} as any)

  useEffect(() => {
    const currentMedia = {}
    const apply = (layout?: WidthHeight) => {
      if (layout && mediaGroups) {
        const mediaState = getMediaState(mediaGroups.current, layout)
        const next = mergeIfNotShallowEqual(currentMedia, mediaState)
        if (next !== currentMedia) {
          Object.assign(currentMedia, next)
          setMediaState({ ...(currentMedia as any) })
        }
      }
    }
    // groups that already measured before we mounted never re-emit — read the
    // stored layout once so initial render matches (fixes first-paint state)
    apply((groups.state as any).layout)
    return groups.subscribe(({ layout }) => apply(layout))
  }, [name, setMediaState])

  return new Proxy(finalState!, {
    get(target, prop) {
      mediaGroups.current?.add(prop as string)
      return target[prop]
    },
  })
}

function getMediaState(mediaGroups: Set<string>, layout: WidthHeight) {
  return Object.fromEntries(
    [...mediaGroups].map((mediaKey) => {
      return [mediaKey, mediaKeyMatch(mediaKey, layout as any)]
    })
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3426** (2025-05-25): **Docs - menu button does not work on mobile**
  *Symptoms*: ### Current Behavior  When pressing the hamburger/menu button , no menu is displayed.  ### Expected Behavior  A menu with contents is displayed.  ### Tamagui Version  ```markdown Na?  Unless docs is made with Tamagui ```  ### Platform (Web, iOS, Android)  ```markdown Na? ```  ### Reproduction  ```markdown 1. On an iOS device navigate to https://tamagui.dev/docs/intro/introduction 2. Press the menu button   Device: iPhone 15+ iOS version: 18.4.1 Browser: Safari, Edge ```  ### System Info  ```markdown  ```
  **Post-Mortem & Fix Analysis**:
  > @krcourville Thank your feedback. I will take a look in this PR: https://github.com/tamagui/tamagui/pull/3430

- **Issue #2580** (2024-04-30): **Switch & Switch.Thumb Animation Bug on React Native**
  *Symptoms*: ### Current Behavior  When we try to use animation property on Switch component it does not apply to thumb slide action. Using animation property on Slide.Thumb provides a smooth animation and experience with the Switch. But this breaks the checked behavior of the Switch component and thumb always stays in the left on load. Also if the checked value is true by initial, it slips and goes of the Switch area. (Both checked and defaultChecked has same behavior.)  Basic Usage with animation property: (while checked switch bg is red) ![switch1](https://github.com/tamagui/tamagui/assets/52458408/340073f4-6bc9-4019-a550-55d1103c3a51)  Behavior video with animation property: (when checked property is true from any state or storage while Switch.Thumb animation property is set. Switch on the top is default false and bottom is true and first of all red screen means i refreshed the app.) https://github.com/tamagui/tamagui/assets/52458408/e28e7033-7039-4166-ae01-d81d8b85f0c1   Usage without animation property: Then when i remove the animation property from Switch.Thumb (also loses smooth animation 😢) ![switch2](https://github.com/tamagui/tamagui/assets/52458408/a1918b0e-9b95-426d-a292-87d3438dbd60)  Behavior video without animation property: https://github.com/tamagui/tamagui/assets/52458408/2662192d-310c-4ba1-bd84-be5f698a00a6     ### Expected Behavior  I should able to use animation on Switch.Thumb without any issue or Switch animation should pass to Switch.Thu
  **Post-Mortem & Fix Analysis**:
  > there is a fix for this issue on the master branch, which will be available with the next tamagui release

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

### Incident Patch 1: `83346424` (2026-10-23)
**Commit Message**: fix(static): evaluate native colors through React Native Lite

Validation: Lite and static package builds pass; 15 existing native/web configuration and extraction checks pass with Babel imports blocked, including macOS. Native color CJS/ESM probes pass with Babel blocked and no installed React Native project. Root lint passes. Root check reaches the same eight pre-existing shorthand declaration errors; unrelated generated declarations remain unstaged.

**File**: `bun.lock` (modified, +0/-2)
```diff
@@ -170,8 +170,6 @@
       "name": "@tamagui/static",
       "version": "3.1.3",
       "dependencies": {
-        "@babel/core": "^7.25.2",
-        "@react-native/babel-preset": "0.88.0",
         "@tamagui/animation-helpers": "workspace:*",
         "@tamagui/cli-color": "workspace:*",
         "@tamagui/compiler-core": "workspace:*",
```

**File**: `code/compiler/static/package.json` (modified, +0/-2)
```diff
@@ -51,8 +51,6 @@
     "clean:build": "tamagui-build clean:build"
   },
   "dependencies": {
-    "@babel/core": "^7.25.2",
-    "@react-native/babel-preset": "0.88.0",
     "@tamagui/animation-helpers": "workspace:*",
     "@tamagui/cli-color": "workspace:*",
     "@tamagui/compiler-core": "workspace:*",
```

**File**: `code/compiler/static/src/nativeColors.ts` (modified, +5/-39)
```diff
@@ -1,50 +1,16 @@
 import { createRequire } from 'node:module'
-import { dirname, join } from 'node:path'
+import { getNativeColorFactories as nativeColorFactories } from '@tamagui/react-native-web-lite/nativeColors'
 
 const staticRequire = createRequire(
   typeof __filename === 'string' ? __filename : import.meta.url
 )
-const createNativeModuleLoader = staticRequire(
-  '@tamagui/fake-react-native/loadNativeModule'
-)
-const cache = new Map<string, NativeColorFactories>()
-
-type NativeColorFactories = {
-  PlatformColor: (...names: string[]) => unknown
-  DynamicColorIOS: (colors: Record<string, unknown>) => unknown
-}
 
-// use the consumer's factories, including its react native patches. the opaque
-// values belong to react native; the compiler must not reimplement their shape.
+// keep the existing compiler export while the native factories belong to lite.
 export function getNativeColorFactories(
-  projectRoot: string,
+  _projectRoot: string,
   platform = process.env.EXPO_OS || 'ios'
-): NativeColorFactories {
-  const projectRequire = createRequire(join(projectRoot, 'package.json'))
-  const root = dirname(projectRequire.resolve('react-native/package.json'))
-  const key = `${root}:${platform}`
-  const cached = cache.get(key)
-  if (cached) return cached
-  const load = createNativeModuleLoader(staticRequire)
-  const stylesheet = join(root, 'Libraries/StyleSheet')
-  const factories = {
-    PlatformColor: load(
-      join(
-        stylesheet,
-        `PlatformColorValueTypes.${platform === 'android' ? 'android' : 'ios'}.js`
-      )
-    ).PlatformColor,
-    DynamicColorIOS: load(
-      join(
-        stylesheet,
-        platform === 'android'
-          ? 'PlatformColorValueTypesIOS.js'
-          : 'PlatformColorValueTypesIOS.ios.js'
-      )
-    ).DynamicColorIOS,
-  }
-  cache.set(key, factories)
-  return factories
+) {
+  return nativeColorFactories(platform)
 }
 
 // absolute entry for generated evaluation code, so it never resolves from the consumer.
```

**File**: `code/compiler/static/types/nativeColors.d.ts` (modified, +5/-5)
```diff
@@ -1,8 +1,8 @@
-type NativeColorFactories = {
-    PlatformColor: (...names: string[]) => unknown;
-    DynamicColorIOS: (colors: Record<string, unknown>) => unknown;
+export declare function getNativeColorFactories(_projectRoot: string, platform?: string): {
+    PlatformColor(...args: Array<string | {
+        fallback: string;
+    }>): unknown;
+    DynamicColorIOS(colors: Record<string, unknown>): unknown;
 };
-export declare function getNativeColorFactories(projectRoot: string, platform?: string): NativeColorFactories;
 export declare const nativeColorsModulePath: string;
-export {};
 //# sourceMappingURL=nativeColors.d.ts.map
\ No newline at end of file
```

**File**: `code/compiler/vite-plugin/test/loadTamagui.test.ts` (modified, +1/-1)
```diff
@@ -478,7 +478,7 @@ test('clears loader state when closing an owned environment fails', async () =>
   expect(loader.getTamaguiOptions()).toBeNull()
 })
 
-test.each(['ios', 'android'] as const)(
+test.each(['ios', 'android', 'macos'] as const)(
   'evaluates %s theme factories before web aliases with extraction enabled',
   async (nativePlatform) => {
     const configPath = path.join(watchOutputRoot, 'native-colors.config.ts')
```

**File**: `code/packages/fake-react-native/loadNativeModule.js` (removed, +0/-40)
```diff
@@ -1,40 +0,0 @@
-const { readFileSync } = require('node:fs')
-const { dirname, resolve } = require('node:path')
-const Module = require('node:module')
-
-// evaluate installed react native modules without loading their native bindings.
-// babel resolves through ownerRequire, the package that declares it as a dependency.
-module.exports = function createNativeModuleLoader(ownerRequire, bindings = new Map()) {
-  const { transformSync } = ownerRequire('@babel/core')
-  const preset = ownerRequire.resolve('@react-native/babel-preset')
-  const cache = new Map()
-  function load(filename) {
-    if (bindings.has(filename)) return bindings.get(filename)
-    if (cache.has(filename)) return cache.get(filename).exports
-    const compiled = new Module(filename, module)
-    compiled.paths = Module._nodeModulePaths(dirname(filename))
-    compiled.require = (request) => {
-      if (request.startsWith('.')) {
-        const path = resolve(dirname(filename), request)
-        return load(path.endsWith('.js') ? path : path + '.js')
-      }
-      return Module.prototype.require.call(compiled, request)
-    }
-    cache.set(filename, compiled)
-    const output = transformSync(readFileSync(filename, 'utf8'), {
-      filename,
-      babelrc: false,
-      configFile: false,
-      presets: [[preset, { enableBabelRuntime: false }]],
-    })
-    Function(
-      'require',
-      'module',
-      'exports',
-      '__DEV__',
-      output.code
-    )(compiled.require, compiled, compiled.exports, process.env.NODE_ENV !== 'production')
-    return compiled.exports
-  }
-  return load
-}
```

**File**: `code/packages/fake-react-native/package.json` (modified, +0/-1)
```diff
@@ -13,7 +13,6 @@
       "require": "./index.js"
     },
     "./pressability": "./pressability.js",
-    "./loadNativeModule": "./loadNativeModule.js",
     "./styleAttributes": "./styleAttributes.js",
     "./pressEvent": {
       "types": "./pressEvent.d.ts",
```

**File**: `code/packages/fake-react-native/pressability.js` (modified, +35/-3)
```diff
@@ -1,5 +1,7 @@
-const { dirname, join } = require('node:path')
-const createNativeModuleLoader = require('./loadNativeModule')
+const { readFileSync } = require('node:fs')
+const { dirname, join, resolve } = require('node:path')
+const Module = require('node:module')
+const { transformSync } = require('@babel/core')
 
 // run react native's actual press state machine in native tests. only the
 // platform bindings are mocked; geometry, timers and cancellation stay real.
@@ -25,6 +27,36 @@ const bindings = new Map([
     },
   ],
 ])
-const load = createNativeModuleLoader(require, bindings)
+const cache = new Map()
+
+function load(filename) {
+  if (bindings.has(filename)) return bindings.get(filename)
+  if (cache.has(filename)) return cache.get(filename).exports
+  const compiled = new Module(filename, module)
+  compiled.paths = Module._nodeModulePaths(dirname(filename))
+  compiled.require = (request) => {
+    if (request.startsWith('.')) {
+      const path = resolve(dirname(filename), request)
+      return load(path.endsWith('.js') ? path : path + '.js')
+    }
+    return Module.prototype.require.call(compiled, request)
+  }
+  cache.set(filename, compiled)
+  const output = transformSync(readFileSync(filename, 'utf8'), {
+    filename,
+    babelrc: false,
+    configFile: false,
+    presets: [
+      [require.resolve('@react-native/babel-preset'), { enableBabelRuntime: false }],
+    ],
+  })
+  Function(
+    'require',
+    'module',
+    'exports',
+    output.code
+  )(compiled.require, compiled, compiled.exports)
+  return compiled.exports
+}
 
 module.exports = load(join(root, 'Libraries/Pressability/usePressability.js')).default
```

---

### Incident Patch 2: `69dd68c0` (2026-10-23)
**Commit Message**: fix(native): support opaque theme inputs and native config evaluation

Validation: built @tamagui/web, @tamagui/core, @tamagui/static and @tamagui/vite-plugin; 14 Vite loader tests passed; native extraction with real RN color factories passed on iOS and Android; native core suite passed 525 tests; installed consumer RN0.87 factories verified for macOS and Android; root lint passed. Root check passed through web-types/LSP and failed shorthand-declarations on 8 existing ScrollView/Sheet declaration errors, reproduced with HEAD web types. Preserved 12 pre-existing generated declaration edits outside this commit. Actual Mac application proof and independent review remain with the lead.

**File**: `code/compiler/static/src/extractor/bundle.ts` (modified, +26/-0)
```diff
@@ -57,13 +57,15 @@ type Props = Omit<Partial<esbuild.BuildOptions>, 'entryPoints'> & {
   entryPoints: string[]
   resolvePlatformSpecificEntries?: boolean
   dangerouslyIgnoreStaticEvaluationModules?: string[]
+  nativePlatform?: 'ios' | 'android' | 'macos'
 }
 
 function getESBuildConfig(
   {
     entryPoints,
     resolvePlatformSpecificEntries,
     dangerouslyIgnoreStaticEvaluationModules = [],
+    nativePlatform,
     define: callerDefine,
     conditions: callerConditions = [],
     ...options
@@ -216,6 +218,30 @@ function getESBuildConfig(
       {
         name: 'external',
         setup(build) {
+          if (platform === 'native') {
+            build.onResolve({ filter: /^react-native$/ }, () => ({
+              path: 'react-native',
+              namespace: 'tamagui-native-evaluation',
+            }))
+            build.onLoad(
+              { filter: /.*/, namespace: 'tamagui-native-evaluation' },
+              () => ({
+                contents: `export * from '@tamagui/react-native-web-lite'
+import { getNativeColorFactories } from '@tamagui/fake-react-native/nativeColors'
+const colors = getNativeColorFactories(${JSON.stringify(build.initialOptions.absWorkingDir || process.cwd())}, ${JSON.stringify(nativePlatform)})
+export const { PlatformColor, DynamicColorIOS } = colors`,
+                loader: 'js',
+                resolveDir: build.initialOptions.absWorkingDir || process.cwd(),
+              })
+            )
+            build.onResolve(
+              { filter: /^@tamagui\/fake-react-native\/nativeColors$/ },
+              (args) => ({
+                path: args.path,
+                external: true,
+              })
+            )
+          }
           // only externalize @tamagui/core and @tamagui/web - these are provided at runtime
           // other @tamagui/* packages (like @tamagui/config/v6) must be bundled in to avoid
           // ESM race conditions when multiple threads require() them concurrently
```

**File**: `code/compiler/static/src/extractor/bundleConfig.ts` (modified, +12/-1)
```diff
@@ -249,6 +249,7 @@ function getBundleKey(props: TamaguiOptions) {
     components: props.components,
     config: props.config,
     platform: props.platform,
+    nativePlatform: props.nativePlatform,
     dangerouslyIgnoreStaticEvaluationModules:
       props.dangerouslyIgnoreStaticEvaluationModules,
   })
@@ -402,7 +403,10 @@ export async function bundleConfig(props: TamaguiOptions, rebuild = false) {
     // so their contents are platform-specific. keep web and native on separate paths:
     // sharing one path let a native bundle be picked up as the web config (and vice
     // versa) by the mtime reuse check below, emitting web classes with no CSS variables.
-    const platformSuffix = (props.platform || 'web') === 'native' ? '.native' : '.web'
+    const platformSuffix =
+      props.platform === 'native'
+        ? `.native${props.nativePlatform ? `.${props.nativePlatform}` : ''}`
+        : '.web'
     // detect module format from config entry point
     const configFormat = configEntry ? detectModuleFormat(configEntry) : 'cjs'
     const configExt = configFormat === 'esm' ? '.mjs' : '.cjs'
@@ -489,6 +493,7 @@ export async function bundleConfig(props: TamaguiOptions, rebuild = false) {
                 metafile: true,
                 dangerouslyIgnoreStaticEvaluationModules:
                   props.dangerouslyIgnoreStaticEvaluationModules,
+                nativePlatform: props.nativePlatform,
                 ...esbuildExtraOptions,
               },
               props.platform || 'web'
@@ -512,6 +517,7 @@ export async function bundleConfig(props: TamaguiOptions, rebuild = false) {
               metafile: true,
               dangerouslyIgnoreStaticEvaluationModules:
                 props.dangerouslyIgnoreStaticEvaluationModules,
+              nativePlatform: props.nativePlatform,
               ...esbuildExtraOptions,
             },
             props.platform || 'web'
@@ -763,6 +769,7 @@ export async function evaluateComponentModule(
   process.env.TAMAGUI_IS_SERVER = 'true'
   const { unregister } = registerRequire(props.platform || 'web', {
     ignoredModules: props.dangerouslyIgnoreStaticEvaluationModules,
+    nativePlatform: props.nativePlatform,
   })
   try {
     try {
@@ -814,6 +821,7 @@ export async function loadComponentsInner(
 
   const key = JSON.stringify([
     props.platform,
+    props.nativePlatform,
     componentsModules,
     props.dangerouslyIgnoreStaticEvaluationModules,
   ])
@@ -824,6 +832,7 @@ export async function loadComponentsInner(
 
   const { unregister } = registerRequire(props.platform || 'web', {
     ignoredModules: props.dangerouslyIgnoreStaticEvaluationModules,
+    nativePlatform: props.nativePlatform,
   })
 
   try {
@@ -974,6 +983,7 @@ export function loadComponentsInnerSync(
 
   const key = JSON.stringify([
     props.platform,
+    props.nativePlatform,
     componentsModules,
     props.dangerouslyIgnoreStaticEvaluationModules,
   ])
@@ -984,6 +994,7 @@ export function loadComponentsInnerSync(
 
   const { unregister } = registerRequire(props.platform || 'web', {
     ignoredModules: props.dangerouslyIgnoreStaticEvaluationModules,
+    nativePlatform: props.nativePlatform,
   })
 
   try {
```

**File**: `code/compiler/static/src/extractor/loadTamagui.ts` (modified, +1/-0)
```diff
@@ -374,6 +374,7 @@ export function loadTamaguiSync({
 
   const { unregister } = registerRequire(props.platform || 'web', {
     ignoredModules: props.dangerouslyIgnoreStaticEvaluationModules,
+    nativePlatform: props.nativePlatform,
   })
 
   try {
```

**File**: `code/compiler/static/src/registerRequire.ts` (modified, +17/-1)
```diff
@@ -106,7 +106,13 @@ function getStaticExtractionStub(path: string) {
 
 export function registerRequire(
   platform: TamaguiPlatform,
-  { ignoredModules = [] }: { ignoredModules?: string[] } = {
+  {
+    ignoredModules = [],
+    nativePlatform,
+  }: {
+    ignoredModules?: string[]
+    nativePlatform?: 'ios' | 'android' | 'macos'
+  } = {
     ignoredModules: [],
   }
 ) {
@@ -216,6 +222,16 @@ export function registerRequire(
       return og.apply(this, ['react-native-web/package.json'])
     }
 
+    if (platform === 'native' && path === 'react-native') {
+      const { getNativeColorFactories } = og.apply(this, [
+        '@tamagui/fake-react-native/nativeColors',
+      ])
+      return {
+        ...og.apply(this, ['@tamagui/react-native-web-lite']),
+        ...getNativeColorFactories(dirname(this.filename), nativePlatform),
+      }
+    }
+
     if (
       path === '@tamagui/react-native-web-lite' ||
       path === 'react-native' ||
```

**File**: `code/compiler/static/types/extractor/bundle.d.ts` (modified, +1/-0)
```diff
@@ -34,6 +34,7 @@ type Props = Omit<Partial<esbuild.BuildOptions>, 'entryPoints'> & {
     entryPoints: string[];
     resolvePlatformSpecificEntries?: boolean;
     dangerouslyIgnoreStaticEvaluationModules?: string[];
+    nativePlatform?: 'ios' | 'android' | 'macos';
 };
 export declare function esbundleTamaguiConfig(props: Props, platform: TamaguiPlatform, aliases?: Record<string, string>): Promise<esbuild.BuildResult<{
     sourcemap?: boolean | 'linked' | 'inline' | 'external' | 'both';
```

**File**: `code/compiler/static/types/registerRequire.d.ts` (modified, +2/-1)
```diff
@@ -1,8 +1,9 @@
 import type { TamaguiPlatform } from './types';
 export declare const getNameToPaths: () => {};
 export declare function setRequireResult(name: string, result: any): void;
-export declare function registerRequire(platform: TamaguiPlatform, { ignoredModules }?: {
+export declare function registerRequire(platform: TamaguiPlatform, { ignoredModules, nativePlatform, }?: {
     ignoredModules?: string[];
+    nativePlatform?: 'ios' | 'android' | 'macos';
 }): {
     tamaguiRequire: (this: any, path: string) => any;
     unregister: () => void;
```

**File**: `code/compiler/vite-plugin/src/loadTamagui.ts` (modified, +2/-2)
```diff
@@ -126,7 +126,7 @@ export function createViteTamaguiLoader(
     if (loadPromise) return loadPromise
 
     const pending = Static.loadTamaguiBuildConfigAsync(
-      { ...optionsIn, platform: 'web' },
+      { platform: 'web', ...optionsIn },
       viteBuildConfigLoader
     ).then(
       (options) => {
@@ -246,7 +246,7 @@ export function createViteTamaguiLoader(
       let evaluated: EvaluatedProjectModules | null = null
       return Static.loadCompilerProject({
         root: environment.config.root,
-        target: 'web',
+        target: options.platform || 'web',
         options,
         generation: `vite:${projectGeneration}`,
         hostVersions: vitePluginVersions,
```

**File**: `code/compiler/vite-plugin/src/plugin.ts` (modified, +78/-6)
```diff
@@ -329,6 +329,11 @@ function createServeEvaluationConfig(
     }
     return []
   })
+  if (environment.define?.['process.env.TAMAGUI_TARGET'] === '"native"') {
+    plugins.unshift(
+      createNativeEvaluationPlugin(config.root, environment.define['process.env.EXPO_OS'])
+    )
+  }
   const resolve = getEvaluationResolve(
     environment.resolve,
     config.root,
@@ -359,6 +364,11 @@ async function createOwnedEvaluationConfig(
   const plugins = environment.plugins
     .filter(isEvaluationUserPlugin)
     .map((plugin) => createEvaluationPluginFacade(plugin))
+  if (environment.define?.['process.env.TAMAGUI_TARGET'] === '"native"') {
+    plugins.unshift(
+      createNativeEvaluationPlugin(config.root, environment.define['process.env.EXPO_OS'])
+    )
+  }
   const resolve = getEvaluationResolve(
     environment.resolve,
     config.root,
@@ -412,6 +422,50 @@ const _pluginRequire = createRequire(
 const resolve = (name: string) => _pluginRequire.resolve(name)
 const normalizePath = (value: string) => value.replace(/\\/g, '/')
 
+function createNativeEvaluationPlugin(root: string, nativePlatform?: string): Plugin {
+  const facadeId = '\0tamagui-native-evaluation'
+  const modules = new Map([
+    [facadeId, '@tamagui/react-native-web-lite'],
+    [`${facadeId}:core`, '@tamagui/core/native'],
+    [`${facadeId}:tamagui`, 'tamagui/native'],
+  ])
+  return {
+    name: 'tamagui-native-evaluation',
+    resolveId: {
+      order: 'pre',
+      handler(source) {
+        // run before the app's web aliases, only in the compiler environment.
+        if (source === 'react-native') return facadeId
+        if (source === '@tamagui/core' || source === '@tamagui/web') {
+          return `${facadeId}:core`
+        }
+        if (source === 'tamagui') {
+          return `${facadeId}:tamagui`
+        }
+      },
+    },
+    load(id) {
+      const moduleName = modules.get(id)
+      if (!moduleName) return
+      const modulePath = resolve(moduleName)
+      const colorPath = resolve('@tamagui/fake-react-native/nativeColors')
+      const names = Object.keys(_pluginRequire(modulePath)).filter(
+        (name) => name !== 'default' && name !== '__esModule'
+      )
+      const colors =
+        id === facadeId
+          ? `, ...require(${JSON.stringify(colorPath)}).getNativeColorFactories(${JSON.stringify(root)}, ${nativePlatform || 'undefined'})`
+          : ''
+      if (id === facadeId) names.push('PlatformColor', 'DynamicColorIOS')
+      return `import { createRequire } from 'node:module'
+const require = createRequire(${JSON.stringify(path.join(root, 'package.json'))})
+const rn = { ...require(${JSON.stringify(modulePath)})${colors} }
+export const { ${[...new Set(names)].join(', ')} } = rn
+export default rn`
+    },
+  }
+}
+
 const PLUGIN_INSTANCE_KEY = '__tamagui_vite_plugin_instance__'
 
 function reportCompilerStats(root: string, reports: Map<string, CompilerModuleReport>) {
@@ -594,7 +648,12 @@ function createTamaguiNativePlugin(
         { ...tamaguiOptionsIn, root, platform: 'native', outputCSS: undefined },
         viteBuildConfigLoader
       )
-      const options = { ...loadedOptions, root, outputCSS: undefined }
+      const options = {
+        ...loadedOptions,
+        root,
+        nativePlatform: nativeContext?.platform || loadedOptions.nativePlatform,
+        outputCSS: undefined,
+      }
       nativeOptions = options
       for (const dependency of Static.getTamaguiBuildConfigDependencies(loadedOptions)) {
         projectDependencies.add(normalizePath(dependency))
@@ -859,15 +918,18 @@ export function createTamaguiPlugins({
 
   const getEvaluationEnvironmentOptions = (
     resolvedRoot: string,
-    userNoExternal: EvaluationNoExternal
+    userNoExternal: EvaluationNoExternal,
+    platform: TamaguiOptions['platform'],
+    nativePlatform: TamaguiOptions['nativePlatform']
   ): EnvironmentOptions => ({
     consumer: 'server',
     keepProcessEnv: true,
     define: {
       'process.env.IS_STATIC': JSON.stringify('is_static'),
       'process.env.TAMAGUI_IS_CLIENT': JSON.stringify(false),
       'process.env.TAMAGUI_IS_SERVER': JSON.stringify(true),
-      'process.env.TAMAGUI_TARGET': JSON.stringify('web'),
+      'process.env.TAMAGUI_TARGET': JSON.stringify(platform || 'web'),
+      ...(nativePlatform && { 'process.env.EXPO_OS': JSON.stringify(nativePlatform) }),
       'process.env.TAMAGUI_ENVIRONMENT': JSON.stringify(TAMAGUI_EVALUATION_ENVIRONMENT),
       // Config evaluation must retain createTamagui and CSS generation even when
       // the client graph is zero or the client claims the artifact. Inheriting
@@ -888,7 +950,11 @@ export function createTamaguiPlugins({
       // to fail outright. A condition is the portable way to express this, since
       // every bundler integration can add the same one and an app configures
       // nothing.
-      conditions: [TAMAGUI_COMPILER_CONDITION, ...defaultClientConditions],
+      conditions: [
+        TAMAGUI
```

---

### Incident Patch 3: `16eca765` (2026-10-23)
**Commit Message**: fix(core): preserve opaque native theme colors

Validation: rebuilt web, core, and helpers-icon; regression fails 5 of 6 cases before the fix and passes all 6 after; built native icon probe passes 6; existing iOS suites pass 31; web compatibility probe and existing suites pass 78; root lint and check pass. Native tests use the React Native test adapter. Live Mac consumer acceptance remains with lead s69213.

**File**: `code/core/core-test/platformColors.native.test.tsx` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+import {
+  TamaguiProvider,
+  View,
+  createTamagui,
+  createVariable,
+  getVariable,
+  useTheme,
+  variableToString,
+} from '@tamagui/core'
+import { render } from '@testing-library/react-native'
+import { describe, expect, test } from 'vitest'
+import { getDefaultTamaguiConfig } from '../config-default'
+import { themed } from '../helpers-icon/src/themed'
+
+// these are the opaque shapes returned by react native's platform color factories.
+const semantic = { semantic: ['labelColor'] }
+const resource = { resource_paths: ['?attr/textColorPrimary'] }
+const dynamic = { dynamic: { light: '#111', dark: '#eee' } }
+
+const defaults = getDefaultTamaguiConfig('native')
+const config = createTamagui({
+  ...defaults,
+  themes: {
+    light: { ...defaults.themes.light, color: semantic as any },
+    dark: { ...defaults.themes.dark, color: semantic as any },
+  },
+})
+
+describe('native opaque theme colors', () => {
+  test.each([semantic, resource, dynamic])(
+    'preserves raw and wrapped colors: %j',
+    (color) => {
+      const variable = createVariable({ key: 'color', name: 'color', val: color as any })
+      expect(variableToString(color)).toBe(color)
+      expect(variableToString(variable)).toBe(color)
+      expect(variableToString(variable, true)).toBe(color)
+      expect(getVariable(color, 'color')).toBe(color)
+      expect(getVariable(variable, 'color')).toBe(color)
+    }
+  )
+
+  test('keeps numeric and empty value coercion', () => {
+    expect(variableToString(createVariable({ key: 'size', name: 'size', val: 12 }))).toBe(
+      '12'
+    )
+    expect(variableToString(12)).toBe('12')
+    expect(variableToString(0)).toBe('')
+    expect(variableToString(undefined)).toBe('')
+    expect(getVariable('red', 'color')).toBe('red')
+  })
+
+  test.each(['light', 'dark'] as const)(
+    'preserves theme getters and themed icon paints in %s',
+    (scheme) => {
+      let themeColor: unknown
+      let nativeThemeColor: unknown
+      let iconProps: any
+      const Icon = themed((props) => {
+        iconProps = props
+        return null
+      })
+      function Consumer() {
+        const theme = useTheme()
+        themeColor = theme.color.get('web')
+        nativeThemeColor = theme.color.get()
+        return (
+          <View backgroundColor="color">
+            <Icon fill="color" stroke="color" />
+          </View>
+        )
+      }
+      const tree = render(
+        <TamaguiProvider config={config} defaultTheme={scheme}>
+          <Consumer />
+        </TamaguiProvider>
+      )
+      try {
+        expect(themeColor).toBe(semantic)
+        expect(nativeThemeColor).toBe(semantic)
+        expect(tree.toJSON()).toMatchObject({
+          props: { style: { backgroundColor: semantic } },
+        })
+        expect(iconProps.color).toBe(semantic)
+        expect(iconProps.fill).toBe(semantic)
+        expect(iconProps.stroke).toBe(semantic)
+      } finally {
+        tree.unmount()
+      }
+    }
+  )
+})
```

**File**: `code/core/web/src/createVariable.ts` (modified, +14/-3)
```diff
@@ -57,7 +57,12 @@ export function variableToString(vrble?: any, getValue = false) {
     if (!getValue && isWeb && vrble.variable) {
       return vrble.variable
     }
-    return `${vrble.val}`
+    // native colors are opaque objects that must reach the renderer unchanged.
+    const value = vrble.val
+    return !isWeb && value && typeof value === 'object' ? value : `${value}`
+  }
+  if (!isWeb && vrble && typeof vrble === 'object') {
+    return vrble
   }
   return `${vrble || ''}`
 }
@@ -70,8 +75,14 @@ export function getVariable(
   nameOrVariable: Variable | string | any,
   group: TokenCategories = 'size'
 ) {
-  // dynamic color-like
-  if (nameOrVariable?.dynamic) {
+  // native opaque colors are values, not token names.
+  if (
+    nameOrVariable?.dynamic ||
+    (!isWeb &&
+      nameOrVariable &&
+      typeof nameOrVariable === 'object' &&
+      !isVariable(nameOrVariable))
+  ) {
     return nameOrVariable
   }
   setDidGetVariableValue(true)
```

**File**: `code/core/web/types/createVariable.d.ts` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import type { PxValue, TokenCategories, Variable } from './types';
 type VariableIn<A = any> = Pick<Variable<A>, 'key' | 'name' | 'val'>;
 export declare const createVariable: <A extends string | number | Variable = any>(props: VariableIn<A>, skipHash?: boolean) => Variable<A>;
-export declare function variableToString(vrble?: any, getValue?: boolean): string;
+export declare function variableToString(vrble?: any, getValue?: boolean): any;
 export declare function isVariable(v: Variable | any): v is Variable;
 export declare function getVariable(nameOrVariable: Variable | string | any, group?: TokenCategories): any;
 export declare const setDidGetVariableValue: (val: boolean) => boolean;
```

#### Recent Merged Pull Requests:
- **PR #4378** (2026-10-23): fix(core): preserve opaque native theme colors (@natew)
- **PR #4377** (2026-10-23): v3.1.3 (@natew)
- **PR #4376** (2026-10-23): fix(security): pin Next to patched 16.4.1 (@natew)
- **PR #4375** (2026-10-23): ci: align repository Bun selections on 1.4.4 (@natew)
- **PR #4374** (closed): v3.1.3 (@natew)
- **PR #4373** (2026-10-22): Avoid the slow Azure mirror during WebKit dependency setup (@natew)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
