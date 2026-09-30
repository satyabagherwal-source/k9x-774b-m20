# Forensic Learning Record (Deep Inspection): kosi-libs/Kodein

> **Canonical Artifact**: `07_PROJECT_LEARNING/kosi-libs-kodein-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kosi-libs/Kodein](https://github.com/kosi-libs/Kodein))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:34:54.124Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kosi-libs/Kodein`
- **Description**: Painless Kotlin Dependency Injection
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3334 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #513** (2026-07-21): **fix(#508): handle NoClassDefFoundError during JSR-330 injection**
  *Symptoms*: Skip class hierarchy levels that reference types absent at runtime, allowing injection to continue up the chain. Logs a WARNING when a level is skipped.  This fixes injection on Android devices where a compiled app may reference platform types that don't exist at runtime (e.g., ComponentActivity below API 31 referencing PictureInPictureUiState from androidx.activity 1.13.0+).

- **Issue #512** (2026-07-19): **The documentation website is not working.**
  *Symptoms*: https://kosi-libs.org/kodein/
  **Post-Mortem & Fix Analysis**:
  > Any updates? 
  > Wow thanks, I'll look into this ASAP!
  > It is live again. Sorry 😔 

- **Issue #511** (2026-07-21): **fix(#508): tolerate unresolvable member types during reflective injection**
  *Symptoms*: ## Problem  Injecting into any subclass of `ComponentActivity` crashes with `java.lang.NoClassDefFoundError: Failed resolution of: Landroid/app/PictureInPictureUiState` on Android devices running below API 31. `PictureInPictureUiState` was introduced in API 31, and the failure started appearing after upgrading `androidx.activity:activity` from `1.12.4` to `1.13.0`.  ``` java.lang.NoClassDefFoundError: Failed resolution of: Landroid/app/PictureInPictureUiState;     at java.lang.reflect.Executable.getParameterTypesInternal(...)     at java.lang.reflect.Method.getParameterTypes(...)     at java.lang.Class.getDeclaredMethods(...)     at org.kodein.di.jxinject.internal.JxInjectorContainer.fillMembersSetters(...) ```  ## Root cause  As diagnosed in #508, `fillMembersSetters` enumerates each class in the receiver's hierarchy with `cls.declaredFields` and `cls.declaredMethods`. Both `Class.getDeclaredMethods()` and `Class.getDeclaredFields()` **eagerly resolve the types referenced by every member's signature**. When a member references a type that is absent at runtime — here a platform class from a newer API level than the device provides — the whole enumeration throws `NoClassDefFoundError` before we can inspect any individual member, even though the offending member is not annotated with `@Inject`.  The reporter confirmed `cls.declaredMethods` is the trigger and noted `cls.declaredFields` could fail the same way under other circumstances. A Google engineer replying on the correspon
  **Post-Mortem & Fix Analysis**:
  > Thanks 🙏 , based on what you suggested I've done things slightly different [here](https://github.com/kosi-libs/Kodein/pull/513)

- **Issue #510** (2026-07-19): **Regenerate Kotlin/JS yarn.lock for Kotlin 2.4.0**
  *Symptoms*: ## Summary - Regenerates `kotlin-js-store/yarn.lock` (and removes the now-unused `kotlin-js-store/wasm/yarn.lock`) to sync with the internal Kodein Gradle plugin 9.2.0 / Kotlin 2.4.0 already pinned in `settings.gradle.kts`. - Part of a coordinated lockfile-sync update across kosi-libs projects — mirrors the fix already applied in the sibling `Canard` project, which hit CI failures on `:kotlinStoreYarnLock` with "Lock file was changed. Run the `kotlinUpgradeYarnLock` task to actualize lock file". - Verified locally by re-running `kotlinUpgradeYarnLock` / `kotlinWasmUpgradeYarnLock` — both report the lockfile as up to date (no diff after regeneration), and the JS/Wasm yarn-lock tasks all report `UP-TO-DATE`/`SKIPPED` with no "Lock file was changed" error during `./gradlew check`.  ## Test plan - [ ] CI (`check` workflow — unit-tests / check-with-android) passes with no yarn/lockfile-staleness errors

- **Issue #508** (2026-07-21): **Unavoidable exception when injecting into latest androidx ComponentActivity**
  *Symptoms*: When trying to inject into any subclass of `ComponentActivity`, we see a `java.lang.NoClassDefFoundError: Failed resolution of: Landroid/app/PictureInPictureUiState` on Android devices lower than API 31. The `PictureInPictureUiState` class was added in API 31, and it seems that a call to `getDeclaredMethods` triggers attempted access to this class.  We only began seeing this issue after upgrading `androidx.activity:activity` from `1.12.4` to `1.13.0` and I initially assumed it was an issue with the new Activity library version because this part of Kodein hasn't changed since 2017, however an engineer at Google responded to an issue report and said that callers need to be more lenient: https://issuetracker.google.com/issues/492945630#comment4  Relevant part of the stack trace: ``` java.lang.NoClassDefFoundError: Failed resolution of: Landroid/app/PictureInPictureUiState;     at java.lang.reflect.Executable.getParameterTypesInternal(...)     at java.lang.reflect.Method.getParameterTypes(...)     at java.lang.Class.getDeclaredMethods(...)     at org.kodein.di.jxinject.internal.JxInjectorContainer.fillMembersSetters(...) ```  I did some digging and found there are two `fillSetters` calls in JxInjectorContainer.kt (see: https://github.com/kosi-libs/Kodein/blob/v7.32.0/kodein-di-jxinject-jvm/src/main/kotlin/org/kodein/di/jxinject/internal/JxInjectorContainer.kt#L157-L176) that may need to become more lenient: - the first `fillSetters` call passes in `cls.declaredFields` (this may o
  **Post-Mortem & Fix Analysis**:
  > fixed in https://github.com/kosi-libs/Kodein/releases/tag/v7.33.0.   Just curious, why don't you use android specific Kodein modules?
  > @romainbsl that decision was made before my time here, but my understanding is our app introduced Kodein a long time ago (either 2017 or 2018) and it was implemented behind an abstraction that hides which DI framework is being used, so JSR-330 injection is used as a way to avoid having Kodein-specific code throughout the codebase.  Your caution note is interesting, I was not aware we are paying a perf penalty by using JSR-330 on all our legacy Activity/Fragment injections. We have more than 100 such calls, sounds like I might need to investigate further.  Thank you for the fix! 🙏

