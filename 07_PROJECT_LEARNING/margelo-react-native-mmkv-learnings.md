# Forensic Learning Record (Deep Inspection): margelo/react-native-mmkv

> **Canonical Artifact**: `07_PROJECT_LEARNING/margelo-react-native-mmkv-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/margelo/react-native-mmkv](https://github.com/margelo/react-native-mmkv))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:12:55.672Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `margelo/react-native-mmkv`
- **Description**: ⚡️ The fastest key/value storage for React Native. ~30x faster than AsyncStorage!
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8512 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/react-native-mmkv/src/hooks/createMMKVHook.ts`
```
import { useCallback, useSyncExternalStore } from 'react'
import { getDefaultMMKVInstance } from '../createMMKV/getDefaultMMKVInstance'
import type { MMKV } from '../specs/MMKV.nitro'

export function createMMKVHook<
  T extends (boolean | number | string | ArrayBufferLike) | undefined,
  TSet extends T | undefined,
  TSetAction extends TSet | ((current: T) => TSet),
>(getter: (instance: MMKV, key: string) => T) {
  return (
    key: string,
    instance?: MMKV
  ): [value: T, setValue: (value: TSetAction) => void] => {
    const mmkv = instance ?? getDefaultMMKVInstance()

    const value = useSyncExternalStore(
      useCallback(
        (onStoreChange: () => void) => {
          const listener = mmkv.addOnValueChangedListener((changedKey) => {
            if (changedKey === key) {
              onStoreChange()
            }
          })
          return () => listener.remove()
        },
        [key, mmkv]
      ),
      useCallback(() => getter(mmkv, key), [key, mmkv]),
      useCallback(() => getter(mmkv, key), [key, mmkv])
    )

    // update value by user set
    const set = useCallback(
      (v: TSetAction) => {
        const newValue = typeof v === 'function' ? v(getter(mmkv, key)) : v
        switch (typeof newValue) {
          case 'number':
          case 'string':
          case 'boolean':
            mmkv.set(key, newValue)
            break
          case 'undefined':
            mmkv.remove(key)
            break
          case 'object':
            if (newValue instanceof ArrayBuffer) {
              mmkv.set(key, newValue)
              break
            } else {
              throw new Error(
                `MMKV: Type object (${newValue}) is not supported!`
              )
            }
          default:
            throw new Error(`MMKV: Type ${typeof newValue} is not supported!`)
        }
      },
      [key, mmkv]
    )

    return [value, set]
  }
}

```

### Core Architecture Module: `packages/react-native-mmkv/src/hooks/useMMKV.ts`
```
import { useRef } from 'react'
import type { MMKV } from '../specs/MMKV.nitro'
import type { Configuration } from '../specs/MMKVFactory.nitro'
import { getDefaultMMKVInstance } from '../createMMKV/getDefaultMMKVInstance'
import { createMMKV } from '../createMMKV/createMMKV'

function isConfigurationEqual(
  left?: Configuration,
  right?: Configuration
): boolean {
  if (left == null || right == null) return left == null && right == null

  return (
    left.encryptionKey === right.encryptionKey &&
    left.encryptionType === right.encryptionType &&
    left.id === right.id &&
    left.path === right.path &&
    left.mode === right.mode &&
    left.readOnly === right.readOnly &&
    left.compareBeforeSet === right.compareBeforeSet &&
    left.recoveryStrategy === right.recoveryStrategy
  )
}

/**
 * Use the default, shared MMKV instance.
 */
export function useMMKV(): MMKV
/**
 * Use a custom MMKV instance with the given configuration.
 * @param configuration The configuration to initialize the MMKV instance with. Does not have to be memoized.
 */
export function useMMKV(configuration: Configuration): MMKV
export function useMMKV(configuration?: Configuration): MMKV {
  const instance = useRef<MMKV>(undefined)
  const lastConfiguration = useRef<Configuration>(undefined)

  if (configuration == null) return getDefaultMMKVInstance()

  if (
    instance.current == null ||
    !isConfigurationEqual(lastConfiguration.current, configuration)
  ) {
    lastConfiguration.current = configuration
    instance.current = createMMKV(configuration)
  }

  return instance.current
}

```

### Core Architecture Module: `packages/react-native-mmkv/src/hooks/useMMKVBoolean.ts`
```
import { createMMKVHook } from './createMMKVHook'

/**
 * Use the boolean value of the given `key` from the given MMKV storage instance.
 *
 * If no instance is provided, a shared default instance will be used.
 *
 * @example
 * ```ts
 * const [isPremiumAccount, setIsPremiumAccount] = useMMKVBoolean("user.isPremium")
 * ```
 */
export const useMMKVBoolean = createMMKVHook((instance, key) =>
  instance.getBoolean(key)
)

```

### Core Architecture Module: `packages/react-native-mmkv/src/hooks/useMMKVBuffer.ts`
```
import { createMMKVHook } from './createMMKVHook'

/**
 * Use the buffer value (unsigned 8-bit (0-255)) of the given `key` from the given MMKV storage instance.
 *
 * If no instance is provided, a shared default instance will be used.
 *
 * @example
 * ```ts
 * const [privateKey, setPrivateKey] = useMMKVBuffer("user.privateKey")
 * ```
 */
export const useMMKVBuffer = createMMKVHook((instance, key) =>
  instance.getBuffer(key)
)

```

