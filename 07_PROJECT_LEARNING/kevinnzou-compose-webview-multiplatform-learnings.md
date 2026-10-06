# Forensic Learning Record (Deep Inspection): KevinnZou/compose-webview-multiplatform

> **Canonical Artifact**: `07_PROJECT_LEARNING/kevinnzou-compose-webview-multiplatform-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/KevinnZou/compose-webview-multiplatform](https://github.com/KevinnZou/compose-webview-multiplatform))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:11:59.912Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `KevinnZou/compose-webview-multiplatform`
- **Description**: WebView for JetBrains Compose Multiplatform
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1014 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `webview/src/androidMain/kotlin/com/multiplatform/webview/util/InternalStoragePathHandler.kt`
```
package com.multiplatform.webview.util

import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import java.io.File
import java.io.FileInputStream

class InternalStoragePathHandler : WebViewAssetLoader.PathHandler {
    override fun handle(path: String): WebResourceResponse? {
        val file = File(path.removePrefix("/"))
        if (!file.exists() || !file.isFile) return null

        val mimeType =
            when {
                path.endsWith(".html") -> "text/html"
                path.endsWith(".js") -> "application/javascript"
                path.endsWith(".css") -> "text/css"
                path.endsWith(".json") -> "application/json"
                path.endsWith(".png") -> "image/png"
                path.endsWith(".jpg") || path.endsWith(".jpeg") -> "image/jpeg"
                path.endsWith(".svg") -> "image/svg+xml"
                path.endsWith(".webp") -> "image/webp"
                path.endsWith(".ico") -> "image/x-icon"
                path.endsWith(".woff") -> "font/woff"
                path.endsWith(".woff2") -> "font/woff2"
                path.endsWith(".ttf") -> "font/ttf"
                path.endsWith(".mp4") -> "video/mp4"
                path.endsWith(".webm") -> "video/webm"
                path.endsWith(".ogg") -> "video/ogg"
                path.endsWith(".mp3") -> "audio/mpeg"
                path.endsWith(".wav") -> "audio/wav"
                path.endsWith(".wasm") -> "application/wasm"
                path.endsWith(".pdf") -> "application/pdf"
                path.endsWith(".zip") -> "application/zip"
                path.endsWith(".csv") -> "text/csv"
                else -> "application/octet-stream"
            }

        return WebResourceResponse(mimeType, "utf-8", FileInputStream(file))
    }
}

```

### Core Architecture Module: `webview/src/androidMain/kotlin/com/multiplatform/webview/util/getPlatform.kt`
```
package com.multiplatform.webview.util

import android.os.Build

internal actual fun getPlatform(): Platform = Platform.Android

internal actual fun getPlatformVersion(): String = Build.VERSION.RELEASE

internal actual fun getPlatformVersionDouble(): Double {
    val systemVersion = getPlatformVersion()
    val components = systemVersion.split(".")
    val major = components.getOrNull(0)?.toDoubleOrNull() ?: 0.0
    val minor = components.getOrNull(1)?.toDoubleOrNull() ?: 0.0
    return major + (minor / 10.0)
}

```

### Core Architecture Module: `webview/src/commonMain/kotlin/com/multiplatform/webview/util/Extension.kt`
```
package com.multiplatform.webview.util

fun Pair<Number, Number>?.isZero(): Boolean = this == null || (first == 0 && second == 0)

fun Pair<Number, Number>?.notZero(): Boolean = !isZero()

```

### Core Architecture Module: `webview/src/commonMain/kotlin/com/multiplatform/webview/util/KLogger.kt`
```
package com.multiplatform.webview.util

import co.touchlab.kermit.DefaultFormatter
import co.touchlab.kermit.Logger
import co.touchlab.kermit.Severity
import co.touchlab.kermit.mutableLoggerConfigInit
import co.touchlab.kermit.platformLogWriter

/**
 * Created By Kevin Zou On 2023/10/16
 */
internal object KLogger : Logger(
    config = mutableLoggerConfigInit(listOf(platformLogWriter(DefaultFormatter))),
    tag = "ComposeWebView",
) {
    init {
        setMinSeverity(KLogSeverity.Info)
    }

    fun setMinSeverity(severity: KLogSeverity) {
        mutableConfig.minSeverity = severity.toKermitSeverity()
    }

    // For iOS, it will not print out the log if the severity is upper than Debug in AS.
    fun info(msg: () -> String) {
        d { msg() }
    }
}

enum class KLogSeverity {
    Verbose,
    Debug,
    Info,
    Warn,
    Error,
    Assert,
}

fun KLogSeverity.toKermitSeverity(): Severity =
    when (this) {
        KLogSeverity.Verbose -> Severity.Verbose
        KLogSeverity.Debug -> Severity.Debug
        KLogSeverity.Info -> Severity.Info
        KLogSeverity.Warn -> Severity.Warn
        KLogSeverity.Error -> Severity.Error
        KLogSeverity.Assert -> Severity.Assert
    }

```

### Core Architecture Module: `webview/src/commonMain/kotlin/com/multiplatform/webview/util/Platform.kt`
```
package com.multiplatform.webview.util

/**
 * Created By Kevin Zou On 2023/12/5
 */

/**
 * A class that represents the platform that the code is running on.
 */
internal sealed class Platform {
    /**
     * The Android platform.
     */
    data object Android : Platform()

    /**
     * The Desktop platform.
     */
    data object Desktop : Platform()

    /**
     * The iOS platform.
     */
    data object IOS : Platform()

    /**
     * Whether the current platform is Android.
     */
    fun isAndroid() = this is Android

    /**
     * Whether the current platform is Desktop.
     */
    fun isDesktop() = this is Desktop

    /**
     * Whether the current platform is iOS.
     */
    fun isIOS() = this is IOS
}

/**
 * Get the current platform.
 */
internal expect fun getPlatform(): Platform

internal expect fun getPlatformVersion(): String

internal expect fun getPlatformVersionDouble(): Double

```

### Core Architecture Module: `webview/src/commonMain/kotlin/com/multiplatform/webview/web/LoadingState.kt`
```
package com.multiplatform.webview.web

/**
 * Created By Kevin Zou On 2023/9/5
 */

/**
 * Sealed class for constraining possible loading states.
 * See [Initializing], [Loading], and [Finished].
 */
sealed class LoadingState {
    /**
     * Describes a WebView that has not yet loaded for the first time.
     */
    data object Initializing : LoadingState()

    /**
     * Describes a webview between `onPageStarted` and `onPageFinished` events, contains a
     * [progress] property which is updated by the webview.
     */
    data class Loading(
        val progress: Float,
    ) : LoadingState()

    /**
     * Describes a webview that has finished loading content.
     */
    data object Finished : LoadingState()
}

```

### Core Architecture Module: `webview/src/commonMain/kotlin/com/multiplatform/webview/web/WebViewState.kt`
```
package com.multiplatform.webview.web

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.mapSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import com.multiplatform.webview.cookie.CookieManager
import com.multiplatform.webview.cookie.WebViewCookieManager
import com.multiplatform.webview.setting.WebSettings
import com.multiplatform.webview.util.KLogger
import com.multiplatform.webview.util.getPlatform
import com.multiplatform.webview.util.isZero

/**
 * Created By Kevin Zou On 2023/9/5
 */

/**
 * A state holder to hold the state for the WebView. In most cases this will be remembered
 * using the rememberWebViewState(uri) function.
 */
class WebViewState(
    webContent: WebContent,
) {
    /**
     * The last loaded url. This is updated when a new page is loaded.
     */
    var lastLoadedUrl: String? by mutableStateOf(null)
        internal set

    /**
     *  The content being loaded by the WebView
     */
    var content: WebContent by mutableStateOf(webContent)

    /**
     * Whether the WebView is currently [LoadingState.Loading] data in its main frame (along with
     * progress) or the data loading has [LoadingState.Finished]. See [LoadingState]
     */
    var loadingState: LoadingState by mutableStateOf(LoadingState.Initializing)
        internal set

    /**
     * Whether the webview is currently loading data in its main frame
     */
    val isLoading: Boolean
        get() = loadingState !is LoadingState.Finished

    /**
     * The title received from the loaded content of the current page
     */
    var pageTitle: String? by mutableStateOf(null)
        internal set

    /**
     * A list for errors captured in the last load. Reset when a new page is loaded.
     * Errors could be from any resource (iframe, image, etc.), not just for the main page.
     * To filter for only main frame errors, use [WebViewError.isFromMainFrame].
     */
    val errorsForCurrentRequest: SnapshotStateList<WebViewError> = mutableStateListOf()

    /**
     * Custom Settings for WebView.
     */
    val webSettings: WebSettings by mutableStateOf(WebSettings())

    /**
     * Whether the WebView should capture back presses and navigate back.
     * We need access to this in the state saver. An internal DisposableEffect or AndroidView
     * onDestroy is called after the state saver and so can't be used.
     */
    internal var webView by mutableStateOf<IWebView?>(null)

    /**
     * The native web view instance. On Android, this is an instance of [android.webkit.WebView].
     * On iOS, this is an instance of [WKWebView]. On desktop, this is an instance of [KCEFBrowser].
     */
    val nativeWebView get() = webView?.webView ?: error("WebView is not initialized")

    /**
     * The saved view state from when the view was destroyed last. To restore state,
     * use the navigator and only call loadUrl if the bundle is null.
     * See WebViewSaveStateSample.
     */
    var viewState: WebViewBundle? = null
        internal set

    var scrollOffset: Pair<Int, Int> = 0 to 0
        internal set

    /**
     * CookieManager for WebView.
     * Exposes access to the cookie manager for webView
     */
    val cookieManager: CookieManager by mutableStateOf(WebViewCookieManager())
}

