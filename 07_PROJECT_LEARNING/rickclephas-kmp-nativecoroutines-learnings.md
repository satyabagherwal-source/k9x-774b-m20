# Forensic Learning Record (Deep Inspection): rickclephas/KMP-NativeCoroutines

> **Canonical Artifact**: `07_PROJECT_LEARNING/rickclephas-kmp-nativecoroutines-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rickclephas/KMP-NativeCoroutines](https://github.com/rickclephas/KMP-NativeCoroutines))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:19:00.107Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rickclephas/KMP-NativeCoroutines`
- **Description**: Library to use Kotlin Coroutines from Swift code in KMP apps
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1326 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `KMPNativeCoroutinesCore/NativeCallback.swift`
```
//
//  NativeCallback.swift
//  KMPNativeCoroutinesCore
//
//  Created by Rick Clephas on 06/06/2021.
//

/// A callback with a single argument.
///
/// The return value is provided as the second argument.
/// This way Swift doesn't known what it is/how to get it.
public typealias NativeCallback<T, Unit> = (T, Unit) -> Unit

/// A callback with two arguments.
///
/// The return value is provided as the third argument.
/// This way Swift doesn't known what it is/how to get it.
public typealias NativeCallback2<T1, T2, Unit> = (T1, T2, Unit) -> Unit

```

### Core Architecture Module: `KMPNativeCoroutinesCore/NativeCancellable.swift`
```
//
//  NativeCancellable.swift
//  KMPNativeCoroutinesCore
//
//  Created by Rick Clephas on 06/06/2021.
//

/// A function that cancels the coroutines job.
public typealias NativeCancellable<Unit> = () -> Unit

```

### Core Architecture Module: `KMPNativeCoroutinesCore/NativeFlow.swift`
```
//
//  NativeFlow.swift
//  KMPNativeCoroutinesCore
//
//  Created by Rick Clephas on 06/06/2021.
//

/// A function that collects a Kotlin coroutines Flow via callbacks.
///
/// The function takes an `onItem`, `onComplete` and `onCancelled` callback
/// and returns a cancellable that can be used to cancel the collection.
public typealias NativeFlow<Output, Failure: Error, Unit> = (
    _ onItem: @escaping NativeCallback2<Output, () -> Unit, Unit>,
    _ onComplete: @escaping NativeCallback<Failure?, Unit>,
    _ onCancelled: @escaping NativeCallback<Failure, Unit>
) -> NativeCancellable<Unit>

@available(*, deprecated, message: "Internal API used for Swift export source compatibility")
@available(iOS 13.0, macOS 10.15, tvOS 13.0, watchOS 6.0, *)
public func nativeFlow<Sequence: AsyncSequence>(for asyncSequence: Sequence) -> NativeFlow<Sequence.Element, Error, Void> {
    { onItem, onComplete, onCancelled in
        let task = Task {
            do {
                for try await element in asyncSequence {
                    await withUnsafeContinuation { continuation in
                        onItem(element, continuation.resume, ())
                    }
                }
                onComplete(nil, ())
            } catch {
                if error is CancellationError {
                    onCancelled(error, ())
                } else {
                    onComplete(error, ())
                }
            }
        }
        return { task.cancel() }
    }
}

```

### Core Architecture Module: `KMPNativeCoroutinesCore/NativeSuspend.swift`
```
//
//  NativeSuspend.swift
//  KMPNativeCoroutinesCore
//
//  Created by Rick Clephas on 06/06/2021.
//

/// A function that awaits a suspend function via callbacks.
///
/// The function takes an `onResult`, `onError` and `onCancelled` callback
/// and returns a cancellable that can be used to cancel the suspend function.
public typealias NativeSuspend<Result, Failure: Error, Unit> = (
    _ onResult: @escaping NativeCallback<Result, Unit>,
    _ onError: @escaping NativeCallback<Failure, Unit>,
    _ onCancelled: @escaping NativeCallback<Failure, Unit>
) -> NativeCancellable<Unit>

```

### Core Architecture Module: `kmp-nativecoroutines-annotations/src/commonMain/kotlin/com/rickclephas/kmp/nativecoroutines/NativeCoroutinesRefinedState.kt`
```
package com.rickclephas.kmp.nativecoroutines

import kotlin.experimental.ExperimentalObjCRefinement
import kotlin.native.HidesFromObjC
import kotlin.native.ShouldRefineInSwift

/**
 * Identifies `StateFlow` properties that require a native [ShouldRefineInSwift] state version.
 */
@Target(AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.BINARY)
@MustBeDocumented
@OptIn(ExperimentalObjCRefinement::class)
@HidesFromObjC
public annotation class NativeCoroutinesRefinedState

```

### Core Architecture Module: `kmp-nativecoroutines-annotations/src/commonMain/kotlin/com/rickclephas/kmp/nativecoroutines/NativeCoroutinesState.kt`
```
package com.rickclephas.kmp.nativecoroutines

import kotlin.experimental.ExperimentalObjCRefinement
import kotlin.native.HidesFromObjC

/**
 * Identifies `StateFlow` properties that require a native state version.
 */
@Target(AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.BINARY)
@MustBeDocumented
@OptIn(ExperimentalObjCRefinement::class)
@HidesFromObjC
public annotation class NativeCoroutinesState

```

### Core Architecture Module: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/classic/utils/CoroutinesReturnType.kt`
```
package com.rickclephas.kmp.nativecoroutines.compiler.classic.utils

import com.rickclephas.kmp.nativecoroutines.compiler.utils.ClassIds
import com.rickclephas.kmp.nativecoroutines.compiler.utils.CoroutinesReturnType
import org.jetbrains.kotlin.K1Deprecation
import org.jetbrains.kotlin.descriptors.CallableDescriptor
import org.jetbrains.kotlin.descriptors.ModuleDescriptor
import org.jetbrains.kotlin.descriptors.findClassifierAcrossModuleDependencies
import org.jetbrains.kotlin.name.ClassId
import org.jetbrains.kotlin.resolve.calls.inference.returnTypeOrNothing
import org.jetbrains.kotlin.resolve.descriptorUtil.module
import org.jetbrains.kotlin.types.TypeConstructor
import org.jetbrains.kotlin.types.typeUtil.supertypes

@OptIn(K1Deprecation::class)
@Suppress("UnstableApiUsage")
internal val CallableDescriptor.coroutinesReturnType: CoroutinesReturnType? get() {
    val returnType = returnTypeOrNothing
    val stateFlowConstructor = module.findTypeConstructor(ClassIds.stateFlow)
    if (returnType.constructor == stateFlowConstructor) return CoroutinesReturnType.Flow.State
    val flowConstructor = module.findTypeConstructor(ClassIds.flow)
    if (returnType.constructor == flowConstructor) return CoroutinesReturnType.Flow.Generic
    val coroutineScopeConstructor = module.findTypeConstructor(ClassIds.coroutineScope)
    if (returnType.constructor == coroutineScopeConstructor) return CoroutinesReturnType.CoroutineScope
    returnType.supertypes().forEach {
        if (it.constructor == stateFlowConstructor) return CoroutinesReturnType.Flow.State
        if (it.constructor == flowConstructor) return CoroutinesReturnType.Flow.Generic
        if (it.constructor == coroutineScopeConstructor) return CoroutinesReturnType.CoroutineScope
    }
    return null
}

private fun ModuleDescriptor.findTypeConstructor(classId: ClassId): TypeConstructor =
    findClassifierAcrossModuleDependencies(classId)?.typeConstructor
        ?: throw NoSuchElementException("Couldn't find ${classId.relativeClassName} constructor")

```

