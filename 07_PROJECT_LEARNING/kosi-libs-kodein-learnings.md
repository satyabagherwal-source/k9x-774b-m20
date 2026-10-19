> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kosi-libs-kodein-learnings.md`  
> **Source**: github ([https://github.com/kosi-libs/Kodein](https://github.com/kosi-libs/Kodein))  
> **Source Version**: `f26ea0c9`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T08:32:18.804Z  
> **Learning ID**: `learn-github-kosi-libs-kodein`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): kosi-libs/Kodein

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Kodein-DI is an inversion-of-control (IoC) dependency retrieval and injection engine built for Kotlin Multiplatform (JVM, Android, Native/iOS, JS, Wasm). It resolves the conflict between Kotlin's static generic type preservation and Java/JVM runtime type erasure, while eliminating runtime reflection overhead on non-JVM targets. It provides lazy evaluation, hierarchical context resolution (e.g., Android `Context` trees, Compose composition locals), scoped state retention (e.g., across Android configuration changes), and deterministic multi-binding retrieval (`Set<T>`, `Map<K, V>`).

### Subsystem Boundaries & Decoupling
```
+---------------------------------------------------------------------------------------+
|                                Framework Integrations                                 |
|  [kodein-di-framework-android-core] [kodein-di-framework-compose] [android-x-compose]  |
|   (Context resolution, Fragment      (rememberViewModel,          (NavBackStackEntry  |
|    retention, Lifecycles)             LocalDI composition)         scoping)           |
+-------------------------------------------+-------------------------------------------+
                                            |
+-------------------------------------------v-------------------------------------------+
|                          JSR-330 Lenient Reflection Extension                         |
|                             [kodein-di-jxinject-jvm]                                  |
|   (Hierarchical member reflection, LinkageError isolation, Android SDK type guards)  |
+-------------------------------------------+-------------------------------------------+
                                            |
+-------------------------------------------v-------------------------------------------+
|                                 Core DI Engine                                        |
|                                  [kodein-di]                                          |
|   - DI Container & DirectDI (Fast path retrieval)                                     |
|   - DIBuilderImpl & DSL (Scoped SetBinder, ArgSetBinder, @DslMarker guards)           |
|   - Scope Registry (StandardScopeRegistry, SingleItemScopeRegistry, ContextTranslator)|
|   - Concurrency Engine (maySynchronized, synchronizedIfNull, SynchronizedObject)      |
+-------------------------------------------+-------------------------------------------+
                                            |
