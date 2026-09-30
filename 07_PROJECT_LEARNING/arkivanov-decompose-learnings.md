# Forensic Learning Record (Deep Inspection): arkivanov/Decompose

> **Canonical Artifact**: `07_PROJECT_LEARNING/arkivanov-decompose-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arkivanov/Decompose](https://github.com/arkivanov/Decompose))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:34:58.628Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arkivanov/Decompose`
- **Description**: Kotlin Multiplatform lifecycle-aware business logic components (aka BLoCs) with routing (navigation) and pluggable UI (Jetpack Compose, SwiftUI, JS React, etc.)
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2878 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `sample/app-js-compose/webpack.config.d/devServerConfig.js`
```
config.devServer = {
  ...config.devServer, // Merge with other devServer settings
  "historyApiFallback": true
};

```

### Core Architecture Module: `sample/app-js/webpack.config.d/devServerConfig.js`
```
config.devServer = {
  ...config.devServer, // Merge with other devServer settings
  "historyApiFallback": true
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1012** (2026-09-26): **Rare crash "Cannot round NaN value" in SeekableTransitionState when predictive back gesture finishes**
  *Symptoms*: We're seeing a rare production crash (4 events / 3 users over ~2 months, so far only Huawei/Honor devices: PTP-N49, PTP-AN00, BRP-NX3) when a predictive back gesture completes on a `ChildStack` using the experimental `stackAnimation` with a custom `PredictiveBackAnimatable`:  ``` java.lang.IllegalArgumentException: Cannot round NaN value.     at kotlin.math.MathKt__MathJVMKt.roundToLong(MathJVM.kt:741)     at androidx.compose.animation.core.SeekableTransitionState.seekToFraction(Transition.kt:733)     at androidx.compose.animation.core.SeekableTransitionState.animateOneFrameLambda$lambda$0(Transition.kt:325)     at androidx.compose.runtime.BroadcastFrameClock$FrameAwaiter.resume(BroadcastFrameClock.kt:56)     at androidx.compose.runtime.BroadcastFrameClock.sendFrame$lambda$0(BroadcastFrameClock.java:71)     at androidx.compose.runtime.AwaiterQueue.flushAndDispatchAwaiters(AwaiterQueue.kt:89)     at androidx.compose.runtime.BroadcastFrameClock.sendFrame(BroadcastFrameClock.java:71)     at androidx.compose.runtime.Recomposer$runRecomposeAndApplyChanges$2$2.invokeSuspend$lambda$2(Recomposer.kt:633)     ... ```  ## Versions  - Decompose: 3.5.0 (`extensions-compose-experimental`) - Compose BOM 2026.06.01 (animation-core 1.11.4) - Setup: `stackAnimation(predictiveBackParams = { PredictiveBackParams(backHandler, onBack, animatable = { materialPredictiveBackAnimatable(it) /* custom fork */ }) })`  ## Analysis  It looks like a Compose bug, I've reported it [here](https://issuetracker.
  **Post-Mortem & Fix Analysis**:
  > Thank you. I will take a look.
  > > Decompose could avoid triggering it  @PhilipDukhov could you please elaborate? How can Decompose help avoid the crash? Can you point to line of code?
  > @arkivanov-bot please investigate this issue, try to reproduce and fix the crash.

- **Issue #986** (2026-03-03): **Crash when calculate keyHashString**
  *Symptoms*: We have a single crash in function Utils. keyHashString() There is stacktrace:  ``` Fatal Exception: java.lang.ArrayIndexOutOfBoundsException length=36; index=16777238  java.lang.Integer.toString (Integer.java:177) com.arkivanov.decompose.UtilsKt.keyHashString (Utils.kt:12) com.arkivanov.decompose.extensions.compose.stack.ChildrenKt.getKeys (Children.kt:57) com.arkivanov.decompose.extensions.compose.stack.ChildrenKt.Children (Children.kt:27) com.arkivanov.decompose.extensions.compose.stack.ChildrenKt.Children$lambda$0 (Children.kt:13) androidx.compose.runtime.RecomposeScopeImpl.compose (RecomposeScopeImpl.kt:201) androidx.compose.runtime.ComposerImpl.recomposeToGroupEnd (ComposerImpl.kt:1690) androidx.compose.runtime.ComposerImpl.skipCurrentGroup (ComposerImpl.kt:2026) androidx.compose.runtime.ComposerImpl.doCompose-aFTiNEg (ComposerImpl.kt:2659) androidx.compose.runtime.ComposerImpl.recompose-aFTiNEg$runtime (ComposerImpl.kt:2583) androidx.compose.runtime.CompositionImpl.recompose (Composition.kt:1080) androidx.compose.runtime.Recomposer.performRecompose (Recomposer.kt:1406) androidx.compose.runtime.Recomposer.access$setWorkContinuation$p (Recomposer.kt:159) androidx.compose.runtime.Recomposer.access$performRecompose (Recomposer.kt:159) androidx.compose.runtime.Recomposer$runRecomposeAndApplyChanges$2.invokeSuspend$lambda$2 (Recomposer.kt:638) androidx.compose.ui.platform.AndroidUiFrameClock$withFrameNanos$2$callback$1.doFrame (AndroidUiFrameClock.android.kt:39) androidx.com
  **Post-Mortem & Fix Analysis**:
  > @maxmaxandr Thanks for the report. What version of Decompose are you using?
  > > [@maxmaxandr](https://github.com/maxmaxandr) Thanks for the report. What version of Decompose are you using?  3.3.0
  > Thank you! This looks like a bug in a certain version of JVM/Android. I think the crash shouldn't be reproducible starting with Decompose version `3.4.0`.

- **Issue #982** (2026-02-01): **webHistory: URL is not updated when Details initialStack contains more than one element**
  *Symptoms*: Hi! I’ve encountered an issue with webHistory when using a Details stack with more than one element in initialStack.  This seems to affect URL synchronization and browser back navigation.  Setup Decompose: 3.4.0 Layout structure: 	•	Main: Apps 	•	Details: ReleaseList, Release  The Details panel is initialized with two elements in the initialStack (ReleaseList, Release). This setup is required for correct gesture navigation in a PWA.  Problem 1: URL is not updated  When navigating directly to Release via a link: 	•	In Dual mode, selecting another item in Main triggers correct internal navigation 	•	However, the browser URL does not change  Problem 2: Browser back navigation does not work as expected  As I understand it, the logic with setOnPopStateListener exists to support browser back navigation. However, in this scenario, pressing the browser back button: 	•	Does not navigate back within the app stack 	•	Instead, navigates back to the previous site  So in this case, browser back navigation does not work as an in-app “pop”, even though the stack contains multiple elements.  Reproduction  Reproduction repository: https://github.com/QuilliuQ/DecomposeReproduce  Problem 1 reproduction steps: 1. Open new tab 2. Open app on certain release. Example "http://localhost:8080/apps/App_0/release/1_Release" 3. Select another app, on main panel.  Result: The navigation state updates correctly, but the URL remains unchanged.  Problem 2 reproduction steps: 1. Open new tab 2. Open app on ce
  **Post-Mortem & Fix Analysis**:
  > Thank you providing a reproducer. The bug (Problem 1) will be fixed in the next release.  As of Problem 2, this works as expected. Modern browsers don't allow changing the browser history immediately after opening a page. E.g. if the user clicks a link on a third-party website and goes to your website, the browser back button should navigate the user back to the previous third-party page.
  > Literaly just came to create a bug report for this, but guess already known issue, is there a way to reliably add to the stack after page navigation (as there sure as hell are annoying websites that stop you from going back with infinite history)        Environment      - Decompose: 3.5.0-beta01     - Platform: Kotlin/WASM (Compose Multiplatform)      Description      When a component is created with a multi-item initialStack (e.g. [ManageMenu, BillingScreen]), withWebHistory stores the entire     stack as a single replaceState entry. This means the browser history has only one entry, so pressing back exits the tab entirely     instead of navigating within the Decompose stack.      By contrast, when the user navigates the same path via in-app clicks, each navigation.push() call correctly triggers a pushState,     creating individual history entries — and back works as expected.      Steps to Reproduce      1. Create a component using childStackWebNavigation with initialStack = { listOf
  > Well I'm not aware of any way of faking the history right after initialization. It just doesn't work, but I think it works after some delay. And I remember this was explicitly documented somewhere. If you know, then please let me know.

- **Issue #929** (2025-09-09): **ChildPages discards any selected index change performed while the composable was not in composition**
  *Symptoms*: This probably happens because `rememberPagerState` restores its previous selected index when it enters the composition again.

- **Issue #913** (2025-08-12): **ChildSlot doesn't preserve the navigation state when there is no active child**
  *Symptoms*: When there is no active child in ChildSlot, the navigation state is not preserved and `initialCongfiguration` function is called again after configuration change.

- **Issue #908** (2025-08-12): **ClassCastException on dismissing Slot on WasmJs**
  *Symptoms*: Admittedly this could be 100% wasm js bug, but Slots throw an ClassEx when dismissing:  ``` val inviteSlot by component.inviteDialogSlot.subscribeAsState()     inviteSlot.child?.let { inviteDialog ->         // Invite user modal         UserInviteModalContent(component = inviteDialog.instance)     } ```  When you dismiss this slot `scope.onMain { inviteDialogNavigation.dismiss() }`  You will get this error (and it breaks the subAsState(), needing to destroy the comp and restart it for it to open again)  ``` haynetApp.uninstantiated.mjs:1548 ClassCastException: Expected null (Nothing?), got an instance of UserInviteDialogConfig ```  Unfortunatly the wasm stack trace is useless so thats as much as I get. 
  **Post-Mortem & Fix Analysis**:
  > Dupe of #879 ?
  > Maybe, but tested 2.2.20 b2 which claims it's fixed. But still seeing the CCE. I left a comment on YT
  > Did you try updating Decompose to [3.4.0-alpha03](https://github.com/arkivanov/Decompose/releases/tag/3.4.0-alpha03)?

- **Issue #907** (2025-09-12): **WebHistory will add multiple entries**
  *Symptoms*: This only happens sometimes, but child we navigation owners will add multiple history targets, once it starts it gets worse over time, once you get back to the bottom of the stack and then re-navigate it will add more next time.  <img width="430" height="532" alt="Image" src="https://github.com/user-attachments/assets/52009cb7-d470-42e8-be86-ab754481e7bf" />  Decompose 3.3.0-alpha03 KT 2.2.10-RC Compose 1.8.2 WasmJs target on Brave (Chrome Engine)  Let me know if there are any logs/outputs i need to enable to give you, can't see anything in the console.  (I'm wondering if it recomposes and reattaches to the web history handler multiple times?)
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting! Would you be able to provide a reproducer code or project?
  > > Thanks for reporting! Would you be able to provide a reproducer code or project?  Unfornuatly not really, I could barely get this wasm target to work lol! If I can hone down the cause I will try and update
  > No problem. I will try to reproduce it on the sample app. Let me know if there are additional details or steps to reproduce.

- **Issue #879** (2025-06-02): **Kotlin/Wasm produce CCE for SlotNavigator.dismiss extension.**
  *Symptoms*: Function `com.arkivanov.decompose.router.slot.dismiss` seems written with an issue:  ```kotlin inline fun SlotNavigator<*>.dismiss(crossinline onComplete: (isSuccess: Boolean) -> Unit = {}) {     navigate(         transformer = { null },         onComplete = { _, oldConfiguration -> onComplete(oldConfiguration != null) },     ) } ```  The `*` generic type resolved to `Nothing?` in the `oldConfiguration` parameter. That means that only `null` can be a value. The `Kotlin/Wasm` compiler is more strict here and have to put check cast, so if any not-null value is present it throws the `CCE`. I suspect that the more correct way to write such code is something like this: ```kotlin inline fun <C : Any> SlotNavigator<C>.dismiss(crossinline onComplete: (isSuccess: Boolean) -> Unit = {}) {     navigate(         transformer = { null },         onComplete = { _, oldConfiguration -> onComplete(oldConfiguration != null) },     ) } ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting! The code looks valid and I think it's worth filing an issue on YouTrack. I will do it and provide the link here.
  > I tried to write a test for this, but it passes. Is there anything special I should do?  ```kotlin class FooTest {      @Test     fun testFoo() {         val nav = SlotNavigation<String>()         nav.dismiss()     } } ```  Running this test against `wasmJs` target works just fine.  The following test also passes:  ```kotlin     @Test     fun testFoo() {         val ctx = TestComponentContext()         val nav = SlotNavigation<Int>()          ctx.childSlot(             source = nav,             serializer = null,             initialConfiguration = { 1 },             childFactory = ::Component,         )          nav.dismiss()     } ```
  > ```kotlin enum class Destination {     X }  val nav = SlotNavigation<Destination>() nav.subscribe { e -> e.onComplete(Destination.X, null) } nav.dismiss() ```

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

### Incident Patch 1: `1dd253ed` (2026-07-01)
**Commit Message**: Merge pull request #1001 from arkivanov/fix-predictive-back-cancel-start

Fixed predictive back gesture not working on OnePlus devices

**File**: `extensions-compose-experimental/api/extensions-compose-experimental.klib.api` (modified, +2/-0)
```diff
@@ -61,6 +61,7 @@ final val com.arkivanov.decompose.extensions.compose.experimental.panels/com_ark
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider|{}LocalStackAnimationProvider[0]
     final fun <get-LocalStackAnimationProvider>(): androidx.compose.runtime/ProvidableCompositionLocal<com.arkivanov.decompose.extensions.compose.experimental.stack.animation/StackAnimationProvider> // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider.<get-LocalStackAnimationProvider>|<get-LocalStackAnimationProvider>(){}[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop[0]
@@ -82,6 +83,7 @@ final fun <#A: kotlin/Any, #B: kotlin/Any> com.arkivanov.decompose.extensions.co
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(): kotlin/Int // com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter|com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(){}[0]
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions
```

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/DefaultStackAnimation.kt` (modified, +65/-26)
```diff
@@ -30,8 +30,10 @@ import com.arkivanov.decompose.router.stack.ChildStack
 import com.arkivanov.essenty.backhandler.BackCallback
 import com.arkivanov.essenty.backhandler.BackEvent
 import kotlinx.coroutines.CoroutineScope
+import kotlinx.coroutines.Job
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.launch
+import kotlinx.coroutines.plus
 
 @ExperimentalDecomposeApi
 internal class DefaultStackAnimation<C : Any, T : Any>(
@@ -207,7 +209,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
             remember {
                 PredictiveBackCallback(
                     stack = stack,
-                    scope = scope,
+                    parentScope = scope,
                     predictiveBackParams = predictiveBackParams,
                     setItems = setItems,
                 )
@@ -240,23 +242,31 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
 
     private inner class PredictiveBackCallback(
         private val stack: ChildStack<C, T>,
-        private val scope: CoroutineScope,
+        private val parentScope: CoroutineScope,
         private val predictiveBackParams: PredictiveBackParams,
         private val setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) : BackCallback() {
         private var state: State = State.Idle
 
         override fun onBackStarted(backEvent: BackEvent) {
-            if (state is State.Idle) {
-                state = State.Started(backEvent)
+            val currentState = state
+            if (currentState is State.Idle) {
+                val childScope = parentScope + Job(parentScope.coroutineContext[Job])
+                state = State.Started(backEvent, childScope)
+            } else if (currentState is State.Cancelling) {
+                currentState.scope.cancel()
+                val newScope = parentScope + Job(parentScope.coroutineContext[Job])
+                state = State.Started(currentState.lastBackEvent, newScope)
+                onBackProgressed(currentState.lastBackEvent)
             }
         }
 
         override fun onBackProgressed(backEvent: BackEvent) {
             startIfNeeded()
             val currentState = state as? State.Progress ?: return
+            currentState.backEvent = backEvent
 
-            scope.launch {
+            currentState.scope.launch {
                 currentState.animationHandler.progress(backEvent)
             }
         }
@@ -265,7 +275,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
             val currentState = state as? State.Started ?: return
             val backEvent = currentState.initialBackEvent
             val animationHandler = AnimationHandler(animatable = predictiveBackParams.animatable(backEvent))
-            state = State.Progress(animationHandler)
+            state = State.Progress(animationHandler, currentState.initialBackEvent, currentState.scope)
             val exitChild = stack.active
             val enterChild = stack.backStack.last()
 
@@ -290,49 +300,78 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
                 )
             )
 
-            scope.launch {
+            currentState.scope.launch {
                 animationHandler.progress(backEvent)
             }
         }
 
         override fun onBackCancelled() {
-            val currentState = state
-            if (currentState is State.Progress) {
-                state = State.Finishing
+            when (val currentState = state) {
+                is State.Idle -> Unit // no-op
 
-                scope.launch {
-                    currentState.animationHandler.cancel()
+                is State.Started -> {
+                    currentState.scope.cancel()
                     state = State.Idle
-                    setItems(getAnimationItems(newStack = stack))
                 }
-            } else if (currentState !is State.Finishing) {
-                state = State.Idle
+
+                is State.Progress -> {
+                    state = State.Ca
```

**File**: `extensions-compose-experimental/src/jvmTest/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/PredictiveBackGestureTest.kt` (modified, +74/-18)
```diff
@@ -502,15 +502,7 @@ class PredictiveBackGestureTest {
             DefaultStackAnimation(
                 predictiveBackAnimatable = {
                     animationCount++
-
-                    TestAnimatable(
-                        initialBackEvent = it,
-                        finish = {
-                            suspendCancellableCoroutine {
-                                // Simulate a long-running animation
-                            }
-                        },
-                    )
+                    TestAnimatable(initialBackEvent = it, finish = suspendForever())
                 },
                 onBack = { stack = stack.dropLast() },
             )
@@ -544,15 +536,7 @@ class PredictiveBackGestureTest {
             DefaultStackAnimation(
                 predictiveBackAnimatable = {
                     animationCount++
-
-                    TestAnimatable(
-                        initialBackEvent = it,
-                        finish = {
-                            suspendCancellableCoroutine {
-                                // Simulate a long-running animation
-                            }
-                        },
-                    )
+                    TestAnimatable(initialBackEvent = it, finish = suspendForever())
                 },
                 onBack = { stack = stack.dropLast() },
             )
@@ -575,6 +559,69 @@ class PredictiveBackGestureTest {
         assertEquals(stack("1", "2"), stack)
     }
 
+    @Test
+    fun GIVEN_gesture_progressed_WHEN_cancelled_and_back_THEN_gesture_finished_and_stack_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = { TestAnimatable(initialBackEvent = it, cancel = suspendForever()) },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        backDispatcher.cancelPredictiveBack()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1"), stack)
+        composeRule.onNodeWithText("1").assertExists()
+        composeRule.onNodeWithText("1").assertTestTagToRootDoesNotExist { it.startsWith(TEST_TAG_PREFIX) }
+        composeRule.onNodeWithText("2").assertDoesNotExist()
+    }
+
+    @Test
+    fun GIVEN_gesture_progressed_WHEN_cancelled_and_restarted_and_back_THEN_gesture_finished_and_stack_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = { TestAnimatable(initialBackEvent = it, cancel = suspendForever()) },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        backDispatcher.cancelPredictiveBack()
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1"), stack)
+        composeRule.onNodeWithText("1").assertExists()
+        composeRule.onNodeWithText("1").assertTestTagToRootDoesNotExist { it.startsWith(TEST_TAG_PREFIX) }
+        composeRule.onNodeWithText("2").assertDoesNotExist()
+    }
+
     private fun DefaultStackAnimation(
         predictiveBackAnimatable: (initialB
```

---

### Incident Patch 2: `237dded4` (2026-06-30)
**Commit Message**: Fixed predictive back gesture not working on OnePlus devices

On some OnePlus devices with Android 14 the predictive back gesture is not working if the app depends on a new version of androidx.activity. The root cause is that those Android versions dispatch onBackStarted when the gesture finger is released. The new versions of OnBackPressedDispatcher now use NavigationEventDispatcher and dispatch onBackCancelled when onBackStarted is received while the back gesture is already in progress.

**File**: `extensions-compose-experimental/api/extensions-compose-experimental.klib.api` (modified, +2/-0)
```diff
@@ -61,6 +61,7 @@ final val com.arkivanov.decompose.extensions.compose.experimental.panels/com_ark
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider|{}LocalStackAnimationProvider[0]
     final fun <get-LocalStackAnimationProvider>(): androidx.compose.runtime/ProvidableCompositionLocal<com.arkivanov.decompose.extensions.compose.experimental.stack.animation/StackAnimationProvider> // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider.<get-LocalStackAnimationProvider>|<get-LocalStackAnimationProvider>(){}[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Cancelling$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop[0]
@@ -82,6 +83,7 @@ final fun <#A: kotlin/Any, #B: kotlin/Any> com.arkivanov.decompose.extensions.co
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(): kotlin/Int // com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter|com_arkivanov_decompose_extensions_compose_experimental_panels_ChildPanelsAnimators$stableprop_getter(){}[0]
 final fun com.arkivanov.decompose.extensions.compose.experimental.panels/com_arkivanov_decompose_extensions
```

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/DefaultStackAnimation.kt` (modified, +65/-26)
```diff
@@ -30,8 +30,10 @@ import com.arkivanov.decompose.router.stack.ChildStack
 import com.arkivanov.essenty.backhandler.BackCallback
 import com.arkivanov.essenty.backhandler.BackEvent
 import kotlinx.coroutines.CoroutineScope
+import kotlinx.coroutines.Job
 import kotlinx.coroutines.cancel
 import kotlinx.coroutines.launch
+import kotlinx.coroutines.plus
 
 @ExperimentalDecomposeApi
 internal class DefaultStackAnimation<C : Any, T : Any>(
@@ -207,7 +209,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
             remember {
                 PredictiveBackCallback(
                     stack = stack,
-                    scope = scope,
+                    parentScope = scope,
                     predictiveBackParams = predictiveBackParams,
                     setItems = setItems,
                 )
@@ -240,23 +242,31 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
 
     private inner class PredictiveBackCallback(
         private val stack: ChildStack<C, T>,
-        private val scope: CoroutineScope,
+        private val parentScope: CoroutineScope,
         private val predictiveBackParams: PredictiveBackParams,
         private val setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) : BackCallback() {
         private var state: State = State.Idle
 
         override fun onBackStarted(backEvent: BackEvent) {
-            if (state is State.Idle) {
-                state = State.Started(backEvent)
+            val currentState = state
+            if (currentState is State.Idle) {
+                val childScope = parentScope + Job(parentScope.coroutineContext[Job])
+                state = State.Started(backEvent, childScope)
+            } else if (currentState is State.Cancelling) {
+                currentState.scope.cancel()
+                val newScope = parentScope + Job(parentScope.coroutineContext[Job])
+                state = State.Started(currentState.lastBackEvent, newScope)
+                onBackProgressed(currentState.lastBackEvent)
             }
         }
 
         override fun onBackProgressed(backEvent: BackEvent) {
             startIfNeeded()
             val currentState = state as? State.Progress ?: return
+            currentState.backEvent = backEvent
 
-            scope.launch {
+            currentState.scope.launch {
                 currentState.animationHandler.progress(backEvent)
             }
         }
@@ -265,7 +275,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
             val currentState = state as? State.Started ?: return
             val backEvent = currentState.initialBackEvent
             val animationHandler = AnimationHandler(animatable = predictiveBackParams.animatable(backEvent))
-            state = State.Progress(animationHandler)
+            state = State.Progress(animationHandler, currentState.initialBackEvent, currentState.scope)
             val exitChild = stack.active
             val enterChild = stack.backStack.last()
 
@@ -290,49 +300,78 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
                 )
             )
 
-            scope.launch {
+            currentState.scope.launch {
                 animationHandler.progress(backEvent)
             }
         }
 
         override fun onBackCancelled() {
-            val currentState = state
-            if (currentState is State.Progress) {
-                state = State.Finishing
+            when (val currentState = state) {
+                is State.Idle -> Unit // no-op
 
-                scope.launch {
-                    currentState.animationHandler.cancel()
+                is State.Started -> {
+                    currentState.scope.cancel()
                     state = State.Idle
-                    setItems(getAnimationItems(newStack = stack))
                 }
-            } else if (currentState !is State.Finishing) {
-                state = State.Idle
+
+                is State.Progress -> {
+                    state = State.Ca
```

**File**: `extensions-compose-experimental/src/jvmTest/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/PredictiveBackGestureTest.kt` (modified, +74/-18)
```diff
@@ -502,15 +502,7 @@ class PredictiveBackGestureTest {
             DefaultStackAnimation(
                 predictiveBackAnimatable = {
                     animationCount++
-
-                    TestAnimatable(
-                        initialBackEvent = it,
-                        finish = {
-                            suspendCancellableCoroutine {
-                                // Simulate a long-running animation
-                            }
-                        },
-                    )
+                    TestAnimatable(initialBackEvent = it, finish = suspendForever())
                 },
                 onBack = { stack = stack.dropLast() },
             )
@@ -544,15 +536,7 @@ class PredictiveBackGestureTest {
             DefaultStackAnimation(
                 predictiveBackAnimatable = {
                     animationCount++
-
-                    TestAnimatable(
-                        initialBackEvent = it,
-                        finish = {
-                            suspendCancellableCoroutine {
-                                // Simulate a long-running animation
-                            }
-                        },
-                    )
+                    TestAnimatable(initialBackEvent = it, finish = suspendForever())
                 },
                 onBack = { stack = stack.dropLast() },
             )
@@ -575,6 +559,69 @@ class PredictiveBackGestureTest {
         assertEquals(stack("1", "2"), stack)
     }
 
+    @Test
+    fun GIVEN_gesture_progressed_WHEN_cancelled_and_back_THEN_gesture_finished_and_stack_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = { TestAnimatable(initialBackEvent = it, cancel = suspendForever()) },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        backDispatcher.cancelPredictiveBack()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1"), stack)
+        composeRule.onNodeWithText("1").assertExists()
+        composeRule.onNodeWithText("1").assertTestTagToRootDoesNotExist { it.startsWith(TEST_TAG_PREFIX) }
+        composeRule.onNodeWithText("2").assertDoesNotExist()
+    }
+
+    @Test
+    fun GIVEN_gesture_progressed_WHEN_cancelled_and_restarted_and_back_THEN_gesture_finished_and_stack_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = { TestAnimatable(initialBackEvent = it, cancel = suspendForever()) },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        backDispatcher.cancelPredictiveBack()
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1"), stack)
+        composeRule.onNodeWithText("1").assertExists()
+        composeRule.onNodeWithText("1").assertTestTagToRootDoesNotExist { it.startsWith(TEST_TAG_PREFIX) }
+        composeRule.onNodeWithText("2").assertDoesNotExist()
+    }
+
     private fun DefaultStackAnimation(
         predictiveBackAnimatable: (initialB
```

---

### Incident Patch 3: `e2b57258` (2026-04-24)
**Commit Message**: Merge pull request #988 from arkivanov/fixed-back-gesture-repeat

Fixed the same predictive back gesture animation repeating when quickly started again

**File**: `extensions-compose-experimental/api/extensions-compose-experimental.klib.api` (modified, +8/-0)
```diff
@@ -61,6 +61,10 @@ final val com.arkivanov.decompose.extensions.compose.experimental.panels/com_ark
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider|{}LocalStackAnimationProvider[0]
     final fun <get-LocalStackAnimationProvider>(): androidx.compose.runtime/ProvidableCompositionLocal<com.arkivanov.decompose.extensions.compose.experimental.stack.animation/StackAnimationProvider> // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider.<get-LocalStackAnimationProvider>|<get-LocalStackAnimationProvider>(){}[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_PredictiveBackParams$stableprop // com.arkiva
```

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/DefaultStackAnimation.kt` (modified, +38/-24)
```diff
@@ -53,7 +53,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
     ) {
         var currentStack by remember { mutableStateOf(stack) }
         var items by remember { mutableStateOf(getAnimationItems(newStack = currentStack)) }
-        var nextItems: Map<Any, AnimationItem<C, T>>? by remember { mutableStateOf(null) }
+        var nextItems: Map<String, AnimationItem<C, T>>? by remember { mutableStateOf(null) }
         val stackKeys = remember(stack) { stack.items.map { it.key } }
         val currentStackKeys = remember(currentStack) { currentStack.items.map { it.key } }
 
@@ -150,7 +150,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         }
     }
 
-    private fun getAnimationItems(newStack: ChildStack<C, T>, oldStack: ChildStack<C, T>? = null): Map<Any, AnimationItem<C, T>> =
+    private fun getAnimationItems(newStack: ChildStack<C, T>, oldStack: ChildStack<C, T>? = null): Map<String, AnimationItem<C, T>> =
         when {
             (oldStack == null) || (newStack.active.key == oldStack.active.key) ->
                 keyedItemsOf(
@@ -199,7 +199,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
     private fun PredictiveBackController(
         stack: ChildStack<C, T>,
         predictiveBackParams: PredictiveBackParams,
-        setItems: (Map<Any, AnimationItem<C, T>>) -> Unit,
+        setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) {
         val scope = rememberCoroutineScope()
 
@@ -242,29 +242,30 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         private val stack: ChildStack<C, T>,
         private val scope: CoroutineScope,
         private val predictiveBackParams: PredictiveBackParams,
-        private val setItems: (Map<Any, AnimationItem<C, T>>) -> Unit,
+        private val setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) : BackCallback() {
-        private var animationHandler: AnimationHandler? = null
-        private var initialBackEvent: BackEvent? = null
+        private var state: State = State.Idle
 
         override fun onBackStarted(backEvent: BackEvent) {
-            initialBackEvent = backEvent
+            if (state is State.Idle) {
+                state = State.Started(backEvent)
+            }
         }
 
         override fun onBackProgressed(backEvent: BackEvent) {
             startIfNeeded()
+            val currentState = state as? State.Progress ?: return
 
             scope.launch {
-                animationHandler?.progress(backEvent)
+                currentState.animationHandler.progress(backEvent)
             }
         }
 
         private fun startIfNeeded() {
-            val backEvent = initialBackEvent ?: return
-            initialBackEvent = null
-
+            val currentState = state as? State.Started ?: return
+            val backEvent = currentState.initialBackEvent
             val animationHandler = AnimationHandler(animatable = predictiveBackParams.animatable(backEvent))
-            this.animationHandler = animationHandler
+            state = State.Progress(animationHandler)
             val exitChild = stack.active
             val enterChild = stack.backStack.last()
 
@@ -295,32 +296,45 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         }
 
         override fun onBackCancelled() {
-            initialBackEvent = null
+            val currentState = state
+            if (currentState is State.Progress) {
+                state = State.Finishing
 
-            scope.launch {
-                animationHandler?.also { handler ->
-                    handler.cancel()
-                    animationHandler = null
+                scope.launch {
+                    currentState.animationHandler.cancel()
+                    state = State.Idle
                     setItems(getAnimationItems(newStack = stack))
                 }
+            } else if (currentState !is State.Finishing) {
+                state = State.Idle
             }
         }
 
         
```

**File**: `extensions-compose-experimental/src/jvmTest/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/PredictiveBackGestureTest.kt` (modified, +86/-1)
```diff
@@ -20,6 +20,7 @@ import com.arkivanov.decompose.extensions.compose.stack.animation.predictiveback
 import com.arkivanov.decompose.router.stack.ChildStack
 import com.arkivanov.essenty.backhandler.BackDispatcher
 import com.arkivanov.essenty.backhandler.BackEvent
+import kotlinx.coroutines.suspendCancellableCoroutine
 import org.junit.Rule
 import kotlin.test.Test
 import kotlin.test.assertEquals
@@ -216,7 +217,7 @@ class PredictiveBackGestureTest {
     @Test
     fun GIVEN_gesture_started_WHEN_stack_popped_THEN_gesture_cancelled() {
         var stack by mutableStateOf(stack("1", "2"))
-        val animation = DefaultStackAnimation(animator = fade(), onBack = { stack = stack.dropLast() },)
+        val animation = DefaultStackAnimation(animator = fade(), onBack = { stack = stack.dropLast() })
 
         composeRule.setContent {
             animation(stack, Modifier) {
@@ -492,6 +493,88 @@ class PredictiveBackGestureTest {
         assertEquals(0.7F, values["2"])
     }
 
+    @Test
+    fun GIVEN_gesture_finishing_WHEN_new_gesture_started_THEN_new_animation_not_started() {
+        var stack by mutableStateOf(stack("1", "2"))
+        var animationCount = 0
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = {
+                    animationCount++
+
+                    TestAnimatable(
+                        initialBackEvent = it,
+                        finish = {
+                            suspendCancellableCoroutine {
+                                // Simulate a long-running animation
+                            }
+                        },
+                    )
+                },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        assertEquals(1, animationCount)
+    }
+
+    @Test
+    fun GIVEN_gesture_finishing_WHEN_back_THEN_stack_not_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+        var animationCount = 0
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = {
+                    animationCount++
+
+                    TestAnimatable(
+                        initialBackEvent = it,
+                        finish = {
+                            suspendCancellableCoroutine {
+                                // Simulate a long-running animation
+                            }
+                        },
+                    )
+                },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1", "2"), stack)
+    }
+
     private fun DefaultStackAnimation(
         predictiveBackAnimatable: (initialBackEvent: BackEvent) -> PredictiveBackAnimatable? = ::TestAnimatable,
         animator: StackAnimator? = null,
@@ -538,6 +621,7 @@ class PredictiveBackGestureTest {
 
 
```

---

### Incident Patch 4: `efaa7bbd` (2026-03-18)
**Commit Message**: Fixed the same predictive back gesture animation repeating when quickly started again

If you start a new predictive back gesture before the current gesture is fully finished, the same animation is started again. Instead, it should do nothing and allow the current animation to finish.

**File**: `extensions-compose-experimental/api/extensions-compose-experimental.klib.api` (modified, +8/-0)
```diff
@@ -61,6 +61,10 @@ final val com.arkivanov.decompose.extensions.compose.experimental.panels/com_ark
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider|{}LocalStackAnimationProvider[0]
     final fun <get-LocalStackAnimationProvider>(): androidx.compose.runtime/ProvidableCompositionLocal<com.arkivanov.decompose.extensions.compose.experimental.stack.animation/StackAnimationProvider> // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/LocalStackAnimationProvider.<get-LocalStackAnimationProvider>|<get-LocalStackAnimationProvider>(){}[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Finishing$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Idle$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Progress$stableprop[0]
+final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimation_State_Started$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop // com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop|#static{}com_arkivanov_decompose_extensions_compose_experimental_stack_animation_DefaultStackAnimator$stableprop[0]
 final val com.arkivanov.decompose.extensions.compose.experimental.stack.animation/com_arkivanov_decompose_extensions_compose_experimental_stack_animation_PredictiveBackParams$stableprop // com.arkiva
```

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/DefaultStackAnimation.kt` (modified, +38/-24)
```diff
@@ -53,7 +53,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
     ) {
         var currentStack by remember { mutableStateOf(stack) }
         var items by remember { mutableStateOf(getAnimationItems(newStack = currentStack)) }
-        var nextItems: Map<Any, AnimationItem<C, T>>? by remember { mutableStateOf(null) }
+        var nextItems: Map<String, AnimationItem<C, T>>? by remember { mutableStateOf(null) }
         val stackKeys = remember(stack) { stack.items.map { it.key } }
         val currentStackKeys = remember(currentStack) { currentStack.items.map { it.key } }
 
@@ -150,7 +150,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         }
     }
 
-    private fun getAnimationItems(newStack: ChildStack<C, T>, oldStack: ChildStack<C, T>? = null): Map<Any, AnimationItem<C, T>> =
+    private fun getAnimationItems(newStack: ChildStack<C, T>, oldStack: ChildStack<C, T>? = null): Map<String, AnimationItem<C, T>> =
         when {
             (oldStack == null) || (newStack.active.key == oldStack.active.key) ->
                 keyedItemsOf(
@@ -199,7 +199,7 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
     private fun PredictiveBackController(
         stack: ChildStack<C, T>,
         predictiveBackParams: PredictiveBackParams,
-        setItems: (Map<Any, AnimationItem<C, T>>) -> Unit,
+        setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) {
         val scope = rememberCoroutineScope()
 
@@ -242,29 +242,30 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         private val stack: ChildStack<C, T>,
         private val scope: CoroutineScope,
         private val predictiveBackParams: PredictiveBackParams,
-        private val setItems: (Map<Any, AnimationItem<C, T>>) -> Unit,
+        private val setItems: (Map<String, AnimationItem<C, T>>) -> Unit,
     ) : BackCallback() {
-        private var animationHandler: AnimationHandler? = null
-        private var initialBackEvent: BackEvent? = null
+        private var state: State = State.Idle
 
         override fun onBackStarted(backEvent: BackEvent) {
-            initialBackEvent = backEvent
+            if (state is State.Idle) {
+                state = State.Started(backEvent)
+            }
         }
 
         override fun onBackProgressed(backEvent: BackEvent) {
             startIfNeeded()
+            val currentState = state as? State.Progress ?: return
 
             scope.launch {
-                animationHandler?.progress(backEvent)
+                currentState.animationHandler.progress(backEvent)
             }
         }
 
         private fun startIfNeeded() {
-            val backEvent = initialBackEvent ?: return
-            initialBackEvent = null
-
+            val currentState = state as? State.Started ?: return
+            val backEvent = currentState.initialBackEvent
             val animationHandler = AnimationHandler(animatable = predictiveBackParams.animatable(backEvent))
-            this.animationHandler = animationHandler
+            state = State.Progress(animationHandler)
             val exitChild = stack.active
             val enterChild = stack.backStack.last()
 
@@ -295,32 +296,45 @@ internal class DefaultStackAnimation<C : Any, T : Any>(
         }
 
         override fun onBackCancelled() {
-            initialBackEvent = null
+            val currentState = state
+            if (currentState is State.Progress) {
+                state = State.Finishing
 
-            scope.launch {
-                animationHandler?.also { handler ->
-                    handler.cancel()
-                    animationHandler = null
+                scope.launch {
+                    currentState.animationHandler.cancel()
+                    state = State.Idle
                     setItems(getAnimationItems(newStack = stack))
                 }
+            } else if (currentState !is State.Finishing) {
+                state = State.Idle
             }
         }
 
         
```

**File**: `extensions-compose-experimental/src/jvmTest/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/PredictiveBackGestureTest.kt` (modified, +86/-1)
```diff
@@ -20,6 +20,7 @@ import com.arkivanov.decompose.extensions.compose.stack.animation.predictiveback
 import com.arkivanov.decompose.router.stack.ChildStack
 import com.arkivanov.essenty.backhandler.BackDispatcher
 import com.arkivanov.essenty.backhandler.BackEvent
+import kotlinx.coroutines.suspendCancellableCoroutine
 import org.junit.Rule
 import kotlin.test.Test
 import kotlin.test.assertEquals
@@ -216,7 +217,7 @@ class PredictiveBackGestureTest {
     @Test
     fun GIVEN_gesture_started_WHEN_stack_popped_THEN_gesture_cancelled() {
         var stack by mutableStateOf(stack("1", "2"))
-        val animation = DefaultStackAnimation(animator = fade(), onBack = { stack = stack.dropLast() },)
+        val animation = DefaultStackAnimation(animator = fade(), onBack = { stack = stack.dropLast() })
 
         composeRule.setContent {
             animation(stack, Modifier) {
@@ -492,6 +493,88 @@ class PredictiveBackGestureTest {
         assertEquals(0.7F, values["2"])
     }
 
+    @Test
+    fun GIVEN_gesture_finishing_WHEN_new_gesture_started_THEN_new_animation_not_started() {
+        var stack by mutableStateOf(stack("1", "2"))
+        var animationCount = 0
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = {
+                    animationCount++
+
+                    TestAnimatable(
+                        initialBackEvent = it,
+                        finish = {
+                            suspendCancellableCoroutine {
+                                // Simulate a long-running animation
+                            }
+                        },
+                    )
+                },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+
+        assertEquals(1, animationCount)
+    }
+
+    @Test
+    fun GIVEN_gesture_finishing_WHEN_back_THEN_stack_not_popped() {
+        var stack by mutableStateOf(stack("1", "2"))
+        var animationCount = 0
+
+        val animation =
+            DefaultStackAnimation(
+                predictiveBackAnimatable = {
+                    animationCount++
+
+                    TestAnimatable(
+                        initialBackEvent = it,
+                        finish = {
+                            suspendCancellableCoroutine {
+                                // Simulate a long-running animation
+                            }
+                        },
+                    )
+                },
+                onBack = { stack = stack.dropLast() },
+            )
+
+        composeRule.setContent {
+            animation(stack, Modifier) {
+                Text(text = it.configuration)
+            }
+        }
+
+        backDispatcher.startPredictiveBack(BackEvent(progress = 0F))
+        composeRule.waitForIdle()
+        backDispatcher.progressPredictiveBack(BackEvent(progress = 0.5F))
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+        backDispatcher.back()
+        composeRule.waitForIdle()
+
+        assertEquals(stack("1", "2"), stack)
+    }
+
     private fun DefaultStackAnimation(
         predictiveBackAnimatable: (initialBackEvent: BackEvent) -> PredictiveBackAnimatable? = ::TestAnimatable,
         animator: StackAnimator? = null,
@@ -538,6 +621,7 @@ class PredictiveBackGestureTest {
 
 
```

---

### Incident Patch 5: `1fc0fa12` (2026-03-25)
**Commit Message**: Revert "Added reverseDirection parameter to slide animator"

This reverts commit 7235532a

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/Slide.kt` (modified, +6/-9)
```diff
@@ -14,31 +14,28 @@ import com.arkivanov.decompose.ExperimentalDecomposeApi
 fun slide(
     animationSpec: FiniteAnimationSpec<Float> = tween(),
     orientation: Orientation = Orientation.Horizontal,
-    reverseDirection: Boolean = false,
 ): StackAnimator =
     stackAnimator(animationSpec = animationSpec) { factor, _ ->
         when (orientation) {
-            Orientation.Horizontal -> Modifier.offsetXFactor(factor = factor, reverseDirection = reverseDirection)
-            Orientation.Vertical -> Modifier.offsetYFactor(factor = factor, reverseDirection = reverseDirection)
+            Orientation.Horizontal -> Modifier.offsetXFactor(factor)
+            Orientation.Vertical -> Modifier.offsetYFactor(factor)
         }
     }
 
-private fun Modifier.offsetXFactor(factor: Float, reverseDirection: Boolean): Modifier =
+private fun Modifier.offsetXFactor(factor: Float): Modifier =
     layout { measurable, constraints ->
         val placeable = measurable.measure(constraints)
 
         layout(placeable.width, placeable.height) {
-            val x = placeable.width.toFloat() * if (reverseDirection) -factor else factor
-            placeable.placeRelative(x = x.toInt(), y = 0)
+            placeable.placeRelative(x = (placeable.width.toFloat() * factor).toInt(), y = 0)
         }
     }
 
-private fun Modifier.offsetYFactor(factor: Float, reverseDirection: Boolean): Modifier =
+private fun Modifier.offsetYFactor(factor: Float): Modifier =
     layout { measurable, constraints ->
         val placeable = measurable.measure(constraints)
 
         layout(placeable.width, placeable.height) {
-            val y = placeable.height.toFloat() * if (reverseDirection) -factor else factor
-            placeable.placeRelative(x = 0, y = y.toInt())
+            placeable.placeRelative(x = 0, y = (placeable.height.toFloat() * factor).toInt())
         }
     }
```

---

### Incident Patch 6: `7e136b22` (2026-03-24)
**Commit Message**: Fixed formatting in Slide

**File**: `extensions-compose-experimental/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/experimental/stack/animation/Slide.kt` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ fun slide(
     animationSpec: FiniteAnimationSpec<Float> = tween(),
     orientation: Orientation = Orientation.Horizontal,
     reverseDirection: Boolean = false,
-    ): StackAnimator =
+): StackAnimator =
     stackAnimator(animationSpec = animationSpec) { factor, _ ->
         when (orientation) {
             Orientation.Horizontal -> Modifier.offsetXFactor(factor = factor, reverseDirection = reverseDirection)
```

---

### Incident Patch 7: `4fb267df` (2026-02-01)
**Commit Message**: Merge pull request #983 from arkivanov/fix-web-history-rewrite

Fixed web history rewriting incorrectly when started via a link

**File**: `decompose/src/webMain/kotlin/com/arkivanov/decompose/router/webhistory/WebHistoryNavigation.kt` (modified, +9/-14)
```diff
@@ -60,15 +60,15 @@ internal fun <T : Any> enableWebHistory(navigation: WebNavigation<T>, browserHis
                 browserHistory.replaceState(nodes)
             }
         },
-        onRewrite = { oldSize, newHistory ->
-            if (oldSize > 1) {
+        onRewrite = { newHistory ->
+            val currentIndex = browserHistory.currentIndex()
+            if (currentIndex > 0) {
                 browserHistory.setOnPopStateListener {
                     browserHistory.setOnPopStateListener(::onPopState)
                     browserHistory.replaceState(newHistory.first())
                     newHistory.drop(1).forEach(browserHistory::pushState)
                 }
-
-                browserHistory.go(-oldSize + 1)
+                browserHistory.go(-currentIndex)
             } else {
                 browserHistory.replaceState(newHistory.first())
                 newHistory.drop(1).forEach(browserHistory::pushState)
@@ -135,7 +135,7 @@ private fun <T : Any> WebNavigation<T>.subscribe(
     isEnabled: () -> Boolean,
     onPush: (List<NodeHistory<T>>) -> Unit,
     onPop: (count: Int, NodeHistory<T>) -> Unit,
-    onRewrite: (oldSize: Int, newHistory: List<NodeHistory<T>>) -> Unit,
+    onRewrite: (newHistory: List<NodeHistory<T>>) -> Unit,
     onUpdateUrl: (NodeHistory<T>) -> Unit,
 ): Cancellation {
     var activeChildCancellation: Cancellation? = null
@@ -164,11 +164,8 @@ private fun <T : Any> WebNavigation<T>.subscribe(
                 onPop = { count, childNodes ->
                     onPop(count, inactiveNodes + nodeOf(item = activeItem, children = childNodes))
                 },
-                onRewrite = { oldSize, childHistory ->
-                    onRewrite(
-                        oldSize,
-                        childHistory.map { childNodes -> inactiveNodes + nodeOf(item = activeItem, children = childNodes) },
-                    )
+                onRewrite = { childHistory ->
+                    onRewrite(childHistory.map { childNodes -> inactiveNodes + nodeOf(item = activeItem, children = childNodes) })
                 },
                 onUpdateUrl = { childNodes ->
                     onUpdateUrl(inactiveNodes + nodeOf(item = activeItem, children = childNodes))
@@ -182,7 +179,7 @@ private fun <T : Any> WebNavigation<T>.onHistoryChanged(
     oldHistory: List<HistoryItem<T>>,
     onPush: (List<NodeHistory<T>>) -> Unit,
     onPop: (count: Int, NodeHistory<T>) -> Unit,
-    onRewrite: (oldSize: Int, newHistory: List<NodeHistory<T>>) -> Unit,
+    onRewrite: (newHistory: List<NodeHistory<T>>) -> Unit,
     onUpdateUrl: (NodeHistory<T>) -> Unit,
 ) {
     val newKeys = newHistory.map { it.key }
@@ -226,9 +223,7 @@ private fun <T : Any> WebNavigation<T>.onHistoryChanged(
                 previousNodes += itemHistory.last()
             }
 
-            val oldPaths = oldHistory.flatMap(::historyOf)
-
-            onRewrite(oldPaths.size, historyChange)
+            onRewrite(historyChange)
         }
     }
 }
```

**File**: `decompose/src/webTest/kotlin/com/arkivanov/decompose/router/webhistory/TestBrowserHistory.kt` (modified, +3/-0)
```diff
@@ -1,6 +1,7 @@
 package com.arkivanov.decompose.router.webhistory
 
 import kotlin.test.assertEquals
+import kotlin.test.assertTrue
 
 class TestBrowserHistory : BrowserHistory {
 
@@ -13,7 +14,9 @@ class TestBrowserHistory : BrowserHistory {
 
     override fun go(delta: Int) {
         scheduleOperation {
+            val oldIndex = index
             index += delta
+            assertTrue(index in stack.indices, "Invalid go operation: delta=$delta, index=$oldIndex, range=${stack.indices}")
             onPopStateListener?.invoke(stack[index].data)
         }
     }
```

**File**: `decompose/src/webTest/kotlin/com/arkivanov/decompose/router/webhistory/TestWebNavigation.kt` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ import com.arkivanov.decompose.value.Value
 import kotlinx.serialization.KSerializer
 import kotlinx.serialization.builtins.serializer
 import kotlin.test.assertContentEquals
+import kotlin.test.assertEquals
 import kotlin.test.assertNotNull
 import kotlin.test.assertNull
 
```

**File**: `decompose/src/webTest/kotlin/com/arkivanov/decompose/router/webhistory/WebHistoryNavigationTest.kt` (modified, +19/-0)
```diff
@@ -779,6 +779,25 @@ class WebHistoryNavigationTest {
         assertHistory(nav = nav, urls = listOf("/1/1/1", "/1/1/2"))
     }
 
+    @Test
+    fun GIVEN_created_one_root_and_two_children_WHEN_root_replaced_with_with_one_child_THEN_one_item_in_history() {
+        val nav =
+            TestWebNavigation(initialHistory = listOf(1)) { cfg ->
+                when (cfg) {
+                    1 ->  TestWebNavigation(initialHistory = listOf(12, 13))
+                    2 ->  TestWebNavigation(initialHistory = listOf(22))
+                    else -> null
+                }
+            }
+
+        enableWebHistory(nav, history)
+
+        nav.navigate(listOf(2))
+        history.runPendingOperations()
+
+        assertHistory(nav = nav, urls = listOf("/2/22"))
+    }
+
     private fun assertHistory(nav: TestWebNavigation, urls: List<String>, index: Int = urls.lastIndex) {
         history.assertStack(urls = urls, index = index)
         nav.assertHistory(urls = urls.slice(0..index))
```

---

### Incident Patch 8: `080ca6ab` (2026-02-01)
**Commit Message**: Fixed web history rewriting incorrectly when started via a link

**File**: `decompose/src/webMain/kotlin/com/arkivanov/decompose/router/webhistory/WebHistoryNavigation.kt` (modified, +9/-14)
```diff
@@ -60,15 +60,15 @@ internal fun <T : Any> enableWebHistory(navigation: WebNavigation<T>, browserHis
                 browserHistory.replaceState(nodes)
             }
         },
-        onRewrite = { oldSize, newHistory ->
-            if (oldSize > 1) {
+        onRewrite = { newHistory ->
+            val currentIndex = browserHistory.currentIndex()
+            if (currentIndex > 0) {
                 browserHistory.setOnPopStateListener {
                     browserHistory.setOnPopStateListener(::onPopState)
                     browserHistory.replaceState(newHistory.first())
                     newHistory.drop(1).forEach(browserHistory::pushState)
                 }
-
-                browserHistory.go(-oldSize + 1)
+                browserHistory.go(-currentIndex)
             } else {
                 browserHistory.replaceState(newHistory.first())
                 newHistory.drop(1).forEach(browserHistory::pushState)
@@ -135,7 +135,7 @@ private fun <T : Any> WebNavigation<T>.subscribe(
     isEnabled: () -> Boolean,
     onPush: (List<NodeHistory<T>>) -> Unit,
     onPop: (count: Int, NodeHistory<T>) -> Unit,
-    onRewrite: (oldSize: Int, newHistory: List<NodeHistory<T>>) -> Unit,
+    onRewrite: (newHistory: List<NodeHistory<T>>) -> Unit,
     onUpdateUrl: (NodeHistory<T>) -> Unit,
 ): Cancellation {
     var activeChildCancellation: Cancellation? = null
@@ -164,11 +164,8 @@ private fun <T : Any> WebNavigation<T>.subscribe(
                 onPop = { count, childNodes ->
                     onPop(count, inactiveNodes + nodeOf(item = activeItem, children = childNodes))
                 },
-                onRewrite = { oldSize, childHistory ->
-                    onRewrite(
-                        oldSize,
-                        childHistory.map { childNodes -> inactiveNodes + nodeOf(item = activeItem, children = childNodes) },
-                    )
+                onRewrite = { childHistory ->
+                    onRewrite(childHistory.map { childNodes -> inactiveNodes + nodeOf(item = activeItem, children = childNodes) })
                 },
                 onUpdateUrl = { childNodes ->
                     onUpdateUrl(inactiveNodes + nodeOf(item = activeItem, children = childNodes))
@@ -182,7 +179,7 @@ private fun <T : Any> WebNavigation<T>.onHistoryChanged(
     oldHistory: List<HistoryItem<T>>,
     onPush: (List<NodeHistory<T>>) -> Unit,
     onPop: (count: Int, NodeHistory<T>) -> Unit,
-    onRewrite: (oldSize: Int, newHistory: List<NodeHistory<T>>) -> Unit,
+    onRewrite: (newHistory: List<NodeHistory<T>>) -> Unit,
     onUpdateUrl: (NodeHistory<T>) -> Unit,
 ) {
     val newKeys = newHistory.map { it.key }
@@ -226,9 +223,7 @@ private fun <T : Any> WebNavigation<T>.onHistoryChanged(
                 previousNodes += itemHistory.last()
             }
 
-            val oldPaths = oldHistory.flatMap(::historyOf)
-
-            onRewrite(oldPaths.size, historyChange)
+            onRewrite(historyChange)
         }
     }
 }
```

**File**: `decompose/src/webTest/kotlin/com/arkivanov/decompose/router/webhistory/TestBrowserHistory.kt` (modified, +3/-0)
```diff
@@ -1,6 +1,7 @@
 package com.arkivanov.decompose.router.webhistory
 
 import kotlin.test.assertEquals
+import kotlin.test.assertTrue
 
 class TestBrowserHistory : BrowserHistory {
 
@@ -13,7 +14,9 @@ class TestBrowserHistory : BrowserHistory {
 
     override fun go(delta: Int) {
         scheduleOperation {
+            val oldIndex = index
             index += delta
+            assertTrue(index in stack.indices, "Invalid go operation: delta=$delta, index=$oldIndex, range=${stack.indices}")
             onPopStateListener?.invoke(stack[index].data)
         }
     }
```

**File**: `decompose/src/webTest/kotlin/com/arkivanov/decompose/router/webhistory/TestWebNavigation.kt` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ import com.arkivanov.decompose.value.Value
 import kotlinx.serialization.KSerializer
 import kotlinx.serialization.builtins.serializer
 import kotlin.test.assertContentEquals
+import kotlin.test.assertEquals
 import kotlin.test.assertNotNull
 import kotlin.test.assertNull
 
```

**File**: `decompose/src/webTest/kotlin/com/arkivanov/decompose/router/webhistory/WebHistoryNavigationTest.kt` (modified, +19/-0)
```diff
@@ -779,6 +779,25 @@ class WebHistoryNavigationTest {
         assertHistory(nav = nav, urls = listOf("/1/1/1", "/1/1/2"))
     }
 
+    @Test
+    fun GIVEN_created_one_root_and_two_children_WHEN_root_replaced_with_with_one_child_THEN_one_item_in_history() {
+        val nav =
+            TestWebNavigation(initialHistory = listOf(1)) { cfg ->
+                when (cfg) {
+                    1 ->  TestWebNavigation(initialHistory = listOf(12, 13))
+                    2 ->  TestWebNavigation(initialHistory = listOf(22))
+                    else -> null
+                }
+            }
+
+        enableWebHistory(nav, history)
+
+        nav.navigate(listOf(2))
+        history.runPendingOperations()
+
+        assertHistory(nav = nav, urls = listOf("/2/22"))
+    }
+
     private fun assertHistory(nav: TestWebNavigation, urls: List<String>, index: Int = urls.lastIndex) {
         history.assertStack(urls = urls, index = index)
         nav.assertHistory(urls = urls.slice(0..index))
```

---

### Incident Patch 9: `67adb50b` (2026-01-25)
**Commit Message**: Merge pull request #979 from arkivanov/fix-children-animation

Fixed Children composable sometimes sticks with switching the stack quickly

**File**: `extensions-compose/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/stack/animation/AbstractStackAnimation.kt` (modified, +4/-1)
```diff
@@ -38,7 +38,10 @@ internal abstract class AbstractStackAnimation<C : Any, T : Any>(
 
             val newItems = getAnimationItems(newStack = currentStack, oldStack = oldStack)
             if (items.size == 1) {
-                items = newItems
+                val oldLastKey = items.keys.last()
+                val (newLastKey, newLastItem) = newItems.entries.last()
+                items = if ((newLastKey != oldLastKey) || newLastItem.direction.isExit) newItems else mapOf(newLastKey to newLastItem)
+                nextItems = null
             } else {
                 nextItems = newItems
             }
```

**File**: `extensions-compose/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/stack/animation/DefaultStackAnimator.kt` (modified, +4/-1)
```diff
@@ -7,7 +7,9 @@ import androidx.compose.animation.core.isFinished
 import androidx.compose.animation.core.tween
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.getValue
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.rememberUpdatedState
 import androidx.compose.ui.Modifier
 
 internal class DefaultStackAnimator(
@@ -22,6 +24,7 @@ internal class DefaultStackAnimator(
         onFinished: () -> Unit,
         content: @Composable (Modifier) -> Unit,
     ) {
+        val onFinishedRef by rememberUpdatedState(onFinished)
         val animationState = remember(direction, isInitial) { AnimationState(initialValue = if (isInitial) 0F else 1F) }
 
         LaunchedEffect(animationState) {
@@ -31,7 +34,7 @@ internal class DefaultStackAnimator(
                 sequentialAnimation = !animationState.isFinished,
             )
 
-            onFinished()
+            onFinishedRef()
         }
 
         val factor =
```

---

### Incident Patch 10: `1c8d953e` (2026-01-25)
**Commit Message**: Fixed Children composable sometimes sticks with switching the stack quickly

**File**: `extensions-compose/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/stack/animation/AbstractStackAnimation.kt` (modified, +4/-1)
```diff
@@ -38,7 +38,10 @@ internal abstract class AbstractStackAnimation<C : Any, T : Any>(
 
             val newItems = getAnimationItems(newStack = currentStack, oldStack = oldStack)
             if (items.size == 1) {
-                items = newItems
+                val oldLastKey = items.keys.last()
+                val (newLastKey, newLastItem) = newItems.entries.last()
+                items = if ((newLastKey != oldLastKey) || newLastItem.direction.isExit) newItems else mapOf(newLastKey to newLastItem)
+                nextItems = null
             } else {
                 nextItems = newItems
             }
```

**File**: `extensions-compose/src/commonMain/kotlin/com/arkivanov/decompose/extensions/compose/stack/animation/DefaultStackAnimator.kt` (modified, +4/-1)
```diff
@@ -7,7 +7,9 @@ import androidx.compose.animation.core.isFinished
 import androidx.compose.animation.core.tween
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.getValue
 import androidx.compose.runtime.remember
+import androidx.compose.runtime.rememberUpdatedState
 import androidx.compose.ui.Modifier
 
 internal class DefaultStackAnimator(
@@ -22,6 +24,7 @@ internal class DefaultStackAnimator(
         onFinished: () -> Unit,
         content: @Composable (Modifier) -> Unit,
     ) {
+        val onFinishedRef by rememberUpdatedState(onFinished)
         val animationState = remember(direction, isInitial) { AnimationState(initialValue = if (isInitial) 0F else 1F) }
 
         LaunchedEffect(animationState) {
@@ -31,7 +34,7 @@ internal class DefaultStackAnimator(
                 sequentialAnimation = !animationState.isFinished,
             )
 
-            onFinished()
+            onFinishedRef()
         }
 
         val factor =
```

#### Recent Merged Pull Requests:
- **PR #1029** (2026-09-28): [V4] Update v4 branch (@arkivanov)
- **PR #1028** (2026-09-28): Add linuxX64 and linuxArm64 targets (@arkivanov-bot)
- **PR #1027** (2026-09-27): [V4] Update v4 branch (@arkivanov)
- **PR #1026** (2026-09-27): Use TestComponentContext instead of DefaultComponentContext in tests (@arkivanov)
- **PR #1025** (2026-09-27): [V4] Update v4 branch (@arkivanov)
- **PR #1024** (2026-09-26): docs: add DecomposeNavigator to community projects (@jamal-wia)
- **PR #1023** (2026-09-27): Use TestComponentContext instead of TestStateKeeperDispatcher in tests (@arkivanov)
- **PR #1022** (closed): Fix "Cannot round NaN value" crash when predictive back gesture finishes with non-monotonic frame time (@arkivanov-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