### Core Architecture Module: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/classic/utils/ImplicitReturnType.kt`
```
package com.rickclephas.kmp.nativecoroutines.compiler.classic.utils

import org.jetbrains.kotlin.psi.KtCallableDeclaration
import org.jetbrains.kotlin.psi.KtNamedFunction

// https://github.com/JetBrains/kotlin/blob/fef7e06fe2603d0a2f53994247a4cbd1467457a5/compiler/frontend/src/org/jetbrains/kotlin/resolve/checkers/ExplicitApiDeclarationChecker.kt#L125-L134
internal fun KtCallableDeclaration.hasImplicitReturnType(): Boolean {
    if (typeReference != null) return false
    if (this is KtNamedFunction && hasBlockBody()) return false
    return true
}

```

### Core Architecture Module: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/classic/utils/NativeCoroutinesAnnotations.kt`
```
package com.rickclephas.kmp.nativecoroutines.compiler.classic.utils

import com.rickclephas.kmp.nativecoroutines.compiler.utils.NativeCoroutinesAnnotation
import org.jetbrains.kotlin.descriptors.annotations.Annotated
import org.jetbrains.kotlin.descriptors.annotations.AnnotationDescriptor

internal fun Annotated.getNativeCoroutinesAnnotations(): Map<NativeCoroutinesAnnotation, AnnotationDescriptor> = buildMap {
    for (annotation in annotations) {
        val fqName = annotation.fqName ?: continue
        val nativeCoroutinesAnnotation = NativeCoroutinesAnnotation.forFqName(fqName) ?: continue
        put(nativeCoroutinesAnnotation, annotation)
    }
}

internal val AnnotationDescriptor.isNativeCoroutinesAnnotation: Boolean get() {
    val fqName = fqName ?: return false
    return NativeCoroutinesAnnotation.entries.any { it.fqName == fqName }
}

```

### Core Architecture Module: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/classic/utils/ObjCRefinement.kt`
```
package com.rickclephas.kmp.nativecoroutines.compiler.classic.utils

import com.rickclephas.kmp.nativecoroutines.compiler.utils.FqNames
import org.jetbrains.kotlin.descriptors.DeclarationDescriptor
import org.jetbrains.kotlin.descriptors.annotations.AnnotationDescriptor
import org.jetbrains.kotlin.resolve.descriptorUtil.annotationClass

internal val DeclarationDescriptor.isRefined: Boolean
    get() = annotations.any { annotation ->
        !annotation.isNativeCoroutinesAnnotation && annotation.isRefinementAnnotation
    } || (containingDeclaration?.isHiddenFromObjC ?: false)

private val DeclarationDescriptor.isHiddenFromObjC: Boolean
    get() = annotations.any { annotation ->
        annotation.isHiddenFromObjCAnnotation
    } || (containingDeclaration?.isHiddenFromObjC ?: false)

@Suppress("UnstableApiUsage")
private val AnnotationDescriptor.isRefinementAnnotation: Boolean
    get() = annotationClass?.annotations?.any { metaAnnotation ->
        val fqName = metaAnnotation.fqName
        fqName == FqNames.hidesFromObjC || fqName == FqNames.refinesInSwift
    } ?: false

private val AnnotationDescriptor.isHiddenFromObjCAnnotation: Boolean
    get() = annotationClass?.annotations?.any { metaAnnotation ->
        metaAnnotation.fqName == FqNames.hidesFromObjC
    } ?: false

```

### Core Architecture Module: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/codegen/StateFlowValue.kt`
```
package com.rickclephas.kmp.nativecoroutines.compiler.fir.codegen

import com.rickclephas.kmp.nativecoroutines.compiler.config.SwiftExport
import com.rickclephas.kmp.nativecoroutines.compiler.fir.utils.*
import com.rickclephas.kmp.nativecoroutines.compiler.utils.CallableSignature
import com.rickclephas.kmp.nativecoroutines.compiler.utils.ClassIds
import com.rickclephas.kmp.nativecoroutines.compiler.utils.NativeCoroutinesAnnotation
import com.rickclephas.kmp.nativecoroutines.compiler.utils.shouldRefineInSwift
import org.jetbrains.kotlin.KtFakeSourceElementKind
import org.jetbrains.kotlin.fakeElement
import org.jetbrains.kotlin.fir.declarations.FirPropertyBodyResolveState
import org.jetbrains.kotlin.fir.declarations.FirResolvePhase
import org.jetbrains.kotlin.fir.declarations.builder.buildProperty
import org.jetbrains.kotlin.fir.declarations.origin
import org.jetbrains.kotlin.fir.extensions.FirExtension
import org.jetbrains.kotlin.fir.moduleData
import org.jetbrains.kotlin.fir.symbols.SymbolInternals
import org.jetbrains.kotlin.fir.symbols.impl.FirPropertySymbol
import org.jetbrains.kotlin.fir.symbols.impl.FirRegularPropertySymbol
import org.jetbrains.kotlin.fir.toFirResolvedTypeRef
import org.jetbrains.kotlin.fir.types.*
import org.jetbrains.kotlin.name.CallableId
import org.jetbrains.kotlin.utils.addToStdlib.applyIf

internal fun FirExtension.buildStateFlowValueProperty(
    callableId: CallableId,
    originalSymbol: FirPropertySymbol,
    annotation: NativeCoroutinesAnnotation,
    objCName: String? = null,
    objCNameSuffix: String? = null,
    swiftExport: Set<SwiftExport>,
): FirPropertySymbol? {
    val firCallableSignature = originalSymbol.getCallableSignature(session) ?: return null
    val callableSignature = firCallableSignature.signature
    if (callableSignature.isSuspend) return null
    if (callableSignature.returnType !is CallableSignature.Type.Flow.State) return null
    return buildProperty {
        resolvePhase = FirResolvePhase.BODY_RESOLVE
        moduleData = session.moduleData
        origin = NativeCoroutinesDeclarationKey(
            NativeCoroutinesDeclarationKey.Type.STATE_FLOW_VALUE,
            callableSignature
        ).origin

        source = originalSymbol.source?.fakeElement(KtFakeSourceElementKind.PluginGenerated.Default)

        symbol = FirRegularPropertySymbol(callableId)
        name = callableId.callableName

        status = originalSymbol.getGeneratedDeclarationStatus(session) ?: return null
        isLocal = originalSymbol.isLocal

        dispatchReceiverType = originalSymbol.dispatchReceiverType

        val typeParameters = buildTypeParametersCopy(
            originalSymbol.typeParameterSymbols,
            symbol,
            origin
        )
        this.typeParameters.addAll(typeParameters.parameters)

        // TODO: support contextReceivers once exported to ObjC

        receiverParameter = buildReceiverParameterCopy(
            originalSymbol.receiverParameterSymbol,
            symbol,
            origin,
            typeParameters.substitutor
        )

        returnTypeRef = firCallableSignature.getNativeType(callableSignature.returnType.valueType, swiftExport)
            .applyIf(callableSignature.returnType.isNullable) {
                withNullability(true, session.typeContext)
            }
            .let(typeParameters.substitutor::substituteOrSelf)
            .toFirResolvedTypeRef()

        isVar = callableSignature.returnType.isMutable
        getter = buildPropertyGetter(this, originalSymbol, typeParameters.substitutor)
        if (isVar) {
            setter = buildPropertySetter(this, originalSymbol)
        }

        bodyResolveState = FirPropertyBodyResolveState.ALL_BODIES_RESOLVED

        @OptIn(SymbolInternals::class)
        deprecationsProvider = originalSymbol.fir.deprecationsProvider

        annotations.addAll(buildAnnotationsCopy(originalSymbol.resolvedAnnotationsWithClassIds, objCName, objCNameSuffix))
        if (annotation.shouldRefineInSwift) {
            annotations.add(buildAnnotation(ClassIds.shouldRefineInSwift))
        }
    }.symbol
}

```

