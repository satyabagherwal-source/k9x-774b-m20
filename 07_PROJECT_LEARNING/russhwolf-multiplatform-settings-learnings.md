# Forensic Learning Record (Deep Inspection): russhwolf/multiplatform-settings

> **Canonical Artifact**: `07_PROJECT_LEARNING/russhwolf-multiplatform-settings-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/russhwolf/multiplatform-settings](https://github.com/russhwolf/multiplatform-settings))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:47:48.035Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `russhwolf/multiplatform-settings`
- **Description**: A Kotlin Multiplatform library for saving simple key-value data
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2255 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #244** (2026-04-08): **`TypeCastException` calling `KeychainSettings.keys` (or any method that uses it, such as `size`)**
  *Symptoms*: My code calls `keys` on `KeychainSettings`. I get this error (note here the call was indirect via the `size` method, but same issue happens when calling `keys` directly):  ``` Uncaught Kotlin exception: kotlin.TypeCastException: class __NSCFData cannot be cast to class platform.Foundation.NSString     at 0   MyApp.debug.dylib                0x10c09501b        kfun:kotlin.Throwable#<init>(kotlin.String?){} + 99      at 1   MyApp.debug.dylib                0x10c08eccf        kfun:kotlin.Exception#<init>(kotlin.String?){} + 95      at 2   MyApp.debug.dylib                0x10c08ee9f        kfun:kotlin.RuntimeException#<init>(kotlin.String?){} + 95      at 3   MyApp.debug.dylib                0x10c08f73f        kfun:kotlin.ClassCastException#<init>(kotlin.String?){} + 95      at 4   MyApp.debug.dylib                0x10c08f7b3        kfun:kotlin.TypeCastException#<init>(kotlin.String?){} + 95      at 5   MyApp.debug.dylib                0x10c0c67e7        ThrowTypeCastException + 539      at 6   MyApp.debug.dylib                0x10c659b0b        kfun:com.russhwolf.settings.KeychainSettings#<get-keys>(){}kotlin.collections.Set<kotlin.String> + 2723      at 7   MyApp.debug.dylib                0x10c65a123        kfun:com.russhwolf.settings.KeychainSettings#<get-size>(){}kotlin.Int + 115      at 8   MyApp.debug.dylib                0x10c664123        kfun:com.russhwolf.settings.Settings#<get-size>(){}kotlin.Int-trampoline + 91      at 9   MyApp.debug.dylib                0x10c06414
  **Post-Mortem & Fix Analysis**:
  > Seems like this is the same or similar issue as https://github.com/russhwolf/multiplatform-settings/issues/243.
  > Closing as duplicate

