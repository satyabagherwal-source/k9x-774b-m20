# Forensic Learning Record (Deep Inspection): touchlab/DroidconKotlin

> **Canonical Artifact**: `07_PROJECT_LEARNING/touchlab-droidconkotlin-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/touchlab/DroidconKotlin](https://github.com/touchlab/DroidconKotlin))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:07:29.503Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `touchlab/DroidconKotlin`
- **Description**: Kotlin Multiplatfom app for Droidcon Events
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1147 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ios/Droidcon/Droidcon/Utils/LifecycleManager.swift`
```
import SwiftUI
import DroidconKit

class LifecycleManager: SwiftUI.ObservableObject {

    var managedViewModel: BaseViewModel? {
        willSet {
            if let managedViewModel = managedViewModel {
                Logger.companion.d { [root] in "Detaching VM: \(managedViewModel.lifecycle) from \(root)" }
                managedViewModel.lifecycle.removeFromParent()
            }
        }
        didSet {
            if let managedViewModel = managedViewModel {
                Logger.companion.d { [root] in "Attaching VM: \(managedViewModel.lifecycle) to \(root)" }
                root.addChild(child: managedViewModel.lifecycle)
            }
        }
    }

    private let root = LifecycleGraph.Root(owner: "LifecycleManager")
    private let cancelAttach: CancellationToken

    init() {
        Logger.companion.i { [root] in "Initializing LifecycleManager with root: \(root)" }

        cancelAttach = root.attachToMainScope()
    }

    deinit {
        Logger.companion.i { [root] in "Destroying LifecycleManager with root: \(root)" }

        cancelAttach.cancel()
    }
}

struct ManagedLifecycle: ViewModifier {

    private let viewModel: BaseViewModel

    @EnvironmentObject
    private var lifecycleManager: LifecycleManager

    init(viewModel: BaseViewModel) {
        self.viewModel = viewModel
    }

    func body(content: Content) -> some View {
        content
            .onChange(of: viewModel) { vm in
                lifecycleManager.managedViewModel = vm
            }
            .onAppear {
                lifecycleManager.managedViewModel = viewModel
            }
            .onDisappear {
                lifecycleManager.managedViewModel = nil
            }
    }
}

extension View {
    func attach(viewModel: BaseViewModel) -> some View {
        self.modifier(ManagedLifecycle(viewModel: viewModel))
    }
}

```

### Core Architecture Module: `shared-ui/src/androidMain/kotlin/co/touchlab/droidcon/ui/util/Dialog.kt`
```
package co.touchlab.droidcon.ui.util

import androidx.compose.runtime.Composable
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.Dialog as AndroidXComposeDialog
import androidx.compose.ui.window.DialogProperties

@OptIn(ExperimentalComposeUiApi::class)
@Composable
internal actual fun Dialog(dismiss: () -> Unit, content: @Composable () -> Unit) {
    AndroidXComposeDialog(
        onDismissRequest = dismiss,
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false, usePlatformDefaultWidth = false),
    ) {
        content()
    }
}

```

### Core Architecture Module: `shared-ui/src/androidMain/kotlin/co/touchlab/droidcon/ui/util/MainView.kt`
```
package co.touchlab.droidcon.ui.util

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import co.touchlab.droidcon.ui.MainComposeView
import co.touchlab.droidcon.viewmodel.WaitForLoadedContextModel

@Composable
fun MainView(waitForLoadedContextModel: WaitForLoadedContextModel) {
    MainComposeView(waitForLoadedContextModel = waitForLoadedContextModel, modifier = Modifier)
}

```

### Core Architecture Module: `shared-ui/src/androidMain/kotlin/co/touchlab/droidcon/ui/util/NavigationBackPressWrapper.kt`
```
package co.touchlab.droidcon.ui.util

import androidx.compose.runtime.Composable

@Composable
internal actual fun NavigationBackPressWrapper(content: @Composable () -> Unit) {
    // For now no back press wrapping is needed on Android.
    content()
}

```

### Core Architecture Module: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/util/Dialog.kt`
```
package co.touchlab.droidcon.ui.util

import androidx.compose.runtime.Composable

@Composable
internal expect fun Dialog(dismiss: () -> Unit, content: @Composable () -> Unit)

```

### Core Architecture Module: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/util/Image.kt`
```
package co.touchlab.droidcon.ui.util

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
expect fun DcAsyncImage(logTag: String, url: String?, contentDescription: String?, modifier: Modifier = Modifier)

@Composable
expect fun InitImageLoader()

```

### Core Architecture Module: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/util/LocalImage.kt`
```
package co.touchlab.droidcon.ui.util

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import co.touchlab.droidcon.ui.theme.Dimensions
import droidcon.shared_ui.generated.resources.Res
import droidcon.shared_ui.generated.resources.about_droidcon
import droidcon.shared_ui.generated.resources.about_kotlin
import droidcon.shared_ui.generated.resources.about_touchlab
import droidcon.shared_ui.generated.resources.linkedin
import droidcon.shared_ui.generated.resources.twitter
import droidcon.shared_ui.generated.resources.venue_map_1
import org.jetbrains.compose.resources.painterResource

@Composable
internal fun LocalImage(
    imageResourceName: String,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
    contentScale: ContentScale = ContentScale.FillWidth,
) {
    val imageRes = when (imageResourceName.lowercase()) {
        "about_droidcon" -> Res.drawable.about_droidcon
        "about_touchlab" -> Res.drawable.about_touchlab
        "about_kotlin" -> Res.drawable.about_kotlin
        "linkedin" -> Res.drawable.linkedin
        "twitter" -> Res.drawable.twitter
        "venue-map-1" -> Res.drawable.venue_map_1
        else -> null
    }
    if (imageRes != null) {
        Image(
            modifier = modifier,
            painter = painterResource(imageRes),
            contentDescription = contentDescription,
            contentScale = contentScale,
        )
    } else {
        Row(
            modifier = modifier.background(MaterialTheme.colorScheme.primary, RoundedCornerShape(Dimensions.Padding.half)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Spacer(modifier = Modifier.weight(1f))
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = contentDescription,
                modifier = Modifier.padding(Dimensions.Padding.half),
                tint = Color.White,
            )
            Text("Image not supported", modifier = Modifier.padding(Dimensions.Padding.default), color = Color.White)
            Spacer(modifier = Modifier.weight(1f))
        }
    }
}

```

### Core Architecture Module: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/util/NavigationBackPressWrapper.kt`
```
package co.touchlab.droidcon.ui.util

import androidx.compose.runtime.Composable

@Composable
internal expect fun NavigationBackPressWrapper(content: @Composable () -> Unit)

```

### Core Architecture Module: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/util/ObserveAsState.kt`
```
package co.touchlab.droidcon.ui.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.neverEqualPolicy
import androidx.compose.runtime.remember
import org.brightify.hyperdrive.multiplatformx.ManageableViewModel
import org.brightify.hyperdrive.multiplatformx.ObservableObject
import org.brightify.hyperdrive.multiplatformx.property.ObservableProperty

/**
 * Observe a view model as its properties change to update the view.
 *
 * Equivalent to [ObservableProperty.observeAsState] for observing all changes in a view model.
 */
@Composable
internal fun <T : ManageableViewModel> T.observeAsState(): State<T> {
    val result = remember(this) { mutableStateOf(this, neverEqualPolicy()) }
    val listener = remember(this) {
        object : ObservableObject.ChangeTracking.Listener {
            override fun onObjectDidChange() {
                result.value = this@observeAsState
            }
        }
    }
    DisposableEffect(this) {
        val token = changeTracking.addListener(listener)
        result.value = this@observeAsState

        onDispose {
            token.cancel()
        }
    }
    return result
}

/**
 * Observe a view model property as it changes to update the view.
 *
 * Equivalent to [collectAsState] for [ObservableProperty].
 */
@Composable
internal fun <T> ObservableProperty<T>.observeAsState(): State<T> {
    val result = remember(this) { mutableStateOf(value, neverEqualPolicy()) }
    val listener = remember(this) {
        object : ObservableProperty.Listener<T> {
            override fun valueDidChange(oldValue: T, newValue: T) {
                result.value = newValue
            }
        }
    }
    DisposableEffect(this) {
        val token = addListener(listener)
        result.value = value

        onDispose {
            token.cancel()
        }
    }
    return result
}

```

### Core Architecture Module: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/util/WebLinkText.kt`
```
package co.touchlab.droidcon.ui.util

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.TextUnit
import co.touchlab.droidcon.dto.WebLink

@Composable
internal fun WebLinkText(
    text: String,
    links: List<WebLink>,
    modifier: Modifier = Modifier,
    normalTextColor: Color = Color.Unspecified,
    fontSize: TextUnit = TextUnit.Unspecified,
    fontStyle: FontStyle? = null,
    fontWeight: FontWeight? = null,
    fontFamily: FontFamily? = null,
    letterSpacing: TextUnit = TextUnit.Unspecified,
    normalTextDecoration: TextDecoration? = null,
    textAlign: TextAlign? = null,
    lineHeight: TextUnit = TextUnit.Unspecified,
    overflow: TextOverflow = TextOverflow.Clip,
    softWrap: Boolean = true,
    maxLines: Int = Int.MAX_VALUE,
    onTextLayout: (TextLayoutResult) -> Unit = {},
    style: TextStyle = LocalTextStyle.current,
) {
    var textLayoutResult by remember { mutableStateOf<TextLayoutResult?>(null) }
    val uriHandler = LocalUriHandler.current
    val annotatedText = buildAnnotatedString {
        val linkStyle = SpanStyle(
            color = MaterialTheme.colorScheme.secondary,
            textDecoration = TextDecoration.Underline,
            fontSize = fontSize,
            fontStyle = fontStyle,
            fontWeight = fontWeight,
            fontFamily = fontFamily,
        )
        val normalStyle = SpanStyle(
            color = normalTextColor,
            textDecoration = normalTextDecoration,
            fontSize = fontSize,
            fontStyle = fontStyle,
            fontWeight = fontWeight,
            fontFamily = fontFamily,
        )

        links
            .sortedBy { it.range.first }
            .forEach { hyperlink ->
                withStyle(style = normalStyle) {
                    append(text.substring(length, hyperlink.range.first))
                }
                withStyle(style = linkStyle) {
                    append(text.substring(hyperlink.range.first, hyperlink.range.last + 1))
                    addStringAnnotation(
                        tag = "URL",
                        annotation = hyperlink.link,
                        start = hyperlink.range.first,
                        end = hyperlink.range.last + 1,
                    )
                }
            }

        withStyle(style = normalStyle) {
            append(text.substring(length))
        }
    }
    Text(
        text = annotatedText,
        modifier = modifier.pointerInput("key") {
            detectTapGestures { offsetPosition ->
                textLayoutResult?.let {
                    val position = it.getOffsetForPosition(offsetPosition)
                    annotatedText
                        .getStringAnnotations(position, position)
                        .firstOrNull()
                        ?.let { result ->
                            uriHandler.openUri(result.item)
                        }
                }
            }
        },
        letterSpacing = letterSpacing,
        textAlign = textAlign,
        lineHeight = lineHeight,
        overflow = overflow,
        softWrap = softWrap,
        maxLines = maxLines,
        onTextLayout = {
            onTextLayout(it)
            textLayoutResult = it
        },
        style = style,
    )
}

```

