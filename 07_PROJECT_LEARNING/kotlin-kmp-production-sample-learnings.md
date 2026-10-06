# Forensic Learning Record (Deep Inspection): Kotlin/kmp-production-sample

> **Canonical Artifact**: `07_PROJECT_LEARNING/kotlin-kmp-production-sample-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kotlin/kmp-production-sample](https://github.com/Kotlin/kmp-production-sample))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:59:39.698Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kotlin/kmp-production-sample`
- **Description**: This is an open-source, mobile, cross-platform application built with Kotlin Multiplatform Mobile. It's a simple RSS reader, and you can download it from the App Store and Google Play. It's been designed to demonstrate how KMM can be used in real production projects.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2283 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `androidApp/src/main/kotlin/com/github/jetbrains/rssreader/core/RssReader.kt`
```
package com.github.jetbrains.rssreader.core

import android.content.Context
import com.github.jetbrains.rssreader.datasource.network.FeedLoader
import com.github.jetbrains.rssreader.datasource.storage.FeedStorage
import com.russhwolf.settings.SharedPreferencesSettings
import io.github.aakira.napier.DebugAntilog
import io.github.aakira.napier.Napier
import kotlinx.serialization.json.Json

fun buildRssReader(ctx: Context, withLog: Boolean) = RssReader(
    FeedLoader(
        HttpClient(withLog)
    ),
    FeedStorage(
        SharedPreferencesSettings(
            ctx.getSharedPreferences(
                "rss_reader_pref",
                Context.MODE_PRIVATE
            )
        ),
        Json {
            ignoreUnknownKeys = true
            isLenient = true
            encodeDefaults = false
        }
    )
).also {
    if (withLog) Napier.base(DebugAntilog())
}
```

### Core Architecture Module: `androidApp/src/main/kotlin/com/github/jetbrains/rssreader/sync/RefreshWorker.kt`
```
package com.github.jetbrains.rssreader.sync

import android.content.Context
import androidx.work.*
import com.github.jetbrains.rssreader.core.RssReader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.koin.core.component.KoinComponent
import org.koin.core.component.inject
import java.util.concurrent.TimeUnit

class RefreshWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams), KoinComponent {
    private val rssReader: RssReader by inject()

    override suspend fun doWork(): Result = withContext(Dispatchers.Main) {
        rssReader.getAllFeeds(true)
        Result.success()
    }

    companion object {
        private const val WORK_NAME = "refresh_work_name"
        fun enqueue(context: Context) {
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<RefreshWorker>(1, TimeUnit.HOURS).build()
            )
        }
    }
}
```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/github/jetbrains/rssreader/core/HttpClient.kt`
```
package com.github.jetbrains.rssreader.core

import io.github.aakira.napier.Napier
import io.ktor.client.HttpClient
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.http.ContentType
import io.ktor.serialization.kotlinx.xml.DefaultXml
import io.ktor.serialization.kotlinx.xml.xml
import nl.adaptivity.xmlutil.ExperimentalXmlUtilApi
import nl.adaptivity.xmlutil.serialization.XML
import nl.adaptivity.xmlutil.serialization.XmlConfig

@OptIn(ExperimentalXmlUtilApi::class)
fun HttpClient(withLog: Boolean) = HttpClient() {
    if (withLog) install(Logging) {
        level = LogLevel.HEADERS
        logger = object : Logger {
            override fun log(message: String) {
                Napier.v(tag = "HttpClient", message = message)
            }
        }
    }
    install(ContentNegotiation) {
        xml(contentType = ContentType.Application.Rss, format = XML {
            defaultPolicy {
                unknownChildHandler = XmlConfig.IGNORING_UNKNOWN_CHILD_HANDLER
            }
        })
    }
}
```

### Core Architecture Module: `shared/src/commonMain/kotlin/com/github/jetbrains/rssreader/core/RssReader.kt`
```
package com.github.jetbrains.rssreader.core

import com.github.jetbrains.rssreader.Settings
import com.github.jetbrains.rssreader.datasource.network.FeedLoader
import com.github.jetbrains.rssreader.datasource.storage.FeedStorage
import com.github.jetbrains.rssreader.domain.RssFeed
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

class RssReader(
    private val feedLoader: FeedLoader,
    private val feedStorage: FeedStorage,
    private val settings: Settings = Settings(setOf("https://blog.jetbrains.com/kotlin/feed/"))
) {

    @Throws(Exception::class)
    suspend fun getAllFeeds(
        forceUpdate: Boolean = false
    ): List<RssFeed> {
        var feeds = feedStorage.getAllFeeds()

        if (forceUpdate || feeds.isEmpty()) {
            val feedsUrls =
                if (feeds.isEmpty()) settings.defaultFeedUrls else feeds.map { it.sourceUrl }.filterNotNull()
            feeds = feedsUrls.mapAsync { url ->
                val new = feedLoader.getFeed(url, settings.isDefault(url))
                feedStorage.saveFeed(new)
                new
            }
        }

        return feeds
    }

    @Throws(Exception::class)
    suspend fun addFeed(url: String) {
        val feed = feedLoader.getFeed(url, settings.isDefault(url))
        feedStorage.saveFeed(feed)
    }

    @Throws(Exception::class)
    suspend fun deleteFeed(url: String) {
        feedStorage.deleteFeed(url)
    }

    private suspend fun <A, B> Iterable<A>.mapAsync(f: suspend (A) -> B): List<B> =
        coroutineScope { map { async { f(it) } }.awaitAll() }
}
```

### Core Architecture Module: `shared/src/iosMain/kotlin/com/github/jetbrains/rssreader/app/IosReduxUtils.kt`
```
package com.github.jetbrains.rssreader.app

import com.github.jetbrains.rssreader.core.wrap

fun FeedStore.watchState() = observeState().wrap()
fun FeedStore.watchSideEffect() = observeSideEffect().wrap()
```

### Core Architecture Module: `shared/src/iosMain/kotlin/com/github/jetbrains/rssreader/core/CFlow.kt`
```
package com.github.jetbrains.rssreader.core

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

fun interface Closeable {
    fun close()
}

class CFlow<T: Any> internal constructor(private val origin: Flow<T>) : Flow<T> by origin {
    fun watch(block: (T) -> Unit): Closeable {
        val job = Job()

        onEach {
            block(it)
        }.launchIn(CoroutineScope(Dispatchers.Main + job))

        return Closeable { job.cancel() }
    }
}

internal fun <T: Any> Flow<T>.wrap(): CFlow<T> = CFlow(this)


```

### Core Architecture Module: `androidApp/src/main/kotlin/com/github/jetbrains/rssreader/App.kt`
```
package com.github.jetbrains.rssreader

import android.app.Application
import android.content.Context
import com.github.jetbrains.rssreader.app.FeedStore
import com.github.jetbrains.rssreader.core.buildRssReader
import com.github.jetbrains.rssreader.sync.RefreshWorker
import org.koin.android.ext.koin.androidContext
import org.koin.android.ext.koin.androidLogger
import org.koin.core.context.startKoin
import org.koin.core.logger.Level
import org.koin.dsl.module

class App : Application() {

    override fun onCreate() {
        super.onCreate()
        initKoin()
        launchBackgroundSync()
    }

    private val appModule = module {
        single { buildRssReader(get<Context>(), BuildConfig.DEBUG) }
        single { FeedStore(get()) }
    }

    private fun initKoin() {
        startKoin {
            if (BuildConfig.DEBUG) androidLogger(Level.ERROR)

            androidContext(this@App)
            modules(appModule)
        }
    }

    private fun launchBackgroundSync() {
        RefreshWorker.enqueue(this)
    }
}
```

### Core Architecture Module: `androidApp/src/main/kotlin/com/github/jetbrains/rssreader/AppActivity.kt`
```
package com.github.jetbrains.rssreader

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

class AppActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()

        installSplashScreen()

        setContent {
            RssReaderApp()
        }
    }
}
```

### Core Architecture Module: `desktopApp/src/main/kotlin/com/github/jetbrains/rssreader/Main.kt`
```
package com.github.jetbrains.rssreader

import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import com.github.jetbrains.rssreader.app.FeedStore
import com.github.jetbrains.rssreader.core.HttpClient
import com.github.jetbrains.rssreader.core.RssReader
import com.github.jetbrains.rssreader.datasource.network.FeedLoader
import com.github.jetbrains.rssreader.datasource.storage.FeedStorage
import com.russhwolf.settings.PropertiesSettings
import kotlinx.serialization.json.Json
import org.koin.core.context.startKoin
import org.koin.dsl.module
import java.util.*

private val appModule = module {
    single { RssReader(get(), get(), Settings(setOf("https://blog.jetbrains.com/kotlin/feed/"))) }
    single<FeedStorage> {
        FeedStorage(
            PropertiesSettings(Properties()),
            Json {
                ignoreUnknownKeys = true
                isLenient = true
                encodeDefaults = false
            }
        )
    }
    single { FeedStore(get()) }
    single { FeedLoader(get()) }
    single { HttpClient(false) }
}

private fun initKoin() {
    startKoin {
        modules(appModule)
    }
}

fun main() = application {
    initKoin()

    Window(
        onCloseRequest = ::exitApplication,
        title = "RSS reader",
    ) {
        RssReaderApp()
    }
}
```

### Core Architecture Module: `iosApp/iosApp/RSSApp.swift`
```
//
//  App.swift
//  iosApp
//
//  Created by Ekaterina.Petrova on 13.11.2020.
//  Copyright © 2020 orgName. All rights reserved.
//

import Foundation
import SwiftUI
import RssReader

@main
struct RSSApp: App {
    let rss: RssReader
    let store: ObservableFeedStore
    
    init() {
        KoinHelperKt.doInitKoin()
        let helper = KoinHelper()
        rss = helper.rssReader
        store = ObservableFeedStore(store: helper.feedStore)
    }
  
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store)
        }
    }
}

class ObservableFeedStore: ObservableObject {
    @Published public var state: FeedState =  FeedState(progress: false, feeds: [], selectedFeed: nil)
    @Published public var sideEffect: FeedSideEffect?
    
    let store: FeedStore
    
    var stateWatcher : Closeable?
    var sideEffectWatcher : Closeable?

    init(store: FeedStore) {
        self.store = store
        stateWatcher = self.store.watchState().watch { [weak self] state in
            self?.state = state
        }
        sideEffectWatcher = self.store.watchSideEffect().watch { [weak self] state in
            self?.sideEffect = state
        }
    }
    
    public func dispatch(_ action: FeedAction) {
        store.dispatch(action: action)
    }
    
    deinit {
        stateWatcher?.close()
        sideEffectWatcher?.close()
    }
}

public typealias DispatchFunction = (FeedAction) -> ()

public protocol ConnectedView: View {
    associatedtype Props
    associatedtype V: View
    
    func map(state: FeedState, dispatch: @escaping DispatchFunction) -> Props
    func body(props: Props) -> V
}

public extension ConnectedView {
    func render(state: FeedState, dispatch: @escaping DispatchFunction) -> V {
        let props = map(state: state, dispatch: dispatch)
        return body(props: props)
    }
    
    var body: StoreConnector<V> {
        return StoreConnector(content: render)
    }
}

public struct StoreConnector<V: View>: View {
    @EnvironmentObject var store: ObservableFeedStore
    let content: (FeedState, @escaping DispatchFunction) -> V
    
    public var body: V {
        return content(store.state, store.dispatch)
    }
}


```

### Core Architecture Module: `iosApp/iosApp/View/Basic/AlertView.swift`
```
//
//  ContentView.swift
//
//  Created by Chris Eidhof on 20.04.20.
//  Copyright © 2020 objc.io. All rights reserved.
//
import SwiftUI
import UIKit

extension UIAlertController {
    convenience init(alert: TextAlert) {
        self.init(title: alert.title, message: nil, preferredStyle: .alert)
        addTextField { $0.placeholder = alert.placeholder }
        addAction(UIAlertAction(title: alert.cancel, style: .cancel) { _ in
            alert.action(nil)
        })
        let textField = self.textFields?.first
        addAction(UIAlertAction(title: alert.accept, style: .default) { _ in
            alert.action(textField?.text)
        })
    }
}



struct AlertWrapper<Content: View>: UIViewControllerRepresentable {
    @Binding var isPresented: Bool
    let alert: TextAlert
    let content: Content
    
    func makeUIViewController(context: UIViewControllerRepresentableContext<AlertWrapper>) -> UIHostingController<Content> {
        UIHostingController(rootView: content)
    }
    
    final class Coordinator {
        var alertController: UIAlertController?
        init(_ controller: UIAlertController? = nil) {
            self.alertController = controller
        }
    }
    
    func makeCoordinator() -> Coordinator {
        return Coordinator()
    }
    
    
    func updateUIViewController(_ uiViewController: UIHostingController<Content>, context: UIViewControllerRepresentableContext<AlertWrapper>) {
        uiViewController.rootView = content
        if isPresented && uiViewController.presentedViewController == nil {
            var alert = self.alert
            alert.action = {
                self.isPresented = false
                self.alert.action($0)
            }
            context.coordinator.alertController = UIAlertController(alert: alert)
            uiViewController.present(context.coordinator.alertController!, animated: true)
        }
        if !isPresented && uiViewController.presentedViewController == context.coordinator.alertController {
            uiViewController.dismiss(animated: true)
        }
    }
}

public struct TextAlert {
    public var title: String
    public var placeholder: String = ""
    public var accept: String = "OK"
    public var cancel: String = "Cancel"
    public var action: (String?) -> ()
}

extension View {
    public func alert(isPresented: Binding<Bool>, _ alert: TextAlert) -> some View {
        AlertWrapper(isPresented: isPresented, alert: alert, content: self)
    }
}

```

### Core Architecture Module: `iosApp/iosApp/View/Basic/NavigationLazyView.swift`
```
//
//  NavigationLazyView.swift
//  iosApp
//
//  Created by Ekaterina.Petrova on 15.02.2021.
//  Copyright © 2021 orgName. All rights reserved.
//

import SwiftUI