- **Issue #507** (2026-03-25): **fix((#506): update KodeinViewModelScopedFactory and KodeinViewModelScopedSingleton to use generic types**
  *Symptoms*: This pull request refactors how ViewModel factories are created and used with Kodein DI in both Android and multiplatform Compose modules. The main focus is to ensure that the correct type information for ViewModels is passed explicitly, improving type safety and reliability. It also introduces deprecation warnings for older factory constructors and marks the main factory classes as internal.  **Key changes:**  ### Type Safety and Factory Construction  * Both `KodeinViewModelScopedFactory` and `KodeinViewModelScopedSingleton` now require an explicit `vmType` (`TypeToken<*>`) parameter, ensuring the correct ViewModel type is used for DI resolution. Previous usage of `erased(modelClass)` is replaced with `generic<VM>()` for better type inference. [[1]](diffhunk://#diff-5ef990178895d1b21fa47a664d53b94c5fe30d35ff2978466b41ba9b0f214400L11-R55) [[2]](diffhunk://#diff-ab140d128ab8cf8de08e23934c99a426e56aec10730afd826bed92b1f8adf43fL12-R56) * All usages of these factories in Compose utility functions (`rememberViewModel`, `viewModel`, and navigation-scoped ViewModel providers) have been updated to pass the explicit `vmType` parameter using `generic<VM>()`. [[1]](diffhunk://#diff-f60f5df3bae74d76ff85c13a0493ab86c2372f3b54a5f6839a8c273c342543e9L35-R35) [[2]](diffhunk://#diff-f60f5df3bae74d76ff85c13a0493ab86c2372f3b54a5f6839a8c273c342543e9L64-R64) [[3]](diffhunk://#diff-f60f5df3bae74d76ff85c13a0493ab86c2372f3b54a5f6839a8c273c342543e9L102-R103) [[4]](diffhunk://#diff-f60f5df3bae74

- **Issue #506** (2026-03-25): **Compose rememberViewModel can crash with generic ViewModel bounds (Cannot create TypeToken for non fully reified type)**
  *Symptoms*: ### Describe the bug When using `org.kodein.di.compose.viewmodel.rememberViewModel` with a generic `ViewModel` subclass, runtime lookup will crash with:  `IllegalArgumentException: Cannot create TypeToken for non fully reified type ...`  In our case this happens with FlowMVI's `ContainerViewModel<T, S, I, A>` (`pro.respawn.flowmvi.android.ContainerViewModel`).  ### Stacktrace ```text java.lang.IllegalArgumentException: Cannot create TypeToken for non fully reified type pro.respawn.flowmvi.api.Container<S, I, A>     at org.kodein.type.TypeTokensJVMKt.typeToken(typeTokensJVM.kt:101)     at org.kodein.type.JVMClassTypeToken.getGenericParameters(JVMClassTypeToken.kt:10)     at org.kodein.type.AbstractTypeToken.equals(TypeToken.kt:117)     at org.kodein.type.AbstractTypeToken.isAssignableFrom(TypeToken.kt:86)     at org.kodein.di.internal.TypeChecker$Up.check(DITreeImpl.kt:18)     ...     at org.kodein.di.compose.viewmodel.KodeinViewModelScopedSingleton.create(KodeinViewModelScope.kt:44) ```  ### Reproduction 1. Bind a generic ViewModel in DI (example with FlowMVI): ```kotlin  bind<ContainerViewModel<MyContainer, MyState, MyIntent, MyAction>>() with provider {     ContainerViewModel(MyContainer(...)) } ``` Here all functions used are inline and parameters reified (so the error message will be misleading)  2. Resolve it from compose:  ```kotlin val vm by rememberViewModel<ContainerViewModel<MyContainer, MyState, MyIntent, MyAction>>() ```  in this function, the ContainerViewModel i
  **Post-Mortem & Fix Analysis**:
  > Fixed in https://github.com/kosi-libs/Kodein/releases/tag/v7.32.0  Let me know if that's ok for you.

- **Issue #505** (2026-03-23): **fix((#504): bring back scope on SetBinder and ArgSetBinder**
  *Symptoms*: 

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

### Incident Patch 1: `4c2a4813` (2026-07-21)
**Commit Message**: fix(#508): handle NoClassDefFoundError during JSR-330 injection (#513)

Skip class hierarchy levels that reference types absent at runtime, allowing
injection to continue up the chain. Logs a WARNING when a level is skipped.

This fixes injection on Android devices where a compiled app may reference
platform types that don't exist at runtime (e.g., ComponentActivity below API 31
referencing PictureInPictureUiState from androidx.activity 1.13.0+).

**File**: `CHANGELOG.md` (modified, +23/-1)
```diff
@@ -1,4 +1,26 @@
-#### 7.30.0 (TBD)
+#### 7.33.0 (TBD)
+
+## What's Changed
+* **Fixed `NoClassDefFoundError` during JSR-330 injection** (#508):
+    * Injecting into a class whose hierarchy declares a member referencing a type absent at runtime no longer fails
+    * Notably affected any `ComponentActivity` subclass below API 31 since `androidx.activity` 1.13.0, which declares `onPictureInPictureUiStateChanged(android.app.PictureInPictureUiState)` (an API 31 type)
+    * Such a class level is now skipped and injection continues up the hierarchy; documented in the JSR-330 page
+    * The skip is reported as a `WARNING` on the `org.kodein.di.jxinject` `java.util.logging` logger (logcat tag `org.kodein.di.jxinject` on Android), silenceable with `org.kodein.di.jxinject.level = OFF`
+* Kotlin 2.4.0 / KIGP 9.2.0 / Kaverit 2.13.0 / Gradle 9.3.1 / Compose 1.10.3
+* Migrated the Android Compose namespace to the target API
+
+#### 7.32.0 (2026-03-25)
+
+## What's Changed
+* Fixed `KodeinViewModelScopedFactory` and `KodeinViewModelScopedSingleton` to use generic types (#506)
+* Brought back scope on `SetBinder` and `ArgSetBinder` (#504)
+
+#### 7.31.0 (2026-02-08)
+
+## What's Changed
+* Upgraded Ktor dependency from 3.3.2 to 3.4.0 (#503)
+
+#### 7.30.0 (2025-11-20)
 
 ## What's Changed
 * Fixed DSL receiver scope issue (#478): Applied `@DslMarker` to DSL receiver interfaces to prevent accidental calls to outer receiver methods
```