/**
 * Creates a WebView state that is remembered across Compositions.
 *
 * @param url The url to load in the WebView
 * @param additionalHttpHeaders Optional, additional HTTP headers that are passed to [AccompanistWebView.loadUrl].
 *                              Note that these headers are used for all subsequent requests of the WebView.
 */
@Composable
fun rememberWebViewState(
    url: String,
    additionalHttpHeaders: Map<String, String> = emptyMap(),
    extraSettings: WebSettings.() -> Unit = {},
): WebViewState =
// Rather than using .apply {} here we will recreate the state, this prevents
    // a recomposition loop when the webview updates the url itself.
    remember {
        WebViewState(
            WebContent.Url(
                url = url,
                additionalHttpHeaders = additionalHttpHeaders,
            ),
        )
    }.apply {
        this.content =
            WebContent.Url(
                url = url,
                additionalHttpHeaders = additionalHttpHeaders,
            )
        extraSettings(this.webSettings)
    }

/**
 * Creates a WebView state that is remembered across Compositions and saved
 * across activity recreation.
 * When using saved state, you cannot change the URL via recomposition. The only way to load
 * a URL is via a WebViewNavigator.
 *
 * @param data The uri to load in the WebView
 * @sample com.google.accompanist.sample.webview.WebViewSaveStateSample
 */
@Composable
fun rememberSaveableWebViewState(
    url: String,
    additionalHttpHeaders: Map<String, String> = emptyMap(),
): WebViewState =
    if (getPlatform().isDesktop()) {
        rememberWebViewState(url, additionalHttpHeaders)
    } else {
        rememberSaveable(saver = WebStateSaver) {
            WebViewState(WebContent.NavigatorOnly)
        }
    }

val WebStateSaver: Saver<WebViewState, Any> =
    run {
        val pageTitleKey = "pagetitle"
        val lastLoadedUrlKey = "lastloaded"
        val stateBundleKey = "bundle"
        val scrollOffsetKey = "scrollOffset"

        mapSaver(
            save = {
                val viewState = it.webView?.saveState()
                KLogger.info {
                    "WebViewStateSaver Save: ${it.pageTitle}, ${it.lastLoadedUrl}, ${it.webView?.scrollOffset()}, $viewState"
                }
                mapOf(
                    pageTitleKey to it.pageTitle,
                    lastLoadedUrlKey to it.lastLoadedUrl,
                    stateBundleKey to viewState,
                    scrollOffsetKey to it.webView?.scrollOffset(),
                )
            },
            restore = {
                KLogger.info {
                    "WebViewStateSaver Restore: ${it[pageTitleKey]}, ${it[lastLoadedUrlKey]}, ${it["scrollOffset"]}, ${it[stateBundleKey]}"
                }
                val scrollOffset = it[scrollOffsetKey] as Pair<Int, Int>? ?: (0 to 0)
                val bundle = it[stateBundleKey] as WebViewBundle?
                WebViewState(WebContent.NavigatorOnly).apply {
                    this.pageTitle = it[pageTitleKey] as String?
                    this.lastLoadedUrl = it[lastLoadedUrlKey] as String?
                    bundle?.let { this.viewState = it }
                    if (!scrollOffset.isZero()) {
                        this.scrollOffset = scrollOffset
                    }
                }
            },
        )
    }

/**
 * Creates a WebView state that is remembered across Compositions.
 *
 * @param data The uri to load in the WebView
 * @param baseUrl The URL to use as the page's base URL.
 * @param encoding The encoding of the data in the string.
 * @param mimeType The MIME type of the data in the string.
 * @param historyUrl The history URL for the loaded HTML. Leave null to use about:blank.
 */
@Composable
fun rememberWebViewStateWithHTMLData(
    data: String,
    baseUrl: String? = null,
    encoding: String = "utf-8",
    mimeType: String? = null,
    historyUrl: String? = null,
): WebViewState =
    remember {
        WebViewState(WebContent.Data(data, baseUrl, encoding, mimeType, historyUrl))
    }.apply {
        this.content =
            WebContent.Data(
                data,
                baseUrl,
                encoding,
                mimeType,
                historyUrl,
            )
    }

/**
 * Creates a WebView state for HTML file loading that is remembered across Compositions.
 *
 * @param fileName The file path or URI string to load in the WebView. The exact format and
 *                 interpretation of this string (e.g., relative path, absolute URI)
 *                 depend on the value of the [readType] parameter.
 * @param readType Specifies the method and source location for loading the HTML file.
 *                 This parameter is of type [WebViewFileReadType] and dictates how the
 *                 [fileName] should be treated by the underlying platform-specific WebView
 *                 implementation.
 *
 *                 Possible values for `readType` and their implications for `fileName`:
 *                 - **`WebViewFileReadType.ASSET_RESOURCES` (Default)**:
 *                     - **Android**: Expects `fileName` to be a path relative to the
 *                       Android `assets` folder (e.g., "index.html" or "www/index.html").
 *                       The WebView will typically load this using a "file:///android_asset/"-based URL.
 *                     - **iOS**: Expects `fileName` to be a path relative to the main
 *                       bundle's resources, often within a specific assets or resources directory
 *                       conventionally used (e.g., "assets/index.html" or a path resolved via
 *                       `NSBundle.mainBundle.pathForResource`). The `loadHtmlFile` implementation
 *                       constructs an appropriate `file:///` URL to this bundled resource.
 *                     - **Desktop (JAR)**: Expects `fileName` to be a path relative to a
 *                       predefined root within the JAR's classpath, typically an "assets"
 *                       folder (e.g., "index.html" would be loaded from "/assets/index.html"
 *                       within the JAR).
 *
 *                 - **`WebViewFileReadType.COMPOSE_RESOURCE_FILES`**:
 *                     - **All Platforms**: Expects `fileName` to be the URI string
 *                       obtained from `org.jetbrains.co
```

### Core Architecture Module: `webview/src/desktopMain/kotlin/com/multiplatform/webview/util/getPlatform.kt`
```
package com.multiplatform.webview.util

internal actual fun getPlatform(): Platform = Platform.Desktop

internal actual fun getPlatformVersion(): String {
    // TODO
    return "11.0"
}

internal actual fun getPlatformVersionDouble(): Double {
    val systemVersion = getPlatformVersion()
    val components = systemVersion.split(".")
    val major = components.getOrNull(0)?.toDoubleOrNull() ?: 0.0
    val minor = components.getOrNull(1)?.toDoubleOrNull() ?: 0.0
    return major + (minor / 10.0)
}

```

### Core Architecture Module: `webview/src/desktopMain/kotlin/com/multiplatform/webview/util/tempDirectory.kt`
```
package com.multiplatform.webview.util

import kotlin.io.path.createTempDirectory

val tempDirectory: java.io.File = createTempDirectory("webview-temp").toFile()

fun addTempDirectoryRemovalHook() {
    Runtime.getRuntime().addShutdownHook(
        Thread {
            println("Attempting to delete temp directory: ${tempDirectory.absolutePath}")
            val success = tempDirectory.deleteRecursively()
            if (success) {
                println("✅ Temp directory deleted successfully.")
            } else {
                println("❌ Failed to delete temp directory.")
            }
        },
    )
}

```

### Core Architecture Module: `webview/src/desktopMain/kotlin/com/multiplatform/webview/web/WebEngineExt.kt`
```
package com.multiplatform.webview.web

import com.multiplatform.webview.request.WebRequest
import com.multiplatform.webview.request.WebRequestInterceptResult
import com.multiplatform.webview.util.KLogger
import dev.datlag.kcef.KCEFBrowser
import org.cef.CefSettings
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefDisplayHandler
import org.cef.handler.CefLoadHandler
import org.cef.handler.CefRequestHandlerAdapter
import org.cef.network.CefRequest

/**
 * Created By Kevin Zou On 2023/9/12
 */
internal fun CefBrowser.getCurrentUrl(): String? = this.url

internal fun CefBrowser.addDisplayHandler(state: WebViewState) {
    this.client.addDisplayHandler(
        object : CefDisplayHandler {
            override fun onAddressChange(
                browser: CefBrowser?,
                frame: CefFrame?,
                url: String?,
            ) {
                KLogger.d { "onAddressChange: $url" }
                state.lastLoadedUrl = getCurrentUrl()
            }

            override fun onTitleChange(
                browser: CefBrowser?,
                title: String?,
            ) {
                // https://magpcss.org/ceforum/viewtopic.php?t=11491
                // https://github.com/KevinnZou/compose-webview-multiplatform/issues/46
                // I found this formula much near to the other platforms, so I replace it
                val givenZoomLevel = state.webSettings.zoomLevel

                val percentage = givenZoomLevel * 100.0
                val realZoomLevel = (percentage - 100.0) / 25.0

                KLogger.d { "titleProperty: $title" }
                zoomLevel = realZoomLevel
                state.pageTitle = title
            }

            override fun onFullscreenModeChange(
                p0: CefBrowser?,
                p1: Boolean,
            ) {
                // Not supported
            }

            override fun onTooltip(
                browser: CefBrowser?,
                text: String?,
            ) = false

            override fun onStatusMessage(
                browser: CefBrowser?,
                value: String?,
            ) {
            }

            override fun onConsoleMessage(
                browser: CefBrowser?,
                level: CefSettings.LogSeverity?,
                message: String?,
                source: String?,
                line: Int,
            ) = false

            override fun onCursorChange(
                browser: CefBrowser?,
                cursorType: Int,
            ) = false
        },
    )
}