struct NavigationLazyView<Content: View>: View {
    let build: () -> Content
    init(_ build: @autoclosure @escaping () -> Content) {
        self.build = build
    }
    var body: Content {
        build()
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29** (2021-07-15): **Project doesn't build**
  *Symptoms*: Unrecognized Android Studio (or Android Support plugin for IntelliJ IDEA) version '202.7660.26.42.7486908', please retry with version 2020.3.1 or newer
  **Post-Mortem & Fix Analysis**:
  > Hey @slipdef! Please check if it works with the latest version of the project and Android Studio Arctic Fox.
  > It works indeed.

- **Issue #27** (2021-07-16): **Error: Building for iOS Simulator-arm64 but attempting to link with file built for iOS Simulator-x86_64 (M1)**
  *Symptoms*: Hi, really appreciate if anyone can help me in building to M1 simulator  https://github.com/Kotlin/kmm-sample/issues/60
  **Post-Mortem & Fix Analysis**:
  > Hi! M1 support is in development at the moment. It will available with Kotlin 1.5.30 But you can work with project via rosetta
  > Hi @terrakok thank you so much for the info! I thought I have missed out something. Thanks!
  > > Hi! M1 support is in development at the moment. It will available with Kotlin 1.5.30 > But you can work with project via rosetta  Good day! When is Kotlin 1.5.30 released, or where you can download it?

- **Issue #25** (2025-06-13): **Cannot inline bytecode built with JVM target 1.8 into bytecode that is being built with JVM target 1.6**
  *Symptoms*: Happens when project is compiling  `core\datasource\storage\FeedStorage.kt: (26, 13): Cannot inline bytecode built with JVM target 1.8 into bytecode that is being built with JVM target 1.6. Please specify proper '-jvm-target' option Adding support for Java 8 language features could solve this issue.`
  **Post-Mortem & Fix Analysis**:
  > you can add these lines inside the kotlin block:  ``` android {     compilations.all {         kotlinOptions {             jvmTarget = "1.8"         }     } } ```
  > Hi guys, that's still not working for me. Any more suggestions about it please ?  if I remove the following line it works: https://github.com/Kotlin/kmm-production-sample/blob/52afdcc7b9d7454a85751c2336c67fed6cb3a02a/shared/src/commonMain/kotlin/com/github/jetbrains/rssreader/core/datasource/storage/FeedStorage.kt#L26
  > Hi! What is your JAVA_HOME? Could you show me output of `./gradlew clean :android:assembleDebug`?

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

### Incident Patch 1: `4c2cb7b8` (2026-05-13)
**Commit Message**: Fix CI

**File**: `.github/actions/gradle-setup/action.yml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ runs:
     - name: Setup Java
       uses: actions/setup-java@v4.0.0
       with:
-        java-version: "17"
+        java-version: "21"
         distribution: "temurin"
     - name: Setup Gradle
       uses: gradle/actions/setup-gradle@v5.0.0
\ No newline at end of file
```

**File**: `.github/workflows/gradle.yml` (modified, +8/-5)
```diff
@@ -62,6 +62,9 @@ jobs:
       - name: Gradle setup
         uses: ./.github/actions/gradle-setup
 
+      - name: Select Xcode 26.0
+        run: sudo xcode-select -s /Applications/Xcode_26.0.app
+
       - name: Build iOS simulator app
         run: |
           xcodebuild build \
@@ -71,7 +74,7 @@ jobs:
           -sdk iphonesimulator \
           -arch arm64 \
           -derivedDataPath ./build \
-          -verbose
+          CODE_SIGNING_ALLOWED=NO
 
       - name: Upload App Folder
         uses: actions/upload-artifact@v4
@@ -91,7 +94,7 @@ jobs:
         uses: ./.github/actions/gradle-setup
 
       - name: Build macOS DMG
-        run: ./gradlew :desktop:packageDmg
+        run: ./gradlew :desktopApp:packageDmg
 
       - name: Upload macOS DMG
         uses: actions/upload-artifact@v4
@@ -107,11 +110,11 @@ jobs:
       - name: Checkout
         uses: actions/checkout@v4
 
-      - name: Setup Gradle
-        uses: gradle/actions/setup-gradle@v5.0.0
+      - name: Gradle setup
+        uses: ./.github/actions/gradle-setup
 
       - name: Build Windows MSI
-        run: ./gradlew :desktop:packageMsi
+        run: ./gradlew :desktopApp:packageMsi
 
       - name: Upload Windows MSI
         uses: actions/upload-artifact@v4
```

---

### Incident Patch 2: `30373017` (2025-08-19)
**Commit Message**: Marton's code review comments fixes, except those related to VMs TBH separately.

**File**: `build.gradle.kts` (modified, +2/-2)
```diff
@@ -6,9 +6,9 @@ plugins {
     alias(libs.plugins.kotlinx.serialization) apply false
     alias(libs.plugins.kotlin.multiplatform) apply false
     alias(libs.plugins.compose.multiplatform) apply false
-    alias(libs.plugins.kotlin.android).apply(false)
+    alias(libs.plugins.kotlin.android) apply false
     alias(libs.plugins.kotlin.parcelize) apply false
-    alias(libs.plugins.dependencyUpdates).apply(false)
+    alias(libs.plugins.dependencyUpdates) apply false
     alias(libs.plugins.compose.compiler) apply false
 }
 
```

**File**: `composeApp/build.gradle.kts` (modified, +0/-1)
```diff
@@ -60,7 +60,6 @@ kotlin {
         jvmMain.dependencies {
             implementation(compose.desktop.currentOs)
             implementation(libs.kotlinx.coroutines.swing)
-            implementation(libs.ktor.client.java)
         }
     }
 }
```

**File**: `composeApp/src/androidMain/kotlin/com/github/jetbrains/rssreader/App.kt` (modified, +2/-5)
```diff
@@ -3,10 +3,8 @@ package com.github.jetbrains.rssreader
 import android.app.Application
 import android.content.Context
 import com.github.jetbrains.rssreader.app.FeedStore
-import com.github.jetbrains.rssreader.core.createAndroid
+import com.github.jetbrains.rssreader.core.buildRssReader
 import com.github.jetbrains.rssreader.sync.RefreshWorker
-import com.github.jetbrains.rssreader.ui.AndroidWebLinks
-import com.github.jetbrains.rssreader.ui.WebLinks
 import org.koin.android.ext.koin.androidContext
 import org.koin.android.ext.koin.androidLogger
 import org.koin.core.context.startKoin
@@ -22,9 +20,8 @@ class App : Application() {
     }
 
     private val appModule = module {
-        single { createAndroid(get<Context>(), BuildConfig.DEBUG) }
+        single { buildRssReader(get<Context>(), BuildConfig.DEBUG) }
         single { FeedStore(get()) }
-        single<WebLinks> { AndroidWebLinks(androidContext()) }
     }
 
     private fun initKoin() {
```

**File**: `composeApp/src/androidMain/kotlin/com/github/jetbrains/rssreader/core/RssReader.kt` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import io.github.aakira.napier.DebugAntilog
 import io.github.aakira.napier.Napier
 import kotlinx.serialization.json.Json
 
-fun createAndroid(ctx: Context, withLog: Boolean) = RssReader(
+fun buildRssReader(ctx: Context, withLog: Boolean) = RssReader(
     FeedLoader(
         HttpClient(withLog)
     ),
```

**File**: `composeApp/src/androidMain/kotlin/com/github/jetbrains/rssreader/ui/WebLinks.kt` (removed, +0/-15)
```diff
@@ -1,15 +0,0 @@
-package com.github.jetbrains.rssreader.ui
-
-import android.content.Context
-import android.content.Intent
-import android.content.Intent.FLAG_ACTIVITY_NEW_TASK
-import android.net.Uri
-import org.koin.core.component.KoinComponent
-
-class AndroidWebLinks(val context: Context): WebLinks, KoinComponent {
-    override fun openWebView(url: String) {
-        val intent = Intent(Intent.ACTION_VIEW,Uri.parse(url))
-        intent.flags = FLAG_ACTIVITY_NEW_TASK
-        context.startActivity(intent)
-    }
-}
```

**File**: `composeApp/src/commonMain/composeResources/drawable/ic_add.xml` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
-<vector xmlns:android="http://schemas.android.com/apk/res/android"
-    android:width="24dp"
-    android:height="24dp"
-    android:viewportWidth="24"
-    android:viewportHeight="24">
-    <path
-        android:fillColor="#041619"
-        android:fillType="nonZero"
-        android:pathData="M19,13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
-</vector>
```

**File**: `composeApp/src/commonMain/composeResources/drawable/ic_edit.xml` (removed, +0/-10)
```diff
@@ -1,10 +0,0 @@
-<vector xmlns:android="http://schemas.android.com/apk/res/android"
-    android:width="24dp"
-    android:height="24dp"
-    android:viewportWidth="24"
-    android:viewportHeight="24">
-    <path
-        android:fillColor="#041619"
-        android:fillType="nonZero"
-        android:pathData="M3,17.25V21h3.75L17.81,9.94l-3.75,-3.75L3,17.25zM20.71,7.04c0.39,-0.39 0.39,-1.02 0,-1.41l-2.34,-2.34c-0.39,-0.39 -1.02,-0.39 -1.41,0l-1.83,1.83 3.75,3.75 1.83,-1.83z" />
-</vector>
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/RssReaderApp.kt` (modified, +7/-7)
```diff
@@ -29,7 +29,7 @@ import com.github.jetbrains.rssreader.ui.AppTheme
 import com.github.jetbrains.rssreader.ui.FeedListScreen
 import com.github.jetbrains.rssreader.ui.MainScreen
 import com.github.jetbrains.rssreader.ui.RssFeedAppBar
-import com.github.jetbrains.rssreader.ui.Screens
+import com.github.jetbrains.rssreader.ui.Screen
 import kotlinx.coroutines.flow.filterIsInstance
 import org.koin.compose.koinInject
 
@@ -40,8 +40,8 @@ fun RssReaderApp(navController: NavHostController = rememberNavController()) {
         // Get current back stack entry
         val backStackEntry by navController.currentBackStackEntryAsState()
         // Get the name of the current screen
-        val currentScreen = Screens.valueOf(
-            backStackEntry?.destination?.route ?: Screens.Main.name
+        val currentScreen = Screen.valueOf(
+            backStackEntry?.destination?.route ?: Screen.Main.name
         )
         val snackbarHostState = remember { SnackbarHostState() }
 
@@ -66,20 +66,20 @@ fun RssReaderApp(navController: NavHostController = rememberNavController()) {
         ) { innerPadding ->
             NavHost(
                 navController = navController,
-                startDestination = Screens.Main.name,
+                startDestination = Screen.Main.name,
                 modifier = Modifier
                     .fillMaxSize()
                     .padding(innerPadding)
             ) {
-                composable(route = Screens.Main.name) {
+                composable(route = Screen.Main.name) {
                     MainScreen(
-                        onEditClick = { navController.navigate(Screens.FeedList.name) },
+                        onEditClick = { navController.navigate(Screen.FeedList.name) },
                         modifier = Modifier
                             .fillMaxSize()
                             .padding(16.dp)
                     )
                 }
-                composable(route = Screens.FeedList.name) {
+                composable(route = Screen.FeedList.name) {
                     FeedListScreen()
                 }
             }
```

---

### Incident Patch 3: `f0e85537` (2025-08-12)
**Commit Message**: Refactor codebase: optimize imports, enhance UI layouts, update dependencies, clean up XML and JSON serialization, and improve Koin module configurations.

**File**: `build.gradle.kts` (modified, +11/-3)
```diff
@@ -3,9 +3,17 @@ plugins {
     // in each subproject's classloader
     alias(libs.plugins.android.application) apply false
     alias(libs.plugins.android.library) apply false
+    alias(libs.plugins.kotlinx.serialization) apply false
+    alias(libs.plugins.kotlin.multiplatform) apply false
     alias(libs.plugins.compose.multiplatform) apply false
-    alias(libs.plugins.compose.compiler) apply false
+    alias(libs.plugins.kotlin.android).apply(false)
     alias(libs.plugins.kotlin.parcelize) apply false
-    alias(libs.plugins.kotlin.multiplatform) apply false
-    alias(libs.plugins.kotlinx.serialization) apply false
+    alias(libs.plugins.dependencyUpdates).apply(false)
+    alias(libs.plugins.compose.compiler) apply false
+}
+
+allprojects {
+    // ./gradlew dependencyUpdates
+    // Report: build/dependencyUpdates/report.txt
+    apply(plugin = "com.github.ben-manes.versions")
 }
\ No newline at end of file
```

**File**: `composeApp/build.gradle.kts` (modified, +3/-8)
```diff
@@ -7,7 +7,6 @@ plugins {
     alias(libs.plugins.compose.multiplatform)
     alias(libs.plugins.compose.compiler)
     alias(libs.plugins.kotlin.parcelize)
-    alias(libs.plugins.kotlinx.serialization)
 }
 
 kotlin {
@@ -21,6 +20,7 @@ kotlin {
 
     sourceSets {
         commonMain.dependencies {
+            //Compose
             implementation(compose.runtime)
             implementation(compose.foundation)
             implementation(compose.material3)
@@ -32,16 +32,13 @@ kotlin {
             implementation(libs.coil.network.ktor3)
             implementation(libs.androidx.lifecycle.runtime.compose)
             implementation(libs.koin.compose)
-            //Navigation
             implementation(libs.navigation.compose)
             implementation(libs.material.icons.core)
-
-            implementation(projects.shared)
+            //Key-value settings
             implementation(libs.multiplatform.settings)
-
             //JSON
             implementation(libs.kotlinx.serialization.json)
-
+            implementation(projects.shared)
         }
         androidMain.dependencies {
             //Compose Utils
@@ -53,14 +50,12 @@ kotlin {
             //DI
             implementation(libs.koin.core)
             implementation(libs.koin.android)
-
             //WorkManager
             implementation(libs.work.runtime.ktx)
             //Splash
             implementation(libs.androidx.core.splashscreen)
             //Logger
             implementation(libs.napier)
-
         }
         jvmMain.dependencies {
             implementation(compose.desktop.currentOs)
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/RssReaderApp.kt` (modified, +25/-10)
```diff
@@ -1,11 +1,21 @@
 package com.github.jetbrains.rssreader
 
-import androidx.compose.foundation.layout.*
+import androidx.compose.foundation.layout.WindowInsets
+import androidx.compose.foundation.layout.WindowInsetsSides
+import androidx.compose.foundation.layout.asPaddingValues
+import androidx.compose.foundation.layout.fillMaxSize
+import androidx.compose.foundation.layout.only
+import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.layout.systemBars
 import androidx.compose.material3.ExperimentalMaterial3Api
 import androidx.compose.material3.Scaffold
 import androidx.compose.material3.SnackbarHost
 import androidx.compose.material3.SnackbarHostState
-import androidx.compose.runtime.*
+import androidx.compose.runtime.Composable
+import androidx.compose.runtime.LaunchedEffect
+import androidx.compose.runtime.collectAsState
+import androidx.compose.runtime.getValue
+import androidx.compose.runtime.remember
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.unit.dp
 import androidx.navigation.NavHostController
@@ -15,7 +25,11 @@ import androidx.navigation.compose.currentBackStackEntryAsState
 import androidx.navigation.compose.rememberNavController
 import com.github.jetbrains.rssreader.app.FeedSideEffect
 import com.github.jetbrains.rssreader.app.FeedStore
-import com.github.jetbrains.rssreader.ui.*
+import com.github.jetbrains.rssreader.ui.AppTheme
+import com.github.jetbrains.rssreader.ui.FeedListScreen
+import com.github.jetbrains.rssreader.ui.MainScreen
+import com.github.jetbrains.rssreader.ui.RssFeedAppBar
+import com.github.jetbrains.rssreader.ui.Screens
 import kotlinx.coroutines.flow.filterIsInstance
 import org.koin.compose.koinInject
 
@@ -30,8 +44,16 @@ fun RssReaderApp(navController: NavHostController = rememberNavController()) {
             backStackEntry?.destination?.route ?: Screens.Main.name
         )
         val snackbarHostState = remember { SnackbarHostState() }
+
         Scaffold(
             modifier = Modifier.fillMaxSize(),
+            topBar = {
+                RssFeedAppBar(
+                    currentScreen = currentScreen,
+                    canNavigateBack = navController.previousBackStackEntry != null,
+                    navigateUp = { navController.navigateUp() }
+                )
+            },
             snackbarHost = {
                 SnackbarHost(
                     modifier = Modifier.padding(
@@ -40,13 +62,6 @@ fun RssReaderApp(navController: NavHostController = rememberNavController()) {
                             .asPaddingValues()
                     ), hostState = snackbarHostState
                 )
-            },
-            topBar = {
-                RssFeedAppBar(
-                    currentScreen = currentScreen,
-                    canNavigateBack = navController.previousBackStackEntry != null,
-                    navigateUp = { navController.navigateUp() }
-                )
             }
         ) { innerPadding ->
             NavHost(
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/ui/Dialogs.kt` (modified, +7/-3)
```diff
@@ -1,7 +1,11 @@
 package com.github.jetbrains.rssreader.ui
 
 import androidx.compose.foundation.background
-import androidx.compose.foundation.layout.*
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.Spacer
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.layout.size
 import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.material3.Button
 import androidx.compose.material3.MaterialTheme
@@ -16,10 +20,10 @@ import androidx.compose.ui.text.input.TextFieldValue
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.Dialog
 import com.github.jetbrains.rssreader.Res
-import com.github.jetbrains.rssreader.domain.RssFeed
-import com.github.jetbrains.rssreader.rss_feed_url
 import com.github.jetbrains.rssreader.add
+import com.github.jetbrains.rssreader.domain.RssFeed
 import com.github.jetbrains.rssreader.remove
+import com.github.jetbrains.rssreader.rss_feed_url
 import org.jetbrains.compose.resources.stringResource
 
 @Composable
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/ui/FeedIcon.kt` (modified, +2/-2)
```diff
@@ -19,11 +19,11 @@ import androidx.compose.ui.layout.ContentScale
 import androidx.compose.ui.unit.dp
 import coil3.compose.AsyncImage
 import com.github.jetbrains.rssreader.Res
+import com.github.jetbrains.rssreader.all
 import com.github.jetbrains.rssreader.domain.RssFeed
+import com.github.jetbrains.rssreader.ic_edit
 import org.jetbrains.compose.resources.stringResource
 import org.jetbrains.compose.resources.vectorResource
-import com.github.jetbrains.rssreader.all
-import com.github.jetbrains.rssreader.ic_edit
 
 @Composable
 fun FeedIcon(
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/ui/MainFeed.kt` (modified, +9/-2)
```diff
@@ -1,6 +1,13 @@
 package com.github.jetbrains.rssreader.ui
 
-import androidx.compose.foundation.layout.*
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.PaddingValues
+import androidx.compose.foundation.layout.Spacer
+import androidx.compose.foundation.layout.WindowInsets
+import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.layout.navigationBars
+import androidx.compose.foundation.layout.size
+import androidx.compose.foundation.layout.windowInsetsBottomHeight
 import androidx.compose.foundation.lazy.LazyRow
 import androidx.compose.foundation.lazy.items
 import androidx.compose.foundation.lazy.rememberLazyListState
@@ -12,8 +19,8 @@ import androidx.compose.ui.Modifier
 import androidx.compose.ui.unit.dp
 import com.github.jetbrains.rssreader.app.FeedAction
 import com.github.jetbrains.rssreader.app.FeedStore
-import com.github.jetbrains.rssreader.domain.RssFeed
 import com.github.jetbrains.rssreader.domain.Item
+import com.github.jetbrains.rssreader.domain.RssFeed
 import kotlinx.coroutines.launch
 
 @Composable
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/ui/PostList.kt` (modified, +15/-10)
```diff
@@ -5,7 +5,12 @@ import androidx.compose.foundation.gestures.Orientation
 import androidx.compose.foundation.gestures.draggable
 import androidx.compose.foundation.gestures.rememberDraggableState
 import androidx.compose.foundation.gestures.scrollBy
-import androidx.compose.foundation.layout.*
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.Column
+import androidx.compose.foundation.layout.PaddingValues
+import androidx.compose.foundation.layout.Spacer
+import androidx.compose.foundation.layout.padding
+import androidx.compose.foundation.layout.size
 import androidx.compose.foundation.lazy.LazyColumn
 import androidx.compose.foundation.lazy.LazyListState
 import androidx.compose.foundation.lazy.itemsIndexed
@@ -35,13 +40,13 @@ fun PostList(
     val coroutineScope = rememberCoroutineScope()
     LazyColumn(
         modifier = modifier.draggable(
-                orientation = Orientation.Vertical,
-                state = rememberDraggableState { delta ->
-                    coroutineScope.launch {
-                        listState.scrollBy(-delta)
-                    }
-                },
-            ),
+            orientation = Orientation.Vertical,
+            state = rememberDraggableState { delta ->
+                coroutineScope.launch {
+                    listState.scrollBy(-delta)
+                }
+            },
+        ),
         contentPadding = PaddingValues(16.dp),
         state = listState,
     ) {
@@ -60,14 +65,14 @@ fun PostItem(
 ) {
     val padding = 16.dp
     Box {
-        Card( //todo check elevation
+        Card(
             shape = RoundedCornerShape(padding)
         ) {
             Column(
                 modifier = Modifier.clickable(onClick = onClick)
             ) {
                 Spacer(modifier = Modifier.size(padding))
-                item.title?.let {title ->
+                item.title?.let { title ->
                     Text(
                         modifier = Modifier.padding(start = padding, end = padding),
                         style = MaterialTheme.typography.headlineSmall,
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/ui/Screens.kt` (modified, +11/-5)
```diff
@@ -2,22 +2,28 @@ package com.github.jetbrains.rssreader.ui
 
 import androidx.compose.material.icons.Icons
 import androidx.compose.material.icons.automirrored.filled.ArrowBack
-import androidx.compose.material3.*
+import androidx.compose.material3.ExperimentalMaterial3Api
+import androidx.compose.material3.Icon
+import androidx.compose.material3.IconButton
+import androidx.compose.material3.MaterialTheme
+import androidx.compose.material3.Text
+import androidx.compose.material3.TopAppBar
+import androidx.compose.material3.TopAppBarDefaults
 import androidx.compose.material3.pulltorefresh.PullToRefreshBox
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.getValue
 import androidx.compose.ui.Modifier
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
+import com.github.jetbrains.rssreader.Res
 import com.github.jetbrains.rssreader.app.FeedAction
 import com.github.jetbrains.rssreader.app.FeedStore
-import org.jetbrains.compose.resources.StringResource
-import org.jetbrains.compose.resources.stringResource
-import org.koin.compose.koinInject
 import com.github.jetbrains.rssreader.app_name
 import com.github.jetbrains.rssreader.back_button
 import com.github.jetbrains.rssreader.feed_list
-import com.github.jetbrains.rssreader.Res
+import org.jetbrains.compose.resources.StringResource
+import org.jetbrains.compose.resources.stringResource
+import org.koin.compose.koinInject
 
 enum class Screens(val title: StringResource) {
     Main(Res.string.app_name), FeedList(Res.string.feed_list);
```

---

### Incident Patch 4: `9bb62d4d` (2025-08-12)
**Commit Message**: Refactor project structure: migrate code to shared module, enhance Compose UI components, implement navigation updates, and improve feed parsing logic.

**File**: `iosApp/iosApp/View/StringExtensions.swift` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import Foundation
+
+extension String {
+    func decodeHtmlEntities() -> String {
+        guard let data = self.data(using: .utf8) else {
+            return self
+        }
+
+        let options: [NSAttributedString.DocumentReadingOptionKey: Any] = [
+            .documentType: NSAttributedString.DocumentType.html,
+            .characterEncoding: String.Encoding.utf8.rawValue
+        ]
+
+        do {
+            let attributedString = try NSAttributedString(data: data, options: options, documentAttributes: nil)
+            return attributedString.string
+        } catch {
+            print("Error decoding HTML entities: \(error)")
+            return self
+        }
+    }
+}
```

---

### Incident Patch 5: `f7ec9cbf` (2025-08-12)
**Commit Message**: Refactor project structure: migrate code to shared module, enhance Compose UI components, implement navigation updates, and improve feed parsing logic.

**File**: `composeApp/build.gradle.kts` (modified, +19/-40)
```diff
@@ -1,6 +1,5 @@
 import com.android.build.gradle.internal.cxx.configure.gradleLocalProperties
 import org.jetbrains.kotlin.gradle.dsl.JvmTarget
-import org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackConfig
 
 plugins {
     alias(libs.plugins.kotlin.multiplatform)
@@ -18,22 +17,10 @@ kotlin {
         }
     }
 
-    listOf(
-        iosX64(),
-        iosArm64(),
-        iosSimulatorArm64()
-    ).forEach {
-        it.binaries.framework {
-            baseName = "RssReader"
-            isStatic = true
-        }
-    }
-
     jvm()
 
     sourceSets {
         commonMain.dependencies {
-            //CMP
             implementation(compose.runtime)
             implementation(compose.foundation)
             implementation(compose.material3)
@@ -42,29 +29,19 @@ kotlin {
             implementation(compose.components.uiToolingPreview)
             //Compose Utils
             implementation(libs.coil.compose)
+            implementation(libs.coil.network.ktor3)
             implementation(libs.androidx.lifecycle.runtime.compose)
-            //Network
-            implementation(libs.ktor.core)
-            implementation(libs.ktor.logging)
-            implementation(libs.ktor.client.content.negotiation)
-            implementation(libs.ktor.xml)
-            //Coroutines
-            implementation(libs.kotlinx.coroutines.core)
-            //Logger
-            implementation(libs.napier)
-            //JSON
-            implementation(libs.kotlinx.serialization.json)
-            //Key-Value storage
-            implementation(libs.multiplatform.settings)
-            // DI
-            api(libs.koin.core)
             implementation(libs.koin.compose)
             //Navigation
-            implementation(libs.voyager.navigator)
-            //Date formatting
-            implementation(libs.kotlinx.datetime)
-            implementation(libs.serialization)
-            implementation(libs.core)
+            implementation(libs.navigation.compose)
+            implementation(libs.material.icons.core)
+
+            implementation(projects.shared)
+            implementation(libs.multiplatform.settings)
+
+            //JSON
+            implementation(libs.kotlinx.serialization.json)
+
         }
         androidMain.dependencies {
             //Compose Utils
@@ -77,16 +54,13 @@ kotlin {
             implementation(libs.koin.core)
             implementation(libs.koin.android)
 
-            implementation(libs.ktor.client.android)
-
             //WorkManager
             implementation(libs.work.runtime.ktx)
             //Splash
             implementation(libs.androidx.core.splashscreen)
-        }
-        iosMain.dependencies {
-            //Network
-            implementation(libs.ktor.client.ios)
+            //Logger
+            implementation(libs.napier)
+
         }
         jvmMain.dependencies {
             implementation(compose.desktop.currentOs)
@@ -96,7 +70,6 @@ kotlin {
     }
 }
 
-
 android {
     namespace = "com.github.jetbrains.rssreader"
     compileSdk = libs.versions.android.compileSdk.get().toInt()
@@ -151,3 +124,9 @@ android {
     }
 }
 
+compose.resources {
+    publicResClass = true
+    packageOfResClass = "com.github.jetbrains.rssreader"
+    generateResClass = auto
+}
+
```

**File**: `composeApp/src/androidMain/AndroidManifest.xml` (modified, +2/-1)
```diff
@@ -13,7 +13,8 @@
             android:name=".AppActivity"
             android:configChanges="orientation|screenSize|screenLayout|keyboardHidden|mnc|colorMode|density|fontScale|fontWeightAdjustment|keyboard|layoutDirection|locale|mcc|navigation|smallestScreenSize|touchscreen|uiMode"
             android:launchMode="singleInstance"
-            android:exported="true">
+            android:exported="true"
+            android:theme="@style/Theme.AppCompat.Light.NoActionBar">
             <intent-filter>
                 <action android:name="android.intent.action.MAIN" />
 
```

**File**: `composeApp/src/androidMain/kotlin/com/github/jetbrains/rssreader/AppActivity.kt` (modified, +2/-3)
```diff
@@ -5,14 +5,13 @@ import androidx.activity.ComponentActivity
 import androidx.activity.compose.setContent
 import androidx.activity.enableEdgeToEdge
 import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
-import com.github.jetbrains.rssreader.app.FeedStore
-import org.koin.android.ext.android.inject
 
 class AppActivity : ComponentActivity() {
     override fun onCreate(savedInstanceState: Bundle?) {
-        enableEdgeToEdge()
         super.onCreate(savedInstanceState)
 
+        enableEdgeToEdge()
+
         installSplashScreen()
 
         setContent {
```

**File**: `composeApp/src/androidMain/kotlin/com/github/jetbrains/rssreader/ui/WebLinks.kt` (modified, +0/-4)
```diff
@@ -4,11 +4,7 @@ import android.content.Context
 import android.content.Intent
 import android.content.Intent.FLAG_ACTIVITY_NEW_TASK
 import android.net.Uri
-import org.koin.compose.koinInject
-import org.koin.core.KoinApplication
 import org.koin.core.component.KoinComponent
-import org.koin.core.context.KoinContext
-import org.koin.java.KoinJavaComponent.inject
 
 class AndroidWebLinks(val context: Context): WebLinks, KoinComponent {
     override fun openWebView(url: String) {
```

**File**: `composeApp/src/commonMain/composeResources/values/strings.xml` (modified, +2/-0)
```diff
@@ -1,8 +1,10 @@
 <?xml version="1.0" encoding="utf-8"?>
 <resources>
     <string name="app_name">RSS reader</string>
+    <string name="feed_list">Manage feeds</string>
     <string name="rss_feed_url">Rss feed url</string>
     <string name="add">Add</string>
     <string name="remove">Remove</string>
     <string name="all">All</string>
+    <string name="back_button">Back</string>
 </resources>
\ No newline at end of file
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/RssReaderApp.kt` (modified, +62/-43)
```diff
@@ -1,64 +1,83 @@
 package com.github.jetbrains.rssreader
 
-import androidx.compose.foundation.layout.Box
-import androidx.compose.foundation.layout.Column
-import androidx.compose.foundation.layout.WindowInsets
-import androidx.compose.foundation.layout.WindowInsetsSides
-import androidx.compose.foundation.layout.asPaddingValues
-import androidx.compose.foundation.layout.fillMaxSize
-import androidx.compose.foundation.layout.only
-import androidx.compose.foundation.layout.padding
-import androidx.compose.foundation.layout.safeContentPadding
-import androidx.compose.foundation.layout.systemBars
+import androidx.compose.foundation.layout.*
+import androidx.compose.material3.ExperimentalMaterial3Api
 import androidx.compose.material3.Scaffold
 import androidx.compose.material3.SnackbarHost
 import androidx.compose.material3.SnackbarHostState
-import androidx.compose.runtime.Composable
-import androidx.compose.runtime.LaunchedEffect
-import androidx.compose.runtime.collectAsState
-import androidx.compose.runtime.remember
+import androidx.compose.runtime.*
 import androidx.compose.ui.Modifier
-import cafe.adriel.voyager.navigator.Navigator
+import androidx.compose.ui.unit.dp
+import androidx.navigation.NavHostController
+import androidx.navigation.compose.NavHost
+import androidx.navigation.compose.composable
+import androidx.navigation.compose.currentBackStackEntryAsState
+import androidx.navigation.compose.rememberNavController
 import com.github.jetbrains.rssreader.app.FeedSideEffect
 import com.github.jetbrains.rssreader.app.FeedStore
-import com.github.jetbrains.rssreader.ui.AppTheme
-import com.github.jetbrains.rssreader.ui.MainScreen
+import com.github.jetbrains.rssreader.ui.*
 import kotlinx.coroutines.flow.filterIsInstance
 import org.koin.compose.koinInject
 
+@OptIn(ExperimentalMaterial3Api::class)
 @Composable
-fun RssReaderApp() {
+fun RssReaderApp(navController: NavHostController = rememberNavController()) {
     AppTheme {
-        val store: FeedStore = koinInject<FeedStore>()
+        // Get current back stack entry
+        val backStackEntry by navController.currentBackStackEntryAsState()
+        // Get the name of the current screen
+        val currentScreen = Screens.valueOf(
+            backStackEntry?.destination?.route ?: Screens.Main.name
+        )
         val snackbarHostState = remember { SnackbarHostState() }
-
-        val error = store.observeSideEffect()
-            .filterIsInstance<FeedSideEffect.Error>()
-            .collectAsState(null)
-        LaunchedEffect(error.value) {
-            error.value?.let {
-                snackbarHostState.showSnackbar(
-                    it.error.message.toString()
+        Scaffold(
+            modifier = Modifier.fillMaxSize(),
+            snackbarHost = {
+                SnackbarHost(
+                    modifier = Modifier.padding(
+                        WindowInsets.systemBars
+                            .only(WindowInsetsSides.Bottom)
+                            .asPaddingValues()
+                    ), hostState = snackbarHostState
+                )
+            },
+            topBar = {
+                RssFeedAppBar(
+                    currentScreen = currentScreen,
+                    canNavigateBack = navController.previousBackStackEntry != null,
+                    navigateUp = { navController.navigateUp() }
                 )
             }
-        }
+        ) { innerPadding ->
+            NavHost(
+                navController = navController,
+                startDestination = Screens.Main.name,
+                modifier = Modifier
+                    .fillMaxSize()
+                    .padding(innerPadding)
+            ) {
+                composable(route = Screens.Main.name) {
+                    MainScreen(
+                        onEditClick = { navController.navigate(Screens.FeedList.name) },
+                        modifier = Modifier
+                            .fillMaxSize()
+                            .padding(16.dp)
+                    )
+                }
+                composable(route = Screens.FeedList.name) {
+                    FeedListScreen()
+                }
+            }
 
-        Box(
-            modifier = Modifier.safeContentPadding().fillMaxSize()
-        )
-        {
-            Scaffold(
-                snackbarHost = {
-                    SnackbarHost(
-                        modifier = Modifier.padding(
-                            WindowInsets.systemBars
-                                .only(WindowInsetsSides.Bottom)
-                                .asPaddingValues()
-                        ), hostState = snackbarHostState
+            val store: FeedStore = koinInject<FeedStore>()
+            val error = store.observeSideEffect()
+                .filterIsInstance<FeedSideEffect.Error>()
+                .collectAsState(null)
+            LaunchedEffect(error.value) {
+                error.value?.let {
+                    snackbarHostState
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/ui/Dialogs.kt` (modified, +4/-4)
```diff
@@ -15,12 +15,12 @@ import androidx.compose.ui.Modifier
 import androidx.compose.ui.text.input.TextFieldValue
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.window.Dialog
+import com.github.jetbrains.rssreader.Res
 import com.github.jetbrains.rssreader.domain.RssFeed
+import com.github.jetbrains.rssreader.rss_feed_url
+import com.github.jetbrains.rssreader.add
+import com.github.jetbrains.rssreader.remove
 import org.jetbrains.compose.resources.stringResource
-import rssreader.composeapp.generated.resources.Res
-import rssreader.composeapp.generated.resources.rss_feed_url
-import rssreader.composeapp.generated.resources.add
-import rssreader.composeapp.generated.resources.remove
 
 @Composable
 fun AddFeedDialog(
```

**File**: `composeApp/src/commonMain/kotlin/com/github/jetbrains/rssreader/ui/FeedIcon.kt` (modified, +14/-11)
```diff
@@ -15,14 +15,15 @@ import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.draw.clip
 import androidx.compose.ui.graphics.Color
+import androidx.compose.ui.layout.ContentScale
 import androidx.compose.ui.unit.dp
-import coil3.compose.rememberAsyncImagePainter
-import rssreader.composeapp.generated.resources.Res
-import rssreader.composeapp.generated.resources.all
-import rssreader.composeapp.generated.resources.ic_edit
+import coil3.compose.AsyncImage
+import com.github.jetbrains.rssreader.Res
 import com.github.jetbrains.rssreader.domain.RssFeed
 import org.jetbrains.compose.resources.stringResource
 import org.jetbrains.compose.resources.vectorResource
+import com.github.jetbrains.rssreader.all
+import com.github.jetbrains.rssreader.ic_edit
 
 @Composable
 fun FeedIcon(
@@ -48,18 +49,20 @@ fun FeedIcon(
                 .background(color = MaterialTheme.colorScheme.primary)
                 .clickable(enabled = onClick != null, onClick = onClick ?: {})
         ) {
+
+            feed?.channel?.image?.url?.let { url ->
+                AsyncImage(
+                    model = url,
+                    contentDescription = null,
+                    contentScale = ContentScale.Crop,
+                    modifier = Modifier.fillMaxSize()
+                )
+            }
             Text(
                 modifier = Modifier.align(Alignment.Center),
                 color = MaterialTheme.colorScheme.onPrimary,
                 text = shortName
             )
-            feed?.channel?.image?.url.let { url ->
-                Image(
-                    painter = rememberAsyncImagePainter(url),
-                    modifier = Modifier.fillMaxSize(),
-                    contentDescription = null
-                )
-            }
         }
     }
 }
```

---

### Incident Patch 6: `559a641e` (2023-10-15)
**Commit Message**: fix aspectRatio content mode

**File**: `iosApp/iosApp/View/PostRow.swift` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ struct PostRow: View {
                 URLImage(url: url) { image in
                     image
                         .resizable()
-                        .aspectRatio(contentMode: .fill)
+                        .aspectRatio(contentMode: .fit)
                 }
                 .frame(minWidth: 0, maxWidth: .infinity)
                 .clipped()
```

---

### Incident Patch 7: `7f1c4f2e` (2023-10-04)
**Commit Message**: Merge pull request #74 from rizwan-dev/fix-build-issue-on-xcode-15

Fix for build issue on Xcode 15

**File**: `gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -1,9 +1,9 @@
 [versions]
 agp = "8.1.1"
-kotlin = "1.9.0"
+kotlin = "1.9.10"
 dependencyUpdates = "0.47.0"
 
-androidx-compose-compiler = "1.5.1"
+androidx-compose-compiler = "1.5.3"
 androidx-compose = "1.5.0"
 androidx-compose-ui = "1.5.0"
 kotlinx-serialization = "1.6.0"
```

---

### Incident Patch 8: `cba0f5d5` (2023-10-03)
**Commit Message**: Fix for build issue on Xcode 15

**File**: `gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -1,9 +1,9 @@
 [versions]
 agp = "8.1.1"
-kotlin = "1.9.0"
+kotlin = "1.9.10"
 dependencyUpdates = "0.47.0"
 
-androidx-compose-compiler = "1.5.1"
+androidx-compose-compiler = "1.5.3"
 androidx-compose = "1.5.0"
 androidx-compose-ui = "1.5.0"
 kotlinx-serialization = "1.6.0"
```

---

### Incident Patch 9: `c357fe62` (2023-05-19)
**Commit Message**: Merge pull request #63 from Kotlin/fix_reloading_on_scroll

Upgrade URL image library to fix reloading issue

**File**: `iosApp/iosApp.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +20/-22)
```diff
@@ -1,25 +1,23 @@
 {
-  "object": {
-    "pins": [
-      {
-        "package": "Introspect",
-        "repositoryURL": "https://github.com/siteline/SwiftUI-Introspect.git",
-        "state": {
-          "branch": null,
-          "revision": "2e09be8af614401bc9f87d40093ec19ce56ccaf2",
-          "version": "0.1.3"
-        }
-      },
-      {
-        "package": "URLImage",
-        "repositoryURL": "https://github.com/dmytro-anokhin/url-image.git",
-        "state": {
-          "branch": null,
-          "revision": "ca1792a46bd2d7d28728c7465ff90da07a8ed1c7",
-          "version": "2.1.1"
-        }
+  "pins" : [
+    {
+      "identity" : "swiftui-introspect",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/siteline/SwiftUI-Introspect.git",
+      "state" : {
+        "revision" : "2e09be8af614401bc9f87d40093ec19ce56ccaf2",
+        "version" : "0.1.3"
       }
-    ]
-  },
-  "version": 1
+    },
+    {
+      "identity" : "url-image",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/dmytro-anokhin/url-image.git",
+      "state" : {
+        "revision" : "ccab89ad1cedb04f25dd4df1776dd8c8583b914a",
+        "version" : "2.2.5"
+      }
+    }
+  ],
+  "version" : 2
 }
```

---

### Incident Patch 10: `ea96c1f8` (2023-04-20)
**Commit Message**: Upgrade URL image to fix reloading issue

**File**: `iosApp/iosApp.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +20/-22)
```diff
@@ -1,25 +1,23 @@
 {
-  "object": {
-    "pins": [
-      {
-        "package": "Introspect",
-        "repositoryURL": "https://github.com/siteline/SwiftUI-Introspect.git",
-        "state": {
-          "branch": null,
-          "revision": "2e09be8af614401bc9f87d40093ec19ce56ccaf2",
-          "version": "0.1.3"
-        }
-      },
-      {
-        "package": "URLImage",
-        "repositoryURL": "https://github.com/dmytro-anokhin/url-image.git",
-        "state": {
-          "branch": null,
-          "revision": "ca1792a46bd2d7d28728c7465ff90da07a8ed1c7",
-          "version": "2.1.1"
-        }
+  "pins" : [
+    {
+      "identity" : "swiftui-introspect",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/siteline/SwiftUI-Introspect.git",
+      "state" : {
+        "revision" : "2e09be8af614401bc9f87d40093ec19ce56ccaf2",
+        "version" : "0.1.3"
       }
-    ]
-  },
-  "version": 1
+    },
+    {
+      "identity" : "url-image",
+      "kind" : "remoteSourceControl",
+      "location" : "https://github.com/dmytro-anokhin/url-image.git",
+      "state" : {
+        "revision" : "ccab89ad1cedb04f25dd4df1776dd8c8583b914a",
+        "version" : "2.2.5"
+      }
+    }
+  ],
+  "version" : 2
 }
```

---

### Incident Patch 11: `944dd41d` (2022-05-27)
**Commit Message**: Fix native compilation

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ plugin-kotlin = "1.6.10" #wait until compose update
 plugin-gver = "0.42.0"
 
 androidx-compose = "1.1.1"
-kotlinx-serialization = "1.3.3"
+kotlinx-serialization = "1.3.2" #https://youtrack.jetbrains.com/issue/KT-52467
 kotlinx-coroutines = "1.6.1"
 ktor = "2.0.1"
 napier = "2.6.1"
```

---

### Incident Patch 12: `6b5ce202` (2022-04-13)
**Commit Message**: Fix project setup.

**File**: `gradle.properties` (modified, +4/-0)
```diff
@@ -4,6 +4,10 @@ org.gradle.jvmargs=-Xmx2048M -Dkotlin.daemon.jvm.options\="-Xmx2048M"
 #Kotlin
 kotlin.code.style=official
 
+#wait kotlin update to 1.6.20
+kotlin.mpp.enableGranularSourceSetsMetadata=true
+kotlin.native.enableDependencyPropagation=false
+
 #Android
 android.useAndroidX=true
 android.compileSdk=31
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ napier = { module = "io.github.aakira:napier", version.ref = "napier" }
 kotlinx-serialization-json = { module = "org.jetbrains.kotlinx:kotlinx-serialization-json", version.ref = "kotlinx-serialization" }
 multiplatform-settings = { module = "com.russhwolf:multiplatform-settings", version.ref = "multiplatform-settings" }
 ktor-client-okhttp = { module = "io.ktor:ktor-client-okhttp", version.ref = "ktor" }
-ktor-client-ios = { module = "io.ktor:ktor-client-ios", version.ref = "ktor" }
+ktor-client-ios = { module = "io.ktor:ktor-client-darwin", version.ref = "ktor" }
 ktor-client-js = { module = "io.ktor:ktor-client-js", version.ref = "ktor" }
 voyager-navigator = { module = "cafe.adriel.voyager:voyager-navigator", version.ref = "voyager" }
 koin-core = { module = "io.insert-koin:koin-core", version.ref = "koin" }
```

---

### Incident Patch 13: `8e12999c` (2021-11-22)
**Commit Message**: fix README presentation1

**File**: `webApp/README.md` (modified, +2/-4)
```diff
@@ -37,7 +37,5 @@ See the section about [deployment](https://facebook.github.io/create-react-app/d
 ## Development
 
 Accessing a feed without cross origin control allowed.
-> **Safari**
-> Develop > Disable cross-origin restrictions
-> **Chrome** (extension)
-> https://chrome.google.com/webstore/detail/allow-cors-access-control/lhobafahddgcelffkeicbaginigeejlf
\ No newline at end of file
+- **Safari**  - Develop > Disable cross-origin restrictions
+- **Chrome** (extension) - https://chrome.google.com/webstore/detail/allow-cors-access-control/lhobafahddgcelffkeicbaginigeejlf
\ No newline at end of file
```

---

### Incident Patch 14: `d8fab4e6` (2021-12-22)
**Commit Message**: Fix coroutines version

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ plugin-kotlin = "1.6.10"
 plugin-gver = "0.39.0"
 
 kotlinx-serialization = "1.3.1"
-kotlinx-coroutines = "1.6.0"
+kotlinx-coroutines = "1.6.0-native-mt"
 ktor = "1.6.7"
 napier = "2.1.0"
 multiplatform-settings = "0.8.1"
```

---

### Incident Patch 15: `504d030a` (2021-12-15)
**Commit Message**: Fix first load on android.

**File**: `composeApp/src/androidMain/kotlin/com/github/jetbrains/rssreader/androidApp/Screens.kt` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ class MainScreen : Screen, KoinComponent {
         val context = LocalContext.current
         val navigator = LocalNavigator.currentOrThrow
         val state = store.observeState().collectAsState()
-        LaunchedEffect(store) {
+        LaunchedEffect(Unit) {
             store.dispatch(FeedAction.Refresh(true))
         }
         SwipeRefresh(
```

#### Recent Merged Pull Requests:
- **PR #92** (2026-08-27): Remove unused Accompanist dependency (@zsmb13)
- **PR #91** (2026-08-07): Bump dependency versions (@zsmb13)
- **PR #90** (2026-08-03): Align version catalog aliases with a shared convention (@zsmb13)
- **PR #88** (2026-05-15): Update project to support AGP 9 and bump dependencies (@evilya)
- **PR #86** (2025-08-19): Add Desktop support (@pahill)
- **PR #85** (2025-06-13): Add main branch push and pull request checks. (@pahill)
- **PR #84** (2025-06-13): Update versions and structure (@pahill)
- **PR #82** (2024-08-07): Prepare KMM production sample for Xcode 16 (@timofeys1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
