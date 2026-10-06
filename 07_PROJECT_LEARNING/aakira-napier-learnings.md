# Forensic Learning Record (Deep Inspection): AAkira/Napier

> **Canonical Artifact**: `07_PROJECT_LEARNING/aakira-napier-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AAkira/Napier](https://github.com/AAkira/Napier))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:12:03.625Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AAkira/Napier`
- **Description**: Logging library for Kotlin Multiplatform
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1005 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/src/main/java/io/github/aakira/napier/sample/CrashlyticsAntilog.kt`
```
package io.github.aakira.napier.sample

import android.content.Context
import com.google.firebase.crashlytics.FirebaseCrashlytics
import io.github.aakira.napier.Antilog
import io.github.aakira.napier.LogLevel

class CrashlyticsAntilog(private val context: Context) : Antilog() {

    override fun performLog(
        priority: LogLevel,
        tag: String?,
        throwable: Throwable?,
        message: String?
    ) {
        // send only error log
        if (priority < LogLevel.ERROR) return

        throwable?.let {
            when (it) {
                // e.g. http exception, add a customized your exception message
//                is KtorException -> {
//                    FirebaseCrashlytics.getInstance()
//                        .log("${priority.ordinal}, HTTP Exception, ${it.response?.errorBody}")
//                }
                else -> FirebaseCrashlytics.getInstance().recordException(it)
            }
        }
    }
}

```

### Core Architecture Module: `android/src/main/java/io/github/aakira/napier/sample/MainActivity.kt`
```
package io.github.aakira.napier.sample

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import io.github.aakira.napier.mppsample.Sample
import io.github.aakira.napier.sample.databinding.ActivityMainBinding
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.textView.text = Sample().hello()

        GlobalScope.launch {
            Sample().suspendHello()
        }

        Sample().handleError()
    }
}

```

### Core Architecture Module: `android/src/main/java/io/github/aakira/napier/sample/NapierApp.kt`
```
package io.github.aakira.napier.sample

import android.app.Application
import com.google.firebase.crashlytics.FirebaseCrashlytics
import io.github.aakira.napier.DebugAntilog
import io.github.aakira.napier.Napier

class NapierApp : Application() {

    override fun onCreate() {
        super.onCreate()

        if (BuildConfig.DEBUG) {
            // Debug build
            FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(false)

            // init napier
            Napier.base(DebugAntilog())
        } else {
            // Others(Release build)
            FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true)

            // init napier
            Napier.base(CrashlyticsAntilog(this))
        }
    }
}

```

### Core Architecture Module: `ios/Napier/AppDelegate.swift`
```
import UIKit
import Firebase
import mpp_sample

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        #if DEBUG
        // Debug build
        
        // init napier
        NapierProxyKt.debugBuild()
        
        #else
        // Others(Release build)
        
        // init firebase crashlytics
        FirebaseApp.configure()
        
        // init napier
        NapierProxyKt.releaseBuild(antilog: CrashlyticsAntilog(
            crashlyticsAddLog: { priority, tag, message in
                Crashlytics.crashlytics().log("\(String(describing: tag)): \(String(describing: message))")
        },
            crashlyticsSendLog: { throwable in
                Crashlytics.crashlytics().record(error: throwable)
        }))
        #endif

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }
}

extension KotlinThrowable: Swift.Error {}

```

### Core Architecture Module: `ios/Napier/Napier.swift`
```
//
//  Napier.swift
//  Napier
//
//  Created by Phil on 23.10.2021.
//  Copyright © 2021 AAkira. All rights reserved.
//

import mpp_sample

extension Napier {
    static func v(tag: String? = nil, _ items: Any..., separator: String = " ", file: String = #file, function: String = #function) {
        log(logLevel: .verbose, tag: tag, items, separator: separator, file: file, function: function)
    }
    
    static func d(tag: String? = nil, _ items: Any..., separator: String = " ", file: String = #file, function: String = #function) {
        log(logLevel: .debug, tag: tag, items, separator: separator, file: file, function: function)
    }
    
    static func i(tag: String? = nil, _ items: Any..., separator: String = " ", file: String = #file, function: String = #function) {
        log(logLevel: .info, tag: tag, items, separator: separator, file: file, function: function)
    }
    
    static func w(tag: String? = nil, _ items: Any..., separator: String = " ", file: String = #file, function: String = #function) {
        log(logLevel: .warning, tag: tag, items, separator: separator, file: file, function: function)
    }
    
    static func e(tag: String? = nil, _ items: Any..., separator: String = " ", file: String = #file, function: String = #function) {
        log(logLevel: .error, tag: tag, items, separator: separator, file: file, function: function)
    }
    
    static func a(tag: String? = nil, _ items: Any..., separator: String = " ", file: String = #file, function: String = #function) {
        log(logLevel: .assert, tag: tag, items, separator: separator, file: file, function: function)
    }
    
    static private func log(logLevel: LogLevel, tag: String?, _ items: [Any], separator: String, file: String, function: String) {
        let message = items.map { "\($0)" }.joined(separator: separator)
        shared.log(
            priority: logLevel,
            tag: tag ?? {
                let fileName = URL(fileURLWithPath: file).lastPathComponent
                let functionName: String
                if let firstBraceIndex = function.firstIndex(of: "(") {
                    functionName = String(function[..<firstBraceIndex])
                } else {
                    functionName = function
                }
                return "\(fileName):\(functionName)"
            }(),
            throwable: nil,
            message: message
        )
    }
}

```

### Core Architecture Module: `ios/Napier/ViewController.swift`
```
import UIKit
import mpp_sample