### Core Architecture Module: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/util/LocalDateTime+startOfMinute.kt`
```
@file:Suppress("ktlint:standard:filename")

package co.touchlab.droidcon.util

import kotlinx.datetime.LocalDateTime

val LocalDateTime.startOfMinute: LocalDateTime
    get() = LocalDateTime(year, month, day, hour, minute)

```

### Core Architecture Module: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/util/NavigationController.kt`
```
package co.touchlab.droidcon.util

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.ExperimentalAnimationApi
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.RememberObserver
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.unit.Constraints
import co.touchlab.droidcon.ui.util.NavigationBackPressWrapper
import co.touchlab.droidcon.ui.util.observeAsState
import org.brightify.hyperdrive.multiplatformx.BaseViewModel
import org.brightify.hyperdrive.multiplatformx.CancellationToken
import org.brightify.hyperdrive.multiplatformx.property.MutableObservableProperty
import org.brightify.hyperdrive.multiplatformx.property.ObservableProperty
import org.brightify.hyperdrive.multiplatformx.property.combine
import org.brightify.hyperdrive.multiplatformx.property.map
import org.brightify.hyperdrive.multiplatformx.property.neverEqualPolicy

private val LocalNavigationController = staticCompositionLocalOf {
    NavigationController.root
}

private val LocalNavigationViewDimensions = staticCompositionLocalOf<NavigationViewDimensions> {
    error("NavigationView hasn't been used.")
}

class NavigationController : BaseViewModel() {

    private val stack = mutableListOf<NavigationStackItem>()
    private var stackTracking: MutableList<NavigationStackItem> by published(stack, equalityPolicy = neverEqualPolicy())
    private val observeStack by observe(::stackTracking)
    private var activeChild: NavigationController? = null

    companion object {

        val root = NavigationController()
    }

    internal sealed class NavigationStackItem {
        class BackPressHandler(val onBackPressed: BackPressHandlerScope.() -> Unit) : NavigationStackItem() {

            override fun toString(): String = "BackPress@${hashCode().toUInt().toString(16)}"
        }

        class Push<T : Any>(val item: MutableObservableProperty<T?>, val content: @Composable (T) -> Unit) : NavigationStackItem() {

            override fun toString(): String =
                "Push(${item.value}@${item.hashCode().toUInt().toString(16)})@${hashCode().toUInt().toString(16)}"
        }
    }

    class BackPressHandlerScope {

        var isSkipped = false
            private set

        fun skip() {
            isSkipped = true
        }
    }

    fun handleBackPress(): Boolean {
        val activeChild = activeChild

        return if (activeChild != null && activeChild.handleBackPress()) {
            true
        } else {
            pop()
        }
    }

    private fun pop(defer: Int = 0): Boolean {
        val currentIndex = stack.count() - 1 - defer
        return when (val top = stack.getOrNull(currentIndex)) {
            is NavigationStackItem.BackPressHandler -> {
                val scope = BackPressHandlerScope()
                top.onBackPressed(scope)
                if (scope.isSkipped) {
                    pop(defer + 1)
                } else {
                    true
                }
            }

            is NavigationStackItem.Push<*> ->
                if (top.item.value != null) {
                    stack.removeAt(currentIndex)
                    top.item.value = null
                    true
                } else {
                    pop(defer + 1)
                }

            null -> false
        }
    }

    fun branch(child: NavigationController): CancellationToken {
        activeChild = child
        return CancellationToken {
            if (activeChild === child) {
                activeChild = null
            }
        }
    }

    @Composable
    internal fun PushedStack(itemModifier: Modifier = Modifier) {
        val currentStack by observeStack.observeAsState()

        var i = 0
        while (i < currentStack.count()) {
            when (val item = currentStack[i++]) {
                is NavigationStackItem.BackPressHandler -> continue
                is NavigationStackItem.Push<*> -> PushedStackItem(item, itemModifier)
            }
        }
    }

    @Composable
    private fun <T : Any> PushedStackItem(item: NavigationStackItem.Push<T>, itemModifier: Modifier) {
        println("$item")
        val itemValue by item.item.observeAsState()

        itemValue?.let {
            Surface(modifier = itemModifier) {
                item.content(it)
            }
        }
    }

    @Composable
    internal fun <T : Any> Pushed(item: MutableObservableProperty<T?>, content: @Composable (T) -> Unit) {
        remember {
            val stackItem = NavigationStackItem.Push(item, content).also {
                notifyingStackChange {
                    stack.add(it)
                }
            }
            ReferenceTracking {
                notifyingStackChange {
                    stack.remove(stackItem)
                }
            }
        }
    }

    @Composable
    internal fun HandleBackPressEffect(onBackPressed: BackPressHandlerScope.() -> Unit) {
        remember {
            val stackItem = NavigationStackItem.BackPressHandler(onBackPressed).also {
                stack.add(it)
            }
            ReferenceTracking {
                stack.remove(stackItem)
            }
        }
    }

    private inline fun <T> notifyingStackChange(block: () -> T): T {
        val result = block()
        observeStack.value = stack
        return result
    }
}

internal data class NavigationViewDimensions(val constraints: Constraints)

@Composable
internal fun rememberNavigationController(): NavigationController = remember {
    NavigationController()
}

private class ReferenceTracking(private val onDispose: () -> Unit) : RememberObserver {

    private var refCount: Int = 0

    override fun onAbandoned() {
        onDispose()
    }

    override fun onForgotten() {
        refCount -= 1
        if (refCount <= 0) {
            onDispose()
        }
    }

    override fun onRemembered() {
        refCount += 1
    }
}

@Composable
internal fun BackPressHandler(onBackPressed: NavigationController.BackPressHandlerScope.() -> Unit) {
    val navigationController = LocalNavigationController.current
    navigationController.HandleBackPressEffect(onBackPressed)
}

internal interface NavigationStackScope {

    fun <T : Any> navigationLink(item: MutableObservableProperty<T?>, content: @Composable (T) -> Unit)
}

internal class NavigationLinkWrapper<T : Any>(
    val index: Int,
    private val value: T?,
    private val reset: () -> Unit,
    private val content: @Composable (T) -> Unit,
) {

    val body: (@Composable () -> Unit)?
        get() = value?.let { value ->
            @Composable {
                BackPressHandler {
                    reset()
                }
                NavigationBackPressWrapper {
                    content(value)
                }
            }
        }

    override fun equals(other: Any?): Boolean = (other as? NavigationLinkWrapper<*>)?.let {
        it.index == index && it.value == value
    } ?: false

    override fun hashCode(): Int = listOfNotNull(index, value).hashCode()
}

@OptIn(ExperimentalAnimationApi::class)
@Composable
internal fun NavigationStack(key: Any?, links: NavigationStackScope.() -> Unit, content: @Composable () -> Unit) {
    val activeLinkComposables by remember(key) {
        val constructedLinks = mutableListOf<ObservableProperty<NavigationLinkWrapper<*>>>()
        val scope = object : NavigationStackScope {
            override fun <T : Any> navigationLink(item: MutableObservableProperty<T?>, content: @Composable (T) -> Unit) {
                constructedLinks.add(
                    item.map {
                        NavigationLinkWrapper(index = constructedLinks.size, value = it, reset = { item.value = null }, content)
                    },
                )
            }
        }
        scope.links()

        combine(constructedLinks)
    }.observeAsState()

    AnimatedContent(
        targetState = activeLinkComposables,
        transitionSpec = {
            val initialDepth = initialState.indexOfLast { it.body != null }
            val targetDepth = targetState.indexOfLast { it.body != null }

            if (initialDepth == -1 && targetDepth == -1) {
                EnterTransition.None.togetherWith(ExitTransition.None)
            } else if (initialDepth < targetDepth) {
                slideInHorizontally(initialOffsetX = { it }).togetherWith(slideOutHorizontally(targetOffsetX = { -it }))
            } else {
                slideInHorizontally(initialOffsetX = { -it }).togetherWith(slideOutHorizontally(targetOffsetX = { it }))
            }
        },
        contentAlignment = Alignment.BottomCenter,
    ) { activeComposables ->
        SubcomposeLayout(
            measurePolicy = { constraints ->
                val layoutWidth = constraints.maxWidth
                val layoutHeight = constraints.maxHeight

                val looseConstraints = constraints.copy(minWidth = 0, minHeight = 0)

                layout(layoutWidth, layoutHeight) {
                    val contentMeasurable = subcompose(-1, content)

                    val linkMeasurables = activeComposables.mapNotNull { wrapper ->
                        wrapper.body?.let { subcompose(wrapper.index, it) }
                    }

                    val activeMeasurables = linkMeasurables.lastOrNull() ?: contentMeasurable

                    activeMeasurables.forEach {
                        it.measure(looseConstraints).place(x = 0, y = 0)
                    }
        
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #18** (2018-11-19): **Rsvp indicator doesn't always refresh after being clicked.**
  *Symptoms*: Sometimes when you click the rsvp fab it'll clear the icon but never show the new state

- **Issue #13** (2018-08-21): **Schedule view doesn't retain selected tab when navigating back from detail view**
  *Symptoms*: When you select day 2 and navigate to a session, going back resets the selected tab. It looks like the tab control just "forgets" the current selection. Probably something in the fragment lifecycle.

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

### Incident Patch 1: `ef8e6d8e` (2025-10-29)
**Commit Message**: Fix system bars on Android.

**File**: `android/build.gradle.kts` (modified, +0/-1)
```diff
@@ -83,7 +83,6 @@ dependencies {
     implementation(libs.koin.android)
     implementation(libs.kotlinx.datetime)
     implementation(libs.coil.compose)
-    implementation(libs.accompanist.navigationAnimation)
     implementation(platform(libs.firebase.bom))
     implementation(libs.firebase.analytics)
     implementation(libs.firebase.crashlytics)
```

**File**: `android/src/main/java/co/touchlab/droidcon/android/MainActivity.kt` (modified, +3/-0)
```diff
@@ -7,6 +7,7 @@ import android.os.Build
 import android.os.Bundle
 import androidx.activity.ComponentActivity
 import androidx.activity.compose.setContent
+import androidx.activity.enableEdgeToEdge
 import androidx.activity.result.contract.ActivityResultContracts
 import androidx.compose.animation.Crossfade
 import androidx.compose.foundation.Image
@@ -69,6 +70,8 @@ class MainActivity :
         // Do the minimal setup needed for launching the app
         WindowCompat.setDecorFitsSystemWindows(window, false)
 
+        enableEdgeToEdge()
+
         // Set up the UI immediately
         setContent {
             MainView(waitForLoadedContextModel = waitForLoadedContextModel)
```

**File**: `android/src/main/res/values/themes.xml` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@
         <item name="postSplashScreenTheme">@style/Theme.Droidcon</item>
     </style>
 
-    <style name="Theme.Droidcon" parent="Theme.Material.DayNight.NoActionBar"></style>
+    <style name="Theme.Droidcon" parent="Theme.Material.DayNight.NoActionBar"/>
 
     <style name="Theme.Material.DayNight.NoActionBar" parent="@android:style/Theme.Material.Light.NoActionBar" />
-</resources>
\ No newline at end of file
+</resources>
```

**File**: `gradle/libs.versions.toml` (modified, +1/-3)
```diff
@@ -30,10 +30,9 @@ gms-google-services = "4.4.2"
 # TODO: Update Compose libraries. There is currently a conflicing issue with the HorizontalPager
 compose-androidx-ui = "1.7.8"
 compose-compiler = "1.5.15"
-composeNavigation = "2.8.9"
+composeNavigation = "2.9.5"
 compose-jb = "1.7.3"
 
-accompanistNavigationAnimation = "0.36.0"
 splashscreen = "1.0.1"
 junit = "4.13.2"
 junitKtx = "1.2.1"
@@ -59,7 +58,6 @@ sqliter = { module = "co.touchlab:sqliter-driver", version.ref = "sqliter" }
 compose-compiler = { module = "androidx.compose.compiler:compiler", version.ref = "compose-compiler" }
 androidx-core-splashscreen = { module = "androidx.core:core-splashscreen", version.ref = "splashscreen" }
 
-accompanist-navigationAnimation = { module = "com.google.accompanist:accompanist-navigation-animation", version.ref = "accompanistNavigationAnimation" }
 firebase-bom = { module = "com.google.firebase:firebase-bom", version.ref = "firebase-bom" }
 firebase-analytics = { module = "com.google.firebase:firebase-analytics-ktx", version = "_" }
 firebase-crashlytics = { module = "com.google.firebase:firebase-crashlytics-ktx", version = "_" }
```

**File**: `shared-ui/src/androidMain/kotlin/co/touchlab/droidcon/ui/util/MainView.kt` (modified, +1/-2)
```diff
@@ -1,12 +1,11 @@
 package co.touchlab.droidcon.ui.util
 
-import androidx.compose.foundation.layout.systemBarsPadding
 import androidx.compose.runtime.Composable
 import androidx.compose.ui.Modifier
 import co.touchlab.droidcon.ui.MainComposeView
 import co.touchlab.droidcon.viewmodel.WaitForLoadedContextModel
 
 @Composable
 fun MainView(waitForLoadedContextModel: WaitForLoadedContextModel) {
-    MainComposeView(waitForLoadedContextModel = waitForLoadedContextModel, modifier = Modifier.systemBarsPadding())
+    MainComposeView(waitForLoadedContextModel = waitForLoadedContextModel, modifier = Modifier)
 }
```

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/BottomNavigationView.kt` (modified, +2/-2)
```diff
@@ -59,8 +59,8 @@ internal fun BottomNavigationView(viewModel: ApplicationViewModel, currentConfer
                 }
             }
         },