**File**: `doc/modules/extension/pages/jsr330.adoc` (modified, +39/-0)
```diff
@@ -17,6 +17,45 @@ CAUTION: Every-thing that is described here is *a lot less performant* than usin
          Kittens *will* die painfully if you do!
 
 
+[[hierarchy]]
+== What gets visited
+
+`inject` does not look at the receiver's class alone: it walks the *entire* class hierarchy up to `Object` and enumerates every declared field and method of each level, looking for those annotated with `@Inject`.
+
+Two consequences are worth knowing:
+
+- The cost grows with inheritance depth, including superclasses you do not own.
+- A class level whose members cannot be introspected is *skipped*, and injection continues with the rest of the hierarchy.
+  This happens when a member's signature references a type that is absent at run-time, whether or not that member is annotated with `@Inject`.
+  An `@Inject` member on such a level is not injected, and no exception is raised.
+
+The typical case is Android, where a framework class compiled against a recent SDK may reference a platform type that does not exist on the device's API level.
+
+Because the failure is precisely the inability to enumerate members, Kodein-DI cannot know whether the skipped level declared any `@Inject` member.
+It therefore logs a `WARNING` on the `org.kodein.di.jxinject` logger, using `java.util.logging`:
+
+[source]
+----
+WARNING: Could not introspect the methods of androidx.activity.ComponentActivity: any @Inject member it
+declares will NOT be injected. This usually means a member signature references a type that is absent at
+runtime.
+----
+
+On Android this reaches logcat as a `WARN` entry tagged `org.kodein.di.jxinject`.
+
+If the skipped level is a framework class you do not own, the warning is expected and there is nothing to fix; you can silence it through the standard `java.util.logging` configuration.
+
+[source,properties]
+.Example: silencing the warning
+----
+org.kodein.di.jxinject.level = OFF
+----
+
+CAUTION: On Android, do not use JSR-330 injection on framework components (`Activity`, `Fragment`, `Service`...).
+         Their hierarchy is deep and entirely outside of your control, so every injection pays to walk it and is subject to the behaviour described above.
+         Use Kodein-DI's standard retrieval instead (`by instance()`), which uses no member reflexivity at all: see xref:framework:android.adoc[Android].
+
+
 [[install]]
 == Install
 
```

**File**: `kodein-di-jxinject-jvm/src/main/kotlin/org/kodein/di/jxinject/internal/JxInjectorContainer.kt` (modified, +38/-2)
```diff
@@ -7,10 +7,23 @@ import org.kodein.type.typeToken
 import java.lang.reflect.*
 import java.util.*
 import java.util.concurrent.ConcurrentHashMap
+import java.util.logging.Level
+import java.util.logging.Logger
 import javax.inject.Inject
 import javax.inject.Provider
 
 internal class JxInjectorContainer(qualifiers: Set<Qualifier>) {
+    internal companion object {
+        /**
+         * Deliberately a literal rather than this class' name: [JxInjectorContainer] is internal and its FQN is an
+         * implementation detail, whereas this name is documented for users to configure. It is also 22 characters, so
+         * Android's `AndroidHandler` uses it verbatim as the logcat tag (it truncates anything longer than 23).
+         */
+        private const val LOGGER_NAME: String = "org.kodein.di.jxinject"
+
+        private val logger: Logger = Logger.getLogger(LOGGER_NAME)
+    }
+
     internal class Qualifier(val cls: Class<out Annotation>, val tagProvider: (Annotation) -> Any)
 
     private val _qualifiers = qualifiers.associate { it.cls to it.tagProvider }
@@ -138,6 +151,29 @@ internal class JxInjectorContainer(qualifiers: Set<Qualifier>) {
             }
     }
 
+    /**
+     * Enumerating declared members eagerly resolves the types referenced by every member's signature, whether or not
+     * that member is annotated with [Inject]. A signature referencing a type that is absent at runtime therefore makes
+     * the whole enumeration fail. This happens on Android, where a class compiled against a recent SDK may reference a
+     * platform type that does not exist on an older device (see https://github.com/kosi-libs/Kodein/issues/508).
+     *
+     * Such a level is skipped and the walk up the hierarchy continues. Because the failure *is* the inability to
+     * enumerate, we cannot know whether the level declared any [Inject] member, so this is reported as a possibility
+     * rather than as a fact.
+     */
+    private inline fun <reified M> declaredMembersOrEmpty(cls: Class<*>, kind: String, members: () -> Array<M>): Array<M> =
+        try {
+            members()
+        } catch (error: LinkageError) {
+            logger.log(
+                Level.WARNING,
+                "Could not introspect the $kind of ${cls.name}: any @Inject member it declares will NOT be injected. " +
+                    "This usually means a member signature references a type that is absent at runtime.",
+                error
+            )
+            emptyArray()
+        }
+
     private tailrec fun fillMembersSetters(cls: Class<*>, setters: MutableList<DirectDI.(Any) -> Any>) {
         if (cls == Any::class.java)
             return
@@ -155,7 +191,7 @@ internal class JxInjectorContainer(qualifiers: Set<Qualifier>) {
         }
 
         fillSetters(
-            members = cls.declaredFields,
+            members = declaredMembersOrEmpty(cls, "fields") { cls.declaredFields },
             elements = { arrayOf(FieldElement(this)) },
             call = { receiver, values -> set(receiver, values[0]) },
             setters = setters
@@ -169,7 +205,7 @@ internal class JxInjectorContainer(qualifiers: Set<Qualifier>) {
         }
 
         fillSetters(
-            members = cls.declaredMethods,
+            members = declaredMembersOrEmpty(cls, "methods") { cls.declaredMethods },
             elements = { (0 until parameterTypes.size).map { ParameterElement(this, it) }.toTypedArray() },
             call = { receiver, values -> invoke(receiver, *values) },
             setters = setters
```