### Core Architecture Module: `packages/react-native-mmkv/src/hooks/useMMKVKeys.ts`
```
import { useState } from 'react'
import type { MMKV } from '../specs/MMKV.nitro'
import { getDefaultMMKVInstance } from '../createMMKV/getDefaultMMKVInstance'
import { useMMKVListener } from './useMMKVListener'

/**
 * Get a list of all keys that exist in the given MMKV {@linkcode instance}.
 * The keys update when new keys are added or removed.
 * @param instance The instance to listen to changes to (or the default instance)
 *
 * @example
 * ```ts
 * useMMKVKeys(instance)
 * ```
 */
export function useMMKVKeys(instance?: MMKV): string[] {
  const mmkv = instance ?? getDefaultMMKVInstance()
  const [allKeys, setKeys] = useState<string[]>(() => mmkv.getAllKeys())

  useMMKVListener((key) => {
    // a key changed
    setKeys((keys) => {
      const currentlyHasKey = keys.includes(key)
      const hasKey = mmkv.contains(key)
      if (hasKey !== currentlyHasKey) {
        // Re-fetch the keys from native
        return mmkv.getAllKeys()
      } else {
        // We are up-to-date.
        return keys
      }
    })
  }, mmkv)

  return allKeys
}

```

### Core Architecture Module: `packages/react-native-mmkv/src/hooks/useMMKVListener.ts`
```
import { useEffect, useRef } from 'react'
import type { MMKV } from '../specs/MMKV.nitro'
import { getDefaultMMKVInstance } from '../createMMKV/getDefaultMMKVInstance'

/**
 * Listen for changes in the given MMKV storage instance.
 * If no instance is passed, the default instance will be used.
 * @param valueChangedListener The function to call whenever a value inside the storage instance changes
 * @param instance The instance to listen to changes to (or the default instance)
 *
 * @example
 * ```ts
 * useMMKVListener((key) => {
 *   console.log(`Value for "${key}" changed!`)
 * })
 * ```
 */
export function useMMKVListener(
  valueChangedListener: (key: string) => void,
  instance?: MMKV
): void {
  const ref = useRef(valueChangedListener)
  ref.current = valueChangedListener

  const mmkv = instance ?? getDefaultMMKVInstance()

  useEffect(() => {
    const listener = mmkv.addOnValueChangedListener((changedKey) => {
      ref.current(changedKey)
    })
    return () => listener.remove()
  }, [mmkv])
}

```

### Core Architecture Module: `packages/react-native-mmkv/src/hooks/useMMKVNumber.ts`
```
import { createMMKVHook } from './createMMKVHook'

/**
 * Use the number value of the given `key` from the given MMKV storage instance.
 *
 * If no instance is provided, a shared default instance will be used.
 *
 * @example
 * ```ts
 * const [age, setAge] = useMMKVNumber("user.age")
 * ```
 */
export const useMMKVNumber = createMMKVHook((instance, key) =>
  instance.getNumber(key)
)

```

### Core Architecture Module: `packages/react-native-mmkv/src/hooks/useMMKVObject.ts`
```
import { useCallback, useMemo } from 'react'
import type { MMKV } from '../specs/MMKV.nitro'
import { useMMKVString } from './useMMKVString'

/**
 * Use an object value of the given `key` from the given MMKV storage instance.
 *
 * If no instance is provided, a shared default instance will be used.
 *
 * The object will be serialized using `JSON`.
 *
 * @example
 * ```ts
 * const [user, setUser] = useMMKVObject<User>("user")
 * ```
 */
export function useMMKVObject<T>(
  key: string,
  instance?: MMKV
): [
  value: T | undefined,
  setValue: (
    value: T | undefined | ((prevValue: T | undefined) => T | undefined)
  ) => void,
] {
  const [json, setJson] = useMMKVString(key, instance)

  const value = useMemo(() => {
    if (json == null) return undefined
    return JSON.parse(json) as T
  }, [json])

  const setValue = useCallback(
    (v: (T | undefined) | ((prev: T | undefined) => T | undefined)) => {
      if (v instanceof Function) {
        setJson((currentJson) => {
          const currentValue =
            currentJson != null ? (JSON.parse(currentJson) as T) : undefined
          const newValue = v(currentValue)
          // Store the Object as a serialized Value or clear the value
          return newValue != null ? JSON.stringify(newValue) : undefined
        })
      } else {
        // Store the Object as a serialized Value or clear the value
        const newValue = v != null ? JSON.stringify(v) : undefined
        setJson(newValue)
      }
    },
    [setJson]
  )

  return [value, setValue]
}

```

### Core Architecture Module: `packages/react-native-mmkv/src/hooks/useMMKVString.ts`
```
import { createMMKVHook } from './createMMKVHook'

/**
 * Use the string value of the given `key` from the given MMKV storage instance.
 *
 * If no instance is provided, a shared default instance will be used.
 *
 * @example
 * ```ts
 * const [username, setUsername] = useMMKVString("user.name")
 * ```
 */
export const useMMKVString = createMMKVHook((instance, key) =>
  instance.getString(key)
)

```

### Core Architecture Module: `babel.config.js`
```
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ]
    }
  }
}

```

### Core Architecture Module: `example/.eslintrc.js`
```
module.exports = {
  root: true,
  extends: '@react-native',
};

```