-    ) { paddingValues ->
-        Box(modifier = Modifier.padding(bottom = paddingValues.calculateBottomPadding())) {
+    ) { innerPadding ->
+        Box(modifier = Modifier.padding(bottom = innerPadding.calculateBottomPadding())) {
             when (selectedTab) {
                 ApplicationViewModel.Tab.Schedule -> SessionListView(
                     viewModel = viewModel.schedule,
```

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/session/SessionListView.kt` (modified, +2/-2)
```diff
@@ -78,12 +78,12 @@ internal fun SessionListView(viewModel: BaseSessionListViewModel, title: String,
                     scrollBehavior = scrollBehavior,
                 )
             },
-        ) { paddingValues ->
+        ) { innerPadding ->
             var size by remember { mutableStateOf(IntSize(0, 0)) }
             Column(
                 modifier = Modifier
                     .onSizeChanged { size = it }
-                    .padding(top = paddingValues.calculateTopPadding()),
+                    .padding(top = innerPadding.calculateTopPadding()),
             ) {
                 val days by viewModel.observeDays.observeAsState()
                 if (days?.isEmpty() != false) {
```

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/theme/Theme.kt` (modified, +4/-3)
```diff
@@ -16,9 +16,10 @@ private val DarkColorScheme = darkColorScheme(
 
 @Composable
 internal fun DroidconTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
-    val colorScheme = when {
-        darkTheme -> DarkColorScheme
-        else -> LightColorScheme
+    val colorScheme = if (darkTheme) {
+        DarkColorScheme
+    } else {
+        LightColorScheme
     }
 
     MaterialTheme(
```

---

### Incident Patch 2: `461bda45` (2025-10-29)
**Commit Message**: Fix RND-463.

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/FirstRunConferenceSelector.kt` (modified, +51/-47)
```diff
@@ -2,6 +2,7 @@ package co.touchlab.droidcon.ui
 
 import androidx.compose.foundation.background
 import androidx.compose.foundation.clickable
+import androidx.compose.foundation.isSystemInDarkTheme
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.Row
 import androidx.compose.foundation.layout.fillMaxWidth
@@ -11,13 +12,15 @@ import androidx.compose.foundation.lazy.items
 import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.material3.MaterialTheme
 import androidx.compose.material3.RadioButton
+import androidx.compose.material3.Surface
 import androidx.compose.material3.Text
 import androidx.compose.runtime.Composable
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.Dialog
 import co.touchlab.droidcon.domain.entity.Conference
+import co.touchlab.droidcon.ui.theme.DroidconTheme
 
 @Composable
 fun FirstRunConferenceSelector(
@@ -27,56 +30,57 @@ fun FirstRunConferenceSelector(
     selectedConference: Conference? = null,
 ) {
     Dialog(onDismissRequest = onDismiss) {
-        Column(
-            modifier = Modifier
-                .fillMaxWidth()
-                .background(
-                    color = MaterialTheme.colorScheme.surface,
-                    shape = RoundedCornerShape(16.dp),
-                )
-                .padding(16.dp),
+        Surface(
+            shape = RoundedCornerShape(16.dp),
         ) {
-            Text(
-                text = "Welcome to Droidcon!",
-                style = MaterialTheme.typography.headlineSmall,
-                modifier = Modifier.padding(bottom = 16.dp),
-            )
+            Column(
+                modifier = Modifier
+                    .fillMaxWidth()
+                    .padding(16.dp),
+            ) {
+                Text(
+                    text = "Welcome to Droidcon!",
+                    style = MaterialTheme.typography.headlineSmall,
+                    color = MaterialTheme.colorScheme.onBackground,
+                    modifier = Modifier.padding(bottom = 16.dp),
+                )
 
-            Text(
-                text = "Please select a conference to get started:",
-                style = MaterialTheme.typography.bodyMedium,
-                modifier = Modifier.padding(bottom = 16.dp),
-            )
+                Text(
+                    text = "Please select a conference to get started:",
+                    style = MaterialTheme.typography.bodyMedium,
+                    modifier = Modifier.padding(bottom = 16.dp),
+                )
 
-            LazyColumn {
-                items(conferences) { conference ->
-                    val isSelected = conference.id == selectedConference?.id
-                    Row(
-                        modifier = Modifier
-                            .fillMaxWidth()
-                            .clickable {
-                                // Explicitly call selection function
-                                onConferenceSelected(conference)
-                            }
-                            .padding(vertical = 8.dp),
-                        verticalAlignment = Alignment.CenterVertically,
-                    ) {
-                        RadioButton(
-                            selected = isSelected,
-                            onClick = {
-                                // Handle radio button click separately
-                                onConferenceSelected(conference)
-                            },
-                        )
-                        Text(
-                            text = if (isSelected) {
-                                "${conference.name} (Selected)"
-                            } else {
-                                conference.name
-                            },
-                            style = MaterialTheme.typography.bodyLarge,
-                            modifier = Modifier.padding(start = 8.dp),
-                        )
+                LazyColumn {
+                    items(conferences) { conference ->
+                        val isSelected = conference.id == selectedConference?.id
+                        Row(
+                            modifier = Modifier
+                                .fillMaxWidth()
+                                .clickable {
+                                    // Explicitly call selection function
+                                    onConferenceSelected(conference)
+                                }
+                                .padding(vertical = 8.dp),
+                            verticalAlignment = Alignment.CenterVertically,
+                        ) {
+                            RadioButton(
+                                selected = isSelected,
+                                onClick = {
+                                    // Handle radio button click separately
+                            
```

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/MainComposeView.kt` (modified, +3/-1)
```diff
@@ -86,7 +86,9 @@ private fun MainAppBody(waitForLoadedContextModel: WaitForLoadedContextModel, se
         }
 
         if (conferences.size == 1) {
-            onConferenceSelected(conferences.get(0))
+            LaunchedEffect(conferences) {
+                onConferenceSelected(conferences.first())
+            }
         } else if (conferences.size > 1) {
             FirstRunConferenceSelector(
                 conferences = conferences,
```

---

### Incident Patch 3: `b4587a4f` (2025-06-18)
**Commit Message**: Fix initial data

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 
 # Built application files
 *.apk
+*.aab
 *.ap_
 
 # Files for the ART/Dalvik VM
```

**File**: `LINEAR_CONTEXT.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+# Linear Context
+
+## Team: General R&D
+- ID: 5f4d7646-b07e-4129-83de-72f88ed88f58
+
+## Product: Droidcon
+- ID: 0dfbe33b-dac4-4a2e-a0f7-0e36bec5fcdf
\ No newline at end of file
```

**File**: `android/build.gradle.kts` (modified, +2/-2)
```diff
@@ -26,8 +26,8 @@ android {
         applicationId = "com.droidcon.app"
         minSdk = libs.versions.minSdk.get().toInt()
         targetSdk = libs.versions.targetSdk.get().toInt()
-        versionCode = 10000
-        versionName = "1.0.0"
+        versionCode = 10001
+        versionName = "1.0.1"
         testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
     }
     packaging {
```

**File**: `shared/src/commonMain/sqldelight/co/touchlab/droidcon/db/Conference.sq` (modified, +1/-31)
```diff
@@ -53,37 +53,7 @@ changeSelectedConference {
 }
 
 INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon London 2024", "Europe/London", "droidcon-148cc", "sponsors-london-2024", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "78xrdv22", 1, 1);
--- Add NYC 2024
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon NYC 2024", "America/New_York", "droidcon-148cc", "sponsors-nyc-2024", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "orzenzbc", 0, 1);
--- Add London 2023
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon London 2023", "Europe/London", "droidcon-148cc", "sponsors-london-2023", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "64k7lmps", 0, 1);
--- Add NYC 2023
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon NY 2023", "America/New_York", "droidcon-148cc", "sponsors-nyc-2023", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "gxz4vyyr", 0, 1);
--- Add SF 2023
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon SF 2023", "America/Los_Angeles", "droidcon-148cc", "sponsors-sf-2023", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "eewr8kdk", 0, 1);
--- Add London 2022
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon London 2022", "Europe/London", "droidcon-148cc", "sponsors-london-2022", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "qi0g29hw", 0, 1);
--- Add New York 2022
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon New York 2022", "America/New_York", "droidcon-148cc", "sponsors-nyc-2022", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "xh3jkd5m", 0, 1);
--- Add Berlin 2022
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon Berlin 2022", "Europe/Berlin", "droidcon-148cc", "sponsors-berlin-2022", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "zwd2wtgt", 0, 1);
--- Add SF 2022
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon SF 2022", "America/Los_Angeles", "droidcon-148cc", "sponsors-sf-2022", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "qx6mydae", 0, 1);
--- Add London 2021
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon London 2021", "Europe/London", "droidcon-148cc", "sponsors-london-2021", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "4b752cf5", 0, 1);
--- Add Berlin 2021
-INSERT INTO conferenceTable(conferenceName, conferenceTimeZone, projectId, collectionName, apiKey, scheduleId, selected, active)
-VALUES ("Droidcon Berlin 2021", "Europe/Berlin", "droidcon-148cc", "sponsors-berlin-2021", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "2wi6ppp2", 0, 1);
+VALUES ("Droidcon NYC 2025", "America/New_York", "droidcon-148cc", "sponsors-nyc-2025", "AIzaSyCkD5DH2rUJ8aZuJzANpIFj0AVuCNik1l0", "4lffd9w7", 1, 1);
 
 lastInsertRowId:
 SELECT last_insert_rowid();
\ No newline at end of file
```

---

### Incident Patch 4: `53758589` (2025-05-08)
**Commit Message**: Fix the uncaught exception when syncing conferences (#244) (#245)

* Fix the uncaught exception when syncing conferences (#244)

* Format the code

**File**: `android/src/main/java/co/touchlab/droidcon/android/MainActivity.kt` (modified, +2/-1)
```diff
@@ -154,7 +154,8 @@ class MainActivity :
         if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
             if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                 // Permissions already granted, nothing to do
-            } else if (/* DISABLED: */ false && shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
+            } else if (false && shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
+                /* DISABLED: */
                 // TODO: Not implemented yet: display an educational UI explaining to the user the features that will be enabled
                 //       by them granting the POST_NOTIFICATION permission. This UI should provide the user
                 //       "OK" and "No thanks" buttons. If the user selects "OK," directly request the permission.
```

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/viewmodel/WaitForLoadedContextModel.kt` (modified, +8/-7)
```diff
@@ -4,6 +4,7 @@ import co.touchlab.droidcon.application.gateway.SettingsGateway
 import co.touchlab.droidcon.domain.entity.Conference
 import co.touchlab.droidcon.domain.service.ConferenceConfigProvider
 import co.touchlab.droidcon.domain.service.SyncService
+import co.touchlab.kermit.Logger
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.IO
 import kotlinx.coroutines.flow.MutableStateFlow
@@ -27,22 +28,22 @@ class WaitForLoadedContextModel(
     val state: StateFlow<State> = _state
     val applicationViewModel by managed(applicationViewModelFactory.create())
 
+    private val log = Logger.withTag("WaitForLoadedContextModel")
+
     suspend fun monitorConferenceChanges() {
         conferenceConfigProvider.loadSelectedConference()
     }
 
     suspend fun watchConferenceChanges() {
-        val isFirstRun = settingsGateway.settings().value.isFirstRun
         lifecycle.whileAttached {
-            if (isFirstRun) {
-                withContext(Dispatchers.IO) {
-                    syncService.syncConferences()
-                }
-            } else {
-                launch {
+            withContext(Dispatchers.IO) {
+                try {
                     syncService.syncConferences()
+                } catch (e: Exception) {
+                    log.e(e) { "Failed to sync conferences" }
                 }
             }
+
             launch {
                 conferenceConfigProvider.observeChanges().collect { conference ->
                     _state.emit(State.Ready(conference))
```

**File**: `shared/src/commonMain/kotlin/co/touchlab/droidcon/domain/service/impl/DefaultSyncService.kt` (modified, +34/-32)
```diff
@@ -334,39 +334,41 @@ class DefaultSyncService(
             Pair(date, dateFromString(adjustedInstant.toString()))
         }.toMap()
 
-        fun updateDateTimeString(dateTimeString: String): String {
-            return originalToAdjustedDateMap.get(dateFromString(dateTimeString)) + "T" + timeFromString(dateTimeString)
-        }
-
-        val days = kotlin.runCatching { if(testNotificationTimes) {
-            _days.map { originalDay ->
-                ScheduleDto.DayDto(
-                    originalToAdjustedDateMap.get(dateFromString(originalDay.date))!!,
-                    originalDay.rooms.map { room ->
-                        ScheduleDto.RoomDto(
-                            room.id, room.name,
-                            room.sessions.map { originalSession ->
-                                ScheduleDto.SessionDto(
-                                    id = originalSession.id,
-                                    title = originalSession.title,
-                                    description = originalSession.description,
-                                    startsAt = updateDateTimeString(originalSession.startsAt),
-                                    endsAt = updateDateTimeString(originalSession.endsAt),
-                                    isServiceSession = originalSession.isServiceSession,
-                                    isPlenumSession = originalSession.isPlenumSession,
-                                    speakers = originalSession.speakers,
-                                    categories = originalSession.categories,
-                                    roomID = originalSession.roomID,
-                                    room = originalSession.room,
-                                )
-                            },
-                        )
-                    },
-                )
+        fun updateDateTimeString(dateTimeString: String): String =
+            originalToAdjustedDateMap.get(dateFromString(dateTimeString)) + "T" + timeFromString(dateTimeString)
+
+        val days = kotlin.runCatching {
+            if (testNotificationTimes) {
+                _days.map { originalDay ->
+                    ScheduleDto.DayDto(
+                        originalToAdjustedDateMap.get(dateFromString(originalDay.date))!!,
+                        originalDay.rooms.map { room ->
+                            ScheduleDto.RoomDto(
+                                room.id,
+                                room.name,
+                                room.sessions.map { originalSession ->
+                                    ScheduleDto.SessionDto(
+                                        id = originalSession.id,
+                                        title = originalSession.title,
+                                        description = originalSession.description,
+                                        startsAt = updateDateTimeString(originalSession.startsAt),
+                                        endsAt = updateDateTimeString(originalSession.endsAt),
+                                        isServiceSession = originalSession.isServiceSession,
+                                        isPlenumSession = originalSession.isPlenumSession,
+                                        speakers = originalSession.speakers,
+                                        categories = originalSession.categories,
+                                        roomID = originalSession.roomID,
+                                        room = originalSession.room,
+                                    )
+                                },
+                            )
+                        },
+                    )
+                }
+            } else {
+                _days
             }
-        } else {
-            _days
-        }}.let { result ->
+        }.let { result ->
             result.getOrThrow()
         }
 
```

---

### Incident Patch 5: `613661bd` (2025-03-31)
**Commit Message**: Fix agenda

**File**: `shared/src/commonMain/kotlin/co/touchlab/droidcon/domain/gateway/impl/DefaultSessionGateway.kt` (modified, +3/-1)
```diff
@@ -30,7 +30,9 @@ class DefaultSessionGateway(
         }
     }
 
-    override fun observeAgenda(): Flow<List<ScheduleItem>> = sessionRepository.observeAllAttending(conferenceId).map { sessions ->
+    override fun observeAgenda(): Flow<List<ScheduleItem>> = conferenceConfigProvider.observeChanges().flatMapLatest { conf ->
+        sessionRepository.observeAllAttending(conf.id)
+    }.map { sessions ->
         sessions.map { session ->
             scheduleItemForSession(session)
         }
```

---

### Incident Patch 6: `c17ab03d` (2024-12-12)
**Commit Message**: Add workflow for wrapper check and building ios and android (#232)

**File**: `.github/workflows/build.yml` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+name: Build
+on:
+  pull_request:
+  push:
+    branches: [ main ] # Trigger on pushes to the main branch
+  workflow_dispatch:
+
+jobs:
+  build:
+    runs-on: macos-latest
+    steps:
+      - name: Checkout source code
+        uses: actions/checkout@v4
+
+      - name: Set up JDK 17
+        uses: actions/setup-java@v4
+        with:
+          java-version: '17'
+          distribution: 'corretto'
+
+      - name: Setup Gradle
+        uses: gradle/actions/setup-gradle@v4
+
+      - name: Setup Android SDK
+        uses: android-actions/setup-android@v3
+
+      - name: Check, Assemble Android and compile iOS
+        run: ./gradlew ktlintCheck assembleDebug compileKotlinIosX64 --no-daemon
\ No newline at end of file
```

**File**: `.github/workflows/gradle-wrapper.yaml` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+name: gradle-wrapper
+
+on:
+  pull_request:
+    paths:
+      - 'gradlew'
+      - 'gradlew.bat'
+      - 'gradle/wrapper/**'
+
+jobs:
+  validate:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: gradle/actions/wrapper-validation@v4
```

**File**: `.github/workflows/ktlint.yml` (removed, +0/-17)
```diff
@@ -1,17 +0,0 @@
-name: ktlint
-
-on:
-  pull_request:
-
-jobs:
-  ktlint:
-    runs-on: ubuntu-latest
-    steps:
-      - name: Checkout source code
-        uses: actions/checkout@v3
-      - uses: actions/setup-java@v3
-        with:
-          distribution: "adopt"
-          java-version: "17"
-      - name: run ktlint
-        run: ./gradlew ktlintCheck
```

**File**: `android/build.gradle.kts` (modified, +7/-0)
```diff
@@ -95,3 +95,10 @@ dependencies {
 
     coreLibraryDesugaring(libs.android.desugar)
 }
+
+// Function that copies `mock` JSON config file for google-services if there isn't one available
+// Google-services plugin requires this config file to build
+val googleServices = file("google-services.json")
+if (!googleServices.exists()) {
+    file("mock-google-services.json").copyTo(googleServices, overwrite = false)
+}
```

**File**: `android/mock-google-services.json` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+{
+  "project_info": {
+    "project_number": "606665771234",
+    "project_id": "mock-firebase-project",
+    "storage_bucket": "mock-firebase-project.appspot.com"
+  },
+  "client": [
+    {
+      "client_info": {
+        "mobilesdk_app_id": "1:606665771229:android:c1f0f09aa42abc12",
+        "android_client_info": {
+          "package_name": "co.touchlab.droidcon.london"
+        }
+      },
+      "oauth_client": [
+        {
+          "client_id": "123455771229-sc9bpuefbjceq7i1qabk7gssstefrdlv.apps.googleusercontent.com",
+          "client_type": 1,
+          "android_info": {
+            "package_name": "co.touchlab.droidcon.london",
+            "certificate_hash": "7f254b538565cfe6c28a88744985f015b1534980"
+          }
+        },
+        {
+          "client_id": "123455771229-sc9bpuefbjceq7i1qabk7gssstefrdlv.apps.googleusercontent.com",
+          "client_type": 3
+        }
+      ],
+      "api_key": [
+        {
+          "current_key": "AIzaSyCNzhU2a9gMc_JHurHbywOrRI9Vj4VQZZZ"
+        }
+      ],
+      "services": {
+        "appinvite_service": {
+          "other_platform_oauth_client": [
+            {
+              "client_id": "413392989754-04u9tv32474rj0pmbfksirt4ti02a64r.apps.googleusercontent.com",
+              "client_type": 3
+            }
+          ]
+        }
+      }
+    }
+  ],
+  "configuration_version": "1"
+}
\ No newline at end of file
```

---

### Incident Patch 7: `9464d59f` (2024-10-25)
**Commit Message**: Fixup iOS launch screen.

**File**: `ios/Droidcon/Droidcon/Assets.xcassets/LaunchScreen/LaunchScreen_Icon.imageset/London 24-Splash screen.svg` (modified, +0/-1)
```diff
@@ -44,7 +44,6 @@
       }
     </style>
   </defs>
-  <rect class="cls-6" x="-3.4" y="-2" width="1284.4" height="1923.9"/>
   <path class="cls-6" d="M974.3,554v-58.9c66.6,0,120.5,57,120.5,127.4h-55.7c0-37.9-29-68.5-64.8-68.5"/>
   <path class="cls-7" d="M620,1329.5c-8.8,0-15.9-7.1-15.9-15.9s7.1-15.9,15.9-15.9,15.9,7.1,15.9,15.9-7.1,15.9-15.9,15.9h0M620,1284c-16.3,0-29.5,13.2-29.5,29.6s13.2,29.5,29.5,29.5,29.5-13.2,29.5-29.5h0c0-16.3-13.2-29.5-29.5-29.6"/>
   <path class="cls-7" d="M401.6,1329.5c-8.8,0-15.9-7.1-15.9-15.9s7.1-15.9,15.9-15.9,15.9,7.1,15.9,15.9h0c0,8.8-7.1,15.9-15.9,15.9q.1,0,0,0M401.6,1284c-16.3,0-29.6,13.2-29.6,29.5s13.2,29.6,29.5,29.6,29.6-13.2,29.6-29.5h0c.1-16.3-13.1-29.5-29.5-29.6"/>
```

**File**: `ios/Droidcon/Droidcon/Base.lproj/LaunchScreen.storyboard` (modified, +8/-8)
```diff
@@ -1,9 +1,9 @@
 <?xml version="1.0" encoding="UTF-8"?>
-<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="21507" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
+<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="23094" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
     <device id="retina6_0" orientation="portrait" appearance="light"/>
     <dependencies>
         <deployment identifier="iOS"/>
-        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="21505"/>
+        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="23084"/>
         <capability name="Named colors" minToolsVersion="9.0"/>
         <capability name="Safe area layout guides" minToolsVersion="9.0"/>
         <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
@@ -17,18 +17,18 @@
                         <rect key="frame" x="0.0" y="0.0" width="390" height="844"/>
                         <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                         <subviews>
-                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" horizontalHuggingPriority="251" verticalHuggingPriority="251" misplaced="YES" image="LaunchScreen_Icon" translatesAutoresizingMaskIntoConstraints="NO" id="0IB-ED-diD">
-                                <rect key="frame" x="41" y="102" width="308" height="640"/>
+                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" horizontalHuggingPriority="251" verticalHuggingPriority="251" image="LaunchScreen_Icon" translatesAutoresizingMaskIntoConstraints="NO" id="0IB-ED-diD">
+                                <rect key="frame" x="0.0" y="136" width="390" height="585"/>
                                 <constraints>
-                                    <constraint firstAttribute="width" secondItem="0IB-ED-diD" secondAttribute="height" multiplier="850:1395" id="Vc0-BB-0qz"/>
+                                    <constraint firstAttribute="width" secondItem="0IB-ED-diD" secondAttribute="height" multiplier="1280:1920" id="Vc0-BB-0qz"/>
                                 </constraints>
                             </imageView>
                         </subviews>
                         <viewLayoutGuide key="safeArea" id="6Tk-OE-BBY"/>
                         <color key="backgroundColor" name="LaunchScreen_Background"/>
                         <constraints>
                             <constraint firstItem="0IB-ED-diD" firstAttribute="bottom" relation="lessThanOrEqual" secondItem="6Tk-OE-BBY" secondAttribute="bottom" constant="20" id="3vk-mZ-Hfl"/>
-                            <constraint firstItem="0IB-ED-diD" firstAttribute="width" relation="lessThanOrEqual" secondItem="Ze5-6b-2t3" secondAttribute="width" multiplier="0.75" id="JW2-eP-WpG"/>
+                            <constraint firstItem="0IB-ED-diD" firstAttribute="width" relation="lessThanOrEqual" secondItem="Ze5-6b-2t3" secondAttribute="width" id="JW2-eP-WpG"/>
                             <constraint firstItem="0IB-ED-diD" firstAttribute="trailing" relation="lessThanOrEqual" secondItem="6Tk-OE-BBY" secondAttribute="trailing" id="Tg9-6c-cLR"/>
                             <constraint firstItem="0IB-ED-diD" firstAttribute="centerX" secondItem="6Tk-OE-BBY" secondAttribute="centerX" id="lgz-oM-RlH"/>
                             <constraint firstItem="0IB-ED-diD" firstAttribute="centerY" secondItem="6Tk-OE-BBY" secondAttribute="centerY" id="pAQ-Ys-gJI"/>
@@ -42,9 +42,9 @@
         </scene>
     </scenes>
     <resources>
-        <image name="LaunchScreen_Icon" width="426.66665649414062" height="640"/>
+        <image name="LaunchScreen_Icon" width="1280" height="1920"/>
         <namedColor name="LaunchScreen_Background">
-            <color red="0.98039215686274506" green="0.43137254901960786" blue="0.31372549019607843" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
+            <color red="0.49019607843137253" green="0.88235294117647056" blue="0.76470588235294112" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
         </namedColor>
     </resources>
 </document>
```

---

### Incident Patch 8: `2ccf31ab` (2024-10-22)
**Commit Message**: Revert "updating splash screen"

This reverts commit 57c121b897e99afa5bde18438d66b3f878de40fd.

**File**: `ios/Droidcon/Droidcon/Assets.xcassets/LaunchScreen/LaunchScreen_Icon.imageset/Contents.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "images" : [
     {
-      "filename" : "ic_splash_screen.svg",
+      "filename" : "london24-splash-screen.png",
       "idiom" : "universal"
     }
   ],
```

**File**: `ios/Droidcon/Droidcon/Assets.xcassets/LaunchScreen/LaunchScreen_Icon.imageset/ic_splash_screen.svg` (removed, +0/-94)
```diff
@@ -1,94 +0,0 @@
-<?xml version="1.0" encoding="UTF-8" standalone="no"?>
-<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
-<svg width="100%" height="100%" viewBox="0 0 1280 1920" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;">
-    <rect id="path_0" x="-3.4" y="-2" width="1284.4" height="1923.9" style="fill:rgb(125,225,195);fill-rule:nonzero;"/>
-    <path id="path_1" d="M974.3,554L974.3,495.1C1040.9,495.1 1094.8,552.1 1094.8,622.5L1039.1,622.5C1039.1,584.6 1010.1,554 974.3,554" style="fill:rgb(125,225,195);fill-rule:nonzero;"/>
-    <path id="path_2" d="M1089.8,347C1086.8,329.5 1076,314.2 1060.3,305.7L1056.7,303.9C1040.6,296.7 1022.3,296.7 1006.2,303.9L1002.7,305.7C987.1,314.2 976.2,329.5 973.2,347L1089.8,347ZM963.8,351C965.6,330.2 977,311.5 994.6,300.2L986.3,285.8C984.5,282.7 985.6,278.7 988.7,276.9C991.8,275.1 995.8,276.1 997.6,279.2C997.6,279.2 997.6,279.3 997.7,279.3L1006.4,294.3C1022.6,288.2 1040.6,288.2 1056.8,294.3L1065.5,279.2C1066.4,277.7 1067.8,276.6 1069.5,276.2C1073,275.3 1076.6,277.3 1077.5,280.8C1078,282.5 1077.7,284.3 1076.8,285.8L1068.5,300.2C1086,311.5 1097.4,330.2 1099.3,351L1099.8,355.8L963.4,355.8L963.8,351Z" style="fill:rgb(0,20,230);fill-rule:nonzero;"/>
-    <path id="path_3" d="M1060.7,322.4C1064,322.4 1066.6,325 1066.6,328.3C1066.6,331.6 1064,334.2 1060.7,334.2C1057.4,334.2 1054.8,331.6 1054.8,328.3C1054.8,325.1 1057.4,322.4 1060.7,322.4" style="fill:rgb(0,20,230);fill-rule:nonzero;"/>
-    <path id="path_4" d="M1002.5,322.4C1005.8,322.4 1008.4,325 1008.4,328.3C1008.4,331.6 1005.8,334.2 1002.5,334.2C999.2,334.2 996.6,331.6 996.6,328.3C996.6,325.1 999.3,322.4 1002.5,322.4" style="fill:rgb(0,20,230);fill-rule:nonzero;"/>
-    <g id="g_0">
-        <path d="M635.1,1578.1C625.6,1578.1 618,1570.4 618,1561C618,1551.6 625.7,1543.9 635.1,1543.9C644.5,1543.9 652.2,1551.6 652.2,1561C652.2,1570.4 644.5,1578.1 635.1,1578.1M635.1,1529.1C617.5,1529.1 603.3,1543.3 603.3,1561C603.3,1578.7 617.5,1592.8 635.1,1592.8C652.7,1592.8 666.9,1578.6 666.9,1561C666.9,1543.4 652.7,1529.2 635.1,1529.1" style="fill:white;fill-rule:nonzero;"/>
-        <path d="M399.9,1578.1C390.4,1578.1 382.8,1570.4 382.8,1561C382.8,1551.6 390.5,1543.9 399.9,1543.9C409.3,1543.9 417,1551.6 417,1561C417,1570.5 409.3,1578.1 399.9,1578.1C399.967,1578.1 399.967,1578.1 399.9,1578.1M399.9,1529.1C382.3,1529.1 368,1543.3 368,1560.9C368,1578.5 382.2,1592.8 399.8,1592.8C417.4,1592.8 431.7,1578.6 431.7,1561C431.8,1543.4 417.6,1529.2 399.9,1529.1" style="fill:white;fill-rule:nonzero;"/>
-        <path d="M286,1578.1C276.5,1578.1 268.9,1570.4 268.9,1561C268.9,1551.6 276.6,1543.9 286,1543.9C295.4,1543.9 303.1,1551.6 303.1,1561C303.1,1570.5 295.4,1578.1 286,1578.1M317.9,1561L317.9,1501.8L303.1,1501.8L303.1,1534.2C288.2,1524.7 268.6,1529.1 259.2,1543.9C249.7,1558.8 254.1,1578.4 268.9,1587.8C283.8,1597.3 303.4,1592.9 312.8,1578.1C316,1573 317.9,1567 317.9,1561Z" style="fill:white;fill-rule:nonzero;"/>
-        <path d="M501.1,1578.1C491.6,1578.1 484,1570.4 484,1561C484,1551.6 491.7,1543.9 501.1,1543.9C510.5,1543.9 518.2,1551.6 518.2,1561C518.2,1570.4 510.5,1578.1 501.1,1578.1M532.9,1501.7L518.1,1501.7L518.1,1534.1C503.2,1524.6 483.6,1529 474.2,1543.8C464.7,1558.7 469.1,1578.3 483.9,1587.7C498.8,1597.2 518.4,1592.8 527.8,1578C531,1572.9 532.7,1566.9 532.7,1560.9L532.7,1501.7L532.9,1501.7Z" style="fill:white;fill-rule:nonzero;"/>
-        <rect x="443" y="1529.2" width="14.8" height="63.7" style="fill:white;fill-rule:nonzero;"/>
-        <path d="M329.2,1560.9L329.2,1592.8L344,1592.8L344,1560.9C344,1551.4 351.7,1543.8 361.1,1543.8L361.1,1529C343.4,1529 329.2,1543.3 329.2,1560.9" style="fill:white;fill-rule:nonzero;"/>
-        <path d="M585.8,1573C579.1,1579.7 568.2,1579.7 561.6,1573C554.9,1566.3 554.9,1555.4 561.6,1548.8C568.3,1542.1 579.2,1542.1 585.8,1548.8L596.2,1538.4C583.8,1526 563.7,1526 551.2,1538.4C538.8,1550.8 538.8,1570.9 551.2,1583.4C563.6,1595.9 583.7,1595.8 596.2,1583.4L585.8,1573.1L585.8,1573Z" style="fill:white;fill-rule:nonzero;"/>
-        <path d="M709.1,1529.2C691.5,1529.2 677.3,1543.4 677.3,1561L677.3,1592.9L692.1,1592.9L692.1,1561C692.1,1551.5 699.8,1543.9 709.2,1543.9C718.6,1543.9 726.3,1551.6 726.3,1561L726.3,1592.9L741.1,1592.9L741.1,1561C740.9,1543.4 726.7,1529.2 709.1,1529.2" style="fill:white;fill-rule:nonzero;"/>
-        <path d="M408.1,1560.9C408.1,1565.4 404.4,1569.1 399.9,1569.1C395.4,1569.1 391.7,1565.4 391.7,1560.9C391.7,1556.4 395.4,1552.7 399.9,1552.7C404.4,1552.7 408.1,1556.4 408.1,1560.9" style="fill:rgb(0,20,230);fill-rule:nonzero;"/>
-        <path d="M1125.3,1530.6C1120,1530.5 1114.9,1531.8 1110.2,1534.3C1106,1536.7 1102.7,1540.2 1100.6,1544.5L1100.6,1531L1094.9,1531L1094.9,1593.2L1100.8,1593.2L1100.8,1560.1C1100.8,1552.8 1103,1546.8 1107.1,1542.5C1111.3,1538.1 1117,1535.9 1124.3,1535.9C1130.6,1535.9 1135.6,1537
```

---

### Incident Patch 9: `42f307b4` (2024-08-16)
**Commit Message**: Add venue map to SwiftUI (embedded Composable).

**File**: `ios/Droidcon/Droidcon.xcodeproj/project.pbxproj` (modified, +12/-0)
```diff
@@ -13,6 +13,7 @@
 		1821427E26B5418D0047DB71 /* schedule.json in Resources */ = {isa = PBXBuildFile; fileRef = 1821427A26B5418D0047DB71 /* schedule.json */; };
 		18240FAC2C6FD05F0099E416 /* FirebaseAnalytics in Frameworks */ = {isa = PBXBuildFile; productRef = 18240FAB2C6FD05F0099E416 /* FirebaseAnalytics */; };
 		18240FAE2C6FD05F0099E416 /* FirebaseCrashlytics in Frameworks */ = {isa = PBXBuildFile; productRef = 18240FAD2C6FD05F0099E416 /* FirebaseCrashlytics */; };
+		18240FB52C6FEA630099E416 /* VenueView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 18240FB42C6FEA630099E416 /* VenueView.swift */; };
 		1833221026B0CF5600D79482 /* DroidconApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = 1833220F26B0CF5600D79482 /* DroidconApp.swift */; };
 		1871C5FC26C5C7A400E51894 /* sponsors.json in Resources */ = {isa = PBXBuildFile; fileRef = 1871C5FB26C5C7A400E51894 /* sponsors.json */; };
 		18E89B45283944F500C08C9B /* LaunchScreen.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = F1465F0B23AA94BF0055F7C3 /* LaunchScreen.storyboard */; };
@@ -59,6 +60,7 @@
 		1821427826B5418D0047DB71 /* sponsor_sessions.json */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.json; name = sponsor_sessions.json; path = ../../../shared/src/commonMain/resources/sponsor_sessions.json; sourceTree = "<group>"; };
 		1821427926B5418D0047DB71 /* speakers.json */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.json; name = speakers.json; path = ../../../shared/src/commonMain/resources/speakers.json; sourceTree = "<group>"; };
 		1821427A26B5418D0047DB71 /* schedule.json */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.json; name = schedule.json; path = ../../../shared/src/commonMain/resources/schedule.json; sourceTree = "<group>"; };
+		18240FB42C6FEA630099E416 /* VenueView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = VenueView.swift; sourceTree = "<group>"; };
 		1833220F26B0CF5600D79482 /* DroidconApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = DroidconApp.swift; sourceTree = "<group>"; };
 		1871C5FB26C5C7A400E51894 /* sponsors.json */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.json; name = sponsors.json; path = ../../../shared/src/commonMain/resources/sponsors.json; sourceTree = "<group>"; };
 		18E89B48283E5D2C00C08C9B /* GoogleService-Info.plist */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };
@@ -127,6 +129,14 @@
 			name = Resources;
 			sourceTree = "<group>";
 		};
+		18240FB32C6FE9A90099E416 /* Venue */ = {
+			isa = PBXGroup;
+			children = (
+				18240FB42C6FEA630099E416 /* VenueView.swift */,
+			);
+			path = Venue;
+			sourceTree = "<group>";
+		};
 		684FAA7226B2A4B400673AFF /* Schedule */ = {
 			isa = PBXGroup;
 			children = (
@@ -244,6 +254,7 @@
 				684FAA7926B2A55500673AFF /* Sessions */,
 				684FAA7226B2A4B400673AFF /* Schedule */,
 				6881CF6126BD607D002541F0 /* Sponsors */,
+				18240FB32C6FE9A90099E416 /* Venue */,
 				684FAA7526B2A4E200673AFF /* Settings */,
 				684FAA7826B2A51100673AFF /* Utils */,
 				A35DEF2128AA265C0072605A /* Settings.bundle */,
@@ -390,6 +401,7 @@
 				68C86E9F26B31D6100008D15 /* LifecycleManager.swift in Sources */,
 				689DD2F726B40A9400A9B009 /* SwitchingNavigationLink.swift in Sources */,
 				684FAA7B26B2A55C00673AFF /* SessionListView.swift in Sources */,
+				18240FB52C6FEA630099E416 /* VenueView.swift in Sources */,
 				689DD2F926B40B3800A9B009 /* SessionBlockView.swift in Sources */,
 				684FAA7726B2A4EA00673AFF /* SettingsView.swift in Sources */,
 				689DD2FB26B40F1800A9B009 /* LazyView.swift in Sources */,
```

**File**: `ios/Droidcon/Droidcon/ComposeController.swift` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ struct ComposeController: UIViewControllerRepresentable {
     let viewModel: ApplicationViewModel
     
     func makeUIViewController(context: Context) -> some UIViewController {
-        ComposeRootControllerKt.getRootController(viewModel: viewModel)
+        getRootController(viewModel: viewModel)
     }
 
     func updateUIViewController(_ uiViewController: UIViewControllerType, context: Context) {}
```

**File**: `ios/Droidcon/Droidcon/MainView.swift` (modified, +2/-2)
```diff
@@ -50,10 +50,10 @@ struct MainView: View {
                     }
                     .tag(tab);
                 case .venue:
-                    EmptyView()
+                    VenueView()
                         .tabItem {
                             Image(systemName: "map")
-                            Text("venue.TabItem.Title")
+                            Text("Venue.TabItem.Title")
                         }
                 }
             }
```

**File**: `ios/Droidcon/Droidcon/Venue/VenueView.swift` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import SwiftUI
+import DroidconKit
+
+struct VenueView: View {
+    var body: some View {
+        NavigationView {
+            VenueBodyView()
+                .navigationTitle("Venue.Title")
+                .navigationBarTitleDisplayMode(.inline)
+        }
+    }
+}
+
+private struct VenueBodyView: UIViewControllerRepresentable {
+    func makeUIViewController(context: Context) -> some UIViewController {
+        venueBodyViewController()
+    }
+
+    func updateUIViewController(_ uiViewController: UIViewControllerType, context: Context) {}
+}
```

**File**: `ios/Droidcon/Droidcon/en.lproj/Localizable.strings` (modified, +3/-0)
```diff
@@ -45,3 +45,6 @@
 "Feedback.Dialog.Submit" = "Submit";
 "Feedback.Dialog.CloseAndDisable" = "Close and disable feedback";
 "Feedback.Dialog.Skip" = "Skip feedback";
+
+"Venue.Title" = "Venue Map";
+"Venue.TabItem.Title" = "Venue";
```

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/venue/VenueView.kt` (modified, +12/-4)
```diff
@@ -1,5 +1,6 @@
 package co.touchlab.droidcon.ui.venue
 
+import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.foundation.layout.padding
 import androidx.compose.material3.ExperimentalMaterial3Api
@@ -25,10 +26,17 @@ fun VenueView() {
             )
         },
     ) { paddingValues ->
-        ZoomImage(
-            painter = painterResource(droidcon.shared_ui.generated.resources.Res.drawable.venue_map_1),
-            contentDescription = null,
-            modifier = Modifier.fillMaxSize().padding(paddingValues),
+        VenueBodyView(
+            modifier = Modifier.padding(paddingValues)
         )
     }
 }
+
+@Composable
+fun VenueBodyView(modifier: Modifier = Modifier) {
+    ZoomImage(
+        painter = painterResource(droidcon.shared_ui.generated.resources.Res.drawable.venue_map_1),
+        contentDescription = null,
+        modifier = modifier.fillMaxSize(),
+    )
+}
```

**File**: `shared-ui/src/iosMain/kotlin/co/touchlab/droidcon/ui/ComposeRootController.kt` (modified, +9/-0)
```diff
@@ -1,8 +1,17 @@
 package co.touchlab.droidcon.ui
 
 import androidx.compose.ui.window.ComposeUIViewController
+import co.touchlab.droidcon.ui.venue.VenueBodyView
+import co.touchlab.droidcon.ui.venue.VenueView
 import co.touchlab.droidcon.viewmodel.ApplicationViewModel
+import droidcon.shared_ui.generated.resources.venue_map_1
 
+@Suppress("unused")
 fun getRootController(viewModel: ApplicationViewModel) = ComposeUIViewController {
     MainComposeView(viewModel)
 }
+
+@Suppress("unused")
+fun venueBodyViewController() = ComposeUIViewController {
+    VenueBodyView()
+}
```

---

### Incident Patch 10: `1e549134` (2024-08-16)
**Commit Message**: Add very basic venue map to Compose UI.

**File**: `ios/Droidcon/Droidcon/Common/FeedbackDialog.swift` (modified, +0/-2)
```diff
@@ -91,8 +91,6 @@ struct FeedbackDialog: View {
             imageName = "Feedback_Normal"
         case .satisfied:
             imageName = "Feedback_Satisfied"
-        default:
-            fatalError("Unknown image for rating '\(rating)'.")
         }
 
         let isSelected = selectedRating.wrappedValue == rating
```

**File**: `ios/Droidcon/Droidcon/MainView.swift` (modified, +10/-6)
```diff
@@ -10,7 +10,7 @@ struct MainView: View {
         TabView(selection: $viewModel.selectedTab) {
             ForEach(viewModel.tabs, id: \.self) { tab in
                 switch (tab) {
-                case ApplicationViewModel.Tab.schedule:
+                case .schedule:
                     ScheduleView(
                         viewModel: viewModel.schedule,
                         navigationTitle: "Schedule.Title"
@@ -20,7 +20,7 @@ struct MainView: View {
                         Text("Schedule.TabItem.Title")
                     }
                     .tag(tab);
-                case ApplicationViewModel.Tab.myagenda:
+                case .myAgenda:
                     ScheduleView(
                         viewModel: viewModel.agenda,
                         navigationTitle: "Agenda.Title"
@@ -30,7 +30,7 @@ struct MainView: View {
                         Text("Agenda.TabItem.Title")
                     }
                     .tag(tab);
-                case ApplicationViewModel.Tab.sponsors:
+                case .sponsors:
                     SponsorListView(
                         viewModel: viewModel.sponsors,
                         navigationTitle: "Sponsors.Title"
@@ -40,7 +40,7 @@ struct MainView: View {
                         Text("Sponsors.TabItem.Title")
                     }
                     .tag(tab);
-                case ApplicationViewModel.Tab.settings:
+                case .settings:
                     SettingsView(
                         viewModel: viewModel.settings
                     )
@@ -49,8 +49,12 @@ struct MainView: View {
                         Text("Settings.TabItem.Title")
                     }
                     .tag(tab);
-                default:
-                    fatalError("Unknown tab \(tab).")
+                case .venue:
+                    EmptyView()
+                        .tabItem {
+                            Image(systemName: "map")
+                            Text("venue.TabItem.Title")
+                        }
                 }
             }
         }
```

**File**: `ios/Droidcon/Droidcon/Sessions/Detail/SessionDetailView.swift` (modified, +2/-4)
```diff
@@ -129,14 +129,12 @@ struct SessionDetailView: View {
 
     private func stateMessage(from state: SessionDetailViewModel.SessionState) -> LocalizedStringKey? {
         switch state {
-        case .inconflict:
+        case .inConflict:
             return "Session.Detail.State.Conflict"
-        case .inprogress:
+        case .inProgress:
             return "Session.Detail.State.InProgress"
         case .ended:
             return "Session.Detail.State.Ended"
-        default:
-            return nil
         }
     }
 }
```

**File**: `ios/build.gradle.kts` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ plugins {
     alias(libs.plugins.serialization)
     alias(libs.plugins.jetbrainsCompose)
     alias(libs.plugins.composeCompiler)
+    alias(libs.plugins.skie)
 }
 
 version = "1.0"
```

**File**: `shared-ui/build.gradle.kts` (modified, +3/-3)
```diff
@@ -96,13 +96,13 @@ kotlin {
             // https://issuetracker.google.com/issues/294869453
             // https://github.com/JetBrains/compose-multiplatform/issues/3927
             api(compose.runtime)
+            implementation(compose.components.resources)
+
+            implementation(libs.zoomimage.composeResources)
 
             implementation(libs.hyperdrive.multiplatformx.api)
             // implementation(libs.hyperdrive.multiplatformx.compose)
         }
-        iosMain.dependencies {
-            implementation(libs.imageLoader)
-        }
         all {
             languageSettings.apply {
                 optIn("kotlin.RequiresOptIn")
```

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/BottomNavigationView.kt` (modified, +6/-1)
```diff
@@ -5,6 +5,7 @@ import androidx.compose.foundation.layout.padding
 import androidx.compose.material.icons.Icons
 import androidx.compose.material.icons.filled.CalendarMonth
 import androidx.compose.material.icons.filled.LocalFireDepartment
+import androidx.compose.material.icons.filled.Map
 import androidx.compose.material.icons.filled.Schedule
 import androidx.compose.material.icons.filled.Settings
 import androidx.compose.material3.Icon
@@ -21,6 +22,7 @@ import co.touchlab.droidcon.ui.session.SessionListView
 import co.touchlab.droidcon.ui.settings.SettingsView
 import co.touchlab.droidcon.ui.sponsors.SponsorsView
 import co.touchlab.droidcon.ui.util.observeAsState
+import co.touchlab.droidcon.ui.venue.VenueView
 import co.touchlab.droidcon.viewmodel.ApplicationViewModel
 
 @Composable
@@ -34,7 +36,9 @@ internal fun BottomNavigationView(viewModel: ApplicationViewModel, modifier: Mod
                 viewModel.tabs.forEach { tab ->
                     val (title, icon) = when (tab) {
                         ApplicationViewModel.Tab.Schedule -> "Schedule" to Icons.Filled.CalendarMonth
-                        ApplicationViewModel.Tab.MyAgenda -> "My Agenda" to Icons.Filled.Schedule
+                        // FIXME: Was originally "My agenda" but then it doesn't seem to fit.
+                        ApplicationViewModel.Tab.MyAgenda -> "Agenda" to Icons.Filled.Schedule
+                        ApplicationViewModel.Tab.Venue -> "Venue" to Icons.Filled.Map
                         ApplicationViewModel.Tab.Sponsors -> "Sponsors" to Icons.Filled.LocalFireDepartment
                         ApplicationViewModel.Tab.Settings -> "Settings" to Icons.Filled.Settings
                     }
@@ -59,6 +63,7 @@ internal fun BottomNavigationView(viewModel: ApplicationViewModel, modifier: Mod
             when (selectedTab) {
                 ApplicationViewModel.Tab.Schedule -> SessionListView(viewModel.schedule)
                 ApplicationViewModel.Tab.MyAgenda -> SessionListView(viewModel.agenda)
+                ApplicationViewModel.Tab.Venue -> VenueView()
                 ApplicationViewModel.Tab.Sponsors -> SponsorsView(viewModel.sponsors)
                 ApplicationViewModel.Tab.Settings -> SettingsView(viewModel.settings)
             }
```

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/ui/venue/VenueView.kt` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+package co.touchlab.droidcon.ui.venue
+
+import androidx.compose.foundation.layout.fillMaxSize
+import androidx.compose.foundation.layout.padding
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.Scaffold
+import androidx.compose.material3.Text
+import androidx.compose.material3.TopAppBar
+import androidx.compose.runtime.Composable
+import androidx.compose.ui.Modifier
+import co.touchlab.droidcon.util.NavigationStack
+import com.github.panpf.zoomimage.ZoomImage
+import com.github.panpf.zoomimage.compose.ZoomState
+import com.github.panpf.zoomimage.compose.rememberZoomState
+import droidcon.shared_ui.generated.resources.venue_map_1
+import org.jetbrains.compose.resources.painterResource
+
+@OptIn(ExperimentalMaterial3Api::class)
+@Composable
+fun VenueView() {
+    Scaffold(
+        topBar = {
+            TopAppBar(
+                title = { Text("Venue Map") },
+            )
+        },
+    ) { paddingValues ->
+        ZoomImage(
+            painter = painterResource(droidcon.shared_ui.generated.resources.Res.drawable.venue_map_1),
+            contentDescription = null,
+            modifier = Modifier.fillMaxSize().padding(paddingValues),
+        )
+    }
+}
```

**File**: `shared-ui/src/commonMain/kotlin/co.touchlab.droidcon/viewmodel/ApplicationViewModel.kt` (modified, +2/-2)
```diff
@@ -44,7 +44,7 @@ class ApplicationViewModel(
     var presentedFeedback: FeedbackDialogViewModel? by managed(null)
     val observePresentedFeedback by observe(::presentedFeedback)
 
-    val tabs = listOf(Tab.Schedule, Tab.MyAgenda, Tab.Sponsors, Tab.Settings)
+    val tabs = listOf(Tab.Schedule, Tab.MyAgenda, Tab.Venue, Tab.Sponsors, Tab.Settings)
     var selectedTab: Tab by published(Tab.Schedule)
     val observeSelectedTab by observe(::selectedTab)
 
@@ -103,6 +103,6 @@ class ApplicationViewModel(
     }
 
     enum class Tab {
-        Schedule, MyAgenda, Sponsors, Settings;
+        Schedule, MyAgenda, Venue, Sponsors, Settings;
     }
 }
```

---

### Incident Patch 11: `bde57736` (2024-03-18)
**Commit Message**: Remove tests as they're not real and they're causing crashkios + bugsnag test link issue

**File**: `shared/src/androidUnitTest/kotlin/co/touchlab/droidcon/BaseTest.kt` (removed, +0/-17)
```diff
@@ -1,17 +0,0 @@
-package co.touchlab.droidcon
-
-import androidx.test.ext.junit.runners.AndroidJUnit4
-import kotlinx.coroutines.CoroutineScope
-import kotlinx.coroutines.runBlocking
-import org.junit.Rule
-import org.junit.runner.RunWith
-
-@RunWith(AndroidJUnit4::class)
-actual abstract class BaseTest {
-    @get:Rule
-    var coroutineTestRule = CoroutineTestRule()
-
-    actual fun <T> runTest(block: suspend CoroutineScope.() -> T) {
-        runBlocking { block() }
-    }
-}
```

**File**: `shared/src/androidUnitTest/kotlin/co/touchlab/droidcon/CoroutineTestRule.kt` (removed, +0/-29)
```diff
@@ -1,29 +0,0 @@
-package co.touchlab.droidcon
-
-import kotlinx.coroutines.Dispatchers
-import kotlinx.coroutines.ExecutorCoroutineDispatcher
-import kotlinx.coroutines.asCoroutineDispatcher
-import kotlinx.coroutines.test.resetMain
-import kotlinx.coroutines.test.setMain
-import org.junit.rules.TestWatcher
-import org.junit.runner.Description
-import java.util.concurrent.Executors
-
-/**
- * Use this rule to update the Main dispatcher ahead of tests. By delegating the main dispatcher to a new thread.
- * we can block the current thread and still dispatch main coroutines
- */
-class CoroutineTestRule(
-    private val testDispatcher: ExecutorCoroutineDispatcher = Executors.newSingleThreadExecutor()
-        .asCoroutineDispatcher()
-) : TestWatcher() {
-    override fun starting(description: Description?) {
-        super.starting(description)
-        Dispatchers.setMain(testDispatcher)
-    }
-
-    override fun finished(description: Description?) {
-        super.finished(description)
-        Dispatchers.resetMain()
-    }
-}
```

**File**: `shared/src/androidUnitTest/kotlin/co/touchlab/droidcon/TestUtilAndroid.kt` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-package co.touchlab.droidcon
-
-import android.app.Application
-import androidx.test.core.app.ApplicationProvider
-import app.cash.sqldelight.android.AndroidSqliteDriver
-import app.cash.sqldelight.db.SqlDriver
-import co.touchlab.droidcon.db.DroidconDatabase
-
-internal actual fun testDbConnection(): SqlDriver {
-    val app = ApplicationProvider.getApplicationContext<Application>()
-    return AndroidSqliteDriver(DroidconDatabase.Schema, app, "new-droidcon.db")
-}
```

**File**: `shared/src/commonTest/kotlin/co/touchlab/droidcon/BaseTest.kt` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-package co.touchlab.droidcon
-
-import kotlinx.coroutines.CoroutineScope
-
-expect abstract class BaseTest() {
-    fun <T> runTest(block: suspend CoroutineScope.() -> T)
-}
```

**File**: `shared/src/commonTest/kotlin/co/touchlab/droidcon/TestUtil.kt` (removed, +0/-31)
```diff
@@ -1,31 +0,0 @@
-package co.touchlab.droidcon
-
-import app.cash.sqldelight.db.SqlDriver
-import co.touchlab.kermit.Logger
-import com.russhwolf.settings.Settings
-import kotlinx.coroutines.Deferred
-import kotlinx.coroutines.withTimeout
-import kotlinx.datetime.Clock
-import org.koin.core.context.startKoin
-import org.koin.core.context.stopKoin
-import org.koin.dsl.module
-
-fun appStart(settings: Settings, log: Logger, clock: Clock) {
-    val coreModule = module {
-        single { settings }
-        single { log }
-        single { clock }
-    }
-
-    startKoin { modules(coreModule) }
-}
-
-fun appEnd() {
-    stopKoin()
-}
-
-// Await with a timeout
-suspend fun <T> Deferred<T>.await(timeoutMillis: Long) =
-    withTimeout(timeoutMillis) { await() }
-
-internal expect fun testDbConnection(): SqlDriver
```

**File**: `shared/src/commonTest/kotlin/co/touchlab/droidcon/mock/ClockMock.kt` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-package co.touchlab.droidcon.mock
-
-import kotlinx.datetime.Clock
-import kotlinx.datetime.Instant
-
-class ClockMock(var currentInstant: Instant) : Clock {
-    override fun now(): Instant = currentInstant
-}
```

**File**: `shared/src/iosTest/kotlin/co/touchlab/droidcon/BaseTest.kt` (removed, +0/-29)
```diff
@@ -1,29 +0,0 @@
-package co.touchlab.droidcon
-
-import kotlinx.cinterop.ExperimentalForeignApi
-import kotlinx.coroutines.CoroutineScope
-import kotlinx.coroutines.DelicateCoroutinesApi
-import kotlinx.coroutines.Dispatchers
-import kotlinx.coroutines.GlobalScope
-import kotlinx.coroutines.launch
-import platform.CoreFoundation.CFRunLoopGetCurrent
-import platform.CoreFoundation.CFRunLoopRun
-import platform.CoreFoundation.CFRunLoopStop
-
-actual abstract class BaseTest {
-    @OptIn(DelicateCoroutinesApi::class, ExperimentalForeignApi::class)
-    actual fun <T> runTest(block: suspend CoroutineScope.() -> T) {
-        var error: Throwable? = null
-        GlobalScope.launch(Dispatchers.Main) {
-            try {
-                block()
-            } catch (t: Throwable) {
-                error = t
-            } finally {
-                CFRunLoopStop(CFRunLoopGetCurrent())
-            }
-        }
-        CFRunLoopRun()
-        error?.also { throw it }
-    }
-}
```

**File**: `shared/src/iosTest/kotlin/co/touchlab/droidcon/TestUtilIOS.kt` (removed, +0/-30)
```diff
@@ -1,30 +0,0 @@
-package co.touchlab.droidcon
-
-import app.cash.sqldelight.db.SqlDriver
-import app.cash.sqldelight.driver.native.NativeSqliteDriver
-import app.cash.sqldelight.driver.native.wrapConnection
-import co.touchlab.droidcon.db.DroidconDatabase
-import co.touchlab.sqliter.DatabaseConfiguration
-
-internal actual fun testDbConnection(): SqlDriver {
-    val schema = DroidconDatabase.Schema
-    return NativeSqliteDriver(
-        DatabaseConfiguration(
-            name = "new-droidcon.db",
-            version = if (schema.version > Int.MAX_VALUE) {
-                error("Schema version is larger than Int.MAX_VALUE: ${schema.version}.")
-            } else {
-                schema.version.toInt()
-            },
-            create = { connection ->
-                wrapConnection(connection) { schema.create(it) }
-            },
-            upgrade = { connection, oldVersion, newVersion ->
-                wrapConnection(connection) {
-                    schema.migrate(it, oldVersion.toLong(), newVersion.toLong())
-                }
-            },
-            inMemory = true
-        )
-    )
-}
```

---

### Incident Patch 12: `100f83d3` (2023-10-25)
**Commit Message**: Workflow fix and README update

**File**: `.github/workflows/ktlint.yml` (modified, +5/-2)
```diff
@@ -8,7 +8,10 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Checkout source code
-        uses: actions/checkout@v2
-
+        uses: actions/checkout@v3
+      - uses: actions/setup-java@v3
+        with:
+          distribution: "adopt"
+          java-version: "17"
       - name: run ktlint
         run: ./gradlew ktlintCheck
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ This project has a pair of native mobile applications backed by the Sessionize d
 
 > ## Subscribe!
 >
-> We build solutions that get teams started smoothly with Kotlin Multiplatform Mobile and ensure their success in production. Join our community to learn how your peers are adopting KMM.
+> We build solutions that get teams started smoothly with Kotlin Multiplatform and ensure their success in production. Join our community to learn how your peers are adopting KMM.
 [Sign up here](https://form.typeform.com/to/MJTpmm?typeform-source=touchlab.co)!
 
 ## Building
```

---

### Incident Patch 13: `071d07ff` (2023-10-16)
**Commit Message**: Fix nav bar color

**File**: `ios/Droidcon/Droidcon/Assets.xcassets/NavBar/NavBar_Background.colorset/Contents.json` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@
         "color-space" : "srgb",
         "components" : {
           "alpha" : "1.000",
-          "blue" : "0x7C",
+          "blue" : "0xC3",
           "green" : "0xE0",
           "red" : "0x7C"
         }
@@ -23,7 +23,7 @@
         "color-space" : "srgb",
         "components" : {
           "alpha" : "1.000",
-          "blue" : "0x7C",
+          "blue" : "0xC3",
           "green" : "0xE0",
           "red" : "0x7C"
         }
```

#### Recent Merged Pull Requests:
- **PR #251** (2026-07-07): Update docs (@wellingtoncosta)
- **PR #250** (2026-07-01): Js Support (@KevinSchildhorn)
- **PR #249** (2025-12-10): Updating Dependencies (@KevinSchildhorn)
- **PR #248** (2025-10-30): Fix system bars on Android. (@TadeasKriz)
- **PR #247** (2025-10-30): Fix RND-463. (@TadeasKriz)
- **PR #246** (2025-10-28): Sync and Dispaly Venue Map (@DanielSouzaBertoldi)
- **PR #245** (2025-05-08): Fix the uncaught exception when syncing conferences (#244) (@rayworks)
- **PR #243** (2025-06-16): Updating Colors (@KevinSchildhorn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
