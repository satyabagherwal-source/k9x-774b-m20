# Forensic Learning Record (Deep Inspection): InsertKoinIO/koin

> **Canonical Artifact**: `07_PROJECT_LEARNING/insertkoinio-koin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/InsertKoinIO/koin](https://github.com/InsertKoinIO/koin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:49:54.198Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `InsertKoinIO/koin`
- **Description**: Koin - a pragmatic lightweight dependency injection framework for Kotlin & Kotlin Multiplatform
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10021 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2466** (2026-09-07): **Setup koin version catalog**
  *Symptoms*: #2252 
  **Post-Mortem & Fix Analysis**:
  > closed in favor of #2465 

- **Issue #2458** (2026-08-20): **Villanueva**
  *Symptoms*: Gollop
  **Post-Mortem & Fix Analysis**:
  > > Gollop  Csrf

- **Issue #2457** (2026-08-20): **Economía**
  *Symptoms*: @##*$$"_' Copilot encountered an error and was unable to review this pull request. You can try again by re-requesting a review.### **je**
  **Post-Mortem & Fix Analysis**:
  > ### B
  > ### H

- **Issue #2456** (2026-09-10): **Koin Compiler 1.1.0 & Coming Koin 4.3**
  *Symptoms*: Hey Koin community,  The new Koin Compiler Plugin 1.1.0 release has landed: https://github.com/InsertKoinIO/koin-compiler-plugin/issues/82 TL;DR: - No more false "missing dependency" errors in multi-module projects - Stay compatible with allWarningsAsErrors - Fixed a file-name-length crashes - Clearer error messages  Also to keep you in touch with incoming new capacity coming in Koin 4.3. - Stabilizing Navigation 3 APIs and patterns - Coroutines integration (resolving async definitions) - Job Scheduler to let you drive more background work directly from Koin  We are always keen to look at new interesting integrations.  Feedback and bug reports always welcome 🙏
  **Post-Mortem & Fix Analysis**:
  > Hi! The roadmap mentions:  > Job Scheduler to let you drive more background work directly from Koin.  This sounds really interesting! Could you share a bit more about it? Is it related to Android's `JobScheduler` API, or is it a completely different concept?
  > JobScheduler should be more agnostic for Koin, but help also fallback in native side like Android. We will share APIs example 👍 

- **Issue #2452** (2026-07-08): **Missing dependency with Multi-Module**
  *Symptoms*: **Describe the bug** When using Koin and Koin Compiler with multi-module architecture, the build fails with the following error:  ```kotlin [Koin][KOIN-D001] Missing dependency: com.kfaraj.samples.koin.multimodule.data.MainRepository   required by: com.kfaraj.samples.koin.multimodule.feature.MainViewModel (parameter 'repository')   in module: MainApplication (startKoin) ```  **To Reproduce** Build the following project:  ```kotlin // app/build.gradle.kts  dependencies {     implementation(project(":feature")) }  // app/src/main/kotlin/MainApplication.kt  @KoinApplication(modules = [AppModule::class]) class MainApplication : Application() {      override fun onCreate() {         super.onCreate()         startKoin<MainApplication>()     }  }  // app/src/main/kotlin/AppModule.kt  @Module(includes = [FeatureModule::class]) @ComponentScan object AppModule  // feature/build.gradle.kts  dependencies {     implementation(project(":data")) }  // feature/src/main/kotlin/MainViewModel.kt  @Factory public class MainViewModel internal constructor(     repository: MainRepository ) {     public val uiState: String = repository.message }  // feature/src/main/kotlin/FeatureModule.kt  @Module(includes = [DataModule::class]) @ComponentScan public object FeatureModule  // data/src/main/kotlin/MainRepository.kt  public interface MainRepository {     public val message: String }  // data/src/main/kotlin/DefaultMainRepository.kt  @Single internal class DefaultMainRepository : MainRepository {     o
  **Post-Mortem & Fix Analysis**:
  > Duplicate of InsertKoinIO/koin-compiler-plugin#51 — same cross-module compileSafety false positive (`KOIN-D001` on a sibling-module provider composed at the aggregator). Tracked there (milestone 1.0.2). The fix degrades the unresolvable-at-compile-time case to a warning + validates the full graph at the `@KoinApplication` entry point.  Thanks for the clean minimal repro — it's referenced in the fix work. Closing here; please follow InsertKoinIO/koin-compiler-plugin#51.