### Core Architecture Module: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/utils/CoroutinesReturnType.kt`
```
package com.rickclephas.kmp.nativecoroutines.compiler.fir.utils

import com.rickclephas.kmp.nativecoroutines.compiler.utils.ClassIds
import com.rickclephas.kmp.nativecoroutines.compiler.utils.CoroutinesReturnType
import org.jetbrains.kotlin.fir.FirSession
import org.jetbrains.kotlin.fir.analysis.checkers.toClassLikeSymbol
import org.jetbrains.kotlin.fir.declarations.FirCallableDeclaration
import org.jetbrains.kotlin.fir.declarations.fullyExpandedClass
import org.jetbrains.kotlin.fir.resolve.isSubclassOf
import org.jetbrains.kotlin.fir.types.toLookupTag

internal fun FirCallableDeclaration.getCoroutinesReturnType(session: FirSession): CoroutinesReturnType? {
    val symbol = returnTypeRef.toClassLikeSymbol(session)?.fullyExpandedClass(session) ?: return null
    return coroutinesReturnTypes.firstNotNullOfOrNull { (lookupTag, returnType) ->
        returnType.takeIf { symbol.isSubclassOf(lookupTag, session, isStrict = false, lookupInterfaces = true) }
    }
}

private val coroutinesReturnTypes = mapOf(
    ClassIds.stateFlow.toLookupTag() to CoroutinesReturnType.Flow.State,
    ClassIds.flow.toLookupTag() to CoroutinesReturnType.Flow.Generic,
    ClassIds.coroutineScope.toLookupTag() to CoroutinesReturnType.CoroutineScope,
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #261** (2026-08-17): **Use generated source dir relative path instead the absolute one.**
  *Symptoms*: Make the plugin not break the reusability of remote gradle cache. Absolute paths are different on different machines, that breaks the reusability of remote cache and must be avoided if we want to have a truly fast gradle builds.  https://github.com/rickclephas/KMP-NativeCoroutines/issues/260
  **Post-Mortem & Fix Analysis**:
  > @rickclephas can you please take a look?

- **Issue #260** (2026-09-07): **`generatedSourceDir` compiler plugin option uses an absolute path, breaking build cache relocatability**
  *Symptoms*: The Gradle plugin passes the `generatedSourceDir` option to the Kotlin compiler plugin as an **absolute path** via a plain string `SubpluginOption`:  ```kotlin // KmpNativeCoroutinesPlugin.kt extension.generatedSourceDirs.map { project.file(it).absolutePath }     .distinct().forEach {         add(SubpluginOption("generatedSourceDir", it))     } ```  The Kotlin Gradle Plugin includes the full compiler plugin command line as an `@Input` value in the build cache key of every `KotlinNativeCompile` task. Because the option value contains the absolute project path, the cache key changes whenever the project is checked out at a different filesystem location. As a result, **no Kotlin/Native compile task in a module applying this plugin can ever get a relocated build cache hit** — e.g. CI-seeded remote cache entries are unusable on developer machines, and any two checkouts at different paths (worktrees, differently-named CI workspaces) miss each other's cache.
  **Post-Mortem & Fix Analysis**:
  > FYI fix is available in [v1.0.6](https://github.com/rickclephas/KMP-NativeCoroutines/releases/tag/v1.0.6).

- **Issue #259** (2026-09-07): **Kotlin 2.4.20**
  *Symptoms*: 

- **Issue #258** (2026-07-15): **Kotlin 2.4.10**
  *Symptoms*: 

- **Issue #257** (2026-06-28): **Gradle 9.6**
  *Symptoms*: 

- **Issue #256** (2026-06-07): **Adds support for WasmWasi**
  *Symptoms*: Simply adds WasmWasi target to allow kmp project supporting WasmWasi to build. No other changes are required other than adding target support
  **Post-Mortem & Fix Analysis**:
  > Thanks @carlonzo!

- **Issue #255** (2026-05-10): **Kotlin 2.3.21**
  *Symptoms*: 

- **Issue #254** (2026-04-06): **CocoaPods could not find compatible versions for pod "KMPNativeCoroutinesAsync"**
  *Symptoms*: ``` ➜  ios git:(master) ✗ pod install --repo-update Updating local specs repositories Analyzing dependencies [!] CocoaPods could not find compatible versions for pod "KMPNativeCoroutinesAsync":   In Podfile:     KMPNativeCoroutinesAsync (= 1.0.2)  None of your spec sources contain a spec satisfying the dependency: `KMPNativeCoroutinesAsync (= 1.0.2)`.  You have either:  * mistyped the name or version.  * not added the source repo that hosts the Podspec to your Podfile. ```  Has anything changed between 1.0.1 to 1.0.2?
  **Post-Mortem & Fix Analysis**:
  > Hey! Sorry about that, forgot to mention it in the release notes 😅. CocoaPods releases have been having issues for some time, so I decided to stop publishing them. You can use the tag reference instead, e.g.: ```ruby pod 'KMPNativeCoroutinesAsync', git: 'https://github.com/rickclephas/KMP-NativeCoroutines.git', tag: 'v1.0.2'  ```
  > Ah okay, so for anyone else you need to do:  ```ruby  pod 'KMPNativeCoroutinesCore', git: 'https://github.com/rickclephas/KMP-NativeCoroutines.git', tag: 'v1.0.2' pod 'KMPNativeCoroutinesAsync', git: 'https://github.com/rickclephas/KMP-NativeCoroutines.git', tag: 'v1.0.2' pod 'KMPNativeCoroutinesCombine', git: 'https://github.com/rickclephas/KMP-NativeCoroutines.git', tag: 'v1.0.2' ```  Thanks @rickclephas!

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

### Incident Patch 1: `4101e573` (2026-07-28)
**Commit Message**: Add Kotlin version suffix

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -7,5 +7,5 @@ buildscript {
 
 allprojects {
     group = "com.rickclephas.kmp"
-    version = "1.0.5"
+    version = "1.0.5-kotlin-2.4.20-Beta2"
 }
```

---

### Incident Patch 2: `8352a664` (2026-07-26)
**Commit Message**: Fix type substitution in FIR and IR

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/codegen/CallableReferenceBlock.kt` (modified, +4/-2)
```diff
@@ -7,6 +7,7 @@ import org.jetbrains.kotlin.fir.expressions.FirBlock
 import org.jetbrains.kotlin.fir.expressions.builder.buildBlock
 import org.jetbrains.kotlin.fir.expressions.builder.buildCallableReferenceAccess
 import org.jetbrains.kotlin.fir.references.builder.buildResolvedNamedReference
+import org.jetbrains.kotlin.fir.resolve.substitution.ConeSubstitutor
 import org.jetbrains.kotlin.fir.symbols.impl.FirCallableSymbol
 import org.jetbrains.kotlin.fir.symbols.impl.FirNamedFunctionSymbol
 import org.jetbrains.kotlin.fir.symbols.impl.FirPropertySymbol
@@ -15,11 +16,12 @@ import org.jetbrains.kotlin.name.StandardClassIds
 import org.jetbrains.kotlin.utils.addIfNotNull
 
 internal fun FirSession.buildCallableReferenceBlock(
-    symbol: FirCallableSymbol<*>
+    symbol: FirCallableSymbol<*>,
+    substitutor: ConeSubstitutor,
 ): FirBlock = buildBlock {
     coneTypeOrNull = StandardClassIds.Nothing.constructClassLikeType()
     statements += buildCallableReferenceAccess {
-        coneTypeOrNull = symbol.getReferenceConeType()
+        coneTypeOrNull = substitutor.substituteOrSelf(symbol.getReferenceConeType())
         calleeReference = buildResolvedNamedReference {
             name = symbol.name
             resolvedSymbol = symbol
```

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/codegen/NativeFunction.kt` (modified, +1/-1)
```diff
@@ -92,6 +92,6 @@ internal fun FirExtension.buildNativeFunction(
             annotations.add(buildThrowsAnnotation(ClassIds.exception))
         }
 
-        body = session.buildCallableReferenceBlock(originalSymbol)
+        body = session.buildCallableReferenceBlock(originalSymbol, typeParameters.substitutor)
     }.symbol
 }