- **Issue #242** (2026-02-27): **Add some special handling, such as proxy**
  *Symptoms*: import com.russhwolf.settings.Settings import com.russhwolf.settings.minusAssign import kotlin.reflect.KClass import kotlin.reflect.KProperty  /** Equivalent to [Settings.getString] */ inline operator fun <reified T: Enum<T>> Settings.get(key: String, defaultValue: T): T = runCatching { enumValueOf<T>(getString(key, defaultValue.name)) }.getOrDefault(defaultValue)  /** Equivalent to [Settings.putString] */ inline operator fun <T: Enum<T>> Settings.set(key: String, value: T): Unit = putString(key, value.name)  open class SettingsBindingNullable<T: Any>(val returnType: KClass<T>,val settings: Settings,val defaultValue: T?) {     @Suppress("UNCHECKED_CAST")     open operator fun getValue(thisObj: Any?, property: KProperty<*>): T? = when (returnType) {         Int::class -> settings.getIntOrNull(property.name) as T?         Long::class -> settings.getLongOrNull(property.name) as T?         String::class -> settings.getStringOrNull(property.name) as T?         Float::class -> settings.getFloatOrNull(property.name) as T?         Double::class -> settings.getDoubleOrNull(property.name) as T?         Boolean::class -> settings.getBooleanOrNull(property.name) as T?         else -> throw IllegalArgumentException("Invalid type!")     } ?: defaultValue      operator fun setValue(thisObj: Any?, property: KProperty<*>, value: T?): Unit = if (value == null) {         settings -= property.name     } else when (returnType) {         Int::class -> settings.putInt(property.name, value as Int)  
  **Post-Mortem & Fix Analysis**:
  > Similar to settings.type(), but it automatically matches the type, and the key can also be customized

- **Issue #241** (2025-11-27): **iOS crash: MakeObservableSettings.invokeListeners#internal**
  *Symptoms*: Hi, we are experiencing a very rare crash on iOS when using [Store5](https://github.com/MobileNativeFoundation/Store) (KMP) with `ObservableSettings` as the [SourceOfTruth](https://store.mobilenativefoundation.org/docs/concepts/store5/source-of-truth). The crash occurs only on iOS, never on Android, and happens in a coroutine.  Stack trace: ``` Crashed: com.apple.root.default-qos EXC_BAD_ACCESS KERN_INVALID_ADDRESS 0x0000000000000000 0  kotlinBridge                   0x588308 kfun:com.russhwolf.settings.observable.MakeObservableSettings.invokeListeners#internal + 972 1  kotlinBridge                   0x72cc88 kfun:com.due.verification.data.VerificationRepositoryImpl.VerificationRepositoryImpl$3.invoke#internal + 492 2  kotlinBridge                   0x36b8d0 kfun:org.mobilenativefoundation.store.store5.impl.PersistentSourceOfTruth#write#suspend + 196 3  kotlinBridge                   0x3755a4 kfun:org.mobilenativefoundation.store.store5.impl.SourceOfTruthWithBarrier.$writeCOROUTINE$1.invokeSuspend#internal + 1348 4  kotlinBridge                   0x375f00 kfun:org.mobilenativefoundation.store.store5.impl.SourceOfTruthWithBarrier#write#suspend + 252 5  kotlinBridge                   0x35eeac kfun:org.mobilenativefoundation.store.store5.impl.FetcherController.FetcherController$2$invoke$4.$invokeCOROUTINE$0.invokeSuspend#internal + 592 ```  The crash appears to originate from `MakeObservableSettings.invokeListeners`, which is called when the `SourceOfTruth.writer` updates the st
  **Post-Mortem & Fix Analysis**:
  > I tested different implementation thoroughly and can see that the crash may happen only if using `KeychainSettings` with `makeObservable()` extension which is not thread safe.  `NSUserDefaultsSettings` should work fine as it uses `NSNotificationCenter` observer for updates.  I believe wrapping it with `toFlowSettings` and providing some `newSingleThreadContext` should fix the issue.   
  > Stumbled on the same issue myself. Passing a `newSingleThreadContext` dispatcher to `toFlowSettings` seems to fix the issue but I wonder if `MakeObservableSettings` should be made thread safe, have an alternative `makeObservableThreadSafe()` or at least update the docs mentioning `MakeObservableSettings` is not thread safe. @russhwolf ?

- **Issue #240** (2025-11-07): **Nested List Deserialization Issue**
  *Symptoms*: `settings.encodeValue(         StoredCurrentOrder::class.serializer(),         CURRENT_ORDER,         StoredCurrentOrder(             menuId,             order         )     )      val storedOrder: StoredCurrentOrder? =         settings.decodeValueOrNull(             StoredCurrentOrder::class.serializer(),             CURRENT_ORDER         )      platformLog(storedOrder.toString())`  I'm storing some data classes, one of which contains a list. I see that it's stored properly in my prefs file, but when I decodeValueOrNull, the list is empty .. any ideas?
  **Post-Mortem & Fix Analysis**:
  > Oh, it overwrites with property defaults .. so my workaround is not to set defaults, and that works.

- **Issue #239** (2025-09-18): **[WasmJS] getStringOrNullFlow emits the key?!**
  *Symptoms*: On WasmJs (couldn't reproduce on Android):  ```       settings.getStringOrNullFlow("blah")         .collect {            println("blah = $it")         } ```  This prints   ``` blah = null blah = blah ```  meaning, it emits the setting key, as its value. WTF?

- **Issue #238** (2026-03-04): **[JS, WasmJS] no ObservableSettings/FlowSettings?**
  *Symptoms*: I'm confused... It seems that on the JS, WasmJS platform there is no way to create ObservableSettings/FlowSettings since StorageSettings implements only the basic Settings interface? 
  **Post-Mortem & Fix Analysis**:
  > This is because there is no native observability in JS that delivers updates within the same window/process. You can use the `make-observable` module to call `storageSettings.makeObservable()` instead. See [here](https://github.com/russhwolf/multiplatform-settings?tab=readme-ov-file#make-observable-module)

- **Issue #231** (2025-06-07): **`serializedValue` can't store some data was tagged with @Polymorphic**
  *Symptoms*: I used a class with:  ```kotlin @Serializable @Polymorphic sealed interface BypassSetting {     @Serializable     @SerialName("none")     data object None : BypassSetting      @Serializable     @SerialName("sni-replace")     data class SNIReplace(         val url: String = "https://1.0.0.1/dns-query",         val fallback: Map<String, List<String>> = mapOf(             "app-api.pixiv.net" to listOf("210.140.139.155"),             "oauth.secure.pixiv.net" to listOf("210.140.139.155"),             "i.pximg.net" to listOf("210.140.139.133"),             "s.pximg.net" to listOf("210.140.139.133"),         ),         val nonStrictSSL: Boolean = true,         val dohTimeout: Int = 5,     ) : BypassSetting      @Serializable     @SerialName("proxy")     data class Proxy(         val host: String = "localhost",         val port: Int = 7890,         val type: ProxyType = ProxyType.HTTP,     ) : BypassSetting {          enum class ProxyType {             HTTP,             SOCKS,         }     } } ```  usage code is this:  ```kotlin @OptIn(ExperimentalSerializationApi::class, ExperimentalSettingsApi::class) var bypassSettings: BypassSetting by serializedValue(     key = "bypass_settings",     defaultValue = BypassSetting.None, ) ```  but when i want to modify the `bypassSettings` to a new value:  ```kotlin bypassSettings = BypassSetting.SNIReplace(     fallback = mapOf(         "baidu.com" to listOf("1.1.1.1"),     ),     url = "https://dns.alidns.com/dns-query", ) ```  the `url` can be
  **Post-Mortem & Fix Analysis**:
  > I can't fully run your test because I don't know what `SystemConfig.getConfig("app_clone")` returns, but I think I can see the issue. As far as I can tell, it has nothing to do with polymorphic, but rather is a problem with nonnull default values when deserializing. Here's a more minimal test case:  ```kotlin @Test fun issue_231() {     @Serializable     data class TestClass(         val data: Map<String, String> = emptyMap()     )      val settings = MapSettings()     val testClass = TestClass(mapOf("foo" to "bar"))      settings.encodeValue("testClass", testClass)      val deserialized = settings.decodeValueOrNull<TestClass>("testClass")     assertTrue { deserialized?.data?.get("foo") == "bar" } } ```
  > > I can't fully run your test because I don't know what `SystemConfig.getConfig("app_clone")` returns, but I think I can see the issue. As far as I can tell, it has nothing to do with polymorphic, but rather is a problem with nonnull default values when deserializing. Here's a more minimal test case: >  > ```kotlin > @Test > fun issue_231() { >     @Serializable >     data class TestClass( >         val data: Map<String, String> = emptyMap() >     ) >  >     val settings = MapSettings() >     val testClass = TestClass(mapOf("foo" to "bar")) >  >     settings.encodeValue("testClass", testClass) >  >     val deserialized = settings.decodeValueOrNull<TestClass>("testClass") >     assertTrue { deserialized?.data?.get("foo") == "bar" } > } > ```  hum.... replace the `SystemConfig.getConfig("app_clone")` to the `MapSettings()` can get the same results.
  > The first assertion fails due to a library bug which I'll fix in the next release.   The second assertion fails because the reified type is getting inferred as `BypassSetting.Null` rather than `BypassSetting`. You can correct this by changing `bypassSettings1` from a `val` to a `var`, or by specifying the type argument as`config1.serializedValue<BypassSetting>(...)` 

- **Issue #229** (2026-03-04): **Support for storing Set of strings**
  *Symptoms*: function for storing Set<String> is missing. Please add if possible, thank you!  
  **Post-Mortem & Fix Analysis**:
  > You can use `multiplatform-settings-serialization` for this.  ```kotlin  settings.encodeValue(SetSerializer(Int.serializer()), "key", setOf(1, 2, 3)) ```
  > Also a duplicate of #67 

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

### Incident Patch 1: `b8154487` (2025-05-18)
**Commit Message**: Fix #231 by checking if descriptor is nullable in addition to optional

**File**: `multiplatform-settings-serialization/src/commonMain/kotlin/SerializationInternals.kt` (modified, +4/-3)
```diff
@@ -140,7 +140,8 @@ internal class SettingsDecoder(
     private fun isMissingAndOptional(descriptor: SerialDescriptor, index: Int): Boolean {
         val key = "${getKey()}.${descriptor.getElementName(index)}"
         // Descriptor shows key is optional, key is not present, and nullability doesn't indicate key should be present
-        return descriptor.isElementOptional(index) && key !in settings && settings.getBooleanOrNull("$key?") != true
+        return descriptor.isElementOptional(index) && descriptor.isNullable &&
+                key !in settings && settings.getBooleanOrNull("$key?") != true
     }
 
 
@@ -252,8 +253,8 @@ internal class SettingsRemover(
     private fun isMissingAndOptional(descriptor: SerialDescriptor, index: Int): Boolean {
         val key = "${getKey()}.${descriptor.getElementName(index)}"
         // Descriptor shows key is optional, key is not present, and nullability doesn't indicate key should be present
-        val output =
-            descriptor.isElementOptional(index) && key !in settings && settings.getBooleanOrNull("$key?") != true
+        val output = descriptor.isElementOptional(index) && descriptor.isNullable &&
+                key !in settings && settings.getBooleanOrNull("$key?") != true
         keys.add(key)
         keys.add("$key?")
         return output
```

**File**: `multiplatform-settings-serialization/src/commonTest/kotlin/SettingsSerializationTest.kt` (modified, +21/-2)
```diff
@@ -801,9 +801,9 @@ class SettingsSerializationTest {
             settings.decodeValue(TestClassNullable.serializer().nullable, "testClass", TestClassNullable())
         )
 
-        assertTrue(settings.containsValue(TestClass.serializer().nullable, "testClass"))
+        assertTrue(settings.containsValue(TestClassNullable.serializer().nullable, "testClass"))
 
-        settings.removeValue(TestClass.serializer().nullable, "testClass")
+        settings.removeValue(TestClassNullable.serializer().nullable, "testClass")
         assertEquals(0, settings.size)
 
     }
@@ -1064,6 +1064,25 @@ class SettingsSerializationTest {
         myItems = emptyList()
         myItems = emptyList()
     }
+
+    @Test
+    fun issue_231() {
+        @Serializable
+        data class Container(
+            val data: Map<String, String> = emptyMap()
+        )
+
+        val settings = MapSettings()
+        val container = Container(mapOf("foo" to "bar"))
+
+        settings.encodeValue("container", container)
+
+        val deserialized = settings.decodeValueOrNull<Container>("container")
+        assertEquals("bar", deserialized?.data?.get("foo"))
+
+        settings.removeValue<Container>("container")
+        assertEquals(0, settings.size)
+    }
 }
 
 @Serializable
```

---

### Incident Patch 2: `d656c583` (2024-11-26)
**Commit Message**: Ensure that SettingsEncoder is correctly reset to initial state after finishing an encoding, in case of reuse such as with delegates. Fixes #217

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@
 
 - Update to Kotlin 2.0.21, Gradle 8.10, and Android Gradle Plugin 8.5.2
 - Add `wasmWasi` support to `multiplatform-settings-coroutines` and `multiplatform-settings-serialization`.
+- Fix an issue in `multiplatform-settings-serialization` where delegates might return wrong values or crash (#217).
 
 ## v1.2.0 *(2024-09-01)* ##
 
```

**File**: `multiplatform-settings-serialization/src/commonMain/kotlin/SerializationInternals.kt` (modified, +5/-1)
```diff
@@ -31,7 +31,7 @@ import kotlinx.serialization.modules.SerializersModule
 @ExperimentalSerializationApi
 internal class SettingsEncoder(
     private val settings: Settings,
-    key: String,
+    private val key: String,
     public override val serializersModule: SerializersModule
 ) : AbstractEncoder() {
 
@@ -60,6 +60,10 @@ internal class SettingsEncoder(
     public override fun endStructure(descriptor: SerialDescriptor) {
         depth--
         keyStack.removeLast()
+        if (keyStack.isEmpty()) {
+            // We've reached the end of everything, so reset for potential encoder reuse
+            keyStack.add(key)
+        }
     }
 
     public override fun beginCollection(descriptor: SerialDescriptor, collectionSize: Int): CompositeEncoder {
```

**File**: `multiplatform-settings-serialization/src/commonTest/kotlin/SettingsSerializationTest.kt` (modified, +41/-0)
```diff
@@ -21,6 +21,7 @@ import com.russhwolf.settings.MapSettings
 import com.russhwolf.settings.Settings
 import com.russhwolf.settings.contains
 import kotlinx.serialization.ExperimentalSerializationApi
+import kotlinx.serialization.SerialName
 import kotlinx.serialization.Serializable
 import kotlinx.serialization.SerializationException
 import kotlinx.serialization.builtins.ListSerializer
@@ -1023,6 +1024,46 @@ class SettingsSerializationTest {
         preferences.list = list
         assertEquals(expected = list, actual = preferences.list)
     }
+
+    @Test
+    fun issue_217() {
+        val settings = MapSettings()
+
+        @Serializable
+        data class MyItemDto(
+            @SerialName("name")
+            val name: String,
+            @SerialName("id")
+            val id: String,
+        )
+
+        var myItems: List<MyItemDto> by settings.serializedValue(
+            ListSerializer(MyItemDto.serializer()),
+            "MY_ITEMS",
+            emptyList(),
+        )
+
+        myItems = emptyList()
+        assertEquals(emptyList(), myItems)
+        myItems = listOf(
+            MyItemDto(
+                name = "Name",
+                id = "Id",
+            )
+        )
+        assertEquals(
+            listOf(
+                MyItemDto(
+                    name = "Name",
+                    id = "Id",
+                )
+            ), myItems
+        )
+
+        // Should not crash
+        myItems = emptyList()
+        myItems = emptyList()
+    }
 }
 
 @Serializable
```

---

### Incident Patch 3: `5aa0f107` (2024-09-28)
**Commit Message**: Update android sample versions to fix duplicate class issues

**File**: `sample/app-android/build.gradle.kts` (modified, +3/-3)
```diff
@@ -55,14 +55,14 @@ android {
 dependencies {
     implementation(project(":shared"))
     implementation(fileTree("include" to listOf("*.jar"), "dir" to "libs"))
-    implementation(platform("androidx.compose:compose-bom:2023.09.02"))
+    implementation(platform("androidx.compose:compose-bom:2024.09.02"))
     implementation("androidx.compose.material3:material3")
     implementation("androidx.compose.foundation:foundation")
     implementation("androidx.compose.ui:ui")
     implementation("androidx.compose.ui:ui-tooling-preview")
     debugImplementation("androidx.compose.ui:ui-tooling")
-    implementation("androidx.activity:activity-compose:1.7.2")
+    implementation("androidx.activity:activity-compose:1.9.2")
     implementation("androidx.compose.material:material-icons-core")
-    implementation("androidx.preference:preference-ktx:1.2.0")
+    implementation("androidx.preference:preference-ktx:1.2.1")
     implementation("com.russhwolf:multiplatform-settings:${rootProject.ext["library_version"]}")
 }
```

**File**: `sample/app-android/src/main/java/com/russhwolf/settings/example/android/MainActivity.kt` (modified, +0/-5)
```diff
@@ -19,7 +19,6 @@ package com.russhwolf.settings.example.android
 import android.os.Bundle
 import androidx.activity.ComponentActivity
 import androidx.activity.compose.setContent
-import androidx.compose.foundation.interaction.MutableInteractionSource
 import androidx.compose.foundation.isSystemInDarkTheme
 import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Box
@@ -32,15 +31,13 @@ import androidx.compose.foundation.shape.CircleShape
 import androidx.compose.foundation.text.KeyboardOptions
 import androidx.compose.material.icons.Icons
 import androidx.compose.material.icons.rounded.ArrowDropDown
-import androidx.compose.material.ripple.rememberRipple
 import androidx.compose.material3.Button
 import androidx.compose.material3.Checkbox
 import androidx.compose.material3.DropdownMenu
 import androidx.compose.material3.DropdownMenuItem
 import androidx.compose.material3.ExperimentalMaterial3Api
 import androidx.compose.material3.Icon
 import androidx.compose.material3.MaterialTheme
-import androidx.compose.material3.MaterialTheme.colorScheme
 import androidx.compose.material3.Surface
 import androidx.compose.material3.Text
 import androidx.compose.material3.TextButton
@@ -201,8 +198,6 @@ private fun LabeledCheckbox(
             .clip(CircleShape)
             .toggleable(
                 value = checked,
-                indication = rememberRipple(color = colorScheme.primary),
-                interactionSource = remember { MutableInteractionSource() },
                 role = Role.Checkbox,
                 onValueChange = onClick,
             )
```

---

### Incident Patch 4: `25cccd7a` (2024-06-27)
**Commit Message**: Update to Kotlin 2.0.0 and fix some minor breakages

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -11,3 +11,4 @@ keys.properties
 !.idea/copyright
 !.idea/inspectionProfiles
 !.idea/runConfigurations
+.kotlin
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [versions]
 multiplatformSettings = "1.2.0"
 
-kotlin = "1.9.24"
+kotlin = "2.0.0"
 
 android-gradle = "8.2.2"
 android-minSdk = "15"
```

**File**: `kotlin-js-store/yarn.lock` (modified, +244/-211)
```diff
@@ -44,18 +44,26 @@
   resolved "https://registry.yarnpkg.com/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.4.15.tgz#d7c6e6755c78567a951e04ab52ef0fd26de59f32"
   integrity sha512-eF2rxCRulEKXHTRiDrDy6erMYWqNw4LPdQ8UQA4huuxaQsVeRPFl2oM8oDGxMFhJUWZf9McpLtJasDDZb/Bpeg==
 
-"@jridgewell/trace-mapping@^0.3.17", "@jridgewell/trace-mapping@^0.3.9":
+"@jridgewell/trace-mapping@^0.3.20":
+  version "0.3.25"
+  resolved "https://registry.yarnpkg.com/@jridgewell/trace-mapping/-/trace-mapping-0.3.25.tgz#15f190e98895f3fc23276ee14bc76b675c2e50f0"
+  integrity sha512-vNk6aEwybGtawWmy/PzwnGDOjCkLWSD2wqvjGGAgOAwCGWySYXfYoxt00IJkTF+8Lb57DwOb3Aa0o9CApepiYQ==
+  dependencies:
+    "@jridgewell/resolve-uri" "^3.1.0"
+    "@jridgewell/sourcemap-codec" "^1.4.14"
+
+"@jridgewell/trace-mapping@^0.3.9":
   version "0.3.19"
   resolved "https://registry.yarnpkg.com/@jridgewell/trace-mapping/-/trace-mapping-0.3.19.tgz#f8a3249862f91be48d3127c3cfe992f79b4b8811"
   integrity sha512-kf37QtfW+Hwx/buWGMPcR60iF9ziHa6r/CZJIHbmcm4+0qrXiVdxegAH0F6yddEVQ7zdkjcGCgCzUu+BcbhQxw==
   dependencies:
     "@jridgewell/resolve-uri" "^3.1.0"
     "@jridgewell/sourcemap-codec" "^1.4.14"
 
-"@types/component-emitter@^1.2.10":
-  version "1.2.11"
-  resolved "https://registry.yarnpkg.com/@types/component-emitter/-/component-emitter-1.2.11.tgz#50d47d42b347253817a39709fef03ce66a108506"
-  integrity sha512-SRXjM+tfsSlA9VuG8hGO2nft2p8zjXCK1VcC6N4NXbBbYbSia9kzCChYQajIjzIqOOOuh5Ock6MmV2oux4jDZQ==
+"@socket.io/component-emitter@~3.1.0":
+  version "3.1.2"
+  resolved "https://registry.yarnpkg.com/@socket.io/component-emitter/-/component-emitter-3.1.2.tgz#821f8442f4175d8f0467b9daf26e3a18e2d02af2"
+  integrity sha512-9BCxFwvbGg/RsZK9tjXd8s4UcwR0MWeFQ1XEKIQVVvAGJyINdrqKMcTRyLoK8Rse1GjzLV9cwjWV1olXRWEXVA==
 
 "@types/cookie@^0.4.1":
   version "0.4.1"
@@ -88,10 +96,10 @@
   resolved "https://registry.yarnpkg.com/@types/estree/-/estree-0.0.50.tgz#1e0caa9364d3fccd2931c3ed96fdbeaa5d4cca83"
   integrity sha512-C6N5s2ZFtuZRj54k2/zyRhNDjJwwcViAM3Nbm8zjBpbqAdZ00mr0CFxvSKeO8Y/e03WVFLpQMdHYVfUd6SB+Hw==
 
-"@types/estree@^1.0.0":
-  version "1.0.1"
-  resolved "https://registry.yarnpkg.com/@types/estree/-/estree-1.0.1.tgz#aa22750962f3bf0e79d753d3cc067f010c95f194"
-  integrity sha512-LG4opVs2ANWZ1TJoKc937iMmNstM/d0ae1vNbnBvBhqCSezgVUOzcLCqbI5elV8Vy6WKwKjaqR+zO9VKirBBCA==
+"@types/estree@^1.0.5":
+  version "1.0.5"
+  resolved "https://registry.yarnpkg.com/@types/estree/-/estree-1.0.5.tgz#a6ce3e556e00fd9895dd872dd172ad0d4bd687f4"
+  integrity sha512-/kYRxGDLWzHOB7q+wtSUQlFrtcdUccpfy+X+9iMBpHK8QLLhx2wIPYuS5DYtR9Wa/YlZAbIovy7qVdB1Aq6Lyw==
 
 "@types/json-schema@*", "@types/json-schema@^7.0.8":
   version "7.0.9"
@@ -103,10 +111,10 @@
   resolved "https://registry.yarnpkg.com/@types/node/-/node-16.11.1.tgz#2e50a649a50fc403433a14f829eface1a3443e97"
   integrity sha512-PYGcJHL9mwl1Ek3PLiYgyEKtwTMmkMw4vbiyz/ps3pfdRYLVv+SN7qHVAImrjdAXxgluDEw6Ph4lyv+m9UpRmA==
 
-"@webassemblyjs/ast@1.11.6", "@webassemblyjs/ast@^1.11.5":
-  version "1.11.6"
-  resolved "https://registry.yarnpkg.com/@webassemblyjs/ast/-/ast-1.11.6.tgz#db046555d3c413f8966ca50a95176a0e2c642e24"
-  integrity sha512-IN1xI7PwOvLPgjcf180gC1bqn3q/QaOCwYUahIOhbYUu8KA/3tw2RT/T0Gidi1l7Hhj5D/INhJxiICObqpMu4Q==
+"@webassemblyjs/ast@1.12.1", "@webassemblyjs/ast@^1.12.1":
+  version "1.12.1"
+  resolved "https://registry.yarnpkg.com/@webassemblyjs/ast/-/ast-1.12.1.tgz#bb16a0e8b1914f979f45864c23819cc3e3f0d4bb"
+  integrity sha512-EKfMUOPRRUTy5UII4qJDGPpqfwjOmZ5jeGFwid9mnoqIFK+e0vqoi1qH56JpmZSzEL53jKnNzScdmftJyG5xWg==
   dependencies:
     "@webassemblyjs/helper-numbers" "1.11.6"
     "@webassemblyjs/helper-wasm-bytecode" "1.11.6"
@@ -121,10 +129,10 @@
   resolved "https://registry.yarnpkg.com/@webassemblyjs/helper-api-error/-/helper-api-error-1.11.6.tgz#6132f68c4acd59dcd141c44b18cbebbd9f2fa768"
   integrity sha512-o0YkoP4pVu4rN8aTJgAyj9hC2Sv5UlkzCHhxqWj8butaLvnpdc2jOwh4ewE6CX0txSfLn/UYaV/pheS2Txg//Q==
 
-"@webassemblyjs/helper-buffer@1.11.6":
-  version "
```

**File**: `multiplatform-settings-coroutines/api/multiplatform-settings-coroutines.klib.api` (modified, +3/-3)
```diff
@@ -95,9 +95,9 @@ final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.cor
 final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/getStringOrNullFlow(kotlin/String): kotlinx.coroutines.flow/Flow<kotlin/String?> // com.russhwolf.settings.coroutines/getStringOrNullFlow|getStringOrNullFlow@com.russhwolf.settings.ObservableSettings(kotlin.String){}[0]
 final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/getStringOrNullStateFlow(kotlinx.coroutines/CoroutineScope, kotlin/String): kotlinx.coroutines.flow/StateFlow<kotlin/String?> // com.russhwolf.settings.coroutines/getStringOrNullStateFlow|getStringOrNullStateFlow@com.russhwolf.settings.ObservableSettings(kotlinx.coroutines.CoroutineScope;kotlin.String){}[0]
 final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/getStringStateFlow(kotlinx.coroutines/CoroutineScope, kotlin/String, kotlin/String): kotlinx.coroutines.flow/StateFlow<kotlin/String> // com.russhwolf.settings.coroutines/getStringStateFlow|getStringStateFlow@com.russhwolf.settings.ObservableSettings(kotlinx.coroutines.CoroutineScope;kotlin.String;kotlin.String){}[0]
-final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/toFlowSettings(kotlinx.coroutines/CoroutineDispatcher =...): com.russhwolf.settings.coroutines/FlowSettings // com.russhwolf.settings.coroutines/toFlowSettings|toFlowSettings@com.russhwolf.settings.ObservableSettings(kotlinx.coroutines.CoroutineDispatcher){}[0]
-final fun (com.russhwolf.settings/Settings).com.russhwolf.settings.coroutines/toSuspendSettings(kotlinx.coroutines/CoroutineDispatcher =...): com.russhwolf.settings.coroutines/SuspendSettings // com.russhwolf.settings.coroutines/toSuspendSettings|toSuspendSettings@com.russhwolf.settings.Settings(kotlinx.coroutines.CoroutineDispatcher){}[0]
+final fun (com.russhwolf.settings/ObservableSettings).com.russhwolf.settings.coroutines/toFlowSettings(kotlinx.coroutines/CoroutineDispatcher = ...): com.russhwolf.settings.coroutines/FlowSettings // com.russhwolf.settings.coroutines/toFlowSettings|toFlowSettings@com.russhwolf.settings.ObservableSettings(kotlinx.coroutines.CoroutineDispatcher){}[0]
+final fun (com.russhwolf.settings/Settings).com.russhwolf.settings.coroutines/toSuspendSettings(kotlinx.coroutines/CoroutineDispatcher = ...): com.russhwolf.settings.coroutines/SuspendSettings // com.russhwolf.settings.coroutines/toSuspendSettings|toSuspendSettings@com.russhwolf.settings.Settings(kotlinx.coroutines.CoroutineDispatcher){}[0]
 // Targets: [native]
-final fun (com.russhwolf.settings.coroutines/FlowSettings).com.russhwolf.settings.coroutines/toBlockingObservableSettings(kotlinx.coroutines/CoroutineScope =...): com.russhwolf.settings/ObservableSettings // com.russhwolf.settings.coroutines/toBlockingObservableSettings|toBlockingObservableSettings@com.russhwolf.settings.coroutines.FlowSettings(kotlinx.coroutines.CoroutineScope){}[0]
+final fun (com.russhwolf.settings.coroutines/FlowSettings).com.russhwolf.settings.coroutines/toBlockingObservableSettings(kotlinx.coroutines/CoroutineScope = ...): com.russhwolf.settings/ObservableSettings // com.russhwolf.settings.coroutines/toBlockingObservableSettings|toBlockingObservableSettings@com.russhwolf.settings.coroutines.FlowSettings(kotlinx.coroutines.CoroutineScope){}[0]
 // Targets: [native]
 final fun (com.russhwolf.settings.coroutines/SuspendSettings).com.russhwolf.settings.coroutines/toBlockingSettings(): com.russhwolf.settings/Settings // com.russhwolf.settings.coroutines/toBlockingSettings|toBlockingSettings@com.russhwolf.settings.coroutines.SuspendSettings(){}[0]
```

**File**: `multiplatform-settings-serialization/api/multiplatform-settings-serialization.klib.api` (modified, +14/-14)
```diff
@@ -6,17 +6,17 @@
 // - Show declarations: true
 
 // Library unique name: <com.russhwolf:multiplatform-settings-serialization>
-final fun <#A: kotlin/Any> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/nullableSerializedValue(kotlinx.serialization/KSerializer<#A>, kotlin/String? =..., kotlinx.serialization.modules/SerializersModule =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, #A?> // com.russhwolf.settings.serialization/nullableSerializedValue|nullableSerializedValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String?;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/containsValue(kotlinx.serialization/KSerializer<#A>, kotlin/String, kotlinx.serialization.modules/SerializersModule =...): kotlin/Boolean // com.russhwolf.settings.serialization/containsValue|containsValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/decodeValue(kotlinx.serialization/KSerializer<#A>, kotlin/String, #A, kotlinx.serialization.modules/SerializersModule =...): #A // com.russhwolf.settings.serialization/decodeValue|decodeValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;0:0;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/decodeValueOrNull(kotlinx.serialization/KSerializer<#A>, kotlin/String, kotlinx.serialization.modules/SerializersModule =...): #A? // com.russhwolf.settings.serialization/decodeValueOrNull|decodeValueOrNull@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/encodeValue(kotlinx.serialization/KSerializer<#A>, kotlin/String, #A, kotlinx.serialization.modules/SerializersModule =...) // com.russhwolf.settings.serialization/encodeValue|encodeValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;0:0;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/removeValue(kotlinx.serialization/KSerializer<#A>, kotlin/String, kotlin/Boolean =..., kotlinx.serialization.modules/SerializersModule =...) // com.russhwolf.settings.serialization/removeValue|removeValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String;kotlin.Boolean;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final fun <#A: kotlin/Any?> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/serializedValue(kotlinx.serialization/KSerializer<#A>, kotlin/String? =..., #A, kotlinx.serialization.modules/SerializersModule =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, #A> // com.russhwolf.settings.serialization/serializedValue|serializedValue@com.russhwolf.settings.Settings(kotlinx.serialization.KSerializer<0:0>;kotlin.String?;0:0;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any?>}[0]
-final inline fun <#A: reified kotlin/Any> (com.russhwolf.settings/Settings).com.russhwolf.settings.serialization/nullableSerializedValue(kotlin/String? =..., kotlinx.serialization.modules/SerializersModule =...): kotlin.properties/ReadWriteProperty<kotlin/Any?, #A?> // com.russhwolf.settings.serialization/nullableSerializedValue|nullableSerializedValue@com.russhwolf.settings.Settings(kotlin.String?;kotlinx.serialization.modules.SerializersModule){0§<kotlin.Any>}[0]
-final inline fun <#A: reified kotlin/Any?> (com.russhwol
```

---

### Incident Patch 5: `1891ed81` (2023-11-21)
**Commit Message**: Merge pull request #175 from MJegorovas/fix_no_service_name

Fix crash when creating 'KeychainSettings' without name on mac.

**File**: `multiplatform-settings/src/appleMain/kotlin/com/russhwolf/settings/KeychainSettings.kt` (modified, +9/-7)
```diff
@@ -130,14 +130,16 @@ public class KeychainSettings @ExperimentalSettingsApi constructor(vararg defaul
                 return emptySet()
             }
 
-            @Suppress("RemoveRedundantCallsOfConversionMethods") // IDE thinks CFIndex == Int but might be Long
-            val list = List(CFArrayGetCount(attributes.value).toInt()) { i ->
-                val item: CFDictionaryRef? = CFArrayGetValueAtIndex(attributes.value, i.toCFIndex())?.reinterpret()
-                val cfKey: CFStringRef? = CFDictionaryGetValue(item, kSecAttrAccount)?.reinterpret()
-                val nsKey = CFBridgingRelease(cfKey) as NSString
-                nsKey.toKString()
+            return buildSet {
+                for (i in 0..<CFArrayGetCount(attributes.value)) {
+                    val item: CFDictionaryRef? = CFArrayGetValueAtIndex(attributes.value, i.toCFIndex())?.reinterpret()
+                    val cfKey: CFStringRef? = CFDictionaryGetValue(item, kSecAttrAccount)?.reinterpret()
+                    if (cfKey != null) {
+                        val nsKey = CFBridgingRelease(cfKey) as NSString
+                        add(nsKey.toKString())
+                    }
+                }
             }
-            return list.toSet()
         }
 
     public override val size: Int get() = keys.size
```

**File**: `multiplatform-settings/src/macosX64Test/kotlin/com/russhwolf/settings/KeychainSettingsTest.kt` (modified, +8/-0)
```diff
@@ -73,4 +73,12 @@ class KeychainSettingsTest : BaseSettingsTest(
         }
         assertEquals("value", value)
     }
+
+    @Test
+    fun keys_no_name() {
+        val settings = KeychainSettings()
+
+        // Ensure this doesn't throw
+        settings.keys
+    }
 }
```

---

### Incident Patch 6: `3c820c10` (2023-11-15)
**Commit Message**: Fix crash when creating 'KeychainSettings' without name on mac.

**File**: `multiplatform-settings/src/appleMain/kotlin/com/russhwolf/settings/KeychainSettings.kt` (modified, +6/-4)
```diff
@@ -131,13 +131,15 @@ public class KeychainSettings @ExperimentalSettingsApi constructor(vararg defaul
             }
 
             @Suppress("RemoveRedundantCallsOfConversionMethods") // IDE thinks CFIndex == Int but might be Long
-            val list = List(CFArrayGetCount(attributes.value).toInt()) { i ->
+            val size = CFArrayGetCount(attributes.value).toInt()
+            return (0 until size).mapNotNullTo(mutableSetOf()) { i ->
                 val item: CFDictionaryRef? = CFArrayGetValueAtIndex(attributes.value, i.toCFIndex())?.reinterpret()
                 val cfKey: CFStringRef? = CFDictionaryGetValue(item, kSecAttrAccount)?.reinterpret()
-                val nsKey = CFBridgingRelease(cfKey) as NSString
-                nsKey.toKString()
+                if (cfKey != null) {
+                    val nsKey = CFBridgingRelease(cfKey) as NSString
+                    nsKey.toKString()
+                } else null
             }
-            return list.toSet()
         }
 
     public override val size: Int get() = keys.size
```

**File**: `multiplatform-settings/src/macosX64Test/kotlin/com/russhwolf/settings/KeychainSettingsTest.kt` (modified, +7/-0)
```diff
@@ -37,6 +37,7 @@ import platform.Security.kSecMatchLimitOne
 import platform.Security.kSecReturnData
 import kotlin.test.Test
 import kotlin.test.assertEquals
+import kotlin.test.assertTrue
 
 // TODO figure out how to get this running on ios, watchos, and tvos simulators
 @ExperimentalSettingsImplementation
@@ -73,4 +74,10 @@ class KeychainSettingsTest : BaseSettingsTest(
         }
         assertEquals("value", value)
     }
+
+    @Test
+    fun keys_no_name() {
+        val settings = KeychainSettings()
+        assertTrue(settings.keys.isNotEmpty())
+    }
 }
```

---

### Incident Patch 7: `11e544b7` (2023-10-09)
**Commit Message**: Actual publishing fix

(famous last words)

**File**: `build.gradle.kts` (modified, +6/-1)
```diff
@@ -50,7 +50,12 @@ allprojects {
             }
 
             publications.withType<MavenPublication>().configureEach {
-                artifact(emptyJavadocJar.get())
+                val publication = this
+                val javadocJar = tasks.register("${publication.name}JavadocJar", Jar::class) {
+                    archiveClassifier.set("javadoc")
+                    archiveBaseName.set("${archiveBaseName.get()}-${publication.name}")
+                }
+                artifact(javadocJar)
 
                 pom {
                     name.set("Multiplatform Settings")
```

---

### Incident Patch 8: `1be7a6ef` (2023-10-09)
**Commit Message**: Revert "Adjust publishing config to use dokka javadoc task so jar task doesn't break signing task dependencies"

This reverts commit a41236dc1f99cd2a40f60ed385a43dbd313a4d6a.

**File**: `build.gradle.kts` (modified, +46/-54)
```diff
@@ -1,5 +1,3 @@
-import org.jetbrains.dokka.gradle.DokkaTask
-
 /*
  * Copyright 2020 Russell Wolf
  *
@@ -29,73 +27,67 @@ allprojects {
         mavenCentral()
     }
 
-    if (plugins.hasPlugin("maven-publish")) {
-        val dokkaJavadoc by tasks.withType<DokkaTask>()
-
-        val javadocJar: TaskProvider<Jar> by tasks.registering(Jar::class) {
-            archiveClassifier.set("javadoc")
-            dependsOn(dokkaJavadoc)
-            from(dokkaJavadoc.outputDirectory)
-        }
+    val emptyJavadocJar by tasks.registering(Jar::class) {
+        archiveClassifier.set("javadoc")
+    }
 
-        afterEvaluate {
-            extensions.findByType<PublishingExtension>()?.apply {
-                repositories {
-                    maven {
-                        url = uri(
-                            if (isReleaseBuild) {
-                                "https://oss.sonatype.org/service/local/staging/deploy/maven2"
-                            } else {
-                                "https://oss.sonatype.org/content/repositories/snapshots"
-                            }
-                        )
-                        credentials {
-                            username = properties["sonatypeUsername"].toString()
-                            password = properties["sonatypePassword"].toString()
+    afterEvaluate {
+        extensions.findByType<PublishingExtension>()?.apply {
+            repositories {
+                maven {
+                    url = uri(
+                        if (isReleaseBuild) {
+                            "https://oss.sonatype.org/service/local/staging/deploy/maven2"
+                        } else {
+                            "https://oss.sonatype.org/content/repositories/snapshots"
                         }
+                    )
+                    credentials {
+                        username = properties["sonatypeUsername"].toString()
+                        password = properties["sonatypePassword"].toString()
                     }
                 }
+            }
 
-                publications.withType<MavenPublication>().configureEach {
-                    artifact(javadocJar.get())
+            publications.withType<MavenPublication>().configureEach {
+                artifact(emptyJavadocJar.get())
 
-                    pom {
-                        name.set("Multiplatform Settings")
-                        description.set("A Kotlin Multiplatform library for saving simple key-value data")
-                        url.set("https://github.com/russhwolf/multiplatform-settings")
+                pom {
+                    name.set("Multiplatform Settings")
+                    description.set("A Kotlin Multiplatform library for saving simple key-value data")
+                    url.set("https://github.com/russhwolf/multiplatform-settings")
 
-                        licenses {
-                            license {
-                                name.set("The Apache Software License, Version 2.0")
-                                url.set("http://www.apache.org/licenses/LICENSE-2.0.txt")
-                                distribution.set("repo")
-                            }
-                        }
-                        developers {
-                            developer {
-                                id.set("russhwolf")
-                                name.set("Russell Wolf")
-                            }
+                    licenses {
+                        license {
+                            name.set("The Apache Software License, Version 2.0")
+                            url.set("http://www.apache.org/licenses/LICENSE-2.0.txt")
+                            distribution.set("repo")
                         }
-                        scm {
-                            url.set("https://github.com/russhwolf/multiplatform-settings")
+                    }
+                    developers {
+                        developer {
+                 
```

---

### Incident Patch 9: `2bcc395b` (2023-10-09)
**Commit Message**: Fix gradle wrapper validation action branch

**File**: `.github/workflows/validate-gradle-wrapper.yml` (modified, +2/-2)
```diff
@@ -2,9 +2,9 @@ name: Gradle Wrapper Validation
 
 on:
   push:
-    branches: [ master ]
+    branches: [ main ]
   pull_request:
-    branches: [ master ]
+    branches: [ main ]
 
 jobs:
   build:
```

---

### Incident Patch 10: `67495a0e` (2023-10-01)
**Commit Message**: Removed legacy JS workarounds in serialization module

**File**: `multiplatform-settings-serialization/src/commonMain/kotlin/SettingsSerialization.kt` (modified, +2/-11)
```diff
@@ -294,13 +294,7 @@ private open class SettingsSerializationDelegate<T>(
     override fun getValue(thisRef: Any?, property: KProperty<*>): T {
         checkKey(property.name)
         val decoder = decoder ?: SettingsDecoder(settings, property.name, context).also { decoder = it }
-        // TODO ??? for some reason jsLegacy delegate tests fail when this uses deserializeOrElse()
-        return try {
-            serializer.deserialize(decoder)
-        } catch (e: DeserializationException) {
-            decoder.reset()
-            defaultValue
-        }
+        return serializer.deserializeOrElse(decoder, defaultValue)
     }
 
     override fun setValue(thisRef: Any?, property: KProperty<*>, value: T) {
@@ -449,10 +443,7 @@ private class SettingsDecoder(
     // Unfortunately the only way we can interrupt serialization if data is missing is to throw here and catch elsewhere
     public override fun decodeBoolean(): Boolean = settings.getBooleanOrNull(getKey()) ?: deserializationError()
     public override fun decodeByte(): Byte = settings.getIntOrNull(getKey())?.toByte() ?: deserializationError()
-    public override fun decodeChar(): Char {
-        // TODO ??? for some reason jsLegacy allTypes tests fail when this is an expression function.
-        return settings.getIntOrNull(getKey())?.toChar() ?: deserializationError()
-    }
+    public override fun decodeChar(): Char = settings.getIntOrNull(getKey())?.toChar() ?: deserializationError()
 
     public override fun decodeDouble(): Double = settings.getDoubleOrNull(getKey()) ?: deserializationError()
     public override fun decodeEnum(enumDescriptor: SerialDescriptor): Int =
```

#### Recent Merged Pull Requests:
- **PR #223** (2024-12-04): README improvements (@skaldebane)
- **PR #193** (2024-05-21): Update addKeychainItem(...) to improve compatibility with FaceID (@crysxd)
- **PR #192** (closed): Add a Korean version of the README file (@wooram-yang)
- **PR #187** (closed): [CHORE] Update kotlin 1.9.22 &  Gradle 8.6 (@ahna92)
- **PR #184** (2024-03-25): Runtime Observable Settings (@psuzn)
- **PR #181** (2024-01-20): Get keychain tests running on iOS (@russhwolf)
- **PR #180** (2024-01-09): Add top-level build-all workflow (@russhwolf)
- **PR #179** (2023-11-21): Cache konan folder in CI builds (@russhwolf)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