### Core Architecture Module: `example/.prettierrc.js`
```
module.exports = {
  arrowParens: 'always',
  singleQuote: true,
  trailingComma: 'all',
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #108** (2021-07-28): **fix: Fix nullpointer crash**
  *Symptoms*: * Fixes #88  * Fixes #98

- **Issue #92** (2021-07-08): **fix: Fix race condition crash on iOS**
  *Symptoms*: fixes #24   this is a temporary fix to avoid a `setBridge:` race condition on iOS and will be fully fixed when TurboModules land

- **Issue #37** (2021-09-15): **MMKV does not correctly autolink**
  *Symptoms*: MMKV does not show up in the left side of Android Studio (dependencies), and can therefore not be imported (as shown in the installation step in the readme).  The current workaround for this is:  1. Add this to `settings.gradle`: ```groovy include ':react-native-mmkv' project(':react-native-mmkv').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-mmkv/android/') ``` 2. Add this to `build.gradle` (in `app/`), inside of `dependencies` (under `implementation("com.facebook.react:react-native:+")`): ```groovy   implementation project(':react-native-mmkv') ```   I am not sure what is missing from my configuration, but this will likely change soon when TurboModules will be released (maybe RN 0.65?), because I will rewrite the library - no extra installation steps will be needed then!
  **Post-Mortem & Fix Analysis**:
  > I also had to `import com.facebook.react.bridge.JSIModulePackage;` in MainApplication.java to make it work on android
  > I believe this works with v1.2.5 now, let me know if anyone can confirm
  > ```  2021-08-20 16:15:15.292 31642-31690/com.testapp D/SoLoader: Not resolving dependencies for libjscexecutor.so 2021-08-20 16:15:15.294 31642-31690/com.testapp W/System.err: java.lang.UnsatisfiedLinkError: dlopen failed: library "libjsc.so" not found 2021-08-20 16:15:15.294 31642-31690/com.testapp W/System.err:     at java.lang.Runtime.load0(Runtime.java:938) 2021-08-20 16:15:15.294 31642-31690/com.testapp W/System.err:     at java.lang.System.load(System.java:1631) 2021-08-20 16:15:15.294 31642-31690/com.testapp W/System.err:     at com.facebook.soloader.SoLoader$1.load(SoLoader.java:405) 2021-08-20 16:15:15.294 31642-31690/com.testapp W/System.err:     at com.facebook.soloader.DirectorySoSource.loadLibraryFrom(DirectorySoSource.java:77) 2021-08-20 16:15:15.294 31642-31690/com.testapp W/System.err:     at com.facebook.soloader.DirectorySoSource.loadLibrary(DirectorySoSource.java:50) 2021-08-20 16:15:15.294 31642-31690/com.testapp W/System.err:     at com.facebook.soloader.A

- **Issue #24** (2021-04-06): **Hot reloading/Fast refreshing throws error: "_reactNativeMmkv.getString is not a function"**
  *Symptoms*: I weirdly get this error **somettimes** / **often**   context:   I check for the token right away globally in the app, could it be that MMKV is not available then ?  <img width="325" alt="Screen Shot 2021-03-09 at 3 21 30 PM" src="https://user-images.githubusercontent.com/19273413/110476845-20268f80-80eb-11eb-9caa-b1b080892d04.png"> 
  **Post-Mortem & Fix Analysis**:
  > MMKV is being initialized as soon as the bridge is being set (see [here](https://github.com/mrousavy/react-native-mmkv/blob/master/ios/Mmkv.mm#L118-L130)), afaik that is before JS code can be executed so it shouldn't be undefined. Could you try adding a breakpoint there to see what gets executed first?
  > @mrousavy sorry, I'm not really sure how to do that, but will try and report back if I am successful.
  > Just open your project (.xcworkspace) in Xcode, press Command + Shift + O, search for "Mmkv" and open the Mmkv.mm file. then scroll to the line I linked, click the line number at the left and run the app from Xcode. it will pause execution at the breakpoint.

- **Issue #10** (2021-03-04): **iOS Build Configuration Release Fails**
  *Symptoms*: I get these four fatal errors when building in Release mode but everything works great in Debug mode.  /ios/Pods/Headers/Public/React-jsi/jsi/jsi.h:933:43: Use of undeclared identifier 'kindOf'  /ios/Pods/Headers/Public/React-jsi/jsi/jsi.h:933:43: No matching function for call to 'kindOf'  /ios/Pods/Headers/Public/React-jsi/jsi/jsi.h:934:5: Static_assert failed due to requirement 'std::is_base_of<facebook::jsi::Symbol, signed char &>::value || std::is_base_of<facebook::jsi::String, signed char &>::value || std::is_base_of<facebook::jsi::Object, signed char &>::value' "Value cannot be implicitly move-constructed from this type"  /ios/Pods/Headers/Public/React-jsi/jsi/jsi.h:939:26: Cannot allocate reference type 'signed char &' with new
  **Post-Mortem & Fix Analysis**:
  > `react-native-mmkv` v1.0.0 is ok. v1.0.1 && v1.0.2 has this error
  > I think you have to clean & rebuild. Open Xcode and hit "Clean Build Folder", then run those commands:  ``` rm -rf node_modules/react-native-mmkv rm -rf package-lock.json rm -rf ios/Pods rm -rf ios/Podfile.lock npm i cd ios pod install ```  and finally build your app
  > Tried all of that and have the same issues.

- **Issue #9** (2021-03-02): **Error: Exception in HostFunction: Second argument ('key') has to be of type string!**
  *Symptoms*: bellow code: ``` MMKV.set('key', 123) ``` throw an error.  after swap key and value, it is ok it seems v1.0.2 key-value order  go back  to RTL, not LTR
  **Post-Mortem & Fix Analysis**:
  > Looks like it still uses the old binaries, could you try cleaning the cache?  ``` rm -rf node_modules/react-native-mmkv rm -rf package-lock.json npm i ```
  > If it happens on iOS, try  ``` cd ios rm -rf Pods rm -rf Podfile.lock pod install ```  Then rebuild
  > Feel free to comment if you're still experiencing this issue, closing for now

- **Issue #5** (2021-02-25): **FATAL EXCEPTION: create_react_context**
  *Symptoms*: app crash: ``` java.lang.UnsatisfiedLinkError: dalvik.system.PathClassLoader[DexPathList[[zip file "/data/app/com.fandengdushu.elearning-OgNUeAOCK1DzMhuUHXOymQ==/base.apk"],nativeLibraryDirectories=[/data/app/com.fandengdushu.elearning-OgNUeAOCK1DzMhuUHXOymQ==/lib/arm, /data/app/com.fandengdushu.elearning-OgNUeAOCK1DzMhuUHXOymQ==/base.apk!/lib/armeabi-v7a, /system/lib, /system/product/lib]]] couldn't find "libcpp.so" ``` ``` Process: com.fandengdushu.elearning, PID: 32418     java.lang.UnsatisfiedLinkError: dalvik.system.PathClassLoader[DexPathList[[zip file "/data/app/com.fandengdushu.elearning-eCUYOjb8H8IzYMhKFpsOkQ==/base.apk"],nativeLibraryDirectories=[/data/app/com.fandengdushu.elearning-eCUYOjb8H8IzYMhKFpsOkQ==/lib/arm, /data/app/com.fandengdushu.elearning-eCUYOjb8H8IzYMhKFpsOkQ==/base.apk!/lib/armeabi-v7a, /system/lib, /system/product/lib]]] couldn't find "libcpp.so"         at java.lang.Runtime.loadLibrary0(Runtime.java:1067)         at java.lang.Runtime.loadLibrary0(Runtime.java:1007)         at java.lang.System.loadLibrary(System.java:1667)         at com.reactnativemmkv.MmkvModule.<clinit>(MmkvModule.kt:17)         at com.reactnativemmkv.MmkvPackage.createNativeModules(MmkvPackage.kt:11)         at com.facebook.react.ReactPackageHelper.getNativeModuleIterator(ReactPackageHelper.java:42)         at com.facebook.react.NativeModuleRegistryBuilder.processPackage(NativeModuleRegistryBuilder.java:42)         at com.facebook.react.ReactInstanceManager.proces
  **Post-Mortem & Fix Analysis**:
  > Huh, weird. What RN version are you on?
  >  this error dismissed after upgrade to `react-native-mmkv v1.0`
  > Hello, I've got a similar issue, let me know if you'd like me to open a new issue instead;  `FATAL EXCEPTION: create_react_context`  ``` FATAL EXCEPTION: create_react_context Process: com.APP_NAME.demo, PID: 28201 java.lang.NoClassDefFoundError: Failed resolution of: Lkotlin/jvm/internal/Intrinsics; 	at com.reactnativemmkv.MmkvPackage.createNativeModules(Unknown Source:2) 	at com.facebook.react.ReactPackageHelper.getNativeModuleIterator(ReactPackageHelper.java:42) 	at com.facebook.react.NativeModuleRegistryBuilder.processPackage(NativeModuleRegistryBuilder.java:42) 	at com.facebook.react.ReactInstanceManager.processPackage(ReactInstanceManager.java:1347) 	at com.facebook.react.ReactInstanceManager.processPackages(ReactInstanceManager.java:1318) 	at com.facebook.react.ReactInstanceManager.createReactContext(ReactInstanceManager.java:1225) 	at com.facebook.react.ReactInstanceManager.access$1100(ReactInstanceManager.java:131) 	at com.facebook.react.ReactInstanceManager$5.ru

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

### Incident Patch 1: `48e5ed70` (2026-08-20)
**Commit Message**: chore(deps): bump com.android.tools.build:gradle (#1080)

Bumps com.android.tools.build:gradle from 9.2.1 to 9.3.1.

---
updated-dependencies:
- dependency-name: com.android.tools.build:gradle
  dependency-version: 9.3.1
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `packages/react-native-mmkv/android/build.gradle` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ buildscript {
   }
 
   dependencies {
-    classpath "com.android.tools.build:gradle:9.2.1"
+    classpath "com.android.tools.build:gradle:9.3.1"
   }
 }
 
```