final class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        configure()
    }
}

private extension ViewController {
    func configure() {
        let label = UILabel(frame: CGRect(x: 0, y: 0, width: 300, height: 24))
        label.center = CGPoint(x: 180, y: 300)
        label.textAlignment = .center
        label.font = label.font.withSize(25)
        
        let sample = Sample()
        label.text = sample.hello()
        
        view.addSubview(label)
        
        sample.suspendHelloKt()
        
        sample.handleError()
        
        Napier.d("Hello", "from Swift")
    }
}

```

### Core Architecture Module: `js/src/main/kotlin/io/github/aakira/napier/sample/Main.kt`
```
package io.github.aakira.napier.sample

import io.github.aakira.napier.DebugAntilog
import io.github.aakira.napier.Napier
import io.github.aakira.napier.mppsample.Sample
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch

fun main() {
    Napier.base(DebugAntilog("napier js"))

    Sample().hello()

    GlobalScope.launch {
        Sample().suspendHello()
    }

    Sample().handleError()
}

```

### Core Architecture Module: `jvm/src/main/kotlin/io/github/aakira/napier/sample/Main.kt`
```
package io.github.aakira.napier.sample

import io.github.aakira.napier.DebugAntilog
import io.github.aakira.napier.Napier
import io.github.aakira.napier.mppsample.Sample
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch

fun main() {
    Napier.base(DebugAntilog())

    val sample = Sample()
    sample.hello()

    GlobalScope.launch {
        sample.suspendHello()
    }

    sample.handleError()

    Thread.sleep(5000)
}

```

### Core Architecture Module: `macOS/Pods/Target Support Files/Pods-macOS (macOS)/Pods-macOS (macOS)-umbrella.h`
```
#ifdef __OBJC__
#import <Cocoa/Cocoa.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif


FOUNDATION_EXPORT double Pods_macOS__macOS_VersionNumber;
FOUNDATION_EXPORT const unsigned char Pods_macOS__macOS_VersionString[];


```

### Core Architecture Module: `macOS/Shared/ContentView.swift`
```
import SwiftUI

struct ContentView: View {
    var body: some View {
        Text("Hello, world!")
            .padding()
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}

```

### Core Architecture Module: `macOS/Shared/macOSApp.swift`
```
import SwiftUI
import Cocoa
import mpp_sample

@main
struct macOSApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        #if DEBUG
        // Debug build
        
        // init napier
        NapierProxyKt.debugBuild()
        
        #else
        // Others(Release build)
        
        // init firebase crashlytics
        FirebaseApp.configure()
        
        // init napier
        NapierProxyKt.releaseBuild(antilog: CrashlyticsAntilog(
            crashlyticsAddLog: { priority, tag, message in
                Crashlytics.crashlytics().log("\(String(describing: tag)): \(String(describing: message))")
        },
            crashlyticsSendLog: { throwable in
                Crashlytics.crashlytics().record(error: throwable)
        }))
        #endif

        let sample = Sample()
        sample.hello()
        
        sample.suspendHelloKt()
        
        sample.handleError()
    }
}

```

### Core Architecture Module: `mpp-sample/src/androidMain/kotlin/io/github/aakira/napier/mppsample/RunBlocking.kt`
```
package io.github.aakira.napier.mppsample

import kotlinx.coroutines.runBlocking