**File**: `kodein-di-jxinject-jvm/src/test/java/org/kodein/di/jxinject/InjectJvmTests_05_LenientReflection.java` (added, +221/-0)
```diff
@@ -0,0 +1,221 @@
+package org.kodein.di.jxinject;
+
+import org.junit.FixMethodOrder;
+import org.junit.Test;
+import org.junit.runners.MethodSorters;
+
+import javax.inject.Inject;
+import java.io.ByteArrayOutputStream;
+import java.io.IOException;
+import java.io.InputStream;
+import java.lang.reflect.Constructor;
+import java.lang.reflect.Field;
+import java.util.ArrayList;
+import java.util.Arrays;
+import java.util.HashSet;
+import java.util.List;
+import java.util.Set;
+import java.util.logging.Handler;
+import java.util.logging.Level;
+import java.util.logging.LogRecord;
+import java.util.logging.Logger;
+
+import static org.junit.Assert.*;
+
+/**
+ * Regression tests for https://github.com/kosi-libs/Kodein/issues/508
+ *
+ * On Android, an app compiles against a recent SDK but runs against the device's framework. A class
+ * introduced in API 31 such as {@code android.app.PictureInPictureUiState} is simply absent at runtime on an
+ * API 30 device. That is normally harmless, because ART only fails when such a method is actually executed.
+ * Reflection defeats that leniency: {@code getDeclaredMethods()} / {@code getDeclaredFields()} eagerly resolve
+ * the types in every member's signature, so a single unresolvable type makes the whole enumeration throw
+ * {@link NoClassDefFoundError} -- even for members that carry no {@code @Inject} annotation.
+ *
+ * Since androidx.activity 1.13.0, {@code ComponentActivity} declares
+ * {@code onPictureInPictureUiStateChanged(android.app.PictureInPictureUiState)} directly, so walking the
+ * superclass chain of any Activity hits exactly that.
+ *
+ * These tests reproduce the failure on a plain JVM with a class loader that refuses to resolve one type.
+ */
+@FixMethodOrder(MethodSorters.NAME_ASCENDING)
+public class InjectJvmTests_05_LenientReflection {
+
+    /** Loads {@code reloaded} classes itself, refuses to resolve {@code hidden}, delegates everything else. */
+    private static final class HidingClassLoader extends ClassLoader {
+        private final String hidden;
+        private final Set<String> reloaded;
+
+        HidingClassLoader(ClassLoader parent, String hidden, String... reloaded) {
+            super(parent);
+            this.hidden = hidden;
+            this.reloaded = new HashSet<>(Arrays.asList(reloaded));
+        }
+
+        @Override
+        protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
+            if (name.equals(hidden))
+                throw new ClassNotFoundException(name + " does not exist at runtime (mimics an API level too low)");
+
+            synchronized (getClassLoadingLock(name)) {
+                Class<?> cls = findLoadedClass(name);
+                if (cls == null) {
+                    if (reloaded.contains(name)) {
+                        byte[] bytes = readBytecode(name);
+                        cls = defineClass(name, bytes, 0, bytes.length);
+                    } else {
+                        cls = getParent().loadClass(name);
+                    }
+                }
+                if (resolve) resolveClass(cls);
+                return cls;
+            }
+        }
+
+        private byte[] readBytecode(String name) throws ClassNotFoundException {
+            String path = name.replace('.', '/') + ".class";
+            try (InputStream in = getParent().getResourceAsStream(path)) {
+                if (in == null) throw new ClassNotFoundException(name);
+                ByteArrayOutputStream out = new ByteArrayOutputStream();
+                byte[] buffer = new byte[8192];
+                int read;
+                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
+                return out.toByteArray();
+            } catch (IOException e) {
+                throw new ClassNotFoundException(name, e);
+            }
+        }
+    }
+
+    private static final String MISSING = "org.kodein.di.jxinject.LenientMissing";
+    private static final String
```

---