internal fun CefBrowser.addLoadListener(
    state: WebViewState,
    navigator: WebViewNavigator,
) {
    this.client.addLoadHandler(
        object : CefLoadHandler {
            private var lastLoadedUrl = "null"

            override fun onLoadingStateChange(
                browser: CefBrowser?,
                isLoading: Boolean,
                canGoBack: Boolean,
                canGoForward: Boolean,
            ) {
                KLogger.d {
                    "onLoadingStateChange: $url, $isLoading $canGoBack $canGoForward"
                }
                if (isLoading) {
                    state.loadingState = LoadingState.Initializing
                } else {
                    state.loadingState = LoadingState.Finished
                    if (url != null && url != lastLoadedUrl) {
                        state.webView?.injectJsBridge()
                        lastLoadedUrl = url
                    }
                }
                navigator.canGoBack = canGoBack
                navigator.canGoForward = canGoForward
            }

            override fun onLoadStart(
                browser: CefBrowser?,
                frame: CefFrame?,
                transitionType: CefRequest.TransitionType?,
            ) {
                KLogger.d { "Load Start ${browser?.url}" }
                lastLoadedUrl = "null" // clean last loaded url for reload to work
                state.loadingState = LoadingState.Loading(0F)
                state.errorsForCurrentRequest.clear()
            }

            override fun onLoadEnd(
                browser: CefBrowser?,
                frame: CefFrame?,
                httpStatusCode: Int,
            ) {
                KLogger.d { "Load End ${browser?.url}" }
                state.loadingState = LoadingState.Finished
                navigator.canGoBack = canGoBack()
                navigator.canGoForward = canGoForward()
                state.lastLoadedUrl = getCurrentUrl()
            }

            override fun onLoadError(
                browser: CefBrowser?,
                frame: CefFrame?,
                errorCode: CefLoadHandler.ErrorCode?,
                errorText: String?,
                failedUrl: String?,
            ) {
                state.loadingState = LoadingState.Finished
                // TODO Error
                KLogger.i {
                    "Failed to load url: $errorCode ${failedUrl}\n$errorText"
                }
                state.errorsForCurrentRequest.add(
                    WebViewError(
                        code = errorCode?.code ?: 404,
                        description = "Failed to load url: ${failedUrl}\n$errorText",
                        isFromMainFrame = frame?.isMain ?: false,
                    ),
                )
            }
        },
    )
}

internal fun KCEFBrowser.addRequestHandler(
    state: WebViewState,
    navigator: WebViewNavigator,
) {
    client.addRequestHandler(
        object : CefRequestHandlerAdapter() {
            override fun onBeforeBrowse(
                browser: CefBrowser?,
                frame: CefFrame?,
                request: CefRequest?,
                userGesture: Boolean,
                isRedirect: Boolean,
            ): Boolean {
                navigator.requestInterceptor?.apply {
                    val map = mutableMapOf<String, String>()
                    request?.getHeaderMap(map)
                    KLogger.d { "onBeforeBrowse ${request?.url} $map" }
                    val webRequest =
                        WebRequest(
                            request?.url.toString(),
                            map,
                            isForMainFrame = frame?.isMain ?: false,
                            isRedirect = isRedirect,
                            request?.method ?: "GET",
                        )
                    val interceptResult =
                        this.onInterceptUrlRequest(
                            webRequest,
                            navigator,
                        )
                    return when (interceptResult) {
                        is WebRequestInterceptResult.Allow -> {
                            super.onBeforeBrowse(browser, frame, request, userGesture, isRedirect)
                        }

                        is WebRequestInterceptResult.Reject -> {
                            true
                        }

                        is WebRequestInterceptResult.Modify -> {
                            interceptResult.request.apply {
                                navigator.loadUrl(this.url, this.headers)
                            }
                            true
                        }
                    }
                }
                return super.onBeforeBrowse(browser, frame, request, userGesture, isRedirect)
            }
        },
    )
}

```

### Core Architecture Module: `webview/src/iosMain/kotlin/com/multiplatform/webview/util/Color.kt`
```
package com.multiplatform.webview.util

import androidx.compose.ui.graphics.Color
import platform.UIKit.UIColor

fun Color.toUIColor(): UIColor =
    UIColor(
        red = red.toDouble(),
        green = green.toDouble(),
        blue = blue.toDouble(),
        alpha = alpha.toDouble(),
    )

```

### Core Architecture Module: `webview/src/iosMain/kotlin/com/multiplatform/webview/util/getPlatform.kt`
```
package com.multiplatform.webview.util

import platform.UIKit.UIDevice

internal actual fun getPlatform(): Platform = Platform.IOS

internal actual fun getPlatformVersion(): String = UIDevice.currentDevice.systemVersion