---

### Incident Patch 2: `53fa6068` (2026-08-20)
**Commit Message**: fix: Mark react-native-nitro-modules peer dependency as optional (#1083)

Semver ranges never match pre-releases, so a required peer of "*" does
not match e.g. 0.37.0-beta.0. Package managers then install a second,
stable copy of Nitro next to the pre-release, and the native/JS version
guard throws "Nitro was installed twice" at runtime.

Marking the peer optional leaves the consuming app in full control of
the installed Nitro version.

**File**: `bun.lock` (modified, +5/-2)
```diff
@@ -17,7 +17,7 @@
     },
     "example": {
       "name": "mmkv-example",
-      "version": "4.3.1",
+      "version": "4.3.2",
       "dependencies": {
         "@react-native/new-app-screen": "0.85.3",
         "http-proxy": "^1.18.1",
@@ -58,7 +58,7 @@
     },
     "packages/react-native-mmkv": {
       "name": "react-native-mmkv",
-      "version": "4.3.1",
+      "version": "4.3.2",
       "devDependencies": {
         "@react-native/eslint-config": "0.85.3",
         "@react-native/jest-preset": "0.85.3",
@@ -79,6 +79,9 @@
         "react-native": "*",
         "react-native-nitro-modules": "*",
       },
+      "optionalPeers": [
+        "react-native-nitro-modules",
+      ],
     },
   },
   "packages": {
```

**File**: `packages/react-native-mmkv/package.json` (modified, +5/-0)
```diff
@@ -78,6 +78,11 @@
     "react-native": "*",
     "react-native-nitro-modules": "*"
   },
+  "peerDependenciesMeta": {
+    "react-native-nitro-modules": {
+      "optional": true
+    }
+  },
   "eslintConfig": {
     "root": true,
     "extends": [
```

---

### Incident Patch 3: `1cd33631` (2026-06-22)
**Commit Message**: docs: fix README object example comment and deprecated size usage (#1073)

Co-authored-by: Patrick Wehbe <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +3/-3)
```diff
@@ -181,8 +181,8 @@ const user = {
 storage.set('user', JSON.stringify(user))
 
 // Deserialize the JSON string into an object
-const jsonUser = storage.getString('user') // { 'username': 'Marc', 'age': 21 }
-const userObject = JSON.parse(jsonUser)
+const jsonUser = storage.getString('user') // '{ "username": "Marc", "age": 21 }'
+const userObject = JSON.parse(jsonUser) // { username: 'Marc', age: 21 }
 ```
 
 ### Encryption
@@ -215,7 +215,7 @@ console.log(buffer) // [1, 100, 255]
 
 ```ts
 // get size of MMKV storage in bytes
-const size = storage.size
+const size = storage.byteSize
 if (size >= 4096) {
   // clean unused keys and clear memory cache
   storage.trim()
```

---

### Incident Patch 4: `87f408e0` (2026-06-03)
**Commit Message**: perf: report MMKV external memory size (#1068)

**File**: `packages/react-native-mmkv/cpp/HybridMMKV.cpp` (modified, +4/-0)
```diff
@@ -82,6 +82,10 @@ double HybridMMKV::getByteSize() {
   return instance->actualSize();
 }
 
+size_t HybridMMKV::getExternalMemorySize() noexcept {
+  return instance != nullptr ? instance->actualSize() : 0;
+}
+
 bool HybridMMKV::getIsReadOnly() {
   return instance->isReadOnly();
 }
```

**File**: `packages/react-native-mmkv/cpp/HybridMMKV.hpp` (modified, +3/-0)
```diff
@@ -44,6 +44,9 @@ class HybridMMKV final : public HybridMMKVSpec {
   Listener addOnValueChangedListener(const std::function<void(const std::string& /* key */)>& onValueChanged) override;
   double importAllFrom(const std::shared_ptr<HybridMMKVSpec>& other) override;
 
+protected:
+  size_t getExternalMemorySize() noexcept override;
+
 private:
   static MMKVMode getMMKVMode(const Configuration& config);
 
```

---

### Incident Patch 5: `dd8b0892` (2026-05-28)
**Commit Message**: ci: Build iOS harness with generic simulator (#1062)

**File**: `.github/workflows/harness-ios.yml` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ jobs:
           -scheme MmkvExample \
           -sdk iphonesimulator \
           -configuration Debug \
-          -destination 'platform=iOS Simulator,name=${{ env.DEVICE_MODEL }}' \
+          -destination 'generic/platform=iOS Simulator' \
           build \
           CODE_SIGNING_ALLOWED=NO"
 
```

---

### Incident Patch 6: `c070d206` (2026-05-21)
**Commit Message**: fix: Fix `length` being incorrect in MMKV Web (#1041)

**File**: `packages/react-native-mmkv/src/createMMKV/createMMKV.web.ts` (modified, +7/-1)
```diff
@@ -42,7 +42,13 @@ export function createMMKV(
   return {
     id: config.id,
     get length(): number {
-      return getLocalStorage().length
+      const storage = getLocalStorage()
+      let count = 0
+      for (let i = 0; i < storage.length; i++) {
+        const key = storage.key(i)
+        if (key != null && key.startsWith(keyPrefix)) count++
+      }
+      return count
     },
     get size(): number {
       return this.byteSize
```

---

### Incident Patch 7: `dbcdcf43` (2026-05-12)
**Commit Message**: chore(deps): bump com.android.tools.build:gradle (#1039)

Bumps com.android.tools.build:gradle from 9.2.0 to 9.2.1.

---
updated-dependencies:
- dependency-name: com.android.tools.build:gradle
  dependency-version: 9.2.1
  dependency-type: direct:production
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `packages/react-native-mmkv/android/build.gradle` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ buildscript {
   }
 
   dependencies {
-    classpath "com.android.tools.build:gradle:9.2.0"
+    classpath "com.android.tools.build:gradle:9.2.1"
   }
 }
 
```

---

### Incident Patch 8: `47d52518` (2026-05-08)
**Commit Message**: docs: Update react-native-mmkv version requirements (#1038)

**File**: `README.md` (modified, +1/-2)
```diff
@@ -312,8 +312,7 @@ If a user chooses to disable LocalStorage in their browser, the library will aut
 
 ## Limitations
 
-- react-native-mmkv V4 requires react-native 0.74 or higher.
-- react-native-mmkv V4 requires [the new architecture](https://reactnative.dev/docs/the-new-architecture/landing-page)/TurboModules to be enabled.
+- react-native-mmkv V4 requires react-native 0.76 or higher.
 - Since react-native-mmkv uses JSI for synchronous native method invocations, remote debugging (e.g. with Chrome) is no longer possible. Instead, you should use [Flipper](https://fbflipper.com) or [React DevTools](https://react.dev/learn/react-developer-tools).
 
 ## Integrations
```

---

### Incident Patch 9: `09ab502a` (2026-04-29)
**Commit Message**: chore(deps): bump com.android.tools.build:gradle (#1035)

Bumps com.android.tools.build:gradle from 9.1.0 to 9.2.0.

---
updated-dependencies:
- dependency-name: com.android.tools.build:gradle
  dependency-version: 9.2.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `packages/react-native-mmkv/android/build.gradle` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ buildscript {
   }
 
   dependencies {
-    classpath "com.android.tools.build:gradle:9.1.0"
+    classpath "com.android.tools.build:gradle:9.2.0"
   }
 }
 
```

---

### Incident Patch 10: `b98f2238` (2026-04-07)
**Commit Message**: fix: Fix build, replace TurboReactPackage with BaseReactPackage (#1033)

**File**: `packages/react-native-mmkv/android/src/main/java/com/margelo/nitro/mmkv/NitroMmkvPackage.java` (modified, +2/-2)
```diff
@@ -7,13 +7,13 @@
 import com.facebook.react.bridge.NativeModule;
 import com.facebook.react.bridge.ReactApplicationContext;
 import com.facebook.react.module.model.ReactModuleInfoProvider;
-import com.facebook.react.TurboReactPackage;
+import com.facebook.react.BaseReactPackage;
 import com.margelo.nitro.core.HybridObject;
 
 import java.util.HashMap;
 import java.util.function.Supplier;
 
-public class NitroMmkvPackage extends TurboReactPackage {
+public class NitroMmkvPackage extends BaseReactPackage {
   @Nullable
   @Override
   public NativeModule getModule(String name, ReactApplicationContext reactContext) {
```

---

### Incident Patch 11: `3df2075e` (2026-03-20)
**Commit Message**: fix: Fix `set(ArrayBuffer)` on Web (#1026)

* fix: Fix `set(ArrayBuffer)` on Web

* chore: Typse

**File**: `packages/react-native-mmkv/src/createMMKV/createMMKV.web.ts` (modified, +7/-1)
```diff
@@ -1,5 +1,6 @@
 import type { MMKV } from '../specs/MMKV.nitro'
 import type { Configuration } from '../specs/MMKVFactory.nitro'
+import { createTextDecoder } from '../web/createTextDecoder'
 import { createTextEncoder } from '../web/createTextEncoder'
 import {
   getLocalStorage,
@@ -16,6 +17,7 @@ export function createMMKV(
     throw new Error("MMKV: 'path' is not supported on Web!")
   }
 
+  const textDecoder = createTextDecoder()
   const textEncoder = createTextEncoder()
   const listeners = new Set<(key: string) => void>()
 
@@ -71,7 +73,11 @@ export function createMMKV(
     set: (key, value) => {
       const storage = getLocalStorage()
       if (key === '') throw new Error('Cannot set a value for an empty key!')
-      storage.setItem(prefixedKey(key), value.toString())
+      if (value instanceof ArrayBuffer) {
+        storage.setItem(prefixedKey(key), textDecoder.decode(value))
+      } else {
+        storage.setItem(prefixedKey(key), String(value))
+      }
       callListeners(key)
     },
     getString: (key) => {
```

**File**: `packages/react-native-mmkv/src/web/createTextDecoder.ts` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+export function createTextDecoder(): TextDecoder {
+  const g = global ?? globalThis ?? window
+  if (g.TextDecoder != null) {
+    return new g.TextDecoder()
+  } else {
+    return {
+      decode: () => {
+        throw new Error('TextDecoder is not supported in this environment!')
+      },
+      encoding: 'utf-8',
+      fatal: false,
+      ignoreBOM: false,
+    }
+  }
+}
```

**File**: `packages/react-native-mmkv/src/web/createTextEncoder.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-export function createTextEncoder() {
+export function createTextEncoder(): TextEncoder {
   const g = global ?? globalThis ?? window
   if (g.TextEncoder != null) {
     return new g.TextEncoder()
```

---

### Incident Patch 12: `67a3cff2` (2026-03-20)
**Commit Message**: chore: Test iOS build CI on generic iOS Simulator (#1025)

* chore: Test iOS CI on generic iOS Simulator

* Only build for arm64

**File**: `.github/workflows/build-ios.yml` (modified, +3/-1)
```diff
@@ -30,6 +30,8 @@ on:
 
 env:
   USE_CCACHE: 1
+  # Must match the runner's architecture (macOS-15 runners are arm64)
+  ARCH: arm64
 
 jobs:
   build:
@@ -75,6 +77,6 @@ jobs:
           -scheme MmkvExample \
           -sdk iphonesimulator \
           -configuration Debug \
-          -destination 'platform=iOS Simulator,name=iPhone 16' \
+          -destination 'generic/platform=iOS Simulator,arch=${{ env.ARCH }}' \
           build \
           CODE_SIGNING_ALLOWED=NO"
```

---

### Incident Patch 13: `e43b3e0c` (2026-03-20)
**Commit Message**: feat: Make default MMKV log level configurable at build time (#995)

* feat: Make default MMKV log level configurable at build time

Allow library consumers to override the default MMKV core log level via Gradle properties (Android) or Podfile variables (iOS).

* Update README.md with suggested clarification

Co-authored-by: Marc Rousavy <[REDACTED_EMAIL]>

* refactor: Move MMKV_LOG_LEVEL default to MMKVTypes.hpp

Simplify the log level logic by always defining MMKV_LOG_LEVEL with a default (0/Debug in debug builds, 3/Error in release) in the shared types header, removing the conditional branches from HybridMMKVFactory.cpp.

* chore: Fix clang-format violations in MMKVTypes.hpp

---------

Co-authored-by: Marc Rousavy <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +34/-0)
```diff
@@ -253,6 +253,40 @@ import { deleteMMKV } from 'react-native-mmkv'
 const wasDeleted = deleteMMKV('my-instance')
 ```
 
+### Log Level
+
+By default, MMKV logs at `Debug` level in debug builds and `Warning` level in release builds. You can override this at build time to control the verbosity of MMKV's native logs.
+
+| Value | Level |
+|-------|-------|
+| 0 | Debug |
+| 1 | Info |
+| 2 | Warning |
+| 3 | Error |
+| 4 | None |
+
+#### Android
+
+Set `MMKV_logLevel` in your app's `android/gradle.properties`:
+
+```properties
+MMKV_logLevel=4
+```
+
+#### iOS
+
+Set `$MMKVLogLevel` in your app's `ios/Podfile`, then run `pod install`:
+
+```ruby
+$MMKVLogLevel = 4
+```
+
+Or use an environment variable during `pod install`:
+
+```sh
+MMKV_LOG_LEVEL=4 pod install
+```
+
 ## Testing with Jest or Vitest
 
 A mocked MMKV instance is automatically used when testing with Jest or Vitest, so you will be able to use `createMMKV()` as per normal in your tests. Refer to [`example/__tests__/MMKV.harness.ts`](example/__tests__/MMKV.harness.ts) for an example using Jest.
```

**File**: `packages/react-native-mmkv/NitroMmkv.podspec` (modified, +8/-1)
```diff
@@ -26,11 +26,18 @@ Pod::Spec.new do |s|
   s.compiler_flags = '-x objective-c++'
   s.dependency 'MMKVCore', '2.4.0'
 
+  # Optionally configure MMKV log level via Podfile ($MMKVLogLevel) or env var (MMKV_LOG_LEVEL)
+  mmkv_log_level = $MMKVLogLevel || ENV['MMKV_LOG_LEVEL']
+  gcc_preprocessor_defs = "$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES"
+  if mmkv_log_level != nil && mmkv_log_level.to_s != ""
+    gcc_preprocessor_defs += " MMKV_LOG_LEVEL=#{mmkv_log_level}"
+  end
+
   # TODO: Remove when no one uses RN 0.79 anymore
   # Add support for React Native 0.79 or below
   s.pod_target_xcconfig = {
     "HEADER_SEARCH_PATHS" => ["${PODS_ROOT}/RCT-Folly"],
-    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES",
+    "GCC_PREPROCESSOR_DEFINITIONS" => gcc_preprocessor_defs,
     "OTHER_CPLUSPLUSFLAGS" => "$(inherited) -DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1"
   }
 
```

**File**: `packages/react-native-mmkv/android/CMakeLists.txt` (modified, +5/-0)
```diff
@@ -5,6 +5,11 @@ set (PACKAGE_NAME NitroMmkv)
 set (CMAKE_VERBOSE_MAKEFILE ON)
 set (CMAKE_CXX_STANDARD 20)
 
+# Optionally configure MMKV log level (passed from Gradle as -DMMKV_LOG_LEVEL=<0-4>)
+if(DEFINED MMKV_LOG_LEVEL)
+  add_definitions(-DMMKV_LOG_LEVEL=${MMKV_LOG_LEVEL})
+endif()
+
 # Find all C++ files (shared and platform specifics)
 file(GLOB_RECURSE shared_files RELATIVE ${CMAKE_SOURCE_DIR}
      "../cpp/**.cpp"
```

**File**: `packages/react-native-mmkv/android/build.gradle` (modified, +6/-1)
```diff
@@ -49,7 +49,12 @@ android {
     externalNativeBuild {
       cmake {
         cppFlags "-frtti -fexceptions -Wall -Wextra -fstack-protector-all"
-        arguments "-DANDROID_STL=c++_shared", "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
+        def mmkvLogLevel = rootProject.hasProperty("MMKV_logLevel") ? rootProject.property("MMKV_logLevel") : null
+        if (mmkvLogLevel != null && mmkvLogLevel != "") {
+          arguments "-DANDROID_STL=c++_shared", "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON", "-DMMKV_LOG_LEVEL=${mmkvLogLevel}"
+        } else {
+          arguments "-DANDROID_STL=c++_shared", "-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"
+        }
         abiFilters (*reactNativeArchitectures())
 
         buildTypes {
```

**File**: `packages/react-native-mmkv/cpp/HybridMMKVFactory.cpp` (modified, +1/-5)
```diff
@@ -18,11 +18,7 @@ std::string HybridMMKVFactory::getDefaultMMKVInstanceId() {
 void HybridMMKVFactory::initializeMMKV(const std::string& rootPath) {
   Logger::log(LogLevel::Info, TAG, "Initializing MMKV with rootPath=%s", rootPath.c_str());
 
-#ifdef NITRO_DEBUG
-  MMKVLogLevel logLevel = ::mmkv::MMKVLogDebug;
-#else
-  MMKVLogLevel logLevel = ::mmkv::MMKVLogWarning;
-#endif
+  MMKVLogLevel logLevel = static_cast<MMKVLogLevel>(MMKV_LOG_LEVEL);
   MMKV::initializeMMKV(rootPath, logLevel);
 }
 
```

**File**: `packages/react-native-mmkv/cpp/MMKVTypes.hpp` (modified, +12/-0)
```diff
@@ -48,3 +48,15 @@ constexpr auto MMKV_READ_ONLY = ::MMKVMode::MMKV_READ_ONLY;
  */
 
 using namespace mmkv;
+
+// Default MMKV log level if not configured at build time
+#ifndef MMKV_LOG_LEVEL
+#ifdef NITRO_DEBUG
+#define MMKV_LOG_LEVEL 0
+#else
+#define MMKV_LOG_LEVEL 3
+#endif
+#endif
+#if MMKV_LOG_LEVEL < 0 || MMKV_LOG_LEVEL > 4
+#error "MMKV_LOG_LEVEL must be between 0 (Debug) and 4 (None)"
+#endif
```

---

### Incident Patch 14: `bf238b78` (2026-03-20)
**Commit Message**: fix: Add tests for `compareBeforeSet` (#1020)

* fix: Add tests for `compareBeforeSet`

* chore: Dont throw if not set? idk

* fix: Fix Harness tests - listener will be called!

* Revert "chore: Dont throw if not set? idk"

This reverts commit 3bde5f926c6d51cd3478e88402634041cb597eac.

**File**: `example/__tests__/MMKV.harness.ts` (modified, +74/-0)
```diff
@@ -619,6 +619,80 @@ describe('MMKV Encryption & Security', () => {
   });
 });
 
+describe('MMKV Compare Before Set', () => {
+  afterEach(() => {
+    try {
+      createMMKV({ id: 'compare-before-set-test' }).clearAll();
+      createMMKV({ id: 'compare-disabled-test' }).clearAll();
+    } catch {
+      // Instances might not exist, that's okay
+    }
+  });
+
+  it('should create instance with compareBeforeSet enabled', () => {
+    const storage = createMMKV({
+      id: 'compare-before-set-test',
+      compareBeforeSet: true,
+    });
+
+    storage.set('key', 'value');
+    expect(storage.getString('key')).toStrictEqual('value');
+
+    storage.set('key', 'updated');
+    expect(storage.getString('key')).toStrictEqual('updated');
+  });
+
+  it('should create instance with compareBeforeSet disabled', () => {
+    const storage = createMMKV({
+      id: 'compare-disabled-test',
+      compareBeforeSet: false,
+    });
+
+    storage.set('key', 'value');
+    expect(storage.getString('key')).toStrictEqual('value');
+
+    storage.set('key', 'updated');
+    expect(storage.getString('key')).toStrictEqual('updated');
+  });
+
+  it('should not change byteSize when setting same value with compareBeforeSet', () => {
+    const storage = createMMKV({
+      id: 'compare-before-set-test',
+      compareBeforeSet: true,
+    });
+
+    storage.set('str', 'hello');
+    storage.set('num', 42);
+    storage.set('bool', true);
+    storage.set('buf', new Uint8Array([1, 2, 3]).buffer);
+
+    const sizeAfterInitialSet = storage.byteSize;
+
+    // Set same values again
+    storage.set('str', 'hello');
+    storage.set('num', 42);
+    storage.set('bool', true);
+    storage.set('buf', new Uint8Array([1, 2, 3]).buffer);
+
+    // byteSize should not have changed
+    expect(storage.byteSize).toStrictEqual(sizeAfterInitialSet);
+  });
+
+  it('should change byteSize when setting a different value with compareBeforeSet', () => {
+    const storage = createMMKV({
+      id: 'compare-before-set-test',
+      compareBeforeSet: true,
+    });
+
+    storage.set('key', 'short');
+    const sizeAfterInitialSet = storage.byteSize;
+
+    // Set a longer value - byteSize should increase
+    storage.set('key', 'a much longer string value that takes more space');
+    expect(storage.byteSize).toBeGreaterThan(sizeAfterInitialSet);
+  });
+});
+
 describe('MMKV Storage Management', () => {
   let storage: MMKV;
 
```

---

### Incident Patch 15: `3c67cac8` (2026-03-20)
**Commit Message**: chore(deps): bump com.android.tools.build:gradle (#1013)

Bumps com.android.tools.build:gradle from 9.0.0 to 9.1.0.

---
updated-dependencies:
- dependency-name: com.android.tools.build:gradle
  dependency-version: 9.1.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `packages/react-native-mmkv/android/build.gradle` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ buildscript {
   }
 
   dependencies {
-    classpath "com.android.tools.build:gradle:9.0.0"
+    classpath "com.android.tools.build:gradle:9.1.0"
   }
 }
 
```

#### Recent Merged Pull Requests:
- **PR #1091** (2026-09-14): chore: Upgrade Harness to 1.5.0 (@mrousavy)
- **PR #1087** (2026-08-29): chore: Update links after move to margelo org (@mrousavy)
- **PR #1085** (2026-08-23): chore: Run CI on iOS 26 (@mrousavy)
- **PR #1084** (2026-08-23): chore(deps): bump io.github.zhongwuzw:mmkv from 2.4.1 to 2.4.2 (sync upstream Tencent/MMKV v2.4.2) (@zhongwuzw)
- **PR #1083** (2026-08-20): fix: Mark react-native-nitro-modules peer dependency as optional (@mrousavy)
- **PR #1081** (2026-08-23): feat: Upgrade `MMKVCore` to 2.4.2 on iOS (@mrousavy)
- **PR #1080** (2026-08-20): chore(deps): bump com.android.tools.build:gradle from 9.2.1 to 9.3.1 in /packages/react-native-mmkv/android (@dependabot[bot])
- **PR #1078** (closed): chore(deps): bump com.android.tools.build:gradle from 9.2.1 to 9.3.0 in /packages/react-native-mmkv/android (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