```

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/codegen/NativeProperty.kt` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ internal fun FirExtension.buildNativeProperty(
             .toFirResolvedTypeRef()
 
         isVar = false
-        getter = buildPropertyGetter(this, originalSymbol)
+        getter = buildPropertyGetter(this, originalSymbol, typeParameters.substitutor)
 
         bodyResolveState = FirPropertyBodyResolveState.ALL_BODIES_RESOLVED
 
```

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/codegen/PropertyAccessor.kt` (modified, +3/-1)
```diff
@@ -6,6 +6,7 @@ import org.jetbrains.kotlin.fir.declarations.builder.FirPropertyBuilder
 import org.jetbrains.kotlin.fir.declarations.builder.buildDefaultSetterValueParameter
 import org.jetbrains.kotlin.fir.declarations.builder.buildPropertyAccessor
 import org.jetbrains.kotlin.fir.extensions.FirExtension
+import org.jetbrains.kotlin.fir.resolve.substitution.ConeSubstitutor
 import org.jetbrains.kotlin.fir.symbols.impl.FirPropertyAccessorSymbol
 import org.jetbrains.kotlin.fir.symbols.impl.FirPropertySymbol
 import org.jetbrains.kotlin.fir.symbols.impl.FirValueParameterSymbol
@@ -14,6 +15,7 @@ import org.jetbrains.kotlin.fir.types.impl.FirImplicitUnitTypeRef
 internal fun FirExtension.buildPropertyGetter(
     propertyBuilder: FirPropertyBuilder,
     originalSymbol: FirPropertySymbol,
+    substitutor: ConeSubstitutor,
 ): FirPropertyAccessor = buildPropertyAccessor {
     val originalGetter = originalSymbol.getterSymbol
     require(originalGetter != null)
@@ -26,7 +28,7 @@ internal fun FirExtension.buildPropertyGetter(
     propertySymbol = propertyBuilder.symbol
     isGetter = true
     annotations.addAll(buildAnnotationsCopy(originalGetter.resolvedAnnotationsWithClassIds))
-    body = session.buildCallableReferenceBlock(originalSymbol)
+    body = session.buildCallableReferenceBlock(originalSymbol, substitutor)
 }
 
 internal fun FirExtension.buildPropertySetter(
```

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/codegen/SharedFlowReplayCache.kt` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ internal fun FirExtension.buildSharedFlowReplayCacheProperty(
         ).let(typeParameters.substitutor::substituteOrSelf).toFirResolvedTypeRef()
 
         isVar = false
-        getter = buildPropertyGetter(this, originalSymbol)
+        getter = buildPropertyGetter(this, originalSymbol, typeParameters.substitutor)
 
         bodyResolveState = FirPropertyBodyResolveState.ALL_BODIES_RESOLVED
 
```

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/codegen/StateFlowValue.kt` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ internal fun FirExtension.buildStateFlowValueProperty(
             .toFirResolvedTypeRef()
 
         isVar = callableSignature.returnType.isMutable
-        getter = buildPropertyGetter(this, originalSymbol)
+        getter = buildPropertyGetter(this, originalSymbol, typeParameters.substitutor)
         if (isVar) {
             setter = buildPropertySetter(this, originalSymbol)
         }
```

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/ir/codegen/OriginalFunction.kt` (modified, +11/-5)
```diff
@@ -4,16 +4,22 @@ import com.rickclephas.kmp.nativecoroutines.compiler.ir.utils.IrBlockBodyExpress
 import org.jetbrains.kotlin.ir.builders.irCall
 import org.jetbrains.kotlin.ir.builders.irGet
 import org.jetbrains.kotlin.ir.declarations.IrSimpleFunction
+import org.jetbrains.kotlin.ir.types.defaultType
 import org.jetbrains.kotlin.ir.util.passTypeArgumentsFrom
+import org.jetbrains.kotlin.ir.util.substitute
 
 internal fun irCallOriginalFunction(
     originalFunction: IrSimpleFunction,
     function: IrSimpleFunction
-) = IrBlockBodyExpression(originalFunction.returnType) {
-    irCall(originalFunction).apply {
-        passTypeArgumentsFrom(function)
-        function.parameters.forEachIndexed { index, parameter ->
-            arguments[index] = irGet(parameter)
+): IrBlockBodyExpression {
+    val typeArgs = function.typeParameters.map { it.defaultType }
+    val returnType = originalFunction.returnType.substitute(originalFunction.typeParameters, typeArgs)
+    return IrBlockBodyExpression(returnType) {
+        irCall(originalFunction.symbol, returnType).apply {
+            passTypeArgumentsFrom(function)
+            function.parameters.forEachIndexed { index, parameter ->
+                arguments[index] = irGet(parameter)
+            }
         }
     }
 }
```

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/ir/codegen/OriginalProperty.kt` (modified, +11/-5)
```diff
@@ -5,16 +5,22 @@ import org.jetbrains.kotlin.ir.builders.irCall
 import org.jetbrains.kotlin.ir.builders.irGet
 import org.jetbrains.kotlin.ir.declarations.IrParameterKind
 import org.jetbrains.kotlin.ir.declarations.IrSimpleFunction
+import org.jetbrains.kotlin.ir.types.defaultType
 import org.jetbrains.kotlin.ir.util.passTypeArgumentsFrom
+import org.jetbrains.kotlin.ir.util.substitute
 
 internal fun irCallOriginalPropertyGetter(
     originalGetter: IrSimpleFunction,
     propertyFunction: IrSimpleFunction
-): IrBlockBodyExpression = IrBlockBodyExpression(originalGetter.returnType) {
-    irCall(originalGetter).apply {
-        propertyFunction.parameters.filter { it.kind != IrParameterKind.Regular }.forEachIndexed { index, parameter ->
-            arguments[index] = irGet(parameter)
+): IrBlockBodyExpression {
+    val typeArgs = propertyFunction.typeParameters.map { it.defaultType }
+    val returnType = originalGetter.returnType.substitute(originalGetter.typeParameters, typeArgs)
+    return IrBlockBodyExpression(returnType) {
+        irCall(originalGetter.symbol, returnType).apply {
+            propertyFunction.parameters.filter { it.kind != IrParameterKind.Regular }.forEachIndexed { index, parameter ->
+                arguments[index] = irGet(parameter)
+            }
+            passTypeArgumentsFrom(propertyFunction)
         }
-        passTypeArgumentsFrom(propertyFunction)
     }
 }
```

---

### Incident Patch 3: `ef230dbd` (2026-06-28)
**Commit Message**: Fix ABI validation issues

**File**: `.github/workflows/run-idea-tests.yaml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ jobs:
       - name: Verify plugin structure
         run: ./gradlew :kmp-nativecoroutines-idea-plugin:verifyPluginStructure
       - name: Run binary compatibility validator
-        run: ./gradlew :kmp-nativecoroutines-idea-plugin:apiCheck
+        run: ./gradlew :kmp-nativecoroutines-idea-plugin:checkKotlinAbi
   run-idea-tests:
     needs:
       - run-common-idea-tests
```

**File**: `kmp-nativecoroutines-gradle-plugin/api/kmp-nativecoroutines-gradle-plugin.api` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ public class com/rickclephas/kmp/nativecoroutines/gradle/KmpNativeCoroutinesExte
 }
 
 public final class com/rickclephas/kmp/nativecoroutines/gradle/KmpNativeCoroutinesPlugin : org/jetbrains/kotlin/gradle/plugin/KotlinCompilerPluginSupportPlugin {
-	public static final field KOTLIN_PLUGIN_ID Ljava/lang/String;
 	public fun <init> ()V
 	public synthetic fun apply (Ljava/lang/Object;)V
 	public fun apply (Lorg/gradle/api/Project;)V
```

---

### Incident Patch 4: `32f165e3` (2026-05-19)
**Commit Message**: Update Kotlin version suffix

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ buildscript {
 
 allprojects {
     group = "com.rickclephas.kmp"
-    version = "1.0.3-kotlin-2.4.0-Beta2"
+    version = "1.0.3-kotlin-2.4.0-RC"
 }
 
 apiValidation {
```

---

### Incident Patch 5: `96df5f06` (2026-03-28)
**Commit Message**: Explicitly set `customNativeHome` to `null` in `BaseNativeEnvironmentConfigurator`

https://github.com/JetBrains/kotlin/commit/89b957b02d45e1bdfb6915f54994b56e24c64d56

**File**: `kmp-nativecoroutines-compiler/src/test/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/runners/AbstractBaseDiagnosticsTest.kt` (modified, +1/-1)
```diff
@@ -53,4 +53,4 @@ abstract class AbstractBaseDiagnosticsTest<R : ResultingArtifact.FrontendOutput<
 // Using NativeFirstStageEnvironmentConfigurator causes issues with the incompatible.kt tests
 private class BaseNativeEnvironmentConfigurator(
     testServices: TestServices
-): NativeEnvironmentConfigurator(testServices)
+): NativeEnvironmentConfigurator(testServices, null)
```

---

### Incident Patch 6: `6807b8f9` (2026-03-21)
**Commit Message**: Remove deprecationsProvider from buildValueParametersCopy

https://github.com/JetBrains/kotlin/commit/da961008a27f597e30e0fb1c8d66d91c48fc9d6f

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/codegen/ValueParameters.kt` (modified, +0/-3)
```diff
@@ -41,9 +41,6 @@ internal fun FirExtension.buildValueParametersCopy(
             .let(substitutor::substituteOrSelf)
             .toFirResolvedTypeRef()
 
-        @OptIn(SymbolInternals::class)
-        deprecationsProvider = parameter.fir.deprecationsProvider
-
         // TODO: support defaultValue once exported to ObjC
 
         annotations.addAll(buildAnnotationsCopy(parameter.resolvedAnnotationsWithClassIds))
```

---

### Incident Patch 7: `cecab9df` (2026-05-10)
**Commit Message**: Add Kotlin version suffix

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ buildscript {
 
 allprojects {
     group = "com.rickclephas.kmp"
-    version = "1.0.3"
+    version = "1.0.3-kotlin-2.4.0-Beta2"
 }
 
 apiValidation {
```

---

### Incident Patch 8: `7326b3e9` (2026-04-12)
**Commit Message**: Set Kotlin version suffix

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ buildscript {
 
 allprojects {
     group = "com.rickclephas.kmp"
-    version = "1.0.2-idea-2026.1"
+    version = "1.0.2-kotlin-2.3.21-RC"
 }
 
 apiValidation {
```

---

### Incident Patch 9: `4aff744c` (2026-04-05)
**Commit Message**: Set Kotlin version suffix

**File**: `build.gradle.kts` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ buildscript {
 
 allprojects {
     group = "com.rickclephas.kmp"
-    version = "1.0.2-idea-2026.1"
+    version = "1.0.2-kotlin-2.4.0-Beta1"
 }
 
 apiValidation {
```

---

### Incident Patch 10: `cb6b3b15` (2026-03-28)
**Commit Message**: Explicitly set `customNativeHome` to `null` in `BaseNativeEnvironmentConfigurator`

https://github.com/JetBrains/kotlin/commit/89b957b02d45e1bdfb6915f54994b56e24c64d56

**File**: `kmp-nativecoroutines-compiler/src/test/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/runners/AbstractBaseDiagnosticsTest.kt` (modified, +1/-1)
```diff
@@ -53,4 +53,4 @@ abstract class AbstractBaseDiagnosticsTest<R : ResultingArtifact.FrontendOutput<
 // Using NativeFirstStageEnvironmentConfigurator causes issues with the incompatible.kt tests
 private class BaseNativeEnvironmentConfigurator(
     testServices: TestServices
-): NativeEnvironmentConfigurator(testServices)
+): NativeEnvironmentConfigurator(testServices, null)
```

---

### Incident Patch 11: `b826d079` (2026-03-26)
**Commit Message**: Flows with nullable elements are working now

**File**: `SWIFT_EXPORT.md` (modified, +0/-5)
```diff
@@ -33,11 +33,6 @@ For now the plugin just clones your original functions and properties to prevent
 Cancelling a `Flow` from Swift doesn't properly cancel the Flow on the Kotlin side
 ([KT-85159](https://youtrack.jetbrains.com/issue/KT-85159)).
 
-## ⚠️ `Flow` with `null` values is canceled
-
-A `Flow` that emits `null` values will be canceled at the first `null` value
-([KT-84485](https://youtrack.jetbrains.com/issue/KT-84485)).
-
 ## ⚠️ `Flow` with `Unit` values crashes
 
 A `Flow` with `Unit` values will crash with a force cast exception
```

**File**: `sample/Async/AsyncSequenceIntegrationTests.swift` (modified, +0/-3)
```diff
@@ -65,8 +65,6 @@ class AsyncSequenceIntegrationTests: XCTestCase {
         await assertJobCompleted(integrationTests)
     }
     
-    #if !NATIVE_COROUTINES_SWIFT_EXPORT
-    /// Nil values in Flow cancel the collection, see http://youtrack.jetbrains.com/issue/KT-84485
     func testNilValueReceived() async {
         let integrationTests = setup(KotlinFlowIntegrationTests.init)
         let sendValueCount = randomInt(min: 5, max: 20)
@@ -97,7 +95,6 @@ class AsyncSequenceIntegrationTests: XCTestCase {
         }
         await assertJobCompleted(integrationTests)
     }
-    #endif
     
     func testExceptionReceived() async {
         let integrationTests = setup(KotlinFlowIntegrationTests.init)
```

**File**: `sample/Combine/CombinePublisherIntegrationTests.swift` (modified, +0/-3)
```diff
@@ -74,8 +74,6 @@ class CombinePublisherIntegrationTests: XCTestCase {
         await assertJobCompleted(integrationTests)
     }
     
-    #if !NATIVE_COROUTINES_SWIFT_EXPORT
-    /// Nil values in Flow cancel the collection, see http://youtrack.jetbrains.com/issue/KT-84485
     func testNilValueReceived() {
         let integrationTests = setup(KotlinFlowIntegrationTests.init)
         let sendValueCount = randomInt(min: 5, max: 20)
@@ -114,7 +112,6 @@ class CombinePublisherIntegrationTests: XCTestCase {
         delay(1) // Delay is needed else the job isn't completed yet
         XCTAssertEqual(integrationTests.uncompletedJobCount, 0, "The job should have completed by now")
     }
-    #endif
     
     func testExceptionReceived() {
         let integrationTests = setup(KotlinFlowIntegrationTests.init)
```

**File**: `sample/RxSwift/RxSwiftObservableIntegrationTests.swift` (modified, +0/-3)
```diff
@@ -51,8 +51,6 @@ class RxSwiftObservableIntegrationTests: XCTestCase {
         XCTAssertEqual(integrationTests.uncompletedJobCount, 0, "The job should have completed by now")
     }
     
-    #if !NATIVE_COROUTINES_SWIFT_EXPORT
-    /// Nil values in Flow cancel the collection, see http://youtrack.jetbrains.com/issue/KT-84485
     func testNilValueReceived() {
         let integrationTests = setup(KotlinFlowIntegrationTests.init)
         let sendValueCount = randomInt(min: 5, max: 20)
@@ -93,7 +91,6 @@ class RxSwiftObservableIntegrationTests: XCTestCase {
         delay(1) // Delay is needed else the job isn't completed yet
         XCTAssertEqual(integrationTests.uncompletedJobCount, 0, "The job should have completed by now")
     }
-    #endif
     
     func testExceptionReceived() {
         let integrationTests = setup(KotlinFlowIntegrationTests.init)
```

---

### Incident Patch 12: `af8ce5ab` (2026-03-21)
**Commit Message**: Remove deprecationsProvider from buildValueParametersCopy

https://github.com/JetBrains/kotlin/commit/da961008a27f597e30e0fb1c8d66d91c48fc9d6f

**File**: `kmp-nativecoroutines-compiler/src/main/kotlin/com/rickclephas/kmp/nativecoroutines/compiler/fir/codegen/ValueParameters.kt` (modified, +0/-3)
```diff
@@ -41,9 +41,6 @@ internal fun FirExtension.buildValueParametersCopy(
             .let(substitutor::substituteOrSelf)
             .toFirResolvedTypeRef()
 
-        @OptIn(SymbolInternals::class)
-        deprecationsProvider = parameter.fir.deprecationsProvider
-
         // TODO: support defaultValue once exported to ObjC
 
         annotations.addAll(buildAnnotationsCopy(parameter.resolvedAnnotationsWithClassIds))
```

---

### Incident Patch 13: `493ed282` (2026-03-19)
**Commit Message**: Remove Native name suffix (ObjCName is now supported)

**File**: `sample/Async/AsyncFunctionIntegrationTests.swift` (modified, +5/-21)
```diff
@@ -17,23 +17,18 @@ class AsyncFunctionIntegrationTests: XCTestCase {
     func testValueReceived() async throws {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendValue = randomInt()
+        let value = try await asyncFunction(for: integrationTests.returnValue(value: sendValue, delay: 1000))
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let value = try await asyncFunction(for: integrationTests.returnValueNative(value: sendValue, delay: 1000))
         XCTAssertEqual(value, sendValue, "Received incorrect value")
         #else
-        let value = try await asyncFunction(for: integrationTests.returnValue(value: sendValue, delay: 1000))
         XCTAssertEqual(value.int32Value, sendValue, "Received incorrect value")
         #endif
         await assertJobCompleted(integrationTests)
     }
     
     func testNilValueReceived() async throws {
         let integrationTests = KotlinSuspendIntegrationTests()
-        #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let value = try await asyncFunction(for: integrationTests.returnNullNative(delay: 1000))
-        #else
         let value = try await asyncFunction(for: integrationTests.returnNull(delay: 1000))
-        #endif
         XCTAssertNil(value, "Value should be nil")
         await assertJobCompleted(integrationTests)
     }
@@ -42,11 +37,7 @@ class AsyncFunctionIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendMessage = randomString()
         do {
-            #if NATIVE_COROUTINES_SWIFT_EXPORT
-            _ = try await asyncFunction(for: integrationTests.throwExceptionNative(message: sendMessage, delay: 1000))
-            #else
             _ = try await asyncFunction(for: integrationTests.throwException(message: sendMessage, delay: 1000))
-            #endif
             XCTFail("Function should complete with an error")
         } catch {
             #if NATIVE_COROUTINES_SWIFT_EXPORT
@@ -70,11 +61,7 @@ class AsyncFunctionIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendMessage = randomString()
         do {
-            #if NATIVE_COROUTINES_SWIFT_EXPORT
-            _ = try await asyncFunction(for: integrationTests.throwErrorNative(message: sendMessage, delay: 1000))
-            #else
             _ = try await asyncFunction(for: integrationTests.throwError(message: sendMessage, delay: 1000))
-            #endif
             XCTFail("Function should complete with an error")
         } catch {
             #if NATIVE_COROUTINES_SWIFT_EXPORT
@@ -96,17 +83,14 @@ class AsyncFunctionIntegrationTests: XCTestCase {
     func testCancellation() async {
         let integrationTests = KotlinSuspendIntegrationTests()
         let handle = Task {
-            #if NATIVE_COROUTINES_SWIFT_EXPORT
-            return try await asyncFunction(for: integrationTests.returnFromCallbackNative(delay: 3000) {
-                XCTFail("Callback shouldn't be invoked")
-                return 1
-            })
-            #else
             return try await asyncFunction(for: integrationTests.returnFromCallback(delay: 3000) {
                 XCTFail("Callback shouldn't be invoked")
+                #if NATIVE_COROUTINES_SWIFT_EXPORT
+                return 1
+                #else
                 return KotlinInt(int: 1)
+                #endif
             })
-            #endif
         }
         DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
             #if !NATIVE_COROUTINES_SWIFT_EXPORT
```

**File**: `sample/Async/AsyncResultIntegrationTests.swift` (modified, +5/-5)
```diff
@@ -18,7 +18,7 @@ class AsyncResultIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendValue = randomInt()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let result = await asyncResult(for: try await integrationTests.returnValueNative(value: sendValue, delay: 1000))
+        let result = await asyncResult(for: try await integrationTests.returnValue(value: sendValue, delay: 1000))
         #else
         let result = await asyncResult(for: integrationTests.returnValue(value: sendValue, delay: 1000))
         #endif
@@ -37,7 +37,7 @@ class AsyncResultIntegrationTests: XCTestCase {
     func testNilValueReceived() async {
         let integrationTests = KotlinSuspendIntegrationTests()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let result = await asyncResult(for: try await integrationTests.returnNullNative(delay: 1000))
+        let result = await asyncResult(for: try await integrationTests.returnNull(delay: 1000))
         #else
         let result = await asyncResult(for: integrationTests.returnNull(delay: 1000))
         #endif
@@ -53,7 +53,7 @@ class AsyncResultIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendMessage = randomString()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let result = await asyncResult(for: try await integrationTests.throwExceptionNative(message: sendMessage, delay: 1000))
+        let result = await asyncResult(for: try await integrationTests.throwException(message: sendMessage, delay: 1000))
         #else
         let result = await asyncResult(for: integrationTests.throwException(message: sendMessage, delay: 1000))
         #endif
@@ -81,7 +81,7 @@ class AsyncResultIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendMessage = randomString()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let result = await asyncResult(for: try await integrationTests.throwErrorNative(message: sendMessage, delay: 1000))
+        let result = await asyncResult(for: try await integrationTests.throwError(message: sendMessage, delay: 1000))
         #else
         let result = await asyncResult(for: integrationTests.throwError(message: sendMessage, delay: 1000))
         #endif
@@ -108,7 +108,7 @@ class AsyncResultIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let handle = Task {
             #if NATIVE_COROUTINES_SWIFT_EXPORT
-            return await asyncResult(for: try await integrationTests.returnFromCallbackNative(delay: 3000) {
+            return await asyncResult(for: try await integrationTests.returnFromCallback(delay: 3000) {
                 XCTFail("Callback shouldn't be invoked")
                 return 1
             })
```

**File**: `sample/Async/RandomLettersAsyncViewModel.swift` (modified, +0/-4)
```diff
@@ -22,11 +22,7 @@ class RandomLettersAsyncViewModel: RandomLettersViewModel {
             isLoading = true
             result = nil
             do {
-                #if NATIVE_COROUTINES_SWIFT_EXPORT
-                let letters = try await asyncFunction(for: randomLettersGenerator.getRandomLettersNative(throwException: throwException))
-                #else
                 let letters = try await asyncFunction(for: randomLettersGenerator.getRandomLetters(throwException: throwException))
-                #endif
                 result = .success(letters)
             } catch {
                 result = .failure(error)
```

**File**: `sample/Async/SwiftUIAsyncTest.swift` (modified, +0/-8)
```diff
@@ -20,23 +20,15 @@ struct SwiftUIAsyncTest: View {
         }.refreshable {
             print("Refreshable started")
             do {
-                #if NATIVE_COROUTINES_SWIFT_EXPORT
-                let result = try await asyncFunction(for: tests.returnValueNative(value: 20, delay: 10000))
-                #else
                 let result = try await asyncFunction(for: tests.returnValue(value: 20, delay: 10000))
-                #endif
                 print("Refreshable result: \(result)")
             } catch {
                 print("Refreshable error: \(error)")
             }
         }.task {
             print("Task started")
             do {
-                #if NATIVE_COROUTINES_SWIFT_EXPORT
-                let result = try await asyncFunction(for: tests.returnValueNative(value: 2, delay: 10000))
-                #else
                 let result = try await asyncFunction(for: tests.returnValue(value: 2, delay: 10000))
-                #endif
                 print("Task result: \(result)")
             } catch {
                 print("Task error: \(error)")
```

**File**: `sample/Combine/CombineFutureIntegrationTests.swift` (modified, +6/-6)
```diff
@@ -18,7 +18,7 @@ class CombineFutureIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendValue = randomInt()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let future = createFuture(for: { try await integrationTests.returnValueNative(value: sendValue, delay: 1000) })
+        let future = createFuture(for: { try await integrationTests.returnValue(value: sendValue, delay: 1000) })
         #else
         let future = createFuture(for: integrationTests.returnValue(value: sendValue, delay: 1000))
         #endif
@@ -49,7 +49,7 @@ class CombineFutureIntegrationTests: XCTestCase {
     func testNilValueReceived() {
         let integrationTests = KotlinSuspendIntegrationTests()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let future = createFuture(for: { try await integrationTests.returnNullNative(delay: 1000) })
+        let future = createFuture(for: { try await integrationTests.returnNull(delay: 1000) })
         #else
         let future = createFuture(for: integrationTests.returnNull(delay: 1000))
         #endif
@@ -77,7 +77,7 @@ class CombineFutureIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendMessage = randomString()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let future = createFuture(for: { try await integrationTests.throwExceptionNative(message: sendMessage, delay: 1000) })
+        let future = createFuture(for: { try await integrationTests.throwException(message: sendMessage, delay: 1000) })
         #else
         let future = createFuture(for: integrationTests.throwException(message: sendMessage, delay: 1000))
         #endif
@@ -118,7 +118,7 @@ class CombineFutureIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendMessage = randomString()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let future = createFuture(for: { try await integrationTests.throwErrorNative(message: sendMessage, delay: 1000) })
+        let future = createFuture(for: { try await integrationTests.throwError(message: sendMessage, delay: 1000) })
         #else
         let future = createFuture(for: integrationTests.throwError(message: sendMessage, delay: 1000))
         #endif
@@ -157,7 +157,7 @@ class CombineFutureIntegrationTests: XCTestCase {
     func testNotOnMainThread() {
         let integrationTests = KotlinSuspendIntegrationTests()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let future = createFuture(for: { try await integrationTests.returnValueNative(value: 1, delay: 1000) })
+        let future = createFuture(for: { try await integrationTests.returnValue(value: 1, delay: 1000) })
         #else
         let future = createFuture(for: integrationTests.returnValue(value: 1, delay: 1000))
         #endif
@@ -180,7 +180,7 @@ class CombineFutureIntegrationTests: XCTestCase {
         let callbackExpectation = expectation(description: "Waiting for callback not to get called")
         callbackExpectation.isInverted = true
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let future = createFuture(for: { try await integrationTests.returnFromCallbackNative(delay: 3000) {
+        let future = createFuture(for: { try await integrationTests.returnFromCallback(delay: 3000) {
             callbackExpectation.fulfill()
             return 1
         }})
```

**File**: `sample/Combine/RandomLettersCombineViewModel.swift` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ class RandomLettersCombineViewModel: RandomLettersViewModel {
         isLoading = true
         result = nil
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let future = createFuture(for: { try await self.randomLettersGenerator.getRandomLettersNative(throwException: throwException) })
+        let future = createFuture(for: { try await self.randomLettersGenerator.getRandomLetters(throwException: throwException) })
         #else
         let future = createFuture(for: randomLettersGenerator.getRandomLetters(throwException: throwException))
         #endif
```

**File**: `sample/RxSwift/RandomLettersRxSwiftViewModel.swift` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ class RandomLettersRxSwiftViewModel: RandomLettersViewModel {
         isLoading = true
         result = nil
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let single = createSingle(for: { try await self.randomLettersGenerator.getRandomLettersNative(throwException: throwException) })
+        let single = createSingle(for: { try await self.randomLettersGenerator.getRandomLetters(throwException: throwException) })
         #else
         let single = createSingle(for: randomLettersGenerator.getRandomLetters(throwException: throwException))
         #endif
```

**File**: `sample/RxSwift/RxSwiftSingleIntegrationTests.swift` (modified, +6/-6)
```diff
@@ -18,7 +18,7 @@ class RxSwiftSingleIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendValue = randomInt()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let single = createSingle(for: { try await integrationTests.returnValueNative(value: sendValue, delay: 1000) })
+        let single = createSingle(for: { try await integrationTests.returnValue(value: sendValue, delay: 1000) })
         #else
         let single = createSingle(for: integrationTests.returnValue(value: sendValue, delay: 1000))
         #endif
@@ -48,7 +48,7 @@ class RxSwiftSingleIntegrationTests: XCTestCase {
     func testNilValueReceived() {
         let integrationTests = KotlinSuspendIntegrationTests()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let single = createSingle(for: { try await integrationTests.returnNullNative(delay: 1000) })
+        let single = createSingle(for: { try await integrationTests.returnNull(delay: 1000) })
         #else
         let single = createSingle(for: integrationTests.returnNull(delay: 1000))
         #endif
@@ -75,7 +75,7 @@ class RxSwiftSingleIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendMessage = randomString()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let single = createSingle(for: { try await integrationTests.throwExceptionNative(message: sendMessage, delay: 1000) })
+        let single = createSingle(for: { try await integrationTests.throwException(message: sendMessage, delay: 1000) })
         #else
         let single = createSingle(for: integrationTests.throwException(message: sendMessage, delay: 1000))
         #endif
@@ -115,7 +115,7 @@ class RxSwiftSingleIntegrationTests: XCTestCase {
         let integrationTests = KotlinSuspendIntegrationTests()
         let sendMessage = randomString()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let single = createSingle(for: { try await integrationTests.throwErrorNative(message: sendMessage, delay: 1000) })
+        let single = createSingle(for: { try await integrationTests.throwError(message: sendMessage, delay: 1000) })
         #else
         let single = createSingle(for: integrationTests.throwError(message: sendMessage, delay: 1000))
         #endif
@@ -153,7 +153,7 @@ class RxSwiftSingleIntegrationTests: XCTestCase {
     func testNotOnMainThread() {
         let integrationTests = KotlinSuspendIntegrationTests()
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let single = createSingle(for: { try await integrationTests.returnValueNative(value: 1, delay: 1000) })
+        let single = createSingle(for: { try await integrationTests.returnValue(value: 1, delay: 1000) })
         #else
         let single = createSingle(for: integrationTests.returnValue(value: 1, delay: 1000))
         #endif
@@ -176,7 +176,7 @@ class RxSwiftSingleIntegrationTests: XCTestCase {
         let callbackExpectation = expectation(description: "Waiting for callback not to get called")
         callbackExpectation.isInverted = true
         #if NATIVE_COROUTINES_SWIFT_EXPORT
-        let single = createSingle(for: { try await integrationTests.returnFromCallbackNative(delay: 3000) {
+        let single = createSingle(for: { try await integrationTests.returnFromCallback(delay: 3000) {
             callbackExpectation.fulfill()
             return 1
         }})
```

#### Recent Merged Pull Requests:
- **PR #261** (2026-08-17): Use generated source dir relative path instead the absolute one. (@Link184)
- **PR #259** (2026-09-07): Kotlin 2.4.20 (@rickclephas)
- **PR #258** (2026-07-15): Kotlin 2.4.10 (@rickclephas)
- **PR #257** (2026-06-28): Gradle 9.6 (@rickclephas)
- **PR #256** (2026-06-07): Adds support for WasmWasi (@carlonzo)
- **PR #255** (2026-05-10): Kotlin 2.3.21 (@rickclephas)
- **PR #252** (2026-06-07): Swift export 2.4.0 (@rickclephas)
- **PR #251** (2026-06-07): Kotlin 2.4.0 (@rickclephas)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