+-------------------------------------------v-------------------------------------------+
|                                Type System Abstraction                                |
|                                   [kodein-type]                                       |
|   - TypeToken<T> / generic<T>() vs erased<T>() / erasedComp()                         |
+---------------------------------------------------------------------------------------+
```

### Critical Subsystem Abstractions
1. **TypeToken & Type Preservation (`org.kodein.type`)**: Instead of relying solely on `Class<T>` or `KClass<T>` (which erase generic type parameters at runtime like `List<String>` into `List`), Kodein captures anonymous supertypes via `generic<T>()` at compilation boundaries using inline reified parameters, packaging them into `TypeToken<T>`.
2. **Contextual Translation Pipeline (`ContextTranslator`)**: Decouples domain consumer scopes from target framework lifecycles. A context translator converts a leaf framework type (e.g., Android `View`, `Dialog`, `Fragment`) upward into a stable scoping context (e.g., `Activity` or `Context`) without requiring downstream bindings to explicitly handle each framework variant.
3. **Double-Checked Concurrency Primitives (`maySynchronized`)**: Wraps JetBrains `kotlinx.atomicfu.locks.SynchronizedObject`. On Native and Wasm platforms where threading models vary or locks produce severe CPU cache synchronization overhead, it provides conditional null-lock bypasses and lock-guarded double-checks (`synchronizedIfNull`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. LinkageError Boundary Containment for Dynamic Member Reflection
**RULE**:
When walking class inheritance hierarchies via reflection to enumerate fields, methods, or constructors across heterogeneous runtime environments (such as Android multi-API baselines or modular JVM runtimes), code MUST wrap every single `Class.getDeclaredFields()` and `Class.getDeclaredMethods()` invocation in a catch block specifically intercepting `java.lang.LinkageError` (specifically `NoClassDefFoundError`). Code MUST NOT catch only `Exception` or `ClassNotFoundException`.

**WHY**:
The JVM and Android ART runtimes lazily verify types. Compiling an application against API Level 34 allows bytecode references to modern framework types (e.g., `android.app.PictureInPictureUiState`). When executed on an API 30 device, the runtime ignores absent classes as long as methods referencing them are never executed. However, calling `cls.declaredMethods` forces the virtual machine to immediately resolve and link *all* parameter and return types for *every* declared member on that class level, even if the member is unannotated and completely unrelated to the target operation. If an unresolvable type is referenced anywhere in that class, the JVM raises a fatal `NoClassDefFoundError` (which extends `LinkageError`, an `Error`, bypassing standard `catch (e: Exception)` boundaries), terminating the entire injection chain.

**WHEN TO APPLY**:
Apply in any IoC container, reflection scanner, ORM entity mapper, or serialization framework that introspects class hierarchies where classes may be compiled against higher SDK/library baselines than the current runtime execution target.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Extracted from org.kodein.di.jxinject.internal.JxInjectorContainer
private inline fun <reified M> declaredMembersOrEmpty(
    cls: Class<*>, 
    kind: String, 
    members: () -> Array<M>
): Array<M> =
    try {
        members()
    } catch (error: LinkageError) {
        // Must log as warning and skip hierarchy level rather than aborting traversal
        logger.log(
            Level.WARNING,
            "Could not introspect the $kind of ${cls.name}: any @Inject member it declares " +
                "will NOT be injected. This usually means a member signature references a type " +
                "that is absent at runtime.",
            error
        )
        emptyArray()
    }

// Usage during hierarchy traversal:
val fields = declaredMembersOrEmpty(cls, "fields") { cls.declaredFields }
val methods = declaredMembersOrEmpty(cls, "methods") { cls.declaredMethods }
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Will crash with NoClassDefFoundError on older Android API devices
private fun inspectHierarchy(cls: Class<*>) {
    try {
        val methods = cls.declaredMethods // THROWS NoClassDefFoundError (extends Error, NOT Exception!)
        for (method in methods) {
            processMethod(method)
        }
    } catch (e: Exception) { // FAILS TO CATCH LinkageError!
        logger.warn("Inspection failed", e)
    }
}
```

**VERIFICATION METHOD**:
Implement a custom isolating `ClassLoader` that selectively throws `ClassNotFoundException` when loading a dummy canary type (e.g. `LenientMissing`). Compile a base class referencing this missing type in an unused method signature. Execute the reflection engine over a subclass that inherits from this base class and assert that introspection completes without throwing `LinkageError` and logs exactly one `Level.WARNING`.

---