actual fun <T> runBlocking(block: suspend () -> T) {
    runBlocking { block() }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #121** (2024-01-04): **Add ios arm artifacts**
  *Symptoms*: 

- **Issue #120** (2024-01-05): **Could not resolve all files for configuration ':project-name:iosArm64CompilationDependenciesMetadata' in 2.7.0**
  *Symptoms*: After updating from 2.6.1 to 2.7.0, we get the following error during during build:  ``` > Could not resolve all files for configuration ':project-name:iosArm64CompilationDependenciesMetadata'.    > Could not resolve io.github.aakira:napier:2.7.0.      Required by:          project :project-name       > No matching variant of io.github.aakira:napier:2.7.0 was found. The consumer was configured to find a library for use during 'kotlin-metadata', preferably optimized for non-jvm, as well as attribute 'org.jetbrains.kotlin.platform.type' with value 'native', attribute 'org.jetbrains.kotlin.native.target' with value 'ios_arm64' but:           - Variant 'debugApiElements-published' capability io.github.aakira:napier:2.7.0 declares a library for use during compile-time:               - Incompatible because this component declares a component, as well as attribute 'org.jetbrains.kotlin.platform.type' with value 'androidJvm' and the consumer needed a component, as well as attribute 'org.jetbrains.kotlin.platform.type' with value 'native'               - Other compatible attributes:                   - Doesn't say anything about its target Java environment (preferred optimized for non-jvm)                   - Doesn't say anything about org.jetbrains.kotlin.native.target (required 'ios_arm64')           - Variant 'debugRuntimeElements-published' capability io.github.aakira:napier:2.7.0 declares a library for use during runtime:               - Incompatible because this co
  **Post-Mortem & Fix Analysis**:
  > Resolved in 2.7.1

- **Issue #119** (2023-12-29): **Fix napier tests**
  *Symptoms*: This PR is from: https://github.com/AAkira/Napier/pull/118

- **Issue #118** (2023-12-29): **[CHORE] Kotlin 1.9.21**
  *Symptoms*: [FEAT] Support wasm
  **Post-Mortem & Fix Analysis**:
  > hi @AAkira   Need your help to check this PR, and maybe provide an alpha/canary version  would like to use wasm in one of my projects 😄  
  > @ahna92   Thank you so much! Your PR is really helpful for me.  Could you also fix the tests? CI's Java version is out of date, please fix it to 17.
  > hey @AAkira, Pushed test fixes 

- **Issue #111** (2022-10-31): **Write in file system. **
  *Symptoms*: There is any way to write logs in a file? Didn't find this option.
  **Post-Mortem & Fix Analysis**:
  > Hmm, I have the same need for this.

- **Issue #107** (2023-10-05): **How is this different from Kermit?**
  *Symptoms*: Kermit :  https://github.com/touchlab/Kermit
  **Post-Mortem & Fix Analysis**:
  > @kaushalyap Since Napier was released a year before Kermit, it might be more appropriate to ask _Kermit_'s authors what they decided to do differently to Napier?  Napier's first release was in Feb 25, 2019. Kermit's was May 1, 2020.  I can take a guess though: Kermit saw an opportunity to make this much easier. IMO Napier carries some confusing design decisions with it. Answers on a postcard as to what 'AntiLog' even means?
  > Seem Kermit will be good choice since it is maintained by Touchlab who promotes Kotlin Multiplatform.

- **Issue #106** (2022-05-18): **Bump up the version code and name**
  *Symptoms*: There was a problem with the Android-related release of 2.6.0.  #105 

- **Issue #105** (2022-05-18): **2.6.0  does not have android-related artifacts**
  *Symptoms*: error log ``` * What went wrong: Execution failed for task ':data:local:compileDebugKotlinAndroid'. > Error while evaluating property 'filteredArgumentsMap' of task ':data:local:compileDebugKotlinAndroid'    > Could not resolve all files for configuration ':data:local:debugCompileClasspath'.       > Could not find io.github.aakira:napier-android-debug:2.6.0.         Required by:             project :data:local > io.github.aakira:napier:2.6.0 ```  https://search.maven.org/artifact/io.github.aakira/napier-android https://search.maven.org/artifact/io.github.aakira/napier-android-debug
  **Post-Mortem & Fix Analysis**:
  > @yshrsmz  Thank you for reporting.  I published Napier 2.6.1. The android-debug artifact is [here](https://repo1.maven.org/maven2/io/github/aakira/napier-android-debug/2.6.1/).  Could you check it?
  > 👍  Thanks, my CI is happy now!
  > Thank you so much. 😄 

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

### Incident Patch 1: `89a22f61` (2023-12-29)
**Commit Message**: Merge pull request #119 from AAkira/fix-napier-tests

Fix napier tests.

**File**: `android/build.gradle.kts` (modified, +4/-4)
```diff
@@ -10,13 +10,13 @@ plugins {
 }
 
 android {
-    compileSdkVersion(Versions.compileSdkVersion)
-    buildToolsVersion(Versions.buildToolsVersion)
+    compileSdk = Versions.compileSdkVersion
+    buildToolsVersion = Versions.buildToolsVersion
 
     defaultConfig {
         namespace = "io.github.aakira.napier.sample"
-        minSdkVersion(Versions.minSdkVersion)
-        targetSdkVersion(Versions.targetSdkVersion)
+        minSdk = Versions.minSdkVersion
+        targetSdk = Versions.targetSdkVersion
         versionCode = Versions.androidVersionCode
         versionName = Versions.androidVersionName
     }
```

**File**: `buildSrc/src/main/kotlin/dependencies/Versions.kt` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ object Versions {
     const val androidVersionCode = 1
     const val androidVersionName = "1.0.0"
     const val compileSdkVersion = 34
-    const val buildToolsVersion = "29.0.3"
+    const val buildToolsVersion = "34.0.0"
     const val minSdkVersion = 16
     const val targetSdkVersion = 34
 }
```

**File**: `gradle.properties` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-org.gradle.jvmargs=-Xms2048M -Xmx5120M -XX:MaxPermSize=2048M
+org.gradle.jvmargs=-Xms2048M -Xmx5120M 
 
 kotlin.code.style=official
 
```

**File**: `mpp-sample/build.gradle.kts` (modified, +12/-11)
```diff
@@ -15,7 +15,7 @@ version = "1.0.0"
 yarn.lockFileDirectory = file("kotlin-js-store")
 
 kotlin {
-    android()
+    androidTarget()
     js {
         browser()
     }
@@ -25,8 +25,8 @@ kotlin {
     if (ideaActive.not()) {
         // intel
         macosX64()
-        ios()
-        watchos()
+        iosX64()
+        watchosX64()
 
         // apple silicon
         macosArm64()
@@ -86,10 +86,10 @@ kotlin {
             val macosX64Main by getting {
                 dependsOn(darwinMain)
             }
-            val iosMain by getting {
+            val iosX64Main by getting {
                 dependsOn(darwinMain)
             }
-            val watchosMain by getting {
+            val watchosX64Main by getting {
                 dependsOn(darwinMain)
             }
 
@@ -137,15 +137,16 @@ kotlin {
 }
 
 android {
-    compileSdkVersion(Versions.compileSdkVersion)
-    buildToolsVersion(Versions.buildToolsVersion)
+    compileSdk = Versions.compileSdkVersion
+    buildToolsVersion = Versions.buildToolsVersion
 
     defaultConfig {
         namespace = "io.github.aakira.napier.mppsample"
-        minSdkVersion(Versions.minSdkVersion)
-        targetSdkVersion(Versions.targetSdkVersion)
-//        versionCode(Versions.androidVersionCode)
-//        versionName(Versions.androidVersionName)
+        minSdk = Versions.minSdkVersion
+    }
+
+    lint {
+        targetSdk = Versions.targetSdkVersion
     }
 
     sourceSets {
```

**File**: `napier/build.gradle.kts` (modified, +12/-22)
```diff
@@ -10,7 +10,7 @@ plugins {
 apply(from = rootProject.file("./gradle/publish.gradle.kts"))
 
 kotlin {
-    android {
+    androidTarget {
         publishAllLibraryVariants()
     }
     js(IR) {
@@ -25,9 +25,9 @@ kotlin {
     if (ideaActive.not()) {
         // intel
         macosX64()
-        ios()
-        watchos()
-        tvos()
+        iosX64()
+        watchosX64()
+        tvosX64()
 
         // apple silicon
         macosArm64()
@@ -60,7 +60,6 @@ kotlin {
             dependencies {
                 implementation(Dep.Test.common)
                 implementation(Dep.Test.annotation)
-                implementation(Dep.Coroutines.core)
             }
         }
         val androidMain by getting {
@@ -83,24 +82,15 @@ kotlin {
                 implementation(Dep.Test.js)
             }
         }
-        val wasmJsMain by getting {
-            dependencies {
-                implementation(Dep.Kotlin.js)
-            }
-        }
-        val wasmJsTest by getting {
-            dependencies {
-                implementation(Dep.Test.js)
-            }
-        }
+        val wasmJsMain by getting
+        val wasmJsTest by getting
         val jvmMain by getting {
             dependencies {
                 implementation(Dep.Kotlin.jvm)
             }
         }
         val jvmTest by getting {
             dependencies {
-                implementation(Dep.Coroutines.core)
                 implementation(Dep.Test.jvm)
             }
         }
@@ -121,22 +111,22 @@ kotlin {
             val macosX64Test by getting {
                 dependsOn(darwinTest)
             }
-            val iosMain by getting {
+            val iosX64Main by getting {
                 dependsOn(darwinMain)
             }
-            val iosTest by getting {
+            val iosX64Test by getting {
                 dependsOn(darwinTest)
             }
-            val watchosMain by getting {
+            val watchosX64Main by getting {
                 dependsOn(darwinMain)
             }
-            val watchosTest by getting {
+            val watchosX64Test by getting {
                 dependsOn(darwinTest)
             }
-            val tvosMain by getting {
+            val tvosX64Main by getting {
                 dependsOn(darwinMain)
             }
-            val tvosTest by getting {
+            val tvosX64Test by getting {
                 dependsOn(darwinTest)
             }
 
```

**File**: `napier/src/androidUnitTest/kotlin/io/github/aakira/napier/TestRunBlocking.kt` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-package io.github.aakira.napier
-
-import kotlinx.coroutines.runBlocking
-
-actual fun <T> testRunBlocking(block: suspend () -> T) {
-    runBlocking { block() }
-}
```

**File**: `napier/src/commonTest/kotlin/io/github/aakira/napier/TestRunBlocking.kt` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-package io.github.aakira.napier
-
-expect fun <T> testRunBlocking(block: suspend () -> T)
```

**File**: `napier/src/darwinTest/kotlin/io/github/aakira/napier/TestRunBlocking.kt` (removed, +0/-7)
```diff
@@ -1,7 +0,0 @@
-package io.github.aakira.napier
-
-import kotlinx.coroutines.runBlocking
-
-actual fun <T> testRunBlocking(block: suspend () -> T) {
-    runBlocking { block() }
-}
```

---

### Incident Patch 2: `54060de4` (2023-12-29)
**Commit Message**: Merge branch 'master' into fix-napier-tests



---

### Incident Patch 3: `040fd017` (2023-12-29)
**Commit Message**: [TEST] Fix wasm test
[CHORE] pipeline jvm 17

**File**: `.github/workflows/pull_request.yml` (modified, +3/-1)
```diff
@@ -18,7 +18,7 @@ jobs:
       - name: "Setup Java"
         uses: actions/setup-java@v1
         with:
-          java-version: 11
+          java-version: 17
          
       - name: Run common tests
         run: ./gradlew :napier:test --stacktrace
@@ -42,6 +42,8 @@ jobs:
         run: ./gradlew :napier:tvosX64Test --stacktrace
       - name: Run tvos(apple silicon) tests
         run: ./gradlew :napier:tvosSimulatorArm64Test --stacktrace
+      - name: Run wasmJs tests
+        run: ./gradlew :napier:wasmJsTest --stacktrace
 
       - name: Bundle the build report
         if: failure()
```

**File**: `buildSrc/src/main/kotlin/dependencies/Dep.kt` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ object Dep {
     }
 
     object Coroutines {
-        private const val version = "1.7.3"
+        private const val version = "1.8.0-RC2"
 
         const val core = "org.jetbrains.kotlinx:kotlinx-coroutines-core:$version"
     }
```

**File**: `napier/build.gradle.kts` (modified, +10/-0)
```diff
@@ -83,6 +83,16 @@ kotlin {
                 implementation(Dep.Test.js)
             }
         }
+        val wasmJsMain by getting {
+            dependencies {
+                implementation(Dep.Kotlin.js)
+            }
+        }
+        val wasmJsTest by getting {
+            dependencies {
+                implementation(Dep.Test.js)
+            }
+        }
         val jvmMain by getting {
             dependencies {
                 implementation(Dep.Kotlin.jvm)
```

**File**: `napier/src/wasmJsTest/kotlin/io/github/aakira/napier/NapierJsTest.kt` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+package io.github.aakira.napier
+
+class NapierJsTest {
+}
```

**File**: `napier/src/wasmJsTest/kotlin/io/github/aakira/napier/TestRunBlocking.kt` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+package io.github.aakira.napier
+
+import kotlinx.coroutines.GlobalScope
+import kotlinx.coroutines.promise
+import kotlin.coroutines.EmptyCoroutineContext
+
+actual fun <T> testRunBlocking(block: suspend () -> T) {
+    GlobalScope.promise(EmptyCoroutineContext) { block() }
+}
```

---

### Incident Patch 4: `7b5ae4a2` (2022-05-07)
**Commit Message**: log throwable in iOS DebugAntilog

**File**: `napier/src/darwinMain/kotlin/io/github/aakira/napier/DebugAntilog.kt` (modified, +9/-4)
```diff
@@ -34,9 +34,9 @@ actual class DebugAntilog(
         message: String?,
     ) {
         if (priority == LogLevel.ASSERT) {
-            assert(crashAssert) { buildLog(priority, tag, message) }
+            assert(crashAssert) { buildLog(priority, tag, throwable, message) }
         } else {
-            println(buildLog(priority, tag, message))
+            println(buildLog(priority, tag, throwable, message))
         }
     }
 
@@ -50,8 +50,13 @@ actual class DebugAntilog(
 
     private fun getCurrentTime() = dateFormatter.stringFromDate(NSDate())
 
-    private fun buildLog(priority: LogLevel, tag: String?, message: String?): String {
-        return "${getCurrentTime()} ${tagMap[priority]} ${tag ?: performTag(defaultTag)} - $message"
+    private fun buildLog(priority: LogLevel, tag: String?, throwable: Throwable?, message: String?): String {
+        val baseLogString = "${getCurrentTime()} ${tagMap[priority]} ${tag ?: performTag(defaultTag)} - $message"
+        return if (throwable != null) {
+            "$baseLogString\n${throwable.stackTraceToString()}"
+        } else {
+            baseLogString
+        }
     }
 
     // find stack trace
```

---

### Incident Patch 5: `910917c8` (2022-04-06)
**Commit Message**: Merge pull request #97 from ColaGom/refact-ios-null-safety

Refact DebugAntilog null-safety for ios

**File**: `napier/build.gradle.kts` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ kotlin {
                 val macosArm64Main by getting {
                     dependsOn(darwinMain)
                 }
-                val macosArm64Text by getting {
+                val macosArm64Test by getting {
                     dependsOn(darwinTest)
                 }
                 val iosSimulatorArm64Main by getting {
```

**File**: `napier/src/darwinMain/kotlin/io/github/aakira/napier/DebugAntilog.kt` (modified, +5/-6)
```diff
@@ -56,13 +56,12 @@ actual class DebugAntilog(
 
     // find stack trace
     private fun performTag(tag: String): String {
-        val thread = NSThread.callStackSymbols
+        val symbols = NSThread.callStackSymbols
+        if (symbols.size <= CALL_STACK_INDEX) return tag
 
-        return if (thread.size >= CALL_STACK_INDEX) {
-            createStackElementTag(thread[CALL_STACK_INDEX] as String)
-        } else {
-            tag
-        }
+        return (symbols[CALL_STACK_INDEX] as? String)?.let {
+            createStackElementTag(it)
+        } ?: tag
     }
 
     internal fun createStackElementTag(string: String): String {
```

---

### Incident Patch 6: `bfa5a8d0` (2022-04-06)
**Commit Message**: Fix response to code review

**File**: `napier/src/darwinMain/kotlin/io/github/aakira/napier/DebugAntilog.kt` (modified, +3/-4)
```diff
@@ -59,10 +59,9 @@ actual class DebugAntilog(
         val symbols = NSThread.callStackSymbols
         if (symbols.size <= CALL_STACK_INDEX) return tag
 
-        val target = symbols[CALL_STACK_INDEX] as? String
-
-        return if (target != null) createStackElementTag(target)
-        else tag
+        return (symbols[CALL_STACK_INDEX] as? String)?.let {
+            createStackElementTag(it)
+        } ?: tag
     }
 
     internal fun createStackElementTag(string: String): String {
```

---

### Incident Patch 7: `317a7fdd` (2022-03-18)
**Commit Message**: Fix null-safety DebugAntilog for iOS

**File**: `napier/src/darwinMain/kotlin/io/github/aakira/napier/DebugAntilog.kt` (modified, +6/-6)
```diff
@@ -56,13 +56,13 @@ actual class DebugAntilog(
 
     // find stack trace
     private fun performTag(tag: String): String {
-        val thread = NSThread.callStackSymbols
+        val symbols = NSThread.callStackSymbols
+        if (symbols.size <= CALL_STACK_INDEX) return tag
 
-        return if (thread.size >= CALL_STACK_INDEX) {
-            createStackElementTag(thread[CALL_STACK_INDEX] as String)
-        } else {
-            tag
-        }
+        val target = symbols[CALL_STACK_INDEX] as? String
+
+        return if (target != null) createStackElementTag(target)
+        else tag
     }
 
     internal fun createStackElementTag(string: String): String {
```

---

### Incident Patch 8: `20307d81` (2022-03-18)
**Commit Message**: Fix typo

**File**: `napier/build.gradle.kts` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ kotlin {
                 val macosArm64Main by getting {
                     dependsOn(darwinMain)
                 }
-                val macosArm64Text by getting {
+                val macosArm64Test by getting {
                     dependsOn(darwinTest)
                 }
                 val iosSimulatorArm64Main by getting {
```

---

### Incident Patch 9: `76112bb1` (2022-01-25)
**Commit Message**: fix: fix ordering of args

**File**: `napier/src/commonMain/kotlin/io/github/aakira/napier/Napier.kt` (modified, +37/-37)
```diff
@@ -9,8 +9,8 @@ import io.github.aakira.napier.atomic.AtomicMutableList
  * It supports for the Android, Darwin(iOS, macOS, watchOS, tvOS), JVM, JavaScript.
  * Logs written in common module are displayed on logger viewer of each platform.
  *
- * Generally, you should use the [Napier.v()], [Napier.d()], [Napier.i()], [Napier.w()], and
- * [Napier.e()] or [log()] methods to write logs. You can then view the logs in logcat.
+ * Generally, you should use the [Napier.v], [Napier.d], [Napier.i], [Napier.w], and
+ * [Napier.e] or [log] methods to write logs. You can then view the logs in logcat.
  *
  * **Usage :**
  *
@@ -65,133 +65,133 @@ object Napier {
 
     /** Send a VERBOSE log message and log the exception.
      *
+     * @param message String: The message you would like logged. This value cannot be null.
+     * @param throwable Throwable: An exception to log This value may be null.
      * @param tag String: Used to identify the source of a log message. It usually
      * identifies the class or activity where the log call occurs. This value may be null.
-     * @param throwable Throwable: An exception to log This value may be null.
-     * @param message String: The message you would like logged. This value cannot be null.
      */
-    fun v(message: String, tag: String? = null, throwable: Throwable? = null) {
+    fun v(message: String, throwable: Throwable? = null, tag: String? = null) {
         log(LogLevel.VERBOSE, tag, throwable, message)
     }
 
     /** Send a VERBOSE log message and log the exception.
      *
+     * @param throwable Throwable: An exception to log This value may be null.
      * @param tag String: Used to identify the source of a log message. It usually
      * identifies the class or activity where the log call occurs. This value may be null.
-     * @param throwable Throwable: An exception to log This value may be null.
      * @param message Lambda: The message you would like logged. This value cannot be null.
      */
-    fun v(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
+    fun v(throwable: Throwable? = null, tag: String? = null, message: () -> String) {
         log(LogLevel.VERBOSE, tag, throwable, message())
     }
 
     /** Send a INFO log message and log the exception.
      *
+     * @param message String: The message you would like logged. This value cannot be null.
+     * @param throwable Throwable: An exception to log This value may be null.
      * @param tag String: Used to identify the source of a log message. It usually
      * identifies the class or activity where the log call occurs. This value may be null.
-     * @param throwable Throwable: An exception to log This value may be null.
-     * @param message String: The message you would like logged. This value cannot be null.
      */
-    fun i(message: String, tag: String? = null, throwable: Throwable? = null) {
+    fun i(message: String, throwable: Throwable? = null, tag: String? = null) {
         log(LogLevel.INFO, tag, throwable, message)
     }
 
     /** Send a INFO log message and log the exception.
      *
+     * @param throwable Throwable: An exception to log This value may be null.
      * @param tag String: Used to identify the source of a log message. It usually
      * identifies the class or activity where the log call occurs. This value may be null.
-     * @param throwable Throwable: An exception to log This value may be null.
      * @param message Lambda: The message you would like logged. This value cannot be null.
      */
-    fun i(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
+    fun i(throwable: Throwable? = null, tag: String? = null, message: () -> String) {
         log(LogLevel.INFO, tag, throwable, message())
     }
 
     /** Send a DEBUG log message and log the exception.
      *
+     * @param message String: The message you would like logged. This value cannot be null.
+     * @param throwable Throwable: An exception to log This value may be null.
      * @param tag String: Used to identify the source of a log message. It usually
      * identifies the class or activity where the log call occurs. This value may be null.
-     * @param throwable Throwable: An exception to log This value may be null.
-     * @param message String: The message you would like logged. This value cannot be null.
      */
-    fun d(message: String, tag: String? = null, throwable: Throwable? = null) {
+    fun d(message: String, throwable: Throwable? = null, tag: String? = null) {
         log(LogLevel.DEBUG, tag, throwable, message)
     }
 
     /** Send a DEBUG log message and log the exception.
      *
+     * @param throwable Throwable: An exception to log This value may be null.
      * @param tag String: Used to identify the source of a log message. It usually
      * identifies the class or activity where the log call occurs. This value may be null.
-     * @param throwable Throwable: An exception to log This value
```

**File**: `napier/src/commonTest/kotlin/io/github/aakira/napier/NapierTest.kt` (modified, +12/-12)
```diff
@@ -99,7 +99,7 @@ class NapierTest {
             // tag check
             NapierTestCase(
                 "tag verbose",
-                { Napier.v("hello", "tag", null) },
+                { Napier.v("hello", null, "tag") },
                 Expected(
                     LogLevel.VERBOSE,
                     "tag",
@@ -109,7 +109,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "tag debug",
-                { Napier.d("hello", "tag", null) },
+                { Napier.d("hello", null, "tag") },
                 Expected(
                     LogLevel.DEBUG,
                     "tag",
@@ -119,7 +119,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "tag info",
-                { Napier.i("hello", "tag", null) },
+                { Napier.i("hello", null, "tag") },
                 Expected(
                     LogLevel.INFO,
                     "tag",
@@ -129,7 +129,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "tag warning",
-                { Napier.w("hello", "tag", null) },
+                { Napier.w("hello", null, "tag") },
                 Expected(
                     LogLevel.WARNING,
                     "tag",
@@ -139,7 +139,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "tag error",
-                { Napier.e("hello", "tag", null) },
+                { Napier.e("hello", null, "tag") },
                 Expected(
                     LogLevel.ERROR,
                     "tag",
@@ -149,7 +149,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "tag assert",
-                { Napier.wtf("hello", "tag", null) },
+                { Napier.wtf("hello", null, "tag") },
                 Expected(
                     LogLevel.ASSERT,
                     "tag",
@@ -160,7 +160,7 @@ class NapierTest {
             // throwable
             NapierTestCase(
                 "throwable verbose",
-                { Napier.v("hello", "tag", CustomThrowable("error")) },
+                { Napier.v("hello", CustomThrowable("error"), "tag") },
                 Expected(
                     LogLevel.VERBOSE,
                     "tag",
@@ -170,7 +170,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "throwable debug",
-                { Napier.d("hello", "tag", CustomThrowable("error")) },
+                { Napier.d("hello", CustomThrowable("error"), "tag") },
                 Expected(
                     LogLevel.DEBUG,
                     "tag",
@@ -180,7 +180,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "throwable info",
-                { Napier.i("hello", "tag", CustomThrowable("error")) },
+                { Napier.i("hello", CustomThrowable("error"), "tag") },
                 Expected(
                     LogLevel.INFO,
                     "tag",
@@ -190,7 +190,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "throwable warning",
-                { Napier.w("hello", "tag", CustomThrowable("error")) },
+                { Napier.w("hello", CustomThrowable("error"), "tag") },
                 Expected(
                     LogLevel.WARNING,
                     "tag",
@@ -200,7 +200,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "throwable error",
-                { Napier.e("hello", "tag", CustomThrowable("error")) },
+                { Napier.e("hello", CustomThrowable("error"), "tag") },
                 Expected(
                     LogLevel.ERROR,
                     "tag",
@@ -210,7 +210,7 @@ class NapierTest {
             ),
             NapierTestCase(
                 "throwable assert",
-                { Napier.wtf("hello", "tag", CustomThrowable("error")) },
+                { Napier.wtf("hello", CustomThrowable("error"), "tag") },
                 Expected(
                     LogLevel.ASSERT,
                     "tag",
```

---

### Incident Patch 10: `9d7f2316` (2022-01-25)
**Commit Message**: fix(Napier.kt): fix args order for error function

**File**: `napier/src/commonMain/kotlin/io/github/aakira/napier/Napier.kt` (modified, +2/-2)
```diff
@@ -158,7 +158,7 @@ object Napier {
      * @param throwable Throwable: An exception to log This value may be null.
      * @param message String: The message you would like logged. This value cannot be null.
      */
-    fun e(message: String, throwable: Throwable? = null, tag: String? = null) {
+    fun e(message: String, tag: String? = null, throwable: Throwable? = null) {
         log(LogLevel.ERROR, tag, throwable, message)
     }
 
@@ -169,7 +169,7 @@ object Napier {
      * @param throwable Throwable: An exception to log This value may be null.
      * @param message Lambda: The message you would like logged. This value cannot be null.
      */
-    fun e(throwable: Throwable? = null, tag: String? = null, message: () -> String) {
+    fun e(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
         log(LogLevel.ERROR, tag, throwable, message())
     }
 
```

---

### Incident Patch 11: `362a7d3f` (2022-01-24)
**Commit Message**: fix(Napier.swift): change message_ to message

This function argument cause of bug.

**File**: `ios/Napier/Napier.swift` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ extension Napier {
                 return "\(fileName):\(functionName)"
             }(),
             throwable: nil,
-            message_: message
+            message: message
         )
     }
 }
```

---

### Incident Patch 12: `9b46feb4` (2022-01-24)
**Commit Message**: fix(Napier.kt): remove inline keyword

**File**: `napier/src/commonMain/kotlin/io/github/aakira/napier/Napier.kt` (modified, +8/-8)
```diff
@@ -9,7 +9,7 @@ import io.github.aakira.napier.atomic.AtomicMutableList
  * It supports for the Android, Darwin(iOS, macOS, watchOS, tvOS), JVM, JavaScript.
  * Logs written in common module are displayed on logger viewer of each platform.
  *
- * Generally, you should use the [ Napier.v() ], [Napier.d()], [Napier.i()], [Napier.w()], and
+ * Generally, you should use the [Napier.v()], [Napier.d()], [Napier.i()], [Napier.w()], and
  * [Napier.e()] or [log()] methods to write logs. You can then view the logs in logcat.
  *
  * **Usage :**
@@ -81,7 +81,7 @@ object Napier {
      * @param throwable Throwable: An exception to log This value may be null.
      * @param message Lambda: The message you would like logged. This value cannot be null.
      */
-    inline fun v(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
+    fun v(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
         log(LogLevel.VERBOSE, tag, throwable, message())
     }
 
@@ -103,7 +103,7 @@ object Napier {
      * @param throwable Throwable: An exception to log This value may be null.
      * @param message Lambda: The message you would like logged. This value cannot be null.
      */
-    inline fun i(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
+    fun i(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
         log(LogLevel.INFO, tag, throwable, message())
     }
 
@@ -125,7 +125,7 @@ object Napier {
      * @param throwable Throwable: An exception to log This value may be null.
      * @param message Lambda: The message you would like logged. This value cannot be null.
      */
-    inline fun d(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
+    fun d(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
         log(LogLevel.DEBUG, tag, throwable, message())
     }
 
@@ -147,7 +147,7 @@ object Napier {
      * @param throwable Throwable: An exception to log This value may be null.
      * @param message Lambda: The message you would like logged. This value cannot be null.
      */
-    inline fun w(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
+    fun w(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
         log(LogLevel.WARNING, tag, throwable, message())
     }
 
@@ -169,7 +169,7 @@ object Napier {
      * @param throwable Throwable: An exception to log This value may be null.
      * @param message Lambda: The message you would like logged. This value cannot be null.
      */
-    inline fun e(throwable: Throwable? = null, tag: String? = null, message: () -> String) {
+    fun e(throwable: Throwable? = null, tag: String? = null, message: () -> String) {
         log(LogLevel.ERROR, tag, throwable, message())
     }
 
@@ -191,7 +191,7 @@ object Napier {
      * @param throwable Throwable: An exception to log This value may be null.
      * @param message Lambda: The message you would like logged. This value cannot be null.
      */
-    inline fun wtf(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
+    fun wtf(tag: String? = null, throwable: Throwable? = null, message: () -> String) {
         log(LogLevel.ASSERT, tag, throwable, message())
     }
 
@@ -242,7 +242,7 @@ object Napier {
  * @see Napier
  * @author Ghasem Shirdel
  */
-inline fun log(
+fun log(
     tag: String? = null,
     throwable: Throwable? = null,
     priority: LogLevel = LogLevel.DEBUG,
```

---

### Incident Patch 13: `fa3a582c` (2022-01-23)
**Commit Message**: fix(jvm/DebugAntilog.kt): useParentHandlers = false

Parent Handlers cause this problem.

Closes #63

**File**: `napier/src/jvmMain/kotlin/io/github/aakira/napier/DebugAntilog.kt` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ actual class DebugAntilog(
         handler.forEach {
             addHandler(it)
         }
-    }
+    }.also { it.useParentHandlers = false }
 
     private val anonymousClass = Pattern.compile("(\\$\\d+)+$")
 
```

---

### Incident Patch 14: `a53093b0` (2021-10-23)
**Commit Message**: fix sample build for Xcode

**File**: `mpp-sample/build.gradle.kts` (modified, +53/-15)
```diff
@@ -17,16 +17,29 @@ kotlin {
     jvm()
 
     // darwin
-    if (isAppleSilicon) {
+    if (ideaActive.not()) {
+        // intel
+        macosX64()
+        ios()
+        watchos()
+
         // apple silicon
         macosArm64()
         iosSimulatorArm64()
         watchosSimulatorArm64()
     } else {
-        // intel
-        macosX64()
-        iosX64()
-        watchosX64()
+        if (isAppleSilicon) {
+            // apple silicon
+            macosArm64()
+            iosSimulatorArm64()
+            watchosSimulatorArm64()
+        } else {
+            // intel
+            macosX64()
+            iosX64()
+            watchosX64()
+        }
+    }
     }
 
     sourceSets {
@@ -58,28 +71,53 @@ kotlin {
         val darwinMain by creating {
             dependsOn(commonMain)
         }
-        if (isAppleSilicon) {
-            // apple silicon
-            val macosArm64Main by getting {
+        // darwin
+        if (ideaActive.not()) {
+            // intel
+            val macosX64Main by getting {
                 dependsOn(darwinMain)
             }
-            val iosSimulatorArm64Main by getting {
+            val iosMain by getting {
                 dependsOn(darwinMain)
             }
-            val watchosSimulatorArm64Main by getting {
+            val watchosMain by getting {
                 dependsOn(darwinMain)
             }
-        } else {
-            // intel
-            val macosX64Main by getting {
+
+            // apple silicon
+            val macosArm64Main by getting {
                 dependsOn(darwinMain)
             }
-            val iosX64Main by getting {
+            val iosSimulatorArm64Main by getting {
                 dependsOn(darwinMain)
             }
-            val watchosX64Main by getting {
+            val watchosSimulatorArm64Main by getting {
                 dependsOn(darwinMain)
             }
+        } else {
+            if (isAppleSilicon) {
+                // apple silicon
+                val macosArm64Main by getting {
+                    dependsOn(darwinMain)
+                }
+                val iosSimulatorArm64Main by getting {
+                    dependsOn(darwinMain)
+                }
+                val watchosSimulatorArm64Main by getting {
+                    dependsOn(darwinMain)
+                }
+            } else {
+                // intel
+                val macosX64Main by getting {
+                    dependsOn(darwinMain)
+                }
+                val iosX64Main by getting {
+                    dependsOn(darwinMain)
+                }
+                val watchosX64Main by getting {
+                    dependsOn(darwinMain)
+                }
+            }
         }
     }
 
```

---

### Incident Patch 15: `bfe5784c` (2021-08-26)
**Commit Message**: Fix package name.

**File**: `mpp-sample/src/darwinMain/kotlin/io/github/aakira/napier/mppsample/CrashlyticsAntilog.kt` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-package com.github.aakira.napier.mppsample
+package io.github.aakira.napier.mppsample
 
 import io.github.aakira.napier.Antilog
 import io.github.aakira.napier.LogLevel
```

#### Recent Merged Pull Requests:
- **PR #121** (2024-01-04): Add ios arm artifacts (@AAkira)
- **PR #119** (2023-12-29): Fix napier tests (@AAkira)
- **PR #118** (2023-12-29): [CHORE] Kotlin 1.9.21 (@ahna92)
- **PR #106** (2022-05-18): Bump up the version code and name (@AAkira)
- **PR #104** (2022-05-17): Release 2.6.0 (@AAkira)
- **PR #103** (2022-05-10): log throwable in iOS DebugAntilog (@PhilipDukhov)
- **PR #101** (2022-04-06): 2.5.0 (@AAkira)
- **PR #100** (2022-04-06): Bump cocoapods-downloader from 1.2.2 to 1.6.3 in /ios (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