internal actual fun getPlatformVersionDouble(): Double {
    val systemVersion = getPlatformVersion()
    val components = systemVersion.split(".")
    val major = components.getOrNull(0)?.toDoubleOrNull() ?: 0.0
    val minor = components.getOrNull(1)?.toDoubleOrNull() ?: 0.0
    return major + (minor / 10.0)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #228** (2024-10-01): **Scrolling doesn't work as it should (iOS)**
  *Symptoms*: With the latest version 1.9.40-alpha01 I have problems with scrolling in webview (iOS devices). The problem is that when I try to scroll, the gesture is not recognized immediately, I need to hold my finger for the scrolling to work. If I try to make a gesture quickly, then the scrolling does not work
  **Post-Mortem & Fix Analysis**:
  > @KevinnZou this can be closed with #231 ?

- **Issue #157** (2024-05-19): **bugfix:dark mode support with check**
  *Symptoms*: 

- **Issue #156** (2024-05-19): **This method is not supported by the current version of the framework and the current WebView APK**
  *Symptoms*: 三星S8(安卓9)上测到崩溃： ``` java java.lang.UnsupportedOperationException: This method is not supported by the current version of the framework and the current WebView APK     at androidx.webkit.internal.WebViewFeatureInternal.getUnsupportedOperationException(WebViewFeatureInternal.java:680)     at androidx.webkit.WebSettingsCompat.setForceDarkStrategy(WebSettingsCompat.java:546)     at com.multiplatform.webview.web.AccompanistWebViewKt$AccompanistWebView$12.invoke(AccompanistWebView.kt:219)     at com.multiplatform.webview.web.AccompanistWebViewKt$AccompanistWebView$12.invoke(AccompanistWebView.kt:161)     at androidx.compose.ui.viewinterop.ViewFactoryHolder.<init>(AndroidView.android.kt:343)     at androidx.compose.ui.viewinterop.AndroidView_androidKt$createAndroidViewNodeFactory$1.invoke(AndroidView.android.kt:274)     at androidx.compose.ui.viewinterop.AndroidView_androidKt$createAndroidViewNodeFactory$1.invoke(AndroidView.android.kt:273) ``` 安卓死丢丢提示：setForceDarkStrategy should only be called if the feature FORCE_DARK_STRATEGY is present; to check call androidx.webkit.WebViewFeature#isFeatureSupported  增加判断可解： ``` kotlin if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK_STRATEGY)) { // 添加这一行     WebSettingsCompat.setForceDarkStrategy(         this.settings,         WebSettingsCompat.DARK_STRATEGY_WEB_THEME_DARKENING_ONLY,     ) } ```
  **Post-Mortem & Fix Analysis**:
  > @encyclist Thanks for your suggestion! I have submitted a PR to fix it and plan to release it next week. Thanks again!

- **Issue #149** (2024-05-12): **Webview crashing on iOS when loading HTML data**
  *Symptoms*: Hi, I updated to the latest version 1.9.6 and the webview has suddenly started to crash on iOS  My current setup looks like this  ```kotlin val navigator = rememberWebViewNavigator() val jsBridge = rememberWebViewJsBridge() val webViewState = rememberWebViewStateWithHTMLData(htmlTemplate)  webViewState.webSettings.apply {   this.supportZoom = false }  WebView(   modifier = Modifier.fillMaxSize(),   state = webViewState,   navigator = navigator,   webViewJsBridge = jsBridge,   captureBackPresses = false, ) ```   ``` Uncaught Kotlin exception: kotlin.NumberFormatException     at 0   Twine (Debug)                       0x10085e39f        kfun:kotlin.Throwable#<init>(){} + 95      at 1   Twine (Debug)                       0x1008575d7        kfun:kotlin.Exception#<init>(){} + 87      at 2   Twine (Debug)                       0x1008577f7        kfun:kotlin.RuntimeException#<init>(){} + 87      at 3   Twine (Debug)                       0x100857bff        kfun:kotlin.IllegalArgumentException#<init>(){} + 87      at 4   Twine (Debug)                       0x100858927        kfun:kotlin.NumberFormatException#<init>(){} + 87      at 5   Twine (Debug)                       0x1008771f7        kfun:kotlin.native.internal.FloatingPointParser.initialParse#internal + 4043      at 6   Twine (Debug)                       0x100874f97        kfun:kotlin.native.internal.FloatingPointParser#parseDouble(kotlin.String){}kotlin.Double + 1515      at 7   Twine (Debug)
  **Post-Mortem & Fix Analysis**:
  > @msasikanth It seems that the NumberFormatException is caused by the `toDouble` method in the following code added in version 1.9.6. However, it is strange to have a NumberFormatException here, since `scrollOffset` is just a map of Int. ``` webView.scrollView.setContentOffset(     CGPointMake(         x = state.scrollOffset.first.toDouble(),         y = state.scrollOffset.second.toDouble(),     ),     true, ) ``` I am unable to reproduce this exception on my end. Does your web page contain any operations on the scroll position? Could you try testing this on a simple HTML page?
  > I tried it with my website link: https://sasikanth.dev/dev-log-3/, but it's failing. I am not doing anything fancy with that 🤔 
  > @msasikanth what's the version of your ios device? Is the exception still the NumberFormatException for website link? It still works well on my device(ip15PM 17.4).

- **Issue #62** (2023-12-12): **Navigator.loadHtml not working on Android**
  *Symptoms*: Hi,  I want to update HTML from a UiState. I tested this:  ``` val state = rememberWebViewStateWithHTMLData("initial")      val navigator = rememberWebViewNavigator()      LaunchedEffect(Unit) {         delay(2000)         navigator.loadHtml("<html><body>New HTML</body></html>")     } ```  Which would be expected to first show "initial", then change to New HTML. It doesn't change.  The problem seems to be in WebViewNavigator line 130 which has this code (collecting the flow):  ``` loadHtml(                             event.baseUrl,                             event.html,                             event.mimeType,                             event.encoding,                             event.historyUrl,                         ) ```  But in AndroidWebView.kt (line 25) the arguments are in different order:  ``` override fun loadHtml(         html: String?,         baseUrl: String?,         mimeType: String?,         encoding: String?,         historyUrl: String?,     ) ```  It seems like baseUrl and html have changed places.   Is that something that can be fixed, or should I send a pull request? Thanks!  
  **Post-Mortem & Fix Analysis**:
  > @mikedawson Hi, thanks for your feedback! You are correct, and I apologize for the mistake. I have fixed it and will release it with the next version. Thanks again!
  > Thank you @KevinnZou  !

- **Issue #61** (2024-01-17): **Use in the Desktop rememberWebViewStateWithHTMLData not loaded correctly**
  *Symptoms*: Hello, I have integrated your component into my sample application, but now I'm encountering an issue.  When I use 'rememberWebViewStateWithHTMLData' to load data in Desktop, it prompts me with the following error message:  ![image](https://github.com/KevinnZou/compose-webview-multiplatform/assets/139280335/3e95e95e-d03c-4ec0-a42a-85b3fe3c21e8)  Additionally, the content is blank, without any data.  ![image](https://github.com/KevinnZou/compose-webview-multiplatform/assets/139280335/290c9ac0-1e41-4d61-b19f-ffc427de6dec)  I'm running on Mac and have added the following.  Screen ```kotlin     val html = """             <html>                 <head>                     <title>Custom Title</title>                 </head>                 <body>                     <h1>Custom HTML</h1>                     <p>This is a custom HTML page.</p>                 </body>             </html>     """.trimIndent()     val webViewState = rememberWebViewStateWithHTMLData(         html     )     Column(         modifier = Modifier.fillMaxSize()     ) {         LedgerTitle(title = state.title, onBack = {             onEvent(AgreementEvent.GoBack)         })         WebView(             modifier = Modifier.fillMaxSize(),             state = webViewState         )     } ```  Gradle ```koltin afterEvaluate {     tasks.withType<JavaExec> {         jvmArgs("--add-opens", "java.desktop/sun.awt=ALL-UNNAMED")         jvmArgs("--add-opens", "java.desktop/java.awt
  **Post-Mortem & Fix Analysis**:
  > However, when I load a hyperlink, the content is displayed correctly.  ![image](https://github.com/KevinnZou/compose-webview-multiplatform/assets/139280335/aff8f944-36a6-4d55-889f-4afda1ccc217) 
  > @pdcodkzcap04 Hi, Thank you for your feedback! Which version of this library are you using? Additionally, are you using a Mac M1 or an Intel?
  > > @pdcodkzcap04您好，感谢您的反馈！您使用的是该库的哪个版本？另外，您使用的是 Mac M1 还是 Intel？  Hello, the version of the library I'm using is 1.7.6, and the chip in my computer is Apple M1 Pro.

- **Issue #42** (2023-11-25): **CookieManager return empty array on iOS**
  *Symptoms*: I need to get auth cookie when page is loaded.  I try it like this `cookies = state.cookieManager.getCookies("https://myurl/")`  It works fine on Android, but on iOS I get just `[]`
  **Post-Mortem & Fix Analysis**:
  > Thank you for your feedback. Could you please provide more code that shows where you are attempting to call the `getCookies` function?
  > Yes.   ```` Scaffold {             var state = rememberWebViewState(url )             state.webSettings.apply {                 isJavaScriptEnabled = true                 customUserAgentString =                     "Mozilla/5.0 (Linux; Android 8.0; Pixel 2 Build/OPD3.170816.012) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Mobile Safari/537.36"                 androidWebSettings.apply {                     isAlgorithmicDarkeningAllowed = true                     safeBrowsingEnabled = true                 }                  LaunchedEffect(state.loadingState) {                     if (state.loadingState is LoadingState.Finished) {                         try {                             val cookies  =  state.cookieManager.getCookies(url)                         } catch (e: Exception) {                            ///                         }                      }                 }                  WebView(                     state = state,     
  > I think I had something wrong with iOS version. I am trying to add "Cookie" to additional headers of state. On Android I get an authorized site in WebView, but on iOS - no authorized.

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

### Incident Patch 1: `68e76907` (2025-12-23)
**Commit Message**: Merge pull request #398 from threethan/cm-fix

(Desktop) Set UA via request handler instead of context: Fixes CookieManager

**File**: `webview/src/desktopMain/kotlin/com/multiplatform/webview/web/CefRequestExt.kt` (modified, +27/-14)
```diff
@@ -4,23 +4,36 @@ import com.multiplatform.webview.setting.WebSettings
 import dev.datlag.kcef.KCEFResourceRequestHandler
 import org.cef.browser.CefBrowser
 import org.cef.browser.CefFrame
-import org.cef.browser.CefRequestContext
+import org.cef.handler.CefRequestHandler
+import org.cef.handler.CefRequestHandlerAdapter
+import org.cef.handler.CefResourceRequestHandler
+import org.cef.misc.BoolRef
 import org.cef.network.CefRequest
 
-internal fun createModifiedRequestContext(settings: WebSettings): CefRequestContext {
-    return CefRequestContext.createContext { browser, frame, request, isNavigation, isDownload, requestInitiator, disableDefaultHandling ->
-        object : KCEFResourceRequestHandler(
-            getGlobalDefaultHandler(browser, frame, request, isNavigation, isDownload, requestInitiator, disableDefaultHandling),
-        ) {
-            override fun onBeforeResourceLoad(
-                browser: CefBrowser?,
-                frame: CefFrame?,
-                request: CefRequest?,
-            ): Boolean {
-                if (request != null) {
-                    settings.customUserAgentString?.let(request::setUserAgentString)
+internal fun createModifiedRequestHandler(settings: WebSettings): CefRequestHandler {
+    return object : CefRequestHandlerAdapter() {
+        override fun getResourceRequestHandler(
+            browser: CefBrowser?,
+            frame: CefFrame?,
+            request: CefRequest?,
+            isNavigation: Boolean,
+            isDownload: Boolean,
+            requestInitiator: String?,
+            disableDefaultHandling: BoolRef?,
+        ): CefResourceRequestHandler {
+            return object : KCEFResourceRequestHandler(
+                getGlobalDefaultHandler(browser, frame, request, isNavigation, isDownload, requestInitiator, disableDefaultHandling),
+            ) {
+                override fun onBeforeResourceLoad(
+                    browser: CefBrowser?,
+                    frame: CefFrame?,
+                    request: CefRequest?,
+                ): Boolean {
+                    if (request != null) {
+                        settings.customUserAgentString?.let(request::setUserAgentString)
+                    }
+                    return super.onBeforeResourceLoad(browser, frame, request)
                 }
-                return super.onBeforeResourceLoad(browser, frame, request)
             }
         }
     }
```

**File**: `webview/src/desktopMain/kotlin/com/multiplatform/webview/web/WebView.desktop.kt` (modified, +24/-20)
```diff
@@ -9,7 +9,6 @@ import dev.datlag.kcef.KCEF
 import dev.datlag.kcef.KCEFBrowser
 import dev.datlag.kcef.KCEFClient
 import org.cef.browser.CefRendering
-import org.cef.browser.CefRequestContext
 import java.util.concurrent.TimeUnit
 
 /**
@@ -53,7 +52,6 @@ actual class WebViewFactoryParam(
             CefRendering.DEFAULT
         }
     inline val transparent: Boolean get() = webSettings.desktopWebSettings.transparent
-    val requestContext: CefRequestContext get() = createModifiedRequestContext(webSettings)
 }
 
 actual class PlatformWebViewParams
@@ -62,33 +60,39 @@ actual class PlatformWebViewParams
 actual fun defaultWebViewFactory(param: WebViewFactoryParam): NativeWebView =
     when (val content = param.state.content) {
         is WebContent.Url ->
-            param.client.createBrowser(
-                content.url,
-                param.rendering,
-                param.transparent,
-                param.requestContext,
-            )
+            param.client
+                .also {
+                    it.addRequestHandler(createModifiedRequestHandler(param.webSettings))
+                }.createBrowser(
+                    content.url,
+                    param.rendering,
+                    param.transparent,
+                )
         is WebContent.Data ->
             param.client.createBrowser(
                 KCEFBrowser.BLANK_URI,
                 param.rendering,
                 param.transparent,
             )
         is WebContent.File -> {
-            param.client.createBrowser(
-                KCEFBrowser.BLANK_URI,
-                param.rendering,
-                param.transparent,
-                param.requestContext,
-            )
+            param.client
+                .also {
+                    it.addRequestHandler(createModifiedRequestHandler(param.webSettings))
+                }.createBrowser(
+                    KCEFBrowser.BLANK_URI,
+                    param.rendering,
+                    param.transparent,
+                )
         }
         else ->
-            param.client.createBrowser(
-                KCEFBrowser.BLANK_URI,
-                param.rendering,
-                param.transparent,
-                param.requestContext,
-            )
+            param.client
+                .also {
+                    it.addRequestHandler(createModifiedRequestHandler(param.webSettings))
+                }.createBrowser(
+                    KCEFBrowser.BLANK_URI,
+                    param.rendering,
+                    param.transparent,
+                )
     }
 
 /**
```

---

### Incident Patch 2: `07dd86be` (2025-12-13)
**Commit Message**: (Desktop) Set UA via request handler instead of context: Fixes CookieManager

**File**: `webview/src/desktopMain/kotlin/com/multiplatform/webview/web/CefRequestExt.kt` (modified, +27/-14)
```diff
@@ -4,23 +4,36 @@ import com.multiplatform.webview.setting.WebSettings
 import dev.datlag.kcef.KCEFResourceRequestHandler
 import org.cef.browser.CefBrowser
 import org.cef.browser.CefFrame
-import org.cef.browser.CefRequestContext
+import org.cef.handler.CefRequestHandler
+import org.cef.handler.CefRequestHandlerAdapter
+import org.cef.handler.CefResourceRequestHandler
+import org.cef.misc.BoolRef
 import org.cef.network.CefRequest
 
-internal fun createModifiedRequestContext(settings: WebSettings): CefRequestContext {
-    return CefRequestContext.createContext { browser, frame, request, isNavigation, isDownload, requestInitiator, disableDefaultHandling ->
-        object : KCEFResourceRequestHandler(
-            getGlobalDefaultHandler(browser, frame, request, isNavigation, isDownload, requestInitiator, disableDefaultHandling),
-        ) {
-            override fun onBeforeResourceLoad(
-                browser: CefBrowser?,
-                frame: CefFrame?,
-                request: CefRequest?,
-            ): Boolean {
-                if (request != null) {
-                    settings.customUserAgentString?.let(request::setUserAgentString)
+internal fun createModifiedRequestHandler(settings: WebSettings): CefRequestHandler {
+    return object : CefRequestHandlerAdapter() {
+        override fun getResourceRequestHandler(
+            browser: CefBrowser?,
+            frame: CefFrame?,
+            request: CefRequest?,
+            isNavigation: Boolean,
+            isDownload: Boolean,
+            requestInitiator: String?,
+            disableDefaultHandling: BoolRef?,
+        ): CefResourceRequestHandler {
+            return object : KCEFResourceRequestHandler(
+                getGlobalDefaultHandler(browser, frame, request, isNavigation, isDownload, requestInitiator, disableDefaultHandling),
+            ) {
+                override fun onBeforeResourceLoad(
+                    browser: CefBrowser?,
+                    frame: CefFrame?,
+                    request: CefRequest?,
+                ): Boolean {
+                    if (request != null) {
+                        settings.customUserAgentString?.let(request::setUserAgentString)
+                    }
+                    return super.onBeforeResourceLoad(browser, frame, request)
                 }
-                return super.onBeforeResourceLoad(browser, frame, request)
             }
         }
     }
```

**File**: `webview/src/desktopMain/kotlin/com/multiplatform/webview/web/WebView.desktop.kt` (modified, +24/-20)
```diff
@@ -9,7 +9,6 @@ import dev.datlag.kcef.KCEF
 import dev.datlag.kcef.KCEFBrowser
 import dev.datlag.kcef.KCEFClient
 import org.cef.browser.CefRendering
-import org.cef.browser.CefRequestContext
 import java.util.concurrent.TimeUnit
 
 /**
@@ -53,7 +52,6 @@ actual class WebViewFactoryParam(
             CefRendering.DEFAULT
         }
     inline val transparent: Boolean get() = webSettings.desktopWebSettings.transparent
-    val requestContext: CefRequestContext get() = createModifiedRequestContext(webSettings)
 }
 
 actual class PlatformWebViewParams
@@ -62,33 +60,39 @@ actual class PlatformWebViewParams
 actual fun defaultWebViewFactory(param: WebViewFactoryParam): NativeWebView =
     when (val content = param.state.content) {
         is WebContent.Url ->
-            param.client.createBrowser(
-                content.url,
-                param.rendering,
-                param.transparent,
-                param.requestContext,
-            )
+            param.client
+                .also {
+                    it.addRequestHandler(createModifiedRequestHandler(param.webSettings))
+                }.createBrowser(
+                    content.url,
+                    param.rendering,
+                    param.transparent,
+                )
         is WebContent.Data ->
             param.client.createBrowser(
                 KCEFBrowser.BLANK_URI,
                 param.rendering,
                 param.transparent,
             )
         is WebContent.File -> {
-            param.client.createBrowser(
-                KCEFBrowser.BLANK_URI,
-                param.rendering,
-                param.transparent,
-                param.requestContext,
-            )
+            param.client
+                .also {
+                    it.addRequestHandler(createModifiedRequestHandler(param.webSettings))
+                }.createBrowser(
+                    KCEFBrowser.BLANK_URI,
+                    param.rendering,
+                    param.transparent,
+                )
         }
         else ->
-            param.client.createBrowser(
-                KCEFBrowser.BLANK_URI,
-                param.rendering,
-                param.transparent,
-                param.requestContext,
-            )
+            param.client
+                .also {
+                    it.addRequestHandler(createModifiedRequestHandler(param.webSettings))
+                }.createBrowser(
+                    KCEFBrowser.BLANK_URI,
+                    param.rendering,
+                    param.transparent,
+                )
     }
 
 /**
```

---

### Incident Patch 3: `2936727e` (2025-10-03)
**Commit Message**: Set UIScrollViewContentInsetAdjustment to never.

**File**: `webview/src/iosMain/kotlin/com/multiplatform/webview/web/WebView.ios.kt` (modified, +2/-6)
```diff
@@ -151,12 +151,8 @@ fun IOSWebView(
                             scrollEnabled = it.scrollEnabled
                             showsHorizontalScrollIndicator = it.showHorizontalScrollIndicator
                             showsVerticalScrollIndicator = it.showVerticalScrollIndicator
-                            if (
-                                platform.UIKit.UIDevice.currentDevice.systemVersion
-                                    .toDouble() >= 11.0
-                            ) {
-                                contentInsetAdjustmentBehavior = platform.UIKit.UIScrollViewContentInsetAdjustmentBehavior.UIScrollViewContentInsetAdjustmentNever
-                            }
+                            contentInsetAdjustmentBehavior =
+                                platform.UIKit.UIScrollViewContentInsetAdjustmentBehavior.UIScrollViewContentInsetAdjustmentNever
                         }
                     }
 
```

---

### Incident Patch 4: `d72bf2b4` (2025-09-30)
**Commit Message**: Merge pull request #367 from adamhill/adamhill/fix-desktop-docs

bug(desktop): Fix macOS Desktop crash

**File**: `README.desktop.md` (modified, +11/-6)
```diff
@@ -84,15 +84,20 @@ Make sure to include platform-required Flags to your compose configuration: [Dat
 compose.desktop {
   application {
     // all your other configuration, etc
+  }
+}
 
-    jvmArgs("--add-opens", "java.desktop/sun.awt=ALL-UNNAMED")
-    jvmArgs("--add-opens", "java.desktop/java.awt.peer=ALL-UNNAMED") // recommended but not necessary
+afterEvaluate {
+    tasks.withType<JavaExec> {
+        jvmArgs("--add-opens", "java.desktop/sun.awt=ALL-UNNAMED")
+        jvmArgs("--add-opens", "java.desktop/java.awt.peer=ALL-UNNAMED")
 
-    if (System.getProperty("os.name").contains("Mac")) {
-      jvmArgs("--add-opens", "java.desktop/sun.lwawt=ALL-UNNAMED")
-      jvmArgs("--add-opens", "java.desktop/sun.lwawt.macosx=ALL-UNNAMED")
+        if (System.getProperty("os.name").contains("Mac")) {
+            jvmArgs("--add-opens", "java.desktop/sun.awt=ALL-UNNAMED")
+            jvmArgs("--add-opens", "java.desktop/sun.lwawt=ALL-UNNAMED")
+            jvmArgs("--add-opens", "java.desktop/sun.lwawt.macosx=ALL-UNNAMED")
+        }
     }
-  }
 }
 ```
 ## ProGuard
```

---

### Incident Patch 5: `8bd491e6` (2025-09-07)
**Commit Message**: bug(desktop): Update JVM arguments for desktop application

Refactor JVM arguments for macOS compatibility and organization.

Note: I had to do it this way *exactly* to get it to work on macOS Tahoe 26. No idea why or if the OS matters. It does have one additional JVM argument compared to the original instructions

**File**: `README.desktop.md` (modified, +11/-6)
```diff
@@ -84,15 +84,20 @@ Make sure to include platform-required Flags to your compose configuration: [Dat
 compose.desktop {
   application {
     // all your other configuration, etc
+  }
+}
 
-    jvmArgs("--add-opens", "java.desktop/sun.awt=ALL-UNNAMED")
-    jvmArgs("--add-opens", "java.desktop/java.awt.peer=ALL-UNNAMED") // recommended but not necessary
+afterEvaluate {
+    tasks.withType<JavaExec> {
+        jvmArgs("--add-opens", "java.desktop/sun.awt=ALL-UNNAMED")
+        jvmArgs("--add-opens", "java.desktop/java.awt.peer=ALL-UNNAMED")
 
-    if (System.getProperty("os.name").contains("Mac")) {
-      jvmArgs("--add-opens", "java.desktop/sun.lwawt=ALL-UNNAMED")
-      jvmArgs("--add-opens", "java.desktop/sun.lwawt.macosx=ALL-UNNAMED")
+        if (System.getProperty("os.name").contains("Mac")) {
+            jvmArgs("--add-opens", "java.desktop/sun.awt=ALL-UNNAMED")
+            jvmArgs("--add-opens", "java.desktop/sun.lwawt=ALL-UNNAMED")
+            jvmArgs("--add-opens", "java.desktop/sun.lwawt.macosx=ALL-UNNAMED")
+        }
     }
-  }
 }
 ```
 ## ProGuard
```

---

### Incident Patch 6: `b25faa3a` (2025-08-21)
**Commit Message**: Merge pull request #349 from StijnDRZP/fix/set-inspectable-crash

Fix: Conditionally set inspectable property on iOS

**File**: `webview/src/iosMain/kotlin/com/multiplatform/webview/web/WebView.ios.kt` (modified, +19/-1)
```diff
@@ -11,8 +11,11 @@ import androidx.compose.ui.viewinterop.UIKitView
 import com.multiplatform.webview.jsbridge.WebViewJsBridge
 import com.multiplatform.webview.util.toUIColor
 import kotlinx.cinterop.ExperimentalForeignApi
+import kotlinx.cinterop.cValue
 import kotlinx.cinterop.readValue
 import platform.CoreGraphics.CGRectZero
+import platform.Foundation.NSOperatingSystemVersion
+import platform.Foundation.NSProcessInfo
 import platform.Foundation.setValue
 import platform.WebKit.WKAudiovisualMediaTypeAll
 import platform.WebKit.WKAudiovisualMediaTypeNone
@@ -149,7 +152,22 @@ fun IOSWebView(
                         }
                     }
 
-                    this.setInspectable(state.webSettings.iOSWebSettings.isInspectable)
+                    /**
+                     * Sets the inspectable property of the WKWebView.
+                     * This is only done if the operating system version is iOS 16.4 or later
+                     * to prevent crashes on lower versions where the `setInspectable` method is not available.
+                     * Enabling this allows Safari Web Inspector to debug the content of the WebView.
+                     * The value is determined by `state.webSettings.iOSWebSettings.isInspectable`.
+                     */
+                    val minSetInspectableVersion =
+                        cValue<NSOperatingSystemVersion> {
+                            majorVersion = 16
+                            minorVersion = 4
+                            patchVersion = 0
+                        }
+                    if (NSProcessInfo.processInfo.isOperatingSystemAtLeastVersion(minSetInspectableVersion)) {
+                        this.setInspectable(state.webSettings.iOSWebSettings.isInspectable)
+                    }
                 }.also {
                     val iosWebView = IOSWebView(it, scope, webViewJsBridge)
                     state.webView = iosWebView
```

---

### Incident Patch 7: `c0d7bf65` (2025-08-14)
**Commit Message**: Currently possible fix for #354

**File**: `webview/src/desktopMain/kotlin/com/multiplatform/webview/web/WebView.desktop.kt` (modified, +24/-19)
```diff
@@ -1,12 +1,6 @@
 package com.multiplatform.webview.web
 
-import androidx.compose.runtime.Composable
-import androidx.compose.runtime.DisposableEffect
-import androidx.compose.runtime.LaunchedEffect
-import androidx.compose.runtime.getValue
-import androidx.compose.runtime.remember
-import androidx.compose.runtime.rememberCoroutineScope
-import androidx.compose.runtime.rememberUpdatedState
+import androidx.compose.runtime.*
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.awt.SwingPanel
 import com.multiplatform.webview.jsbridge.WebViewJsBridge
@@ -15,6 +9,7 @@ import dev.datlag.kcef.KCEFBrowser
 import dev.datlag.kcef.KCEFClient
 import org.cef.browser.CefRendering
 import org.cef.browser.CefRequestContext
+import java.util.concurrent.TimeUnit
 
 /**
  * Desktop WebView implementation.
@@ -142,18 +137,28 @@ fun DesktopWebView(
     }
 
     browser?.let {
-        SwingPanel(
-            factory = {
-                onCreated(it)
-                browser.apply {
-                    addDisplayHandler(state)
-                    addLoadListener(state, navigator)
-                    addRequestHandler(state, navigator)
-                }
-                browser.uiComponent
-            },
-            modifier = modifier,
-        )
+        if (runCatching { browser.windowlessFrameRate.get(100L, TimeUnit.MILLISECONDS) }.getOrNull() == null) {
+            SwingPanel(
+                factory = {
+                    onCreated(browser)
+                    browser.apply {
+                        addDisplayHandler(state)
+                        addLoadListener(state, navigator)
+                        addRequestHandler(state, navigator)
+                    }
+                    browser.uiComponent
+                },
+                modifier = modifier,
+            )
+        } else {
+            onCreated(browser)
+            browser.apply {
+                addDisplayHandler(state)
+                addLoadListener(state, navigator)
+                addRequestHandler(state, navigator)
+            }
+            browser.uiComponent.size = java.awt.Dimension(1280, 720)
+        }
     }
 
     DisposableEffect(Unit) {
```

---

### Incident Patch 8: `14c37483` (2025-08-14)
**Commit Message**: onLoadEnd duplicate fix for #352

**File**: `webview/src/desktopMain/kotlin/com/multiplatform/webview/web/WebEngineExt.kt` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ internal fun CefBrowser.addLoadListener(
                 KLogger.d { "Load End ${browser?.url}" }
                 state.loadingState = LoadingState.Finished
                 navigator.canGoBack = canGoBack()
-                navigator.canGoBack = canGoForward()
+                navigator.canGoForward = canGoForward()
                 state.lastLoadedUrl = getCurrentUrl()
             }
 
```

---

### Incident Patch 9: `13572ead` (2025-08-12)
**Commit Message**: Fix: Conditionally set inspectable property on iOS

This commit updates the iOS WebView implementation to conditionally set the `inspectable` property on `WKWebView`.

The `setInspectable` method is only called if the operating system version is iOS 16.4 or later. This prevents potential crashes on older iOS versions where this method is not available.

**File**: `webview/src/iosMain/kotlin/com/multiplatform/webview/web/WebView.ios.kt` (modified, +18/-1)
```diff
@@ -11,8 +11,11 @@ import androidx.compose.ui.viewinterop.UIKitView
 import com.multiplatform.webview.jsbridge.WebViewJsBridge
 import com.multiplatform.webview.util.toUIColor
 import kotlinx.cinterop.ExperimentalForeignApi
+import kotlinx.cinterop.cValue
 import kotlinx.cinterop.readValue
 import platform.CoreGraphics.CGRectZero
+import platform.Foundation.NSOperatingSystemVersion
+import platform.Foundation.NSProcessInfo
 import platform.Foundation.setValue
 import platform.WebKit.WKAudiovisualMediaTypeAll
 import platform.WebKit.WKAudiovisualMediaTypeNone
@@ -149,7 +152,21 @@ fun IOSWebView(
                         }
                     }
 
-                    this.setInspectable(state.webSettings.iOSWebSettings.isInspectable)
+                    /**
+                     * Sets the inspectable property of the WKWebView.
+                     * This is only done if the operating system version is iOS 16.4 or later
+                     * to prevent crashes on lower versions where the `setInspectable` method is not available.
+                     * Enabling this allows Safari Web Inspector to debug the content of the WebView.
+                     * The value is determined by `state.webSettings.iOSWebSettings.isInspectable`.
+                     */
+                    val minSetInspectableVersion = cValue<NSOperatingSystemVersion> {
+                        majorVersion = 16
+                        minorVersion = 4
+                        patchVersion = 0
+                    }
+                    if (NSProcessInfo.processInfo.isOperatingSystemAtLeastVersion(minSetInspectableVersion)) {
+                        this.setInspectable(state.webSettings.iOSWebSettings.isInspectable)
+                    }
                 }.also {
                     val iosWebView = IOSWebView(it, scope, webViewJsBridge)
                     state.webView = iosWebView
```

---

### Incident Patch 10: `6d22b5fe` (2025-08-11)
**Commit Message**: Merge pull request #348 from amirghm/bugfix/fix-wasmjs-custom-jsbridge-name

Bugfix/fix wasmjs custom jsbridge name

**File**: `gradle.properties` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ android.minSdk=21
 #Versions
 GROUP=io.github.kevinnzou
 POM_ARTIFACT_ID=compose-webview-multiplatform
-VERSION_NAME=2.0.2
+VERSION_NAME=2.0.3
 POM_NAME=Compose WebView Multiplatform
 POM_INCEPTION_YEAR=2023
 POM_DESCRIPTION=WebView for JetBrains Compose Multiplatform
```

**File**: `webview/src/wasmJsMain/kotlin/com/multiplatform/webview/web/WasmJsWebView.kt` (modified, +1/-1)
```diff
@@ -176,7 +176,7 @@ class WasmJsWebView(
                 try {
                     val dataString = messageEvent.data.toString()
 
-                    if (dataString.contains("kmpJsBridge")) {
+                    if (dataString.contains(webViewJsBridge.jsBridgeName)) {
                         val actionPattern = """action[=:][\s]*['"](.*?)['"]""".toRegex()
                         val paramsPattern = """params[=:][\s]*['"](.*?)['"]""".toRegex()
                         val callbackPattern = """callbackId[=:][\s]*(\d+)""".toRegex()
```

**File**: `webview/src/wasmJsMain/kotlin/com/multiplatform/webview/web/WebView.wasmJs.kt` (modified, +1/-1)
```diff
@@ -314,7 +314,7 @@ private fun setupJsBridgeForWasm(
             try {
                 val dataString = messageEvent.data.toString()
 
-                if (dataString.contains("kmpJsBridge") && dataString.startsWith("{")) {
+                if (dataString.contains(webViewJsBridge.jsBridgeName) && dataString.startsWith("{")) {
                     val actionPattern = """"action"\s*:\s*"([^"]*)"""".toRegex()
                     val paramsPattern = """"params"\s*:\s*"((?:[^"\\]|\\.)*)"""".toRegex()
                     val callbackPattern = """"callbackId"\s*:\s*(\d+)""".toRegex()
```

**File**: `webview/src/wasmJsMain/kotlin/com/multiplatform/webview/web/WebViewJsBridge.kt` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ internal fun createJsBridgeScript(
             postMessage: function(methodName, params, callbackId) {
                 // Send as JSON string instead of object to ensure proper parsing
                 var messageData = JSON.stringify({
-                    type: 'kmpJsBridge',
+                    type: '$jsBridgeName',
                     action: methodName,
                     params: params,
                     callbackId: callbackId || 0
@@ -55,7 +55,7 @@ internal fun createJsBridgeScript(
         window.addEventListener('message', function(event) {
             try {
                 var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
-                if (data && data.type === 'kmpJsBridgeCallback') {
+                if (data && data.type === '$jsBridgeName') {
                     window.$jsBridgeName.onCallback(data.callbackId, data.message);
                 }
             } catch (e) {
```

---

### Incident Patch 11: `b429cd25` (2025-08-10)
**Commit Message**: Fix: Use configurable jsBridgeName in WasmJs and update version

This commit updates the WasmJs WebView implementation to use the `webViewJsBridge.jsBridgeName` property instead of the hardcoded "kmpJsBridge" string when identifying and processing messages from the JavaScript bridge. This allows for customization of the bridge name.

**WasmJs:**
- In `WasmJsWebView.kt` and `WebView.wasmJs.kt`, message handling logic now checks for `webViewJsBridge.jsBridgeName` in the incoming `dataString`.
- In `WebViewJsBridge.kt`, the injected JavaScript code for `postMessage` and the event listener now uses the dynamic `jsBridgeName` property for the `type` field in messages.

**Build:**
- Incremented `VERSION_NAME` to `2.0.3`.

**File**: `gradle.properties` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ android.minSdk=21
 #Versions
 GROUP=io.github.kevinnzou
 POM_ARTIFACT_ID=compose-webview-multiplatform
-VERSION_NAME=2.0.2
+VERSION_NAME=2.0.3
 POM_NAME=Compose WebView Multiplatform
 POM_INCEPTION_YEAR=2023
 POM_DESCRIPTION=WebView for JetBrains Compose Multiplatform
```

**File**: `webview/src/wasmJsMain/kotlin/com/multiplatform/webview/web/WasmJsWebView.kt` (modified, +1/-1)
```diff
@@ -176,7 +176,7 @@ class WasmJsWebView(
                 try {
                     val dataString = messageEvent.data.toString()
 
-                    if (dataString.contains("kmpJsBridge")) {
+                    if (dataString.contains(webViewJsBridge.jsBridgeName)) {
                         val actionPattern = """action[=:][\s]*['"](.*?)['"]""".toRegex()
                         val paramsPattern = """params[=:][\s]*['"](.*?)['"]""".toRegex()
                         val callbackPattern = """callbackId[=:][\s]*(\d+)""".toRegex()
```

**File**: `webview/src/wasmJsMain/kotlin/com/multiplatform/webview/web/WebView.wasmJs.kt` (modified, +1/-1)
```diff
@@ -314,7 +314,7 @@ private fun setupJsBridgeForWasm(
             try {
                 val dataString = messageEvent.data.toString()
 
-                if (dataString.contains("kmpJsBridge") && dataString.startsWith("{")) {
+                if (dataString.contains(webViewJsBridge.jsBridgeName) && dataString.startsWith("{")) {
                     val actionPattern = """"action"\s*:\s*"([^"]*)"""".toRegex()
                     val paramsPattern = """"params"\s*:\s*"((?:[^"\\]|\\.)*)"""".toRegex()
                     val callbackPattern = """"callbackId"\s*:\s*(\d+)""".toRegex()
```

**File**: `webview/src/wasmJsMain/kotlin/com/multiplatform/webview/web/WebViewJsBridge.kt` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ internal fun createJsBridgeScript(
             postMessage: function(methodName, params, callbackId) {
                 // Send as JSON string instead of object to ensure proper parsing
                 var messageData = JSON.stringify({
-                    type: 'kmpJsBridge',
+                    type: '$jsBridgeName',
                     action: methodName,
                     params: params,
                     callbackId: callbackId || 0
@@ -55,7 +55,7 @@ internal fun createJsBridgeScript(
         window.addEventListener('message', function(event) {
             try {
                 var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
-                if (data && data.type === 'kmpJsBridgeCallback') {
+                if (data && data.type === '$jsBridgeName') {
                     window.$jsBridgeName.onCallback(data.callbackId, data.message);
                 }
             } catch (e) {
```

---

### Incident Patch 12: `1f328bcd` (2025-07-22)
**Commit Message**: Fix linting

**File**: `webview/src/iosMain/kotlin/com/multiplatform/webview/web/WebView.ios.kt` (modified, +6/-5)
```diff
@@ -167,11 +167,12 @@ fun IOSWebView(
         },
         properties =
             UIKitInteropProperties(
-                interactionMode = if (state.webSettings.iOSWebSettings.scrollEnabled) {
-                    UIKitInteropInteractionMode.NonCooperative
-                } else {
-                    UIKitInteropInteractionMode.Cooperative()
-                },
+                interactionMode =
+                    if (state.webSettings.iOSWebSettings.scrollEnabled) {
+                        UIKitInteropInteractionMode.NonCooperative
+                    } else {
+                        UIKitInteropInteractionMode.Cooperative()
+                    },
                 isNativeAccessibilityEnabled = true,
             ),
     )
```

---

### Incident Patch 13: `09e1fe05` (2025-07-21)
**Commit Message**: Merge pull request #335 from amirghm/bugfix/fix-load-file-in-ios-real-device

Fix: Improve local file loading on iOS and update version

**File**: `gradle.properties` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ android.minSdk=21
 #Versions
 GROUP=io.github.kevinnzou
 POM_ARTIFACT_ID=compose-webview-multiplatform
-VERSION_NAME=2.0.1
+VERSION_NAME=2.0.2
 POM_NAME=Compose WebView Multiplatform
 POM_INCEPTION_YEAR=2023
 POM_DESCRIPTION=WebView for JetBrains Compose Multiplatform
```

**File**: `webview/src/iosMain/kotlin/com/multiplatform/webview/web/IOSWebView.kt` (modified, +31/-0)
```diff
@@ -12,11 +12,15 @@ import kotlinx.cinterop.useContents
 import kotlinx.coroutines.CoroutineScope
 import platform.Foundation.HTTPBody
 import platform.Foundation.HTTPMethod
+import platform.Foundation.NSArray
 import platform.Foundation.NSBundle
 import platform.Foundation.NSData
+import platform.Foundation.NSDocumentDirectory
 import platform.Foundation.NSMutableURLRequest
+import platform.Foundation.NSSearchPathForDirectoriesInDomains
 import platform.Foundation.NSString
 import platform.Foundation.NSURL
+import platform.Foundation.NSUserDomainMask
 import platform.Foundation.create
 import platform.Foundation.setValue
 import platform.Foundation.stringByDeletingLastPathComponent
@@ -50,6 +54,33 @@ class IOSWebView(
         url: String,
         additionalHttpHeaders: Map<String, String>,
     ) {
+        // Check if it's a file URL
+        if (url.startsWith("file://")) {
+            val fileURL = NSURL(string = url)
+            if (fileURL != null && fileURL.isFileURL()) {
+                // Use document directory for read access to fix real device issues
+                val documentPaths =
+                    NSSearchPathForDirectoriesInDomains(
+                        NSDocumentDirectory,
+                        NSUserDomainMask,
+                        true,
+                    ) as NSArray
+                val readAccessURL =
+                    if (documentPaths.count > 0u) {
+                        val documentPath = documentPaths.objectAtIndex(0u) as? String
+                        documentPath?.let { NSURL.fileURLWithPath(it) }
+                    } else {
+                        null
+                    }
+
+                if (readAccessURL != null) {
+                    webView.loadFileURL(fileURL, readAccessURL)
+                    return
+                }
+            }
+        }
+
+        // Handle regular HTTP/HTTPS URLs
         val request =
             NSMutableURLRequest.requestWithURL(
                 URL = NSURL(string = url),
```

---

### Incident Patch 14: `0dbf061d` (2025-07-12)
**Commit Message**: Merge pull request #4 from amirghm/bugfix/fix-load-file-in-ios-real-device

Bugfix/fix load file in ios real device

**File**: `gradle.properties` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ android.minSdk=21
 #Versions
 GROUP=io.github.kevinnzou
 POM_ARTIFACT_ID=compose-webview-multiplatform
-VERSION_NAME=2.0.1
+VERSION_NAME=2.0.2
 POM_NAME=Compose WebView Multiplatform
 POM_INCEPTION_YEAR=2023
 POM_DESCRIPTION=WebView for JetBrains Compose Multiplatform
```

**File**: `webview/src/iosMain/kotlin/com/multiplatform/webview/web/IOSWebView.kt` (modified, +31/-0)
```diff
@@ -12,11 +12,15 @@ import kotlinx.cinterop.useContents
 import kotlinx.coroutines.CoroutineScope
 import platform.Foundation.HTTPBody
 import platform.Foundation.HTTPMethod
+import platform.Foundation.NSArray
 import platform.Foundation.NSBundle
 import platform.Foundation.NSData
+import platform.Foundation.NSDocumentDirectory
 import platform.Foundation.NSMutableURLRequest
+import platform.Foundation.NSSearchPathForDirectoriesInDomains
 import platform.Foundation.NSString
 import platform.Foundation.NSURL
+import platform.Foundation.NSUserDomainMask
 import platform.Foundation.create
 import platform.Foundation.setValue
 import platform.Foundation.stringByDeletingLastPathComponent
@@ -50,6 +54,33 @@ class IOSWebView(
         url: String,
         additionalHttpHeaders: Map<String, String>,
     ) {
+        // Check if it's a file URL
+        if (url.startsWith("file://")) {
+            val fileURL = NSURL(string = url)
+            if (fileURL != null && fileURL.isFileURL()) {
+                // Use document directory for read access to fix real device issues
+                val documentPaths =
+                    NSSearchPathForDirectoriesInDomains(
+                        NSDocumentDirectory,
+                        NSUserDomainMask,
+                        true,
+                    ) as NSArray
+                val readAccessURL =
+                    if (documentPaths.count > 0u) {
+                        val documentPath = documentPaths.objectAtIndex(0u) as? String
+                        documentPath?.let { NSURL.fileURLWithPath(it) }
+                    } else {
+                        null
+                    }
+
+                if (readAccessURL != null) {
+                    webView.loadFileURL(fileURL, readAccessURL)
+                    return
+                }
+            }
+        }
+
+        // Handle regular HTTP/HTTPS URLs
         val request =
             NSMutableURLRequest.requestWithURL(
                 URL = NSURL(string = url),
```

---

### Incident Patch 15: `30cf2ae1` (2025-07-12)
**Commit Message**: Refactor and fix ktlint issues

**File**: `webview/src/iosMain/kotlin/com/multiplatform/webview/web/IOSWebView.kt` (modified, +20/-16)
```diff
@@ -12,21 +12,21 @@ import kotlinx.cinterop.useContents
 import kotlinx.coroutines.CoroutineScope
 import platform.Foundation.HTTPBody
 import platform.Foundation.HTTPMethod
+import platform.Foundation.NSArray
 import platform.Foundation.NSBundle
 import platform.Foundation.NSData
+import platform.Foundation.NSDocumentDirectory
 import platform.Foundation.NSMutableURLRequest
+import platform.Foundation.NSSearchPathForDirectoriesInDomains
 import platform.Foundation.NSString
 import platform.Foundation.NSURL
+import platform.Foundation.NSUserDomainMask
 import platform.Foundation.create
 import platform.Foundation.setValue
 import platform.Foundation.stringByDeletingLastPathComponent
 import platform.WebKit.WKWebView
 import platform.darwin.NSObject
 import platform.darwin.NSObjectMeta
-import platform.Foundation.NSSearchPathForDirectoriesInDomains
-import platform.Foundation.NSDocumentDirectory
-import platform.Foundation.NSUserDomainMask
-import platform.Foundation.NSArray
 
 /**
  * Created By Kevin Zou On 2023/9/5
@@ -59,15 +59,19 @@ class IOSWebView(
             val fileURL = NSURL(string = url)
             if (fileURL != null && fileURL.isFileURL()) {
                 // Use document directory for read access to fix real device issues
-                val documentPaths = NSSearchPathForDirectoriesInDomains(
-                    NSDocumentDirectory,
-                    NSUserDomainMask,
-                    true
-                ) as NSArray
-                val readAccessURL = if (documentPaths.count > 0u) {
-                    val documentPath = documentPaths.objectAtIndex(0u) as? String
-                    documentPath?.let { NSURL.fileURLWithPath(it) }
-                } else null
+                val documentPaths =
+                    NSSearchPathForDirectoriesInDomains(
+                        NSDocumentDirectory,
+                        NSUserDomainMask,
+                        true,
+                    ) as NSArray
+                val readAccessURL =
+                    if (documentPaths.count > 0u) {
+                        val documentPath = documentPaths.objectAtIndex(0u) as? String
+                        documentPath?.let { NSURL.fileURLWithPath(it) }
+                    } else {
+                        null
+                    }
 
                 if (readAccessURL != null) {
                     webView.loadFileURL(fileURL, readAccessURL)
@@ -124,7 +128,7 @@ class IOSWebView(
                 WebViewFileReadType.ASSET_RESOURCES -> {
                     val resourcePath =
                         (NSBundle.mainBundle.resourcePath ?: "") +
-                                "/compose-resources/assets/" + fileName
+                            "/compose-resources/assets/" + fileName
                     fileURL = NSURL.fileURLWithPath(resourcePath)
 
                     val parentDir = (resourcePath as NSString).stringByDeletingLastPathComponent()
@@ -158,11 +162,11 @@ class IOSWebView(
             if (finalReadAccessURL.path.isNullOrEmpty()) {
                 KLogger.e {
                     "Critical: finalReadAccessURL is null or has an empty path. " +
-                            "Cannot load file with proper read access for ${fileURL.absoluteString}"
+                        "Cannot load file with proper read access for ${fileURL.absoluteString}"
                 }
                 loadHtml(
                     "<html><body>Error: Cannot determine read access URL " +
-                            "for ${fileURL.absoluteString}</body></html>",
+                        "for ${fileURL.absoluteString}</body></html>",
                 )
                 return
             }
```

#### Recent Merged Pull Requests:
- **PR #409** (closed): release v1.0.3 (@jehux)
- **PR #398** (2025-12-23): (Desktop) Set UA via request handler instead of context: Fixes CookieManager (@threethan)
- **PR #396** (closed): (Desktop) Set UA via request handler instead of context: Fixes CookieManager (@threethan)
- **PR #383** (2025-10-29): Fix: Prevent duplicate JS bridge injection on desktop (@zaroxh)
- **PR #378** (2025-10-17): bugfix: WebView not ignoring safe area in full-screen mode on iOS (@Erkko68)
- **PR #372** (2025-09-30): Feat: Add Console bridge for android (@amirghm)
- **PR #367** (2025-09-30): bug(desktop): Fix macOS Desktop crash (@adamhill)
- **PR #361** (2025-08-30): Don't run evaluateJavascript inside the webView.post callback (@serso)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