### Incident Patch 2: `ba2ffa38` (2026-03-25)
**Commit Message**: fix((#506): update KodeinViewModelScopedFactory and KodeinViewModelScopedSingleton to use generic types (#507)

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/KodeinViewModelScopedFactory.kt` (modified, +31/-3)
```diff
@@ -8,20 +8,48 @@ import org.kodein.di.direct
 import org.kodein.type.TypeToken
 import org.kodein.type.erased
 
-public class KodeinViewModelScopedFactory<A : Any>(
+@PublishedApi
+internal class KodeinViewModelScopedFactory<A : Any>(
     private val di: DI,
     private val argType: TypeToken<A>,
+    private val vmType: TypeToken<*>,
     private val arg: A,
     private val tag: String? = null,
 ) : ViewModelProvider.Factory {
+    @Suppress("UNCHECKED_CAST")
     override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
-            di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
+            di.direct.Factory(argType, vmType as TypeToken<T>, tag).invoke(arg)
 }
 
-public class KodeinViewModelScopedSingleton(
+@PublishedApi
+internal class KodeinViewModelScopedSingleton(
     private val di: DI,
+    private val vmType: TypeToken<*>,
     private val tag: String? = null,
 ) : ViewModelProvider.Factory {
+    @Suppress("UNCHECKED_CAST")
+    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
+        di.direct.Instance(type = vmType as TypeToken<T>, tag = tag)
+}
+
+@Deprecated("Use rememberViewModel instead.", level = DeprecationLevel.WARNING)
+@Suppress("FunctionName")
+public fun KodeinViewModelScopedSingleton(
+    di: DI,
+    tag: String? = null,
+): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
     override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
         di.direct.Instance(type = erased(modelClass), tag = tag)
 }
+
+@Deprecated("Use rememberViewModel instead.", level = DeprecationLevel.WARNING)
+@Suppress("FunctionName")
+public fun <A : Any> KodeinViewModelScopedFactory(
+    di: DI,
+    argType: TypeToken<A>,
+    arg: A,
+    tag: String? = null,
+): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
+    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
+        di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
+}
```

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/navigation/navGraphViewModel.kt` (modified, +9/-7)
```diff
@@ -8,9 +8,9 @@ import androidx.lifecycle.ViewModelProvider
 import androidx.navigation.NavBackStackEntry
 import androidx.navigation.NavHostController
 import org.kodein.di.compose.localDI
-import org.kodein.di.compose.viewmodel.KodeinViewModelScopedFactory
-import org.kodein.di.compose.viewmodel.KodeinViewModelScopedSingleton
-import org.kodein.type.erased
+import org.kodein.di.compose.android.KodeinViewModelScopedFactory
+import org.kodein.di.compose.android.KodeinViewModelScopedSingleton
+import org.kodein.type.generic
 
 /**
  * Gets an instance of a [VM] as an android [ViewModel], scoped on a [NavGraph], for the given [tag].
@@ -32,7 +32,7 @@ public inline fun <reified VM : ViewModel> NavBackStackEntry.rememberNavGraphVie
         ViewModelLazy(
             viewModelClass = VM::class,
             storeProducer = { navHostController.getBackStackEntry(getParentId()).viewModelStore },
-            factoryProducer = { KodeinViewModelScopedSingleton(di = this, tag = tag) }
+            factoryProducer = { KodeinViewModelScopedSingleton(di = this, vmType = generic<VM>(), tag = tag) }
         )
     }
 }
@@ -61,7 +61,7 @@ public inline fun <reified VM : ViewModel> NavBackStackEntry.navGraphViewModel(
     remember(this@navGraphViewModel, di, tag) {
         val provider = ViewModelProvider(
             navHostController.getBackStackEntry(getParentId()).viewModelStore,
-            KodeinViewModelScopedSingleton(di = di, tag = tag)
+            KodeinViewModelScopedSingleton(di = di, vmType = generic<VM>(), tag = tag)
         )
         if (tag == null) {
             provider[VM::class.java]
@@ -99,7 +99,8 @@ public inline fun <reified A : Any, reified VM : ViewModel> NavBackStackEntry.re
             factoryProducer = {
                 KodeinViewModelScopedFactory(
                     di = di,
-                    argType = erased<A>(),
+                    argType = generic<A>(),
+                    vmType = generic<VM>(),
                     arg = arg,
                     tag = tag,
                 )
@@ -139,7 +140,8 @@ public inline fun <reified A : Any, reified VM : ViewModel> NavBackStackEntry.na
             navHostController.getBackStackEntry(getParentId()).viewModelStore,
             KodeinViewModelScopedFactory(
                 di = di,
-                argType = erased<A>(),
+                argType = generic<A>(),
+                vmType = generic<VM>(),
                 arg = arg,
                 tag = tag,
             )
```

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/viewModel.kt` (modified, +4/-3)
```diff
@@ -31,7 +31,7 @@ public inline fun <reified VM : ViewModel> rememberViewModel(
         ViewModelLazy(
             viewModelClass = VM::class,
             storeProducer = { viewModelStoreOwner.viewModelStore },
-            factoryProducer = { KodeinViewModelScopedSingleton(di = di, tag = tag) },
+            factoryProducer = { KodeinViewModelScopedSingleton(di = di, vmType = generic<VM>(), tag = tag) },
         )
     }
 }
@@ -63,7 +63,7 @@ public inline fun <reified VM : ViewModel> viewModel(
     remember {
         val provider = ViewModelProvider(
             viewModelStoreOwner,
-            KodeinViewModelScopedSingleton(di = di, tag = tag),
+            KodeinViewModelScopedSingleton(di = di, vmType = generic<VM>(), tag = tag),
         )
         if (tag == null) {
             provider[VM::class.java]
@@ -103,6 +103,7 @@ public inline fun <reified A : Any, reified VM : ViewModel> rememberViewModel(
                 KodeinViewModelScopedFactory(
                     di = di,
                     argType = generic<A>(),
+                    vmType = generic<VM>(),
                     arg = arg,
                     tag = tag,
                 )
@@ -142,7 +143,7 @@ public inline fun <reified A : Any, reified VM : ViewModel> viewModel(
     remember {
         val provider = ViewModelProvider(
             viewModelStoreOwner,
-            KodeinViewModelScopedFactory(di = di, argType = generic<A>(), arg = arg, tag = tag),
+            KodeinViewModelScopedFactory(di = di, argType = generic<A>(), vmType = generic<VM>(), arg = arg, tag = tag),
         )
         if (tag == null) {
             provider[VM::class.java]
```

**File**: `framework/compose/kodein-di-framework-compose/src/commonMain/kotlin/org.kodein.di.compose/viewmodel/KodeinViewModelScope.kt` (modified, +31/-20)
```diff
@@ -9,37 +9,48 @@ import org.kodein.type.TypeToken
 import org.kodein.type.erased
 import kotlin.reflect.KClass
 
-/**
- * Factory class for creating ViewModel instances using Kodein dependency injection.
- *
- * @param A The type of argument to be passed to the ViewModel constructor.
- * @property di The instance of the Kodein DI container.
- * @property argType The TypeToken of the argument type.
- * @property arg The argument value to be passed to the ViewModel constructor.
- * @property tag The optional tag to be used for resolving ViewModel instance from DI container.
- */
-public class KodeinViewModelScopedFactory<A : Any>(
+@PublishedApi
+internal class KodeinViewModelScopedFactory<A : Any>(
     private val di: DI,
     private val argType: TypeToken<A>,
+    private val vmType: TypeToken<*>,
     private val arg: A,
     private val tag: String? = null,
 ) : ViewModelProvider.Factory {
+    @Suppress("UNCHECKED_CAST")
     override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
-        di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
+        di.direct.Factory(argType, vmType as TypeToken<T>, tag).invoke(arg)
 }
 
-/**
- * Factory class used to create ViewModel instances with Kodein DI container
- * @param di The Kodein DI container instance
- * @param tag An optional tag to filter the bindings
- *
- * @throws DI.NotFoundException if ViewModel class binding is not found in the DI container
- * @see ViewModelProvider.Factory
- */
-public class KodeinViewModelScopedSingleton(
+@PublishedApi
+internal class KodeinViewModelScopedSingleton(
     private val di: DI,
+    private val vmType: TypeToken<*>,
     private val tag: String? = null,
 ) : ViewModelProvider.Factory {
+    @Suppress("UNCHECKED_CAST")
+    override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
+        di.direct.Instance(type = vmType as TypeToken<T>, tag = tag)
+}
+
+@Deprecated("Use rememberViewModel instead.", level = DeprecationLevel.WARNING)
+@Suppress("FunctionName")
+public fun KodeinViewModelScopedSingleton(
+    di: DI,
+    tag: String? = null,
+): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
     override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
         di.direct.Instance(type = erased(modelClass), tag = tag)
 }
+
+@Deprecated("Use rememberViewModel instead.", level = DeprecationLevel.WARNING)
+@Suppress("FunctionName")
+public fun <A : Any> KodeinViewModelScopedFactory(
+    di: DI,
+    argType: TypeToken<A>,
+    arg: A,
+    tag: String? = null,
+): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
+    override fun <T : ViewModel> create(modelClass: KClass<T>, extras: CreationExtras): T =
+        di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
+}
```

**File**: `framework/compose/kodein-di-framework-compose/src/commonMain/kotlin/org.kodein.di.compose/viewmodel/viewModel.kt` (modified, +2/-1)
```diff
@@ -29,7 +29,7 @@ public inline fun <reified VM : ViewModel> rememberViewModel(
         ViewModelLazy(
             viewModelClass = VM::class,
             storeProducer = { viewModelStoreOwner.viewModelStore },
-            factoryProducer = { KodeinViewModelScopedSingleton(di = di, tag = tag) }
+            factoryProducer = { KodeinViewModelScopedSingleton(di = di, vmType = generic<VM>(), tag = tag) }
         )
     }
 }
@@ -63,6 +63,7 @@ public inline fun <reified A : Any, reified VM : ViewModel> rememberViewModel(
                 KodeinViewModelScopedFactory(
                     di = di,
                     argType = generic<A>(),
+                    vmType = generic<VM>(),
                     arg = arg,
                     tag = tag
                 )
```

---

### Incident Patch 3: `07bc997f` (2026-03-23)
**Commit Message**: fix((#504): bring back scope on SetBinder and ArgSetBinder (#505)

**File**: `kodein-di/src/commonMain/kotlin/org/kodein/di/DI.kt` (modified, +2/-4)
```diff
@@ -304,8 +304,7 @@ public interface DI : DIAware {
         /**
          * Manage multiple bindings in a [Set]
          */
-        @DIDsl
-        public interface SetBinder<T : Any> : BindBuilder.WithScope<Any> {
+        public interface SetBinder<T : Any> {
 
             /**
              * Add a binding in the [Set] of type [T]
@@ -379,8 +378,7 @@ public interface DI : DIAware {
         /**
          * Manage multiple bindings, with type argument, in a [Set]
          */
-        @DIDsl
-        public interface ArgSetBinder<A : Any, T : Any> : BindBuilder.WithScope<Any> {
+        public interface ArgSetBinder<A : Any, T : Any> {
 
             /**
              * Add a binding in the [Set] of type [T]
```

**File**: `kodein-di/src/commonMain/kotlin/org/kodein/di/internal/DIBuilderImpl.kt` (modified, +6/-6)
```diff
@@ -87,9 +87,9 @@ internal open class DIBuilderImpl internal constructor(
         addSetBindingToContainer: Boolean = true,
     ) : DI.Builder.SetBinder<T> {
 
-        override val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
-        override val scope: Scope<Any?> get() = this@DIBuilderImpl.scope
-        override val explicitContext: Boolean get() = this@DIBuilderImpl.explicitContext
+        val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
+        val scope: Scope<Any?> get() = this@DIBuilderImpl.scope
+        val explicitContext: Boolean get() = this@DIBuilderImpl.explicitContext
 
         private val setBinding: BaseMultiBinding<*, *, T> by lazy {
             val setType = erasedComp(Set::class, setBindingType) as TypeToken<Set<T>>
@@ -161,9 +161,9 @@ internal open class DIBuilderImpl internal constructor(
         addSetBindingToContainer: Boolean = true,
     ) : DI.Builder.ArgSetBinder<A, T> {
 
-        override val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
-        override val scope: Scope<Any?> get() = this@DIBuilderImpl.scope
-        override val explicitContext: Boolean get() = this@DIBuilderImpl.explicitContext
+        val contextType: TypeToken<Any> get() = this@DIBuilderImpl.contextType
+        val scope: Scope<Any?> get() = this@DIBuilderImpl.scope
+        val explicitContext: Boolean get() = this@DIBuilderImpl.explicitContext
 
         private val setBinding: BaseMultiBinding<*, in A, out T> by lazy {
             val setType = erasedComp(Set::class, setBindingType) as TypeToken<Set<T>>
```

**File**: `kodein-di/src/commonTest/kotlin/org/kodein/di/Tests_13_Scope.kt` (modified, +66/-0)
```diff
@@ -440,4 +440,70 @@ class Tests_13_Scope {
         assertTrue(c.closed)
     }
 
+    @Test
+    fun test_18_ScopedSetBindingSingleton() {
+        val registries = mapOf("a" to SingleItemScopeRegistry(), "b" to SingleItemScopeRegistry())
+        val myScope = object : Scope<String> {
+            override fun getRegistry(context: String) = registries[context]!!
+        }
+
+        val di = DI {
+            bindSet<IPerson> {
+                add { scoped(myScope).singleton { Person("Salomon") } }
+                add { scoped(myScope).singleton { Person("Laila") } }
+            }
+        }
+
+        val personsA: Set<IPerson> by di.on(context = "a").instance()
+        val personsB: Set<IPerson> by di.on(context = "b").instance()
+
+        assertEquals(2, personsA.size)
+        assertEquals(2, personsB.size)
+
+        val personsA2: Set<IPerson> by di.on(context = "a").instance()
+        assertEquals(personsA, personsA2)
+
+        registries["a"]!!.clear()
+        val personsA3: Set<IPerson> by di.on(context = "a").instance()
+        assertTrue(personsA.none { a -> personsA3.any { b -> a === b } })
+    }
+
+    @Test
+    fun test_19_NonScopedSetBindingConvenienceMethods() {
+        val di = DI {
+            bindSet<IPerson> {
+                addSingleton { Person("Salomon") }
+                addProvider { Person("Laila") }
+                addInstance(Person("Mary"))
+            }
+        }
+
+        val persons: Set<IPerson> by di.instance()
+        assertEquals(3, persons.size)
+        assertTrue(Person("Salomon") in persons)
+        assertTrue(Person("Laila") in persons)
+        assertTrue(Person("Mary") in persons)
+    }
+
+    @Test
+    fun test_20_ScopedArgSetBindingMultiton() {
+        val registries = mapOf("a" to SingleItemScopeRegistry(), "b" to SingleItemScopeRegistry())
+        val myScope = object : Scope<String> {
+            override fun getRegistry(context: String) = registries[context]!!
+        }
+
+        val di = DI {
+            bindArgSet<String, IPerson> {
+                add { scoped(myScope).multiton { name: String -> Person(name) } }
+            }
+        }
+
+        val personsA: Set<IPerson> by di.on(context = "a").instance(arg = "Salomon")
+        assertEquals(1, personsA.size)
+        assertTrue(Person("Salomon") in personsA)
+
+        val personsA2: Set<IPerson> by di.on(context = "a").instance(arg = "Salomon")
+        assertEquals(personsA, personsA2)
+    }
+
 }
```

---

### Incident Patch 4: `bf481fc2` (2025-09-25)
**Commit Message**: fix: exclude Compose Multiplatform tests

**File**: `test-utils/build.gradle.kts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 plugins {
-    kodein.library.mpp
+    kodein.mpp
 }
 
 kotlin.kodein {
```

---

### Incident Patch 5: `21bbfec6` (2025-05-04)
**Commit Message**: fix: downgrade Kotlin to 2.1.20

**File**: `README.md` (modified, +9/-8)
```diff
@@ -80,14 +80,15 @@ kotlin {
 Kotlin & JVM compatibility
 ---------
 
-|   Kodein    | Kotlin |   JDK   |
-|:-----------:|:------:|:-------:|
-|   7.22      | 2.0.+  | min 11  |
-|   7.21      | 1.9.+  | min 1.8 |
-|   7.20      | 1.8.10 | min 1.8 |
-|   7.19      | 1.8.10 | min 1.8 |
-|   7.18      | 1.8.0  | min 1.8 |
-|   7.17      | 1.8.0  | min 1.8 |
+| Kodein | Kotlin |   JDK   |
+|:------:|:------:|:-------:|
+|  7.23  | 2.0.+  | min 17  |
+|  7.22  | 2.0.+  | min 11  |
+|  7.21  | 1.9.+  | min 1.8 |
+|  7.20  | 1.8.10 | min 1.8 |
+|  7.19  | 1.8.10 | min 1.8 |
+|  7.18  | 1.8.0  | min 1.8 |
+|  7.17  | 1.8.0  | min 1.8 |
 
 > Full table can be found [here](https://kosi-libs.org/kodein/7.22/core/platform-and-genericity.html)
 
```

**File**: `doc/antora.yml` (modified, +3/-3)
```diff
@@ -1,7 +1,7 @@
 name: kodein
 title: Kodein
 version: '7.26'
-display_version: '7.26.0'
+display_version: '7.26.1'
 nav:
   - modules/ROOT/nav.adoc
   - modules/core/nav.adoc
@@ -11,6 +11,6 @@ nav:
 asciidoc:
   attributes:
     branch: '7.26'
-    version: '7.26.0'
-    kotlin: '2.1.21-RC'
+    version: '7.26.1'
+    kotlin: '2.1.20'
     jdk: '17'
\ No newline at end of file
```

**File**: `doc/modules/framework/pages/compose.adoc` (modified, +3/-3)
```diff
@@ -16,9 +16,9 @@ Here is a table containing the version compatibility:
 |JetBrains Compose
 |Kotlin
 
-|7.26.0
-|Compose 1.8.0-RC
-|2.1.21-RC
+|7.26.1
+|Compose 1.8.0-rc01
+|2.1.20
 
 |7.25.0
 |Compose 1.7.3
```

**File**: `settings.gradle.kts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ buildscript {
         maven(url = "https://raw.githubusercontent.com/kosi-libs/kodein-internal-gradle-plugin/mvn-repo")
     }
     dependencies {
-        classpath("org.kodein.internal.gradle:kodein-internal-gradle-settings:8.12.0")
+        classpath("org.kodein.internal.gradle:kodein-internal-gradle-settings:8.12.1")
     }
 }
 
```

---

### Incident Patch 6: `54ec7074` (2025-01-20)
**Commit Message**: fix support section

**File**: `README.md` (modified, +1/-1)
```diff
@@ -168,6 +168,6 @@ Support is held in the [Kodein Slack channel](https://kotlinlang.slack.com/messa
 
 If you are using KODEIN, please [let us know](mailto:contact@kodein.net)!
 
-### Supported by
+## Supported by
 
 [![JetBrains logo.](https://resources.jetbrains.com/storage/products/company/brand/logos/jetbrains.svg)](https://jb.gg/OpenSourceSupport)
\ No newline at end of file
```

---

### Incident Patch 7: `2db4c24d` (2025-01-19)
**Commit Message**: fix: re-enable js target

**File**: `framework/compose/kodein-di-framework-compose/build.gradle.kts` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ plugins {
 kotlin.kodein {
     jsEnv()
     allComposeUi()
+    js() // Not embedded in allComposeUi
 
     common.mainDependencies {
         implementation(kotlin.compose.runtime)
```

**File**: `gradle.properties` (modified, +9/-1)
```diff
@@ -6,8 +6,16 @@ org.gradle.parallel=true
 android.enableJetifier=true
 android.useAndroidX=true
 
-# Wasm
+# Compose
 org.jetbrains.compose.experimental.wasm.enabled=true
+org.jetbrains.compose.experimental.jscanvas.enabled=true
+org.jetbrains.compose.experimental.macos.enabled=true
+
+# Wasm
+kotlin.wasm.stability.nowarn=true
+
+# KGP
+kotlin.apple.xcodeCompatibility.nowarn=true
 
 # Kosi
 org.kodein.native.enableCrossCompilation=true
\ No newline at end of file
```

---

### Incident Patch 8: `db87bf3d` (2024-12-02)
**Commit Message**: chore: revert deprecation on Jetpack Compose APIs.

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -5,5 +5,5 @@ plugins {
 
 allprojects {
     group = "org.kodein.di"
-    version = "7.23.0"
+    version = "7.23.1"
 }
```

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/viewModel.kt` (modified, +0/-6)
```diff
@@ -86,12 +86,6 @@ public inline fun <reified VM : ViewModel> viewModel(
  * @throws DI.DependencyLoopException If the value construction triggered a dependency loop.
  */
 @Composable
-@Deprecated(
-    message = "Use the new Compose Multiplatform rememberViewModel instead from Kodein Framework Compose",
-    ReplaceWith("rememberViewModel", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
-@Suppress("DEPRECATION")
 public inline fun <reified A : Any, reified VM : ViewModel> rememberViewModel(
     tag: String? = null,
     arg: A,
```

**File**: `framework/compose/kodein-di-framework-compose/src/androidMain/kotlin/org/kodein/di/compose/viewModel.kt` (modified, +0/-10)
```diff
@@ -21,11 +21,6 @@ import org.kodein.di.instance
  * @throws DI.DependencyLoopException If the value construction triggered a dependency loop.
  */
 @Composable
-@Deprecated(
-    message = "Use the new Compose Multiplatform rememberViewModel instead",
-    ReplaceWith("rememberViewModel", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
 public inline fun <reified VM : ViewModel> rememberViewModel(tag: Any? = null): ViewModelLazy<VM> = with(localDI()) {
     val viewModelStoreOwner = LocalViewModelStoreOwner.current ?: error("")
 
@@ -57,11 +52,6 @@ public inline fun <reified VM : ViewModel> rememberViewModel(tag: Any? = null):
  * @throws DI.DependencyLoopException If the value construction triggered a dependency loop.
  */
 @Composable
-@Deprecated(
-    message = "Use the new Compose Multiplatform rememberViewModel instead",
-    ReplaceWith("rememberViewModel", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
 public inline fun <reified A: Any, reified VM : ViewModel> rememberViewModel(tag: Any? = null, arg: A): ViewModelLazy<VM> = with(localDI()) {
     val viewModelStoreOwner = LocalViewModelStoreOwner.current ?: error("")
 
```

---

### Incident Patch 9: `b3cc6a9f` (2024-11-29)
**Commit Message**: chore: revert deprecation on Jetpack Compose APIs.

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/KodeinViewModelScopedFactory.kt` (modified, +0/-10)
```diff
@@ -8,11 +8,6 @@ import org.kodein.di.direct
 import org.kodein.type.TypeToken
 import org.kodein.type.erased
 
-@Deprecated(
-    message = "Use the new Compose Multiplatform KodeinViewModelScopedFactory instead from Kodein Framework Compose",
-    ReplaceWith("KodeinViewModelScopedFactory", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
 public class KodeinViewModelScopedFactory<A : Any>(
     private val di: DI,
     private val argType: TypeToken<A>,
@@ -23,11 +18,6 @@ public class KodeinViewModelScopedFactory<A : Any>(
             di.direct.Factory(argType, erased(modelClass), tag).invoke(arg)
 }
 
-@Deprecated(
-    message = "Use the new Compose Multiplatform KodeinViewModelScopedSingleton instead from Kodein Framework Compose",
-    ReplaceWith("KodeinViewModelScopedSingleton", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
 public class KodeinViewModelScopedSingleton(
     private val di: DI,
     private val tag: String? = null,
```

**File**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/viewModel.kt` (modified, +0/-6)
```diff
@@ -22,12 +22,6 @@ import org.kodein.type.generic
  * @throws DI.DependencyLoopException If the value construction triggered a dependency loop.
  */
 @Composable
-@Deprecated(
-    message = "Use the new Compose Multiplatform rememberViewModel instead from Kodein Framework Compose",
-    ReplaceWith("rememberViewModel", "org.kodein.di.compose.viewmodel"),
-    DeprecationLevel.WARNING
-)
-@Suppress("DEPRECATION")
 public inline fun <reified VM : ViewModel> rememberViewModel(
     tag: String? = null
 ): ViewModelLazy<VM> = with(localDI()) {
```

---

### Incident Patch 10: `34eee243` (2024-05-23)
**Commit Message**: fix CI android checks

**File**: `.github/workflows/release.yml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ jobs:
       - name: Setup
         uses: kosi-libs/kodein-internal-github-actions/setup@main
       - name: Check with Android
-        uses: kosi-libs/kodein-internal-github-actions/checkWithAndroid@main
+        uses: kosi-libs/kodein-internal-github-actions/.github/workflows/check-with-android.yml@main
       - name: Upload
         run: ./gradlew publishAllPublicationsToOssrhStagingRepository -Porg.kodein.sonatype.repositoryId=${{ needs.create-staging-repository.outputs.repository-id }}
         shell: bash
```

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -16,4 +16,4 @@ jobs:
       - name: Setup
         uses: kosi-libs/kodein-internal-github-actions/setup@main
       - name: Check with Android
-        uses: kosi-libs/kodein-internal-github-actions/checkWithAndroid@main
+        uses: kosi-libs/kodein-internal-github-actions/.github/workflows/check-with-android.yml@main
```

#### Recent Merged Pull Requests:
- **PR #513** (2026-07-21): fix(#508): handle NoClassDefFoundError during JSR-330 injection (@romainbsl)
- **PR #511** (closed): fix(#508): tolerate unresolvable member types during reflective injection (@tonytonycoder11)
- **PR #510** (2026-07-19): Regenerate Kotlin/JS yarn.lock for Kotlin 2.4.0 (@romainbsl)
- **PR #507** (2026-03-25): fix((#506): update KodeinViewModelScopedFactory and KodeinViewModelScopedSingleton to use generic types (@romainbsl)
- **PR #505** (2026-03-23): fix((#504): bring back scope on SetBinder and ArgSetBinder (@romainbsl)
- **PR #503** (2026-02-08): Upgrade Ktor dependency from 3.3.2 to 3.4.0 (@romainbsl)
- **PR #500** (2025-11-20): New with arguments (@SalomonBrys)
- **PR #499** (2025-11-11): Update CHANGELOG.md (@romainbsl)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