### 2. Full-Fidelity TypeToken Propagation Across UI Component Factories
**RULE**:
When writing factory adapters bridging a dynamic IoC container into an external framework factory interface that operates on raw or erased classes (such as Android's `ViewModelProvider.Factory` or Jetpack Compose `ViewModelStore`), the adapter MUST explicitly capture and retain the fully qualified, reified `TypeToken<T>` or `KType` at the inline call site and delegate to the DI container using that reified type token. The adapter MUST NOT reconstruct the type token from the framework's erased `Class<T>` or `KClass<T>` parameter.

**WHY**:
Modern frameworks frequently pass a raw `Class<T>` (e.g. `create(modelClass: Class<T>): T`) to factory callbacks. If the ViewModel or dependency requires generic specialization (e.g., `ListViewModel<User>` vs `ListViewModel<Product>`, or complex type-parameterized state holders), relying on `erased(modelClass)` strips all generic arguments. The DI container receives `TypeToken<ListViewModel<*>>` instead of `TypeToken<ListViewModel<User>>`, causing dependency resolution to fail with `DI.NotFoundException` or silently returning the wrong injected instance.

**WHEN TO APPLY**:
In all Kotlin Multiplatform and Android integration wrappers connecting DI containers to lifecycle-managed factories (`ViewModelProvider.Factory`, Koin/Kodein adapters, custom Jetpack Compose State holders).

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Extracted from org.kodein.di.compose.android.KodeinViewModelScopedFactory
@PublishedApi
internal class KodeinViewModelScopedSingleton(
    private val di: DI,
    private val vmType: TypeToken<*>,
    private val tag: String? = null,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
        // Use vmType, preserving complete generic arguments, NOT erased(modelClass)
        di.direct.Instance(type = vmType as TypeToken<T>, tag = tag)
}

// Inline DSL entry point capturing full reified type at callsite:
public inline fun <reified VM : ViewModel> rememberViewModel(
    di: DI,
    tag: String? = null
): VM {
    return ViewModelLazy(
        viewModelClass = VM::class,
        storeProducer = { viewModelStoreOwner.viewModelStore },
        factoryProducer = { 
            KodeinViewModelScopedSingleton(
                di = di, 
                vmType = generic<VM>(), // Reified generic token preserved!
                tag = tag
            ) 
        }
    ).value
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: modelClass loses generic type arguments due to JVM type erasure
public class BadViewModelFactory(
    private val di: DI,
    private val tag: String? = null
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        // FATAL: erased(modelClass) discards type parameters!
        // Container cannot distinguish Repository<A> from Repository<B>
        return di.direct.Instance(type = erased(modelClass), tag = tag)
    }
}
```

**VERIFICATION METHOD**:
Create a generic ViewModel: `class ParametrizedViewModel<T : Any>(val item: T) : ViewModel()`. Register two distinct bindings in the DI container: `bind { singleton { ParametrizedViewModel<String>("hello") } }` and `bind { singleton { ParametrizedViewModel<Int>(42) } }`. Resolve both via the factory and assert that `rememberViewModel<ParametrizedViewModel<String>>()` and `rememberViewModel<ParametrizedViewModel<Int>>()` resolve distinct instances without `TypeCastException` or `NotFoundException`.

---

### 3. Logcat Tag Length Compliance for Internal Module Loggers
**RULE**:
When configuring platform logging bridges (such as `java.util.logging.Logger` or Android's `android.util.Log`) in libraries intended to run on Android, the logger name constant MUST NOT exceed 23 characters if it is intended to map directly to an Android Logcat tag.

**WHY**:
On Android versions prior to API 24 (and in strict `AndroidHandler` implementations of `java.util.logging`), passing a tag longer than 23 characters throws an `IllegalArgumentException: Log tag '...' exceeds limit of 23 characters` or causes the tag to be silently truncated. Truncating dynamic class names breaks developer log filtering (`adb logcat -s <TAG>`) and prevents configuration via standard logging properties (e.g. `org.kodein.di.jxinject.level = OFF`).

**WHEN TO APPLY**:
Whenever defining `Logger.getLogger(...)` in libraries targeting Android or Kotlin Multiplatform JVM/Android modules.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Extracted from org.kodein.di.jxinject.internal.JxInjectorContainer
internal class JxInjectorContainer(qualifiers: Set<Qualifier>) {
    internal companion object {
        /**
         * Deliberately a literal rather than this class' name: JxInjectorContainer is internal and
         * its FQN is an implementation detail. It is exactly 22 characters, so Android's
         * `AndroidHandler` uses it verbatim as the logcat tag (it truncates anything longer than 23).
         */
        private const val LOGGER_NAME: String = "org.kodein.di.jxinject" // Exactly 22 chars!

        private val logger: Logger = Logger.getLogger(LOGGER_NAME)
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Dynamically using fully qualified class name causes crash or truncation on Android
internal class JxInjectorContainer {
    companion object {
        // Value is "org.kodein.di.jxinject.internal.JxInjectorContainer" -> 50 characters!
        // Triggers IllegalArgumentException or silent truncation in AndroidHandler
        private val logger = Logger.getLogger(JxInjectorContainer::class.java.name)
    }
}
```

**VERIFICATION METHOD**:
Implement a static unit test or architecture lint assertion verifying that all `LOGGER_NAME` constants within modules deployed to Android satisfy `LOGGER_NAME.length <= 23`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: NoClassDefFoundError During JSR-330 Member Reflection Walk (BUG-KOD-01)
- **Context**: `kodein-di-jxinject-jvm/src/main/kotlin/org/kodein/di/jxinject/internal/JxInjectorContainer.kt`
- **What Was Expected**: Injecting dependencies into an Android component (such as an `Activity`) whose superclass hierarchy contains classes compiled against newer Android APIs should inject the annotated `@Inject` members of the child class and continue up the hierarchy without crashing.
- **What Actually Happened**: On an Android API 30 device, running an app compiled with `androidx.activity:activity:1.13.0+` crashed with `java.lang.NoClassDefFoundError: Failed resolution of: Landroid/app/PictureInPictureUiState;`. The crash occurred immediately during dependency retrieval before any injection code executed.
- **Evidence in Repo**: Commit `4c2a4813`, PR #513, Issue #508, covered by regression test `InjectJvmTests_05_LenientReflection.java`.
- **Root Cause**: `JxInjectorContainer.fillMembersSetters` invoked `cls.declaredFields` and `cls.declaredMethods`. In `androidx.activity.ComponentActivity`, a method signature declared `onPictureInPictureUiStateChanged(PictureInPictureUiState)`. On Android API < 31, `PictureInPictureUiState` does not exist in the framework boot classpath. Calling `getDeclaredMethods()` forced the ART runtime to resolve every parameter type in every method signature on `ComponentActivity`. Since the type was absent, ART threw a `NoClassDefFoundError`. Because Kodein did not catch `LinkageError`, the entire hierarchy walk aborted.
- **Remediation Code Diff**:
```kotlin
// - Buggy code:
- members = cls.declaredFields,
...
- members = cls.declaredMethods,

// + Fixed pattern:
+ private inline fun <reified M> declaredMembersOrEmpty(cls: Class<*>, kind: String, members: () -> Array<M>): Array<M> =
+     try {
+         members()
+     } catch (error: LinkageError) {
+         logger.log(
+             Level.WARNING,
+             "Could not introspect the $kind of ${cls.name}: any @Inject member it declares will NOT be injected. " +
+                 "This usually means a member signature references a type that is absent at runtime.",
+             error
+         )
+         emptyArray()
+     }
...
+ members = declaredMembersOrEmpty(cls, "fields") { cls.declaredFields },
...
+ members = declaredMembersOrEmpty(cls, "methods") { cls.declaredMethods },
```
- **Lesson**: Reflective hierarchy walks must treat every class level's declared member array as potentially un-linkable. Contain the boundary using `LinkageError` and degrade gracefully by skipping introspection of that specific hierarchy level.

---

### Incident 2: ViewModel Type Erasure in Compose Scoped Factories (BUG-KOD-02)
- **Context**: `framework/compose/kodein-di-framework-android-x-compose/src/main/kotlin/org/kodein/di/compose/android/KodeinViewModelScopedFactory.kt` and `framework/compose/kodein-di-framework-compose/src/commonMain/kotlin/org.kodein.di.compose/viewmodel/KodeinViewModelScope.kt`
- **What Was Expected**: Resolving a generic ViewModel (e.g., `rememberViewModel<UserViewModel<DomainUser>>()`) within Jetpack Compose must query the DI container using the complete generic type token.
- **What Actually Happened**: The DI container failed with `DI.NotFoundException` when looking up parameterized ViewModels, or returned an incorrect binding when multiple ViewModels shared the same raw class with different generic arguments.
- **What Was Observed**: Commit `ba2ffa38`, Issue #506, PR #507.
- **Root Cause**: `KodeinViewModelScopedFactory` and `KodeinViewModelScopedSingleton` implemented `ViewModelProvider.Factory`. Inside their `create(modelClass: Class<T>)` / `create(modelClass: KClass<T>)` implementations, they invoked `di.direct.Instance(type = erased(modelClass))`. The reified generic arguments available at the caller site (`rememberViewModel<reified VM>()`) were discarded.
- **Remediation Code Diff**:
```kotlin
// - Buggy code:
- public class KodeinViewModelScopedSingleton(
-     private val di: DI,
-     private val tag: String? = null,
- ) : ViewModelProvider.Factory {
-     override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
-         di.direct.Instance(type = erased(modelClass), tag = tag)
- }

// + Fixed pattern:
+ @PublishedApi
+ internal class KodeinViewModelScopedSingleton(
+     private val di: DI,
+     private val vmType: TypeToken<*>,
+     private val tag: String? = null,
+ ) : ViewModelProvider.Factory {
+     @Suppress("UNCHECKED_CAST")
+     override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T =
+         di.direct.Instance(type = vmType as TypeToken<T>, tag = tag)
+ }
```
- **Lesson**: Do not let framework callback signatures dictate your type fidelity. Capture the reified type parameter in the outer inline function and store it in the factory constructor instance.

---

### Incident 3: DSL Receiver Scope Leaks on SetBinder and ArgSetBinder (BUG-KOD-03)
- **Context**: `kodein-di/src/commonMain/kotlin/org/kodein/di/DI.kt` and `DIBuilderImpl.kt`
- **What Was Expected**: When configuring a multi-binding set using `bindSet<IPerson> { ... }`, the builder inside the lambda should permit defining scoped bindings (`scoped(myScope).singleton { ... }`) or non-scoped bindings without exposing outer DSL scope methods that corrupt the binding hierarchy.
- **What Actually Happened**: Applying `@DIDsl` directly to the `SetBinder` interface caused compiler resolution ambiguities and prohibited the builder from properly binding scoped items within the set.
- **Evidence in Repo**: Commit `07bc997f`, Issue #504, PR #505, covered by tests `test_18_ScopedSetBindingSingleton`, `test_19_NonScopedSetBindingConvenienceMethods`, `test_20_ScopedArgSetBindingMultiton`.
- **Root Cause**: `SetBinder` previously extended `BindBuilder.WithScope<Any>` and had `@DIDsl` applied at the interface level. This forced the compiler's DSL marker resolution to collide with outer binding contexts, preventing correct resolution of `scoped()` delegates inside `bindSet`.
- **Remediation Code Diff**:
```kotlin
// - Buggy code:
- @DIDsl
- public interface SetBinder<T : Any> : BindBuilder.WithScope<Any> {
...
- @DIDsl
- public interface ArgSetBinder<A : Any, T : Any> : BindBuilder.WithScope<Any> {

// + Fixed pattern:
+ public interface SetBinder<T : Any> {
...
+ public interface ArgSetBinder<A : Any, T : Any> {
```
In `DIBuilderImpl.kt`, properties were removed from interface override:
```kotlin
- override val contextType: TypeToken<Any> get() = ...
- override val scope: Scope<Any?> get() = ...
- override val explicitContext: Boolean get() = ...
+ val contextType: TypeToken<Any> get() = ...
+ val scope: Scope<Any?> get() = ...
+ val explicitContext: Boolean get() = ...
```
- **Lesson**: Avoid over-inheriting DSL scope marker interfaces on sub-builders. Deep inheritance of `@DslMarker` interfaces can shadow receiver scope resolution and prevent inner scoped operations from accessing their necessary outer builders.

---

### Incident 4: Antora Documentation and Release Tag Version Mismatch (BUG-KOD-04)
- **Context**: `.github/workflows/release.yml`, `doc/antora.yml`
- **What Was Expected**: Automated CI/CD release publishing should prevent releases if documentation metadata, Gradle project versions, and Git tags diverge.
- **What Actually Happened**: Releases could be triggered where documentation attributes (such as `antora.yml` attributes `version: 7.33.0`, `display_version: 7.33`, and `branch: release/v7.33`) were out of sync with the actual Gradle build version, producing broken published documentation links and missing versioned pages.
- **Evidence in Repo**: Closed Issue #514.
- **Root Cause**: Lack of automated verification step before the release build executes. Documentation configuration was maintained manually without a pre-flight schema barrier.
- **Remediation**:
  Integrated `KodeinKoders/kodein-github-actions/version-check@v0.2` into `.github/workflows/release.yml` as a blocking gate prior to unit, integration, and deployment jobs. If `antora.yml` disagrees with the release tag or Gradle version, CI fails immediately before invoking `./gradlew publish`.
- **Lesson**: Configuration metadata across documentation generators (Antora/Dokka) and build descriptors (Gradle) must have automated, pre-build cross-validation in the CI pipeline.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Operator Precedence in Context Resolution**:
  ```kotlin
  // In org.kodein.di.android.closest.kt:
  context = if (context is ContextWrapper) context.baseContext else null
  ```
  *Invariant*: In Kotlin, `if-else` is an expression. When chained, parenthesis must clearly delineate assignment versus logical comparison. If written as `context = context.baseContext as? ContextWrapper`, it would fail if `baseContext` itself is not a wrapper but is still a valid `Context`.
- **Type Erasure vs Generic Preservation**:
  `erasedComp(Set::class, setBindingType) as TypeToken<Set<T>>`
  *Invariant*: When dealing with multi-bindings, standard reflection produces raw `Set`. Kodein constructs composite tokens via `erasedComp` by pairing the container `KClass` with the captured element type token, preventing Kotlin's runtime unchecked cast warnings from masking downstream type corruption.
- **Literal String Tagging for Android Framework Boundaries**:
  Never use reflection (`this::class.java.name`) to create names that pass through Android OS inter-process or system log boundaries. Android OS enforces strict size bounds (e.g., 23-byte tag limits on `logcat`, `Bundle` transaction limits). Explicit literals (e.g. `"org.kodein.di.jxinject"`) prevent build obfuscation (R8/ProGuard) from mutating string tokens needed for system identification.

---

### 2. Infinite Loop & Recursion Guards
- **Termination Invariant in Context Walking**:
  In `closestDI(thisRef: Any?, rootContext: Context)`:
  ```kotlin
  var context: Context? = rootContext
  while (context != null) {
      if (context != thisRef && context is DIAware) {
          return context.di
      }
      context = if (context is ContextWrapper) context.baseContext else null
  }
  ```
  *Proof of Termination*: `ContextWrapper.baseContext` forms a directed acyclic graph ending at `Application` or a native platform context whose `baseContext` is either `null` or identical to itself. By testing `context != thisRef` and checking `context is ContextWrapper`, cycles where a wrapper points to itself are prevented, and the loop deterministically terminates at `null` or reaches the fallback `rootContext.applicationContext as? DIAware`.
- **Tail-Recursive Class Hierarchy Traversal**:
  In `JxInjectorContainer`:
  ```kotlin
  private tailrec fun fillMembersSetters(cls: Class<*>, setters: MutableList<DirectDI.(Any) -> Any>) {
      if (cls == Any::class.java)
          return
      // Process members of cls
      ...
      fillMembersSetters(cls.superclass ?: return, setters)
  }
  ```
  *Termination Proof*: Every class in the JVM hierarchy eventually inherits from `java.lang.Object` (`Any::class.java`). For interfaces or primitives, `cls.superclass` returns `null`. The recursion is strictly bounded by the maximum inheritance depth (typically < 30 levels) and marked `tailrec` to ensure the Kotlin compiler compiles it into an iterative loop, preventing `StackOverflowError`.

---

### 3. UI & UX Micro-Mechanics
- **Jetpack Compose Recomposition & Remember Keys**:
  In `framework/compose/.../navGraphViewModel.kt`:
  ```kotlin
  remember(this@navGraphViewModel, di, tag) {
      val provider = ViewModelProvider(
          navHostController.getBackStackEntry(getParentId()).viewModelStore,
          KodeinViewModelScopedSingleton(di = di, vmType = generic<VM>(), tag = tag)
      )
      ...
  }
  ```
  *Mechanic*: If `di`, `tag`, or the navigation entry changes, the Compose runtime discards the old `ViewModelProvider` and creates a fresh instance. If `remember` lacked these explicit keys, recomposition with an updated `tag` would return the stale ViewModel instance from the previous tag, causing UI state cross-contamination across navigation transitions.
- **Fragment Retain State Race Conditions (Pre-Android N)**:
  In `ActivityRetainedScope`:
  ```kotlin
  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      context.fragmentManager.beginTransaction().add(it, SCOPE_FRAGMENT_TAG).commitNow()
  } else {
      transactionPendingFragmentCache[context] = WeakReference(it)
      it.transactionPendingFragmentCache = transactionPendingFragmentCache
      context.fragmentManager.beginTransaction().add(it, SCOPE_FRAGMENT_TAG).commit()
  }
  ```
  *Mechanic*: Prior to Android Nougat (API 24), `commitNow()` did not exist. Normal `commit()` schedules fragment transactions asynchronously on the main looper microtask queue. If code requests the retained DI container twice within the same frame, the second call fails to find the fragment via `findFragmentByTag` because the transaction hasn't executed yet. Kodein solves this with a `transactionPendingFragmentCache` containing a `WeakReference<RetainedScopeFragment>`, clearing it during the fragment's `onAttach` callback.

---

### 4. Backend Concurrency & Memory Safety
- **Platform-Optimized Synchronization (`maySynchronized`)**:
  ```kotlin
  // In org.kodein.di.internal.concurrent.kt
  public inline fun <R> maySynchronized(lock: SynchronizedObject?, block: () -> R): R =
      if (lock == null) {
          block()
      } else {
          synchronized(lock, block)
      }
  ```
  *Concurrency Invariant*: Using heavy locks across Kotlin Native targets induces atomic contention overhead and memory fences that degrade performance (JetBrains CMP-1182 / KT-70751). Kodein allows nullable `SynchronizedObject` locks. Single-threaded Native configurations or immutable containers pass `null`, eliding monitor overhead entirely.
- **Double-Checked Locking Invariant (`synchronizedIfNull`)**:
  ```kotlin
  public inline fun <T: Any, R> synchronizedIfNull(
      lock: SynchronizedObject?, 
      predicate: () -> T?, 
      ifNotNull: (T) -> R, 
      ifNull: () -> R
  ): R {
      predicate()?.let { return ifNotNull(it) } // First check (lock-free)
      val value = maySynchronized(lock) {
          predicate()?.let { return@maySynchronized it } // Second check (under lock)
          return ifNull()
      }
      return ifNotNull(value)
  }
  ```
  *Memory Safety Proof*: Guarantees that the critical initialization (`ifNull()`) executes exactly once even under multi-threaded races, while allowing subsequent reads to bypass the lock completely.

---

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Null Safety in Android Application Resolution**:
  ```kotlin
  val appContext = rootContext.applicationContext as? DIAware
      ?: error("Trying to find closest DI, but no DI container was found at all. Your Application should be DIAware.")
  ```
  *Defect Trap*: If an activity is invoked inside an isolated test environment (e.g. Robolectric or `ActivityScenario`) where `Application` does not implement `DIAware`, an uncontrolled `NullPointerException` or `ClassCastException` would crash the runner with no actionable context. The explicit Elvis operator with descriptive panic message pinpoints the missing integration contract.
- **Generic Wildcard Unwrapping**:
  In `org/kodein/di/jxinject/reflect-utils.kt`:
  ```kotlin
  internal fun Type.rawType(): Class<*> = when (this) {
      is Class<*> -> this
      is ParameterizedType -> rawType.rawType()
      is WildcardType -> upperBounds[0].rawType()
      else -> throw IllegalStateException("Cannot get raw type of $this")
  }
  ```
  *Defect Trap*: Nested types such as `List<? extends Map<String, ? extends Provider<Service>>>` produce multiple layers of `WildcardType` and `ParameterizedType`. Failing to recursively resolve `rawType` on the child returns the container interface instead of the raw class, corrupting dependency keys.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Layering**: Strictly decoupled core runtime (`kodein-di`) that has zero external framework dependencies, extended via modular framework adapters (`kodein-di-framework-android-*`, `kodein-di-framework-compose`).
- **State Ownership**: DI containers are immutable after construction. Mutable state is quarantined into `ScopeRegistry` instances (e.g., `StandardScopeRegistry`), which are explicitly tied to external lifecycles (Activities, HTTP requests, navigation entries).

### 2. Core Abstractions
- `DI`: The root IoC container providing lazy retrieval primitives (`by di.instance()`).
- `DirectDI`: The non-lazy, direct evaluation path used internally by factory providers and performance-critical loops to avoid `Lazy` object allocation.
- `Scope<C>`: A contract that maps a context `C` (e.g., `Activity`) to a `ScopeRegistry`.
- `TypeToken<T>`: Abstract model representing full reified types across JVM, JS, and Native runtimes.

### 3. Error Handling
- **Linkage Isolation**: High-risk reflective introspection is shielded with `LinkageError` catches to gracefully handle missing platform classes.
- **Cycle Detection**: Core bindings build dependency trees that detect circular references during container construction, throwing `DI.DependencyLoopException` instead of triggering a runtime `StackOverflowError`.

### 4. Testing
- **Dynamic Class Loader Mocking**: Emulates legacy or missing runtime Android frameworks using a custom `HidingClassLoader` that intercepts byte arrays and intercepts specific type resolution requests (see `InjectJvmTests_05_LenientReflection.java`).
- **Scope Cleansing Invariant Verification**: Verifies that clearing a `ScopeRegistry` completely drops references and causes subsequent requests to recreate independent instances (`assertTrue(personsA.none { a -> personsA3.any { b -> a === b } })`).

### 5. Security
- **Reflection Boundary Lockdown**: Restricts reflection to internal helper classes (`@PublishedApi internal`).
- **Context Isolation**: Multi-tenant or multi-activity applications can isolate scopes using distinct `ScopeRegistry` instances, preventing data leaks