- **Issue #2451** (2026-09-10): **Compiler Plugin breaks if mixing with "normal" DSL**
  *Symptoms*: **Describe the bug** If you use `single<...>()` together with `single<...> { .... }` the compiler plugin falsely states that it is missing definitions.  **To Reproduce** See attached reproduction project. A minimalistic ktor app with just a root endpoint to trigger the behavior.  In short: defining the module like this ```kotlin import org.koin.dsl.module  val testModule = module {     single<MyInterface> { Foo() } // class Foo : MyInterface } .... val foo by inject<MyInterface>() val bar by inject<Bar>() call.respond(foo.foo() + bar.bar()) ``` compiles even though in my opinion it shouldnt. But like this, it says it is missing definitions for **MyInterface** ```kotlin import org.koin.dsl.module import org.koin.plugin.module.dsl.single  val testModule = module {     single<MyInterface> { Foo() }     single<Bar>() } ... val foo by inject<MyInterface>() val bar by inject<Bar>() call.respond(foo.foo() + bar.bar()) ```  **Expected behavior** I should be able to mix both overloads of the `single` function.  **Koin module and version:** Koin 4.2.2, Koin Compiler Plugin 1.0.1, Kotlin 2.3.21  **Snippet or Sample project to help reproduce**  [reproduction.zip](https://github.com/user-attachments/files/29103836/reproduction.zip) 
  **Post-Mortem & Fix Analysis**:
  > I face absolutely the same issue on my side.  1. Mixing single<...>() together with single<...> { .... } is possible and breaks compile time validation. It is quite easy to end up mixing those and end up with no compile time safety. Ideally mixing those two should be impossible. 2. If you need to use [function builders](https://insert-koin.io/docs/reference/koin-core/definitions#function-builders-with-create) the way showcased by the official documentation for the compiler plugin the single/factory usage is based on the old dsl format and thus ends up with non working compile time validation. I could not find a way to use function builders without the old dsl syntax. Here is an example which can be run as unit test  ``` import org.koin.core.context.startKoin import org.koin.core.context.stopKoin import org.koin.dsl.module import org.koin.plugin.module.dsl.create import kotlin.test.Test  class KoinComplierPluginTest {      @Test     fun koinWithBMissingAndUsingFunctionBuildersShouldFail
  > KCP 1.2.1 is getting on that, you can freely mix DSL if needed

- **Issue #2448** (2026-06-12): **Finalize 4.2.2 — version bump + Navigation 3 typed entryProvider docs (#2336)**
  *Symptoms*: Finalizes the 4.2.2 release.  ## Version Bump `koinVersion` `4.2.2-Alpha1` → **`4.2.2`**.  ## #2336 — Navigation 3 typed `entryProvider` (docs) `koinEntryProvider<T>()` is already generic (`(T) -> NavEntry<T>`). The reported mismatch happens when it's called as `koinEntryProvider<Any>()` but `NavDisplay` is typed (e.g. via a typed `SceneStrategy` such as `rememberSupportingPaneSceneStrategy<Route>()`) — the compiler then infers `NavDisplay<Route>` and expects `(Route) -> NavEntry<Route>`. The API didn't need changing; the fix is to **document** passing the route type: ```kotlin val entryProvider = koinEntryProvider<Route>()   // matches NavDisplay<Route> // or: val entryProvider: EntryProvider<Route> = koinEntryProvider() ``` Added a `:::tip` to the Navigation 3 reference page covering the exact error and both forms.  ## Verification - Docs + version only — no code change. `./gradlew apiCheck` passes (no `.api` delta).  Closes #2336.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #2447** (2026-06-12): **Fix #2386 - withOptions leaves stale index entries on qualifier/secondary change**
  *Symptoms*: ## Problem `withOptions` mutates a `BeanDefinition` in place, then re-indexes from the mutated state — but never removes the entry registered under the **previous** coordinates. So: ```kotlin single<Foo>(named("a")) { Foo() } withOptions { qualifier = named("b") } ``` leaves **both** `Foo:a` (stale) and `Foo:b` in `Module.mappings`, pointing at the same factory — `get<Foo>(named("a"))` still resolves even though the definition's qualifier is now `b`. With `secondaryTypes` it gets worse: secondaries are indexed only under the new qualifier, so `Foo` is reachable via old+new but `Bar` only via new (asymmetry). Fixes #2386.  ## Fix Snapshot the previous `qualifier` + `secondaryTypes` before applying the options; when either changes, drop the stale `mappings` entries (old primary + old secondaries under the old qualifier) before re-indexing with the new coordinates: ```kotlin val previousQualifier = def.qualifier val previousSecondaryTypes = def.secondaryTypes.toList() def.also(options) if (def.qualifier != previousQualifier || def.secondaryTypes != previousSecondaryTypes) {     module.mappings.remove(indexKey(def.primaryType, previousQualifier, def.scopeQualifier))     previousSecondaryTypes.forEach { module.mappings.remove(indexKey(it, previousQualifier, def.scopeQualifier)) }     module.indexPrimaryType(factory)     if (def.secondaryTypes.isNotEmpty()) module.indexSecondaryTypes(factory) } ``` No-op when nothing index-relevant changed.  ## Behavioral note (resolution semantics
  **Post-Mortem & Fix Analysis**:
  > ⚠️ Converting to draft — this fix regresses `koin-android` `DSLExtendedTest.android dsl`.  **Root cause of the regression:** with two same-type definitions — ```kotlin viewModelOf(::MyViewModel)               // (1) indexes MyViewModel:null viewModelOf(::MyViewModel){ named("bis") } // (2) indexes MyViewModel:null at creation (overwrites (1)!), then withOptions moves it to :bis ``` — the `*Of(ctor){options}` builders index under the **null** qualifier first and only change it afterward, so (2) transiently collides with (1) at `MyViewModel:null`. On `main` the leftover stale `:null` entry is what keeps `getOrNull<MyViewModel>()` non-null; removing it (the #2386 fix) exposes that (1) was already clobbered → unqualified resolves to null.  **Implication:** the clean fix for #2386's single-definition cases is correct (verified by `WithOptionsStaleIndexTest`), but a complete fix must also stop `*Of(ctor){options}` from indexing under the pre-options qualifier — i.e. apply options **before** 
  > Closing — #2386 is deferred to **4.3.0** (needs the deeper `*Of`-builder indexing-order fix, not a contained patch change). Investigation, root cause, and the single-definition fix + `WithOptionsStaleIndexTest` are recorded here and on #2386 for whoever picks it up.

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

### Incident Patch 1: `0029f349` (2026-06-12)
**Commit Message**: Merge pull request #2446 from InsertKoinIO/fix/2348-env-properties-cast

Fix #2348 - ignore non-String environment properties (ClassCastException)

**File**: `projects/core/koin-core/src/jvmMain/kotlin/org/koin/core/registry/PropertyRegistryExt.kt` (modified, +11/-4)
```diff
@@ -10,13 +10,20 @@ import java.util.*
 /**
  *Save properties values into PropertyRegister
  */
-@Suppress("UNCHECKED_CAST")
 fun PropertyRegistry.saveProperties(properties: Properties) {
     _koin.logger.debug("load ${properties.size} properties")
 
-    val propertiesMapValues = properties.toMap() as Map<String, String>
-    propertiesMapValues.forEach { (k: String, v: String) ->
-        saveProperty(k, v)
+    // java.util.Properties can legally hold non-String keys/values (e.g. after
+    // System.setProperties(...) with arbitrary objects). The registry is keyed by
+    // String but stores Any values, so keep any String-keyed entry (value as-is)
+    // and only drop non-String keys — instead of hard-casting values to String and
+    // crashing (#2348).
+    properties.forEach { (k, v) ->
+        if (k is String && v != null) {
+            saveProperty(k, v)
+        } else {
+            _koin.logger.debug("ignore property with non-string key '$k'")
+        }
     }
 }
 
```

**File**: `projects/core/koin-core/src/jvmTest/kotlin/org/koin/core/EnvironmentPropertiesTest.kt` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+package org.koin.core
+
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.registry.saveProperties
+import org.koin.dsl.koinApplication
+import java.util.Properties
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertSame
+
+/**
+ * Regression test for #2348. java.util.Properties can legally hold non-String keys/values
+ * (e.g. after System.setProperties(...) with arbitrary objects). Koin hard-cast every entry to
+ * String, crashing with ClassCastException on startup. The registry is String-keyed but holds
+ * Any values, so: non-String *keys* are dropped (unaddressable), non-String *values* are kept.
+ */
+@OptIn(KoinInternalApi::class)
+class EnvironmentPropertiesTest {
+
+    @Test
+    fun saveProperties_tolerates_non_string_entries_issue_2348() {
+        val koin = koinApplication { }.koin
+
+        val objectValue = Any()
+        val props = Properties().apply {
+            setProperty("valid.key", "valid.value")
+            // legacy Properties permits arbitrary objects:
+            put("object.value", objectValue) // String key, Any value -> kept (values are Any)
+            put(Any(), Any())                 // non-string key -> dropped
+            put(42, "string.value")           // non-string key -> dropped
+        }
+
+        // must NOT throw ClassCastException
+        koin.propertyRegistry.saveProperties(props)
+
+        // valid string property is saved
+        assertEquals("valid.value", koin.getProperty<String>("valid.key"))
+        // a non-String value under a String key is preserved as-is (registry stores Any)
+        assertSame(objectValue, koin.getProperty<Any>("object.value"))
+    }
+}
```

---

### Incident Patch 2: `26020e8b` (2026-06-12)
**Commit Message**: Fix #2348 - tolerate non-String environment properties (ClassCastException)

PropertyRegistry.saveProperties cast every java.util.Properties entry to
Map<String, String>, so a non-String key or value (legal in Properties, e.g.
after System.setProperties(...) with arbitrary objects) crashed startup with
ClassCastException.

The registry is String-keyed but stores Any values (PropertyRegistry._values is
Map<String, Any>, getProperty uses `as? T`). So the correct fix keeps any
String-keyed entry with its value as-is (Any) and only drops non-String keys
(which can't be addressed as Koin property keys) — rather than forcing values
to String. Removes the unchecked cast.

Regression test (jvmTest): EnvironmentPropertiesTest — Properties with a
non-String key, plus a String key holding an arbitrary object, no longer throws;
the object value is preserved and retrievable, valid string props still load.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `projects/core/koin-core/src/jvmMain/kotlin/org/koin/core/registry/PropertyRegistryExt.kt` (modified, +11/-4)
```diff
@@ -10,13 +10,20 @@ import java.util.*
 /**
  *Save properties values into PropertyRegister
  */
-@Suppress("UNCHECKED_CAST")
 fun PropertyRegistry.saveProperties(properties: Properties) {
     _koin.logger.debug("load ${properties.size} properties")
 
-    val propertiesMapValues = properties.toMap() as Map<String, String>
-    propertiesMapValues.forEach { (k: String, v: String) ->
-        saveProperty(k, v)
+    // java.util.Properties can legally hold non-String keys/values (e.g. after
+    // System.setProperties(...) with arbitrary objects). The registry is keyed by
+    // String but stores Any values, so keep any String-keyed entry (value as-is)
+    // and only drop non-String keys — instead of hard-casting values to String and
+    // crashing (#2348).
+    properties.forEach { (k, v) ->
+        if (k is String && v != null) {
+            saveProperty(k, v)
+        } else {
+            _koin.logger.debug("ignore property with non-string key '$k'")
+        }
     }
 }
 
```

**File**: `projects/core/koin-core/src/jvmTest/kotlin/org/koin/core/EnvironmentPropertiesTest.kt` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+package org.koin.core
+
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.registry.saveProperties
+import org.koin.dsl.koinApplication
+import java.util.Properties
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertSame
+
+/**
+ * Regression test for #2348. java.util.Properties can legally hold non-String keys/values
+ * (e.g. after System.setProperties(...) with arbitrary objects). Koin hard-cast every entry to
+ * String, crashing with ClassCastException on startup. The registry is String-keyed but holds
+ * Any values, so: non-String *keys* are dropped (unaddressable), non-String *values* are kept.
+ */
+@OptIn(KoinInternalApi::class)
+class EnvironmentPropertiesTest {
+
+    @Test
+    fun saveProperties_tolerates_non_string_entries_issue_2348() {
+        val koin = koinApplication { }.koin
+
+        val objectValue = Any()
+        val props = Properties().apply {
+            setProperty("valid.key", "valid.value")
+            // legacy Properties permits arbitrary objects:
+            put("object.value", objectValue) // String key, Any value -> kept (values are Any)
+            put(Any(), Any())                 // non-string key -> dropped
+            put(42, "string.value")           // non-string key -> dropped
+        }
+
+        // must NOT throw ClassCastException
+        koin.propertyRegistry.saveProperties(props)
+
+        // valid string property is saved
+        assertEquals("valid.value", koin.getProperty<String>("valid.key"))
+        // a non-String value under a String key is preserved as-is (registry stores Any)
+        assertSame(objectValue, koin.getProperty<Any>("object.value"))
+    }
+}
```

---

### Incident Patch 3: `fff5291f` (2026-06-12)
**Commit Message**: Merge pull request #2432 from lfavreli-betclic/fix/2410-request-scope-atomic-id

Use a monotonic counter for Ktor request scope ids

**File**: `projects/ktor/koin-ktor/src/commonMain/kotlin/org/koin/ktor/plugin/RequestScope.kt` (modified, +12/-3)
```diff
@@ -19,16 +19,25 @@ import io.ktor.server.application.ApplicationCall
 import org.koin.core.Koin
 import org.koin.core.component.KoinScopeComponent
 import org.koin.core.component.createScope
-import org.koin.mp.KoinPlatformTools
-import org.koin.mp.generateId
+import kotlin.concurrent.atomics.AtomicLong
+import kotlin.concurrent.atomics.ExperimentalAtomicApi
+import kotlin.concurrent.atomics.incrementAndFetch
+import kotlin.time.Clock
 
 /**
  * Request Scope Holder
  *
  * @author Arnaud Giuliani
+ * @author Loïc Favreliere
  */
+@OptIn(ExperimentalAtomicApi::class)
 class RequestScope(private val _koin: Koin, call: ApplicationCall) : KoinScopeComponent {
-    private val scopeId = "request_"+KoinPlatformTools.generateId()
+    private val scopeId = "request_" + counter.incrementAndFetch()
     override fun getKoin(): Koin = _koin
     override val scope = createScope(scopeId = scopeId, source = call)
+
+    private companion object {
+        // Monotonic counter seeded with the current time, for process-unique request scope ids
+        private val counter = AtomicLong(Clock.System.now().toEpochMilliseconds())
+    }
 }
\ No newline at end of file
```

**File**: `projects/ktor/koin-ktor/src/jvmTest/kotlin/org/koin/ktor/ext/KoinPluginRunTest.kt` (modified, +28/-1)
```diff
@@ -27,6 +27,10 @@ import io.ktor.server.response.respond
 import io.ktor.server.routing.get
 import io.ktor.server.routing.routing
 import io.ktor.server.testing.testApplication
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.async
+import kotlinx.coroutines.awaitAll
+import kotlinx.coroutines.coroutineScope
 import kotlinx.coroutines.delay
 import kotlinx.coroutines.runBlocking
 import org.junit.Before
@@ -37,6 +41,7 @@ import org.koin.core.context.stopKoin
 import org.koin.core.logger.Level
 import org.koin.dsl.module
 import org.koin.ktor.plugin.Koin
+import org.koin.ktor.plugin.scope
 import kotlin.test.assertEquals
 import kotlin.test.assertTrue
 
@@ -57,6 +62,25 @@ class KoinPluginRunTest {
         }
     }
 
+    @Test
+    fun `sequential and concurrent requests get unique scope ids`() {
+        testMyApplication { client ->
+            suspend fun scopeId() = client.get("testurl").headers["X-Scope-Id"]
+
+            val sequentialIds = (1..100).map { scopeId() }
+            val concurrentIds = coroutineScope {
+                (1..1_000).map { async(Dispatchers.Default) { scopeId() } }.awaitAll()
+            }
+            val ids = sequentialIds + concurrentIds
+
+            assertEquals(ids.size, ids.toSet().size, "all request scope ids should be unique")
+            assertTrue(
+                ids.all { it?.removePrefix("request_")?.toLongOrNull() != null },
+                "scope ids should be 'request_<number>'",
+            )
+        }
+    }
+
     @Test
     @Ignore("socket exception on GH")
     fun `run outside context`() = runBlocking<Unit> {
@@ -135,7 +159,10 @@ private fun testMyApplicationNoKoin(test: suspend (jsonClient: HttpClient) -> Un
 class KtorMyModule(application: Application) {
     init {
         application.routing {
-            get("testurl") { call.respond(HttpStatusCode.OK, "Test response") }
+            get("testurl") {
+                call.response.headers.append("X-Scope-Id", call.scope.id)
+                call.respond(HttpStatusCode.OK, "Test response")
+            }
         }
     }
 }
\ No newline at end of file
```

---

### Incident Patch 4: `961521c4` (2026-06-12)
**Commit Message**: Merge pull request #2444 from InsertKoinIO/fix/2299-vmscope-link-parent

Fix #2299 - link viewModelScopeFactory scope to its parent scope

**File**: `projects/core/koin-core-viewmodel/src/commonMain/kotlin/org/koin/viewmodel/factory/KoinViewModelFactory.kt` (modified, +6/-0)
```diff
@@ -50,6 +50,12 @@ class KoinViewModelFactory(
         } else {
             val scopeId = getViewModelScopeId(modelClass)
             val vmScope = koin.createScope(scopeId, TypeQualifier(modelClass), null, ViewModelScopeArchetype)
+            // #2299: link the auto-created VM scope to the requesting (parent) scope, so a ViewModel
+            // declared in a custom scope - and its scoped dependencies - resolve. New scopes already
+            // link to root, so only a non-root parent needs an explicit link.
+            if (!scope.isRoot) {
+                vmScope.linkTo(scope)
+            }
             val vm : T = vmScope.getWithParameters(kClass, qualifier, androidParams)
             vm.addCloseable(ViewModelScopeAutoCloseable(scopeId,koin))
             vm
```

**File**: `projects/core/koin-core-viewmodel/src/commonTest/kotlin/org/koin/viewmodel/ViewModelScopeFactoryLinkTest.kt` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package org.koin.viewmodel
+
+import androidx.lifecycle.ViewModel
+import androidx.lifecycle.ViewModelStore
+import androidx.lifecycle.viewmodel.CreationExtras
+import org.koin.core.annotation.KoinExperimentalAPI
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.module.dsl.scopedOf
+import org.koin.core.module.dsl.viewModelOf
+import org.koin.core.qualifier.TypeQualifier
+import org.koin.core.option.viewModelScopeFactory
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertNotNull
+import kotlin.test.assertSame
+
+/**
+ * Regression test for #2299: with viewModelScopeFactory() enabled, a ViewModel declared in a
+ * custom scope must resolve. KoinViewModelFactory creates a fresh vmScope (ViewModelScopeArchetype)
+ * but did not link it to the parent (custom) scope, so the ViewModel — and its scoped deps,
+ * registered under the custom scope qualifier — were unreachable.
+ */
+@OptIn(KoinInternalApi::class, KoinExperimentalAPI::class)
+class ViewModelScopeFactoryLinkTest {
+
+    class Example
+    class ScopedDep
+    class ScopedVM(val dep: ScopedDep) : ViewModel()
+
+    @Test
+    fun viewModelScopeFactory_resolves_viewModel_from_custom_scope_issue_2299() {
+        val koin = koinApplication {
+            options(viewModelScopeFactory())
+            modules(
+                module {
+                    scope<Example> {
+                        scopedOf(::ScopedDep)
+                        viewModelOf(::ScopedVM)
+                    }
+                },
+            )
+        }.koin
+
+        val parentScope = koin.createScope("example-1", TypeQualifier(Example::class), Example())
+
+        val vm = resolveViewModel(
+            ScopedVM::class, ViewModelStore(), null, CreationExtras.Empty, null, parentScope,
+        )
+
+        assertNotNull(vm)
+        // its scoped dependency must come from the parent custom scope
+        assertNotNull(vm.dep)
+        assertSame(parentScope.get<ScopedDep>(), vm.dep)
+    }
+}
```

---

### Incident Patch 5: `524eb258` (2026-06-12)
**Commit Message**: Fix #2299 - link viewModelScopeFactory scope to its parent scope

With viewModelScopeFactory() enabled, KoinViewModelFactory creates a fresh
vmScope (ViewModelScopeArchetype) for the ViewModel but never linked it to the
requesting (parent) scope. A ViewModel declared in a custom scope —
scope<X> { viewModelOf(::VM) } — was therefore unreachable (the definition lives
under the custom scope qualifier), and its scoped dependencies couldn't resolve,
crashing with NoDefinitionFound. Worked with the option off.

Fix: vmScope.linkTo(scope) when the parent isn't root (new scopes already link
to root). The ViewModel and its scoped deps now resolve via the linked parent.

This also matters because the #2417 guidance points users at
viewModelScopeFactory() — the option must work with custom scopes.

Test (commonTest, RED->GREEN on JVM / wasmJs / native): ViewModelScopeFactoryLinkTest.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `projects/core/koin-core-viewmodel/src/commonMain/kotlin/org/koin/viewmodel/factory/KoinViewModelFactory.kt` (modified, +6/-0)
```diff
@@ -50,6 +50,12 @@ class KoinViewModelFactory(
         } else {
             val scopeId = getViewModelScopeId(modelClass)
             val vmScope = koin.createScope(scopeId, TypeQualifier(modelClass), null, ViewModelScopeArchetype)
+            // #2299: link the auto-created VM scope to the requesting (parent) scope, so a ViewModel
+            // declared in a custom scope - and its scoped dependencies - resolve. New scopes already
+            // link to root, so only a non-root parent needs an explicit link.
+            if (!scope.isRoot) {
+                vmScope.linkTo(scope)
+            }
             val vm : T = vmScope.getWithParameters(kClass, qualifier, androidParams)
             vm.addCloseable(ViewModelScopeAutoCloseable(scopeId,koin))
             vm
```

**File**: `projects/core/koin-core-viewmodel/src/commonTest/kotlin/org/koin/viewmodel/ViewModelScopeFactoryLinkTest.kt` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package org.koin.viewmodel
+
+import androidx.lifecycle.ViewModel
+import androidx.lifecycle.ViewModelStore
+import androidx.lifecycle.viewmodel.CreationExtras
+import org.koin.core.annotation.KoinExperimentalAPI
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.module.dsl.scopedOf
+import org.koin.core.module.dsl.viewModelOf
+import org.koin.core.qualifier.TypeQualifier
+import org.koin.core.option.viewModelScopeFactory
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertNotNull
+import kotlin.test.assertSame
+
+/**
+ * Regression test for #2299: with viewModelScopeFactory() enabled, a ViewModel declared in a
+ * custom scope must resolve. KoinViewModelFactory creates a fresh vmScope (ViewModelScopeArchetype)
+ * but did not link it to the parent (custom) scope, so the ViewModel — and its scoped deps,
+ * registered under the custom scope qualifier — were unreachable.
+ */
+@OptIn(KoinInternalApi::class, KoinExperimentalAPI::class)
+class ViewModelScopeFactoryLinkTest {
+
+    class Example
+    class ScopedDep
+    class ScopedVM(val dep: ScopedDep) : ViewModel()
+
+    @Test
+    fun viewModelScopeFactory_resolves_viewModel_from_custom_scope_issue_2299() {
+        val koin = koinApplication {
+            options(viewModelScopeFactory())
+            modules(
+                module {
+                    scope<Example> {
+                        scopedOf(::ScopedDep)
+                        viewModelOf(::ScopedVM)
+                    }
+                },
+            )
+        }.koin
+
+        val parentScope = koin.createScope("example-1", TypeQualifier(Example::class), Example())
+
+        val vm = resolveViewModel(
+            ScopedVM::class, ViewModelStore(), null, CreationExtras.Empty, null, parentScope,
+        )
+
+        assertNotNull(vm)
+        // its scoped dependency must come from the parent custom scope
+        assertNotNull(vm.dep)
+        assertSame(parentScope.get<ScopedDep>(), vm.dep)
+    }
+}
```

---

### Incident Patch 6: `931132e7` (2026-06-12)
**Commit Message**: Merge pull request #2442 from InsertKoinIO/fix/2426-tvos-viewmodel-targets

Fix #2426 - add tvOS targets to koin-core-viewmodel

**File**: `projects/core/koin-core-viewmodel/build.gradle.kts` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ kotlin {
     iosSimulatorArm64()
     macosX64()
     macosArm64()
+    tvosArm64()
+    tvosSimulatorArm64()
+    tvosX64()
 
     sourceSets {
         commonMain.dependencies {
```

---

### Incident Patch 7: `fa65c44a` (2026-06-11)
**Commit Message**: Merge pull request #2441 from InsertKoinIO/fix/2044-savedstatehandle-errors

Improve SavedStateHandle / ViewModel DX (#2044, #2417) — actionable errors + R8 guide

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -11,3 +11,6 @@ classes/
 yarn.lock
 .kotlin/
 **/*/.claude/settings.local.json
+
+# Local Claude Code settings (machine-local)
+projects/.claude/settings.local.json
```

**File**: `docs/reference/koin-android/r8-proguard.md` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+---
+title: R8 / ProGuard
+---
+
+This page explains how Koin behaves under code shrinking and obfuscation (R8 / ProGuard), what
+Koin keeps for you, and what **you** need to keep in your own app.
+
+## TL;DR
+
+- **Koin's core resolution is R8-safe.** `get<T>()`, `inject<T>()`, and the `*Of` builders
+  (`singleOf`, `factoryOf`, `viewModelOf`, …) resolve dependencies **at compile time** — they use
+  reified types and, on Android/JVM, key the registry by `Class.getName()`. There is **no runtime
+  reflection over your constructors**, so you do **not** need to keep your definitions, ViewModels,
+  or their constructors on Koin's behalf.
+- Koin ships `consumer-rules.pro` in its Android AARs (`koin-android`, `koin-core-viewmodel`,
+  `koin-compose-viewmodel`, `koin-androidx-workmanager`, `koin-androidx-startup`), so the rules
+  below are applied automatically — you usually don't add anything.
+- You still need to keep classes that **something else** loads reflectively (see below).
+
+## What Koin keeps for you (shipped consumer rules)
+
+The AARs silence R8 warnings about Koin internals:
+
+```proguard
+-dontwarn org.koin.**
+```
+
+`koin-androidx-startup` additionally keeps its manifest-referenced initializer. None of these keep
+your application classes — Koin doesn't need them kept.
+
+## What you must keep
+
+These come from the platform/libraries, not from Koin's resolution:
+
+- **Fragments created by `KoinFragmentFactory`** are instantiated by class name. Keep your Fragment
+  subclasses (they're usually kept already via `@Keep`, layout references, or AndroidX rules).
+- **WorkManager `ListenableWorker` subclasses** are kept by `androidx.work`'s own consumer rules.
+- **Saved state for process death.** `SavedStateHandle` is provided by androidx `CreationExtras`,
+  not by Koin. The values you put into it must survive R8 like any other saved state — keep your
+  own `@Parcelize` / `Serializable` state classes:
+
+```proguard
+# Example — keep your own saved-state payloads
+-keep class com.example.** implements android.os.Parcelable { *; }
+```
+
+## ViewModels & SavedStateHandle (#2044)
+
+A common belief is that intermittent `No definition found for SavedStateHandle` crashes are caused
+by R8 stripping Koin's ViewModel reflection. **They are not** — `viewModelOf(::MyViewModel)` is
+compile-time, so a `-keep` on your ViewModel won't change Koin's resolution.
+
+`SavedStateHandle` is only available **while the ViewModel is being created** (it is built from the
+`CreationExtras` passed to the factory). Resolve it **directly in the ViewModel constructor** — do
+not resolve it lazily or after construction:
+
+```kotlin
+// ✅ resolved during creation
+class MyViewModel(val handle: SavedStateHandle) : ViewModel()
+
+// ❌ resolved later — the CreationExtras are gone by then
+class MyViewModel(koin: Koin) : ViewModel() {
+    val handle by lazy { koin.get<SavedStateHandle>() } // fails
+}
+```
+
+If you declare ViewModels inside `viewModelScope { }`, enable the matching option so the scope can
+be created:
+
+```kotlin
+startKoin {
+    options(viewModelScopeFactory())
+    modules(appModule)
+}
+```
+
+## Non-Android targets (JS / WASM / Native)
+
+On Android/JVM Koin keys the registry by `Class.getName()`, which is stable under R8. On
+**Kotlin/JS, WASM, and Native**, Koin uses `qualifiedName` / `simpleName` from Kotlin reflection.
+Aggressive name minification on those targets can affect type identity — prefer **named
+qualifiers** (`named("...")`) over relying on class names when you minify non-Android targets.
```

**File**: `projects/compose/koin-compose-viewmodel/build.gradle.kts` (modified, +1/-0)
```diff
@@ -61,6 +61,7 @@ android {
     compileSdk = androidCompileSDK.toInt()
     defaultConfig {
         minSdk = androidMinSDK.toInt()
+        consumerProguardFiles("consumer-rules.pro")
     }
 }
 
```

**File**: `projects/compose/koin-compose-viewmodel/consumer-rules.pro` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+# Koin Compose ViewModel — consumer R8/ProGuard rules
+# Shipped with the koin-compose-viewmodel AAR. Auto-applied to consumer apps.
+
+# Silence R8 warnings about Koin internals (Kotlin reflection metadata, optional interop).
+-dontwarn org.koin.**
+
+# NOTE: koinViewModel() / koinNavViewModel() resolution is compile-time (reified inline get(),
+# JVM Class.getName() keying) — no runtime reflection over your ViewModel constructors, so you do
+# NOT need to keep your ViewModels on Koin's behalf. SavedStateHandle comes from androidx
+# CreationExtras at creation time, not from Koin reflection.
+# For what you DO need to keep (your saved-state classes for process death), see the
+# R8 / ProGuard guide: https://insert-koin.io/docs/reference/koin-android/r8-proguard
```

**File**: `projects/core/benchmark/bench_results.txt` (modified, +0/-17)
```diff
@@ -1,21 +1,4 @@
 
-# 4.2.0-BETA2 - 2025-12-09
-
-Benchmark                                           Mode  Cnt     Score    Error  Units
-HeavyStartupBenchmark.start_get_lazy_module1        avgt          0,249           ms/op
-HeavyStartupBenchmark.start_get_lazy_module100      avgt          4,248           ms/op
-HeavyStartupBenchmark.start_get_lazy_module1000     avgt         40,000           ms/op
-HeavyStartupBenchmark.start_get_module1             avgt          0,233           ms/op
-HeavyStartupBenchmark.start_get_module100           avgt         24,621           ms/op
-HeavyStartupBenchmark.start_get_module1000          avgt        243,413           ms/op
-JvmBenchmark.retrieveDependency                     avgt        104,304           ns/op
-ScopeBenchmark.activityScope                        avgt    3   528,339 ± 14,215  ns/op
-ScopeBenchmark.activityScope_cascade_root           avgt    3   804,719 ± 22,924  ns/op
-ScopeBenchmark.fragmentScope_cascade_activity_root  avgt    3  1578,267 ± 24,615  ns/op
-ScopeBenchmark.rootScope                            avgt    3   107,065 ±  9,257  ns/op
-StartupBenchmark.startup                            avgt          0,229           ms/op
-StartupBenchmark.startup_lazy                       avgt          0,002           ms/op
-
 # 4.2.0-BETA1 - 2025-12-09
 
 Benchmark                                           Mode  Cnt     Score     Error  Units
```

---

### Incident Patch 8: `f7e2adf2` (2026-06-11)
**Commit Message**: Fix #2426 - add tvOS targets to koin-core-viewmodel

koin-core-viewmodel published no tvOS variants, so @KoinViewModel on a tvOS
KMP target failed: "buildViewModel is not on classpath. Add dependency:
koin-core-viewmodel". koin-core already ships tvOS and the JetBrains
lifecycle-viewmodel dependency supports it.

Add tvosArm64 / tvosSimulatorArm64 / tvosX64 to koin-core-viewmodel. All three
compile.

Note: koin-compose-viewmodel is intentionally NOT changed — it depends on
koin-compose, which uses org.jetbrains.compose.foundation (Compose UI), which
publishes no tvOS variant (Compose UI doesn't target tvOS). That's an upstream
Compose limitation; tvOS apps using @KoinViewModel use koin-core-viewmodel.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `projects/core/koin-core-viewmodel/build.gradle.kts` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ kotlin {
     iosSimulatorArm64()
     macosX64()
     macosArm64()
+    tvosArm64()
+    tvosSimulatorArm64()
+    tvosX64()
 
     sourceSets {
         commonMain.dependencies {
```

---

### Incident Patch 9: `b99c1875` (2026-06-11)
**Commit Message**: Fix #2417 - actionable error when viewModelScope { } lacks viewModelScopeFactory()

A ViewModel declared inside viewModelScope { } is registered under the
ViewModelScopeArchetype and is only resolvable when the viewModelScopeFactory()
option is enabled (the option creates the archetype scope). Without it,
KoinViewModelFactory's default path resolves the VM from the factory's scope
(root) and fails with an opaque "No definition found ... on scope '_root_'" —
the exact dead-end #2417 reporters hit after applying the advised
viewModelScope { } workaround.

The factory now detects this case: when root resolution throws
NoDefinitionFound and the VM is registered under ViewModelScopeArchetype
(instanceRegistry.instances + indexKey), it rethrows an actionable error telling
the user to enable viewModelScopeFactory() (or move the VM out of the scope).
Genuinely-missing ViewModels keep the normal NoDefinitionFound message.

Tests (commonTest, RED->GREEN on JVM / wasmJs / native): ViewModelScopeOptionTest
covers the missing-option error, the with-option success, and the
not-over-firing case.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `projects/core/koin-core-viewmodel/src/commonMain/kotlin/org/koin/viewmodel/factory/KoinViewModelFactory.kt` (modified, +20/-1)
```diff
@@ -19,12 +19,15 @@ import androidx.lifecycle.ViewModel
 import androidx.lifecycle.ViewModelProvider
 import androidx.lifecycle.viewmodel.CreationExtras
 import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.definition.indexKey
+import org.koin.core.error.NoDefinitionFoundException
 import org.koin.core.option.hasViewModelScopeFactory
 import org.koin.core.parameter.ParametersDefinition
 import org.koin.core.qualifier.Qualifier
 import org.koin.core.qualifier.TypeQualifier
 import org.koin.core.scope.Scope
 import org.koin.core.scope.ScopeID
+import org.koin.ext.getFullName
 import org.koin.mp.KoinPlatformTools
 import org.koin.mp.generateId
 import org.koin.viewmodel.scope.ViewModelScopeArchetype
@@ -46,7 +49,23 @@ class KoinViewModelFactory(
         val androidParams = AndroidParametersHolder(params, extras)
         val koin = scope.getKoin()
         return if (!koin.optionRegistry.hasViewModelScopeFactory()){
-            scope.getWithParameters(kClass, qualifier, androidParams)
+            try {
+                scope.getWithParameters(kClass, qualifier, androidParams)
+            } catch (e: NoDefinitionFoundException) {
+                // #2417: the ViewModel may be declared inside viewModelScope { } (registered under
+                // the ViewModel scope archetype), which is only resolvable when the
+                // viewModelScopeFactory() option is enabled. Detect that and guide the user.
+                val isDeclaredInViewModelScope =
+                    koin.instanceRegistry.instances.containsKey(indexKey(kClass, qualifier, ViewModelScopeArchetype))
+                if (isDeclaredInViewModelScope) {
+                    throw IllegalStateException(
+                        "ViewModel '${kClass.getFullName()}' is declared inside viewModelScope { } but the viewModelScopeFactory() option is not enabled. " +
+                            "Enable it in your Koin configuration — options(viewModelScopeFactory()) — or move the ViewModel out of viewModelScope { }.",
+                        e,
+                    )
+                }
+                throw e
+            }
         } else {
             val scopeId = getViewModelScopeId(modelClass)
             val vmScope = koin.createScope(scopeId, TypeQualifier(modelClass), null, ViewModelScopeArchetype)
```

**File**: `projects/core/koin-core-viewmodel/src/commonTest/kotlin/org/koin/viewmodel/ViewModelScopeOptionTest.kt` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+package org.koin.viewmodel
+
+import androidx.lifecycle.ViewModel
+import androidx.lifecycle.ViewModelStore
+import androidx.lifecycle.viewmodel.CreationExtras
+import org.koin.core.annotation.KoinExperimentalAPI
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.annotation.KoinViewModelScopeApi
+import org.koin.core.error.NoDefinitionFoundException
+import org.koin.core.module.dsl.viewModel
+import org.koin.core.option.viewModelScopeFactory
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import org.koin.viewmodel.scope.viewModelScope
+import kotlin.test.Test
+import kotlin.test.assertFailsWith
+import kotlin.test.assertNotNull
+import kotlin.test.assertTrue
+
+/**
+ * #2417(b): a ViewModel declared inside viewModelScope { } resolves from _root_ and throws an
+ * opaque NoDefinitionFound when the viewModelScopeFactory() option is not enabled. The option is
+ * required for viewModelScope { } to be resolvable; the error should say so.
+ */
+@OptIn(KoinInternalApi::class, KoinExperimentalAPI::class, KoinViewModelScopeApi::class)
+class ViewModelScopeOptionTest {
+
+    class MyVM : ViewModel()
+    class UnregisteredVM : ViewModel()
+
+    @Test
+    fun viewModelScope_without_factory_option_gives_actionable_error_2417b() {
+        val koin = koinApplication {
+            modules(module { viewModelScope { viewModel { MyVM() } } })
+        }.koin
+
+        val error = assertFailsWith<Throwable> {
+            resolveViewModel(MyVM::class, ViewModelStore(), null, CreationExtras.Empty, null, koin.scopeRegistry.rootScope)
+        }
+        val msg = error.message ?: ""
+        assertTrue(
+            msg.contains("viewModelScopeFactory"),
+            "expected guidance to enable viewModelScopeFactory(), got: $msg",
+        )
+    }
+
+    @Test
+    fun viewModelScope_with_factory_option_resolves() {
+        val koin = koinApplication {
+            options(viewModelScopeFactory())
+            modules(module { viewModelScope { viewModel { MyVM() } } })
+        }.koin
+
+        val vm = resolveViewModel(MyVM::class, ViewModelStore(), null, CreationExtras.Empty, null, koin.scopeRegistry.rootScope)
+        assertNotNull(vm)
+    }
+
+    @Test
+    fun genuinely_missing_viewmodel_keeps_generic_error() {
+        val koin = koinApplication { }.koin
+
+        // UnregisteredVM is not declared anywhere → must stay a plain NoDefinitionFound,
+        // not the viewModelScopeFactory hint (guards against over-firing).
+        val error = assertFailsWith<NoDefinitionFoundException> {
+            resolveViewModel(UnregisteredVM::class, ViewModelStore(), null, CreationExtras.Empty, null, koin.scopeRegistry.rootScope)
+        }
+        assertTrue((error.message ?: "").contains("No definition found"))
+    }
+}
```

---

### Incident Patch 10: `b5ddd530` (2026-06-09)
**Commit Message**: Merge pull request #2438 from InsertKoinIO/fix/2379-root-factory-scoped-dep

Fix #2379 - root factory's scoped deps resolved from _root_ (CoreResolverV2)

**File**: `projects/core/koin-core/src/commonMain/kotlin/org/koin/core/resolution/CoreResolverV2.kt` (modified, +12/-0)
```diff
@@ -21,6 +21,7 @@ import org.koin.core.annotation.KoinInternalApi
 import org.koin.core.error.NoDefinitionFoundException
 import org.koin.core.instance.InstanceFactory
 import org.koin.core.instance.ResolutionContext
+import org.koin.core.instance.SingleInstanceFactory
 import org.koin.core.scope.Scope
 import org.koin.ext.getFullName
 
@@ -86,6 +87,17 @@ class CoreResolverV2(
             // 1. Registry on this linked scope
             val factory = findDefinitionInScope(linkedScope, ctx)
             if (factory != null) {
+                // #2379: a root FACTORY requested from a child scope keeps the ORIGINATING
+                // context, so its transitive (possibly scoped/archetype) dependencies
+                // resolve back in the requesting scope instead of falling through to _root_.
+                // The origin ctx already carries the scope + scopeArchetype and its params
+                // are already stacked on it, so no context switch or re-stacking is needed.
+                // Root SINGLES are excluded: a singleton must resolve its dependencies once,
+                // from root, and must never capture a scope-local instance (guard: #2325).
+                if (linkedScope.isRoot && factory !is SingleInstanceFactory<*>) {
+                    return factory.get(ctx) as T?
+                }
+
                 // we will loose parameters from parent context
                 val newCtx = ctx.newContextForScope(linkedScope)
                 if (linkedScope.scopeArchetype != null && !linkedScope.isRoot) {
```

**File**: `projects/core/koin-core/src/commonTest/kotlin/org/koin/core/ArchetypeDeclareResolveTest.kt` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package org.koin.core
+
+import org.koin.Simple
+import org.koin.core.annotation.KoinInternalApi
+import org.koin.core.component.getScopeId
+import org.koin.core.logger.Level
+import org.koin.core.module.KoinDslMarker
+import org.koin.core.module.Module
+import org.koin.core.qualifier.TypeQualifier
+import org.koin.dsl.ScopeDSL
+import org.koin.dsl.koinApplication
+import org.koin.dsl.module
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNotNull
+
+/**
+ * Regression repro for issue #2379 (archetype-scope variant).
+ *
+ * The plain named-scope case is covered by DeclareInstanceTest. The case still
+ * reported failing in 4.2.0/4.2.1 (dees91) uses an *archetype* scope
+ * (activityRetainedScope): a scoped definition resolved through its archetype,
+ * whose transitive get() for a declared dependency falls through to _root_.
+ */
+class ArchetypeDeclareResolveTest {
+
+    open class Archetype
+    class ArchetypeExt : Archetype()
+
+    @KoinDslMarker
+    fun Module.scopeArchetype(scopeSet: ScopeDSL.() -> Unit) {
+        val qualifier = TypeQualifier(Archetype::class)
+        ScopeDSL(qualifier, this).apply(scopeSet)
+    }
+
+    @OptIn(KoinInternalApi::class)
+    @Test
+    fun archetype_scope_resolves_declared_transitive_dependency_issue_2379() {
+        val scopeModule = module {
+            scopeArchetype {
+                scoped { Simple.ComponentB(get()) }
+            }
+        }
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(scopeModule)
+        }.koin
+
+        val archetypeExt = ArchetypeExt()
+        val scope = koin.createScope<ArchetypeExt>(
+            archetypeExt.getScopeId(), archetypeExt,
+            TypeQualifier(Archetype::class)
+        )
+        scope.declare(Simple.ComponentA())
+
+        // declared dependency must resolve from the scope it was declared in
+        val a = scope.getOrNull<Simple.ComponentA>()
+        assertNotNull(a)
+
+        // scoped ComponentB's transitive get() for ComponentA must resolve in-scope, not _root_
+        val b = scope.get<Simple.ComponentB>()
+        assertEquals(a, b.a)
+    }
+
+    // dees91 minimal shape: a ROOT factory depends on a SCOPED dependency,
+    // resolved transitively from the scope. v2 switches context to root when it
+    // finds the root factory via linked scopes, then can't resolve the scoped dep.
+    class Connector
+    class Interactor(val connector: Connector)
+
+    @OptIn(KoinInternalApi::class)
+    @Test
+    fun root_factory_depending_on_scoped_dep_resolves_in_scope_issue_2379() {
+        val scopeModule = module {
+            scopeArchetype {
+                scoped { Connector() }
+            }
+            factory { Interactor(get()) } // ROOT factory needs the scoped Connector
+        }
+        val koin = koinApplication {
+            printLogger(Level.DEBUG)
+            modules(scopeModule)
+        }.koin
+
+        val archetypeExt = ArchetypeExt()
+        val scope = koin.createScope<ArchetypeExt>(
+            archetypeExt.getScopeId(), archetypeExt,
+            TypeQualifier(Archetype::class)
+        )
+
+        // resolving the root factory FROM the scope must let its scoped dep resolve in-scope
+        val interactor = scope.get<Interactor>()
+        assertNotNull(interactor.connector)
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #2466** (closed): Setup koin version catalog (@kibettheophilus)
- **PR #2448** (2026-06-12): Finalize 4.2.2 — version bump + Navigation 3 typed entryProvider docs (#2336) (@arnaudgiuliani)
- **PR #2447** (closed): Fix #2386 - withOptions leaves stale index entries on qualifier/secondary change (@arnaudgiuliani)
- **PR #2446** (2026-06-12): Fix #2348 - ignore non-String environment properties (ClassCastException) (@arnaudgiuliani)
- **PR #2445** (closed): Fix #2410 - non-blocking RequestScope id (cherry-pick of #2432 by @lfavreli-betclic) (@arnaudgiuliani)
- **PR #2444** (2026-06-12): Fix #2299 - link viewModelScopeFactory scope to its parent scope (@arnaudgiuliani)
- **PR #2443** (2026-06-12): Docs: viewModelScope { } requires viewModelScopeFactory() (#2417) (@arnaudgiuliani)
- **PR #2442** (2026-06-12): Fix #2426 - add tvOS targets to koin-core-viewmodel (@arnaudgiuliani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
